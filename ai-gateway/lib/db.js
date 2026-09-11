import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let pool;
let searchPathSql = 'SET search_path TO "public"';

function loadDotenv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cut = trimmed.indexOf("=");
    if (cut < 1) continue;
    const name = trimmed.slice(0, cut).trim();
    let value = trimmed.slice(cut + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

function ensureEnv() {
  loadDotenv(join(root, "..", ".env"));
  loadDotenv(join(root, ".env"));
}

function parseDatabaseUrl(raw) {
  const url = new URL(raw);
  const schema = url.searchParams.get("schema") || "public";
  url.searchParams.delete("schema");
  url.searchParams.delete("connection_limit");
  const sslmode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");
  const ssl = sslmode === "require" || sslmode === "prefer" ? { rejectUnauthorized: false } : false;
  return { connectionString: url.toString(), schema, ssl };
}

function getPool() {
  if (pool) return pool;
  ensureEnv();
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("Thiếu DATABASE_URL — cổng 3100 đọc cùng Postgres với app 3050.");
  }
  const { connectionString, schema, ssl } = parseDatabaseUrl(raw);
  searchPathSql = `SET search_path TO "${schema.replaceAll('"', "")}"`;
  pool = new pg.Pool({ connectionString, ssl, max: 5 });
  return pool;
}

export async function query(text, params = []) {
  const client = await getPool().connect();
  try {
    await client.query(searchPathSql);
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function withTransaction(work) {
  const client = await getPool().connect();
  try {
    await client.query(searchPathSql);
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function defaultWorkspaceId() {
  ensureEnv();
  return (process.env.AI_USAGE_WORKSPACE_ID ?? "").trim();
}
