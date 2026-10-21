---
type: decision
title: Hybrid machines for Truco online play
status: partially-built
---

# Hybrid machines for Truco online play

Make Truco the first executable contract for cross-tier hybrid machines, before
DuckStream. Online games have one database authority; browsers submit commands
and render authorized projections. Offline games execute the same domain chart
and pure rules locally. A single authored composition defines both the domain
protocol and its client interactions, including rejection, retry and recovery.

Success means complete online matches that survive concurrent actions, missing
responses, disconnects and reloads. Moving the existing callbacks into chart
syntax without changing who owns the game would preserve the current defects.

The [[hybrid-machine-proof|execution proof]] implements the first isolated
command/reducer slice. It records the tested behavior and the advisory PLV8
timeout verification gap. Adoption proceeds under the assumed timeout contract;
runtime verification does not block connecting the executor to the app.
The [[online-hybrid|online table reference]] records the implemented online modes, presence and
challenge machines, and their limits. This decision remains partially built until the rest of the
app adopts the composition.

## What the current code tells us

Inspected baseline: `3ff57d32b32cd5472df19da9a01a499620806b0f`.
These are source-level findings, not results from a running multiplayer stack.

| Evidence | Consequence for the migration |
| --- | --- |
| [[../program.cue]] makes `Match` device-held and `Round`, `Play`, `Held` tab-held. Only lobby, challenges and room actions are live. | Online participants each own a separate game; the database has no authoritative match, turn or score. |
| [[../shell/handlers/table.js]] reconstructs the deck from `match.seed` and hand number, then creates actual cards for every seat (around lines 960–1080). The same seed identifies the online room. | Masking the DOM does not protect opponents' cards or future deals. Room identity and secret entropy must be separate. |
| The handler accepts a remote play by card, then slot, then `hand[0]` (around line 2286). | A malformed or stale action can become a different move instead of being refused. |
| [[../services/database/sql/012_lobby.sql]] allows anonymous challenge updates and accepts room actions without checking seat ownership, turn, hand or card ownership; [[../services/database/sql/013_networked_shouts.sql]] widens the action vocabulary without adding those checks. | The database cannot arbitrate disagreement or prevent a client impersonating another seat. |
| `round_machine.cue` defines wager and envido charts; [[../arena.cue]] attaches them to controls that also call `table`. `#TrickMachine` is defined but not attached there. | There is no single transition source. Adding another server chart alongside these is insufficient. |
| The handler writes fixed September 2026 UI and backend deadlines (lines 1046–1047 and 1441–1442). | The documented authoritative turn clock is not implemented by these fields. |
| [[../shell/hatches/dealer.js]] owns URL/session state, challenge writes, subscriptions, lobby presence and DOM-triggered game entry. `ensureChallengeSub` marks itself subscribed before checking whether the client exists. | Initialization order can lose a subscription; lifecycle and asynchronous answers must be represented explicitly. |
| The handler disables envido/flor online through `!shared`; accepted challenges enter `1v1`; selectable player seats stop at four despite six-seat local variants. | “All Truco” includes more than the current online action vocabulary and two-player handshake. |
| [[../tests/arena.test.ts]] runs with `mountHostDom: false`. At the inspected baseline, the now-retired `challenge_handshake.test.ts` checked a mocked update, and `verify-full-multiplayer-match.ts` stopped after the first trick with hard-coded developer paths. | Those checks did not establish full-stack, full-match correctness. The online suite now replaces the retired relay tests; see [[online-hybrid]]. |

The [[../../../plugins/pronto/docs/decisions/2026-09-29-hybrid-machines.md|hybrid-machine decision]]
identifies Truco as the Cortex oracle. At the inspected baseline Truco declared
no `state.machines` or `010_machines.sql`. The new app integration uses
`state.hybrids` and emits `016_mecha_actors.sql`; it is not full Cortex
adoption. Implementation must also reconcile the stale brief with the supported
variants.

## The framework slice Truco needs

Reuse the existing [[../../../plugins/omnishell/docs/machines.md|browser machines]],
[[../../../libraries/mecha/docs/machines.md|Mecha transactions and timers]],
[[../../../plugins/pronto/docs/access.md|access declarations]], guest tokens and
Electric delivery. Add the cross-tier composition and command semantics that
join them. Truco requires no external effect, airlock job, streaming join, lake,
Feldera runtime or DuckDB-WASM engine.

An HTTP command to the application's own database is a replicated operation;
it does not become a Level 4 external effect merely because a browser awaits it.
Do not make the airlock the game loop. DuckStream can remain a future actor kind
without being imported or deployed by this composition.

