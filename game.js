import * as THREE from "three";

const canvas=document.querySelector("#view"), mapCanvas=document.querySelector("#map"), map=mapCanvas.getContext("2d");
const ui={overlay:document.querySelector("#overlay"),start:document.querySelector("#start"),pause:document.querySelector("#pause"),pausePanel:document.querySelector("#pausePanel"),resume:document.querySelector("#resume"),restart:document.querySelector("#restart"),endPanel:document.querySelector("#endPanel"),again:document.querySelector("#again"),endText:document.querySelector("#endText"),speed:document.querySelector("#speed"),battery:document.querySelector("#battery"),money:document.querySelector("#money"),mission:document.querySelector("#missionText"),sub:document.querySelector("#missionSub"),wanted:document.querySelector("#wanted"),clock:document.querySelector("#clock"),toast:document.querySelector("#toast")};
const renderer=new THREE.WebGLRenderer({canvas,antialias:true, powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xb8cbd0);scene.fog=new THREE.Fog(0xb8cbd0,90,330);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,700);
scene.add(new THREE.HemisphereLight(0xd9e9ff,0x65533b,2.0));
const sun=new THREE.DirectionalLight(0xffe2b1,2.5);sun.position.set(-70,110,55);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-140;sun.shadow.camera.right=140;sun.shadow.camera.top=140;sun.shadow.camera.bottom=-140;scene.add(sun);
const mat=(color,roughness=.88)=>new THREE.MeshStandardMaterial({color,roughness});
const M={asphalt:mat(0x343638),side:mat(0x8c887d),line:mat(0xd9d1b9),grass:mat(0x667c50),wall: [0xc6aa83,0xb2a38e,0xd0c7b2,0xa9b8b0,0xc6b2a5,0x9d9b91].map(c=>mat(c)),glass:mat(0x8db2b7,.25),yellow:mat(0xffc82e,.42),red:mat(0xa72d24),black:mat(0x17191a),white:mat(0xe8e5db),green:mat(0x39764a),skin:mat(0x986b4b),cloth:[0x365d8d,0x9b463b,0x64794a,0x6e536e,0xd3ad62].map(c=>mat(c))};
function box(parent,x,y,z,w,h,d,material,shadow=true){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.position.set(x,y,z);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),M.grass);ground.rotation.x=-Math.PI/2;ground.position.y=-.13;ground.receiveShadow=true;scene.add(ground);
const city=new THREE.Group();scene.add(city);
const GRID=7,STEP=34,ROAD=12,HALF=GRID*STEP/2;
const roads=[];
for(let i=-GRID;i<=GRID;i++){
 let p=i*STEP;
 let h=box(city,0,.005,p,GRID*STEP+ROAD,.12,ROAD,M.asphalt,false);h.receiveShadow=true;
 let v=box(city,p,.006,0,ROAD,.12,GRID*STEP+ROAD,M.asphalt,false);v.receiveShadow=true;
 roads.push({axis:"x",p},{axis:"z",p});
 for(let k=-GRID;k<GRID;k++){
  let c=(k+.5)*STEP;
  for(let side of [-1,1]){
   box(city,c,.08,p+side*(ROAD/2+.8),STEP,.16,1.2,M.side,false);
   box(city,p+side*(ROAD/2+.8),.08,c,1.2,.16,STEP,M.side,false);
  }
 }
}
// dashed lane dividers
for(let i=-GRID;i<=GRID;i++)for(let k=-GRID;k<GRID;k++){let p=i*STEP,c=(k+.5)*STEP;box(city,c,.075,p,4,.025,.12,M.line,false);box(city,p,.075,c,.12,.025,4,M.line,false)}
// city blocks: alleys, mixed-height buildings, shops, trees, poles
const obstacles=[];
for(let gx=-GRID;gx<GRID;gx++)for(let gz=-GRID;gz<GRID;gz++){
 const cx=(gx+.5)*STEP,cz=(gz+.5)*STEP;
 const bw=STEP-ROAD-5,bh=STEP-ROAD-5;
 const n=2+((gx*7+gz*11+50)%3+3)%3;
 for(let j=0;j<n;j++){
  const ox=cx+(Math.random()-.5)*7,oz=cz+(Math.random()-.5)*7;
  const w=5+Math.random()*7,d=5+Math.random()*7,h=5+Math.random()*24;
  const b=box(city,ox,h/2,oz,w,h,d,M.wall[Math.floor(Math.random()*M.wall.length)]);
  box(city,ox,h*.65,oz+d/2+.012,w*.8,.7,.08,M.glass,false);
  box(city,ox,h+.18,oz,w+.35,.35,d+.35,mat(0x665c50),false);
  obstacles.push({x:ox,z:oz,r:Math.max(w,d)*.53});
 }
 for(let t=0;t<3;t++){
  const x=cx+(Math.random()-.5)*15,z=cz+(Math.random()-.5)*15;
  const trunk=box(city,x,1.4,z,.45,2.8,.45,mat(0x765337),false);
  const crown=new THREE.Mesh(new THREE.SphereGeometry(1.9,8,7),mat(0x3e6943));crown.position.set(x,4,z);crown.castShadow=true;city.add(crown);
 }
}
// landmark market and station signs
for(let i=-GRID;i<=GRID;i+=2){let x=i*STEP;const sign=box(city,x,3,-HALF+5,8,1,.25,M.yellow,false);sign.position.y=3;}
// Selected major intersections: pedestrian crossings and working traffic signals
const signalPosts=[];
const signalRed=new THREE.MeshStandardMaterial({color:0x5a1714,emissive:0x260000});
const signalGreen=new THREE.MeshStandardMaterial({color:0x174d2a,emissive:0x00240b});
for(let ix=-GRID;ix<=GRID;ix+=3)for(let iz=-GRID;iz<=GRID;iz+=3){
 const x=ix*STEP,z=iz*STEP;
 // Zebra crossings on both approaches
 for(let n=0;n<5;n++){
  const off=-4+n*2;
  box(city,x+off,.09,z-ROAD/2-1.1,.85,.035,2.2,M.white,false);
  box(city,x+off,.09,z+ROAD/2+1.1,.85,.035,2.2,M.white,false);
  box(city,x-ROAD/2-1.1,.09,z+off,2.2,.035,.85,M.white,false);
  box(city,x+ROAD/2+1.1,.09,z+off,2.2,.035,.85,M.white,false);
 }
 const pole=box(city,x+5,2.4,z+5,.16,4.8,.16,M.black,false);
 const housing=box(city,x+5,4.6,z+5,.62,1.55,.42,M.black,false);
 const red=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),signalRed);red.position.set(x+5,5.05,z+4.77);city.add(red);
 const green=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),signalGreen);green.position.set(x+5,4.25,z+4.77);city.add(green);
 signalPosts.push({red,green,x,z});
}
// vehicle builders
function makeCng(){
 const g=new THREE.Group();const body=box(g,0,.82,0,1.85,1.15,2.65,M.green);box(g,0,1.58,-.12,1.75,.13,2.3,M.yellow);
 box(g,0,1.18,-.03,1.55,.72,1.75,M.glass);box(g,0,1.63,.92,1.8,.12,.3,M.yellow);
 box(g,0,.52,1.35,1.65,.12,.12,M.black);
 for(const x of [-.98,.98])for(const z of [-.85,.9]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.18,16),M.black);w.rotation.z=Math.PI/2;w.position.set(x,.4,z);g.add(w);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.19,12),M.white);hub.rotation.z=Math.PI/2;hub.position.set(x,.4,z);g.add(hub)}
 box(g,0,1.93,-.1,.12,.12,2.6,M.black,false);
 // Front fascia, lamps, mirrors and rear passenger step
 box(g,0,.83,1.37,1.55,.25,.12,M.black,false);
 box(g,0,.84,1.45,.62,.12,.035,M.white,false);
 for(const x of [-.66,.66]){
  box(g,x,1.08,1.36,.34,.22,.09,new THREE.MeshStandardMaterial({color:0xfff0bd,emissive:0xffd36b,emissiveIntensity:1.15}),false);
  box(g,x,1.05,-1.34,.28,.24,.08,new THREE.MeshStandardMaterial({color:0xc52d20,emissive:0x5b0804}),false);
  box(g,x*1.42,1.42,.48,.12,.12,.42,M.black,false);
  box(g,x*1.55,1.47,.62,.2,.13,.23,M.glass,false);
  box(g,x,1.8,-.12,.08,.55,.08,M.black,false);
 }
 box(g,0,.42,-1.34,1.5,.16,.14,M.black,false);
 return g;
}
function makeCar(color=0x386b9a){
 const g=new THREE.Group(),paint=mat(color,.45);box(g,0,.65,0,2.05,.7,4,paint);box(g,0,1.2,-.25,1.7,.65,2.1,M.glass);box(g,0,.48,2.03,1.8,.2,.12,M.black);
 for(const x of [-1.06,1.06])for(const z of [-1.25,1.25]){let w=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.2,14),M.black);w.rotation.z=Math.PI/2;w.position.set(x,.38,z);g.add(w)}
 // Recognizable front/rear lighting and exterior details
 for(const x of [-.7,.7]){
  box(g,x,.83,2.04,.42,.2,.09,new THREE.MeshStandardMaterial({color:0xfff1cf,emissive:0xffd98a,emissiveIntensity:.9}),false);
  box(g,x,.82,-2.04,.42,.2,.09,new THREE.MeshStandardMaterial({color:0xc52b22,emissive:0x4b0804}),false);
  box(g,x*1.48,1.15,.25,.22,.13,.36,M.black,false);
  box(g,x*1.55,1.19,.3,.22,.12,.24,M.glass,false);
 }
 box(g,0,.57,2.045,.75,.22,.07,M.black,false);
 box(g,0,.43,-2.045,.9,.16,.07,M.black,false);
 return g;
}
function makePerson(color){
 const g=new THREE.Group();const torso=new THREE.Mesh(new THREE.CylinderGeometry(.22,.27,.8,8),M.cloth[Math.floor(Math.random()*M.cloth.length)]);torso.position.y=1.05;g.add(torso);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),M.skin);head.position.y=1.62;g.add(head);
 for(const x of [-.12,.12]){const leg=box(g,x,.43,0,.14,.65,.16,M.black,false);leg.rotation.z=(x<0?-.08:.08)}
 return g;
}
const player=makeCng();scene.add(player);player.position.set(0,0,0);
const traffic=[];
const colors=[0x245a85,0xc8a044,0x9b3c32,0x47765b,0xd6d0c4,0x6b536f];
for(let i=0;i<38;i++){
 const car=makeCar(colors[i%colors.length]);let axis=Math.random()<.5?"x":"z",lane=Math.random()<.5?-2.3:2.3,dir=Math.random()<.5?-1:1,line=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP;
 car.position.set(axis==="x"?Math.random()*GRID*STEP-HALF:line,0,axis==="z"?Math.random()*GRID*STEP-HALF:line);if(Math.hypot(car.position.x,car.position.z)<24)car.position[axis==="x"?"x":"z"]+=dir*28;
 car.rotation.y=axis==="x"?(dir>0?Math.PI/2:-Math.PI/2):(dir>0?0:Math.PI);
 scene.add(car);traffic.push({mesh:car,axis,lane,dir,line,speed:4+Math.random()*7,base:4+Math.random()*8});
}
const people=[];
for(let i=0;i<64;i++){
 const p=makePerson();let axis=Math.random()<.5?"x":"z",line=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP;
 p.position.set(axis==="x"?Math.random()*GRID*STEP-HALF:line,0,axis==="z"?Math.random()*GRID*STEP-HALF:line);p.position[axis==="x"?"z":"x"]+=Math.random()<.5?-(ROAD/2+1.8):(ROAD/2+1.8);scene.add(p);people.push({mesh:p,axis,line,dir:Math.random()<.5?1:-1,speed:.5+Math.random()*.7,phase:Math.random()*6});
}
const pickups=[];
for(let i=0;i<12;i++){let x=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP+5,z=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP+5;const ring=new THREE.Mesh(new THREE.TorusGeometry(1.3,.16,8,24),mat(0x6dff91));ring.rotation.x=Math.PI/2;ring.position.set(x,.35,z);scene.add(ring);pickups.push({mesh:ring,x,z,active:true})}
const destination=new THREE.Mesh(new THREE.TorusGeometry(2,.2,8,32),mat(0xffc82e));destination.rotation.x=Math.PI/2;destination.position.set(60,.3,60);scene.add(destination);
let routePath=[];
function buildRouteToObjective(){
 let tx=destination.position.x,tz=destination.position.z;
 if(state.mission!==1){
  const active=pickups.filter(p=>p.active);
  if(!active.length){routePath=[];return}
  active.sort((a,b)=>Math.hypot(a.x-player.position.x,a.z-player.position.z)-Math.hypot(b.x-player.position.x,b.z-player.position.z));
  tx=active[0].x;tz=active[0].z;
 }
 const sx=clamp(Math.round(player.position.x/STEP),-GRID,GRID),sz=clamp(Math.round(player.position.z/STEP),-GRID,GRID);
 const ex=clamp(Math.round(tx/STEP),-GRID,GRID),ez=clamp(Math.round(tz/STEP),-GRID,GRID);
 const key=(x,z)=>x+","+z,queue=[[sx,sz]],previous=new Map([[key(sx,sz),null]]);
 for(let i=0;i<queue.length;i++){
  const [x,z]=queue[i];if(x===ex&&z===ez)break;
  for(const [nx,nz] of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]]){
   if(nx < -GRID||nx > GRID||nz < -GRID||nz > GRID)continue;
   const k=key(nx,nz);if(previous.has(k))continue;
   previous.set(k,key(x,z));queue.push([nx,nz]);
  }
 }
 const end=key(ex,ez);if(!previous.has(end)){routePath=[];return}
 const reversed=[];let cursor=end;
 while(cursor){const [x,z]=cursor.split(",").map(Number);reversed.push({x:x*STEP,z:z*STEP});cursor=previous.get(cursor)}
 routePath=reversed.reverse();
 const distance=Math.max(0,routePath.length-1)*STEP+Math.hypot(player.position.x-sx*STEP,player.position.z-sz*STEP);
 ui.sub.textContent=ui.sub.textContent.split(" · রুট")[0]+" · রুট "+Math.round(distance)+" মিটার";
}

