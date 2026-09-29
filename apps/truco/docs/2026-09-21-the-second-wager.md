# The second wager

Truco as this app deals it is a game with one question in it: who takes two of
three tricks. Everything the engine holds is shaped by that question. The
stake is a single number, the ladder is a single list, and a round has room
for exactly one unanswered call.

The Río de la Plata family asks a second question at the same table, and the
two are independent. *Envido* asks who holds the better cards by a point
count, is settled inside the first trick, and pays whether or not that side
goes on to win the hand. *Flor* asks a narrower version of the same thing. The
work this branch exists for is not "three more variants" — those are already
dealt. It is the second wager: a concurrent auction, on a different question,
with its own ladder, its own accept-or-refuse, and its own scoring, which can
interleave with the truco auction mid-call.

That interleaving is the whole difficulty, and the rest of this document is
mostly about it.

The second wager is also older and wider than the Río de la Plata. The
European forms of *truc* carry it under other names, and one of them appears
to carry nothing at all — so the mechanism built here is the one every variant
beyond this app's six will want, and the European row is mostly numbers once
it exists. That is the last section.

## What already exists

Six variants are dealt today, from `apps/truco/shell/handlers/table.js`:

| variant | manilhas | ladder | goal | trick word |
|---|---|---|---|---|
| paulista | vira + 1, wrapping 3 → 4 | 1 · 3 · 6 · 9 · 12 | 12 | vaza |
| mineiro | fixed 4♣ 7♥ A♠ 7♦ | 2 · 4 · 8 · 10 · 12 | 12 | rodada |
| gaucho | vira + 1 (same as paulista) | 1 · 3 · 6 · 9 · 12 | 12 | vaza |
| argentino | fixed A♠ A♣ 7♠ 7♦ | 1 · 2 · 3 · 4 | 30 | baza |
| uruguayo | fixed A♠ A♣ 7♠ 7♦ | 1 · 2 · 3 · 4 | 30 | baza |
| paraguayo | fixed A♠ A♣ 7♠ 7♦ | 1 · 2 · 3 · 4 | 30 | baza |

Three facts about the existing engine matter for what follows.

**The deck already counts for envido.** `RANKS` is
`["4","5","6","7","Q","J","K","A","2","3"]`, which is the Spanish deck with Q
J K standing for 10 11 12 and A for 1. Envido values fall straight out of it:
4–7 are worth their rank, Q J K are worth nothing, A is 1, 2 is 2, 3 is 3. No
new card data is needed — only a second function over the same rank string,
beside the existing `power`.

**The mano is already on the row.** `Round.leader` records who led the first
trick, and the envido tie is broken in favour of the mano. The tiebreak has a
home before it has a caller.

**Every hand is a pure function of `(seed, hand_no)`.** `deckOf` replays the
shuffle, so any seat's handler can compute any other seat's cards. This is
what makes bot envido possible locally, and it is also the thing that must
*not* leak online — see "What gets shown" below.

## What is missing, precisely

A round today carries one call and one answer:

```
asked   which seat called          ('' | you | parca | eles1 | eles2)
raised  which side owns the climb  ('' | us | them)
rung    what the call was worth    (0..12)
stake   what the hand pays now     (1,2,3,4,6,8,9,10,12)
```

That is a single-slot machine, and it is correct for truco because truco has
one auction. Envido needs a second set of the same shape, and the two are not
merely parallel — they compete for the same moment.

### The rule that breaks the model: *el envido va primero*

During the first trick, a side answering a truco call may answer it with
*envido* instead of accepting, refusing, or raising. The envido then resolves
completely — called, raised, accepted or refused, points scored — and only
then does the table return to the outstanding truco call, which is still
waiting for its answer.

So the sequence

> they call truco → you call envido → they call real envido → you accept →
> envido is scored → you answer the truco

