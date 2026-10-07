import { chromium } from "npm:playwright@1.61.1";
import { baseUrl } from "../../../plugins/omnishell/base-url.ts";

const APP = ".";
const ARTIFACT_DIR = "/Users/davi/.gemini/antigravity-cli/brain/db11953d-f3c4-4fad-9300-6311fe50215a";

const base = await baseUrl(APP);
console.log(`Running Truco Lobby Benchmark & Stabilization Check at ${base}...`);

const browser = await chromium.launch({ headless: true });

try {
  const ctxA = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const pA = await ctxA.newPage();
  pA.on("console", (m) => console.log(`[pA] ${m.type()}: ${m.text()}`));
  pA.on("pageerror", (err) => console.error(`[pA error] ${err.message}`));

  const ctxB = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const pB = await ctxB.newPage();
  pB.on("console", (m) => console.log(`[pB] ${m.type()}: ${m.text()}`));
  pB.on("pageerror", (err) => console.error(`[pB error] ${err.message}`));

  console.log("Loading Window A and Window B...");
  await Promise.all([
    pA.goto(`${base}/`, { waitUntil: "domcontentloaded" }),
    pB.goto(`${base}/`, { waitUntil: "domcontentloaded" }),
  ]);
  await pA.waitForTimeout(1000);
  await pB.waitForTimeout(1000);

  console.log("Opening Bar Online modals...");
  await Promise.all([
    pA.locator("#btn-open-online").click(),
    pB.locator("#btn-open-online").click(),
  ]);
  await pA.waitForTimeout(1000);
  await pB.waitForTimeout(1000);

  const testNameA = "Alfa_" + Math.floor(100 + Math.random() * 900);
  console.log(`Setting Window A name to "${testNameA}" and measuring replication latency to Window B...`);

  await pA.locator("#my-handle-input").fill(testNameA);
  
  const t0 = performance.now();
  await pA.locator("#btn-save-handle").click();

  try {
    await pB.waitForFunction(
      (name) => {
        const list = document.querySelector("#lobby-players-list");
        if (!list) return false;
        const rows = list.querySelectorAll(".lobby-player-row");
        for (const row of rows) {
          if (row.style.display === "none") continue;
          const text = row.querySelector(".player-handle")?.textContent || "";
          if (text.includes(name)) return true;
        }
        return false;
      },
      testNameA,
      { timeout: 10000 }
    );
  } catch (err) {
    const pBHtml = await pB.locator("#lobby-players-list").innerHTML();
    console.error("pB lobby HTML on timeout:", pBHtml);
    const pAHtml = await pA.locator("#lobby-players-list").innerHTML();
    console.error("pA lobby HTML on timeout:", pAHtml);
    throw err;
  }
  const t1 = performance.now();
  const latencyMs = Math.round(t1 - t0);
  console.log(`\n========================================`);
  console.log(`>>> MEASURED LOBBY REPLICATION LATENCY: ${latencyMs} ms <<<`);
  console.log(`========================================\n`);

  const testNameB = "Beta_" + Math.floor(100 + Math.random() * 900);
  await pB.locator("#my-handle-input").fill(testNameB);
  await pB.locator("#btn-save-handle").click();

  await pA.waitForFunction(
    (name) => {
      const list = document.querySelector("#lobby-players-list");
      if (!list) return false;
      const rows = list.querySelectorAll(".lobby-player-row");
      for (const row of rows) {
        if (row.style.display === "none") continue;
        const text = row.querySelector(".player-handle")?.textContent || "";
        if (text.includes(name)) return true;
      }
      return false;
    },
    testNameB,
    { timeout: 10000 }
  );

  console.log("Testing list order stabilization across heartbeat cycles...");
  const getVisibleHandles = async (page: any) => {
    return await page.evaluate(() => {
      const list = document.querySelector("#lobby-players-list");
      if (!list) return [];
      const rows = Array.from(list.querySelectorAll(".lobby-player-row")) as HTMLElement[];
      return rows
        .filter((r) => r.style.display !== "none")
        .map((r) => r.querySelector(".player-handle")?.textContent?.trim() || "");
    });
  };

  const handlesBefore = await getVisibleHandles(pA);
  console.log("Handles in Window A before heartbeat cycle:", handlesBefore);

  console.log("Waiting 6 seconds for background heartbeats to fire...");
  await pA.waitForTimeout(6000);

  const handlesAfter = await getVisibleHandles(pA);
  console.log("Handles in Window A after heartbeat cycle:", handlesAfter);

  if (JSON.stringify(handlesBefore) !== JSON.stringify(handlesAfter)) {
    throw new Error(`List ordering changed unexpectedly during heartbeats! Before: ${JSON.stringify(handlesBefore)}, After: ${JSON.stringify(handlesAfter)}`);
  }
  console.log("✓ SUCCESS: List order is 100% stable during background heartbeats (no jumping)!");

  console.log("Testing reload deduplication: reloading Window A...");
  await pA.reload({ waitUntil: "domcontentloaded" });
  await pA.waitForTimeout(1000);
  await pA.locator("#btn-open-online").click();
  await pA.waitForTimeout(1500);

  const pAHandlesAfterReload = await getVisibleHandles(pA);
  console.log("Window A visible handles after reload:", pAHandlesAfterReload);
  const selfCountInA = pAHandlesAfterReload.filter((h: string) => h.includes(testNameA)).length;
  if (selfCountInA > 1) {
    throw new Error(`FAIL: Window A sees itself ${selfCountInA} times after reload!`);
  }
  console.log(`✓ SUCCESS: Window A sees itself exactly ${selfCountInA} time after reload (no duplicates)!`);

  const pBHandlesAfterReload = await getVisibleHandles(pB);
  console.log("Window B visible handles after reload:", pBHandlesAfterReload);
  const aCountInB = pBHandlesAfterReload.filter((h: string) => h.includes(testNameA)).length;
  if (aCountInB > 1) {
    throw new Error(`FAIL: Window B sees Window A ${aCountInB} times after reload!`);
  }
  console.log(`✓ SUCCESS: Window B sees Window A exactly ${aCountInB} time (no ghost duplicates)!`);

  await pA.screenshot({ path: `${ARTIFACT_DIR}/bar_stabilized_windowA.png` });
  await pB.screenshot({ path: `${ARTIFACT_DIR}/bar_stabilized_windowB.png` });
  console.log("✓ Saved screenshots: bar_stabilized_windowA.png and bar_stabilized_windowB.png");

} finally {
  await browser.close();
}
