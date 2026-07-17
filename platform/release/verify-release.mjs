#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const [policyPath, manifestPath, artifactPath, rootsPath, previousPath] = process.argv.slice(2);
if (!policyPath || !manifestPath || !artifactPath || !rootsPath) {
  console.error('usage: verify-release.mjs POLICY MANIFEST ARTIFACT TRUSTED_ROOTS [PREVIOUS_MANIFEST]');
  process.exit(2);
}

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const policy = readJson(policyPath);
const envelope = readJson(manifestPath);
const roots = readJson(rootsPath);
const artifact = fs.readFileSync(artifactPath);
const previous = previousPath ? readJson(previousPath) : null;
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const checks = [];
const check = (name, ok) => checks.push({name, ok: Boolean(ok)});

check('release policy schema', policy.schema === 'foundation.release-policy.v1');
check('envelope schema', envelope.schema === 'foundation.release-envelope.v1');
check('signed payload present', envelope.signed && typeof envelope.signed === 'object');
check('signatures present', Array.isArray(envelope.signatures));

const r = envelope.signed ?? {};
check('release manifest schema', r.schema === 'foundation.release-manifest.v1');
check('recognized environment', policy.promotion.environments.includes(r.environment));
check('positive sequence', Number.isInteger(r.sequence) && r.sequence > 0);
check('source commit pinned', /^[0-9a-f]{40}$/.test(r.source_commit ?? ''));
check('build recipe digest pinned', /^sha256:[0-9a-f]{64}$/.test(r.build_recipe_digest ?? ''));
check('builder identity recorded', typeof r.builder_id === 'string' && r.builder_id.length >= 3);
check('reproducibility status recorded', ['reproduced','single-build','mismatch'].includes(r.reproducibility));
check('reproducibility mismatch blocks promotion', r.reproducibility !== 'mismatch');
check('artifact digest format', /^sha256:[0-9a-f]{64}$/.test(r.artifact?.digest ?? ''));
check('artifact length recorded', Number.isInteger(r.artifact?.length) && r.artifact.length >= 0);
check('artifact digest matches bytes', r.artifact?.digest === `sha256:${digest(artifact)}`);
check('artifact length matches bytes', r.artifact?.length === artifact.length);
check('independent custody copies', Array.isArray(r.custody) && r.custody.length >= policy.artifact_custody.minimum_independent_copies);
check('custody failure domains', new Set((r.custody ?? []).map(x => x.failure_domain)).size >= policy.artifact_custody.minimum_failure_domains);
check('custody entries immutable', (r.custody ?? []).every(x => x.uri && x.digest === r.artifact?.digest && x.mutable !== true));

const issued = Date.parse(r.issued_at);
const expires = Date.parse(r.expires_at);
const maxValidity = policy.promotion.maximum_validity_days * 86400000;
check('valid release timestamps', Number.isFinite(issued) && Number.isFinite(expires) && expires > issued);
check('release validity bounded', expires - issued <= maxValidity);
check('release not expired', expires > Date.now());

if (previous) {
  const p = previous.signed ?? {};
  check('monotonic sequence', r.sequence === p.sequence + 1);
  check('previous manifest digest chain', r.previous_manifest_digest === `sha256:${digest(fs.readFileSync(previousPath))}`);
} else {
  check('genesis release sequence', r.sequence === 1);
  check('genesis chain marker', r.previous_manifest_digest === null);
}

const payload = Buffer.from(JSON.stringify(r));
const trusted = new Map((roots.keys ?? []).map(k => [k.keyid, k]));
const valid = [];
for (const sig of envelope.signatures ?? []) {
  const key = trusted.get(sig.keyid);
  if (!key || key.algorithm !== 'ed25519') continue;
  try {
    if (crypto.verify(null, payload, key.public_key_pem, Buffer.from(sig.signature, 'base64'))) {
      valid.push({keyid: sig.keyid, operator: key.operator, online: key.online === true});
    }
  } catch {}
}
const uniqueKeys = new Map(valid.map(v => [v.keyid, v]));
const uniqueOperators = new Set([...uniqueKeys.values()].map(v => v.operator));
check('signature threshold', uniqueKeys.size >= policy.release_authority.minimum_signatures);
check('distinct operator threshold', uniqueOperators.size >= policy.release_authority.minimum_distinct_operators);
check('online key cannot satisfy authority alone', !policy.release_authority.online_key_may_satisfy_threshold_alone ? [...uniqueKeys.values()].some(v => !v.online) : true);
check('mutable tags non-authoritative', policy.release_authority.mutable_tags_are_authoritative === false);
check('hosted registry not sole custody', policy.artifact_custody.hosted_registry_as_sole_copy_forbidden === true);
check('source host not sole ledger', policy.artifact_custody.source_host_as_sole_release_ledger_forbidden === true);

for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}`);
const failed = checks.filter(c => !c.ok);
if (failed.length) {
  console.error(`REJECT ${failed.length} release invariants failed`);
  process.exit(1);
}
console.log(`ACCEPT ${checks.length} release invariants`);
