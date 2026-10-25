import { fileURLToPath } from "node:url";
import { compileHybrid, type HybridMachine, readCheckInputs, instrument, executeHybrid, ses } from "./platform.ts";

const terminal = { instrument, ses };

const APP_DIR = fileURLToPath(new URL("../", import.meta.url)).replace(/[/\\]$/, "");
let hybridsPromise: Promise<Record<string, HybridMachine>> | undefined;
const compiledFixtures = new Map<string, Promise<{spec: HybridMachine; rules: string; compiled: Awaited<ReturnType<typeof compileHybrid>>}>>();

export const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

export function hybridFixture(name: string) {
  let cached = compiledFixtures.get(name);
  if (!cached) {
    hybridsPromise ??= readCheckInputs<unknown, unknown, unknown, HybridMachine>(APP_DIR).then((inputs) => inputs.hybrids);
    cached = (async () => {
      const hybrids = await hybridsPromise!;
      const spec = hybrids[`truco_${name}`];
      if (!spec) throw new Error(`unknown hybrid machine truco_${name}`);
      const rules = await Deno.readTextFile(`${APP_DIR}/machines/${name}.js`);
      const compiled = await compileHybrid(spec, rules, terminal);
      return {spec, rules, compiled};
    })();
    compiledFixtures.set(name, cached);
  }
  return cached;
}

export const initialMatch = (variant = "mineiro", seating = "1v1") => ({
  phase: "waiting", variant, seating, seats: ["a", "b", "c", "d", "e", "f"].slice(0, seating === "1v1" ? 2 : seating === "2v2" ? 4 : 6), joined: ["a"],
  c: [] as number[], d: [] as number[], e: [] as number[], f: [] as number[], score_c: 0, games_a: 0, games_b: 0, games_c: 0, goal: variant === "gaucho" ? seating === "1v1" ? 18 : 24 : ["argentino", "uruguayo", "paraguayo"].includes(variant) ? 30 : 12,
  folded: [] as string[], answers: [] as string[], envido_chain: [] as string[], envido_caller: "", envido_done: "", envido_scores: [] as {side: string; count: number}[], a: [] as number[], b: [] as number[], score_a: 0, score_b: 0, hand_no: 0,
  leader: "a", turn: "a", stake: 0, offer: 0, caller: "", right: "", brink: "", result: "", winner: "", vira: -1,
  deadline: 0, turn_ms: 20000, reserved: false, talk: "talk-of-the-table", tricks: [] as string[], plays: [] as {seat: string; card: number; covered: boolean; trick: number; slot: number}[],
  log: [] as {seat: string; kind: string; count: number; at: number}[],
});
export type Match = ReturnType<typeof initialMatch>;
export type View = Omit<Match, "a" | "b" | "c" | "d" | "e" | "f"> & {seat: string; hand: number[]; available: number[]; opponent_count: number; side: string; actions: string[]; partners: {seat: string; hand: number[]}[]};
export type Snapshot = {revision: string; value: View};
export type Answer = {kind: string; reason?: string; state: Match; views: {viewer: string; value: View}[]};
export async function matchFixture() {
  const {spec, rules, compiled} = await hybridFixture("match");
  const step = async (state: Match, kind: string, actor = "a", payload: unknown = {}, now = 1000) => {
    return await executeHybrid(compiled.source, spec.fuel, {
      state, event: {kind, payload: kind === "start" && Object.keys(payload as object).length === 0 ? {seats: state.seats} : payload}, viewers: state.seats,
      context: {actor, tier: ["start", "timeout"].includes(kind) ? "mecha" : "omnishell", now, entropy: "0123456789abcdef".repeat(16)},
    }) as Answer;
  };
  return {spec, rules, compiled, step};
}
