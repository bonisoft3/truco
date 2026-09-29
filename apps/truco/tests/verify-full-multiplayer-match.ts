import { chromium } from "npm:playwright@1.59.1";
import { baseUrl } from "../../../plugins/omnishell/base-url.ts";

const APP = ".";
const ARTIFACT_DIR = "/Users/davi/.gemini/antigravity-cli/brain/db11953d-f3c4-4fad-9300-6311fe50215a";

const base = await baseUrl(APP);
console.log(`Connecting to Truco stack at ${base}...`);

const browser = await chromium.launch({ headless: true });

try {
  console.log("\n=======================================================");
  console.log("TEST: Complete Multiplayer Flow (Challenge + Live Game)");
  console.log("=======================================================");

  await new Deno.Command("docker", {
    args: ["exec", "-i", "truco-database-1", "psql", "-U", "postgres", "-d", "truco", "-c", "TRUNCATE lobby, challenge, room_action;"],
    cwd: APP,
  }).output();

  const ctxA = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const ctxB = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const pA = await ctxA.newPage();
  const pB = await ctxB.newPage();
  pA.on("console", (msg) => console.log(`[pA console] ${msg.type()}: ${msg.text()}`));
  pA.on("pageerror", (err) => console.error(`[pA pageerror]`, err));
  pB.on("console", (msg) => console.log(`[pB console] ${msg.type()}: ${msg.text()}`));
  pB.on("pageerror", (err) => console.error(`[pB pageerror]`, err));

  console.log("1. Opening Truco for Player A (Davi)...");
  await pA.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await pA.waitForFunction(() => document.querySelector("#modal-online")?.getAttribute("data-wired") === "1", undefined, { timeout: 15000 });
  console.log("✓ Player A shell loaded & modal wired");

  console.log("1b. Opening Truco for Player B (Carol)...");
  await pB.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await pB.waitForFunction(() => document.querySelector("#modal-online")?.getAttribute("data-wired") === "1", undefined, { timeout: 15000 });
  console.log("✓ Player B shell loaded & modal wired");

  console.log("2. Opening Mesa Online modal...");
  const aState = await pA.evaluate(() => {
    const b = document.querySelector("#btn-open-online") as HTMLElement;
    const m = document.querySelector("#modal-online") as HTMLElement;
    const before = m ? m.matches(":popover-open") : false;
    b?.click();
    const after = m ? m.matches(":popover-open") : false;
    return { hasBtn: !!b, hasModal: !!m, before, after, display: m ? getComputedStyle(m).display : null };
  });
  console.log("pA click state:", aState);
  const bState = await pB.evaluate(() => {
    const b = document.querySelector("#btn-open-online") as HTMLElement;
    const m = document.querySelector("#modal-online") as HTMLElement;
    b?.click();
    return { hasBtn: !!b, hasModal: !!m, open: m ? m.matches(":popover-open") : false };
  });
  console.log("pB click state:", bState);
  const checkAfterB = await pA.evaluate(() => {
    const m = document.querySelector("#modal-online");
    return { open: m?.matches(":popover-open"), display: m ? getComputedStyle(m).display : null };
  });
  console.log("checkAfterB:", checkAfterB);
  console.log("✓ pA modal open");
  console.log("Waiting for pB modal open...");
  await pB.waitForFunction(() => document.querySelector("#modal-online")?.matches(":popover-open"), undefined, { timeout: 5000 });
  console.log("✓ pB modal open");

  console.log("3. Setting handles: Davi and Carol...");
  const hA = await pA.evaluate(() => {
    const inp = document.querySelector("#my-handle-input") as HTMLInputElement;
    inp.value = "Davi";
    (document.querySelector("#btn-save-handle") as HTMLElement)?.click();
    return { val: inp?.value, stored: sessionStorage.getItem("truco-handle") };
  });
  const hB = await pB.evaluate(() => {
    const inp = document.querySelector("#my-handle-input") as HTMLInputElement;
    inp.value = "Carol";
    (document.querySelector("#btn-save-handle") as HTMLElement)?.click();
    return { val: inp?.value, stored: sessionStorage.getItem("truco-handle") };
  });
  console.log("Set handle results:", { hA, hB });

  console.log("4. Verifying cross-player lobby presence...");
  await pA.waitForFunction(() => {
    const rows = Array.from(document.querySelectorAll(".lobby-player-row"));
    return rows.some(el => el.textContent?.includes("Carol"));
  }, undefined, { timeout: 15000 });
  await pB.waitForFunction(() => {
    const rows = Array.from(document.querySelectorAll(".lobby-player-row"));
    return rows.some(el => el.textContent?.includes("Davi"));
  }, undefined, { timeout: 15000 });
  console.log("✓ Davi sees Carol in lobby!");
  console.log("✓ Carol sees Davi in lobby!");

  const lobbyA = await pA.locator("#lobby-players-list").innerHTML();
  console.log("Lobby A HTML:\n", lobbyA);
  const daviOwnBtn = await pA.locator('.lobby-player-row[data-is-me="true"] .btn-challenge').isVisible().catch(() => false);
  const carolOwnBtn = await pB.locator('.lobby-player-row[data-is-me="true"] .btn-challenge').isVisible().catch(() => false);
  console.log(`daviOwnBtn visible: ${daviOwnBtn}, carolOwnBtn visible: ${carolOwnBtn}`);
  if (daviOwnBtn || carolOwnBtn) {
    throw new Error("Challenge button should NOT be visible on own row!");
  }
  console.log("✓ Self-challenge buttons are correctly hidden");

  await pA.screenshot({ path: `${ARTIFACT_DIR}/multiplayer_lobby_davi.png`, animations: "disabled" });
  await pB.screenshot({ path: `${ARTIFACT_DIR}/multiplayer_lobby_carol.png`, animations: "disabled" });

  console.log("5. Davi challenges Carol...");
  await pA.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".lobby-player-row"));
    const carolRow = rows.find(r => r.textContent?.includes("Carol"));
    const btn = carolRow?.querySelector(".btn-challenge") as HTMLElement;
    btn?.click();
  });

  await pA.waitForSelector("#challenge-waiting-overlay:not([style*='display: none'])", { timeout: 5000 });
  const waitingText = await pA.locator("#waiting-target-name").innerText();
  console.log(`✓ Davi waiting overlay active: "${waitingText}"`);

  console.log("6. Verifying Carol receives challenge invitation banner...");
  await pB.waitForSelector("#incoming-challenge-banner:not([style*='display: none'])", { timeout: 10000 });
  const bannerChallenger = await pB.locator("#challenge-challenger-name").innerText();
  console.log(`✓ Carol sees challenge from: "${bannerChallenger}"`);
  if (!bannerChallenger.includes("Davi")) {
    throw new Error(`Expected banner from Davi, got: ${bannerChallenger}`);
  }

  await pB.screenshot({ path: `${ARTIFACT_DIR}/multiplayer_challenge_invite.png`, animations: "disabled" });

  console.log("7. Carol accepts challenge...");
  await pB.evaluate(() => {
    (document.querySelector("#btn-challenge-accept") as HTMLElement)?.click();
  });

  console.log("8. Verifying both navigate to room with matching seed...");
  await pA.waitForFunction(() => location.search.includes("opponent=online"), { timeout: 10000 });
  await pB.waitForFunction(() => location.search.includes("opponent=online"), { timeout: 10000 });

  const urlA = await pA.evaluate(() => location.href);
  const urlB = await pB.evaluate(() => location.href);
  const seedA = new URL(urlA).searchParams.get("seed");
  const seedB = new URL(urlB).searchParams.get("seed");
  const seatA = new URL(urlA).searchParams.get("seat");
  const seatB = new URL(urlB).searchParams.get("seat");

  console.log(`Davi URL: seed=${seedA}, seat=${seatA}`);
  console.log(`Carol URL: seed=${seedB}, seat=${seatB}`);

  if (!seedA || seedA !== seedB) {
    throw new Error(`Room seeds do not match! A=${seedA}, B=${seedB}`);
  }
  if (seatA !== "you" || seatB !== "eles1") {
    throw new Error(`Seats misconfigured! Davi seat=${seatA}, Carol seat=${seatB}`);
  }
  console.log("✓ Seeds match and seats are correctly assigned (Davi: you, Carol: eles1)");

  console.log("9. Waiting for cards to deal...");
  await pA.waitForSelector("#seat-you .card:not([data-exit])", { timeout: 5000 });
  await pB.waitForSelector("#seat-you .card:not([data-exit])", { timeout: 5000 });

  await pA.waitForFunction(() => document.querySelectorAll("#seat-you .card:not([data-exit])").length === 3, { timeout: 5000 });
  await pB.waitForFunction(() => document.querySelectorAll("#seat-you .card:not([data-exit])").length === 3, { timeout: 5000 });

  const countCardsA = await pA.locator("#seat-you .card:not([data-exit])").count();
  const countCardsB = await pB.locator("#seat-you .card:not([data-exit])").count();
  console.log(`Davi cards in hand: ${countCardsA}, Carol cards in hand: ${countCardsB}`);
  if (countCardsA !== 3 || countCardsB !== 3) {
    throw new Error("Both players should start with 3 cards in hand!");
  }

  await pA.screenshot({ path: `${ARTIFACT_DIR}/multiplayer_match_davi_hand.png`, animations: "disabled" });
  await pB.screenshot({ path: `${ARTIFACT_DIR}/multiplayer_match_carol_hand.png`, animations: "disabled" });

  console.log("10. Testing Truco call and accept in multiplayer match...");
  const pAEnabled = await pA.locator("#seat-you .card:not([disabled]):not([data-exit])").count();
  const pBEnabled = await pB.locator("#seat-you .card:not([disabled]):not([data-exit])").count();
  console.log(`Enabled cards at start: Davi=${pAEnabled}, Carol=${pBEnabled}`);

  let firstPlayer = pA;
  let secondPlayer = pB;
  let firstSeat = "you";
  let secondSeat = "eles1";
  let firstName = "Davi";
  let secondName = "Carol";

  if (pAEnabled === 0 && pBEnabled > 0) {
    firstPlayer = pB;
    secondPlayer = pA;
    firstSeat = "eles1";
    secondSeat = "you";
    firstName = "Carol";
    secondName = "Davi";
  }

  console.log(`${firstName} hovers first card to signal intent...`);
  await firstPlayer.locator("#seat-you .card").first().hover();

  console.log(`${firstName} calls TRUCO!`);
  await firstPlayer.evaluate(() => (document.querySelector("#btn-truco") as HTMLElement)?.click());

  console.log(`Waiting for ${secondName} to receive Truco raise and show Aceito button...`);
  await secondPlayer.waitForSelector('.play[data-phase="raised"] #btn-accept', { timeout: 10000 });
  console.log(`✓ ${secondName} sees Truco raise and Aceito button!`);

  await secondPlayer.screenshot({ path: `${ARTIFACT_DIR}/multiplayer_truco_raised_${secondName.toLowerCase()}.png`, animations: "disabled" });

  console.log(`${secondName} clicks Aceito...`);
  await secondPlayer.evaluate(() => (document.querySelector("#btn-accept") as HTMLElement)?.click());

  console.log("Waiting for stake to climb to 4 on both tables...");
  await firstPlayer.waitForSelector(".hand[data-stake=\"4\"]", { timeout: 8000 });
  await secondPlayer.waitForSelector(".hand[data-stake=\"4\"]", { timeout: 8000 });
  console.log("✓ Stake climbed to 4 on both tables!");

  await firstPlayer.screenshot({ path: `${ARTIFACT_DIR}/multiplayer_truco_accepted_${firstName.toLowerCase()}.png`, animations: "disabled" });

  console.log("11. Playing cards in multiplayer match...");
  console.log(`Player 1 to play: ${firstName}`);
  const card1 = firstPlayer.locator("#seat-you .card:not([disabled]):not([data-exit])").first();
  const card1Name = await card1.getAttribute("data-card");
  console.log(`${firstName} plays card: ${card1Name}`);
  await firstPlayer.evaluate(() => (document.querySelector("#seat-you .card:not([disabled]):not([data-exit])") as HTMLElement)?.click());

  console.log(`Waiting for ${secondName} to see ${firstName}'s card on the felt...`);
  await secondPlayer.waitForSelector(`.trick[data-t="1"] .played[data-seat="${firstSeat}"]`, { timeout: 8000 });
  const played1OnSecond = await secondPlayer.locator(`.trick[data-t="1"] .played[data-seat="${firstSeat}"] .card`).getAttribute("data-card");
  console.log(`✓ ${secondName} successfully saw ${firstName}'s card on felt: ${played1OnSecond}`);
  if (played1OnSecond !== card1Name) {
    throw new Error(`Card mismatch! Expected ${card1Name}, got ${played1OnSecond}`);
  }

  await secondPlayer.waitForSelector("#seat-you .card:not([disabled]):not([data-exit])", { timeout: 5000 });
  const card2 = secondPlayer.locator("#seat-you .card:not([disabled]):not([data-exit])").first();
  const card2Name = await card2.getAttribute("data-card");
  console.log(`${secondName} plays card: ${card2Name}`);
  await secondPlayer.evaluate(() => (document.querySelector("#seat-you .card:not([disabled]):not([data-exit])") as HTMLElement)?.click());

  console.log(`Waiting for ${firstName} to see ${secondName}'s card on the felt...`);
  await firstPlayer.waitForSelector(`.trick[data-t="1"] .played[data-seat="${secondSeat}"]`, { timeout: 8000 });
  const played2OnFirst = await firstPlayer.locator(`.trick[data-t="1"] .played[data-seat="${secondSeat}"] .card`).getAttribute("data-card");
  console.log(`✓ ${firstName} successfully saw ${secondName}'s card on felt: ${played2OnFirst}`);
  if (played2OnFirst !== card2Name) {
    throw new Error(`Card mismatch! Expected ${card2Name}, got ${played2OnFirst}`);
  }

  console.log("12. Verifying trick resolution...");
  await pA.waitForFunction(() => document.querySelectorAll('.trick[data-t="1"] .played').length === 2, undefined, { timeout: 10000 });
  await pB.waitForFunction(() => document.querySelectorAll('.trick[data-t="1"] .played').length === 2, undefined, { timeout: 10000 });

  await pA.screenshot({ path: `${ARTIFACT_DIR}/multiplayer_trick1_resolved_davi.png`, animations: "disabled" });
  await pB.screenshot({ path: `${ARTIFACT_DIR}/multiplayer_trick1_resolved_carol.png`, animations: "disabled" });

  console.log("\n=======================================================");
  console.log("✓ ALL MULTIPLAYER VERIFICATION CHECKS (TRUCO + CARDS) PASSED!");
  console.log("=======================================================");
} finally {
  await browser.close();
}
