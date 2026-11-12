export const UTTARA_PILOT = Object.freeze({
  id: "uttara-pilot",
  name: "উত্তরা পাইলট এলাকা",
  // Bounded pilot extract: approximately 1.7 km north-south by 2.0 km east-west.
  bounds: Object.freeze({ south: 23.865, west: 90.375, north: 23.88, east: 90.395 })
});

export function buildOverpassQuery(bounds = UTTARA_PILOT.bounds) {
  const { south, west, north, east } = bounds;
  for (const value of [south, west, north, east]) {
    if (!Number.isFinite(value)) throw new TypeError("OSM bounds must contain finite coordinates");
  }
  if (south >= north || west >= east || south < -90 || north > 90 || west < -180 || east > 180) {
    throw new RangeError("Invalid geographic bounding box");
  }
  const box = [south, west, north, east].join(",");
  return `[out:json][timeout:35];(way["highway"](${box});way["building"](${box}););out geom;`;
}

export async function fetchOSMExtract({ bounds = UTTARA_PILOT.bounds, fetchImpl = fetch, endpoints, signal, timeoutMs = 12000 } = {}) {
  const query = buildOverpassQuery(bounds);
  const mirrors = endpoints || [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  if (!mirrors.length) throw new Error("No OpenStreetMap servers are configured.");
  const controllers = [];
  const attempts = mirrors.map(endpoint => (async () => {
    const controller = new AbortController();
    controllers.push(controller);
    const abortFromParent = () => controller.abort(signal.reason);
    if (signal?.aborted) abortFromParent();
    else signal?.addEventListener("abort", abortFromParent, { once: true });
    const timeout = setTimeout(() => controller.abort(new Error("Overpass server timed out")), timeoutMs);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: "data=" + encodeURIComponent(query),
        signal: controller.signal
      });
      if (!response.ok) throw new Error("OpenStreetMap server returned HTTP " + response.status);
      const data = await response.json();
      if (!Array.isArray(data.elements)) throw new Error("OpenStreetMap response has no elements array");
      return { data, endpoint, query };
    } catch (error) {
      if (signal?.aborted) throw signal.reason || error;
      if (controller.signal.aborted) throw new Error(endpoint + " timed out after " + timeoutMs + " ms");
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromParent);
    }
  })());
  try {
    // Race Overpass mirrors so a slow first server does not block a healthy second one.
    return await Promise.any(attempts);
  } catch (error) {
    const reasons = error.errors || [error];
    throw new Error("দুইটি OpenStreetMap সার্ভার থেকেই দ্রুত ডেটা পাওয়া যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন। (" + reasons.map(item => item.message).join("; ") + ")");
  } finally {
    controllers.forEach(controller => controller.abort());
  }
}

export function projectCoordinates(lat, lon, originLat, originLon) {
  const metresPerDegree = 111320;
  const x = (lon - originLon) * metresPerDegree * Math.cos(originLat * Math.PI / 180);
  const z = -(lat - originLat) * metresPerDegree;
  return { x: x === 0 ? 0 : x, z: z === 0 ? 0 : z };
}

export function getRoadWidth(tags = {}) {
  if (tags.width && Number.isFinite(parseFloat(tags.width))) {
    return Math.max(2.4, Math.min(30, parseFloat(tags.width)));
  }
  const lanes = Math.max(1, Math.min(6, parseInt(tags.lanes, 10) || 1));
  const defaults = {
    motorway: 13, trunk: 12, primary: 10, secondary: 8.5,
    tertiary: 7, residential: 5.5, living_street: 4.5,
    service: 4, unclassified: 5, pedestrian: 4, footway: 1.8,
    path: 1.4, track: 2.5
  };
  const highway = tags.highway || "residential";
  return Math.max(1.4, Math.min(30, defaults[highway] || (lanes * 3.1 + 0.5)));
}

