# Online hybrid table

The arena's **Truco online** pill opens the bar, a modal over the table. Go
online, challenge a player or create a table under the arena's own rule and
seating; a table is played at `/mesa/<room>`, and its code is the invitation. Partners alternate
around the table: A/B/A/B for two pairs, A/B/C/A/B/C for three pairs.
The shell supplies the guest/account session. Reloading that session rejoins
its existing seat. The table deals only when every seat is occupied.

| Variants | Online seating | Match target |
| --- | --- | --- |
| Mineiro, Paulista, Truc | 1×1, 2×2 | 12 |
| Gaúcho | 1×1, 2×2 | 18, 24 respectively |
| Argentino, Uruguayo, Paraguayo | 1×1, 2×2 | 30 |
| Douradinha, Douradão | 2×2×2 | 12 |

These follow Truco's existing house rules, including envido/flor, fixed or
vira-based manilhas, and Douradão's 41-card deck with a joker. They are not a
claim to cover every regional convention. Three-player teams are not supported.
Three different trick winners award the hand to the first trick's winner;
resigning a three-team match closes it without assigning either remaining
team a win. A team that folds is excluded for the rest of that hand.

The bar is the arena's Bar Online modal: nickname, online switch, the players
in the bar, an invitation and a join box, with an incoming challenge as a banner
over the table and an outgoing one as a waiting card. The pill glows while you
are online. The [[../shell/shared/lobby.css|lobby styles]] serve the modal and
the table screen. A rule the arena cannot seat online creates no table and
sends no challenge. Public
tables expose vacant seats without exposing hands. The local arena retains its
existing variants and bots; networked shouts are not part of this online table.

## Execution and authority

[[../program.cue]] declares `state.hybrids.truco_match`, using
[[../machines/match.cue]] and [[../machines/match.js]]. Pronto's writer compiles
the declaration into `016_mecha_actors.sql`. The bounded, pure rules run
in the same SES executor locally and in PLV8. The local arena executes these same rules through its Cortex child.

The chart owns waiting, dealing, special-hand choice, play, wager, settlement,
hand completion and match completion. Ordered automatic transitions settle
inside the command transaction; intermediate phases are never published.
They stop after at most 100 microsteps, and rule execution consumes fuel.
Entropy comes from PostgreSQL and is not included in a player projection.
The dealer uses rejection sampling over that entropy, keeping the room ID
independent of all present and future deals.

[[../machines/admission.cue]] declares room creation, joining and
synchronization through Mecha ports, reached through the machine's surface
rows ([[../surface.cue]]). Creation is idempotent by room ID and owner. Joining
locks the room before claiming the requested vacant seat, or the first vacancy
when an invitation does not specify one. Existing members resume their seat;
a conflicting claim fails without changing membership. Clients cannot write
canonical game state. The initial deal, subsequent accepted commands,
private views and command receipts commit atomically. Each view contains only
its owner's hand, public plays, team scores, seat card counts and legal actions.
Only the deciding team can see its partner's cards during a special hand.
Covered cards and every hand in a blind special hand remain concealed.

[[../machines/root.cue]] is the app's Cortex machine, one state per screen: the
arena plays `truco_match` locally and its bar holds `truco_presence` leased, and
the table attaches to the `truco_match` its route names. Each child is a fold
the terminal runs, and everything it asks of a machine is a row it writes:
[[../machines/table.js]] asks to join under a drawn key, draws your seat's live
view into the screen's rows, and turns a gesture into a command keyed by the
room, the revision it was made at, your seat and the gesture. The store's
outbox resends a row under its key, so a lost reply is the same command, and a
gesture on a view the table has moved past comes back as a stale-revision
receipt. Concurrent tabs are serialized by the room revision; a client never
substitutes another card for a refused play. The
[[../../../plugins/pronto/docs/cortex|Cortex reference]] defines the protocol
and its checks.

The arena is `root`'s `local` state: the terminal plays `truco_match` through
the `arena` handler Pronto composes from [[../machines/arena.js]] over the
machine's own rules. The game lives on the table's row, seeded by the
terminal's recorded draw; a click records an intent; the fold seated on the
table's row applies it, lets the house choose from each seat's own view on the
terminal's clock, and draws the felt from yours. Native bindings render the phase,
wager authority, dialogue and identity. Pure renderers format initials and speech;
CSS draws card travel, dealing, tells and shout transitions. The app declares no
escape hatch. Country links record their locale and regional rules through a
declarative chart before navigating; reloading an address preserves the selected game.

## Lobby and challenges

[[../machines/presence.cue]] and [[../machines/presence.js]] own each account's
visibility intent and bounded tab leases. New accounts start hidden. **Ficar
online** opts in with a display name; **Ficar offline** hides the account in
all tabs. A heartbeat cannot change that intent. Each mount gets a new lease
ID, renewed at most every ten seconds with a thirty-second lifetime. Cleanup
releases only its own lease; crashes and undeliverable cleanup expire without
requiring the disconnected browser to cooperate. Reconnection restores the
account's last confirmed visibility intent. At most sixteen live mounts per
account are admitted.

The bar lists `truco_presence_public`: players with visible intent and a live
lease, published by the machine and dropped by the ticker when the last lease
lapses. Names are display labels, taken from your device's name
(`Player`); account UUIDs identify players. Public discovery never exposes tab
IDs or private game state. A listed player may already be at a table, which
the challenge's own availability check refuses. Old `lobby` table writes are
revoked.