is legal, and at its middle the round holds *two* unanswered calls on two
ladders, one of them suspended beneath the other. A single `asked`/`rung`
pair cannot express it. Neither can two independent pairs, because the order
matters: the truco answer must resume after the envido finishes, and the
table has to know that it is owed.

This is the mechanism to design. Everything else in this document is
bookkeeping around it.

### Where the calls are legal

- **Envido** may be called only during the first trick, and only before that
  trick is complete. Once the second trick begins, the window is shut for the
  rest of the hand.
- **Flor**, where it is played, is declared during the first trick by whoever
  holds it. A declared flor cancels envido entirely.
- **Truco** may be called at any point before a card is played into a trick,
  which is what the engine already does.

The envido window and the truco window overlap for exactly one trick, and that
overlap is the entire interleaving problem.

## Rules, and how confident to be about each

The mechanism above is structural and I am confident in it. The per-variant
specifics below are the part that needs checking against sources before
anybody writes a ladder into code — regional truco is genuinely inconsistent,
house rules are common, and getting `argentino` subtly wrong is worse than not
shipping it.

**Envido ladder** — believed stable across the Río de la Plata family:

| call | pays accepted | pays refused |
|---|---|---|
| envido | 2 | 1 |
| envido again (envido–envido) | 4 | 2 |
| real envido | 3 more | the accumulated |
| falta envido | what the leading side still needs to reach the goal | the accumulated |

**Envido count** — two cards of the same suit score 20 plus both their values;
otherwise the highest single card's value. Maximum 33 (7 + 6 + 20). Ties go to
the mano.

**Flor** — three cards of one suit, worth 20 plus all three values. Announced
flor is worth 3; contraflor and contraflor al resto climb from there.

**Per variant — VERIFY EACH:**

| variant | envido | flor | notes to check |
|---|---|---|---|
| argentino | yes | usually *sin flor* | flor is a table agreement, not a rule; does the picker offer it? |
| uruguayo | yes | commonly *con flor* | |
| paraguayo | yes | commonly *con flor* | |
| gaucho | yes | yes | the ladder and the goal are the open part, not the family |
| paulista | no | no | unchanged |
| mineiro | no | no | unchanged |

**The gaúcho question is answered, and the answer moves a variant between
families.** *Truco gaúcho* and *truco gaudério* are two names for one game, and
the sources consulted describe it the same way: the Spanish deck, **no vira**,
**fixed manilhas**, envido and flor both played. pt.wikipedia is flat about the
vira — *"Ao contrário do truco paulista, no truco gaudério não há existência da
carta vira"* — and lists the manilhas descending as ás de espadas
(*espadilha*), ás de paus (*bastilha*), 7 de espadas, 7 de ouros. MegaJogos and
Jogatina list those same four cards ascending. That is the set the engine
already holds for `argentino`, `uruguayo` and `paraguayo`: `A♠ A♣ 7♠ 7♦`.

So today's `gaucho` row — vira-based manilha, ladder 1 · 3 · 6 · 9 · 12, goal
12 — is not a third name over paulista's numbers. It is the wrong family, and
the comment in `table.js` that explains it is wrong with it. This is a
four-variant change.

What is *not* settled is which numbers take their place, and `gaucho` cannot
simply be aliased onto `argentino` either:

- **The ladder.** Jogatina prices every truco call at 3 tentos, not the Río de
  la Plata 1 · 2 · 3 · 4 — Brazilian gaudério tables tend to keep Portuguese
  pricing over Spanish structure. VERIFY: this may be a genuinely fourth
  ladder rather than a copy of argentino's.
- **The goal.** The sources give 12 tentos per *volta* and 24 per *partida* in
  pairs, 18 as two voltas of 9 head to head — not 30. A third goal value
  beside 12 and 30 lands exactly on the clamp warning that closes this
  document. VERIFY.
- **The words.** `WORDS` gives `gaucho` paulista's *vaza*. If the calls follow
  the family they are *truco / retruco / vale quatro* — but in Portuguese
  mouths, so VERIFY against how Rio Grande do Sul actually says them rather
  than against a translation of the Argentine terms.

