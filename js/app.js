/* ════ PARTICLE SYSTEM ══════════════════════════════════
   Subtle drifting dots behind all UI — canvas at z-index:2
   Scroll parallax: particles shift at different rates by depth
════════════════════════════════════════════════════════ */
(function(){
  const cv=document.getElementById('particles');
  const ctx=cv.getContext('2d');
  let W,H;
  function resize(){W=cv.width=window.innerWidth;H=cv.height=window.innerHeight;}
  resize();window.addEventListener('resize',resize);

  const N=60;
  const pts=[];
  for(let i=0;i<N;i++){
    const depth=Math.random();
    pts.push({
      x:Math.random()*W,
      y:Math.random()*H,
      r:0.8+depth*3.2,
      vx:(Math.random()-.5)*(0.22+depth*0.38),   // faster
      vy:(Math.random()-.5)*(0.16+depth*0.28),   // faster
      base:0.08+depth*0.18,                       // slightly lower opacity
      phase:Math.random()*Math.PI*2,
      ps:(Math.random()*.0022+.0006),             // faster phase
      depth,
    });
  }

  // Track scroll position across the whole page-stack
  let lastScroll=0,scrollVel=0;
  const stack=document.getElementById('page-stack');
  if(stack){
    stack.addEventListener('scroll',()=>{
      const s=stack.scrollTop;
      scrollVel=s-lastScroll;
      lastScroll=s;
    },{passive:true});
  }

  function draw(){
    if(cv.style.display==='none'){requestAnimationFrame(draw);return;}
    // Decay scroll velocity each frame
    scrollVel*=0.88;

    ctx.clearRect(0,0,W,H);
    for(const p of pts){
      p.phase+=p.ps;

      // Base drift
      p.x+=p.vx+Math.sin(p.phase)*0.04;
      p.y+=p.vy+Math.cos(p.phase*.7)*0.03;

      // Scroll parallax — near (high depth) particles shift more
      p.y-=scrollVel*(0.15+p.depth*0.55);

      // Wrap
      if(p.x<-4)p.x=W+4;if(p.x>W+4)p.x=-4;
      if(p.y<-4)p.y=H+4;if(p.y>H+4)p.y=-4;

      const op=p.base*(0.75+0.25*Math.sin(p.phase*1.4));
      const g=Math.round(155-p.depth*80); // far=light grey (155), near=darker (75)
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(${g},${g},${g},${op})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ════ CURSOR + COMET TRAIL ══════════════════════════════ */
const cdot=document.getElementById('cdot');
const dCtx=cdot.getContext('2d');
const trailCanvas=document.getElementById('ctrail');
const tCtx=trailCanvas.getContext('2d');

function resizeTrail(){trailCanvas.width=window.innerWidth;trailCanvas.height=window.innerHeight;}
resizeTrail();window.addEventListener('resize',resizeTrail);

let mx=-200,my=-200;
let nextMx=-200,nextMy=-200; // buffered mousemove position

// Cursor morph state: 0=circle, >0=down arrow, <0=up arrow (range -1..1)
let cursorMorph=0;       // current displayed value, lerped
let cursorMorphTarget=0; // driven by scroll velocity
let dotScale=1;          // for click squish
let cursorSize=parseFloat(localStorage.getItem('st_cursor_size')||'1.0'); // dot size multiplier

const TRAIL_LEN=36;
const trailPts=Array(TRAIL_LEN).fill(null).map(()=>({x:-400,y:-400,age:0}));
let trailHead=0;

// Cache frequently accessed elements to avoid repeated DOM queries
const focusFS=document.getElementById('focus-fs');
const swFS=document.getElementById('sw-fs');
let cachedFsOpen=false;
let cachedIsNight=false;
let cachedTrailRGB='15,15,15';
let cachedCursorColor='rgba(15,15,15,1)';

// Shared scroll velocity (read by both particles and cursor)
let globalScrollVel=0;
const pageStackEl=document.getElementById('page-stack');
let _lastScroll2=0;
if(pageStackEl){
  pageStackEl.addEventListener('scroll',()=>{
    const s=pageStackEl.scrollTop;
    globalScrollVel=s-_lastScroll2;
    _lastScroll2=s;
  },{passive:true});
}

// Throttle mousemove: buffer position but don't render until animation frame
document.addEventListener('mousemove',e=>{
  nextMx=e.clientX;
  nextMy=e.clientY;
},{passive:true});

document.addEventListener('click',e=>{
  if(perfMode)return;
  dotScale=0.44;
  setTimeout(()=>{dotScale=1;},130);
  const N=9;for(let i=0;i<N;i++){
    const p=document.createElement('div');p.className='cpar';
    const ang=(i/N)*Math.PI*2,dist=14+Math.random()*20;
    const pCol=document.body.classList.contains('night')?'rgba(220,225,255,.9)':'rgba(15,15,15,.85)';
    p.style.cssText=`left:${e.clientX}px;top:${e.clientY}px;width:${2.5+Math.random()*3}px;height:${2.5+Math.random()*3}px;background:${pCol};--tx:${Math.cos(ang)*dist}px;--ty:${Math.sin(ang)*dist}px;animation-duration:${.38+Math.random()*.2}s`;
    document.body.appendChild(p);setTimeout(()=>p.remove(),700);
  }
});

// Draw the cursor shape on the cdot canvas
// t: -1=up arrow, 0=circle, 1=down arrow (lerped)
function drawCursor(t,scale){
  const S=24;
  dCtx.clearRect(0,0,S,S);
  const cx=S/2,cy=S/2;
  const absT=Math.abs(t);
  
  // Skip if too small
  if(absT<0.008 && scale===1){
    dCtx.translate(cx,cy);
    dCtx.beginPath();
    dCtx.arc(0,0,4,0,Math.PI*2);
    dCtx.fillStyle=cachedCursorColor;
    dCtx.fill();
    dCtx.translate(-cx,-cy);
    return;
  }

  const dir=t>=0?1:-1; // 1=down, -1=up
  dCtx.save();
  dCtx.translate(cx,cy);
  dCtx.scale(scale,scale);

  // Lerp: circle radius shrinks as arrow grows
  const circleR=4*(1-absT);
  // Arrow params
  const arrowH=9*absT;       // height of arrowhead
  const arrowW=5.5*absT;     // half-width of arrowhead
  const stemW=1.8*absT;      // half-width of stem
  const stemH=5*absT;        // stem length (above/below arrowhead)

  dCtx.beginPath();

  if(absT<0.01){
    // Pure circle
    dCtx.arc(0,0,4,0,Math.PI*2);
  }else if(absT>0.98){
    // Pure arrow (down if dir=1, up if dir=-1)
    // tip at (0, dir*arrowH*0.5), tail at (0, -dir*(stemH+arrowH*0.5))
    const tip=dir*arrowH*0.5;
    const tailY=-dir*(stemH+arrowH*0.5);
    const arrowBaseY=tip-dir*arrowH;
    // Stem rect
    dCtx.moveTo(-stemW,tailY);
    dCtx.lineTo(-stemW,arrowBaseY);
    // Left wing of arrowhead
    dCtx.lineTo(-arrowW,arrowBaseY);
    // Tip
    dCtx.lineTo(0,tip);
    // Right wing
    dCtx.lineTo(arrowW,arrowBaseY);
    // Stem right side
    dCtx.lineTo(stemW,arrowBaseY);
    dCtx.lineTo(stemW,tailY);
    dCtx.closePath();
  }else{
    // Morphing blend: draw circle shrinking + arrow growing
    // Circle
    if(circleR>0.3){
      dCtx.arc(0,0,circleR,0,Math.PI*2);
      dCtx.closePath();
    }
    // Arrow (partially formed)
    const tip=dir*arrowH*0.5;
    const tailY=-dir*(stemH+arrowH*0.5);
    const arrowBaseY=tip-dir*arrowH;
    dCtx.moveTo(-stemW,tailY);
    dCtx.lineTo(-stemW,arrowBaseY);
    dCtx.lineTo(-arrowW,arrowBaseY);
    dCtx.lineTo(0,tip);
    dCtx.lineTo(arrowW,arrowBaseY);
    dCtx.lineTo(stemW,arrowBaseY);
    dCtx.lineTo(stemW,tailY);
    dCtx.closePath();
  }

  dCtx.fillStyle=cachedCursorColor;
  dCtx.fill();
  dCtx.restore();
}

(function anim(){
  // Update cached values for colors only when they change
  const needsColorUpdate=cachedIsNight!==document.body.classList.contains('night')||
    cachedFsOpen!==(focusFS?.classList.contains('open')||swFS?.classList.contains('open'));
  
  if(needsColorUpdate){
    cachedIsNight=document.body.classList.contains('night');
    cachedFsOpen=focusFS?.classList.contains('open')||swFS?.classList.contains('open');
    cachedCursorColor=cachedFsOpen?'rgba(255,255,255,0.85)':cachedIsNight?'rgba(240,240,255,1)':'rgba(15,15,15,1)';
    cachedTrailRGB=cachedFsOpen?'255,255,255':cachedIsNight?'245,245,255':'15,15,15';
  }

  // Apply buffered mousemove position and add trail point in animation frame
  if(nextMx!==mx||nextMy!==my){
    mx=nextMx;my=nextMy;
    cdot.style.transform=`translate3d(${mx-12}px,${my-12}px,0)`;
    trailPts[trailHead]={x:mx,y:my,age:1};
    trailHead=(trailHead+1)%TRAIL_LEN;
  }

  // Drive morph target from scroll velocity, clamped -1..1
  const vel=globalScrollVel;
  globalScrollVel*=0.55; // fast decay — clears within ~4 frames after scroll stops
  cursorMorphTarget=Math.max(-1,Math.min(1,vel*0.35)); // more sensitive

  // Very fast lerp — essentially instant on scroll, snaps back quickly when stopped
  cursorMorph+=(cursorMorphTarget-cursorMorph)*0.45;
  if(Math.abs(cursorMorph)<0.008)cursorMorph=0;

  // Smooth scale lerp for click squish
  // (dotScale is set instantly on click, we lerp back)
  const dispScale=dotScale+(1-dotScale)*(1-0.22); // quick
  // Draw the morphed cursor
  drawCursor(cursorMorph,dispScale);

  // Age trail points
  for(let i=0;i<TRAIL_LEN;i++){trailPts[i].age*=0.85;}

  tCtx.clearRect(0,0,trailCanvas.width,trailCanvas.height);

  // Build ordered array newest→oldest, skip dead points
  const ordered=[];
  for(let i=0;i<TRAIL_LEN;i++){
    const idx=(trailHead-1-i+TRAIL_LEN)%TRAIL_LEN;
    const p=trailPts[idx];
    if(p.age<0.01)break;
    ordered.push(p);
  }

  if(ordered.length>=2&&showTrail){
    // Measure speed at head (px moved between newest two points)
    const dx=ordered[0].x-ordered[1].x;
    const dy=ordered[0].y-ordered[1].y;
    const speed=Math.hypot(dx,dy);
    // Width: thicker when moving fast, thinner when slow
    const maxW=Math.min(5.5,1.8+speed*0.18);

    // Draw as single continuous path for smooth trail (no visible dots)
    tCtx.lineCap='round';
    tCtx.lineJoin='round';
    
    // Build the entire path first
    tCtx.beginPath();
    tCtx.moveTo(ordered[0].x,ordered[0].y);
    for(let i=1;i<ordered.length;i++){
      tCtx.lineTo(ordered[i].x,ordered[i].y);
    }
    
    // Draw with gradient opacity from head to tail
    const headAlpha=Math.min(1,ordered[0].age)*0.85;
    tCtx.strokeStyle=`rgba(${cachedTrailRGB},${headAlpha})`;
    tCtx.lineWidth=maxW;
    tCtx.stroke();
    
    // Optional second pass with thinner line for better definition
    tCtx.strokeStyle=`rgba(${cachedTrailRGB},${headAlpha*0.5})`;
    tCtx.lineWidth=maxW*0.6;
    tCtx.stroke();
  }

  requestAnimationFrame(anim);
})();

/* ════ PILL SIDEBAR — proximity + drag ══════════════════ */
const pill=document.getElementById('pill'),mainEl=document.getElementById('main'),pbtn=document.getElementById('pinbtn'),grip=document.getElementById('pill-grip');
let pinned=localStorage.getItem('stpin4')==='1';
let pillX=parseFloat(localStorage.getItem('stpx4')||'14');
let pillY=parseFloat(localStorage.getItem('stpy4')||String(window.innerHeight/2-120));
const PROX=130;
let pillHov=false;

function setPillPos(x,y){
  const pw=pill.classList.contains('open')?216:56;
  const ph=pill.getBoundingClientRect().height||300;
  pillX=Math.max(8,Math.min(window.innerWidth-pw-8,x));
  pillY=Math.max(8,Math.min(window.innerHeight-ph-8,y));
  pill.style.left=pillX+'px';pill.style.top=pillY+'px';pill.style.transform='none';
  localStorage.setItem('stpx4',pillX);localStorage.setItem('stpy4',pillY);
}
setPillPos(pillX,pillY);

const pageStack=document.getElementById('page-stack');

function setSBPush(on){
  pageStack.style.left = on ? '222px' : '0px';
}

function applySB(){
  if(pinned){
    pill.classList.add('pinned');
    pill.classList.add('open');
    pbtn.classList.add('on');
    grip.style.display='none';
    setSBPush(true);
  } else {
    pill.classList.remove('pinned');
    if(!pillHov) pill.classList.remove('open');
    pbtn.classList.remove('on');
    grip.style.display='flex';
    setSBPush(false);
  }
  updateSettingsOverlayPosition();
}
function togglePin(){
  pinned=!pinned;
  localStorage.setItem('stpin4',pinned?'1':'0');
  const defaultX=14;
  const defaultY=window.innerHeight/2-120;
  if(pinned){
    // Check if already near default position - skip position animation if within ±3px
    const nearDefault = pillX >= defaultX-3 && pillX <= defaultX+3 && pillY >= defaultY-3 && pillY <= defaultY+3;
    if(nearDefault){
      // Already near default position, just expand immediately
      pill.style.left='0px';
      pill.style.top='0px';
      pill.style.transform='none';
      applySB();
      // Update tracked position after expansion settles
      setTimeout(()=>{
        pillX=0;pillY=0;
        localStorage.setItem('stpx4',pillX);
        localStorage.setItem('stpy4',pillY);
      },350);
    }else{
      // Stage 1: Rapidly animate position to (0,0) in 0.15s
      pill.style.transition='left .15s cubic-bezier(.4,0,.2,1),top .15s cubic-bezier(.4,0,.2,1)';
      pill.style.left='0px';
      pill.style.top='0px';
      pill.style.transform='none';
      // Stage 2: After position animation, trigger expansion (0.35s)
      setTimeout(()=>{
        pill.style.transition='';
        applySB();
        // Update tracked position after total animation settles (0.15s + 0.35s = 0.5s)
        setTimeout(()=>{
          pillX=0;pillY=0;
          localStorage.setItem('stpx4',pillX);
          localStorage.setItem('stpy4',pillY);
        },350);
      },150);
    }
  }else{
    // Unpin: first remove .pinned class to trigger contraction, then restore position
    applySB();
    // Clear any inline height style to prevent stuck height
    pill.style.height='';
    // Restore position with CSS transitions intact
    pill.style.left=pillX+'px';
    pill.style.top=pillY+'px';
  }
  showToast(pinned?'Sidebar pinned':'Sidebar unpinned');
}

// Drag — suppress position transition while dragging, restore after (disabled when pinned)
let dragging=false,dragOX=0,dragOY=0;
grip.addEventListener('mousedown',e=>{
  if(pinned)return; // Can't drag when pinned
  e.preventDefault();
  dragging=true;
  dragOX=e.clientX-pillX;
  dragOY=e.clientY-pillY;
  document.body.style.userSelect='none';
  // Strip left/top from transition so cursor tracks instantly
  pill.style.transition='width .35s cubic-bezier(.4,0,.2,1),border-radius .35s,background .2s';
});
document.addEventListener('mousemove',e=>{if(!dragging)return;setPillPos(e.clientX-dragOX,e.clientY-dragOY);updateSettingsOverlayPosition();});
document.addEventListener('mouseup',()=>{
  if(dragging){
    dragging=false;
    document.body.style.userSelect='';
    pill.style.transition=''; // Restore CSS transition (falls back to stylesheet)
  }
});

// Proximity hover expand
document.addEventListener('mousemove',e=>{
  if(pinned||dragging)return;
  const r=pill.getBoundingClientRect();
  const cx=r.left+r.width/2,cy=r.top+r.height/2;
  const dist=Math.hypot(e.clientX-cx,e.clientY-cy);
  if(dist<PROX&&!pillHov){pillHov=true;pill.classList.add('open');updateSettingsOverlayPosition();}
  else if(dist>PROX+35&&pillHov){pillHov=false;pill.classList.remove('open');updateSettingsOverlayPosition();}
});

function updateSettingsOverlayPosition(){
  const overlay=document.getElementById('settings-overlay');
  if(!overlay)return;
  const isPinned=pill.classList.contains('pinned');
  const isPillOpen=pill.classList.contains('open');
  // When pinned, always use pinned padding regardless of actual position
  if(isPinned){
    // Sidebar is pinned at 0,0 with 222px width - padding = 0 + 222 + 30 = 252px
    overlay.style.paddingLeft='252px';
  }else if(pillX < -10 || pillX > 38){
    // Sidebar moved from original position - stick to left wall with fixed padding
    overlay.style.paddingLeft='24px';
  }else if(isPillOpen){
    // When pill is open (216px) at original position, add extra padding to avoid overlap
    overlay.style.paddingLeft='246px';
  }else{
    // When pill is closed (56px) at original position, use default padding
    overlay.style.paddingLeft='86px';
  }
}

applySB();

/* ════ SUBJECT ICONS ════════════════════════════════════ */
const SIC={
  mathematics:`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M12 4v16M4 12h16M6 6l12 12M18 6L6 18"/></svg>`,
  english:`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>`,
  science:`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3v8L5.5 18.5a1 1 0 00.9 1.5h11.2a1 1 0 00.9-1.5L15 11V3M9 3h6"/></svg>`,
  music:`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  commerce:`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h18v4H3zM5 7v14M19 7v14M9 11h6M9 15h6"/></svg>`,
  geography:`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M3 12h18M12 3c-3 4-3 14 0 18M12 3c3 4 3 14 0 18"/></svg>`,
  history:`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  'history elective':`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  pdhpe:`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 20l3-7 4 3 4-3 3 7M8 13l4-8 4 8"/></svg>`,
  pe:`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 20l3-7 4 3 4-3 3 7M8 13l4-8 4 8"/></svg>`,
  'extra pe':`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 20l3-7 4 3 4-3 3 7M8 13l4-8 4 8"/></svg>`,
  careers:`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path stroke-linecap="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>`,
  volleyball:`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3c3 3 6 6 0 18M12 3c-3 3-6 6 0 18M3 12h18"/></svg>`,
  'roll call':`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
};

/* ════ TIMETABLE DATA ═══════════════════════════════════ */
// Times are AEDT local (UTC+11), sourced from ICS + PDF
const TT={monday:[],tuesday:[],wednesday:[],thursday:[],friday:[]};
const DKEYS=['','monday','tuesday','wednesday','thursday','friday'];
function toM(h,m){return h*60+m;}
function getCurNxt(){
  const now=new Date(),nm=toM(now.getHours(),now.getMinutes())+now.getSeconds()/60,dow=now.getDay();
  if(dow<1||dow>5)return{cur:null,nxt:null,weekend:true};
  const s=TT[DKEYS[dow]];let cur=null,nxt=null,ci=-1;
  for(let i=0;i<s.length;i++){const p=s[i];if(nm>=toM(...p.s)&&nm<toM(...p.e)){cur=p;ci=i;break;}}
  for(let i=ci>=0?ci+1:0;i<s.length;i++){if(toM(...s[i].s)>nm){nxt=s[i];break;}}
  return{cur,nxt,weekend:false};
}

/* ════ TICK ══════════════════════════════════════════════ */
function tick(){
  const now=new Date(),h=now.getHours(),nm=toM(h,now.getMinutes())+now.getSeconds()/60;
  let gr='Good Morning';if(h>=17)gr='Good Evening';else if(h>=12)gr='Good Afternoon';
  const eyeEl=document.getElementById('h-eye');if(eyeEl)eyeEl.textContent=gr;

  // Floating clock widget — 24h with seconds, centred
  const cwt=document.getElementById('cw-time'),cwsc=document.getElementById('cw-secs'),cwd=document.getElementById('cw-date');
  if(cwt){
    // Set just the text node (first child), leaving the <span> intact
    let displayHours=h;
    if(use12hTime)displayHours=h%12||12;
    cwt.firstChild.textContent=`${String(displayHours).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    if(cwsc)cwsc.textContent=`:${String(now.getSeconds()).padStart(2,'0')}`;
    if(cwd)cwd.textContent=now.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  }

  const T=document.getElementById('h-timer'),L=document.getElementById('h-lbl'),P=document.getElementById('h-per'),R=document.getElementById('h-room'),G=document.getElementById('h-prog');
  if(!T)return;
  const{cur,nxt,weekend}=getCurNxt();
  if(weekend){T.textContent='—';L.textContent='no school';P.textContent='Weekend';R.textContent='';G.style.width='0%';if(!pinnedSubj)updateSubjTile(null);return;}
  
  // Check if any timetable data exists
  const hasTTData=Object.values(TT).some(day=>day.length>0);
  
  const ib=p=>!p||!p.subj;
  if(cur){
    const pe=toM(...cur.e),rem=pe-nm;
    const rm=Math.floor(rem),rs=Math.round((rem-rm)*60);
    const tot=pe-toM(...cur.s),el=nm-toM(...cur.s);
    L.textContent=ib(cur)?cur.l:'in session';
    P.textContent=ib(cur)?cur.l:cur.subj;
    R.textContent=ib(cur)?'':(cur.room||'');
    T.textContent=`${String(rm).padStart(2,'0')}:${String(rs).padStart(2,'0')}`;
    G.style.width=Math.min(el/tot*100,100)+'%';
    if(!pinnedSubj)updateSubjTile(ib(cur)?null:cur.subj);
  }else if(nxt){
    const ps=toM(...nxt.s),rem=ps-nm;
    const rm=Math.floor(rem),rs=Math.round((rem-rm)*60);
    L.textContent=ib(nxt)?'next up':'next period';
    P.textContent=ib(nxt)?nxt.l:nxt.subj;
    R.textContent=ib(nxt)?'':(nxt.room||'');
    T.textContent=`${String(rm).padStart(2,'0')}:${String(rs).padStart(2,'0')}`;
    G.style.width='0%';if(!pinnedSubj)updateSubjTile(null);
  }else if(hasTTData){
    T.textContent='done';L.textContent='school ended';P.textContent='See you tomorrow';R.textContent='';G.style.width='100%';if(!pinnedSubj)updateSubjTile(null);
  }else{
    let displayHours=h;
    if(use12hTime)displayHours=h%12||12;
    T.textContent=`${String(displayHours).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    L.textContent='no timetable';
    P.textContent='import your .ics file';
    R.textContent='';
    G.style.width='0%';
    if(!pinnedSubj)updateSubjTile(null);
  }
  if(curPage==='cal')renderExamList();
}
setInterval(tick,1000);

let pinnedSubj=null;

function pinSubjTile(subj){
  pinnedSubj=(pinnedSubj===subj)?null:subj;
  // Show/hide unpin X
  const unpin=document.getElementById('sched-unpin');
  if(unpin)unpin.style.display=pinnedSubj?'flex':'none';
  // Update ts-row highlights
  document.querySelectorAll('.ts-row[data-subj]').forEach(r=>{
    r.classList.toggle('ts-pinned',r.dataset.subj===pinnedSubj);
  });
  animateSubjTile(pinnedSubj||getCurSubj()||null);
}

function unpinSubj(){
  pinnedSubj=null;
  const unpin=document.getElementById('sched-unpin');
  if(unpin)unpin.style.display='none';
  document.querySelectorAll('.ts-row[data-subj]').forEach(r=>r.classList.remove('ts-pinned'));
  animateSubjTile(getCurSubj()||null);
}

function animateSubjTile(subj){
  const wrap=document.getElementById('st-content');
  if(!wrap){updateSubjTile(subj);return;}
  wrap.classList.add('fading');
  setTimeout(()=>{
    updateSubjTile(subj);
    wrap.classList.remove('fading');
    wrap.classList.remove('faded-in');
    void wrap.offsetWidth; // force reflow
    wrap.classList.add('faded-in');
    setTimeout(()=>wrap.classList.remove('faded-in'),360);
  },180);
}

function stQuickAdd(){
  const subj=pinnedSubj||getCurSubj()||'';
  // Open homework modal pre-filled with this subject
  openHWModal();
  if(subj)setTimeout(()=>{document.getElementById('hw-subj').value=subj;},50);
}

function updateSubjTile(subj){
  const eye=document.getElementById('st-eye'),name=document.getElementById('st-name'),remsEl=document.getElementById('st-rems'),addBtn=document.getElementById('st-add-btn');
  if(!eye)return;
  if(!subj){
    eye.textContent='between classes';
    name.textContent='free';
    remsEl.innerHTML='<div class="st-lucky">Nothing on right now.</div>';
    if(addBtn)addBtn.style.display='none';
    return;
  }
  const sc=subjColour(subj);
  const isPinned=!!pinnedSubj;
  eye.textContent=isPinned?`pinned · ${subj}`:'in session';
  name.textContent=subj;
  // Tint the tile subtly with the subject colour
  const tile=document.getElementById('subj-tile');
  if(tile&&sc){
    tile.style.background=`linear-gradient(135deg,color-mix(in srgb,${sc} 22%,rgba(15,15,20,.9)) 0%,color-mix(in srgb,${sc} 12%,rgba(28,28,40,.92)) 100%)`;
  }else if(tile){
    tile.style.background='';
  }

  const sr=rems.filter(r=>!r.done&&r.subj===subj);
  const sh=hw.filter(h=>!h.done&&h.subj===subj);

  let html='';
  if(sr.length===0&&sh.length===0){
    const luckys=['lucky you — nothing due.','all clear for '+subj+' ✓','you\'re on top of it.','nothing logged here.'];
    html=`<div class="st-lucky">${luckys[Math.floor(Math.random()*luckys.length)]}</div>`;
  }else{
    sh.forEach(h=>{
      const overdue=h.due&&h.due<new Date().toISOString().split('T')[0];
      html+=`<div class="st-rem" style="display:flex;align-items:center;gap:6px">
        <span style="font-size:9px;opacity:.5">📚</span>
        <span style="flex:1">${esc(h.task)}${h.due?` <span style="font-size:10px;opacity:.55">${overdue?'⚠ ':''}`+formatHWDate(h.due)+'</span>':''}</span>
        ${h.link?`<a href="${esc(h.link)}" target="_blank" rel="noopener" style="font-size:9px;opacity:.5;color:inherit;text-decoration:none;cursor:none" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.5">↗</a>`:''}
      </div>`;
    });
    sr.forEach(r=>{
      html+=`<div class="st-rem" style="display:flex;align-items:center;gap:6px"><span style="font-size:9px;opacity:.5">📌</span><span>${esc(r.text)}</span></div>`;
    });
  }
  remsEl.innerHTML=html;
  if(addBtn)addBtn.style.display='';
}

/* ════ TIMETABLE RENDER ═════════════════════════════════ */
function renderTT(){
  const g=document.getElementById('ttg');g.innerHTML='';
  const days=['monday','tuesday','wednesday','thursday','friday'];

  // Check if any timetable data exists
  const hasData=days.some(d=>TT[d]&&TT[d].length>0);
  if(!hasData){
    g.style.display='block';
    g.innerHTML=`<div class="es" style="padding:40px;text-align:center;grid-column:1/-1">
      <div style="font-size:32px;margin-bottom:14px;opacity:.3">📅</div>
      <div style="font-size:15px;font-weight:500;margin-bottom:8px">No timetable imported yet</div>
      <div style="font-size:13px;color:var(--t3);margin-bottom:18px;line-height:1.6">Import your <span style="font-family:'Geist Mono',monospace;font-size:11px">.ics</span> file to populate your timetable.</div>
      <button class="btn bd" onclick="showTTImport()" style="margin:0 auto">Import .ics file</button>
    </div>`;
    return;
  }
  g.style.display='';
  const{cur}=getCurNxt();
  const corner=document.createElement('div');corner.className='tt-corner';g.appendChild(corner);
  days.forEach(d=>{const el=document.createElement('div');el.className='tt-dh';el.innerHTML=`<div class="dds">${d.slice(0,3).toUpperCase()}</div><div>${d[0].toUpperCase()+d.slice(1)}</div>`;g.appendChild(el);});
  const rows=['roll call','period 1','period 2','recess','period 3','period 4','period 5','period 6','lunch','period 7','period 8'];
  // Baulko Wednesday: lunch bell is in the period 6 slot, period 6 is in the lunch slot
  const wedSwap={'period 6':'lunch','lunch':'period 6'};
  const dm={};days.forEach(d=>{dm[d]={};TT[d].forEach(p=>{const k=p.l.startsWith('period')?p.l:p.l.includes('lunch')?'lunch':p.l.includes('recess')?'recess':p.l;dm[d][k]=p;});});
  rows.forEach(rk=>{
    const ph=document.createElement('div');ph.className='tt-ph';
    let ts='';for(const d of days){const p=dm[d][rk];if(p){const pad=n=>String(n).padStart(2,'0');ts=`${p.s[0]}:${pad(p.s[1])}–${p.e[0]}:${pad(p.e[1])}`;break;}}
    ph.innerHTML=`<div class="phn">${rk}</div><div class="pht">${ts}</div>`;g.appendChild(ph);
    days.forEach((d,di)=>{
      // For Wednesday, swap the lookup key so lunch shows in p6 row and vice versa
      const lookupKey=d==='wednesday'&&wedSwap[rk]?wedSwap[rk]:rk;
      const p=dm[d][lookupKey];const cell=document.createElement('div');
      const displayBreak=d==='wednesday'?wedSwap[rk]||rk:rk;
      if(rk==='recess'||(rk==='lunch'&&d!=='wednesday')||(rk==='period 6'&&d==='wednesday'&&!p)){
        cell.className='ttbr';cell.innerHTML=`<div class="ttbrl">${rk==='recess'?'recess':'lunch'}</div>`;
      }else if(rk==='lunch'&&d==='wednesday'){
        // Wednesday: lunch row shows period 6 content
        if(p&&p.subj){
          const isNow=cur&&cur.subj===p.subj&&cur.l===p.l&&new Date().getDay()===di+1;
          cell.className='ttc'+(isNow?' now':'');
          const icon=p.icon&&TT_ICONS[p.icon]?TT_ICONS[p.icon]:(SIC[p.subj]||SIC['roll call']);
          const sc=subjColour(p.subj);
          if(sc)cell.style.borderTopColor=sc;
          cell.innerHTML=`<div class="tt-sj"><div class="tt-ic">${icon}</div><div><div class="ttn">${p.subj}</div><div class="ttr">${p.room||''}</div></div></div>`;
          cell.dataset.day=d;cell.dataset.period=lookupKey;
          cell.addEventListener('dblclick',()=>openTTEdit(d,lookupKey,p));
        }else{cell.className='ttbr';cell.innerHTML=`<div class="ttbrl">—</div>`;}
      }else if(rk==='period 6'&&d==='wednesday'){
        cell.className='ttbr';cell.innerHTML=`<div class="ttbrl">lunch</div>`;
      }else if(rk==='lunch'){
        cell.className='ttbr';cell.innerHTML=`<div class="ttbrl">lunch</div>`;
      }else if(p&&p.subj){
        const isNow=cur&&cur.subj===p.subj&&cur.l===p.l&&new Date().getDay()===di+1;
        cell.className='ttc'+(isNow?' now':'');
        const icon=p.icon&&TT_ICONS[p.icon]?TT_ICONS[p.icon]:(SIC[p.subj]||SIC['roll call']);
        const sc=subjColour(p.subj);
        if(sc)cell.style.borderTopColor=sc;
        cell.innerHTML=`<div class="tt-sj"><div class="tt-ic">${icon}</div><div><div class="ttn">${p.subj}</div><div class="ttr">${p.room||''}</div></div></div>`;
        cell.dataset.day=d;cell.dataset.period=rk;
        cell.addEventListener('dblclick',()=>openTTEdit(d,rk,p));
      }else{cell.className='ttbr';cell.innerHTML=`<div class="ttbrl">—</div>`;}
      g.appendChild(cell);
    });
  });
}

/* ════ SUPABASE SYNC ═════════════════════════════════════
   All user data keys are synced to Supabase under the
   authenticated user's ID. localStorage stays as the
   offline/fallback cache — both are always written together.
════════════════════════════════════════════════════════ */
const SB_URL='https://wbbiqcdmkmydwshzvize.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiYmlxY2Rta215ZHdzaHp2aXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDc1MzMsImV4cCI6MjA4OTkyMzUzM30.EACRq05DU5NErRKl8NY6MvrQNnDv9HbgqGDIX5-Wan8';
const SB_SYNC_KEYS=['st_r5','st_e5','st_l5','st_p5','st_x5','st_hw','st_name','st_ics','st_friends'];
let sbUserId=null;
let sbAuthToken=null;

async function sbFetch(path,opts={}){
  const headers={'apikey':SB_KEY,'Content-Type':'application/json',...(sbAuthToken?{'Authorization':'Bearer '+sbAuthToken}:{}),...(opts.headers||{})};
  return fetch(SB_URL+path,{...opts,headers});
}

// Write one key to Supabase (upsert)
async function sbSet(k,v){
  if(!sbUserId)return;
  try{
    const ts=new Date().toISOString();
    await sbFetch('/rest/v1/entries',{
      method:'POST',
      headers:{'Prefer':'resolution=merge-duplicates'},
      body:JSON.stringify({user_id:sbUserId,key:k,value:JSON.stringify(v),updated_at:ts})
    });
    // Record when we last pushed this key so silent pull can skip older remote data
    const localTs=JSON.parse(localStorage.getItem('sb_push_ts')||'{}');
    localTs[k]=ts;
    localStorage.setItem('sb_push_ts',JSON.stringify(localTs));
  }catch{}
}

// Read all keys for the current user from Supabase (includes timestamps for conflict resolution)
async function sbLoadAll(){
  if(!sbUserId)return null;
  try{
    const r=await sbFetch(`/rest/v1/entries?select=key,value,updated_at&user_id=eq.${sbUserId}`);
    if(!r.ok)return null;
    const rows=await r.json();
    const out={};
    rows.forEach(row=>{
      try{out[row.key]={data:JSON.parse(row.value),updated_at:row.updated_at};}catch{out[row.key]={data:row.value,updated_at:row.updated_at};}
    });
    return out;
  }catch{return null;}
}

// sv — write to localStorage + Supabase
function sv(k,v){
  localStorage.setItem(k,JSON.stringify(v));
  sbSet(k,v);
}

// Auth: send magic link
// Auth: sign in with email+password
async function sbSignIn(email,password){
  const r=await sbFetch('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
  if(!r.ok){const e=await r.json();return{error:e.error_description||e.msg||'Invalid email or password'};}
  return await r.json();
}

// Auth: sign up with email+password
async function sbSignUp(email,password){
  const r=await sbFetch('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password})});
  const d=await r.json();
  if(!r.ok){return{error:d.error_description||d.msg||'Sign up failed'};}
  // Auto sign-in after sign-up
  if(d.access_token)return d;
  // Email confirmation required — sign in immediately
  return sbSignIn(email,password);
}

// Auth: get session from Supabase (checks stored token)
async function sbGetSession(){
  const stored=localStorage.getItem('sb_session');
  if(!stored)return null;
  try{
    const sess=JSON.parse(stored);
    if(sess.expires_at&&Date.now()/1000>sess.expires_at-60){
      const r=await sbFetch('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:sess.refresh_token})});
      if(!r.ok){localStorage.removeItem('sb_session');return null;}
      const fresh=await r.json();
      localStorage.setItem('sb_session',JSON.stringify(fresh));
      return fresh;
    }
    return sess;
  }catch{return null;}
}

// Apply remote data over local state
function applyRemoteData(remote){
  if(!remote)return;
  // remote[key] is now {data, updated_at} — extract just the data
  const get=(k)=>{const v=remote[k];return v!==undefined?(v.data!==undefined?v.data:v):undefined;};
  const r5=get('st_r5');if(r5!==undefined){rems=r5;localStorage.setItem('st_r5',JSON.stringify(rems));}
  const e5=get('st_e5');if(e5!==undefined){evs=e5;localStorage.setItem('st_e5',JSON.stringify(evs));}
  const l5=get('st_l5');if(l5!==undefined){logs=l5;localStorage.setItem('st_l5',JSON.stringify(logs));}
  const p5=get('st_p5');if(p5!==undefined){papers=p5;localStorage.setItem('st_p5',JSON.stringify(papers));}
  const x5=get('st_x5');if(x5!==undefined){exams=x5;localStorage.setItem('st_x5',JSON.stringify(exams));}
  const hw5=get('st_hw');if(hw5!==undefined){hw=hw5;localStorage.setItem('st_hw',JSON.stringify(hw));}
  const name=get('st_name');if(name){localStorage.setItem('st_name',name);applyName(name);}
  const ics=get('st_ics');
  if(ics){
    const parsed=typeof ics==='string'?JSON.parse(ics):ics;
    localStorage.setItem('st_ics',JSON.stringify(parsed));applyICS(parsed);
  }
  const fr=get('st_friends');if(fr!==undefined){lbFriends=fr;localStorage.setItem('st_friends',JSON.stringify(fr));}
  if(window.innerWidth<=640){mhRenderHeroPanel();mhRenderRems();mhRenderHW();mhRenderCal();mhRenderExams();mhRenderTodayEvs();}
}

// Push all local data to Supabase (for first-time sync after login)
async function sbPushAll(){
  if(!sbUserId)return;
  const keys=['st_r5','st_e5','st_l5','st_p5','st_x5','st_hw'];
  for(const k of keys){
    const v=localStorage.getItem(k);
    if(v)await sbSet(k,JSON.parse(v));
  }
  const name=localStorage.getItem('st_name');if(name)await sbSet('st_name',name);
  const ics=localStorage.getItem('st_ics');if(ics)await sbSet('st_ics',JSON.parse(ics));
}

/* ════ STATE ════════════════════════════════════════════ */
let rems=JSON.parse(localStorage.getItem('st_r5')||'[]');
let evs=JSON.parse(localStorage.getItem('st_e5')||'[]');
let logs=JSON.parse(localStorage.getItem('st_l5')||'[]');
let papers=JSON.parse(localStorage.getItem('st_p5')||'[]');
let exams=JSON.parse(localStorage.getItem('st_x5')||'[]');
let calY,calM,calSel,qdate=null;
let curPage='dash',curStudyTab='log',curPaperSubj='mathematics';
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const COLS=['#111','#2563eb','#16a34a','#dc2626','#9333ea','#ea580c','#0891b2','#ca8a04'];

const ICOS=['📘','📗','📙','📕','📓','📔','📒','📃'];
// sv defined earlier (line ~3918) — writes to localStorage AND Supabase. Do not redefine.
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function wkS(d){const dy=d.getDay(),df=dy===0?-6:1-dy,s=new Date(d);s.setDate(d.getDate()+df);s.setHours(0,0,0,0);return s;}

/* ════ NAV ══════════════════════════════════════════════ */
// Subtle whoosh via Web Audio API — no file needed
let _ac=null;
function playWhoosh(){
  try{
    if(!_ac)_ac=new(window.AudioContext||window.webkitAudioContext)();
    const ac=_ac;
    // Noise burst filtered into a swoosh
    const buf=ac.createBuffer(1,ac.sampleRate*0.18,ac.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
    const src=ac.createBufferSource();src.buffer=buf;
    // Bandpass — sweeps from high to low for "whoosh" feel
    const bp=ac.createBiquadFilter();bp.type='bandpass';bp.frequency.setValueAtTime(2200,ac.currentTime);bp.frequency.exponentialRampToValueAtTime(380,ac.currentTime+0.16);bp.Q.value=1.4;
    // Gain envelope — quick fade in, fade out
    const gain=ac.createGain();gain.gain.setValueAtTime(0,ac.currentTime);gain.gain.linearRampToValueAtTime(0.09,ac.currentTime+0.03);gain.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+0.17);
    src.connect(bp);bp.connect(gain);gain.connect(ac.destination);
    src.start();src.stop(ac.currentTime+0.18);
  }catch{}
}

function goTo(pg,el){
  if(pg===curPage)return;
  playWhoosh();
  const out=document.getElementById('pg-'+curPage);
  const inn=document.getElementById('pg-'+pg);
  if(!inn)return;

  // Freeze backdrop-filters during transition to save GPU
  document.body.classList.add('transitioning');
  setTimeout(()=>document.body.classList.remove('transitioning'),520);

  pageStack.scrollTop=0;

  if(out){
    out.classList.remove('act');
    out.classList.add('leaving');
    setTimeout(()=>out.classList.remove('leaving'),320);
  }

  inn.classList.remove('act');
  requestAnimationFrame(()=>inn.classList.add('act'));

  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('act'));
  el.classList.add('act');
  curPage=pg;

  // Show/hide floating stopwatch widget
  if((swRunning||swElapsed>0)&&pg!=='study'){
    swFloatShow();
  }else{
    swFloatHide();
  }

  if(pg==='dash'){renderDash();setupScroll();}
  if(pg==='cal'){renderCal();renderExamList();}
  if(pg==='tt')renderTT();
  if(pg==='study')renderStudy();
  if(pg==='friends')initFriendsTab();
  // Keep mobile bottom nav in sync
  if(typeof syncMobileNav==='function')syncMobileNav();
}

/* ════ SCROLL ANIMATIONS ════════════════════════════════ */
let sObs=null;
let scrollFirstSeen=false;
function setupScroll(){
  if(sObs)sObs.disconnect();
  const stack=document.getElementById('page-stack');
  const homeScroll=document.getElementById('home-scroll');

  sObs=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      const card=entry.target;
      if(entry.isIntersecting){
        card.classList.remove('exit-up');
        void card.offsetHeight;
        card.classList.add('vis');
        // Once the last card has been seen, mark as revisit for future scrolls
        if(!scrollFirstSeen&&homeScroll){
          const cards=homeScroll.querySelectorAll('.drop-card');
          const allSeen=[...cards].every(c=>c.classList.contains('vis'));
          if(allSeen){scrollFirstSeen=true;homeScroll.classList.add('revisit');}
        }
      }else{
        const rect=entry.boundingClientRect;
        if(rect.top<0){
          card.classList.remove('vis');
          card.classList.add('exit-up');
        }else{
          card.classList.remove('vis','exit-up');
        }
      }
    });
  },{root:stack,threshold:0.06,rootMargin:'0px 0px -30px 0px'});

  document.querySelectorAll('.drop-card').forEach(c=>{
    c.classList.remove('vis','exit-up');
    sObs.observe(c);
  });
}

/* ════ DASHBOARD ════════════════════════════════════════ */
function renderDash(){
  tick();
  const now=new Date(),td=now.toISOString().split('T')[0];

  // Quick stats
  const qr=document.getElementById('qs-rem-count'),qe=document.getElementById('qs-exam-count'),ql=document.getElementById('qs-log-count'),qh=document.getElementById('qs-hw-count');
  if(qr)qr.textContent=rems.filter(r=>!r.done).length;
  if(qe)qe.textContent=exams.filter(ex=>new Date(ex.date+'T09:00:00')>=now).length;
  if(ql)ql.textContent=logs.length;
  if(qh)qh.textContent=hw.filter(h=>!h.done).length;
  renderHW();

  // Today's schedule mini-list
  const dow=now.getDay();
  const sched=document.getElementById('today-sched');
  if(sched){
    if(dow<1||dow>5){sched.innerHTML='<div class="es" style="padding:4px"><div class="ei">—</div>No school today.</div>';}
    else{
      const nm=toM(now.getHours(),now.getMinutes());
      const day=TT[DKEYS[dow]];
      const rows=day.filter(p=>p.subj&&p.subj!=='roll call').map(p=>{
        const pad=n=>String(n).padStart(2,'0');
        const isNow=nm>=toM(...p.s)&&nm<toM(...p.e);
        const isPinned=p.subj===pinnedSubj;
        const sc=subjColour(p.subj);
        return`<div class="ts-row${isNow?' ts-now':''}${isPinned?' ts-pinned':''}" data-subj="${esc(p.subj)}" onclick="pinSubjTile('${esc(p.subj)}')" style="${sc&&!isNow?`border-left:2.5px solid ${sc};padding-left:9px`:isNow&&sc?`border-left:2.5px solid rgba(255,255,255,.6);padding-left:9px`:''}">
          <div class="ts-time">${p.s[0]}:${pad(p.s[1])}</div>
          <div class="ts-dot"></div>
          <div class="ts-name">${p.subj}</div>
          <div class="ts-room">${p.room||''}</div>
        </div>`;
      });
      sched.innerHTML=rows.length?rows.join(''):'<div class="es" style="padding:4px"><div class="ei">—</div>No periods today.</div>';
    }
  }

  // Today's events
  const te=evs.filter(e=>e.date===td).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const tl=document.getElementById('tdl');
  if(tl)tl.innerHTML=te.length?te.map((e,i)=>`<div class="sci"><div class="sct">${e.time||'—'}</div><div class="scd" style="background:${COLS[i%COLS.length]}"></div><div class="scn">${esc(e.name)}${e.subj?` <span style="font-size:10px;color:var(--t3);font-family:'Geist Mono',monospace">${e.subj}</span>`:''}</div></div>`).join(''):'<div class="es" style="padding:10px"><div class="ei">—</div>No events today.</div>';

  // Next exam
  const upcoming=exams.filter(ex=>new Date(ex.date+'T09:00:00')>=now).sort((a,b)=>a.date.localeCompare(b.date));
  const nei=document.getElementById('next-exam-inner');
  if(nei){
    if(!upcoming.length){nei.innerHTML='<div class="es" style="padding:6px"><div class="ei">—</div>No exams added yet. Head to Study Log to add one.</div>';}
    else{
      const ex=upcoming[0];
      const ed=new Date(ex.date+'T09:00:00'),diff=ed-now,days=Math.max(0,Math.floor(diff/86400000));
      const pct=Math.max(2,100-days/90*100);
      nei.innerHTML=`<div style="display:flex;align-items:center;gap:16px">
        <div style="flex:1">
          <div style="font-size:17px;font-weight:600;letter-spacing:-.02em">${esc(ex.name)}</div>
          <div style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--t3);margin-top:3px;text-transform:uppercase;letter-spacing:.06em">${ex.subj} · ${ex.date}</div>
          <div style="margin-top:10px;height:3px;background:rgba(0,0,0,.08);border-radius:10px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--text);border-radius:10px;transition:width .6s"></div></div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:38px;font-weight:200;letter-spacing:-.04em;line-height:1">${days}</div>
          <div style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--t3)">days left</div>
        </div>
      </div>
      ${upcoming.length>1?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,.06);font-size:12px;color:var(--t3)">${upcoming.slice(1,3).map(e=>{const d=Math.max(0,Math.floor((new Date(e.date+'T09:00:00')-now)/86400000));return`<span style="margin-right:14px">${e.subj} <b style="color:var(--text)">${d}d</b></span>`;}).join('')}</div>`:''}`
    }
  }

  renderRems();
}

/* ════ REMINDERS ════════════════════════════════════════ */
/* Returns the subject currently in session, or '' if none */
function getCurSubj(){
  const{cur}=getCurNxt();
  return(cur&&cur.subj&&cur.subj!=='roll call')?cur.subj:'';
}

function openRM(){
  document.getElementById('rem-subj').value=getCurSubj();
  setTimeout(cddSyncAll,0);
  document.getElementById('rm').classList.add('open');
  setTimeout(()=>document.getElementById('rem-text').focus(),200);
}
function closeRM(){document.getElementById('rm').classList.remove('open');}
document.getElementById('rm').addEventListener('click',e=>{if(e.target===document.getElementById('rm'))closeRM();});
function saveRem(){
  const text=document.getElementById('rem-text').value.trim();if(!text)return;
  rems.unshift({id:Date.now(),text,pri:document.getElementById('rem-pri').value,subj:document.getElementById('rem-subj').value,done:false,ld:null});
  sv('st_r5',rems);document.getElementById('rem-text').value='';document.getElementById('rem-subj').value='';
  closeRM();renderRems();
  const{cur}=getCurNxt();updateSubjTile(cur&&cur.subj?cur.subj:null);
}
function renderRems(){
  const el=document.getElementById('rl');if(!el)return;
  if(!rems.length){el.innerHTML='<div class="es"><div class="ei">—</div>No reminders. Hit "Add Reminder" above.</div>';return;}
  el.innerHTML=rems.map(r=>{
    const sc=subjColour(r.subj);
    const borderStyle=sc?`border-left-color:${sc}`:'';
    return`<div class="ri ${r.done?'done':''}" id="r${r.id}" data-id="${r.id}" style="${borderStyle}">
    <div class="drag-handle" title="Drag to reorder"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="17" r="1" fill="currentColor"/><circle cx="15" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="17" r="1" fill="currentColor"/></svg></div>
    <div class="rck" onclick="togRem(${r.id})">${r.done?'<svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>':''}</div>
    <div style="flex:1"><div class="rt">${esc(r.text)}</div>${r.ld?`<div style="font-size:10px;font-family:'Geist Mono',monospace;color:var(--t3)">📅 ${r.ld}</div>`:''}</div>
    ${r.subj?`<div class="r-subj"${sc?` style="background:${sc}22;color:${sc};border:1px solid ${sc}44"`:''}">${r.subj}</div>`:''}
    <div class="badge b${r.pri?r.pri[0]:'n'}">${r.pri||'normal'}</div>
    <div class="db" onclick="delRem(${r.id})">✕</div>
  </div>`;
  }).join('');
  el.querySelectorAll('.ri[data-id]').forEach(el=>makeDraggable(el,'rem'));
}
function togRem(id){const r=rems.find(r=>r.id===id);if(r){r.done=!r.done;sv('st_r5',rems);renderRems();}}
function delRem(id){rems=rems.filter(r=>r.id!==id);sv('st_r5',rems);renderRems();}

/* ════ HOMEWORK ═════════════════════════════════════════ */
let hw=JSON.parse(localStorage.getItem('st_hw')||'[]');
let hwFilter='all';

function openHWModal(){
  document.getElementById('hw-task').value='';
  document.getElementById('hw-subj').value=getCurSubj();
  document.getElementById('hw-due').value='';
  document.getElementById('hw-link').value='';
  document.getElementById('hw-cal').checked=true;
  setTimeout(cddSyncAll,0);
  document.getElementById('hw-modal').classList.add('open');
  setTimeout(()=>document.getElementById('hw-task').focus(),200);
}
function closeHWModal(){document.getElementById('hw-modal').classList.remove('open');}
document.getElementById('hw-modal').addEventListener('click',function(e){if(e.target===this)closeHWModal();});

function saveHW(){
  const task=document.getElementById('hw-task').value.trim();
  if(!task)return;
  const subj=document.getElementById('hw-subj').value;
  const due=document.getElementById('hw-due').value;
  const link=document.getElementById('hw-link').value.trim();
  const addToCal=document.getElementById('hw-cal').checked;
  const id=Date.now();
  hw.unshift({id,task,subj,due,link,done:false});
  sv('st_hw',hw);
  // Sync to calendar if due date + opted in
  if(due&&addToCal){
    evs.push({id:id+1,name:`📚 ${task}`,date:due,time:'',note:subj,subj,hwId:id});
    evs.sort((a,b)=>a.date.localeCompare(b.date));sv('st_e5',evs);
  }
  closeHWModal();
  renderHW();
  // Update qs counter
  const qr=document.getElementById('qs-rem-count');
  if(qr)qr.textContent=rems.filter(r=>!r.done).length;
}

function setHWFilter(f,el){
  hwFilter=f;
  document.querySelectorAll('.hw-filter').forEach(e=>e.classList.remove('act'));
  el.classList.add('act');
  const list=document.getElementById('hw-list');
  if(list){list.classList.remove('switching');void list.offsetWidth;list.classList.add('switching');}
  renderHW();
}

function togHW(id){
  const item=hw.find(h=>h.id===id);
  if(item){item.done=!item.done;sv('st_hw',hw);renderHW();}
}
function delHW(id){
  hw=hw.filter(h=>h.id!==id);sv('st_hw',hw);
  // Remove calendar event if synced
  evs=evs.filter(e=>e.hwId!==id);sv('st_e5',evs);
  renderHW();
}

function renderHW(){
  const el=document.getElementById('hw-list');if(!el)return;
  const now=new Date();
  const today=now.toISOString().split('T')[0];
  let list=hw;
  if(hwFilter==='pending')list=hw.filter(h=>!h.done);
  else if(hwFilter==='done')list=hw.filter(h=>h.done);
  if(!list.length){
    el.innerHTML=`<div class="es"><div class="ei">—</div>${hwFilter==='done'?'Nothing done yet.':hwFilter==='pending'?'All clear!':'No homework yet.'}</div>`;
    return;
  }
  el.innerHTML=list.map(h=>{
    const overdue=h.due&&h.due<today&&!h.done;
    const dueLabel=h.due?`due ${formatHWDate(h.due)}`:'';
    const sc=subjColour(h.subj);
    const borderStyle=sc?`border-left-color:${sc}`:'';
    return`<div class="hw-item${h.done?' done':''}" data-id="${h.id}" style="${borderStyle}">
      <div class="drag-handle"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="17" r="1" fill="currentColor"/><circle cx="15" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="17" r="1" fill="currentColor"/></svg></div>
      <div class="hw-check" onclick="togHW(${h.id})">${h.done?`<svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>`:''}</div>
      <div style="flex:1">
        <div class="hw-task-text">${esc(h.task)}</div>
        <div class="hw-meta">
          ${dueLabel?`<span class="${overdue?'hw-overdue':''}">${dueLabel}${overdue?' · overdue':''}</span>`:''}
          ${h.link?`<a href="${esc(h.link)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:3px;color:var(--t2);text-decoration:none;font-size:10px;font-family:'Geist Mono',monospace;padding:1px 6px;border-radius:4px;background:rgba(0,0,0,.05);transition:background .12s;cursor:none" onmouseover="this.style.background='rgba(37,99,235,.10)';this.style.color='#2563eb'" onmouseout="this.style.background='rgba(0,0,0,.05)';this.style.color='var(--t2)'"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>open</a>`:''}
        </div>
      </div>
      ${h.subj?`<div class="hw-subj-badge"${sc?` style="background:${sc}22;color:${sc};border:1px solid ${sc}44"`:''}">${h.subj}</div>`:''}
      <div class="db" onclick="delHW(${h.id})">✕</div>
    </div>`;
  }).join('');
  el.querySelectorAll('.hw-item[data-id]').forEach(e=>makeDraggable(e,'hw'));
}

function formatHWDate(ds){
  const d=new Date(ds+'T12:00');
  const today=new Date();today.setHours(0,0,0,0);
  const diff=Math.round((d-today)/86400000);
  if(diff===0)return'today';
  if(diff===1)return'tomorrow';
  if(diff===-1)return'yesterday';
  if(diff>0&&diff<7)return d.toLocaleDateString('en-AU',{weekday:'short'});
  return d.toLocaleDateString('en-AU',{day:'numeric',month:'short'});
}

/* ════ CALENDAR ═════════════════════════════════════════ */
let calTapTimer=null,calTapDs=null;
function renderCal(){
  const now=new Date();if(calY===undefined){calY=now.getFullYear();calM=now.getMonth();}
  document.getElementById('cml').textContent=`${MONTHS[calM]} ${calY}`;

  const first=new Date(calY,calM,1),last=new Date(calY,calM+1,0);
  let dow=first.getDay();dow=dow===0?6:dow-1;
  const today=now.toISOString().split('T')[0];
  const g=document.getElementById('cg');g.innerHTML='';
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d=>{const e=document.createElement('div');e.className='cdn';e.textContent=d;g.appendChild(e);});
  const prev=new Date(calY,calM,0).getDate();
  for(let i=0;i<dow;i++){const e=document.createElement('div');e.className='cd oth';e.textContent=prev-dow+1+i;g.appendChild(e);}
  for(let d=1;d<=last.getDate();d++){
    const ds=`${calY}-${String(calM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvs=evs.filter(e=>e.date===ds);
    const el=document.createElement('div');
    let cls='cd'+(ds===today?' tdy':'')+(ds===calSel?' sel':'');
    el.className=cls;

    // Chips — events only
    let chipsHtml='';
    if(dayEvs.length){
      const show=dayEvs.slice(0,2);
      const extra=dayEvs.length-show.length;
      chipsHtml=`<div class="cd-chips">${show.map(ev=>`<div class="cd-chip">${esc(ev.name)}</div>`).join('')}${extra?`<div class="cd-chip" style="opacity:.55">+${extra} more</div>`:''}</div>`;
    }
    el.innerHTML=`<span class="cd-num">${d}</span>${chipsHtml}`;
    el.ondblclick=function(ev){ev.preventDefault();ev.stopPropagation();openQM(ds);};
    el.onclick=function(ev){
      if(calTapDs===ds){
        clearTimeout(calTapTimer);calTapTimer=null;calTapDs=null;
        openQM(ds);
      }else{
        calTapDs=ds;
        calTapTimer=setTimeout(()=>{selDay(ds);calTapDs=null;},350);
      }
    };
    g.appendChild(el);
  }
  const tot=dow+last.getDate();for(let i=1;i<=(tot%7===0?0:7-tot%7);i++){const e=document.createElement('div');e.className='cd oth';e.textContent=i;g.appendChild(e);}
  renderEvs();
}
function calNav(d){calM+=d;if(calM<0){calM=11;calY--;}if(calM>11){calM=0;calY++;}renderCal();}
function selDay(ds){calSel=calSel===ds?null:ds;document.getElementById('cfl').textContent=calSel?new Date(calSel+'T12:00').toLocaleDateString('en-AU',{day:'numeric',month:'short'}):'All';renderCal();}

function openQM(ds){
  qdate=ds;const d=new Date(ds+'T12:00');
  document.getElementById('qm-dl').textContent=d.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'});
  ['qen','qet','qeno'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('qes').value=getCurSubj();
  document.getElementById('qer').checked=false;
  setTimeout(cddSyncAll,0);
  document.getElementById('qm').classList.add('open');
  setTimeout(()=>document.getElementById('qen').focus(),220);
}
function closeQM(){document.getElementById('qm').classList.remove('open');qdate=null;}
document.getElementById('qm').addEventListener('click',e=>{if(e.target===document.getElementById('qm'))closeQM();});
function saveQEv(){
  const name=document.getElementById('qen').value.trim();if(!name||!qdate)return;
  const subj=document.getElementById('qes').value;
  evs.push({id:Date.now(),name,date:qdate,time:document.getElementById('qet').value,note:document.getElementById('qeno').value,subj});
  evs.sort((a,b)=>a.date.localeCompare(b.date));sv('st_e5',evs);
  if(document.getElementById('qer').checked){
    rems.unshift({id:Date.now()+1,text:name,pri:document.getElementById('qert').value,subj,done:false,ld:new Date(qdate+'T12:00').toLocaleDateString('en-AU',{day:'numeric',month:'short'})});
    sv('st_r5',rems);renderRems();
  }
  closeQM();renderCal();renderDash();
}
function renderEvs(){
  const el=document.getElementById('evl');
  const list=calSel?evs.filter(e=>e.date===calSel):evs;
  if(!list.length){el.innerHTML='<div class="es" style="padding:10px">No events.<br><span style="font-size:11px">Double-click a day to add one.</span></div>';return;}
  el.innerHTML=list.map((e,i)=>`<div class="evi">
    <div style="width:3px;border-radius:4px;background:${COLS[i%COLS.length]};align-self:stretch;flex-shrink:0"></div>
    <div style="flex:1"><div class="en">${esc(e.name)}</div><div class="em">${e.date}${e.time?' · '+e.time:''}${e.note?' · '+esc(e.note):''}</div>${e.subj?`<div class="ev-stag">${e.subj}</div>`:''}</div>
    <div class="db" onclick="delEv(${e.id})">✕</div>
  </div>`).join('');
}
function delEv(id){evs=evs.filter(e=>e.id!==id);sv('st_e5',evs);renderCal();}

/* ════ STUDY ════════════════════════════════════════════ */
function renderStudy(){
  const ppd=document.getElementById('pp-date');if(ppd)ppd.value=new Date().toISOString().split('T')[0];
  renderLogList();renderPapers();
}
const STABS=['log','papers'];
function switchStudyTab(tab,el){
  if(curStudyTab===tab)return;
  playWhoosh();
  const fromIdx=STABS.indexOf(curStudyTab);
  const toIdx=STABS.indexOf(tab);
  const goRight=toIdx>fromIdx;

  const outEl=document.getElementById('stab-'+curStudyTab);
  const inEl=document.getElementById('stab-'+tab);

  // Render content into the incoming panel while it's still invisible
  if(tab==='papers')renderPapers();

  // Outgoing: slide out (stays in DOM as absolute overlay)
  if(outEl){
    outEl.classList.remove('visible','pre-enter-right','pre-enter-left');
    outEl.classList.add(goRight?'exit-right':'exit-left');
    setTimeout(()=>{
      outEl.classList.remove('exit-right','exit-left');
      outEl.classList.add(goRight?'pre-enter-left':'pre-enter-right');
    },360);
  }

  // Incoming: snap to start position (absolutely placed, invisible), then transition to visible
  if(inEl){
    // Ensure we're starting from the correct off-screen position
    inEl.classList.remove('visible','exit-right','exit-left','pre-enter-right','pre-enter-left');
    inEl.classList.add(goRight?'pre-enter-right':'pre-enter-left');
    // Double rAF: ensures the pre-enter class paints before we add .visible
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      inEl.classList.remove('pre-enter-right','pre-enter-left');
      inEl.classList.add('visible');
    }));
  }

  document.querySelectorAll('.stab').forEach(t=>t.classList.remove('act'));
  if(el)el.classList.add('act');
  curStudyTab=tab;
}

/* Stopwatch */
let swRunning=false,swStart=0,swElapsed=0,swTimer=null;

function swFmt(ms){
  const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60);
  const pad=n=>String(n).padStart(2,'0');
  return`${pad(h)}:${pad(m%60)}:${pad(s%60)}`;
}
function swTick(){
  document.getElementById('sw-display').textContent=swFmt(swElapsed+(Date.now()-swStart));
}
function swToggle(){
  if(!swRunning){
    // Start
    swStart=Date.now();
    swRunning=true;
    swTimer=setInterval(swTick,500);
    document.getElementById('sw-btn-lbl').textContent='Pause';
    document.getElementById('sw-btn-icon').innerHTML='<rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/>';
    document.getElementById('sw-status').textContent='running';
    document.getElementById('sw-stop-btn').style.display='';
    const cb=document.getElementById('sw-cancel-btn');if(cb)cb.style.display='flex';
  }else{
    // Pause
    swElapsed+=Date.now()-swStart;
    clearInterval(swTimer);swRunning=false;
    document.getElementById('sw-btn-lbl').textContent='Resume';
    document.getElementById('sw-btn-icon').innerHTML='<polygon points="5,3 19,12 5,21"/>';
    document.getElementById('sw-status').textContent='paused';
  }
}
function swStop(){
  if(swRunning){swElapsed+=Date.now()-swStart;clearInterval(swTimer);swRunning=false;}
  const mins=Math.round(swElapsed/60000);
  const subj=document.getElementById('lg-subj').value;
  const what=document.getElementById('lg-what').value.trim()||'study session';
  const date=new Date().toISOString().split('T')[0];
  if(mins>0){
    logs.unshift({id:Date.now(),subj,what,mins,date});
    sv('st_l5',logs);renderLogList();
    lbUpdateStreak();
    lbUpdateWeekly(mins);
    confetti();
    showToast(`Logged ${mins}m of ${subj}`);
  }
  swElapsed=0;
  document.getElementById('sw-display').textContent='00:00:00';
  document.getElementById('sw-btn-lbl').textContent='Start';
  document.getElementById('sw-btn-icon').innerHTML='<polygon points="5,3 19,12 5,21"/>';
  document.getElementById('sw-status').textContent='ready';
  document.getElementById('sw-stop-btn').style.display='none';
  document.getElementById('lg-what').value='';
  const cb=document.getElementById('sw-cancel-btn');if(cb)cb.style.display='none';
  swFloatHide();
}

function swCancel(){
  // Discard the current session without logging
  if(swRunning){clearInterval(swTimer);swRunning=false;}
  swElapsed=0;
  document.getElementById('sw-display').textContent='00:00:00';
  document.getElementById('sw-btn-lbl').textContent='Start';
  document.getElementById('sw-btn-icon').innerHTML='<polygon points="5,3 19,12 5,21"/>';
  document.getElementById('sw-status').textContent='ready';
  document.getElementById('sw-stop-btn').style.display='none';
  const cb=document.getElementById('sw-cancel-btn');if(cb)cb.style.display='none';
  swFloatHide();
}

/* ════ FLOATING STOPWATCH WIDGET ════════════════════════ */
let swFloatTimer=null;
// (GAP removed — sw-float now centers independently of clock)

function swFloatShow(){
  const el=document.getElementById('sw-float');
  if(!el)return;
  el.style.display='flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('visible')));
  swFloatSync();
  if(swFloatTimer)clearInterval(swFloatTimer);
  swFloatTimer=setInterval(swFloatSync,500);
}

function swFloatHide(){
  const el=document.getElementById('sw-float');
  if(!el)return;
  el.classList.remove('visible');
  setTimeout(()=>{el.style.display='none';},340);
  if(swFloatTimer){clearInterval(swFloatTimer);swFloatTimer=null;}
}

function swFloatSync(){
  const el=document.getElementById('sw-float');
  if(!el||el.style.display==='none')return;
  const ms=swElapsed+(swRunning?Date.now()-swStart:0);
  // Show mm:ss if under an hour, hh:mm:ss if longer
  const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60);
  const pad=n=>String(n).padStart(2,'0');
  const fmt=h>0?`${pad(h)}:${pad(m%60)}:${pad(s%60)}`:`${pad(m)}:${pad(s%60)}`;
  document.getElementById('sw-float-time').textContent=fmt;
  // Subject label
  const subj=document.getElementById('lg-subj')?document.getElementById('lg-subj').value:'';
  const subjEl=document.getElementById('sw-float-subj');
  if(subjEl)subjEl.textContent=subj||'';
  // Dot state
  const dot=document.getElementById('sw-float-dot');
  if(dot)dot.className=swRunning?'':'paused';
  // Pause icon
  const icon=document.getElementById('sw-float-pause-icon');
  if(icon){
    if(swRunning){
      icon.innerHTML='<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';
    }else{
      icon.innerHTML='<polygon points="5,3 19,12 5,21"/>';
    }
  }
}

