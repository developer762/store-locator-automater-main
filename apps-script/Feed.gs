function doGet(e) {
  try {
    var expectedToken = getFeedToken_();
    if (expectedToken) {
      var providedToken = (e && e.parameter && e.parameter.token) ? e.parameter.token : '';
      if (providedToken !== expectedToken) {
        return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized token' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    var payload = getLocatorPayload_();
    return ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      error: err.message || 'Server error',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getLocatorPayload_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('locator-feed-v1');
  if (cached) return JSON.parse(cached);

  var spreadsheet = getSpreadsheet_();
  var sheet = getLocatorSheet_(spreadsheet);

  var values = sheet.getDataRange().getValues();
  var result = normalizeRows_(values);
  var payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    spreadsheetId: spreadsheet.getId(),
    count: result.locations.length,
    skipped: result.skipped,
    locations: result.locations
  };

  try {
    var str = JSON.stringify(payload);
    if (str.length < 95000) {
      cache.put('locator-feed-v1', str, LOCATOR_CONFIG.cacheSeconds);
    }
  } catch (e) {
    // Ignore cache write errors for large payloads
  }

  return payload;
}

function normalizeRows_(values) {
  if (!values || values.length < 2) return { locations: [], skipped: { notReady: 0, invalidCoordinates: 0, duplicate: 0 } };

  var headers = values[0].map(function(h) { return String(h).trim(); });
  validateRequiredHeaders_(headers);
  var colMap = {};

  Object.keys(LOCATOR_CONFIG.headerAliases).forEach(function(key) {
    colMap[key] = findCol_(headers, LOCATOR_CONFIG.headerAliases[key]);
  });

  var locations = [];
  var seenIds = {};
  var skipped = { notReady: 0, invalidCoordinates: 0, duplicate: 0 };

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var name = cellAlias_(row, colMap.name);
    var address = cellAlias_(row, colMap.address);
    var city = cellAlias_(row, colMap.city);
    var state = cellAlias_(row, colMap.state);
    var postalCode = cellAlias_(row, colMap.postalCode);
    var premiseType = cellAlias_(row, colMap.premiseType);
    var status = cellAlias_(row, colMap.status);
    var lat = Number(cellAlias_(row, colMap.latitude));
    var lng = Number(cellAlias_(row, colMap.longitude));
    var placeId = cellAlias_(row, colMap.placeId);
    var phone = cellAlias_(row, colMap.phone);
    var website = cellAlias_(row, colMap.website);

    if (status && !String(status).toLowerCase().startsWith('ready')) {
      skipped.notReady++;
      continue;
    }

    if (!name || !city || !state || !postalCode || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      skipped.invalidCoordinates++;
      continue;
    }

    var cleanName = String(name).replace(/\s*#\d+/g, '').trim();

    var uniqueId = placeId || ('CMT-' + String(i).padStart(3, '0'));
    if (seenIds[uniqueId]) {
      skipped.duplicate++;
      continue;
    }
    seenIds[uniqueId] = true;

    var fullAddress = address ? (address + ', ' + city + ', ' + state + ' ' + postalCode) : (city + ', ' + state + ' ' + postalCode);
    var normType = String(premiseType).toLowerCase();
    var type = (normType.indexOf('bar') !== -1 || normType.indexOf('restaurant') !== -1) ? 'bar-restaurant' : 'retail';

    var casesRaw = cellAlias_(row, colMap.cases);
    var casesVal = Number(casesRaw);
    var cases = (casesRaw !== '' && !isNaN(casesVal)) ? casesVal : null;
    var bottlings = cellAlias_(row, colMap.bottlings) || 'Blanco, Reposado, Anejo';

    locations.push({
      id: uniqueId,
      name: cleanName,
      address: fullAddress,
      city: city,
      state: state,
      postalCode: String(postalCode),
      type: type,
      latitude: lat,
      longitude: lng,
      placeId: uniqueId,
      phone: phone || '',
      website: website || '',
      distributor: state + ' Distributor',
      territory: state,
      cases: cases,
      bottlings: bottlings
    });
  }

  return { locations: locations, skipped: skipped };
}

function findCol_(headers, aliases) {
  if (!headers || !aliases) return -1;
  for (var i = 0; i < aliases.length; i++) {
    var aliasNorm = String(aliases[i]).toLowerCase().trim();
    for (var j = 0; j < headers.length; j++) {
      var hNorm = String(headers[j]).toLowerCase().trim();
      if (hNorm === aliasNorm || hNorm.indexOf(aliasNorm) !== -1) {
        return j;
      }
    }
  }
  return -1;
}

function cellAlias_(row, colIndex) {
  if (colIndex === -1 || colIndex >= row.length) return '';
  return String(row[colIndex]).trim();
}

function validateRequiredHeaders_(headers) {
  var missing = [];
  LOCATOR_CONFIG.requiredHeaders.forEach(function(req) {
    var aliases = LOCATOR_CONFIG.headerAliases;
    var found = false;
    for (var key in aliases) {
      if (aliases[key].indexOf(req) !== -1 || aliases[key].some(function(alias) { return headers.indexOf(alias) !== -1; })) {
        found = true;
        break;
      }
    }
    if (headers.indexOf(req) !== -1) found = true;
    if (!found) missing.push(req);
  });

  // Simple required header check
  var hasName = headers.some(function(h) { return LOCATOR_CONFIG.headerAliases.name.indexOf(h) !== -1; });
  var hasAddr = headers.some(function(h) { return LOCATOR_CONFIG.headerAliases.address.indexOf(h) !== -1; });
  if (!hasName || !hasAddr) {
    throw new Error('Missing required columns: Store Name / Address');
  }
}
