import { CONFIG } from './config.js';

const canvas=document.querySelector('#game');
const ctx=canvas.getContext('2d');
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const TAU=Math.PI*2;
const MOTHER_X=600,MOTHER_Y=360;
const JELLY_VISUAL_SCALE=.68;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const SAVE_KEY='jellyfish-grove-stage-1-v1';
const NAMES=['小浮光','泡泡','月芽','米粒','桃桃','星糖','软云','珊珊'];
const STATE_TEXT={idle:'静静呼吸',wander:'在深海漫游',approach:'正前往栖息地',play:'玩得很开心',rest:'舒服地休息',react:'回应你的触摸',dragged:'被温柔托起',recover:'晃晃悠悠复位',extruding:'正从母体慢慢分离',born:'刚刚来到水母之森'};
const loadSprite=src=>{const image=new Image();image.src=src;return image;};
const ART={
  mother:loadSprite('./assets/mother-jelly-v1.png'),
  motherBell:loadSprite('./assets/mother-bell-v1.png'),
  motherTentacle:loadSprite('./assets/mother-tentacle-v1.png'),
  motherBead:loadSprite('./assets/mother-bead-strand-v1.png'),
  baby:loadSprite('./assets/baby-jelly-v1.png'),babySleep:loadSprite('./assets/baby-jelly-sleep-v1.png'),shell:loadSprite('./assets/shell-habitat-v1.png'),slide:loadSprite('./assets/jelly-slide-v1.png')
};
const spriteReady=image=>image.complete&&image.naturalWidth>0;

const state={
  glow:CONFIG.economy.startingGlow,
  lastSeen:Date.now(),
  tutorialDone:false,
  selectedId:null,
  birthGesture:null,
  platformBuilt:false,
  platformGesture:null,
  platformReveal:0,
  sound:false,
  habitats:{shell:{...CONFIG.habitats.shell,built:false,level:1,occupantId:null},slide:{...CONFIG.habitats.slide,built:false,level:1,occupantId:null}},
  jellies:[], particles:[], motes:[], nextId:1, glowAccumulator:0, particleAccumulator:0,
};

const camera={x:600,y:560,zoom:.7,targetX:600,targetY:560,targetZoom:.7};
let width=innerWidth,height=innerHeight,dpr=1,lastTime=performance.now(),toastTimer=null,autosave=0;
let pointer={down:false,id:null,sx:0,sy:0,lastX:0,lastY:0,moved:false,jelly:null,birth:null,platform:null,startedAt:0};
const motherElastic={stretch:0,velocity:0,tail:0,tailVelocity:0,focusX:0};

function createJelly(species='blue',x=rand(430,770),y=rand(620,900),born=false,size=1,birthAngle=Math.PI/2){
  const cfg=CONFIG.species[species];
  const adultScale=(species==='yellow'?.88:species==='pink'?.94:1)*size;
  const j={id:state.nextId++,name:NAMES[(state.nextId-2)%NAMES.length],species,personality:cfg.personality,x,y,vx:rand(-7,7),vy:rand(-4,4),targetX:x,targetY:y,state:born?'born':'wander',stateTime:born?2.5:rand(2,6),activityDuration:0,expression:'normal',mood:rand(.62,.9),squish:0,rotation:0,phase:rand(0,TAU),scale:adultScale,adultScale,habitatId:null,birth:born?1:0,birthAngle};
  state.jellies.push(j); return j;
}

function resetGame(){ createJelly('blue',525,780); }

function load(){
  try{
    const raw=localStorage.getItem(SAVE_KEY); if(!raw){resetGame();return;}
    const saved=JSON.parse(raw);
    state.glow=Number(saved.glow)||0; state.lastSeen=saved.lastSeen||Date.now(); state.tutorialDone=!!saved.tutorialDone;
    state.nextId=saved.nextId||1;
    for(const key of ['shell','slide']) if(saved.habitats?.[key]) Object.assign(state.habitats[key],saved.habitats[key],{occupantId:null});
    state.platformBuilt=saved.platformBuilt??Object.values(state.habitats).some(h=>h.built);
    state.platformReveal=state.platformBuilt?1:0;
    state.jellies=(saved.jellies||[]).map(j=>({...j,adultScale:j.adultScale||j.scale||1,vx:0,vy:0,state:'wander',stateTime:rand(2,5),habitatId:null,squish:0,birth:0}));
    if(!state.jellies.length) resetGame();
    const away=clamp((Date.now()-state.lastSeen)/1000,0,CONFIG.economy.offlineCapSeconds);
    const earned=away*glowRate(); state.glow+=earned;
    if(earned>1) setTimeout(()=>toast(`离开期间，水母之森收集了 ${Math.floor(earned)} 点浮光`),700);
  }catch(err){ console.warn('存档读取失败，将建立新的水母之森。',err); resetGame(); }
}

function save(){
  const safeJellies=state.jellies.map(({id,name,species,personality,x,y,phase,scale,adultScale,mood})=>({id,name,species,personality,x,y,phase,scale,adultScale,mood}));
  const habitats=Object.fromEntries(Object.entries(state.habitats).map(([k,h])=>[k,{built:h.built,level:h.level}]));
  localStorage.setItem(SAVE_KEY,JSON.stringify({glow:state.glow,lastSeen:Date.now(),tutorialDone:state.tutorialDone,nextId:state.nextId,platformBuilt:state.platformBuilt,habitats,jellies:safeJellies}));
}

function glowRate(){
  let rate=state.jellies.reduce((n,j)=>n+CONFIG.species[j.species].glow,0);
  for(const h of Object.values(state.habitats)) if(h.built&&h.occupantId) rate+=h.bonus*h.level;
  return rate;
}

function toast(text){ const el=$('#toast'); el.textContent=text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }

function updateUI(){
  $('#glow-value').textContent=Math.floor(state.glow).toLocaleString('zh-CN'); $('#rate-value').textContent=`${glowRate().toFixed(1)} / 秒`; $('#jelly-value').textContent=state.jellies.length;
  $$('.species-card').forEach(btn=>{
    const key=btn.dataset.species; const unlocked=key==='blue'||(key==='pink'&&state.habitats.shell.built)||(key==='yellow'&&state.habitats.slide.built);
    btn.classList.toggle('is-unlocked',unlocked);
    btn.classList.toggle('is-locked',!unlocked);
    btn.querySelector('b').textContent=unlocked?'母体已学会':key==='pink'?'贝壳解锁':'滑梯解锁';
  });
  $$('.build-card').forEach(btn=>{
    const h=state.habitats[btn.dataset.build]; btn.classList.toggle('is-built',h.built); btn.disabled=!state.platformBuilt||h.built||state.glow<h.cost;
    btn.querySelector('b').textContent=h.built?`LV.${h.level} · 已连接`:!state.platformBuilt?'先拉出平台':`${h.cost} ◆`;
  });
  const selected=state.jellies.find(j=>j.id===state.selectedId);
  if(selected){ const cfg=CONFIG.species[selected.species]; $('#inspector').classList.remove('is-hidden'); $('#inspect-species').textContent=`${cfg.label} · ${cfg.personality}`; $('#inspect-name').textContent=selected.name; $('#inspect-state').textContent=STATE_TEXT[selected.state]||'正在观察世界'; $('#mood-fill').style.width=`${selected.mood*100}%`; }
}

function build(type){
  const h=state.habitats[type]; if(h.built)return; if(!state.platformBuilt){toast('先抓住母水母中央的触须，向下拉出基础平台');return;} if(state.glow<h.cost){toast('浮光还不够，再陪小水母待一会儿吧');return;}
  state.glow-=h.cost; h.built=true; burst(h.x,h.y-20,type==='shell'?'#ffd2e8':'#a8e9ff',26); camera.targetX=h.x; camera.targetY=h.y; camera.targetZoom=.82;
  toast(`${h.label}已经从树干上生长出来了`); save(); updateUI();
}

function chooseBirthSpecies(){
  const unlocked=['blue'];
  if(state.habitats.shell.built)unlocked.push('pink');
  if(state.habitats.slide.built)unlocked.push('yellow');
  return unlocked[(state.nextId-1)%unlocked.length];
}

function motherSurfaceToward(x,y){
  const angle=clamp(Math.atan2(y-MOTHER_Y,x-MOTHER_X),-2.35,-.79);
  return{x:MOTHER_X+Math.cos(angle)*205,y:MOTHER_Y+Math.sin(angle)*220,angle};
}

function easeOut(t){return 1-Math.pow(1-clamp(t,0,1),3);}

