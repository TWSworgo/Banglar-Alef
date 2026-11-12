import * as THREE from "three";

const canvas=document.querySelector("#view"), mapCanvas=document.querySelector("#map"), map=mapCanvas.getContext("2d");
const ui={overlay:document.querySelector("#overlay"),start:document.querySelector("#start"),pause:document.querySelector("#pause"),pausePanel:document.querySelector("#pausePanel"),resume:document.querySelector("#resume"),restart:document.querySelector("#restart"),endPanel:document.querySelector("#endPanel"),again:document.querySelector("#again"),endTitle:document.querySelector("#endTitle"),endText:document.querySelector("#endText"),finalLoss:document.querySelector("#finalLoss"),finalBest:document.querySelector("#finalBest"),finalCrashes:document.querySelector("#finalCrashes"),loss:document.querySelector("#loss"),combo:document.querySelector("#combo"),battery:document.querySelector("#battery"),batteryBar:document.querySelector("#batteryBar"),best:document.querySelector("#best"),anger:document.querySelector("#anger"),angerBar:document.querySelector("#angerBar"),hint:document.querySelector("#hint"),clock:document.querySelector("#clock"),toast:document.querySelector("#toast"),behind:document.querySelector("#behind"),horn:document.querySelector("#horn"),bomb:document.querySelector("#bomb"),camera:document.querySelector("#camera")};
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
const chargers=[];
for(let i=0;i<9;i++){
 const x=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP+4.6,z=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP;
 const pad=box(city,x,.13,z,4,.18,2.4,mat(0x277e56),false);
 const post=box(city,x+2.1,1,z,.3,2,.3,M.yellow,false);
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8),new THREE.MeshStandardMaterial({color:0x75ff9a,emissive:0x1b8b43}));lamp.position.set(x+2.1,2.1,z);city.add(lamp);
 chargers.push({x,z,pad,lamp,cooldown:0});
}
const chasers=[];
let cameraMode=0;
const cameraOffsets=[new THREE.Vector3(0,6.2,-10),new THREE.Vector3(0,2.7,-3.8),new THREE.Vector3(0,12,-17)];
const state={running:false,paused:false,over:false,speed:0,yaw:0,battery:100,loss:0,best:Number(localStorage.getItem("ba_best")||0),anger:0,combo:1,comboTimer:0,crashes:0,time:8.5,toastTimer:0,trafficClock:0,hornCooldown:0,bombCooldown:0,collisionCooldown:0,chargeTimer:0,shake:0,gameOverReason:"",routeTimer:0};
const keys={};const controls={left:false,right:false,throttle:false,brake:false,boost:false};
addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true;if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();if(e.key.toLowerCase()==="p")togglePause();if(e.key.toLowerCase()==="h")horn();if(e.key.toLowerCase()==="x")soundBomb();if(e.key.toLowerCase()==="c")cycleCamera()});
addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
document.querySelectorAll("[data-control]").forEach(b=>{const k=b.dataset.control;const down=e=>{e.preventDefault();controls[k]=true};const up=e=>{e.preventDefault();controls[k]=false};b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);b.addEventListener("pointerleave",up)});
function toast(s){ui.toast.textContent=s;ui.toast.classList.add("show");state.toastTimer=2.4}
function horn(){if(!state.running||state.paused||state.over||state.hornCooldown>0)return;state.hornCooldown=1.1;toast("পোঁ পোঁ! পথ ছাড়ুন!");for(const p of people){const d=Math.hypot(p.mesh.position.x-player.position.x,p.mesh.position.z-player.position.z);if(d<12)p.dir=Math.sign(p.mesh.position[p.axis==="x"?"x":"z"]-(p.axis==="x"?player.position.x:player.position.z))||p.dir}}
function soundBomb(){if(!state.running||state.paused||state.over||state.bombCooldown>0)return;state.bombCooldown=9;state.battery=Math.max(0,state.battery-7);state.anger=Math.max(0,state.anger-34);for(const c of chasers){c.stun=3.5;c.mesh.position.x+= (c.mesh.position.x-player.position.x)*.9;c.mesh.position.z+=(c.mesh.position.z-player.position.z)*.9}toast("শব্দবোমা! জনতা ছত্রভঙ্গ — চার্জ −৭%")}
function cycleCamera(){cameraMode=(cameraMode+1)%cameraOffsets.length;toast(["পেছনের ক্যামেরা","ড্রাইভার ভিউ","উপরের ক্যামেরা"][cameraMode])}
ui.horn.onclick=horn;ui.bomb.onclick=soundBomb;ui.camera.onclick=cycleCamera;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function nearestRoad(v){const x=Math.round(v.x/STEP)*STEP,z=Math.round(v.z/STEP)*STEP;return Math.min(Math.abs(v.x-x),Math.abs(v.z-z))}
function spawnChaser(){
 if(chasers.length>=12)return;
 let angle=Math.random()*Math.PI*2,dist=24+Math.random()*13;
 const p=makePerson(0);p.scale.setScalar(1.08);p.traverse(o=>{if(o.material&&o.material.color)o.material=o.material.clone()});
 p.position.set(clamp(player.position.x+Math.cos(angle)*dist,-HALF,HALF),0,clamp(player.position.z+Math.sin(angle)*dist,-HALF,HALF));scene.add(p);chasers.push({mesh:p,speed:2.5+Math.random()*1.2,stun:0});
}
function registerImpact(kind,amount){
 const now=performance.now();if(state.collisionCooldown>0)return;state.collisionCooldown=.62;state.crashes++;
 state.comboTimer=4.5;state.combo=Math.min(8,state.combo+1);
 const gain=Math.round(amount*state.combo);state.loss+=gain;state.anger=clamp(state.anger+(kind==="pedestrian"?24:14),0,100);state.shake=.35;
 state.speed*=kind==="pedestrian"?.18:.34;toast((kind==="pedestrian"?"পথচারীর সঙ্গে ধাক্কা! ":"গাড়িতে ধাক্কা! ")+"জাতীয় ক্ষতি +৳"+gain);
 if(state.anger>=22&&chasers.length<Math.ceil(state.anger/12))spawnChaser();
}
function updatePlayer(dt){
 const forward=keys.w||keys.arrowup||controls.throttle,reverse=keys.s||keys.arrowdown||controls.brake,left=keys.a||keys.arrowleft||controls.left,right=keys.d||keys.arrowright||controls.right,boost=keys.shift||controls.boost;
 if(forward&&state.battery>0)state.speed=Math.min(boost?25:17,state.speed+(boost?15:10)*dt);
 else if(reverse)state.speed=Math.max(-5,state.speed-22*dt);
 else state.speed*=Math.exp(-.7*dt);
 const steer=(right?1:0)-(left?1:0),factor=clamp(Math.abs(state.speed)/4,0,1);
 state.yaw+=steer*1.8*factor*dt*(state.speed<0?-1:1);player.rotation.y=state.yaw;
 const old=player.position.clone();player.position.x+=Math.sin(state.yaw)*state.speed*dt;player.position.z+=Math.cos(state.yaw)*state.speed*dt;
 player.position.x=clamp(player.position.x,-HALF-10,HALF+10);player.position.z=clamp(player.position.z,-HALF-10,HALF+10);
 if(Math.abs(state.speed)>1){
  const drain=(.12+Math.abs(state.speed)*.012+(boost?.65:0))*dt;state.battery=Math.max(0,state.battery-drain);
 }else state.battery=Math.min(100,state.battery+.015*dt);
 if(state.collisionCooldown>0)state.collisionCooldown-=dt;
 if(state.hornCooldown>0)state.hornCooldown-=dt;if(state.bombCooldown>0)state.bombCooldown-=dt;
 if(state.comboTimer>0)state.comboTimer-=dt;else state.combo=1;
 for(const t of traffic){const dx=player.position.x-t.mesh.position.x,dz=player.position.z-t.mesh.position.z;if(dx*dx+dz*dz<8.5){player.position.copy(old);registerImpact("vehicle",120+Math.round(Math.abs(state.speed)*8));break}}
 for(const o of obstacles){const dx=player.position.x-o.x,dz=player.position.z-o.z;if(dx*dx+dz*dz<(o.r+1.15)**2){player.position.copy(old);if(Math.abs(state.speed)>4)registerImpact("building",70);state.speed*=.2;break}}
 for(const p of people){const dx=player.position.x-p.mesh.position.x,dz=player.position.z-p.mesh.position.z;if(dx*dx+dz*dz<2.2&&Math.abs(state.speed)>5){registerImpact("pedestrian",220);break}}
 for(const c of chasers){const d=Math.hypot(player.position.x-c.mesh.position.x,player.position.z-c.mesh.position.z);if(d<2.3&&c.stun<=0){endGame("জনতা আপনাকে ধরে ফেলেছে!","পালানোর পথ বন্ধ হয়ে গেছে।");break}}
 for(const c of chargers){if(c.cooldown>0)c.cooldown-=dt;const d=Math.hypot(player.position.x-c.x,player.position.z-c.z);if(d<3.5&&c.cooldown<=0&&state.battery<96){state.battery=Math.min(100,state.battery+34);c.cooldown=22;toast("চার্জিং পয়েন্ট: ব্যাটারি +৩৪%")}}
 if(state.battery<=0&&Math.abs(state.speed)<.5){state.chargeTimer+=dt;if(state.chargeTimer>8)endGame("চার্জ শেষ!","অটো থেমে গেছে—কাছের চার্জিং পয়েন্ট খুঁজুন।")}else state.chargeTimer=0;
 if(state.anger>0)state.anger=Math.max(0,state.anger-dt*.8);
 if(state.anger>15&&chasers.length<Math.ceil(state.anger/13))spawnChaser();
 if(state.loss>state.best){state.best=state.loss;try{localStorage.setItem("ba_best",String(state.best))}catch{}}
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
function updateCrowd(dt){
 for(let i=chasers.length-1;i>=0;i--){const c=chasers[i];if(c.stun>0){c.stun-=dt;continue}
 const dx=player.position.x-c.mesh.position.x,dz=player.position.z-c.mesh.position.z,d=Math.hypot(dx,dz)||1;
 const speed=c.speed+(state.anger/100)*2.6;c.mesh.position.x+=dx/d*speed*dt;c.mesh.position.z+=dz/d*speed*dt;
 c.mesh.rotation.y=Math.atan2(dx,dz);
 if(d>HALF*1.5){scene.remove(c.mesh);chasers.splice(i,1)}
 }
}
function updateHud(){
 const bn=n=>Math.round(n).toString().replace(/\d/g,d=>"০১২৩৪৫৬৭৮৯"[d]);
 ui.loss.textContent="৳"+bn(state.loss);ui.combo.textContent="×"+bn(state.combo)+" কম্বো";ui.combo.classList.toggle("hidden",state.combo<2);
 ui.battery.textContent=bn(state.battery)+"%";ui.batteryBar.style.width=state.battery+"%";ui.batteryBar.style.background=state.battery<20?"#f15d45":"#72e69a";
 ui.best.textContent="৳"+bn(state.best);ui.anger.textContent=bn(state.anger)+"%";ui.angerBar.style.width=state.anger+"%";
 ui.behind.classList.toggle("hidden",state.anger<35||chasers.length===0);
 ui.hint.textContent=state.battery<20?"চার্জ কম! সবুজ চার্জিং পয়েন্ট খুঁজুন।":state.anger>35?"জনতা পেছনে! গতি বাড়ান বা শব্দবোমা ব্যবহার করুন।":"ট্রাফিকের ফাঁক দিয়ে চালান। ধাক্কায় বাড়বে জাতীয় ক্ষতি!";
}
function drawMap(){
 map.clearRect(0,0,180,180);map.fillStyle="#26352a";map.fillRect(0,0,180,180);map.strokeStyle="#b3aa8c";map.lineWidth=4;
 for(let i=-GRID;i<=GRID;i++){const p=90+i*STEP/(HALF*2)*180;map.beginPath();map.moveTo(p,0);map.lineTo(p,180);map.moveTo(0,p);map.lineTo(180,p);map.stroke()}
 map.fillStyle="#73f5a0";for(const c of chargers){map.beginPath();map.arc(90+c.x/(HALF*2)*180,90+c.z/(HALF*2)*180,2.5,0,Math.PI*2);map.fill()}
 map.fillStyle="#ff6b58";for(const c of chasers){map.beginPath();map.arc(90+c.mesh.position.x/(HALF*2)*180,90+c.mesh.position.z/(HALF*2)*180,3,0,Math.PI*2);map.fill()}
 const px=90+player.position.x/(HALF*2)*180,pz=90+player.position.z/(HALF*2)*180;map.fillStyle="#ffca35";map.beginPath();map.arc(px,pz,4,0,Math.PI*2);map.fill();
}
function endGame(title,reason){
 if(state.over)return;state.over=true;state.running=false;ui.endTitle.textContent=title;ui.endText.textContent=reason;
 ui.finalLoss.textContent="৳"+Math.round(state.loss);ui.finalBest.textContent="৳"+Math.round(state.best);ui.finalCrashes.textContent=String(state.crashes);
 ui.endPanel.classList.remove("hidden");
}

function updateHud(){ui.speed.textContent=String(Math.round(Math.abs(state.speed)*3.6)).replace(/\d/g,d=>"০১২৩৪৫৬৭৮৯"[d]);ui.battery.textContent=Math.round(state.battery);ui.money.textContent=state.money;ui.wanted.textContent="● ".repeat(state.wanted)+"○ ".repeat(5-state.wanted)}
function drawMap(){map.clearRect(0,0,180,180);map.fillStyle="#26352a";map.fillRect(0,0,180,180);map.strokeStyle="#b3aa8c";map.lineWidth=4;for(let i=-GRID;i<=GRID;i++){let p=90+i*STEP/(HALF*2)*180;map.beginPath();map.moveTo(p,0);map.lineTo(p,180);map.moveTo(0,p);map.lineTo(180,p);map.stroke()}if(routePath.length){map.strokeStyle="#ffd45a";map.lineWidth=2.5;map.setLineDash([5,4]);map.beginPath();routePath.forEach((p,i)=>{const x=90+p.x/(HALF*2)*180,z=90+p.z/(HALF*2)*180;if(i===0)map.moveTo(x,z);else map.lineTo(x,z)});map.stroke();map.setLineDash([])}
 const px=90+player.position.x/(HALF*2)*180,pz=90+player.position.z/(HALF*2)*180;map.fillStyle="#ffca35";map.beginPath();map.arc(px,pz,4,0,Math.PI*2);map.fill();map.fillStyle="#71ff98";for(const p of pickups)if(p.active){map.beginPath();map.arc(90+p.x/(HALF*2)*180,90+p.z/(HALF*2)*180,2.5,0,Math.PI*2);map.fill()}}
function updateCamera(dt){
 const off=cameraOffsets[cameraMode].clone().applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw);
 const desired=player.position.clone().add(off);camera.position.lerp(desired,1-Math.exp(-4.5*dt));
 camera.lookAt(player.position.x,1.1+(cameraMode===1?0.2:0),player.position.z+Math.cos(state.yaw)*2.2);
}
let last=performance.now(),frame=0;
function loop(now){
 requestAnimationFrame(loop);const dt=Math.min(.04,(now-last)/1000||0);last=now;
 if(state.running&&!state.paused&&!state.over){
  updatePlayer(dt);updateTraffic(dt);updatePeople(dt);updateCrowd(dt);
  state.time=(state.time+dt*.012)%24;
  const bn=n=>Math.floor(n).toString().padStart(2,"0");
  ui.clock.textContent=bn(Math.floor(state.time))+":"+bn(Math.floor((state.time%1)*60));
  if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)ui.toast.classList.remove("show")}
  updateHud();if(++frame%7===0)drawMap();
 }
 updateCamera(dt);renderer.render(scene,camera);
}
requestAnimationFrame(loop);
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7))});
camera.position.set(0,8,-12);camera.lookAt(0,1,5);drawMap();updateHud();window.__GAME_STATE__=state;window.__GAME_READY__=true;function reset(){
 player.position.set(0,0,0);state.speed=0;state.yaw=0;player.rotation.y=0;state.battery=100;state.loss=0;state.anger=0;state.combo=1;state.comboTimer=0;state.crashes=0;state.time=8.5;state.over=false;state.hornCooldown=0;state.bombCooldown=0;state.collisionCooldown=0;state.shake=0;
 chasers.forEach(c=>scene.remove(c.mesh));chasers.length=0;chargers.forEach(c=>c.cooldown=0);
 traffic.forEach((t,i)=>{const a=t.axis==="x"?"x":"z";t.mesh.position[a]=(i%2?1:-1)*(30+(i*19)%180);t.speed=t.base});
 ui.endPanel.classList.add("hidden");ui.pausePanel.classList.add("hidden");ui.behind.classList.add("hidden");updateHud();drawMap()
}
function start(){state.running=true;state.paused=false;reset();ui.overlay.classList.add("hidden");toast("ঢাকার রাস্তায় নেমে পড়ুন!")}
function togglePause(){if(!state.running||state.over)return;state.paused=!state.paused;ui.pausePanel.classList.toggle("hidden",!state.paused)}
ui.start.onclick=start;ui.pause.onclick=togglePause;ui.resume.onclick=()=>{state.paused=false;ui.pausePanel.classList.add("hidden")};ui.restart.onclick=()=>{reset();state.running=true;state.paused=false};ui.again.onclick=()=>{reset();state.running=true;ui.endPanel.classList.add("hidden")};

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