function swFloatToggle(){
  swToggle();
  swFloatSync();
}

function swFloatReturn(){
  // Navigate back to study page, stopwatch tab
  const ni=document.querySelector('.ni[data-page="study"]');
  if(ni)goTo('study',ni);
  setTimeout(()=>{
    const tabEl=document.querySelector('.stab[onclick*="\'log\'"]');
    switchStudyTab('log',tabEl);
  },100);
  swFloatHide();
}

/* ════ STUDY MODE TOGGLE ════════════════════════════════ */
let curSwMode='stopwatch';
function swSetMode(mode,el){
  if(curSwMode===mode)return;
  curSwMode=mode;
  document.querySelectorAll('.swm').forEach(e=>e.classList.remove('act'));
  if(el)el.classList.add('act');
  const swp=document.getElementById('sw-panel');
  const ftp=document.getElementById('focus-panel');
  const fsBtn=document.getElementById('sw-fs-open-btn');
  if(mode==='stopwatch'){
    swp.style.display='';ftp.style.display='none';
    if(fsBtn){fsBtn.title='Fullscreen stopwatch';}
  }else{
    swp.style.display='none';ftp.style.display='block';
    if(fsBtn){fsBtn.title='Begin focus session';}
  }
}

/* ════ STOPWATCH FULLSCREEN ════════════════════════════ */
let swFsOpen=false,swFsTimer=null;
function swOpenFs(){
  if(curSwMode==='focus'){ftBegin();return;}
  const el=document.getElementById('sw-fs');
  if(!el)return;
  swFsOpen=true;
  el.classList.add('open');
  document.body.style.overflow='hidden';
  swFsSyncAll();
  if(swFsTimer)clearInterval(swFsTimer);
  swFsTimer=setInterval(swFsSyncAll,500);
}
function swCloseFs(){
  const el=document.getElementById('sw-fs');
  if(!el)return;
  swFsOpen=false;
  el.classList.remove('open');
  document.body.style.overflow='';
  if(swFsTimer){clearInterval(swFsTimer);swFsTimer=null;}
  // sync back to card
  swFloatSync();
}
function swFsSyncAll(){
  const ms=swElapsed+(swRunning?Date.now()-swStart:0);
  const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60);
  const pad=n=>String(n).padStart(2,'0');
  document.getElementById('sw-fs-time').textContent=`${pad(h)}:${pad(m%60)}:${pad(s%60)}`;
  document.getElementById('sw-fs-status').textContent=swRunning?'running':ms>0?'paused':'ready';
  const subj=document.getElementById('lg-subj')?document.getElementById('lg-subj').value:'';
  document.getElementById('sw-fs-subj').textContent=subj||'';
  const icon=document.getElementById('sw-fs-icon');
  const lbl=document.getElementById('sw-fs-lbl');
  if(swRunning){
    if(icon)icon.innerHTML='<rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/>';
    if(lbl)lbl.textContent='Pause';
  }else{
    if(icon)icon.innerHTML='<polygon points="5,3 19,12 5,21"/>';
    if(lbl)lbl.textContent=ms>0?'Resume':'Start';
  }
  const stopBtn=document.getElementById('sw-fs-stop-btn');
  if(stopBtn)stopBtn.style.display=ms>0?'':'none';
}
function swFsToggle(){
  swToggle();swFsSyncAll();
}
function swFsStop(){
  swStop();
  // Sync display
  document.getElementById('sw-fs-time').textContent='00:00:00';
  document.getElementById('sw-fs-status').textContent='ready';
  const icon=document.getElementById('sw-fs-icon');if(icon)icon.innerHTML='<polygon points="5,3 19,12 5,21"/>';
  const lbl=document.getElementById('sw-fs-lbl');if(lbl)lbl.textContent='Start';
  const stopBtn=document.getElementById('sw-fs-stop-btn');if(stopBtn)stopBtn.style.display='none';
}

