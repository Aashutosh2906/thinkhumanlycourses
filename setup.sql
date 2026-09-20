-- =====================================================================
--  SAWAAL: database setup
--  Paste this whole file into Supabase > SQL Editor > New query > Run.
--  Safe to run again: it never deletes student data.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. Tables
-- ---------------------------------------------------------------------

-- One row per student. A student is "school + class + secret key".
create table if not exists public.students (
  id          uuid primary key default gen_random_uuid(),
  school      text not null,              -- the school name as the student typed it
  school_key  text not null,              -- same name, lower-case, no punctuation (used for grouping)
  class       text not null,
  secret      text not null,              -- the secret key the student made up
  name        text,                       -- optional: the student's name, if they gave one
  token       uuid not null default gen_random_uuid(),   -- what the browser keeps to stay signed in
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  unique (school_key, class, secret)
);

-- One row per student per course: where they are, and whether they finished.
create table if not exists public.progress (
  student_id   uuid not null references public.students(id) on delete cascade,
  course       text not null,             -- the course's file name, e.g. "sawaal-better"
  screen       int  not null default 0,
  screen_at    timestamptz,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (student_id, course)
);

-- One row per answer.
create table if not exists public.answers (
  student_id  uuid not null references public.students(id) on delete cascade,
  course      text not null,
  item        text not null,              -- the question's id inside the course
  section     text,
  question    text,
  answer      jsonb,
  correct     text,                       -- "1" right, "0" wrong, or a score, or empty
  answered_at timestamptz not null default now(),
  primary key (student_id, course, item)
);
-- For databases set up before the name field existed.
alter table public.students add column if not exists name text;

create index if not exists answers_course_idx on public.answers(course);

create table if not exists public.settings (
  key   text primary key,
  value text not null
);


-- ---------------------------------------------------------------------
--  2. Dashboard password placeholder.
--     DON'T type your real password in this file: it goes on GitHub, where
--     anyone can read it. After this file has run, set your password with
--     this one line in a NEW query (see the README, step 1):
--       update settings set value = 'your-password' where key = 'dashboard_password';
--     The dashboard stays locked until you do.
-- ---------------------------------------------------------------------
insert into public.settings (key, value)
values ('dashboard_password', 'my-dashboard-password')
on conflict (key) do nothing;


-- ---------------------------------------------------------------------
--  3. Lock the tables. Nobody reads or writes them directly;
--     the website only uses the functions below.
-- ---------------------------------------------------------------------
alter table public.students enable row level security;
alter table public.progress enable row level security;
alter table public.answers  enable row level security;
alter table public.settings enable row level security;
revoke all on public.students, public.progress, public.answers, public.settings from anon, authenticated;


-- ---------------------------------------------------------------------
--  4. Functions the website calls
-- ---------------------------------------------------------------------

-- Turns "St. Mary's  School " into "st marys school" so small differences
-- in how students type the name still land in the same school.
create or replace function public._sawaal_school_key(p text)
returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(lower(coalesce(p, '')), '[[:punct:]]', '', 'g'), '\s+', ' ', 'g'))
$$;

create or replace function public._sawaal_student(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select id into v from students where token = p_token;
  if v is null then raise exception 'bad_session'; end if;
  return v;
end $$;

create or replace function public._sawaal_check_password(p_password text)
returns void language plpgsql security definer set search_path = public as $$
declare v text;
begin
  select value into v from settings where key = 'dashboard_password';
  if v is null or v = '' or v = 'my-dashboard-password' then
    raise exception 'password_not_set';
  end if;
  if p_password is distinct from v then
    perform pg_sleep(1);               -- slows down anyone guessing
    raise exception 'wrong_password';
  end if;
end $$;


-- Sign in. p_new = true for "first time here", false for "I've been here before".
drop function if exists public.sawaal_login(text, text, text, boolean);
create or replace function public.sawaal_login(p_school text, p_class text, p_key text, p_new boolean, p_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_school text := regexp_replace(btrim(coalesce(p_school, '')), '\s+', ' ', 'g');
  v_skey   text := _sawaal_school_key(p_school);
  v_class  text := btrim(coalesce(p_class, ''));
  v_key    text := lower(regexp_replace(coalesce(p_key, ''), '\s', '', 'g'));
  v_name   text := nullif(left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 60), '');
  s students;
begin
  if length(v_skey) < 2 or length(v_school) > 100 then raise exception 'school_invalid'; end if;
  if v_class = '' or length(v_class) > 20 then raise exception 'class_invalid'; end if;
  if v_key !~ '^[a-z0-9]{3,20}$' then raise exception 'key_invalid'; end if;

  select * into s from students where school_key = v_skey and class = v_class and secret = v_key;
  if p_new then
    if found then raise exception 'key_taken'; end if;
    begin
      insert into students (school, school_key, class, secret, name)
      values (v_school, v_skey, v_class, v_key, v_name) returning * into s;
    exception when unique_violation then
      raise exception 'key_taken';
    end;
  else
    if not found then raise exception 'key_not_found'; end if;
    update students set last_seen = now(), name = coalesce(v_name, name) where id = s.id returning * into s;
  end if;

  return jsonb_build_object('token', s.token, 'student',
    jsonb_build_object('id', s.id, 'school', s.school, 'class', s.class, 'code', s.secret, 'name', s.name));
end $$;


-- School names already used, for the suggestions list on the sign-in form.
create or replace function public.sawaal_schools()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(name order by name), '[]'::jsonb) from (
    select distinct on (school_key) school as name
    from (select school_key, school, count(*) as n from students group by 1, 2) t
    order by school_key, n desc, school
  ) q
