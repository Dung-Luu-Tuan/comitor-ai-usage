# Cổng quản lý AI nội bộ

Tách khỏi sản phẩm Công việc: Express cổng **3100** là cổng LLM (Claude Code / Cline / Cursor Chat).

Giao diện admin: đăng nhập Comitor rồi mở **http://localhost:3050/ai-usage**
(`pnpm dev` ở gốc repo này). Dữ liệu key/usage theo workspace đang đăng nhập, lưu trên Postgres.

## Chạy

Hai tiến trình:

1. Ở gốc repo: `pnpm dev` → http://localhost:3050
2. Trong `ai-gateway`:

```bat
copy .env.example .env
pnpm install --ignore-workspace
pnpm start
```

→ http://localhost:3100 (Claude Code trỏ vào đây)

`pnpm install` phải chạy **trong** `ai-gateway`. Thư mục này cố ý không thuộc workspace pnpm của Comitor.

## Việc admin (trang /ai-usage)

1. Dán key Claude / Grok / Gemini khi đã có (ô trống = giữ key cũ).
2. Tạo người + trần USD → **copy mã nội bộ ngay**. Trần `0` = không giới hạn.
3. Nhật ký: người, model, token, tiền ước tính.
4. Khóa / mở khóa mã; sửa trần khi cần.

Key hãng và mã nội bộ nằm ở PostgreSQL (cùng `DATABASE_URL` với app 3050, schema `ai-usage`). File `data/store.json` nếu còn thì chỉ được nhập một lần khi admin mở `/ai-usage`.

## Việc dev (cùng một mã)

URL cổng LLM: `http://localhost:3100`

### Claude Code (VS Code) — chỉ Claude

1. Cài extension Claude Code trong VS Code.
2. `Ctrl+Shift+P` (Windows) / `Cmd+Shift+P` (macOS) → Preferences: Open User Settings (JSON).
3. Dán:

```json
{
  "claudeCode.environmentVariables": [
    { "name": "ANTHROPIC_BASE_URL", "value": "http://localhost:3100" },
    { "name": "ANTHROPIC_AUTH_TOKEN", "value": "sk-team-…" }
  ]
}
```

Không thêm `/v1`. Reload Window rồi hỏi như bình thường.

Claude Code không có menu chọn Grok/Gemini. Muốn ba nhà → dùng Cline / Continue / Cursor Chat. Chưa dán key Claude trên `/ai-usage` thì hỏi sẽ lỗi 503.

### Claude Desktop (ứng dụng trên máy)

Desktop **không** đọc settings.json của VS Code.

1. Mở ứng dụng Claude Desktop.
2. Help → Troubleshooting → Enable Developer Mode (app khởi động lại, hiện menu Developer).
3. Developer → Configure Third-Party Inference.
4. Điền: Inference provider = **Gateway** · Credential kind = **Static API key** · Gateway base URL = `http://localhost:3100` · Gateway API key = mã `sk-team-…` · Auth scheme = **Bearer**.

Nếu hiện `Gateway was unreachable`: cổng 3100 phải đang chạy, URL là `http` chứ không phải `https`.

### Cline / Continue (VS Code) — Claude, Grok, Gemini

- Base URL: `http://localhost:3100/v1`
- API key: mã nội bộ
- Model: `claude-sonnet-4-6` · `grok-3` · `gemini-3.6-flash` · `deepseek-flash` · `deepseek-v4-pro`

### Cursor Chat / Agent

Models → OpenAI API Key = mã nội bộ → Override Base URL = `http://localhost:3100/v1` → Add model đúng ba id trên.

Cursor Tab và Ctrl+K vẫn đi backend Cursor, không qua cổng này.

## Chưa có key hãng

Vẫn tạo mã và khai trên VS Code được. Hỏi AI sẽ trả lỗi bảo admin dán key (HTTP 503). Khi admin dán xong, không cần cấp mã mới.

## Ghi chú

- Tiền trên nhật ký là **ước tính** từ bản chụp bảng giá LiteLLM (cron tuần hoặc `pnpm catalog:prices`); cổng đọc lại file theo mtime, không cần restart. Không khớp id thì để trống USD. Hóa đơn thật nằm ở Anthropic / xAI / Google.
- Streaming gửi một khối (đủ cho Claude Code / Cline); chưa phải token-by-token.
- Đây là công cụ nội bộ trên mạng tin cậy: key lưu plaintext trong JSON.
