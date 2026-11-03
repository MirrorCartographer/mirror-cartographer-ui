/* Mirror Cartographer — ten distinct procedural room grammars.
   Shared only at the level of canvas lifecycle, input, accessibility and sound.
   Each room owns its own composition, motion, response and transformation. */
(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const mode = document.body.dataset.mode || 'field';
  const TAU = Math.PI * 2;
  const palettes = {
    observatory: ['#02040b','#0c1933','#a9d5ff','#fff0d5'],
    garden: ['#040d08','#10291b','#86d99b','#f3d78a'],
    cathedral: ['#030911','#102b40','#9de8ff','#f1f6ff'],
    carnival: ['#13020d','#48103b','#ffbd6c','#f4a6ed'],
    ocean: ['#010712','#063451','#4ed4d0','#d1f7ff'],
    blueprint: ['#061126','#0c2c4d','#8ac7ff','#e8f3ff'],
    library: ['#100a10','#38202b','#e7b77e','#f9e8c8'],
    forest: ['#03100b','#12392b','#9bd99a','#e5e8ad'],
    museum: ['#090613','#25183a','#c8a7ff','#f3d8b6'],
    composer: ['#08050f','#28113b','#e8a7ff','#a7e6ff']
  };
  const palette = palettes[mode] || palettes.observatory;
  const seed = [...mode].reduce((a,c) => Math.imul(a ^ c.charCodeAt(0),16777619) >>> 0,2166136261);
  const rand = n => { const v=Math.sin((seed>>>0)*.0000917+(n+1)*44.321)*43758.5453; return v-Math.floor(v); };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  let W=0,H=0,D=1,time=0,raf=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let intensity=.72,hue=0,phase=0,gesture=0,soundOn=false,audio=null,master=null;
  const pointer={x:.5,y:.5,down:false,px:.5,py:.5};
  const points=Array.from({length:150},(_,i)=>({x:rand(i*3),y:rand(i*3+1),r:.5+rand(i*3+2)*2.2,seed:i}));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function resize(){D=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;canvas.width=Math.max(1,Math.round(W*D));canvas.height=Math.max(1,Math.round(H*D));ctx.setTransform(D,0,0,D,0,0);}
  addEventListener('resize',resize,{passive:true});resize();
  function color(hex,alpha=1){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${alpha})`;}
  function line(x1,y1,x2,y2,stroke,width=1){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function circle(x,y,r,fill,stroke=null){ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function glow(x,y,r,c,a=.25){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color(c,a));g.addColorStop(1,color(c,0));ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
  function background(){const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,palette[1]);g.addColorStop(.58,palette[0]);g.addColorStop(1,'#010207');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}

  function observatory(){
    background();const cx=W*(.5+(pointer.x-.5)*.08),cy=H*(.48+(pointer.y-.5)*.08),unit=Math.min(W,H);
    for(let i=0;i<points.length;i++){const p=points[i],x=p.x*W,y=p.y*H;circle(x,y,p.r*(.7+Math.sin(time*1.2+i)*.3),color(p.seed%5?palette[2]:palette[3],.25+rand(i)*.65*intensity));}
    const stars=points.slice(0,52).map(p=>({x:p.x*W,y:p.y*H}));
    for(let i=0;i<stars.length;i++){let near=[];for(let j=0;j<stars.length;j++){if(i===j)continue;const d=Math.hypot(stars[i].x-stars[j].x,stars[i].y-stars[j].y);if(d<unit*.17)near.push([d,j]);}near.sort((a,b)=>a[0]-b[0]).slice(0,2).forEach(([d,j])=>{if(j>i)line(stars[i].x,stars[i].y,stars[j].x,stars[j].y,color(palette[2],(1-d/(unit*.17))*.13*intensity));});}
    for(let k=0;k<4;k++){const r=unit*(.09+k*.105),a=time*(.1+k*.018)+phase+k*1.3;ctx.beginPath();ctx.ellipse(cx,cy,r,r*(.25+k*.08),-.35+k*.18,0,TAU);ctx.strokeStyle=color(palette[2],.12*intensity);ctx.stroke();circle(cx+Math.cos(a)*r,cy+Math.sin(a)*r*(.25+k*.08),2+k*.6,palette[3]);}
    glow(cx,cy,unit*.18,palette[2],.1);
  }
  function garden(){
    background();const floor=H*.91;line(0,floor,W,floor,color(palette[2],.25));
    function branch(x,y,len,angle,depth,seed){if(depth<=0||len<3)return;const sway=Math.sin(time*.65+seed)*.13+Math.sin(phase+seed*.7)*.09;const a=angle+sway+(pointer.x-.5)*.08;const nx=x+Math.cos(a)*len,ny=y+Math.sin(a)*len;line(x,y,nx,ny,color(palette[2],.18+depth*.055),Math.max(.7,depth*.7));if(depth<4){const bloom=5+rand(seed)*8;glow(nx,ny,bloom*3,palette[3],.2);circle(nx,ny,bloom,color(palette[3],.45));}branch(nx,ny,len*.73,a-.34-rand(seed)*.2,depth-1,seed+3);branch(nx,ny,len*.72,a+.38+rand(seed+1)*.2,depth-1,seed+7);}
    for(let i=0;i<13;i++){const x=(i+.5)*W/13;branch(x,floor, H*(.12+rand(i)*.18),-Math.PI/2+(rand(i+40)-.5)*.25,5+(i%3),i+phase*2);}
    for(let i=0;i<45;i++){const x=rand(i+100)*W,y=H*(.2+rand(i+200)*.65);circle(x,y,1+rand(i+300)*2,color(palette[3],.15+.3*intensity));}
    if(gesture){for(let i=0;i<gesture%9;i++){const x=pointer.x*W+(i-4)*18,y=pointer.y*H+Math.sin(time+i)*12;circle(x,y,4+i%3,color(palette[3],.5));}}
  }
  function cathedral(){
    background();const cx=W/2,base=H*.94,top=H*.12,span=Math.min(W*.44,H*.4);
    for(let i=0;i<19;i++){const q=i/18,x=cx+(q-.5)*W*.92,peak=top+Math.sin(q*Math.PI)*H*.3;ctx.beginPath();ctx.moveTo(x,base);ctx.bezierCurveTo(x-span*.12,base*.65,cx+(q-.5)*span,peak,x,top);ctx.strokeStyle=color(palette[2],(.1+.12*Math.sin(time+i*.4)**2)*intensity);ctx.lineWidth=1+i%3*.25;ctx.stroke();}
    for(let ring=0;ring<15;ring++){const r=24+ring*Math.min(W,H)*.035+Math.sin(time*1.7+ring*.45+phase)*7;ctx.beginPath();ctx.ellipse(cx,H*.52,r,r*.42,0,0,TAU);ctx.strokeStyle=color(ring%3?palette[2]:palette[3],(.19-ring*.008)*intensity);ctx.stroke();}
    const bars=100;for(let i=0;i<bars;i++){const q=i/bars,x=q*W,amp=10+Math.abs(Math.sin(q*31+time*1.4+phase))*H*.13;line(x,base,x,base-amp,color(palette[3],.15+amp/H*.55),1);}
    glow(cx,H*.46,Math.min(W,H)*.24,palette[2],.08);
  }
  function carnival(){
    background();const cx=W/2,cy=H/2,scale=Math.min(W,H),spin=time*.22+phase*.3;
    for(let i=0;i<17;i++){const a=spin+i*TAU/17,r=scale*(.1+(i%5)*.07),x=cx+Math.cos(a)*r*1.25,y=cy+Math.sin(a*1.7)*r*.8;ctx.save();ctx.translate(x,y);ctx.rotate(-a*.6);const w=scale*(.045+(i%4)*.012),h=scale*(.07+(i%3)*.02);ctx.fillStyle=`hsla(${(i*27+hue+phase*11)%360},80%,58%,.12)`;ctx.fillRect(-w/2,-h/2,w,h);ctx.strokeStyle=`hsla(${(i*27+hue+phase*11)%360},90%,78%,.75)`;ctx.lineWidth=1.2;ctx.strokeRect(-w/2,-h/2,w,h);ctx.restore();}
    for(let i=0;i<9;i++){const a=spin*(i%2?1:-1)+i*.7,r=scale*(.12+i*.047);ctx.beginPath();ctx.ellipse(cx,cy,r,r*.45,a,0,TAU);ctx.strokeStyle=`hsla(${(hue+i*31)%360},80%,70%,.28)`;ctx.stroke();}
    for(let i=0;i<30;i++){const a=rand(i)*TAU+time*(i%2?1:-1),r=scale*(.05+rand(i+50)*.46);circle(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.7,2+rand(i+90)*6,`hsla(${(i*17+hue+phase*20)%360},90%,70%,.75)`);}
    glow(cx,cy,scale*.2,palette[3],.1);
  }
  function ocean(){
    background();const depth=pointer.y;for(let layer=0;layer<9;layer++){const y=H*(.18+layer*.105),amp=H*(.012+layer*.006),freq=1.2+layer*.13,offset=time*(.3+layer*.07)*(layer%2?1:-1)+phase*.2;ctx.beginPath();ctx.moveTo(0,H);for(let x=0;x<=W+4;x+=4){const yy=y+Math.sin(x/W*TAU*freq+offset)*amp+Math.sin(x/W*TAU*3+offset*.7)*amp*.3;ctx.lineTo(x,yy);}ctx.lineTo(W,H);ctx.closePath();ctx.fillStyle=color(layer%3?palette[1]:palette[2],.035+layer*.008);ctx.fill();ctx.strokeStyle=color(palette[2],.16-layer*.009);ctx.stroke();}
    for(let i=0;i<70;i++){const speed=.012+rand(i)*.035,x=(rand(i+20)*W+time*speed*W)%(W+20),y=(rand(i+40)*H+Math.sin(time+i)*12),r=1+rand(i+60)*5;circle(x,y,r,null,color(palette[3],.15+rand(i)*.25));}
    const px=pointer.x*W,py=pointer.y*H;for(let k=0;k<5;k++){const r=((time*35+k*42+gesture*13)%(Math.min(W,H)*.5));ctx.beginPath();ctx.ellipse(px,py,r,r*.45,0,0,TAU);ctx.strokeStyle=color(palette[2],Math.max(0,.22-r/(Math.min(W,H)*2)));ctx.stroke();}
    glow(W*.5,H*(.25+depth*.55),Math.min(W,H)*.3,palette[2],.07);
  }
  function blueprint(){
    background();const gap=32;ctx.strokeStyle=color(palette[2],.13);ctx.lineWidth=.65;for(let x=0;x<W;x+=gap)line(x,0,x,H,ctx.strokeStyle);for(let y=0;y<H;y+=gap)line(0,y,W,y,ctx.strokeStyle);
    const cx=W*(.5+(pointer.x-.5)*.18),cy=H*(.5+(pointer.y-.5)*.18),s=Math.min(W,H)*(.12+(gesture%6)*.012);
    for(let i=0;i<12;i++){const a=i*TAU/12+time*.04+phase*.1,r=s*(1+(i%3)*.42);ctx.save();ctx.translate(cx,cy);ctx.rotate(a);ctx.strokeStyle=color(i%2?palette[2]:palette[3],.55);ctx.strokeRect(-r*.5,-r*.5,r,r);line(-r*.7,0,r*.7,0,color(palette[2],.45));line(0,-r*.7,0,r*.7,color(palette[2],.45));ctx.restore();}
    for(let i=0;i<22;i++){const x=rand(i+80)*W,y=rand(i+120)*H;line(x,y,cx,cy,color(palette[2],.08));circle(x,y,2,null,color(palette[3],.6));}
    line(cx-12,cy,cx+12,cy,palette[3],1);line(cx,cy-12,cx,cy+12,palette[3],1);glow(cx,cy,s*2,palette[2],.08);
  }
  function library(){
    background();const rows=4,cols=Math.ceil(W/70)+2;for(let row=0;row<rows;row++){const y=H*(.27+row*.19);line(0,y+26,W,y+26,color(palette[3],.23),2);for(let col=0;col<cols;col++){const id=row*cols+col,w=17+rand(id)*26,h=45+rand(id+100)*75,x=col*70-20+(Math.sin(time*.18+row)*14),lift=(Math.sin(time*.6+id*.7+phase)*.5+.5)*12;ctx.save();ctx.translate(x,y-h-lift);ctx.fillStyle=color(id%4===0?palette[3]:palette[2],.17+rand(id+200)*.4);ctx.fillRect(0,0,w,h);ctx.strokeStyle=color(palette[3],.38);ctx.strokeRect(0,0,w,h);line(4,8,4,h-8,color(palette[0],.6),2);ctx.restore();}}
    for(let i=0;i<8;i++){const a=time*.12+i*TAU/8,r=Math.min(W,H)*(.12+i*.018),x=W*.5+Math.cos(a)*r,y=H*.48+Math.sin(a)*r*.55;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(time+i)*.08);ctx.strokeStyle=color(palette[3],.35);ctx.strokeRect(-20,-30,40,60);ctx.fillStyle=color(palette[2],.2);ctx.fillRect(-17,-27,34,54);ctx.restore();}
    glow(pointer.x*W,pointer.y*H,110,palette[3],.12);
  }
  function forest(){
    background();const floor=H*.98;for(let i=0;i<35;i++){const x=i*W/34,depth=rand(i+200),height=H*(.25+depth*.58),lean=Math.sin(time*.35+i)*18+(pointer.x-.5)*25;line(x,floor,x+lean,floor-height,color(palette[2],.18+depth*.32),2+depth*5);for(let b=0;b<6;b++){const q=.25+b*.12,bx=x+lean*q,by=floor-height*q,spread=height*(.12+rand(i*7+b)*.13);line(bx,by,bx-spread*.7,by-spread,color(palette[2],.22));line(bx,by,bx+spread*.7,by-spread,color(palette[2],.22));}}
    for(let i=0;i<130;i++){const x=rand(i+300)*W,y=rand(i+500)*H*.75,r=3+rand(i+700)*15;glow(x,y,r*2,palette[2],.035);circle(x,y,r*.22,color(palette[3],.22));}
    const px=pointer.x*W,py=pointer.y*H;for(let i=0;i<8;i++){const a=time*.2+i*TAU/8;line(px,py,px+Math.cos(a)*W*.25,py+Math.sin(a)*H*.2,color(palette[3],.1));}
  }
  function museum(){
    background();const cx=W/2,cy=H/2,unit=Math.min(W,H);for(let i=0;i<11;i++){const q=i/11,s=unit*(.1+q*.5),skew=Math.sin(time*.12+i*.8+phase)*unit*.08;ctx.save();ctx.translate(cx+skew,cy);ctx.rotate((i%2?1:-1)*(.08+q*.14));ctx.strokeStyle=color(i%3?palette[2]:palette[3],.18+q*.045);ctx.lineWidth=1+i%3*.5;ctx.strokeRect(-s*.8,-s*.5,s*1.6,s);ctx.beginPath();ctx.moveTo(-s*.8,-s*.5);ctx.lineTo(s*.8,s*.5);ctx.moveTo(s*.8,-s*.5);ctx.lineTo(-s*.8,s*.5);ctx.stroke();ctx.restore();}
    for(let i=0;i<7;i++){const a=i*TAU/7+time*.07,x=cx+Math.cos(a)*unit*.3,y=cy+Math.sin(a)*unit*.22;circle(x,y,5+i%3*3,color(palette[3],.5));line(cx,cy,x,y,color(palette[2],.16));}
    glow(cx,cy,unit*.28,palette[2],.09);
  }
  function composer(){
    background();const cx=W/2,cy=H/2,unit=Math.min(W,H),count=96;for(let i=0;i<count;i++){const q=i/count,a=q*TAU+time*.12+phase*.1,r=unit*(.1+(i%12)*.025)+Math.sin(time*1.7+i*.35)*unit*.018;const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.72;const len=5+(Math.sin(time+i*.5)+1)*13;line(x,y,x+Math.cos(a)*len,y+Math.sin(a)*len,color(i%4?palette[2]:palette[3],.3+intensity*.45),1+i%3*.25);if(i%8===0)circle(x,y,2.5,color(palette[3],.8));}
    for(let i=0;i<7;i++){const r=unit*(.12+i*.065);ctx.beginPath();ctx.ellipse(cx,cy,r,r*.72,phase*.03+i*.04,0,TAU);ctx.strokeStyle=color(i%2?palette[2]:palette[3],.12);ctx.stroke();}
    if(pointer.down){line(cx,cy,pointer.x*W,pointer.y*H,color(palette[3],.55),1.5);glow(pointer.x*W,pointer.y*H,90,palette[3],.22);}
  }
  const renderers={observatory,garden,cathedral,carnival,ocean,blueprint,library,forest,museum,composer};
  function draw(){time+=paused?0:.006*(.35+intensity);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;(renderers[mode]||observatory)();if(!paused)raf=requestAnimationFrame(draw);}
  function start(){cancelAnimationFrame(raf);draw();}start();

  function initAudio(){if(audio)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio=new AC();master=audio.createGain();master.gain.value=.045*intensity;master.connect(audio.destination);}
  function tone(){if(!soundOn)return;initAudio();if(!audio)return;audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type=mode==='cathedral'?'sine':mode==='carnival'?'triangle':'sine';const base={observatory:220,garden:164.81,cathedral:110,carnival:293.66,ocean:82.41,blueprint:196,library:146.83,forest:130.81,museum:246.94,composer:261.63}[mode]||220;osc.frequency.value=base*Math.pow(2,(pointer.x-.5)*2+gesture%5/5);gain.gain.setValueAtTime(.0001,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.22,audio.currentTime+.025);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.75);osc.connect(gain).connect(master);osc.start();osc.stop(audio.currentTime+.8);}
  function transform(){phase+=1;gesture+=1;hue=(hue+23)%360;document.body.style.setProperty('--room-phase',String(phase));start();tone();}
  addEventListener('pointermove',e=>{pointer.x=e.clientX/W;pointer.y=e.clientY/H;},{passive:true});
  addEventListener('pointerdown',e=>{if(e.target.closest('button,a,input'))return;pointer.down=true;pointer.px=pointer.x;pointer.py=pointer.y;gesture++;tone();start();});
  addEventListener('pointerup',()=>{pointer.down=false;start();});
  addEventListener('keydown',e=>{if(e.target.closest('button,a,input'))return;const s=.045;if(e.key==='ArrowLeft')pointer.x=clamp(pointer.x-s,0,1);else if(e.key==='ArrowRight')pointer.x=clamp(pointer.x+s,0,1);else if(e.key==='ArrowUp')pointer.y=clamp(pointer.y-s,0,1);else if(e.key==='ArrowDown')pointer.y=clamp(pointer.y+s,0,1);else if(e.key==='Enter'||e.key===' '){e.preventDefault();transform();return;}else return;start();});
  const controls=document.querySelector('.bottom .controls');
  if(controls){
    const sound=controls.querySelector('[data-action="sound"]');
    if(sound){sound.setAttribute('aria-pressed','false');sound.addEventListener('click',()=>{soundOn=!soundOn;sound.setAttribute('aria-pressed',String(soundOn));sound.textContent=soundOn?'sound on':'sound off';if(soundOn){tone();}else if(master)master.gain.setTargetAtTime(0,audio.currentTime,.04);});}
    const shift=controls.querySelector('[data-action="shift"]');
    if(shift)shift.addEventListener('click',()=>{transform();shift.setAttribute('aria-label','Transform this room again');});
    const home=document.createElement('a');home.className='mc-home';home.href='../../';home.textContent='← all rooms';home.setAttribute('aria-label','Return to all rooms');controls.append(home);
    const still=document.createElement('button');still.type='button';still.textContent=paused?'return to motion':'stillness';still.setAttribute('aria-pressed',String(paused));still.addEventListener('click',()=>{paused=!paused;still.textContent=paused?'return to motion':'stillness';still.setAttribute('aria-pressed',String(paused));if(paused)cancelAnimationFrame(raf);else start();});controls.append(still);
    const label=document.createElement('label');label.className='mc-intensity';label.textContent='intensity ';const range=document.createElement('input');range.type='range';range.min='10';range.max='100';range.value='72';range.setAttribute('aria-label','Visual and sound intensity');range.addEventListener('input',()=>{intensity=Number(range.value)/100;if(master)master.gain.setTargetAtTime(.045*intensity,audio.currentTime,.04);start();});label.append(range);controls.append(label);
    const hint=document.createElement('span');hint.className='mc-key-hint';hint.textContent='ARROWS MOVE · ENTER TRANSFORMS';controls.append(hint);
  }
  reduced.addEventListener?.('change',e=>{if(e.matches){paused=true;cancelAnimationFrame(raf);}else{paused=false;start();}});
  window.__MC_EXPERIMENT__={mode,transform,setIntensity(v){intensity=clamp(Number(v),.1,1);start();},setPaused(v){paused=!!v;if(paused)cancelAnimationFrame(raf);else start();}};
})();
