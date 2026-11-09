import assert from "node:assert/strict";
import { PGlite } from "npm:@electric-sql/pglite@0.5.8";
import { browserTier } from "@bonisoft3/mecha/packages/mecha-browser/fence.ts";
import { applyScripts, ChangedScript, digest, recordScripts } from "@bonisoft3/mecha/packages/pglite-workerd/scripts.ts";

Deno.test("a retained edge directory carries its baseline and actors through the engine upgrade", async () => {
  const dir = new URL("../services/database/migrations/", import.meta.url);
  const baseline = await Promise.all(["003_rls.sql", "004_types.sql", "016_mecha_actors.sql"].map(async (name) => ({ name, sql: await Deno.readTextFile(new URL(name, dir)) })));
  assert.equal(await digest(baseline[1].sql), "264ee1fabf9b00574b7ed8b475b2d6cf86e184a38de62ae110663f02e16f9697", "even a comment rename in 004_types.sql invalidates retained directories before forward migrations run");
  const upgrade = { name: "018_xstate_engines", sql: await Deno.readTextFile(new URL("../services/database/sql/018_xstate_engines.sql", import.meta.url)) };
  const current = { name: "019_mecha_engines", sql: await Deno.readTextFile(new URL("../services/database/sql/019_mecha_engines.sql", import.meta.url)) };
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
    assert.deepEqual(await applyScripts(db, [...baseline, upgrade, current], () => {}), [current.name]);
    assert.deepEqual((await snapshot()).rows, before);
    assert.deepEqual(await applyScripts(db, [...baseline, upgrade, current], () => {}), []);
    assert.deepEqual((await db.query("SELECT to_regprocedure('hybrid_truco_match.engine(jsonb)') AS engine")).rows, [{ engine: null }]);
  } finally {
    await db.close();
  }
});
