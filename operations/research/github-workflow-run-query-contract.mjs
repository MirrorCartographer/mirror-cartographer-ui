import crypto from 'node:crypto';

const SHA_RE = /^[0-9a-f]{40}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const API_VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(code, detail) {
  return { ok: false, code, detail };
}

export function assessWorkflowRunQueryContract(input, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('invalid_input', 'input must be an object');

  const {
    repository,
    head_sha: headSha,
    api_version: apiVersion,
    documented_api_version: documentedApiVersion,
    documentation_checked_on: checkedOn,
    per_page: perPage,
    pagination,
    command,
    source_url: sourceUrl,
  } = input;

  if (!/^[^/\s]+\/[^/\s]+$/.test(repository || '')) return fail('invalid_repository', 'repository must be owner/name');
  if (!SHA_RE.test(headSha || '')) return fail('invalid_head_sha', 'head_sha must be a lowercase 40-character commit SHA');
  if (!API_VERSION_RE.test(apiVersion || '')) return fail('invalid_api_version', 'api_version must be YYYY-MM-DD');
  if (!API_VERSION_RE.test(documentedApiVersion || '')) return fail('invalid_documented_api_version', 'documented_api_version must be YYYY-MM-DD');
  if (apiVersion !== documentedApiVersion) return fail('api_version_drift', 'retained command API version does not match the documented version checked for this contract');
  if (!ISO_DATE_RE.test(checkedOn || '')) return fail('invalid_documentation_date', 'documentation_checked_on must be YYYY-MM-DD');

  const checked = new Date(`${checkedOn}T00:00:00Z`);
  if (Number.isNaN(checked.getTime())) return fail('invalid_documentation_date', 'documentation_checked_on is not a real date');
  const ageDays = Math.floor((now.getTime() - checked.getTime()) / 86400000);
  const maxAgeDays = Number.isInteger(options.maxAgeDays) ? options.maxAgeDays : 30;
  if (ageDays < 0) return fail('future_documentation_date', 'documentation check date is in the future');
  if (ageDays > maxAgeDays) return fail('stale_documentation_contract', `documentation contract is ${ageDays} days old; maximum is ${maxAgeDays}`);

  if (perPage !== 100) return fail('non_maximal_page_size', 'per_page must be 100');
  if (pagination !== 'all_pages') return fail('incomplete_pagination', 'pagination must be all_pages');
  if (typeof sourceUrl !== 'string' || !sourceUrl.startsWith('https://docs.github.com/')) return fail('invalid_primary_source', 'source_url must be an official GitHub Docs URL');
  if (typeof command !== 'string' || command.trim() === '') return fail('missing_command', 'command must be retained');

  const requiredFragments = [
    `repos/${repository}/actions/runs`,
    `head_sha=${headSha}`,
    'per_page=100',
    '--paginate',
    '--slurp',
    `X-GitHub-Api-Version:${apiVersion}`,
  ];
  const missing = requiredFragments.filter((fragment) => !command.includes(fragment));
  if (missing.length) return fail('command_contract_mismatch', `missing command fragments: ${missing.join(', ')}`);

  const forbidden = ['event=pull_request', 'event=push', 'status=', 'branch='];
  const presentForbidden = forbidden.filter((fragment) => command.includes(fragment));
  if (presentForbidden.length) return fail('narrowed_event_coverage', `command contains forbidden narrowing filters: ${presentForbidden.join(', ')}`);

  const canonical = JSON.stringify({ repository, headSha, apiVersion, checkedOn, perPage, pagination, command, sourceUrl });
  return {
    ok: true,
    classification: 'query_contract_current_and_exhaustive_intent',
    contract_sha256: crypto.createHash('sha256').update(canonical).digest('hex'),
    evidence_strength: 'source_contract_only',
    claim_boundary: [
      'Does not prove authentication succeeded.',
      'Does not prove every API page was retrieved.',
      'Does not resolve the documented 1000-result search ceiling.',
      'Does not prove workflow, deployment, runtime, or human-observation outcomes.',
    ],
  };
}
