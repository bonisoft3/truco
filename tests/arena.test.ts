// The arena mounted WHOLE — engine, pickers and fold on one screen, against
// the emitted markup and the emitted handlers, with the table's clock in the
// test's hand. The only tier where a fact about the table as a whole can be
// checked without the cluster: the terminal's `machines` check answers for the
// pickers' arrows, and answers for one region at a time.
//
// The inline dealer in arena.html does not run here — linkedom executes no
// scripts — so nothing below reads .play[data-phase], .talk or #over-line.
// Every assertion names a row, or an attribute the interpreter bound from one.
import { assert, mountApp, type Mounted, only, type Row, textOf } from "../../../plugins/omnishell/test/screen-harness.ts";

const APP = new URL("../", import.meta.url);

// Fixed so every run deals the same cards in the same order.
const SEED = 20250901;

const table = (params: Record<string, string> = {}) =>
  mountApp({
    appDir: APP,
    screen: "arena",
    seed: SEED,
    params,
    tables: { match: [], round: [], play: [], held: [], lobby: [], challenge: [], room_action: [] },
  });

/** The variant a reader would reach for by name. The row's accessible name
 * opens with the variant and closes with the goal it plays to, so the query is
 * anchored at the name; that the goal is the dealer's own is held separately,
 * by the test that reads table.js's GOAL table. */
const variantOption = (m: Mounted, name: string) => {
  const found = m.byRole("option", new RegExp(`^${name}`));
  assert(found.length === 1, `"${name}" names ${found.length} options, not one`);
  return found[0];
};

const sideOf2 = (seat: string) => (seat === "you" || seat === "parca" ? "us" : "them");

const sitting = (m: Mounted) => only(m.rows("match").filter((r) => r.current === "yes"), "the sitting");
const hand = (m: Mounted) => only(m.rows("round").filter((r) => r.current === "yes"), "the hand on the felt");
const playable = (m: Mounted) => m.all(".seat-row.mine .card").filter((el) => !el.hasAttribute("disabled"));

/** Round's invariant (program.cue), over the rows a run actually dealt: a
 * table turns a card up, names its manilhas in the rules, or has none at all,
 * and none does two of those. The entity is browser-tier, so no CHECK is
 * emitted for it and this is where the rule is held. */
const assertTurnUp = (m: Mounted) => {
  for (const r of m.rows("round")) {
    assert(
      (r.vira === "") === (r.manilha === "fixas" || r.manilha === "nenhuma"),
      `round ${r.id} turned up "${r.vira}" and calls its manilhas "${r.manilha}"`,
    );
  }
};

/** Play the standing hand out, answering any raise, until the match moves on.
 *
 * A hand ends by being played, and the match by a hand being paid for — except
 * that the envido pays the moment it resolves, so a match can be decided with
 * cards still in hand and that hand never finishes. Waiting for the hand
 * number to move would wait forever, so a decided match is a reason to stop. */
async function playOut(m: Mounted) {
  const from = Number(sitting(m).hand_no);
  for (let turn = 0; turn < 80; turn++) {
    await m.settle();
    if (Number(sitting(m).hand_no) > from) return;
    if (sitting(m).status !== "playing") return;
    const round = hand(m);
    // Eles asked; taking the bet is an answer the table accepts at any rung,
    // and it keeps the hand moving toward the score this case is about.
    //
    // The envido is asked first and answered first, and until it is, no card
    // can be laid — so a hand where the house bets its count stalls here
    // unless the answer is given.
    if ((round.envido_calls ?? "").split(" ").includes("answer")) {
      m.fire("#btn-envido-take");
      continue;
    }
    if (String(round.asked ?? "").startsWith("eles")) {
      m.fire("#btn-accept");
      continue;
    }
    const card = playable(m)[0];
    assert(card !== undefined, `nothing left to do on hand ${from}: ${JSON.stringify(round)}`);
    m.fire(card);
  }
  throw new Error(`hand ${from} never ended`);
}

Deno.test({
  name: "the whole arena opens exactly one sitting",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();
    // .matchbox, .hands and the .log nested inside it declare the same fold
    // over the same world, and share one seat only while their data-reads
    // agree byte for byte. Split them and each concludes from a world with no
    // match, each asks for a draw, and each mints a sitting under its own id.
    assert(m.rows("match").length === 1, `${m.rows("match").length} sittings on the table`);
    const mints = m.store.calls.filter((c) => c.op === "put" && c.table === "match");
    assert(mints.length === 1, `the match was minted ${mints.length} times: ${JSON.stringify(mints)}`);
    // And the sitting it opened is dealt and playable: hand 1 is always yours
    // to lead, so the table has stopped waiting for itself.
    const round = hand(m);
    assert(round.hand_no === "1", `the table opened on hand ${round.hand_no}`);
    assert(playable(m).length === 3, `${playable(m).length} cards you may play`);
    // The bar carries four picker machines — variant, seats, opponent and
    // theme. The country picker beside them writes no row and drives no
    // machine: it navigates. The terminal's `machines` check walks whatever it
    // finds, so a picker dropped from the markup passes there with nothing to
    // say; the count is stated only here.
    const pickers = m.all(".seatbar [data-machine]").length;
    assert(pickers === 4, `${pickers} picker machines in the bar, not four`);
    const totalMachines = m.all("[data-machine]").length;
    assert(totalMachines === 5, `${totalMachines} total machines on the screen, not five`);
    await m.stop();
  },
});

Deno.test({
  name: "a played hand pays exactly what the hand was worth",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();
    const id = sitting(m).id;
    await playOut(m);

    const match = sitting(m);
    const scored = only(
      m.rows("round").filter((r) => r.match_id === id && Number(r.hand_no) === 1),
      "hand 1",
    );
    const us = Number(match.us_score);
    const them = Number(match.them_score);
    // What the hand was worth, derived from the log and the ladder alone: the
    // table opens under mineiro, and each accepted raise takes the rung
    // standing and climbs one. Reading the reference out of round.stake — the
    // column an accept has to adopt — would conserve nothing: a stake that
    // climbs only in the banner pays the base and the equation still balances.
    const MINEIRO = [2, 4, 8, 10, 12];
    const accepts = m.rows("play").filter((p) => p.round_id === scored.id && p.kind === "accept").length;
    const worth = MINEIRO[accepts];
    assert(worth !== undefined, `${accepts} accepted raises is off the ladder`);
    assert(
      Number(scored.stake) === worth,
      `${accepts} accepted raises settle on ${worth}, and the round carries ${scored.stake}`,
    );
    assert(
      ["us", "them", "draw"].includes(String(scored.result)),
      `hand 1 ended on "${scored.result}", which is no verdict`,
    );
    const paid = scored.result === "draw" ? 0 : worth;
    assert(us + them === paid, `hand 1 was worth ${paid} and the score moved ${us + them}`);
    assert(us === (scored.result === "us" ? paid : 0), `us took ${us} on a ${scored.result} hand`);
    assert(them === (scored.result === "them" ? paid : 0), `eles took ${them} on a ${scored.result} hand`);
    // And the round the match adopted the stake from is the one it paid: the
    // badge the reader was shown is the same number.
    assert(
      m.one(".matchbox").getAttribute("data-us") === String(us),
      `the scoreboard says ${m.one(".matchbox").getAttribute("data-us")} and the match holds ${us}`,
    );
    // The table deals again without being asked.
    assert(Number(sitting(m).hand_no) === 2, `the match sat on hand ${sitting(m).hand_no}`);
    assert(hand(m).hand_no === "2", "the felt kept the hand that was already paid for");
    await m.stop();
  },
});

Deno.test({
  name: "the Rio de la Plata table deals its own four and climbs its own ladder",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Argentino, Uruguayo and Paraguayo are dealt from four fixed cards with no
    // vira — 1 de espadas, 1 de bastos, 7 de espadas, 7 de oros, which this
    // deck spells A and 7 — and climb truco 2 / retruco 3 / vale cuatro 4 to a
    // game of thirty. Envido and flor are not dealt yet; everything else about
    // the table is this family's, and none of it is Paulista's.
    const m = await table();
    await m.settle();
    m.fire(variantOption(m, "Truco Argentino"));
    await m.settle();

    const match = sitting(m);
    assert(match.variant === "argentino", `the picker did not take: ${match.variant}`);
    assert(Number(match.stake) === 1, `the hand opened at ${match.stake}, not 1`);

    // No turn-up at all: a vira on this table is a Brazilian idea, and the
    // strip that shows one has nothing to say here. The strip reads the round's
    // own column, so an empty turn-up is what hides it — no list of variants
    // kept in the stylesheet to fall out of step with the dealer's.
    const round = hand(m);
    assert(round.vira === "", `the table turned up ${round.vira}`);
    assert(
      m.one(".handline").getAttribute("data-vira") === "",
      "the vira strip is still bound to a turn-up nobody laid",
    );
    await m.stop();
  },
});

Deno.test({
  name: "the Rio de la Plata four run strictly down and no two cards tie",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // A suit can order four cards of one rank and nothing else, so it orders a
    // turn-up's four and decides nothing between cards a table names: across
    // the river the 1 and the 7 of swords are both manilhas and share a suit,
    // and two manilhas at equal power make a vaza an empate the rules do not
    // have. What separates named trumps is their place in the list that names
    // them, and that is what this holds.
    //
    // Judged over every card the match dealt rather than over four the deal
    // has to be lucky enough to show: each one is worth its place in the
    // table's own order, and nothing else.
    const m = await table();
    await m.settle();
    m.fire(variantOption(m, "Truco Argentino"));
    await m.settle();
    // A switch respins the seed under the same match, so the epoch before it
    // is still in the store and its rounds share this match's id.
    const epoch = `${sitting(m).id}/s${sitting(m).seed}/`;
    for (let hand = 0; hand < 80 && sitting(m).status === "playing"; hand++) {
      await playOut(m);
    }

    // 1 de espadas, 1 de bastos, 7 de espadas, 7 de oros \u2014 the order the rules
    // give, which this deck spells with A for the one.
    const ORDER = ["A\u2660", "A\u2663", "7\u2660", "7\u2666"];
    const RANKS = ["4", "5", "6", "7", "Q", "J", "K", "A", "2", "3"];
    const worth = (card: string) => {
      const at = ORDER.indexOf(card);
      return at < 0 ? RANKS.indexOf(card.slice(0, -1)) + 1 : 96 + ORDER.length - at;
    };

    const held = m.rows("held").filter((h) => h.round_id.startsWith(epoch));
    assert(held.length > 0, "the argentino table dealt nothing to judge");
    for (const h of held) {
      assert(
        Number(h.power) === worth(h.card),
        `${h.card} is worth ${h.power}, and this table's order puts it at ${worth(h.card)}`,
      );
      assert(
        (h.manilha === "yes") === ORDER.includes(h.card),
        `${h.card} is called manilha "${h.manilha}" at a table that names ${ORDER.join(" ")}`,
      );
    }
    assertTurnUp(m);
    await m.stop();
  },
});

Deno.test({
  name: "the Catalan table turns nothing up and ranks on the bare card",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Every table this app dealt until now had trumps: a turn-up named four,
    // or the rules did. Catalonia names none — suits are irrelevant there and
    // a card is worth the order it shows, which is this deck's order already.
    // That is a third thing the round's two columns have to be able to say,
    // and until the manilha column could say "nenhuma" the invariant forbade
    // the only table in the file that needs it.
    const m = await table();
    await m.settle();
    m.fire(variantOption(m, "Truc Catal\u00e3o"));
    await m.settle();
    const match = sitting(m);
    assert(match.variant === "truc", `the picker did not take: ${match.variant}`);
    assert(Number(match.stake) === 1, `the hand opened at ${match.stake}, not 1`);

    const round = hand(m);
    assert(round.vira === "", `a table with no manilhas turned up ${round.vira}`);
    assert(round.manilha === "nenhuma", `the round calls its manilhas "${round.manilha}"`);

    const RANKS = ["4", "5", "6", "7", "Q", "J", "K", "A", "2", "3"];
    const held = m.rows("held").filter((h) => h.round_id === round.id);
    assert(held.length > 0, "the Catalan table dealt nothing to judge");
    for (const h of held) {
      assert(h.manilha === "no", `${h.card} is called a manilha at a table that has none`);
      assert(
        Number(h.power) === RANKS.indexOf(h.card.slice(0, -1)) + 1,
        `${h.card} is worth ${h.power} and its bare rank puts it at ${RANKS.indexOf(h.card.slice(0, -1)) + 1}`,
      );
    }
    assertTurnUp(m);
    await m.stop();
  },
});

// The envido's own arithmetic, written out here rather than imported: two
// cards of one suit are twenty and both their pips, otherwise the best single
// card, and the three face cards are worth nothing. A test that asked the
// dealer for this number would be asking the dealer whether it agrees with
// itself.
const ENVIDO_PIPS: Record<string, number> = {
  "4": 4, "5": 5, "6": 6, "7": 7, Q: 0, J: 0, K: 0, A: 1, "2": 2, "3": 3,
};
const envidoOf = (cards: string[]) => {
  let best = 0;
  for (let i = 0; i < cards.length; i++) {
    best = Math.max(best, ENVIDO_PIPS[cards[i].slice(0, -1)]);
    for (let j = i + 1; j < cards.length; j++) {
      if (cards[i].slice(-1) === cards[j].slice(-1)) {
        best = Math.max(
          best,
          20 + ENVIDO_PIPS[cards[i].slice(0, -1)] + ENVIDO_PIPS[cards[j].slice(0, -1)],
        );
      }
    }
  }
  return best;
};

