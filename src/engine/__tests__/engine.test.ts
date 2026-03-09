import { describe, it, expect } from "vitest";
import { generateBoard } from "../board";
import { createGame, dispatchAction } from "../state";
import { GamePhase, TurnPhase, Resource, totalResources } from "../types";

describe("Board Generation", () => {
  it("generates a standard 4-player board with 19 hexes", () => {
    const board = generateBoard(4);
    expect(board.hexes).toHaveLength(19);
    expect(board.vertices.length).toBeGreaterThan(0);
    expect(board.edges.length).toBeGreaterThan(0);
    // Should have exactly 1 desert
    const deserts = board.hexes.filter((h) => h.terrain === "desert");
    expect(deserts).toHaveLength(1);
    // Robber should start on desert
    expect(board.hexes[board.robberHexId].terrain).toBe("desert");
  });

  it("generates an extended 6-player board with 31 hexes", () => {
    const board = generateBoard(6);
    expect(board.hexes).toHaveLength(31);
  });

  it("all non-desert hexes have number tokens", () => {
    const board = generateBoard(4);
    for (const hex of board.hexes) {
      if (hex.terrain !== "desert") {
        expect(hex.numberToken).not.toBeNull();
        expect(hex.numberToken).toBeGreaterThanOrEqual(2);
        expect(hex.numberToken).toBeLessThanOrEqual(12);
      } else {
        expect(hex.numberToken).toBeNull();
      }
    }
  });

  it("vertices have correct adjacency (each vertex has 2-3 edges)", () => {
    const board = generateBoard(4);
    for (const vertex of board.vertices) {
      expect(vertex.edgeIds.length).toBeGreaterThanOrEqual(2);
      expect(vertex.edgeIds.length).toBeLessThanOrEqual(3);
    }
  });

  it("all vertices have valid position coordinates", () => {
    const board = generateBoard(4);
    for (const vertex of board.vertices) {
      expect(vertex.position).toBeDefined();
      expect(typeof vertex.position.x).toBe("number");
      expect(typeof vertex.position.y).toBe("number");
      expect(Number.isFinite(vertex.position.x)).toBe(true);
      expect(Number.isFinite(vertex.position.y)).toBe(true);
    }
  });

  it("edges connect exactly 2 vertices", () => {
    const board = generateBoard(4);
    for (const edge of board.edges) {
      expect(edge.vertexIds).toHaveLength(2);
      expect(edge.vertexIds[0]).not.toBe(edge.vertexIds[1]);
    }
  });

  it("assigns exactly 9 harbors on 18 harbor vertices evenly distributed", () => {
    const board = generateBoard(4);
    const harborVertices = board.vertices.filter((v) => v.harbor !== null);
    // 9 harbors × 2 vertices each = 18 harbor vertices
    expect(harborVertices).toHaveLength(18);
    // Count unique harbor types
    const harborCounts = new Map<string, number>();
    // Each harbor edge has 2 vertices with the same type — count pairs
    const harborEdges = board.edges.filter((e) => {
      const v1 = board.vertices[e.vertexIds[0]];
      const v2 = board.vertices[e.vertexIds[1]];
      return v1.harbor && v1.harbor === v2.harbor;
    });
    expect(harborEdges).toHaveLength(9);
  });
});

describe("Game Creation", () => {
  it("creates a game with correct initial state", () => {
    const state = createGame("test-game", [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
      { id: "p3", name: "Charlie" },
    ]);

    expect(state.id).toBe("test-game");
    expect(state.players).toHaveLength(3);
    expect(state.phase).toBe(GamePhase.SetupForward);
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.developmentCardDeck.length).toBe(25); // 14+2+2+2+5

    // All players start with 0 resources
    for (const player of state.players) {
      expect(totalResources(player.resources)).toBe(0);
      expect(player.settlementsRemaining).toBe(5);
      expect(player.citiesRemaining).toBe(4);
      expect(player.roadsRemaining).toBe(15);
      expect(player.victoryPoints).toBe(0);
    }
  });
});

