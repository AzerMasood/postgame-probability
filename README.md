# Postgame Probability


A small page that shows each team's win chance, with a spinning-helmet team picker.


- `index.html` is the page.
- `scripts/update.mjs` fetches fresh data from CollegeFootballData every day.
- `.github/workflows/update.yml` runs that script on a schedule.
- `data/` holds the saved results (created by the script).


The data key is stored as a private secret named `CFBD_API_KEY`. It is never part of the code.

