// ============================================================
// Robber Mechanics
// ============================================================

import { type GameState, type PlayerState } from "./types";
import { stealResource } from "./resources";

/**
 * Move the robber to a new hex.
 */
export function moveRobber(
  state: GameState,
  newHexId: number
): { state: GameState; error?: string } {
  if (newHexId === state.board.robberHexId) {
    return { state, error: "Must move the robber to a different hex" };
  }

  const hex = state.board.hexes[newHexId];
  if (!hex) {
    return { state, error: "Invalid hex ID" };
  }

  const newState = structuredClone(state);

  // Remove robber from old hex
  const oldHex = newState.board.hexes.find((h) => h.id === state.board.robberHexId);
  if (oldHex) oldHex.hasRobber = false;

  // Place robber on new hex
  newState.board.hexes[newHexId].hasRobber = true;
  newState.board.robberHexId = newHexId;

  return { state: newState };
}

/**
 * Get the player IDs that can be stolen from (have a building adjacent
 * to the robber hex and at least 1 resource).
 */
export function getStealTargets(
  state: GameState,
  thiefPlayerId: string
): string[] {
  const robberHexId = state.board.robberHexId;
  const targets = new Set<string>();

  for (const vertex of state.board.vertices) {
    if (!vertex.hexIds.includes(robberHexId)) continue;
    if (!vertex.building) continue;
    if (vertex.building.playerId === thiefPlayerId) continue;

    const player = state.players.find((p) => p.id === vertex.building!.playerId);
    if (player && Object.values(player.resources).some((n) => n > 0)) {
      targets.add(vertex.building.playerId);
    }
  }

  return Array.from(targets);
}

/**
 * Execute robber placement + steal in one operation.
 */
export function executeRobber(
  state: GameState,
  thiefPlayerId: string,
  newHexId: number,
  stealFromPlayerId?: string
): { state: GameState; error?: string; stolenResource?: string | null } {
  // Move robber
  const moveResult = moveRobber(state, newHexId);
  if (moveResult.error) return moveResult;

  let newState = moveResult.state;

  // Get valid steal targets
  const targets = getStealTargets(newState, thiefPlayerId);

  if (targets.length === 0) {
    // No one to steal from
    return { state: newState, stolenResource: null };
  }

  if (stealFromPlayerId) {
    if (!targets.includes(stealFromPlayerId)) {
      return { state, error: "Cannot steal from that player (not adjacent to robber)" };
    }

    const thief = newState.players.find((p) => p.id === thiefPlayerId)!;
    const victim = newState.players.find((p) => p.id === stealFromPlayerId)!;
    const result = stealResource(thief, victim);

    // Update players in state
    newState = structuredClone(newState);
    const thiefIdx = newState.players.findIndex((p) => p.id === thiefPlayerId);
    const victimIdx = newState.players.findIndex((p) => p.id === stealFromPlayerId);
    newState.players[thiefIdx] = result.thief;
    newState.players[victimIdx] = result.victim;

    return { state: newState, stolenResource: result.stolen };
  }

  // If there are targets but no steal target specified, and only 1 target, auto-steal
  if (targets.length === 1) {
    const thief = newState.players.find((p) => p.id === thiefPlayerId)!;
    const victim = newState.players.find((p) => p.id === targets[0])!;
    const result = stealResource(thief, victim);

    newState = structuredClone(newState);
    const thiefIdx = newState.players.findIndex((p) => p.id === thiefPlayerId);
    const victimIdx = newState.players.findIndex((p) => p.id === targets[0]);
    newState.players[thiefIdx] = result.thief;
    newState.players[victimIdx] = result.victim;

    return { state: newState, stolenResource: result.stolen };
  }

  // Multiple targets — need player to choose (return state without stealing)
  return {
    state: newState,
    error: "Must choose a player to steal from",
  };
}
