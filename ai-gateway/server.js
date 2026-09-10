import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { handleChatCompletions, handleMessages, handleModels } from "./lib/proxy.js";
import { loadStore, maskKey } from "./lib/store.js";
import { blockUser, createUser, listLogs, listUsers, setUserBudget, setVendorKeys, vendorStatus } from "./lib/team.js";

const root = dirname(fileURLToPath(import.meta.url));
loadDotenv(join(root, ".env"));

const PORT = Number(process.env.PORT) || 3100;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "comitor-dev";

const app = express();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key, anthropic-version, anthropic-beta, OpenAI-Beta"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});
app.use(express.json({ limit: "32mb" }));
app.use(express.static(join(root, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, vendors: vendorStatus() });
});
app.get("/health/liveliness", (_req, res) => {
  res.send("ok");
});

app.post("/v1/chat/completions", wrap(handleChatCompletions));
app.post("/chat/completions", wrap(handleChatCompletions));
app.post("/v1/messages", wrap(handleMessages));
app.post("/messages", wrap(handleMessages));
app.get("/v1/models", handleModels);
app.get("/models", handleModels);

app.post("/api/login", (req, res) => {
  if (String(req.body?.password ?? "") !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Sai mật khẩu." });
    return;
  }
  res.json({ token: ADMIN_PASSWORD });
});

app.get("/api/health", requireAdmin, (_req, res) => {
  const keys = loadStore().vendorKeys;
  res.json({
    ok: true,
    gateway: true,
    port: PORT,
    vendorKeys: vendorStatus(),
    vendorPreview: {
      claude: maskKey(keys.claude),
      grok: maskKey(keys.grok),
      gemini: maskKey(keys.gemini)
    }
  });
});

app.put("/api/vendors", requireAdmin, (req, res) => {
  setVendorKeys({
    claude: req.body?.claude,
    grok: req.body?.grok,
    gemini: req.body?.gemini
  });
  res.json({ ok: true, vendorKeys: vendorStatus() });
});

app.get("/api/users", requireAdmin, (_req, res) => {
  res.json({ users: listUsers().map((user) => ({ ...user, key: undefined })) });
});

app.post("/api/users", requireAdmin, (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const maxBudgetUsd = Number(req.body?.maxBudget);
  if (!name) {
    res.status(400).json({ error: "Nhập tên người dùng." });
    return;
  }
  if (!Number.isFinite(maxBudgetUsd) || maxBudgetUsd < 0) {
    res.status(400).json({ error: "Trần tiền (USD) không hợp lệ." });
    return;
  }
  const user = createUser({ name, maxBudgetUsd });
  res.json({
    id: user.id,
    name: user.name,
    key: user.key,
    maxBudgetUsd: user.maxBudgetUsd,
    notice: "Copy mã ngay. Sau này web chỉ hiện bản rút gọn."
  });
});

app.post("/api/users/:id/block", requireAdmin, (req, res) => {
  const blocked = req.body?.blocked !== false;
  const user = blockUser(req.params.id, blocked);
  if (!user) {
    res.status(404).json({ error: "Không thấy người dùng." });
    return;
  }
  res.json({ ok: true, blocked: user.blocked });
});

app.patch("/api/users/:id", requireAdmin, (req, res) => {
  const maxBudgetUsd = Number(req.body?.maxBudget);
  if (!Number.isFinite(maxBudgetUsd) || maxBudgetUsd < 0) {
    res.status(400).json({ error: "Trần tiền (USD) không hợp lệ." });
    return;
  }
  const user = setUserBudget(req.params.id, maxBudgetUsd);
  if (!user) {
    res.status(404).json({ error: "Không thấy người dùng." });
    return;
  }
  res.json({ ok: true, maxBudgetUsd: user.maxBudgetUsd });
});

app.get("/api/logs", requireAdmin, (_req, res) => {
  res.json({ logs: listLogs() });
});

app.use((error, req, res, _next) => {
  const status = error.status && error.status >= 400 ? error.status : 500;
  const message = error.message || "Lỗi máy chủ.";
  if (req.path.includes("/messages")) {
    res.status(status).json({
      type: "error",
      error: { type: status === 401 ? "authentication_error" : "api_error", message }
    });
    return;
  }
  if (req.path.includes("/chat/completions")) {
    res.status(status).json({ error: { message, type: "invalid_request_error" } });
    return;
  }
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`[ai-gateway] http://localhost:${PORT}`);
  console.log("[ai-gateway] Claude Code ANTHROPIC_BASE_URL = URL trên");
  console.log("[ai-gateway] Cline/Cursor base = URL trên + /v1");
});

function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function requireAdmin(req, res, next) {
  const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (token !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Chưa đăng nhập." });
    return;
  }
  next();
}

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
