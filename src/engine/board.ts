// ============================================================
// Board Generation — Hex grid, vertices, edges, harbors
// ============================================================

import {
  type BoardState,
  type Hex,
  type Vertex,
  type Edge,
  type HexCoord,
  TerrainType,
  HarborType,
  STANDARD_TERRAIN_DISTRIBUTION,
  EXTENDED_TERRAIN_DISTRIBUTION,
  STANDARD_NUMBER_TOKENS,
  EXTENDED_NUMBER_TOKENS,
  STANDARD_HARBORS,
} from "./types";

// --- Hex grid layout (axial coordinates) ---

// Standard board ring layout: center + 2 rings = 19 hexes
const STANDARD_HEX_COORDS: HexCoord[] = [
  // Center
  { q: 0, r: 0 },
  // Ring 1 (6 hexes)
  { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
  { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 },
  // Ring 2 (12 hexes)
  { q: 2, r: 0 }, { q: 1, r: 1 }, { q: 0, r: 2 },
  { q: -1, r: 2 }, { q: -2, r: 2 }, { q: -2, r: 1 },
  { q: -2, r: 0 }, { q: -1, r: -1 }, { q: 0, r: -2 },
  { q: 1, r: -2 }, { q: 2, r: -2 }, { q: 2, r: -1 },
];

// Extended board adds a 3rd partial ring for 5-6 players (30 hexes)
const EXTENDED_EXTRA_COORDS: HexCoord[] = [
  { q: 3, r: -2 }, { q: 3, r: -1 }, { q: 3, r: 0 },
  { q: 2, r: 1 }, { q: 1, r: 2 }, { q: 0, r: 3 },
  { q: -1, r: 3 }, { q: -2, r: 3 }, { q: -3, r: 2 },
  { q: -3, r: 1 }, { q: -3, r: 0 }, { q: -2, r: -1 },
];

// --- Fisher-Yates shuffle ---

function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Vertex computation ---
// Each hex has 6 corners. Vertices are shared between adjacent hexes.
// We use a canonical key for each vertex based on sorted hex coords.

// Hex corner positions (flat-top hex, axial coords):
// Corner i is shared by up to 3 hexes.
// For a hex at (q, r), the 6 corners touch specific neighboring hexes.

function hexToPixel(coord: HexCoord): { x: number; y: number } {
  const size = 1;
  const x = size * (3 / 2 * coord.q);
  const y = size * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r);
  return { x, y };
}

function getHexCorners(center: { x: number; y: number }): { x: number; y: number }[] {
  const size = 1;
  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    corners.push({
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    });
  }
  return corners;
}

// Round to avoid floating point issues when comparing vertex positions
function roundPoint(p: { x: number; y: number }): string {
  return `${Math.round(p.x * 1000) / 1000},${Math.round(p.y * 1000) / 1000}`;
}

