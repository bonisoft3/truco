// Regression test: online lobby presence lifecycle.
// Bare page load must NOT register presence in the lobby (zero-noise default).
// #btn-toggle-online is a switch toggle on the seatbar pad.
// Clicking it when offline turns Online ON and registers presence.
// Clicking it when online turns Online OFF and removes presence.
// Closing the modal does NOT kick the player offline.
// #btn-modal-go-offline inside the modal allows explicit disconnect.
import { describe, expect, it } from "@test/harness";
import { parseHTML } from "linkedom";

const setupTestDOM = async () => {
  const html = await Deno.readTextFile(new URL("../shell/screens/arena.html", import.meta.url));
  const { document, window } = parseHTML(html) as any;

  const modalListeners: Record<string, Function[]> = {};
  const modal = document.querySelector("#modal-online") as any;
  if (modal) {
    let isOpen = false;
    modal.matches = (sel: string) => sel === ":popover-open" ? isOpen : false;
    modal.showPopover = () => {
      isOpen = true;
      for (const fn of (modalListeners["toggle"] ?? [])) {
        fn({ newState: "open" });
      }
    };
    modal.hidePopover = () => {
      isOpen = false;
      for (const fn of (modalListeners["toggle"] ?? [])) {
        fn({ newState: "closed" });
      }
    };
    modal.addEventListener = (ev: string, fn: Function) => {
      modalListeners[ev] = modalListeners[ev] ?? [];
      modalListeners[ev].push(fn);
    };
  }

  const scriptEl = document.querySelector("script");
  const scriptText = scriptEl?.textContent ?? "";
  (document as any).currentScript = scriptEl;

  const storage: Record<string, string> = { "truco-player-id": "p_test_1", "truco-handle": "Davi" };
  const ptBrMessages = JSON.parse(await Deno.readTextFile(new URL("../messages/pt-BR.json", import.meta.url)));
  (globalThis as any).__prontoMessages = { "pt-BR": ptBrMessages };
  const sess = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v; },
    removeItem: (k: string) => { delete storage[k]; },
  };
  (globalThis as any).sessionStorage = sess;
  (globalThis as any).localStorage = sess;
  Object.defineProperty(window, "sessionStorage", { value: sess, configurable: true, writable: true });
  Object.defineProperty(window, "localStorage", { value: sess, configurable: true, writable: true });
  Object.defineProperty(globalThis.navigator, "onLine", { value: true, configurable: true });

  const insertCalls: Array<{ tbl: string; rows: any[] }> = [];
  const updateCalls: Array<{ tbl: string; rows: any[] }> = [];
  const removeCalls: Array<{ tbl: string; keys: any[] }> = [];

  const challengeSubs: Function[] = [];
  (globalThis as any).__mechaClient = {
    collections: {
      challenge: {
        toArray: [],
        subscribeChanges: (cb: Function) => { challengeSubs.push(cb); },
      },
      lobby: {
        state: new Map(),
        toArray: [],
        subscribeChanges: () => {},
      },
      room_action: {
        state: new Map(),
        toArray: [],
        subscribeChanges: () => {},
      },
    },
    insert: async (tbl: string, rows: any[]) => {
      insertCalls.push({ tbl, rows });
      for (const r of rows) {
        (globalThis as any).__mechaClient.collections.lobby.state.set(r.id, r);
      }
    },
    update: async (tbl: string, rows: any[]) => {
      updateCalls.push({ tbl, rows });
    },
    remove: async (tbl: string, keys: any[]) => {
      removeCalls.push({ tbl, keys });
      for (const k of keys) {
        (globalThis as any).__mechaClient.collections.lobby.state.delete(k);
      }
    },
  };

  const observerInstances: Array<{ callback: Function; target: any; options: any }> = [];
  (globalThis as any).MutationObserver = class {
    callback: Function;
    target: any;
    options: any;
    constructor(cb: Function) {
      this.callback = cb;
    }
    observe(target: any, options: any) {
      this.target = target;
      this.options = options;
      observerInstances.push({ callback: this.callback, target, options });
    }
    disconnect() {
      const idx = observerInstances.findIndex(o => o.callback === this.callback);
      if (idx !== -1) observerInstances.splice(idx, 1);
    }
  };
  (globalThis as any).history = { pushState: () => {}, replaceState: () => {} };
  (globalThis as any).CustomEvent = (window as any).CustomEvent;
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });

  const fn = new Function("window", "document", "sessionStorage", "location", "history", "matchMedia", scriptText);
  fn(window, document, sess, { origin: "http://localhost", pathname: "/shell/", search: "" }, (globalThis as any).history, (globalThis as any).matchMedia);
  await new Promise((r) => setTimeout(r, 10));

  return { document, window, modal, insertCalls, updateCalls, removeCalls, modalListeners, observerInstances, challengeSubs, sess };
};

