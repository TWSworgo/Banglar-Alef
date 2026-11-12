import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Procedural Dhaka street and Banglar Alef three-wheeler showcase.
// Geometry is intentionally lightweight and uses shared materials for mobile rendering.

function box(THREE, parent, size, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  if (options.name) mesh.name = options.name;
  if (options.collider) mesh.userData.collider = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(THREE, parent, radiusTop, radiusBottom, height, position, material, segments = 16, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function sphere(THREE, parent, radius, position, material, widthSegments = 16, heightSegments = 12) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, widthSegments, heightSegments), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function rod(THREE, parent, start, end, radius, material, segments = 8) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), segments), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}


function mergeStaticMeshes(THREE, group, excluded = null) {
  group.updateMatrixWorld(true);
  const batches = new Map();
  const originals = [];

  function visit(object) {
    if (object === excluded) return;
    if (object.isMesh && object.geometry && !object.isInstancedMesh) {
      const material = object.material;
      if (!batches.has(material)) batches.set(material, { geometries: [], meshes: [], collider: false, castShadow: false, receiveShadow: false });
      const batch = batches.get(material);
      const geometry = object.geometry.clone();
      const relative = new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(object.matrixWorld);
      geometry.applyMatrix4(relative);
      batch.geometries.push(geometry);
      batch.meshes.push(object);
      batch.collider ||= Boolean(object.userData.collider);
      batch.castShadow ||= object.castShadow;
      batch.receiveShadow ||= object.receiveShadow;
      originals.push(object);
    }
    for (const child of object.children) visit(child);
  }

  visit(group);
  let mergedCount = 0;
  for (const [material, batch] of batches) {
    const merged = mergeGeometries(batch.geometries, false);
    for (const geometry of batch.geometries) geometry.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = group.name + "-merged-" + (++mergedCount);
    mesh.castShadow = batch.castShadow;
    mesh.receiveShadow = batch.receiveShadow;
    if (batch.collider) mesh.userData.collider = true;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    group.add(mesh);
    for (const original of batch.meshes) original.removeFromParent();
  }

  const disposed = new Set();
  for (const original of originals) {
    if (!original.parent && original.geometry && !disposed.has(original.geometry)) {
      disposed.add(original.geometry);
      original.geometry.dispose();
    }
  }
  return mergedCount;
}

function makePlateTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f2e8c8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#18382e";
  ctx.lineWidth = 9;
  ctx.strokeRect(5, 5, 502, 118);
  ctx.fillStyle = "#17382e";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 62px sans-serif";
  ctx.fillText("বাংলার আলেফ", 256, 65);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeFacadeTexture(THREE, palette) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = palette.wall;
  ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = palette.edge;
  for (let y = 0; y < 512; y += 96) ctx.fillRect(0, y, 256, 8);
  for (let y = 24; y < 470; y += 96) {
    for (let x = 18; x < 238; x += 72) {
      ctx.fillStyle = "#263b3a";
      ctx.fillRect(x, y, 48, 54);
      ctx.fillStyle = palette.glass;
      ctx.fillRect(x + 4, y + 4, 40, 43);
      ctx.fillStyle = "#d9c6a2";
      ctx.fillRect(x + 22, y + 4, 3, 43);
      ctx.fillRect(x + 4, y + 22, 40, 3);
      ctx.fillStyle = palette.edge;
      ctx.fillRect(x - 3, y + 51, 54, 5);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 2;
  return texture;
}

function addDhakaBuildings(THREE, root) {
  const palettes = [
    { wall: "#b6a58d", edge: "#796b59", glass: "#718b87" },
    { wall: "#a9b2a0", edge: "#657565", glass: "#637e83" },
    { wall: "#c2aa91", edge: "#816d5b", glass: "#718c91" }
  ];
  const materials = palettes.map(palette => new THREE.MeshStandardMaterial({
    map: makeFacadeTexture(THREE, palette), roughness: 0.88, metalness: 0.02
  }));
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const heights = [11, 16, 9, 14, 12, 18, 10, 15, 12, 17];
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const width = 8 + (row % 2) * 2;
    const height = heights[i];
    const depth = 11 + (row % 3) * 2;
    const building = new THREE.Mesh(geometry, materials[i % materials.length]);
    building.scale.set(width, height, depth);
    building.position.set(side * (19 + width / 2), height / 2 - 0.08, -54 + row * 27);
    building.castShadow = true;
    building.receiveShadow = true;
    building.name = "dhaka-street-building-" + i;
    root.add(building);
  }
}

