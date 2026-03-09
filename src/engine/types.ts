// ============================================================
// Core Types & Constants for Catan Engine
// ============================================================

// --- Enums ---

export enum Resource {
  Brick = "brick",
  Lumber = "lumber",
  Wool = "wool",
  Grain = "grain",
  Ore = "ore",
}

export enum TerrainType {
  Hills = "hills",       // Brick
  Forest = "forest",     // Lumber
  Pasture = "pasture",   // Wool
  Fields = "fields",     // Grain
  Mountains = "mountains", // Ore
  Desert = "desert",     // Nothing
}

export enum BuildingType {
  Settlement = "settlement",
  City = "city",
}

export enum DevelopmentCardType {
  Knight = "knight",
  RoadBuilding = "roadBuilding",
  YearOfPlenty = "yearOfPlenty",
  Monopoly = "monopoly",
  VictoryPoint = "victoryPoint",
}

export enum GamePhase {
  Lobby = "lobby",
  SetupForward = "setupForward",   // 1st round: player 1→N
  SetupReverse = "setupReverse",   // 2nd round: player N→1
  Playing = "playing",
  Finished = "finished",
}

export enum TurnPhase {
  PreRoll = "preRoll",
  Rolling = "rolling",
  Robbing = "robbing",         // After rolling 7 or playing knight
  Discarding = "discarding",   // Players with >7 must discard
  Trading = "trading",
  Building = "building",
  Idle = "idle",               // Not this player's turn
}

export enum HarborType {
  Generic = "generic",           // 3:1
  BrickHarbor = "brickHarbor",   // 2:1 brick
  LumberHarbor = "lumberHarbor", // 2:1 lumber
  WoolHarbor = "woolHarbor",     // 2:1 wool
  GrainHarbor = "grainHarbor",   // 2:1 grain
  OreHarbor = "oreHarbor",       // 2:1 ore
}

// --- Constants ---

export const TERRAIN_TO_RESOURCE: Record<TerrainType, Resource | null> = {
  [TerrainType.Hills]: Resource.Brick,
  [TerrainType.Forest]: Resource.Lumber,
  [TerrainType.Pasture]: Resource.Wool,
  [TerrainType.Fields]: Resource.Grain,
  [TerrainType.Mountains]: Resource.Ore,
  [TerrainType.Desert]: null,
};

export const HARBOR_TO_RESOURCE: Record<HarborType, Resource | null> = {
  [HarborType.Generic]: null,
  [HarborType.BrickHarbor]: Resource.Brick,
  [HarborType.LumberHarbor]: Resource.Lumber,
  [HarborType.WoolHarbor]: Resource.Wool,
  [HarborType.GrainHarbor]: Resource.Grain,
  [HarborType.OreHarbor]: Resource.Ore,
};

export const BUILDING_COSTS: Record<string, Partial<Record<Resource, number>>> = {
  road: {
    [Resource.Brick]: 1,
    [Resource.Lumber]: 1,
  },
  settlement: {
    [Resource.Brick]: 1,
    [Resource.Lumber]: 1,
    [Resource.Wool]: 1,
    [Resource.Grain]: 1,
  },
  city: {
    [Resource.Ore]: 3,
    [Resource.Grain]: 2,
  },
  developmentCard: {
    [Resource.Ore]: 1,
    [Resource.Grain]: 1,
    [Resource.Wool]: 1,
  },
};

export const PIECE_LIMITS = {
  settlements: 5,
  cities: 4,
  roads: 15,
} as const;

export const VICTORY_POINTS_TO_WIN = 10;
export const ROBBER_HAND_LIMIT = 7;
export const MIN_LONGEST_ROAD = 5;
export const MIN_LARGEST_ARMY = 3;
export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;

// Standard board: 19 hexes
export const STANDARD_TERRAIN_DISTRIBUTION: TerrainType[] = [
  TerrainType.Hills, TerrainType.Hills, TerrainType.Hills,
  TerrainType.Forest, TerrainType.Forest, TerrainType.Forest, TerrainType.Forest,
  TerrainType.Pasture, TerrainType.Pasture, TerrainType.Pasture, TerrainType.Pasture,
  TerrainType.Fields, TerrainType.Fields, TerrainType.Fields, TerrainType.Fields,
  TerrainType.Mountains, TerrainType.Mountains, TerrainType.Mountains,
  TerrainType.Desert,
];

