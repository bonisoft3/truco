// The game three pairs deals: only the dourado tables seat six, so any other
// game is dealt as douradinha, the one that builds a storey on mineiro.
({ context }) => (["douradinha", "douradao"].includes(context.items[0].variant) ? context.items[0].variant : "douradinha");
