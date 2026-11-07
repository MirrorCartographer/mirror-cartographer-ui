#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_PATTERNS = [
  {id:"vercel", re:/\bvercel\b|VERCEL_|\.vercel\b|vercel\.json/ig},
  {id:"cloudflare", re:/\bcloudflare\b|\bwrangler\b|CF_PAGES_|pages\.dev/ig},
  {id:"github-pages", re:/github\.io|build:pages|gh-pages|GITHUB_PAGES/ig},
];
const DEFAULT_EXTENSIONS = new Set([".js",".mjs",".cjs",".ts",".tsx",".jsx",".json",".html",".css",".md",".yml",".yaml",".toml",".sh"]);
const DEFAULT_IGNORES = new Set([".git","node_modules","dist","build","coverage",".cache"]);
function digest(value) { return "sha256:"+crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function walk(root,current=root,out=[]) {
  for (const name of fs.readdirSync(current).sort()) {
    if (DEFAULT_IGNORES.has(name)) continue;
    const full=path.join(current,name); const st=fs.lstatSync(full); const rel=path.relative(root,full).split(path.sep).join("/");
    if (st.isSymbolicLink()) throw new Error(`symlink rejected: ${rel}`);
    if (st.isDirectory()) walk(root,full,out);
    else if (st.isFile() && DEFAULT_EXTENSIONS.has(path.extname(name))) out.push({full,rel});
  }
  return out;
}
function allowedHit(hit, allowed) {
  return allowed.some(rule => rule.provider===hit.provider && (rule.path===hit.path || (rule.path_prefix && hit.path.startsWith(rule.path_prefix))) && rule.scope==="migration-only");
}
export function scan(root,policy={allowed:[]}) {
  const files=walk(root); const hits=[];
  for (const file of files) {
    const text=fs.readFileSync(file.full,"utf8");
    for (const p of DEFAULT_PATTERNS) {
      p.re.lastIndex=0;
      for (const match of text.matchAll(p.re)) {
        const line=text.slice(0,match.index).split("\n").length;
        const hit={provider:p.id,path:file.rel,line,match:match[0]};
        hits.push({...hit,classification:allowedHit(hit,policy.allowed||[])?"migration-only":"blocking"});
      }
    }
  }
  hits.sort((a,b)=>a.path.localeCompare(b.path)||a.line-b.line||a.provider.localeCompare(b.provider));
  const blocking=hits.filter(h=>h.classification==="blocking");
  const report={schema:"fia.provider-coupling-report.v1",root:path.resolve(root),scanned_files:files.length,hits,summary:{total:hits.length,blocking:blocking.length,migration_only:hits.length-blocking.length}};
  report.report_digest=digest({...report,root:"<normalized>"}); return report;
}
function main() {
  const args=process.argv.slice(2); const root=args.find(a=>!a.startsWith("--"))||".";
  const policyArg=args.find(a=>a.startsWith("--policy=")); const outArg=args.find(a=>a.startsWith("--out="));
  const policy=policyArg?JSON.parse(fs.readFileSync(policyArg.split("=").slice(1).join("="),"utf8")):{allowed:[]};
  const report=scan(root,policy); const body=JSON.stringify(report,null,2)+"\n";
  if (outArg) fs.writeFileSync(outArg.split("=").slice(1).join("="),body); else process.stdout.write(body);
  process.exit(report.summary.blocking===0?0:1);
}
if (import.meta.url===`file://${process.argv[1]}`) main();
