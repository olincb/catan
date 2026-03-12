// ============================================================
// Main SVG Hex Grid — Composes all board elements
// ============================================================

"use client";

import React, { useMemo } from "react";
import type { GameState, Hex } from "../../engine/types";
import { GamePhase, TurnPhase, HarborType, BuildingType } from "../../engine/types";
import { getValidRoadEdges } from "../../engine/building";
import HexTile from "./HexTile";
import VertexComponent from "./Vertex";
import EdgeComponent from "./Edge";
import Harbor, { HARBOR_COLORS } from "./Harbor";
import { useGameStore } from "../../stores/gameStore";
import { useSocket } from "../../hooks/useSocket";

interface HexGridProps {
  gameState: GameState;
}

// Convert axial coords to pixel positions (flat-top hex)
function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  const x = size * (3 / 2 * q);
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

export default function HexGrid({ gameState }: HexGridProps) {
  const { playerId, selectedAction } = useGameStore();
  const { sendAction } = useSocket();

  const HEX_SIZE = 50;
  const PADDING = 80;

  // Compute pixel positions for all elements
  const layout = useMemo(() => {
    const hexPositions: { hex: Hex; cx: number; cy: number }[] = [];
    const vertexPixels = new Map<number, { x: number; y: number }>();

    // 1. Compute hex centers
    for (const hex of gameState.board.hexes) {
      const pos = hexToPixel(hex.coord.q, hex.coord.r, HEX_SIZE);
      hexPositions.push({ hex, cx: pos.x, cy: pos.y });
    }

    // 2. Compute vertex positions directly from stored unit-space positions
    for (const vertex of gameState.board.vertices) {
      if (!vertex.position) continue;
      vertexPixels.set(vertex.id, {
        x: vertex.position.x * HEX_SIZE,
        y: vertex.position.y * HEX_SIZE,
      });
    }

    // Compute bounds for viewBox
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { cx, cy } of hexPositions) {
      minX = Math.min(minX, cx - HEX_SIZE);
      minY = Math.min(minY, cy - HEX_SIZE);
      maxX = Math.max(maxX, cx + HEX_SIZE);
      maxY = Math.max(maxY, cy + HEX_SIZE);
    }

    // Compute beach border — draw slightly oversized hex shapes to create beach outline
    const beachHexPaths: string[] = [];
    for (const { cx, cy } of hexPositions) {
      const points = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 180) * (60 * i);
        const x = cx + (HEX_SIZE + 6) * Math.cos(angle);
        const y = cy + (HEX_SIZE + 6) * Math.sin(angle);
        return `${x},${y}`;
      }).join(" ");
      beachHexPaths.push(points);
    }

    return {
      hexPositions,
      vertexPixels,
      beachHexPaths,
      viewBox: {
        x: minX - PADDING,
        y: minY - PADDING,
        width: maxX - minX + PADDING * 2,
        height: maxY - minY + PADDING * 2,
      },
    };
  }, [gameState.board]);

  // Determine valid placements
  const isSetup = gameState.phase === GamePhase.SetupForward || gameState.phase === GamePhase.SetupReverse;
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;

  // Get player color map
  const playerColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const player of gameState.players) {
      map.set(player.id, player.color);
    }
    return map;
  }, [gameState.players]);

  // Click handlers
  const handleVertexClick = (vertexId: number) => {
    if (!isMyTurn) return;

    if (isSetup) {
      sendAction({ type: "SETUP_PLACE_SETTLEMENT", vertexId });
    } else if (selectedAction === "settlement") {
      sendAction({ type: "BUILD_SETTLEMENT", vertexId });
    } else if (selectedAction === "city") {
      sendAction({ type: "BUILD_CITY", vertexId });
    }
  };

  const handleEdgeClick = (edgeId: number) => {
    if (!isMyTurn) return;
    const store = useGameStore.getState();

    if (isSetup) {
      sendAction({ type: "SETUP_PLACE_ROAD", edgeId });
    } else if (store.selectedAction === "roadBuilding") {
      const myPlayer = gameState.players.find((p) => p.id === playerId);
      const onlyOneRoadLeft = myPlayer ? myPlayer.roadsRemaining <= 1 : false;

      // Client-side validation: check edge is valid for road placement
      const validEdges = getValidRoadEdges(gameState, playerId!, false, undefined, true);
      // Also consider edges adjacent to the first optimistic road
      const firstEdge = store.roadBuildingEdges[0];
      let isValidEdge = validEdges.includes(edgeId);
      if (!isValidEdge && firstEdge !== undefined) {
        // Check if edgeId is adjacent to the first optimistic road
        const firstEdgeData = gameState.board.edges[firstEdge];
        const thisEdgeData = gameState.board.edges[edgeId];
        if (firstEdgeData && thisEdgeData && !thisEdgeData.road) {
          const firstVertices = new Set(firstEdgeData.vertexIds);
          const sharesVertex = thisEdgeData.vertexIds.some((vid) => firstVertices.has(vid));
          if (sharesVertex) {
            // Ensure the shared vertex isn't blocked by opponent building
            const sharedVid = thisEdgeData.vertexIds.find((vid) => firstVertices.has(vid))!;
            const sharedVertex = gameState.board.vertices[sharedVid];
            const blocked = sharedVertex?.building !== null && sharedVertex?.building?.playerId !== playerId;
            if (!blocked) isValidEdge = true;
          }
        }
      }

      if (!isValidEdge) {
        store.setError("Invalid road location");
        return;
      }

      const edges = [...store.roadBuildingEdges, edgeId];

      if (edges.length >= 2 || (edges.length === 1 && onlyOneRoadLeft)) {
        sendAction({
          type: "PLAY_ROAD_BUILDING",
          edgeId1: edges[0],
          ...(edges[1] !== undefined ? { edgeId2: edges[1] } : {}),
        });
        store.setSelectedAction(null);
        store.setRoadBuildingEdges([]);
      } else {
        store.setRoadBuildingEdges(edges);
      }
    } else if (store.selectedAction === "road") {
      sendAction({ type: "BUILD_ROAD", edgeId });
    }
  };

  const handleHexClick = (hexId: number) => {
    if (!isMyTurn) return;

    const store = useGameStore.getState();
    const isRobbing = gameState.turnPhase === TurnPhase.Robbing;
    const isKnight = store.pendingKnight;

    if (!isRobbing && !isKnight) return;
    if (hexId === gameState.board.robberHexId) return;

    // Compute steal targets for the chosen hex
    const targets = new Set<string>();
    for (const vertex of gameState.board.vertices) {
      if (!vertex.hexIds.includes(hexId)) continue;
      if (!vertex.building) continue;
      if (vertex.building.playerId === playerId) continue;
      const player = gameState.players.find(p => p.id === vertex.building!.playerId);
      if (player && Object.values(player.resources).some(n => n > 0)) {
        targets.add(vertex.building.playerId);
      }
    }
    const stealTargets = Array.from(targets);

    if (stealTargets.length <= 1) {
      const stealFromPlayerId = stealTargets.length === 1 ? stealTargets[0] : undefined;
      if (isKnight) {
        sendAction({ type: "PLAY_KNIGHT", hexId, stealFromPlayerId });
        store.clearRobberState();
      } else {
        sendAction({ type: "MOVE_ROBBER", hexId, stealFromPlayerId });
      }
    } else {
      // Multiple targets — show steal picker in ActionPanel
      store.setPendingRobberHex(hexId);
      store.setPendingStealTargets(stealTargets);
      store.setPendingRobberAction(isKnight ? "knight" : "robber");
      if (isKnight) store.setPendingKnight(false);
    }
  };

  return (
    <svg
      viewBox={`${layout.viewBox.x} ${layout.viewBox.y} ${layout.viewBox.width} ${layout.viewBox.height}`}
      className="w-full h-full max-h-[50vh] md:max-h-[70vh]"
      style={{ background: "#1a5276" }}
    >
      {/* Water background is the SVG background color */}

      {/* Beach border — oversized hex shapes */}
      {layout.beachHexPaths.map((points, i) => (
        <polygon
          key={`beach-${i}`}
          points={points}
          fill="#f4d9a0"
          stroke="none"
        />
      ))}

      {/* Hex tiles */}
      {layout.hexPositions.map(({ hex, cx, cy }) => {
        const isHexClickable = isMyTurn && (gameState.turnPhase === TurnPhase.Robbing || useGameStore.getState().pendingKnight);
        return (
          <g key={`hex-${hex.id}`} onClick={() => handleHexClick(hex.id)} className={isHexClickable ? "cursor-pointer" : ""}>
            <HexTile hex={hex} cx={cx} cy={cy} size={HEX_SIZE} />
          </g>
        );
      })}

      {/* Edges (roads) */}
      {gameState.board.edges.map((edge) => {
        const p1 = layout.vertexPixels.get(edge.vertexIds[0]);
        const p2 = layout.vertexPixels.get(edge.vertexIds[1]);
        if (!p1 || !p2) return null;

        const isValidRoad = isMyTurn && (selectedAction === "road" || selectedAction === "roadBuilding" || isSetup);

        // Optimistic render for road building: show first road immediately
        const { roadBuildingEdges } = useGameStore.getState();
        const isOptimisticRoad = !edge.road && roadBuildingEdges.includes(edge.id);
        const roadColor = edge.road
          ? playerColorMap.get(edge.road.playerId)
          : isOptimisticRoad
            ? playerColorMap.get(playerId!)
            : undefined;

        return (
          <EdgeComponent
            key={`edge-${edge.id}`}
            edge={edge}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            color={roadColor}
            isValid={isValidRoad}
            isSelectable={isValidRoad}
            onClick={() => handleEdgeClick(edge.id)}
          />
        );
      })}

      {/* Vertices (settlements/cities) */}
      {gameState.board.vertices.map((vertex) => {
        const pos = layout.vertexPixels.get(vertex.id);
        if (!pos) return null;

        let isValidForVertex = false;
        if (isMyTurn) {
          if (isSetup && !vertex.building) {
            isValidForVertex = true;
          } else if (selectedAction === "settlement" && !vertex.building) {
            isValidForVertex = true;
          } else if (selectedAction === "city" && vertex.building?.type === BuildingType.Settlement && vertex.building?.playerId === playerId) {
            isValidForVertex = true;
          }
        }

        // Replace playerId with actual color for rendering
        const vertexWithColor = vertex.building
          ? {
              ...vertex,
              building: {
                ...vertex.building,
                playerId: playerColorMap.get(vertex.building.playerId) || vertex.building.playerId,
              },
            }
          : vertex;

        return (
          <VertexComponent
            key={`vertex-${vertex.id}`}
            vertex={vertexWithColor}
            cx={pos.x}
            cy={pos.y}
            size={HEX_SIZE}
            isValid={isValidForVertex}
            isSelectable={isValidForVertex}
            onClick={() => handleVertexClick(vertex.id)}
          />
        );
      })}

      {/* Harbors — dock lines + badges at edge midpoints */}
      {(() => {
        const harborData: {
          harbor: HarborType;
          mx: number; my: number;
          v1x: number; v1y: number;
          v2x: number; v2y: number;
        }[] = [];
        for (const edge of gameState.board.edges) {
          const v1 = gameState.board.vertices[edge.vertexIds[0]];
          const v2 = gameState.board.vertices[edge.vertexIds[1]];
          if (v1.harbor && v1.harbor === v2.harbor) {
            const p1 = layout.vertexPixels.get(v1.id);
            const p2 = layout.vertexPixels.get(v2.id);
            if (!p1 || !p2) continue;

            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            const dx = mx;
            const dy = my;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const offsetDist = HEX_SIZE * 0.9;

            harborData.push({
              harbor: v1.harbor,
              mx: mx + (dx / dist) * offsetDist,
              my: my + (dy / dist) * offsetDist,
              v1x: p1.x, v1y: p1.y,
              v2x: p2.x, v2y: p2.y,
            });
          }
        }

        return harborData.map((h, i) => {
          const color = HARBOR_COLORS[h.harbor];
          return (
            <g key={`harbor-${i}`}>
              {/* Dock lines from harbor badge to each vertex */}
              <line
                x1={h.mx} y1={h.my} x2={h.v1x} y2={h.v1y}
                stroke={color} strokeWidth={2} strokeDasharray="4,3" opacity={0.7}
              />
              <line
                x1={h.mx} y1={h.my} x2={h.v2x} y2={h.v2y}
                stroke={color} strokeWidth={2} strokeDasharray="4,3" opacity={0.7}
              />
              {/* Small dock dots on the vertices */}
              <circle cx={h.v1x} cy={h.v1y} r={4} fill={color} opacity={0.6} pointerEvents="none" />
              <circle cx={h.v2x} cy={h.v2y} r={4} fill={color} opacity={0.6} pointerEvents="none" />
              {/* Harbor badge */}
              <Harbor harborType={h.harbor} cx={h.mx} cy={h.my} size={HEX_SIZE} />
            </g>
          );
        });
      })()}
    </svg>
  );
}
