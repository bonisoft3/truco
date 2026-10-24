// The arena on the shared rules: truco_match played by the terminal, through
// the handler Pronto composes from machines/arena.js over the machine's own
// rules. Everything the game knows is rows, so most of it is checked here
// below the screen, with a terminal that does only what the real one does for
// this handler: hand it the rows, follow the `then` it asks for (a pause
// passes at once, a draw comes from a list), and re-run the seated fold until
// it writes nothing. The mounted cases run the real screen on the harness's
// held clock.
import { assert, mountApp, type Mounted, only } from "/omnishell/test/screen-harness.ts";
import { evaluateRole } from "/omnishell/interpreter/jessie.js";

const APP = new URL("../", import.meta.url);

type Row = Record<string, string>;
type Update = { op: string; entity: string; id: string; row?: Row };
type Then = { type: string; delay?: number; seed?: boolean; with?: unknown };
type Fold = (state: { rows: Record<string, Row[]> }, event: Record<string, unknown>) => { updates: Update[]; then?: Then };
const arena = await evaluateRole(await Deno.readTextFile(new URL("shell/handlers/arena.js", APP)), "handler") as Fold;

/** A terminal for one handler: rows, draws, and the seat. */
const terminal = (draws: number[], match: Row[] = []) => {
  const rows: Record<string, Row[]> = { match: structuredClone(match), round: [], play: [], held: [], intent: [] };
  let drawn = 0;
  const write = (updates: Update[]) => {
    for (const u of updates) {
      const table = rows[u.entity];
      const at = table.findIndex((r) => r.id === u.id);
      if (u.op === "delete") { if (at >= 0) table.splice(at, 1); }
      else if (u.op === "put" || at < 0) table.splice(at < 0 ? table.length : at, at < 0 ? 0 : 1, { ...structuredClone(u.row!), id: u.id });
      else Object.assign(table[at], u.row);
    }
  };
  /** One call and the chain its `then` asks for; true when it wrote the table's
   * row, the only write that wakes the fold seated there. */
  const step = (event: Record<string, unknown>) => {
    let next = event;
    let wrote = false;
    for (let depth = 0; ; depth++) {
      assert(depth < 8, `a chain of ${depth} steps from ${JSON.stringify(event)}`);
      const result = arena({ rows: structuredClone(rows) }, next);
      if (result.updates.some((u) => u.entity === "match")) wrote = true;
      write(result.updates);
      const then = result.then;
      if (then === undefined) return wrote;
      next = { type: then.type, ...(then.seed ? { seed: draws[drawn++] } : {}), ...(then.with !== undefined ? { with: then.with } : {}) };
    }
  };
  /** The seated fold, woken by its own writes until it writes nothing. */
  const settle = () => {
    for (let runs = 0; ; runs++) {
      assert(runs < 4000, "the fold did not settle");
      if (!step({ type: "mutation" })) return;
    }
  };
  // A click wakes the fold only by changing the table's row: a write that
  // restates it moves nothing, as in the store.
  const click = (from: string, id?: string) => {
    const before = JSON.stringify(rows.match);
    write(arena({ rows: structuredClone(rows) }, { type: "click", from, ...(id === undefined ? {} : { id }) }).updates);
    if (JSON.stringify(rows.match) !== before) settle();
  };
  const current = (table: string) => rows[table].filter((r) => r.current === "yes");
  const table = () => only(rows.match.filter((r) => r.id === "table"), "the table");
  const hand = () => only(current("round"), "the hand");
  const yours = () => current("held").filter((h) => h.display_seat === "you");
  const game = () => JSON.parse(table().game);
  return { rows, write, settle, click, table, hand, yours, game };
};
const seated = (variant: string, seats: string, opponent = "nezinho"): Row[] => [{ id: "table", variant, seats, opponent, theme: "xadrez", current: "yes" }];

/** You, playing plainly: answer what is asked, else lay your first playable card. */
const yourTurn = (t: ReturnType<typeof terminal>) => {
  const hand = t.hand();
  const calls = hand.envido_calls.split(" ");
  if (calls.includes("answer")) return t.click("btn-envido-take");
  if (calls.includes("brink")) return t.click("btn-brink-play");
  if (hand.asked !== "" && !["you", "parca"].includes(hand.asked)) return t.click("btn-accept");
  const card = t.yours().find((h) => h.blocked === "");
  assert(card !== undefined, `nothing for you to do: ${JSON.stringify(hand)}`);
  t.click("card", card.id);
};

const TABLES = [
  ...["paulista", "mineiro", "gaucho", "truc", "argentino", "uruguayo", "paraguayo"].flatMap((v) => [[v, "1v1"], [v, "2v2"]]),
  ["douradinha", "2v2v2"], ["douradao", "2v2v2"],
];

