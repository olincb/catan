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

      {/* Harbors — render at edge midpoints between harbor vertex pairs, offset outward */}
      {(() => {
        // Find edges where both vertices share the same harbor type (these are harbor edges)
        const harborEdges: { harbor: HarborType; mx: number; my: number }[] = [];
        for (const edge of gameState.board.edges) {
          const v1 = gameState.board.vertices[edge.vertexIds[0]];
          const v2 = gameState.board.vertices[edge.vertexIds[1]];
          if (v1.harbor && v1.harbor === v2.harbor) {
            const p1 = layout.vertexPixels.get(v1.id);
            const p2 = layout.vertexPixels.get(v2.id);
            if (!p1 || !p2) continue;

            // Midpoint of the edge
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;

            // Offset outward from board center
            const dx = mx;
            const dy = my;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const offsetDist = HEX_SIZE * 0.6;

            harborEdges.push({
              harbor: v1.harbor,
              mx: mx + (dx / dist) * offsetDist,
              my: my + (dy / dist) * offsetDist,
            });
          }
        }

        return harborEdges.map((h, i) => (
          <Harbor
            key={`harbor-${i}`}
            harborType={h.harbor}
            cx={h.mx}
            cy={h.my}
            size={HEX_SIZE}
          />
        ));
      })()}
    </svg>
  );
}
