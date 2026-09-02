const assert = require('node:assert/strict');
const test = require('node:test');

function filterAndSortLocations(allLocations, searchInput, tabInput, stateInput, typeInput, sortInput) {
  var searchVal = (searchInput || '').toLowerCase().trim();
  var tabVal = (tabInput || '').trim();
  var stateVal = (stateInput || '').toUpperCase().trim();
  var typeVal = (typeInput || '').trim();
  var sortVal = sortInput || 'name-asc';

  var tokens = searchVal.split(/\s+/).filter(Boolean);

  var filtered = allLocations.filter(function (loc) {
    var fullText = [
      loc.name,
      loc.address,
      loc.city,
      loc.state,
      loc.postalCode,
      loc.bottlings,
      loc.type,
      loc.distributor,
      loc.territory,
      loc.tabName
    ].join(' ').toLowerCase();

    var matchesSearch = tokens.length === 0 || tokens.every(function (t) {
      return fullText.indexOf(t) !== -1;
    });

    var matchesTab = !tabVal || loc.tabName === tabVal;
    var matchesState = !stateVal || (loc.state && loc.state.toUpperCase() === stateVal);
    var matchesType = !typeVal || loc.type === typeVal;

    return matchesSearch && matchesTab && matchesState && matchesType;
  });

  filtered.sort(function (a, b) {
    if (sortVal === 'name-desc') {
      return String(b.name || '').localeCompare(String(a.name || ''));
    } else if (sortVal === 'cases-desc') {
      var cA = Number(a.cases) || 0;
      var cB = Number(b.cases) || 0;
      return cB - cA;
    } else if (sortVal === 'city-asc') {
      return String(a.city || '').localeCompare(String(b.city || ''));
    } else {
      return String(a.name || '').localeCompare(String(b.name || ''));
    }
  });

  return filtered;
}

const mockLocations = [
  {
    id: 'CMT-NY-058',
    name: 'World Of Liquors',
    address: 'World Of Liquors, India, NY',
    city: 'India',
    state: 'NY',
    postalCode: '',
    type: 'retail',
    latitude: 40.7128,
    longitude: -74.006,
    bottlings: 'Casa Mexico Reposado High Proof 6/1050mL',
    cases: 50,
    distributor: 'NY Distributor',
    territory: 'NY',
    tabName: 'July 2026 NY-NJ'
  },
  {
    id: 'CMT-AZ-001',
    name: 'Axis Food Mart',
    address: '1540 E Broadway Blvd, Tucson, AZ 85719',
    city: 'Tucson',
    state: 'AZ',
    postalCode: '85719',
    type: 'retail',
    latitude: 32.2213,
    longitude: -110.9488,
    bottlings: 'Blanco, Reposado, Anejo',
    cases: 12,
    distributor: 'AZ Distributor',
    territory: 'AZ',
    tabName: 'Store Locator'
  }
];

test('Search filters correctly by tabName', () => {
  const resultTab1 = filterAndSortLocations(mockLocations, '', 'July 2026 NY-NJ', '', '', 'name-asc');
  assert.equal(resultTab1.length, 1);
  assert.equal(resultTab1[0].name, 'World Of Liquors');

  const resultTab2 = filterAndSortLocations(mockLocations, '', 'Store Locator', '', '', 'name-asc');
  assert.equal(resultTab2.length, 1);
  assert.equal(resultTab2[0].name, 'Axis Food Mart');
});

test('Sorting by cases volume high-to-low puts highest cases first', () => {
  const result = filterAndSortLocations(mockLocations, '', '', '', '', 'cases-desc');
  assert.equal(result.length, 2);
  assert.equal(result[0].name, 'World Of Liquors'); // 50 cases > 12 cases
  assert.equal(result[1].name, 'Axis Food Mart');
});

test('Clean state extraction filters out store names', () => {
  const dirtyLocations = [
    { state: 'NY' },
    { state: 'AZ' },
    { state: '19th Hole Package' }, // invalid store name state
    { state: '509 Liquors' } // invalid store name state
  ];

  const cleanStates = {};
  dirtyLocations.forEach(loc => {
    if (loc.state && loc.state.trim().length <= 4 && !/\s/.test(loc.state.trim())) {
      cleanStates[loc.state.trim().toUpperCase()] = true;
    }
  });

  const stateList = Object.keys(cleanStates).sort();
  assert.deepEqual(stateList, ['AZ', 'NY']);
});

test('Dynamic future sheet tabs automatically populate tab options', () => {
  const futureLocations = [
    { name: 'Store A', tabName: 'New Future Tab 2027' },
    { name: 'Store B', tabName: 'Special Reserve Tab' },
    { name: 'Store C', tabName: 'New Future Tab 2027' }
  ];

  const tabsMap = {};
  futureLocations.forEach(loc => {
    const t = loc.tabName || 'Store Locator';
    tabsMap[t] = (tabsMap[t] || 0) + 1;
  });

  const detectedTabs = Object.keys(tabsMap).sort();
  assert.deepEqual(detectedTabs, ['New Future Tab 2027', 'Special Reserve Tab']);
  assert.equal(tabsMap['New Future Tab 2027'], 2);
});
