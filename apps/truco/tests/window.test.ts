// Spatial geometry and window layout invariants for Truco against a real browser.
// Layout and CSS transitions are verified across viewport sizes:
// 1. The page never exceeds viewport height (no accidental scrollbars).
// 2. Trick cards maintain consistent height and baseline across rodadas (zero card shrink or upward creep).
// 3. Action buttons and rematch affordances remain visible, unoccluded, and within viewport.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { baseUrl } from "../../../plugins/omnishell/base-url.ts";

const APP = ".";
const BASE = Deno.env.get("TRUCO_URL") ?? await baseUrl(APP);
const SIZES: [number, number][] = [[1440, 900], [1280, 800], [390, 844]];

// deno-lint-ignore no-explicit-any
type Page = any;

const onTable = async (width: number, height: number, fn: (page: Page) => Promise<void>) => {
  const { chromium } = await import("npm:playwright@1.59.1");
  const browser = await chromium.launch({ headless: true, args: ["--ignore-certificate-errors"] });
  try {
    const page = await browser.newPage({
      viewport: { width, height },
      ignoreHTTPSErrors: true,
    });
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForSelector(".board.table-frame", { timeout: 25000 });
    // Wait for the seated match
    await page.waitForFunction(
      () => /^m[0-9a-z]+$/.test(document.querySelector(".matchbox")?.getAttribute("data-match-id") ?? ""),
      undefined,
      { timeout: 25000 },
    );
    await fn(page);
  } finally {
    await browser.close();
  }
};

const assertFits = async (page: Page, when: string) => {
  const { height, width } = page.viewportSize();
  const tall = await page.evaluate(() => document.scrollingElement!.scrollHeight);
  if (tall > height) {
    const layout = await page.evaluate(() => {
      const screen = document.querySelector<HTMLElement>('[data-screen="arena"]');
      const nav = document.querySelector<HTMLElement>("body > nav");
      return {
        nav: nav?.getBoundingClientRect().height,
        screen: screen?.getBoundingClientRect().height,
        app: document.querySelector<HTMLElement>("#app")?.getBoundingClientRect().height,
        appScroll: document.querySelector<HTMLElement>("#app")?.scrollHeight,
        body: document.body.getBoundingClientRect().height,
        bodyScroll: document.body.scrollHeight,
        overflow: [...document.querySelectorAll<HTMLElement>("body *")]
          .map((el) => ({ el, box: el.getBoundingClientRect() }))
          .filter(({ box }) => box.bottom > innerHeight + 1)
          .sort((a, b) => b.box.bottom - a.box.bottom)
          .slice(0, 8)
          .map(({ el, box }) => ({ tag: el.tagName, class: el.className, id: el.id, bottom: box.bottom, position: getComputedStyle(el).position })),
        scrolling: [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((el) => el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1)
          .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))
          .slice(0, 8)
          .map((el) => ({ tag: el.tagName, class: el.className, id: el.id, client: el.clientHeight, scroll: el.scrollHeight, overflow: getComputedStyle(el).overflowY })),
        display: screen && getComputedStyle(screen).display,
      };
    });
    assert(tall <= height, `${when}: page is ${tall}px tall in a ${height}px window (vertical overflow): ${JSON.stringify(layout)}`);
  }

  const wide = await page.evaluate(() => document.scrollingElement!.scrollWidth);
  assert(wide <= width, `${when}: page is ${wide}px wide in a ${width}px window (horizontal overflow)`);

  // Key controls inside viewport
  const bar = await page.locator(".seatbar").boundingBox();
  assert(bar !== null && bar.y >= 0 && bar.y + bar.height <= height, `${when}: .seatbar is out of view`);

  const scores = await page.locator(".scores").boundingBox();
  assert(scores !== null && scores.y >= 0 && scores.y + scores.height <= height, `${when}: .scores is out of view`);

  const actions = await page.locator(".actions").boundingBox();
  if (actions) {
    assert(actions.y + actions.height <= height, `${when}: .actions overflow window bottom`);
  }
};

