import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash, sign } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeAuthorizedReconciliation, verifySignedAuthorization } from './fia-cas-authority-dispatcher.mjs';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function sha256(v){return `sha256:${createHash('sha256').update(v).digest('hex')}`;}
async function fixture(operation='publish') {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'fia-dispatch-'));
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const pub=publicKey.export({type:'spki',format:'pem'}); const pubPath=path.join(root,'pub.pem'); await fs.writeFile(pubPath,pub);
  const lock={operation,contentIdentity:'sha256:lock',operationalId:'lock-1'}; const lockPath=path.join(root,'lock.json'); await fs.writeFile(lockPath,JSON.stringify(lock));
  const action=operation==='publish'?'reconcile-publisher':'reconcile-reachability';
  const authority={schema:'foundation.build.cas-authority-takeover-authorization.v2',nonce:'n-1',issuedAt:'2026-07-21T09:00:00.000Z',expiresAt:'2026-07-21T09:15:00.000Z',publicKeySha256:sha256(pub),lockContentIdentity:lock.contentIdentity,lockOperationalId:lock.operationalId,interruptedOperation:operation,reconciliationAction:action,scope:{claimedObjectDigests:['sha256:abc']},policy:{providerNeutral:true}};
  const auth={...authority,identity:`sha256:${createHash('sha256').update(canonical(authority)).digest('hex')}`,signature:sign(null,Buffer.from(canonical(authority)),privateKey).toString('base64')};
  const authorizationPath=path.join(root,'auth.json'); await fs.writeFile(authorizationPath,JSON.stringify(auth));
  return {root,auth,privateKey,authorizationPath,publicKeyPath:pubPath,lockPath,intentPath:path.join(root,'intent.json'),nonceDir:path.join(root,'nonces'),evidencePath:path.join(root,'evidence.json'),now:Date.parse('2026-07-21T09:05:00.000Z')};
}

test('verifies Ed25519 authorization and exact retained lock binding',async()=>{const f=await fixture();const v=await verifySignedAuthorization(f);assert.equal(v.auth.identity,f.auth.identity);assert.equal(v.lock.operation,'publish');});

test('executes only operation-bound dispatcher and independently confirms mutation',async()=>{const f=await fixture();let dispatched=0,inspected=0;const out=await executeAuthorizedReconciliation({...f,dispatchers:{'reconcile-publisher':async()=>{dispatched++;return{ok:true,identity:'sha256:state'};}},inspectors:{'reconcile-publisher':async()=>{inspected++;return{complete:true,identity:'sha256:state'};}}});assert.equal(dispatched,1);assert.equal(inspected,1);assert.equal(out.verification.postMutationInspection,true);});

test('rejects a valid-looking authorization signed by another key',async()=>{const f=await fixture();const other=generateKeyPairSync('ed25519');f.auth.signature=sign(null,Buffer.from(canonical({...f.auth,identity:undefined,signature:undefined})),other.privateKey).toString('base64');await fs.writeFile(f.authorizationPath,JSON.stringify(f.auth));await assert.rejects(verifySignedAuthorization(f),/signature invalid/);});

test('rejects retained lock substitution',async()=>{const f=await fixture();await fs.writeFile(f.lockPath,JSON.stringify({operation:'publish',contentIdentity:'sha256:other',operationalId:'lock-1'}));await assert.rejects(verifySignedAuthorization(f),/does not bind retained lock/);});

test('rejects dispatcher false success when observed authority differs',async()=>{const f=await fixture();await assert.rejects(executeAuthorizedReconciliation({...f,dispatchers:{'reconcile-publisher':async()=>({ok:true,identity:'sha256:claimed'})},inspectors:{'reconcile-publisher':async()=>({complete:true,identity:'sha256:actual'})}}),/differs from independently observed authority/);});

test('rejects action that does not match interrupted operation even when correctly signed',async()=>{const f=await fixture();const authority={...f.auth,reconciliationAction:'reconcile-reachability'};delete authority.identity;delete authority.signature;f.auth={...authority,identity:`sha256:${createHash('sha256').update(canonical(authority)).digest('hex')}`,signature:sign(null,Buffer.from(canonical(authority)),f.privateKey).toString('base64')};await fs.writeFile(f.authorizationPath,JSON.stringify(f.auth));await assert.rejects(verifySignedAuthorization(f),/action does not match interrupted operation/);});
