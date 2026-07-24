import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`${relativePath}: ${error.message}`);
  }
};

const manifest = readJson('stewards/braid/manifest.json');
const queue = readJson('stewards/braid/queue.json');
const errors = [];
const allowedRelationships = new Set(['extends', 'repairs', 'consumes', 'independent']);
const allowedStages = new Set(['research', 'resources', 'art', 'build', 'integration']);
const allowedStatuses = new Set(['ready', 'active', 'blocked', 'deferred', 'accepted', 'rejected']);

if (manifest.schema_version !== '1.0.0') errors.push('manifest schema_version must be 1.0.0');
if (queue.schema_version !== '1.0.0') errors.push('queue schema_version must be 1.0.0');
if (!Array.isArray(manifest.leases)) errors.push('manifest leases must be an array');
if (!Array.isArray(queue.tasks)) errors.push('queue tasks must be an array');

const tasks = Array.isArray(queue.tasks) ? queue.tasks : [];
const ids = new Set();
for (const task of tasks) {
  if (!task || typeof task !== 'object') {
    errors.push('every queue task must be an object');
    continue;
  }
  if (!task.id || typeof task.id !== 'string') errors.push('every task requires a string id');
  else if (ids.has(task.id)) errors.push(`duplicate task id: ${task.id}`);
  else ids.add(task.id);
  if (!allowedRelationships.has(task.relationship)) errors.push(`${task.id ?? 'unknown'}: invalid relationship`);
  if (!allowedStages.has(task.stage)) errors.push(`${task.id ?? 'unknown'}: invalid stage`);
  if (!allowedStatuses.has(task.status)) errors.push(`${task.id ?? 'unknown'}: invalid status`);
  if (!Array.isArray(task.dependencies)) errors.push(`${task.id ?? 'unknown'}: dependencies must be an array`);
  if (!Array.isArray(task.acceptance_criteria) || task.acceptance_criteria.length === 0) {
    errors.push(`${task.id ?? 'unknown'}: acceptance_criteria must be non-empty`);
  }
  if (task.privacy_class !== 'public-safe') errors.push(`${task.id ?? 'unknown'}: privacy_class must be public-safe`);
}

const leases = Array.isArray(manifest.leases) ? manifest.leases : [];
const now = Date.now();
const activeLeases = leases.filter((lease) => {
  const expiry = Date.parse(lease.expires_at);
  if (!Number.isFinite(expiry)) {
    errors.push(`${lease.task_id ?? 'unknown'}: lease expires_at must be ISO-8601`);
    return false;
  }
  return expiry > now;
});
for (const lease of activeLeases) {
  if (!ids.has(lease.task_id)) errors.push(`${lease.task_id ?? 'unknown'}: lease references missing queue task`);
  if (!allowedStages.has(lease.stage)) errors.push(`${lease.task_id ?? 'unknown'}: lease stage is invalid`);
}

const implementationLeases = activeLeases.filter((lease) => lease.stage === 'build').length;
if (implementationLeases > (manifest.wip_limits?.implementation_leases ?? 1)) {
  errors.push(`active implementation leases exceed limit: ${implementationLeases}`);
}
const activeNonImplementation = tasks.filter((task) => task.status === 'active' && task.stage !== 'build').length;
if (activeNonImplementation > (manifest.wip_limits?.non_implementation_tasks ?? 3)) {
  errors.push(`active non-implementation tasks exceed limit: ${activeNonImplementation}`);
}

if (errors.length > 0) {
  console.error('Braid control plane validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Braid control plane valid: ${tasks.length} task(s), ${activeLeases.length} active lease(s).`);