## The other direction: Europe

The second wager is not a Río de la Plata invention, and the branch is worth
more than it first looks because of that. *Truc* is still played across the
western Mediterranean and southern France, and two of its living forms carry a
second wager of their own — the Valencian *envit* and the Pyrenean *embit*,
both cognate with *envido*, both a separate auction on card point-values. One
form appears to carry none. Whatever mechanism this branch builds for envido
is the mechanism those need too; the European variants are mostly a matter of
numbers once it exists.

They are also the first variants in this file that ask the engine to do *less*
rather than more, which is where the interesting damage is.

**Candidates — VERIFY EVERY ROW.** These are four different games with one
name, and the sources below conflict with each other in at least one place I
could not resolve:

| form | where | trumps | ladder | goal | second wager |
|---|---|---|---|---|---|
| truc (català) | Catalonia | **none at all** | 1 · 2 · 3 | 12 | none described |
| truc (valencià) | Valencia | fixed manilhas | truc · retruc · quatre val · joc fora | two *cames* of 24 | envit · torne · falta |
| truc y flou | Hautes-Pyrénées | fixed, plus two wild *périques* | 2 · 3 · 4 · 6 · the round | 25 | embit and *flou* |
| trut / tru / truka | Sarthe, Poitou, Basque Country | 32-card piquet pack | doubling, no stated ceiling | 12 | unknown |

**The conflict, stated rather than resolved.** Pagat describes Catalan truc
with suits irrelevant, no manilhas, ranking 3 · 2 · 1 · 12 · 11 · 10 · 7 · 6 ·
5 · 4, and no second wager anywhere in the game. Fournier describes Valencian
truc with the Río de la Plata manilha set — ace of swords, ace of clubs, seven
of swords, seven of coins — and a full *envit / torne / falta* ladder. Both are
called *truc*, and they are neighbours. They are two rows in this table, not
one, and neither should be dealt under the bare name `truc`.

### What each one costs the model

**A variant with no trumps at all.** If Pagat is right about the Catalan game,
its ranking is exactly this engine's `RANKS` read backwards, with no vira and
no manilha — `power` is the bare rank and suits never matter.
`Round.invariant` currently ties `vira` to `manilha`; it would need a third
legal state in which both are empty. This is the cheapest variant in the
document to deal and the only one the present invariant forbids outright.
**It also needs nothing from envido**, so it is a separate change and should
not ride on this branch.

**A ladder that is not a list of rungs.** Valencian *joc fora* and the Pyrenean
"playing for the round" stake whatever is left to the target — a value computed
from the score, not read out of `LADDER`. That is the same shape as *falta
envido*, which this branch already owes. Build the computed rung once and both
fall out.

**A goal that is not a number.** The Valencian *cama* is 24 split into twelve
*males* and twelve *bons*, and a match is two cames. `GOAL` is one integer
today and the clamp reads it directly. VERIFY what the split does to scoring
before modelling it; a half-understood cama is the score-clamp bug again,
wearing a different hat.

**Point values that are not the rank.** Truc y Flou has two wild *périques*
and a flor maximum of 41, not 33. An envido count that hard-codes 33, or
assumes value follows rank, is already wrong for the Pyrenees. Keep the count
a per-variant function beside `power`, not a constant — this is the second
reason not to write 33 into the code, and the first one was only a test.

**Flor cancels envido, independently confirmed.** Truc y Flou has it as *"if a
flor is bid, embits no longer count"* — the same rule the Río de la Plata
family states. A rule that shows up twice, six hundred kilometres and two
languages apart, is structural rather than regional, and belongs in the
mechanism rather than in a per-variant table.

**Señas are a second information channel, and are out of scope.** Signals
between partners are part of the game in the Catalan, Valencian and French
forms — a player may signal a held card, and is allowed to lie. This is
orthogonal to the second wager and touches the fog of war rather than the
ladder. It is named here so it is not discovered late and mistaken for part of
envido. Not this branch.

