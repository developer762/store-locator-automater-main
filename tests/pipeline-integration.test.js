const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const feedPath = path.join(__dirname, '..', 'casa-mexico-locations.json');

test('Integration Test: Generated feed exists and is valid JSON', () => {
  assert.ok(fs.existsSync(feedPath), 'casa-mexico-locations.json must exist');
  const raw = fs.readFileSync(feedPath, 'utf8');
  const feed = JSON.parse(raw);
  
  assert.equal(feed.schemaVersion, 1, 'schemaVersion must be 1');
  assert.equal(typeof feed.generatedAt, 'string', 'generatedAt timestamp must be string');
  assert.ok(Array.isArray(feed.locations), 'locations must be an array');
  assert.equal(feed.count, feed.locations.length, 'count must equal locations array length');
});

test('Integration Test: Valid feed contains locations (minimum 1 location)', () => {
  const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
  assert.ok(feed.count >= 1, `Feed count (${feed.count}) must be >= 1`);
});

test('Integration Test: Every published location has mandatory fields & valid coordinates', () => {
  const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
  
  feed.locations.forEach((loc, index) => {
    assert.ok(loc.name && typeof loc.name === 'string', `Location ${index + 1} missing valid name`);
    assert.ok(typeof loc.address === 'string', `Location ${index + 1} missing valid address`);
    assert.ok(typeof loc.latitude === 'number' && isFinite(loc.latitude), `Location ${index + 1} latitude invalid`);
    assert.ok(typeof loc.longitude === 'number' && isFinite(loc.longitude), `Location ${index + 1} longitude invalid`);
    assert.ok(loc.latitude >= -90 && loc.latitude <= 90, `Location ${index + 1} latitude out of bounds`);
    assert.ok(loc.longitude >= -180 && loc.longitude <= 180, `Location ${index + 1} longitude out of bounds`);
    assert.ok(['retail', 'bar-restaurant'].includes(loc.type) || loc.type.length > 0, `Location ${index + 1} has invalid premise type: ${loc.type}`);
  });
});

test('Integration Test: Duplicate Place IDs are prevented', () => {
  const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
  const placeIds = feed.locations.map(l => l.placeId).filter(Boolean);
  const uniquePlaceIds = new Set(placeIds);
  assert.equal(placeIds.length, uniquePlaceIds.size, 'Duplicate Google Place IDs found in feed!');
});
