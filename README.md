# Crimson Currency

Interactive map of off-campus locations in Tuscaloosa / Northport, Alabama where
University of Alabama students can spend **Bama Cash** and **Dining Dollars**.

- 64 pins / 58 businesses, one pin per street address
- Filter by payment type (Bama Cash only / Both), location type, and availability
  ("Currently unavailable" places can be toggled off)
- Click a pin for the business logo, address, phone, hours (where verified),
  and a menu / website link
- Map is locked to the Tuscaloosa / Northport area

## AI search (Gemini)

The floating **Ask AI** dock (bottom-right) answers natural-language questions such as
"where can I get sushi with Dining Dollars?" using Google Gemini 2.5 Flash,
grounded only in the site's own location data (`site/locations.js`). The
answer appears in the chat and the map/list filter down to the named
locations.

The key is **never** stored in this repo. It works one way: run the site
with the included Node server
   and give the *server* a key via the `GEMINI_API_KEY` environment
   variable. The key lives only in the server's environment — never in git,
   never sent to browsers — and every visitor can use Ask AI with nothing
   to set up:

   ```sh
   GEMINI_API_KEY=your-key npm start
   ```

   The server exposes `POST /api/ask`, grounds Gemini in the site's own
   location data, validates the returned location IDs against the dataset,
   and rate-limits questions per visitor (30/hour) since the key is shared.

If the server has no key set, Ask AI simply reports itself unavailable;
the map and list work normally without it. Nobody's key is ever committed.

### Use your own Gemini key

Ask AI runs on whoever hosts the site's key. To use your own:

1. Go to https://aistudio.google.com/apikey, sign in with a Google
   account, click **Create API key**, and copy the key it gives you.
   (The free tier is plenty for this site.)
2. Give it to the server as the `GEMINI_API_KEY` environment variable,
   in the same terminal you start the server from:

   - **Linux / macOS:** `export GEMINI_API_KEY="your-key-here"`, then
     `npm start`
   - **Windows PowerShell:** `$env:GEMINI_API_KEY = "your-key-here"`,
     then `npm start`
   - **Windows CMD:** `set GEMINI_API_KEY=your-key-here`, then
     `npm start`

   For a server that should keep the key across restarts, put the line
   `GEMINI_API_KEY=your-key-here` in an environment file outside the repo
   (for example `~/.config/crimson-currency.env`, permissions 600) and
   point your service manager at it — the live deployment does exactly
   this with systemd's `EnvironmentFile`.
3. Start the server and check its log: it should print
   `AI search: server key configured (/api/ask on)`. Then open the site
   and ask a question, e.g. "where can I get sushi with Dining Dollars?"

**Never paste your key into any file inside this repo** (not the HTML, not
a `.env` in the project folder) and never commit it — anyone with the key
can spend your quota. `.env` files are git-ignored here as a safety net,
but the environment variable is the supported route.

## Run locally

Easiest: open `index.html` (repo root — it forwards into `site/`) or
`site/index.html` directly in a browser. Location data is embedded via
`site/locations.js`, so the map works from disk with no server; the map
tiles themselves load from OpenStreetMap and need an internet connection.

Or serve it with npm instead of Python. From the repo root, with Node.js
18+ / npm installed:

```sh
npm start
# open http://localhost:8325
```

There are no npm dependencies to install first — `npm start` just runs the
small Node static server in `serve.mjs`.

## Layout

- `site/` — the static site (index.html, locations.json, images/, vendor/)
- `data/` — dataset builds (pins before/after geocoding, final locations.json)
- `tools/` — dataset pipeline scripts (scrape, expand, geocode, fix)
- `package.json` / `serve.mjs` — no-dependency Node server for `npm start`

## Data sources

University of Alabama Action Card "Bama Cash Locations" and Bama Dining
"Dining Dollars" pages, retrieved November 2, 2026. Hours are shown only where
verified against a current Places listing; no hours are guessed.

## Deployment (Money)

Served on Money at http://192.168.0.3:8325 by the `crimson-currency.service`
systemd user service, which runs the Node server
(`/home/muse-agent/crimson-currency/serve.mjs`) with
`SITE_ROOT=/home/muse-agent/crimson-currency/dist`. The service reads an
optional env file at `/home/muse-agent/.config/crimson-currency.env`
(mode 600, not in git) — put `GEMINI_API_KEY=...` there to enable the
server-key AI mode, then restart the service. To redeploy after pulling
changes:

```sh
cp -r site/* ~/crimson-currency/dist/
cp serve.mjs ~/crimson-currency/serve.mjs
systemctl --user restart crimson-currency.service
```
