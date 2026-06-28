import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const targetUrl = process.argv[2] || process.env.ICLOUD_SHARE_URL || 'https://share.icloud.com/photos/0c0cpN5VJ9yVCZYSS9XDjaFNw';
const browserName = (process.argv[3] || process.env.BROWSER || 'chromium').toLowerCase();
const outRoot = process.argv[4] || path.join(process.cwd(), 'artifacts', 'icloud-watch');
const outDir = path.join(outRoot, browserName);
const headless = process.env.HEADLESS === 'true';
const timeoutMs = Number(process.env.ICLOUD_TIMEOUT_MS || 90000);

const engines = { chromium, firefox, webkit };
const engine = engines[browserName];
if (!engine) {
  console.error(`Unknown browser "${browserName}". Use chromium, firefox, or webkit.`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

function safeName(value) {
  return String(value || 'asset')
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .slice(0, 120);
}

function uniqueRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.url || JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function classify(url = '', contentType = '') {
  const value = `${url} ${contentType}`.toLowerCase();
  if (value.includes('mpegurl') || value.includes('.m3u8')) return 'hls-manifest';
  if (value.includes('mp4') || value.includes('.mov') || value.includes('quicktime') || value.includes('video')) return 'video';
  if (value.includes('image') || value.match(/\.(jpg|jpeg|png|webp|heic|heif)(\?|$)/)) return 'image';
  if (value.includes('json')) return 'json';
  return 'other';
}

const userAgents = {
  chromium: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 MirrorCartographerICloudProbe/1.1',
  firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:127.0) Gecko/20100101 Firefox/127.0 MirrorCartographerICloudProbe/1.1',
  webkit: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15 MirrorCartographerICloudProbe/1.1'
};

const browser = await engine.launch({ headless });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
  deviceScaleFactor: 1,
  userAgent: userAgents[browserName]
});
const page = await context.newPage();

const requests = [];
const mediaResponses = [];
const responseBodies = [];
const consoleMessages = [];
const pageErrors = [];

page.on('console', (message) => {
  consoleMessages.push({ type: message.type(), text: message.text() });
});

page.on('pageerror', (error) => {
  pageErrors.push(String(error?.message || error));
});

page.on('request', (request) => {
  requests.push({
    method: request.method(),
    url: request.url(),
    resourceType: request.resourceType(),
    postData: request.postData() || null
  });
});

page.on('response', async (response) => {
  const url = response.url();
  const headers = response.headers();
  const contentType = headers['content-type'] || '';
  const row = {
    url,
    status: response.status(),
    contentType,
    kind: classify(url, contentType),
    browserName,
    headers: {
      contentLength: headers['content-length'] || null,
      acceptRanges: headers['accept-ranges'] || null,
      cacheControl: headers['cache-control'] || null
    }
  };

  if (row.kind !== 'other' || url.includes('icloud') || url.includes('apple')) {
    mediaResponses.push(row);
  }

  if (row.kind === 'json') {
    try {
      const text = await response.text();
      if (text && text.length < 2_000_000) {
        responseBodies.push({ url, contentType, text: text.slice(0, 200000) });
      }
    } catch {}
  }
});

let navigationError = null;
try {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
} catch (error) {
  navigationError = String(error?.message || error);
}

await page.screenshot({ path: path.join(outDir, 'page.png'), fullPage: true }).catch(() => {});

