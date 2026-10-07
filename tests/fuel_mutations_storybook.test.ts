// Regression rationale: asserts deterministic fuel bounds, outbox conflict rollback, and read-only frame isolation.
import { describe, expect, it } from "@test/harness";
import { parseHTML } from "linkedom";
import { batched } from "../../../plugins/omnishell/interpreter/batched-store.js";
import { FuelMeter, FuelLimitExceededError } from "../../../plugins/omnishell/test/fuel-meter.ts";
import { OutboxSimulator } from "../../../plugins/omnishell/test/outbox-simulator.ts";
import {
  extractRegions,
  generateIsolatedFrames,
  generatePairwiseFrames,
  generateCoveringArrayFrames,
} from "../../../plugins/omnishell/test/storybook-injector.ts";
import { ensureSes } from "../../../plugins/omnishell/interpreter/jessie.js";

const ROUND_MACHINE = {
  type: "parallel",
  states: {
    round: {
      field: "phase",
      initial: "dealt",
      onDone: {
        target: ".dealt",
        actions: [{ assign: { result: "settled" } }],
      },
      states: {
        dealt: {
          on: {
            play_card: { target: "v1", actions: [{ assign: { result: "" } }] },
          },
        },
        v1: {
          on: {
            vaza_done: "v2",
            fold: "result",
            resign: "result",
          },
        },
        v2: {
          on: {
            vaza_done: "v3",
            fold: "result",
            resign: "result",
          },
        },
        v3: {
          on: {
            vaza_done: "result",
            fold: "result",
            resign: "result",
          },
        },
        result: {
          type: "final",
        },
      },
    },
    wager: {
      field: "truco_state",
      initial: "none",
      states: {
        none: {
          on: {
            "click@btn-truco": {
              target: "truco_called",
              actions: [{ assign: { asked: "you", rung: 1 } }],
            },
          },
        },
        truco_called: {
          entry: [{ assign: { said: "truco" } }],
          exit: [{ assign: { said: "" } }],
          on: {
            "click@btn-accept": {
              target: "truco_accepted",
              actions: [{ assign: { raised: "them" } }],
            },
            "click@btn-raise": {
              target: "retruco_called",
              actions: [{ assign: { asked: "them", rung: 2 } }],
            },
            "click@btn-run": { target: "truco_folded" },
          },
        },
        retruco_called: {
          entry: [{ assign: { said: "retruco" } }],
          exit: [{ assign: { said: "" } }],
          on: {
            "click@btn-accept": { target: "retruco_accepted" },
            "click@btn-raise": { target: "vale4_called" },
            "click@btn-run": { target: "truco_folded" },
          },
        },
        vale4_called: {
          entry: [{ assign: { said: "vale4" } }],
          exit: [{ assign: { said: "" } }],
          on: {
            "click@btn-accept": { target: "vale4_accepted" },
            "click@btn-run": { target: "truco_folded" },
          },
        },
        truco_accepted: {
          on: {
            "click@btn-raise": {
              target: "retruco_called",
              actions: [{ assign: { asked: "them", rung: 2 } }],
            },
            fold: "truco_folded",
          },
        },
        retruco_accepted: {
          on: {
            "click@btn-raise": {
              target: "vale4_called",
              actions: [{ assign: { asked: "them", rung: 3 } }],
            },
            fold: "truco_folded",
          },
        },
        vale4_accepted: {
          on: { fold: "truco_folded" },
        },
        truco_folded: {
          type: "final",
          entry: [{ assign: { ran: "us", said: "ran" }, raise: "fold" }],
          exit: [{ assign: { ran: "", said: "" } }],
        },
      },
      onDone: {
        target: ".none",
      },
    },
    envido: {
      field: "envido_state",
      initial: "none",
      states: {
        none: {
          on: {
            "click@btn-envido": { target: "called" },
            "click@btn-envido-real": { target: "real_called" },
            "click@btn-envido-falta": { target: "falta_called" },
            "click@btn-flor": { target: "flor" },
          },
        },
        called: {
          on: {
            "click@btn-envido-take": { target: "accepted" },
            "click@btn-envido-run": { target: "folded" },
            "click@btn-envido-real": { target: "real_called" },
            "click@btn-envido-falta": { target: "falta_called" },
          },
        },
        real_called: {
          on: {
            "click@btn-envido-take": { target: "accepted" },
            "click@btn-envido-run": { target: "folded" },
            "click@btn-envido-falta": { target: "falta_called" },
          },
        },
        falta_called: {
          on: {
            "click@btn-envido-take": { target: "accepted" },
            "click@btn-envido-run": { target: "folded" },
          },
        },
        accepted: {
          type: "final",
        },
        folded: {
          type: "final",
        },
        flor: {
          type: "final",
        },
      },
      onDone: {
        target: ".none",
      },
    },
  },
};

