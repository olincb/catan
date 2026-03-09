// ============================================================
// Action Panel — Turn controls (roll, build, end turn)
// ============================================================

"use client";

import React from "react";
import type { GameState } from "../../engine/types";
import { GamePhase, TurnPhase, DevelopmentCardType, Resource } from "../../engine/types";
import { useGameStore } from "../../stores/gameStore";
import { useSocket } from "../../hooks/useSocket";

interface ActionPanelProps {
  gameState: GameState;
}

export default function ActionPanel({ gameState }: ActionPanelProps) {
  const { playerId, selectedAction, setSelectedAction } = useGameStore();
  const { sendAction } = useSocket();

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const myPlayer = gameState.players.find((p) => p.id === playerId);
  const isSetup = gameState.phase === GamePhase.SetupForward || gameState.phase === GamePhase.SetupReverse;

  if (!myPlayer) return null;

  // Setup phase instructions
  if (isSetup && isMyTurn) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-yellow-400 font-bold mb-2">Setup Phase</h3>
        <p className="text-gray-300 text-sm">
          Place a settlement on a vertex, then place a road on an adjacent edge.
        </p>
      </div>
    );
  }

  if (!isMyTurn) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <p className="text-gray-400 text-center">
          Waiting for <span className="font-bold" style={{ color: currentPlayer?.color }}>
            {currentPlayer?.name}
          </span>...
        </p>
      </div>
    );
  }

  const canRoll = gameState.turnPhase === TurnPhase.PreRoll;
  const canBuild = gameState.turnPhase === TurnPhase.Trading || gameState.turnPhase === TurnPhase.Building;
  const canEndTurn = gameState.turnPhase !== TurnPhase.PreRoll &&
    gameState.turnPhase !== TurnPhase.Discarding &&
    gameState.turnPhase !== TurnPhase.Robbing &&
    !gameState.activeTradeOffer;
  const mustRob = gameState.turnPhase === TurnPhase.Robbing;

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      {/* Dice */}
      {gameState.diceRoll && (
        <div className="text-center">
          <span className="text-3xl">🎲</span>
          <span className="text-2xl font-bold text-white ml-2">
            {gameState.diceRoll[0]} + {gameState.diceRoll[1]} = {gameState.diceRoll[0] + gameState.diceRoll[1]}
          </span>
        </div>
      )}

      {mustRob && (
        <div className="bg-red-900/50 border border-red-500 rounded p-2 text-center">
          <p className="text-red-300 text-sm font-bold">🦹 Move the robber! Click a hex on the board.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Roll button */}
        {canRoll && (
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
            onClick={() => sendAction({ type: "ROLL_DICE" })}
          >
            🎲 Roll Dice
          </button>
        )}

        {/* Build buttons */}
        {canBuild && (
          <>
            <button
              className={`py-2 px-3 rounded font-medium text-sm transition-colors ${
                selectedAction === "road"
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
              onClick={() => setSelectedAction(selectedAction === "road" ? null : "road")}
            >
              🛤️ Road
            </button>
            <button
              className={`py-2 px-3 rounded font-medium text-sm transition-colors ${
                selectedAction === "settlement"
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
              onClick={() => setSelectedAction(selectedAction === "settlement" ? null : "settlement")}
            >
              🏠 Settlement
            </button>
            <button
              className={`py-2 px-3 rounded font-medium text-sm transition-colors ${
                selectedAction === "city"
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
              onClick={() => setSelectedAction(selectedAction === "city" ? null : "city")}
            >
              🏰 City
            </button>
            <button
              className="bg-purple-700 hover:bg-purple-600 text-white py-2 px-3 rounded font-medium text-sm transition-colors"
              onClick={() => sendAction({ type: "BUY_DEVELOPMENT_CARD" })}
            >
              🃏 Buy Dev Card
            </button>
          </>
        )}

        {/* Dev card play buttons */}
        {canBuild && myPlayer.developmentCards.length > 0 && !myPlayer.hasPlayedDevCardThisTurn && (
          <div className="w-full border-t border-gray-700 pt-2 mt-1">
            <p className="text-xs text-gray-400 mb-1">Play a dev card:</p>
            <div className="flex flex-wrap gap-1">
              {myPlayer.developmentCards.includes(DevelopmentCardType.Knight) && (
                <button
                  className="bg-red-800 hover:bg-red-700 text-white py-1 px-2 rounded text-xs"
                  onClick={() => {
                    // Knight needs hex selection — set a mode
                    sendAction({ type: "PLAY_KNIGHT", hexId: -1 }); // TODO: proper hex selection
                  }}
                >
                  🗡️ Knight
                </button>
              )}
              {myPlayer.developmentCards.includes(DevelopmentCardType.YearOfPlenty) && (
                <button
                  className="bg-teal-800 hover:bg-teal-700 text-white py-1 px-2 rounded text-xs"
                  onClick={() => {
                    sendAction({
                      type: "PLAY_YEAR_OF_PLENTY",
                      resource1: Resource.Brick,
                      resource2: Resource.Lumber,
                    });
                  }}
                >
                  🎁 Year of Plenty
                </button>
              )}
              {myPlayer.developmentCards.includes(DevelopmentCardType.Monopoly) && (
                <button
                  className="bg-yellow-800 hover:bg-yellow-700 text-white py-1 px-2 rounded text-xs"
                  onClick={() => {
                    sendAction({ type: "PLAY_MONOPOLY", resource: Resource.Ore });
                  }}
                >
                  💰 Monopoly
                </button>
              )}
              {myPlayer.developmentCards.includes(DevelopmentCardType.RoadBuilding) && (
                <button
                  className="bg-green-800 hover:bg-green-700 text-white py-1 px-2 rounded text-xs"
                  onClick={() => {
                    sendAction({ type: "PLAY_ROAD_BUILDING", edgeId1: -1 }); // TODO: proper edge selection
                  }}
                >
                  🛤️ Road Building
                </button>
              )}
            </div>
          </div>
        )}

        {/* End turn */}
        {canEndTurn && (
          <button
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded transition-colors ml-auto"
            onClick={() => sendAction({ type: "END_TURN" })}
          >
            End Turn ⏭️
          </button>
        )}
      </div>
    </div>
  );
}
