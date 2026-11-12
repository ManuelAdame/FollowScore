import express from "express";
import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";
import {
  actionTypes,
  createMatchState,
  getPeriodDuration,
  getPeriodLabel,
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
  let nextMatch = match;

  if (action.type === actionTypes.changeScore) {
    if (
      (action.team !== "home" && action.team !== "away") ||
      !Number.isInteger(action.delta) ||
      ![-3, -2, -1, 1, 2, 3].includes(action.delta)
    ) return;
    nextMatch = {
      ...match,
      [action.team]: {
        ...match[action.team],
        score: Math.max(0, match[action.team].score + action.delta)
      }
    };
  } else if (action.type === actionTypes.changeFouls) {
    if (
      (action.team !== "home" && action.team !== "away") ||
      !Number.isInteger(action.delta) ||
      ![-1, 1].includes(action.delta)
    ) return;
    nextMatch = {
      ...match,
      [action.team]: {
        ...match[action.team],
        fouls: Math.max(0, Math.min(5, match[action.team].fouls + action.delta))
      }
    };
  } else if (action.type === actionTypes.resetScore) {
    nextMatch = {
      ...match,
      home: { ...match.home, score: 0 },
      away: { ...match.away, score: 0 }
    };
  } else if (action.type === actionTypes.resetFouls) {
    nextMatch = {
      ...match,
      home: { ...match.home, fouls: 0 },
      away: { ...match.away, fouls: 0 }
    };
  } else if (action.type === actionTypes.updateTeams) {
    const homeName = action.homeName?.trim();
    const awayName = action.awayName?.trim();
    if (!homeName || !awayName || homeName.length > 40 || awayName.length > 40) return;
    nextMatch = {
      ...match,
      home: { ...match.home, name: homeName },
      away: { ...match.away, name: awayName }
    };
  } else if (action.type === actionTypes.updateOverlay) {
    const header = action.header?.trim();
    const footer = action.footer?.trim();
    if (!header || !footer || header.length > 80 || footer.length > 80) return;
    nextMatch = {
      ...match,
      overlay: { header, footer }
    };
  } else if (action.type === actionTypes.startClock) {
    nextMatch = { ...match, clockRunning: true };
  } else if (action.type === actionTypes.stopClock) {
    nextMatch = { ...match, clockRunning: false };
  } else if (action.type === actionTypes.resetClock) {
    nextMatch = {
      ...match,
      clockSeconds: getPeriodDuration(match.period),
      clockRunning: false
    };
  } else if (action.type === actionTypes.nextPeriod) {
    const period = match.period + 1;
    nextMatch = {
      ...match,
      period,
      periodLabel: getPeriodLabel(period),
      clockSeconds: getPeriodDuration(period),
      clockRunning: false,
      home: { ...match.home, fouls: 0 },
      away: { ...match.away, fouls: 0 }
    };
  } else {
    return;
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
