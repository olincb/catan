// ============================================================
// Development Card System
// ============================================================

import {
  type GameState,
  DevelopmentCardType,
  Resource,
  BUILDING_COSTS,
  DEVELOPMENT_CARD_COUNTS,
  hasResources,
  deductResources,
} from "./types";

/**
 * Create a shuffled development card deck.
 */
export function createDevCardDeck(): DevelopmentCardType[] {
  const deck: DevelopmentCardType[] = [];
  for (const [type, count] of Object.entries(DEVELOPMENT_CARD_COUNTS)) {
    for (let i = 0; i < count; i++) {
      deck.push(type as DevelopmentCardType);
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Buy a development card.
 */
export function buyDevCard(
  state: GameState,
  playerId: string
): { state: GameState; error?: string; card?: DevelopmentCardType } {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { state, error: "Player not found" };

  if (!hasResources(player.resources, BUILDING_COSTS.developmentCard)) {
    return { state, error: "Not enough resources to buy a development card" };
  }

  if (state.developmentCardDeck.length === 0) {
    return { state, error: "No development cards remaining" };
  }

  const newState = structuredClone(state);
  const p = newState.players.find((p) => p.id === playerId)!;

  p.resources = deductResources(p.resources, BUILDING_COSTS.developmentCard);

  const card = newState.developmentCardDeck.pop()!;

  if (card === DevelopmentCardType.VictoryPoint) {
    // VP cards count immediately and go straight to hand (no "wait a turn" restriction)
    p.hiddenVictoryPoints += 1;
    p.developmentCards.push(card);
  } else {
    // Action cards can't be played until next turn
    p.newDevCards.push(card);
  }

  return { state: newState, card };
}

/**
 * Check if a player can play a specific dev card.
 */
export function canPlayDevCard(
  state: GameState,
  playerId: string,
  cardType: DevelopmentCardType
): { canPlay: boolean; error?: string } {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { canPlay: false, error: "Player not found" };

  // Can't play VP cards manually (they're auto-revealed at win)
  if (cardType === DevelopmentCardType.VictoryPoint) {
    return { canPlay: false, error: "Victory Point cards are revealed automatically" };
  }

  // Only one non-VP dev card per turn
  if (player.hasPlayedDevCardThisTurn) {
    return { canPlay: false, error: "Already played a development card this turn" };
  }

  // Must have the card in hand (not in newDevCards — those were bought this turn)
  if (!player.developmentCards.includes(cardType)) {
    return { canPlay: false, error: `You don't have a ${cardType} card` };
  }

  return { canPlay: true };
}

/**
 * Remove a dev card from a player's hand after playing it.
 */
export function removeDevCard(
  state: GameState,
  playerId: string,
  cardType: DevelopmentCardType
): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find((p) => p.id === playerId)!;

  const idx = player.developmentCards.indexOf(cardType);
  if (idx !== -1) {
    player.developmentCards.splice(idx, 1);
  }

  player.hasPlayedDevCardThisTurn = true;

  if (cardType === DevelopmentCardType.Knight) {
    player.playedKnights += 1;
  }

  return newState;
}

/**
 * Apply Year of Plenty effect — take 2 resources from the bank.
 */
export function applyYearOfPlenty(
  state: GameState,
  playerId: string,
  resource1: Resource,
  resource2: Resource
): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find((p) => p.id === playerId)!;
  player.resources[resource1] += 1;
  player.resources[resource2] += 1;
  return newState;
}

/**
 * Apply Monopoly effect — take all of one resource from all other players.
 */
export function applyMonopoly(
  state: GameState,
  playerId: string,
  resource: Resource
): { state: GameState; totalStolen: number } {
  const newState = structuredClone(state);
  const player = newState.players.find((p) => p.id === playerId)!;
  let totalStolen = 0;

  for (const other of newState.players) {
    if (other.id === playerId) continue;
    const amount = other.resources[resource];
    if (amount > 0) {
      other.resources[resource] = 0;
      totalStolen += amount;
    }
  }

  player.resources[resource] += totalStolen;
  return { state: newState, totalStolen };
}
