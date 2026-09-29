// table — the hand plays itself out of its own log.
//
// Everything between the deal and the score is here: whose turn it is, what
// eles lay, when they raise and how they answer, which side took each rodada,
// and what the hand was worth. None of it is a decision the log does not
// already imply, which is the whole reason it can live in a compartment: rows
// in, updates out, no DOM and no clock of its own. Where it needs a pause it
// asks for one, and is called again (ir decision-32).
//
// The deal is here too. A compartment has no randomness, but a sitting only
// needs one draw: the match keeps it, and every shuffle in the match follows
// from it and the hand's number — which also means a match replays out of its
// own rows. The dealer keeps what is left, which is the screen.
(state, event) => {
  const rows = state.rows ?? {};
  const BEAT = 700;
  // Mineiro counts the mão as 2 and climbs truco 4, seis 8, nove 10, doze 12;
  // paulista counts 1 and climbs 3 / 6 / 9 / 12. Gaúcho deals exactly as
  // paulista does — vira-based manilha, same five rungs — so it is a third
  // name over the same numbers rather than a fourth ladder. The call keeps
  // its name while the tentos it pays follow the variant, so name and value
  // are separate data. Across the river the ladder is truco 2, retruco 3,
  // vale cuatro 4, and the race is to thirty rather than twelve. Envido and
  // flor are calls this dealer does not make, so those tables are dealt
  // without them.
  // What a table costs: the rungs a raise climbs and the score that ends the
  // match. Both halves live in one record so a variant cannot be half-priced —
  // a name present here is a table this dealer can deal, and a name absent is
  // refused below rather than read as somebody else's numbers.
  // A goal is two numbers because one table's is: gaúcho runs two voltas, of
  // nine each head to head and twelve each in pairs. Everywhere else the two
  // are the same number said twice, which is cheaper than a shape that has to
  // be asked which kind it is.
  //
  // A brink is the hand a side plays one hand short of the goal: paulista's
  // mão de onze, mineiro's mão de dez. The side on `at` sees its own cards and
  // its partner's, then plays the hand for `worth` or runs and gives the other
  // side the ladder's first rung; nobody may call truco in it. Both sides on
  // `at` is the mão de ferro — dealt face down, played for the first rung,
  // still no truco. A table without the record deals no brink.
  const PRICE = {
    paulista: {rungs: [1, 3, 6, 9, 12], goal: {solo: 12, pairs: 12}, brink: {at: 11, worth: 3}},
    mineiro: {rungs: [2, 4, 8, 10, 12], goal: {solo: 12, pairs: 12}, brink: {at: 10, worth: 4}},
    // Rio Grande do Sul plays the river's game in Portuguese: the river's
    // ladder, its envido and its flor, and a race of two voltas rather than
    // Brazil's twelve. Only the words are Brazil's.
    gaucho: {
      rungs: [1, 2, 3, 4], goal: {solo: 18, pairs: 24},
      envido: {envido: 2, envido_real: 3}, flor: 3,
    },
    // Catalonia bets truc and retruc and stops, and races to twelve.
    truc: {rungs: [1, 2, 3], goal: {solo: 12, pairs: 12}},
    // The dourado pair are mineiro's game at three pairs, so they climb
    // mineiro's ladder to mineiro's twelve. What a trucada does with three
    // pairs at the table is written down nowhere; the rules are invented in
    // docs/2026-09-21-the-second-wager.md and the rules page says which.
    douradinha: {rungs: [2, 4, 8, 10, 12], goal: {solo: 12, pairs: 12}},
    douradao: {rungs: [2, 4, 8, 10, 12], goal: {solo: 12, pairs: 12}},
    // The second wager and its own ladder: envido adds two, real envido three
    // more, and falta envido is not an addition at all but whatever the
    // leading side still has to run. Flor is a table agreement across the
    // river rather than a rule — Argentina mostly plays without it — so a
    // table that deals it says so and the rest cannot declare one. VERIFY per
    // country before trusting these three lines.
    argentino: {rungs: [1, 2, 3, 4], goal: {solo: 30, pairs: 30}, envido: {envido: 2, envido_real: 3}},
    uruguayo: {rungs: [1, 2, 3, 4], goal: {solo: 30, pairs: 30}, envido: {envido: 2, envido_real: 3}, flor: 3},
    paraguayo: {rungs: [1, 2, 3, 4], goal: {solo: 30, pairs: 30}, envido: {envido: 2, envido_real: 3}, flor: 3},
  };
  const WORDS = {
    paulista: { trick: "vaza" },
    mineiro: { trick: "rodada" },
    gaucho: { trick: "vaza" },
    truc: { trick: "basa" },
    douradinha: { trick: "rodada" },
    douradao: { trick: "rodada" },
    argentino: { trick: "baza" },
    uruguayo: { trick: "baza" },
    paraguayo: { trick: "baza" },
  };
  const VOICE_OF = { paulista: "sp", mineiro: "mg", douradinha: "mg", douradao: "mg", gaucho: "rs", argentino: "ar", uruguayo: "uy", paraguayo: "py", truc: "ca" };
  const VOICE = {
    sp: {
      ladder: { 3: "Truco!", 6: "Seis!", 9: "Nove!", 12: "Doze!" }, ran: "CORRI", accept: "CAI DENTRO!", we_won: "É NOSSA!", they_won: "LEVAMOS!",
    },
    mg: {
      ladder: { 4: "Truco!", 8: "Seis!", 10: "Nove!", 12: "Doze!" }, ran: "CORRI, SÔ", accept: "CAI DENTRO, SÔ!", we_won: "É NÓIS, SÔ!", they_won: "LEVAMO, UAI!",
    },
    rs: {
      ladder: { 2: "Truco!", 3: "Retruco!", 4: "Vale quatro!" }, ran: "CORRI, TCHÊ", accept: "QUERO, TCHÊ!", we_won: "É NOSSA, TCHÊ!", they_won: "LEVAMOS, BAH!",
    },
    ar: {
      ladder: { 2: "¡Truco!", 3: "¡Retruco!", 4: "¡Vale cuatro!" }, ran: "ME VOY", accept: "¡QUIERO!", we_won: "¡ES NUESTRA!", they_won: "¡NOS LO LLEVAMOS!",
    },
    uy: {
      ladder: { 2: "¡Truco!", 3: "¡Retruco!", 4: "¡Vale cuatro!" }, ran: "ME VOY", accept: "¡QUIERO!", we_won: "¡ES NUESTRA!", they_won: "¡NOS LO LLEVAMOS!",
    },
    py: {
      ladder: { 2: "¡Truco!", 3: "¡Retruco!", 4: "¡Vale cuatro!" }, ran: "ME VOY", accept: "¡QUIERO!", we_won: "¡ES NUESTRA!", they_won: "¡NOS LO LLEVAMOS!",
    },
    ca: {
      ladder: { 2: "Truc!", 3: "Retruc!" }, ran: "ME'N VAIG", accept: "VULL!", we_won: "ÉS NOSTRA!", they_won: "ENS L'ENDUEM!",
    },
  };
  // How eles play: the swept thresholds moved around a centre, plus a tell
  // that lands a beat before the call — the table warns you, and it is your
  // job to be looking (ir decision-25). Who they ARE is on the match row; this
  // is only how they bet.
  const CAST = {
    nezinho: { name: "Seu Nezinho", call: 8.6, take: 7.4, tell: "Seu Nezinho ajeita as cartas…", line: "Truco, meu filho." },
    cida: { name: "Dona Cida", call: 7.2, take: 6.4, tell: "Dona Cida bate duas vezes na mesa…", line: "Truco, meu bem!" },
    tiao: { name: "Tião Pandeiro", call: 6.6, take: 6.0, tell: "Tião começa a cantarolar…", line: "Truuuco, seu moço!" },
    ze: { name: "Zé da Bicicleta", call: 9.2, take: 8.0, tell: "Zé fica quieto…", line: "Truco." },
    online: { name: "Adversário Online", call: 0, take: 0, tell: "", line: "" },
  };
  const CAST_KEYS = ["nezinho", "cida", "tiao", "ze"];
  // Your parça, and the swept centre anybody else falls back to.
  const BIGODE = { call: 8.0, take: 7.0, tell: "", line: "Truco!" };

  // A match opens on its ladder's first rung — mineiro's mão is 2, everyone
  // else's is 1. A variant this dealer cannot price is a table it must not
  // deal: dealing it as another's would put the wrong rules under its name.
  const opening = (v) => {
    const p = PRICE[v];
    if (p === undefined) throw new Error(`no price for variant ${v}`);
    return p.rungs[0];
  };

  /* --- opening a sitting -------------------------------------------------- */

  // Nothing on the table. A match needs a draw — for the seed every shuffle in
  // it follows from, and for who is sitting across it — and a compartment has
  // none, so it asks and is called again with one.
  const all = rows.match ?? [];
  const match = all.find((m) => m.status === "playing");
  const retired = (m) => ({ op: "patch", entity: "match", id: m.id, row: { current: "no" } });
  if (match === undefined) {
    // What the last sitting was played under is what the next one opens under,
    // and a rule picked while closing it was written onto it — so the choice
    // travels on a row rather than in the hand of whichever wake gets here
    // first. It cannot be carried: closing the match is itself a mutation, and
    // the wake it raises reaches this with nothing in its hands.
    const before = all[all.length - 1];
    const want = {
      variant: before?.variant ?? "mineiro",
      seats: before?.seats ?? "1v1",
      theme: before?.theme ?? "xadrez",
      locale: before?.locale ?? "",
      opponent: (before?.opponent && before.opponent !== "online") ? before.opponent : "nezinho",
    };
    if (event.type !== "open") {
      // A sitting opens by itself where nobody is sitting — a first visit, or
      // a match ended by a change of rules. A match somebody WON stays on the
      // table with its result showing until they ask for another, which is the
      // one thing on this screen that waits to be asked.
      const won = before !== undefined && (before.winner ?? "") !== "";
      // The pause exists so the closing scoreline can be read; a reload took
      // the round (tab-tier) with it, so there is nothing left to read and
      // the sitting opens by itself again.
      const shown = before !== undefined && (rows.round ?? []).some((r) => r.match_id === before.id);
      const asked = event.type === "click" && (event.from === "btn-again" || event.from === "btn-start");
      if (won && shown && !asked) return { updates: [] };
      const retireUpdates = [
        ...all.filter((m) => m.current === "yes").map(retired),
        ...(rows.held ?? []).filter((h) => h.current === "yes").map((h) => ({ op: "patch", entity: "held", id: h.id, row: { current: "no" } })),
        ...(rows.round ?? []).filter((r) => r.current === "yes").map((r) => ({ op: "patch", entity: "round", id: r.id, row: { current: "no" } })),
      ];
      return { updates: retireUpdates, then: { type: "open", seed: true, with: want } };
    }
    const seed = Number(event.seed) >>> 0;
    const chosenOpp = event.with?.opponent ?? want.opponent;
    const chosenSeat = event.with?.my_seat ?? want.my_seat ?? "you";
    const isOnline = chosenOpp === "online";
    const eles = isOnline ? "online" : (CAST_KEYS.includes(chosenOpp) ? chosenOpp : CAST_KEYS[seed % CAST_KEYS.length]);
    return {
      updates: [
        ...all.filter((m) => m.current === "yes").map(retired),
        ...(rows.held ?? []).filter((h) => h.current === "yes").map((h) => ({ op: "patch", entity: "held", id: h.id, row: { current: "no" } })),
        ...(rows.round ?? []).filter((r) => r.current === "yes").map((r) => ({ op: "patch", entity: "round", id: r.id, row: { current: "no" } })),
        {
          op: "put",
          entity: "match",
          id: `m${seed.toString(36)}`,
          row: {
            id: `m${seed.toString(36)}`,
            variant: want.variant, seats: want.seats, theme: want.theme,
            locale: want.locale ?? "",
            us_score: "0", them_score: "0", others_score: "0",
            stake: String(opening(want.variant)), hand_no: "1",
            status: "playing", winner: "",
            opponent: eles, opponent_name: CAST[eles].name, partner_name: "Bigode",
            seed: String(seed), current: "yes",
            my_seat: chosenSeat,
          },
        },
      ],
    };
  }
  // A match written before the table had `current` is seated on its first
  // wake: the slots bind on that field, and would show the empty row over a
  // hand still being dealt.
  if ((match.current ?? "") !== "yes") {
    return {
      updates: [
        ...all.filter((m) => m !== match && m.current === "yes").map(retired),
        { op: "patch", entity: "match", id: match.id, row: { current: "yes" } },
      ],
    };
  }
  const duplicates = all.filter((m) => m !== match && m.current === "yes");
  if (duplicates.length > 0) {
    return {
      updates: duplicates.map(retired),
    };
  }
  // The hand on the table, and only if it is this match's: a variant or a seat
  // count is a different game, so the sitting it belonged to is over and the
  // hand standing on the felt belongs to nobody.
  const standing = (rows.round ?? []).find((r) => r.current === "yes");

  // A variant this dealer cannot price is a table it must not deal: the ladder
  // is resolved once, here, so nothing downstream reads another variant's.
  const variant = match.variant;
  const price = PRICE[variant];
  if (price === undefined) throw new Error(`no price for variant ${variant}`);
  const ladder = price.rungs;
  const goal = match.seats === "2v2" ? price.goal.pairs : price.goal.solo;
  if (WORDS[variant] === undefined) throw new Error(`no words for variant ${variant}`);
  // Seats in seating order, partners spread as far apart as the table allows:
  // two sides interleave one-and-one, three interleave one-and-one-and-one, so
  // nobody ever sits beside their own partner.
  const SEATS = {
    "1v1": ["you", "eles1"],
    "2v2": ["you", "eles1", "parca", "eles2"],
    "2v2v2": ["you", "eles1", "eles2", "parca", "eles3", "eles4"],
  };
  const order = SEATS[match.seats];
  if (order === undefined) throw new Error(`no seating for ${match.seats}`);
  const mySeat = match.my_seat || "you";
  // Three names because a table can hold three pairs. Which name a seat wears
  // is counted from your own, so your side is "us" wherever you are sitting:
  // seats alternate by side, so the side is the distance round the table
  // modulo how many sides there are.
  const SIDES = order.length === 6 ? ["us", "them", "others"] : ["us", "them"];
  const sideOf = (seat) =>
    SIDES[(order.indexOf(seat) - order.indexOf(mySeat) + order.length) % SIDES.length];
  // What each side has, and what it would have after being paid.
  const COLUMN = {us: "us_score", them: "them_score", others: "others_score"};
  const scoreOf = (side) => Number(match[COLUMN[side]] ?? 0);
  const otherSides = (side) => SIDES.filter((s) => s !== side);
  // "The other side" is a thing only a table with two of them has. Conceding,
  // running and a forfeit all name one, and at three pairs each of those is a
  // question the rules answer differently — so asking here is refused rather
  // than answered with whichever side came first.
  // Who the rule asks next: the first seat round the table, from this one, on
  // the side given. Asking for "a seat on that side" instead finds whichever
  // partner sits earliest in the order, which is a different player at four
  // seats and the same one at two — so the difference hides wherever it is
  // cheapest to test.
  const nextOn = (side, fromSeat) => {
    const at = order.indexOf(fromSeat);
    return order.slice(at + 1).concat(order.slice(0, at)).find((s) => sideOf(s) === side);
  };
  const theOther = (side) => {
    const rest = otherSides(side);
    if (rest.length !== 1) throw new Error(`${SIDES.length} sides have no single other`);
    return rest[0];
  };
  const displaySeatOf = (seat) => {
    if (mySeat === "eles1") {
      if (seat === "eles1") return "you";
      if (seat === "you") return "eles1";
    }
    return seat;
  };
  const who = (seat) => (seat === "parca" ? BIGODE : CAST[match.opponent] ?? BIGODE);
  // The cast key, which is what a message key is built from. The partner
  // plays a strategy rather than a character, and speaks under its own name.
  const castOf = (seat) => (seat === "parca" ? "bigode" : (CAST[match.opponent] ? match.opponent : "bigode"));
  const trick = WORDS[variant].trick;
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  const nextRung = (stake) => {
    const i = ladder.indexOf(Number(stake));
    return i >= 0 && i < ladder.length - 1 ? ladder[i + 1] : 0;
  };
  const txt = (v) => String(v);

  if (event.type === "click" && (event.from === "btn-resign" || event.from === "btn-modal-resign")) {
    const mySide = sideOf(mySeat);
    // Leaving hands the match to the only other pair, where there is one. At
    // three there is no "the other pair", and handing it to whichever of two
    // came first would be inventing a rule — so the table simply stops, with
    // nobody named.
    const winSide = SIDES.length === 2 ? theOther(mySide) : "";
    const updates = [
      {
        op: "patch",
        entity: "match",
        id: match.id,
        row: {
          ...Object.fromEntries(SIDES.map((sd) => [COLUMN[sd], txt(sd === winSide ? goal : scoreOf(sd))])),
          status: "over",
          winner: winSide,
        },
      },
    ];
    if (standing !== undefined) {
      updates.push({
        op: "patch",
        entity: "round",
        id: standing.id,
        row: {
          said: "Você abandonou a partida.",
          result: winSide,
          phase: "result",
        },
      });
      for (const h of (rows.held ?? []).filter((h) => h.current === "yes" && h.round_id === standing.id)) {
        updates.push({ op: "patch", entity: "held", id: h.id, row: { current: "no" } });
      }
    }
    if (match.opponent === "online") {
      const actId = `${match.seed}/resign/${mySeat}`;
      updates.push({
        op: "put",
        entity: "room_action",
        id: actId,
        row: {
          id: actId,
          room_seed: String(match.seed),
          player_id: mySeat,
          action: "resign",
          card: "",
          slot: 0,
        },
      });
    }
    return { updates };
  }

  if (match.opponent === "online") {
    const roomActions = (rows.room_action ?? []).filter((a) => String(a.room_seed) === String(match.seed));
    const remoteResign = roomActions.find((a) => a.action === "resign");
    if (remoteResign && match.status === "playing") {
      const resignedSide = sideOf(remoteResign.player_id);
      const winSide = theOther(resignedSide);
      const resignMsg = resignedSide === sideOf(mySeat) ? "resigned_you" : "resigned_them";
      const updates = [
        {
          op: "patch",
          entity: "match",
          id: match.id,
          row: {
            ...Object.fromEntries(SIDES.map((sd) => [COLUMN[sd], txt(sd === winSide ? goal : scoreOf(sd))])),
            status: "over",
            winner: winSide,
          },
        },
      ];
      if (standing !== undefined) {
        updates.push({
          op: "patch",
          entity: "round",
          id: standing.id,
          row: {
            said: resignMsg,
            result: winSide,
            phase: "result",
          },
        });
        for (const h of (rows.held ?? []).filter((h) => h.current === "yes" && h.round_id === standing.id)) {
          updates.push({ op: "patch", entity: "held", id: h.id, row: { current: "no" } });
        }
      }
      return { updates };
    }
  }

  if (event.type === "close_shout") {
    const standing = (rows.round ?? []).find((r) => r.current === "yes");
    if (!standing) return { updates: [] };
    return {
      updates: [{
        op: "patch",
        entity: "round",
        id: standing.id,
        row: {
          shout_state: "gone",
          shout_done: "yes",
          shout_word: standing.shout_word ?? "",
          shout_from: standing.shout_from ?? "",
          shout_kind: standing.shout_kind ?? "",
        },
      }],
    };
  }

  // Which brink the next hand is, read off the score it is dealt at. The
  // decision is the side's own, and across a room the side on the brink is a
  // person this dealer cannot decide for — so, like the second wager, a table
  // shared online is dealt none. The rule is written for two sides: with a
  // third, who pays a run and what two pairs on the brink play are questions
  // nobody has answered, so a table of three is dealt none either.
  const brinkOf = () => {
    if (price.brink === undefined || match.opponent === "online" || SIDES.length !== 2) return "";
    const on = SIDES.filter((sd) => scoreOf(sd) >= price.brink.at);
    return on.length === SIDES.length ? "both" : on.length === 1 ? on[0] : "";
  };

  /* --- the deck ---------------------------------------------------------- */

  const RANKS = ["4", "5", "6", "7", "Q", "J", "K", "A", "2", "3"];
  // Weakest to strongest, which is only ever asked to separate trumps of one
  // rank — four cards a turn-up named together.
  const SUITS = ["♦", "♠", "♥", "♣"];
  // What a table names its trumps, strongest first. The list is the order:
  // two trumps can share a suit — across the river the 1 and the 7 of swords
  // both do — so a suit cannot be asked to decide between them. Mineiro's four
  // are the Brazilian ones; the Río de la Plata family plays 1 de espadas, 1 de
  // bastos, 7 de espadas and 7 de oros, which this deck spells with A for the
  // one. A variant absent from here turns a card up instead; a variant naming
  // an empty list has no trumps at all and every card is the rank it shows.
  const NAMED = {
    // Catalonia names none: suits are irrelevant there and a card is worth the
    // rank it shows, which is this deck's order already.
    truc: [],
    // Rio Grande do Sul plays the river's game: no turn-up, and the same four
    // named cards. What it pays for them is the river's too: PRICE climbs it
    // one point at a time to vale quatro, and plays to twenty-four in pairs.
    gaucho: ["A\u2660", "A\u2663", "7\u2660", "7\u2666"],
    // Minas builds a storey on mineiro's four. Douradinha names five more
    // above the zap — the dama de ouros it is named for, then the valete de
    // paus, the dunga, the piu and the cinquinho — and leaves the rest of the
    // deck where mineiro has it.
    douradinha: [
      "Q\u2666", "J\u2663", "2\u2663", "A\u2663", "5\u2663",
      "4\u2663", "7\u2665", "A\u2660", "7\u2666",
    ],
    // Douradão names thirteen and puts a curinga over all of them, which is
    // the one card no rank crossed with a suit can produce.
    douradao: [
      "\u2605", "K\u2666", "7\u2663", "A\u2666", "J\u2666", "Q\u2666", "J\u2663",
      "A\u2663", "2\u2663", "5\u2663", "4\u2663", "3\u2663", "7\u2665",
    ],
    mineiro: ["4♣", "7♥", "A♠", "7♦"],
    argentino: ["A♠", "A♣", "7♠", "7♦"],
    uruguayo: ["A♠", "A♣", "7♠", "7♦"],
    paraguayo: ["A♠", "A♣", "7♠", "7♦"],
  };
  const named = NAMED[variant];
  // A deck is a rank crossed with a suit, and then whatever else the table
  // names. Almost every table names cards the grid already makes; one names a
  // curinga, which no rank and no suit can produce, so the deck takes it.
  const EXTRA = (named ?? []).filter((c) =>
    !RANKS.includes(c.slice(0, -1)) || !SUITS.includes(c.slice(-1)));
  const rank = (card) => card.slice(0, -1);
  const suit = (card) => card.slice(-1);
  // The turn-up's four: the rank above it, wrapping 3 → 4, strongest suit
  // first.
  const viraTrumps = (vira) => {
    const r = RANKS[(RANKS.indexOf(rank(vira)) + 1) % RANKS.length];
    return SUITS.slice().reverse().map((s) => r + s);
  };
  const trumpsOf = (vira) => named ?? viraTrumps(vira);
  // The other half of the round's invariant: the vira column is empty exactly
  // when this says the table named its trumps or has none, so the one column
  // has to say which of the two it was.
  const manilhaWord = (trumps) =>
    named === undefined ? rank(trumps[0]) : named.length === 0 ? "nenhuma" : "fixas";
  // Plain cards run 1..10 by rank alone. Trumps run above every one of them in
  // the order their table gave, so the weakest trump is 97 however long the
  // list and the strongest is 96 plus its length.
  // How good a hand is, for the table it was dealt at. A trump counts for the
  // top of the scale and a plain card for its rank, and a table with no trumps
  // reaches only as high as its best rank — so the scale is raised to meet the
  // personas, whose thresholds are one set of numbers for every table.
  const TOP = 11;
  const reach = named !== undefined && named.length === 0 ? RANKS.length : TOP;
  const strengthOf = (hand) =>
    hand.reduce((n, c) => n + Math.min(Number(c.power), TOP), 0) /
      Math.max(1, hand.length) * (TOP / reach);
  // What a card is worth to the envido. The Spanish deck's pip cards count
  // their pips and its three face cards count nothing; this deck spells the
  // Spanish ten, eleven and twelve as Q, J and K, so they are the nothings.
  const ENVIDO_VALUE = {"4": 4, "5": 5, "6": 6, "7": 7, Q: 0, J: 0, K: 0, A: 1, "2": 2, "3": 3};
  // Two cards of one suit are worth twenty and both their pips; a hand with no
  // two suits alike is worth its best single card. Thirty-three is the most
  // there is, a seven and a six of a suit, and a hand of three faces is worth
  // nothing at all.
  const envidoOf = (cards) => {
    let best = 0;
    for (let i = 0; i < cards.length; i += 1) {
      best = Math.max(best, ENVIDO_VALUE[rank(cards[i])]);
      for (let j = i + 1; j < cards.length; j += 1) {
        if (suit(cards[i]) === suit(cards[j])) {
          best = Math.max(best, 20 + ENVIDO_VALUE[rank(cards[i])] + ENVIDO_VALUE[rank(cards[j])]);
        }
      }
    }
    return best;
  };
  const power = (card, trumps) => {
    const at = trumps.indexOf(card);
    return at < 0 ? RANKS.indexOf(rank(card)) + 1 : 96 + trumps.length - at;
  };

  const mulberry32 = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // One shuffle per (seed, hand); the deal reads it, and the round guard
  // below replays it to ask whether the hand on the felt was dealt from the
  // seed now standing.
  const deckOf = (seed, handNo) => {
    const draw = mulberry32(Number(seed) + handNo * 7919);
    const deck = [];
    for (const r of RANKS) for (const c of SUITS) deck.push(r + c);
    for (const c of EXTRA) deck.push(c);
    // Fisher-Yates over the hand's own source.
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(draw() * (i + 1));
      const t = deck[i];
      deck[i] = deck[j];
      deck[j] = t;
    }
    return deck;
  };
  // The hand this match would deal right now, named — so the one on the felt
  // is this match's exactly when it answers to that name. A picker's write
  // respins the seed, which names a different hand, and the one standing
  // falls to the deal below and is taken off the felt (ir decision-06).
  const handNo = Number(match.hand_no);
  const roundId = `${match.id}/s${match.seed}/h${handNo}`;
  const round = standing !== undefined && standing.id === roundId ? standing : undefined;

  /* --- the deal ---------------------------------------------------------- */

  // Which hand it is says which shuffle it gets, so a hand dealt twice is the
  // same hand.
  if (round === undefined) {
    // A resolved hand of this match stays on the felt long enough to be read;
    // the button below it is for the impatient. One left by another match is
    // taken off at once.
    const now = event.type === "deal" || (event.type === "click" && event.from === "btn-next");
    const read = standing !== undefined && standing.match_id === match.id && (standing.result ?? "") !== "";
    if (read && !now) {
      return { updates: [], then: { type: "deal", delay: 2200 } };
    }
    const deck = deckOf(match.seed, handNo);
    const vira = named !== undefined ? "" : deck[deck.length - 1];
    const trumps = trumpsOf(vira);
    const mao = order[(handNo - 1) % order.length];
    const last = order[(order.indexOf(mao) + order.length - 1) % order.length];
    const iam = mao === mySeat ? "lead" : last === mySeat ? "foot" : "";
    const opener = mao === mySeat ? "your_turn" : "starts";
    const brink = brinkOf();
    const dealt = [];
    // The hand before this one leaves the table, named by what it is rather
    // than by anything remembered: a card still current that belongs to
    // another round is a card from a hand that is over.
    for (const h of rows.held ?? []) {
      if (h.current === "yes" && h.round_id !== roundId) {
        dealt.push({ op: "patch", entity: "held", id: h.id, row: { current: "no" } });
      }
    }
    for (const r of rows.round ?? []) {
      if (r.current === "yes" && r.id !== roundId) {
        dealt.push({ op: "patch", entity: "round", id: r.id, row: { current: "no" } });
      }
    }
    dealt.push({
      op: "put",
      entity: "round",
      id: roundId,
      row: {
        match_id: match.id, hand_no: txt(handNo), vira,
        manilha: manilhaWord(trumps),
        phase: "dealt", truco_state: "none", ran: "", v1: "", v2: "", v3: "",
        stake: txt(ladder[0]), result: "",
        said: brink !== "" ? `brink_${variant}_${brink}` : iam === "" ? opener : `${iam}_${opener}`,
        leader: mao, asked: "", raised: "", rung: txt(brink !== "" ? 0 : nextRung(ladder[0])),
        brink,
        shout_word: "", shout_from: "", shout_state: "gone", shout_kind: "call", shout_t: "0",
        envido: "", envido_asked: "", envido_rung: "0", envido_calls: "",
        envido_us: "0", envido_them: "0", envido_result: "",
        turn_seat: mao,
        ui_deadline: "2026-09-09T12:00:15Z",
        backend_deadline: "2026-09-09T12:00:20Z",
        current: "yes",
      },
    });
    order.forEach((seat, i) => {
      deck.slice(i * 3, i * 3 + 3).forEach((card, slot) => {
        const p = power(card, trumps);
        dealt.push({
          op: "put",
          entity: "held",
          id: `${roundId}/${seat}/${slot}`,
          row: {
            round_id: roundId, seat, card,
            rank: rank(card), suit: suit(card),
            face: "QJK".includes(rank(card)) ? rank(card) : suit(card),
            power: txt(p), manilha: trumps.includes(card) ? "yes" : "no", slot: txt(slot),
            // Only your own cards are ever tappable, and only when it is your
            // turn and nobody still owes a brink; the fold says so on its next
            // pass either way.
            blocked: seat === mySeat && mao === mySeat && !SIDES.includes(brink) ? "" : "disabled",
            display_seat: displaySeatOf(seat),
            current: "yes",
          },
        });
      });
    });
    return { updates: dealt };
  }
  if (round === undefined) return { updates: [] };

  const anyHeld = (rows.held ?? []).some((h) => h.round_id === round.id);
  if (!anyHeld && (round.result ?? "") === "") {
    const deck = deckOf(match.seed, handNo);
    const vira = named !== undefined ? "" : deck[deck.length - 1];
    const trumps = trumpsOf(vira);
    const mao = round.leader;
    const dealtHeld = [];
    for (const h of rows.held ?? []) {
      if (h.current === "yes" && h.round_id !== round.id) {
        dealtHeld.push({ op: "patch", entity: "held", id: h.id, row: { current: "no" } });
      }
    }
    const playedSlots = new Set(
      (rows.play ?? [])
        .filter((p) => p.round_id === round.id && p.kind === "card")
        .map((p) => `${p.seat}/${p.from_slot ?? ""}`)
    );
    order.forEach((seat, i) => {
      deck.slice(i * 3, i * 3 + 3).forEach((card, slot) => {
        if (playedSlots.has(`${seat}/${slot}`)) return;
        const p = power(card, trumps);
        dealtHeld.push({
          op: "put",
          entity: "held",
          id: `${round.id}/${seat}/${slot}`,
          row: {
            round_id: round.id, seat, card,
            rank: rank(card), suit: suit(card),
            face: "QJK".includes(rank(card)) ? rank(card) : suit(card),
            power: txt(p), manilha: trumps.includes(card) ? "yes" : "no", slot: txt(slot),
            blocked: seat === mySeat && seat === (round.turn_seat || mao) ? "" : "disabled",
            display_seat: displaySeatOf(seat),
            current: "yes",
          },
        });
      });
    });
    return { updates: dealtHeld };
  }

  const log = (rows.play ?? [])
    .filter((p) => p.round_id === round.id)
    .sort((a, b) => String(a.seq).localeCompare(String(b.seq)));
  // A place in the log, ordered as text like everything else, so that ten does
  // not sort before two.
  const at = () => String(log.length).padStart(2, "0");
  // The angle a card lies at once it is down: deterministic in the card, so it
  // is the same every time that card is played and never reshuffles under the
  // eye. Cards thrown on a table do not land square, and they do not
  // straighten themselves afterwards either.
  const lieOf = (card) => {
    let h = 0;
    for (const ch of card) h = (h * 31 + ch.codePointAt(0)) % 997;
    return txt((h % 15) - 7);
  };
  /** A put of a row that already knows its key: the terminal wants the key
   * beside the row, and saying it twice is how the two drift apart. */
  const put = (entity, row) => ({ op: "put", entity, id: row.id, row });

  const laidBy = (seat, from) => ({
    id: `${round.id}/v${vaza}/${seat}/card`,
    round_id: round.id, vaza: txt(vaza), seat, kind: "card",
    card: from.card, count: "", power: txt(from.power), said: "",
    from_slot: from.slot !== undefined ? String(from.slot) : undefined,
    rank: from.rank, suit: from.suit, face: from.face, manilha: from.manilha,
    lie: lieOf(from.card), win: "", seq: at(),
  });
  const saidBy = (seat, kind, said, stake) => ({
    id: `${round.id}/v${vaza}/${seat}/${kind}${stake === undefined ? "" : `/${stake}`}`,
    round_id: round.id, vaza: txt(vaza), seat, kind,
    card: "", count: "", power: "0", said, win: "", seq: at(),
  });
  const handOf = (seat) => (rows.held ?? []).filter((h) => h.current === "yes" && h.seat === seat);

  /* --- what the log says ------------------------------------------------- */

  const verdicts = [round.v1 ?? "", round.v2 ?? "", round.v3 ?? ""];
  // The rodada in play is the first without a verdict; none means the hand is
  // played out.
  const vaza = verdicts.findIndex((x) => x === "") + 1;

  // A raise is outstanding while the last word about the bet is the asking.
  // Whoever accepted last cannot ask again: the right to climb belongs to the
  // side that took the bet, which is what stops one side bidding against
  // itself.
  //
  // A call is made to the table and each other side answers for itself, so a
  // call stands until every side but the caller's has spoken. Running leaves
  // the hand rather than ending it; the hand ends when one side is left in it.
  // At two sides one answer settles a call and one run finishes a hand, so
  // only a table of three tells the two apart.
  let asked = "";
  let raisedBy = "";
  let ran = "";
  const folded = new Set();
  let spoke = new Set();
  for (const p of log) {
    if (p.kind === "truco") { asked = p.seat; spoke = new Set(); }
    else if (p.kind === "run" || p.kind === "accept") {
      if (p.kind === "run") { folded.add(sideOf(p.seat)); ran = p.seat; }
      else if (asked !== "") raisedBy = sideOf(asked);
      spoke.add(sideOf(p.seat));
      if (spoke.size >= SIDES.length - 1) asked = "";
    }
  }

  // The second wager, on the second slot. It is read off the same log and kept
  // apart from the truco's, which is the whole of what *el envido va primero*
  // needs: a truco call answered with envido leaves `asked` standing while the
  // envido runs, and the table finds it still waiting when the envido is paid.
  // Nothing has to remember that it was suspended, because nothing cleared it.
  const bet = price.envido;
  const CALLS = ["envido", "envido_real", "envido_falta"];
  let envidoChain = [];
  let envidoAsked = "";
  let envidoDone = "";
  let florBy = "";
  for (const p of log) {
    if (CALLS.includes(p.kind)) { envidoChain = [...envidoChain, p.kind]; envidoAsked = p.seat; }
    else if (p.kind === "envido_take") { envidoAsked = ""; envidoDone = "taken"; }
    else if (p.kind === "envido_run") { envidoAsked = ""; envidoDone = "ran"; }
    // A flor takes the envido off the hand whether or not one was asked for,
    // so it ends the chain rather than answering it.
    else if (p.kind === "flor") { florBy = p.seat; envidoAsked = ""; envidoDone = "flor"; }
  }
  // A falta is not a rung on the ladder: it is whatever the leading side still
  // has left to run, which is the one call whose worth the score decides.
  const faltaWorth = () => goal - Math.max(Number(match.us_score), Number(match.them_score));
  const chainWorth = (chain) => {
    if (chain.length === 0) return 0;
    if (chain[chain.length - 1] === "envido_falta") return faltaWorth();
    return chain.reduce((n, call) => n + bet[call], 0);
  };
  // Refusing pays what the chain was worth before the call being refused, and
  // one point when that is nothing.
  const refusalWorth = (chain) => Math.max(1, chainWorth(chain.slice(0, -1)));
  // Every hand follows from the seed and its number, so a seat's three cards
  // can be read back mid-trick without asking what is left in its hand: the
  // envido is a fact about the deal, not about what survives of it.
  const dealtTo = (seat) => {
    const d = deckOf(match.seed, handNo);
    const i = order.indexOf(seat);
    return d.slice(i * 3, i * 3 + 3);
  };
  const countFor = (side) =>
    Math.max(...order.filter((seat) => sideOf(seat) === side).map((seat) => envidoOf(dealtTo(seat))));
  // A tie goes to the mano, who led the first rodada.
  const envidoWinner = () => {
    const us = countFor("us");
    const them = countFor("them");
    if (us !== them) return us > them ? "us" : "them";
    return sideOf(round.leader);
  };

  // Whoever took the rodada before leads the next; a tie leaves the lead where
  // it was, and the first lead is a fact about the deal that no card states.
  let lead = round.leader;
  for (let i = 1; i < (vaza === 0 ? 4 : vaza); i += 1) {
    if (verdicts[i - 1] === "tie") continue;
    const took = log.find((p) => p.kind === "card" && Number(p.vaza) === i && p.win === "yes");
    if (took !== undefined) lead = took.seat;
  }

  // A pair that folded lays no more cards, so the rodada is full when the
  // seats still in it have played and the turn passes over the ones that left.
  const seated = order.filter((s) => !folded.has(sideOf(s)));
  const leadFrom = order.indexOf(lead);
  const leadSeat = order.slice(leadFrom).concat(order.slice(0, leadFrom))
    .find((s) => !folded.has(sideOf(s))) ?? lead;
  const laid = vaza === 0 ? [] : log.filter((p) => p.kind === "card" && Number(p.vaza) === vaza);
  const full = laid.length >= seated.length;
  const turn = seated[(seated.indexOf(leadSeat) + laid.length) % seated.length];
  const live = round.result === "" || round.result === undefined;
  // A side on the brink decides before any card is laid, and running is the
  // only run a brink hand can hold, since nobody may call a truco to run from.
  const brink = round.brink ?? "";
  const brinkOwed = SIDES.includes(brink) && live &&
    !log.some((p) => p.kind === "brink_play" || p.kind === "run");
  const playing = live && asked === "" && envidoAsked === "" && !brinkOwed && vaza !== 0 && !full;
  // Envido is called inside the first rodada and nowhere else: once the second
  // begins the window is shut for the rest of the hand. One per hand, and only
  // at a table that plays it.
  // A count is read off the deal, and the deal is every seat's cards — which
  // this dealer may work out for a house it is also playing, and must not work
  // out for a person across a room. Until the count travels as a row the other
  // side wrote, the second wager is dealt offline only: refused here rather
  // than settled from cards the screen is masking.
  const shared = match.opponent === "online";
  const envidoOpen = bet !== undefined && live && !shared &&
    vaza === 1 && envidoDone === "" && envidoAsked === "";
  const hasFlor = (seat) => new Set(dealtTo(seat).map(suit)).size === 1;
  const florOpen = (seat) =>
    price.flor !== undefined && live && !shared && vaza === 1 && florBy === "" && hasFlor(seat);
  // A side may call envido when it is its turn to play, and also when it owes
  // an answer to a truco — that second door is *el envido va primero*, and it
  // is a door rather than a mechanism because the truco call it steps in front
  // of is never cleared.
  const owes = (seat) => asked !== "" && sideOf(asked) !== sideOf(seat);
  const mayCallEnvido = (seat) => envidoOpen && (turn === seat || owes(seat));
  // What this seat may say about the second wager right now, named once and
  // read by both the felt and the click. A table without the wager lists
  // nothing, so nothing of it is drawn: a button offered where no rule can
  // answer it is a control that does nothing, and the felt has no business
  // knowing which tables deal what.
  //
  // A falta stakes the rest of the match, so nothing can be said over one.
  const owesEnvido = envidoAsked !== "" && sideOf(envidoAsked) !== sideOf(mySeat) && live;
  const climbing = (mayCallEnvido(mySeat) || owesEnvido) &&
    envidoChain[envidoChain.length - 1] !== "envido_falta";
  const calls = [
    mayCallEnvido(mySeat) ? "envido" : "",
    climbing ? "real" : "",
    climbing ? "falta" : "",
    florOpen(mySeat) ? "flor" : "",
    owesEnvido ? "answer" : "",
    brinkOwed && brink === sideOf(mySeat) ? "brink" : "",
  ].filter(Boolean).join(" ");
  // The envido pays when it resolves, not when the hand does, and through the
  // clamp the hand's own points pass — one goal, both wagers. A hand can be
  // lost by the side the envido just carried to the goal.
  // Every point either wager pays goes through here: the goal and the clamp
  // against it are one number read in one place, and a side that reaches the
  // goal ends the match whichever wager carried it there. Extra columns ride
  // along for the caller that also moves the hand on.
  const payTo = (side, worth, extra) => {
    const row = {};
    let won = "";
    for (const s of SIDES) {
      const after = Math.min(scoreOf(s) + (s === side ? worth : 0), goal);
      row[COLUMN[s]] = txt(after);
      if (after >= goal && won === "") won = s;
    }
    return {
      op: "patch",
      entity: "match",
      id: match.id,
      row: {
        ...row,
        status: won !== "" ? "over" : "playing",
        winner: won,
        ...extra,
      },
    };
  };
  const settleEnvido = (answerer, took) => {
    const side = took ? envidoWinner() : sideOf(envidoAsked);
    const word = took ? "envido_took" : "envido_ran";
    const rows = [put("play", saidBy(answerer, took ? "envido_take" : "envido_run", word))];
    // What each side said out loud, which is not the same as what each side
    // held: the mão says its number first, and whoever answers either beats it
    // out loud or concedes without showing. A side that concedes never says
    // what it had, so nothing writes it down.
    const shown = {us: 0, them: 0, others: 0};
    if (took) {
      // The mão is a seat, not a side. At two seats the two are the same and
      // the difference never shows; at four the mão rotates with the hand and
      // its partner sits where a side-lookup lands, so the wrong player says
      // the number. The answer comes from whoever the rule asks next: the
      // first seat round the table, from the mão, on the other side.
      const manoSeat = round.leader;
      const manoSide = sideOf(manoSeat);
      const otherSide = theOther(manoSide);
      const otherSeat = nextOn(otherSide, manoSeat) ?? answerer;
      shown[manoSide] = countFor(manoSide);
      rows.push(put("play", {
        ...saidBy(manoSeat, "envido_count", ""),
        count: txt(shown[manoSide]),
      }));
      const theirs = countFor(otherSide);
      if (theirs > shown[manoSide]) {
        shown[otherSide] = theirs;
        rows.push(put("play", {
          ...saidBy(otherSeat, "envido_count", ""),
          count: txt(theirs),
        }));
      } else {
        rows.push(put("play", saidBy(otherSeat, "envido_good", "envido_good")));
      }
    }
    rows.push(...patchRound({
      ...view,
      envido: took ? "scored" : "ran",
      envido_us: txt(shown.us),
      envido_them: txt(shown.them),
      envido_result: side,
      ...said(word),
    }));
    rows.push(payTo(side, took ? chainWorth(envidoChain) : refusalWorth(envidoChain)));
    return rows;
  };
  // One way to say it, wherever it is said from — the seat, the house on its
  // own turn, and the house stepping in front of a truco all write the same
  // row and the same columns. What it is worth if taken is the chain with this
  // call on the end, which is the plain envido's two when the chain is empty.
  const callEnvido = (seat, kind) => [
    put("play", saidBy(seat, kind, kind)),
    ...patchRound({
      ...view,
      envido: "called", envido_asked: seat,
      envido_rung: txt(chainWorth([...envidoChain, kind])),
      ...said(kind),
    }),
  ];
  // A flor is declared, not asked: it pays the side holding it and takes the
  // envido off the hand, whether or not one had been called.
  const declareFlor = (seat) => [
    put("play", saidBy(seat, "flor", "flor")),
    ...patchRound({
      ...view,
      envido: "flor", envido_asked: "", envido_result: sideOf(seat), ...said("flor"),
    }),
    payTo(sideOf(seat), price.flor),
  ];

  /* --- what the hand always carries -------------------------------------- */

  // Written whatever else happens, and only where it differs, so being woken
  // twice about the same hand writes nothing the second time.
  // A pair that ran while the hand goes on throws its cards in: they leave the
  // table rather than wait on it for a turn that never comes. Where running
  // ends the hand, the hand's own end takes them.
  const thrownIn = (seat) => folded.has(sideOf(seat)) && folded.size < SIDES.length - 1;
  const keep = (rows.held ?? [])
    .filter((h) => h.current === "yes")
    .map((h) => {
      if (thrownIn(h.seat)) return { op: "patch", entity: "held", id: h.id, row: { current: "no" } };
      const targetDisplay = displaySeatOf(h.seat);
      const isMine = h.seat === mySeat;
      const targetBlocked = isMine && playing && turn === mySeat ? "" : "disabled";
      const patch = {};
      if ((h.display_seat ?? "") !== targetDisplay) patch.display_seat = targetDisplay;
      if ((h.blocked ?? "") !== targetBlocked) patch.blocked = targetBlocked;
      return Object.keys(patch).length > 0
        ? { op: "patch", entity: "held", id: h.id, row: patch }
        : null;
    })
    .filter(Boolean);

  // A brink hand has no ladder to climb, which the rung says the way it says
  // a ladder already at its top.
  const rung = brink !== "" ? 0 : nextRung(round.stake);
  const view = {};
  if (brink !== "" || rung === 0) {
    if ((round.truco_state ?? "none") !== "none") view.truco_state = "none";
    if (round.said === "truco" || round.said === "retruco" || round.said === "vale4") {
      view.said = brink !== "" ? `brink_played_${sideOf(mySeat)}` : "";
    }
  }
  if ((round.asked ?? "") !== asked) view.asked = asked;
  if ((round.raised ?? "") !== raisedBy) view.raised = raisedBy;
  if (Number(round.rung ?? 0) !== rung) view.rung = txt(rung);
  if ((round.envido_calls ?? "") !== calls) view.envido_calls = calls;
  if ((round.turn_seat ?? "") !== turn) {
    view.turn_seat = turn;
    view.ui_deadline = "2026-09-09T12:00:15Z";
    view.backend_deadline = "2026-09-09T12:00:20Z";
    if (playing) {
      view.said = turn === mySeat
        ? "your_turn"
        : (match.opponent === "online" ? "opponent_turn" : "turn_of");
    }
  }

  const vCode = VOICE_OF[variant] ?? "sp";
  const vData = VOICE[vCode] ?? VOICE.sp;
  const wordOf = (r) => (vData.ladder[r] ?? (Number(r) > 0 ? "TRUCO!" : "")).toUpperCase();

  let targetShoutWord = "";
  let targetShoutFrom = "";
  let targetShoutKind = "";
  let targetShoutState = "gone";

  if (asked !== "") {
    const askRung = Number(round.rung ?? rung);
    targetShoutWord = wordOf(askRung);
    targetShoutFrom = sideOf(asked);
    targetShoutKind = "call";
    targetShoutState = "live";
  } else if (ran !== "") {
    targetShoutWord = vData.ran;
    targetShoutFrom = sideOf(ran);
    targetShoutKind = "run";
    targetShoutState = "live";
  } else if (round.shout_kind === "accept" && round.shout_state === "live") {
    targetShoutWord = round.shout_word ?? (vData.accept ?? "CAI DENTRO!");
    targetShoutFrom = round.shout_from ?? "";
    targetShoutKind = "accept";
    targetShoutState = "live";
  } else if (match.status === "over" || (match.winner ?? "") !== "") {
    const weWon = match.winner === "us";
    targetShoutWord = weWon ? vData.we_won : vData.they_won;
    targetShoutFrom = match.winner || "us";
    targetShoutKind = "close";
    targetShoutState = (round.shout_done === "yes" || round.shout_state === "gone") ? "gone" : "live";
  } else if ((round.result ?? "") !== "" || (round.phase ?? "") === "result") {
    const winSide = SIDES.includes(round.result) ? round.result : (round.result === "us" ? "us" : round.result === "them" ? "them" : "");
    if (winSide === "us") {
      targetShoutWord = vData.we_won;
      targetShoutFrom = "us";
      targetShoutKind = "win";
      targetShoutState = "live";
    } else if (winSide === "them") {
      targetShoutWord = vData.they_won;
      targetShoutFrom = "them";
      targetShoutKind = "win";
      targetShoutState = "live";
    }
  }

  if (targetShoutState === "gone") {
    targetShoutWord = round.shout_word ?? "";
    targetShoutFrom = round.shout_from ?? "";
    targetShoutKind = round.shout_kind ?? "";
  }

  if ((round.shout_state ?? "gone") !== targetShoutState) view.shout_state = targetShoutState;
  if ((round.shout_word ?? "") !== targetShoutWord) {
    view.shout_word = targetShoutWord;
    view.shout_t = (round.shout_t ?? "1") === "1" ? "2" : "1";
  }
  if ((round.shout_from ?? "") !== targetShoutFrom) view.shout_from = targetShoutFrom;
  if ((round.shout_kind ?? "") !== targetShoutKind) view.shout_kind = targetShoutKind;
  const said = (line) => (line === (round.said ?? "") ? {} : { said: line });
  const patchRound = (patch) =>
    Object.keys(patch).length === 0 ? [] : [{ op: "patch", entity: "round", id: round.id, row: patch }];

  const settled = (extra) => ({ updates: [...keep, ...patchRound({ ...view, ...extra })] });
  const after = (type, delay) => ({ updates: [...keep, ...patchRound(view)], then: { type, delay } });

  // Playing a brink hand raises it to the brink's worth at once; the lead is
  // still the deal's, so the mão lays first once the decision is in.
  const playBrink = (seat) => [
    put("play", saidBy(seat, "brink_play", `brink_played_${sideOf(seat)}`)),
    ...patchRound({ ...view, stake: txt(price.brink.worth), ...said(`brink_played_${sideOf(seat)}`) }),
    { op: "patch", entity: "match", id: match.id, row: { stake: txt(price.brink.worth) } },
  ];

  /* --- what you did ------------------------------------------------------ */

  // A tap is an instruction, and the only one the table takes from outside:
  // it becomes a row and stops there. What follows from it is read off the log
  // like everything else, on the wake the row itself raises.
  if (event.type === "click") {
    if (event.from === "btn-set-seat") {
      const seat = event.detail?.seat ?? event.seat ?? "you";
      const targetSeed = event.detail?.seed !== undefined ? String(event.detail.seed) : undefined;
      // Seating with a seed names the table it is seating at. It named the
      // online one and nothing else, which is the one table the second wager
      // is refused at — so a deal chosen for what its counts do could never be
      // played for them.
      const targetOpponent = event.detail?.opponent ?? "online";
      const targetOpponentName = event.detail?.opponent_name ??
        (CAST[targetOpponent] ?? CAST.online).name;
      if (targetSeed !== undefined && (match.seed !== targetSeed || match.opponent !== targetOpponent || match.my_seat !== seat || match.opponent_name !== targetOpponentName)) {
        const retire = [];
        for (const h of rows.held ?? []) {
          if (h.current === "yes") {
            retire.push({ op: "patch", entity: "held", id: h.id, row: { current: "no" } });
          }
        }
        for (const r of rows.round ?? []) {
          if (r.current === "yes") {
            retire.push({ op: "patch", entity: "round", id: r.id, row: { current: "no" } });
          }
        }
        return {
          updates: [
            ...retire,
            {
              op: "patch",
              entity: "match",
              id: match.id,
              row: {
                seed: targetSeed,
                opponent: targetOpponent,
                opponent_name: targetOpponentName,
                my_seat: seat,
                hand_no: "1",
                us_score: "0",
                them_score: "0",
                others_score: "0",
                stake: String(opening(match.variant)),
                winner: "",
                status: "playing",
              },
            },
          ],
        };
      }
      if (match.my_seat !== seat) {
        return {
          updates: [
            { op: "patch", entity: "match", id: match.id, row: { my_seat: seat } },
          ],
        };
      }
      return { updates: [] };
    }
    const CALL_OF = {
      "btn-envido": "envido",
      "btn-envido-real": "envido_real",
      "btn-envido-falta": "envido_falta",
    };
    const OFFER_OF = { envido: "envido", envido_real: "real", envido_falta: "falta" };
    const calling = CALL_OF[event.from];
    if (calling !== undefined) {
      if (!calls.split(" ").includes(OFFER_OF[calling])) return { updates: [] };
      return { updates: callEnvido(mySeat, calling) };
    }
    if (event.from === "btn-brink-play" || event.from === "btn-brink-run") {
      if (!calls.split(" ").includes("brink")) return { updates: [] };
      if (event.from === "btn-brink-play") return { updates: playBrink(mySeat) };
      return { updates: [put("play", saidBy(mySeat, "run", "brink_ran_us"))] };
    }
    if (event.from === "btn-flor") {
      if (!calls.split(" ").includes("flor")) return { updates: [] };
      return { updates: declareFlor(mySeat) };
    }
    if (event.from === "btn-envido-take" || event.from === "btn-envido-run") {
      if (!calls.split(" ").includes("answer")) return { updates: [] };
      return { updates: settleEnvido(mySeat, event.from === "btn-envido-take") };
    }
    if (event.from === "btn-truco") {
      const caller = mySeat;
      const callerSide = sideOf(caller);
      if (!playing || rung === 0 || asked !== "" || (round.result ?? "") !== "" || turn !== mySeat || raisedBy === callerSide) {
        if ((round.truco_state ?? "none") !== "none" || (round.asked ?? "") !== "") {
          return {
            updates: patchRound({
              ...view,
              truco_state: "none",
              asked: "",
              rung: txt(rung),
            }),
          };
        }
        return { updates: [] };
      }
      const updates = [
        put("play", saidBy(caller, "truco", `rung_${variant}_${rung}`, round.stake)),
        ...patchRound({
          ...view,
          asked: caller,
          rung: txt(rung),
          shout_state: "live",
          shout_word: wordOf(rung),
          shout_from: callerSide,
          shout_kind: "call",
          shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
          ...said(`rung_${variant}_${rung}`),
        }),
      ];
      if (match.opponent === "online") {
        const actId = `${match.seed}/h${handNo}/v${vaza}/${caller}/truco/${rung}`;
        updates.push({
          op: "put",
          entity: "room_action",
          id: actId,
          row: {
            id: actId,
            room_seed: String(match.seed),
            player_id: caller,
            action: "truco",
            card: "",
            slot: rung,
          },
        });
      }
      return { updates };
    }
    const mySide = sideOf(mySeat);
    // Any side but this one, because at three pairs a call comes from one of
    // two and both are owed the same answer.
    if (asked !== "" && sideOf(asked) !== mySide) {
      if (event.from === "btn-run") {
        const updates = [
          put("play", saidBy(mySeat, "run", "ran")),
          ...patchRound({
            ...view,
            asked: "",
            ran: mySide,
            shout_state: "live",
            shout_word: vData.ran,
            shout_from: mySide,
            shout_kind: "run",
            shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
            ...said("ran"),
          }),
        ];
        if (match.opponent === "online") {
          const actId = `${match.seed}/h${handNo}/v${vaza}/${mySeat}/run`;
          updates.push({
            op: "put",
            entity: "room_action",
            id: actId,
            row: {
              id: actId,
              room_seed: String(match.seed),
              player_id: mySeat,
              action: "run",
              card: "",
              slot: 0,
            },
          });
        }
        return { updates };
      }
      if (event.from === "btn-accept") {
        const acceptWord = vData.accept ?? "CAI DENTRO!";
        const updates = [
          put("play", saidBy(mySeat, "accept", "took", round.stake)),
          ...patchRound({
            ...view,
            asked: "",
            shout_state: "live",
            shout_word: acceptWord,
            shout_from: mySide,
            shout_kind: "accept",
            shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
            rung: txt(nextRung(rung)),
            stake: txt(rung),
            ...said("worth"),
          }),
          { op: "patch", entity: "match", id: match.id, row: { stake: txt(rung) } },
        ];
        if (match.opponent === "online") {
          const actId = `${match.seed}/h${handNo}/v${vaza}/${mySeat}/accept/${rung}`;
          updates.push({
            op: "put",
            entity: "room_action",
            id: actId,
            row: {
              id: actId,
              room_seed: String(match.seed),
              player_id: mySeat,
              action: "accept",
              card: "",
              slot: rung,
            },
          });
        }
        return { updates, then: { type: "close_shout", delay: 1800 } };
      }
      // Answering a raise with a higher one is two moves, and they are two
      // rows: the rung on the table is taken, then the next is asked for. The
      // second is asked at the stake the first settled on.
      if (event.from === "btn-raise" && nextRung(rung) !== 0) {
        const next = nextRung(rung);
        const taken = saidBy(mySeat, "accept", "took", round.stake);
        const over = saidBy(mySeat, "truco", `rung_${variant}_${next}`, rung);
        const updates = [
          put("play", taken),
          put("play", over),
          ...patchRound({
            ...view,
            asked: mySeat,
            rung: txt(next),
            stake: txt(rung),
            shout_state: "live",
            shout_word: wordOf(next),
            shout_from: mySide,
            shout_kind: "call",
            shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
            ...said(`rung_${variant}_${next}`),
          }),
          { op: "patch", entity: "match", id: match.id, row: { stake: txt(rung) } },
        ];
        if (match.opponent === "online") {
          const actId = `${match.seed}/h${handNo}/v${vaza}/${mySeat}/raise/${next}`;
          updates.push({
            op: "put",
            entity: "room_action",
            id: actId,
            row: {
              id: actId,
              room_seed: String(match.seed),
              player_id: mySeat,
              action: "truco",
              card: "",
              slot: next,
            },
          });
        }
        return { updates };
      }
      return { updates: [] };
    }
    if (event.from === "btn-bot-truco" && asked === "") {
      const callingSeat = order.find((s) => sideOf(s) !== sideOf(mySeat)) ?? "eles1";
      const callerSide = sideOf(callingSeat);
      if (!playing || rung === 0 || raisedBy === callerSide) return { updates: [] };
      return {
        updates: [
          put("play", saidBy(callingSeat, "truco", `rung_${variant}_${rung}`, round.stake)),
          ...patchRound({
            ...view,
            asked: callingSeat,
            rung: txt(rung),
            shout_state: "live",
            shout_word: wordOf(rung),
            shout_from: callerSide,
            shout_kind: "call",
            shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
            ...said(`rung_${variant}_${rung}`),
          }),
        ],
      };
    }
    if (event.from === "btn-bot-accept" && asked !== "") {
      const answeringSeat = order.find((s) => sideOf(s) !== sideOf(asked)) ?? "eles1";
      const answeringSide = sideOf(answeringSeat);
      const acceptWord = vData.accept ?? "CAI DENTRO!";
      return {
        updates: [
          put("play", saidBy(answeringSeat, "accept", "took", round.stake)),
          ...patchRound({
            ...view,
            asked: "",
            shout_state: "live",
            shout_word: acceptWord,
            shout_from: answeringSide,
            shout_kind: "accept",
            shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
            rung: txt(nextRung(rung)),
            stake: txt(rung),
            ...said("worth"),
          }),
          { op: "patch", entity: "match", id: match.id, row: { stake: txt(rung) } },
        ],
        then: { type: "close_shout", delay: 1800 },
      };
    }
    if (event.from === "btn-bot-run" && asked !== "") {
      const answeringSeat = order.find((s) => sideOf(s) !== sideOf(asked)) ?? "eles1";
      return {
        updates: [
          put("play", saidBy(answeringSeat, "run", "ran")),
          ...patchRound({
            ...view,
            asked: "",
            ran: sideOf(answeringSeat),
            shout_state: "live",
            shout_word: vData.ran,
            shout_from: sideOf(answeringSeat),
            shout_kind: "run",
            shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
            ...said("ran"),
          }),
        ],
      };
    }
    if (event.from !== "btn-bot-play" && event.from !== "btn-bot-accept" && event.from !== "btn-bot-run" && event.from !== "btn-bot-truco") {
      const card = (rows.held ?? []).find((h) => h.id === event.id);
      if (card === undefined || card.current !== "yes") return { updates: [] };
      if (!playing || turn !== card.seat || card.seat !== mySeat) return { updates: [] };
      const nextTurn = seated[(seated.indexOf(leadSeat) + laid.length + 1) % seated.length];
      const nextSaid = nextTurn === mySeat ? "your_turn" : (match.opponent === "online" ? "opponent_turn" : "turn_of");
      const updates = [
        { op: "patch", entity: "held", id: card.id, row: { current: "no" } },
        put("play", laidBy(card.seat, card)),
        ...(rows.held ?? [])
          .filter((h) => h.current === "yes" && h.seat === mySeat && h.id !== card.id)
          .map((h) => ({ op: "patch", entity: "held", id: h.id, row: { blocked: "disabled" } })),
        ...patchRound({
          ...view,
          turn_seat: nextTurn,
          said: nextSaid,
          ...(round.shout_state === "live" && round.shout_kind === "accept" ? { shout_state: "gone" } : {}),
        }),
      ];
      if (match.opponent === "online") {
        const actId = `${match.seed}/h${handNo}/v${vaza}/${mySeat}/card`;
        updates.push({
          op: "put",
          entity: "room_action",
          id: actId,
          row: {
            id: actId,
            room_seed: String(match.seed),
            player_id: mySeat,
            action: "play_card",
            card: card.card,
            slot: Number(card.slot ?? 0),
          },
        });
      }
      return { updates };
    }
  }

  /* --- somebody ran ------------------------------------------------------ */

  // Folding ends the hand only when one pair is left to take it.
  if (ran !== "" && live && folded.size >= SIDES.length - 1) {
    return settled({
      phase: "result",
      result: SIDES.find((sd) => !folded.has(sd)) ?? theOther(sideOf(ran)),
      // A run from the brink answers the question the table just asked out
      // loud, so it says which side answered.
      ...said(brink !== "" ? `brink_ran_${sideOf(ran)}` : "ran"),
    });
  }

  /* --- the hand is over -------------------------------------------------- */

  if (!live) {
    // Scored exactly once: scoring is what moves the match on to the next
    // hand, so a hand whose number the match has already passed is paid for.
    if (Number(match.hand_no) !== Number(round.hand_no)) return settled({});
    // "ran" stands a beat before the score replaces it.
    if (ran !== "" && event.type !== "paid") return after("paid", BEAT);
    const worth = Number(round.stake);
    const isGameOver = SIDES.some((s) => Math.min(scoreOf(s) + (s === round.result ? worth : 0), goal) >= goal);
    const winWord = round.result === "us" ? vData.we_won : round.result === "them" ? vData.they_won : "";
    const line = round.result === "draw"
      ? "draw_hand"
      : round.result === "us" ? "you_won_hand" : "they_won_hand";
    const shoutWord = isGameOver ? winWord : (ran !== "" ? vData.ran : winWord);
    const shoutFrom = isGameOver ? (match.winner || (round.result === "us" ? "us" : "them")) : (ran !== "" ? sideOf(ran) : (round.result === "us" ? "us" : "them"));
    const shoutKind = isGameOver ? "close" : (ran !== "" ? "run" : "win");
    const updates = [
      ...keep,
      ...(rows.held ?? [])
        .filter((h) => h.current === "yes" && h.round_id === round.id)
        .map((h) => ({ op: "patch", entity: "held", id: h.id, row: { current: "no" } })),
      ...patchRound({
        ...view,
        shout_state: shoutWord !== "" ? "live" : "gone",
        shout_word: shoutWord,
        shout_from: shoutFrom,
        shout_kind: shoutKind,
        shout_t: (round.shout_word === shoutWord && round.shout_kind === shoutKind)
          ? (round.shout_t ?? "1")
          : ((round.shout_t ?? "1") === "1" ? "2" : "1"),
        ...said(line),
      }),
      // Any pair can take a hand; a draw is paid to nobody.
      payTo(SIDES.includes(round.result) ? round.result : "", worth, {
        stake: txt(ladder[0]),
        hand_no: txt(Number(round.hand_no) + 1),
      }),
    ];
    if (isGameOver) {
      return { updates, then: { type: "close_shout", delay: 2400 } };
    }
    return { updates };
  }

  /* --- somebody asked the envido ----------------------------------------- */

  // Answered before any truco standing beneath it, which is the rule's whole
  // content: whoever owes the envido settles it, and only then does the table
  // look down and find the truco still unanswered.
  if (envidoAsked !== "") {
    if (sideOf(envidoAsked) === "them") return settled({});
    if (event.type !== "answer") return after("answer", BEAT * 2);
    const seat = nextOn("them", envidoAsked) ?? "eles1";
    // The personas bet on one scale and are not given a second one here: the
    // truco threshold they already carry, read against the envido's own
    // ceiling of thirty-three rather than a hand's eleven.
    if (florOpen(seat)) return { updates: [...keep, ...declareFlor(seat)] };
    const count = envidoOf(dealtTo(seat));
    // A count well past what it would have opened on is worth climbing rather
    // than merely taking. Real envido is the only rung above a plain one that
    // this house reaches for: a falta stakes the rest of the match, and it
    // does not gamble the whole race on a count.
    const mayClimb = !envidoChain.includes("envido_real") &&
      envidoChain[envidoChain.length - 1] !== "envido_falta";
    if (mayClimb && count >= Math.round((who(seat).call / 11) * 33) + 3) {
      return { updates: [...keep, ...callEnvido(seat, "envido_real")] };
    }
    const takes = count >= Math.round((who(seat).take / 11) * 33);
    return { updates: [...keep, ...settleEnvido(seat, takes)] };
  }

  /* --- somebody asked ---------------------------------------------------- */

  if (asked !== "") {
    if (match.opponent === "online") {
      const answeringSeat = order.find((s) => sideOf(s) !== sideOf(asked)) ?? "eles1";
      const roomActions = (rows.room_action ?? []).filter((a) => String(a.room_seed) === String(match.seed));
      const remoteAccept = roomActions.find((a) =>
        a.player_id === answeringSeat &&
        a.action === "accept" &&
        (a.id ? a.id.startsWith(`${match.seed}/h${handNo}/`) : true)
      );
      if (remoteAccept || event.from === "btn-bot-accept") {
        const answeringSide = sideOf(answeringSeat);
        const acceptWord = vData.accept ?? "CAI DENTRO!";
        return {
          updates: [
            ...keep,
            put("play", saidBy(answeringSeat, "accept", "took", round.stake)),
            ...patchRound({
              ...view,
              asked: "",
              shout_state: "live",
              shout_word: acceptWord,
              shout_from: answeringSide,
              shout_kind: "accept",
              shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
              rung: txt(nextRung(rung)),
              stake: txt(rung),
              ...said("worth"),
            }),
            { op: "patch", entity: "match", id: match.id, row: { stake: txt(rung) } },
          ],
          then: { type: "close_shout", delay: 1800 },
        };
      }
      const remoteRun = roomActions.find((a) =>
        a.player_id === answeringSeat &&
        a.action === "run" &&
        (a.id ? a.id.startsWith(`${match.seed}/h${handNo}/`) : true)
      );
      if (remoteRun || event.from === "btn-bot-run") {
        return {
          updates: [
            ...keep,
            put("play", saidBy(answeringSeat, "run", "ran")),
            ...patchRound({
              ...view,
              asked: "",
              ran: sideOf(answeringSeat),
              shout_state: "live",
              shout_word: vData.ran,
              shout_from: sideOf(answeringSeat),
              shout_kind: "run",
              shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
            }),
          ],
        };
      }
      const remoteRaise = roomActions.find((a) =>
        a.player_id === answeringSeat &&
        a.action === "truco" &&
        Number(a.slot) > rung &&
        (a.id ? a.id.startsWith(`${match.seed}/h${handNo}/`) : true)
      );
      if (remoteRaise) {
        const raiseRung = Number(remoteRaise.slot);
        const taken = saidBy(answeringSeat, "accept", "took", round.stake);
        const over = saidBy(answeringSeat, "truco", `rung_${variant}_${raiseRung}`, rung);
        return {
          updates: [
            ...keep,
            put("play", taken),
            put("play", over),
            ...patchRound({
              ...view,
              asked: answeringSeat,
              rung: txt(raiseRung),
              stake: txt(rung),
              shout_state: "live",
              shout_word: wordOf(raiseRung),
              shout_from: sideOf(answeringSeat),
              shout_kind: "call",
              shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
              ...said(`rung_${variant}_${raiseRung}`),
            }),
            { op: "patch", entity: "match", id: match.id, row: { stake: txt(rung) } },
          ],
        };
      }
      return settled({});
    }
    // Every side but the caller's owes an answer, and each gives its own. The
    // house speaks for whichever of its pairs has not yet, one per beat; when
    // the only side still owing is this seat's, it waits. A house that
    // answered as one fixed pair would answer for it again every beat at a
    // table where a second pair still owes, and never let the call settle.
    const owing = SIDES.filter((sd) =>
      sd !== sideOf(asked) && !spoke.has(sd) && sd !== sideOf(mySeat));
    if (owing.length === 0) return settled({});
    if (event.type !== "answer") return after("answer", BEAT * 2);
    const seat = nextOn(owing[0], asked) ?? "eles1";
    const hand = handOf(seat);
    const strength = strengthOf(hand);
    // El envido va primero, from this side of the table: a truco may be
    // answered with envido rather than taken or refused, and the truco stays
    // standing underneath while the count is settled. The threshold is the
    // one the house would have opened on.
    if (mayCallEnvido(seat) && envidoOf(dealtTo(seat)) >= Math.round((who(seat).call / 11) * 33)) {
      return { updates: [...keep, ...callEnvido(seat, "envido")] };
    }
    if (strength >= who(seat).take) {
      const acceptWord = vData.accept ?? "CAI DENTRO!";
      return {
        updates: [
          ...keep,
          put("play", saidBy(seat, "accept", "took", round.stake)),
          ...patchRound({
            ...view,
            asked: "",
            shout_state: "live",
            shout_word: acceptWord,
            shout_from: sideOf(seat),
            shout_kind: "accept",
            shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
            rung: txt(nextRung(rung)),
            stake: txt(rung),
            ...said("worth"),
          }),
          { op: "patch", entity: "match", id: match.id, row: { stake: txt(rung) } },
        ],
        then: { type: "close_shout", delay: 1800 },
      };
    }
    return {
      updates: [
        ...keep,
        put("play", saidBy(seat, "run", "ran")),
        ...patchRound({
          ...view,
          asked: "",
          ran: sideOf(seat),
          shout_state: "live",
          shout_word: vData.ran,
          shout_from: sideOf(seat),
          shout_kind: "run",
          shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
        }),
      ],
    };
  }

  /* --- the house is on the brink ----------------------------------------- */

  // The house sees every hand on its side, as the rule lets a pair on the
  // brink do, and plays when the best of them is one its persona would take a
  // truco on.
  if (brinkOwed && brink !== sideOf(mySeat)) {
    if (event.type !== "answer") return after("answer", BEAT * 2);
    const seats = order.filter((s) => sideOf(s) === brink);
    const best = Math.max(...seats.map((s) => strengthOf(handOf(s))));
    if (best >= who(seats[0]).take) return { updates: [...keep, ...playBrink(seats[0])] };
    return { updates: [...keep, put("play", saidBy(seats[0], "run", `brink_ran_${brink}`))] };
  }
  // Owed by this seat's side: nothing is laid until it has decided.
  if (brinkOwed) return settled({});

  /* --- the rodada is full ------------------------------------------------ */

  if (full) {
    if (event.type !== "beat") return after("beat", BEAT);
    const top = Math.max(...laid.map((p) => Number(p.power)));
    const best = laid.filter((p) => Number(p.power) === top);
    const won = new Set(best.map((p) => sideOf(p.seat)));
    // A top power shared across the two sides is a tie; shared within one side
    // is that side's.
    const verdict = won.size === 1 ? [...won][0] : "tie";
    const next = verdicts.slice();
    next[vaza - 1] = verdict;
    // The tie rules the table states: a tied first is settled by the second, a
    // tied second (or third) goes to whoever took the first, all tied is a draw.
    const handVerdict = ([a, b, c]) => {
      if (a === "") return "";
      if (a === "tie") {
        if (b === "") return "";
        if (b !== "tie") return b;
        return c === "" ? "" : c === "tie" ? "draw" : c;
      }
      if (b === "") return "";
      if (b === a || b === "tie") return a;
      if (c === "") return "";
      if (c === "tie" || c === a || c === b) return c === b ? b : a;
      // Three rodadas and three different pairs: nobody took two, which only a
      // table of three can manage. A primeira manda — the pair that took the
      // first takes the hand. Invented rather than sourced; the tie rules the
      // two-sided game states do not reach this far.
      return a;
    };
    const result = handVerdict(next);
    const takes = won.size === 1 ? new Set(best.map((p) => p.id)) : new Set();
    // Stated in full over every card of the rodada rather than only set, so a
    // conclusion this reaches twice is the same conclusion.
    const marks = laid
      .filter((p) => (p.win ?? "") !== (takes.has(p.id) ? "yes" : ""))
      .map((p) => ({ op: "patch", entity: "play", id: p.id, row: { win: takes.has(p.id) ? "yes" : "" } }));
    const line = verdict === "tie"
      ? `Empatou a ${trick}.`
      : verdict === "us" ? `${cap(trick)} sua.` : `${cap(trick)} deles.`;
    return {
      updates: [
        ...keep,
        ...marks,
        ...patchRound({
          ...view,
          v1: next[0], v2: next[1], v3: next[2],
          result,
          phase: result === "" ? ["v1", "v2", "v3"][Math.min(vaza, 2)] : "result",
          ...said(result === "" ? line : round.said ?? ""),
        }),
      ],
    };
  }

  /* --- eles play --------------------------------------------------------- */

  const botMove = event.from === "btn-bot-play";
  if (turn === mySeat && !botMove) return settled({});

  const oppSeat = order.find((s) => sideOf(s) !== sideOf(mySeat)) ?? "eles1";
  const actorSeat = botMove ? (event.detail?.seat ?? oppSeat) : turn;
  if (actorSeat === mySeat && !botMove) return settled({});
  if (turn !== actorSeat) return settled({});

  const hand = handOf(actorSeat);
  if (hand.length === 0) return settled({});

  if (botMove) {
    const cardTarget = event.detail?.card ?? event.card;
    const slotTarget = event.detail?.slot ?? event.slot;
    const pick = (cardTarget ? hand.find((c) => c.card === cardTarget) : null)
      ?? (slotTarget !== undefined ? hand.find((c) => String(c.slot) === String(slotTarget)) : null)
      ?? (hand.slice().sort((x, y) => Number(x.power) - Number(y.power)).find((c) => Number(c.power) > (laid.length === 0 ? 0 : Math.max(...laid.map((p) => Number(p.power))))) ?? hand[0]);
    return {
      updates: [
        ...keep,
        { op: "patch", entity: "held", id: pick.id, row: { current: "no" } },
        put("play", laidBy(actorSeat, pick)),
        ...patchRound({
          ...view,
          ...(round.shout_state === "live" && round.shout_kind === "accept" ? { shout_state: "gone" } : {}),
        }),
      ],
    };
  }

  if (match.opponent === "online") {
    const roomActions = (rows.room_action ?? []).filter((a) => String(a.room_seed) === String(match.seed));
    if (asked === "" && playing && rung !== 0 && raisedBy !== sideOf(actorSeat)) {
      const remoteTruco = roomActions.find((a) =>
        a.player_id === actorSeat &&
        a.action === "truco" &&
        Number(a.slot) === rung &&
        (a.id ? a.id.startsWith(`${match.seed}/h${handNo}/`) : true)
      );
      if (remoteTruco) {
        return {
          updates: [
            ...keep,
            put("play", saidBy(actorSeat, "truco", `rung_${variant}_${rung}`, round.stake)),
            ...patchRound({
              ...view,
              asked: actorSeat,
              shout_state: "live",
              shout_word: wordOf(rung),
              shout_from: sideOf(actorSeat),
              shout_kind: "call",
              shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
              ...said(`rung_${variant}_${rung}`),
            }),
          ],
        };
      }
    }
    const targetActId = `${match.seed}/h${handNo}/v${vaza}/${actorSeat}/card`;
    const remotePlay = roomActions.find((a) =>
      a.id === targetActId || (
        a.player_id === actorSeat &&
        a.action === "play_card" &&
        (a.id ? a.id.startsWith(`${match.seed}/h${handNo}/v${vaza}/`) : true)
      )
    );
    if (remotePlay) {
      const pick = (remotePlay.card ? hand.find((c) => c.card === remotePlay.card) : null)
        ?? (remotePlay.slot !== undefined ? hand.find((c) => String(c.slot) === String(remotePlay.slot)) : null)
        ?? hand[0];
      return {
        updates: [
          ...keep,
          { op: "patch", entity: "held", id: pick.id, row: { current: "no" } },
          put("play", laidBy(actorSeat, pick)),
          ...patchRound(view),
        ],
      };
    }
    return settled({});
  }

  const persona = who(turn);
  const strength = strengthOf(hand);
  const mayCall = sideOf(turn) !== raisedBy && rung !== 0;
  const wants = mayCall && strength >= persona.call;
  // El envido va primero at this end of the table too: a count worth betting
  // is bet before any card and before any truco, because the window shuts when
  // the first rodada does. The threshold is the persona's own — the same
  // number it calls a truco on, read against the envido's ceiling of
  // thirty-three rather than against a hand's eleven.
  const wantsEnvido = mayCallEnvido(turn) &&
    envidoOf(dealtTo(turn)) >= Math.round((persona.call / 11) * 33);

  // The tell first, then the call a beat later. A player who is watching gets
  // the warning; one who is not gets trucado.
  // The round says what it last said as a key, so the tell is recognised by the
  // name it was written under rather than by the sentence it stands for.
  //
  // Both wagers get it, and the same one: the tell is the player's habit before
  // betting rather than a thing they do about truco, so Seu Nezinho squares his
  // cards before either call and you learn to read the man, not the bet.
  if ((wants || wantsEnvido) && persona.tell !== "" && (round.said ?? "") !== `tell_${castOf(turn)}` && event.type !== "call") {
    return { updates: [...keep, ...patchRound({ ...view, ...said(`tell_${castOf(turn)}`) })], then: { type: "call", delay: BEAT } };
  }
  if (event.type !== "act" && event.type !== "call") return after("act", BEAT);

  if (wantsEnvido) {
    return { updates: [...keep, ...callEnvido(turn, "envido")] };
  }

  if (wants) {
    const isFirstCall = Number(round.stake) === opening(match.variant);
    return {
      updates: [
        ...keep,
        put("play", saidBy(turn, "truco", `rung_${variant}_${rung}`, round.stake)),
        ...patchRound({
          ...view,
          asked: turn,
          shout_state: "live",
          shout_word: wordOf(rung),
          shout_from: sideOf(turn),
          shout_kind: "call",
          shout_t: (round.shout_t ?? "1") === "1" ? "2" : "1",
          ...said(isFirstCall ? `call_${castOf(turn)}` : `rung_${variant}_${rung}`),
        }),
      ],
    };
  }

  // Lowest winning card, else lowest card (ir decision-16). A mão de ferro is
  // played face down, so the house lays its cards in the order it was dealt
  // them, knowing no more about them than you know about yours.
  const toBeat = laid.length === 0 ? 0 : Math.max(...laid.map((p) => Number(p.power)));
  const sorted = hand.slice().sort((x, y) => Number(x.power) - Number(y.power));
  const pick = brink === "both"
    ? hand.slice().sort((x, y) => Number(x.slot) - Number(y.slot))[0]
    : sorted.find((c) => Number(c.power) > toBeat) ?? sorted[0];
  return {
    updates: [
      ...keep,
      { op: "patch", entity: "held", id: pick.id, row: { current: "no" } },
      put("play", laidBy(turn, pick)),
      ...patchRound({
        ...view,
        ...(round.shout_state === "live" && round.shout_kind === "accept" ? { shout_state: "gone" } : {}),
      }),
    ],
  };
}