/* ════ FOCUS TIMER ══════════════════════════════════════ */
let ftDurMins=25,ftAtm='sakura',ftRunning=false,ftPaused=false;
let ftTotalSecs=0,ftRemSecs=0,ftTimer=null,ftAnimFrame=null;
let ftBreakEnabled=true,ftSoundEnabled=true,ftAutoLog=true;
let ftBreakShown=false,ftBreakAt=20*60; // show break nudge after 20 min
let ftCanvas=null,ftCtx=null,ftParticles=[];

function ftSliderUpdate(v){
  ftDurMins=+v;
  document.getElementById('ft-dur-val').textContent=v;
}
function ftSelAtm(atm,el){
  ftAtm=atm;
  document.querySelectorAll('.atm-card').forEach(c=>c.classList.remove('act'));
  if(el)el.classList.add('act');
}
function ftToggleOpt(opt,el){
  el.classList.toggle('on');
  if(opt==='break')ftBreakEnabled=el.classList.contains('on');
  else if(opt==='sound')ftSoundEnabled=el.classList.contains('on');
  else if(opt==='log')ftAutoLog=el.classList.contains('on');
}

function ftBegin(){
  const slider=document.getElementById('ft-slider');
  if(slider)ftDurMins=+slider.value;
  ftTotalSecs=ftDurMins*60;
  ftRemSecs=ftTotalSecs;
  ftRunning=true;ftPaused=false;ftBreakShown=false;
  // open fullscreen
  const fs=document.getElementById('focus-fs');
  fs.classList.add('open');
  document.body.style.overflow='hidden';
  // set labels
  const goal=document.getElementById('ft-goal')?.value||'';
  document.getElementById('ffs-goal').textContent=goal?goal.toUpperCase():'';
  document.getElementById('ffs-atm-label').textContent=ftAtmName(ftAtm);
  document.getElementById('ffs-status').textContent='focusing';
  document.getElementById('ffs-pause-icon').innerHTML='<rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/>';
  document.getElementById('ffs-pause-lbl').textContent='Pause';
  document.getElementById('ffs-break').classList.remove('show');
  document.getElementById('ffs-done-msg').classList.remove('show');
  // ring
  const circ=2*Math.PI*120;
  const fill=document.getElementById('ffs-ring-fill');
  fill.style.strokeDasharray=circ;
  fill.style.strokeDashoffset=0;
  ftUpdateDisplay();
  ftSetAtmColour(ftAtm);
  // init canvas
  ftCanvas=document.getElementById('focus-fs-canvas');
  ftCtx=ftCanvas.getContext('2d');
  ftResizeCanvas();
  ftInitParticles();
  ftStartTimer();
  ftAnimLoop();
}

function ftAtmName(a){
  return{sakura:'Sakura',space:'Space',ocean:'Ocean',autumn:'Autumn',rain:'Rain',aurora:'Aurora'}[a]||a;
}
function ftSetAtmColour(a){
  const map={
    sakura:'#1a0a12',space:'#030612',ocean:'#020d1a',
    autumn:'#150a03',rain:'#070c12',aurora:'#040d0a'
  };
  document.getElementById('focus-fs').style.background=map[a]||'#0a0a12';
  const ringFill=document.getElementById('ffs-ring-fill');
  const cols={sakura:'rgba(255,180,200,.6)',space:'rgba(150,180,255,.5)',ocean:'rgba(80,200,220,.5)',autumn:'rgba(240,150,60,.55)',rain:'rgba(160,200,240,.5)',aurora:'rgba(80,220,160,.5)'};
  if(ringFill)ringFill.style.stroke=cols[a]||'rgba(255,255,255,.45)';
}

function ftResizeCanvas(){
  if(!ftCanvas)return;
  ftCanvas.width=window.innerWidth;ftCanvas.height=window.innerHeight;
}

function ftStartTimer(){
  if(ftTimer)clearInterval(ftTimer);
  ftTimer=setInterval(()=>{
    if(ftPaused||!ftRunning)return;
    ftRemSecs--;
    // break nudge
    if(ftBreakEnabled&&!ftBreakShown&&ftRemSecs<=ftTotalSecs-ftBreakAt&&ftTotalSecs>ftBreakAt){
      ftBreakShown=true;
      document.getElementById('ffs-break').classList.add('show');
    }
    if(ftRemSecs<=0){ftRemSecs=0;ftDone();return;}
    ftUpdateDisplay();
  },1000);
}

function ftUpdateDisplay(){
  const m=Math.floor(ftRemSecs/60),s=ftRemSecs%60;
  const pad=n=>String(n).padStart(2,'0');
  document.getElementById('ffs-time').textContent=`${pad(m)}:${pad(s)}`;
  // ring progress
  const circ=2*Math.PI*120;
  const pct=ftRemSecs/ftTotalSecs;
  const offset=circ*(1-pct);
  const fill=document.getElementById('ffs-ring-fill');
  if(fill)fill.style.strokeDashoffset=offset;
}

function ftTogglePause(){
  ftPaused=!ftPaused;
  const icon=document.getElementById('ffs-pause-icon');
  const lbl=document.getElementById('ffs-pause-lbl');
  const status=document.getElementById('ffs-status');
  if(ftPaused){
    icon.innerHTML='<polygon points="5,3 19,12 5,21"/>';
    lbl.textContent='Resume';status.textContent='paused';
  }else{
    icon.innerHTML='<rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/>';
    lbl.textContent='Pause';status.textContent='focusing';
  }
}
function ftSkip5(){
  ftRemSecs=Math.min(ftTotalSecs,ftRemSecs+300);
  ftUpdateDisplay();
}
function ftEnd(){
  ftRunning=false;ftPaused=false;
  if(ftTimer){clearInterval(ftTimer);ftTimer=null;}
  const minsDone=Math.round((ftTotalSecs-ftRemSecs)/60);
  if(ftAutoLog&&minsDone>0){
    const subj=document.getElementById('ft-subj')?.value||document.getElementById('lg-subj')?.value||'study';
    const what=document.getElementById('ft-goal')?.value||'focus session';
    logs.unshift({id:Date.now(),subj,what,mins:minsDone,date:new Date().toISOString().split('T')[0]});
    sv('st_l5',logs);renderLogList();
    showToast(`Logged ${minsDone}m of ${subj}`);
  }
  ftExit();
}
function ftExit(){
  ftRunning=false;ftPaused=false;
  if(ftTimer){clearInterval(ftTimer);ftTimer=null;}
  if(ftAnimFrame){cancelAnimationFrame(ftAnimFrame);ftAnimFrame=null;}
  document.getElementById('focus-fs').classList.remove('open');
  document.body.style.overflow='';
  ftParticles=[];
}
function ftDone(){
  ftRunning=false;
  if(ftTimer){clearInterval(ftTimer);ftTimer=null;}
  // chime
  if(ftSoundEnabled)ftChime();
  // show done message
  const minsDone=ftDurMins;
  document.getElementById('ffs-done-sub').textContent=`${minsDone} minutes · well done`;
  document.getElementById('ffs-done-msg').classList.add('show');
  if(ftAutoLog){
    const subj=document.getElementById('ft-subj')?.value||document.getElementById('lg-subj')?.value||'study';
    const what=document.getElementById('ft-goal')?.value||'focus session';
    logs.unshift({id:Date.now(),subj,what,mins:minsDone,date:new Date().toISOString().split('T')[0]});
    sv('st_l5',logs);renderLogList();
  }
  confetti();
}
function ftTakeBreak(){
  ftTogglePause();
  document.getElementById('ffs-break').classList.remove('show');
}
function ftDismissBreak(){
  document.getElementById('ffs-break').classList.remove('show');
}
function ftChime(){
  try{
    const ac=new AudioContext();
    const freqs=[523,659,784,1047];
    freqs.forEach((f,i)=>{
      const osc=ac.createOscillator();
      const gain=ac.createGain();
      osc.connect(gain);gain.connect(ac.destination);
      osc.frequency.value=f;osc.type='sine';
      const t=ac.currentTime+i*.18;
      gain.gain.setValueAtTime(0,t);
      gain.gain.linearRampToValueAtTime(.18,t+.05);
      gain.gain.exponentialRampToValueAtTime(.0001,t+.7);
      osc.start(t);osc.stop(t+.7);
    });
  }catch(e){}
}

/* ── Canvas atmosphere animations ── */
function ftInitParticles(){
  ftParticles=[];
  const n=ftAtm==='rain'?180:ftAtm==='space'?200:80;
  for(let i=0;i<n;i++)ftParticles.push(ftMakeParticle(true));
}
function ftMakeParticle(init){
  const W=ftCanvas?ftCanvas.width:window.innerWidth;
  const H=ftCanvas?ftCanvas.height:window.innerHeight;
  const a=ftAtm;
  if(a==='sakura'){
    return{x:Math.random()*W*1.2-W*.1,y:init?Math.random()*H:-20,
      size:Math.random()*10+5,speed:Math.random()*.8+.4,
      drift:Math.random()*1.2-.6,rot:Math.random()*360,
      rotSpeed:Math.random()*2-1,sway:Math.random()*2+1,swayOff:Math.random()*Math.PI*2,
      opacity:Math.random()*.5+.4,hue:Math.random()*30};
  }
  if(a==='autumn'){
    return{x:Math.random()*W*1.2-W*.1,y:init?Math.random()*H:-20,
      size:Math.random()*14+6,speed:Math.random()*.7+.3,
      drift:Math.random()*1.5-.75,rot:Math.random()*360,
      rotSpeed:Math.random()*3-1.5,sway:Math.random()*2+.5,swayOff:Math.random()*Math.PI*2,
      opacity:Math.random()*.5+.35,hue:Math.random()*40};// hue 0-40 → red/orange
  }
  if(a==='space'){
    const big=Math.random()<.03;
    return{x:Math.random()*W,y:init?Math.random()*H:Math.random()*H,
      size:big?Math.random()*2+1.5:Math.random()*.8+.2,
      speed:big?.05:.02+Math.random()*.08,
      drift:Math.random()*.3-.15,
      opacity:Math.random()*.6+.2,twinkleOff:Math.random()*Math.PI*2,twinkleSpeed:Math.random()*.03+.01};
  }
  if(a==='ocean'){
    return{x:Math.random()*W,y:init?Math.random()*H:H+20,
      size:Math.random()*3+1,speed:-(Math.random()*.5+.15),
      drift:Math.random()*.8-.4,opacity:Math.random()*.35+.08,
      life:0,maxLife:Math.random()*200+100};
  }
  if(a==='rain'){
    return{x:Math.random()*W,y:init?Math.random()*H:-10,
      len:Math.random()*12+8,speed:Math.random()*8+10,
      opacity:Math.random()*.28+.06};
  }
  if(a==='aurora'){
    return{x:Math.random()*W,y:Math.random()*H*.6,
      w:Math.random()*300+200,h:Math.random()*80+40,
      speed:Math.random()*.2-.1,dy:Math.random()*.1-.05,
      opacity:0,targetOp:Math.random()*.12+.04,
      hue:Math.random()*60+140,phase:Math.random()*Math.PI*2};
  }
  return{x:0,y:0,size:2,speed:.5,opacity:.5};
}

function ftAnimLoop(){
  if(!ftRunning&&!ftPaused){return;}
  ftAnimFrame=requestAnimationFrame(ftAnimLoop);
  if(!ftCtx||!ftCanvas)return;
  const W=ftCanvas.width,H=ftCanvas.height;
  const t=Date.now()*.001;
  ftCtx.clearRect(0,0,W,H);

  if(ftAtm==='aurora')ftDrawAurora(W,H,t);

  for(let i=0;i<ftParticles.length;i++){
    const p=ftParticles[i];
    if(ftAtm==='sakura'||ftAtm==='autumn'){
      p.y+=p.speed;
      p.x+=p.drift+Math.sin(t*p.sway+p.swayOff)*.5;
      p.rot+=p.rotSpeed;
      if(p.y>H+30){Object.assign(p,ftMakeParticle(false));p.y=-20;}
      ftCtx.save();
      ftCtx.translate(p.x,p.y);
      ftCtx.rotate(p.rot*Math.PI/180);
      ftCtx.globalAlpha=p.opacity;
      if(ftAtm==='sakura'){
        // pink petal
        ftCtx.fillStyle=`hsl(${340+p.hue},80%,82%)`;
        ftCtx.beginPath();
        ftCtx.ellipse(0,0,p.size*.6,p.size,0,0,Math.PI*2);
        ftCtx.fill();
        ftCtx.fillStyle=`hsla(${340+p.hue},60%,90%,.5)`;
        ftCtx.beginPath();
        ftCtx.ellipse(0,-p.size*.3,p.size*.3,p.size*.5,0,0,Math.PI*2);
        ftCtx.fill();
      }else{
        // autumn leaf (simple shape)
        const h=20+p.hue*1.5; // 20-80 = red-orange-yellow
        ftCtx.fillStyle=`hsl(${h},90%,52%)`;
        ftCtx.beginPath();
        ftCtx.moveTo(0,-p.size);
        ftCtx.bezierCurveTo(p.size*.7,-p.size*.5,p.size*.7,p.size*.5,0,p.size);
        ftCtx.bezierCurveTo(-p.size*.7,p.size*.5,-p.size*.7,-p.size*.5,0,-p.size);
        ftCtx.fill();
      }
      ftCtx.restore();
    } else if(ftAtm==='space'){
      p.y+=p.speed;p.x+=p.drift;
      if(p.y>H+5){Object.assign(p,ftMakeParticle(false));p.y=-5;}
      const twinkle=.5+.5*Math.sin(t*p.twinkleSpeed*60+p.twinkleOff);
      ftCtx.globalAlpha=p.opacity*(.6+.4*twinkle);
      ftCtx.fillStyle='#fff';
      ftCtx.beginPath();
      ftCtx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ftCtx.fill();
      ftCtx.globalAlpha=0;
    } else if(ftAtm==='ocean'){
      p.y+=p.speed;p.x+=p.drift;p.life++;
      const lifeRatio=p.life/p.maxLife;
      const op=p.opacity*(lifeRatio<.2?lifeRatio/.2:lifeRatio>.8?(1-lifeRatio)/.2:1);
      ftCtx.globalAlpha=op;
      ftCtx.fillStyle='rgba(140,220,255,1)';
      ftCtx.beginPath();
      ftCtx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ftCtx.fill();
      ftCtx.globalAlpha=0;
      if(p.life>=p.maxLife){Object.assign(p,ftMakeParticle(false));}
    } else if(ftAtm==='rain'){
      p.y+=p.speed;
      if(p.y>H+20){Object.assign(p,ftMakeParticle(false));p.y=-20;}
      ftCtx.globalAlpha=p.opacity;
      ftCtx.strokeStyle='rgba(160,210,255,1)';
      ftCtx.lineWidth=.8;
      ftCtx.beginPath();
      ftCtx.moveTo(p.x,p.y);
      ftCtx.lineTo(p.x-p.len*.15,p.y-p.len);
      ftCtx.stroke();
      ftCtx.globalAlpha=0;
    }
  }
  ftCtx.globalAlpha=1;
}

function ftDrawAurora(W,H,t){
  for(let i=0;i<ftParticles.length;i++){
    const p=ftParticles[i];
    p.x+=p.speed;p.y+=p.dy;
    p.phase+=.005;
    if(p.opacity<p.targetOp)p.opacity+=.0008;
    if(p.x>W+p.w)p.x=-p.w;
    if(p.x<-p.w)p.x=W;
    const yOff=Math.sin(p.phase)*30;
    const grad=ftCtx.createRadialGradient(p.x,p.y+yOff,0,p.x,p.y+yOff,p.w*.5);
    grad.addColorStop(0,`hsla(${p.hue},80%,55%,${p.opacity})`);
    grad.addColorStop(1,`hsla(${p.hue},80%,55%,0)`);
    ftCtx.fillStyle=grad;
    ftCtx.beginPath();
    ftCtx.ellipse(p.x,p.y+yOff,p.w,p.h,0,0,Math.PI*2);
    ftCtx.fill();
  }
}

/* resize canvas on window resize while focus is open */
window.addEventListener('resize',()=>{
  if(document.getElementById('focus-fs').classList.contains('open'))ftResizeCanvas();
});
function renderLogList(){
  const el=document.getElementById('log-list');if(!el)return;
  const subs=[...new Set(logs.map(l=>l.subj))];
  el.innerHTML=logs.length?logs.map(l=>{
    const si=subs.indexOf(l.subj)%8;
    const dur=l.mins>0?(Math.floor(l.mins/60)?Math.floor(l.mins/60)+'h ':'')+(l.mins%60?l.mins%60+'m':''):'—';
    const sc=subjColour(l.subj);
    return`<div class="le" style="${sc?`border-left-color:${sc}`:''}"><div class="le-ic" style="background:${sc?sc+'22':COLS[si]+'18'};color:${sc||COLS[si]}">${ICOS[si]}</div><div style="flex:1"><div class="le-sj">${esc(l.subj)}</div><div class="le-mt">${l.date}${l.what?' · '+esc(l.what):''}</div></div><div class="le-dur">${dur}</div><div class="db" onclick="delLog(${l.id})">✕</div></div>`;
  }).join(''):'<div class="es"><div class="ei">—</div>No sessions yet.</div>';
}
function delLog(id){logs=logs.filter(l=>l.id!==id);sv('st_l5',logs);renderLogList();}

