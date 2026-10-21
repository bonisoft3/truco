// The acceptance driver: the brief's checklist walked against the running
// table, in the browser, with the cluster up.
//
// It is declared in program.cue as a build check, so the integrate verb reaches
// it: a check no verb runs does not exist. Each case cites the acceptance id
// it realizes, and the ids are the ones in acceptance.md — a case that cannot
// fail is not a case, so every assertion names a value the table computes
// rather than a value it merely displays.

import { baseUrl } from "omnishell/base-url.ts";

type Case = { id: string; accepts: string[]; serial?: boolean; run: (p: Page) => Promise<void> };
// deno-lint-ignore no-explicit-any
type Page = any;
// deno-lint-ignore no-explicit-any
type Route = any;
// deno-lint-ignore no-explicit-any
type Request = any;

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
const carried = new WeakMap<object, number>();
const tick = async (p: Page, ms = 100) => {
  carried.set(p, (carried.get(p) ?? 0) + ms);
  return await p.evaluate(async (n: number) => {
    const w = globalThis as {
      __prontoClock?: { advance: (n: number) => number; due: () => { in: number }[] };
      __prontoBusy?: () => { regions: number; waits: number };
    };
    const clock = w.__prontoClock;
    if (!clock) return 0;
    const settle = async (turns: number) => {
      const deadline = performance.now() + 50;
      let calm = 0;
      while (performance.now() < deadline) {
        await new Promise((r) => setTimeout(r, 0));
        if ((w.__prontoBusy?.().regions ?? 0) === 0) {
          if (++calm >= turns) break;
        } else {
          calm = 0;
        }
      }
    };
    if ((w.__prontoBusy?.().regions ?? 0) > 0) await settle(2);
    const hadWaits = clock.due().length > 0;
    const fired = (clock.due()[0]?.in ?? Infinity) <= n;
    const remaining = clock.advance(n);
    if (fired || (w.__prontoBusy?.().regions ?? 0) > 0) await settle(2);
    else if (!hadWaits && remaining === 0) await new Promise((r) => setTimeout(r, 20));
    else await settle(1);
    return remaining;
  }, ms).catch(() => 0);
};

/** A budget in the table's own seconds, per `carried`. The wall cap is a
    backstop against a table that has stopped, not the budget. */
function forTable(p: Page, ms: number) {
  const spent = (carried.get(p) ?? 0) + ms;
  const wall = Date.now() + 240_000;
  return () => (carried.get(p) ?? 0) < spent && Date.now() < wall;
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
    if (manual) await tick(p);
    else await sleep(20);
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

/** Arrive at `url` with nothing kept from an earlier sitting. The table is
    cleared from a page of the origin that runs no store: a running screen
    flushes its rows behind a clear, and the reload then resumes the sitting
    the case meant to leave. */
async function freshStart(p: Page, url: string) {
  await p.goto(`${new URL(url).origin}/robots.txt`, { waitUntil: "domcontentloaded" });
  await p.evaluate(() => localStorage.clear());
  await p.goto(url, { waitUntil: "domcontentloaded" });
}

/** The game on the table, as the arena keeps it: on the match row it stores
    on the device, beside the seed it was dealt from. */
type Game = { seed: string; revision: number; state: Record<string, unknown> & { phase: string; hand_no: number } };
async function storedGame(p: Page): Promise<Game | null> {
  return await p.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("mecha:match") ?? "{}") as Record<string, { data: { game?: string } }>;
    const table = Object.values(rows)[0]?.data.game;
    return table === undefined ? null : JSON.parse(table);
  });
}

/** The door this page came through. A route is a real path, so the origin is
    the whole of what an address is composed against. */
const origin = (p: Page) => new URL(p.url()).origin;

async function freshTable(p: Page, base: string, clock: "fast" | "real" = "fast") {
  await freshStart(p, `${base}/${clock === "fast" ? `?${TEMPO}` : ""}`);
  await until(p, "a dealt hand", 20000, () => dealtHand(p));
}

/** Three cards in your hand, dealt by the game on the table: a hand is the
    game's, and the game is named by the seat's draw. */
