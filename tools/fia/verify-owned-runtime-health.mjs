#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SCHEMA = 'fia.owned-runtime-health.v1';
const MANIFEST_SCHEMA = 'fia.owned-runtime-health-manifest.v1';
const REQUIRED_HEADERS = [
  'content-security-policy',
  'referrer-policy',
  'x-content-type-options',
  'x-frame-options',
  'x-fia-content-sha256',
  'x-fia-schema'
];

function fail(message) { throw new Error(message); }
function sha256Bytes(value) { return createHash('sha256').update(value).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
function identity(value) { return sha256Bytes(Buffer.from(JSON.stringify(canonical(value)))); }
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith('--') || argv[i + 1] === undefined) fail(`invalid argument near ${key ?? '<end>'}`);
    out[key.slice(2)] = argv[i + 1];
  }
  return out;
}
function assertRelativePath(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  if (value.includes('\\') || value.includes('?') || value.includes('#') || value.split('/').includes('..')) fail(`${label} must be a safe URL path`);
  return value.startsWith('/') ? value : `/${value}`;
}
function validateDigest(value, label) {
  if (!/^[a-f0-9]{64}$/.test(value ?? '')) fail(`${label} must be a lowercase SHA-256 digest`);
}
function validateManifest(manifest) {
  if (manifest?.schema !== MANIFEST_SCHEMA) fail(`manifest schema must be ${MANIFEST_SCHEMA}`);
  if (!Array.isArray(manifest.probes) || manifest.probes.length === 0) fail('manifest.probes must be non-empty');
  const seen = new Set();
  const probes = manifest.probes.map((probe, index) => {
    const urlPath = assertRelativePath(probe.path, `probes[${index}].path`);
    if (seen.has(urlPath)) fail(`duplicate probe path: ${urlPath}`);
    seen.add(urlPath);
    if (!['route', 'asset'].includes(probe.kind)) fail(`invalid probe kind for ${urlPath}`);
    if (!Number.isInteger(probe.status) || probe.status < 100 || probe.status > 599) fail(`invalid expected status for ${urlPath}`);
    if (typeof probe.mime !== 'string' || !probe.mime.includes('/')) fail(`invalid expected MIME type for ${urlPath}`);
    validateDigest(probe.sha256, `sha256 for ${urlPath}`);
    return { path: urlPath, kind: probe.kind, status: probe.status, mime: probe.mime.toLowerCase(), sha256: probe.sha256 };
  });
  const missingAssetPath = assertRelativePath(manifest.missingAssetPath ?? '/__fia_missing_asset__.js', 'missingAssetPath');
  if (!path.posix.extname(missingAssetPath)) fail('missingAssetPath must include an extension');
  return { probes, missingAssetPath };
}
function checkHtmlContract(bytes, urlPath) {
  const html = bytes.toString('utf8');
  const checks = {
    htmlLang: /<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html),
    viewport: /<meta\b[^>]*\bname\s*=\s*["']viewport["'][^>]*>/i.test(html),
    noAutoplay: !/\bautoplay\b/i.test(html),
    noProviderCoupling: !/(vercel|cloudflare|github\.io)/i.test(html)
  };
  for (const [name, ok] of Object.entries(checks)) if (!ok) fail(`HTML contract ${name} failed for ${urlPath}`);
  return checks;
}
async function fetchBounded(url, timeoutMs, maxBytes) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { redirect: 'error', signal: controller.signal, headers: { accept: 'text/html,application/xhtml+xml,application/json,*/*;q=0.8' } });
    const reader = response.body?.getReader();
    const chunks = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) fail(`response exceeds ${maxBytes} bytes: ${url}`);
        chunks.push(Buffer.from(value));
      }
    }
    return { response, bytes: Buffer.concat(chunks) };
  } finally { clearTimeout(timer); }
}
async function main() {
  const args = parseArgs(process.argv);
  if (!args.manifest || !args.baseUrl || !args.output) fail('required: --manifest --baseUrl --output');
  const timeoutMs = Number(args.timeoutMs ?? 10000);
  const maxBytes = Number(args.maxBytes ?? 16 * 1024 * 1024);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300000) fail('timeoutMs out of range');
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 128 * 1024 * 1024) fail('maxBytes out of range');
  const manifestBytes = await readFile(args.manifest);
  const manifest = JSON.parse(manifestBytes);
  const { probes, missingAssetPath } = validateManifest(manifest);
  const base = new URL(args.baseUrl);
  if (!['http:', 'https:'].includes(base.protocol)) fail('baseUrl must use http or https');
  base.hash = ''; base.search = '';

  const results = [];
  for (const probe of probes) {
    const url = new URL(probe.path, base);
    const { response, bytes } = await fetchBounded(url, timeoutMs, maxBytes);
    if (response.status !== probe.status) fail(`${probe.path}: expected ${probe.status}, received ${response.status}`);
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (contentType !== probe.mime) fail(`${probe.path}: expected MIME ${probe.mime}, received ${contentType || '<missing>'}`);
    for (const header of REQUIRED_HEADERS) if (!response.headers.has(header)) fail(`${probe.path}: missing required header ${header}`);
    if (response.headers.get('x-fia-schema') !== 'fia.owned-static-runtime-server.v1') fail(`${probe.path}: unexpected x-fia-schema`);
    const digest = sha256Bytes(bytes);
    if (digest !== probe.sha256) fail(`${probe.path}: served-byte digest mismatch`);
    if (response.headers.get('x-fia-content-sha256') !== digest) fail(`${probe.path}: response digest header mismatch`);
    const htmlContract = contentType === 'text/html' ? checkHtmlContract(bytes, probe.path) : null;
    results.push({ ...probe, observedSha256: digest, byteLength: bytes.length, headers: Object.fromEntries(REQUIRED_HEADERS.map((h) => [h, response.headers.get(h)])), htmlContract });
  }

  const missingUrl = new URL(missingAssetPath, base);
  const missing = await fetchBounded(missingUrl, timeoutMs, Math.min(maxBytes, 1024 * 1024));
  if (missing.response.status !== 404) fail(`missing asset probe must return 404, received ${missing.response.status}`);
  const missingType = (missing.response.headers.get('content-type') ?? '').toLowerCase();
  if (missingType.includes('text/html') || /<!doctype html|<html\b/i.test(missing.bytes.toString('utf8'))) fail('missing asset was masked by HTML fallback');

  const core = {
    schema: SCHEMA,
    manifest: { sha256: sha256Bytes(manifestBytes), byteLength: manifestBytes.length },
    baseUrl: `${base.protocol}//${base.host}`,
    probes: results,
    missingAsset: { path: missingAssetPath, status: missing.response.status, byteLength: missing.bytes.length },
    policy: { requiredHeaders: REQUIRED_HEADERS, timeoutMs, maxBytes, redirects: 'rejected', missingAssetMust404: true }
  };
  const evidence = { ...core, identity: identity(core) };
  const handle = await open(args.output, 'wx');
  try { await handle.writeFile(`${JSON.stringify(canonical(evidence), null, 2)}\n`); await handle.sync(); } finally { await handle.close(); }
  process.stdout.write(`${evidence.identity}\n`);
}

main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