function selPaperSubj(subj,el){
  curPaperSubj=subj;
  document.querySelectorAll('.stj').forEach(t=>t.classList.remove('act'));
  el.classList.add('act');renderPapers();
}
function addPaper(){
  const name=document.getElementById('pp-name').value.trim();
  const mark=+document.getElementById('pp-mark').value;
  const total=+document.getElementById('pp-total').value||100;
  const date=document.getElementById('pp-date').value;
  if(!name||!mark||!date)return;
  const pct=+(mark/total*100).toFixed(1);
  papers.push({id:Date.now(),subj:curPaperSubj,name,mark,total,date,notes:document.getElementById('pp-notes').value});
  papers.sort((a,b)=>b.date.localeCompare(a.date));sv('st_p5',papers);
  lbUpdateWeekly([{subj:curPaperSubj,pct}]);
  document.getElementById('pp-name').value='';document.getElementById('pp-mark').value='';document.getElementById('pp-notes').value='';
  confetti();
  renderPapers();
  lbPublishIfActive();
}
function renderPapers(){
  const el=document.getElementById('pp-list'),stats=document.getElementById('pp-stats');if(!el||!stats)return;
  const sp=papers.filter(p=>p.subj===curPaperSubj);
  if(!sp.length){stats.innerHTML='';el.innerHTML='<div class="es"><div class="ei">—</div>No papers for '+curPaperSubj+' yet.</div>';return;}
  const avg=sp.reduce((a,b)=>a+(b.mark/b.total*100),0)/sp.length;
  const best=Math.max(...sp.map(p=>p.mark/p.total*100));
  stats.innerHTML=`<div style="display:flex;gap:24px;margin-bottom:12px">
    <div><div style="font-size:11px;color:var(--t3);font-family:'Geist Mono',monospace;text-transform:uppercase;letter-spacing:.08em">Average</div><div style="font-size:30px;font-weight:200;letter-spacing:-.04em">${avg.toFixed(1)}<span style="font-size:13px;color:var(--t3)">%</span></div></div>
    <div><div style="font-size:11px;color:var(--t3);font-family:'Geist Mono',monospace;text-transform:uppercase;letter-spacing:.08em">Best</div><div style="font-size:30px;font-weight:200;letter-spacing:-.04em">${best.toFixed(1)}<span style="font-size:13px;color:var(--t3)">%</span></div></div>
    <div><div style="font-size:11px;color:var(--t3);font-family:'Geist Mono',monospace;text-transform:uppercase;letter-spacing:.08em">Papers</div><div style="font-size:30px;font-weight:200;letter-spacing:-.04em">${sp.length}</div></div>
  </div><div class="avg-wrap"><div class="avg-bar" style="width:${avg}%"></div></div>`;
  el.innerHTML=sp.map(p=>{
    const pct=p.mark/p.total*100;
    const col=pct>=80?'#16a34a':pct>=60?'#d97706':'#e53e3e';
    return`<div class="pp-row">
      <div class="pp-date">${p.date}</div>
      <div><div style="font-size:13px">${esc(p.name)}</div>${p.notes?`<div style="font-size:11px;color:var(--t3)">${esc(p.notes)}</div>`:''}</div>
      <div class="pp-mark">${p.mark}/${p.total}</div>
      <div class="pp-pct" style="background:${col}18;color:${col}">${pct.toFixed(0)}%</div>
      <div class="db" onclick="delPaper(${p.id})">✕</div>
    </div>`;
  }).join('');
  setTimeout(renderTrend,0);
}
function delPaper(id){papers=papers.filter(p=>p.id!==id);sv('st_p5',papers);renderPapers();}

function addExam(){
  const subj=document.getElementById('ex-subj').value;
  const name=document.getElementById('ex-name').value.trim();
  const date=document.getElementById('ex-date').value;
  if(!name||!date)return;
  const id=Date.now();
  exams.push({id,subj,name,date});
  exams.sort((a,b)=>a.date.localeCompare(b.date));sv('st_x5',exams);
  document.getElementById('ex-name').value='';document.getElementById('ex-date').value='';
  // Sync to calendar as an event
  syncExamToCalendar(id,subj,name,date);
  confetti();
  renderExamList();
  if(document.getElementById('cg').innerHTML)renderCal();
}
function syncExamToCalendar(examId,subj,name,date){
  // Add as a calendar event tagged with examId so we can remove it later
  evs=evs.filter(e=>e.examId!==examId); // remove old version if re-added
  evs.push({id:Date.now()+1,name:`📝 ${name}`,date,time:'',note:subj,subj,examId});
  evs.sort((a,b)=>a.date.localeCompare(b.date));sv('st_e5',evs);
}
function renderExamList(){
  const el=document.getElementById('exam-list');if(!el)return;
  if(!exams.length){el.innerHTML='<div class="es" style="padding:6px"><div class="ei">—</div>No exams yet.</div>';return;}
  const now=new Date();
  el.innerHTML=exams.map(ex=>{
    const ed=new Date(ex.date+'T09:00:00'),diff=ed-now;
    const days=Math.max(0,Math.floor(diff/86400000));
    const hrs=Math.max(0,Math.floor((diff%86400000)/3600000));
    const over=diff<0;
    return`<div class="exam-card">
      <div style="flex:1"><div class="ex-sj">${ex.subj}</div><div class="ex-nm">${esc(ex.name)} · ${ex.date}</div>
        <div class="ex-prog"><div class="ex-fill" style="width:${over?100:Math.max(2,100-days/90*100)}%"></div></div>
      </div>
      <div><div class="ex-big">${over?'✓':days}</div><div class="ex-unit">${over?'done':days===0?hrs+'h left':days===1?'day left':'days left'}</div></div>
      <div class="db" onclick="delExam(${ex.id})">✕</div>
    </div>`;
  }).join('');
}
function delExam(id){
  exams=exams.filter(e=>e.id!==id);sv('st_x5',exams);
  // Remove synced calendar event
  evs=evs.filter(e=>e.examId!==id);sv('st_e5',evs);
  renderExamList();
  if(document.getElementById('cg').innerHTML)renderCal();
}

/* ════ CONFETTI ═════════════════════════════════════════ */
function confetti(){
  const COLOURS=['#111','#555','#999','#bbb','#2563eb','#16a34a','#9333ea','#e58c1a','#e53e3e','#0891b2'];
  const COUNT=72;
  const container=document.createElement('div');
  container.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:99998;overflow:hidden';
  document.body.appendChild(container);

  for(let i=0;i<COUNT;i++){
    const p=document.createElement('div');
    const col=COLOURS[Math.floor(Math.random()*COLOURS.length)];
    const size=5+Math.random()*6;
    const x=10+Math.random()*80; // start spread across top
    const delay=Math.random()*0.4;
    const dur=1.4+Math.random()*0.8;
    const drift=(Math.random()-.5)*340;
    const rot=Math.random()*720*(Math.random()<.5?1:-1);
    const shape=Math.random()<0.5?'50%':(Math.random()<0.5?'2px':'0');

    p.style.cssText=`
      position:absolute;
      left:${x}%;top:-10px;
      width:${size}px;height:${size*(0.5+Math.random()*1)}px;
      background:${col};
      border-radius:${shape};
      opacity:1;
      animation:cf-fall ${dur}s ${delay}s cubic-bezier(.25,.46,.45,.94) forwards;
      --dx:${drift}px;
      --rot:${rot}deg;
    `;
    container.appendChild(p);
  }

  // Inject keyframes once
  if(!document.getElementById('cf-style')){
    const s=document.createElement('style');
    s.id='cf-style';
    s.textContent=`
      @keyframes cf-fall{
        0%  {transform:translateX(0) translateY(0) rotate(0deg);opacity:1}
        80% {opacity:1}
        100%{transform:translateX(var(--dx)) translateY(110vh) rotate(var(--rot));opacity:0}
      }
    `;
    document.head.appendChild(s);
  }

  setTimeout(()=>container.remove(),2800);
}

/* ════ TOAST ════════════════════════════════════════════ */
let toastT=null;
function showToast(msg){const t=document.getElementById('kbd-toast');document.getElementById('kbd-msg').textContent=msg;t.classList.add('show');if(toastT)clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2000);}

/* ════ SHORTCUTS ════════════════════════════════════════ */
function closeSC(){document.getElementById('sco').classList.remove('show');}
const isMac=navigator.platform.toUpperCase().includes('MAC')||navigator.userAgent.includes('Mac');
const MOD_KEY=isMac?'ctrlKey':'altKey'; // Ctrl on Mac, Alt on Win/Linux

document.addEventListener('keydown',e=>{
  const typing=['input','textarea','select'].includes(document.activeElement.tagName.toLowerCase());
  const modalOpen=document.getElementById('qm').classList.contains('open')||document.getElementById('rm').classList.contains('open')||document.getElementById('hw-modal').classList.contains('open');
  if(e.key==='Escape'){
    if(document.getElementById('focus-fs').classList.contains('open')){ftEnd();return;}
    if(document.getElementById('sw-fs').classList.contains('open')){swCloseFs();return;}
    if(document.getElementById('settings-overlay')?.classList.contains('open')){closeSettings();return;}
    if(document.getElementById('fr-detail')?.classList.contains('open')){frCloseDetail();return;}
    if(document.getElementById('fr-add-modal')?.classList.contains('open')){frCloseAdd();return;}
    closeQM();closeRM();closeSC();closeResetModal();closeICSModal();closeHWModal();closeTTEdit();closeSearch();return;
  }
  // Space = toggle stopwatch (when on study page, stopwatch tab, not typing)
  if(e.key===' '&&!typing&&!modalOpen&&curPage==='study'&&curStudyTab==='log'){
    e.preventDefault();
    if(document.getElementById('focus-fs').classList.contains('open')){ftTogglePause();return;}
    swToggle();return;
  }
  if(!typing&&e.key==='?'){document.getElementById('sco').classList.toggle('show');return;}

  // Bare arrow keys cycle through pages (when not typing or in a modal)
  if(!typing&&!modalOpen&&!e[MOD_KEY]&&!e.metaKey&&!e.altKey){
    const PGS=['dash','cal','tt','study','friends'];
    const PGNAMES=['Dashboard','Calendar','Timetable','Study','Friends'];
    const idx=PGS.indexOf(curPage);

    // Arrow keys navigate mobile pager when pg-mobile is active
    if(document.getElementById('pg-mobile')?.classList.contains('act')){
      if(e.key==='ArrowRight'){e.preventDefault();mhGoTo(1);return;}
      if(e.key==='ArrowLeft'){e.preventDefault();mhGoTo(0);return;}
    }

    // Left/right on study page cycles through study tabs
    if(curPage==='study'&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){
      e.preventDefault();
      const ti=STABS.indexOf(curStudyTab);
      const next=e.key==='ArrowRight'
        ?STABS[(ti+1)%STABS.length]
        :STABS[(ti-1+STABS.length)%STABS.length];
      const tabEl=document.querySelector(`.stab[onclick*="'${next}'"]`);
      switchStudyTab(next,tabEl);
      showToast(next.charAt(0).toUpperCase()+next.slice(1));
      return;
    }

    // Up/down navigates between the four main pages
    if(e.key==='ArrowDown'&&idx<PGS.length-1){
      e.preventDefault();
      const ni=document.querySelector(`.ni[data-page="${PGS[idx+1]}"]`);
      if(ni)goTo(PGS[idx+1],ni);showToast(PGNAMES[idx+1]);return;
    }
    if(e.key==='ArrowUp'&&idx>0){
      e.preventDefault();
      const ni=document.querySelector(`.ni[data-page="${PGS[idx-1]}"]`);
      if(ni)goTo(PGS[idx-1],ni);showToast(PGNAMES[idx-1]);return;
    }
    // Bare p = pin sidebar
    if((e.key==='p'||e.key==='P')&&!typing){e.preventDefault();togglePin();return;}
  }

  if(e[MOD_KEY]){
    const pages=[{key:'1',pg:'dash',lbl:'Dashboard'},{key:'2',pg:'cal',lbl:'Calendar'},{key:'3',pg:'tt',lbl:'Timetable'},{key:'4',pg:'study',lbl:'Study Log'},{key:'5',pg:'friends',lbl:'Friends'}];
    for(const p of pages){if(e.key===p.key){e.preventDefault();const ni=document.querySelector(`.ni[data-page="${p.pg}"]`);if(ni)goTo(p.pg,ni);showToast(p.lbl);return;}}
    if((e.key==='k'||e.key==='K')&&!typing){e.preventDefault();openSearch();return;}
    if((e.key==='r'||e.key==='R')&&!typing){e.preventDefault();openRM();return;}
    if((e.key==='e'||e.key==='E')&&!typing){e.preventDefault();const ni=document.querySelector('.ni[data-page="cal"]');if(ni)goTo('cal',ni);setTimeout(()=>{openQM(new Date().toISOString().split('T')[0]);},400);return;}
    if(e.key==='ArrowLeft'){e.preventDefault();calNav(-1);showToast('Previous month');return;}
    if(e.key==='ArrowRight'){e.preventDefault();calNav(1);showToast('Next month');return;}
  }
});

// Update shortcut overlay labels to match platform
(function(){
  const mod=isMac?'Ctrl':'Alt';
  document.querySelectorAll('#sco .sc-keys').forEach(row=>{
    const first=row.querySelector('kbd');
    if(first&&first.textContent==='Alt') first.textContent=mod;
  });
})();

/* ════ FRIENDS / LEADERBOARD ═════════════════════════════
   Supabase-backed: leaderboard table (public read, owner write)
   Friends list stored in st_friends, synced via sv()
════════════════════════════════════════════════════════ */
let lbFriends=[];

/* ── Streak helpers ── */
function lbGetWeekKey(){
  const d=new Date();
  // ISO week number
  const jan1=new Date(d.getFullYear(),0,1);
  const wk=Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7);
  return`${d.getFullYear()}-W${wk}`;
}

function lbUpdateStreak(){
  const today=new Date().toISOString().split('T')[0];
  let s=JSON.parse(localStorage.getItem('st_lb_streak')||'{"count":0,"last":""}');
  if(s.last===today)return;
  const yesterday=new Date(Date.now()-86400000).toISOString().split('T')[0];
  s.count=s.last===yesterday?s.count+1:1;
  s.last=today;
  localStorage.setItem('st_lb_streak',JSON.stringify(s));
}

function lbGetStreak(){
  const s=JSON.parse(localStorage.getItem('st_lb_streak')||'{"count":0,"last":""}');
  // Streak expires if last date was before yesterday
  const yesterday=new Date(Date.now()-86400000).toISOString().split('T')[0];
  const today=new Date().toISOString().split('T')[0];
  if(s.last!==today&&s.last!==yesterday)return 0;
  return s.count||0;
}

/* ── Weekly stats helpers ── */
function lbUpdateWeekly(addedPapers=[]){
  const wk=lbGetWeekKey();
  let w=JSON.parse(localStorage.getItem('st_lb_weekly')||'{}');
  if(w.weekKey!==wk)w={weekKey:wk,studyMins:0,papers:[]};
  // Accumulate study (called from swStop with mins)
  if(typeof addedPapers==='number'){w.studyMins+=addedPapers;}
  else if(addedPapers.length){w.papers=w.papers.concat(addedPapers);}
  localStorage.setItem('st_lb_weekly',JSON.stringify(w));
}

function lbGetWeeklyStats(){
  const wk=lbGetWeekKey();
  const w=JSON.parse(localStorage.getItem('st_lb_weekly')||'{}');
  if(w.weekKey!==wk)return{weekKey:wk,studyMins:0,weeklyAvg:0,weeklyPapers:0};
  const wp=w.papers||[];
  const wAvg=wp.length?+(wp.reduce((a,b)=>a+b.pct,0)/wp.length).toFixed(1):0;
  return{weekKey:wk,studyMins:w.studyMins||0,weeklyAvg:wAvg,weeklyPapers:wp.length};
}

function lbGetMyStats(){
  const avg=papers.length?papers.reduce((a,b)=>a+b.mark/b.total*100,0)/papers.length:0;
  const totalMins=logs.reduce((a,b)=>a+(b.mins||0),0);
  const last3=papers.slice(0,3).map(p=>({subj:p.subj,name:p.name,pct:+(p.mark/p.total*100).toFixed(1)}));
  // Per-subject averages
  const bySubj={};
  papers.forEach(p=>{if(!bySubj[p.subj])bySubj[p.subj]=[];bySubj[p.subj].push(p.mark/p.total*100);});
  const subjAvgs=Object.entries(bySubj)
    .map(([s,vs])=>({subj:s,avg:+(vs.reduce((a,b)=>a+b,0)/vs.length).toFixed(1),count:vs.length}))
    .sort((a,b)=>b.avg-a.avg);
  const weekly=lbGetWeeklyStats();
  const streak=lbGetStreak();
  return{avg:+avg.toFixed(1),paperCount:papers.length,studyMins:totalMins,last3,subjAvgs,streak,
    weeklyStudyMins:weekly.studyMins,weeklyAvg:weekly.weeklyAvg,weeklyPapers:weekly.weeklyPapers,weekKey:weekly.weekKey};
}

async function lbPublish(){
  if(!sbUserId)return false;
  const username=localStorage.getItem('st_lb_username');
  if(!username)return false;
  const stats=lbGetMyStats();
  const r=await sbFetch('/rest/v1/leaderboard',{
    method:'POST',
    headers:{'Prefer':'resolution=merge-duplicates'},
    body:JSON.stringify({user_id:sbUserId,username,stats,updated_at:new Date().toISOString()})
  });
  return r.ok;
}

async function lbClaimUsername(){
  const inp=document.getElementById('lb-username-inp');if(!inp)return;
  const val=inp.value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
  if(val.length<2){lbMsg('At least 2 characters.','#e53e3e');return;}
  if(!sbUserId){lbMsg('Sign in first via the sync panel.','#e53e3e');return;}
  // Check availability
  const r=await sbFetch(`/rest/v1/leaderboard?username=eq.${encodeURIComponent(val)}&select=user_id`);
  if(r.ok){
    const rows=await r.json();
    if(rows.length&&rows[0].user_id!==sbUserId){lbMsg('Username taken — try another.','#e53e3e');return;}
  }
  localStorage.setItem('st_lb_username',val);
  const ok=await lbPublish();
  if(ok){lbMsg(`@${val} claimed ✓`,'#16a34a');lbRenderProfile();lbRefresh();}
  else lbMsg('Save failed — check your connection.','#e53e3e');
}

async function lbSearch(){
  const inp=document.getElementById('lb-search-inp');if(!inp)return;
  const q=inp.value.trim().toLowerCase().replace(/^@/,'');
  if(!q){lbMsg2('Enter a username to search.','#e53e3e');return;}
  if(!sbUserId){lbMsg2('Sign in first.','#e53e3e');return;}
  const resultEl=document.getElementById('lb-search-result');
  resultEl.innerHTML='<span style="font-size:12px;color:var(--t3)">Searching…</span>';
  const r=await sbFetch(`/rest/v1/leaderboard?username=eq.${encodeURIComponent(q)}&select=user_id,username,stats`);
  if(!r.ok){resultEl.innerHTML='';lbMsg2('Search failed.','#e53e3e');return;}
  const rows=await r.json();
  if(!rows.length){resultEl.innerHTML='<span style="font-size:12px;color:var(--t3)">No user found.</span>';return;}
  const u=rows[0];
  if(u.user_id===sbUserId){resultEl.innerHTML='<span style="font-size:12px;color:var(--t3)">That\'s you!</span>';return;}
  const alreadyFriend=lbFriends.some(f=>f.user_id===u.user_id);
  const avgStr=u.stats?.avg!=null?`${u.stats.avg}% avg`:'no data yet';
  resultEl.innerHTML=`<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,.5);border-radius:10px;border:1px solid var(--border);margin-top:6px">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:500">@${esc(u.username)}</div>
      <div style="font-size:10px;font-family:'Geist Mono',monospace;color:var(--t3);margin-top:2px">${avgStr} · ${u.stats?.paperCount||0} papers</div>
    </div>
    ${alreadyFriend
      ?'<span style="font-size:11px;font-family:\'Geist Mono\',monospace;color:var(--t3)">already added</span>'
      :`<button class="btn bd" onclick="lbAddFriend('${u.user_id}','${esc(u.username)}')">Add</button>`}
  </div>`;
}

function lbAddFriend(user_id,username){
  if(lbFriends.some(f=>f.user_id===user_id))return;
  lbFriends.push({user_id,username});
  sv('st_friends',lbFriends);
  lbMsg2(`Added @${username} ✓`,'#16a34a');
  document.getElementById('lb-search-result').innerHTML='';
  document.getElementById('lb-search-inp').value='';
  lbRefresh();
}

function lbRemoveFriend(user_id){
  lbFriends=lbFriends.filter(f=>f.user_id!==user_id);
  sv('st_friends',lbFriends);
  renderLB();
}

async function lbFetchFriendStats(){
  if(!lbFriends.length)return[];
  const ids=lbFriends.map(f=>`"${f.user_id}"`).join(',');
  try{
    const r=await sbFetch(`/rest/v1/leaderboard?user_id=in.(${ids})&select=user_id,username,stats,updated_at`);
    if(r.ok)return await r.json();
  }catch{}
  return[];
}

async function lbRefresh(){
  const icon=document.getElementById('lb-refresh-icon');
  if(icon)icon.style.animation='spin .7s linear infinite';
  await renderLB();
  if(icon){icon.style.animation='';icon.style.transform='';}
}

let lbTimeModeStudy='all'; // 'all' | 'week'
let lbTimeModePapers='all';
let lbLastEntries=[]; // cache for detail overlay

// Fallback colour palette for subjects without a custom colour
const FR_SUBJ_PAL=['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316','#06b6d4','#a855f7'];
function frSubjColor(subj,idx){
  if(typeof subjColour==='function'){const c=subjColour(subj);if(c)return c;}
  return FR_SUBJ_PAL[idx%FR_SUBJ_PAL.length];
}

function frSetTimeStudy(mode,el){
  lbTimeModeStudy=mode;
  document.querySelectorAll('#fr-tt-all-study,#fr-tt-week-study').forEach(b=>b.classList.remove('act'));
  if(el)el.classList.add('act');
  renderLBSection('study',lbLastEntries);
}
function frSetTimePapers(mode,el){
  lbTimeModePapers=mode;
  document.querySelectorAll('#fr-tt-all-papers,#fr-tt-week-papers').forEach(b=>b.classList.remove('act'));
  if(el)el.classList.add('act');
  renderLBSection('papers',lbLastEntries);
}
// Keep old frSetTab/frSetTime as no-ops for safety
function frSetTab(){}
function frSetTime(){}

async function renderLB(){
  const myUsername=localStorage.getItem('st_lb_username');
  const entries=[];
  if(myUsername&&sbUserId){
    entries.push({user_id:sbUserId,username:myUsername,stats:lbGetMyStats(),me:true});
  }
  if(lbFriends.length){
    const fetched=await lbFetchFriendStats();
    lbFriends.forEach(fr=>{
      const data=fetched.find(f=>f.user_id===fr.user_id);
      if(!entries.find(e=>e.user_id===fr.user_id)){
        entries.push(data
          ?{...data,removable:true}
          :{user_id:fr.user_id,username:fr.username,stats:{avg:0,paperCount:0,studyMins:0,last3:[],subjAvgs:[],streak:0},removable:true,noData:true});
      }
    });
  }
  lbLastEntries=entries;
  renderActivityFeed(entries);
  renderLBSection('study',entries);
  renderLBSection('papers',entries);
}

function renderLBSection(mode, entries){
  const elId=mode==='study'?'fr-lb-study':'fr-lb-papers';
  const el=document.getElementById(elId);if(!el)return;
  const isWeek=mode==='study'?lbTimeModeStudy==='week':lbTimeModePapers==='week';
  const isPapers=mode==='papers';

  if(!entries.length){
    el.innerHTML=`<div class="fr-lb-empty"><div class="fr-lb-empty-icon">${isPapers?'📝':'⏱'}</div><div class="fr-lb-empty-h">No friends yet</div><div class="fr-lb-empty-p">Add friends by @username to compete</div></div>`;
    return;
  }

  // Sort
  const sorted=[...entries];
  const sortKey=isWeek?(isPapers?'weeklyAvg':'weeklyStudyMins'):(isPapers?'avg':'studyMins');
  sorted.sort((a,b)=>(b.stats?.[sortKey]||0)-(a.stats?.[sortKey]||0));

  function getVal(e){
    if(isWeek)return isPapers?(e.stats?.weeklyAvg??0):(e.stats?.weeklyStudyMins??0);
    return isPapers?(e.stats?.avg??0):(e.stats?.studyMins??0);
  }
  function fmtVal(e){
    const v=getVal(e);
    if(isPapers)return v?`${v}<span class="fr-pod-unit">%</span>`:'<span class="fr-pod-unit">—</span>';
    if(!v)return'<span class="fr-pod-unit">—</span>';
    return v>=60?`${Math.floor(v/60)}<span class="fr-pod-unit">h</span>`:`${v}<span class="fr-pod-unit">m</span>`;
  }
  function fmtSub(e){
    if(isPapers){const pc=isWeek?(e.stats?.weeklyPapers??0):(e.stats?.paperCount??0);return`${pc} paper${pc!==1?'s':''}`;}
    const avg=e.stats?.avg??0;return avg?`${avg}% avg`:'no papers';
  }
  function streakBadge(e){
    const s=e.stats?.streak||0;
    return s?`<span class="fr-streak"><span class="fr-streak-fire">🔥</span>${s}d</span>`:'';
  }
  function avContent(e){
    const em=e.me?localStorage.getItem('st_lb_emoji'):'';
    return em||((e.username||'?').slice(0,2).toUpperCase());
  }

  const crownSVG=`<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="color:#f59e0b"><path d="M2 19l2-10 4 4 4-8 4 8 4-4 2 10H2z"/></svg>`;
  const top=sorted.slice(0,3);
  const rest=sorted.slice(3);
  const podOrder=[top[1]??null, top[0]??null, top[2]??null];
  const podClasses=['fr-pod fr-pod-2','fr-pod fr-pod-1','fr-pod fr-pod-3'];
  const podRanks=[2,1,3];

  let podHTML='<div class="fr-podium">';
  podOrder.forEach((e,pi)=>{
    if(!e){podHTML+=`<div class="${podClasses[pi]} fr-pod-empty"></div>`;return;}
    const rank=podRanks[pi];
    const hue=e.username?(e.username.split('').reduce((a,c)=>a+c.charCodeAt(0),0)*47)%360:200;
    podHTML+=`<div class="${podClasses[pi]}${e.me?' fr-pod-me':''}" onclick="frShowDetail('${e.user_id}')" style="cursor:none;--pod-delay:${pi*0.07}s">
      ${rank===1?`<div class="fr-pod-crown">${crownSVG}</div>`:''}
      <div class="fr-pod-avatar" style="background:hsl(${hue},55%,50%);color:#fff">${avContent(e)}</div>
      <div class="fr-pod-username">@${esc(e.username)}${e.me?'<span class="fr-pod-you"> you</span>':''}</div>
      ${streakBadge(e)?`<div style="margin:3px 0">${streakBadge(e)}</div>`:''}
      <div class="fr-pod-value">${fmtVal(e)}</div>
      <div class="fr-pod-sub">${fmtSub(e)}</div>
      <div class="fr-pod-step fr-pod-step-${rank}"><span class="fr-pod-rank">${rank}</span></div>
      ${e.removable?`<button class="fr-pod-rm" onclick="event.stopPropagation();lbRemoveFriend('${e.user_id}')" title="Remove">✕</button>`:''}
    </div>`;
  });
  podHTML+='</div>';

  let rowsHTML='';
  if(rest.length){
    rowsHTML='<div class="fr-rows">';
    rest.forEach((e,i)=>{
      const rank=i+4;const v=getVal(e);
      const maxV=isPapers?100:Math.max(...sorted.map(x=>getVal(x)),60);
      const barVal=Math.min(v,maxV)/Math.max(maxV,1)*100;
      rowsHTML+=`<div class="fr-row${e.me?' fr-row-me':''}" onclick="frShowDetail('${e.user_id}')" style="cursor:none;--row-delay:${i*0.05}s">
        <div class="fr-row-rank">${rank}</div>
        <div class="fr-row-info">
          <div class="fr-row-name">@${esc(e.username)}${e.me?' <span class="fr-row-you">you</span>':''}${e.noData?' <span class="fr-row-nd">no data</span>':''}${streakBadge(e)?` ${streakBadge(e)}`:''}</div>
          <div class="fr-row-bar"><div class="fr-row-fill" style="width:${Math.max(2,barVal)}%"></div></div>
        </div>
        <div class="fr-row-val">${fmtVal(e)}<div class="fr-row-vsub">${fmtSub(e)}</div></div>
        ${e.removable?`<button class="fr-row-rm" onclick="event.stopPropagation();lbRemoveFriend('${e.user_id}')" title="Remove">✕</button>`:''}
      </div>`;
    });
    rowsHTML+='</div>';
  }
  el.innerHTML=podHTML+rowsHTML;
}