**Three to a side.** Truc y Flou scores a flor at 6 or 9 when two or three
teammates declare one, which reads as three players per team. The engine deals
`you / parça` against `eles1 / eles2` and nothing in it is sized for a third
seat. VERIFY whether the Pyrenean game is genuinely 3v3; if it is, refuse it in
writing rather than deal an approximation of it under its own name.

## How many at the table

The engine seats exactly four — `you`, `parça`, `eles1`, `eles2` — and deals
all six variants two against two. The games themselves are not so tidy, and
seat count turns out to be a third axis, independent of both the trump scheme
and the second wager.

| form | seats | note |
|---|---|---|
| truco (Río de la Plata) | 1v1, 2v2, 3v3 | all three are ordinary, not curiosities |
| trucão de 6 | **3v3** | six seats, two sides; no trumps of its own in any source |
| douradão | **2v2v2 — three sides** | three pairs, its own named trump list, and a joker |
| douradinha | three pairs, VERIFY | the smaller dourado: six named trumps over the ordinary four |
| truc y flou | 3 a side, apparently | flor pays 6 or 9 for two or three teammates declaring |
| truc (català / valencià) | 4 in fixed partnerships | also played two-handed; VERIFY |
| paulista, mineiro, gaúcho | 2v2 as dealt here | the wild game also runs 3v3 |

**Trucão is six seats at four-seat numbers.** Six players, two teams of three,
seated alternating so no two teammates are adjacent, three cards each, goal 12,
and the paulista ladder 3 · 6 · 9 · 12. Every source that describes it
describes only that — truco at six seats, with no trumps of its own. VERIFY
that it really keeps the vira, because nothing states it outright and its
absence from the sources is not the same as a claim.

**Douradão is a different game, and it breaks more than the seat count.** Also
written *truco douradão* or *dourada*, it is played by *três duplas* — three
pairs, six players, and therefore **three sides rather than two**. Its trumps
are not a rule over rank and suit but a named ordered list, and the names are
half of why anyone would deal it:

| | card | name |
|---|---|---|
| 1 | curinga | **Copão** |
| 2 | rei de ouros | **Douradão** |
| 3 | sete de paus | **Rata** |
| 4 | ás de ouros | |
| 5 | valete de ouros | **Cavalo de Fogo** |
| 6 | dama de ouros | **Douradinha** |
| 7 | valete de paus | **Cachorro do Mato** |
| 8 | ás de paus | **Fincudo** |
| 9 | dois de paus | |
| 10 | cinco de paus | |
| 11 | quatro de paus | |
| 12 | três de paus | |
| 13 | sete de copas | |

**Douradinha is a second game, not a second account of this one.** It is
played in Minas Gerais, and it is the smaller of the pair: the ordinary four
manilhas keep their places, and six named trumps sit above the zap —

| | card | name |
|---|---|---|
| 1 | dama de ouros | **Douradinha** |
| 2 | valete de paus | |
| 3 | sete de paus | **Rata** |
| 4 | — | **Dunga** |
| 5 | ás de paus | |
| 6 | cinco de paus | |

— and then zap, sete de copas, espadilha, sete de ouros, and the ordinary
ranks beneath. Which card the *dunga* is, no source says.

The two are a family, and their names say which is which: *douradão* is the
augmentative and carries thirteen named cards headed by a joker; *douradinha*
is the diminutive and carries six over an otherwise ordinary game. The dama de
ouros is *the douradinha* in both — the smaller game is named for its own
highest card, and in the larger one that same card has slipped to sixth. The
rata and the valete de paus appear in both lists. **That is a reading of the
two lists, not a claim from a source**, but it is the shape to expect, and it
means each gets its own row rather than one of them getting corrected into the
other.

