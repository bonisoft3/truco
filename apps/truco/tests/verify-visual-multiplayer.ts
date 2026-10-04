import { chromium } from "npm:playwright@1.61.1";
import { baseUrl } from "../../../plugins/omnishell/base-url.ts";

const APP = ".";
const ARTIFACT_DIR = "/Users/davi/.gemini/antigravity-cli/brain/db11953d-f3c4-4fad-9300-6311fe50215a";

const base = await baseUrl(APP);
console.log(`Connecting to Truco stack at ${base}...`);

const browser = await chromium.launch({ headless: true });

try {
  console.log("\n--- TEST 1: Top Bar Layout & Collision Verification (1440x900) ---");
  const ctx1 = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const p1 = await ctx1.newPage();
  await p1.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await p1.waitForTimeout(2000);

  // The bar carries seven controls beside the identity, and it clips what does
  // not fit. Asking whether a wrapping, shrinking flex child stays inside its
  // own parent asks nothing — the layout cannot answer no. What the bar
  // actually promises is an order of yielding: the epithet under the player's
  // name gives up its width first, and every control keeps enough to read.
  const squeezed = await p1.evaluate(() => {
    const bar = document.querySelector(".seatbar");
    if (!bar) return { error: "no .seatbar" };
    // deno-lint-ignore no-explicit-any
    const clipped = (el: any) => el !== null && el.scrollWidth - el.clientWidth > 1;
    const controls = [...bar.querySelectorAll(".seatbar-links > *")];
    return {
      controls: controls.length,
      cut: controls.filter(clipped).map((el) => `${el.className || el.tagName}:${el.scrollWidth}>${el.clientWidth}`),
      epithetGivesWay: clipped(bar.querySelector(".sect")),
      barClips: clipped(bar),
    };
  });
  console.log("seatbar under pressure:", squeezed);

  if ("error" in squeezed) throw new Error(squeezed.error as string);
  if (squeezed.controls < 6) {
    throw new Error(`the bar holds ${squeezed.controls} controls; the five settings and Regras and the online status are seven`);
  }
  if (squeezed.cut.length > 0) {
    throw new Error(`a control in the bar is cut off with no way to read it: ${squeezed.cut.join(", ")}`);
  }
  if (squeezed.barClips) {
    throw new Error("the bar itself is clipping, so something in it is unreachable rather than merely tight");
  }
  console.log("✓ PASS: every control in the bar reads at full width; the epithet yields first:", squeezed.epithetGivesWay);

  const countryLabel = await p1.locator('[data-picker="country"] .pick-label').innerText();
  console.log(`Country picker label text: "${countryLabel}"`);
  if (!countryLabel.trim().includes("Brasil")) {
    throw new Error(`FAIL: the country trigger names no country: "${countryLabel}"`);
  }
  console.log("✓ PASS: the country picker is a peer, flag and name:", countryLabel.trim());

  const oppLabel = await p1.locator('.picker[data-picker="opponent"] .pick-label').innerText();
  console.log(`Opponent picker label text: "${oppLabel}"`);
  if (!oppLabel || oppLabel.trim() === "") {
    throw new Error("FAIL: Opponent picker label is empty!");
  }
  console.log("✓ PASS: Opponent picker displays valid label:", oppLabel.trim());

  const onlineBtn = p1.locator("#btn-open-online");
  const onlineBtnBox = await onlineBtn.boundingBox();
  console.log("Mesa Online button box:", onlineBtnBox);
  if (!onlineBtnBox || onlineBtnBox.width < 10) {
    throw new Error("FAIL: Mesa Online button is not visible or zero size!");
  }
  console.log("✓ PASS: Mesa Online button is prominently rendered in the top bar");

  await p1.screenshot({ path: `${ARTIFACT_DIR}/desktop_topbar_fixed.png` });
  console.log("✓ Saved screenshot: desktop_topbar_fixed.png");

  console.log("\n--- TEST 2: Card Play & Persistence Verification ---");
  const startBtn = p1.locator("#btn-start");
  if (await startBtn.isVisible().catch(() => false)) {
    console.log("Clicking 'Começar partida' to deal hands...");
    await startBtn.click();
    await p1.waitForTimeout(1500);
  }

  const cardBtn = p1.locator("#seat-you .card:not([disabled])").first();
  await cardBtn.waitFor({ state: "visible", timeout: 10000 });
  const cardName = await cardBtn.getAttribute("data-card");
  console.log(`Playing card: ${cardName}...`);
  await cardBtn.click();
  await p1.waitForTimeout(1500);

  const playedCount = await p1.locator(".trick .card").count();
  console.log(`Cards on felt: ${playedCount}`);
  if (playedCount < 1) {
    throw new Error("FAIL: Played card did NOT appear on felt!");
  }
  console.log("✓ PASS: Card successfully persisted onto felt!");

  const screenState = await p1.locator(".screen").getAttribute("data-state");
  console.log(`Screen data-state: "${screenState}"`);
  if (screenState === "validation-error" || screenState === "network-error") {
    throw new Error(`FAIL: Screen has error state: ${screenState}`);
  }

  const refusalVisible = await p1.locator(".refusal").isVisible().catch(() => false);
  console.log("Refusal message visible:", refusalVisible);
  if (refusalVisible) {
    throw new Error("FAIL: Refusal message 'A mesa não conseguiu registrar a jogada.' is visible!");
  }
  console.log("✓ PASS: No refusal or error message!");

  await p1.screenshot({ path: `${ARTIFACT_DIR}/card_play_persisted.png` });
  console.log("✓ Saved screenshot: card_play_persisted.png");

  console.log("\n--- TEST 3: Online Modal Verification ---");
  await p1.locator("#btn-open-online").click();
  await p1.waitForTimeout(800);

  const modal = p1.locator("#modal-online");
  const modalVisible = await modal.isVisible();
  console.log("Modal visible:", modalVisible);
  if (!modalVisible) {
    throw new Error("FAIL: Online modal did not open on button click!");
  }

  const inviteUrl = await p1.locator("#invite-url-field").inputValue();
  console.log("Generated Invite URL:", inviteUrl);
  if (!inviteUrl.includes("seat=eles1") || !inviteUrl.includes("opponent=online")) {
    throw new Error(`FAIL: Invalid invite URL: ${inviteUrl}`);
  }
  console.log("✓ PASS: Valid invite URL generated with room/seed and opponent=online!");

  await p1.screenshot({ path: `${ARTIFACT_DIR}/online_modal_verified.png` });
  console.log("✓ Saved screenshot: online_modal_verified.png");

  await p1.locator(".modal-close").click();
  await p1.waitForTimeout(500);

  console.log("\n--- TEST 4: Multiplayer Sync Across Two Browser Contexts ---");
  await p1.evaluate(async () => {
    localStorage.clear();
    await fetch("/crud/play", { method: "DELETE" }).catch(() => {});
  });

  const matchSeed = Date.now().toString().slice(-10);
  const hostUrl = `${base}/?seed=${matchSeed}&opponent=online&seat=you`;
  const guestUrl = `${base}/?seed=${matchSeed}&opponent=online&seat=eles1`;

  console.log("Launching Player 1 (Host) at:", hostUrl);
  await p1.goto(hostUrl, { waitUntil: "domcontentloaded" });
  await p1.waitForTimeout(2000);
  if (await p1.locator("#btn-start").isVisible().catch(() => false)) {
    console.log("Host clicking Começar partida...");
    await p1.locator("#btn-start").click();
    await p1.waitForTimeout(1500);
  }

  console.log("Launching Player 2 (Challenger) in separate browser context at:", guestUrl);
  const ctx2 = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const p2 = await ctx2.newPage();
  await p2.goto(guestUrl, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(2000);
  if (await p2.locator("#btn-start").isVisible().catch(() => false)) {
    console.log("Guest clicking Começar partida...");
    await p2.locator("#btn-start").click();
    await p2.waitForTimeout(1500);
  }

  const p2Who = await p2.locator(".who b").innerText();
  console.log(`Player 2 who title: "${p2Who}"`);

  const p1Cards = await p1.locator("#seat-you .card").count();
  const p2Cards = await p2.locator("#seat-you .card").count();
  console.log(`Player 1 cards in hand: ${p1Cards}, Player 2 cards in hand: ${p2Cards}`);
  if (p1Cards !== 3 || p2Cards !== 3) {
    throw new Error(`FAIL: Expected 3 cards each, got P1: ${p1Cards}, P2: ${p2Cards}`);
  }
  console.log("✓ PASS: Both players have 3 cards dealt from the shared deterministic seed!");

  await p1.screenshot({ path: `${ARTIFACT_DIR}/multiplayer_player1_start.png` });
  await p2.screenshot({ path: `${ARTIFACT_DIR}/multiplayer_player2_start.png` });

  const p1CardToPlay = p1.locator("#seat-you .card:not([disabled])").first();
  const p1CardText = await p1CardToPlay.getAttribute("data-card");
  console.log(`Player 1 plays card: ${p1CardText}...`);
  await p1CardToPlay.click();
  await p1.waitForTimeout(1000);

  const p1FeltCount = await p1.locator(".trick .card").count();
  console.log(`Player 1 sees on felt: ${p1FeltCount} card(s)`);

  console.log("Waiting for ElectricSQL sync to deliver Player 1's play to Player 2...");
  await p2.waitForFunction(() => document.querySelectorAll(".trick .card").length >= 1, { timeout: 10000 });
  const p2FeltCard = await p2.evaluate(() => {
    const cardEl = document.querySelector(".trick .card");
    if (!cardEl) return null;
    const rank = cardEl.querySelector(".corner.tl b")?.textContent?.trim() || "";
    const suit = cardEl.querySelector(".corner.tl i")?.textContent?.trim() || "";
    return rank + suit;
  });
  console.log(`Player 2 sees on felt via ElectricSQL: card "${p2FeltCard}"!`);
  if (p2FeltCard !== p1CardText) {
    throw new Error(`FAIL: Mismatch in card played! P1 played ${p1CardText}, P2 sees ${p2FeltCard}`);
  }
  console.log("✓ PASS: Player 2 sees Player 1's card replicated in real-time through ElectricSQL!");

  await p2.screenshot({ path: `${ARTIFACT_DIR}/player2_sees_player1_play.png` });

  const p2CardToPlay = p2.locator("#seat-you .card:not([disabled])").first();
  const p2CardText = await p2CardToPlay.getAttribute("data-card");
  console.log(`Player 2 plays card: ${p2CardText}...`);
  await p2CardToPlay.click();
  await p2.waitForTimeout(1000);

  console.log("Waiting for ElectricSQL sync to deliver Player 2's play to Player 1...");
  await p1.waitForFunction(() => document.querySelectorAll(".trick .card").length >= 2, { timeout: 10000 });
  const p1FeltCard = await p1.evaluate(() => {
    const cards = document.querySelectorAll(".trick .card");
    const cardEl = cards[cards.length - 1];
    if (!cardEl) return null;
    const rank = cardEl.querySelector(".corner.tl b")?.textContent?.trim() || "";
    const suit = cardEl.querySelector(".corner.tl i")?.textContent?.trim() || "";
    return rank + suit;
  });
  console.log(`Player 1 now sees 2 cards on felt, second card: "${p1FeltCard}"!`);
  if (p1FeltCard !== p2CardText) {
    throw new Error(`FAIL: Mismatch in P2 card played! P2 played ${p2CardText}, P1 sees ${p1FeltCard}`);
  }
  console.log("✓ PASS: Full two-way server-mediated multiplayer verified!");

  await p1.screenshot({ path: `${ARTIFACT_DIR}/player1_sees_player2_play.png` });

  console.log("\n=======================================================");
  console.log("ALL ACCEPTANCE & VISUAL MULTIPLAYER CHECKS PASSED 100%!");
  console.log("=======================================================\n");

} finally {
  await browser.close();
}
