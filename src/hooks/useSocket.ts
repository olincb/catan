// ============================================================
// Socket.IO Client Hook
// ============================================================

"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useGameStore } from "../stores/gameStore";
import type { GameAction } from "../engine/types";

const SESSION_KEY_ROOM = "catan_roomCode";
const SESSION_KEY_PLAYER = "catan_playerId";

function saveSession(roomCode: string, playerId: string) {
  try {
    sessionStorage.setItem(SESSION_KEY_ROOM, roomCode);
    sessionStorage.setItem(SESSION_KEY_PLAYER, playerId);
  } catch { /* SSR or private browsing */ }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY_ROOM);
    sessionStorage.removeItem(SESSION_KEY_PLAYER);
  } catch { /* SSR or private browsing */ }
}

function getSavedSession(): { roomCode: string; playerId: string } | null {
  try {
    const roomCode = sessionStorage.getItem(SESSION_KEY_ROOM);
    const playerId = sessionStorage.getItem(SESSION_KEY_PLAYER);
    if (roomCode && playerId) return { roomCode, playerId };
  } catch { /* SSR or private browsing */ }
  return null;
}

let globalSocket: Socket | null = null;

function getSocket(): Socket {
  if (!globalSocket) {
    globalSocket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return globalSocket;
}

export function useSocket() {
  const {
    setConnected,
    setPlayerId,
    setRoom,
    setGameState,
    addChatMessage,
    setError,
    setReconnecting,
  } = useGameStore();

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);

      // Auto-reconnect if we have saved session credentials
      const saved = getSavedSession();
      if (saved) {
        setReconnecting(true);
        socket.emit("reconnect_to_game", {
          roomCode: saved.roomCode,
          playerId: saved.playerId,
        });
      }
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    // Room events
    socket.on("room_created", ({ roomCode, playerId, room }) => {
      setPlayerId(playerId);
      setRoom(room);
      saveSession(roomCode, playerId);
    });

    socket.on("room_joined", ({ roomCode, playerId, room }) => {
      setPlayerId(playerId);
      setRoom(room);
      saveSession(roomCode, playerId);
    });

    socket.on("room_updated", ({ room }) => {
      setRoom(room);
    });

    socket.on("player_joined", ({ room }) => {
      setRoom(room);
    });

    socket.on("player_left", ({ room }) => {
      setRoom(room);
    });

    // Game events
    socket.on("game_started", ({ state }) => {
      setGameState(state);
    });

    socket.on("game_state_updated", ({ state }) => {
      setGameState(state);
    });

    // Reconnection response
    socket.on("game_reconnected", ({ state, room }) => {
      setReconnecting(false);
      setPlayerId(getSavedSession()?.playerId ?? null);
      setRoom(room);
      setGameState(state);
    });

    socket.on("action_error", ({ error }) => {
      setError(error);
    });

    // Chat
    socket.on("chat_message", (msg) => {
      addChatMessage(msg);
    });

    // Errors
    socket.on("error", ({ message }) => {
      // If reconnection fails, clear saved session and stop reconnecting
      setReconnecting(false);
      clearSession();
      setError(message);
    });

    socket.on("connect_error", () => {
      setError("Connection lost. Reconnecting...");
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("room_created");
      socket.off("room_joined");
      socket.off("room_updated");
      socket.off("player_joined");
      socket.off("player_left");
      socket.off("game_started");
      socket.off("game_state_updated");
      socket.off("game_reconnected");
      socket.off("action_error");
      socket.off("chat_message");
      socket.off("error");
      socket.off("connect_error");
    };
  }, []);

  const createRoom = useCallback((playerName: string, maxPlayers?: number) => {
    socketRef.current?.emit("create_room", { playerName, maxPlayers });
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    socketRef.current?.emit("join_room", { roomCode, playerName });
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit("leave_room");
    clearSession();
    setRoom(null);
    setPlayerId(null);
  }, []);

  const setReady = useCallback((ready: boolean) => {
    socketRef.current?.emit("set_ready", { ready });
  }, []);

  const startGame = useCallback(() => {
    socketRef.current?.emit("start_game");
  }, []);

  const sendAction = useCallback((action: GameAction) => {
    socketRef.current?.emit("game_action", { action });
  }, []);

  const sendChat = useCallback((message: string) => {
    socketRef.current?.emit("chat_message", { message });
  }, []);

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    startGame,
    sendAction,
    sendChat,
  };
}
