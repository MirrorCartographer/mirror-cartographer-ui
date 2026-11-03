import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const html = readFileSync(new URL('../public/field-instruments/index.html', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML IDs');
for (const target of [...html.matchAll(/href="#([^"]+)"/g)].map(m => m[1])) {
  if (!ids.includes(target)) throw new Error('Broken in-page anchor: #' + target);
}
for (const required of [
  'id="symbols"', 'id="dimensions"', 'id="consensus"', 'id="evidence"', 'id="veterans"',
  'id="translateSymbol"', 'id="runConsensus"', 'id="analyzeEvidence"', 'id="saveBarrier"',
  'dimensionData.push({id:101', '8774243838', 'https://www.va.gov/disability/',
  'https://www.va.gov/careers-employment/vocational-rehabilitation/',
  'localStorage.setItem("field-instruments-v1"', 'navigator.clipboard'
]) if (!html.includes(required)) throw new Error('Missing required feature: ' + required);
if (!html.includes('domains.forEach') || !html.includes('lenses.forEach')) throw new Error('100-dimension grid generator missing');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!scripts.length) throw new Error('No inline JavaScript found');
scripts.forEach((source, i) => {
  const path = join(tmpdir(), 'field-instruments-' + process.pid + '-' + i + '.js');
  writeFileSync(path, source);
  execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
});
console.log('Field Instruments static audit passed.');
