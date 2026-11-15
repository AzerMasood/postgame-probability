/* player-cards.js  (Postgame Probability)
 * Fills the left/right side panels with a team's top performers:
 *   1 = passing yards leader (QB), 2 = rushing yards leader (RB), 3 = receiving yards leader (WR).
 * Also moves the win-chance card up under the Team 1 / Team 2 drop-downs.
 * Reads data/index.json and data/teams/<slug>.json written by scripts/update_data.py.
 *
 * Options on the script tag:  data-auto="off"   data-layout="off"
 * If something can't be found, a small grey note appears at the bottom-left of the page.
 */
(function () {
  "use strict";

  var DATA = "data/";
  var cache = {};
  var indexPromise = null;
  var teamLookup = null; // normalized name -> index entry
  var slots = [null, null]; // { sel, shown, team }

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
    ".pc-links a{padding:5px 14px;border:1px solid rgba(255,255,255,.2);border-radius:20px;color:inherit;text-decoration:none;font-size:.9rem}" +
    "#pc-note{position:fixed;left:8px;bottom:8px;max-width:340px;z-index:99999;padding:6px 10px;border-radius:8px;background:rgba(0,0,0,.8);color:#ddd;font:12px/1.4 sans-serif;cursor:pointer}";

  function injectCss() {
    if (document.getElementById("pc-style")) return;
    var s = document.createElement("style");
    s.id = "pc-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function note(msg) {
    var b = document.getElementById("pc-note");
    if (!msg) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement("div");
      b.id = "pc-note";
      b.title = "Click to dismiss";
      b.addEventListener("click", function () { b.remove(); });
      document.body.appendChild(b);
    }
    b.textContent = "Player cards: " + msg;
    if (window.console) console.warn("PlayerCards: " + msg);
  }

  // ---------- team name matching ----------
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
  function cleanName(n) {
    return String(n || "").replace(/\s*\(\d+-\d+(-\d+)?\)\s*$/, "").trim();
  }
  var ALIASES = {
    umass: "massachusetts", uconn: "connecticut", appalachianstate: "appstate", fiu: "floridainternational",
    miamiohio: "miamioh", miamifl: "miami", miamiflorida: "miami", ulmonroe: "ulmonroe", louisianamonroe: "ulmonroe",
    utsa: "utsanantonio", texassanantonio: "utsanantonio", southernmiss: "southernmississippi", pitt: "pittsburgh",
    mtsu: "middletennessee", middletennesseestate: "middletennessee", wku: "westernkentucky", ecu: "eastcarolina",
    fau: "floridaatlantic", usf: "southflorida", bgsu: "bowlinggreen", bowlinggreenstate: "bowlinggreen",
    sanjosestate: "sanjosestate", hawaii: "hawaii", nc: "northcarolina"
  };

  function buildLookup(idx) {
    teamLookup = {};
    idx.teams.forEach(function (t) { teamLookup[norm(t.team)] = t; });
  }
  function resolveTeam(text) {
    if (!teamLookup) return null;
    var k = norm(cleanName(text));
    if (!k) return null;
    if (teamLookup[k]) return teamLookup[k];
    if (ALIASES[k] && teamLookup[ALIASES[k]]) return teamLookup[ALIASES[k]];
    return null;
  }

  // ---------- data ----------
  function getJson(path) {
    if (!cache[path]) {
      cache[path] = fetch(path).then(function (r) {
        if (!r.ok) throw new Error("couldn't load " + path + " (HTTP " + r.status + ")");
        return r.json();
      });
      cache[path].catch(function () { delete cache[path]; });
    }
    return cache[path];
  }
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = getJson(DATA + "index.json").then(function (idx) { buildLookup(idx); return idx; });
      indexPromise.catch(function () { indexPromise = null; });
    }
    return indexPromise;
  }

  // ---------- helpers ----------
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
  function cards(players) {
    return [
      { player: leader(players, "passing", "YDS"), pos: "QB",
        cols: function (p) { return [["Pass yds", fmt(p && stat(p, "passing", "YDS"))], ["TD", fmt(p && stat(p, "passing", "TD"))], ["Rating", fmt(p && passerRating(p), 1)]]; } },
      { player: leader(players, "rushing", "YDS", ["QB"]), pos: "RB",
        cols: function (p) { return [["Rush yds", fmt(p && stat(p, "rushing", "YDS"))], ["TD", fmt(p && stat(p, "rushing", "TD"))], ["Yds/carry", fmt(p && stat(p, "rushing", "YPC"), 1)]]; } },
      { player: leader(players, "receiving", "YDS", ["QB"]), pos: "WR",
        cols: function (p) { return [["Catches", fmt(p && stat(p, "receiving", "REC"))], ["Rec yds", fmt(p && stat(p, "receiving", "YDS"))], ["TD", fmt(p && stat(p, "receiving", "TD"))]]; } }
    ];
  }
  function safeUrl(u) { return /^https:\/\//i.test(u || "") ? u : null; }

  // ---------- rendering ----------
  function render(panel, team, slot) {
    panel.textContent = "";
    panel.classList.add("pc-panel");
    panel.setAttribute("data-pc-slot", String(slot));
    panel.setAttribute("data-pc-team", team.team);
    panel.style.setProperty("--pc", /^#?[0-9a-f]{3,8}$/i.test(team.color || "") ? (team.color[0] === "#" ? team.color : "#" + team.color) : "#555");
    panel.appendChild(el("h2", "pc-title", team.team));
    panel.appendChild(el("p", "pc-sub", "Top performers · " + team.season + " season"));

    cards(team.players).forEach(function (s, i) {
      var p = s.player;
      var card = el("div", "pc-card");
      var head = el("div", "pc-head");
      var who = el("div", "pc-who");
      who.appendChild(el("span", "pc-rank", String(i + 1)));
      who.appendChild(el("span", "pc-name", p ? p.name : "No stats yet"));
      head.appendChild(who);
      head.appendChild(el("span", "pc-pos", (p && p.position ? p.position : s.pos) + (p && p.jersey > 0 ? " · #" + p.jersey : "")));
      card.appendChild(head);

      var grid = el("div", "pc-stats");
      s.cols(p).forEach(function (c) {
        var d = el("div", "pc-stat");
        d.appendChild(el("span", null, c[0]));
        d.appendChild(el("b", null, c[1]));
        grid.appendChild(d);
      });
      card.appendChild(grid);

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

  // ---------- finding things on the page ----------
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1 };

  // Smallest elements whose text matches (no child element matches too).
  function smallestMatches(re) {
    var out = [];
    Array.prototype.forEach.call(document.body.querySelectorAll("*"), function (n) {
      if (SKIP[n.tagName] || n.id === "pc-note") return;
      if (!re.test(n.textContent)) return;
      for (var c = n.firstElementChild; c; c = c.nextElementSibling) {
        if (!SKIP[c.tagName] && re.test(c.textContent)) return;
      }
      out.push(n);
    });
    return out;
  }

  function findSamplePanels() {
    var notes = smallestMatches(/Preview layout with sample cards/i);
    var panels = [];
    notes.forEach(function (n) {
      var node = n.parentElement;
      while (node && node !== document.body) {
        if (/Player name/.test(node.textContent)) {
          var inside = notes.filter(function (m) { return node.contains(m); }).length;
          if (inside === 1 && panels.indexOf(node) === -1) panels.push(node);
          break;
        }
        node = node.parentElement;
      }
    });
    panels.sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
    return panels;
  }

  function getPanel(slot) {
    var marked = document.querySelector('[data-pc-slot="' + slot + '"]');
    if (marked && marked.isConnected) return marked;
    var found = findSamplePanels();
    return found.length === 2 ? found[slot] : null;
  }

  function findSelects() {
    return Array.prototype.filter.call(document.querySelectorAll("select"), function (s) {
      var hits = Array.prototype.filter.call(s.options, function (o) { return resolveTeam(o.text); });
      return hits.length > 10;
    }).slice(0, 2);
  }

  // Moves the win-chance card up so it sits directly under the two team drop-downs.
  function moveResultCard(selects) {
    if (selects.length !== 2 || document.querySelector("[data-pc-moved]")) return;
    var label = smallestMatches(/Where is the game\?/i)[0];
    if (!label) return;
    var card = label.parentElement;
    while (card && card !== document.body) {
      var hasBig = Array.prototype.some.call(card.querySelectorAll("*"), function (n) {
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

  // ---------- keeping the panels in sync ----------
  function draw(slot) {
    var s = slots[slot];
    if (!s || !s.team) return;
    var panel = getPanel(slot);
    if (!panel) { note("couldn't find the side panels on the page (looked for the 'Preview layout with sample cards' text)."); return; }
    if (!panel.querySelector(".pc-card") || panel.getAttribute("data-pc-team") !== s.team.team) {
      render(panel, s.team, slot);
    }
    note(null);
  }

  function sync(slot) {
    var s = slots[slot];
    var o = s.sel.options[s.sel.selectedIndex];
    var text = o ? cleanName(o.text) : "";
    if (!text || text === s.shown) return;
    s.shown = text;
    var entry = resolveTeam(text);
    if (!entry) { note("no data found for \"" + text + "\" in data/index.json."); return; }
    getJson(DATA + "teams/" + entry.slug + ".json")
      .then(function (team) {
        if (s.shown !== text) return; // user already picked another team
        s.team = team;
        draw(slot);
      })
      .catch(function (e) { note(e.message); });
  }

  var pending = false;
  function onMutation() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(function () {
      pending = false;
      draw(0);
      draw(1);
    });
  }

  function start() {
    var script = document.currentScript || document.querySelector('script[src*="player-cards"]');
    if (script && script.getAttribute("data-auto") === "off") return;
    injectCss();
    loadIndex()
      .then(function () {
        var selects = findSelects();
        if (selects.length !== 2) { note("couldn't find the two team drop-downs."); return; }
        if (!script || script.getAttribute("data-layout") !== "off") {
          try { moveResultCard(selects); } catch (e) { if (window.console) console.warn(e); }
        }
        selects.forEach(function (sel, i) {
          slots[i] = { sel: sel, shown: null, team: null };
          sel.addEventListener("change", function () { sync(i); });
        });
        // Helmet hover/scroll may change a drop-down without firing "change".
        setInterval(function () { sync(0); sync(1); }, 400);
        sync(0);
        sync(1);
        // If the page redraws the side panels itself, put the player cards back.
        new MutationObserver(onMutation).observe(document.body, { childList: true, subtree: true });
      })
      .catch(function (e) { note(e.message); });
  }

  window.PlayerCards = { redraw: function () { draw(0); draw(1); } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
