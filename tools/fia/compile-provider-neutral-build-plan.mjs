#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { access, open, readFile } from 'node:fs/promises';
import path from 'node:path';

const SCHEMA = 'fia.provider-neutral-build-plan.v1';
const DEFAULT_DENIED = [
  'vercel', 'cloudflare', 'wrangler', 'github pages', 'gh-pages',
  'netlify', 'render.com', 'firebase', 'surge', 'pages.dev'
];

function fail(message) { throw new Error(message); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function uniqueSorted(values) { return [...new Set(values)].sort(); }
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith('--') || argv[i + 1] === undefined) fail(`invalid argument near ${key ?? '<end>'}`);
    out[key.slice(2)] = argv[i + 1];
  }
  return out;
}
function normalizeRel(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty relative path`);
  const normalized = value.replaceAll('\\', '/');
  if (path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) fail(`${label} must not escape the repository`);
  return normalized.replace(/^\.\//, '');
}
function tokens(text) {
  return text.toLowerCase().replace(/[_./:@-]+/g, ' ');
}
function findDenied(text, denied) {
  const normalized = tokens(text);
  return denied.filter(term => normalized.includes(tokens(term)));
}
function referencedScripts(command) {
  const refs = [];
  const re = /(?:^|(?:&&|\|\||;))\s*(?:npm|pnpm|yarn)\s+(?:run\s+)?([a-zA-Z0-9:_-]+)/g;
  let match;
  while ((match = re.exec(command))) refs.push(match[1]);
  return refs;
}
function expandScriptGraph(scripts, rootName, denied) {
  const visiting = new Set();
  const visited = new Set();
  const graph = [];
  function visit(name) {
    if (visiting.has(name)) fail(`script cycle detected at ${name}`);
    if (visited.has(name)) return;
    const command = scripts[name];
    if (typeof command !== 'string') fail(`missing package script: ${name}`);
    const hits = findDenied(`${name} ${command}`, denied);
    if (hits.length) fail(`provider coupling in script ${name}: ${hits.join(', ')}`);
    visiting.add(name);
    const dependencies = uniqueSorted(referencedScripts(command));
    for (const dependency of dependencies) visit(dependency);
    visiting.delete(name);
    visited.add(name);
    graph.push({ name, command, dependencies });
  }
  visit(rootName);
  return graph.sort((a, b) => a.name.localeCompare(b.name));
}
export async function compilePlan({ packagePath, configPath }) {
  const [packageBytes, configBytes] = await Promise.all([readFile(packagePath), readFile(configPath)]);
  let pkg, config;
  try { pkg = JSON.parse(packageBytes); } catch { fail('package.json is not valid JSON'); }
  try { config = JSON.parse(configBytes); } catch { fail('config is not valid JSON'); }
  if (config.schema !== 'fia.provider-neutral-build-config.v1') fail('unsupported config schema');
  const buildScript = config.buildScript;
  if (typeof buildScript !== 'string' || !buildScript) fail('buildScript is required');
  const denied = uniqueSorted([...(config.deniedProviders ?? DEFAULT_DENIED)].map(v => String(v).toLowerCase()));
  if (!denied.length) fail('deniedProviders must not be empty');
  const graph = expandScriptGraph(pkg.scripts ?? {}, buildScript, denied);
  const envAllowlist = uniqueSorted(config.envAllowlist ?? ['CI', 'LANG', 'LC_ALL', 'NODE_ENV', 'SOURCE_DATE_EPOCH', 'TZ']);
  const forbiddenEnv = envAllowlist.filter(name => /(?:VERCEL|CLOUDFLARE|GITHUB|NETLIFY|FIREBASE)/i.test(name));
  if (forbiddenEnv.length) fail(`provider-specific environment variables are forbidden: ${forbiddenEnv.join(', ')}`);
  const inputs = uniqueSorted((config.inputs ?? ['package.json', 'src', 'public', 'index.html']).map(v => normalizeRel(v, 'input')));
  const output = normalizeRel(config.output ?? 'dist', 'output');
  if (inputs.some(input => input === output || input.startsWith(`${output}/`))) fail('output must not contain admitted inputs');
  const identityMaterial = {
    schema: SCHEMA,
    package: { sha256: sha256(packageBytes), bytes: packageBytes.length, name: pkg.name ?? null, version: pkg.version ?? null },
    config: { sha256: sha256(configBytes), bytes: configBytes.length },
    buildScript,
    scriptGraph: graph,
    inputs,
    output,
    envAllowlist,
    deniedProviders: denied,
    policy: {
      hostedBuildAuthority: false,
      providerSpecificEnvironment: false,
      networkRequired: false,
      overwriteExistingPlan: false
    }
  };
  return { ...identityMaterial, identity: sha256(canonical(identityMaterial)) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.package || !args.config || !args.output) fail('usage: --package package.json --config config.json --output plan.json');
  await access(path.dirname(path.resolve(args.output)), fsConstants.W_OK);
  const plan = await compilePlan({ packagePath: args.package, configPath: args.config });
  const handle = await open(args.output, 'wx');
  try { await handle.writeFile(`${JSON.stringify(plan, null, 2)}\n`); } finally { await handle.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
