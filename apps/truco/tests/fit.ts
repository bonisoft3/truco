// The fit check: does every table fit, and can every table be read?
//
//   deno run --unstable-sloppy-imports --allow-read --allow-write --allow-net --allow-env --allow-run --allow-sys --unsafely-ignore-certificate-errors tests/fit.ts .
//   deno run tests/fit.ts --self-test
//
// The checks are the platform's — contrast where the glyphs are, controls
// inside the box that paints them — and the sweep is truco's: the terminal's
// battery opens each route once, at the theme the table boots in, and here a
// cloth changes the ink and a window shape changes what fits. Every window
// shape against every cloth.
//
// Findings print as {severity, path, message} JSON; only `critical` exits
// non-zero, which is the battery's own line.
import { baseUrl } from "../../../plugins/omnishell/base-url.ts";
import { settle } from "../../../plugins/omnishell/check-visual.ts";
import { checkClippedControls } from "../../../plugins/omnishell/src/lint/playwright/checks/clipped-controls.ts";
import { checkContrast } from "../../../plugins/omnishell/src/lint/playwright/checks/contrast.ts";
import type { VisualBug } from "../../../plugins/omnishell/src/lint/playwright/types.ts";

type Finding = { severity: string; path: string; message: string };

const VIEWPORTS = [[390, 844], [375, 667], [1000, 520], [1440, 900], [1680, 1050]] as [number, number][];
const THEMES = ["xadrez", "formica", "madeira", "neon"];
const PICKER = '.picker[data-picker="theme"]';

/** A table is a window shape and a cloth; nothing else tells one run of the
 * battery's checks from another. */
export function finding(vw: number, vh: number, theme: string, bug: VisualBug): Finding {
  return {
    severity: bug.severity,
    path: `${vw}x${vh}/${theme}`,
    message: `${vw}x${vh} on ${theme} [${bug.rule}] ${bug.description}`,
  };
}

// deno-lint-ignore no-explicit-any
type Page = any;

/** How long the table gets to answer: a picker to render off the current
 * match's row, a chosen cloth to come back through the store. */
const TABLE_MS = 30_000;

/** What the page said, for a wait that ran out. The terminal's own wrapper
 * carries neither name nor state — those are the app's, on the [data-screen]
 * section inside it — and what covers a control is as much of the answer as
 * what the control says, so the top layer is named too. */
async function reported(page: Page, said: string[]): Promise<string> {
  const seen = await page.evaluate(() => {
    const screens = [...document.querySelectorAll("[data-screen]")]
      .map((s) => `${s.getAttribute("data-screen")}=${(s as HTMLElement).dataset.state ?? ""}`).join(" ");
    const open = [...document.querySelectorAll("[popover]")]
      .filter((el) => el.matches(":popover-open")).map((el) => el.id || el.className).join(" ");
    const theme = document.querySelector('.picker[data-picker="theme"]');
    return {
      screens,
      open,
      theme: theme ? `${(theme as HTMLElement).dataset.value}` : "no theme picker",
      phase: document.querySelector(".play")?.getAttribute("data-phase") ?? "",
    };
  });
  return [
    `screens: ${seen.screens || "none"}`,
    `theme picker reads: ${seen.theme}`,
    `play phase: ${seen.phase || "none"}`,
    `popovers open: ${seen.open || "none"}`,
    ...said,
  ].join("\n");
}

/** The theme picker, which the arena renders off its current match's row. A
 * table without one has no picker. The picker draws before the first match
 * lands, and a pick made then is refused by its guard (a write there would
 * mint a junk match), so the table has to be seated before the picker is one
 * that answers. Seated is a real id: before the match region binds, the
 * attribute still reads its own "{id}" placeholder. */
async function pickerOf(page: Page, said: string[]): Promise<void> {
  try {
    await page.waitForSelector(`${PICKER} > button`, { timeout: TABLE_MS });
    await page.waitForFunction(
      () => /^m[0-9a-z]+$/.test(document.querySelector(".matchbox")?.getAttribute("data-match-id") ?? ""),
      undefined,
      { timeout: TABLE_MS },
    );
  } catch {
    throw new Error(`the theme picker never rendered over a seated table\n${await reported(page, said)}`);
  }
}

