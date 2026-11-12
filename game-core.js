export const SAVE_KEY = "banglar-alef.game-save.v1";
export const SAVE_VERSION = 1;

const now = () => new Date().toISOString();

export function createNewGameState() {
  const timestamp = now();
  return {
    version: SAVE_VERSION,
    status: "playing",
    createdAt: timestamp,
    updatedAt: timestamp,
    player: {
      money: 0,
      battery: 100,
      position: { x: 0, y: 0, z: 48 },
      heading: Math.PI,
      vehicleId: "starter-cng"
    },
    progression: {
      careerLevel: 1,
      journeysCompleted: 0,
      activeMissionStage: 0,
      unlockedFeatures: ["basic-driving"]
    },
    statistics: {
      distanceMetres: 0,
      totalEarned: 0,
      playTimeSeconds: 0
    }
  };
}

export function validateGameState(value) {
  if (!value || typeof value !== "object" || value.version !== SAVE_VERSION) return false;
  if (!["playing", "paused", "game-over", "completed"].includes(value.status)) return false;
  const p = value.player;
  const g = value.progression;
  const s = value.statistics;
  return Boolean(
    p && Number.isFinite(p.money) && p.money >= 0 &&
    Number.isFinite(p.battery) && p.battery >= 0 && p.battery <= 100 &&
    p.position && Number.isFinite(p.position.x) && Number.isFinite(p.position.y) && Number.isFinite(p.position.z) &&
    Number.isFinite(p.heading) && typeof p.vehicleId === "string" &&
    g && Number.isInteger(g.careerLevel) && g.careerLevel >= 1 &&
    Number.isInteger(g.journeysCompleted) && g.journeysCompleted >= 0 &&
    Number.isInteger(g.activeMissionStage) && g.activeMissionStage >= 0 && g.activeMissionStage <= 2 &&
    Array.isArray(g.unlockedFeatures) &&
    s && Number.isFinite(s.distanceMetres) && s.distanceMetres >= 0 &&
    Number.isFinite(s.totalEarned) && s.totalEarned >= 0 &&
    Number.isFinite(s.playTimeSeconds) && s.playTimeSeconds >= 0
  );
}

export function saveGameState(state, storage = globalThis.localStorage) {
  if (!validateGameState(state)) throw new TypeError("Refusing to save an invalid game state.");
  const snapshot = structuredClone(state);
  snapshot.status = snapshot.status === "paused" ? "playing" : snapshot.status;
  snapshot.updatedAt = now();
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    return { ok: true, savedAt: snapshot.updatedAt };
  } catch (error) {
    return { ok: false, error };
  }
}

export function loadGameState(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return { ok: false, reason: "missing" };
    const parsed = JSON.parse(raw);
    if (!validateGameState(parsed)) return { ok: false, reason: "invalid" };
    return { ok: true, state: parsed };
  } catch (error) {
    return { ok: false, reason: "unavailable", error };
  }
}

export function clearGameSave(storage = globalThis.localStorage) {
  try {
    storage.removeItem(SAVE_KEY);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export function updateGameState(state, updater) {
  const next = structuredClone(state);
  updater(next);
  next.updatedAt = now();
  if (!validateGameState(next)) throw new TypeError("Game state update violated the save schema.");
  return next;
}

export function transitionGameState(state, status) {
  const allowed = {
    playing: ["paused", "game-over", "completed"],
    paused: ["playing", "game-over"],
    "game-over": ["playing"],
    completed: ["playing"]
  };
  if (!allowed[state.status]?.includes(status)) {
    throw new Error("Invalid game state transition: " + state.status + " -> " + status);
  }
  return updateGameState(state, next => { next.status = status; });
}
