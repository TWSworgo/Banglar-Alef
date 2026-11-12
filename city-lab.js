import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { UTTARA_PILOT, fetchOSMExtract, parseOSMData, buildCityWorld } from "./city-world.js";

const $ = id => document.getElementById(id);
const viewport = $("city-viewport");
const loadButton = $("load-city");
const status = $("city-status");
let renderer, scene, camera, controls, cityGroup, frameId;
let fixtureMode = new URLSearchParams(location.search).get("fixture") === "1";

function createFixture() {
  return { elements: [
    { type:"way", id:101, tags:{ highway:"primary", name:"Pilot Road", lanes:"2" }, geometry:[{lat:23.87,lon:90.375},{lat:23.87,lon:90.385},{lat:23.872,lon:90.39}] },
    { type:"way", id:102, tags:{ highway:"residential", name:"Side Road" }, geometry:[{lat:23.868,lon:90.38},{lat:23.87,lon:90.38}] },
    { type:"way", id:201, tags:{ building:"yes", "building:levels":"4", name:"Test Building" }, geometry:[{lat:23.869,lon:90.379},{lat:23.869,lon:90.38},{lat:23.87,lon:90.38},{lat:23.87,lon:90.379},{lat:23.869,lon:90.379}] }
  ]};
}

function initializeScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8b9b1);
  scene.fog = new THREE.Fog(0xa8b9b1, 1500, 5200);
  camera = new THREE.PerspectiveCamera(48, 1, 0.1, 8000);
  camera.position.set(0, 1050, 1050);
  controls = new OrbitControls(camera, viewport);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 80;
  controls.maxDistance = 4200;
  controls.update();
  scene.add(new THREE.HemisphereLight(0xe2f0f2, 0x62685e, 1.65));
  const sun = new THREE.DirectionalLight(0xffedcf, 2.5);
  sun.position.set(-500, 900, 350);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024,1024);
  scene.add(sun);
  scene.add(sun.target);
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference:"high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia("(pointer:coarse)").matches ? 1 : 1.4));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  viewport.replaceChildren(renderer.domElement);
  const resize = new ResizeObserver(() => {
    const w = Math.max(1,viewport.clientWidth), h = Math.max(1,viewport.clientHeight);
    camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h,false);
  });
  resize.observe(viewport);
  const animate = () => {
    frameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene,camera);
  };
  animate();
}

async function loadCity() {
  loadButton.disabled = true;
  status.textContent = fixtureMode ? "Fixture data তৈরি হচ্ছে…" : "Overpass API থেকে OSM data ডাউনলোড হচ্ছে…";
  try {
    const result = fixtureMode ? { data:createFixture(), endpoint:"CI fixture" } : await fetchOSMExtract({ bounds:UTTARA_PILOT.bounds });
    const parsed = parseOSMData(result.data, UTTARA_PILOT.bounds);
    if (!parsed.roads.length) throw new Error("এই bounding box-এ কোনো road geometry পাওয়া যায়নি।");
    if (cityGroup) {
      scene.remove(cityGroup);
      cityGroup.traverse(object => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach(material=>material.dispose());
        else object.material?.dispose?.();
      });
    }
    const built = buildCityWorld(THREE,parsed);
    cityGroup = built.group;
    scene.add(cityGroup);
    $("road-ways").textContent = built.counts.roadWays.toLocaleString();
    $("road-segments").textContent = built.counts.roadSegments.toLocaleString();
    $("buildings").textContent = built.counts.buildings.toLocaleString();
    $("map-source").textContent = result.endpoint === "CI fixture" ? "TEST FIXTURE" : "OPENSTREETMAP";
    $("coverage").textContent = "UTTARA · " + built.counts.omittedBuildings + " OMITTED";
    status.textContent = "লোড সম্পন্ন — " + built.counts.roadWays + " road ways, " + built.counts.buildings + " buildings";
    controls.target.set(0,0,0);
    camera.position.set(0,Math.max(450,Math.min(1150,900)),Math.max(500,Math.min(1200,1000)));
    controls.update();
    window.__cityDiagnostics = { ...built.counts, origin:built.origin, source:result.endpoint };
  } catch (error) {
    status.textContent = "লোড ব্যর্থ: " + error.message;
    console.error("City data load failed",error);
  } finally {
    loadButton.disabled = false;
  }
}

try {
  initializeScene();
  loadButton.addEventListener("click",loadCity);
  if (fixtureMode) loadButton.textContent = "Load CI test city";
} catch(error) {
  status.textContent = "3D renderer চালু হয়নি: " + error.message;
  console.error(error);
}
window.addEventListener("beforeunload",()=>{cancelAnimationFrame(frameId);controls?.dispose();renderer?.dispose();});