function completeBirth(gesture){
  const endX=gesture.targetX??gesture.x,endY=gesture.targetY??gesture.y,dx=endX-gesture.startX,dy=endY-gesture.startY,dist=Math.hypot(dx,dy);
  if(dist<92||dy>-72||Math.abs(dx)>Math.abs(dy)*.9){state.birthGesture=null;toast('还差一点点——捏住伞盖顶部，向上拉长再松手');return;}
  if(state.glow<CONFIG.economy.reproductionCost){state.birthGesture=null;toast('浮光不够，柔软的胚光轻轻缩回了母体');return;}
  state.glow-=CONFIG.economy.reproductionCost;
  const size=clamp(.78+dist/360,.86,1.16);
  const birthAngle=Math.atan2(dy,dx);
  const anchor=motherSurfaceToward(endX,endY);
  const j=createJelly(gesture.species,anchor.x,anchor.y,true,size,birthAngle);
  Object.assign(j,{state:'extruding',birthAge:0,birthDuration:1.7,birthStartX:anchor.x,birthStartY:anchor.y,birthEndX:endX,birthEndY:endY,birth:1,vx:0,vy:0});
  state.selectedId=j.id;state.birthGesture=null;
  toast('松开了——它还在从母体里慢慢挤出来');updateUI();save();
}

function completePlatform(gesture){
  const endY=gesture.targetY??gesture.y;
  const pull=endY-gesture.startY;
  if(pull<145){
    state.platformGesture=null;
    toast('再向下拉长一些，触须才会记住这块空间');
    return;
  }
  state.platformBuilt=true;
  state.platformReveal=.08;
  state.platformGesture=null;
  burst(600,790,'#d7c7ff',34);
  burst(600,830,'#9fe8ff',24);
  camera.targetX=600;camera.targetY=610;camera.targetZoom=.78;
  toast('触须落下了——第一块柔软平台正在成形');
  save();updateUI();
}

function worldToScreen(x,y){return{x:(x-camera.x)*camera.zoom+width/2,y:(y-camera.y)*camera.zoom+height/2};}
function screenToWorld(x,y){return{x:(x-width/2)/camera.zoom+camera.x,y:(y-height/2)/camera.zoom+camera.y};}

function setView(x,y,z=camera.targetZoom){camera.targetX=x;camera.targetY=y;camera.targetZoom=clamp(z,.38,1.35);}
function clampCamera(){const halfW=width/(2*camera.targetZoom),halfH=height/(2*camera.targetZoom);camera.targetX=clamp(camera.targetX,Math.min(600,halfW-30),Math.max(600,CONFIG.world.width-halfW+30));camera.targetY=clamp(camera.targetY,Math.min(520,halfH-100),Math.max(520,CONFIG.world.height-halfH+120));}

function releaseHabitat(j){ if(j.habitatId&&state.habitats[j.habitatId]?.occupantId===j.id) state.habitats[j.habitatId].occupantId=null; j.habitatId=null; }
function chooseWanderTarget(j){
  const band=state.platformBuilt?(j.species==='yellow'?[660,1840]:j.species==='pink'?[600,1740]:[560,1900]):[520,1180]; j.targetX=clamp(j.x+rand(-240,240),220,980); j.targetY=clamp(j.y+rand(-230,230),band[0],band[1]);
}

function seek(j,tx,ty,speed,dt){const dx=tx-j.x,dy=ty-j.y,d=Math.hypot(dx,dy)||1;j.vx=lerp(j.vx,dx/d*speed,dt*1.6);j.vy=lerp(j.vy,dy/d*speed,dt*1.6);j.x+=j.vx*dt;j.y+=j.vy*dt;return d;}

function updateJelly(j,dt,t){
  const cfg=CONFIG.species[j.species]; j.phase+=dt*(j.species==='yellow'?2.2:1.4); j.squish=lerp(j.squish,0,dt*5); j.rotation=lerp(j.rotation,0,dt*2.5); j.stateTime-=dt;
  if(j.state==='dragged')return;
  if(j.state==='extruding'){
    j.birthAge+=dt;const p=clamp(j.birthAge/j.birthDuration,0,1),stretchT=clamp(p/.82,0,1),popT=clamp((p-.82)/.18,0,1),travel=easeOut(stretchT)*.78+easeOut(popT)*.22;
    const dx=j.birthEndX-j.birthStartX,dy=j.birthEndY-j.birthStartY,curve=Math.sin(p*Math.PI)*j.adultScale*9;
    j.x=j.birthStartX+dx*travel-dy/(Math.hypot(dx,dy)||1)*curve;j.y=j.birthStartY+dy*travel+dx/(Math.hypot(dx,dy)||1)*curve;j.scale=j.adultScale*(.56+.44*easeOut(p));j.squish=Math.sin(p*Math.PI)*.18;
    if(p>=1){j.state='born';j.stateTime=1.55;j.birth=1;j.vx=dx*.12;j.vy=dy*.08+8;burst(j.x,j.y,CONFIG.species[j.species].color,30);playBirthPop();toast(`啵——${j.name}断开了，正快速翻过身`);save();}return;
  }
  if(j.state==='born'){
    const adultScale=j.adultScale||(j.species==='yellow'?.88:j.species==='pink'?.94:1);
    j.birth=clamp(j.birth-dt*2.2,0,1); j.y+=48*dt; j.scale=lerp(j.scale,adultScale,dt*2);
    if(j.stateTime<=0){j.state='wander';j.stateTime=3;chooseWanderTarget(j);} return;
  }
  if(j.state==='react'){j.x+=j.vx*dt;j.y+=j.vy*dt;j.vx*=Math.pow(.95,dt*60);j.vy*=Math.pow(.95,dt*60);if(j.stateTime<=0){j.state='recover';j.stateTime=1.2;}return;}
  if(j.state==='recover'){j.x+=j.vx*dt;j.y+=j.vy*dt;j.vx*=Math.pow(.93,dt*60);j.vy=j.vy*Math.pow(.94,dt*60)+46*dt;j.y+=Math.sin(j.phase*4)*3*dt;if(j.stateTime<=0){j.expression='normal';j.state='wander';j.stateTime=rand(2,4);chooseWanderTarget(j);}return;}
  if(j.state==='approach'){
    const h=state.habitats[j.habitatId]; if(!h||!h.built){releaseHabitat(j);j.state='wander';chooseWanderTarget(j);return;}
    const d=seek(j,h.x+(h===state.habitats.slide?-74:-5),h.y-(h===state.habitats.slide?145:68),cfg.speed,dt); if(d<18){j.state=h===state.habitats.shell?'rest':'play';j.stateTime=h===state.habitats.shell?9:5.8;j.activityDuration=j.stateTime;j.expression=j.species==='pink'?'shy':'happy';} return;
  }
  if(j.state==='rest'){
    const h=state.habitats[j.habitatId]; if(!h){j.state='wander';return;} const age=j.activityDuration-j.stateTime,settle=clamp(age/1.2,0,1),wake=clamp((1.35-j.stateTime)/1.35,0,1);
    j.x=h.x-8+Math.sin(j.phase*.45)*3;j.y=h.y-60+settle*14-Math.sin(wake*Math.PI)*10;j.rotation=lerp(0,.18,settle)*(1-wake);j.squish=-.48*settle*(1-wake);j.expression=wake>.35?'happy':'sleep';
    if(j.stateTime<=0){releaseHabitat(j);j.expression='normal';j.state='recover';j.stateTime=1.15;j.vx=rand(-34,34);j.vy=-72;toast(`${j.name}睡醒了，精神满满地离开贝壳`);}return;
  }
  if(j.state==='play'){
    const h=state.habitats[j.habitatId]; if(!h){j.state='wander';return;} const age=j.activityDuration-j.stateTime,p=clamp(age/j.activityDuration,0,1),u=clamp(p/.78,0,1),land=clamp((p-.78)/.22,0,1);
    const omt=1-u,ax=h.x-74,ay=h.y-148,bx=h.x+4,by=h.y-137,cx=h.x+72,cy=h.y-72,dx=h.x+39,dy=h.y-24;
    j.x=omt*omt*omt*ax+3*omt*omt*u*bx+3*omt*u*u*cx+u*u*u*dx;j.y=omt*omt*omt*ay+3*omt*omt*u*by+3*omt*u*u*cy+u*u*u*dy;
    const tx=3*omt*omt*(bx-ax)+6*omt*u*(cx-bx)+3*u*u*(dx-cx),ty=3*omt*omt*(by-ay)+6*omt*u*(cy-by)+3*u*u*(dy-cy);j.rotation=Math.atan2(ty,tx)-Math.PI/2;
    j.squish=land>0?-.8*Math.sin(land*Math.PI):.52*Math.sin(u*Math.PI);j.expression='happy';
    if(j.stateTime<=0){releaseHabitat(j);j.expression='happy';j.state='recover';j.stateTime=1.35;j.squish=-.7;j.rotation=0;j.vx=65;j.vy=-115;burst(j.x,j.y,CONFIG.species[j.species].accent,16);toast(`${j.name}压扁又弹起来，完成了一次果冻滑行`);}return;
  }
  if(j.state==='idle'){j.x+=Math.sin(j.phase*.6)*3*dt;j.y+=Math.sin(j.phase)*4*dt;if(j.stateTime<=0){j.state='wander';j.stateTime=rand(3,7);chooseWanderTarget(j);}return;}
  if(j.state==='wander'){
    if(!Number.isFinite(j.targetX))chooseWanderTarget(j); const d=seek(j,j.targetX,j.targetY,cfg.speed,dt);
    if(d<18||j.stateTime<=0){
      const preferred=state.habitats[cfg.habitat];
      if(preferred?.built&&!preferred.occupantId&&Math.random()<.42){preferred.occupantId=j.id;j.habitatId=cfg.habitat;j.state='approach';j.stateTime=12;}
      else{j.state=Math.random()<.28?'idle':'wander';j.stateTime=rand(3,8);chooseWanderTarget(j);}
    }
  }
  j.x=clamp(j.x,140,1060);j.y=clamp(j.y,500,2180);
}

