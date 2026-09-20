/* =====================================================================
   sawaal.js: the shared code every course uses. You don't edit this.

   A course includes it like this (from inside the courses folder):
     <script src="../config.js"></script>
     <script src="../sawaal.js"></script>

   and then, in its own script:
     Sawaal.start().then(function (state) {
       // state.answers   { itemId: {mod, q, a, correct, t} }  put these back on screen
       // state.screen    the screen number to open on
       // state.completed true if they've finished before
       // state.student   {school, class, code} or null
       // state.mode      "online" | "offline" | "local"
     });
     Sawaal.record(itemId, section, question, answer, correct);  // every answer
     Sawaal.setScreen(n);                                        // every screen change
     Sawaal.complete();                                          // on the last screen

   The course id is the file name: courses/sawaal-better.html -> "sawaal-better".
   If the student isn't signed in, a sign-in box appears on top of the course.
   Answers save to the device first, then upload in the background, so
   nothing is lost if the internet drops.
   ===================================================================== */
(function () {
  "use strict";

  var script = document.currentScript;
  var CFG = window.SAWAAL_CONFIG || {};
  var ROOT = (function () { try { return new URL(".", script.src).href; } catch (e) { return "./"; } })();
  var COURSE = (script && script.getAttribute("data-course")) ||
    decodeURIComponent(location.pathname.split("/").pop() || "").replace(/\.html?$/i, "").toLowerCase();
  var SESSION_KEY = "sawaal.me";

  /* ---------------- storage ---------------- */
  var mem = {};
  function readJSON(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return mem[k] || null; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { mem[k] = v; } }
  function removeKey(k) { try { localStorage.removeItem(k); } catch (e) {} delete mem[k]; }
  function getSession() { return readJSON(SESSION_KEY); }
  function setSession(s) { writeJSON(SESSION_KEY, s); }
  function clearSession() { removeKey(SESSION_KEY); }

  /* ---------------- talking to the database ---------------- */
  function configured() {
    return !!(CFG.supabaseUrl && CFG.supabaseKey && !/YOUR-/.test(CFG.supabaseUrl + CFG.supabaseKey) && location.protocol !== "file:");
  }
  function rpc(fn, args, opts) {
    var headers = { "apikey": CFG.supabaseKey, "Content-Type": "application/json" };
    if (/^eyJ/.test(CFG.supabaseKey)) headers.Authorization = "Bearer " + CFG.supabaseKey; // older "anon" keys
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, (opts && opts.timeout) || 15000) : null;
    return fetch(CFG.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/rpc/" + fn, {
      method: "POST", headers: headers, body: JSON.stringify(args || {}),
      keepalive: !!(opts && opts.keepalive), signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.text().then(function (t) {
        var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
        if (!r.ok) { var err = new Error((d && d.message) || ("HTTP " + r.status)); err.code = err.message; err.status = r.status; throw err; }
        return d;
      });
    }, function () {
      if (timer) clearTimeout(timer);
      var err = new Error("offline"); err.code = "offline"; err.offline = true; throw err;
    });
  }

  var MESSAGES = {
    offline: "Can't reach the internet right now. Check the connection and try again.",
    school_invalid: "Type your school's name.",
    class_invalid: "Pick your class.",
    key_invalid: "Your secret key should be 3 to 20 letters or numbers, with no spaces or symbols.",
    key_taken: "Someone in your class at this school already uses that secret key. Make up a different one. If it's really yours, choose \"I've been here before\".",
    key_not_found: "We couldn't find that secret key. Check your school name and class are the same as last time. First time here? Choose \"First time here\".",
    bad_session: "You've been signed out. Please sign in again.",
    too_many_rows: "Something went wrong saving. Your answers are safe on this device.",
    payload_too_large: "One of your answers is too long to save. Try shortening it.",
    wrong_password: "That password isn't right.",
    password_not_set: "The dashboard password hasn't been set yet. Set it in Supabase's SQL Editor (README, setup step 1).",
    "Invalid API key": "The key in config.js isn't right. Copy it again from Supabase.",
    "Could not find the function": "The database isn't set up yet. Run setup.sql in Supabase (see the README)."
  };
  function friendly(err) {
    var code = (err && (err.code || err.message)) || "";
    for (var k in MESSAGES) if (code.indexOf(k) !== -1) return MESSAGES[k];
    return "Something went wrong (" + code + "). Try again in a moment.";
  }

  /* ---------------- styles for the sign-in box and account panel ---------------- */
  var styled = false;
  function addStyle() {
    if (styled) return; styled = true;
    var s = document.createElement("style");
    s.textContent =
      ".sw-overlay{position:fixed;inset:0;z-index:9999;background:rgba(18,22,30,.78);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 14px}" +
      ".sw-card{background:#FFFDF7;color:#171412;border-radius:14px;width:100%;max-width:430px;padding:24px 22px;margin:auto 0;font:16px/1.5 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.3)}" +
      ".sw-card h2{font:800 24px/1.2 'Bricolage Grotesque','Trebuchet MS',sans-serif;margin:0 0 6px}" +
      ".sw-card .sw-lead{margin:0 0 16px;color:#5C554B;font-size:15px}" +
      ".sw-tabs{display:flex;background:#F0EBE0;border-radius:10px;padding:4px;margin:0 0 6px}" +
      ".sw-tabs button{flex:1;border:0;background:none;padding:9px 6px;border-radius:7px;font-weight:600;font-size:14px;font-family:inherit;color:#5C554B;cursor:pointer}" +
      ".sw-tabs button.on{background:#fff;color:#171412;box-shadow:0 1px 3px rgba(0,0,0,.12)}" +
      ".sw-card label{display:block;font-weight:700;font-size:14px;margin:14px 0 5px}" +
      ".sw-card input,.sw-card select{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:11px 12px;border:1.5px solid #D9D1C2;border-radius:9px;background:#fff;color:#171412}" +
      ".sw-card input:focus,.sw-card select:focus{outline:3px solid #FFB703;outline-offset:1px;border-color:#171412}" +
      ".sw-opt{font-weight:500;color:#6B6357}" +
      ".sw-hint{font-size:13.5px;color:#6B6357;margin:6px 0 0}" +
      ".sw-err{background:#FDECEA;color:#9B1C14;border-radius:8px;padding:10px 12px;font-size:14px;margin:14px 0 0}" +
      ".sw-go{display:block;width:100%;margin:18px 0 0;background:#FFB703;color:#231B08;border:0;border-radius:10px;padding:13px;font-weight:700;font-size:16px;font-family:inherit;cursor:pointer}" +
      ".sw-go[disabled]{opacity:.6;cursor:wait}" +
      ".sw-key{font:800 34px/1.1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;background:#FFF4DC;border:2px dashed #E0A800;border-radius:10px;text-align:center;padding:14px;margin:12px 0}" +
      ".sw-hide{display:none!important}" +
      ".sw-acct{font:14px/1.45 Inter,system-ui,sans-serif;color:inherit}.sw-acct .who{font-weight:700}.sw-acct .sub{opacity:.78;font-size:13px}" +
      ".sw-acct .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}" +
      ".sw-acct .row a,.sw-acct .row button{font:600 13px Inter,system-ui,sans-serif;border:1px solid currentColor;background:transparent;color:inherit;border-radius:8px;padding:7px 11px;cursor:pointer;text-decoration:none}" +
      ".sw-acct .help{margin-top:12px;font-size:12.5px;opacity:.85}.sw-acct .help a{color:inherit;display:inline-block;margin-right:10px}" +
      ".sw-float{position:fixed;top:10px;right:10px;z-index:9000;background:#1B2430;color:#fff;border-radius:10px;padding:10px 12px;max-width:260px;box-shadow:0 4px 18px rgba(0,0,0,.2)}" +
      ".sw-float .row,.sw-float .help{display:none}.sw-float.open .row{display:flex}.sw-float.open .help{display:block}";
    document.head.appendChild(s);
  }
  function h(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------------- the sign-in form (used by courses and the home page) ---------------- */
  var schoolsPromise = null;
  function loadSchools() {
    if (!schoolsPromise) schoolsPromise = configured() ? rpc("sawaal_schools", {}, { timeout: 8000 }).catch(function () { return []; }) : Promise.resolve([]);
    return schoolsPromise;
  }

  // Renders the form into `host`. opts: {title, lead, onDone(session)}
  function signInForm(host, opts) {
    addStyle();
    opts = opts || {};
    var isNew = true;
    var classes = CFG.classes || ["6", "7", "8", "9", "10", "11", "12"];
    var card = h("div", { "class": "sw-card" });
    card.innerHTML =
      '<h2></h2><p class="sw-lead"></p>' +
      '<div class="sw-tabs" role="tablist"><button type="button" class="on" data-new="1">First time here</button><button type="button" data-new="0">I\'ve been here before</button></div>' +
      '<form novalidate>' +
      '<label for="sw-school">Your school</label>' +
      '<input id="sw-school" list="sw-schools" autocomplete="off" maxlength="100" placeholder="e.g. Delhi Public School, Noida">' +
      '<datalist id="sw-schools"></datalist>' +
      '<p class="sw-hint">Type the full name. If it shows up in the list, pick it.</p>' +
      '<label for="sw-class">Your class</label>' +
      '<select id="sw-class"><option value="">Pick your class</option>' +
      classes.map(function (c) { return '<option value="' + String(c).replace(/"/g, "&quot;") + '">Class ' + c + "</option>"; }).join("") +
      "</select>" +
      '<div data-for="new"><label for="sw-name">Your name <span class="sw-opt">(optional)</span></label>' +
      '<input id="sw-name" autocomplete="off" maxlength="60" placeholder="You can leave this blank"></div>' +
      '<label for="sw-key">Secret key</label>' +
      '<input id="sw-key" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="20">' +
      '<p class="sw-hint" data-for="new" data-hint>Make one up and remember it. Try: the first 2 letters of your favourite food + your lucky number + the first 2 letters of your city, like <b>bi7ka</b>. Don\'t use your name.</p>' +
      '<p class="sw-hint sw-hide" data-for="old">The secret key you made last time.</p>' +
      '<div class="sw-err sw-hide" role="alert"></div>' +
      '<button class="sw-go" type="submit">Start</button>' +
      "</form>" +
      "";
    card.querySelector("h2").textContent = opts.title || "Sign in to save your progress";
    card.querySelector(".sw-lead").textContent = opts.lead || "No email or password. Everything you answer saves as you go, so you can stop and carry on later, on any phone or computer.";
    host.appendChild(card);

    var $ = function (s) { return card.querySelector(s); };
    var err = $(".sw-err"), go = $(".sw-go");
    function showErr(m) { err.textContent = m || ""; err.classList.toggle("sw-hide", !m); }
    function setMode(n) {
      isNew = n;
      card.querySelectorAll(".sw-tabs button").forEach(function (b) { b.classList.toggle("on", (b.getAttribute("data-new") === "1") === n); });
      card.querySelectorAll('[data-for="new"]').forEach(function (el) { el.classList.toggle("sw-hide", !n); });
      $('[data-for="old"]').classList.toggle("sw-hide", n);
      go.textContent = n ? "Start" : "Carry on";
      showErr("");
    }
    card.querySelectorAll(".sw-tabs button").forEach(function (b) {
      b.addEventListener("click", function () { setMode(b.getAttribute("data-new") === "1"); });
    });

    // Remember school and class on this device to save typing for the next student.
    var last = readJSON("sawaal.last") || {};
    if (last.school) $("#sw-school").value = last.school;
    if (last.class) $("#sw-class").value = last.class;

    loadSchools().then(function (list) {
      var dl = $("#sw-schools");
      (list || []).forEach(function (n) { var o = document.createElement("option"); o.value = n; dl.appendChild(o); });
    });

    card.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = isNew ? $("#sw-name").value.trim() : "";
      var school = $("#sw-school").value.trim(), cls = $("#sw-class").value, key = $("#sw-key").value.replace(/\s+/g, "").toLowerCase();
      if (school.length < 2) return showErr(MESSAGES.school_invalid);
      if (!cls) return showErr(MESSAGES.class_invalid);
      if (!/^[a-z0-9]{3,20}$/.test(key)) return showErr(MESSAGES.key_invalid);
      showErr(""); go.disabled = true; go.textContent = "One moment…";
      rpc("sawaal_login", { p_school: school, p_class: cls, p_key: key, p_new: isNew, p_name: name || null }).then(function (res) {
        var session = { token: res.token, student: res.student };
        setSession(session);
        writeJSON("sawaal.last", { school: res.student.school, class: res.student.class });
        if (!isNew) return opts.onDone && opts.onDone(session);
        // New student: make sure they note down their key.
        card.innerHTML = '<h2>You\'re in</h2><p class="sw-lead">This is your secret key. Write it down or take a photo of it. You\'ll need it, with your school and class, to carry on from another phone or computer.</p>' +
          '<div class="sw-key"></div><p class="sw-hint" style="text-align:center"></p><button class="sw-go" type="button">I\'ve noted it. Let\'s go</button>';
        card.querySelector(".sw-key").textContent = res.student.code;
        card.querySelector(".sw-hint").textContent = (res.student.name ? res.student.name + " · " : "") + res.student.school + " · Class " + res.student.class;
        card.querySelector(".sw-go").addEventListener("click", function () { opts.onDone && opts.onDone(session); });
      }, function (e2) {
        go.disabled = false; go.textContent = isNew ? "Start" : "Carry on";
        showErr(friendly(e2));
      });
    });
    return card;
  }

  /* ---------------- course runtime ---------------- */
  var rt = { mode: null, student: null, data: null, status: "idle", failures: 0, timer: null, flushing: null, key: null };

  function blankData() { return { answers: {}, pending: {}, screen: 0, screenAt: null, screenPending: false, completePending: false, completed: false }; }
  function persist() { if (rt.data && rt.key) writeJSON(rt.key, rt.data); }

  var STATUS_TEXT = { idle: "", saving: "Saving…", saved: "All answers saved", offline: "Offline: answers kept on this device, will upload later", local: "Not saving (not signed in)", error: "Couldn't save just now, will retry" };
  function setStatus(s) {
    rt.status = s;
    var t = STATUS_TEXT[s] || "";
    var a = document.getElementById("sawaal-status"); if (a) { a.textContent = t; a.setAttribute("data-state", s); }
    var b = document.getElementById("sw-status-line"); if (b) b.textContent = t;
  }
  function schedule(ms) { clearTimeout(rt.timer); rt.timer = setTimeout(flush, ms == null ? 1200 : ms); }
  function hasWork() { var d = rt.data; return !!(d && (Object.keys(d.pending).length || d.screenPending || d.completePending)); }

  function flush(opts) {
    if (!rt.data || rt.mode === "local") return Promise.resolve();
    if (rt.flushing) return rt.flushing.then(function () { return hasWork() ? flush(opts) : null; });
    if (!hasWork()) return Promise.resolve();
    var s = getSession(); if (!s || !s.token) return Promise.resolve();
    var d = rt.data;
    var ids = Object.keys(d.pending).slice(0, 250), sent = {};
    ids.forEach(function (id) { sent[id] = d.pending[id]; });
    var rows = ids.map(function (id) {
      var a = d.answers[id] || {};
      return { item: id, section: a.mod || "", question: a.q || "", answer: a.a === undefined ? null : a.a,
               correct: a.correct == null ? "" : String(a.correct), answered_at: a.t };
    });
    var sentScreen = d.screenPending, sentAt = d.screenAt, sentComplete = d.completePending;
    setStatus("saving");
    rt.flushing = rpc("sawaal_save", {
      p_token: s.token, p_course: COURSE, p_rows: rows,
      p_screen: sentScreen ? d.screen : null, p_screen_at: sentScreen ? d.screenAt : null, p_complete: !!sentComplete
    }, { keepalive: !!(opts && opts.keepalive) }).then(function () {
      ids.forEach(function (id) { if (d.pending[id] === sent[id]) delete d.pending[id]; });
      if (sentScreen && d.screenAt === sentAt) d.screenPending = false;
      if (sentComplete) { d.completePending = false; d.completed = true; }
      persist();
      rt.failures = 0;
      if (rt.mode === "offline") { rt.mode = "online"; renderAccount(); }
      setStatus("saved");
      if (hasWork()) schedule(200);
    }, function (err) {
      rt.failures++;
      var wait = Math.min(60000, 4000 * Math.pow(2, Math.min(rt.failures, 4)));
      if (err.offline) {
        if (rt.mode === "online") { rt.mode = "offline"; renderAccount(); }
        setStatus("offline"); schedule(wait);
      } else if (/bad_session/.test(err.code)) {
        clearSession(); setStatus("offline");
        overlay(function (host) {
          signInForm(host, { title: "Please sign in again", lead: "Your answers are safe on this device. Sign in and they'll upload.", onDone: function () { location.reload(); } });
        });
      } else { setStatus("error"); schedule(wait); }
    }).then(function () { rt.flushing = null; });
    return rt.flushing;
  }

  function record(id, mod, q, a, correct) {
    if (!rt.data || !id) return;
    var t = new Date().toISOString();
    rt.data.answers[id] = { mod: mod || "", q: q || "", a: a, correct: correct == null ? "" : correct, t: t };
    if (rt.mode !== "local") rt.data.pending[id] = t;
    persist();
    if (rt.mode !== "local") schedule();
  }
  function setScreen(i) {
    if (!rt.data || typeof i !== "number") return;
    if (rt.data.screen === i && !rt.data.screenPending) return;
    rt.data.screen = i; rt.data.screenAt = new Date().toISOString();
    if (rt.mode !== "local") rt.data.screenPending = true;
    persist();
    if (rt.mode !== "local") schedule();
  }
  function complete() {
    if (!rt.data || rt.data.completed) return;
    if (rt.mode === "local") { rt.data.completed = true; persist(); return; }
    rt.data.completePending = true; persist(); flush();
  }

  // Combine what's on this device with what the server has. Newest wins.
  function merge(local, res) {
    var d = local || blankData();
    var onServer = {};
    (res.answers || []).forEach(function (a) {
      onServer[a.item] = true;
      var mine = d.answers[a.item];
      if (!mine || !d.pending[a.item] || new Date(a.answered_at) >= new Date(mine.t)) {
        d.answers[a.item] = { mod: a.section || "", q: a.question || "", a: a.answer, correct: a.correct == null ? "" : a.correct, t: a.answered_at };
        delete d.pending[a.item];
      }
    });
    Object.keys(d.answers).forEach(function (id) { if (!onServer[id] && !d.pending[id]) delete d.answers[id]; });
    var serverAt = res.screen_at ? new Date(res.screen_at) : null;
    if (!(d.screenPending && d.screenAt && (!serverAt || new Date(d.screenAt) > serverAt))) {
      d.screen = res.screen || 0; d.screenAt = res.screen_at || null; d.screenPending = false;
    }
    if (res.completed_at) { d.completed = true; d.completePending = false; }
    return d;
  }

  function snapshot() {
    var answers = {};
    Object.keys(rt.data.answers).forEach(function (k) { answers[k] = rt.data.answers[k]; });
    return { mode: rt.mode, answers: answers, screen: rt.data.screen || 0, completed: !!rt.data.completed, student: rt.student };
  }

  function overlay(fill) {
    addStyle();
    var o = h("div", { "class": "sw-overlay", role: "dialog", "aria-modal": "true" });
    document.body.appendChild(o);
    fill(o);
    return o;
  }

  var startPromise = null;
  function start() {
    if (startPromise) return startPromise;
    startPromise = new Promise(function (resolve) {
      var ready = function () { renderAccount(); if (hasWork()) schedule(500); resolve(snapshot()); };
      var goLocal = function () {
        rt.mode = "local"; rt.student = null;
        rt.key = "sawaal.c." + COURSE + ".local";
        rt.data = readJSON(rt.key) || blankData();
        setStatus("local"); ready();
      };
      var goOnline = function (s) {
        rt.student = s.student; rt.mode = "online";
        rt.key = "sawaal.c." + COURSE + "." + s.student.id;
        rpc("sawaal_open", { p_token: s.token, p_course: COURSE }, { timeout: 9000 }).then(function (res) {
          rt.data = merge(readJSON(rt.key), res); persist();
          setStatus(hasWork() ? "saving" : "saved"); ready();
        }, function (err) {
          if (err.offline || err.status >= 500) {
            rt.mode = "offline"; rt.data = readJSON(rt.key) || blankData(); setStatus("offline"); ready();
          } else if (/bad_session/.test(err.code)) {
            clearSession(); ask();
          } else {
            overlay(function (host) {
              var c = h("div", { "class": "sw-card" });
              c.appendChild(h("h2", null, "Can't open this course"));
              c.appendChild(h("p", { "class": "sw-lead" }, friendly(err)));
              host.appendChild(c);
            });
          }
        });
      };
      var ask = function () {
        var o = overlay(function (host) {
          signInForm(host, {
            onDone: function (s) { o.remove(); goOnline(s); }
          });
        });
      };
      if (!configured()) return goLocal();
      var s = getSession();
      if (s && s.token && s.student) goOnline(s); else ask();
    });
    return startPromise;
  }

  function switchStudent() {
    var done = function () { clearSession(); location.reload(); };
    if (hasWork()) flush().then(function () {
      if (hasWork()) alert("Some answers haven't reached the internet yet. They're kept on this device and will upload next time this student signs in here.");
      done();
    }); else done();
  }

  /* ---------------- the "who's signed in" panel ---------------- */
  function renderAccount() {
    addStyle();
    var host = document.getElementById("sawaal-account"), floating = false;
    if (!host) { host = h("div", { "class": "sw-float" }); floating = true; document.body.appendChild(host); }
    host.classList.add("sw-acct"); host.innerHTML = "";
    var st = rt.student;
    var who = h("div", { "class": "who" }, st ? (st.name ? st.name + " · " : "") + "Class " + st.class + " · " + st.code : "Not signed in");
    host.appendChild(who);
    host.appendChild(h("div", { "class": "sub" }, st ? st.school : (configured() ? "Your answers aren't being saved." : "Saving isn't set up yet (config.js).")));
    host.appendChild(h("div", { "class": "sub", id: "sw-status-line" }, STATUS_TEXT[rt.status] || ""));
    var row = h("div", { "class": "row" });
    row.appendChild(h("a", { href: ROOT + "index.html" }, "All courses"));
    if (st) {
      var sw = h("button", { type: "button" }, "Not you? Switch");
      sw.addEventListener("click", switchStudent); row.appendChild(sw);
    } else if (configured()) {
      var si = h("button", { type: "button" }, "Sign in to save");
      si.addEventListener("click", function () { location.reload(); }); row.appendChild(si);
    }
    host.appendChild(row);
    if (CFG.helpline && CFG.helpline.links) {
      var help = h("div", { "class": "help" });
      help.appendChild(h("div", null, CFG.helpline.text));
      CFG.helpline.links.forEach(function (l) { help.appendChild(h("a", { href: l.href }, l.label)); });
      host.appendChild(help);
    }
    if (floating) { who.style.cursor = "pointer"; who.addEventListener("click", function () { host.classList.toggle("open"); }); }
  }

  /* ---------------- save when the page is hidden or the internet comes back ---------------- */
  window.addEventListener("online", function () { if (rt.data) flush(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden" && hasWork()) flush({ keepalive: true }); });
  window.addEventListener("pagehide", function () { if (hasWork()) flush({ keepalive: true }); });

  window.Sawaal = {
    start: start, record: record, setScreen: setScreen, complete: complete, flush: flush, switchStudent: switchStudent,
    get mode() { return rt.mode; },
    get student() { return rt.student; },
    course: COURSE,
    // used by the home page and the dashboard
    api: { rpc: rpc, configured: configured, friendly: friendly, getSession: getSession, clearSession: clearSession, signInForm: signInForm, root: ROOT, config: CFG }
  };
})();
