const fs = require('node:fs');
const path = require('node:path');

const scriptsDirectory = path.join(__dirname, '..', 'apps-script');
for (const file of fs.readdirSync(scriptsDirectory).filter((name) => name.endsWith('.gs'))) {
  new Function(fs.readFileSync(path.join(scriptsDirectory, file), 'utf8'));
  process.stdout.write(`ok  ${file}\n`);
}

JSON.parse(fs.readFileSync(path.join(scriptsDirectory, 'appsscript.json'), 'utf8'));
process.stdout.write('ok  appsscript.json\n');
