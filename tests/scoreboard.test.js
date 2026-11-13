import test from "node:test";
import assert from "node:assert/strict";
import {
  actionTypes,
  applyMatchAction,
  createMatchState,
  getPeriodDuration,
  getPeriodLabel,
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