function renderActivityFeed(entries){
  const el=document.getElementById('fr-feed');if(!el)return;
  // Build activity items from friends' last3 papers + study
  const items=[];
  entries.forEach(e=>{
    if(!e.stats)return;
    const l3=e.stats.last3||[];
    if(l3.length){
      items.push({type:'paper',username:e.username,paper:l3[0],me:e.me});
    }
    const sm=e.stats.studyMins||0;
    if(sm>0){
      items.push({type:'study',username:e.username,mins:sm,me:e.me});
    }
  });
  if(!items.length){
    el.innerHTML='<div class="fr-feed-empty">No activity yet</div>';return;
  }
  // Show up to 5 items, interleaved
  const shown=items.slice(0,5);
  el.innerHTML=shown.map(it=>{
    if(it.type==='paper'){
      const pct=it.paper.pct;
      const grade=pct>=80?'🌟':pct>=60?'📝':'📉';
      return`<div class="fr-feed-item">
        <div class="fr-feed-dot">${grade}</div>
        <div class="fr-feed-body">
          <div class="fr-feed-who">${it.me?'You':('@'+esc(it.username))}</div>
          <div class="fr-feed-what">${pct}% on ${esc(it.paper.subj)} · ${esc(it.paper.name||'paper')}</div>
        </div>
      </div>`;
    }else{
      const smStr=it.mins>=60?Math.floor(it.mins/60)+'h '+((it.mins%60)||'')+'m total':it.mins+'m total';
      return`<div class="fr-feed-item">
        <div class="fr-feed-dot">⏱</div>
        <div class="fr-feed-body">
          <div class="fr-feed-who">${it.me?'You':('@'+esc(it.username))}</div>
          <div class="fr-feed-what">${smStr} studied</div>
        </div>
      </div>`;
    }
  }).join('');
}

/* ── Friend detail overlay ── */
function frShowDetail(uid){
  const e=lbLastEntries.find(x=>x.user_id===uid);if(!e)return;
  const rank=lbLastEntries.indexOf(e)+1;
  const s=e.stats||{};
  const username=e.username||'?';
  const initials=username.slice(0,2).toUpperCase();

  // Avatar — use stored emoji if this is "me", else initials with hue
  const hue=(username.split('').reduce((a,c)=>a+c.charCodeAt(0),0)*47)%360;
  const avEl=document.getElementById('fr-det-av');
  const myEmoji=e.me?localStorage.getItem('st_lb_emoji'):'';
  const avContent=myEmoji||initials;
  const avFontSize=myEmoji?'32px':'22px';
  avEl.style.cssText=`background:hsl(${hue},55%,50%);box-shadow:0 0 0 3px hsl(${hue},55%,72%),0 8px 24px rgba(0,0,0,.18);font-size:${avFontSize};position:relative`;
  if(e.me){
    avEl.innerHTML=`${avContent}<div style="position:absolute;bottom:-2px;right:-2px;width:22px;height:22px;border-radius:50%;background:var(--text);color:var(--bg);display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid var(--bg);pointer-events:none">✏️</div>`;
    avEl.title='Change avatar';
    avEl.onclick=()=>frToggleEmojiPicker(avEl,hue);
    // Add "tap to change" label below
    let hint=document.getElementById('fr-det-av-hint');
    if(!hint){hint=document.createElement('div');hint.id='fr-det-av-hint';hint.style.cssText='font-size:10px;font-family:\'Geist Mono\',monospace;color:var(--t3);margin-bottom:4px;letter-spacing:.06em;text-transform:uppercase';avEl.parentNode.insertBefore(hint,avEl.nextSibling);}
    hint.textContent='tap to change';
  }else{
    avEl.textContent=avContent;
    avEl.title='';avEl.onclick=null;
    const hint=document.getElementById('fr-det-av-hint');if(hint)hint.remove();
  }

  // Rank badge
  const rb=document.getElementById('fr-det-rank');
  rb.textContent=rank===1?'👑 #1':`#${rank}`;
  rb.className='fr-det-rank-badge'+(rank<=3?` rank-${rank}`:'');

  // Name
  document.getElementById('fr-det-name').textContent='@'+username;
  const youEl=document.getElementById('fr-det-you');
  youEl.style.display=e.me?'block':'none';

  // Streak row
  const stRow=document.getElementById('fr-det-streak-row');
  const streak=s.streak||0;
  stRow.innerHTML=streak?`<span class="fr-streak"><span class="fr-streak-fire">🔥</span>${streak} day streak</span>`:'';

  // Stat chips
  const avg=s.avg??0;
  const pc=s.paperCount??0;
  const sm=s.studyMins??0;
  const smFmt=sm>=60?`${Math.floor(sm/60)}<span>h</span>`:`${sm}<span>m</span>`;
  document.getElementById('fr-det-chips').innerHTML=`
    <div class="fr-det-chip">
      <div class="fr-det-chip-val">${avg||'—'}${avg?'<span>%</span>':''}</div>
      <div class="fr-det-chip-lbl">avg score</div>
    </div>
    <div class="fr-det-chip">
      <div class="fr-det-chip-val">${pc}</div>
      <div class="fr-det-chip-lbl">papers</div>
    </div>
    <div class="fr-det-chip">
      <div class="fr-det-chip-val">${smFmt}</div>
      <div class="fr-det-chip-lbl">studied</div>
    </div>`;

  // Subject breakdown
  const subjAvgs=s.subjAvgs||[];
  const subjSec=document.getElementById('fr-det-subj-section');
  const subjEl=document.getElementById('fr-det-subjects');
  if(subjAvgs.length){
    subjSec.style.display='';
    const maxAvg=Math.max(...subjAvgs.map(x=>x.avg));
    subjEl.innerHTML=subjAvgs.map((sa,i)=>{
      const col=frSubjColor(sa.subj,i);
      const barW=maxAvg?Math.round(sa.avg/maxAvg*100):0;
      // Gradient from transparent to color
      const grad=`linear-gradient(90deg,${col}28,${col})`;
      const cnt=sa.count||'';
      const pctClass=sa.avg>=80?'hi':sa.avg>=55?'mid':'lo';
      return`<div class="fr-subj-row" style="--delay:${i*0.06}s">
        <div class="fr-subj-accent" style="background:${col}"></div>
        <div class="fr-subj-info">
          <div class="fr-subj-name">${esc(sa.subj)}</div>
          <div class="fr-subj-bar-wrap"><div class="fr-subj-bar-fill" style="width:${barW}%;background:${grad}"></div></div>
        </div>
        <div class="fr-subj-val">
          <div class="fr-subj-pct" style="color:${col}">${sa.avg}%</div>
          ${cnt?`<div class="fr-subj-count">${cnt} paper${cnt!==1?'s':''}</div>`:''}
        </div>
      </div>`;
    }).join('');
  }else{
    subjSec.style.display='none';
  }

  // Recent papers
  const last3=s.last3||[];
  const pSec=document.getElementById('fr-det-papers-section');
  const pEl=document.getElementById('fr-det-papers');
  if(last3.length){
    pSec.style.display='';
    pEl.innerHTML=last3.map(p=>{
      const pctClass=p.pct>=80?'hi':p.pct>=55?'mid':'lo';
      return`<div class="fr-det-paper">
        <div class="fr-det-paper-subj">${esc(p.subj)}</div>
        <div class="fr-det-paper-name">${esc(p.name||'—')}</div>
        <div class="fr-det-paper-pct ${pctClass}">${p.pct}%</div>
      </div>`;
    }).join('');
  }else{
    pSec.style.display='none';
  }

  // Footer
  const foot=document.getElementById('fr-det-footer');
  foot.innerHTML=e.removable
    ?`<button class="fr-det-remove" onclick="lbRemoveFriend('${e.user_id}');frCloseDetail()">Remove friend</button>`
    :'';

  document.getElementById('fr-detail').classList.add('open');
}

function frCloseDetail(){
  document.getElementById('fr-detail').classList.remove('open');
  frCloseEmojiPicker();
}

/* ── Emoji picker for avatar ── */
const FR_EMOJIS=['😎','🎯','🔥','💡','🚀','⚡','🌟','🦁','🐯','🦊','🐺','🦅','🐉','🎭','💎','👑','🎓','📚','🧠','✨','🌙','☀️','🎪','🎨','🎵','🏆','⚔️','🛡️','🎲','🌈'];
let _emojiPickerEl=null;

function frToggleEmojiPicker(anchorEl,hue){
  if(_emojiPickerEl){frCloseEmojiPicker();return;}
  const cur=localStorage.getItem('st_lb_emoji')||'';
  const picker=document.createElement('div');
  picker.id='fr-emoji-picker';
  picker.innerHTML=FR_EMOJIS.map(em=>`<div class="fr-emoji-opt${em===cur?' selected':''}" onclick="frPickEmoji('${em}',${hue})" title="${em}">${em}</div>`).join('')
    +`<div class="fr-emoji-hint">tap to set avatar</div>`;
  // Position below/centered on anchor using fixed coords
  document.body.appendChild(picker);
  const rect=anchorEl.getBoundingClientRect();
  const pw=224;
  let left=rect.left+rect.width/2-pw/2;
  let top=rect.bottom+10;
  // Keep on screen
  left=Math.max(8,Math.min(left,window.innerWidth-pw-8));
  if(top+260>window.innerHeight)top=rect.top-270;
  picker.style.left=left+'px';
  picker.style.top=top+'px';
  _emojiPickerEl=picker;
  setTimeout(()=>document.addEventListener('click',_emojiOutside),50);
}

function _emojiOutside(e){
  if(_emojiPickerEl&&!_emojiPickerEl.contains(e.target)){frCloseEmojiPicker();}
}

function frCloseEmojiPicker(){
  if(_emojiPickerEl){_emojiPickerEl.remove();_emojiPickerEl=null;}
  document.removeEventListener('click',_emojiOutside);
}

function frPickEmoji(emoji,hue){
  localStorage.setItem('st_lb_emoji',emoji);
  frCloseEmojiPicker();
  // Update avatar display immediately
  const avEl=document.getElementById('fr-det-av');
  if(avEl){avEl.textContent=emoji;avEl.style.fontSize='32px';}
  // Update pill avatar
  frRenderPill();
  // Publish updated stats (emoji travels via st_lb_emoji, not stats)
  lbPublish();
}

function lbRenderProfile(){
  const el=document.getElementById('lb-profile-content');if(!el)return;
  const username=localStorage.getItem('st_lb_username');
  if(!sbUserId){
    el.innerHTML=`<div style="font-size:12px;color:var(--t3);line-height:1.6">Sign in via the sync panel to join the leaderboard and add friends.</div>`;
    return;
  }
  if(!username){
    el.innerHTML=`<div class="fg"><label class="fl">Choose a username</label>
      <div style="display:flex;gap:8px">
        <input class="inp" id="lb-username-inp" placeholder="e.g. daniel_g" style="flex:1" maxlength="24"
          oninput="this.value=this.value.toLowerCase().replace(/[^a-z0-9_]/g,'')"
          onkeydown="if(event.key==='Enter')lbClaimUsername()">
        <button class="btn bd" onclick="lbClaimUsername()">Claim</button>
      </div>
    </div>
    <div style="font-size:11px;color:var(--t3)">Letters, numbers and underscores only. Visible to friends.</div>
    <div id="lb-msg" style="font-size:12px;color:var(--t3);margin-top:8px;min-height:16px"></div>`;
    return;
  }
  const s=lbGetMyStats();
  const smStr=s.studyMins>=60?Math.floor(s.studyMins/60)+'h':s.studyMins+'m';
  el.innerHTML=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
    <div style="flex:1;min-width:0">
      <div style="font-size:16px;font-weight:500;letter-spacing:-.01em">@${esc(username)}</div>
      <div style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--t3);margin-top:1px">your leaderboard handle</div>
    </div>
    <button class="btn bo" onclick="lbChangeUsername()" style="font-size:11px;padding:5px 11px">Change</button>
  </div>
  <div style="display:flex;gap:18px;margin-bottom:10px">
    <div><div style="font-size:10px;font-family:'Geist Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--t3)">Avg</div>
      <div style="font-size:26px;font-weight:200;letter-spacing:-.04em">${s.avg||'—'}<span style="font-size:11px;color:var(--t3)">${s.avg?'%':''}</span></div></div>
    <div><div style="font-size:10px;font-family:'Geist Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--t3)">Papers</div>
      <div style="font-size:26px;font-weight:200;letter-spacing:-.04em">${s.paperCount}</div></div>
    <div><div style="font-size:10px;font-family:'Geist Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--t3)">Study</div>
      <div style="font-size:26px;font-weight:200;letter-spacing:-.04em">${smStr}</div></div>
  </div>
  ${s.last3.length?`<div style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--t3);margin-bottom:8px">${s.last3.map(p=>`${p.subj} <b style="color:var(--text)">${p.pct}%</b>`).join(' · ')}</div>`:''}
  <div id="lb-msg" style="font-size:12px;color:var(--t3);min-height:16px"></div>`;
  // Push latest stats in background whenever profile is viewed
  lbPublish();
}

function lbChangeUsername(){
  localStorage.removeItem('st_lb_username');
  lbRenderProfile();
}

function lbMsg(msg,col){
  const el=document.getElementById('lb-msg');if(!el)return;
  el.style.color=col;el.textContent=msg;
  setTimeout(()=>{if(el.textContent===msg)el.textContent='';},3000);
}
function lbMsg2(msg,col){
  const el=document.getElementById('lb-add-msg');if(!el)return;
  el.style.color=col;el.textContent=msg;
  setTimeout(()=>{if(el.textContent===msg)el.textContent='';},3000);
}

function initFriendsTab(){
  lbFriends=JSON.parse(localStorage.getItem('st_friends')||'[]');
  frRenderPill();
  lbRenderProfile();
  lbRefresh();
}

function frRenderPill(){
  const username=localStorage.getItem('st_lb_username');
  const emoji=localStorage.getItem('st_lb_emoji');
  const pilName=document.getElementById('fr-pill-name');
  const pilSub=document.getElementById('fr-pill-sub');
  const pilAvatar=document.getElementById('fr-avatar-pill');
  if(!pilName)return;
  if(username){
    pilName.textContent='@'+username;
    pilSub.textContent='your profile';
    pilAvatar.textContent=emoji||username.slice(0,2).toUpperCase();
    pilAvatar.style.fontSize=emoji?'16px':'11px';
  }else if(sbUserId){
    pilName.textContent='Set username';
    pilSub.textContent='click to set up';
    pilAvatar.textContent='?';pilAvatar.style.fontSize='';
  }else{
    pilName.textContent='Not signed in';
    pilSub.textContent='sign in to compete';
    pilAvatar.textContent='?';pilAvatar.style.fontSize='';
  }
}

function frSetTab(mode, el){
  lbMode=mode;
  document.querySelectorAll('.fr-lb-tab').forEach(t=>t.classList.remove('act'));
  if(el)el.classList.add('act');
  renderLB();
}

function frOpenAdd(){
  const modal=document.getElementById('fr-add-modal');
  if(modal){modal.classList.add('open');document.getElementById('fr-modal-inp')?.focus();}
}

function frCloseAdd(){
  const modal=document.getElementById('fr-add-modal');
  if(modal){modal.classList.remove('open');}
  const inp=document.getElementById('fr-modal-inp');
  if(inp)inp.value='';
  const res=document.getElementById('fr-modal-result');
  if(res)res.innerHTML='';
  const msg=document.getElementById('fr-modal-msg');
  if(msg)msg.textContent='';
}

async function lbSearchModal(){
  const inp=document.getElementById('fr-modal-inp');
  const res=document.getElementById('fr-modal-result');
  const msg=document.getElementById('fr-modal-msg');
  if(!inp||!res)return;
  const q=inp.value.replace(/^@/,'').trim().toLowerCase();
  if(!q)return;
  res.innerHTML='<div style="font-size:12px;color:var(--t3)">Searching…</div>';
  if(msg)msg.textContent='';
  try{
    const r=await sbFetch(`/rest/v1/leaderboard?username=eq.${encodeURIComponent(q)}&select=user_id,username,stats`);
    if(!r.ok)throw new Error();
    const data=await r.json();
    if(!data.length){res.innerHTML='<div style="font-size:12px;color:var(--t3)">No user found with that username.</div>';return;}
    const found=data[0];
    if(found.user_id===sbUserId){res.innerHTML='<div style="font-size:12px;color:var(--t3)">That\'s you!</div>';return;}
    const already=lbFriends.some(f=>f.user_id===found.user_id);
    const avg=found.stats?.avg??0;
    const pc=found.stats?.paperCount??0;
    res.innerHTML=`<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--glass);border:1px solid var(--border);border-radius:10px;margin-top:10px">
      <div style="width:34px;height:34px;border-radius:50%;background:var(--text);color:var(--bg);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0">${esc(found.username).slice(0,2).toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:500">@${esc(found.username)}</div>
        <div style="font-size:11px;font-family:'Geist Mono',monospace;color:var(--t3)">${avg?avg+'% avg · ':''} ${pc} paper${pc!==1?'s':''}</div>
      </div>
      ${already
        ?`<span style="font-size:11px;color:var(--t3)">Already added</span>`
        :`<button class="btn bd" onclick="lbAddFriendFromModal('${found.user_id}','${esc(found.username)}')" style="font-size:11px;padding:5px 12px">Add</button>`}
    </div>`;
  }catch{res.innerHTML='<div style="font-size:12px;color:var(--t3)">Search failed. Try again.</div>';}
}

async function lbAddFriendFromModal(uid,uname){
  await lbAddFriend(uid,uname);
  frCloseAdd();
  lbRefresh();
}

function frOpenSetup(){
  // Pulse the profile card to draw attention
  const profileCard=document.getElementById('fr-profile-card');
  if(profileCard){
    profileCard.classList.add('fr-pulse');
    setTimeout(()=>profileCard.classList.remove('fr-pulse'),700);
  }
  // Focus username input if present
  const inp=document.getElementById('lb-username-inp');
  if(inp)setTimeout(()=>inp.focus(),80);
}

// Keep leaderboard in sync when papers are added — instant publish + refresh
async function lbPublishIfActive(){
  if(!localStorage.getItem('st_lb_username')||!sbUserId)return;
  await lbPublish();
  // If user is on the friends page, refresh it immediately with updated local stats
  if(curPage==='friends'){
    // Update our own entry in the cache without a network round-trip
    const myUsername=localStorage.getItem('st_lb_username');
    const fresh=lbGetMyStats();
    const idx=lbLastEntries.findIndex(e=>e.me);
    if(idx>=0)lbLastEntries[idx].stats=fresh;
    else if(myUsername)lbLastEntries.unshift({user_id:sbUserId,username:myUsername,stats:fresh,me:true});
    renderActivityFeed(lbLastEntries);
  }
}

/* ════ ONBOARDING ════════════════════════════════════════ */
const OB_KEY='st_setup_done';
let obICSData=null;
let obCurStep=0;

function obGoTo(step){
  // Validate step 1 before advancing
  if(step===2){
    const name=document.getElementById('ob-name').value.trim();
    if(!name){
      document.getElementById('ob-s1-msg').textContent='Enter your first name to continue.';
      document.getElementById('ob-s1-msg').style.color='#e53e3e';
      document.getElementById('ob-name').focus();
      return;
    }
    document.getElementById('ob-s1-msg').textContent='';
  }
  const cur=document.getElementById('ob-s'+obCurStep);
  if(cur){cur.classList.add('exit');setTimeout(()=>{cur.classList.remove('active','exit');},280);}
  obCurStep=step;
  const next=document.getElementById('ob-s'+obCurStep);
  if(next){setTimeout(()=>{next.classList.add('active');},50);}
  // Update dots
  for(let i=0;i<4;i++){
    const d=document.getElementById('ob-dot-'+i);
    if(d)d.classList.toggle('on',i===step);
  }
  // Auto-focus first input in new step
  setTimeout(()=>{
    const inp=next?.querySelector('input:not([type=file])');
    if(inp)inp.focus();
  },120);
}

function obValidateStep1(){
  const name=document.getElementById('ob-name').value.trim();
  document.getElementById('ob-s1-msg').textContent='';
}

// Drag & drop
const obDrop=document.getElementById('ob-drop');
obDrop.addEventListener('dragover',e=>{e.preventDefault();obDrop.classList.add('drag-over');});
obDrop.addEventListener('dragleave',()=>obDrop.classList.remove('drag-over'));
obDrop.addEventListener('drop',e=>{
  e.preventDefault();obDrop.classList.remove('drag-over');
  const f=e.dataTransfer.files[0];if(f)obHandleFile(f);
});
document.getElementById('ob-file').addEventListener('change',function(){
  if(this.files[0])obHandleFile(this.files[0]);
});

async function obCreateAccount(){
  const email=document.getElementById('ob-email').value.trim();
  const password=document.getElementById('ob-password').value;
  const msgEl=document.getElementById('ob-auth-msg');
  if(!email||!password){msgEl.textContent='Enter your email and password.';msgEl.style.color='#e53e3e';return;}
  if(password.length<6){msgEl.textContent='Password must be at least 6 characters.';msgEl.style.color='#e53e3e';return;}
  msgEl.textContent='Creating account…';msgEl.style.color='#9898a4';
  const res=await sbSignUp(email,password);
  if(res.error){msgEl.textContent=res.error;msgEl.style.color='#e53e3e';return;}
  // Signed up — store session
  if(res.access_token){
    localStorage.setItem('sb_session',JSON.stringify(res));
    sbAuthToken=res.access_token;
    sbUserId=res.user?.id;
  }
  msgEl.textContent='Account created ✓';msgEl.style.color='#16a34a';
  // Claim username if set during onboarding
  const obUn=document.getElementById('ob-username').value.trim();
  if(obUn&&sbUserId){
    localStorage.setItem('st_lb_username',obUn);
    await lbPublish();
  }
  setTimeout(()=>obFinish(),600);
}

function obHandleFile(file){
  const reader=new FileReader();
  reader.onload=e=>{
    const parsed=parseICS(e.target.result);
    if(parsed){
      obICSData=parsed;
      obDrop.classList.add('ok');
      document.getElementById('ob-drop-icon').textContent='✅';
      document.getElementById('ob-drop-text').textContent=file.name;
      document.getElementById('ob-drop-hint').textContent='Timetable ready to import';
    }else{
      document.getElementById('ob-drop-icon').textContent='❌';
      document.getElementById('ob-drop-text').textContent='Could not parse this file';
      document.getElementById('ob-drop-hint').textContent='Make sure it\'s a valid .ics timetable';
    }
  };
  reader.readAsText(file);
}

// ICS parser — extracts weekly timetable into TT-compatible format
function parseICS(text){
  try{
    const events=[];
    const blocks=text.split('BEGIN:VEVENT').slice(1);
    for(const b of blocks){
      const get=k=>{const m=b.match(new RegExp(k+':([^\\r\\n]+)'));return m?m[1].trim():''};
      const dtstart=get('DTSTART'),dtend=get('DTEND'),summary=get('SUMMARY'),location=get('LOCATION'),desc=get('DESCRIPTION');
      if(!dtstart||!summary)continue;
      // Parse UTC datetime: 20260201T213800Z
      const ps=dtstart.replace('Z','');
      const pe=dtend.replace('Z','');
      const toDate=s=>new Date(s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8)+'T'+s.slice(9,11)+':'+s.slice(11,13)+':'+s.slice(13,15)+'Z');
      const ds=toDate(ps),de=toDate(pe);
      const dow=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][ds.getDay()];
      if(!dow||dow==='sunday'||dow==='saturday')continue;
      // Extract subject name
      let subj=summary.replace(/\d+\w+:\s*/,'').replace(/Yr \d+\s*/i,'').trim().toLowerCase();
      if(subj.includes('mathematics')||subj.includes('math'))subj='mathematics';
      else if(subj.includes('english'))subj='english';
      else if(subj.includes('science'))subj='science';
      else if(subj.includes('music'))subj='music';
      else if(subj.includes('commerce'))subj='commerce';
      else if(subj.includes('geography'))subj='geography';
      else if(subj.includes('history elective')||subj.includes('history el'))subj='history elective';
      else if(subj.includes('history'))subj='history';
      else if(subj.includes('pd/h/pe')||subj.includes('pdhpe')||subj.includes('pd h pe'))subj='pdhpe';
      else if((subj.includes('pe')&&subj.includes('extra'))||(subj.includes('pe*'))||(subj.includes('pe (extra)')))subj='extra pe';
      else if(subj.includes(' pe ')||subj.endsWith(' pe')||subj.startsWith('pe '))subj='pe';
      else if(subj.includes('volleyball')||subj.includes('sport'))subj='volleyball';
      else if(subj.includes('careers'))subj='careers';
      else if(subj.includes('roll'))subj='roll call';
      // Unknown subject — clean up the raw name and keep it as-is
      // e.g. "10PASS6: Yr 10 Pass" → "pass", "Yr 10 Extension Maths" → "extension maths"
      else{
        // Strip leading class code like "10PASS6:" or "10MaK:"
        subj=summary.replace(/^\d+\w+:\s*/,'').replace(/Yr \d+\s*/i,'').trim().toLowerCase();
        // Remove trailing numbers/codes
        subj=subj.replace(/\s*\d+\s*$/, '').trim();
        if(!subj)subj='unknown';
      }
      // Period label from description
      const periodM=desc.match(/Period:\s*([^\\\n\r]+)/i);
      const periodLbl=periodM?periodM[1].trim().toLowerCase():'period';
      // Room from location
      const roomM=location.match(/Room:\s*([^\r\n,]+)/i);
      const room=roomM?roomM[1].trim():'';
      // Local time hours/mins
      const sh=ds.getHours(),sm=ds.getMinutes(),eh=de.getHours(),em=de.getMinutes();
      events.push({dow,l:periodLbl,s:[sh,sm],e:[eh,em],subj,room});
    }
    if(!events.length)return null;
    // Deduplicate — Sentral exports one VEVENT per week for the whole term,
    // so the same period appears many times. Keep only unique l+start combos per day.
    const seen=new Set();
    const unique=events.filter(ev=>{
      const key=`${ev.dow}|${ev.l}|${ev.s[0]}:${ev.s[1]}`;
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
    // Group by day
    const tt={monday:[],tuesday:[],wednesday:[],thursday:[],friday:[]};
    for(const ev of unique){if(tt[ev.dow])tt[ev.dow].push(ev);}
    // Sort each day by start time and inject breaks
    for(const day of Object.keys(tt)){
      tt[day].sort((a,b)=>toM(...a.s)-toM(...b.s));
      // Detect recess/lunch gaps (gaps >10min between periods)
      const withBreaks=[];
      for(let i=0;i<tt[day].length;i++){
        withBreaks.push(tt[day][i]);
        if(i<tt[day].length-1){
          const gap=toM(...tt[day][i+1].s)-toM(...tt[day][i].e);
          if(gap>=20&&gap<50)withBreaks.push({l:'recess',s:tt[day][i].e,e:tt[day][i+1].s,subj:null,room:null});
          else if(gap>=50)withBreaks.push({l:'lunch',s:tt[day][i].e,e:tt[day][i+1].s,subj:null,room:null});
        }
      }
      tt[day]=withBreaks;
    }
    // Baulko fix: on Wednesday, lunch and period 6 are swapped in the ICS —
    // find them and swap their positions so the grid displays correctly
    const wed=tt.wednesday;
    const lunchIdx=wed.findIndex(p=>p.l==='lunch');
    const p6Idx=wed.findIndex(p=>p.l==='period 6');
    if(lunchIdx!==-1&&p6Idx!==-1&&Math.abs(lunchIdx-p6Idx)===1){
      [wed[lunchIdx],wed[p6Idx]]=[wed[p6Idx],wed[lunchIdx]];
    }
    return tt;
  }catch(err){console.error('ICS parse error',err);return null;}
}

function obFinish(){
  const name=document.getElementById('ob-name')?.value.trim()||'';
  if(name)localStorage.setItem('st_name',name);
  // Save username if provided and not already saved (account step may have saved it)
  const obUn=document.getElementById('ob-username')?.value.trim()||'';
  if(obUn&&!localStorage.getItem('st_lb_username'))localStorage.setItem('st_lb_username',obUn);
  if(obICSData)localStorage.setItem('st_ics',JSON.stringify(obICSData));
  localStorage.setItem(OB_KEY,'1');
  obLaunch(name||null,obICSData);
}

function obSkip(){
  localStorage.setItem(OB_KEY,'1');
  obLaunch(null,null);
}

function obLaunch(name,icsData){
  const ob=document.getElementById('onboard');
  ob.classList.add('fade-out');
  setTimeout(()=>{ob.style.display='none';},650);
  applyName(name||localStorage.getItem('st_name')||'');
  if(icsData)applyICS(icsData);
  // Start the app
  if(window.innerWidth<=640){
    document.getElementById('pg-mobile').classList.add('act');
  }else{
    document.getElementById('pg-dash').classList.add('act');
  }
  tick();renderDash();renderTT();setupScroll();
}

function applyName(name){
  const eyeEl=document.getElementById('h-eye');
  const nameEl=document.getElementById('h-name');
  if(name){
    if(eyeEl)eyeEl.classList.remove('solo');
    if(nameEl)nameEl.textContent=name.charAt(0).toUpperCase()+name.slice(1)+'.';
    const td=document.getElementById('tt-desc');
    if(td)td.textContent=name.charAt(0).toUpperCase()+name.slice(1)+' · loaded from ICS';
  }else{
    if(eyeEl)eyeEl.classList.add('solo');
    if(nameEl)nameEl.textContent='';
    const td=document.getElementById('tt-desc');
    if(td)td.textContent='Loaded from ICS';
  }
}

function applyICS(data){
  for(const day of Object.keys(data)){
    if(TT[day]!==undefined)TT[day]=data[day];
  }
  populateSubjectDropdowns();
  // Refresh mobile countdown and schedule if on mobile
  if(window.innerWidth<=640){
    mhRenderSched();
    mhUpdateCountdown();
    mhRenderHeroPanel();
  }
}

/* Build subject lists from whatever is actually in the timetable.
   Falls back to a hardcoded base set if TT is empty. */
const BASE_SUBJECTS=['mathematics','english','science','music','commerce','geography','history','history elective','pdhpe','pe','extra pe','careers'];

/* Subject → pastel colour map */
const SUBJ_COLOURS_DEFAULT={
  'mathematics':   '#f28b82',
  'english':       '#7bafd4',
  'science':       '#81c995',
  'history':       '#f5c26b',
  'history elective':'#f5c26b',
  'geography':     '#81c995',
  'music':         '#c084fc',
  'commerce':      '#fdba74',
  'pdhpe':         '#67c1b5',
  'pe':            '#67c1b5',
  'extra pe':      '#67c1b5',
  'careers':       '#94a3b8',
  'volleyball':    '#7bafd4',
  'roll call':     '#94a3b8',
};
// Mutable — persisted to localStorage so user customisations survive refresh
let SUBJ_COLOURS={...SUBJ_COLOURS_DEFAULT,...JSON.parse(localStorage.getItem('st_subj_colours')||'{}')};
function saveSubjColours(){localStorage.setItem('st_subj_colours',JSON.stringify(SUBJ_COLOURS));}
function subjColour(subj){
  if(!subj)return null;
  return SUBJ_COLOURS[subj.toLowerCase()]||null;
}
function subjTint(subj){
  const c=subjColour(subj);return c?c+'1f':null;
}

function getTTSubjects(){
  const found=new Set();
  const days=['monday','tuesday','wednesday','thursday','friday'];
  days.forEach(d=>{
    (TT[d]||[]).forEach(p=>{
      if(p.subj&&p.subj!=='roll call'&&p.subj!=='recess'&&p.subj!=='lunch')
        found.add(p.subj);
    });
  });
  // Merge with base so users who haven't imported still get sensible options
  BASE_SUBJECTS.forEach(s=>found.add(s));
  return [...found].sort();
}

function populateSubjectDropdowns(){
  const subjects=getTTSubjects();
  // Each dropdown has a different "empty" label
  const configs=[
    {id:'qes',    empty:'— none —'},
    {id:'rem-subj',empty:'— general —'},
    {id:'hw-subj', empty:'— general —'},
    {id:'lg-subj', empty:null},   // no empty option
    {id:'ex-subj', empty:null},
  ];
  configs.forEach(({id,empty})=>{
    const el=document.getElementById(id);
    if(!el)return;
    const cur=el.value; // preserve current selection
    el.innerHTML=(empty?`<option value="">${empty}</option>`:'')+
      subjects.map(s=>`<option value="${s}">${s}</option>`).join('');
    // Restore selection if still valid
    if(cur&&subjects.includes(cur))el.value=cur;
  });
  // Also update the pp-subj-tabs in past papers
  const tabsEl=document.getElementById('pp-subj-tabs');
  if(tabsEl){
    const curAct=tabsEl.querySelector('.stj.act');
    const curSubj=curAct?curAct.dataset.s:subjects[0];
    tabsEl.innerHTML=subjects.map((s,i)=>
      `<div class="stj${s===curSubj?' act':''}" data-s="${s}" onclick="selPaperSubj('${s}',this)">${s}</div>`
    ).join('');
  }
  // Sync custom dropdown triggers after options change
  setTimeout(cddSyncAll,0);
}

/* ════ CONTEXT MENU ══════════════════════════════════════ */
const ctxMenu=document.getElementById('ctx');
let ctxOpen=false;

function openCtx(x,y){
  // Update pin label to reflect current state
  document.getElementById('ctx-pin-lbl').textContent=pinned?'Unpin Sidebar':'Pin Sidebar';
  // Position — apply the 'open' layout then measure in the next frame so the browser
  // has applied final styles (avoids first-click overflow at the bottom).
  const W = window.innerWidth, H = window.innerHeight;
  // Temporarily ensure menu uses the 'open' layout but keep it hidden while measuring
  const prevVis = ctxMenu.style.visibility;
  const prevPointer = ctxMenu.style.pointerEvents;
  ctxMenu.classList.add('open');
  ctxMenu.style.visibility = 'hidden';
  ctxMenu.style.pointerEvents = 'none';
  // Reset to origin so measurement is consistent
  ctxMenu.style.left = '0px'; ctxMenu.style.top = '0px';
  // Wait one frame for layout to settle (ensures transform/scale/paint applied)
  requestAnimationFrame(()=>{
    const rect = ctxMenu.getBoundingClientRect();
    let mw = Math.max(rect.width || 220, 220);
    let mh = Math.max(rect.height || 120, 120);
    // Safety margin to avoid tiny overflow due to subpixel/layout timing
    const M = 12; // px
    // If the menu is taller than available viewport space, make it scrollable instead
    if (mh > H - 2 * M) {
      ctxMenu.style.maxHeight = (H - 2 * M) + 'px';
      ctxMenu.style.overflow = 'auto';
      mh = H - 2 * M;
    }
    // Preferred position: top-left at (x,y), but clamp to keep margin M
    let px = x;
    let py = y;
    if (px + mw + M > W) px = W - mw - M;
    if (py + mh + M > H) py = H - mh - M;
    px = Math.max(M, px);
    py = Math.max(M, py);
    ctxMenu.style.left = px + 'px';
    ctxMenu.style.top = py + 'px';
    // Restore visibility so the menu transition animates in place
    ctxMenu.style.visibility = prevVis || '';
    ctxMenu.style.pointerEvents = prevPointer || '';
  });
  ctxOpen=true;
}
function closeCtx(){
  ctxMenu.classList.remove('open');
  // clear any temporary inline sizing we may have applied
  ctxMenu.style.maxHeight = '';
  ctxMenu.style.overflow = '';
  ctxOpen=false;
}

document.addEventListener('contextmenu',e=>{
  e.preventDefault();
  openCtx(e.clientX,e.clientY);
});

document.addEventListener('click',e=>{
  if(ctxOpen&&!ctxMenu.contains(e.target))closeCtx();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&ctxOpen)closeCtx();
});
// Scroll closes it too
document.addEventListener('scroll',()=>closeCtx(),true);

// Context menu actions
function ctxGoTo(pg){
  closeCtx();
  const ni=document.querySelector(`.ni[data-page="${pg}"]`);
  if(ni)goTo(pg,ni);
}
function ctxAddReminder(){closeCtx();openRM();}
function ctxAddEvent(){
  closeCtx();
  ctxGoTo('cal');
  setTimeout(()=>openQM(new Date().toISOString().split('T')[0]),400);
}
function ctxTogglePin(){closeCtx();togglePin();}
function ctxShortcuts(){closeCtx();document.getElementById('sco').classList.add('show');}
function ctxRefresh(){closeCtx();location.reload();}

/* Night mode */
let nightMode=localStorage.getItem('st_night')==='1';
function applyNight(on,animate){
  document.body.classList.toggle('night',on);
  const lbl=document.getElementById('ctx-night-lbl');
  const icon=document.getElementById('ctx-night-icon');
  const item=document.getElementById('ctx-night-item');
  if(item)item.classList.toggle('active-night',on);
  if(lbl)lbl.textContent=on?'Light Mode':'Night Mode';
  if(icon){
    icon.innerHTML=on
      ?`<circle cx="12" cy="12" r="5"/><path stroke-linecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>`
      :`<path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>`;
  }
  // Cursor colour is handled per-frame in drawCursor() — no filter needed
}
function toggleNight(){
  nightMode=!nightMode;
  localStorage.setItem('st_night',nightMode?'1':'0');
  applyNight(nightMode,true);
}
function ctxToggleNight(){closeCtx();toggleNight();}

/* Cursor toggle */
let fancyCursor=localStorage.getItem('st_fancy_cursor')!=='0';
let showTrail=localStorage.getItem('st_show_trail')!=='0';
let trailEnabledBeforeCursorDisabled=showTrail; // remember trail state when cursor disabled

function applyTrail(on){
  if(!fancyCursor)return; // can't change trail if cursor is disabled
  showTrail=on;
  localStorage.setItem('st_show_trail',on?'1':'0');
  const trail=document.getElementById('ctrail');
  if(trail)trail.style.display=on?'':'none';
}

function applyFancyCursor(on){
  fancyCursor=on;
  localStorage.setItem('st_fancy_cursor',on?'1':'0');
  
  if(!on){
    // Disabling cursor: also disable trail and remember its state
    trailEnabledBeforeCursorDisabled=showTrail;
    showTrail=false;
    localStorage.setItem('st_show_trail','0');
  } else {
    // Re-enabling cursor: restore trail to its previous state
    showTrail=trailEnabledBeforeCursorDisabled;
    localStorage.setItem('st_show_trail',showTrail?'1':'0');
  }
  
  // Update trail visibility and toggle state
  const trail=document.getElementById('ctrail');
  if(trail)trail.style.display=(showTrail && fancyCursor)?'':'none';
  const trailCard=document.getElementById('st-trail-card');
  if(trailCard){
    trailCard.style.pointerEvents=on?'auto':'none';
    trailCard.style.opacity=on?'1':'0.5';
  }
  
  // When off: restore system cursor everywhere; when on: hide it
  document.body.style.cursor=on?'none':'auto';
  // Also override the global cursor:none rule for all elements
  let cursorStyle=document.getElementById('cursor-override-style');
  if(!cursorStyle){cursorStyle=document.createElement('style');cursorStyle.id='cursor-override-style';document.head.appendChild(cursorStyle);}
  cursorStyle.textContent=on?'':' *{cursor:auto!important} a,button,[onclick]{cursor:pointer!important} input,textarea{cursor:text!important}';
  const cdot=document.getElementById('cdot');
  if(cdot){
    cdot.style.display=on?'':'none';
    if(on)stApplyCursorSize(); // Re-apply saved size when re-enabling
  }
  const lbl=document.getElementById('ctx-cursor-lbl');
  const item=document.getElementById('ctx-cursor-item');
  if(lbl)lbl.textContent=on?'Default Cursor':'Fancy Cursor';
  if(item)item.classList.toggle('active-cursor',on);
}
function ctxToggleCursor(){closeCtx();applyFancyCursor(!fancyCursor);}

function stCursorSizeUpdate(val){
  if(!fancyCursor)return; // can't change size if cursor is disabled
  cursorSize=parseFloat(val);
  localStorage.setItem('st_cursor_size',cursorSize.toString());
  // Update slider display
  const valDisplay=document.getElementById('st-cursor-size-val');
  if(valDisplay)valDisplay.textContent=(Math.round(cursorSize*100))+'%';
  // Apply size to cursor canvas
  const cdot=document.getElementById('cdot');
  if(cdot){
    cdot.style.width=(24*cursorSize)+'px';
    cdot.style.height=(24*cursorSize)+'px';
  }
}

function stApplyCursorSize(){
  const cdot=document.getElementById('cdot');
  if(cdot){
    cdot.style.width=(24*cursorSize)+'px';
    cdot.style.height=(24*cursorSize)+'px';
  }
}

/* 12-Hour Time Format */
let use12hTime=localStorage.getItem('st_12h_time')==='1';
function apply12hTime(on,silent){
  use12hTime=on;
  if(!silent)localStorage.setItem('st_12h_time',on?'1':'0');
  // Trigger an immediate time update
  tick();
}

/* ════ SETTINGS ════════════════════════════════════════════ */

// Performance mode
let perfMode=localStorage.getItem('st_perf')==='1';
let particlesEnabled=localStorage.getItem('st_particles')!=='0';
let blurEnabled=localStorage.getItem('st_blur')!=='0';
let transitionsEnabled=localStorage.getItem('st_transitions')!=='0';

// Accent colour map
const ACCENT_MAP={
  default:'#6366f1',rose:'#f43f5e',sky:'#0ea5e9',
  emerald:'#10b981',amber:'#f59e0b',mono:'#374151'
};
let currentAccent=localStorage.getItem('st_accent')||'default';

function applyPerfMode(on,silent){
  perfMode=on;
  if(!silent)localStorage.setItem('st_perf',on?'1':'0');
  let s=document.getElementById('perf-style');
  if(!s){s=document.createElement('style');s.id='perf-style';document.head.appendChild(s);}
  if(on){
    s.textContent=`
      *{transition:none!important;animation:none!important}
      #particles{display:none!important}
      body::before{display:none!important}
      .fr-pod,#fr-det-card{animation:none!important}
      .fr-row{animation:none!important}
      .fr-feed-item{animation:none!important}
      .fr-subj-row{animation:none!important}
      @keyframes podIn{from{}to{}}
      @keyframes rowIn{from{}to{}}
    `;
    // Turn off particles
    applyParticles(false,true);
  }else{
    s.textContent='';
    applyParticles(particlesEnabled,true);
  }
}

function applyParticles(on,silent){
  particlesEnabled=on;
  if(!silent)localStorage.setItem('st_particles',on?'1':'0');
  const c=document.getElementById('particles');
  if(c)c.style.display=on&&!perfMode?'':'none';
}

function applyBlur(on,silent){
  blurEnabled=on;
  if(!silent)localStorage.setItem('st_blur',on?'1':'0');
  let s=document.getElementById('blur-style');
  if(!s){s=document.createElement('style');s.id='blur-style';document.head.appendChild(s);}
  s.textContent=on?'':`.glass,.fr-lb-card,#pill,#settings-panel,#fr-det-card,#fr-add-box,.fr-profile-pill,.st-card{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}`;
}

