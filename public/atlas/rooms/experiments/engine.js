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
    carnival: ['#100d10','#2b1723','#b49a6d','#a86f70'],
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
  const memory=Object.fromEntries(Object.keys(palettes).map(k=>[k,[]]));
  const memoryKey='mc-room-memory:v1:'+mode;
  const memoryPreferenceKey='mc-room-memory-enabled:v1:'+mode;
  let memoryEnabled=false,memoryButton=null,memoryStatus=null;
  function syncMemoryControls(){
    if(memoryButton){memoryButton.textContent=memoryEnabled?'remembering locally':'one-off';memoryButton.setAttribute('aria-pressed',String(memoryEnabled));}
    if(memoryStatus)memoryStatus.textContent=memoryEnabled?'saved locally · '+(memory[mode]?.length||0)+' traces':'one-off · new traces stay in this visit';
  }
  function persistMemory(){
    if(!memoryEnabled)return;
    try{localStorage.setItem(memoryKey,JSON.stringify({version:1,phase,gesture,hue,traces:(memory[mode]||[]).slice(-36)}));}catch{}
    syncMemoryControls();
  }
  function restoreMemory(){
    try{
      memoryEnabled=localStorage.getItem(memoryPreferenceKey)==='true';
      if(memoryEnabled){
        const saved=JSON.parse(localStorage.getItem(memoryKey)||'null');
        if(saved&&saved.version===1){
          if(Number.isFinite(saved.phase))phase=clamp(saved.phase,0,1000000);
          if(Number.isFinite(saved.gesture))gesture=clamp(saved.gesture,0,1000000);
          if(Number.isFinite(saved.hue))hue=((saved.hue%360)+360)%360;
          if(Array.isArray(saved.traces))memory[mode]=saved.traces.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.phase)).slice(-36).map(p=>({x:clamp(p.x,0,1),y:clamp(p.y,0,1),phase:clamp(p.phase,0,1000000),at:Number.isFinite(p.at)?p.at:0}));
        }
      }
    }catch{memoryEnabled=false;}
    document.body.style.setProperty('--room-phase',String(phase));
    if(hue)document.body.style.filter=`hue-rotate(${hue}deg)`;
  }
  function setMemoryEnabled(enabled){
    memoryEnabled=!!enabled;
    try{localStorage.setItem(memoryPreferenceKey,String(memoryEnabled));}catch{}
    persistMemory();syncMemoryControls();
  }
  function forgetLocalMemory(){
    memoryEnabled=false;memory[mode]=[];phase=0;gesture=0;hue=0;
    try{localStorage.removeItem(memoryKey);localStorage.removeItem(memoryPreferenceKey);}catch{}
    document.body.style.filter='';document.body.style.setProperty('--room-phase','0');
    syncMemoryControls();start();
  }
  function remember(){const list=memory[mode];if(!list)return;list.push({x:pointer.x,y:pointer.y,phase,at:time});if(list.length>36)list.shift();persistMemory();syncMemoryControls();}
  restoreMemory();
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
    const saved=memory.observatory;for(let i=0;i<saved.length;i++){const p=saved[i],x=p.x*W,y=p.y*H;glow(x,y,35,palette[3],.3);circle(x,y,4,palette[3]);if(i)line(saved[i-1].x*W,saved[i-1].y*H,x,y,color(palette[3],.45),1.4);}
    glow(cx,cy,unit*.18,palette[2],.1);
  }
  function garden(){
    background();const floor=H*.91;line(0,floor,W,floor,color(palette[2],.25));
    function branch(x,y,len,angle,depth,seed){if(depth<=0||len<3)return;const sway=Math.sin(time*.65+seed)*.13+Math.sin(phase+seed*.7)*.09;const a=angle+sway+(pointer.x-.5)*.08;const nx=x+Math.cos(a)*len,ny=y+Math.sin(a)*len;line(x,y,nx,ny,color(palette[2],.18+depth*.055),Math.max(.7,depth*.7));if(depth<4){const bloom=5+rand(seed)*8;glow(nx,ny,bloom*3,palette[3],.2);circle(nx,ny,bloom,color(palette[3],.45));}branch(nx,ny,len*.73,a-.34-rand(seed)*.2,depth-1,seed+3);branch(nx,ny,len*.72,a+.38+rand(seed+1)*.2,depth-1,seed+7);}
    for(let i=0;i<13;i++){const x=(i+.5)*W/13;branch(x,floor, H*(.12+rand(i)*.18),-Math.PI/2+(rand(i+40)-.5)*.25,5+(i%3),i+phase*2);}
    for(let i=0;i<45;i++){const x=rand(i+100)*W,y=H*(.2+rand(i+200)*.65);circle(x,y,1+rand(i+300)*2,color(palette[3],.15+.3*intensity));}
    if(gesture){for(let i=0;i<gesture%9;i++){const x=pointer.x*W+(i-4)*18,y=pointer.y*H+Math.sin(time+i)*12;circle(x,y,4+i%3,color(palette[3],.5));}}
    memory.garden.forEach((p,i)=>{const x=p.x*W,y=p.y*H;branch(x,y,H*(.045+(i%4)*.012),-Math.PI/2,4+i%3,i+phase);glow(x,y,24,palette[3],.24);});
  }
  function cathedral(){
    background();const cx=W/2,base=H*.94,top=H*.12,span=Math.min(W*.44,H*.4);
    for(let i=0;i<19;i++){const q=i/18,x=cx+(q-.5)*W*.92,peak=top+Math.sin(q*Math.PI)*H*.3;ctx.beginPath();ctx.moveTo(x,base);ctx.bezierCurveTo(x-span*.12,base*.65,cx+(q-.5)*span,peak,x,top);ctx.strokeStyle=color(palette[2],(.1+.12*Math.sin(time+i*.4)**2)*intensity);ctx.lineWidth=1+i%3*.25;ctx.stroke();}
    for(let ring=0;ring<15;ring++){const r=24+ring*Math.min(W,H)*.035+Math.sin(time*1.7+ring*.45+phase)*7;ctx.beginPath();ctx.ellipse(cx,H*.52,r,r*.42,0,0,TAU);ctx.strokeStyle=color(ring%3?palette[2]:palette[3],(.19-ring*.008)*intensity);ctx.stroke();}
    const bars=100;for(let i=0;i<bars;i++){const q=i/bars,x=q*W,amp=10+Math.abs(Math.sin(q*31+time*1.4+phase))*H*.13;line(x,base,x,base-amp,color(palette[3],.15+amp/H*.55),1);}
    memory.cathedral.forEach((p,i)=>{const x=p.x*W,y=p.y*H,r=18+((time*38+i*27)%(Math.min(W,H)*.22));ctx.beginPath();ctx.ellipse(x,y,r,r*.42,0,0,TAU);ctx.strokeStyle=color(palette[3],.4);ctx.stroke();});
    glow(cx,H*.46,Math.min(W,H)*.24,palette[2],.08);
  }
  function carnival(){
    // A small, unsettling fairground built from worn geometry rather than rainbow neon.
    background();
    const unit=Math.min(W,H),cx=W*.5,cy=H*.53,spin=time*.12+phase*.22;
    const ink='#171116',wine='#563044',rose='#a86f70',brass='#b49a6d',bone='#d9c9a6',moss='#78866b';
    const wash=(c,a)=>color(c,a);
    // Faded striped big top: an awning that sags slightly as if it remembers weather.
    const tentTop=H*.07,tentBase=H*.38,peak=W*.5;
    ctx.beginPath();ctx.moveTo(W*.16,tentBase);ctx.lineTo(peak,tentTop);ctx.lineTo(W*.84,tentBase);ctx.closePath();
    ctx.fillStyle=wash(wine,.24);ctx.fill();
    for(let i=0;i<12;i++){
      const x0=W*(.16+i*.0567),x1=W*(.16+(i+1)*.0567);
      ctx.beginPath();ctx.moveTo(x0,tentBase);ctx.lineTo(peak+(x0-peak)*.06,tentTop+Math.abs(x0-peak)*.035);ctx.lineTo(peak+(x1-peak)*.06,tentTop+Math.abs(x1-peak)*.035);ctx.lineTo(x1,tentBase);ctx.closePath();
      ctx.fillStyle=i%2?wash(brass,.14):wash(ink,.26);ctx.fill();
    }
    line(W*.16,tentBase,W*.84,tentBase,wash(bone,.38),1);
    // Ferris wheel: not quite centered, and its spokes don't agree on a common rhythm.
    const wx=cx+Math.sin(spin*.3)*unit*.025,wy=H*.53,wr=unit*.235;
    for(let ring=0;ring<4;ring++){
      ctx.beginPath();ctx.ellipse(wx,wy,wr*(1-ring*.12),wr*(1-ring*.12),ring*.035,0,TAU);
      ctx.strokeStyle=wash(ring===0?brass:rose,.12+intensity*.12);ctx.lineWidth=ring===0?1.35:.65;ctx.stroke();
    }
    line(wx-wr*1.13,wy+wr*.98,wx+wr*1.13,wy+wr*.98,wash(brass,.34),1.2);
    line(wx,wy+wr*.96,wx-wr*.13,wy+wr*1.42,wash(brass,.36),1.2);
    line(wx,wy+wr*.96,wx+wr*.13,wy+wr*1.42,wash(brass,.36),1.2);
    for(let i=0;i<17;i++){
      const a=spin+(i/17)*TAU, wobble=1+Math.sin(time*.43+i*2.1)*.018;
      const x=wx+Math.cos(a)*wr*wobble,y=wy+Math.sin(a)*wr*wobble;
      line(wx,wy,x,y,wash(i%4===0?bone:brass,.12+intensity*.16),.7);
      ctx.save();ctx.translate(x,y);ctx.rotate(a*.08);
      ctx.fillStyle=wash(i%3===0?rose:wine,.72);ctx.fillRect(-unit*.012,-unit*.017,unit*.024,unit*.034);
      ctx.strokeStyle=wash(bone,.4);ctx.strokeRect(-unit*.012,-unit*.017,unit*.024,unit*.034);
      ctx.restore();
    }
    // Three booth fronts, each with a different perspective error.
    for(let i=0;i<3;i++){
      const x=W*(.18+i*.32),y=H*(.72+(i===1?-.025:.015)),bw=unit*(i===1?.19:.16),bh=unit*.115;
      ctx.fillStyle=wash(ink,.72);ctx.fillRect(x-bw/2,y-bh/2,bw,bh);
      ctx.strokeStyle=wash(brass,.55);ctx.lineWidth=1;ctx.strokeRect(x-bw/2,y-bh/2,bw,bh);
      const roof=y-bh/2;
      ctx.beginPath();ctx.moveTo(x-bw*.56,roof);ctx.lineTo(x-bw*.42,roof-unit*.045);ctx.lineTo(x+bw*.42,roof-unit*.045);ctx.lineTo(x+bw*.56,roof);ctx.closePath();ctx.fillStyle=wash(wine,.9);ctx.fill();
      for(let s=0;s<7;s++){const sx=x-bw*.48+bw*.16*s;ctx.beginPath();ctx.moveTo(sx,roof);ctx.lineTo(sx+bw*.08,roof-unit*.045);ctx.lineTo(sx+bw*.16,roof-unit*.045);ctx.lineTo(sx+bw*.08,roof);ctx.closePath();ctx.fillStyle=s%2?wash(bone,.5):wash(rose,.52);ctx.fill();}
      // A dark ticket window with two tiny, watchful lights.
      ctx.fillStyle=wash('#050406',.92);ctx.fillRect(x-bw*.19,y-bh*.27,bw*.38,bh*.42);
      circle(x-bw*.055,y-bh*.08,1.5,wash(bone,.65));circle(x+bw*.055,y-bh*.08,1.5,wash(bone,.65));
      line(x-bw*.13,y+bh*.23,x+bw*.13,y+bh*.23,wash(brass,.5),.7);
    }
    // Strings of bulbs droop with gravity; a few bulbs are deliberately missing.
    for(let strand=0;strand<3;strand++){
      const y=H*(.22+strand*.075),left=W*(.08+strand*.035),right=W*(.92-strand*.035);
      ctx.beginPath();ctx.moveTo(left,y);ctx.quadraticCurveTo(cx,y+unit*.09,right,y-unit*.005);
      ctx.strokeStyle=wash(brass,.2);ctx.stroke();
      for(let i=0;i<19;i++){if((i+strand*7)%8===0)continue;const t=i/18,x=mix(left,right,t),yy=y+Math.sin(t*Math.PI)*unit*.09*(1-t*.08);circle(x,yy,1.1+(i%4===0?1:0),wash(i%5===0?rose:bone,.25+Math.sin(time*.7+i)*.08));}
    }
    // The midway floor is a warped checkerboard that dissolves into darkness.
    for(let row=0;row<8;row++){
      const y0=H*(.79+row*.028),y1=y0+H*.028,spread= W*(.1+row*.075);
      for(let col=0;col<16;col++){
        const x0=cx-spread+2*spread*col/16,x1=cx-spread+2*spread*(col+1)/16;
        ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y0);ctx.lineTo(cx+(x1-cx)*1.04,y1);ctx.lineTo(cx+(x0-cx)*1.04,y1);ctx.closePath();
        ctx.fillStyle=wash((row+col)%2?bone:ink,.025+row*.005);ctx.fill();
      }
    }
    // Slow, nearly hidden motes; user gestures leave afterimages, not scores.
    for(let i=0;i<38;i++){
      const a=rand(i)*TAU+time*(i%2?-.035:.028),r=unit*(.08+rand(i+50)*.48);
      circle(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.72,1+rand(i+90)*2.3,wash(i%7===0?rose:brass,.08+rand(i+120)*.18*intensity));
    }
    memory.carnival.forEach((p,i)=>{const x=p.x*W,y=p.y*H,r=unit*(.012+(i%4)*.006);ctx.save();ctx.translate(x,y);ctx.rotate((i%2?1:-1)*time*.08+i*.7);ctx.strokeStyle=wash(i%3?brass:rose,.65);ctx.strokeRect(-r,-r,r*2,r*2);circle(0,0,1.5,wash(bone,.7));ctx.restore();});
    glow(cx,cy,unit*.3,rose,.035);
  }
  function ocean(){
    background();const depth=pointer.y;for(let layer=0;layer<9;layer++){const y=H*(.18+layer*.105),amp=H*(.012+layer*.006),freq=1.2+layer*.13,offset=time*(.3+layer*.07)*(layer%2?1:-1)+phase*.2;ctx.beginPath();ctx.moveTo(0,H);for(let x=0;x<=W+4;x+=4){const yy=y+Math.sin(x/W*TAU*freq+offset)*amp+Math.sin(x/W*TAU*3+offset*.7)*amp*.3;ctx.lineTo(x,yy);}ctx.lineTo(W,H);ctx.closePath();ctx.fillStyle=color(layer%3?palette[1]:palette[2],.035+layer*.008);ctx.fill();ctx.strokeStyle=color(palette[2],.16-layer*.009);ctx.stroke();}
    for(let i=0;i<70;i++){const speed=.012+rand(i)*.035,x=(rand(i+20)*W+time*speed*W)%(W+20),y=(rand(i+40)*H+Math.sin(time+i)*12),r=1+rand(i+60)*5;circle(x,y,r,null,color(palette[3],.15+rand(i)*.25));}
    const px=pointer.x*W,py=pointer.y*H;for(let k=0;k<5;k++){const r=((time*35+k*42+gesture*13)%(Math.min(W,H)*.5));ctx.beginPath();ctx.ellipse(px,py,r,r*.45,0,0,TAU);ctx.strokeStyle=color(palette[2],Math.max(0,.22-r/(Math.min(W,H)*2)));ctx.stroke();}
    memory.ocean.forEach((p,i)=>{const x=p.x*W,y=p.y*H,r=((time*48+i*43)%(Math.min(W,H)*.32));ctx.beginPath();ctx.ellipse(x,y,r,r*.48,0,0,TAU);ctx.strokeStyle=color(palette[3],Math.max(0,.45-r/(Math.min(W,H)*.7)));ctx.stroke();});
    glow(W*.5,H*(.25+depth*.55),Math.min(W,H)*.3,palette[2],.07);
  }
  function blueprint(){
    background();const gap=32;ctx.strokeStyle=color(palette[2],.13);ctx.lineWidth=.65;for(let x=0;x<W;x+=gap)line(x,0,x,H,ctx.strokeStyle);for(let y=0;y<H;y+=gap)line(0,y,W,y,ctx.strokeStyle);
    const cx=W*(.5+(pointer.x-.5)*.18),cy=H*(.5+(pointer.y-.5)*.18),s=Math.min(W,H)*(.12+(gesture%6)*.012);
    for(let i=0;i<12;i++){const a=i*TAU/12+time*.04+phase*.1,r=s*(1+(i%3)*.42);ctx.save();ctx.translate(cx,cy);ctx.rotate(a);ctx.strokeStyle=color(i%2?palette[2]:palette[3],.55);ctx.strokeRect(-r*.5,-r*.5,r,r);line(-r*.7,0,r*.7,0,color(palette[2],.45));line(0,-r*.7,0,r*.7,color(palette[2],.45));ctx.restore();}
    for(let i=0;i<22;i++){const x=rand(i+80)*W,y=rand(i+120)*H;line(x,y,cx,cy,color(palette[2],.08));circle(x,y,2,null,color(palette[3],.6));}
    line(cx-12,cy,cx+12,cy,palette[3],1);line(cx,cy-12,cx,cy+12,palette[3],1);memory.blueprint.forEach((p,i)=>{const x=p.x*W,y=p.y*H;if(i)line(memory.blueprint[i-1].x*W,memory.blueprint[i-1].y*H,x,y,color(palette[3],.8),2);circle(x,y,5,palette[3]);});glow(cx,cy,s*2,palette[2],.08);
  }
  function library(){
    background();const rows=4,cols=Math.ceil(W/70)+2;for(let row=0;row<rows;row++){const y=H*(.27+row*.19);line(0,y+26,W,y+26,color(palette[3],.23),2);for(let col=0;col<cols;col++){const id=row*cols+col,w=17+rand(id)*26,h=45+rand(id+100)*75,x=col*70-20+(Math.sin(time*.18+row)*14),lift=(Math.sin(time*.6+id*.7+phase)*.5+.5)*12;ctx.save();ctx.translate(x,y-h-lift);ctx.fillStyle=color(id%4===0?palette[3]:palette[2],.17+rand(id+200)*.4);ctx.fillRect(0,0,w,h);ctx.strokeStyle=color(palette[3],.38);ctx.strokeRect(0,0,w,h);line(4,8,4,h-8,color(palette[0],.6),2);ctx.restore();}}
    for(let i=0;i<8;i++){const a=time*.12+i*TAU/8,r=Math.min(W,H)*(.12+i*.018),x=W*.5+Math.cos(a)*r,y=H*.48+Math.sin(a)*r*.55;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(time+i)*.08);ctx.strokeStyle=color(palette[3],.35);ctx.strokeRect(-20,-30,40,60);ctx.fillStyle=color(palette[2],.2);ctx.fillRect(-17,-27,34,54);ctx.restore();}
    memory.library.forEach((p,i)=>{const x=p.x*W,y=p.y*H;ctx.save();ctx.translate(x,y);ctx.rotate((i%2?-.1:.1)+Math.sin(time+i)*.04);ctx.fillStyle=color(palette[3],.3);ctx.fillRect(-13,-20,26,40);ctx.strokeStyle=color(palette[3],.9);ctx.strokeRect(-13,-20,26,40);ctx.restore();});
    glow(pointer.x*W,pointer.y*H,110,palette[3],.12);
  }
  function forest(){
    background();const floor=H*.98;for(let i=0;i<35;i++){const x=i*W/34,depth=rand(i+200),height=H*(.25+depth*.58),lean=Math.sin(time*.35+i)*18+(pointer.x-.5)*25;line(x,floor,x+lean,floor-height,color(palette[2],.18+depth*.32),2+depth*5);for(let b=0;b<6;b++){const q=.25+b*.12,bx=x+lean*q,by=floor-height*q,spread=height*(.12+rand(i*7+b)*.13);line(bx,by,bx-spread*.7,by-spread,color(palette[2],.22));line(bx,by,bx+spread*.7,by-spread,color(palette[2],.22));}}
    for(let i=0;i<130;i++){const x=rand(i+300)*W,y=rand(i+500)*H*.75,r=3+rand(i+700)*15;glow(x,y,r*2,palette[2],.035);circle(x,y,r*.22,color(palette[3],.22));}
    const px=pointer.x*W,py=pointer.y*H;for(let i=0;i<8;i++){const a=time*.2+i*TAU/8;line(px,py,px+Math.cos(a)*W*.25,py+Math.sin(a)*H*.2,color(palette[3],.1));}
    memory.forest.forEach((p,i)=>{const x=p.x*W,y=p.y*H,r=(time*24+i*32)%(Math.min(W,H)*.3);ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.strokeStyle=color(palette[3],Math.max(0,.4-r/(Math.min(W,H)*.4)));ctx.stroke();glow(x,y,18,palette[3],.12);});
  }
  function museum(){
    background();const cx=W/2,cy=H/2,unit=Math.min(W,H);for(let i=0;i<11;i++){const q=i/11,s=unit*(.1+q*.5),skew=Math.sin(time*.12+i*.8+phase)*unit*.08;ctx.save();ctx.translate(cx+skew,cy);ctx.rotate((i%2?1:-1)*(.08+q*.14));ctx.strokeStyle=color(i%3?palette[2]:palette[3],.18+q*.045);ctx.lineWidth=1+i%3*.5;ctx.strokeRect(-s*.8,-s*.5,s*1.6,s);ctx.beginPath();ctx.moveTo(-s*.8,-s*.5);ctx.lineTo(s*.8,s*.5);ctx.moveTo(s*.8,-s*.5);ctx.lineTo(-s*.8,s*.5);ctx.stroke();ctx.restore();}
    for(let i=0;i<7;i++){const a=i*TAU/7+time*.07,x=cx+Math.cos(a)*unit*.3,y=cy+Math.sin(a)*unit*.22;circle(x,y,5+i%3*3,color(palette[3],.5));line(cx,cy,x,y,color(palette[2],.16));}
    memory.museum.forEach((p,i)=>{const x=p.x*W,y=p.y*H,s=35+i%5*12;ctx.save();ctx.translate(x,y);ctx.rotate(time*.05+i*.18);ctx.strokeStyle=color(palette[3],.8);ctx.strokeRect(-s,-s,s*2,s*2);ctx.restore();});
    glow(cx,cy,unit*.28,palette[2],.09);
  }
  function composer(){
    background();const cx=W/2,cy=H/2,unit=Math.min(W,H),count=96;for(let i=0;i<count;i++){const q=i/count,a=q*TAU+time*.12+phase*.1,r=unit*(.1+(i%12)*.025)+Math.sin(time*1.7+i*.35)*unit*.018;const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.72;const len=5+(Math.sin(time+i*.5)+1)*13;line(x,y,x+Math.cos(a)*len,y+Math.sin(a)*len,color(i%4?palette[2]:palette[3],.3+intensity*.45),1+i%3*.25);if(i%8===0)circle(x,y,2.5,color(palette[3],.8));}
    for(let i=0;i<7;i++){const r=unit*(.12+i*.065);ctx.beginPath();ctx.ellipse(cx,cy,r,r*.72,phase*.03+i*.04,0,TAU);ctx.strokeStyle=color(i%2?palette[2]:palette[3],.12);ctx.stroke();}
    memory.composer.forEach((p,i)=>{const a=p.x*TAU+time*.02,r=unit*(.08+p.y*.34),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.72;circle(x,y,3+i%4,color(palette[3],.8));line(cx,cy,x,y,color(palette[2],.28));});
    if(pointer.down){line(cx,cy,pointer.x*W,pointer.y*H,color(palette[3],.55),1.5);glow(pointer.x*W,pointer.y*H,90,palette[3],.22);}
  }
  const renderers={observatory,garden,cathedral,carnival,ocean,blueprint,library,forest,museum,composer};
  function draw(){time+=paused?0:.006*(.35+intensity);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;(renderers[mode]||observatory)();if(!paused)raf=requestAnimationFrame(draw);}
  function start(){cancelAnimationFrame(raf);draw();}start();

  function initAudio(){if(audio)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio=new AC();master=audio.createGain();master.gain.value=.045*intensity;master.connect(audio.destination);}
  function tone(){if(!soundOn)return;initAudio();if(!audio)return;audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type=mode==='cathedral'?'sine':mode==='carnival'?'triangle':'sine';const base={observatory:220,garden:164.81,cathedral:110,carnival:293.66,ocean:82.41,blueprint:196,library:146.83,forest:130.81,museum:246.94,composer:261.63}[mode]||220;osc.frequency.value=base*Math.pow(2,(pointer.x-.5)*2+gesture%5/5);gain.gain.setValueAtTime(.0001,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.22,audio.currentTime+.025);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.75);osc.connect(gain).connect(master);osc.start();osc.stop(audio.currentTime+.8);}
  function transform(){phase+=1;gesture+=1;hue=(hue+23)%360;document.body.style.setProperty('--room-phase',String(phase));document.body.style.filter=`hue-rotate(${hue}deg)`;persistMemory();start();tone();}
  addEventListener('pointermove',e=>{pointer.x=e.clientX/W;pointer.y=e.clientY/H;},{passive:true});
  addEventListener('pointerdown',e=>{if(e.target.closest('button,a,input'))return;pointer.down=true;pointer.px=pointer.x;pointer.py=pointer.y;gesture++;remember();tone();start();});
  addEventListener('pointerup',()=>{pointer.down=false;start();});
  addEventListener('keydown',e=>{if(e.target.closest('button,a,input'))return;const s=.045;if(e.key==='ArrowLeft')pointer.x=clamp(pointer.x-s,0,1);else if(e.key==='ArrowRight')pointer.x=clamp(pointer.x+s,0,1);else if(e.key==='ArrowUp')pointer.y=clamp(pointer.y-s,0,1);else if(e.key==='ArrowDown')pointer.y=clamp(pointer.y+s,0,1);else if(e.key==='Enter'||e.key===' '){e.preventDefault();transform();return;}else return;start();});
  const controls=document.querySelector('.bottom .controls');
  if(controls){
    const sound=controls.querySelector('[data-action="sound"]');
    if(sound){sound.setAttribute('aria-pressed','false');sound.addEventListener('click',()=>{soundOn=!soundOn;sound.setAttribute('aria-pressed',String(soundOn));sound.textContent=soundOn?'sound on':'sound off';if(soundOn){initAudio();if(master)master.gain.setTargetAtTime(.045*intensity,audio.currentTime,.04);tone();}else if(master&&audio)master.gain.setTargetAtTime(0,audio.currentTime,.04);});}
    const shift=controls.querySelector('[data-action="shift"]');
    if(shift)shift.addEventListener('click',()=>{transform();shift.setAttribute('aria-label','Transform this room again');});
    const home=document.createElement('a');home.className='mc-home';home.href='../../';home.textContent='← all rooms';home.setAttribute('aria-label','Return to all rooms');controls.append(home);
    memoryButton=document.createElement('button');memoryButton.type='button';memoryButton.setAttribute('aria-label','Toggle local room memory');memoryButton.addEventListener('click',()=>setMemoryEnabled(!memoryEnabled));controls.append(memoryButton);
    const forgetButton=document.createElement('button');forgetButton.type='button';forgetButton.textContent='forget trace';forgetButton.setAttribute('aria-label','Forget local room memory');forgetButton.addEventListener('click',forgetLocalMemory);controls.append(forgetButton);
    memoryStatus=document.createElement('span');memoryStatus.className='mc-memory-status';memoryStatus.setAttribute('role','status');memoryStatus.setAttribute('aria-live','polite');controls.append(memoryStatus);syncMemoryControls();
    const still=document.createElement('button');still.type='button';still.textContent=paused?'return to motion':'stillness';still.setAttribute('aria-pressed',String(paused));still.addEventListener('click',()=>{paused=!paused;still.textContent=paused?'return to motion':'stillness';still.setAttribute('aria-pressed',String(paused));if(paused)cancelAnimationFrame(raf);else start();});controls.append(still);
    const label=document.createElement('label');label.className='mc-intensity';label.textContent='intensity ';const range=document.createElement('input');range.type='range';range.min='10';range.max='100';range.value='72';range.setAttribute('aria-label','Visual and sound intensity');range.addEventListener('input',()=>{intensity=Number(range.value)/100;if(master)master.gain.setTargetAtTime(.045*intensity,audio.currentTime,.04);start();});label.append(range);controls.append(label);
    const hint=document.createElement('span');hint.className='mc-key-hint';hint.textContent='ARROWS MOVE · ENTER TRANSFORMS';controls.append(hint);
  }
  reduced.addEventListener?.('change',e=>{if(e.matches){paused=true;cancelAnimationFrame(raf);}else{paused=false;start();}});
  window.__MC_EXPERIMENT__={mode,transform,setIntensity(v){intensity=clamp(Number(v),.1,1);start();},setPaused(v){paused=!!v;if(paused)cancelAnimationFrame(raf);else start();}};
})();
