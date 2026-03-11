// ============================================================
// Game State Machine — Action dispatcher & turn flow
// ============================================================

import {
  type GameState,
  type PlayerState,
  type PlayerAction,
  type ActionResult,
  type ResourceHand,
  GamePhase,
  TurnPhase,
  DevelopmentCardType,
  Resource,
  TERRAIN_TO_RESOURCE,
  BUILDING_COSTS,
  PIECE_LIMITS,
  PLAYER_COLORS,
  emptyResourceHand,
  hasResources,
} from "./types";
import { generateBoard } from "./board";
import { produceResources, getPlayersWhoMustDiscard, discardResources } from "./resources";
import {
  getValidSettlementVertices,
  getValidCityVertices,
  getValidRoadEdges,
  placeSettlement,
  placeCity,
  placeRoad,
} from "./building";
import {
  proposeTrade,
  acceptTrade,
  rejectTrade,
  cancelTrade,
  confirmTrade,
  maritimeTrade,
} from "./trading";
import { getMaritimeTradeRate } from "./resources";
import {
  createDevCardDeck,
  buyDevCard,
  canPlayDevCard,
  removeDevCard,
  applyYearOfPlenty,
  applyMonopoly,
} from "./devCards";
import { executeRobber } from "./robber";
import { updateSpecialCards, checkWinner } from "./scoring";


// --- Game initialization ---

export function createPlayer(id: string, name: string, colorIndex: number): PlayerState {
  return {
    id,
    name,
    color: PLAYER_COLORS[colorIndex] ?? PLAYER_COLORS[0],
    resources: emptyResourceHand(),
    developmentCards: [],
    playedKnights: 0,
    longestRoadLength: 0,
    victoryPoints: 0,
    hiddenVictoryPoints: 0,
    hasPlayedDevCardThisTurn: false,
    newDevCards: [],
    connected: true,
    settlementsRemaining: PIECE_LIMITS.settlements,
    citiesRemaining: PIECE_LIMITS.cities,
    roadsRemaining: PIECE_LIMITS.roads,
  };
}

export function createGame(
  gameId: string,
  players: { id: string; name: string }[]
): GameState {
  const playerStates = players.map((p, i) => createPlayer(p.id, p.name, i));

  return {
    id: gameId,
    board: generateBoard(players.length),
    players: playerStates,
    currentPlayerIndex: 0,
    phase: GamePhase.SetupForward,
    turnPhase: TurnPhase.Building, // during setup, players place buildings
    turnNumber: 0,
    setupRound: 1,
    setupLastPlacedVertex: null,
    diceRoll: null,
    developmentCardDeck: createDevCardDeck(),
    discardingPlayerIds: [],
    activeTradeOffer: null,
    longestRoadPlayerId: null,
    largestArmyPlayerId: null,
    winnerId: null,
    log: [{ timestamp: Date.now(), message: "Game started!" }],
  };
}

// --- Helper functions ---

function log(state: GameState, message: string, playerId?: string): void {
  state.log.push({ timestamp: Date.now(), message, playerId });
}

const RESOURCE_EMOJI: Record<Resource, string> = {
  [Resource.Brick]: "🧱",
  [Resource.Lumber]: "🌲",
  [Resource.Wool]: "🐑",
  [Resource.Grain]: "🌾",
  [Resource.Ore]: "⛰️",
};

function formatResourceGains(gains: Partial<Record<Resource, number>>): string {
  return Object.entries(gains)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([res, count]) => {
      const emoji = RESOURCE_EMOJI[res as Resource] ?? res;
      return count === 1 ? emoji : `${emoji}×${count}`;
    })
    .join(" ");
}

function formatResources(resources: Partial<Record<Resource, number>>): string {
  return Object.entries(resources)
    .filter(([, amount]) => amount && amount > 0)
    .map(([res, amount]) => `${amount}${RESOURCE_EMOJI[res as Resource] ?? res}`)
    .join(" ");
}

function getCurrentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

