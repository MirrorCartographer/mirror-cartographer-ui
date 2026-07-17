#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SCHEMA = 'fia.portable-runtime-bundle.v1';
const POLICY = Object.freeze({
  historyFallback: false,
  htmlCache: 'no-cache',
  hashedAssetCache: 'public, max-age=31536000, immutable',
  assetCache: 'public, max-age=3600',
  headers: { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }
});

function hashBytes(bytes) { return `sha256:${createHash('sha256').update(bytes).digest('hex')}`; }
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function identity(value) { return hashBytes(Buffer.from(stable(value))); }
function fail(message) { throw new Error(message); }
async function writeExclusive(file, bytes, mode = 0o644) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const handle = await fs.open(file, 'wx', mode);
  try { await handle.writeFile(bytes); } finally { await handle.close(); }
}
async function inventoryTree(root) {
  const files = [];
  async function walk(dir, prefix='') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a,b)=>a.name.localeCompare(b.name));
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      const stat = await fs.lstat(full);
      if (stat.isSymbolicLink()) fail(`symlink rejected: ${rel}`);
      if (stat.isDirectory()) await walk(full, rel);
      else if (stat.isFile()) {
        const bytes = await fs.readFile(full);
        files.push({ path: rel, bytes: bytes.length, mode: stat.mode & 0o777, sha256: hashBytes(bytes), content: bytes });
      } else fail(`unsupported filesystem entry: ${rel}`);
    }
  }
  await walk(root);
  if (!files.some(f => f.path.endsWith('.html'))) fail(`artifact has no HTML routes: ${root}`);
  return files;
}
function routeFor(file) {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return `/${file.slice(0,-'index.html'.length)}`;
  return `/${file}`;
}
function publicEntry(files) {
  const routes = files.filter(f=>f.path.endsWith('.html')).map(f=>({ route: routeFor(f.path), path: f.path })).sort((a,b)=>a.route.localeCompare(b.route));
  return { files: files.map(({content,...f})=>f), routes, inventory: identity(files.map(({content,...f})=>f)) };
}
async function materializeObjects(bundleDir, allFiles) {
  const seen = new Map();
  for (const file of allFiles) {
    const hex = file.sha256.slice('sha256:'.length);
    const rel = `objects/sha256/${hex.slice(0,2)}/${hex.slice(2)}`;
    const existing = seen.get(file.sha256);
    if (existing && !existing.equals(file.content)) fail(`hash collision: ${file.sha256}`);
    if (!existing) {
      seen.set(file.sha256, file.content);
      await writeExclusive(path.join(bundleDir, rel), file.content, file.mode);
    }
    file.object = rel;
  }
}
const launcher = `#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await fs.readFile(path.join(here,'bundle-manifest.json'),'utf8'));
const args=new Map(process.argv.slice(2).map((v,i,a)=>v.startsWith('--')?[v,a[i+1]&&!a[i+1].startsWith('--')?a[i+1]:true]:null).filter(Boolean));
const target=args.get('--target')||'current'; if(!['current','rollback'].includes(target)) throw new Error('target must be current or rollback');
const host=String(args.get('--host')||'127.0.0.1'); const port=Number(args.get('--port')||8080); if(!Number.isInteger(port)||port<0||port>65535) throw new Error('invalid port');
const artifact=manifest.artifacts[target]; const byPath=new Map(artifact.files.map(f=>[f.path,f])); const routes=new Map(artifact.routes.map(r=>[r.route,r.path]));
const mime=p=>({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2'}[path.extname(p).toLowerCase()]||'application/octet-stream');
const hashed=p=>/[.-][a-f0-9]{8,}\./i.test(path.basename(p));
const server=createServer(async(req,res)=>{ try { const u=new URL(req.url,'http://local'); let p=routes.get(u.pathname); if(!p){ const raw=decodeURIComponent(u.pathname).replace(/^\//,''); if(byPath.has(raw))p=raw; else if(manifest.policy.historyFallback)p=routes.get('/'); }
if(!p){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found');return;} const f=byPath.get(p); const bytes=await fs.readFile(path.join(here,f.object)); const actual='sha256:'+createHash('sha256').update(bytes).digest('hex'); if(actual!==f.sha256) throw new Error('object identity mismatch: '+p);
const etag='"'+f.sha256.slice(7)+'"'; const headers={'content-type':mime(p),'etag':etag,'x-content-type-options':'nosniff','referrer-policy':'no-referrer','cache-control':p.endsWith('.html')?'no-cache':hashed(p)?'public, max-age=31536000, immutable':'public, max-age=3600'}; if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return;} if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{allow:'GET, HEAD'});res.end();return;} res.writeHead(200,{...headers,'content-length':bytes.length}); if(req.method==='HEAD')res.end(); else res.end(bytes);
}catch(error){res.writeHead(500,{'content-type':'text/plain; charset=utf-8'});res.end('Runtime verification failure');}});
server.listen(port,host,()=>{const a=server.address();console.log(JSON.stringify({schema:'fia.portable-runtime-start.v1',target,host,port:a.port,bundle:manifest.bundle}));});
const shutdown=()=>server.close(()=>process.exit(0)); process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
`;

