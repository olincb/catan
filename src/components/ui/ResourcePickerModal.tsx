// ============================================================
// Resource Picker Modal — Choose resources for Monopoly / Year of Plenty
// ============================================================

"use client";

import React, { useState, useCallback } from "react";
import { Resource } from "../../engine/types";

const RESOURCE_EMOJI: Record<Resource, string> = {
  [Resource.Lumber]: "🌲",
  [Resource.Brick]: "🧱",
  [Resource.Wool]: "🐑",
  [Resource.Grain]: "🌾",
  [Resource.Ore]: "⛰️",
};

const RESOURCE_LABELS: Record<Resource, string> = {
  [Resource.Lumber]: "Lumber",
  [Resource.Brick]: "Brick",
  [Resource.Wool]: "Wool",
  [Resource.Grain]: "Grain",
  [Resource.Ore]: "Ore",
};

interface ResourcePickerProps {
  isOpen: boolean;
  title: string;
  count: number;
  onConfirm: (resources: Resource[]) => void;
  onCancel: () => void;
}

export default function ResourcePickerModal({ isOpen, title, count, onConfirm, onCancel }: ResourcePickerProps) {
  const [selected, setSelected] = useState<Resource[]>([]);

  const handleSelect = useCallback((resource: Resource) => {
    if (count === 1) {
      onConfirm([resource]);
      return;
    }

    setSelected((prev) => {
      const idx = prev.indexOf(resource);
      if (idx >= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      if (prev.length < count) {
        return [...prev, resource];
      }
      return prev;
    });
  }, [count, onConfirm]);

  const handleConfirm = useCallback(() => {
    if (selected.length === count) {
      onConfirm(selected);
      setSelected([]);
    }
  }, [selected, count, onConfirm]);

  const handleCancel = useCallback(() => {
    setSelected([]);
    onCancel();
  }, [onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-5 w-80 shadow-xl">
        <h3 className="text-white font-bold text-sm mb-3">{title}</h3>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {Object.values(Resource).map((res) => {
            const isSelected = selected.includes(res);
            return (
              <button
                key={res}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded transition-colors text-xs font-medium ${
                  isSelected
                    ? "bg-yellow-600 text-white ring-2 ring-yellow-400"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
                onClick={() => handleSelect(res)}
              >
                <span className="text-lg">{RESOURCE_EMOJI[res]}</span>
                <span>{RESOURCE_LABELS[res]}</span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <button
            className="bg-gray-600 hover:bg-gray-500 text-white py-1 px-3 rounded text-sm"
            onClick={handleCancel}
          >
            Cancel
          </button>
          {count > 1 && (
            <button
              className={`py-1 px-3 rounded text-sm font-medium transition-colors ${
                selected.length === count
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
              disabled={selected.length !== count}
              onClick={handleConfirm}
            >
              Confirm ({selected.length}/{count})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