### One composition with explicitly scoped instances

“One machine” must mean one authored protocol, not one global state column that
moves between browsers. A match can be awaiting a move while one participant is
reconnecting and another is animating the previous move. Model these as composed
actors/regions with explicit identity:

- One domain instance per match, owned by Mecha online or the local executor offline.
- One interaction instance per browser session and match, owned by Omnishell.
- One command instance per intent, correlated across both tiers.
- Room, challenge and presence instances with their own keys and lifetimes.

The compiler projects this composition into tier-specific charts. Authors do
not maintain separate copies of the protocol. Tier ownership never transfers
the online match to a browser; a cross-tier arrow sends a typed message and
awaits a typed answer.

The minimum authoring contract declares:

| Part | Required meaning |
| --- | --- |
| Instance and version | Actor key, parent key, protocol version and stable state/event identities. |
| Ownership | Tier for each region/state, readable inputs and writable entities/fields. Browser projections are read-only even though they use `live` durability. |
| Transition | Typed domain event, guard, pure reduction and declared effects. State-preserving actions still execute exactly once per command. |
| Cross-tier command | Input/output schemas, authenticated actor, correlation key, expected game revision and declared refusal reasons. |
| Delivery | Distinguish queued, accepted, rejected and unknown; duplicate replies and retries do not retrigger domain transitions. |
| Time | Declared authoritative deadline, timer identity/generation and presentation-only delay. |
| Projection | Authorized output and coherent version boundary; secret inputs cannot flow to public outputs. |

This is proposed framework vocabulary, not syntax accepted by today's CUE
schema. The current `#MechaState` is flat and `invoke` targets external effects;
do not silently reinterpret that field as an arbitrary cross-tier invocation.
Define the composition IR first, then its small CUE surface and generated
artifacts. Reject unsupported constructs rather than emit partial charts.

The current Mecha SQL emitter selects transitions by the requested destination
column value. The new command executor must dispatch by **event and current
configuration**, including internal transitions that leave the phase unchanged.
Two card plays can both leave a hand in `playing`; skipping either because the
state column did not change would reproduce the missing-move problem.

### A shared pure domain executor

Extract card strength, dealing from supplied entropy, legal actions, wager
arithmetic, trick resolution, settlement and bot choices from `table.js`.
Keep them as bounded pure functions referenced by chart transitions. The chart
owns control flow; a single opaque call to the old 2,383-line handler is not
hybrid-machine adoption.

Use the same normalized chart and Jessie rules in the local interpreter and
inside the database transaction. Pronto already emits PLV8 validation functions
in [[../../../plugins/pronto/emit.cue]]; it does **not** yet provide this general
transactional Jessie reducer. Extend that machinery with declared, bounded
inputs and a validated write set. The reducer receives data only; it cannot
access SQL, ambient time, randomness or network APIs. The trusted executor
loads the inputs, supplies recorded sources and applies effects.

The first framework spike must establish confinement, compatible numeric/wire
semantics, execution limits and parity between these executors. A PLV8 function
alone is not proof of confinement. If this backend cannot execute the shared
contract safely, resolve that framework constraint before porting the game;
do not maintain a second hand-written SQL rules engine or insert an asynchronous
compute worker into authoritative turns.

## Authority and data

Durability describes storage and transport; it does not by itself grant mutation
authority. Online canonical rows are writable only through the command executor.
Generate that restriction on the server as well as checking declared effects.

| Data | Owner and purpose |
| --- | --- |
| `Room`, `Seat`, `Challenge`, presence lease | Mecha allocates seats, freezes rules at start, admits members, accepts/declines/expires challenges and expires presence. Unique `(room, seat)`; one human identity per room unless explicitly modeled otherwise. |
| `Match`, active `Hand`, canonical plays and settlements | Mecha online; local device storage offline. Stable seat IDs and team IDs, independent of the viewer's `you/us/them` labels. |
| Deal secrets and unrevealed cards | Server-only online; recorded for privileged replay. Fresh server entropy per hand. Never synchronize seed, deck or opponents' hand values. |
| `GameCommand`, `CommandResult` | Server-held command input and durable outcome. Private to the sender; canonical events carry only what participants may know. |
| `PlayerView` | One server-produced, read-only live row per match and viewer containing a coherent public table plus that viewer's permitted cards, revision and legal affordances. |
| Local session, pending intent, presentation, preferences | Browser-owned rows: route, theme, locale, selected card, modal state, pending command and animation/shout progress. |

