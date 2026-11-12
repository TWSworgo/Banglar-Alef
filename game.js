import * as THREE from "three";
import { buildDhakaShowcase } from "./engine-showcase.js";
import { RoadWorld, createDrivingModel } from "./game-world.js";
import { createNewGameState, loadGameState, saveGameState, transitionGameState, updateGameState } from "./game-core.js";

const $ = id => document.getElementById(id);
const root = $("world");
let renderer, scene, camera, clock, animationId, vehicle, world, driving, gameState;
let paused=false, money=0, battery=100, journeyStage=0, saveClock=0;
const keys=new Set(), controls={left:false,right:false,forward:false,brake:false,reverse:false};

function init(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x9eafa8);
  scene.fog=new THREE.FogExp2(0x9eafa8,.0024);
  camera=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,.1,900);
  renderer=new THREE.WebGLRenderer({antialias:innerWidth>700,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<700?1.3:1.7));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  root.replaceChildren(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xe9f3ef,0x4d594c,1.55));
  const sun=new THREE.DirectionalLight(0xffe2ba,2.15);
  sun.position.set(-120,150,80); sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-250;sun.shadow.camera.right=250;
  sun.shadow.camera.top=250;sun.shadow.camera.bottom=-250;scene.add(sun);

  world=new RoadWorld(THREE,scene);
  const showcase=buildDhakaShowcase(THREE,scene);
  vehicle=showcase.vehicle;
  vehicle.position.set(gameState.player.position.x,gameState.player.position.y,gameState.player.position.z);
  vehicle.rotation.y=gameState.player.heading;
  driving=createDrivingModel(THREE,vehicle);
  addEvents();
  updateMissionUI();
  window.__gameDiagnostics={
    get speed(){return driving.speed},
    get battery(){return battery},
    get traffic(){return world.traffic.length},
    get people(){return world.people.length},
    get position(){return {x:vehicle.position.x,z:vehicle.position.z}},
    get journeyStage(){return journeyStage},
    save:persistGame
  };
  window.addEventListener("resize",resize);
  clock=new THREE.Clock();
  tick();
}

function resize(){
  if(!renderer)return;
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}

function input(){
  return {
    left:keys.has("a")||keys.has("arrowleft")||controls.left,
    right:keys.has("d")||keys.has("arrowright")||controls.right,
    forward:keys.has("w")||keys.has("arrowup")||controls.forward,
    brake:keys.has("s")||keys.has("arrowdown")||controls.brake,
    reverse:keys.has("r")||controls.reverse
  };
}

function addEvents(){
  window.addEventListener("keydown",e=>{
    const k=e.key.toLowerCase();
    keys.add(k);
    if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();
    if(k==="escape")togglePause();
  });
  window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
  document.querySelectorAll("[data-control]").forEach(button=>{
    const name=button.dataset.control;
    const down=e=>{e.preventDefault();controls[name]=true;button.setPointerCapture?.(e.pointerId)};
    const up=e=>{e.preventDefault();controls[name]=false};
    button.addEventListener("pointerdown",down);
    button.addEventListener("pointerup",up);
    button.addEventListener("pointercancel",up);
    button.addEventListener("lostpointercapture",up);
  });
  $("pause").addEventListener("click",togglePause);
  $("resume").addEventListener("click",togglePause);
  $("restart-game").addEventListener("click",()=>location.href="./game.html?new=1");
  $("completion-restart").addEventListener("click",()=>location.href="./game.html?new=1");
}

function togglePause(){
  if(gameState.status==="completed")return;
  paused=!paused;
  $("pause-panel").hidden=!paused;
  if(paused){gameState=transitionGameState(gameState,"paused");persistGame();}
  else{gameState=transitionGameState(gameState,"playing");clock.getDelta();}
}

function persistGame(){
  if(!gameState||!vehicle)return;
  gameState=updateGameState(gameState,state=>{
    state.player.money=money;
    state.player.battery=battery;
    state.player.position={x:vehicle.position.x,y:vehicle.position.y,z:vehicle.position.z};
    state.player.heading=vehicle.rotation.y;
    state.progression.activeMissionStage=journeyStage;
    state.statistics.playTimeSeconds+=0;
  });
  return saveGameState(gameState);
}

function updateMissionUI(){
  if(journeyStage===0){
    $("mission-label").textContent="নতুন যাত্রা";
    $("mission-text").textContent="রাস্তার পাশে যাত্রী খুঁজে CNG ধীরে থামাও";
  }else if(journeyStage===1){
    $("mission-label").textContent="যাত্রী উঠেছে";
    $("mission-text").textContent="যাত্রীকে সবুজ গন্তব্যের দিকে নিয়ে যাও";
  }else{
    $("mission-label").textContent="যাত্রা সম্পন্ন";
    $("mission-text").textContent="ভাড়া পেয়েছ — পরের যাত্রা শুরু করো";
  }
}

function createPassenger(){
  const p=world.spawnPassengerNear(vehicle.position);
  p.userData.stage=journeyStage;
}

