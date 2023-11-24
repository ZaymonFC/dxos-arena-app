import { Chess } from "chess.js";
import React, { useCallback } from "react";
import { match } from "ts-pattern";

export type Move = {
  source: string;
  target: string;
  promotion?: "q" | "r" | "b" | "n";
};

type GameOverReason =
  | "checkmate"
  | "white-resignation"
  | "black-resignation"
  | "stalemate"
  | "insufficient-material"
  | "threefold-repetition"
  | "white-timeout"
  | "black-timeout";

// todo(zan): Time

type GameStatus = "waiting" | "in-progress" | "complete";

// todo(zan): Think about time control
export type GameState = {
  variant: "standard";
  moves: Move[];
  movesWithNotation: string[];
  moveTimes: string[];
  boards: string[];
  players?: { white: string; black: string };
  status: GameStatus;
  gameOverReason?: GameOverReason;
};

export const zeroState = (): GameState => ({
  variant: "standard",
  moves: [],
  movesWithNotation: [],
  moveTimes: [],
  boards: [new Chess().fen()],
  status: "waiting",
});

export type GameAction =
  | { type: "game-created"; players: { white: string; black: string } }
  | { type: "move-made"; move: Move }
  | { type: "takeback-requested"; player: "white" | "black"; moveNumber: number }
  | { type: "takeback-accepted" }
  | { type: "player-resigned"; player: "white" | "black" }
  | { type: "game-over"; reason: GameOverReason };

export type GameDispatch = (action: GameAction) => void;

export const exec = (state: GameState, action: GameAction): [GameState, GameAction[]] => {
  let actions: GameAction[] = [];

  switch (action.type) {
    case "game-created": {
      state.players = action.players;
      break;
    }

    case "move-made": {
      try {
        // TODO(zan): To support variants, we can use a different rules engine
        const chess = new Chess(state.boards[state.boards.length - 1]);

        const move = chess.move({
          from: action.move.source,
          to: action.move.target,
          promotion: "q",
        });

        // If first move is made, game is in progress
        if (state.moves.length === 0) {
          state.status = "in-progress";
        }

        if (state.status !== "in-progress") {
          break;
        }

        // Update move times
        const time = new Date().toISOString();

        state.moveTimes.push(time);

        // Push move and new board
        state.moves.push(action.move);
        state.movesWithNotation.push(move.san);
        state.boards.push(chess.fen());

        // Check for game over states
        if (chess.isGameOver()) {
          if (chess.isCheckmate()) {
            actions.push({ type: "game-over", reason: "checkmate" });
          }
          if (chess.isStalemate()) {
            actions.push({ type: "game-over", reason: "stalemate" });
          }

          if (chess.isInsufficientMaterial()) {
            actions.push({ type: "game-over", reason: "insufficient-material" });
          }

          if (chess.isThreefoldRepetition()) {
            actions.push({ type: "game-over", reason: "threefold-repetition" });
          }
        }
      } catch (e) {
        console.log("Invalid move");
      }

      break;
    }

    case "takeback-requested":
      break;

    case "takeback-accepted":
      break;

    case "player-resigned": {
      const { player } = action;

      actions.push({
        type: "game-over",
        reason: match(player)
          .with("white", () => "white-resignation")
          .with("black", () => "black-resignation")
          .exhaustive() as GameOverReason,
      });
      break;
    }

    case "game-over": {
      state.status = "complete";
      state.gameOverReason = action.reason;

      break;
    }
  }

  return [state, actions];
};

type InGameCursorAction =
  | { type: "move-forward" }
  | { type: "move-backward" }
  | { type: "move-to-beginning" }
  | { type: "move-to-latest" }
  | { type: "select-move"; move: number };

export const useInGameCursor = ({ boards }: GameState) => {
  const [current, setCurrent] = React.useState(true);
  const [index, setIndex] = React.useState(0);

  const board = boards[index];
  const numberOfMoves = boards.length - 1;

  React.useEffect(() => {
    if (current) {
      setIndex(numberOfMoves);
    }
  }, [numberOfMoves]);

  const selectBoardByIndex = (index: number) => {
    const latestIndex = numberOfMoves;
    const adjustedIndex = Math.max(0, Math.min(index, latestIndex));

    setCurrent(adjustedIndex === latestIndex);
    setIndex(adjustedIndex);
  };

  const dispatch = useCallback(
    (action: InGameCursorAction) => {
      switch (action.type) {
        case "move-forward":
          selectBoardByIndex(index + 1);
          break;
        case "move-backward":
          selectBoardByIndex(index - 1);
          break;
        case "move-to-beginning":
          selectBoardByIndex(0);
          break;
        case "move-to-latest":
          selectBoardByIndex(numberOfMoves);
          break;
        case "select-move": {
          selectBoardByIndex(action.move);
          break;
        }
      }
    },
    [index, numberOfMoves]
  );

  return {
    __index: index,
    can: { moveForward: index < numberOfMoves, moveBackward: index > 0 },
    board,
    canInteractWithBoard: current,
    dispatch,
  };
};

export type InGameCursor = ReturnType<typeof useInGameCursor>;