Deno.test({
  name: "the envido is a second wager, counted on the deal and paid at once",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Truco asks who takes two of three rodadas. The envido asks a different
    // question — who holds the better cards by a point count — and is settled
    // inside the first rodada, paying whichever side wins it whether or not
    // that side goes on to win the hand. It is the round's second slot, and
    // the score moves the moment it resolves rather than when the hand does.
    //
    // The house refuses a weak count, and a refusal shows no cards, so the
    // counts are only on the round when it was taken. Argentino and uruguayo
    // both play the envido and a switch between them respins the seed, which
    // is how this reaches a hand the house wants.
    //
    // The mano's tiebreak is judged below whenever the two counts land equal
    // and nothing here makes them: equal counts are rare, and this stops at
    // the first envido the house takes. It is stated, not covered.
    const m = await table();
    await m.settle();
    // Keeps dealing until it has seen a concession, not merely a settlement:
    // an answer that beats the mão out loud says nothing about whether a
    // losing side keeps its cards to itself.
    let scored = 0;
    let ran = 0;
    let conceded = 0;
    for (let deal = 0; deal < 40 && conceded === 0; deal++) {
      m.fire(variantOption(m, deal % 2 === 0 ? "Truco Argentino" : "Truco Uruguaio"));
      await m.settle();
      const before = sitting(m);
      const round = hand(m);
      assert(round.envido === "", `the hand was dealt with an envido already ${round.envido}`);
      assert(
        (round.envido_calls ?? "").split(" ").includes("envido"),
        `a table that deals the envido offers "${round.envido_calls}"`,
      );
      const dealt = m.rows("held").filter((h) => h.round_id === round.id);
      const mine = ["you", "parca"];
      const ours = envidoOf(dealt.filter((h) => mine.includes(h.seat)).map((h) => h.card));
      const theirs = envidoOf(dealt.filter((h) => !mine.includes(h.seat)).map((h) => h.card));

      m.fire(m.one("#btn-envido"));
      await m.settle();

      const done = only(
        m.rows("round").filter((r) => r.id === round.id),
        "the hand the envido was called on",
      );
      assert(
        done.envido === "scored" || done.envido === "ran",
        `the envido was called and is still ${done.envido || "unanswered"}`,
      );
      // The hand itself is undecided either way, and the envido was paid anyway.
      assert((done.result ?? "") === "", `the hand ended as ${done.result} before the envido was judged`);
      // The felt reads the wager's state off this attribute and shows or hides
      // the rail by it (ir decision-33), so a column the region never declared
      // is a layout that never changes. Held here because no stylesheet runs
      // in this harness to fail instead.
      assert(
        m.one(".hand").getAttribute("data-envido") === done.envido,
        `the round says ${done.envido} and the felt carries "${m.one(".hand").getAttribute("data-envido")}"`,
      );

      let paid: number;
      if (done.envido === "scored") {
        scored++;
        // The mão says its number first, and whoever answers either beats it
        // out loud or concedes without showing — so the mão's side is always
        // on the round, and the other side's only when it was higher.
        const manoIsOurs = mine.includes(round.leader);
        const manoCount = manoIsOurs ? ours : theirs;
        const otherCount = manoIsOurs ? theirs : ours;
        const manoShown = Number(manoIsOurs ? done.envido_us : done.envido_them);
        const otherShown = Number(manoIsOurs ? done.envido_them : done.envido_us);
        assert(manoShown === manoCount, `the mão said ${manoShown} and the deal says ${manoCount}`);
        assert(
          otherShown === (otherCount > manoCount ? otherCount : 0),
          `the answering side shows ${otherShown} holding ${otherCount} against ${manoCount}`,
        );

        // And it is said in that order, in the log the table reads back.
        const spoken = m.rows("play")
          .filter((p) => p.round_id === round.id)
          .sort((x, y) => Number(x.seq) - Number(y.seq))
          .filter((p) => p.kind === "envido_count" || p.kind === "envido_good");
        assert(spoken.length === 2, `the envido was settled with ${spoken.length} things said`);
        assert(spoken[0].kind === "envido_count", "the mão did not say a number first");
        assert(
          Number(spoken[0].count) === manoCount,
          `the mão said "${spoken[0].count}" holding ${manoCount}`,
        );
        if (otherCount > manoCount) {
          assert(
            spoken[1].kind === "envido_count" && Number(spoken[1].count) === otherCount,
            `holding ${otherCount} against ${manoCount}, the answer was ${spoken[1].kind}`,
          );
        } else {
          conceded++;
          assert(
            spoken[1].kind === "envido_good",
            `holding ${otherCount} against ${manoCount}, the answer was ${spoken[1].kind}`,
          );
        }
        // A tie goes to the mano, who led the first rodada.
        const expected = ours === theirs
          ? (mine.includes(round.leader) ? "us" : "them")
          : ours > theirs ? "us" : "them";
        assert(done.envido_result === expected, `${ours} against ${theirs} went to ${done.envido_result}`);
        paid = 2;
      } else {
        ran++;
        // Refused without showing: it pays the side that asked, which is ours.
        assert(done.envido_result === "us", `we called and the refusal paid ${done.envido_result}`);
        assert(Number(done.envido_us) === 0 && Number(done.envido_them) === 0,
          `a refused envido showed ${done.envido_us} against ${done.envido_them}`);
        paid = 1;
      }
      const side = done.envido_result === "us" ? "us_score" : "them_score";
      assert(
        Number(sitting(m)[side]) === Number(before[side]) + paid,
        `the envido paid ${Number(sitting(m)[side]) - Number(before[side])} to ${done.envido_result}, not ${paid}`,
      );
    }
    assert(scored > 0, `forty envidos called, ${ran} refused and none taken, so no count was ever judged`);
    assert(conceded > 0, `${scored} envidos taken and every answer beat the mão, so no concession was judged`);
    await m.stop();
  },
});

Deno.test({
  name: "a falta envido at nil-nil is the whole match",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Falta envido is the one call whose worth the score decides: it is what
    // the leading side still has to run, not a rung on any ladder. Called at
    // nil-nil on a table playing to thirty it is worth thirty — taking it wins
    // the match on a wager whose hand nobody has played a card of.
    // The house refuses a weak count, and a refusal pays one whatever was
    // called, so this deals until one is taken — a refused falta says nothing
    // about what a falta is worth.
    const m = await table();
    await m.settle();
    let taken = 0;
    for (let deal = 0; deal < 16 && taken === 0; deal++) {
      m.fire(variantOption(m, deal % 2 === 0 ? "Truco Argentino" : "Truco Uruguaio"));
      await m.settle();
      const before = sitting(m);
      assert(Number(before.us_score) === 0 && Number(before.them_score) === 0,
        `the switch left the score at ${before.us_score}-${before.them_score}`);
      const round = hand(m);

      m.fire(m.one("#btn-envido-falta"));
      await m.settle();

      const done = only(m.rows("round").filter((r) => r.id === round.id), "the hand");
      const after = sitting(m);
      if (done.envido === "scored") {
        taken++;
        const side = done.envido_result === "us" ? "us_score" : "them_score";
        assert(Number(after[side]) === 30, `a falta taken at nil-nil paid ${after[side]}, not the thirty left to run`);
        assert(after.status === "over", `the match paid out thirty and is still ${after.status}`);
        assert(after.status === "over", `the match paid out thirty and is still ${after.status}`);
      } else {
        assert(done.envido === "ran", `the falta was called and is ${done.envido}`);
        assert(Number(after.us_score) === 1, `refusing the first call paid ${after.us_score}, not 1`);
        assert(after.status === "playing", "refusing a falta ended the match");
      }
    }
    assert(taken > 0, "sixteen faltas called and the house refused every one");
    await m.stop();
  },
});

Deno.test({
  name: "a truco answered with envido waits while the envido is paid",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // El envido va primero. A side owing an answer to a truco may answer with
    // envido instead; the envido runs to its end and only then does the table
    // come back to the truco, which has stood unanswered the whole time.
    //
    // Nothing suspends the truco and nothing resumes it: both wagers are read
    // off the same log, and answering the envido never touched the call
    // underneath. This is the claim the round's shape rests on, so it is held
    // to the table rather than to the shape.
    //
    // Driven from this side, because this side is the one that can be made to
    // truco on demand: the house answers with envido whenever its count is
    // worth the bet.
    const m = await table();
    await m.settle();
    m.fire(variantOption(m, "Truco Argentino"));
    await m.settle();
    let held = 0;
    for (let hand_i = 0; hand_i < 200 && held === 0; hand_i++) {
      if (sitting(m).status !== "playing") {
        m.fire(variantOption(m, hand_i % 2 === 0 ? "Truco Uruguaio" : "Truco Argentino"));
        await m.settle();
      }
      await m.settle();
      const round = hand(m);
      const mine = playable(m);
      // Only worth trucoing on a hand still in its first rodada with the
      // envido unspoken and a rung left to ask for.
      if (mine.length === 0 || (round.v1 ?? "") !== "" || (round.envido ?? "") !== "" ||
          (round.asked ?? "") !== "" || Number(round.rung) === 0) {
        await playOut(m);
        continue;
      }

      m.fire(m.one("#btn-truco"));
      await m.settle();

      const called = only(m.rows("round").filter((r) => r.id === round.id), "the hand");
      if (called.envido !== "called" || !String(called.envido_asked ?? "").startsWith("eles")) {
        await playOut(m);
        continue;
      }
      held++;

      // The house answered the truco with an envido, and the truco is still
      // standing underneath: nobody cleared it.
      assert((called.asked ?? "") === "you", `the truco was yours and the round says "${called.asked}"`);
      assert(
        (called.envido_calls ?? "").split(" ").includes("answer"),
        `the envido is owed by this seat and the felt offers "${called.envido_calls}"`,
      );

      m.fire(m.one("#btn-envido-take"));
      await m.settle();

      const paid = only(m.rows("round").filter((r) => r.id === round.id), "the hand");
      assert(paid.envido === "scored", `the envido was taken and is ${paid.envido}`);

      // The order is the claim, and the order is in the log — a settled table
      // has already let the house answer the truco it stepped in front of, so
      // reading the round afterwards reads past the moment this is about.
      const said = m.rows("play")
        .filter((p) => p.round_id === round.id)
        .sort((x, y) => Number(x.seq) - Number(y.seq))
        .map((p) => p.kind);
      const truco = said.indexOf("truco");
      const envido = said.indexOf("envido");
      const took = said.indexOf("envido_take");
      const answer = said.findIndex((k) => k === "accept" || k === "run");
      assert(truco >= 0 && envido > truco, `the envido did not answer a truco: ${said.join(" ")}`);
      assert(took > envido, `the envido was never settled: ${said.join(" ")}`);
      assert(
        answer > took,
        `the truco was answered before the envido was paid, or never: ${said.join(" ")}`,
      );
    }
    assert(held > 0, "two hundred hands and the house never answered a truco with an envido");
    await m.stop();
  },
});

Deno.test({
  name: "the house climbs the envido, and the chain is what it pays",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // A count well past what it would have opened on is worth climbing. Real
    // envido adds three where the plain call added two, so a chain of both
    // pays five taken — which is the first time in play that the chain is
    // longer than one call and the arithmetic means anything.
    const m = await table();
    await m.settle();
    let climbed = 0;
    for (let deal = 0; deal < 60 && climbed === 0; deal++) {
      m.fire(variantOption(m, deal % 2 === 0 ? "Truco Argentino" : "Truco Uruguaio"));
      await m.settle();
      const before = sitting(m);
      const round = hand(m);
      if (!(round.envido_calls ?? "").split(" ").includes("envido")) continue;

      m.fire(m.one("#btn-envido"));
      await m.settle();

      const raised = only(m.rows("round").filter((r) => r.id === round.id), "the hand");
      const chain = m.rows("play")
        .filter((p) => p.round_id === round.id)
        .sort((x, y) => Number(x.seq) - Number(y.seq))
        .filter((p) => ["envido", "envido_real", "envido_falta"].includes(p.kind));
      if (chain.length < 2) continue;
      climbed++;

      assert(chain[0].kind === "envido", `the chain opened on ${chain[0].kind}`);
      assert(chain[1].kind === "envido_real", `the house climbed to ${chain[1].kind}`);
      assert(
        String(chain[1].seat).startsWith("eles"),
        `the climb came from ${chain[1].seat}, not the house`,
      );
      assert(raised.envido === "called", `a climbed envido reads ${raised.envido}`);
      assert(
        (raised.envido_calls ?? "").split(" ").includes("answer"),
        `the raise is owed by this seat and the felt offers "${raised.envido_calls}"`,
      );
      assert(Number(raised.envido_rung) === 5, `envido and real envido stand at ${raised.envido_rung}, not 5`);

      m.fire(m.one("#btn-envido-take"));
      await m.settle();

      const paid = only(m.rows("round").filter((r) => r.id === round.id), "the hand");
      assert(paid.envido === "scored", `the chain was taken and reads ${paid.envido}`);
      const side = paid.envido_result === "us" ? "us_score" : "them_score";
      assert(
        Number(sitting(m)[side]) === Number(before[side]) + 5,
        `the chain paid ${Number(sitting(m)[side]) - Number(before[side])}, not the five it stood at`,
      );
    }
    assert(climbed > 0, "sixty envidos and the house never climbed one");
    await m.stop();
  },
});