function handleJourney(){
  if(journeyStage===0){
    const nearest=world.nearestPassenger(vehicle.position);
    if(nearest.passenger && nearest.distance<4 && Math.abs(driving.speed)<1.0){
      nearest.passenger.userData.active=false;
      nearest.passenger.visible=false;
      journeyStage=1;
      gameState=updateGameState(gameState,s=>{s.progression.activeMissionStage=1});
      updateMissionUI();
      $("toast").textContent="যাত্রী উঠেছে — এখন গন্তব্যে যাও";
      persistGame();
      return;
    }
    if(world.passengers.length===0)createPassenger();
  }else if(journeyStage===1){
    const destination=new THREE.Vector3(vehicle.position.x+18,0,vehicle.position.z-85);
    const distance=vehicle.position.distanceTo(destination);
    if(distance<7 && driving.speed<1.2){
      journeyStage=2;
      const fare=25+Math.floor(Math.random()*31);
      money+=fare;
      gameState=updateGameState(gameState,s=>{
        s.player.money=money;s.progression.activeMissionStage=2;
        s.progression.journeysCompleted+=1;s.statistics.totalEarned+=fare;
      });
      updateMissionUI();
      $("toast").textContent=`যাত্রা সম্পন্ন — ভাড়া ৳${fare}`;
      persistGame();
    }
  }
}

function update(dt){
  const previous=vehicle.position.clone();
  const inp=input();
  let moveInput={...inp};
  if(inp.reverse&&!inp.forward){
    moveInput.forward=false;
    if(driving.speed>0)driving.speed=Math.max(0,driving.speed-driving.brake*dt);
    else vehicle.position.z+=0;
  }
  driving.update(dt,moveInput);
  if(inp.reverse && !inp.forward && driving.speed<.15){
    const reverseSpeed=3.8;
    const fwd=new THREE.Vector3(Math.sin(vehicle.rotation.y),0,Math.cos(vehicle.rotation.y));
    vehicle.position.addScaledVector(fwd,reverseSpeed*dt);
  }

  // Keep the player inside the streamed playable district.
  vehicle.position.x=THREE.MathUtils.clamp(vehicle.position.x,-202,202);
  vehicle.position.z=THREE.MathUtils.clamp(vehicle.position.z,-262,262);

  // Lightweight vehicle collision response against traffic.
  for(const car of world.traffic){
    const dx=vehicle.position.x-car.position.x, dz=vehicle.position.z-car.position.z;
    if(Math.abs(dx)<1.75 && Math.abs(dz)<2.8){
      const len=Math.hypot(dx,dz)||1;
      vehicle.position.x+=dx/len*.45;
      vehicle.position.z+=dz/len*.45;
      driving.speed=Math.max(0,driving.speed-5.5*dt);
      $("toast").textContent="সতর্ক: ট্রাফিকের সঙ্গে ধাক্কা লেগেছে";
    }
  }

  world.update(dt,vehicle);
  handleJourney();

  const distanceMoved=previous.distanceTo(vehicle.position);
  battery=Math.max(0,battery-distanceMoved*.0045-dt*.004);
  if(battery<15 && battery>0) $("toast").textContent="ব্যাটারি কম — কাছের charging point খুঁজে নাও";
  if(battery<=0){driving.speed=Math.max(0,driving.speed-8*dt);$("mission-text").textContent="ব্যাটারি শেষ — গাড়ি থেমে গেছে";}

  gameState=updateGameState(gameState,s=>{
    s.statistics.playTimeSeconds+=dt;
    s.statistics.distanceMetres+=distanceMoved;
  });
  saveClock+=dt;
  if(saveClock>=5){saveClock=0;persistGame();}

  const forward=new THREE.Vector3(Math.sin(vehicle.rotation.y),0,Math.cos(vehicle.rotation.y));
  const target=vehicle.position.clone().addScaledVector(forward,-11);
  target.y+=5.2;
  camera.position.lerp(target,.09);
  camera.lookAt(vehicle.position.x,1.1,vehicle.position.z);

  $("speed").textContent=Math.max(0,Math.round(Math.abs(driving.speed)*3.6)).toLocaleString("bn-BD");
  $("battery").textContent=Math.round(battery).toLocaleString("bn-BD")+"%";
  $("money").textContent=Math.round(money).toLocaleString("bn-BD");
}

function tick(){
  animationId=requestAnimationFrame(tick);
  const dt=Math.min(clock.getDelta(),.05);
  if(!paused){update(dt);renderer.render(scene,camera);}
}

try{
  const params=new URLSearchParams(location.search);
  if(params.get("new")==="1")gameState=createNewGameState();
  else{const loaded=loadGameState();gameState=loaded.ok?loaded.state:createNewGameState();}
  money=gameState.player.money;
  battery=gameState.player.battery;
  journeyStage=gameState.progression.activeMissionStage;
  if(journeyStage>2)journeyStage=0;
  init();
  if(journeyStage===0)createPassenger();
  if(journeyStage===2)updateMissionUI();
}catch(error){
  console.error(error);
  $("error-panel").hidden=false;
  $("error-text").textContent=error.message||"WebGL renderer error";
}

window.addEventListener("beforeunload",()=>{
  persistGame();
  cancelAnimationFrame(animationId);
  renderer?.dispose();
});