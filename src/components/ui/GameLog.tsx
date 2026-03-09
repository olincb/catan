// ============================================================
// Game Log — Event feed & chat
// ============================================================

"use client";

import React, { useState, useRef, useEffect } from "react";
import type { GameState } from "../../engine/types";
import { useGameStore } from "../../stores/gameStore";
import { useSocket } from "../../hooks/useSocket";

interface GameLogProps {
  gameState: GameState;
}

export default function GameLog({ gameState }: GameLogProps) {
  const { chatMessages } = useGameStore();
  const { sendChat } = useSocket();
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"log" | "chat">("log");
  const scrollRef = useRef<HTMLDivElement>(null);

  const playerColorMap = new Map(
    gameState.players.map((p) => [p.id, p.color])
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState.log, chatMessages]);

  const handleSend = () => {
    if (message.trim()) {
      sendChat(message.trim());
      setMessage("");
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden flex flex-col h-48">
      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          className={`px-3 py-1.5 text-xs font-medium ${
            tab === "log" ? "text-white bg-gray-700" : "text-gray-400 hover:text-white"
          }`}
          onClick={() => setTab("log")}
        >
          📜 Game Log
        </button>
        <button
          className={`px-3 py-1.5 text-xs font-medium ${
            tab === "chat" ? "text-white bg-gray-700" : "text-gray-400 hover:text-white"
          }`}
          onClick={() => setTab("chat")}
        >
          💬 Chat
        </button>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {tab === "log"
          ? gameState.log.map((entry, i) => (
              <p key={i} className="text-xs text-gray-300">
                {entry.playerId && (
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: playerColorMap.get(entry.playerId) }}
                  />
                )}
                {entry.message}
              </p>
            ))
          : chatMessages.map((msg, i) => (
              <p key={i} className="text-xs">
                <span
                  className="font-bold"
                  style={{ color: playerColorMap.get(msg.playerId) || "#aaa" }}
                >
                  {msg.playerName}:
                </span>{" "}
                <span className="text-gray-300">{msg.message}</span>
              </p>
            ))}
      </div>

      {/* Chat input */}
      {tab === "chat" && (
        <div className="flex border-t border-gray-700">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-white text-xs px-2 py-1.5 outline-none"
            maxLength={500}
          />
          <button
            className="px-2 text-blue-400 hover:text-blue-300 text-xs"
            onClick={handleSend}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
