#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SCHEMA_IN = 'fia.runtime-route-manifest.v1';
const SCHEMA_OUT = 'fia.offline-runtime-bundle.v1';
const SW_SCHEMA = 'fia.offline-service-worker.v1';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sort(value[k])]));
  return value;
}
function fail(message) { throw new Error(message); }
function exactKeys(obj, allowed, label) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) fail(`${label} must be an object`);
  const unknown = Object.keys(obj).filter(k => !allowed.includes(k));
  if (unknown.length) fail(`${label} has unknown fields: ${unknown.join(', ')}`);
}
function safeUrl(path, label) {
  if (typeof path !== 'string' || !path.startsWith('/')) fail(`${label} must begin with /`);
  if (path.includes('\\') || path.includes('?') || path.includes('#') || /(^|\/)\.\.?($|\/)/.test(path)) fail(`${label} is unsafe: ${path}`);
  let decoded;
  try { decoded = decodeURIComponent(path); } catch { fail(`${label} has invalid encoding`); }
  if (decoded.includes('\\') || /(^|\/)\.\.?($|\/)/.test(decoded)) fail(`${label} contains encoded traversal`);
  const normalized = '/' + decoded.split('/').filter(Boolean).join('/');
  return decoded.endsWith('/') && normalized !== '/' ? `${normalized}/` : normalized;
}
function artifactMap(manifest) {
  const map = new Map();
  const add = (entry, role) => {
    exactKeys(entry, ['path','mode','size','sha256'], role);
    if (typeof entry.path !== 'string' || entry.path.startsWith('/') || entry.path.includes('..') || entry.path.includes('\\')) fail(`${role} has unsafe path`);
    if (!Number.isInteger(entry.size) || entry.size < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) fail(`${role} has invalid size or sha256`);
    const url = safeUrl(`/${entry.path}`, `${role} URL`);
    const existing = map.get(url);
    const normalized = { url, path: entry.path, mode: entry.mode, size: entry.size, sha256: entry.sha256, role };
    if (existing && canonical(existing) !== canonical(normalized)) fail(`cache key collision at ${url}`);
    map.set(url, normalized);
  };
  for (const route of manifest.routes) {
    exactKeys(route, ['route','document','assets'], 'route');
    safeUrl(route.route, 'route');
    add(route.document, 'document');
    for (const asset of route.assets) add(asset, 'asset');
  }
  if (manifest.offlineFallback) add(manifest.offlineFallback, 'offlineFallback');
  return map;
}
function serviceWorkerSource({ cacheName, entries, offlineUrl }) {
  const precache = entries.map(e => ({ url: e.url, sha256: e.sha256 }));
  return `/* ${SW_SCHEMA} */\nconst CACHE_NAME=${JSON.stringify(cacheName)};\nconst PRECACHE=${canonical(precache)};\nconst OFFLINE_URL=${JSON.stringify(offlineUrl)};\nself.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);for(const item of PRECACHE){const response=await fetch(item.url,{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error('precache failed '+item.url);const bytes=await response.clone().arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',bytes);const hex=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');if(hex!==item.sha256)throw new Error('digest mismatch '+item.url);await cache.put(item.url,response);}})()));\nself.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key!==CACHE_NAME)await caches.delete(key);await self.clients.claim();})()));\nself.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==self.location.origin)return;const isNavigation=request.mode==='navigate';event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);const exact=await cache.match(url.pathname,{ignoreSearch:true});if(exact)return exact;try{return await fetch(request);}catch(error){if(isNavigation&&OFFLINE_URL){const fallback=await cache.match(OFFLINE_URL);if(fallback)return fallback;}throw error;}})());});\n`;
}
export function compile(manifestBytes) {
  const manifest = JSON.parse(manifestBytes);
  exactKeys(manifest, ['schema','identity','config','routes','offlineFallback','policy'], 'manifest');
  if (manifest.schema !== SCHEMA_IN) fail(`expected ${SCHEMA_IN}`);
  if (!Array.isArray(manifest.routes) || manifest.routes.length === 0) fail('manifest routes must be non-empty');
  const withoutIdentity = { ...manifest }; delete withoutIdentity.identity;
  const expectedIdentity = sha256(canonical(withoutIdentity));
  if (manifest.identity !== expectedIdentity) fail('runtime route manifest identity mismatch');
  const map = artifactMap(manifest);
  if (!manifest.offlineFallback) fail('offlineFallback is required');
  const offlineUrl = safeUrl(`/${manifest.offlineFallback.path}`, 'offline fallback URL');
  if (!map.has(offlineUrl)) fail('offline fallback is not in cache closure');
  const entries = [...map.values()].sort((a,b)=>a.url.localeCompare(b.url));
  const cacheIdentity = sha256(canonical(entries.map(({url,size,sha256})=>({url,size,sha256}))));
  const cacheName = `fia-${cacheIdentity}`;
  const sw = serviceWorkerSource({ cacheName, entries, offlineUrl });
  const swSha256 = sha256(sw);
  const output = {
    schema: SCHEMA_OUT,
    sourceManifest: { schema: manifest.schema, identity: manifest.identity, bytesSha256: sha256(manifestBytes), size: Buffer.byteLength(manifestBytes) },
    cache: { name: cacheName, identity: cacheIdentity, entries: entries.map(({url,path,size,sha256,role})=>({url,path,size,sha256,role})) },
    offlineFallback: { url: offlineUrl, sha256: manifest.offlineFallback.sha256 },
    serviceWorker: { schema: SW_SCHEMA, path: 'fia-service-worker.js', size: Buffer.byteLength(sw), sha256: swSha256, source: sw },
    policy: { sameOriginOnly: true, externalDependencies: false, exactAssetFallback: false, navigationFallbackOnly: true, staleCacheDeletion: true, digestVerifiedInstall: true, noTelemetry: true, noAutoplay: true, overwriteExistingBundle: false }
  };
  output.identity = sha256(canonical(output));
  return output;
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).reduce((a,v,i,arr)=>{if(v.startsWith('--'))a.push([v.slice(2),arr[i+1]]);return a;},[]));
  if (!args.manifest || !args.output) fail('usage: --manifest <path> --output <path>');
  const bytes = await readFile(resolve(args.manifest), 'utf8');
  const output = compile(bytes);
  await writeFile(resolve(args.output), canonical(output) + '\n', { flag: 'wx', mode: 0o644 });
  process.stdout.write(`${output.identity}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) main().catch(e=>{console.error(e.message);process.exitCode=1;});
