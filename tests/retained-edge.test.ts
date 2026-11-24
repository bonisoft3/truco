import assert from "node:assert/strict";
import { PGlite } from "npm:@electric-sql/pglite@0.5.8";
import { browserTier } from "@bonisoft3/mecha/packages/mecha-browser/fence.ts";
import { applyScripts, ChangedScript, digest, recordScripts } from "@bonisoft3/mecha/packages/pglite-workerd/scripts.ts";

Deno.test("a retained edge directory carries its baseline and actors through the engine upgrade", async () => {
  const dir = new URL("../services/database/migrations/", import.meta.url);
  const baseline = await Promise.all(["003_rls.sql", "004_types.sql", "016_mecha_actors.sql"].map(async (name) => ({ name, sql: await Deno.readTextFile(new URL(name, dir)) })));
  assert.equal(await digest(baseline[1].sql), "264ee1fabf9b00574b7ed8b475b2d6cf86e184a38de62ae110663f02e16f9697", "even a comment rename in 004_types.sql invalidates retained directories before forward migrations run");
  const upgrade = { name: "018_xstate_engines", sql: await Deno.readTextFile(new URL("../services/database/sql/018_xstate_engines.sql", import.meta.url)) };
  const mecha = { name: "019_mecha_engines", sql: await Deno.readTextFile(new URL("../services/database/sql/019_mecha_engines.sql", import.meta.url)) };
  const rule = { name: "020_rule_argument_engines", sql: await Deno.readTextFile(new URL("../services/database/sql/020_rule_argument_engines.sql", import.meta.url)) };
  const transition = { name: "021_transition_engines", sql: await Deno.readTextFile(new URL("../services/database/sql/021_transition_engines.sql", import.meta.url)) };
  const current = { name: "022_after_timers", sql: await Deno.readTextFile(new URL("../services/database/sql/022_after_timers.sql", import.meta.url)) };
  const db = await PGlite.create();
  try {
    const names: string[] = [];
    for await (const file of Deno.readDir(dir)) if (file.isFile && file.name.endsWith(".sql")) names.push(file.name);
    for (const name of names.sort()) await db.exec(browserTier(await Deno.readTextFile(new URL(name, dir))));
    const id = "00000000-0000-0000-0000-000000000960", actor = "00000000-0000-0000-0000-000000000096";
    await db.query("INSERT INTO hybrid_truco_match.instance (id, version, revision, state) VALUES ($1, 8, 4, $2::jsonb)", [id, JSON.stringify({phase: "playing", turn: "a"})]);
    await db.query("INSERT INTO hybrid_truco_match.member (instance_id, actor, seat) VALUES ($1, $2, 'a')", [id, actor]);
    await db.query("INSERT INTO hybrid_truco_match.receipt (instance_id, actor, command_id, request, result, now) VALUES ($1, $2, 'kept', '{}'::jsonb, '{}'::jsonb, 12)", [id, actor]);
    const snapshot = () => db.query("SELECT (SELECT jsonb_agg(to_jsonb(i)) FROM hybrid_truco_match.instance i) AS instances, (SELECT jsonb_agg(to_jsonb(m)) FROM hybrid_truco_match.member m) AS members, (SELECT jsonb_agg(to_jsonb(r)) FROM hybrid_truco_match.receipt r) AS receipts");
    const before = (await snapshot()).rows;
    await recordScripts(db, baseline);
    await assert.rejects(() => applyScripts(db, [baseline[0], { ...baseline[1], sql: baseline[1].sql + "\n" }, baseline[2], upgrade], () => {}), ChangedScript);
    assert.deepEqual(await applyScripts(db, [...baseline, upgrade], () => {}), [upgrade.name]);
    assert.deepEqual((await snapshot()).rows, before);
    assert.deepEqual(await applyScripts(db, [...baseline, upgrade, mecha], () => {}), [mecha.name]);
    assert.deepEqual((await snapshot()).rows, before);
    assert.deepEqual(await applyScripts(db, [...baseline, upgrade, mecha, rule], () => {}), [rule.name]);
    assert.deepEqual((await snapshot()).rows, before);
    assert.deepEqual(await applyScripts(db, [...baseline, upgrade, mecha, rule, transition], () => {}), [transition.name]);
    assert.deepEqual((await snapshot()).rows, before);
    assert.deepEqual(await applyScripts(db, [...baseline, upgrade, mecha, rule, transition, current], () => {}), [current.name]);
    assert.deepEqual((await snapshot()).rows, before);
    assert.deepEqual(await applyScripts(db, [...baseline, upgrade, mecha, rule, transition, current], () => {}), []);
    assert.deepEqual((await db.query("SELECT to_regprocedure('hybrid_truco_match.engine(jsonb)') AS engine")).rows, [{ engine: null }]);
  } finally {
    await db.close();
  }
});