export function parseOSMData(data, bounds = UTTARA_PILOT.bounds) {
  if (!data || !Array.isArray(data.elements)) throw new TypeError("Invalid OSM extract");
  const originLat = (bounds.south + bounds.north) / 2;
  const originLon = (bounds.west + bounds.east) / 2;
  const roads = [];
  const buildings = [];
  for (const element of data.elements) {
    if (element.type !== "way" || !Array.isArray(element.geometry) || element.geometry.length < 2) continue;
    const tags = element.tags || {};
    const points = element.geometry
      .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon))
      .map(point => projectCoordinates(point.lat, point.lon, originLat, originLon));
    if (tags.highway && points.length >= 2) {
      roads.push({ id: element.id, name: tags.name || tags.ref || "", highway: tags.highway, width: getRoadWidth(tags), points, tags });
    } else if (tags.building && points.length >= 4) {
      const closed = Math.hypot(points[0].x - points.at(-1).x, points[0].z - points.at(-1).z) < 0.5;
      const polygon = closed ? points.slice(0, -1) : points;
      if (polygon.length >= 3) {
        const levels = Number.parseFloat(tags["building:levels"]);
        const taggedHeight = Number.parseFloat(String(tags.height || "").replace(/m$/i, ""));
        const height = Math.max(3, Math.min(90, Number.isFinite(taggedHeight) ? taggedHeight : Number.isFinite(levels) ? levels * 3.15 : 7.5));
        buildings.push({ id: element.id, name: tags.name || "", building: tags.building, height, levels: Number.isFinite(levels) ? levels : null, polygon, tags });
      }
    }
  }
  return { roads, buildings, origin: { lat: originLat, lon: originLon }, bounds };
}