function separateJellies(){
  for(let i=0;i<state.jellies.length;i++)for(let k=i+1;k<state.jellies.length;k++){const a=state.jellies[i],b=state.jellies[k];if(['dragged','extruding'].includes(a.state)||['dragged','extruding'].includes(b.state))continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;if(d<64){const p=(64-d)*.025;a.x-=dx/d*p;b.x+=dx/d*p;a.y-=dy/d*p;b.y+=dy/d*p;}}
}

function spawnGlow(dt){
  state.particleAccumulator+=dt*glowRate()*.42;
  while(state.particleAccumulator>1){state.particleAccumulator--;const sources=state.jellies.filter(j=>j.state==='rest'||j.state==='play');const s=sources.length?sources[Math.floor(Math.random()*sources.length)]:state.jellies[Math.floor(Math.random()*state.jellies.length)];if(s)state.particles.push({x:s.x+rand(-12,12),y:s.y-rand(10,35),age:0,life:rand(7,12),phase:rand(0,TAU),size:rand(2.3,4.8),color:CONFIG.species[s.species].accent});}
}
function burst(x,y,color,count=18){for(let i=0;i<count;i++)state.motes.push({x,y,vx:rand(-75,75),vy:rand(-95,25),age:0,life:rand(.7,1.5),size:rand(1.5,4.5),color});}

function update(dt,t){
  camera.x=lerp(camera.x,camera.targetX,1-Math.pow(.002,dt));camera.y=lerp(camera.y,camera.targetY,1-Math.pow(.002,dt));camera.zoom=lerp(camera.zoom,camera.targetZoom,1-Math.pow(.002,dt));
  if(state.birthGesture){const g=state.birthGesture;g.vx+=(g.targetX-g.x)*72*dt;g.vy+=(g.targetY-g.y)*72*dt;const damping=Math.pow(.0008,dt);g.vx*=damping;g.vy*=damping;g.x+=g.vx*dt;g.y+=g.vy*dt;}
  const pull=state.birthGesture?clamp(Math.hypot(state.birthGesture.x-state.birthGesture.startX,state.birthGesture.y-state.birthGesture.startY)/145,0,1):0;
  motherElastic.velocity+=(pull-motherElastic.stretch)*82*dt;motherElastic.velocity*=Math.exp(-6.4*dt);motherElastic.stretch+=motherElastic.velocity*dt;motherElastic.stretch=clamp(motherElastic.stretch,-.18,1.08);
  const focusTarget=state.birthGesture?clamp((state.birthGesture.startX-MOTHER_X)/210,-.82,.82):0;motherElastic.focusX=lerp(motherElastic.focusX,focusTarget,1-Math.pow(.018,dt));
  motherElastic.tailVelocity+=(motherElastic.stretch-motherElastic.tail)*25*dt;motherElastic.tailVelocity*=Math.exp(-5.1*dt);motherElastic.tail+=motherElastic.tailVelocity*dt;motherElastic.tail=clamp(motherElastic.tail,-.14,1);
  if(state.platformGesture){const g=state.platformGesture;g.vx+=(g.targetX-g.x)*58*dt;g.vy+=(g.targetY-g.y)*58*dt;const damping=Math.pow(.0012,dt);g.vx*=damping;g.vy*=damping;g.x+=g.vx*dt;g.y+=g.vy*dt;}
  state.platformReveal=lerp(state.platformReveal,state.platformBuilt?1:0,1-Math.pow(.008,dt));
  const rate=glowRate();state.glow+=rate*dt;state.glowAccumulator+=rate*dt;spawnGlow(dt);
  for(const j of state.jellies)updateJelly(j,dt,t);separateJellies();
  state.particles=state.particles.filter(p=>{p.age+=dt;p.y-=dt*(34+p.age*1.5);p.x+=Math.sin(p.phase+p.age*.9)*8*dt;if(p.y<410){state.motes.push({...p,vx:rand(-20,20),vy:rand(-20,5),age:0,life:.9});return false;}return p.age<p.life;});
  state.motes=state.motes.filter(p=>{p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.97;p.vy*=.97;return p.age<p.life;});
  autosave+=dt;if(autosave>5){autosave=0;save();}updateUI();
}

function resize(){dpr=Math.min(devicePixelRatio||1,2);width=innerWidth;height=innerHeight;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;clampCamera();}

function pathStroke(points,color,widthPx,glow=0){ctx.save();ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length-2;i++){const xc=(points[i][0]+points[i+1][0])/2,yc=(points[i][1]+points[i+1][1])/2;ctx.quadraticCurveTo(points[i][0],points[i][1],xc,yc);}const n=points.length;ctx.quadraticCurveTo(points[n-2][0],points[n-2][1],points[n-1][0],points[n-1][1]);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.lineWidth=widthPx;if(glow){ctx.shadowBlur=glow;ctx.shadowColor=color;}ctx.stroke();ctx.restore();}

function drawBackground(t){
  const g=ctx.createLinearGradient(0,0,0,height);g.addColorStop(0,'#061b38');g.addColorStop(.46,'#07162c');g.addColorStop(1,'#020916');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
  ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<7;i++){const x=(i/6)*width+Math.sin(t*.05+i)*30;const rg=ctx.createLinearGradient(x,0,x+120,height);rg.addColorStop(0,'rgba(84,171,225,.10)');rg.addColorStop(.5,'rgba(50,121,180,.025)');rg.addColorStop(1,'transparent');ctx.fillStyle=rg;ctx.beginPath();ctx.moveTo(x-55,0);ctx.lineTo(x+55,0);ctx.lineTo(x+235,height);ctx.lineTo(x+80,height);ctx.closePath();ctx.fill();}ctx.restore();
  for(let i=0;i<80;i++){const sx=(i*193.7)%width,sy=((i*97.3+t*(3+i%4))% (height+80))-40,r=1+(i%3)*.45;ctx.fillStyle=`rgba(150,220,255,${.08+(i%5)*.025})`;ctx.beginPath();ctx.arc(sx,sy,r,0,TAU);ctx.fill();}
}

function drawGrove(t){
  const base=worldToScreen(0,0);ctx.save();ctx.translate(base.x,base.y);ctx.scale(camera.zoom,camera.zoom);
  const hasFinishedHabitat=Object.values(state.habitats).some(h=>h.built);drawFarSilhouettes(t);drawLifeTrunk(t);if(!hasFinishedHabitat)drawPlatformScene(t);drawMother(t);drawBirthGesture(t);drawHabitat(state.habitats.shell,t);drawHabitat(state.habitats.slide,t);drawExpansion(t);
  for(const p of state.particles)drawGlowParticle(p);for(const j of state.jellies)drawJelly(j,t);for(const p of state.motes)drawMote(p);ctx.restore();
}

function drawLifeTrunk(t){
  if(!state.platformBuilt)return;
  ctx.save();ctx.globalAlpha=clamp(state.platformReveal*1.35,0,1);ctx.beginPath();ctx.rect(0,0,CONFIG.world.width,lerp(820,CONFIG.world.height,state.platformReveal));ctx.clip();
  const sway=Math.sin(t*.34)*10,pulse=.68+.2*Math.sin(t*1.1);
  const main=[[MOTHER_X,MOTHER_Y+145],[585,MOTHER_Y+235],[615+sway,720],[575-sway*.4,1120],[612+sway*.3,1510],[588,1940],[600,2115]];
  pathStroke(main,'rgba(78,62,145,.68)',62,28);pathStroke(main,'rgba(166,205,255,.3)',36,20);pathStroke(main,'rgba(255,188,232,.18)',17,15);pathStroke(main,`rgba(236,244,255,${pulse})`,5,14);
  const branch=(h,side)=>{
    const y=h.y-34;pathStroke([[600,y-85],[600+side*54,y-52],[h.x-side*70,y-20],[h.x,y]],'rgba(79,65,144,.76)',45,19);pathStroke([[600,y-85],[600+side*54,y-52],[h.x-side*70,y-20],[h.x,y]],'rgba(180,222,255,.28)',22,12);pathStroke([[600,y-85],[600+side*54,y-52],[h.x-side*70,y-20],[h.x,y]],'rgba(235,245,255,.58)',4,9);
  };
  branch(state.habitats.shell,-1);branch(state.habitats.slide,1);
  for(let y=860;y<2050;y+=180){const x=595+Math.sin(y*.018+t*.55)*20;ctx.fillStyle='rgba(200,239,255,.72)';ctx.shadowBlur=13;ctx.shadowColor='#a9e4ff';ctx.beginPath();ctx.arc(x,y,2.5+(y/180)%2,0,TAU);ctx.fill();}
  ctx.restore();
}

