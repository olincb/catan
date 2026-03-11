// ============================================================
// Scoring — Victory Points, Longest Road, Largest Army
// ============================================================

import {
  type GameState,
  MIN_LONGEST_ROAD,
  MIN_LARGEST_ARMY,
  VICTORY_POINTS_TO_WIN,
} from "./types";

/**
 * Compute the longest road length for a given player using vertex-tracking DFS.
 * Roads are broken by opponent buildings. No vertex may be visited twice (simple path).
 */
export function computeLongestRoad(
  state: GameState,
  playerId: string
): number {
  const { vertices, edges } = state.board;
  const playerEdges = edges.filter((e) => e.road?.playerId === playerId);
  if (playerEdges.length === 0) return 0;

  // Build adjacency: vertex -> [{neighborVertex, edgeId}]
  const adjacency = new Map<number, { vertex: number; edge: number }[]>();
  for (const edge of playerEdges) {
    const [v1, v2] = edge.vertexIds;
    if (!adjacency.has(v1)) adjacency.set(v1, []);
    if (!adjacency.has(v2)) adjacency.set(v2, []);
    adjacency.get(v1)!.push({ vertex: v2, edge: edge.id });
    adjacency.get(v2)!.push({ vertex: v1, edge: edge.id });
  }

  let maxLength = 0;

  function dfs(currentVertex: number, visitedVertices: Set<number>): number {
    let best = 0;
    const neighbors = adjacency.get(currentVertex) ?? [];
    for (const { vertex: nextVertex } of neighbors) {
      if (visitedVertices.has(nextVertex)) continue;
      // Opponent building blocks the path
      const building = vertices[nextVertex].building;
      if (building && building.playerId !== playerId) continue;

      visitedVertices.add(nextVertex);
      const length = 1 + dfs(nextVertex, visitedVertices);
      best = Math.max(best, length);
      visitedVertices.delete(nextVertex);
    }
    return best;
  }

  // Start DFS from each vertex in the player's road network
  for (const [startVertex] of adjacency) {
    const visited = new Set([startVertex]);
    const length = dfs(startVertex, visited);
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
