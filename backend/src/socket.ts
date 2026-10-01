import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { redisSub } from "./redis";
import { CLIENT_URL } from "./config";

export function setupSocket(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: CLIENT_URL },
  });

  io.on("connection", (socket) => {
    socket.on("join_showtime", (showtimeId: string) => {
      socket.join(`showtime:${showtimeId}`);
    });
    socket.on("leave_showtime", (showtimeId: string) => {
      socket.leave(`showtime:${showtimeId}`);
    });
  });

  // One pattern-subscription covers every showtime's channel — incoming
  // messages are routed to the matching Socket.io room by channel name.
  // This is the bridge that turns "someone booked seat A5" (a Redis
  // publish, possibly from a *different* server instance) into a live
  // update on every browser tab currently looking at that showtime.
  redisSub.psubscribe("showtime:*:events");
  redisSub.on("pmessage", (_pattern, channel, message) => {
    const match = channel.match(/^showtime:(.+):events$/);
    if (!match) return;
    const showtimeId = match[1];
    io.to(`showtime:${showtimeId}`).emit("seat_event", JSON.parse(message));
  });

  return io;
}
