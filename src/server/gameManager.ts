// ============================================================
// Game Manager — Manages active game instances
// ============================================================

import { type GameState, type PlayerAction, type ActionResult } from "../engine/types";
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

  for (const player of sanitized.players) {
    if (player.id !== playerId) {
      // Other players: hide dev card details but show count
      const devCardCount = player.developmentCards.length + player.newDevCards.length;
      player.developmentCards = [];
      player.newDevCards = [];
      // Hide hidden VP
      player.hiddenVictoryPoints = 0;
    }
  }

  // Don't expose the deck
  sanitized.developmentCardDeck = [];

  return sanitized;
}
