// The arena's bar and an online match at its table, mounted on the harness's store and held clock.
// The cluster's side is played by writing the rows it would write — seats and
// receipts — so what is checked here is the browser's half of the protocol:
// every gesture a keyed row, every draw the terminal's, nothing else.
import { assert, assertEquals } from "jsr:@std/assert@1.0.11";
import { mountApp, type Mounted } from "./platform.ts";
import { initialMatch, matchFixture } from "./online-fixture.ts";

const APP = new URL("../", import.meta.url);
const ROOM = "00000000-0000-0000-0000-000000000500";
const ME = "00000000-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-000000000002";

const surface = { truco_match_seat: [], truco_match_command: [], truco_match_open: [], truco_presence_seat: [], truco_presence_public: [],
  truco_presence_lease: [], truco_presence_command: [], truco_challenge_seat: [], truco_challenge_command: [], truco_challenge_open: [],
  truco_voice_seat: [], truco_voice_command: [], truco_voice_open: [], truco_voice_public: [],
  truco_match_public: [], truco_call_seat: [], truco_call_command: [], truco_call_open: [], chair: [], listed_table: [] };
// A reader's rows carry the reader the database stamps them with (`actor`
// defaults to auth_uid()), which is what keeps them the reader's own.
const cluster = { me: ME, defaults: Object.fromEntries(["truco_match_command", "truco_match_open", "truco_presence_lease", "truco_presence_command", "truco_challenge_command", "truco_challenge_open", "truco_voice_command", "truco_voice_open", "truco_call_command", "truco_call_open"].map((t) => [t, { actor: ME }])) };
const arena = (tables: Record<string, Record<string, unknown>[]> = {}) => mountApp({ appDir: APP, screen: "arena", seed: 7, cluster, mountHostDom: false,
  tables: { ...surface, match: [], round: [], play: [], held: [], intent: [], lobby_tab: [], player: [{ id: "you", handle: "Bia" }], ...tables } });
const lobby = (tables: Record<string, Record<string, unknown>[]> = {}) => mountApp({ appDir: APP, screen: "arena", seed: 7, cluster, mountHostDom: false,
  tables: { ...surface, match: [], round: [], play: [], held: [], intent: [], lobby_tab: [], player: [{ id: "you", handle: "Davi" }], ...tables } });
// The lobby renews forever, so its clock is stepped rather than settled.
const step = async (m: Mounted, ms = 0) => { m.advance(ms); await m.quiet(); };