Deno.test("a first visit deals a game from the terminal's draw, and the first hand is yours to lead", () => {
  const t = terminal([4242]);
  t.settle();
  assert(t.table().seed === "4242" && t.game().id === "g4242", `the table carries seed ${t.table().seed}`);
  assert(t.hand().hand_no === "1" && t.hand().said === "lead_your_turn", `hand ${t.hand().hand_no} opens with "${t.hand().said}"`);
  assert(t.yours().length === 3 && t.yours().every((h) => h.blocked === ""), "your three cards are not yours to play");
  const backs = t.rows.held.filter((h) => h.current === "yes" && h.display_seat === "eles1");
  assert(backs.length === 3 && backs.every((h) => h.card === "back"), "the house's cards show");
  assert(t.rows.intent.length === 0, "intents outlived the deal");
});

Deno.test("the same draws and the same clicks replay the same game, row for row", () => {
  const play = () => {
    const t = terminal([7, 99, 123]);
    t.settle();
    for (let i = 0; i < 12 && t.table().status === "playing"; i++) yourTurn(t);
    return t.rows;
  };
  assert(JSON.stringify(play()) === JSON.stringify(play()), "two tables seeded and played alike diverged");
});

Deno.test("every table plays to its goal, the house choosing from each seat's own view", () => {
  for (const [variant, seats] of TABLES) {
    const t = terminal([1, 2, 3], seated(variant, seats));
    t.settle();
    for (let moves = 0; t.table().status === "playing"; moves++) {
      assert(moves < 600, `${variant} ${seats} did not finish`);
      yourTurn(t);
    }
    const goal = t.game().state.goal;
    const targetGames = ["gaucho", "argentino", "uruguayo", "paraguayo"].includes(variant) ? 1 : 2;
    const scores = [t.table().us_score, t.table().them_score, t.table().others_score].map(Number);
    const games = [t.table().us_games, t.table().them_games, t.table().others_games].map(Number);
    assert(scores.includes(goal) && games.includes(targetGames) && t.table().winner !== "", `${variant} ${seats} ended at ${scores.join("/")} (${games.join("/")} games) short of ${goal}`);
    assert(t.hand().shout_kind === "close", `${variant} ${seats} closed without its shout`);
  }
});

Deno.test("your card lands on the felt from its slot, and the house answers", () => {
  const t = terminal([4242]);
  t.settle();
  const card = t.yours()[1];
  t.click("card", card.id);
  const mine = only(t.rows.play.filter((p) => p.kind === "card" && p.seat === "you"), "your card");
  assert(mine.card === card.card && mine.from_slot === "1", `you laid ${mine.card} from slot ${mine.from_slot}`);
  const theirs = t.rows.play.filter((p) => p.seat === "eles1");
  assert(theirs.length > 0 && theirs.every((p) => p.seq > mine.seq), "the house did not answer after you");
});

Deno.test("a click made twice is one intent, and one made on a stale table is dropped", () => {
  const t = terminal([4242]);
  t.settle();
  const card = t.yours()[0];
  const intent = () => arena({ rows: structuredClone(t.rows) }, { type: "click", from: "card", id: card.id }).updates;
  t.write([...intent(), ...intent()]);
  assert(t.rows.intent.length === 1, `${t.rows.intent.length} intents for one card`);
  t.settle();
  assert(t.rows.play.filter((p) => p.seat === "you" && p.kind === "card").length === 1, "the card was played twice");
  const revision = t.game().revision;
  t.write([{ op: "put", entity: "intent", id: "stale", row: { id: "stale", game: t.game().id, revision: String(revision - 1), kind: "resign" } }]);
  t.settle();
  assert(t.table().status === "playing" && t.rows.intent.length === 0, "a stale resign was applied or kept");
});

Deno.test("resigning hands the house the match, and another game starts afresh from a new draw", () => {
  const t = terminal([4242, 777]);
  t.settle();
  const first = t.hand().id;
  t.click("btn-resign");
  assert(t.table().status === "over" && t.table().winner === "them", `the match went to "${t.table().winner}"`);
  t.click("btn-again");
  assert(t.table().seed === "777" && t.hand().id.startsWith("g777/"), `the next game is ${t.hand().id}`);
  assert(t.table().us_score === "0" && t.table().them_score === "0" && t.table().us_games === "0" && t.table().them_games === "0" && t.table().status === "playing", "the new game kept the old score");
  assert(t.rows.round.find((r) => r.id === first)?.current === "no", "the finished hand is still on the felt");
});

