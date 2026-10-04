import { chromium } from "npm:playwright@1.61.1";
import { baseUrl } from "../../../plugins/omnishell/base-url.ts";

const APP = ".";

const base = await baseUrl(APP);
console.log(`Connecting to Truco stack at ${base}...`);

const browser = await chromium.launch({ headless: true });

try {
  console.log("\n=======================================================");
  console.log("TEST: Online Resignation and Durability Reconnect Escape");
  console.log("=======================================================");

  await new Deno.Command("docker", {
    args: ["exec", "-i", "truco-database-1", "psql", "-U", "postgres", "-d", "truco", "-c", "TRUNCATE lobby, challenge, room_action;"],
    cwd: APP,
  }).output();

  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });

  const pA = await ctxA.newPage();
  const pB = await ctxB.newPage();
  pA.on("console", (msg) => console.log(`[pA console] ${msg.type()}: ${msg.text()}`));
  pA.on("pageerror", (err) => console.error(`[pA pageerror]`, err));
  pB.on("console", (msg) => console.log(`[pB console] ${msg.type()}: ${msg.text()}`));
  pB.on("pageerror", (err) => console.error(`[pB pageerror]`, err));

  console.log("1. Opening Davi and Carol...");
  await pA.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await pB.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await pA.waitForFunction(() => document.querySelector("#modal-online")?.getAttribute("data-wired") === "1", undefined, { timeout: 15000 });
  await pB.waitForFunction(() => document.querySelector("#modal-online")?.getAttribute("data-wired") === "1", undefined, { timeout: 15000 });

  console.log("2. Opening modal and setting handles...");
  await pA.evaluate(() => (document.querySelector("#btn-open-online") as HTMLElement)?.click());
  await pB.evaluate(() => (document.querySelector("#btn-open-online") as HTMLElement)?.click());
  await pA.waitForFunction(() => document.querySelector("#modal-online")?.matches(":popover-open"), undefined, { timeout: 5000 });
  await pB.waitForFunction(() => document.querySelector("#modal-online")?.matches(":popover-open"), undefined, { timeout: 5000 });

  await pA.evaluate(() => {
    const inp = document.querySelector("#my-handle-input") as HTMLInputElement;
    inp.value = "Davi";
    (document.querySelector("#btn-save-handle") as HTMLElement)?.click();
  });
  await pB.evaluate(() => {
    const inp = document.querySelector("#my-handle-input") as HTMLInputElement;
    inp.value = "Carol";
    (document.querySelector("#btn-save-handle") as HTMLElement)?.click();
  });

  console.log("3. Davi challenges Carol...");
  await pA.waitForFunction(() => {
    const rows = Array.from(document.querySelectorAll(".lobby-player-row"));
    return rows.some(el => el.textContent?.includes("Carol"));
  }, undefined, { timeout: 15000 });
  await pB.waitForFunction(() => {
    const rows = Array.from(document.querySelectorAll(".lobby-player-row"));
    return rows.some(el => el.textContent?.includes("Davi"));
  }, undefined, { timeout: 15000 });

  await pA.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".lobby-player-row"));
    const carolRow = rows.find(el => el.textContent?.includes("Carol"));
    (carolRow?.querySelector(".btn-challenge") as HTMLElement)?.click();
  });

  console.log("4. Carol accepts challenge...");
  await pB.waitForSelector("#incoming-challenge-banner:not([style*='display: none'])", { timeout: 10000 });
  await pB.evaluate(() => {
    (document.querySelector("#btn-challenge-accept") as HTMLElement)?.click();
  });

  console.log("5. Waiting for online match to start on both screens...");
  await pA.waitForFunction(() => {
    const box = document.querySelector(".matchbox") as HTMLElement;
    return box && box.dataset.opponent === "online" && box.dataset.status === "playing";
  }, undefined, { timeout: 15000 });
  await pB.waitForFunction(() => {
    const box = document.querySelector(".matchbox") as HTMLElement;
    return box && box.dataset.opponent === "online" && box.dataset.status === "playing";
  }, undefined, { timeout: 15000 });
  console.log("✓ Both screens in active online match!");

  // There is exactly one way to abandon, and it is the one beside the hand.
  // The seatbar carried a second copy of it in the lowest-contrast ink on the
  // screen; the bar is settings now, and the only destructive control on the
  // table sits with the cards it destroys.
  const hasResignBtnA = await pA.evaluate(() => {
    const btnResign = document.querySelector("#btn-resign");
    return {
      onTheBoard: document.querySelectorAll(".board [id$='resign']").length,
      hasResign: !!btnResign,
      display: btnResign ? getComputedStyle(btnResign).display : null,
    };
  });
  console.log("Resign button on Player A:", hasResignBtnA);
  if (!hasResignBtnA.hasResign || hasResignBtnA.display === "none" || hasResignBtnA.onTheBoard !== 1) {
    throw new Error(`the one Abandonar is not the one beside the hand: ${JSON.stringify(hasResignBtnA)}`);
  }

  console.log("7. Carol clicks Abandonar...");
  await pB.evaluate(() => {
    (document.querySelector("#btn-resign") as HTMLElement)?.click();
  });

  console.log("8. Verifying Carol state after resignation...");
  await pB.waitForFunction(() => {
    const box = document.querySelector(".matchbox") as HTMLElement;
    return box && box.dataset.status === "over";
  }, undefined, { timeout: 10000 });

  const carolState = await pB.evaluate(() => {
    const box = document.querySelector(".matchbox") as HTMLElement;
    const overSay = document.querySelector("#over-say")?.textContent;
    return {
      status: box.dataset.status,
      winner: box.dataset.winner,
      scoreThem: box.dataset.them,
      overSay,
      sessionSeat: sessionStorage.getItem("truco-seat"),
      sessionOpponent: sessionStorage.getItem("truco-opponent-name"),
      url: location.href,
    };
  });
  console.log("Carol post-resign state:", carolState);
  if (carolState.status !== "over" || carolState.winner !== "them" || carolState.scoreThem !== "12") {
    throw new Error(`Carol state mismatch: ${JSON.stringify(carolState)}`);
  }
  if (!carolState.overSay?.includes("abandonou")) {
    throw new Error(`Expected resignation message in overSay, got: ${carolState.overSay}`);
  }
  if (carolState.sessionSeat !== null || carolState.url.includes("opponent=online")) {
    throw new Error(`Carol session or URL not cleared: ${JSON.stringify(carolState)}`);
  }
  console.log("✓ Carol forfeit registered locally and session cleared!");

  console.log("9. Waiting for Davi to receive remote forfeit notification...");
  await pA.waitForFunction(() => {
    const box = document.querySelector(".matchbox") as HTMLElement;
    return box && box.dataset.status === "over";
  }, undefined, { timeout: 15000 });

  const daviState = await pA.evaluate(() => {
    const box = document.querySelector(".matchbox") as HTMLElement;
    const overSay = document.querySelector("#over-say")?.textContent;
    return {
      status: box.dataset.status,
      winner: box.dataset.winner,
      scoreUs: box.dataset.us,
      overSay,
    };
  });
  console.log("Davi post-forfeit state:", daviState);
  if (daviState.status !== "over" || daviState.winner !== "us" || daviState.scoreUs !== "12") {
    throw new Error(`Davi state mismatch: ${JSON.stringify(daviState)}`);
  }
  if (!daviState.overSay?.includes("Carol abandonou a partida")) {
    throw new Error(`Expected Carol abandon message for Davi, got: ${daviState.overSay}`);
  }
  console.log("✓ Davi successfully received Carol's forfeit and won the match!");

  console.log("10. Testing durability reload escape for Carol...");
  await pB.reload({ waitUntil: "domcontentloaded" });
  await pB.waitForFunction(() => {
    const box = document.querySelector(".matchbox") as HTMLElement;
    return box && box.dataset.status && box.dataset.status !== "{status}";
  }, undefined, { timeout: 10000 });

  const carolReloadState = await pB.evaluate(() => {
    const box = document.querySelector(".matchbox") as HTMLElement;
    return {
      status: box.dataset.status,
      opponent: box.dataset.opponent,
      url: location.href,
    };
  });
  console.log("Carol reload state:", carolReloadState);
  if (carolReloadState.status === "playing" && carolReloadState.opponent === "online") {
    throw new Error(`Carol still trapped in online playing match after reload: ${JSON.stringify(carolReloadState)}`);
  }
  if (carolReloadState.status === "over") {
    await pB.evaluate(() => {
      (document.querySelector("#btn-again") as HTMLElement)?.click();
    });
    await pB.waitForFunction(() => {
      const box = document.querySelector(".matchbox") as HTMLElement;
      return box && box.dataset.status === "playing" && box.dataset.opponent === "nezinho";
    }, undefined, { timeout: 10000 });
  } else if (!(carolReloadState.status === "playing" && carolReloadState.opponent === "nezinho")) {
    // Already back at a bot table is the other way out of the trap, and it
    // needs no press; anything else is Carol still stuck.
    throw new Error(`Unexpected Carol reload state: ${JSON.stringify(carolReloadState)}`);
  }
  console.log("✓ Carol successfully escaped durability trap into default offline mode against Nezinho!");

  console.log("11. Testing Davi Outra partida click...");
  await pA.evaluate(() => {
    (document.querySelector("#btn-again") as HTMLElement)?.click();
  });
  await pA.waitForFunction(() => {
    const box = document.querySelector(".matchbox") as HTMLElement;
    return box && box.dataset.status === "playing" && box.dataset.opponent === "nezinho";
  }, undefined, { timeout: 10000 });
  console.log("✓ Davi restarted offline match against Nezinho!");

  console.log("\n=======================================================");
  console.log("✓ ALL ONLINE RESIGNATION & DURABILITY CHECKS PASSED!");
  console.log("=======================================================\n");

} finally {
  await browser.close();
}
