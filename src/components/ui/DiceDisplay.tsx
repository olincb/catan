// ============================================================
// Dice Display — Animated dice roll display
// ============================================================

"use client";

import React, { useState, useEffect } from "react";

const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

function DieFace({ value, size = 48, animate }: { value: number; size?: number; animate: boolean }) {
  const dots = DICE_DOTS[value] || [];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={animate ? "animate-dice-shake" : ""}
    >
      <rect x="2" y="2" width="96" height="96" rx="16" fill="white" stroke="#555" strokeWidth="3" />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="10" fill="#333" />
      ))}
    </svg>
  );
}

interface DiceDisplayProps {
  die1: number;
  die2: number;
}

export default function DiceDisplay({ die1, die2 }: DiceDisplayProps) {
  const [animate, setAnimate] = useState(false);
  const total = die1 + die2;

  useEffect(() => {
    setAnimate(true);
    const t = setTimeout(() => setAnimate(false), 700);
    return () => clearTimeout(t);
  }, [die1, die2]);

  const totalColor =
    total === 7 ? "text-red-400" : total === 6 || total === 8 ? "text-yellow-400" : "text-white";

  return (
    <div className="flex items-center gap-2 animate-slide-up">
      <DieFace value={die1} animate={animate} />
      <DieFace value={die2} animate={animate} />
      <span className={`text-2xl font-bold ${totalColor} ml-2`}>{total}</span>
    </div>
  );
}
