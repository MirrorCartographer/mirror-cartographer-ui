#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA = 'fia.portable-runtime-bundle.v1';
const REHEARSAL_SCHEMA = 'fia.portable-runtime-bundle-rehearsal.v1';
const sha = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  }
  return v;
}
const stableBytes = (v) => Buffer.from(`${JSON.stringify(stable(v), null, 2)}\n`);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument ${arg}`);
    const key = arg.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${key}`);
    out[key] = value;
  }
  return out;
}

async function exists(file) {
  try {
    await fs.lstat(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function walk(root) {
  const files = [];
  async function visit(absolute, relative = '') {
    const entries = await fs.readdir(absolute, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const abs = path.join(absolute, entry.name);
      const stat = await fs.lstat(abs);
      if (stat.isSymbolicLink()) throw new Error(`symlink rejected: ${rel}`);
      if (stat.isDirectory()) {
        await visit(abs, rel);
      } else if (stat.isFile()) {
        const bytes = await fs.readFile(abs);
        files.push({
          path: rel.replaceAll('\\', '/'),
          mode: stat.mode & 0o777,
          size: bytes.length,
          sha256: sha(bytes),
          bytes,
        });
      } else {
        throw new Error(`unsupported entry: ${rel}`);
      }
    }
  }
  await visit(root);
  return files;
}

function routes(files) {
  const output = [];
  for (const file of files) {
    if (!file.path.endsWith('.html')) continue;
    let route = file.path === 'index.html' ? '/' : `/${file.path}`;
    if (route.endsWith('/index.html')) route = route.slice(0, -10);
    output.push({ route, file: file.path, sha256: file.sha256 });
  }
  output.sort((a, b) => a.route.localeCompare(b.route));
  if (!output.length) throw new Error('artifact contains no HTML routes');
  return output;
}

function launcherSource() {
  return `#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,v)=>{if(x.startsWith('--'))a.push([x.slice(2),v[i+1]]);return a},[]));
const root=path.dirname(fileURLToPath(import.meta.url));
const m=JSON.parse(await fs.readFile(path.join(root,'bundle-manifest.json'),'utf8'));
const target=args.target||'current'; const art=m.artifacts[target]; if(!art) throw new Error('unknown target');
const byRoute=new Map(art.routes.map(r=>[r.route,r])); const byPath=new Map(art.files.map(f=>[f.path,f]));
const mime=p=>p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.js')?'text/javascript; charset=utf-8':p.endsWith('.css')?'text/css; charset=utf-8':p.endsWith('.json')?'application/json; charset=utf-8':p.endsWith('.svg')?'image/svg+xml':'application/octet-stream';
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://x'); const route=byRoute.get(u.pathname); const file=route?byPath.get(route.file):byPath.get(u.pathname.replace(/^\\//,'')); if(!file){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});return res.end('not found');} const hex=file.sha256.slice(7); const bytes=await fs.readFile(path.join(root,'objects','sha256',hex)); res.writeHead(200,{'content-type':mime(file.path),'content-length':bytes.length,'etag':'"'+hex+'"','cache-control':file.path.endsWith('.html')?'no-cache':'public, max-age=3600','x-content-type-options':'nosniff'}); if(req.method==='HEAD') return res.end(); res.end(bytes);}catch(e){res.writeHead(500);res.end('runtime error')}});
server.listen(Number(args.port||8080),args.host||'127.0.0.1',()=>console.log(JSON.stringify({target,port:server.address().port})));
`;
}

async function writeExclusive(file, bytes, mode) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const handle = await fs.open(file, 'wx', mode);
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
}

async function compileArtifact(directory, objectDirectory, seen) {
  const sourceFiles = await walk(directory);
  const files = [];
  for (const file of sourceFiles) {
    const hex = file.sha256.slice(7);
    const objectPath = path.join(objectDirectory, hex);
    if (!seen.has(hex)) {
      await writeExclusive(objectPath, file.bytes, 0o444);
      seen.add(hex);
    }
    files.push({
      path: file.path,
      mode: file.mode,
      size: file.size,
      sha256: file.sha256,
      object: `objects/sha256/${hex}`,
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, routes: routes(files), identity: sha(stableBytes(files)) };
}

async function probe(bundle, target) {
  const manifest = JSON.parse(await fs.readFile(path.join(bundle, 'bundle-manifest.json'), 'utf8'));
  const artifact = manifest.artifacts[target];
  const route = artifact.routes[0];
  const file = artifact.files.find((candidate) => candidate.path === route.file);
  const server = http.createServer(async (request, response) => {
    const foundRoute = artifact.routes.find((candidate) => candidate.route === new URL(request.url, 'http://x').pathname);
    if (!foundRoute) {
      response.writeHead(404);
      response.end();
      return;
    }
    const foundFile = artifact.files.find((candidate) => candidate.path === foundRoute.file);
    const bytes = await fs.readFile(path.join(bundle, foundFile.object));
    response.writeHead(200, { 'content-length': bytes.length });
    response.end(bytes);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const port = server.address().port;
    const body = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: route.route }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => response.statusCode === 200
          ? resolve(Buffer.concat(chunks))
          : reject(new Error(`status ${response.statusCode}`)));
      }).on('error', reject);
    });
    if (sha(body) !== file.sha256) throw new Error(`${target} probe digest mismatch`);
    return { target, route: route.route, file: file.path, sha256: file.sha256, status: 200 };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

export async function compilePortableRuntimeBundle({ current, rollback, bundle, rehearsal }) {
  for (const artifact of [current, rollback]) {
    const stat = await fs.lstat(artifact);
    if (!stat.isDirectory()) throw new Error(`artifact is not a directory: ${artifact}`);
  }
  if (await exists(bundle)) throw new Error(`bundle destination exists: ${bundle}`);
  if (rehearsal && await exists(rehearsal)) throw new Error(`rehearsal destination exists: ${rehearsal}`);

  const parent = path.dirname(bundle);
  await fs.mkdir(parent, { recursive: true });
  const staging = await fs.mkdtemp(path.join(parent, '.fia-bundle-'));
  try {
    const objectDirectory = path.join(staging, 'objects', 'sha256');
    await fs.mkdir(objectDirectory, { recursive: true });
    const seen = new Set();
    const currentArtifact = await compileArtifact(current, objectDirectory, seen);
    const rollbackArtifact = await compileArtifact(rollback, objectDirectory, seen);
    const launcher = Buffer.from(launcherSource());
    await writeExclusive(path.join(staging, 'run.mjs'), launcher, 0o555);

    const core = {
      schema: SCHEMA,
      policy: { runtime: 'node-http-v1', providerNeutral: true },
      launcher: { path: 'run.mjs', sha256: sha(launcher) },
      objects: { algorithm: 'sha256', count: seen.size },
      artifacts: { current: currentArtifact, rollback: rollbackArtifact },
    };
    const manifest = { ...core, identity: sha(stableBytes(core)) };
    await writeExclusive(path.join(staging, 'bundle-manifest.json'), stableBytes(manifest), 0o444);
    await fs.rename(staging, bundle);

    const probes = [await probe(bundle, 'current'), await probe(bundle, 'rollback')];
    const rehearsalCore = { schema: REHEARSAL_SCHEMA, bundle: manifest.identity, probes };
    const rehearsalRecord = { ...rehearsalCore, identity: sha(stableBytes(rehearsalCore)) };
    if (rehearsal) await writeExclusive(rehearsal, stableBytes(rehearsalRecord), 0o444);
    return { manifest, rehearsal: rehearsalRecord };
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const key of ['current', 'rollback', 'bundle']) {
    if (!args[key]) throw new Error(`--${key} is required`);
  }
  const result = await compilePortableRuntimeBundle({
    current: args.current,
    rollback: args.rollback,
    bundle: args.bundle,
    rehearsal: args.rehearsal,
  });
  console.log(JSON.stringify({ bundle: result.manifest.identity, rehearsal: result.rehearsal.identity }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
