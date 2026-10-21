const allSeats = ["a", "b", "c", "d", "e", "f"];
const config = variant => ({
  mineiro: {ladder: [2, 4, 8, 10, 12], goal: 12, games: 2, brink: 10, trumps: [3, 14, 29, 12]},
  paulista: {ladder: [1, 3, 6, 9, 12], goal: 12, games: 2, brink: 11},
  gaucho: {ladder: [1, 2, 3, 4], goal: 18, games: 1, trumps: [29, 31, 13, 12], envido: true, flor: true, mazo: true},
  truc: {ladder: [1, 2, 3], goal: 12, games: 2, trumps: [], mazo: true},
  argentino: {ladder: [1, 2, 3, 4], goal: 30, games: 1, trumps: [29, 31, 13, 12], envido: true, mazo: true},
  uruguayo: {ladder: [1, 2, 3, 4], goal: 30, games: 1, trumps: [29, 31, 13, 12], envido: true, flor: true, mazo: true},
  paraguayo: {ladder: [1, 2, 3, 4], goal: 30, games: 1, trumps: [29, 31, 13, 12], envido: true, flor: true, mazo: true},
  douradinha: {ladder: [2, 4, 8, 10, 12], goal: 12, games: 2, trumps: [16, 23, 35, 31, 7, 3, 14, 29, 12]},
  douradao: {ladder: [2, 4, 8, 10, 12], goal: 12, games: 2, trumps: [40, 24, 15, 28, 20, 16, 23, 31, 35, 7, 3, 39, 14]},
})[variant];
// A table without a clock (turn_ms 0) has no deadline to miss.
const due = (state, context) => state.turn_ms ? context.now + state.turn_ms : 0;
const said = (state, seat, kind, count = 0) => [...state.log, {seat, kind, count, at: state.plays.length}];
const sides = state => state.seating === "2v2v2" ? ["a", "b", "c"] : ["a", "b"];
const side = (state, seat) => sides(state)[state.seats.indexOf(seat) % sides(state).length];
const active = state => state.seats.filter(seat => !state.folded.includes(side(state, seat)));
const power = (state, card) => {
  if (card < 0) return -1;
  const trumps = config(state.variant).trumps;
  if (trumps) { const at = trumps.indexOf(card); return at < 0 ? Math.floor(card / 4) : 100 - at; }
  return Math.floor(card / 4) === (Math.floor(state.vira / 4) + 1) % 10 ? 100 + card % 4 : Math.floor(card / 4);
};
const handWinner = tricks => {
  const [a, b, c] = tricks;
  if (!b) return "";
  if (a === "tie") return b !== "tie" ? b : !c ? "" : c === "tie" ? "draw" : c;
  if (b === a || b === "tie") return a;
  return !c ? "" : c === b ? b : a;
};
const pay = (state, winner, points) => {
  const score = Math.min(state.goal, state[`score_${winner}`] + points);
  if (score < state.goal || state[`score_${winner}`] === state.goal) return {...state, [`score_${winner}`]: score};
  const games = state[`games_${winner}`] + 1;
  const won = games === config(state.variant).games;
  return {...state, [`score_${winner}`]: score, [`games_${winner}`]: games, result: winner, deadline: 0, ...(won ? {winner} : {})};
};
const award = (state, result, points) => ({...(result === "draw" ? state : pay(state, result, points)), result, offer: 0, deadline: 0});
const advance = (state, context) => {
  const seats = active(state);
  const trick = state.tricks.length;
  const laid = state.plays.filter(p => p.trick === trick && seats.includes(p.seat));
  if (laid.length === seats.length) {
    const top = Math.max(...laid.map(p => p.covered ? -1 : power(state, p.card)));
    const best = laid.filter(p => (p.covered ? -1 : power(state, p.card)) === top);
    const winners = [...new Set(best.map(p => side(state, p.seat)))];
    const result = winners.length === 1 ? winners[0] : "tie";
    const tricks = [...state.tricks, result];
    const next = {...state, tricks, turn: result === "tie" ? laid[0].seat : best[0].seat, deadline: due(state, context)};
    const winner = handWinner(tricks.map(team => state.folded.includes(team) ? "tie" : team));
    return winner ? award(next, winner, state.stake) : next;
  }
  const start = state.seats.indexOf(state.turn);
  const turn = state.seats.slice(start).concat(state.seats.slice(0, start)).find(seat => seats.includes(seat) && !laid.some(p => p.seat === seat));
  return {...state, turn, deadline: due(state, context)};
};
const play = (state, event, context) => {
  const hand = state[state.turn].slice();
  const card = hand[event.payload.slot];
  hand[event.payload.slot] = -1;
  return advance({...state, [state.turn]: hand, plays: [...state.plays, {seat: state.turn, card, covered: event.payload.covered, trick: state.tricks.length, slot: event.payload.slot}]}, context);
};
const mayAct = (state, _event, context) => !state.seats.includes(context.actor) || state.folded.includes(side(state, context.actor)) ? "not_active" : state.deadline && context.now >= state.deadline ? "expired" : true;
const mayLeave = (state, event, context) => mayAct(state, event, context) !== true ? mayAct(state, event, context) : config(state.variant).mazo ? true : "fold_unavailable";
const owes = (state, actor) => state.phase === "brink" ? side(state, actor) === state.brink : side(state, actor) !== state.caller && !state.answers.includes(side(state, actor));
const mayAnswer = (state, event, context) => mayAct(state, event, context) !== true ? mayAct(state, event, context) : !owes(state, context.actor) ? "not_your_answer" : true;
const settleBid = state => {
  const remaining = sides(state).filter(s => !state.folded.includes(s));
  if (state.offer && remaining.every(s => s === state.caller || state.answers.includes(s))) return {...state, stake: state.offer, offer: 0, right: state.caller, caller: "", answers: []};
  return state;
};
// Leaving before the envido window shuts concedes the envido's point as well.
const fold = (state, _event, context) => {
  const folded = [...state.folded, side(state, context.actor)];
  const remaining = sides(state).filter(s => !folded.includes(s));
  const owed = state.phase === "playing" && config(state.variant).envido && !state.tricks.length && !state.envido_done && !state.envido_chain.length;
  const spoken = {...state, log: said(state, context.actor, "fold")};
  if (remaining.length === 1) return award({...(owed ? pay(spoken, remaining[0], 1) : spoken), folded}, remaining[0], state.stake);
  const next = settleBid({...spoken, folded, deadline: due(state, context)});
  return next.offer ? next : advance(next, context);
};
const dealt = (state, seat) => state[seat].filter(c => c >= 0).concat(state.plays.filter(p => p.seat === seat).map(p => p.card));
const pips = card => [4, 5, 6, 7, 0, 0, 0, 1, 2, 3][Math.floor(card / 4)];
const count = cards => {
  let best = Math.max(...cards.map(pips));
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) if (cards[i] % 4 === cards[j] % 4) best = Math.max(best, 20 + pips(cards[i]) + pips(cards[j]));
  return best;
};
const envidoWorth = (state, chain) => chain.includes("envido_falta") ? state.goal - Math.max(state.score_a, state.score_b) : chain.reduce((sum, kind) => sum + (kind === "envido" ? 2 : 3), 0);
const mayEnvidoAnswer = (state, event, context) => mayAct(state, event, context) !== true ? mayAct(state, event, context) : side(state, context.actor) === state.envido_caller ? "not_your_answer" : true;
const mayEnvido = (state, event, context) => {
  if (mayAct(state, event, context) !== true) return mayAct(state, event, context);
  if (!config(state.variant).envido || state.tricks.length || state.envido_done) return "envido_closed";
  if (state.phase === "envido" ? mayEnvidoAnswer(state, event, context) !== true : state.turn !== context.actor && !(state.phase === "wager" && owes(state, context.actor))) return "not_your_call";
  // Envido, envido, real envido, falta envido: never downward, envido twice at most.
  const rank = ["envido", "envido_real", "envido_falta"];
  const last = state.envido_chain.at(-1);
  if (last && (last === "envido_falta" || rank.indexOf(event.kind) < rank.indexOf(last))) return "invalid_envido_raise";
  if (state.envido_chain.filter(kind => kind === event.kind).length >= (event.kind === "envido" ? 2 : 1)) return "invalid_envido_raise";
  return true;
};
const mayFlor = (state, event, context) => mayAct(state, event, context) !== true ? mayAct(state, event, context) : !config(state.variant).flor || state.tricks.length || state.envido_done || new Set(dealt(state, context.actor).map(card => card % 4)).size !== 1 ? "flor_unavailable" : true;
const runEnvido = (state, _event, context) => ({...pay({...state, deadline: due(state, context), log: said(state, context.actor, "envido_run")}, state.envido_caller, Math.max(1, envidoWorth(state, state.envido_chain.slice(0, -1)))), envido_done: "refused", envido_caller: ""});
// The mano's side states its count first; each side after it states its own
// only to beat the best so far, and otherwise says "son buenas" and shows
// nothing. A tie stays with whoever spoke first.
const takeEnvido = (state, _event, context) => {
  const from = state.seats.indexOf(state.leader);
  const round = state.seats.slice(from).concat(state.seats.slice(0, from));
  let log = said(state, context.actor, "envido_take");
  const scores = [];
  for (const team of sides(state).slice().sort((x, y) => round.findIndex(s => side(state, s) === x) - round.findIndex(s => side(state, s) === y))) {
    const speaker = round.find(seat => side(state, seat) === team);
    const best = Math.max(...state.seats.filter(seat => side(state, seat) === team).map(seat => count(dealt(state, seat))));
    if (!scores.length || best > scores.at(-1).count) {
      scores.push({side: team, count: best});
      log = [...log, {seat: speaker, kind: "envido_count", count: best, at: state.plays.length}];
    } else log = [...log, {seat: speaker, kind: "envido_good", count: 0, at: state.plays.length}];
  }
  return {...pay({...state, deadline: due(state, context), log}, scores.at(-1).side, envidoWorth(state, state.envido_chain)), envido_done: "accepted", envido_caller: "", envido_scores: scores};
};
const mayRaise = (state, event, context) => {
  const allowed = state.phase === "wager" ? mayAnswer(state, event, context) : mayAct(state, event, context);
  if (allowed !== true) return allowed;
  if (state.brink) return "brink_no_raise";
  if (state.phase !== "wager" && (state.turn !== context.actor || state.right === side(state, context.actor))) return "not_your_raise";
  if ((state.offer || state.stake) === config(state.variant).ladder.slice(-1)[0]) return "maximum_stake";
  return true;
};
const mayPlay = (state, event, context) => mayAct(state, event, context) !== true ? mayAct(state, event, context) : state.turn !== context.actor ? "not_your_turn" : state[context.actor][event.payload.slot] < 0 ? "card_already_played" : true;
// A table still waiting is closed by its opener; a guest stands up from it.
const mayResign = (state, _event, context) => state.phase !== "waiting" || context.actor === "a" ? true : "not_the_opener";
return {
  initial: input => {
    if ((input.seating === "2v2v2") !== ["douradinha", "douradao"].includes(input.variant)) throw new Error("variant does not support this seating");
    const seats = allSeats.slice(0, input.seating === "1v1" ? 2 : input.seating === "2v2" ? 4 : 6);
    return {phase: "waiting", variant: input.variant, seating: input.seating, reserved: input.reserved, talk: input.talk, seats, joined: ["a"],
      a: [], b: [], c: [], d: [], e: [], f: [], score_a: 0, score_b: 0, score_c: 0, games_a: 0, games_b: 0, games_c: 0,
      goal: input.variant === "gaucho" && input.seating === "2v2" ? 24 : config(input.variant).goal, turn_ms: input.turn_ms, log: [],
      hand_no: 0, leader: "a", turn: "a", stake: 0, offer: 0, caller: "", right: "", brink: "", result: "", winner: "", vira: -1, deadline: 0,
      tricks: [], plays: [], folded: [], answers: [], envido_chain: [], envido_caller: "", envido_done: "", envido_scores: []};
  },
  invariant: state => {
    if (new Set(state.joined).size !== state.joined.length || state.joined.some(s => !state.seats.includes(s))) return false;
    if (state.hand_no === 0) return allSeats.every(s => state[s].length === 0) && state.plays.length === 0;
    const cards = state.seats.flatMap(s => state[s]).filter(c => c >= 0).concat(state.plays.map(p => p.card), state.vira < 0 ? [] : [state.vira]);
    return state.seats.every(s => state[s].length === 3) && cards.length === state.seats.length * 3 + (state.vira < 0 ? 0 : 1) && new Set(cards).size === cards.length && cards.every(c => c >= 0 && c < (state.variant === "douradao" ? 41 : 40));
  },
  admit: (state, event) => ({...state, joined: event.payload.seats}),
  mayResign,
  mayStand: (state, _event, context) => context.actor !== "a" && state.joined.includes(context.actor) ? true : "not_a_guest",
  stand: (state, _event, context) => ({...state, joined: state.joined.filter(seat => seat !== context.actor)}),
  full: state => state.joined.length === state.seats.length,
  needsBrink: state => ["a", "b"].includes(state.brink),
  handOver: state => state.result !== "",
  matchOver: state => state.winner !== "",
  hasWager: state => state.offer > 0,
  mayAct, mayLeave, mayAnswer, mayPlay, mayRaise, mayEnvido, mayEnvidoAnswer, mayFlor,
  isDue: (state, _event, context) => state.deadline && context.now >= state.deadline ? true : "not_due",
  play, fold, takeEnvido, runEnvido,
  callEnvido: (state, event, context) => ({...state, envido_chain: [...state.envido_chain, event.kind], envido_caller: side(state, context.actor), deadline: due(state, context), log: said(state, context.actor, event.kind)}),
  flor: (state, _event, context) => ({...pay({...state, deadline: due(state, context), log: said(state, context.actor, "flor")}, side(state, context.actor), 3), envido_done: "flor", envido_caller: ""}),
  raise: (state, _event, context) => {
    const stake = state.offer || state.stake;
    const ladder = config(state.variant).ladder;
    return {...state, stake, offer: ladder[ladder.indexOf(stake) + 1], caller: side(state, context.actor), answers: [], deadline: due(state, context), log: said(state, context.actor, "raise")};
  },
  accept: (state, _event, context) => {
    const next = settleBid({...state, answers: [...state.answers, side(state, context.actor)], deadline: due(state, context), log: said(state, context.actor, "accept")});
    return next.offer ? next : advance(next, context);
  },
  acceptBrink: (state, _event, context) => ({...state, stake: config(state.variant).ladder[1], deadline: due(state, context), log: said(state, context.actor, "accept")}),
  resign: (state, _event, context) => {
    const winner = sides(state).length === 3 ? "draw" : sides(state).find(s => s !== side(state, context.actor));
    return {...state, winner, result: winner, deadline: 0};
  },
  timeout: (state, event, context) => {
    // The wake carries no seat; the refusal is the side's that owed it.
    if (state.phase === "envido") return runEnvido(state, event, {...context, actor: active(state).find(s => side(state, s) !== state.envido_caller)});
    if (state.phase !== "playing") return fold(state, event, {...context, actor: active(state).find(s => owes(state, s))});
    const slot = state[state.turn].map((card, slot) => ({card, slot})).filter(c => c.card >= 0).sort((a, b) => power(state, a.card) - power(state, b.card))[0].slot;
    return play(state, {payload: {slot, covered: false}}, context);
  },
  deal: (state, _event, context) => {
    const deck = Array.from({length: state.variant === "douradao" ? 41 : 40}, (_, i) => i);
    let offset = 0;
    for (let i = deck.length - 1; i > 0; i--) {
      let byte;
      do {
        if (offset + 2 > context.entropy.length) throw new Error("deal entropy exhausted");
        byte = Number.parseInt(context.entropy.slice(offset, offset + 2), 16); offset += 2;
      } while (byte >= 256 - 256 % (i + 1));
      const j = byte % (i + 1); [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const hands = {};
    for (const [i, seat] of allSeats.entries()) hands[seat] = state.seats.includes(seat) ? deck.slice(i * 3, i * 3 + 3) : [];
    const leader = state.hand_no === 0 ? "a" : state.seats[(state.seats.indexOf(state.leader) + 1) % state.seats.length];
    const reset = [state.score_a, state.score_b, state.score_c].includes(state.goal);
    const scores = reset ? {score_a: 0, score_b: 0, score_c: 0} : {score_a: state.score_a, score_b: state.score_b, score_c: state.score_c};
    const at = config(state.variant).brink;
    const brink = at === undefined ? "" : scores.score_a === at && scores.score_b === at ? "both" : scores.score_a === at ? "a" : scores.score_b === at ? "b" : "";
    return {...state, ...scores, ...hands, vira: state.variant === "paulista" ? deck[state.seats.length * 3] : -1, leader, turn: leader, brink,
      hand_no: state.hand_no + 1, stake: config(state.variant).ladder[0], offer: 0, caller: "", right: "", result: "", tricks: [], plays: [], folded: [], answers: [],
      envido_chain: [], envido_caller: "", envido_done: "", envido_scores: [], log: [], deadline: due(state, context)};
  },
  publish: state => state.phase === "waiting" && !state.reserved ? {variant: state.variant, seating: state.seating, talk: state.talk, seated: state.joined.length, places: state.seats.length} : null,
  project: (state, viewer) => {
    if (!state.seats.includes(viewer)) throw new Error("invalid viewer");
    const {a, b, c, d, e, f, ...visible} = state;
    const own = state[viewer], team = side(state, viewer), context = {actor: viewer, now: 0};
    const actions = [];
    if (state.phase !== "finished" && mayResign(state, {}, context) === true) actions.push("resign");
    if (state.phase === "hand_over") actions.push("next");
    if (state.phase === "playing" && mayAct(state, {}, context) === true) { if (mayLeave(state, {}, context) === true) actions.push("fold"); if (state.turn === viewer) actions.push("play"); }
    if (["playing", "wager"].includes(state.phase) && mayRaise(state, {}, context) === true) actions.push("raise");
    if (["wager", "brink"].includes(state.phase) && mayAnswer(state, {}, context) === true) actions.push("accept", "fold");
    if (["playing", "wager", "envido"].includes(state.phase)) {
      for (const kind of ["envido", "envido_real", "envido_falta"]) if (mayEnvido(state, {kind}, context) === true) actions.push(kind);
      if (mayFlor(state, {}, context) === true) actions.push("flor");
      if (state.phase === "envido" && mayEnvidoAnswer(state, {}, context) === true) actions.push("envido_take", "envido_run");
    }
    return {...visible, seat: viewer, side: team, hand: own.map(card => state.brink === "both" ? -1 : card), actions,
      available: own.map((card, slot) => card >= 0 ? slot : -1).filter(slot => slot >= 0),
      opponent_count: state.seats.filter(s => side(state, s) !== team).reduce((total, s) => total + state[s].filter(c => c >= 0).length, 0),
      counts: state.seats.map(s => ({seat: s, count: state[s].filter(c => c >= 0).length})),
      partners: state.brink === team ? state.seats.filter(s => s !== viewer && side(state, s) === team).map(s => ({seat: s, hand: state[s]})) : [],
      powers: own.map(card => state.brink === "both" ? -1 : power(state, card)), envido: config(state.variant).envido && state.hand_no ? count(dealt(state, viewer)) : 0,
      plays: state.plays.map(p => {
        const result = state.tricks[p.trick];
        const top = Math.max(...state.plays.filter(q => q.trick === p.trick && !q.covered).map(q => power(state, q.card)));
        const shown = p.covered ? -1 : power(state, p.card);
        return {...p, card: p.covered ? -1 : p.card, power: shown, win: Boolean(result) && result !== "tie" && shown >= 0 && side(state, p.seat) === result && shown === top};
      })};
  },
};