For the initial implementation, a bounded `PlayerView` payload carries the
active hand, table history for that hand, score, deadline, seat layout and
private hand together. Normalize its shape in the schema; do not introduce an
untyped application-state blob. Two, four or six small views can be written in
the same transaction. This deliberate duplication avoids stitching several
Electric shapes into an impossible mixed-version hand. Historical logs may be
paged separately and must not drive active legality.

Use the existing `/auth/guest` token mint in
[[../../../libraries/mecha/services/auth/main.ts]] to keep online play free of
sign-up screens. Bind membership to `auth_uid()`, never the supplied `player_id`,
URL seat, handle or local-storage ID. A link names a room/invitation; a server
transaction claims a seat. Reload with the same credential restores that seat;
a second tab shares its authority and competes through revisions. Losing the
credential does not entitle a new guest to reclaim a seat by name.

Extend access declarations where needed for participant-readable,
executor-writable rows. Current folder/shared modes are not automatically
read-only grants. Verify both CRUD authorization and Electric shape tokens:
Postgres RLS alone is not a proof that replication delivers no private cards.
Partner-card disclosure on brink hands and face-down iron-hand play belong in
the projection rule; the canonical server still knows the deal.

## Command protocol and failure behavior

Use `durability: "server"` for commands, reusing the existing command transport
that waits for CRUD acceptance. The server-mutation tests in
[[../../../plugins/omnishell/interpreter/server-mutation-smoke.js]] already
distinguish this from queued live/offline writes. Extend it to return the typed
domain outcome; ordinary transport success is not proof that a move was legal.
The existing live/offline `settle` path may resolve after 2.5 seconds while the
write is still queued, so its `sync_ack` is not this protocol's `accepted` event.
Preserve the distinction rather than changing acknowledgement semantics for
unrelated apps.

Each intent carries `{command_id, match_id, protocol_version, expected_revision,
hand_id, kind, payload}`. Seat identity comes from authenticated membership.
Persist a pending intent locally before sending so a reload can resolve an
unknown outcome. Online turns do not accumulate an offline queue of speculative
moves; at most one unresolved gameplay intent per interaction instance.

Within one transaction:

1. Authenticate and check access. Lock the match aggregate, using a consistent
   lock order for room/membership operations that also touch it.
2. Look up the command ID **before** checking its old revision or deadline. The
   same authenticated sender and identical payload get the recorded result;
   reusing an ID with different input is a protocol error.
3. Load canonical state and bounded related rows. Sample server time after
   acquiring the lock. Check protocol version, membership, revision, hand,
   turn, card ownership, wager rights and deadline.
4. An expected domain refusal records a stable reason without changing the
   game. An accepted event reduces the chart, validates effects, increments
   the gameplay revision and writes canonical state, settlement, timer and
   every affected player view atomically with its outcome.
5. Commit. A crash or invariant failure rolls back everything and fails loudly.
   It is not converted to a successful refusal receipt.

This requires a generated command dispatcher/result path, beyond CRUD insertion
alone: repeated delivery must return the existing outcome rather than a raw
unique-key violation. Arbitrary callers cannot set the outcome or update the
canonical rows. Expected refusals are data; permission failures and internal
errors remain failures.

The client interaction chart follows:

```text
ready -> submitting -> acceptedAwaitingView -> ready
                    -> rejected -> ready
                    -> unknown -> resolving -> acceptedAwaitingView | rejected
```

An HTTP timeout means **unknown**, not rejected. Resolve by command ID or resend
the identical command. Never mint a replacement ID for that intent. If the
authoritative view arrives first, render it; retain the pending identity until
its outcome is known. If the result arrives first, keep the committed table
until a coherent view at or beyond the accepted revision arrives. Revision
alone does not prove that this particular command succeeded.

Selection, a translucent pending card and disabled duplicate controls provide
immediate feedback. Only committed views change scores, hand contents or whose
turn it is. Rejection clears the overlay and explains the reason. Disconnection
preserves the last confirmed table and enters reconnecting; it never switches
an online game to bot authority. Choosing offline play creates a separate match.

Resign, next hand and rematch use the same protocol. Rematch creates a new match
identity after participant agreement, so old resign/play events cannot apply.
Shouts and card-touch signals use a separate sequence/lifetime from gameplay:
they must not invalidate the revision of an otherwise legal card play.

## Machines covering the whole app

