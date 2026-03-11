// ============================================================
// Action Panel — Turn controls (roll, build, end turn)
// ============================================================

"use client";

import React, { useState, useCallback } from "react";
import type { GameState } from "../../engine/types";
import { GamePhase, TurnPhase, DevelopmentCardType, Resource, BUILDING_COSTS, hasResources } from "../../engine/types";
import { useGameStore } from "../../stores/gameStore";
import { useSocket } from "../../hooks/useSocket";
import Tooltip from "./Tooltip";
import ResourcePickerModal from "./ResourcePickerModal";

interface ActionPanelProps {
  gameState: GameState;
}

export default function ActionPanel({ gameState }: ActionPanelProps) {
  const { playerId, selectedAction, setSelectedAction, roadBuildingEdges, setRoadBuildingEdges, pendingKnight, pendingRobberHex, pendingStealTargets, pendingRobberAction } = useGameStore();
  const { sendAction } = useSocket();
  const [resourcePickerMode, setResourcePickerMode] = useState<"monopoly" | "yearOfPlenty" | null>(null);

  const handleResourcePickerConfirm = useCallback((resources: Resource[]) => {
    if (resourcePickerMode === "monopoly") {
      sendAction({ type: "PLAY_MONOPOLY", resource: resources[0] });
    } else if (resourcePickerMode === "yearOfPlenty") {
      sendAction({ type: "PLAY_YEAR_OF_PLENTY", resource1: resources[0], resource2: resources[1] });
    }
    setResourcePickerMode(null);
  }, [resourcePickerMode, sendAction]);

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

  // Discard phase indicator — shown to all players (including current turn player when not discarding themselves)
  if (gameState.turnPhase === TurnPhase.Discarding) {
    const mustDiscard = gameState.discardingPlayerIds.includes(playerId || "");
    if (!mustDiscard) {
      const waitingNames = gameState.discardingPlayerIds.map((id) => {
        const p = gameState.players.find((pl) => pl.id === id);
        return p?.name ?? "Unknown";
      });
      return (
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="bg-yellow-900/50 border border-yellow-500 rounded p-3 text-center">
            <p className="text-yellow-300 font-bold mb-1">⏳ Waiting for players to discard...</p>
            <p className="text-yellow-200 text-sm">
              {waitingNames.join(", ")} {waitingNames.length === 1 ? "needs" : "need"} to discard cards.
            </p>
          </div>
        </div>
      );
    }
  }

  if (!isMyTurn) {
    // Show discard waiting indicator when it's not our turn but players are discarding
    if (gameState.turnPhase === TurnPhase.Discarding && gameState.discardingPlayerIds.length > 0) {
      const waitingNames = gameState.discardingPlayerIds.map((id) => {
        const p = gameState.players.find((pl) => pl.id === id);
        return p?.name ?? "Unknown";
      });
      return (
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="bg-yellow-900/50 border border-yellow-500 rounded p-3 text-center">
            <p className="text-yellow-300 font-bold mb-1">⏳ Waiting for players to discard...</p>
            <p className="text-yellow-200 text-sm">
              {waitingNames.join(", ")} {waitingNames.length === 1 ? "needs" : "need"} to discard cards.
            </p>
          </div>
        </div>
      );
    }
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

  const canAffordRoad = hasResources(myPlayer.resources, BUILDING_COSTS.road);
  const canAffordSettlement = hasResources(myPlayer.resources, BUILDING_COSTS.settlement);
  const canAffordCity = hasResources(myPlayer.resources, BUILDING_COSTS.city);
  const canAffordDevCard = hasResources(myPlayer.resources, BUILDING_COSTS.developmentCard);
  const canPlayDevCards = (canBuild || canRoll) && myPlayer.developmentCards.length > 0 && !myPlayer.hasPlayedDevCardThisTurn;

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      {mustRob && pendingRobberHex === null && (
        <div className="bg-red-900/50 border border-red-500 rounded p-2 text-center">
          <p className="text-red-300 text-sm font-bold">🦹 Move the robber! Click a hex on the board.</p>
        </div>
      )}

      {pendingKnight && (
        <div className="bg-red-900/50 border border-red-500 rounded p-2 text-center">
          <p className="text-red-300 text-sm font-bold">🗡️ Select a hex to place the robber</p>
          <button
            className="mt-1 bg-gray-600 hover:bg-gray-500 text-white py-1 px-2 rounded text-xs"
            onClick={() => useGameStore.getState().clearRobberState()}
          >
            Cancel
          </button>
        </div>
      )}

      {pendingRobberHex !== null && pendingStealTargets.length > 1 && (
        <div className="bg-red-900/50 border border-red-500 rounded p-2">
          <p className="text-red-300 text-sm font-bold mb-1">🦹 Choose a player to steal from:</p>
          <div className="flex flex-wrap gap-1">
            {pendingStealTargets.map(targetId => {
              const target = gameState.players.find(p => p.id === targetId);
              return (
                <button
                  key={targetId}
                  className="py-1 px-2 rounded text-xs font-medium text-white transition-colors"
                  style={{ backgroundColor: target?.color ?? "#666" }}
                  onClick={() => {
                    if (pendingRobberAction === "knight") {
                      sendAction({ type: "PLAY_KNIGHT", hexId: pendingRobberHex, stealFromPlayerId: targetId });
                    } else {
                      sendAction({ type: "MOVE_ROBBER", hexId: pendingRobberHex, stealFromPlayerId: targetId });
                    }
                    useGameStore.getState().clearRobberState();
                  }}
                >
                  {target?.name ?? targetId}
                </button>
              );
            })}
          </div>
          <button
            className="mt-1 bg-gray-600 hover:bg-gray-500 text-white py-1 px-2 rounded text-xs"
            onClick={() => useGameStore.getState().clearRobberState()}
          >
            Cancel
          </button>
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
            <Tooltip content={!canAffordRoad ? "Need: 1🧱 1🌲" : "Road: 1🧱 1🌲"}>
              <button
                className={`py-2 px-3 rounded font-medium text-sm transition-colors ${
                  !canAffordRoad
                    ? "bg-gray-700/50 text-gray-500 border border-gray-600 cursor-not-allowed opacity-60"
                    : selectedAction === "road"
                      ? "bg-green-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
                disabled={!canAffordRoad}
                onClick={() => setSelectedAction(selectedAction === "road" ? null : "road")}
              >
                🛤️ Road
              </button>
            </Tooltip>
            <Tooltip content={!canAffordSettlement ? "Need: 1🧱 1🌲 1🐑 1🌾" : "Settlement: 1🧱 1🌲 1🐑 1🌾"}>
              <button
                className={`py-2 px-3 rounded font-medium text-sm transition-colors ${
                  !canAffordSettlement
                    ? "bg-gray-700/50 text-gray-500 border border-gray-600 cursor-not-allowed opacity-60"
                    : selectedAction === "settlement"
                      ? "bg-green-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
                disabled={!canAffordSettlement}
                onClick={() => setSelectedAction(selectedAction === "settlement" ? null : "settlement")}
              >
                🏠 Settlement
              </button>
            </Tooltip>
            <Tooltip content={!canAffordCity ? "Need: 3⛰️ 2🌾" : "City: 3⛰️ 2🌾"}>
              <button
                className={`py-2 px-3 rounded font-medium text-sm transition-colors ${
                  !canAffordCity
                    ? "bg-gray-700/50 text-gray-500 border border-gray-600 cursor-not-allowed opacity-60"
                    : selectedAction === "city"
                      ? "bg-green-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
                disabled={!canAffordCity}
                onClick={() => setSelectedAction(selectedAction === "city" ? null : "city")}
              >
                🏰 City
              </button>
            </Tooltip>
            <Tooltip content={!canAffordDevCard ? "Need: 1⛰️ 1🐑 1🌾" : "Development Card: 1⛰️ 1🐑 1🌾"}>
              <button
                className={`py-2 px-3 rounded font-medium text-sm transition-colors ${
                  !canAffordDevCard
                    ? "bg-gray-700/50 text-gray-500 border border-gray-600 cursor-not-allowed opacity-60"
                    : "bg-purple-700 hover:bg-purple-600 text-white"
                }`}
                disabled={!canAffordDevCard}
                onClick={() => sendAction({ type: "BUY_DEVELOPMENT_CARD" })}
              >
                🃏 Development Card
              </button>
            </Tooltip>
          </>
        )}

        {/* Development Card play buttons */}
        {canPlayDevCards && (
          <div className="w-full border-t border-gray-700 pt-2 mt-1">
            <p className="text-xs text-gray-400 mb-1">Play a Development Card:</p>
            <div className="flex flex-wrap gap-1">
              {myPlayer.developmentCards.includes(DevelopmentCardType.Knight) && (
                <button
                  className="bg-red-800 hover:bg-red-700 text-white py-1 px-2 rounded text-xs"
                  onClick={() => {
                    useGameStore.getState().setPendingKnight(true);
                  }}
                >
                  🗡️ Knight
                </button>
              )}
              {myPlayer.developmentCards.includes(DevelopmentCardType.YearOfPlenty) && (
                <button
                  className="bg-teal-800 hover:bg-teal-700 text-white py-1 px-2 rounded text-xs"
                  onClick={() => setResourcePickerMode("yearOfPlenty")}
                >
                  🎁 Year of Plenty
                </button>
              )}
              {myPlayer.developmentCards.includes(DevelopmentCardType.Monopoly) && (
                <button
                  className="bg-yellow-800 hover:bg-yellow-700 text-white py-1 px-2 rounded text-xs"
                  onClick={() => setResourcePickerMode("monopoly")}
                >
                  💰 Monopoly
                </button>
              )}
              {myPlayer.developmentCards.includes(DevelopmentCardType.RoadBuilding) && (
                <button
                  className="bg-green-800 hover:bg-green-700 text-white py-1 px-2 rounded text-xs"
                  onClick={() => {
                    setSelectedAction("roadBuilding");
                    setRoadBuildingEdges([]);
                  }}
                >
                  🛤️ Road Building
                </button>
              )}
            </div>
          </div>
        )}

        {/* Road Building mode indicator */}
        {selectedAction === "roadBuilding" && (
          <div className="w-full bg-green-900/50 border border-green-500 rounded p-2 text-center">
            <p className="text-green-300 text-sm">
              Road Building: Place road {roadBuildingEdges.length + 1} of 2
            </p>
            <button
              className="text-xs text-gray-400 hover:text-white mt-1"
              onClick={() => { setSelectedAction(null); setRoadBuildingEdges([]); }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Newly purchased Development Cards (not yet playable) */}
        {myPlayer.newDevCards.length > 0 && (
          <div className="w-full border-t border-gray-700 pt-2 mt-1">
            <p className="text-xs text-gray-400 mb-1">New Development Cards (next turn):</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(
                myPlayer.newDevCards.reduce<Record<string, number>>((acc, card) => {
                  acc[card] = (acc[card] || 0) + 1;
                  return acc;
                }, {})
              ).map(([card, count]) => {
                const emoji = { knight: "🗡️", roadBuilding: "🛤️", yearOfPlenty: "🎁", monopoly: "💰", victoryPoint: "⭐" }[card] ?? "🃏";
                const name = { knight: "Knight", roadBuilding: "Road Building", yearOfPlenty: "Year of Plenty", monopoly: "Monopoly", victoryPoint: "Victory Point" }[card] ?? card;
                return (
                  <button
                    key={card}
                    className="bg-gray-700 text-gray-400 py-1 px-2 rounded text-xs opacity-50 cursor-not-allowed"
                    disabled
                  >
                    {emoji} {name}{count > 1 ? ` ×${count}` : ""} (next turn)
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* End turn */}
        {canEndTurn && (
          <button
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded transition-colors ml-auto"
            onClick={() => {
              useGameStore.getState().clearRobberState();
              sendAction({ type: "END_TURN" });
            }}
          >
            End Turn ⏭️
          </button>
        )}
      </div>

      <ResourcePickerModal
        isOpen={resourcePickerMode !== null}
        title={resourcePickerMode === "monopoly" ? "Monopoly: Choose a resource" : "Year of Plenty: Choose 2 resources"}
        count={resourcePickerMode === "monopoly" ? 1 : 2}
        onConfirm={handleResourcePickerConfirm}
        onCancel={() => setResourcePickerMode(null)}
      />
    </div>
  );
}
