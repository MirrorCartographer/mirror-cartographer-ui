const DEFAULT_SITE_URL = 'https://mirror-cartographer-ui.vercel.app';
const rawUrls = (process.env.SITE_URLS || process.env.SITE_URL || DEFAULT_SITE_URL)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const fail = (message) => {
  console.error(`Preview URL check failed: ${message}`);
  process.exit(1);
};

const assertValidUrl = (rawUrl) => {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    fail(`preview candidate is not a valid URL: ${rawUrl}`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    fail(`preview candidate must use http or https, received ${url.protocol}`);
  }

  return url;
};

const checkPreview = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'mirror-cartographer-preview-check/1.0',
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`${url.href} returned HTTP ${response.status}`);
  }

  const finalUrl = response.url ? new URL(response.url) : url;
  if (finalUrl.hostname === 'vercel.com' || finalUrl.pathname.includes('upgradeToPro')) {
    throw new Error(`${url.href} resolved to a Vercel account or build-limit page: ${finalUrl.href}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new Error(`${url.href} returned non-HTML content type: ${contentType || 'unknown'}`);
  }

  const html = await response.text();
  if (/upgradeToPro|build-rate-limit|mirror-cartographers-projects/i.test(html)) {
    throw new Error(`${url.href} returned a Vercel limit/dashboard page instead of the app shell.`);
  }

  if (!html.includes('id="root"')) {
    throw new Error(`${url.href} does not look like the expected Vite React shell.`);
  }

  if (!html.includes('/assets/') && !html.includes('type="module"')) {
    throw new Error(`${url.href} does not expose bundled app assets.`);
  }

  return url.href;
};

if (!rawUrls.length) {
  fail('no preview URL candidates supplied');
}

const errors = [];
for (const rawUrl of rawUrls) {
  const url = assertValidUrl(rawUrl);
  try {
    const reachable = await checkPreview(url);
    console.log(`Preview URL reachable: ${reachable}`);
    process.exit(0);
  } catch (error) {
    errors.push(error.message);
  }
}

fail(`no reachable preview candidate. Checked: ${rawUrls.join(', ')}. Errors: ${errors.join(' | ')}`);
