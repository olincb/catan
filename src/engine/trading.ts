// ============================================================
// Trading System — Player-to-player and maritime trades
// ============================================================

import {
  type GameState,
  type TradeOffer,
  type ResourceHand,
  Resource,
  hasResources,
  deductResources,
  addResources,
} from "./types";
import { getMaritimeTradeRate } from "./resources";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a trade offer from the current player.
 */
export function proposeTrade(
  state: GameState,
  playerId: string,
  offering: Partial<ResourceHand>,
  requesting: Partial<ResourceHand>
): { state: GameState; error?: string } {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { state, error: "Player not found" };

  // Validate player has the offered resources
  if (!hasResources(player.resources, offering)) {
    return { state, error: "You don't have enough resources to offer" };
  }

  // Can't trade nothing for nothing
  const offerTotal = Object.values(offering).reduce((s, n) => s + (n ?? 0), 0);
  const requestTotal = Object.values(requesting).reduce((s, n) => s + (n ?? 0), 0);
  if (offerTotal === 0 || requestTotal === 0) {
    return { state, error: "Trade must include resources on both sides" };
  }

  const newState = structuredClone(state);

  const responses: Record<string, "pending" | "accepted" | "rejected"> = {};
  for (const p of newState.players) {
    if (p.id !== playerId) {
      responses[p.id] = "pending";
    }
  }

  newState.activeTradeOffer = {
    id: uuidv4(),
    fromPlayerId: playerId,
    offering,
    requesting,
    responses,
  };

  return { state: newState };
}

/**
 * Accept a trade offer.
 */
export function acceptTrade(
  state: GameState,
  acceptingPlayerId: string,
  tradeId: string
): { state: GameState; error?: string } {
  if (!state.activeTradeOffer || state.activeTradeOffer.id !== tradeId) {
    return { state, error: "No active trade with that ID" };
  }

  const trade = state.activeTradeOffer;
  const accepter = state.players.find((p) => p.id === acceptingPlayerId);
  if (!accepter) return { state, error: "Player not found" };

  // Accepting player must have the requested resources
  if (!hasResources(accepter.resources, trade.requesting)) {
    return { state, error: "You don't have the requested resources" };
  }

  const newState = structuredClone(state);
  const proposer = newState.players.find((p) => p.id === trade.fromPlayerId)!;
  const accepterNew = newState.players.find((p) => p.id === acceptingPlayerId)!;

  // Execute the trade
  proposer.resources = deductResources(proposer.resources, trade.offering);
  proposer.resources = addResources(proposer.resources, trade.requesting);
  accepterNew.resources = deductResources(accepterNew.resources, trade.requesting);
  accepterNew.resources = addResources(accepterNew.resources, trade.offering);

  newState.activeTradeOffer = null;

  return { state: newState };
}

/**
 * Reject a trade offer.
 */
export function rejectTrade(
  state: GameState,
  rejectingPlayerId: string,
  tradeId: string
): { state: GameState; error?: string } {
  if (!state.activeTradeOffer || state.activeTradeOffer.id !== tradeId) {
    return { state, error: "No active trade with that ID" };
  }

  const newState = structuredClone(state);
  newState.activeTradeOffer!.responses[rejectingPlayerId] = "rejected";

  // If all players rejected, cancel the trade
  const allResponded = Object.values(newState.activeTradeOffer!.responses).every(
    (r) => r !== "pending"
  );
  if (allResponded) {
    newState.activeTradeOffer = null;
  }

  return { state: newState };
}

/**
 * Cancel the active trade offer (by the proposer).
 */
export function cancelTrade(state: GameState): GameState {
  const newState = structuredClone(state);
  newState.activeTradeOffer = null;
  return newState;
}

/**
 * Execute a maritime (bank) trade.
 */
export function maritimeTrade(
  state: GameState,
  playerId: string,
  give: Resource,
  receive: Resource
): { state: GameState; error?: string } {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { state, error: "Player not found" };

  if (give === receive) {
    return { state, error: "Cannot trade a resource for itself" };
  }

  const rate = getMaritimeTradeRate(state, playerId, give);

  if (player.resources[give] < rate) {
    return {
      state,
      error: `Need ${rate} ${give} for maritime trade, have ${player.resources[give]}`,
    };
  }

  const newState = structuredClone(state);
  const p = newState.players.find((p) => p.id === playerId)!;
  p.resources[give] -= rate;
  p.resources[receive] += 1;

  return { state: newState };
}