function drawFarSilhouettes(t){
  ctx.save();ctx.globalAlpha=.18;ctx.fillStyle='#163b5a';for(const side of [-1,1])for(let i=0;i<5;i++){const x=600+side*(390+i*70),y=450+i*430;ctx.beginPath();ctx.ellipse(x,y,95+i*6,22,0,0,TAU);ctx.fill();pathStroke([[x,y],[x+side*12,y+90],[x-side*15,y+170]],'#18415e',9,0);}ctx.restore();
}

function traceSoftShape(points){
  const last=points[points.length-1],first=points[0];ctx.beginPath();ctx.moveTo((last.x+first.x)/2,(last.y+first.y)/2);
  for(let i=0;i<points.length;i++){const p=points[i],n=points[(i+1)%points.length];ctx.quadraticCurveTo(p.x,p.y,(p.x+n.x)/2,(p.y+n.y)/2);}ctx.closePath();
}

function drawElasticBell(image,t){
  const w=540,h=270,top=-220,bottom=top+h,slices=22,stretch=motherElastic.stretch,focus=motherElastic.focusX;
  ctx.save();ctx.scale(1+Math.max(0,stretch)*.025,1);ctx.shadowBlur=34;ctx.shadowColor='rgba(218,164,255,.6)';
  for(let i=0;i<slices;i++){
    const u=(i+.5)/slices,nx=u*2-1,influence=Math.exp(-Math.pow((nx-focus)/.34,2));
    const lift=stretch*76*influence+Math.sin(t*1.15+nx*2.4)*1.5;
    const squash=Math.max(0,-stretch)*20*(.35+.65*influence),sliceW=w/slices;
    const dx=-w/2+i*sliceW,dy=top-lift+squash,dh=bottom-dy;
    ctx.drawImage(image,i*image.naturalWidth/slices,0,image.naturalWidth/slices+1,image.naturalHeight,dx-1,dy,sliceW+2,dh);
  }
  ctx.restore();
}

function drawLayeredMother(t){
  const tail=motherElastic.tail;
  ctx.save();ctx.globalAlpha=.98;
  const tentacles=[[-78,46,48,184,-.055],[-39,45,54,214,.035],[0,42,62,238,-.02],[41,45,53,208,.04],[80,47,47,181,-.045]];
  for(let i=0;i<tentacles.length;i++){
    const [x,y,w,h,lean]=tentacles[i],sway=Math.sin(t*.86+i*1.23)*.04+tail*(i-2)*.018;
    ctx.save();ctx.translate(x,y);ctx.rotate(lean+sway);ctx.transform(1,0,Math.sin(t*.72+i)*.035,1,0,0);ctx.shadowBlur=18;ctx.shadowColor='rgba(170,177,255,.42)';ctx.drawImage(ART.motherTentacle,-w/2,0,w,h*(1+tail*.105));ctx.restore();
  }
  const beads=[[-205,48,34,126,-1],[-158,49,27,104,-1],[158,49,27,104,1],[205,48,34,126,1]];
  for(let i=0;i<beads.length;i++){
    const [x,y,w,h,side]=beads[i];ctx.save();ctx.translate(x,y);ctx.rotate(side*(.025*Math.sin(t*.7+i)+tail*.028));ctx.shadowBlur=14;ctx.shadowColor='rgba(250,166,231,.46)';ctx.drawImage(ART.motherBead,-w/2,0,w,h);ctx.restore();
  }
  ctx.restore();
  drawElasticBell(ART.motherBell,t);
  if(state.birthGesture){
    const g=state.birthGesture,dx=g.x-g.startX,dy=g.y-g.startY,pull=clamp(Math.hypot(dx,dy)/150,0,1),lx=g.startX-MOTHER_X,ly=g.startY-MOTHER_Y;
    const touch=ctx.createRadialGradient(lx,ly,2,lx,ly,42+pull*18);touch.addColorStop(0,'rgba(255,255,255,.72)');touch.addColorStop(.38,CONFIG.species[g.species].accent+'88');touch.addColorStop(1,'transparent');ctx.fillStyle=touch;ctx.beginPath();ctx.arc(lx,ly,50+pull*12,0,TAU);ctx.fill();
  }
}

function drawMotherCaption(){
  ctx.save();ctx.fillStyle='rgba(255,228,247,.88)';ctx.font='500 13px Inter, sans-serif';ctx.textAlign='center';ctx.fillText('母水母 · 浮光孕育区',MOTHER_X,MOTHER_Y-248);ctx.fillStyle='rgba(176,196,230,.7)';ctx.font='10px Inter, sans-serif';ctx.fillText(state.platformBuilt?'向上捏出生命 · 平台已连接':'伞盖孕育生命 · 中央触须生成场景',MOTHER_X,MOTHER_Y-230);ctx.restore();
}

function drawMother(t){
  const x=MOTHER_X,y=MOTHER_Y,pulse=1+Math.sin(t*.9)*.015;ctx.save();ctx.translate(x,y);ctx.scale(pulse,1/pulse);
  if(spriteReady(ART.motherBell)&&spriteReady(ART.motherTentacle)&&spriteReady(ART.motherBead)){
    drawLayeredMother(t);ctx.restore();
    if(state.platformGesture){const pull=state.platformGesture;pathStroke([[MOTHER_X,MOTHER_Y+142],[MOTHER_X-18,MOTHER_Y+218],[pull.x+16,pull.y-72],[pull.x,pull.y]],'rgba(188,205,255,.72)',38,22);pathStroke([[MOTHER_X,MOTHER_Y+142],[MOTHER_X-18,MOTHER_Y+218],[pull.x+16,pull.y-72],[pull.x,pull.y]],'rgba(255,220,242,.55)',15,12);}
    drawMotherCaption();return;
  }
  if(spriteReady(ART.mother)){
    const w=540,h=w*ART.mother.naturalHeight/ART.mother.naturalWidth;ctx.shadowBlur=36;ctx.shadowColor='rgba(218,164,255,.62)';ctx.drawImage(ART.mother,-w/2,-236,w,h);ctx.shadowBlur=0;ctx.restore();
    if(state.platformGesture){const pull=state.platformGesture;pathStroke([[MOTHER_X,MOTHER_Y+142],[MOTHER_X-18,MOTHER_Y+218],[pull.x+16,pull.y-72],[pull.x,pull.y]],'rgba(188,205,255,.72)',38,22);pathStroke([[MOTHER_X,MOTHER_Y+142],[MOTHER_X-18,MOTHER_Y+218],[pull.x+16,pull.y-72],[pull.x,pull.y]],'rgba(255,220,242,.55)',15,12);}drawMotherCaption();return;
  }
  const halo=ctx.createRadialGradient(0,-6,35,0,20,300);halo.addColorStop(0,'rgba(255,232,249,.5)');halo.addColorStop(.4,'rgba(196,151,255,.18)');halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,10,300,0,TAU);ctx.fill();
  const g=ctx.createRadialGradient(-82,-104,5,-8,-16,255);g.addColorStop(0,'#fffdfd');g.addColorStop(.16,'#ffdcec');g.addColorStop(.45,'#f3acd9');g.addColorStop(.72,'rgba(203,148,242,.94)');g.addColorStop(1,'rgba(114,105,224,.62)');ctx.fillStyle=g;ctx.shadowBlur=48;ctx.shadowColor='rgba(219,164,255,.82)';
  const extruding=state.jellies.find(j=>j.state==='extruding');const source=state.birthGesture||extruding;const px=source?(source.x??source.birthStartX)-x:0,py=source?(source.y??source.birthStartY)-y:0,pullAngle=source?Math.atan2(py,px):0;
  const pullDistance=state.birthGesture?Math.hypot(state.birthGesture.x-state.birthGesture.startX,state.birthGesture.y-state.birthGesture.startY):extruding?Math.hypot(extruding.x-extruding.birthStartX,extruding.y-extruding.birthStartY)*.42:0;const pull=clamp(pullDistance/150,0,1);
  const outline=[];for(let i=0;i<=34;i++){const u=i/34,bx=-250*Math.cos(Math.PI*u),by=48-238*Math.pow(Math.sin(Math.PI*u),.82);outline.push({x:bx,y:by});}for(let i=0;i<=24;i++){const u=i/24,bx=250*Math.cos(Math.PI*u),by=55+18*Math.sin(Math.PI*u)+10*(.5+.5*Math.cos(u*10*Math.PI));outline.push({x:bx,y:by});}
  for(const p of outline){const a=Math.atan2(p.y,p.x),diff=Math.atan2(Math.sin(a-pullAngle),Math.cos(a-pullAngle)),influence=Math.exp(-Math.pow(diff/.48,2)),indent=(1-pull)*-11,stretch=pull*68;const displacement=influence*(indent+stretch);p.x+=Math.cos(pullAngle)*displacement;p.y+=Math.sin(pullAngle)*displacement;const side=Math.abs(Math.sin(a-pullAngle));p.x+=Math.cos(a)*pull*9*side;p.y+=Math.sin(a)*pull*9*side;}
  traceSoftShape(outline);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle='rgba(130,102,255,.82)';ctx.lineWidth=3.2;ctx.stroke();
  ctx.save();traceSoftShape(outline);ctx.clip();
  const inner=ctx.createLinearGradient(0,-210,0,75);inner.addColorStop(0,'rgba(255,255,255,.12)');inner.addColorStop(.74,'rgba(255,183,220,.08)');inner.addColorStop(1,'rgba(255,248,225,.72)');ctx.fillStyle=inner;ctx.fillRect(-260,-220,520,310);
  for(let i=-5;i<=5;i++){ctx.strokeStyle=`rgba(${i%2?255:222},235,255,.18)`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(i*39,54);ctx.quadraticCurveTo(i*45,0,i*31,-150);ctx.stroke();}
  for(let i=0;i<18;i++){const sx=-190+(i*79)%380,sy=-150+(i*53)%160,twinkle=.45+.35*Math.sin(t*1.7+i);ctx.fillStyle=`rgba(255,255,248,${twinkle})`;ctx.beginPath();ctx.arc(sx,sy,1.5+(i%3)*.6,0,TAU);ctx.fill();}
  ctx.restore();
  const rim=ctx.createLinearGradient(0,32,0,78);rim.addColorStop(0,'rgba(255,251,235,.94)');rim.addColorStop(1,'rgba(255,216,236,.72)');ctx.fillStyle=rim;ctx.beginPath();ctx.moveTo(-232,42);for(let i=0;i<=10;i++){const px=-232+i*46.4,py=48+(i%2?13:2);ctx.quadraticCurveTo(px-23,py+9,px,py);}ctx.lineTo(232,70);ctx.lineTo(-232,70);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.83)';ctx.lineWidth=12;ctx.lineCap='round';ctx.beginPath();ctx.arc(-82,-94,92,3.55,4.72);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=5;ctx.beginPath();ctx.arc(-60,-68,138,3.48,4.15);ctx.stroke();
  drawMotherMark();
  if(state.birthGesture){const bg=state.birthGesture,dx=bg.x-bg.startX,dy=bg.y-bg.startY,pull=clamp(Math.hypot(dx,dy)/150,0,1);const lx=bg.startX-x,ly=bg.startY-y;const touch=ctx.createRadialGradient(lx,ly,2,lx,ly,48+pull*18);touch.addColorStop(0,'rgba(255,255,255,.7)');touch.addColorStop(.35,CONFIG.species[bg.species].accent+'88');touch.addColorStop(1,'transparent');ctx.fillStyle=touch;ctx.beginPath();ctx.arc(lx,ly,55+pull*12,0,TAU);ctx.fill();ctx.strokeStyle='rgba(255,245,255,.38)';ctx.lineWidth=3-pull;ctx.beginPath();ctx.ellipse(lx+dx*.035,ly+dy*.035,30+pull*10,18-pull*5,Math.atan2(dy,dx),0,TAU);ctx.stroke();}
  const faceX=source?px*pull*.035:0,faceY=source?py*pull*.035:0;ctx.fillStyle='#54458f';ctx.beginPath();ctx.ellipse(-42+faceX,2+faceY,7,10,0,0,TAU);ctx.ellipse(42+faceX,2+faceY,7,10,0,0,TAU);ctx.fill();ctx.strokeStyle='#6f4c9d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(faceX,7+faceY,22,.2*Math.PI,.8*Math.PI);ctx.stroke();
  ctx.fillStyle='rgba(255,153,205,.26)';ctx.beginPath();ctx.ellipse(-65+faceX,23+faceY,20,9,0,0,TAU);ctx.ellipse(65+faceX,23+faceY,20,9,0,0,TAU);ctx.fill();ctx.restore();
  drawMotherTentacles(t);
  drawMotherCaption();
}

