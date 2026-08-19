const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT_DIR = path.join(__dirname, '..');
execFileSync('node', [path.join(ROOT_DIR, 'scripts', 'build-live-sheet.js')], { stdio: 'inherit' });

