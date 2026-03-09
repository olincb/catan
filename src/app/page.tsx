"use client";

import { useGameStore } from "@/stores/gameStore";
import { useSocket } from "@/hooks/useSocket";
import Lobby from "@/components/ui/Lobby";
import HexGrid from "@/components/board/HexGrid";
import PlayerHud from "@/components/ui/PlayerHud";
import ActionPanel from "@/components/ui/ActionPanel";
import TradeModal from "@/components/ui/TradeModal";
import GameLog from "@/components/ui/GameLog";
import Scoreboard from "@/components/ui/Scoreboard";
import DiscardDialog from "@/components/ui/DiscardDialog";
import { GamePhase } from "@/engine/types";

export default function Home() {
  useSocket(); // Initialize socket connection

  const { gameState, playerId, error } = useGameStore();

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
        <div className="bg-gray-800 rounded-xl p-8 text-center shadow-2xl">
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
  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Toast error */}
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-red-900/90 border border-red-500 text-red-200 rounded-lg px-4 py-2 text-sm shadow-lg">
          {error}
        </div>
      )}

      {/* Discard dialog overlay */}
      <DiscardDialog gameState={gameState} />

      {/* Main board area */}
      <div className="flex-1 flex flex-col p-4">
        <div className="flex-1">
          <HexGrid gameState={gameState} />
        </div>
        <div className="mt-3">
          <ActionPanel gameState={gameState} />
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-80 bg-gray-850 border-l border-gray-700 p-3 flex flex-col gap-3 overflow-y-auto">
        <Scoreboard gameState={gameState} />
        {myPlayer && (
          <PlayerHud
            player={myPlayer}
            isCurrentPlayer={gameState.players[gameState.currentPlayerIndex]?.id === playerId}
          />
        )}
        <TradeModal gameState={gameState} />
        <GameLog gameState={gameState} />
      </div>
    </div>
  );
}
