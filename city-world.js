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

export async function fetchOSMExtract({ bounds = UTTARA_PILOT.bounds, fetchImpl = fetch, endpoints, signal } = {}) {
  const query = buildOverpassQuery(bounds);
  const mirrors = endpoints || [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  let lastError;
  for (const endpoint of mirrors) {
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: "data=" + encodeURIComponent(query),
        signal
      });
      if (!response.ok) throw new Error("OpenStreetMap server returned HTTP " + response.status);
      const data = await response.json();
      if (!Array.isArray(data.elements)) throw new Error("OpenStreetMap response has no elements array");
      return { data, endpoint, query };
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
    }
  }
  throw new Error("OSM extract could not be downloaded. " + (lastError?.message || "No Overpass mirror responded."));
}

export function projectCoordinates(lat, lon, originLat, originLon) {
  const metresPerDegree = 111320;
  const x = (lon - originLon) * metresPerDegree * Math.cos(originLat * Math.PI / 180);
  const z = -(lat - originLat) * metresPerDegree;
  return { x, z };
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

export function buildCityWorld(THREE, parsed, { maxRoads = 5000, maxBuildings = 650 } = {}) {
  const group = new THREE.Group();
  group.name = "banglar-alef-uttara-osm-world";
  const roads = parsed.roads.slice(0, maxRoads);
  const buildings = parsed.buildings.slice(0, maxBuildings);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x343a38, roughness: 0.94, metalness: 0.01 });
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x77796e, roughness: 1 });
  const buildingMats = [
    new THREE.MeshStandardMaterial({ color: 0xb8ad9b, roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ color: 0xaaaFA7, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xc0ad98, roughness: 0.87 }),
    new THREE.MeshStandardMaterial({ color: 0x9daaa6, roughness: 0.86 })
  ];
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  group.add(ground);

  if (roads.length) {
    const mesh = new THREE.Mesh(roadGeometry(THREE, roads), roadMat);
    mesh.name = "osm-road-network";
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  let buildingCount = 0;
  for (const building of buildings) {
    const shape = new THREE.Shape();
    building.polygon.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, -point.z);
      else shape.lineTo(point.x, -point.z);
    });
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: building.height, bevelEnabled: false, curveSegments: 1 });
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, buildingMats[buildingCount % buildingMats.length]);
    mesh.name = "osm-building-" + building.id;
    mesh.position.y = 0.02;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.osmId = building.id;
    group.add(mesh);
    buildingCount++;
  }

  return {
    group,
    counts: {
      roadWays: roads.length,
      roadSegments: roads.reduce((sum, road) => sum + road.points.length - 1, 0),
      buildings: buildingCount,
      omittedRoadWays: Math.max(0, parsed.roads.length - roads.length),
      omittedBuildings: Math.max(0, parsed.buildings.length - buildings.length)
    },
    origin: parsed.origin,
    bounds: parsed.bounds
  };
}
