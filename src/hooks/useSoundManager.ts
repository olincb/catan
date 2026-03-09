// ============================================================
// Sound Manager — Simple audio manager with mute toggle
// ============================================================

"use client";

import { useCallback, useRef, useState } from "react";

type SoundName = "dice" | "build" | "trade" | "robber" | "victory" | "turn" | "chat";

// Web Audio API-based sound effects (no external files needed)
function createOscillatorSound(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  gainValue = 0.15,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

const SOUND_CONFIGS: Record<SoundName, (ctx: AudioContext) => void> = {
  dice: (ctx) => {
    // Rattling dice sound — quick noise bursts
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        createOscillatorSound(ctx, 200 + Math.random() * 400, 0.05, "square", 0.08);
      }, i * 40);
    }
    setTimeout(() => createOscillatorSound(ctx, 300, 0.15, "triangle", 0.12), 280);
  },
  build: (ctx) => {
    // Satisfying "click-thunk" for placement
    createOscillatorSound(ctx, 200, 0.08, "square", 0.1);
    setTimeout(() => createOscillatorSound(ctx, 150, 0.15, "triangle", 0.12), 60);
  },
  trade: (ctx) => {
    // Coin-like chime
    createOscillatorSound(ctx, 800, 0.15, "sine", 0.1);
    setTimeout(() => createOscillatorSound(ctx, 1000, 0.2, "sine", 0.08), 100);
  },
  robber: (ctx) => {
    // Ominous low tone
    createOscillatorSound(ctx, 100, 0.4, "sawtooth", 0.1);
    setTimeout(() => createOscillatorSound(ctx, 80, 0.3, "sawtooth", 0.08), 200);
  },
  victory: (ctx) => {
    // Fanfare — ascending notes
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => createOscillatorSound(ctx, freq, 0.3, "sine", 0.12), i * 150);
    });
  },
  turn: (ctx) => {
    // Gentle notification
    createOscillatorSound(ctx, 660, 0.1, "sine", 0.06);
    setTimeout(() => createOscillatorSound(ctx, 880, 0.15, "sine", 0.05), 80);
  },
  chat: (ctx) => {
    // Soft pop
    createOscillatorSound(ctx, 500, 0.08, "sine", 0.05);
  },
};

export function useSoundManager() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback(
    (name: SoundName) => {
      if (muted) return;
      try {
        const ctx = getContext();
        SOUND_CONFIGS[name]?.(ctx);
      } catch {
        // Audio not available — ignore silently
      }
    },
    [muted, getContext],
  );

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return { play, muted, toggleMute };
}