Deno.test({
  name: "an envido tied on the count is won by the mão",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Equal counts go to the mão. Waiting for two hands to tie is waiting on
    // luck, and every earlier attempt at this rule judged nothing because no
    // deal ever landed on it — so the deal is asked for by name. A hand is a
    // pure function of the seed and the hand's number, and seed 65 deals both
    // sides twenty-four: 4♥ with J♥ here, 4♠ with J♠ across the table.
    const m = await table();
    await m.settle();
    m.fire(variantOption(m, "Truco Argentino"));
    await m.settle();
    m.fire("#btn-set-seat", "click", { detail: { seat: "you", seed: "65", opponent: "nezinho" } });
    await m.settle();

    const seated = sitting(m);
    assert(seated.seed === "65", `the table sat down on seed ${seated.seed}`);
    assert(seated.opponent === "nezinho", `the table sat down against ${seated.opponent}`);
    assert(Number(seated.hand_no) === 1, `the seeded table opened on hand ${seated.hand_no}`);

    const round = hand(m);
    assert(round.leader === "you", `hand one is led by ${round.leader}, so the mão is not yours`);
    const ours = m.rows("held")
      .filter((h) => h.round_id === round.id && h.seat === "you")
      .map((h) => h.card).sort().join(" ");
    assert(ours === "4♥ 7♦ J♥", `seed 65 dealt you ${ours}`);

    m.fire(m.one("#btn-envido"));
    await m.settle();

    const done = only(m.rows("round").filter((r) => r.id === round.id), "the hand");
    assert(done.envido === "scored", `the tied envido reads ${done.envido}`);
    assert(Number(done.envido_us) === 24, `the mão said ${done.envido_us}, holding twenty-four`);
    assert(
      Number(done.envido_them) === 0,
      `equal counts are conceded without showing, and the round wrote ${done.envido_them}`,
    );
    assert(
      done.envido_result === "us",
      `twenty-four against twenty-four went to ${done.envido_result}, and the mão is ours`,
    );
    assert(Number(sitting(m).us_score) === 2, `the tie paid ${sitting(m).us_score}, not the envido's two`);
    await m.stop();
  },
});

Deno.test({
  name: "at four seats it is the mão that says the number, not its side",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // The mão is a seat. At two seats it is also the only seat on its side, so
    // a side-lookup lands on it by accident and the difference never shows. At
    // four the mão rotates with the hand, and a lookup by side finds whichever
    // partner sits earlier — so the table would put the number in the wrong
    // player's mouth on every hand its partner leads.
    const m = await table();
    await m.settle();
    const seatOpt = m.byRole("option", /^2v2\b/);
    assert(seatOpt.length === 1, `"2v2" names ${seatOpt.length} options, not one`);
    m.fire(seatOpt[0]);
    await m.settle();
    m.fire(variantOption(m, "Truco Argentino"));
    await m.settle();
    assert(sitting(m).seats === "2v2", `the table seats ${sitting(m).seats}`);

    let judged = 0;
    for (let hand_i = 0; hand_i < 160 && judged === 0; hand_i++) {
      if (sitting(m).status !== "playing") {
        m.fire(variantOption(m, hand_i % 2 === 0 ? "Truco Uruguaio" : "Truco Argentino"));
        await m.settle();
      }
      const round = hand(m);
      await playOut(m);
      const done = m.rows("round").find((r) => r.id === round.id);
      if (done === undefined || done.envido !== "scored") continue;
      // Only the seats a side-lookup would miss say anything about this: the
      // first seat of each side is where such a lookup lands, so a hand led by
      // you or by eles1 reads the same either way.
      if (round.leader !== "parca" && round.leader !== "eles2") continue;
      judged++;

      const spoken = m.rows("play")
        .filter((p) => p.round_id === round.id)
        .sort((x, y) => Number(x.seq) - Number(y.seq))
        .filter((p) => p.kind === "envido_count" || p.kind === "envido_good");
      assert(spoken.length === 2, `the envido was settled with ${spoken.length} things said`);
      assert(
        spoken[0].seat === round.leader,
        `the hand was led by ${round.leader} and ${spoken[0].seat} said the number`,
      );
      // And the answer comes from the seat the rule asks next — the first one
      // round the table, from the mão, on the other side — not from whichever
      // opponent happens to sit earliest.
      const ORDER = ["you", "eles1", "parca", "eles2"];
      const ours = ["you", "parca"];
      const mine = (seat: string) => ours.includes(seat);
      const at = ORDER.indexOf(String(round.leader));
      const asked = ORDER.slice(at + 1).concat(ORDER.slice(0, at))
        .find((seat) => mine(seat) !== mine(String(round.leader)));
      assert(
        spoken[1].seat === asked,
        `${round.leader} led, so ${asked} is asked next and ${spoken[1].seat} answered`,
      );
    }
    assert(judged > 0, "a hundred and sixty hands and no envido was settled on one led by parça or eles2");
    await m.stop();
  },
});

Deno.test({
  name: "douradinha seats three pairs and builds a storey on mineiro",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Six players in three pairs, partners alternating so nobody sits beside
    // their own. The deck is the ordinary forty; what Minas adds is five named
    // cards above the zap — the dama de ouros the game is named for, then the
    // valete de paus, the dunga, the piu and the cinquinho — and mineiro's
    // four underneath them.
    const m = await table();
    await m.settle();
    m.fire(variantOption(m, "Douradinha"));
    await m.settle();

    const match = sitting(m);
    assert(match.variant === "douradinha", `the picker did not take: ${match.variant}`);
    assert(match.seats === "2v2v2", `douradinha sat ${match.seats}`);

    const round = hand(m);
    assert(round.vira === "", `douradinha turned up ${round.vira}`);
    assert(round.manilha === "fixas", `douradinha calls its manilhas "${round.manilha}"`);

    const dealt = m.rows("held").filter((h) => h.round_id === round.id);
    assert(dealt.length === 18, `three cards to six seats is eighteen, and the table dealt ${dealt.length}`);
    const seats = new Set(dealt.map((h) => h.seat));
    assert(seats.size === 6, `the table dealt to ${seats.size} seats`);
    for (const seat of ["you", "eles1", "eles2", "parca", "eles3", "eles4"]) {
      assert(seats.has(seat), `${seat} was dealt nothing`);
    }

    // The storey, strongest first, then mineiro's four beneath it.
    const ORDER = ["Q♦", "J♣", "2♣", "A♣", "5♣", "4♣", "7♥", "A♠", "7♦"];
    for (const h of dealt) {
      assert(
        (h.manilha === "yes") === ORDER.includes(h.card),
        `${h.card} is called manilha "${h.manilha}" at a table naming nine`,
      );
    }
    for (let i = 1; i < ORDER.length; i++) {
      const hi = dealt.find((h) => h.card === ORDER[i - 1]);
      const lo = dealt.find((h) => h.card === ORDER[i]);
      if (hi === undefined || lo === undefined) continue;
      assert(
        Number(hi.power) > Number(lo.power),
        `${ORDER[i - 1]} is worth ${hi.power} and ${ORDER[i]} is worth ${lo.power}`,
      );
    }
    assertTurnUp(m);
    await m.stop();
  },
});

Deno.test({
  name: "douradão deals a card no rank and no suit can make",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Every other table is dealt out of a rank crossed with a suit, forty
    // cards and no more. Douradão puts a curinga over all thirteen it names,
    // and a curinga is neither a rank nor a suit — so the deck is what the
    // grid makes plus what the table names on top of it.
    const m = await table();
    await m.settle();
    let held = 0;
    for (let deal = 0; deal < 20 && held === 0; deal++) {
      m.fire(variantOption(m, deal % 2 === 0 ? "Douradão" : "Douradinha"));
      await m.settle();
      const match = sitting(m);
      if (match.variant !== "douradao") continue;
      assert(match.seats === "2v2v2", `douradão sat ${match.seats}`);

      const round = hand(m);
      const dealt = m.rows("held").filter((h) => h.round_id === round.id);
      assert(dealt.length === 18, `three cards to six seats is eighteen, and the table dealt ${dealt.length}`);
      const wild = dealt.find((h) => h.card === "★");
      if (wild === undefined) continue;
      held++;

      assert(wild.manilha === "yes", `the curinga is called manilha "${wild.manilha}"`);
      const others = dealt.filter((h) => h.card !== "★").map((h) => Number(h.power));
      assert(
        Number(wild.power) > Math.max(...others),
        `the curinga is worth ${wild.power} and something beat it at ${Math.max(...others)}`,
      );
      // And what it sits over is the table's own list, in its own order.
      const ORDER = ["★", "K♦", "7♣", "A♦", "J♦", "Q♦", "J♣", "A♣", "2♣", "5♣", "4♣", "3♣", "7♥"];
      for (let i = 1; i < ORDER.length; i++) {
        const hi = dealt.find((h) => h.card === ORDER[i - 1]);
        const lo = dealt.find((h) => h.card === ORDER[i]);
        if (hi === undefined || lo === undefined) continue;
        assert(
          Number(hi.power) > Number(lo.power),
          `${ORDER[i - 1]} is worth ${hi.power} and ${ORDER[i]} is worth ${lo.power}`,
        );
      }
    }
    assert(held > 0, "twenty deals of douradão and the curinga was never among them");
    await m.stop();
  },
});

Deno.test({
  name: "leaving a table of three pairs names no winner, and every pair has a score",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Two sides make "the other side" a thing a table has, and three do not.
    // Conceding hands the match to the only other pair where there is one;
    // handing it to whichever of two came first would be inventing a rule, so
    // the table stops with nobody named. Leaving must not ask for a single
    // other either: at three pairs there is none, and the dealer refuses the
    // question rather than answering it wrongly.
    const m = await table();
    await m.settle();
    m.fire(variantOption(m, "Douradinha"));
    await m.settle();
    assert(sitting(m).seats === "2v2v2", `douradinha sat ${sitting(m).seats}`);

    // A score for every pair the table seats, on the row and on the felt.
    const seated = sitting(m);
    assert(seated.others_score !== undefined, "the third pair has no score on the match");
    assert(
      m.one(".score.others .figure").textContent?.trim() === "0",
      "the felt draws no figure for the third pair",
    );

    const left = seated.id;
    m.fire("#btn-resign");
    await m.settle();

    // A table left behind opens a fresh sitting by itself, so the match to
    // read is the one that was walked away from, by name.
    const done = only(m.rows("match").filter((r) => r.id === left), "the table you left");
    assert(done.status === "over", `leaving left the table ${done.status}`);
    assert(done.winner === "", `leaving a table of three named ${done.winner} the winner`);
    assert(
      Number(done.us_score) === 0 && Number(done.them_score) === 0 && Number(done.others_score) === 0,
      `leaving paid somebody: ${done.us_score}-${done.them_score}-${done.others_score}`,
    );
    await m.stop();
  },
});

Deno.test({
  name: "a table of three pairs plays a match to the end, and any pair can win it",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // The two-sided tests say nothing about three pairs, so this one plays
    // them.
    //
    // A call is owed there by two pairs, and each answers once: a house that
    // answered as one fixed pair would answer for it again every beat, and the
    // call would never settle — so a match reaching its end at all is the
    // first thing held. Then any of the three can take a hand, and the pair
    // that is neither "us" nor "them" has to be paid when it does. Judged per
    // hand rather than per match, because a hand is where the paying happens
    // and a match won by one particular pair is a long wait.
    const m = await table();
    await m.settle();
    const COLUMN = { us: "us_score", them: "them_score", others: "others_score" } as Record<string, string>;
    let othersPaid = 0;
    let finished = 0;
    for (let match = 0; match < 8 && othersPaid === 0; match++) {
      m.fire(variantOption(m, match % 2 === 0 ? "Douradinha" : "Douradão"));
      await m.settle();
      assert(sitting(m).seats === "2v2v2", `the table seats ${sitting(m).seats}`);
      const id = sitting(m).id;
      for (let dealt = 0; dealt < 40 && sitting(m).status === "playing"; dealt++) {
        const before = sitting(m);
        const round = hand(m);
        await playOut(m);
        const played = m.rows("round").find((r) => r.id === round.id);
        if (played?.result !== "others") continue;
        const after = only(m.rows("match").filter((r) => r.id === id), "the match");
        const gained = Number(after.others_score) - Number(before.others_score);
        const owed = Math.min(Number(played.stake), 12 - Number(before.others_score));
        assert(gained === owed, `the third pair took a hand worth ${played.stake} and was paid ${gained}`);
        othersPaid++;
      }
      const done = only(m.rows("match").filter((r) => r.id === id), "the match just played");
      assert(done.status === "over", `forty hands and a table of three is still ${done.status}`);
      assert(
        Number(done[COLUMN[String(done.winner)]]) === 12,
        `${done.winner} won on ${done[COLUMN[String(done.winner)]]}, and the race is to twelve`,
      );
      finished++;
    }
    assert(finished > 0, "no table of three reached its end");
    assert(othersPaid > 0, "the third pair never took a hand, so its paying was never judged");
    await m.stop();
  },
});

