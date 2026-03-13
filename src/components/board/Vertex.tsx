// ============================================================
// SVG Vertex Component — Settlement & City placement
// ============================================================

"use client";

import React from "react";
import type { Vertex } from "../../engine/types";
import { BuildingType } from "../../engine/types";

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
    const upgradeable = isValid && isSelectable;
    if (building.type === BuildingType.Settlement) {
      // House shape: rectangular base with triangular roof
      const s = size * 0.35;
      const points = `${cx - s*0.7},${cy + s*0.7} ${cx + s*0.7},${cy + s*0.7} ${cx + s*0.7},${cy} ${cx},${cy - s*0.6} ${cx - s*0.7},${cy}`;
      return (
        <g
          onClick={upgradeable ? onClick : undefined}
          className={upgradeable ? "cursor-pointer" : undefined}
        >
          {upgradeable && (
            <circle
              cx={cx}
              cy={cy}
              r={size * 0.35}
              fill="none"
              stroke="#2ecc71"
              strokeWidth={2.5}
              strokeDasharray="4,3"
              className="animate-pulse"
            />
          )}
          <polygon
            points={points}
            fill={color}
            stroke={upgradeable ? "#2ecc71" : "#333"}
            strokeWidth={upgradeable ? 2.5 : 1.5}
            pointerEvents={upgradeable ? "all" : undefined}
          />
        </g>
      );
    }
    // City: tower with peaked roof on left, lower wing on right
    const s = size * 0.35;
    const u = s * 0.5;
    const points = [
      `${cx - 2*u},${cy + 2*u}`,
      `${cx - 2*u},${cy - u}`,
      `${cx - u},${cy - 2*u}`,
      `${cx},${cy - u}`,
      `${cx},${cy}`,
      `${cx + 2*u},${cy}`,
      `${cx + 2*u},${cy + 2*u}`,
    ].join(' ');
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
        pointerEvents="none"
      />
    );
  }

  return null;
}
