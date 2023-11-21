import {
  GenericFallback,
  ResetDialog,
  ServiceWorkerToastContainer,
  ThemeProvider,
  appkitTranslations,
} from "@dxos/react-appkit";
import { ClientProvider, Config, Defaults, Dynamics, Local } from "@dxos/react-client";
import { Expando, useQuery, useSpace } from "@dxos/react-client/echo";
import { useIdentity } from "@dxos/react-client/halo";
import { Button } from "@dxos/react-ui";
import { Chess, Color, Piece, PieceSymbol, Square } from "chess.js";
import React, { useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { match } from "ts-pattern";
import { useRegisterSW } from "virtual:pwa-register/react";
import { ErrorBoundary } from "./ErrorBoundary";
import { FirstIcon, LastIcon, NextIcon, PreviousIcon, ResignIcon } from "./icons";
import { arrayToPairs } from "./lib/array";
import { GameState, InGameCursor, Move, exec, useInGameCursor, zeroState } from "./lib/game";
import { useStore } from "./lib/useStore";
import { cn } from "./lib/utils";
import { types } from "./proto";

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
        .with(undefined, () => "")
        .exhaustive()
    )
    .exhaustive();

  const turnIndicatorClasses = turn ? "ring-1 ring-offset-2 ring-green-300" : "";
  const textColor = turn ? "text-green-600" : "text-red-600";

  return (
    <div
      className={cn(
        "p-4",
        "flex flex-row justify-between items-center",
        "bg-gray-50  text-gray-800 font-mono",
        "border border-gray-200 rounded-sm shadow-sm",
        "transition-all duration-100 ease-in-out",
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
    .filter((p): p is { square: Square; type: PieceSymbol; color: Color } => p !== null)
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

    if (kingInCheck) {
      squareStyles = {
        [kingInCheck.square]: { backgroundColor: "rgba(255, 0, 0, 0.2)" },
        ...squareStyles,
      };
    }
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

const MoveBadge = ({
  current,
  onClick,
  children,
}: {
  current: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => {
  const classNames = cn(
    "inline-flex items-center justify-center text-xs px-2 rounded border border-gray-200",
    "hover:bg-gray-600 hover:border-gray-50 hover:text-white hover:cursor-pointer hover:scale-105 active:scale-100",
    "transition-all duration-100 ease-in-out",
    current && "ring-1 ring-green-200"
  );

  return (
    <div onClick={onClick} className={classNames} aria-label="click to select move">
      {children}
    </div>
  );
};

const MoveList = ({
  movesWithNotation,
  currentMove,
  onSelectMove,
}: {
  movesWithNotation: string[];
  currentMove: number;
  onSelectMove: (moveNumber: number) => void;
}) => {
  const movePairs = arrayToPairs(movesWithNotation);

  const gridClass = "grid grid-cols-[2fr_4fr_4fr] gap-x-3 gap-y-1";

  return (
    <div className="p-4 rounded-sm border border-gray-200 shadow-sm bg-gray-50 font-mono">
      <div className={cn(gridClass)}>
        <div>#</div>
        <div>White</div>
        <div>Black</div>
      </div>
      <div className={gridClass}>
        {movePairs.map((pair, pairIdx) => (
          // The fragment should have a unique key, which is the moveNumber here.
          <React.Fragment key={pairIdx}>
            <div>{pairIdx + 1}.</div>
            {pair.map((move, idx) => {
              const moveNumber = pairIdx * 2 + idx + 1;

              return (
                // Each move within a pair gets its own cell in the grid.
                <MoveBadge
                  onClick={() => onSelectMove(moveNumber)}
                  current={currentMove === pairIdx * 2 + idx}
                  key={idx}
                >
                  {move}
                </MoveBadge>
              );
            })}
            {/* This checks for a pair with only one move and adds an empty cell if needed */}
            {pair.length === 1 ? <div></div> : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export const ChessGame = () => {
  const identity = useIdentity();
  const space = useSpace();

  useEffect(() => {
    console.log("Space", space);
    console.log("Identity", identity);
  }, [space, identity]);

  const { state: game, send } = useStore(zeroState, exec);

  let [dbGame] = useQuery(space, { type: "chess" });
  const cursor = useInGameCursor(game);

  useEffect(() => {
    if (!space) return;

    if (!dbGame) {
      console.log("Creating game object");
      let expando = new Expando({ type: "chess", ...game });
      space.db.add(expando);
    } else {
      console.log("Loaded game object from db", dbGame);
      console.log(dbGame.toJSON());
    }
  }, [space, dbGame]);

  const onDrop = (source: string, target: string) => {
    if (cursor.canInteractWithBoard) {
      send({ type: "move-made", payload: { source, target } });
      return true;
    }
    return false;
  };

  return (
    <div>
      <div className="p-4 flex flex-row justify-center gap-3">
        <MoveList
          currentMove={cursor.__index - 1}
          movesWithNotation={game.movesWithNotation}
          onSelectMove={(move) => cursor.dispatch({ type: "select-move", move: move })}
        />
        <div className="flex flex-col gap-3">
          <PlayerInfo color={"Black"} game={game} />
          <div className="p-1 w-[480px] h-[480px] bg-gray-50 aspect-ratio-1 shadow-sm border border-gray-200 rounded-sm">
            <Chessboard
              customSquareStyles={computeSquareStyles(
                game.moves[cursor.__index - 1],
                game.boards[cursor.__index]
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
