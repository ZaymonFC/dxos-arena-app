import {
  GenericFallback,
  ResetDialog,
  ServiceWorkerToastContainer,
  ThemeProvider,
  appkitTranslations,
} from "@dxos/react-appkit";
import { ClientProvider, Config, Defaults, Dynamics, Local } from "@dxos/react-client";
import { useSpace } from "@dxos/react-client/echo";
import { Chess, Piece } from "chess.js";
import React, { useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { match } from "ts-pattern";
import { useRegisterSW } from "virtual:pwa-register/react";
import { ErrorBoundary } from "./ErrorBoundary";
import { GameState, InGameCursor, exec, useInGameCursor, zeroState } from "./lib/game";
import { useStore } from "./lib/useStore";
import { cn } from "./lib/utils";
import { types } from "./proto";
import { Button } from "@dxos/react-ui";

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
      <div className="text-2xl font-mono mt-2">
        {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
      </div>
    </>
  );
};

const PlayerInfo = ({ color, game }: { color: "White" | "Black"; game: GameState }) => {
  const turn = game.moves.length % 2 === 0 ? color === "White" : color === "Black";

  const borderColor = color === "White" ? "border-gray-400" : "border-gray-700";
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
        "flex flex-row justify-between",
        "bg-slate-100 rounded-md text-zinc-800 p-4 font-mono border shadow-sm transition-all duration-100 ease-in-out",
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

const computeSquareStyle = (lastSquare: string | undefined, fen: string) => {
  const game = new Chess(fen);
  let squareStyles = {};

  if (lastSquare !== undefined) {
    squareStyles = {
      [lastSquare]: { backgroundColor: "rgba(30, 150, 0, 0.2)" },
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

const Controls = ({ cursor }: { cursor: InGameCursor }) => {
  return (
    <div className="flex flex-row gap-1">
      <Button onClick={cursor.firstMove} disabled={!cursor.canMoveBackward}>
        First
      </Button>
      <Button onClick={cursor.previousMove} disabled={!cursor.canMoveBackward}>
        Previous
      </Button>
      <Button onClick={cursor.nextMove} disabled={!cursor.canMoveForward}>
        Next
      </Button>
      <Button onClick={cursor.latestMove} disabled={!cursor.canMoveForward}>
        Latest
      </Button>
    </div>
  );
};

export const ChessGame = () => {
  const space = useSpace();

  const { state: game, send } = useStore(zeroState, exec);
  const cursor = useInGameCursor(game);

  const onDrop = (source: string, target: string) => {
    if (cursor.canInteractWithBoard) {
      const move = send({ type: "move-made", payload: { source, target } });
      return true;
    }
    return false;
  };

  return (
    <div>
      <div className="p-4 flex flex-row justify-center gap-2">
        <div className="p-6 rounded-md border border-gray-400 shadow-sm bg-slate-100 font-mono">
          {game.movesWithNotation
            .reduce((acc, _, idx, src) => {
              // Group moves into pairs
              if (idx % 2 === 0) acc.push(src.slice(idx, idx + 2));
              return acc;
            }, [])
            .map((pair, moveNumber) => (
              <div key={moveNumber} className="flex items-center justify-start gap-5">
                <span className="font-semibold text-gray-800 w-8">{moveNumber + 1}.</span>
                {pair.map((move, idx) => (
                  <span key={idx} className="text-gray-700 w-8">
                    {move}
                  </span>
                ))}
              </div>
            ))}
        </div>

        <div className="flex flex-col gap-4">
          <PlayerInfo color={"Black"} game={game} />
          <div className="w-[480px] h-[480px] aspect-ratio-1">
            <Chessboard
              customSquareStyles={computeSquareStyle(
                game.moves[game.moves.length - 1]?.target,
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

          <Controls cursor={cursor} />
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
