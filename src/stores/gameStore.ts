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
  selectedAction: "road" | "settlement" | "city" | "roadBuilding" | null;
  setSelectedAction: (action: "road" | "settlement" | "city" | "roadBuilding" | null) => void;
  roadBuildingEdges: number[];
  setRoadBuildingEdges: (edges: number[]) => void;

  // Knight / robber steal selection
  pendingKnight: boolean;
  setPendingKnight: (pending: boolean) => void;
  pendingRobberHex: number | null;
  setPendingRobberHex: (hex: number | null) => void;
  pendingStealTargets: string[];
  setPendingStealTargets: (targets: string[]) => void;
  pendingRobberAction: "knight" | "robber" | null;
  setPendingRobberAction: (action: "knight" | "robber" | null) => void;
  clearRobberState: () => void;

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
  setGameState: (gameState) =>
    set((prev) => {
      const turnChanged =
        prev.gameState &&
        prev.gameState.currentPlayerIndex !== gameState.currentPlayerIndex;
      return turnChanged
        ? { gameState, selectedAction: null, roadBuildingEdges: [], pendingKnight: false, pendingRobberHex: null, pendingStealTargets: [], pendingRobberAction: null }
        : { gameState };
    }),

  chatMessages: [],
  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages.slice(-100), msg],
    })),

  selectedAction: null,
  setSelectedAction: (selectedAction) => set({ selectedAction }),
  roadBuildingEdges: [],
  setRoadBuildingEdges: (roadBuildingEdges) => set({ roadBuildingEdges }),

  pendingKnight: false,
  setPendingKnight: (pendingKnight) => set({ pendingKnight }),
  pendingRobberHex: null,
  setPendingRobberHex: (pendingRobberHex) => set({ pendingRobberHex }),
  pendingStealTargets: [],
  setPendingStealTargets: (pendingStealTargets) => set({ pendingStealTargets }),
  pendingRobberAction: null,
  setPendingRobberAction: (pendingRobberAction) => set({ pendingRobberAction }),
  clearRobberState: () => set({
    pendingKnight: false,
    pendingRobberHex: null,
    pendingStealTargets: [],
    pendingRobberAction: null,
  }),

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
      roadBuildingEdges: [],
      pendingKnight: false,
      pendingRobberHex: null,
      pendingStealTargets: [],
      pendingRobberAction: null,
      error: null,
      playerId: null,
      reconnecting: false,
    });
  },
}));
