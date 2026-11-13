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
  startClock: "START_CLOCK",
  stopClock: "STOP_CLOCK",
  resetClock: "RESET_CLOCK",
  nextPeriod: "NEXT_PERIOD"
};

export function isScoreAction(action) {
  return Boolean(action && Object.values(actionTypes).includes(action.type));
}

export function createMatchState(matchId) {
  return {
    ...structuredClone(initialMatchState),
    matchId
  };
}

export function applyMatchAction(match, action) {
  if (!isScoreAction(action)) return null;

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
    const header = action.header?.trim();
    const footer = action.footer?.trim();
    if (!header || !footer || header.length > 80 || footer.length > 80) return null;
    return { ...match, overlay: { header, footer } };
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

export function getPeriodDuration(period) {
  return period >= 5 ? 300 : 600;
}

export function getPeriodLabel(period) {
  return period >= 5 ? `Prórroga ${period - 4}` : `${period}.º cuarto`;
}
