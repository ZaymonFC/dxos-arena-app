import { differenceInMilliseconds, parseISO } from "date-fns";
import React from "react";
import { GameDispatch, GameState } from "./game";
import { atom, useAtom } from "jotai";

export const thinkingTime = (moveTimes: string[], currentTime: string) => {
  let whiteThinkingDuration: number = 0;
  let blackThinkingDuration: number = 0;
  let lastMoveTime: Date | undefined;

  moveTimes.forEach((moveTime, index) => {
    const move = parseISO(moveTime);

    if (lastMoveTime) {
      const moveDuration: number = differenceInMilliseconds(move, lastMoveTime);

      if (index % 2 === 0) {
        // Black's move, so update White's thinking time
        whiteThinkingDuration += moveDuration;
      } else {
        // White's move, so update Black's thinking time
        blackThinkingDuration += moveDuration;
      }
    }

    lastMoveTime = move;
  });

  if (moveTimes.length > 0 && lastMoveTime) {
    // Calculate the ongoing move duration
    const ongoingMoveDuration = differenceInMilliseconds(parseISO(currentTime), lastMoveTime);

    if (moveTimes.length % 2 === 0) {
      // White's turn to think
      whiteThinkingDuration += ongoingMoveDuration;
    } else {
      // Black's turn to think
      blackThinkingDuration += ongoingMoveDuration;
    }
  }

  return {
    whiteThinkingTime: whiteThinkingDuration,
    blackThinkingTime: blackThinkingDuration,
  };
};

export const timeRemaining = (
  moveTimes: string[],
  currentTime: string
): { whiteRemainingTime: number; blackRemainingTime: number } => {
  const initialTime = 10 * 1000;

  const { whiteThinkingTime, blackThinkingTime } = thinkingTime(moveTimes, currentTime);

  // TODO(zan): Account for increment

  return {
    whiteRemainingTime: Math.max(0, initialTime - whiteThinkingTime),
    blackRemainingTime: Math.max(0, initialTime - blackThinkingTime),
  };
};

// --- Atoms -------------------------------------------------------------------
export const whiteTimeAtom = atom(9999);
export const blackTimeAtom = atom(9999);

// --- 🪝 Hooks ----------------------------------------------------------------
export const useTimeControl = (game: GameState, send: GameDispatch) => {
  const intervals = {
    normal: 1000,
    fast: 10,
  };

  const currentTime = React.useMemo(() => new Date().toISOString(), [game.moveTimes]);

  const [whiteTime, setWhiteTime] = useAtom(whiteTimeAtom);
  const [blackTime, setBlackTime] = useAtom(blackTimeAtom);

  const [whiteIntervalMs, setWhiteIntervalMs] = React.useState(intervals.normal);
  const [blackIntervalMs, setBlackIntervalMs] = React.useState(intervals.normal);

  React.useEffect(() => {
    if (whiteTime < 10 * 1000 && whiteIntervalMs !== intervals.fast) {
      setWhiteIntervalMs(intervals.fast);
    }

    if (blackTime < 10 * 1000 && blackIntervalMs !== intervals.fast) {
      setBlackIntervalMs(intervals.fast);
    }
  }, [whiteTime, blackTime, setWhiteIntervalMs, setBlackIntervalMs]);

  React.useEffect(() => {
    if (whiteTime <= 0) {
      send({ type: "game-over", reason: "white-timeout" });
    }
    if (blackTime <= 0) {
      send({ type: "game-over", reason: "black-timeout" });
    }
  }, [whiteTime, blackTime, send]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      const { whiteRemainingTime } = timeRemaining(game.moveTimes, currentTime);
      setWhiteTime(whiteRemainingTime);
    }, whiteIntervalMs);

    return () => clearInterval(interval);
  }, [game.status, game.moveTimes, whiteIntervalMs]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      const { blackRemainingTime } = timeRemaining(game.moveTimes, currentTime);
      setBlackTime(blackRemainingTime);
    }, blackIntervalMs);

    return () => clearInterval(interval);
  }, [game.status, game.moveTimes, blackIntervalMs]);
};
