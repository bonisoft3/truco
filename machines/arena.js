// arena — the local table: truco_match played by the terminal, as the handler
// Pronto composes over the machine's own rules (root.cue's `local` state).
//
// One fold drives the game, and everything it knows is rows. A click only
// records an intent; the mutation that raises wakes this fold, seated so no
// two of its runs overlap, and the fold applies the intent, lets the house
// move on the terminal's clock, and draws the felt from your seat's view. A
// game is seeded by the terminal's draw, kept on the table's row with the
// game itself, so it replays from its rows. You sit in seat "a".
//
// The same table seats an online match: when the cluster gives you a seat in
// one, its view is what the felt draws, from whichever seat is yours, and a
// gesture is a command row on the match rather than a step played here. What
// a player says there — the name the table knows them by, and their shouts —
// is their truco_voice's, never the match's, so banter never moves the game
// under a move.
(state, event, machine, machines) => {
  const rows = state.rows ?? {};
  const BEAT = 700;

  const LADDER = {paulista: [1, 3, 6, 9, 12], mineiro: [2, 4, 8, 10, 12], gaucho: [1, 2, 3, 4], argentino: [1, 2, 3, 4], uruguayo: [1, 2, 3, 4], paraguayo: [1, 2, 3, 4], truc: [1, 2, 3], douradinha: [2, 4, 8, 10, 12], douradao: [2, 4, 8, 10, 12]};
  const VOICE_OF = {paulista: "sp", mineiro: "mg", douradinha: "mg", douradao: "mg", gaucho: "rs", argentino: "ar", uruguayo: "uy", paraguayo: "py", truc: "ca"};
  const VOICE = {
    sp: {ladder: {3: "Truco!", 6: "Seis!", 9: "Nove!", 12: "Doze!"}, ran: "CORRI", accept: "CAI DENTRO!", we_won: "É NOSSA!", they_won: "LEVAMOS!"},
    mg: {ladder: {4: "Truco!", 8: "Seis!", 10: "Nove!", 12: "Doze!"}, ran: "CORRI, SÔ", accept: "CAI DENTRO, SÔ!", we_won: "É NÓIS, SÔ!", they_won: "LEVAMO, UAI!"},
    rs: {ladder: {2: "Truco!", 3: "Retruco!", 4: "Vale quatro!"}, ran: "CORRI, TCHÊ", accept: "QUERO, TCHÊ!", we_won: "É NOSSA, TCHÊ!", they_won: "LEVAMOS, BAH!"},
    ar: {ladder: {2: "¡Truco!", 3: "¡Retruco!", 4: "¡Vale cuatro!"}, ran: "ME VOY", accept: "¡QUIERO!", we_won: "¡ES NUESTRA!", they_won: "¡NOS LO LLEVAMOS!"},
    uy: {ladder: {2: "¡Truco!", 3: "¡Retruco!", 4: "¡Vale cuatro!"}, ran: "ME VOY", accept: "¡QUIERO!", we_won: "¡ES NUESTRA!", they_won: "¡NOS LO LLEVAMOS!"},
    py: {ladder: {2: "¡Truco!", 3: "¡Retruco!", 4: "¡Vale cuatro!"}, ran: "ME VOY", accept: "¡QUIERO!", we_won: "¡ES NUESTRA!", they_won: "¡NOS LO LLEVAMOS!"},
    ca: {ladder: {2: "Truc!", 3: "Retruc!"}, ran: "ME'N VAIG", accept: "VULL!", we_won: "ÉS NOSTRA!", they_won: "ENS L'ENDUEM!"},
  };
  const WORDS = {paulista: "vaza", mineiro: "rodada", gaucho: "vaza", truc: "basa", douradinha: "rodada", douradao: "rodada", argentino: "baza", uruguayo: "baza", paraguayo: "baza"};
  // A table with named trumps shows no vira; the truc has no trumps at all.
  const FIXED = ["mineiro", "gaucho", "argentino", "uruguayo", "paraguayo", "douradinha", "douradao"];
  const ORDER = {"1v1": ["you", "eles1"], "2v2": ["you", "eles1", "parca", "eles2"], "2v2v2": ["you", "eles1", "eles2", "parca", "eles3", "eles4"]};
  const SEATS = {"1v1": ["a", "b"], "2v2": ["a", "b", "c", "d"], "2v2v2": ["a", "b", "c", "d", "e", "f"]};
  const RANKS = ["4", "5", "6", "7", "Q", "J", "K", "A", "2", "3"];
  const SUITS = ["♦", "♠", "♥", "♣"];
  // What a table's code is spelled in, in its opener's language: plain words
  // with no accent, so a code reads aloud and types the same anywhere, and no
  // word in two lists, so a code's words name the list they came from.
  const TABLE_WORDS = {
    pt: [
      "zape", "copas", "espada", "ouros", "paus", "vira", "mao", "rodada", "truco", "seis", "nove", "doze", "mesa", "baralho", "carta", "valete",
      "dama", "reis", "cafe", "pao", "queijo", "leite", "milho", "feijao", "arroz", "bolo", "doce", "mel", "sal", "azeite", "pipoca", "pamonha",
      "cuscuz", "tapioca", "viola", "sanfona", "samba", "forro", "choro", "frevo", "xote", "baiao", "moda", "roda", "festa", "bloco", "sol", "lua",
      "mar", "rio", "lago", "serra", "campo", "mato", "praia", "ilha", "vento", "chuva", "nuvem", "neve", "raio", "trovao", "areia", "pedra", "gato",
      "cao", "boi", "vaca", "cavalo", "burro", "galo", "pato", "peixe", "sapo", "onca", "tatu", "arara", "tucano", "jacare", "macaco", "coruja",
      "gaviao", "sabia", "beija", "canario", "lobo", "raposa", "tigre", "leao", "urso", "zebra", "girafa", "camelo", "baleia", "polvo", "siri",
      "casa", "porta", "janela", "telhado", "quintal", "varanda", "cozinha", "sala", "quarto", "escada", "muro", "portao", "jardim", "horta", "banco",
      "praca", "rua", "ponte", "torre", "igreja", "feira", "mercado", "padaria", "boteco", "balcao", "copo", "garrafa", "jarra", "prato", "garfo",
      "faca", "colher", "panela", "chaleira", "caneca", "bule", "cesta", "balde", "vassoura", "rede", "chapeu", "bota", "sapato", "camisa", "saia",
      "vestido", "luva", "cinto", "bolsa", "mala", "anel", "colar", "relogio", "oculos", "lenco", "azul", "verde", "roxo", "rosa", "preto", "branco",
      "cinza", "dourado", "prata", "bronze", "laranja", "limao", "uva", "manga", "caju", "goiaba", "banana", "pera", "maca", "coco", "abacaxi",
      "melao", "melancia", "jaca", "acai", "pitanga", "amora", "cereja", "livro", "papel", "lapis", "caneta", "tinta", "quadro", "mapa", "selo",
      "jornal", "radio", "violao", "tambor", "flauta", "apito", "sino", "gaita", "piano", "trem", "barco", "navio", "aviao", "bicicleta", "carro",
      "moto", "onibus", "trator", "carroca", "pipa", "bola", "peteca", "piao", "boneca", "balanco", "gangorra", "alegre", "bravo", "calmo", "esperto",
      "forte", "ligeiro", "sereno", "valente", "feliz", "gentil", "sabido", "manha", "tarde", "noite", "aurora", "domingo", "sabado", "verao",
      "outono", "inverno", "fogo", "brasa", "lenha", "fumaca", "vela", "lampiao", "farol", "estrela", "cometa", "planeta", "pomba", "grilo", "abelha",
      "formiga", "cigarra", "ovo", "nata", "broa", "angu", "mate", "trilha", "sitio", "fazenda"
    ],
    es: [
      "envido", "flor", "quiero", "retruco", "vale", "cuatro", "naipe", "mazo", "basto", "oro", "espadas", "ancho", "siete", "sota", "caballo", "rey",
      "yerba", "termo", "bombilla", "asado", "parrilla", "chorizo", "empanada", "alfajor", "dulce", "tortilla", "queso", "manteca", "harina", "huevo",
      "vino", "cerveza", "agua", "jugo", "tomate", "cebolla", "papa", "batata", "zapallo", "choclo", "garbanzo", "lenteja", "poroto", "durazno",
      "ciruela", "naranja", "limon", "frutilla", "sandia", "melon", "manzana", "higo", "nuez", "almendra", "luna", "cielo", "nube", "lluvia",
      "viento", "nieve", "trueno", "rayo", "piedra", "roca", "monte", "cerro", "valle", "llanura", "pampa", "selva", "bosque", "arroyo", "laguna",
      "playa", "isla", "puerto", "bahia", "costa", "perro", "toro", "oveja", "cabra", "gallo", "gallina", "ganso", "cerdo", "conejo", "zorro", "puma",
      "jaguar", "ciervo", "liebre", "carpincho", "hornero", "zorzal", "loro", "cotorra", "paloma", "gorrion", "aguila", "halcon", "lechuza", "buho",
      "tortuga", "rana", "lagarto", "culebra", "pez", "trucha", "dorado", "puerta", "ventana", "techo", "patio", "pared", "escalera", "comedor",
      "dormitorio", "sillon", "silla", "cama", "almohada", "manta", "espejo", "reloj", "lampara", "calle", "plaza", "esquina", "barrio", "pueblo",
      "ciudad", "camino", "ruta", "iglesia", "almacen", "boliche", "vereda", "vaso", "botella", "plato", "tenedor", "cuchillo", "cuchara", "olla",
      "sarten", "tetera", "taza", "canasta", "escoba", "hamaca", "sombrero", "gorra", "zapato", "pollera", "guante", "cinturon", "valija", "anillo",
      "anteojos", "rojo", "amarillo", "negro", "blanco", "gris", "plateado", "marron", "celeste", "violeta", "rosado", "libro", "lapiz", "diario",
      "guitarra", "bombo", "quena", "charango", "bandoneon", "acordeon", "avion", "auto", "colectivo", "carreta", "barrilete", "pelota", "trompo",
      "tobogan", "tranquilo", "pillo", "fuerte", "ligero", "valiente", "amable", "sabio", "noche", "alba", "verano", "invierno", "primavera",
      "lucero", "mesero", "patron", "fiesta", "baile", "tango", "milonga", "chacarera", "zamba", "cueca", "payador", "gaucho", "poncho", "facon",
      "recado", "tropilla", "potro", "tropero", "chacra", "estancia", "rancho", "galpon", "tranquera", "molino", "aljibe", "nogal", "ombu", "sauce",
      "pino", "roble", "tala", "cardo", "trebol", "ortiga", "margarita", "clavel", "jazmin", "hielo", "arcoiris", "neblina", "rocio", "helada",
      "tormenta", "brisa", "ola", "marea", "cuero", "lana", "hilo", "aguja", "boton", "tijera", "cuerda", "soga", "cadena", "llave", "candado"
    ],
    ca: [
      "truc", "envit", "vull", "retruc", "baralla", "copes", "bastos", "cavall", "formatge", "llet", "ou", "vi", "aigua", "cervesa", "pernil",
      "botifarra", "fuet", "coca", "crema", "nou", "ametlla", "avellana", "poma", "taronja", "llimona", "maduixa", "cirera", "pruna", "figa", "lluna",
      "estel", "cel", "pluja", "vent", "neu", "tro", "llamp", "sorra", "muntanya", "vall", "plana", "bosc", "riera", "estany", "platja", "illa",
      "badia", "gos", "gat", "bou", "ovella", "gall", "oca", "porc", "conill", "guineu", "llop", "llebre", "esquirol", "gripau", "granota",
      "sargantana", "serp", "peix", "truita", "finestra", "teulada", "pati", "paret", "escala", "cuina", "menjador", "cambra", "cadira", "llit",
      "mirall", "rellotge", "llum", "espelma", "foc", "llenya", "carrer", "cantonada", "barri", "poble", "ciutat", "pont", "mercat", "botiga",
      "taverna", "got", "ampolla", "gerra", "plat", "forquilla", "ganivet", "cullera", "paella", "tassa", "cistell", "galleda", "escombra", "barret",
      "sabata", "faldilla", "vestit", "guant", "bossa", "maleta", "anell", "collaret", "ulleres", "mocador", "blau", "verd", "vermell", "groc",
      "negre", "blanc", "daurat", "platejat", "lila", "llibre", "paper", "llapis", "quadre", "segell", "diari", "gralla", "timbal", "flabiol",
      "tenora", "sardana", "castell", "gegant", "drac", "vaixell", "cotxe", "autobus", "pilota", "baldufa", "nina", "gronxador", "valent", "tranquil",
      "fort", "lleuger", "savi", "tarda", "nit", "diumenge", "dissabte", "estiu", "tardor", "hivern", "far", "masia", "hort", "pou", "era", "graner",
      "cup", "celler", "porro", "rossinyol", "merla", "puput", "oreneta", "pardal", "colom", "gavina", "mussol", "pi", "alzina", "roure", "olivera",
      "garrofer", "vinya", "ametller", "figuera", "gel", "boira", "rosada", "calamarsa", "onada", "corda", "fil", "agulla", "tisora", "clau",
      "cadenat", "guix", "pissarra", "quadern", "regle", "motxilla", "blat", "ordi", "civada", "avi", "amic", "xemeneia", "ermita", "campanar",
      "coll", "cim", "turo", "barca", "rem", "xarxa", "ham", "llamborda", "carrero", "patata", "ceba", "alberginia", "carbassa", "pebrot", "enciam",
      "cargol", "musclo", "sardina", "anxova", "tonyina", "dimarts", "dijous", "divendres", "gener", "febrer", "abril", "maig", "juny", "juliol",
      "agost", "octubre", "novembre", "desembre", "isard", "cabirol", "senglar", "mostela", "voltor", "cigne", "abella", "papallona", "marieta",
      "cuc", "aranya", "escarabat", "llagosta", "cranc", "pop", "calamar", "torrada", "galeta", "xocolata"
    ],
  };
  const TABLE_LANGUAGES = Object.keys(TABLE_WORDS);

  // How each persona bets: the hand strength (0–11) it calls a truco on and
  // the one it takes a call on, and whether it gives a tell a beat before.
  const CAST = {
    nezinho: {call: 8.6, take: 7.4, tell: true}, cida: {call: 7.2, take: 6.4, tell: true}, tiao: {call: 6.6, take: 6.0, tell: true},
    ze: {call: 9.2, take: 8.0, tell: true}, xiru: {call: 8.4, take: 7.2, tell: true}, osvaldo: {call: 8.2, take: 7.0, tell: true},
    tiao_queijo: {call: 8.0, take: 6.8, tell: true}, tabare: {call: 8.5, take: 7.1, tell: true}, jordi: {call: 8.3, take: 7.3, tell: true},
  };
  // Your partner plays a strategy rather than a character, and has no tell.
  const PARTNER = {call: 8.0, take: 7.0, tell: false};
  const RETORTS = {
    nezinho: ["Pode vir quente que o café tá pronto!", "Aqui se joga com a alma, meu filho!", "Cuidado com o gato na tuba!", "Quem tem garrafa pra vender fala agora!"],
    cida: ["Não vem de garfo que hoje é sopa, meu bem!", "Bate na mesa que a madeira é forte!", "Cê guenta a pressão?", "Quero ver no final da rodada!"],
    tiao: ["Segura esse pagode, seu moço!", "Chora viola, que o jogo esquentou!", "É nóis na fita!", "Se gritar mais alto a cerveja esquenta!"],
    ze: ["Zé só balança a cabeça…", "Mostra o que tem na mão.", "Menos barulho, mais jogo.", "A mesa cobra o que promete."],
    xiru: ["Mas bah, te apruma vivente!", "O pala tá voando!", "Sustenta o tirão!", "Aqui não tem choro nem vela, tchê!"],
    osvaldo: ["¡Abran cancha que viene la buena!", "¡No te achiques ahora!", "¡Metéle candela!", "¡El truco se juega con coraje!"],
    tiao_queijo: ["Passa o queijo e joga a carta, uai!", "Trem bão é jogo disputado!", "Cuidado com o tombo, sô!", "Aqui mineiro não perde o trem!"],
    tabare: ["¡Vamo' arriba la celeste!", "¡Garra y corazón, bo!", "¡Tranquilo y con calma!", "¡No apures el mate!"],
    jordi: ["Val més maña que força, noi!", "Au va, tira que fa tard!", "A poc a poc i bona lletra!", "Qui no arrisca no pisca!"],
  };
  // What a click asks for; a card in your hand asks to be played.
  const INTENT = {
    "btn-truco": "raise", "btn-raise": "raise", "btn-accept": "accept", "btn-run": "fold",
    "btn-envido": "envido", "btn-envido-real": "envido_real", "btn-envido-falta": "envido_falta",
    "btn-envido-take": "envido_take", "btn-envido-run": "envido_run", "btn-flor": "flor",
    "btn-brink-play": "accept", "btn-brink-run": "fold", "btn-next": "next", "btn-resign": "resign",
    "btn-again": "again", "btn-start": "again", "btn-encobrir": "encobrir",
    "shout-chama": "shout_chama", "shout-manda": "shout_manda", "shout-desce": "shout_desce", "shout-chorou": "shout_chorou",
  };

  /* --- the game, from its row ---------------------------------------------- */

  // A stream from the game's recorded seed (mulberry32): every deal's entropy
  // and every retort follow from it, so the same draw replays the same game.
  const prng = seed => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const expand = (seed, revision) => {
    const draw = prng(Number(seed) + revision * 7919);
    return Array.from({length: 128}, () => Math.floor(draw() * 256).toString(16).padStart(2, "0")).join("");
  };
  const table = (rows.match ?? []).find(m => m.id === "table");
  const game = table?.game ? JSON.parse(table.game) : null;
  const picked = {variant: table?.variant ?? "mineiro", seating: table?.seats ?? "1v1", opponent: table?.opponent ?? "nezinho"};
  const context = (g, actor, tier = "omnishell") => ({actor, tier, now: 0, entropy: expand(g.seed, g.revision)});
  const viewsOf = g => Object.fromEntries(machine.execute({state: g.state, event: null, context: context(g, "a"), viewers: SEATS[g.seating]}).views.map(v => [v.viewer, v.value]));
  // An event the game takes, or null where its rules refuse it.
  const apply = (g, kind, payload, as, tier = "omnishell") => {
    const answer = machine.execute({state: g.state, event: {kind, payload}, context: context(g, as, tier), viewers: SEATS[g.seating]});
    return answer.kind === "accepted" ? {...g, revision: g.revision + 1, state: answer.state} : null;
  };
  const beat = (g, kind, delay, extra = {}) => ({type: "beat", delay, with: {game: g.id, revision: g.revision, kind, ...extra}});
  // A step that ends the hand on a run, with the score it stood at held over
  // it until the paid beat; any other step as it came.
  const heard = (before, after) => after.state.result !== "" && before.state.result === "" && after.state.log.at(-1)?.kind === "fold"
    ? {...after, face: {...after.face, unpaid: {revision: after.revision, a: before.state.score_a, b: before.state.score_b, c: before.state.score_c}}}
    : after;

  /* --- the house ------------------------------------------------------------ */

  const sideOf = (view, seat) => "abc"[view.seats.indexOf(seat) % (view.seating === "2v2v2" ? 3 : 2)];
  // A plain card counts its rank (1–10) and a trump the top of the scale; a
  // table without trumps is stretched to meet the personas' one scale.
  const strength = (view, slots) => {
    const points = slots.map(slot => Math.min(view.powers[slot] >= 50 ? 11 : view.powers[slot] + 1, 11));
    return points.reduce((a, b) => a + b, 0) / Math.max(1, points.length) * (view.variant === "truc" ? 11 / 10 : 1);
  };
  // The envido read on the same personas: their truco threshold against the
  // envido's ceiling of thirty-three.
  const counts = threshold => Math.round(threshold / 11 * 33);
  // The seat that has something to decide. A bot on your side plays its own
  // cards but never answers for the side: a call, an envido or a brink owed
  // by your side is yours.
  const nextSeat = views => {
    for (const seat of views.a.seats) {
      const view = views[seat];
      if (seat === "a") continue;
      const answers = ["accept", "envido_take"].some(kind => view.actions.includes(kind));
      if (view.actions.includes("play") || (answers && sideOf(view, seat) !== "a")) return {seat, view};
    }
    return null;
  };
  // What the seat says, reading only its own view: {kind, payload, tell}.
  const choose = (view, persona) => {
    const can = kind => view.actions.includes(kind);
    const own = strength(view, view.available);
    if (can("envido_take")) {
      if (can("flor")) return {kind: "flor", payload: {}};
      if (can("envido_real") && view.envido >= counts(persona.call) + 3) return {kind: "envido_real", payload: {}};
      return {kind: view.envido >= counts(persona.take) ? "envido_take" : "envido_run", payload: {}};
    }
    if (view.phase === "brink") return {kind: own >= persona.take ? "accept" : "fold", payload: {}};
    if (can("accept")) {
      if (can("envido") && view.envido >= counts(persona.call)) return {kind: "envido", payload: {}};
      return {kind: own >= persona.take ? "accept" : "fold", payload: {}};
    }
    if (!can("play")) return null;
    if (can("flor")) return {kind: "flor", payload: {}};
    if (can("envido") && view.envido >= counts(persona.call)) return {kind: "envido", payload: {}, tell: persona.tell};
    if (can("raise") && own >= persona.call) return {kind: "raise", payload: {}, tell: persona.tell};
    // Lowest card that wins the trick so far, else the lowest; a mão de
    // ferro is played blind, in the order it was dealt.
    const toBeat = Math.max(-1, ...view.plays.filter(p => p.trick === view.tricks.length).map(p => p.power));
    if (view.brink === "both") return {kind: "play", payload: {slot: view.available[0], covered: false}};
    const ranked = view.available.slice().sort((x, y) => view.powers[x] - view.powers[y]);
    return {kind: "play", payload: {slot: ranked.find(s => view.powers[s] > toBeat) ?? ranked[0], covered: false}};
  };
  const houseMove = (g, views) => {
    const turn = nextSeat(views);
    if (turn === null) return null;
    const ours = sideOf(turn.view, turn.seat) === "a";
    const cast = ours ? "bigode" : g.opponent;
    const move = choose(turn.view, ours ? PARTNER : CAST[g.opponent] ?? PARTNER);
    return move === null ? null : {...move, seat: turn.seat, cast, answering: !turn.view.actions.includes("play")};
  };

  /* --- the felt ------------------------------------------------------------- */

  const card = c => {
    if (c === 40) return {card: "★", rank: "★", suit: "", face: "★"};
    const rank = RANKS[Math.floor(c / 4)];
    const suit = SUITS[c % 4];
    return {card: rank + suit, rank, suit, face: "QJK".includes(rank) ? rank : suit};
  };
  const back = {card: "back", rank: "", suit: "", face: ""};
  // Cards thrown on a table do not land square, and the same card always lies the same way.
  const lieOf = name => {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.codePointAt(0)) % 997;
    return String((h % 15) - 7);
  };
  const strengthOf = power => String(Math.max(0, Math.min(100, power)));
  const txt = value => String(value);

  // The rows your seat's view draws: the table's row, the hand, the cards and
  // the log, writing only what differs from what the felt already holds.
  const draw = (g, created) => {
    const view = g.online ? g.view : viewsOf(g).a;
    const me = g.online ? g.seat : "a";
    const face = g.face;
    const variant = g.variant;
    const ladder = LADDER[variant];
    const voice = VOICE[VOICE_OF[variant]];
    const order = ORDER[g.seating];
    // Everything is drawn from your seat: yours is you, and the table turns
    // with it, as your side is us, the next them and a third others.
    const teams = view.seating === "2v2v2" ? 3 : 2;
    const mine = sideOf(view, me);
    const relOf = s => s && "abc".includes(s) ? ["us", "them", "others"][("abc".indexOf(s) - "abc".indexOf(mine) + teams) % teams] : undefined;
    const sideAt = k => "abc"[("abc".indexOf(mine) + k) % teams];
    const at = seat => order[(view.seats.indexOf(seat) - view.seats.indexOf(me) + view.seats.length) % view.seats.length];
    const side = seat => relOf(sideOf(view, seat));
    const told = face.told !== null && face.told.revision === g.revision ? face.told.line : "";
    // A hand that ends on a run is heard before it is paid: the score stands
    // where it was until the paid beat.
    const unpaid = face.unpaid !== undefined && face.unpaid !== null && face.unpaid.revision === g.revision ? face.unpaid : null;

    const finished = view.phase === "finished";
    const winner = finished ? relOf(view.winner) ?? "" : "";
    const others = teams === 3 ? sideAt(2) : "c";
    const matchRow = {
      ...(created ? {variant, seats: g.seating, opponent: g.opponent, theme: table?.theme ?? "xadrez", locale: table?.locale ?? "", partner_name: "Bigode", my_seat: "you"} : {}),
      id: "table", us_score: txt(unpaid?.[mine] ?? view[`score_${mine}`]), them_score: txt(unpaid?.[sideAt(1)] ?? view[`score_${sideAt(1)}`]), others_score: txt(unpaid?.[others] ?? view[`score_${others}`]),
      stake: txt(view.stake), hand_no: txt(view.hand_no), status: finished ? "over" : "playing", winner,
      opponent_name: g.online ? "opponent_online" : `opponent_${g.opponent}`, opponent_handle: g.online ? g.opponent_name : "",
      filled: g.online && view.hand_no === 1 && view.plays.length === 0 && view.log.length === 0 ? "yes" : "",
      tavern_key: `tavern_${["douradinha", "douradao"].includes(variant) ? "mineiro" : variant === "paraguayo" ? "argentino" : variant}`,
      current: "yes", seed: g.seed, game: JSON.stringify(g),
    };

    const roundId = `${g.id}/h${view.hand_no}`;
    const log = view.log;
    // Total over the view: a phase names the entry that brought it, and a
    // view with none is read as nobody's rather than refused.
    const NOBODY = {seat: "", kind: "", count: 0, at: 0};
    const lastOf = kinds => log.filter(entry => kinds.includes(entry.kind)).at(-1) ?? NOBODY;
    const brinkHand = view.brink !== "";
    const rung = view.phase === "wager" ? view.offer : brinkHand ? 0 : ladder[ladder.indexOf(view.stake) + 1] ?? 0;
    const asked = view.phase === "wager" ? at(lastOf(["raise"]).seat) : "";
    const fold = lastOf(["fold"]);
    const result = view.result === "" ? "" : view.result === "draw" ? "draw" : relOf(view.result) ?? "";
    const verdicts = [0, 1, 2].map(i => view.tricks[i] === undefined ? "" : view.tricks[i] === "tie" ? "tie" : relOf(view.tricks[i]));
    const call = lastOf(["envido", "envido_real", "envido_falta"]);
    const envido = view.phase === "envido" ? "called" : {accepted: "scored", refused: "ran", flor: "flor"}[view.envido_done] ?? "";
    const envidoResult = view.envido_done === "accepted" ? relOf((view.envido_scores.at(-1) ?? {side: ""}).side)
      : view.envido_done === "refused" ? side(call.seat)
      : view.envido_done === "flor" ? side(lastOf(["flor"]).seat) : "";
    const shown = team => view.envido_scores.find(score => score.side === team)?.count ?? 0;
    const chain = view.envido_chain;
    const envidoRung = chain.includes("envido_falta") ? view.goal - Math.max(view.score_a, view.score_b) : chain.reduce((sum, kind) => sum + (kind === "envido" ? 2 : 3), 0);
    const can = kind => view.actions.includes(kind);
    const calls = [
      can("envido") ? "envido" : "", can("envido_real") ? "real" : "", can("envido_falta") ? "falta" : "",
      can("flor") ? "flor" : "", can("envido_take") ? "answer" : "", view.phase === "brink" && can("accept") ? "brink" : "",
    ].filter(Boolean).join(" ");
    const inTrick = view.plays.filter(p => p.trick === view.tricks.length).length;

    // The one line the table says, as a message key; a line the dealer says
    // over it — a tell, a persona's call, a retort — stands for its revision.
    const line = () => {
      if (told) return told.startsWith("call_") ? `call_${VOICE_OF[variant]}_${told.slice(5)}` : told;
      if (view.phase === "waiting") return "waiting_opponent";
      if (result !== "") return unpaid !== null ? (brinkHand ? `brink_ran_${side(fold.seat)}` : "ran")
        : result === "draw" ? "draw_hand" : result === "us" ? "you_won_hand" : "they_won_hand";
      if (view.phase === "brink") return `brink_${variant}_${relOf(view.brink) ?? view.brink}`;
      if (view.phase === "wager") return `rung_${variant}_${view.offer}`;
      if (view.phase === "envido") return call.kind;
      const last = log.at(-1);
      if (last && last.at === view.plays.length) {
        if (last.kind === "accept") return brinkHand ? `brink_played_${side(last.seat)}` : "worth";
        if (["envido_take", "envido_count", "envido_good"].includes(last.kind)) return "envido_took";
        if (last.kind === "envido_run") return "envido_ran";
        if (last.kind === "flor") return "flor";
      }
      if (view.tricks.length > 0 && inTrick === 0) {
        const trick = WORDS[variant];
        const verdict = verdicts[view.tricks.length - 1];
        return verdict === "tie" ? `Empatou a ${trick}.` : `${trick.charAt(0).toUpperCase()}${trick.slice(1)} ${verdict === "us" ? "sua" : "deles"}.`;
      }
      if (view.plays.length === 0 && log.length === 0) {
        const foot = view.seats[(view.seats.indexOf(view.leader) + view.seats.length - 1) % view.seats.length];
        return view.leader === me ? "lead_your_turn" : foot === me ? "foot_starts" : "starts";
      }
      return view.turn === me ? "your_turn" : "turn_of";
    };
    // What the table shouts; a new word is a new shout.
    const shout = (() => {
      if (finished) return {word: winner === "us" ? voice.we_won : voice.they_won, from: winner || "them", kind: "close", state: "live", seat: ""};
      // A shout heard across an online table is the other seat's, said from where it sits.
      if (face.quick !== null && face.quick.live) {
        const theirs = face.quick.from === "them";
        return {word: face.quick.word, from: theirs ? "them" : "us", kind: "quick", state: face.quick.live ? "live" : "gone", seat: theirs ? at(face.quick.seat) : "you"};
      }
      if (view.phase === "wager") return {word: (voice.ladder[view.offer] ?? "TRUCO!").toUpperCase(), from: side(lastOf(["raise"]).seat), kind: "call", state: "live", seat: asked};
      if (fold.kind === "fold" && fold.at === view.plays.length) return {word: voice.ran, from: side(fold.seat), kind: "run", state: face.runHushed === g.revision ? "gone" : "live", seat: ""};
      if (result === "us" || result === "them") return {word: result === "us" ? voice.we_won : voice.they_won, from: result, kind: "win", state: "live", seat: ""};
      const last = log.at(-1);
      if (last && last.kind === "accept" && last.at === view.plays.length && !brinkHand) return {word: voice.accept, from: side(last.seat), kind: "accept", state: "live", seat: ""};
      return null;
    })();
    const previous = (rows.round ?? []).find(r => r.id === roundId);
    const word = shout?.word ?? previous?.shout_word ?? "";
    const said = line();
    const ownTurn = can("play") || calls.split(" ").includes("brink");
    const nextRung = ladder[ladder.indexOf(Number(rung)) + 1] ?? 0;
    const quick = shout?.kind === "quick" && shout.state === "live";
    const newQuick = quick && face.quick.t !== game?.face.quick?.t;
    const shoutFrom = shout?.from ?? previous?.shout_from ?? "";
    const shoutKind = shout?.kind ?? previous?.shout_kind ?? "";
    const shoutT = previous === undefined ? 0 : Number(previous.shout_t ?? 0) + (newQuick || word !== previous.shout_word || shoutFrom !== previous.shout_from || shoutKind !== previous.shout_kind ? 1 : 0);
    const roundRow = {
      id: roundId, match_id: "table", hand_no: txt(view.hand_no),
      vira: view.vira < 0 ? "" : card(view.vira).card,
      manilha: variant === "truc" ? "nenhuma" : FIXED.includes(variant) ? "fixas" : RANKS[(Math.floor(view.vira / 4) + 1) % RANKS.length],
      phase: result !== "" ? "result" : view.tricks.length === 0 ? "dealt" : ["v1", "v2", "v3"][Math.min(view.tricks.length, 2)],
      ran: fold.kind === "fold" ? side(fold.seat) : "", v1: verdicts[0], v2: verdicts[1], v3: verdicts[2],
      stake: txt(view.stake), result, said,
      felt_phase: finished ? "over" : result ? "resolved" : view.phase === "wager" && can("accept") ? "raised" : ownTurn ? "your-turn" : "waiting",
      truco_label: can("raise") ? `felt_call_${VOICE_OF[variant]}_${rung}` : view.right === mine ? "felt_raise_them" : !rung ? "felt_at_max" : "felt_their_turn",
      truco_title: view.right === mine ? "felt_title_ours" : ownTurn ? "felt_title_raise" : "felt_title_not_yours",
      truco_blocked: can("raise") ? "" : "disabled",
      raise_label: nextRung ? `felt_call_${VOICE_OF[variant]}_${nextRung}` : "felt_at_max", raise_hint: nextRung ? "felt_raise_to" : "felt_ceiling", raise_blocked: can("raise") && nextRung ? "" : "disabled", next_rung: txt(nextRung),
      name_key: g.online ? "" : `opponent_${g.opponent}`, name_handle: g.online ? g.opponent_name : "", worth: txt(asked ? rung : view.stake),
      opponent_name: matchRow.opponent_name, opponent_handle: matchRow.opponent_handle, opponent: g.opponent,
      dialogue_key: quick && shout.from === "them" ? shout.word : g.online ? "" : /^(tell_|call_|retort_)/.test(said) || told ? said : `idle_${g.opponent}`,
      dialogue_state: !g.online || quick && shout.from === "them" ? "live" : "gone",
      player_shout_state: quick && shout.seat === "you" ? "yes" : "no",
      over_key: finished ? winner === "us" ? "felt_match_yours" : "felt_match_theirs" : "",
      tell: said.startsWith("tell_") ? g.opponent : "",
      said_t: previous?.said === said ? previous.said_t ?? "0" : previous?.said_t === "1" ? "2" : "1",
      leader: at(view.leader), asked, raised: relOf(view.right) ?? "", rung: txt(rung),
      brink: view.brink === "both" ? "both" : relOf(view.brink) ?? "",
      envido, envido_asked: view.phase === "envido" ? at(call.seat) : "", envido_rung: txt(envidoRung), envido_calls: calls,
      envido_us: txt(shown(mine)), envido_them: txt(shown(sideAt(1))), envido_result: envidoResult ?? "",
      shout_word: word, shout_from: shoutFrom, shout_kind: shoutKind,
      shout_state: shout?.state ?? "gone", shout_seat: shout?.seat ?? "",
      shout_t: txt(shoutT), shout_anim: txt(shoutT % 2 + 1),
      shout_done: shout?.state === "live" ? "no" : "yes",
      oculta: face.oculta ? "yes" : "no",
      turn_seat: view.phase === "playing" ? at(view.turn) : "",
      current: "yes",
    };

    const held = [];
    for (const slot of view.available) {
      held.push({
        id: `${roundId}/you/${slot}`, round_id: roundId, seat: "you", ...(view.hand[slot] < 0 ? back : card(view.hand[slot])),
        power: strengthOf(view.powers[slot]), manilha: view.powers[slot] >= 50 ? "yes" : "no", slot: txt(slot),
        blocked: can("play") ? "" : "disabled", display_seat: "you", current: "yes",
      });
    }
    // Everyone else's cards are backs, but for a partner's on your side's brink.
    for (const {seat, count} of view.counts) {
      if (seat === me) continue;
      const open = view.partners.find(p => p.seat === seat)?.hand.filter(c => c >= 0) ?? [];
      for (let slot = 0; slot < count; slot += 1) {
        held.push({
          id: `${roundId}/${at(seat)}/${slot}`, round_id: roundId, seat: at(seat), ...(open[slot] === undefined ? back : card(open[slot])),
          power: "0", manilha: "no", slot: txt(slot), blocked: "disabled", display_seat: at(seat), current: "yes",
        });
      }
    }
    // The hand's log: what was said and what was laid, in the order it happened.
    const spoken = entry => {
      const team = side(entry.seat);
      if (entry.kind === "raise") return {kind: "truco", said: `rung_${variant}_${ladder[log.filter(e => e.kind === "raise").indexOf(entry) + 1]}`};
      if (entry.kind === "accept") return brinkHand ? {kind: "brink_play", said: `brink_played_${team}`} : {kind: "accept", said: "took"};
      if (entry.kind === "fold") return {kind: "run", said: brinkHand ? `brink_ran_${team}` : "ran"};
      if (entry.kind === "envido_take") return {kind: "envido_take", said: "envido_took"};
      if (entry.kind === "envido_run") return {kind: "envido_run", said: "envido_ran"};
      if (entry.kind === "envido_count") return {kind: "envido_count", said: "", count: txt(entry.count)};
      return {kind: entry.kind, said: entry.kind};
    };
    const plays = [];
    const add = row => {
      const seq = txt(plays.length).padStart(2, "0");
      plays.push({...row, id: `${roundId}/${seq}`, round_id: roundId, seq});
    };
    const trickAt = index => Math.min((view.plays[index]?.trick ?? view.tricks.length) + 1, 3);
    for (let i = 0; i <= view.plays.length; i += 1) {
      for (const entry of log.filter(e => e.at === i)) {
        add({vaza: txt(trickAt(i)), seat: at(entry.seat), display_seat: at(entry.seat), card: "", count: "", power: "0", win: "", ...spoken(entry)});
      }
      const p = view.plays[i];
      if (p === undefined) continue;
      const named = p.card < 0 ? {card: "", rank: "", suit: "", face: ""} : card(p.card);
      add({
        vaza: txt(p.trick + 1), seat: at(p.seat), display_seat: at(p.seat), kind: "card", count: "", ...named,
        power: strengthOf(p.power), said: p.covered ? "encoberta" : "", manilha: p.power >= 50 ? "yes" : "no", from_slot: txt(p.slot),
        lie: lieOf(named.card || `${p.seat}${i}`), win: p.win ? "yes" : "",
      });
    }

    const updates = [];
    const write = (entity, row) => {
      const prior = (rows[entity] ?? []).find(r => r.id === row.id);
      if (prior === undefined) {
        updates.push({op: "put", entity, id: row.id, row});
        return;
      }
      const changed = Object.fromEntries(Object.entries(row).filter(([key, value]) => String(prior[key] ?? "") !== String(value)));
      if (Object.keys(changed).length) updates.push({op: "patch", entity, id: row.id, row: changed});
    };
    const retire = (entity, keep) => {
      for (const r of rows[entity] ?? []) if (r.current === "yes" && !keep.includes(r.id)) updates.push({op: "patch", entity, id: r.id, row: {current: "no"}});
    };
    retire("match", ["table"]);
    write("match", matchRow);
    retire("round", [roundId]);
    write("round", roundRow);
    retire("held", held.map(h => h.id));
    for (const row of held) write("held", row);
    for (const row of plays) write("play", row);
    return updates;
  };

  /* --- an online table -------------------------------------------------------- */

  // A table's code — three words and a slug — is its room's id spelled out,
  // so the code is all a friend needs and no lookup stands between them.
  // Tables are never removed, so no two may share a code: three words alone
  // would meet again after a few thousand tables, and the slug's twenty bits
  // put that past millions.
  const SLUG = "0123456789abcdefghjkmnpqrstvwxyz";
  // The room's last group opens with the list's place, then the three words'
  // places and the slug.
  const CODED = "7275636f-6d65-4573-8a00-";
  const roomAt = (language, at, slug) => CODED + TABLE_LANGUAGES.indexOf(language).toString(16) +
    at.map(i => i.toString(16).padStart(2, "0")).join("") + slug.toString(16).padStart(5, "0");
  const roomOf = code => {
    const m = /^([a-z]+)-([a-z]+)-([a-z]+)-([0-9a-z]{4})$/.exec(code.trim().toLowerCase());
    if (m === null || [...m[4]].some(c => !SLUG.includes(c))) return null;
    const language = TABLE_LANGUAGES.find(l => [m[1], m[2], m[3]].every(w => TABLE_WORDS[l].includes(w)));
    if (language === undefined) return null;
    return roomAt(language, [m[1], m[2], m[3]].map(w => TABLE_WORDS[language].indexOf(w)), [...m[4]].reduce((n, c) => n * 32 + SLUG.indexOf(c), 0));
  };
  const codeOf = room => {
    const hex = room.slice(CODED.length);
    const words = TABLE_WORDS[TABLE_LANGUAGES[parseInt(hex[0], 16)]];
    const slug = parseInt(hex.slice(7), 16);
    return [...[1, 3, 5].map(i => words[parseInt(hex.slice(i, i + 2), 16)]), [3, 2, 1, 0].map(k => SLUG[Math.floor(slug / 32 ** k) % 32]).join("")].join("-");
  };
  // The bar shows the code of the table waiting for you, and none once it fills.
  const spelled = room => room.startsWith(CODED) && TABLE_LANGUAGES[parseInt(room[CODED.length], 16)] !== undefined;
  const coded = g => {
    const code = g !== null && g.online && g.view.phase === "waiting" && spelled(g.room) ? codeOf(g.room) : "";
    return tab === undefined || (tab.code ?? "") === code ? [] : [{op: "patch", entity: "lobby_tab", id: "the", row: {code}}];
  };

  const seatRows = rows.truco_match_seat ?? [];
  const commands = rows.truco_match_command ?? [];
  const tab = (rows.lobby_tab ?? []).find(t => t.id === "the");
  const handle = ((rows.player ?? []).find(p => p.id === "you")?.handle ?? "").trim();
  const voice = (rows.truco_voice_seat ?? [])[0];
  const voiceCommands = rows.truco_voice_command ?? [];
  // A table's voices are known by its talk, which only its seats are shown.
  const voices = talk => (rows.truco_voice_public ?? []).filter(v => v.talk === talk);
  // The one the felt names across from you is the seat after yours, an
  // opponent in every seating: the one after that may be your partner.
  const nameAt = (talk, seating, seat) => {
    const seats = SEATS[seating];
    const across = seats[(seats.indexOf(seat) + 1) % seats.length];
    return voices(talk).find(v => v.seat === across)?.name ?? "";
  };
  // Each seat's shouts are counted by its voice, so the same word twice is two
  // shouts. A voice first seen here sets where its count was: what it shouted
  // before sitting at this table was said at another.
  const shoutOf = g => {
    const heard = {...g.face.heard};
    let quick = g.face.quick;
    for (const v of voices(g.view.talk)) {
      const n = Number(v.n);
      if (heard[v.seat] !== undefined && n > heard[v.seat] && v.word !== "") {
        quick = {word: `shout_${v.word}`, t: (g.face.quick?.t ?? 0) + 1, live: true, from: v.seat === g.seat ? "us" : "them", seat: v.seat};
      }
      heard[v.seat] = n;
    }
    return {...g.face, heard, quick};
  };
  const seated = (row, back) => {
    const view = row.view;
    const g = {
      id: `o${row.instance_id}`, online: true, room: row.instance_id, seat: row.seat, version: machine.spec.version,
      variant: view.variant, seating: view.seating, opponent: "online", opponent_name: nameAt(view.talk, view.seating, row.seat), seed: "0",
      revision: Number(row.revision), view, back, face: {told: null, quick: null, oculta: false, shouts: 0, heard: {}},
    };
    return {...g, face: {...shoutOf(g), quick: null}};
  };
  const caught = (g, row) => {
    const view = row.view;
    return {...g, revision: Number(row.revision), view, opponent_name: nameAt(view.talk, view.seating, g.seat), face: shoutOf(g)};
  };
  // Your voice: opened once, the first time a match seats you, and sat at
  // each table you play with the name you go by there.
  const rise = () => voice !== undefined && voice.view.phase === "seated" ? speak("rise", {}) : [];
  const speak = (kind, payload, tag = kind) => {
    const id = `${voice.instance_id}/${voice.revision}/${voice.seat}/${tag}`;
    if (voiceCommands.some(c => c.id === id)) return [];
    const request = {version: machines.truco_voice.spec.version, expected_revision: txt(voice.revision), event: {kind, payload}};
    return [{op: "put", entity: "truco_voice_command", id, row: {id, instance_id: voice.instance_id, request}}];
  };
  const voiced = (g, row) => {
    if (voice === undefined) {
      const id = `voice/${row.actor}`;
      return (rows.truco_voice_open ?? []).some(o => o.id === id) ? [] : [{op: "put", entity: "truco_voice_open", id, row: {id, instance_id: row.actor, kind: "create", input: "{}"}}];
    }
    if (voiceCommands.some(c => c.instance_id === voice.instance_id && !c.outcome)) return [];
    const said = voice.view;
    if (g.view.phase === "finished" || said.room === g.room && said.talk === g.view.talk && said.seat === g.seat && said.name === handle) return [];
    return speak("sit", {room: g.room, talk: g.view.talk, seat: g.seat, name: handle}, `sit${g.seat}`);
  };
  // A command is named by what it says — the table, the revision it was made
  // at, your seat and the gesture — so the same gesture twice is one row, and
  // one made on a view the table has moved past comes back stale.
  const revisionOf = c => Number(String(c.id).split("/")[1]);
  const pendingIn = g => commands.some(c => c.instance_id === g.room && !c.outcome);
  const command = (g, kind, payload, tag = kind) => {
    const id = `${g.room}/${g.revision}/${g.seat}/${tag}`;
    if (commands.some(c => c.id === id)) return [];
    const request = {version: machine.spec.version, expected_revision: txt(g.revision), event: {kind, payload}};
    return [{op: "put", entity: "truco_match_command", id, row: {id, instance_id: g.room, request}}];
  };
  // A gesture the table moved under — the other seat shouted, or played —
  // is made again at the revision the seat holds now, if it still can be.
  const retry = g => {
    const mine = commands.filter(c => c.instance_id === g.room).sort((x, y) => revisionOf(y) - revisionOf(x));
    const last = mine[0];
    if (last === undefined || last.outcome !== "rejected" || last.reason !== "stale_revision" || revisionOf(last) >= g.revision) return [];
    const {event: asked} = last.request;
    const still = g.view.actions.includes(asked.kind) && (asked.kind !== "play" || g.view.available.includes(asked.payload.slot));
    return still ? command(g, asked.kind, asked.payload, String(last.id).split("/").slice(3).join("/")) : [];
  };
  // A shout your voice was moved under — sat again, or another shout of yours
  // landed first — is shouted again at the revision it holds now.
  const reshout = () => {
    if (voice === undefined) return [];
    const [last] = voiceCommands.filter(c => c.instance_id === voice.instance_id).sort((x, y) => revisionOf(y) - revisionOf(x));
    if (last === undefined || last.outcome !== "rejected" || last.reason !== "stale_revision" || revisionOf(last) >= Number(voice.revision)) return [];
    const {event: asked} = last.request;
    return asked.kind === "shout" ? speak("shout", asked.payload, String(last.id).split("/").slice(3).join("/")) : [];
  };

  /* --- the bar's tables ------------------------------------------------------ */

  // A table opened in the bar, for a friend to sit at by its code. One of
  // yours is open at a time, so the bar has one code to show. The button
  // names the language its catalogue spells codes in (online-create-<list>).
  if (event.type === "click" && (event.from ?? "").startsWith("online-create-")) {
    const language = event.from.slice("online-create-".length);
    if (TABLE_WORDS[language] === undefined) throw new Error(`no table words in ${language}`);
    if (seatRows.some(r => r.phase !== "finished")) return {updates: [{op: "patch", entity: "lobby_tab", id: "the", row: {note: "online_seated_elsewhere"}}]};
    if ((rows.truco_match_open ?? []).some(o => o.kind === "create" && !o.outcome)) return {updates: []};
    // The seating the bar picked (lobby_tab.format); three pairs play only the
    // dourados, so the rules follow the seating rather than refuse it.
    const seating = tab.format;
    if (!["1v1", "2v2", "2v2v2"].includes(seating)) throw new Error(`a table opened before the bar picked its seating: "${seating}"`);
    const dourado = ["douradinha", "douradao"].includes(picked.variant);
    const variant = seating === "2v2v2" ? (dourado ? picked.variant : "douradinha") : (dourado ? "mineiro" : picked.variant);
    const reserved = tab.reserved;
    return {updates: [{op: "patch", entity: "lobby_tab", id: "the", row: {note: ""}}], then: {type: "table", seed: true, with: {language, variant, seating, reserved}}};
  }
  // A table on the bar's list is joined by its room, which a table a
  // challenge dealt has as no code.
  if (event.type === "click" && (event.from ?? "").startsWith("sit-")) {
    return {updates: [{op: "patch", entity: "lobby_tab", id: "the", row: {join: event.id, note: ""}}]};
  }
  // Two draws spell the code: three words from the first, the slug from what
  // is left of it and twelve bits of the second. Two more are the table's
  // talk, which names it to its voices' readers without naming its room.
  if (event.type === "table") {
    const draws = [...(event.with.draws ?? []), Number(event.seed) >>> 0];
    if (draws.length < 4) return {updates: [], then: {type: "table", seed: true, with: {...event.with, draws}}};
    const [first, second] = draws;
    const room = roomAt(event.with.language, [first >>> 24, (first >>> 16) & 255, (first >>> 8) & 255], (first & 255) * 4096 + (second & 4095));
    const talk = draws.slice(2).map(n => n.toString(16).padStart(8, "0")).join("");
    const {variant, seating, reserved} = event.with;
    return {updates: [{op: "put", entity: "truco_match_open", id: room, row: {id: room, instance_id: room, kind: "create", input: {variant, seating, reserved, talk}}},
      {op: "patch", entity: "lobby_tab", id: "the", row: {call: room}}]};
  }

  /* --- clicks record intents ------------------------------------------------ */

  // An intent names the game and revision it was made at, so one made on a
  // stale table is dropped, and the click's number, one past the last click's,
  // so each click is its own and they sort in the order they were made. The
  // table's row carries the last one's name: the fold is seated on that row,
  // a write there is what wakes it, and a name never repeats.
  if (event.type === "click") {
    if (game === null) return {updates: []};
    const held = (rows.held ?? []).find(h => h.id === event.id && h.seat === "you");
    const kind = held !== undefined ? "play" : INTENT[event.from];
    if (kind === undefined) return {updates: []};
    const slot = held !== undefined ? held.slot : "";
    if (game.online) {
      const g = game;
      if (kind === "encobrir") return {updates: draw({...g, face: {...g.face, oculta: !g.face.oculta}}, true)};
      if (kind === "again") {
        if (g.view.phase !== "finished") return {updates: []};
        // Back at the house, your voice rises from the table it sat at.
        return {updates: rise(), then: {type: "dealt", seed: true, with: g.back}};
      }
      if (kind.startsWith("shout_")) return {updates: voice === undefined || voice.view.room !== g.room ? [] : speak("shout", {word: kind.slice("shout_".length)}, `${kind}${voiceCommands.length}`)};
      if (pendingIn(g) || !g.view.actions.includes(kind)) return {updates: []};
      if (kind === "play") return {updates: [...command(g, "play", {slot: Number(slot), covered: g.face.oculta}, `play${slot}`), ...draw({...g, face: {...g.face, oculta: false}}, true)]};
      return {updates: command(g, kind, {})};
    }
    const clicked = Number(txt(table?.wake ?? "").split("/")[2] ?? "0") + 1;
    const id = `${game.id}/${game.revision}/${String(clicked).padStart(8, "0")}/${kind}${slot}`;
    return {updates: [
      {op: "put", entity: "intent", id, row: {id, game: game.id, revision: txt(game.revision), kind, ...(slot === "" ? {} : {slot})}},
      {op: "patch", entity: "match", id: "table", row: {wake: id}},
    ]};
  }

  /* --- the fold -------------------------------------------------------------- */

  // A new game: the terminal's draw arrives, and the deal follows from it.
  if (event.type === "dealt") {
    const {variant, seating, opponent} = event.with;
    const seats = SEATS[seating];
    const seed = String(event.seed);
    const opened = machine.execute({initialize: true, payload: {variant, seating, turn_ms: 0, reserved: true, talk: ""}, context: {actor: "a", tier: "omnishell", now: 0}, viewers: seats});
    const fresh = {id: `g${seed}`, seed, variant, seating, opponent, version: machine.spec.version, revision: 0, state: opened.state, face: {told: null, quick: null, oculta: false, shouts: 0}};
    const dealt = apply(fresh, "start", {seats}, "a", "mecha");
    if (dealt === null) throw new Error(`truco_match refused to deal ${variant} ${seating}`);
    return {updates: [...(rows.intent ?? []).map(i => ({op: "delete", entity: "intent", id: i.id})), ...coded(null), ...draw(dealt, table === undefined || game?.online === true)]};
  }

  // A table code typed in the bar, or a listed table's room, asks to join
  // that table, keyed by a draw; the bar is told when the table refuses, or
  // when the code names none.
  const asked = tab?.join ?? "";
  const joining = roomOf(asked) ?? (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(asked) ? asked : "");
  // One table at a time: a code asked for while you sit at another is refused here.
  if (joining !== "" && !seatRows.some(r => r.instance_id === joining) && seatRows.some(r => r.phase !== "finished")) {
    return {updates: [{op: "patch", entity: "lobby_tab", id: "the", row: {join: "", note: "online_seated_elsewhere"}}]};
  }
  if (joining === "" && asked !== "") {
    return {updates: [{op: "patch", entity: "lobby_tab", id: "the", row: {join: "", note: "join_code_invalid"}}]};
  }
  if (joining !== "" && !seatRows.some(r => r.instance_id === joining)) {
    // Only the joins asked for here: one a call's answer wrote is that call's.
    const opens = (rows.truco_match_open ?? []).filter(o => o.instance_id === joining && txt(o.id).startsWith(`join/${joining}/`));
    const refused = opens.find(o => o.outcome === "rejected");
    if (refused !== undefined) {
      return {updates: [{op: "patch", entity: "lobby_tab", id: "the", row: {join: "", note: refused.reason === "seat_unavailable" ? "online_refused_seat" : "online_refused_room"}}]};
    }
    if (opens.length === 0) {
      if (event.type === "join") {
        const id = `join/${joining}/${event.seed}`;
        return {updates: [{op: "put", entity: "truco_match_open", id, row: {id, instance_id: joining, kind: "join", input: "{}"}}]};
      }
      return {updates: [], then: {type: "join", seed: true}};
    }
  }
  if (joining !== "" && seatRows.some(r => r.instance_id === joining)) {
    return {updates: [{op: "patch", entity: "lobby_tab", id: "the", row: {join: ""}}]};
  }

  // A seat the cluster gave you in a match still being played sits you at it,
  // wherever this table was; it plays here until it is over and you ask for
  // the house again.
  if (game?.online) {
    const row = seatRows.find(r => r.instance_id === game.room);
    // Your seat gone — you stood up from a table still waiting — the voice rises
    // from it and the house deals again.
    if (row === undefined) {
      if (event.type !== "mutation") return {updates: []};
      return {updates: rise(), then: {type: "dealt", seed: true, with: game.back}};
    }
    const g = caught(game, row);
    // A table closed before its first hand has nothing to show: the house deals again.
    if (g.view.phase === "finished" && g.view.hand_no === 0) {
      if (event.type !== "mutation") return {updates: []};
      return {updates: rise(), then: {type: "dealt", seed: true, with: g.back}};
    }
    if (event.type === "beat") {
      const due = event.with;
      if (due.game !== g.id) return {updates: []};
      if (due.kind === "hush") {
        if (g.face.quick === null || g.face.quick.t !== due.t) return {updates: []};
        return {updates: draw({...g, face: {...g.face, quick: {...g.face.quick, live: false}}}, true)};
      }
      if (due.kind === "run-hush" && g.revision === due.revision) return {updates: draw({...g, face: {...g.face, runHushed: g.revision}}, true)};
      // A hand over is dealt again by whichever seat gets there first; the
      // other's ask then finds the next hand already dealt.
      if (due.kind === "next" && g.view.phase === "hand_over" && g.revision === due.revision && g.view.actions.includes("next") && !pendingIn(g)) {
        return {updates: [...command(g, "next", {}), ...draw(g, true)]};
      }
      return {updates: []};
    }
    const updates = [...retry(g), ...reshout(), ...voiced(g, row), ...coded(g), ...draw(g, true)];
    const shouting = g.face.quick !== null && g.face.quick.live && g.face.quick.t !== game.face.quick?.t;
    const ran = g.view.phase === "hand_over" && g.view.log.at(-1)?.kind === "fold";
    const pace = shouting ? beat(g, "hush", 1800, {t: g.face.quick.t})
      : ran && g.face.runHushed !== g.revision ? beat(g, "run-hush", 1800)
      : g.view.phase === "hand_over" ? beat(g, "next", ran ? 1000 : 2800) : undefined;
    return pace === undefined ? {updates} : {updates, then: pace};
  }
  const playing = seatRows.find(r => r.phase !== "finished");
  if (playing !== undefined && event.type !== "beat") {
    return {updates: [...(rows.intent ?? []).map(i => ({op: "delete", entity: "intent", id: i.id})), ...draw(seated(playing, picked), true)]};
  }
  // No game, a game from other rules, or one the picks have moved off: a new
  // draw. A save from another version of the rules is never resumed.
  if (game === null || game.version !== machine.spec.version || game.variant !== picked.variant || game.seating !== picked.seating || game.opponent !== picked.opponent) {
    return event.type === "mutation" ? {updates: [], then: {type: "dealt", seed: true, with: picked}} : {updates: []};
  }
  // A finished game in a tab that never drew it has nothing left to read: its
  // closing scoreline was the tab's. That table opens a fresh sitting, where
  // the tab that finished it keeps it until asked.
  if (game.state.phase === "finished" && !(rows.round ?? []).some(r => String(r.id).startsWith(`${game.id}/`))) {
    return event.type === "mutation" ? {updates: [], then: {type: "dealt", seed: true, with: picked}} : {updates: []};
  }
  const views = viewsOf(game);

  // Your intents first, in the order they were made, one per run; the stale
  // are dropped with it. One the rules refuse, or none live, and the fold goes
  // on as if nothing were asked, so dropping them never stands in for the
  // pace. A beat that finds one waiting gives way to it: applied after the
  // house moved, it would be stale, though the board still asked it of you.
  const intents = rows.intent ?? [];
  const live = intents.filter(i => i.game === game.id && Number(i.revision) === game.revision).sort((x, y) => x.id < y.id ? -1 : 1);
  const drop = list => list.map(i => ({op: "delete", entity: "intent", id: i.id}));
  const stale = intents.filter(i => !live.includes(i));
  let dropped = drop(stale);

  if (event.type === "beat" && ["hush", "retort"].includes(event.with.kind)) {
    const due = event.with;
    if (due.game !== game.id) return {updates: []};
    if (due.kind === "hush") {
      if (game.face.quick === null || game.face.quick.t !== due.t) return {updates: []};
      return {updates: draw({...game, face: {...game.face, quick: {...game.face.quick, live: false}}}, false)};
    }
    if (due.kind === "retort") {
      if (game.face.quick === null || game.face.quick.t !== due.t) return {updates: []};
      return {
        updates: due.revision === game.revision ? draw({...game, face: {...game.face, told: {line: due.line, revision: game.revision}}}, false) : [],
        then: beat(game, "hush", 950, {t: due.t}),
      };
    }
  }

  if (event.type === "beat" && live.length === 0) {
    const due = event.with;
    if (due.game !== game.id || due.revision !== game.revision) return {updates: []};
    if (due.kind === "next") return {updates: draw(apply(game, "next", {}, "a") ?? game, false)};
    if (due.kind === "run-hush") return {updates: draw({...game, face: {...game.face, runHushed: game.revision}}, false)};
    if (due.kind === "paid") return {updates: draw({...game, face: {...game.face, unpaid: null}}, false)};
    const move = houseMove(game, views);
    if (move === null) return {updates: []};
    if (due.kind === "tell") return {updates: draw({...game, face: {...game.face, told: {line: `tell_${move.cast}`, revision: game.revision}}}, false)};
    const applied = apply(game, move.kind, move.payload, move.seat);
    if (applied === null) throw new Error(`the house's ${move.kind} from ${move.seat} was refused`);
    const after = heard(game, applied);
    // A persona's first truco of the hand is said in its own words.
    const first = move.kind === "raise" && after.state.log.filter(l => l.kind === "raise").length === 1;
    return {updates: draw(first ? {...after, face: {...after.face, told: {line: `call_${move.cast}`, revision: after.revision}}} : after, false)};
  }

  if (live.length > 0) {
    const intent = live[0];
    dropped = drop([...stale, intent]);
    if (intent.kind === "again") return {updates: dropped, then: {type: "dealt", seed: true, with: picked}};
    if (intent.kind === "encobrir") return {updates: [...dropped, ...draw({...game, face: {...game.face, oculta: !game.face.oculta}}, false)]};
    if (intent.kind.startsWith("shout_")) {
      const t = game.face.shouts + 1;
      const shouting = {...game, face: {...game.face, shouts: t, quick: {word: intent.kind, t, live: true}}};
      // Most personas answer a shout; which line follows from the seed.
      const roll = prng(Number(game.seed) + t * 131);
      const lines = RETORTS[game.opponent];
      const answers = lines !== undefined && roll() < 0.7;
      return {
        updates: [...dropped, ...draw(shouting, false)],
        then: answers ? beat(shouting, "retort", 850, {t, line: lines[Math.floor(roll() * lines.length)]}) : beat(shouting, "hush", 1800, {t}),
      };
    }
    const payload = intent.kind === "play" ? {slot: Number(intent.slot), covered: game.face.oculta} : {};
    const applied = apply(game, intent.kind, payload, "a");
    if (applied !== null) {
      const after = heard(game, applied);
      return {updates: [...dropped, ...draw({...after, face: {...after.face, oculta: intent.kind === "play" ? false : after.face.oculta}}, false)]};
    }
  }

  // Nothing asked: the felt is drawn, and what happens next without you is
  // paced on the terminal's clock. The pace is armed with the drawing, not
  // after it: a wait does not survive a reload, and a redraw that wakes no
  // one would leave the table waiting on a beat nobody armed. A beat armed
  // twice fires once, since it names the revision it was armed at.
  const updates = [...dropped, ...draw(game, false)];
  const pace = (() => {
    if (game.face.unpaid !== undefined && game.face.unpaid !== null && game.face.unpaid.revision === game.revision) return beat(game, "paid", 800);
    if (game.state.phase === "finished") return undefined;
    if (game.state.phase === "hand_over") {
      const ran = game.state.log.at(-1)?.kind === "fold";
      return ran && game.face.runHushed !== game.revision ? beat(game, "run-hush", 1000) : beat(game, "next", ran ? 1800 : 2800);
    }
    const move = houseMove(game, views);
    if (move === null) return undefined;
    const tellSaid = game.face.told !== null && game.face.told.revision === game.revision && game.face.told.line === `tell_${move.cast}`;
    if (move.tell && !tellSaid) return beat(game, "tell", BEAT);
    return beat(game, "house", move.answering ? BEAT * 2 : BEAT);
  })();
  return pace === undefined ? {updates} : {updates, then: pace};
}