Deno.test({ name: "an online match is played at the arena, from your seat, and every gesture is a command the match keys", sanitizeOps: false, sanitizeResources: false, async fn() {
  // You joined by the table's code, so you hold seat "b": the felt still draws
  // you at the bottom and the one who opened it across from you, by the name
  // their voice gives at this table — no challenge named either of you.
  const { step: play } = await matchFixture();
  const started = await play({ ...initialMatch(), joined: ["a", "b"] }, "start", "a", { seats: ["a", "b"] });
  const viewOf = (answer: typeof started) => answer.views.find((v) => v.viewer === "b")!.value;
  const seat = (revision: number, answer: typeof started) => ({ id: `${ROOM}/b`, instance_id: ROOM, actor: ME, seat: "b", revision: String(revision), phase: viewOf(answer).phase, view: (viewOf(answer)), variant: "mineiro", seating: "1v1" });
  // A voice names its table by the match's talk, never by its room.
  const theirs = (n: number, word: string) => ({ id: OTHER, talk: "talk-of-the-table", seat: "a", name: "Ana", word, n: String(n) });
  const voice = (revision: number, said: Record<string, unknown>) => ({ id: `${ME}/owner`, instance_id: ME, actor: ME, seat: "owner", revision: String(revision), phase: said.room ? "seated" : "quiet",
    view: ({ phase: said.room ? "seated" : "quiet", room: "", seat: "", name: "", word: "", n: 0, ...said }) });
  // Ana had shouted at another table before this one: that is not heard here.
  const m = await arena({ truco_match_seat: [seat(1, started)], truco_voice_public: [theirs(4, "desce")] });
  await step(m);
  const table = m.rows("match").find((r) => r.id === "table")!;
  assertEquals([table.opponent, table.opponent_name, table.opponent_handle, table.status], ["online", "opponent_online", "Ana", "playing"]);
  // The table just filled: its first hand opens on that, until a card is laid.
  assertEquals(table.filled, "yes");
  assertEquals(m.rows("round").find((r) => r.current === "yes")!.shout_state, "gone");
  assertEquals(m.rows("held").filter((h) => h.seat === "you" && h.current === "yes").length, 3);
  assertEquals(m.rows("held").filter((h) => h.seat === "eles1" && h.current === "yes").length, 3);

  // Your voice is opened the first time a match seats you, and sat at this table under your name.
  assertEquals(m.rows("truco_voice_open").map((o) => [o.id, o.instance_id, o.kind]), [[`voice/${ME}`, ME, "create"]]);
  await m.store.put("truco_voice_seat", voice(1, {}));
  await step(m);
  const [sat] = m.rows("truco_voice_command");
  assertEquals(sat.id, `${ME}/1/owner/sitb`);
  assertEquals((sat.request), { version: 2, expected_revision: "1", event: { kind: "sit", payload: { room: ROOM, talk: "talk-of-the-table", seat: "b", name: "Bia" } } });
  await m.store.update("truco_voice_command", sat.id, { outcome: "accepted", revision: "2" });
  await m.store.put("truco_voice_seat", voice(2, { room: ROOM, talk: "talk-of-the-table", seat: "b", name: "Bia" }));
  await step(m);
  assertEquals(m.rows("truco_voice_command").length, 1, "a voice already sat here is sat again");

  // The hand is led by seat "a": a card of yours asks nothing of the match yet.
  assert(m.one("#opponent-avatar-ring #opponent-lego-avatar") !== null, "online opponent lego avatar is rendered");
  m.fire(m.all("#seat-you .card")[0]);
  await step(m);
  assertEquals(m.rows("truco_match_command").length, 0, "a card was sent out of turn");

  // Hovering a card in your hand signals the slot on your voice; hearing the
  // opponent hover theirs moves their avatar gaze and card back via data-tell
  // without opening a shout bubble.
  m.fire(m.all("#seat-you .card")[1], "pointerenter");
  await step(m);
  const peeked = m.rows("truco_voice_command").find((c) => c.id === `${ME}/2/owner/peek1`);
  assert(peeked !== undefined, `the voice commands are ${JSON.stringify(m.rows("truco_voice_command"))}`);
  assertEquals((peeked.request).event, { kind: "shout", payload: { word: "peek1" } });
  await m.store.update("truco_voice_command", peeked.id, { outcome: "accepted", revision: "3" });
  await m.store.put("truco_voice_seat", voice(3, { room: ROOM, talk: "talk-of-the-table", seat: "b", name: "Bia" }));
  await m.store.put("truco_voice_public", theirs(5, "peek1"));
  await step(m);
  assertEquals(m.one("#seats").getAttribute("data-tell"), "eles1-1");
  assertEquals(m.rows("round").find((r) => r.current === "yes")!.shout_state, "gone");

  // The inviter plays covered (encoberto) from slot 0; slot 0 leaves their hand,
  // lands face-down on the mat, and the turn is yours.
  const led = await play(started.state, "play", "a", { slot: 0, covered: true });
  await m.store.put("truco_match_seat", seat(2, led));
  await step(m);
  assertEquals(m.rows("match").find((r) => r.id === "table")!.filled, "");
  assertEquals(m.rows("held").filter((h) => h.seat === "eles1" && h.current === "yes").map((h) => h.slot), ["1", "2"]);
  assertEquals(m.one(".matcards .played").getAttribute("data-said"), "encoberta");
  m.fire("#btn-encobrir");
  await step(m);
  assertEquals(m.one("#btn-encobrir").getAttribute("data-active"), "yes");
  m.fire(m.all("#seat-you .card")[0]);
  await step(m);
  assertEquals(m.one("#btn-encobrir").getAttribute("data-active"), "no");
  const [laid] = m.rows("truco_match_command");
  const slot = viewOf(led).available[0];
  assertEquals(laid.id, `${ROOM}/2/b/play${slot}`);
  assertEquals((laid.request), { version: 8, expected_revision: "2", event: { kind: "play", payload: { slot, covered: true } } });

  // A shout is your voice's, never the match's: it cannot move the game under a card in flight.
  m.fire("#shout-chama");
  await step(m);
  assertEquals(m.rows("truco_match_command").length, 1, "a shout went to the match");
  const shouted = m.rows("truco_voice_command").find((c) => String(c.id).includes("/shout_chama"));
  assert(shouted !== undefined, `the voice's commands are ${JSON.stringify(m.rows("truco_voice_command"))}`);
  assertEquals((shouted.request).event, { kind: "shout", payload: { word: "chama" } });
  // One the voice moved under is shouted again at the revision it holds now.
  await m.store.update("truco_voice_command", shouted.id, { outcome: "rejected", reason: "stale_revision", revision: "4" });
  await m.store.put("truco_voice_seat", voice(4, { room: ROOM, talk: "talk-of-the-table", seat: "b", name: "Bia" }));
  await step(m);
  const tag = String(shouted.id).split("/").slice(3).join("/");
  assert(m.rows("truco_voice_command").some((c) => c.id === `${ME}/4/owner/${tag}`), `the voice's commands are ${JSON.stringify(m.rows("truco_voice_command"))}`);

  // Ana shouts back, and the table says it from her side.
  await m.store.put("truco_voice_public", theirs(6, "manda"));
  await step(m);
  const round = m.rows("round").find((r) => r.current === "yes")!;
  assertEquals([round.shout_word, round.shout_from, round.shout_state], ["shout_manda", "them", "live"]);

  // A card laid at a revision the table moved past is laid again at the one
  // the seat holds now — once Ana's shout has faded, which the fold waits out.
  await m.store.update("truco_match_command", laid.id, { outcome: "rejected", reason: "stale_revision", revision: "3" });
  await m.store.put("truco_match_seat", seat(3, led));
  await step(m, 1800);
  const again = m.rows("truco_match_command").find((c) => c.id === `${ROOM}/3/b/play${slot}`);
  assert(again !== undefined, `the commands are ${JSON.stringify(m.rows("truco_match_command"))}`);

  // Regression: when a hand ends (hand_over), the table deals the next hand on
  // the terminal's beat even if an older command row has not replicated its
  // outcome yet, continuing the match across hands to 12 tentos.
  const raised = await play(led.state, "raise", "b");
  const ended = await play(raised.state, "fold", "a");
  assertEquals(viewOf(ended).phase, "hand_over");
  await m.store.put("truco_match_seat", seat(4, ended));
  await step(m);
  await step(m, 1800);
  await step(m, 1000);
  const nextCmd = m.rows("truco_match_command").find((c) => c.id === `${ROOM}/4/b/next`);
  assert(nextCmd !== undefined, `expected next command at revision 4, got ${JSON.stringify(m.rows("truco_match_command"))}`);
  const hand2 = await play(ended.state, "next", "b");
  await m.store.put("truco_match_seat", seat(5, hand2));
  await step(m);
  assertEquals(m.rows("round").find((r) => r.current === "yes")!.hand_no, "2");
  assertEquals(m.rows("held").filter((h) => h.seat === "you" && h.current === "yes").length, 3);
  await m.stop();
} });

