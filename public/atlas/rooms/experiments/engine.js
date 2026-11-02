const C=document.querySelector('canvas');
if(C){
const x=C.getContext('2d'),mode=document.body.dataset.mode||'field';
let W=innerWidth,H=innerHeight,d=1,t=0,raf=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let p={x:.5,y:.5,down:false},audio=null,master=null,enabled=false,intensity=.65,hue=0;
const seed=[...mode].reduce((a,c)=>a+c.charCodeAt(0),0);
const R=n=>{const v=Math.sin(seed*91.7+n*44.3)*43758.5453;return v-Math.floor(v)};
function size(){d=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;C.width=W*d;C.height=H*d;x.setTransform(d,0,0,d,0,0)}addEventListener('resize',size,{passive:true});size();
function initAudio(){if(audio)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio=new AC();master=audio.createGain();master.gain.value=1;master.connect(audio.destination)}
function tone(){if(!enabled)return;initAudio();if(!audio)return;audio.resume();const o=audio.createOscillator(),g=audio.createGain(),q=audio.createStereoPanner?audio.createStereoPanner():null;o.type=['sine','triangle','sawtooth'][seed%3];o.frequency.value=90+seed%180+p.y*380;g.gain.setValueAtTime(.0001,audio.currentTime);g.gain.exponentialRampToValueAtTime(.035*intensity,audio.currentTime+.025);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.5);if(q){q.pan.value=p.x*2-1;o.connect(g).connect(q).connect(master)}else o.connect(g).connect(master);o.start();o.stop(audio.currentTime+.55)}
function line(a,b,c,w=1){x.strokeStyle=c;x.lineWidth=w;x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke()}
function circle(X,Y,r,c,fill=true){x.beginPath();x.arc(X,Y,r,0,Math.PI*2);if(fill){x.fillStyle=c;x.fill()}else{x.strokeStyle=c;x.stroke()}}
function draw(){t+=.008*(.35+intensity);x.clearRect(0,0,W,H);const mx=p.x*W,my=p.y*H;
if(mode==='observatory'){for(let i=0;i<90;i++){let X=R(i)*W,Y=R(i+200)*H,s=1+R(i+500)*3;circle(X,Y,s,`rgba(210,225,255,${(.2+R(i)*.8)*intensity})`);if(Math.hypot(X-mx,Y-my)<150*intensity)line([X,Y],[mx,my],`rgba(130,190,255,${.18*intensity})`)}}
if(mode==='garden'){for(let i=0;i<28;i++){let X=(i+1)*W/29,Y=H*.9,hh=80+R(i)*H*.55+Math.sin(t+i)*20;line([X,Y],[X,Y-hh],`rgba(110,190,110,${.5*intensity})`,2);for(let j=0;j<5;j++)circle(X+Math.sin(j*2+i)*20,Y-hh+j*18,5+R(i+j)*8,`hsla(${90+i*4},65%,60%,${.7*intensity})`)}}
if(mode==='cathedral'){for(let i=0;i<18;i++){let q=i/17,X=q*W,h=H*(.25+.55*Math.sin(q*Math.PI));x.strokeStyle=`hsla(${190+i*5+hue},70%,70%,${.35*intensity})`;x.lineWidth=2;x.beginPath();x.moveTo(X,H);x.quadraticCurveTo(W/2,H-h,X,H*.1);x.stroke()}for(let i=0;i<12;i++)circle(W/2,H/2,40+i*26+Math.sin(t*3+i)*8,`rgba(170,220,255,${(.16-i*.008)*intensity})`,false)}
if(mode==='carnival'){for(let i=0;i<32;i++){let a=t*(i%2?1:-1)+i*.8,r=60+(i%8)*28,X=W/2+Math.cos(a)*r,Y=H/2+Math.sin(a*1.3)*r*.6;circle(X,Y,8+(i%5)*3,`hsl(${(i*37+t*90+hue)%360},85%,62%)`)}}
if(mode==='ocean'){let g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#07345a');g.addColorStop(1,'#010611');x.fillStyle=g;x.fillRect(0,0,W,H);for(let i=0;i<44;i++){let X=(R(i)*W+t*20*(.4+R(i+2)))%(W+100)-50,Y=R(i+9)*H,r=4+R(i+40)*18;circle(X,Y,r,`rgba(110,220,235,${(.08+R(i)*.22)*intensity})`,false)}}
if(mode==='blueprint'){x.strokeStyle=`rgba(80,160,255,${.12*intensity})`;for(let i=0;i<W;i+=32)line([i,0],[i,H],x.strokeStyle);for(let i=0;i<H;i+=32)line([0,i],[W,i],x.strokeStyle);for(let i=0;i<20;i++){let X=R(i)*W,Y=R(i+20)*H;circle(X,Y,10+R(i+50)*50,`rgba(130,200,255,${.45*intensity})`,false);line([X,Y],[mx,my],`rgba(130,200,255,${.12*intensity})`)}}
if(mode==='library'){for(let i=0;i<25;i++){let X=R(i)*W,Y=(R(i+2)*H+Math.sin(t+i)*20),w=28+R(i+4)*45,h=50+R(i+8)*70;x.save();x.translate(X,Y);x.rotate(Math.sin(t*.4+i)*.2);x.fillStyle=`hsla(${25+i*7+hue},45%,${25+R(i)*35}%,.78)`;x.fillRect(-w/2,-h/2,w,h);x.restore()}} 
if(mode==='forest'){for(let i=0;i<42;i++){let X=i*W/41,Y=H,hh=H*(.2+R(i)*.65);line([X,Y],[X+Math.sin(t+i)*12,Y-hh],`hsla(${110+i+hue},40%,${28+R(i)*30}%,${.7*intensity})`,2);circle(X+Math.sin(t+i)*12,Y-hh,3+R(i+4)*7,`rgba(180,255,190,${.5*intensity})`)}}
if(mode==='museum'){for(let i=0;i<12;i++){let s=80+i*34,a=t*(i%2?1:-1)*.3;x.save();x.translate(W/2,H/2);x.rotate(a);x.strokeStyle=`hsla(${260+i*9+hue},70%,72%,${(.1+i*.025)*intensity})`;x.strokeRect(-s,-s*.55,s*2,s*1.1);x.restore()}}
if(mode==='composer'){for(let i=0;i<64;i++){let a=i/64*Math.PI*2+t,r=80+(i%8)*23+Math.sin(t*2+i)*12,X=W/2+Math.cos(a)*r,Y=H/2+Math.sin(a)*r;circle(X,Y,2+(i%4),`hsla(${i*6+p.x*120+hue},80%,65%,${.65*intensity})`);if(p.down&&i%8===0)line([X,Y],[mx,my],`rgba(255,255,255,${.12*intensity})`)}}
if(!paused)raf=requestAnimationFrame(draw)}
function start(){cancelAnimationFrame(raf);draw()}start();
addEventListener('pointermove',e=>{p.x=e.clientX/W;p.y=e.clientY/H},{passive:true});
addEventListener('pointerdown',e=>{if(e.target.closest('button,a,input'))return;p.down=true;tone()});addEventListener('pointerup',()=>p.down=false);
addEventListener('keydown',e=>{if(e.target.closest('button,a,input'))return;const step=.045;if(e.key==='ArrowLeft')p.x=Math.max(0,p.x-step);else if(e.key==='ArrowRight')p.x=Math.min(1,p.x+step);else if(e.key==='ArrowUp')p.y=Math.max(0,p.y-step);else if(e.key==='ArrowDown')p.y=Math.min(1,p.y+step);else if(e.key==='Enter'||e.key===' '){e.preventDefault();tone()}else return;});
const controls=document.querySelector('.bottom .controls');
if(controls){
const soundButton=controls.querySelector('[data-action="sound"]');
if(soundButton){soundButton.setAttribute('aria-pressed','false');soundButton.addEventListener('click',()=>{enabled=!enabled;soundButton.setAttribute('aria-pressed',String(enabled));soundButton.textContent=enabled?'sound on':'sound off';if(enabled)tone()})}
const shiftButton=controls.querySelector('[data-action="shift"]');
if(shiftButton)shiftButton.addEventListener('click',()=>{hue=(hue+67+Math.random()*75)%360;document.body.style.filter=`hue-rotate(${hue}deg)`;start()});
const home=document.createElement('a');home.className='mc-home';home.href='../../';home.textContent='← all rooms';home.setAttribute('aria-label','Return to all rooms');controls.append(home);const hint=document.createElement('span');hint.className='mc-key-hint';hint.textContent='ARROWS MOVE · ENTER SOUNDS';controls.append(hint);
const stillButton=document.createElement('button');stillButton.type='button';stillButton.textContent=paused?'return to motion':'stillness';stillButton.addEventListener('click',()=>{paused=!paused;stillButton.textContent=paused?'return to motion':'stillness';if(paused)cancelAnimationFrame(raf);else start()});controls.append(stillButton);
const label=document.createElement('label');label.className='mc-intensity';label.textContent='intensity ';const range=document.createElement('input');range.type='range';range.min='10';range.max='100';range.value='65';range.setAttribute('aria-label','Visual and sound intensity');range.addEventListener('input',()=>{intensity=Number(range.value)/100;start()});label.append(range);controls.append(label);
}
window.__MC_EXPERIMENT__={mode,setIntensity(v){intensity=Math.max(.1,Math.min(1,Number(v)));start()},setPaused(v){paused=!!v;if(paused)cancelAnimationFrame(raf);else start()}};
}
