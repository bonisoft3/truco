// A sitting exists: the picker slots bind a fallback row (id "") before the
// fold's first match lands, and a machine write on it would mint a junk match.
// A finished one counts. It stays on the felt with its result until something
// is asked of it, and a rule picked on it is asked: the rules reset
// (arena.cue, _reset) deals the next match under that rule, from zero.
(state, event) => (state.items[0]?.id ?? "") !== "";
