import test from "node:test";
import assert from "node:assert/strict";
import {
  SAVE_KEY, createNewGameState, validateGameState, saveGameState,
  loadGameState, clearGameSave, updateGameState, transitionGameState
} from "../../game-core.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

test("new game creates a valid baseline with no invented progression", () => {
  const state = createNewGameState();
  assert.equal(validateGameState(state), true);
  assert.equal(state.player.money, 0);
  assert.equal(state.player.battery, 100);
  assert.equal(state.progression.careerLevel, 1);
  assert.equal(state.progression.journeysCompleted, 0);
  assert.equal(state.progression.activeMissionStage, 0);
});

test("save and load round-trip real player state", () => {
  const storage = memoryStorage();
  const state = updateGameState(createNewGameState(), next => {
    next.player.money = 75;
    next.player.position.z = -14;
    next.progression.journeysCompleted = 1;
    next.progression.activeMissionStage = 1;
    next.statistics.totalEarned = 75;
  });
  assert.equal(saveGameState(state, storage).ok, true);
  const loaded = loadGameState(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.player.money, 75);
  assert.equal(loaded.state.player.position.z, -14);
  assert.equal(loaded.state.progression.journeysCompleted, 1);
  assert.equal(loaded.state.progression.activeMissionStage, 1);
  assert.equal(storage.getItem(SAVE_KEY) !== null, true);
});

test("invalid or incompatible save data is rejected", () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 99 }));
  assert.deepEqual(loadGameState(storage), { ok: false, reason: "invalid" });
});

test("game lifecycle transitions enforce allowed states", () => {
  const playing = createNewGameState();
  const paused = transitionGameState(playing, "paused");
  assert.equal(paused.status, "paused");
  assert.equal(transitionGameState(paused, "playing").status, "playing");
  const completed = transitionGameState(paused, "completed");
  assert.equal(completed.status, "completed");
  assert.throws(() => transitionGameState(completed, "paused"), /Invalid game state transition/);
});

test("clear save removes the persisted slot", () => {
  const storage = memoryStorage();
  saveGameState(createNewGameState(), storage);
  assert.equal(clearGameSave(storage).ok, true);
  assert.equal(loadGameState(storage).reason, "missing");
});