/** The cloth arrives when the row does, not when the click lands. */
async function clothOf(page: Page, theme: string, said: string[]): Promise<void> {
  try {
    await page.waitForFunction(
      ([sel, want]: [string, string]) => document.querySelector(sel)?.getAttribute("data-value") === want,
      [PICKER, theme],
      { timeout: TABLE_MS },
    );
  } catch {
    throw new Error(`the ${theme} cloth never arrived\n${await reported(page, said)}`);
  }
}

async function sweep(browser: Page, base: string, vw: number, vh: number): Promise<Finding[]> {
  const found: Finding[] = [];
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: vw, height: vh } });
  const page = await context.newPage();
  const said: string[] = [];
  page.on("console", (m: { type(): string; text(): string }) => {
    if (m.type() === "error" || m.type() === "warning") said.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e: Error) => said.push(`pageerror: ${e.message}`));
  try {
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
    await pickerOf(page, said);
    for (const theme of THEMES) {
      await page.locator(`${PICKER} > button`).click();
      await page.locator(`${PICKER} [data-opt="${theme}"]`).click();
      await clothOf(page, theme, said);
      if (!(await settle(page))) {
        found.push({ severity: "critical", path: `${vw}x${vh}/${theme}`, message: `${vw}x${vh} on ${theme}: still moving, so everything below measured a moving table` });
      }
      for (const bug of [...await checkClippedControls(page), ...await checkContrast(page)]) {
        found.push(finding(vw, vh, theme, bug));
      }
    }
  } finally {
    await context.close().catch(() => {});
  }
  return found;
}

async function main(appDir: string): Promise<number> {
  const { chromium } = await import("npm:playwright@1.59.1");
  const base = await baseUrl(appDir);
  const browser = await chromium.launch();
  // One context per window shape, all at once: the shapes do not interact —
  // each opens its own table in its own storage — and almost all of the time
  // here is the table settling between cloths, which five can spend together.
  let swept: Finding[][];
  try {
    swept = await Promise.all(VIEWPORTS.map(([vw, vh]) => sweep(browser, base, vw, vh)));
  } finally {
    await browser.close();
  }
  const findings = swept.flat();
  console.log(JSON.stringify(findings, null, 2));
  const critical = findings.filter((f) => f.severity === "critical").length;
  console.error(critical ? `fit: ${critical} critical finding(s); ${findings.length - critical} advisory.` : `fit: no critical findings; ${findings.length} advisory.`);
  return critical ? 1 : 0;
}

function selfTest(): void {
  const eq = (got: unknown, want: unknown, what: string) => {
    const g = JSON.stringify(got), w = JSON.stringify(want);
    if (g !== w) throw new Error(`${what}: got ${g}, want ${w}`);
  };
  // The path is what tells two runs of one check apart in one report: a
  // finding on the neon cloth at 375x667 and the same one on madeira at
  // 1440x900 are two findings.
  eq(
    finding(375, 667, "neon", { rule: "text-contrast", description: '"3" paints #fff on #fff at 11px: 1.00:1, under the 4.5:1 floor', severity: "critical" }),
    {
      severity: "critical",
      path: "375x667/neon",
      message: '375x667 on neon [text-contrast] "3" paints #fff on #fff at 11px: 1.00:1, under the 4.5:1 floor',
    },
    "a finding names its window shape and its cloth",
  );
  eq(VIEWPORTS.length * THEMES.length, 20, "every shape against every cloth");
  console.log("fit: self-test ok");
}

if (import.meta.main) {
  if (Deno.args[0] === "--self-test") {
    selfTest();
    Deno.exit(0);
  }
  if (Deno.args.length === 0) {
    console.error("usage: fit.ts <app dir> | --self-test");
    Deno.exit(1);
  }
  Deno.exit(await main(Deno.args[0]));
}
