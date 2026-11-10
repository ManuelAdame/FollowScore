import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { actionTypes, initialMatchState } from "@marcador/shared";
import "./styles.css";

const serverUrl = `http://${window.location.hostname}:3001`;
const socketUrl = `ws://${window.location.hostname}:3001/ws`;
const pathParts = window.location.pathname.split("/").filter(Boolean);
const matchId = pathParts[1] || "demo";
const isOverlay = window.location.pathname.startsWith("/overlay");

function getToken() {
  return window.localStorage.getItem("marcador-token");
}

function useMatchSocket() {
  const [match, setMatch] = useState(initialMatchState);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    let reconnectTimer;
    let disposed = false;

    function connect() {
      const token = getToken();
      const tokenQuery = token && !isOverlay ? `&token=${encodeURIComponent(token)}` : "";
      const socket = new WebSocket(
        `${socketUrl}?matchId=${encodeURIComponent(matchId)}${tokenQuery}`
      );
      socketRef.current = socket;

      socket.addEventListener("open", () => setConnected(true));
      socket.addEventListener("close", () => {
        setConnected(false);
        if (!disposed) reconnectTimer = setTimeout(connect, 2000);
      });
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "MATCH_STATE") setMatch(message.payload);
      });
    }

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, []);

  function sendAction(type, teamOrPayload) {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;
    const payload =
      typeof teamOrPayload === "string"
        ? { type, team: teamOrPayload }
        : { type, ...teamOrPayload };
    socketRef.current.send(JSON.stringify(payload));
  }

  return { match, connected, sendAction };
}

function ConnectionStatus({ connected }) {
  return (
    <span className={connected ? "status online" : "status"}>
      <span className="status-dot" />
      {connected ? "Conectado" : "Conectando..."}
    </span>
  );
}

function MatchScore({ match, compact = false }) {
  return (
    <section className={`scoreboard ${compact ? "compact" : ""}`}>
      {["home", "away"].map((team) => (
        <article className="team" key={team}>
          <span className="team-label">{team === "home" ? "LOCAL" : "VISITANTE"}</span>
          <h2>{match[team].name}</h2>
          <strong>{match[team].score}</strong>
        </article>
      ))}
    </section>
  );
}

function ControlPage({ match, connected, sendAction, onLogout }) {
  const [homeName, setHomeName] = useState(match.home.name);
  const [awayName, setAwayName] = useState(match.away.name);

  useEffect(() => {
    setHomeName(match.home.name);
    setAwayName(match.away.name);
  }, [match.home.name, match.away.name]);

  function saveNames(event) {
    event.preventDefault();
    sendAction(actionTypes.updateTeams, { homeName, awayName });
  }

  async function createMatch() {
    const response = await fetch(`${serverUrl}/matches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (!response.ok) {
      onLogout();
      return;
    }
    const createdMatch = await response.json();
    window.location.href = `/control/${createdMatch.matchId}`;
  }

  return (
    <main className="control-page">
      <header className="app-header">
        <div>
          <p className="eyebrow">PANEL DE CONTROL · SALA {match.matchId}</p>
          <h1>Marcador en tiempo real</h1>
        </div>
        <div className="header-actions">
          <ConnectionStatus connected={connected} />
          <button onClick={onLogout}>Cerrar sesión</button>
        </div>
      </header>

      <MatchScore match={match} />

      <section className="control-card">
        <div>
          <h2>Controles rápidos</h2>
          <p>Los cambios se reflejan al instante en el overlay de OBS.</p>
        </div>
        <div className="team-controls">
          {["home", "away"].map((team) => (
            <div className="team-control" key={team}>
              <span>{match[team].name}</span>
              <div>
                <button
                  aria-label={`Restar punto a ${match[team].name}`}
                  onClick={() => sendAction(actionTypes.decrementScore, team)}
                >
                  −
                </button>
                <button
                  className="primary"
                  aria-label={`Sumar punto a ${match[team].name}`}
                  onClick={() => sendAction(actionTypes.incrementScore, team)}
                >
                  + Punto
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          className="reset"
          onClick={() => sendAction(actionTypes.resetScore)}
        >
          Reiniciar marcador
        </button>
      </section>

      <form className="control-card match-settings" onSubmit={saveNames}>
        <div>
          <h2>Datos del partido</h2>
          <p>Cambia los nombres que verán los espectadores en el overlay.</p>
        </div>
        <label>
          Equipo local
          <input value={homeName} maxLength="40" onChange={(event) => setHomeName(event.target.value)} />
        </label>
        <label>
          Equipo visitante
          <input value={awayName} maxLength="40" onChange={(event) => setAwayName(event.target.value)} />
        </label>
        <button className="primary" type="submit">Guardar nombres</button>
      </form>

      <aside className="obs-help">
        <div>
          <span className="eyebrow">URL PARA OBS</span>
          <code>{window.location.origin}/overlay/{match.matchId}</code>
        </div>
        <div className="obs-actions">
          <button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/overlay/${match.matchId}`)}>
            Copiar URL
          </button>
          <button className="primary" onClick={createMatch}>Nuevo partido</button>
        </div>
      </aside>
    </main>
  );
}

function OverlayPage({ match }) {
  return (
    <main className="overlay-page">
      <div className="overlay-score">
        <div className="overlay-title">PARTIDO EN DIRECTO</div>
        <MatchScore match={match} compact />
      </div>
    </main>
  );
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    const response = await fetch(`${serverUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }
    const { token } = await response.json();
    window.localStorage.setItem("marcador-token", token);
    onLogin();
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <p className="eyebrow">MARCADOR EN TIEMPO REAL</p>
        <h1>Acceso al panel</h1>
        <p>El overlay de OBS no necesita iniciar sesión.</p>
        <label>
          Usuario
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary" type="submit">Entrar</button>
      </form>
    </main>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(getToken()));
  const { match, connected, sendAction } = useMatchSocket();

  function logout() {
    window.localStorage.removeItem("marcador-token");
    setAuthenticated(false);
  }

  if (!isOverlay && !authenticated) return <LoginPage onLogin={() => setAuthenticated(true)} />;

  return isOverlay ? (
    <OverlayPage match={match} />
  ) : (
    <ControlPage
      match={match}
      connected={connected}
      sendAction={sendAction}
      onLogout={logout}
    />
  );
}

createRoot(document.getElementById("root")).render(<App />);
