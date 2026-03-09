// ============================================================
// Socket.IO Client Hook
// ============================================================

"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useGameStore } from "../stores/gameStore";
import type { GameAction } from "../engine/types";

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
  } = useGameStore();

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    // Room events
    socket.on("room_created", ({ roomCode, playerId, room }) => {
      setPlayerId(playerId);
      setRoom(room);
    });

    socket.on("room_joined", ({ roomCode, playerId, room }) => {
      setPlayerId(playerId);
      setRoom(room);
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

    socket.on("action_error", ({ error }) => {
      setError(error);
    });

    // Chat
    socket.on("chat_message", (msg) => {
      addChatMessage(msg);
    });

    // Errors
    socket.on("error", ({ message }) => {
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
