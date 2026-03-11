// ============================================================
// SVG Edge Component — Road placement
// ============================================================

"use client";

import React from "react";
import type { Edge } from "../../engine/types";

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
  if (edge.road) {
    return (
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color || "#333"}
        strokeWidth={8}
        strokeLinecap="round"
      />
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