Deno.test({
  name: "a match won on the wager stops the table",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Every other way a match ends, the hand that ended it was already over:
    // the score is paid when the hand is. An envido pays mid-rodada, so a match
    // can be decided with every card still in hand — and a table that did not
    // ask the match would carry on and pay again for a hand nobody needed.
    //
    // Your cards are tappable only on the hands you lead, so a deal where the
    // falta lands and you are the mão is what this has to find: judging it on
    // a hand somebody else leads proves nothing, because nothing is tappable
    // there anyway.
    const m = await table();
    await m.settle();
    let judged = 0;
    for (let deal = 0; deal < 60 && judged === 0; deal++) {
      m.fire(variantOption(m, deal % 2 === 0 ? "Truco Argentino" : "Truco Uruguaio"));
      await m.settle();
      const round = hand(m);
      if (round.leader !== "you") continue;

      m.fire(m.one("#btn-envido-falta"));
      await m.settle();

      const done = only(m.rows("round").filter((r) => r.id === round.id), "the hand");
      if (done.envido !== "scored") continue;
      judged++;

      const won = sitting(m);
      assert(won.status === "over", `a falta taken at nil-nil left the match ${won.status}`);
      assert((done.result ?? "") === "", "the hand had already been decided, so this proves nothing");
      assert(
        playable(m).length === 0,
        `${playable(m).length} cards are still tappable on a hand you lead in a match already won`,
      );

      const side = done.envido_result === "us" ? "us_score" : "them_score";
      const hands = Number(won.hand_no);
      for (let beat = 0; beat < 6; beat++) {
        const mine = playable(m);
        if (mine.length > 0) m.fire(mine[0]);
        await m.settle();
      }
      const rest = sitting(m);
      assert(rest.status === "over", `the won match restarted itself as ${rest.status}`);
      assert(Number(rest[side]) === 30, `the won match paid on to ${rest[side]}`);
      assert(Number(rest.hand_no) === hands, `the won match dealt on to hand ${rest.hand_no}`);
    }
    assert(judged > 0, "sixty deals and never a falta taken on a hand you lead");
    await m.stop();
  },
});

Deno.test({
  name: "a real envido opens the second wager at three",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Real envido adds three where a plain envido adds two, and a side may
    // open on it rather than climb to it. Refused, it still pays one: a
    // refusal pays what the chain was worth before the call refused, and
    // before the first call that is nothing.
    const m = await table();
    await m.settle();
    let taken = 0;
    for (let deal = 0; deal < 16 && taken === 0; deal++) {
      m.fire(variantOption(m, deal % 2 === 0 ? "Truco Argentino" : "Truco Uruguaio"));
      await m.settle();
      const before = sitting(m);
      const round = hand(m);

      m.fire(m.one("#btn-envido-real"));
      await m.settle();

      const done = only(m.rows("round").filter((r) => r.id === round.id), "the hand");
      const paid = done.envido === "scored" ? 3 : 1;
      if (done.envido === "scored") taken++;
      const side = done.envido_result === "us" ? "us_score" : "them_score";
      assert(
        Number(sitting(m)[side]) === Number(before[side]) + paid,
        `a real envido ${done.envido} paid ${Number(sitting(m)[side]) - Number(before[side])}, not ${paid}`,
      );
    }
    assert(taken > 0, "sixteen real envidos called and the house took none, so three was never judged");
    await m.stop();
  },
});

Deno.test({
  name: "a flor pays three and takes the envido off the hand",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Three of one suit. Whoever holds one declares it, and the envido leaves
    // the hand entirely — asked for or not. Uruguay and Paraguay deal it;
    // Argentina mostly does not, which is why this plays across the river.
    //
    // A flor falls about one deal in twenty, so this deals until one arrives
    // rather than seeding a hand the harness cannot ask for.
    const m = await table();
    await m.settle();
    let found = 0;
    for (let deal = 0; deal < 80 && found === 0; deal++) {
      m.fire(variantOption(m, deal % 2 === 0 ? "Truco Uruguaio" : "Truco Paraguaio"));
      await m.settle();
      const round = hand(m);
      const ours = m.rows("held")
        .filter((h) => h.round_id === round.id && h.seat === "you")
        .map((h) => h.card.slice(-1));
      if (ours.length !== 3 || new Set(ours).size !== 1) continue;
      found++;
      const before = sitting(m);

      m.fire(m.one("#btn-flor"));
      await m.settle();

      const done = only(m.rows("round").filter((r) => r.id === round.id), "the hand");
      assert(done.envido === "flor", `a flor was declared and the round says ${done.envido}`);
      assert(done.envido_result === "us", `our flor paid ${done.envido_result}`);
      assert(
        Number(sitting(m).us_score) === Number(before.us_score) + 3,
        `the flor paid ${Number(sitting(m).us_score) - Number(before.us_score)}, not 3`,
      );

      // And the envido is gone for the rest of the hand, not merely answered.
      m.fire(m.one("#btn-envido"));
      await m.settle();
      const still = only(m.rows("round").filter((r) => r.id === round.id), "the hand");
      assert(still.envido === "flor", `an envido was taken after a flor: ${still.envido}`);
      assert(
        m.rows("play").filter((p) => p.round_id === round.id && p.kind === "envido").length === 0,
        "an envido reached the log on a hand a flor had already closed",
      );
    }
    assert(found > 0, "eighty deals across Uruguay and Paraguay and never a flor to declare");
    await m.stop();
  },
});

Deno.test({
  name: "the envido window shuts when the first rodada does",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Envido belongs to the first rodada and nowhere else. Once the second
    // begins the window is shut for the rest of the hand, and the call is a
    // no-op rather than a late second wager.
    const m = await table();
    await m.settle();
    m.fire(variantOption(m, "Truco Argentino"));
    await m.settle();
    const round = hand(m);

    for (let turn = 0; turn < 24 && (hand(m).v1 ?? "") === ""; turn++) {
      // Nothing can be laid while a wager waits, and the house bets on its own
      // account now, so both are answered on the way to the end of the rodada.
      const owed = (hand(m).envido_calls ?? "").split(" ").includes("answer");
      const mine = playable(m);
      if (owed) m.fire(m.one("#btn-envido-take"));
      else if (mine.length > 0) m.fire(mine[0]);
      else if ((hand(m).asked ?? "") !== "") m.fire(m.one("#btn-accept"));
      await m.settle();
    }
    assert((hand(m).v1 ?? "") !== "", "the first rodada never resolved, so the window never shut");

    // The house may well have bet its own count inside the first rodada, so
    // what is held here is not that no envido exists — it is that calling one
    // now changes nothing, whether or not one was already settled.
    const was = hand(m).envido ?? "";
    const spoken = m.rows("play")
      .filter((p) => p.round_id === round.id && p.kind === "envido").length;

    m.fire(m.one("#btn-envido"));
    await m.settle();

    const done = only(m.rows("round").filter((r) => r.id === round.id), "the hand");
    assert((done.envido ?? "") === was, `the shut window moved from "${was}" to "${done.envido}"`);
    assert(
      m.rows("play").filter((p) => p.round_id === round.id && p.kind === "envido").length === spoken,
      "a late envido reached the log",
    );
    assert(
      !(done.envido_calls ?? "").split(" ").includes("envido"),
      `the felt still offers "${done.envido_calls}" in the second rodada`,
    );
    await m.stop();
  },
});

Deno.test({
  name: "the second wager is not dealt across a room",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // A count is read off the deal, and the deal is every seat's cards. This
    // dealer may work those out for a house it is also playing; it must not
    // work them out for a person across a room, which is the masking's whole
    // job. Until the count arrives as a row the other side wrote, the call is
    // refused online rather than settled from cards the screen is hiding.
    const m = await table();
    await m.settle();
    m.fire(variantOption(m, "Truco Argentino"));
    await m.settle();
    const opts = m.byRole("option", "Mesa Online");
    assert(opts.length === 1, `expected 1 Mesa Online option, got ${opts.length}`);
    m.fire(opts[0]);
    await m.settle();
    assert(sitting(m).opponent === "online", `the table is still against ${sitting(m).opponent}`);
    const round = hand(m);

    m.fire(m.one("#btn-envido"));
    await m.settle();

    const done = only(m.rows("round").filter((r) => r.id === round.id), "the hand");
    assert((done.envido ?? "") === "", `an online table answered an envido: ${done.envido}`);
    assert(
      m.rows("play").filter((p) => p.round_id === round.id && p.kind.startsWith("envido")).length === 0,
      "an online table wrote a second wager into the log",
    );
    assert(
      (done.envido_result ?? "") === "",
      `an online table paid an envido to ${done.envido_result}`,
    );
    await m.stop();
  },
});

Deno.test({
  name: "a table that does not play the envido never scores one",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Which tables deal a second wager is the dealer's answer, written on the
    // round, and the felt draws only what it names. Paulista names no envido,
    // so nothing of the family is offered there and none of it can reach the
    // round — a button that no rule could answer would be a dead control.
    const m = await table();
    await m.settle();
    m.fire(variantOption(m, "Truco Paulista"));
    await m.settle();
    const before = sitting(m);
    const round = hand(m);

    m.fire(m.one("#btn-envido"));
    await m.settle();

    const after = only(m.rows("round").filter((r) => r.id === round.id), "the standing hand");
    assert(
      (after.envido_calls ?? "") === "",
      `paulista offers "${after.envido_calls}" of a wager it does not deal`,
    );
    assert(
      (m.one(".hand").getAttribute("data-calls") ?? "") === "",
      `the felt carries "${m.one(".hand").getAttribute("data-calls")}" at a table with no second wager`,
    );
    assert((after.envido ?? "") === "", `paulista answered an envido with ${after.envido}`);
    assert(
      m.rows("play").filter((p) => p.round_id === round.id && p.kind.startsWith("envido")).length === 0,
      "paulista wrote an envido into the log",
    );
    assert(
      after.envido_result === "" || after.envido_result === undefined,
      `paulista paid an envido to ${after.envido_result}`,
    );
    assert(Number(sitting(m).us_score) === Number(before.us_score), "paulista moved the score on an envido");
    await m.stop();
  },
});

Deno.test({
  name: "gaúcho runs two voltas, and how long each is depends on the table",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Every other table plays to one number. Gaúcho plays two voltas — nine
    // each head to head, twelve each in pairs — so its goal is the one this
    // dealer reads off the match rather than off the variant alone. A match
    // that ends on the wrong number is a table dealt under the wrong name.
    for (const [seats, goal] of [["1v1", 18], ["2v2", 24]] as Array<[string, number]>) {
      // A fresh table per seat count: a picker only moves when it is moving
      // somewhere else, and a finished match is not a table to re-seat.
      const m = await table();
      await m.settle();
      const seatOpt = m.byRole("option", new RegExp(`^${seats}\\b`));
      assert(seatOpt.length === 1, `"${seats}" names ${seatOpt.length} options, not one`);
      m.fire(seatOpt[0]);
      await m.settle();
      m.fire(variantOption(m, "Truco Gaúcho"));
      await m.settle();
      assert(sitting(m).seats === seats, `the seats picker did not take: ${sitting(m).seats}`);
      assert(sitting(m).variant === "gaucho", `the table is ${sitting(m).variant}`);

      for (let hand = 0; hand < 120 && sitting(m).status === "playing"; hand++) {
        await playOut(m);
      }
      const done = sitting(m);
      assert(done.status === "over", `a ${seats} gaúcho match is still ${done.status}`);
      const won = Math.max(Number(done.us_score), Number(done.them_score));
      assert(won === goal, `a ${seats} gaúcho match ended on ${won}, and it runs to ${goal}`);
      await m.stop();
    }
  },
});

Deno.test({
  name: "a thirty-point match reaches thirty and ends",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // The goal and the clamp the running score passes through are two numbers
    // about the same race. Held apart, a table can be dealt to thirty while
    // its score stops climbing at twelve, and the match plays on forever with
    // nothing to show for it — no assertion about a single hand can see that,
    // because every hand of it is correct.
    const m = await table();
    await m.settle();
    m.fire(variantOption(m, "Truco Argentino"));
    await m.settle();
    assert(sitting(m).variant === "argentino", `the picker did not take: ${sitting(m).variant}`);

    for (let hand = 0; hand < 80 && sitting(m).status === "playing"; hand++) {
      await playOut(m);
    }
    const match = sitting(m);
    assert(match.status === "over", `eighty hands in, the table is still ${match.status}`);
    // Exactly thirty, not merely enough: every point either wager pays is
    // clamped against the same goal on its way in, so a hand worth more than
    // the distance left pays the distance and no more.
    const won = Math.max(Number(match.us_score), Number(match.them_score));
    assert(won === 30, `the match ended with ${won}, and it plays to exactly thirty`);
    assertTurnUp(m);
    await m.stop();
  },
});

Deno.test({
  name: "every variant the felt offers is one the dealer can price",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // The picker's options and the dealer's ladder are two lists. A table
    // offered under a name the ladder never heard of is priced by whatever
    // stands in for it — Gaucho dealt as Paulista, under Gaucho's name, which
    // is the one thing the variants exist to keep apart.
    const m = await table();
    await m.settle();
    const opens: Array<[string, string, number]> = [
      ["Truco Paulista", "paulista", 1],
      ["Truco Mineiro", "mineiro", 2],
      ["Truco Ga\u00facho", "gaucho", 1],
    ];
    for (const [option, variant, opening] of opens) {
      m.fire(variantOption(m, option));
      await m.settle();
      const match = sitting(m);
      assert(match.variant === variant, `the picker did not take: ${match.variant}`);
      assert(Number(match.stake) === opening, `${variant} opened at ${match.stake}, not ${opening}`);
    }
    await m.stop();
  },
});

