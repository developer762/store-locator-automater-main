(function () {
  'use strict';

  var map = null;
  var markersGroup = null;
  var allLocations = [];
  var locationMarkers = [];
  var currentViewMode = 'map'; // 'map', 'sales', or 'table'
  var currentPage = 1;
  var itemsPerPage = 25;

  function initLocatorMap() {
    var canvas = document.getElementById('cmx-map-canvas');
    if (canvas && window.L) {
      map = L.map('cmx-map-canvas', {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView([39.8283, -98.5795], 4);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      markersGroup = L.featureGroup().addTo(map);
    }

    // Bind event listeners for search, filters, sort, and view toggles
    var searchInput = document.getElementById('cmx-search-input');
    var tabSelect = document.getElementById('cmx-tab-select');
    var stateSelect = document.getElementById('cmx-state-select');
    var typeSelect = document.getElementById('cmx-type-select');
    var sortSelect = document.getElementById('cmx-sort-select');
    var viewMapBtn = document.getElementById('cmx-view-map-btn');
    var viewSalesBtn = document.getElementById('cmx-view-sales-btn');
    var viewTableBtn = document.getElementById('cmx-view-table-btn');

    function resetAndRender() {
      currentPage = 1;
      renderMapAndSidebar();
    }

    if (searchInput) searchInput.addEventListener('input', resetAndRender);
    if (tabSelect) tabSelect.addEventListener('change', resetAndRender);
    if (stateSelect) stateSelect.addEventListener('change', resetAndRender);
    if (typeSelect) typeSelect.addEventListener('change', resetAndRender);
    if (sortSelect) sortSelect.addEventListener('change', resetAndRender);

    if (viewMapBtn) {
      viewMapBtn.addEventListener('click', function () {
        currentViewMode = 'map';
        setActiveViewBtn(viewMapBtn);
        showViewContainer('cmx-split-view');
        if (map) setTimeout(function () { map.invalidateSize(); }, 100);
        renderMapAndSidebar();
      });
    }

    if (viewSalesBtn) {
      viewSalesBtn.addEventListener('click', function () {
        currentViewMode = 'sales';
        setActiveViewBtn(viewSalesBtn);
        showViewContainer('cmx-sales-view');
        renderMapAndSidebar();
      });
    }

    if (viewTableBtn) {
      viewTableBtn.addEventListener('click', function () {
        currentViewMode = 'table';
        setActiveViewBtn(viewTableBtn);
        showViewContainer('cmx-table-view');
        renderMapAndSidebar();
      });
    }

    function setActiveViewBtn(activeBtn) {
      [viewMapBtn, viewSalesBtn, viewTableBtn].forEach(function (btn) {
        if (btn) btn.classList.remove('cmx-active');
      });
      if (activeBtn) activeBtn.classList.add('cmx-active');
    }

    function showViewContainer(containerId) {
      ['cmx-split-view', 'cmx-sales-view', 'cmx-table-view'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = (id === containerId) ? (id === 'cmx-split-view' ? 'flex' : 'block') : 'none';
      });
    }

    // Load locations feed with bulletproof fallback
    var fallbackEndpoint = (window.CMX_LOCATOR && window.CMX_LOCATOR.directEndpoint) || 'https://script.google.com/macros/s/AKfycbz8pQv5oekeeTT35zyE22mPqczBBeWI6facsR9vs62jUCzv-kC4eiDxKyYf43nvx9Faew/exec';

    function tryDirectEndpoint() {
      if (allLocations && allLocations.length > 0) return;
      var directUrl = fallbackEndpoint + (fallbackEndpoint.indexOf('?') === -1 ? '?' : '&') + 'nocache=1';
      fetch(directUrl)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.locations && data.locations.length > 0) {
            setLocationsData(data.locations);
          }
        })
        .catch(function (err) {
          console.warn('Direct fallback load attempt:', err);
        });
    }

    if (window.CMX_LOCATOR && window.CMX_LOCATOR.locations && window.CMX_LOCATOR.locations.length > 0) {
      setLocationsData(window.CMX_LOCATOR.locations);
    } else if (window.CMX_LOCATOR && typeof window.CMX_LOCATOR.load === 'function') {
      window.CMX_LOCATOR.load().then(function (payload) {
        if (payload && payload.locations) setLocationsData(payload.locations);
      }).catch(function (err) {
        console.warn('Casa Mexico map feed error, trying direct endpoint:', err);
        tryDirectEndpoint();
      });
    } else {
      tryDirectEndpoint();
    }

    // Safety timeout to ensure data is never stuck on "Loading..."
    setTimeout(function () {
      if (!allLocations || allLocations.length === 0) {
        tryDirectEndpoint();
      }
    }, 1500);

    window.addEventListener('cmx:locations-ready', function (e) {
      if (e.detail && e.detail.locations) {
        setLocationsData(e.detail.locations);
      }
    });

    function triggerMapResize() {
      if (map && currentViewMode === 'map') {
        map.invalidateSize();
      }
    }

    [100, 300, 600, 1000, 2000].forEach(function (ms) {
      setTimeout(triggerMapResize, ms);
    });

    window.addEventListener('load', triggerMapResize);
    window.addEventListener('resize', triggerMapResize);
    window.addEventListener('orientationchange', triggerMapResize);
  }

  function getTabName(loc) {
    if (loc.tabName) return loc.tabName;
    if (loc.territory) {
      var terr = String(loc.territory).toUpperCase();
      if (terr.indexOf('NY') !== -1 || terr.indexOf('NJ') !== -1) return 'July 2026 NY-NJ';
      if (terr.indexOf('FL') !== -1) return 'Depletions FL';
      if (terr.indexOf('TX') !== -1) return 'Depletions TX July 2026';
      if (terr.indexOf('KY') !== -1) return 'Casa Mexico Rolling 12 KY';
      if (terr.indexOf('MA') !== -1 || terr.indexOf('RI') !== -1) return 'MA-RI Summary';
      if (terr.indexOf('AZ') !== -1) return 'AZ Accounts';
      if (terr.indexOf('CA') !== -1) return 'CA Accounts';
      if (terr.indexOf('IL') !== -1) return 'IL Espiritus';
      return loc.territory + ' Tab';
    }
    if (loc.id && loc.id.indexOf('CMT-') === 0) {
      var match = loc.id.match(/^CMT-([A-Za-z0-9]+)-/);
      if (match && match[1]) return match[1] + ' Tab';
    }
    return 'Store Locator';
  }

  function setLocationsData(locations) {
    if (!Array.isArray(locations)) return;

    // Attach resolved tab names
    locations.forEach(function (loc) {
      loc._cleanTabName = getTabName(loc);
    });

    allLocations = locations;
    populateTabSelect(locations);
    populateStateSelect(locations);
    renderMapAndSidebar();
  }

  function populateTabSelect(locations) {
    var tabSelect = document.getElementById('cmx-tab-select');
    if (!tabSelect) return;

    var currentVal = tabSelect.value;
    var tabsMap = {};

    locations.forEach(function (loc) {
      var tName = loc._cleanTabName || getTabName(loc);
      tabsMap[tName] = (tabsMap[tName] || 0) + 1;
    });

    var tabs = Object.keys(tabsMap).sort();
    var html = '<option value="">All Sheet Tabs (' + tabs.length + ' Tabs • ' + locations.length + ' Stores)</option>';
    tabs.forEach(function (t) {
      html += '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + ' (' + tabsMap[t] + ')</option>';
    });
    tabSelect.innerHTML = html;
    if (currentVal && tabsMap[currentVal]) tabSelect.value = currentVal;
  }

  function populateStateSelect(locations) {
    var stateSelect = document.getElementById('cmx-state-select');
    if (!stateSelect) return;

    var currentVal = stateSelect.value;
    var statesSet = {};

    locations.forEach(function (loc) {
      var st = loc.state ? String(loc.state).trim().toUpperCase() : '';
      if (st && st.length <= 3 && /^[A-Z]{2,3}$/.test(st)) {
        statesSet[st] = true;
      }
    });

    var states = Object.keys(statesSet).sort();
    var html = '<option value="">All States (' + states.length + ' States)</option>';
    states.forEach(function (st) {
      html += '<option value="' + escapeHtml(st) + '">' + escapeHtml(st) + '</option>';
    });
    stateSelect.innerHTML = html;
    if (currentVal && statesSet[currentVal]) stateSelect.value = currentVal;
  }

  function renderMapAndSidebar() {
    var searchVal = (document.getElementById('cmx-search-input') ? document.getElementById('cmx-search-input').value : '').toLowerCase().trim();
    var tabVal = document.getElementById('cmx-tab-select') ? document.getElementById('cmx-tab-select').value : '';
    var stateVal = document.getElementById('cmx-state-select') ? document.getElementById('cmx-state-select').value.toUpperCase() : '';
    var typeVal = document.getElementById('cmx-type-select') ? document.getElementById('cmx-type-select').value : '';
    var sortVal = document.getElementById('cmx-sort-select') ? document.getElementById('cmx-sort-select').value : 'name-asc';

    var tokens = searchVal.split(/\s+/).filter(Boolean);

    var filtered = allLocations.filter(function (loc) {
      var rawName = String(loc.name || '').trim().toLowerCase();
      if (rawName === 'total' || rawName.indexOf('total') === 0 || rawName.indexOf('grand total') === 0 || rawName.indexOf('subtotal') === 0) {
        return false;
      }

      var tabNameResolved = loc._cleanTabName || getTabName(loc);
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
        tabNameResolved
      ].join(' ').toLowerCase();

      var matchesSearch = tokens.length === 0 || tokens.every(function (t) {
        return fullText.indexOf(t) !== -1;
      });

      var matchesTab = !tabVal || tabNameResolved === tabVal;
      var matchesState = !stateVal || (loc.state && String(loc.state).toUpperCase() === stateVal);
      var matchesType = !typeVal || loc.type === typeVal;

      return matchesSearch && matchesTab && matchesState && matchesType;
    });

    // Apply Sorting
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

    // Update count badge
    var countBadge = document.getElementById('cmx-count-badge');
    if (countBadge) {
      countBadge.textContent = filtered.length + ' store' + (filtered.length === 1 ? '' : 's') + ' found';
    }

    if (currentViewMode === 'table') {
      renderTable(filtered);
    } else if (currentViewMode === 'sales') {
      renderSalesMetrics(filtered);
    } else {
      renderMapAndCards(filtered);
    }
  }

  function renderSalesMetrics(filtered) {
    var volEl = document.getElementById('cmx-sales-vol');
    var topEl = document.getElementById('cmx-sales-top-prod');
    var marketsEl = document.getElementById('cmx-sales-markets');
    var container = document.getElementById('cmx-sales-breakdown');

    var totalVol = 0;
    var productMap = {};
    var territoryMap = {};

    filtered.forEach(function (loc) {
      if (loc.cases) totalVol += Number(loc.cases);
      var prod = loc.bottlings || 'Casa Mexico Tequila';
      productMap[prod] = (productMap[prod] || 0) + (Number(loc.cases) || 1);
      var terr = loc.territory || loc.state || 'US';
      territoryMap[terr] = (territoryMap[terr] || 0) + (Number(loc.cases) || 1);
    });

    var topProd = 'Casa Mexico Reposado';
    var maxCases = 0;
    Object.keys(productMap).forEach(function (p) {
      if (productMap[p] > maxCases) {
        maxCases = productMap[p];
        topProd = p;
      }
    });

    if (volEl) volEl.textContent = totalVol ? totalVol + ' Cases' : filtered.length + ' Stores';
    if (topEl) topEl.textContent = topProd;
    if (marketsEl) marketsEl.textContent = Object.keys(territoryMap).length + ' Markets';

    if (container) {
      if (filtered.length === 0) {
        container.innerHTML = '<div class="cmx-no-results">No sales records matching search criteria.</div>';
        return;
      }

      var html = '';
      Object.keys(territoryMap).sort().forEach(function (terr) {
        html += '<div class="cmx-sales-card">' +
          '<div class="cmx-sales-card-title">📍 Territory: ' + escapeHtml(terr) + '</div>' +
          '<div class="cmx-sales-card-vol">📦 Volume: <strong>' + territoryMap[terr] + '</strong> units / cases</div>' +
          '</div>';
      });
      container.innerHTML = html;
    }
  }

  function renderMapAndCards(filtered) {
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    locationMarkers = [];

    var sidebarContainer = document.getElementById('cmx-sidebar-list');
    if (sidebarContainer) sidebarContainer.innerHTML = '';

    if (filtered.length === 0) {
      if (sidebarContainer) {
        sidebarContainer.innerHTML = '<div class="cmx-no-results">No store locations matching search criteria.</div>';
      }
      return;
    }

    var bounds = L.latLngBounds();

    function formatLocationAddress(loc) {
      var addr = loc.address ? escapeHtml(loc.address) : '';
      var cityStateParts = [];
      if (loc.city && loc.city !== 'N/A' && loc.city !== loc.address) cityStateParts.push(escapeHtml(loc.city));
      if (loc.state && loc.state !== 'US') cityStateParts.push(escapeHtml(loc.state));
      var cityState = cityStateParts.join(', ') + (loc.postalCode ? ' ' + escapeHtml(loc.postalCode) : '');

      if (addr && cityState && addr !== cityState) {
        return addr + ' (' + cityState + ')';
      } else if (addr) {
        return addr;
      } else if (cityState) {
        return cityState;
      } else {
        return escapeHtml(loc.territory || loc.tabName || 'Available in Market');
      }
    }

    function buildDirectionsUrl(loc, fallbackName) {
      var nameToUse = fallbackName || loc.name;
      var parts = [nameToUse];
      if (loc.address && loc.address !== 'N/A') parts.push(loc.address);
      else if (loc.city && loc.city !== 'N/A') parts.push(loc.city);
      if (loc.state && loc.state !== 'US') parts.push(loc.state);
      return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(parts.join(', '));
    }

    function getSheetTabUrl(item) {
      var spreadsheetId = '1VnQcAcYE0LPmmmAIXCSH71V_RTUIZbW6';
      var base = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit';
      if (item.sheetGid !== undefined && item.sheetGid !== null && item.sheetGid !== '') {
        return base + '?gid=' + encodeURIComponent(item.sheetGid) + '#gid=' + encodeURIComponent(item.sheetGid);
      }
      var knownGids = {
        'Depletions MEMPHIS August 2026': '1482511010',
        'Depletions Nashville August 2026': '182741548',
        'Blanco August 2026': '0',
        'Reposado August 2026': '125139031',
        'Customers CHATANOOGA August 2026': '119284759',
        'Store Locator': '0',
        'July 2026 NY-NJ': '789123456'
      };
      if (item.tabName && knownGids[item.tabName]) {
        return base + '?gid=' + knownGids[item.tabName] + '#gid=' + knownGids[item.tabName];
      }
      return base + '?usp=sharing';
    }

    filtered.forEach(function (loc, index) {
      var lat = parseFloat(loc.latitude);
      var lng = parseFloat(loc.longitude);
      var latLng = (!isNaN(lat) && !isNaN(lng)) ? [lat, lng] : null;
      var tName = loc._cleanTabName || getTabName(loc);
      var addressHtml = formatLocationAddress(loc);
      var tabUrl = getSheetTabUrl(loc);
      
      var cleanName = escapeHtml(loc.name || '').replace(/\s*#\d+/g, '').trim();
      if (!cleanName || /^\d+(\.\d+)?$/.test(cleanName) || cleanName.toLowerCase() === 'total' || cleanName.toLowerCase().indexOf('total') === 0) {
        if (loc.bottlings && loc.bottlings !== 'Casa Mexico Tequila') {
          cleanName = escapeHtml(loc.bottlings);
        } else if (loc.territory || loc.tabName) {
          cleanName = escapeHtml(loc.territory || loc.tabName);
        } else {
          cleanName = 'Casa Mexico Location';
        }
      }

      var directionsUrl = buildDirectionsUrl(loc, cleanName);
      var storeId = loc.id || loc.placeId || 'N/A';

      if (latLng) {
        bounds.extend(latLng);

        var marker = L.marker(latLng, { title: cleanName });
        var popupHtml = '<div class="cmx-leaflet-popup">' +
          '<div class="cmx-popup-title">' + cleanName + '</div>' +
          '<div class="cmx-popup-address"><strong>📍 Address:</strong> ' + addressHtml + '</div>' +
          (loc.bottlings ? '<div class="cmx-bottlings-tag" style="margin-top:0.35rem;">🍸 <strong>Product:</strong> ' + escapeHtml(loc.bottlings) + '</div>' : '') +
          (loc.cases ? '<div class="cmx-cases-badge" style="margin-top:0.35rem;">📦 <strong>Sales:</strong> ' + loc.cases + ' Cases</div>' : '') +
          (loc.date ? '<div style="margin-top:0.3rem; font-size:0.8rem; color:#64748b;">📅 <strong>Date:</strong> ' + escapeHtml(loc.date) + '</div>' : '') +
          (loc.phone ? '<div class="cmx-popup-meta">📞 <strong>Phone:</strong> <a href="tel:' + escapeHtml(loc.phone) + '">' + escapeHtml(loc.phone) + '</a></div>' : '') +
          '<a href="' + directionsUrl + '" target="_blank" rel="noopener" class="cmx-popup-btn" style="margin-top:0.6rem;">Get Directions 🗺️</a>' +
          '</div>';

        marker.bindPopup(popupHtml);
        markersGroup.addLayer(marker);
        locationMarkers.push({ id: loc.id || index, marker: marker, location: loc });
      }

      // Render Sidebar Card
      if (sidebarContainer) {
        var card = document.createElement('div');
        card.className = 'cmx-store-card';
        card.setAttribute('data-index', index);

        var typeBadgeClass = loc.type === 'retail' ? 'cmx-badge-retail' : 'cmx-badge-bar-restaurant';
        var typeBadgeLabel = loc.type === 'retail' ? 'Retail' : 'Bar & Restaurant';

        card.innerHTML =
          '<div class="cmx-store-header" style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; margin-bottom:0.4rem;">' +
            '<div class="cmx-store-title" style="font-size:1.05rem; font-weight:700; color:#0f172a; line-height:1.35;">' + cleanName + '</div>' +
            '<span class="cmx-badge ' + typeBadgeClass + '" style="flex-shrink:0;">' + typeBadgeLabel + '</span>' +
          '</div>' +
          '<div class="cmx-card-fields" style="display:flex; flex-direction:column; gap:0.35rem; font-size:0.82rem; color:#475569; line-height:1.4;">' +
            '<div style="display:flex; align-items:flex-start; gap:0.35rem;">' +
              '<span style="flex-shrink:0;">📍</span>' +
              '<span><strong style="color:#1e293b;">Address:</strong> ' + addressHtml + '</span>' +
            '</div>' +
            (loc.bottlings ? '<div style="display:flex; align-items:flex-start; gap:0.35rem;"><span style="flex-shrink:0;">🍸</span><span><strong style="color:#0284c7;">Product:</strong> ' + escapeHtml(loc.bottlings) + '</span></div>' : '') +
            (loc.cases ? '<div style="display:flex; align-items:center; gap:0.35rem;"><span style="flex-shrink:0;">📦</span><span><strong style="color:#059669;">Sales:</strong> <span style="background:rgba(16,185,129,0.12); color:#059669; padding:0.1rem 0.45rem; border-radius:4px; font-weight:700;">' + loc.cases + ' Cases</span></span></div>' : '') +
            (loc.date ? '<div style="display:flex; align-items:center; gap:0.35rem;"><span style="flex-shrink:0;">📅</span><span><strong style="color:#334155;">Date:</strong> ' + escapeHtml(loc.date) + '</span></div>' : '') +
            (loc.distributor ? '<div style="display:flex; align-items:flex-start; gap:0.35rem;"><span style="flex-shrink:0;">🚚</span><span><strong style="color:#334155;">Distributor:</strong> ' + escapeHtml(loc.distributor) + '</span></div>' : '') +
          '</div>' +
          '<div class="cmx-store-details" style="margin-top:0.6rem; padding-top:0.5rem; border-top:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">' +
            (loc.phone ? '<span class="cmx-store-phone">📞 <a href="tel:' + escapeHtml(loc.phone) + '">' + escapeHtml(loc.phone) + '</a></span>' : '<span style="font-size:0.75rem; color:#94a3b8; font-family:monospace;">ID: ' + escapeHtml(storeId) + '</span>') +
            '<span class="cmx-store-directions"><a href="' + directionsUrl + '" target="_blank" rel="noopener">Directions 🗺️</a></span>' +
          '</div>';

        if (latLng) {
          card.addEventListener('click', function () {
            document.querySelectorAll('.cmx-store-card').forEach(function (c) { c.classList.remove('cmx-active'); });
            card.classList.add('cmx-active');
            map.setView(latLng, 15, { animate: true });
            var found = locationMarkers.find(function (m) { return m.id === (loc.id || index); });
            if (found && found.marker) found.marker.openPopup();
          });
        }

        sidebarContainer.appendChild(card);
      }
    });

    setTimeout(function () {
      if (map) {
        map.invalidateSize();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [15, 15], maxZoom: 14 });
        }
      }
    }, 150);
  }

  function renderTable(filtered) {
    var tableBody = document.getElementById('cmx-table-body');
    var tableWrap = document.getElementById('cmx-table-view');
    if (!tableBody) return;

    var existingPagination = document.getElementById('cmx-table-pagination');
    if (existingPagination) existingPagination.remove();

    if (filtered.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" class="cmx-no-results">No store records matching search criteria.</td></tr>';
      return;
    }

    var totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var startIndex = (currentPage - 1) * itemsPerPage;
    var endIndex = startIndex + itemsPerPage;
    var pageItems = filtered.slice(startIndex, endIndex);

    var html = '';
    pageItems.forEach(function (loc) {
      var typeBadgeClass = loc.type === 'retail' ? 'cmx-badge-retail' : 'cmx-badge-bar-restaurant';
      var typeBadgeLabel = loc.type === 'retail' ? 'Retail' : 'Bar & Restaurant';
      var parts = [loc.name];
      if (loc.address && loc.address !== 'N/A') parts.push(loc.address);
      else if (loc.city && loc.city !== 'N/A') parts.push(loc.city);
      if (loc.state && loc.state !== 'US') parts.push(loc.state);
      var directionsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(parts.join(', '));
      var tName = loc._cleanTabName || getTabName(loc);
      var cityStateStr = [loc.city, loc.state].filter(function(x) { return x && x !== 'N/A' && x !== 'US'; }).join(', ') + (loc.postalCode ? ' ' + escapeHtml(loc.postalCode) : '');

      html += '<tr>' +
        '<td><strong>' + escapeHtml(loc.name) + '</strong></td>' +
        '<td>' + escapeHtml(loc.address || '—') + '</td>' +
        '<td>' + (cityStateStr ? escapeHtml(cityStateStr) : '—') + '</td>' +
        '<td><span class="cmx-badge ' + typeBadgeClass + '">' + typeBadgeLabel + '</span></td>' +
        '<td><span class="cmx-bottlings-tag">' + escapeHtml(loc.bottlings || 'N/A') + '</span></td>' +
        '<td>' + (loc.cases ? '<strong>📦 ' + loc.cases + '</strong>' : '-') + '</td>' +
        '<td><span class="cmx-tab-pill">' + escapeHtml(tName) + '</span></td>' +
        '<td><a href="' + directionsUrl + '" target="_blank" rel="noopener" class="cmx-table-btn">Directions 🗺️</a></td>' +
        '</tr>';
    });

    tableBody.innerHTML = html;

    // Render Pagination Bar
    if (tableWrap) {
      var pagBar = document.createElement('div');
      pagBar.id = 'cmx-table-pagination';
      pagBar.className = 'cmx-pagination-bar';
      pagBar.innerHTML =
        '<div class="cmx-pagination-info">Showing Page <strong>' + currentPage + '</strong> of <strong>' + totalPages + '</strong> (' + filtered.length + ' stores)</div>' +
        '<div class="cmx-pagination-controls">' +
          '<label style="margin-right:0.3rem;">Per Page:</label>' +
          '<select id="cmx-per-page-select" class="cmx-page-size-select">' +
            '<option value="15"' + (itemsPerPage === 15 ? ' selected' : '') + '>15</option>' +
            '<option value="25"' + (itemsPerPage === 25 ? ' selected' : '') + '>25</option>' +
            '<option value="50"' + (itemsPerPage === 50 ? ' selected' : '') + '>50</option>' +
            '<option value="100"' + (itemsPerPage === 100 ? ' selected' : '') + '>100</option>' +
          '</select>' +
          '<button type="button" id="cmx-prev-btn" class="cmx-page-btn"' + (currentPage <= 1 ? ' disabled' : '') + '>◄ Previous</button>' +
          '<button type="button" id="cmx-next-btn" class="cmx-page-btn"' + (currentPage >= totalPages ? ' disabled' : '') + '>Next ►</button>' +
        '</div>';
      tableWrap.appendChild(pagBar);

      var prevBtn = document.getElementById('cmx-prev-btn');
      var nextBtn = document.getElementById('cmx-next-btn');
      var perPageSelect = document.getElementById('cmx-per-page-select');

      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          if (currentPage > 1) {
            currentPage--;
            renderMapAndSidebar();
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          if (currentPage < totalPages) {
            currentPage++;
            renderMapAndSidebar();
          }
        });
      }

      if (perPageSelect) {
        perPageSelect.addEventListener('change', function () {
          itemsPerPage = parseInt(this.value, 10) || 25;
          currentPage = 1;
          renderMapAndSidebar();
        });
      }
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLocatorMap);
  } else {
    initLocatorMap();
  }
}());
