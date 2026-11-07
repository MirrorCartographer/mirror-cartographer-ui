import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runJob } from './worker.mjs';

const digest = 'sha256:' + 'a'.repeat(64);
function fixture(script = "import fs from 'node:fs'; fs.mkdirSync('dist',{recursive:true}); fs.writeFileSync('dist/out.txt', [process.env.TZ,process.env.SOURCE_DATE_EPOCH,process.env.VERCEL].join('|'));") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'fia-worker-'));
  fs.writeFileSync(path.join(root,'build.mjs'),script);
  fs.writeFileSync(path.join(root,'job.json'), JSON.stringify({schema:'fia.worker-job.v1',job_id:'job-1',workspace:'.',command:[process.execPath,'build.mjs'],outputs:['dist'],source_digest:digest}));
  return root;
}
test('executes in normalized provider-neutral environment',()=>{
  const root=fixture(); const r=runJob(path.join(root,'job.json'));
  assert.equal(r.exit_code,0); assert.match(fs.readFileSync(path.join(root,'dist/out.txt'),'utf8'),/^UTC\|0\|$/);
});
test('equivalent jobs produce identical stable receipt digest',()=>{
  const a=fixture(), b=fixture();
  assert.equal(runJob(path.join(a,'job.json')).receipt_digest, runJob(path.join(b,'job.json')).receipt_digest);
});
test('rejects output path escape',()=>{
  const root=fixture(); const p=path.join(root,'job.json'); const j=JSON.parse(fs.readFileSync(p)); j.outputs=['../escape']; fs.writeFileSync(p,JSON.stringify(j));
  assert.throws(()=>runJob(p),/escapes workspace/);
});
test('rejects missing declared output',()=>{
  const root=fixture("console.log('no output')"); assert.throws(()=>runJob(path.join(root,'job.json')),/declared output missing/);
});
test('rejects output symlink',()=>{
  const root=fixture("import fs from 'node:fs'; fs.writeFileSync('real','x'); fs.symlinkSync('real','dist');"); assert.throws(()=>runJob(path.join(root,'job.json')),/symlink rejected/);
});
test('fails closed on non-zero command',()=>{
  const root=fixture("process.exit(7)"); assert.throws(()=>runJob(path.join(root,'job.json')),/exit code 7/);
});
