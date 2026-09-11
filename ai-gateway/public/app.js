const errorEl = document.querySelector("#error");
const loginCard = document.querySelector("#login-card");
const appEl = document.querySelector("#app");
const logoutBtn = document.querySelector("#logout");
let token = sessionStorage.getItem("ai-admin") || "";

document.querySelector("#origin").textContent = location.origin;
const openaiBase = `${location.origin}/v1`;
document.querySelector("#openai-base").textContent = openaiBase;
document.querySelector("#openai-base-2").textContent = openaiBase;
document.querySelector("#snippet-claude").textContent = `{
  "claudeCode.environmentVariables": [
    { "name": "ANTHROPIC_BASE_URL", "value": "${location.origin}" },
    { "name": "ANTHROPIC_AUTH_TOKEN", "value": "MÃ_NỘI_BỘ" }
  ]
}`;

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await post("/api/login", { password: document.querySelector("#password").value }, false);
  if (result?.token) {
    token = result.token;
    sessionStorage.setItem("ai-admin", token);
    showApp();
  }
});

logoutBtn.addEventListener("click", () => {
  token = "";
  sessionStorage.removeItem("ai-admin");
  loginCard.hidden = false;
  appEl.hidden = true;
  logoutBtn.hidden = true;
});

document.querySelector("#vendor-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {};
  for (const input of document.querySelectorAll("#vendor-fields [data-vendor]")) {
    body[input.getAttribute("data-vendor")] = input.value;
  }
  await put("/api/vendors", body);
  for (const input of document.querySelectorAll("#vendor-fields [data-vendor]")) {
    input.value = "";
  }
  await loadHealth();
});

document.querySelector("#create-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await post("/api/users", {
    name: document.querySelector("#user-name").value,
    maxBudget: Number(document.querySelector("#user-budget").value)
  });
  if (!result?.key) return;
  const box = document.querySelector("#new-key");
  box.hidden = false;
  box.innerHTML = "";
  const text = document.createElement("span");
  text.textContent = `${result.notice} `;
  const code = document.createElement("code");
  code.textContent = result.key;
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy mã";
  copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(result.key);
    copy.textContent = "Đã copy";
  });
  box.append(text, code, copy);
  document.querySelector("#user-name").value = "";
  await loadUsers();
});

document.querySelector("#refresh-logs").addEventListener("click", () => loadLogs());

if (token) showApp();

async function showApp() {
  loginCard.hidden = true;
  appEl.hidden = false;
  logoutBtn.hidden = false;
  await Promise.all([loadHealth(), loadUsers(), loadLogs()]);
}

async function loadHealth() {
  const data = await get("/api/health");
  if (!data) return;
  const vendors = Array.isArray(data.vendors) ? data.vendors : [];
  renderVendorFields(vendors);
  const marks = vendors.map((vendor) => `${escapeHtml(vendor.id)}: ${mark(vendor.ready, vendor.preview)}`);
  document.querySelector("#status").innerHTML = `
    <h2>Trạng thái</h2>
    <p>Cổng: <strong class="ok">${escapeHtml(location.origin)}</strong></p>
    <p>${marks.join(" · ")}</p>
  `;
}

function renderVendorFields(vendors) {
  const fields = document.querySelector("#vendor-fields");
  if (!fields || fields.dataset.ready === "1") return;
  fields.innerHTML = vendors
    .map(
      (vendor) =>
        `<label>${escapeHtml(vendor.id)} <input data-vendor="${escapeHtml(vendor.id)}" type="password" autocomplete="off" placeholder="${escapeHtml(vendor.placeholder || "")}" /></label>`
    )
    .join("");
  fields.dataset.ready = "1";
}

async function loadUsers() {
  const data = await get("/api/users");
  const users = data?.users ?? [];
  renderTable(
    "#users-table",
    ["Tên", "Mã", "Đã dùng / trần USD", ""],
    users.map((user) => [
      escapeHtml(user.name),
      escapeHtml(user.keyPreview || "—"),
      `${user.spendUsd ?? 0} / ${user.maxBudgetUsd === 0 ? "∞" : user.maxBudgetUsd}${user.blocked ? " (khóa)" : ""}`,
      userActions(user)
    ])
  );
  for (const button of document.querySelectorAll("[data-block]")) {
    button.addEventListener("click", async () => {
      const blocked = button.getAttribute("data-blocked") !== "true";
      await post(`/api/users/${button.getAttribute("data-block")}/block`, { blocked });
      await loadUsers();
    });
  }
  for (const button of document.querySelectorAll("[data-budget]")) {
    button.addEventListener("click", async () => {
      const next = window.prompt("Trần USD mới (0 = không trần)", button.getAttribute("data-current") || "10");
      if (next == null) return;
      await request(`/api/users/${button.getAttribute("data-budget")}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maxBudget: Number(next) })
      });
      await loadUsers();
    });
  }
}

function userActions(user) {
  const blockLabel = user.blocked ? "Mở khóa" : "Khóa";
  return `<button type="button" data-block="${escapeHtml(user.id)}" data-blocked="${user.blocked ? "true" : "false"}">${blockLabel}</button> <button type="button" data-budget="${escapeHtml(user.id)}" data-current="${escapeHtml(user.maxBudgetUsd)}">Sửa trần</button>`;
}

async function loadLogs() {
  const data = await get("/api/logs");
  const logs = data?.logs ?? [];
  renderTable(
    "#logs-table",
    ["Lúc", "Người", "Model", "Token", "USD", ""],
    logs.map((row) => [
      escapeHtml((row.at || "").replace("T", " ").slice(0, 19)),
      escapeHtml(row.name),
      escapeHtml(row.model),
      `${row.inputTokens ?? 0}+${row.outputTokens ?? 0}`,
      row.usd ?? 0,
      row.ok ? "ok" : escapeHtml(row.error || "lỗi")
    ])
  );
}

function renderTable(selector, headers, rows) {
  const table = document.querySelector(selector);
  const empty = `<tr><td colspan="${headers.length}">Chưa có dữ liệu.</td></tr>`;
  table.innerHTML = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${
    rows.length ? rows.map((cols) => `<tr>${cols.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : empty
  }</tbody>`;
}

async function get(url) {
  return request(url, { method: "GET" });
}

async function post(url, body, auth = true) {
  return request(
    url,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    auth
  );
}

async function put(url, body) {
  return request(url, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function request(url, options, auth = true) {
  hideError();
  const headers = { ...(options.headers || {}) };
  if (auth && token) headers.authorization = `Bearer ${token}`;
  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showError(data.error?.message || data.error || `Lỗi ${response.status}`);
      return null;
    }
    return data;
  } catch {
    showError("Không gọi được máy chủ.");
    return null;
  }
}

function mark(ok, preview) {
  return ok ? `<strong class="ok">đã lưu ${escapeHtml(preview || "")}</strong>` : '<span class="bad">chưa có</span>';
}

function showError(message) {
  errorEl.hidden = false;
  errorEl.textContent = message;
}

function hideError() {
  errorEl.hidden = true;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
