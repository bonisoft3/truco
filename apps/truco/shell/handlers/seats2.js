// The seats a two-sided game is dealt at when it is picked. Three pairs is
// the dourado tables' own seating and no other game has one, so a table
// leaving it sits in pairs, the canonical form; any other seating stands.
(state, event) => (state.items[0].seats === "2v2v2" ? "2v2" : state.items[0].seats);
