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
      const socket = new WebSocket(`${socketUrl}?matchId=${encodeURIComponent(matchId)}${tokenQuery}`);
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

  function sendAction(type, payload = {}) {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type, ...payload }));
  }
  return { match, connected, sendAction };
}

function formatClock(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function formatPeriod(period) {
  return period >= 5 ? `Pr${period - 4}` : `T${period}`;
}

function ConnectionStatus({ connected }) {
  return <span className={connected ? "status online" : "status"}><span className="status-dot" />{connected ? "Conectado" : "Conectando..."}</span>;
}

function TeamLogo({ team, className = "" }) {
  return team.logo
    ? <img className={className} src={team.logo} alt={`Logo de ${team.name}`} />
    : <span className={className}>{team.name.slice(0, 3).toUpperCase()}</span>;
}

function MatchScore({ match, compact = false }) {
  return (
    <section className={`scoreboard ${compact ? "compact" : ""}`}>
      {["home", "away"].map((team) => (
        <article className="team" key={team}>
          <div className="team-heading">
            <TeamLogo team={match[team]} className={`team-badge ${team}`} />
            <span className="team-label">{team === "home" ? "LOCAL" : "VISITANTE"}</span>
          </div>
          <h2>{match[team].name}</h2>
          <strong>{match[team].score}</strong>
          <div className="team-fouls"><span>FALTAS</span><b>{match[team].fouls}</b>{match[team].fouls >= 5 && <em>BONUS</em>}</div>
        </article>
      ))}
    </section>
  );
}

function personalFoulLabel(number) {
  return `${number}ª FALTA PERSONAL`;
}

function FoulEntry({ match, sendAction, onClose }) {
    const [team, setTeam] = useState("home");
    const [player, setPlayer] = useState("");
    const players = match[team].players ?? [];

    function submit(event) {
      event.preventDefault();
      if (!player) return;
      sendAction(actionTypes.registerPersonalFoul, { team, player });
      onClose();
    }

    return (
      <section className="basket-entry control-card">
        <div className="basket-entry-header"><div><h2>Registrar falta personal</h2><p>Selecciona el equipo y el jugador que ha cometido la falta.</p></div><button onClick={onClose}>Cerrar</button></div>
        <div className="basket-team-tabs">
          {["home", "away"].map((item) => <button className={team === item ? "primary" : ""} key={item} onClick={() => { setTeam(item); setPlayer(""); }}>{match[item].name}</button>)}
        </div>
        <form className="basket-player-form foul-entry-form" onSubmit={submit}>
          <label>Jugador<select value={player} onChange={(event) => setPlayer(event.target.value)} required><option value="">Selecciona un jugador</option>{players.map((name) => <option key={name} value={name}>{name} · {match[team].personalFouls?.[name] ?? 0} faltas</option>)}</select></label>
          {players.length === 0 && <p className="form-error">Añade jugadores en la plantilla antes de registrar una falta.</p>}
          <button className="primary" type="submit" disabled={!player}>Confirmar falta</button>
        </form>
      </section>
    );
}

function BasketEntry({ match, sendAction, onClose }) {
    const [team, setTeam] = useState("home");
    const [points, setPoints] = useState(null);
    const [player, setPlayer] = useState("");
    const players = match[team].players ?? [];

    function choosePoints(value) {
      setPoints(value);
      setPlayer("");
    }

  function submit(event) {
    event.preventDefault();
    if (points && player) {
      sendAction(actionTypes.registerBasket, { team, points, player });
      onClose();
    }
  }

  return (
    <section className="basket-entry control-card">
      <div className="basket-entry-header"><div><h2>Registrar canasta</h2><p>Elige primero el tipo de tiro y después el jugador.</p></div><button onClick={onClose}>Cerrar</button></div>
      <div className="basket-team-tabs">
        {["home", "away"].map((item) => <button className={team === item ? "primary" : ""} key={item} onClick={() => { setTeam(item); setPoints(null); setPlayer(""); }}>{match[item].name}</button>)}
      </div>
      <div className="basket-types">
        {[{ value: 1, label: "Tiro libre", points: "1 punto" }, { value: 2, label: "Canasta de 2", points: "2 puntos" }, { value: 3, label: "Triple", points: "3 puntos" }].map((shot) => (
          <button className={points === shot.value ? "primary" : ""} key={shot.value} onClick={() => choosePoints(shot.value)}><strong>{shot.label}</strong><span>{shot.points}</span></button>
        ))}
      </div>
      {points && (
        <form className="basket-player-form" onSubmit={submit}>
          <label>Jugador que ha anotado<select value={player} onChange={(event) => setPlayer(event.target.value)} required><option value="">Selecciona un jugador</option>{players.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          {players.length === 0 && <p className="form-error">Añade jugadores en la plantilla antes de registrar una canasta.</p>}
          <button className="primary" type="submit" disabled={!player}>Confirmar {points} punto{points > 1 ? "s" : ""}</button>
        </form>
      )}
    </section>
  );
}

function BasketballClock({ match, sendAction }) {
  return (
    <section className="clock-card">
      <span className="team-label">BALONCESTO · {match.periodLabel.toUpperCase()}</span>
      <strong className={match.clockSeconds <= 60 ? "clock warning" : "clock"}>{formatClock(match.clockSeconds)}</strong>
      <div className="clock-actions">
        <button onClick={() => sendAction(match.clockRunning ? actionTypes.stopClock : actionTypes.startClock)}>
          {match.clockRunning ? "Pausar reloj" : "Iniciar reloj"}
        </button>
        <button onClick={() => sendAction(actionTypes.resetClock)}>Reiniciar cuarto</button>
        <button onClick={() => sendAction(actionTypes.nextPeriod)}>Siguiente cuarto</button>
      </div>
    </section>
  );
}

function ControlPage({ match, connected, sendAction, onLogout }) {
  const [showBasketEntry, setShowBasketEntry] = useState(false);
  const [showFoulEntry, setShowFoulEntry] = useState(false);
  const [homeName, setHomeName] = useState(match.home.name);
  const [awayName, setAwayName] = useState(match.away.name);
  const [homeLogo, setHomeLogo] = useState(match.home.logo ?? null);
  const [awayLogo, setAwayLogo] = useState(match.away.logo ?? null);
  const [overlayHeader, setOverlayHeader] = useState(match.overlay?.header ?? "");
  const [overlayFooter, setOverlayFooter] = useState(match.overlay?.footer ?? "");
  useEffect(() => {
    setHomeName(match.home.name);
    setAwayName(match.away.name);
    setHomeLogo(match.home.logo ?? null);
    setAwayLogo(match.away.logo ?? null);
    setOverlayHeader(match.overlay?.header ?? "");
    setOverlayFooter(match.overlay?.footer ?? "");
  }, [match.home.name, match.away.name, match.home.logo, match.away.logo, match.overlay?.header, match.overlay?.footer]);

  function saveNames(event) {
    event.preventDefault();
    sendAction(actionTypes.updateTeams, { homeName, awayName, homeLogo, awayLogo });
  }
  function readLogo(event, setLogo) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 500000) {
      event.target.value = "";
      window.alert("Elige una imagen de máximo 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => setLogo(String(reader.result)));
    reader.readAsDataURL(file);
  }
  function saveOverlay(event) {
    event.preventDefault();
    sendAction(actionTypes.updateOverlay, { header: overlayHeader, footer: overlayFooter });
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
        <div><p className="eyebrow">BALONCESTO · SALA {match.matchId}</p><h1>Marcador en tiempo real</h1></div>
        <div className="header-actions"><ConnectionStatus connected={connected} /><button onClick={onLogout}>Cerrar sesión</button></div>
      </header>
      <div className="period-banner"><span>{match.periodLabel}</span><span>{match.clockRunning ? "EN JUEGO" : "RELOJ PARADO"}</span></div>
      <MatchScore match={match} />
      <div className="entry-buttons">
        {showBasketEntry ? <BasketEntry match={match} sendAction={sendAction} onClose={() => setShowBasketEntry(false)} /> : <button className="basket-entry-button primary" onClick={() => setShowBasketEntry(true)}>Registrar canasta</button>}
        {showFoulEntry ? <FoulEntry match={match} sendAction={sendAction} onClose={() => setShowFoulEntry(false)} /> : <button className="basket-entry-button foul-entry-button" onClick={() => setShowFoulEntry(true)}>Registrar falta personal</button>}
      </div>
      <BasketballClock match={match} sendAction={sendAction} />
      <section className="control-card">
        <div><h2>Puntos</h2><p>Elige la acción correspondiente. La resta nunca baja de cero.</p></div>
        <div className="team-controls">
          {["home", "away"].map((team) => (
            <div className="team-control" key={team}>
              <span>{match[team].name}</span>
              <div className="score-buttons">
                <button onClick={() => sendAction(actionTypes.changeScore, { team, delta: -1 })}>−1</button>
                <button className="primary" onClick={() => sendAction(actionTypes.changeScore, { team, delta: 1 })}>+1</button>
                <button className="primary" onClick={() => sendAction(actionTypes.changeScore, { team, delta: 2 })}>+2</button>
                <button className="primary" onClick={() => sendAction(actionTypes.changeScore, { team, delta: 3 })}>+3</button>
              </div>
            </div>
          ))}
        </div>
        <button className="reset" onClick={() => sendAction(actionTypes.resetScore)}>Reiniciar puntos</button>
      </section>
      <section className="control-card">
        <div><h2>Faltas de equipo</h2><p>Se reinician automáticamente al pasar al siguiente cuarto.</p></div>
        <div className="team-controls">
          {["home", "away"].map((team) => (
            <div className="team-control foul-control" key={team}>
              <span>{match[team].name}<strong>{match[team].fouls}</strong></span>
              <div className="score-buttons">
                <button onClick={() => sendAction(actionTypes.changeFouls, { team, delta: -1 })}>−1</button>
                <button className="primary" onClick={() => sendAction(actionTypes.changeFouls, { team, delta: 1 })}>+1 falta</button>
              </div>
            </div>
          ))}
        </div>
        <button className="reset" onClick={() => sendAction(actionTypes.resetFouls)}>Reiniciar faltas</button>
      </section>
      <form className="control-card match-settings" onSubmit={saveNames}>
        <div><h2>Datos del partido</h2><p>Cambia los nombres que verán los espectadores.</p></div>
        <label>Equipo local<input value={homeName} maxLength="40" onChange={(event) => setHomeName(event.target.value)} /></label>
        <label>Equipo visitante<input value={awayName} maxLength="40" onChange={(event) => setAwayName(event.target.value)} /></label>
        <label>Logo local<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => readLogo(event, setHomeLogo)} /></label>
        <label>Logo visitante<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => readLogo(event, setAwayLogo)} /></label>
        <div className="logo-previews">
          <div><span>Vista previa local</span><TeamLogo team={{ name: homeName, logo: homeLogo }} className="team-badge home" /></div>
          <div><span>Vista previa visitante</span><TeamLogo team={{ name: awayName, logo: awayLogo }} className="team-badge away" /></div>
        </div>
        <button className="primary" type="submit">Guardar nombres</button>
      </form>
      <section className="control-card roster-settings">
        <div><h2>Plantilla de jugadores</h2><p>Escribe un jugador por línea. Estos nombres aparecerán al registrar una canasta.</p></div>
        {["home", "away"].map((team) => (
          <label key={team}>{match[team].name}<textarea defaultValue={(match[team].players ?? []).join("\n")} rows="5" onBlur={(event) => sendAction(actionTypes.updateRoster, { team, players: event.target.value.split("\n").map((player) => player.trim()).filter(Boolean) })} /></label>
        ))}
      </section>
      <form className="control-card overlay-settings" onSubmit={saveOverlay}>
        <div><h2>Cabecera y línea inferior</h2><p>Estos textos aparecerán en el overlay del marcador.</p></div>
        <label>Cabecera<input value={overlayHeader} maxLength="80" onChange={(event) => setOverlayHeader(event.target.value)} /></label>
        <label>Línea inferior<input value={overlayFooter} maxLength="80" onChange={(event) => setOverlayFooter(event.target.value)} /></label>
        <button className="primary" type="submit">Guardar textos</button>
      </form>
      <aside className="obs-help"><div><span className="eyebrow">URL PARA OBS</span><code>{window.location.origin}/overlay/{match.matchId}</code></div><div className="obs-actions"><button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/overlay/${match.matchId}`)}>Copiar URL</button><button className="primary" onClick={createMatch}>Nuevo partido</button></div></aside>
    </main>
  );
}

function OverlayPage({ match }) {
  return (
    <main className="overlay-page">
      <div className="overlay-score">
        {match.basketAnnouncement && <div className="basket-announcement"><strong>{match.basketAnnouncement.player}</strong><span>{match.basketAnnouncement.type === "personalFoul" ? personalFoulLabel(match.basketAnnouncement.foulNumber) : match.basketAnnouncement.points === 3 ? "TRIPLE" : `${match.basketAnnouncement.points} PUNTOS`}</span></div>}
        <div className="overlay-header">{match.overlay?.header ?? "BALONCESTO · PARTIDO EN DIRECTO"}</div>
        <div className="overlay-main">
          <div className="overlay-team"><div className="overlay-logo-stack"><TeamLogo team={match.home} className="overlay-logo home" />{match.home.fouls >= 5 && <span className="overlay-bonus">BONUS</span>}</div><strong>{match.home.name}</strong><b>{match.home.score}</b><small>F {match.home.fouls}</small></div>
          <div className="overlay-team away"><div className="overlay-logo-stack"><TeamLogo team={match.away} className="overlay-logo away" />{match.away.fouls >= 5 && <span className="overlay-bonus">BONUS</span>}</div><strong>{match.away.name}</strong><b>{match.away.score}</b><small>F {match.away.fouls}</small></div>
          <div className="overlay-period"><span>{formatPeriod(match.period)}</span></div>
          <div className="overlay-time">{formatClock(match.clockSeconds)}</div>
        </div>
        <div className="overlay-footer">{match.overlay?.footer ?? "PABELLÓN · JORNADA"}</div>
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
    const response = await fetch(`${serverUrl}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    if (!response.ok) { setError("Usuario o contraseña incorrectos."); return; }
    const { token } = await response.json();
    window.localStorage.setItem("marcador-token", token);
    onLogin();
  }
  return <main className="login-page"><form className="login-card" onSubmit={submit}><p className="eyebrow">MARCADOR EN TIEMPO REAL</p><h1>Acceso al panel</h1><p>El overlay de OBS no necesita iniciar sesión.</p><label>Usuario<input value={username} onChange={(event) => setUsername(event.target.value)} /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="form-error">{error}</p>}<button className="primary" type="submit">Entrar</button></form></main>;
}

function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(getToken()));
  const { match, connected, sendAction } = useMatchSocket();
  useEffect(() => {
    document.body.classList.toggle("overlay-mode", isOverlay);
    return () => document.body.classList.remove("overlay-mode");
  }, []);
  function logout() { window.localStorage.removeItem("marcador-token"); setAuthenticated(false); }
  if (!isOverlay && !authenticated) return <LoginPage onLogin={() => setAuthenticated(true)} />;
  return isOverlay ? <OverlayPage match={match} /> : <ControlPage match={match} connected={connected} sendAction={sendAction} onLogout={logout} />;
}

createRoot(document.getElementById("root")).render(<App />);
