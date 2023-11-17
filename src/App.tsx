import {
  GenericFallback,
  ResetDialog,
  ServiceWorkerToastContainer,
  ThemeProvider,
  appkitTranslations,
} from "@dxos/react-appkit";
import { ClientProvider, Config, Defaults, Dynamics, Local } from "@dxos/react-client";
import { useSpace } from "@dxos/react-client/echo";
import { Button } from "@dxos/react-ui";
import { Chess, Piece } from "chess.js";
import React, { useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { match } from "ts-pattern";
import { useRegisterSW } from "virtual:pwa-register/react";
import { ErrorBoundary } from "./ErrorBoundary";
import { FirstIcon, LastIcon, NextIcon, PreviousIcon, ResignIcon } from "./icons";
import { GameState, InGameCursor, Move, exec, useInGameCursor, zeroState } from "./lib/game";
import { useStore } from "./lib/useStore";
import { cn } from "./lib/utils";
import { types } from "./proto";
import { arrayToPairs } from "./lib/array";

const Timer = ({ initialTime, ticking }: { initialTime: number; ticking: boolean }) => {
  const [time, setTime] = React.useState(initialTime);

  // Start the timer
  useEffect(() => {
    if (ticking) {
      const interval = setInterval(() => {
        setTime((t) => t - 1);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [ticking, setTime]);

  // Format the time (assuming it's in seconds)
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;

  return (
    <>
      <div className="h-min p-2 rounded-lg text-2xl leading-none font-mono text-gray-90 bg-gray-50 border border-gray-200 shadow-inner shadow-gray-100">
        {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
      </div>
    </>
  );
};

const PlayerInfo = ({ color, game }: { color: "White" | "Black"; game: GameState }) => {
  const turn = game.moves.length % 2 === 0 ? color === "White" : color === "Black";

  const borderColor = color === "White" ? "border-gray-200" : "border-gray-400";
  const turnIndicatorClasses = turn ? "ring-1 ring-offset-2 ring-green-300" : "";
  const textColor = turn ? "text-green-600" : "text-red-600";

  const statusText = match(game.status)
    .with("waiting", () => "Waiting for first move")
    .with("in-progress", () => (turn ? "Your turn" : "Waiting"))
    .with("complete", () =>
      match(game.gameOverReason)
        .with("black-resignation", () => "Black resigned")
        .with("white-resignation", () => "White resigned")
        .with("checkmate", () => "Checkmate")
        .with("stalemate", () => "Stalemate")
        .with("insufficient-material", () => "Insufficient material")
        .with("threefold-repetition", () => "Threefold repetition")
        .exhaustive()
    )
    .exhaustive();

  return (
    <div
      className={cn(
        "flex flex-row justify-between items-center",
        "bg-gray-50 rounded-md text-zinc-800 p-4 font-mono border shadow-sm transition-all duration-100 ease-in-out",
        borderColor,
        turnIndicatorClasses
      )}
    >
      <div>
        <div className="text-lg font-bold">{color}</div>
        <div className={cn("text-sm", textColor)}>{statusText}</div>
      </div>
      <Timer initialTime={60 * 10} ticking={turn && game.status === "in-progress"} />
    </div>
  );
};

const findPiece = (game: Chess, piece: Piece) => {
  return game
    .board()
    .flat()
    .filter((p) => p !== null)
    .find((p) => p.color === piece.color && p.type === piece.type);
};

const computeSquareStyles = (lastMove: Move | undefined, fen: string) => {
  const game = new Chess(fen);
  let squareStyles = {};

  if (lastMove !== undefined) {
    squareStyles = {
      [lastMove.source]: { backgroundColor: "rgba(30, 150, 0, 0.152)" },
      [lastMove.target]: { backgroundColor: "rgba(30, 150, 0, 0.2)" },
      ...squareStyles,
    };
  }

  if (game.inCheck()) {
    let turn = game.turn();
    let kingInCheck = findPiece(game, { type: "k", color: turn });

    squareStyles = {
      [kingInCheck.square]: { backgroundColor: "rgba(255, 0, 0, 0.2)" },
      ...squareStyles,
    };
  }

  return squareStyles;
};

const Controls = ({ cursor, onResign }: { cursor: InGameCursor; onResign: () => void }) => {
  return (
    <div className="flex flex-row gap-1">
      <Button
        onClick={() => cursor.dispatch({ type: "move-to-beginning" })}
        disabled={!cursor.can.moveBackward}
        aria-label="first move"
      >
        <FirstIcon />
      </Button>
      <Button
        onClick={() => cursor.dispatch({ type: "move-backward" })}
        disabled={!cursor.can.moveBackward}
        aria-label="previous move"
      >
        <PreviousIcon />
      </Button>
      <Button
        onClick={() => cursor.dispatch({ type: "move-forward" })}
        disabled={!cursor.can.moveForward}
        aria-label="next move"
      >
        <NextIcon />
      </Button>
      <Button
        onClick={() => cursor.dispatch({ type: "move-to-latest" })}
        disabled={!cursor.can.moveForward}
        aria-label="last move"
      >
        <LastIcon />
      </Button>
      {/* TODO(zan): Resign disabled when not game in-progress */}
      <Button onClick={onResign} aria-label="Resign">
        <ResignIcon />
      </Button>
    </div>
  );
};

const MoveList = ({ movesWithNotation }: { movesWithNotation: string[] }) => {
  const movePairs = arrayToPairs(movesWithNotation);

  const gridClass = "grid grid-cols-[2fr_4fr_4fr] gap-x-3 gap-y-1";

  return (
    <div className="p-4 rounded-md border border-gray-100 shadow-sm bg-gray-50 font-mono">
      <div className={cn(gridClass)}>
        <div>#</div>
        <div>White</div>
        <div>Black</div>
      </div>
      <div className={gridClass}>
        {movePairs.map((pair, moveNumber) => (
          // The fragment should have a unique key, which is the moveNumber here.
          <React.Fragment key={moveNumber}>
            <div className="text-gray-800 font-semibold">{moveNumber + 1}.</div>
            {pair.map((move, idx) => (
              // Each move within a pair gets its own cell in the grid.
              <div key={idx} className="text-gray-800">
                {move}
              </div>
            ))}
            {/* This checks for a pair with only one move and adds an empty cell if needed */}
            {pair.length === 1 ? <div></div> : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export const ChessGame = () => {
  const space = useSpace();

  const { state: game, send } = useStore(zeroState, exec);
  const cursor = useInGameCursor(game);

  const onDrop = (source: string, target: string) => {
    if (cursor.canInteractWithBoard) {
      send({ type: "move-made", payload: { source, target } });
      return true;
    }
    return false;
  };

  return (
    <div>
      <div className="p-4 flex flex-row justify-center gap-2">
        <MoveList movesWithNotation={game.movesWithNotation} />
        <div className="flex flex-col gap-4">
          <PlayerInfo color={"Black"} game={game} />
          <div className="w-[480px] h-[480px] aspect-ratio-1">
            <Chessboard
              customSquareStyles={computeSquareStyles(
                game.moves[cursor.__index - 1],
                game.boards[game.boards.length - 1]
              )}
              position={cursor.board}
              onPieceDrop={onDrop}
              areArrowsAllowed
              id={"main"}
              animationDuration={50}
            />
          </div>
          <PlayerInfo color="White" game={game} />

          <Controls
            cursor={cursor}
            onResign={() => send({ type: "player-resigned", payload: { player: "white" } })}
          />
        </div>
      </div>
    </div>
  );
};

// Dynamics allows configuration to be supplied by the hosting KUBE.
const config = async () => new Config(await Dynamics(), Local(), Defaults());

export const App = () => {
  const serviceWorker = useRegisterSW();
  return (
    <ThemeProvider
      appNs="arena-app"
      resourceExtensions={[appkitTranslations]}
      fallback={<GenericFallback />}
    >
      <ErrorBoundary fallback={({ error }) => <ResetDialog error={error} config={config} />}>
        <ClientProvider
          config={config}
          fallback={GenericFallback}
          onInitialized={async (client) => {
            client.addTypes(types);

            const searchParams = new URLSearchParams(location.search);
            if (!client.halo.identity.get() && !searchParams.has("deviceInvitationCode")) {
              await client.halo.createIdentity();
            }
          }}
        >
          <ChessGame />
          <ServiceWorkerToastContainer {...serviceWorker} />
        </ClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
};
