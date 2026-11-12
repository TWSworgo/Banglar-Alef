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
  const response = await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle", timeout: 45000 });
  assert.equal(response.status(), 200, "game page should load");
  try { await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 15000 }); }
  catch (error) { console.log("RUNTIME DIAGNOSTICS", JSON.stringify({ errors, consoleErrors, failedRequests, html: await page.locator("body").innerText() })); throw error; }
  for (const selector of ["#loss", "#battery", "#best", "#anger", "#map", "#start", "#pause", "#horn", "#bomb", "#camera"]) {
    assert.equal(await page.locator(selector).count(), 1, selector + " should exist");
  }
  await page.locator("#start").click();
  await page.keyboard.down("w");
  await page.waitForTimeout(650);
  await page.keyboard.up("w");
  assert.ok(await page.evaluate(() => window.__GAME_STATE__.speed > 0), "vehicle should accelerate");
  await page.keyboard.press("h");
  await page.keyboard.press("x");
  await page.keyboard.press("c");
  await page.locator("#pause").click();
  assert.equal(await page.locator("#pausePanel").isVisible(), true, "pause panel should open");
  await page.locator("#resume").click();
  assert.equal(await page.locator("#pausePanel").isVisible(), false, "resume should close pause panel");
  assert.deepEqual(errors, [], "browser should not report uncaught JavaScript errors");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.on("pageerror", error => errors.push(error.message));
  await mobile.goto("http://127.0.0.1:4173", { waitUntil: "networkidle", timeout: 45000 });
  await mobile.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 30000 });
  await mobile.locator("#start").click();
  await mobile.locator('[data-control="throttle"]').dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", isPrimary: true });
  await mobile.waitForTimeout(500);
  assert.ok(await mobile.evaluate(() => window.__GAME_STATE__.speed > 0), "mobile throttle should accelerate");
  await mobile.locator('[data-control="throttle"]').dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", isPrimary: true });
  assert.deepEqual(errors, [], "desktop and mobile should have no uncaught JavaScript errors");
  console.log("Browser smoke test passed: desktop/mobile load, WebGL init, driving input, utility controls, pause/resume.");
} finally {
  await browser.close();
}
