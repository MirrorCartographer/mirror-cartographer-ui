const DEFAULT_SITE_URL = 'https://mirror-cartographer-ui.vercel.app';
const rawUrl = process.env.SITE_URL || DEFAULT_SITE_URL;

const fail = (message) => {
  console.error(`Preview URL check failed: ${message}`);
  process.exit(1);
};

let url;
try {
  url = new URL(rawUrl);
} catch {
  fail(`SITE_URL is not a valid URL: ${rawUrl}`);
}

if (!['http:', 'https:'].includes(url.protocol)) {
  fail(`SITE_URL must use http or https, received ${url.protocol}`);
}

const response = await fetch(url, {
  redirect: 'follow',
  headers: {
    'user-agent': 'mirror-cartographer-preview-check/1.0',
    accept: 'text/html,application/xhtml+xml',
  },
});

if (!response.ok) {
  fail(`${url.href} returned HTTP ${response.status}`);
}

const contentType = response.headers.get('content-type') || '';
if (!contentType.includes('text/html')) {
  fail(`${url.href} returned non-HTML content type: ${contentType || 'unknown'}`);
}

const html = await response.text();
if (!html.includes('id="root"')) {
  fail(`${url.href} does not look like the expected Vite React shell.`);
}

if (!html.includes('/assets/') && !html.includes('type="module"')) {
  fail(`${url.href} does not expose bundled app assets.`);
}

console.log(`Preview URL reachable: ${url.href}`);
