// Spike: what a truco card should look like at the sizes this table uses.
//
// The shipped face is a corner rank and one big pip. A real baralho counts its
// pips and draws its figures. Whether that survives at 53px is not a matter of
// taste, so this renders three faces at the three sizes the fit check measures
// and screenshots them side by side.

const SIZES = [53, 69, 117];
const RANKS = ["4", "5", "6", "7", "Q", "J", "K", "A", "2", "3"];
const SUITS = ["♦", "♠", "♥", "♣"];

/** Pip positions per rank, in a 3-column × 5-row card grid (col, row). */
const PIPS: Record<string, [number, number][]> = {
  "2": [[2, 1], [2, 5]],
  "3": [[2, 1], [2, 3], [2, 5]],
  "4": [[1, 1], [3, 1], [1, 5], [3, 5]],
  "5": [[1, 1], [3, 1], [2, 3], [1, 5], [3, 5]],
  "6": [[1, 1], [3, 1], [1, 3], [3, 3], [1, 5], [3, 5]],
  "7": [[1, 1], [3, 1], [1, 3], [2, 2], [3, 3], [1, 5], [3, 5]],
};

const FIGURE = "QJK";

const faceA = (r: string, s: string) =>
  `<div class="card a"><span class="rank">${r}</span><span class="pip">${s}</span></div>`;

const faceB = (r: string, s: string) => {
  if (FIGURE.includes(r) || r === "A") {
    return `<div class="card b"><span class="corner tl">${r}<i>${s}</i></span>` +
      `<span class="court">${r === "A" ? s : r}</span>` +
      `<span class="corner br">${r}<i>${s}</i></span></div>`;
  }
  const cells = (PIPS[r] ?? []).map(([c, row]) =>
    `<i style="grid-column:${c};grid-row:${row}${row > 3 ? ";rotate:180deg" : ""}">${s}</i>`).join("");
  return `<div class="card b"><span class="corner tl">${r}<i>${s}</i></span>` +
    `<span class="field">${cells}</span>` +
    `<span class="corner br">${r}<i>${s}</i></span></div>`;
};

/** Corner rank both ends, one central mark sized to the rank. */
const faceC = (r: string, s: string) =>
  `<div class="card c"><span class="corner tl">${r}<i>${s}</i></span>` +
  `<span class="mark">${FIGURE.includes(r) ? r : s}</span>` +
  `<span class="corner br">${r}<i>${s}</i></span></div>`;

const deck = (face: (r: string, s: string) => string) =>
  RANKS.map((r) => SUITS.map((s) => face(r, s)).join("")).join("");

const css = `
  body { margin: 0; background: #9E2A24; font: 14px system-ui; }
  h2 { color: #FDF6E7; margin: 14px 8px 6px; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
  .row { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 8px 10px; }
  .card {
    position: relative; box-sizing: border-box;
    inline-size: var(--w); block-size: calc(var(--w) * 1.46);
    border: 1px solid #C7B79A; border-radius: calc(var(--w) * .12);
    background: linear-gradient(158deg,#FFFDF6,#FBF3E2 50%,#EFE2C6);
    color: #221C16; font-weight: 700; overflow: hidden;
  }
  .card.red, .card:has(.red) { color: #A3271F; }
  /* A: what ships */
  .card.a { display: grid; grid-template-rows: auto 1fr; place-items: start center; padding: calc(var(--w)*.08); font-size: calc(var(--w)*.27); }
  .card.a .pip { place-self: center; font-size: calc(var(--w)*.46); line-height: 1; }
  /* B: a counted face */
  .card.b .corner, .card.c .corner { position: absolute; display: grid; justify-items: center; font-size: calc(var(--w)*.24); line-height: .95; }
  .card.b .corner i, .card.c .corner i { font-style: normal; font-size: calc(var(--w)*.2); }
  .card.b .corner.tl, .card.c .corner.tl { inset-block-start: calc(var(--w)*.06); inset-inline-start: calc(var(--w)*.07); }
  .card.b .corner.br, .card.c .corner.br { inset-block-end: calc(var(--w)*.06); inset-inline-end: calc(var(--w)*.07); rotate: 180deg; }
  .card.b .field { position: absolute; inset: calc(var(--w)*.26) calc(var(--w)*.2); display: grid; grid-template-columns: repeat(3,1fr); grid-template-rows: repeat(5,1fr); place-items: center; }
  .card.b .field i { font-style: normal; font-size: calc(var(--w)*.24); line-height: 1; }
  .card.b .court { position: absolute; inset: 0; display: grid; place-items: center; font-size: calc(var(--w)*.5); }
  /* C: corners plus one mark */
  .card.c .mark { position: absolute; inset: 0; display: grid; place-items: center; font-size: calc(var(--w)*.52); }
`;

const html = (w: number) => `<!doctype html><meta charset="utf-8"><style>${css}
  :root { --w: ${w}px; }</style>
  <h2>A — as it ships (${w}px)</h2><div class="row">${deck(faceA)}</div>
  <h2>B — counted pips, courts lettered (${w}px)</h2><div class="row">${deck(faceB)}</div>
  <h2>C — two corners, one mark (${w}px)</h2><div class="row">${deck(faceC)}</div>`;

const { chromium } = await import("npm:playwright@1.61.1");
const out = "/private/tmp/claude-501/-Users-davi-code-trash/cdd66cef-549d-4251-930a-b7997c46990c/scratchpad";
const b = await chromium.launch();
for (const w of SIZES) {
  const p = await (await b.newContext({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 2 })).newPage();
  await p.setContent(html(w));
  // Red suits, the way the app does it.
  await p.evaluate(() => {
    for (const el of document.querySelectorAll(".card")) {
      if (/[♥♦]/.test(el.textContent ?? "")) (el as HTMLElement).style.color = "#A3271F";
    }
  });
  await p.screenshot({ path: `${out}/cards-${w}.png`, fullPage: true });
  console.log(`rendered ${w}px`);
}
await b.close();
