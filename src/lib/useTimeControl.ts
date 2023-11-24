import { differenceInMilliseconds, parseISO } from "date-fns";
import { atom, useAtomValue, useSetAtom } from "jotai";
import React from "react";
import { GameDispatch, GameState } from "./game";
import { useSubscription } from "./useSubscription";
import { interval } from "rxjs";
import { time } from "console";

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
const timerAtom = atom({
  white: 9999, // TODO(zan): Think of a better default
  black: 9999,
});

export const whiteTimeAtom = atom((get) => get(timerAtom).white);
export const blackTimeAtom = atom((get) => get(timerAtom).black);

const intervals = {
  normal: 1000,
  fast: 10,
};

const timerResolutionAtom = atom((get) => {
  const { white, black } = get(timerAtom);

  return white <= 10000 || black <= 10000 ? intervals.fast : intervals.normal;
});

const timeOutAtom = atom((get) => {
  const { white, black } = get(timerAtom);
  return { white: white <= 0, black: black <= 0 };
});

// --- 🪝 Hooks ----------------------------------------------------------------
export const useTimeControl = (game: GameState, send: GameDispatch) => {
  const setTimer = useSetAtom(timerAtom);

  const resolution = useAtomValue(timerResolutionAtom);
  const { white: whiteTimeOut, black: blackTimeOut } = useAtomValue(timeOutAtom);

  React.useEffect(() => {
    if (game.status === "waiting") {
      setTimer({ white: 10000, black: 10000 });
    }
  }, [game.status, setTimer]);

  React.useEffect(() => {
    if (whiteTimeOut) {
      send({ type: "game-over", reason: "white-timeout" });
    }
    if (blackTimeOut) {
      send({ type: "game-over", reason: "black-timeout" });
    }
  }, [whiteTimeOut, blackTimeOut, send]);

  useSubscription(() => {
    if (game.status !== "in-progress") {
      return;
    }

    return interval(resolution).subscribe(() => {
      const currentTime = new Date().toISOString();
      const { whiteRemainingTime, blackRemainingTime } = timeRemaining(game.moveTimes, currentTime);
      setTimer((_) => ({ white: whiteRemainingTime, black: blackRemainingTime }));
    });
  }, [resolution, setTimer, game.moveTimes, game.status]);
};
