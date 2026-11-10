import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import {
  actionTypes,
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
const adminUser = process.env.ADMIN_USER ?? "admin";
const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "marcador-server" });
});

app.use(express.json());
app.use((_request, response, next) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});

app.options("*", (_request, response) => response.sendStatus(204));

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
  const matchId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
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
    if (client.readyState === client.OPEN) {
    client.send(serializedMessage);
    }
  }
}

function handleAction(matchId, action, canEdit) {
  if (!canEdit) return;
  if (!isScoreAction(action)) return;

  const matchState = getMatch(matchId);
  let nextMatch = matchState;

  if (action.type === actionTypes.resetScore) {
    nextMatch = {
    ...matchState,
    home: { ...matchState.home, score: 0 },
    away: { ...matchState.away, score: 0 }
    };
  } else if (action.type === actionTypes.updateTeams) {
    const homeName = action.homeName?.trim();
    const awayName = action.awayName?.trim();
    if (!homeName || !awayName || homeName.length > 40 || awayName.length > 40) {
    return;
    }
    nextMatch = {
    ...matchState,
    home: { ...matchState.home, name: homeName },
    away: { ...matchState.away, name: awayName }
    };
  } else if (action.team === "home" || action.team === "away") {
    nextMatch = {
      ...matchState,
      [action.team]: {
        ...matchState[action.team],
        score: Math.max(
          0,
          matchState[action.team].score +
            (action.type === actionTypes.incrementScore ? 1 : -1)
        )
      }
    };
  } else {
    return;
  }

  nextMatch = { ...nextMatch, updatedAt: new Date().toISOString() };
  matches.set(matchId, nextMatch);
  broadcast(matchId, { type: "MATCH_STATE", payload: nextMatch });
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
      socket.send(
        JSON.stringify({
          type: "ERROR",
          message: "El mensaje recibido no es JSON válido."
        })
      );
    }
  });
  socket.on("close", () => clients.delete(socket));
});

server.listen(port, () => {
  console.log(`Marcador server escuchando en http://localhost:${port}`);
});
