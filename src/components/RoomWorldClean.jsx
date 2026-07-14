import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ROOMS, LAYERS_PER_ROOM, roomById } from '../world/roomCatalog';
import { createRoomAudio } from '../world/roomAudio';
import './RoomWorld.css';

const TAU=Math.PI*2,KEY='mirror-cartographer-room-world-v2';
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return{}}};
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return`rgba(${n>>16},${n>>8&255},${n&255},${a})`};
const rng=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);

function poly(c,x,y,r,n,a=0){c.beginPath();for(let i=0;i<=n;i++){const q=a+i/n*TAU,px=x+Math.cos(q)*r,py=y+Math.sin(q)*r;i?c.lineTo(px,py):c.moveTo(px,py)}c.closePath()}

function draw(c,room,layer,e){
  const {w,h,t,pointer,pulse}=e,min=Math.min(w,h),random=rng(layer.seed),r=min*(.045+layer.index*.02)*layer.scale;
  c.save();c.translate(w/2+(pointer.x-.5)*w*.05*layer.index/20,h/2+(pointer.y-.5)*h*.05*layer.index/20);c.rotate(layer.rotation+t*.000025*(room.gravity||.25));
  c.globalCompositeOperation=layer.index%3?'screen':'lighter';c.lineWidth=.5+(layer.index%4)*.25;c.strokeStyle=rgba(room.palette[2+layer.index%2],.055+layer.density*.11+pulse*.035);c.fillStyle=rgba(room.palette[2+layer.index%2],.018+layer.density*.035);const n=4+Math.floor(layer.density*12);
  if(['orbital','clock'].includes(layer.form)){for(let i=0;i<n;i++){c.beginPath();c.arc(Math.cos(i/n*TAU+t*.0002)*r*.18,Math.sin(i/n*TAU+t*.0002)*r*.18,r*(.2+i/n*.8),0,TAU);c.stroke()}}
  else if(['tide','thread','choir'].includes(layer.form)){for(let j=0;j<n;j++){c.beginPath();for(let i=0;i<55;i++){const x=-w*.55+i/54*w*1.1,y=Math.sin(i*.21+j*.62+t*.001+pointer.x*5)*r*.13+j*r*.045-r*.3;i?c.lineTo(x,y):c.moveTo(x,y)}c.stroke()}}
  else if(['crystal','mirror','maze'].includes(layer.form)){for(let i=0;i<n;i++){poly(c,0,0,r*(.16+i/n*.92),3+(i+room.portalShape)%7,i*.15);i%2?c.stroke():c.fill()}}
  else if(['spore','garden','hive'].includes(layer.form)){for(let i=0;i<n*2;i++){const a=random()*TAU,d=random()*r;c.beginPath();c.arc(Math.cos(a)*d,Math.sin(a)*d,1+random()*r*.05,0,TAU);i%3?c.stroke():c.fill()}}
  else if(['storm','ember'].includes(layer.form)){for(let i=0;i<n;i++){c.beginPath();let x=0,y=0;c.moveTo(0,0);for(let k=0;k<10;k++){x+=(random()-.5)*r*.28;y+=(random()-.4)*r*.24;c.lineTo(x,y)}c.stroke()}}
  else{for(let i=0;i<n;i++){c.save();c.rotate(i/n*TAU+t*.00008);c.translate(r*.3,0);poly(c,0,0,r*.15,3+(i+room.id)%6,i*.2);c.stroke();c.restore()}}
  c.restore();
}

function Map({state,enter,close}){return <div className="portal-map"><button className="map-close" onClick={close}>×</button><div className="portal-grid">{ROOMS.map(r=>{const open=state.unlocked.includes(r.id),seen=state.visited.includes(r.id);return <button key={r.id} disabled={!open} className={`portal ${open?'open':''} ${seen?'seen':''}`} style={{'--c':r.palette[2]}} onClick={()=>open&&enter(r.id)}><i>{open?'◇':'·'}</i></button>})}</div></div>}

