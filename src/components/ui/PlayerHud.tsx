// ============================================================
// Player HUD — Resource cards, Development Cards, building costs
// ============================================================

"use client";

import React, { useState, useMemo } from "react";
import type { PlayerState, GameState } from "../../engine/types";
import { Resource, DevelopmentCardType, BUILDING_COSTS, BuildingType } from "../../engine/types";
import Tooltip from "./Tooltip";

const RESOURCE_EMOJI: Record<Resource, string> = {
  [Resource.Brick]: "🧱",
  [Resource.Lumber]: "🌲",
  [Resource.Wool]: "🐑",
  [Resource.Grain]: "🌾",
  [Resource.Ore]: "⛰️",
};

const RESOURCE_COLORS: Record<Resource, string> = {
  [Resource.Brick]: "bg-red-700",
  [Resource.Lumber]: "bg-green-800",
  [Resource.Wool]: "bg-green-200",
  [Resource.Grain]: "bg-yellow-500",
  [Resource.Ore]: "bg-gray-500",
};

const DEV_CARD_NAMES: Record<DevelopmentCardType, string> = {
  [DevelopmentCardType.Knight]: "🗡️ Knight",
  [DevelopmentCardType.RoadBuilding]: "🛤️ Road Building",
  [DevelopmentCardType.YearOfPlenty]: "🎁 Year of Plenty",
  [DevelopmentCardType.Monopoly]: "💰 Monopoly",
  [DevelopmentCardType.VictoryPoint]: "⭐ Victory Point",
};

const COST_DISPLAY_NAMES: Record<string, string> = {
  road: "Road",
  settlement: "Settlement",
  city: "City",
  developmentCard: "Development Card",
};

interface PlayerHudProps {
  player: PlayerState;
  isCurrentPlayer: boolean;
  gameState: GameState;
}

export default function PlayerHud({ player, isCurrentPlayer, gameState }: PlayerHudProps) {
  const [showCosts, setShowCosts] = useState(false);

  const vpBreakdown = useMemo(() => {
    const settlements = gameState.board.vertices.filter(
      (v) => v.building?.playerId === player.id && v.building?.type === BuildingType.Settlement
    ).length;
    const cities = gameState.board.vertices.filter(
      (v) => v.building?.playerId === player.id && v.building?.type === BuildingType.City
    ).length;
    const longestRoad = gameState.longestRoadPlayerId === player.id ? 2 : 0;
    const largestArmy = gameState.largestArmyPlayerId === player.id ? 2 : 0;
    const hiddenVP = player.hiddenVictoryPoints || 0;

    return { settlements, cities, longestRoad, largestArmy, hiddenVP };
  }, [gameState, player]);

  const totalVP = player.victoryPoints + (player.hiddenVictoryPoints || 0);
  const hasHiddenVP = (player.hiddenVictoryPoints || 0) > 0;

  return (
    <div className={`rounded-lg p-3 ${isCurrentPlayer ? "bg-gray-800 border border-yellow-500" : "bg-gray-800/50"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: player.color }}
          />
          <span className="font-bold text-white text-sm">{player.name}</span>
        </div>
        <Tooltip align="right" content={
          <div className="space-y-0.5">
            {vpBreakdown.settlements > 0 && <div>🏠 Settlements: {vpBreakdown.settlements} × 1 = {vpBreakdown.settlements} VP</div>}
            {vpBreakdown.cities > 0 && <div>🏙️ Cities: {vpBreakdown.cities} × 2 = {vpBreakdown.cities * 2} VP</div>}
            {vpBreakdown.longestRoad > 0 && <div>🛤️ Longest Road: 2 VP</div>}
            {vpBreakdown.largestArmy > 0 && <div>⚔️ Largest Army: 2 VP</div>}
            {vpBreakdown.hiddenVP > 0 && <div>⭐ VP Dev Cards: {vpBreakdown.hiddenVP} VP</div>}
          </div>
        }>
          <span className="text-yellow-400 font-bold text-sm cursor-help">
            {totalVP} VP{hasHiddenVP && <span className="text-yellow-600 text-xs"> ({player.victoryPoints} public)</span>}
          </span>
        </Tooltip>
      </div>

      {/* Resources */}
      <div className="flex gap-1 mb-2">
        {Object.values(Resource).map((res) => (
          <div
            key={res}
            className={`${RESOURCE_COLORS[res]} rounded px-2 py-1 text-center min-w-[40px]`}
            title={res}
          >
            <div className="text-sm">{RESOURCE_EMOJI[res]}</div>
            <div className="text-xs font-bold text-white">{player.resources[res]}</div>
          </div>
        ))}
      </div>

      {/* Development Cards */}
      {player.developmentCards.length > 0 && (
        <div className="mb-2">
          <div className="text-xs text-gray-400 mb-1">Development Cards:</div>
          <div className="flex flex-wrap gap-1">
            {player.developmentCards.map((card, i) => (
              <span
                key={i}
                className="text-xs bg-purple-900 text-white px-1.5 py-0.5 rounded"
              >
                {DEV_CARD_NAMES[card]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Building costs toggle */}
      <button
        className="text-xs text-gray-400 hover:text-white transition-colors"
        onClick={() => setShowCosts(!showCosts)}
      >
        {showCosts ? "Hide" : "Show"} building costs
      </button>

      {showCosts && (
        <div className="mt-2 text-xs text-gray-300 space-y-1">
          {Object.entries(BUILDING_COSTS).map(([name, costs]) => (
            <div key={name} className="flex items-center gap-1">
              <span className="font-medium w-28 shrink-0">{COST_DISPLAY_NAMES[name] ?? name}:</span>
              {Object.entries(costs).map(([res, amount]) => (
                <span key={res}>
                  {amount}{RESOURCE_EMOJI[res as Resource]}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
