// hurufi-from-flat.mjs — prepares Hurufi for Render.
// If the repository has its folders (public/index.html exists), nothing changes.
// If the files were uploaded without folders (for example from an iPhone),
// it copies each one into public/ with the folder layout the site expects.
//
// Render static site settings:
//   Build command:      node hurufi-from-flat.mjs
//   Publish directory:  public
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const here = process.cwd();

if (existsSync(path.join(here, 'public', 'index.html'))) {
  console.log('[hurufi] folders found — nothing to arrange, publishing public/');
  process.exit(0);
}

// [file in the repository, where the site expects it, optional?]
const FILES = [
  ['.gitkeep', 'public/audio/instructions/.gitkeep', true],
  ['README.txt', 'public/audio/kurdish/README.txt', true],
  ['style.css', 'public/css/style.css', false],
  ['arabic.json', 'public/data/arabic.json', false],
  ['courses.json', 'public/data/courses.json', false],
  ['kurdish.json', 'public/data/kurdish.json', false],
  ['quran-text.json', 'public/data/quran-text.json', false],
  ['quran.json', 'public/data/quran.json', false],
  ['icon-192.png', 'public/icons/icon-192.png', false],
  ['icon-512.png', 'public/icons/icon-512.png', false],
  ['icon-maskable-512.png', 'public/icons/icon-maskable-512.png', false],
  ['index.html', 'public/index.html', false],
  ['app.js', 'public/js/app.js', false],
  ['compare.js', 'public/js/compare.js', false],
  ['content.js', 'public/js/content.js', false],
  ['lesson.js', 'public/js/lesson.js', false],
  ['sounds.js', 'public/js/sounds.js', false],
  ['speech.js', 'public/js/speech.js', false],
  ['storage.js', 'public/js/storage.js', false],
  ['manifest.webmanifest', 'public/manifest.webmanifest', false],
  ['sw.js', 'public/sw.js', false],
];

const missing = [];
let copied = 0;
for (const [flat, target, optional] of FILES) {
  const from = path.join(here, flat);
  if (!existsSync(from)) { if (!optional) missing.push(flat); continue; }
  const to = path.join(here, target);
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to);
  copied++;
}
// Keep the audio folders even if their placeholder files weren't uploaded.
mkdirSync(path.join(here, 'public/audio/kurdish'), { recursive: true });
mkdirSync(path.join(here, 'public/audio/instructions'), { recursive: true });

if (missing.length) {
  console.error('[hurufi] These site files are missing from the repository: ' + missing.join(', '));
  process.exit(1);
}
console.log(`[hurufi] arranged ${copied} files into public/`);
