(value) => {
  const text = String(value);
  const first = text.indexOf("\n");
  const second = text.indexOf("\n", first + 1);
  if (first < 0 || second < 0) throw new Error("speech requires a template, worth and name");
  const template = text.slice(0, first);
  const worth = text.slice(first + 1, second);
  const name = text.slice(second + 1);
  return [template.replace(/\{(name|worth)\}/g, (_, key) => key === "name" ? name : worth)];
};
