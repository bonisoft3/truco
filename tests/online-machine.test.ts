import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.11";
import { type Answer, hybridFixture, initialMatch, matchFixture } from "./online-fixture.ts";
import { compileHybrid } from "/pronto/hybrid.ts";
import { walk } from "/pronto/hybrid-battery.ts";
import { instrument } from "/omnishell/instrument.ts";

const terminal = { instrument, ses: await Deno.readTextFile(new URL(import.meta.resolve("/omnishell/interpreter/vendor/ses.umd.min.js"))) };
import { executeHybrid } from "/pronto/hybrid-local.ts";

Deno.test("online match deals privately and completes both variants through the chart", async () => {
  const {step} = await matchFixture();
  for (const variant of ["mineiro", "paulista"]) {
    let state = (await step(initialMatch(variant), "start")).state;
    let commands = 0;
    while (state.phase !== "finished") {
      assert(++commands < 300, "complete match must terminate for this deterministic deal sequence");
      const answer = state.phase === "hand_over" ? await step(state, "next")
        : state.phase === "brink" ? await step(state, "accept", state.brink)
        : await step(state, "play", state.turn, {slot: state[state.turn as "a" | "b"].findIndex(c => c >= 0), covered: false});
      assertEquals(answer.kind, "accepted");
      state = answer.state;
      assert(!["dealing", "resolving"].includes(state.phase));
      assertEquals(Object.hasOwn(answer.views[0].value, "b"), false);
      assertEquals(Object.hasOwn(answer.views[1].value, "a"), false);
      if (state.brink !== "both") assertEquals(answer.views[0].value.hand, state.a);
    }
    assert(state.score_a === 12 || state.score_b === 12);
    assert(state.games_a === 2 || state.games_b === 2);
    assertEquals((await step(state, "play", "a", {slot: 0, covered: false})).reason, "illegal_event");
  }
});

Deno.test("a voice sits only where a match seated it, and counts its shouts", async () => {
  const {spec, compiled} = await hybridFixture("voice");
  type Voice = {phase: string; room: string; talk: string; seat: string; name: string; word: string; n: number};
  const step = async (state: Voice, kind: string, payload: unknown) => await executeHybrid(compiled.source, spec.fuel, {
    state, event: {kind, payload}, viewers: ["owner"], context: {actor: "owner", tier: "omnishell", now: 1000},
  }) as {kind: string; reason?: string; state: Voice; public: unknown};
  const opened: Voice = {phase: "quiet", room: "", talk: "", seat: "", name: "", word: "", n: 0};
  // Nothing is heard from a voice that sits nowhere.
  assertEquals((await step(opened, "shout", {word: "chama"})).kind, "rejected");
  const sat = await step(opened, "sit", {room: "00000000-0000-0000-0000-000000000500", talk: "the-talk", seat: "b", name: " Bia "});
  // Everyone reads what a voice says, so it names the table by its talk: the
  // room is a reserved table's code.
  assertEquals(sat.public, {talk: "the-talk", seat: "b", name: "Bia", word: "", n: 0});
  const once = await step(sat.state, "shout", {word: "chama"});
  // The count is what tells a new shout from the one already heard, even the same word twice.
  assertEquals((await step(once.state, "shout", {word: "chama"})).state.n, 2);
  assertEquals((await step(sat.state, "shout", {word: ""})).reason, "no_word");
  // Risen, it is heard nowhere: its public row is gone.
  const risen = await step(once.state, "rise", {});
  assertEquals([risen.state.phase, risen.public], ["quiet", null]);
  // That the match seated the voice where it sits is the database's to check (maySit): a step cannot see it.
  assertEquals(spec.states.seated.on.sit.requires?.reason, "not_seated");
});

Deno.test("a table still waiting is closed by its opener alone; a guest stands up from it", async () => {
  const {step} = await matchFixture();
  const waiting = (await step({...initialMatch("mineiro", "2v2"), joined: []}, "start", "a", {seats: ["a", "b"]})).state;
  // Regression: a guest's resign finished the opener's table for everyone.
  assertEquals((await step(waiting, "resign", "b")).reason, "not_the_opener");
  const views = (await step(waiting, "start", "a", {seats: ["a", "b"]})).views;
  assertEquals(views.find(v => v.viewer === "b")!.value.actions.includes("resign"), false);
  assertEquals(views.find(v => v.viewer === "a")!.value.actions.includes("resign"), true);
  assertEquals((await step(waiting, "resign", "a")).state.phase, "finished");
  assertEquals((await step(waiting, "stand", "b")).state.joined, ["a"]);
});