const state={running:false,paused:false,speed:0,yaw:0,battery:100,money:250,wanted:0,mission:0,passenger:false,time:8.5,toastTimer:0,trafficClock:0};
const keys={};const controls={left:false,right:false,throttle:false,brake:false,boost:false};
addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true;if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();if(e.key.toLowerCase()==="p")togglePause()});
addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
document.querySelectorAll("[data-control]").forEach(b=>{const k=b.dataset.control;const down=e=>{e.preventDefault();controls[k]=true};const up=e=>{e.preventDefault();controls[k]=false};b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);b.addEventListener("pointerleave",up)});
function toast(s){ui.toast.textContent=s;ui.toast.classList.add("show");state.toastTimer=2.4}
function setMission(){if(state.mission===0){ui.mission.textContent="যাত্রী খুঁজুন";ui.sub.textContent="সবুজ চিহ্নের কাছে অটো থামান"}else if(state.mission===1){ui.mission.textContent="যাত্রীকে গন্তব্যে পৌঁছান";ui.sub.textContent="হলুদ গন্তব্য চিহ্ন অনুসরণ করুন"}else{ui.mission.textContent="নতুন যাত্রী খুঁজুন";ui.sub.textContent="পরবর্তী যাত্রার জন্য সবুজ চিহ্নে যান"}buildRouteToObjective()}
function reset(){player.position.set(0,0,0);state.speed=0;state.yaw=0;player.rotation.y=0;state.battery=100;state.money=250;state.wanted=0;state.mission=0;state.passenger=false;pickups.forEach(p=>p.active=true);destination.position.set(60,.3,60);ui.endPanel.classList.add("hidden");setMission();updateHud()}
function start(){state.running=true;state.paused=false;ui.overlay.classList.add("hidden");ui.pausePanel.classList.add("hidden");reset();toast("যাত্রা শুরু! নিরাপদে চালান।")}
function togglePause(){if(!state.running)return;state.paused=!state.paused;ui.pausePanel.classList.toggle("hidden",!state.paused)}
ui.start.onclick=start;ui.pause.onclick=togglePause;ui.resume.onclick=()=>{state.paused=false;ui.pausePanel.classList.add("hidden")};ui.restart.onclick=()=>{reset();state.paused=false;ui.pausePanel.classList.add("hidden")};ui.again.onclick=()=>{reset();state.running=true;ui.endPanel.classList.add("hidden")};
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function nearestRoad(v){const x=Math.round(v.x/STEP)*STEP,z=Math.round(v.z/STEP)*STEP;return Math.min(Math.abs(v.x-x),Math.abs(v.z-z))}
function updatePlayer(dt){
 const forward=keys.w||keys.arrowup||controls.throttle,reverse=keys.s||keys.arrowdown||controls.brake,left=keys.a||keys.arrowleft||controls.left,right=keys.d||keys.arrowright||controls.right,boost=keys.shift||controls.boost;
 const throttle=forward?1:0,brake=reverse?1:0;
 const max=boost?23:15,acc=boost?14:9;
 if(throttle&&state.battery>0)state.speed=Math.min(max,state.speed+acc*dt);else if(brake)state.speed=Math.max(-4,state.speed-20*dt);else state.speed*=Math.exp(-.65*dt);
 if(boost&&throttle&&state.battery>0)state.battery=Math.max(0,state.battery-2.2*dt);else state.battery=Math.min(100,state.battery+.08*dt);
 const steer=(right?1:0)-(left?1:0),factor=clamp(Math.abs(state.speed)/5,0,1);
 state.yaw+=steer*1.65*factor*dt*(state.speed<0?-1:1);
 player.rotation.y=state.yaw;
 const old=player.position.clone();player.position.x+=Math.sin(state.yaw)*state.speed*dt;player.position.z+=Math.cos(state.yaw)*state.speed*dt;
 player.position.x=clamp(player.position.x,-HALF-12,HALF+12);player.position.z=clamp(player.position.z,-HALF-12,HALF+12);
 // soft collision response with vehicles and city blocks
 for(const t of traffic){const dx=player.position.x-t.mesh.position.x,dz=player.position.z-t.mesh.position.z;if(dx*dx+dz*dz<7.2){player.position.copy(old);state.speed*=-.22;state.wanted=clamp(state.wanted+1,0,5);toast("ধাক্কা লেগেছে — সাবধানে চালান");break}}
 for(const o of obstacles){const dx=player.position.x-o.x,dz=player.position.z-o.z;if(dx*dx+dz*dz<(o.r+1.1)**2){player.position.copy(old);state.speed*=.2;break}}
 if(state.wanted>0&&Math.random()<dt*.018)state.wanted=Math.max(0,state.wanted-.02);
}
function updateTraffic(dt){
 state.trafficClock=(state.trafficClock+dt)%40;
 const greenAxis=state.trafficClock<20?"x":"z";
 for(const sig of signalPosts){
  const greenX=greenAxis==="x";
  sig.red.material.color.setHex(greenX?0x5a1714:0xf02d20);
  sig.red.material.emissive.setHex(greenX?0x260000:0x8a0800);
  sig.green.material.color.setHex(greenX?0x31e66b:0x174d2a);
  sig.green.material.emissive.setHex(greenX?0x087a2a:0x00240b);
 }
 for(const t of traffic){
  const m=t.mesh,along=t.axis==="x"?"x":"z";let pos=m.position[along],target=t.base;
  // Same-lane car-following with a larger safe gap
  for(const q of traffic){
   if(q===t||q.axis!==t.axis||q.line!==t.line||q.dir!==t.dir)continue;
   const gap=(q.mesh.position[along]-pos)*t.dir;
   if(gap>0&&gap<16)target=Math.min(target,Math.max(0,q.speed-(16-gap)*.85));
  }
  // Synchronized signal phases: north/south and east/west traffic alternate
  const junction=t.dir>0?(Math.floor(pos/STEP)+1)*STEP:(Math.ceil(pos/STEP)-1)*STEP;
  const distance=(junction-pos)*t.dir;
  if(t.axis!==greenAxis&&distance>0&&distance<12)target=Math.min(target,Math.max(0,(distance-4)*1.25));
  const pdx=player.position.x-m.position.x,pdz=player.position.z-m.position.z;
  if(pdx*pdx+pdz*pdz<100)target=Math.min(target,Math.max(0,Math.sqrt(pdx*pdx+pdz*pdz)-5));
  t.speed+=clamp(target-t.speed,-12*dt,5*dt);
  m.position[along]+=t.dir*t.speed*dt;
  if(Math.abs(m.position[along])>HALF+20){m.position[along]=-t.dir*(HALF+15);t.base=4+Math.random()*9;t.speed=Math.min(t.speed,5)}
  const cross=t.axis==="x"?"z":"x";m.position[cross]=t.line+t.lane;
 }
}
function updatePeople(dt){for(const p of people){const m=p.mesh;m.position[p.axis==="x"?"x":"z"]+=p.dir*p.speed*dt;if(Math.abs(m.position[p.axis==="x"?"x":"z"])>HALF+10)m.position[p.axis==="x"?"x":"z"]=-p.dir*(HALF+8);const near=Math.hypot(m.position.x-player.position.x,m.position.z-player.position.z);if(near<4)m.position[p.axis==="x"?"x":"z"]-=p.dir*p.speed*dt*1.5;}}
function updateMissions(dt){
 state.routeTimer=(state.routeTimer||0)+dt;if(state.routeTimer>2){state.routeTimer=0;buildRouteToObjective()}
 for(const p of pickups){if(!p.active)continue;p.mesh.rotation.z+=dt*.7;p.mesh.position.y=.35+Math.sin(performance.now()*.002)*.15;const d=Math.hypot(player.position.x-p.x,player.position.z-p.z);if(d<4&&Math.abs(state.speed)<3){p.active=false;p.mesh.visible=false;state.passenger=true;state.mission=1;const a=Math.floor(Math.random()*GRID*2-GRID),b=Math.floor(Math.random()*GRID*2-GRID);destination.position.set(a*STEP,.3,b*STEP);toast("যাত্রী উঠেছেন। গন্তব্যে যান।");setMission();break}}
 if(state.mission===1){destination.rotation.z+=dt*.5;const d=Math.hypot(player.position.x-destination.position.x,player.position.z-destination.position.z);if(d<5&&Math.abs(state.speed)<3){state.passenger=false;state.mission=2;state.money+=80+Math.round(Math.random()*80);toast("যাত্রা সম্পন্ন! ভাড়া যোগ হয়েছে।");const p=pickups.find(x=>!x.active);if(p){p.active=true;p.mesh.visible=true}setMission()}}
}
function updateHud(){ui.speed.textContent=String(Math.round(Math.abs(state.speed)*3.6)).replace(/\d/g,d=>"০১২৩৪৫৬৭৮৯"[d]);ui.battery.textContent=Math.round(state.battery);ui.money.textContent=state.money;ui.wanted.textContent="● ".repeat(state.wanted)+"○ ".repeat(5-state.wanted)}
function drawMap(){map.clearRect(0,0,180,180);map.fillStyle="#26352a";map.fillRect(0,0,180,180);map.strokeStyle="#b3aa8c";map.lineWidth=4;for(let i=-GRID;i<=GRID;i++){let p=90+i*STEP/(HALF*2)*180;map.beginPath();map.moveTo(p,0);map.lineTo(p,180);map.moveTo(0,p);map.lineTo(180,p);map.stroke()}if(routePath.length){map.strokeStyle="#ffd45a";map.lineWidth=2.5;map.setLineDash([5,4]);map.beginPath();routePath.forEach((p,i)=>{const x=90+p.x/(HALF*2)*180,z=90+p.z/(HALF*2)*180;if(i===0)map.moveTo(x,z);else map.lineTo(x,z)});map.stroke();map.setLineDash([])}
 const px=90+player.position.x/(HALF*2)*180,pz=90+player.position.z/(HALF*2)*180;map.fillStyle="#ffca35";map.beginPath();map.arc(px,pz,4,0,Math.PI*2);map.fill();map.fillStyle="#71ff98";for(const p of pickups)if(p.active){map.beginPath();map.arc(90+p.x/(HALF*2)*180,90+p.z/(HALF*2)*180,2.5,0,Math.PI*2);map.fill()}}
function updateCamera(dt){const behind=new THREE.Vector3(-Math.sin(state.yaw)*10,6.2,-Math.cos(state.yaw)*10);const desired=player.position.clone().add(behind);camera.position.lerp(desired,1-Math.exp(-4*dt));camera.lookAt(player.position.x,1.2,player.position.z+Math.cos(state.yaw)*3)}
let last=performance.now(),frame=0;
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.04,(now-last)/1000||0);last=now;if(state.running&&!state.paused){updatePlayer(dt);updateTraffic(dt);updatePeople(dt);updateMissions(dt);state.time=(state.time+dt*.015)%24;ui.clock.textContent=String(Math.floor(state.time)).padStart(2,"0")+":"+String(Math.floor((state.time%1)*60)).padStart(2,"0");if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)ui.toast.classList.remove("show")}if(state.battery<=0&&state.speed>8)state.speed=8;updateHud();if(++frame%8===0)drawMap()}updateCamera(dt);renderer.render(scene,camera)}
requestAnimationFrame(loop);
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7))});
camera.position.set(0,8,-12);camera.lookAt(0,1,5);setMission();drawMap();updateHud();window.__GAME_READY__=true;