function addStreetFurniture(THREE, root) {
  const trunk = new THREE.MeshStandardMaterial({ color: 0x65513b, roughness: 0.95 });
  const foliage = new THREE.MeshStandardMaterial({ color: 0x356b45, roughness: 0.92 });
  const pole = new THREE.MeshStandardMaterial({ color: 0x59635e, metalness: 0.72, roughness: 0.34 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffe5a4, emissive: 0xffc86b, emissiveIntensity: 0.25, roughness: 0.3 });
  for (const side of [-1, 1]) {
    for (const z of [-35, 8, 49]) {
      cylinder(THREE, root, 0.12, 0.18, 3.2, [side * 17.2, 1.55, z], trunk, 8);
      sphere(THREE, root, 1.35, [side * 17.2, 3.6, z], foliage, 10, 8);
    }
    for (const z of [-22, 31]) {
      cylinder(THREE, root, 0.055, 0.075, 6.4, [side * 17.8, 3.2, z], pole, 8);
      rod(THREE, root, [side * 17.8, 6.1, z], [side * 16.8, 6.35, z], 0.045, pole, 6);
      box(THREE, root, [0.34, 0.12, 0.2], [side * 16.75, 6.28, z], lamp, { castShadow: false });
    }
  }
}

export function buildDhakaShowcase(THREE, scene, sourceMaterials) {
  const root = new THREE.Group();
  root.name = "banglar-alef-dhaka-showcase";
  addDhakaBuildings(THREE, root);
  addStreetFurniture(THREE, root);

  const body = new THREE.Group();
  body.name = "banglar-alef-cng";
  root.add(body);

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x087b5e, roughness: 0.34, metalness: 0.2, clearcoat: 0.72, clearcoatRoughness: 0.2
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0x18231f, roughness: 0.72, metalness: 0.12 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb9c4bd, roughness: 0.22, metalness: 0.88 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x8eb8b3, roughness: 0.12, metalness: 0.05, transmission: 0.08,
    transparent: true, opacity: 0.72, thickness: 0.12, ior: 1.46
  });
  const seat = new THREE.MeshStandardMaterial({ color: 0x342a21, roughness: 0.92 });
  const headlamp = new THREE.MeshStandardMaterial({ color: 0xfff1c7, emissive: 0xffd77a, emissiveIntensity: 0.75, roughness: 0.18 });
  const tailLamp = new THREE.MeshStandardMaterial({ color: 0x9e1d18, emissive: 0x8e100a, emissiveIntensity: 0.45, roughness: 0.3 });

  box(THREE, body, [1.62, 0.72, 2.25], [0, 0.88, -0.18], paint, { collider: true, name: "CNG lower passenger body" });
  box(THREE, body, [1.18, 0.48, 0.72], [0, 0.98, 0.93], paint, { name: "CNG front cowling" });
  box(THREE, body, [1.72, 0.13, 1.82], [0, 2.02, -0.22], paint, { name: "CNG canopy roof" });
  box(THREE, body, [1.56, 0.07, 1.7], [0, 1.91, -0.22], trim);

  // Passenger compartment glazing and structural pillars.
  box(THREE, body, [1.05, 0.62, 0.045], [0, 1.55, 0.69], glass, { name: "front windshield" });
  box(THREE, body, [1.05, 0.55, 0.04], [0, 1.55, -1.31], glass, { name: "rear window" });
  for (const side of [-1, 1]) {
    box(THREE, body, [0.035, 0.62, 1.36], [side * 0.805, 1.55, -0.28], glass, { name: "side window" });
    rod(THREE, body, [side * 0.78, 1.16, 0.58], [side * 0.78, 1.98, 0.58], 0.045, chrome);
    rod(THREE, body, [side * 0.78, 1.16, -1.1], [side * 0.78, 1.98, -1.1], 0.045, chrome);
    rod(THREE, body, [side * 0.78, 1.96, 0.58], [side * 0.78, 1.96, -1.1], 0.035, chrome);
  }
  box(THREE, body, [1.35, 0.16, 0.32], [0, 1.28, -0.38], seat);
  box(THREE, body, [1.35, 0.48, 0.16], [0, 1.53, -0.98], seat);
  box(THREE, body, [0.48, 0.12, 0.34], [0, 1.32, 0.35], trim);

  // Three-wheel chassis, rubber tyres, hubs and front mudguard.
  const tire = new THREE.MeshStandardMaterial({ color: 0x151917, roughness: 0.98 });
  const hub = new THREE.MeshStandardMaterial({ color: 0x89958d, metalness: 0.78, roughness: 0.28 });
  const wheelPositions = [[0, 0.48, 1.42], [-0.91, 0.48, -0.86], [0.91, 0.48, -0.86]];
  for (const [x, y, z] of wheelPositions) {
    const wheel = cylinder(THREE, body, 0.43, 0.43, 0.24, [x, y, z], tire, 24, [0, 0, Math.PI / 2]);
    wheel.name = "CNG rubber tyre";
    cylinder(THREE, body, 0.19, 0.19, 0.255, [x, y, z], hub, 16, [0, 0, Math.PI / 2]);
    cylinder(THREE, body, 0.065, 0.065, 0.27, [x, y, z], chrome, 12, [0, 0, Math.PI / 2]);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.065, 8, 28, Math.PI), paint);
  arch.position.set(0, 0.48, 1.42);
  arch.rotation.y = Math.PI;
  arch.castShadow = true;
  body.add(arch);

  // Front fascia, grille, lamps, mirrors and bumper.
  box(THREE, body, [0.74, 0.18, 0.055], [0, 0.79, 1.31], trim);
  for (let i = 0; i < 5; i++) box(THREE, body, [0.025, 0.13, 0.02], [-0.25 + i * 0.125, 0.79, 1.345], chrome, { castShadow: false });
  for (const x of [-0.46, 0.46]) {
    sphere(THREE, body, 0.13, [x, 1.05, 1.32], headlamp, 12, 8);
    box(THREE, body, [0.18, 0.075, 0.06], [x, 0.61, 1.25], chrome);
    sphere(THREE, body, 0.075, [x, 0.88, -1.32], tailLamp, 10, 8);
    rod(THREE, body, [x * 1.25, 1.73, 0.46], [x * 1.55, 1.9, 0.55], 0.025, chrome, 6);
    box(THREE, body, [0.18, 0.12, 0.08], [x * 1.55, 1.93, 0.55], chrome);
  }
  box(THREE, body, [1.36, 0.09, 0.12], [0, 0.53, 1.29], chrome);
  box(THREE, body, [1.34, 0.07, 0.1], [0, 0.55, -1.31], chrome);

  // Roof rails, wipers and side protection strips.
  for (const side of [-1, 1]) {
    rod(THREE, body, [side * 0.7, 2.12, 0.56], [side * 0.7, 2.12, -1.05], 0.025, chrome, 6);
    box(THREE, body, [0.045, 0.08, 1.65], [side * 0.83, 0.92, -0.18], chrome);
  }
  box(THREE, body, [0.78, 0.025, 0.035], [0, 1.23, 0.72], trim, { rotation: [-0.1, 0, 0] });
  const plateTexture = makePlateTexture(THREE);
  const plateMaterial = new THREE.MeshStandardMaterial({ map: plateTexture, roughness: 0.58, metalness: 0.08 });
  box(THREE, body, [0.72, 0.2, 0.045], [0, 0.78, -1.34], plateMaterial);

  // Battery enclosure and underbody details.
  box(THREE, body, [0.72, 0.3, 0.58], [0.72, 0.55, -0.25], trim);
  box(THREE, body, [0.46, 0.08, 0.35], [0.72, 0.72, -0.25], chrome);
  body.position.set(0, 0, 0);
  body.userData.showcase = "procedural-three-wheel-CNG";
  const vehicleMeshCount = body.children.length;
  mergeStaticMeshes(THREE, body);
  mergeStaticMeshes(THREE, root, body);
  scene.add(root);
  return { root, vehicle: body, vehicleMeshCount };
}
