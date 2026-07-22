#!/usr/bin/env python3
import argparse, json, os
from collections import Counter, deque
from pathlib import Path

Grid = list[list[int]]

def rot(g): return [list(r) for r in zip(*g[::-1])]
def flip_h(g): return [r[::-1] for r in g]
def flip_v(g): return g[::-1]
def transpose(g): return [list(r) for r in zip(*g)]
def recolor(g, mp): return [[mp.get(v,v) for v in r] for r in g]
def tile(g, ry, rx): return [sum((r[:] for _ in range(rx)), []) for _ in range(ry) for r in g]
def upscale(g, sy, sx): return [[v for v in r for _ in range(sx)] for r in g for _ in range(sy)]

def bg(g): return Counter(v for r in g for v in r).most_common(1)[0][0]
def crop_nonbg(g):
    b=bg(g); pts=[(y,x) for y,r in enumerate(g) for x,v in enumerate(r) if v!=b]
    if not pts: return [row[:] for row in g]
    ys=[p[0] for p in pts]; xs=[p[1] for p in pts]
    return [r[min(xs):max(xs)+1] for r in g[min(ys):max(ys)+1]]

def crop_color(g,c):
    pts=[(y,x) for y,r in enumerate(g) for x,v in enumerate(r) if v==c]
    if not pts: return None
    ys=[p[0] for p in pts]; xs=[p[1] for p in pts]
    return [r[min(xs):max(xs)+1] for r in g[min(ys):max(ys)+1]]

def components(g, diagonal=False):
    h,w=len(g),len(g[0]); b=bg(g); seen=set(); out=[]
    ds=[(-1,0),(1,0),(0,-1),(0,1)] + ([(-1,-1),(-1,1),(1,-1),(1,1)] if diagonal else [])
    for y in range(h):
      for x in range(w):
       if (y,x) in seen or g[y][x]==b: continue
       c=g[y][x]; q=[(y,x)]; seen.add((y,x)); pts=[]
       while q:
        a,d=q.pop(); pts.append((a,d))
        for dy,dx in ds:
         ny,nx=a+dy,d+dx
         if 0<=ny<h and 0<=nx<w and (ny,nx) not in seen and g[ny][nx]==c:
          seen.add((ny,nx)); q.append((ny,nx))
       out.append((c,pts))
    return out

def crop_component(g, which):
    cs=components(g)
    if not cs: return None
    cs=sorted(cs,key=lambda z:len(z[1]))
    c,pts = cs[-1] if which=='largest' else cs[0]
    ys=[p[0] for p in pts]; xs=[p[1] for p in pts]; b=bg(g)
    ans=[[b]*(max(xs)-min(xs)+1) for _ in range(max(ys)-min(ys)+1)]
    for y,x in pts: ans[y-min(ys)][x-min(xs)]=g[y][x]
    return ans

def gravity(g, direction):
    h,w=len(g),len(g[0]); b=bg(g); out=[[b]*w for _ in range(h)]
    if direction in ('down','up'):
      for x in range(w):
       vals=[g[y][x] for y in range(h) if g[y][x]!=b]
       ys=range(h-len(vals),h) if direction=='down' else range(len(vals))
       for y,v in zip(ys,vals): out[y][x]=v
    else:
      for y in range(h):
       vals=[v for v in g[y] if v!=b]
       xs=range(w-len(vals),w) if direction=='right' else range(len(vals))
       for x,v in zip(xs,vals): out[y][x]=v
    return out

def color_map_from_pair(i,o):
    if len(i)!=len(o) or len(i[0])!=len(o[0]): return None
    mp={}
    for a,b in zip((v for r in i for v in r),(v for r in o for v in r)):
      if a in mp and mp[a]!=b: return None
      mp[a]=b
    return mp

