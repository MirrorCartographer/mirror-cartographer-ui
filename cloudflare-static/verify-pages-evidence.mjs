import crypto from 'node:crypto';

const sha40 = /^[0-9a-f]{40}$/;
const sha64 = /^[0-9a-f]{64}$/;

function fail(code, detail) {
  return { ok: false, code, detail };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function safeHttpsUrl(raw, invalidCode, label) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: fail(invalidCode, `${label} is not a URL.`) };
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    return { error: fail(invalidCode, `${label} must use HTTPS and must not contain credentials.`) };
  }
  return { value: parsed };
}

export function verifyPagesEvidence(input) {
  if (!input || typeof input !== 'object') return fail('INVALID_INPUT', 'Evidence must be an object.');
  const { project, deployment, network, identity, provenance } = input;
  if (!project?.canonical_origin || !project?.source || project.source !== 'cloudflare_pages_api') {
    return fail('PROJECT_AUTHORITY_MISSING', 'Canonical origin must come from the Cloudflare Pages API.');
  }

  const canonicalResult = safeHttpsUrl(project.canonical_origin, 'INVALID_CANONICAL_ORIGIN', 'Canonical origin');
  if (canonicalResult.error) return canonicalResult.error;
  const canonical = canonicalResult.value;
  if (!canonical.hostname.endsWith('.pages.dev') || canonical.hostname === 'pages.dev') {
    return fail('INVALID_CANONICAL_ORIGIN', 'Canonical origin must be an HTTPS project hostname on pages.dev.');
  }

  if (!deployment?.url || !sha40.test(deployment.commit_sha || '')) {
    return fail('DEPLOYMENT_BINDING_MISSING', 'Deployment URL and 40-character commit SHA are required.');
  }
  const deploymentResult = safeHttpsUrl(deployment.url, 'INVALID_DEPLOYMENT_URL', 'Deployment URL');
  if (deploymentResult.error) return deploymentResult.error;
  const deployed = deploymentResult.value;

  const canonicalHost = canonical.hostname;
  const customDomains = Array.isArray(project.custom_domains)
    ? project.custom_domains.map((domain) => String(domain).toLowerCase().replace(/\.$/, ''))
    : [];
  const hostBound =
    deployed.hostname === canonicalHost ||
    deployed.hostname.endsWith(`.${canonicalHost}`) ||
    customDomains.includes(deployed.hostname);
  if (!hostBound) return fail('HOSTNAME_NOT_BOUND', 'Deployment URL is not bound to the authoritative Pages project.');

  if (network?.dns_resolved !== true || network?.http_status < 200 || network?.http_status >= 400) {
    return fail('NETWORK_NOT_PROVED', 'DNS resolution and successful HTTP response are required.');
  }
  if (identity?.surface !== 'mirror-cartographer-research' || identity?.served_commit !== deployment.commit_sha) {
    return fail('IDENTITY_MISMATCH', 'Served surface identity must bind to the deployed commit.');
  }
  if (!sha64.test(provenance?.artifact_digest || '') || provenance?.privacy_review !== 'passed') {
    return fail('PROVENANCE_INCOMPLETE', 'Digest and passed privacy review are required.');
  }

  const normalized = canonicalize({ project, deployment, network, identity, provenance });
  const evidence_digest = crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  return {
    ok: true,
    code: 'PAGES_EVIDENCE_ACCEPTED',
    evidence_digest,
    claims: {
      hostname_authority: true,
      deployment_bound: true,
      network_reachable: true,
      served_identity_bound: true,
      provenance_complete: true,
      scientific_truth_established: false
    }
  };
}