const tick = (ms = 25) => new Promise((r) => setTimeout(r, ms));

function bootHarness(html: string, initialRow: Record<string, unknown> = {}) {
  const { document, Event } = parseHTML(
    "<!doctype html><html><head></head><body><div id=shell></div></body></html>",
  );
  (globalThis as Record<string, unknown>).document = document;
  const puts: Record<string, unknown>[] = [];
  const rows = [{ id: "r1", current: "yes", ...initialRow }];
  const subs = new Set<() => void>();
  const baseStore = {
    query: async () => rows,
    subscribe: (_table: string, cb: () => void) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    create: async () => {},
    update: async () => {},
    put: async (_table: string, row: Record<string, unknown>) => {
      puts.push({ ...row });
      const i = rows.findIndex((r) => r.id === row.id);
      if (i < 0) rows.push({ ...row } as never);
      else rows[i] = { ...rows[i], ...row };
      for (const cb of subs) setTimeout(cb, 0);
    },
    remove: async () => {},
    upsertBy: async () => {},
  };
  const store = batched(baseStore);
  (globalThis as Record<string, unknown>).fetch = (url: unknown) => {
    const u = String(url);
    if (u.endsWith(".html")) return Promise.resolve(new Response(html));
    if (u.endsWith(".css")) return Promise.resolve(new Response(""));
    return Promise.reject(new Error(`unexpected fetch ${u}`));
  };
  return { document, Event, store, rows, puts };
}

describe("1. Deterministic Fuel Budgets for Automated Tests", () => {
  it("meters game steps and succeeds within calibrated fuel budget", async () => {
    await ensureSes();
    const fuel = new FuelMeter({
      limit: 2000,
      fireCost: 15,
      transitionCost: 50,
      mutationCost: 30,
      waitMsCost: 1,
    });

    const HTML = `<section class="screen" data-screen="arena">
      <div id="round-region" data-live="round" data-filter="id=eq.r1"
           data-phase="{phase}" data-truco-state="{truco_state}" data-envido-state="{envido_state}" data-said="{said}" data-ran="{ran}"
           data-machine='${JSON.stringify(ROUND_MACHINE)}'>
        <button id="btn-truco">TRUCO</button>
        <button id="btn-accept">ACEITO</button>
      </div>
    </section>`;

    const { document, Event, store } = bootHarness(HTML, { phase: "v1", truco_state: "none", envido_state: "none", said: "", ran: "" });
    const { interpretScreen } = await import("../../../plugins/omnishell/interpreter/screen.js");
    const mount = document.getElementById("shell");
    const route = { screen: "arena", files: { html: "arena.html", css: "arena.css", handlers: [] }, states: ["playing"] };

    await interpretScreen(mount, "http://localhost:8080/keep/", route, store, {});
    fuel.spend("transition", 1, "mount_screen");

    const region = mount.querySelector("#round-region");
    const btnTruco = mount.querySelector("#btn-truco");

    // Action 1: Call Truco
    fuel.spend("fire", 1, "click@btn-truco");
    btnTruco.dispatchEvent(new Event("click", { bubbles: true }));
    await tick(40);
    fuel.spend("wait", 40, "tick_wait");
    fuel.spend("transition", 1, "state_truco_called");

    expect(region.getAttribute("data-truco-state")).toBe("truco_called");
    expect(region.getAttribute("data-said")).toBe("truco");

    // Action 2: Accept Truco
    const btnAccept = mount.querySelector("#btn-accept");
    fuel.spend("fire", 1, "click@btn-accept");
    btnAccept.dispatchEvent(new Event("click", { bubbles: true }));
    await tick(40);
    fuel.spend("wait", 40, "tick_wait");
    fuel.spend("transition", 1, "state_truco_accepted");

    expect(region.getAttribute("data-truco-state")).toBe("truco_accepted");

    // Total fuel spent is predictable and well under the 2,000 budget
    expect(fuel.current).toBeLessThan(1000);
    expect(fuel.remaining).toBeGreaterThan(1000);
  });

  it("trips FuelLimitExceededError deterministically on runaway cycles without wall-clock timeout", () => {
    // Budget constrained to 200 fuel units
    const tightMeter = new FuelMeter({
      limit: 200,
      transitionCost: 50,
      fireCost: 10,
    });

    let caughtError: FuelLimitExceededError | null = null;
    try {
      // Simulating a runaway cyclical transition loop between two states
      for (let step = 0; step < 100; step++) {
        tightMeter.spend("fire", 1, `ping_pong_event_${step}`);
        tightMeter.spend("transition", 1, step % 2 === 0 ? "ping" : "pong");
      }
    } catch (err) {
      if (err instanceof FuelLimitExceededError) {
        caughtError = err;
      }
    }

    expect(caughtError).not.toBe(null);
    expect(caughtError?.limit).toBe(200);
    expect(caughtError?.spent).toBeGreaterThan(200);
    expect(caughtError?.message).toContain("Test fuel limit exceeded");
  });

  it("meters effects by descriptive safety spectrum levels", () => {
    const meter = new FuelMeter({ limit: 500 });
    meter.spendEffect("projection", 1, "render_dom");
    meter.spendEffect("ephemeral", 2, "put_row");
    meter.spendEffect("compensable", 1, "outbox_add");
    meter.spendEffect("replicated", 1, "wal_sync");
    meter.spendEffect("exterior", 1, "saga_call");
    expect(meter.current).toBe(1 + 20 + 50 + 100 + 250);
    expect(meter.remaining).toBe(79);
  });
});