def infer_maps(train):
    maps=[]
    for p in train:
      m=color_map_from_pair(p['input'],p['output'])
      if m is None: return []
      maps.append(m)
    merged={}
    for m in maps:
      for k,v in m.items():
       if k in merged and merged[k]!=v: return []
       merged[k]=v
    return [('recolor',lambda g,m=merged:recolor(g,m))]

def candidates(train):
    funcs=[
      ('identity',lambda g:g),('rot90',rot),('rot180',lambda g:rot(rot(g))),('rot270',lambda g:rot(rot(rot(g)))),
      ('flip_h',flip_h),('flip_v',flip_v),('transpose',transpose),('anti_transpose',lambda g:flip_h(transpose(flip_h(g)))),
      ('crop_nonbg',crop_nonbg),('largest_component',lambda g:crop_component(g,'largest')),('smallest_component',lambda g:crop_component(g,'smallest')),
      ('gravity_down',lambda g:gravity(g,'down')),('gravity_up',lambda g:gravity(g,'up')),('gravity_left',lambda g:gravity(g,'left')),('gravity_right',lambda g:gravity(g,'right')),
    ]
    funcs += infer_maps(train)
    # infer fixed scale/tile ratios from demonstrations
    ratios=set()
    for p in train:
      ih,iw=len(p['input']),len(p['input'][0]); oh,ow=len(p['output']),len(p['output'][0])
      if oh%ih==0 and ow%iw==0: ratios.add((oh//ih,ow//iw))
    for sy,sx in ratios:
      if sy>1 or sx>1:
       funcs += [(f'upscale_{sy}x{sx}',lambda g,sy=sy,sx=sx:upscale(g,sy,sx)),(f'tile_{sy}x{sx}',lambda g,sy=sy,sx=sx:tile(g,sy,sx))]
    colors=sorted(set(v for p in train for r in p['input'] for v in r))
    for c in colors: funcs.append((f'crop_color_{c}',lambda g,c=c:crop_color(g,c)))
    # compositions, deliberately bounded
    base=list(funcs)
    geometric=base[:9]
    for n1,f1 in geometric:
      for n2,f2 in base:
       funcs.append((n1+'__'+n2,lambda g,f1=f1,f2=f2: f2(f1(g))))
    return funcs

def safe_apply(f,g):
    try:
      x=f([r[:] for r in g])
      if x and isinstance(x,list) and isinstance(x[0],list): return x
    except Exception: pass
    return None

def solve(task):
    valid=[]
    for name,f in candidates(task['train']):
      if all(safe_apply(f,p['input'])==p['output'] for p in task['train']): valid.append((name,f))
    preds=[]
    for name,f in valid:
      out=[safe_apply(f,p['input']) for p in task['test']]
      if out not in [x[1] for x in preds]: preds.append((name,out))
      if len(preds)>=3: break
    return preds

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('data'); ap.add_argument('--report',default='arc1_report.json'); a=ap.parse_args()
    files=sorted(Path(a.data).glob('*.json')); solved=0; report=[]
    for fp in files:
      task=json.loads(fp.read_text()); preds=solve(task); truth=[p['output'] for p in task['test']]
      ok=any(out==truth for _,out in preds); solved+=ok
      report.append({'task':fp.stem,'solved':ok,'programs':[n for n,_ in preds]})
    total=len(files); pct=100*solved/total if total else 0
    result={'solved':solved,'total':total,'percentage':pct,'metric':'task exact match; up to 3 candidate programs selected solely by training-pair fit','tasks':report}
    Path(a.report).write_text(json.dumps(result,indent=2))
    print(json.dumps({k:result[k] for k in ('solved','total','percentage','metric')},indent=2))
    summary=os.getenv('GITHUB_STEP_SUMMARY')
    if summary:
      with open(summary,'a') as f:f.write(f'# Lyr ARC-AGI-1 baseline\n\n**{solved}/{total} tasks = {pct:.2f}%**\n\n{result["metric"]}\n')

if __name__=='__main__': main()
