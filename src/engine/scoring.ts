// ============================================================
// Scoring — Victory Points, Longest Road, Largest Army
// ============================================================

import {
  type GameState,
  type PlayerState,
  MIN_LONGEST_ROAD,
  MIN_LARGEST_ARMY,
  VICTORY_POINTS_TO_WIN,
} from "./types";

/**
 * Compute the longest road length for a given player using DFS.
 * Roads are broken by opponent buildings.
 */
export function computeLongestRoad(
  state: GameState,
  playerId: string
): number {
  const { vertices, edges } = state.board;

  // Build adjacency: for each vertex, list edges that belong to this player
  const playerEdges = edges.filter((e) => e.road?.playerId === playerId);
  if (playerEdges.length === 0) return 0;

  // Build graph: vertex → [connected edges owned by player]
  const vertexToEdges = new Map<number, number[]>();
  for (const edge of playerEdges) {
    for (const vid of edge.vertexIds) {
      if (!vertexToEdges.has(vid)) vertexToEdges.set(vid, []);
      vertexToEdges.get(vid)!.push(edge.id);
    }
  }

  let maxLength = 0;

  // DFS from each player edge
  function dfs(edgeId: number, visited: Set<number>): number {
    visited.add(edgeId);
    const edge = edges[edgeId];
    let best = 1;

    for (const vid of edge.vertexIds) {
      // Can't pass through opponent's building
      const building = vertices[vid].building;
      if (building && building.playerId !== playerId) continue;

      const nextEdges = vertexToEdges.get(vid) ?? [];
      for (const nextEdgeId of nextEdges) {
        if (visited.has(nextEdgeId)) continue;
        const length = 1 + dfs(nextEdgeId, visited);
        best = Math.max(best, length);
      }
    }

    visited.delete(edgeId);
    return best;
  }

  for (const edge of playerEdges) {
    const length = dfs(edge.id, new Set());
    maxLength = Math.max(maxLength, length);
  }

  return maxLength;
}

/**
 * Update longest road and largest army for all players.
 * Returns the updated game state.
 */
export function updateSpecialCards(state: GameState): GameState {
  const newState = structuredClone(state);

  // --- Longest Road ---
  let longestRoadPlayer: string | null = null;
  let longestRoadLength = MIN_LONGEST_ROAD - 1; // must beat minimum

  for (const player of newState.players) {
    const roadLength = computeLongestRoad(newState, player.id);
    player.longestRoadLength = roadLength;

    if (roadLength >= MIN_LONGEST_ROAD && roadLength > longestRoadLength) {
      longestRoadLength = roadLength;
      longestRoadPlayer = player.id;
    }
  }

  // Handle ties: current holder keeps it
  if (
    longestRoadPlayer &&
    newState.longestRoadPlayerId &&
    longestRoadPlayer !== newState.longestRoadPlayerId
  ) {
    const currentHolder = newState.players.find(
      (p) => p.id === newState.longestRoadPlayerId
    );
    if (currentHolder && currentHolder.longestRoadLength >= longestRoadLength) {
      longestRoadPlayer = newState.longestRoadPlayerId; // tie goes to holder
    }
  }

  // Update VP if longest road holder changed
  if (newState.longestRoadPlayerId !== longestRoadPlayer) {
    if (newState.longestRoadPlayerId) {
      const oldHolder = newState.players.find(
        (p) => p.id === newState.longestRoadPlayerId
      );
      if (oldHolder) oldHolder.victoryPoints -= 2;
    }
    if (longestRoadPlayer) {
      const newHolder = newState.players.find((p) => p.id === longestRoadPlayer);
      if (newHolder) newHolder.victoryPoints += 2;
    }
    newState.longestRoadPlayerId = longestRoadPlayer;
  }

  // --- Largest Army ---
  let largestArmyPlayer: string | null = null;
  let largestArmySize = MIN_LARGEST_ARMY - 1;

  for (const player of newState.players) {
    if (
      player.playedKnights >= MIN_LARGEST_ARMY &&
      player.playedKnights > largestArmySize
    ) {
      largestArmySize = player.playedKnights;
      largestArmyPlayer = player.id;
    }
  }

  // Handle ties: current holder keeps it
  if (
    largestArmyPlayer &&
    newState.largestArmyPlayerId &&
    largestArmyPlayer !== newState.largestArmyPlayerId
  ) {
    const currentHolder = newState.players.find(
      (p) => p.id === newState.largestArmyPlayerId
    );
    if (currentHolder && currentHolder.playedKnights >= largestArmySize) {
      largestArmyPlayer = newState.largestArmyPlayerId;
    }
  }

  // Update VP if largest army holder changed
  if (newState.largestArmyPlayerId !== largestArmyPlayer) {
    if (newState.largestArmyPlayerId) {
      const oldHolder = newState.players.find(
        (p) => p.id === newState.largestArmyPlayerId
      );
      if (oldHolder) oldHolder.victoryPoints -= 2;
    }
    if (largestArmyPlayer) {
      const newHolder = newState.players.find(
        (p) => p.id === largestArmyPlayer
      );
      if (newHolder) newHolder.victoryPoints += 2;
    }
    newState.largestArmyPlayerId = largestArmyPlayer;
  }

  return newState;
}

/**
 * Check if any player has won.
 */
export function checkWinner(state: GameState): string | null {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return null;

  const totalVP =
    currentPlayer.victoryPoints + currentPlayer.hiddenVictoryPoints;

  if (totalVP >= VICTORY_POINTS_TO_WIN) {
    return currentPlayer.id;
  }

  return null;
}