function drawMotherMark(){
  ctx.save();ctx.translate(0,-118);ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=3.2;ctx.shadowBlur=10;ctx.shadowColor='rgba(255,255,255,.75)';
  for(let i=0;i<4;i++){ctx.save();ctx.rotate(i*Math.PI/2);ctx.beginPath();ctx.ellipse(0,-17,10,18,0,0,TAU);ctx.stroke();ctx.restore();}
  ctx.fillStyle='rgba(255,255,255,.82)';ctx.beginPath();ctx.arc(0,0,5,0,TAU);ctx.fill();ctx.restore();
}

function drawMotherTentacles(t){
  const platformPull=state.platformGesture;const reveal=state.platformReveal;
  ctx.save();ctx.lineCap='round';
  for(let i=-2;i<=2;i++){
    const startX=MOTHER_X+i*37,startY=MOTHER_Y+66;const isCenter=i===0;let endY=MOTHER_Y+188+Math.abs(i)*18;
    if(state.platformBuilt)endY=lerp(endY,MOTHER_Y+300,reveal);
    if(isCenter&&platformPull)endY=Math.max(endY,platformPull.y);
    const sway=Math.sin(t*.82+i*1.35)*16,lean=i*10,midY=(startY+endY)/2;
    const grad=ctx.createLinearGradient(startX,startY,startX,endY);grad.addColorStop(0,'rgba(239,244,255,.92)');grad.addColorStop(.5,'rgba(190,211,255,.76)');grad.addColorStop(1,'rgba(255,190,231,.72)');
    ctx.strokeStyle=grad;ctx.lineWidth=isCenter?23:17;ctx.shadowBlur=17;ctx.shadowColor='rgba(184,190,255,.56)';ctx.beginPath();ctx.moveTo(startX,startY);ctx.bezierCurveTo(startX+sway+lean*.2,startY+34,startX-sway,midY-24,startX+lean*.25,midY);ctx.bezierCurveTo(startX+sway+lean*.35,midY+30,startX-sway+lean,endY-30,startX+lean*.55+sway*.18,endY);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.42)';ctx.lineWidth=isCenter?5:3.5;ctx.shadowBlur=0;ctx.stroke();
  }
  for(const side of [-1,1])for(let i=0;i<2;i++){
    const sx=MOTHER_X+side*(174+i*43),sy=MOTHER_Y+57+i*3,ey=MOTHER_Y+146+i*34+Math.sin(t*.7+i)*5;
    ctx.strokeStyle='rgba(170,189,255,.72)';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(sx,sy);ctx.quadraticCurveTo(sx+side*8,(sy+ey)/2,sx,ey);ctx.stroke();
    const beadY=ey-4;const bead=ctx.createRadialGradient(sx-5,beadY-8,2,sx,beadY,19+i*4);bead.addColorStop(0,'#fff');bead.addColorStop(.32,'#ffd2ee');bead.addColorStop(.68,'#a8c8ff');bead.addColorStop(1,'rgba(186,112,239,.75)');ctx.fillStyle=bead;ctx.shadowBlur=15;ctx.shadowColor='#f2a9ed';ctx.beginPath();ctx.arc(sx,beadY,15+i*4,0,TAU);ctx.fill();ctx.fillStyle='#ffd090';ctx.beginPath();ctx.arc(sx,beadY+17+i*4,4,0,TAU);ctx.fill();ctx.shadowBlur=0;
  }
  if(!state.platformBuilt&&!platformPull){ctx.fillStyle='rgba(223,229,255,.76)';ctx.font='11px Inter';ctx.textAlign='center';ctx.fillText('抓住伞盖下方的中央主触手，向下拉',MOTHER_X,MOTHER_Y+242);}
  ctx.restore();
}

