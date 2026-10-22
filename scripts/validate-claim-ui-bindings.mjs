#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const [registerPath, htmlPath] = process.argv.slice(2);
if (!registerPath || !htmlPath) {
  throw new Error('Usage: node validate-claim-ui-bindings.mjs <claim-register.json> <research-atlas.html>');
}
const register = JSON.parse(readFileSync(registerPath, 'utf8'));
const html = readFileSync(htmlPath, 'utf8');
const block = html.match(/const claimAnchors=\{([\s\S]*?)\};\s*Object\.entries/);
if (!block) throw new Error('The interactive page must declare its claimAnchors mapping.');
const bindings = [...block[1].matchAll(/(\w+):\{claimId:"([^"]+)",claimStatus:"([^"]+)"\}/g)]
  .map((match) => ({ node: match[1], claimId: match[2], status: match[3] }));
if (bindings.length !== 8) throw new Error(`Expected 8 claim bindings, found ${bindings.length}.`);
const nodeIds = [...html.matchAll(/data-node="([^"]+)"/g)].map((match) => match[1]);
const boundNodes = bindings.map((item) => item.node);
assert.deepEqual([...boundNodes].sort(), [...nodeIds].sort(), 'every relationship node must have exactly one claim binding');
if (new Set(boundNodes).size !== boundNodes.length) throw new Error('Duplicate relationship-node claim binding.');
const claims = new Map(register.claims.map((claim) => [claim.id, claim]));
for (const binding of bindings) {
  const claim = claims.get(binding.claimId);
  if (!claim) throw new Error(`${binding.node} references missing claim ${binding.claimId}.`);
  if (claim.status !== binding.status) {
    throw new Error(`${binding.node} status drift: interface says ${binding.status}, register says ${claim.status} for ${binding.claimId}.`);
  }
}
if (!html.includes('claim-register.json')) throw new Error('The instrument must link back to the canonical claim register.');
console.log(JSON.stringify({
  result: 'PASS',
  claimBindings: bindings.length,
  uniqueNodes: boundNodes.length,
  registerClaims: register.claims.length,
  statusParity: true,
  canonicalRegisterLink: true,
}, null, 2));
