import { spawnSync } from 'node:child_process';
import http from 'node:http';
import process from 'node:process';

const appBundle = 'React createRoot wordless sky onPointerDown AudioContext document.createElement("canvas").getContext("2d")';
const rootShell = '<!doctype html><html><body><div id="root"></div><script type="module" src="./assets/app.js"></script></body></html>';
const blockedShell = '<!doctype html><html><body>upgradeToPro build-rate-limit mirror-cartographers-projects</body></html>';
const thinShell = '<!doctype html><html><body><div id="root"></div><script type="module" src="./assets/thin.js"></script></body></html>';

const startServer = (handler) => new Promise((resolve, reject) => {
  const server = http.createServer(handler);
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    resolve({ server, url: `http://127.0.0.1:${address.port}/` });
  });
});

const closeServer = (server) => new Promise((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
});

const runPreviewCheck = (siteUrls) => spawnSync(process.execPath, ['scripts/preview-url-check.mjs'], {
  env: { ...process.env, SITE_URLS: siteUrls },
  encoding: 'utf8',
});

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const servers = [];
try {
  const blocked = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(blockedShell);
  });
  servers.push(blocked.server);

  const valid = await startServer((req, res) => {
    if (req.url?.includes('/assets/app.js')) {
      res.writeHead(200, { 'content-type': 'application/javascript' });
      res.end(appBundle);
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(rootShell);
  });
  servers.push(valid.server);

  const thin = await startServer((req, res) => {
    if (req.url?.includes('/assets/thin.js')) {
      res.writeHead(200, { 'content-type': 'application/javascript' });
      res.end('React createRoot but no canvas or audio boundary');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(thinShell);
  });
  servers.push(thin.server);

  const fallback = runPreviewCheck(`${blocked.url},${valid.url}`);
  assert(fallback.status === 0, `expected fallback candidate to pass, got ${fallback.status}: ${fallback.stderr}`);
  assert(fallback.stdout.includes(valid.url), `expected passing URL in stdout, got: ${fallback.stdout}`);

  const blockedOnly = runPreviewCheck(blocked.url);
  assert(blockedOnly.status !== 0, 'expected blocked preview shell to fail');
  assert(/Vercel limit\/dashboard page|no reachable preview candidate/i.test(blockedOnly.stderr), `expected blocked-page failure, got: ${blockedOnly.stderr}`);

  const thinOnly = runPreviewCheck(thin.url);
  assert(thinOnly.status !== 0, 'expected shell without canvas/audio bundle signals to fail');
  assert(/no probed bundle looked like the phone sky app|missing expected canvas\/audio\/React signals/i.test(thinOnly.stderr), `expected bundle-signal failure, got: ${thinOnly.stderr}`);

  const invalid = runPreviewCheck('notaurl');
  assert(invalid.status !== 0, 'expected invalid URL candidate to fail');
  assert(invalid.stderr.includes('not a valid URL'), `expected invalid URL failure, got: ${invalid.stderr}`);

  console.log('Preview URL candidate harness passed');
} finally {
  await Promise.allSettled(servers.map(closeServer));
}