function drawBirthGesture(t){
  const g=state.birthGesture,extruding=state.jellies.find(j=>j.state==='extruding');if(!g&&!extruding)return;const cfg=CONFIG.species[(g||extruding).species];
  ctx.save();ctx.globalCompositeOperation='screen';
  if(extruding&&!g){
    const p=clamp(extruding.birthAge/extruding.birthDuration,0,1),popT=clamp((p-.82)/.18,0,1),alpha=1-easeOut(popT),dx=extruding.x-extruding.birthStartX,dy=extruding.y-extruding.birthStartY,wave=Math.sin(t*5+p*Math.PI)*10*(1-p);
    ctx.globalAlpha=alpha;ctx.strokeStyle=cfg.color+'aa';ctx.lineWidth=lerp(30,7,p);ctx.lineCap='round';ctx.shadowBlur=20;ctx.shadowColor=cfg.color;ctx.beginPath();ctx.moveTo(extruding.birthStartX,extruding.birthStartY);ctx.bezierCurveTo(extruding.birthStartX+dx*.22-dy*.04,extruding.birthStartY+dy*.22+dx*.04,extruding.x-dx*.28-dy/(Math.hypot(dx,dy)||1)*wave,extruding.y-dy*.28+dx/(Math.hypot(dx,dy)||1)*wave,extruding.x,extruding.y);ctx.stroke();
    ctx.strokeStyle='rgba(250,246,255,.32)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(extruding.birthStartX,extruding.birthStartY);ctx.quadraticCurveTo((extruding.birthStartX+extruding.x)/2-dy*.06,(extruding.birthStartY+extruding.y)/2+dx*.06,extruding.x,extruding.y);ctx.stroke();ctx.restore();return;
  }
  const dx=g.x-g.startX,dy=g.y-g.startY,dist=Math.hypot(dx,dy),progress=clamp(dist/130,0,1),angle=Math.atan2(g.y-MOTHER_Y,g.x-MOTHER_X);
  const anchorX=MOTHER_X+Math.cos(angle)*235,anchorY=MOTHER_Y+Math.sin(angle)*(Math.sin(angle)>0?78:210);
  const wobble=Math.sin(t*5.5)*8*progress;ctx.strokeStyle=cfg.color+'99';ctx.lineWidth=lerp(34,8,progress);ctx.lineCap='round';ctx.shadowBlur=18;ctx.shadowColor=cfg.color;ctx.beginPath();ctx.moveTo(anchorX,anchorY);ctx.bezierCurveTo(anchorX+dx*.16-dy/(dist||1)*wobble,anchorY+dy*.16+dx/(dist||1)*wobble,g.x-dx*.22+dy/(dist||1)*wobble,g.y-dy*.18-dx/(dist||1)*wobble,g.x,g.y);ctx.stroke();
  ctx.strokeStyle='rgba(245,239,255,.28)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(anchorX,anchorY);ctx.quadraticCurveTo((anchorX+g.x)/2-dy*.05,(anchorY+g.y)/2+dx*.05,g.x,g.y);ctx.stroke();
  const r=lerp(12,35,progress);const bud=ctx.createRadialGradient(g.x-r*.35,g.y-r*.4,2,g.x,g.y,r);bud.addColorStop(0,'#fff');bud.addColorStop(.35,cfg.accent);bud.addColorStop(1,cfg.color+'aa');ctx.fillStyle=bud;ctx.beginPath();ctx.ellipse(g.x,g.y,r,r*.78,angle,0,TAU);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle='rgba(244,250,255,.62)';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='rgba(231,247,255,.82)';ctx.font='10px Inter';ctx.textAlign='center';ctx.fillText(progress>.72?'松开 · 啵':'继续向外轻轻拉',g.x,g.y+r+24);
  ctx.restore();
}

function drawPlatformScene(t){
  const gesture=state.platformGesture;
  const pull=gesture?clamp((gesture.y-gesture.startY)/175,0,1):state.platformReveal;
  if(pull<=.001)return;
  const x=600,y=820;
  ctx.save();ctx.globalAlpha=clamp(pull*1.3,0,1);ctx.translate(x,y+(1-easeOut(pull))*90);ctx.scale(.72+.28*easeOut(pull),.4+.6*easeOut(pull));
  const halo=ctx.createRadialGradient(0,-20,10,0,10,380);halo.addColorStop(0,'rgba(240,207,255,.28)');halo.addColorStop(.55,'rgba(122,211,255,.16)');halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.beginPath();ctx.ellipse(0,0,380,160,0,0,TAU);ctx.fill();
  const top=ctx.createLinearGradient(0,-70,0,70);top.addColorStop(0,'rgba(233,222,255,.96)');top.addColorStop(.24,'rgba(147,188,238,.94)');top.addColorStop(.54,'rgba(101,124,205,.94)');top.addColorStop(1,'rgba(50,48,111,.96)');ctx.fillStyle=top;ctx.shadowBlur=28;ctx.shadowColor='rgba(111,195,255,.55)';
  ctx.beginPath();ctx.moveTo(-335,-18);ctx.bezierCurveTo(-260,-88,250,-88,335,-18);ctx.bezierCurveTo(270,45,166,65,0,90);ctx.bezierCurveTo(-168,66,-276,45,-335,-18);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(231,245,255,.62)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-330,-18);ctx.bezierCurveTo(-238,-83,250,-82,330,-18);ctx.stroke();
  ctx.fillStyle='rgba(156,198,245,.22)';for(let i=-5;i<=5;i++){ctx.beginPath();ctx.ellipse(i*54+Math.sin(i)*12,6+(i%2)*13,42,12,.08*i,0,TAU);ctx.fill();}
  drawPlatformCoral(-270,-44,-1,t);drawPlatformCoral(270,-38,1,t);
  ctx.restore();
  if(gesture){ctx.save();ctx.fillStyle='rgba(231,244,255,.88)';ctx.font='11px Inter';ctx.textAlign='center';ctx.fillText(pull>.78?'松开 · 让平台成形':'继续向下拉伸触须',gesture.x,gesture.y+34);ctx.restore();}
}

function drawPlatformCoral(x,y,side,t){
  ctx.save();ctx.translate(x,y);ctx.strokeStyle=side<0?'rgba(255,142,198,.86)':'rgba(119,218,255,.82)';ctx.lineWidth=15;ctx.lineCap='round';ctx.shadowBlur=14;ctx.shadowColor=ctx.strokeStyle;
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(i*side*12,38);ctx.quadraticCurveTo(side*(10+i*9),12-i*8,side*(18+i*14),-10-i*18);ctx.stroke();}
  ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,.2)';ctx.beginPath();ctx.arc(side*14,-10,5+Math.sin(t+Math.abs(x)*.01)*.8,0,TAU);ctx.fill();ctx.restore();
}

function drawPlatform(x,y,w=260){
  const g=ctx.createLinearGradient(x,y-25,x,y+50);g.addColorStop(0,'#86b7df');g.addColorStop(.18,'#585d9d');g.addColorStop(1,'#262750');ctx.fillStyle=g;ctx.shadowBlur=22;ctx.shadowColor='#6bbbe5';ctx.beginPath();ctx.moveTo(x-w/2,y);ctx.quadraticCurveTo(x,y-38,x+w/2,y);ctx.quadraticCurveTo(x+w*.38,y+48,x+w*.2,y+44);ctx.quadraticCurveTo(x,y+70,x-w*.22,y+43);ctx.quadraticCurveTo(x-w*.42,y+46,x-w/2,y);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(190,235,255,.35)';ctx.lineWidth=3;ctx.stroke();
}

function drawHabitat(h,t){
  if(!state.platformBuilt)return;
  if(!h.built){ctx.save();ctx.globalAlpha=.18;ctx.setLineDash([9,11]);ctx.strokeStyle='#9ecff0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(h.x,h.y,100,38,0,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(181,220,245,.65)';ctx.font='12px Inter';ctx.textAlign='center';ctx.fillText(`${h.label} · 等待生长`,h.x,h.y+70);ctx.restore();return;}
  ctx.save();
  const art=h===state.habitats.shell?ART.shell:ART.slide;
  if(spriteReady(art)){
    const w=h===state.habitats.shell?385:330,drawH=w*art.naturalHeight/art.naturalWidth,top=h===state.habitats.shell?h.y-275:h.y-270;ctx.shadowBlur=28;ctx.shadowColor=h===state.habitats.shell?'rgba(255,155,216,.42)':'rgba(144,205,255,.42)';ctx.drawImage(art,h.x-w/2,top,w,drawH);ctx.shadowBlur=0;ctx.fillStyle='rgba(239,247,255,.9)';ctx.font='500 12px Inter';ctx.textAlign='center';ctx.fillText(`${h.label} · LV.${h.level}`,h.x,h.y+104);ctx.fillStyle='rgba(165,203,229,.76)';ctx.font='10px Inter';ctx.fillText(h.occupantId?`使用中 · +${h.bonus}/秒`:`空闲 · 等待一只小水母`,h.x,h.y+123);ctx.restore();return;
  }
  drawPlatform(h.x,h.y+26,245);
  drawPlatformCoral(h.x-92,h.y-12,-1,t);drawPlatformCoral(h.x+90,h.y-8,1,t);
  if(h===state.habitats.shell){
    const g=ctx.createRadialGradient(h.x-30,h.y-82,8,h.x,h.y-58,125);g.addColorStop(0,'#fffdf1');g.addColorStop(.28,'#ffc7df');g.addColorStop(.66,'#d67bc2');g.addColorStop(1,'#72529a');ctx.fillStyle=g;ctx.shadowBlur=28;ctx.shadowColor='#ffc7df';ctx.beginPath();ctx.moveTo(h.x-105,h.y-2);ctx.quadraticCurveTo(h.x-94,h.y-150,h.x,h.y-160);ctx.quadraticCurveTo(h.x+94,h.y-150,h.x+105,h.y-2);ctx.quadraticCurveTo(h.x,h.y-72,h.x-105,h.y-2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,238,249,.68)';ctx.lineWidth=4;ctx.stroke();
    for(let i=-3;i<=3;i++){ctx.strokeStyle='rgba(255,235,244,.23)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(h.x,h.y-72);ctx.lineTo(h.x+i*31,h.y-14);ctx.stroke();}
    const cushion=ctx.createRadialGradient(h.x-22,h.y-28,4,h.x,h.y-18,78);cushion.addColorStop(0,'#fffef0');cushion.addColorStop(.45,'#ffe8cb');cushion.addColorStop(1,'#f1a8c6');ctx.fillStyle=cushion;ctx.beginPath();ctx.ellipse(h.x,h.y-13,75,24,0,0,TAU);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.62)';ctx.lineWidth=3;ctx.stroke();
  }else{
    pathStroke([[h.x-78,h.y-142],[h.x+2,h.y-130],[h.x+70,h.y-76],[h.x+38,h.y-18]],'rgba(206,112,208,.78)',76,28);pathStroke([[h.x-74,h.y-146],[h.x+1,h.y-132],[h.x+62,h.y-77],[h.x+34,h.y-24]],'rgba(150,225,255,.7)',48,20);pathStroke([[h.x-70,h.y-151],[h.x+1,h.y-137],[h.x+55,h.y-79],[h.x+30,h.y-29]],'rgba(255,206,238,.75)',19,14);pathStroke([[h.x-68,h.y-154],[h.x+1,h.y-140],[h.x+50,h.y-82],[h.x+27,h.y-33]],'rgba(255,255,255,.66)',5,10);
    ctx.fillStyle='#ff9fc6';for(let i=0;i<6;i++){const a=i/5*Math.PI;ctx.beginPath();ctx.arc(h.x-90+Math.cos(a)*40,h.y-15-Math.sin(a)*48,8+i%2*3,0,TAU);ctx.fill();}
  }
  ctx.fillStyle='rgba(223,243,255,.86)';ctx.font='500 12px Inter';ctx.textAlign='center';ctx.fillText(`${h.label} · LV.${h.level}`,h.x,h.y+88);ctx.fillStyle='rgba(143,187,215,.7)';ctx.font='10px Inter';ctx.fillText(h.occupantId?`使用中 · +${h.bonus}/秒`:`空闲 · 等待一只小水母`,h.x,h.y+107);ctx.restore();
}

