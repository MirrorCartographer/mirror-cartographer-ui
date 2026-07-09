import fs from 'node:fs';

const checks = [];
const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (name, ok, detail = '') => checks.push({ name, ok, detail });

const app = read('src/components/App.jsx');
const pkg = JSON.parse(read('package.json'));
const smoke = read('tests/smoke.spec.js');
const pw = read('playwright.config.js');
const vite = read('vite.config.js');
const clock = read('src/engine/compositionClock.js');
const frame = read('src/engine/compositionFrame.js');
const phraseMemory = read('src/engine/phraseMemory.js');
const music = read('src/engine/skyMusic.js');

const startIndex = music.indexOf('async function start');
const ensureIndex = music.indexOf('function ensure');
const audioConstructorIndex = music.indexOf('ctx = new Audio()');
const exportedFactoryIndex = music.indexOf('export function createSkyMusic()');
const touchIndex = app.indexOf('const touch =');
const intervalIndex = app.indexOf('window.setInterval');
const visualScoreIndex = app.indexOf('function drawVisualScore');
const visualScoreEndIndex = app.indexOf('function useWordlessSky', visualScoreIndex);
const visualScore = visualScoreIndex >= 0 && visualScoreEndIndex > visualScoreIndex
  ? app.slice(visualScoreIndex, visualScoreEndIndex)
  : '';
const skyHookIndex = app.indexOf('function useWordlessSky');
const skyHook = skyHookIndex >= 0 ? app.slice(skyHookIndex) : '';

assert('tap-to-start handler is pointer based', app.includes('onPointerDown={touch}'));
assert('music is started only from interaction path', app.includes('musicRef.current?.start?.') && app.indexOf('musicRef.current?.start?.') > touchIndex);
assert('wordless visual surface still uses canvas button', app.includes('<button className="sky"') && app.includes('<canvas ref={canvasRef} />'));
assert('no visible instruction copy in app body', !/>([^<]*[A-Za-z]{3,}[^<]*)</.test(app.replace(/aria-label="[^"]*"/g, '')));
assert('smoke test exists', pkg.scripts?.['test:smoke'] === 'playwright test tests/smoke.spec.js --reporter=line');
assert('smoke test uses phone viewport', smoke.includes('390') && smoke.includes('844'));
assert('smoke test asserts wordless body', smoke.includes("visibleText.trim()).toBe('')"));
assert('smoke test asserts wordless body before and after first tap', smoke.indexOf('await expectWordlessBody(page);') < smoke.indexOf('await sky.tap') && smoke.indexOf('await expectWordlessBody(page);', smoke.indexOf('await sky.tap')) > smoke.indexOf('await sky.tap'));
assert('smoke test probes no autoplay before first tap', smoke.includes('__mirrorAudioContextsCreated') && smoke.includes('expect(await audioContextsCreated(page)).toBe(0)'));
assert('smoke test expects audio only after user gesture', smoke.includes('await sky.tap') && smoke.includes('expect(await audioContextsCreated(page)).toBeGreaterThanOrEqual(1)'));
assert('playwright uses touch-capable mobile profile', pw.includes('isMobile: true') && pw.includes('hasTouch: true'));
assert('preview server is local vite preview', pw.includes('npm run build && npm run preview'));
assert('vite build uses relative asset base for portable static previews', vite.includes("base: './'"));
assert('composition clock exists without browser globals', clock.includes('createCompositionClock') && !clock.includes('window.') && !clock.includes('document.'));
assert('composition clock exposes phrase and phase', clock.includes('phrase') && clock.includes('phase') && clock.includes('tapCount'));
assert('visual score reads composition clock snapshot', app.includes('clockSnapshot') && app.includes('clock: clockSnapshot') && app.includes('clock?.phase'));
assert('visual score reads phrase phase and density', visualScore.includes('clock?.phrasePhase') && visualScore.includes('clock?.density'));
assert('visual score applies phrase-density to geometry', visualScore.includes('phrasePhase * TAU') && visualScore.includes('baseY') && visualScore.includes('span') && visualScore.includes('densitySpread'));
assert('clock snapshot reaches canvas after tap', app.includes('setClockSnapshot(composition)') && app.includes('useWordlessSky(state, pulse, marks, rhythm, clockSnapshot'));
assert('phrase contour reaches canvas without visible copy', app.includes('const [phraseContour, setPhraseContour]') && app.includes('setPhraseContour(') && app.includes('useWordlessSky(state, pulse, marks, rhythm, clockSnapshot, phraseContour)'));
assert('hidden tab skips canvas rendering work', skyHook.includes('document.hidden') && skyHook.includes('requestAnimationFrame(loop)') && skyHook.indexOf('document.hidden') < skyHook.indexOf('frame += 1'));
assert('visibility listener resumes canvas sizing cleanly', skyHook.includes("document.addEventListener('visibilitychange'") && skyHook.includes("document.removeEventListener('visibilitychange'"));
assert('composition frame projector exists without browser globals', frame.includes('createCompositionFrame') && !frame.includes('window.') && !frame.includes('document.'));
assert('composition frame projector preserves wordless composition shape', frame.includes('beat: projected.beat') && frame.includes('phase: projected.phase') && frame.includes('phrase: projected.phrase'));
assert('composition frame projector is imported by app', app.includes('createCompositionFrame') && app.includes('createTapCompositionFrame'));
assert('continuous clock frame stays inside low-frequency tick', intervalIndex >= 0 && app.indexOf('createCompositionFrame', intervalIndex) > intervalIndex);
assert('tap clock frame stays inside interaction path', touchIndex >= 0 && app.indexOf('createTapCompositionFrame', touchIndex) > touchIndex);
assert('phrase memory primitive exists without browser globals', phraseMemory.includes('createPhraseMemory') && !phraseMemory.includes('window.') && !phraseMemory.includes('document.'));
assert('phrase memory stores numeric contour data', phraseMemory.includes('beat:') && phraseMemory.includes('phase:') && phraseMemory.includes('phrase:') && phraseMemory.includes('energy:') && phraseMemory.includes('rhythm:'));
assert('phrase memory exposes read-only contour snapshot', phraseMemory.includes('snapshot()') && phraseMemory.includes('contour()') && phraseMemory.includes('frames.map((frame) => ({ ...frame }))'));
assert('audio engine is exported as lazy factory', exportedFactoryIndex >= 0 && ensureIndex > exportedFactoryIndex && startIndex > ensureIndex);
assert('audio context constructor stays behind ensure/start path', audioConstructorIndex > ensureIndex && audioConstructorIndex < startIndex);
assert('app constructs music object without starting audio', app.includes('musicRef.current = createSkyMusic();') && app.indexOf('musicRef.current = createSkyMusic();') < touchIndex);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
}

if (failed.length) {
  console.error(`\nPhone contract failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}

console.log(`\nPhone contract passed: ${checks.length}/${checks.length}`);
