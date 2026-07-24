import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const allowedRelationships = new Set(['extends', 'repairs', 'consumes', 'independent']);
const allowedStages = new Set(['research', 'resources', 'art', 'build', 'integration']);
const allowedStatuses = new Set(['ready', 'active', 'blocked', 'deferred', 'accepted', 'rejected']);

export function validateBraid({ manifest, queue, handoffs = [], now = Date.now() }) {
  const errors = [];
  if (manifest?.schema_version !== '1.0.0') errors.push('manifest schema_version must be 1.0.0');
  if (queue?.schema_version !== '1.0.0') errors.push('queue schema_version must be 1.0.0');
  if (!Array.isArray(manifest?.leases)) errors.push('manifest leases must be an array');
  if (!Array.isArray(queue?.tasks)) errors.push('queue tasks must be an array');

  const tasks = Array.isArray(queue?.tasks) ? queue.tasks : [];
  const taskById = new Map();
  for (const task of tasks) {
    if (!task || typeof task !== 'object') { errors.push('every queue task must be an object'); continue; }
    if (!task.id || typeof task.id !== 'string') errors.push('every task requires a string id');
    else if (taskById.has(task.id)) errors.push(`duplicate task id: ${task.id}`);
    else taskById.set(task.id, task);
    if (!allowedRelationships.has(task.relationship)) errors.push(`${task.id ?? 'unknown'}: invalid relationship`);
    if (!allowedStages.has(task.stage)) errors.push(`${task.id ?? 'unknown'}: invalid stage`);
    if (!allowedStatuses.has(task.status)) errors.push(`${task.id ?? 'unknown'}: invalid status`);
    if (!Array.isArray(task.dependencies)) errors.push(`${task.id ?? 'unknown'}: dependencies must be an array`);
    if (!Array.isArray(task.acceptance_criteria) || task.acceptance_criteria.length === 0) errors.push(`${task.id ?? 'unknown'}: acceptance_criteria must be non-empty`);
    if (task.privacy_class !== 'public-safe') errors.push(`${task.id ?? 'unknown'}: privacy_class must be public-safe`);
  }

  for (const task of tasks) for (const dependency of task.dependencies ?? []) {
    if (!taskById.has(dependency)) errors.push(`${task.id}: missing dependency ${dependency}`);
  }
  const visiting = new Set(); const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) { errors.push(`dependency cycle includes ${id}`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of taskById.get(id)?.dependencies ?? []) if (taskById.has(dep)) visit(dep);
    visiting.delete(id); visited.add(id);
  };
  for (const id of taskById.keys()) visit(id);

  const leases = Array.isArray(manifest?.leases) ? manifest.leases : [];
  const activeLeases = [];
  const leaseCount = new Map();
  for (const lease of leases) {
    const task = taskById.get(lease.task_id);
    const acquired = Date.parse(lease.acquired_at);
    const renewed = Date.parse(lease.renewed_at);
    const expiry = Date.parse(lease.expires_at);
    if (!task) errors.push(`${lease.task_id ?? 'unknown'}: lease references missing queue task`);
    if (!lease.holder || typeof lease.holder !== 'string') errors.push(`${lease.task_id ?? 'unknown'}: lease holder is required`);
    if (!Number.isInteger(lease.fencing_token) || lease.fencing_token < 1) errors.push(`${lease.task_id ?? 'unknown'}: positive integer fencing_token is required`);
    if (![acquired, renewed, expiry].every(Number.isFinite)) errors.push(`${lease.task_id ?? 'unknown'}: lease timestamps must be ISO-8601`);
    else if (!(acquired <= renewed && renewed < expiry)) errors.push(`${lease.task_id ?? 'unknown'}: lease timestamps must satisfy acquired_at <= renewed_at < expires_at`);
    if (task && lease.stage !== task.stage) errors.push(`${lease.task_id}: lease stage must match task stage`);
    if (expiry > now) {
      activeLeases.push(lease);
      leaseCount.set(lease.task_id, (leaseCount.get(lease.task_id) ?? 0) + 1);
    }
  }
  for (const [taskId, count] of leaseCount) if (count !== 1) errors.push(`${taskId}: active task must have exactly one active lease`);
  for (const task of tasks) {
    const count = leaseCount.get(task.id) ?? 0;
    if (task.status === 'active' && count !== 1) errors.push(`${task.id}: active task requires exactly one active lease`);
    if (task.status !== 'active' && count > 0) errors.push(`${task.id}: active lease requires task status active`);
  }

  const taskStates = manifest?.task_states ?? {};
  for (const [id, state] of Object.entries(taskStates)) {
    const task = taskById.get(id);
    if (!task) errors.push(`${id}: task_states references missing queue task`);
    else if (state !== task.status) errors.push(`${id}: task_states contradicts queue status`);
  }
  const buildLeases = activeLeases.filter((lease) => lease.stage === 'build').length;
  if (buildLeases > (manifest?.wip_limits?.implementation_leases ?? 1)) errors.push(`active implementation leases exceed limit: ${buildLeases}`);
  const nonBuildLeases = activeLeases.filter((lease) => lease.stage !== 'build').length;
  if (nonBuildLeases > (manifest?.wip_limits?.non_implementation_tasks ?? 3)) errors.push(`active non-implementation leases exceed limit: ${nonBuildLeases}`);

  for (const handoff of handoffs) {
    if (!taskById.has(handoff.task_id)) errors.push(`${handoff.task_id ?? 'unknown'}: handoff references missing queue task`);
    const expiry = Date.parse(handoff.expires_at);
    if (!Number.isFinite(expiry)) errors.push(`${handoff.task_id ?? 'unknown'}: handoff expires_at must be ISO-8601`);
    else if (expiry <= now) errors.push(`${handoff.task_id}: expired handoff cannot satisfy braid gates`);
  }
  return errors;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  const manifest = readJson('stewards/braid/manifest.json');
  const queue = readJson('stewards/braid/queue.json');
  const errors = validateBraid({ manifest, queue });
  if (errors.length) {
    console.error('Braid control plane validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`Braid control plane valid: ${queue.tasks.length} task(s), ${manifest.leases.length} lease record(s).`);
}
