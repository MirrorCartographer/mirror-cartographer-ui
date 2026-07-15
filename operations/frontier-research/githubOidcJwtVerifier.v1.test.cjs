'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const crypto=require('node:crypto');
const {verifyGitHubOidcJwt,ISSUER}=require('./githubOidcJwtVerifier.v1.cjs');
const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=publicKey.export({format:'jwk'}); jwk.kid='k1'; jwk.alg='RS256'; jwk.use='sig';
function enc(v){return Buffer.from(JSON.stringify(v)).toString('base64url');}
function token(overrides={},headerOverrides={}){const h=enc({alg:'RS256',kid:'k1',typ:'JWT',...headerOverrides}); const p=enc({iss:ISSUER,aud:'urn:mirror-cartographer:oidc-evidence',iat:1000,nbf:1000,exp:1600,jti:'jti-12345678',repository:'MirrorCartographer/mirror-cartographer-ui',repository_id:'1',workflow_ref:'MirrorCartographer/mirror-cartographer-ui/.github/workflows/oidc.yml@refs/heads/main',workflow_sha:'a'.repeat(40),run_id:'2',run_attempt:'1',runner_environment:'github-hosted',...overrides}); const s=crypto.sign('RSA-SHA256',Buffer.from(`${h}.${p}`),privateKey).toString('base64url'); return `${h}.${p}.${s}`;}
const base={jwks:{keys:[jwk]},audience:'urn:mirror-cartographer:oidc-evidence',observed_at_epoch:1200};
test('accepts a valid RS256 GitHub OIDC token',()=>{const r=verifyGitHubOidcJwt({...base,token:token()}); assert.equal(r.verified,true); assert.equal(r.signature_verification,'externally_verified'); assert.equal(r.claims.workflow_sha,'a'.repeat(40));});
test('rejects a tampered payload',()=>{const t=token().split('.'); t[1]=enc({...JSON.parse(Buffer.from(t[1],'base64url')),run_id:'999'}); const r=verifyGitHubOidcJwt({...base,token:t.join('.')}); assert.deepEqual(r.violations,['jwt:signature_invalid']);});
test('rejects wrong audience',()=>{const r=verifyGitHubOidcJwt({...base,token:token({aud:'wrong'})}); assert.ok(r.violations.includes('jwt:audience_mismatch'));});
test('rejects expired token',()=>{const r=verifyGitHubOidcJwt({...base,observed_at_epoch:1700,token:token()}); assert.ok(r.violations.includes('jwt:expired'));});
test('rejects unknown signing key',()=>{const r=verifyGitHubOidcJwt({...base,jwks:{keys:[]},token:token()}); assert.ok(r.violations.includes('jwks:kid_not_found'));});
test('rejects non-RS256 header',()=>{const r=verifyGitHubOidcJwt({...base,token:token({}, {alg:'HS256'})}); assert.ok(r.violations.includes('jwt:algorithm_not_rs256'));});
