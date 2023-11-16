import { Chess } from "chess.js";
import { produce } from "immer";
import React from "react";
import { match } from "ts-pattern";

type Move = {
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

  const newState = produce(state, (draft) => {
    switch (action.type) {
      case "game-created": {
        draft.players = action.payload.players;
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
            draft.status = "in-progress";
          }

          if (draft.status !== "in-progress") {
            break;
          }

          draft.moves.push(action.payload);
          draft.movesWithNotation.push(move.san);
          draft.boards.push(chess.fen());

          if (chess.isGameOver) {
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
        draft.status = "complete";
        draft.gameOverReason = action.payload;

        break;
      }
    }
    return draft;
  });

  return [newState, actions];
};

export const useInGameCursor = (state: GameState) => {
  const [current, setCurrent] = React.useState(true);
  const [index, setIndex] = React.useState(0);

  const board = state.boards[index];

  // Update to useEffect:
  // - The dependency array now only includes 'state.boards.length'
  // - This useEffect now only sets the index to the latest move if 'current' is true
  React.useEffect(() => {
    if (current) {
      setIndex(state.boards.length - 1);
    }
  }, [state.boards.length]);

  // selectBoardByIndex function now updates 'current'
  // - If the selected index is not the latest move, set 'current' to false
  // - Otherwise, keep it true
  const selectBoardByIndex = (index: number) => {
    const latestIndex = state.boards.length - 1;
    const adjustedIndex = Math.max(0, Math.min(index, latestIndex));
    setCurrent(adjustedIndex === latestIndex);
    setIndex(adjustedIndex);
  };

  const nextMove = () => selectBoardByIndex(index + 1);
  const previousMove = () => selectBoardByIndex(index - 1);
  const firstMove = () => selectBoardByIndex(0);
  const latestMove = () => selectBoardByIndex(state.boards.length - 1);

  return {
    __index: index,
    canMoveForward: index < state.boards.length - 1,
    canMoveBackward: index > 0,
    board,
    canInteractWithBoard: current,
    nextMove,
    previousMove,
    firstMove,
    latestMove,
  };
};

export type InGameCursor = ReturnType<typeof useInGameCursor>;