Deno.test({
  name: "a variant switch deals into a fresh epoch, inheriting nothing",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();
    const before = hand(m);
    // Cards in the log first, so the restart has something to haunt with.
    m.fire(playable(m)[0]);
    await m.settle();
    assert(
      m.rows("play").filter((p) => p.round_id === before.id && p.kind === "card").length > 0,
      "no card ever reached the log",
    );
    const spun = sitting(m).seed;

    // The switch must CHANGE the variant — the standing option's arrow
    // rewrites nothing — and the table opens under mineiro.
    assert(sitting(m).variant === "mineiro", `the table opened under ${sitting(m).variant}`);
    m.fire(variantOption(m, "Truco Paulista"));
    await m.settle();

    const match = sitting(m);
    const round = hand(m);
    assert(match.variant === "paulista", `the picker did not take: ${match.variant}`);
    assert(match.seed !== spun, "the seed was not respun");
    // The round's identity carries the seed it was dealt from. Without that
    // epoch the fresh hand reuses the id the old one had — hand_no walked
    // back to 1 — and the append-only play rows filtered on that id haunt it:
    // the fold then scores rodadas nobody played this sitting.
    assert(
      String(round.id).includes(`/s${match.seed}/`),
      `the round does not name its epoch: ${round.id}`,
    );
    assert(
      m.rows("play").filter((p) => p.round_id === round.id).length === 0,
      `the fresh hand inherited ${m.rows("play").filter((p) => p.round_id === round.id).length} plays`,
    );
    // Bound entries only: the region's data-empty placeholder is an li too.
    const entries = m.all(".log li[data-kind]");
    assert(entries.length === 0, `the log rendered ${entries.length} inherited entries`);
    assert(
      [round.v1, round.v2, round.v3].every((v) => v === ""),
      `the fresh hand inherited verdicts: ${[round.v1, round.v2, round.v3]}`,
    );
    assert(match.us_score === "0" && match.them_score === "0", "the score carried across the rule change");
    await m.stop();
  },
});

Deno.test({
  name: "gaúcho deals the river's four and climbs Brazil's ladder",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();
    assert(sitting(m).variant === "mineiro", `the table opened under ${sitting(m).variant}`);
    m.fire(variantOption(m, "Truco Gaúcho"));
    await m.settle();
    const match = sitting(m);
    assert(match.variant === "gaucho", `the picker did not take: ${match.variant}`);
    // Rio Grande do Sul sits on the river's side of this: no turn-up at all,
    // and the same four named cards Argentina, Uruguay and Paraguay deal.
    // What it pays for them is a separate question, still open below.
    const round = hand(m);
    assert(round.vira === "", `ga\u00facho turned up ${round.vira}`);
    assert(round.manilha === "fixas", `ga\u00facho calls its manilhas "${round.manilha}"`);
    assert(
      m.one(".handline").getAttribute("data-vira") === "",
      "the vira strip is bound to a turn-up ga\u00facho does not lay",
    );
    // The river's game brings the river's wagers: gaúcho deals both, which no
    // other Brazilian table does, and the felt offers them by the dealer's own
    // reckoning rather than by a list of variants kept anywhere else.
    assert(
      (round.envido_calls ?? "").split(" ").includes("envido"),
      `gaúcho offers "${round.envido_calls}" of a wager its family deals`,
    );
    const RIVER = ["A\u2660", "A\u2663", "7\u2660", "7\u2666"];
    const dealt = m.rows("held").filter((h) => h.round_id === round.id);
    assert(dealt.length > 0, "ga\u00facho dealt nothing to judge");
    for (const h of dealt) {
      assert(
        (h.manilha === "yes") === RIVER.includes(h.card),
        `${h.card} is called manilha "${h.manilha}" at a table naming ${RIVER.join(" ")}`,
      );
    }
    for (let i = 1; i < RIVER.length; i++) {
      const hi = dealt.find((h) => h.card === RIVER[i - 1]);
      const lo = dealt.find((h) => h.card === RIVER[i]);
      if (hi === undefined || lo === undefined) continue;
      assert(
        Number(hi.power) > Number(lo.power),
        `${RIVER[i - 1]} is worth ${hi.power} and ${RIVER[i]} is worth ${lo.power}`,
      );
    }
    // Paulista's base rung, not mineiro's: gaúcho climbs 1/3/6/9/12, the same
    // ladder paulista does, under its own name.
    assert(match.stake === "1", `gaúcho opened at stake ${match.stake}, not paulista's base of 1`);

    // The opening stake alone would pass even if the dealer wired gaúcho to
    // mineiro's rungs by mistake: 1 is both ladders' base. Playing a whole
    // hand out and pricing what an accepted raise settled on is what would
    // actually fail on that mix-up, the way "a played hand pays exactly what
    // the hand was worth" does for mineiro above.
    // The round id, not the match id: switching to gaúcho respun the seed
    // into a fresh epoch (ir decision-12), so mineiro's own hand 1 is still
    // sitting in the store under the same match_id — filtering on that alone
    // would find two "hand 1" rows, one per epoch.
    // Gaúcho climbs the river's four rungs, and a hand nobody raised settles
    // on 1 whichever ladder it is — so this plays on until a raise is actually
    // taken, where the two ladders finally disagree.
    //
    // The round id, not the match id: switching respun the seed into a fresh
    // epoch (ir decision-12), so the previous variant's own hand 1 is still in
    // the store under the same match_id.
    const RUNGS = [1, 2, 3, 4];
    let priced = 0;
    for (let handNo = 0; handNo < 40 && priced === 0; handNo++) {
      if (sitting(m).status !== "playing") break;
      const roundId = hand(m).id;
      await playOut(m);
      const scored = only(m.rows("round").filter((r) => r.id === roundId), "the hand just played");
      assertTurnUp(m);
      const accepts = m.rows("play")
        .filter((p) => p.round_id === scored.id && p.kind === "accept").length;
      const worth = RUNGS[accepts];
      assert(worth !== undefined, `${accepts} accepted raises is off the river's ladder`);
      assert(
        Number(scored.stake) === worth,
        `${accepts} accepted raises under gaúcho settle on ${worth}, and the round carries ${scored.stake}`,
      );
      if (accepts > 0) priced++;
    }
    assert(priced > 0, "forty hands of gaúcho and not one raise was ever taken");
    await m.stop();
  },
});

Deno.test({
  name: "the arena resolves localized messages across Brazil and the three Spanish-speaking countries",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const mPt = await table();
    await mPt.settle();
    assert(mPt.one("#btn-truco").textContent?.trim() === "TRUCO!", "pt: btn-truco");
    assert(mPt.one("#btn-next").textContent?.trim() === "Próxima mão", "pt: btn-next");
    assert(mPt.one("#btn-accept b").textContent?.trim() === "Aceito", "pt: btn-accept");
    assert(mPt.one("#btn-raise b").textContent?.trim() === "Aumentar", "pt: btn-raise");
    assert(mPt.one("#btn-run b").textContent?.trim() === "Corro", "pt: btn-run");
    assert(mPt.one(".score.us .sect").textContent?.trim() === "Nós", "pt: score us");
    assert(mPt.one(".who b").textContent?.trim() === "Você", "pt: you");
    assert(mPt.one(".who .sect").textContent?.trim() === "Truqueiro nato · convidado", "pt: player subtitle");

    // Every truco-playing country's own address, composed from data-route +
    // data-locale (fragment.js routeHref) — a real link on every render, not
    // only the one the reader happens to be on.
    const countryHref = (m: Mounted, tag: string) =>
      m.one(`[data-picker="country"] a[data-locale="${tag}"]`).getAttribute("href");
    assert(countryHref(mPt, "pt-BR") === "/", "pt-BR carries no prefix, it is the default");
    assert(countryHref(mPt, "es-AR") === "/ar", "Argentina's address");
    assert(countryHref(mPt, "es-UY") === "/uy", "Uruguay's address");
    assert(countryHref(mPt, "es-PY") === "/py", "Paraguay's address");
    assert(countryHref(mPt, "ca-ES") === "/ca", "Spain's address, in the language its truc is played in");

    // A country's own name never translates — the same endonym in every
    // catalogue, on purpose (messages/*.json) — so the row reads identically
    // from any locale. A flag and that name are the whole row: what each
    // country plays is the variant picker's to name, and naming it twice is
    // what this menu is deliberately not doing.
    assert(
      mPt.one('[data-picker="country"] a[data-locale="es-AR"] span').textContent?.trim() === "Argentina",
      "a country's name is its own, read from any locale",
    );
    assert(
      mPt.one('[data-picker="country"] a[data-locale="es-AR"]').textContent?.trim() === "🇦🇷 Argentina",
      "the country row carries a flag and a country, nothing the variant picker already says",
    );

    // Updating match.locale in-flight re-evaluates message bindings across
    // child regions without a screen remount.
    const s = sitting(mPt);
    await mPt.store.update("match", String(s.id), { locale: "es-AR" });
    await mPt.settle();
    assert(mPt.one(".score.us .sect").textContent?.trim() === "Nosotros", "dynamic es-AR: score us");
    assert(mPt.one("#btn-truco").textContent?.trim() === "¡TRUCO!", "dynamic es-AR: btn-truco");
    assert(mPt.one("#btn-accept b").textContent?.trim() === "Quiero", "dynamic es-AR: btn-accept");
    assert(mPt.one("#btn-run b").textContent?.trim() === "Me voy al mazo", "dynamic es-AR: btn-run");
    await mPt.stop();

    // The three Spanish countries agree on the game's own jargon — it is one
    // Río de la Plata truco vocabulary — and diverge on the vocabulary this
    // app actually carries prose in: the subtitle under the reader's seat.
    for (
      const [tag, subtitle] of [
        ["es-AR", "Truquero de ley, che · invitado"],
        ["es-UY", "Truquero de ley, bo · invitado"],
        ["es-PY", "Truquero de ley voi' · invitado"],
      ] as const
    ) {
      const m = await table({ locale: tag });
      await m.settle();
      assert(m.one("#btn-truco").textContent?.trim() === "¡TRUCO!", `${tag}: btn-truco`);
      assert(m.one("#btn-next").textContent?.trim() === "Próxima mano", `${tag}: btn-next`);
      assert(m.one("#btn-accept b").textContent?.trim() === "Quiero", `${tag}: btn-accept`);
      assert(m.one("#btn-raise b").textContent?.trim() === "Retruco", `${tag}: btn-raise`);
      assert(m.one("#btn-run b").textContent?.trim() === "Me voy al mazo", `${tag}: btn-run`);
      assert(m.one(".score.us .sect").textContent?.trim() === "Nosotros", `${tag}: score us`);
      assert(m.one(".rules-link").textContent?.trim() === "Reglas", `${tag}: rules`);
      assert(m.one(".who b").textContent?.trim() === "Vos", `${tag}: you (voseo, shared by all three)`);
      assert(m.one(".who .sect").textContent?.trim() === subtitle, `${tag}: player subtitle is this country's own`);
      await m.stop();
    }

    // Spain deals truc, and truc is played in Catalan.
    const mCa = await table({ locale: "ca-ES" });
    await mCa.settle();
    assert(mCa.one("#btn-truco").textContent?.trim() === "TRUC!", "ca-ES: btn-truco");
    assert(mCa.one("#btn-accept b").textContent?.trim() === "Vull", "ca-ES: btn-accept");
    assert(mCa.one("#btn-run b").textContent?.trim() === "Me'n vaig", "ca-ES: btn-run");
    assert(mCa.one(".score.us .sect").textContent?.trim() === "Nosaltres", "ca-ES: score us");
    assert(mCa.one(".rules-link").textContent?.trim() === "Regles", "ca-ES: rules");
    assert(mCa.one(".who b").textContent?.trim() === "Tu", "ca-ES: you");
    await mCa.stop();
  },
});

// The rules screen draws a ladder per family and the stylesheet removes the
// ones not in force, with paulista's showing until a rule names a variant
// outside its family. A variant dealt without a ladder of its own therefore
// reads as paulista's — the wrong rungs under its own name, which is the one
// thing the variants exist to keep apart. Nothing computes CSS here, so what
// is held is the weaker and still sufficient claim: every ladder the dealer
// prices is drawn somewhere on that page.
Deno.test({
  name: "every ladder the dealer prices is drawn on the rules screen",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const handler = await Deno.readTextFile(new URL("shell/handlers/table.js", APP));
    const decl = handler.match(/const PRICE = \{([\s\S]*?)\n  \};/);
    if (!decl) throw new Error("shell/handlers/table.js declares no PRICE table");
    const priced = new Map<string, string>();
    for (const [, name, rungs] of decl[1].matchAll(/(\w+):\s*\{[^}]*?rungs:\s*\[([^\]]*)\]/g)) {
      priced.set(name, rungs.split(",").map((r) => r.trim()).join(" "));
    }
    assert(priced.size > 0, "the dealer's PRICE table parsed to no ladders at all");

    const rules = await Deno.readTextFile(new URL("shell/screens/regras.html", APP));
    const drawn = new Map<string, string[]>();
    for (const [, family, rung] of rules.matchAll(/<li data-v="(\w+)"[^>]*><b>(\d+)<\/b>/g)) {
      drawn.set(family, [...(drawn.get(family) ?? []), rung]);
    }
    const ladders = new Set([...drawn.values()].map((l) => l.join(" ")));
    for (const [variant, rungs] of priced) {
      assert(
        ladders.has(rungs),
        `the dealer climbs ${variant} on ${rungs} and no ladder on the rules screen says so`,
      );
    }
  },
});

