# Casa Mexico Tequila Store Locator Automation Setup

This guide details how to automate `https://casamexicotequila.com/store-locator/` by connecting a Google Sheet to WordPress via Apps Script and the included WordPress sync plugin.

```text
┌──────────────────────────┐
│  Google Sheet            │ (Uploaded monthly / updated by team)
│  "Store Locator Feed"    │
└────────────┬─────────────┘
             │ (Hourly Geocoding Trigger for missing pins)
             ▼
┌──────────────────────────┐
│  Google Apps Script      │ (Serves JSON endpoint at /exec)
│  Web App (/exec)         │
└────────────┬─────────────┘
             │ (Every 15 minutes WP Cron fetch)
             ▼
┌──────────────────────────┐
│  WordPress Plugin        │ (casa-mexico-locator-sync)
│  casamexicotequila.com   │
└────────────┬─────────────┘
             │ Atomically writes to /wp-content/uploads/casa-mexico-locations.json
             ▼
┌──────────────────────────┐
│  Store Locator Map UI    │ (Listens to 'cmx:locations-ready' event)
│  /store-locator/         │
└──────────────────────────┘
```

---

## 1. Google Sheet Setup

1. Open your master Google Sheet.
2. Ensure the active tab is named **`Store Locator Feed`**.
3. Confirm the following required headers exist in Row 1:
   - `Locator Name`
   - `City`
   - `State`
   - `Postal Code`
   - `Premise Type` (`Retail` or `Bar & Restaurant`)
   - `Publish Status` (`Ready` to publish)
   - `Latitude`
   - `Longitude`
   - `Final Address`
4. Optional columns for enhanced features:
   - `Google Place ID` (for deduplication)
   - `Cases (Mon YYYY)` (e.g., `Cases (Jul 2026)`)
   - `Bottlings Stocked` (e.g., `Blanco, Reposado`)
   - `Match Confidence` (auto-populated by geocoder)

---

## 2. Apps Script Web App Deployment

1. Go to [script.google.com](https://script.google.com) and create a project (or use `clasp push`).
2. Copy all code files from `apps-script/` into your project:
   - `Config.gs`
   - `Feed.gs`
   - `Geocode.gs`
   - `Setup.gs`
   - `appsscript.json`
3. Under **Project Settings → Script Properties**, set:
   - `SHEET_ID`: Your Google Sheet ID (from the spreadsheet URL between `/d/` and `/edit`).
   - `FEED_TOKEN` (optional): A secret token (e.g. `secret123`).
4. Run `setUp()` once in the Apps Script editor. This installs the hourly trigger for missing coordinates.
5. Deploy as a Web App:
   - Click **Deploy → New deployment**.
   - Select **Web app**.
   - **Execute as**: *Me (your Google account)*.
   - **Who has access**: *Anyone*.
   - Copy the generated Web App URL ending in `/exec`.

---

## 3. WordPress Plugin Installation (casamexicotequila.com)

1. Upload the `wordpress/casa-mexico-locator-sync` folder to your WordPress site at:
   `wp-content/plugins/casa-mexico-locator-sync/`
2. Log into WordPress Admin on `casamexicotequila.com`.
3. Go to **Plugins → Installed Plugins** and activate **Casa Mexico Store Locator Sync**.
4. Go to **Settings → Casa Mexico Locator**.
5. Paste your Apps Script Web App URL (`https://script.google.com/macros/s/.../exec`).
6. Set the **Minimum location count** safety floor (default: `50`).
7. Click **Save Changes** and click **Sync now**.

The plugin will download the JSON feed, validate every location and coordinate, save it to `https://casamexicotequila.com/wp-content/uploads/casa-mexico-locations.json`, and keep it refreshed automatically every 15 minutes.

---

## 4. Front-End Map Integration (casamexicotequila.com/store-locator/)

The plugin automatically enqueues the feed loader script on your site.

To connect your existing Mapbox, Google Maps, or custom JS store locator:

```javascript
window.addEventListener('cmx:locations-ready', function (event) {
  const locations = event.detail.locations;
  
  // Replace this with your map's update/render function
  if (typeof renderStoreLocator === 'function') {
    renderStoreLocator(locations);
  }
});
```

Each location item in `locations` array contains:
```json
{
  "id": "place_id_or_hash",
  "name": "Southern Sips Liquor",
  "address": "1129 SR 96, Kathleen, GA 31047",
  "city": "Kathleen",
  "state": "GA",
  "postalCode": "31047",
  "type": "retail",
  "latitude": 32.518,
  "longitude": -83.621,
  "cases": 42,
  "bottlings": "Blanco, Reposado, Anejo"
}
```
