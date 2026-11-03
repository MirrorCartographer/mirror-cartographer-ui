import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const html = readFileSync(new URL('../public/field-instruments/constellation.html', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
if (new Set(ids).size !== ids.length) throw new Error('Constellation contains duplicate HTML IDs');
for (const target of [...html.matchAll(/href="#([^"]+)"/g)].map(m => m[1])) {
  if (!ids.includes(target)) throw new Error('Broken constellation anchor: #' + target);
}
for (const required of ['id="field-bridge"', 'id="fieldBridgeEntries"', 'function renderFieldBridge', 'field-instruments-v1', 'href="./index.html"']) {
  if (!html.includes(required)) throw new Error('Missing constellation bridge feature: ' + required);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!scripts.length) throw new Error('No inline JavaScript found in constellation');
scripts.forEach((source, i) => {
  const path = join(tmpdir(), 'constellation-' + process.pid + '-' + i + '.js');
  writeFileSync(path, source);
  execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
});
console.log('Constellation bridge audit passed.');
