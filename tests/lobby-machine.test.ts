import { assertEquals } from "jsr:@std/assert@1.0.11";
import { executeMecha } from "./platform.ts";
import { mechaFixture, uuid } from "./online-fixture.ts";

async function fixture<T>(name: string) {
  const {spec, source} = await mechaFixture(name);
  return async (state: T, kind: string, payload = {}, now = 1000, actor = "owner") => await executeMecha(source, spec.fuel, {
    state, event: {kind, payload}, context: {now, actor, tier: ["touch", "leave"].includes(kind) || kind.startsWith("xstate.after.") ? "mecha" : "omnishell"}, viewers: [actor],
  }) as {kind: string; reason: string; state: T; public?: unknown; actions?: unknown[]};
}

Deno.test("presence separates account visibility from expiring tab leases", async () => {
  let state = {phase: "hidden", name: "", leases: [] as {id: string; until: number}[]};
  const step = await fixture<typeof state>("presence");
  const timer = {params: {id: "xstate.after.30000.visible", delay: 30000}};
  assertEquals((await step(state, "show", {name: "Ana"})).reason, "disconnected");
  const touched = await step(state, "touch", {session: uuid(1)});
  state = touched.state;
  assertEquals([state.leases, touched.actions], [[{id: uuid(1), until: 31000}], undefined], "a hidden player's touch starts no timer");
  const shown = await step(state, "show", {name: " Ana "});
  state = shown.state;
  assertEquals([state.phase, state.name], ["visible", "Ana"]);
  assertEquals(shown.public, {name: "Ana"});
  assertEquals((shown.actions as {params: unknown}[]).map(a => a.params), [{event: {type: timer.params.id}, ...timer.params}], "showing starts the lease's timer");
  const renewed = await step(state, "touch", {session: uuid(2)});
  assertEquals(renewed.actions?.length, 2, "a visible player's touch starts it again");
  state = renewed.state;
  state = (await step(state, "leave", {session: uuid(1)})).state;
  assertEquals(state.leases.map(l => l.id), [uuid(2)]);
  state = (await step(state, "hide")).state;
  state = (await step(state, "touch", {session: uuid(1)})).state;
  assertEquals(state.phase, "hidden", "a delayed heartbeat cannot undo offline");
  // Shown again, its tabs all lapse before the timer its last touch started fires.
  const lapsed = await step({...state, phase: "visible"}, "xstate.after.30000.visible", {}, 31000);
  state = lapsed.state;
  assertEquals([state.leases, lapsed.public], [[], null], "a lapsed tab is no longer listed");
  state = (await step(state, "touch", {session: uuid(3)}, 32000)).state;
  state = (await step(state, "leave", {session: uuid(1)}, 32000)).state;
  assertEquals(state.leases.map(l => l.id), [uuid(3)], "old mount cleanup cannot close its replacement");
});

Deno.test("challenge roles, its timer and terminal states reject late effects", async () => {
  const state = {phase: "offered", inviter: uuid(1), target: uuid(2), inviter_name: "Ana", target_name: "Bia", variant: "mineiro", seating: "1v1", room: uuid(3), talk: "t"};
  const step = await fixture<typeof state>("challenge");
  assertEquals((await step(state, "accept", {}, 1000, "inviter")).reason, "not_target");
  assertEquals((await step(state, "cancel", {}, 1000, "target")).reason, "not_inviter");
  for (const [kind, actor, phase] of [["accept", "target", "accepted"], ["decline", "target", "declined"], ["cancel", "inviter", "cancelled"], ["xstate.after.30000.offered", "", "expired"]]) {
    const next = await step(state, kind, {}, 1000, actor);
    assertEquals(next.state.phase, phase);
    assertEquals((await step(next.state, "accept", {}, 1000, "target")).reason, "illegal_event");
  }
});

Deno.test("a call is answered by its target alone, until its timer, and is over once answered", async () => {
  const state = {phase: "offered", caller: uuid(1), target: uuid(2), caller_name: "Davi", target_name: "Bia", room: uuid(3), chair: "c", variant: "mineiro", seating: "2v2"};
  const step = await fixture<typeof state>("call");
  assertEquals((await step(state, "accept", {}, 1000, "caller")).reason, "not_target");
  assertEquals((await step(state, "cancel", {}, 1000, "target")).reason, "not_caller");
  for (const [kind, actor, phase] of [["accept", "target", "accepted"], ["decline", "target", "declined"], ["cancel", "caller", "cancelled"], ["xstate.after.30000.offered", "", "expired"]]) {
    const next = await step(state, kind, {}, 1000, actor);
    assertEquals(next.state.phase, phase);
    assertEquals((await step(next.state, "accept", {}, 1000, "target")).reason, "illegal_event");
  }
});
