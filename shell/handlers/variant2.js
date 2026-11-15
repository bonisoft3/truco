// The game a two-sided seating deals. The dourado tables are mineiro built for
// three pairs, so seating fewer turns them back into mineiro; any other game
// stands.
({ context }) => (["douradinha", "douradao"].includes(context.items[0].variant) ? "mineiro" : context.items[0].variant);
