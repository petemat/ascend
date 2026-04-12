import fs from 'node:fs';
import path from 'node:path';

// Workaround: ensure silhouette asset exists in dist/assets even if the bundler skips emitting it.
// The JS bundle references a hashed filename; we read it from the built JS and copy the source.

const root = process.cwd();
const distAssets = path.join(root, 'dist', 'assets');

function findJsBundle() {
  const files = fs.readdirSync(distAssets).filter((f) => /^index-.*\.js$/.test(f));
  if (!files.length) throw new Error('No JS bundle found in dist/assets');
  return path.join(distAssets, files[0]);
}

function ensureSilhouette() {
  const jsPath = findJsBundle();
  const js = fs.readFileSync(jsPath, 'utf8');
  const m = js.match(/silhouette-[A-Za-z0-9_-]+\.jpg/);
  if (!m) return; // nothing to do
  const targetName = m[0];
  const targetPath = path.join(distAssets, targetName);
  if (fs.existsSync(targetPath)) return;

  const src = path.join(root, 'src', 'assets', 'silhouette.jpg');
  if (!fs.existsSync(src)) throw new Error(`Missing source silhouette: ${src}`);

  fs.copyFileSync(src, targetPath);
}

ensureSilhouette();
