---
pronto: alpha
name: truco
business: free Brazilian card game, 100% local-first TanStackDB, 1v1 & 2v2 modes
stage: polished multi-game slice
team: studio
cluster: mecha
terminal: omnishell
loop: sayt
build: bayt
---

# Truco Paulista & Mineiro (Multiplayer & Boteco Edition)

Truco is the iconic Brazilian card game built for quick, tactical matches. Open it and a table is set: playable with friends over the internet via link (`#match/:id`) or against boteco regulars. Local-first optimistic mutations with cluster sync (`durability: "offline"`), syncing game state reactively across tables.

## Data

All entities use `durability: "offline"` for optimistic local play with multi-device cluster sync:
- `Match`: Tracks match status, seat assignments (`you`, `partner`, `opponent1`, `opponent2`), total score (`US` vs `THEM`), and game variant.
- `Round`: Tracks tricks won (`1st`, `2nd`, `3rd` tricks), current phase, active seat, and turn deadlines (`ui_deadline`, `backend_deadline`).
- `Held`: Tracks 3-card hands per seat and slot index (`slot: 0, 1, 2`). Opponent cards are masked as face-down backs in the synced state, preserving fog of war against client snooping while keeping slot spatial continuity.
- `Play`: Records cards played on the table, which slot they were played from (`from_slot`), and Truco calls.

## Screens

The table is the app. Beside it, a rules screen a newcomer can read without leaving the match.

### 1. Game Modes & Multiplayer
- **Truco Paulista**: Vira rank determines the cyclic Manilhas (`Vira + 1`). Manilha suits order: `4♣ (Zap) > 7♥ (Copas) > A♠ (Espadilha) > 7♦ (Ouros)`.
- **Truco Mineiro**: Fixed Manilhas (`4♣ Zap` = 100 power, `7♥ Copas` = 99 power, `A♠ Espadilha` = 98 power, `7♦ Ouros` = 97 power). Truco raises start at 2 points and climb `Truco 4` $\rightarrow$ `Seis 8` $\rightarrow$ `Nove 10` $\rightarrow$ `Doze 12`: a call pays what the variant says, not what it is named.
- **2-Player (1v1) & 4-Player (2v2) Arena Modes**: Play 1v1 or 2v2 across devices via match room links, or with boteco bots filling vacant seats.
- **Room Invite Affordance**: Quick link copy to invite a friend directly into your match table.

### 2. Physical Habits & Spatial Slot Presence
- **Dynamic 40-Card Deck**: Standard Truco deck (`4, 5, 6, 7, Q, J, K, A, 2, 3` across `♣, ♥, ♠, ♦`). Deals 3-card hands to each seat.
- **Slot Tells & Spatial Continuity**: Each card has an explicit slot in the hand (`0`, `1`, `2`). Playing a card animates from that exact physical slot, letting players observe habits and sorting patterns (leading left, middle, or holding the rightmost card) without exposing card values.
- **A cast, not a house**: In bot matches, opponents are people — Seu Nezinho, Dona Cida, Tião Pandeiro, Zé da Bicicleta, with Bigode as your partner. Each plays to their own thresholds with their signature tell.

### 3. Hearthstone-Tier Visuals & Authoritative Turn Timer
- **Hearthstone-Level Visuals, boteco not casino**: A bar table under a bulb — checked cloth, worn cards, card elevation with fanned angles (`-5°`, `0°`, `+5°`), and micro-animations.
- **Burning Rope Turn Timer**: Turn progress indicator counting down against the `ui_deadline`. The authoritative `backend_deadline` includes a grace buffer (spare time) to absorb network latency before timeout resolution.
- **Magic: The Gathering Phase Tracker**: Progress bar tracking round phases (`1. Deal` $\rightarrow$ `2. 1st Trick` $\rightarrow$ `3. 2nd Trick` $\rightarrow$ `4. 3rd Trick` $\rightarrow$ `5. Result`).
- **Marvel Snap Stake Multiplier**: Pulsing energy stake badge (`⚡ TRUCO x3`).
- **Gwent / Balatro Themes**: Four tables — Toalha xadrez, Fórmica azul, Neon do bar, Madeira crua.
- **User Session & Profile Bar**: Avatar badge, level title, and Guest/User offline toggle.

### 4. 100% Custom HTML Dropdowns
- **Zero Native OS Select Popups**: All dropdown controls use custom HTML UI components (`.custom-dropdown`) with dark mahogany gradients, gold borders (`#d4af37`), custom dropdown menus, and gold active indicators.

## Behavior

The rules the table plays by, stated so nobody has to guess:

- **A hand is best of three tricks.** The first side to take two wins it and banks the stake.
- **Ties.** A tied first trick is settled by the second; a tied second by whoever took the first; a hand tied all the way through is a draw and nobody scores. The next hand is dealt either way.
- **Raising.** Either side may call truco before playing into a trick. The other side accepts, runs, or raises again up to twelve. Running ends the hand at once and pays the other side what the hand was worth *before* the refused raise.
- **Nobody bids against themselves.** The side that called cannot call the next rung: once its raise is accepted, the right to climb belongs to the other side. The table says whose turn it is to raise.
- **The cards stay on the table.** Played cards are not collected until the hand ends. Each closed trick keeps its cards on the felt, marked with who took it, so a player who looked away can still read the whole hand.
- **Nós e eles.** The scoreboard says what a truco table says — NÓS and ELES — and the score is counted the way a table counts it — feijões, tampinhas or palitos de fósforo, one per tento. There is no house.
- **The table speaks the variant's words.** In Paulista a trick is a *vaza* and the race to twelve is a *partida*; in Minas the trick is a *rodada* and the race to twelve is a *jogo*. Both call the three-trick deal a *mão*.
- **Mão and pé.** The player who leads a hand is the *mão*; the last to play is the *pé*, and the pé has the final word on every trick of it. The mão passes one seat every hand, and the table shows which position is yours.
- **The match runs to twelve points.** Reaching it ends the match; a new one starts from zero on request.
- **Turn Clock & Grace Window**: Turns have an active countdown timer. Actions arriving before the backend deadline are accepted; if the deadline expires, the stalling player automatically folds or plays their lowest card.

![[acceptance.md]]

## Out of scope

- Accounts, cloud saves, and leaderboards. The session is the seat; the identity is the terminal's guest.
- Money, chips, ads, or any purchase.
- Envido/flor and other non-Brazilian truco families; mão de onze, mão de ferro, and iron-hand variants wait for a later stage.
- Sound and voice.

## Verification & QA Disciplines

- **`sayt lint`**: Clean (0 errors).
- **`sayt test`**: Clean (0 errors).
- **Visual Battery (`check-visual.ts`)**: 0 Critical Findings.
- **Playwright Automated Driver**: 100% PASS across game modes, variants, and custom dropdown UI.