Deno.test("a rules pick deals a new game under the rule picked", () => {
  const t = terminal([4242, 31337]);
  t.settle();
  Object.assign(t.table(), { variant: "paulista" });
  t.settle();
  assert(t.game().variant === "paulista" && t.table().seed === "31337", `the table plays ${t.game().variant} from ${t.table().seed}`);
  assert(t.table().stake === "1" && t.hand().vira !== "" && t.hand().manilha !== "fixas", "paulista turned up no vira");
});

Deno.test("encobrir lays your card face down, and nobody reads it", () => {
  const t = terminal([4242]);
  t.settle();
  t.click("btn-encobrir");
  assert(t.hand().oculta === "yes", "encobrir is not armed");
  t.click("card", t.yours()[0].id);
  const laid = only(t.rows.play.filter((p) => p.kind === "card" && p.seat === "you"), "your card");
  assert(laid.said === "encoberta" && laid.card === "", `a covered card reads "${laid.card}" (${laid.said})`);
  assert(t.hand().oculta === "no", "encobrir stayed armed after the card");
  // Regression: the house's remaining held backs must keep the slots not yet
  // played rather than always retiring slot 2 first.
  const theirPlayed = t.rows.play.filter((p) => p.kind === "card" && p.seat === "eles1").map((p) => p.from_slot);
  const theirHeld = t.rows.held.filter((h) => h.current === "yes" && h.display_seat === "eles1").map((h) => h.slot);
  assert(theirPlayed.length === 2 && theirHeld.join(",") === "2", `played ${theirPlayed.join(",")} left ${theirHeld.join(",")}`);
});

Deno.test("every click is its own, taken in the order it was made", () => {
  // Two clicks of one kind at one revision named one intent and restated the
  // row that wakes the fold, so the second never woke it; the next click woke
  // it to both, applied the first by name and dropped the card.
  const t = terminal([4242]);
  t.settle();
  t.click("btn-encobrir");
  t.click("btn-encobrir");
  assert(t.hand().oculta === "no", "the second encobrir was lost");
  t.click("card", t.yours()[0].id);
  assert(t.rows.play.some((p) => p.kind === "card" && p.seat === "you"), "the card after them was dropped");
});

Deno.test("a quick shout is shouted from your seat and fades on the terminal's clock", () => {
  const t = terminal([4242]);
  t.settle();
  t.click("shout-chama");
  assert(t.hand().shout_word === "shout_chama" && t.hand().shout_kind === "quick" && t.hand().shout_state === "gone", `the shout is ${t.hand().shout_word} (${t.hand().shout_state})`);
  assert(t.game().face.shouts === 1, "the shout was not counted");
});

Deno.test("the felt says what the envido said: the mano's count, and son buenas from a side that cannot beat it", () => {
  let seen = 0;
  for (let seed = 1; seed < 60; seed++) {
    const t = terminal([seed], seated("argentino", "1v1"));
    t.settle();
    if (!t.hand().envido_calls.split(" ").includes("envido")) continue;
    t.click("btn-envido");
    if (t.hand().envido !== "scored") continue;
    seen++;
    const said = t.rows.play.filter((p) => p.kind === "envido_count" || p.kind === "envido_good");
    assert(said[0].seat === "you" && said[0].kind === "envido_count", `the mano said ${said[0].kind}`);
    if (said[1].kind === "envido_good") assert(t.hand().envido_them === "0" && t.hand().envido_result === "us", "son buenas showed a count");
    else assert(Number(said[1].count) > Number(said[0].count) && t.hand().envido_result === "them", "a count stated without beating the mano's");
  }
  assert(seen > 0, "no seed dealt an envido the house took");
});

Deno.test("the felt draws the brink: the side on it decides, sees its partner's cards, and the truco is closed", () => {
  const t = terminal([4242, 5], seated("mineiro", "2v2"));
  t.settle();
  const game = t.game();
  t.table().game = JSON.stringify({ ...game, state: { ...game.state, phase: "hand_over", score_a: 10 } });
  t.settle();
  const round = t.hand();
  assert(round.brink === "us" && round.said === "brink_mineiro_us" && round.envido_calls.split(" ").includes("brink"), `the brink reads ${round.brink} / ${round.said} / ${round.envido_calls}`);
  assert(round.rung === "0", "a brink hand offers a truco");
  const partner = t.rows.held.filter((h) => h.current === "yes" && h.display_seat === "parca");
  assert(partner.length === 3 && partner.every((h) => h.card !== "back"), "your partner's cards are hidden on your brink");
});

/* --- the tables the felt offers, held to the rules ---------------------- */

