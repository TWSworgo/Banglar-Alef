import { chromium } from "playwright";

const failures = [];
const browserErrors = [];
const browserWarnings = [];
const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader"
  ]
});

async function verifyViewport(name, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1440, height: 900 },
    deviceScaleFactor: options.deviceScaleFactor ?? 1,
    isMobile: options.isMobile ?? false,
    hasTouch: options.hasTouch ?? false
  });
  const page = await context.newPage();
  page.on("pageerror", error => browserErrors.push(name + ": " + error.message));
  page.on("console", message => {
    if (message.type() === "error") browserErrors.push(name + " console: " + message.text());
    if (message.type() === "warning") browserWarnings.push(name + " warning: " + message.text());
  });

  const response = await page.goto("http://127.0.0.1:4173/engine.html", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  if (!response?.ok()) failures.push(name + ": engine page did not return HTTP 200");

  await page.waitForFunction(() => {
    const state = document.querySelector("#render-state")?.textContent;
    return state === "RENDERING" || state === "FAILED";
  }, { timeout: 45000 });

  const state = await page.locator("#render-state").textContent();
  if (state !== "RENDERING") {
    const reason = await page.locator("#scene-error-message").textContent().catch(() => "unknown");
    failures.push(name + ": renderer failed: " + reason);
    await context.close();
    return;
  }

  await page.waitForFunction(() => {
    const fps = document.querySelector("#fps")?.textContent;
    const assets = document.querySelector("#asset-pipeline-status")?.textContent;
    return fps && fps !== "—" && assets && assets !== "INITIALIZING";
  }, { timeout: 30000 });
  const assetStatus = await page.locator("#asset-pipeline-status").textContent();
  console.log(name + " asset pipeline: " + assetStatus);
  if (!assetStatus?.includes("READY")) failures.push(name + ": glTF asset pipeline did not initialize");

  const gltfBuffer = Buffer.alloc(42);
  const vertexValues = [-1, 0, 0, 1, 0, 0, 0, 1, 0];
  vertexValues.forEach((value, index) => gltfBuffer.writeFloatLE(value, index * 4));
  [0, 1, 2].forEach((value, index) => gltfBuffer.writeUInt16LE(value, 36 + index * 2));
  const gltfFixture = {
    asset: { version: "2.0", generator: "Banglar Alef CI fixture" },
    buffers: [{ byteLength: 42, uri: "data:application/octet-stream;base64," + gltfBuffer.toString("base64") }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 }
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [-1, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" }
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0
  };
  const gltfDataUrl = "data:model/gltf+json;base64," + Buffer.from(JSON.stringify(gltfFixture)).toString("base64");
  const loadedAsset = await page.evaluate(async dataUrl => {
    const module = await import("./engine.js");
    if (!module.assetPipeline) return { count: 0, boundsReady: false };
    const asset = await module.assetPipeline.loadGLTF(dataUrl);
    const meshes = [];
    asset.scene.traverse(object => { if (object.isMesh) meshes.push(object); });
    return { count: meshes.length, boundsReady: meshes.every(mesh => Boolean(mesh.geometry.boundingBox && mesh.geometry.boundingSphere)) };
  }, gltfDataUrl);
  if (loadedAsset.count !== 1 || !loadedAsset.boundsReady) failures.push(name + ": glTF fixture failed to load or prepare geometry bounds");

  const canvas = page.locator("#viewport canvas");
  if (!(await canvas.isVisible())) failures.push(name + ": WebGL canvas is not visible");

  const webgl = await canvas.evaluate(node => {
    const gl = node.getContext("webgl2");
    return Boolean(gl && gl.getParameter(gl.VERSION));
  });
  if (!webgl) failures.push(name + ": WebGL 2 context is unavailable");

  await page.locator("#time-of-day").selectOption("night");
  await page.locator("#weather-mode").selectOption("rain");
  await page.locator("#time-of-day").selectOption("sunset");
  await page.locator("#weather-mode").selectOption("dust");
  await page.locator("#time-of-day").selectOption("day");
  await page.locator("#weather-mode").selectOption("clear");
  await page.locator("#reset-camera").click();

  await page.waitForTimeout(1200);
  const occlusionWorks = await page.evaluate(async () => {
    const THREE = await import("three");
    const { OcclusionCuller } = await import("./engine-systems.js");
    const testCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    testCamera.position.set(0, 0, 5);
    testCamera.lookAt(0, 0, 0);
    testCamera.updateMatrixWorld();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.2), new THREE.MeshBasicMaterial());
    wall.position.z = 1;
    const target = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshBasicMaterial());
    target.position.z = 0;
    const testScene = new THREE.Scene();
    testScene.add(wall, target);
    const culler = new OcclusionCuller(THREE, testCamera, { intervalFrames: 1, maxRaysPerFrame: 20 });
    culler.setOccluders([wall]);
    culler.register(target);
    culler.update();
    const hidden = target.visible === false && culler.occludedCount === 1;
    culler.dispose();
    wall.geometry.dispose(); wall.material.dispose();
    target.geometry.dispose(); target.material.dispose();
    return hidden;
  });
  if (!occlusionWorks) failures.push(name + ": occlusion culler did not reject a fully hidden object");

  const metrics = await page.evaluate(() => ({
    fps: document.querySelector("#fps")?.textContent,
    calls: document.querySelector("#draw-calls")?.textContent,
    triangles: document.querySelector("#triangles")?.textContent,
    scale: document.querySelector("#render-scale")?.textContent,
    memory: document.querySelector("#gpu-memory")?.textContent,
    occluded: document.querySelector("#occlusion-count")?.textContent,
    collisionPairs: document.querySelector("#collision-pairs")?.textContent
  }));
  if (!metrics.fps || metrics.fps === "—") failures.push(name + ": FPS telemetry missing");
  if (!metrics.calls || metrics.calls === "—" || Number(metrics.calls) <= 0) failures.push(name + ": no draw calls were submitted");
  if (!metrics.triangles || metrics.triangles === "—" || Number(metrics.triangles.replaceAll(",", "")) <= 0) failures.push(name + ": no triangles were rendered");
  if (!metrics.memory || metrics.memory === "—") failures.push(name + ": GPU texture memory estimate missing");
  if (metrics.occluded === undefined) failures.push(name + ": occlusion telemetry missing");
  if (metrics.collisionPairs === undefined || Number(metrics.collisionPairs) <= 0) failures.push(name + ": collision broadphase did not register overlapping scene colliders");

  console.log(name + " viewport passed: " + JSON.stringify(metrics));
  await context.close();
}

try {
  await verifyViewport("desktop");
  await verifyViewport("mobile", {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
} finally {
  await browser.close();
}

if (browserErrors.length) failures.push(...browserErrors);
if (failures.length) {
  for (const failure of failures) console.error("FAIL: " + failure);
  process.exit(1);
}
for (const warning of browserWarnings) console.log("WARN: " + warning);
console.log("All headless browser acceptance checks passed.");
