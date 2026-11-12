import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
});
const errors = [], consoleErrors = [], failedRequests = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("requestfailed", req => failedRequests.push(req.url() + " :: " + req.failure()?.errorText));
  const response = await page.goto("http://127.0.0.1:4173/?test=1", { waitUntil: "networkidle", timeout: 45000 });
  assert.equal(response.status(), 200);
  try { await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 15000 }); }
  catch (error) { console.log("RUNTIME DIAGNOSTICS", JSON.stringify({ errors, consoleErrors, failedRequests })); throw error; }
  for (const selector of ["#score", "#speed", "#battery", "#best", "#accidents", "#mission", "#map", "#start", "#pause", "#horn", "#camera", "#quality", "#soundToggle"]) {
    assert.equal(await page.locator(selector).count(), 1, selector + " should exist");
  }
  await page.locator("#start").click();
  const scoreBeforeRide = await page.evaluate(() => window.__GAME_STATE__.score);
  assert.equal(await page.evaluate(() => window.__GAME_TEST__.pickup()), true, "passenger pickup should activate");
  assert.equal(await page.locator("#mission").textContent(), "যাত্রীকে গন্তব্যে পৌঁছান");
  assert.equal(await page.evaluate(() => window.__GAME_TEST__.dropoff()), true, "safe passenger dropoff should award score");
  assert.equal(await page.evaluate(() => window.__GAME_STATE__.score - scoreBeforeRide), 100);
  await page.keyboard.down("w");
  await page.waitForTimeout(650);
  await page.keyboard.up("w");
  assert.ok(await page.evaluate(() => window.__GAME_STATE__.speed > 0), "vehicle should accelerate");
  await page.keyboard.press("h");
  await page.keyboard.press("c");
  await page.locator("#pause").click();
  assert.equal(await page.locator("#pausePanel").isVisible(), true);
  await page.locator("#quality").selectOption("low");
  assert.equal(await page.evaluate(() => window.__GAME_STATE__.quality), "low");
  await page.locator("#soundToggle").click();
  assert.equal(await page.evaluate(() => window.__GAME_STATE__.muted), true);
  await page.locator("#soundToggle").click();
  await page.locator("#resume").click();
  assert.equal(await page.locator("#pausePanel").isVisible(), false);
  assert.deepEqual(errors, [], "desktop browser should have no uncaught errors");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.on("pageerror", error => errors.push(error.message));
  await mobile.goto("http://127.0.0.1:4173", { waitUntil: "networkidle", timeout: 45000 });
  await mobile.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 30000 });
  await mobile.locator("#start").click();
  await mobile.locator('[data-control="throttle"]').dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", isPrimary: true });
  await mobile.waitForTimeout(500);
  assert.ok(await mobile.evaluate(() => window.__GAME_STATE__.speed > 0), "mobile throttle should accelerate");
  await mobile.locator('[data-control="throttle"]').dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", isPrimary: true });
  assert.deepEqual(errors, [], "desktop and mobile should have no uncaught errors");
  console.log("Browser smoke test passed: desktop/mobile, WebGL, safe driving input, mission HUD, graphics/audio settings, pause/resume.");
} finally {
  await browser.close();
}