function applyTransitions(on,silent){
  transitionsEnabled=on;
  if(!silent)localStorage.setItem('st_transitions',on?'1':'0');
  let s=document.getElementById('trans-style');
  if(!s){s=document.createElement('style');s.id='trans-style';document.head.appendChild(s);}
  s.textContent=on?'':`.pg{animation:none!important}.pg.leaving{animation:none!important;display:none!important}`;
}

function applyAccent(key,silent){
  currentAccent=key;
  if(!silent)localStorage.setItem('st_accent',key);
  let col;
  if(key==='custom'){
    col=customAccentColor||'#6366f1';
  }else{
    col=ACCENT_MAP[key]||ACCENT_MAP.default;
  }
  document.documentElement.style.setProperty('--accent',col);
  // Update the .st-toggle.on colour
  let s=document.getElementById('accent-style');
  if(!s){s=document.createElement('style');s.id='accent-style';document.head.appendChild(s);}
  s.textContent=`.st-toggle.on{background:${col}!important}`;
}

function openSettings(){
  const ov=document.getElementById('settings-overlay');
  if(!ov)return;
  // Toggle: if already open, close it
  if(ov.classList.contains('open')){
    closeSettings();
    return;
  }
  ov.classList.add('open');
  updateSettingsOverlayPosition();
  // Populate name input
  const ni=document.getElementById('st-name-inp');
  if(ni)ni.value=localStorage.getItem('st_name')||'';
  // Sync cursor size slider
  const sizeSlider=document.getElementById('st-cursor-size-slider');
  if(sizeSlider){
    sizeSlider.value=cursorSize.toString();
    const valDisplay=document.getElementById('st-cursor-size-val');
    if(valDisplay)valDisplay.textContent=(Math.round(cursorSize*100))+'%';
  }
  // Sync toggles
  stSyncToggles();
}

function closeSettings(){
  document.getElementById('settings-overlay')?.classList.remove('open');
}

function stSyncToggles(){
  stSetToggle('st-night-toggle',nightMode);
  stSetToggle('st-cursor-toggle',fancyCursor);
  stSetToggle('st-trail-toggle',showTrail);
  stSetToggle('st-12h-time-toggle',use12hTime);
  stSetToggle('st-perf-toggle',perfMode);
  stSetToggle('st-particles-toggle',particlesEnabled&&!perfMode);
  stSetToggle('st-blur-toggle',blurEnabled&&!perfMode);
  stSetToggle('st-transitions-toggle',transitionsEnabled&&!perfMode);
  stSetToggle('st-notif-toggle',notifEnabled);
  // Disable trail and size controls if cursor is disabled
  const trailCard=document.getElementById('st-trail-card');
  if(trailCard){
    trailCard.style.pointerEvents=fancyCursor?'auto':'none';
    trailCard.style.opacity=fancyCursor?'1':'0.5';
  }
  const sizeCard=document.getElementById('st-cursor-size-card');
  if(sizeCard){
    sizeCard.style.pointerEvents=fancyCursor?'auto':'none';
    sizeCard.style.opacity=fancyCursor?'1':'0.5';
  }
  // Sync custom swatch
  const customSwatch=document.querySelector('.st-col-swatch-custom');
  if(customSwatch){
    if(currentAccent==='custom'){
      customSwatch.style.background=customAccentColor;
      customSwatch.classList.add('act');
    }else{
      customSwatch.classList.remove('act');
    }
  }
  // Active swatch
  document.querySelectorAll('.st-col-swatch').forEach(s=>s.classList.toggle('act',s.dataset.col===currentAccent));
}

function stSetToggle(id,on){
  const el=document.getElementById(id);
  if(el)el.classList.toggle('on',on);
}

function stToggleNight(){toggleNight();stSyncToggles();}
function stToggleCursor(){applyFancyCursor(!fancyCursor);stSyncToggles();}
function stToggleTrail(){applyTrail(!showTrail);stSyncToggles();}
function stToggle12hTime(){apply12hTime(!use12hTime);stSyncToggles();}

function stTogglePerf(){
  applyPerfMode(!perfMode);
  // Cascade: disable sub-toggles when perf on
  if(perfMode){
    applyParticles(false,true);applyBlur(false,true);applyTransitions(false,true);
  }else{
    applyParticles(true);applyBlur(true);applyTransitions(true);
  }
  stSyncToggles();
  showToast(perfMode?'Performance mode on ⚡':'Performance mode off');
}

function stToggleParticles(){
  if(perfMode)return;
  applyParticles(!particlesEnabled);
  stSyncToggles();
}

function stToggleBlur(){
  if(perfMode)return;
  applyBlur(!blurEnabled);
  stSyncToggles();
}

function stToggleTransitions(){
  if(perfMode)return;
  applyTransitions(!transitionsEnabled);
  stSyncToggles();
}

function stToggleNotif(){toggleNotifications();stSyncToggles();}

function stSaveName(){
  const inp=document.getElementById('st-name-inp');
  if(!inp)return;
  const name=inp.value.trim();
  if(!name){showToast('Enter a name first');return;}
  localStorage.setItem('st_name',name);
  sbSet('st_name',name);
  applyName(name);
  showToast('Name saved ✓');
}

function stSetAccent(key,el){
  applyAccent(key);
  document.querySelectorAll('.st-col-swatch').forEach(s=>s.classList.remove('act'));
  if(el)el.classList.add('act');
}

// Custom color picker functions
let customAccentColor=localStorage.getItem('st_accent_custom')||'#6366f1';

function openColorPicker(){
  const modal=document.getElementById('color-picker-modal');
  const preview=document.getElementById('color-preview');
  const nativePicker=document.getElementById('native-color-picker');
  const hexInput=document.getElementById('hex-input');
  
  modal.classList.add('open');
  preview.style.background=customAccentColor;
  nativePicker.value=customAccentColor;
  hexInput.value=customAccentColor;
}

function closeColorPicker(){
  document.getElementById('color-picker-modal').classList.remove('open');
}

function syncColorFromHex(){
  const hexInput=document.getElementById('hex-input');
  const nativePicker=document.getElementById('native-color-picker');
  const preview=document.getElementById('color-preview');
  let hex=hexInput.value;
  
  // Add # if missing
  if(hex&&!hex.startsWith('#'))hex='#'+hex;
  
  // Validate hex color
  if(/^#[0-9A-Fa-f]{6}$/.test(hex)){
    nativePicker.value=hex;
    preview.style.background=hex;
  }
}

function applyCustomColor(){
  const nativePicker=document.getElementById('native-color-picker');
  const color=nativePicker.value;
  
  customAccentColor=color;
  localStorage.setItem('st_accent_custom',color);
  applyAccent('custom');
  closeColorPicker();
  showToast('Custom accent colour applied');
}

// Sync native color picker with hex input when color picker changes
document.addEventListener('DOMContentLoaded',()=>{
  const nativePicker=document.getElementById('native-color-picker');
  if(nativePicker){
    nativePicker.addEventListener('input',()=>{
      const hexInput=document.getElementById('hex-input');
      const preview=document.getElementById('color-preview');
      hexInput.value=nativePicker.value;
      preview.style.background=nativePicker.value;
    });
  }
});

function stResetData(){
  if(!confirm('This will permanently delete ALL your stream++ data (homework, papers, logs, exams, reminders). This cannot be undone.\n\nAre you sure?'))return;
  const keys=['st_r5','st_e5','st_l5','st_p5','st_x5','st_hw','st_name','st_ics','st_friends','st_lb_username','st_lb_emoji','st_lb_streak','st_lb_weekly','st_setup_done','st_night','st_fancy_cursor','st_perf','st_particles','st_blur','st_transitions','st_accent','st_accent_custom','st_notif'];
  keys.forEach(k=>localStorage.removeItem(k));
  showToast('Data reset. Reloading…');
  setTimeout(()=>location.reload(),1200);
}

// Apply stored settings on page load
(function initSettings(){
  applyAccent(currentAccent,true);
  if(perfMode)applyPerfMode(true,true);
  else{
    if(!particlesEnabled)applyParticles(false,true);
    if(!blurEnabled)applyBlur(false,true);
    if(!transitionsEnabled)applyTransitions(false,true);
  }
})();

/* ICS import modal (accessible from timetable empty state) */
let _pendingICS=null;
function showTTImport(){
  _pendingICS=null;
  document.getElementById('ics-drop').classList.remove('ok');
  document.getElementById('ics-drop-icon').textContent='📅';
  document.getElementById('ics-drop-text').textContent='Drop .ics file here';
  document.getElementById('ics-drop-hint').textContent='or click to browse';
  document.getElementById('ics-msg').textContent='';
  document.getElementById('ics-save-btn').disabled=true;
  document.getElementById('ics-modal').classList.add('open');
}
function closeICSModal(){document.getElementById('ics-modal').classList.remove('open');}
document.getElementById('ics-modal').addEventListener('click',function(e){if(e.target===this)closeICSModal();});

const icsDrop=document.getElementById('ics-drop');
icsDrop.addEventListener('dragover',e=>{e.preventDefault();icsDrop.classList.add('drag-over');});
icsDrop.addEventListener('dragleave',()=>icsDrop.classList.remove('drag-over'));
icsDrop.addEventListener('drop',e=>{e.preventDefault();icsDrop.classList.remove('drag-over');const f=e.dataTransfer.files[0];if(f)icsHandleFile(f);});
document.getElementById('ics-file').addEventListener('change',function(){if(this.files[0])icsHandleFile(this.files[0]);});

function icsHandleFile(file){
  const reader=new FileReader();
  reader.onload=e=>{
    const parsed=parseICS(e.target.result);
    if(parsed){
      _pendingICS=parsed;
      icsDrop.classList.add('ok');
      document.getElementById('ics-drop-icon').textContent='✅';
      document.getElementById('ics-drop-text').textContent=file.name;
      document.getElementById('ics-drop-hint').textContent='Ready to import';
      document.getElementById('ics-save-btn').disabled=false;
      document.getElementById('ics-msg').textContent='';
    }else{
      document.getElementById('ics-drop-icon').textContent='❌';
      document.getElementById('ics-drop-text').textContent='Could not parse file';
      document.getElementById('ics-msg').textContent='Make sure it\'s a valid .ics timetable';
      document.getElementById('ics-save-btn').disabled=true;
    }
  };
  reader.readAsText(file);
}
function saveICSImport(){
  if(!_pendingICS)return;
  localStorage.setItem('st_ics',JSON.stringify(_pendingICS));
  applyICS(_pendingICS);
  closeICSModal();
  renderTT();
  showToast('Timetable imported ✓');
}
function ctxReset(){closeCtx();document.getElementById('reset-modal').classList.add('open');}
function closeResetModal(){document.getElementById('reset-modal').classList.remove('open');}
function confirmReset(){
  localStorage.clear();
  location.reload();
}
// Close reset modal on backdrop click
document.getElementById('reset-modal').addEventListener('click',function(e){
  if(e.target===this)closeResetModal();
});

/* ════ QUOTE ═════════════════════════════════════════════ */
const QUOTES=[
  {q:"The secret of getting ahead is getting started.",a:"Mark Twain"},
  {q:"It always seems impossible until it's done.",a:"Nelson Mandela"},
  {q:"You don't have to be great to start, but you have to start to be great.",a:"Zig Ziglar"},
  {q:"Small steps every day.",a:"Unknown"},
  {q:"Discipline is choosing between what you want now and what you want most.",a:"Abraham Lincoln"},
  {q:"An investment in knowledge pays the best interest.",a:"Benjamin Franklin"},
  {q:"The expert in anything was once a beginner.",a:"Helen Hayes"},
  {q:"Don't watch the clock; do what it does. Keep going.",a:"Sam Levenson"},
  {q:"Push yourself, because no one else is going to do it for you.",a:"Unknown"},
  {q:"The harder you work for something, the greater you'll feel when you achieve it.",a:"Unknown"},
  {q:"Dream big. Work hard. Stay focused.",a:"Unknown"},
  {q:"Success is the sum of small efforts repeated day in and day out.",a:"Robert Collier"},
  {q:"You are capable of more than you know.",a:"Glinda, The Wizard of Oz"},
  {q:"Strive for progress, not perfection.",a:"Unknown"},
  {q:"The future depends on what you do today.",a:"Mahatma Gandhi"},
  {q:"Education is the most powerful weapon which you can use to change the world.",a:"Nelson Mandela"},
  {q:"A little progress each day adds up to big results.",a:"Satya Nani"},
  {q:"Work hard in silence, let success make the noise.",a:"Frank Ocean"},
  {q:"Believe you can and you're halfway there.",a:"Theodore Roosevelt"},
  {q:"The only way to do great work is to love what you do.",a:"Steve Jobs"},
  {q:"Do something today that your future self will thank you for.",a:"Sean Patrick Flanery"},
  {q:"Learning is not attained by chance; it must be sought with ardour.",a:"Abigail Adams"},
  {q:"Start where you are. Use what you have. Do what you can.",a:"Arthur Ashe"},
  {q:"Great things are done by a series of small things brought together.",a:"Vincent Van Gogh"},
];
(function(){
  const q=QUOTES[Math.floor(Math.random()*QUOTES.length)];
  const el=document.getElementById('h-quote');
  if(el)el.innerHTML=`<div class="h-quote-text">"${q.q}"</div><div class="h-quote-author">— ${q.a}</div>`;
})();

/* ════ SYNC UI ═══════════════════════════════════════════ */
let _sbMode='in'; // 'in' or 'up'

function toggleSyncBadge(){
  const b=document.getElementById('sync-badge');
  if(sbUserId){b.classList.toggle('show');}
  else{sbOpenModal();}
}
function closeSyncBadge(){document.getElementById('sync-badge').classList.remove('show');}

function sbOpenModal(){
  const m=document.getElementById('sb-modal');
  if(m){m.style.display='flex';setTimeout(()=>document.getElementById('sb-email')?.focus(),200);}
}
function sbCloseModal(){
  const m=document.getElementById('sb-modal');
  if(m)m.style.display='none';
  document.getElementById('sb-error').textContent='';
}
function sbSetMode(mode){
  _sbMode=mode;
  document.getElementById('sb-tab-in').classList.toggle('on',mode==='in');
  document.getElementById('sb-tab-up').classList.toggle('on',mode==='up');
  document.getElementById('sb-pass2-field').style.display=mode==='up'?'':'none';
  document.getElementById('sb-submit').textContent=mode==='in'?'Sign in':'Create account';
  document.getElementById('sb-pass-label').textContent=mode==='in'?'Password':'Choose a password';
  document.getElementById('sb-error').textContent='';
  const passEl=document.getElementById('sb-pass');
  if(passEl)passEl.setAttribute('autocomplete',mode==='in'?'current-password':'new-password');
}
function sbTogglePass(){
  const p=document.getElementById('sb-pass');
  p.type=p.type==='password'?'text':'password';
}

