// ============================================================
// Socket.IO Client Hook
// ============================================================

"use client";

import { useCallback } from "react";
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
let listenersInitialized = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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

// Singleton listener registration — called once, never cleaned up
function initSocketListeners(socket: Socket): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  const store = useGameStore.getState;

  socket.on("connect", () => {
    store().setConnected(true);

    const saved = getSavedSession();
    if (saved) {
      store().setReconnecting(true);
      socket.emit("reconnect_to_game", {
        roomCode: saved.roomCode,
        playerId: saved.playerId,
      });

      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        store().setReconnecting(false);
        clearSession();
        store().setError("Reconnection timed out. Please rejoin.");
      }, 5000);
    }
  });

  socket.on("disconnect", () => {
    store().setConnected(false);
  });

  // Room events
  socket.on("room_created", ({ roomCode, playerId, room }) => {
    store().setPlayerId(playerId);
    store().setRoom(room);
    saveSession(roomCode, playerId);
  });

  socket.on("room_joined", ({ roomCode, playerId, room }) => {
    store().setPlayerId(playerId);
    store().setRoom(room);
    saveSession(roomCode, playerId);
  });

  socket.on("room_updated", ({ room }) => {
    store().setRoom(room);
  });

  socket.on("player_joined", ({ room }) => {
    store().setRoom(room);
  });

  socket.on("player_left", ({ room }) => {
    store().setRoom(room);
  });

  // Game events
  socket.on("game_started", ({ state }) => {
    store().setGameState(state);
  });

  socket.on("game_state_updated", ({ state }) => {
    store().setGameState(state);
  });

  // Reconnection response
  socket.on("game_reconnected", ({ state, room }) => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    store().setReconnecting(false);
    store().setPlayerId(getSavedSession()?.playerId ?? null);
    store().setRoom(room);
    store().setGameState(state);
  });

  socket.on("action_error", ({ error }) => {
    store().setError(error);
  });

  // Chat
  socket.on("chat_message", (msg) => {
    store().addChatMessage(msg);
  });

  // Errors
  socket.on("error", ({ message }) => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    store().setReconnecting(false);
    clearSession();
    store().setError(message);
  });

  socket.on("connect_error", () => {
    store().setError("Connection lost. Reconnecting...");
  });
}

/** Cancel an in-progress reconnection attempt and return to lobby */
export function cancelReconnect(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  useGameStore.getState().setReconnecting(false);
  clearSession();
}

export function useSocket() {
  // Ensure listeners are initialized (idempotent)
  const socket = getSocket();
  initSocketListeners(socket);

  const createRoom = useCallback((playerName: string, maxPlayers?: number) => {
    getSocket().emit("create_room", { playerName, maxPlayers });
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    getSocket().emit("join_room", { roomCode, playerName });
  }, []);

  const leaveRoom = useCallback(() => {
    getSocket().emit("leave_room");
    clearSession();
    useGameStore.getState().setRoom(null);
    useGameStore.getState().setPlayerId(null);
  }, []);

  const setReady = useCallback((ready: boolean) => {
    getSocket().emit("set_ready", { ready });
  }, []);

  const startGame = useCallback(() => {
    getSocket().emit("start_game");
  }, []);

  const sendAction = useCallback((action: GameAction) => {
    getSocket().emit("game_action", { action });
  }, []);

  const sendChat = useCallback((message: string) => {
    getSocket().emit("chat_message", { message });
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
