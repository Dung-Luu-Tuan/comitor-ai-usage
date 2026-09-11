import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  handleChatCompletions,
  handleGeminiGenerate,
  handleImageGenerations,
  handleMessages,
  handleModels,
  handleVideos
} from "./lib/proxy.js";
import { maskKey } from "./lib/store.js";
import {
  blockUser,
  createUser,
  listLogs,
  listUsers,
  loadVendorKeys,
  resolveAdminWorkspaceId,
  setUserBudget,
  setVendorKeys,
  VENDORS,
  vendorStatus
} from "./lib/team.js";

const root = dirname(fileURLToPath(import.meta.url));
loadDotenv(join(root, "..", ".env"));
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

app.get(
  "/health",
  wrap(async (_req, res) => {
    res.json({ ok: true, vendors: await vendorStatus() });
  })
);
app.get("/health/liveliness", (_req, res) => {
  res.send("ok");
});

app.post("/v1/chat/completions", wrap(handleChatCompletions));
app.post("/chat/completions", wrap(handleChatCompletions));
app.post("/v1/messages", wrap(handleMessages));
app.post("/messages", wrap(handleMessages));
app.post("/v1/images/generations", wrap(handleImageGenerations));
app.post("/v1/videos", wrap(handleVideos));
app.post(/^\/v1(?:beta)?\/models\/[^/]+:(streamGenerateContent|generateContent)$/, wrap(handleGeminiGenerate));
app.get("/v1/models", handleModels);
app.get("/models", handleModels);

app.post("/api/login", (req, res) => {
  if (String(req.body?.password ?? "") !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Sai mật khẩu." });
    return;
  }
  res.json({ token: ADMIN_PASSWORD });
});

app.get(
  "/api/health",
  requireAdmin,
  wrap(async (_req, res) => {
    const workspaceId = await resolveAdminWorkspaceId();
    const keys = await loadVendorKeys(workspaceId);
    const status = await vendorStatus();
    res.json({
      ok: true,
      gateway: true,
      port: PORT,
      vendors: VENDORS.map((vendor) => ({
        id: vendor.id,
        section: vendor.section,
        placeholder: vendor.placeholder,
        ready: Boolean(status[vendor.id]),
        preview: maskKey(keys[vendor.id] ?? "")
      })),
      vendorKeys: status,
      vendorPreview: Object.fromEntries(VENDORS.map((vendor) => [vendor.id, maskKey(keys[vendor.id] ?? "")]))
    });
  })
);

app.put(
  "/api/vendors",
  requireAdmin,
  wrap(async (req, res) => {
    await setVendorKeys(req.body ?? {});
    res.json({ ok: true, vendorKeys: await vendorStatus() });
  })
);

app.get(
  "/api/users",
  requireAdmin,
  wrap(async (_req, res) => {
    const users = await listUsers();
    res.json({ users: users.map((user) => ({ ...user, key: undefined })) });
  })
);

app.post(
  "/api/users",
  requireAdmin,
  wrap(async (req, res) => {
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
    const user = await createUser({ name, maxBudgetUsd });
    res.json({
      id: user.id,
      name: user.name,
      key: user.key,
      maxBudgetUsd: user.maxBudgetUsd,
      notice: "Copy mã ngay. Sau này web chỉ hiện bản rút gọn."
    });
  })
);

app.post(
  "/api/users/:id/block",
  requireAdmin,
  wrap(async (req, res) => {
    const blocked = req.body?.blocked !== false;
    const user = await blockUser(req.params.id, blocked);
    if (!user) {
      res.status(404).json({ error: "Không thấy người dùng." });
      return;
    }
    res.json({ ok: true, blocked: user.blocked });
  })
);

app.patch(
  "/api/users/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const maxBudgetUsd = Number(req.body?.maxBudget);
    if (!Number.isFinite(maxBudgetUsd) || maxBudgetUsd < 0) {
      res.status(400).json({ error: "Trần tiền (USD) không hợp lệ." });
      return;
    }
    const user = await setUserBudget(req.params.id, maxBudgetUsd);
    if (!user) {
      res.status(404).json({ error: "Không thấy người dùng." });
      return;
    }
    res.json({ ok: true, maxBudgetUsd: user.maxBudgetUsd });
  })
);

app.get(
  "/api/logs",
  requireAdmin,
  wrap(async (_req, res) => {
    res.json({ logs: await listLogs() });
  })
);

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
  if (
    req.path.includes("/chat/completions") ||
    req.path.includes("/images") ||
    req.path.includes("/videos") ||
    req.path.includes("GenerateContent")
  ) {
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
