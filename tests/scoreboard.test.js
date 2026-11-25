import test from "node:test";
import assert from "node:assert/strict";
import {
  actionTypes,
  applyMatchAction,
  createMatchState,
  getPeriodDuration,
  getPeriodLabel,
  getTennisPointLabel,
  initialMatchState
} from "../packages/shared/src/index.js";

function matchWithRoster() {
  return {
    ...createMatchState("test"),
    home: { ...initialMatchState.home, players: ["Ana", "Luis"] },
    away: { ...initialMatchState.away, players: ["Marta"] }
  };
}

test("creates an isolated match with teams, logos, rosters and overlay text", () => {
  const match = createMatchState("match-1");

  assert.equal(match.matchId, "match-1");
  assert.deepEqual(match.home.players, []);
  assert.equal(match.home.logo, null);
  assert.equal(match.overlay.header, "BALONCESTO · PARTIDO EN DIRECTO");
  assert.notEqual(match.home, initialMatchState.home);
});

test("changes scores and never allows a negative score", () => {
  const match = createMatchState("test");
  const scored = applyMatchAction(match, {
    type: actionTypes.changeScore,
    team: "home",
    delta: 3
  });
  const reduced = applyMatchAction(scored, {
    type: actionTypes.changeScore,
    team: "home",
    delta: -3
  });

  assert.equal(scored.home.score, 3);
  assert.equal(reduced.home.score, 0);
  const clamped = applyMatchAction(reduced, {
    type: actionTypes.changeScore,
    team: "home",
    delta: -1
  });
  assert.equal(clamped.home.score, 0);
});

test("clamps team fouls between zero and five", () => {
  let match = createMatchState("test");

  for (let index = 0; index < 8; index += 1) {
    match = applyMatchAction(match, { type: actionTypes.changeFouls, team: "away", delta: 1 });
  }
  assert.equal(match.away.fouls, 5);

  for (let index = 0; index < 8; index += 1) {
    match = applyMatchAction(match, { type: actionTypes.changeFouls, team: "away", delta: -1 });
  }
  assert.equal(match.away.fouls, 0);
});

test("updates and validates team names and logos", () => {
  const match = createMatchState("test");
  const updated = applyMatchAction(match, {
    type: actionTypes.updateTeams,
    homeName: "  Halcones  ",
    awayName: "Linces",
    homeLogo: "data:image/png;base64,AAAA",
    awayLogo: null
  });

  assert.equal(updated.home.name, "Halcones");
  assert.equal(updated.home.logo, "data:image/png;base64,AAAA");
  assert.equal(applyMatchAction(match, {
    type: actionTypes.updateTeams,
    homeName: "Halcones",
    awayName: "Linces",
    homeLogo: "javascript:alert(1)",
    awayLogo: null
  }), null);
});

test("normalizes rosters and only allows registered players to score", () => {
  const match = matchWithRoster();
  const roster = applyMatchAction(match, {
    type: actionTypes.updateRoster,
    team: "home",
    players: [" Ana ", "Luis", "Ana"]
  });
  const scored = applyMatchAction(roster, {
    type: actionTypes.registerBasket,
    team: "home",
    points: 3,
    player: "Ana"
  });

  assert.deepEqual(roster.home.players, ["Ana", "Luis"]);
  assert.equal(scored.home.score, 3);
  assert.deepEqual(scored.basketAnnouncement, { type: "basket", team: "home", player: "Ana", points: 3 });
  assert.equal(applyMatchAction(roster, {
    type: actionTypes.registerBasket,
    team: "home",
    points: 2,
    player: "Invitado"
  }), null);
});

test("registers personal fouls per player and increments team fouls", () => {
  let match = matchWithRoster();

  match = applyMatchAction(match, {
    type: actionTypes.registerPersonalFoul,
    team: "home",
    player: "Ana"
  });
  match = applyMatchAction(match, {
    type: actionTypes.registerPersonalFoul,
    team: "home",
    player: "Ana"
  });
  match = applyMatchAction(match, {
    type: actionTypes.registerPersonalFoul,
    team: "home",
    player: "Ana"
  });

  assert.equal(match.home.personalFouls.Ana, 3);
  assert.equal(match.home.fouls, 3);
  assert.deepEqual(match.basketAnnouncement, {
    type: "personalFoul",
    team: "home",
    player: "Ana",
    foulNumber: 3
  });
});

test("updates overlay text and resets fouls on the next period", () => {
  const match = {
    ...createMatchState("test"),
    home: { ...initialMatchState.home, fouls: 4 },
    away: { ...initialMatchState.away, fouls: 5 }
  };
  const withText = applyMatchAction(match, {
    type: actionTypes.updateOverlay,
    header: "  FINAL  ",
    footer: " Jornada 1 "
  });
  const next = applyMatchAction(withText, { type: actionTypes.nextPeriod });

  assert.deepEqual(withText.overlay, { header: "FINAL", footer: "Jornada 1" });
  assert.equal(next.periodLabel, "2.º cuarto");
  assert.equal(next.clockSeconds, getPeriodDuration(2));
  assert.equal(next.home.fouls, 0);
  assert.equal(next.away.fouls, 0);
});

test("uses five-minute periods for overtime labels", () => {
  assert.equal(getPeriodLabel(5), "Prórroga 1");
  assert.equal(getPeriodDuration(5), 300);
});

function tennisMatch(scoringMode = "advantage") {
  return createMatchState("tennis-test", "tennis-padel", { scoringMode });
}

function scorePoints(match, team, count) {
  for (let index = 0; index < count; index += 1) {
    match = applyMatchAction(match, { type: actionTypes.addTennisPoint, team });
  }
  return match;
}

