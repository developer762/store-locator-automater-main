const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = {
  console,
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    computeDigest: () => Array(32).fill(1),
  },
};
vm.createContext(context);
for (const file of ['Config.gs', 'Feed.gs']) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script', file), 'utf8');
  vm.runInContext(source, context, { filename: file });
}

const headers = [
  'Locator Name', 'City', 'State', 'Postal Code', 'Premise Type',
  'Publish Status', 'Latitude', 'Longitude', 'Final Address',
  'Google Place ID', 'Cases (Aug 2026)', 'Bottlings Stocked',
];

test('publishes ready rows and normalizes locator fields', () => {
  const result = context.normalizeRows_([
    headers,
    ['Example Liquor', 'Austin', 'TX', '78701', 'Retail', 'Ready', '30.2672', '-97.7431', '1 Main St, Austin, TX 78701', 'place-1', '12.5', 'Blanco'],
    ['Example Bar', 'Dallas', 'TX', '75201', 'Bar & Restaurant', 'Ready - address estimated', '32.7767', '-96.7970', '2 Main St, Dallas, TX 75201', '', '2', 'Reposado'],
  ]);

  assert.equal(result.locations.length, 2);
  assert.equal(result.locations[0].type, 'retail');
  assert.equal(result.locations[0].cases, 12.5);
  assert.equal(result.locations[1].type, 'bar-restaurant');
  assert.equal(result.skipped.notReady, 0);
});

test('rejects non-ready, coordinate-free, and duplicate rows', () => {
  const result = context.normalizeRows_([
    headers,
    ['Good', 'Austin', 'TX', '78701', 'Retail', 'Ready', '30', '-97', '1 Main St', 'same-place', '1', 'Blanco'],
    ['Duplicate', 'Austin', 'TX', '78701', 'Retail', 'Ready', '30', '-97', '1 Main St', 'same-place', '1', 'Blanco'],
    ['Missing pin', 'Austin', 'TX', '78701', 'Retail', 'Ready', '', '', '2 Main St', '', '1', 'Blanco'],
    ['Held', 'Austin', 'TX', '78701', 'Retail', 'Excluded', '30', '-97', '3 Main St', '', '1', 'Blanco'],
  ]);

  assert.equal(result.locations.length, 1);
  assert.equal(result.skipped.duplicate, 1);
  assert.equal(result.skipped.invalidCoordinates, 1);
  assert.equal(result.skipped.notReady, 1);
});

test('fails closed when a required column is missing', () => {
  assert.throws(
    () => context.normalizeRows_([headers.filter((header) => header !== 'Final Address'), []]),
    /Missing required columns:/
  );
});
