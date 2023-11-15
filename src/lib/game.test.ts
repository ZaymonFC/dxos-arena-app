import { expect, test } from "vitest";
import { exec, zeroState } from "./game";
import { mkApplyMany } from "./useStore.test";

// --- HELPERS ----------------------------------------------------------------
const applyMany = mkApplyMany(exec);

// --- TEST CASES -------------------------------------------------------------

test("Can create a game", () => {
  const state = applyMany(zeroState, [
    { type: "game-created", payload: { players: { white: "zan", black: "zhenya" } } },
  ]);

  expect(state.players.white).toBe("zan");
  expect(state.players.black).toBe("zhenya");
});

test("Can play a move", () => {
  const state = applyMany(zeroState, [
    { type: "game-created", payload: { players: { white: "zan", black: "zhenya" } } },
    { type: "move-made", payload: { source: "e2", target: "e4" } },
  ]);

  expect(state.moves).toHaveLength(1);
  expect(state.moves[0].source).toBe("e2");
  expect(state.status).toBe("in-progress");
});

test("White can resign", () => {
  const state = applyMany(zeroState, [
    { type: "game-created", payload: { players: { white: "zan", black: "zhenya" } } },
    { type: "move-made", payload: { source: "e2", target: "e4" } },
    { type: "move-made", payload: { source: "e7", target: "e5" } },
    { type: "player-resigned", payload: { player: "white" } },
  ]);

  expect(state.status).toBe("complete");
  expect(state.gameOverReason).toBe("white-resignation");
});

test("Moves after game over should be ignored", () => {
  const state = applyMany(zeroState, [
    { type: "game-created", payload: { players: { white: "zan", black: "zhenya" } } },
    { type: "move-made", payload: { source: "e2", target: "e4" } },
    { type: "move-made", payload: { source: "e7", target: "e5" } },
    { type: "player-resigned", payload: { player: "white" } },

    // knight f3, knight c6
    { type: "move-made", payload: { source: "g1", target: "f3" } },
    { type: "move-made", payload: { source: "b8", target: "c6" } },
  ]);

  expect(state.moves).toHaveLength(2);
});

test("Scholars mate should end the game in checkmate", () => {
  const state = applyMany(zeroState, [
    { type: "game-created", payload: { players: { white: "zan", black: "zhenya" } } },
    { type: "move-made", payload: { source: "e2", target: "e4" } },
    { type: "move-made", payload: { source: "e7", target: "e5" } },
    { type: "move-made", payload: { source: "f1", target: "c4" } },
    { type: "move-made", payload: { source: "b8", target: "c6" } },
    { type: "move-made", payload: { source: "d1", target: "h5" } },
    { type: "move-made", payload: { source: "g8", target: "f6" } },
    { type: "move-made", payload: { source: "h5", target: "f7" } },
  ]);

  expect(state.status).toBe("complete");
  expect(state.gameOverReason).toBe("checkmate");
});
