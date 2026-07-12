const DEFAULT_ALLOWED_HOSTS = ['mirror-cartographer-ui.vercel.app'];

function normalizeSha(value) {
  const sha = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Expected a full 40-character git commit SHA');
  return sha;
}

export function assertAllowedDeploymentUrl(input, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  const url = new URL(input);
  if (url.protocol !== 'https:') throw new Error('Deployment URL must use HTTPS');
  if (url.username || url.password) throw new Error('Deployment URL must not contain credentials');
  if (url.port) throw new Error('Deployment URL must not use a nonstandard port');
  const host = url.hostname.toLowerCase();
  const allowed = allowedHosts.some((entry) => {
    const expected = String(entry).toLowerCase();
    return host === expected || host.endsWith(`-${expected}`);
  });
  if (!allowed) throw new Error(`Deployment host is not allowlisted: ${host}`);
  return url;
}

export async function verifyVercelDeploymentIdentity({
  siteUrl,
  expectedCommit,
  fetchImpl = fetch,
  allowedHosts = DEFAULT_ALLOWED_HOSTS,
}) {
  const expectedSha = normalizeSha(expectedCommit);
  const base = assertAllowedDeploymentUrl(siteUrl, allowedHosts);
  const endpoint = new URL('/.well-known/mirror-cartographer-deployment.json', base);
  const response = await fetchImpl(endpoint, { redirect: 'follow', cache: 'no-store' });
  const finalUrl = assertAllowedDeploymentUrl(response.url || endpoint, allowedHosts);

  if (!response.ok) throw new Error(`Identity endpoint returned HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!/^application\/json(?:;|$)/i.test(contentType)) throw new Error(`Unexpected content-type: ${contentType || 'missing'}`);
  const cacheControl = response.headers.get('cache-control') || '';
  if (!/(?:^|,)\s*no-store\s*(?:,|$)/i.test(cacheControl)) throw new Error('Identity endpoint must be no-store');
  if ((response.headers.get('x-content-type-options') || '').toLowerCase() !== 'nosniff') throw new Error('Identity endpoint must set nosniff');

  const body = await response.json();
  const servedSha = normalizeSha(body.commit_sha);
  if (servedSha !== expectedSha) throw new Error(`Deployment commit mismatch: expected ${expectedSha}, received ${servedSha}`);

  return {
    status: 'verified',
    endpoint: finalUrl.href,
    expected_commit: expectedSha,
    served_commit: servedSha,
    headers: {
      content_type: contentType,
      cache_control: cacheControl,
      x_content_type_options: 'nosniff',
    },
  };
}