function roadGeometry(THREE, roads) {
  const positions = [], uvs = [], indices = [];
  let vertex = 0;
  for (const road of roads) {
    const half = road.width / 2;
    for (let i = 0; i < road.points.length - 1; i++) {
      const a = road.points[i], b = road.points[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.25) continue;
      const nx = -dz / length * half, nz = dx / length * half;
      positions.push(a.x + nx, 0.035, a.z + nz, a.x - nx, 0.035, a.z - nz,
        b.x + nx, 0.035, b.z + nz, b.x - nx, 0.035, b.z - nz);
      uvs.push(0, 0, 1, 0, 0, length / 5, 1, length / 5);
      indices.push(vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3);
      vertex += 4;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function seeded(id) {
  let value = Number(id) || 1;
  value = (value ^ (value >>> 16)) * 0x45d9f3b;
  value = (value ^ (value >>> 16)) * 0x45d9f3b;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function pushQuad(positions, uvs, indices, a, b, c, d, uvScale = 1) {
  const base = positions.length / 3;
  positions.push(...a, ...b, ...c, ...d);
  uvs.push(0, 0, uvScale, 0, 0, uvScale, uvScale, uvScale);
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function makeSurface(THREE, positions, uvs, indices, material, name) {
  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  return mesh;
}

function buildRoadLayer(THREE, roads, materials) {
  const roadP = [], roadUv = [], roadI = [];
  const walkP = [], walkUv = [], walkI = [];
  const curbP = [], curbUv = [], curbI = [];
  const dashMatrices = [];
  const up = new THREE.Vector3(0, 1, 0);
  const temp = new THREE.Object3D();
  let segmentCount = 0;

  for (const road of roads) {
    const half = road.width / 2;
    const isPath = ["footway", "path", "pedestrian"].includes(road.highway);
    const walkWidth = isPath ? 0 : Math.max(1.05, Math.min(2.6, road.width * 0.17));
    for (let i = 0; i < road.points.length - 1; i++) {
      const a = road.points[i], b = road.points[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      if (length < 1.5) continue;
      const nx = -dz / length, nz = dx / length;
      const left = [nx, nz], right = [-nx, -nz];
      const p = (x, z, y) => [x, y, z];
      const al = p(a.x + nx * half, a.z + nz * half, 0.045);
      const ar = p(a.x - nx * half, a.z - nz * half, 0.045);
      const bl = p(b.x + nx * half, b.z + nz * half, 0.045);
      const br = p(b.x - nx * half, b.z - nz * half, 0.045);
      pushQuad(roadP, roadUv, roadI, al, bl, br, ar, length / 7);
      if (walkWidth) {
        for (const side of [left, right]) {
          const outerA = p(a.x + side[0] * (half + walkWidth), a.z + side[1] * (half + walkWidth), 0.025);
          const outerB = p(b.x + side[0] * (half + walkWidth), b.z + side[1] * (half + walkWidth), 0.025);
          const innerA = p(a.x + side[0] * (half + 0.16), a.z + side[1] * (half + 0.16), 0.03);
          const innerB = p(b.x + side[0] * (half + 0.16), b.z + side[1] * (half + 0.16), 0.03);
          pushQuad(walkP, walkUv, walkI, innerA, innerB, outerB, outerA, length / 4);
          const curbOuterA = p(a.x + side[0] * (half + 0.2), a.z + side[1] * (half + 0.2), 0.17);
          const curbOuterB = p(b.x + side[0] * (half + 0.2), b.z + side[1] * (half + 0.2), 0.17);
          pushQuad(curbP, curbUv, curbI, innerA, innerB, curbOuterB, curbOuterA, length / 8);
        }
      }
      const lanes = Math.max(1, Math.min(4, Number.parseInt(road.tags?.lanes, 10) || (road.width >= 9 ? 2 : 1)));
      if (lanes >= 2 && road.width >= 6) {
        const dashLength = 3.2, gap = 4.2;
        for (let along = 4; along < length - 2; along += dashLength + gap) {
          const t = along / length;
          temp.position.set(a.x + dx * t, 0.075, a.z + dz * t);
          temp.quaternion.setFromUnitVectors(up, new THREE.Vector3(0, 1, 0));
          temp.rotation.y = -Math.atan2(dz, dx);
          temp.scale.set(0.12, 1, dashLength);
          temp.updateMatrix();
          dashMatrices.push(temp.matrix.clone());
        }
      }
      segmentCount++;
    }
  }

  const group = new THREE.Group();
  group.name = "road-cross-sections-and-street-furniture";
  for (const [p, uv, idx, mat, name] of [
    [roadP, roadUv, roadI, materials.asphalt, "continuous-asphalt"],
    [walkP, walkUv, walkI, materials.sidewalk, "sidewalk-surfaces"],
    [curbP, curbUv, curbI, materials.curb, "raised-curbs"]
  ]) {
    const mesh = makeSurface(THREE, p, uv, idx, mat, name);
    if (mesh) group.add(mesh);
  }
  if (dashMatrices.length) {
    const geometry = new THREE.BoxGeometry(1, 0.018, 1);
    const dashes = new THREE.InstancedMesh(geometry, materials.marking, dashMatrices.length);
    dashMatrices.forEach((matrix, index) => dashes.setMatrixAt(index, matrix));
    dashes.instanceMatrix.needsUpdate = true;
    dashes.name = "broken-center-line-markings";
    group.add(dashes);
  }
  return { group, segmentCount, markingCount: dashMatrices.length };
}

function buildFacadeDetails(THREE, buildings, materials) {
  const group = new THREE.Group();
  group.name = "procedural-urban-architecture";
  const windowGeometry = new THREE.BoxGeometry(1, 1, 0.10);
  const balconyGeometry = new THREE.BoxGeometry(1, 0.12, 0.48);
  const windowInstances = [];
  const balconyInstances = [];
  const roofInstances = [];
  const temp = new THREE.Object3D();
  const forward = new THREE.Vector3(0, 0, 1);
  let detailedBuildings = 0;

  for (const building of buildings) {
    const points = building.polygon;
    if (points.length < 3) continue;
    const shape = new THREE.Shape();
    points.forEach((point, index) => index === 0 ? shape.moveTo(point.x, -point.z) : shape.lineTo(point.x, -point.z));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: building.height, bevelEnabled: false, curveSegments: 1 });
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    const tone = seeded(building.id);
    const facadeIndex = Math.floor(tone * materials.facades.length);
    const shell = new THREE.Mesh(geometry, materials.facades[facadeIndex]);
    shell.name = "osm-building-shell-" + building.id;
    shell.position.y = 0.04;
    shell.castShadow = true;
    shell.receiveShadow = true;
    shell.userData.osmId = building.id;
    group.add(shell);

    const floorCount = Math.max(1, Math.min(24, Math.round(building.height / 3.15)));
    const floorHeight = building.height / floorCount;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1, 0.22, 1), materials.roof);
    roof.position.set(
      points.reduce((s, p) => s + p.x, 0) / points.length,
      building.height + 0.16,
      points.reduce((s, p) => s + p.z, 0) / points.length
    );
    roof.scale.set(
      Math.max(1.2, Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)) + 0.35),
      1,
      Math.max(1.2, Math.max(...points.map(p => p.z)) - Math.min(...points.map(p => p.z)) + 0.35)
    );
    roof.updateMatrix();
    roofInstances.push(roof.matrix.clone());

    for (let edge = 0; edge < points.length; edge++) {
      const a = points[edge], b = points[(edge + 1) % points.length];
      const dx = b.x - a.x, dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      if (length < 3.8) continue;
      const outward = new THREE.Vector3(dz / length, 0, -dx / length);
      const rotation = new THREE.Quaternion().setFromUnitVectors(forward, outward);
      const windowWidth = 1.05;
      const columns = Math.max(1, Math.min(12, Math.floor((length - 1.2) / 2.35)));
      const start = (length - (columns - 1) * 2.35) / 2;
      for (let floor = 0; floor < floorCount; floor++) {
        const y = 0.04 + floor * floorHeight + floorHeight * 0.52;
        for (let column = 0; column < columns; column++) {
          const along = start + column * 2.35;
          const x = a.x + dx / length * along + outward.x * 0.065;
          const z = a.z + dz / length * along + outward.z * 0.065;
          temp.position.set(x, y, z);
          temp.quaternion.copy(rotation);
          temp.scale.set(windowWidth, Math.min(1.55, floorHeight * 0.55), 1);
          temp.updateMatrix();
          windowInstances.push(temp.matrix.clone());
          if (floor > 0 && (column % 2 === 0) && tone > 0.28) {
            temp.position.set(x, y - floorHeight * 0.22, z);
            temp.scale.set(1.45, 0.12, 0.48);
            temp.updateMatrix();
            balconyInstances.push(temp.matrix.clone());
          }
        }
      }
    }
    detailedBuildings++;
  }

  if (windowInstances.length) {
    const windows = new THREE.InstancedMesh(windowGeometry, materials.glass, windowInstances.length);
    windowInstances.forEach((matrix, index) => windows.setMatrixAt(index, matrix));
    windows.instanceMatrix.needsUpdate = true;
    windows.name = "repeated-facade-window-modules";
    group.add(windows);
  }
  if (balconyInstances.length) {
    const balconies = new THREE.InstancedMesh(balconyGeometry, materials.balcony, balconyInstances.length);
    balconyInstances.forEach((matrix, index) => balconies.setMatrixAt(index, matrix));
    balconies.instanceMatrix.needsUpdate = true;
    balconies.name = "repeated-balcony-slabs";
    group.add(balconies);
  }
  if (roofInstances.length) {
    const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.roof, roofInstances.length);
    roofInstances.forEach((matrix, index) => roofs.setMatrixAt(index, matrix));
    roofs.instanceMatrix.needsUpdate = true;
    roofs.name = "flat-roof-parapets";
    group.add(roofs);
  }
  return { group, detailedBuildings, windows: windowInstances.length, balconies: balconyInstances.length };
}