The practical consequence is the same either way, and it is the argument below:
two games that differ almost entirely in *which cards outrank which* are the
clearest possible case for card order being data a variant supplies.

### What the dourado pair costs the model

**A fourth axis: how many sides.** Three pairs is not three more seats, it is a
third side, and `raised` is `'' | us | them`. The score is two numbers, and
`Round.leader` picks a mano between two sides. Three sides is not a wider enum;
it is a different game of bookkeeping — whether a truco call binds both other
pairs or only one, who owes the answer, who a refusal pays, what an envido even
means with a third count at the table. That is a larger change than this branch
and should be refused in writing for now rather than approximated.

**Trumps as a list, not a rule.** `power` is a rank order with a manilha rule
laid over it. The dourado orders are explicit sequences of named cards with
nothing to derive them from — four of the top six are *ouros*, which is exactly
the suit that sits at the bottom everywhere else, and a joker is above all of
it. The fix is for a variant's card order to become data the variant supplies
rather than a function the engine computes. That is cheaper than it sounds, and
it subsumes the Catalan no-trump case for free: a bare rank order is just
another list.

**The deck is per-variant too.** This engine strips the 8s, 9s, 10s and the
jokers to reach 40 cards. Douradão keeps a joker and makes it the highest card
in the game. Deck composition joins ladder, goal and card order as variant
data rather than a constant.

**The names are the content.** Copão, Douradão, Rata, Cavalo de Fogo,
Douradinha, Cachorro do Mato, Fincudo. An app that gives four opponents four
voices and argues about Paraguayan wording should not render these as `K♦`.
They are the reason to deal the variant at all, and they are catalogue keys
before they are cards.

## Proposed model

### A call stack on the round

Replace the single `asked`/`raised`/`rung` triple with an ordered stack of
open calls. The suspended truco call sits below the envido call; resolving the
top of the stack uncovers the one beneath, which is exactly what
*el envido va primero* describes.

The stack is short and bounded — at most one truco call and one envido or flor
call are ever open at once — so it need not be a general structure. Two named
slots plus a "which is live" pointer would also work, and may be the better
shape precisely because it cannot represent a state the rules do not have.
**Decide this deliberately**: a stack that can hold impossible configurations
is a worse model than two slots that cannot, and this codebase's habit is to
make the illegal state unrepresentable rather than to check for it.

### New round fields (sketch, not settled)

```
envido_state   '' | called | accepted | refused | scored
envido_rung    0..N       accumulated value of the envido chain
envido_asked   seat       who owes the answer
envido_us      0..33      the count our side showed
envido_them    0..33      the count their side showed
envido_result  '' | us | them
flor_state     '' | declared | contested | scored
pending_truco  ''|yes     a truco call is suspended beneath an envido
```

Every one of these needs a CEL constraint in the same style as the existing
fields, and the `Round.invariant` that currently ties `vira` to `manilha` is
the model for the ones worth stating: *envido fields are empty exactly when
the variant has no envido*, and *`pending_truco` is `yes` only while an envido
is live*.

### `Play.kind` widens

Today it is `card | truco | accept | run`. Envido needs at minimum `envido`,
`real_envido`, `falta_envido`, `flor`, and a way to record a declared count.
The play log is user-visible — the table renders it as a readable history — so
these rows are not bookkeeping; they are what the player reads back.

### Scoring joins the existing clamp

Envido points are added at resolution, not at the end of the hand, and they go
through the same `Math.min(..., goal)` clamp that `GOAL` already applies. The
bug fixed earlier on this app — a hand clamped to 12 while the goal was 30 —
is the same bug envido can reintroduce at a second site. One clamp, one goal,
both wagers.

## What gets shown

Envido is played by *announcing numbers, not cards*. A player says "27", the
other says "son buenas" and concedes without showing, or says "28" and takes
it. The cards themselves are never revealed unless the table asks.