// Neighbor offsets for axial hex coords
const HEX_NEIGHBORS: HexCoord[] = [
  { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
  { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 },
];

function computeVerticesAndEdges(hexes: Hex[]): {
  vertices: Vertex[];
  edges: Edge[];
} {
  const hexById = new Map<number, Hex>();
  const hexByCoord = new Map<string, Hex>();
  for (const hex of hexes) {
    hexById.set(hex.id, hex);
    hexByCoord.set(`${hex.coord.q},${hex.coord.r}`, hex);
  }

  // Map from rounded pixel position → vertex ID
  const posToVertexId = new Map<string, number>();
  const vertexHexIds = new Map<number, Set<number>>(); // vertexId → set of hex IDs
  const vertexPositions = new Map<number, { x: number; y: number }>();
  let nextVertexId = 0;

  // For each hex, compute its 6 corners and assign/merge vertex IDs
  const hexCornerVertexIds = new Map<number, number[]>(); // hexId → [6 vertex IDs]

  for (const hex of hexes) {
    const center = hexToPixel(hex.coord);
    const corners = getHexCorners(center);
    const vertexIds: number[] = [];

    for (const corner of corners) {
      const key = roundPoint(corner);
      let vid = posToVertexId.get(key);
      if (vid === undefined) {
        vid = nextVertexId++;
        posToVertexId.set(key, vid);
        vertexHexIds.set(vid, new Set());
        vertexPositions.set(vid, corner);
      }
      vertexHexIds.get(vid)!.add(hex.id);
      vertexIds.push(vid);
    }

    hexCornerVertexIds.set(hex.id, vertexIds);
  }

  // Build adjacency between vertices
  const adjacentVertices = new Map<number, Set<number>>();
  for (const [, cornerIds] of hexCornerVertexIds) {
    for (let i = 0; i < 6; i++) {
      const a = cornerIds[i];
      const b = cornerIds[(i + 1) % 6];
      if (!adjacentVertices.has(a)) adjacentVertices.set(a, new Set());
      if (!adjacentVertices.has(b)) adjacentVertices.set(b, new Set());
      adjacentVertices.get(a)!.add(b);
      adjacentVertices.get(b)!.add(a);
    }
  }

  // Build edges (unique pairs of adjacent vertices)
  const edgeKeyToId = new Map<string, number>();
  const edgeVertexPairs: [number, number][] = [];
  let nextEdgeId = 0;

  for (const [vid, neighbors] of adjacentVertices) {
    for (const neighbor of neighbors) {
      const key = vid < neighbor ? `${vid}-${neighbor}` : `${neighbor}-${vid}`;
      if (!edgeKeyToId.has(key)) {
        edgeKeyToId.set(key, nextEdgeId);
        edgeVertexPairs.push(vid < neighbor ? [vid, neighbor] : [neighbor, vid]);
        nextEdgeId++;
      }
    }
  }

  // Compute edge-to-hex mapping
  const edgeHexIds = new Map<number, Set<number>>();
  for (let eid = 0; eid < edgeVertexPairs.length; eid++) {
    const [v1, v2] = edgeVertexPairs[eid];
    const h1 = vertexHexIds.get(v1)!;
    const h2 = vertexHexIds.get(v2)!;
    const shared = new Set<number>();
    for (const h of h1) {
      if (h2.has(h)) shared.add(h);
    }
    edgeHexIds.set(eid, shared);
  }

  // Build vertex-to-edge mapping
  const vertexEdgeIds = new Map<number, number[]>();
  for (let eid = 0; eid < edgeVertexPairs.length; eid++) {
    const [v1, v2] = edgeVertexPairs[eid];
    if (!vertexEdgeIds.has(v1)) vertexEdgeIds.set(v1, []);
    if (!vertexEdgeIds.has(v2)) vertexEdgeIds.set(v2, []);
    vertexEdgeIds.get(v1)!.push(eid);
    vertexEdgeIds.get(v2)!.push(eid);
  }

  // Assemble Vertex objects
  const vertices: Vertex[] = [];
  for (let vid = 0; vid < nextVertexId; vid++) {
    vertices.push({
      id: vid,
      hexIds: Array.from(vertexHexIds.get(vid) ?? []),
      edgeIds: vertexEdgeIds.get(vid) ?? [],
      adjacentVertexIds: Array.from(adjacentVertices.get(vid) ?? []),
      position: vertexPositions.get(vid) ?? { x: 0, y: 0 },
      building: null,
      harbor: null,
    });
  }

  // Assemble Edge objects
  const edges: Edge[] = [];
  for (let eid = 0; eid < nextEdgeId; eid++) {
    edges.push({
      id: eid,
      vertexIds: edgeVertexPairs[eid],
      hexIds: Array.from(edgeHexIds.get(eid) ?? []),
      road: null,
    });
  }

  return { vertices, edges };
}

// --- Harbor assignment ---
// Harbors are placed on coastal edges (edges with exactly 1 adjacent hex).
// We sort all coastal edges by angle around the board center, then select
// 9 evenly-spaced slots to ensure ports are distributed around the island.

function assignHarbors(
  vertices: Vertex[],
  edges: Edge[],
  harbors: HarborType[]
): void {
  // Find all coastal edges (shared by exactly 1 hex)
  const coastalEdges: { edgeIdx: number; v1: number; v2: number; angle: number }[] = [];

  for (const edge of edges) {
    if (edge.hexIds.length !== 1) continue;
    const v1 = vertices[edge.vertexIds[0]];
    const v2 = vertices[edge.vertexIds[1]];
    // Midpoint of the edge in unit space
    const mx = (v1.position.x + v2.position.x) / 2;
    const my = (v1.position.y + v2.position.y) / 2;
    // Angle from board center (0,0)
    const angle = Math.atan2(my, mx);
    coastalEdges.push({ edgeIdx: edge.id, v1: v1.id, v2: v2.id, angle });
  }

  // Sort by angle so we walk around the perimeter in order
  coastalEdges.sort((a, b) => a.angle - b.angle);

  const totalCoastal = coastalEdges.length;
  const numHarbors = Math.min(harbors.length, totalCoastal);

  // Select evenly-spaced slots around the perimeter
  const selectedSlots: { v1: number; v2: number }[] = [];
  const spacing = totalCoastal / numHarbors;

  for (let i = 0; i < numHarbors; i++) {
    const idx = Math.floor(i * spacing) % totalCoastal;
    selectedSlots.push(coastalEdges[idx]);
  }

  // Shuffle harbor types and assign to the selected slots
  const shuffledHarbors = shuffle(harbors);
  for (let i = 0; i < numHarbors; i++) {
    const { v1, v2 } = selectedSlots[i];
    vertices[v1].harbor = shuffledHarbors[i];
    vertices[v2].harbor = shuffledHarbors[i];
  }
}

// --- Main board generation ---

export function generateBoard(playerCount: number): BoardState {
  const isExtended = playerCount > 4;
  const hexCoords = isExtended
    ? [...STANDARD_HEX_COORDS, ...EXTENDED_EXTRA_COORDS]
    : [...STANDARD_HEX_COORDS];
  const terrainDist = isExtended
    ? [...EXTENDED_TERRAIN_DISTRIBUTION]
    : [...STANDARD_TERRAIN_DISTRIBUTION];
  const numberTokens = isExtended
    ? [...EXTENDED_NUMBER_TOKENS]
    : [...STANDARD_NUMBER_TOKENS];

  // Shuffle terrains
  const shuffledTerrains = shuffle(terrainDist);

  // Build adjacency map from hex coords for constraint checking
  const coordToIdx = new Map<string, number>();
  for (let i = 0; i < hexCoords.length; i++) {
    coordToIdx.set(`${hexCoords[i].q},${hexCoords[i].r}`, i);
  }

  function hasAdjacentHighNumbers(tokens: (number | null)[]): boolean {
    for (let i = 0; i < hexCoords.length; i++) {
      const t = tokens[i];
      if (t !== 6 && t !== 8) continue;
      const coord = hexCoords[i];
      for (const offset of HEX_NEIGHBORS) {
        const neighborIdx = coordToIdx.get(`${coord.q + offset.q},${coord.r + offset.r}`);
        if (neighborIdx !== undefined) {
          const nt = tokens[neighborIdx];
          if (nt === 6 || nt === 8) return true;
        }
      }
    }
    return false;
  }

  let assignedTokens: (number | null)[] = new Array(hexCoords.length).fill(null);
  let attempts = 0;
  const MAX_ATTEMPTS = 100;

  do {
    const shuffledTokens = shuffle(numberTokens);
    let tokenIdx = 0;
    assignedTokens = hexCoords.map((_, i) => {
      if (shuffledTerrains[i] === TerrainType.Desert) return null;
      return shuffledTokens[tokenIdx++] ?? null;
    });
    attempts++;
  } while (hasAdjacentHighNumbers(assignedTokens) && attempts < MAX_ATTEMPTS);

  const hexes: Hex[] = hexCoords.map((coord, i) => ({
    id: i,
    coord,
    terrain: shuffledTerrains[i],
    numberToken: assignedTokens[i],
    hasRobber: shuffledTerrains[i] === TerrainType.Desert,
  }));

  // Find the first desert hex for the robber
  const desertHex = hexes.find((h) => h.terrain === TerrainType.Desert);
  const robberHexId = desertHex?.id ?? 0;

  // Compute vertices and edges from hex layout
  const { vertices, edges } = computeVerticesAndEdges(hexes);

  // Assign harbors
  assignHarbors(vertices, edges, STANDARD_HARBORS);

  return {
    hexes,
    vertices,
    edges,
    robberHexId,
  };
}

// --- Pixel position helpers for rendering ---

export function getHexPixelPosition(coord: HexCoord): { x: number; y: number } {
  return hexToPixel(coord);
}
