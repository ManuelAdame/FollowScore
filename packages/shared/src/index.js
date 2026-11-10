export const initialMatchState = {
  matchId: "demo",
  status: "live",
  home: { name: "Local", score: 0 },
  away: { name: "Visitante", score: 0 },
  updatedAt: null
};

export const actionTypes = {
  incrementScore: "INCREMENT_SCORE",
  decrementScore: "DECREMENT_SCORE",
  resetScore: "RESET_SCORE",
  updateTeams: "UPDATE_TEAMS"
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
