import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  const response = await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle", timeout: 45000 });
  assert.equal(response.status(), 200, "game page should load");
  await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 30000 });
  assert.equal(await page.locator("#view").count(), 1);
  await page.locator("#start").click();
  await page.waitForFunction(() => document.querySelector("#overlay").classList.contains("hidden"));
  await page.keyboard.down("w");
  await page.waitForTimeout(350);
  await page.keyboard.up("w");
  const speed = await page.locator("#speed").textContent();
  assert.ok(Number(speed.replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d))) > 0, "vehicle should accelerate when W is held");
  await page.locator("#pause").click();
  assert.equal(await page.locator("#pausePanel").isVisible(), true, "pause panel should open");
  assert.deepEqual(errors, [], "browser should not report uncaught JavaScript errors");
  console.log("Browser smoke test passed: page, WebGL runtime, start, acceleration, pause.");
} finally {
  await browser.close();
}
