// ============================================================
// Building Placement & Validation
// ============================================================

import {
  type GameState,
  BuildingType,
  BUILDING_COSTS,
  hasResources,
  deductResources,
} from "./types";

/**
 * Check if a vertex satisfies the distance rule (no adjacent buildings).
 */
export function satisfiesDistanceRule(state: GameState, vertexId: number): boolean {
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return false;

  // Check all adjacent vertices for buildings
  for (const adjId of vertex.adjacentVertexIds) {
    const adjVertex = state.board.vertices[adjId];
    if (adjVertex?.building) return false;
  }

  return true;
}

/**
 * Check if a vertex is connected to the player's road network.
 */
export function isConnectedToRoad(
  state: GameState,
  vertexId: number,
  playerId: string
): boolean {
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return false;

  return vertex.edgeIds.some((eid) => {
    const edge = state.board.edges[eid];
    return edge?.road?.playerId === playerId;
  });
}

/**
 * Get valid vertex IDs where a player can build a settlement.
 */
export function getValidSettlementVertices(
  state: GameState,
  playerId: string,
  isSetup: boolean
): number[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  if (player.settlementsRemaining <= 0) return [];

  if (!isSetup && !hasResources(player.resources, BUILDING_COSTS.settlement)) {
    return [];
  }

  return state.board.vertices
    .filter((v) => {
      if (v.building) return false;
      if (!satisfiesDistanceRule(state, v.id)) return false;
      // During setup, no road connectivity required
      if (!isSetup && !isConnectedToRoad(state, v.id, playerId)) return false;
      return true;
    })
    .map((v) => v.id);
}

/**
 * Get valid vertex IDs where a player can upgrade to a city.
 */
export function getValidCityVertices(
  state: GameState,
  playerId: string
): number[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  if (player.citiesRemaining <= 0) return [];
  if (!hasResources(player.resources, BUILDING_COSTS.city)) return [];

  return state.board.vertices
    .filter(
      (v) =>
        v.building?.playerId === playerId &&
        v.building?.type === BuildingType.Settlement
    )
    .map((v) => v.id);
}

/**
 * Get valid edge IDs where a player can build a road.
 */
export function getValidRoadEdges(
  state: GameState,
  playerId: string,
  isSetup: boolean,
  setupVertexId?: number, // during setup, road must connect to just-placed settlement
  isFreeRoad: boolean = false // Road Building card
): number[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  if (player.roadsRemaining <= 0) return [];

  if (!isSetup && !isFreeRoad && !hasResources(player.resources, BUILDING_COSTS.road)) {
    return [];
  }

  return state.board.edges
    .filter((edge) => {
      if (edge.road) return false; // already occupied

      const [v1, v2] = edge.vertexIds;

      if (isSetup && setupVertexId !== undefined) {
        // During setup, road must connect to the just-placed settlement
        return v1 === setupVertexId || v2 === setupVertexId;
      }

      // Normal play: road must connect to player's existing road or building
      const connectsToBuilding =
        state.board.vertices[v1]?.building?.playerId === playerId ||
        state.board.vertices[v2]?.building?.playerId === playerId;

      const connectsToRoad = state.board.vertices[v1].edgeIds.some(
        (eid) =>
          eid !== edge.id &&
          state.board.edges[eid]?.road?.playerId === playerId
      ) || state.board.vertices[v2].edgeIds.some(
        (eid) =>
          eid !== edge.id &&
          state.board.edges[eid]?.road?.playerId === playerId
      );

      // But road can't pass through another player's building
      const v1Blocked =
        state.board.vertices[v1]?.building !== null &&
        state.board.vertices[v1]?.building?.playerId !== playerId;
      const v2Blocked =
        state.board.vertices[v2]?.building !== null &&
        state.board.vertices[v2]?.building?.playerId !== playerId;

      if (v1Blocked && v2Blocked) return false;

      // If one end is blocked, connectivity must come from the other end
      if (v1Blocked) {
        return (
          state.board.vertices[v2]?.building?.playerId === playerId ||
          state.board.vertices[v2].edgeIds.some(
            (eid) => eid !== edge.id && state.board.edges[eid]?.road?.playerId === playerId
          )
        );
      }
      if (v2Blocked) {
        return (
          state.board.vertices[v1]?.building?.playerId === playerId ||
          state.board.vertices[v1].edgeIds.some(
            (eid) => eid !== edge.id && state.board.edges[eid]?.road?.playerId === playerId
          )
        );
      }

      return connectsToBuilding || connectsToRoad;
    })
    .map((e) => e.id);
}

/**
 * Place a settlement on a vertex.
 */
export function placeSettlement(
  state: GameState,
  playerId: string,
  vertexId: number,
  isSetup: boolean
): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find((p) => p.id === playerId)!;

  newState.board.vertices[vertexId].building = {
    type: BuildingType.Settlement,
    playerId,
  };

  player.settlementsRemaining -= 1;
  player.victoryPoints += 1;

  if (!isSetup) {
    player.resources = deductResources(player.resources, BUILDING_COSTS.settlement);
  }

  return newState;
}

/**
 * Upgrade a settlement to a city.
 */
export function placeCity(
  state: GameState,
  playerId: string,
  vertexId: number
): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find((p) => p.id === playerId)!;

  newState.board.vertices[vertexId].building = {
    type: BuildingType.City,
    playerId,
  };

  player.settlementsRemaining += 1; // settlement returned
  player.citiesRemaining -= 1;
  player.victoryPoints += 1; // net +1 (city=2, was settlement=1)

  player.resources = deductResources(player.resources, BUILDING_COSTS.city);

  return newState;
}

/**
 * Place a road on an edge.
 */
export function placeRoad(
  state: GameState,
  playerId: string,
  edgeId: number,
  isSetup: boolean,
  isFreeRoad: boolean = false
): GameState {
  const newState = structuredClone(state);
  const player = newState.players.find((p) => p.id === playerId)!;

  newState.board.edges[edgeId].road = { playerId };
  player.roadsRemaining -= 1;

  if (!isSetup && !isFreeRoad) {
    player.resources = deductResources(player.resources, BUILDING_COSTS.road);
  }

  return newState;
}