const ladders = new Map([...(await Deno.readTextFile(new URL("machines/match.js", APP))).matchAll(/^ {2}(\w+): \{ladder: \[([\d, ]+)\]/gm)].map(([, name, list]) => [name, list.split(",").map(Number)]));

Deno.test("every variant the felt offers is one the rules can deal, at the goal its menu names", async () => {
  const markup = await Deno.readTextFile(new URL("arena.cue", APP));
  const offered = [...markup.matchAll(/\{name: "(\w+)", label: "[^"]*", item: "[^"]*", msg: "msg\.variant_/g)].map(([, v]) => v);
  assert(offered.length === 9 && offered.every((v) => ladders.has(v)), `the menu offers ${offered.join(", ")}; the rules deal ${[...ladders.keys()].join(", ")}`);
  for (const variant of offered) {
    const goals = [...new Set(TABLES.filter(([v]) => v === variant).map(([v, s]) => {
      const t = terminal([1], seated(v, s));
      t.settle();
      return t.game().state.goal;
    }))].join("/");
    for (const loc of ["pt-BR", "es-AR", "es-UY", "es-PY", "ca-ES"]) {
      const cat = JSON.parse(await Deno.readTextFile(new URL(`messages/${loc}.json`, APP)));
      const said = (String(cat[`variant_${variant}_item`] ?? "").match(/\d+/g) ?? []).join("/");
      assert(said === goals, `${loc} names ${variant} "${cat[`variant_${variant}_item`]}", and the rules play it to ${goals}`);
    }
  }
});

Deno.test("every ladder the rules climb is drawn on the rules screen and voiced at the table", async () => {
  const rules = await Deno.readTextFile(new URL("shell/screens/regras.html", APP));
  const families = new Map<string, string[]>();
  for (const [, family, rung] of rules.matchAll(/<li data-v="(\w+)"[^>]*><b>(\d+)<\/b>/g)) families.set(family, [...(families.get(family) ?? []), rung]);
  const drawn = new Set([...families.values()].map((l) => l.join(" ")));
  const fold = await Deno.readTextFile(new URL("machines/arena.js", APP));
  for (const source of [fold]) {
    const voiceOf = new Map([...(source.match(/const VOICE_OF = \{([^}]*)\}/)?.[1] ?? "").matchAll(/(\w+): "(\w+)"/g)].map(([, v, k]) => [v, k]));
    for (const [variant, ladder] of ladders) {
      assert(drawn.has(ladder.join(" ")), `${variant} climbs ${ladder.join(" ")} and no ladder on the rules screen says so`);
      const words = source.match(new RegExp(`\\b${voiceOf.get(variant)}: \\{\\s*ladder: \\{([^}]*)\\}`))?.[1] ?? "";
      for (const rung of ladder.slice(1)) assert(new RegExp(`\\b${rung}:`).test(words), `the ${voiceOf.get(variant)} voice has no word for ${variant}'s ${rung}`);
    }
  }
  const prices = fold.match(/const LADDER = \{([^}]*)\}/)?.[1] ?? "";
  for (const [variant, ladder] of ladders) assert(prices.includes(`${variant}: [${ladder.join(", ")}]`), `arena.js prices ${variant} otherwise`);
});

/* --- the screen ------------------------------------------------------------ */

// The bar renews this tab's presence lease forever, so settle() would never
// stop; a tab whose drawn lease is gone has nothing to renew.
const screen = (params: Record<string, string> = {}, match: Record<string, unknown>[] = []) =>
  mountApp({ appDir: APP, screen: "arena", seed: 20250901, params, mountHostDom: false, tables: { match, round: [], play: [], held: [], intent: [], player: [],
    lobby_tab: [{ id: "the", lease: "lapsed", me: "", note: "", shown: "", code: "", format: "1v1", reserved: "false", chair: "", call: "" }], truco_presence_lease: [], truco_presence_seat: [], truco_presence_public: [], truco_presence_command: [],
    truco_challenge_seat: [], truco_challenge_command: [], truco_challenge_open: [], truco_match_seat: [], truco_match_open: [], truco_match_command: [],
    truco_voice_seat: [], truco_voice_command: [], truco_voice_open: [], truco_voice_public: [],
    truco_match_public: [], truco_call_seat: [], truco_call_command: [], truco_call_open: [], chair: [], listed_table: [] } });
const settled = async (m: Mounted) => {
  await m.settle();
  await m.settle();
};
const sitting = (m: Mounted) => only(m.rows("match").filter((r) => r.current === "yes"), "the sitting");
const onFelt = (m: Mounted) => only(m.rows("round").filter((r) => r.current === "yes"), "the hand on the felt");
const playable = (m: Mounted) => m.all(".seat-row.mine .card").filter((el) => !el.hasAttribute("disabled"));

Deno.test({
  name: "the screen deals on arrival, and a card you lay is answered on the terminal's clock",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await screen();
    await settled(m);
    assert(sitting(m).id === "table" && onFelt(m).said === "lead_your_turn", `the table opened on "${onFelt(m).said}"`);
    assert(playable(m).length === 3, `${playable(m).length} cards you may play`);
    assert(m.all("[data-machine]").length === 5, `${m.all("[data-machine]").length} machines on the screen, not the five pickers`);
    m.fire(playable(m)[0]);
    await settled(m);
    assert(m.rows("play").some((p) => p.seat === "eles1"), "the house did not answer");
    await m.stop();
  },
});

Deno.test({
  name: "a reload sits back down at the game on the table's row, mid-hand",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await screen();
    await settled(m);
    m.fire(playable(m)[0]);
    await settled(m);
    const laid = m.rows("play").map((p) => `${p.seat}:${p.kind}:${p.card}`);
    const round = onFelt(m).id;
    // The table's row is the device's; the hand's rows are the tab's and go.
    const kept = m.rows("match");
    await m.stop();
    const again = await screen({}, kept);
    await settled(again);
    assert(onFelt(again).id === round, `the reload sat at ${onFelt(again).id}, not ${round}`);
    const restored = again.rows("play").map((p) => `${p.seat}:${p.kind}:${p.card}`);
    for (const said of laid) assert(restored.includes(said), `${said} is no longer on the felt`);
    await again.stop();
  },
});

