import { readFileSync } from 'node:fs';
import { isCredentialLikeFile, isPrivateCatalogPath } from './atlas-privacy-policy.mjs';

const root = new URL('../public/atlas/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('catalog-index.json', root), 'utf8'));
const expected = new Map([
  ['MirrorCartographer/MirrorCartographer', 'catalog-main.json'],
  ['MirrorCartographer/mirror-cartographer-ui', 'catalog-ui.json'],
]);
const generated = new Set([
  'public/atlas/catalog-main.json',
  'public/atlas/catalog-ui.json',
  'public/atlas/catalog-index.json',
]);
function fail(message) {
  throw new Error('Atlas catalog validation failed: ' + message);
}

if (index.schema_version !== 1) fail('unsupported catalog index schema');
if (!Array.isArray(index.sources) || index.sources.length !== expected.size) fail('expected two source manifests');
if (index.source_count !== expected.size) fail('source_count mismatch');
if (!Array.isArray(index.generated_catalogs_excluded)
  || [...generated].some((path) => !index.generated_catalogs_excluded.includes(path))) {
  fail('generated catalog exclusion list is incomplete');
}

let total = 0;
let checked = 0;
for (const source of index.sources) {
  if (expected.get(source.repo) !== source.file) fail('unexpected source repository or manifest file');
  if (!/^[0-9a-f]{40}$/i.test(source.source_commit || '')) fail('invalid source commit identity');
  if (!/^[0-9a-f]{40}$/i.test(source.tree_sha || '')) fail('invalid source tree identity');

  const manifest = JSON.parse(readFileSync(new URL(source.file, root), 'utf8'));
  if (manifest.schema_version !== 1) fail('unsupported manifest schema');
  if (manifest.repository !== source.repo || manifest.branch !== 'main') fail('manifest repository or branch mismatch');
  if (manifest.source_commit !== source.source_commit || manifest.tree_sha !== source.tree_sha) fail('manifest provenance mismatch');
  if (!Array.isArray(manifest.items) || manifest.file_count !== manifest.items.length
    || manifest.file_count !== source.file_count) fail('manifest file count mismatch');
  if (!Number.isInteger(manifest.excluded_file_count) || manifest.excluded_file_count < 0) fail('invalid excluded file count');

  const seen = new Set();
  for (const item of manifest.items) {
    if (typeof item.path !== 'string' || !item.path || typeof item.sha !== 'string'
      || !/^[0-9a-f]{40}$/i.test(item.sha)) fail('invalid catalog item');
    if (item.path.startsWith('/') || item.path.includes('\\')
      || item.path.split('/').some((part) => part === '.' || part === '..')) fail('unsafe catalog path');
    if (isPrivateCatalogPath(item.path) || isCredentialLikeFile(item.path)) fail('private or credential-like path was indexed');
    if (generated.has(item.path)) fail('generated catalog was indexed');
    if (seen.has(item.path)) fail('duplicate catalog path');
    seen.add(item.path);
    checked += 1;
  }
  total += manifest.items.length;
}

if (total !== index.file_count) fail('catalog total mismatch');

console.log(JSON.stringify({
  result: 'PASS',
  sourceRepositories: index.source_count,
  indexedFiles: total,
  validatedItems: checked,
  privacyPathLeaks: 0,
  sourceCommitAndTreeIdentity: 'PASS',
}, null, 2));
