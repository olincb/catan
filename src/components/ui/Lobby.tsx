// ============================================================
// Lobby — Create/Join rooms, waiting room
// ============================================================

"use client";

import React, { useState, useCallback } from "react";
import { useGameStore } from "../../stores/gameStore";
import { useSocket } from "../../hooks/useSocket";
import { PLAYER_COLORS } from "../../engine/types";

function CopyButton({ text, title, label }: { text: string; title?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className="bg-gray-600 hover:bg-gray-500 text-white rounded px-2 py-1 text-sm transition-colors"
      title={title ?? "Copy"}
    >
      {copied ? "✓ Copied!" : (label ?? "📋")}
    </button>
  );
}

export default function Lobby() {
  const { room, playerId, playerName, setPlayerName, error } = useGameStore();
  const { createRoom, joinRoom, leaveRoom, setReady, startGame } = useSocket();
  const [roomCode, setRoomCode] = useState(() => {
    if (typeof window === "undefined") return "";
    const joinCode = new URLSearchParams(window.location.search).get("join");
    if (joinCode) {
      history.replaceState(null, "", window.location.pathname);
      return joinCode.toUpperCase();
    }
    return "";
  });
  const [maxPlayers, setMaxPlayers] = useState(4);

  // Not in a room — show create/join
  if (!room) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md shadow-2xl">
          <h1 className="text-4xl font-bold text-center mb-2">
            <span className="text-yellow-400">⬡</span> Catan Online
          </h1>
          <p className="text-gray-400 text-center mb-8">Settle the island!</p>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-300 rounded p-2 mb-4 text-sm text-center">
              {error}
            </div>
          )}

          {/* Name input */}
          <div className="mb-6">
            <label className="block text-gray-400 text-sm mb-1">Your name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-yellow-500"
              maxLength={20}
            />
          </div>

          {/* Create game */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <label className="text-gray-400 text-sm">Max players:</label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                className="bg-gray-700 text-white rounded px-2 py-1 text-sm"
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <button
              className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
              disabled={!playerName.trim()}
              onClick={() => createRoom(playerName.trim(), maxPlayers)}
            >
              Create Game
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gray-800 px-3 text-gray-500 text-sm">or</span>
            </div>
          </div>

          {/* Join game */}
          <div>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter room code"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 mb-2 text-center tracking-widest text-lg"
              maxLength={6}
            />
            <button
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
              disabled={!playerName.trim() || roomCode.length < 4}
              onClick={() => joinRoom(roomCode, playerName.trim())}
            >
              Join Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  // In a room — show waiting room
  const isHost = room.hostId === playerId;
  const myRoomPlayer = room.players.find((p) => p.id === playerId);
  const allReady = room.players.every((p) => p.ready);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold text-white text-center mb-1">Waiting Room</h2>
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="bg-gray-700 text-yellow-400 font-mono text-2xl tracking-[0.3em] px-4 py-1 rounded">
            {room.code}
          </span>
          <CopyButton text={room.code} title="Copy room code" />
          <CopyButton
            text={`${window.location.origin}${window.location.pathname}?join=${room.code}`}
            title="Copy invite link"
            label="🔗 Invite"
          />
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-300 rounded p-2 mb-4 text-sm text-center">
            {error}
          </div>
        )}

        {/* Player list */}
        <div className="space-y-2 mb-6">
          {room.players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between bg-gray-700 rounded-lg px-4 py-2"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: PLAYER_COLORS[p.colorIndex] }}
                />
                <span className="text-white font-medium">
                  {p.name}
                  {p.id === room.hostId && " 👑"}
                  {p.id === playerId && " (you)"}
                </span>
              </div>
              <span className={`text-sm ${p.ready ? "text-green-400" : "text-gray-500"}`}>
                {p.ready ? "✓ Ready" : "Not ready"}
              </span>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center justify-center bg-gray-700/30 rounded-lg px-4 py-2 border border-dashed border-gray-600"
            >
              <span className="text-gray-500 text-sm">Waiting for player...</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg transition-colors"
            onClick={leaveRoom}
          >
            Leave
          </button>
          <button
            className={`flex-1 py-2 rounded-lg transition-colors font-bold ${
              myRoomPlayer?.ready
                ? "bg-gray-600 hover:bg-gray-500 text-white"
                : "bg-green-600 hover:bg-green-500 text-white"
            }`}
            onClick={() => setReady(!myRoomPlayer?.ready)}
          >
            {myRoomPlayer?.ready ? "Unready" : "Ready!"}
          </button>
        </div>

        {isHost && (
          <button
            className="w-full mt-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
            disabled={!allReady || room.players.length < 2}
            onClick={startGame}
          >
            🎮 Start Game ({room.players.length}/{room.maxPlayers})
          </button>
        )}
      </div>
    </div>
  );
}
