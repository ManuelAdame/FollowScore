export const initialMatchState = {
  matchId: "demo",
  sport: "basketball",
  status: "live",
  home: { name: "Local", score: 0, fouls: 0, logo: null, players: [] },
  away: { name: "Visitante", score: 0, fouls: 0, logo: null, players: [] },
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

export function getPeriodDuration(period) {
  return period >= 5 ? 300 : 600;
}

export function getPeriodLabel(period) {
  return period >= 5 ? `Prórroga ${period - 4}` : `${period}.º cuarto`;
}
