import assert from 'node:assert/strict';
import fs from 'node:fs';

const world = fs.readFileSync('src/components/LivingWorld.jsx', 'utf8');
const service = fs.readFileSync('src/services/sharedWorld.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/resident-dialogue/index.ts', 'utf8');
const policy = fs.readFileSync('src/engine/residentResponsePolicy.js', 'utf8');

assert.ok(world.includes('askResident(residentKey, message, { cue: responseCue, intensity: responseIntensity, history })'), 'resident messages must carry the current bounded scene cue');
assert.ok(world.includes('residentHistory[residentKey]'), 'each resident must have a separate conversation thread');
assert.ok(world.includes(".slice(-8)"), 'browser conversation history must be bounded');
assert.ok(world.includes("setResidentHistory({ tazar:[], jello:[] })"), 'conversation history must clear when the authenticated account changes');
assert.ok(world.includes('setResponseIntensity(response.intensity)'), 'the scene response policy must pass bounded intensity to the agent');
assert.ok(service.includes('perception: { cue, intensity }'), 'the browser bridge must send only a normalized scene cue');
assert.ok(service.includes('history.slice(-8)'), 'the browser bridge must bound conversation history');
assert.ok(service.includes("['user', 'assistant'].includes(item.role)"), 'the browser bridge must reject system or unknown history roles');
assert.ok(service.includes('content.slice(0, 600)'), 'each prior turn must have a strict character limit');
assert.ok(service.includes('includeMemory: isPrivateMemorySyncEnabled()'), 'private continuity must be opt-in');
assert.ok(edge.includes("authorization.startsWith('Bearer ')"), 'the inference function must require an authenticated session');
assert.ok(edge.includes('supabase.auth.getUser(token)'), 'the inference function must verify the bearer token');
assert.ok(edge.includes('allowedCues.has(requestedCue)'), 'the inference function must allowlist scene cues');
assert.ok(edge.includes('Math.max(0, Math.min(1, payload.perception!.intensity!))'), 'scene intensity must be clamped');
assert.ok(edge.includes("item.role === 'user' || item.role === 'assistant'"), 'the inference function must reject injected system roles');
assert.ok(edge.includes("payload.history.slice(-8)"), 'the inference function must bound history to eight turns');
assert.ok(edge.includes("item.content!.trim().slice(0, 600)"), 'the inference function must bound prior message size');
assert.ok(edge.includes('...history,'), 'the model must receive the bounded in-session conversation context');
assert.ok(edge.includes('Current scene cue (bounded'), 'the model must receive a provenance-labelled environmental cue');
assert.ok(edge.includes('Do not infer emotion, health, identity, intent, or personality from sensory signals.'), 'sensory cues must not become psychological claims');
assert.ok(edge.includes('transcriptStored: false'), 'the inference function must explicitly report that it stores no transcript');
assert.ok(!/\.from\(['"]continuity_records['"]\)\s*\.insert|\.upsert/i.test(edge), 'the dialogue function must not persist conversation turns');
assert.ok(policy.includes("observation.kind === 'pointer-stillness'"), 'stillness must become a bounded scene cue');
assert.ok(policy.includes("observation.kind === 'pointer-leave'"), 'leaving must become a bounded scene cue');
assert.ok(policy.includes("observation.kind === 'window-focus' && observation.value === true"), 'returning focus must become a bounded scene cue');

console.log('PASS: authenticated resident inference, bounded sensory context, ephemeral conversation history, and no transcript persistence.');
