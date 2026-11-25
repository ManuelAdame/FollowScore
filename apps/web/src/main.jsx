import React, { useEffect, useId, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { actionTypes, getTennisPointLabel, initialMatchState } from "@marcador/shared";
import "./styles.css";

const serverUrl = `http://${window.location.hostname}:3001`;
const socketUrl = `ws://${window.location.hostname}:3001/ws`;
const pathParts = window.location.pathname.split("/").filter(Boolean);
const matchId = pathParts[1] || "demo";
const isOverlay = window.location.pathname.startsWith("/overlay");
const countryFlags = [
  ["ES", "España", "🇪🇸"], ["AR", "Argentina", "🇦🇷"], ["MX", "México", "🇲🇽"], ["US", "Estados Unidos", "🇺🇸"],
  ["FR", "Francia", "🇫🇷"], ["IT", "Italia", "🇮🇹"], ["GB", "Reino Unido", "🇬🇧"], ["DE", "Alemania", "🇩🇪"],
  ["PT", "Portugal", "🇵🇹"], ["BR", "Brasil", "🇧🇷"], ["CL", "Chile", "🇨🇱"], ["UY", "Uruguay", "🇺🇾"],
  ["CO", "Colombia", "🇨🇴"], ["NL", "Países Bajos", "🇳🇱"], ["SE", "Suecia", "🇸🇪"], ["JP", "Japón", "🇯🇵"]
];

const countryFlagArt = {
  ES: <><rect width="30" height="20" fill="#aa151b" /><rect y="5" width="30" height="10" fill="#f1bf00" /><rect x="7" y="8" width="2" height="4" fill="#aa151b" /></>,
  AR: <><rect width="30" height="20" fill="#74acdf" /><rect y="6.67" width="30" height="6.66" fill="#fff" /><circle cx="15" cy="10" r="2" fill="#f6b40e" /></>,
  MX: <><rect width="10" height="20" fill="#006847" /><rect x="10" width="10" height="20" fill="#fff" /><rect x="20" width="10" height="20" fill="#ce1126" /><circle cx="15" cy="10" r="2" fill="#9d7b35" /></>,
  US: <>{Array.from({ length: 13 }, (_, index) => <rect key={index} y={index * 20 / 13} width="30" height={20 / 13} fill={index % 2 === 0 ? "#b22234" : "#fff"} />)}<rect width="13" height="10.8" fill="#3c3b6e" /><g fill="#fff">{[0, 1, 2].map((row) => [0, 1, 2].map((column) => <circle key={`${row}-${column}`} cx={2 + column * 4} cy={2 + row * 3} r=".55" />))}</g></>,
  FR: <><rect width="10" height="20" fill="#002395" /><rect x="10" width="10" height="20" fill="#fff" /><rect x="20" width="10" height="20" fill="#ed2939" /></>,
  IT: <><rect width="10" height="20" fill="#009246" /><rect x="10" width="10" height="20" fill="#fff" /><rect x="20" width="10" height="20" fill="#ce2b37" /></>,
  GB: <><rect width="30" height="20" fill="#012169" /><path d="M0 0 30 20M30 0 0 20" stroke="#fff" strokeWidth="5" /><path d="M0 0 30 20M30 0 0 20" stroke="#c8102e" strokeWidth="2" /><path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="7" /><path d="M15 0v20M0 10h30" stroke="#c8102e" strokeWidth="3" /></>,
  DE: <><rect width="30" height="6.67" fill="#000" /><rect y="6.67" width="30" height="6.66" fill="#d00" /><rect y="13.33" width="30" height="6.67" fill="#ffce00" /></>,
  PT: <><rect width="12" height="20" fill="#046a38" /><rect x="12" width="18" height="20" fill="#da291c" /><circle cx="12" cy="10" r="3" fill="#ffcd00" /></>,
  BR: <><rect width="30" height="20" fill="#009739" /><path d="m15 2 12 8-12 8L3 10z" fill="#ffdf00" /><circle cx="15" cy="10" r="4" fill="#002776" /></>,
  CL: <><rect width="30" height="10" fill="#fff" /><rect y="10" width="30" height="10" fill="#d52b1e" /><rect width="10" height="10" fill="#0039a6" /><polygon points="5,1.5 6,4 8.7,4 6.5,5.6 7.3,8.2 5,6.6 2.7,8.2 3.5,5.6 1.3,4 4,4" fill="#fff" /></>,
  UY: <><rect width="30" height="20" fill="#fff" />{[2, 6, 10, 14, 18].map((y) => <rect key={y} y={y} width="30" height="2" fill="#0038a8" />)}<circle cx="5" cy="4" r="2.1" fill="#fcd116" /></>,
  CO: <><rect width="30" height="10" fill="#fcd116" /><rect y="10" width="30" height="5" fill="#003893" /><rect y="15" width="30" height="5" fill="#ce1126" /></>,
  NL: <><rect width="30" height="6.67" fill="#ae1c28" /><rect y="6.67" width="30" height="6.66" fill="#fff" /><rect y="13.33" width="30" height="6.67" fill="#21468b" /></>,
  SE: <><rect width="30" height="20" fill="#006aa7" /><path d="M9 0v20M0 10h30" stroke="#fecc00" strokeWidth="3" /></>,
  JP: <><rect width="30" height="20" fill="#fff" /><circle cx="15" cy="10" r="5" fill="#bc002d" /></>
};

function getCountryFlagCode(flag) {
  return countryFlags.find(([code, , emoji]) => code === flag || emoji === flag)?.[0] ?? "ES";
}

function CountryFlag({ flag, secondFlag = "" }) {
  const code = getCountryFlagCode(flag);
  const countryName = countryFlags.find(([countryCode]) => countryCode === code)?.[1] ?? code;
  const secondCode = secondFlag ? getCountryFlagCode(secondFlag) : "";
  const secondCountryName = countryFlags.find(([countryCode]) => countryCode === secondCode)?.[1];
  const clipId = useId();
  return (
    <span className="tennis-flag" role="img" aria-label={`Bandera${secondCountryName ? `s de ${countryName} y ${secondCountryName}` : ` de ${countryName}`}`}>
      <svg viewBox="0 0 30 20" aria-hidden="true">
        {secondCode ? (
          <>
            <defs>
              <clipPath id={`${clipId}-left`}><rect width="15" height="20" /></clipPath>
              <clipPath id={`${clipId}-right`}><rect x="15" width="15" height="20" /></clipPath>
            </defs>
            <g clipPath={`url(#${clipId}-left)`}>{countryFlagArt[code]}</g>
            <g clipPath={`url(#${clipId}-right)`}>{countryFlagArt[secondCode]}</g>
            <path d="M13 20 17 0" stroke="#111827" strokeWidth="3" />
            <path d="M13 20 17 0" stroke="#fff" strokeWidth="1.5" />
          </>
        ) : countryFlagArt[code]}
      </svg>
    </span>
  );
}

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

function TennisScoreboard({ match, compact = false }) {
  const { tennis } = match;
  const isDeuce = !tennis.tieBreak &&
    tennis.points[0] >= 3 &&
    tennis.points[1] >= 3 &&
    tennis.points[0] === tennis.points[1];
  const isGoldenPoint = isDeuce && (
    tennis.scoringMode === "golden" ||
    (tennis.scoringMode === "star" && tennis.deuceRounds >= 2)
  );
  const setRows = Array.from({ length: 3 }, (_, index) => {
    if (index < tennis.setScores.length) return tennis.setScores[index];
    if (index === tennis.setScores.length && !tennis.winner) return tennis.games;
    return null;
  });
  return (
    <section className={`tennis-scoreboard ${compact ? "compact" : ""}`}>
      {["home", "away"].map((team, side) => (
        <div className="tennis-score-row" key={team}>
          <strong className="tennis-player-name"><CountryFlag flag={match[team].flag} secondFlag={match[team].flag2} />{match[team].name}</strong>
          {setRows.map((games, index) => <b className="tennis-set-score" key={index}>{games ? games[side] : "–"}</b>)}
          <b className={`tennis-point-score ${isGoldenPoint ? "golden-point" : ""}`}>{getTennisPointLabel(match, team)}</b>
        </div>
      ))}
    </section>
  );
}

function TennisControlPage({ match, connected, sendAction, onLogout, onNewMatch }) {
  const [homeName, setHomeName] = useState(match.home.name);
  const [awayName, setAwayName] = useState(match.away.name);
  const [homeFlag, setHomeFlag] = useState(getCountryFlagCode(match.home.flag));
  const [awayFlag, setAwayFlag] = useState(getCountryFlagCode(match.away.flag));
  const [homeFlag2, setHomeFlag2] = useState(match.home.flag2 ?? "");
  const [awayFlag2, setAwayFlag2] = useState(match.away.flag2 ?? "");
  const [overlayHeader, setOverlayHeader] = useState(match.overlay?.header ?? "");

  useEffect(() => {
    setHomeName(match.home.name);
    setAwayName(match.away.name);
    setHomeFlag(getCountryFlagCode(match.home.flag));
    setAwayFlag(getCountryFlagCode(match.away.flag));
    setHomeFlag2(match.home.flag2 ?? "");
    setAwayFlag2(match.away.flag2 ?? "");
    setOverlayHeader(match.overlay?.header ?? "");
  }, [match.home.name, match.away.name, match.home.flag, match.away.flag, match.home.flag2, match.away.flag2, match.overlay?.header]);

  function savePlayers(event) {
    event.preventDefault();
    sendAction(actionTypes.updateTennisTeams, { homeName, awayName, homeFlag, awayFlag, homeFlag2, awayFlag2 });
  }
  function saveOverlayHeader(event) {
    event.preventDefault();
    sendAction(actionTypes.updateOverlay, { header: overlayHeader });
  }

  const modeNames = {
    golden: "Punto de oro",
    advantage: "Ventaja",
    star: "Star Point (2 ventajas y después punto de oro)"
  };
  const atDeuce = match.tennis.points[0] >= 3 &&
    match.tennis.points[1] >= 3 &&
    match.tennis.points[0] === match.tennis.points[1];
  const isGoldenPoint = atDeuce && (
    match.tennis.scoringMode === "golden" ||
    (match.tennis.scoringMode === "star" && match.tennis.deuceRounds >= 2)
  );

  return (
    <main className="control-page tennis-control-page">
      <header className="app-header">
        <div><p className="eyebrow">TENIS / PÁDEL · PARTIDO AL MEJOR DE 3 SETS</p><h1>Marcador en directo</h1></div>
        <div className="header-actions"><ConnectionStatus connected={connected} /><button onClick={onLogout}>Cerrar sesión</button></div>
      </header>
      <TennisScoreboard match={match} />
      {match.tennis.winner && <div className="tennis-match-winner">Partido terminado · {match[match.tennis.winner].name} gana</div>}
      {isGoldenPoint && <div className="tennis-golden-notice">PUNTO DE ORO</div>}
      {match.tennis.tieBreak && <div className="tennis-tiebreak-notice">Tie-break · se gana con 7 puntos y diferencia de 2</div>}
      <section className="tennis-point-controls control-card">
        <div><h2>Registrar punto</h2><p>Modalidad: {modeNames[match.tennis.scoringMode]}</p></div>
        <div className="tennis-point-buttons">
          {["home", "away"].map((team) => (
            <button className="primary" disabled={Boolean(match.tennis.winner)} key={team} onClick={() => sendAction(actionTypes.addTennisPoint, { team })}>
              Punto para {match[team].name}
            </button>
          ))}
        </div>
        <button
          className="tennis-undo-button"
          disabled={!match.tennis.history?.length}
          onClick={() => sendAction(actionTypes.undoTennisPoint)}
        >
          Deshacer último punto
        </button>
      </section>
      <form className="control-card tennis-player-settings" onSubmit={savePlayers}>
        <div><h2>Jugadores / parejas y banderas</h2><p>En pádel puedes escribir los nombres de ambos integrantes en el mismo campo.</p></div>
        {["home", "away"].map((team) => (
          <div className="tennis-player-edit" key={team}>
            <label>Nombre {team === "home" ? "1" : "2"}<input value={team === "home" ? homeName : awayName} maxLength="40" onChange={(event) => team === "home" ? setHomeName(event.target.value) : setAwayName(event.target.value)} /></label>
            <label>Bandera principal<span className="tennis-flag-selector"><select value={team === "home" ? homeFlag : awayFlag} onChange={(event) => team === "home" ? setHomeFlag(event.target.value) : setAwayFlag(event.target.value)}>{countryFlags.map(([code, country]) => <option key={country} value={code}>{country}</option>)}</select><CountryFlag flag={team === "home" ? homeFlag : awayFlag} secondFlag={team === "home" ? homeFlag2 : awayFlag2} /></span></label>
            <label>Segunda bandera (opcional)<select value={team === "home" ? homeFlag2 : awayFlag2} onChange={(event) => team === "home" ? setHomeFlag2(event.target.value) : setAwayFlag2(event.target.value)}><option value="">Ninguna</option>{countryFlags.map(([code, country]) => <option key={country} value={code}>{country}</option>)}</select></label>
          </div>
        ))}
        <button className="primary" type="submit">Guardar nombres y banderas</button>
      </form>
      <form className="control-card tennis-overlay-settings" onSubmit={saveOverlayHeader}>
        <div><h2>Cabecera del overlay</h2><p>Si dejas el texto vacío, se ocultará la franja superior.</p></div>
        <label>Texto de cabecera<input value={overlayHeader} maxLength="80" onChange={(event) => setOverlayHeader(event.target.value)} /></label>
        <button className="primary" type="submit">Guardar cabecera</button>
      </form>
      <aside className="obs-help"><div><span className="eyebrow">URL PARA OBS</span><code>{window.location.origin}/overlay/{match.matchId}</code></div><div className="obs-actions"><button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/overlay/${match.matchId}`)}>Copiar URL</button><button className="primary" onClick={onNewMatch}>Nuevo partido</button></div></aside>
    </main>
  );
}

function TennisSetup({ scoringMode, onScoringModeChange, onStart, onBack }) {
  const modes = [
    { id: "golden", title: "Bola de oro", description: "El primer punto tras el 40-40 gana el juego." },
    { id: "advantage", title: "Ventajas", description: "Se necesitan dos puntos seguidos tras el 40-40." },
    { id: "star", title: "Star Point de pádel", description: "Hasta 2 ventajas; si vuelve a iguales, el siguiente punto es de oro." }
  ];
  return (
    <main className="control-page sport-selection-page">
      <header className="app-header">
        <div><p className="eyebrow">TENIS / PÁDEL</p><h1>Configura el partido</h1></div>
        <button onClick={onBack}>Volver</button>
      </header>
      <p className="tennis-format-note">Mejor de 3 sets. Cada set se gana con 6 juegos y diferencia de 2; con 6-6 se juega un tie-break a 7, con diferencia de 2.</p>
      <section className="tennis-mode-list">
        {modes.map((mode) => (
          <button className={`tennis-mode-card ${scoringMode === mode.id ? "selected" : ""}`} key={mode.id} onClick={() => onScoringModeChange(mode.id)}>
            <span className="tennis-mode-radio">{scoringMode === mode.id ? "●" : "○"}</span>
            <span><strong>{mode.title}</strong><small>{mode.description}</small></span>
          </button>
        ))}
      </section>
      <button className="primary tennis-start-button" onClick={onStart}>Crear partido</button>
    </main>
  );
}

function SportSelection({ onSelect, onCancel }) {
  const sports = [
    { id: "basketball", title: "Baloncesto", description: "Marcador, cuartos, faltas y eventos de canasta.", available: true },
    { id: "tennis-padel", title: "Tenis / Pádel", description: "Sets, juegos, banderas y modalidades de punto.", available: true },
    { id: "football", title: "Fútbol", description: "Goles, tarjetas y periodos.", available: false },
    { id: "other", title: "Otro", description: "Configura otro deporte más adelante.", available: false }
  ];

  return (
    <main className="control-page sport-selection-page">
      <header className="app-header">
        <div><p className="eyebrow">NUEVO PARTIDO</p><h1>Elige el deporte</h1></div>
        <button onClick={onCancel}>Volver</button>
      </header>
      <section className="sport-grid">
        {sports.map((sport) => (
          <button
            className={`sport-card ${sport.available ? "available" : "unavailable"}`}
            disabled={!sport.available}
            key={sport.id}
            onClick={() => onSelect(sport.id)}
          >
            <span className="sport-icon">{sport.id === "basketball" ? "🏀" : sport.id === "tennis-padel" ? "🎾" : sport.id === "football" ? "⚽" : "＋"}</span>
            <strong>{sport.title}</strong>
            <span>{sport.description}</span>
            {!sport.available && <em>Próximamente</em>}
          </button>
        ))}
      </section>
    </main>
  );
}

function ControlPage({ match, connected, sendAction, onLogout }) {
  const [showSportSelection, setShowSportSelection] = useState(false);
  const [showTennisSetup, setShowTennisSetup] = useState(false);
  const [tennisScoringMode, setTennisScoringMode] = useState("advantage");
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
  async function createMatch(sport = "basketball", scoringMode = null) {
    const response = await fetch(`${serverUrl}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ sport, scoringMode })
    });
    if (!response.ok) {
      onLogout();
      return;
    }
    const createdMatch = await response.json();
    window.location.href = `/control/${createdMatch.matchId}`;
  }
  function selectSport(sport) {
    if (sport === "tennis-padel") {
      setShowSportSelection(false);
      setShowTennisSetup(true);
      return;
    }
    createMatch(sport);
  }
  if (showSportSelection) {
    return <SportSelection onSelect={selectSport} onCancel={() => setShowSportSelection(false)} />;
  }
  if (showTennisSetup) {
    return <TennisSetup
      scoringMode={tennisScoringMode}
      onScoringModeChange={setTennisScoringMode}
      onStart={() => createMatch("tennis-padel", tennisScoringMode)}
      onBack={() => { setShowTennisSetup(false); setShowSportSelection(true); }}
    />;
  }
  if (match.sport === "tennis-padel") {
    return <TennisControlPage
      match={match}
      connected={connected}
      sendAction={sendAction}
      onLogout={onLogout}
      onNewMatch={() => setShowSportSelection(true)}
    />;
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
      <aside className="obs-help"><div><span className="eyebrow">URL PARA OBS</span><code>{window.location.origin}/overlay/{match.matchId}</code></div><div className="obs-actions"><button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/overlay/${match.matchId}`)}>Copiar URL</button><button className="primary" onClick={() => setShowSportSelection(true)}>Nuevo partido</button></div></aside>
    </main>
  );
}

function OverlayPage({ match }) {
  if (match.sport === "tennis-padel") {
    return (
      <main className="overlay-page">
        <div className="overlay-score tennis-overlay">
          {match.overlay?.header && <div className="overlay-header">{match.overlay.header}</div>}
          <TennisScoreboard match={match} compact />
          {match.tennis.winner && <div className="tennis-match-winner">{match[match.tennis.winner].name} gana el partido</div>}
          <div className="overlay-footer">{match.overlay?.footer}</div>
        </div>
      </main>
    );
  }
  return (
    <main className="overlay-page">
      <div className="overlay-score">
        {match.basketAnnouncement && <div className="basket-announcement"><strong>{match.basketAnnouncement.player}</strong><span>{match.basketAnnouncement.type === "personalFoul" ? personalFoulLabel(match.basketAnnouncement.foulNumber) : match.basketAnnouncement.points === 3 ? "TRIPLE" : `${match.basketAnnouncement.points} PUNTOS`}</span></div>}
        {match.overlay?.header && <div className="overlay-header">{match.overlay.header}</div>}
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
