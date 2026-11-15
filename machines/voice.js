return {
  initial: () => ({phase: "quiet", room: "", talk: "", seat: "", name: "", word: "", n: 0}),
  invariant: state => (state.phase === "quiet") === (state.room === "") && (state.room === "") === (state.seat === "") && (state.room === "") === (state.talk === ""),
  project: state => ({...state}),
  publish: state => state.phase === "quiet" ? null : {talk: state.talk, seat: state.seat, name: state.name, word: state.word, n: state.n},
  sit: ({context: state, event}) => ({...state, room: event.room, talk: event.talk, seat: event.seat, name: event.name.trim()}),
  hasWord: ({event}) => event.word !== "",
  shout: ({context: state, event}) => ({...state, word: event.word, n: state.n + 1}),
  rise: ({context: state}) => ({...state, room: "", talk: "", seat: ""}),
};
