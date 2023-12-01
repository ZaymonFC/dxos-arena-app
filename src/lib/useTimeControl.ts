import { differenceInMilliseconds, parseISO } from "date-fns";
import { atom, useAtomValue, useSetAtom } from "jotai";
import React from "react";
import { interval } from "rxjs";
import { match } from "ts-pattern";
import { GameDispatch, GameStatus, TimeControl } from "./game";
import { useSubscription } from "./useSubscription";

export const thinkingTime = (moveTimes: string[], currentTime?: string) => {
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

  if (moveTimes.length > 0 && lastMoveTime && currentTime) {
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
  timeControl: TimeControl,
  moveTimes: string[],
  currentTime?: string
) => {
  const { baseMinutes: base, incrementSeconds: increment } = timeControl;
  const initialTime = base * 60 * 1000;

  const { whiteThinkingTime, blackThinkingTime } = thinkingTime(moveTimes, currentTime);

  const totalMoves = moveTimes.length;
  const whiteMoves = Math.floor((totalMoves + 1) / 2);
  const blackMoves = totalMoves - whiteMoves;

  const whiteIncrement = whiteMoves * increment * 1000;
  const blackIncrement = blackMoves * increment * 1000;

  return {
    whiteRemainingTime: Math.max(0, initialTime - whiteThinkingTime + whiteIncrement),
    blackRemainingTime: Math.max(0, initialTime - blackThinkingTime + blackIncrement),
  } as const;
};

// --- Atoms -------------------------------------------------------------------
const timerAtom = atom({ white: 0, black: 0 });

export const whiteTimeAtom = atom((get) => get(timerAtom).white);
export const blackTimeAtom = atom((get) => get(timerAtom).black);

const intervals = { normal: 1000, fast: 10 };

const timerResolutionAtom = atom((get) => {
  const { white, black } = get(timerAtom);
  return white <= 10000 || black <= 10000 ? intervals.fast : intervals.normal;
});

const timeOutAtom = atom((get) => {
  const { white, black } = get(timerAtom);
  if (white <= 0) {
    return "white-timeout";
  } else if (black <= 0) {
    return "black-timeout";
  }
});

// --- 🪝 Hooks ----------------------------------------------------------------
export const useTimeOut = (send: GameDispatch, status: GameStatus) => {
  const timeOut = useAtomValue(timeOutAtom);

  React.useEffect(() => {
    if (status !== "in-progress") {
      return;
    }

    if (timeOut) {
      match(timeOut)
        .with("white-timeout", () => {
          send({ type: "game-over", reason: "white-timeout" });
        })
        .with("black-timeout", () => {
          send({ type: "game-over", reason: "black-timeout" });
        })
        .exhaustive();
    }
  }, [timeOut, send, status]);
};

export const useTimeControl = (
  timeControl: TimeControl,
  moveTimes: string[],
  status: string,
  completedAt?: string
) => {
  const resolution = useAtomValue(timerResolutionAtom);
  const updateTimer = useSetAtom(timerAtom);

  React.useEffect(() => {
    if (status === "waiting") {
      const ms = timeControl.baseMinutes * 60 * 1000;
      updateTimer({ white: ms, black: ms });
    }

    if (status === "complete") {
      const { whiteRemainingTime, blackRemainingTime } = timeRemaining(
        timeControl,
        moveTimes,
        completedAt
      );

      updateTimer({ white: whiteRemainingTime, black: blackRemainingTime });
    }
  }, [status, timeControl, moveTimes, updateTimer]);

  useSubscription(() => {
    if (status !== "in-progress") {
      return;
    }

    return interval(resolution).subscribe(() => {
      const currentTime = new Date().toISOString();
      const { whiteRemainingTime, blackRemainingTime } = timeRemaining(
        timeControl,
        moveTimes,
        currentTime
      );

      updateTimer({ white: whiteRemainingTime, black: blackRemainingTime });
    });
  }, [resolution, status, updateTimer]);
};
