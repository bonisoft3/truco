// Regression test: accepting or declining an incoming challenge must update the challenge
// status in the database so the challenger's client transitions to the match.
import { describe, expect, it } from "@test/harness";
import { parseHTML } from "linkedom";

const setupTestDOM = async (challengeItem: any) => {
  const html = await Deno.readTextFile(new URL("../shell/screens/arena.html", import.meta.url));
  const { document, window } = parseHTML(html);

  const modal = document.querySelector("#modal-online") as any;
  if (modal) {
    modal.matches = () => false;
    modal.showPopover = () => {};
    modal.hidePopover = () => {};
  }

  const scriptEl = document.querySelector("script");
  const scriptText = scriptEl?.textContent ?? "";
  (document as any).currentScript = scriptEl;

  const storage: Record<string, string> = { "truco-player-id": "player_b", "truco-handle": "bonitao" };
  const sess = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v; },
    removeItem: (k: string) => { delete storage[k]; },
  };

  const updateCalls: Array<{ tbl: string; rows: any[] }> = [];
  (globalThis as any).__mechaClient = {
    collections: {
      challenge: {
        toArray: [challengeItem],
        subscribeChanges: () => {},
      },
      lobby: { toArray: [], subscribeChanges: () => {} },
    },
    update: async (tbl: string, rows: any[]) => {
      updateCalls.push({ tbl, rows });
    },
  };

  (globalThis as any).MutationObserver = class { observe() {} disconnect() {} };
  (globalThis as any).history = { pushState: () => {}, replaceState: () => {} };
  (globalThis as any).CustomEvent = (window as any).CustomEvent;
  (globalThis as any).matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });

  const fn = new Function("window", "document", "sessionStorage", "location", "history", "matchMedia", scriptText);
  fn(window, document, sess, { origin: "http://localhost", pathname: "/shell/", search: "" }, (globalThis as any).history, (globalThis as any).matchMedia);

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
