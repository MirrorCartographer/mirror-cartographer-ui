import fs from 'node:fs';

const checks = [];
const assert = (name, ok, detail = '') => checks.push({ name, ok, detail });
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';

const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts || {};
const pagesPreview = read('.github/workflows/pages-preview.yml');
const legacyPagesExists = fs.existsSync('.github/workflows/pages.yml');
const remoteGate = read('scripts/remote-gate.mjs');
const previewCheck = read('scripts/preview-url-check.mjs');

assert('legacy deploy-only Pages workflow is absent', !legacyPagesExists);
assert('verified Pages workflow exists', pagesPreview.includes('name: Pages Preview'));
assert('Pages workflow runs on main pushes', /push:\s*\n\s*branches:\s*\[main\]/.test(pagesPreview));
assert('Pages workflow runs pages preview gate before upload', pagesPreview.indexOf('npm run test:pages-preview') > -1 && pagesPreview.indexOf('npm run test:pages-preview') < pagesPreview.indexOf('actions/upload-pages-artifact'));
assert('Pages workflow deploys Pages artifact', pagesPreview.includes('actions/deploy-pages@v4'));
assert('Pages workflow verifies deployed URL', pagesPreview.includes('Verify deployed Pages URL') && pagesPreview.includes('npm run test:remote-gate'));
assert('Pages workflow passes deployed URL into remote gate', pagesPreview.includes('SITE_URL: ${{ needs.deploy.outputs.page_url }}'));
assert('remote gate selects a reachable URL before live smoke', remoteGate.includes('selectedUrl') && remoteGate.includes('npm') && remoteGate.includes('test:live'));
assert('preview check tries GitHub Pages before Vercel by default', previewCheck.indexOf('https://mirrorcartographer.github.io/mirror-cartographer-ui/') > -1 && previewCheck.indexOf('https://mirrorcartographer.github.io/mirror-cartographer-ui/') < previewCheck.indexOf('https://mirror-cartographer-ui.vercel.app'));
assert('package exposes deployment gate contract', scripts['test:deployment-gate'] === 'node scripts/deployment-gate-contract-check.mjs');
assert('pages preview script includes deployment gate contract', scripts['test:pages-preview']?.includes('test:deployment-gate'));
assert('composer cycle includes pages preview script', scripts['test:composer-cycle']?.includes('test:pages-preview'));

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
}

if (failed.length) {
  console.error(`\nDeployment gate contract failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}

console.log(`\nDeployment gate contract passed: ${checks.length}/${checks.length}`);
