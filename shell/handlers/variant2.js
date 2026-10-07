// The game a two-sided seating deals. The dourado tables are mineiro built for
// three pairs, so seating fewer turns them back into mineiro; any other game
// stands.
(state, event) => (["douradinha", "douradao"].includes(state.items[0].variant) ? "mineiro" : state.items[0].variant);
