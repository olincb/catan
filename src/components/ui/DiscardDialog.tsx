// ============================================================
// Discard Dialog — Select cards to discard on a 7
// ============================================================

"use client";

import React, { useState } from "react";
import type { GameState, ResourceHand } from "../../engine/types";
import { Resource, totalResources, RESOURCE_EMOJI } from "../../engine/types";
import { useGameStore } from "../../stores/gameStore";
import { useSocket } from "../../hooks/useSocket";

interface DiscardDialogProps {
  gameState: GameState;
}

export default function DiscardDialog({ gameState }: DiscardDialogProps) {
  const { playerId } = useGameStore();
  const { sendAction } = useSocket();
  const [discards, setDiscards] = useState<Partial<ResourceHand>>({});

  const mustDiscard = gameState.discardingPlayerIds.includes(playerId || "");
  const myPlayer = gameState.players.find((p) => p.id === playerId);

  if (!mustDiscard || !myPlayer) return null;

  const total = totalResources(myPlayer.resources);
  const required = Math.floor(total / 2);
  const currentDiscard = Object.values(discards).reduce((s, n) => s + (n ?? 0), 0);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-xl font-bold text-red-400 mb-2">⚠️ Discard Cards</h3>
        <p className="text-gray-300 text-sm mb-4">
          You have {total} cards. Discard {required} ({currentDiscard}/{required} selected).
        </p>

        <div className="space-y-2 mb-4">
          {Object.values(Resource).map((res) => {
            const have = myPlayer.resources[res];
            if (have === 0) return null;

            return (
              <div key={res} className="flex items-center justify-between">
                <span className="text-sm text-white">
                  {RESOURCE_EMOJI[res]} {res} ({have})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="w-6 h-6 bg-gray-600 rounded text-white text-sm"
                    onClick={() =>
                      setDiscards({
                        ...discards,
                        [res]: Math.max(0, (discards[res] ?? 0) - 1),
                      })
                    }
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-white font-bold">
                    {discards[res] ?? 0}
                  </span>
                  <button
                    className="w-6 h-6 bg-gray-600 rounded text-white text-sm"
                    onClick={() =>
                      setDiscards({
                        ...discards,
                        [res]: Math.min(have, (discards[res] ?? 0) + 1),
                      })
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
          disabled={currentDiscard !== required}
          onClick={() => {
            sendAction({ type: "DISCARD_RESOURCES", resources: discards });
            setDiscards({});
          }}
        >
          Discard {currentDiscard}/{required} Cards
        </button>
      </div>
    </div>
  );
}
