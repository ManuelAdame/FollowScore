import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import {
  actionTypes,
  applyMatchAction,
  createMatchState,
  initialMatchState,
  isScoreAction
} from "@marcador/shared";

const port = Number(process.env.PORT ?? 3001);
const app = express();
const server = http.createServer(app);
const webSocketServer = new WebSocketServer({ server, path: "/ws" });
const matches = new Map([["demo", structuredClone(initialMatchState)]]);
const clientsByMatch = new Map();
const sessions = new Set();
const announcementTimers = new Map();
const adminUser = process.env.ADMIN_USER ?? "admin";
const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";

app.use(express.json());
app.use((_request, response, next) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});
app.options("*", (_request, response) => response.sendStatus(204));

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "marcador-server" });
});

function isAuthenticated(request) {
  const token = request.headers.authorization?.replace("Bearer ", "");
  return Boolean(token && sessions.has(token));
}

app.post("/auth/login", (request, response) => {
  const { username, password } = request.body ?? {};
  if (username !== adminUser || password !== adminPassword) {
    response.status(401).json({ message: "Usuario o contraseña incorrectos." });
    return;
  }
  const token = crypto.randomBytes(32).toString("hex");
  sessions.add(token);
  response.json({ token });
});

app.post("/matches", (request, response) => {
  if (!isAuthenticated(request)) {
    response.status(401).json({ message: "Necesitas iniciar sesión." });
    return;
  }
  const matchId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const match = createMatchState(matchId);
  matches.set(matchId, match);
  response.status(201).json(match);
});

function getMatch(matchId) {
  if (!matches.has(matchId)) matches.set(matchId, createMatchState(matchId));
  return matches.get(matchId);
}

function broadcast(matchId, message) {
  const serializedMessage = JSON.stringify(message);
  for (const client of clientsByMatch.get(matchId) ?? []) {
    if (client.readyState === client.OPEN) client.send(serializedMessage);
  }
}

function publishMatch(matchId, match) {
  const nextMatch = { ...match, updatedAt: new Date().toISOString() };
  matches.set(matchId, nextMatch);
  broadcast(matchId, { type: "MATCH_STATE", payload: nextMatch });
}

function handleAction(matchId, action, canEdit) {
  if (!canEdit || !isScoreAction(action)) return;
  const match = getMatch(matchId);
  const nextMatch = applyMatchAction(match, action);
  if (!nextMatch) return;
  if (
    action.type === actionTypes.registerBasket ||
    action.type === actionTypes.registerPersonalFoul
  ) {
    if (announcementTimers.has(matchId)) clearTimeout(announcementTimers.get(matchId));
    const timer = setTimeout(() => {
      const currentMatch = getMatch(matchId);
      if (currentMatch.basketAnnouncement) {
        publishMatch(matchId, { ...currentMatch, basketAnnouncement: null });
      }
      announcementTimers.delete(matchId);
    }, 5000);
    announcementTimers.set(matchId, timer);
  }

  publishMatch(matchId, nextMatch);
}

webSocketServer.on("connection", (socket, request) => {
  const query = new URL(request.url, "http://localhost").searchParams;
  const matchId = query.get("matchId") || "demo";
  const canEdit = sessions.has(query.get("token"));
  const clients = clientsByMatch.get(matchId) ?? new Set();
  clients.add(socket);
  clientsByMatch.set(matchId, clients);
  socket.send(JSON.stringify({ type: "MATCH_STATE", payload: getMatch(matchId) }));

  socket.on("message", (rawMessage) => {
    try {
      handleAction(matchId, JSON.parse(rawMessage.toString()), canEdit);
    } catch {
      socket.send(JSON.stringify({ type: "ERROR", message: "Mensaje no válido." }));
    }
  });
  socket.on("close", () => clients.delete(socket));
});

server.listen(port, () => {
  setInterval(() => {
    for (const [matchId, match] of matches) {
      if (!match.clockRunning || match.clockSeconds <= 0) continue;
      const clockSeconds = match.clockSeconds - 1;
      publishMatch(matchId, { ...match, clockSeconds, clockRunning: clockSeconds > 0 });
    }
  }, 1000);
  console.log(`Marcador server escuchando en http://localhost:${port}`);
});
