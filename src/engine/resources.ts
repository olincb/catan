// ============================================================
// Resource Production & Management
// ============================================================

import {
  type GameState,
  type ResourceHand,
  type PlayerState,
  Resource,
  TERRAIN_TO_RESOURCE,
  ROBBER_HAND_LIMIT,
  totalResources,
} from "./types";

/** Per-player resource production details from a dice roll */
export interface ProductionResult {
  state: GameState;
  /** Map of playerId → resources gained (only includes players who received something) */
  gains: Map<string, Partial<Record<Resource, number>>>;
}

/**
 * Distribute resources based on a dice roll.
 * Each hex matching the roll produces resources for adjacent settlements/cities,
 * unless the robber is on that hex.
 * Returns the new state and a map of what each player received.
 */
export function produceResources(state: GameState, roll: number): ProductionResult {
  const newState = structuredClone(state);
  const gains = new Map<string, Partial<Record<Resource, number>>>();

  // Find hexes matching the roll (skip robber hex)
  const producingHexes = newState.board.hexes.filter(
    (h) => h.numberToken === roll && !h.hasRobber
  );

  for (const hex of producingHexes) {
    const resource = TERRAIN_TO_RESOURCE[hex.terrain];
    if (!resource) continue;

    // Find vertices adjacent to this hex with buildings
    for (const vertex of newState.board.vertices) {
      if (!vertex.hexIds.includes(hex.id) || !vertex.building) continue;

      const player = newState.players.find(
        (p) => p.id === vertex.building!.playerId
      );
      if (!player) continue;

      const amount = vertex.building.type === "city" ? 2 : 1;
      player.resources[resource] += amount;

      // Track gains
      if (!gains.has(player.id)) gains.set(player.id, {});
      const playerGains = gains.get(player.id)!;
      playerGains[resource] = (playerGains[resource] ?? 0) + amount;
    }
  }

  return { state: newState, gains };
}

/**
 * Get player IDs that must discard (more than 7 cards on a roll of 7).
 */
export function getPlayersWhoMustDiscard(state: GameState): string[] {
  return state.players
    .filter((p) => totalResources(p.resources) > ROBBER_HAND_LIMIT)
    .map((p) => p.id);
}

/**
 * Validate and apply a discard action.
 */
export function discardResources(
  player: PlayerState,
  toDiscard: Partial<ResourceHand>
): { player: PlayerState; error?: string } {
  const total = totalResources(player.resources);
  const discardAmount = Object.values(toDiscard).reduce((s, n) => s + (n ?? 0), 0);
  const requiredDiscard = Math.floor(total / 2);

  if (discardAmount !== requiredDiscard) {
    return {
      player,
      error: `Must discard exactly ${requiredDiscard} cards, got ${discardAmount}`,
    };
  }

  // Validate player has enough of each resource
  for (const [res, amount] of Object.entries(toDiscard)) {
    if ((amount ?? 0) > player.resources[res as Resource]) {
      return {
        player,
        error: `Cannot discard ${amount} ${res}, only have ${player.resources[res as Resource]}`,
      };
    }
  }

  const newPlayer = structuredClone(player);
  for (const [res, amount] of Object.entries(toDiscard)) {
    newPlayer.resources[res as Resource] -= amount ?? 0;
  }

  return { player: newPlayer };
}

/**
 * Steal a random resource from a target player.
 */
export function stealResource(
  thief: PlayerState,
  victim: PlayerState
): { thief: PlayerState; victim: PlayerState; stolen: Resource | null } {
  const newThief = structuredClone(thief);
  const newVictim = structuredClone(victim);

  // Build array of all resources the victim has
  const available: Resource[] = [];
  for (const [res, count] of Object.entries(newVictim.resources)) {
    for (let i = 0; i < count; i++) {
      available.push(res as Resource);
    }
  }

  if (available.length === 0) {
    return { thief: newThief, victim: newVictim, stolen: null };
  }

  const stolen = available[Math.floor(Math.random() * available.length)];
  newVictim.resources[stolen] -= 1;
  newThief.resources[stolen] += 1;

  return { thief: newThief, victim: newVictim, stolen };
}

/**
 * Get the best maritime trade rate for a player for a given resource.
 */
export function getMaritimeTradeRate(
  state: GameState,
  playerId: string,
  resource: Resource
): number {
  let bestRate = 4; // default bank rate

  // Check all vertices with harbors that this player has a building on
  for (const vertex of state.board.vertices) {
    if (!vertex.harbor || !vertex.building) continue;
    if (vertex.building.playerId !== playerId) continue;

    if (vertex.harbor === "generic") {
      bestRate = Math.min(bestRate, 3);
    } else {
      // Specific harbor — check if it matches the resource
      const harborResourceMap: Record<string, Resource> = {
        brickHarbor: Resource.Brick,
        lumberHarbor: Resource.Lumber,
        woolHarbor: Resource.Wool,
        grainHarbor: Resource.Grain,
        oreHarbor: Resource.Ore,
      };
      if (harborResourceMap[vertex.harbor] === resource) {
        bestRate = Math.min(bestRate, 2);
      }
    }
  }

  return bestRate;
}
