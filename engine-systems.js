// Reusable real-time engine systems. No DOM or renderer globals are assumed.
export class SpatialHash3D {
  constructor(cellSize = 8) {
    if (!(cellSize > 0)) throw new RangeError("cellSize must be positive");
    this.cellSize = cellSize;
    this.cells = new Map();
    this.entries = new Map();
  }

  _keys(bounds) {
    const size = this.cellSize;
    const minX = Math.floor(bounds.min.x / size), maxX = Math.floor(bounds.max.x / size);
    const minY = Math.floor(bounds.min.y / size), maxY = Math.floor(bounds.max.y / size);
    const minZ = Math.floor(bounds.min.z / size), maxZ = Math.floor(bounds.max.z / size);
    const keys = [];
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++)
        for (let z = minZ; z <= maxZ; z++) keys.push(x + ":" + y + ":" + z);
    return keys;
  }

  insert(id, bounds, value = id) {
    this.remove(id);
    const keys = this._keys(bounds);
    const entry = { bounds, value, keys };
    this.entries.set(id, entry);
    for (const key of keys) {
      let bucket = this.cells.get(key);
      if (!bucket) this.cells.set(key, bucket = new Set());
      bucket.add(id);
    }
    return value;
  }

  update(id, bounds) {
    const entry = this.entries.get(id);
    if (!entry) return false;
    this.insert(id, bounds, entry.value);
    return true;
  }

  remove(id) {
    const entry = this.entries.get(id);
    if (!entry) return false;
    for (const key of entry.keys) {
      const bucket = this.cells.get(key);
      bucket?.delete(id);
      if (bucket?.size === 0) this.cells.delete(key);
    }
    this.entries.delete(id);
    return true;
  }

  query(bounds) {
    const found = new Set();
    for (const key of this._keys(bounds)) {
      for (const id of this.cells.get(key) ?? []) found.add(id);
    }
    return [...found].map(id => this.entries.get(id)).filter(Boolean)
      .filter(entry => SpatialHash3D.overlaps(bounds, entry.bounds))
      .map(entry => entry.value);
  }

  clear() {
    this.cells.clear();
    this.entries.clear();
  }

  static overlaps(a, b) {
    return a.min.x <= b.max.x && a.max.x >= b.min.x &&
      a.min.y <= b.max.y && a.max.y >= b.min.y &&
      a.min.z <= b.max.z && a.max.z >= b.min.z;
  }
}

export class CollisionWorld {
  constructor({ cellSize = 8 } = {}) {
    this.hash = new SpatialHash3D(cellSize);
    this.colliders = new Map();
  }

  add(id, bounds, data = null) {
    if (this.colliders.has(id)) throw new Error("Collider already registered: " + id);
    const collider = { id, bounds, data };
    this.colliders.set(id, collider);
    this.hash.insert(id, bounds, collider);
    return collider;
  }

  update(id, bounds) {
    const collider = this.colliders.get(id);
    if (!collider) return false;
    collider.bounds = bounds;
    this.hash.update(id, bounds);
    return true;
  }

  remove(id) {
    this.hash.remove(id);
    return this.colliders.delete(id);
  }

  query(bounds, excludeId = null) {
    return this.hash.query(bounds).filter(item => item.id !== excludeId);
  }

  getPotentialPairs() {
    const pairs = [];
    const seen = new Set();
    for (const collider of this.colliders.values()) {
      for (const other of this.query(collider.bounds, collider.id)) {
        const a = String(collider.id), b = String(other.id);
        const key = a < b ? a + "|" + b : b + "|" + a;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([collider, other]);
      }
    }
    return pairs;
  }

  clear() {
    this.colliders.clear();
    this.hash.clear();
  }
}

export class OcclusionCuller {
  constructor(THREE, camera, { intervalFrames = 6, maxRaysPerFrame = 48 } = {}) {
    this.THREE = THREE;
    this.camera = camera;
    this.intervalFrames = Math.max(1, intervalFrames);
    this.maxRaysPerFrame = Math.max(7, maxRaysPerFrame);
    this.raycaster = new THREE.Raycaster();
    this.frustum = new THREE.Frustum();
    this.projectionView = new THREE.Matrix4();
    this.occludees = new Map();
    this.occluders = [];
    this.frame = 0;
    this.rayCount = 0;
    this.occludedCount = 0;
  }