This maps cleanly onto the fog of war already in place: `Held` rows for other
seats are masked as `back`, and the announced count is a new, deliberately
small disclosure — one integer per seat, written to the round rather than
inferred from cards the client should not hold. Resist the shortcut of
computing the opponent's count client-side from the seed; it is available
locally, and using it is precisely the leak the masking exists to prevent.

The concession — declining to show — is part of the game's texture and should
survive into the UI rather than being optimised away into an automatic
comparison.

## The bots

`CAST` gives each opponent a `call` and `take` threshold on a swept scale, plus
a tell that lands a beat before the call. Envido wants the same treatment and
not a second system: a count threshold per persona, and a tell in their own
voice. Seu Nezinho, who calls truco at 8.6, should be recognisably the same
player when he calls envido.

Bots are also the only way to exercise envido offline, and the acceptance
criteria below assume they can.

## Acceptance criteria to add

Written in the existing file's voice — observable at the table, one behaviour
each:

- Envido can be called during the first trick and not after it.
- A truco call answered with envido resolves the envido first, then returns to
  the truco call still waiting.
- The envido count is two same-suit cards plus twenty, else the highest card.
- A tied envido is won by the mano.
- Refusing an envido pays the other side the chain's value before the refusal.
- Falta envido pays the leading side's distance to the goal.
- Envido points are added when the envido resolves, not when the hand ends.
- A declared flor cancels envido for that hand.
- A side may concede an envido without showing its cards.
- Variants without envido show no envido call anywhere on the table.
- Envido and flor are spoken in the variant's own words, in every catalogue.
- A variant with no manilha shows no vira on the table and ranks on the bare
  card.
- A ladder rung that stakes the rest of the match is priced from the score, not
  from the ladder.

## i18n

Four catalogues exist — `pt-BR`, `es-AR`, `es-UY`, `es-PY` — with 205 keys
each, and the European variants would add more: Catalan and Valencian, Occitan
or French for the Pyrenean and northern forms, Basque for *truka*. That is the
largest single cost in this document and the one least visible from the code,
so count it before committing to the European row rather than after. Every new call, tell, and log line needs all four, and the
`check-i18n.ts` gate will say so. Note that the three Spanish catalogues are
*not* interchangeable here: the calls are the most regionally marked
vocabulary in the game, and using Argentine wording at a Paraguayan table is
exactly the error this app's whole i18n effort was built to avoid.

`pt-BR` needs envido and flor vocabulary after all: the gaúcho question above
resolved towards the Río de la Plata family, so the fourth catalogue is in
scope — and it needs gaúcho words, not Argentine ones carried across the
border.

## The groups

Eleven or so variants have been named in this document, and they do not queue
up one per change. They cluster by the *engine* problem they force, and a
variant usually sits in more than one cluster — gaúcho needs its trumps moved
and its second wager built, and those are different changes on different
schedules. Group by the transformation, not by the variant.

Each group below is one transformation, shippable alone, and none of them is
stacked on another's branch.

### Group 1 — card order and deck become variant data

**The shared problem.** `power` is a rank order with a manilha rule laid over
it, and the deck is a fixed 40-card strip of the 8s, 9s, 10s and jokers. Four
variants want an order the engine cannot compute from rank and suit, and one
wants a deck it does not deal.

| variant | what it asks for |
|---|---|
| truc (català) | no trumps at all — `power` is the bare rank, suits irrelevant |
| douradão | thirteen named cards in a fixed order, headed by a joker |
| douradinha | six named cards above an otherwise ordinary game |
| gaúcho | fixed manilhas in place of the vira — the only one already expressible |

**The transformation.** A variant supplies its card order and its deck
composition; `power` reads them instead of deriving them. `Round.invariant`
gains the state where `vira` and `manilha` are both empty.

**Why it goes first.** It is the only group that *removes* a computation rather
than adding a mechanism, it touches no round field, and it unblocks three
variants without going near the second wager. The dourado pair is the argument
for it and the Catalan case falls out for free.

