import { Chess } from "chess.js";
import { produce } from "immer";
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
  | "threefold-repetition";

// todo(zan): Time

type GameStatus = "waiting" | "in-progress" | "complete";

// todo(zan): Think about time control
export type GameState = {
  variant: "standard";
  moves: Move[];
  movesWithNotation: string[];
  boards: string[];
  players?: { white: string; black: string };
  status: GameStatus;
  gameOverReason?: GameOverReason;
};

export const zeroState: GameState = {
  variant: "standard",
  moves: [],
  movesWithNotation: [],
  boards: [new Chess().fen()],
  status: "waiting",
};

export type GameAction =
  | {
      type: "game-created";
      payload: { players: { white: string; black: string } };
    }
  | { type: "move-made"; payload: Move }
  | {
      type: "takeback-requested";
      payload: { player: "white" | "black"; moveNumber: number };
    }
  | { type: "takeback-accepted"; payload: {} }
  | { type: "player-resigned"; payload: { player: "white" | "black" } }
  | { type: "game-over"; payload: GameOverReason };

export const exec = (state: GameState, action: GameAction): [GameState, GameAction[]] => {
  let actions: GameAction[] = [];

  switch (action.type) {
    case "game-created": {
      state.players = action.payload.players;
      break;
    }

    case "move-made": {
      try {
        // TODO(zan): To support variants, we can use a different rules engine
        const chess = new Chess(state.boards[state.boards.length - 1]);

        const move = chess.move({
          from: action.payload.source,
          to: action.payload.target,
          promotion: "q",
        });

        // If first move is made, game is in progress
        if (state.moves.length === 0) {
          state.status = "in-progress";
        }

        if (state.status !== "in-progress") {
          break;
        }

        state.moves.push(action.payload);
        state.movesWithNotation.push(move.san);
        state.boards.push(chess.fen());

        if (chess.isGameOver()) {
          if (chess.isCheckmate()) {
            actions.push({ type: "game-over", payload: "checkmate" });
          }
          if (chess.isStalemate()) {
            actions.push({ type: "game-over", payload: "stalemate" });
          }

          if (chess.isInsufficientMaterial()) {
            actions.push({ type: "game-over", payload: "insufficient-material" });
          }

          if (chess.isThreefoldRepetition()) {
            actions.push({ type: "game-over", payload: "threefold-repetition" });
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
      const { player } = action.payload;

      actions.push({
        type: "game-over",
        payload: match(player)
          .with("white", () => "white-resignation")
          .with("black", () => "black-resignation")
          .exhaustive() as GameOverReason,
      });
      break;
    }

    case "game-over": {
      state.status = "complete";
      state.gameOverReason = action.payload;

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
