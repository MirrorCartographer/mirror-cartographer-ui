import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { compileTransaction } from './compile-owned-build-transaction.mjs';

const hash = (s) => createHash('sha256').update(s).digest('hex');
const canonical = (v) => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v);
function identified(record) { const x = structuredClone(record); x.identity = hash(canonical(x)); return x; }
async function fixture({ mismatch = false, stale = false, escape = false } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fia-transaction-'));
  const source = identified({ schema: 'fia.source.v1', commit: 'a'.repeat(40) });
  const buildBase = { schema: 'fia.build.v1', sourceCommit: mismatch ? 'b'.repeat(40) : source.commit, artifact: hash('artifact') };
  const build = identified(buildBase);
  if (stale) build.artifact = hash('tampered');
  await writeFile(path.join(dir, 'source.json'), JSON.stringify(source));
  await writeFile(path.join(dir, 'build.json'), JSON.stringify(build));
  const request = {
    schema: 'fia.owned-build-transaction-request.v1',
    artifacts: [
      { role: 'source', path: escape ? '../source.json' : 'source.json', expectedSchema: 'fia.source.v1' },
      { role: 'build', path: 'build.json', expectedSchema: 'fia.build.v1' }
    ],
    bindings: [{ fromRole: 'source', fromPointer: '/commit', toRole: 'build', toPointer: '/sourceCommit' }]
  };
  await writeFile(path.join(dir, 'request.json'), JSON.stringify(request));
  return { dir, request: path.join(dir, 'request.json'), output: path.join(dir, 'out.json') };
}

test('equivalent transactions produce identical identities', async () => {
  const a = await fixture(); const b = await fixture();
  const ra = await compileTransaction(a.request, a.output); const rb = await compileTransaction(b.request, b.output);
  assert.equal(ra.identity, rb.identity);
  assert.equal(ra.artifacts.length, 2);
});
test('cross-evidence mismatch fails closed', async () => {
  const f = await fixture({ mismatch: true });
  await assert.rejects(() => compileTransaction(f.request, f.output), /binding mismatch/);
});
test('stale logical identity is rejected', async () => {
  const f = await fixture({ stale: true });
  await assert.rejects(() => compileTransaction(f.request, f.output), /identity mismatch/);
});
test('schema mismatch is rejected', async () => {
  const f = await fixture();
  const request = JSON.parse(await readFile(f.request)); request.artifacts[0].expectedSchema = 'wrong';
  await writeFile(f.request, JSON.stringify(request));
  await assert.rejects(() => compileTransaction(f.request, f.output), /schema mismatch/);
});
test('path escape is rejected', async () => {
  const f = await fixture({ escape: true });
  await assert.rejects(() => compileTransaction(f.request, f.output), /escapes request directory/);
});
test('duplicate roles are rejected', async () => {
  const f = await fixture();
  const request = JSON.parse(await readFile(f.request)); request.artifacts[1].role = 'source';
  await writeFile(f.request, JSON.stringify(request));
  await assert.rejects(() => compileTransaction(f.request, f.output), /duplicate artifact role/);
});
test('retained evidence cannot be overwritten', async () => {
  const f = await fixture(); await writeFile(f.output, 'retain');
  await assert.rejects(() => compileTransaction(f.request, f.output), /EEXIST/);
  assert.equal(await readFile(f.output, 'utf8'), 'retain');
});
