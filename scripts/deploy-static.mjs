import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const distAssets = path.join(dist, 'assets');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  throw new Error('dist/index.html not found. Run build first.');
}

// Deploy for Express static hosting (MCC serves /ascend from this folder)
const outIndex = path.join(root, 'index.html');
const outAssets = path.join(root, 'assets');

fs.copyFileSync(path.join(dist, 'index.html'), outIndex);
fs.rmSync(outAssets, { recursive: true, force: true });
fs.cpSync(distAssets, outAssets, { recursive: true });
