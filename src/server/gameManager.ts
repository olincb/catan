// ============================================================
// Game Manager — Manages active game instances
// ============================================================

import { type GameState, type PlayerAction, type ActionResult, GamePhase } from "../engine/types";
import { createGame, dispatchAction } from "../engine/state";
import { v4 as uuidv4 } from "uuid";

const games = new Map<string, GameState>();

/**
 * Start a new game and store it.
 */
export function startGame(
  players: { id: string; name: string }[]
): GameState {
  const gameId = uuidv4();
  const state = createGame(gameId, players);
  games.set(gameId, state);
  return state;
}

/**
 * Process a player action and return the result.
 */
export function processAction(
  gameId: string,
  action: PlayerAction
): ActionResult {
  const state = games.get(gameId);
  if (!state) {
    return {
      success: false,
      error: "Game not found",
      state: null as unknown as GameState,
    };
  }

  const result = dispatchAction(state, action);

  if (result.success) {
    games.set(gameId, result.state);
  }

  return result;
}

/**
 * Get the current state of a game.
 */
export function getGameState(gameId: string): GameState | undefined {
  return games.get(gameId);
}

/**
 * Remove a completed game.
 */
export function removeGame(gameId: string): void {
  games.delete(gameId);
}

/**
 * Create a sanitized view of the game state for a specific player.
 * Hides other players' dev cards and resources counts.
 */
export function sanitizeStateForPlayer(
  state: GameState,
  playerId: string
): GameState {
  const sanitized = structuredClone(state);

  // When game is over, reveal everything (except deck)
  if (sanitized.phase === GamePhase.Finished) {
    sanitized.developmentCardDeck = [];
    return sanitized;
  }

  for (const player of sanitized.players) {
    if (player.id !== playerId) {
      // Other players: preserve total dev card count but hide card types and VP info
      const totalDevCards = player.developmentCards.length + player.newDevCards.length;
      player.developmentCards = new Array(totalDevCards).fill(null);
      player.newDevCards = [];
      player.hiddenVictoryPoints = 0;
    }
  }

  // Don't expose the deck
  sanitized.developmentCardDeck = [];

  return sanitized;
}

/**
 * Mark a player as disconnected in the game state.
 */
export function markPlayerDisconnected(gameId: string, playerId: string): boolean {
  const state = games.get(gameId);
  if (!state) return false;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;

  player.connected = false;
  return true;
}

/**
 * Mark a player as reconnected in the game state.
 */
export function markPlayerReconnected(gameId: string, playerId: string): boolean {
  const state = games.get(gameId);
  if (!state) return false;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;

  player.connected = true;
  return true;
}
