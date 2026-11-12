import * as THREE from "three";
import { buildDhakaShowcase } from "./engine-showcase.js";
import { RoadWorld, createDrivingModel } from "./game-world.js";
import { createNewGameState,loadGameState,saveGameState,transitionGameState,updateGameState } from "./game-core.js";

const $=id=>document.getElementById(id);const root=$("world");
let renderer,scene,camera,clock,vehicle,world,driving,gameState;let paused=false,saveClock=0;let journeyStage=0,money=0,battery=100;
const keys=new Set(),controls={left:false,right:false,forward:false,brake:false,reverse:false};

function init(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0x9eafa8);scene.fog=new THREE.FogExp2(0x9eafa8,.0017);
 camera=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,.1,1100);
 renderer=new THREE.WebGLRenderer({antialias:innerWidth>700,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<700?1.35:1.7));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;root.replaceChildren(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xe9f3ef,0x4d594c,1.5));const sun=new THREE.DirectionalLight(0xffe2ba,2.1);sun.position.set(-160,180,100);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-360;sun.shadow.camera.right=360;sun.shadow.camera.top=360;sun.shadow.camera.bottom=-360;scene.add(sun);
 world=new RoadWorld(THREE,scene);const showcase=buildDhakaShowcase(THREE,scene);vehicle=showcase.vehicle;vehicle.position.set(gameState.player.position.x,gameState.player.position.y,gameState.player.position.z);vehicle.rotation.y=gameState.player.heading;driving=createDrivingModel(THREE,vehicle);
 addEvents();updateMissionUI();updateHUD();
 window.__gameDiagnostics={get speed(){return driving.speed},get traffic(){return world.traffic.length},get people(){return world.people.length},get passengers(){return world.passengers.length},get position(){return {x:vehicle.position.x,z:vehicle.position.z}},get vehicleZ(){return vehicle.position.z},get battery(){return battery},get mission(){return journeyStage},complete:()=>{journeyStage=2;gameState=transitionGameState(gameState,"completed");$("completion-panel").hidden=false;updateMissionUI();persist()},save:persist};
 window.addEventListener("resize",resize);clock=new THREE.Clock();tick();
}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
function input(){return{left:keys.has("a")||keys.has("arrowleft")||controls.left,right:keys.has("d")||keys.has("arrowright")||controls.right,forward:keys.has("w")||keys.has("arrowup")||controls.forward,brake:keys.has("s")||keys.has("arrowdown")||controls.brake,reverse:keys.has("r")||controls.reverse}}
function addEvents(){
 addEventListener("keydown",e=>{const k=e.key.toLowerCase();keys.add(k);if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();if(k==="escape")togglePause()});
 addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
 document.querySelectorAll("[data-control]").forEach(b=>{const n=b.dataset.control;const down=e=>{e.preventDefault();controls[n]=true;b.setPointerCapture?.(e.pointerId)};const up=e=>{e.preventDefault();controls[n]=false};b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);b.addEventListener("lostpointercapture",up)});
 $("pause").addEventListener("click",togglePause);$("resume").addEventListener("click",togglePause);$("restart-game").addEventListener("click",()=>location.href="./game.html?new=1");$("completion-restart").addEventListener("click",()=>location.href="./game.html?new=1");
}
function togglePause(){if(gameState.status==="completed")return;paused=!paused;$("pause-panel").hidden=!paused;if(paused)gameState=transitionGameState(gameState,"paused");else{gameState=transitionGameState(gameState,"playing");clock.getDelta()}persist()}
function persist(){if(!vehicle)return;gameState=updateGameState(gameState,s=>{s.player.money=money;s.player.battery=battery;s.player.position={x:vehicle.position.x,y:vehicle.position.y,z:vehicle.position.z};s.player.heading=vehicle.rotation.y;s.progression.activeMissionStage=journeyStage});return saveGameState(gameState)}
function updateMissionUI(){if(journeyStage===0){$("mission-label").textContent="নতুন যাত্রা";$("mission-text").textContent="সবুজ চিহ্নের যাত্রীর কাছে গিয়ে CNG থামাও"}else if(journeyStage===1){$("mission-label").textContent="যাত্রী উঠেছে";$("mission-text").textContent="সবুজ গন্তব্যে গিয়ে CNG থামাও"}else{$("mission-label").textContent="যাত্রা সম্পন্ন";$("mission-text").textContent="ভাড়া পেয়েছ — নতুন যাত্রা শুরু করো"}}
function updateHUD(){$("speed").textContent=Math.round(Math.abs(driving?.speed||0)*3.6).toLocaleString("bn-BD");$("battery").textContent=Math.round(battery).toLocaleString("bn-BD")+"%";$("money").textContent=Math.round(money).toLocaleString("bn-BD")}
function createPassenger(){world.spawnPassengerNear(vehicle.position)}
function handleJourney(){
 if(journeyStage===0){const q=world.nearestPassenger(vehicle.position);if(q.passenger&&q.distance<4.2&&Math.abs(driving.speed)<.7){world.removePassenger(q.passenger);journeyStage=1;updateMissionUI();$("toast").textContent="যাত্রী উঠেছে — সবুজ গন্তব্যে যাও";return}}
 if(journeyStage===1){const n=world.nearestNode(vehicle.position);const destination=new THREE.Vector3(n.x,0,n.z);if(destination.distanceTo(vehicle.position)<7&&Math.abs(driving.speed)<.8){journeyStage=2;const fare=30+Math.floor(Math.random()*31);money+=fare;gameState=updateGameState(gameState,s=>{s.player.money=money;s.progression.journeysCompleted++;s.statistics.totalEarned+=fare;s.progression.activeMissionStage=2});updateMissionUI();$("toast").textContent=`যাত্রা সম্পন্ন — ভাড়া ৳${fare}`;persist();$("completion-panel").hidden=false;gameState=transitionGameState(gameState,"completed");persist()}}
}
function collide(){
 for(const car of world.traffic){const dx=vehicle.position.x-car.position.x,dz=vehicle.position.z-car.position.z,d=Math.hypot(dx,dz);if(d<2.5){const nx=dx/(d||1),nz=dz/(d||1);vehicle.position.x+=nx*(2.5-d);vehicle.position.z+=nz*(2.5-d);driving.speed*=.35;$("toast").textContent="ট্রাফিকের সঙ্গে সংঘর্ষ — গতি কমেছে";}}
}
function update(dt){
 const before=vehicle.position.clone();driving.update(dt,input());vehicle.position.x=THREE.MathUtils.clamp(vehicle.position.x,-275,275);vehicle.position.z=THREE.MathUtils.clamp(vehicle.position.z,-335,335);
 world.update(dt,vehicle);collide();handleJourney();
 const moved=before.distanceTo(vehicle.position);battery=Math.max(0,battery-moved*.0038-dt*.002);if(battery===0)driving.speed=Math.max(0,driving.speed-9*dt);
 gameState=updateGameState(gameState,s=>{s.statistics.playTimeSeconds+=dt;s.statistics.distanceMetres+=moved});
 saveClock+=dt;if(saveClock>5){saveClock=0;persist()}
 const f=new THREE.Vector3(Math.sin(vehicle.rotation.y),0,Math.cos(vehicle.rotation.y));const target=vehicle.position.clone().addScaledVector(f,-12);target.y+=5.5;camera.position.lerp(target,.1);camera.lookAt(vehicle.position.x,1.1,vehicle.position.z);updateHUD();
}
function tick(){requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.05);if(!paused){update(dt);renderer.render(scene,camera)}}
try{const p=new URLSearchParams(location.search);const loaded=loadGameState();gameState=p.get("new")==="1"?createNewGameState():(loaded.ok?loaded.state:createNewGameState());money=gameState.player.money;battery=gameState.player.battery;journeyStage=gameState.progression.activeMissionStage;init();if(journeyStage===0)createPassenger()}catch(e){console.error(e);$("error-panel").hidden=false;$("error-text").textContent=e.message||"WebGL renderer error"}
addEventListener("beforeunload",()=>{try{persist()}catch{}});