async function main() {
  console.log(`[window.test.ts] Starting Truco window invariants test suite against ${BASE}...`);

  for (const [width, height] of SIZES) {
    console.log(`\nChecking layout fit at ${width}x${height}...`);
    await onTable(width, height, async (page) => {
      await assertFits(page, `initial mount at ${width}x${height}`);

      // Verify shout non-occlusion and pointer-events
      const shoutPointerEvents = await page.evaluate(() => {
        const s = document.querySelector(".shout");
        return s ? getComputedStyle(s).pointerEvents : "none";
      });
      assertEquals(shoutPointerEvents, "none", "shout banner must have pointer-events: none to avoid blocking clicks");

      // Verify card dealing fan is centered and inside viewport
      const handCards = await page.locator(".seat-row.mine .card").all();
      assert(handCards.length >= 1, "at least one card dealt in hand");
      for (let i = 0; i < handCards.length; i++) {
        const box = await handCards[i].boundingBox();
        assert(box !== null, `card ${i} has no bounding box`);
        assert(box.y >= 0 && box.y + box.height <= height, `card ${i} vertically out of view`);
        assert(box.x >= 0 && box.x + box.width <= width, `card ${i} horizontally out of view`);
      }

      // Play card from hand to trick 1
      const firstCard = page.locator(".seat-row.mine .card:not([disabled])").first();
      if (await firstCard.count() > 0) {
        await firstCard.click();
        await page.waitForTimeout(600);

        // Verify trick 1 card presence
        const trick1Cards = await page.locator('.trick[data-t="1"] .played .card').all();
        assert(trick1Cards.length >= 1, "trick 1 card landed on table");

        const t1Box = await trick1Cards[0].boundingBox();
        assert(t1Box !== null, "trick 1 card has valid bounding box");

        // Opacity invariant: table cards are opaque cardstock, never transparent
        const opacities = await page.evaluate(() => {
          return Array.from(document.querySelectorAll(".trick .card")).map((c) => getComputedStyle(c).opacity);
        });
        for (const op of opacities) {
          assertEquals(op, "1", "trick cards must have opacity: 1");
        }

        // Verify matcards baseline stability
        const mat = await page.locator("#matcards").boundingBox();
        assert(mat !== null, "matcards has bounding box");
        assert(mat.y >= 0 && mat.y + mat.height <= height, "matcards fits within viewport");
      }
    });
  }

  console.log("\nChecking trick spatial alignment invariants (no card creep/shrinking across rodadas)...");
  await onTable(1280, 800, async (page) => {
    // Play trick 1
    const card1 = page.locator(".seat-row.mine .card:not([disabled])").first();
    await card1.click();
    await page.waitForTimeout(1000);

    const trick1Cards = await page.locator('.trick[data-t="1"] .played .card').all();
    assert(trick1Cards.length >= 1, "trick 1 has cards");
    const t1Box = await trick1Cards[0].boundingBox();
    assert(t1Box !== null, "trick 1 card box found");

    // Advance table if bot didn't play automatically
    await page.evaluate(() => {
      const btn = document.querySelector("#btn-next") as HTMLButtonElement | null;
      if (btn && !btn.disabled && getComputedStyle(btn).display !== "none") btn.click();
    });
    await page.waitForTimeout(400);

    // Play trick 2 if hand still held
    const card2 = page.locator(".seat-row.mine .card:not([disabled])").first();
    if (await card2.count() > 0) {
      await card2.click();
      await page.waitForTimeout(1000);

      const trick2Cards = await page.locator('.trick[data-t="2"] .played .card').all();
      if (trick2Cards.length >= 1) {
        const t2Box = await trick2Cards[0].boundingBox();
        assert(t2Box !== null, "trick 2 card box found");

        // Spatial invariant: Card height must remain stable (no 18% shrinking down to scale 0.82)
        const heightRatio = t2Box.height / t1Box.height;
        assert(
          heightRatio >= 0.95 && heightRatio <= 1.05,
          `Card height altered across tricks: trick 1 was ${t1Box.height}px, trick 2 is ${t2Box.height}px (ratio ${heightRatio})`,
        );

        // Baseline invariant: Cards in trick 1 and trick 2 sit at comparable baseline on table
        const baselineDelta = Math.abs((t1Box.y + t1Box.height) - (t2Box.y + t2Box.height));
        assert(
          baselineDelta <= 20,
          `Card baseline drifted upwards between tricks: delta is ${baselineDelta}px`,
        );
        // Opacity invariant: Physical cards are solid cardstock; never translucent cellophane
        const opacities = await page.evaluate(() => {
          return Array.from(document.querySelectorAll(".trick .played .card")).map((el) => getComputedStyle(el).opacity);
        });
        for (const op of opacities) {
          assertEquals(op, "1", "played cards must be 100% opaque without alpha transparency bleed");
        }
        console.log(`✓ Card opacity invariant: all ${opacities.length} table cards strictly opaque (1.0)`);

        // Stacking invariant: sequentially played cards physically stack on top (later cards over earlier)
        const stacking = await page.evaluate(() => {
          const played = Array.from(document.querySelectorAll('.trick[data-t="1"] .played')) as HTMLElement[];
          if (played.length < 2) return null;
          const z0 = parseInt(getComputedStyle(played[0]).zIndex) || 0;
          const z1 = parseInt(getComputedStyle(played[1]).zIndex) || 0;
          const trick = document.querySelector('.trick[data-t="1"]') as HTMLElement;
          const trickBorder = getComputedStyle(trick).borderStyle;
          return { z0, z1, trickBorder };
        });
        if (stacking) {
          assert(stacking.z1 > stacking.z0, `sequentially played card must have higher z-index (card 0: ${stacking.z0}, card 1: ${stacking.z1})`);
          assert(stacking.trickBorder === "none", `trick container must not have artificial grouping border: got ${stacking.trickBorder}`);
          console.log(`✓ Stacking & border invariant: later card has higher z-index (${stacking.z1} > ${stacking.z0}), trick border is none`);
        }
      }
    }
  });

  console.log("\nChecking match completion & rematch affordance...");
  await onTable(1280, 800, async (page) => {
    // Resign match to trigger match over state
    const resign = page.locator("#btn-resign");
    if (await resign.count() > 0 && await resign.isVisible()) {
      await resign.click();
      await page.waitForTimeout(800);

      // Verify #btn-again is visible and in view
      const again = page.locator("#btn-again");
      assert(await again.isVisible(), "rematch button #btn-again must be visible after match over");

      const againBox = await again.boundingBox();
      assert(againBox !== null, "#btn-again must have valid bounding box");
      assert(againBox.y >= 0 && againBox.y + againBox.height <= 800, "#btn-again must be inside window viewport");

      const againOpacity = await again.evaluate((el: HTMLElement) => getComputedStyle(el).opacity);
      assertEquals(againOpacity, "1", "#btn-again must have opacity: 1");

      const againPointer = await again.evaluate((el: HTMLElement) => getComputedStyle(el).pointerEvents);
      assertEquals(againPointer, "auto", "#btn-again must have pointer-events: auto");
      console.log("✓ Rematch affordance #btn-again is visible, interactive, and within viewport");
    }
  });

  console.log("\n[window.test.ts] All spatial and window layout invariants passed successfully ✓");
}

if (import.meta.main) {
  await main();
}
