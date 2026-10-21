(state, event, params) => {
  const row = state.items[0];
  if (params.variants.split(",").includes(row.variant)) return row[params.field];
  return params.field === "seats" && row.seats !== "2v2v2" ? row.seats : params.value;
};
