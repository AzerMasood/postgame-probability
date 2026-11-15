#!/usr/bin/env python3
"""Pull FBS teams, rosters and player season stats from CollegeFootballData.com
and write static JSON the site can load for its player cards.

Output:
  data/index.json          list of teams (name, slug, conference, colors, mascot)
  data/teams/<slug>.json   one file per team: roster + each player's season stats

Needs the CFBD_API_KEY environment variable (free key from collegefootballdata.com).
Uses only the Python standard library.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timezone

API = "https://api.collegefootballdata.com"
KEY = os.environ.get("CFBD_API_KEY")
OUT = os.environ.get("OUT_DIR", "data")


def current_season():
    today = date.today()
    # Season N runs Aug N to Jan N+1, so Jan-Jul still belongs to the previous year.
    return today.year if today.month >= 8 else today.year - 1


def get(path, **params):
    url = f"{API}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {KEY}", "Accept": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.load(resp)


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main():
    if not KEY:
        sys.exit("CFBD_API_KEY is not set")

    season = int(os.environ.get("SEASON") or current_season())
    print(f"Season {season}")

    teams = get("/teams/fbs", year=season)
    print(f"{len(teams)} FBS teams")

    # One call each for all rosters and all player stats keeps API usage tiny
    # (3 calls per run) instead of 2 calls x every team.
    roster = get("/roster", year=season)
    stats = get("/stats/player/season", year=season)
    print(f"{len(roster)} roster rows, {len(stats)} stat rows")

    # stats[row] = {playerId, player, team, category, statType, stat}
    by_player = defaultdict(lambda: defaultdict(dict))
    for row in stats:
        key = str(row.get("playerId")) if row.get("playerId") else f'{row.get("team")}|{row.get("player")}'
        by_player[key][row.get("category", "other")][row.get("statType", "stat")] = row.get("stat")

    roster_by_team = defaultdict(list)
    for p in roster:
        roster_by_team[p.get("team")].append(p)

    os.makedirs(os.path.join(OUT, "teams"), exist_ok=True)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    index = []

    for t in sorted(teams, key=lambda x: x["school"]):
        school = t["school"]
        slug = slugify(school)
        players = []
        for p in roster_by_team.get(school, []):
            full = f'{p.get("firstName", "")} {p.get("lastName", "")}'.strip()
            key = str(p.get("id")) if p.get("id") is not None else f"{school}|{full}"
            s = by_player.get(key) or by_player.get(f"{school}|{full}") or {}
            players.append(
                {
                    "id": p.get("id"),
                    "name": full,
                    "position": p.get("position"),
                    "jersey": p.get("jersey"),
                    "year": p.get("year"),
                    "height": p.get("height"),
                    "weight": p.get("weight"),
                    "hometown": ", ".join(x for x in (p.get("homeCity"), p.get("homeState")) if x) or None,
                    "stats": s,
                }
            )
        players.sort(key=lambda x: (x["jersey"] is None, x["jersey"] if x["jersey"] is not None else 0))

        team_doc = {
            "updated": now,
            "season": season,
            "team": school,
            "mascot": t.get("mascot"),
            "abbreviation": t.get("abbreviation"),
            "conference": t.get("conference"),
            "color": t.get("color"),
            "alternateColor": t.get("alternateColor"),
            "players": players,
        }
        with open(os.path.join(OUT, "teams", f"{slug}.json"), "w", encoding="utf-8") as f:
            json.dump(team_doc, f, separators=(",", ":"), ensure_ascii=False)

        index.append(
            {
                "team": school,
                "slug": slug,
                "mascot": t.get("mascot"),
                "abbreviation": t.get("abbreviation"),
                "conference": t.get("conference"),
                "color": t.get("color"),
                "alternateColor": t.get("alternateColor"),
                "players": len(players),
            }
        )

    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"updated": now, "season": season, "teams": index}, f, indent=1, ensure_ascii=False)

    empty = [i["team"] for i in index if i["players"] == 0]
    print(f"Wrote {len(index)} teams; {len(empty)} with no roster: {empty[:10]}")


if __name__ == "__main__":
    main()
