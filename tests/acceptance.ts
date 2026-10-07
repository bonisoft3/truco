// The acceptance driver: the brief's checklist walked against the running
// table, in the browser, with the cluster up.
//
// It is declared in program.cue as a build check, so the integrate verb reaches
// it: a check no verb runs does not exist. Each case cites the acceptance id
// it realizes, and the ids are the ones in acceptance.md — a case that cannot
// fail is not a case, so every assertion names a value the table computes
// rather than a value it merely displays.

import { baseUrl } from "omnishell/base-url.ts";

type Case = { id: string; accepts: string[]; run: (p: Page) => Promise<void> };
// deno-lint-ignore no-explicit-any
type Page = any;

const APP = Deno.args[0] ?? ".";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The table's clock is the driver's under ?clock=manual: nothing the table is
// waiting for comes due until this says time has passed. So waiting is not
// sleeping — it is advancing, which costs a round trip rather than a beat, and
// puts every state the table passes through inside the driver's reach instead
// of behind its sampling.
// A hundred at a time, not a beat at a time: the table wears states between
// its beats — the moment the call is not yours because eles are thinking — and
// a driver that jumps a whole beat lands on the far side of them.
// How far the table has been carried, in its own seconds. The table's clock is
// the driver's under ?clock=manual, so how far it gets is decided by how much
// time the driver hands it and never by how fast this machine polls: a wait
// budgeted here passes through the same states on a loaded runner as on an
// idle one, where a wall-clock deadline would simply see fewer of them.
let carried = 0;
const tick = (p: Page, ms = 100) => {
  carried += ms;
  return p.evaluate((n: number) => (globalThis as { __prontoClock?: { advance: (n: number) => number } })
    .__prontoClock?.advance(n) ?? 0, ms).catch(() => 0);
};

/** A budget in the table's own seconds, per `carried`. The wall cap is a
    backstop against a table that has stopped, not the budget. */
function forTable(ms: number) {
  const spent = carried + ms;
  const wall = Date.now() + 240_000;
  return () => carried < spent && Date.now() < wall;
}

/** Poll until the predicate holds; a timeout is a failed case, not a hang.
    `ms` is spent in the table's seconds where its clock is the driver's (per
    `carried`) and in ours where it is not. A held clock runs several table
    seconds to the wall second, so the budget is scaled to keep the wait as
    long as the number reads. */
const HELD = 3;
async function until(p: Page, what: string, ms: number, fn: () => Promise<boolean>) {
  const manual = await p.evaluate(() => "__prontoClock" in globalThis).catch(() => false);
  const wall = Date.now() + (manual ? 240_000 : ms);
  let spent = 0;
  for (;;) {
    if (await fn()) return;
    if ((manual && spent >= ms * HELD) || Date.now() > wall) {
      throw new Error(`timed out waiting for ${what}`);
    }
    spent += 100;
    await tick(p);
    await sleep(20);
  }
}

const assert = (ok: boolean, msg: string) => {
  if (!ok) throw new Error(msg);
};

const count = (p: Page, sel: string) => p.locator(sel).count();
const attr = (p: Page, sel: string, name: string) => p.locator(sel).first().getAttribute(name);
const text = (p: Page, sel: string) => p.locator(sel).first().innerText();

// A rodada's verdict is stated on the round, not on the pile it closed, so
// "closed" is read off the felt's three fields rather than off a marker the
// dealer used to write onto the trick.
const VERDICTS = ["us", "them", "tie"];
const closedTricks = async (p: Page) => {
  const vs = await Promise.all([1, 2, 3].map((n) => attr(p, ".matcards", `data-v${n}`)));
  return vs.filter((v) => VERDICTS.includes(v ?? "")).length;
};
// The cards lying in the rodada still being played.
const openTrickCards = async (p: Page) => {
  const n = (await closedTricks(p)) + 1;
  return n > 3 ? 0 : await count(p, `.trick[data-t="${n}"] .card`);
};

/** The cards in your hand, by identity rather than by what they render as.
    innerText depends on layout having settled — the corners are grids, so an
    unstyled card reads with newlines a styled one does not, and two identical
    deals can compare unequal. `data-card` is the card. */
const hand = (p: Page) =>
  p.locator(".seat-row.mine .card").evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).dataset.card ?? "").join("|")
  );

/** A dealt table with a playable hand — every case starts from one. The store
    is cleared and only then reloaded: the match is device-durable, so without
    the second pass the case sits back down at the table the last one left. */
// The table's own clock, run fast. A reduce asks the terminal to wait in the
// table's seconds and ?tempo= says how many go by in one of ours, so every
// beat, tell and pause between hands is a tenth of what a player sees. The
// waits are shortened, never removed: the window a mutation can land in while
// a chain is waiting is the shape of more than one bug this suite is here to
// catch, and at a tenth of a beat it is still open.
const TEMPO = "clock=manual";

async function resetTable(p: Page) {
  await p.evaluate(() => {
    localStorage.clear();
  }).catch(() => {});
  await sleep(100);
}

async function injectMatch(p: Page, r: any) {
  await p.evaluate((row: any) => {
    localStorage.clear();
    const formatted = {
      ...row,
      us_score: Number(row.us_score),
      them_score: Number(row.them_score),
      stake: Number(row.stake),
      hand_no: Number(row.hand_no),
    };
    localStorage.setItem("mecha:match", JSON.stringify({ [`s:${row.id}`]: { versionKey: "v1", data: formatted } }));
  }, r);
  await sleep(100);
}

/** The door this page came through. A route is a real path, so the origin is
    the whole of what an address is composed against. */
const origin = (p: Page) => new URL(p.url()).origin;

async function freshTable(p: Page, base: string, clock: "fast" | "real" = "fast") {
  await p.goto(`${base}/${clock === "fast" ? `?${TEMPO}` : ""}`, { waitUntil: "domcontentloaded" });
  await resetTable(p);
  await p.reload({ waitUntil: "domcontentloaded" });
  await until(p, "a dealt hand", 20000, async () => {
    if ((await count(p, ".seat-row.mine .card")) !== 3) return false;
    const id = await attr(p, ".matchbox", "data-match-id");
    const roundAttr = await attr(p, "#seat-you .card", "data-round");
    return id !== null && id !== "" && roundAttr !== null && roundAttr.startsWith(id);
  });
}

/** Between screens the way a reader crosses: the link, not the address bar. A
    route link carries `data-route` and the binder composes its href from the
    route table and the page's locale, so the href the link ARRIVED with is
    what the address must become — a driver that typed the path itself would
    be asserting a spelling nobody wrote, in a language it guessed. */
async function cross(p: Page, from: string, to: string, what: string, ms: number, arrived: () => Promise<boolean>) {
  const link = p.locator(`.screen[data-screen=${from}] a[data-route=${to}]`).first();
  const href = await link.getAttribute("href");
  assert(href !== null && href.startsWith("/"), `the ${to} link composes no path: ${href}`);
  await link.click();
  await until(p, what, ms, arrived);
  assert(new URL(p.url()).pathname === href, `clicking ${href} landed on ${p.url()}`);
}

const toRules = (p: Page) =>
  cross(p, "arena", "regras", "the rules screen", 10000, async () => (await count(p, ".ladder li:visible")) >= 4);

const toTable = (p: Page) =>
  cross(p, "regras", "arena", "the table again", 15000, async () => (await count(p, ".seat-row.mine .card")) > 0);

/** Choose an option from one of the bar's pickers, and see it taken. Two
    presses stand between a reader and a choice — the picker opens, the option
    is picked — and everything on this screen is inside a region that
    re-renders on every mutation, so the second can land on a node the first
    one's own render has already replaced. The column the picker writes is
    what says the choice arrived, so the pair is re-tried until it reads. */
async function pick(p: Page, picker: string, opt: string) {
  await until(p, `the table to be ${opt}`, 15000, async () => {
    if ((await attr(p, ".matchbox", `data-${picker}`)) === opt) return true;
    await p.locator(`.picker[data-picker="${picker}"] > button`)
      .click({ timeout: 2000 }).then(() => true, () => false);
    await p.locator(`.picker[data-picker="${picker}"] [data-opt="${opt}"]`)
      .click({ timeout: 2000 }).then(() => true, () => false);
    return (await attr(p, ".matchbox", `data-${picker}`)) === opt;
  });
}

/** Sit down at a stated table. Everything about how a sitting plays out is
    folded from its seed — the shuffle every hand gets, and the opponent, who
    is `CAST_KEYS[seed % 4]` — and whether they call is their persona's
    threshold against the hand they were dealt. So a case that needs a call
    can have one by naming the table rather than by playing until somebody
    obliges, which is a wait on a coin rather than on the table.
    Seed 2 is Tião, who calls on the lowest hand of the four, and calls on the
    first hand of this shuffle. */
async function seatedAt(p: Page, seed: number) {
  await injectMatch(p, {
    id: "mseed", variant: "paulista", seats: "1v1", theme: "xadrez",
    us_score: "0", them_score: "0", stake: "1", hand_no: "1",
    status: "playing", winner: "", opponent: "tiao",
    opponent_name: "Tião Pandeiro", partner_name: "Bigode", seed: String(seed), current: "yes",
  });
  await p.reload({ waitUntil: "domcontentloaded" });
  await until(p, "a dealt hand", 20000, async () => {
    if ((await count(p, ".seat-row.mine .card")) !== 3) return false;
    const id = await attr(p, ".matchbox", "data-match-id");
    const roundAttr = await attr(p, "#seat-you .card", "data-round");
    return id === "mseed" && roundAttr !== null && roundAttr.startsWith("mseed");
  });
}

