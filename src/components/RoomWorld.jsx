import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROOMS, ROOM_COUNT, LAYERS_PER_ROOM, roomById } from '../world/roomCatalog';
import { createRoomAudio } from '../world/roomAudio';
import './RoomWorld.css';

const TAU = Math.PI * 2;
const STORE = 'mirror-cartographer-room-world-v1';
const clamp = (v,a=0,b=1) => Math.min(b, Math.max(a,v));
const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } };
const initialProgress = () => ({ unlocked:[1], visited:[1], depth:{1:1}, energy:0, gestures:{}, ...load() });

function polygon(ctx,x,y,r,sides,rotation=0){ ctx.beginPath(); for(let i=0;i<=sides;i++){const a=rotation+i/sides*TAU; const px=x+Math.cos(a)*r; const py=y+Math.sin(a)*r; i?ctx.lineTo(px,py):ctx.moveTo(px,py);} ctx.closePath(); }
function color(hex, alpha){ const n=parseInt(hex.slice(1),16); return `rgba(${n>>16},${(n>>8)&255},${n&255},${alpha})`; }
function seeded(seed){ let s=seed>>>0; return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;}; }

function renderLayer(ctx, room, layer, env){
  const {w,h,t,pointer,activity}=env; const rnd=seeded(layer.seed); const min=Math.min(w,h); const p=room.palette;
  ctx.save(); ctx.globalCompositeOperation=layer.index%3===0?'lighter':'screen';
  ctx.translate(w/2,h/2); ctx.rotate(layer.rotation + t*(0.00003+layer.index*0.000002)*(room.gravity||.2));
  const alpha=.025+layer.density*.07+activity*.025; const radius=min*(.05+layer.index*.022)*layer.scale;
  ctx.strokeStyle=color(p[2+(layer.index%2)],alpha*2.2); ctx.fillStyle=color(p[2+(layer.index%2)],alpha*.55);
  ctx.lineWidth=.5+(layer.index%5)*.22;
  const pullX=(pointer.x-.5)*w*.08*(layer.index/LAYERS_PER_ROOM); const pullY=(pointer.y-.5)*h*.08*(layer.index/LAYERS_PER_ROOM);
  ctx.translate(pullX,pullY);
  const count=4+Math.floor(layer.density*13);
  if(layer.form==='orbital'||layer.form==='clock'){
    for(let i=0;i<count;i++){const a=i/count*TAU+t*.00015*(i%2?1:-1); ctx.beginPath();ctx.arc(Math.cos(a)*radius*.22,Math.sin(a)*radius*.22,radius*(.2+i/count*.7),0,TAU);ctx.stroke();}
  } else if(layer.form==='tide'||layer.form==='thread'||layer.form==='choir'){
    for(let j=0;j<count;j++){ctx.beginPath();for(let i=0;i<=48;i++){const x=-w*.55+i/48*w*1.1;const y=Math.sin(i*.22+j*.7+t*.001+pointer.x*4)*radius*.15+j*radius*.045-radius*.3;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}
  } else if(layer.form==='crystal'||layer.form==='mirror'){
    for(let i=0;i<count;i++){polygon(ctx,0,0,radius*(.18+i/count*.9),3+((room.portalShape+i)%7),layer.rotation+i*.17);i%2?ctx.stroke():ctx.fill();}
  } else if(layer.form==='spore'||layer.form==='garden'||layer.form==='hive'){
    for(let i=0;i<count*2;i++){const a=rnd()*TAU+t*.00008;const r=rnd()*radius;ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,1+rnd()*radius*.06,0,TAU);i%3?ctx.stroke():ctx.fill();}
  } else if(layer.form==='storm'||layer.form==='ember'){
    for(let i=0;i<count;i++){ctx.beginPath();let x=0,y=0;ctx.moveTo(0,0);for(let k=0;k<9;k++){x+=(rnd()-.5)*radius*.3;y+=(rnd()-.38)*radius*.25;ctx.lineTo(x,y);}ctx.stroke();}
  } else {
    for(let i=0;i<count;i++){const a=i/count*TAU;ctx.save();ctx.rotate(a+t*.00008);ctx.translate(radius*.3,0);polygon(ctx,0,0,radius*.16,3+((i+room.id)%6),a);ctx.stroke();ctx.restore();}
  }
  ctx.restore();
}

