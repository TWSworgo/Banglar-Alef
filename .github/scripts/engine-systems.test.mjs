import test from "node:test";
import assert from "node:assert/strict";
import { CollisionWorld, SpatialHash3D, ResourceTracker, estimateTextureMemoryBytes } from "../../engine-systems.js";

const box = (x1, y1, z1, x2, y2, z2) => ({
  min: { x: x1, y: y1, z: z1 },
  max: { x: x2, y: y2, z: z2 }
});

test("spatial hash returns exact overlapping candidates across cell boundaries", () => {
  const hash = new SpatialHash3D(10);
  hash.insert("a", box(8, 0, 0, 12, 2, 2), "A");
  hash.insert("b", box(30, 0, 0, 32, 2, 2), "B");
  assert.deepEqual(hash.query(box(11, 1, 1, 14, 3, 3)), ["A"]);
  assert.deepEqual(hash.query(box(20, 1, 1, 21, 2, 2)), []);
});

test("spatial hash update and removal leave no stale cell references", () => {
  const hash = new SpatialHash3D(4);
  hash.insert("moving", box(0, 0, 0, 1, 1, 1), "body");
  assert.equal(hash.update("moving", box(20, 0, 0, 21, 1, 1)), true);
  assert.deepEqual(hash.query(box(0, 0, 0, 2, 2, 2)), []);
  assert.deepEqual(hash.query(box(20, 0, 0, 22, 2, 2)), ["body"]);
  assert.equal(hash.remove("moving"), true);
  assert.equal(hash.entries.size, 0);
});

test("collision world reports each broadphase pair exactly once", () => {
  const world = new CollisionWorld({ cellSize: 5 });
  world.add("car-1", box(0, 0, 0, 3, 2, 5));
  world.add("car-2", box(2, 0, 0, 5, 2, 5));
  world.add("car-3", box(20, 0, 0, 23, 2, 5));
  const pairs = world.getPotentialPairs();
  assert.equal(pairs.length, 1);
  assert.deepEqual(new Set(pairs[0].map(item => item.id)), new Set(["car-1", "car-2"]));
  world.update("car-2", box(10, 0, 0, 13, 2, 5));
  assert.equal(world.getPotentialPairs().length, 0);
  world.remove("car-1");
  assert.equal(world.colliders.size, 2);
});

test("resource tracker disposes shared resources only once", () => {
  const tracker = new ResourceTracker();
  let disposed = 0;
  const resource = { dispose() { disposed++; } };
  tracker.track(resource);
  tracker.track(resource);
  assert.equal(tracker.dispose(), 1);
  assert.equal(disposed, 1);
  assert.equal(tracker.size, 0);
});

test("texture memory estimate accounts for mipmaps and deduplicates textures", () => {
  const texture = { image: { width: 256, height: 128 }, generateMipmaps: true };
  assert.equal(estimateTextureMemoryBytes([texture, texture]), Math.round(256 * 128 * 4 * 4 / 3));
});