function advanceSetupTurn(state: GameState): GameState {
  const newState = structuredClone(state);
  const numPlayers = newState.players.length;

  // Reset for the next player's turn
  newState.setupLastPlacedVertex = null;

  if (newState.phase === GamePhase.SetupForward) {
    if (newState.currentPlayerIndex < numPlayers - 1) {
      newState.currentPlayerIndex += 1;
    } else {
      // Switch to reverse round
      newState.phase = GamePhase.SetupReverse;
      newState.setupRound = 2;
      // Stay on last player (they go first in reverse)
    }
  } else if (newState.phase === GamePhase.SetupReverse) {
    if (newState.currentPlayerIndex > 0) {
      newState.currentPlayerIndex -= 1;
    } else {
      // Setup complete! Start the game
      newState.phase = GamePhase.Playing;
      newState.turnPhase = TurnPhase.PreRoll;
      newState.currentPlayerIndex = 0;
      newState.turnNumber = 1;
      log(newState, "Setup complete! Game begins.");
    }
  }

  return newState;
}

function rollDice(): [number, number] {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
}

// Track whether player has placed settlement in current setup turn
// We use a simple state convention: if turnPhase is Building and
// the current player has no "pending setup action", they need to place settlement first.

// --- Main action dispatcher ---

export function dispatchAction(
  state: GameState,
  { playerId, action }: PlayerAction
): ActionResult {
  // Check if game is over
  if (state.phase === GamePhase.Finished) {
    return { success: false, error: "Game is already finished", state };
  }

  const currentPlayer = getCurrentPlayer(state);

  // Handle discarding (any player who must discard)
  if (action.type === "DISCARD_RESOURCES") {
    return handleDiscard(state, playerId, action.resources);
  }

  // Handle trade responses (any player can respond)
  if (action.type === "ACCEPT_TRADE" || action.type === "REJECT_TRADE") {
    return handleTradeResponse(state, playerId, action);
  }

  // All other actions require it to be the player's turn
  if (currentPlayer.id !== playerId) {
    return { success: false, error: "Not your turn", state };
  }

  // Setup phase actions
  if (state.phase === GamePhase.SetupForward || state.phase === GamePhase.SetupReverse) {
    return handleSetupAction(state, playerId, action);
  }

  // Playing phase actions
  switch (action.type) {
    case "ROLL_DICE":
      return handleRollDice(state, playerId);
    case "BUILD_SETTLEMENT":
      return handleBuildSettlement(state, playerId, action.vertexId);
    case "BUILD_CITY":
      return handleBuildCity(state, playerId, action.vertexId);
    case "BUILD_ROAD":
      return handleBuildRoad(state, playerId, action.edgeId);
    case "BUY_DEVELOPMENT_CARD":
      return handleBuyDevCard(state, playerId);
    case "PLAY_KNIGHT":
      return handlePlayKnight(state, playerId, action.hexId, action.stealFromPlayerId);
    case "PLAY_ROAD_BUILDING":
      return handlePlayRoadBuilding(state, playerId, action.edgeId1, action.edgeId2);
    case "PLAY_YEAR_OF_PLENTY":
      return handlePlayYearOfPlenty(state, playerId, action.resource1, action.resource2);
    case "PLAY_MONOPOLY":
      return handlePlayMonopoly(state, playerId, action.resource);
    case "MOVE_ROBBER":
      return handleMoveRobber(state, playerId, action.hexId, action.stealFromPlayerId);
    case "PROPOSE_TRADE":
      return handleProposeTrade(state, playerId, action.offering, action.requesting, action.targetPlayerId);
    case "CONFIRM_TRADE":
      return handleConfirmTrade(state, playerId, action.acceptingPlayerId);
    case "CANCEL_TRADE":
      return handleCancelTrade(state, playerId);
    case "MARITIME_TRADE":
      return handleMaritimeTrade(state, playerId, action.give, action.receive);
    case "END_TURN":
      return handleEndTurn(state, playerId);
    default:
      return { success: false, error: "Unknown action", state };
  }
}

// --- Setup phase handlers ---