function useWorldCanvas(room, depth, pulse, pointerRef, particlesRef){
  const canvasRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return; const ctx=canvas.getContext('2d'); let raf=0; let start=performance.now();
    const resize=()=>{const d=Math.min(2,devicePixelRatio||1);const r=canvas.getBoundingClientRect();canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);};
    const frame=(now)=>{const r=canvas.getBoundingClientRect(),w=r.width,h=r.height,t=now-start;const g=ctx.createRadialGradient(w*(.3+pointerRef.current.x*.4),h*(.25+pointerRef.current.y*.4),0,w/2,h/2,Math.max(w,h));g.addColorStop(0,room.palette[1]);g.addColorStop(.58,room.palette[0]);g.addColorStop(1,'#020207');ctx.globalCompositeOperation='source-over';ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      const visible=Math.min(LAYERS_PER_ROOM,depth); for(let i=0;i<visible;i++)renderLayer(ctx,room,room.layers[i],{w,h,t,pointer:pointerRef.current,activity:pulse});
      const ps=particlesRef.current; for(let i=ps.length-1;i>=0;i--){const q=ps[i];q.life-=.012;q.x+=q.vx;q.y+=q.vy;q.vx*=.99;q.vy*=.99;if(q.life<=0){ps.splice(i,1);continue;}ctx.globalCompositeOperation='lighter';ctx.fillStyle=color(room.palette[2+(i%2)],q.life*.8);ctx.beginPath();ctx.arc(q.x*w,q.y*h,1+q.life*8,0,TAU);ctx.fill();}
      raf=requestAnimationFrame(frame);}; resize();addEventListener('resize',resize);raf=requestAnimationFrame(frame);return()=>{cancelAnimationFrame(raf);removeEventListener('resize',resize);};
  },[room,depth,pulse,pointerRef,particlesRef]);
  return canvasRef;
}

function PortalMap({progress,onEnter,onClose}){
  return <div className="portal-map" onPointerDown={e=>e.stopPropagation()}>
    <button className="map-close" onClick={onClose} aria-label="close">×</button>
    <div className="portal-grid">{ROOMS.map(room=>{const open=progress.unlocked.includes(room.id);const seen=progress.visited.includes(room.id);return <button key={room.id} disabled={!open} className={`portal ${open?'open':''} ${seen?'seen':''}`} style={{'--c':room.palette[2],'--s':`${room.portalShape}`}} onClick={()=>open&&onEnter(room.id)} aria-label={`room ${room.id}`}><i>{open?'◇':'·'}</i></button>;})}</div>
  </div>;
}