async function dealtHand(p: Page, hand?: number) {
  if ((await count(p, ".seat-row.mine .card")) !== 3) return false;
  const seed = await attr(p, ".matchbox", "data-seed");
  const roundAttr = await attr(p, "#seat-you .card", "data-round");
  return seed !== null && seed !== "" && roundAttr !== null &&
    roundAttr.startsWith(`g${seed}/`) && (hand === undefined || roundAttr === `g${seed}/h${hand}`);
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

/** Sit down at a stated table. Every draw the terminal makes follows from the
    address's seed, so the same seed and the same picks deal the same game,
    and a case that needs a call can have one by naming the table rather than
    by playing until somebody obliges, which is a wait on a coin rather than
    on the table. The picks are made in a fixed order, each a draw of its own. */
type Rules = { variant?: string; seats?: string; opponent?: string };
/** The seeds the seeded cases sit at, each named for what it promises. A
    seed names the arena's own draw stream (the terminal draws per actor), so
    a promise holds whatever the bar did first. Found by search: a seed that
    stops keeping its promise is replaced, not reasoned about. */
const SEEDS = {
  /** Paulista against Tião: he calls on the first hand. */
  tiaoCalls: 2,
  /** Mineiro 2v2 against Tião: a sitting that reaches the mão de dez. */
  maoDeDez: 2,
  /** Mineiro against Tião: a sitting that reaches the mão de ferro. */
  maoDeFerro: 2,
  /** Truc and mineiro against Zé Nezinho: a call is heard, and a last hand is reached. */
  talk: 3,
  /** Mineiro against Nezinho, second hand: the house leads, you hold the led rank, neither a manilha. */
  tie: 8,
  /** Douradinha with three pairs: a table that plays. */
  threePairs: 7,
  /** Two seeds that deal different hands. */
  replay: ["7", "8"],
};
const TIAO_CALLS: Rules = { variant: "paulista", opponent: "tiao" };
async function seatedAt(p: Page, seed: number, rules: Rules = {}, clock: "fast" | "real" = "fast") {
  await freshStart(p, `${origin(p)}/?seed=${seed}${clock === "fast" ? `&${TEMPO}` : ""}`);
  await until(p, "a seeded hand", 20000, () => dealtHand(p));
  // A pick that moves the rules deals a new game, so each is waited on by the
  // seed changing: the old game's hand would pass for the new one's.
  for (const picker of ["variant", "seats", "opponent"] as const) {
    const opt = rules[picker];
    if (opt === undefined || (await attr(p, ".matchbox", `data-${picker}`)) === opt) continue;
    const before = await attr(p, ".matchbox", "data-seed");
    await pick(p, picker, opt);
    await until(p, `a game dealt for ${opt}`, 20000, async () =>
      (await attr(p, ".matchbox", "data-seed")) !== before && await dealtHand(p)).catch(async (err) => {
      const now = await p.evaluate(() => ({
        seed: document.querySelector(".matchbox")?.getAttribute("data-seed"),
        opponent: document.querySelector(".matchbox")?.getAttribute("data-opponent"),
        round: document.querySelector("#seat-you .card")?.getAttribute("data-round"),
        cards: document.querySelectorAll(".seat-row.mine .card").length,
      }));
      throw new Error(`${err.message}: the seed was ${before}, the table now ${JSON.stringify(now)}`);
    });
  }
}

/** Play the hand on the table out: your cards as they come, every call
    accepted, until the game stands between hands. */
async function toHandOver(p: Page) {
  const playing = forTable(p, 90000);
  while (playing()) {
    if ((await storedGame(p))?.state.phase === "hand_over") return;
    if (await p.locator("#btn-brink-play").isVisible()) await p.locator("#btn-brink-play").click().catch(() => {});
    await answerIfRaised(p);
    if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p).catch(() => {});
    await tick(p, 300);
  }
  throw new Error(`the hand never ended: ${(await storedGame(p))?.state.phase}`);
}

/** Play on until the match is over. */
async function toFinished(p: Page) {
  const playing = forTable(p, 120000);
  while (playing()) {
    if ((await storedGame(p))?.state.phase === "finished") return;
    if (await p.locator("#btn-brink-play").isVisible()) await p.locator("#btn-brink-play").click().catch(() => {});
    await answerIfRaised(p);
    if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p).catch(() => {});
    await tick(p, 300);
  }
  throw new Error(`the match never ended: ${(await storedGame(p))?.state.phase}`);
}

/** The score a hand is dealt at, set between hands: the stored game is given
    the score and the machine deals the next hand from it, so whatever a score
    decides at the deal — a mão de dez, a mão de ferro — is the machine's. */
