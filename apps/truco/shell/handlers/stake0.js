// The ladder's base of the variant standing — what a seats change resets the
// stake to, which no literal on the arrow can say. Minas opens at two, dourado
// included; every other table opens at one.
(state, event) => (["mineiro", "douradinha", "douradao"].includes(state.items[0].variant) ? "2" : "1");
