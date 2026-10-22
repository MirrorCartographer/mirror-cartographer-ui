import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const fileUrl = pathToFileURL(resolve('public/research-atlas/index.html')).href;
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const response = await page.goto(fileUrl);
  assert.equal(response?.status(), 200, 'research instrument HTML must load');
  assert.match(await page.title(), /The Between/);
  assert.equal(await page.locator('[data-node]').count(), 8, 'all eight relationship points must exist');

  await page.locator('[data-node="context"]').click();
  assert.match(await page.locator('#reading-kicker').innerText(), /Context/);
  assert.match(await page.locator('#reading-title').innerText(), /surrounded the observation/i);
  assert.ok((await page.locator('#claim-kind').innerText()).includes('CL-VA-002 / source-checked'));
  assert.equal(await page.getByRole('link', { name: /CL-VA-002 in claim register/ }).count(), 1);

  await page.getByRole('button', { name: 'Systems lens' }).click();
  assert.equal(await page.locator('#lens-label').innerText(), 'Systems lens');
  assert.match(await page.locator('#holds').innerText(), /Rules, staffing/i);

  await page.locator('#trail').getByRole('button', { name: 'Rule' }).click();
  assert.match(await page.locator('#reading-kicker').innerText(), /Rule/);
  assert.match(await page.locator('#reading-title').innerText(), /rule permit/i);

  const beforeReverse = await page.locator('#trail button').allInnerTexts();
  await page.locator('#reverse').click();
  const afterReverse = await page.locator('#trail button').allInnerTexts();
  assert.notDeepEqual(afterReverse, beforeReverse, 'reversing the question must change the next relations');

  await page.locator('#turn-phrase').click();
  assert.match(await page.locator('#phrase').innerText(), /Eligible/);
  await page.locator('#change-condition').click();
  assert.match(await page.locator('#phrase').innerText(), /Hold the observed value constant/);

  await page.setViewportSize({ width: 390, height: 844 });
  const map = await page.locator('#map-canvas').boundingBox();
  const reading = await page.locator('.reading').boundingBox();
  assert.ok(map && reading, 'map and reading panel must remain visible on mobile');
  assert.ok(reading.width >= 300, 'reading panel must fit a narrow viewport');

  assert.deepEqual(errors, [], 'interactive page must not emit JavaScript or console errors');
  console.log(JSON.stringify({
    result: 'PASS',
    checks: [
      'page load and title',
      'eight relationship nodes',
      'node selection',
      'lens switching',
      'relation traversal',
      'reversed path',
      'dynamic wordplay',
      'counterfactual prompt',
      'mobile layout',
      'no browser errors'
    ]
  }, null, 2));
} finally {
  await browser.close();
}