test("creates tennis/padel matches with best-of-three scoring options", () => {
  const match = tennisMatch("star");

  assert.equal(match.sport, "tennis-padel");
  assert.equal(match.tennis.scoringMode, "star");
  assert.equal(match.tennis.setsToWin, 2);
  assert.deepEqual(match.tennis.games, [0, 0]);
  assert.deepEqual(match.tennis.points, [0, 0]);
});

test("uses 15, 30, 40 and advantage scoring", () => {
  let match = tennisMatch("advantage");
  match = scorePoints(match, "home", 3);
  match = scorePoints(match, "away", 3);

  assert.equal(getTennisPointLabel(match, "home"), "40");
  match = applyMatchAction(match, { type: actionTypes.addTennisPoint, team: "home" });
  assert.equal(match.tennis.games[0], 0);
  assert.equal(getTennisPointLabel(match, "home"), "AD");
  match = applyMatchAction(match, { type: actionTypes.addTennisPoint, team: "away" });
  assert.deepEqual(match.tennis.points, [4, 4]);
  assert.equal(match.tennis.deuceRounds, 1);
  match = scorePoints(match, "home", 2);
  assert.equal(match.tennis.games[0], 1);
  assert.deepEqual(match.tennis.points, [0, 0]);
});

test("awards golden point directly at deuce and Star Point after two advantages", () => {
  let golden = tennisMatch("golden");
  golden = scorePoints(golden, "home", 3);
  golden = scorePoints(golden, "away", 3);
  golden = applyMatchAction(golden, { type: actionTypes.addTennisPoint, team: "away" });
  assert.equal(golden.tennis.games[1], 1);

  let star = tennisMatch("star");
  star = {
    ...star,
    tennis: { ...star.tennis, points: [4, 4], deuceRounds: 2 }
  };
  star = applyMatchAction(star, { type: actionTypes.addTennisPoint, team: "home" });
  assert.equal(star.tennis.games[0], 1);
});

test("undoes the last point even when it completed a game", () => {
  let match = tennisMatch("golden");
  match = scorePoints(match, "home", 3);
  match = scorePoints(match, "away", 3);
  match = applyMatchAction(match, { type: actionTypes.addTennisPoint, team: "home" });

  assert.equal(match.tennis.games[0], 1);
  match = applyMatchAction(match, { type: actionTypes.undoTennisPoint });

  assert.deepEqual(match.tennis.games, [0, 0]);
  assert.deepEqual(match.tennis.points, [3, 3]);
  assert.equal(match.tennis.history.length, 6);
});

test("starts a tiebreak at 6-6 and completes it at 7 with a two-point lead", () => {
  let match = tennisMatch();
  match = { ...match, tennis: { ...match.tennis, games: [5, 6] } };
  match = scorePoints(match, "home", 4);
  assert.equal(match.tennis.tieBreak, true);
  assert.deepEqual(match.tennis.games, [6, 6]);

  match = { ...match, tennis: { ...match.tennis, tieBreakPoints: [6, 6] } };
  match = applyMatchAction(match, { type: actionTypes.addTennisPoint, team: "home" });
  assert.equal(match.tennis.tieBreak, true);
  assert.deepEqual(match.tennis.tieBreakPoints, [7, 6]);
  match = applyMatchAction(match, { type: actionTypes.addTennisPoint, team: "away" });
  match = scorePoints(match, "home", 2);
  assert.deepEqual(match.tennis.setScores, [[7, 6]]);
  assert.deepEqual(match.tennis.games, [0, 0]);
  assert.equal(match.tennis.tieBreak, false);
});

test("requires a two-game margin to finish a set outside the tiebreak", () => {
  let match = tennisMatch();
  match = { ...match, tennis: { ...match.tennis, games: [5, 5] } };
  match = scorePoints(match, "home", 4);
  assert.deepEqual(match.tennis.games, [6, 5]);
  assert.equal(match.tennis.setScores.length, 0);

  match = scorePoints(match, "home", 4);
  assert.deepEqual(match.tennis.setScores, [[7, 5]]);
});

test("finishes a set at six games with a two-game lead and wins after two sets", () => {
  let match = tennisMatch();
  match = {
    ...match,
    tennis: { ...match.tennis, games: [5, 4], setScores: [[6, 2]] }
  };
  match = scorePoints(match, "home", 4);

  assert.deepEqual(match.tennis.setScores, [[6, 2], [6, 4]]);
  assert.equal(match.tennis.winner, "home");
  assert.equal(applyMatchAction(match, { type: actionTypes.addTennisPoint, team: "away" }), null);
});

test("updates tennis player names and country flags", () => {
  const match = tennisMatch();
  const updated = applyMatchAction(match, {
    type: actionTypes.updateTennisTeams,
    homeName: "Pareja España",
    awayName: "Pareja Argentina",
    homeFlag: "ES",
    awayFlag: "AR",
    homeFlag2: "AR",
    awayFlag2: ""
  });

  assert.equal(updated.home.name, "Pareja España");
  assert.equal(updated.home.flag, "ES");
  assert.equal(updated.home.flag2, "AR");
  assert.equal(updated.away.flag, "AR");
  assert.equal(updated.away.flag2, null);
});

test("allows hiding the overlay header by saving empty text", () => {
  const match = tennisMatch();
  const withoutHeader = applyMatchAction(match, {
    type: actionTypes.updateOverlay,
    header: ""
  });

  assert.equal(withoutHeader.overlay.header, "");
  assert.equal(withoutHeader.overlay.footer, "");
});
