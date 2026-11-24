return {
  initial: ({input: {_time, ...input}}) => ({...input, phase: "offered"}),
  invariant: state => state.inviter !== state.target && state.inviter.length === 36 && state.target.length === 36 && state.room.length === 36,
  project: state => ({...state}),
  isTarget: ({event}) => event._origin === "target",
  isInviter: ({event}) => event._origin === "inviter",
};