/** The house may raise before it plays; a driver that ignores a raise is a
    driver that hangs on a table waiting for an answer. */
async function answerIfRaised(p: Page) {
  if ((await attr(p, ".play", "data-phase")) !== "raised") return false;
  // The board can move between reading the phase and reaching the button —
  // eles answer on a beat of their own — so a click that finds nothing to
  // press is the table having moved on, not the table having stopped. Without
  // the cap it waits thirty seconds on a button that is no longer there, which
  // is longer than anything waiting on it.
  const answered = await count(p, '.log li[data-kind=accept][data-seat=you]');
  const pressed = await p.locator("#btn-accept").click({ timeout: 2000 }).then(() => true, () => false);
  if (!pressed) return false;
  // Waited for on the log rather than on the board: "no longer asking" is a
  // state the board passes through and can be back in a beat later, when eles
  // climb again. The row saying you took the bet stays.
  await until(p, "the answer to reach the log", 8000, async () =>
    (await count(p, '.log li[data-kind=accept][data-seat=you]')) > answered);
  return true;
}

/** Play one card, waiting for the turn to actually be yours.
    Eles can call truco between your taps, and a table holding for an answer is
    a table with no playable card — every wait here has to answer first. */
async function playOne(p: Page) {
  // One snapshot per look, taken in the page: these facts have to agree with
  // each other, and read one at a time they are four moments.
  const seen = () =>
    p.evaluate(() => ({
      hand: (document.querySelector(".matchbox") as HTMLElement | null)?.dataset.hand ?? "",
      mine: document.querySelectorAll(".log li[data-kind=card][data-seat=you]").length,
      held: document.querySelectorAll(".seat-row.mine .card").length,
      ready: document.querySelectorAll(".seat-row.mine .card:not([disabled]):not([data-exit])").length,
    }));
  await until(p, "a card of yours to be playable", 25000, async () => {
    await answerIfRaised(p);
    return (await seen()).ready > 0;
  });
  // The press is re-tried, as a picker's is and for the same reason (`pick`);
  // from the hand alone a swallowed click is indistinguishable from a turn
  // that has not come. What says the table saw it is the log row naming your
  // seat, counted within the hand on the felt: the log belongs to the round,
  // so a deal starts the count again.
  const deadline = Date.now() + 20000;
  let at = await seen();
  for (;;) {
    const now = await seen();
    if (now.hand !== at.hand) at = now;
    else if (now.mine > at.mine && now.held < at.held) return;
    // Answered before the hand is read rather than after: a raise disables
    // every card, so nothing playable is as much a table waiting on an answer
    // as a table waiting on the seats before yours.
    await answerIfRaised(p);
    if ((await seen()).ready > 0) {
      await p.locator(".seat-row.mine .card:not([disabled])").first()
        .click({ timeout: 2000 }).then(() => true, () => false);
      const landed = await until(p, "the play to register", 2500, async () => {
        const s = await seen();
        return s.hand === at.hand && s.mine > at.mine && s.held < at.held;
      }).then(() => true, () => false);
      if (landed) return;
    }
    if (Date.now() > deadline) throw new Error("timed out waiting for the card to leave the hand");
    await tick(p);
    await sleep(20);
  }
}