function drawExpansion(t){if(!state.platformBuilt)return;const x=600,y=2115;ctx.save();const g=ctx.createRadialGradient(x,y,3,x,y,125);g.addColorStop(0,'rgba(190,238,255,.42)');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,125,0,TAU);ctx.fill();ctx.strokeStyle='rgba(161,216,246,.3)';ctx.setLineDash([6,10]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,52+Math.sin(t)*5,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(194,229,247,.7)';ctx.font='12px Inter';ctx.textAlign='center';ctx.fillText('深层生长点 · 地图继续向下',x,y+5);ctx.font='9px Inter';ctx.fillStyle='rgba(138,180,207,.56)';ctx.fillText('后续栖息地将沿生命主干从这里继续萌发',x,y+25);ctx.restore();}

function drawJelly(j,t){
  const cfg=CONFIG.species[j.species],selected=j.id===state.selectedId;ctx.save();ctx.translate(j.x,j.y);ctx.rotate(j.rotation);const breathe=1+Math.sin(j.phase)*.035;const sx=(1-j.squish*.26)*j.scale*breathe*JELLY_VISUAL_SCALE,sy=(1+j.squish*.24)*j.scale/breathe*JELLY_VISUAL_SCALE;ctx.scale(sx,sy);if(j.state==='extruding'||j.state==='born')ctx.rotate(((j.birthAngle??Math.PI/2)-Math.PI/2)*(j.state==='extruding'?1:j.birth));
  if(selected){ctx.strokeStyle='rgba(210,244,255,.64)';ctx.lineWidth=2;ctx.setLineDash([5,7]);ctx.beginPath();ctx.arc(0,-7,55,0,TAU);ctx.stroke();ctx.setLineDash([]);}
  const halo=ctx.createRadialGradient(0,-10,5,0,-10,70);halo.addColorStop(0,cfg.accent+'44');halo.addColorStop(1,'transparent');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,-10,70,0,TAU);ctx.fill();
  const babyArt=j.expression==='sleep'&&spriteReady(ART.babySleep)?ART.babySleep:ART.baby;
  if(spriteReady(babyArt)){ctx.save();ctx.filter=j.species==='blue'?'hue-rotate(250deg) saturate(.86) brightness(1.05)':j.species==='yellow'?'hue-rotate(90deg) saturate(1.06) brightness(1.06)':'none';ctx.shadowBlur=15;ctx.shadowColor=cfg.color;ctx.drawImage(babyArt,-62,-58,124,103);ctx.restore();ctx.restore();return;}
  const tentacleGrow=j.state==='extruding'?0:j.state==='born'?1-j.birth:1;ctx.globalAlpha=.25+.75*tentacleGrow;ctx.strokeStyle=cfg.color+'99';ctx.lineWidth=7;ctx.lineCap='round';for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*14,12);ctx.bezierCurveTo(i*18+Math.sin(j.phase+i)*9,12+22*tentacleGrow,i*11-Math.sin(j.phase*.8+i)*10,12+(38+Math.abs(i)*4)*tentacleGrow,i*13+Math.sin(j.phase*1.2+i)*9,12+(53+Math.abs(i)*5)*tentacleGrow);ctx.stroke();}ctx.globalAlpha=1;
  const g=ctx.createRadialGradient(-18,-31,2,0,-13,55);g.addColorStop(0,'#fff');g.addColorStop(.15,cfg.accent);g.addColorStop(.58,cfg.color);g.addColorStop(1,cfg.color+'88');ctx.fillStyle=g;ctx.shadowBlur=18;ctx.shadowColor=cfg.color;ctx.beginPath();ctx.moveTo(-52,5);ctx.quadraticCurveTo(-49,-62,0,-66);ctx.quadraticCurveTo(49,-62,52,5);ctx.quadraticCurveTo(37,18,22,7);ctx.quadraticCurveTo(8,23,-7,8);ctx.quadraticCurveTo(-23,22,-34,7);ctx.quadraticCurveTo(-43,14,-52,5);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(240,250,255,.58)';ctx.lineWidth=2;ctx.stroke();
  ctx.save();ctx.translate(0,-36);ctx.strokeStyle='rgba(255,255,255,.82)';ctx.lineWidth=2;for(let i=0;i<4;i++){ctx.save();ctx.rotate(i*Math.PI/2);ctx.beginPath();ctx.ellipse(0,-6,3.5,6,0,0,TAU);ctx.stroke();ctx.restore();}ctx.restore();
  ctx.fillStyle='rgba(52,55,95,.9)';const blink=Math.sin(j.phase*.17)> .985?1:.18;if(j.expression==='happy'){ctx.strokeStyle='rgba(52,55,95,.9)';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(-16,-15,5,.15*Math.PI,.85*Math.PI);ctx.arc(16,-15,5,.15*Math.PI,.85*Math.PI);ctx.stroke();}else if(j.expression==='sleep'){ctx.strokeStyle='rgba(52,55,95,.9)';ctx.lineWidth=2.8;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-22,-14);ctx.quadraticCurveTo(-16,-10,-10,-14);ctx.moveTo(10,-14);ctx.quadraticCurveTo(16,-10,22,-14);ctx.stroke();}else{ctx.beginPath();ctx.ellipse(-16,-14,3.5,4.8*blink,0,0,TAU);ctx.ellipse(16,-14,3.5,4.8*blink,0,0,TAU);ctx.fill();}
  ctx.strokeStyle='rgba(65,58,101,.86)';ctx.lineWidth=2.2;ctx.beginPath();if(j.expression==='shy'){ctx.arc(0,-4,8,.18*Math.PI,.82*Math.PI);}else{ctx.arc(0,-6,9,.2*Math.PI,.8*Math.PI);}ctx.stroke();
  if(j.species==='pink'){ctx.fillStyle='rgba(255,94,157,.28)';ctx.beginPath();ctx.ellipse(-29,-4,9,5,0,0,TAU);ctx.ellipse(29,-4,9,5,0,0,TAU);ctx.fill();}
  if(j.species==='yellow'){ctx.strokeStyle='rgba(255,249,210,.7)';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+i*TAU/5,px=Math.cos(a)*13,py=-30+Math.sin(a)*13;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.stroke();}
  ctx.restore();
}

function drawGlowParticle(p){const alpha=Math.min(1,p.age*2)*clamp((p.life-p.age)/1.8,0,1);ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=p.color;ctx.shadowBlur=18;ctx.shadowColor=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();ctx.restore();}
function drawMote(p){ctx.save();ctx.globalAlpha=clamp((p.life-p.age)/p.life,0,1);ctx.fillStyle=p.color;ctx.shadowBlur=10;ctx.shadowColor=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();ctx.restore();}

function render(t){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);drawBackground(t);drawGrove(t);}

function pickJelly(wx,wy){let best=null,dist=Infinity;for(const j of state.jellies){const d=Math.hypot(wx-j.x,wy-(j.y-7));if(d<45&&d<dist){best=j;dist=d;}}return best;}
function insideMother(wx,wy){const nx=(wx-MOTHER_X)/205,ny=(wy-(MOTHER_Y-105))/125;return nx*nx+ny*ny<1&&wy<MOTHER_Y-28;}
function insidePlatformTentacle(wx,wy){return !state.platformBuilt&&Math.abs(wx-MOTHER_X)<58&&wy>MOTHER_Y+60&&wy<MOTHER_Y+255;}
function nearestHabitat(wx,wy){let best=null,dist=Infinity;for(const [id,h] of Object.entries(state.habitats)){if(!h.built)continue;const d=Math.hypot(wx-h.x,wy-h.y);if(d<170&&d<dist){best={id,h};dist=d;}}return best;}

