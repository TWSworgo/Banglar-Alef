import { chromium } from "playwright";
const browser = await chromium.launch({headless:true,args:["--enable-webgl","--ignore-gpu-blocklist","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.on("pageerror",error=>errors.push(error.message));
  const response=await page.goto("http://127.0.0.1:4173/city.html?fixture=1",{waitUntil:"domcontentloaded"});
  if(!response?.ok()) throw new Error("City lab did not return HTTP 200");
  await page.waitForSelector("#city-viewport canvas",{timeout:30000});
  await page.locator("#load-city").click();
  await page.waitForFunction(()=>window.__cityDiagnostics?.buildings===1,{timeout:30000});
  const result=await page.evaluate(()=>({
    diagnostics:window.__cityDiagnostics,
    roadWays:document.querySelector("#road-ways").textContent,
    roadSegments:document.querySelector("#road-segments").textContent,
    buildings:document.querySelector("#buildings").textContent,
    status:document.querySelector("#city-status").textContent,
    canvas:!!document.querySelector("#city-viewport canvas")
  }));
  if(result.diagnostics.roadWays!==2 || result.diagnostics.buildings!==1) throw new Error("OSM fixture conversion counts are wrong: "+JSON.stringify(result));
  if(result.diagnostics.facadeWindows<1 || result.diagnostics.roadMarkings<1) throw new Error("Procedural facade or road-detail geometry is missing: "+JSON.stringify(result));
  if(!result.canvas || !result.roadSegments || !result.status.includes("লোড সম্পন্ন")) throw new Error("3D city lab did not finish rendering");
  if(errors.length) throw new Error(errors.join("; "));
  console.log("Mobile viewport OSM-to-3D city acceptance passed: "+JSON.stringify(result));
} finally { await browser.close(); }
