# Casa Mexico locator publishing pipeline

## Flow

```text
Monthly Excel workbook
        ↓ manual Google Sheets import
Store Locator Feed tab
        ↓ hourly geocoding for approved rows without pins
Latitude / Longitude columns
        ↓ Apps Script web app
validated JSON feed
        ↓ WordPress cron every 15 minutes
casa-mexico-locations.json + .bak
        ↓ browser loader
existing locator render function
```

## Publication rules

A row is published only when:

- `Publish Status` begins with `Ready`;
- latitude and longitude are present and valid;
- the required name and final-address columns exist; and
- another row has not already claimed its Google Place ID or fallback identity.

Premise types become the stable filter values `retail` and `bar-restaurant`.
Rows that fail these checks are counted in the endpoint's `skipped` object.

Approved rows without coordinates are geocoded in batches of 50. Exact address
matches are written back to the Sheet. Partial and missing matches are held in
the `Match Confidence` column for manual review and do not reach the map.

## Failure safeguards

- Apps Script fails closed if a required header is missing or zero stores pass.
- The endpoint is cached for five minutes to reduce Sheet reads, but immediately bypasses cache when `nocache=1` / `fresh=1` is sent (such as when clicking **Sync now** in WordPress).
- WordPress validates the payload shape, reported count, every coordinate, and
  every required name/address.
- The default 50-store floor prevents a truncated sheet from emptying the map.
- WordPress writes a temporary file, backs up the previous JSON, and then
  renames the temporary file over the live feed.
- The last successful sync time, count, and latest error are visible under
  **Settings → Casa Mexico Locator**.

## Monthly operation

1. Keep the tab name and header row unchanged.
2. Import the latest workbook into `Store Locator Feed`.
3. Confirm the intended rows say `Ready`. Run `geocodeMissingRows()` if you do
   not want to wait for the hourly trigger.
4. Review any `Geocode held` rows, then click **Sync now** in WordPress for an
   immediate refresh or wait 15 minutes.
5. Confirm the count and inspect the public locator.

The `Cases (Mon YYYY)` column may change month to month; the Apps Script detects
that header by prefix. Credentials and endpoint tokens belong in Apps Script
properties or WordPress options and must never be committed.
