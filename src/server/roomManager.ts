// ============================================================
// Room Manager — In-memory room lifecycle
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { getGameState } from "./gameManager";
import { GamePhase } from "../engine/types";

export interface RoomPlayer {
  id: string;
  name: string;
  ready: boolean;
  socketId: string;
  colorIndex: number;
}

export interface Room {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  gameId: string | null; // set once game starts
  createdAt: number;
  maxPlayers: number;
}

const rooms = new Map<string, Room>();
const playerToRoom = new Map<string, string>(); // socketId → room code
const disconnectTimers = new Map<string, NodeJS.Timeout>(); // playerId → timeout handle

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // Ensure uniqueness
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

export function createRoom(hostSocketId: string, hostName: string, maxPlayers: number = 4): Room {
  const code = generateRoomCode();
  const hostId = uuidv4();

  const room: Room = {
    code,
    hostId,
    players: [
      {
        id: hostId,
        name: hostName,
        ready: false,
        socketId: hostSocketId,
        colorIndex: 0,
      },
    ],
    gameId: null,
    createdAt: Date.now(),
    maxPlayers: Math.min(Math.max(maxPlayers, 2), 6),
  };

  rooms.set(code, room);
  playerToRoom.set(hostSocketId, code);

  return room;
}

export function joinRoom(
  code: string,
  socketId: string,
  playerName: string
): { room: Room; playerId: string } | { error: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: "Room not found" };

  // If game is in progress, check if this is a returning player
  if (room.gameId) {
    // If the game is finished, clear gameId so room can be reused
    const gameState = getGameState(room.gameId);
    if (gameState && gameState.phase === GamePhase.Finished) {
      room.gameId = null;
      for (const p of room.players) {
        p.ready = false;
      }
      // Fall through to normal join logic
    } else {
      const existingPlayer = room.players.find(
        (p) => p.name.toLowerCase() === playerName.toLowerCase()
      );
      if (!existingPlayer) {
        return { error: "Game already in progress" };
      }
      // Rejoin as the existing player
      const reconnectResult = reconnectPlayer(code, existingPlayer.id, socketId);
      if ("error" in reconnectResult) {
        return { error: reconnectResult.error };
      }
      return { room: reconnectResult.room, playerId: existingPlayer.id };
    }
  }

  if (room.players.length >= room.maxPlayers) return { error: "Room is full" };
  if (room.players.some((p) => p.socketId === socketId)) {
    return { error: "Already in this room" };
  }

  const playerId = uuidv4();
  const colorIndex = room.players.length;

  room.players.push({
    id: playerId,
    name: playerName,
    ready: false,
    socketId,
    colorIndex,
  });

  playerToRoom.set(socketId, code);

  return { room, playerId };
}

export function leaveRoom(socketId: string): { room: Room; playerId: string } | null {
  const code = playerToRoom.get(socketId);
  if (!code) return null;

  const room = rooms.get(code);
  if (!room) return null;

  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;

  room.players = room.players.filter((p) => p.socketId !== socketId);
  playerToRoom.delete(socketId);

  // If room is empty, delete it
  if (room.players.length === 0) {
    rooms.delete(code);
    return { room, playerId: player.id };
  }

  // If host left, transfer to next player
  if (room.hostId === player.id) {
    room.hostId = room.players[0].id;
  }

  return { room, playerId: player.id };
}

export function setReady(socketId: string, ready: boolean): Room | null {
  const code = playerToRoom.get(socketId);
  if (!code) return null;

  const room = rooms.get(code);
  if (!room) return null;

  const player = room.players.find((p) => p.socketId === socketId);
  if (player) player.ready = ready;

  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function getRoomBySocketId(socketId: string): Room | undefined {
  const code = playerToRoom.get(socketId);
  if (!code) return undefined;
  return rooms.get(code);
}

export function getPlayerBySocketId(socketId: string): RoomPlayer | undefined {
  const room = getRoomBySocketId(socketId);
  if (!room) return undefined;
  return room.players.find((p) => p.socketId === socketId);
}

export function setGameId(code: string, gameId: string | null): void {
  const room = rooms.get(code);
  if (room) room.gameId = gameId;
}

export function updatePlayerSocket(
  code: string,
  playerId: string,
  newSocketId: string
): boolean {
  const room = rooms.get(code);
  if (!room) return false;

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return false;

  // Clean up old mapping
  playerToRoom.delete(player.socketId);

  player.socketId = newSocketId;
  playerToRoom.set(newSocketId, code);

  return true;
}

const DISCONNECT_GRACE_PERIOD_MS = 60_000;

/**
 * Mark a player as disconnected with a grace period instead of removing them.
 * Returns the room and playerId if the player was found in an active game, null otherwise.
 */
export function disconnectPlayer(
  socketId: string,
  onTimeout: (room: Room, playerId: string) => void
): { room: Room; playerId: string } | null {
  const code = playerToRoom.get(socketId);
  if (!code) return null;

  const room = rooms.get(code);
  if (!room) return null;

  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return null;

  // Grace period — allow time for page reload reconnection
  playerToRoom.delete(socketId);

  // Start grace period timer
  const timer = setTimeout(() => {
    disconnectTimers.delete(player.id);
    room.players = room.players.filter((p) => p.id !== player.id);

    if (room.players.length === 0) {
      rooms.delete(code);
    } else {
      if (room.hostId === player.id) {
        room.hostId = room.players[0].id;
      }
      onTimeout(room, player.id);
    }
  }, DISCONNECT_GRACE_PERIOD_MS);

  disconnectTimers.set(player.id, timer);

  return { room, playerId: player.id };
}

/**
 * Reconnect a player by re-associating them with a new socket.
 */
export function reconnectPlayer(
  code: string,
  playerId: string,
  newSocketId: string
): { room: Room } | { error: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: "Room not found" };

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { error: "Player not found in room" };

  // Cancel pending disconnect timer
  const timer = disconnectTimers.get(playerId);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(playerId);
  }

  // Re-associate socket
  playerToRoom.delete(player.socketId);
  player.socketId = newSocketId;
  playerToRoom.set(newSocketId, room.code);

  return { room };
}

export function getDisconnectTimers(): Map<string, NodeJS.Timeout> {
  return disconnectTimers;
}

export function canStartGame(room: Room): { canStart: boolean; error?: string } {
  if (room.players.length < 2) {
    return { canStart: false, error: "Need at least 2 players" };
  }
  if (!room.players.every((p) => p.ready)) {
    return { canStart: false, error: "All players must be ready" };
  }
  if (room.gameId) {
    return { canStart: false, error: "Game already started" };
  }
  return { canStart: true };
}