Deno.test({ name: "the bar leases your tab by a drawn key and renews it on the terminal's clock, and every gesture is a row", sanitizeOps: false, sanitizeResources: false, async fn() {
  const m = await lobby();
  await step(m);
  const [tab] = m.rows("lobby_tab");
  const [lease] = m.rows("truco_presence_lease");
  assert(tab !== undefined && lease !== undefined && tab.lease === lease.id && String(lease.id).length === 36, `the lease is ${JSON.stringify(m.rows("truco_presence_lease"))}`);
  await step(m, 10000);
  assertEquals(Number(m.rows("truco_presence_lease")[0].beat), 1, "the lease renews on the terminal's clock");
  await step(m, 10000);
  assertEquals(Number(m.rows("truco_presence_lease")[0].beat), 2, "and keeps renewing, once per beat");

  // The cluster admits you; the toggle shows you under your device's name.
  await m.store.put("truco_presence_seat", { id: `${ME}/owner`, instance_id: ME, actor: ME, seat: "owner", revision: "2", phase: "hidden", view: {}, name: "" });
  await step(m);
  m.fire("#btn-toggle-online");
  await step(m);
  const [show] = m.rows("truco_presence_command");
  assertEquals(show.id, `${ME}/2/owner/show`);
  // The switch answers the click, not the cluster: the bar shows you in the
  // round while the seat is still hidden.
  assertEquals([m.rows("lobby_tab")[0].shown, m.rows("truco_presence_seat")[0].phase], ["show", "hidden"]);
  assertEquals(m.one("#btn-toggle-online").getAttribute("aria-checked"), "true");
  assertEquals((show.request).event, { kind: "show", payload: { name: "Davi" } });

  // A renewal moves the revision under a click: the command comes back stale,
  // and the bar sends it again at the revision the seat now holds.
  await m.store.put("truco_presence_command", { ...show, outcome: "rejected", reason: "stale_revision" });
  await m.store.put("truco_presence_seat", { id: `${ME}/owner`, instance_id: ME, actor: ME, seat: "owner", revision: "5", phase: "hidden", view: {}, name: "" });
  await step(m);
  const retried = m.rows("truco_presence_command").find((c) => c.id === `${ME}/5/owner/show`);
  assert(retried !== undefined, `the commands are ${JSON.stringify(m.rows("truco_presence_command"))}`);
  assertEquals((retried.request).event, { kind: "show", payload: { name: "Davi" } });

  // Renamed while online, you are listed under the new name: the bar sends it
  // again, since the listing carries the name you went online with.
  await m.store.put("truco_presence_seat", { id: `${ME}/owner`, instance_id: ME, actor: ME, seat: "owner", revision: "6", phase: "visible", view: {}, name: "Davi" });
  await m.store.upsert("player", { id: "you", handle: "Carol" });
  await step(m);
  const rename = m.rows("truco_presence_command").find((c) => c.id === `${ME}/6/owner/show`);
  assert(rename !== undefined, `the commands are ${JSON.stringify(m.rows("truco_presence_command"))}`);
  assertEquals((rename.request).event, { kind: "show", payload: { name: "Carol" } });
  // A command row is sealed once written: renamed again before the seat moves
  // on, the bar leaves the one it sent and waits for the next revision.
  await m.store.upsert("player", { id: "you", handle: "Dora" });
  await m.store.update("lobby_tab", "the", { note: "lobby_need_handle" });
  await step(m);
  const kept = m.rows("truco_presence_command").find((c) => c.id === `${ME}/6/owner/show`);
  assertEquals((kept!.request).event, { kind: "show", payload: { name: "Carol" } });
  // Clearing the name is forgetting it, and a seat with no name left to be
  // listed by leaves the round rather than staying listed under the old one.
  await m.store.put("truco_presence_seat", { id: `${ME}/owner`, instance_id: ME, actor: ME, seat: "owner", revision: "7", phase: "visible", view: {}, name: "Carol" });
  await m.store.upsert("player", { id: "you", handle: "" });
  await step(m);
  const left = m.rows("truco_presence_command").find((c) => c.id === `${ME}/7/owner/hide`);
  assert(left !== undefined, `the commands are ${JSON.stringify(m.rows("truco_presence_command"))}`);

  // You are listed to yourself as the others see you, marked and with no one
  // to challenge; another player is, and challenging them opens a challenge.
  await m.store.upsert("player", { id: "you", handle: "Davi" });
  // A backgrounded tab whose lease row expires on the ticker, or whose lease
  // lapses before "Entrar na roda" is clicked (refused as "disconnected"),
  // re-puts its lease and resends show once the renewed lease advances the seat.
  await m.store.remove("truco_presence_lease", String(lease.id));
  await m.store.put("truco_presence_seat", { id: `${ME}/owner`, instance_id: ME, actor: ME, seat: "owner", revision: "8", phase: "hidden", view: {}, name: "" });
  await step(m);
  assertEquals(m.rows("truco_presence_lease").map((l) => [l.id, Number(l.beat)]), [[lease.id, 0]]);
  m.fire("#btn-toggle-online");
  await step(m);
  const show8 = m.rows("truco_presence_command").find((c) => c.id === `${ME}/8/owner/show`)!;
  await m.store.put("truco_presence_command", { ...show8, outcome: "rejected", reason: "disconnected" });
  await step(m);
  assertEquals(Number(m.rows("truco_presence_lease")[0].beat), 9);
  assertEquals(m.one("#btn-toggle-online").getAttribute("aria-checked"), "true");
  await m.store.put("truco_presence_seat", { id: `${ME}/owner`, instance_id: ME, actor: ME, seat: "owner", revision: "9", phase: "hidden", view: {}, name: "" });
  await step(m);
  assert(m.rows("truco_presence_command").some((c) => c.id === `${ME}/9/owner/show`), `expected show retry at revision 9, got ${JSON.stringify(m.rows("truco_presence_command"))}`);
  await m.store.put("truco_presence_seat", { id: `${ME}/owner`, instance_id: ME, actor: ME, seat: "owner", revision: "10", phase: "visible", view: {}, name: "Davi" });
  await m.store.put("truco_presence_public", { id: ME, name: "Davi" });
  await m.store.put("truco_presence_public", { id: OTHER, name: "Bia" });
  await step(m);
  assertEquals(m.all(".lobby-players-list .lobby-player-row.self .player-handle").map((b) => b.textContent), ["Davi"]);
  assertEquals(m.all(".lobby-players-list .lobby-player-row.self button").length, 0);
  assertEquals(m.all("#lobby-players-list .lobby-player-row:not(.self) .player-handle").map((b) => b.textContent), ["Bia"]);
  m.fire(`#challenge-${OTHER}`);
  await step(m);
  const [offer] = m.rows("truco_challenge_open");
  assert(offer !== undefined && offer.kind === "create" && offer.id === offer.instance_id, `the challenge rows are ${JSON.stringify(m.rows("truco_challenge_open"))}`);
  const { talk: dealt, ...offered } = (offer.input);
  assertEquals(offered, { target: OTHER, variant: "mineiro", seating: "1v1" });
  assert(/^[0-9a-f]{16}$/.test(dealt), `the dealt table's talk is ${dealt}`);

  // A table opened for a friend is keyed by its code, spelled in the
  // language of the bar it was opened from; its code takes the button's
  // place once the table seats you, and the bar opens no second one.
  m.fire("#online-create-pt");
  await step(m);
  const [created] = m.rows("truco_match_open");
  const { talk, ...rules } = (created.input);
  assertEquals([created.kind, rules], ["create", { variant: "mineiro", seating: "1v1", reserved: "false" }]);
  assert(/^[0-9a-f]{16}$/.test(talk), `the table's talk is ${talk}`);
  assert(String(created.instance_id).startsWith("7275636f-6d65-4573-8a00-0"), `opened ${created.instance_id}`);
  // A table the cluster refused to open says why on the bar.
  await m.store.update("truco_match_open", String(created.id), { outcome: "rejected", reason: "seated_elsewhere" });
  await step(m);
  assertEquals(m.rows("lobby_tab")[0].note, "online_seated_elsewhere");
  const { step: play } = await matchFixture();
  const waiting = await play({ ...initialMatch(), joined: [] }, "start", "a", { seats: ["a"] });
  const view = waiting.views.find((v) => v.viewer === "a")!.value;
  await m.store.put("truco_match_seat", { id: `${created.instance_id}/a`, instance_id: created.instance_id, actor: ME, seat: "a", revision: "1", phase: "waiting", view: (view), variant: "mineiro", seating: "1v1" });
  await step(m);
  assertEquals(view.phase, "waiting");
  assert(/^[a-z]+-[a-z]+-[a-z]+-[0-9a-z]{4}$/.test(m.one("#table-code").textContent ?? ""), `the code is ${m.one("#table-code").textContent}`);
  // Regression: a call made before your voice sat at the table was refused as
  // not seated. The chairs, and "Sair"/"Fechar", are drawn at once; only a
  // call waits for the voice.
  assertEquals(m.rows("chair").map((c) => [c.id, c.state, c.callable]), [["a", "you", ""], ["b", "free", ""]]);
  await m.store.put("truco_voice_seat", { id: `${ME}/owner`, instance_id: ME, actor: ME, seat: "owner", revision: "2", phase: "seated", view: ({ phase: "seated", room: created.instance_id, talk: "talk-of-the-table", seat: "a", name: "Davi", word: "", n: 0 }) });
  await step(m);
  // Its chairs are drawn from where you sit: yours, and the free one across, callable now.
  assertEquals(m.rows("chair").map((c) => [c.id, c.at, c.team, c.state, c.callable]), [["a", "you", "nos", "you", ""], ["b", "eles1", "eles", "free", "yes"]]);
  await m.stop();
} });

