import * as THREE from "three";

const $=id=>document.getElementById(id);
const canvas=$("view"), mapCanvas=$("map"), map=mapCanvas.getContext("2d");
const ui={overlay:$("overlay"),start:$("start"),pause:$("pause"),pausePanel:$("pausePanel"),resume:$("resume"),restart:$("restart"),endPanel:$("endPanel"),again:$("again"),endTitle:$("endTitle"),endText:$("endText"),finalScore:$("finalScore"),finalBest:$("finalBest"),finalCrashes:$("finalCrashes"),score:$("score"),speed:$("speed"),combo:$("combo"),battery:$("battery"),batteryBar:$("batteryBar"),best:$("best"),accidents:$("accidents"),accidentBar:$("accidentBar"),mission:$("mission"),missionSub:$("missionSub"),hint:$("hint"),clock:$("clock"),toast:$("toast"),horn:$("horn"),camera:$("camera"),quality:$("quality"),soundToggle:$("soundToggle")};
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xbacbd0);scene.fog=new THREE.Fog(0xbacbd0,105,360);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,800);
scene.add(new THREE.HemisphereLight(0xe1efff,0x66513b,1.9));
const sun=new THREE.DirectionalLight(0xffe4bb,2.4);sun.position.set(-70,110,55);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-150;sun.shadow.camera.right=150;sun.shadow.camera.top=150;sun.shadow.camera.bottom=-150;scene.add(sun);
const mat=(color,roughness=.88)=>new THREE.MeshStandardMaterial({color,roughness});
const M={
 asphalt:mat(0x343638),side:mat(0x918b7f),line:mat(0xe0d7bf),grass:mat(0x6b8052),black:mat(0x17191a),white:mat(0xe8e5db),
 glass:mat(0x8db2b7,.24),yellow:mat(0xffc82e,.42),red:mat(0xa72d24),green:mat(0x39764a),skin:mat(0x986b4b),
 walls:[0xc6aa83,0xb2a38e,0xd0c7b2,0xa9b8b0,0xc6b2a5,0x9d9b91].map(c=>mat(c)),
 clothes:[0x365d8d,0x9b463b,0x64794a,0x6e536e,0xd3ad62].map(c=>mat(c))
};
function box(parent,x,y,z,w,h,d,material,shadow=true){
 const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.position.set(x,y,z);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o;
}
const GRID=7,STEP=34,ROAD=12,HALF=GRID*STEP/2;
const ground=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),M.grass);ground.rotation.x=-Math.PI/2;ground.position.y=-.14;ground.receiveShadow=true;scene.add(ground);
const city=new THREE.Group();scene.add(city);const obstacles=[];
for(let i=-GRID;i<=GRID;i++){
 const p=i*STEP;
 box(city,0,.005,p,GRID*STEP+ROAD,.12,ROAD,M.asphalt,false);
 box(city,p,.006,0,ROAD,.12,GRID*STEP+ROAD,M.asphalt,false);
 for(let k=-GRID;k<GRID;k++){
  const c=(k+.5)*STEP;
  for(const side of [-1,1]){
   box(city,c,.08,p+side*(ROAD/2+.8),STEP,.16,1.2,M.side,false);
   box(city,p+side*(ROAD/2+.8),.08,c,1.2,.16,STEP,M.side,false);
  }
 }
}
for(let i=-GRID;i<=GRID;i++)for(let k=-GRID;k<GRID;k++){
 const p=i*STEP,c=(k+.5)*STEP;
 box(city,c,.075,p,4,.025,.12,M.line,false);box(city,p,.075,c,.12,.025,4,M.line,false);
}
// Dense low-rise city blocks with shopfronts, roofs, trees and roadside clutter
for(let gx=-GRID;gx<GRID;gx++)for(let gz=-GRID;gz<GRID;gz++){
 const cx=(gx+.5)*STEP,cz=(gz+.5)*STEP,n=2+Math.abs((gx*7+gz*11+50)%3);
 for(let j=0;j<n;j++){
  const ox=cx+(Math.random()-.5)*7,oz=cz+(Math.random()-.5)*7,w=5+Math.random()*7,d=5+Math.random()*7,h=5+Math.random()*24;
  box(city,ox,h/2,oz,w,h,d,M.walls[Math.floor(Math.random()*M.walls.length)]);
  for(let floor=1;floor<Math.floor(h/4);floor++){
   const wy=floor*3.3+.7;box(city,ox,wy,oz+d/2+.02,w*.7,.85,.07,M.glass,false);
  }
  box(city,ox,h+.18,oz,w+.35,.35,d+.35,mat(0x665c50),false);
  obstacles.push({x:ox,z:oz,r:Math.max(w,d)*.55});
 }
 for(let t=0;t<2;t++){
  const x=cx+(Math.random()-.5)*15,z=cz+(Math.random()-.5)*15;
  box(city,x,1.2,z,.42,2.4,.42,mat(0x765337),false);
  const crown=new THREE.Mesh(new THREE.SphereGeometry(1.65,8,7),mat(0x3e6943));crown.position.set(x,3.5,z);crown.castShadow=true;city.add(crown);
 }
}
function signTexture(label,bg){
 const c=document.createElement("canvas");c.width=512;c.height=128;const x=c.getContext("2d");
 x.fillStyle=bg;x.fillRect(0,0,512,128);x.strokeStyle="#f4dfaa";x.lineWidth=8;x.strokeRect(5,5,502,118);
 x.fillStyle="#fff8e7";x.font="bold 62px sans-serif";x.textAlign="center";x.textBaseline="middle";x.fillText(label,256,66);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide});
}
const shopNames=["চা-স্টল","মুদি দোকান","গ্যারেজ","ঢাকা শহর","হোটেল","ফার্মেসি"];
for(let i=-GRID;i<=GRID;i+=2){
 const sign=box(city,i*STEP,3,-HALF+5,8,1,.22,signTexture(shopNames[(i+GRID)%shopNames.length],"#8d3024"),false);sign.position.y=3;
}
// Zebra crossings and alternating traffic lights at larger junctions
const signals=[],redMat=new THREE.MeshStandardMaterial({color:0x5a1714,emissive:0x260000}),greenMat=new THREE.MeshStandardMaterial({color:0x174d2a,emissive:0x00240b});
for(let ix=-GRID;ix<=GRID;ix+=3)for(let iz=-GRID;iz<=GRID;iz+=3){
 const x=ix*STEP,z=iz*STEP;
 for(let n=0;n<5;n++){const off=-4+n*2;
  box(city,x+off,.09,z-ROAD/2-1.1,.85,.035,2.2,M.white,false);box(city,x+off,.09,z+ROAD/2+1.1,.85,.035,2.2,M.white,false);
  box(city,x-ROAD/2-1.1,.09,z+off,2.2,.035,.85,M.white,false);box(city,x+ROAD/2+1.1,.09,z+off,2.2,.035,.85,M.white,false);
 }
 box(city,x+5,2.4,z+5,.16,4.8,.16,M.black,false);box(city,x+5,4.6,z+5,.62,1.55,.42,M.black,false);
 const red=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),redMat);red.position.set(x+5,5.05,z+4.77);city.add(red);
 const green=new THREE.Mesh(new THREE.SphereGeometry(.19,10,8),greenMat);green.position.set(x+5,4.25,z+4.77);city.add(green);signals.push({red,green});
}
const streetLights=[],bulbMaterial=new THREE.MeshStandardMaterial({color:0xffd28a,emissive:0x000000});
for(let x=-GRID;x<=GRID;x+=2)for(let z=-GRID;z<=GRID;z+=2){
 const px=x*STEP+6,pz=z*STEP+6;box(city,px,3.2,pz,.16,6.4,.16,M.black,false);
 const bulb=new THREE.Mesh(new THREE.SphereGeometry(.24,10,8),bulbMaterial);bulb.position.set(px,6.55,pz);city.add(bulb);streetLights.push(bulb);
}
const dayColor=new THREE.Color(0xbacbd0),nightColor=new THREE.Color(0x101a31);
function updateLighting(){
 const phase=state.time/24*Math.PI*2-Math.PI/2,daylight=clamp((Math.sin(phase)+.16)/1.16,0,1);
 scene.background.copy(nightColor).lerp(dayColor,daylight);scene.fog.color.copy(scene.background);
 sun.intensity=.25+2.15*daylight;sun.position.set(-70,18+92*daylight,55);
 const night=1-daylight;bulbMaterial.emissive.setRGB(.95*night,.56*night,.18*night);
}
function makeCng(){
 const g=new THREE.Group();box(g,0,.82,0,1.85,1.15,2.65,M.green);box(g,0,1.58,-.12,1.75,.13,2.3,M.yellow);
 box(g,0,1.18,-.03,1.55,.72,1.75,M.glass);box(g,0,1.63,.92,1.8,.12,.3,M.yellow);
 box(g,0,.52,1.35,1.65,.12,.12,M.black);
 for(const x of [-.98,.98])for(const z of [-.85,.9]){
  const w=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.18,16),M.black);w.rotation.z=Math.PI/2;w.position.set(x,.4,z);g.add(w);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.19,12),M.white);hub.rotation.z=Math.PI/2;hub.position.set(x,.4,z);g.add(hub);
 }
 box(g,0,1.93,-.1,.12,.12,2.6,M.black,false);box(g,0,.83,1.37,1.55,.25,.12,M.black,false);
 for(const x of [-.66,.66]){
  box(g,x,1.08,1.36,.34,.22,.09,new THREE.MeshStandardMaterial({color:0xfff0bd,emissive:0xffd36b}),false);
  box(g,x,1.05,-1.34,.28,.24,.08,new THREE.MeshStandardMaterial({color:0xc52d20,emissive:0x5b0804}),false);
  box(g,x*1.42,1.42,.48,.12,.12,.42,M.black,false);box(g,x*1.55,1.47,.62,.2,.13,.23,M.glass,false);
 }
 return g;
}
function makeCar(color=0x386b9a){
 const g=new THREE.Group(),paint=mat(color,.45);box(g,0,.65,0,2.05,.7,4,paint);box(g,0,1.2,-.25,1.7,.65,2.1,M.glass);
 for(const x of [-1.06,1.06])for(const z of [-1.25,1.25]){
  const w=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.2,14),M.black);w.rotation.z=Math.PI/2;w.position.set(x,.38,z);g.add(w);
 }
 for(const x of [-.7,.7]){
  box(g,x,.83,2.04,.42,.2,.09,new THREE.MeshStandardMaterial({color:0xfff1cf,emissive:0xffd98a}),false);
  box(g,x,.82,-2.04,.42,.2,.09,new THREE.MeshStandardMaterial({color:0xc52b22,emissive:0x4b0804}),false);
 }
 return g;
}
function makePerson(){
 const g=new THREE.Group(),shirt=M.clothes[Math.floor(Math.random()*M.clothes.length)];
 const torso=new THREE.Mesh(new THREE.CylinderGeometry(.22,.27,.8,8),shirt);torso.position.y=1.05;g.add(torso);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),M.skin);head.position.y=1.62;g.add(head);
 for(const x of [-.12,.12]){const leg=box(g,x,.43,0,.14,.65,.16,M.black,false);leg.rotation.z=x<0?-.08:.08}
 return g;
}
const player=makeCng();scene.add(player);player.position.set(0,0,0);
const traffic=[],trafficColors=[0x245a85,0xc8a044,0x9b3c32,0x47765b,0xd6d0c4,0x6b536f];
for(let i=0;i<54;i++){
 let car,kind="car";const variant=i%9;
 if(variant===0){car=makeCar(0xc4c1b8);car.scale.set(1.32,1.18,1.72);box(car,0,1.65,-.2,1.8,.72,2.65,mat(0xd6d0c4),false);kind="bus"}
 else if(variant===1){car=makeCar(0x9a6b43);car.scale.set(1.22,1.12,1.45);box(car,0,1.62,-.15,1.85,.95,2.3,mat(0x9b8064),false);kind="truck"}
 else if(variant===2){car=makeCng();car.scale.set(.78,.78,.78);kind="cng"}
 else if(variant===3){car=makeCar(0xd9d4c8);car.scale.set(.82,.8,.88);kind="microcar"}
 else if(variant===4){car=makeCar(0x172c50);box(car,0,1.55,-.15,1.72,.18,2.1,mat(0x172c50),false);box(car,-.62,1.62,.55,.22,.12,.22,mat(0x182bff),false);box(car,.62,1.62,.55,.22,.12,.22,mat(0xb52626),false);kind="police"}
 else if(variant===5){car=makeCar(0x668c72);car.scale.set(1.08,1.15,1.35);box(car,0,1.52,-.3,1.7,.75,2.3,mat(0x668c72),false);kind="van"}
 else if(variant===6){car=makeCar(0x4a5159);car.scale.set(1.16,1.2,1.35);box(car,0,1.5,-.15,1.8,.55,1.9,M.glass,false);kind="suv"}
 else if(variant===7){car=makeCar(0x242424);car.scale.set(1.12,1.05,1.3);kind="vip"}
 else car=makeCar(trafficColors[i%trafficColors.length]);
 const axis=Math.random()<.5?"x":"z",dir=Math.random()<.5?-1:1,lane=dir>0?-2.3:2.3,line=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP;
 car.position.set(axis==="x"?Math.random()*GRID*STEP-HALF:line,0,axis==="z"?Math.random()*GRID*STEP-HALF:line);
 if(Math.hypot(car.position.x,car.position.z)<26)car.position[axis==="x"?"x":"z"]+=dir*32;
 car.rotation.y=axis==="x"?(dir>0?Math.PI/2:-Math.PI/2):(dir>0?0:Math.PI);scene.add(car);
 traffic.push({mesh:car,kind,axis,lane,dir,line,speed:4+Math.random()*7,base:6+Math.random()*7});
}
const people=[];
for(let i=0;i<58;i++){
 const p=makePerson(),axis=Math.random()<.5?"x":"z",line=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP,side=Math.random()<.5?-1:1;
 p.position.set(axis==="x"?Math.random()*GRID*STEP-HALF:line,0,axis==="z"?Math.random()*GRID*STEP-HALF:line);
 p.position[axis==="x"?"z":"x"]+=side*(ROAD/2+1.8);scene.add(p);
 people.push({mesh:p,axis,line,dir:Math.random()<.5?1:-1,speed:.55+Math.random()*.7,phase:Math.random()*6});
}
// Roadside tea stalls and hawker tables
const stalls=[];
for(let i=0;i<22;i++){
 const axis=i%2===0?"x":"z",line=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP;
 const along=(Math.random()*(GRID*2-2)-GRID+1)*STEP,side=Math.random()<.5?-1:1;
 const x=axis==="x"?along:line+side*8.2,z=axis==="x"?line+side*8.2:along;
 box(city,x,.8,z,2.4,.22,1.2,mat(0x8b5735),false);
 box(city,x-1,.38,z,.14,.8,.14,M.black,false);box(city,x+1,.38,z,.14,.8,.14,M.black,false);
 box(city,x,2.05,z,2.9,.18,1.8,mat(i%3===0?0xb83a32:i%3===1?0x2b7554:0xd5a63e),false);
 const pot=new THREE.Mesh(new THREE.CylinderGeometry(.2,.24,.45,10),mat(0x6a4630));pot.position.set(x+.75,.34,z+.3);city.add(pot);
 stalls.push({x,z});
}
const pickups=[];
for(let i=0;i<12;i++){
 const x=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP,z=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP;
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.25,.15,8,24),mat(0x6dff91));ring.rotation.x=Math.PI/2;ring.position.set(x,.35,z);scene.add(ring);pickups.push({mesh:ring,x,z,active:true});
}
const destination=new THREE.Mesh(new THREE.TorusGeometry(1.8,.18,8,28),mat(0xffc82e));destination.rotation.x=Math.PI/2;destination.position.set(0,.35,0);destination.visible=false;scene.add(destination);
function setMission(){ui.mission.textContent=state.passenger?"যাত্রীকে গন্তব্যে পৌঁছান":"যাত্রী খুঁজুন";ui.missionSub.textContent=state.passenger?"হলুদ চিহ্নে ধীরে থামুন":"সবুজ চিহ্নের কাছে ধীরে থামুন"}
function updateMissions(dt){
 for(const p of pickups){if(p.active){p.mesh.rotation.z+=dt*.55;p.mesh.position.y=.35+Math.sin(performance.now()*.002)*.12;
  if(!state.passenger&&Math.hypot(player.position.x-p.x,player.position.z-p.z)<3.8&&Math.abs(state.speed)<2.5){
   p.active=false;p.mesh.visible=false;state.passenger=true;
   let x,z;do{x=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP;z=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP}while(Math.hypot(x-player.position.x,z-player.position.z)<80);
   destination.position.set(x,.35,z);destination.visible=true;toast("যাত্রী উঠেছেন। নিরাপদে গন্তব্যে পৌঁছে দিন।");setMission();break;
  }
 }}
 if(state.passenger&&Math.hypot(player.position.x-destination.position.x,player.position.z-destination.position.z)<4.2&&Math.abs(state.speed)<2.5){
  state.passenger=false;destination.visible=false;state.score+=100;state.streak=Math.min(10,state.streak+1);
  if(state.score>state.best){state.best=state.score;try{localStorage.setItem("ba_best",String(state.best))}catch{}}
  const p=pickups.find(x=>!x.active);if(p){p.active=true;p.mesh.visible=true}
  toast("যাত্রী নিরাপদে পৌঁছেছেন! +৳১০০");setMission();
 }
}
const chargers=[];
for(let i=0;i<9;i++){
 const x=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP+4.6,z=(Math.floor(Math.random()*(GRID*2+1))-GRID)*STEP;
 box(city,x,.13,z,3.6,.18,2.4,mat(0x277e56),false);box(city,x+2.1,1,z,.3,2,.3,M.yellow,false);
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8),new THREE.MeshStandardMaterial({color:0x75ff9a,emissive:0x1b8b43}));lamp.position.set(x+2.1,2.1,z);city.add(lamp);chargers.push({x,z,lamp,cooldown:0});
}
const chasers=[];let cameraMode=0;
const cameraOffsets=[new THREE.Vector3(0,6.2,-10),new THREE.Vector3(0,2.7,-3.8),new THREE.Vector3(0,12,-17)];
const state={running:false,paused:false,over:false,speed:0,yaw:0,battery:100,score:0,best:Number(localStorage.getItem("ba_best")||0),accidents:0,streak:1,crashes:0,mission:0,passenger:false,time:8.5,toastTimer:0,trafficClock:0,hornCooldown:0,collisionCooldown:0,chargeTimer:0,signalStopKey:"",muted:false,quality:localStorage.getItem("ba_quality")||"medium"};
const keys={},controls={left:false,right:false,throttle:false,brake:false};
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function toast(message){ui.toast.textContent=message;ui.toast.classList.add("show");state.toastTimer=2.3}
let audioCtx=null;
function tone(freq,duration=.12,type="square",gain=.035){
 try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")audioCtx.resume();
  const osc=audioCtx.createOscillator(),vol=audioCtx.createGain();osc.type=type;osc.frequency.value=freq;vol.gain.setValueAtTime(gain,audioCtx.currentTime);vol.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(vol);vol.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);
 }catch{}
}
function horn(){
 if(!state.running||state.paused||state.over||state.hornCooldown>0)return;state.hornCooldown=1.1;tone(360,.22,"sawtooth",.045);tone(440,.22,"square",.025);toast("পোঁ পোঁ! পথ ছাড়ুন!");
 for(const p of people){const d=Math.hypot(p.mesh.position.x-player.position.x,p.mesh.position.z-player.position.z);if(d<12)p.dir=Math.sign(p.mesh.position[p.axis==="x"?"x":"z"]-(p.axis==="x"?player.position.x:player.position.z))||p.dir}
}
function cycleCamera(){cameraMode=(cameraMode+1)%cameraOffsets.length;toast(["পেছনের ক্যামেরা","ড্রাইভার ভিউ","উপরের ক্যামেরা"][cameraMode])}
function applyQuality(value){
 state.quality=value;try{localStorage.setItem("ba_quality",value)}catch{}
 renderer.shadowMap.enabled=value==="high";sun.castShadow=value==="high";
 renderer.setPixelRatio(Math.min(devicePixelRatio,value==="high"?1.5:value==="medium"?1.25:1));
 scene.fog.near=value==="low"?80:105;scene.fog.far=value==="low"?260:360;
 if(ui.quality)ui.quality.value=value;
}
ui.horn.onclick=horn;ui.camera.onclick=cycleCamera;
ui.soundToggle.onclick=()=>{state.muted=!state.muted;ui.soundToggle.textContent=state.muted?"শব্দ: বন্ধ":"শব্দ: চালু";if(!state.muted)tone(520,.08,"sine",.025)};
ui.quality.onchange=()=>applyQuality(ui.quality.value);
applyQuality(state.quality);ui.soundToggle.textContent="শব্দ: চালু";
addEventListener("keydown",e=>{
 keys[e.key.toLowerCase()]=true;if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();
 if(e.key.toLowerCase()==="p")togglePause();if(e.key.toLowerCase()==="h")horn();if(e.key.toLowerCase()==="c")cycleCamera();
});
addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
document.querySelectorAll("[data-control]").forEach(button=>{
 const key=button.dataset.control,down=e=>{e.preventDefault();controls[key]=true},up=e=>{e.preventDefault();controls[key]=false};
 button.addEventListener("pointerdown",down);button.addEventListener("pointerup",up);button.addEventListener("pointercancel",up);button.addEventListener("pointerleave",up);
});
function endGame(title,reason){
 if(state.over)return;state.over=true;state.running=false;ui.endTitle.textContent=title;ui.endText.textContent=reason;
 ui.finalScore.textContent="৳"+Math.round(state.score);ui.finalBest.textContent="৳"+Math.round(state.best);ui.finalCrashes.textContent=String(state.accidents);ui.endPanel.classList.remove("hidden");
}
function impact(kind){
 if(state.collisionCooldown>0)return;state.collisionCooldown=.8;state.crashes++;state.accidents++;state.streak=1;
 state.score=Math.max(0,state.score-35);state.battery=Math.max(0,state.battery-5);state.speed*=kind==="pedestrian"?.12:.3;
 tone(95,.16,"triangle",.06);toast((kind==="pedestrian"?"পথচারীর সঙ্গে দুর্ঘটনা। ":"যানবাহনে ধাক্কা। ")+"স্কোর −৩৫");
 if(state.accidents>=5)endGame("যাত্রা বাতিল","একাধিক দুর্ঘটনার কারণে এই যাত্রা শেষ হয়েছে।");
}
function updatePlayer(dt){
 const forward=keys.w||keys.arrowup||controls.throttle,reverse=keys.s||keys.arrowdown||controls.brake,left=keys.a||keys.arrowleft||controls.left,right=keys.d||keys.arrowright||controls.right;
 if(forward&&state.battery>0)state.speed=Math.min(11.5,state.speed+5.5*dt);
 else if(reverse)state.speed=Math.max(-4,state.speed-9.5*dt);else state.speed*=Math.exp(-.8*dt);
 const steer=(right?1:0)-(left?1:0),factor=clamp(Math.abs(state.speed)/3.5,0,1);state.yaw+=steer*1.5*factor*dt*(state.speed<0?-1:1);player.rotation.y=state.yaw;
 const old=player.position.clone();player.position.x+=Math.sin(state.yaw)*state.speed*dt;player.position.z+=Math.cos(state.yaw)*state.speed*dt;
 player.position.x=clamp(player.position.x,-HALF-10,HALF+10);player.position.z=clamp(player.position.z,-HALF-10,HALF+10);
 if(Math.abs(state.speed)>1)state.battery=Math.max(0,state.battery-(.12+Math.abs(state.speed)*.008)*dt);
 const ix=Math.round(player.position.x/STEP),iz=Math.round(player.position.z/STEP),junctionKey=ix+","+iz;
 const nearJunction=Math.hypot(player.position.x-ix*STEP,player.position.z-iz*STEP)<5.5;
 const approachAxis=Math.abs(Math.sin(state.yaw))>Math.abs(Math.cos(state.yaw))?"x":"z",greenAxis=state.trafficClock<20?"x":"z";
 if(nearJunction&&approachAxis!==greenAxis&&Math.abs(state.speed)<1.2&&state.signalStopKey!==junctionKey){
  state.score+=5;state.signalStopKey=junctionKey;toast("সিগন্যালে নিরাপদে থেমেছেন! +৳৫");
  if(state.score>state.best){state.best=state.score;try{localStorage.setItem("ba_best",String(state.best))}catch{}}
 }
 if(!nearJunction)state.signalStopKey="";
 if(state.collisionCooldown>0)state.collisionCooldown-=dt;if(state.hornCooldown>0)state.hornCooldown-=dt;
 for(const t of traffic){const dx=player.position.x-t.mesh.position.x,dz=player.position.z-t.mesh.position.z;if(dx*dx+dz*dz<9){player.position.copy(old);impact("vehicle");break}}
 for(const o of obstacles){const dx=player.position.x-o.x,dz=player.position.z-o.z;if(dx*dx+dz*dz<(o.r+1.15)**2){player.position.copy(old);if(Math.abs(state.speed)>3)impact("building");state.speed*=.2;break}}
 for(const p of people){const dx=player.position.x-p.mesh.position.x,dz=player.position.z-p.mesh.position.z;if(dx*dx+dz*dz<2.4&&Math.abs(state.speed)>3){player.position.copy(old);impact("pedestrian");break}}
 for(const c of chargers){if(c.cooldown>0)c.cooldown-=dt;const d=Math.hypot(player.position.x-c.x,player.position.z-c.z);if(d<3.2&&c.cooldown<=0&&state.battery<96){state.battery=Math.min(100,state.battery+32);c.cooldown=22;toast("চার্জিং পয়েন্ট: ব্যাটারি +৩২%")}}
 if(state.battery<=0&&Math.abs(state.speed)<.5){state.chargeTimer+=dt;if(state.chargeTimer>12)endGame("চার্জ শেষ!","অটো থেমে গেছে—চার্জিং পয়েন্ট খুঁজুন।")}else state.chargeTimer=0;
}
function updateTraffic(dt){
 state.trafficClock=(state.trafficClock+dt)%40;const greenAxis=state.trafficClock<20?"x":"z";
 for(const sig of signals){const gx=greenAxis==="x";sig.red.material.color.setHex(gx?0x5a1714:0xf02d20);sig.red.material.emissive.setHex(gx?0x260000:0x8a0800);sig.green.material.color.setHex(gx?0x31e66b:0x174d2a);sig.green.material.emissive.setHex(gx?0x087a2a:0x00240b)}
 for(const t of traffic){
  const m=t.mesh,along=t.axis==="x"?"x":"z",cross=t.axis==="x"?"z":"x";let pos=m.position[along],target=t.base;
  for(const q of traffic){if(q===t||q.axis!==t.axis||q.line!==t.line||q.dir!==t.dir)continue;const gap=(q.mesh.position[along]-pos)*t.dir;if(gap>0&&gap<15)target=Math.min(target,Math.max(0,q.speed-(15-gap)*.85))}
  const junction=t.dir>0?(Math.floor(pos/STEP)+1)*STEP:(Math.ceil(pos/STEP)-1)*STEP,distance=(junction-pos)*t.dir;
  if(t.axis!==greenAxis&&distance>0&&distance<12)target=Math.min(target,Math.max(0,(distance-4)*1.2));
  const dx=player.position.x-m.position.x,dz=player.position.z-m.position.z;if(dx*dx+dz*dz<100)target=Math.min(target,Math.max(0,Math.hypot(dx,dz)-5));
  t.speed+=clamp(target-t.speed,-12*dt,5*dt);m.position[along]+=t.dir*t.speed*dt;
  if(Math.abs(m.position[along])>HALF+20){m.position[along]=-t.dir*(HALF+15);t.base=5+Math.random()*8;t.speed=Math.min(t.speed,5)}
  m.position[cross]=t.line+t.lane;
 }
}
function updatePeople(dt){
 for(const p of people){const axis=p.axis==="x"?"x":"z";p.mesh.position[axis]+=p.dir*p.speed*dt;if(Math.abs(p.mesh.position[axis])>HALF+10)p.mesh.position[axis]=-p.dir*(HALF+8);
  if(Math.hypot(p.mesh.position.x-player.position.x,p.mesh.position.z-player.position.z)<4)p.mesh.position[axis]-=p.dir*p.speed*dt*1.5;
 }
}
function updateHud(){
 const bn=n=>Math.round(n).toString().replace(/\d/g,d=>"০১২৩৪৫৬৭৮৯"[d]);
 ui.score.textContent="৳"+bn(state.score);ui.speed.textContent=bn(Math.abs(state.speed)*3.6)+" km/h";ui.combo.textContent="পরপর সফল যাত্রা ×"+bn(state.streak);ui.combo.classList.toggle("hidden",state.streak<2);
 ui.battery.textContent=bn(state.battery)+"%";ui.batteryBar.style.width=state.battery+"%";ui.batteryBar.style.background=state.battery<20?"#f15d45":"#72e69a";
 ui.best.textContent="৳"+bn(state.best);ui.accidents.textContent=bn(state.accidents);ui.accidentBar.style.width=(state.accidents/5*100)+"%";
 ui.hint.textContent=state.battery<20?"চার্জ কম! মানচিত্রে সবুজ চার্জিং পয়েন্ট খুঁজুন।":state.passenger?"যাত্রীকে নিরাপদে হলুদ গন্তব্যে পৌঁছে দিন।":"সবুজ চিহ্নে ধীরে থামিয়ে যাত্রী তুলুন।";
 ui.mission.textContent=state.passenger?"যাত্রীকে গন্তব্যে পৌঁছান":"যাত্রী খুঁজুন";ui.missionSub.textContent=state.passenger?"হলুদ চিহ্নে যান এবং ধীরে থামুন":"সবুজ চিহ্নের কাছে অটো থামান";
}
function drawMap(){
 map.clearRect(0,0,180,180);map.fillStyle="#26352a";map.fillRect(0,0,180,180);map.strokeStyle="#b3aa8c";map.lineWidth=4;
 for(let i=-GRID;i<=GRID;i++){const p=90+i*STEP/(HALF*2)*180;map.beginPath();map.moveTo(p,0);map.lineTo(p,180);map.moveTo(0,p);map.lineTo(180,p);map.stroke()}
 map.fillStyle="#73f5a0";for(const c of chargers){map.beginPath();map.arc(90+c.x/(HALF*2)*180,90+c.z/(HALF*2)*180,2.5,0,Math.PI*2);map.fill()}
 map.fillStyle="#7bff9c";for(const p of pickups){if(p.active){map.beginPath();map.arc(90+p.x/(HALF*2)*180,90+p.z/(HALF*2)*180,3,0,Math.PI*2);map.fill()}}
 if(state.passenger){map.fillStyle="#ffd45a";map.beginPath();map.arc(90+destination.position.x/(HALF*2)*180,90+destination.position.z/(HALF*2)*180,4,0,Math.PI*2);map.fill()}
 const px=90+player.position.x/(HALF*2)*180,pz=90+player.position.z/(HALF*2)*180;map.fillStyle="#ffca35";map.beginPath();map.arc(px,pz,4,0,Math.PI*2);map.fill();
}
function reset(){
 player.position.set(0,0,0);state.speed=0;state.yaw=0;player.rotation.y=0;state.battery=100;state.score=0;state.accidents=0;state.streak=1;state.crashes=0;state.mission=0;state.passenger=false;state.time=8.5;state.signalStopKey="";state.over=false;state.chargeTimer=0;state.collisionCooldown=0;
 chargers.forEach(c=>c.cooldown=0);pickups.forEach(p=>{p.active=true;p.mesh.visible=true});
 destination.visible=false;ui.endPanel.classList.add("hidden");ui.pausePanel.classList.add("hidden");updateHud();drawMap();
}
function start(){reset();state.running=true;state.paused=false;ui.overlay.classList.add("hidden");toast("ঢাকার রাস্তায় নেমে পড়ুন!")}
function togglePause(){if(!state.running||state.over)return;state.paused=!state.paused;ui.pausePanel.classList.toggle("hidden",!state.paused)}
ui.start.onclick=start;ui.pause.onclick=togglePause;ui.resume.onclick=()=>{state.paused=false;ui.pausePanel.classList.add("hidden")};
ui.restart.onclick=()=>{reset();state.running=true;state.paused=false};ui.again.onclick=()=>{reset();state.running=true};
function updateCamera(dt){
 const offset=cameraOffsets[cameraMode].clone().applyAxisAngle(new THREE.Vector3(0,1,0),state.yaw),desired=player.position.clone().add(offset);
 camera.position.lerp(desired,1-Math.exp(-4.5*dt));camera.lookAt(player.position.x,1.15,player.position.z+Math.cos(state.yaw)*2.2);
}
let last=performance.now(),frame=0;
function loop(now){
 requestAnimationFrame(loop);const dt=Math.min(.04,(now-last)/1000||0);last=now;
 if(state.running&&!state.paused&&!state.over){
  updatePlayer(dt);updateTraffic(dt);updatePeople(dt);updateMissions(dt);state.time=(state.time+dt*.025)%24;updateLighting();
  const two=n=>Math.floor(n).toString().padStart(2,"0");ui.clock.textContent=two(Math.floor(state.time))+":"+two(Math.floor((state.time%1)*60));
  if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)ui.toast.classList.remove("show")}
  updateHud();if(++frame%7===0)drawMap();
 }
 updateCamera(dt);renderer.render(scene,camera);
}
requestAnimationFrame(loop);
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))});
camera.position.set(0,8,-12);camera.lookAt(0,1,5);setMission();drawMap();updateHud();window.__GAME_STATE__=state;window.__GAME_READY__=true;if(new URLSearchParams(location.search).has("test")){
 window.__GAME_TEST__={
  pickup(){const p=pickups.find(x=>x.active);if(!p)return false;player.position.set(p.x,0,p.z);state.speed=0;updateMissions(.016);return state.passenger},
  dropoff(){if(!state.passenger)return false;player.position.set(destination.position.x,0,destination.position.z);state.speed=0;updateMissions(.016);return !state.passenger&&state.score>=100}
 };
}

