var LOCATOR_CONFIG = Object.freeze({
  sheetName: 'Store Locator Feed',
  cacheSeconds: 300,
  headerAliases: {
    name: ['Store Name', 'Locator Name', 'Name', 'Account Name'],
    address: ['Address', 'Final Address', 'Street Address'],
    city: ['City'],
    state: ['State'],
    postalCode: ['Zip', 'Postal Code', 'Zip Code'],
    premiseType: ['Category', 'Premise Type', 'Type'],
    status: ['Publish Status', 'Status'],
    latitude: ['Latitude', 'Lat'],
    longitude: ['Longitude', 'Lng', 'Long'],
    placeId: ['Google Place ID', 'Place ID', 'Store ID'],
    phone: ['Phone', 'Phone Number'],
    website: ['Website', 'URL'],
    cases: ['Cases', '9L Cases', 'Volume'],
    bottlings: ['Bottlings', 'Products']
  },
  requiredHeaders: [
    'Locator Name',
    'City',
    'State',
    'Postal Code',
    'Premise Type',
    'Final Address'
  ]
});

function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '1VnQcAcYE0LPmmmAIXCSH71V_RTUIZbW6';
  try {
    if (id) return SpreadsheetApp.openById(id);
  } catch (e) {}

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  return SpreadsheetApp.openById('1VnQcAcYE0LPmmmAIXCSH71V_RTUIZbW6');
}

function getLocatorSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName('Store Locator') || 
              spreadsheet.getSheetByName(LOCATOR_CONFIG.sheetName) || 
              spreadsheet.getSheets()[0];
  if (!sheet) throw new Error('Missing locator sheet tab in Google Sheet.');
  return sheet;
}

function getFeedToken_() {
  return PropertiesService.getScriptProperties().getProperty('FEED_TOKEN') || '';
}