export default function RoomWorld(){
  const [progress,setProgress]=useState(initialProgress); const [roomId,setRoomId]=useState(()=>load().roomId||1); const [depth,setDepth]=useState(()=>load().depth?.[load().roomId||1]||1); const [pulse,setPulse]=useState(.18); const [map,setMap]=useState(false); const [muted,setMuted]=useState(false);
  const pointerRef=useRef({x:.5,y:.5,down:false,last:0,startX:.5,startY:.5}); const particlesRef=useRef([]); const audioRef=useRef(null); const room=useMemo(()=>roomById(roomId),[roomId]); const canvasRef=useWorldCanvas(room,depth,pulse,pointerRef,particlesRef);
  useEffect(()=>{audioRef.current=createRoomAudio();return()=>audioRef.current?.dispose();},[]);
  useEffect(()=>{localStorage.setItem(STORE,JSON.stringify({...progress,roomId}));},[progress,roomId]);
  useEffect(()=>{const id=setInterval(()=>setPulse(v=>Math.max(.08,v*.965)),100);return()=>clearInterval(id);},[]);

  const commit=(nextDepth,energyBoost,gesture)=>setProgress(p=>{
    const energy=p.energy+energyBoost; const unlocked=new Set(p.unlocked); ROOMS.forEach(r=>{if(energy>=r.unlockCost)unlocked.add(r.id);});
    const gestures={...p.gestures,[roomId]:[...new Set([...(p.gestures?.[roomId]||[]),gesture])].slice(-12)};
    return {...p,energy,unlocked:[...unlocked].sort((a,b)=>a-b),visited:[...new Set([...p.visited,roomId])],depth:{...p.depth,[roomId]:Math.max(p.depth?.[roomId]||1,nextDepth)},gestures};
  });

  const interact=(event,type)=>{
    const rect=event.currentTarget.getBoundingClientRect();const x=clamp((event.clientX-rect.left)/rect.width),y=clamp((event.clientY-rect.top)/rect.height);const now=performance.now();const old=pointerRef.current;
    pointerRef.current={...old,x,y,down:type==='down'?true:type==='up'?false:old.down,last:now};
    if(type==='down'){pointerRef.current.startX=x;pointerRef.current.startY=y;}
    const dx=x-(old.x??x),dy=y-(old.y??y),speed=Math.hypot(dx,dy); let gesture='tap';
    if(type==='move'&&old.down){gesture=speed>.06?'rapid':Math.abs(dx)>Math.abs(dy)?'trace':'fold';}
    if(type==='up'){const distance=Math.hypot(x-old.startX,y-old.startY);gesture=distance>.28?'sweep':now-old.last>700?'hold':'tap';}
    const boost=type==='move'&&old.down?.08:type==='down'?.65:type==='up'?.35:.01;const next=Math.min(LAYERS_PER_ROOM,Math.max(depth,1+Math.floor((progress.energy+boost)/Math.max(2,room.layers[Math.min(depth-1,19)].threshold))));
    if(next>depth)setDepth(next);setPulse(v=>Math.min(1,v+boost*.28));commit(next,boost,gesture);
    if(!muted){audioRef.current?.wake(); if(type==='up'&&gesture==='hold')audioRef.current?.chord(room,room.layers[next-1],pulse);else audioRef.current?.voice(room,room.layers[next-1],pulse,x,y);}
    for(let i=0;i<(type==='down'?18:3);i++)particlesRef.current.push({x,y,vx:(Math.random()-.5)*.006,vy:(Math.random()-.5)*.006,life:.4+Math.random()*.6});
  };

  const enter=(id)=>{setRoomId(id);const d=progress.depth?.[id]||1;setDepth(d);setMap(false);setProgress(p=>({...p,visited:[...new Set([...p.visited,id])]}));};
  const toggleAudio=()=>{setMuted(v=>{const n=!v;n?audioRef.current?.silence():audioRef.current?.wake();return n;});};

  return <main className="room-world" style={{'--p0':room.palette[0],'--p1':room.palette[1],'--p2':room.palette[2],'--p3':room.palette[3]}}>
    <button className="world-surface" onPointerDown={e=>interact(e,'down')} onPointerMove={e=>interact(e,'move')} onPointerUp={e=>interact(e,'up')} onPointerCancel={e=>interact(e,'up')} aria-label="explore"><canvas ref={canvasRef}/></button>
    <div className="depth-spine" aria-hidden="true">{Array.from({length:LAYERS_PER_ROOM},(_,i)=><i key={i} className={i<depth?'lit':''}/>)}</div>
    <button className="world-map-button" onClick={()=>setMap(true)} aria-label="map"><span>✣</span><b>{progress.unlocked.length}</b></button>
    <button className={`sound-orb ${muted?'muted':''}`} onClick={toggleAudio} aria-label="sound"><i/><i/><i/></button>
    <div className="room-sigil" aria-hidden="true"><i style={{'--n':room.portalShape}}/><span>{Array.from({length:Math.min(9,Math.ceil(roomId/12))},(_,i)=><b key={i}/>)}</span></div>
    {depth===LAYERS_PER_ROOM&&<button className="completion-portal" onClick={()=>{const next=progress.unlocked.find(id=>!progress.visited.includes(id))||progress.unlocked[(progress.unlocked.indexOf(roomId)+1)%progress.unlocked.length]||1;enter(next);}} aria-label="portal"><i/></button>}
    {map&&<PortalMap progress={progress} onEnter={enter} onClose={()=>setMap(false)}/>} 
  </main>;
}
