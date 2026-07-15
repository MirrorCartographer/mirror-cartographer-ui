'use strict';
const crypto = require('node:crypto');
const ISSUER = 'https://token.actions.githubusercontent.com';
function b64urlJson(part, label) {
  try { return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')); }
  catch { throw new Error(`jwt:${label}_invalid`); }
}
function fail(violations) { return { verified:false, violations:[...new Set(violations)].sort(), claims:null, header:null, signature_verification:'rejected' }; }
function verifyGitHubOidcJwt(input) {
  const v=[]; const token=input&&input.token; const jwks=input&&input.jwks;
  const audience=input&&input.audience; const observed=input&&input.observed_at_epoch;
  if (typeof token !== 'string') return fail(['jwt:token_missing']);
  const parts=token.split('.'); if(parts.length!==3) return fail(['jwt:compact_serialization_invalid']);
  let header, claims; try { header=b64urlJson(parts[0],'header'); claims=b64urlJson(parts[1],'claims'); } catch(e) { return fail([e.message]); }
  if(header.alg!=='RS256') v.push('jwt:algorithm_not_rs256');
  if(typeof header.kid!=='string'||!header.kid) v.push('jwt:kid_missing');
  if(!jwks||!Array.isArray(jwks.keys)) return fail([...v,'jwks:keys_missing']);
  const matches=jwks.keys.filter(k=>k&&k.kid===header.kid&&k.kty==='RSA');
  if(matches.length!==1) v.push(matches.length?'jwks:kid_ambiguous':'jwks:kid_not_found');
  if(claims.iss!==ISSUER) v.push('jwt:issuer_mismatch');
  const aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(typeof audience!=='string'||!aud.includes(audience)) v.push('jwt:audience_mismatch');
  if(!Number.isInteger(observed)) v.push('jwt:observed_at_invalid');
  if(!Number.isInteger(claims.iat)||!Number.isInteger(claims.exp)||claims.exp<=claims.iat) v.push('jwt:time_window_invalid');
  if(Number.isInteger(observed)&&Number.isInteger(claims.iat)&&observed<claims.iat) v.push('jwt:not_yet_issued');
  if(Number.isInteger(observed)&&Number.isInteger(claims.nbf)&&observed<claims.nbf) v.push('jwt:not_before');
  if(Number.isInteger(observed)&&Number.isInteger(claims.exp)&&observed>claims.exp) v.push('jwt:expired');
  if(matches.length===1&&header.alg==='RS256') {
    try {
      const key=crypto.createPublicKey({key:matches[0],format:'jwk'});
      const ok=crypto.verify('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),key,Buffer.from(parts[2],'base64url'));
      if(!ok) v.push('jwt:signature_invalid');
    } catch { v.push('jwks:key_invalid'); }
  }
  if(v.length) return fail(v);
  return {verified:true,violations:[],claims,header:{alg:header.alg,kid:header.kid,typ:header.typ||null},signature_verification:'externally_verified',claim_boundary:'github_oidc_rs256_signature_issuer_audience_and_time_window_only_no_runner_or_content_integrity_claim'};
}
module.exports={verifyGitHubOidcJwt,ISSUER};