const CASES: Case[] = [
  {
    id: "table is dealt on arrival",
    accepts: ["accept-instant-table", "accept-fresh-shuffle", "accept-profile-bar"],
    run: async (p) => {
      assert((await count(p, ".seat-row.mine .card")) === 3, "you were not dealt three cards");
      // A table turns a card up or fixes its four manilhas in the rules, never
      // both, so the strip that names the turn-up is drawn exactly when there
      // is one. This is the only tier that reads the drawing rather than the
      // attribute it hangs on — the hiding is a stylesheet's answer, and only
      // a browser gives it.
      const strip = p.locator(".handline").first();
      const turned = (await attr(p, ".handline", "data-vira")) ?? "";
      const drawn = await strip.isVisible();
      assert(
        (turned !== "") === drawn,
        `the table turned up "${turned}" and its vira strip is ${drawn ? "drawn" : "hidden"}`,
      );
      if (turned !== "") {
        assert((await text(p, ".vira")).trim().length > 0, "the strip names no turn-up");
      }
      assert((await count(p, ".seatbar .avatar")) === 1, "no seat is shown at the table");
      const first = await hand(p);
      // A second deal from a second shuffle: the odds of an identical
      // three-card hand are ~1 in 10k, so equality here is a broken shuffle.
      // A second SITTING, not a reload — a reload sits back down at the hand it
      // left, which is what the match being device-durable means.
      await freshTable(p, origin(p));
      const second = await hand(p);
      assert(first !== second, `two deals produced the same hand: ${first}`);
    },
  },
  {
    id: "a card leaves the hand and the house answers",
    accepts: ["accept-play-card", "accept-house-answers", "accept-play-log"],
    run: async (p) => {
      await playOne(p);
      await until(p, "both cards on the cloth", 20000, async () => {
        await answerIfRaised(p);
        return (await count(p, ".matcards .card")) >= 2;
      });
      await until(p, "the log to record the plays", 10000, async () => (await count(p, ".log li[data-kind=card]")) >= 2);
      const seats = await p.locator(".log li[data-kind=card]").evaluateAll(
        (els: Element[]) => els.map((e) => (e as HTMLElement).dataset.seat),
      );
      assert(seats.includes("you") && seats.some((s: string) => s.startsWith("eles")), `log is one-sided: ${seats}`);
    },
  },
  {
    id: "the vaza resolves and the spine advances",
    accepts: ["accept-vaza-winner", "accept-phase-tracker"],
    run: async (p) => {
      // Wait for a decided trick rather than for the phase to differ: a hand
      // that ends deals the next one, and "dealt" is a different phase too.
      await playOne(p);
      await until(p, "a decided trick on the spine", 25000, async () => {
        await answerIfRaised(p);
        const marks = await p.locator(".spine > li[data-node^=v]").evaluateAll(
          (els: Element[]) => els.map((e) => (e as HTMLElement).dataset.v ?? ""),
        );
        return marks.some((v: string) => ["us", "them", "tie"].includes(v));
      });
      const phase = await attr(p, ".spine", "data-phase");
      assert(["dealt", "v1", "v2", "v3", "result"].includes(phase!), `phase is not on the spine: ${phase}`);
      const verdicts = await p.locator(".spine > li[data-node^=v]").evaluateAll(
        (els: Element[]) => els.map((e) => (e as HTMLElement).dataset.v ?? ""),
      );
      assert(
        verdicts.some((v: string) => ["us", "them", "tie"].includes(v)),
        `no verdict was recorded: ${verdicts}`,
      );
    },
  },
  {
    id: "a hand plays out and the score moves",
    accepts: ["accept-hand-winner", "accept-next-hand", "accept-match-to-twelve"],
    run: async (p) => {
      const total = async () =>
        Number(await text(p, ".score.us .figure")) + Number(await text(p, ".score.them .figure"));
      // Play whenever a card is playable rather than a fixed number of times:
      // the table alternates seats, a hand can be drawn (no points), and the
      // house can raise mid-hand — so the exit condition is the score, not a
      // count of clicks.
      const playing = forTable(45000);
      let sitting = await attr(p, ".matchbox", "data-match-id");
      let before = await total();
      while (playing()) {
        await answerIfRaised(p);
        const now = await attr(p, ".matchbox", "data-match-id");
        // A stake of twelve is on the ladder, so the hand being measured can
        // be the one that ends the sitting — and the next opens at nothing,
        // which reads as a scoreboard going backwards. The match's own id is
        // what tells that from a score that never moved, here and in the two
        // cases below that also read a score across a hand.
        // The measurement restarts against the table actually on the felt.
        if (now !== sitting) {
          sitting = now;
          before = await total();
          continue;
        }
        if ((await total()) > before) break;
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p);
        await tick(p, 500);
        await sleep(20);
      }
      const after = await total();
      const where = await p.evaluate(() => {
        const t = (globalThis as { __truco?: Record<string, unknown> }).__truco ?? {};
        const play = document.querySelector(".play") as HTMLElement | null;
        return { phase: play?.dataset.phase, vaza: t.vaza, verdicts: t.verdicts, closed: t.closed, hand: t.hand };
      });
      assert(after > before, `the score never moved (${before} → ${after}); table was ${JSON.stringify(where)}`);
      const us = Number(await text(p, ".score.us .figure"));
      const them = Number(await text(p, ".score.them .figure"));
      assert(us <= 12 && them <= 12, `a score passed twelve: ${us} × ${them}`);
      // And the table deals again without being asked.
      await until(p, "the next hand", 20000, async () => (await count(p, ".seat-row.mine .card")) === 3);
    },
  },
  {
    id: "truco raises the stake and the house answers",
    accepts: ["accept-truco-call", "accept-stake-badge", "accept-raise-ladder"],
    run: async (p) => {
      // The button says whether the call is yours to make, so waiting on it is
      // waiting on the row behind it — clicking one that is not yet enabled
      // waits thirty seconds on a state the table may never return to.
      await until(p, "the call to be ours", 20000, async () => !(await p.locator("#btn-truco").isDisabled()));
      await p.locator("#btn-truco").click();
      await until(p, "the house to answer the raise", 12000, async () => {
        const stake = await attr(p, ".stake", "data-stake");
        const said = await p.locator(".log li[data-kind=truco]").count();
        return said > 0 && (stake !== "1" || (await count(p, ".said")) > 0);
      });
      const called = await text(p, ".log li[data-kind=truco] .what");
      assert(/Truco|Seis|Nove|Doze/.test(called), `the call was not logged: ${called}`);
      const stake = Number(await attr(p, ".stake", "data-stake"));
      assert([1, 3, 6, 9, 12, 2, 4, 8, 10].includes(stake), `stake off the ladder: ${stake}`);
    },
  },
  {
    id: "every picker is the app's own, and the table follows it",
    accepts: ["accept-custom-dropdown", "accept-theme-switch"],
    run: async (p) => {
      assert((await count(p, "select")) === 0, "a native select exists on the table");
      const trigger = p.locator('.picker[data-picker="theme"] > button');
      await trigger.click();
      const open = () => p.locator("#picker-pop-theme").evaluate((el: Element) => el.matches(":popover-open"));
      assert(await open(), "the picker did not open");
      await p.locator('.picker[data-picker="theme"] [data-opt="madeira"]').click();
      await until(p, "the table to change", 8000, async () => (await attr(p, ".matchbox", "data-theme")) === "madeira");
      assert(!(await open()), "the picker stayed open after a pick");
      const cloth = await p.locator(".mat").first().evaluate(
        (el: Element) => getComputedStyle(el).getPropertyValue("--cloth").trim(),
      );
      assert(cloth === "#7A4A22", `the madeira table did not resolve: ${cloth}`);
    },
  },
  {
    id: "the table survives a trip to the rules and back",
    accepts: ["accept-rules-screen", "accept-theme-switch"],
    run: async (p) => {
      // The case sets the table itself: durability is `tab`, so the sitting —
      // and the pick — ends with the page, which is the point of the path it
      // is testing (between screens, not across reloads).
      await pick(p, "theme", "madeira");
      await toRules(p);
      assert((await text(p, "h1")).includes("Como se joga"), "the rules screen has no title");
      // Four, and the four this table names: a page that draws every family's
      // set at once draws none of them. Which row is on show is the
      // stylesheet's answer, so the visible ones are the ones asked for.
      assert(
        (await count(p, ".manilhas:visible .card")) === 4,
        "the four manilhas this table names are not drawn",
      );
      assert((await attr(p, ".rules-head", "data-theme")) === "madeira", "the table did not travel with the reader");
      await toTable(p);
      assert((await attr(p, ".matchbox", "data-theme")) === "madeira", "the table was lost on the way back");
    },
  },
  {
    id: "switching variant restarts the match under the new rules",
    accepts: ["accept-variant-switch", "accept-mineiro-manilha"],
    run: async (p) => {
      // Cards land in the log first, so the restart has something to haunt
      // with: the fresh hand must own none of them. A round identified
      // without its seed inherits the old hand's append-only plays, and the
      // fold scores tricks nobody played this sitting.
      await playOne(p);
      // The switch must CHANGE the variant: picking the standing one is a
      // no-op by design (the active option's arrow rewrites nothing), and a
      // no-op restarts no match.
      const was = (await text(p, ".manilha-note")).includes("fixas") ? "mineiro" : "paulista";
      const to = was === "mineiro" ? "paulista" : "mineiro";
      await pick(p, "variant", to);
      await until(p, `a ${to} hand`, 15000, async () =>
        (await text(p, ".manilha-note")).includes("fixas") === (to === "mineiro"));
      assert(Number(await text(p, ".score.us .figure")) === 0, "the score carried across the rule change");
      assert(Number(await text(p, ".score.them .figure")) === 0, "the score carried across the rule change");
      const marks = await p.locator(".spine > li[data-node^=v]").evaluateAll(
        (els: Element[]) => els.map((e) => (e as HTMLElement).dataset.v ?? ""),
      );
      assert(marks.every((v: string) => v === ""), `the fresh hand inherited verdicts: ${marks}`);
      // Counted on the rows and not on the list: the region renders its
      // data-empty as an <li> of its own, so an empty log holds one.
      assert((await count(p, ".log li[data-kind]")) === 0, "the fresh hand inherited the old hand's log");
    },
  },
  {
    id: "2v2 seats four and the partner plays for your side",
    accepts: ["accept-seat-modes", "accept-partner-plays"],
    run: async (p) => {
      // A card first, for accept-variant-switch's reason above: seating four
      // is a restart too, and a fresh hand must own none of the old plays.
      await playOne(p);
      // The hand the felt is about to lose, so the wait below can witness the
      // one that replaces it. The backs are the `held` region's; the log is a
      // region nested in the round's own article — so counting backs comes
      // true while the felt can still be drawing the hand before. What the
      // assertion reads, the wait must witness.
      const before = await attr(p, ".hand", "data-round-id");
      await pick(p, "seats", "2v2");
      await until(p, "a fresh hand at a four-seat table", 15000, async () => {
        // A felt between hands has no article, so its id reads as absent —
        // which differs from the old one without being a new hand.
        const now = await attr(p, ".hand", "data-round-id");
        return now !== null && now !== before && (await count(p, ".seat-row.house .card-back")) === 9;
      });
      assert((await count(p, ".log li[data-kind]")) === 0, "the four-seat hand inherited the two-seat hand's log");
      await playOne(p);
      const circuit = forTable(45000);
      let round = false;
      while (circuit()) {
        await answerIfRaised(p);
        if ((await count(p, ".log li[data-kind=card]")) >= 4) { round = true; break; }
        // Kept playing, like every other wait here: a hand that finishes
        // under the driver is re-dealt and the log the count is kept in
        // starts again, and the table then waits on a card of yours that a
        // loop only watching would never lay.
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p);
        await tick(p);
        await sleep(20);
      }
      // What the table was doing when it ran out of budget, because "not four
      // yet" is every reason at once: a hand re-dealt under the driver empties
      // the log the count is kept in, and reads the same as a seat that never
      // took its turn.
      const table = await p.evaluate(() => ({
        hand: (document.querySelector(".matchbox") as HTMLElement | null)?.dataset.hand ?? "",
        seats: (document.querySelector(".matchbox") as HTMLElement | null)?.dataset.seats ?? "",
        phase: (document.querySelector(".play") as HTMLElement | null)?.dataset.phase ?? "",
        log: [...document.querySelectorAll(".log li[data-kind]")].map((e) =>
          `${(e as HTMLElement).dataset.seat}:${(e as HTMLElement).dataset.kind}`),
        backs: document.querySelectorAll(".seat-row.house .card-back").length,
        held: document.querySelectorAll(".seat-row.mine .card").length,
      }));
      assert(round, `not every seat played; the table was ${JSON.stringify(table)}`);
      const seats = await p.locator(".log li[data-kind=card]").evaluateAll(
        (els: Element[]) => els.map((e) => (e as HTMLElement).dataset.seat),
      );
      assert(seats.includes("parca"), `the partner never played: ${seats}`);
    },
  },
  {
    id: "nobody bids against themselves",
    accepts: ["accept-no-self-raise"],
    run: async (p) => {
      assert(!(await p.locator("#btn-truco").isDisabled()), "the table opened with the call already spent");
      // Only the side about to play may call, so a card played into the
      // house's turn takes the call away until it comes back around.
      await until(p, "the house's turn", 8000, async () => {
        if (await p.locator("#btn-truco").isDisabled()) return true;
        const playable = p.locator(".seat-row.mine .card:not([disabled]):not([data-exit])");
        if ((await playable.count()) > 0) {
          await playable.first().click({ timeout: 2000 }).then(() => true, () => false);
        }
        return await p.locator("#btn-truco").isDisabled();
      });
      await until(p, "our turn again", 25000, async () => {
        await answerIfRaised(p);
        return !(await p.locator("#btn-truco").isDisabled());
      });
      await p.locator("#btn-truco").click();
      // Their answer is a row, not a phase: accepted or run, it is written down.
      await until(p, "the house to answer", 12000, async () =>
        (await count(p, '.log li[data-kind=accept][data-seat^=eles], .log li[data-kind=run][data-seat^=eles]')) > 0);
      // Accepted or run, the same rule holds: our side does not climb next.
      const stake = Number(await attr(p, ".stake", "data-stake"));
      // Raised means off the variant's BASE, not above one: paulista opens at
      // 1 and mineiro at 2, and 2 is not a rung on the paulista ladder, so the
      // pair covers both. Reading it as `> 1` made this case pass or fail on
      // whether the house accepted or ran — running resets the stake to the
      // mineiro base, which is 2.
      if (stake !== 1 && stake !== 2) {
        assert(await p.locator("#btn-truco").isDisabled(), "we could raise our own accepted bet");
        const label = (await p.locator("#btn-truco").innerText()).trim();
        assert(/ELES/i.test(label), `the button does not say whose turn it is: ${label}`);
      }
      // Not "one call was made" — after they accept, climbing is THEIR right,
      // so a second call is the rule working. What must never happen is the
      // same side calling twice in a row.
      const callers = await p.locator(".log li[data-kind=truco]").evaluateAll(
        (els: Element[]) => els.map((e) => ((e as HTMLElement).dataset.seat ?? "").startsWith("eles") ? "them" : "us"),
      );
      for (let i = 1; i < callers.length; i++) {
        assert(callers[i] !== callers[i - 1], `${callers[i]} called twice in a row: ${callers.join(" → ")}`);
      }
      assert(callers.length >= 1, "the call was not logged at all");
    },
  },
  {
    id: "a reload sits back down at the same table",
    accepts: ["accept-same-table"],
    run: async (p) => {
      await playOne(p);
      const before = await attr(p, ".matchbox", "data-match-id");
      const hand = await attr(p, ".matchbox", "data-hand");
      assert((before ?? "") !== "", "the table has no match to keep");
      // No clear: the point is the sitting that survives the tab.
      await p.reload({ waitUntil: "domcontentloaded" });
      await until(p, "the table again", 20000, async () => (await count(p, ".seat-row.mine .card")) > 0);
      assert(
        (await attr(p, ".matchbox", "data-match-id")) === before,
        `the reload opened a second table: ${before} then ${await attr(p, ".matchbox", "data-match-id")}`,
      );
      assert((await attr(p, ".matchbox", "data-hand")) === hand, "the reload lost the hand it was on");
      // And the dealer is writing to the one on the board: a picker that
      // reaches a different match is how this last went unnoticed.
      await pick(p, "theme", "madeira");
    },
  },
  {
    id: "a reload between hands resumes a table that still plays",
    accepts: ["accept-same-table", "accept-next-hand"],
    run: async (p) => {
      // Play the hand out to the score, so the match moves to hand 2 and the
      // mão passes to eles — then reload. The round is tab-tier and dies; the
      // match is device-tier and survives carrying hand 2. The boot must deal
      // AND the fold must own what it dealt: a round the match disowns is
      // re-dealt identically forever, which raises no wake and sleeps the
      // table with the house to lead — one mismatched spelling of hand_no
      // away, and silent when it happens.
      const total = async () =>
        Number(await text(p, ".score.us .figure")) + Number(await text(p, ".score.them .figure"));
      const before = await total();
      const playing = forTable(45000);
      while (playing()) {
        await answerIfRaised(p);
        if ((await total()) > before) break;
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p);
        await tick(p, 500);
        await sleep(20);
      }
      assert((await total()) > before, "hand 1 never scored");
      await p.reload({ waitUntil: "domcontentloaded" });
      await until(p, "the next hand after the reload", 20000, async () =>
        (await count(p, ".seat-row.mine .card")) === 3);
      await until(p, "the resumed table to keep playing", 25000, async () => {
        await answerIfRaised(p);
        return (await count(p, ".seat-row.mine .card:not([disabled])")) > 0 ||
          (await count(p, ".matcards .card")) > 0;
      });
    },
  },
  {
    id: "an accepted raise is the stake the hand pays",
    accepts: ["accept-truco-call", "accept-raise-ladder", "accept-hand-winner"],
    run: async (p) => {
      // Play until eles call; take the bet; the badge must adopt the called
      // rung at the accept — not at the scoring — and the hand must pay
      // exactly what was accepted. A stake that climbs only in the banner
      // while the badge holds the base pays the base, and nobody can say
      // what the hand is worth.
      await seatedAt(p, 2);
      const calling = forTable(60000);
      let adopted = 0;
      while (calling()) {
        if ((await count(p, '.log li[data-kind=truco][data-seat^=eles]')) > 0 &&
            (await attr(p, ".play", "data-phase")) === "raised") {
          const before = await count(p, '.log li[data-kind=accept][data-seat=you]');
          const pressed = await p.locator("#btn-accept").click({ timeout: 2000 }).then(() => true, () => false);
          if (pressed) {
            await until(p, "the accept to reach the log", 8000, async () =>
              (await count(p, '.log li[data-kind=accept][data-seat=you]')) > before);
            await until(p, "the badge to adopt the accepted rung", 8000, async () =>
              Number(await attr(p, ".stake", "data-stake")) > 1);
            adopted = Number(await attr(p, ".stake", "data-stake"));
            break;
          }
        }
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) {
          await playOne(p).catch(() => {});
        }
        await tick(p, 300);
        await sleep(20);
      }
      assert(adopted > 0, "Tião never called on a table dealt for him to call");
      // Mineiro opens the mão at 2 and every other variant at 1. The match row
      // is where the variant is stated — a table that fixes its manilhas draws
      // no strip to read it off.
      const OPENS: Record<string, number> = {
        paulista: 1, mineiro: 2, gaucho: 1, argentino: 1, uruguayo: 1, paraguayo: 1,
      };
      const variant = (await attr(p, ".matchbox", "data-variant")) ?? "";
      const base = OPENS[variant];
      assert(base !== undefined, `the table is dealt under ${variant}, which opens at no rung this case knows`);
      assert(adopted > base, `the badge did not adopt the accepted rung: ${adopted}`);
      // Play the hand out; the score moves by exactly the adopted stake, or
      // by what a later accepted climb moved it to — read the banner's own
      // number and hold the scoreboard to it.
      const total = async () =>
        Number(await text(p, ".score.us .figure")) + Number(await text(p, ".score.them .figure"));
      const before = await total();
      // The sitting can end under the measurement, as it can above.
      const sitting = await attr(p, ".matchbox", "data-match-id");
      const playing = forTable(60000);
      // The banner lives only for the pause between hands, shorter than a
      // stride at speed — it is read inside the loop or not at all.
      let worth = 0;
      let ended = false;
      while (playing()) {
        await answerIfRaised(p);
        const m = /\+(\d+)/.exec(await text(p, ".talk").catch(() => ""));
        if (m !== null) worth = Number(m[1]);
        if ((await attr(p, ".matchbox", "data-match-id")) !== sitting) { ended = true; break; }
        if ((await total()) > before) break;
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) {
          await playOne(p).catch(() => {});
        }
        await tick(p, 500);
        await sleep(20);
      }
      if (ended) {
        // The scoreboard cannot answer for a hand it has already forgotten,
        // so the banner is the only witness left to hold to the stake.
        assert(worth > 0, "the sitting ended before the hand's worth was ever printed");
        assert(worth >= adopted, `the hand paid ${worth}, below the accepted ${adopted}`);
        return;
      }
      const delta = (await total()) - before;
      if (delta === 0) return; // a drawn hand pays nobody; the adoption above is the case's proof
      assert(delta >= adopted, `the hand paid ${delta}, below the accepted ${adopted}`);
      if (worth > 0) assert(delta === worth, `the banner says +${worth} but the score moved ${delta}`);
    },
  },
  {
    id: "a won sitting left overnight opens by itself",
    accepts: ["accept-instant-table", "accept-match-over"],
    run: async (p) => {
      // A finished match survives the tab (device tier); its closing
      // scoreline does not (the round is tab tier). With nothing left to
      // read, the table opens a fresh sitting on its own — the trap: a won
      // match blocks the auto-open while the only other asker lives in UI
      // that needs a round row to render.
      await p.addInitScript(() => {
        const probe = () => {
          const b = document.querySelector("#btn-start");
          if (b) {
            const h = b.getBoundingClientRect().height;
            (window as { __btnStartMaxH?: number }).__btnStartMaxH = Math.max(
              (window as { __btnStartMaxH?: number }).__btnStartMaxH ?? 0, h);
          }
          requestAnimationFrame(probe);
        };
        requestAnimationFrame(probe);
      });
      await injectMatch(p, {
        id: "mwon9", variant: "mineiro", seats: "1v1", theme: "xadrez",
        us_score: "12", them_score: "4", stake: "2", hand_no: "7",
        status: "over", winner: "us", opponent: "cida",
        opponent_name: "Dona Cida", partner_name: "Bigode", seed: "424242", current: "yes",
      });
      await p.reload({ waitUntil: "domcontentloaded" });
      await until(p, "a fresh sitting to open itself", 20000, async () =>
        (await count(p, ".seat-row.mine .card")) === 3);
      const id = await attr(p, ".matchbox", "data-match-id");
      assert(id !== "" && id !== "mwon9", `the won match was reopened: ${id}`);
      assert(Number(await text(p, ".score.us .figure")) === 0, "the old score bled into the new sitting");
      // If the start affordance painted at all, it painted as a pill — a
      // stretching grid track renders it at card proportions, and only a
      // frame-level probe sees a state this short-lived.
      const h = await p.evaluate(() => (window as { __btnStartMaxH?: number }).__btnStartMaxH ?? 0);
      assert(h < 100, `the start button painted ${h}px tall`);
    },
  },
  {
    id: "the mão de dez is decided with your partner's cards face up, and no truco",
    accepts: ["accept-mao-de-dez"],
    run: async (p) => {
      await injectMatch(p, {
        id: "mdez", variant: "mineiro", seats: "2v2", theme: "xadrez",
        us_score: "10", them_score: "0", stake: "2", hand_no: "1",
        status: "playing", winner: "", opponent: "tiao",
        opponent_name: "Tião Pandeiro", partner_name: "Bigode", seed: "2", current: "yes",
      });
      await p.reload({ waitUntil: "domcontentloaded" });
      await until(p, "the brink offered", 20000, async () => {
        const id = await attr(p, ".matchbox", "data-match-id");
        return id === "mdez" && await p.locator("#btn-brink-play").isVisible();
      });
      assert(await p.locator("#btn-brink-run").isVisible(), "running from the mão de dez is not offered");
      assert(!(await p.locator("#btn-truco").isVisible()), "truco is offered in the mão de dez");
      assert((await count(p, ".seat-row.mine .card:not([disabled])")) === 0, "a card can be laid before the decision");
      // The one moment the rules let a pair look at each other's hands.
      const faces = p.locator('.seat-row[data-seat="parca"] .card-back .face');
      assert((await faces.count()) === 3, `your partner holds ${await faces.count()} cards`);
      for (let i = 0; i < 3; i++) {
        assert(await faces.nth(i).isVisible(), "your partner's cards are still face down while you decide");
      }
      assert(/Mão de dez/.test(await text(p, ".talk")), `the table says "${await text(p, ".talk")}"`);

      assert(await attr(p, ".play", "data-phase") === "your-turn",
        `the board wears "${await attr(p, ".play", "data-phase")}" while the decision is yours`);

      await p.locator("#btn-brink-play").click();
      await until(p, "the hand raised to four", 10000, async () =>
        (await attr(p, ".hand", "data-stake")) === "4");
      assert(/Nós jogamos/.test(await text(p, ".talk")), `after deciding the table says "${await text(p, ".talk")}"`);
      await until(p, "the decision to leave the rail", 10000, async () =>
        !(await p.locator("#btn-brink-play").isVisible()));
      assert(!(await faces.first().isVisible()), "your partner's cards stayed face up after the decision");
      assert(!(await p.locator("#btn-truco").isVisible()), "truco came back inside the mão de dez");
      await until(p, "a card yours to lay", 10000, async () =>
        (await count(p, ".seat-row.mine .card:not([disabled])")) > 0);
    },
  },
  {
    id: "the mão de ferro is played face down",
    accepts: ["accept-mao-de-dez"],
    run: async (p) => {
      await injectMatch(p, {
        id: "mferro", variant: "mineiro", seats: "1v1", theme: "xadrez",
        us_score: "10", them_score: "10", stake: "2", hand_no: "1",
        status: "playing", winner: "", opponent: "tiao",
        opponent_name: "Tião Pandeiro", partner_name: "Bigode", seed: "2", current: "yes",
      });
      await p.reload({ waitUntil: "domcontentloaded" });
      await until(p, "a playable blind hand", 20000, async () =>
        (await attr(p, ".matchbox", "data-match-id")) === "mferro" &&
        (await count(p, ".seat-row.mine .card:not([disabled])")) === 3);
      assert(await attr(p, ".hand", "data-brink") === "both", "10-10 is not a mão de ferro");
      assert(!(await p.locator("#btn-brink-play").isVisible()), "the mão de ferro asked you to decide");
      assert(!(await p.locator("#btn-truco").isVisible()), "truco is offered in the mão de ferro");
      assert(!(await p.locator(".seat-row.mine .card .corner").first().isVisible()),
        "your own cards show their faces in the mão de ferro");
      // Laid, a card shows what it was.
      await playOne(p);
      await until(p, "the laid card face up", 10000, async () =>
        await p.locator('.matcards .played[data-seat="you"] .card .corner').first().isVisible());
    },
  },
  {
    id: "a country picked brings its own truco, in its own language",
    accepts: ["accept-variant-switch"],
    run: async (p) => {
      const variant = () => attr(p, ".matchbox", "data-variant");
      const seated = async () => /^m[0-9a-z]+$/.test((await attr(p, ".matchbox", "data-match-id")) ?? "");
      const pickCountry = async (locale: string, path: string, want: string) => {
        await p.locator("#picker-open-country").click();
        await p.locator(`[data-picker="country"] a[data-locale="${locale}"]`).click();
        await until(p, `${path} dealing ${want}`, 20000, async () =>
          new URL(p.url()).pathname === path && await seated() && (await variant()) === want &&
          (await count(p, ".seat-row.mine .card")) === 3);
      };
      assert((await variant()) === "mineiro", `the table opened on ${await variant()}`);
      await pickCountry("es-AR", "/ar", "argentino");
      await pickCountry("ca-ES", "/ca", "truc");
      assert(await attr(p, ".screen[data-screen=arena]", "data-locale") === "ca-ES", "Spain's table is not in Catalan");
      const us = (await text(p, ".score.us .sect")).trim();
      assert(us.toLowerCase() === "nosaltres", `Spain's scoreboard reads "${us}"`);
      // Reading a country's address again is not picking it: a reload keeps
      // whatever the table was dealing.
      await p.locator('.picker[data-picker="variant"] > button').click();
      await p.locator('.picker[data-picker="variant"] [data-opt="gaucho"]').click();
      await until(p, "gaúcho on the Catalan table", 20000, async () => (await variant()) === "gaucho" && await seated());
      await p.reload({ waitUntil: "domcontentloaded" });
      await until(p, "the table back after a reload", 20000, async () =>
        await seated() && (await count(p, ".seat-row.mine .card")) === 3);
      assert((await variant()) === "gaucho", `a reload of Spain's address switched the table to ${await variant()}`);
      // Brazil plays gaúcho, so picking it keeps the table; Argentina does
      // not, so it is dealt Argentina's own.
      await pickCountry("pt-BR", "/", "gaucho");
      await pickCountry("es-AR", "/ar", "argentino");
      await pickCountry("pt-BR", "/", "mineiro");
    },
  },
  {
    id: "the players talk like their table, whatever the page's language",
    accepts: ["accept-variant-words"],
    run: async (p) => {
      // Truc on the Argentine page: the controls are Spanish, the call is
      // Catalan, because the player making it is at a truc table.
      await injectMatch(p, {
        id: "mvoice", variant: "truc", seats: "1v1", theme: "xadrez",
        us_score: "0", them_score: "0", stake: "1", hand_no: "1",
        status: "playing", winner: "", opponent: "nezinho",
        opponent_name: "Seu Nezinho", partner_name: "Bigode", seed: "3", current: "yes",
      });
      await p.goto(`${origin(p)}/ar?${TEMPO}`, { waitUntil: "domcontentloaded" });
      await until(p, "a truc hand you lead", 20000, async () =>
        (await attr(p, ".matchbox", "data-match-id")) === "mvoice" &&
        (await count(p, ".seat-row.mine .card:not([disabled])")) === 3);
      const said = (sel: string) => p.locator(sel).first().evaluate((el: Element) => (el.textContent ?? "").trim());
      assert((await said("#btn-accept b")) === "Quiero", `the Argentine page's answer reads "${await said("#btn-accept b")}"`);
      assert((await said("#btn-truco")) === "TRUC!", `the truc table's call reads "${await said("#btn-truco")}"`);

      // Mineiro on the Brazilian page, at its last hand: whoever takes the
      // match says so the way Minas does.
      await injectMatch(p, {
        id: "mminas", variant: "mineiro", seats: "1v1", theme: "xadrez",
        us_score: "10", them_score: "10", stake: "2", hand_no: "1",
        status: "playing", winner: "", opponent: "nezinho",
        opponent_name: "Seu Nezinho", partner_name: "Bigode", seed: "3", current: "yes",
      });
      await p.goto(`${origin(p)}/?${TEMPO}`, { waitUntil: "domcontentloaded" });
      await until(p, "the mão de ferro dealt", 20000, async () =>
        (await attr(p, ".matchbox", "data-match-id")) === "mminas" && (await count(p, ".seat-row.mine .card")) === 3);
      const playing = forTable(90000);
      while (playing() && (await attr(p, ".play", "data-phase")) !== "over") {
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p).catch(() => {});
        await tick(p, 300);
        await sleep(20);
      }
      const shout = (await text(p, ".shout")).replace(/\s+/g, "");
      assert(["ÉNÓIS,SÔ!", "LEVAMO,UAI!"].includes(shout), `the mineiro table closed on "${shout}"`);
    },
  },
  {
    id: "a tie and the rodada that breaks it are laid side by side",
    accepts: ["accept-vaza-tie"],
    run: async (p) => {
      // Seed 1's second hand: the house leads 6♥ and you hold 6♠, so the
      // first rodada ties; you answer the second with 2♥.
      await injectMatch(p, {
        id: "mtie", variant: "mineiro", seats: "1v1", theme: "xadrez",
        us_score: "0", them_score: "0", stake: "2", hand_no: "2",
        status: "playing", winner: "", opponent: "nezinho",
        opponent_name: "Seu Nezinho", partner_name: "Bigode", seed: "1", current: "yes",
      });
      await p.reload({ waitUntil: "domcontentloaded" });
      await until(p, "the house's lead and your hand", 20000, async () =>
        (await count(p, '.trick[data-t="1"] .played')) === 1 &&
        (await count(p, '.seat-row.mine .card[data-card="6♠"]:not([disabled])')) === 1);
      // Where two cards are, how far the second sits past the first — and
      // whether each lies square.
      const lay = (t: number) => p.locator(`.trick[data-t="${t}"] .played`).evaluateAll((els: Element[]) => {
        const boxes = els.map((e) => e.querySelector(".card")!.getBoundingClientRect());
        return {
          gap: boxes.length < 2 ? NaN : boxes[1].left - boxes[0].right,
          square: els.every((e) => ["0deg", "none"].includes(getComputedStyle(e).rotate)),
        };
      });
      // Read once the rodada's own motion is over. The verdict squares it over
      // --motion-settle and how much wall time that ease takes is the
      // runner's: a fixed 600ms read a loaded runner's first card mid-turn
      // ("the tie lies 19px apart, square: false"). Waited on the page, never
      // by advancing the table's clock, which would deal on past the rodada.
      const laid = async (t: number) => {
        await p.waitForFunction((t: number) =>
          !document.getAnimations().some((a) => {
            const fx = a.effect as KeyframeEffect | null;
            return a.playState === "running" && fx?.getTiming().iterations !== Infinity &&
              fx?.target?.closest(`.trick[data-t="${t}"]`) != null;
          }), t, { timeout: 5000 });
        return lay(t);
      };
      await p.locator('.seat-row.mine .card[data-card="6♠"]').click();
      await until(p, "both first cards down", 10000, async () => (await count(p, '.trick[data-t="1"] .played')) === 2);
      await until(p, "the first card lands across", 2000, async () => (await lay(1)).gap < 0);
      const falling = await lay(1);
      assert(falling.gap < 0, `before the verdict the first rodada lies ${falling.gap}px apart, not across each other`);
      await until(p, "the tie", 10000, async () => (await attr(p, ".matcards", "data-v1")) === "tie");
      const tied = await laid(1);
      assert(tied.gap >= 0 && tied.square, `the tie lies ${tied.gap}px apart, square: ${tied.square}`);

      await until(p, "the second rodada to be yours", 10000, async () => {
        await answerIfRaised(p);
        return (await count(p, '.seat-row.mine .card[data-card="2♥"]:not([disabled])')) === 1;
      });
      await p.locator('.seat-row.mine .card[data-card="2♥"]').click();
      await until(p, "both second cards down", 10000, async () => (await count(p, '.trick[data-t="2"] .played')) === 2);
      const deciding = await laid(2);
      assert(deciding.gap >= 0 && deciding.square, `the deciding rodada lies ${deciding.gap}px apart, square: ${deciding.square}`);
    },
  },
  {
    id: "three pairs keep your hand and the mat on a phone",
    accepts: ["accept-seat-modes"],
    run: async (p) => {
      // Five hands across the top and six cards to a rodada: what spills past
      // the board is clipped, so a table that plays is one where nothing did.
      await p.setViewportSize({ width: 390, height: 844 });
      try {
        await injectMatch(p, {
          id: "msix", variant: "douradinha", seats: "2v2v2", theme: "xadrez",
          us_score: "0", them_score: "0", stake: "2", hand_no: "1",
          status: "playing", winner: "", opponent: "nezinho",
          opponent_name: "Seu Nezinho", partner_name: "Bigode", seed: "7", current: "yes",
        });
        await p.reload({ waitUntil: "domcontentloaded" });
        await until(p, "a dealt six-seat hand", 20000, async () =>
          (await attr(p, ".matchbox", "data-match-id")) === "msix" &&
          (await count(p, ".seat-row.mine .card")) === 3);
        const inside = (sel: string) => p.evaluate((sel: string) => {
          const board = document.querySelector(".board")!.getBoundingClientRect();
          return [...document.querySelectorAll(sel)].every((e) => {
            const b = e.getBoundingClientRect();
            return b.left >= board.left - 1 && b.right <= board.right + 1;
          });
        }, sel);
        assert(await inside("#seat-you .card"), "your hand runs off the board at three pairs");
        const playing = forTable(60000);
        while (playing() && (await count(p, '.trick[data-t="1"] .played')) < 6) {
          await answerIfRaised(p);
          if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p).catch(() => {});
          await tick(p, 300);
          await sleep(20);
        }
        assert((await count(p, '.trick[data-t="1"] .played')) > 0, "nothing reached the mat");
        assert(await inside(".matcards .played .card"), "the mat runs off the board at three pairs");
        assert(await inside(".seat-row.house .card-back"), "the five hands across run off the board");
      } finally {
        await p.setViewportSize({ width: 1280, height: 900 });
      }
    },
  },
  {
    id: "a match won at the table stays on it until asked",
    accepts: ["accept-match-to-twelve", "accept-match-over"],
    run: async (p) => {
      // The overnight case wins offstage; this one wins at the table and
      // looks. The arena's match slots are pinned on the match on the table,
      // so the row that just closed stays on the felt, score and winner
      // included, until something is asked of it — "Outra partida" here, or
      // a rule picked on it (arena.test.ts holds that one). A slot pinned on status
      // swaps in its empty row the instant the match closes, and the score
      // case's restart-on-new-id reads that as a fresh sitting rather than a
      // frozen one — which is how a table with no way forward passed.
      await injectMatch(p, {
        id: "malmost", variant: "paulista", seats: "1v1", theme: "xadrez",
        us_score: "11", them_score: "0", stake: "1", hand_no: "1",
        status: "playing", winner: "", opponent: "tiao",
        opponent_name: "Tião Pandeiro", partner_name: "Bigode", seed: "2", current: "yes",
      });
      await p.reload({ waitUntil: "domcontentloaded" });
      await until(p, "a dealt hand", 20000, async () => {
        if ((await count(p, ".seat-row.mine .card")) !== 3) return false;
        const id = await attr(p, ".matchbox", "data-match-id");
        const roundAttr = await attr(p, "#seat-you .card", "data-round");
        return id === "malmost" && roundAttr !== null && roundAttr.startsWith("malmost");
      });
      // Eleven is paulista's brink, so the hand is the mão de onze and is
      // played only once you say so.
      const playing = forTable(90000);
      while (playing()) {
        if ((await attr(p, ".play", "data-phase")) === "over") break;
        if (await p.locator("#btn-brink-play").isVisible()) await p.locator("#btn-brink-play").click();
        await answerIfRaised(p);
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p).catch(() => {});
        await tick(p, 300);
        await sleep(20);
      }
      assert(await attr(p, ".play", "data-phase") === "over", "one point from twelve, the match never closed");
      assert(await attr(p, ".matchbox", "data-match-id") === "malmost", "the won match left the table");
      assert(Number(await text(p, ".score.us .figure")) === 12, "the closing score is not on the board");
      assert(/Partida sua/.test(await text(p, "#over-line")), "the table does not say who won");
      assert(await attr(p, ".shout", "data-state") === "live", "the partida closed without a shout");
      assert((await text(p, ".shout")).replace(/\s+/g, "") === "ÉNOSSA!", `the closing shout says ${await text(p, ".shout")}`);
      assert((await text(p, "#over-say")).trim().length > 0, "eles had nothing to say about losing");
      await p.locator("#btn-again").click();
      await until(p, "a fresh sitting", 20000, async () => {
        if ((await count(p, ".seat-row.mine .card")) !== 3) return false;
        const id = await attr(p, ".matchbox", "data-match-id");
        const roundAttr = await attr(p, "#seat-you .card", "data-round");
        return id !== null && id !== "" && id !== "malmost" && roundAttr !== null && roundAttr.startsWith(id);
      });
      assert(await attr(p, ".matchbox", "data-status") === "playing", "the new sitting is not playing");
      assert(Number(await text(p, ".score.us .figure")) === 0, "the new sitting inherited the old score");
    },
  },
  {
    id: "the table keeps its cards",
    accepts: ["accept-table-memory"],
    run: async (p) => {
      // Both tricks are counted inside ONE hand: a side that takes the first
      // two has won, and the deal that follows clears the cloth, so a cloth
      // with fewer cards on it is the next hand rather than a table that
      // forgot.
      for (let attempt = 0; attempt < 3; attempt++) {
        const dealt = await attr(p, ".matchbox", "data-hand");
        const standing = async () => (await attr(p, ".matchbox", "data-hand")) === dealt;
        await playOne(p);
        await until(p, "the first trick to close", 20000, async () => {
          await answerIfRaised(p);
          return !(await standing()) || (await closedTricks(p)) >= 1;
        });
        if (!(await standing())) continue;
        const cardsBefore = await count(p, ".trick .card");
        assert(cardsBefore >= 2, `the closed trick did not keep its cards: ${cardsBefore}`);
        assert((await count(p, '.played[data-win="yes"]')) >= 1, "no card is marked as having taken the trick");
        let grew = false;
        await until(p, "both tricks on the cloth", 20000, async () => {
          await answerIfRaised(p);
          if ((await count(p, ".trick .card")) > cardsBefore) {
            grew = true;
            return true;
          }
          if (!(await standing())) return true;
          const playable = p.locator(".seat-row.mine .card:not([disabled]):not([data-exit])");
          if ((await playable.count()) > 0) {
            await playable.first().click({ timeout: 1000 }).then(() => true, () => false);
          }
          return false;
        });
        if (grew) return;
      }
      throw new Error("three hands ended before a second trick landed beside the first");
    },
  },
  {
    id: "a hurried second tap is not a second card",
    accepts: ["accept-play-card"],
    run: async (p) => {
      const playable = p.locator(".seat-row.mine .card:not([disabled])");
      await playable.nth(0).click();
      // The trick is closing on a beat; a second tap during it must not land.
      // force bypasses actionability, which is exactly what a fast double tap
      // does to a button the app has not disabled yet.
      await p.locator(".seat-row.mine .card").nth(1).click({ force: true }).catch(() => {});
      await tick(p, 2200);
        await sleep(20);
      const open = await openTrickCards(p);
      const seats = 2;
      assert(open <= seats, `${open} cards landed in a ${seats}-seat trick`);
      // And the hand is still alive: a trick that closed twice used to freeze
      // it. Alive means the log kept growing or the hand reached a result —
      // both of which are written down, unlike the phase the board wears.
      await until(p, "the table to keep playing", 20000, async () => {
        await answerIfRaised(p);
        // Alive means the table is waiting on you again, or the hand reached a
        // result. Both are written on rows — a card is playable because its own
        // row says so — where the phase the board wears is a state it passes
        // through and can leave before anybody looks.
        return (await count(p, ".seat-row.mine .card:not([disabled])")) > 0 ||
          (await attr(p, ".hand", "data-result")) !== "";
      });
    },
  },
  {
    id: "the table speaks the variant's words",
    accepts: ["accept-variant-words"],
    run: async (p) => {
      const rules = async () => {
        await toRules(p);
        const t = await text(p, ".screen[data-screen=regras]");
        await toTable(p);
        return t;
      };
      // Each variant is chosen, never assumed: the table opens on one of them,
      // and which one is a product decision this test must not encode.
      const chosen = async (opt: string) => {
        await pick(p, "variant", opt);
        await until(p, `a ${opt} hand`, 15000, async () =>
          (await text(p, ".manilha-note")).includes("fixas") === (opt === "mineiro"));
      };
      await chosen("paulista");
      const paulista = await rules();
      assert(paulista.includes("vaza") && paulista.includes("partida"), "paulista is not speaking paulista");
      assert(!paulista.includes("queda"), "paulista is using mineiro words");
      await chosen("mineiro");
      const mineiro = await rules();
      assert(mineiro.includes("rodada") && mineiro.includes("jogo"), "mineiro is not speaking mineiro");
      assert(!mineiro.includes("vaza"), "mineiro is still saying vaza");
      // Queda is the best of three jogos — the tier above the ladder, not a
      // rung on it and not a trick. The app keeps no such tally, so the word
      // must appear nowhere.
      assert(!mineiro.includes("queda") && !paulista.includes("queda"), "the table is calling something a queda");
      // The picker's own value is text, not generated content.
      const label = (await text(p, '.picker[data-picker="variant"] .pick-label')).trim();
      assert(label === "Mineiro", `the picker label is not readable text: "${label}"`);
    },
  },
  {
    id: "the scoreboard says nós and eles",
    accepts: ["accept-nos-eles"],
    run: async (p) => {
      const left = (await text(p, ".score.us .sect")).trim().toLowerCase();
      const right = (await text(p, ".score.them .sect")).trim();
      assert(left === "nós", `the left column is not nós: "${left}"`);
      assert(right.length > 2 && !/casa/i.test(right), `the right column is not a name: "${right}"`);
      const body = (await text(p, ".screen")).toLowerCase();
      assert(!body.includes("casa"), "the table still speaks of a casa");
      // One bean per tento, on both sides.
      const us = Number(await text(p, ".score.us .figure"));
      const them = Number(await text(p, ".score.them .figure"));
      const marks = await count(p, ".tentos .tento:visible");
      assert(marks === us + them, `${marks} markers for a score of ${us}x${them}`);
    },
  },
  {
    id: "eles tell you before they call",
    accepts: ["accept-persona-tell"],
    run: async (p) => {
      // At a player's speed, not the suite's. The tell stands for one beat and
      // is then replaced by the call; a case whose whole subject is that beat
      // has to watch it at the length a player sees, or it is asserting about
      // a window its own sampling cannot fit inside.
      await freshTable(p, origin(p), "real");
      // Seated across from Tião on a shuffle he calls the first hand of: a
      // random deal against Zé, who calls only on a great hand, can run a
      // minute of real clock without a single call to observe.
      await seatedAt(p, 2);
      // The page keeps the line, because this driver cannot watch it. The tell
      // stands for one beat and the call replaces it, and a loop that samples
      // is inside playOne for whole seconds at a time — long enough for the
      // window to open and shut between two looks. An observer sees every line
      // the talk holds, so a miss is the table never saying it.
      await p.evaluate(() => {
        const said: string[] = [];
        (globalThis as { __tells?: string[] }).__tells = said;
        const worn: string[] = [];
        (globalThis as { __worn?: string[] }).__worn = worn;
        const push = () => {
          const line = (document.querySelector(".talk") as HTMLElement | null)?.innerText.trim() ?? "";
          if (line !== "" && said[said.length - 1] !== line) said.push(line);
          const tell = (document.querySelector(".seats") as HTMLElement | null)?.dataset.tell ?? "";
          if (tell !== "" && worn[worn.length - 1] !== tell) worn.push(tell);
        };
        push();
        new MutationObserver(push).observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      });
      const deadline = Date.now() + 60000;
      let sawTell = false;
      while (Date.now() < deadline) {
        const said: string[] = await p.evaluate(() => (globalThis as { __tells?: string[] }).__tells ?? []);
        const talk = said[said.length - 1] ?? "";
        if (said.some((line) => /ajeita as cartas|bate duas vezes|cantarolar|fica quieto/.test(line))) sawTell = true;
        // Read off the log rather than off the board's phase: the driver
        // answers a raise as soon as it sees one, so the moment the board
        // spends waiting for an answer is a moment this loop can miss. The row
        // the call left behind cannot be missed.
        if ((await count(p, '.log li[data-kind=truco][data-seat^=eles]')) > 0) {
          assert(sawTell, `they called with no tell; the table said ${JSON.stringify(talk)}`);
          // The seats wear the tell while it stands: the gesture is keyed on the
          // persona, and a line the seats never wore is a tell nobody could see
          // without reading.
          const worn: string[] = await p.evaluate(() => (globalThis as { __worn?: string[] }).__worn ?? []);
          assert(worn.includes("tiao"), `the seats never wore Tião's tell: ${JSON.stringify(worn)}`);
          const logged = await text(p, ".log li[data-kind=truco] .what");
          assert(logged.trim().length > 0, "the call was not logged in their words");
          return;
        }
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p);
        // This case runs on the table's own clock, so there is no clock here
        // to advance; the wait is the table's to keep.
        await sleep(20);
      }
      assert(sawTell, "no opponent called in 60s of play, so no tell was observed");
    },
  },
  {
    id: "the mão passes and the pé is shown",
    accepts: ["accept-mao-and-pe"],
    run: async (p) => {
      // innerText is rendered text and the tag is uppercased by CSS, so the
      // comparison is on the word, not on its casing.
      const role = async () => (await text(p, ".seat-role")).trim().toLowerCase();
      const first = await role();
      assert(first === "mão" || first === "pé", `no position is shown: "${first}"`);
      // Play the hand out; the next deal moves the lead one seat, so the
      // position flips in a two-seat game.
      const playing = forTable(45000);
      while (playing()) {
        await answerIfRaised(p);
        if ((await role()) !== first) break;
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p);
        await tick(p, 500);
        await sleep(20);
      }
      const next = await role();
      assert(next !== first, `the mão never passed: still "${next}"`);
      assert(next === "mão" || next === "pé", `the position went missing: "${next}"`);
    },
  },
  {
    id: "a run is heard, then paid, and the hand stays to be read",
    accepts: ["accept-run-scores", "accept-next-hand"],
    run: async (p) => {
      // Three beats the fold keeps apart: "Corri" stands before the score
      // lands; the score line then stands on the resolved hand before the
      // next is dealt. A fold that scores on the same wake as the run, or
      // deals on the same wake as the score, passes every other case here
      // and shows a player nothing.
      await seatedAt(p, 2);
      const calling = forTable(60000);
      let raised = false;
      while (calling()) {
        if ((await attr(p, ".play", "data-phase")) === "raised" &&
            (await count(p, '.log li[data-kind=truco][data-seat^=eles]')) > 0) { raised = true; break; }
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p).catch(() => {});
        await tick(p, 300);
        await sleep(20);
      }
      assert(raised, "Tião never called on seed 2");
      const stood = Number(await attr(p, ".hand", "data-stake"));
      const handId = await attr(p, ".hand", "data-round-id");
      const themBefore = Number(await text(p, ".score.them .figure"));
      await p.locator("#btn-run").click();
      await until(p, "the run to be heard", 8000, async () => (await text(p, ".talk")).trim() === "Corri");
      assert(await attr(p, ".play", "data-ran") === "us", "the runner's cards did not leave");
      assert((await text(p, ".shout")).replace(/\s+/g, "") === "CORRI", "the run was not said from our side");
      assert(Number(await text(p, ".score.them .figure")) === themBefore, "the run was paid on the wake it was heard");
      await tick(p, 800);
      await until(p, "the run to be paid", 8000, async () => Number(await text(p, ".score.them .figure")) === themBefore + stood);
      assert(/fez a mão/.test(await text(p, ".talk")), `the score line did not replace the run: ${await text(p, ".talk")}`);
      await tick(p, 600);
      assert(await attr(p, ".hand", "data-round-id") === handId, "the resolved hand was dealt over before it could be read");
      await tick(p, 2400);
      await until(p, "the next hand", 8000, async () =>
        (await attr(p, ".hand", "data-round-id")) !== handId && (await count(p, ".seat-row.mine .card")) === 3);
      assert((await attr(p, ".shout", "data-state")) !== "live", "the run shout remained live into the next hand");
    },
  },
  {
    id: "the answers say what they cost, and the call is shouted",
    accepts: ["accept-truco-call", "accept-raise-ladder", "accept-stake-badge"],
    run: async (p) => {
      // The prices under the three plates are arithmetic on two fields of the
      // round, written by the dealer on each redraw: a redraw that skips them
      // leaves the last call's prices under this call's words, and no binding
      // catches it. The shout fires off a transition the dealer keeps in memory
      // (asked: nobody -> a seat); a dealer that compared against the row
      // instead would either shout on every redraw or never.
      // Tião calls on the first hand of seed 2, under paulista: 1 -> 3 -> 6.
      await seatedAt(p, 2);
      const LADDER = [1, 3, 6, 9, 12];
      const WORD: Record<number, string> = { 3: "TRUCO!", 6: "SEIS!", 9: "NOVE!", 12: "DOZE!" };
      const above = (r: number) => LADDER[LADDER.indexOf(r) + 1];
      const calling = forTable(60000);
      let asked = 0;
      while (calling()) {
        if ((await attr(p, ".play", "data-phase")) === "raised" &&
            (await count(p, '.log li[data-kind=truco][data-seat^=eles]')) > 0) {
          asked = Number(await attr(p, ".hand", "data-rung"));
          break;
        }
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) {
          await playOne(p).catch(() => {});
        }
        await tick(p, 300);
        await sleep(20);
      }
      assert(asked > 0, "Tião never called on seed 2");
      const stood = Number(await attr(p, ".hand", "data-stake"));
      assert(await attr(p, ".stake", "data-stake") === String(stood), "the badge and the round disagree on what stands");
      // What accepting costs is a catalogue key with a plural arm, and the
      // terminal picks the arm off the rung (messages/*.json worth_points):
      // pt-BR spells one tento and many.
      const priced = `vale ${asked} ${asked === 1 ? "ponto" : "pontos"}`;
      assert((await text(p, "#btn-accept small")).trim() === priced, `accept is priced ${await text(p, "#btn-accept small")}, the call is ${asked}`);
      assert((await text(p, "#btn-run small")).trim() === `eles levam ${stood}`, `run is priced ${await text(p, "#btn-run small")}, the hand stands at ${stood}`);
      const climb = above(asked);
      if (climb === undefined) {
        assert(await p.locator("#btn-raise").isDisabled(), "the ladder offers a rung past twelve");
        assert((await text(p, "#btn-raise b")).trim() === "NO MÁXIMO", "the ceiling is not named");
      } else {
        assert((await text(p, "#btn-raise b")).trim() === WORD[climb], `the climb says ${await text(p, "#btn-raise b")}, the rung above ${asked} is ${WORD[climb]}`);
        assert((await text(p, "#btn-raise small")).trim() === `sobe pra ${climb}`, "the climb is not priced");
      }
      // Their call, shouted from their side, in the rung's own word.
      assert(await attr(p, ".shout", "data-state") === "live", "the call was not shouted");
      assert(await attr(p, ".shout", "data-from") === "them", "the shout came from the wrong side");
      const shouted = (await text(p, ".shout")).replace(/\s+/g, "");
      assert(shouted === WORD[asked], `the shout says ${shouted}, the call was ${WORD[asked]}`);
      // Climbing back is shouted from ours, in the word of the rung above.
      if (climb !== undefined) {
        await p.locator("#btn-raise").click();
        await until(p, "our climb to reach the log", 8000, async () =>
          (await count(p, '.log li[data-kind=truco][data-seat=you]')) > 0);
        assert(await attr(p, ".shout", "data-from") === "us", "our climb was not shouted from our side");
        const back = (await text(p, ".shout")).replace(/\s+/g, "");
        assert(back === WORD[climb], `we shouted ${back}, the climb was ${WORD[climb]}`);
      }
    },
  },
  {
    id: "a seeded table replays exactly",
    accepts: ["accept-fresh-shuffle"],
    run: async (p) => {
      const base = origin(p);
      const dealt = async (seed: string) => {
        // The same seed deals the same hand only from the same state: the
        // match is device-durable, so a leftover one would make this the
        // second hand of an old sitting rather than the first of a new one.
        await p.goto(`${base}/?seed=${seed}&${TEMPO}`, { waitUntil: "domcontentloaded" });
        await resetTable(p);
        await p.reload({ waitUntil: "domcontentloaded" });
        await until(p, "a seeded hand", 20000, async () => {
          if ((await count(p, ".seat-row.mine .card")) !== 3) return false;
          const id = await attr(p, ".matchbox", "data-match-id");
          const roundAttr = await attr(p, "#seat-you .card", "data-round");
          return id !== null && id !== "" && roundAttr !== null && roundAttr.startsWith(id);
        });
        return await hand(p);
      };
      const first = await dealt("7");
      const again = await dealt("7");
      const other = await dealt("8");
      assert(first === again, `the same seed dealt two different hands: ${first} vs ${again}`);
      assert(first !== other, `two seeds dealt the same hand: ${first}`);
    },
  },
  {
    id: "both appearances render the same table",
    accepts: ["accept-dark-twin"],
    run: async (p) => {
      const ink = async () =>
        await p.locator(".screen").first().evaluate((el: Element) => getComputedStyle(el).color);
      const cloth = async () =>
        await p.locator(".mat").first().evaluate((el: Element) =>
          getComputedStyle(el).getPropertyValue("--cloth").trim()
        );
      await p.emulateMedia({ colorScheme: "light" });
      const lightInk = await ink();
      const lightCloth = await cloth();
      await p.emulateMedia({ colorScheme: "dark" });
      const darkInk = await ink();
      const darkCloth = await cloth();
      await p.emulateMedia({ colorScheme: "light" });
      assert(lightInk !== darkInk, `the ink did not change appearance: ${lightInk}`);
      // The cloth is a material, not a background: a checked plastic cloth is
      // the same cloth at night (ir decision-11), so the twin must NOT move it.
      assert(lightCloth === darkCloth, `the cloth changed with the appearance: ${lightCloth} vs ${darkCloth}`);
      assert((await count(p, ".seat-row.mine .card")) === 3, "the dark table lost its hand");
    },
  },
  {
    id: "the table owes the network nothing",
    accepts: ["accept-offline"],
    run: async (p) => {
      const seen: string[] = [];
      const listener = (r: { url: () => string }) => seen.push(r.url());
      await p.context().setOffline(true);
      try {
        p.on("request", listener);
        await playOne(p);
        await tick(p, 2500);
        await sleep(20);
        p.off("request", listener);
        // Long-poll shape requests belong to the terminal's sync plane, which a
        // tab-path app never uses; anything else here is the app fetching.
        const app = seen.filter((u) => !u.includes("/v1/shape") && !u.startsWith("data:"));
        assert(app.length === 0, `the table made ${app.length} request(s): ${app.slice(0, 3).join(", ")}`);
      } finally {
        await p.context().setOffline(false);
      }
    },
  },
];