Deno.test("wagers preserve raise authority and refusal pays the last accepted stake", async () => {
  const {step} = await matchFixture();
  const dealt = (await step(initialMatch(), "start")).state;
  let state = (await step(dealt, "raise", "a")).state;
  assertEquals([state.phase, state.stake, state.offer], ["wager", 2, 4]);
  assertEquals((await step(state, "accept", "a")).reason, "not_your_answer");
  state = (await step(state, "raise", "b")).state;
  assertEquals([state.stake, state.offer], [4, 8]);
  state = (await step(state, "fold", "a")).state;
  assertEquals([state.phase, state.score_b], ["hand_over", 4]);
  state = (await step((await step(dealt, "raise", "a")).state, "accept", "b")).state;
  assertEquals((await step(state, "raise", "a")).reason, "not_your_raise");
});

Deno.test("brink decisions, blind cards, covered cards and deadlines preserve privacy", async () => {
  const {step} = await matchFixture();
  const choice = await step({...initialMatch(), score_a: 10}, "start");
  assertEquals(choice.state.phase, "brink");
  assertEquals((await step(choice.state, "accept", "b")).reason, "not_your_answer");
  const playing = (await step(choice.state, "accept", "a")).state;
  assertEquals(playing.stake, 4);
  assertEquals((await step(playing, "raise", "a")).reason, "brink_no_raise");
  const blind = await step({...initialMatch(), score_a: 10, score_b: 10}, "start");
  assertEquals(blind.state.phase, "playing");
  assertEquals(blind.views.map(v => v.value.hand), [[-1, -1, -1], [-1, -1, -1]]);
  assertEquals(blind.views[0].value.available, [0, 1, 2]);
  const covered = await step(playing, "play", "a", {slot: 0, covered: true});
  assertEquals(covered.views[1].value.plays[0].card, -1);
  assert(covered.state.plays[0].card >= 0);
  assertEquals((await step(playing, "play", "a", {slot: 0, covered: false}, playing.deadline)).reason, "expired");
  const timed = await step(choice.state, "timeout", "", {}, choice.state.deadline);
  assertEquals([timed.state.phase, timed.state.score_b], ["hand_over", 2]);
  // Winning the first jogo of a queda (12 tentos) advances games_b to 1 and deals jogo 2 at 0-0 tentos.
  const firstGame = await step({...choice.state, score_b: 10}, "fold", "a");
  assertEquals([firstGame.state.phase, firstGame.state.score_b, firstGame.state.games_b, firstGame.state.winner], ["hand_over", 12, 1, ""]);
  const secondGame = await step(firstGame.state, "next", "a");
  assertEquals([secondGame.state.phase, secondGame.state.score_a, secondGame.state.score_b, secondGame.state.games_b, secondGame.state.brink], ["playing", 0, 0, 1, ""]);
});

Deno.test("every online variant and seating completes with private hands and team scores", async () => {
  const {step} = await matchFixture();
  for (const variant of ["mineiro", "paulista", "gaucho", "truc", "argentino", "uruguayo", "paraguayo", "douradinha", "douradao"]) {
    for (const seating of variant.startsWith("doura") ? ["2v2v2"] : ["1v1", "2v2"]) {
      let state = (await step(initialMatch(variant, seating), "start")).state;
      let commands = 0;
      while (state.phase !== "finished") {
        assert(++commands < 700, `${variant}/${seating} did not finish`);
        const actor = state.phase === "brink" ? state.seats.find(s => (state.seats.indexOf(s) % 2 === 0 ? "a" : "b") === state.brink)! : state.turn;
        const kind = state.phase === "brink" ? "accept" : state.phase === "hand_over" ? "next" : "play";
        const answer = await step(state, kind, actor, kind === "play" ? {slot: state[actor as "a"].findIndex(c => c >= 0), covered: false} : {});
        assertEquals(answer.kind, "accepted");
        state = answer.state;
        for (const view of answer.views) {
          assertEquals(Object.hasOwn(view.value, "a"), false);
          assertEquals(Object.hasOwn(view.value, "f"), false);
          assertEquals(view.value.hand.length, 3);
          if (state.brink !== "both") assertEquals(view.value.hand, state[view.viewer as "a"]);
        }
      }
      assertEquals(state[`score_${state.winner}` as "score_a"], state.goal);
      assertEquals(state[`games_${state.winner}` as "games_a"], ["gaucho", "argentino", "uruguayo", "paraguayo"].includes(variant) ? 1 : 2);
    }
  }
});

