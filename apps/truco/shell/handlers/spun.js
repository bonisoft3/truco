// The next sitting's seed follows from the old one — the dealer replays every
// shuffle from it, so a rules change re-deals without anybody drawing.
(state, event) => String((Number(state.items[0].seed) * 1103515245 + 12345) >>> 0);
