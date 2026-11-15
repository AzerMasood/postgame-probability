/* player-cards.js  (Postgame Probability)
 * Fills the left/right side panels with a team's top performers:
 *   1 = passing yards leader (QB card), 2 = rushing yards leader (RB card),
 *   3 = receiving yards leader (WR card).
 * Reads data/index.json and data/teams/<slug>.json written by scripts/update_data.py.
 *
 * Manual use:  PlayerCards.show("Fresno State", panelElement)
 * Auto use:    finds the two panels that still contain the "Preview layout with
 *              sample cards" text, and the two team <select> drop-downs, and keeps
 *              them in sync. Turn off with data-auto="off" on the script tag.
 */
(function () {
  "use strict";

  var DATA = "data/";
  var cache = {};
  var indexPromise = null;

  var css =
    ".pc-panel .pc-title{font-family:inherit;font-size:1.6rem;font-weight:800;margin:0}" +
    ".pc-panel .pc-sub{opacity:.7;margin:2px 0 14px}" +
    ".pc-card{border-radius:14px;overflow:hidden;margin-bottom:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}" +
    ".pc-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;color:#fff;background:var(--pc,#555)}" +
    ".pc-who{display:flex;align-items:baseline;gap:10px;min-width:0}" +
    ".pc-rank{font-size:1.4rem;font-weight:800;opacity:.9}" +
    ".pc-name{font-size:1.15rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".pc-pos{font-size:.85rem;opacity:.9;white-space:nowrap;margin-left:8px}" +
    ".pc-stats{display:grid;grid-template-columns:repeat(3,1fr);text-align:center;padding:12px 8px 14px}" +
    ".pc-stat span{display:block;font-size:.85rem;opacity:.75}" +
    ".pc-stat b{display:block;font-size:1.35rem;margin-top:4px}" +
    ".pc-links{display:flex;gap:8px;padding:0 16px 14px}" +
    ".pc-links a{padding:5px 14px;border:1px solid rgba(255,255,255,.2);border-radius:20px;color:inherit;text-decoration:none;font-size:.9rem}";

  function injectCss() {
    if (document.getElementById("pc-style")) return;
    var s = document.createElement("style");
    s.id = "pc-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  // Must match slugify() in scripts/update_data.py
  function slugify(n) {
    return String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  // "Fresno State (5-5)" -> "Fresno State"
  function cleanName(n) {
    return String(n || "").replace(/\s*\(\d+-\d+(-\d+)?\)\s*$/, "").trim();
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

  function stat(p, cat, type) {
    var v = p.stats && p.stats[cat] && p.stats[cat][type];
    var n = Number(v);
    return v == null || v === "" || !isFinite(n) ? null : n;
  }

  function fmt(n, dec) {
    if (n == null) return "—";
    return dec ? n.toFixed(dec) : Math.round(n).toLocaleString();
  }

  // NCAA passer efficiency rating
  function passerRating(p) {
    var att = stat(p, "passing", "ATT"), comp = stat(p, "passing", "COMPLETIONS");
    var yds = stat(p, "passing", "YDS"), td = stat(p, "passing", "TD"), int = stat(p, "passing", "INT") || 0;
    if (!att || comp == null || yds == null || td == null) return null;
    return (8.4 * yds + 330 * td + 100 * comp - 200 * int) / att;
  }

  function leader(players, cat, type, exclude) {
    var best = null, bestV = -Infinity;
    players.forEach(function (p) {
      if (exclude && exclude.indexOf(p.position) !== -1) return;
      var v = stat(p, cat, type);
      if (v != null && v > bestV) { best = p; bestV = v; }
    });
    return best;
  }

  function slots(players) {
    return [
      {
        player: leader(players, "passing", "YDS"), pos: "QB",
        cols: function (p) { return [["Pass yds", fmt(p && stat(p, "passing", "YDS"))], ["TD", fmt(p && stat(p, "passing", "TD"))], ["Rating", fmt(p && passerRating(p), 1)]]; }
      },
      {
        player: leader(players, "rushing", "YDS", ["QB"]), pos: "RB",
        cols: function (p) { return [["Rush yds", fmt(p && stat(p, "rushing", "YDS"))], ["TD", fmt(p && stat(p, "rushing", "TD"))], ["Yds/carry", fmt(p && stat(p, "rushing", "YPC"), 1)]]; }
      },
      {
        player: leader(players, "receiving", "YDS", ["QB"]), pos: "WR",
        cols: function (p) { return [["Catches", fmt(p && stat(p, "receiving", "REC"))], ["Rec yds", fmt(p && stat(p, "receiving", "YDS"))], ["TD", fmt(p && stat(p, "receiving", "TD"))]]; }
      }
    ];
  }

  function safeUrl(u) { return /^https:\/\//i.test(u || "") ? u : null; }

  function render(panel, team) {
    panel.textContent = "";
    panel.classList.add("pc-panel");
    panel.style.setProperty("--pc", /^#?[0-9a-f]{3,8}$/i.test(team.color || "") ? (team.color[0] === "#" ? team.color : "#" + team.color) : "#555");
    panel.appendChild(el("h2", "pc-title", team.team));
    panel.appendChild(el("p", "pc-sub", "Top performers · " + team.season + " season"));

    slots(team.players).forEach(function (s, i) {
      var p = s.player;
      var card = el("div", "pc-card");
      var head = el("div", "pc-head");
      var who = el("div", "pc-who");
      who.appendChild(el("span", "pc-rank", String(i + 1)));
      who.appendChild(el("span", "pc-name", p ? p.name : "No data yet"));
      head.appendChild(who);
      head.appendChild(el("span", "pc-pos", (p && p.position ? p.position : s.pos) + (p && p.jersey != null ? " · #" + p.jersey : "")));
      card.appendChild(head);

      var grid = el("div", "pc-stats");
      s.cols(p).forEach(function (c) {
        var d = el("div", "pc-stat");
        d.appendChild(el("span", null, c[0]));
        d.appendChild(el("b", null, c[1]));
        grid.appendChild(d);
      });
      card.appendChild(grid);

      // CollegeFootballData has no social handles; only shown if a player record has them.
      var ig = p && safeUrl(p.instagram), x = p && safeUrl(p.x);
      if (ig || x) {
        var links = el("div", "pc-links");
        if (ig) { var a = el("a", null, "Instagram"); a.href = ig; a.target = "_blank"; a.rel = "noopener"; links.appendChild(a); }
        if (x) { var b = el("a", null, "X"); b.href = x; b.target = "_blank"; b.rel = "noopener"; links.appendChild(b); }
        card.appendChild(links);
      }
      panel.appendChild(card);
    });
  }

  function show(teamName, panel) {
    injectCss();
    if (!panel || !teamName) return Promise.resolve();
    var name = cleanName(teamName);
    return loadIndex()
      .then(function (idx) {
        var slug = slugify(name);
        var found = idx.teams.filter(function (t) { return t.slug === slug; })[0];
        if (!found) throw new Error("No data for " + name);
        return getJson(DATA + "teams/" + found.slug + ".json");
      })
      .then(function (team) { render(panel, team); })
      .catch(function (err) { if (window.console) console.warn("PlayerCards:", err); });
  }

  // Smallest ancestor of the "Preview layout" note that also holds the sample cards.
  function findPanels() {
    var notes = Array.prototype.filter.call(document.querySelectorAll("p, div, span"), function (n) {
      return n.children.length === 0 && /Preview layout with sample cards/i.test(n.textContent);
    });
    var panels = [];
    notes.forEach(function (n) {
      var node = n.parentElement;
      while (node && node !== document.body && !/Player name/.test(node.textContent)) node = node.parentElement;
      if (node && node !== document.body && panels.indexOf(node) === -1) panels.push(node);
    });
    return panels.slice(0, 2);
  }

  function findSelects(names) {
    return Array.prototype.filter.call(document.querySelectorAll("select"), function (s) {
      var hits = Array.prototype.filter.call(s.options, function (o) { return names[cleanName(o.text)]; });
      return hits.length > 10;
    }).slice(0, 2);
  }

  function selectedTeam(sel) {
    var o = sel.options[sel.selectedIndex];
    return o ? cleanName(o.text) : "";
  }

  function bind(sel, panel, names) {
    var last = null;
    function update() {
      var t = selectedTeam(sel);
      if (t && t !== last && names[t]) { last = t; show(t, panel); }
    }
    sel.addEventListener("change", update);
    // Helmet hover/scroll may change the value without firing "change".
    setInterval(update, 500);
    update();
  }

  // Moves the win-chance card ("Where is the game?" + big percentages + bar)
  // up so it sits directly under the Team 1 / Team 2 drop-downs.
  function moveResultCard(selects) {
    if (selects.length !== 2 || document.querySelector("[data-pc-moved]")) return;
    var label = Array.prototype.filter.call(document.querySelectorAll("*"), function (n) {
      return n.children.length === 0 && /Where is the game\?/i.test(n.textContent);
    })[0];
    if (!label) return;
    var card = label.parentElement;
    while (card && card !== document.body) {
      var leaves = card.querySelectorAll("*");
      var hasBig = Array.prototype.some.call(leaves, function (n) {
        return n.children.length === 0 && /^\s*\d{1,3}%\s*$/.test(n.textContent);
      });
      if (hasBig) break;
      card = card.parentElement;
    }
    if (!card || card === document.body) return;
    if (/Coming up/i.test(card.textContent) || card.contains(selects[0]) || card.contains(selects[1])) return;
    var row = selects[0].parentElement;
    while (row && row !== document.body && !row.contains(selects[1])) row = row.parentElement;
    if (!row || row === document.body || row.contains(card)) return;
    row.insertAdjacentElement("afterend", card);
    card.setAttribute("data-pc-moved", "1");
    card.style.marginTop = "16px";
  }

  function autoWire() {
    var script = document.currentScript || document.querySelector('script[src*="player-cards"]');
    if (script && script.getAttribute("data-auto") === "off") return;
    loadIndex().then(function (idx) {
      var names = {};
      idx.teams.forEach(function (t) { names[t.team] = 1; });
      var panels = findPanels(), selects = findSelects(names);
      if (!script || script.getAttribute("data-layout") !== "off") {
        try { moveResultCard(selects); } catch (e) { if (window.console) console.warn("PlayerCards layout:", e); }
      }
      if (panels.length === 2 && selects.length === 2) {
        bind(selects[0], panels[0], names);
        bind(selects[1], panels[1], names);
      } else if (window.console) {
        console.warn("PlayerCards: couldn't find both panels and both drop-downs; call PlayerCards.show(team, panel) yourself.");
      }
    }).catch(function (e) { if (window.console) console.warn("PlayerCards:", e); });
  }

  window.PlayerCards = { show: show, bind: bind };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoWire);
  else autoWire();
})();