const dom = await page.evaluate(() => {
  const meta = [...document.querySelectorAll('meta')].map((node) => ({
    name: node.getAttribute('name'),
    property: node.getAttribute('property'),
    content: node.getAttribute('content')
  }));
  const images = [...document.images].map((img) => ({
    src: img.src,
    currentSrc: img.currentSrc,
    alt: img.alt,
    width: img.naturalWidth,
    height: img.naturalHeight
  }));
  const videos = [...document.querySelectorAll('video')].map((video) => ({
    src: video.src,
    currentSrc: video.currentSrc,
    poster: video.poster,
    paused: video.paused,
    duration: Number.isFinite(video.duration) ? video.duration : null,
    sources: [...video.querySelectorAll('source')].map((source) => ({ src: source.src, type: source.type }))
  }));
  const sources = [...document.querySelectorAll('source')].map((source) => ({ src: source.src, type: source.type }));
  const anchors = [...document.querySelectorAll('a')].map((anchor) => ({ text: anchor.innerText?.trim(), href: anchor.href })).filter((a) => a.href);
  const scripts = [...document.scripts].map((script) => ({ src: script.src, inlineLength: script.src ? 0 : script.textContent.length })).filter((s) => s.src || s.inlineLength);
  return {
    url: location.href,
    title: document.title,
    text: document.body?.innerText?.slice(0, 10000) || '',
    meta,
    images,
    videos,
    sources,
    anchors,
    scripts
  };
});

const candidates = uniqueRows([
  ...mediaResponses,
  ...dom.images.flatMap((img) => [img.currentSrc, img.src].filter(Boolean).map((url) => ({ url, kind: 'image', source: 'dom-image', browserName }))),
  ...dom.videos.flatMap((video) => [video.currentSrc, video.src, video.poster, ...video.sources.map((s) => s.src)].filter(Boolean).map((url) => ({ url, kind: classify(url, ''), source: 'dom-video', browserName }))),
  ...dom.sources.map((source) => ({ url: source.src, contentType: source.type, kind: classify(source.src, source.type), source: 'dom-source', browserName }))
]);

const manifest = {
  schema: 'mirror-cartographer.icloud-watch.v1',
  createdAt: new Date().toISOString(),
  browserName,
  targetUrl,
  navigationError,
  finalUrl: dom.url,
  title: dom.title,
  counts: {
    requests: requests.length,
    mediaResponses: mediaResponses.length,
    candidates: candidates.length,
    domImages: dom.images.length,
    domVideos: dom.videos.length,
    jsonBodies: responseBodies.length,
    consoleMessages: consoleMessages.length,
    pageErrors: pageErrors.length
  },
  candidates,
  consoleMessages,
  pageErrors,
  domSummary: {
    text: dom.text,
    meta: dom.meta,
    anchors: dom.anchors.slice(0, 200),
    scripts: dom.scripts.slice(0, 200)
  }
};

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(outDir, 'requests.json'), JSON.stringify(requests, null, 2));
fs.writeFileSync(path.join(outDir, 'media-responses.json'), JSON.stringify(uniqueRows(mediaResponses), null, 2));
fs.writeFileSync(path.join(outDir, 'dom.json'), JSON.stringify(dom, null, 2));
fs.writeFileSync(path.join(outDir, 'json-response-bodies.json'), JSON.stringify(responseBodies, null, 2));

const downloadable = candidates.filter((item) => ['image', 'video', 'hls-manifest'].includes(item.kind));
for (const item of downloadable.slice(0, Number(process.env.ICLOUD_DOWNLOAD_LIMIT || 12))) {
  try {
    const response = await context.request.get(item.url, { timeout: 30000 });
    if (!response.ok()) continue;
    const body = await response.body();
    const hash = crypto.createHash('sha1').update(item.url).digest('hex').slice(0, 10);
    const ext = item.kind === 'hls-manifest' ? 'm3u8' : item.kind === 'video' ? 'bin' : 'img';
    const filePath = path.join(outDir, `${hash}-${safeName(item.kind)}.${ext}`);
    fs.writeFileSync(filePath, body);
    item.downloadedTo = filePath;
    item.bytes = body.length;
  } catch (error) {
    item.downloadError = String(error?.message || error);
  }
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(JSON.stringify({
  outDir,
  browserName,
  targetUrl,
  finalUrl: dom.url,
  navigationError,
  title: dom.title,
  counts: manifest.counts,
  candidateKinds: downloadable.reduce((acc, item) => ({ ...acc, [item.kind]: (acc[item.kind] || 0) + 1 }), {})
}, null, 2));

if (process.env.PAUSE === 'true') await page.pause();
await browser.close();
