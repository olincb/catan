# Catan Online

A real-time multiplayer implementation of the Settlers of Catan board game, built with Next.js and Socket.IO.

## Tech Stack

- **Framework**: Next.js 16, React 19, TypeScript
- **Real-time**: Socket.IO 4 (custom server)
- **State**: Zustand (client), server-authoritative engine
- **Styling**: Tailwind CSS
- **Testing**: Vitest

## Features

- Real-time multiplayer with room codes
- Full Catan rules: resource production, building, trading, development cards, robber
- Player-to-player and bank/maritime trading
- Session reconnection on disconnect or refresh
- Rejoin in-progress games from the lobby
- SVG-rendered board with harbors and beach border

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The custom server starts Next.js with Socket.IO attached.

## Project Structure

```
src/
├── app/            # Next.js pages and layout
├── components/     # React components (board/, ui/)
├── engine/         # Game logic (state machine, board gen, trading, building)
├── hooks/          # Socket.IO and sound hooks
├── server/         # Custom server, room management, socket handlers
└── stores/         # Zustand game store
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (custom server + hot reload) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run tests with Vitest |

## Live

🎮 **https://catan.olincb.me**

## Deployment

See [DEPLOY.md](DEPLOY.md) for Docker and Fly.io deployment instructions.
