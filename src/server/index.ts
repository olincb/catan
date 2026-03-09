// ============================================================
// Custom Next.js Server with Socket.IO
// ============================================================

import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./socketHandlers";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: dev ? "*" : undefined,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  setupSocketHandlers(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO attached`);
  });
});