Deno.test({
  name: "the join box asks for a table's code, and says so when given anything else",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // A pasted link was refused with nothing on screen: the box asked for a
    // link, accepted only the code, and had no words for the difference.
    const m = await screen();
    await settled(m);
    (m.one("#input-join-code") as unknown as { value: string }).value = "https://truco.example/mesa/0f0e0d0c-0b0a-4908-8706-050403020100";
    m.fire("form[data-form=join-table]", "submit");
    await settled(m);
    assert(!m.one("#join-code-invalid").hasAttribute("hidden"), "a link was refused in silence");
    // Words from two languages' lists name no table: a code is spelled in
    // its opener's language alone.
    (m.one("#input-join-code") as unknown as { value: string }).value = "zape-envido-espada-k7m2";
    m.fire("form[data-form=join-table]", "submit");
    await settled(m);
    assert(m.rows("truco_match_open").length === 0 && m.rows("lobby_tab")[0].note === "join_code_invalid", `mixed words opened ${JSON.stringify(m.rows("truco_match_open"))}`);
    // A code is the bar's to remember and the arena's to ask for: the table
    // is joined from where you are, with no page of its own to go to. The
    // code is the room's id spelled out — list, the words' places, then the
    // slug — however it was typed.
    (m.one("#input-join-code") as unknown as { value: string }).value = " Zape-Copas-Espada-K7M2 ";
    m.fire("form[data-form=join-table]", "submit");
    await settled(m);
    const [join] = m.rows("truco_match_open");
    assert(join !== undefined && join.kind === "join" && join.instance_id === "7275636f-6d65-4573-8a00-000010299e82", `the open rows are ${JSON.stringify(m.rows("truco_match_open"))}`);
    await m.stop();
  },
});

Deno.test({
  name: "a reload between hands deals the next one",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // The pause between hands is a wait on the terminal's clock, which a
    // reload drops; the hand's rows go with the tab. Redrawing them must not
    // be all the fold does, or nothing ever deals the next hand.
    const m = await screen();
    await settled(m);
    const phase = () => JSON.parse(String(sitting(m).game)).state.phase;
    for (let turns = 0; phase() !== "hand_over"; turns++) {
      assert(turns < 400, `hand 1 never ended: ${phase()}`);
      const card = playable(m)[0];
      if (card !== undefined) m.fire(card);
      m.advance(100);
      await m.quiet();
    }
    const kept = m.rows("match");
    await m.stop();
    const again = await screen({}, kept);
    await settled(again);
    assert(JSON.parse(String(sitting(again).game)).state.hand_no === 2, `the reload stayed at ${JSON.parse(String(sitting(again).game)).state.phase}`);
    assert(again.rows("held").filter((h) => h.current === "yes" && h.display_seat === "you").length === 3, "the next hand was not dealt to you");
    // The hand the reload redrew is retired when the next is dealt, or the
    // felt draws both and reads its words off the old one.
    const current = again.rows("round").filter((r) => r.current === "yes").map((r) => r.id);
    assert(current.length === 1, `the felt holds ${current.join(", ")}`);
    await again.stop();
  },
});

