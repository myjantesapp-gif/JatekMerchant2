import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { db, driversTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type SocketUser = {
  id: number;
  name: string;
  role: string;
};

type DriverRegisterPayload = {
  driverId?: string | number;
};

type AdminAssignmentPayload = {
  orderId?: string | number;
  driverId?: string | number;
};

const JWT_SECRET = process.env.SESSION_SECRET ?? "";
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const PRIMARY_DRIVER_ROOM = (driverId: number) => `driver_${driverId}`;
const LEGACY_DRIVER_ROOM = (driverId: number) => `driver_orders:${driverId}`;

function isAdmin(user: SocketUser): boolean {
  return user.role === "admin" || user.role === "super_admin" || user.role === "manager";
}

function parseId(value: unknown): number | null {
  const id = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isAllowedOrigin(origin: string | undefined): boolean {
  return !origin
    || origin === "https://driver.jatek.app"
    || origin === "https://admin.jatek.app"
    || /^https:\/\/.*\.replit\.dev$/.test(origin);
}

async function authenticateSocketToken(token: unknown): Promise<SocketUser | null> {
  if (typeof token !== "string" || !token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId?: unknown };
    const userId = parseId(payload.userId);
    if (!userId) return null;
    const [user] = await db
      .select({ id: usersTable.id, name: usersTable.name, role: usersTable.role, isActive: usersTable.isActive })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user || user.isActive === false) return null;
    return { id: user.id, name: user.name, role: user.role };
  } catch {
    return null;
  }
}

async function resolveDriverId(user: SocketUser, requestedId: unknown): Promise<number | null> {
  const requested = parseId(requestedId);
  if (isAdmin(user) && requested) return requested;
  if (user.role !== "driver") return null;

  const [driver] = await db
    .select({ id: driversTable.id })
    .from(driversTable)
    .where(eq(driversTable.userId, user.id))
    .limit(1);
  if (!driver) return null;
  return requested && requested !== driver.id ? null : driver.id;
}

let socketServer: Server | null = null;

/**
 * Mounts the realtime backend on the same HTTP server as Express.
 *
 * Existing route code publishes through the SSE bus. socketPublish mirrors
 * those events to Socket.IO rooms so REST/SSE clients and new driver clients
 * observe the same state transitions.
 */
export function attachSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/socket.io/",
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) callback(null, true);
        else callback(new Error("Socket origin not allowed"), false);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  socketServer = io;

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const user = await authenticateSocketToken(token);
    if (!user) {
      next(new Error("Authentication required"));
      return;
    }
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as SocketUser;

    socket.on("driver_register", async (payload: DriverRegisterPayload) => {
      const driverId = await resolveDriverId(user, payload?.driverId);
      if (!driverId) {
        socket.emit("driver_register_error", { error: "Invalid driver identity" });
        return;
      }

      socket.data.driverId = driverId;
      await socket.join(PRIMARY_DRIVER_ROOM(driverId));
      await socket.join(LEGACY_DRIVER_ROOM(driverId));
      await socket.join("drivers_available");
      io.to("admins").emit("driver_status_change", { driverId, isOnline: true });
      socket.emit("driver_registered", { driverId });
    });

    socket.on("admin_register", async () => {
      if (!isAdmin(user)) {
        socket.emit("admin_register_error", { error: "Admin role required" });
        return;
      }
      await socket.join("admins");
      socket.emit("admin_registered", { userId: user.id });
    });

    socket.on("assign_order_to_driver", (payload: AdminAssignmentPayload) => {
      if (!isAdmin(user)) return;
      const orderId = parseId(payload?.orderId);
      const driverId = parseId(payload?.driverId);
      if (!orderId || !driverId) return;
      io.to(PRIMARY_DRIVER_ROOM(driverId)).emit("order_assigned", {
        orderId,
        driverId,
        source: "admin",
      });
    });

    socket.on("disconnect", () => {
      const driverId = socket.data.driverId as number | undefined;
      if (driverId) {
        io.to("admins").emit("driver_status_change", { driverId, isOnline: false });
      }
    });
  });

  return io;
}

function getSocketRoom(channel: string): string {
  if (channel === "available_orders") return "drivers_available";
  if (channel === "admin_tracking") return "admins";
  if (channel.startsWith("driver_orders:")) {
    const id = parseId(channel.slice("driver_orders:".length));
    return id ? PRIMARY_DRIVER_ROOM(id) : channel;
  }
  if (channel.startsWith("driver:")) {
    const id = parseId(channel.slice("driver:".length));
    return id ? PRIMARY_DRIVER_ROOM(id) : channel;
  }
  return channel;
}

/** Mirrors an existing SSE event to Socket.IO subscribers. */
export function publishSocketEvent(channel: string, eventName: string, data: unknown): void {
  if (!socketServer) return;
  socketServer.to(getSocketRoom(channel)).emit(eventName, data);

  // Keep the event names from the dashboard prompt while preserving the
  // existing backend event names used by the SSE clients.
  if (channel === "admin_tracking") {
    if (eventName === "driver_location") {
      socketServer.to("admins").emit("driver_location_update", data);
    } else if (eventName === "driver_offline") {
      socketServer.to("admins").emit("driver_status_change", data);
    } else if (eventName === "order_new") {
      socketServer.to("admins").emit("order_created", data);
    } else if (eventName === "order_status" && typeof data === "object" && data !== null) {
      const status = (data as { status?: unknown }).status;
      if (status === "delivered") socketServer.to("admins").emit("order_delivered", data);
      if (status === "assigned") socketServer.to("admins").emit("order_assigned", data);
    }
  }
}

export function closeSocketServer(): void {
  socketServer?.close();
  socketServer = null;
}