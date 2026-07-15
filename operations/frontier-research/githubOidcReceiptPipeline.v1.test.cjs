'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const dir = __dirname;
if (!fs.existsSync(path.join(dir, 'githubOidcJwtVerifier.v1.cjs'))) {
  throw new Error('copy dependencies beside test before execution');
}
const { buildGitHubOidcBoundReceipt, DISCOVERY_URL } = require('./githubOidcReceiptPipeline.v1.cjs');

function fixture(overrides = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  jwk.kid = 'key-1'; jwk.kty = 'RSA'; jwk.alg = 'RS256'; jwk.use = 'sig';
  const now = 2000000000;
  const claims = {
    iss: 'https://token.actions.githubusercontent.com', aud: 'mirror-cartographer-evidence-v1',
    repository: 'MirrorCartographer/mirror-cartographer-ui', repository_id: '12345',
    workflow_ref: 'MirrorCartographer/mirror-cartographer-ui/.github/workflows/evidence.yml@refs/heads/main',
    workflow_sha: 'a'.repeat(40), run_id: '9001', run_attempt: '1', runner_environment: 'github-hosted',
    jti: 'unique-token-id', iat: now - 10, nbf: now - 10, exp: now + 300,
    ...overrides.claims
  };
  const header = Buffer.from(JSON.stringify({ alg:'RS256', kid:'key-1', typ:'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
  const token = `${header}.${payload}.${sig}`;
  const calls=[];
  const fetch_impl = async (url, options={}) => {
    calls.push({url, options});
    if (url === DISCOVERY_URL) return {ok:true,json:async()=>({issuer:claims.iss,jwks_uri:'https://token.actions.githubusercontent.com/.well-known/jwks'})};
    if (url === 'https://token.actions.githubusercontent.com/.well-known/jwks') return {ok:true,json:async()=>({keys:[jwk]})};
    if (String(url).startsWith('https://token.actions.githubusercontent.com/request?')) return {ok:true,json:async()=>({value:token})};
    return {ok:false,json:async()=>({})};
  };
  return {
    input: {
      fetch_impl, request_url:'https://token.actions.githubusercontent.com/request', request_token:'x'.repeat(32),
      audience:claims.aud,
      expected:{repository:claims.repository,repository_id:claims.repository_id,commit_sha:claims.workflow_sha,workflow_ref:claims.workflow_ref,run_id:claims.run_id,run_attempt:claims.run_attempt,runner_environment:claims.runner_environment,observed_at_epoch:now,challenge_receipt_sha256:'b'.repeat(64),capability_transcript_sha256:'c'.repeat(64),hostname_transcript_sha256:'d'.repeat(64)}
    }, calls
  };
}

test('builds token-free exact-run receipt after discovery, JWKS, and RS256 verification', async()=>{
  const f=fixture(); const out=await buildGitHubOidcBoundReceipt(f.input);
  assert.equal(out.verified,true); assert.equal(out.token_retained,false); assert.equal(out.token_value_emitted,false);
  assert.equal(out.receipt.workflow_sha,'a'.repeat(40)); assert.equal('value' in out,false);
  assert.equal(f.calls.length,3); assert.match(f.calls[2].url,/audience=mirror-cartographer-evidence-v1/);
  assert.equal(f.calls[2].options.headers.authorization,`bearer ${'x'.repeat(32)}`);
});

test('rejects non-GitHub token request host before network access', async()=>{
  const f=fixture(); f.input.request_url='https://evil.example/request';
  const out=await buildGitHubOidcBoundReceipt(f.input);
  assert.equal(out.verified,false); assert.deepEqual(out.violations,['token_request:host_mismatch']); assert.equal(f.calls.length,0);
});

test('rejects discovery issuer substitution before token request', async()=>{
  const f=fixture(); f.input.fetch_impl=async(url)=>({ok:true,json:async()=>url===DISCOVERY_URL?{issuer:'https://evil.example',jwks_uri:'https://token.actions.githubusercontent.com/.well-known/jwks'}:{keys:[]}});
  const out=await buildGitHubOidcBoundReceipt(f.input);
  assert.equal(out.verified,false); assert.deepEqual(out.violations,['discovery:issuer_mismatch']);
});

test('rejects workflow SHA mismatch after valid cryptographic verification', async()=>{
  const f=fixture(); f.input.expected.commit_sha='e'.repeat(40);
  const out=await buildGitHubOidcBoundReceipt(f.input);
  assert.equal(out.verified,false); assert.deepEqual(out.violations,['binding:oidc:workflow_sha_mismatch']);
});

test('rejects token response without value', async()=>{
  const f=fixture(); const original=f.input.fetch_impl;
  f.input.fetch_impl=async(url,options)=>String(url).startsWith('https://token.actions.githubusercontent.com/request?')?{ok:true,json:async()=>({})}:original(url,options);
  const out=await buildGitHubOidcBoundReceipt(f.input);
  assert.equal(out.verified,false); assert.deepEqual(out.violations,['token_response:value_missing']);
});

test('rejects missing id-token authorization material', async()=>{
  const f=fixture(); f.input.request_token='';
  const out=await buildGitHubOidcBoundReceipt(f.input);
  assert.equal(out.verified,false); assert.deepEqual(out.violations,['token_request:authorization_missing']); assert.equal(f.calls.length,0);
});
