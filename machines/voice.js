return {
  initial: () => ({phase: "quiet", room: "", talk: "", seat: "", name: "", word: "", n: 0}),
  invariant: state => (state.phase === "quiet") === (state.room === "") && (state.room === "") === (state.seat === "") && (state.room === "") === (state.talk === ""),
  project: state => ({...state}),
  publish: state => state.phase === "quiet" ? null : {talk: state.talk, seat: state.seat, name: state.name, word: state.word, n: state.n},
  sit: (state, event) => ({...state, room: event.payload.room, talk: event.payload.talk, seat: event.payload.seat, name: event.payload.name.trim()}),
  mayShout: (_state, event) => event.payload.word === "" ? "no_word" : true,
  shout: (state, event) => ({...state, word: event.payload.word, n: state.n + 1}),
  rise: state => ({...state, room: "", talk: "", seat: ""}),
};