### Group 2 — the stake stops being a ladder index

**The shared problem.** `rung` indexes `LADDER`, `stake` is read off it, and
`GOAL` is one integer that one clamp reads. Several calls are priced from the
score instead, and several variants do not have a goal that is an integer.

| call or variant | what it asks for |
|---|---|
| falta envido | the leading side's distance to the goal |
| joc fora (valencià) | whatever is left of the cama |
| "playing for the round" (truc y flou) | the same, at 25 |
| truc valencià | a *cama* of 24, split twelve *males* and twelve *bons* |
| argentino, uruguayo, paraguayo, gaúcho | goals of 30 and 24 beside paulista's 12 |
| mão de onze | a hand that opens on a rung and forbids the ladder |

**The transformation.** A rung may be a computed value rather than a list
entry; the goal becomes a structure rather than an `int`; the clamp stays
single and reads it.

**Why it goes second.** Group 3 needs it — *falta envido* is exactly this shape
— but it stands alone, and it fixes at the root the class of bug that let a
thirty-point match never end.

### Group 3 — the second wager

**The shared problem.** The round holds one `asked` / `raised` / `rung` triple,
and *el envido va primero* requires two open calls on two ladders with one
suspended beneath the other. This is the branch.

Members: argentino, uruguayo, paraguayo, gaúcho, truc valencià (*envit ·
torne · falta*), truc y flou (*embit* and *flou*).

**The transformation.** Everything under "Proposed model" above: the call-stack
or two-slots decision first, then the count, the mano tiebreak, announced
counts and concession, flor cancelling envido, the bot thresholds and the four
catalogues.

**Why it goes third.** It depends on group 2, it is the largest single change
in the file, and it is the only one whose shape is not yet decided.

### Group 4 — seats, and then sides

Two transformations that look like one and are not.

**4a — more seats, still two sides.** `you / parça / eles1 / eles2` is written
into the rows; trucão wants six seats in two teams of three. The fog-of-war
masking, the turn order, the `Round.leader` mano and `CAST` all widen with it —
and `CAST` widening means writing two more opponents with two more voices,
which is the part that does not follow from a type.

**4b — more sides.** Douradão and douradinha are played by *três duplas*:
three sides, not three seats. `raised` is `'' | us | them`, the score is two
numbers, and a refusal has to name who it pays. **Refused for now, in
writing** — the rules questions it opens are larger than the engine ones, and
no variant in this document needs it in order to be dealt correctly at four
seats.

### 4b, and the rule nobody wrote down

Douradinha is now settled except for one thing, and the exception is the whole
of 4b. Six players in three pairs, partners seated alternating; the ordinary
forty cards with the 8s, 9s and 10s out and **no joker**; five named cards
above the zap, so it is mineiro's four with a storey built on top:

| | card | name |
|---|---|---|
| 1 | Q♦ | **Douradinha**, also *Sota* |
| 2 | J♣ | |
| 3 | 2♣ | **Dunga** |
| 4 | A♣ | **Piu** |
| 5 | 5♣ | **Cinquinho** |
| 6 | 4♣ | **Zap** |
| 7 | 7♥ | |
| 8 | A♠ | **Espadilha** |
| 9 | 7♦ | |

then the 3s, the remaining 2s, the remaining aces, the kings, the jacks, the
queens, 7♠, the 6s, the 5s and the 4s. A hand is the best of three vazas, the
winner of a vaza leads the next, and a pair plays to twelve. Douradão is the
same shape with its own longer list and a *curinga* on top of it, which is the
one card that needs a deck this app does not deal.

**What no source says is what a trucada does with three pairs at the table.**
Every description reaches "é um jogo de blefes e de desafios (trucadas)" and
stops. Six searches, a municipal championship with a hundred players and no
published regulation. The cards are not the blocker; this is.

So it is proposed rather than found, and marked as invented wherever it is
written down. Each rule below is either a two-side rule carried over unchanged
or the only generalisation that does not require inventing a second one:

