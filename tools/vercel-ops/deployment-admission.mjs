import crypto from 'node:crypto';

const APP_PREFIXES = ['app/', 'src/', 'public/', 'components/', 'pages/', 'styles/'];
const CONFIG_PATHS = new Set(['vercel.json', 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'next.config.js', 'next.config.mjs', 'vite.config.js', 'vite.config.mjs']);
const OPS_PREFIXES = ['operations/', 'tools/vercel-ops/', 'docs/operations/'];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function normalizePaths(paths) {
  if (!Array.isArray(paths)) return [];
  return [...new Set(paths.filter((p) => typeof p === 'string').map((p) => p.trim()).filter(Boolean))].sort();
}

function classifyPath(path) {
  if (CONFIG_PATHS.has(path)) return 'configuration';
  if (APP_PREFIXES.some((prefix) => path.startsWith(prefix))) return 'application';
  if (OPS_PREFIXES.some((prefix) => path.startsWith(prefix))) return 'operations';
  if (path.startsWith('.github/')) return 'workflow';
  return 'unknown';
}

export function evaluateDeploymentAdmission(input = {}) {
  const current = input.current_state || {};
  const changedPaths = normalizePaths(input.changed_paths);
  const classifications = changedPaths.map((path) => ({ path, kind: classifyPath(path) }));
  const kinds = new Set(classifications.map((entry) => entry.kind));
  const failures = [];

  if (current.active_delivery_item !== 'V-001') failures.push('unexpected_active_delivery_item');
  if (!['in_progress', 'in_progress_blocked'].includes(current.delivery_state)) failures.push('unsupported_delivery_state');
  if (changedPaths.length === 0) failures.push('changed_paths_empty');

  const capacityBlocked = current.delivery_state === 'in_progress_blocked'
    || /build-rate limit|capacity/i.test(current.observed_blocker || '');
  const operationsOnly = changedPaths.length > 0 && classifications.every((entry) => entry.kind === 'operations');
  const ambiguous = kinds.has('unknown') || kinds.has('workflow');
  const applicationAffecting = kinds.has('application') || kinds.has('configuration') || ambiguous;

  let decision = 'deny';
  let reason = 'fail_closed';

  if (failures.length === 0 && capacityBlocked && operationsOnly) {
    decision = 'allow_operations_only_sentinel';
    reason = 'capacity_blocked_operations_only';
  } else if (failures.length === 0 && !capacityBlocked && operationsOnly) {
    decision = 'allow_operations_only_sentinel';
    reason = 'operations_only';
  } else if (failures.length === 0 && !capacityBlocked && applicationAffecting && input.exact_commit_verification === true) {
    decision = 'allow_single_exact_commit_deployment';
    reason = 'capacity_available_exact_commit';
  } else if (capacityBlocked && applicationAffecting) {
    reason = 'capacity_blocked_application_affecting';
  } else if (!input.exact_commit_verification && applicationAffecting) {
    reason = 'exact_commit_verification_required';
  }

  const payload = stable({
    schema_version: 1,
    active_delivery_item: current.active_delivery_item ?? null,
    delivery_state: current.delivery_state ?? null,
    capacity_blocked: capacityBlocked,
    changed_paths: changedPaths,
    classifications,
    exact_commit_verification: input.exact_commit_verification === true,
    decision,
    reason,
    failures
  });

  return Object.freeze({
    valid: failures.length === 0,
    admitted: decision !== 'deny',
    decision,
    reason,
    capacity_blocked: capacityBlocked,
    operations_only: operationsOnly,
    classifications: Object.freeze(classifications),
    failures: Object.freeze(failures),
    evidence_digest: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    rollback_route: 'Remove this gate from the caller or revert its additive commit; no deployment or application state is mutated by evaluation.',
    claim_boundary: 'This gate authorizes an attempt category from repository state and changed paths. It does not prove provider capacity, Vercel skip behavior, deployment success, served commit identity, or audio audibility.'
  });
}