| Area | Migration |
| --- | --- |
| Boot, route and resume | A session chart selects local or online, authenticates online, resolves membership, hydrates a coherent view and recovers pending commands. URL parsing supplies an event, never game authority. |
| Lobby and invitations | Browser states for editing/joining/waiting/error; server states for presence leases, pending/accepted/declined/expired challenges and seat admission. Acceptance atomically creates membership and match reference; duplicate acceptance returns the same reference. |
| Match | Waiting for seats → playing → finished/abandoned; a match owns hand number, team score and immutable rule configuration. Bots occupy explicit seats; a host browser is never their online executor. |
| Hand and tricks | Deal → brink decision when required → active trick → trick resolution → hand resolution → next hand. A settlement identity prevents double payment. Timed presentation cannot gate settlement. |
| Wagers | Truco and envido/flor are explicit composed states with priority: envido may suspend a truco answer, then resume it. A match-ending envido cancels the outstanding hand/wager work. Guards enforce side ownership and variant ladders. |
| Deadlines and bots | Mecha owns turn/answer deadlines and bot wakes online; the local clock adapter owns them offline. Every wake identifies hand, state and timer generation. |
| Shouts and motion | Local presentation chart owns queue/display/expiry, reduced motion and cancellation on navigation. Networked signals are authorized, bounded and deduplicated. No animation completion determines game truth. |
| Pickers, identity and rules pages | Retain existing useful local picker machines, but theme/locale/profile are preferences, not match state. Online rules change through a new-room/rematch command. Static rules and localization remain declarative content. |

Support the actual nine-variant inventory and each valid seat configuration,
including three teams, envido/flor and brink hands. Start the migration with
Mineiro/Paulista 1v1, then four players, then remaining rules and six seats.
That ordering is a vertical validation strategy, not the final scope. Unsupported
online combinations must be visibly unavailable until their slice passes.

The local game retains immediate launch and full offline play, but persists the
canonical match/hand and recoverable timers on the device so reload can restore
it. It uses the shared rules with local recorded time/entropy sources. Online
and offline are explicit execution profiles, not a per-write fallback.

After the port, `table.js` no longer folds shared actions independently on each
browser; `round_machine.cue` is replaced by the shared domain composition.
`dealer.js` loses storage, membership, subscriptions and game orchestration.
Move reusable clipboard, navigation and animation effects to terminal adapters;
any remaining visual hatch declares its inputs and cannot mutate the game.

## Timers and races

The server stores UI and authoritative deadlines generated from a declared turn
duration and grace interval. Acceptance uses database time sampled under the
match lock: a move wins only if processed strictly before the backend deadline;
at the deadline timeout wins. Client timestamps and ticker scheduling delay do
not extend a turn. This chooses a precise server-processing boundary rather
than promising that a packet received elsewhere in the stack has reserved time.

A ticker wake and a move use the same lock and reduction path. The winner
changes the timer generation; a late duplicate wake cannot affect the next
turn even if its state name is also `playing`. A move arriving after the deadline
must resolve due work or refuse as expired even when the ticker has not run.
For the first release, timeout plays the lowest legal card or refuses an owed
wager; the rule table states brink/envido and repeated-disconnect behavior.
Presence loss alone does not surrender a seat. A disconnected participant keeps
their seat while deadlines advance the match; explicit resignation terminates
their participation according to the team rule.

## Validation that would make adoption convincing

Compiler checks should refuse undeclared messages, missing outcome handling,
wrong-tier writes, duplicate owners, missing states and illegal secret outputs.
They must analyze the emitted protocol, not merely the top-level tier labels.
Hatches remain explicit proof boundaries. These checks cannot establish that
the card rules or the transport implementation are correct.

| Gate | Evidence required |
| --- | --- |
| Domain parity | Identical seeded command traces through local and PostgreSQL executors produce identical canonical state and per-viewer projections after each event. Keep explicit expected rule cases; two executors sharing a mistake can agree. |
| Invariants | No duplicate deal cards; played cards belong to the actor and leave their hand once; one legal turn; valid raise ownership; each settlement pays once; finished matches reject new gameplay; variants conserve their specified scoring. |
| Concurrent database requests | Same-seat joins, accept versus expiry, two tabs playing, partner answers, play versus timeout and resign versus settlement. Assert one legal serialization and stable duplicate outcomes using real concurrent transactions. |
| Delivery schedules | Duplicate requests/replies, old hand events, lost response after commit, delayed view after response, view before response, reconnect and reload with unresolved intent. Explore bounded event reorderings with recorded counterexample traces. |
| Authorization | Forged seats, another player's card, altered revision/payload, direct score mutation, challenge edits by outsiders, changed shape predicates and revoked membership fail through real endpoints. Inspect raw response/store contents for hidden cards and seeds. |
| Complete browser matches | Two, four and six isolated browser contexts, as applicable, join through the UI, play to the actual variant goal, agree on winners and scores, and start a rematch. Include challenge, direct link and join-code paths. |
| Lifecycle resilience | Navigate away and back, reload every protocol state, background/suspend a tab, disconnect each seat in turn, restart the server/ticker and recover. No host tab is required to advance online timers or bots. |
| Offline and presentation | Existing rules, pickers, table layout, themes, localization, accessibility and motion behavior remain covered; complete local matches and reload recovery with the network disabled. |