$$;


-- Open a course: returns where the student was and everything they answered.
create or replace function public.sawaal_open(p_token uuid, p_course text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sid uuid := _sawaal_student(p_token);
  p progress;
begin
  if p_course !~ '^[a-z0-9-]{1,60}$' then raise exception 'course_invalid'; end if;
  insert into progress (student_id, course) values (sid, p_course) on conflict do nothing;
  select * into p from progress where student_id = sid and course = p_course;
  update students set last_seen = now() where id = sid;
  return jsonb_build_object(
    'screen', p.screen, 'screen_at', p.screen_at, 'completed_at', p.completed_at,
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object('item', item, 'section', section, 'question', question,
             'answer', answer, 'correct', correct, 'answered_at', answered_at))
      from answers where student_id = sid and course = p_course), '[]'::jsonb));
end $$;


-- Save answers (in batches) and the current screen. Newer answers win.
create or replace function public.sawaal_save(
  p_token uuid, p_course text, p_rows jsonb,
  p_screen int default null, p_screen_at timestamptz default null, p_complete boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid := _sawaal_student(p_token);
begin
  if p_course !~ '^[a-z0-9-]{1,60}$' then raise exception 'course_invalid'; end if;
  p_rows := coalesce(p_rows, '[]'::jsonb);
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 300 then raise exception 'too_many_rows'; end if;
  if length(p_rows::text) > 500000 then raise exception 'payload_too_large'; end if;

  insert into progress (student_id, course) values (sid, p_course) on conflict do nothing;

  insert into answers (student_id, course, item, section, question, answer, correct, answered_at)
  select distinct on (item) sid, p_course, item, section, question, answer, correct, answered_at
  from (
    select left(r->>'item', 80) as item, left(r->>'section', 150) as section,
           left(r->>'question', 800) as question, r->'answer' as answer,
           left(coalesce(r->>'correct', ''), 20) as correct,
           coalesce((r->>'answered_at')::timestamptz, now()) as answered_at
    from jsonb_array_elements(p_rows) r
  ) x
  where coalesce(item, '') <> ''
  order by item, answered_at desc
  on conflict (student_id, course, item) do update
    set section = excluded.section, question = excluded.question, answer = excluded.answer,
        correct = excluded.correct, answered_at = excluded.answered_at
    where excluded.answered_at >= answers.answered_at;

  update progress set
    screen    = case when p_screen is not null and (screen_at is null or coalesce(p_screen_at, now()) >= screen_at)
                     then greatest(p_screen, 0) else screen end,
    screen_at = case when p_screen is not null and (screen_at is null or coalesce(p_screen_at, now()) >= screen_at)
                     then coalesce(p_screen_at, now()) else screen_at end,
    completed_at = case when p_complete then coalesce(completed_at, now()) else completed_at end,
    updated_at = now()
  where student_id = sid and course = p_course;

  update students set last_seen = now() where id = sid;
  return jsonb_build_object('ok', true);
end $$;


-- The home page: which courses this student has started or finished.
create or replace function public.sawaal_my_courses(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid := _sawaal_student(p_token);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('course', course, 'screen', screen,
    'completed_at', completed_at, 'updated_at', updated_at)) from progress where student_id = sid), '[]'::jsonb);
end $$;


-- The dashboard: every student and their progress, plus the answers for one course.
create or replace function public.sawaal_dashboard(p_password text, p_course text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform _sawaal_check_password(p_password);
  return jsonb_build_object(
    'students', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'school', school, 'school_key', school_key, 'class', class, 'code', secret, 'name', name,
        'created_at', created_at, 'last_seen', last_seen)) from students), '[]'::jsonb),
    'progress', coalesce((select jsonb_agg(jsonb_build_object(
        'student_id', student_id, 'course', course, 'screen', screen, 'started_at', started_at,
        'completed_at', completed_at, 'updated_at', updated_at)) from progress), '[]'::jsonb),
    'answers', coalesce((select jsonb_agg(jsonb_build_object(
        'student_id', student_id, 'item', item, 'section', section, 'question', question,
        'answer', answer, 'correct', correct, 'answered_at', answered_at))
        from answers where course = p_course), '[]'::jsonb));
end $$;


-- ---------------------------------------------------------------------
--  5. Who can call what
-- ---------------------------------------------------------------------
revoke all on function public._sawaal_school_key(text)         from public, anon, authenticated;
revoke all on function public._sawaal_student(uuid)             from public, anon, authenticated;
revoke all on function public._sawaal_check_password(text)      from public, anon, authenticated;
grant execute on function public.sawaal_login(text, text, text, boolean, text)               to anon, authenticated;
grant execute on function public.sawaal_schools()                                            to anon, authenticated;
grant execute on function public.sawaal_open(uuid, text)                                     to anon, authenticated;
grant execute on function public.sawaal_save(uuid, text, jsonb, int, timestamptz, boolean)   to anon, authenticated;
grant execute on function public.sawaal_my_courses(uuid)                                     to anon, authenticated;
grant execute on function public.sawaal_dashboard(text, text)                                to anon, authenticated;

-- Done. You should see "Success. No rows returned".