  setOccluders(objects) {
    this.occluders = objects.filter(object => object?.isObject3D);
  }

  register(object) {
    if (!object?.isObject3D) throw new TypeError("Occlusion target must be a THREE.Object3D");
    this.occludees.set(object.uuid, { object, wasVisible: object.visible, lastVisible: true });
    return () => this.unregister(object);
  }

  unregister(object) {
    const item = this.occludees.get(object.uuid);
    if (item) item.object.visible = item.wasVisible;
    return this.occludees.delete(object.uuid);
  }

  update() {
    this.frame++;
    if (this.frame % this.intervalFrames !== 0 || this.occluders.length === 0) return;
    const THREE = this.THREE;
    this.camera.updateMatrixWorld();
    this.projectionView.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projectionView);
    let rays = 0, hidden = 0;

    for (const item of this.occludees.values()) {
      const object = item.object;
      if (!object.parent || !item.wasVisible) continue;
      object.updateWorldMatrix(true, true);
      const sphere = new THREE.Sphere();
      new THREE.Box3().setFromObject(object).getBoundingSphere(sphere);
      if (!this.frustum.intersectsSphere(sphere)) {
        object.visible = false;
        item.lastVisible = false;
        continue;
      }
      if (rays + 7 > this.maxRaysPerFrame) {
        object.visible = item.lastVisible;
        continue;
      }

      const points = [
        sphere.center,
        new THREE.Vector3(sphere.center.x + sphere.radius * 0.65, sphere.center.y, sphere.center.z),
        new THREE.Vector3(sphere.center.x - sphere.radius * 0.65, sphere.center.y, sphere.center.z),
        new THREE.Vector3(sphere.center.x, sphere.center.y + sphere.radius * 0.65, sphere.center.z),
        new THREE.Vector3(sphere.center.x, sphere.center.y - sphere.radius * 0.65, sphere.center.z),
        new THREE.Vector3(sphere.center.x, sphere.center.y, sphere.center.z + sphere.radius * 0.65),
        new THREE.Vector3(sphere.center.x, sphere.center.y, sphere.center.z - sphere.radius * 0.65)
      ];
      let blocked = 0;
      for (const point of points) {
        const direction = point.clone().sub(this.camera.position);
        const distance = direction.length();
        if (distance <= 0.001) continue;
        this.raycaster.set(this.camera.position, direction.normalize());
        this.raycaster.near = 0.05;
        this.raycaster.far = Math.max(0.05, distance - sphere.radius * 0.18);
        const hits = this.raycaster.intersectObjects(this.occluders, true);
        rays++;
        if (hits.length) blocked++;
      }
      const isOccluded = blocked === points.length;
      object.visible = !isOccluded;
      item.lastVisible = !isOccluded;
      if (isOccluded) hidden++;
    }
    this.rayCount = rays;
    this.occludedCount = hidden;
  }

  dispose() {
    for (const item of this.occludees.values()) item.object.visible = item.wasVisible;
    this.occludees.clear();
    this.occluders.length = 0;
  }
}

export class ResourceTracker {
  constructor() {
    this.resources = new Set();
  }

  track(resource) {
    if (resource) this.resources.add(resource);
    return resource;
  }

  trackScene(scene) {
    scene?.traverse(object => {
      this.track(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        this.track(material);
        for (const value of Object.values(material)) {
          if (value?.isTexture) this.track(value);
        }
      }
    });
  }

  dispose() {
    for (const resource of this.resources) resource.dispose?.();
    const count = this.resources.size;
    this.resources.clear();
    return count;
  }

  get size() {
    return this.resources.size;
  }
}

export function estimateTextureMemoryBytes(textures) {
  const unique = new Set(textures.filter(Boolean));
  let total = 0;
  for (const texture of unique) {
    const image = texture.image ?? texture.source?.data;
    const width = image?.width ?? image?.videoWidth ?? 0;
    const height = image?.height ?? image?.videoHeight ?? 0;
    if (!width || !height) continue;
    const channels = texture.format === 1023 ? 1 : 4;
    total += width * height * channels * (texture.generateMipmaps === false ? 1 : 4 / 3);
  }
  return Math.round(total);
}
