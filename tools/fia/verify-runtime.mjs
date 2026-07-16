#!/usr/bin/env node
import { createHash } from 'node:crypto';
import process from 'node:process';

function parseArgs(argv) {
  const args = { timeout: 5000 };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--url') args.url = argv[++i];
    else if (token === '--artifact') args.artifact = argv[++i];
    else if (token === '--timeout') args.timeout = Number(argv[++i]);
    else if (token === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (args.help) return args;
  if (!args.url) throw new Error('--url is required');
  if (!/^sha256:[a-f0-9]{64}$/i.test(args.artifact ?? '')) throw new Error('--artifact must be sha256:<64 hex characters>');
  if (!Number.isInteger(args.timeout) || args.timeout < 1 || args.timeout > 60000) throw new Error('--timeout must be an integer from 1 through 60000');
  return args;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

async function readJson(url, signal) {
  const response = await fetch(url, { method: 'GET', redirect: 'error', signal, headers: { accept: 'application/json' } });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error(`${url.pathname} returned invalid JSON`); }
  return { status: response.status, body, headers: response.headers };
}

export async function verifyRuntime(options) {
  const base = new URL(options.url);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('runtime URL must use http or https');
  base.pathname = base.pathname.replace(/\/$/, '');
  const expected = options.artifact;
  if (!/^sha256:[a-f0-9]{64}$/i.test(expected ?? '')) throw new Error('artifact identity must be sha256:<64 hex characters>');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout ?? 5000);
  try {
    const prefix = base.pathname.replace(/\/$/, '');
    const healthUrl = new URL(base); healthUrl.pathname = `${prefix}/healthz`; healthUrl.search = ''; healthUrl.hash = '';
    const artifactUrl = new URL(base); artifactUrl.pathname = `${prefix}/fia-artifact`; artifactUrl.search = ''; artifactUrl.hash = '';
    const [health, identity] = await Promise.all([readJson(healthUrl, controller.signal), readJson(artifactUrl, controller.signal)]);
    if (health.status !== 200 || health.body?.schema !== 'fia.runtime-health.v1' || health.body?.status !== 'ok') throw new Error('runtime health verification failed');
    if (identity.status !== 200 || identity.body?.schema !== 'fia.runtime-artifact.v1') throw new Error('runtime artifact endpoint verification failed');
    if (identity.body.artifact !== expected) throw new Error(`served artifact mismatch: expected ${expected}, received ${identity.body.artifact ?? 'missing'}`);
    const evidence = { schema: 'fia.runtime-verification.v1', url: base.origin + base.pathname, artifact: expected, health: 'ok' };
    const verification = `sha256:${createHash('sha256').update(canonical(evidence)).digest('hex')}`;
    return { ...evidence, verification };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('runtime verification timed out');
    throw error;
  } finally { clearTimeout(timer); }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write('Usage: node tools/fia/verify-runtime.mjs --url http://127.0.0.1:4173 --artifact sha256:<digest> [--timeout 5000]\n'); return; }
  process.stdout.write(`${JSON.stringify(await verifyRuntime(args))}\n`);
}
if (import.meta.url === new URL(process.argv[1], 'file:').href) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
