return {
  initial: ({input: {_time, ...input}}) => ({...input, phase: "offered", deadline: _time + 30000}),
  invariant: state => state.caller !== state.target && state.caller.length === 36 && state.target.length === 36 && state.room.length === 36,
  project: state => ({...state}),
  isTarget: ({event}) => event._origin === "target",
  isCaller: ({event}) => event._origin === "caller",
  inTime: ({context: state, event}) => event._time < state.deadline,
  isDue: ({context: state, event}) => event._time >= state.deadline,
};
