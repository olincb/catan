// ============================================================
// Trade Modal — Propose and respond to trades
// ============================================================

"use client";

import React, { useState } from "react";
import type { GameState, ResourceHand } from "../../engine/types";
import { Resource } from "../../engine/types";
import { useGameStore } from "../../stores/gameStore";
import { useSocket } from "../../hooks/useSocket";

const RESOURCE_EMOJI: Record<Resource, string> = {
  [Resource.Brick]: "🧱",
  [Resource.Lumber]: "🪵",
  [Resource.Wool]: "🐑",
  [Resource.Grain]: "🌾",
  [Resource.Ore]: "⛰️",
};

interface TradeModalProps {
  gameState: GameState;
}

export default function TradeModal({ gameState }: TradeModalProps) {
  const { playerId } = useGameStore();
  const { sendAction } = useSocket();
  const [showPropose, setShowPropose] = useState(false);
  const [offering, setOffering] = useState<Partial<ResourceHand>>({});
  const [requesting, setRequesting] = useState<Partial<ResourceHand>>({});

  const myPlayer = gameState.players.find((p) => p.id === playerId);
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  const activeTrade = gameState.activeTradeOffer;

  // Active trade display
  if (activeTrade) {
    const proposer = gameState.players.find((p) => p.id === activeTrade.fromPlayerId);
    const isMyTrade = activeTrade.fromPlayerId === playerId;
    const myResponse = playerId ? activeTrade.responses[playerId] : undefined;

    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-yellow-600">
        <h3 className="text-yellow-400 font-bold mb-2">
          🤝 Trade from {proposer?.name}
        </h3>
        <div className="flex items-center gap-4 mb-3">
          <div>
            <p className="text-xs text-gray-400">Offering:</p>
            <div className="flex gap-1">
              {Object.entries(activeTrade.offering).map(([res, amount]) =>
                amount && amount > 0 ? (
                  <span key={res} className="text-sm">
                    {amount}{RESOURCE_EMOJI[res as Resource]}
                  </span>
                ) : null
              )}
            </div>
          </div>
          <span className="text-gray-500">⇄</span>
          <div>
            <p className="text-xs text-gray-400">Requesting:</p>
            <div className="flex gap-1">
              {Object.entries(activeTrade.requesting).map(([res, amount]) =>
                amount && amount > 0 ? (
                  <span key={res} className="text-sm">
                    {amount}{RESOURCE_EMOJI[res as Resource]}
                  </span>
                ) : null
              )}
            </div>
          </div>
        </div>

        {/* Per-player response status */}
        <div className="mb-3 space-y-0.5">
          {gameState.players
            .filter((p) => p.id !== activeTrade.fromPlayerId)
            .map((p) => {
              const response = activeTrade.responses[p.id];
              return (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-gray-300">{p.name}:</span>
                  {response === "accepted" && <span className="text-green-400">✅ Accepted</span>}
                  {response === "rejected" && <span className="text-red-400">❌ Rejected</span>}
                  {response === "pending" && <span className="text-gray-500">Pending...</span>}
                </div>
              );
            })}
        </div>

        {isMyTrade ? (
          <button
            className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm"
            onClick={() => sendAction({ type: "CANCEL_TRADE" })}
          >
            Cancel Trade
          </button>
        ) : myResponse && myResponse !== "pending" ? (
          <p className="text-sm text-gray-400 italic">
            You {myResponse === "accepted" ? "accepted" : "rejected"} this trade
          </p>
        ) : (
          <div className="flex gap-2">
            <button
              className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm"
              onClick={() => sendAction({ type: "ACCEPT_TRADE", tradeId: activeTrade.id })}
            >
              ✅ Accept
            </button>
            <button
              className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm"
              onClick={() => sendAction({ type: "REJECT_TRADE", tradeId: activeTrade.id })}
            >
              ❌ Reject
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!isMyTurn || !myPlayer) return null;

  // Maritime trade buttons
  const maritimeSection = (
    <div className="mb-3">
      <p className="text-xs text-gray-400 mb-1">Maritime Trade (bank):</p>
      <div className="flex flex-wrap gap-1">
        {Object.values(Resource).map((give) => {
          if (myPlayer.resources[give] < 2) return null;
          return Object.values(Resource).map((receive) => {
            if (give === receive) return null;
            if (myPlayer.resources[give] < 4) return null; // simplified check
            return (
              <button
                key={`${give}-${receive}`}
                className="bg-blue-900 hover:bg-blue-800 text-white py-0.5 px-1.5 rounded text-xs"
                onClick={() => sendAction({ type: "MARITIME_TRADE", give, receive })}
              >
                4{RESOURCE_EMOJI[give]} → 1{RESOURCE_EMOJI[receive]}
              </button>
            );
          });
        })}
      </div>
    </div>
  );

  // Propose trade form
  if (showPropose) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-yellow-400 font-bold mb-2">Propose Trade</h3>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <p className="text-xs text-gray-400 mb-1">You give:</p>
            {Object.values(Resource).map((res) => {
              const have = myPlayer.resources[res];
              return (
                <div key={`give-${res}`} className="flex items-center gap-1 mb-1">
                  <span className="text-sm w-6">{RESOURCE_EMOJI[res]}</span>
                  <input
                    type="number"
                    min={0}
                    max={have}
                    value={offering[res] ?? 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setOffering({ ...offering, [res]: Math.min(Math.max(val, 0), have) });
                    }}
                    className="w-12 bg-gray-700 text-white text-center rounded px-1 py-0.5 text-sm"
                  />
                  <span className="text-xs text-gray-500">/{have}</span>
                </div>
              );
            })}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">You want:</p>
            {Object.values(Resource).map((res) => (
              <div key={`want-${res}`} className="flex items-center gap-1 mb-1">
                <span className="text-sm w-6">{RESOURCE_EMOJI[res]}</span>
                <input
                  type="number"
                  min={0}
                  max={19}
                  value={requesting[res] ?? 0}
                  onChange={(e) => setRequesting({ ...requesting, [res]: parseInt(e.target.value) || 0 })}
                  className="w-12 bg-gray-700 text-white text-center rounded px-1 py-0.5 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm"
            onClick={() => {
              sendAction({ type: "PROPOSE_TRADE", offering, requesting });
              setShowPropose(false);
              setOffering({});
              setRequesting({});
            }}
          >
            Send Offer
          </button>
          <button
            className="bg-gray-600 hover:bg-gray-500 text-white py-1 px-3 rounded text-sm"
            onClick={() => setShowPropose(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      {maritimeSection}
      <button
        className="bg-yellow-600 hover:bg-yellow-700 text-white py-1.5 px-3 rounded text-sm font-medium w-full"
        onClick={() => setShowPropose(true)}
      >
        🤝 Propose Trade
      </button>
    </div>
  );
}
