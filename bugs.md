## Error Type
Runtime TypeError

## Error Message
can't access property "x", vertex.position is undefined


    at HexGrid.useMemo[layout] (src/components/board/HexGrid.tsx:49:9)
    at HexGrid (src/components/board/HexGrid.tsx:36:25)
    at Home (src/app/page.tsx:154:11)

## Code Frame
  47 |     for (const vertex of gameState.board.vertices) {
  48 |       vertexPixels.set(vertex.id, {
> 49 |         x: vertex.position.x * HEX_SIZE,
     |         ^
  50 |         y: vertex.position.y * HEX_SIZE,
  51 |       });
  52 |     }

Next.js version: 16.1.6 (Turbopack)