Deno.test({
  name: "a finished game opened again in a new tab opens a fresh sitting",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // The game is the device's and survives; the closing scoreline is the
    // tab's and does not. With nothing left to read, the table deals anew,
    // where a finished game on a live tab stays until asked.
    const m = await screen();
    await settled(m);
    const [row] = m.rows("match");
    const game = JSON.parse(String(row.game));
    const won = { ...row, game: JSON.stringify({ ...game, state: { ...game.state, phase: "finished", score_a: 12, winner: "a" } }) };
    await m.stop();
    const again = await screen({}, [won]);
    await settled(again);
    const fresh = JSON.parse(String(sitting(again).game));
    assert(fresh.id !== game.id && fresh.state.phase !== "finished" && fresh.state.score_a === 0, `the reopened table is ${fresh.id} at ${fresh.state.phase}`);
    await again.stop();
  },
});

Deno.test({
  name: "a rules pick on the screen deals a new game under it",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await screen();
    await settled(m);
    const first = onFelt(m).id;
    m.fire(only(m.byRole("option", /^Truco Paulista/), "paulista"));
    await settled(m);
    assert(onFelt(m).id !== first && sitting(m).variant === "paulista" && onFelt(m).vira !== "", `the felt shows ${onFelt(m).id} under ${sitting(m).variant}`);
    m.fire(m.one('[data-picker="seats"] [data-opt="2v2"]'));
    await settled(m);
    assert(m.rows("held").filter((h) => h.current === "yes" && h.display_seat === "parca").length === 3, "your partner is not seated");
    await m.stop();
  },
});

Deno.test({
  name: "your name is a row, so a screen mounted on the store shows the name it holds",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // The name lived in localStorage, which a replay of the store never
    // reaches: a table restored to any state still wore today's name.
    const m = await screen();
    await settled(m);
    assert(m.one("#seatbar-player-name").textContent?.trim() === "Você" && m.one("#seatbar-avatar").textContent === "V", "an unnamed seat is called you");
    (m.one("#my-handle-input") as unknown as { value: string }).value = "Davi";
    m.fire("form[data-form=handle]", "submit");
    await settled(m);
    assert(JSON.stringify(m.rows("player")) === JSON.stringify([{ id: "you", handle: "Davi" }]), `the player rows are ${JSON.stringify(m.rows("player"))}`);
    assert(m.one("#seatbar-player-name").textContent?.trim() === "Davi" && m.one("#seatbar-avatar").textContent === "D", "the seat does not wear the name");
    await m.store.upsert("player", { id: "you", handle: "Carol" });
    await settled(m);
    assert(m.one("#seatbar-player-name").textContent?.trim() === "Carol" && m.one("#seatbar-avatar").textContent === "C", "the seat does not follow the row");
    // Clearing the name is forgetting it: the terminal trims what was typed,
    // so a field of blanks stores the empty name, and the seat is you again.
    (m.one("#my-handle-input") as unknown as { value: string }).value = "   ";
    m.fire("form[data-form=handle]", "submit");
    await settled(m);
    assert(m.rows("player")[0]?.handle === "", `the player rows are ${JSON.stringify(m.rows("player"))}`);
    assert(m.one("#seatbar-player-name").textContent?.trim() === "Você" && m.one("#seatbar-avatar").textContent === "V", "clearing the name did not seat you again");
    await m.stop();
  },
});

