const DEFAULT_SITE_URLS = [
  'https://mirror-cartographer-ui.vercel.app',
  'https://mirrorcartographer.github.io/mirror-cartographer-ui/',
];

const rawUrls = (process.env.SITE_URLS || process.env.SITE_URL || DEFAULT_SITE_URLS.join(','))
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

const extractScriptUrls = (html, baseUrl) => {
  const scripts = [];
  const scriptPattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = scriptPattern.exec(html))) {
    scripts.push(new URL(match[1], baseUrl));
  }
  return scripts;
};

const checkBundleSignals = async (scriptUrls, pageUrl) => {
  if (!scriptUrls.length) {
    throw new Error(`${pageUrl.href} did not expose script assets to probe.`);
  }

  const errors = [];
  for (const scriptUrl of scriptUrls.slice(0, 4)) {
    try {
      const response = await fetch(scriptUrl, {
        redirect: 'follow',
        headers: {
          'user-agent': 'mirror-cartographer-preview-check/1.1',
          accept: 'application/javascript,text/javascript,*/*',
        },
      });

      if (!response.ok) {
        errors.push(`${scriptUrl.href} returned HTTP ${response.status}`);
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();
      const hasCanvas = /createElement\(["']canvas["']\)|<canvas|\.getContext\(["']2d["']\)|getContext\(["']2d["']/.test(text);
      const hasTapAudioBoundary = /AudioContext|webkitAudioContext|onPointerDown|pointerdown|tap-to-start|touch the sky/i.test(text);
      const hasReactRuntime = /React|jsx|createRoot|wordless|sky/i.test(text);

      if (hasCanvas && hasTapAudioBoundary && hasReactRuntime) {
        return scriptUrl.href;
      }

      errors.push(`${scriptUrl.href} missing expected canvas/audio/React signals; content-type=${contentType || 'unknown'}`);
    } catch (error) {
      errors.push(`${scriptUrl.href}: ${error.message}`);
    }
  }

  throw new Error(`${pageUrl.href} served HTML but no probed bundle looked like the phone sky app. ${errors.join(' | ')}`);
};

const checkPreview = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'mirror-cartographer-preview-check/1.1',
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

  const bundleUrl = await checkBundleSignals(extractScriptUrls(html, finalUrl), finalUrl);
  return `${url.href} via ${bundleUrl}`;
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