// The timers step runs again safely: an instance it already moved keeps its
// schedule, where a second run rebuilt it from a deadline no longer there
// and moved it to 1970. A presence waits its last lease, not its first, and
// the startup check asks for a schedule only while timers are being adopted:
// a one-shot that fired leaves its state none, as XState's does.
Deno.test("the timers step re-arms each instance once, from its last lease, and the check holds only at adoption", async () => {
  const dir = new URL("../services/database/migrations/", import.meta.url);
  const carry = browserTier(await Deno.readTextFile(new URL("../services/database/sql/022_after_timers.sql", import.meta.url)));
  const bayt = await Deno.readTextFile(new URL("../bayt.json", import.meta.url));
  const check = JSON.parse(`"${/COPY <<'TIMERS' \/timer-check\.sql\\n([\s\S]*?)\\nTIMERS/.exec(bayt)![1]}"`);
  const db = await PGlite.create();
  try {
    const names: string[] = [];
    for await (const file of Deno.readDir(dir)) if (file.isFile && file.name.endsWith(".sql")) names.push(file.name);
    for (const name of names.sort()) await db.exec(browserTier(await Deno.readTextFile(new URL(name, dir))));
    const offer = "00000000-0000-0000-0000-000000000970", player = "00000000-0000-0000-0000-000000000971";
    await db.query("INSERT INTO hybrid_truco_challenge.instance (id, version, revision, state) VALUES ($1, 2, 0, $2::jsonb)", [offer, JSON.stringify({
      phase: "offered", inviter: "a".repeat(36), target: "b".repeat(36), inviter_name: "A", target_name: "B", variant: "mineiro", seating: "1v1", room: "c".repeat(36), talk: "t", deadline: 1900000000000,
    })]);
    await db.query("INSERT INTO hybrid_truco_presence.instance (id, version, revision, state) VALUES ($1, 2, 3, $2::jsonb)", [player, JSON.stringify({
      phase: "visible", name: "P", leases: [{id: "s1", until: 1000}, {id: "s2", until: 5000}], until: 1000,
    })]);
    await assert.rejects(() => db.exec(check), /whose 30000 timer the ticker was never given/, "adopting timers, a waiting instance is owed its schedule");
    const schedules = async () => (await db.query<{ name: string; due: number; state: string }>(
      "SELECT name, (extract(epoch FROM due_at) * 1000)::bigint AS due, emits_values->>'state' AS state FROM public.schedule WHERE emits_entity = 'machine_timer_tick' ORDER BY name")).rows;
    await db.exec(carry);
    const once = await schedules();
    assert.deepEqual(once.map((s) => [s.state, Number(s.due)]), [["offered", 1900000000000], ["visible", 5000]]);
    await db.exec(carry);
    assert.deepEqual(await schedules(), once, "a second run keeps every schedule the first made");
    // The presence's one-shot fired: its state holds no timer until a touch enters it again.
    await db.query("DELETE FROM public.schedule WHERE emits_values->>'machine' = 'truco_presence'");
    await db.exec(check);
  } finally {
    await db.close();
  }
});
