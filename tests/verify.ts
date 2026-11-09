/// <reference lib="dom" />

export const journeys = [{
  screen: "arena",
  async run(page: any, ctx: { baseUrl: string }) {
    const response = await page.goto(`${ctx.baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (!response || response.status() !== 200) throw new Error("arena: navigation failed");

    await page.waitForFunction(() => {
      const cards = document.querySelectorAll(".seat-row.mine .card:not([disabled])");
      return cards.length === 3 && document.querySelector(".play")?.getAttribute("data-phase") === "your-turn";
    }, null, { timeout: 30000 });

    // Switch to Paraguay match via the country picker
    await page.locator("#picker-open-country").click();
    await page.locator("#country-es-PY").click();
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll(".seat-row.mine .card:not([disabled])");
      return document.querySelector(".screen")?.getAttribute("data-locale") === "es-PY" &&
        cards.length === 3 &&
        document.querySelector(".play")?.getAttribute("data-phase") === "your-turn";
    }, null, { timeout: 15000 });

    // Play opening card in Paraguay match
    await page.locator(".seat-row.mine .card:not([disabled])").first().click();

    // Wait for house response (either envido challenge, truco raise, or card play on the felt)
    await page.waitForFunction(() => {
      const play = document.querySelector(".play");
      const hand = document.querySelector(".hand");
      const phase = play?.getAttribute("data-phase");
      const envidoAsked = hand?.getAttribute("data-envido-asked") ?? "";
      const tableCards = document.querySelectorAll(".trick .played").length;
      return envidoAsked !== "" || phase === "raised" || phase === "resolved" || tableCards >= 2;
    }, null, { timeout: 15000 });

    // If the house called envido, answer it and verify the match advances
    const envidoAsked = await page.locator(".hand").getAttribute("data-envido-asked");
    if (envidoAsked) {
      const playPhase = await page.locator(".play").getAttribute("data-phase");
      if (playPhase !== "your-turn") {
        throw new Error(`arena(/py): expected data-phase="your-turn" when answering house envido, got "${playPhase}"`);
      }
      await page.locator("#btn-envido-take").click();
      await page.waitForFunction(() => {
        return (document.querySelector(".hand")?.getAttribute("data-envido-asked") ?? "") === "" &&
          document.querySelectorAll(".trick .played").length >= 2;
      }, null, { timeout: 15000 });
    }

    // Click Abandonar (#btn-resign) and verify match ends cleanly with held cards cleared
    await page.locator("#btn-resign").click();
    await page.waitForFunction(() => {
      const phase = document.querySelector(".play")?.getAttribute("data-phase");
      const remainingCards = document.querySelectorAll(".seat-row.mine .card").length;
      const overSay = document.querySelector("#over-say")?.textContent?.trim() ?? "";
      return phase === "over" && remainingCards === 0 && overSay.length > 0;
    }, null, { timeout: 15000 });
  },
}];
