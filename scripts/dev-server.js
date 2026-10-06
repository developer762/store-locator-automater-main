const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..');
const EXCEL_PATH = path.join(ROOT_DIR, 'examples', 'casa-mexico-store-locator-feed-july-2026.xlsx');

// Load Apps Script context
function createAppsScriptContext() {
  const context = {
    console,
    LOCATOR_CONFIG: {
      sheetName: 'Store Locator Feed',
      cacheSeconds: 300,
      requiredHeaders: [
        'Locator Name'
      ]
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest: (algorithm, value) => {
        const hash = crypto.createHash('sha256').update(value).digest();
        return Array.from(hash);
      }
    }
  };
  vm.createContext(context);

  const configCode = fs.readFileSync(path.join(ROOT_DIR, 'apps-script', 'Config.gs'), 'utf8');
  const feedCode = fs.readFileSync(path.join(ROOT_DIR, 'apps-script', 'Feed.gs'), 'utf8');
  
  vm.runInContext(configCode, context);
  vm.runInContext(feedCode, context);
  return context;
}

// Extract rows from Excel file using Python stdlib zipfile/xml
function parseExcelWorkbook(filePath) {
  const pyCode = `
import json, sys, zipfile, xml.etree.ElementTree as ET

xlsx_path = sys.argv[1]
z = zipfile.ZipFile(xlsx_path)

strings = []
try:
    sst_tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
    for si in sst_tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
        t = si.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
        if t is not None:
            strings.append(t.text or '')
        else:
            ts = si.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
            strings.append(''.join([x.text or '' for x in ts]))
except Exception:
    pass

sheet_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
rows_data = []
for row in sheet_tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
    row_vals = []
    for c in row.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
        val_elem = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
        val = val_elem.text if val_elem is not None else ''
        t_type = c.attrib.get('t')
        if t_type == 's' and val != '':
            try:
                val = strings[int(val)]
            except IndexError:
                pass
        row_vals.append(val)
    rows_data.append(row_vals)

print(json.dumps(rows_data))
`;
  const output = execFileSync('python3', ['-c', pyCode, filePath], { encoding: 'utf8' });
  return JSON.parse(output);
}

let cachedPayload = null;

function generateFeedPayload() {
  const rawRows = parseExcelWorkbook(EXCEL_PATH);
  const appsContext = createAppsScriptContext();
  const result = appsContext.normalizeRows_(rawRows);
  
  cachedPayload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    spreadsheetId: 'local-workbook-july-2026',
    sheetName: 'Store Locator Feed',
    count: result.locations.length,
    skipped: result.skipped,
    locations: result.locations,
    rawRowCount: rawRows.length - 1
  };
  return cachedPayload;
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers for local dev testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoint: /api/feed or /exec (Apps Script feed simulator)
  if (pathname === '/api/feed' || pathname === '/exec') {
    try {
      const refresh = parsedUrl.query.refresh === '1' || parsedUrl.query.nocache === '1' || parsedUrl.query.fresh === '1';
      if (!cachedPayload || refresh) {
        generateFeedPayload();
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(JSON.stringify(cachedPayload, null, 2));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ schemaVersion: 1, error: true, message: err.message }));
    }
    return;
  }

  // API Endpoint: /api/raw-stats (Full workbook statistics)
  if (pathname === '/api/raw-stats') {
    try {
      const rawRows = parseExcelWorkbook(EXCEL_PATH);
      const headers = rawRows[0] || [];
      const statusIdx = headers.indexOf('Publish Status');
      const latIdx = headers.indexOf('Latitude');
      const lngIdx = headers.indexOf('Longitude');

      let readyCount = 0;
      let awaitingGeocodeCount = 0;
      let excludedCount = 0;

      rawRows.slice(1).forEach(r => {
        const st = String(r[statusIdx] || '').trim();
        const hasPin = String(r[latIdx] || '').trim() && String(r[lngIdx] || '').trim();
        if (/^ready\b/i.test(st)) {
          if (hasPin) readyCount++;
          else awaitingGeocodeCount++;
        } else {
          excludedCount++;
        }
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        totalWorkbookRows: rawRows.length - 1,
        readyPublished: readyCount,
        awaitingGeocode: awaitingGeocodeCount,
        excluded: excludedCount,
        headers: headers
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static File Serving (from public/)
  let filePath = path.join(ROOT_DIR, 'public', pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(ROOT_DIR, 'public', 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n==================================================`);
  console.log(` Casa Mexico Store Locator Automater Local Server`);
  console.log(` Dashboard UI:  http://127.0.0.1:${PORT}`);
  console.log(` Feed API:      http://127.0.0.1:${PORT}/api/feed`);
  console.log(` Raw Stats API: http://127.0.0.1:${PORT}/api/raw-stats`);
  console.log(`==================================================\n`);
});