async function sbSubmit(){
  const email=document.getElementById('sb-email').value.trim();
  const pass=document.getElementById('sb-pass').value;
  const errEl=document.getElementById('sb-error');
  const btn=document.getElementById('sb-submit');
  if(!email||!pass){errEl.textContent='Please fill in all fields.';return;}
  if(_sbMode==='up'){
    const pass2=document.getElementById('sb-pass2').value;
    if(pass!==pass2){errEl.textContent='Passwords do not match.';return;}
    if(pass.length<6){errEl.textContent='Password must be at least 6 characters.';return;}
  }
  btn.disabled=true;
  btn.textContent=_sbMode==='in'?'Signing in…':'Creating account…';
  errEl.textContent='';
  const result=_sbMode==='in'?await sbSignIn(email,pass):await sbSignUp(email,pass);
  btn.disabled=false;
  btn.textContent=_sbMode==='in'?'Sign in':'Create account';
  if(result.error){errEl.textContent=result.error;return;}
  if(result.access_token){
    sbCloseModal();
    await sbActivateSession(result);
  }else{
    errEl.textContent='Something went wrong. Try again.';
  }
}

function setSyncStatus(connected,email){
  const dot=document.getElementById('sync-dot');
  const title=document.getElementById('sync-title');
  const sub=document.getElementById('sync-sub');
  const syncBadgeBtn=document.getElementById('sync-badge')?.querySelector('.btn');
  const sb=document.getElementById('syncbtn');
  const mobileSyncDot=document.getElementById('mobile-sync-dot');
  const mobileSyncBtn=document.getElementById('mobile-syncbtn');
  const mhDot=document.getElementById('mh-sync-dot');
  const mhLbl=document.getElementById('mh-sync-lbl');
  if(connected){
    if(dot)dot.className='sync-dot green';
    if(title)title.textContent='Synced';
    if(sub)sub.textContent=email||'Data syncs across your devices';
    if(syncBadgeBtn){syncBadgeBtn.textContent='Sign out';syncBadgeBtn.onclick=sbSignOut;}
    if(sb){sb.style.color='#16a34a';}
    if(mobileSyncDot){mobileSyncDot.style.opacity='1';mobileSyncDot.style.background='#16a34a';}
    if(mobileSyncBtn)mobileSyncBtn.style.color='#16a34a';
    if(mhDot)mhDot.classList.add('on');
    if(mhLbl)mhLbl.textContent=email?email.split('@')[0]:'synced';
  }else{
    if(dot)dot.className='sync-dot grey';
    if(title)title.textContent='Sync across devices';
    if(sub)sub.textContent='Sign in to sync your data';
    if(syncBadgeBtn){syncBadgeBtn.textContent='Sign in';syncBadgeBtn.onclick=sbOpenModal;}
    if(sb){sb.style.color='';}
    if(mobileSyncDot){mobileSyncDot.style.opacity='0';mobileSyncDot.style.background='';}
    if(mobileSyncBtn)mobileSyncBtn.style.color='';
    if(mhDot)mhDot.classList.remove('on');
    if(mhLbl)mhLbl.textContent='sync';
  }
}


async function sbActivateSession(sess){
  sbAuthToken=sess.access_token;
  sbUserId=sess.user?.id;
  localStorage.setItem('sb_session',JSON.stringify(sess));
  const remote=await sbLoadAll();
  const hasRemote=remote&&Object.keys(remote).length>0;
  if(hasRemote){
    applyRemoteData(remote);
    renderDash();renderTT();renderRems();renderHW();
    showToast('Synced ✓');
  }else{
    await sbPushAll();
    showToast('Account created ✓');
  }
  setSyncStatus(true,sess.user?.email);
  closeSyncBadge();
  sbStartAutoSync();
}

let _sbSyncInterval=null;
function sbStartAutoSync(){
  // Pull from Supabase when tab becomes visible (user switches back to tab)
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&sbUserId)sbSilentPull();
  },{once:false});
  // Also poll every 30 seconds while logged in
  if(_sbSyncInterval)clearInterval(_sbSyncInterval);
  _sbSyncInterval=setInterval(()=>{if(sbUserId)sbSilentPull();},30000);
}

async function sbSilentPull(){
  if(!sbUserId)return;
  try{
    const remote=await sbLoadAll();
    if(!remote||!Object.keys(remote).length)return;
    // Only apply keys where Supabase updated_at is newer than our last push timestamp
    const localTs=JSON.parse(localStorage.getItem('sb_push_ts')||'{}');
    const DATA_KEYS=['st_r5','st_e5','st_l5','st_p5','st_x5','st_hw','st_name','st_ics'];
    let changed=false;
    const filtered={};
    DATA_KEYS.forEach(k=>{
      if(!remote[k])return;
      const remoteTs=remote[k].updated_at;
      const localT=localTs[k]||'';
      // Apply only if remote is strictly newer than when we last pushed this key
      if(remoteTs>localT){
        filtered[k]=remote[k];
        changed=true;
      }
    });
    if(!changed)return;
    applyRemoteData(filtered);
    renderDash();renderTT();renderRems();renderHW();
  }catch{}
}

async function sbSignOut(){
  try{await sbFetch('/auth/v1/logout',{method:'POST'});}catch{}
  sbAuthToken=null;sbUserId=null;
  localStorage.removeItem('sb_session');
  setSyncStatus(false,null);
  closeSyncBadge();
  showToast('Signed out');
}


/* ════ TIMETABLE CELL EDIT ═══════════════════════════════ */
// All available icons for the picker (key = icon id, value = svg inner)
const TT_ICONS={
  'math':     `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M12 4v16M4 12h16M6 6l12 12M18 6L6 18"/></svg>`,
  'text':     `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>`,
  'beaker':   `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3v8L5.5 18.5a1 1 0 00.9 1.5h11.2a1 1 0 00.9-1.5L15 11V3M9 3h6"/></svg>`,
  'music':    `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  'building': `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h18v4H3zM5 7v14M19 7v14M9 11h6M9 15h6"/></svg>`,
  'globe':    `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M3 12h18M12 3c-3 4-3 14 0 18M12 3c3 4 3 14 0 18"/></svg>`,
  'clock':    `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  'run':      `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 20l3-7 4 3 4-3 3 7M8 13l4-8 4 8"/></svg>`,
  'brief':    `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path stroke-linecap="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>`,
  'ball':     `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3c3 3 6 6 0 18M12 3c-3 3-6 6 0 18M3 12h18"/></svg>`,
  'clip':     `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
  'paint':    `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
  'cpu':      `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></svg>`,
  'chat':     `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`,
  'heart':    `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`,
  'chart':    `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
  'book':     `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>`,
  'lang':     `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg>`,
};

// Map subject names to default icon keys
const SUBJ_ICON_MAP={
  mathematics:'math',english:'text',science:'beaker',music:'music',
  commerce:'building',geography:'globe',history:'clock','history elective':'clock',
  pdhpe:'run',pe:'run',careers:'brief',volleyball:'ball','roll call':'clip',
};

let ttEditCtx=null;
let ttSelectedIcon=null;

function buildIconGrid(selectedKey){
  const grid=document.getElementById('tt-icon-grid');
  grid.innerHTML='';
  Object.entries(TT_ICONS).forEach(([key,svg])=>{
    const btn=document.createElement('div');
    btn.className='tt-icon-opt'+(key===selectedKey?' sel':'');
    btn.innerHTML=svg;
    btn.title=key;
    btn.onclick=()=>{
      ttSelectedIcon=key;
      grid.querySelectorAll('.tt-icon-opt').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel');
    };
    grid.appendChild(btn);
  });
}

// When typing subject, auto-suggest the matching icon
function onTTSubjInput(){
  const val=document.getElementById('tt-edit-subj').value.toLowerCase().trim();
  const match=SUBJ_ICON_MAP[val];
  if(match&&match!==ttSelectedIcon){
    ttSelectedIcon=match;
    document.querySelectorAll('.tt-icon-opt').forEach(b=>{
      b.classList.toggle('sel',b.title===match);
    });
  }
}

const TT_PALETTE=[
  '#f28b82','#e8a87c','#f5c26b','#81c995','#67c1b5',
  '#7bafd4','#c084fc','#fdba74','#94a3b8','#f9a8d4',
  '#86efac','#a5f3fc','#fde68a','#d4a5f5','#fca5a5',
  '#6ee7b7','#93c5fd','#cbd5e1','#f0abfc','#bef264',
  null, // no colour (remove)
];

let ttSelectedColour=null;

function buildColourGrid(currentSubj){
  const grid=document.getElementById('tt-colour-grid');
  grid.innerHTML='';
  const cur=subjColour(currentSubj)||null;
  TT_PALETTE.forEach(col=>{
    const btn=document.createElement('div');
    const isSel=col===cur||(col===null&&!cur);
    if(col===null){
      // "no colour" option
      btn.style.cssText=`width:100%;aspect-ratio:1;border-radius:7px;border:1.5px dashed var(--border);cursor:none;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--t3);transition:all .14s${isSel?';outline:2px solid var(--text);outline-offset:2px':''}`;
      btn.title='No colour';
      btn.textContent='✕';
    }else{
      btn.style.cssText=`width:100%;aspect-ratio:1;border-radius:7px;background:${col};cursor:none;transition:all .14s;border:1.5px solid rgba(0,0,0,.08)${isSel?';outline:2.5px solid var(--text);outline-offset:2px;transform:scale(1.15)':''}`;
      btn.title=col;
    }
    btn.onclick=()=>{
      ttSelectedColour=col;
      buildColourGrid_active(grid,col);
    };
    grid.appendChild(btn);
  });
  ttSelectedColour=cur;
}

function buildColourGrid_active(grid,sel){
  const btns=grid.children;
  TT_PALETTE.forEach((col,i)=>{
    const btn=btns[i];if(!btn)return;
    const isSel=col===sel||(col===null&&sel===null);
    if(col===null){
      btn.style.outline=isSel?'2px solid var(--text)':'none';
      btn.style.outlineOffset=isSel?'2px':'0';
    }else{
      btn.style.outline=isSel?'2.5px solid var(--text)':'none';
      btn.style.outlineOffset=isSel?'2px':'0';
      btn.style.transform=isSel?'scale(1.15)':'scale(1)';
    }
  });
  ttSelectedColour=sel;
}

function openTTEdit(day,periodLabel,p){
  ttEditCtx={day,periodLabel,p};
  document.getElementById('tt-edit-title').textContent='Edit '+( p.subj||'period');
  document.getElementById('tt-edit-sub').textContent=day.charAt(0).toUpperCase()+day.slice(1)+' · '+periodLabel;
  document.getElementById('tt-edit-subj').value=p.subj||'';
  document.getElementById('tt-edit-room').value=p.room||'';
  ttSelectedIcon=p.icon||(p.subj&&SUBJ_ICON_MAP[p.subj])||Object.keys(TT_ICONS)[0];
  buildIconGrid(ttSelectedIcon);
  buildColourGrid(p.subj||'');
  const inp=document.getElementById('tt-edit-subj');
  inp.oninput=onTTSubjInput;
  document.getElementById('tt-edit-modal').classList.add('open');
  setTimeout(()=>inp.focus(),200);
}

function closeTTEdit(){
  document.getElementById('tt-edit-modal').classList.remove('open');
  ttEditCtx=null;
}

function saveTTEdit(){
  if(!ttEditCtx)return;
  const {p}=ttEditCtx;
  const oldSubj=p.subj;
  const newSubj=document.getElementById('tt-edit-subj').value.trim().toLowerCase()||null;
  const newRoom=document.getElementById('tt-edit-room').value.trim()||null;
  const newIcon=ttSelectedIcon||null;

  // Rename subject across the ENTIRE timetable
  if(newSubj&&oldSubj&&newSubj!==oldSubj){
    ['monday','tuesday','wednesday','thursday','friday'].forEach(day=>{
      (TT[day]||[]).forEach(period=>{
        if(period.subj===oldSubj){
          period.subj=newSubj;
          if(!period.icon&&newIcon)period.icon=newIcon;
        }
      });
    });
    // Also migrate colour if old subject had one
    if(SUBJ_COLOURS[oldSubj]){
      SUBJ_COLOURS[newSubj]=SUBJ_COLOURS[oldSubj];
      delete SUBJ_COLOURS[oldSubj];
    }
    // Migrate room change only on the specific period
    const {day,periodLabel}=ttEditCtx;
    const dayArr=TT[day];
    if(dayArr){const entry=dayArr.find(p2=>p2.l===periodLabel);if(entry)entry.room=newRoom;}
  }else{
    // No rename — just update this specific period
    const {day,periodLabel}=ttEditCtx;
    const dayArr=TT[day];
    if(dayArr){
      const entry=dayArr.find(p2=>p2.l===periodLabel);
      if(entry){entry.subj=newSubj;entry.room=newRoom;entry.icon=newIcon;}
    }
  }

  // Also update icon in SIC
  if(newSubj&&newIcon&&TT_ICONS[newIcon]) SIC[newSubj]=TT_ICONS[newIcon];

  // Apply colour choice
  const finalSubj=newSubj||oldSubj;
  if(finalSubj){
    if(ttSelectedColour===null){
      delete SUBJ_COLOURS[finalSubj];
    }else if(ttSelectedColour){
      SUBJ_COLOURS[finalSubj]=ttSelectedColour;
    }
    saveSubjColours();
  }

  localStorage.setItem('st_ics',JSON.stringify(TT));
  sbSet('st_ics',TT);
  closeTTEdit();
  renderTT();
  renderDash();
  renderRems();
  renderHW();
  showToast('Subject updated');
}

document.getElementById('tt-edit-modal').addEventListener('click',function(e){if(e.target===this)closeTTEdit();});

/* ════ CUSTOM DROPDOWNS ══════════════════════════════════
   Replaces all native <select class="inp"> with a glass
   floating panel. The hidden <select> stays in the DOM so
   all existing .value reads / assignments still work.
════════════════════════════════════════════════════════ */
const _cddPanels=new Map(); // selectId → panel element
let _cddOpen=null; // currently open select id

function cddBuild(sel){
  if(!sel||_cddPanels.has(sel.id))return;

  // Wrap the select in a .cdd container
  const wrap=document.createElement('div');
  wrap.className='cdd';
  // Copy width style if inline
  if(sel.style.width)wrap.style.width=sel.style.width;
  sel.parentNode.insertBefore(wrap,sel);
  wrap.appendChild(sel);

  // Trigger button
  const trigger=document.createElement('div');
  trigger.className='cdd-trigger';
  trigger.innerHTML=`<span class="cdd-val"></span><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>`;
  wrap.appendChild(trigger);

  // Floating panel (appended to body so it escapes modals)
  const panel=document.createElement('div');
  panel.className='cdd-panel';
  document.body.appendChild(panel);
  _cddPanels.set(sel.id,{trigger,panel,sel});

  function syncTrigger(){
    const opt=sel.options[sel.selectedIndex];
    const lbl=opt?opt.text:'';
    const val=opt?opt.value:'';
    const span=trigger.querySelector('.cdd-val');
    span.textContent=lbl||'';
    span.className='cdd-val'+((!val||val==='')?' cdd-placeholder':'');
  }
  syncTrigger();

  function buildPanel(){
    panel.innerHTML='';
    [...sel.options].forEach((o,i)=>{
      const div=document.createElement('div');
      div.className='cdd-opt'+(o.value===sel.value?' sel':'');
      div.textContent=o.text;
      div.onclick=()=>{
        sel.value=o.value;
        // Dispatch change event so any onchange listeners fire
        sel.dispatchEvent(new Event('change',{bubbles:true}));
        syncTrigger();
        cddClose();
      };
      panel.appendChild(div);
    });
  }

  function positionPanel(){
    const r=trigger.getBoundingClientRect();
    const ph=Math.min(240,panel.scrollHeight+10);
    const spaceBelow=window.innerHeight-r.bottom-8;
    const openUp=spaceBelow<ph&&r.top>ph;
    panel.style.left=r.left+'px';
    panel.style.width=Math.max(r.width,160)+'px';
    if(openUp){
      panel.style.top='';
      panel.style.bottom=(window.innerHeight-r.top+4)+'px';
      panel.style.transformOrigin='bottom center';
    }else{
      panel.style.bottom='';
      panel.style.top=(r.bottom+4)+'px';
      panel.style.transformOrigin='top center';
    }
  }

  trigger.onclick=(e)=>{
    e.stopPropagation();
    if(_cddOpen&&_cddOpen!==sel.id)cddClose();
    if(panel.classList.contains('open')){cddClose();return;}
    buildPanel();
    positionPanel();
    panel.classList.add('open');
    trigger.classList.add('open');
    _cddOpen=sel.id;
  };

  // Keep in sync when value is set programmatically
  const origDesc=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
  // Use MutationObserver to detect option changes (e.g. from populateSubjectDropdowns)
  const mo=new MutationObserver(()=>{syncTrigger();});
  mo.observe(sel,{childList:true,subtree:true,attributes:true});
  sel._cddSync=syncTrigger;
}

function cddClose(){
  if(!_cddOpen)return;
  const entry=_cddPanels.get(_cddOpen);
  if(entry){
    entry.panel.classList.remove('open');
    entry.trigger.classList.remove('open');
  }
  _cddOpen=null;
}

// Close on outside click
document.addEventListener('click',()=>cddClose());
document.addEventListener('keydown',e=>{if(e.key==='Escape')cddClose();});

// Intercept programmatic .value sets on selects so trigger stays in sync
function cddSyncAll(){
  _cddPanels.forEach(({sel,trigger})=>{
    if(sel._cddSync)sel._cddSync();
  });
}

// Init all selects now and after DOM changes
function cddInit(){
  document.querySelectorAll('select.inp').forEach(sel=>{
    if(sel.id)cddBuild(sel);
  });
}

/* ════ SEARCH ════════════════════════════════════════════ */
function openSearch(){
  const ov=document.getElementById('search-overlay');
  const box=document.getElementById('search-box');
  ov.style.display='flex';
  requestAnimationFrame(()=>{
    ov.style.opacity='1';
    box.style.transform='translateY(0) scale(1)';
  });
  setTimeout(()=>document.getElementById('search-input').focus(),80);
  document.getElementById('search-input').value='';
  document.getElementById('search-results').innerHTML='<div class="sr-empty">Start typing to search…</div>';
}
function closeSearch(){
  const ov=document.getElementById('search-overlay');
  const box=document.getElementById('search-box');
  ov.style.opacity='0';
  box.style.transform='translateY(-10px) scale(.97)';
  setTimeout(()=>ov.style.display='none',220);
}
document.getElementById('search-overlay').addEventListener('click',function(e){if(e.target===this)closeSearch();});
document.getElementById('search-input').addEventListener('input',function(){
  const q=this.value.trim().toLowerCase();
  const res=document.getElementById('search-results');
  if(!q){res.innerHTML='<div class="sr-empty">Start typing to search…</div>';return;}
  const hits=[];
  rems.forEach(r=>{if(!r.done&&r.text.toLowerCase().includes(q))hits.push({tag:'rem',title:r.text,meta:r.subj||'reminder',action:()=>{closeSearch();const ni=document.querySelector('.ni[data-page="dash"]');if(ni)goTo('dash',ni);}});});
  hw.filter(h=>!h.done).forEach(h=>{if(h.task.toLowerCase().includes(q))hits.push({tag:'hw',title:h.task,meta:(h.subj||'')+(h.due?` · due ${formatHWDate(h.due)}`:''),action:()=>{closeSearch();const ni=document.querySelector('.ni[data-page="dash"]');if(ni)goTo('dash',ni);}});});
  evs.forEach(e=>{if(e.name.toLowerCase().includes(q))hits.push({tag:'ev',title:e.name,meta:e.date+(e.subj?` · ${e.subj}`:''),action:()=>{closeSearch();const ni=document.querySelector('.ni[data-page="cal"]');if(ni)goTo('cal',ni);}});});
  exams.forEach(e=>{if(e.name.toLowerCase().includes(q)||e.subj.toLowerCase().includes(q))hits.push({tag:'ex',title:e.name,meta:`${e.subj} · ${e.date}`,action:()=>{closeSearch();const ni=document.querySelector('.ni[data-page="study"]');if(ni)goTo('study',ni);}});});
  if(!hits.length){res.innerHTML='<div class="sr-empty">No results for "'+esc(q)+'"</div>';return;}
  res.innerHTML=hits.slice(0,12).map((h,i)=>`<div class="sr-item" onclick="window.__srHit${i}&&window.__srHit${i}()">
    <span class="sr-tag ${h.tag}">${h.tag==='rem'?'reminder':h.tag==='hw'?'homework':h.tag==='ev'?'event':'exam'}</span>
    <div class="sr-body"><div class="sr-title">${esc(h.title)}</div>${h.meta?`<div class="sr-meta">${esc(h.meta)}</div>`:''}</div>
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="12" height="12" style="opacity:.3;flex-shrink:0"><path stroke-linecap="round" d="M9 5l7 7-7 7"/></svg>
  </div>`).join('');
  hits.slice(0,12).forEach((h,i)=>{window[`__srHit${i}`]=h.action;});
});

/* ════ NOTIFICATIONS ════════════════════════════════════ */
let notifEnabled=localStorage.getItem('st_notif')==='1';
function toggleNotifications(){
  if(Notification.permission==='denied'){showToast('Notifications blocked in browser settings');return;}
  if(!notifEnabled||Notification.permission!=='granted'){
    Notification.requestPermission().then(p=>{
      if(p==='granted'){
        notifEnabled=true;localStorage.setItem('st_notif','1');
        updateNotifBtn();
        showToast('Notifications enabled ✓');
        scheduleNotifications();
      }else{showToast('Notifications not granted');}
    });
  }else{
    notifEnabled=false;localStorage.setItem('st_notif','0');
    updateNotifBtn();showToast('Notifications off');
  }
}
function updateNotifBtn(){
  const btn=document.getElementById('notif-btn');
  if(!btn)return;
  btn.classList.toggle('on',notifEnabled);
}
function scheduleNotifications(){
  if(!notifEnabled||Notification.permission!=='granted')return;
  const today=new Date().toISOString().split('T')[0];
  const tomorrow=new Date(Date.now()+86400000).toISOString().split('T')[0];
  const urgent=[];
  hw.filter(h=>!h.done&&h.due).forEach(h=>{
    if(h.due===today)urgent.push(`📚 ${h.task} is due today`);
    else if(h.due===tomorrow)urgent.push(`📚 ${h.task} is due tomorrow`);
  });
  exams.forEach(e=>{
    if(e.date===today)urgent.push(`📝 ${e.name} (${e.subj}) exam is today`);
    else if(e.date===tomorrow)urgent.push(`📝 ${e.name} (${e.subj}) exam is tomorrow`);
  });
  if(urgent.length){
  new Notification('stream++ reminder',{body:urgent.join('\n'),icon:''});
    const btn=document.getElementById('notif-btn');if(btn)btn.classList.add('pending');
  }
}
// Check notifications once a day via a simple interval
setInterval(scheduleNotifications,3600000);

/* ════ DRAG TO REORDER ══════════════════════════════════ */
let dragSrc=null,dragList=null,dragType=null;

function makeDraggable(el,type){
  el.setAttribute('draggable','true');
  el.addEventListener('dragstart',e=>{
    dragSrc=el;dragType=type;
    e.dataTransfer.effectAllowed='move';
    setTimeout(()=>el.classList.add('dragging'),0);
  });
  el.addEventListener('dragend',()=>{
    el.classList.remove('dragging');
    document.querySelectorAll('.ri,.hw-item').forEach(e=>e.classList.remove('drag-over'));
    dragSrc=null;
  });
  el.addEventListener('dragover',e=>{
    e.preventDefault();e.dataTransfer.dropEffect='move';
    if(el!==dragSrc)el.classList.add('drag-over');
  });
  el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));
  el.addEventListener('drop',e=>{
    e.preventDefault();el.classList.remove('drag-over');
    if(!dragSrc||el===dragSrc||dragType!==type)return;
    if(type==='rem'){
      const fromId=+dragSrc.dataset.id,toId=+el.dataset.id;
      const fi=rems.findIndex(r=>r.id===fromId),ti=rems.findIndex(r=>r.id===toId);
      if(fi<0||ti<0)return;
      rems.splice(ti,0,rems.splice(fi,1)[0]);
      sv('st_r5',rems);renderRems();
    }else if(type==='hw'){
      const fromId=+dragSrc.dataset.id,toId=+el.dataset.id;
      const fi=hw.findIndex(h=>h.id===fromId),ti=hw.findIndex(h=>h.id===toId);
      if(fi<0||ti<0)return;
      hw.splice(ti,0,hw.splice(fi,1)[0]);
      sv('st_hw',hw);renderHW();
    }
  });
}

/* ════ TREND CHART ══════════════════════════════════════ */
function renderTrend(){
  const canvas=document.getElementById('pp-trend');if(!canvas)return;
  const sp=papers.filter(p=>p.subj===curPaperSubj).slice().reverse(); // oldest first
  if(sp.length<2){canvas.style.display='none';return;}
  canvas.style.display='block';
  const W=canvas.offsetWidth||canvas.parentElement.offsetWidth||400;
  const H=120;canvas.width=W*2;canvas.height=H*2;canvas.style.width=W+'px';canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');ctx.scale(2,2);
  ctx.clearRect(0,0,W,H);
  const pcts=sp.map(p=>p.mark/p.total*100);
  const min=Math.max(0,Math.min(...pcts)-10),max=Math.min(100,Math.max(...pcts)+10);
  const toY=v=>H-8-((v-min)/(max-min))*(H-16);
  const toX=(i)=>16+(W-32)*(i/(sp.length-1));
  const night=document.body.classList.contains('night');
  const lineCol=night?'rgba(160,180,255,.8)':'rgba(37,99,235,.7)';
  const dotCol=night?'rgba(180,200,255,1)':'rgba(37,99,235,1)';
  const fillCol=night?'rgba(100,130,255,.08)':'rgba(37,99,235,.07)';

  // Fill area under line
  ctx.beginPath();ctx.moveTo(toX(0),toY(pcts[0]));
  pcts.forEach((v,i)=>{if(i>0)ctx.lineTo(toX(i),toY(v));});
  ctx.lineTo(toX(sp.length-1),H);ctx.lineTo(toX(0),H);ctx.closePath();
  ctx.fillStyle=fillCol;ctx.fill();

  // Line
  ctx.beginPath();ctx.moveTo(toX(0),toY(pcts[0]));
  pcts.forEach((v,i)=>{if(i>0)ctx.lineTo(toX(i),toY(v));});
  ctx.strokeStyle=lineCol;ctx.lineWidth=1.8;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();

  // Dots + labels
  pcts.forEach((v,i)=>{
    const x=toX(i),y=toY(v);
    ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);
    ctx.fillStyle=dotCol;ctx.fill();
    ctx.fillStyle=night?'rgba(200,210,255,.7)':'rgba(60,80,140,.6)';
    ctx.font='8px "Geist Mono"';ctx.textAlign='center';
    ctx.fillText(v.toFixed(0)+'%',x,y-6);
  });
}

/* ════ EXPORT ════════════════════════════════════════════ */
function exportData(){
  const rows=[['Type','Subject','Title/Task','Date','Mark','Total','Notes']];
  hw.forEach(h=>rows.push(['Homework',h.subj||'',h.task,h.due||'','','',h.done?'done':'pending']));
  rems.forEach(r=>rows.push(['Reminder',r.subj||'',r.text,'','','',r.pri||'']));
  exams.forEach(e=>rows.push(['Exam',e.subj,e.name,e.date,'','','']));
  papers.forEach(p=>rows.push(['Past Paper',p.subj,p.name,p.date,p.mark,p.total,p.notes||'']));
  logs.forEach(l=>rows.push(['Study Session',l.subj,l.what||'session',l.date,l.mins+'min','','']));
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=`stream++-export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Exported ✓');
}

/* ════ QUICK ADD FAB ═════════════════════════════════════ */
let qaOpen=false;

function toggleQA(){
  qaOpen?closeQA():openQA();
}

function openQA(){
  qaOpen=true;
  document.getElementById('qa-btn').classList.add('open');
  document.getElementById('qa-backdrop').classList.add('show');
  // Stagger items in with delay
  const items=['qa-ev','qa-rem','qa-hw'];
  items.forEach((id,i)=>{
    setTimeout(()=>{
      const el=document.getElementById(id);
      if(el)el.classList.add('show');
    },i*55);
  });
}

function closeQA(){
  qaOpen=false;
  document.getElementById('qa-btn').classList.remove('open');
  document.getElementById('qa-backdrop').classList.remove('show');
  ['qa-hw','qa-rem','qa-ev'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.classList.remove('show');
  });
}

function qaOpenHW(){
  closeQA();
  openHWModal();
}
function qaOpenRem(){
  closeQA();
  openRM();
}
function qaOpenEv(){
  closeQA();
  openQM(new Date().toISOString().split('T')[0]);
}

// Close on Esc
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&qaOpen)closeQA();});

/* ════ MOBILE TOUCH + SWIPE ══════════════════════════════ */
const isMobile=()=>window.innerWidth<=640;

// Show/hide mobile nav based on screen size
function checkMobileNav(){
  const nav=document.getElementById('mobile-nav');
  // Hide bottom nav entirely on mobile — pg-mobile is the full mobile experience
  if(nav)nav.style.display='none';
}
checkMobileNav();
window.addEventListener('resize',checkMobileNav);