Deno.test("partners share authority, but only one response commits and special hands reveal only partners", async () => {
  const {step} = await matchFixture();
  let state = (await step(initialMatch("mineiro", "2v2"), "start")).state;
  const raised = (await step(state, "raise", "a")).state;
  assertEquals((await step(raised, "accept", "c")).reason, "not_your_answer");
  state = (await step(raised, "accept", "d")).state;
  assertEquals(state.stake, 4);
  assertEquals((await step(state, "accept", "b")).reason, "illegal_event");
  const brink = await step({...initialMatch("mineiro", "2v2"), score_a: 10}, "start");
  assertEquals(brink.views.map(v => v.value.partners.map(p => p.seat)), [["c"], [], ["a"], []]);
  const blind = await step({...initialMatch("paulista", "2v2"), score_a: 11, score_b: 11}, "start");
  assert(blind.views.every(v => v.value.hand.every(c => c === -1) && v.value.partners.length === 0));
});

Deno.test("three pairs answer independently and folding removes a team from the hand", async () => {
  const {step} = await matchFixture();
  let state = (await step(initialMatch("douradinha", "2v2v2"), "start")).state;
  state = (await step(state, "raise", "a")).state;
  state = (await step(state, "accept", "e")).state;
  assertEquals(state.phase, "wager");
  assertEquals((await step(state, "accept", "b")).reason, "not_your_answer");
  state = (await step(state, "fold", "f")).state;
  assertEquals([state.phase, state.stake, state.folded], ["playing", 4, ["c"]]);
  assertEquals((await step(state, "play", "c", {slot: 0, covered: false})).reason, "not_active");
  // Dourado tables are Minas's game: a pair runs from a call, never mid-play.
  assertEquals((await step(state, "fold", "b")).reason, "fold_unavailable");
  state = (await step(state, "play", "a", {slot: 0, covered: false})).state;
  state = (await step(state, "raise", "b")).state;
  state = (await step(state, "fold", "a")).state;
  assertEquals([state.phase, state.score_b], ["hand_over", 4]);
});

Deno.test("envido interrupts and resumes truco, pays immediately, and refusal reveals no counts", async () => {
  const {step} = await matchFixture();
  const dealt = (await step(initialMatch("argentino", "2v2"), "start")).state;
  let state = (await step(dealt, "raise", "a")).state;
  state = (await step(state, "envido", "b")).state;
  assertEquals([state.phase, state.offer, state.envido_caller], ["envido", 2, "b"]);
  assertEquals((await step(state, "envido_take", "d")).reason, "not_your_answer");
  const taken = await step(state, "envido_take", "c");
  assertEquals([taken.state.phase, taken.state.score_a + taken.state.score_b], ["wager", 2]);
  // The mano's side speaks first; the other states a count only to beat it.
  const [mano, other] = taken.state.envido_scores;
  assertEquals(mano.side, "a");
  assert(other === undefined || other.count > mano.count);
  assertEquals(taken.state.log.filter(l => l.kind === "envido_count").length, taken.state.envido_scores.length);
  const refused = (await step(state, "envido_run", "a")).state;
  assertEquals([refused.phase, refused.score_b, refused.envido_scores], ["wager", 1, []]);
  state = (await step(state, "envido_real", "c")).state;
  state = (await step(state, "envido_falta", "d")).state;
  assertEquals((await step(state, "envido_real", "a")).reason, "invalid_envido_raise");
  state = (await step(state, "envido_take", "a")).state;
  assertEquals(state.phase, "finished");
  assertEquals(Math.max(state.score_a, state.score_b), 30);
});

