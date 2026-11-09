// Truco's Mecha machines as pronto emitted them, stepped in the executor PLV8
// runs.
import { executeMecha, type Machine } from "./platform.ts";

const APP = new URL("../", import.meta.url);
const emitted = async <T>(path: string) => JSON.parse(await Deno.readTextFile(new URL(path, APP))) as T;
/** A machine's chart as the compilers read it: what the harness walks, its
 * protocol version, and the requirements its transitions state. */
export type Spec = Machine & { version: number; states: Record<string, { on: Record<string, { requires?: { sql: string; reason: string }[] }> }> };
// Each machine's chart, and its step compiled as PostgreSQL runs it.
let reducers: Promise<Record<string, Spec>> | undefined;
let compiled: Promise<Record<string, { source: string; engine: { sha256: string } }>> | undefined;

export const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

export async function mechaFixture(name: string) {
  reducers ??= emitted<{ reducers: Record<string, Spec> }>(".pronto/check-inputs.json").then((inputs) => inputs.reducers);
  compiled ??= emitted<Record<string, { source: string; engine: { sha256: string } }>>(".pronto/mecha-reducers.json");
  const spec = (await reducers)[`truco_${name}`];
  const source = (await compiled)[`truco_${name}`]?.source;
  if (!spec || !source) throw new Error(`unknown mecha machine truco_${name}`);
  return { spec, source };
}

/** The sha256 of `truco_<name>`'s engine statement as pronto compiles it today. */
export async function engine(name: string): Promise<string> {
  compiled ??= emitted<Record<string, { source: string; engine: { sha256: string } }>>(".pronto/mecha-reducers.json");
  const found = (await compiled)[`truco_${name}`]?.engine.sha256;
  if (!found) throw new Error(`no compiled engine for truco_${name}`);
  return found;
}

/** The sha256 of `text` as lowercase hex, as .pronto/mecha-reducers.json spells an engine's. */
export async function sha256(text: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
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
  const {spec, source} = await mechaFixture("match");
  const step = async (state: Match, kind: string, actor = "a", payload: unknown = {}, now = 1000) => {
    return await executeMecha(source, spec.fuel, {
      state, event: {kind, payload: kind === "start" && Object.keys(payload as object).length === 0 ? {seats: state.seats} : payload}, viewers: state.seats,
      context: {actor, tier: ["start", "timeout"].includes(kind) ? "mecha" : "omnishell", now, entropy: "0123456789abcdef".repeat(16)},
    }) as Answer;
  };
  return {spec, source, step};
}