async function scoredAt(p: Page, score: { us: number; them: number; usGames?: number; themGames?: number }) {
  await toHandOver(p);
  const hand = (await storedGame(p))!.state.hand_no + 1;
  await p.evaluate((score: { us: number; them: number; usGames?: number; themGames?: number }) => {
    const rows = JSON.parse(localStorage.getItem("mecha:match")!) as Record<string, { data: { game: string } }>;
    const row = Object.values(rows)[0];
    const game = JSON.parse(row.data.game);
    game.state.score_a = score.us;
    game.state.score_b = score.them;
    if (score.usGames !== undefined) game.state.games_a = score.usGames;
    if (score.themGames !== undefined) game.state.games_b = score.themGames;
    row.data.game = JSON.stringify(game);
    localStorage.setItem("mecha:match", JSON.stringify(rows));
  }, score);
  await p.reload({ waitUntil: "domcontentloaded" });
  await until(p, `hand ${hand} dealt at ${score.us}–${score.them}`, 20000, () => dealtHand(p, hand));
  assert(await count(p, ".play") === 1 && await count(p, ".hand") === 1, "the previous hand leaves duplicate controls or phase data");
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
      // The felt is the board: a region added beside it takes a grid row of
      // its own, empty or not, and the table shrinks to what is left.
      const felt = await p.evaluate(() =>
        document.querySelector(".mat")!.getBoundingClientRect().height /
        document.querySelector(".board")!.getBoundingClientRect().height);
      assert(felt > 0.95, `the felt takes ${Math.round(felt * 100)}% of the board`);
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
      const playing = forTable(p, 45000);
      let sitting = await attr(p, ".matchbox", "data-seed");
      let before = await total();
      while (playing()) {
        await answerIfRaised(p);
        const now = await attr(p, ".matchbox", "data-seed");
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
      const circuit = forTable(p, 45000);
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
      const before = await attr(p, ".matchbox", "data-seed");
      const hand = await attr(p, ".matchbox", "data-hand");
      assert((before ?? "") !== "", "the table has no match to keep");
      // No clear: the point is the sitting that survives the tab.
      await p.reload({ waitUntil: "domcontentloaded" });
      await until(p, "the table again", 20000, async () => (await count(p, ".seat-row.mine .card")) > 0);
      assert(
        (await attr(p, ".matchbox", "data-seed")) === before,
        `the reload opened a second table: ${before} then ${await attr(p, ".matchbox", "data-seed")}`,
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
      const playing = forTable(p, 45000);
      while (playing()) {
        await answerIfRaised(p);
        if ((await total()) > before) break;
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p);
        await tick(p, 500);
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
      await seatedAt(p, SEEDS.tiaoCalls, TIAO_CALLS);
      const calling = forTable(p, 60000);
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
      const sitting = await attr(p, ".matchbox", "data-seed");
      const playing = forTable(p, 60000);
      // The banner lives only for the pause between hands, shorter than a
      // stride at speed — it is read inside the loop or not at all.
      let worth = 0;
      let ended = false;
      while (playing()) {
        await answerIfRaised(p);
        const m = /\+(\d+)/.exec(await text(p, ".talk").catch(() => ""));
        if (m !== null) worth = Number(m[1]);
        if ((await attr(p, ".matchbox", "data-seed")) !== sitting) { ended = true; break; }
        if ((await total()) > before) break;
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) {
          await playOne(p).catch(() => {});
        }
        await tick(p, 500);
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
      // Eleven all at paulista: whoever takes the hand takes the match.
      await seatedAt(p, SEEDS.tiaoCalls, TIAO_CALLS);
      await scoredAt(p, { us: 11, them: 11, usGames: 1, themGames: 1 });
      await toFinished(p);
      const won = await attr(p, ".matchbox", "data-seed");
      await p.reload({ waitUntil: "domcontentloaded" });
      await until(p, "a fresh sitting to open itself", 20000, async () =>
        await dealtHand(p) && (await attr(p, ".matchbox", "data-seed")) !== won);
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
      await seatedAt(p, SEEDS.maoDeDez, { variant: "mineiro", seats: "2v2", opponent: "tiao" });
      await scoredAt(p, { us: 10, them: 0 });
      await until(p, "the brink offered", 20000, () => p.locator("#btn-brink-play").isVisible());
      // The rail, the felt and each seat's hand are regions of their own, and
      // the felt can draw the new hand a pass after the rail does.
      await until(p, "the felt on the new hand", 5000, async () =>
        (await count(p, ".hand")) === 1 && (await count(p, '.seat-row[data-seat="parca"] .card-back')) === 3);
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
      await seatedAt(p, SEEDS.maoDeFerro, { variant: "mineiro", opponent: "tiao" });
      await scoredAt(p, { us: 10, them: 10 });
      await until(p, "a playable blind hand", 20000, async () =>
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
      const seated = () => dealtHand(p);
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
      await seatedAt(p, SEEDS.talk, { variant: "truc", opponent: "nezinho" });
      await p.goto(`${origin(p)}/ar?${TEMPO}`, { waitUntil: "domcontentloaded" });
      await until(p, "a truc hand you lead", 20000, async () =>
        (await attr(p, ".matchbox", "data-variant")) === "truc" &&
        (await count(p, ".seat-row.mine .card:not([disabled])")) === 3);
      const said = (sel: string) => p.locator(sel).first().evaluate((el: Element) => (el.textContent ?? "").trim());
      assert((await said("#btn-accept b")) === "Quiero", `the Argentine page's answer reads "${await said("#btn-accept b")}"`);
      assert((await said("#btn-truco")) === "TRUC!", `the truc table's call reads "${await said("#btn-truco")}"`);

      // Mineiro on the Brazilian page, at its last hand: whoever takes the
      // match says so the way Minas does.
      await seatedAt(p, SEEDS.talk, { variant: "mineiro", opponent: "nezinho" });
      await scoredAt(p, { us: 10, them: 10, usGames: 1, themGames: 1 });
      const playing = forTable(p, 90000);
      while (playing() && (await attr(p, ".play", "data-phase")) !== "over") {
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p).catch(() => {});
        await tick(p, 300);
      }
      const shout = (await text(p, ".shout")).replace(/\s+/g, "");
      assert(["ÉNÓIS,SÔ!", "LEVAMO,UAI!"].includes(shout), `the mineiro table closed on "${shout}"`);
    },
  },
  {
    id: "a tie and the rodada that breaks it are laid side by side",
    accepts: ["accept-vaza-tie"],
    run: async (p) => {
      await seatedAt(p, SEEDS.tie, { variant: "mineiro", opponent: "nezinho" });
      await toHandOver(p);
      await until(p, "the house's lead on the second hand", 20000, async () =>
        await dealtHand(p, 2) && (await count(p, '.trick[data-t="1"] .played')) === 1);
      const led = p.locator('.trick[data-t="1"] .played .card').first();
      const rank = ((await led.getAttribute("data-card")) ?? "").slice(0, -1);
      assert((await led.getAttribute("data-manilha")) !== "yes", "the house led a manilha, which nothing ties");
      const twin = p.locator(`.seat-row.mine .card:not([disabled]):not([data-manilha="yes"])[data-card^="${rank}"]`);
      assert((await twin.count()) === 1, `no card of rank ${rank} in your hand to tie it`);
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
      await twin.click();
      await until(p, "both first cards down", 10000, async () => (await count(p, '.trick[data-t="1"] .played')) === 2);
      // The hybrid commits the last card and verdict together; their layout
      // settles on the browser's clock while the table's clock stays held.
      await until(p, "the tie", 10000, async () => (await attr(p, ".matcards", "data-v1")) === "tie");
      const tied = await laid(1);
      assert(tied.gap >= 0 && tied.square, `the tie lies ${tied.gap}px apart, square: ${tied.square}`);

      await until(p, "the second rodada to be yours", 10000, async () => {
        await answerIfRaised(p);
        return (await count(p, ".seat-row.mine .card:not([disabled])")) > 0;
      });
      await p.locator(".seat-row.mine .card:not([disabled])").first().click();
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
        await seatedAt(p, SEEDS.threePairs, { variant: "douradinha", seats: "2v2v2" });
        await until(p, "a dealt six-seat hand", 20000, async () =>
          (await attr(p, ".matchbox", "data-seats")) === "2v2v2" && await dealtHand(p));
        const inside = (sel: string) => p.evaluate((sel: string) => {
          const board = document.querySelector(".board")!.getBoundingClientRect();
          return [...document.querySelectorAll(sel)].every((e) => {
            const b = e.getBoundingClientRect();
            return b.left >= board.left - 1 && b.right <= board.right + 1;
          });
        }, sel);
        assert(await inside("#seat-you .card"), "your hand runs off the board at three pairs");
        const playing = forTable(p, 60000);
        while (playing() && (await count(p, '.trick[data-t="1"] .played')) < 6) {
          await answerIfRaised(p);
          if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p).catch(() => {});
          await tick(p, 300);
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
      await seatedAt(p, SEEDS.tiaoCalls, TIAO_CALLS);
      await scoredAt(p, { us: 11, them: 0, usGames: 1, themGames: 0 });
      const almost = await attr(p, ".matchbox", "data-seed");
      assert(await attr(p, ".score.us .jogos", "data-n") === "1", "the first won game is not marked on the board");
      // Eleven is paulista's brink, so the hand is the mão de onze and is
      // played only once you say so.
      // The brink hand and the ones after it to twelve: each raise answered
      // spends table seconds polling for the log, more on a slower browser,
      // and three hands at 11 ran the budget down to its last beats.
      const playing = forTable(p, 240000);
      while (playing()) {
        if ((await attr(p, ".play", "data-phase")) === "over") break;
        if (await p.locator("#btn-brink-play").isVisible()) await p.locator("#btn-brink-play").click();
        await answerIfRaised(p);
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p).catch(() => {});
        await tick(p, 300);
      }
      assert(await attr(p, ".play", "data-phase") === "over", "one point from twelve, the match never closed");
      assert(await attr(p, ".matchbox", "data-seed") === almost, "the won match left the table");
      assert(Number(await text(p, ".score.us .figure")) === 12, "the closing score is not on the board");
      assert(await attr(p, ".score.us .jogos", "data-n") === "2", "the second won game is not marked on the board");
      assert(/Partida sua/.test(await text(p, "#over-line")), "the table does not say who won");
      assert(await attr(p, ".shout", "data-state") === "live", "the partida closed without a shout");
      assert((await text(p, ".shout")).replace(/\s+/g, "") === "ÉNOSSA!", `the closing shout says ${await text(p, ".shout")}`);
      assert((await text(p, "#over-say")).trim().length > 0, "eles had nothing to say about losing");
      await p.locator("#btn-again").click();
      await until(p, "a fresh sitting", 20000, async () =>
        await dealtHand(p) && (await attr(p, ".matchbox", "data-seed")) !== almost);
      assert(await attr(p, ".matchbox", "data-status") === "playing", "the new sitting is not playing");
      assert(Number(await text(p, ".score.us .figure")) === 0, "the new sitting inherited the old score");
      assert(await attr(p, ".score.us .jogos", "data-n") === "0", "the new sitting inherited the old games");
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
        if (grew) {
          const layout = await p.evaluate(() => {
            const style = document.createElement("style");
            style.textContent = ".trick .played, .trick .card { rotate: 0deg !important; animation: none !important; transition: none !important; }";
            document.head.appendChild(style);
            try {
              const trick1 = document.querySelector<HTMLElement>('.trick[data-t="1"]')!;
              const c1 = trick1.querySelector<HTMLElement>(".played .card")!.getBoundingClientRect();
              const c2 = document.querySelector<HTMLElement>('.trick[data-t="2"] .played .card')!.getBoundingClientRect();
              const played = [...trick1.querySelectorAll<HTMLElement>(".played")];
              return {
                ratio: c2.height / c1.height,
                baseline: Math.abs(c1.bottom - c2.bottom),
                opacities: [...document.querySelectorAll<HTMLElement>(".trick .played .card")].map((c) => getComputedStyle(c).opacity),
                outcome: trick1.closest(".matcards")?.getAttribute("data-v1") ?? "",
                border: getComputedStyle(trick1).borderStyle,
                cards: played.map((el) => ({ winner: el.dataset.win === "yes", z: Number(getComputedStyle(el).zIndex) })),
              };
            } finally {
              style.remove();
            }
          });
          assert(layout.ratio >= 0.95 && layout.ratio <= 1.05, `trick card height ratio drifted: ${layout.ratio}`);
          assert(layout.baseline <= 20, `trick card baseline drifted by ${layout.baseline}px`);
          assert(layout.opacities.every((o: string) => o === "1"), `trick cards must be opaque: ${layout.opacities.join(",")}`);
          assert(layout.border === "none", `trick container border must be none, got ${layout.border}`);
          if (layout.outcome === "us" || layout.outcome === "them") {
            const winners = layout.cards.filter((c: { winner: boolean }) => c.winner).map((c: { z: number }) => c.z);
            const beaten = layout.cards.filter((c: { winner: boolean }) => !c.winner).map((c: { z: number }) => c.z);
            assert(Math.min(...winners) > Math.max(...beaten), `winning cards must stack above beaten cards: ${JSON.stringify(layout.cards)}`);
          } else {
            for (let i = 1; i < layout.cards.length; i++) {
              assert(layout.cards[i].z > layout.cards[i - 1].z, `tied trick stacks in play order: ${JSON.stringify(layout.cards)}`);
            }
          }
          return;
        }
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
      // Seated across from Tião on a shuffle he calls the first hand of: a
      // random deal against Zé, who calls only on a great hand, can run a
      // minute of real clock without a single call to observe.
      await seatedAt(p, SEEDS.tiaoCalls, TIAO_CALLS, "real");
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
      const playing = forTable(p, 45000);
      while (playing()) {
        await answerIfRaised(p);
        if ((await role()) !== first) break;
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p);
        await tick(p, 500);
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
      await seatedAt(p, SEEDS.tiaoCalls, TIAO_CALLS);
      const calling = forTable(p, 60000);
      let raised = false;
      while (calling()) {
        if ((await attr(p, ".play", "data-phase")) === "raised" &&
            (await count(p, '.log li[data-kind=truco][data-seat^=eles]')) > 0) { raised = true; break; }
        if ((await count(p, ".seat-row.mine .card:not([disabled])")) > 0) await playOne(p).catch(() => {});
        await tick(p, 300);
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
      await tick(p, 500);
      await until(p, "the run to uncover the paid result", 8000, async () =>
        (await attr(p, ".shout", "data-state")) !== "live" &&
        await p.locator(".table-instruction-bar").evaluate((el: HTMLElement) => Number(getComputedStyle(el).opacity) > 0));
      assert(await attr(p, ".hand", "data-round-id") === handId, "the run faded only when the next hand arrived");
      await tick(p, 1900);
      await until(p, "the next hand", 8000, async () =>
        (await attr(p, ".hand", "data-round-id")) !== handId && (await count(p, ".seat-row.mine .card")) === 3);
      assert((await attr(p, ".shout", "data-state")) !== "live", "the run shout remained live into the next hand");
    },
  },
  {
    id: "the answers say what they cost, and the call is shouted",
    accepts: ["accept-truco-call", "accept-raise-ladder", "accept-stake-badge"],
    run: async (p) => {
      // Each call must replace the previous prices and shout from its own side.
      // Tião calls on the first hand, under paulista: 1 -> 3 -> 6.
      await seatedAt(p, SEEDS.tiaoCalls, TIAO_CALLS);
      const LADDER = [1, 3, 6, 9, 12];
      const WORD: Record<number, string> = { 3: "TRUCO!", 6: "SEIS!", 9: "NOVE!", 12: "DOZE!" };
      const above = (r: number) => LADDER[LADDER.indexOf(r) + 1];
      const calling = forTable(p, 60000);
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
        await freshStart(p, `${base}/?seed=${seed}&${TEMPO}`);
        await until(p, "a seeded hand", 20000, () => dealtHand(p));
        return await hand(p);
      };
      const first = await dealt(SEEDS.replay[0]);
      const again = await dealt(SEEDS.replay[0]);
      const other = await dealt(SEEDS.replay[1]);
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
      // A request the worker answers from its copy never reaches the network;
      // one it does not, or that nothing answers, does.
      const seen: string[] = [];
      const listener = (r: Request) => void r.response().then((answer) => {
        if (!answer?.fromServiceWorker()) seen.push(r.url());
      });
      await p.context().setOffline(true);
      try {
        p.on("request", listener);
        await playOne(p);
        await tick(p, 2500);
        p.off("request", listener);
        // Shapes and the token that authorizes them are the terminal's sync
        // plane, which the bar's rows ride; anything else is the app fetching.
        const app = seen.filter((u) => !u.includes("/v1/shape") && !u.endsWith("/auth/shape") && !u.startsWith("data:"));
        assert(app.length === 0, `the table made ${app.length} request(s): ${app.join(", ")}`);
      } finally {
        await p.context().setOffline(false);
      }
    },
  },
  {
    id: "a name saved in the bar is the bar's after a reload",
    accepts: ["accept-bar-name"],
    run: async (p) => {
      await nameInBar(p, "Davi");
      await p.reload({ waitUntil: "domcontentloaded" });
      await openBar(p);
      await until(p, "the saved name in the bar", 10000, async () => (await p.locator("#my-handle-input").inputValue()) === "Davi");
    },
  },
  {
    id: "going online lights the pill and lists you in another reader's bar",
    accepts: ["accept-bar-online"],
    serial: true,
    run: async (p) => {
      await realTable(p);
      const ana = runName("Ana");
      await goOnline(p, ana);
      // Lit is the pulse running; its colour depends on the frame sampled.
      const lit = await p.locator("#btn-open-online .online-pulse").evaluate((el: Element) => getComputedStyle(el).animationName);
      assert(lit === "pulse-dot", `the pill's dot runs "${lit}" while you are online`);
      const other = await reader(p);
      try {
        await openBar(other);
        await until(other, "Ana in the other reader's bar", 20000, async () =>
          (await other.locator("#lobby-players-list .lobby-player-row", { hasText: ana }).count()) === 1);
      } finally {
        await other.context().close();
      }
    },
  },
  {
    id: "the bar holds still while it connects and fills",
    accepts: ["accept-bar-still"],
    serial: true,
    run: async (p) => {
      await realTable(p);
      await p.click("#btn-open-online");
      const where = () => p.locator("#modal-online .modal-sec, #modal-online .lobby-identity-bar").evaluateAll((els: Element[]) =>
        els.map((el) => Math.round(el.getBoundingClientRect().top)).join(","));
      const opened = await where();
      await until(p, "the bar connected", 10000, async () => (await count(p, "#btn-toggle-online")) === 1);
      const other = await reader(p);
      try {
        await goOnline(other, runName("Bia"));
        await until(p, "Bia listed", 20000, async () => (await count(p, "#lobby-players-list .lobby-player-row")) > 0);
      } finally {
        await other.context().close();
      }
      assert((await where()) === opened, `the bar moved as it filled: ${opened} then ${await where()}`);
      const vp = p.viewportSize()!;
      await p.setViewportSize({ width: vp.width, height: 500 });
      try {
        // [popover] sits in the fixed top layer, so a short window only reaches
        // the bottom of the bar when the modal frame itself scrolls.
        const scrolled = await p.locator("#modal-online .boteco-modal-frame").evaluate((frame: HTMLElement) => {
          const overflows = frame.scrollHeight > frame.clientHeight && getComputedStyle(frame).overflowY === "auto";
          frame.scrollTop = frame.scrollHeight;
          const join = frame.querySelector("#btn-submit-join")!.getBoundingClientRect();
          return { overflows, joinBottom: Math.round(join.bottom) };
        });
        assert(scrolled.overflows && scrolled.joinBottom <= 500, `short viewport must scroll the bar modal into view: ${JSON.stringify(scrolled)}`);
      } finally {
        await p.setViewportSize(vp);
      }
    },
  },
  // A browser that kept an earlier deployment ran the scripts it had kept
  // against the markup served now, and the bar's switch never drew. The
  // earlier deployment is served first: this one's entry, its map naming an
  // interpreter that says it ran, at an address of its own. Then the door
  // serves this one, and a reload must end running it.
  {
    id: "a deployment newer than the browser's copy is the one that runs",
    accepts: ["accept-upgrade"],
    run: async (p) => {
      const MAP = /(<script\b[^>]*\bid="pronto-assets"[^>]*>)([\s\S]*?)(<\/script>)/;
      const sha = async (text: string) => `'sha256-${btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))))}'`;
      const now = JSON.parse(MAP.exec(await p.evaluate(() => fetch("/", { cache: "no-store" }).then((r) => r.text())))![2]) as { imports: Record<string, string> };
      const chrome = now.imports["/omnishell/interpreter/chrome.js"];
      const marked = await p.evaluate((url) => fetch(url).then((r) => r.text()), chrome) + "\nglobalThis.__earlierDeployment = true;\n";
      const markedAt = chrome.replace(/_immutable-[0-9a-f]{64}-/, `_immutable-${"e".repeat(64)}-`);
      // A browser whose first visit was the earlier deployment.
      const context = await newContext(p.context().browser());
      try {
        const q = await context.newPage();
        const earlier = () => q.evaluate(() => (globalThis as Record<string, unknown>).__earlierDeployment === true);
        // The page restarts into a deployment, so a read can meet the
        // navigation: that is "not yet", and anything else is a failure.
        const settled = (read: () => Promise<boolean>) => async () => {
          try {
            return await read();
          } catch (error) {
            if (/Execution context was destroyed/.test(String(error))) return false;
            throw error;
          }
        };
        const isEntry = (url: URL) => url.pathname === "/";
        const entry = async (route: Route) => {
          const served = await route.fetch();
          const html = await served.text();
          const map = MAP.exec(html)![2];
          const then = JSON.stringify({ ...JSON.parse(map), imports: { ...JSON.parse(map).imports, "/omnishell/interpreter/chrome.js": markedAt } });
          // The entry names its map's hash in its policy, the header's and its own.
          const [was, is] = [await sha(map), await sha(then)];
          const headers = { ...served.headers() };
          headers["content-security-policy"] = headers["content-security-policy"].replace(was, is);
          await route.fulfill({ response: served, headers, body: html.replace(MAP, (_, open, _map, close) => open + then + close).replace(was, is) });
        };
        const interpreter = (route: Route) => route.fulfill({ contentType: "text/javascript", body: marked });
        await context.route(isEntry, entry);
        await context.route(`**${markedAt}`, interpreter);
        // The app's origin, by a file that registers no worker.
        await q.goto(`${origin(p)}/robots.txt`);
        await realTable(q);
        await until(q, "the earlier deployment's worker in control", 10000, async () => await q.evaluate(() => navigator.serviceWorker.controller !== null));
        await q.reload({ waitUntil: "domcontentloaded" });
        // A served document shows the hand before any module has run.
        await until(q, "the earlier deployment running while it is the one served", 20000, settled(async () => await earlier() && await dealtHand(q)));
        // The deployment: the door serves this one from here on.
        await context.unroute(isEntry, entry);
        await q.reload({ waitUntil: "domcontentloaded" });
        await until(q, "the deployment served now running", 30000, settled(async () => !(await earlier()) && await dealtHand(q)));
      } finally {
        await context.close();
      }
    },
  },
  {
    id: "an accepted challenge seats both players at one table",
    accepts: ["accept-bar-challenge"],
    serial: true,
    run: async (p) => {
      await realTable(p);
      const ana = runName("Ana"), bia = runName("Bia");
      await goOnline(p, ana);
      const other = await reader(p);
      try {
        await goOnline(other, bia);
        const row = other.locator("#lobby-players-list .lobby-player-row", { hasText: ana });
        await until(other, "Ana to challenge", 20000, async () => (await row.count()) === 1);
        await row.locator(".btn-challenge").click();
        await until(other, "the challenger waiting", 10000, async () => await other.locator(".challenge-waiting-overlay").isVisible());
        const banner = p.locator(".incoming-challenge-banner", { hasText: bia });
        await until(p, "Bia's challenge", 20000, async () => await banner.isVisible());
        await banner.locator(".btn-challenge-accept").click();
        // No table of its own to go to: each is seated where they were, at the
        // arena, facing the other by name.
        // The name across is the other's voice, which sits after their seat does.
        for (const [who, page, them] of [["Ana", p, bia], ["Bia", other, ana]] as const) {
          await until(page, `${who} seated with a hand, facing ${them}`, 20000, async () =>
            (await count(page, '.matchbox[data-opponent="online"]')) === 1 && (await count(page, "#seat-you .card")) === 3 &&
            (await page.locator("#opponent-display-name .as-handle").textContent())?.trim() === them);
          assert(new URL(page.url()).pathname === "/", `${who} left the arena for ${page.url()}`);
        }
      } finally {
        await other.context().close();
      }
    },
  },
  {
    id: "your quick shout stays in your speech bubble",
    accepts: ["accept-instant-table"],
    run: async (p) => {
      await freshTable(p, origin(p));
      await p.click("#shout-chama");
      await until(p, "your quick shout", 2000, async () =>
        await attr(p, "#player-dialogue-wrap", "data-active") === "yes");
      assert(await p.locator("#player-talk").isVisible(), "your quick shout hides its bubble");
      assert(!await p.locator(".shout").isVisible(), "your quick shout duplicates the central overlay");
      assert(await p.locator(".table-instruction-bar").evaluate((el: HTMLElement) =>
        Number(getComputedStyle(el).opacity) > 0), "your quick shout hides the table instruction");
      const animation = () => p.locator("#player-dialogue-wrap").evaluate((el: HTMLElement) => getComputedStyle(el).animationName);
      const first = await animation();
      await p.click("#shout-manda");
      await until(p, "the repeated shout to animate again", 2000, async () => await animation() !== first);
      await p.click("#btn-truco");
      await until(p, "the quick shout to expire after raising", 3000, async () =>
        await attr(p, "#player-dialogue-wrap", "data-active") === "no");
      assert(await attr(p, ".shout", "data-kind") !== "quick", "the quick shout masked the wager or its answer");
    },
  },
  {
    id: "the storyboard poses one felt with distinct actions, verdict and picker states",
    accepts: ["accept-instant-table", "accept-truco-call", "accept-match-over"],
    run: async (p) => {
      await p.goto(`${origin(p)}/?storybook`, {waitUntil: "domcontentloaded"});
      await p.locator("#arena-picking .screen[data-storybook]").waitFor();
      assert(await p.locator("#arena-empty .play").count() === 0, "the empty frame invents a hand");
      for (const state of ["populated", "raised", "resolved", "match-over", "picking"]) {
        assert(await p.locator(`#arena-${state} .play`).count() === 1, `${state} duplicates the felt`);
        assert(await p.locator(`#arena-${state} #btn-truco`).count() === 1, `${state} duplicates control IDs`);
      }
      assert(await p.locator("#arena-raised .answers").isVisible(), "the raised frame hides its answers");
      assert(await p.locator("#arena-resolved #btn-next").isVisible(), "the resolved frame hides its next hand");
      assert(await p.locator("#arena-match-over .over").isVisible(), "the finished frame hides its verdict");
      assert(await p.locator('#arena-picking [data-picker="theme"] .picker-list').isVisible(), "the picking frame hides its menu");
    },
  },

];

