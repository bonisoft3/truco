// Regression test: accepting or declining an incoming challenge must update the challenge
// status in the database so the challenger's client transitions to the match.
import { afterEach, describe, expect, it } from "@test/harness";
import { parseHTML } from "linkedom";
import mountDealer from "../shell/hatches/dealer.js";

let dealerController: AbortController;
afterEach(() => dealerController?.abort());

const setupTestDOM = async (challengeItem: any) => {
  const html = await Deno.readTextFile(new URL("../shell/screens/arena.html", import.meta.url));
  const { document, window } = parseHTML(html);

  const modal = document.querySelector("#modal-online") as any;
  if (modal) {
    modal.matches = () => false;
    modal.showPopover = () => {};
    modal.hidePopover = () => {};
  }

  const storage: Record<string, string> = { "truco-player-id": "player_b", "truco-handle": "bonitao" };
  const sess = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v; },
    removeItem: (k: string) => { delete storage[k]; },
  };

  Object.defineProperty(globalThis, "localStorage", { value: sess, configurable: true, writable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: sess, configurable: true, writable: true });

  const updateCalls: Array<{ tbl: string; rows: any[] }> = [];
  (globalThis as any).__mechaClient = {
    collections: {
      challenge: {
        toArray: [challengeItem],
        subscribeChanges: () => () => {},
      },
      lobby: { toArray: [], subscribeChanges: () => () => {} },
    },
    update: async (tbl: string, rows: any[]) => {
      updateCalls.push({ tbl, rows });
    },
  };

  (globalThis as any).MutationObserver = class { observe() {} disconnect() {} };
  (globalThis as any).history = { pushState: () => {}, replaceState: () => {} };
  (globalThis as any).CustomEvent = (window as any).CustomEvent;
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });

  Object.assign(globalThis, { window, document, sessionStorage: sess, localStorage: sess,
    location: { origin: "http://localhost", pathname: "/shell/", search: "" } });
  dealerController = new AbortController();
  mountDealer(document.querySelector('[data-screen="arena"]'), {
    signal: dealerController.signal,
    messages: { "pt-BR": JSON.parse(await Deno.readTextFile(new URL("../messages/pt-BR.json", import.meta.url))) },
  });

  return { document, updateCalls };
};

describe({ name: "challenge handshake sync", sanitizeOps: false, sanitizeResources: false }, () => {
  it("clicking accept updates challenge status to accepted", async () => {
    const challenge = {
      id: "c_12345",
      challenger_id: "player_a",
      challenger_name: "truqueiro-1a5a",
      target_id: "player_b",
      seed: "999888",
      status: "pending",
      variant: "paulista",
      created_at: new Date().toISOString(),
    };

    const { document, updateCalls } = await setupTestDOM(challenge);

    const banner = document.querySelector("#incoming-challenge-banner") as HTMLElement;
    expect(banner?.style.display).toBe("flex");

    const btnAccept = document.querySelector("#btn-challenge-accept") as HTMLElement;
    expect(btnAccept).not.toBeNull();
    btnAccept.click();

    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].tbl).toBe("challenge");
    expect(updateCalls[0].rows).toEqual([
      { key: "c_12345", changes: { status: "accepted" } },
    ]);
  });

  it("clicking decline updates challenge status to declined", async () => {
    const challenge = {
      id: "c_67890",
      challenger_id: "player_a",
      challenger_name: "truqueiro-1a5a",
      target_id: "player_b",
      seed: "111222",
      status: "pending",
      variant: "paulista",
      created_at: new Date().toISOString(),
    };

    const { document, updateCalls } = await setupTestDOM(challenge);

    const banner = document.querySelector("#incoming-challenge-banner") as HTMLElement;
    expect(banner?.style.display).toBe("flex");

    const btnDecline = document.querySelector("#btn-challenge-decline") as HTMLElement;
    expect(btnDecline).not.toBeNull();
    btnDecline.click();

    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].tbl).toBe("challenge");
    expect(updateCalls[0].rows).toEqual([
      { key: "c_67890", changes: { status: "declined" } },
    ]);
  });
});
