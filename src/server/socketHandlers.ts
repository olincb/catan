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
  disconnectPlayer,
  reconnectPlayer,
} from "./roomManager";
import {
  startGame,
  processAction,
  getGameState,
  sanitizeStateForPlayer,
  markPlayerDisconnected,
  markPlayerReconnected,
} from "./gameManager";
import { type GameAction, GamePhase } from "../engine/types";

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

      // If game exists, check whether it's still in progress or finished
      if (result.room.gameId) {
        const state = getGameState(result.room.gameId);
        if (state && state.phase === GamePhase.Finished) {
          // Game is finished — clear it so room can be reused
          result.room.gameId = null;
          // Reset all players to unready for a new game
          for (const p of result.room.players) {
            p.ready = false;
          }
          // Fall through to normal lobby join below
        } else if (state) {
          // Game in progress — reconnect
          markPlayerReconnected(result.room.gameId, result.playerId);
          const sanitized = sanitizeStateForPlayer(state, result.playerId);
          socket.emit("room_joined", {
            roomCode: result.room.code,
            playerId: result.playerId,
            room: serializeRoom(result.room),
          });
          socket.emit("game_reconnected", { state: sanitized, room: serializeRoom(result.room) });
          socket.to(result.room.code).emit("player_reconnected", {
            playerId: result.playerId,
            room: serializeRoom(result.room),
          });
          return;
        }
      }

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

    // --- Reconnection ---

    socket.on("reconnect_to_game", ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
      console.log(`Reconnect attempt: room=${roomCode}, player=${playerId}, socket=${socket.id}`);
      const result = reconnectPlayer(roomCode, playerId, socket.id);

      if ("error" in result) {
        console.log(`Reconnect failed: ${result.error}`);
        socket.emit("error", { message: result.error });
        return;
      }

      const { room } = result;

      if (!room.gameId) {
        socket.emit("error", { message: "No active game to reconnect to" });
        return;
      }

      const state = getGameState(room.gameId);
      if (!state) {
        console.log(`Reconnect failed: game state not found for gameId=${room.gameId}`);
        socket.emit("error", { message: "Game state not found" });
        return;
      }

      // Don't reconnect to a finished game — send back to lobby instead
      if (state.phase === GamePhase.Finished) {
        console.log(`Game finished, clearing gameId for room=${roomCode}`);
        setGameId(room.code, undefined);
        socket.join(room.code);
        socket.emit("room_joined", { room: serializeRoom(room) });
        return;
      }

      markPlayerReconnected(room.gameId, playerId);

      socket.join(room.code);

      const sanitized = sanitizeStateForPlayer(state, playerId);
      socket.emit("game_reconnected", { state: sanitized, room: serializeRoom(room) });
      console.log(`Reconnect success: player=${playerId} rejoined room=${roomCode}`);

      // Notify others that the player reconnected
      socket.to(room.code).emit("player_reconnected", {
        playerId,
        room: serializeRoom(room),
      });
    });

    // --- Disconnect ---

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      handleDisconnect(socket, io);
    });
  });
}

function handleDisconnect(socket: Socket, io: Server): void {
  // Try grace-period disconnect first (only applies during active games)
  const disconnectResult = disconnectPlayer(socket.id, (room, playerId) => {
    // Called when the grace period expires — permanent removal
    if (room.gameId) {
      markPlayerDisconnected(room.gameId, playerId);
    }
    if (room.players.length > 0) {
      io.to(room.code).emit("player_left", {
        playerId,
        room: serializeRoom(room),
      });
    }
  });

  if (disconnectResult) {
    const { room, playerId } = disconnectResult;
    if (room.gameId) {
      markPlayerDisconnected(room.gameId, playerId);
    }
    // Notify others about temporary disconnection
    socket.to(room.code).emit("player_disconnected", {
      playerId,
      room: serializeRoom(room),
    });
    return;
  }

  // No active game — remove immediately
  handleLeaveRoom(socket, io);
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
