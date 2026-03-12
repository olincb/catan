"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useSocket, cancelReconnect } from "@/hooks/useSocket";
import { useSoundManager } from "@/hooks/useSoundManager";
import Lobby from "@/components/ui/Lobby";
import HexGrid from "@/components/board/HexGrid";
import PlayerHud from "@/components/ui/PlayerHud";
import ActionPanel from "@/components/ui/ActionPanel";
import TradeModal from "@/components/ui/TradeModal";
import GameLog from "@/components/ui/GameLog";
import Scoreboard from "@/components/ui/Scoreboard";
import DiscardDialog from "@/components/ui/DiscardDialog";
import DiceDisplay from "@/components/ui/DiceDisplay";
import { GamePhase, TurnPhase, DevelopmentCardType, DEV_CARD_NAMES, DEV_CARD_ICONS, DEV_CARD_DESC } from "@/engine/types";

function DevCardRevealModal({ card, onClose }: { card: DevelopmentCardType; onClose: () => void }) {
  const isVP = card === DevelopmentCardType.VictoryPoint;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-2xl p-8 shadow-2xl text-center max-w-xs mx-4 border border-purple-500 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl mb-3">{DEV_CARD_ICONS[card]}</div>
        <div className="text-xs uppercase tracking-widest text-purple-400 mb-1">Development Card Drawn</div>
        <h3 className="text-2xl font-bold text-white mb-3">{DEV_CARD_NAMES[card]}</h3>
        <p className={`text-sm mb-5 ${isVP ? "text-green-400" : "text-gray-400"}`}>
          {DEV_CARD_DESC[card]}
        </p>
        {!isVP && (
          <p className="text-xs text-gray-500 mb-5">Not playable until your next turn.</p>
        )}
        <button
          className="bg-purple-700 hover:bg-purple-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          onClick={onClose}
        >
          Got it!
        </button>
      </div>
    </div>
  );
}

function ErrorToast({ message }: { message: string }) {
  const { setError } = useGameStore();
  const [dismissing, setDismissing] = useState(false);

  const dismiss = () => {
    setDismissing(true);
    setTimeout(() => setError(null), 300);
  };

  useEffect(() => {
    const timer = setTimeout(dismiss, 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-red-900/90 border border-red-500 text-red-200 rounded-lg px-4 py-2 text-sm shadow-lg cursor-pointer"
      style={{
        animation: dismissing ? "toast-out 0.3s ease-in forwards" : "toast-in 0.3s ease-out",
      }}
      onClick={dismiss}
    >
      <span>{message}</span>
      <button
        className="ml-2 text-red-300 hover:text-white text-lg leading-none"
        aria-label="Dismiss"
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
      >
        ×
      </button>
    </div>
  );
}

export default function Home() {
  useSocket();
  const { play: playSound, muted, toggleMute } = useSoundManager();

  const { gameState, playerId, error, reconnecting, drawnDevCard, clearDrawnDevCard } = useGameStore();

  // Track previous state for triggering sounds
  const prevTurnPhaseRef = useRef<TurnPhase | null>(null);
  const prevCurrentPlayerRef = useRef<number>(-1);

  useEffect(() => {
    if (!gameState) return;

    // Dice roll sound
    if (
      gameState.turnPhase !== prevTurnPhaseRef.current &&
      prevTurnPhaseRef.current === TurnPhase.Rolling
    ) {
      playSound("dice");
    }

    // Robber sound
    if (gameState.turnPhase === TurnPhase.Robbing && prevTurnPhaseRef.current !== TurnPhase.Robbing) {
      playSound("robber");
    }

    // Turn change sound (only when it becomes your turn)
    if (
      gameState.currentPlayerIndex !== prevCurrentPlayerRef.current &&
      prevCurrentPlayerRef.current >= 0
    ) {
      if (gameState.players[gameState.currentPlayerIndex]?.id === playerId) {
        playSound("turn");
      }
    }

    // Victory sound
    if (gameState.phase === GamePhase.Finished) {
      playSound("victory");
    }

    prevTurnPhaseRef.current = gameState.turnPhase;
    prevCurrentPlayerRef.current = gameState.currentPlayerIndex;
  }, [gameState, playerId, playSound]);

  // Reconnecting state
  if (reconnecting) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🔄</div>
          <p className="text-white text-lg">Reconnecting to game...</p>
          <p className="text-gray-400 text-sm mt-2">Please wait</p>
          <button
            className="mt-4 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 px-4 rounded text-sm transition-colors"
            onClick={() => cancelReconnect()}
          >
            ← Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  // No game yet — show lobby
  if (!gameState) {
    return <Lobby />;
  }

  const myPlayer = gameState.players.find((p) => p.id === playerId);

  // Game finished
  if (gameState.phase === GamePhase.Finished) {
    const winner = gameState.players.find((p) => p.id === gameState.winnerId);
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-xl p-8 text-center shadow-2xl animate-slide-up">
          <h1 className="text-4xl font-bold text-yellow-400 mb-4">🏆 Game Over!</h1>
          <p className="text-2xl text-white mb-2">
            <span style={{ color: winner?.color }}>{winner?.name}</span> wins!
          </p>
          <p className="text-gray-400">
            {winner?.victoryPoints} + {winner?.hiddenVictoryPoints} hidden = {(winner?.victoryPoints ?? 0) + (winner?.hiddenVictoryPoints ?? 0)} VP
          </p>
          <button
            className="mt-6 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-8 rounded-lg"
            onClick={() => window.location.reload()}
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // Active game
  const showDice = gameState.diceRoll && gameState.diceRoll[0] > 0;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col md:flex-row">
      {/* Toast error */}
      {error && <ErrorToast message={error} />}

      {/* Dev card reveal modal */}
      {drawnDevCard && <DevCardRevealModal card={drawnDevCard} onClose={clearDrawnDevCard} />}

      {/* Mute toggle */}
      <button
        onClick={toggleMute}
        className="fixed bottom-4 left-4 z-40 bg-gray-800 hover:bg-gray-700 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg text-lg"
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {/* Discard dialog overlay */}
      <DiscardDialog gameState={gameState} />

      {/* Main board area */}
      <div className="flex-1 flex flex-col p-2 md:p-4 min-h-0">
        <div className="flex-1 min-h-0">
          <HexGrid gameState={gameState} />
        </div>

        {/* Dice display */}
        {showDice && (
          <div className="flex justify-center my-2">
            <DiceDisplay die1={gameState.diceRoll![0]} die2={gameState.diceRoll![1]} />
          </div>
        )}

        <div className="mt-1 md:mt-3">
          <ActionPanel gameState={gameState} />
        </div>
      </div>

      {/* Right sidebar / bottom panel on mobile */}
      <div className="w-full md:w-80 max-h-[40vh] md:max-h-none bg-gray-850 border-t md:border-t-0 md:border-l border-gray-700 p-3 flex flex-col gap-3 overflow-y-auto">
        <Scoreboard gameState={gameState} />
        {myPlayer && (
          <PlayerHud
            player={myPlayer}
            isCurrentPlayer={gameState.players[gameState.currentPlayerIndex]?.id === playerId}
            gameState={gameState}
          />
        )}
        <TradeModal gameState={gameState} />
        <GameLog gameState={gameState} />
      </div>
    </div>
  );
}