describe("Setup Phase", () => {
  it("allows first player to place a settlement during setup", () => {
    const state = createGame("test", [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
    ]);

    // Find a valid vertex (any vertex with no adjacent buildings)
    const validVertex = state.board.vertices.find(
      (v) => v.hexIds.length > 0 && !v.building
    );
    expect(validVertex).toBeDefined();

    const result = dispatchAction(state, {
      playerId: "p1",
      action: { type: "SETUP_PLACE_SETTLEMENT", vertexId: validVertex!.id },
    });

    expect(result.success).toBe(true);
    expect(result.state.board.vertices[validVertex!.id].building).not.toBeNull();
    expect(result.state.board.vertices[validVertex!.id].building!.playerId).toBe("p1");
  });

  it("rejects actions from wrong player during setup", () => {
    const state = createGame("test", [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
    ]);

    const validVertex = state.board.vertices.find(
      (v) => v.hexIds.length > 0 && !v.building
    );

    const result = dispatchAction(state, {
      playerId: "p2", // Not p2's turn
      action: { type: "SETUP_PLACE_SETTLEMENT", vertexId: validVertex!.id },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not your turn");
  });

  it("rejects road placement before settlement during setup", () => {
    const state = createGame("test", [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
    ]);

    // Try to place a road without placing a settlement first
    const result = dispatchAction(state, {
      playerId: "p1",
      action: { type: "SETUP_PLACE_ROAD", edgeId: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Place a settlement first");
  });

  it("rejects second settlement before road during setup", () => {
    const state = createGame("test", [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
    ]);

    // Place first settlement
    const v1 = state.board.vertices.find((v) => v.hexIds.length > 0 && !v.building)!;
    const afterSettlement = dispatchAction(state, {
      playerId: "p1",
      action: { type: "SETUP_PLACE_SETTLEMENT", vertexId: v1.id },
    });
    expect(afterSettlement.success).toBe(true);

    // Try to place another settlement without placing a road first
    const v2 = afterSettlement.state.board.vertices.find(
      (v) => v.hexIds.length > 0 && !v.building && v.id !== v1.id
    )!;
    const result = dispatchAction(afterSettlement.state, {
      playerId: "p1",
      action: { type: "SETUP_PLACE_SETTLEMENT", vertexId: v2.id },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Already placed a settlement");
  });

  it("road must connect to just-placed settlement during setup", () => {
    const state = createGame("test", [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
    ]);

    // Place settlement
    const v1 = state.board.vertices.find((v) => v.hexIds.length > 0 && !v.building)!;
    const afterSettlement = dispatchAction(state, {
      playerId: "p1",
      action: { type: "SETUP_PLACE_SETTLEMENT", vertexId: v1.id },
    });
    expect(afterSettlement.success).toBe(true);

    // Place road on a valid edge adjacent to the settlement
    const validEdge = v1.edgeIds.find(
      (eid) => afterSettlement.state.board.edges[eid].road === null
    )!;
    const afterRoad = dispatchAction(afterSettlement.state, {
      playerId: "p1",
      action: { type: "SETUP_PLACE_ROAD", edgeId: validEdge },
    });
    expect(afterRoad.success).toBe(true);

    // Should have advanced to player 2
    expect(afterRoad.state.currentPlayerIndex).toBe(1);
  });

  it("full setup completes with 2 players and transitions to Playing", () => {
    let state = createGame("test", [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
    ]);

    // Helper to place settlement + road for current player
    function placeSetupPair(s: GameState, pid: string): GameState {
      const v = s.board.vertices.find((v) => v.hexIds.length >= 2 && !v.building &&
        v.adjacentVertexIds.every((aid) => !s.board.vertices[aid].building)
      )!;
      const r1 = dispatchAction(s, {
        playerId: pid,
        action: { type: "SETUP_PLACE_SETTLEMENT", vertexId: v.id },
      });
      expect(r1.success).toBe(true);

      const edge = v.edgeIds.find((eid) => r1.state.board.edges[eid].road === null)!;
      const r2 = dispatchAction(r1.state, {
        playerId: pid,
        action: { type: "SETUP_PLACE_ROAD", edgeId: edge },
      });
      expect(r2.success).toBe(true);
      return r2.state;
    }

    // Forward: p1 then p2
    expect(state.phase).toBe(GamePhase.SetupForward);
    state = placeSetupPair(state, "p1");
    expect(state.currentPlayerIndex).toBe(1);
    state = placeSetupPair(state, "p2");

    // Reverse: p2 then p1
    expect(state.phase).toBe(GamePhase.SetupReverse);
    expect(state.currentPlayerIndex).toBe(1);
    state = placeSetupPair(state, "p2");
    expect(state.currentPlayerIndex).toBe(0);
    state = placeSetupPair(state, "p1");

    // Should now be in Playing phase
    expect(state.phase).toBe(GamePhase.Playing);
    expect(state.turnPhase).toBe(TurnPhase.PreRoll);
    expect(state.currentPlayerIndex).toBe(0);

    // Each player should have 2 settlements and 2 roads
    const p1Settlements = state.board.vertices.filter(
      (v) => v.building?.playerId === "p1"
    ).length;
    const p1Roads = state.board.edges.filter(
      (e) => e.road?.playerId === "p1"
    ).length;
    expect(p1Settlements).toBe(2);
    expect(p1Roads).toBe(2);
  });
});

describe("Resource Helpers", () => {
  it("totalResources sums all resources", () => {
    expect(
      totalResources({
        [Resource.Brick]: 2,
        [Resource.Lumber]: 3,
        [Resource.Wool]: 1,
        [Resource.Grain]: 0,
        [Resource.Ore]: 4,
      })
    ).toBe(10);
  });
});
