#!/usr/bin/env python3
"""Read-only project daemon: checks local links, HTML IDs and basic control labels."""
import json, re
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
ROOT=Path.cwd(); REPORT=ROOT/"daemon-reports"; IGNORE={".git",".github","node_modules","dist","build",".vercel",".next"}
EXTS={".html",".htm",".md",".markdown"}; SKIP={"http","https","mailto","tel","javascript","data","blob"}
class Parser(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True); self.ids=Counter(); self.links=[]; self.warnings=[]; self.labels=set(); self.button=None
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if a.get("id"): self.ids[a["id"]]+=1
  if tag in ("a","area") and a.get("href"): self.links.append(a["href"])
  if tag=="label" and a.get("for"): self.labels.add(a["for"])
  if tag=="button": self.button={"text":"","aria":a.get("aria-label"),"title":a.get("title")}
  if tag=="input" and a.get("type","text") not in {"hidden","submit","button","reset"} and not (a.get("aria-label") or a.get("title") or (a.get("id") and a["id"] in self.labels)):
   self.warnings.append({"kind":"unlabelled_control","detail":"input type="+a.get("type","text")+" id="+a.get("id","(none)")})
 def handle_data(self,data):
  if self.button is not None: self.button["text"]+=data.strip()
 def handle_endtag(self,tag):
  if tag=="button" and self.button is not None:
   if not (self.button["text"] or self.button["aria"] or self.button["title"]): self.warnings.append({"kind":"unnamed_button","detail":"button has no accessible name"})
   self.button=None
def resolve(source,raw):
 u=urlsplit(raw.strip())
 if u.scheme.lower() in SKIP or u.netloc: return None,None
 p,frag=unquote(u.path),unquote(u.fragment)
 target=source if not p else ((ROOT/p.lstrip("/")) if p.startswith("/") else source.parent/p)
 target=target.resolve()
 try: target.relative_to(ROOT.resolve())
 except ValueError: return None,frag
 if target.is_dir(): target=target/"index.html"
 return target,frag
def main():
 cfg=json.loads((ROOT/"daemons/config.json").read_text())
 files=[p for p in ROOT.rglob("*") if p.is_file() and p.suffix.lower() in EXTS and not any(x in IGNORE for x in p.parts)]
 errors=[]; warnings=[]; inventory=[]
 for p in files:
  rel=p.relative_to(ROOT).as_posix(); raw=p.read_text(encoding="utf-8",errors="replace")
  if p.suffix.lower() in {".html",".htm"}:
   parser=Parser()
   try: parser.feed(raw)
   except Exception as exc: errors.append({"file":rel,"kind":"html_parse","detail":str(exc)}); continue
   for key,count in parser.ids.items():
    if count>1: warnings.append({"file":rel,"kind":"duplicate_id","detail":key+" appears "+str(count)+" times"})
   warnings.extend({"file":rel,**w} for w in parser.warnings); links=parser.links
   inventory.append({"file":rel,"kind":"html","ids":len(parser.ids),"links":len(links),"warnings":len(parser.warnings)})
  else:
   links=re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',raw); inventory.append({"file":rel,"kind":"markdown","links":len(links)})
  for link in links:
   target,frag=resolve(p,link)
   if target is None: continue
   if not target.exists(): errors.append({"file":rel,"kind":"broken_local_link","detail":link}); continue
   if frag and target.suffix.lower() in {".html",".htm"}:
    check=Parser(); check.feed(target.read_text(encoding="utf-8",errors="replace"))
    if not check.ids[frag]: errors.append({"file":rel,"kind":"missing_fragment","detail":link})
 REPORT.mkdir(exist_ok=True)
 result={"project":cfg["project"],"role":cfg["role"],"generated_at":datetime.now(timezone.utc).isoformat(),"files_scanned":len(files),"html_pages":sum(x["kind"]=="html" for x in inventory),"markdown_pages":sum(x["kind"]=="markdown" for x in inventory),"errors":errors,"warnings":warnings,"inventory":inventory,"guardrails":cfg.get("guardrails",[])}
 (REPORT/"latest.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
 lines=["# "+cfg["project"]+" — daemon report","", "Generated: "+result["generated_at"],"Files scanned: "+str(len(files)),"HTML pages: "+str(result["html_pages"]),"Markdown pages: "+str(result["markdown_pages"]),"Integrity findings: "+str(len(errors)),"Structural/accessibility warnings: "+str(len(warnings)),"","## Findings"]
 lines += ["- "+e["file"]+" — "+e["kind"]+": "+e["detail"] for e in errors] or ["- No broken local links or missing HTML fragments detected."]
 lines += ["","## Warnings"]+["- "+w["file"]+" — "+w["kind"]+": "+w["detail"] for w in warnings] or ["- No structural warnings detected."]
 lines += ["","## Next action","- Review findings and prioritize fixes; this baseline monitor does not block project work.","","## Safety","- Read-only inspection; no source files were modified."]
 (REPORT/"latest.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
 print("DAEMON_RESULT errors="+str(len(errors))+" warnings="+str(len(warnings))+" files="+str(len(files)))
if __name__=="__main__": main()
