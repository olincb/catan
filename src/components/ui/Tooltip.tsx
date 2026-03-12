"use client";

import React from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="relative inline-block group">
      {children}
      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg border border-gray-700 whitespace-nowrap">
          {content}
        </div>
        <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900 mx-auto" />
      </div>
    </div>
  );
}
