import * as THREE from "three";
import { buildDhakaShowcase } from "./engine-showcase.js";

const $ = id => document.getElementById(id);
const root = $("world");
const errorPanel = $("error-panel");
let renderer, scene, camera, vehicle, clock, animationId;
let paused = false, speed = 0, battery = 100, money = 0;
let steering = 0, forward = false, braking = false, journeyStage = 0;
const keys = new Set();
const controls = { left:false, right:false, forward:false, brake:false };
const MAX_SPEED = 15.5;

function box(w,h,d,x,y,z,material,receive=true){
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z); mesh.receiveShadow=receive; mesh.castShadow=true; scene.add(mesh); return mesh;
}
function buildRoad(){
  const asphalt = new THREE.MeshStandardMaterial({color:0x343a37,roughness:0.96});
  const concrete = new THREE.MeshStandardMaterial({color:0x92938b,roughness:0.94});
  const paint = new THREE.MeshStandardMaterial({color:0xe8dfc0,roughness:0.8});
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260,520),new THREE.MeshStandardMaterial({color:0x71816d,roughness:1}));
  ground.rotation.x=-Math.PI/2; ground.position.set(0,-0.12,-115); scene.add(ground);
  box(15,0.12,340,0,-0.02,-105,asphalt);
  box(3.2,0.2,340,-9.1,0.02,-105,concrete);
  box(3.2,0.2,340,9.1,0.02,-105,concrete);
  for(let z=55;z>-275;z-=11) box(0.13,0.025,4.4,0,0.055,z,paint,false);
  for(const side of [-1,1]){
    for(let z=65;z>-270;z-=24){
      box(0.22,0.4,0.22,side*10.8,0.2,z,concrete);
      box(0.2,0.18,0.2,side*10.8,0.48,z,paint,false);
    }
  }
}
function addTraffic(){
  const carColors=[0xb8b8ad,0x1c5260,0x8b3226,0xd0a94c];
  for(let i=0;i<7;i++){
    const car=new THREE.Group();
    const color=new THREE.MeshStandardMaterial({color:carColors[i%carColors.length],roughness:.42,metalness:.12});
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.75,.72,3.5),color);body.position.y=.7;car.add(body);
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.48,.65,1.8),new THREE.MeshPhysicalMaterial({color:0x78918f,roughness:.18,transparent:true,opacity:.78}));cabin.position.set(0,1.35,-.25);car.add(cabin);
    car.position.set((i%2? -3.1:3.1),0,-28-i*33);car.userData.speed=3.2+(i%3)*1.1;car.userData.baseZ=car.position.z;scene.add(car);traffic.push(car);
  }
}
const traffic=[];
function addPassenger(){
  const marker=new THREE.Group();
  const glow=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,.06,24),new THREE.MeshBasicMaterial({color:0x43f1a4}));
  glow.position.y=.08;marker.add(glow);
  const person=new THREE.Mesh(new THREE.CapsuleGeometry(.25,.85,4,8),new THREE.MeshStandardMaterial({color:0x276c52,roughness:.85}));
  person.position.y=.72;marker.add(person);
  const label=document.createElement("div");label.className="passenger-label";label.textContent="যাত্রী"; 
  marker.position.set(-2.5,0,-90);scene.add(marker);return marker;
}
function init(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x9eafa8);scene.fog=new THREE.Fog(0x9eafa8,85,260);
  camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,500);camera.position.set(0,6,13);
  renderer=new THREE.WebGLRenderer({antialias:innerWidth>700,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<700?1.35:1.7));renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;root.replaceChildren(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xe8f2f0,0x53604c,1.5));
  const sun=new THREE.DirectionalLight(0xffe4bd,2.2);sun.position.set(-24,38,18);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
  buildRoad();
  const showcase=buildDhakaShowcase(THREE,scene);
  vehicle=showcase.vehicle;vehicle.position.set(0,0,48);
  // The showcase vehicle faces +Z. Travel initially heads toward -Z.
  vehicle.rotation.y=Math.PI;
  addTraffic();
  addPassenger();
  clock=new THREE.Clock();
  addEvents();
  window.addEventListener("resize",resize);
  tick();
}
function resize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
function addEvents(){
  window.addEventListener("keydown",e=>{keys.add(e.key.toLowerCase());if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key.toLowerCase()))e.preventDefault();if(e.key==="Escape")togglePause();});
  window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
  document.querySelectorAll("[data-control]").forEach(button=>{
    const name=button.dataset.control;
    const down=e=>{e.preventDefault();controls[name]=true;button.setPointerCapture?.(e.pointerId);};
    const up=e=>{e.preventDefault();controls[name]=false;};
    button.addEventListener("pointerdown",down);button.addEventListener("pointerup",up);button.addEventListener("pointercancel",up);button.addEventListener("lostpointercapture",up);
  });
  $("pause").addEventListener("click",togglePause);$("resume").addEventListener("click",togglePause);
}
function togglePause(){paused=!paused;$("pause-panel").hidden=!paused;if(!paused)clock.getDelta();}
function update(dt){
  const go=keys.has("w")||keys.has("arrowup")||controls.forward;
  const stop=keys.has("s")||keys.has("arrowdown")||controls.brake;
  const left=keys.has("a")||keys.has("arrowleft")||controls.left;
  const right=keys.has("d")||keys.has("arrowright")||controls.right;
  if(go)speed=Math.min(MAX_SPEED,speed+dt*5.2);else speed=Math.max(0,speed-dt*(stop?14:3.2));
  if(stop)speed=Math.max(0,speed-dt*8);
  const direction=(right?1:0)-(left?1:0);
  vehicle.rotation.y=Math.PI+direction*0.32*Math.min(1,speed/5);
  vehicle.position.x=THREE.MathUtils.clamp(vehicle.position.x+direction*dt*(2.2+speed*.24),-5.6,5.6);
  vehicle.position.z-=speed*dt;
  battery=Math.max(0,battery-dt*(.012+speed*.0018));
  traffic.forEach(car=>{car.position.z+=car.userData.speed*dt;if(car.position.z>65)car.position.z=-270;});
  const target=new THREE.Vector3(vehicle.position.x,4.5,vehicle.position.z+10.5);
  camera.position.lerp(target,.09);
  camera.lookAt(vehicle.position.x,1.0,vehicle.position.z-8);
  $("speed").textContent=Math.round(speed*3.6).toLocaleString("bn-BD");
  $("battery").textContent=Math.round(battery).toLocaleString("bn-BD")+"%";
  $("money").textContent=money.toLocaleString("bn-BD");
  if(journeyStage===0&&vehicle.position.z< -28){journeyStage=1;$("mission-label").textContent="যাত্রী পাওয়া গেছে";$("mission-text").textContent="সামনের সবুজ মার্কারের কাছে গাড়ি থামাও";$("toast").textContent="যাত্রী তুলতে গাড়ি ধীরে থামাও";}
  if(journeyStage===1&&vehicle.position.z< -83&&speed<1.2){journeyStage=2;money+=30;$("mission-label").textContent="যাত্রা সম্পন্ন";$("mission-text").textContent="যাত্রীকে পৌঁছে দিয়েছ — ভাড়া ৳৩০";$("toast").textContent="প্রথম ভাড়া পেয়েছ: ৳৩০"; }
  if(battery<=0){speed=Math.max(0,speed-dt*5);$("mission-text").textContent="ব্যাটারি শেষ — যাত্রা থেমে গেছে";}
}
function tick(){
  animationId=requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.05);
  if(!paused){update(dt);renderer.render(scene,camera);}
}
try{init();}catch(error){console.error(error);errorPanel.hidden=false;$("error-text").textContent=error.message||"WebGL renderer error";}
window.addEventListener("beforeunload",()=>{cancelAnimationFrame(animationId);renderer?.dispose();});