// The one fact the variant menu says that the dealer also knows, spelled
// twice: PRICE is a closure-local const inside table.js's handler, unreachable
// from CUE and from the screen, so arena.cue's _goal table says it again for
// the menu. This test is what keeps the two spellings one fact — it reads the
// dealer's own table out of the handler and holds the menu to it.
Deno.test({
  name: "the goal each variant shows in the menu is the goal the dealer plays it to",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const handler = await Deno.readTextFile(new URL("shell/handlers/table.js", APP));
    const decl = handler.match(/const PRICE = \{([\s\S]*?)\n  \};/);
    if (!decl) throw new Error("shell/handlers/table.js declares no PRICE table for the menu to agree with");
    // A goal is two numbers, one per kind of table, and the menu says both
    // when they differ — anchored to the entry's own indent so the envido's
    // nested ladder is not read as a variant of its own.
    const goal = new Map<string, string>();
    for (const [, name, solo, pairs] of decl[1].matchAll(
      /^ {4}(\w+): \{[\s\S]*?goal: \{solo: (\d+), pairs: (\d+)\}/gm,
    )) {
      goal.set(name, solo === pairs ? pairs : `${solo}/${pairs}`);
    }
    if (goal.size === 0) throw new Error("the dealer's PRICE table parsed to no variants at all");

    const m = await table();
    await m.settle();

    const rows = m.all('[data-picker="variant"] li[data-group] button[data-opt]');
    assert(rows.length === goal.size, `${rows.length} variants in the menu, ${goal.size} in the dealer's table`);
    // The goal is words inside each variant's own menu label, so every
    // catalogue says it, and each has to say the dealer's numbers.
    const catalogues = ["pt-BR", "es-AR", "es-UY", "es-PY", "ca-ES"];
    for (const row of rows) {
      const name = String(row.getAttribute("data-opt"));
      const dealt = goal.get(name);
      if (dealt === undefined) throw new Error(`the menu offers "${name}", a variant the dealer's PRICE does not price`);
      assert(textOf(row).includes(dealt.split("/")[0]), `the menu row for ${name} reads "${textOf(row)}", with no goal`);
      for (const loc of catalogues) {
        const cat = JSON.parse(await Deno.readTextFile(new URL(`messages/${loc}.json`, APP)));
        const label = String(cat[`variant_${name}_item`] ?? "");
        const said = (label.match(/\d+/g) ?? []).join("/");
        assert(said === dealt, `${loc} names ${name} "${label}", which plays to ${said || "nothing"}, and the dealer plays it to ${dealt}`);
      }
    }

    // Grouping is the menu's other new claim: every variant is filed under the
    // country that plays it, every country the app speaks for has a heading to
    // file it under, and one more heading holds the rest. Which group rides at
    // the top is `order` off the screen's own data-locale, which is a
    // stylesheet's answer and belongs to the browser tier; what is held here is
    // that the hooks the stylesheet reaches for are all there.
    for (const head of ["rest", "br", "ar", "uy", "py", "es"]) {
      m.one(`[data-picker="variant"] .picker-head[data-head="${head}"]`);
    }
    const listRows = m.all('[data-picker="variant"] .picker-list > li');
    assert(
      listRows.length === rows.length + 6,
      `${listRows.length} rows in the variant menu, not ${rows.length} variants under six headings`,
    );

    // The locale the grouping keys on is written on the same element the rules
    // are scoped to, and it follows the match in flight.
    assert(m.screen.getAttribute("data-locale") === "pt-BR", "the screen does not carry the locale the CSS groups by");
    await m.store.update("match", String(sitting(m).id), { locale: "es-AR" });
    await m.settle();
    assert(m.screen.getAttribute("data-locale") === "es-AR", "the grouping hook did not follow the match's locale");
    await m.stop();
  },
});

// What accepting a call costs, which the dealer used to write out of its own
// three-language table as "vale 4" — a number carrying no noun in any of them.
// It is a catalogue key now and the arm the count selects is the terminal's
// arithmetic, so the noun agrees with the number in each language.
//
// No case reads the `one` arm: no ladder truco plays asks for a single point,
// and one against other is pinned where the count is the test's own,
// plugins/omnishell/test/message-arms.test.ts. What this tier holds is that
// the count is the ROW's — the price is asserted against the rung the hand
// actually stands at, which is what a typo in the selector's column name would
// break and the storybook could not, since its fixture answers whatever
// column the attribute names.
//
// The default language is asked for by asking for nothing.
for (
  const [params, priced] of [
    [{}, (n: number) => `vale ${n} pontos`],
    [{ locale: "es-AR" }, (n: number) => `vale ${n} puntos`],
    [{ locale: "es-UY" }, (n: number) => `vale ${n} puntos`],
    [{ locale: "es-PY" }, (n: number) => `vale ${n} puntos`],
  ] as [Record<string, string>, (n: number) => string][]
) {
  Deno.test({
    name: `what accepting costs is priced as a plural of [${params.locale ?? "pt-BR"}]`,
    sanitizeOps: false,
    sanitizeResources: false,
    async fn() {
      const m = await table(params);
      await m.settle();
      const rung = Number(hand(m).rung);
      assert(rung > 1, `the ladder stands at ${rung}, where the plural arm is not the one under test`);
      const price = m.one("#btn-accept small").textContent?.trim();
      assert(price === priced(rung), `the hand asks for ${rung}: ${price}`);
      await m.stop();
    },
  });
}

Deno.test({
  name: "a played card records its slot index to preserve spatial habits across the table",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();
    const cards = playable(m);
    assert(cards.length === 3, `hand opened with ${cards.length} cards`);
    const mid = cards[1];
    const cardName = mid.getAttribute("data-card");
    m.fire(mid);
    await m.settle();
    const plays = m.rows("play").filter((p) => p.kind === "card" && p.seat === "you");
    assert(plays.length === 1, `expected 1 played card by you, found ${plays.length}`);
    assert(plays[0].from_slot === "1", `expected from_slot '1', found ${plays[0].from_slot}`);
    assert(plays[0].card === cardName, `played card ${plays[0].card} matched clicked ${cardName}`);
    await m.stop();
  },
});

Deno.test({
  name: "switching mode to online creates a multiplayer match without bot auto-play",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();
    const opts = m.byRole("option", "Mesa Online");
    assert(opts.length === 1, `expected 1 Mesa Online option, got ${opts.length}`);
    m.fire(opts[0]);
    await m.settle();
    const match = sitting(m);
    assert(match.opponent === "online", `expected opponent 'online', got ${match.opponent}`);
    // The column carries a message key, not a sentence: a bot's name is app
    // copy and every country reads it in its own language, while a real
    // player's handle passes the same binding unmatched and stays a handle.
    assert(
      match.opponent_name === "opponent_online",
      `expected opponent_name 'opponent_online', got ${match.opponent_name}`,
    );
    await m.stop();
  },
});

Deno.test({
  name: "online match dispatches opponent move when btn-bot-play fires with specific card",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();
    const opts = m.byRole("option", "Mesa Online");
    m.fire(opts[0]);
    await m.settle();

    const cards = playable(m);
    assert(cards.length === 3, `hand opened with ${cards.length} cards`);
    m.fire(cards[0]);
    await m.settle();

    const round = hand(m);
    assert(round.turn_seat === "eles1", `expected turn_seat 'eles1', got ${round.turn_seat}`);

    const elesHeld = m.rows("held").filter((h) => h.seat === "eles1" && h.current === "yes");
    assert(elesHeld.length === 3, `expected 3 held cards for eles1, got ${elesHeld.length}`);
    const cardToPlay = elesHeld[0].card;

    m.fire("#btn-bot-play", "click", { detail: { card: cardToPlay } });
    await m.settle();

    const plays = m.rows("play").filter((p) => p.kind === "card" && p.seat === "eles1");
    assert(plays.length === 1, `expected 1 card played by eles1, got ${plays.length}`);
    assert(plays[0].card === cardToPlay, `expected played card to be ${cardToPlay}, got ${plays[0].card}`);
    await m.stop();
  },
});

Deno.test({
  name: "setting seat to eles1 unblocks player 2 cards when turn is eles1",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();
    const opts = m.byRole("option", "Mesa Online");
    m.fire(opts[0]);
    await m.settle();

    m.fire("#btn-set-seat", "click", { detail: { seat: "eles1" } });
    await m.settle();

    const match = sitting(m);
    assert(match.my_seat === "eles1", `expected my_seat 'eles1', got ${match.my_seat}`);

    let elesHeld = m.rows("held").filter((h) => h.seat === "eles1" && h.current === "yes");
    assert(elesHeld.every((h) => h.blocked === "disabled"), "eles1 cards should be disabled while turn is you");

    const youHeld = m.rows("held").filter((h) => h.seat === "you" && h.current === "yes");
    m.fire("#btn-bot-play", "click", { detail: { card: youHeld[0].card } });
    await m.settle();

    const round = hand(m);
    assert(round.turn_seat === "eles1", `expected turn_seat 'eles1', got ${round.turn_seat}`);

    elesHeld = m.rows("held").filter((h) => h.seat === "eles1" && h.current === "yes");
    assert(elesHeld.every((h) => h.display_seat === "you"), "eles1 cards should have display_seat you");
    assert(elesHeld.some((h) => h.blocked === ""), "eles1 cards should be enabled when turn is eles1");

    const p2Cards = playable(m);
    assert(p2Cards.length === 3, `expected 3 playable cards in DOM for player 2 (eles1), got ${p2Cards.length}`);

    const cardToPlay = p2Cards[0].getAttribute("data-card");
    m.fire(p2Cards[0]);
    await m.settle();

    const p2Plays = m.rows("play").filter((p) => p.kind === "card" && p.seat === "eles1");
    assert(p2Plays.length === 1, `expected 1 card played by eles1, got ${p2Plays.length}`);
    assert(p2Plays[0].card === cardToPlay, `played card ${p2Plays[0].card} matches ${cardToPlay}`);
    await m.stop();
  },
});

Deno.test({
  name: "online match allows opponent to accept truco via btn-bot-accept",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();
    const opts = m.byRole("option", "Mesa Online");
    m.fire(opts[0]);
    await m.settle();

    m.fire("#btn-truco");
    await m.settle();

    let round = hand(m);
    assert(round.asked === "you", `expected asked 'you', got ${round.asked}`);

    m.fire("#btn-bot-accept", "click");
    await m.settle();

    round = hand(m);
    assert(round.asked === "", `expected asked to be cleared, got ${round.asked}`);
    assert(Number(round.stake) === 4, `expected stake to be 4 after mineiro truco accept, got ${round.stake}`);

    const accepts = m.rows("play").filter((p) => p.kind === "accept" && p.seat === "eles1");
    assert(accepts.length === 1, `expected 1 accept row by eles1, got ${accepts.length}`);
    await m.stop();
  },
});

Deno.test({
  name: "setting seed and seat via btn-set-seat seeds new match with matching deck",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m1 = await table();
    await m1.settle();

    const m2 = await table();
    await m2.settle();

    m1.fire("#btn-set-seat", "click", { detail: { seat: "you", seed: "379333", opponent: "online" } });
    await m1.settle();

    m2.fire("#btn-set-seat", "click", { detail: { seat: "eles1", seed: "379333", opponent: "online" } });
    await m2.settle();

    const match1 = sitting(m1);
    const match2 = sitting(m2);

    assert(match1.seed === "379333", `expected match1 seed 379333, got ${match1.seed}`);
    assert(match2.seed === "379333", `expected match2 seed 379333, got ${match2.seed}`);
    assert(match1.opponent === "online", `expected match1 opponent online, got ${match1.opponent}`);
    assert(match2.opponent === "online", `expected match2 opponent online, got ${match2.opponent}`);
    assert(match1.my_seat === "you", `expected match1 my_seat you, got ${match1.my_seat}`);
    assert(match2.my_seat === "eles1", `expected match2 my_seat eles1, got ${match2.my_seat}`);

    const held1You = m1.rows("held").filter((h) => h.seat === "you" && h.current === "yes").sort((a, b) => Number(a.slot) - Number(b.slot));
    const held2You = m2.rows("held").filter((h) => h.seat === "you" && h.current === "yes").sort((a, b) => Number(a.slot) - Number(b.slot));
    const held1Eles = m1.rows("held").filter((h) => h.seat === "eles1" && h.current === "yes").sort((a, b) => Number(a.slot) - Number(b.slot));
    const held2Eles = m2.rows("held").filter((h) => h.seat === "eles1" && h.current === "yes").sort((a, b) => Number(a.slot) - Number(b.slot));

    assert(held1You.length === 3 && held2You.length === 3, "both should have 3 cards for you");
    for (let i = 0; i < 3; i++) {
      assert(held1You[i].card === held2You[i].card, `cards at slot ${i} for you must match! Table1=${held1You[i].card}, Table2=${held2You[i].card}`);
      assert(held1Eles[i].card === held2Eles[i].card, `cards at slot ${i} for eles1 must match! Table1=${held1Eles[i].card}, Table2=${held2Eles[i].card}`);
    }

    await m1.stop();
    await m2.stop();
  },
});

Deno.test({
  name: "online match allows player 2 (eles1) to receive truco via btn-bot-truco and accept via btn-accept",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();

    m.fire("#btn-set-seat", "click", { detail: { seat: "eles1", seed: "987654", opponent: "online" } });
    await m.settle();

    m.fire("#btn-bot-truco", "click");
    await m.settle();

    let round = hand(m);
    assert(round.asked === "you", `expected asked 'you', got ${round.asked}`);

    m.fire("#btn-accept", "click");
    await m.settle();

    round = hand(m);
    assert(round.asked === "", `expected asked to be cleared, got ${round.asked}`);
    assert(Number(round.stake) === 4, `expected stake to be 4 after accept, got ${round.stake}`);

    const accepts = m.rows("play").filter((p) => p.kind === "accept" && p.seat === "eles1");
    assert(accepts.length === 1, `expected 1 accept row by eles1, got ${accepts.length}`);
    await m.stop();
  },
});