// Extended board (5-6 players): 31 hexes (19 standard + 12 outer ring)
export const EXTENDED_TERRAIN_DISTRIBUTION: TerrainType[] = [
  TerrainType.Hills, TerrainType.Hills, TerrainType.Hills, TerrainType.Hills, TerrainType.Hills,
  TerrainType.Forest, TerrainType.Forest, TerrainType.Forest, TerrainType.Forest, TerrainType.Forest, TerrainType.Forest,
  TerrainType.Pasture, TerrainType.Pasture, TerrainType.Pasture, TerrainType.Pasture, TerrainType.Pasture, TerrainType.Pasture,
  TerrainType.Fields, TerrainType.Fields, TerrainType.Fields, TerrainType.Fields, TerrainType.Fields, TerrainType.Fields,
  TerrainType.Mountains, TerrainType.Mountains, TerrainType.Mountains, TerrainType.Mountains, TerrainType.Mountains,
  TerrainType.Desert, TerrainType.Desert,
  TerrainType.Hills, // 31st hex
];

// Number tokens for standard board (placed on non-desert hexes)
export const STANDARD_NUMBER_TOKENS: number[] = [
  2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12,
];

export const EXTENDED_NUMBER_TOKENS: number[] = [
  2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 4,
];

// Standard harbors
export const STANDARD_HARBORS: HarborType[] = [
  HarborType.Generic, HarborType.Generic, HarborType.Generic, HarborType.Generic,
  HarborType.BrickHarbor, HarborType.LumberHarbor, HarborType.WoolHarbor,
  HarborType.GrainHarbor, HarborType.OreHarbor,
];

// Development card deck
export const DEVELOPMENT_CARD_COUNTS: Record<DevelopmentCardType, number> = {
  [DevelopmentCardType.Knight]: 14,
  [DevelopmentCardType.RoadBuilding]: 2,
  [DevelopmentCardType.YearOfPlenty]: 2,
  [DevelopmentCardType.Monopoly]: 2,
  [DevelopmentCardType.VictoryPoint]: 5,
};

// Player colors
export const PLAYER_COLORS = [
  "#e74c3c", // red
  "#3498db", // blue
  "#f39c12", // orange
  "#2ecc71", // green
  "#9b59b6", // purple
  "#1abc9c", // teal
] as const;

// --- Interfaces ---

export interface HexCoord {
  q: number; // column (axial)
  r: number; // row (axial)
}

export interface Hex {
  id: number;
  coord: HexCoord;
  terrain: TerrainType;
  numberToken: number | null; // null for desert
  hasRobber: boolean;
}

export interface Vertex {
  id: number;
  hexIds: number[];        // adjacent hex IDs (1-3)
  edgeIds: number[];       // adjacent edge IDs (2-3)
  adjacentVertexIds: number[];
  position: { x: number; y: number }; // unit-space position (multiply by hex size to get pixels)
  building: { type: BuildingType; playerId: string } | null;
  harbor: HarborType | null;
}

export interface Edge {
  id: number;
  vertexIds: [number, number]; // the two vertices this edge connects
  hexIds: number[];            // adjacent hex IDs (1-2)
  road: { playerId: string } | null;
}

export interface BoardState {
  hexes: Hex[];
  vertices: Vertex[];
  edges: Edge[];
  robberHexId: number;     // hex ID where robber sits
}

export interface ResourceHand {
  [Resource.Brick]: number;
  [Resource.Lumber]: number;
  [Resource.Wool]: number;
  [Resource.Grain]: number;
  [Resource.Ore]: number;
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  resources: ResourceHand;
  developmentCards: DevelopmentCardType[];
  playedKnights: number;
  longestRoadLength: number;
  victoryPoints: number;        // public VP (settlements, cities, special cards)
  hiddenVictoryPoints: number;  // VP dev cards (hidden until win)
  hasPlayedDevCardThisTurn: boolean;
  newDevCards: DevelopmentCardType[]; // purchased this turn, can't play yet
  connected: boolean;
  settlementsRemaining: number;
  citiesRemaining: number;
  roadsRemaining: number;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  targetPlayerId?: string; // if set, only this player can accept (targeted trade)
  offering: Partial<ResourceHand>;
  requesting: Partial<ResourceHand>;
  responses: Record<string, "pending" | "accepted" | "rejected">;
}

