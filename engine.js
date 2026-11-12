import { CollisionWorld, OcclusionCuller, ResourceTracker, estimateTextureMemoryBytes } from './engine-systems.js';

let THREE, OrbitControls, RoomEnvironment, clock;

const $ = id => document.getElementById(id);
const viewport = $("viewport");
const status = $("scene-status");
const errorPanel = $("scene-error");
const errorMessage = $("scene-error-message");
let renderer, scene, camera, controls, resizeObserver, animationFrame, environmentMap;
let lastFrame = performance.now(), fpsFrames = 0, fpsStart = lastFrame;
let adaptiveScale = 1, qualityTier = "AUTO";
let disposed = false, frameNumber = 0, lightingPreset = 'day', weatherPreset = 'clear';
let occlusionCuller, collisionWorld, resourceTracker;
let occlusionTargets = [], occlusionSources = [];
let collisionPairCount = 0;

const lodObjects = [];

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGL2RenderingContext && canvas.getContext("webgl2"));
  } catch { return false; }
}

function makeAsphaltMaps() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#343936";
  ctx.fillRect(0, 0, size, size);
  let seed = 78123;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 24000; i++) {
    const v = Math.floor(35 + random() * 75);
    ctx.fillStyle = "rgba(" + v + "," + v + "," + v + "," + (0.08 + random() * 0.2) + ")";
    const r = 0.4 + random() * 1.7;
    ctx.fillRect(random() * size, random() * size, r, r);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext("2d");
  roughCtx.fillStyle = "#d8d8d8";
  roughCtx.fillRect(0, 0, size, size);
  for (let i = 0; i < 12000; i++) {
    const v = Math.floor(100 + random() * 155);
    roughCtx.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
    roughCtx.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2);
  }
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 3);

  // Derive a tangent-space normal map from the deterministic asphalt height detail.
  const source = ctx.getImageData(0, 0, size, size).data;
  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = normalCanvas.height = size;
  const normalCtx = normalCanvas.getContext("2d", { alpha: false });
  const normalImage = normalCtx.createImageData(size, size);
  const strength = 2.4;
  for (let y = 0; y < size; y++) {
    const up = ((y + size - 1) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x++) {
      const left = (y * size + (x + size - 1) % size) * 4;
      const right = (y * size + (x + 1) % size) * 4;
      const above = (up + x) * 4;
      const below = (down + x) * 4;
      const dx = (source[right] - source[left]) / 255 * strength;
      const dy = (source[below] - source[above]) / 255 * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length; ny /= length; nz /= length;
      const offset = (y * size + x) * 4;
      normalImage.data[offset] = Math.round((nx * 0.5 + 0.5) * 255);
      normalImage.data[offset + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalImage.data[offset + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalImage.data[offset + 3] = 255;
    }
  }
  normalCtx.putImageData(normalImage, 0, 0);
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(3, 3);
  normalMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  normalMap.minFilter = THREE.LinearMipmapLinearFilter;
  normalMap.magFilter = THREE.LinearFilter;
  return { map, roughnessMap, normalMap };
}

function createMaterialSet() {
  const asphaltMaps = makeAsphaltMaps();
  return {
    asphalt: new THREE.MeshStandardMaterial({ ...asphaltMaps, color: 0x777d78, roughness: 0.92, metalness: 0.02, normalScale: new THREE.Vector2(0.32, 0.32) }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x9a9c91, roughness: 0.88, metalness: 0 }),
    painted: new THREE.MeshStandardMaterial({ color: 0x8fb46c, roughness: 0.34, metalness: 0.12 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x8eb4b2, roughness: 0.08, metalness: 0.05, transmission: 0.12, transparent: true, opacity: 0.82, thickness: 0.25, ior: 1.45 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9da99c, roughness: 0.24, metalness: 0.86 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x171b19, roughness: 0.96, metalness: 0 }),
    calibration: new THREE.MeshStandardMaterial({ color: 0xd1d8ce, roughness: 0.22, metalness: 0.68 })
  };
}