Deno.test({
  name: "online match allows player 2 (eles1) to counter-raise (Seis!) via btn-raise",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();

    m.fire("#btn-set-seat", "click", { detail: { seat: "eles1", seed: "987654", opponent: "online" } });
    await m.settle();

    m.fire("#btn-bot-truco", "click");
    await m.settle();

    let round = hand(m);
    assert(round.asked === "you", `expected asked 'you', got ${round.asked}`);

    m.fire("#btn-raise", "click");
    await m.settle();

    round = hand(m);
    assert(round.asked === "eles1", `expected asked 'eles1' after counter-raise, got ${round.asked}`);
    assert(Number(round.stake) === 4, `expected stake 4, got ${round.stake}`);
    assert(Number(round.rung) === 8, `expected next rung 8, got ${round.rung}`);

    const raises = m.rows("room_action").filter((a) => a.action === "truco" && a.player_id === "eles1");
    assert(raises.length === 1, `expected 1 truco room_action by eles1, got ${raises.length}`);
    assert(Number(raises[0].slot) === 8, `expected slot 8 in room_action, got ${raises[0].slot}`);

    await m.stop();
  },
});

Deno.test({
  name: "btn-bot-play never plays or deducts cards from local seat even if fired on my turn",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();

    const opts = m.byRole("option", "Mesa Online");
    m.fire(opts[0]);
    await m.settle();

    let round = hand(m);
    assert(round.turn_seat === "you", `expected turn_seat you, got ${round.turn_seat}`);
    // The column names the message; what language it is read in is the
    // screen's to decide, so the regression this guards is the turn, not a
    // Portuguese sentence.
    assert(round.said === "lead_your_turn", `expected the lead's opening key, got ${round.said}`);

    m.fire("#btn-bot-play", "click", { detail: { slot: 0 } });
    await m.settle();

    const myHeld = m.rows("held").filter((h) => h.seat === "you" && h.current === "yes");
    assert(myHeld.length === 3, `expected 3 held cards for you, got ${myHeld.length}`);

    const cards = playable(m);
    assert(cards.length === 3, `expected 3 playable cards, got ${cards.length}`);
    m.fire(cards[0]);
    await m.settle();

    round = hand(m);
    assert(round.turn_seat === "eles1", `expected turn_seat eles1, got ${round.turn_seat}`);
    assert(round.said === "opponent_turn", `expected the opponent's-turn key, got '${round.said}'`);

    await m.stop();
  },
});

Deno.test({
  name: "table fold demotes finished match to current 'no' when starting a new match",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();

    const curr = sitting(m);
    await m.store.update("match", curr.id, { status: "over", winner: "us", us_score: "12" });
    await m.settle();

    m.fire("#btn-again");
    await m.settle();

    const oldMatch = m.rows("match").find((r) => r.id === curr.id);
    assert(oldMatch?.current === "no", `expected finished match to be demoted to current: no, got ${oldMatch?.current}`);

    const newMatches = m.rows("match").filter((r) => r.current === "yes");
    assert(newMatches.length === 1, `expected exactly 1 active match with current: yes, got ${newMatches.length}`);
    await m.stop();
  },
});

Deno.test({
  name: "btn-again defaults opponent to nezinho when restarting an online match offline",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();

    const opts = m.byRole("option", "Mesa Online");
    m.fire(opts[0]);
    await m.settle();

    let curr = sitting(m);
    assert(curr.opponent === "online", `expected opponent online, got ${curr.opponent}`);

    await m.store.update("match", curr.id, { status: "over", winner: "us", us_score: "12" });
    await m.settle();

    m.fire("#btn-again");
    await m.settle();

    curr = sitting(m);
    assert(curr.opponent === "nezinho", `expected restarted match to default to nezinho bot, got ${curr.opponent}`);
    assert(curr.status === "playing", `expected status playing, got ${curr.status}`);
    await m.stop();
  },
});

Deno.test({
  name: "conceding hands over the table's own goal, not twelve",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // A concession ends the match by handing the other side the race, and the
    // race is not the same length everywhere: twelve in Brazil, thirty across
    // the river, and two voltas at gaúcho. A winner left short of the goal is
    // a match ended on a score nobody could have played to.
    for (const [option, variant, goal] of [
      ["Truco Argentino", "argentino", 30],
      ["Truco Gaúcho", "gaucho", 18],
      ["Truco Paulista", "paulista", 12],
    ] as Array<[string, string, number]>) {
      const m = await table();
      await m.settle();
      m.fire(variantOption(m, option));
      await m.settle();
      assert(sitting(m).variant === variant, `the picker did not take: ${sitting(m).variant}`);

      m.fire("#btn-resign");
      await m.settle();

      const done = sitting(m);
      assert(done.status === "over", `conceding left ${variant} ${done.status}`);
      assert(done.winner === "them", `conceding handed the match to "${done.winner}"`);
      assert(
        Number(done.them_score) === goal,
        `conceding ${variant} paid ${done.them_score}, and it plays to ${goal}`,
      );
      await m.stop();
    }
  },
});

Deno.test({
  name: "btn-resign forfeits active match, awards win to opponent, and sets status to over",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();

    let curr = sitting(m);
    assert(curr.status === "playing", `expected playing match, got ${curr.status}`);

    m.fire("#btn-resign");
    await m.settle();

    const matches = m.rows("match");
    const overMatch = matches.find((r) => r.id === curr.id);
    assert(overMatch !== undefined, "match row not found");
    assert(overMatch.status === "over", `expected status over, got ${overMatch.status}`);
    assert(overMatch.winner === "them", `expected winner them, got ${overMatch.winner}`);
    assert(overMatch.them_score === "12", `expected them_score 12, got ${overMatch.them_score}`);

    const round = hand(m);
    assert(round.said === "Você abandonou a partida.", `expected resignation said line, got ${round.said}`);
    assert(round.result === "them", `expected round result them, got ${round.result}`);
    await m.stop();
  },
});

Deno.test({
  name: "btn-resign in online match emits room_action with action resign",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();

    const opts = m.byRole("option", "Mesa Online");
    m.fire(opts[0]);
    await m.settle();

    const curr = sitting(m);
    assert(curr.opponent === "online", `expected online opponent, got ${curr.opponent}`);

    m.fire("#btn-resign");
    await m.settle();

    const actions = m.rows("room_action");
    const resignAction = actions.find((a) => a.action === "resign" && String(a.room_seed) === String(curr.seed));
    assert(resignAction !== undefined, "expected room_action with action resign to be emitted");
    assert(resignAction.player_id === (curr.my_seat || "you"), `expected player_id ${curr.my_seat || "you"}, got ${resignAction.player_id}`);
    await m.stop();
  },
});

Deno.test({
  name: "remote resign action in online match concludes match with win for local player",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();

    const opts = m.byRole("option", "Mesa Online");
    m.fire(opts[0]);
    await m.settle();

    const curr = sitting(m);
    assert(curr.opponent === "online", `expected online opponent, got ${curr.opponent}`);

    await m.store.put("room_action", {
      id: `${curr.seed}/resign/eles1`,
      room_seed: String(curr.seed),
      player_id: "eles1",
      action: "resign",
      card: "",
      slot: 0,
    });
    await m.settle();

    const overMatch = m.rows("match").find((r) => r.id === curr.id);
    assert(overMatch !== undefined, "match row not found");
    assert(overMatch.status === "over", `expected status over, got ${overMatch?.status}`);
    assert(overMatch.winner === "us", `expected winner us, got ${overMatch?.winner}`);
    assert(overMatch.us_score === "12", `expected us_score 12, got ${overMatch?.us_score}`);

    const round = hand(m);
    assert(round.said === "resigned_them", `expected the opponent's resign key, got ${round.said}`);
    await m.stop();
  },
});



/** A hand you lead, dealt at a given score. A brink is read off the score the
 * hand is dealt at, and reaching ten by play is a long wait, so the score is
 * written onto the sitting and the hand number moved past the one standing —
 * which the dealer takes as a hand it has not dealt yet. Two past, because the
 * mão rotates with the hand and at two seats every other one is yours. */
async function dealAt(m: Mounted, variant: string, us: number, them: number) {
  await m.settle();
  if (variant !== "Truco Mineiro") {
    m.fire(variantOption(m, variant));
    await m.settle();
  }
  const s = sitting(m);
  await m.store.update("match", s.id, {
    us_score: String(us), them_score: String(them), hand_no: String(Number(s.hand_no) + 2),
  });
  await m.settle();
  return hand(m);
}

const calls = (m: Mounted) => String(hand(m).envido_calls ?? "").split(" ");
const handLog = (m: Mounted) =>
  m.rows("play").filter((p) => p.round_id === hand(m).id).sort((a, b) => String(a.seq).localeCompare(String(b.seq)));

Deno.test({
  name: "a side on ten decides the mão de dez before any card, and nobody may call truco in it",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    const round = await dealAt(m, "Truco Mineiro", 10, 0);
    assert(round.brink === "us", `a hand dealt at 10-0 is a brink for "${round.brink}"`);
    assert(round.leader === "you", `the hand is led by ${round.leader}, so a card could not be yours to lay`);
    assert(calls(m).includes("brink"), `the decision is not offered: "${round.envido_calls}"`);
    assert(Number(round.rung) === 0, `a brink hand offers the rung ${round.rung}`);
    assert(playable(m).length === 0, `${playable(m).length} cards may be laid before the decision`);
    m.fire(m.all(".seat-row.mine .card")[0]);
    await m.settle();
    assert(handLog(m).length === 0, "the house laid a card while the decision was yours");

    m.fire(m.one("#btn-truco"));
    await m.settle();
    assert(!handLog(m).some((p) => p.kind === "truco"), "a truco was called in a brink hand");

    const id = sitting(m).id;
    m.fire(m.one("#btn-brink-play"));
    await m.settle();
    assert(Number(hand(m).stake) === 4, `a mão de dez played is worth ${hand(m).stake}, not 4`);
    assert(!calls(m).includes("brink"), "the decision is still offered once made");
    await playOut(m);

    // Won, it carries the side from ten to the goal; lost, the other side is
    // paid the four.
    const done = only(m.rows("match").filter((r) => r.id === id), "the sitting");
    const paid = done.winner === "us"
      ? Number(done.us_score) === 12
      : Number(done.them_score) === 4 && Number(done.us_score) === 10;
    assert(paid, `the mão de dez paid ${done.us_score}-${done.them_score}`);
    await m.stop();
  },
});

Deno.test({
  name: "running from the mão de dez gives the other side the first rung",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    const round = await dealAt(m, "Truco Mineiro", 10, 6);
    m.fire(m.one("#btn-brink-run"));
    await m.settle();
    const done = sitting(m);
    assert(Number(done.hand_no) === Number(round.hand_no) + 1, "running did not end the hand");
    assert(
      Number(done.us_score) === 10 && Number(done.them_score) === 8,
      `running from 10-6 left ${done.us_score}-${done.them_score}, not 10-8`,
    );
    // Still ten: the next hand is a mão de dez again.
    assert(hand(m).brink === "us", `the hand after a run is a brink for "${hand(m).brink}"`);
    await m.stop();
  },
});

Deno.test({
  name: "paulista's brink is the mão de onze, played for three and run from for one",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    const ten = await dealAt(m, "Truco Paulista", 10, 0);
    assert((ten.brink ?? "") === "", `paulista made a brink of ten: "${ten.brink}"`);

    const s = sitting(m);
    await m.store.update("match", s.id, { us_score: "11", hand_no: String(Number(s.hand_no) + 1) });
    await m.settle();
    assert(hand(m).brink === "us", `a paulista hand at 11 is a brink for "${hand(m).brink}"`);
    m.fire(m.one("#btn-brink-play"));
    await m.settle();
    assert(Number(hand(m).stake) === 3, `a mão de onze played is worth ${hand(m).stake}, not 3`);

    const t = sitting(m);
    await m.store.update("match", t.id, { us_score: "11", them_score: "0", hand_no: String(Number(t.hand_no) + 1) });
    await m.settle();
    m.fire(m.one("#btn-brink-run"));
    await m.settle();
    assert(Number(sitting(m).them_score) === 1, `running from the mão de onze paid ${sitting(m).them_score}, not 1`);
    await m.stop();
  },
});

