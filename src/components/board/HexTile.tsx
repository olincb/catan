// ============================================================
// SVG Hex Tile Component
// ============================================================

"use client";

import React from "react";
import type { Hex } from "../../engine/types";
import { TerrainType } from "../../engine/types";

const TERRAIN_COLORS: Record<TerrainType, string> = {
  [TerrainType.Hills]: "#c0392b",
  [TerrainType.Forest]: "#27ae60",
  [TerrainType.Pasture]: "#7ec850",
  [TerrainType.Fields]: "#f1c40f",
  [TerrainType.Mountains]: "#7f8c8d",
  [TerrainType.Desert]: "#f5deb3",
};

const TERRAIN_LABELS: Record<TerrainType, string> = {
  [TerrainType.Hills]: "🧱",
  [TerrainType.Forest]: "🌲",
  [TerrainType.Pasture]: "🐑",
  [TerrainType.Fields]: "🌾",
  [TerrainType.Mountains]: "⛰️",
  [TerrainType.Desert]: "🏜️",
};

interface HexTileProps {
  hex: Hex;
  cx: number;
  cy: number;
  size: number;
}

export default function HexTile({ hex, cx, cy, size }: HexTileProps) {
  // Generate flat-top hexagon points
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    return `${x},${y}`;
  }).join(" ");

  const isHighNumber = hex.numberToken === 6 || hex.numberToken === 8;
  const dotCount = hex.numberToken ? Math.min(5, 6 - Math.abs(7 - hex.numberToken)) : 0;

  return (
    <g>
      <polygon
        points={points}
        fill={TERRAIN_COLORS[hex.terrain]}
        stroke="#5d4037"
        strokeWidth={2}
        opacity={0.9}
      />

      {/* Terrain emoji */}
      <text
        x={cx}
        y={cy - (hex.numberToken ? 8 : 0)}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.4}
      >
        {TERRAIN_LABELS[hex.terrain]}
      </text>

      {/* Number token */}
      {hex.numberToken && (
        <>
          <circle cx={cx} cy={cy + 10} r={size * 0.3} fill="white" stroke="#333" strokeWidth={1} />
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={size * 0.32}
            fontWeight="bold"
            fill={isHighNumber ? "#e74c3c" : "#333"}
          >
            {hex.numberToken}
          </text>
          {/* Probability dots */}
          <text
            x={cx}
            y={cy + 10 + size * 0.18}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fill={isHighNumber ? "#e74c3c" : "#666"}
          >
            {"•".repeat(dotCount)}
          </text>
        </>
      )}

      {/* Robber indicator */}
      {hex.hasRobber && (
        <text
          x={cx + size * 0.35}
          y={cy - size * 0.35}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.35}
        >
          🦹
        </text>
      )}
    </g>
  );
}
