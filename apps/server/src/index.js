import express from "express";
import http from "node:http";
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

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "marcador-server" });
});

app.use(express.json());
app.use((_request, response, next) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.post("/matches", (_request, response) => {
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

function handleAction(matchId, action) {
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
  const matchId =
    new URL(request.url, "http://localhost").searchParams.get("matchId") ||
    "demo";
  const clients = clientsByMatch.get(matchId) ?? new Set();
  clients.add(socket);
  clientsByMatch.set(matchId, clients);
  socket.send(JSON.stringify({ type: "MATCH_STATE", payload: getMatch(matchId) }));

  socket.on("message", (rawMessage) => {
    try {
    handleAction(matchId, JSON.parse(rawMessage.toString()));
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
