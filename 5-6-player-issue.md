## Title:
Support 5-6 Player Expansion

## Description:

### Overview
Add full support for the Catan 5-6 Player Extension. The board generation, player limits (MAX_PLAYERS=6), colors (6 defined), lobby UI (dropdown goes to 6), and turn flow (modulo-based) are **already implemented**. The main missing piece is the **Special Build Phase** mechanic, plus some UI/balance verification.

### What the expansion changes (per official rules)

**Board (already done ✅)**
- Extended board: 30 terrain hexes + 1 desert (31 total, vs 19 for base game)
- `generateBoard()` already checks `playerCount > 4` and adds a 3rd ring
- Extended terrain distribution and number tokens already defined in `types.ts`

**Special Build Phase (not implemented ❌)**
After the active player's turn ends, every *other* player (in clockwise order) gets a **Special Build Phase** where they may:
- Build roads, settlements, and cities
- Buy development cards
- Trade with the bank/ports at normal ratios

They may **not**:
- Trade with other players
- Play development cards
- Roll dice

This prevents players from sitting with 8+ cards for too long and losing half to a 7 roll. It's the core mechanic that makes 5-6 player games viable.

### Implementation plan

#### 1. Special Build Phase — opt-in flag (`src/engine/state.ts`, `src/engine/types.ts`)
- Add a `wantsSpecialBuild: boolean` flag per player in `PlayerState`
- Any non-active player can toggle this flag **at any point** during the current player's turn (via a `REQUEST_SPECIAL_BUILD` action or UI toggle)
- When the active player ends their turn, check if any other players have `wantsSpecialBuild` set
  - If **none**: skip straight to the next player's turn as usual
  - If **any**: enter `TurnPhase.SpecialBuild`, cycling through only the players who opted in (in turn order)
- Track `specialBuildPlayerIndex` in `GameState` for whose special build is active
- After the last opted-in player finishes, advance to the next player's normal turn and clear all `wantsSpecialBuild` flags
- Only enable this mechanic when `players.length >= 5` (base game 2-4 is unchanged)

#### 2. Special Build Phase — actions
- Allow `BUILD_ROAD`, `BUILD_SETTLEMENT`, `BUILD_CITY`, `BUY_DEV_CARD` during Special Build
- Allow bank/port trades (`BANK_TRADE`) during Special Build
- Block `PLAY_DEV_CARD`, `OFFER_TRADE`, `ACCEPT_TRADE` during Special Build
- Add `END_SPECIAL_BUILD` action for the active special-build player to finish their phase

#### 3. Dev card deck scaling
- Base game: 25 dev cards (14 knights, 5 VP, 2 each of road building/year of plenty/monopoly)
- Verify this is sufficient for 5-6 players, or add extras if the physical expansion includes more cards
- The `createDevCardDeck()` function in `devCards.ts` may need a player-count parameter

#### 4. Piece limits verification
- Current per-player limits: 5 settlements, 4 cities, 15 roads — these match the physical game for all player counts
- With 6 players on 31 hexes, vertex/edge counts should be sufficient (extended board has ~72 vertices and ~90 edges)

#### 5. UI updates
- **Special Build toggle**: Non-active players see a "Request Special Build" button/toggle they can click at any time during another player's turn
- **ActionPanel**: When it's your special build turn, show build/buy buttons only (no trade/dev card play)
- **Turn indicator**: Display "Special Build Phase — [Player Name]" so everyone knows what's happening
- **Scoreboard/Lobby**: Verify layout works with 6 players (may need tighter spacing)
- **Board scaling**: 31-hex board may need viewport/zoom adjustments to fit well

#### 6. Tests
- Add engine tests for Special Build Phase cycling
- Test that blocked actions (trade, play dev card) are properly rejected
- Test with 5 and 6 player game creation through full setup

### What's already working (no changes needed)
- [x] Board generation (19 vs 31 hexes based on player count)
- [x] Extended terrain/number token distribution
- [x] 6 player colors defined
- [x] MAX_PLAYERS = 6, lobby dropdown supports 2-6
- [x] Room system caps at 6, handles color assignment
- [x] Turn order logic uses modulo (generic for any count)
- [x] Setup phase forward/reverse works for any player count

### References
- [Official 5-6 Player Rules (2022)](https://www.catan.com/sites/default/files/2024-03/Catan%20Game%205-6%20Rules%202022%20240313.pdf)
- Note: The 2022 rules introduced a "Paired Players' Turn" variant, but the classic Special Build Phase is simpler and more widely known — recommend implementing that first
