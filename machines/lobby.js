// lobby — the bar, the arena's modal: your presence among the players, leased
// while the arena is open (root.cue's `local` state), composed over
// truco_presence and handed the declarations of the challenges and calls it
// opens. It draws the bar's own rows: the chairs of your table while it waits
// and the tables on the bar's list.
//
// The tab holds one lease row, keyed by the terminal's draw and renewed by the
// `lease` handler; the cluster lists you while a lease of yours is live, so a
// tab that closes stops listing you when its lease lapses. A gesture becomes a command
// or an open row; a new challenge or call is keyed by a draw, since an
// instance's id is a uuid and a fold has no randomness but the terminal's.
(state, event, machine, machines) => {
  const rows = state.rows ?? {};
  const txt = value => String(value);

  // A uuid from four recorded draws, laid out as the terminal's own keys are,
  // so a replay opens the same one. A draw is 32 bits: the draws an id asks
  // for are gathered one step each, carried in `with`.
  const uuidOf = draws => {
    const hex = draws.map(n => (Number(n) >>> 0).toString(16).padStart(8, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${"89ab"[parseInt(hex[16], 16) % 4]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  };
  // An offer draws its id and, after it, the talk of the table it deals.
  const needed = {lease: 4, call: 4, offer: 6}[event.type] ?? 0;
  const draws = needed > 0 ? [...(event.with?.draws ?? []), event.seed] : [];
  if (draws.length < needed) return {updates: [], then: {type: event.type, seed: true, with: {...event.with, draws}}};

  const tab = (rows.lobby_tab ?? []).find(r => r.id === "the");
  const presence = (rows.truco_presence_seat ?? [])[0];
  const handle = ((rows.player ?? []).find(p => p.id === "you")?.handle ?? "").trim();
  const sitting = (rows.match ?? []).find(m => m.current === "yes");
  const rules = {variant: sitting?.variant ?? "mineiro", seating: sitting?.seats ?? "1v1"};
  const note = text => tab === undefined || tab.note === text ? [] : [{op: "patch", entity: "lobby_tab", id: "the", row: {note: text}}];

  const command = (name, instance, revision, seat, kind, payload) => {
    const id = `${instance}/${revision}/${seat}/${kind}`;
    const request = {version: machines[name].spec.version, expected_revision: txt(revision), event: {kind, payload}};
    return {op: "put", entity: `${name}_command`, id, row: {id, instance_id: instance, request}};
  };
  const open = (name, input) => {
    const id = uuidOf(draws);
    return {op: "put", entity: `${name}_open`, id, row: {id, instance_id: id, kind: "create", input}};
  };

  // The lease is drawn once per tab.
  if (event.type === "lease") {
    const id = uuidOf(draws);
    return {updates: [
      {op: "put", entity: "lobby_tab", id: "the", row: {id: "the", lease: id, me: "", note: "", shown: "", code: "", format: rules.seating, reserved: "false", chair: "", call: ""}},
      {op: "put", entity: "truco_presence_lease", id, row: {id, beat: 0}},
    ]};
  }
  // A challenge is the one-gesture game of two: tables of pairs are opened
  // and called to, so it plays 1v1 under the arena's rules, or the mineiro's
  // where those are the three pairs' own.
  if (event.type === "offer") {
    const variant = ["douradinha", "douradao"].includes(rules.variant) ? "mineiro" : rules.variant;
    const talk = draws.slice(4).map(n => (Number(n) >>> 0).toString(16).padStart(8, "0")).join("");
    return {updates: [open("truco_challenge", {target: event.with.target, variant, seating: "1v1", talk})]};
  }
  if (event.type === "call") {
    const {target, room, chair} = event.with;
    const call = open("truco_call", {target, room, chair});
    return {updates: [call, {op: "patch", entity: "lobby_tab", id: "the", row: {chair: "", call: call.id}}]};
  }

  // Your table while it waits: the one of yours no hand has been dealt at.
  const waiting = (rows.truco_match_seat ?? []).find(r => r.phase === "waiting");
  const table = waiting === undefined ? null : waiting.view;
  const free = table === null ? [] : table.seats.filter(seat => !table.joined.includes(seat));
  // A free chair is called to once your voice sits at the table, since a
  // call carries the name it gives there.
  const voice = (rows.truco_voice_seat ?? [])[0];
  const voiced = table !== null && voice !== undefined && voice.view.room === waiting.instance_id;
  const calls = rows.truco_call_seat ?? [];
  // The call of yours out to a chair of your waiting table, if one is.
  const outTo = seat => waiting === undefined ? undefined : calls.find(c => c.seat === "caller" && c.phase === "offered" && c.room === waiting.instance_id && c.chair === seat);

  if (event.type === "click") {
    const from = event.from ?? "";
    if (from === "btn-toggle-online") {
      if (presence === undefined) return {updates: []};
      // The switch answers what it shows, which may be ahead of the seat.
      const visible = (tab?.shown || (presence.phase === "visible" ? "show" : "hide")) === "show";
      if (!visible && handle === "") return {updates: note("lobby_need_handle")};
      return {updates: [
        ...note(""),
        {op: "patch", entity: "lobby_tab", id: "the", row: {shown: visible ? "hide" : "show"}},
        command("truco_presence", presence.instance_id, presence.revision, presence.seat, visible ? "hide" : "show", visible ? {} : {name: handle}),
      ]};
    }
    if (from.startsWith("format-")) return {updates: [{op: "patch", entity: "lobby_tab", id: "the", row: {format: from.slice("format-".length)}}]};
    if (from === "reserved-toggle") return {updates: [{op: "patch", entity: "lobby_tab", id: "the", row: {reserved: tab.reserved === "true" ? "false" : "true"}}]};
    // A free chair picked is the one the next call from the roda fills.
    if (from.startsWith("chair-")) {
      const seat = from.slice("chair-".length);
      const out = outTo(seat);
      if (out !== undefined) return {updates: [command("truco_call", out.instance_id, out.revision, out.seat, "cancel", {})]};
      return free.includes(seat) ? {updates: [{op: "patch", entity: "lobby_tab", id: "the", row: {chair: tab?.chair === seat ? "" : seat}}]} : {updates: []};
    }
    // Called to the picked chair, or to a free one no call is out to: your
    // pair's before the others', since the one you call is likelier a partner.
    if (from.startsWith("summon-")) {
      const n = table === null ? 0 : table.seats.length;
      const turn = seat => (table.seats.indexOf(seat) - table.seats.indexOf(waiting.seat) + n) % n;
      const ours = seat => turn(seat) % (n === 6 ? 3 : 2) === 0;
      if (!voiced) return {updates: []};
      const open = free.filter(seat => outTo(seat) === undefined).sort((x, y) => Number(ours(y)) - Number(ours(x)));
      const chair = open.includes(tab?.chair ?? "") ? tab.chair : open[0];
      if (chair === undefined) return {updates: note("call_no_chair")};
      return {updates: note(""), then: {type: "call", seed: true, with: {target: event.id, room: waiting.instance_id, chair}}};
    }
    if (["close-table", "leave-table"].includes(from) && waiting !== undefined) {
      return {updates: [command("truco_match", waiting.instance_id, waiting.revision, waiting.seat, waiting.seat === "a" ? "resign" : "stand", {})]};
    }
    // Answering a call sits you in its chair in the same gesture: the join is
    // refused if the chair was taken meanwhile, and the answer closes the call.
    const reply = ["call-accept", "call-decline", "call-cancel"].find(kind => from.startsWith(`${kind}-`));
    const call = calls.find(c => c.id === event.id);
    if (reply && call) {
      if (reply === "call-accept" && (rows.truco_match_seat ?? []).some(r => r.phase !== "finished")) return {updates: note("online_seated_elsewhere")};
      const answer = command("truco_call", call.instance_id, call.revision, call.seat, reply.slice("call-".length), {});
      if (reply !== "call-accept") return {updates: [answer]};
      const id = `call/${call.instance_id}`;
      return {updates: [answer, {op: "put", entity: "truco_match_open", id, row: {id, instance_id: call.room, kind: "join", input: {requested_seat: call.chair}}},
        {op: "patch", entity: "lobby_tab", id: "the", row: {call: id}}]};
    }
    if (from.startsWith("challenge-")) {
      return {updates: note(""), then: {type: "offer", seed: true, with: {target: event.id}}};
    }
    const answer = ["accept", "decline", "cancel"].find(kind => from.startsWith(`${kind}-`));
    const offer = (rows.truco_challenge_seat ?? []).find(c => c.id === event.id);
    if (answer && offer) return {updates: [command("truco_challenge", offer.instance_id, offer.revision, offer.seat, answer, {})]};
    return {updates: []};
  }

  if (tab === undefined || tab.lease === "") return {updates: [], then: {type: "lease", seed: true}};
  // Who you are among the players, so the list leaves you out.
  const me = presence?.instance_id ?? "";
  // The listing carries the name you went online with, so a rename while
  // online is sent again; keyed by the revision, a resend is the same row.
  // A command row is sealed once written, so a revision carries one: a rename
  // made again before the seat moves on waits for the next.
  const sent = presence !== undefined && (rows.truco_presence_command ?? []).some(c => txt(c.id).startsWith(`${presence.instance_id}/${presence.revision}/`));
  const renamed = presence?.phase === "visible" && handle !== "" && handle !== txt(presence.name ?? "") && !sent;
  // Cleared while in the round: there is no name left to be listed by.
  const nameless = presence?.phase === "visible" && handle === "" && !sent;
  // A lease renewal moves the revision under a click, so this tab's last
  // switch can come back stale; while the seat is not where it asked to be,
  // it is sent again at the revision the seat holds now.
  const [last] = (rows.truco_presence_command ?? [])
    .map(c => ({row: c, revision: Number(txt(c.id).split("/")[1]), kind: txt(c.id).split("/")[3]}))
    .filter(c => presence !== undefined && c.row.instance_id === presence.instance_id && ["show", "hide"].includes(c.kind))
    .sort((x, y) => y.revision - x.revision);
  const unmet = last !== undefined && last.row.reason === "stale_revision" && Number(presence.revision) > last.revision &&
    (presence.phase === "visible") !== (last.kind === "show") && (last.kind === "hide" || handle !== "");
  // Shown is what you asked for while a switch of yours is in flight, and
  // what the seat holds once none is: a refused switch shows the seat again.
  const inFlight = presence !== undefined && (rows.truco_presence_command ?? []).some(c => c.instance_id === presence.instance_id && !c.outcome);
  const held = presence === undefined ? "" : presence.phase === "visible" ? "show" : "hide";
  const shown = inFlight ? txt(tab.shown ?? "") || held : held;
  // The bar's own rows: the tables on its list, by who opened them, and the
  // chairs of yours from where you sit — the one across is your partner's,
  // and in a table of three pairs each pair sits across from itself.
  const voices = talk => (rows.truco_voice_public ?? []).filter(v => v.talk === talk);
  const listed = (rows.truco_match_public ?? []).filter(t => !(rows.truco_match_seat ?? []).some(r => r.instance_id === t.id)).map(t => ({
    id: t.id, host: voices(t.talk).find(v => v.seat === "a")?.name ?? "", rules: `variant_${t.variant}_short`, seating: t.seating,
    missing: Number(t.places) - Number(t.seated), seated: `${t.seated}/${t.places}`, talk: t.talk,
  }));
  const ORDER = {"1v1": ["you", "eles1"], "2v2": ["you", "eles1", "parca", "eles2"], "2v2v2": ["you", "eles1", "eles2", "parca", "eles3", "eles4"]};
  const chairs = table === null ? [] : table.seats.map((seat, i) => {
    const n = table.seats.length, turn = (i - table.seats.indexOf(waiting.seat) + n) % n;
    const out = outTo(seat);
    const state = seat === waiting.seat ? "you" : table.joined.includes(seat) ? "taken" : out !== undefined ? "called" : "free";
    const name = state === "you" ? handle : state === "called" ? out.view.target_name : voices(table.talk).find(v => v.seat === seat)?.name ?? "";
    return {id: seat, at: ORDER[table.seating][turn], team: n === 6 ? ["nos", "eles", "outros"][turn % 3] : turn % 2 === 0 ? "nos" : "eles",
      state, name, picked: state === "free" && tab.chair === seat ? "yes" : "", talk: table.talk, callable: state === "free" && voiced ? "yes" : ""};
  });
  const synced = (entity, want) => {
    const have = rows[entity] ?? [];
    const same = (h, w) => Object.keys(w).every(k => txt(h[k] ?? "") === txt(w[k]));
    return [
      ...have.filter(h => !want.some(w => w.id === h.id)).map(h => ({op: "delete", entity, id: h.id})),
      ...want.filter(w => { const h = have.find(x => x.id === w.id); return h === undefined || !same(h, w); }).map(w => ({op: "put", entity, id: w.id, row: w})),
    ];
  };
  // The call you last made, the join a call you answered asked for, or the
  // table you opened, once
  // the cluster answers it: a refusal says why.
  const asked = [
    ...(rows.truco_call_open ?? []).map(o => ({o, said: `call_${o.reason}`})),
    ...(rows.truco_match_open ?? []).map(o => ({o, said: o.kind === "create" ? `online_${o.reason}` : o.reason === "seat_unavailable" ? "online_refused_seat" : "online_refused_room"})),
  ].find(a => a.o.id === txt(tab.call ?? "") && a.o.outcome);
  const made = asked?.o;
  const refusal = made === undefined || made.outcome !== "rejected" ? "" : asked.said;
  const answered = made === undefined ? [] : [{op: "patch", entity: "lobby_tab", id: "the", row: {call: "", note: refusal}}];
  // Closing or leaving your table is sent again at the revision it holds now
  // if one joining moved it under the click.
  const revisionOf = c => Number(txt(c.id).split("/")[1]);
  const [closing] = waiting === undefined ? [] : (rows.truco_match_command ?? [])
    .filter(c => c.instance_id === waiting.instance_id && /\/(resign|stand)$/.test(txt(c.id))).sort((x, y) => revisionOf(y) - revisionOf(x));
  const reclose = closing !== undefined && closing.reason === "stale_revision" && Number(waiting.revision) > revisionOf(closing)
    ? [command("truco_match", waiting.instance_id, waiting.revision, waiting.seat, txt(closing.id).split("/")[3], {})] : [];
  return {updates: [
    ...synced("listed_table", listed),
    ...synced("chair", chairs),
    ...answered,
    ...reclose,
    ...(txt(tab.me ?? "") === me ? [] : [{op: "patch", entity: "lobby_tab", id: "the", row: {me}}]),
    ...(txt(tab.shown ?? "") === shown ? [] : [{op: "patch", entity: "lobby_tab", id: "the", row: {shown}}]),
    ...(unmet ? [command("truco_presence", presence.instance_id, presence.revision, presence.seat, last.kind, last.kind === "show" ? {name: handle} : {})]
      : renamed ? [command("truco_presence", presence.instance_id, presence.revision, presence.seat, "show", {name: handle})]
      : nameless ? [command("truco_presence", presence.instance_id, presence.revision, presence.seat, "hide", {})] : []),
  ]};
}
