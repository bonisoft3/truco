import { assertEquals } from "jsr:@std/assert@1.0.11";
import { compileHybrid } from "../../../plugins/pronto/hybrid.ts";
import { instrument } from "../../../plugins/omnishell/instrument.ts";
import { executeHybrid } from "../../../plugins/pronto/hybrid-local.ts";
import { ROOT, run, uuid } from "../../../plugins/pronto/testdata/hybrid-fixtures.ts";

async function fixture<T>(name: string) {
  const exported = await run("cue", ["export", "./apps/truco", "-e", `code.state.hybrids.truco_${name}.reducer`]);
  if (!exported.ok) throw new Error(exported.err);
  const spec = JSON.parse(exported.out);
  const compiled = await compileHybrid(spec, await Deno.readTextFile(new URL(`apps/truco/machines/${name}.js`, ROOT)), instrument);
  return async (state: T, kind: string, payload = {}, now = 1000, actor = "owner") => await executeHybrid(compiled.source, spec.fuel, {
    state, event: {kind, payload}, context: {now, actor, tier: ["touch", "leave", "expire"].includes(kind) ? "mecha" : "omnishell"}, viewers: [actor],
  }) as {kind: string; reason: string; state: T; public?: unknown};
}

Deno.test("presence separates account visibility from expiring tab leases", async () => {
  let state = {phase: "hidden", name: "", leases: [] as {id: string; until: number}[], until: 0};
  const step = await fixture<typeof state>("presence");
  assertEquals((await step(state, "show", {name: "Ana"})).reason, "disconnected");
  state = (await step(state, "touch", {session: uuid(1)})).state;
  // The ticker's deadline is the earliest lease's lapse.
  assertEquals(state.until, 31000);
  const shown = await step(state, "show", {name: " Ana "});
  state = shown.state;
  assertEquals([state.phase, state.name], ["visible", "Ana"]);
  assertEquals(shown.public, {name: "Ana"});
  state = (await step(state, "touch", {session: uuid(2)})).state;
  state = (await step(state, "leave", {session: uuid(1)})).state;
  assertEquals(state.leases.map(l => l.id), [uuid(2)]);
  state = (await step(state, "hide")).state;
  state = (await step(state, "touch", {session: uuid(1)})).state;
  assertEquals(state.phase, "hidden", "a delayed heartbeat cannot undo offline");
  const expired = await step(state, "expire", {}, 31000);
  state = expired.state;
  assertEquals([state.leases, state.until, expired.public], [[], 0, null], "a lapsed tab is no longer listed");
  state = (await step(state, "touch", {session: uuid(3)}, 32000)).state;
  state = (await step(state, "leave", {session: uuid(1)}, 32000)).state;
  assertEquals(state.leases.map(l => l.id), [uuid(3)], "old mount cleanup cannot close its replacement");
});

Deno.test("challenge roles, deadline boundary and terminal states reject late effects", async () => {
  const state = {phase: "offered", inviter: uuid(1), target: uuid(2), inviter_name: "Ana", target_name: "Bia", variant: "mineiro", seating: "1v1", deadline: 2000, room: uuid(3), talk: "t"};
  const step = await fixture<typeof state>("challenge");
  assertEquals((await step(state, "accept", {}, 1000, "inviter")).reason, "not_target");
  assertEquals((await step(state, "cancel", {}, 1000, "target")).reason, "not_inviter");
  assertEquals((await step(state, "accept", {}, 2000, "target")).reason, "expired");
  for (const [kind, actor, phase] of [["accept", "target", "accepted"], ["decline", "target", "declined"], ["cancel", "inviter", "cancelled"], ["expire", "", "expired"]]) {
    const next = await step(state, kind, {}, kind === "expire" ? 2000 : 1000, actor);
    assertEquals(next.state.phase, phase);
    assertEquals((await step(next.state, "accept", {}, 1000, "target")).reason, "illegal_event");
  }
});

Deno.test("a call is answered by its target alone, by its deadline, and is over once answered", async () => {
  const state = {phase: "offered", caller: uuid(1), target: uuid(2), caller_name: "Davi", target_name: "Bia", room: uuid(3), chair: "c", variant: "mineiro", seating: "2v2", deadline: 2000};
  const step = await fixture<typeof state>("call");
  assertEquals((await step(state, "accept", {}, 1000, "caller")).reason, "not_target");
  assertEquals((await step(state, "cancel", {}, 1000, "target")).reason, "not_caller");
  assertEquals((await step(state, "accept", {}, 2000, "target")).reason, "expired");
  for (const [kind, actor, phase] of [["accept", "target", "accepted"], ["decline", "target", "declined"], ["cancel", "caller", "cancelled"], ["expire", "", "expired"]]) {
    const next = await step(state, kind, {}, kind === "expire" ? 2000 : 1000, actor);
    assertEquals(next.state.phase, phase);
    assertEquals((await step(next.state, "accept", {}, 1000, "target")).reason, "illegal_event");
  }
});
