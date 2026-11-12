import test from "node:test";
import assert from "node:assert/strict";
import { UTTARA_PILOT, buildOverpassQuery, projectCoordinates, getRoadWidth, parseOSMData, fetchOSMExtract } from "../../city-world.js";

test("Uttara pilot bounds generate a bounded OSM roads and buildings query", () => {
  const query = buildOverpassQuery();
  assert.match(query, /way\["highway"\]/);
  assert.match(query, /way\["building"\]/);
  assert.match(query, /23\.865,90\.375,23\.88,90\.395/);
  assert.throws(() => buildOverpassQuery({south:2,west:3,north:1,east:4}), RangeError);
});

test("geographic coordinates convert to local metre coordinates with north as negative Z", () => {
  const origin = {lat:23.87,lon:90.385};
  assert.deepEqual(projectCoordinates(origin.lat,origin.lon,origin.lat,origin.lon),{x:0,z:0});
  const east = projectCoordinates(origin.lat,origin.lon+0.001,origin.lat,origin.lon);
  const north = projectCoordinates(origin.lat+0.001,origin.lon,origin.lat,origin.lon);
  assert.ok(east.x > 100 && east.x < 103);
  assert.ok(north.z < -110);
});

test("road width respects OSM width and highway class tags", () => {
  assert.equal(getRoadWidth({highway:"primary"}),10);
  assert.equal(getRoadWidth({highway:"residential"}),5.5);
  assert.equal(getRoadWidth({highway:"residential",width:"7.2"}),7.2);
  assert.equal(getRoadWidth({highway:"footway"}),1.8);
});

test("OSM parser separates road ways and closed building footprints", () => {
  const data = {elements:[
    {type:"way",id:1,tags:{highway:"primary",name:"Test Road"},geometry:[{lat:23.87,lon:90.38},{lat:23.871,lon:90.381}]},
    {type:"way",id:2,tags:{building:"yes","building:levels":"3"},geometry:[{lat:23.87,lon:90.38},{lat:23.87,lon:90.381},{lat:23.871,lon:90.381},{lat:23.871,lon:90.38},{lat:23.87,lon:90.38}]},
    {type:"node",id:3,tags:{amenity:"bench"},lat:23.87,lon:90.38}
  ]};
  const parsed = parseOSMData(data,UTTARA_PILOT.bounds);
  assert.equal(parsed.roads.length,1);
  assert.equal(parsed.roads[0].name,"Test Road");
  assert.equal(parsed.roads[0].points.length,2);
  assert.equal(parsed.buildings.length,1);
  assert.equal(parsed.buildings[0].polygon.length,4);
  assert.equal(parsed.buildings[0].height,9.45);
});

test("OSM parser rejects malformed data and ignores unusable geometry", () => {
  assert.throws(() => parseOSMData({elements:null}),TypeError);
  const parsed = parseOSMData({elements:[{type:"way",id:1,tags:{highway:"residential"},geometry:[{lat:1,lon:2}]}]});
  assert.equal(parsed.roads.length,0);
  assert.equal(parsed.buildings.length,0);
});

test("OSM fetch races mirrors and returns the first healthy response", async () => {
  const calls = [];
  const fetchImpl = (endpoint, options) => {
    calls.push(endpoint);
    if (endpoint === "slow") return new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
    return Promise.resolve({ ok:true, json:async()=>({elements:[]}) });
  };
  const result = await fetchOSMExtract({ fetchImpl, endpoints:["slow","fast"], timeoutMs:100 });
  assert.equal(result.endpoint,"fast");
  assert.deepEqual(calls.sort(),["fast","slow"]);
});

test("OSM fetch applies a bounded timeout when every mirror stalls", async () => {
  const fetchImpl = (_endpoint, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once:true });
  });
  await assert.rejects(
    fetchOSMExtract({ fetchImpl, endpoints:["slow-a","slow-b"], timeoutMs:10 }),
    /দুইটি OpenStreetMap সার্ভার/
  );
});
