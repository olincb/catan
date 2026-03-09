// ============================================================
// Scoreboard — Player overview panel
// ============================================================

"use client";

import React from "react";
import type { GameState } from "../../engine/types";
import { useGameStore } from "../../stores/gameStore";
import { totalResources } from "../../engine/types";

interface ScoreboardProps {
  gameState: GameState;
}

export default function Scoreboard({ gameState }: ScoreboardProps) {
  const { playerId } = useGameStore();
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <h3 className="text-sm font-bold text-gray-400 mb-2">Players</h3>
      <div className="space-y-2">
        {gameState.players.map((player) => {
          const isMe = player.id === playerId;
          const isCurrent = player.id === currentPlayer?.id;
          const hasLongestRoad = player.id === gameState.longestRoadPlayerId;
          const hasLargestArmy = player.id === gameState.largestArmyPlayerId;

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between p-2 rounded ${
                isCurrent ? "bg-gray-700 border-l-2 border-yellow-500" : "bg-gray-700/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: player.color }}
                />
                <span className={`text-sm ${isMe ? "font-bold text-white" : "text-gray-300"}`}>
                  {player.name}
                  {isMe && " (you)"}
                </span>
                {isCurrent && <span className="text-xs text-yellow-400">◀</span>}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {hasLongestRoad && (
                  <span className="bg-blue-900 text-blue-300 px-1 rounded" title="Longest Road">
                    🛤️
                  </span>
                )}
                {hasLargestArmy && (
                  <span className="bg-red-900 text-red-300 px-1 rounded" title="Largest Army">
                    🗡️
                  </span>
                )}
                <span className="text-gray-500" title="Cards in hand">
                  🃏{totalResources(player.resources)}
                </span>
                <span className="text-gray-500" title="Dev cards">
                  📜{player.developmentCards.length}
                </span>
                <span className="text-yellow-400 font-bold">
                  {player.victoryPoints}VP
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
