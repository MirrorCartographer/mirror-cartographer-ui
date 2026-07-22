#!/usr/bin/env python3
import argparse, hashlib, io, json, pathlib, stat, tarfile, unicodedata
TEXT_EXTENSIONS={'.css','.csv','.html','.js','.json','.jsx','.md','.mjs','.py','.sh','.svg','.toml','.ts','.tsx','.txt','.xml','.yaml','.yml'}
MAX_FILES=50000
MAX_BYTES=1073741824

def canonical(v): return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def sha256(b): return 'sha256:'+hashlib.sha256(b).hexdigest()
def fail(m): print(json.dumps({'status':'reject','reason':m},sort_keys=True)); raise SystemExit(1)
def add_file(tar,name,data,exe):
 i=tarfile.TarInfo(name); i.size=len(data); i.mode=0o755 if exe else 0o644; i.mtime=0; i.uid=i.gid=0; i.uname=i.gname=''; tar.addfile(i,io.BytesIO(data))
def build(source,output):
 source=pathlib.Path(source).resolve(); output=pathlib.Path(output).resolve(); output.mkdir(parents=True,exist_ok=True)
 files=[]
 for p in source.rglob('*'):
  if '.git' in p.parts: continue
  if p.is_symlink(): fail('symlink rejected')
  if p.is_file(): files.append(p)
 files.sort(key=lambda p:p.relative_to(source).as_posix().encode())
 if len(files)>MAX_FILES: fail('file-count limit')
 inv=[]; reader=[]; seen={}; total=0
 with tarfile.open(output/'source.tar','w',format=tarfile.PAX_FORMAT) as raw, tarfile.open(output/'reader-view.tar','w',format=tarfile.PAX_FORMAT) as view:
  for p in files:
   rel=p.relative_to(source).as_posix()
   if unicodedata.normalize('NFC',rel)!=rel or rel.casefold() in seen: fail('ambiguous path')
   seen[rel.casefold()]=rel; data=p.read_bytes(); total+=len(data)
   if total>MAX_BYTES: fail('byte limit')
   exe=bool(p.stat().st_mode & stat.S_IXUSR); add_file(raw,rel,data,exe)
   inv.append({'path':rel,'sha256':sha256(data),'bytes':len(data),'mode':'0755' if exe else '0644'})
   if p.suffix.lower() in TEXT_EXTENSIONS:
    try: text=data.decode('utf-8')
    except UnicodeDecodeError: fail('invalid UTF-8 text')
    normalized=unicodedata.normalize('NFC',text.replace('\r\n','\n').replace('\r','\n')).encode()
    add_file(view,rel,normalized,False)
    reader.append({'path':rel,'raw_sha256':sha256(data),'reader_sha256':sha256(normalized)})
 m={'schema':'fia.source-intake.v1','provider':None,'created_epoch':0,'raw_source':{'archive':'source.tar','archive_sha256':sha256((output/'source.tar').read_bytes()),'files':inv},'reader_view':{'archive':'reader-view.tar','archive_sha256':sha256((output/'reader-view.tar').read_bytes()),'files':reader,'authoritative_for_build':False}}
 m['intake_digest']=sha256(canonical(m)); (output/'source-intake.json').write_text(json.dumps(m,indent=2)+'\n'); print(m['intake_digest'])
if __name__=='__main__':
 p=argparse.ArgumentParser(); p.add_argument('source'); p.add_argument('output'); a=p.parse_args(); build(a.source,a.output)