Deno.test({
  name: "the arena resolves localized messages across Brazil and the three Spanish-speaking countries",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const pt = await screen();
    await settled(pt);
    assert(pt.one("#btn-truco").textContent?.trim() === "TRUCO!", "pt: btn-truco");
    assert(pt.one("#btn-next").textContent?.trim() === "Próxima mão", "pt: btn-next");
    assert(pt.one("#btn-accept b").textContent?.trim() === "Aceito", "pt: btn-accept");
    assert(pt.one("#btn-run b").textContent?.trim() === "Corro", "pt: btn-run");
    assert(pt.one(".score.us .sect").textContent?.trim() === "Nós", "pt: score us");
    assert(pt.one("#seatbar-player-name").textContent?.trim() === "Você", "pt: you");
    const countryHref = (m: Mounted, tag: string) => m.one(`[data-picker="country"] a[data-locale="${tag}"]`).getAttribute("href");
    assert(countryHref(pt, "pt-BR") === "/" && countryHref(pt, "es-AR") === "/ar" && countryHref(pt, "es-UY") === "/uy" && countryHref(pt, "es-PY") === "/py" && countryHref(pt, "ca-ES") === "/ca", "a country's address");
    assert(pt.one('[data-picker="country"] a[data-locale="es-AR"]').textContent?.trim() === "🇦🇷 Argentina", "a country row is its flag and its name");
    await pt.store.update("match", "table", { locale: "es-AR" });
    await settled(pt);
    assert(pt.one(".score.us .sect").textContent?.trim() === "Nosotros" && pt.one("#btn-accept b").textContent?.trim() === "Quiero", "the match's locale did not take");
    await pt.stop();
    for (const [tag, subtitle] of [["es-AR", "Truquero de ley, che · invitado"], ["es-UY", "Truquero de ley, bo · invitado"], ["es-PY", "Truquero de ley voi' · invitado"]] as const) {
      const m = await screen({ locale: tag });
      await settled(m);
      assert(m.one("#btn-next").textContent?.trim() === "Próxima mano", `${tag}: btn-next`);
      assert(m.one("#btn-run b").textContent?.trim() === "Me voy al mazo", `${tag}: btn-run`);
      assert(m.one("#seatbar-player-name").textContent?.trim() === "Vos", `${tag}: you`);
      assert(m.one(".who .sect").textContent?.trim() === subtitle, `${tag}: the subtitle is this country's own`);
      await m.stop();
    }
    const ca = await screen({ locale: "ca-ES" });
    await settled(ca);
    assert(ca.one("#btn-accept b").textContent?.trim() === "Vull" && ca.one(".rules-link").textContent?.trim() === "Regles", "ca-ES");
    await ca.stop();
  },
});

for (const [params, priced] of [
  [{}, (n: number) => `vale ${n} pontos`],
  [{ locale: "es-AR" }, (n: number) => `vale ${n} puntos`],
] as [Record<string, string>, (n: number) => string][]) {
  Deno.test({
    name: `what accepting costs is priced as a plural of [${params.locale ?? "pt-BR"}]`,
    sanitizeOps: false,
    sanitizeResources: false,
    async fn() {
      const m = await screen(params);
      await settled(m);
      const rung = Number(onFelt(m).rung);
      assert(rung > 1, `the ladder stands at ${rung}, where the plural arm is not the one under test`);
      assert(m.one("#btn-accept small").textContent?.trim() === priced(rung), `the hand asks for ${rung}`);
      await m.stop();
    },
  });
}

Deno.test("speech localizes names without interpreting a player's braces or newlines", async () => {
  const speech = await evaluateRole(await Deno.readTextFile(new URL("shell/renderers/speech.js", APP)), "renderer") as (value: string) => string[];
  for (const locale of ["pt-BR", "es-AR", "ca-ES"]) {
    const messages = JSON.parse(await Deno.readTextFile(new URL(`messages/${locale}.json`, APP)));
    assert(Object.values(messages).every(text => typeof text !== "string" || !text.includes("\n")), "speech templates must fit one line");
    const template = messages.turn_of;
    const name = messages.opponent_nezinho;
    assert(speech(`${template}\n3\n${name}`)[0] === template.replace("{name}", name), `${locale} lost the localized name`);
  }
  const name = "{worth}\n<img src=x>";
  assert(speech(`{name} · {worth}\n6\n${name}`)[0] === `${name} · 6`, "a handle became template syntax");
});

Deno.test({
  name: "the felt renders its phase, speech and wager authority without host effects",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await screen();
    await settled(m);
    assert(m.one(".play").getAttribute("data-phase") === "your-turn", "the felt did not read the hand");
    assert(m.one(".talk").textContent?.trim() === "Você é mão. Sua vez.", `the table said ${m.one(".talk").textContent}`);
    assert(!m.one("#btn-truco").hasAttribute("disabled"), "the opening wager is disabled");
    const config = JSON.parse(await Deno.readTextFile(new URL("shell/shell.json", APP)));
    assert(Object.keys(config.hostDom ?? {}).length === 0, "the app still mounts ambient code");
    await m.stop();
  },
});

Deno.test("successive shouts and announcements keep selecting an entrance animation", () => {
  const t = terminal([4242]);
  t.settle();
  let animation = t.hand().shout_anim;
  for (let i = 0; i < 4; i++) {
    t.click("shout-chama");
    assert(["1", "2"].includes(t.hand().shout_anim) && t.hand().shout_anim !== animation, `shout ${i + 1} selected ${t.hand().shout_anim}`);
    animation = t.hand().shout_anim;
  }
  for (let i = 0; i < 12 && t.table().status === "playing"; i++) {
    yourTurn(t);
    const hand = t.hand();
    assert(["1", "2"].includes(hand.said_t), `announcement selected ${hand.said_t}`);
  }
});

