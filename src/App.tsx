import React, { useEffect } from "react";
import {
  GenericFallback,
  ResetDialog,
  ServiceWorkerToastContainer,
  ThemeProvider,
  appkitTranslations,
} from "@dxos/react-appkit";
import { types } from "./proto";
import {
  ClientProvider,
  Config,
  Dynamics,
  Local,
  Defaults,
} from "@dxos/react-client";
import { useRegisterSW } from "virtual:pwa-register/react";
import { ErrorBoundary } from "./ErrorBoundary";
import { Chessboard } from "react-chessboard";
import { Chess, Move, Piece } from "chess.js";
import { deepSignal } from "deepsignal";
import { cn } from "./lib/utils";

const game = deepSignal(new Chess());

const Timer = ({
  initialTime,
  ticking,
}: {
  initialTime: number;
  ticking: boolean;
}) => {
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

const PlayerInfo = ({ color, turn }: { color; turn: boolean }) => {
  const borderColor = color === "White" ? "border-gray-400" : "border-gray-700";
  const turnIndicatorClasses = turn
    ? "ring-1 ring-offset-2 ring-green-300"
    : "";
  const textColor = turn ? "text-green-600" : "text-red-600";
  const statusText = turn ? "Your Turn" : "Waiting";

  return (
    <div
      className={cn(
        "flex flex-row justify-between",
        "bg-slate-100 my-2 rounded-md text-zinc-800 p-4 font-mono border shadow-lg transition-all duration-100 ease-in-out",
        borderColor,
        turnIndicatorClasses
      )}
    >
      <div>
        <div className="text-lg font-bold">{color}</div>
        <div className={cn("text-sm", textColor)}>{statusText}</div>
      </div>
      <Timer initialTime={60 * 10} ticking={turn} />
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

const computeSquareStyle = (lastSquare: string | undefined, game: Chess) => {
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

export const ChessGame = () => {
  const [moves, setMoves] = React.useState<string[]>([]); // TODO(zan): Start empty
  const [lastMove, setLastMove] = React.useState<string>();

  const onDrop = (source, target) => {
    try {
      const move = game.move({ from: source, to: target });
      setMoves((m) => [...m, move.san]);
      setLastMove(target);
    } catch (_) {
      return false;
    }

    return true;
  };

  return (
    <div className="p-4 flex flex-row justify-center gap-1">
      <div className="m-2 p-6 rounded-md border border-gray-400 shadow-sm bg-white">
        {moves
          .reduce((acc, move, idx, src) => {
            // Group moves into pairs
            if (idx % 2 === 0) acc.push(src.slice(idx, idx + 2));
            return acc;
          }, [])
          .map((pair, moveNumber) => (
            <div
              key={moveNumber}
              className="flex items-center justify-start gap-5"
            >
              <span className="font-semibold text-gray-800 w-8">
                {moveNumber + 1}.
              </span>
              {pair.map((move, idx) => (
                <span key={idx} className="text-gray-700 w-8">
                  {move}
                </span>
              ))}
            </div>
          ))}
      </div>

      <div className="flex flex-col gap-1">
        <PlayerInfo color={"Black"} turn={moves.length % 2 == 1} />
        <div className="w-[480px] h-[480px] aspect-ratio-1">
          <Chessboard
            customSquareStyles={computeSquareStyle(lastMove, game as Chess)}
            position={game.fen()}
            onPieceDrop={onDrop}
            areArrowsAllowed
            id={"main"}
          />
        </div>
        <PlayerInfo color="White" turn={moves.length % 2 == 0} />
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
      <ErrorBoundary
        fallback={({ error }) => <ResetDialog error={error} config={config} />}
      >
        <ClientProvider
          config={config}
          fallback={GenericFallback}
          onInitialized={async (client) => {
            client.addTypes(types);

            const searchParams = new URLSearchParams(location.search);
            if (
              !client.halo.identity.get() &&
              !searchParams.has("deviceInvitationCode")
            ) {
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
