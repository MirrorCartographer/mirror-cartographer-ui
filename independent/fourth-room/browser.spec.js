import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const documentPath = path.join(here, 'index.html');
const scorePath = path.join(here, 'room-score.mjs');
let server;
let origin;

async function openRoom(browser, options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  return { context, page };
}

test.beforeAll(async () => {
  const [source, scoreSource] = await Promise.all([readFile(documentPath), readFile(scorePath)]);
  server = createServer((request, response) => {
    const routes = {
      '/': [source, 'text/html; charset=utf-8'],
      '/room-score.mjs': [scoreSource, 'text/javascript; charset=utf-8']
    };
    const route = routes[request.url];
    if (!route) {
      response.writeHead(404).end();
      return;
    }
    const [body, contentType] = route;
    response.writeHead(200, {
      'content-type': contentType,
      'cache-control': 'no-store',
      'content-length': body.byteLength
    });
    response.end(body);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}/`;
});

test.afterAll(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('keyboard entry advances deterministic authored state and session memory survives reload', async ({ browser }) => {
  const { context, page } = await openRoom(browser);
  const door = page.getByRole('button', { name: 'Enter without proof' });

  await door.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText('A small light moves behind the wall, keeping pace with your breathing.');
  await expect(page.locator('#count')).toHaveText('01');
  await expect(page.locator('#room')).toHaveAttribute('data-mode', 'tilting');

  await page.getByRole('button', { name: 'Enter again' }).click();
  await expect(page.locator('#count')).toHaveText('02');
  await expect(page.locator('#room')).toHaveAttribute('data-mode', 'remembering');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#count')).toHaveText('02');
  await expect(page.getByRole('status')).toHaveText('Nothing opens. The room becomes deeper anyway.');

  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('#count')).toHaveText('00');
  await expect(page.locator('#room')).toHaveAttribute('data-mode', 'listening');
  await expect(page.getByRole('status')).toHaveText('The room is listening for a shape, not a name.');
  await context.close();
});

test('sound remains opt-in, uses scored parameters, and closes its audio context when disabled', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.__audioEvidence = { constructed: 0, resumed: 0, closed: 0, oscillators: 0, starts: [] };
    class AudioParamStub {
      setValueAtTime(value) { window.__audioEvidence.starts.push(value); }
      exponentialRampToValueAtTime() {}
    }
    class NodeStub {
      constructor() {
        this.frequency = new AudioParamStub();
        this.gain = new AudioParamStub();
        this.type = 'sine';
      }
      connect() { return this; }
      start() {}
      stop() {}
    }
    class AudioContextStub {
      constructor() {
        window.__audioEvidence.constructed += 1;
        this.state = 'suspended';
        this.currentTime = 0;
        this.destination = {};
      }
      async resume() { this.state = 'running'; window.__audioEvidence.resumed += 1; }
      async close() { this.state = 'closed'; window.__audioEvidence.closed += 1; }
      createOscillator() { window.__audioEvidence.oscillators += 1; return new NodeStub(); }
      createGain() { return new NodeStub(); }
    }
    window.AudioContext = AudioContextStub;
    window.webkitAudioContext = AudioContextStub;
  });
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: 'domcontentloaded' });

  await expect.poll(() => page.evaluate(() => window.__audioEvidence.constructed)).toBe(0);
  await page.getByRole('button', { name: 'Enter without proof' }).click();
  await expect.poll(() => page.evaluate(() => window.__audioEvidence.oscillators)).toBe(0);

  const sound = page.getByRole('button', { name: 'Sound: off' });
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.__audioEvidence)).toMatchObject({ constructed: 1, resumed: 1, closed: 0, oscillators: 1 });
  await expect.poll(() => page.evaluate(() => window.__audioEvidence.starts.includes(84))).toBe(true);

  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => window.__audioEvidence.closed)).toBe(1);
  await context.close();
});

test('reduced-motion mode does not schedule an animation loop', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    window.__rafCalls = 0;
    const native = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      window.__rafCalls += 1;
      return native(callback);
    };
  });
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => window.__rafCalls)).toBe(0);
  await page.getByRole('button', { name: 'Enter without proof' }).click();
  await expect.poll(() => page.evaluate(() => window.__rafCalls)).toBe(0);
  await context.close();
});

test('mobile viewport retains reachable controls and makes only local requests', async ({ browser }) => {
  const requests = [];
  const { context, page } = await openRoom(browser, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  page.on('request', request => requests.push(request.url()));
  await page.reload({ waitUntil: 'networkidle' });

  for (const name of ['Enter without proof', 'Sound: off', 'Reset']) {
    const control = page.getByRole('button', { name });
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
  }

  expect(new Set(requests)).toEqual(new Set([origin, `${origin}room-score.mjs`]));
  await context.close();
});