Deno.test({
  name: "the house on ten decides for itself before it lays a card",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Deal after deal of the fixed seed until the house has both played and
    // run, so each branch is held on a hand that chose it rather than on
    // whichever one a single deal happens to be.
    const seen = new Set<string>();
    for (let deal = 0; deal < 40 && seen.size < 2; deal++) {
      const m = await table();
      await m.settle();
      const s = sitting(m);
      const handNo = String(Number(s.hand_no) + 1 + deal);
      await m.store.update("match", s.id, { them_score: "10", hand_no: handNo });
      // Dealt, and the house still thinking: the decision is its own, so none
      // of it is offered here, and a tap on it is refused.
      await m.quiet();
      assert(!calls(m).includes("brink"), "the house's decision was offered to you");
      m.fire(m.one("#btn-brink-run"));
      await m.settle();
      // Settling drains the table's whole clock, and a house that runs is on
      // the brink again next hand, so the hand judged is the one dealt at
      // 0-10 rather than whichever stands when the clock stops.
      const round = only(m.rows("round").filter((r) => r.match_id === s.id && r.hand_no === handNo), "the brink hand");
      assert(round.brink === "them", `a hand at 0-10 is a brink for "${round.brink}"`);
      const log = m.rows("play").filter((p) => p.round_id === round.id)
        .sort((a, b) => String(a.seq).localeCompare(String(b.seq)));
      const first = log[0];
      assert(first !== undefined, "the house never decided");
      assert(
        first.kind === "brink_play" || first.kind === "run",
        `the house's first move on the brink was a ${first.kind}`,
      );
      assert(first.seat.startsWith("eles"), `the brink was decided by ${first.seat}`);
      seen.add(first.kind);
      if (first.kind === "run") {
        assert(log.length === 1, `the house ran and the hand went on: ${log.map((p) => p.kind)}`);
        assert(Number(round.stake) === 2 && round.result === "us",
          `the house running left a hand worth ${round.stake} won by ${round.result}`);
      } else {
        assert(Number(round.stake) === 4, `the house played the brink for ${round.stake}`);
      }
      await m.stop();
    }
    assert(seen.size === 2, `across forty deals the house only ever chose ${[...seen]}`);
  },
});

Deno.test({
  name: "both sides on ten play the mão de ferro for the first rung, and no truco",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    const round = await dealAt(m, "Truco Mineiro", 10, 10);
    assert(round.brink === "both", `a hand at 10-10 is a brink for "${round.brink}"`);
    assert(!calls(m).includes("brink"), "the mão de ferro asked somebody to decide");
    assert(Number(round.stake) === 2 && Number(round.rung) === 0,
      `the mão de ferro stands at ${round.stake} with rung ${round.rung}`);
    const id = sitting(m).id;
    await playOut(m);
    assert(!handLog(m).some((p) => p.kind === "truco"), "somebody called truco in the mão de ferro");
    const done = only(m.rows("match").filter((r) => r.id === id), "the sitting");
    assert(done.status === "over", "the mão de ferro did not decide the match");
    assert(Math.max(Number(done.us_score), Number(done.them_score)) === 12 &&
      Math.min(Number(done.us_score), Number(done.them_score)) === 10,
      `the mão de ferro ended ${done.us_score}-${done.them_score}`);
    await m.stop();
  },
});

Deno.test({
  name: "the brink is not dealt across a room",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // The side on the brink decides, and across a room that side may be a
    // person the house would be deciding for.
    const m = await table();
    await m.settle();
    m.fire(m.byRole("option", "Mesa Online")[0]);
    await m.settle();
    assert(sitting(m).opponent === "online", `the table is still against ${sitting(m).opponent}`);
    const round = await dealAt(m, "Truco Mineiro", 0, 10);
    assert((round.brink ?? "") === "", `an online table dealt a brink for "${round.brink}"`);
    assert(Number(round.rung) !== 0, "an online hand at 0-10 has no ladder to climb");
    await m.stop();
  },
});

Deno.test({
  name: "mineiro at three pairs deals no brink",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // The pickers no longer seat mineiro at three pairs, but a sitting kept
    // on the device from before they stopped can hold one, and the dealer
    // deals whatever it is handed. The brink is written for two sides and is
    // dealt at neither a lone third pair on ten nor two pairs there.
    const m = await table();
    await m.settle();
    await m.store.update("match", sitting(m).id, { seats: "2v2v2", hand_no: String(Number(sitting(m).hand_no) + 1) });
    await m.settle();
    assert(sitting(m).seats === "2v2v2" && sitting(m).variant === "mineiro",
      `the table is ${sitting(m).variant} at ${sitting(m).seats}`);
    for (const [them, others] of [[0, 10], [10, 10]]) {
      const s = sitting(m);
      await m.store.update("match", s.id, {
        us_score: "0", them_score: String(them), others_score: String(others),
        hand_no: String(Number(s.hand_no) + 1),
      });
      await m.quiet();
      const round = hand(m);
      assert((round.brink ?? "") === "", `three pairs at 0-${them}-${others} dealt a brink for "${round.brink}"`);
      await m.settle();
    }
    await m.stop();
  },
});

Deno.test({
  name: "a table without a brink deals ten like any other score",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    const round = await dealAt(m, "Truco Argentino", 29, 0);
    assert((round.brink ?? "") === "", `the river's table dealt a brink for "${round.brink}"`);
    await m.stop();
  },
});

Deno.test({
  name: "at three pairs a pair that runs throws its cards in, and the others keep theirs",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // A run at three pairs leaves the hand to the two still in it. The pair
    // that ran has no turn left, so its cards come off the table; the felt
    // draws what is current, and a hand left standing there reads as a pair
    // still playing.
    const m = await table();
    await m.settle();
    m.fire(variantOption(m, "Douradinha"));
    await m.settle();
    let seen = false;
    for (let dealt = 0; dealt < 80 && !seen; dealt++) {
      // A finished match waits to be asked for another, and the next one
      // opens under the same rules.
      if (sitting(m).status !== "playing") {
        m.fire(m.one("#btn-again"));
        await m.settle();
      }
      const round = hand(m);
      if (playable(m).length > 0 && Number(round.rung) !== 0) {
        m.fire(m.one("#btn-truco"));
        await m.settle();
        const log = m.rows("play").filter((p) => p.round_id === round.id);
        const ran = log.filter((p) => p.kind === "run").map((p) => p.seat);
        const still = only(m.rows("round").filter((r) => r.id === round.id), "the hand");
        if (ran.length === 1 && (still.result ?? "") === "") {
          seen = true;
          // Partners sit three seats apart at six.
          const order = ["you", "eles1", "eles2", "parca", "eles3", "eles4"];
          const at = order.indexOf(ran[0]);
          const pair = [ran[0], order[(at + 3) % 6]];
          const held = m.rows("held").filter((h) => h.round_id === round.id && h.current === "yes");
          assert(!held.some((h) => pair.includes(h.seat)), `the pair that ran (${pair}) still holds cards`);
          const others = order.filter((s) => !pair.includes(s) && s !== "you" && s !== "parca");
          assert(others.every((s) => held.some((h) => h.seat === s)),
            `a pair still in the hand lost its cards: ${JSON.stringify(held.map((h) => h.seat))}`);
          break;
        }
      }
      await playOut(m);
    }
    assert(seen, "no pair ran while the hand went on");
    await m.stop();
  },
});

Deno.test({
  name: "a rules change zeroes every pair's score, the third pair's too",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // Both dourado tables seat three pairs, so moving between them keeps the
    // third score on the felt; it has to start the new sitting at nil.
    const m = await table();
    await m.settle();
    m.fire(variantOption(m, "Douradinha"));
    await m.settle();
    const s = sitting(m);
    await m.store.update("match", s.id, { us_score: "4", them_score: "2", others_score: "6" });
    await m.settle();
    m.fire(variantOption(m, "Dourad\u00e3o"));
    await m.settle();
    const after = sitting(m);
    assert(after.variant === "douradao", `the switch left the table at ${after.variant}`);
    assert(after.us_score === "0" && after.them_score === "0" && after.others_score === "0",
      `the new sitting opened at ${after.us_score}-${after.them_score}-${after.others_score}`);
    await m.stop();
  },
});

Deno.test({
  name: "three pairs belong to the dourado tables, and leaving them sits in pairs",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();
    const at = () => `${sitting(m).variant} at ${sitting(m).seats}, stake ${sitting(m).stake}`;
    const pickSeats = async (name: string) => {
      m.fire(m.byRole("option", new RegExp(`^${name}`))[0]);
      await m.settle();
    };

    // A two-sided game picked from a six-seat table sits in pairs.
    m.fire(variantOption(m, "Douradinha"));
    await m.settle();
    assert(sitting(m).seats === "2v2v2", `douradinha seated ${at()}`);
    m.fire(variantOption(m, "Truco Mineiro"));
    await m.settle();
    assert(sitting(m).seats === "2v2", `leaving douradinha left ${at()}`);

    // Any other seating stands.
    await pickSeats("1v1");
    m.fire(variantOption(m, "Truco Paulista"));
    await m.settle();
    assert(sitting(m).seats === "1v1", `paulista reseated a 1v1 table: ${at()}`);

    // Six seats deal a dourado table, at its own opening stake.
    await pickSeats("2v2v2");
    assert(sitting(m).variant === "douradinha" && sitting(m).stake === "2", `three pairs dealt ${at()}`);

    // Fewer seats turn a dourado table back into the game it is built on.
    await pickSeats("2v2");
    assert(sitting(m).variant === "mineiro" && sitting(m).seats === "2v2", `pairs at douradinha dealt ${at()}`);

    // A seats change opens at the standing game's own first rung.
    m.fire(variantOption(m, "Truco Argentino"));
    await m.settle();
    await pickSeats("1v1");
    assert(sitting(m).variant === "argentino" && sitting(m).stake === "1", `reseating argentino opened ${at()}`);
    await m.stop();
  },
});

Deno.test({
  name: "every table's voice has a word for every rung its ladder climbs",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // A call is shouted in the game's voice (arena.cue, VOICE), which the
    // felt's script reads and no harness here runs. A voice short a rung
    // shouts nothing and labels the truco button with nothing, so the voices
    // are held to the dealer's own ladders the way the menu's goals are.
    const handler = await Deno.readTextFile(new URL("shell/handlers/table.js", APP));
    const felt = await Deno.readTextFile(new URL("arena.cue", APP));
    const price = handler.match(/const PRICE = \{([\s\S]*?)\n  \};/)?.[1] ?? "";
    const rungs = new Map<string, number[]>();
    for (const [, name, list] of price.matchAll(/^ {4}(\w+): \{[\s\S]*?rungs: \[([\d, ]+)\]/gm)) {
      rungs.set(name, list.split(",").map((n) => Number(n.trim())));
    }
    const voiceOf = new Map<string, string>(
      [...(felt.match(/const VOICE_OF = \{([\s\S]*?)\};/)?.[1] ?? "").matchAll(/(\w+): "(\w+)"/g)].map(([, v, k]) => [v, k]),
    );
    const voices = felt.match(/const VOICE = \{([\s\S]*?)\n  \};/)?.[1] ?? "";
    const ladder = new Map<string, number[]>();
    for (const [, key, words] of voices.matchAll(/^ {4}(\w+): \{\n\s+ladder: \{([^}]*)\}/gm)) {
      ladder.set(key, [...words.matchAll(/(\d+):/g)].map(([, n]) => Number(n)));
    }
    assert(rungs.size > 0 && ladder.size > 0, `read ${rungs.size} ladders and ${ladder.size} voices`);
    for (const [variant, climb] of rungs) {
      const key = voiceOf.get(variant);
      assert(key !== undefined, `${variant} is dealt with no voice to talk in`);
      const said = ladder.get(key) ?? [];
      for (const rung of climb.slice(1)) {
        assert(said.includes(rung), `the ${key} voice has no word for ${variant}'s ${rung}`);
      }
    }
  },
});

Deno.test({
  name: "a rule picked on a finished match deals the next one under it",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // A finished match waits on the felt with its result until something is
    // asked of it. Picking a game is asking: the next match is dealt under
    // the game picked, from zero, rather than the pick doing nothing.
    const m = await table();
    await m.settle();
    const s = sitting(m);
    await m.store.update("match", s.id, { us_score: "12", them_score: "4", status: "over", winner: "us" });
    await m.settle();
    assert(sitting(m).status === "over", `the finished match reads ${sitting(m).status}`);
    m.fire(variantOption(m, "Truco Argentino"));
    await m.settle();
    const after = sitting(m);
    assert(
      after.variant === "argentino" && after.status === "playing" && after.us_score === "0" && after.them_score === "0",
      `picking a game on a finished match left ${after.variant} ${after.status} at ${after.us_score}-${after.them_score}`,
    );
    assert(hand(m).match_id === after.id && Number(hand(m).hand_no) === 1, "no hand was dealt under the new game");
    await m.stop();
  },
});

Deno.test({
  name: "btn-encobrir arms modo_oculta and playing a card sets power 0 and said encoberta",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();
    const roundBefore = hand(m);
    if (roundBefore.leader === "you") {
      m.fire("#btn-encobrir");
      await m.settle();
      assert(hand(m).said === "modo_oculta", `encobrir should arm modo_oculta, got ${hand(m).said}`);

      const cards = playable(m);
      assert(cards.length > 0, "player has playable cards");
      m.fire(cards[0]);
      await m.settle();

      const plays = m.rows("play").filter((p) => p.kind === "card" && p.seat === "you");
      assert(plays.length === 1, "played card recorded");
      assert(plays[0].power === "0", `encoberta card must have power 0, got ${plays[0].power}`);
      assert(plays[0].said === "encoberta", `encoberta card must have said encoberta, got ${plays[0].said}`);
    }
    await m.stop();
  },
});

Deno.test({
  name: "quick shout triggers shout state and seeded bot dialogue",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const m = await table();
    await m.settle();
    m.fire("#shout-chama");
    await m.settle();
    const r = hand(m);
    assert(r.shout_done === "yes", `shout_done should be yes, got ${r.shout_done}`);
    assert(r.shout_word === "CHAMA!", `shout_word should be CHAMA!, got ${r.shout_word}`);
    assert((r.said ?? "").length > 0, "opponent should have responded with dialogue");
    await m.stop();
  },
});
