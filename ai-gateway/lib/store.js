import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const storePath = join(dataDir, "store.json");

function emptyStore() {
  return { vendorKeys: { claude: "", grok: "", gemini: "" }, users: [], logs: [] };
}

function normalize(raw) {
  const empty = emptyStore();
  const parsed = raw && typeof raw === "object" ? raw : {};
  return {
    vendorKeys: { ...empty.vendorKeys, ...(parsed.vendorKeys || {}) },
    users: Array.isArray(parsed.users) ? parsed.users : [],
    logs: Array.isArray(parsed.logs) ? parsed.logs : []
  };
}

export function loadStore() {
  mkdirSync(dataDir, { recursive: true });
  if (!existsSync(storePath)) {
    saveStore(emptyStore());
  }
  try {
    return normalize(JSON.parse(readFileSync(storePath, "utf8")));
  } catch {
    return emptyStore();
  }
}

export function saveStore(store) {
  mkdirSync(dataDir, { recursive: true });
  const tmp = `${storePath}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(normalize(store), null, 2)}\n`);
  renameSync(tmp, storePath);
}

export function maskKey(key) {
  const value = (key ?? "").trim();
  if (value.length < 12) return value ? "••••" : "";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function vendorReady(key) {
  const value = (key ?? "").trim();
  return value.length > 12 && !/placeholder|chua-co|example/i.test(value);
}
