# Mecha machine execution proof

The [[2026-10-13-mecha-machine-adoption|adoption proposal]] now has an executable
first slice: a typed, two-seat card-play protocol running the same pure chart
and rules locally and inside PostgreSQL. It validates command serialization,
private projection, refusal and retry behavior. It is not connected to the
Truco screen and does not implement a complete Truco match. The separate
[[online-mecha|online table]] now uses the executor for real 1v1 games.

Run from the repository root, with CUE, Deno and Docker available:

```sh
deno task --config plugins/pronto/deno.json test:mecha
```

The integration suite creates an isolated container from the digest-pinned
Mecha database image and removes it on completion. It does not use or truncate
an app database. The fixture's six distinct cards are fixed test input; it is
not a dealer or an implementation of trick strength and scoring.

## Executable boundary

[[../../../libraries/mecha/machine.cue]] defines the proof's contract, a machine
in XState's `{config, setup}`: bounded state, event and view shapes; event
origin tier; phase transitions; protocol version and fuel budget.
[[../../../plugins/pronto/mecha-reducer.cue]] reads it into the reducer the
compilers take. [[../tests/fixtures/mecha/turn.cue]] supplies the
two-seat chart, and [[../tests/fixtures/mecha/turn.js]] supplies its pure guards,
reductions, invariant and projection. Reducers cannot choose a target phase;
the chart owns it. State-preserving transitions still execute.

[[../../../plugins/pronto/mecha-reducer.ts]] compiles that contract into a shared
compartment program and PostgreSQL command functions. This is a standalone
bounded Mecha compiler, also used by `#App.state.mecha`. Its relational
actions share the existing entity-machine emitter; the pure reducer executor
is shared with local tests. Its one-shot SQL creates a private schema and intentionally
fails if reapplied; upgrade/migration semantics are not implemented.

Both executors use the existing vendored SES and Jessie fuel instrumentation.
Each invocation starts a fresh compartment, receives JSON data with immutable
inputs and returns validated data. The compartment receives no database or
network capability. A final fuel check prevents a rule from catching fuel
exhaustion and reporting a successful transition.

A command is a row the reader inserts, keyed by what it says. Its insert
dispatches it: the actor comes from `auth_uid()`, the instance is locked,
membership is checked and the supplied revision judged. Accepted commands
commit state, revision, every seat's view and the receipt stamped on the row
together. Expected refusals commit only their receipt; program errors roll
back. A resent row is the same row, ignored as a duplicate, and a written row
is sealed. The caller cannot write canonical state or send a Mecha-owned
timeout event. The proof drives the rows directly, not through Electric; the
[[../../../plugins/pronto/docs/cortex|Cortex reference]] defines the protocol
a screen speaks.

## What passes

- Local/PostgreSQL parity for each of six successive plays, including their
  unchanged `playing` phase, and private projections after a move.
- Concurrent different commands at one revision: one accepted move and one
  stale-revision refusal. Concurrent identical commands: one shared receipt.
- Wrong-turn, wrong-card, outsider, forged-timer and extra-payload refusals.
- Direct canonical/private-table access denied; each participant can read only
  their projected hand through the view RPC.
- Expired action versus timeout, duplicate/stale wakes, and an explicit final
  transition refusing subsequent play.
- Transaction rollback leaving neither a move nor a receipt, followed by a
  successful retry with the same ID.
- Successive calls through one database connection after SES lockdown.
- Hidden rule closure state discarded between local invocations, computed
  randomness and constructor escape attempts refused, input mutation refused,
  and an infinite JavaScript loop stopped by fuel.
- Client receipt/view arrival in either order, duplicate messages, stale views,
  unrelated receipts, unknown outcomes and reload of the pending intent.

## Execution timeout

The Mecha database image's `plv8` language is QuickJS's pljs, whose interrupt
handler honours PostgreSQL's statement timeout: a `while (true) {}` probe stops
at a 1.5 s timeout with `InternalError: interrupted`. The instrumented fuel bound
stays, deterministic on every tier; it does not meter native operations such as
regular-expression execution, which the statement timeout bounds.

## Scope of the fixture

The proof has no guest/room creation flow, challenge/seat admission transactions,
Electric authorization, automatic ticker registration, entropy source, scoring,
wagers, bots, complete match, offline save migration or rendered multiplayer UI.
Membership and initial state are installed by the test administrator. Timeout
events are delivered explicitly by the integration test. Private projections
are authored functions checked against a shape; there is no compiler proof of
secret-data noninterference.

The [[online-mecha|app integration]] adds the supported variants and 1×1, 2×2 and 2×2×2 seating, room
admission and HTTP synchronization. Its reference records the remaining
adoption work. No DuckStream executor or external-effect worker is required.
