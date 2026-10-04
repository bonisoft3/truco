import { chromium } from "npm:playwright@1.61.1";
import { baseUrl } from "../../../plugins/omnishell/base-url.ts";

const APP = ".";
const ARTIFACT_DIR = "/Users/davi/.gemini/antigravity-cli/brain/db11953d-f3c4-4fad-9300-6311fe50215a";

const base = await baseUrl(APP);
console.log(`Testing Truco Lobby at ${base}...`);

const browser = await chromium.launch({ headless: true });

try {
  const ctx1 = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const p1 = await ctx1.newPage();
  p1.on("console", (msg) => console.log(`[P1 Console] ${msg.type()}: ${msg.text()}`));
  p1.on("pageerror", (err) => console.error(`[P1 Error] ${err.message}`));

  console.log("Opening Page 1 (Main Window)...");
  await p1.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await p1.waitForTimeout(1500);

  console.log("P1 opening Mesa Online...");
  await p1.evaluate(() => (document.querySelector("#btn-open-online") as HTMLElement)?.click());
  await p1.waitForTimeout(1000);

  const p1Handle = await p1.locator("#my-handle-input").inputValue();
  console.log("P1 Handle:", p1Handle);

  const ctx2 = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const p2 = await ctx2.newPage();
  p2.on("console", (msg) => console.log(`[P2 Console] ${msg.type()}: ${msg.text()}`));
  p2.on("pageerror", (err) => console.error(`[P2 Error] ${err.message}`));

  console.log("Opening Page 2 (Incognito Window)...");
  await p2.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(1500);

  console.log("P2 opening Mesa Online...");
  await p2.evaluate(() => (document.querySelector("#btn-open-online") as HTMLElement)?.click());
  await p2.waitForTimeout(1000);

  const p2Handle = await p2.locator("#my-handle-input").inputValue();
  console.log("P2 Handle:", p2Handle);

  console.log(`Waiting for P1 to see P2 (${p2Handle}) in the lobby list...`);
  await p1.waitForFunction(
    (targetHandle) => {
      const rows = document.querySelectorAll("#lobby-players-list .lobby-player-row");
      for (const row of rows) {
        if (row.textContent && row.textContent.includes(targetHandle)) return true;
      }
      return false;
    },
    p2Handle,
    { timeout: 15000 }
  );
  console.log("✓ SUCCESS: P1 sees P2 in the lobby list!");

  console.log(`Waiting for P2 to see P1 (${p1Handle}) in the lobby list...`);
  await p2.waitForFunction(
    (targetHandle) => {
      const rows = document.querySelectorAll("#lobby-players-list .lobby-player-row");
      for (const row of rows) {
        if (row.textContent && row.textContent.includes(targetHandle)) return true;
      }
      return false;
    },
    p1Handle,
    { timeout: 15000 }
  );
  console.log("✓ SUCCESS: P2 sees P1 in the lobby list!");

  await p1.screenshot({ path: `${ARTIFACT_DIR}/lobby_p1_sees_p2.png` });
  await p2.screenshot({ path: `${ARTIFACT_DIR}/lobby_p2_sees_p1.png` });
  console.log("✓ Saved screenshots: lobby_p1_sees_p2.png and lobby_p2_sees_p1.png");

  console.log("P2 clicking ⚔️ Desafiar on P1...");
  const challengeBtn = p2.locator(`.lobby-player-row:has-text("${p1Handle}") .btn-challenge`);
  await challengeBtn.click();
  await p2.waitForTimeout(2000);

  console.log("P2 URL after challenge:", p2.url());
  if (!p2.url().includes("opponent=online") || !p2.url().includes("seat=eles1")) {
    throw new Error(`FAIL: P2 did not navigate to online match room! URL: ${p2.url()}`);
  }
  console.log("✓ SUCCESS: P2 entered match room as seat eles1!");

} finally {
  await browser.close();
}
