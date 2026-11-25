export const initialMatchState = {
  matchId: "demo",
  sport: "basketball",
  status: "live",
  home: { name: "Local", score: 0, fouls: 0, logo: null, players: [], personalFouls: {} },
  away: { name: "Visitante", score: 0, fouls: 0, logo: null, players: [], personalFouls: {} },
  basketAnnouncement: null,
  overlay: { header: "BALONCESTO · PARTIDO EN DIRECTO", footer: "PABELLÓN · JORNADA" },
  period: 1,
  periodLabel: "1.º cuarto",
  clockSeconds: 600,
  clockRunning: false,
  updatedAt: null
};

export const actionTypes = {
  changeScore: "CHANGE_SCORE",
  changeFouls: "CHANGE_FOULS",
  resetScore: "RESET_SCORE",
  resetFouls: "RESET_FOULS",
  updateTeams: "UPDATE_TEAMS",
  updateRoster: "UPDATE_ROSTER",
  registerBasket: "REGISTER_BASKET",
  registerPersonalFoul: "REGISTER_PERSONAL_FOUL",
  updateOverlay: "UPDATE_OVERLAY",
  updateTennisTeams: "UPDATE_TENNIS_TEAMS",
  addTennisPoint: "ADD_TENNIS_POINT",
  undoTennisPoint: "UNDO_TENNIS_POINT",
  startClock: "START_CLOCK",
  stopClock: "STOP_CLOCK",
  resetClock: "RESET_CLOCK",
  nextPeriod: "NEXT_PERIOD"
};

export function isScoreAction(action) {
  return Boolean(action && Object.values(actionTypes).includes(action.type));
}

export function createMatchState(matchId, sport = initialMatchState.sport, options = {}) {
  const match = {
    ...structuredClone(initialMatchState),
    matchId,
    sport
  };
  if (sport !== "tennis-padel") return match;

  const scoringMode = ["golden", "advantage", "star"].includes(options.scoringMode)
    ? options.scoringMode
    : "advantage";
  return {
    ...match,
    home: { name: "Jugador/a 1", score: 0, flag: "ES" },
    away: { name: "Jugador/a 2", score: 0, flag: "ES" },
    overlay: { header: "TENIS / PÁDEL · PARTIDO EN DIRECTO", footer: "" },
    tennis: {
      scoringMode,
      setsToWin: 2,
      games: [0, 0],
      points: [0, 0],
      setScores: [],
      tieBreak: false,
      tieBreakPoints: [0, 0],
      deuceRounds: 0,
      winner: null,
      history: []
    }
  };
}

