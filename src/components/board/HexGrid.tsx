// ============================================================
// Main SVG Hex Grid — Composes all board elements
// ============================================================

"use client";

import React, { useMemo } from "react";
import type { GameState, Vertex as VertexType, Edge as EdgeType, Hex } from "../../engine/types";
import { GamePhase, TurnPhase, HarborType, PLAYER_COLORS } from "../../engine/types";
import HexTile from "./HexTile";
import VertexComponent from "./Vertex";
import EdgeComponent from "./Edge";
import Harbor, { HARBOR_COLORS } from "./Harbor";
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

export default function HexGrid({ gameState }: HexGridProps) {
  const { playerId, selectedAction } = useGameStore();
  const { sendAction } = useSocket();

  const HEX_SIZE = 50;
  const PADDING = 80;

  // Compute pixel positions for all elements
  const layout = useMemo(() => {
    const hexPositions: { hex: Hex; cx: number; cy: number }[] = [];
    const vertexPixels = new Map<number, { x: number; y: number }>();

    // 1. Compute hex centers
    for (const hex of gameState.board.hexes) {
      const pos = hexToPixel(hex.coord.q, hex.coord.r, HEX_SIZE);
      hexPositions.push({ hex, cx: pos.x, cy: pos.y });
    }

    // 2. Compute vertex positions directly from stored unit-space positions
    for (const vertex of gameState.board.vertices) {
      if (!vertex.position) continue;
      vertexPixels.set(vertex.id, {
        x: vertex.position.x * HEX_SIZE,
        y: vertex.position.y * HEX_SIZE,
      });
    }

    // Compute bounds for viewBox
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { cx, cy } of hexPositions) {
      minX = Math.min(minX, cx - HEX_SIZE);
      minY = Math.min(minY, cy - HEX_SIZE);
      maxX = Math.max(maxX, cx + HEX_SIZE);
      maxY = Math.max(maxY, cy + HEX_SIZE);
    }

    // Compute beach border polygon (convex hull of hex corners, expanded)
    const allCorners: { x: number; y: number }[] = [];
    for (const { cx, cy } of hexPositions) {
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        allCorners.push({
          x: cx + HEX_SIZE * Math.cos(angle),
          y: cy + HEX_SIZE * Math.sin(angle),
        });
      }
    }

    // Simple convex hull (Graham scan)
    function cross(O: {x:number;y:number}, A: {x:number;y:number}, B: {x:number;y:number}) {
      return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
    }
    const sorted = [...allCorners].sort((a, b) => a.x - b.x || a.y - b.y);
    const lower: {x:number;y:number}[] = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper: {x:number;y:number}[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
      upper.push(p);
    }
    lower.pop();
    upper.pop();
    const hull = [...lower, ...upper];

    // Expand hull outward from centroid
    const centroidX = hull.reduce((s, p) => s + p.x, 0) / hull.length;
    const centroidY = hull.reduce((s, p) => s + p.y, 0) / hull.length;
    const BEACH_EXPAND = 18;
    const beachPoints = hull.map(p => {
      const dx = p.x - centroidX;
      const dy = p.y - centroidY;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      return {
        x: p.x + (dx / dist) * BEACH_EXPAND,
        y: p.y + (dy / dist) * BEACH_EXPAND,
      };
    });
    const beachPath = beachPoints.map(p => `${p.x},${p.y}`).join(" ");

    return {
      hexPositions,
      vertexPixels,
      beachPath,
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

      {/* Beach border */}
      <polygon
        points={layout.beachPath}
        fill="#f4d9a0"
        stroke="#d4b878"
        strokeWidth={2}
        opacity={0.85}
      />

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

      {/* Harbors — dock lines + badges at edge midpoints */}
      {(() => {
        const harborData: {
          harbor: HarborType;
          mx: number; my: number;
          v1x: number; v1y: number;
          v2x: number; v2y: number;
        }[] = [];
        for (const edge of gameState.board.edges) {
          const v1 = gameState.board.vertices[edge.vertexIds[0]];
          const v2 = gameState.board.vertices[edge.vertexIds[1]];
          if (v1.harbor && v1.harbor === v2.harbor) {
            const p1 = layout.vertexPixels.get(v1.id);
            const p2 = layout.vertexPixels.get(v2.id);
            if (!p1 || !p2) continue;

            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            const dx = mx;
            const dy = my;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const offsetDist = HEX_SIZE * 0.9;

            harborData.push({
              harbor: v1.harbor,
              mx: mx + (dx / dist) * offsetDist,
              my: my + (dy / dist) * offsetDist,
              v1x: p1.x, v1y: p1.y,
              v2x: p2.x, v2y: p2.y,
            });
          }
        }

        return harborData.map((h, i) => {
          const color = HARBOR_COLORS[h.harbor];
          return (
            <g key={`harbor-${i}`}>
              {/* Dock lines from harbor badge to each vertex */}
              <line
                x1={h.mx} y1={h.my} x2={h.v1x} y2={h.v1y}
                stroke={color} strokeWidth={2} strokeDasharray="4,3" opacity={0.7}
              />
              <line
                x1={h.mx} y1={h.my} x2={h.v2x} y2={h.v2y}
                stroke={color} strokeWidth={2} strokeDasharray="4,3" opacity={0.7}
              />
              {/* Small dock dots on the vertices */}
              <circle cx={h.v1x} cy={h.v1y} r={4} fill={color} opacity={0.6} />
              <circle cx={h.v2x} cy={h.v2y} r={4} fill={color} opacity={0.6} />
              {/* Harbor badge */}
              <Harbor harborType={h.harbor} cx={h.mx} cy={h.my} size={HEX_SIZE} />
            </g>
          );
        });
      })()}
    </svg>
  );
}