function addGround(materials) {
  // World scale convention: one Three.js world unit represents one metre.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: 0x667064, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  ground.userData.collider = true;
  scene.add(ground);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(26, 170), materials.asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.y = -0.04;
  road.receiveShadow = true;
  road.userData.collider = true;
  scene.add(road);

  const sidewalkMaterial = materials.concrete;
  for (const x of [-15.2, 15.2]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.28, 170), sidewalkMaterial);
    walk.position.set(x, 0.02, 0);
    walk.receiveShadow = true;
    walk.castShadow = true;
    walk.userData.collider = true;
    scene.add(walk);
  }
  const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xe5dfbb, roughness: 0.75 });
  for (let z = -78; z < 82; z += 12) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 5), lineMaterial);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.012, z);
    scene.add(dash);
  }
}

function addMaterialStudy(materials) {
  const base = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(19, 0.5, 10), materials.concrete);
  floor.position.set(0, 0.22, -9);
  floor.castShadow = true;
  floor.receiveShadow = true;
  floor.userData.collider = true;
  floor.userData.occluder = true;
  base.add(floor);

  const samples = [
    { x: -6.5, material: materials.asphalt, label: "Asphalt" },
    { x: -2.2, material: materials.painted, label: "Paint" },
    { x: 2.2, material: materials.metal, label: "Metal" },
    { x: 6.5, material: materials.glass, label: "Glass" }
  ];
  for (const sample of samples) {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.55, 48), materials.concrete);
    plinth.position.set(sample.x, 0.72, -9);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    plinth.userData.collider = true;
    plinth.userData.occluder = true;
    base.add(plinth);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.95, 64, 48), sample.material);
    sphere.position.set(sample.x, 2.12, -9);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    sphere.userData.occludee = true;
    base.add(sphere);
    const label = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.22), new THREE.MeshStandardMaterial({ color: 0x263a2b, roughness: 0.7 }));
    label.position.set(sample.x, 1.02, -7.35);
    base.add(label);
  }
  scene.add(base);

  const detail = new THREE.Group();
  const chrome = new THREE.Mesh(new THREE.TorusKnotGeometry(0.72, 0.22, 160, 24), materials.calibration);
  chrome.position.set(-9, 2.1, -17);
  chrome.castShadow = true;
  chrome.userData.occludee = true;
  detail.add(chrome);
  const glassSphere = new THREE.Mesh(new THREE.SphereGeometry(0.8, 48, 32), materials.glass);
  glassSphere.position.set(9, 2.1, -17);
  glassSphere.castShadow = true;
  glassSphere.userData.occludee = true;
  detail.add(glassSphere);
  scene.add(detail);
}


function addWaterFeature() {
  const geometry = new THREE.PlaneGeometry(16, 22, 48, 64);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x6d9e9b, roughness: 0.14, metalness: 0.1,
    clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2,
    transparent: true, opacity: 0.92
  });
  const water = new THREE.Mesh(geometry, material);
  water.position.set(24, 0.08, -12);
  water.receiveShadow = true;
  water.userData.basePositions = geometry.attributes.position.array.slice();
  scene.add(water);
  return water;
}

function addAtmosphere() {
  const count = 600;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 90;
    positions[i * 3 + 1] = Math.random() * 22 + 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    speeds[i] = 0.25 + Math.random() * 0.8;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xc8b99a, size: 0.05, transparent: true, opacity: 0.16, depthWrite: false });
  const dust = new THREE.Points(geometry, material);
  dust.userData.speeds = speeds;
  scene.add(dust);
  return dust;
}

function addRain() {
  const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 75;
    positions[i * 3 + 1] = Math.random() * 30;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xb8d7e5, size: 0.07, transparent: true, opacity: 0.55, depthWrite: false });
  const rain = new THREE.Points(geometry, material);
  rain.visible = false;
  scene.add(rain);
  return rain;
}

function addCalibrationObjects(materials) {
  const high = new THREE.Group();
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), materials.painted);
  sphere.castShadow = true;
  high.add(sphere);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.06, 12, 64), materials.metal);
  ring.rotation.x = Math.PI / 2;
  high.add(ring);
  high.position.set(-24, 1.2, -15);
  scene.add(high);

  const low = new THREE.Group();
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.1, 2.1), materials.painted);
  proxy.castShadow = true;
  low.add(proxy);
  low.position.copy(high.position);
  low.visible = false;
  scene.add(low);
  lodObjects.push({ high, low, threshold: 58 });
}

function createScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9db7bd);
  scene.fog = new THREE.Fog(0x9db7bd, 65, 230);
  camera = new THREE.PerspectiveCamera(48, 1, 0.1, 650);
  camera.position.set(25, 18, 32);
  controls = new OrbitControls(camera, viewport);
  controls.target.set(0, 1.2, -7);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 9;
  controls.maxDistance = 105;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.update();

  const hemi = new THREE.HemisphereLight(0xc9e2ee, 0x4c5144, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe5bd, 3.2);
  sun.position.set(-28, 42, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -48;
  sun.shadow.camera.right = 48;
  sun.shadow.camera.top = 48;
  sun.shadow.camera.bottom = -48;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 110;
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xb6d8e8, 0.55);
  fill.position.set(22, 16, -28);
  scene.add(fill);

  const materials = createMaterialSet();
  addGround(materials);
  addMaterialStudy(materials);
  addCalibrationObjects(materials);
  const water = addWaterFeature();
  const dust = addAtmosphere();
  const rain = addRain();

  const ambient = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 24), new THREE.MeshStandardMaterial({ color: 0xd5e4cb, roughness: 0.25 }));
  ambient.position.set(0, 1.1, 4);
  ambient.castShadow = true;
  scene.add(ambient);

  return { sun, hemi, fill, water, dust, rain };
}

let lights;
function configureRenderer() {
  if (!webglAvailable()) throw new Error("এই browser বা device-এ WebGL 2 পাওয়া যায়নি। Chrome update করে অথবা WebGL support-যুক্ত browser ব্যবহার করে দেখো।");
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance", stencil: false, depth: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
  renderer.domElement.setAttribute("aria-label", "Interactive real-time 3D PBR material scene");
  renderer.domElement.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    showError(new Error("Graphics context হারিয়ে গেছে। Browser বা device-এর GPU memory চাপের কারণে এমন হতে পারে। আবার চেষ্টা করো।"));
  });
  viewport.appendChild(renderer.domElement);
  lights = createScene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  environmentMap = pmrem.fromScene(environment, 0.04).texture;
  scene.environment = environmentMap;
  pmrem.dispose();
  environment.dispose();
  resourceTracker = new ResourceTracker();
  resourceTracker.trackScene(scene);
  resourceTracker.track(environmentMap);
  occlusionCuller = new OcclusionCuller(THREE, camera, { intervalFrames: 6, maxRaysPerFrame: 42 });
  scene.traverse(object => {
    if (object.userData.occluder) occlusionSources.push(object);
    if (object.userData.occludee) occlusionTargets.push(object);
    if (object.userData.collider && object.isMesh) {
      object.geometry.computeBoundingBox();
      const bounds = new THREE.Box3().setFromObject(object);
      if (!collisionWorld) collisionWorld = new CollisionWorld({ cellSize: 12 });
      collisionWorld.add(object.uuid, { min: bounds.min, max: bounds.max }, object);
    }
  });
  occlusionCuller.setOccluders(occlusionSources);
  for (const object of occlusionTargets) occlusionCuller.register(object);
  collisionPairCount = collisionWorld ? collisionWorld.getPotentialPairs().length : 0;
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);
  updateQualityLabel();
  $("webgl-status").textContent = "WEBGL 2";
  $("render-state").textContent = "RENDERING";
  status.remove();
}

function resize() {
  if (!renderer || !camera) return;
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65) * adaptiveScale);
  renderer.setSize(width, height, false);
}

function updateQualityLabel() {
  $("quality-label").textContent = qualityTier + " QUALITY";
  $("render-scale").textContent = Math.round(adaptiveScale * 100) + "%";
}

function updateLod() {
  for (const item of lodObjects) {
    const distance = camera.position.distanceTo(item.high.position);
    const useLow = distance > item.threshold;
    item.high.visible = !useLow;
    item.low.visible = useLow;
  }
}

