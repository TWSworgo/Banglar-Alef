import test from "node:test";
import assert from "node:assert/strict";
import { AssetPipeline } from "../../engine-assets.js";

function makeScene(resources = {}) {
  const mesh = {
    isMesh: true,
    geometry: {
      boundingBox: null,
      boundingSphere: null,
      computeBoundingBox() { this.boundingBox = {}; },
      computeBoundingSphere() { this.boundingSphere = {}; },
      dispose() { resources.geometry = (resources.geometry || 0) + 1; }
    },
    material: {
      map: { isTexture: true, dispose() { resources.texture = (resources.texture || 0) + 1; } },
      dispose() { resources.material = (resources.material || 0) + 1; }
    },
    castShadow: false,
    receiveShadow: false
  };
  return {
    isObject3D: true,
    traverse(callback) { callback(this); callback(mesh); },
    removeFromParent() {},
    mesh
  };
}

test("asset pipeline deduplicates concurrent loads and prepares mesh bounds", async () => {
  let calls = 0;
  const scene = makeScene();
  const loader = {
    async loadAsync() {
      calls++;
      await Promise.resolve();
      return { scene };
    }
  };
  const pipeline = new AssetPipeline({ loader });
  const [first, second] = await Promise.all([
    pipeline.loadGLTF("/assets/vehicle.glb"),
    pipeline.loadGLTF("/assets/vehicle.glb")
  ]);
  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(pipeline.loadedAssetCount, 1);
  assert.equal(scene.mesh.castShadow, true);
  assert.equal(scene.mesh.receiveShadow, true);
  assert.ok(scene.mesh.geometry.boundingBox);
  assert.ok(scene.mesh.geometry.boundingSphere);
});

test("asset release disposes unique model resources and removes cache entry", async () => {
  const counts = {};
  const scene = makeScene(counts);
  const pipeline = new AssetPipeline({ loader: { async loadAsync() { return { scene }; } } });
  await pipeline.loadGLTF("/assets/props.glb");
  assert.equal(pipeline.release("/assets/props.glb"), true);
  assert.deepEqual(counts, { texture: 1, material: 1, geometry: 1 });
  assert.equal(pipeline.loadedAssetCount, 0);
  assert.equal(pipeline.release("/assets/props.glb"), false);
});

test("asset pipeline clears failed in-flight requests so a retry can succeed", async () => {
  let calls = 0;
  const scene = makeScene();
  const pipeline = new AssetPipeline({
    loader: {
      async loadAsync() {
        calls++;
        if (calls === 1) throw new Error("network unavailable");
        return { scene };
      }
    }
  });
  await assert.rejects(pipeline.loadGLTF("/assets/retry.glb"), /network unavailable/);
  await pipeline.loadGLTF("/assets/retry.glb");
  assert.equal(calls, 2);
  assert.equal(pipeline.loadedAssetCount, 1);
});
