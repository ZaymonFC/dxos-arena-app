import { test, expect } from "vitest";
import { applyAction, useStore } from "./useStore";

type TestState = {
  count: number;
};

const stateZero: TestState = {
  count: 0,
};

type TestAction =
  | { type: "increment" }
  | { type: "decrement" }
  | { type: "loop-increment" }
  | { type: "increment-until"; payload: number };

const exec = (
  state: TestState,
  action: TestAction
): [TestState, TestAction[]] => {
  switch (action.type) {
    case "increment":
      return [{ count: state.count + 1 }, []];
    case "decrement":
      return [{ count: state.count - 1 }, []];
    case "loop-increment":
      return [state, [{ type: "increment" }, { type: "loop-increment" }]];
    case "increment-until":
      return [
        { count: state.count + 1 },
        state.count === action.payload - 1
          ? []
          : [{ type: "increment-until", payload: action.payload }],
      ];
  }
};

test("applyAction throws when looping forever", () => {
  expect(() =>
    applyAction(stateZero, { type: "loop-increment" }, exec)
  ).toThrow("infinite loop");
});

test("applyAction increment until returns the correct state", () => {
  const { nextState } = applyAction(
    stateZero,
    { type: "increment-until", payload: 100 },
    exec
  );
  expect(nextState.count).toBe(100);
});

test("applyAction returns the correct state 2 actions", () => {
  const { nextState: one } = applyAction(
    stateZero,
    { type: "increment" },
    exec
  );
  const { nextState: two } = applyAction(one, { type: "increment" }, exec);
  expect(two.count).toBe(2);
});

test("applyAction returns the correct state 3 actions", () => {
  const { nextState: one } = applyAction(
    stateZero,
    { type: "increment" },
    exec
  );
  const { nextState: two } = applyAction(one, { type: "increment" }, exec);
  const { nextState: three } = applyAction(two, { type: "decrement" }, exec);
  expect(three.count).toBe(1);
});
