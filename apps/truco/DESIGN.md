---
preset: "press"
colors:
  neutral: "#EDE1CB"
  surface: "#FBF5E8"
  surface-muted: "#DFD0B2"
  border: "#C2A97C"
  primary: "#241A12"
  secondary: "#6B573D"
  accent: "#A8791C"
  danger: "#9E2B25"
  attention: "#C1651B"
dark:
  neutral: "#120E0A"
  surface: "#1D1712"
  surface-muted: "#2A2119"
  border: "#4B3924"
  primary: "#F4E9D2"
  secondary: "#B39B77"
  accent: "#D4AF37"
  danger: "#E05548"
  attention: "#E8913A"
---

# Truco — Boteco da Esquina

The identity is **Boteco da Esquina**. It replaces an earlier direction —
felt, brass, a beveled casino table — that was wrong about the game.

## What was wrong, and why it matters

Green baize, gold hardware and a dark wood rail are the vocabulary of a
casino: of a house that takes a rake, of chips, of a game played against
an institution. Truco is not played there. It is played on a small
table in a bar: a plastic checked cloth, a bottle sweating a ring into
it, an overhead bulb making a pool of light, four people who know each
other, and the score counted in beans because nobody brought anything
to keep it with.

The mistake was not the palette, it was the **subject**. The board was
drawn as a gambling surface, so no amount of retinting would have fixed
it: a felt mat is a felt mat. This direction changes what the screen is
a picture of.

It also changes who is on the other side. "A CASA" is a poker word — the
house, the bank, the thing you cannot beat. Truco has no house. It has
**eles**: the other pair, who have names, who talk, and who are as
beatable as you are. The scoreboard says what a truco table says:
**NÓS** and **ELES**.

## Direction

- **The table is a bar table under a bulb.** A checked plastic cloth
  over a small square top, its light coming from above and falling off
  at the edges — the felt frame is gone, and with it the sense of an
  institution. Depth comes from the light pool and the cloth's own
  weave, not from a beveled rail.
- **The cloth is the material, and it is honest plastic.** A red-and-white
  check by default, printed slightly off-register the way a real one is,
  with a crease where it was folded in the drawer. It carries the same
  role the felt did — the four themes retint it — but a cloth reads as
  somebody's table, and baize reads as somebody's business.
- **Cards are worn, not minted.** Ivory going yellow, soft corners, a
  hairline that has been shuffled a thousand times. The face keeps the
  Brazilian baralho's heavy corner rank and single large pip, because
  that is what is legible at arm's length across a small table.
- **The score is whatever the table has to hand.** Nobody at a boteco
  writes truco down: the tentos are counted in *feijões* pushed across the
  cloth, in *tampinhas* off the bottles, or in *palitos de fósforo* — one
  per tento, twelve to the game, and the twelfth sits apart because it is
  the game. Which marker appears belongs to the table, so switching to the
  fórmica switches to bottle caps and the bare wood keeps score in
  matches. Numbers stay beside them for the reader who wants one, small;
  the markers are the thing.
- **Warm light, one lamp.** The palette is a bulb at night: parchment and
  oak by day, walnut and amber by night. The one hot colour is
  the cloth's red — which is also the colour of a raised hand.
- **Eles have names and faces.** The opponents are people, in the
  Punch-Out!! sense: a small cast, each with a look, a way of playing
  that is really their thresholds, and something they say. Nobody plays
  against "the house".
- **Every persona has a tell.** Punch-Out!!'s whole design is that the
  opponent tells you what is coming and it is your job to notice: Seu
  Nezinho straightens the cards before he calls, Dona Cida taps the
  table twice, Tião hums. The tell lands a beat before the call, in the
  table's own line, so a player who is paying attention gets it and a
  player who is not gets truco'd. That is the game's tension, moved out
  of chance and into attention.
- **A voice from the bar.** Brazilian Portuguese in the register people
  actually use at the table: "Truco!", "Corri", "Deu zap", "Mão de
  ferro", "Tá com a mão boa, hein". Never "erro", never "inválido".
- **Alive under the hand, quiet otherwise.** Cards arrive dealt one after
  another, the played ones stay on the cloth until the hand ends, a
  marker is pushed across as the score moves. Everything is a transition on the
  motion tokens; the only loop is the stake, and it runs only while the
  hand is raised.
- **Dark is the same bar later.** Both appearances are declared per
  token: by day the cloth is bright and the light is the window, by night
  the bulb is the only source and the room falls away around it. The
  cloth's own colours are a material and do not move between them.

## The cast

Four opponents and one partner, each a set of thresholds with a face on
it — the numbers come from the engine spike, so a persona is a way of
playing rather than a costume.

| | who | plays | tell |
|---|---|---|---|
| **Seu Nezinho** | dono do boteco, secando o copo | careful: calls only with the hand to back it | straightens the cards before he calls |
| **Dona Cida** | do balcão, não perde uma | aggressive: calls early, takes almost anything | taps the table twice |
| **Tião Pandeiro** | senta pra jogar duas e fica seis | loose: calls on hope, runs late | hums when he likes his hand |
| **Zé da Bicicleta** | entrega gás, joga sério | tight: rarely calls, never takes a bad one | goes quiet |
| **Bigode** (parça) | seu parceiro de mesa | solid: plays the hand, not the crowd | — |

## Tokens

The colours are the boteco's table by day — parchment, oak, a warm amber
accent — and the same table at night: every press colour is replaced, both
appearances, and one is added (`attention`, the ember the raised stake pulses
with), so the preset supplies only the key set and everything outside
`colors` and `dark`. The felt itself is not here: the four themes are app-private
tokens (ir decision-11). The table's own materials — cloth, its check,
the wood under it, the lamp pool, card stock, the score markers — are
app-private tokens in `shell/shared/table.css`, named for what they are
(`--cloth`, `--cloth-check`, `--wood`, `--lamp`, `--stock`, `--mark`) and
never repeating a platform token name.

## Themes

Four, and all four are places rather than skins:

- **Xadrez** — the red-and-white checked plastic cloth. The default.
- **Fórmica** — a blue laminate top from the sixties, no cloth at all.
- **Madeira** — bare wood, amber bulb, the table nobody bothered to cover.
- **Neon** — the bar's sign in the window, throwing violet across the cloth.

## References: what the brief points at

| Product | What its players love | What we borrow | Out of scope |
|---|---|---|---|
| **Punch-Out!!** | Opponents who are characters, and who tell you what they are about to do | The cast, and the tell landing a beat before the call — the tension is attention, not chance | Boss patterns, health bars, a career ladder |
| **Hearthstone** | The board as a place with weight; cards that land | Cards that arrive dealt and stay played; a table that exists before the match | The beveled casino frame — the thing this direction is a correction of |
| **Magic: The Gathering Arena** | Always knowing whose turn it is and what phase you are in | The five-node spine, each closed trick wearing its verdict | Priority stops, the stack |
| **Marvel Snap** | The stake as the drama | One hot thing on the table, pulsing only while the hand is raised | Ranked cubes, snap-back timing |
| **Gwent / Balatro** | A committed art direction; the same game reading as a different object | Four table themes as materials — cloth, laminate, wood, neon — with layout untouched | Skinned chrome, unlockables |
