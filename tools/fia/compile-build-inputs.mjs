#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SCHEMA = 'fia.build-input-manifest.v1';
const PLAN_SCHEMA = 'fia.build-input-plan.v1';
const sha256 = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));return value;}
const canonical = value => JSON.stringify(sort(value));
function fail(message){throw new Error(message);}
function posix(value){return value.split(path.sep).join('/');}
function validRel(value){return typeof value==='string'&&value.length>0&&!path.isAbsolute(value)&&!value.split(/[\\/]+/).some(part=>part===''||part==='.'||part==='..');}
function normalizeRel(value){if(!validRel(value))fail(`invalid relative path: ${value}`);return posix(path.normalize(value));}
function globRegex(pattern){
  const p=normalizeRel(pattern);let out='^';
  for(let i=0;i<p.length;i++){
    const c=p[i];
    if(c==='*'){
      if(p[i+1]==='*'){i++;if(p[i+1]==='/'){i++;out+='(?:.*/)?';}else out+='.*';}
      else out+='[^/]*';
    } else if(c==='?') out+='[^/]';
    else out+=c.replace(/[|\\{}()[\]^$+?.]/g,'\\$&');
  }
  return new RegExp(out+'$');
}
function overlaps(paths){
  const ordered=[...paths].sort();
  for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++)if(ordered[j].startsWith(ordered[i]+'/'))return [ordered[i],ordered[j]];
  return null;
}
function localExecutables(command){
  if(typeof command!=='string'||!command.trim())return [];
  const tokens=command.match(/(?:"[^"]*"|'[^']*'|[^\s;&|]+)/g)?.map(t=>t.replace(/^['"]|['"]$/g,''))??[];
  const found=[];
  for(let i=0;i<tokens.length;i++){
    const token=tokens[i];
    if((token==='node'||token===process.execPath)&&tokens[i+1]&&/^(?:\.\/)?[^-].*\.(?:mjs|cjs|js)$/.test(tokens[i+1]))found.push(tokens[i+1].replace(/^\.\//,''));
    else if(/^\.\//.test(token))found.push(token.slice(2));
  }
  return [...new Set(found.map(normalizeRel))].sort();
}
async function walk(root,rel,excludeMatchers,excluded){
  const absolute=path.join(root,rel),st=await lstat(absolute).catch(()=>null);
  if(!st)fail(`missing declared input: ${rel}`);
  if(st.isSymbolicLink())fail(`symbolic link rejected: ${rel}`);
  if(excludeMatchers.some(({regex})=>regex.test(rel))){excluded.add(rel);return [];}
  if(st.isFile()){
    const bytes=await readFile(absolute);return [{path:rel,bytes:bytes.length,sha256:sha256(bytes),mode:st.mode&0o777}];
  }
  if(!st.isDirectory())fail(`unsupported filesystem entry: ${rel}`);
  const output=[];
  for(const name of (await readdir(absolute)).sort())output.push(...await walk(root,posix(path.join(rel,name)),excludeMatchers,excluded));
  return output;
}
export async function compileBuildInputs({source='.',plan,output}){
  if(!plan)fail('input plan required');if(!output)fail('manifest output required');
  const sourceRoot=path.resolve(source),planPath=path.resolve(plan),planBytes=await readFile(planPath),value=JSON.parse(planBytes);
  if(value.schema!==PLAN_SCHEMA)fail(`unsupported input plan schema: ${value.schema}`);
  if(!Array.isArray(value.inputs)||value.inputs.length===0)fail('input plan requires inputs');
  const inputs=value.inputs.map(normalizeRel);if(new Set(inputs).size!==inputs.length)fail('duplicate declared input');
  const collision=overlaps(inputs);if(collision)fail(`overlapping declared inputs: ${collision[0]} contains ${collision[1]}`);
  const excludes=(value.excludes??[]).map(normalizeRel);if(new Set(excludes).size!==excludes.length)fail('duplicate exclusion');
  const excludeMatchers=excludes.map(pattern=>({pattern,regex:globRegex(pattern)}));
  const excluded=new Set(),files=[];
  for(const rel of [...inputs].sort())files.push(...await walk(sourceRoot,rel,excludeMatchers,excluded));
  files.sort((a,b)=>a.path.localeCompare(b.path));
  if(files.length===0)fail('declared inputs resolve to no files');
  const executables=localExecutables(value.command??'');
  const fileSet=new Set(files.map(file=>file.path));
  for(const executable of executables)if(!fileSet.has(executable))fail(`undeclared local executable: ${executable}`);
  const unmatchedExcludes=excludes.filter(pattern=>![...excluded].some(rel=>globRegex(pattern).test(rel)));
  if(unmatchedExcludes.length)fail(`exclusion matched no input: ${unmatchedExcludes[0]}`);
  const core={schema:SCHEMA,plan:sha256(planBytes),inputs:[...inputs].sort(),excludes:[...excludes].sort(),excluded:[...excluded].sort(),command:value.command?sha256(Buffer.from(value.command)):null,executables,files,status:'compiled'};
  const record={...core,manifest:sha256(Buffer.from(canonical(core)))};
  await mkdir(path.dirname(path.resolve(output)),{recursive:true});await writeFile(output,canonical(record)+'\n',{flag:'wx',mode:0o600});return record;
}
function args(argv){const out={};for(let i=0;i<argv.length;i++){const token=argv[i];if(!token.startsWith('--'))fail(`unexpected argument: ${token}`);out[token.slice(2)]=argv[++i];}return out;}
if(import.meta.url===`file://${process.argv[1]}`)compileBuildInputs(args(process.argv.slice(2))).then(record=>console.log(canonical(record))).catch(error=>{console.error(error.message);process.exitCode=1;});