function updateTelemetry(now) {
  fpsFrames++;
  if (now - fpsStart >= 1000) {
    const fps = Math.round(fpsFrames * 1000 / (now - fpsStart));
    $("fps").textContent = String(fps);
    fpsFrames = 0;
    fpsStart = now;
  }
  const delta = now - lastFrame;
  $("frame-time").textContent = delta.toFixed(1) + " ms";
  lastFrame = now;
  $("draw-calls").textContent = String(renderer.info.render.calls);
  $("triangles").textContent = renderer.info.render.triangles.toLocaleString();
  const textureBytes = resourceTracker ? estimateTextureMemoryBytes([...resourceTracker.resources].filter(item => item?.isTexture)) : 0;
  $("gpu-memory").textContent = textureBytes ? (textureBytes / 1048576).toFixed(1) + " MB*" : "—";
  $("occlusion-count").textContent = String(occlusionCuller?.occludedCount ?? 0);
  $("collision-pairs").textContent = String(collisionPairCount);
}

let slowFrames = 0, fastFrames = 0;
function adaptQuality(delta) {
  if (delta > 28) { slowFrames++; fastFrames = 0; }
  else if (delta < 17) { fastFrames++; slowFrames = Math.max(0, slowFrames - 1); }
  else { slowFrames = Math.max(0, slowFrames - 1); fastFrames = 0; }

  if (slowFrames > 100 && adaptiveScale > 0.7) {
    adaptiveScale = Math.max(0.7, adaptiveScale - 0.1);
    slowFrames = 0;
    qualityTier = "ADAPTIVE";
    resize();
    updateQualityLabel();
  } else if (fastFrames > 500 && adaptiveScale < 1) {
    adaptiveScale = Math.min(1, adaptiveScale + 0.05);
    fastFrames = 0;
    resize();
    updateQualityLabel();
  }
}

function animate(now) {
  if (disposed || document.hidden) return;
  animationFrame = requestAnimationFrame(animate);
  frameNumber++;
  const delta = Math.min(clock.getDelta(), 0.05);
  controls.update();
  updateLod();
  if (frameNumber % 6 === 0) occlusionCuller?.update();

  const water = lights.water;
  const waterAttribute = water.geometry.attributes.position;
  const base = water.userData.basePositions;
  const elapsed = clock.elapsedTime;
  for (let i = 0; i < waterAttribute.count; i++) {
    const x = base[i * 3], z = base[i * 3 + 2];
    waterAttribute.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(x * 0.7 + elapsed * 1.4) * 0.025 + Math.cos(z * 0.55 + elapsed) * 0.02;
  }
  waterAttribute.needsUpdate = true;
  water.geometry.computeVertexNormals();

  const dustAttribute = lights.dust.geometry.attributes.position;
  const speeds = lights.dust.userData.speeds;
  for (let i = 0; i < dustAttribute.count; i++) {
    const y = i * 3 + 1;
    dustAttribute.array[y] -= speeds[i] * delta * 0.22;
    if (dustAttribute.array[y] < 0.2) dustAttribute.array[y] = 18 + Math.random() * 4;
  }
  dustAttribute.needsUpdate = true;

  if (lights.rain.visible) {
    const rainAttribute = lights.rain.geometry.attributes.position;
    for (let i = 0; i < rainAttribute.count; i++) {
      const y = i * 3 + 1;
      rainAttribute.array[y] -= 16 * delta;
      if (rainAttribute.array[y] < 0) {
        rainAttribute.array[y] = 25 + Math.random() * 8;
        rainAttribute.array[i * 3] = (Math.random() - 0.5) * 75;
        rainAttribute.array[i * 3 + 2] = (Math.random() - 0.5) * 100;
      }
    }
    rainAttribute.needsUpdate = true;
  }

  renderer.render(scene, camera);
  updateTelemetry(now);
  adaptQuality(delta * 1000);
}

