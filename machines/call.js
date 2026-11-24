return {
  initial: ({input: {_time, ...input}}) => ({...input, phase: "offered"}),
  invariant: state => state.caller !== state.target && state.caller.length === 36 && state.target.length === 36 && state.room.length === 36,
  project: state => ({...state}),
  isTarget: ({event}) => event._origin === "target",
  isCaller: ({event}) => event._origin === "caller",
};
