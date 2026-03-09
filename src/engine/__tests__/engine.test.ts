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

  it("edges connect exactly 2 vertices", () => {
    const board = generateBoard(4);
    for (const edge of board.edges) {
      expect(edge.vertexIds).toHaveLength(2);
      expect(edge.vertexIds[0]).not.toBe(edge.vertexIds[1]);
    }
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