export function applyMatchAction(match, action) {
  if (!isScoreAction(action)) return null;

  if (action.type === actionTypes.updateTennisTeams) {
    if (match.sport !== "tennis-padel") return null;
    const homeName = action.homeName?.trim();
    const awayName = action.awayName?.trim();
    const validFlag = (flag) => typeof flag === "string" && /^[A-Z]{2}$/.test(flag);
    const validOptionalFlag = (flag) => flag === "" || flag === null || flag === undefined || validFlag(flag);
    if (
      !homeName ||
      !awayName ||
      homeName.length > 40 ||
      awayName.length > 40 ||
      !validFlag(action.homeFlag) ||
      !validFlag(action.awayFlag) ||
      !validOptionalFlag(action.homeFlag2) ||
      !validOptionalFlag(action.awayFlag2)
    ) return null;
    return {
      ...match,
      home: { ...match.home, name: homeName, flag: action.homeFlag, flag2: action.homeFlag2 || null },
      away: { ...match.away, name: awayName, flag: action.awayFlag, flag2: action.awayFlag2 || null }
    };
  }

  if (action.type === actionTypes.addTennisPoint) {
    if (
      match.sport !== "tennis-padel" ||
      match.tennis.winner ||
      (action.team !== "home" && action.team !== "away")
    ) return null;
    const nextMatch = applyTennisPoint(match, action.team);
    return {
      ...nextMatch,
      tennis: {
        ...nextMatch.tennis,
        history: [...(match.tennis.history ?? []), snapshotTennis(match.tennis)].slice(-100)
      }
    };
  }

  if (action.type === actionTypes.undoTennisPoint) {
    if (match.sport !== "tennis-padel" || !match.tennis.history?.length) return null;
    const history = match.tennis.history;
    return {
      ...match,
      tennis: { ...history[history.length - 1], history: history.slice(0, -1) }
    };
  }

  if (action.type === actionTypes.changeScore) {
    if (
      (action.team !== "home" && action.team !== "away") ||
      !Number.isInteger(action.delta) ||
      ![-3, -2, -1, 1, 2, 3].includes(action.delta)
    ) return null;
    return {
      ...match,
      [action.team]: {
        ...match[action.team],
        score: Math.max(0, match[action.team].score + action.delta)
      }
    };
  }

  if (action.type === actionTypes.changeFouls) {
    if (
      (action.team !== "home" && action.team !== "away") ||
      !Number.isInteger(action.delta) ||
      ![-1, 1].includes(action.delta)
    ) return null;
    return {
      ...match,
      [action.team]: {
        ...match[action.team],
        fouls: Math.max(0, Math.min(5, match[action.team].fouls + action.delta))
      }
    };
  }

  if (action.type === actionTypes.resetScore) {
    return {
      ...match,
      home: { ...match.home, score: 0 },
      away: { ...match.away, score: 0 }
    };
  }

  if (action.type === actionTypes.resetFouls) {
    return {
      ...match,
      home: { ...match.home, fouls: 0 },
      away: { ...match.away, fouls: 0 }
    };
  }

  if (action.type === actionTypes.updateTeams) {
    const homeName = action.homeName?.trim();
    const awayName = action.awayName?.trim();
    const validLogo = (logo) => logo === null || (
      typeof logo === "string" &&
      logo.length <= 700000 &&
      /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i.test(logo)
    );
    if (
      !homeName ||
      !awayName ||
      homeName.length > 40 ||
      awayName.length > 40 ||
      !validLogo(action.homeLogo ?? null) ||
      !validLogo(action.awayLogo ?? null)
    ) return null;
    return {
      ...match,
      home: { ...match.home, name: homeName, logo: action.homeLogo ?? null },
      away: { ...match.away, name: awayName, logo: action.awayLogo ?? null }
    };
  }

  if (action.type === actionTypes.updateRoster) {
    if (action.team !== "home" && action.team !== "away") return null;
    if (
      !Array.isArray(action.players) ||
      action.players.length > 30 ||
      action.players.some((player) => typeof player !== "string" || !player.trim() || player.trim().length > 40)
    ) return null;
    const players = [...new Set(action.players.map((player) => player.trim()))];
    const personalFouls = Object.fromEntries(players.map((player) => [
      player,
      match[action.team].personalFouls?.[player] ?? 0
    ]));
    return { ...match, [action.team]: { ...match[action.team], players, personalFouls } };
  }

  if (action.type === actionTypes.registerBasket) {
    const player = typeof action.player === "string" ? action.player.trim() : "";
    if (
      (action.team !== "home" && action.team !== "away") ||
      ![1, 2, 3].includes(action.points) ||
      !player ||
      !match[action.team].players?.includes(player)
    ) return null;
    return {
      ...match,
      [action.team]: { ...match[action.team], score: match[action.team].score + action.points },
      basketAnnouncement: { type: "basket", team: action.team, player, points: action.points }
    };
  }

  if (action.type === actionTypes.registerPersonalFoul) {
    const player = typeof action.player === "string" ? action.player.trim() : "";
    if (
      (action.team !== "home" && action.team !== "away") ||
      !player ||
      !match[action.team].players?.includes(player)
    ) return null;
    const personalFouls = { ...(match[action.team].personalFouls ?? {}) };
    const foulNumber = (personalFouls[player] ?? 0) + 1;
    personalFouls[player] = foulNumber;
    return {
      ...match,
      [action.team]: {
        ...match[action.team],
        fouls: Math.min(5, match[action.team].fouls + 1),
        personalFouls
      },
      basketAnnouncement: { type: "personalFoul", team: action.team, player, foulNumber }
    };
  }

  if (action.type === actionTypes.updateOverlay) {
    const header = action.header === undefined ? match.overlay.header : action.header;
    const footer = action.footer === undefined ? match.overlay.footer : action.footer;
    if (
      typeof header !== "string" ||
      typeof footer !== "string" ||
      header.length > 80 ||
      footer.length > 80
    ) return null;
    return { ...match, overlay: { header: header.trim(), footer: footer.trim() } };
  }

  if (action.type === actionTypes.startClock) return { ...match, clockRunning: true };
  if (action.type === actionTypes.stopClock) return { ...match, clockRunning: false };
  if (action.type === actionTypes.resetClock) {
    return { ...match, clockSeconds: getPeriodDuration(match.period), clockRunning: false };
  }
  if (action.type === actionTypes.nextPeriod) {
    const period = match.period + 1;
    return {
      ...match,
      period,
      periodLabel: getPeriodLabel(period),
      clockSeconds: getPeriodDuration(period),
      clockRunning: false,
      home: { ...match.home, fouls: 0 },
      away: { ...match.away, fouls: 0 }
    };
  }

  return null;
}

