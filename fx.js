/* =====================================================================
   fx.js: shared animations for courses. Pair with fx.css.

   Include from a course (after sawaal.js):
     <link rel="stylesheet" href="../fx.css">
     <script src="../fx.js"></script>

   What it gives a course:
     FX.reply(box, text)       an AI reply that shows "typing…" then types itself out
     FX.show(box, text)        the same reply, shown at once (for restoring saved work)
     FX.type(el, text)         plain typewriter
     FX.confetti()             a short burst of confetti
     FX.played(slide)          call when a slide is shown: plays chats ([data-replay])
                               and badge unlocks (.badge) on that slide, once each
     FX.guesser(el)            a "guess the next word" demo (see the course for the markup)
     .flip cards               tap to turn over, no code needed
     FX.instant = true         skip all animation (used while putting saved answers back)

   Nothing here talks to the database, so a broken animation never loses an answer.
   ===================================================================== */
(function () {
  "use strict";
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var FX = { instant: false, reduce: reduce };
  function quick() { return FX.instant || reduce; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, quick() ? 0 : ms); }); }
  FX.sleep = sleep;

  /* ---------- typewriter ---------- */
  FX.type = function (el, text, opts) {
    opts = opts || {};
    text = String(text == null ? "" : text);
    if (quick()) { el.textContent = text; el.classList.remove("typing"); return Promise.resolve(); }
    el.textContent = ""; el.classList.add("typing");
    var speed = opts.speed || 16, step = text.length > 420 ? 4 : text.length > 220 ? 3 : 2, i = 0;
    return new Promise(function (resolve) {
      (function tick() {
        i = Math.min(text.length, i + step);
        el.textContent = text.slice(0, i);
        if (i < text.length) setTimeout(tick, speed);
        else { el.classList.remove("typing"); resolve(); }
      })();
    });
  };

  /* ---------- AI reply bubble ---------- */
  FX.reply = function (box, text, opts) {
    opts = opts || {};
    box.hidden = false;
    box.classList.add("ai-say");
    box.innerHTML = '<div class="ai-head"><span class="ai-av">AI</span><span class="ai-who"></span><span class="ai-dots"><i></i><i></i><i></i></span></div><div class="ai-text"></div>';
    box.querySelector(".ai-who").textContent = opts.label || "AI CHATBOT";
    var dots = box.querySelector(".ai-dots"), t = box.querySelector(".ai-text");
    return sleep(opts.think || 750).then(function () {
      dots.remove();
      return FX.type(t, text, opts);
    }).then(function () {
      if (!quick() && box.scrollIntoView) {
        var r = box.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 70) box.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  };

  /* same bubble, shown at once with no typing (used when putting saved answers back) */
  FX.show = function (box, text, opts) {
    opts = opts || {};
    box.hidden = false;
    box.classList.add("ai-say");
    box.innerHTML = '<div class="ai-head"><span class="ai-av">AI</span><span class="ai-who"></span></div><div class="ai-text"></div>';
    box.querySelector(".ai-who").textContent = opts.label || "AI CHATBOT";
    box.querySelector(".ai-text").textContent = String(text == null ? "" : text);
  };

  /* ---------- confetti ---------- */
  FX.confetti = function (opts) {
    if (quick()) return;
    opts = opts || {};
    var c = document.createElement("canvas"); c.className = "fx-confetti";
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    document.body.appendChild(c);
    var ctx = c.getContext("2d"); ctx.scale(dpr, dpr);
    var colors = ["#FFB703", "#E23A2E", "#0F7B6C", "#2743C4", "#7B5CFA", "#F08C2E"];
    var ox = opts.x != null ? opts.x : innerWidth / 2, oy = opts.y != null ? opts.y : innerHeight * 0.35;
    var parts = [];
    for (var i = 0; i < (opts.count || 110); i++) {
      var a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 7;
      parts.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 5, r: 3 + Math.random() * 4,
        c: colors[i % colors.length], rot: Math.random() * 6, vr: (Math.random() - .5) * .4, sq: Math.random() < .5 });
    }
    var t0 = performance.now();
    (function frame(now) {
      var t = now - t0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(function (p) {
        p.vy += 0.25; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t / 1600); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
        if (p.sq) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); else { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.3, 0, 7); ctx.fill(); }
        ctx.restore();
      });
      if (t < 1600) requestAnimationFrame(frame); else c.remove();
    })(t0);
  };

  /* ---------- chats that play one message at a time ---------- */
  function replay(chat) {
    if (chat.dataset.played) return;
    chat.dataset.played = "1";
    var bubs = Array.prototype.slice.call(chat.querySelectorAll(".bub"));
    if (quick()) return;
    bubs.forEach(function (b) { b.classList.add("fx-wait"); });
    var gap = +(chat.dataset.gap || 900);
    bubs.reduce(function (p, b) {
      return p.then(function () { return sleep(gap); }).then(function () {
        b.classList.remove("fx-wait"); b.classList.add("fx-in");
      });
    }, sleep(200));
  }
  /* ---------- run the animations that belong to a slide, the first time it's shown ---------- */
  FX.played = function (slide) {
    if (!slide) return;
    Array.prototype.forEach.call(slide.querySelectorAll("[data-replay]"), replay);
    Array.prototype.forEach.call(slide.querySelectorAll(".badge"), function (b) {
      if (b.dataset.popped) return;
      b.dataset.popped = "1";
      if (quick()) return;
      b.classList.add("fx-pop");
      setTimeout(function () {
        var m = b.querySelector(".medal"), r = m ? m.getBoundingClientRect() : null;
        FX.confetti(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, count: 90 } : {});
      }, 350);
    });
  };

  /* ---------- guess the next word ----------
     <div class="guesser"><script type="application/json">[{ "prompt": "Chai tastes best with",
        "options": [["biscuits", 48], ["friends", 22]], "pick": 0, "wrong": false, "note": "..." }]</script></div> */
  FX.guesser = function (el) {
    var rounds; try { rounds = JSON.parse(el.querySelector("script").textContent); } catch (e) { return; }
    var i = 0;
    el.insertAdjacentHTML("beforeend", '<div class="gq"></div><div class="gbars"></div><div class="gout"></div><div class="gbtns"></div>');
    var gq = el.querySelector(".gq"), bars = el.querySelector(".gbars"), out = el.querySelector(".gout"), btns = el.querySelector(".gbtns");
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function setup() {
      var r = rounds[i];
      el.classList.remove("shown");
      gq.innerHTML = esc(r.prompt) + ' <span class="blank">?</span>';
      bars.innerHTML = r.options.map(function (o) {
        return '<div class="gb"><span>' + esc(o[0]) + '</span><span class="t"><i></i></span><b>' + o[1] + '%</b></div>';
      }).join("");
      out.innerHTML = "";
      btns.innerHTML = '<button type="button" class="ask-btn"><span class="spark">✨</span> Let the AI guess</button>';
      btns.firstChild.onclick = go;
    }
    function go() {
      var r = rounds[i]; btns.innerHTML = "";
      el.classList.add("shown");
      var rows = bars.querySelectorAll(".gb");
      Array.prototype.forEach.call(rows, function (row, k) {
        setTimeout(function () { row.querySelector("i").style.width = r.options[k][1] + "%"; }, quick() ? 0 : k * 160);
      });
      sleep(1100 + rows.length * 160).then(function () {
        rows[r.pick].classList.add("pick");
        var blank = gq.querySelector(".blank");
        return FX.type(blank, r.options[r.pick][0]).then(function () {
          if (r.wrong) { blank.classList.add("wrong"); blank.classList.add("fx-shake"); }
          var n = document.createElement("p"); n.className = "gnote"; n.innerHTML = r.note; out.appendChild(n);
          if (i < rounds.length - 1) {
            btns.innerHTML = '<button type="button" class="ask-btn">Try another sentence ➜</button>';
            btns.firstChild.onclick = function () { i++; setup(); };
          }
          el.dataset.done = "1";
          el.dispatchEvent(new CustomEvent("fx:guessed", { bubbles: true, detail: { round: i } }));
        });
      });
    }
    setup();
  };

  /* ---------- flip cards: tap to turn over ---------- */
  document.addEventListener("click", function (e) {
    var f = e.target.closest(".flip"); if (!f) return;
    f.classList.toggle("flipped");
    f.setAttribute("aria-pressed", f.classList.contains("flipped") ? "true" : "false");
  });

  window.FX = FX;
})();