async function probeImported(importDir, target) {
  const manifest = JSON.parse(await fs.readFile(path.join(importDir,'bundle-manifest.json'),'utf8'));
  const artifact = manifest.artifacts[target];
  const server = createServer(async (req,res)=>{
    const u = new URL(req.url,'http://local');
    const route = artifact.routes.find(r=>r.route===u.pathname);
    if (!route) { res.writeHead(404); res.end(); return; }
    const file = artifact.files.find(f=>f.path===route.path);
    const bytes = await fs.readFile(path.join(importDir,file.object));
    if (hashBytes(bytes)!==file.sha256) { res.writeHead(500); res.end(); return; }
    res.writeHead(200, {'content-type':'application/octet-stream'}); res.end(bytes);
  });
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port = server.address().port;
  const results=[];
  try {
    for (const route of artifact.routes) {
      const response=await fetch(`http://127.0.0.1:${port}${route.route}`);
      const bytes=Buffer.from(await response.arrayBuffer());
      results.push({route:route.route,status:response.status,sha256:hashBytes(bytes)});
      const expected=artifact.files.find(f=>f.path===route.path).sha256;
      if(response.status!==200||hashBytes(bytes)!==expected) fail(`imported runtime probe failed: ${target} ${route.route}`);
    }
  } finally { await new Promise(resolve=>server.close(resolve)); }
  return { target, routes: results, identity: identity(results) };
}

async function copyBundle(src,dst){
  await fs.mkdir(dst,{recursive:false});
  async function walk(dir,prefix=''){
    const entries=await fs.readdir(dir,{withFileTypes:true}); entries.sort((a,b)=>a.name.localeCompare(b.name));
    for(const e of entries){const rel=prefix?`${prefix}/${e.name}`:e.name;const from=path.join(dir,e.name);const to=path.join(dst,rel);const s=await fs.lstat(from);if(s.isSymbolicLink())fail(`bundle symlink rejected: ${rel}`);if(s.isDirectory()){await fs.mkdir(to);await walk(from,rel);}else if(s.isFile())await writeExclusive(to,await fs.readFile(from),s.mode&0o777);else fail(`unsupported bundle entry: ${rel}`);}
  }
  await walk(src);
}
function parseArgs(argv){const out={};for(let i=0;i<argv.length;i++){const a=argv[i];if(!a.startsWith('--'))fail(`unexpected argument: ${a}`);const key=a.slice(2);const value=argv[i+1];if(!value||value.startsWith('--'))fail(`missing value for ${a}`);out[key]=value;i++;}return out;}
export async function compilePortableRuntimeBundle(options){
  const current=path.resolve(options.current); const rollback=path.resolve(options.rollback); const bundleDir=path.resolve(options.bundle); const rehearsal=path.resolve(options.rehearsal);
  for(const p of [bundleDir,rehearsal]){try{await fs.lstat(p);fail(`destination exists: ${p}`);}catch(e){if(e.code!=='ENOENT')throw e;}}
  const [currentFiles,rollbackFiles]=await Promise.all([inventoryTree(current),inventoryTree(rollback)]);
  await fs.mkdir(bundleDir,{recursive:false});
  try{
    await materializeObjects(bundleDir,[...currentFiles,...rollbackFiles]);
    const currentPublic=publicEntry(currentFiles), rollbackPublic=publicEntry(rollbackFiles);
    const manifestCore={schema:SCHEMA,policy:POLICY,artifacts:{current:currentPublic,rollback:rollbackPublic},launcher:{path:'run.mjs',sha256:hashBytes(Buffer.from(launcher))}};
    const manifest={...manifestCore,bundle:identity(manifestCore)};
    await writeExclusive(path.join(bundleDir,'run.mjs'),Buffer.from(launcher),0o755);
    await writeExclusive(path.join(bundleDir,'bundle-manifest.json'),Buffer.from(`${stable(manifest)}\n`));
    await copyBundle(bundleDir,rehearsal);
    const importedManifest=JSON.parse(await fs.readFile(path.join(rehearsal,'bundle-manifest.json'),'utf8'));
    const importedCore={schema:importedManifest.schema,policy:importedManifest.policy,artifacts:importedManifest.artifacts,launcher:importedManifest.launcher};
    if(identity(importedCore)!==importedManifest.bundle)fail('imported bundle identity mismatch');
    const actualLauncher=hashBytes(await fs.readFile(path.join(rehearsal,importedManifest.launcher.path)));
    if(actualLauncher!==importedManifest.launcher.sha256)fail('imported launcher identity mismatch');
    for(const target of ['current','rollback'])for(const file of importedManifest.artifacts[target].files){const bytes=await fs.readFile(path.join(rehearsal,file.object));if(hashBytes(bytes)!==file.sha256)fail(`imported object mismatch: ${target}/${file.path}`);}
    const probes=[await probeImported(rehearsal,'current'),await probeImported(rehearsal,'rollback')];
    const attestationCore={schema:'fia.portable-runtime-bundle-rehearsal.v1',bundle:manifest.bundle,manifestFile:hashBytes(await fs.readFile(path.join(bundleDir,'bundle-manifest.json'))),targets:probes};
    const attestation={...attestationCore,rehearsal:identity(attestationCore)};
    await writeExclusive(path.join(bundleDir,'rehearsal.json'),Buffer.from(`${stable(attestation)}\n`));
    return {manifest,attestation};
  }catch(error){await fs.rm(bundleDir,{recursive:true,force:true});await fs.rm(rehearsal,{recursive:true,force:true});throw error;}
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){const a=parseArgs(process.argv.slice(2));compilePortableRuntimeBundle({current:a.current,rollback:a.rollback,bundle:a.bundle,rehearsal:a.rehearsal}).then(({manifest})=>console.log(manifest.bundle)).catch(e=>{console.error(e.message);process.exitCode=1;});}
