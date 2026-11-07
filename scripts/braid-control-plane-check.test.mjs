import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBraid } from './braid-control-plane-check.mjs';

const NOW = Date.parse('2026-07-24T06:30:00Z');
const task = (id, overrides = {}) => ({ id, title: id, priority: 1, relationship: 'repairs', stage: 'integration', status: 'ready', dependencies: [], acceptance_criteria: ['measurable'], privacy_class: 'public-safe', ...overrides });
const lease = (taskId, overrides = {}) => ({ task_id: taskId, stage: 'integration', holder: 'integration-1', fencing_token: 1, acquired_at: '2026-07-24T06:00:00Z', renewed_at: '2026-07-24T06:10:00Z', expires_at: '2026-07-24T07:00:00Z', ...overrides });
const state = (tasks = [task('BRAID-001')], leases = [], taskStates = {}) => ({
  manifest: { schema_version: '1.0.0', wip_limits: { implementation_leases: 1, non_implementation_tasks: 3 }, leases, task_states: taskStates },
  queue: { schema_version: '1.0.0', tasks },
  now: NOW
});
const rejects = (name, fixture, pattern) => test(name, () => assert.match(validateBraid(fixture).join('\n'), pattern));

// Valid baseline.
test('accepts a valid acyclic single-owner fixture', () => {
  const active = task('BRAID-001', { status: 'active' });
  assert.deepEqual(validateBraid(state([active], [lease(active.id)], { [active.id]: 'active' })), []);
});

rejects('rejects missing dependency', state([task('BRAID-001', { dependencies: ['BRAID-404'] })]), /missing dependency/);
rejects('rejects dependency cycle', state([task('BRAID-001', { dependencies: ['BRAID-002'] }), task('BRAID-002', { dependencies: ['BRAID-001'] })]), /dependency cycle/);
rejects('rejects two active leases for one task', state([task('BRAID-001', { status: 'active' })], [lease('BRAID-001'), lease('BRAID-001', { holder: 'integration-2', fencing_token: 2 })]), /exactly one active lease/);
rejects('rejects lease stage mismatch', state([task('BRAID-001', { status: 'active' })], [lease('BRAID-001', { stage: 'build' })]), /lease stage must match/);
rejects('rejects active task with no lease', state([task('BRAID-001', { status: 'active' })]), /active task requires exactly one/);
rejects('rejects active lease on ready task', state([task('BRAID-001')], [lease('BRAID-001')]), /active lease requires task status active/);
rejects('rejects invalid lease temporal order', state([task('BRAID-001', { status: 'active' })], [lease('BRAID-001', { renewed_at: '2026-07-24T07:10:00Z' })]), /lease timestamps must satisfy/);
rejects('rejects invalid fencing token', state([task('BRAID-001', { status: 'active' })], [lease('BRAID-001', { fencing_token: 0 })]), /fencing_token/);
rejects('rejects task_states entry for missing task', state([task('BRAID-001')], [], { 'BRAID-404': 'active' }), /task_states references missing/);
rejects('rejects expired handoff', { ...state(), handoffs: [{ task_id: 'BRAID-001', expires_at: '2026-07-24T06:00:00Z' }] }, /expired handoff/);
