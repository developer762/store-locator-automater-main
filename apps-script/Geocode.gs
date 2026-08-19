function geocodeMissingRows() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { processed: 0, remaining: null, reason: 'Another geocoding run is active.' };

  try {
    var spreadsheet = getSpreadsheet_();
    var sheet = getLocatorSheet_(spreadsheet);

    var range = sheet.getDataRange();
    var values = range.getValues();
    var headers = values[0].map(function (header) { return String(header).trim(); });
    var columns = {};
    headers.forEach(function (header, index) { columns[header] = index; });
    var required = ['Publish Status', 'Final Address', 'Latitude', 'Longitude'];
    var missing = required.filter(function (header) { return columns[header] === undefined; });
    if (missing.length) throw new Error('Missing required columns: ' + missing.join(', '));

    var properties = PropertiesService.getScriptProperties();
    var batchSize = Math.max(1, Math.min(100, Number(properties.getProperty('GEOCODE_BATCH_SIZE')) || 50));
    var geocoder = Maps.newGeocoder().setRegion('us').setLanguage('en');
    var attempted = 0;
    var processed = 0;
    var failed = 0;

    for (var rowIndex = 1; rowIndex < values.length && attempted < batchSize; rowIndex += 1) {
      var row = values[rowIndex];
      if (!/^ready\b/i.test(String(row[columns['Publish Status']] || ''))) continue;
      if (String(row[columns.Latitude] || '').trim() && String(row[columns.Longitude] || '').trim()) continue;
      if (columns['Match Confidence'] !== undefined && /^Geocode held/i.test(String(row[columns['Match Confidence']] || ''))) continue;

      var address = String(row[columns['Final Address']] || '').trim();
      if (!address) continue;

      attempted += 1;
      var response = geocoder.geocode(address);
      var match = response && response.status === 'OK' && response.results && response.results[0];
      var location = match && match.geometry && match.geometry.location;
      if (!location || !validCoordinates_(Number(location.lat), Number(location.lng)) || match.partial_match) {
        if (columns['Match Confidence'] !== undefined) {
          var reason = match && match.partial_match ? 'Geocode held - partial address match' : 'Geocode held - no address match';
          sheet.getRange(rowIndex + 1, columns['Match Confidence'] + 1).setValue(reason);
        }
        failed += 1;
        continue;
      }

      sheet.getRange(rowIndex + 1, columns.Latitude + 1).setValue(Number(location.lat));
      sheet.getRange(rowIndex + 1, columns.Longitude + 1).setValue(Number(location.lng));
      if (columns['Google Place ID'] !== undefined && match.place_id) {
        sheet.getRange(rowIndex + 1, columns['Google Place ID'] + 1).setValue(match.place_id);
      }
      if (columns['Match Confidence'] !== undefined) {
        sheet.getRange(rowIndex + 1, columns['Match Confidence'] + 1).setValue('Geocoded - exact address match');
      }
      processed += 1;
      Utilities.sleep(80);
    }

    SpreadsheetApp.flush();
    clearFeedCache();
    var remaining = countMissingCoordinates_(sheet.getDataRange().getValues());
    properties.setProperties({
      LAST_GEOCODE_AT: new Date().toISOString(),
      LAST_GEOCODE_COUNT: String(processed),
      LAST_GEOCODE_REMAINING: String(remaining)
    });
    return { attempted: attempted, processed: processed, failed: failed, remaining: remaining };
  } finally {
    lock.releaseLock();
  }
}

function countMissingCoordinates_(values) {
  if (!values || values.length < 2) return 0;
  var headers = values[0].map(function (header) { return String(header).trim(); });
  var statusIndex = headers.indexOf('Publish Status');
  var latitudeIndex = headers.indexOf('Latitude');
  var longitudeIndex = headers.indexOf('Longitude');
  if (statusIndex < 0 || latitudeIndex < 0 || longitudeIndex < 0) return 0;

  return values.slice(1).filter(function (row) {
    return /^ready\b/i.test(String(row[statusIndex] || '')) &&
      (!String(row[latitudeIndex] || '').trim() || !String(row[longitudeIndex] || '').trim());
  }).length;
}

function installGeocodeTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'geocodeMissingRows') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('geocodeMissingRows').timeBased().everyHours(1).create();
}
