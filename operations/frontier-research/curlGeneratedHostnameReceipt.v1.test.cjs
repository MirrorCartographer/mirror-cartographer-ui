'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { adaptCurlGeneratedHostnameReceipt } = require('./curlGeneratedHostnameReceipt.v1.cjs');
const sha='a'.repeat(40), digest='b'.repeat(64), host='deploy-example.vercel.app';
const evidence={source_boundary:'verified_vercel_deployment_evidence_pipeline_v1',expected_commit_sha:sha,deployment_id:'dpl_123',generated_hostname:host,evidence_pipeline_sha256:digest};
const command=['curl','--silent','--show-error','--head','--max-redirs','0','--write-out','%{json}','--output','/dev/null',`https://${host}`];
const metrics={method:'HEAD',response_code:200,num_redirects:0,url_effective:`https://${host}/`,ssl_verify_result:0,time_total:0.125};
function run(patch={}){return adaptCurlGeneratedHostnameReceipt({verified_deployment_evidence:evidence,command,curl_exit_code:0,observed_at:'2026-07-15T21:30:00Z',curl_write_out_json:metrics,...patch});}
test('accepts a bounded curl HEAD receipt',()=>{const r=run();assert.equal(r.verified,true);assert.match(r.receipt.receipt_sha256,/^[0-9a-f]{64}$/);assert.equal(r.receipt.credentials_retained,false);});
test('rejects redirect-following flags',()=>{const r=run({command:[...command.slice(0,-1),'-L',command.at(-1)]});assert.equal(r.verified,false);assert.ok(r.violations.includes('command:redirect_following_forbidden'));});
test('rejects disabled TLS verification',()=>{const r=run({command:[...command.slice(0,-1),'--insecure',command.at(-1)]});assert.equal(r.verified,false);assert.ok(r.violations.includes('command:tls_verification_disabled'));});
test('rejects nonzero curl exit',()=>{const r=run({curl_exit_code:60});assert.equal(r.verified,false);assert.ok(r.violations.includes('curl:transfer_failed'));});
test('rejects URL divergence and redirects from metrics',()=>{const r=run({curl_write_out_json:{...metrics,url_effective:'https://example.com/',num_redirects:1}});assert.equal(r.verified,false);assert.ok(r.violations.some(v=>v.includes('final_url_mismatch')||v.includes('redirects_present')));});
test('digest is stable for JSON key order',()=>{const a=run();const reordered={time_total:0.125,ssl_verify_result:0,url_effective:`https://${host}/`,num_redirects:0,response_code:200,method:'HEAD'};const b=run({curl_write_out_json:reordered});assert.equal(a.receipt.receipt_sha256,b.receipt.receipt_sha256);});
