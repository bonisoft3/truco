import { compileHybrid, type HybridMachine } from "../../../plugins/pronto/hybrid.ts";
import { instrument } from "../../../plugins/omnishell/instrument.ts";
import { ROOT, run } from "../../../plugins/pronto/testdata/hybrid-fixtures.ts";
import { executeHybrid } from "../../../plugins/pronto/hybrid-local.ts";

export const initialMatch = (variant = "mineiro", seating = "1v1") => ({
  phase: "waiting", variant, seating, seats: ["a", "b", "c", "d", "e", "f"].slice(0, seating === "1v1" ? 2 : seating === "2v2" ? 4 : 6), joined: ["a"],
  c: [] as number[], d: [] as number[], e: [] as number[], f: [] as number[], score_c: 0, goal: variant === "gaucho" ? seating === "1v1" ? 18 : 24 : ["argentino", "uruguayo", "paraguayo"].includes(variant) ? 30 : 12,
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
  const result = await run("cue", ["export", "./apps/truco", "-e", "code.state.hybrids.truco_match.reducer"]);
  if (!result.ok) throw new Error(result.err);
  const spec: HybridMachine = JSON.parse(result.out);
  const rules = await Deno.readTextFile(new URL("apps/truco/machines/match.js", ROOT));
  const compiled = await compileHybrid(spec, rules, instrument);
  const step = async (state: Match, kind: string, actor = "a", payload: unknown = {}, now = 1000) => {
    return await executeHybrid(compiled.source, spec.fuel, {
      state, event: {kind, payload: kind === "start" && Object.keys(payload as object).length === 0 ? {seats: state.seats} : payload}, viewers: state.seats,
      context: {actor, tier: ["start", "timeout"].includes(kind) ? "mecha" : "omnishell", now, entropy: "0123456789abcdef".repeat(16)},
    }) as Answer;
  };
  return {spec, rules, compiled, step};
}