export function buildCityWorld(THREE, parsed, { maxRoads = 5000, maxBuildings = 650 } = {}) {
  const group = new THREE.Group();
  group.name = "banglar-alef-uttara-realistic-city-world";
  const roads = parsed.roads.slice(0, maxRoads);
  const buildings = parsed.buildings.slice(0, maxBuildings);
  const materials = {
    asphalt: new THREE.MeshStandardMaterial({ color: 0x343a3b, roughness: 0.96, metalness: 0.01 }),
    sidewalk: new THREE.MeshStandardMaterial({ color: 0x89877d, roughness: 0.94 }),
    curb: new THREE.MeshStandardMaterial({ color: 0xb5b1a5, roughness: 0.86 }),
    marking: new THREE.MeshStandardMaterial({ color: 0xe5dfc8, roughness: 0.72 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x52717b, roughness: 0.24, metalness: 0.18, emissive: 0x101a1c }),
    balcony: new THREE.MeshStandardMaterial({ color: 0xc2b9a8, roughness: 0.86 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x77776d, roughness: 0.92 }),
    facades: [
      new THREE.MeshStandardMaterial({ color: 0xc2b8a7, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0xb3b7b0, roughness: 0.91 }),
      new THREE.MeshStandardMaterial({ color: 0xc7b49f, roughness: 0.89 }),
      new THREE.MeshStandardMaterial({ color: 0x9eaaa5, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0xb9a69b, roughness: 0.9 })
    ]
  };
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 2600),
    new THREE.MeshStandardMaterial({ color: 0x777b70, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.09;
  ground.receiveShadow = true;
  ground.name = "terrain-ground";
  group.add(ground);

  const roadLayer = buildRoadLayer(THREE, roads, materials);
  group.add(roadLayer.group);
  const architecture = buildFacadeDetails(THREE, buildings, materials);
  group.add(architecture.group);

  return {
    group,
    counts: {
      roadWays: roads.length,
      roadSegments: roadLayer.segmentCount,
      buildings: architecture.detailedBuildings,
      facadeWindows: architecture.windows,
      balconies: architecture.balconies,
      roadMarkings: roadLayer.markingCount,
      omittedRoadWays: Math.max(0, parsed.roads.length - roads.length),
      omittedBuildings: Math.max(0, parsed.buildings.length - buildings.length)
    },
    origin: parsed.origin,
    bounds: parsed.bounds
  };
}
