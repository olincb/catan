# Copilot Instructions

## Project Overview

Online multiplayer Catan board game. Server-authoritative architecture: pure TypeScript engine, Socket.IO for real-time multiplayer, Next.js frontend, Zustand for client state. Deployed to Fly.io via Docker.

## Commands

```bash
npm run dev          # Dev server (custom Node + Socket.IO + Next.js hot reload)
npm run build        # Production build (strict TypeScript — catches errors ESLint misses)
npm start            # Production server
npm test             # Vitest (21 tests)
npm run lint         # ESLint
```

Always run `npm run build` before pushing — it catches type errors that `tsc --noEmit` and ESLint miss (e.g., `string | undefined` vs `string | null`).

## Architecture

```
Client UI → Socket.IO → socketHandlers.ts → gameManager.ts → engine/ → broadcast sanitized state
```

### Server (`src/server/`)
- `index.ts` — HTTP server + Socket.IO + Next.js. Entry point for dev and prod (run via `tsx`).
- `socketHandlers.ts` — All socket event handlers (lobby, game actions, reconnect). Server-side code changes require server restart (no hot reload).
- `roomManager.ts` — In-memory room/player registry. Room type uses `string | null` (not `undefined`).
- `gameManager.ts` — Owns GameState instances. `sanitizeStateForPlayer` hides opponents' dev card types but preserves total count (fills with null placeholders). Hides `hiddenVictoryPoints` from opponents to prevent VP card deduction.

### Engine (`src/engine/`)
Pure TypeScript, no I/O. Each module = one concern:
- `types.ts` — All types, enums, constants (PLAYER_COLORS has 6 entries, MAX_PLAYERS=6)
- `board.ts` — Hex board generation. `playerCount > 4` triggers 31-hex extended board.
- `state.ts` — GameState init + `applyAction` reducer. `createGame()` Fisher-Yates shuffles player order. `advanceSetupTurn()` runs setup forward/reverse then transitions to Playing.
- `building.ts` — Placement validation. `getValidRoadEdges`/`getValidSettlementVertices` used by both server and client.
- `devCards.ts` — VP cards go directly to `developmentCards` + increment `hiddenVictoryPoints`. Action cards go to `newDevCards` (playable next turn).
- `scoring.ts` — `updateSpecialCards` computes longest road per player and assigns Longest Road / Largest Army. Called after builds and at setup completion.

### Client (`src/app/`, `src/components/`, `src/hooks/`, `src/stores/`)
- `gameStore.ts` — Zustand store. `setGameState` accepts `GameState | null`. Detects drawn dev cards by comparing `newDevCards.length` AND `hiddenVictoryPoints` across state updates.
- `useSocket.ts` — Singleton socket client. `room_joined` handler clears reconnecting state and nulls gameState. Saves session to sessionStorage for reconnect.
- `components/board/` — SVG rendering. Roads: 9.5/7 stroke (outline/fill). Cities: peaked-roof tower + lower wing shape.
- `components/ui/Scoreboard.tsx` — Two-row layout per player: name+VP top row, stats (road/knights/cards/devCards) below.

## Key Patterns

- **State sanitization**: Opponents see dev card count but not types. `developmentCards` filled with `null` placeholders for count. `hiddenVictoryPoints` zeroed. `newDevCards` cleared.
- **Game-over flow**: `reconnect_to_game` checks `GamePhase.Finished` → clears gameId, resets ready state, emits `room_joined` (not `game_reconnected`).
- **Setup phase**: Players array is shuffled at game creation. Setup goes forward (0→n-1) then reverse (n-1→0). Main game starts with player 0.
- **VP cards**: Skip `newDevCards`, go straight to `developmentCards`. Tracked via `hiddenVictoryPoints`. Never shown as "playable" in UI.

## Common Gotchas

- Room type fields use `null` not `undefined` — TypeScript strict build will catch mismatches
- Server-side changes (socketHandlers, roomManager, gameManager) require dev server restart
- Client component changes hot-reload via Next.js
- `structuredClone` is used extensively in the engine — if you need to reassign the clone variable, use `let` not `const`
- The `@` path alias maps to `src/` — use `@/engine`, `@/stores/gameStore`, etc.