function handleSetupAction(
  state: GameState,
  playerId: string,
  action: { type: string; [key: string]: unknown }
): ActionResult {
  if (action.type === "SETUP_PLACE_SETTLEMENT") {
    // Must place settlement before road: reject if already placed this turn
    if (state.setupLastPlacedVertex !== null) {
      return { success: false, error: "Already placed a settlement this turn — place a road next", state };
    }

    const vertexId = action.vertexId as number;
    const validVertices = getValidSettlementVertices(state, playerId, true);

    if (!validVertices.includes(vertexId)) {
      return { success: false, error: "Invalid settlement location", state };
    }

    const newState = placeSettlement(state, playerId, vertexId, true);
    newState.setupLastPlacedVertex = vertexId;

    // During second setup round, give initial resources from adjacent hexes
    if (state.phase === GamePhase.SetupReverse) {
      const vertex = newState.board.vertices[vertexId];
      const player = newState.players.find((p) => p.id === playerId)!;
      const setupGains: Partial<Record<Resource, number>> = {};
      for (const hexId of vertex.hexIds) {
        const hex = newState.board.hexes[hexId];
        const resource = TERRAIN_TO_RESOURCE[hex.terrain];
        if (resource) {
          player.resources[resource] += 1;
          setupGains[resource] = (setupGains[resource] ?? 0) + 1;
        }
      }
      if (Object.keys(setupGains).length > 0) {
        log(newState, `${newState.players.find((p) => p.id === playerId)!.name} received ${formatResourceGains(setupGains)}`, playerId);
      }
    }

    const playerName = newState.players.find((p) => p.id === playerId)!.name;
    log(newState, `${playerName} placed a settlement`, playerId);

    return { success: true, state: newState };
  }

  if (action.type === "SETUP_PLACE_ROAD") {
    // Must place settlement first: reject if no settlement placed this turn
    if (state.setupLastPlacedVertex === null) {
      return { success: false, error: "Place a settlement first", state };
    }

    const edgeId = action.edgeId as number;

    // Road must connect to the settlement just placed this turn
    const justPlacedVertex = state.board.vertices[state.setupLastPlacedVertex];
    const validEdgeIds = justPlacedVertex.edgeIds.filter((eid) => {
      const edge = state.board.edges[eid];
      return edge.road === null;
    });

    if (!validEdgeIds.includes(edgeId)) {
      return { success: false, error: "Road must connect to the settlement you just placed", state };
    }

    let newState = placeRoad(state, playerId, edgeId, true);

    const playerName = newState.players.find((p) => p.id === playerId)!.name;
    log(newState, `${playerName} placed a road`, playerId);

    // Advance to next player in setup
    newState = advanceSetupTurn(newState);

    return { success: true, state: newState };
  }

  return { success: false, error: "Invalid setup action", state };
}

// --- Playing phase handlers ---

function handleRollDice(state: GameState, playerId: string): ActionResult {
  if (state.turnPhase !== TurnPhase.PreRoll) {
    return { success: false, error: "Cannot roll dice now", state };
  }

  const dice = rollDice();
  let newState = structuredClone(state);
  newState.diceRoll = dice;
  const total = dice[0] + dice[1];

  const playerName = getCurrentPlayer(newState).name;
  log(newState, `${playerName} rolled ${dice[0]} + ${dice[1]} = ${total}`, playerId);

  if (total === 7) {
    // Check who must discard
    const discardPlayers = getPlayersWhoMustDiscard(newState);
    if (discardPlayers.length > 0) {
      newState.discardingPlayerIds = discardPlayers;
      newState.turnPhase = TurnPhase.Discarding;
      log(newState, `Players must discard half their cards`);
    } else {
      newState.turnPhase = TurnPhase.Robbing;
    }
  } else {
    // Produce resources
    const production = produceResources(newState, total);
    newState = production.state;
    newState.turnPhase = TurnPhase.Trading;

    // Log what each player received
    if (production.gains.size === 0) {
      log(newState, "No resources produced");
    } else {
      for (const [pid, gains] of production.gains) {
        const pName = newState.players.find((p) => p.id === pid)?.name ?? "Unknown";
        log(newState, `${pName} received ${formatResourceGains(gains)}`, pid);
      }
    }
  }

  return { success: true, state: newState };
}