Deno.test({ name: "the bar lists the tables waiting for a player, calls the roda to your free chairs, and a call answered sits you in its chair", sanitizeOps: false, sanitizeResources: false, async fn() {
  const m = await lobby();
  await step(m);
  // A table on the bar is named by who opened it.
  // A table a challenge dealt has a room that spells no code, and is sat at by that room.
  const listed = "0f0e0d0c-0b0a-4908-8706-050403020100";
  await m.store.put("truco_match_public", { id: listed, variant: "paulista", seating: "2v2", talk: "zes-talk", seated: 3, places: 4 });
  await m.store.put("truco_voice_public", { id: OTHER, talk: "zes-talk", seat: "a", name: "Zé", word: "", n: "0" });
  await step(m);
  assertEquals(m.rows("listed_table").map((t) => [t.id, t.host, t.rules, t.seating, Number(t.missing)]), [[listed, "Zé", "variant_paulista_short", "2v2", 1]]);
  m.fire(`#sit-${listed}`);
  await step(m);
  const [joined] = m.rows("truco_match_open");
  assert(joined !== undefined && joined.kind === "join" && joined.instance_id === listed, `the open rows are ${JSON.stringify(m.rows("truco_match_open"))}`);

  // Your own table, waiting: its chairs from where you sit, your partner's across.
  const { step: play } = await matchFixture();
  const waiting = await play({ ...initialMatch("mineiro", "2v2"), joined: [] }, "start", "a", { seats: ["a"] });
  const view = waiting.views.find((v) => v.viewer === "a")!.value;
  const room = "7275636f-6d65-4573-8a00-00000000000a";
  await m.store.put("truco_match_seat", { id: `${room}/a`, instance_id: room, actor: ME, seat: "a", revision: "1", phase: "waiting", view: (view), variant: "mineiro", seating: "2v2" });
  await m.store.put("truco_voice_seat", { id: `${ME}/owner`, instance_id: ME, actor: ME, seat: "owner", revision: "2", phase: "seated", view: ({ phase: "seated", room: room, talk: "talk-of-the-table", seat: "a", name: "Davi", word: "", n: 0 }) });
  await step(m);
  assertEquals(m.rows("chair").map((c) => [c.id, c.at, c.team, c.state]), [["a", "you", "nos", "you"], ["b", "eles1", "eles", "free"], ["c", "parca", "nos", "free"], ["d", "eles2", "eles", "free"]]);

  // A free chair picked is the one a call from the roda fills.
  m.fire("#chair-c");
  await step(m);
  assertEquals(m.rows("lobby_tab")[0].chair, "c");
  await m.store.put("truco_presence_public", { id: OTHER, name: "Bia" });
  await step(m);
  m.fire(`#summon-${OTHER}`);
  await step(m);
  const [called] = m.rows("truco_call_open");
  assert(called !== undefined && called.kind === "create", `the call rows are ${JSON.stringify(m.rows("truco_call_open"))}`);
  assertEquals((called.input), { target: OTHER, room, chair: "c" });
  assertEquals([m.rows("lobby_tab")[0].chair, m.rows("lobby_tab")[0].call], ["", called.id]);
  // A call refused says why on the bar.
  await m.store.update("truco_call_open", String(called.id), { outcome: "rejected", reason: "chair_called" });
  await step(m);
  assertEquals([m.rows("lobby_tab")[0].note, m.rows("lobby_tab")[0].call], ["call_chair_called", ""]);
  // With no chair picked, the call goes to your partner's before the others'.
  m.fire(`#summon-${OTHER}`);
  await step(m);
  const again = m.rows("truco_call_open").find((o) => o.id !== called.id);
  assertEquals((again?.input).chair, "c");

  // The chair a call is out to shows who it is for; tapped, the call is taken back.
  const call = String(called.instance_id);
  await m.store.put("truco_call_seat", { id: `${call}/caller`, instance_id: call, actor: ME, seat: "caller", revision: "1", phase: "offered", view: ({ target_name: "Bia" }), caller_name: "Davi", room, chair: "c", variant: "mineiro", seating: "2v2" });
  await step(m);
  assertEquals(m.rows("chair").find((c) => c.id === "c")?.state, "called");
  assertEquals(m.rows("chair").find((c) => c.id === "c")?.name, "Bia");
  m.fire("#chair-c");
  await step(m);
  assert(m.rows("truco_call_command").some((c) => c.id === `${call}/1/caller/cancel`), `the call commands are ${JSON.stringify(m.rows("truco_call_command"))}`);

  // One table at a time: sitting at a listed table while yours waits is refused here.
  m.fire(`#sit-${listed}`);
  await step(m);
  assertEquals([m.rows("lobby_tab")[0].note, m.rows("truco_match_open").length], ["online_seated_elsewhere", 1]);

  // Closing your table before a hand is dealt resigns it.
  m.fire("#close-table");
  await step(m);
  assert(m.rows("truco_match_command").some((c) => c.id === `${room}/1/a/resign`), `the match commands are ${JSON.stringify(m.rows("truco_match_command"))}`);
  // Someone sitting down moved the table under the click: it is closed at the revision it holds now.
  await m.store.update("truco_match_command", `${room}/1/a/resign`, { outcome: "rejected", reason: "stale_revision", revision: "2" });
  await m.store.put("truco_match_seat", { id: `${room}/a`, instance_id: room, actor: ME, seat: "a", revision: "2", phase: "waiting", view: (view), variant: "mineiro", seating: "2v2" });
  await step(m);
  assert(m.rows("truco_match_command").some((c) => c.id === `${room}/2/a/resign`), `the match commands are ${JSON.stringify(m.rows("truco_match_command"))}`);

  // A call to you, while you sit at a table, is not answered by sitting.
  const offer = "00000000-0000-0000-0000-000000000700";
  const elsewhere = "7275636f-6d65-4573-8a00-0000000000ff";
  await m.store.put("truco_call_seat", { id: `${offer}/target`, instance_id: offer, actor: ME, seat: "target", revision: "1", phase: "offered", view: {}, caller_name: "Ana", room: elsewhere, chair: "b", variant: "mineiro", seating: "2v2" });
  await step(m);
  m.fire(`[id="call-accept-${offer}/target"]`);
  await step(m);
  assertEquals([m.rows("lobby_tab")[0].note, m.rows("truco_call_command").some((c) => c.id === `${offer}/1/target/accept`)], ["online_seated_elsewhere", false]);
  // Your table closed, it is: the answer and the join in one gesture.
  await m.store.remove("truco_match_seat", `${room}/a`);
  await step(m);
  m.fire(`[id="call-accept-${offer}/target"]`);
  await step(m);
  assert(m.rows("truco_call_command").some((c) => c.id === `${offer}/1/target/accept`), `the call commands are ${JSON.stringify(m.rows("truco_call_command"))}`);
  const sat = m.rows("truco_match_open").find((o) => o.id === `call/${offer}`);
  assert(sat !== undefined && sat.instance_id === elsewhere && (sat.input).requested_seat === "b", `the open rows are ${JSON.stringify(m.rows("truco_match_open"))}`);
  // A chair taken while you answered refuses the join, and the bar says so.
  await m.store.update("truco_match_open", `call/${offer}`, { outcome: "rejected", reason: "seat_unavailable" });
  await step(m);
  assertEquals(m.rows("lobby_tab")[0].note, "online_refused_seat");
  await m.stop();
} });

