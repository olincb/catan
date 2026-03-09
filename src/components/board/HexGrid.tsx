// ============================================================
// Main SVG Hex Grid — Composes all board elements
// ============================================================

"use client";

import React, { useMemo } from "react";
import type { GameState, Vertex as VertexType, Edge as EdgeType, Hex } from "../../engine/types";
import { GamePhase, TurnPhase, PLAYER_COLORS } from "../../engine/types";
import HexTile from "./HexTile";
import VertexComponent from "./Vertex";
import EdgeComponent from "./Edge";
import Harbor from "./Harbor";
import { useGameStore } from "../../stores/gameStore";
import { useSocket } from "../../hooks/useSocket";

interface HexGridProps {
  gameState: GameState;
}

// Convert axial coords to pixel positions (flat-top hex)
function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  const x = size * (3 / 2 * q);
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

function getHexCorners(cx: number, cy: number, size: number): { x: number; y: number }[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i);
    return {
      x: cx + size * Math.cos(angle),
      y: cy + size * Math.sin(angle),
    };
  });
}

function roundKey(x: number, y: number): string {
  return `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;
}

export default function HexGrid({ gameState }: HexGridProps) {
  const { playerId, selectedAction } = useGameStore();
  const { sendAction } = useSocket();

  const HEX_SIZE = 50;
  const PADDING = 80;

  // Compute pixel positions for all elements
  const layout = useMemo(() => {
    const hexPositions: { hex: Hex; cx: number; cy: number }[] = [];
    const vertexPositionMap = new Map<string, { x: number; y: number; vertexId: number }>();
    const vertexPixels = new Map<number, { x: number; y: number }>();

    // 1. Compute hex centers
    for (const hex of gameState.board.hexes) {
      const pos = hexToPixel(hex.coord.q, hex.coord.r, HEX_SIZE);
      hexPositions.push({ hex, cx: pos.x, cy: pos.y });
    }

    // 2. Compute vertex positions by finding unique corners
    const cornerToVertexId = new Map<string, number>();

    for (const hex of gameState.board.hexes) {
      const center = hexToPixel(hex.coord.q, hex.coord.r, HEX_SIZE);
      const corners = getHexCorners(center.x, center.y, HEX_SIZE);

      for (const corner of corners) {
        const key = roundKey(corner.x, corner.y);
        if (!cornerToVertexId.has(key)) {
          // Find which vertex this corner belongs to
          for (const vertex of gameState.board.vertices) {
            if (vertex.hexIds.includes(hex.id)) {
              // Check if this corner is close to the vertex position
              // We need to match vertices by their hex adjacency
              const vKey = roundKey(corner.x, corner.y);
              if (!vertexPositionMap.has(vKey)) {
                // Try to find the correct vertex for this corner
                // A vertex is shared by specific hexes — check all hexes that share this corner
              }
            }
          }
        }
      }
    }

    // Simpler approach: compute all unique corners across all hexes,
    // then match them to vertices by index order
    const allCorners = new Map<string, { x: number; y: number }>();
    const hexCornerMap = new Map<number, string[]>(); // hexId → [corner keys]

    for (const hex of gameState.board.hexes) {
      const center = hexToPixel(hex.coord.q, hex.coord.r, HEX_SIZE);
      const corners = getHexCorners(center.x, center.y, HEX_SIZE);
      const keys: string[] = [];

      for (const corner of corners) {
        const key = roundKey(corner.x, corner.y);
        allCorners.set(key, corner);
        keys.push(key);
      }

      hexCornerMap.set(hex.id, keys);
    }

    // Match vertices to corners: a vertex touches specific hexes,
    // so its position is the corner shared by all those hexes
    for (const vertex of gameState.board.vertices) {
      if (vertex.hexIds.length === 0) continue;

      // Get corners for the first hex
      const firstHexCorners = hexCornerMap.get(vertex.hexIds[0]);
      if (!firstHexCorners) continue;

      if (vertex.hexIds.length === 1) {
        // Vertex touches only 1 hex — find corners not shared with other hexes
        // For now, we'll handle this after matching multi-hex vertices
        continue;
      }

      // Find corners shared by ALL hexes this vertex touches
      const sharedCorners = firstHexCorners.filter((key) =>
        vertex.hexIds.every((hexId) => hexCornerMap.get(hexId)?.includes(key))
      );

      if (sharedCorners.length > 0) {
        const pos = allCorners.get(sharedCorners[0])!;
        vertexPixels.set(vertex.id, pos);
      }
    }

    // Second pass: handle single-hex vertices
    for (const vertex of gameState.board.vertices) {
      if (vertexPixels.has(vertex.id)) continue;
      if (vertex.hexIds.length === 0) continue;

      const firstHexCorners = hexCornerMap.get(vertex.hexIds[0]);
      if (!firstHexCorners) continue;

      // Find a corner that isn't claimed by any multi-hex vertex yet
      for (const key of firstHexCorners) {
        const pos = allCorners.get(key)!;
        // Check if this position is already used
        let used = false;
        for (const [, existingPos] of vertexPixels) {
          if (
            Math.abs(existingPos.x - pos.x) < 0.5 &&
            Math.abs(existingPos.y - pos.y) < 0.5
          ) {
            used = true;
            break;
          }
        }
        if (!used) {
          vertexPixels.set(vertex.id, pos);
          break;
        }
      }
    }

    // Compute bounds for viewBox
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { cx, cy } of hexPositions) {
      minX = Math.min(minX, cx - HEX_SIZE);
      minY = Math.min(minY, cy - HEX_SIZE);
      maxX = Math.max(maxX, cx + HEX_SIZE);
      maxY = Math.max(maxY, cy + HEX_SIZE);
    }

    return {
      hexPositions,
      vertexPixels,
      viewBox: {
        x: minX - PADDING,
        y: minY - PADDING,
        width: maxX - minX + PADDING * 2,
        height: maxY - minY + PADDING * 2,
      },
    };
  }, [gameState.board]);

  // Determine valid placements
  const isSetup = gameState.phase === GamePhase.SetupForward || gameState.phase === GamePhase.SetupReverse;
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;

  // Get player color map
  const playerColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const player of gameState.players) {
      map.set(player.id, player.color);
    }
    return map;
  }, [gameState.players]);

  // Click handlers
  const handleVertexClick = (vertexId: number) => {
    if (!isMyTurn) return;

    if (isSetup) {
      sendAction({ type: "SETUP_PLACE_SETTLEMENT", vertexId });
    } else if (selectedAction === "settlement") {
      sendAction({ type: "BUILD_SETTLEMENT", vertexId });
    } else if (selectedAction === "city") {
      sendAction({ type: "BUILD_CITY", vertexId });
    }
  };

  const handleEdgeClick = (edgeId: number) => {
    if (!isMyTurn) return;

    if (isSetup) {
      sendAction({ type: "SETUP_PLACE_ROAD", edgeId });
    } else if (selectedAction === "road") {
      sendAction({ type: "BUILD_ROAD", edgeId });
    }
  };

  const handleHexClick = (hexId: number) => {
    if (!isMyTurn) return;

    if (gameState.turnPhase === TurnPhase.Robbing) {
      sendAction({ type: "MOVE_ROBBER", hexId });
    }
  };

  return (
    <svg
      viewBox={`${layout.viewBox.x} ${layout.viewBox.y} ${layout.viewBox.width} ${layout.viewBox.height}`}
      className="w-full h-full max-h-[50vh] md:max-h-[70vh]"
      style={{ background: "#1a5276" }}
    >
      {/* Water background is the SVG background color */}

      {/* Hex tiles */}
      {layout.hexPositions.map(({ hex, cx, cy }) => (
        <g key={`hex-${hex.id}`} onClick={() => handleHexClick(hex.id)} className="cursor-pointer">
          <HexTile hex={hex} cx={cx} cy={cy} size={HEX_SIZE} />
        </g>
      ))}

      {/* Edges (roads) */}
      {gameState.board.edges.map((edge) => {
        const p1 = layout.vertexPixels.get(edge.vertexIds[0]);
        const p2 = layout.vertexPixels.get(edge.vertexIds[1]);
        if (!p1 || !p2) return null;

        const isValidRoad = isMyTurn && (selectedAction === "road" || isSetup);
        const roadColor = edge.road ? playerColorMap.get(edge.road.playerId) : undefined;

        return (
          <EdgeComponent
            key={`edge-${edge.id}`}
            edge={edge}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            color={roadColor}
            isValid={isValidRoad}
            isSelectable={isValidRoad}
            onClick={() => handleEdgeClick(edge.id)}
          />
        );
      })}

      {/* Vertices (settlements/cities) */}
      {gameState.board.vertices.map((vertex) => {
        const pos = layout.vertexPixels.get(vertex.id);
        if (!pos) return null;

        const isValidPlacement = isMyTurn && (
          selectedAction === "settlement" ||
          selectedAction === "city" ||
          isSetup
        );

        // Replace playerId with actual color for rendering
        const vertexWithColor = vertex.building
          ? {
              ...vertex,
              building: {
                ...vertex.building,
                playerId: playerColorMap.get(vertex.building.playerId) || vertex.building.playerId,
              },
            }
          : vertex;

        return (
          <VertexComponent
            key={`vertex-${vertex.id}`}
            vertex={vertexWithColor}
            cx={pos.x}
            cy={pos.y}
            size={HEX_SIZE}
            isValid={isValidPlacement}
            isSelectable={isValidPlacement}
            onClick={() => handleVertexClick(vertex.id)}
          />
        );
      })}

      {/* Harbors — render at perimeter vertices that have harbor assignments */}
      {gameState.board.vertices
        .filter((v) => v.harbor !== null)
        .reduce<{ harbor: typeof gameState.board.vertices[0]["harbor"]; cx: number; cy: number }[]>(
          (acc, vertex) => {
            const pos = layout.vertexPixels.get(vertex.id);
            if (!pos || !vertex.harbor) return acc;
            // Offset harbor label outward from board center
            const boardCenterX = 0;
            const boardCenterY = 0;
            const dx = pos.x - boardCenterX;
            const dy = pos.y - boardCenterY;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const offsetDist = HEX_SIZE * 0.55;
            const hx = pos.x + (dx / dist) * offsetDist;
            const hy = pos.y + (dy / dist) * offsetDist;

            // Deduplicate: only render one harbor badge per harbor type at this approximate position
            const alreadyRendered = acc.some(
              (h) => h.harbor === vertex.harbor && Math.abs(h.cx - hx) < HEX_SIZE * 0.5 && Math.abs(h.cy - hy) < HEX_SIZE * 0.5
            );
            if (!alreadyRendered) {
              acc.push({ harbor: vertex.harbor, cx: hx, cy: hy });
            }
            return acc;
          },
          []
        )
        .map((h, i) => (
          <Harbor
            key={`harbor-${i}`}
            harborType={h.harbor!}
            cx={h.cx}
            cy={h.cy}
            size={HEX_SIZE}
          />
        ))}
    </svg>
  );
}
