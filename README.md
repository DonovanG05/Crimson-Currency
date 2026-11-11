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

The sidebar's **Ask AI** box answers natural-language questions such as
"where can I get sushi with Dining Dollars?" using Google Gemini 2.5 Flash,
grounded only in the site's own location data (`site/locations.js`). The
answer appears in the chat and the map/list filter down to the named
locations.

It needs a Gemini API key, and the key is **never** stored in this repo:
open the page, click "Set Gemini API key", and paste your key. It is saved
in your browser's localStorage and sent only to Google's API — the page
calls Gemini directly, there is no server and no config file. A fresh
`git clone` therefore works exactly the same way; everyone supplies their
own key. Free keys: https://aistudio.google.com/apikey

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

Served on Money at http://192.168.0.3:8325 from
`/home/muse-agent/crimson-currency/dist` by the `crimson-currency.service`
systemd user service. To redeploy after pulling changes:

```sh
cp -r site/* ~/crimson-currency/dist/
```
