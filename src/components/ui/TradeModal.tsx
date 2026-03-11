// ============================================================
// Trade Modal — Propose and respond to trades
// ============================================================

"use client";

import React, { useState, useRef } from "react";
import type { GameState, ResourceHand } from "../../engine/types";
import { Resource, TurnPhase } from "../../engine/types";
import { getMaritimeTradeRate } from "../../engine/resources";
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

function TradeResources({ resources, label }: { resources: Partial<ResourceHand>; label: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}:</p>
      <div className="flex gap-1">
        {Object.entries(resources).map(([res, amount]) =>
          amount && amount > 0 ? (
            <span key={res} className="text-sm">
              {amount}{RESOURCE_EMOJI[res as Resource]}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}

export default function TradeModal({ gameState }: TradeModalProps) {
  const { playerId } = useGameStore();
  const { sendAction } = useSocket();
  const [showPropose, setShowPropose] = useState(false);
  const [offering, setOffering] = useState<Partial<ResourceHand>>({});
  const [requesting, setRequesting] = useState<Partial<ResourceHand>>({});
  const [tradeTarget, setTradeTarget] = useState<string>("all");
  const [clampedResource, setClampedResource] = useState<string | null>(null);
  const clampTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myPlayer = gameState.players.find((p) => p.id === playerId);
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  const activeTrade = gameState.activeTradeOffer;

  // Active trade display
  if (activeTrade) {
    const proposer = gameState.players.find((p) => p.id === activeTrade.fromPlayerId);
    const isMyTrade = activeTrade.fromPlayerId === playerId;
    const myResponse = playerId ? activeTrade.responses[playerId] : undefined;
    const isTargeted = !!activeTrade.targetPlayerId;
    const isOpenTrade = !isTargeted;
    const targetPlayer = activeTrade.targetPlayerId
      ? gameState.players.find((p) => p.id === activeTrade.targetPlayerId)
      : null;

    // For non-proposer: am I part of this trade?
    const canIRespond = playerId ? playerId in activeTrade.responses : false;

    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-yellow-600">
        <h3 className="text-yellow-400 font-bold mb-1">
          🤝 Trade from {proposer?.name}
        </h3>
        {isTargeted && targetPlayer && (
          <p className="text-xs text-gray-400 mb-2">
            → To <span style={{ color: targetPlayer.color }}>{targetPlayer.name}</span> only
          </p>
        )}
        {isOpenTrade && (
          <p className="text-xs text-gray-400 mb-2">→ Open to all players</p>
        )}

        <div className="flex items-center gap-4 mb-3">
          <TradeResources resources={activeTrade.offering} label="Offering" />
          <span className="text-gray-500">⇄</span>
          <TradeResources resources={activeTrade.requesting} label="Requesting" />
        </div>

        {/* Per-player response status */}
        <div className="mb-3 space-y-0.5">
          {gameState.players
            .filter((p) => p.id in activeTrade.responses)
            .map((p) => {
              const response = activeTrade.responses[p.id];
              return (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-gray-300">{p.name}:</span>
                  {response === "accepted" && (
                    <>
                      <span className="text-green-400">✅ Accepted</span>
                      {isMyTrade && isOpenTrade && (
                        <button
                          className="ml-1 bg-green-600 hover:bg-green-700 text-white py-0.5 px-2 rounded text-xs"
                          onClick={() => sendAction({ type: "CONFIRM_TRADE", acceptingPlayerId: p.id })}
                        >
                          Confirm
                        </button>
                      )}
                    </>
                  )}
                  {response === "rejected" && <span className="text-red-400">❌ Rejected</span>}
                  {response === "pending" && <span className="text-gray-500">Pending...</span>}
                </div>
              );
            })}
        </div>

        {/* Action buttons */}
        {isMyTrade ? (
          <button
            className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-sm"
            onClick={() => sendAction({ type: "CANCEL_TRADE" })}
          >
            Cancel Trade
          </button>
        ) : canIRespond && myResponse === "pending" ? (
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
        ) : canIRespond && myResponse && myResponse !== "pending" ? (
          <p className="text-sm text-gray-400 italic">
            You {myResponse === "accepted" ? "accepted" : "rejected"} this trade
          </p>
        ) : (
          <p className="text-xs text-gray-500 italic">This trade is not for you</p>
        )}
      </div>
    );
  }

  const canTrade = gameState.turnPhase === TurnPhase.Trading || gameState.turnPhase === TurnPhase.Building;

  if (!isMyTurn || !myPlayer) return null;

  if (!canTrade) {
    return (
      <div className="bg-gray-800 rounded-lg p-3">
        <p className="text-gray-400 text-sm text-center">🎲 Roll dice to begin trading</p>
      </div>
    );
  }

  // Check if any maritime trades are available (rate depends on harbors)
  const maritimeButtons: React.ReactNode[] = [];
  for (const give of Object.values(Resource)) {
    const rate = getMaritimeTradeRate(gameState, playerId!, give);
    if (myPlayer.resources[give] < rate) continue;
    for (const receive of Object.values(Resource)) {
      if (give === receive) continue;
      maritimeButtons.push(
        <button
          key={`${give}-${receive}`}
          className="bg-blue-900 hover:bg-blue-800 text-white py-0.5 px-1.5 rounded text-xs"
          onClick={() => sendAction({ type: "MARITIME_TRADE", give, receive })}
        >
          {rate}{RESOURCE_EMOJI[give]} → 1{RESOURCE_EMOJI[receive]}
        </button>
      );
    }
  }

  // Other players for trade targeting
  const otherPlayers = gameState.players.filter((p) => p.id !== playerId);

  // Propose trade form
  if (showPropose) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-yellow-400 font-bold mb-2">Propose Trade</h3>

        {/* Trade target selector */}
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-1">Trade with:</p>
          <div className="flex flex-wrap gap-1">
            <button
              className={`py-0.5 px-2 rounded text-xs transition-colors ${
                tradeTarget === "all"
                  ? "bg-yellow-600 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
              onClick={() => setTradeTarget("all")}
            >
              All Players
            </button>
            {otherPlayers.map((p) => (
              <button
                key={p.id}
                className={`py-0.5 px-2 rounded text-xs transition-colors ${
                  tradeTarget === p.id
                    ? "bg-yellow-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
                onClick={() => setTradeTarget(p.id)}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>

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
                    value={offering[res] ?? 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      const clamped = Math.min(Math.max(val, 0), have);
                      setOffering({ ...offering, [res]: clamped });
                      if (val > have) {
                        setClampedResource(res);
                        if (clampTimerRef.current) clearTimeout(clampTimerRef.current);
                        clampTimerRef.current = setTimeout(() => setClampedResource(null), 1500);
                      }
                    }}
                    className="w-12 bg-gray-700 text-white text-center rounded px-1 py-0.5 text-sm"
                  />
                  <span className={`text-xs transition-colors duration-300 ${clampedResource === res ? "text-red-400 font-bold" : "text-gray-500"}`}>
                    {clampedResource === res ? `max ${have}` : `/${have}`}
                  </span>
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
              sendAction({
                type: "PROPOSE_TRADE",
                offering,
                requesting,
                targetPlayerId: tradeTarget === "all" ? undefined : tradeTarget,
              });
              setShowPropose(false);
              setOffering({});
              setRequesting({});
              setTradeTarget("all");
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
      <h3 className="text-yellow-400 font-bold mb-2">Trade</h3>
      <button
        className="bg-yellow-600 hover:bg-yellow-700 text-white py-1.5 px-3 rounded text-sm font-medium w-full mb-2"
        onClick={() => setShowPropose(true)}
      >
        🤝 Propose Player Trade
      </button>
      {maritimeButtons.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1">Bank Trade (rate depends on harbors):</p>
          <div className="flex flex-wrap gap-1">
            {maritimeButtons}
          </div>
        </div>
      )}
      {maritimeButtons.length === 0 && (
        <p className="text-xs text-gray-500 italic">Bank trade available when you have enough of a resource (2-4 depending on harbors)</p>
      )}
    </div>
  );
}
