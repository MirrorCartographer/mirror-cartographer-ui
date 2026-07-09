import fs from 'node:fs';
import path from 'node:path';

const fail = (message) => {
  console.error(`live wiring check failed: ${message}`);
  process.exit(1);
};

const readText = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`unable to read ${filePath}: ${error.message}`);
  }
};

const packageJson = JSON.parse(readText('package.json'));
const scripts = packageJson.scripts || {};
const liveWiringScript = scripts['test:live-wiring'];
const remoteGateScript = scripts['test:remote-gate'];
const liveScript = scripts['test:live'];

if (!liveWiringScript) {
  fail('package.json must expose scripts.test:live-wiring');
}

if (!liveWiringScript.includes('scripts/live-wiring-check.mjs')) {
  fail('scripts.test:live-wiring must run scripts/live-wiring-check.mjs');
}

if (!remoteGateScript) {
  fail('package.json must expose scripts.test:remote-gate');
}

if (!remoteGateScript.includes('scripts/remote-gate.mjs')) {
  fail('scripts.test:remote-gate must run scripts/remote-gate.mjs');
}

const remoteGatePath = 'scripts/remote-gate.mjs';
const remoteGate = readText(remoteGatePath);

const requiredRemoteGateFragments = [
  'scripts/live-wiring-check.mjs',
  'scripts/preview-url-check.unit.mjs',
  'scripts/preview-url-check.mjs',
  'npm',
  'test:live',
  'SITE_URL',
];

for (const fragment of requiredRemoteGateFragments) {
  if (!remoteGate.includes(fragment)) {
    fail(`${remoteGatePath} must include ${fragment}`);
  }
}

if (!remoteGate.includes('selectedUrl')) {
  fail(`${remoteGatePath} must select a reachable preview URL before live smoke`);
}

if (!liveScript) {
  fail('package.json must expose scripts.test:live');
}

if (!liveScript.includes('playwright.live.config.js')) {
  fail('scripts.test:live must use playwright.live.config.js');
}

const liveConfigPath = 'playwright.live.config.js';
const liveConfig = readText(liveConfigPath);

if (!liveConfig.includes('process.env.SITE_URL')) {
  fail('playwright.live.config.js must read SITE_URL');
}

if (/LIVE_SITE_URL/.test(liveConfig)) {
  fail('playwright.live.config.js must not use stale LIVE_SITE_URL');
}

const testDirMatch = liveConfig.match(/testDir:\s*['"]\.\/(.+?)['"]/);
const testMatchRegex = liveConfig.match(/testMatch:\s*\/(.+?)\\\.spec\\\.js\//);

if (!testDirMatch) {
  fail('playwright.live.config.js must declare testDir');
}

if (!testMatchRegex) {
  fail('playwright.live.config.js must declare a concrete *.spec.js testMatch regex');
}

const testDir = testDirMatch[1];
const testBaseName = `${testMatchRegex[1]}.spec.js`;
const liveSpecPath = path.join(testDir, testBaseName);

if (!fs.existsSync(liveSpecPath)) {
  fail(`configured live smoke file does not exist: ${liveSpecPath}`);
}

const liveSpec = readText(liveSpecPath);

if (/LIVE_SITE_URL/.test(liveSpec)) {
  fail(`${liveSpecPath} must not use stale LIVE_SITE_URL`);
}

if (!liveSpec.includes('deployed preview preserves')) {
  fail(`${liveSpecPath} should contain the deployed-preview live smoke contract`);
}

if (!liveSpec.includes('AudioContext') || !liveSpec.includes('__mirrorAudioContextsCreated')) {
  fail(`${liveSpecPath} must preserve the no-autoplay audio context probe`);
}

if (!liveSpec.includes('expectWordlessBody')) {
  fail(`${liveSpecPath} must preserve pre/post interaction wordless body assertions`);
}

console.log(`Live smoke wiring is coherent: ${liveWiringScript} -> ${remoteGatePath} -> selected SITE_URL -> ${liveScript} -> ${liveConfigPath} -> ${liveSpecPath}`);