export default function RoomWorldClean(){
  const saved=read();const [state,setState]=useState(()=>({unlocked:[1],visited:[1],depth:{1:1},energy:0,gestures:{},...saved}));const [roomId,setRoomId]=useState(saved.roomId||1),[depth,setDepth]=useState(saved.depth?.[saved.roomId||1]||1),[pulse,setPulse]=useState(.12),[map,setMap]=useState(false),[muted,setMuted]=useState(false);
  const room=useMemo(()=>roomById(roomId),[roomId]),canvas=useRef(null),pointer=useRef({x:.5,y:.5,down:false,startX:.5,startY:.5,start:0}),particles=useRef([]),audio=useRef(null);
  useEffect(()=>{audio.current=createRoomAudio();return()=>audio.current?.dispose()},[]);
  useEffect(()=>{localStorage.setItem(KEY,JSON.stringify({...state,roomId}))},[state,roomId]);
  useEffect(()=>{const id=setInterval(()=>setPulse(v=>Math.max(.06,v*.96)),100);return()=>clearInterval(id)},[]);
  useEffect(()=>{const el=canvas.current,c=el.getContext('2d');let af=0,start=performance.now();const size=()=>{const d=Math.min(2,devicePixelRatio||1),r=el.getBoundingClientRect();el.width=r.width*d;el.height=r.height*d;c.setTransform(d,0,0,d,0,0)};const frame=now=>{const q=el.getBoundingClientRect(),w=q.width,h=q.height,t=now-start,g=c.createRadialGradient(w*(.25+pointer.current.x*.5),h*(.2+pointer.current.y*.5),0,w/2,h/2,Math.max(w,h));g.addColorStop(0,room.palette[1]);g.addColorStop(.58,room.palette[0]);g.addColorStop(1,'#020207');c.globalCompositeOperation='source-over';c.fillStyle=g;c.fillRect(0,0,w,h);room.layers.slice(0,depth).forEach(l=>draw(c,room,l,{w,h,t,pointer:pointer.current,pulse}));for(let i=particles.current.length-1;i>=0;i--){const p=particles.current[i];p.life-=.014;p.x+=p.vx;p.y+=p.vy;if(p.life<=0){particles.current.splice(i,1);continue}c.globalCompositeOperation='lighter';c.fillStyle=rgba(room.palette[2+i%2],p.life);c.beginPath();c.arc(p.x*w,p.y*h,1+p.life*7,0,TAU);c.fill()}af=requestAnimationFrame(frame)};size();addEventListener('resize',size);af=requestAnimationFrame(frame);return()=>{cancelAnimationFrame(af);removeEventListener('resize',size)}},[room,depth,pulse]);

  const record=(boost,gesture)=>setState(s=>{const energy=s.energy+boost,unlocked=new Set(s.unlocked);ROOMS.forEach(r=>{if(energy>=r.unlockCost)unlocked.add(r.id)});const local=(s.depth?.[roomId]||1)+boost*.72;const next=Math.min(20,Math.max(depth,Math.floor(local)));setDepth(next);return{...s,energy,unlocked:[...unlocked].sort((a,b)=>a-b),visited:[...new Set([...s.visited,roomId])],depth:{...s.depth,[roomId]:next},gestures:{...s.gestures,[roomId]:[...new Set([...(s.gestures?.[roomId]||[]),gesture])]}}});
  const act=(e,type)=>{const r=e.currentTarget.getBoundingClientRect(),x=clamp((e.clientX-r.left)/r.width),y=clamp((e.clientY-r.top)/r.height),p=pointer.current,now=performance.now(),dx=x-p.x,dy=y-p.y,speed=Math.hypot(dx,dy);let gesture='tap';if(type==='down')pointer.current={...p,x,y,down:true,startX:x,startY:y,start:now};else if(type==='move'){pointer.current={...p,x,y};gesture=speed>.055?'rapid':Math.abs(dx)>Math.abs(dy)?'trace':'fold'}else{const d=Math.hypot(x-p.startX,y-p.startY);gesture=d>.25?'sweep':now-p.start>650?'hold':'tap';pointer.current={...p,x,y,down:false}}const boost=type==='move'&&p.down?.06:type==='down'?.72:type==='up'?.4:.01;record(boost,gesture);setPulse(v=>Math.min(1,v+boost*.3));if(!muted){audio.current?.wake();gesture==='hold'?audio.current?.chord(room,room.layers[Math.max(0,depth-1)],pulse):audio.current?.voice(room,room.layers[Math.max(0,depth-1)],pulse,x,y)}for(let i=0;i<(type==='down'?15:2);i++)particles.current.push({x,y,vx:(Math.random()-.5)*.006,vy:(Math.random()-.5)*.006,life:.4+Math.random()*.6})};
  const enter=id=>{setRoomId(id);setDepth(state.depth?.[id]||1);setMap(false);setState(s=>({...s,visited:[...new Set([...s.visited,id])]}))};
  return <main className="room-world" style={{'--p0':room.palette[0],'--p1':room.palette[1],'--p2':room.palette[2],'--p3':room.palette[3]}}><button className="world-surface" onPointerDown={e=>act(e,'down')} onPointerMove={e=>act(e,'move')} onPointerUp={e=>act(e,'up')} onPointerCancel={e=>act(e,'up')}><canvas ref={canvas}/></button><div className="depth-spine">{Array.from({length:LAYERS_PER_ROOM},(_,i)=><i key={i} className={i<depth?'lit':''}/>)}</div><button className="world-map-button" onClick={()=>setMap(true)}><span>✣</span><b>{state.unlocked.length}</b></button><button className={`sound-orb ${muted?'muted':''}`} onClick={()=>setMuted(v=>{const n=!v;n?audio.current?.silence():audio.current?.wake();return n})}><i/><i/><i/></button><div className="room-sigil"><i/><span>{Array.from({length:Math.min(9,Math.ceil(roomId/12))},(_,i)=><b key={i}/>)}</span></div>{depth===20&&<button className="completion-portal" onClick={()=>enter(state.unlocked.find(id=>!state.visited.includes(id))||state.unlocked[(state.unlocked.indexOf(roomId)+1)%state.unlocked.length]||1)}><i/></button>}{map&&<Map state={state} enter={enter} close={()=>setMap(false)}/>}</main>;
}
