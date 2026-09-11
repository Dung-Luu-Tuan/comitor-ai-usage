export function maskKey(key) {
  const value = (key ?? "").trim();
  if (value.length < 12) return value ? "••••" : "";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function vendorReady(key) {
  const value = (key ?? "").trim();
  return value.length > 12 && !/placeholder|chua-co|example/i.test(value);
}