export interface GameState {
  id: string;
  board: BoardState;
  players: PlayerState[];
  currentPlayerIndex: number;
  phase: GamePhase;
  turnPhase: TurnPhase;
  turnNumber: number;
  setupRound: number;              // 1 or 2 during setup
  setupLastPlacedVertex: number | null; // vertex ID of settlement just placed this setup turn
  diceRoll: [number, number] | null;
  developmentCardDeck: DevelopmentCardType[];
  discardingPlayerIds: string[];   // players who must discard
  activeTradeOffer: TradeOffer | null;
  longestRoadPlayerId: string | null;
  largestArmyPlayerId: string | null;
  winnerId: string | null;
  log: GameLogEntry[];
}

export interface GameLogEntry {
  timestamp: number;
  message: string;
  playerId?: string;
}

// --- Actions ---

export type GameAction =
  | { type: "ROLL_DICE" }
  | { type: "BUILD_SETTLEMENT"; vertexId: number }
  | { type: "BUILD_CITY"; vertexId: number }
  | { type: "BUILD_ROAD"; edgeId: number }
  | { type: "BUY_DEVELOPMENT_CARD" }
  | { type: "PLAY_KNIGHT"; hexId: number; stealFromPlayerId?: string }
  | { type: "PLAY_ROAD_BUILDING"; edgeId1: number; edgeId2?: number }
  | { type: "PLAY_YEAR_OF_PLENTY"; resource1: Resource; resource2: Resource }
  | { type: "PLAY_MONOPOLY"; resource: Resource }
  | { type: "MOVE_ROBBER"; hexId: number; stealFromPlayerId?: string }
  | { type: "DISCARD_RESOURCES"; resources: Partial<ResourceHand> }
  | { type: "PROPOSE_TRADE"; offering: Partial<ResourceHand>; requesting: Partial<ResourceHand>; targetPlayerId?: string }
  | { type: "ACCEPT_TRADE"; tradeId: string }
  | { type: "REJECT_TRADE"; tradeId: string }
  | { type: "CANCEL_TRADE" }
  | { type: "CONFIRM_TRADE"; acceptingPlayerId: string }
  | { type: "MARITIME_TRADE"; give: Resource; receive: Resource }
  | { type: "END_TURN" }
  | { type: "SETUP_PLACE_SETTLEMENT"; vertexId: number }
  | { type: "SETUP_PLACE_ROAD"; edgeId: number };

// Action envelope sent over the wire
export interface PlayerAction {
  playerId: string;
  action: GameAction;
}

// Result from the engine
export interface ActionResult {
  success: boolean;
  error?: string;
  state: GameState;
}

// --- Utility types ---

export function emptyResourceHand(): ResourceHand {
  return {
    [Resource.Brick]: 0,
    [Resource.Lumber]: 0,
    [Resource.Wool]: 0,
    [Resource.Grain]: 0,
    [Resource.Ore]: 0,
  };
}

export function totalResources(hand: ResourceHand): number {
  return Object.values(hand).reduce((sum, n) => sum + n, 0);
}

export function hasResources(
  hand: ResourceHand,
  cost: Partial<Record<Resource, number>>
): boolean {
  for (const [resource, amount] of Object.entries(cost)) {
    if ((hand[resource as Resource] ?? 0) < (amount ?? 0)) return false;
  }
  return true;
}

export function deductResources(
  hand: ResourceHand,
  cost: Partial<Record<Resource, number>>
): ResourceHand {
  const result = { ...hand };
  for (const [resource, amount] of Object.entries(cost)) {
    result[resource as Resource] -= amount ?? 0;
  }
  return result;
}

export function addResources(
  hand: ResourceHand,
  resources: Partial<Record<Resource, number>>
): ResourceHand {
  const result = { ...hand };
  for (const [resource, amount] of Object.entries(resources)) {
    result[resource as Resource] += amount ?? 0;
  }
  return result;
}
