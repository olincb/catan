// ============================================================
// SVG Vertex Component — Settlement & City placement
// ============================================================

"use client";

import React from "react";
import type { Vertex } from "../../engine/types";
import { BuildingType, PLAYER_COLORS } from "../../engine/types";

interface VertexComponentProps {
  vertex: Vertex;
  cx: number;
  cy: number;
  size: number;
  isValid: boolean;
  isSelectable: boolean;
  onClick?: () => void;
}

export default function VertexComponent({
  vertex,
  cx,
  cy,
  size,
  isValid,
  isSelectable,
  onClick,
}: VertexComponentProps) {
  const building = vertex.building;

  if (building) {
    const color = building.playerId; // We'll map this to actual color in parent
    if (building.type === BuildingType.Settlement) {
      // House shape: rectangular base with triangular roof
      const s = size * 0.35;
      const points = `${cx - s*0.7},${cy + s*0.7} ${cx + s*0.7},${cy + s*0.7} ${cx + s*0.7},${cy} ${cx},${cy - s} ${cx - s*0.7},${cy}`;
      return (
        <polygon
          points={points}
          fill={color}
          stroke="#333"
          strokeWidth={1.5}
        />
      );
    }
    // Castle shape: wider base with a tower on top
    const s = size * 0.4;
    const points = `${cx-s},${cy+s*0.7} ${cx+s},${cy+s*0.7} ${cx+s},${cy-s*0.2} ${cx+s*0.3},${cy-s*0.2} ${cx+s*0.3},${cy-s} ${cx-s*0.3},${cy-s} ${cx-s*0.3},${cy-s*0.2} ${cx-s},${cy-s*0.2}`;
    return (
      <polygon
        points={points}
        fill={color}
        stroke="#333"
        strokeWidth={1.5}
      />
    );
  }

  if (isValid && isSelectable) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={size * 0.2}
        fill="rgba(255, 255, 255, 0.6)"
        stroke="#2ecc71"
        strokeWidth={2}
        strokeDasharray="3,2"
        className="cursor-pointer hover:fill-green-300 transition-colors"
        onClick={onClick}
      />
    );
  }

  // Show harbor indicator
  if (vertex.harbor) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={3}
        fill="#3498db"
        opacity={0.5}
      />
    );
  }

  return null;
}
