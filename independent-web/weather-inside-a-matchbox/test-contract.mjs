import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

const required = [
  'function hashSeed(value)',
  'function mulberry32(seed)',
  'function utcDayKey(date=new Date())',
  'const dayKey=utcDayKey()',
  'function forecastForStep(step)',
  "if(ctx.state==='suspended')await ctx.resume()",
  'aria-live="polite" aria-atomic="true"',
  'aria-describedby="interaction-hint"',
  '@media (prefers-reduced-motion:reduce)',
  '.matchbox:focus-visible',
  '.controls button:focus-visible'
];

for (const token of required) {
  assert.ok(html.includes(token), `missing contract token: ${token}`);
}

assert.equal((html.match(/name:'/g) ?? []).length, 4, 'expected four daily climate families');
assert.equal((html.match(/<button /g) ?? []).length, 2, 'expected exactly two explicit controls');
assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage/.test(html), 'artwork must remain network- and persistence-independent');
assert.ok(!/checkout|payment|subscribe|donate|purchase/i.test(html), 'artwork must not contain conversion language');

console.log(JSON.stringify({
  artifact: 'weather-inside-a-matchbox',
  deterministicDailyClimate: true,
  climateFamilies: 4,
  keyboardAndFocusContract: true,
  reducedMotionContract: true,
  mobileAudioResumeContract: true,
  externalNetworkDependency: false,
  conversionSurface: false
}, null, 2));