function snapshotTennis(tennis) {
  const { history, ...snapshot } = tennis;
  return {
    ...snapshot,
    games: [...snapshot.games],
    points: [...snapshot.points],
    setScores: snapshot.setScores.map((set) => [...set]),
    tieBreakPoints: [...snapshot.tieBreakPoints]
  };
}

function applyTennisPoint(match, team) {
  const side = team === "home" ? 0 : 1;
  const other = 1 - side;
  const tennis = match.tennis;

  if (tennis.tieBreak) {
    const tieBreakPoints = [...tennis.tieBreakPoints];
    tieBreakPoints[side] += 1;
    if (tieBreakPoints[side] >= 7 && tieBreakPoints[side] - tieBreakPoints[other] >= 2) {
      const games = side === 0 ? [7, 6] : [6, 7];
      return finishTennisSet(match, games);
    }
    return { ...match, tennis: { ...tennis, tieBreakPoints } };
  }

  const isDeuce = tennis.points[0] >= 3 &&
    tennis.points[1] >= 3 &&
    tennis.points[0] === tennis.points[1];
  const isGoldenPoint = tennis.scoringMode === "golden" ||
    (tennis.scoringMode === "star" && tennis.deuceRounds >= 2);
  if (isDeuce && isGoldenPoint) return finishTennisGame(match, side);

  const points = [...tennis.points];
  const wasAdvantage = tennis.points[0] >= 3 &&
    tennis.points[1] >= 3 &&
    tennis.points[0] !== tennis.points[1];
  points[side] += 1;

  if (points[side] >= 4 && points[side] - points[other] >= 2) {
    return finishTennisGame(match, side);
  }

  const returnedToDeuce = points[0] >= 3 && points[1] >= 3 && points[0] === points[1];
  return {
    ...match,
    tennis: {
      ...tennis,
      points,
      deuceRounds: returnedToDeuce && wasAdvantage
        ? tennis.deuceRounds + 1
        : tennis.deuceRounds
    }
  };
}

function finishTennisGame(match, winner) {
  const games = [...match.tennis.games];
  games[winner] += 1;
  if (games[0] === 6 && games[1] === 6) {
    return {
      ...match,
      tennis: { ...match.tennis, games, points: [0, 0], tieBreak: true, tieBreakPoints: [0, 0], deuceRounds: 0 }
    };
  }
  if (games[winner] >= 6 && games[winner] - games[1 - winner] >= 2) {
    return finishTennisSet(match, games);
  }
  return {
    ...match,
    tennis: { ...match.tennis, games, points: [0, 0], deuceRounds: 0 }
  };
}

function finishTennisSet(match, games) {
  const setScores = [...match.tennis.setScores, games];
  const setsWon = [
    setScores.filter(([home, away]) => home > away).length,
    setScores.filter(([home, away]) => away > home).length
  ];
  const winner = setsWon[0] >= match.tennis.setsToWin ? "home"
    : setsWon[1] >= match.tennis.setsToWin ? "away"
      : null;
  return {
    ...match,
    tennis: {
      ...match.tennis,
      games: [0, 0],
      points: [0, 0],
      setScores,
      tieBreak: false,
      tieBreakPoints: [0, 0],
      deuceRounds: 0,
      winner
    }
  };
}

export function getTennisPointLabel(match, team) {
  const side = team === "home" ? 0 : 1;
  const other = 1 - side;
  if (match.tennis.tieBreak) return String(match.tennis.tieBreakPoints[side]);
  const [pointsHome, pointsAway] = match.tennis.points;
  if (pointsHome < 3 && pointsAway < 3) return ["0", "15", "30"][match.tennis.points[side]];
  if (pointsHome < 3 || pointsAway < 3) return match.tennis.points[side] >= 3 ? "40" : ["0", "15", "30"][match.tennis.points[side]];
  if (pointsHome === pointsAway) return "40";
  return match.tennis.points[side] > match.tennis.points[other] ? "AD" : "40";
}

export function getPeriodDuration(period) {
  return period >= 5 ? 300 : 600;
}

export function getPeriodLabel(period) {
  return period >= 5 ? `Prórroga ${period - 4}` : `${period}.º cuarto`;
}
