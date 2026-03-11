# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (custom Node server + Socket.IO + Next.js hot reload)
npm run build        # Production build
npm start            # Start production server
npm test             # Run Vitest tests (once)
npm run test:watch   # Run Vitest in watch mode
npm run lint         # Run ESLint
```

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
- `socketHandlers.ts` — All Socket.IO event handlers (lobby join/create, game actions, reconnect). Calls into `roomManager` and `gameManager`.
- `roomManager.ts` — In-memory room/player registry. Manages room codes, player slots, ready states, and socket-to-player mapping.
- `gameManager.ts` — Owns `GameState` instances. Calls engine functions to process actions; sanitizes state per-player before broadcasting (hides other players' dev cards, deck contents).

### Engine (`src/engine/`)

Pure TypeScript game logic with no I/O dependencies. Each module handles one concern:

- `types.ts` — All types, enums, constants, and utility functions (`emptyResourceHand`, `hasResources`, etc.)
- `board.ts` — Hex board generation (axial coordinates), vertex/edge topology, harbor placement
- `state.ts` — `GameState` initialization and the main `applyAction(state, playerAction)` reducer
- `resources.ts` — Dice-roll resource distribution
- `building.ts` — Settlement/city/road placement validation and application
- `trading.ts` — Player-to-player and maritime trade logic
- `devCards.ts` — Development card play logic (Knight, Road Building, Year of Plenty, Monopoly)
- `robber.ts` — Robber movement and resource stealing
- `scoring.ts` — Longest road calculation, Largest Army, victory point totals

The engine barrel (`index.ts`) re-exports everything. Import from `"../engine"` or `"@/engine"`.

### Client (`src/app/`, `src/components/`, `src/hooks/`, `src/stores/`)

- `src/stores/gameStore.ts` — Single Zustand store holding connection state, room info, `GameState`, chat, and UI ephemeral state (selected action, pending robber/knight flows).
- `src/hooks/useSocket.ts` — Singleton Socket.IO client (module-level `globalSocket`). Initializes listeners once. Saves/restores session via `sessionStorage` for reconnect. Exports action-dispatching helpers used by UI components.
- `src/hooks/useSoundManager.ts` — Web Audio API sound effects.
- `src/components/board/` — SVG board rendering (`HexTile`, `Harbor`). Board is rendered in unit-space coordinates multiplied by a hex-size constant.
- `src/components/ui/` — Game UI panels (Lobby, DiceDisplay, GameLog, DiscardDialog, Tooltip).
- `src/app/page.tsx` — Root page; renders Lobby or the game board based on `gameState`.

### Key design decisions

- **No database** — all state is in-memory on the server; a restart clears all games.
- **State sanitization** — `sanitizeStateForPlayer` in `gameManager.ts` strips hidden info (dev card deck order, other players' `newDevCards`) before sending to each client.
- **Session reconnect** — `sessionStorage` stores `(roomCode, playerId)`; on reconnect the client emits `rejoin_room` and the server restores the socket mapping.
- **Extended board** — 5–6 player games use the 31-hex extended board with different terrain/token distributions (all defined in `types.ts`).
- **`@` alias** — `tsconfig.json` maps `@` → `src/`. Use `@/engine`, `@/stores/gameStore`, etc.
