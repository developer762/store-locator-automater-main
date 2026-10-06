# Store Locator Automater

Publishes approved Casa Mexico store rows from Google Sheets to the WordPress
store locator. Upload the monthly workbook to the `Store Locator Feed` tab and
the site receives a validated, cached JSON feed within 15 minutes.

## Repository layout

```text
apps-script/                         Google Sheets JSON web app
wordpress/casa-mexico-locator-sync/ WordPress cache and browser feed loader
tests/                               Feed transformation and syntax checks
.github/workflows/deploy.yml         CI and optional Apps Script deployment
examples/                             Reference Google Sheets upload workbook
```

The reference workbook is available at
[`examples/casa-mexico-store-locator-feed-july-2026.xlsx`](examples/casa-mexico-store-locator-feed-july-2026.xlsx).
It contains real store and distributor data, so keep this repository private.

## Data contract

The Google Sheet must contain these headers exactly:

- `Locator Name`
- `City`
- `State`
- `Postal Code`
- `Premise Type`
- `Publish Status`
- `Latitude`
- `Longitude`
- `Final Address`

The July 2026 workbook matches this contract. The feed includes rows whose
status begins with `Ready`, requires valid coordinates, and removes duplicates
using Google Place ID when available. The monthly `Cases (...)` header is
detected automatically when the month changes.

## 1. Set up Google Sheets

1. Create a Google Sheet and name its tab `Store Locator Feed`.
2. In that tab, use **File → Import → Upload → Replace current sheet** and
   upload the locator workbook.
3. Copy the spreadsheet ID from the URL between `/d/` and `/edit`.
4. Create a standalone Apps Script project at
   [script.google.com](https://script.google.com), or deploy with clasp.
5. Add the `SHEET_ID` script property under **Project Settings → Script
   Properties**.
6. Optional: add a random `FEED_TOKEN`. When set, WordPress must use an endpoint
   ending in `?token=YOUR_VALUE`.
7. Run `setUp()` once. The July workbook starts with 66 rows publishable now
   and 151 approved rows awaiting coordinates. Setup installs an hourly
   geocoding trigger that attempts up to 50 of those rows per run.
8. Choose **Deploy → New deployment → Web app**. Execute as yourself and allow
   access to anyone, then copy the `/exec` URL.

Run `geocodeMissingRows()` manually to start immediately. Exact address matches
receive coordinates and join the next feed; partial or missing matches are held
for review in `Match Confidence` instead of placing a potentially incorrect pin.
Set the optional `GEOCODE_BATCH_SIZE` script property between 1 and 100 to
change the hourly batch size.

The endpoint returns an object containing `generatedAt`, `count`, `skipped`,
and `locations`. Add `?fresh=1` or `?nocache=1` to bypass script caching immediately on demand. Clicking **Save & Sync Now** in WordPress automatically triggers a 0-latency live cache-bypass sync.

## 2. Deploy Apps Script with clasp

```bash
npm install -g @google/clasp
clasp login
cp .clasp.json.example .clasp.json
# Put the Apps Script project ID in .clasp.json
clasp push
```

For GitHub deployment, add `CLASPRC_JSON` and `SCRIPT_ID` as repository secrets.
Set the repository variable `APPS_SCRIPT_DEPLOY_ENABLED` to `true` to deploy on
pushes to `main`. Manual workflow dispatches can deploy without that variable.

## 3. Install the WordPress plugin

1. Copy `wordpress/casa-mexico-locator-sync/` to
   `wp-content/plugins/casa-mexico-locator-sync/`.
2. Activate **Casa Mexico Store Locator Sync**.
3. Open **Settings → Casa Mexico Locator**.
4. Paste the Apps Script `/exec` URL, including `?token=...` when used.
5. Leave the safety floor at 50, save, and click **Sync now**.

The plugin validates every row, keeps a backup, atomically replaces
`wp-content/uploads/casa-mexico-locations.json`, and refreshes it every 15
minutes. A broken or unexpectedly small feed leaves the last good map intact.

## 4. Connect the existing locator

The plugin loads the feed and exposes it as `window.CMX_LOCATOR.locations`. It
also emits a browser event once the data is ready:

```js
window.addEventListener('cmx:locations-ready', function (event) {
  const locations = event.detail.locations;
  // Replace this with the existing locator's render/update function.
  renderStoreLocator(locations);
});
```

The exact final call depends on the JavaScript currently powering the map. The
feed location object contains `name`, `address`, `city`, `state`, `postalCode`,
`type`, `latitude`, `longitude`, `placeId`, `cases`, and `bottlings`.

## Local verification

```bash
npm run check
php -l wordpress/casa-mexico-locator-sync/casa-mexico-locator-sync.php
```

See [`docs-pipeline.md`](docs-pipeline.md) for safeguards and operational
details.
