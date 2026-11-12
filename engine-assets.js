// glTF 2.0 asset pipeline with optional Draco geometry and KTX2 texture support.
export class AssetPipeline {
  constructor({ loader, dracoLoader = null, ktx2Loader = null } = {}) {
    if (!loader?.loadAsync) throw new TypeError("A GLTF-compatible loader with loadAsync() is required");
    this.loader = loader;
    this.dracoLoader = dracoLoader;
    this.ktx2Loader = ktx2Loader;
    this.cache = new Map();
    this.inflight = new Map();
  }

  async loadGLTF(url, { onProgress } = {}) {
    if (typeof url !== "string" || !url.trim()) throw new TypeError("Asset URL must be a non-empty string");
    if (this.cache.has(url)) return this.cache.get(url);
    if (this.inflight.has(url)) return this.inflight.get(url);

    const pending = this.loader.loadAsync(url, event => {
      if (typeof onProgress === "function" && event.total > 0) {
        onProgress(Math.min(1, event.loaded / event.total));
      }
    }).then(gltf => {
      if (!gltf?.scene?.isObject3D) throw new Error("The glTF asset has no valid default scene: " + url);
      gltf.scene.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.geometry && !object.geometry.boundingBox) object.geometry.computeBoundingBox();
        if (object.geometry && !object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
      });
      this.cache.set(url, gltf);
      this.inflight.delete(url);
      return gltf;
    }).catch(error => {
      this.inflight.delete(url);
      throw error;
    });
    this.inflight.set(url, pending);
    return pending;
  }

  release(url) {
    const gltf = this.cache.get(url);
    if (!gltf) return false;
    gltf.scene.removeFromParent();
    const geometries = new Set(), materials = new Set(), textures = new Set();
    gltf.scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
    this.cache.delete(url);
    return true;
  }

  dispose() {
    for (const url of [...this.cache.keys()]) this.release(url);
    this.loader.dispose?.();
    this.dracoLoader?.dispose?.();
    this.ktx2Loader?.dispose?.();
    this.inflight.clear();
  }

  get loadedAssetCount() {
    return this.cache.size;
  }
}

export async function createThreeAssetPipeline(renderer) {
  const gltfModule = await import("three/addons/loaders/GLTFLoader.js");
  const loader = new gltfModule.GLTFLoader();
  let dracoLoader = null, ktx2Loader = null;

  try {
    const module = await import("three/addons/loaders/DRACOLoader.js");
    dracoLoader = new module.DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    loader.setDRACOLoader(dracoLoader);
  } catch (error) {
    console.warn("Draco decoder unavailable; uncompressed glTF models remain supported.", error);
  }

  try {
    const module = await import("three/addons/loaders/KTX2Loader.js");
    ktx2Loader = new module.KTX2Loader();
    ktx2Loader.setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/basis/");
    ktx2Loader.detectSupport(renderer);
    loader.setKTX2Loader(ktx2Loader);
  } catch (error) {
    ktx2Loader?.dispose?.();
    ktx2Loader = null;
    console.warn("KTX2 textures unavailable; standard glTF textures remain supported.", error);
  }

  return new AssetPipeline({ loader, dracoLoader, ktx2Loader });
}
