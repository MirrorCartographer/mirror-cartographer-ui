import { createHash } from 'node:crypto';

const SHA40 = /^[0-9a-f]{40}$/;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function verifyReportedArtifacts({ report, observedFiles = [], observedCommits = [] }) {
  if (!report || typeof report !== 'object') throw new TypeError('report must be an object');
  if (!Array.isArray(report.artifacts) || report.artifacts.length === 0) {
    throw new Error('report.artifacts must contain at least one artifact');
  }

  const fileSet = new Set(observedFiles);
  const commitSet = new Set(observedCommits.map(c => typeof c === 'string' ? c : c?.sha).filter(Boolean));
  const findings = report.artifacts.map((artifact, index) => {
    if (!artifact || typeof artifact.path !== 'string' || artifact.path.length === 0) {
      throw new Error(`artifact[${index}].path is required`);
    }
    if (!SHA40.test(artifact.commit ?? '')) {
      throw new Error(`artifact[${index}].commit must be a lowercase 40-character SHA`);
    }
    const fileObserved = fileSet.has(artifact.path);
    const commitObserved = commitSet.has(artifact.commit);
    return {
      path: artifact.path,
      commit: artifact.commit,
      fileObserved,
      commitObserved,
      verified: fileObserved && commitObserved,
      status: fileObserved && commitObserved ? 'observed' : 'unverified_report'
    };
  });

  const verified = findings.every(f => f.verified);
  const packet = {
    schema_version: 1,
    report_id: report.report_id ?? null,
    classification: verified ? 'reported_artifacts_verified' : 'reported_artifacts_unverified',
    verified,
    findings,
    epistemic_rule: 'A prior narrative claim is not durable project state unless both its path and commit are observed through the repository interface.'
  };
  packet.digest_sha256 = createHash('sha256').update(canonical(packet)).digest('hex');
  return packet;
}