function handleDiscard(
  state: GameState,
  playerId: string,
  resources: Partial<ResourceHand>
): ActionResult {
  if (state.turnPhase !== TurnPhase.Discarding) {
    return { success: false, error: "Not in discarding phase", state };
  }

  if (!state.discardingPlayerIds.includes(playerId)) {
    return { success: false, error: "You don't need to discard", state };
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { success: false, error: "Player not found", state };

  const result = discardResources(player, resources);
  if (result.error) {
    return { success: false, error: result.error, state };
  }

  const newState = structuredClone(state);
  const playerIdx = newState.players.findIndex((p) => p.id === playerId);
  newState.players[playerIdx] = result.player;
  newState.discardingPlayerIds = newState.discardingPlayerIds.filter(
    (id) => id !== playerId
  );

  log(newState, `${player.name} discarded cards`, playerId);

  // If all discards are done, move to robbing phase
  if (newState.discardingPlayerIds.length === 0) {
    newState.turnPhase = TurnPhase.Robbing;
  }

  return { success: true, state: newState };
}

function handleMoveRobber(
  state: GameState,
  playerId: string,
  hexId: number,
  stealFromPlayerId?: string
): ActionResult {
  if (state.turnPhase !== TurnPhase.Robbing) {
    return { success: false, error: "Not in robbing phase", state };
  }

  const result = executeRobber(state, playerId, hexId, stealFromPlayerId);
  if (result.error && result.error !== "Must choose a player to steal from") {
    return { success: false, error: result.error, state };
  }

  let newState = result.state;
  const playerName = getCurrentPlayer(newState).name;

  if (result.error === "Must choose a player to steal from") {
    // Client needs to pick a target — stay in robbing phase but robber is moved
    log(newState, `${playerName} moved the robber`, playerId);
    return { success: true, state: newState };
  }

  if (result.stolenResource && stealFromPlayerId) {
    const victimName = newState.players.find(p => p.id === stealFromPlayerId)?.name;
    log(newState, `${playerName} stole ${RESOURCE_EMOJI[result.stolenResource as Resource]} from ${victimName}`, playerId);
  } else {
    log(newState, `${playerName} moved the robber`, playerId);
  }

  newState = structuredClone(newState);
  newState.turnPhase = TurnPhase.Trading;

  return { success: true, state: newState };
}

function handleBuildSettlement(
  state: GameState,
  playerId: string,
  vertexId: number
): ActionResult {
  if (state.turnPhase !== TurnPhase.Trading && state.turnPhase !== TurnPhase.Building) {
    return { success: false, error: "Cannot build now", state };
  }

  const player = state.players.find((p) => p.id === playerId);
  if (player && !hasResources(player.resources, BUILDING_COSTS.settlement)) {
    return { success: false, error: "Not enough resources for a settlement", state };
  }

  const validVertices = getValidSettlementVertices(state, playerId, false);
  if (!validVertices.includes(vertexId)) {
    return { success: false, error: "Invalid settlement location", state };
  }

  let newState = placeSettlement(state, playerId, vertexId, false);
  const prevLongestRoadS = newState.longestRoadPlayerId;
  newState = updateSpecialCards(newState);

  const playerName = newState.players.find((p) => p.id === playerId)!.name;
  log(newState, `${playerName} built a settlement`, playerId);

  if (newState.longestRoadPlayerId !== prevLongestRoadS && newState.longestRoadPlayerId) {
    const holder = newState.players.find(p => p.id === newState.longestRoadPlayerId);
    log(newState, `🛤️ ${holder?.name} now has Longest Road!`);
  }

  // Check for winner
  const winner = checkWinner(newState);
  if (winner) {
    newState.winnerId = winner;
    newState.phase = GamePhase.Finished;
    log(newState, `${playerName} wins!`, playerId);
  }

  return { success: true, state: newState };
}

function handleBuildCity(
  state: GameState,
  playerId: string,
  vertexId: number
): ActionResult {
  if (state.turnPhase !== TurnPhase.Trading && state.turnPhase !== TurnPhase.Building) {
    return { success: false, error: "Cannot build now", state };
  }

  const player = state.players.find((p) => p.id === playerId);
  if (player && !hasResources(player.resources, BUILDING_COSTS.city)) {
    return { success: false, error: "Not enough resources for a city", state };
  }

  const validVertices = getValidCityVertices(state, playerId);
  if (!validVertices.includes(vertexId)) {
    return { success: false, error: "Invalid city location", state };
  }

  let newState = placeCity(state, playerId, vertexId);
  const prevLongestRoadC = newState.longestRoadPlayerId;
  newState = updateSpecialCards(newState);

  const playerName = newState.players.find((p) => p.id === playerId)!.name;
  log(newState, `${playerName} built a city`, playerId);

  if (newState.longestRoadPlayerId !== prevLongestRoadC && newState.longestRoadPlayerId) {
    const holder = newState.players.find(p => p.id === newState.longestRoadPlayerId);
    log(newState, `🛤️ ${holder?.name} now has Longest Road!`);
  }

  const winner = checkWinner(newState);
  if (winner) {
    newState.winnerId = winner;
    newState.phase = GamePhase.Finished;
    log(newState, `${playerName} wins!`, playerId);
  }

  return { success: true, state: newState };
}

function handleBuildRoad(
  state: GameState,
  playerId: string,
  edgeId: number
): ActionResult {
  if (state.turnPhase !== TurnPhase.Trading && state.turnPhase !== TurnPhase.Building) {
    return { success: false, error: "Cannot build now", state };
  }

  const player = state.players.find((p) => p.id === playerId);
  if (player && !hasResources(player.resources, BUILDING_COSTS.road)) {
    return { success: false, error: "Not enough resources for a road", state };
  }

  const validEdges = getValidRoadEdges(state, playerId, false);
  if (!validEdges.includes(edgeId)) {
    return { success: false, error: "Invalid road location", state };
  }

  let newState = placeRoad(state, playerId, edgeId, false);
  const prevLongestRoadR = newState.longestRoadPlayerId;
  newState = updateSpecialCards(newState);

  const playerName = newState.players.find((p) => p.id === playerId)!.name;
  log(newState, `${playerName} built a road`, playerId);

  if (newState.longestRoadPlayerId !== prevLongestRoadR && newState.longestRoadPlayerId) {
    const holder = newState.players.find(p => p.id === newState.longestRoadPlayerId);
    log(newState, `🛤️ ${holder?.name} now has Longest Road!`);
  }

  const winner = checkWinner(newState);
  if (winner) {
    newState.winnerId = winner;
    newState.phase = GamePhase.Finished;
    log(newState, `${playerName} wins!`, playerId);
  }

  return { success: true, state: newState };
}

function handleBuyDevCard(state: GameState, playerId: string): ActionResult {
  if (state.turnPhase !== TurnPhase.Trading && state.turnPhase !== TurnPhase.Building) {
    return { success: false, error: "Cannot buy now", state };
  }

  const result = buyDevCard(state, playerId);
  if (result.error) {
    return { success: false, error: result.error, state };
  }

  const playerName = result.state.players.find((p) => p.id === playerId)!.name;
  log(result.state, `${playerName} bought a development card`, playerId);

  // Check for winner (VP card)
  const winner = checkWinner(result.state);
  if (winner) {
    result.state.winnerId = winner;
    result.state.phase = GamePhase.Finished;
    log(result.state, `${playerName} wins!`, playerId);
  }

  return { success: true, state: result.state };
}

function handlePlayKnight(
  state: GameState,
  playerId: string,
  hexId: number,
  stealFromPlayerId?: string
): ActionResult {
  const check = canPlayDevCard(state, playerId, DevelopmentCardType.Knight);
  if (!check.canPlay) {
    return { success: false, error: check.error, state };
  }

  let newState = removeDevCard(state, playerId, DevelopmentCardType.Knight);
  const robResult = executeRobber(newState, playerId, hexId, stealFromPlayerId);

  if (robResult.error && robResult.error !== "Must choose a player to steal from") {
    return { success: false, error: robResult.error, state };
  }

  const prevLongestRoad = robResult.state.longestRoadPlayerId;
  const prevLargestArmy = robResult.state.largestArmyPlayerId;
  newState = updateSpecialCards(robResult.state);

  const playerName = newState.players.find((p) => p.id === playerId)!.name;

  if (robResult.stolenResource && stealFromPlayerId) {
    const victimName = newState.players.find(p => p.id === stealFromPlayerId)?.name;
    log(newState, `${playerName} played a Knight and stole ${RESOURCE_EMOJI[robResult.stolenResource as Resource]} from ${victimName}`, playerId);
  } else {
    log(newState, `${playerName} played a Knight`, playerId);
  }

  if (newState.longestRoadPlayerId !== prevLongestRoad && newState.longestRoadPlayerId) {
    const holder = newState.players.find(p => p.id === newState.longestRoadPlayerId);
    log(newState, `🛤️ ${holder?.name} now has Longest Road!`);
  }
  if (newState.largestArmyPlayerId !== prevLargestArmy && newState.largestArmyPlayerId) {
    const holder = newState.players.find(p => p.id === newState.largestArmyPlayerId);
    log(newState, `🗡️ ${holder?.name} now has Largest Army!`);
  }

  const winner = checkWinner(newState);
  if (winner) {
    newState.winnerId = winner;
    newState.phase = GamePhase.Finished;
    log(newState, `${playerName} wins!`, playerId);
  }

  return { success: true, state: newState };
}

function handlePlayRoadBuilding(
  state: GameState,
  playerId: string,
  edgeId1: number,
  edgeId2?: number
): ActionResult {
  const check = canPlayDevCard(state, playerId, DevelopmentCardType.RoadBuilding);
  if (!check.canPlay) {
    return { success: false, error: check.error, state };
  }

  let newState = removeDevCard(state, playerId, DevelopmentCardType.RoadBuilding);

  // Place first road
  const validEdges1 = getValidRoadEdges(newState, playerId, false, undefined, true);
  if (!validEdges1.includes(edgeId1)) {
    return { success: false, error: "Invalid location for first road", state };
  }
  newState = placeRoad(newState, playerId, edgeId1, false, true);

  // Place second road (if provided and player has roads remaining)
  if (edgeId2 !== undefined) {
    const player = newState.players.find((p) => p.id === playerId)!;
    if (player.roadsRemaining > 0) {
      const validEdges2 = getValidRoadEdges(newState, playerId, false, undefined, true);
      if (!validEdges2.includes(edgeId2)) {
        return { success: false, error: "Invalid location for second road", state };
      }
      newState = placeRoad(newState, playerId, edgeId2, false, true);
    }
  }

  const prevLongestRoadRB = newState.longestRoadPlayerId;
  newState = updateSpecialCards(newState);

  const playerName = newState.players.find((p) => p.id === playerId)!.name;
  log(newState, `${playerName} played Road Building`, playerId);

  if (newState.longestRoadPlayerId !== prevLongestRoadRB && newState.longestRoadPlayerId) {
    const holder = newState.players.find(p => p.id === newState.longestRoadPlayerId);
    log(newState, `🛤️ ${holder?.name} now has Longest Road!`);
  }

  return { success: true, state: newState };
}

function handlePlayYearOfPlenty(
  state: GameState,
  playerId: string,
  resource1: Resource,
  resource2: Resource
): ActionResult {
  const check = canPlayDevCard(state, playerId, DevelopmentCardType.YearOfPlenty);
  if (!check.canPlay) {
    return { success: false, error: check.error, state };
  }

  let newState = removeDevCard(state, playerId, DevelopmentCardType.YearOfPlenty);
  newState = applyYearOfPlenty(newState, playerId, resource1, resource2);

  const playerName = newState.players.find((p) => p.id === playerId)!.name;
  log(newState, `${playerName} played Year of Plenty`, playerId);

  return { success: true, state: newState };
}

function handlePlayMonopoly(
  state: GameState,
  playerId: string,
  resource: Resource
): ActionResult {
  const check = canPlayDevCard(state, playerId, DevelopmentCardType.Monopoly);
  if (!check.canPlay) {
    return { success: false, error: check.error, state };
  }

  let newState = removeDevCard(state, playerId, DevelopmentCardType.Monopoly);
  const result = applyMonopoly(newState, playerId, resource);
  newState = result.state;

  const playerName = newState.players.find((p) => p.id === playerId)!.name;
  log(
    newState,
    `${playerName} played Monopoly on ${resource} (took ${result.totalStolen})`,
    playerId
  );

  return { success: true, state: newState };
}

function handleProposeTrade(
  state: GameState,
  playerId: string,
  offering: Partial<ResourceHand>,
  requesting: Partial<ResourceHand>,
  targetPlayerId?: string
): ActionResult {
  if (state.turnPhase !== TurnPhase.Trading && state.turnPhase !== TurnPhase.Building) {
    return { success: false, error: "Cannot trade now", state };
  }

  if (state.activeTradeOffer) {
    return { success: false, error: "A trade is already in progress", state };
  }

  const result = proposeTrade(state, playerId, offering, requesting, targetPlayerId);
  if (result.error) {
    return { success: false, error: result.error, state };
  }

  const playerName = result.state.players.find((p) => p.id === playerId)!.name;
  if (targetPlayerId) {
    const targetName = result.state.players.find((p) => p.id === targetPlayerId)!.name;
    log(result.state, `${playerName} proposed a trade to ${targetName}`, playerId);
  } else {
    log(result.state, `${playerName} proposed a trade to all players`, playerId);
  }

  return { success: true, state: result.state };
}

function handleTradeResponse(
  state: GameState,
  playerId: string,
  action: { type: "ACCEPT_TRADE" | "REJECT_TRADE"; tradeId: string }
): ActionResult {
  if (!state.activeTradeOffer) {
    return { success: false, error: "No active trade", state };
  }

  if (action.type === "ACCEPT_TRADE") {
    const result = acceptTrade(state, playerId, action.tradeId);
    if (result.error) {
      return { success: false, error: result.error, state };
    }
    const playerName = result.state.players.find((p) => p.id === playerId)!.name;
    const trade = state.activeTradeOffer!;
    if (trade.targetPlayerId) {
      // Targeted trade executed
      const proposerName = result.state.players.find((p) => p.id === trade.fromPlayerId)!.name;
      log(result.state, `${proposerName} traded ${formatResources(trade.offering)} for ${formatResources(trade.requesting)} with ${playerName}`, playerId);
    } else {
      // Open trade — just recording acceptance
      log(result.state, `${playerName} wants to trade`, playerId);
    }
    return { success: true, state: result.state };
  }

  const result = rejectTrade(state, playerId, action.tradeId);
  if (result.error) {
    return { success: false, error: result.error, state };
  }
  const playerName = result.state.players.find((p) => p.id === playerId)!.name;
  log(result.state, `${playerName} rejected the trade`, playerId);
  return { success: true, state: result.state };
}

function handleCancelTrade(state: GameState, playerId: string): ActionResult {
  if (!state.activeTradeOffer) {
    return { success: false, error: "No active trade", state };
  }
  if (state.activeTradeOffer.fromPlayerId !== playerId) {
    return { success: false, error: "Only the proposer can cancel", state };
  }

  const newState = cancelTrade(state);
  log(newState, `Trade cancelled`, playerId);
  return { success: true, state: newState };
}

function handleConfirmTrade(
  state: GameState,
  playerId: string,
  acceptingPlayerId: string
): ActionResult {
  if (!state.activeTradeOffer) {
    return { success: false, error: "No active trade", state };
  }

  const result = confirmTrade(state, playerId, acceptingPlayerId);
  if (result.error) {
    return { success: false, error: result.error, state };
  }

  const proposerName = result.state.players.find((p) => p.id === playerId)!.name;
  const accepterName = result.state.players.find((p) => p.id === acceptingPlayerId)!.name;
  const trade = state.activeTradeOffer!;
  log(result.state, `${proposerName} traded ${formatResources(trade.offering)} for ${formatResources(trade.requesting)} with ${accepterName}`, playerId);
  return { success: true, state: result.state };
}

function handleMaritimeTrade(
  state: GameState,
  playerId: string,
  give: Resource,
  receive: Resource
): ActionResult {
  if (state.turnPhase !== TurnPhase.Trading && state.turnPhase !== TurnPhase.Building) {
    return { success: false, error: "Cannot trade now", state };
  }

  const result = maritimeTrade(state, playerId, give, receive);
  if (result.error) {
    return { success: false, error: result.error, state };
  }

  const playerName = result.state.players.find((p) => p.id === playerId)!.name;
  const rate = getMaritimeTradeRate(state, playerId, give);
  log(result.state, `${playerName} traded ${rate}${RESOURCE_EMOJI[give]} for 1${RESOURCE_EMOJI[receive]} with the bank`, playerId);
  return { success: true, state: result.state };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handleEndTurn(state: GameState, _playerId: string): ActionResult {
  if (state.turnPhase === TurnPhase.PreRoll) {
    return { success: false, error: "Must roll dice before ending turn", state };
  }
  if (state.turnPhase === TurnPhase.Discarding) {
    return { success: false, error: "Players must finish discarding", state };
  }
  if (state.turnPhase === TurnPhase.Robbing) {
    return { success: false, error: "Must move the robber first", state };
  }
  if (state.activeTradeOffer) {
    return { success: false, error: "Cancel or complete the active trade first", state };
  }

  const newState = structuredClone(state);
  const currentPlayer = getCurrentPlayer(newState);

  // Move new dev cards to playable hand
  currentPlayer.developmentCards.push(...currentPlayer.newDevCards);
  currentPlayer.newDevCards = [];
  currentPlayer.hasPlayedDevCardThisTurn = false;

  // Advance to next player
  newState.currentPlayerIndex =
    (newState.currentPlayerIndex + 1) % newState.players.length;
  newState.turnNumber += 1;
  newState.turnPhase = TurnPhase.PreRoll;
  newState.diceRoll = null;

  const nextPlayer = getCurrentPlayer(newState);
  log(newState, `${nextPlayer.name}'s turn`, nextPlayer.id);

  return { success: true, state: newState };
}
