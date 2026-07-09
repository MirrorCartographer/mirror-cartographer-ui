import fs from 'node:fs';

const checks = [];
const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (name, ok, detail = '') => checks.push({ name, ok, detail });

const app = read('src/components/App.jsx');
const pkg = JSON.parse(read('package.json'));
const smoke = read('tests/smoke.spec.js');
const pw = read('playwright.config.js');
const clock = read('src/engine/compositionClock.js');

assert('tap-to-start handler is pointer based', app.includes('onPointerDown={touch}'));
assert('music is started only from interaction path', app.includes('musicRef.current?.start?.') && app.indexOf('musicRef.current?.start?.') > app.indexOf('const touch ='));
assert('wordless visual surface still uses canvas button', app.includes('<button className="sky"') && app.includes('<canvas ref={canvasRef} />'));
assert('no visible instruction copy in app body', !/>([^<]*[A-Za-z]{3,}[^<]*)</.test(app.replace(/aria-label="[^"]*"/g, '')));
assert('smoke test exists', pkg.scripts?.['test:smoke'] === 'playwright test tests/smoke.spec.js --reporter=line');
assert('smoke test uses phone viewport', smoke.includes('390') && smoke.includes('844'));
assert('smoke test asserts wordless body', smoke.includes("visibleText.trim()).toBe('')"));
assert('smoke test asserts wordless body before and after first tap', smoke.indexOf('await expectWordlessBody(page);') < smoke.indexOf('await sky.tap') && smoke.indexOf('await expectWordlessBody(page);', smoke.indexOf('await sky.tap')) > smoke.indexOf('await sky.tap'));
assert('playwright uses touch-capable mobile profile', pw.includes('isMobile: true') && pw.includes('hasTouch: true'));
assert('preview server is local vite preview', pw.includes('npm run build && npm run preview'));
assert('composition clock exists without browser globals', clock.includes('createCompositionClock') && !clock.includes('window.') && !clock.includes('document.'));
assert('composition clock exposes phrase and phase', clock.includes('phrase') && clock.includes('phase') && clock.includes('tapCount'));
assert('visual score reads composition clock snapshot', app.includes('clockSnapshot') && app.includes('clock: clockSnapshot') && app.includes('clock?.phase'));
assert('clock snapshot reaches canvas after tap', app.includes('setClockSnapshot(composition)') && app.includes('useWordlessSky(state, pulse, marks, rhythm, clockSnapshot)'));

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
}

if (failed.length) {
  console.error(`\nPhone contract failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}

console.log(`\nPhone contract passed: ${checks.length}/${checks.length}`);
