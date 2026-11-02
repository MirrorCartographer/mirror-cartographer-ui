import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { Script } from 'node:vm';

const atlasRoot = resolve('public/atlas');
const roomsRoot = join(atlasRoot, 'rooms');
const experiments = [
  '001-observatory','002-machine-garden','003-echo-cathedral','004-carnival-of-thought',
  '005-ocean','006-living-blueprint','007-dream-library','008-signal-forest',
  '009-impossible-museum','010-composer',
];
const required = [
  'index.html','archive.html',
  'rooms/index.html','rooms/mind/index.html','rooms/chatgpt/index.html',
  'rooms/experiments/index.html','rooms/experiments/engine.js','rooms/experiments/shared.css',
  'rooms/music/index.html','rooms/worlds/unreliable-observatory/index.html',
  ...experiments.map((slug) => 'rooms/experiments/' + slug + '/index.html'),
  'catalog-index.json','catalog-main.json','catalog-ui.json',
];
for (const path of required) {
  if (!existsSync(join(atlasRoot, path))) throw new Error('Missing room route or dependency: public/atlas/' + path);
}
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
  });
}
function resolveLocal(file, raw) {
  const value = raw.trim();
  if (!value || value.startsWith('#') || value.startsWith('%23') || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return null;
  const pathPart = value.split(/[?#]/, 1)[0];
  if (!pathPart) return null;
  let decoded;
  try { decoded = decodeURIComponent(pathPart); }
  catch { throw new Error('Invalid URL encoding: ' + relative(atlasRoot, file) + ' -> ' + raw); }
  const target = decoded.startsWith('/') ? resolve(atlasRoot, '.' + decoded) : resolve(dirname(file), decoded);
  const rel = relative(atlasRoot, target);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    throw new Error('Local reference escapes atlas: ' + relative(atlasRoot, file) + ' -> ' + raw);
  }
  const candidates = [];
  if (existsSync(target) && statSync(target).isDirectory()) candidates.push(join(target, 'index.html'));
  candidates.push(target);
  if (!extname(target)) candidates.push(join(target, 'index.html'));
  const found = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  if (!found) throw new Error('Broken local reference: ' + relative(atlasRoot, file) + ' -> ' + raw);
  return found;
}
const htmlFiles = [join(atlasRoot, 'index.html'), join(atlasRoot, 'archive.html'), ...walk(roomsRoot).filter((path) => extname(path).toLowerCase() === '.html')];
let checkedReferences = 0;
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const refs = [
    ...[...html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]),
    ...[...html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((match) => match[1]),
  ];
  for (const ref of refs) if (resolveLocal(file, ref)) checkedReferences += 1;
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) throw new Error('Duplicate IDs in ' + relative(atlasRoot, file) + ': ' + [...new Set(duplicates)].join(', '));
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1]) || /\btype\s*=\s*["']module["']/.test(match[1])) continue;
    new Script(match[2], { filename: relative(atlasRoot, file) + ':inline-script' });
  }
}
for (const file of walk(roomsRoot).filter((path) => extname(path) === '.js')) {
  new Script(readFileSync(file, 'utf8'), { filename: relative(atlasRoot, file) });
}
const home = readFileSync(join(atlasRoot, 'index.html'), 'utf8');
for (const id of ['sound-toggle','surprise','rain','bloom','erase','intensity','still','search','category']) {
  if (!home.includes('id="' + id + '"')) throw new Error('Missing home interaction: ' + id);
}
const music = readFileSync(join(roomsRoot, 'music/index.html'), 'utf8');
for (const id of ['sound','play','stop','random','clear','ambience','tempo','voice','space']) {
  if (!music.includes('id="' + id + '"')) throw new Error('Missing music control: ' + id);
}
console.log(JSON.stringify({
  result: 'PASS',
  experimentRoutes: experiments.length,
  htmlRoutes: htmlFiles.length,
  localReferencesChecked: checkedReferences,
  javascriptSyntax: 'PASS',
  catalogDependencies: 3,
  accessibleControls: 'PASS',
}, null, 2));
