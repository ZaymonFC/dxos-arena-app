import { useState } from "react";
import { inc } from "./utils";

const EXECUTION_LIMIT = 10000;

type Exec<TState, TAction> = (
  state: TState,
  action: TAction
) => [TState, TAction[]];

type Accumulator<TState> = {
  count: number;
  nextState: TState | undefined;
};

export const applyAction = <TState, TAction>(
  state: TState,
  action: TAction,
  exec: Exec<TState, TAction>,
  acc: Accumulator<TState> = { count: 0, nextState: undefined }
): Accumulator<TState> => {
  if (acc.count > EXECUTION_LIMIT) {
    throw new Error(
      `Execution limit exceeded (${EXECUTION_LIMIT} iterations). This is likely due to an infinite loop in your store machine.`
    );
  }

  const [newState, actions] = exec(acc.nextState || state, action);

  acc.count = inc(acc.count);
  acc.nextState = newState;

  // If there are actions to apply, recursively apply them
  for (const action of actions) {
    acc = applyAction(acc.nextState, action, exec, acc);
  }

  return acc;
};

export const useStore = <TState, TAction>(
  initial: TState,
  exec: Exec<TState, TAction>
) => {
  const [state, setState] = useState(initial);

  let send = (action: TAction) => {
    const { nextState } = applyAction(state, action, exec);
    setState(nextState);
  };

  return {
    state,
    send,
  };
};
