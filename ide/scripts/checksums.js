const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distDir = path.join(__dirname, '..', 'dist');
const outPath = path.join(distDir, 'checksums.txt');

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

if (!fs.existsSync(distDir)) {
  console.error('dist folder not found. Run a build first.');
  process.exit(1);
}

const files = fs.readdirSync(distDir)
  .filter((f) => !fs.statSync(path.join(distDir, f)).isDirectory())
  .filter((f) => !f.endsWith('.blockmap'))
  .sort();

const lines = files.map((f) => `${sha256(path.join(distDir, f))}  ${f}`);

fs.writeFileSync(outPath, `${lines.join('\n')}\n`);

console.log(`Wrote ${outPath}`);