async function main(): Promise<number> {
  const { chromium } = await import("npm:playwright@1.61.1");
  const base = await baseUrl(APP);
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  // Every case below reads the table in Brazilian Portuguese, and an
  // unprefixed address takes its language from Accept-Language — so the driver
  // states the reader it is rather than inheriting the runner's.
  const context = await browser.newContext({
    locale: "pt-BR",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (m: { type: () => string; text: () => string }) => {
    if (m.type() === "error" && !m.text().includes("ERR_INTERNET_DISCONNECTED")) errors.push(m.text());
  });

  let failed = 0;
  const filter = Deno.args[1];
  const cases = filter ? CASES.filter((c) => c.id.includes(filter)) : CASES;
  try {
    for (const c of cases) {
      try {
        // Every case starts from a dealt table. Cases that share a page share
        // its state, and a case that fails because the one before it left a
        // raise pending is a false report about the app.
        await freshTable(page, base);
        errors.length = 0;
        await c.run(page);
        console.log(`PASS  ${c.id}  [${c.accepts.join(" ")}]`);
      } catch (err) {
        failed++;
        console.log(`FAIL  ${c.id}  [${c.accepts.join(" ")}]\n      ${err instanceof Error ? err.message : err}`);
        // A failed case leaves the table wherever it broke; the next case
        // starts from a fresh one so one failure does not cascade.
        await freshTable(page, base).catch(() => {});
      }
    }
  } finally {
    await browser.close();
  }

  if (errors.length > 0) {
    failed++;
    console.log(`FAIL  the console stayed clean\n      ${errors.slice(0, 5).join("\n      ")}`);
  }
  console.log(failed === 0 ? `\nacceptance: ${CASES.length}/${CASES.length} PASS` : `\nacceptance: ${failed} failing`);
  return failed === 0 ? 0 : 1;
}

if (import.meta.main) Deno.exit(await main());
