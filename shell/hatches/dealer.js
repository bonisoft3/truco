export default function mountDealer(screen, { signal, messages }) {
  if (screen._dealer) throw new Error("dealer already mounted");
  screen._dealer = true;
  const cleanups = new Set();
  const timers = new Set();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const id of timers) globalThis.clearTimeout(id);
    timers.clear();
    signal.removeEventListener("abort", dispose);
    const errors = [];
    for (const cleanup of [...cleanups].reverse()) {
      try { cleanup(); } catch (error) { errors.push(error); }
    }
    cleanups.clear();
    delete screen._dealer;
    if (errors.length) throw new AggregateError(errors, "dealer cleanup failed");
  };
  signal.addEventListener("abort", dispose, { once: true });
  const listen = (target, type, callback, options) => {
    if (!target) return;
    const cleanup = () => target.removeEventListener(type, listener, options);
    const listener = (...args) => {
      if (options?.once) cleanups.delete(cleanup);
      if (!disposed) return callback(...args);
    };
    target.addEventListener(type, listener, options);
    cleanups.add(cleanup);
  };
  const observe = (callback) => {
    const observer = new MutationObserver((...args) => { if (!signal.aborted) callback(...args); });
    cleanups.add(() => observer.disconnect());
    return observer;
  };
  const setTimeout = (callback, delay) => {
    if (signal.aborted) return;
    const id = globalThis.setTimeout(() => {
      timers.delete(id);
      if (!signal.aborted) callback();
    }, delay);
    timers.add(id);
    return id;
  };
  const clearTimeout = (id) => {
    timers.delete(id);
    globalThis.clearTimeout(id);
  };
  const mark = (node, key) => {
    node.dataset[key] = "1";
    cleanups.add(() => { delete node.dataset[key]; });
  };
  const animate = (node, ...args) => {
    const animation = node.animate(...args);
    const cleanup = () => { animation.cancel(); delete node.dataset.flying; };
    const finished = () => {
      cleanups.delete(cleanup);
      animation.removeEventListener("finish", finished);
      animation.removeEventListener("cancel", finished);
    };
    animation.addEventListener("finish", finished);
    animation.addEventListener("cancel", finished);
    cleanups.add(cleanup);
    return animation;
  };
  const subscribe = (collection, callback) => {
    const subscription = collection.subscribeChanges(() => { if (!signal.aborted) callback(); });
    cleanups.add(typeof subscription === "function" ? subscription : () => subscription.unsubscribe());
  };
  const $ = (sel) => screen.querySelector(sel);

  const LADDER = { paulista: [1, 3, 6, 9, 12], mineiro: [2, 4, 8, 10, 12], gaucho: [1, 2, 3, 4], argentino: [1, 2, 3, 4], uruguayo: [1, 2, 3, 4], paraguayo: [1, 2, 3, 4], truc: [1, 2, 3], douradinha: [2, 4, 8, 10, 12], douradao: [2, 4, 8, 10, 12] };
  const DEFAULT_VARIANT = "mineiro";

  const RIVER = {
    raise_them: "SUBIR ES DE ELLOS", at_max: "AL MÁXIMO", their_turn: "EN SU TURNO", opponent_turn: "TURNO DEL RIVAL",
    turn_parca: "TURNO DEL COMPAÑERO", turn_eles1: "TURNO DEL RIVAL (1)", turn_eles2: "TURNO DEL RIVAL (2)",
    truco: "¡TRUCO!",
    title_ours: "Quien pidió no aumenta: les toca a ellos subir.", title_not_yours: "Solo pide quien tiene el turno.",
    title_waiting_online: "Esperando la jugada del rival en línea.",
    title_waiting_parca: "Esperando la jugada de tu compañero.", title_waiting_eles1: "Esperando la jugada del Rival 1.", title_waiting_eles2: "Esperando la jugada del Rival 2.",
    title_raise: "Aumentar la apuesta de esta mano",
    ceiling: "doce es el techo", raise_to: (c) => `sube a ${c}`, they_take: (s) => `ellos se llevan ${s}`, we_take: (s) => `nosotros nos llevamos ${s}`, match_yours: "¡Partida tuya!", match_theirs: (n) => `${n} ganó.`,
  };
  const UI_I18N = {
    "es-AR": RIVER, "es-UY": RIVER, "es-PY": RIVER,
    "pt-BR": {
      raise_them: "SUBIR É COM ELES", at_max: "NO MÁXIMO", their_turn: "NA VEZ DELES", opponent_turn: "VEZ DO ADVERSÁRIO",
      turn_parca: "VEZ DO PARÇA", turn_eles1: "VEZ DELES (1)", turn_eles2: "VEZ DELES (2)",
      truco: "TRUCO!",
      title_ours: "Quem pediu não aumenta: a vez de subir é deles.", title_not_yours: "Só pede quem está na vez de jogar.",
      title_waiting_online: "Aguardando jogada do adversário online.",
      title_waiting_parca: "Aguardando jogada do seu parça.", title_waiting_eles1: "Aguardando jogada do Adversário 1.", title_waiting_eles2: "Aguardando jogada do Adversário 2.",
      title_raise: "Aumentar a aposta desta mão",
      ceiling: "doze é o teto", raise_to: (c) => `sobe pra ${c}`, they_take: (s) => `eles levam ${s}`, we_take: (s) => `nós levamos ${s}`, match_yours: "Partida sua!", match_theirs: (n) => `${n} levou.`,
    },
    "ca-ES": {
      raise_them: "PUJAR ÉS COSA SEVA", at_max: "AL MÀXIM", their_turn: "ÉS EL SEU TORN", opponent_turn: "TORN DEL RIVAL",
      turn_parca: "TORN DEL COMPANY", turn_eles1: "TORN DEL RIVAL (1)", turn_eles2: "TORN DEL RIVAL (2)",
      truco: "TRUC!",
      title_ours: "Qui ha cantat no puja: els toca a ells pujar.", title_not_yours: "Només canta qui té el torn.",
      title_waiting_online: "Esperant la jugada del rival en línia.",
      title_waiting_parca: "Esperant la jugada del teu company.", title_waiting_eles1: "Esperant la jugada del Rival 1.", title_waiting_eles2: "Esperant la jugada del Rival 2.",
      title_raise: "Pujar l'aposta d'aquesta mà",
      ceiling: "dotze és el sostre", raise_to: (c) => `puja a ${c}`, they_take: (s) => `ells s'enduen ${s}`, we_take: (s) => `nosaltres ens enduem ${s}`, match_yours: "Partida teva!", match_theirs: (n) => `${n} ha guanyat.`,
    },
  };
  const VOICE_OF = { paulista: "sp", mineiro: "mg", douradinha: "mg", douradao: "mg", gaucho: "rs", argentino: "ar", uruguayo: "uy", paraguayo: "py", truc: "ca" };
  const VOICE = {
    sp: {
      ladder: { 3: "Truco!", 6: "Seis!", 9: "Nove!", 12: "Doze!" }, ran: "CORRI", we_won: "É NOSSA!", they_won: "LEVAMOS!",
      calls: { nezinho: "Truco, meu filho. Vale {worth}.", cida: "Truco, meu bem! Vale {worth}.", tiao: "Truuuco, seu moço! Vale {worth}.", ze: "Truco. Vale {worth}.", xiru: "Truco, vivente! Vale {worth}.", osvaldo: "¡Truco, carajo! Vale {worth}.", tiao_queijo: "Truco, uai! Vale {worth}.", tabare: "¡Truco, bo! Vale {worth}.", jordi: "Truc, noi! Val {worth}.", bigode: "Truco! Vale {worth}." },
      closing: { nezinho: { lost: "Tá com a mão boa, hein. Outra?", won: "Devagar se vai longe, menino." }, cida: { lost: "Ai, meu bem. Hoje foi seu.", won: "Vem cá que a tia te ensina de novo." }, tiao: { lost: "Eita! Levou, seu moço.", won: "Ó a viola! Doze pra nós." }, ze: { lost: "Zé só balança a cabeça.", won: "Zé guarda as cartas sem dizer nada." }, xiru: { lost: "Bah, tu tá com a mão tri boa, vivente. Mais uma?", won: "Te apruma, vivente! Doze pra nós, tchê!" }, osvaldo: { lost: "¡Buena mano tuviste, carajo! ¿Otra?", won: "¡El truco se juega con coraje! Doce para nosotros." }, tiao_queijo: { lost: "Trem bão, cê jogou bem demais, sô! Mais uma?", won: "Mineiro come quieto, uai! Levamos essa!" }, tabare: { lost: "¡Buena mano tuviste, bo! ¿Otra vuelta?", won: "¡Garra y corazón, bo! Doce para nosotros." }, jordi: { lost: "Bona mà has tingut, noi. Una altra?", won: "Val més maña que força, noi! Dotze per a nosaltres." } },
    },
    mg: {
      ladder: { 4: "Truco!", 8: "Seis!", 10: "Nove!", 12: "Doze!" }, ran: "CORRI, SÔ", we_won: "É NÓIS, SÔ!", they_won: "LEVAMO, UAI!",
      calls: { nezinho: "Truco, meu fio! Vale {worth}, uai.", cida: "Truco, meu bem! Cê guenta? Vale {worth}.", tiao: "Truuuco, sô! Vale {worth}.", ze: "Truco. Vale {worth}.", tiao_queijo: "Truco, uai! Vale {worth}, sô.", xiru: "Truco, vivente! Vale {worth}.", osvaldo: "¡Truco, carajo! Vale {worth}.", tabare: "¡Truco, bo! Vale {worth}.", jordi: "Truc, noi! Val {worth}.", bigode: "Truco, uai! Vale {worth}." },
      closing: { nezinho: { lost: "Uai, cê tá com a mão boa, sô. Mais uma?", won: "Devagar se vai longe, meu fio." }, cida: { lost: "Ô trem bão! Hoje foi seu, meu bem.", won: "Vem cá que a tia te ensina de novo, uai." }, tiao: { lost: "Nó! Levou, cumpadi.", won: "Ó a viola! Doze pra nóis, sô." }, ze: { lost: "Zé só balança a cabeça.", won: "Zé guarda as carta calado." }, tiao_queijo: { lost: "Trem bão, cê jogou bem demais, sô! Mais uma?", won: "Mineiro come quieto, uai! Levamos essa!" }, xiru: { lost: "Bah, tu tá com a mão tri boa, vivente. Mais uma?", won: "Te apruma, vivente! Doze pra nós, tchê!" }, osvaldo: { lost: "¡Buena mano tuviste, carajo! ¿Otra?", won: "¡El truco se juega con coraje! Doce para nosotros." }, tabare: { lost: "¡Buena mano tuviste, bo! ¿Otra vuelta?", won: "¡Garra y corazón, bo! Doce para nosotros." }, jordi: { lost: "Bona mà has tingut, noi. Una altra?", won: "Val més maña que força, noi! Dotze per a nosaltres." } },
    },
    rs: {
      ladder: { 2: "Truco!", 3: "Retruco!", 4: "Vale quatro!" }, ran: "CORRI, TCHÊ", we_won: "É NOSSA, TCHÊ!", they_won: "LEVAMOS, BAH!",
      calls: { nezinho: "Truco, tchê! Vale {worth}.", cida: "Truco, meu guri! Vale {worth}.", tiao: "Truuuco, bagual! Vale {worth}.", ze: "Truco. Vale {worth}.", xiru: "Truco, vivente! Vale {worth}.", osvaldo: "¡Truco, che! Vale {worth}.", tiao_queijo: "Truco, uai! Vale {worth}.", tabare: "¡Truco, bo! Vale {worth}.", jordi: "Truc, noi! Val {worth}.", bigode: "Truco, tchê! Vale {worth}." },
      closing: { nezinho: { lost: "Bah, tu tá com a mão tri boa, tchê. Mais uma?", won: "Devagar se vai ao longe, guri." }, cida: { lost: "Ai, meu guri, hoje foi teu.", won: "Vem cá que a tia te ensina de novo, tchê." }, tiao: { lost: "Barbaridade! Levaste, parceiro.", won: "Doze pra nós, tchê! Bah!" }, ze: { lost: "Zé solo mueve la cabeza.", won: "Zé guarda las cartas sin decir nada." }, xiru: { lost: "Mas bah, tu tá com a mão tri boa, vivente. Mais uma?", won: "Te apruma, vivente! Ganhamos nós, tchê!" }, osvaldo: { lost: "¡Buena mano tuviste, carajo! ¿Otra?", won: "¡El truco se juega con coraje! Doce para nosotros." }, tiao_queijo: { lost: "Trem bão, cê jogou bem demais, sô! Mais uma?", won: "Mineiro come quieto, uai! Levamos essa!" }, tabare: { lost: "¡Buena mano tuviste, bo! ¿Otra vuelta?", won: "¡Garra y corazón, bo! Doce para nosotros." }, jordi: { lost: "Bona mà has tingut, noi. Una altra?", won: "Val més maña que força, noi! Dotze per a nosaltres." } },
    },
    ar: {
      ladder: { 2: "¡Truco!", 3: "¡Retruco!", 4: "¡Vale cuatro!" }, ran: "ME VOY", we_won: "¡ES NUESTRA!", they_won: "¡NOS LO LLEVAMOS!",
      calls: { nezinho: "¡Truco, che! Vale {worth}.", cida: "¡Truco, mi bien! Vale {worth}.", tiao: "¡Truuuco, señor! Vale {worth}.", ze: "Truco. Vale {worth}.", osvaldo: "¡Truco, carajo! Vale {worth}.", xiru: "Truco, vivente! Vale {worth}.", tiao_queijo: "Truco, uai! Vale {worth}.", tabare: "¡Truco, bo! Vale {worth}.", jordi: "Truc, noi! Val {worth}.", bigode: "¡Truco! Vale {worth}." },
      closing: { nezinho: { lost: "Buena mano tuviste, che, ¿otra?", won: "Despacio se llega lejos, che." }, cida: { lost: "Ay cariño, hoy fue tuya.", won: "Vení que la tía te enseña de nuevo." }, tiao: { lost: "¡Apa! Ganaste, amigo.", won: "¡A cantar! Doce para nosotros." }, ze: { lost: "Zé solo mueve la cabeza.", won: "Zé guarda las cartas sin decir nada." }, osvaldo: { lost: "¡Buena mano tuviste, carajo! ¿Otra?", won: "¡El truco se juega con coraje! Nos lo llevamos nosotros." }, xiru: { lost: "Bah, tu tá com a mão tri boa, vivente. Mais uma?", won: "Te apruma, vivente! Ganhamos nós, tchê!" }, tiao_queijo: { lost: "Trem bão, cê jogou bem demais, sô! Mais uma?", won: "Mineiro come quieto, uai! Levamos essa!" }, tabare: { lost: "¡Buena mano tuviste, bo! ¿Otra vuelta?", won: "¡Garra y corazón, bo! Doce para nosotros." }, jordi: { lost: "Bona mà has tingut, noi. Una altra?", won: "Val més maña que força, noi! Dotze per a nosaltres." } },
    },
    uy: {
      ladder: { 2: "¡Truco!", 3: "¡Retruco!", 4: "¡Vale cuatro!" }, ran: "ME VOY", we_won: "¡ES NUESTRA!", they_won: "¡NOS LO LLEVAMOS!",
      calls: { nezinho: "¡Truco, bo! Vale {worth}.", cida: "¡Truco, mi bien! Vale {worth}.", tiao: "¡Truuuco, ta! Vale {worth}.", ze: "Truco. Vale {worth}.", tabare: "¡Truco, bo! Vale {worth}.", osvaldo: "¡Truco, carajo! Vale {worth}.", xiru: "Truco, vivente! Vale {worth}.", tiao_queijo: "Truco, uai! Vale {worth}.", jordi: "Truc, noi! Val {worth}.", bigode: "¡Truco! Vale {worth}." },
      closing: { nezinho: { lost: "Buena mano tuviste, bo, ¿otra?", won: "Despacio se llega lejos, bo." }, cida: { lost: "Ay cariño, hoy fue tuya.", won: "Vení que la tía te enseña de nuevo." }, tiao: { lost: "¡Ta, ganaste, amigo!", won: "¡A cantar! Doce para nosotros." }, ze: { lost: "Zé solo mueve la cabeza.", won: "Zé guarda las cartas sin decir nada." }, tabare: { lost: "¡Buena mano tuviste, bo! ¿Otra vuelta?", won: "¡Garra y corazón, bo! Nos la llevamos nosotros." }, osvaldo: { lost: "¡Buena mano tuviste, carajo! ¿Otra?", won: "¡El truco se juega con coraje! Nos lo llevamos nosotros." }, xiru: { lost: "Bah, tu tá com a mão tri boa, vivente. Mais uma?", won: "Te apruma, vivente! Ganhamos nós, tchê!" }, tiao_queijo: { lost: "Trem bão, cê jogou bem demais, sô! Mais uma?", won: "Mineiro come quieto, uai! Levamos essa!" }, jordi: { lost: "Bona mà has tingut, noi. Una altra?", won: "Val més maña que força, noi! Dotze per a nosaltres." } },
    },
    py: {
      ladder: { 2: "¡Truco!", 3: "¡Retruco!", 4: "¡Vale cuatro!" }, ran: "ME VOY", we_won: "¡ES NUESTRA!", they_won: "¡NOS LO LLEVAMOS!",
      calls: { nezinho: "¡Truco, voi'! Vale {worth}.", cida: "¡Truco, mi bien! Vale {worth}.", tiao: "¡Truuuco, voi'! Vale {worth}.", ze: "Truco. Vale {worth}.", osvaldo: "¡Truco, carajo! Vale {worth}.", tabare: "¡Truco, bo! Vale {worth}.", xiru: "Truco, vivente! Vale {worth}.", tiao_queijo: "Truco, uai! Vale {worth}.", jordi: "Truc, noi! Val {worth}.", bigode: "¡Truco! Vale {worth}." },
      closing: { nezinho: { lost: "Buena mano tuviste voi', ¿otra?", won: "Despacio se llega lejos voi'." }, cida: { lost: "Ay cariño, hoy fue tuya.", won: "Vení que la tía te enseña de nuevo." }, tiao: { lost: "¡Apa! Ganaste voi', amigo.", won: "¡A cantar! Doce para nosotros." }, ze: { lost: "Zé solo mueve la cabeza.", won: "Zé guarda las cartas sin decir nada." }, osvaldo: { lost: "¡Buena mano tuviste, carajo! ¿Otra?", won: "¡El truco se juega con coraje! Nos lo llevamos nosotros." }, tabare: { lost: "¡Buena mano tuviste, bo! ¿Otra vuelta?", won: "¡Garra y corazón, bo! Doce para nosotros." }, xiru: { lost: "Bah, tu tá com a mão tri boa, vivente. Mais uma?", won: "Te apruma, vivente! Ganhamos nós, tchê!" }, tiao_queijo: { lost: "Trem bão, cê jogou bem demais, sô! Mais uma?", won: "Mineiro come quieto, uai! Levamos essa!" }, jordi: { lost: "Bona mà has tingut, noi. Una altra?", won: "Val més maña que força, noi! Dotze per a nosaltres." } },
    },
    ca: {
      ladder: { 2: "Truc!", 3: "Retruc!" }, ran: "ME'N VAIG", we_won: "ÉS NOSTRA!", they_won: "ENS L'ENDUEM!",
      calls: { nezinho: "Truc, noi! Val {worth}.", cida: "Truc, rei meu! Val {worth}.", tiao: "Truuuc, senyor! Val {worth}.", ze: "Truc. Val {worth}.", jordi: "Truc, noi! Val {worth}.", xiru: "Truco, vivente! Vale {worth}.", osvaldo: "¡Truco, carajo! Vale {worth}.", tiao_queijo: "Truco, uai! Vale {worth}.", tabare: "¡Truco, bo! Vale {worth}.", bigode: "Truc! Val {worth}." },
      closing: { nezinho: { lost: "Bona mà has tingut, noi. Una altra?", won: "A poc a poc s'arriba lluny, noi." }, cida: { lost: "Ai, rei meu, avui ha estat teva.", won: "Vine, que la tieta t'ho torna a ensenyar." }, tiao: { lost: "Ep! Has guanyat, amic.", won: "A cantar! Dotze per a nosaltres." }, ze: { lost: "En Zé només fa que sí amb el cap.", won: "En Zé desa les cartes sense dir res." }, jordi: { lost: "Bona mà has tingut, noi. Una altra partida?", won: "Val més maña que força, noi! Dotze per a nosaltres." }, xiru: { lost: "Bah, tu tá com a mão tri boa, vivente. Mais uma?", won: "Te apruma, vivente! Ganhamos nós, tchê!" }, osvaldo: { lost: "¡Buena mano tuviste, carajo! ¿Otra?", won: "¡El truco se juega con coraje! Nos lo llevamos nosotros." }, tiao_queijo: { lost: "Trem bão, cê jogou bem demais, sô! Mais uma?", won: "Mineiro come quieto, uai! Levamos essa!" }, tabare: { lost: "¡Buena mano tuviste, bo! ¿Otra vuelta?", won: "¡Garra y corazón, bo! Doce para nosotros." } },
    },
  };
  const voice = () => {
    const v = VOICE[VOICE_OF[st.variant]];
    if (v === undefined) throw new Error(`no voice for variant ${st.variant}`);
    return v;
  };

  const bound = (v, fallback) => (!v || v.includes("{") ? fallback : v);
  const currentVariant = () => bound($(".matchbox")?.dataset.variant, st.variant);

  const sayOf = (key, box, worth) => {
    if (!key) return "";
    const cat = messages ?? {};
    const loc = screen.dataset.locale || "pt-BR";
    const spoken = key.startsWith("call_") ? voice().calls[key.slice("call_".length)] : undefined;
    const said = spoken ?? (cat[loc] ?? cat["pt-BR"] ?? {})[key] ?? (cat["pt-BR"] ?? {})[key] ?? key;
    const turnSeat = box?.dataset.turnSeat ?? "";
    return said
      .replace("{name}", turnSeat === "parca" ? (box?.dataset.partnerName ?? "") : ($(".eles-name")?.textContent ?? ""))
      .replace("{worth}", worth);
  };
  const baseStake = (variant) => LADDER[variant][0];
  const rungWords = () => voice().ladder;

  const nextRung = (variant, stake) => {
    const l = LADDER[variant];
    if (l === undefined) throw new Error(`no ladder for variant ${variant}`);
    const i = l.indexOf(Number(stake));
    return i >= 0 && i < l.length - 1 ? l[i + 1] : null;
  };

  const st = (globalThis.__truco ??= {
    matchId: "", roundId: "", order: [], mao: "you",
    variant: DEFAULT_VARIANT, opponent: "nezinho", partner: "bigode",
    seats: "1v1", theme: "xadrez", hand: 1,
    stake: baseStake(DEFAULT_VARIANT),
    lastShoutSaid: "",
  });

  let updateSeatPerspective = () => {};

  const alive = () => !signal.aborted && screen.isConnected;
  const validateVariantForSeats = (v, s) => {
    if (s !== "2v2v2" && (v === "douradinha" || v === "douradao")) {
      throw new Error(`Variant "${v}" is only supported in "2v2v2" seats mode`);
    }
    return v;
  };
  const SEATS = {
    "1v1": ["you", "eles1"],
    "2v2": ["you", "eles1", "parca", "eles2"],
    "2v2v2": ["you", "eles1", "eles2", "parca", "eles3", "eles4"],
  };
  const seatsOf = (mode = "1v1") => {
    const s = SEATS[mode];
    if (!s) throw new Error(`Unknown seats mode "${mode}"`);
    return s;
  };
  const currentOnlineSeats = (box = $(".matchbox")) => {
    if (!box || box.dataset.opponent !== "online") return "1v1";
    const rawSeats = box.dataset.seats;
    if (!rawSeats || rawSeats.includes("{")) return "1v1";
    if (!SEATS[rawSeats]) throw new Error(`Unknown online seats mode "${rawSeats}"`);
    return rawSeats;
  };
  const seatsFor = (seat, current = "1v1") => {
    if (!SEATS[current]) throw new Error(`Unknown seats mode "${current}" in seatsFor`);
    return current === "2v2v2" ? "2v2v2" : (seat === "parca" || seat === "eles2" ? "2v2" : current);
  };
  const hand = () => screen.querySelector(".hand[data-round-id]");
  const attrOf = (name) => hand()?.getAttribute(name) ?? "";
  let cachedMySeat = null;
  const getMySeat = () => {
    if (cachedMySeat) return cachedMySeat;
    const box = $(".matchbox");
    if (box && box.dataset.opponent && !box.dataset.opponent.includes("{") && box.dataset.opponent !== "online") {
      const seat = (box.dataset.mySeat && !box.dataset.mySeat.includes("{")) ? box.dataset.mySeat : "you";
      if (!["you", "eles1"].includes(seat)) throw new Error(`Invalid bot seat "${seat}"`);
      return seat;
    }
    if (typeof location !== "undefined" && location.search) {
      const sp = new URLSearchParams(location.search);
      const qOpp = sp.get("opponent");
      const qSeat = sp.get("seat");
      if (qOpp === "online" && qSeat) {
        if (!["you", "eles1", "parca", "eles2"].includes(qSeat)) {
          throw new Error(`Unknown seat "${qSeat}" in URL`);
        }
        if (sessionStorage.getItem("truco-seat") !== qSeat) {
          sessionStorage.setItem("truco-seat", qSeat);
        }
        return qSeat;
      }
    }
    if (box?.dataset.mySeat && !box.dataset.mySeat.includes("{")) {
      const seat = box.dataset.mySeat;
      if (!["you", "eles1", "parca", "eles2"].includes(seat)) {
        throw new Error(`Unknown seat "${seat}" in box dataset`);
      }
      return seat;
    }
    const sSeat = sessionStorage.getItem("truco-seat");
    if (sSeat) {
      if (!["you", "eles1", "parca", "eles2"].includes(sSeat)) {
        throw new Error(`Unknown seat "${sSeat}" in sessionStorage`);
      }
      return sSeat;
    }
    return "you";
  };
  const displaySeatOf = (seat, order = seatsOf($(".matchbox")?.dataset.seats && !$(".matchbox").dataset.seats.includes("{") ? $(".matchbox").dataset.seats : "1v1"), mySeat = getMySeat()) => {
    if (!seat) return "";
    const fromIdx = order.indexOf(seat);
    const myIdx = order.indexOf(mySeat);
    if (fromIdx === -1) throw new Error(`Unknown seat "${seat}" for seats mode`);
    if (myIdx === -1) throw new Error(`Unknown mySeat "${mySeat}" for seats mode`);
    return order[(fromIdx - myIdx + order.length) % order.length];
  };

  /* --- rendering --------------------------------------------------------- */

  const phase = (p) => { const el = $(".play"); if (el) el.dataset.phase = p; };

  // Where the card was when you let go of it. The copy that appears on the mat
  // is a different element, so without this a play reads as a teleport: the
  // hand card disappears and a mat card blinks into existence somewhere else.
  let flightFrom = null;
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // A card leaves the hand at the angle it was fanned to. Carrying that angle
  // into the flight is what makes it read as a card thrown onto the cloth
  // rather than a tile sliding across it.
  const tiltOf = (el) => {
    const sibs = [...(el.parentElement?.children ?? [])];
    const i = sibs.indexOf(el);
    if (sibs.length < 2) return 0;
    return i === 0 ? -5 : i === sibs.length - 1 ? 5 : 0;
  };

  const flyFrom = (el) => {
    flightFrom = still() ? null : Object.assign(el.getBoundingClientRect().toJSON(), { tilt: tiltOf(el) });
  };

  const calculateFlight = (from, to, lie) => {
    if (!to?.width || !from?.width) return [];
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    const scale = from.width / to.width;
    const start = (from.tilt ?? 0) - (lie ?? 0);
    const over = start >= 0 ? -6 : 6;
    const y0 = from.turn ? " rotateY(90deg)" : "";
    const y1 = from.turn ? " rotateY(25deg)" : "";
    return [
      { transform: `translate3d(${dx}px, ${dy}px, 0px) rotate(${start}deg) scale(${scale})${y0}`, offset: 0 },
      {
        transform: `translate3d(${dx * 0.42}px, ${dy * 0.42}px, 32px) rotate(${over}deg) scale(${(scale + 1) / 2})${y1}`,
        offset: 0.65,
      },
      { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1) rotateY(0deg)", offset: 1 },
    ];
  };

  const takeFlight = (el, from) => {
    flightFrom = null;
    if (!el || el.dataset.flying || el.dataset.landed || still()) return;
    el.dataset.flying = "1";
    const to = el.getBoundingClientRect();
    const lie = parseFloat(el.closest(".played")?.style.getPropertyValue("--lie") ?? "0") || 0;
    const keyframes = calculateFlight(from, to, lie);
    if (keyframes.length === 0) {
      delete el.dataset.flying;
      return;
    }
    const anim = animate(el, keyframes, { duration: 460, easing: "cubic-bezier(.2,.86,.28,1)" });
    const finish = () => {
      delete el.dataset.flying;
      el.dataset.landed = "1";
    };
    listen(anim, "finish", finish, { once: true });
    listen(anim, "cancel", finish, { once: true });
  };

  let handCardRects = new Map();
  const getCardKey = (c) => c.dataset.row || (c.dataset.seat ? `${c.dataset.seat}-${c.dataset.slot}` : c.dataset.card);

  const recordHandRects = () => {
    if (still()) return;
    handCardRects.clear();
    for (const c of screen.querySelectorAll("#seat-you .card, .seat-row.house .card-back")) {
      const id = getCardKey(c);
      if (id) {
        handCardRects.set(id, c.getBoundingClientRect());
      }
    }
  };

  let prevMineCount = 0;
  let prevHouseCount = 0;

  const animateRemainingHand = () => {
    if (still()) return;
    const isDealing = attrOf("data-phase") === "dealt" && !screen.querySelector(".matcards .played");
    const mineCards = screen.querySelectorAll("#seat-you .card");
    const houseCards = screen.querySelectorAll(".seat-row.house .card-back");
    const curMineCount = mineCards.length;
    const curHouseCount = houseCards.length;

    if (isDealing || curMineCount === 0) {
      handCardRects.clear();
      prevMineCount = curMineCount;
      prevHouseCount = curHouseCount;
      return;
    }

    const mineLostCard = prevMineCount > 0 && curMineCount < prevMineCount;
    const houseLostCard = prevHouseCount > 0 && curHouseCount < prevHouseCount;

    if ((mineLostCard || houseLostCard) && handCardRects.size > 0) {
      const cardsToAnimate = mineLostCard && houseLostCard
        ? [...mineCards, ...houseCards]
        : mineLostCard ? [...mineCards] : [...houseCards];

      for (const c of cardsToAnimate) {
        if (c.getAnimations().some((a) => a.animationName === "deal" || a.animationName === "deal-house")) continue;
        const id = getCardKey(c);
        if (id && handCardRects.has(id)) {
          const prev = handCardRects.get(id);
          const next = c.getBoundingClientRect();
          const dx = prev.left - next.left;
          const dy = prev.top - next.top;
          if ((Math.abs(dx) > 1 || Math.abs(dy) > 1) && typeof c.animate === "function") {
            animate(c, [
              { transform: `translate3d(${dx}px, ${dy}px, 0px)` },
              { transform: "translate3d(0, 0, 0)" },
            ], {
              duration: 360,
              delay: c.closest("#seat-you") ? 70 : 40,
              easing: "cubic-bezier(.2, .86, .28, 1)",
              fill: "none",
            });
          }
        }
      }
    }

    prevMineCount = curMineCount;
    prevHouseCount = curHouseCount;

    handCardRects.clear();
    for (const c of [...mineCards, ...houseCards]) {
      const id = getCardKey(c);
      if (id) {
        handCardRects.set(id, c.getBoundingClientRect());
      }
    }
  };

  const wireHand = () => {
    const mine = $("#seat-you");
    if (!mine || mine.dataset.flightWired) return;
    mark(mine, "flightWired");
    const capture = (e) => {
      const el = e.target.closest(".card");
      if (el !== null && !el.disabled) {
        recordHandRects();
        flyFrom(el);
      }
    };
    listen(mine, "pointerdown", capture, { capture: true });
    listen(mine, "click", capture, { capture: true });
  };

  const wireFlight = () => {
    if (screen.dataset.flight) return;
    mark(screen, "flight");
    listen(screen, "animationend", (e) => {
      if (e.animationName === "deal" || e.animationName === "deal-house") {
        e.target.dataset.dealt = "1";
      }
    });

    const onCardArrived = (cardEl) => {
      if (!cardEl || cardEl.dataset.flying || cardEl.dataset.landed || still()) return;
      const played = cardEl.closest(".played");
      if (!played) return;
      const seat = played.dataset.seat ?? "";
      const isMySeat = seat === getMySeat();

      if (isMySeat) {
        const fromSlot = played.dataset.fromSlot;
        const myHandCard = (fromSlot !== undefined && fromSlot !== "")
          ? screen.querySelector(`#seat-you .card[data-slot="${fromSlot}"]`)
          : screen.querySelector("#seat-you .card");
        const handBox = screen.querySelector("#seat-you")?.getBoundingClientRect();
        const origin = flightFrom
          ?? (myHandCard ? Object.assign(myHandCard.getBoundingClientRect().toJSON(), { tilt: tiltOf(myHandCard) }) : null)
          ?? (handBox ? Object.assign(handBox.toJSON(), { tilt: 0 }) : null);
        if (origin) {
          takeFlight(cardEl, Object.assign({}, origin, { turn: false }));
        }
        return;
      }

      const fromSlot = played.dataset.fromSlot;
      const row = (seat !== "" ? screen.querySelector(`.seat-row.house[data-seat="${seat}"]`) : null)
        ?? screen.querySelector(".seat-row.house");
      const back = (fromSlot !== undefined && fromSlot !== ""
        ? row?.querySelector(`.card-back[data-slot="${fromSlot}"]`)
        : null)
        ?? row?.querySelector(`.card-back[data-seat="${seat}"]`)
        ?? row?.querySelector(".card-back[data-exit]")
        ?? row?.querySelector(".card-back:last-child");
      const houseBox = row?.getBoundingClientRect();
      const origin = back ? Object.assign(back.getBoundingClientRect().toJSON(), { tilt: 0, turn: true })
        : (houseBox ? Object.assign(houseBox.toJSON(), { tilt: 0, turn: true }) : null);
      if (origin) takeFlight(cardEl, origin);
    };

    listen(screen, "animationstart", (e) => {
      if (e.animationName !== "land" || still()) return;
      onCardArrived(e.target);
    });

    const matwrap = screen.querySelector(".matwrap");
    if (matwrap) {
      observe((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              if (node.classList?.contains("played")) {
                const card = node.querySelector(".card");
                if (card) onCardArrived(card);
              } else if (node.querySelectorAll) {
                for (const c of node.querySelectorAll(".played .card")) onCardArrived(c);
              }
            }
          }
        }
      }).observe(matwrap, { childList: true, subtree: true });
    }
  };

  const clearOnlineSession = () => {
    sessionStorage.removeItem("truco-seat");
    sessionStorage.removeItem("truco-opponent-name");
    sessionStorage.removeItem("truco-room-seed");
    if (location.search.includes("opponent=online") || location.search.includes("seed=")) {
      history.replaceState(null, "", location.pathname);
    }
  };

  const wireTable = () => {
    if (screen.dataset.table) return;
    mark(screen, "table");
    const trucoBtn = $("#btn-truco");
    if (trucoBtn) trucoBtn.removeAttribute("data-text");
    let rendering = false;
    const again = () => {
      if (rendering) return;
      rendering = true;
      try {
        render();
      } finally {
        rendering = false;
      }
    };
    // childList as well as attributes: an item's bindings are resolved before
    // the node is put in the tree, so a hand arriving for the first time is an
    // insertion and nothing else. Everything below writes only where it
    // differs, because this fires on what it writes.
    observe(again).observe(screen, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "data-v1", "data-v2", "data-v3", "data-result", "data-asked", "data-rung",
        "data-said", "data-phase", "data-leader",
        "data-shout-word", "data-shout-from", "data-shout-state", "data-shout-kind", "data-shout-seat", "data-shout-t",
        "data-raised", "data-status", "data-hand", "data-stake", "data-variant",
        "data-envido", "data-envido-asked", "data-calls",
        "data-match-id", "data-opponent", "data-round-id", "data-turn-seat", "data-theme",
      ],
    });
    // Watched where the cards are and nowhere wider: the ladder button carries
    // `disabled` too, and redrawing it is what this fires on — a screen-wide
    // watch on that attribute is a loop with a render in it.
    const mine = $("#seat-you");
    if (mine) observe(again).observe(mine, { subtree: true, attributes: true, attributeFilter: ["disabled", "data-exit"] });

    for (const id of ["btn-resign", "btn-again"]) listen($(`#${id}`), "click", clearOnlineSession);
    for (const el of screen.querySelectorAll('[data-picker="variant"] [data-opt], [data-picker="seats"] [data-opt], [data-picker="opponent"] [data-opt], [data-picker="country"] a[data-locale]')) {
      listen(el, "click", clearOnlineSession);
    }
    listen($("#btn-modal-resign"), "click", () => {
      clearOnlineSession();
      $("#btn-resign")?.click();
      $("#modal-online")?.hidePopover?.();
    });
    for (const id of ["btn-next", "btn-again", "btn-start"]) {
      listen($(`#${id}`), "click", () => hush());
    }
  };

  const setText = (el, text) => { if (el !== null && el.textContent !== text) el.textContent = text; };

  let shoutTimer;
  let shoutStart = 0;
  const MIN_SHOUT_MS = 1400;
  const shout = (word, side, kind = "call") => {
    const el = $(".shout");
    if (!el || word === "") return;
    el.textContent = word;
    el.dataset.from = side;
    el.dataset.kind = kind;
    el.dataset.state = "live";
    shoutStart = Date.now();
    clearTimeout(shoutTimer);
    if (kind === "run" || kind === "quick") shoutTimer = setTimeout(() => hush(kind), 1800);
  };
  const hush = (kind, immediate = false) => {
    const el = $(".shout");
    if (!el || el.dataset.state !== "live") return;
    if (kind !== undefined && el.dataset.kind !== kind) return;
    const elapsed = Date.now() - shoutStart;
    const remaining = immediate ? 0 : Math.max(0, MIN_SHOUT_MS - elapsed);
    clearTimeout(shoutTimer);
    if (remaining > 0) {
      shoutTimer = setTimeout(() => {
        if (el && el.dataset.state === "live" && (kind === undefined || el.dataset.kind === kind)) {
          el.dataset.state = "gone";
        }
      }, remaining);
    } else {
      el.dataset.state = "gone";
    }
  };

  // A country picked is a game picked. The pick is a link, so the page it
  // lands on makes the switch, once, through the variant picker's own option
  // — which carries the picker's guard and its reset — and only when the
  // table is not already one that country plays; a finished match is dealt
  // again under it, as any rule picked on one is. Loading a country's address
  // cold, or reloading it, leaves the table's variant alone.
  //
  // Which variants a country plays is the menu's own tagging (each option's
  // li[data-group]), so a variant filed under a country is one picking that
  // country keeps. DEALS names what the country deals otherwise: Brazil's is
  // mineiro, the table the app opens on.
  const GROUP = { "pt-BR": "br", "es-AR": "ar", "es-UY": "uy", "es-PY": "py", "ca-ES": "es" };
  const DEALS = { "pt-BR": "mineiro", "es-AR": "argentino", "es-UY": "uruguayo", "es-PY": "paraguayo", "ca-ES": "truc" };
  for (const a of screen.querySelectorAll('[data-picker="country"] a[data-locale]')) {
    listen(a, "click", () => {
      try { sessionStorage.setItem("truco:country", a.dataset.locale ?? ""); } catch { /* no session: no follow */ }
    });
  }
  const followCountry = (box) => {
    let picked = null;
    try { picked = sessionStorage.getItem("truco:country"); } catch { return; }
    if (picked === null || picked !== screen.dataset.locale) return;
    // Seated first: the picker refuses a pick before the first match lands,
    // and the match id reads its own "{id}" placeholder until it does.
    if (!/^m[0-9a-z]+$/.test(box.dataset.matchId ?? "")) return;
    try { sessionStorage.removeItem("truco:country"); } catch { /* read once either way */ }
    const plays = [...screen.querySelectorAll(`[data-picker="variant"] li[data-group="${GROUP[picked]}"] [data-opt]`)]
      .map((b) => b.dataset.opt);
    if (plays.includes(box.dataset.variant)) return;
    document.getElementById(`variant-trigger-${DEALS[picked]}`)?.click();
  };

  const render = () => {
    cachedMySeat = getMySeat();
    try {
      const box = $(".matchbox");
      if (!box) return;
    followCountry(box);
    if (box.dataset.variant && !box.dataset.variant.includes("{")) {
      st.variant = box.dataset.variant;
    }
    const v = (box.dataset.variant && !box.dataset.variant.includes("{")) ? box.dataset.variant : "paulista";
    const opp = (box.dataset.opponent && !box.dataset.opponent.includes("{")) ? box.dataset.opponent : "nezinho";
    const th = (box.dataset.theme && !box.dataset.theme.includes("{")) ? box.dataset.theme : "xadrez";
    if (screen.dataset.variant !== v) screen.dataset.variant = v;
    if (screen.dataset.opponent !== opp) screen.dataset.opponent = opp;
    if (screen.dataset.theme !== th) screen.dataset.theme = th;

    const tavernEl = $(".tavern-name");
    if (tavernEl) {
      const cat = messages ?? {};
      const curLoc = screen.dataset.locale || "pt-BR";
      const msgs = cat[curLoc] ?? cat["pt-BR"] ?? {};
      const tavernKey = `tavern_${v === "douradinha" || v === "douradao" ? "mineiro" : (v === "paraguayo" ? "argentino" : v)}`;
      const title = msgs[tavernKey] ?? msgs.tavern_title ?? "Boteco do Seu Nezinho · Mesa 1";
      setText(tavernEl, title);
    }

    const oppImg = $(".opponent-avatar-img");
    if (oppImg) {
      const botKey = opp === "online" ? "bigode" : opp;
      oppImg.style.backgroundImage = `url("/shell/assets/${botKey}.png")`;
    }
    const curRound = attrOf("data-round-id");
    if (curRound && !curRound.includes("{")) {
      if (st.lastRoundId !== curRound) {
        st.lastRoundId = curRound;
        st.ran = "";
        st.shoutedRanRoundId = "";
        hush(undefined, true);
      }
    }
    const loc = screen.dataset.locale || (typeof location !== "undefined" ? new URLSearchParams(location.search).get("lang") : null) || "pt-BR";
    const ui = UI_I18N[loc] ?? UI_I18N["pt-BR"];
    updateSeatPerspective();
    const rung = Number(attrOf("data-rung"));
    const asked = attrOf("data-asked");
    const yours = screen.querySelector(".seat-row.mine .card:not([disabled]):not([data-exit])") !== null;
    const ours = attrOf("data-raised") === "us";
    const worth = asked !== "" ? (attrOf("data-rung") || attrOf("data-stake")) : attrOf("data-stake");

    const isOnline = box?.dataset.opponent === "online";
    if (isOnline && typeof location !== "undefined" && typeof history !== "undefined" && location.search && box.dataset.variant && !box.dataset.variant.includes("{")) {
      const sp = new URLSearchParams(location.search);
      const urlVariant = sp.get("variant");
      const urlSeed = sp.get("seed");
      if (urlSeed === box.dataset.seed && urlVariant && urlVariant !== box.dataset.variant) {
        sp.set("variant", box.dataset.variant);
        history.replaceState(null, "", `${location.pathname}?${sp.toString()}`);
      }
    }
    const turnSeat = attrOf("data-turn-seat");
    const seatsMode = currentOnlineSeats(box);
    const displayTurnSeat = turnSeat ? displaySeatOf(turnSeat) : "";
    const truco = $("#btn-truco");
    if (truco) {
      const off = ours || rung === 0 || asked !== "" || !yours;
      if (truco.disabled !== off) truco.disabled = off;
      const shout = rungWords()[rung];
      const onlineTurnText = seatsMode === "2v2"
        ? (displayTurnSeat === "parca" ? ui.turn_parca : displayTurnSeat === "eles2" ? ui.turn_eles2 : ui.turn_eles1)
        : ui.opponent_turn;
      const onlineTurnTitle = seatsMode === "2v2"
        ? (displayTurnSeat === "parca" ? ui.title_waiting_parca : displayTurnSeat === "eles2" ? ui.title_waiting_eles2 : ui.title_waiting_eles1)
        : ui.title_waiting_online;
      const targetText = ours
        ? ui.raise_them
        : rung === 0 ? ui.at_max
        : !yours ? (isOnline ? onlineTurnText : ui.their_turn)
        : shout ? shout.toUpperCase() : ui.truco;
      if (truco.dataset.appliedText !== targetText) {
        if (typeof truco.animate === "function" && !still() && truco.isConnected && truco.clientHeight > 0 && truco.dataset.appliedText) {
          animate(truco, [
            { opacity: 0.35, transform: "scale(0.96)" },
            { opacity: 1, transform: "scale(1)" }
          ], { duration: 160, easing: "cubic-bezier(.2, .86, .28, 1)" });
        }
        truco.textContent = targetText;
        truco.dataset.appliedText = targetText;
      }
      truco.title = ours
        ? ui.title_ours
        : !yours ? (isOnline ? onlineTurnTitle : ui.title_not_yours)
        : ui.title_raise;
    }


    // While a call stands the round's stake is what the hand is still worth
    // and its rung is what was asked for (table.js keeps both).
    const stood = Number(attrOf("data-stake"));
    const climb = nextRung(st.variant, rung);
    const wordOf = (r) => (rungWords()[r] ?? "").toUpperCase();
    const raise = $("#btn-raise");
    if (raise) {
      const maxed = climb === null;
      if (raise.disabled !== maxed) raise.disabled = maxed;
      setText($("#btn-raise b"), maxed ? ui.at_max : wordOf(climb));
      setText($("#btn-raise small"), maxed ? ui.ceiling : ui.raise_to(climb));
    }
    setText($("#btn-run small"), ui.they_take(stood));

    // Read off the row rather than off the click, so the house's call shouts
    // the same way yours does. The first reading after a load is not a
    // landing: a page opened mid-call has nothing to throw.
    if (st.asked === undefined) st.asked = asked;
    if (asked !== st.asked) {
      if (asked !== "") shout(wordOf(rung), sideOf(asked));
      else hush("call");
      st.asked = asked;
    }

    // A tell is the one line the fold ends with an ellipsis (table.js CAST);
    // the seats wear it while it stands, and each persona has a gesture.
    const seats = $(".seats");
    if (seats) {
      const telling = attrOf("data-said").startsWith("tell_") ? box.dataset.opponent : "";
      if ((seats.dataset.tell ?? "") !== telling) {
        if (telling === "") delete seats.dataset.tell;
        else seats.dataset.tell = telling;
      }
    }

    // Who ran is on the log; the round only says that nobody is asking.
    const activeHand = hand();
    const ranRow = (curRound && activeHand?.getAttribute("data-round-id") === curRound)
      ? activeHand?.querySelector('.log li[data-kind="run"]') ?? null
      : null;
    const ran = ranRow === null ? "" : sideOf(ranRow.dataset.seat);
    if (st.ran === undefined) st.ran = "";
    if (ran !== "" && st.shoutedRanRoundId !== curRound) {
      st.shoutedRanRoundId = curRound;
      st.ran = ran;
      shout(voice().ran, ran, "run");
    } else if (ran === "" && st.ran !== "") {
      st.ran = "";
      hush("run");
    }

    // The first reading after a load is the score as found, not a score moved.
    const us = Number(box.dataset.us), them = Number(box.dataset.them);
    st.us = us; st.them = them;

    const closed = box.dataset.status === "over";
    if (st.closed === undefined) st.closed = closed;
    if (closed !== st.closed) {
      if (closed) shout(box.dataset.winner === "us" ? voice().we_won : voice().they_won, box.dataset.winner === "us" ? "us" : "them", "close");
      else hush("close");
      st.closed = closed;
    }

    // The phase the board wears. It is a reading of the hand, not a state the
    // dealer keeps: over, decided, asked of you, yours to play, or theirs.
    // A line that replaces another has to land, and a CSS animation only
    // restarts when its name changes — so the strip alternates between two
    // that are the same.
    const talk = $(".talk");
    const oppBubble = $("#opponent-speech-bubble");
    const oppTalk = $("#opponent-talk");
    const turnBadge = $("#opponent-turn-badge");

    const rawSaid = attrOf("data-said");
    const line = sayOf(rawSaid, box, worth);

    const isPersonaLine = rawSaid.startsWith("tell_") ||
                          rawSaid.startsWith("call_") ||
                          rawSaid.startsWith("retort_") ||
                          rawSaid.includes("calma") ||
                          rawSaid.includes("quente") ||
                          rawSaid.includes("madeira") ||
                          rawSaid.includes("risadinha") ||
                          rawSaid.includes("peito") ||
                          rawSaid.includes("mão espalmada") ||
                          rawSaid.includes("ajeita") ||
                          rawSaid.includes("mesa");

    const shoutWord = attrOf("data-shout-word");
    const shoutFrom = attrOf("data-shout-from");
    const shoutState = attrOf("data-shout-state");
    const shoutKind = attrOf("data-shout-kind");
    const shoutSeat = attrOf("data-shout-seat");

    if (shoutState === "live" && shoutWord && shoutKind === "quick") {
      const cat = messages ?? {};
      const loc = screen.dataset.locale || "pt-BR";
      const trans = (cat[loc] ?? cat["pt-BR"] ?? {})[shoutWord] ?? shoutWord;
      const localized = trans.toUpperCase();
      const shoutT = attrOf("data-shout-t") || "";
      const shoutKey = `${shoutFrom}_${shoutWord}_${shoutT}`;

      if (st.lastShoutSaid !== shoutKey) {
        st.lastShoutSaid = shoutKey;
        const isMyOwnShout = shoutSeat === getMySeat();
        if (isMyOwnShout) {
          const pWrap = $("#player-dialogue-wrap");
          const pTalk = $("#player-talk");
          if (pWrap && pTalk) {
            setText(pTalk, `“${localized}”`);
            pWrap.dataset.active = "no";
            void pWrap.offsetWidth;
            pWrap.dataset.active = "yes";
            clearTimeout(st.playerQuickBubbleTimer);
            st.playerQuickBubbleTimer = setTimeout(() => {
              pWrap.dataset.active = "no";
            }, 1800);
          }
        } else if (asked === "" && !closed) {
          shout(localized, shoutFrom, "quick");
        }
      }
      if (oppTalk && oppBubble && shoutFrom === "them") {
        setText(oppTalk, `“${localized}”`);
        if (oppBubble.style.display !== "block") oppBubble.style.display = "block";
        clearTimeout(st.oppQuickBubbleTimer);
        st.oppQuickBubbleTimer = setTimeout(() => {
          if (attrOf("data-shout-state") === "live" && attrOf("data-shout-kind") === "quick") {
            hush("quick", true);
          }
        }, 1800);
      }
    } else {
      if (st.oppQuickBubbleTimer) {
        clearTimeout(st.oppQuickBubbleTimer);
        st.oppQuickBubbleTimer = null;
      }
      if (st.playerQuickBubbleTimer) {
        clearTimeout(st.playerQuickBubbleTimer);
        st.playerQuickBubbleTimer = null;
      }
      const pWrap = $("#player-dialogue-wrap");
      if (pWrap && pWrap.dataset.active === "yes") pWrap.dataset.active = "no";
      if (Boolean(st.lastShoutSaid)) {
        st.lastShoutSaid = "";
        hush("quick", true);
        if (asked !== "") {
          shout(wordOf(rung), sideOf(asked));
        }
      }
    }

    if (oppTalk && oppBubble && !(shoutState === "live" && shoutKind === "quick" && shoutFrom === "them")) {
      if (isPersonaLine && line) {
        setText(oppTalk, line);
        if (oppBubble.style.display !== "block") oppBubble.style.display = "block";
      } else {
        const opp = box.dataset.opponent ?? "nezinho";
        const TELLS = {
          nezinho: "Seu Nezinho ajeita as cartas na mesa com cuidado.",
          cida: "Dona Cida bate duas vezes com o anel na mesa.",
          tiao: "Tião Pandeiro cantarola e tamborila os dedos.",
          ze: "Zé da Bicicleta fica quieto e ajeita o boné.",
          xiru: "Xirú Velho ajeita o lenço no pescoço com calma.",
          osvaldo: "Don Osvaldo acaricia el bigote pensativo.",
          tiao_queijo: "Tião do Queijo corta uma fatia com a faquinha.",
          tabare: "Don Tabaré toma un mate amargo mirando de reojo.",
          jordi: "L'Oncle Jordi mira de reüll amb un mig somriure.",
        };
        const tell = TELLS[opp] ?? voice().tells?.[opp] ?? "Ajeita as cartas na mesa com cuidado.";
        setText(oppTalk, tell);
        if (oppBubble.style.display !== "block") oppBubble.style.display = "block";
      }
    }

    if (talk !== null) {
      if (talk.textContent !== line) {
        setText(talk, line);
        if (line !== "") {
          talk.dataset.t = talk.dataset.t === "1" ? "2" : "1";
        }
      }
    }

    if (turnBadge) {
      const turnSeat = attrOf("data-turn-seat");
      const isHisTurn = Boolean(turnSeat) && !turnSeat.includes("{") && sideOf(turnSeat) !== "us";
      const targetDisplay = isHisTurn ? "block" : "none";
      if (turnBadge.style.display !== targetDisplay) {
        turnBadge.style.display = targetDisplay;
      }
    }

    const play = $(".play");
    if (play) {
      if ((play.dataset.ran ?? "") !== ran) {
        if (ran === "") delete play.dataset.ran;
        else play.dataset.ran = ran;
      }
      const hasCards = screen.querySelectorAll("#seat-you .card").length > 0;
      // A brink yours to decide is your turn, though no card is playable
      // until you have: the hand waits on you, not on the house.
      const targetPhase = box.dataset.status === "over"
        ? "over"
        : (hand() === null && !hasCards) ? "idle"
        : attrOf("data-result") !== "" ? "resolved"
        : asked !== "" && sideOf(asked) === "them" ? "raised"
        : yours || attrOf("data-calls").split(" ").includes("brink") ? "your-turn" : "waiting";
      if (play.dataset.phase !== targetPhase) {
        play.dataset.phase = targetPhase;
      }
    }

    const over = $("#over-line");
    if (over && box.dataset.status === "over") {
      const oppName = $(".eles-name")?.textContent ?? "Eles";
      setText(over, box.dataset.winner === "us" ? ui.match_yours : ui.match_theirs(oppName));
      const closing = voice().closing[box.dataset.opponent] ?? voice().closing.nezinho;
      // A line the table itself said outranks the cast's parting shot. It is
      // the one text on this screen a locale cannot reach: table.js writes the
      // sentence into the row, so what the column carries is Portuguese
      // whatever the reader asked for.
      const saidText = sayOf(attrOf("data-said"), box, worth);
      const defaultClosing = box.dataset.winner === "us" ? closing.lost : closing.won;
      setText($("#over-say"), saidText ? saidText : defaultClosing);
    }

    const modalAbandonBanner = $("#modal-match-active-banner");
    if (modalAbandonBanner) {
      modalAbandonBanner.style.display = (box.dataset.status === "playing" && box.dataset.opponent === "online") ? "flex" : "none";
    }

    animateRemainingHand();
    } finally {
      cachedMySeat = null;
    }
  };

  // Whoever is on turn acts: you wait for a tap, the house answers on a beat.
  const sideOf = (seat) => {
    if (!seat) return "";
    const box = $(".matchbox");
    const rawMode = box?.dataset.seats;
    const mode = (rawMode && !rawMode.includes("{")) ? rawMode : "1v1";
    const order = seatsOf(mode);
    const my = getMySeat();
    const sides = order.length === 6 ? ["us", "them", "others"] : ["us", "them"];
    const seatIdx = order.indexOf(seat);
    const myIdx = order.indexOf(my);
    if (seatIdx === -1) throw new Error(`Unknown seat "${seat}" for seats mode "${mode}"`);
    if (myIdx === -1) throw new Error(`Unknown mySeat "${my}" for seats mode "${mode}"`);
    return sides[(seatIdx - myIdx + order.length) % sides.length];
  };

  /* --- posed frames ------------------------------------------------------ */

  // The storybook renders this screen once per storyboard state against a
  // read-only fixture store. The dealer must not play there — it poses, so
  // the frames review the same card markup the table draws.
  const posing = new URLSearchParams(location.search).has("storybook");

  const pose = () => {
    const state = screen.dataset.state ?? "populated";
    const base = state.replace(/-dark$/, "");
    st.variant = "mineiro";
    render();
    // The frame's phase is the storyboard's, not a reading of the fixtures:
    // these are the states the screen must be reviewable in, whether or not a
    // fixture can be arranged to produce one.
    const play = $(".play");
    if (play) {
      play.dataset.phase = {
        loading: "waiting", empty: "idle", populated: "your-turn", picking: "your-turn",
        raised: "raised", resolved: "resolved", "match-over": "over",
      }[base] ?? "your-turn";
    }
    const line = $("#over-line");
    if (line && base === "match-over") line.textContent = "Partida sua!";
    if (base === "picking") {
      screen.querySelector('[data-picker="theme"] ul')?.showPopover?.();
    }
  };

  if (posing) {
    observe(pose).observe(screen, { attributes: true, attributeFilter: ["data-state"] });
    pose();
    return;
  }

  /* --- boot -------------------------------------------------------------- */

  const getStoredHandle = () => {
    for (const store of [sessionStorage, localStorage]) {
      const h = store.getItem("truco-handle");
      if (h === "{handle}") {
        store.removeItem("truco-handle");
        continue;
      }
      if (h) return h;
    }
    return null;
  };

  const setStoredHandle = (v) => {
    if (!v || v === "{handle}") {
      sessionStorage.removeItem("truco-handle");
      localStorage.removeItem("truco-handle");
      return;
    }
    sessionStorage.setItem("truco-handle", v);
    localStorage.setItem("truco-handle", v);
  };

  const resolveOpponentName = () => {
    const box = $(".matchbox");
    const isOnline = box?.dataset.opponent === "online";
    if (!isOnline) {
      const oppKey = box?.dataset.opponentName || "opponent_nezinho";
      const loc = screen.dataset.locale || "pt-BR";
      const cat = messages?.[loc];
      return cat?.[oppKey] || (oppKey.startsWith("opponent_") ? oppKey.slice(9) : oppKey);
    }
    const rawName = box?.dataset.opponentName;
    if (rawName && rawName !== "opponent_online" && rawName !== "Adversário Online" && rawName !== "opponent_nezinho") {
      return rawName;
    }
    if (activeChallengeTargetName) return activeChallengeTargetName;
    const qOpp = (typeof location !== "undefined" && location.search) ? new URLSearchParams(location.search).get("opp") : null;
    if (qOpp) return qOpp;
    const seed = box?.dataset.seed;
    const client = globalThis.__mechaClient;
    if (client?.collections?.lobby?.state && seed) {
      const myId = getMyPlayerId();
      const peer = Array.from(client.collections.lobby.state.values())
        .find((r) => String(r.room_seed) === String(seed) && r.id !== myId && r.handle);
      if (peer?.handle) return peer.handle;
    }
    return "Adversário";
  };

  updateSeatPerspective = () => {
    const seat = getMySeat();
    if (screen.dataset.mySeat !== seat) screen.dataset.mySeat = seat;
    const whoTitle = $("#seatbar-player-name") || $(".who b");
    const avatar = $("#seatbar-avatar") || $(".seatbar .avatar");
    const custom = getStoredHandle();
    if (custom && custom.trim() && custom !== "Você" && custom !== "Vos" && custom !== "Tu") {
      if (whoTitle) setText(whoTitle, custom.trim());
      if (avatar) setText(avatar, custom.trim()[0].toUpperCase());
    } else {
      if (whoTitle) {
        const def = whoTitle.dataset.text || "Você";
        setText(whoTitle, def);
      }
      if (avatar) setText(avatar, "V");
    }

    const box = $(".matchbox");
    const isOnline = box?.dataset.opponent === "online";
    const oppName = resolveOpponentName();

    for (const el of screen.querySelectorAll(".eles-name")) {
      setText(el, oppName);
    }

    const oppDot = $("#opponent-online-dot");
    const oppBadge = $("#opponent-online-badge");
    const oppInit = $("#opponent-avatar-initial");
    const oppImg = $("#opponent-avatar-img");
    const oppRole = $("#opponent-role-desc");

    if (isOnline) {
      if (oppDot) oppDot.style.display = "block";
      if (oppBadge) oppBadge.style.display = "inline-block";
      if (oppInit) {
        oppInit.style.display = "flex";
        setText(oppInit, oppName ? oppName[0].toUpperCase() : "A");
      }
      if (oppImg) oppImg.style.display = "none";
      const getRoleMsg = (k) => {
        const loc = screen.dataset.locale || "pt-BR";
        const cat = messages ?? {};
        return (cat[loc] ?? cat["pt-BR"] ?? {})[k] ?? (cat["pt-BR"] ?? {})[k] ?? k;
      };
      if (oppRole) {
        const isPartner = box?.dataset.seats === "2v2";
        setText(oppRole, getRoleMsg(isPartner ? "role_partner" : "role_opponent"));
      }
    } else {
      if (oppDot) oppDot.style.display = "none";
      if (oppBadge) oppBadge.style.display = "none";
      if (oppInit) oppInit.style.display = "none";
      if (oppImg) oppImg.style.display = "";
      if (oppRole) {
        const loc = screen.dataset.locale || "pt-BR";
        const cat = messages ?? {};
        setText(oppRole, (cat[loc] ?? cat["pt-BR"] ?? {})["role_bot"] ?? "Robô");
      }
    }

    const roomBadge = $("#tavern-room-badge");
    if (roomBadge) {
      const seed = box?.dataset.seed;
      if (isOnline && seed && seed !== "1") {
        roomBadge.style.display = "inline-flex";
        setText(roomBadge, `#${seed}`);
      } else {
        roomBadge.style.display = "none";
      }
    }
  };

  const getOrCreateRoomSeed = () => {
    const box = $(".matchbox");
    if (box?.dataset.opponent === "online" && box.dataset.seed && !box.dataset.seed.includes("{") && box.dataset.seed !== "1" && box.dataset.status !== "over") {
      return box.dataset.seed;
    }
    const storageKey = "truco-room-seed";
    const s = sessionStorage.getItem(storageKey);
    const stale = Boolean(s && box?.dataset.status === "over" && box?.dataset.seed === s);
    if (s && s !== "1" && !stale) {
      return s;
    }
    const fresh = String(Math.floor(100000 + Math.random() * 900000));
    sessionStorage.setItem(storageKey, fresh);
    return fresh;
  };

  let selectedInviteSeat = "eles1";
  const updateInviteField = () => {
    const field = $("#invite-url-field");
    if (!field) return;
    const box = $(".matchbox");
    const isOnlineMatch = box?.dataset.opponent === "online";
    const seatsMode = currentOnlineSeats(box);
    const mySeat = getMySeat();

    const modal = $("#modal-online");
    if (modal) {
      for (const b of modal.querySelectorAll(".btn-invite-seat")) {
        const isSelf = b.dataset.seat === mySeat;
        const is2v2Only = b.dataset.seat === "parca" || b.dataset.seat === "eles2";
        if (isSelf || (isOnlineMatch && seatsMode === "1v1" && is2v2Only)) {
          b.style.display = "none";
          b.classList.remove("active");
        } else {
          b.style.display = "";
        }
      }
    }

    const allowed = ["you", "eles1", "parca", "eles2"].filter((s) => s !== mySeat);
    if (isOnlineMatch && seatsMode === "1v1" && (selectedInviteSeat === "parca" || selectedInviteSeat === "eles2")) {
      selectedInviteSeat = allowed[0];
    } else if (selectedInviteSeat === mySeat) {
      selectedInviteSeat = allowed[0];
    }

    if (modal) {
      for (const b of modal.querySelectorAll(".btn-invite-seat")) {
        b.classList.toggle("active", b.dataset.seat === selectedInviteSeat);
      }
    }

    const is2v2 = seatsFor(selectedInviteSeat, seatsMode) === "2v2";
    let targetSeat = selectedInviteSeat;
    if (!is2v2 && selectedInviteSeat !== "you" && (mySeat === "eles1" || mySeat === "eles2")) {
      targetSeat = "you";
    }
    const seed = getOrCreateRoomSeed();
    const curV = currentVariant();
    if (curV === "douradinha" || curV === "douradao") {
      field.value = "";
      return;
    }
    const seatsParam = is2v2 ? "&seats=2v2" : "";
    const variant = validateVariantForSeats(curV, is2v2 ? "2v2" : "1v1");
    const variantParam = `&variant=${encodeURIComponent(variant)}`;
    const oppParam = `&opp=${encodeURIComponent(getMyHandle())}`;
    const url = `${location.origin}${location.pathname}?seed=${encodeURIComponent(seed)}&opponent=online&seat=${targetSeat}${seatsParam}${variantParam}${oppParam}`;
    field.value = url;
  };

  const getSessionUser = () => {
    const raw = sessionStorage.getItem("pronto-token");
    if (!raw) return null;
    try {
      return JSON.parse(raw)?.user || null;
    } catch {
      sessionStorage.removeItem("pronto-token");
      return null;
    }
  };

  const getMyPlayerId = () => {
    let id = localStorage.getItem("truco-player-id") || sessionStorage.getItem("truco-player-id");
    const u = getSessionUser();
    if (u?.id && (!id || id.startsWith("p_"))) {
      id = u.id;
      localStorage.setItem("truco-player-id", id);
      sessionStorage.setItem("truco-player-id", id);
    }
    if (!id) {
      id = u?.id || ("p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7));
      localStorage.setItem("truco-player-id", id);
      sessionStorage.setItem("truco-player-id", id);
    }
    return id;
  };

  const getMyHandle = () => {
    let h = getStoredHandle();
    if (!h) {
      const u = getSessionUser();
      h = u?.handle || u?.name || `truqueiro-${Math.random().toString(36).slice(2, 6)}`;
      setStoredHandle(h);
    }
    return h;
  };

  const getShortSlug = (id) => {
    if (!id) return "";
    const clean = id.replace(/^p_/, "");
    const parts = clean.split("_");
    const last = parts[parts.length - 1];
    return (last && last.length >= 3) ? last.slice(-4) : clean.slice(-4);
  };

  const sendLobbyHeartbeat = async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const client = globalThis.__mechaClient;
    if (!client) return;
    const box = $(".matchbox");
    const seed = getOrCreateRoomSeed();
    const isOnlineMatch = box?.dataset.opponent === "online";
    const isPlaying = box?.dataset.status === "playing" && attrOf("data-result") === "";
    const myId = getMyPlayerId();
    const myHandle = getMyHandle();
    const seatsMode = currentOnlineSeats(box);
    const payload = {
      id: myId,
      handle: myHandle,
      room_seed: seed,
      variant: currentVariant(),
      seats: seatsMode,
      status: (isOnlineMatch && isPlaying) ? "playing" : "waiting",
      updated_at: new Date().toISOString(),
    };
    const col = client.collections?.lobby;
    const exists = col?.state?.has?.(myId);
    if (exists) {
      await client.update("lobby", [{ key: myId, changes: payload }]);
      if (signal.aborted) return;
    } else {
      await client.insert("lobby", [payload]);
      if (signal.aborted) return;
    }
  };

  const leaveLobby = async (force = false) => {
    const client = globalThis.__mechaClient;
    if (!client?.remove) return;
    const box = $(".matchbox");
    const isOnlineMatch = box?.dataset.opponent === "online";
    const isPlaying = box?.dataset.status === "playing" && attrOf("data-result") === "";
    if (!force && isOnlineMatch && isPlaying) return;
    const myId = getMyPlayerId();
    if (!myId) return;
    const col = client.collections?.lobby;
    const exists = col?.state?.has ? col.state.has(myId) : true;
    if (exists) {
      await client.remove("lobby", [myId]);
      if (signal.aborted) return;
    }
  };

  const filterAndMarkRows = () => {
    const listEl = $("#lobby-players-list");
    if (!listEl) return;
    const rows = listEl.querySelectorAll(".lobby-player-row");
    const myId = getMyPlayerId();
    const myHandle = getMyHandle();

    const rowData = Array.from(rows).map((row) => {
      const rowId = row.dataset.id;
      const isMe = rowId === myId;
      const handle = isMe ? myHandle : (row.dataset.handle || "");
      return { row, rowId, isMe, handle };
    });

    const handleCounts = new Map();
    for (const { handle } of rowData) {
      if (handle) {
        handleCounts.set(handle, (handleCounts.get(handle) || 0) + 1);
      }
    }

    for (const { row, rowId, isMe, handle } of rowData) {
      row.dataset.isMe = isMe ? "true" : "false";

      const isDuplicate = (handleCounts.get(handle) || 0) > 1;
      row.dataset.duplicate = isDuplicate ? "true" : "false";
      const slug = getShortSlug(rowId);
      const slugPart = (isDuplicate && slug) ? ` #${slug}` : "";
      const label = isMe ? `${handle}${slugPart} (Você)` : `${handle}${slugPart}`;
      row.title = slug ? `${handle} (${slug})` : handle;

      const handleEl = row.querySelector(".player-handle");
      if (handleEl) setText(handleEl, label);
    }
  };

  let activeChallengeId = null;
  let activeChallengeTargetName = "";
  let inFlightInsertPromise = null;
  let checkChallenges = () => {};

  const wireLobbyList = () => {
    const listEl = $("#lobby-players-list");
    if (!listEl || listEl.dataset.wired) return;
    mark(listEl, "wired");

    const observer = observe((mutations) => {
      const hasRelevant = mutations.some((m) => {
        if (m.type === "childList" && m.target === listEl) return true;
        if (m.type === "attributes") {
          return m.oldValue !== m.target.getAttribute(m.attributeName);
        }
        return false;
      });
      if (hasRelevant) filterAndMarkRows();
    });
    observer.observe(listEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["data-id", "data-handle"],
    });

    listen(listEl, "click", async (e) => {
      const btn = e.target.closest(".btn-challenge");
      if (!btn) return;
      const row = btn.closest(".lobby-player-row");
      if (!row) return;

      const myId = getMyPlayerId();
      const targetId = row.dataset.id;
      if (!targetId) throw new Error("Missing target player ID for challenge");
      if (targetId === myId) return;

      const client = globalThis.__mechaClient;
      if (!client?.insert) {
        throw new Error("Mecha client unavailable for challenge insert");
      }

      const targetHandle = row.dataset.handle;
      const targetVariant = validateVariantForSeats(currentVariant(), "1v1");
      const slug = getShortSlug(targetId);
      const isDuplicate = row.dataset.duplicate === "true";
      const targetDisplay = (isDuplicate && slug) ? `${targetHandle} #${slug}` : targetHandle;

      const seed = String(Math.floor(100000 + Math.random() * 900000));
      const challengeId = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      activeChallengeId = challengeId;
      activeChallengeTargetName = targetHandle;

      const modal = $("#modal-online");
      if (modal?.matches?.(":popover-open")) {
        modal.hidePopover();
      }

      const overlay = $("#challenge-waiting-overlay");
      const targetNameEl = $("#waiting-target-name");
      if (targetNameEl) setText(targetNameEl, `Desafiando ${targetDisplay}...`);
      if (overlay) overlay.style.display = "flex";

      const payload = {
        id: challengeId,
        challenger_id: myId,
        challenger_name: getMyHandle(),
        target_id: targetId,
        seed: seed,
        variant: targetVariant,
        status: "pending",
        created_at: new Date().toISOString(),
      };

      const insertPromise = client.insert("challenge", [payload]);
      inFlightInsertPromise = insertPromise;

      try {
        await insertPromise;
        if (signal.aborted) return;
      } catch (err) {
        if (!signal.aborted && activeChallengeId === challengeId) {
          activeChallengeId = null;
          activeChallengeTargetName = "";
          if (overlay) overlay.style.display = "none";
          if (modal && !modal.matches?.(":popover-open")) {
            modal.showPopover();
          }
        }
        throw err;
      } finally {
        if (inFlightInsertPromise === insertPromise) {
          inFlightInsertPromise = null;
        }
      }
    });

    const btnCancel = $("#btn-cancel-challenge");
    if (btnCancel) {
      listen(btnCancel, "click", async () => {
        const overlay = $("#challenge-waiting-overlay");
        if (overlay) overlay.style.display = "none";
        const modal = $("#modal-online");
        if (modal && !modal.matches?.(":popover-open")) {
          modal.showPopover();
        }
        if (activeChallengeId) {
          const cid = activeChallengeId;
          activeChallengeId = null;
          activeChallengeTargetName = "";
          const client = globalThis.__mechaClient;
          if (!client?.update) throw new Error("Mecha client unavailable for challenge update");
          if (inFlightInsertPromise) {
            try {
              await inFlightInsertPromise;
              if (signal.aborted) return;
            } catch {
              return;
            }
          }
          await client.update("challenge", [{ key: cid, changes: { status: "declined" } }]);
          if (signal.aborted) return;
        }
      });
    }

    filterAndMarkRows();
  };

  const startOnlineMatch = (seed, seat, opponentName, seats, variant = currentVariant()) => {
    const box = $(".matchbox");
    const currentSeats = currentOnlineSeats(box);
    const targetSeats = seats || seatsFor(seat, currentSeats);
    if (!seatsOf(targetSeats).includes(seat)) {
      throw new Error(`Seat "${seat}" is not a valid player seat in seats mode "${targetSeats}"`);
    }
    const boxVariant = (box?.dataset?.variant && !box.dataset.variant.includes("{")) ? box.dataset.variant : undefined;
    const targetVariant = validateVariantForSeats(variant || boxVariant || currentVariant(), targetSeats);
    const qOppParam = (typeof location !== "undefined" && location.search) ? new URLSearchParams(location.search).get("opp") : null;
    const opp = (opponentName && opponentName !== "opponent_online" && opponentName !== "Adversário Online")
      ? opponentName
      : (activeChallengeTargetName || qOppParam || opponentName || "opponent_online");
    sessionStorage.setItem("truco-opponent-name", opp);
    const seatsParam = targetSeats === "2v2" ? `&seats=2v2` : "";
    const variantParam = `&variant=${encodeURIComponent(targetVariant)}`;
    const oppUrlParam = (opp && opp !== "opponent_online" && opp !== "Adversário Online") ? `&opp=${encodeURIComponent(opp)}` : "";
    const newUrl = `${location.pathname}?seed=${encodeURIComponent(seed)}&opponent=online&seat=${seat}${seatsParam}${variantParam}${oppUrlParam}`;
    sessionStorage.setItem("truco-room-seed", seed);
    sessionStorage.setItem("truco-seat", seat);
    history.replaceState(null, "", newUrl);

    const modal = $("#modal-online");
    if (modal?.matches?.(":popover-open") && opponentName !== "Adversário Online") {
      modal.hidePopover();
    }
    const banner = $("#incoming-challenge-banner");
    if (banner) banner.style.display = "none";
    const overlay = $("#challenge-waiting-overlay");
    if (overlay) overlay.style.display = "none";

    const btnSetSeat = $("#btn-set-seat");
    if (btnSetSeat) {
      btnSetSeat.dispatchEvent(new CustomEvent("click", {
        bubbles: true,
        detail: { seat, seed, opponent: "online", opponent_name: opp, seats: targetSeats, variant: targetVariant },
      }));
    }
    updateSeatPerspective();
  };

  const wireChallengeSync = () => {
    const banner = $("#incoming-challenge-banner");
    const challengerNameEl = $("#challenge-challenger-name");
    const btnAccept = $("#btn-challenge-accept");
    const btnDecline = $("#btn-challenge-decline");
    let currentIncoming = null;

    if (btnAccept) {
      listen(btnAccept, "click", async () => {
        if (!currentIncoming) return;
        const challenge = currentIncoming;
        const client = globalThis.__mechaClient;
        if (!client?.update) throw new Error("Mecha client unavailable for challenge update");

        await client.update("challenge", [{ key: challenge.id, changes: { status: "accepted" } }]);

        if (signal.aborted) return;

        currentIncoming = null;
        if (banner) banner.style.display = "none";
        startOnlineMatch(challenge.seed, "eles1", challenge.challenger_name, "1v1", challenge.variant);
      });
    }

    if (btnDecline) {
      listen(btnDecline, "click", async () => {
        if (!currentIncoming) return;
        const client = globalThis.__mechaClient;
        if (!client?.update) throw new Error("Mecha client unavailable for challenge update");

        const challenge = currentIncoming;
        await client.update("challenge", [{ key: challenge.id, changes: { status: "declined" } }]);
        if (signal.aborted) return;

        currentIncoming = null;
        if (banner) banner.style.display = "none";
        const modal = $("#modal-online");
        if (modal && !modal.matches?.(":popover-open")) {
          modal.showPopover();
        }
      });
    }

    let challengeSubscribed = false;
    const ensureChallengeSub = () => {
      if (challengeSubscribed) return;
      challengeSubscribed = true;
      const client = globalThis.__mechaClient;
      if (client?.collections?.challenge?.subscribeChanges) {
        subscribe(client.collections.challenge, () => checkChallenges());
      }
    };

    checkChallenges = () => {
      ensureChallengeSub();
      const client = globalThis.__mechaClient;
      const now = Date.now();
      const myId = getMyPlayerId();

      const itemsMap = new Map();
      const col = client?.collections?.challenge;
      if (col?.toArray && Array.isArray(col.toArray)) {
        for (const it of col.toArray) {
          if (it?.id) itemsMap.set(it.id, it);
        }
      } else if (col?.state?.values) {
        for (const it of col.state.values()) {
          if (it?.id) itemsMap.set(it.id, it);
        }
      }
      const items = Array.from(itemsMap.values());

      let pendingIncoming = null;
      for (const item of items) {
        if (String(item.target_id) === String(myId) && item.status === "pending") {
          const safeDateStr = (item.created_at || "").replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
          const itemTime = safeDateStr ? new Date(safeDateStr).getTime() : 0;
          const age = isNaN(itemTime) || itemTime === 0 ? 0 : (now - itemTime);
          if (age < 300000) {
            pendingIncoming = item;
            break;
          }
        }
      }

      if (activeChallengeId) {
        const item = items.find((it) => it.id === activeChallengeId);
        if (item) {
          const overlay = $("#challenge-waiting-overlay");
          if (item.status === "accepted") {
            const seed = item.seed;
            const opp = activeChallengeTargetName || item.challenger_name || "Adversário";
            activeChallengeId = null;
            activeChallengeTargetName = "";
            if (overlay) overlay.style.display = "none";
            startOnlineMatch(seed, "you", opp, "1v1", item.variant);
          } else if (item.status === "declined") {
            activeChallengeId = null;
            activeChallengeTargetName = "";
            if (overlay) overlay.style.display = "none";
            const modal = $("#modal-online");
            if (modal && !modal.matches?.(":popover-open")) {
              modal.showPopover();
            }
            alert("O desafio foi recusado.");
          }
        }
      }

      if (pendingIncoming) {
        currentIncoming = pendingIncoming;
        if (banner) banner.dataset.id = pendingIncoming.id;
        if (challengerNameEl) setText(challengerNameEl, pendingIncoming.challenger_name || "Jogador");
        const modal = $("#modal-online");
        if (modal?.matches?.(":popover-open")) {
          modal.hidePopover();
        }
        if (banner && banner.style.display !== "flex") banner.style.display = "flex";
      } else {
        if (banner && banner.style.display !== "none") banner.style.display = "none";
        if (banner) banner.dataset.id = "";
        currentIncoming = null;
      }
    };

    ensureChallengeSub();
    checkChallenges();
  };

  const getActiveRoom = () => {
    const box = $(".matchbox");
    const qOpp = new URLSearchParams(location.search).get("opponent");
    const isOnline = box?.dataset.opponent === "online" || qOpp === "online";
    if (!isOnline) return null;
    const qSeed = new URLSearchParams(location.search).get("seed");
    const seed = (qOpp === "online" && qSeed) ? qSeed : (box?.dataset.seed || qSeed || "");
    const qSeat = new URLSearchParams(location.search).get("seat");
    const seat = (qOpp === "online" && (sessionStorage.getItem("truco-seat") || qSeat)) || box?.dataset.mySeat || "you";
    return seed ? { seed, seat } : null;
  };

  const wireRoomActionSync = () => {
    ensureOnlineMode();
  };

  const wireOnlineModal = () => {
    const modal = $("#modal-online");
    if (!modal || modal.dataset.wired) return;
    mark(modal, "wired");

    wireLobbyList();
    wireChallengeSync();
    wireRoomActionSync();

    const handleInput = $("#my-handle-input");
    if (handleInput) handleInput.value = getMyHandle();

    const saveHandle = async () => {
      if (!handleInput) return;
      const v = handleInput.value.trim();
      if (v) {
        setStoredHandle(v);
        updateSeatPerspective();
        if (isOnline) {
          await sendLobbyHeartbeat();
          if (signal.aborted) return;
        }
        filterAndMarkRows();
        if (btnSaveHandle) {
          btnSaveHandle.textContent = "✓ Salvo";
        }
      }
    };

    const btnSaveHandle = $("#btn-save-handle");
    if (btnSaveHandle) {
      listen(btnSaveHandle, "click", saveHandle);
    }
    if (handleInput) {
      listen(handleInput, "keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveHandle();
        }
      });
      listen(handleInput, "input", () => {
        const v = handleInput.value.trim();
        if (v) {
          setStoredHandle(v);
          updateSeatPerspective();
          filterAndMarkRows();
        }
        if (btnSaveHandle && btnSaveHandle.textContent !== "Salvar") {
          btnSaveHandle.textContent = "Salvar";
        }
      });
      listen(handleInput, "change", saveHandle);
      listen(handleInput, "blur", saveHandle);
    }

    let isOnline = false;

    const setOnlineVisual = (online) => {
      isOnline = online;
      const toggle = $("#btn-toggle-online");
      if (toggle) {
        toggle.dataset.online = online ? "true" : "false";
        toggle.setAttribute("aria-checked", online ? "true" : "false");
      }
      const openBtn = $("#btn-open-online");
      if (openBtn) {
        openBtn.dataset.online = online ? "true" : "false";
      }
    };

    const goOnline = async () => {
      setOnlineVisual(true);
      if (handleInput) handleInput.value = getMyHandle();
      await sendLobbyHeartbeat();
      if (signal.aborted) return;
      filterAndMarkRows();
      updateInviteField();
    };

    const goOffline = async () => {
      setOnlineVisual(false);
      clearOnlineSession();
      await leaveLobby(true);
      if (signal.aborted) return;
      filterAndMarkRows();
      const box = $(".matchbox");
      if (box?.dataset.opponent === "online") {
        const btnSetSeat = $("#btn-set-seat");
        if (btnSetSeat) {
          btnSetSeat.dispatchEvent(new CustomEvent("click", {
            bubbles: false,
            detail: {
              seat: "you",
              seed: "1",
              opponent: "nezinho",
              opponent_name: "opponent_nezinho",
              seats: "1v1",
              variant: validateVariantForSeats(currentVariant(), "1v1"),
            },
          }));
        }
        updateSeatPerspective();
      }
    };

    const btnToggleOnline = $("#btn-toggle-online");
    if (btnToggleOnline) {
      listen(btnToggleOnline, "click", async () => {
        if (isOnline) {
          await goOffline();
          if (signal.aborted) return;
        } else {
          await goOnline();
          if (signal.aborted) return;
        }
      });
    }

    listen(modal, "toggle", async (e) => {
      if (e.newState === "open") {
        if (handleInput) handleInput.value = getMyHandle();
        filterAndMarkRows();
        updateInviteField();
        if (isOnline) {
          await sendLobbyHeartbeat();
          if (signal.aborted) return;
        }
      }
    });

    listen(window, "pagehide", () => {
      leaveLobby();
    });

    for (const b of modal.querySelectorAll(".btn-invite-seat")) {
      listen(b, "click", () => {
        const seat = b.dataset.seat;
        if (!seat) throw new Error("Missing data-seat on invite seat button");
        selectedInviteSeat = seat;
        updateInviteField();
      });
    }

    listen($("#btn-copy-invite"), "click", () => {
      const box = $(".matchbox");
      const isOnlineMatch = box?.dataset.opponent === "online";
      const seatsMode = currentOnlineSeats(box);
      const targetSeats = seatsFor(selectedInviteSeat, seatsMode);
      const seed = getOrCreateRoomSeed();
      const mySeat = getMySeat();
      if (!isOnlineMatch || box?.dataset.status === "over" || box?.dataset.seed !== seed) {
        startOnlineMatch(seed, mySeat, "Adversário Online", targetSeats, currentVariant());
      }
      updateInviteField();
      const field = $("#invite-url-field");
      const status = $("#copy-status");
      if (field?.value) {
        if (!navigator.clipboard?.writeText) {
          throw new Error("Clipboard API unavailable");
        }
        navigator.clipboard.writeText(field.value).then(() => {
          if (signal.aborted) return;
          if (status) setText(status, "✓ Link copiado para a área de transferência!");
          setTimeout(() => { if (status) setText(status, ""); }, 3000);
        }).catch(() => {
          if (signal.aborted) return;
          if (status) setText(status, "Copie o link manualmente acima.");
        });
      }
    });

    const btnSubmit = $("#btn-submit-join");
    if (btnSubmit) {
      listen(btnSubmit, "click", () => {
        const input = $("#input-join-code");
        const err = $("#join-err");
        const getJoinMsg = (k) => {
          const loc = screen.dataset.locale || "pt-BR";
          const cat = messages?.[loc];
          if (!cat) throw new Error(`Missing message catalogue for locale "${loc}"`);
          const msg = cat[k];
          if (!msg) throw new Error(`Missing join message "${k}" for locale "${loc}"`);
          return msg;
        };
        const val = input ? input.value.trim() : "";
        if (!val) {
          if (err) setText(err, getJoinMsg("join_err_empty"));
          return;
        }
        let targetSeed = val;
        let seat = "eles1";
        let seats = undefined;
        let variant;
        let extractedOpp;
        if (val.includes("?")) {
          const u = new URL(val, location.origin);
          targetSeed = u.searchParams.get("seed") || u.searchParams.get("match") || targetSeed;
          seat = u.searchParams.get("seat") || seat;
          seats = u.searchParams.get("seats") ? seatsFor(seat, u.searchParams.get("seats")) : undefined;
          variant = u.searchParams.get("variant") || undefined;
          extractedOpp = u.searchParams.get("opp") || undefined;
        }
        const numSeed = Number(targetSeed);
        if (!Number.isInteger(numSeed) || numSeed <= 0) {
          if (err) setText(err, getJoinMsg("join_err_invalid"));
          return;
        }
        const strSeed = String(numSeed);
        const client = globalThis.__mechaClient;
        if (!variant || !extractedOpp) {
          const lobbyRows = Array.from(client?.collections?.lobby?.state?.values?.() || []);
          const host = lobbyRows.find((r) => String(r.room_seed) === strSeed);
          if (host) {
            if (!variant && host.variant) variant = host.variant;
            if (!seats && host.seats) seats = host.seats;
            if (!extractedOpp && host.handle) extractedOpp = host.handle;
          }
        }
        if (!variant) {
          if (err) setText(err, getJoinMsg("join_err_invalid"));
          return;
        }
        const targetSeats = seats || seatsFor(seat, "1v1");
        if (!val.includes("?") && targetSeats === "2v2") {
          const roomActions = Array.from(client?.collections?.room_action?.state?.values?.() || [])
            .filter((a) => String(a.room_seed) === strSeed);
          const takenSeats = new Set(roomActions.map((a) => a.player_id).filter(Boolean));
          const availableSeat = ["eles1", "parca", "eles2"].find((s) => !takenSeats.has(s));
          if (availableSeat) {
            seat = availableSeat;
          } else {
            if (err) setText(err, getJoinMsg("join_err_invalid"));
            return;
          }
        }
        if (!seatsOf(targetSeats).includes(seat)) {
          if (err) setText(err, getJoinMsg("join_err_invalid"));
          return;
        }
        if (err) setText(err, "");
        let targetVariant;
        try {
          targetVariant = validateVariantForSeats(variant, targetSeats);
        } catch {
          if (err) setText(err, getJoinMsg("join_err_invalid"));
          return;
        }
        startOnlineMatch(strSeed, seat, extractedOpp, targetSeats, targetVariant);
      });
    }

    updateInviteField();

    listen(document, "visibilitychange", () => {
      if (document.visibilityState === "visible") {
        if (isOnline && (navigator.onLine !== false)) {
          sendLobbyHeartbeat();
        }
      }
    });
  };

  const wireSeatbarIdentity = () => {
    const editBtn = $("#btn-edit-seatbar-handle");
    const whoTitle = $("#seatbar-player-name") || $(".who b");
    const input = $("#seatbar-handle-input");
    if (!editBtn || !input || editBtn.dataset.wired) return;
    mark(editBtn, "wired");

    const startEditing = () => {
      const cur = getStoredHandle() || "";
      input.value = cur;
      if (whoTitle) whoTitle.style.display = "none";
      editBtn.style.display = "none";
      input.style.display = "inline-block";
      input.focus();
      input.select();
    };

    const stopEditing = (save) => {
      if (save) {
        const val = input.value.trim();
        setStoredHandle(val);
        updateSeatPerspective();
        const handleInp = $("#my-handle-input");
        if (handleInp) handleInp.value = getMyHandle();
        const toggle = $("#btn-toggle-online");
        const box = $(".matchbox");
        const isOnline = toggle?.dataset.online === "true" || box?.dataset.opponent === "online";
        if (isOnline) {
          sendLobbyHeartbeat();
        }
        filterAndMarkRows();
      }
      input.style.display = "none";
      if (whoTitle) whoTitle.style.display = "";
      editBtn.style.display = "inline-flex";
    };

    listen(editBtn, "click", (e) => {
      e.stopPropagation();
      startEditing();
    });

    if (whoTitle) {
      whoTitle.style.cursor = "pointer";
      listen(whoTitle, "click", () => startEditing());
    }

    listen(input, "keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        stopEditing(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        stopEditing(false);
      }
    });

    listen(input, "blur", () => {
      stopEditing(true);
    });
  };

  // A returning screen (keep: 0, so this runs on every visit) finds the
  // engine state where it left it; a first visit finds an empty store and
  // deals into it.
  // What the engine remembers and what the store holds can part ways — a
  // reload empties the store, and a write from a screen already replaced never
  // landed. The bound match id is the store's own answer, so the dealer asks
  // it before trusting its memory.

  const boundMatch = () => {
    const target = new URLSearchParams(location.search).get("match");
    if (target) return target;
    const raw = $(".matchbox")?.dataset.matchId;
    return raw === undefined || raw === "" || raw.includes("{") ? null : raw;
  };

  // Take up the match already on the table rather than starting another. The
  // match outlives the tab and the dealer does not, so a reload arrives with a
  // sitting in progress and no memory of it — and minting a second one leaves
  // two matches `playing`, which the arena reads as a singleton: it binds one
  // of them and the dealer writes to the other. The theme picker stops working
  // and nothing says why.
  const adopt = () => {
    const box = $(".matchbox");
    const id = boundMatch();
    if (id === null) return false;
    st.matchId = id;
    st.variant = bound(box.dataset.variant, DEFAULT_VARIANT);
    st.seats = bound(box.dataset.seats, "1v1");
    st.theme = bound(box.dataset.theme, "xadrez");
    st.order = seatsOf(st.seats);
    st.hand = Number(bound(box.dataset.hand, "1"));
    st.stake = Number(bound(box.dataset.stake, String(baseStake(st.variant))));
    st.roundId = attrOf("data-round-id");
    // The mão follows the hand's number, so a sitting picked up mid-way deals
    // the next one to the seat whose turn it is rather than starting the
    // rotation again.
    st.mao = bound(attrOf("data-leader"), st.order[(st.hand - 1) % st.order.length]);
    return true;
  };

  const ensureOnlineMode = () => {
    const box = $(".matchbox");
    const qOpp = new URLSearchParams(location.search).get("opponent");
    const qSeed = new URLSearchParams(location.search).get("seed");
    const qSeat = new URLSearchParams(location.search).get("seat") || "you";
    const qSeats = seatsFor(qSeat, new URLSearchParams(location.search).get("seats") || "1v1");
    const qVariantRaw = new URLSearchParams(location.search).get("variant");
    if (qOpp === "online" && qSeed) {
      let resolvedVariant = qVariantRaw;
      if (!resolvedVariant) {
        if (qSeat === "you") {
          resolvedVariant = currentVariant();
        } else {
          const client = globalThis.__mechaClient;
          const lobbyRows = Array.from(client?.collections?.lobby?.state?.values?.() || []);
          const host = lobbyRows.find((r) => String(r.room_seed) === String(qSeed));
          if (host?.variant) {
            resolvedVariant = host.variant;
          } else {
            if (client?.collections?.lobby?.subscribeChanges && !screen.dataset.lobbySubscribedForOnline) {
              mark(screen, "lobbySubscribedForOnline");
              subscribe(client.collections.lobby, () => ensureOnlineMode());
            }
            return;
          }
        }
      }
      const qVariant = validateVariantForSeats(resolvedVariant, qSeats);
      const qOppName = new URLSearchParams(location.search).get("opp");
      const opp = qOppName || sessionStorage.getItem("truco-opponent-name") || "Adversário Online";
      if (!box || box.dataset.seed !== qSeed || box.dataset.opponent !== "online" || box.dataset.mySeat !== qSeat || box.dataset.seats !== qSeats || box.dataset.variant !== qVariant) {
        startOnlineMatch(qSeed, qSeat, opp, qSeats, qVariant);
      }
    }
  };

  const boot = () => {
    const box = $(".matchbox");
    for (const c of screen.querySelectorAll(".played .card")) {
      c.dataset.landed = "1";
    }
    adopt();
    ensureOnlineMode();
    render();
    updateInviteField();
    wireHand();
  };

  wireHand();
  wireTable();
  wireFlight();
  wireOnlineModal();
  wireSeatbarIdentity();

  let tries = 0;
  const settle = () => {
    if (!alive()) return;
    wireHand();
    if (adopt()) { boot(); ensureOnlineMode(); return; }
    if (tries++ < 50) { setTimeout(settle, 50); return; }
    boot();
    ensureOnlineMode();
  };
  settle();
  return dispose;
}
