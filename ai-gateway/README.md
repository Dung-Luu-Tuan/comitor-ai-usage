# Cổng quản lý AI nội bộ

Tách khỏi sản phẩm Công việc: Express cổng **3100** là cổng LLM (Claude Code / Cline / Cursor Chat).

Giao diện admin: đăng nhập Comitor rồi mở **http://localhost:3050/ai-usage**
(`pnpm dev` ở gốc repo này). Toàn bộ app là sản phẩm AI Usage — không lọc theo slug workspace.

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

Key hãng và mã nội bộ nằm ở `data/store.json` trên máy này — không commit file đó.

## Việc dev (cùng một mã)

URL cổng LLM: `http://localhost:3100`

### Claude Code (VS Code) — chỉ Claude

Settings JSON:

```json
{
  "claudeCode.environmentVariables": [
    { "name": "ANTHROPIC_BASE_URL", "value": "http://localhost:3100" },
    { "name": "ANTHROPIC_AUTH_TOKEN", "value": "sk-team-…" }
  ]
}
```

Claude Code không có menu chọn Grok/Gemini. Muốn ba nhà → dùng Cline / Continue / Cursor Chat.

### Cline / Continue (VS Code) — Claude, Grok, Gemini

- Base URL: `http://localhost:3100/v1`
- API key: mã nội bộ
- Model: `claude-sonnet-4-6` · `grok-3` · `gemini-2.5-flash`

### Cursor Chat / Agent

Models → OpenAI API Key = mã nội bộ → Override Base URL = `http://localhost:3100/v1` → Add model đúng ba id trên.

Cursor Tab và Ctrl+K vẫn đi backend Cursor, không qua cổng này.

## Chưa có key hãng

Vẫn tạo mã và khai trên VS Code được. Hỏi AI sẽ trả lỗi bảo admin dán key (HTTP 503). Khi admin dán xong, không cần cấp mã mới.

## Ghi chú

- Tiền trên nhật ký là **ước tính** theo bảng giá gần đúng; hóa đơn thật nằm ở Anthropic / xAI / Google.
- Streaming gửi một khối (đủ cho Claude Code / Cline); chưa phải token-by-token.
- Đây là công cụ nội bộ trên mạng tin cậy: key lưu plaintext trong JSON.
