// Benchmark: truco against the other pronto apps in the repo, on what can be
// counted from the source. The question is not "who is bigger" but where the
// tab path and an app-owned engine actually land.

const APPS = ["truco", "thenote", "xpense", "realworld"];
const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

const read = async (p: string) => { try { return await Deno.readTextFile(p); } catch { return ""; } };
const bytes = async (p: string) => { try { return (await Deno.stat(p)).size; } catch { return 0; } };
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const walk = async (dir: string, ext: string) => {
  let total = 0, files = 0;
  try {
    for await (const e of Deno.readDir(dir)) {
      if (e.isDirectory) {
        const sub = await walk(`${dir}/${e.name}`, ext);
        total += sub.total; files += sub.files;
      } else if (e.name.endsWith(ext)) {
        total += (await read(`${dir}/${e.name}`)).split("\n").length;
        files++;
      }
    }
  } catch { /* absent */ }
  return { total, files };
};

const rows: Record<string, string | number>[] = [];
for (const app of APPS) {
  const dir = `${root}/${app}`;
  const ir = await read(`${dir}/ir.html`);
  const program = await read(`${dir}/program.cue`);
  const say = await read(`${dir}/.say.yaml`);
  const shell = await read(`${dir}/shell/shell.yaml`);
  const html = await walk(`${dir}/shell/screens`, ".html");
  const css = await walk(`${dir}/shell/screens`, ".css");
  const shared = await walk(`${dir}/shell/shared`, ".css");
  const handlers = await walk(`${dir}/shell/handlers`, ".js");
  const tests = await walk(`${dir}/tests`, ".ts");
  rows.push({
    app,
    "ir KB": Math.round((await bytes(`${dir}/ir.html`)) / 1024),
    entities: count(program, /path:\s+"/g),
    pipelines: count(ir, /data-kind="pipeline"/g),
    screens: count(ir, /data-kind="screen"/g),
    states: count(ir, /data-kind="state"/g),
    tests: count(ir, /data-kind="test"/g) - 1,
    decisions: count(ir, /data-kind="decision"/g),
    "program LOC": program.split("\n").length,
    "screen LOC": html.total + css.total + shared.total,
    "handler LOC": handlers.total,
    "own tests LOC": tests.total,
    "declared checks": count(say, /^      [a-z-]+:$/gm),
    "shell tables": count(shell, /^ {2}- /gm),
  });
}

const cols = Object.keys(rows[0]);
const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));
console.log(cols.map((c, i) => c.padEnd(w[i])).join("  "));
console.log(w.map((n) => "─".repeat(n)).join("  "));
for (const r of rows) console.log(cols.map((c, i) => String(r[c]).padEnd(w[i])).join("  "));
