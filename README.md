# Sawaal

Short courses on using AI well, for students. Anyone with a course link can take it.
Students sign in with their **school name, class and a secret key they make up** (no email, no password;
their name is optional),
and everything saves as they go, so they can carry on later on any phone or computer.
You see everything on one dashboard, school by school.

It's free: **GitHub Pages** hosts the website and **Supabase** stores the answers.

---

## What's in the folder

```
index.html        Home page: sign in + the list of courses        -> yoursite/
dashboard.html    Your dashboard (password protected)             -> yoursite/dashboard.html
courses/          ONE FILE PER COURSE
  sawaal-better.html                                               -> yoursite/courses/sawaal-better.html
courses.js        The list of courses (edit when you add a course)
config.js         Your two Supabase keys (edit once)
sawaal.js         Shared sign-in and saving code (don't edit)
setup.sql         The database (run once in Supabase)
```

That's all of it. Three files you ever touch: `config.js` once, `setup.sql` once, `courses.js` when you add a course.

---

## Setup (about 15 minutes, once)

### Step 1: Make the database (Supabase)
1. Go to **supabase.com**, sign up, click **New project**. Pick the region nearest your schools
   (Mumbai for India and Pakistan). Wait a minute for it to be ready.
2. In Supabase, click **SQL Editor** (left side) > **New query**. Open `setup.sql` in any text editor,
   copy all of it, paste it in, click **Run**. You should see "Success. No rows returned".
3. Set your dashboard password. Click **New query** again, paste this line with your own password
   in place of `your-password`, and click **Run**:
   ```sql
   update settings set value = 'your-password' where key = 'dashboard_password';
   ```
   (Do this here, not inside `setup.sql`: that file goes on GitHub, where anyone can read it.)
4. Click **Project Settings** (gear icon) > **API**. Keep this page open. You need two things from it:
   the **Project URL** and the **anon public** key (or the **Publishable key**).

### Step 2: Add your keys
Open `config.js` in a text editor and replace:
- `https://YOUR-PROJECT.supabase.co` with your Project URL
- `YOUR-ANON-KEY` with your anon / publishable key

Save. (These two are meant to be public. Never put the `service_role` or `secret` key here.)

### Step 3: Put it on GitHub
1. On **github.com** click **New repository**. Name it e.g. `sawaal`, set it to **Public**, click **Create repository**.
2. Click **uploading an existing file**.
3. Open the unzipped `sawaal` folder, select **everything inside it**, and drag it onto the page.
   (`index.html` must sit at the top of the repo, not inside another folder.)
4. Click **Commit changes**.

### Step 4: Turn the website on
In the repo: **Settings > Pages**. Under "Build and deployment" choose **Deploy from a branch**,
branch **main**, folder **/ (root)**, **Save**. Wait 1 to 2 minutes.

Your links are now:

| What | Link |
|---|---|
| Home page (all courses) | `https://YOUR-GITHUB-NAME.github.io/sawaal/` |
| Sawaal Better | `https://YOUR-GITHUB-NAME.github.io/sawaal/courses/sawaal-better.html` |
| Your dashboard | `https://YOUR-GITHUB-NAME.github.io/sawaal/dashboard.html` |

### Step 5: Try it
1. Open the course link on your phone. Choose **First time here**, type a school name, pick a class,
   make up a secret key. Answer a few screens.
2. Open the same link on your laptop. Choose **I've been here before**, same school, class and key.
   You should land on the same screen with your answers filled in.
3. Open the dashboard, type your password. Your test student is there.

Done. Share course links with students however you like (WhatsApp, a QR code, the board).

---

## Adding a new course

1. Send me the course content. I'll give you back one file, e.g. `ai-and-images.html`, plus a few lines for `courses.js`.
2. On GitHub, open the `courses` folder > **Add file > Upload files** > drop the file in > **Commit**.
3. Open `courses.js` on GitHub (click it, then the pencil icon), paste in the lines, **Commit**.
4. Wait a minute. The course is live at `.../courses/ai-and-images.html` and shows up on the home page and in the dashboard.

Rules that keep things working:
- The course's file name is its id. Lower-case letters, numbers and dashes only. Don't rename it once students have used it.
- Once students have used a course, fixing wording is fine, but don't remove or reorder screens.
  If you need a big change, make it a new file (e.g. `ai-and-images-2.html`).
- To test a course before telling anyone, add `hidden: true` to its entry in `courses.js`.
  It stays off the home page but the link works.

---

## How it works (for when something looks odd)

- **A student is** school name + class + secret key. School names are matched ignoring capitals,
  spaces and punctuation, so "St. Mary's School" and "st marys school" are the same school.
  Very different spellings ("DPS" vs "Delhi Public School") become separate schools.
  The sign-in form suggests school names already used, which prevents most of this.
- **Two students can't share a key** in the same school and class. The second one is asked to pick another.
- **Forgot their key?** Find them in the dashboard (Students tab, filter by school and class) and tell them.
- **Offline?** Answers keep saving on the phone and upload when the internet is back.
- **Names are optional.** Students can add their name the first time they sign in, or leave it blank.
  If they give one, it shows next to their secret key in the dashboard and downloads.
- **The dashboard password** is stored in the database, not on the website. Anyone with the password
  can see all answers, so share it carefully. The dashboard remembers it on that computer until you click **Lock**.

---

## Handy SQL (Supabase > SQL Editor)

**Change the dashboard password:**
```sql
update settings set value = 'new-password-here' where key = 'dashboard_password';
```

**Already ran an older setup.sql?** Just run the new one again. It adds the name column and keeps all data.

**Delete test students** (and all their answers):
```sql
delete from students where school_key = 'test school';
```
(`school_key` is the school name in lower case without punctuation.)

**Merge two spellings of the same school:**
```sql
update students set school = 'Delhi Public School, Noida', school_key = 'delhi public school noida'
where school_key = 'dps noida';
```
If a student has the same class and key in both spellings, this will stop with an error; delete one of them first.

---

## Good to know

- **Free limits.** Supabase's free database holds roughly 20,000 completed courses.
  If the dashboard gets slow with many thousands of students, tell me and I'll add paging.
- **Sleeping database.** Free Supabase projects pause after 7 days with nobody using them
  (for example in school holidays). If a course says it can't save, open Supabase and click **Restore project**.
  Students' answers wait on their phones and upload once it's back.
- **If a course won't save**, open it on a laptop, press F12 and look at the Console tab for red errors.
  The usual cause is a typo in `config.js`.