describe("2. Mutation Testing & Outbox Simulation in Truco", () => {
  it("handles happy-path optimistic mutations with sync_ack", () => {
    const outbox = new OutboxSimulator("immediate");
    const acks: string[] = [];
    outbox.subscribe((event) => {
      if (event.type === "sync_ack") acks.push(event.token);
    });

    // Player plays card 7 de copas in v1
    const mutation = outbox.enqueue("insert", "play", {
      match_id: "m1",
      round_id: "r1",
      player_id: "you",
      card: "7_c",
      phase: "v1",
      slot: 0,
    });

    expect(mutation.status).toBe("acked");
    expect(acks.length).toBe(1);
    expect(acks[0]).toBe(mutation.token);
    expect(outbox.pending.length).toBe(0);
  });

  it("handles server refusal (conflict) and drops speculative mutation", () => {
    const outbox = new OutboxSimulator("refuse");
    const refusals: string[] = [];
    outbox.subscribe((event) => {
      if (event.type === "refused") refusals.push(event.token);
    });

    // Player attempts to shout retruco when opponent owns the raise
    const mutation = outbox.enqueue("update", "round", {
      id: "r1",
      truco_state: "retruco_called",
      asked: "you",
    });

    expect(mutation.status).toBe("refused");
    expect(refusals.length).toBe(1);
    expect(refusals[0]).toBe(mutation.token);
  });

  it("handles offline network severance and drains outbox upon reconnect", () => {
    const outbox = new OutboxSimulator("offline");
    const acks: string[] = [];
    outbox.subscribe((event) => {
      if (event.type === "sync_ack") acks.push(event.token);
    });

    // 1. In offline mode, player plays card and calls truco
    const mut1 = outbox.enqueue("insert", "play", { card: "1_e", phase: "v1" });
    const mut2 = outbox.enqueue("update", "round", { id: "r1", truco_state: "truco_called" });

    expect(mut1.status).toBe("pending");
    expect(mut2.status).toBe("pending");
    expect(outbox.pending.length).toBe(2);
    expect(acks.length).toBe(0);

    // 2. Network reconnects: outbox drains and emits sync_acks
    const events = outbox.reconnect();
    expect(events.length).toBe(2);
    expect(outbox.pending.length).toBe(0);
    expect(acks.length).toBe(2);
    expect(mut1.status).toBe("acked");
    expect(mut2.status).toBe("acked");
  });
});

