import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'index.dev.html');
const dst = path.join(root, 'index.html');

if (!fs.existsSync(src)) {
  throw new Error(`Missing ${src} (expected Vite source index).`);
}

fs.copyFileSync(src, dst);