[[../machines/challenge.cue]] and [[../machines/challenge.js]] own offered,
accepted, declined, cancelled and expired states. Only the target can accept
or decline; only the inviter can cancel. Offers last thirty seconds and each
inviter has at most one unexpired outgoing offer. Acceptance checks both
players' availability after locking participants in UUID order. The challenge
transition, room allocation and the first two memberships commit together.
A 1×1 challenge deals immediately; a group challenge waits for the remaining
seats. The final join, deal and every private view commit together. Retries return the recorded outcome. Competing accept/cancel
commands cannot both succeed, and another challenge cannot admit an already
busy player. Each account also sees its unfinished rooms and can resume or
resign an abandoned waiting table instead of being stuck unavailable.
Accepted challenges show **Entrar na mesa** to both participants.

[[../machines/admission.cue]] also declares offer admission, the presence lease
and expired-invitation deadlines. Mecha generates the surface's triggers,
durable admission receipts, locking, memberships and private projections.
Seeds run through the bounded executor's input, state and invariant checks.
The challenge's `spawn` and `send` actions create and start the match within
its own transaction. A refused child transition aborts the enclosing operation;
state, private views and receipts roll back with its relational writes.
There are no handwritten online admission or coordination functions. Read-only
discovery queries and relational preconditions remain SQL expressions in the
machine declarations. The SQL migration only retires writes to legacy tables.
[[../machines/lobby.js]] draws one lease key per tab and writes your gestures —
visibility, offers, answers, new tables — as rows; [[../shell/handlers/lease.js]]
renews the lease on the terminal's clock, on a seat of its own so the bar never
waits on it. Every renewal moves the presence revision, so a switch made
against the previous one comes back stale; the tab sends it again at the
revision the seat now holds until the seat is where it asked to be. Only a
tab's own last switch is resent, so another tab's later one stands. A rename
while visible is sent as `show` again, since the listing carries the name you
went online with. A closed tab stays listed until its lease lapses and the
ticker's next beat drops it: up to the thirty-second lifetime plus one minute.

All three domain machines compile in name order into one migration, avoiding
the cluster's duplicate numeric migration slots. The browser interaction
reducer and domain rules have independent regression tests; they do not
constitute a proof of end-to-end liveness or exactly-once network delivery.

## Time and delivery

Seats, listings and receipts are live rows; nothing polls. Entering a timed
phase arms the ticker's one-shot schedule, so a deadline fires on the server
whether or not anyone is at the table, and a play at or after the deadline is
refused. A tick for a deadline already met does nothing.
Turns play the lowest-strength remaining card on timeout; wager/special-hand
answers time out by folding; envido times out as a refusal. Moving to another hand requires a player command.

The PLV8 [[hybrid-machine-proof|timeout verification gap]] remains advisory.
This integration assumes enforcement and
retains PostgreSQL timeouts and instrumented fuel; it does not claim to have
verified native-operation interruption.

## Verification and rollout

From the repository root, with CUE, Deno and Docker:

```sh
deno task --config plugins/pronto/deno.json test:truco-online
deno task --config plugins/pronto/deno.json test:hybrid
```

The online suite starts isolated, digest-pinned PostgreSQL and PostgREST
containers. It covers concurrent admission, authorization, private views,
duplicate/lost commands, multi-tab leases, visibility, challenge races and
expiry, child-delivery rollback and retry, concurrent first creation, durable admission
refusals, competing outgoing offers and invitations for one seat, overdue turns,
complete matches for all supported variant/seating combinations in the shared
executor, and complete two-, four- and six-seat matches in PostgreSQL. Seat
claims race for both an intermediate and the final vacancy; duplicate joins
cannot deal twice. A three-pair challenge reserves two seats before waiting. The
ticker's timeouts and lease lapses are driven by inserting the ticks it would.
Two readers complete a match through PostgREST, every row sent twice. Its HTTP
identities are signed test JWTs; it does not test the auth service's guest mint
or Electric's delivery. The bar's and the table's folds are checked mounted on
the harness's store and clock ([[../tests/online-screens.test.ts]]), which does
not establish visual quality or full-shell behavior in a real browser.

The emitted migrations initialize a fresh database. They do not upgrade an
already deployed database: one running the RPC ports needs its views moved into
the seat tables, presence states given their `until`, and running deadlines
armed on the ticker before the timer check passes. They do not convert old
browser-authoritative rooms. The new
migration revokes client writes to the old lobby, challenge and room-action tables;
their historical rows are retained. The local preview runs this implementation;
production rollout remains outstanding. The local preview upgrade explicitly
converts existing authoritative 1×1 states, challenges and admission receipts,
republishes private views, and replaces generated functions in one transaction.
It retains match history and command receipts. The renamed raise-authority
meaning requires converting the old `right` team to its opposite; adding empty
team fields alone is insufficient. Existing pending browser creates acquire
an explicit `1v1` input before retry. A cached pre-team private view is discarded
before admission so an equal-revision server response can replace its old
shape; pending commands and their identities are retained. This conversion does not import the older
browser-authoritative room history.

The remaining [[2026-10-13-hybrid-machine-adoption|adoption work]] includes
save migration, the deployed upgrade above and full-shell browser acceptance.

The worktree preview uses `compose.hybrid-preview.yaml` outside `.bayt`, so
Bayt generation does not remove the override. It publishes both loopback
address families at `https://localhost:10374/`. Generate its proxy
configuration after changing the emitted Caddyfile:

```sh
python3 docker/preview-caddy.py
docker compose -p truco-hybrid-preview -f .bayt/compose.launch.closure.yaml -f compose.hybrid-preview.yaml up -d --no-deps --no-build truco-caddy
```

Run these from `apps/truco` with the preview image and local certificates
already built. The override uses HTTP/1.1 and HTTP/2 over TLS and clears old
HTTP/3 advertisements: the container's UDP port is not published. Existing
rooms and database services are unchanged by this proxy restart.
