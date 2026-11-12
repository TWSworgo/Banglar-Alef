import { chromium } from "playwright";

const failures = [];
const browserErrors = [];
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
    return fps && fps !== "—";
  }, { timeout: 15000 });

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
  if (metrics.collisionPairs === undefined) failures.push(name + ": collision broadphase telemetry missing");

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
console.log("All headless browser acceptance checks passed.");
