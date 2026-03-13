# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
See also `.github/copilot-instructions.md` for shared project context.

## Commands

```bash
npm run dev          # Start dev server (custom Node server + Socket.IO + Next.js hot reload)
npm run build        # Production build (strict TypeScript — catches errors ESLint misses)
npm start            # Start production server
npm test             # Run Vitest tests (once)
npm run test:watch   # Run Vitest in watch mode
npm run lint         # Run ESLint
```

Always run `npm run build` before pushing — it catches type errors that `tsc --noEmit` and ESLint miss (e.g., `string | undefined` vs `string | null`).

Run a single test file:
```bash
npx vitest run src/engine/__tests__/engine.test.ts
```

Tests live under `src/**/__tests__/**/*.test.ts`.

## Architecture

This is a **server-authoritative multiplayer Catan** game. The server owns all game state; clients are thin views that send actions and render state.

### Data flow

```
Client UI → Socket.IO event → socketHandlers.ts → gameManager.ts → engine/ → broadcast updated state
```

### Server (`src/server/`)

- `index.ts` — Creates HTTP server, attaches Socket.IO, calls `setupSocketHandlers`. Entry point for both `dev` and `start` scripts (run via `tsx`).
- `socketHandlers.ts` — All Socket.IO event handlers (lobby join/create, game actions, reconnect). Calls into `roomManager` and `gameManager`. **Server-side changes require dev server restart (no hot reload).**
- `roomManager.ts` — In-memory room/player registry. Manages room codes, player slots, ready states, and socket-to-player mapping. Room type fields use `null` not `undefined`.
- `gameManager.ts` — Owns `GameState` instances. Calls engine functions to process actions; `sanitizeStateForPlayer` hides opponents' dev card types but preserves total count (fills array with `null` placeholders). Hides `hiddenVictoryPoints` from opponents to prevent VP card deduction.

### Engine (`src/engine/`)

Pure TypeScript game logic with no I/O dependencies. Each module handles one concern:

- `types.ts` — All types, enums, constants, and utility functions. `PLAYER_COLORS` has 6 entries, `MAX_PLAYERS=6`.
- `board.ts` — Hex board generation (axial coordinates), vertex/edge topology, harbor placement. `playerCount > 4` triggers 31-hex extended board.
- `state.ts` — `createGame()` Fisher-Yates shuffles player order. `advanceSetupTurn()` handles forward/reverse setup then transitions to Playing. `updateSpecialCards` is called at setup completion.
- `resources.ts` — Dice-roll resource distribution
- `building.ts` — Settlement/city/road placement validation. `getValidRoadEdges`/`getValidSettlementVertices` used by both server and client.
- `trading.ts` — Player-to-player and maritime trade logic
- `devCards.ts` — VP cards go directly to `developmentCards` + increment `hiddenVictoryPoints`. Action cards go to `newDevCards` (playable next turn).
- `robber.ts` — Robber movement and resource stealing
- `scoring.ts` — `updateSpecialCards` computes longest road per player and assigns Longest Road / Largest Army.

The engine barrel (`index.ts`) re-exports everything. Import from `"../engine"` or `"@/engine"`.

### Client (`src/app/`, `src/components/`, `src/hooks/`, `src/stores/`)

- `src/stores/gameStore.ts` — Single Zustand store. `setGameState` accepts `GameState | null`. Detects drawn dev cards by comparing `newDevCards.length` AND `hiddenVictoryPoints` across state updates.
- `src/hooks/useSocket.ts` — Singleton Socket.IO client. `room_joined` handler clears reconnecting state and nulls gameState. Saves/restores session via `sessionStorage` for reconnect.
- `src/hooks/useSoundManager.ts` — Web Audio API sound effects.
- `src/components/board/` — SVG board rendering. Roads: 9.5/7 stroke (outline/fill). Cities: peaked-roof tower + lower wing shape.
- `src/components/ui/` — Game UI panels. Scoreboard uses two-row layout (name+VP top, stats below).
- `src/app/page.tsx` — Root page; renders Lobby or the game board based on `gameState`.

### Key patterns

- **State sanitization** — Opponents see dev card count but not types. `developmentCards` filled with null placeholders. `hiddenVictoryPoints` zeroed. `newDevCards` cleared.
- **Game-over flow** — `reconnect_to_game` checks `GamePhase.Finished` → clears gameId, resets ready state, emits `room_joined` (not `game_reconnected`).
- **Setup phase** — Players array is shuffled at game creation. Setup goes forward (0→n-1) then reverse (n-1→0). Main game starts with player 0.
- **VP cards** — Skip `newDevCards`, go straight to `developmentCards`. Tracked via `hiddenVictoryPoints`. Never shown as "playable" in UI.
- **Extended board** — 5–6 player games use the 31-hex extended board with different terrain/token distributions (all defined in `types.ts`).
- **`@` alias** — `tsconfig.json` maps `@` → `src/`. Use `@/engine`, `@/stores/gameStore`, etc.

### Common gotchas

- Room type fields use `null` not `undefined` — `npm run build` catches mismatches that ESLint/tsc miss
- `structuredClone` is used extensively — use `let` not `const` if you need to reassign the clone
- Server-side changes require dev server restart; client components hot-reload via Next.js