1. **A call is made to the table, and each other pair answers for itself.**
   Two pairs who are not partners have no way to answer jointly that does not
   need a procedure of its own.
2. **Running leaves the hand and pays nobody.** A pair that runs is out, its
   cards dead for the rest of the hand, and it simply scores nothing. If both
   run the caller takes the hand and it ends there, worth what it stood at
   before the call — which is the only place *correr paga o que a mão valia
   antes do pedido* actually applies.

   This reverses what was proposed here first. The earlier rule read that
   phrase as a penalty each refusing pair pays the caller, and it is not one:
   at two sides the caller is paid because the hand ends and it wins by
   default, there being nobody else. Where the hand goes on, a transfer to the
   caller is a mechanic truco does not otherwise have.
3. **Only a pair that took the call may raise.** The right to climb belongs to
   the side that took the bet, which is the rule already dealt, unchanged.
4. **A vaza goes to the highest card among the pairs still in it**, and a top
   card shared cancels it — again the rule already dealt, applied to whichever
   sides tied.
5. **The hand's winner scores the stake once**, not once per loser.
6. **The first pair to twelve wins**; the other two do not place.
7. **Three rodadas taken by three different pairs go to the first.** Nobody
   took two, which is a state only a table of three can reach, and the tie
   rules a two-sided game states do not reach it. *A primeira manda* is the
   mineiro doctrine it is borrowed from.

Seating is the one thing here that is not invented: the sources say the
partners of each pair sit in alternating positions, and at six seats
alternating is the same arrangement as sitting opposite.

Two of those have a real alternative, and both are worth asking a player before
either is built. Rule 5 could pay the winner the stake from *each* pair still
in the hand — the more gambling-shaped reading, and the one that makes a
three-handed table pay differently from a two-handed one. Rule 2 could let a
runner simply sit out and pay nothing, which some multi-handed fold games do;
truco's *correr paga* is specific enough that it probably does not.

This is where the refusal above gets revisited: 4b was refused for want of
rules, and what it wants now is a decision rather than a source.

### Not a group: señas

Signals are a second information channel, not a wager, and they touch the fog
of war rather than the ladder. Named in the Europe section, out of scope, and
listed here so the absence is deliberate.

### How they depend on each other

Groups 1, 2 and 4a are independent of each other and of the second wager, and
any of them can go first or alone. Group 3 depends on group 2 and on nothing
else. Group 4b is refused.

The consequence worth stating plainly: **this branch's own subject is the only
group with a prerequisite**, and three of the four groups can be dealt while
the call-stack question is still open.

## Order of work

1. **Pin the gaúcho numbers.** The family question is answered above: Río de
   la Plata, and a four-variant change. Its ladder, its goal and its words are
   not answered, and they are still research rather than code.
2. **Settle the call-stack shape** — two slots or a stack — before any field
   is added, because every later decision hangs off it.
3. Envido count and comparison, as pure functions beside `power`, with unit
   tests over known hands including the 33 maximum and the mano tie.
4. The round fields and their invariants.
5. The interleaving: truco answered by envido, resolved, resumed.
6. Flor, which is simpler and can follow.
7. Bot thresholds and tells.
8. Catalogues, acceptance, rules screen.
9. The European variants, on top of a mechanism that already works — numbers
   and words, not structure.

Two things that look like they belong on that list and do not. The no-trump
form and the six-seat form each move an axis this branch does not touch, and
each needs nothing from envido. They are their own changes, ahead of or behind
this one, never inside it.

## A warning from the last branch

Five defects on the preceding truco branch were invisible to `lint` and `test`
and visible only to a container or a browser. The score clamp that stopped a
thirty-point match from ever ending passed every unit test in the repo. Envido
is a scoring change on a scoring system that has already had exactly that bug
once. Get it in front of the visual battery and a real match early, and do not
trust a green `sayt test` as evidence that a match can end.