function mobileNav(pg,el){
  if(pg==='dash'){
    // On mobile, dash nav shows pg-mobile
    document.querySelectorAll('.pg').forEach(p=>p.classList.remove('act'));
    document.getElementById('pg-mobile').classList.add('act');
    curPage='dash';
  }else{
    const ni=document.querySelector(`.ni[data-page="${pg}"]`);
    if(ni)goTo(pg,ni);
  }
  document.querySelectorAll('.mni').forEach(n=>n.classList.remove('act'));
  el.classList.add('act');
}

/* ════ MOBILE HOME ═══════════════════════════════════════ */
let _mhY=new Date().getFullYear(),_mhM=new Date().getMonth(),_mhSel=null,_mhTab='rem';
let _mhPage=0; // 0=hero, 1=tiles
let _mhCountInterval=null;

function mhInit(){
  if(window.innerWidth>640)return;
  applyFancyCursor(false);
  // Default dates
  const tod=new Date().toISOString().split('T')[0];
  ['mh-hd','mh-ed','mh-xd'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=tod;});
  mhRenderAll();
  mhPagerSetup();
  mhStartCountdown();
}

function mhRenderAll(){
  mhRenderHeroPanel();
  mhRenderCal();mhRenderSched();mhRenderRems();mhRenderHW();mhRenderExams();mhRenderTodayEvs();
  setTimeout(mhDragSetup,100);
}

/* ── PAGER: swipe between hero and tiles ─────────────── */
function mhGoTo(page){
  _mhPage=page;
  const pager=document.getElementById('mh-pager');
  if(pager)pager.classList.toggle('on-tiles',page===1);
  document.getElementById('mh-pd-0')?.classList.toggle('on',page===0);
  document.getElementById('mh-pd-1')?.classList.toggle('on',page===1);
}

function mhPagerSetup(){
  // Block vertical bounce on hero panel
  const hero=document.getElementById('mh-panel-hero');
  if(hero){
    let _hx=0,_hy=0;
    hero.addEventListener('touchstart',e=>{_hx=e.touches[0].clientX;_hy=e.touches[0].clientY;},{passive:true});
    hero.addEventListener('touchmove',e=>{
      const dx=Math.abs(e.touches[0].clientX-_hx);
      const dy=Math.abs(e.touches[0].clientY-_hy);
      if(dy>dx)e.preventDefault();
    },{passive:false});
  }

  // Double-tap anywhere opens quick-add
  let _lastTap=0;
  document.getElementById('pg-mobile')?.addEventListener('touchend',e=>{
    if(e.target.closest('button,a,.mh-rcheck,.mh-hcheck,.mh-cal-nbtn,.mh-tile-action,[onclick]'))return;
    const now=Date.now();
    if(now-_lastTap<300){
      e.preventDefault();
      if(_mhPage===0){mhGoTo(1);setTimeout(()=>mhOpen('rem'),420);}
      else{mhOpen('rem');}
    }
    _lastTap=now;
  },{passive:false});

  // Swipe detection — attach to pg-mobile so it works in PWA standalone mode
  // Use passive:false so we can preventDefault and claim the gesture from iOS
  const root=document.getElementById('pg-mobile');
  if(!root||root._pagerSetup)return;
  root._pagerSetup=true;
  let sx=0,sy=0,locked=null,swiping=false;
  const pager=document.getElementById('mh-pager');

  root.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    sx=e.touches[0].clientX;
    sy=e.touches[0].clientY;
    locked=null;swiping=true;
  },{passive:true});

  root.addEventListener('touchmove',e=>{
    if(!swiping||e.touches.length!==1)return;
    const dx=e.touches[0].clientX-sx;
    const dy=e.touches[0].clientY-sy;
    if(!locked){
      if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>6){
        locked='h';
      }else if(Math.abs(dy)>6){
        locked='v';
      }
    }
    if(locked==='h'){
      // Claim the gesture — prevents iOS back swipe from firing
      e.preventDefault();
      // Live drag feedback on hero panel only
      if(_mhPage===0&&pager){
        pager.style.transition='none';
        const clamp=Math.max(-window.innerWidth*0.5,Math.min(0,dx*0.4));
        pager.style.transform=`translateX(${clamp}px)`;
      } else if(_mhPage===1&&pager){
        pager.style.transition='none';
        const base=-window.innerWidth;
        const clamp=Math.max(base,Math.min(base+window.innerWidth*0.5,base+dx*0.4));
        pager.style.transform=`translateX(${clamp}px)`;
      }
    }
  },{passive:false});

  root.addEventListener('touchend',e=>{
    if(!swiping)return;
    swiping=false;
    if(pager){pager.style.transition='';pager.style.transform='';}
    if(locked!=='h')return;
    const dx=e.changedTouches[0].clientX-sx;
    if(dx<-40&&_mhPage===0)mhGoTo(1);
    else if(dx>40&&_mhPage===1)mhGoTo(0);
  },{passive:true});
}

/* ── HERO PANEL: countdown + info ───────────────────── */
function mhRenderHeroPanel(){
  const now=new Date();
  const name=localStorage.getItem('st_name')||'';
  const h=now.getHours();
  const greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  const greetEl=document.getElementById('mh-greet-hero');
  if(greetEl)greetEl.textContent=greet+(name?', '+name.charAt(0).toUpperCase()+name.slice(1):'');
  const dateEl=document.getElementById('mh-hero-date');
  if(dateEl)dateEl.textContent=now.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
  mhUpdateCountdown();
}

function mhStartCountdown(){
  mhUpdateCountdown();
  if(_mhCountInterval)clearInterval(_mhCountInterval);
  _mhCountInterval=setInterval(mhUpdateCountdown,1000);
}

function mhUpdateCountdown(){
  const timerEl=document.getElementById('mh-count-timer');
  const labelEl=document.getElementById('mh-count-label');
  const subEl=document.getElementById('mh-count-sub');
  const arcEl=document.getElementById('mh-arc-fill');
  const nextEl=document.getElementById('mh-hero-next');
  if(!timerEl)return;

  const now=new Date();
  const nm=toM(now.getHours(),now.getMinutes())+now.getSeconds()/60;
  const {cur,nxt,weekend}=getCurNxt();

  if(weekend){
    timerEl.textContent='——';
    if(labelEl)labelEl.textContent='weekend';
    if(subEl)subEl.textContent='enjoy your break';
    if(arcEl)arcEl.style.strokeDashoffset='628';
    if(nextEl)nextEl.textContent='';
    return;
  }

  if(cur){
    const totalMin=toM(...cur.e)-toM(...cur.s);
    const remSec=(toM(...cur.e)-nm)*60;
    const remMin=Math.floor(remSec/60);
    const remSecR=Math.floor(remSec%60);
    timerEl.textContent=`${String(remMin).padStart(2,'0')}:${String(remSecR).padStart(2,'0')}`;
    if(labelEl)labelEl.textContent=cur.subj||'Current period';
    if(subEl)subEl.textContent=cur.room?`Room ${cur.room}`:'';
    const pct=Math.max(0,remSec/(totalMin*60));
    if(arcEl)arcEl.style.strokeDashoffset=(628*(1-pct)).toFixed(1);
    if(nextEl){
      if(nxt)nextEl.textContent=`next · ${nxt.subj||'—'} at ${String(nxt.s[0]).padStart(2,'0')}:${String(nxt.s[1]).padStart(2,'0')}${nxt.room?' · room '+nxt.room:''}`;
      else nextEl.textContent='last period today';
    }
  }else if(nxt){
    const diffSec=(toM(...nxt.s)-nm)*60;
    const diffMin=Math.floor(diffSec/60);
    const diffSecR=Math.floor(diffSec%60);
    timerEl.textContent=`${String(diffMin).padStart(2,'0')}:${String(diffSecR).padStart(2,'0')}`;
    if(labelEl)labelEl.textContent='until next period';
    if(subEl)subEl.textContent=nxt.subj||'—';
    const pct=Math.min(1,diffSec/3600);
    if(arcEl)arcEl.style.strokeDashoffset=(628*pct).toFixed(1);
    if(nextEl)nextEl.textContent=nxt.room?`room ${nxt.room}`:'';
  }else{
    timerEl.textContent='done';
    if(labelEl)labelEl.textContent='no more classes';
    if(subEl)subEl.textContent='see you tomorrow';
    if(arcEl)arcEl.style.strokeDashoffset='628';
    if(nextEl)nextEl.textContent='';
  }
}


function mhRenderCal(){
  const grid=document.getElementById('mh-cal-grid');
  const lbl=document.getElementById('mh-cal-month');
  if(!grid)return;
  lbl.textContent=new Date(_mhY,_mhM,1).toLocaleDateString('en-AU',{month:'long',year:'numeric'});
  const days=['Mo','Tu','We','Th','Fr','Sa','Su'];
  let h=days.map(d=>`<div class="mh-dh">${d}</div>`).join('');
  let dow=new Date(_mhY,_mhM,1).getDay();dow=dow===0?6:dow-1;
  const dim=new Date(_mhY,_mhM+1,0).getDate();
  const dip=new Date(_mhY,_mhM,0).getDate();
  const tod=new Date().toISOString().split('T')[0];
  const evDates=new Set((evs||[]).map(e=>e.date));
  const hwDates=new Set((hw||[]).filter(x=>!x.done&&x.due).map(x=>x.due));
  for(let i=dow-1;i>=0;i--)h+=`<div class="mh-cd other">${dip-i}</div>`;
  for(let d=1;d<=dim;d++){
    const ds=`${_mhY}-${String(_mhM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cls=['mh-cd',ds===tod?'today':'',_mhSel===ds&&ds!==tod?'sel':'',evDates.has(ds)||hwDates.has(ds)?'dot':''].filter(Boolean).join(' ');
    h+=`<div class="${cls}" onclick="mhSelDay('${ds}')">${d}</div>`;
  }
  const rem=(7-(dow+dim)%7)%7;
  for(let d=1;d<=rem;d++)h+=`<div class="mh-cd other">${d}</div>`;
  grid.innerHTML=h;
  // Day strip
  const strip=document.getElementById('mh-day-strip');
  const sel=_mhSel||tod;
  const dayEvs=(evs||[]).filter(e=>e.date===sel);
  const dayHW=(hw||[]).filter(x=>x.due===sel&&!x.done);
  if(strip){
    if(dayEvs.length||dayHW.length){
      strip.style.display='block';
      const d=new Date(sel+'T00:00');
      document.getElementById('mh-day-lbl').textContent=d.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'short'}).toUpperCase();
      document.getElementById('mh-day-evs').innerHTML=[
        ...dayEvs.map(e=>`<div class="mh-day-ev"><div class="mh-day-dot"></div>${esc(e.name)}${e.time?`<span style="color:var(--t3);font-family:'Geist Mono',monospace;font-size:10px">${e.time}</span>`:''}</div>`),
        ...dayHW.map(x=>`<div class="mh-day-ev"><div class="mh-day-dot" style="background:#9333ea"></div>📚 ${esc(x.task)}</div>`)
      ].join('');
    }else{strip.style.display='none';}
  }
}

function mhCal(dir){
  _mhM+=dir;
  if(_mhM>11){_mhM=0;_mhY++;}
  if(_mhM<0){_mhM=11;_mhY--;}
  mhRenderCal();
}

function mhSelDay(ds){
  _mhSel=ds;
  mhRenderCal();
  // Pre-fill event date input with selected day
  const ed=document.getElementById('mh-ed');
  if(ed)ed.value=ds;
}

function mhShowICSImport(){
  // Close quick-add sheet if open
  mhClose();
  // Open the existing ICS import modal
  showTTImport();
}

function mhRenderSched(){
  const el=document.getElementById('mh-sched');if(!el)return;
  const now=new Date();
  const nm=toM(now.getHours(),now.getMinutes());
  const dow=now.getDay();
  if(dow<1||dow>5){el.innerHTML='<div class="mh-nil">No school today</div>';return;}
  const periods=TT[DKEYS[dow]]||[];
  if(!periods.length){
    el.innerHTML='<div class="mh-nil">No timetable — <span style="text-decoration:underline;cursor:pointer" onclick="mhShowICSImport()">import .ics</span></div>';
    return;
  }
  el.innerHTML=periods.map(p=>{
    const sm=toM(...p.s),em=toM(...p.e);
    const isCur=nm>=sm&&nm<em;
    const timeStr=`${String(p.s[0]).padStart(2,'0')}:${String(p.s[1]).padStart(2,'0')}`;
    const sc=subjColour(p.subj);
    return`<div class="mh-srow${isCur?' mh-scur':''}">
      <span class="mh-stime">${timeStr}</span>
      <div class="mh-sbar${isCur?' cur':''}" style="${sc?`background:${sc}`:''}"></div>
      <span class="mh-sname">${esc(p.subj||'—')}</span>
      ${p.room?`<span class="mh-sroom">${esc(p.room)}</span>`:''}
    </div>`;
  }).join('');
}

function mhRenderRems(){
  const el=document.getElementById('mh-rems');if(!el)return;
  const all=rems||[];
  const active=all.filter(r=>!r.done);
  const done=all.filter(r=>r.done).length;
  const total=all.length;
  // Update completion ring
  const arc=document.getElementById('mh-ring-rem-arc');
  const txt=document.getElementById('mh-ring-rem-txt');
  if(arc&&total>0){
    const pct=done/total;
    const circ=113;
    arc.style.strokeDashoffset=circ*(1-pct);
    if(txt)txt.textContent=done+'/'+total;
  }else if(arc){
    arc.style.strokeDashoffset=113;
    if(txt)txt.textContent='0';
  }
  const list=active.slice(0,8);
  if(!list.length){el.innerHTML='<div class="mh-nil">All done ✓</div>';return;}
  el.innerHTML=list.map(r=>`
    <div class="mh-rrow${r.done?' done':''}">
      <div class="mh-rcheck" onclick="mhTogR(${r.id})">${r.done?'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>':''}</div>
      <span class="mh-rtxt">${esc(r.text)}</span>
      ${r.pri==='high'?'<span class="mh-rpri h">high</span>':r.pri==='low'?'<span class="mh-rpri l">low</span>':''}
    </div>`).join('');
}

function mhRenderHW(){
  const el=document.getElementById('mh-hw');if(!el)return;
  const list=(hw||[]).filter(h=>!h.done).slice(0,8);
  if(!list.length){el.innerHTML='<div class="mh-nil">No homework</div>';return;}
  const tod=new Date().toISOString().split('T')[0];
  el.innerHTML=list.map(h=>{
    const sc=subjColour(h.subj);
    const od=h.due&&h.due<tod;
    const daysLeft=h.due?Math.ceil((new Date(h.due+'T00:00')-new Date().setHours(0,0,0,0))/86400000):null;
    const dueStr=daysLeft===null?'':(daysLeft===0?'due today':daysLeft===1?'due tomorrow':`due in ${daysLeft}d`);
    return`<div class="mh-hrow${h.done?' done':''}" style="${sc?`border-left-color:${sc}`:'border-left-color:rgba(147,51,234,.4)'}">
      <div class="mh-hcheck" onclick="mhTogH(${h.id})">${h.done?'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>':''}</div>
      <div style="flex:1;min-width:0">
        <div class="mh-htxt">${esc(h.task)}</div>
        <div class="mh-hmeta">
          ${h.subj?`<span style="${sc?`color:${sc}`:''}">⬤ ${h.subj}</span> · `:''}
          <span class="${od?'mh-overdue':''}">${dueStr}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function mhRenderExams(){
  const el=document.getElementById('mh-exams');if(!el)return;
  const tod=new Date().toISOString().split('T')[0];
  const list=(exams||[]).filter(x=>x.date>=tod).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
  if(!list.length){el.innerHTML='<div class="mh-nil">No upcoming exams</div>';return;}
  // Max days for ring scale = 30
  const MAXD=30;
  el.innerHTML=list.map(x=>{
    const days=Math.ceil((new Date(x.date+'T00:00')-new Date().setHours(0,0,0,0))/86400000);
    const pct=Math.max(0,Math.min(1,(MAXD-days)/MAXD));
    const circ=2*Math.PI*22; // r=22
    const offset=circ*(1-pct);
    const col=days===0?'#dc2626':days<=3?'#ea580c':days<=7?'#ca8a04':'#16a34a';
    const dayStr=days===0?'TODAY':days===1?'TMRW':days+'d';
    return`<div class="mh-xrow">
      <svg class="mh-xring" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(0,0,0,.06)" stroke-width="5"/>
        <circle cx="26" cy="26" r="22" fill="none" stroke="${col}" stroke-width="5"
          stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
          stroke-linecap="round" transform="rotate(-90 26 26)"/>
        <text x="26" y="24" text-anchor="middle" font-size="10" font-weight="800"
          fill="${col}" font-family="'Geist Mono',monospace">${dayStr}</text>
        <text x="26" y="35" text-anchor="middle" font-size="8"
          fill="var(--t3)" font-family="'Geist Mono',monospace">days</text>
      </svg>
      <div class="mh-xinfo">
        <div class="mh-xname">${esc(x.subj||x.name||'Exam')}</div>
        <div class="mh-xdate">${x.date}${x.room?' · '+x.room:''}</div>
      </div>
    </div>`;
  }).join('');
}

function mhRenderTodayEvs(){
  // Now merged into calendar tile day strip — no separate render needed
}

function mhTogR(id){
  togRem(id);
  mhRenderRems();
  // Tick animation
  setTimeout(()=>{
    const checks=document.querySelectorAll('.mh-rcheck');
    checks.forEach(c=>{c.classList.add('ticked');setTimeout(()=>c.classList.remove('ticked'),300);});
  },10);
}
function mhTogH(id){
  togHW(id);
  mhRenderHW();
  setTimeout(()=>{
    const checks=document.querySelectorAll('.mh-hcheck');
    checks.forEach(c=>{c.classList.add('ticked');setTimeout(()=>c.classList.remove('ticked'),300);});
  },10);
}

/* ── QUICK-ADD FAB ───────────────────────────────────── */
function mhFabTap(){
  // If on hero panel, go to tiles
  if(_mhPage===0){mhGoTo(1);return;}
  // On tiles panel, toggle quick-add sheet
  const fab=document.getElementById('mh-quick-fab');
  const isOpen=document.getElementById('mh-bg').classList.contains('on');
  if(isOpen){
    mhClose();
    if(fab)fab.classList.remove('open');
  }else{
    mhOpen('rem');
    if(fab)fab.classList.add('open');
  }
}
// Reset FAB rotate when sheet closes
const _origMhClose=window.mhClose;

/* ── DRAG-TO-REORDER TILES ───────────────────────────── */
function mhDragSetup(){
  const container=document.querySelector('.mh-tiles');
  if(!container||container._dragSetup)return;
  container._dragSetup=true;
  let dragEl=null,holdTimer=null,startY=0,startIdx=0;

  function getTiles(){return [...container.querySelectorAll('.mh-tile')];}
  function getIdx(el){return getTiles().indexOf(el);}

  container.addEventListener('touchstart',e=>{
    const tile=e.target.closest('.mh-tile');
    if(!tile)return;
    // Don't trigger on interactive elements
    if(e.target.closest('button,.mh-rcheck,.mh-hcheck,.mh-tile-action,.mh-cal-nbtn'))return;
    startY=e.touches[0].clientY;
    holdTimer=setTimeout(()=>{
      dragEl=tile;
      startIdx=getIdx(tile);
      tile.classList.add('dragging','drag-ready');
      navigator.vibrate&&navigator.vibrate(10);
    },400);
  },{passive:true});

  container.addEventListener('touchmove',e=>{
    if(!dragEl){
      // Cancel hold if moved too much
      if(Math.abs(e.touches[0].clientY-startY)>8){clearTimeout(holdTimer);holdTimer=null;}
      return;
    }
    e.preventDefault();
    const y=e.touches[0].clientY;
    const tiles=getTiles();
    // Find which tile we're hovering over
    let target=null;
    tiles.forEach(t=>{
      if(t===dragEl)return;
      const r=t.getBoundingClientRect();
      if(y>r.top&&y<r.bottom){target=t;}
    });
    tiles.forEach(t=>t.classList.remove('drag-over'));
    if(target)target.classList.add('drag-over');
  },{passive:false});

  container.addEventListener('touchend',e=>{
    clearTimeout(holdTimer);holdTimer=null;
    if(!dragEl){return;}
    const y=e.changedTouches[0].clientY;
    const tiles=getTiles();
    let target=null;
    tiles.forEach(t=>{
      if(t===dragEl)return;
      const r=t.getBoundingClientRect();
      if(y>r.top&&y<r.bottom){target=t;}
    });
    tiles.forEach(t=>t.classList.remove('drag-over','dragging','drag-ready'));
    if(target){
      const targetIdx=getIdx(target);
      if(targetIdx>startIdx){
        container.insertBefore(dragEl,target.nextSibling);
      }else{
        container.insertBefore(dragEl,target);
      }
    }else{
      dragEl.classList.remove('dragging','drag-ready');
    }
    dragEl=null;
  });
}


function mhOpen(tab){
  _mhTab=tab||'rem';
  mhTab(_mhTab);
  document.getElementById('mh-bg').classList.add('on');
  document.getElementById('mh-sheet').classList.add('on');
  setTimeout(()=>{
    const p=document.getElementById('mh-p-'+_mhTab);
    const i=p&&p.querySelector('input[type="text"],input:not([type])');
    if(i)i.focus();
  },340);
}
function mhClose(){
  document.getElementById('mh-bg').classList.remove('on');
  document.getElementById('mh-sheet').classList.remove('on');
  const fab=document.getElementById('mh-quick-fab');
  if(fab)fab.classList.remove('open');
}
function mhTab(t){
  _mhTab=t;
  document.querySelectorAll('.mh-stab').forEach(b=>b.classList.remove('on'));
  document.querySelectorAll('.mh-spane').forEach(p=>p.classList.remove('on'));
  const tb=document.getElementById('mh-tab-'+t);if(tb)tb.classList.add('on');
  const pn=document.getElementById('mh-p-'+t);if(pn)pn.classList.add('on');
}

function mhSaveRem(){
  const text=document.getElementById('mh-ri').value.trim();if(!text)return;
  rems.unshift({id:Date.now(),text,pri:document.getElementById('mh-rp').value,subj:document.getElementById('mh-rs').value,done:false,ld:null});
  sv('st_r5',rems);document.getElementById('mh-ri').value='';
  mhClose();mhRenderRems();renderRems();showToast('Reminder added ✓');
}
function mhSaveHW(){
  const task=document.getElementById('mh-hi2').value.trim();if(!task)return;
  const subj=document.getElementById('mh-hs').value;
  const due=document.getElementById('mh-hd').value;
  const id=Date.now();
  hw.unshift({id,task,subj,due,link:'',done:false});sv('st_hw',hw);
  if(due){evs.push({id:id+1,name:`📚 ${task}`,date:due,time:'',note:subj,subj,hwId:id});evs.sort((a,b)=>a.date.localeCompare(b.date));sv('st_e5',evs);}
  document.getElementById('mh-hi2').value='';
  mhClose();mhRenderHW();renderHW();mhRenderCal();showToast('Homework added ✓');
}
function mhSaveEv(){
  const name=document.getElementById('mh-en').value.trim();
  const date=document.getElementById('mh-ed').value;
  if(!name||!date)return;
  evs.push({id:Date.now(),name,date,time:document.getElementById('mh-et').value,note:''});
  evs.sort((a,b)=>a.date.localeCompare(b.date));sv('st_e5',evs);
  document.getElementById('mh-en').value='';
  mhClose();mhRenderCal();mhRenderTodayEvs();showToast('Event added ✓');
}
function mhSaveEx(){
  const name=document.getElementById('mh-xn').value.trim();
  const date=document.getElementById('mh-xd').value;
  if(!name||!date)return;
  exams.push({id:Date.now(),subj:name,date,room:document.getElementById('mh-xt').value});
  exams.sort((a,b)=>a.date.localeCompare(b.date));sv('st_x5',exams);
  document.getElementById('mh-xn').value='';
  mhClose();mhRenderExams();showToast('Exam added ✓');
}

window.addEventListener('resize',()=>{if(window.innerWidth<=640)mhInit();});


// Keep mobile nav in sync when goTo is called from keyboard/other sources
const _origGoTo=goTo;
// (goTo is already defined; we patch the mni sync inside goTo via curPage update)
// Instead, sync after each goTo via a small wrapper
function syncMobileNav(){
  document.querySelectorAll('.mni').forEach(n=>{
    n.classList.toggle('act',n.dataset.page===curPage);
  });
}

// Swipe detection on page-stack
(function(){
  let tx=0,ty=0,swiping=false;
  const PGS=['dash','cal','tt','study','friends'];
  const stack=document.getElementById('page-stack');

  stack.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    tx=e.touches[0].clientX;
    ty=e.touches[0].clientY;
    swiping=true;
  },{passive:true});

  stack.addEventListener('touchmove',e=>{
    if(!swiping||e.touches.length!==1)return;
    const dx=e.touches[0].clientX-tx;
    const dy=e.touches[0].clientY-ty;
    // Only prevent default for horizontal swipes to avoid blocking vertical scroll
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>12){
      // Don't prevent — let it flow but track for touchend
    }
  },{passive:true});

  stack.addEventListener('touchend',e=>{
    if(!swiping)return;
    swiping=false;
    // Don't trigger desktop page swipes when mobile home is active
    if(document.getElementById('pg-mobile')?.classList.contains('act'))return;
    const dx=e.changedTouches[0].clientX-tx;
    const dy=e.changedTouches[0].clientY-ty;
    // Only trigger for predominantly horizontal swipes > 60px
    if(Math.abs(dx)<60||Math.abs(dx)<Math.abs(dy)*1.5)return;
    const idx=PGS.indexOf(curPage);
    if(dx<0&&idx<PGS.length-1){
      // Swipe left → next page
      const next=PGS[idx+1];
      const ni=document.querySelector(`.ni[data-page="${next}"]`);
      if(ni){goTo(next,ni);syncMobileNav();}
    }else if(dx>0&&idx>0){
      // Swipe right → previous page
      const prev=PGS[idx-1];
      const ni=document.querySelector(`.ni[data-page="${prev}"]`);
      if(ni){goTo(prev,ni);syncMobileNav();}
    }
  },{passive:true});
})();

/* ════ MAGIC LINK HANDLER ════════════════════════════════
   When Supabase redirects back after clicking the magic link,
   the access_token is in the URL hash. We grab it, store the
   session, then strip the hash so the URL looks clean.
════════════════════════════════════════════════════════ */
(function(){
  const hash=window.location.hash;
  if(hash&&hash.includes('access_token')){
    const params=new URLSearchParams(hash.replace(/^#/,''));
    const access_token=params.get('access_token');
    const refresh_token=params.get('refresh_token');
    const expires_at=params.get('expires_at');
    if(access_token){
      // Fetch user info then store session
      fetch('https://wbbiqcdmkmydwshzvize.supabase.co/auth/v1/user',{
        headers:{'apikey':SB_KEY,'Authorization':'Bearer '+access_token}
      }).then(r=>r.json()).then(user=>{
        const sess={access_token,refresh_token,expires_at,user};
        localStorage.setItem('sb_session',JSON.stringify(sess));
        // Clean the URL
        history.replaceState(null,'',window.location.pathname);
      }).catch(()=>{
        history.replaceState(null,'',window.location.pathname);
      });
    }
  }
})();

/* ════ INIT ═════════════════════════════════════════════ */
(function(){
  const done=localStorage.getItem(OB_KEY);
  if(done){
    document.getElementById('onboard').style.display='none';
    const savedName=localStorage.getItem('st_name');
    const savedICS=localStorage.getItem('st_ics');
    applyName(savedName||'');
    apply12hTime(use12hTime,true);
    if(nightMode)applyNight(true,false);
    if(savedICS){try{applyICS(JSON.parse(savedICS));}catch{}}
    else{populateSubjectDropdowns();}
    // On mobile, activate pg-mobile; on desktop, activate pg-dash
    if(window.innerWidth<=640){
      document.getElementById('pg-mobile').classList.add('act');
    }else{
      document.getElementById('pg-dash').classList.add('act');
    }
    tick();renderDash();renderTT();setupScroll();
    // Init custom dropdowns after all selects are in DOM
    cddInit();
    updateNotifBtn();
    applyFancyCursor(fancyCursor);
    stApplyCursorSize(); // Apply saved cursor size
    if(notifEnabled&&Notification.permission==='granted')scheduleNotifications();
    mhInit();
    sbGetSession().then(sess=>{
      if(sess?.access_token){
        sbAuthToken=sess.access_token;
        sbUserId=sess.user?.id;
        setSyncStatus(true,sess.user?.email);
        sbLoadAll().then(remote=>{
          if(remote&&Object.keys(remote).length>0){
            applyRemoteData(remote);
            renderDash();renderTT();renderRems();renderHW();
            cddSyncAll();
          }
        });
        sbStartAutoSync();
      }
    });
  }else{
    if(nightMode)applyNight(true,false);
    apply12hTime(use12hTime,true);
    setTimeout(()=>{document.getElementById('ob-name').focus();cddInit();},100);
  }
})();
