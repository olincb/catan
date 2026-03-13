// ============================================================
// SVG Edge Component — Road placement
// ============================================================

"use client";

import React, { useMemo } from "react";
import type { Edge, BoardState } from "../../engine/types";
import { useGameStore } from "../../stores/gameStore";

function computeRoadChainLength(edge: Edge, board: BoardState): number {
  if (!edge.road) return 0;
  const playerId = edge.road.playerId;
  const edgeMap = new Map(board.edges.map((e) => [e.id, e]));
  const vertexMap = new Map(board.vertices.map((v) => [v.id, v]));

  const visited = new Set<number>();
  const queue: number[] = [edge.id];
  visited.add(edge.id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const current = edgeMap.get(currentId)!;
    for (const vId of current.vertexIds) {
      const vertex = vertexMap.get(vId);
      if (!vertex) continue;
      // Stop at opponent buildings
      if (vertex.building && vertex.building.playerId !== playerId) continue;
      for (const adjId of vertex.edgeIds) {
        if (!visited.has(adjId)) {
          const adj = edgeMap.get(adjId);
          if (adj?.road?.playerId === playerId) {
            visited.add(adjId);
            queue.push(adjId);
          }
        }
      }
    }
  }
  return visited.size;
}

interface EdgeComponentProps {
  edge: Edge;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  isValid: boolean;
  isSelectable: boolean;
  onClick?: () => void;
}

export default function EdgeComponent({
  edge,
  x1,
  y1,
  x2,
  y2,
  color,
  isValid,
  isSelectable,
  onClick,
}: EdgeComponentProps) {
  const board = useGameStore((s) => s.gameState?.board);

  const chainLength = useMemo(() => {
    if (!edge.road || !board) return 0;
    return computeRoadChainLength(edge, board);
  }, [edge, board]);

  if (edge.road) {
    return (
      <g>
        <title>Road chain: {chainLength} {chainLength === 1 ? "road" : "roads"}</title>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#000"
          strokeWidth={12}
          strokeLinecap="round"
        />
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color || "#333"}
          strokeWidth={8}
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (isValid && isSelectable) {
    return (
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="rgba(46, 204, 113, 0.5)"
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray="6,4"
        className="cursor-pointer hover:stroke-green-400 transition-colors"
        onClick={onClick}
      />
    );
  }

  return null;
}