/** A closed reader stays listed in the bar until its lease lapses on the
    ticker, so each case's players are named for the case and this run. */
const RUN = Date.now().toString(36).slice(-4);
let named = 0;
const runName = (name: string) => `${name}${RUN}${named++}`;

/** A reader on the real clock. A presence lease lapses on the server's time
    and is renewed on the terminal's, so a reader held at the driver's clock
    drops out of the bar while the driver waits on another. */
async function realTable(p: Page) {
  await p.goto(`${origin(p)}/`, { waitUntil: "domcontentloaded" });
  await until(p, "a dealt hand", 20000, () => dealtHand(p));
}

/** The bar is the arena's popover, opened by the Mesa Online pill. */
async function openBar(p: Page) {
  await p.click("#btn-open-online");
  await until(p, "the bar open", 5000, async () => await p.locator("#modal-online").isVisible());
}

async function nameInBar(p: Page, name: string) {
  await openBar(p);
  // The comanda has no save button: Enter writes the name, as leaving the field does.
  await p.fill("#my-handle-input", name);
  await p.press("#my-handle-input", "Enter");
}

async function goOnline(p: Page, name: string) {
  await nameInBar(p, name);
  await until(p, "the switch", 10000, async () => (await count(p, "#btn-toggle-online")) === 1);
  // The switch toggles, so a reader already online is left on.
  if ((await attr(p, "#btn-toggle-online", "aria-checked")) !== "true") await p.click("#btn-toggle-online");
  await until(p, "the switch on", 10000, async () => (await attr(p, "#btn-toggle-online", "aria-checked")) === "true");
}