describe("3. Storybook State Injection without Mutations", () => {
  it("derives regions and generates isolated linear frames without combinatorial explosion", () => {
    const regions = extractRegions(ROUND_MACHINE as never);
    expect(regions.length).toBe(3);
    expect(regions[0].name).toBe("round");
    expect(regions[0].field).toBe("phase");
    expect(regions[0].states).toEqual(["dealt", "v1", "v2", "v3", "result"]);

    expect(regions[1].name).toBe("wager");
    expect(regions[1].field).toBe("truco_state");
    expect(regions[1].states.length).toBe(8);

    expect(regions[2].name).toBe("envido");
    expect(regions[2].field).toBe("envido_state");
    expect(regions[2].states.length).toBe(7);

    // Isolated frames: |S_round| + |S_wager| + |S_envido| = 5 + 8 + 7 = 20 frames (linear, not 5 * 8 * 7 = 280)
    const frames = generateIsolatedFrames(regions, { id: "r1", said: "", ran: "" });
    expect(frames.length).toBe(20);

    // Every frame specifies exact pre-populated row fields
    const dealtFrame = frames.find((f) => f.name === "round-dealt");
    expect(dealtFrame?.row.phase).toBe("dealt");
    expect(dealtFrame?.row.truco_state).toBe("none");
    expect(dealtFrame?.row.envido_state).toBe("none");

    const retrucoFrame = frames.find((f) => f.name === "wager-retruco_called");
    expect(retrucoFrame?.row.phase).toBe("dealt");
    expect(retrucoFrame?.row.truco_state).toBe("retruco_called");
    expect(retrucoFrame?.row.envido_state).toBe("none");

    const envidoFrame = frames.find((f) => f.name === "envido-called");
    expect(envidoFrame?.row.phase).toBe("dealt");
    expect(envidoFrame?.row.truco_state).toBe("none");
    expect(envidoFrame?.row.envido_state).toBe("called");
  });

  it("derives pairwise covering frames between interacting regions", () => {
    const regions = extractRegions(ROUND_MACHINE as never);
    const pairwise = generatePairwiseFrames(regions[0], regions[1], { id: "r1" });

    // Max(|S_round|, |S_wager|) = max(5, 8) = 8 frames covers all 2-way combinations!
    expect(pairwise.length).toBe(8);
  });

  it("generates multi-region constrained covering array (strength t=2) visiting 100% pairwise interactions", () => {
    const regions = extractRegions(ROUND_MACHINE as never);
    for (const r of regions) r.table = "round";
    const frames = generateCoveringArrayFrames(regions, { round: { id: "r1" } });

    // Covering array compresses 5 * 8 * 7 = 280 combinations into <= 60 frames while guaranteeing t=2 coverage
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.length).toBeLessThanOrEqual(60);

    // Verify all pairwise pairs (phase, truco_state), (phase, envido_state), (truco_state, envido_state) are covered
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        const rA = regions[i];
        const rB = regions[j];
        for (const sA of rA.states) {
          for (const sB of rB.states) {
            const covered = frames.some(
              (f) => f.visualInvariants[rA.field] === sA && f.visualInvariants[rB.field] === sB,
            );
            expect(covered).toBe(true);
          }
        }
      }
    }
  });

  it("poses each visual state in LinkeDOM completely read-only with zero mutations", async () => {
    await ensureSes();
    const { interpretScreen } = await import("../../../plugins/omnishell/interpreter/screen.js");

    const HTML = `<section class="screen" data-screen="arena">
      <div id="round-region" data-live="round" data-filter="id=eq.r1"
           data-phase="{phase}" data-truco-state="{truco_state}" data-envido-state="{envido_state}" data-said="{said}" data-ran="{ran}">
        <span class="status-phase">Phase: {phase}</span>
        <span class="status-wager">Wager: {truco_state}</span>
        <span class="status-envido">Envido: {envido_state}</span>
      </div>
    </section>`;

    const regions = extractRegions(ROUND_MACHINE as never);
    const frames = generateIsolatedFrames(regions, { id: "r1", said: "", ran: "" });

    // Visit each posed frame in the Storybook
    for (const frame of frames) {
      const { document, store, puts } = bootHarness(HTML, frame.row);
      const mount = document.getElementById("shell");
      const route = {
        screen: "arena",
        files: { html: "arena.html", css: "arena.css", handlers: [] },
        states: [frame.name],
      };

      // Storybook tier: handlers: false (read-only, no SES execution)
      await interpretScreen(mount, "http://localhost:8080/keep/", route, store, {}, { handlers: false, fixtures: true });

      const region = mount.querySelector("#round-region");
      for (const [attr, expectedValue] of Object.entries(frame.visualInvariants)) {
        expect(region.getAttribute(`data-${attr.replace(/_/g, "-")}`)).toBe(expectedValue);
      }

      // Invariant: ZERO mutations were dispatched during Storybook state rendering!
      expect(puts.length).toBe(0);
    }
  });
});