Deno.test({ name: "at a table of pairs the felt names an opponent, never your partner, and a table closed before its first hand sends your voice home", sanitizeOps: false, sanitizeResources: false, async fn() {
  const { step: play } = await matchFixture();
  // Seat b of a dealt 2v2: c, the seat after yours, is an opponent; d, across the cloth, your partner.
  const dealt = await play({ ...initialMatch("mineiro", "2v2"), joined: ["a", "b", "c", "d"] }, "start", "a", { seats: ["a", "b", "c", "d"] });
  const mine = dealt.views.find((v) => v.viewer === "b")!.value;
  const said = (seat: string, name: string) => ({ id: `voice-${seat}`, talk: "talk-of-the-table", seat, name, word: "", n: "0" });
  const m = await arena({
    truco_match_seat: [{ id: `${ROOM}/b`, instance_id: ROOM, actor: ME, seat: "b", revision: "1", phase: mine.phase, view: (mine), variant: "mineiro", seating: "2v2" }],
    truco_voice_public: [said("d", "Davi"), said("a", "Ana"), said("c", "Cida")],
  });
  await step(m);
  assertEquals(m.rows("match").find((r) => r.id === "table")!.opponent_handle, "Cida");
  await m.stop();

  // A table resigned before its first hand: the voice rises from it on the way back to the house.
  const room = "7275636f-6d65-4573-8a00-00000000000b";
  const waiting = await play({ ...initialMatch(), joined: [] }, "start", "a", { seats: ["a"] });
  const closed = await play(waiting.state, "resign", "a");
  const at = (answer: typeof waiting, revision: number) => {
    const value = answer.views.find((v) => v.viewer === "a")!.value;
    return { id: `${room}/a`, instance_id: room, actor: ME, seat: "a", revision: String(revision), phase: value.phase, view: (value), variant: "mineiro", seating: "1v1" };
  };
  const voice = { id: `${ME}/owner`, instance_id: ME, actor: ME, seat: "owner", revision: "2", phase: "seated",
    view: ({ phase: "seated", room, talk: "talk-of-the-table", seat: "a", name: "Bia", word: "", n: 0 }) };
  const home = await arena({ truco_match_seat: [at(waiting, 1)], truco_voice_seat: [voice] });
  await step(home);
  await home.store.put("truco_match_seat", at(closed, 2));
  await step(home);
  assert(home.rows("truco_voice_command").some((c) => c.id === `${ME}/2/owner/rise`), `the voice's commands are ${JSON.stringify(home.rows("truco_voice_command"))}`);
  await home.stop();

  // A guest at a table still waiting stands up from it; only its opener closes it.
  const guest = await play({ ...initialMatch("mineiro", "2v2"), joined: ["a"] }, "start", "a", { seats: ["a", "b"] });
  const theirs = guest.views.find((v) => v.viewer === "b")!.value;
  const sitting = await lobby({ truco_match_seat: [{ id: `${room}/b`, instance_id: room, actor: ME, seat: "b", revision: "1", phase: "waiting", view: (theirs), variant: "mineiro", seating: "2v2" }] });
  await step(sitting);
  sitting.fire("#leave-table");
  await step(sitting);
  assert(sitting.rows("truco_match_command").some((c) => c.id === `${room}/1/b/stand`), `the match commands are ${JSON.stringify(sitting.rows("truco_match_command"))}`);
  await sitting.stop();
} });
