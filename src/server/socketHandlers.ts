// ============================================================
// Socket.IO Event Handlers
// ============================================================

import { Server, Socket } from "socket.io";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  setReady,
  getRoom,
  getRoomBySocketId,
  getPlayerBySocketId,
  setGameId,
  canStartGame,
} from "./roomManager";
import {
  startGame,
  processAction,
  getGameState,
  sanitizeStateForPlayer,
} from "./gameManager";
import type { GameAction } from "../engine/types";

export function setupSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // --- Lobby events ---

    socket.on("create_room", ({ playerName, maxPlayers }: { playerName: string; maxPlayers?: number }) => {
      const room = createRoom(socket.id, playerName, maxPlayers);
      socket.join(room.code);
      socket.emit("room_created", {
        roomCode: room.code,
        playerId: room.players[0].id,
        room: serializeRoom(room),
      });
    });

    socket.on("join_room", ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
      const result = joinRoom(roomCode, socket.id, playerName);

      if ("error" in result) {
        socket.emit("error", { message: result.error });
        return;
      }

      socket.join(result.room.code);
      socket.emit("room_joined", {
        roomCode: result.room.code,
        playerId: result.playerId,
        room: serializeRoom(result.room),
      });

      // Notify others
      socket.to(result.room.code).emit("player_joined", {
        room: serializeRoom(result.room),
      });
    });

    socket.on("leave_room", () => {
      handleLeaveRoom(socket, io);
    });

    socket.on("set_ready", ({ ready }: { ready: boolean }) => {
      const room = setReady(socket.id, ready);
      if (room) {
        io.to(room.code).emit("room_updated", {
          room: serializeRoom(room),
        });
      }
    });

    socket.on("start_game", () => {
      const room = getRoomBySocketId(socket.id);
      if (!room) {
        socket.emit("error", { message: "Not in a room" });
        return;
      }

      const player = getPlayerBySocketId(socket.id);
      if (!player || player.id !== room.hostId) {
        socket.emit("error", { message: "Only the host can start the game" });
        return;
      }

      const check = canStartGame(room);
      if (!check.canStart) {
        socket.emit("error", { message: check.error });
        return;
      }

      // Create the game
      const players = room.players.map((p) => ({ id: p.id, name: p.name }));
      const gameState = startGame(players);
      setGameId(room.code, gameState.id);

      // Send sanitized state to each player
      for (const p of room.players) {
        const sanitized = sanitizeStateForPlayer(gameState, p.id);
        io.to(p.socketId).emit("game_started", { state: sanitized });
      }
    });

    // --- Game events ---

    socket.on("game_action", ({ action }: { action: GameAction }) => {
      const room = getRoomBySocketId(socket.id);
      if (!room || !room.gameId) {
        socket.emit("error", { message: "Not in an active game" });
        return;
      }

      const player = getPlayerBySocketId(socket.id);
      if (!player) {
        socket.emit("error", { message: "Player not found" });
        return;
      }

      const result = processAction(room.gameId, {
        playerId: player.id,
        action,
      });

      if (!result.success) {
        socket.emit("action_error", { error: result.error });
        return;
      }

      // Broadcast sanitized state to each player
      for (const p of room.players) {
        const sanitized = sanitizeStateForPlayer(result.state, p.id);
        io.to(p.socketId).emit("game_state_updated", { state: sanitized });
      }
    });

    // --- Chat ---

    socket.on("chat_message", ({ message }: { message: string }) => {
      const room = getRoomBySocketId(socket.id);
      const player = getPlayerBySocketId(socket.id);
      if (!room || !player) return;

      io.to(room.code).emit("chat_message", {
        playerId: player.id,
        playerName: player.name,
        message: message.slice(0, 500), // limit length
        timestamp: Date.now(),
      });
    });

    // --- Disconnect ---

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      handleLeaveRoom(socket, io);
    });
  });
}

function handleLeaveRoom(socket: Socket, io: Server): void {
  const result = leaveRoom(socket.id);
  if (!result) return;

  socket.leave(result.room.code);

  if (result.room.players.length > 0) {
    io.to(result.room.code).emit("player_left", {
      playerId: result.playerId,
      room: serializeRoom(result.room),
    });
  }
}

function serializeRoom(room: ReturnType<typeof getRoom>) {
  if (!room) return null;
  return {
    code: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    gameId: room.gameId,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      colorIndex: p.colorIndex,
    })),
  };
}
