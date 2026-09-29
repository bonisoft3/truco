// The game three pairs deals: only the dourado tables seat six, so any other
// game is dealt as douradinha, the one that builds a storey on mineiro.
(state, event) => (["douradinha", "douradao"].includes(state.items[0].variant) ? state.items[0].variant : "douradinha");
