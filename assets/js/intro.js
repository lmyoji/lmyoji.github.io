(function () {
  var KEY = "lmyoji-canvas-intro";
  var ROLES = [
    { name: "画板", color: "#0c8ce9" },
    { name: "网格", color: "#10b981" },
    { name: "卡片", color: "#8b5cf6" },
    { name: "标题", color: "#f59e0b" },
    { name: "正文", color: "#f43f5e" },
    { name: "链接", color: "#06b6d4" },
    { name: "标签", color: "#a855f7" },
    { name: "留白", color: "#14b8a6" }
  ];

  var runId = 0;
  var speed = 1;
  var stage = null;
  var hud = null;
  var agents = [];
  var statusEl = null;
  var barEl = null;
  var doneCount = 0;
  var totalCount = 1;

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isHome() {
    return /\/$/.test(location.pathname) || /index\.html$/.test(location.pathname);
  }

  function alive(id) {
    return runId === id;
  }

  function ease(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function sleep(ms, id) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(alive(id));
      }, ms / speed);
    });
  }

  function pointer(color) {
    return '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5 12.2 20l2.2-6.2L20.5 11 5 3.5Z" fill="' + color + '" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }

  function cross(color) {
    return '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M12 3v18M3 12h18" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round"/></svg>';
  }

  function beam(color) {
    return '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8M8 20h8M12 4v20" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M8 4h8M8 20h8M12 4v20" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round"/></svg>';
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function setProgress() {
    if (!barEl) return;
    barEl.style.width = Math.round((doneCount / totalCount) * 100) + "%";
  }

  function markDone() {
    doneCount += 1;
    setProgress();
  }

  function move(agent, x, y, ms, onFrame, id) {
    return new Promise(function (resolve) {
      var sx = agent.x;
      var sy = agent.y;
      var dx = x - sx;
      var dy = y - sy;
      var cx = sx + dx * 0.46 - dy * 0.16;
      var cy = sy + dy * 0.46 + dx * 0.16;
      var start = performance.now();
      var dur = Math.max(1, ms / speed);
      function frame(now) {
        if (!alive(id)) return resolve(false);
        var t = Math.min(1, (now - start) / dur);
        var e = ease(t);
        var u = 1 - e;
        var px = u * u * sx + 2 * u * e * cx + e * e * x;
        var py = u * u * sy + 2 * u * e * cy + e * e * y;
        agent.x = px;
        agent.y = py;
        agent.el.style.transform = "translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0)";
        if (onFrame) onFrame(e, t);
        if (t < 1) requestAnimationFrame(frame);
        else resolve(true);
      }
      requestAnimationFrame(frame);
    });
  }

  function tool(agent, kind) {
    var draw = kind === "cross" ? cross : kind === "beam" ? beam : pointer;
    agent.icon.innerHTML = draw(agent.color);
  }

  function frameAt(color) {
    var node = document.createElement("div");
    node.className = "canvas-frame";
    node.style.setProperty("--ink", color);
    node.innerHTML = "<i></i><i></i><i></i><i></i><span class='frame-size'>0 × 0</span>";
    stage.appendChild(node);
    return node;
  }

  function placeFrame(node, rect, scale) {
    var w = Math.max(8, rect.width * scale);
    var h = Math.max(8, rect.height * scale);
    node.style.left = Math.round(rect.left) + "px";
    node.style.top = Math.round(rect.top) + "px";
    node.style.width = Math.round(w) + "px";
    node.style.height = Math.round(h) + "px";
    node.querySelector(".frame-size").textContent = Math.round(w) + " × " + Math.round(h);
  }

  function reveal(el) {
    el.classList.remove("is-hidden");
  }

  async function drawBox(agent, el, id) {
    tool(agent, "cross");
    setStatus(agent.name + " 在拉 " + (el.dataset.label || "区块"));
    var start = el.getBoundingClientRect();
    if (!(await move(agent, start.left, start.top, 260, null, id))) return;
    if (!alive(id)) return;
    reveal(el);
    el.style.opacity = "0";
    var box = frameAt(agent.color);
    var end = el.getBoundingClientRect();
    if (!(await move(agent, end.right, end.bottom, 420, function (e) {
      var rect = el.getBoundingClientRect();
      placeFrame(box, rect, e);
      var rest = ((1 - e) * 100).toFixed(1);
      el.style.clipPath = "inset(0 " + rest + "% " + rest + "% 0)";
      el.style.opacity = String(Math.min(1, e * 1.15));
    }, id))) return;
    el.style.clipPath = "";
    el.style.opacity = "";
    box.style.opacity = "0";
    setTimeout(function () { box.remove(); }, 220);
    tool(agent, "pointer");
    markDone();
  }

  async function typeText(agent, el, id) {
    tool(agent, "beam");
    setStatus(agent.name + " 在写 " + (el.dataset.label || "文字"));
    var rect = el.getBoundingClientRect();
    if (!(await move(agent, rect.left + 6, rect.top + rect.height * 0.55, 240, null, id))) return;
    if (!alive(id)) return;
    reveal(el);
    el.classList.add("is-highlight");
    var text = el.dataset.orig || "";
    var width = Math.max(rect.width, 36);
    if (!(await move(agent, rect.left + Math.min(width, 28 + text.length * 14), rect.top + rect.height * 0.55, Math.min(900, 280 + text.length * 28), function (_e, raw) {
      el.textContent = text.slice(0, Math.max(1, Math.round(text.length * raw)));
    }, id))) return;
    el.textContent = text;
    el.style.minWidth = "";
    el.style.minHeight = "";
    setTimeout(function () { el.classList.remove("is-highlight"); }, 220);
    tool(agent, "pointer");
    markDone();
  }

  async function dropIn(agent, el, id) {
    tool(agent, "pointer");
    var rect = el.getBoundingClientRect();
    if (!(await move(agent, rect.left + rect.width * 0.35, rect.top + rect.height * 0.45, 220, null, id))) return;
    if (!alive(id)) return;
    reveal(el);
    markDone();
  }

  function hideTargets() {
    document.querySelectorAll("[data-build]").forEach(function (el) {
      if (el.dataset.build === "type") {
        var current = (el.textContent || "").trim();
        if (!el.dataset.orig || current.length >= el.dataset.orig.length) {
          el.dataset.orig = current || el.dataset.orig || "";
        }
        var rect = el.getBoundingClientRect();
        if (rect.width > 4) el.style.minWidth = Math.ceil(rect.width) + "px";
        if (rect.height > 4) el.style.minHeight = Math.ceil(rect.height) + "px";
        el.textContent = "";
      }
      el.classList.add("is-hidden");
    });
  }

  function showAll() {
    document.querySelectorAll("[data-build]").forEach(function (el) {
      if (el.dataset.orig) {
        el.textContent = el.dataset.orig;
        el.style.minWidth = "";
        el.style.minHeight = "";
      }
      el.style.clipPath = "";
      el.style.opacity = "";
      el.classList.remove("is-hidden", "is-highlight");
    });
  }

  function cleanup(id) {
    if (stage) stage.remove();
    if (hud) hud.remove();
    stage = null;
    hud = null;
    agents = [];
    document.documentElement.classList.remove("intro-preparing", "intro-running");
    document.documentElement.style.overflow = "";
    if (id && runId === id) runId += 1;
  }

  function buildChrome(id) {
    stage = document.createElement("div");
    stage.className = "canvas-stage";
    stage.innerHTML = ''
      + '<div class="canvas-backdrop"></div>'
      + '<div class="canvas-badge">L</div>'
      + '<div class="guide guide-v"></div>'
      + '<div class="guide guide-h"></div>'
      + '<div class="guide guide-h"></div>';
    document.body.appendChild(stage);

    hud = document.createElement("div");
    hud.className = "canvas-hud";
    hud.innerHTML = ''
      + '<div class="hud-dots"><span style="background:#38bdf8"></span><span style="background:#34d399"></span><span style="background:#fbbf24"></span><span style="background:#f43f5e"></span><span style="background:#a855f7"></span></div>'
      + '<div class="hud-status">打开画布</div>'
      + '<div class="hud-bar"><b></b></div>'
      + '<button class="hud-btn" type="button" data-speed>1x</button>'
      + '<button class="hud-btn" type="button" data-skip>跳过</button>';
    document.body.appendChild(hud);
    statusEl = hud.querySelector(".hud-status");
    barEl = hud.querySelector(".hud-bar b");
    hud.querySelector("[data-speed]").addEventListener("click", function (event) {
      speed = speed === 1 ? 2 : 1;
      event.currentTarget.textContent = speed + "x";
    });
    hud.querySelector("[data-skip]").addEventListener("click", function () { finish(id, true); });
    requestAnimationFrame(function () { hud.classList.add("is-on"); });
  }

  function makeAgents() {
    var cx = window.innerWidth * 0.5;
    var cy = window.innerHeight * 0.46;
    var reach = Math.max(window.innerWidth, window.innerHeight) * 0.48;
    agents = ROLES.map(function (role, index) {
      var angle = (index / ROLES.length) * Math.PI * 2 - Math.PI / 2;
      var el = document.createElement("div");
      el.className = "canvas-cursor";
      el.innerHTML = '<div class="cursor-icon"></div><div class="cursor-tag"></div>';
      el.querySelector(".cursor-tag").textContent = role.name;
      el.querySelector(".cursor-tag").style.background = role.color;
      stage.appendChild(el);
      var agent = {
        name: role.name,
        color: role.color,
        el: el,
        icon: el.querySelector(".cursor-icon"),
        x: cx + Math.cos(angle) * reach,
        y: cy + Math.sin(angle) * reach
      };
      tool(agent, "pointer");
      el.style.transform = "translate3d(" + agent.x + "px," + agent.y + "px,0)";
      return agent;
    });
  }

  function guides() {
    var grid = document.getElementById("bentoGrid");
    var nav = document.querySelector(".navbar");
    if (!grid || !stage) return;
    var rect = grid.getBoundingClientRect();
    var lines = stage.querySelectorAll(".guide");
    lines[0].style.left = Math.round(rect.left) + "px";
    lines[1].style.top = Math.round(nav ? nav.getBoundingClientRect().bottom : 56) + "px";
    lines[2].style.top = Math.round(rect.bottom) + "px";
    lines.forEach(function (line) { line.classList.add("on"); });
  }

  async function pool(tasks, worker, id, roster) {
    var queue = tasks.slice();
    var hands = roster || agents;
    var count = Math.min(hands.length, queue.length);
    var jobs = [];
    for (var i = 0; i < count; i += 1) {
      jobs.push(worker(hands[i], queue));
    }
    await Promise.all(jobs);
    return alive(id);
  }

  async function play(id) {
    document.documentElement.classList.add("intro-running");
    document.documentElement.style.overflow = "hidden";
    hideTargets();
    document.documentElement.classList.remove("intro-preparing");
    buildChrome(id);
    makeAgents();
    var badge = stage.querySelector(".canvas-badge");
    requestAnimationFrame(function () { badge.classList.add("is-on"); });
    setStatus("光标就位");

    var cx = window.innerWidth * 0.5;
    var cy = window.innerHeight * 0.46;
    await Promise.all(agents.map(function (agent, index) {
      var angle = (index / agents.length) * Math.PI * 2;
      var orbit = 78 + (index % 3) * 18;
      return move(agent, cx + Math.cos(angle) * orbit, cy + Math.sin(angle) * orbit, 680, null, id);
    }));
    if (!alive(id)) return;
    await sleep(180, id);
    badge.classList.add("is-off");
    stage.querySelector(".canvas-backdrop").classList.add("is-gone");
    guides();

    var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-build]"));
    var view = window.innerHeight - 8;
    function visible(el) {
      var rect = el.getBoundingClientRect();
      return rect.width > 4 && rect.height > 4 && rect.top < view && rect.bottom > 0;
    }
    var boxes = nodes.filter(function (el) { return el.dataset.build === "box" && visible(el); });
    var typed = nodes.filter(function (el) { return el.dataset.build === "type" && visible(el); });
    var placed = nodes.filter(function (el) { return el.dataset.build === "place" && visible(el); });
    totalCount = Math.max(1, boxes.length + typed.length + placed.length);
    doneCount = 0;
    setProgress();

    var grid = document.getElementById("bentoGrid");
    var board = frameAt("#0c8ce9");
    var boardTask = (async function () {
      var lead = agents[0];
      var rect = grid.getBoundingClientRect();
      tool(lead, "cross");
      setStatus("拉开整页画板");
      if (!(await move(lead, rect.left, rect.top, 240, null, id))) return;
      if (!(await move(lead, rect.right, rect.bottom, 460, function (e) {
        placeFrame(board, grid.getBoundingClientRect(), e);
      }, id))) return;
      board.style.background = "transparent";
      tool(lead, "pointer");
    })();

    await Promise.all([
      boardTask,
      pool(boxes, async function (agent, queue) {
        while (queue.length && alive(id)) {
          var el = queue.shift();
          await drawBox(agent, el, id);
        }
      }, id, agents.slice(1))
    ]);
    if (!alive(id)) return;
    board.style.opacity = "0";
    setTimeout(function () { board.remove(); }, 240);

    await pool(typed, async function (agent, queue) {
      while (queue.length && alive(id)) await typeText(agent, queue.shift(), id);
    }, id);
    if (!alive(id)) return;

    setStatus("把组件放进去");
    await pool(placed, async function (agent, queue) {
      while (queue.length && alive(id)) await dropIn(agent, queue.shift(), id);
    }, id);
    if (!alive(id)) return;

    setStatus("好了");
    await sleep(280, id);
    finish(id, false);
  }

  function finish(id) {
    if (!alive(id)) return;
    showAll();
    try { localStorage.setItem(KEY, "1"); } catch (err) {}
    cleanup(id);
  }

  function start(force) {
    if (!document.getElementById("bentoGrid")) return;
    var params = new URLSearchParams(location.search);
    var fromQuery = params.get("intro") === "1";
    if (fromQuery && history.replaceState) {
      params.delete("intro");
      var query = params.toString();
      history.replaceState({}, "", location.pathname + (query ? "?" + query : "") + location.hash);
    }
    var seen = false;
    try { seen = localStorage.getItem(KEY) === "1"; } catch (err) {}
    if (!force && !fromQuery && (seen || reduceMotion() || !isHome())) {
      document.documentElement.classList.remove("intro-preparing");
      return;
    }
    runId += 1;
    var id = runId;
    speed = 1;
    if (stage || hud) cleanup(id - 1);
    runId = id;
    document.addEventListener("keydown", function onKey(event) {
      if (event.key === "Escape" && alive(id)) {
        finish(id, true);
        document.removeEventListener("keydown", onKey);
      }
    });
    play(id).catch(function () { finish(id); });
  }

  var replay = document.getElementById("replayBtn");
  if (replay) {
    replay.addEventListener("click", function () {
      document.documentElement.classList.add("intro-preparing");
      window.scrollTo(0, 0);
      start(true);
    });
  }

  start(false);
})();
