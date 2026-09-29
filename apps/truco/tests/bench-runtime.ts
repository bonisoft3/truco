// Runtime benchmark: what a tab-path app costs to open and to keep open,
// against a crud-path app on the same machine and the same shell.
//
//   deno run -A --unsafely-ignore-certificate-errors bench-runtime.ts <name> <url> <readySelector>

const [name, base, ready] = Deno.args;
const { chromium } = await import("npm:playwright@1.59.1");
const b = await chromium.launch();
const c = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
// An app with an auth gate never mounts a screen without a session; measuring
// its login wall against another app's table is measuring nothing.
const session = await fetch(`${base}/auth/guest`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
}).then((r) => (r.ok ? r.json() : null)).catch(() => null);
if (session) await c.addInitScript((s) => sessionStorage.setItem("pronto-token", JSON.stringify(s)), session);
const p = await c.newPage();

let bytes = 0, requests = 0;
p.on("response", async (r: any) => {
  requests++;
  try { bytes += (await r.body()).length; } catch { /* streamed or aborted */ }
});

const t0 = performance.now();
await p.goto(`${base}/`, { waitUntil: "domcontentloaded" });
const domReady = performance.now() - t0;
// An app with a door: a real reader walks through it, so the benchmark does
// too rather than injecting a session the shell may or may not read.
const guest = p.locator(".login-guest");
if (await guest.count()) {
  await guest.first().click().catch(() => {});
  await p.waitForTimeout(1500);
}
// Time to the app being usable: its own first-screen content on the page.
await p.locator(ready).first().waitFor({ timeout: 30000 }).catch(() => {});
const interactive = performance.now() - t0;
const loadBytes = bytes, loadRequests = requests;

// What it costs to sit there: a tab-path app should ask for nothing.
bytes = 0; requests = 0;
await new Promise((r) => setTimeout(r, 10000));
const idleRequests = requests, idleBytes = bytes;

const mem = await p.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);
const nodes = await p.evaluate(() => document.querySelectorAll("*").length);

console.log(
  `${name.padEnd(8)} dom ${domReady.toFixed(0).padStart(5)}ms  usable ${interactive.toFixed(0).padStart(5)}ms  ` +
  `load ${(loadBytes / 1024).toFixed(0).padStart(4)}KB/${String(loadRequests).padStart(3)}req  ` +
  `idle/10s ${String(idleRequests).padStart(3)}req ${(idleBytes / 1024).toFixed(1).padStart(6)}KB  ` +
  `heap ${(mem / 1048576).toFixed(1)}MB  nodes ${nodes}`,
);
await b.close();
