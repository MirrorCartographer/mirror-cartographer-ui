const VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function assessGitHubApiCommandContract({ command, requestedVersion }) {
  const reasons = [];

  if (typeof command !== 'string' || !command.trim()) {
    return {
      schemaVersion: 1,
      verified: false,
      requestedVersion: requestedVersion || null,
      reasons: ['command_missing']
    };
  }

  if (!VERSION_PATTERN.test(requestedVersion || '')) {
    reasons.push('requested_version_invalid');
  }

  const escapedVersion = escapeRegExp(String(requestedVersion || ''));
  const versionHeaderPattern = new RegExp(
    `(?:-H|--header)\\s+["']?X-GitHub-Api-Version\\s*:\\s*${escapedVersion}["']?`,
    'i'
  );

  if (!versionHeaderPattern.test(command)) {
    reasons.push('explicit_version_header_missing_or_mismatched');
  }

  if (!/(?:^|\s)--paginate(?:\s|$)/.test(command)) {
    reasons.push('paginate_flag_missing');
  }

  if (!/(?:^|\s)--slurp(?:\s|$)/.test(command)) {
    reasons.push('slurp_flag_missing');
  }

  if (!/(?:^|\s)(?:-f|--raw-field)\s+["']?head_sha=/.test(command)) {
    reasons.push('head_sha_filter_missing');
  }

  if (!/(?:^|\s)(?:-f|--raw-field)\s+["']?per_page=100["']?/.test(command)) {
    reasons.push('max_page_size_missing');
  }

  return {
    schemaVersion: 1,
    verified: reasons.length === 0,
    requestedVersion: requestedVersion || null,
    evidenceStrength: reasons.length === 0 ? 'retained_command_contract' : 'fail_closed',
    reasons
  };
}
