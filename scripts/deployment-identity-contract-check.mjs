import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/engine/deploymentIdentityRuntime.js', 'utf8');
const transformed = source
  .replace(/export function /g, 'function ')
  .replace(/env = import\.meta\.env/g, 'env = {}')
  .concat('\nthis.buildDeploymentIdentity = buildDeploymentIdentity;');

const context = {};
vm.createContext(context);
vm.runInContext(transformed, context);

const build = context.buildDeploymentIdentity;
const checks = [];
const assert = (name, ok, detail = '') => checks.push({ name, ok, detail });

const validSha = '321e94521de3a7c1bcbb119a29fab669153b142e';
const resolved = build({
  VITE_GIT_COMMIT_SHA: validSha.toUpperCase(),
  VITE_VERCEL_URL: 'mirror-cartographer-ui-abc.vercel.app',
  VERCEL: '1',
});
const unresolved = build({ VERCEL: '1' });
const malformed = build({ VITE_GIT_COMMIT_SHA: 'main', VERCEL: '1' });

assert('valid immutable commit is normalized', resolved.commit === validSha);
assert('valid immutable commit resolves source identity', resolved.verificationState === 'source-identified');
assert('Vercel provider is classified', resolved.provider === 'vercel');
assert('missing commit fails closed', unresolved.commit === null && unresolved.verificationState === 'source-unresolved');
assert('mutable or malformed ref fails closed', malformed.commit === null && malformed.commitResolved === false);
assert('runtime exposes browser evidence key', source.includes('window.__MC_DEPLOYMENT_IDENTITY__'));
assert('runtime exposes DOM verification state', source.includes('dataset.deploymentIdentity'));
assert('runtime emits machine-readable meta marker', source.includes('mc-deployment-identity'));

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
}

if (failed.length) {
  console.error(`\nDeployment identity contract failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}

console.log(`\nDeployment identity contract passed: ${checks.length}/${checks.length}`);