Deno.test("flor uses the original deal and cancels an outstanding envido", async () => {
  const {step} = await matchFixture();
  let state = (await step(initialMatch("uruguayo"), "start")).state;
  state = {...state, a: [0, 4, 8], b: [1, 5, 9]};
  state = (await step(state, "envido", "a")).state;
  state = (await step(state, "flor", "b")).state;
  assertEquals([state.phase, state.score_b, state.envido_done], ["playing", 3, "flor"]);
  assertEquals((await step(state, "envido", "a")).reason, "envido_closed");
  assertEquals((await step(state, "flor", "a")).reason, "flor_unavailable");
});

Deno.test("settling a three-team wager skips the folded caller for plays and timeouts", async () => {
  const {step} = await matchFixture();
  for (const variant of ["douradinha", "douradao"]) {
    let state = (await step(initialMatch(variant, "2v2v2"), "start")).state;
    for (const [kind, actor] of [["raise", "a"], ["raise", "b"], ["fold", "a"], ["accept", "c"]]) {
      const answer = await step(state, kind, actor);
      assertEquals(answer.kind, "accepted");
      state = answer.state;
    }
    assertEquals([state.phase, state.turn, state.folded, state.stake], ["playing", "b", ["a"], 8]);
    const played = await step(state, "play", "b", {slot: 0, covered: false});
    assertEquals(played.kind, "accepted");
    assertEquals(played.state.plays.at(-1)!.seat, "b");
    const timed = await step(state, "timeout", "", {}, state.deadline);
    assertEquals(timed.kind, "accepted");
    assertEquals(timed.state.plays.at(-1)!.seat, "b");
  }
});

Deno.test("the envido climbs envido, envido, real envido, falta envido and never back down", async () => {
  const {step} = await matchFixture();
  let state = (await step(initialMatch("argentino"), "start")).state;
  state = (await step(state, "envido", "a")).state;
  state = (await step(state, "envido", "b")).state;
  assertEquals(state.envido_chain, ["envido", "envido"]);
  assertEquals((await step(state, "envido", "a")).reason, "invalid_envido_raise");
  state = (await step(state, "envido_real", "a")).state;
  assertEquals((await step(state, "envido_real", "b")).reason, "invalid_envido_raise");
  assertEquals((await step(state, "envido", "b")).reason, "invalid_envido_raise");
  state = (await step(state, "envido_take", "b")).state;
  assertEquals(state.score_a + state.score_b, 7);
});

Deno.test("an envido nobody answers in time is refused for the side that owed it", async () => {
  // The wake delivers the timeout with no seat, and the refusal was logged
  // under that seat: an invalid log, so every tick failed and the match stayed
  // in the envido for good.
  const {step} = await matchFixture();
  let state = (await step(initialMatch("argentino"), "start")).state;
  state = (await step(state, "envido", "a")).state;
  const timed = await step(state, "timeout", null as unknown as string, {}, state.deadline);
  assertEquals(timed.kind, "accepted", timed.reason);
  assertEquals([timed.state.envido_done, timed.state.log.at(-1)], ["refused", {seat: "b", kind: "envido_run", count: 0, at: 0}]);
  assertEquals(timed.state.score_a, 1);
});

Deno.test("a timeout that asks the wake for its sender is refused, not run with a null seat", async () => {
  // The bug above, as it was written: the timeout's contract reads no sender,
  // so the read is refused at the step instead of logging a null seat.
  const {spec, rules} = await matchFixture();
  const buggy = rules.replace(
    `return runEnvido(state, event, {...context, actor: active(state).find(s => side(state, s) !== state.envido_caller)});`,
    `return runEnvido(state, event, context);`);
  assert(buggy !== rules, "the fixed timeout is still the one this restores");
  const compiled = await compileHybrid(spec, buggy, terminal);
  let state = (await executeHybrid(compiled.source, spec.fuel, {state: initialMatch("argentino"), event: {kind: "start", payload: {seats: ["a", "b"]}},
    viewers: ["a", "b"], context: {tier: "mecha", now: 1000, entropy: "0123456789abcdef".repeat(16)}}) as Answer).state;
  state = (await executeHybrid(compiled.source, spec.fuel, {state, event: {kind: "envido", payload: {}},
    viewers: ["a", "b"], context: {actor: "a", tier: "omnishell", now: 1000, entropy: "0123456789abcdef".repeat(16)}}) as Answer).state;
  await assertRejects(() => executeHybrid(compiled.source, spec.fuel, {state, event: {kind: "timeout", payload: {}},
    viewers: ["a", "b"], context: {tier: "mecha", now: state.deadline, entropy: "0123456789abcdef".repeat(16)}}), Error, "timeout reads actor outside its contract");
});