Deno.test({
  name: "a country pick shares the variant's consequences and keeps a compatible game",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await screen();
    await settled(m);
    m.fire("#country-es-AR");
    await settled(m);
    assert(sitting(m).variant === "argentino" && sitting(m).theme === "formica" && sitting(m).opponent === "osvaldo", "Argentina did not take the variant's choices");
    m.fire("#country-pt-BR");
    await settled(m);
    assert(sitting(m).variant === "mineiro" && sitting(m).theme === "madeira" && sitting(m).opponent === "tiao_queijo", "Brazil did not take the variant's choices");
    const game = sitting(m).game;
    m.fire("#country-pt-BR");
    await settled(m);
    assert(sitting(m).game === game, "picking a country already playing the rule dealt another game");
    await m.stop();
  },
});

Deno.test({
  name: "the run fades after 1800ms so the paid result can be read before the next hand",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const t = terminal([2], seated("paulista", "1v1", "tiao"));
    t.settle();
    const m = await screen();
    await settled(m);
    await m.store.update("match", "table", t.table());
    await m.quiet();
    for (let i = 0; m.one(".play").getAttribute("data-phase") !== "raised"; i++) {
      assert(i < 600, "Tião never called");
      if (playable(m)[0]) m.fire(playable(m)[0]);
      m.advance(100);
      await m.quiet();
    }
    const hand = onFelt(m).id;
    m.fire("#btn-run");
    await m.quiet();
    assert(onFelt(m).shout_state === "live", "the run was not heard");
    m.advance(800);
    await m.quiet();
    assert(onFelt(m).shout_state === "live" && /fez a mão/.test(m.one(".talk").textContent ?? ""), "the run was not paid before fading");
    m.advance(1000);
    await m.quiet();
    assert(onFelt(m).id === hand && onFelt(m).shout_state === "gone", "the run covered the result until the next hand");
    await m.stop();
  },
});

Deno.test("a faded quick shout cannot mask a later wager or its answer", () => {
  const t = terminal([4242]);
  t.settle();
  t.click("shout-chama");
  assert(t.hand().shout_state === "gone", "the quick shout did not finish");
  t.click("btn-truco");
  assert(t.hand().shout_kind !== "quick", "the expired quick shout masked the wager");
});

Deno.test({
  name: "a quick shout expires across an immediate raise",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await screen();
    await settled(m);
    m.fire("#shout-chama");
    await m.quiet();
    const revision = JSON.parse(String(sitting(m).game)).revision;
    assert(m.one("#player-dialogue-wrap").getAttribute("data-active") === "yes", "the shout bubble did not open");
    m.fire("#btn-truco");
    await m.quiet();
    for (let i = 0; i < 30; i++) {
      m.advance(100);
      await m.quiet();
    }
    assert(JSON.parse(String(sitting(m).game)).revision > revision, "the raise did not advance the game");
    assert(JSON.parse(String(sitting(m).game)).face.quick.live === false, "gameplay cancelled the shout expiry");
    assert(m.one("#player-dialogue-wrap").getAttribute("data-active") === "no", "the shout bubble stayed visible");
    assert(onFelt(m).shout_kind !== "quick", "the quick shout masked the wager or its answer");
    await m.stop();
  },
});

Deno.test("shout timers follow the shout rather than the game revision", () => {
  const t = terminal([4242]);
  t.settle();
  const game = t.game();
  game.face.quick = {word: "shout_chama", t: 2, live: true};
  t.table().game = JSON.stringify(game);
  const due = {game: game.id, revision: game.revision - 1, t: 2};
  const retort = arena({rows: t.rows}, {type: "beat", with: {...due, kind: "retort", line: "stale reply"}});
  assert(retort.updates.length === 0 && retort.then?.with !== undefined, "a stale reply was spoken or lost the expiry");
  t.rows.intent.push({id: "pending-raise", game: game.id, revision: String(game.revision), kind: "raise"});
  const hush = arena({rows: t.rows}, {type: "beat", with: retort.then.with});
  const changed = only(hush.updates.filter(u => u.entity === "match" && u.id === "table"));
  assert(JSON.parse(String(changed.row?.game)).face.quick.live === false, "the hush was rejected after gameplay");
  for (const kind of ["retort", "hush"]) {
    const older = arena({rows: t.rows}, {type: "beat", with: {...due, kind, t: 1}});
    assert(older.updates.length === 0 && older.then === undefined, `an older ${kind} affected the new shout`);
    const foreign = arena({rows: t.rows}, {type: "beat", with: {...due, kind, game: "another-game"}});
    assert(foreign.updates.length === 0 && foreign.then === undefined, `another game's ${kind} affected the shout`);
  }
});
