import assert from 'node:assert/strict';
import fs from 'node:fs';

const policy = fs.readFileSync('src/engine/coPresenceBoundary.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/resident-dialogue/index.ts', 'utf8');
const world = fs.readFileSync('src/components/LivingWorld.jsx', 'utf8');

for (const flag of ['personhood','exclusive-bond','authority','destiny','diagnostic-claim']) {
  assert.ok(policy.includes("'" + flag + "'"), 'the boundary policy must classify ' + flag);
}
assert.ok(edge.includes('evaluateResidentOutput(reply)'), 'all generated resident text must pass through the boundary');
assert.ok(edge.includes('residentBoundaryFallback(residentKey)'), 'blocked replies must be replaced with a safe in-character fallback');
assert.ok(edge.includes("boundaryAction: boundary.action === 'block' ? 'softened' : 'allow'"), 'the response must report boundary intervention');
assert.ok(world.includes('FICTIONAL INHABITANTS · SCRIPTED OR AI-GENERATED DIALOGUE'), 'the scene must label character ontology');
assert.ok(world.includes('boundaryNotice'), 'the visitor must be told when a response was reframed');
console.log('PASS: co-presence ontology, agency, and post-generation boundary contract.');
