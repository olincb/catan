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

interface VertexKey {
  hexIds: number[]; // sorted hex IDs that share this vertex
}

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
// Harbors are placed on specific vertices at the board perimeter.
// We identify perimeter vertices (those touching fewer than 3 hexes)
// and assign harbor types to pairs of adjacent perimeter vertices.

function assignHarbors(
  vertices: Vertex[],
  edges: Edge[],
  harbors: HarborType[]
): void {
  // Find perimeter vertices (touching 1 or 2 hexes)
  const perimeterVertexIds = vertices
    .filter((v) => v.hexIds.length < 3)
    .map((v) => v.id);

  const perimeterSet = new Set(perimeterVertexIds);

  // Find pairs of adjacent perimeter vertices (these form harbor "slots")
  const harborSlots: [number, number][] = [];
  const usedVertices = new Set<number>();

  for (const edge of edges) {
    const [v1, v2] = edge.vertexIds;
    if (perimeterSet.has(v1) && perimeterSet.has(v2) && !usedVertices.has(v1) && !usedVertices.has(v2)) {
      // Only pick edges that are on the perimeter (shared by exactly 1 hex)
      if (edge.hexIds.length === 1) {
        harborSlots.push([v1, v2]);
        usedVertices.add(v1);
        usedVertices.add(v2);
      }
    }
  }

  // Shuffle and assign harbors to slots
  const shuffledHarbors = shuffle(harbors);
  const numHarbors = Math.min(shuffledHarbors.length, harborSlots.length);

  for (let i = 0; i < numHarbors; i++) {
    const [v1, v2] = harborSlots[i];
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

  // Assign number tokens to non-desert hexes
  const shuffledTokens = shuffle(numberTokens);
  let tokenIndex = 0;

  const hexes: Hex[] = hexCoords.map((coord, i) => {
    const terrain = shuffledTerrains[i];
    const isDesert = terrain === TerrainType.Desert;
    return {
      id: i,
      coord,
      terrain,
      numberToken: isDesert ? null : shuffledTokens[tokenIndex++] ?? null,
      hasRobber: isDesert, // robber starts on desert
    };
  });

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

export function getVertexPixelPosition(
  vertex: Vertex,
  hexes: Hex[]
): { x: number; y: number } {
  // Average of the hex centers this vertex touches, then offset to corner
  // Instead, we recompute from the hex geometry
  if (vertex.hexIds.length === 0) return { x: 0, y: 0 };

  // Find the actual corner position by checking all hex corners
  for (const hexId of vertex.hexIds) {
    const hex = hexes[hexId];
    const center = hexToPixel(hex.coord);
    const corners = getHexCorners(center);

    // The vertex is at one of these corners — we need to figure out which one
    // We'll use all hexes this vertex touches to triangulate
  }

  // Simpler approach: compute all corners for the first hex, find which corner
  // matches (is shared with all other hexes)
  const firstHex = hexes[vertex.hexIds[0]];
  const center = hexToPixel(firstHex.coord);
  const corners = getHexCorners(center);

  if (vertex.hexIds.length === 1) {
    // Could be any corner — pick the one not shared with another hex's vertices
    // For rendering, we'll compute this differently via a lookup
    return corners[0]; // fallback
  }

  // Find the corner that's closest to all other hex centers
  const otherCenters = vertex.hexIds.slice(1).map((hid) => hexToPixel(hexes[hid].coord));

  let bestCorner = corners[0];
  let bestScore = Infinity;

  for (const corner of corners) {
    let score = 0;
    for (const oc of otherCenters) {
      const dx = corner.x - oc.x;
      const dy = corner.y - oc.y;
      // Distance should be ~1 (hex size) for adjacent hex corners
      score += Math.abs(Math.sqrt(dx * dx + dy * dy) - 1);
    }
    if (score < bestScore) {
      bestScore = score;
      bestCorner = corner;
    }
  }

  return bestCorner;
}

export function getEdgePixelPositions(
  edge: Edge,
  vertices: Vertex[],
  hexes: Hex[]
): { x1: number; y1: number; x2: number; y2: number } {
  const v1 = vertices[edge.vertexIds[0]];
  const v2 = vertices[edge.vertexIds[1]];
  const p1 = getVertexPixelPosition(v1, hexes);
  const p2 = getVertexPixelPosition(v2, hexes);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}
