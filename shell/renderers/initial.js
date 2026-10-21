(value) => {
  const text = String(value);
  const split = text.indexOf("\n");
  const name = split < 0 ? text : text.slice(0, split).trim() || text.slice(split + 1);
  return [Array.from(name.trim())[0]?.toUpperCase() ?? ""];
};
