import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.11";
import { DATABASE, ROOT, run, uuid } from "../../../plugins/pronto/testdata/hybrid-fixtures.ts";
import { matchFixture, type View } from "./online-fixture.ts";
import { type Catalog, CATALOG_SQL, unrecorded } from "../../../plugins/pronto/sql-recorded.ts";

// Truco's machines through their surface, as the browser reaches them: every
// request a row a reader inserts under the generated policies, every answer a
// row the machine writes. The ticker is played by inserting the tick it would.
Deno.test({name: "Truco rooms, presence and challenges complete through their surface rows in PostgreSQL", sanitizeOps: false, sanitizeResources: false, fn: async t => {
  const {compiled, spec} = await matchFixture();
  const container = `truco-online-${crypto.randomUUID().slice(0, 8)}`;
  const started = await run("docker", ["run", "-d", "--rm", "--name", container, "-p", "127.0.0.1::3000", "-e", "POSTGRES_PASSWORD=proof", DATABASE]);
  if (!started.ok) throw new Error(started.err);
  const psql = (source: string) => run("docker", ["exec", "-i", container, "psql", "-qtAX", "-v", "ON_ERROR_STOP=1", "-U", "postgres"], source);
  // As the writers do: a transaction a serialization conflict aborted is run
  // again, so racing callers see some serial order of their steps.
  const sql = async (source: string) => {
    for (let attempt = 0; ; attempt++) {
      const result = await psql(source);
      if (result.ok) return result.out;
      if (!result.err.includes("could not serialize") || attempt >= 20) throw new Error(result.err);
    }
  };
  const as = (actor: number, source: string) =>
    `SET ROLE app_user; SET request.jwt.claims = '${JSON.stringify({sub: uuid(actor)})}'; SET app.scopes = 'public:,user:${uuid(actor)}'; ${source}`;
  const lit = (value: unknown) => `'${(typeof value === "string" ? value : JSON.stringify(value)).replaceAll("'", "''")}'`;
  let restStarted = false;
  const stop = async (name: string) => {
    const result = await run("docker", ["stop", name]);
    if (!result.ok) throw new Error(result.err);
  };
  type Receipt = {kind: string; reason: string};
  const receipt = (table: string, id: string) => `SELECT jsonb_build_object('kind', outcome, 'reason', coalesce(reason, '')) FROM ${table} WHERE id = ${lit(id)};`;
  // An admission or a command: the row, absorbed if it is already there, then its stamp.
  const insert = async (actor: number, table: string, row: Record<string, unknown>): Promise<Receipt> => JSON.parse(await sql(as(actor,
    `INSERT INTO ${table} (${Object.keys(row).join(", ")}) VALUES (${Object.values(row).map(lit).join(", ")}) ON CONFLICT DO NOTHING; ${receipt(table, String(row.id))}`)));
  // A table's talk is its opener's draw: here, its number spelled out to 64 bits.
  const talkOf = (room: number) => room.toString(16).padStart(16, "0");
  const create = (actor: number, room: number, variant = "mineiro", seating = "1v1") =>
    insert(actor, "truco_match_open", {id: uuid(room), instance_id: uuid(room), kind: "create", input: {variant, seating, talk: talkOf(room)}});
  const join = (actor: number, room: number, seat = "", key = `join/${room}/${actor}`) =>
    insert(actor, "truco_match_open", {id: key, instance_id: uuid(room), kind: "join", input: seat ? {requested_seat: seat} : {}});
  const view = async (room: number | string, actor: number): Promise<{revision: string; value: View} | null> => {
    const out = await sql(as(actor, `SELECT jsonb_build_object('revision', revision::text, 'value', view::jsonb) FROM truco_match_seat WHERE instance_id = ${lit(typeof room === "number" ? uuid(room) : room)};`));
    return out ? JSON.parse(out) : null;
  };
  let commandId = 1000;
  const command = (room: number | string, actor: number, revision: string, kind: string, payload = {}, id = `cmd/${++commandId}`) =>
    insert(actor, "truco_match_command", {id, instance_id: typeof room === "number" ? uuid(room) : room, request: {version: spec.version, expected_revision: revision, event: {kind, payload}}});
  const presenceRevision = async (actor: number) => await sql(as(actor, `SELECT revision FROM truco_presence_seat;`));
  const lease = (actor: number, tab = actor + 100, beat = 0) => sql(as(actor,
    `INSERT INTO truco_presence_lease (id, beat) VALUES ('${uuid(tab)}', ${beat}) ON CONFLICT (id) DO UPDATE SET beat = EXCLUDED.beat;`));
  const leave = (actor: number, tab = actor + 100) => sql(as(actor, `DELETE FROM truco_presence_lease WHERE id = '${uuid(tab)}';`));
  const presence = async (actor: number, kind: string, payload = {}) => insert(actor, "truco_presence_command",
    {id: `presence/${++commandId}`, instance_id: uuid(actor), request: {version: 2, expected_revision: await presenceRevision(actor), event: {kind, payload}}});
  const show = async (actor: number) => { await lease(actor); return await presence(actor, "show", {name: `Player ${actor}`}); };
  const listed = async (actor: number, player: number) => (await sql(as(actor, `SELECT count(*) FROM truco_presence_public WHERE id = '${uuid(player)}';`))) === "1";
  const offer = (actor: number, target: number, id: number, variant = "mineiro", seating = "1v1") =>
    insert(actor, "truco_challenge_open", {id: uuid(id), instance_id: uuid(id), kind: "create", input: {target: uuid(target), variant, seating, talk: talkOf(0x100000 + id)}});
  const challenge = async (actor: number, id: number) => {
    const out = await sql(as(actor, `SELECT jsonb_build_object('revision', revision::text, 'phase', phase, 'room', room) FROM truco_challenge_seat WHERE instance_id = '${uuid(id)}';`));
    return out ? JSON.parse(out) as {revision: string; phase: string; room: string} : null;
  };
  const answer = async (actor: number, id: number, kind: string, key = `challenge/${++commandId}`) => insert(actor, "truco_challenge_command",
    {id: key, instance_id: uuid(id), request: {version: 2, expected_revision: (await challenge(actor, id))?.revision ?? "0", event: {kind, payload: {}}}});
  const rooms = async (actor: number) => (await sql(as(actor, `SELECT instance_id FROM truco_match_seat WHERE phase <> 'finished' ORDER BY 1;`))).split("\n").filter(Boolean);
  // What the ticker does when a schedule falls due: insert its tick.
  const tick = (machine: string, instance: string) => sql(`INSERT INTO machine_timer_tick (id, schedule, tick_at, late, machine, "row", state, delay)
    SELECT gen_random_uuid(), s.name, s.due_at, false, s.emits_values->>'machine', s.emits_values->'row', s.emits_values->>'state', s.emits_values->>'delay'
    FROM schedule s WHERE s.emits_values @> jsonb_build_object('machine', '${machine}', 'row', jsonb_build_object('id', '${instance}'));`);
  // The same tick delivered again, as a ticker retrying it would.
  const retick = (machine: string, instance: string) => sql(`INSERT INTO machine_timer_tick (id, schedule, tick_at, late, machine, "row", state, delay)
    SELECT gen_random_uuid(), t.schedule, t.tick_at, t.late, t.machine, t."row", t.state, t.delay FROM machine_timer_tick t
    WHERE t.machine = '${machine}' AND t."row" = jsonb_build_object('id', '${instance}') ORDER BY t.tick_at DESC LIMIT 1;`);
  const overdue = (schema: string, instance: string, field = "deadline") => sql(`UPDATE ${schema}.instance SET state = jsonb_set(state, '{${field}}', '1') WHERE id = '${instance}';`);
  try {
    for (let i = 0; ; i++) {
      if ((await run("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-qU", "postgres"])).ok) break;
      if (i >= 60) throw new Error("PostgreSQL did not start");
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    const migrations = new URL("apps/truco/services/database/migrations/", ROOT);
    const generated = await Deno.readTextFile(new URL("016_mecha_actors.sql", migrations));
    assertStringIncludes(generated, compiled.sql.split("CREATE FUNCTION hybrid_truco_match.settle")[0]);
    const files: string[] = [];
    for await (const entry of Deno.readDir(migrations)) if (entry.name.endsWith(".sql")) files.push(entry.name);
    for (const name of files.sort()) await sql(await Deno.readTextFile(new URL(name, migrations)));
    // Truco's machines read time and randomness only through their clocks and draws.
    assertEquals(await unrecorded(generated, JSON.parse(await sql(CATALOG_SQL)) as Catalog), []);
    // The deployment's step: the roles migration leaves the login's password to it.
    await sql("ALTER ROLE authenticator PASSWORD 'proof';");

    await t.step("presence is a lease per tab, listed while live and dropped by the ticker when it lapses", async () => {
      assertEquals((await show(40)).kind, "accepted");
      await show(41);
      await lease(40, 240);
      assert(await listed(41, 40));
      await leave(40);
      assert(await listed(41, 40), "closing one tab leaves the other visible");
      assertEquals((await presence(40, "hide")).kind, "accepted");
      assertEquals(await listed(41, 40), false);
      await presence(40, "show", {name: "Player 40"});
      // Both tabs went away without leaving: the lease lapses, and the ticker drops it.
      await sql(`UPDATE hybrid_truco_presence.instance SET state = jsonb_set(jsonb_set(state, '{leases}', '[{"id":"${uuid(240)}","until":1}]'), '{until}', '1') WHERE id = '${uuid(40)}';`);
      await sql(`SELECT hybrid_truco_presence.arm(i) FROM hybrid_truco_presence.instance i WHERE i.id = '${uuid(40)}';`);
      await tick("truco_presence", uuid(40));
      assertEquals(await listed(41, 40), false, "a lapsed lease is unlisted without its owner's cooperation");
      await lease(40);
      assert(await listed(41, 40), "reconnecting restores opted-in presence");
      const forged = await psql(as(42, `INSERT INTO truco_presence_command (id, instance_id, request) VALUES ('forged', '${uuid(40)}', ${lit({version: 2, expected_revision: "1", event: {kind: "hide", payload: {}}})});`));
      assertEquals(forged.ok, false, "a reader commands only an instance they belong to");
      // A reader reaches no row of the listing to delete, and the listing stands.
      await sql(as(40, `DELETE FROM truco_presence_public;`));
      assert(await listed(41, 40), "the public listing is the machine's");
      assertEquals((await psql(`SET ROLE anon; INSERT INTO truco_presence_lease (id, actor, beat) VALUES ('${uuid(999)}', '${uuid(40)}', 0);`)).ok, false);
      assertEquals((await create(40, 305)).kind, "accepted");
      assert((await rooms(40)).includes(uuid(305)), "an invitation room is your own to resume");
      assertEquals((await command(305, 40, (await view(305, 40))!.revision, "resign")).kind, "accepted");
    });

    await t.step("challenge accept/cancel race, a resent answer and one dealt room", async () => {
      await show(42);
      await show(43);
      const created = await offer(42, 43, 300);
      assertEquals(created.kind, "accepted");
      assertEquals(await offer(42, 43, 300), created, "the same offer twice is one row");
      assertEquals(await challenge(40, 300), null, "a challenge is its players' alone");
      assertEquals((await psql(as(40, `INSERT INTO truco_challenge_command (id, instance_id, request) VALUES ('x', '${uuid(300)}', ${lit({version: 2, expected_revision: "1", event: {kind: "accept", payload: {}}})});`))).ok, false);
      const race = await Promise.all([answer(43, 300, "accept", "accept/300"), answer(42, 300, "cancel")]);
      assertEquals(race.map(r => r.kind).sort(), ["accepted", "rejected"]);
      assertEquals(await answer(43, 300, "accept", "accept/300"), race[0]);
      const final = (await challenge(43, 300))!;
      const dealt = Number(await sql(`SELECT count(*) FROM hybrid_truco_match.instance WHERE id = '${final.room}';`));
      assertEquals(dealt, final.phase === "accepted" ? 1 : 0);
      if (dealt) assertEquals((await view(final.room, 43))!.value.phase, "playing");
    });

    await t.step("an accepted challenge cannot open another room; busy and expired offers refuse", async () => {
      await show(44);
      await show(45);
      await show(46);
      assertEquals((await offer(44, 45, 301)).kind, "accepted");
      assertEquals(await offer(46, 45, 302), {kind: "accepted", reason: ""});
      assertEquals((await answer(45, 301, "accept")).kind, "accepted");
      const room = (await challenge(45, 301))!.room;
      assert((await rooms(45)).includes(room), "a busy player resumes their room from the bar");
      assertEquals((await answer(45, 302, "accept")).reason, "player_unavailable");
      await overdue("hybrid_truco_challenge", uuid(302));
      await sql(`SELECT hybrid_truco_challenge.arm(i) FROM hybrid_truco_challenge.instance i WHERE i.id = '${uuid(302)}';`);
      await tick("truco_challenge", uuid(302));
      assertEquals((await challenge(46, 302))!.phase, "expired", "the ticker expires an unanswered offer");
      const unavailable = await offer(40, 45, 303);
      assertEquals(unavailable.reason, "player_unavailable");
      const declinable = await offer(40, 41, 304);
      assertEquals(declinable.kind, "accepted", JSON.stringify(declinable));
      assertEquals((await answer(41, 304, "decline")).kind, "accepted");
      assertEquals((await challenge(40, 304))!.phase, "declined");
    });

    await t.step("a failed child delivery rolls back the acceptance, and the same command retries", async () => {
      await show(60);
      await show(61);
      await offer(60, 61, 360);
      const room = (await challenge(61, 360))!.room;
      await sql(`ALTER FUNCTION hybrid_truco_match.deliver(uuid, jsonb, bigint) RENAME TO saved_deliver;
        CREATE FUNCTION hybrid_truco_match.deliver(uuid, jsonb, bigint DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
        BEGIN PERFORM hybrid_truco_match.saved_deliver($1, $2, $3); RAISE EXCEPTION 'injected after child delivery'; END $$;`);
      const failed = await psql(as(61, `INSERT INTO truco_challenge_command (id, instance_id, request) VALUES ('accept/360', '${uuid(360)}', ${lit({version: 2, expected_revision: (await challenge(61, 360))!.revision, event: {kind: "accept", payload: {}}})});`));
      assertEquals(failed.ok, false);
      assertStringIncludes(failed.err, "injected after child delivery");
      assertEquals((await challenge(61, 360))!.phase, "offered");
      assertEquals(await sql(`SELECT (SELECT count(*) FROM hybrid_truco_match.instance WHERE id = '${room}') + (SELECT count(*) FROM truco_match_seat WHERE instance_id = '${room}') + (SELECT count(*) FROM truco_challenge_command WHERE id = 'accept/360');`), "0");
      await sql(`DROP FUNCTION hybrid_truco_match.deliver(uuid, jsonb, bigint);
        ALTER FUNCTION hybrid_truco_match.saved_deliver(uuid, jsonb, bigint) RENAME TO deliver;`);
      assertEquals((await answer(61, 360, "accept", "accept/360")).kind, "accepted");
      assertEquals((await view(room, 61))!.value.phase, "playing");
    });

    await t.step("different challenges cannot concurrently admit the same player", async () => {
      await show(62);
      await show(63);
      await show(64);
      await offer(62, 64, 361);
      await offer(63, 64, 362);
      const results = await Promise.all([answer(64, 361, "accept"), answer(64, 362, "accept")]);
      assertEquals(results.map(value => value.kind).sort(), ["accepted", "rejected"]);
      assertEquals(results.find(value => value.kind === "rejected")!.reason, "player_unavailable");
      assertEquals(await sql(`SELECT count(*) FROM hybrid_truco_match.member WHERE actor = '${uuid(64)}';`), "1");
    });

    await t.step("an admission serializes the first creation and binds its receipt to its owner and inputs", async () => {
      const raced = await Promise.all([create(70, 370), create(70, 370)]);
      assertEquals(raced[0], raced[1]);
      assertEquals(await sql(`SELECT count(*) FROM hybrid_truco_match.member WHERE instance_id = '${uuid(370)}';`), "1");
      assertEquals((await psql(as(71, `INSERT INTO truco_match_open (id, instance_id, kind, input) VALUES ('other/370', '${uuid(370)}', 'create', '{"variant":"mineiro"}');`))).ok, false, "another reader cannot take the room's id");
      assertEquals((await psql(as(70, `INSERT INTO truco_match_open (id, instance_id, kind, input) VALUES ('again/370', '${uuid(370)}', 'create', '{"variant":"paulista"}');`))).ok, false, "nor its owner with other rules");
      for (const query of [
        `SELECT hybrid_truco_match.spawn('${uuid(371)}', '{"variant":"mineiro"}', '{"a":"${uuid(70)}"}');`,
        `SELECT hybrid_truco_match.wake('${uuid(370)}');`,
        `SELECT * FROM hybrid_truco_match.admission_receipt;`,
        `UPDATE truco_match_open SET outcome = 'accepted';`,
        `INSERT INTO truco_match_seat (id, instance_id, actor, seat, revision, phase, view) VALUES ('x', '${uuid(370)}', '${uuid(70)}', 'b', 0, 'waiting', '{}');`,
      ]) assertEquals((await psql(as(70, query))).ok, false, query);
    });

    await t.step("offers replay refusals and serialize duplicate and competing ones", async () => {
      await show(72);
      await show(73);
      await lease(74);
      const refused = await offer(72, 74, 372);
      assertEquals(refused.reason, "player_unavailable");
      await presence(74, "show", {name: "Player 74"});
      assertEquals(await offer(72, 74, 372), refused, "the refusal is the row's, and the row is already there");
      const duplicate = await Promise.all([offer(72, 73, 373), offer(72, 73, 373)]);
      assertEquals(duplicate[0], duplicate[1]);
      assertEquals(duplicate[0].kind, "accepted");
      assertEquals((await offer(72, 74, 374)).reason, "outgoing_challenge_pending");
      await answer(72, 373, "cancel");
      const compete = await Promise.all([offer(72, 73, 375), offer(72, 74, 376)]);
      assertEquals(compete.map(r => r.kind).sort(), ["accepted", "rejected"]);
      assertEquals(compete.find(r => r.kind === "rejected")!.reason, "outgoing_challenge_pending");
    });

    await t.step("creation retries, seat races, private views and outsiders", async () => {
      const first = await create(1, 10);
      assertEquals(await create(1, 10), first);
      const raced = await Promise.all([join(2, 10), join(3, 10)]);
      // The winner fills the table and deals, so the loser finds it no longer waiting.
      assertEquals(raced.map(r => `${r.kind}:${r.reason}`).sort(), ["accepted:", "rejected:room_unavailable"]);
      const opponent = raced[0].kind === "accepted" ? 2 : 3;
      const admitted = (await view(10, opponent))!;
      assertEquals((await join(opponent, 10, "", `rejoin/10/${opponent}`)).kind, "accepted", "joining a table you sit at is a no-op");
      assertEquals([admitted.value.seat, admitted.value.hand.length, Object.hasOwn(admitted.value, "a")], ["b", 3, false]);
      assertEquals(await view(10, 4), null, "an outsider reads no seat");
      assertEquals((await psql(as(1, "SELECT * FROM hybrid_truco_match.instance;"))).ok, false);
      assertEquals(await sql(as(1, "SELECT has_table_privilege(current_user, 'room_action', 'INSERT');")), "f");
      assertEquals((await psql(as(1, `INSERT INTO truco_match_open (id, instance_id, kind, input) VALUES ('bad', '${uuid(19)}', 'create', '{"variant":"invalid"}');`))).ok, false);
    });

    for (const [room, variant, seating, capacity] of [[380, "paulista", "2v2", 4], [381, "douradao", "2v2v2", 6]] as const) {
      await t.step(`${seating} seats serialize requested joins, deal once, and complete a private team match`, async () => {
        await create(80, room, variant, seating);
        const actors: Record<string, number> = {a: 80};
        const raced = await Promise.all([join(81, room, "c"), join(82, room, "c")]);
        assertEquals(raced.map(r => r.kind).sort(), ["accepted", "rejected"]);
        actors.c = raced[0].kind === "accepted" ? 81 : 82;
        assertEquals((await view(room, 80))!.value.hand_no, 0, "a partial table does not deal");
        const seats = "abcdef".slice(0, capacity).split("");
        for (const [index, seat] of seats.entries()) {
          if (actors[seat] || index === capacity - 1) continue;
          actors[seat] = 83 + index;
          await join(actors[seat], room, seat);
          assertEquals((await view(room, 80))!.value.phase, "waiting");
        }
        const last = seats.at(-1)!;
        const finalRace = await Promise.all([join(90, room, last), join(91, room, last)]);
        assertEquals(finalRace.map(r => r.kind).sort(), ["accepted", "rejected"]);
        actors[last] = finalRace[0].kind === "accepted" ? 90 : 91;
        let current = (await view(room, 80))!;
        assertEquals([current.value.phase, current.value.hand_no, current.value.joined.length], ["playing", 1, capacity]);
        for (const seat of seats) {
          const player = (await view(room, actors[seat]))!;
          assertEquals([player.value.seat, player.value.hand.length], [seat, 3]);
          for (const privateSeat of seats) assertEquals(Object.hasOwn(player.value, privateSeat), false);
        }
        let moves = 0;
        while (current.value.phase !== "finished") {
          assert(++moves < 700, "team game did not finish");
          const state = current.value;
          const seat = state.phase === "brink" ? seats.find(s => "ab"[seats.indexOf(s) % 2] === state.brink)! : state.turn;
          const player = (await view(room, actors[seat]))!;
          const kind = state.phase === "hand_over" ? "next" : state.phase === "brink" ? "accept" : "play";
          const payload = kind === "play" ? {slot: player.value.available[0], covered: false} : {};
          assertEquals((await command(room, actors[seat], player.revision, kind, payload)).kind, "accepted");
          current = (await view(room, 80))!;
        }
        assertEquals(current.value[`score_${current.value.winner}` as "score_a"], current.value.goal);
        for (const actor of Object.values(actors)) assertEquals((await view(room, actor))!.revision, current.revision);
      });
    }

    await t.step("a three-pair challenge reserves two seats and waits for the other four", async () => {
      await show(92); await show(93);
      assertEquals((await offer(92, 93, 390, "douradinha", "2v2v2")).kind, "accepted");
      assertEquals((await answer(93, 390, "accept")).kind, "accepted");
      const room = (await challenge(93, 390))!.room;
      const before = (await view(room, 92))!;
      assertEquals([before.value.phase, before.value.joined, before.value.hand_no], ["waiting", ["a", "b"], 0]);
      assert(await sql(`SELECT count(*) FROM truco_match_public WHERE id = '${room}';`) === "1", "a waiting table is listed for the bar");
      for (const actor of [94, 95, 96, 97]) await insert(actor, "truco_match_open", {id: `seat/${room}/${actor}`, instance_id: room, kind: "join", input: {}});
      const after = (await view(room, 92))!;
      assertEquals([after.value.phase, after.value.hand_no, after.value.joined.length], ["playing", 1, 6]);
      assertEquals(await sql(`SELECT count(*) FROM truco_match_public WHERE id = '${room}';`), "0", "a full table leaves the listing");
    });

    await t.step("a reserved table is never listed, and a call fills the chair it names", async () => {
      await show(160); await show(161); await show(162);
      assertEquals((await insert(160, "truco_match_open", {id: uuid(170), instance_id: uuid(170), kind: "create", input: {variant: "mineiro", seating: "2v2", reserved: "true", talk: talkOf(170)}})).kind, "accepted");
      assertEquals(await sql(`SELECT count(*) FROM truco_match_public WHERE id = '${uuid(170)}';`), "0", "a reserved table stays off the bar's list");
      const call = (actor: number, id: number, target: number, chair: string) =>
        insert(actor, "truco_call_open", {id: uuid(id), instance_id: uuid(id), kind: "create", input: {target: uuid(target), room: uuid(170), chair}});
      assertEquals((await call(161, 171, 162, "c")).reason, "not_seated");
      // A call carries the name the caller's voice gives at the table, so a
      // caller whose voice sits nowhere yet is not yet at it.
      assertEquals((await call(160, 175, 161, "c")).reason, "not_seated");
      assertEquals((await insert(160, "truco_voice_open", {id: `voice/${uuid(160)}`, instance_id: uuid(160), kind: "create", input: {}})).kind, "accepted");
      const sat = await insert(160, "truco_voice_command", {id: `voice/${++commandId}`, instance_id: uuid(160),
        request: {version: 2, expected_revision: "0", event: {kind: "sit", payload: {room: uuid(170), talk: await sql(`SELECT state->>'talk' FROM hybrid_truco_match.instance WHERE id = '${uuid(170)}';`), seat: "a", name: "Ana"}}}});
      assertEquals(sat.kind, "accepted");
      // What everyone reads of the voice names the table by its talk, not by its room.
      assertEquals(await sql(as(162, `SELECT count(*) FROM truco_voice_public WHERE talk = '${talkOf(170)}';`)), "1");
      assertEquals((await call(160, 172, 161, "a")).reason, "chair_taken");
      assertEquals((await call(160, 173, 161, "c")).kind, "accepted");
      assertEquals(await sql(as(161, `SELECT caller_name FROM truco_call_seat WHERE instance_id = '${uuid(173)}';`)), "Ana");
      assertEquals((await call(160, 174, 162, "c")).reason, "chair_called");
      // Answered by sitting: the answer, and the join to the chair it names.
      const revision = await sql(as(161, `SELECT revision FROM truco_call_seat WHERE instance_id = '${uuid(173)}';`));
      const answered = await insert(161, "truco_call_command", {id: `call/${++commandId}`, instance_id: uuid(173), request: {version: 1, expected_revision: revision, event: {kind: "accept", payload: {}}}});
      assertEquals(answered.kind, "accepted");
      assertEquals((await join(161, 170, "c", `call/${uuid(173)}`)).kind, "accepted");
      const seated = (await view(170, 161))!;
      assertEquals([seated.value.seat, seated.value.joined], ["c", ["a", "c"]]);
    });

    await t.step("a chair at a waiting table is held at one table at a time", async () => {
      assertEquals((await create(165, 176, "mineiro", "2v2")).kind, "accepted");
      assertEquals((await create(166, 177, "mineiro", "2v2")).kind, "accepted");
      // Seated at 176 while it waits, 165 cannot take a chair at 177 too: the join is refused whole.
      const twice = await psql(as(165, `INSERT INTO truco_match_open (id, instance_id, kind, input) VALUES ('twice', '${uuid(177)}', 'join', '{}');`));
      assertEquals(twice.ok, false);
      assertStringIncludes(twice.err, "seated_elsewhere");
      assertEquals((await view(177, 165)), null);
      // Nor open another while it waits.
      assertEquals((await create(165, 178)).reason, "seated_elsewhere");
      // Someone at no waiting table sits at either.
      assertEquals((await join(167, 177)).kind, "accepted");
      // A guest stands up from a table still waiting: its chair is free again
      // and it sits nowhere, so it may sit at another.
      const standing = (await view(177, 167))!;
      assertEquals((await command(177, 167, standing.revision, "stand")).kind, "accepted");
      assertEquals(await view(177, 167), null);
      assertEquals((await view(177, 166))!.value.joined, ["a"]);
      assertEquals((await join(167, 176)).kind, "accepted");
      // Its opener cannot stand up from it: an opener closes the table.
      const opener = (await view(177, 166))!;
      assertEquals((await command(177, 166, opener.revision, "stand")).reason, "not_a_guest");
      // A talk names one table: another opened with it is refused whole.
      const reused = await psql(as(168, `INSERT INTO truco_match_open (id, instance_id, kind, input) VALUES ('${uuid(179)}', '${uuid(179)}', 'create', '${JSON.stringify({variant: "mineiro", seating: "1v1", talk: talkOf(176)})}');`));
      assertEquals(reused.ok, false);
      assertStringIncludes(reused.err, "talk_taken");
    });

    await t.step("a command resent under its key and two tabs at one revision apply one turn", async () => {
      await create(1, 11);
      await join(2, 11);
      const first = (await view(11, 1))!;
      const move = () => command(11, 1, first.revision, "play", {slot: 0, covered: false}, `11/${first.revision}/a/play0`);
      const raced = await Promise.all([move(), command(11, 1, first.revision, "play", {slot: 1, covered: false}, `11/${first.revision}/a/play1`)]);
      assertEquals(raced.map(v => v.kind).sort(), ["accepted", "rejected"]);
      assertEquals(await move(), raced[0]);
      const current = (await view(11, 1))!;
      assertEquals([current.value.plays.length, current.revision], [1, "2"]);
    });

    await t.step("the ticker times a turn out once and a late play is refused", async () => {
      await create(1, 12);
      await join(2, 12);
      assert(await sql(`SELECT count(*) FROM schedule WHERE emits_values @> '{"machine": "truco_match", "row": {"id": "${uuid(12)}"}}';`) === "1", "entering a timed phase arms the ticker");
      await overdue("hybrid_truco_match", uuid(12));
      assertEquals((await command(12, 1, "1", "play", {slot: 0, covered: false})).reason, "expired");
      await sql(`SELECT hybrid_truco_match.arm(i) FROM hybrid_truco_match.instance i WHERE i.id = '${uuid(12)}';`);
      await tick("truco_match", uuid(12));
      const snapshots = await Promise.all([view(12, 1), view(12, 2)]);
      assertEquals(snapshots.map(v => v!.revision), ["2", "2"]);
      assertEquals(snapshots[0]!.value.plays.length, 1);
      await retick("truco_match", uuid(12));
      assertEquals((await view(12, 1))!.revision, "2", "a tick for a deadline already met does nothing");
    });

    // The ticker fired a deadline by its clock and the database, behind it,
    // read the deadline as not yet met and armed it again.
    await t.step("a deadline is met at the tick's time, whatever the database's clock reads", async () => {
      await create(1, 13);
      await join(2, 13);
      const deadline = await sql(`SELECT state->>'deadline' FROM hybrid_truco_match.instance WHERE id = '${uuid(13)}';`);
      assert(Number(deadline) > Date.now(), "the turn is still running by every clock but the tick's");
      await tick("truco_match", uuid(13));
      assertEquals((await view(13, 1))!.revision, "2");
      assertEquals(await sql(`SELECT now FROM hybrid_truco_match.receipt WHERE instance_id = '${uuid(13)}' AND command_id = 'mecha/1';`), deadline,
        "the timeout's step ran at the tick's time, and its receipt says so");
    });

    // A tick the ticker sent a minute late ran its step at the deadline, so
    // the next turn's deadline was born a minute in the past and the next
    // sweep timed that player out without a turn.
    await t.step("a late tick runs its step when it was decided, and the next turn is whole", async () => {
      await create(1, 14);
      await join(2, 14);
      const late = Date.now() - 60_000;
      await sql(`UPDATE hybrid_truco_match.instance SET state = jsonb_set(state, '{deadline}', '${late}') WHERE id = '${uuid(14)}';
        SELECT hybrid_truco_match.arm(i) FROM hybrid_truco_match.instance i WHERE i.id = '${uuid(14)}';`);
      await tick("truco_match", uuid(14));
      assertEquals((await view(14, 1))!.revision, "2");
      const ran = Number(await sql(`SELECT now FROM hybrid_truco_match.receipt WHERE instance_id = '${uuid(14)}' AND command_id = 'mecha/1';`));
      const next = Number(await sql(`SELECT state->>'deadline' FROM hybrid_truco_match.instance WHERE id = '${uuid(14)}';`));
      assert(ran >= late + 50_000, `the step ran at ${ran}, near the tick's transaction, not at the deadline ${late}`);
      assert(next > Date.now(), "the next turn's deadline is still ahead");
    });

    // A tick met an instance whose deadline was gone, read the deadline 0 as
    // due, and its delivery was refused: the tick's transaction aborted, and
    // so did every retry of it. A tick at any time, in any timed phase, times
    // the instance out or arms it again, and never aborts.
    await t.step("a tick at any time, with any deadline, times out or arms again, and never aborts", async () => {
      await create(1, 15);
      await join(2, 15);
      await show(45);
      await show(46);
      await show(47);
      assertEquals((await offer(46, 47, 370)).kind, "accepted");
      const timed = [
        {machine: "truco_match", schema: "hybrid_truco_match", instance: uuid(15), field: "deadline"},
        {machine: "truco_presence", schema: "hybrid_truco_presence", instance: uuid(45), field: "until"},
        {machine: "truco_challenge", schema: "hybrid_truco_challenge", instance: uuid(370), field: "deadline"},
      ];
      for (const {machine, schema, instance, field} of timed) {
        const read = async () => JSON.parse(await sql(`SELECT jsonb_build_object('revision', revision::text, 'due', (state->>'${field}')::bigint) FROM ${schema}.instance WHERE id = '${instance}';`)) as {revision: string; due: number};
        // The tick the ticker would send at `at`, for the schedule standing or one since replaced.
        const tickAt = (at: number) => psql(`INSERT INTO machine_timer_tick (id, schedule, tick_at, late, machine, "row", state, delay)
          SELECT gen_random_uuid(), coalesce((SELECT s.name FROM schedule s WHERE s.emits_values @> jsonb_build_object('machine', '${machine}', 'row', jsonb_build_object('id', '${instance}'))), 'replaced'),
            to_timestamp(${at} / 1000.0), false, '${machine}', jsonb_build_object('id', '${instance}'), i.state->>'phase', '0'
          FROM ${schema}.instance i WHERE i.id = '${instance}';`);
        const armed = async () => Number(await sql(`SELECT count(*) FROM schedule WHERE emits_values @> jsonb_build_object('machine', '${machine}', 'row', jsonb_build_object('id', '${instance}'));`));
        const before = await read();
        assert(before.due > 0, `${machine} waits on a deadline`);
        const early = await tickAt(before.due - 5000);
        assertEquals(early.ok, true, `${machine}, early: ${early.err}`);
        assertEquals((await read()).revision, before.revision, `${machine}: an early tick moves nothing`);
        assertEquals(await armed(), 1, `${machine}: an early tick arms the deadline again`);
        await sql(`UPDATE ${schema}.instance SET state = jsonb_set(state, '{${field}}', '0') WHERE id = '${instance}';`);
        const gone = await tickAt(before.due);
        assertEquals(gone.ok, true, `${machine}, no deadline: ${gone.err}`);
        assertEquals((await read()).revision, before.revision, `${machine}: a tick with no deadline moves nothing`);
        await sql(`UPDATE ${schema}.instance SET state = jsonb_set(state, '{${field}}', '${before.due}') WHERE id = '${instance}';
          SELECT ${schema}.arm(i) FROM ${schema}.instance i WHERE i.id = '${instance}';`);
        const due = await tickAt(before.due);
        assertEquals(due.ok, true, `${machine}, due: ${due.err}`);
        assertEquals(Number((await read()).revision), Number(before.revision) + 1, `${machine}: a tick at the deadline times it out`);
      }
    });

    for (const [room, variant] of [[20, "mineiro"], [21, "paulista"]] as const) {
      await t.step(`complete ${variant} match from room creation to final score`, async () => {
        await create(1, room, variant);
        await join(2, room);
        let moves = 0;
        for (;;) {
          const a = (await view(room, 1))!;
          const b = (await view(room, 2))!;
          assertEquals([a.revision, a.value.score_a, a.value.score_b], [b.revision, b.value.score_a, b.value.score_b]);
          if (a.value.phase === "finished") {
            assert(a.value.score_a === 12 || a.value.score_b === 12);
            assertEquals((await command(room, 1, a.revision, "next")).reason, "illegal_event");
            break;
          }
          assert(++moves < 400, "match did not finish");
          const state = a.value;
          const seat = state.phase === "brink" ? state.brink : state.turn;
          const current = seat === "a" ? a : b;
          const kind = state.phase === "hand_over" ? "next" : state.phase === "brink" ? "accept" : "play";
          const payload = kind === "play" ? {slot: current.value.available[0], covered: false} : {};
          assertEquals((await command(room, seat === "a" ? 1 : 2, current.revision, kind, payload)).kind, "accepted");
        }
      });
    }

    await t.step("two readers complete a match through PostgREST as the browser's store writes it", async () => {
      const secret = "truco-test-only-jwt-secret-32-bytes-long";
      const rest = await run("docker", ["run", "-d", "--rm", "--name", `${container}-rest`, "--network", `container:${container}`,
        "-e", "PGRST_DB_URI=postgres://authenticator:proof@127.0.0.1:5432/postgres", "-e", `PGRST_JWT_SECRET=${secret}`, "-e", "PGRST_DB_ANON_ROLE=anon",
        "-e", "PGRST_DB_PRE_REQUEST=public.app_pre_request",
        "postgrest/postgrest:v16.4@sha256:d155c6718ed9a9f990d159a2ab7c0a3f16944dbb6d0a0344557421042acfe0df"]);
      if (!rest.ok) throw new Error(rest.err);
      restStarted = true;
      const port = await run("docker", ["port", container, "3000/tcp"]);
      if (!port.ok) throw new Error(port.err);
      const origin = `http://${port.out}`;
      const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
      const token = async (actor: number) => {
        const header = encode(new TextEncoder().encode(JSON.stringify({alg: "HS256", typ: "JWT"})));
        const payload = encode(new TextEncoder().encode(JSON.stringify({role: "app_user", sub: uuid(actor), exp: Math.floor(Date.now() / 1000) + 3600})));
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name: "HMAC", hash: "SHA-256"}, false, ["sign"]);
        const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`));
        return `${header}.${payload}.${encode(new Uint8Array(signature))}`;
      };
      for (let i = 0; ; i++) {
        try {
          const response = await fetch(origin);
          await response.arrayBuffer();
          if (response.ok) break;
        } catch (error) { if (!(error instanceof TypeError)) throw error; }
        if (i >= 60) throw new Error("PostgREST did not start");
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      const tokens = {1: await token(1), 2: await token(2)} as Record<number, string>;
      // The proxy's Prefer on every POST: a redelivered insert is absorbed.
      const post = async (actor: number, table: string, row: Record<string, unknown>) => {
        const response = await fetch(`${origin}/${table}`, {method: "POST", headers: {"Content-Type": "application/json", Authorization: `Bearer ${tokens[actor]}`,
          Prefer: "return=representation,resolution=ignore-duplicates"}, body: JSON.stringify(row)});
        const body = await response.text();
        if (!response.ok) throw new Error(`${table}: ${response.status} ${body}`);
      };
      const read = async (actor: number, table: string, filter: string) => {
        const response = await fetch(`${origin}/${table}?${filter}`, {headers: {Authorization: `Bearer ${tokens[actor]}`}});
        if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
        return await response.json() as Record<string, string>[];
      };
      const room = uuid(30);
      await post(1, "truco_match_open", {id: room, instance_id: room, kind: "create", input: JSON.stringify({variant: "mineiro", seating: "1v1", talk: talkOf(990)})});
      await post(2, "truco_match_open", {id: `join/${room}/2`, instance_id: room, kind: "join", input: "{}"});
      assertEquals((await read(1, "truco_match_seat", `instance_id=eq.${room}`)).map(s => s.seat), ["a"], "each reader reads their own seat");
      let moves = 0;
      for (;;) {
        const [a] = await read(1, "truco_match_seat", `instance_id=eq.${room}`);
        const [b] = await read(2, "truco_match_seat", `instance_id=eq.${room}`);
        const views = {a: JSON.parse(a.view) as View, b: JSON.parse(b.view) as View};
        if (views.a.phase === "finished") break;
        assert(++moves < 400, "match did not finish over HTTP");
        const seat = views.a.phase === "brink" ? views.a.brink : views.a.turn as "a" | "b";
        const mine = seat === "a" ? a : b;
        const kind = views.a.phase === "hand_over" ? "next" : views.a.phase === "brink" ? "accept" : "play";
        const payload = kind === "play" ? {slot: views[seat as "a" | "b"].available[0], covered: false} : {};
        const id = `${room}/${mine.revision}/${seat}/${kind}${kind === "play" ? (payload as {slot: number}).slot : ""}`;
        const request = JSON.stringify({version: spec.version, expected_revision: String(mine.revision), event: {kind, payload}});
        await post(seat === "a" ? 1 : 2, "truco_match_command", {id, instance_id: room, request});
        // A lost reply resends the same row, which is absorbed.
        await post(seat === "a" ? 1 : 2, "truco_match_command", {id, instance_id: room, request});
        const [stamped] = await read(seat === "a" ? 1 : 2, "truco_match_command", `id=eq.${encodeURIComponent(id)}`);
        assertEquals(stamped.outcome, "accepted");
      }
    });
  } finally {
    if (restStarted) await stop(`${container}-rest`);
    await stop(container);
  }
}});
