import { differenceInMilliseconds, parseISO } from "date-fns";

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
  const initialTime = 10 * 60 * 1000;

  const { whiteThinkingTime, blackThinkingTime } = thinkingTime(moveTimes, currentTime);

  // TODO(zan): Account for increment

  return {
    whiteRemainingTime: initialTime - whiteThinkingTime,
    blackRemainingTime: initialTime - blackThinkingTime,
  };
};
