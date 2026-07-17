#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SCHEMA = 'fia.static-artifact-validation.v1';
const sha256 = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));return value;}
const canonical = value => JSON.stringify(sort(value));
function fail(message){throw new Error(message);}
const posix = value => value.split(path.sep).join('/');

async function inventory(root, rel=''){
  const absolute=path.join(root,rel), names=(await readdir(absolute)).sort(), out=[];
  for(const name of names){
    const child=path.join(rel,name), target=path.join(root,child), st=await lstat(target);
    if(st.isSymbolicLink())fail(`artifact symbolic link rejected: ${posix(child)}`);
    if(st.isDirectory())out.push(...await inventory(root,child));
    else if(st.isFile()){const bytes=await readFile(target);out.push({path:posix(child),bytes:bytes.length,sha256:sha256(bytes),mode:st.mode&0o777,content:bytes});}
    else fail(`unsupported artifact entry: ${posix(child)}`);
  }
  return out;
}
function routeFor(file){if(file==='index.html')return '/';if(file.endsWith('/index.html'))return `/${file.slice(0,-11)}/`;return `/${file}`;}
function attrs(tag){const out={};for(const match of tag.matchAll(/\s([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))out[match[1].toLowerCase()]=match[2]??match[3]??match[4]??'';return out;}
function stripText(value){return value.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();}
function resolveReference(from,ref){const clean=ref.split('#')[0].split('?')[0];if(!clean)return null;if(clean.startsWith('/'))return clean.slice(1)||'index.html';const base=path.posix.dirname(from);return path.posix.normalize(path.posix.join(base,clean));}
function localCandidates(ref){if(ref.endsWith('/'))return [`${ref}index.html`];if(path.posix.extname(ref))return [ref];return [ref,`${ref}.html`,`${ref}/index.html`];}
function issue(file,code,detail){return {file,code,detail};}

export async function validateStaticArtifact({artifact,output}){
  if(!artifact||!output)fail('artifact and output are required');
  const root=path.resolve(artifact), files=await inventory(root);if(!files.length)fail('artifact is empty');
  const paths=new Set(files.map(file=>file.path)), issues=[], routes=[];
  const provider=/\b(vercel(?:\.app)?|cloudflare|pages\.dev|github\.io|netlify(?:\.app)?)\b/i;
  for(const file of files){
    const text=file.content.toString('utf8');
    if(provider.test(text))issues.push(issue(file.path,'provider-coupling','hosted provider fingerprint found'));
    if(/\b(?:fetch|sendBeacon|WebSocket)\s*\(\s*["'](?:https?:)?\/\//i.test(text))issues.push(issue(file.path,'external-runtime-network','external runtime network call found'));
    if(!file.path.endsWith('.html'))continue;
    routes.push({route:routeFor(file.path),file:file.path});
    if(!/^\s*<!doctype html>/i.test(text))issues.push(issue(file.path,'missing-doctype','HTML document must declare doctype'));
    const htmlTag=text.match(/<html\b[^>]*>/i)?.[0];if(!htmlTag||!attrs(htmlTag).lang?.trim())issues.push(issue(file.path,'missing-language','html lang is required'));
    const viewport=[...text.matchAll(/<meta\b[^>]*>/gi)].map(match=>attrs(match[0])).find(a=>a.name?.toLowerCase()==='viewport');
    if(!viewport||!/width\s*=\s*device-width/i.test(viewport.content??''))issues.push(issue(file.path,'unsafe-mobile-viewport','viewport width=device-width is required'));
    if(viewport&&/(user-scalable\s*=\s*no|maximum-scale\s*=\s*(?:0|1(?:\.0+)?)(?:\D|$))/i.test(viewport.content??''))issues.push(issue(file.path,'zoom-disabled','mobile zoom must remain available'));
    if(!/<title\b[^>]*>\s*[^<\s][\s\S]*?<\/title>/i.test(text))issues.push(issue(file.path,'missing-title','non-empty title is required'));
    if(!/<main\b/i.test(text))issues.push(issue(file.path,'missing-main','main landmark is required'));
    if(!/<h1\b/i.test(text))issues.push(issue(file.path,'missing-h1','one page heading is required'));
    for(const match of text.matchAll(/<(audio|video)\b[^>]*>/gi))if('autoplay' in attrs(match[0]))issues.push(issue(file.path,'autoplay-prohibited',`${match[1].toLowerCase()} autoplay is prohibited`));
    for(const match of text.matchAll(/<img\b[^>]*>/gi)){const a=attrs(match[0]);if(!('alt' in a)&&a.role!=='presentation'&&a['aria-hidden']!=='true')issues.push(issue(file.path,'image-alt-missing','image requires alt text or explicit decorative semantics'));}
    for(const match of text.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)){const a=attrs(`<button ${match[1]}>`);if(!stripText(match[2])&&!a['aria-label']&&!a['aria-labelledby']&&!a.title)issues.push(issue(file.path,'button-name-missing','button requires an accessible name'));}
    for(const match of text.matchAll(/<(?:a|link|script|img|source|video|audio|form)\b[^>]*>/gi)){
      const a=attrs(match[0]), ref=a.href??a.src??a.action;if(!ref||/^(?:#|mailto:|tel:|data:|blob:|javascript:)/i.test(ref))continue;
      if(/^(?:https?:)?\/\//i.test(ref)){issues.push(issue(file.path,'external-reference',`external reference is not offline-safe: ${ref}`));continue;}
      const resolved=resolveReference(file.path,ref);if(resolved&&!localCandidates(resolved).some(candidate=>paths.has(candidate)))issues.push(issue(file.path,'broken-local-reference',`missing local target: ${ref}`));
    }
  }
  routes.sort((a,b)=>a.route.localeCompare(b.route)||a.file.localeCompare(b.file));
  if(!routes.length)issues.push(issue('.','no-routes','artifact contains no HTML routes'));
  const routeNames=routes.map(route=>route.route);if(new Set(routeNames).size!==routeNames.length)issues.push(issue('.','duplicate-route','multiple files resolve to the same route'));
  issues.sort((a,b)=>canonical(a).localeCompare(canonical(b)));
  const publicFiles=files.map(({content,...entry})=>entry);const core={schema:SCHEMA,artifact:sha256(Buffer.from(canonical(publicFiles))),files:publicFiles,routes,checks:{accessibility:true,mobileSafety:true,noAutoplay:true,offlineReferences:true,providerNeutrality:true,privacyNetwork:true},issues,status:issues.length?'rejected':'accepted'};
  const record={...core,validation:sha256(Buffer.from(canonical(core)))};await mkdir(path.dirname(path.resolve(output)),{recursive:true});await writeFile(path.resolve(output),canonical(record)+'\n',{flag:'wx',mode:0o600});if(issues.length)fail(`static artifact rejected with ${issues.length} issue(s)`);return record;
}
function args(argv){const out={};for(let i=0;i<argv.length;i++){const token=argv[i];if(!token.startsWith('--'))fail(`unexpected argument: ${token}`);out[token.slice(2)]=argv[++i];}return{artifact:out.artifact,output:out.output};}
if(import.meta.url===`file://${process.argv[1]}`)validateStaticArtifact(args(process.argv.slice(2))).then(record=>console.log(canonical(record))).catch(error=>{console.error(error.message);process.exitCode=1;});
