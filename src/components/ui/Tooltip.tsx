"use client";

import React from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  align?: "center" | "right";
}

export default function Tooltip({ content, children, align = "center" }: TooltipProps) {
  const positionClass = align === "right"
    ? "right-0"
    : "left-1/2 -translate-x-1/2";
  const arrowClass = align === "right"
    ? "mr-2 ml-auto"
    : "mx-auto";

  return (
    <div className="relative inline-block group">
      {children}
      <div className={`hidden group-hover:block absolute bottom-full ${positionClass} mb-2 z-50 pointer-events-none`}>
        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg border border-gray-700 w-max max-w-64">
          {content}
        </div>
        <div className={`w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900 ${arrowClass}`} />
      </div>
    </div>
  );
}
