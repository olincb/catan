// ============================================================
// Harbor Component — Shows trade ratios at board edges
// ============================================================

"use client";

import React from "react";
import { HarborType } from "../../engine/types";

const HARBOR_LABELS: Record<HarborType, { label: string; emoji: string }> = {
  [HarborType.Generic]: { label: "3:1", emoji: "⚓" },
  [HarborType.BrickHarbor]: { label: "2:1", emoji: "🧱" },
  [HarborType.LumberHarbor]: { label: "2:1", emoji: "🪵" },
  [HarborType.WoolHarbor]: { label: "2:1", emoji: "🐑" },
  [HarborType.GrainHarbor]: { label: "2:1", emoji: "🌾" },
  [HarborType.OreHarbor]: { label: "2:1", emoji: "⛰️" },
};

export const HARBOR_COLORS: Record<HarborType, string> = {
  [HarborType.Generic]: "#3498db",
  [HarborType.BrickHarbor]: "#c0392b",
  [HarborType.LumberHarbor]: "#27ae60",
  [HarborType.WoolHarbor]: "#a8e6cf",
  [HarborType.GrainHarbor]: "#f1c40f",
  [HarborType.OreHarbor]: "#7f8c8d",
};

interface HarborProps {
  harborType: HarborType;
  cx: number;
  cy: number;
  size: number;
}

export default function Harbor({ harborType, cx, cy, size }: HarborProps) {
  const info = HARBOR_LABELS[harborType];
  const color = HARBOR_COLORS[harborType];
  const r = size * 0.28;

  return (
    <g>
      {/* Harbor dock circle */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={color}
        stroke="#fff"
        strokeWidth={1.5}
        opacity={0.9}
      />
      {/* Ratio text */}
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.15}
        fill="white"
        fontWeight="bold"
      >
        {info.label}
      </text>
      {/* Resource emoji */}
      <text
        x={cx}
        y={cy + r * 0.55}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.18}
      >
        {info.emoji}
      </text>
    </g>
  );
}