Register these as normal automated checks with isolated data and portable
artifact paths; a script that truncates a named shared database is not the gate.
Browser errors and failed assertions fail the run. Wait for explicit revisions
and outcomes, not fixed sleeps. A first trick is not a complete match.

Bounded exploration is useful immediately: enumerate the small protocol model
with two clients, one active hand and duplicated/delayed messages, checking
safety after every step. Liveness requires explicit assumptions about eventual
connectivity, fair delivery and a functioning ticker; it cannot promise progress
through an indefinite partition. Measure command-to-confirmed-view latency and
lock time under concurrent matches before setting a release latency budget.

## Delivery sequence and decisions

The online table now covers 1×1, 2×2 and 2×2×2 with the supported variant
matrix in [[online-hybrid]], using existing Mecha ports and bounded Cortex
compositions. The lobby offers explicit vacant seats and group challenges.
The local arena plays the same rules in the terminal; arbitrary Cortex
hierarchy remains outside this multiplayer delivery. The
[[../../../plugins/pronto/docs/decisions/2026-09-29-hybrid-machines|hybrid machines decision]]
records the XState invocation design and its cancellation boundary;
[[../machines/root.cue]] hosts the arena, its bar and the online table. The sequence below
retains the broader adoption plan, not a requirement to finish the whole
framework before shipping this slice.

The framework work has four concrete boundaries: Pronto's schema/normalization
and emitter produce the composition and database dispatcher; Mecha's database
and ticker execute commands and timer wakes; Omnishell's machine/store adapters
correlate outcomes and views; generated access/shape rules enforce readership
and write authority. Truco supplies domain charts, pure rules, projections and
acceptance traces. None of these framework layers should know a Truco card,
seat name or scoring rule.

1. **Protocol and oracle.** Reconcile `brief.md`, `acceptance.md` and `ir.html`
   with the current variant rules and the authority above. Capture failing
   integration cases for unauthorized actions, deadline enforcement and secret
   exposure. Define command/result and player-view schemas before framework API.
2. **Small framework proof.** Compile a tiny two-seat hybrid fixture with one
   legal move, refusal, retry, timeout and private view. Prove both executors,
   command idempotency, tier enforcement and view reconciliation. No DuckStream
   services may be needed to build or run it.
3. **First complete online game.** Port Mineiro/Paulista 1v1 from guest entry
   through match completion and rematch. Pass real database races and transport
   fault cases before expanding. This is the decisive hybrid-machine checkpoint.
4. **Whole Truco.** Move bots/offline onto the shared core; add four/six-seat
   projections, the remaining variants and wagers; migrate lobby, resume,
   preferences and presentation lifecycles. Delete superseded handlers and raw
   protocol policies as each replacement becomes authoritative.
5. **Cutover.** Version the protocol and rule package. Preserve old local saves
   only through an explicit converter; never silently restart them. Drain old
   online rooms or close them with a visible explanation: their client-owned
   seeds and logs are not trustworthy canonical match data. Use a new endpoint
   or protocol namespace and invalidate stale service-worker bundles. Retain
   the previous executor until its active matches end, or supply an explicit
   state migration; never resume an old match under changed rules accidentally.

The main framework cost is the shared transactional executor and its generated
cross-tier command protocol. Merely changing entity durability would be cheaper
but would keep competing browser writers. A hand-written server game would
centralize authority but would not validate hybrid machines or preserve one
offline/online rule implementation. Moving all of `table.js` behind one opaque
chart action would conceal the very interleavings this work is meant to expose.

Do not make Rust emission or a new SMT backend a prerequisite. The useful part
of the suggested proof work is explicit ownership, command identity and bounded
protocol exploration. Start with those properties and their executable model;
a later solver can consume the same IR if it finds counterexamples that the
existing checks miss. Chart edge coverage alone does not prove distributed
correctness, and generated type checks cannot replace runtime authorization,
transaction serialization or private-data tests.

Once built, move the stable contract into framework reference documentation and
the app guide, then archive this decision as required by the repository rules.
