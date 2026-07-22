#!/usr/bin/env python3
import argparse, hashlib, json, pathlib, re
DIGEST=re.compile(r'^sha256:[0-9a-f]{64}$')
def canonical(v): return json.dumps(v,sort_keys=True,separators=(',',':')).encode()
def digest(v): return 'sha256:'+hashlib.sha256(canonical(v)).hexdigest()
def reject(reason): print(json.dumps({'status':'reject','reason':reason},sort_keys=True)); raise SystemExit(1)
def main():
 ap=argparse.ArgumentParser(); ap.add_argument('job'); ap.add_argument('--emit',default='-'); a=ap.parse_args()
 j=json.loads(pathlib.Path(a.job).read_text()); u=dict(j); supplied=u.pop('job_digest',None)
 if j.get('schema')!='fia.isolated-build-job.v1': reject('schema')
 if supplied!=digest(u): reject('job digest mismatch')
 if not DIGEST.match(j.get('image_digest','')): reject('image must be content-addressed')
 if not isinstance(j.get('command'),list) or not j['command'] or not all(isinstance(x,str) and x for x in j['command']): reject('command')
 L=j.get('limits',{})
 for k in ('cpus','memory_mb','pids','timeout_seconds'):
  if L.get(k,0)<=0: reject('invalid limit: '+k)
 M=j.get('mounts',{})
 if M.get('source')!={'host':'./source','container':'/workspace/source','mode':'ro'}: reject('source mount')
 if M.get('output')!={'host':'./output','container':'/workspace/output','mode':'rw'}: reject('output mount')
 E={'CI':'true','TZ':'UTC','LANG':'C.UTF-8','LC_ALL':'C.UTF-8','SOURCE_DATE_EPOCH':'0','HOME':'/tmp/home'}
 if j.get('environment')!=E: reject('environment is not closed')
 if j.get('network')!='none': reject('network')
 if j.get('rootfs')!='read-only': reject('rootfs')
 if j.get('userns')!='keep-id': reject('userns')
 if j.get('privileges')!={'cap_drop':['ALL'],'no_new_privileges':True}: reject('privileges')
 if j.get('pull_policy')!='never': reject('pull policy')
 argv=['podman','run','--rm','--network=none','--read-only','--read-only-tmpfs=false','--userns=keep-id','--cap-drop=ALL','--security-opt=no-new-privileges','--pull=never',f"--cpus={L['cpus']}",f"--memory={L['memory_mb']}m",f"--pids-limit={L['pids']}",'--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=256m','--mount=type=bind,src=./source,dst=/workspace/source,ro=true','--mount=type=bind,src=./output,dst=/workspace/output,rw=true','--workdir=/workspace/source']
 for k,v in sorted(E.items()): argv+=['--env',f'{k}={v}']
 argv += [j['image_digest'],*j['command']]
 r={'schema':'fia.isolation-command.v1','job_digest':supplied,'engine':'podman','argv':argv,'timeout_seconds':L['timeout_seconds'],'security_claims':{'rootless_required':True,'network_denied':True,'rootfs_read_only':True,'source_read_only':True,'capabilities_dropped':True,'new_privileges_denied':True,'resource_limits_requested':True,'image_content_addressed':True,'image_pull_disabled':True}}
 r['receipt_digest']=digest(r); out=json.dumps(r,indent=2)+'\n'
 print(out,end='') if a.emit=='-' else pathlib.Path(a.emit).write_text(out)
if __name__=='__main__': main()