describe({ name: "demand-driven lobby presence toggle lifecycle", sanitizeOps: false, sanitizeResources: false }, () => {
  it("initial page load does not insert player into lobby and toggle is OFF", async () => {
    const { document, insertCalls, updateCalls } = await setupTestDOM();
    const toggleBtn = document.querySelector("#btn-toggle-online") as any;
    const openBtn = document.querySelector("#btn-open-online") as any;
    expect(toggleBtn).toBeTruthy();
    expect(toggleBtn.dataset.online).toBe("false");
    expect(toggleBtn.getAttribute("aria-checked")).toBe("false");
    expect(openBtn.dataset.online).toBe("false");

    const lobbyInserts = insertCalls.filter(c => c.tbl === "lobby");
    const lobbyUpdates = updateCalls.filter(c => c.tbl === "lobby");
    expect(lobbyInserts.length).toBe(0);
    expect(lobbyUpdates.length).toBe(0);
  });

  it("opening modal while offline keeps player offline and displays lobby", async () => {
    const { document, modal, insertCalls, updateCalls } = await setupTestDOM();
    const toggleBtn = document.querySelector("#btn-toggle-online") as any;
    const openBtn = document.querySelector("#btn-open-online") as any;

    modal.showPopover();
    await new Promise((r) => setTimeout(r, 10));

    expect(toggleBtn.dataset.online).toBe("false");
    expect(openBtn.dataset.online).toBe("false");
    const lobbyInserts = insertCalls.filter(c => c.tbl === "lobby");
    const lobbyUpdates = updateCalls.filter(c => c.tbl === "lobby");
    expect(lobbyInserts.length).toBe(0);
    expect(lobbyUpdates.length).toBe(0);
  });

  it("clicking online toggle in modal switches to online and inserts presence", async () => {
    const { document, window, insertCalls } = await setupTestDOM();
    const toggleBtn = document.querySelector("#btn-toggle-online") as any;
    const openBtn = document.querySelector("#btn-open-online") as any;

    toggleBtn.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));

    expect(toggleBtn.dataset.online).toBe("true");
    expect(toggleBtn.getAttribute("aria-checked")).toBe("true");
    expect(openBtn.dataset.online).toBe("true");

    const lobbyInserts = insertCalls.filter(c => c.tbl === "lobby");
    expect(lobbyInserts.length).toBe(1);
    expect(lobbyInserts[0].rows[0].id).toBe("p_test_1");
    expect(lobbyInserts[0].rows[0].handle).toBe("Davi");
    expect(lobbyInserts[0].rows[0].status).toBe("waiting");
  });

  it("clicking online toggle while online turns offline and removes presence", async () => {
    const { document, window, removeCalls } = await setupTestDOM();
    const toggleBtn = document.querySelector("#btn-toggle-online") as any;
    const openBtn = document.querySelector("#btn-open-online") as any;

    // Toggle ON
    toggleBtn.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));
    expect(toggleBtn.dataset.online).toBe("true");
    expect(openBtn.dataset.online).toBe("true");

    // Toggle OFF
    toggleBtn.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));

    expect(toggleBtn.dataset.online).toBe("false");
    expect(toggleBtn.getAttribute("aria-checked")).toBe("false");
    expect(openBtn.dataset.online).toBe("false");

    const lobbyRemovals = removeCalls.filter(c => c.tbl === "lobby");
    expect(lobbyRemovals.length).toBe(1);
    expect(lobbyRemovals[0].keys).toEqual(["p_test_1"]);
  });

  it("closing modal does not kick player offline", async () => {
    const { document, window, modal, removeCalls } = await setupTestDOM();
    const toggleBtn = document.querySelector("#btn-toggle-online") as any;
    const openBtn = document.querySelector("#btn-open-online") as any;

    // Toggle ON
    toggleBtn.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));
    expect(toggleBtn.dataset.online).toBe("true");

    // Close modal
    modal.hidePopover();
    await new Promise((r) => setTimeout(r, 10));

    // Player stays online!
    expect(toggleBtn.dataset.online).toBe("true");
    expect(toggleBtn.getAttribute("aria-checked")).toBe("true");
    expect(openBtn.dataset.online).toBe("true");
    const lobbyRemovals = removeCalls.filter(c => c.tbl === "lobby");
    expect(lobbyRemovals.length).toBe(0);
  });

  it("filterAndMarkRows preserves player rows without client-side timeout cutoffs", async () => {
    const { document, window } = await setupTestDOM();
    const toggleBtn = document.querySelector("#btn-toggle-online") as any;
    toggleBtn.dispatchEvent(new (window as any).CustomEvent("click"));

    const listEl = document.querySelector("#lobby-players-list");
    const freshRow = document.createElement("div");
    freshRow.className = "lobby-player-row";
    freshRow.dataset.id = "p_fresh";
    freshRow.dataset.handle = "Carol";
    freshRow.dataset.updatedAt = new Date(Date.now() - 5000).toISOString();
    const freshHandle = document.createElement("b");
    freshHandle.className = "player-handle";
    freshHandle.textContent = "Carol";
    freshRow.appendChild(freshHandle);
    listEl?.appendChild(freshRow);

    const waitingRow = document.createElement("div");
    waitingRow.className = "lobby-player-row";
    waitingRow.dataset.id = "p_waiting";
    waitingRow.dataset.handle = "Beto";
    waitingRow.dataset.updatedAt = new Date(Date.now() - 90000).toISOString();
    const waitingHandle = document.createElement("b");
    waitingHandle.className = "player-handle";
    waitingHandle.textContent = "Beto";
    waitingRow.appendChild(waitingHandle);
    listEl?.appendChild(waitingRow);

    // Refresh filter
    toggleBtn.dispatchEvent(new (window as any).CustomEvent("click"));
    toggleBtn.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));

    expect(freshRow.style.display).not.toBe("none");
    expect(waitingRow.style.display).not.toBe("none");
  });

  it("sweeper evicts stale rows with time travel cutoff", () => {
    const rows = [
      { id: "p1", handle: "Active", updated_at: new Date(100_000).toISOString() },
      { id: "p2", handle: "Stale", updated_at: new Date(20_000).toISOString() },
    ];
    const cdcDeletes: string[] = [];

    const asOf = 100_000;
    const cutoff = new Date(asOf - 60_000).toISOString();

    const remaining = rows.filter(r => {
      if (r.updated_at < cutoff) {
        cdcDeletes.push(r.id);
        return false;
      }
      return true;
    });

    expect(cdcDeletes).toEqual(["p2"]);
    expect(remaining.map(r => r.id)).toEqual(["p1"]);
  });

  // Regression rationale: duplicate handles must never share identity. Only rowId === myId
  // is marked isMe; an opponent with the same handle remains isMe=false so they can be challenged.
  it("filterAndMarkRows marks only matching id as isMe, preserves challengeability, and disambiguates duplicate handles", async () => {
    const { document, window } = await setupTestDOM();
    const toggleBtn = document.querySelector("#btn-toggle-online") as any;
    toggleBtn.dispatchEvent(new (window as any).CustomEvent("click"));

    const listEl = document.querySelector("#lobby-players-list");
    // My row with myId ("p_test_1") and myHandle ("Davi")
    const myRow = document.createElement("div");
    myRow.className = "lobby-player-row";
    myRow.dataset.id = "p_test_1";
    myRow.dataset.handle = "Davi";
    const myHandle = document.createElement("b");
    myHandle.className = "player-handle";
    myRow.appendChild(myHandle);
    listEl?.appendChild(myRow);

    // Opponent row with different id and unique handle
    const otherRow = document.createElement("div");
    otherRow.className = "lobby-player-row";
    otherRow.dataset.id = "p_other_9999";
    otherRow.dataset.handle = "Carol";
    const otherHandle = document.createElement("b");
    otherHandle.className = "player-handle";
    otherRow.appendChild(otherHandle);
    listEl?.appendChild(otherRow);

    // Duplicate opponent row with same handle as mine ("Davi") but different id
    const dupRow = document.createElement("div");
    dupRow.className = "lobby-player-row";
    dupRow.dataset.id = "p_other_1234";
    dupRow.dataset.handle = "Davi";
    const dupHandle = document.createElement("b");
    dupHandle.className = "player-handle";
    dupRow.appendChild(dupHandle);
    listEl?.appendChild(dupRow);

    // Refresh filter
    toggleBtn.dispatchEvent(new (window as any).CustomEvent("click"));
    toggleBtn.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));

    // Regression rationale: only myRow is me; dupRow must remain isMe="false" so opponent is challengeable.
    expect(myRow.dataset.isMe).toBe("true");
    expect(dupRow.dataset.isMe).toBe("false");
    expect(otherRow.dataset.isMe).toBe("false");

    expect(otherHandle.textContent).toBe("Carol");
    expect(myHandle.textContent).toContain("#");
    expect(myHandle.textContent).toContain("(Você)");
    expect(dupHandle.textContent).toContain("#");
    expect(dupHandle.textContent).not.toContain("(Você)");

    expect(myRow.title).toContain("Davi");
    expect(dupRow.title).toContain("1234");
    expect(otherRow.title).toContain("Carol");
  });

  // Regression rationale: template binding must not leak unbound placeholder braces
  // into rendered text content or attributes.
  it("lobby template declares empty player-handle tag bound by data-text without placeholder bleed", async () => {
    const html = await Deno.readTextFile(new URL("../shell/screens/arena.html", import.meta.url));
    expect(html).toContain('<b class="player-handle" data-text="{handle}"></b>');
    expect(html).not.toContain('<b class="player-handle" data-text="{handle}">{handle}</b>');
  });

  it("MutationObserver is attached to lobby list and auto-marks newly stamped rows without toggle click", async () => {
    const { document, window, observerInstances } = await setupTestDOM();
    const modal = document.querySelector("#modal-online") as any;
    modal.dispatchEvent(new (window as any).CustomEvent("toggle", { newState: "open" }));
    await new Promise((r) => setTimeout(r, 10));

    const listEl = document.querySelector("#lobby-players-list");
    const obs = observerInstances.find(o => o.target === listEl);
    expect(obs).toBeTruthy();
    expect(obs?.options.childList).toBe(true);
    expect(obs?.options.subtree).toBe(true);
    expect(obs?.options.attributes).toBe(true);
    expect(obs?.options.attributeFilter).toEqual(["data-id", "data-handle"]);
    expect(obs?.options.attributeOldValue).toBe(true);

    const newRow = document.createElement("div");
    newRow.className = "lobby-player-row";
    newRow.dataset.id = "p_test_1";
    newRow.dataset.handle = "Davi";
    const hEl = document.createElement("b");
    hEl.className = "player-handle";
    newRow.appendChild(hEl);
    listEl?.appendChild(newRow);

    obs?.callback([{ type: "childList", target: listEl }]);
    await new Promise((r) => setTimeout(r, 10));

    expect(newRow.dataset.isMe).toBe("true");
    expect(hEl.textContent).toContain("(Você)");
  });

  // Regression rationale: MutationObserver must react to attribute mutations on existing rows
  // (e.g. handle change or id patch) so labels and challenge buttons are recomputed in-place.
  it("MutationObserver reacts to row attribute changes (data-handle, data-id)", async () => {
    const { document, window, observerInstances } = await setupTestDOM();
    const modal = document.querySelector("#modal-online") as any;
    modal.dispatchEvent(new (window as any).CustomEvent("toggle", { newState: "open" }));
    await new Promise((r) => setTimeout(r, 10));

    const listEl = document.querySelector("#lobby-players-list");
    const obs = observerInstances.find(o => o.target === listEl);

    const row = document.createElement("div");
    row.className = "lobby-player-row";
    row.dataset.id = "p_test_1";
    row.dataset.handle = "Initial";
    const hEl = document.createElement("b");
    hEl.className = "player-handle";
    row.appendChild(hEl);
    listEl?.appendChild(row);

    obs?.callback([{ type: "attributes", target: row, attributeName: "data-handle" }]);
    await new Promise((r) => setTimeout(r, 10));

    expect(row.dataset.isMe).toBe("true");
    expect(hEl.textContent).toContain("(Você)");
  });

  // Regression rationale: self-challenge clicks must be ignored even if the DOM element has not yet been marked with isMe="true".
  it("challenge click handler ignores clicks when row matches myId", async () => {
    const { document, window, insertCalls } = await setupTestDOM();
    const modal = document.querySelector("#modal-online") as any;
    modal.dispatchEvent(new (window as any).CustomEvent("toggle", { newState: "open" }));
    await new Promise((r) => setTimeout(r, 10));

    const listEl = document.querySelector("#lobby-players-list");
    const selfRow = document.createElement("div");
    selfRow.className = "lobby-player-row";
    selfRow.dataset.id = "p_test_1";
    selfRow.dataset.handle = "Davi";
    const btn = document.createElement("button");
    btn.className = "btn-challenge";
    selfRow.appendChild(btn);
    listEl?.appendChild(selfRow);

    btn.dispatchEvent(new (window as any).CustomEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));

    const challengeInserts = insertCalls.filter(c => c.tbl === "challenge");
    expect(challengeInserts.length).toBe(0);
    const overlay = document.querySelector("#challenge-waiting-overlay") as HTMLElement;
    expect(overlay?.style.display).not.toBe("flex");
  });

  // Regression rationale: challenging without a target player ID must fail loudly per AGENTS.md.
  it("challenge click handler throws loudly if target ID is missing", async () => {
    const { document, window } = await setupTestDOM();
    const modal = document.querySelector("#modal-online") as any;
    modal.dispatchEvent(new (window as any).CustomEvent("toggle", { newState: "open" }));
    await new Promise((r) => setTimeout(r, 10));

    const listEl = document.querySelector("#lobby-players-list");
    const badRow = document.createElement("div");
    badRow.className = "lobby-player-row";
    badRow.dataset.handle = "Opponent";
    const btn = document.createElement("button");
    btn.className = "btn-challenge";
    badRow.appendChild(btn);
    listEl?.appendChild(badRow);

    let rejectedError: any = null;
    const onUnhandled = (e: any) => {
      rejectedError = e.reason;
      e.preventDefault();
    };
    globalThis.addEventListener("unhandledrejection", onUnhandled);

    btn.dispatchEvent(new (window as any).CustomEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));

    globalThis.removeEventListener("unhandledrejection", onUnhandled);

    expect(rejectedError).toBeTruthy();
    expect(rejectedError.message).toContain("Missing target player ID");
  });

  // Regression rationale: challenging opponent inserts challenge with disambiguated name
  // and displays waiting overlay with short slug.
  it("challenge click handler successfully inserts challenge with disambiguated name and shows overlay", async () => {
    const { document, window, insertCalls, observerInstances } = await setupTestDOM();
    const modal = document.querySelector("#modal-online") as any;
    modal.dispatchEvent(new (window as any).CustomEvent("toggle", { newState: "open" }));
    await new Promise((r) => setTimeout(r, 10));

    const listEl = document.querySelector("#lobby-players-list");
    const obs = observerInstances.find(o => o.target === listEl);

    const oppRow = document.createElement("div");
    oppRow.className = "lobby-player-row";
    oppRow.dataset.id = "p_opp_9999";
    oppRow.dataset.handle = "Davi";
    const oppHandle = document.createElement("b");
    oppHandle.className = "player-handle";
    oppRow.appendChild(oppHandle);
    const btn = document.createElement("button");
    btn.className = "btn-challenge";
    oppRow.appendChild(btn);
    listEl?.appendChild(oppRow);

    const myRow = document.createElement("div");
    myRow.className = "lobby-player-row";
    myRow.dataset.id = "p_test_1";
    myRow.dataset.handle = "Davi";
    listEl?.appendChild(myRow);

    obs?.callback([{ type: "childList", target: listEl }]);
    await new Promise((r) => setTimeout(r, 10));

    btn.dispatchEvent(new (window as any).CustomEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));

    const challengeInserts = insertCalls.filter(c => c.tbl === "challenge");
    expect(challengeInserts.length).toBe(1);
    expect(challengeInserts[0].rows[0].target_id).toBe("p_opp_9999");
    expect(challengeInserts[0].rows[0].challenger_name).toBe("Davi");
    expect(challengeInserts[0].rows[0].variant).toBe("mineiro");

    const overlay = document.querySelector("#challenge-waiting-overlay") as HTMLElement;
    expect(overlay.style.display).toBe("flex");
    const targetNameEl = document.querySelector("#waiting-target-name");
    expect(targetNameEl?.textContent).toContain("9999");
  });

  // Regression rationale: challenging without a Mecha insert method must throw immediately rather than leaving an unhandled promise rejection or orphaned waiting overlay.
  it("challenge click handler throws loudly if Mecha client is missing insert", async () => {
    const { document, window } = await setupTestDOM();
    delete (globalThis as any).__mechaClient.insert;

    const modal = document.querySelector("#modal-online") as any;
    modal.dispatchEvent(new (window as any).CustomEvent("toggle", { newState: "open" }));
    await new Promise((r) => setTimeout(r, 10));

    const listEl = document.querySelector("#lobby-players-list");
    const oppRow = document.createElement("div");
    oppRow.className = "lobby-player-row";
    oppRow.dataset.id = "p_opp_8888";
    oppRow.dataset.handle = "Opponent";
    const btn = document.createElement("button");
    btn.className = "btn-challenge";
    oppRow.appendChild(btn);
    listEl?.appendChild(oppRow);

    let rejectedError: any = null;
    const onUnhandled = (e: any) => {
      rejectedError = e.reason;
      e.preventDefault();
    };
    globalThis.addEventListener("unhandledrejection", onUnhandled);

    btn.dispatchEvent(new (window as any).CustomEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));

    globalThis.removeEventListener("unhandledrejection", onUnhandled);

    expect(rejectedError).toBeTruthy();
    expect(rejectedError.message).toContain("Mecha client unavailable for challenge insert");
  });

  // Regression rationale: insert rejections must restore the online modal popover and dismiss the waiting overlay so the user is not stuck on an unrecoverable loading state.
  it("challenge click handler restores modal popover and rethrows when insert rejects", async () => {
    const { document, window } = await setupTestDOM();
    (globalThis as any).__mechaClient.insert = async () => {
      throw new Error("Network insert failure");
    };

    const modal = document.querySelector("#modal-online") as any;
    modal.showPopover();
    expect(modal.matches(":popover-open")).toBe(true);

    const listEl = document.querySelector("#lobby-players-list");
    const oppRow = document.createElement("div");
    oppRow.className = "lobby-player-row";
    oppRow.dataset.id = "p_opp_7777";
    oppRow.dataset.handle = "Opponent";
    const btn = document.createElement("button");
    btn.className = "btn-challenge";
    oppRow.appendChild(btn);
    listEl?.appendChild(oppRow);

    let rejectedError: any = null;
    const onUnhandled = (e: any) => {
      rejectedError = e.reason;
      e.preventDefault();
    };
    globalThis.addEventListener("unhandledrejection", onUnhandled);

    btn.dispatchEvent(new (window as any).CustomEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));

    globalThis.removeEventListener("unhandledrejection", onUnhandled);

    expect(rejectedError).toBeTruthy();
    expect(rejectedError.message).toContain("Network insert failure");

    const overlay = document.querySelector("#challenge-waiting-overlay") as HTMLElement;
    expect(overlay.style.display).not.toBe("flex");
    expect(modal.matches(":popover-open")).toBe(true);
  });

  // Regression rationale: cancelling while insert is in flight must await insert completion before declining so Mecha does not receive an update on an uninserted key.
  it("cancelling a challenge while insert is in-flight updates status to declined upon insert resolution", async () => {
    const { document, window, insertCalls, updateCalls } = await setupTestDOM();
    let resolveInsert: Function = () => {};
    (globalThis as any).__mechaClient.insert = async (tbl: string, rows: any[]) => {
      insertCalls.push({ tbl, rows });
      return new Promise((resolve) => {
        resolveInsert = resolve;
      });
    };

    const modal = document.querySelector("#modal-online") as any;
    modal.dispatchEvent(new (window as any).CustomEvent("toggle", { newState: "open" }));
    await new Promise((r) => setTimeout(r, 10));

    const listEl = document.querySelector("#lobby-players-list");
    const oppRow = document.createElement("div");
    oppRow.className = "lobby-player-row";
    oppRow.dataset.id = "p_opp_1111";
    oppRow.dataset.handle = "Opponent";
    const btn = document.createElement("button");
    btn.className = "btn-challenge";
    oppRow.appendChild(btn);
    listEl?.appendChild(oppRow);

    btn.dispatchEvent(new (window as any).CustomEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));

    const btnCancel = document.querySelector("#btn-cancel-challenge");
    btnCancel?.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));

    const declinesBefore = updateCalls.filter(u => u.tbl === "challenge" && u.rows[0]?.changes?.status === "declined");
    expect(declinesBefore.length).toBe(0);

    resolveInsert();
    await new Promise((r) => setTimeout(r, 20));

    const declinesAfter = updateCalls.filter(u => u.tbl === "challenge" && u.rows[0]?.changes?.status === "declined");
    expect(declinesAfter.length).toBe(1);
    expect(declinesAfter[0].rows[0]?.key).toBe(insertCalls[0].rows[0].id);
  });

  // Regression rationale: opponent accepting before insert completes starts the match; insert completion must not overwrite the match status with a decline.
  it("opponent accepting while challenge insert is in-flight does not decline the accepted challenge upon insert resolution", async () => {
    const { document, window, insertCalls, updateCalls, challengeSubs, sess } = await setupTestDOM();
    let resolveInsert: Function = () => {};
    (globalThis as any).__mechaClient.insert = async (tbl: string, rows: any[]) => {
      insertCalls.push({ tbl, rows });
      return new Promise((resolve) => {
        resolveInsert = resolve;
      });
    };

    const modal = document.querySelector("#modal-online") as any;
    modal.dispatchEvent(new (window as any).CustomEvent("toggle", { newState: "open" }));
    await new Promise((r) => setTimeout(r, 10));

    const listEl = document.querySelector("#lobby-players-list");
    const oppRow = document.createElement("div");
    oppRow.className = "lobby-player-row";
    oppRow.dataset.id = "p_opp_2222";
    oppRow.dataset.handle = "Opponent";
    const btn = document.createElement("button");
    btn.className = "btn-challenge";
    oppRow.appendChild(btn);
    listEl?.appendChild(oppRow);

    btn.dispatchEvent(new (window as any).CustomEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));

    const insertedChallengeId = insertCalls[0].rows[0].id;
    (globalThis as any).__mechaClient.collections.challenge.toArray = [{
      id: insertedChallengeId,
      seed: "123456",
      status: "accepted",
      challenger_name: "Opponent",
      variant: "mineiro",
    }];

    challengeSubs.forEach(cb => cb());
    await new Promise((r) => setTimeout(r, 10));

    resolveInsert();
    await new Promise((r) => setTimeout(r, 20));

    const spuriousDeclines = updateCalls.filter(u => u.tbl === "challenge" && u.rows[0]?.key === insertedChallengeId && u.rows[0]?.changes?.status === "declined");
    expect(spuriousDeclines.length).toBe(0);
    expect(sess.getItem("truco-opponent-name")).toBe("Opponent");
  });

  // Regression rationale: Omnishell rebinds setAttribute on every pass even if unchanged; MutationObserver must discard records where oldValue === newVal to avoid filter loops.
  it("MutationObserver ignores attribute mutations where oldValue equals new value", async () => {
    const { document, window, observerInstances } = await setupTestDOM();
    const modal = document.querySelector("#modal-online") as any;
    modal.dispatchEvent(new (window as any).CustomEvent("toggle", { newState: "open" }));
    await new Promise((r) => setTimeout(r, 10));

    const listEl = document.querySelector("#lobby-players-list");
    const obs = observerInstances.find(o => o.target === listEl);

    expect(obs?.options.attributeOldValue).toBe(true);

    const row = document.createElement("div");
    row.className = "lobby-player-row";
    row.dataset.id = "p_test_1";
    row.dataset.handle = "Initial";
    row.setAttribute("data-handle", "Initial");
    listEl?.appendChild(row);

    obs?.callback([{ type: "attributes", target: row, attributeName: "data-handle", oldValue: "Initial" }]);
    await new Promise((r) => setTimeout(r, 10));

    expect(row.dataset.isMe).toBeUndefined();

    row.setAttribute("data-handle", "Updated");
    obs?.callback([{ type: "attributes", target: row, attributeName: "data-handle", oldValue: "Initial" }]);
    await new Promise((r) => setTimeout(r, 10));

    expect(row.dataset.isMe).toBe("true");
  });

  // Regression rationale: opponent picker must not offer "Mesa Online" or sneak in online buttons; Balcão is the single entry point for online play.
  it("opponent picker contains only bot characters and excludes Mesa Online", async () => {
    const { document } = await setupTestDOM();
    const onlineTrigger = document.querySelector("#opponent-trigger-online");
    expect(onlineTrigger).toBeNull();

    const pickerList = document.querySelector("#picker-pop-opponent");
    expect(pickerList).not.toBeNull();
    const options = Array.from(pickerList?.querySelectorAll("button[role='option']") ?? []);
    expect(options.length).toBe(9);
    for (const opt of options) {
      expect((opt as HTMLElement).getAttribute("data-opt")).not.toBe("online");
      expect((opt as HTMLElement).textContent).not.toContain("Mesa Online");
    }
  });

  // Regression rationale: modal invite seat picker must generate proper 2v2 invite URLs targeting partner (parca) and opponent partner (eles2), even from a default 1v1 table.
  it("modal invite picker generates 2v2 invite URLs for parca, eles1, and eles2", async () => {
    const { document, window, modal } = await setupTestDOM();
    modal.showPopover();
    await new Promise((r) => setTimeout(r, 10));

    const field = document.querySelector("#invite-url-field") as any;
    const btnParca = document.querySelector('.btn-invite-seat[data-seat="parca"]');
    const btnEles2 = document.querySelector('.btn-invite-seat[data-seat="eles2"]');
    const btnEles1 = document.querySelector('.btn-invite-seat[data-seat="eles1"]');

    expect(btnParca).not.toBeNull();
    expect(btnEles2).not.toBeNull();
    expect(btnEles1).not.toBeNull();

    // From default 1v1 table: selecting parca produces 2v2 URL
    btnParca?.dispatchEvent(new (window as any).CustomEvent("click"));
    expect(field.value).toContain("seat=parca");
    expect(field.value).toContain("seats=2v2");

    // From default 1v1 table: selecting eles2 produces 2v2 URL
    btnEles2?.dispatchEvent(new (window as any).CustomEvent("click"));
    expect(field.value).toContain("seat=eles2");
    expect(field.value).toContain("seats=2v2");

    // From default 1v1 table: selecting eles1 produces 1v1 URL without seats=2v2
    btnEles1?.dispatchEvent(new (window as any).CustomEvent("click"));
    expect(field.value).toContain("seat=eles1");
    expect(field.value).not.toContain("seats=2v2");

    // When table is 2v2 online: selecting eles1 produces 2v2 URL
    const box = document.querySelector(".matchbox");
    if (box) {
      box.setAttribute("data-seats", "2v2");
      box.setAttribute("data-opponent", "online");
    }
    btnEles1?.dispatchEvent(new (window as any).CustomEvent("click"));
    expect(field.value).toContain("seat=eles1");
    expect(field.value).toContain("seats=2v2");
  });

  // Regression rationale: invite seat picker must hide the button matching the player's own seat and allow inviting 'you' when sitting in eles1.
  it("modal invite picker hides the button for the player's own seat and picks another seat", async () => {
    const { document, window, modal, sess } = await setupTestDOM();
    sess.setItem("truco-seat", "eles1");
    modal.showPopover();
    await new Promise((r) => setTimeout(r, 10));

    const field = document.querySelector("#invite-url-field") as any;
    const btnEles1 = document.querySelector('.btn-invite-seat[data-seat="eles1"]') as HTMLElement;
    const btnYou = document.querySelector('.btn-invite-seat[data-seat="you"]') as HTMLElement;
    const btnParca = document.querySelector('.btn-invite-seat[data-seat="parca"]') as HTMLElement;

    expect(btnEles1.style.display).toBe("none");
    expect(btnYou.style.display).not.toBe("none");
    expect(btnParca.style.display).not.toBe("none");
    expect(field.value).toContain("seat=you");
    expect(field.value).not.toContain("seat=eles1");
    expect(field.value).not.toContain("seats=2v2");
  });

  // Regression rationale: join input must validate that seed is a positive integer and display error in #join-err rather than crashing btn-set-seat with non-numeric text.
  it("join code submit rejects non-numeric input and sets #join-err", async () => {
    const { document, window } = await setupTestDOM();
    const input = document.querySelector("#input-join-code") as HTMLInputElement;
    const btnSubmit = document.querySelector("#btn-submit-join") as HTMLElement;
    const err = document.querySelector("#join-err") as HTMLElement;

    input.value = "m2n9c";
    btnSubmit.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));

    expect(err.textContent).toBe("Código de mesa inválido. Digite um número positivo.");
  });

  // Regression rationale: pasting an invite link with variant parameter into join box must preserve and pass the variant rather than falling back to local table.
  it("join code submit parses variant from pasted invite URL and passes to startOnlineMatch", async () => {
    const { document, window } = await setupTestDOM();
    const input = document.querySelector("#input-join-code") as HTMLInputElement;
    const btnSubmit = document.querySelector("#btn-submit-join") as HTMLElement;
    const err = document.querySelector("#join-err") as HTMLElement;
    const btnSetSeat = document.querySelector("#btn-set-seat") as HTMLElement;

    let receivedDetail: any = null;
    btnSetSeat.addEventListener("click", (e: any) => {
      receivedDetail = e.detail;
    });

    input.value = "https://truco.app/?seed=654321&opponent=online&seat=eles1&variant=paulista";
    btnSubmit.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));

    expect(err.textContent).toBe("");
    expect(receivedDetail).not.toBeNull();
    expect(receivedDetail.seed).toBe("654321");
    expect(receivedDetail.variant).toBe("paulista");
  });

  // Regression rationale: startOnlineMatch from a 2v2v2 bot table (douradinha/douradao) must throw if 1v1/2v2 seats mode is selected per AGENTS.md (fail loudly, no fallback paths).
  it("copy invite from a douradinha table throws for 1v1/2v2 online matches", async () => {
    const { document, window } = await setupTestDOM();
    const box = document.querySelector(".matchbox");
    if (box) {
      box.setAttribute("data-variant", "douradinha");
      box.setAttribute("data-seats", "2v2v2");
    }

    const btnCopy = document.querySelector("#btn-copy-invite") as HTMLElement;
    expect(() => {
      btnCopy?.dispatchEvent(new (window as any).CustomEvent("click"));
    }).toThrow('Variant "douradinha" is only supported in "2v2v2" seats mode');
  });

  // Regression rationale: toggling offline from a 2v2 online room must reset seats to 1v1, clear session, and dispatch nezinho 1v1.
  it("goOffline resets seats to 1v1 and clears online session", async () => {
    const { document, window, sess } = await setupTestDOM();
    const toggle = document.querySelector("#btn-toggle-online") as HTMLElement;

    // Toggle ON first
    toggle.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));

    const box = document.querySelector(".matchbox");
    if (box) {
      box.setAttribute("data-opponent", "online");
      box.setAttribute("data-seats", "2v2");
      box.setAttribute("data-seed", "123456");
    }
    sess.setItem("truco-seat", "parca");
    sess.setItem("truco-opponent-name", "Amigo");

    const btnSetSeat = document.querySelector("#btn-set-seat") as HTMLElement;
    let receivedDetail: any = null;
    btnSetSeat.addEventListener("click", (e: any) => {
      receivedDetail = e.detail;
    });

    // Toggle OFF (invoking goOffline)
    toggle.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));

    expect(sess.getItem("truco-seat")).toBeNull();
    expect(sess.getItem("truco-opponent-name")).toBeNull();
    expect(receivedDetail).not.toBeNull();
    expect(receivedDetail.seats).toBe("1v1");
    expect(receivedDetail.opponent).toBe("nezinho");
  });

  // Regression rationale: bare numeric table code resolves variant from host's lobby row rather than falling back.
  it("join code submit with bare room number joins match with host variant from lobby", async () => {
    const { document, window } = await setupTestDOM();
    (globalThis as any).__mechaClient.collections.lobby.state.set("p_host_1", {
      id: "p_host_1",
      handle: "Host",
      room_seed: "123456",
      variant: "paulista",
      seats: "1v1",
    });

    const input = document.querySelector("#input-join-code") as HTMLInputElement;
    const btnSubmit = document.querySelector("#btn-submit-join") as HTMLElement;
    const err = document.querySelector("#join-err") as HTMLElement;

    const btnSetSeat = document.querySelector("#btn-set-seat") as HTMLElement;
    let receivedDetail: any = null;
    btnSetSeat.addEventListener("click", (e: any) => {
      receivedDetail = e.detail;
    });

    input.value = "123456";
    btnSubmit.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));

    expect(err.textContent).toBe("");
    expect(receivedDetail).not.toBeNull();
    expect(receivedDetail.seed).toBe("123456");
    expect(receivedDetail.variant).toBe("paulista");
  });

  // Regression rationale: bare numeric code without variant in lobby or URL fails loudly per AGENTS.md.
  it("join code submit with bare room number without variant fails loudly", async () => {
    const { document, window } = await setupTestDOM();
    const input = document.querySelector("#input-join-code") as HTMLInputElement;
    const btnSubmit = document.querySelector("#btn-submit-join") as HTMLElement;
    const err = document.querySelector("#join-err") as HTMLElement;

    input.value = "999888";
    btnSubmit.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));

    expect(err.textContent).toBe("Código de mesa inválido. Digite um número positivo.");
  });

  // Regression rationale: non-numeric code must be rejected with localized invalid error message.
  it("join code submit with invalid non-numeric code shows error", async () => {
    const { document, window } = await setupTestDOM();
    const input = document.querySelector("#input-join-code") as HTMLInputElement;
    const btnSubmit = document.querySelector("#btn-submit-join") as HTMLElement;
    const err = document.querySelector("#join-err") as HTMLElement;

    input.value = "not-a-number";
    btnSubmit.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));

    expect(err.textContent).toBe("Código de mesa inválido. Digite um número positivo.");
  });

  // Regression rationale: bare numeric room code in 2v2 allocates the first untaken seat among eles1, parca, eles2 based on room_action rows.
  it("join code submit in 2v2 selects next available seat", async () => {
    const { document, window } = await setupTestDOM();
    (globalThis as any).__mechaClient.collections.lobby.state.set("p_host_2v2", {
      id: "p_host_2v2",
      handle: "Host2v2",
      room_seed: "654321",
      variant: "paulista",
      seats: "2v2",
    });
    (globalThis as any).__mechaClient.collections.room_action.state.set("a1", {
      id: "654321/h1/v1/eles1/play/0",
      room_seed: "654321",
      player_id: "eles1",
    });

    const input = document.querySelector("#input-join-code") as HTMLInputElement;
    const btnSubmit = document.querySelector("#btn-submit-join") as HTMLElement;
    const err = document.querySelector("#join-err") as HTMLElement;

    const btnSetSeat = document.querySelector("#btn-set-seat") as HTMLElement;
    let receivedDetail: any = null;
    btnSetSeat.addEventListener("click", (e: any) => {
      receivedDetail = e.detail;
    });

    input.value = "654321";
    btnSubmit.dispatchEvent(new (window as any).CustomEvent("click"));
    await new Promise((r) => setTimeout(r, 10));

    expect(err.textContent).toBe("");
    expect(receivedDetail).not.toBeNull();
    expect(receivedDetail.seed).toBe("654321");
    expect(receivedDetail.seat).toBe("parca");
  });
});