function reactJelly(j,wx){releaseHabitat(j);j.state='react';j.stateTime=j.species==='pink'?1.7:1.1;j.squish=1;j.expression=j.species==='pink'?'shy':'happy';const direction=j.x<wx?-1:1;j.vx=(j.species==='pink'?95:55)*direction;j.vy=-38;j.mood=clamp(j.mood+.04,0,1);burst(j.x,j.y-10,CONFIG.species[j.species].accent,12);toast(j.species==='pink'?`${j.name}害羞地躲开了`:`${j.name}软软地回弹了一下`);}

canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture(e.pointerId);const p=screenToWorld(e.clientX,e.clientY);let birth=null,platform=null,j=null;
  if(insidePlatformTentacle(p.x,p.y)){
    platform={startX:MOTHER_X,startY:MOTHER_Y+130,x:MOTHER_X,y:p.y,targetX:MOTHER_X,targetY:p.y,vx:0,vy:0};state.platformGesture=platform;toast('抓住触须了——保持向下拉，让它长成一块平台');
  }else if(insideMother(p.x,p.y)){
    birth={species:chooseBirthSpecies(),startX:p.x,startY:p.y,x:p.x,y:p.y,targetX:p.x,targetY:p.y,vx:0,vy:0};state.birthGesture=birth;toast('捏住伞盖顶部了——保持按住，慢慢向上拉出新生命');
  }else j=pickJelly(p.x,p.y);
  pointer={down:true,id:e.pointerId,sx:e.clientX,sy:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,jelly:j,birth,platform,startedAt:performance.now()};
  if(j){releaseHabitat(j);j.state='dragged';j.stateTime=0;state.selectedId=j.id;updateUI();}canvas.classList.add('is-dragging');
});
canvas.addEventListener('pointermove',e=>{
  if(!pointer.down||e.pointerId!==pointer.id)return;const dx=e.clientX-pointer.lastX,dy=e.clientY-pointer.lastY;if(Math.hypot(e.clientX-pointer.sx,e.clientY-pointer.sy)>5)pointer.moved=true;
  if(pointer.platform){const p=screenToWorld(e.clientX,e.clientY);pointer.platform.targetX=lerp(MOTHER_X,p.x,.16);pointer.platform.targetY=clamp(Math.max(pointer.platform.startY,p.y),pointer.platform.startY,795);}
  else if(pointer.birth){const p=screenToWorld(e.clientX,e.clientY),vx=clamp(p.x-pointer.birth.startX,-95,95),vy=Math.min(-2,p.y-pointer.birth.startY),d=Math.hypot(vx,vy)||1,max=230,ratio=Math.min(1,max/d);pointer.birth.targetX=pointer.birth.startX+vx*ratio;pointer.birth.targetY=pointer.birth.startY+vy*ratio;}
  else if(pointer.jelly){const p=screenToWorld(e.clientX,e.clientY);pointer.jelly.x=p.x;pointer.jelly.y=p.y;pointer.jelly.squish=.35;pointer.jelly.rotation=clamp(dx*.018,-.28,.28);}
  else{camera.targetX-=dx/camera.zoom;camera.targetY-=dy/camera.zoom;clampCamera();}pointer.lastX=e.clientX;pointer.lastY=e.clientY;
});
function pointerUp(e){
  if(!pointer.down||e.pointerId!==pointer.id)return;const p=screenToWorld(e.clientX,e.clientY),j=pointer.jelly;
  if(pointer.platform)completePlatform(pointer.platform);
  else if(pointer.birth)completeBirth(pointer.birth);
  else if(j){const near=nearestHabitat(p.x,p.y);if(near&&!near.h.occupantId){near.h.occupantId=j.id;j.habitatId=near.id;j.state='approach';j.stateTime=10;j.targetX=near.h.x;j.targetY=near.h.y-68;toast(`${j.name}正游向${near.h.label}`);}else if(!pointer.moved){reactJelly(j,p.x);}else{j.state='recover';j.stateTime=1.2;j.vx=(e.clientX-pointer.lastX)*2;j.vy=(e.clientY-pointer.lastY)*2;}}
  pointer.down=false;pointer.jelly=null;pointer.birth=null;pointer.platform=null;canvas.classList.remove('is-dragging');save();
}
canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',()=>{state.birthGesture=null;state.platformGesture=null;pointer.down=false;pointer.jelly=null;pointer.birth=null;pointer.platform=null;canvas.classList.remove('is-dragging');});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(e.ctrlKey||e.metaKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)){const before=screenToWorld(e.clientX,e.clientY);camera.targetZoom=clamp(camera.targetZoom*Math.exp(-e.deltaY*.0015),.38,1.35);const after={x:(e.clientX-width/2)/camera.targetZoom+camera.targetX,y:(e.clientY-height/2)/camera.targetZoom+camera.targetY};camera.targetX+=before.x-after.x;camera.targetY+=before.y-after.y;}else{camera.targetY+=e.deltaY/camera.targetZoom;camera.targetX+=e.deltaX/camera.targetZoom;}clampCamera();},{passive:false});

$('#zoom-in').addEventListener('click',()=>{camera.targetZoom=clamp(camera.targetZoom*1.18,.38,1.35);clampCamera();});
$('#zoom-out').addEventListener('click',()=>{camera.targetZoom=clamp(camera.targetZoom/1.18,.38,1.35);clampCamera();});
$('#home-view').addEventListener('click',()=>setView(600,560,.7));
$('#close-inspector').addEventListener('click',()=>{state.selectedId=null;$('#inspector').classList.add('is-hidden');});
$$('.build-card').forEach(b=>b.addEventListener('click',()=>build(b.dataset.build)));

let audio=null;
function playBirthPop(){if(!state.sound||!audio)return;const now=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(220,now);osc.frequency.exponentialRampToValueAtTime(410,now+.11);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.055,now+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+.2);osc.connect(gain).connect(audio.destination);osc.start(now);osc.stop(now+.22);}
$('#sound-toggle').addEventListener('click',async e=>{
  state.sound=!state.sound;e.currentTarget.setAttribute('aria-pressed',String(state.sound));
  if(state.sound){audio ||= new (window.AudioContext||window.webkitAudioContext)();await audio.resume();const osc=audio.createOscillator(),gain=audio.createGain(),lfo=audio.createOscillator(),lfoGain=audio.createGain();osc.type='sine';osc.frequency.value=92;gain.gain.value=.018;lfo.frequency.value=.08;lfoGain.gain.value=12;lfo.connect(lfoGain).connect(osc.frequency);osc.connect(gain).connect(audio.destination);osc.start();lfo.start();state.soundNodes={osc,gain,lfo};toast('深海环境音已开启');}else if(state.soundNodes){state.soundNodes.gain.gain.setTargetAtTime(0,audio.currentTime,.2);setTimeout(()=>{state.soundNodes?.osc.stop();state.soundNodes?.lfo.stop();state.soundNodes=null;},600);toast('深海环境音已关闭');}
});

const tutorial=[
  ['欢迎来到水母之森','母水母现在有一枚圆润发光的伞盖、豆豆眼和珠光触须。她会用自己的身体孕育幼体，也会亲手长出栖息平台。'],
  ['观察自由生活','小水母会自己漫游、休息和玩耍。轻点它，看它凹陷、回弹，再带着不同性格游开。'],
  ['先长出一块平台','抓住母水母中央的触须，向下缓慢拉长，达到提示后松开。触须会凝成一块与母体相连的基础平台。'],
  ['亲手捏出新的伙伴','在母水母伞盖顶部按住，垂直向上缓慢拉出并松开。出生与触手完全无关；触手只负责向下生长主干和栖息平台。']
];
let tutorialIndex=0;
function showTutorial(){if(state.tutorialDone){$('#tutorial').classList.add('is-hidden');return;}const [title,copy]=tutorial[tutorialIndex];$('#tutorial-title').textContent=title;$('#tutorial-copy').textContent=copy;$('#tutorial-count').textContent=`${tutorialIndex+1} / ${tutorial.length}`;$('#tutorial-next').textContent=tutorialIndex===tutorial.length-1?'开始照料':'继续';}
function endTutorial(){state.tutorialDone=true;$('#tutorial').classList.add('is-hidden');save();}
$('#tutorial-next').addEventListener('click',()=>{tutorialIndex++;if(tutorialIndex>=tutorial.length)endTutorial();else showTutorial();});$('#tutorial-skip').addEventListener('click',endTutorial);

window.addEventListener('resize',resize);window.addEventListener('beforeunload',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
load();resize();showTutorial();updateUI();
function loop(now){const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;update(dt,now/1000);render(now/1000);requestAnimationFrame(loop);}requestAnimationFrame(loop);
