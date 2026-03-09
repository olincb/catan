// ============================================================
// Zustand Game Store
// ============================================================

import { create } from "zustand";
import type { GameState } from "../engine/types";

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  maxPlayers: number;
  gameId: string | null;
  players: {
    id: string;
    name: string;
    ready: boolean;
    colorIndex: number;
  }[];
}

interface GameStore {
  // Connection
  connected: boolean;
  reconnecting: boolean;
  playerId: string | null;
  playerName: string;
  setPlayerName: (name: string) => void;

  // Room
  room: RoomInfo | null;
  setRoom: (room: RoomInfo | null) => void;

  // Game
  gameState: GameState | null;
  setGameState: (state: GameState) => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;

  // UI state
  selectedAction: "road" | "settlement" | "city" | null;
  setSelectedAction: (action: "road" | "settlement" | "city" | null) => void;

  // Error
  error: string | null;
  setError: (error: string | null) => void;

  // Connection state
  setConnected: (connected: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;
  setPlayerId: (id: string | null) => void;

  // Reset
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  connected: false,
  reconnecting: false,
  playerId: null,
  playerName: "",
  setPlayerName: (name) => set({ playerName: name }),

  room: null,
  setRoom: (room) => set({ room }),

  gameState: null,
  setGameState: (gameState) => set({ gameState }),

  chatMessages: [],
  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages.slice(-100), msg],
    })),

  selectedAction: null,
  setSelectedAction: (selectedAction) => set({ selectedAction }),

  error: null,
  setError: (error) => set({ error }),

  setConnected: (connected) => set({ connected }),
  setReconnecting: (reconnecting) => set({ reconnecting }),
  setPlayerId: (playerId) => set({ playerId }),

  reset: () => {
    try { sessionStorage.removeItem("catan_roomCode"); sessionStorage.removeItem("catan_playerId"); } catch { /* noop */ }
    set({
      room: null,
      gameState: null,
      chatMessages: [],
      selectedAction: null,
      error: null,
      playerId: null,
      reconnecting: false,
    });
  },
}));
