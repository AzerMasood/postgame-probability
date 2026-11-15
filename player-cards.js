/* player-cards.js
 * Shows player cards for a team using the JSON written by scripts/update_data.py
 * (data/index.json and data/teams/<slug>.json).
 *
 * Usage (one script tag + one call):
 *   <script src="player-cards.js"></script>
 *   PlayerCards.show("Georgia", document.getElementById("cards-1"));
 *
 * Auto-wiring: if the page has at least two <select> elements whose options are
 * team names, the first is treated as Team 1 and the second as Team 2. A cards
 * container is created under each, and cards update whenever a team is chosen.
 * Skip auto-wiring with <script src="player-cards.js" data-auto="off">.
 */
(function () {
  "use strict";

  var DATA = "data/";
  var cache = {};
  var indexPromise = null;

  var css =
    ".pc-wrap{margin:16px 0;font-family:inherit}" +
    ".pc-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin-bottom:10px}" +
    ".pc-title{font-size:1.1rem;font-weight:700;margin:0}" +
    ".pc-sub{font-size:.8rem;opacity:.7}" +
    ".pc-filter{padding:4px 8px;border-radius:6px;font:inherit}" +
    ".pc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}" +
    ".pc-card{border:1px solid rgba(128,128,128,.35);border-top:4px solid var(--pc,#888);border-radius:8px;padding:10px;background:rgba(128,128,128,.07)}" +
    ".pc-top{display:flex;align-items:baseline;justify-content:space-between;gap:6px}" +
    ".pc-num{font-size:1.3rem;font-weight:800;color:var(--pc,#888)}" +
    ".pc-pos{font-size:.75rem;font-weight:700;padding:1px 6px;border-radius:10px;background:rgba(128,128,128,.2)}" +
    ".pc-name{font-weight:600;margin:4px 0 2px;line-height:1.2}" +
    ".pc-meta{font-size:.78rem;opacity:.75;line-height:1.35}" +
    ".pc-stats{margin-top:6px;padding-top:6px;border-top:1px dashed rgba(128,128,128,.4);font-size:.78rem;line-height:1.4}" +
    ".pc-msg{opacity:.7;padding:8px 0}";

  function injectCss() {
    if (document.getElementById("pc-style")) return;
    var s = document.createElement("style");
    s.id = "pc-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  // Must match slugify() in scripts/update_data.py
  function slugify(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function getJson(path) {
    if (!cache[path]) {
      cache[path] = fetch(path).then(function (r) {
        if (!r.ok) throw new Error(path + " " + r.status);
        return r.json();
      });
    }
    return cache[path];
  }

  function loadIndex() {
    if (!indexPromise) indexPromise = getJson(DATA + "index.json");
    return indexPromise;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Pick a few readable stats: the biggest numeric values, labelled "category stat".
  function topStats(stats, max) {
    var rows = [];
    Object.keys(stats || {}).forEach(function (cat) {
      Object.keys(stats[cat]).forEach(function (type) {
        var v = Number(stats[cat][type]);
        if (isFinite(v)) rows.push({ label: cat + " " + type, v: v });
      });
    });
    rows.sort(function (a, b) { return b.v - a.v; });
    return rows.slice(0, max);
  }

  function color(c) {
    if (!c) return "#888";
    return /^#?[0-9a-f]{3,8}$/i.test(c) ? (c[0] === "#" ? c : "#" + c) : "#888";
  }

  function renderCards(container, team) {
    container.textContent = "";
    var wrap = el("div", "pc-wrap");
    wrap.style.setProperty("--pc", color(team.color));

    var head = el("div", "pc-head");
    var left = el("div");
    left.appendChild(el("h3", "pc-title", team.team + (team.mascot ? " " + team.mascot : "")));
    var updated = team.updated ? new Date(team.updated).toLocaleDateString() : "";
    left.appendChild(el("div", "pc-sub", team.players.length + " players · " + team.season + " season" + (updated ? " · updated " + updated : "")));
    head.appendChild(left);

    var positions = {};
    team.players.forEach(function (p) { if (p.position) positions[p.position] = 1; });
    var filter = el("select", "pc-filter");
    filter.setAttribute("aria-label", "Filter by position");
    filter.appendChild(new Option("All positions", ""));
    Object.keys(positions).sort().forEach(function (pos) { filter.appendChild(new Option(pos, pos)); });
    head.appendChild(filter);
    wrap.appendChild(head);

    var grid = el("div", "pc-grid");
    wrap.appendChild(grid);

    function draw() {
      grid.textContent = "";
      var want = filter.value;
      var list = team.players.filter(function (p) { return !want || p.position === want; });
      if (!list.length) { grid.appendChild(el("div", "pc-msg", "No players to show.")); return; }
      list.forEach(function (p) {
        var card = el("div", "pc-card");
        var top = el("div", "pc-top");
        top.appendChild(el("span", "pc-num", p.jersey != null ? "#" + p.jersey : ""));
        if (p.position) top.appendChild(el("span", "pc-pos", p.position));
        card.appendChild(top);
        card.appendChild(el("div", "pc-name", p.name));
        var meta = [];
        if (p.year) meta.push("Class " + p.year);
        if (p.height) meta.push(Math.floor(p.height / 12) + "'" + (p.height % 12) + '"');
        if (p.weight) meta.push(p.weight + " lb");
        if (meta.length) card.appendChild(el("div", "pc-meta", meta.join(" · ")));
        if (p.hometown) card.appendChild(el("div", "pc-meta", p.hometown));
        var st = topStats(p.stats, 4);
        if (st.length) {
          var box = el("div", "pc-stats");
          st.forEach(function (s) { box.appendChild(el("div", null, s.label + ": " + s.v)); });
          card.appendChild(box);
        }
        grid.appendChild(card);
      });
    }
    filter.addEventListener("change", draw);
    draw();
    container.appendChild(wrap);
  }

  function show(teamName, container) {
    injectCss();
    if (!container || !teamName) return Promise.resolve();
    container.textContent = "";
    container.appendChild(el("div", "pc-msg", "Loading players…"));
    return loadIndex()
      .then(function (idx) {
        var slug = slugify(teamName);
        var found = idx.teams.filter(function (t) { return t.slug === slug; })[0];
        if (!found) throw new Error("No data for " + teamName);
        return getJson(DATA + "teams/" + found.slug + ".json");
      })
      .then(function (team) { renderCards(container, team); })
      .catch(function (err) {
        container.textContent = "";
        container.appendChild(el("div", "pc-msg", "Player info isn't available for " + teamName + " yet."));
        if (window.console) console.warn(err);
      });
  }

  window.PlayerCards = { show: show };

  function autoWire() {
    var script = document.currentScript || document.querySelector('script[src*="player-cards"]');
    if (script && script.getAttribute("data-auto") === "off") return;
    loadIndex().then(function (idx) {
      var names = {};
      idx.teams.forEach(function (t) { names[t.team] = 1; });
      var selects = Array.prototype.filter.call(document.querySelectorAll("select"), function (s) {
        var hits = Array.prototype.filter.call(s.options, function (o) { return names[o.text.trim()] || names[o.value]; });
        return hits.length > 10;
      }).slice(0, 2);
      selects.forEach(function (sel, i) {
        var box = document.getElementById("cards-" + (i + 1)) || el("div");
        box.id = "cards-" + (i + 1);
        if (!box.parentNode) sel.closest("label, div, section, p") ? sel.closest("label, div, section, p").insertAdjacentElement("afterend", box) : sel.insertAdjacentElement("afterend", box);
        function update() {
          var o = sel.options[sel.selectedIndex];
          var name = o && (names[o.text.trim()] ? o.text.trim() : o.value);
          if (name && names[name]) show(name, box);
        }
        sel.addEventListener("change", update);
        update();
      });
    }).catch(function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoWire);
  else autoWire();
})();
