'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyPaginationProvenance, digest } = require('./verifyPaginationProvenance.v1.cjs');
const sha = 'a'.repeat(40);
function page(n, runs, next = null) { return { page:n, next, workflow_runs:runs, response_sha256:digest(runs) }; }
function base() { return { request:{ endpoint:'/repos/{owner}/{repo}/actions/runs', head_sha:sha, per_page:100, api_version:'2022-11-28' }, pages:[page(1,[{id:1,head_sha:sha}])], reported_total_count:1, retrieval_complete:true }; }
test('accepts coherent terminal pagination evidence',()=>assert.equal(verifyPaginationProvenance(base()).verified,true));
test('rejects missing intermediate next link',()=>{ const x=base(); x.pages=[page(1,[{id:1,head_sha:sha}]),page(2,[])]; assert.match(verifyPaginationProvenance(x).reasons.join(','),/missing_next_link/); });
test('rejects terminal next link',()=>{ const x=base(); x.pages[0].next='url'; assert.match(verifyPaginationProvenance(x).reasons.join(','),/terminal_page_has_next_link/); });
test('rejects cross-commit records',()=>{ const x=base(); x.pages=[page(1,[{id:1,head_sha:'b'.repeat(40)}])]; assert.match(verifyPaginationProvenance(x).reasons.join(','),/cross_commit_run/); });
test('rejects digest tampering',()=>{ const x=base(); x.pages[0].response_sha256='0'.repeat(64); assert.match(verifyPaginationProvenance(x).reasons.join(','),/page_digest_mismatch/); });
test('rejects provider ceiling ambiguity',()=>{ const x=base(); const runs=Array.from({length:1000},(_,i)=>({id:i+1,head_sha:sha})); x.pages=Array.from({length:10},(_,i)=>page(i+1,runs.slice(i*100,(i+1)*100),i<9?'url':null)); x.reported_total_count=1000; assert.match(verifyPaginationProvenance(x).reasons.join(','),/provider_ceiling_ambiguity/); });