let crudTurn = Promise.resolve();

// deno-lint-ignore no-explicit-any
async function newContext(browser: any) {
  const context = await browser.newContext({
    locale: "pt-BR",
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  await context.route("**/crud/truco_*", (route: Route) => {
    const next = crudTurn.then(async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const response = await route.fetch().catch(() => null);
        if (response === null) {
          await sleep(30);
          await route.abort().catch(() => {});
          return;
        }
        if (response.status() !== 500 || attempt === 4) {
          await route.fulfill({ response }).catch(() => {});
          return;
        }
        await sleep(25 * 2 ** attempt);
      }
    });
    crudTurn = next.catch(() => {});
  });
  return context;
}

/** A second player: another browser context is another guest. Its clock is
    real, since nothing it waits for is the driver's to advance. */
async function reader(p: Page): Promise<Page> {
  const context = await newContext(p.context().browser());
  const other = await context.newPage();
  await other.goto(`${origin(p)}/`, { waitUntil: "domcontentloaded" });
  await until(other, "the other reader's table", 20000, async () => (await count(other, ".seat-row.mine .card")) === 3);
  return other;
}

async function main(): Promise<number> {
  const { chromium } = await import("npm:playwright@1.61.1");
  const base = await baseUrl(APP);
  // A deployment is a worker and the files it fetches, which a case serves by
  // routing; Chromium routes a worker's requests only behind this switch.
  Deno.env.set("PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS", "1");
  const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
  const errors: string[] = [];
  // A reader per case: a context is a guest of its own, so no case inherits
  // another's sitting, name or presence. One guest loading the table a
  // hundred times would hold more live leases than the bar admits.
  // Every case reads the table in Brazilian Portuguese, and an unprefixed
  // address takes its language from Accept-Language — so the driver states
  // the reader it is rather than inheriting the runner's.
  const readerFor = async () => {
    const context = await newContext(browser);
    const page = await context.newPage();
    const caseErrors: string[] = [];
    page.on("console", (m: { type: () => string; text: () => string }) => {
      if (m.type() === "error" && !m.text().includes("ERR_INTERNET_DISCONNECTED")) caseErrors.push(m.text());
    });
    return { page, caseErrors };
  };

  let failed = 0;
  const filter = Deno.args[1];
  const cases = filter ? CASES.filter((c) => c.id.includes(filter)) : CASES;
  const runCase = async (c: Case) => {
    // Every case starts from a dealt table.
    const { page, caseErrors } = await readerFor();
    try {
      await freshTable(page, base);
      caseErrors.length = 0;
      await c.run(page);
      errors.push(...caseErrors);
      console.log(`PASS  ${c.id}  [${c.accepts.join(" ")}]`);
    } catch (err) {
      failed++;
      console.log(`FAIL  ${c.id}  [${c.accepts.join(" ")}]\n      ${err instanceof Error ? err.message : err}`);
    } finally {
      await page.context().close();
    }
  };
  const LANES = 4;
  const HEAVY = new Set([
    "eles tell you before they call",
    "a deployment newer than the browser's copy is the one that runs",
    "a match won at the table stays on it until asked",
    "a won sitting left overnight opens by itself",
    "a country picked brings its own truco, in its own language",
    "the players talk like their table, whatever the page's language",
    "a tie and the rodada that breaks it are laid side by side",
    "an accepted raise is the stake the hand pays",
  ]);
  const parallel = [
    ...cases.filter((c) => !c.serial && HEAVY.has(c.id)),
    ...cases.filter((c) => !c.serial && !HEAVY.has(c.id)),
  ];
  const serial = cases.filter((c) => c.serial);
  let next = 0;
  try {
    await Promise.all(
      Array.from({ length: Math.min(LANES, parallel.length) }, async () => {
        while (next < parallel.length) {
          await runCase(parallel[next++]);
        }
      }),
    );
    for (const c of serial) {
      await runCase(c);
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
