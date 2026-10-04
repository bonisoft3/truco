import { chromium } from "npm:playwright@1.61.1";
import { baseUrl } from "../../../plugins/omnishell/base-url.ts";

const APP = ".";
const ARTIFACT_DIR = "/Users/davi/.gemini/antigravity-cli/brain/db11953d-f3c4-4fad-9300-6311fe50215a";

const base = await baseUrl(APP);
console.log(`Connecting to Truco stack at ${base}...`);

await new Deno.Command("docker", {
  args: ["exec", "-i", "truco-database-1", "psql", "-U", "postgres", "-d", "truco", "-c", "TRUNCATE lobby, challenge, room_action;"],
  cwd: APP,
}).output();

const browser = await chromium.launch({
  headless: true,
  args: ["--ignore-certificate-errors", "--no-sandbox"],
});

try {
  const ctxA = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 900 } });
  const ctxB = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 900 } });

  const pA = await ctxA.newPage();
  const pB = await ctxB.newPage();

  const errorsA: string[] = [];
  const errorsB: string[] = [];
  pA.on("pageerror", (err) => errorsA.push(err.message));
  pB.on("pageerror", (err) => errorsB.push(err.message));

  console.log("1. Opening Window A and Window B...");
  await pA.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await pB.goto(`${base}/`, { waitUntil: "domcontentloaded" });

  await pA.locator("#btn-open-online").click();
  await pB.locator("#btn-open-online").click();
  await pA.waitForTimeout(1000);
  await pB.waitForTimeout(1000);

  const inputValA = await pA.locator("#my-handle-input").inputValue();
  const myRowTextA = await pA.locator('.lobby-player-row[data-is-me="true"] .player-handle').textContent();
  console.log(`Window A initial: input="${inputValA}", row="${myRowTextA}"`);
  if (!myRowTextA?.includes(inputValA)) {
    throw new Error(`Window A contradiction: input="${inputValA}" vs row="${myRowTextA}"`);
  }

  const inputValB = await pB.locator("#my-handle-input").inputValue();
  const myRowTextB = await pB.locator('.lobby-player-row[data-is-me="true"] .player-handle').textContent();
  console.log(`Window B initial: input="${inputValB}", row="${myRowTextB}"`);
  if (!myRowTextB?.includes(inputValB)) {
    throw new Error(`Window B contradiction: input="${inputValB}" vs row="${myRowTextB}"`);
  }

  console.log("2. Testing live input reactivity in Window A...");
  const debugInfo = await pA.evaluate(() => {
    const inp = document.querySelector("#my-handle-input") as HTMLInputElement;
    const list = document.querySelector("#lobby-players-list");
    const pid = sessionStorage.getItem("truco-player-id");
    const ptk = sessionStorage.getItem("pronto-token");
    return {
      pid,
      ptk,
      listHtml: list?.innerHTML,
    };
  });
  console.log("Debug info Window A:", JSON.stringify(debugInfo, null, 2));

  await pA.locator("#my-handle-input").fill("Davi Moderno");
  const typedRowTextA = await pA.locator('.lobby-player-row[data-is-me="true"] .player-handle').textContent();
  console.log(`Window A while typing: row="${typedRowTextA}"`);
  if (typedRowTextA !== "Davi Moderno (Você)") {
    throw new Error(`Expected "Davi Moderno (Você)" during typing, got "${typedRowTextA}"`);
  }

  console.log("3. Saving handle in Window A and Window B...");
  await pA.locator("#btn-save-handle").click();
  await pB.locator("#my-handle-input").fill("Carol Boteco");
  await pB.locator("#btn-save-handle").click();

  console.log("Waiting for Window A to see Carol Boteco...");
  const pA_carolLocator = pA.locator('.lobby-player-row[data-is-me="false"] .player-handle').filter({ hasText: "Carol Boteco" });
  await pA_carolLocator.waitFor({ state: "visible", timeout: 10000 });

  console.log("Waiting for Window B to see Davi Moderno...");
  const pB_daviLocator = pB.locator('.lobby-player-row[data-is-me="false"] .player-handle').filter({ hasText: "Davi Moderno" });
  await pB_daviLocator.waitFor({ state: "visible", timeout: 10000 });

  const pA_myRow = await pA.locator('.lobby-player-row[data-is-me="true"] .player-handle').textContent();
  const pA_carolRow = await pA.locator('.lobby-player-row[data-is-me="false"] .player-handle').textContent();
  console.log(`Window A sees: me="${pA_myRow}", other="${pA_carolRow}"`);

  const pB_myRow = await pB.locator('.lobby-player-row[data-is-me="true"] .player-handle').textContent();
  const pB_daviRow = await pB.locator('.lobby-player-row[data-is-me="false"] .player-handle').textContent();
  console.log(`Window B sees: me="${pB_myRow}", other="${pB_daviRow}"`);

  console.log("4. Testing heartbeat durability over 12 seconds...");
  await new Promise((r) => setTimeout(r, 12000));

  const pA_after12s_me = await pA.locator('.lobby-player-row[data-is-me="true"] .player-handle').textContent();
  const pA_after12s_other = await pA.locator('.lobby-player-row[data-is-me="false"] .player-handle').textContent();
  const pB_after12s_me = await pB.locator('.lobby-player-row[data-is-me="true"] .player-handle').textContent();
  const pB_after12s_other = await pB.locator('.lobby-player-row[data-is-me="false"] .player-handle').textContent();

  console.log(`After 12s: Window A me="${pA_after12s_me}", other="${pA_after12s_other}"`);
  console.log(`After 12s: Window B me="${pB_after12s_me}", other="${pB_after12s_other}"`);

  if (!pA_after12s_other?.includes("Carol Boteco")) {
    throw new Error(`Carol disappeared from Window A after 12s: other="${pA_after12s_other}"`);
  }
  if (!pB_after12s_other?.includes("Davi Moderno")) {
    throw new Error(`Davi disappeared from Window B after 12s: other="${pB_after12s_other}"`);
  }

  if (errorsA.length > 0) throw new Error(`Errors in Window A: ${errorsA.join("; ")}`);
  if (errorsB.length > 0) throw new Error(`Errors in Window B: ${errorsB.join("; ")}`);

  console.log("5. Taking screenshot artifacts...");
  await pA.screenshot({ path: `${ARTIFACT_DIR}/lobby_consistent_windowA.png` });
  await pB.screenshot({ path: `${ARTIFACT_DIR}/lobby_consistent_windowB.png` });

  console.log("=== ALL LOBBY CHECKS PASSED SUCCESSFULLY ===");
} finally {
  await browser.close();
}