function applyVisualPresets() {
  if (!lights || !renderer) return;
  let sunColor, sunIntensity, sunPosition, hemiSky, hemiGround, hemiIntensity, fillIntensity;
  let background, exposure;
  if (lightingPreset === "sunset") {
    sunColor = 0xffa45f; sunIntensity = 2.25; sunPosition = [-35, 13, 18];
    hemiSky = 0xffc69b; hemiGround = 0x49352e; hemiIntensity = 0.85;
    fillIntensity = 0.28; background = 0x9c7467; exposure = 1.15;
  } else if (lightingPreset === "night") {
    sunColor = 0x9bb8ff; sunIntensity = 0.28; sunPosition = [-12, 8, 18];
    hemiSky = 0x526d9c; hemiGround = 0x101a20; hemiIntensity = 0.38;
    fillIntensity = 0.9; background = 0x111b2b; exposure = 0.8;
  } else {
    sunColor = 0xffe5bd; sunIntensity = 3.2; sunPosition = [-28, 42, 22];
    hemiSky = 0xc9e2ee; hemiGround = 0x4c5144; hemiIntensity = 1.35;
    fillIntensity = 0.55; background = 0x9db7bd; exposure = 1.08;
  }
  const rain = weatherPreset === "rain", dust = weatherPreset === "dust";
  lights.sun.color.set(sunColor); lights.sun.intensity = sunIntensity; lights.sun.position.set(...sunPosition);
  lights.hemi.color.set(hemiSky); lights.hemi.groundColor.set(hemiGround);
  lights.hemi.intensity = hemiIntensity * (rain ? 0.78 : dust ? 0.92 : 1);
  lights.fill.intensity = fillIntensity * (rain ? 1.15 : 1);
  scene.background.set(background);
  scene.fog.color.set(dust ? 0x9c927d : background);
  scene.fog.near = rain ? 28 : dust ? 18 : 65;
  scene.fog.far = rain ? 145 : dust ? 95 : 230;
  renderer.toneMappingExposure = exposure;
  lights.rain.visible = rain;
  lights.dust.visible = dust;
}

function setLightingPreset(value) {
  lightingPreset = value;
  applyVisualPresets();
}

function setWeather(value) {
  weatherPreset = value;
  applyVisualPresets();
}

function showError(error) {
  console.error("Banglar Alef renderer:", error);
  status?.remove();
  errorMessage.textContent = error instanceof Error ? error.message : "অজানা renderer error";
  errorPanel.hidden = false;
  $("webgl-status").textContent = "ERROR";
  $("render-state").textContent = "FAILED";
}

function disposeRenderer() {
  disposed = true;
  occlusionCuller?.dispose();
  occlusionCuller = null;
  collisionWorld?.clear();
  collisionWorld = null;
  occlusionTargets.length = 0;
  occlusionSources.length = 0;
  if (resourceTracker) {
    resourceTracker.trackScene(scene);
    resourceTracker.track(environmentMap);
    resourceTracker.dispose();
    resourceTracker = null;
  }
  if (animationFrame) cancelAnimationFrame(animationFrame);
  resizeObserver?.disconnect();
  controls?.dispose();
  environmentMap = null;
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }
  renderer = scene = camera = controls = null;
  lights = null;
  lodObjects.length = 0;
}

async function start() {
  try {
    errorPanel.hidden = true;
    disposed = false;
    const threeModule = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js");
    const controlsModule = await import("three/addons/controls/OrbitControls.js");
    const environmentModule = await import("three/addons/environments/RoomEnvironment.js");
    THREE = threeModule;
    OrbitControls = controlsModule.OrbitControls;
    RoomEnvironment = environmentModule.RoomEnvironment;
    clock = new THREE.Clock();
    configureRenderer();
    setWeather($("weather-mode").value);
    animationFrame = requestAnimationFrame(animate);
  } catch (error) {
    showError(error);
  }
}

$("time-of-day").addEventListener("change", event => setLightingPreset(event.target.value));
$("weather-mode").addEventListener("change", event => setWeather(event.target.value));
$("reset-camera").addEventListener("click", () => {
  if (!camera || !controls) return;
  camera.position.set(25, 18, 32);
  controls.target.set(0, 1.2, -7);
  controls.update();
});

$("retry-renderer").addEventListener("click", () => {
  disposeRenderer();
  status.textContent = "3D renderer আবার প্রস্তুত হচ্ছে…";
  viewport.prepend(status);
  start();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    clock?.stop();
  } else if (!disposed && renderer && !animationFrame) {
    clock?.start();
    animationFrame = requestAnimationFrame(animate);
  }
});
window.addEventListener("pagehide", disposeRenderer, { once: true });
start();