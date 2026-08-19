function setUp() {
  var spreadsheet = getSpreadsheet_();
  var sheet = getLocatorSheet_(spreadsheet);

  var values = sheet.getDataRange().getValues();
  var result = normalizeRows_(values);
  var awaitingCoordinates = countMissingCoordinates_(values);
  installGeocodeTrigger_();
  CacheService.getScriptCache().remove('locator-feed-v1');
  console.log('Setup complete. ' + result.locations.length + ' locations can publish now; ' + awaitingCoordinates + ' await geocoding.');
  return {
    spreadsheetId: spreadsheet.getId(),
    publishableLocations: result.locations.length,
    awaitingCoordinates: awaitingCoordinates,
    skipped: result.skipped
  };
}

function clearFeedCache() {
  CacheService.getScriptCache().remove('locator-feed-v1');
}
