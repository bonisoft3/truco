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

  pA.on("console", (msg) => console.log(`[pA console] ${msg.type()}: ${msg.text()}`));
  pB.on("console", (msg) => console.log(`[pB console] ${msg.type()}: ${msg.text()}`));

  console.log("1. Opening pA (Davi) and pB (Carol)...");
  await pA.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await pB.goto(`${base}/`, { waitUntil: "domcontentloaded" });

  await pA.locator("#btn-open-online").click();
  await pB.locator("#btn-open-online").click();

  await pA.locator("#my-handle-input").fill("Davi");
  await pA.locator("#btn-save-handle").click();
  await pB.locator("#my-handle-input").fill("Carol");
  await pB.locator("#btn-save-handle").click();

  await pA.waitForTimeout(1000);
  await pB.waitForTimeout(1000);

  console.log("2. Davi challenges Carol...");
  const btnChallengeCarol = pA.locator(".lobby-player-row[data-handle=\"Carol\"] button.btn-challenge");
  await btnChallengeCarol.waitFor({ state: "visible", timeout: 8000 });
  await btnChallengeCarol.click();

  console.log("3. Carol accepts challenge...");
  const bannerB = pB.locator("#incoming-challenge-banner");
  await bannerB.waitFor({ state: "visible", timeout: 8000 });
  await pB.locator("#btn-challenge-accept").click();

  console.log("4. Waiting for game start...");
  await pA.waitForFunction(() => location.search.includes("opponent=online"), { timeout: 10000 });
  await pB.waitForFunction(() => location.search.includes("opponent=online"), { timeout: 10000 });
  await pA.waitForFunction(() => (document.querySelector(".matchbox") as HTMLElement)?.dataset.opponent === "online", { timeout: 10000 });
  await pB.waitForFunction(() => (document.querySelector(".matchbox") as HTMLElement)?.dataset.opponent === "online", { timeout: 10000 });

  const firstPlayer = pA;
  const secondPlayer = pB;
  const firstName = "Davi";
  const secondName = "Carol";
  const firstSeat = "you";
  const secondSeat = "eles1";

  console.log(`First player: ${firstName} (seat: ${firstSeat}), Second player: ${secondName} (seat: ${secondSeat})`);

  console.log("5. Trick 1: First player plays card...");
  await firstPlayer.waitForSelector("#seat-you .card:not([disabled]):not([data-exit])", { timeout: 8000 });
  const card1 = firstPlayer.locator("#seat-you .card:not([disabled]):not([data-exit])").first();
  const card1Name = await card1.getAttribute("data-card");
  console.log(`${firstName} plays: ${card1Name}`);
  await firstPlayer.evaluate(() => (document.querySelector("#seat-you .card:not([disabled]):not([data-exit])") as HTMLElement)?.click());

  console.log(`Waiting for ${secondName} to see card on table...`);
  await secondPlayer.waitForSelector(`.trick[data-t="1"] .played[data-seat="${firstSeat}"]`, { timeout: 8000 });
  console.log(`✓ ${secondName} sees ${card1Name}`);

  console.log(`6. Trick 1: ${secondName} plays card...`);
  await secondPlayer.waitForSelector("#seat-you .card:not([disabled]):not([data-exit])", { timeout: 8000 });
  const card2 = secondPlayer.locator("#seat-you .card:not([disabled]):not([data-exit])").first();
  const card2Name = await card2.getAttribute("data-card");
  console.log(`${secondName} plays: ${card2Name}`);
  await secondPlayer.evaluate(() => (document.querySelector("#seat-you .card:not([disabled]):not([data-exit])") as HTMLElement)?.click());

  console.log(`Waiting for ${firstName} to see card on table...`);
  await firstPlayer.waitForSelector(`.trick[data-t="1"] .played[data-seat="${secondSeat}"]`, { timeout: 8000 });
  console.log(`✓ ${firstName} sees ${card2Name}`);

  console.log("7. Trick 1 resolution delay (beat)...");
  await pA.waitForTimeout(1500);
  await pB.waitForTimeout(1500);

  const t1A = await pA.evaluate(() => ({
    v1: (document.querySelector(".hand") as HTMLElement)?.dataset.v1,
    turn: (document.querySelector(".hand") as HTMLElement)?.dataset.turnSeat,
    said: (document.querySelector(".hand") as HTMLElement)?.dataset.said,
    cards: Array.from(document.querySelectorAll("#seat-you .card")).map((c) => ({
      card: (c as HTMLElement).dataset.card,
      disabled: (c as HTMLButtonElement).disabled,
    })),
  }));
  const t1B = await pB.evaluate(() => ({
    v1: (document.querySelector(".hand") as HTMLElement)?.dataset.v1,
    turn: (document.querySelector(".hand") as HTMLElement)?.dataset.turnSeat,
    said: (document.querySelector(".hand") as HTMLElement)?.dataset.said,
    cards: Array.from(document.querySelectorAll("#seat-you .card")).map((c) => ({
      card: (c as HTMLElement).dataset.card,
      disabled: (c as HTMLButtonElement).disabled,
    })),
  }));
  console.log("Trick 1 status pA:", JSON.stringify(t1A));
  console.log("Trick 1 status pB:", JSON.stringify(t1B));

  const pAEnabled = t1A.cards.filter((c) => !c.disabled).length;
  const pBEnabled = t1B.cards.filter((c) => !c.disabled).length;
  console.log(`Unblocked cards for Trick 2: pA=${pAEnabled}, pB=${pBEnabled}`);

  const leadPlayer = pAEnabled > 0 ? pA : pB;
  const followPlayer = pAEnabled > 0 ? pB : pA;
  const leadName = pAEnabled > 0 ? "Davi" : "Carol";
  const followName = pAEnabled > 0 ? "Carol" : "Davi";
  const leadSeat = pAEnabled > 0 ? "you" : "eles1";
  const followSeat = leadSeat === "you" ? "eles1" : "you";

  console.log(`8. Trick 2: ${leadName} leads Trick 2...`);
  const card3 = leadPlayer.locator("#seat-you .card:not([disabled]):not([data-exit])").first();
  const card3Name = await card3.getAttribute("data-card");
  console.log(`${leadName} plays: ${card3Name}`);
  await leadPlayer.evaluate(() => (document.querySelector("#seat-you .card:not([disabled]):not([data-exit])") as HTMLElement)?.click());

  console.log(`Waiting for ${followName} to see card on table in trick 2...`);
  await followPlayer.waitForSelector(`.trick[data-t="2"] .played[data-seat="${leadSeat}"]`, { timeout: 8000 });
  console.log(`✓ ${followName} sees ${card3Name} in trick 2!`);

  console.log(`9. Trick 2: ${followName} plays card...`);
  await followPlayer.waitForSelector("#seat-you .card:not([disabled]):not([data-exit])", { timeout: 8000 });
  const card4 = followPlayer.locator("#seat-you .card:not([disabled]):not([data-exit])").first();
  const card4Name = await card4.getAttribute("data-card");
  console.log(`${followName} plays: ${card4Name}`);
  await followPlayer.evaluate(() => (document.querySelector("#seat-you .card:not([disabled]):not([data-exit])") as HTMLElement)?.click());

  console.log(`Waiting for ${leadName} to see card on table in trick 2...`);
  await leadPlayer.waitForSelector(`.trick[data-t="2"] .played[data-seat="${followSeat}"]`, { timeout: 8000 });
  console.log(`✓ ${leadName} sees ${card4Name} in trick 2!`);

  console.log("10. Waiting for Trick 2 resolution delay (beat)...");
  await pA.waitForTimeout(1500);
  await pB.waitForTimeout(1500);

  const t2A = await pA.evaluate(() => ({
    cards: Array.from(document.querySelectorAll("#seat-you .card")).map((c) => ({
      card: (c as HTMLElement).dataset.card,
      disabled: (c as HTMLButtonElement).disabled,
    })),
  }));
  const t2B = await pB.evaluate(() => ({
    cards: Array.from(document.querySelectorAll("#seat-you .card")).map((c) => ({
      card: (c as HTMLElement).dataset.card,
      disabled: (c as HTMLButtonElement).disabled,
    })),
  }));

  const handState = await pA.evaluate(() => {
    const h = document.querySelector(".hand") as HTMLElement;
    const m = document.querySelector(".matchbox") as HTMLElement;
    return {
      phase: h?.dataset.phase,
      result: h?.dataset.result,
      v1: h?.dataset.v1,
      v2: h?.dataset.v2,
      v3: h?.dataset.v3,
      handNo: m?.dataset.hand || h?.dataset.handNo || "1",
    };
  });
  console.log("Hand state after Trick 2:", JSON.stringify(handState));
  const handFinished = Boolean(handState.result) || handState.phase === "result" || handState.phase === "payout" || handState.handNo !== "1";
  const pAEnabled3 = t2A.cards.filter((c) => !c.disabled).length;
  const pBEnabled3 = t2B.cards.filter((c) => !c.disabled).length;
  console.log(`Unblocked cards for Trick 3: pA=${pAEnabled3}, pB=${pBEnabled3}`);

  if (!handFinished && (pAEnabled3 > 0 || pBEnabled3 > 0)) {
    const lead3 = pAEnabled3 > 0 ? pA : pB;
    const follow3 = pAEnabled3 > 0 ? pB : pA;
    const leadName3 = pAEnabled3 > 0 ? "Davi" : "Carol";
    const followName3 = pAEnabled3 > 0 ? "Carol" : "Davi";
    const leadSeat3 = pAEnabled3 > 0 ? "you" : "eles1";
    const followSeat3 = leadSeat3 === "you" ? "eles1" : "you";

    console.log(`11. Trick 3: ${leadName3} leads Trick 3...`);
    const card5 = lead3.locator("#seat-you .card:not([disabled]):not([data-exit])").first();
    const card5Name = await card5.getAttribute("data-card");
    console.log(`${leadName3} plays: ${card5Name}`);
    await lead3.evaluate(() => (document.querySelector("#seat-you .card:not([disabled]):not([data-exit])") as HTMLElement)?.click());

    console.log(`Waiting for ${followName3} to see card on table in trick 3...`);
    await follow3.waitForSelector(`.trick[data-t="3"] .played[data-seat="${leadSeat3}"]`, { timeout: 8000 });
    console.log(`✓ ${followName3} sees ${card5Name} in trick 3!`);

    console.log(`12. Trick 3: ${followName3} plays card...`);
    await follow3.waitForSelector("#seat-you .card:not([disabled]):not([data-exit])", { timeout: 8000 });
    const card6 = follow3.locator("#seat-you .card:not([disabled]):not([data-exit])").first();
    const card6Name = await card6.getAttribute("data-card");
    console.log(`${followName3} plays: ${card6Name}`);
    await follow3.evaluate(() => (document.querySelector("#seat-you .card:not([disabled]):not([data-exit])") as HTMLElement)?.click());

    console.log(`Waiting for ${leadName3} to see card on table in trick 3...`);
    await lead3.waitForSelector(`.trick[data-t="3"] .played[data-seat="${followSeat3}"]`, { timeout: 8000 });
    console.log(`✓ ${leadName3} sees ${card6Name} in trick 3!`);
  }

  console.log("13. Waiting for hand resolution & hand advance...");
  await pA.waitForTimeout(4000);
  await pB.waitForTimeout(4000);

  const finalA = await pA.evaluate(() => ({
    handNo: (document.querySelector(".matchbox") as HTMLElement)?.dataset.hand || (document.querySelector(".hand") as HTMLElement)?.dataset.handNo,
    scores: {
      us: document.querySelector(".score.us .figure")?.textContent,
      them: document.querySelector(".score.them .figure")?.textContent,
    },
    cardsCount: document.querySelectorAll("#seat-you .card").length,
    said: (document.querySelector(".hand") as HTMLElement)?.dataset.said,
  }));
  const finalB = await pB.evaluate(() => ({
    handNo: (document.querySelector(".matchbox") as HTMLElement)?.dataset.hand || (document.querySelector(".hand") as HTMLElement)?.dataset.handNo,
    scores: {
      us: document.querySelector(".score.us .figure")?.textContent,
      them: document.querySelector(".score.them .figure")?.textContent,
    },
    cardsCount: document.querySelectorAll("#seat-you .card").length,
    said: (document.querySelector(".hand") as HTMLElement)?.dataset.said,
  }));
  console.log("Final state pA:", JSON.stringify(finalA));
  console.log("Final state pB:", JSON.stringify(finalB));

  await pA.screenshot({ path: `${ARTIFACT_DIR}/hand_sync_pA.png` });
  await pB.screenshot({ path: `${ARTIFACT_DIR}/hand_sync_pB.png` });

} finally {
  await browser.close();
}