Deno.test("only the river's tables and the truc leave a hand unasked, and an early exit concedes the envido", async () => {
  const {step} = await matchFixture();
  const started = await step(initialMatch("mineiro"), "start");
  const mineiro = started.state;
  assertEquals((await step(mineiro, "fold", "a")).reason, "fold_unavailable");
  const yours = started.views.find((v) => v.viewer === "a");
  assert(yours !== undefined && !yours.value.actions.includes("fold"), `mineiro offers ${yours?.value.actions}`);
  const argentino = (await step(initialMatch("argentino"), "start")).state;
  const left = (await step(argentino, "fold", "a")).state;
  assertEquals([left.phase, left.score_b], ["hand_over", 2]);
  const truc = (await step(initialMatch("truc"), "start")).state;
  assertEquals((await step(truc, "fold", "a")).state.score_b, 1, "a table without envido owes only the hand");
});

Deno.test("a table without a clock has no deadline and nothing to time out", async () => {
  const {step} = await matchFixture();
  const state = (await step({...initialMatch("paulista"), turn_ms: 0}, "start")).state;
  assertEquals(state.deadline, 0);
  assertEquals((await step(state, "play", "a", {slot: 0, covered: false}, 10 ** 12)).kind, "accepted");
  assertEquals((await step(state, "timeout", "", {}, 10 ** 12)).reason, "not_due");
});

// Truco's machines, walked from fresh instances by seeded draws of every event
// from either tier and any seat: each step answers or fails with a named
// error, never a rule or the runtime reading what is not there.
Deno.test("Truco's machines hold under any input a step can be given", async () => {
  // Each with the phases its walks must stand in, or they proved nothing.
  const machines: [string, Record<string, unknown>, string[], string[]][] = [
    ["truco_match", {variant: "argentino", seating: "1v1", turn_ms: 20000, reserved: false, talk: "t"}, ["a", "b"], ["envido", "finished", "hand_over", "playing", "wager"]],
    ["truco_match", {variant: "douradinha", seating: "2v2v2", turn_ms: 0, reserved: true, talk: "t"}, ["a", "b", "c", "d", "e", "f"], ["finished", "playing", "wager"]],
    ["truco_challenge", {inviter: "a".repeat(36), target: "b".repeat(36), room: "c".repeat(36), variant: "mineiro", seating: "1v1", talk: "t", inviter_name: "A", target_name: "B"}, ["inviter", "target"], ["accepted", "declined", "expired", "offered"]],
    ["truco_call", {caller: "a".repeat(36), target: "b".repeat(36), room: "c".repeat(36), chair: "c", variant: "mineiro", seating: "2v2", caller_name: "A", target_name: "B"}, ["caller", "target"], ["accepted", "declined", "expired", "offered"]],
    ["truco_presence", {}, ["owner"], ["hidden", "visible"]],
  ];
  for (const [name, input, seats, reached] of machines) {
    const {spec, compiled} = await hybridFixture(name.replace("truco_", ""));
    const context = {tier: "mecha", now: 1000, entropy: "0123456789abcdef".repeat(16)};
    const fresh = (await executeHybrid(compiled.source, spec.fuel, {initialize: true, payload: input, viewers: [], context}) as {state: {phase: string; seats?: string[]}}).state;
    // A match waits for its table, which only a full one leaves: it is walked
    // from the hand its players were dealt.
    const start = fresh.phase === "waiting"
      ? (await executeHybrid(compiled.source, spec.fuel, {state: fresh, event: {kind: "start", payload: {seats: fresh.seats}}, viewers: seats, context}) as {state: unknown}).state
      : fresh;
    const visited = new Set<string>();
    for (const seed of [1, 2, 3]) {
      const walked = await walk(spec, compiled.source, start, seats, seed, 300);
      assertEquals(walked.crashes, [], `${name} from ${JSON.stringify(input)}, seed ${seed}`);
      for (const p of walked.visited) visited.add(p);
    }
    for (const phase of reached) assert(visited.has(phase), `${name} from ${JSON.stringify(input)} never stood in ${phase}: ${[...visited].sort().join(", ")}`);
  }
});
