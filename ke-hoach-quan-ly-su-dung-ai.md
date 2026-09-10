# Kế hoạch: quản lý sử dụng AI trong team

## Mục tiêu

Quản lý được từng người trong team: đang dùng AI nào, model nào, bao nhiêu token / hết bao nhiêu tiền. Gợi ý model phù hợp từng việc khi code.

Dev vẫn làm việc trên VS Code, Claude app hoặc Cursor. Không bắt đổi sang IDE mới.

Hai vai trò: **dev** và **admin** (quản lý kiêm admin).

## Cách hoạt động

Công ty mua API của từng hãng (Claude, Grok, Gemini, …), trả theo lượng dùng.

Admin đăng nhập **web quản lý**, thêm key lấy từ trang từng hãng. Những key này **không đưa cho dev**.

Mỗi dev được cấp **một mã nội bộ**. Khi code, câu hỏi đi qua hệ thống công ty: ghi nhận người + model + token, rồi hệ thống mới gọi đúng hãng bằng key admin đã khai. Web dùng để khai key, cấp mã và xem báo cáo — không phải chỗ gõ prompt.

Tiền từng câu hỏi trừ bên trang hãng tương ứng (Claude / xAI / Google), trên tài khoản công ty. Hệ thống nội bộ chỉ tổng hợp và cắt trần từng người.

## Ví dụ cấp mã

Admin thêm trên web:

| Hãng | Key (mẫu) |
|---|---|
| Claude | `sk-ant-api03-8xK2mPqR7nWvYcL4tHj0bF6sUaEd9ZwG` |
| Grok | `xai-4bN8qT2vLmX0cYwR7pKsH3jFdA6uEgZ1` |
| Gemini | `AIzaSyD8kL2nPqR4tWvYcH7bF0sUaE9mZ3xK1q` |

Nguyễn Văn A được cấp một mã: `sk-team-nva-7f3c2a91e8b04d56`, được dùng cả ba hãng. A không nhận ba key ở bảng trên.

Khi A chọn model Claude, hệ thống dùng key Claude. Chọn Grok thì dùng key Grok. Chọn Gemini thì dùng key Gemini.

## Việc admin làm

1. Đăng ký API trên trang từng hãng, nạp tiền, copy key.
2. Vào web: thêm từng key (Claude, Grok, Gemini, …).
3. Tạo từng dev: một mã nội bộ, các AI được phép dùng, trần token hoặc tiền theo tháng. Có thể cấm model đắt.
4. Treo bảng “việc khi code → nên dùng model nào”.
5. Gửi mỗi dev: địa chỉ hệ thống, mã nội bộ, hướng dẫn khai trên tool họ dùng.
6. Hàng tuần: xem báo cáo người × AI × model × token × tiền; khóa mã hoặc nạp thêm tiền hãng khi cần.

## Việc dev làm

1. Nhận một mã nội bộ.
2. Khai mã trên tool đang dùng (mỗi tool một chỗ; cùng một mã).
3. Code như cũ. Đổi model / đổi tool theo hướng dẫn, không xin thêm mã.
4. Vào web xem phần của mình nếu muốn biết đã dùng bao nhiêu. Hết trần thì bị chặn, báo admin.

Không lấy key trên trang Claude / Grok / Google. Không share mã nội bộ.

### Claude Code trên VS Code — dùng Claude

`Ctrl+Shift+P` → Preferences: Open User Settings (JSON):

```json
{
  "claudeCode.environmentVariables": [
    { "name": "ANTHROPIC_BASE_URL", "value": "https://ai.cong-ty.internal" },
    { "name": "ANTHROPIC_AUTH_TOKEN", "value": "sk-team-nva-7f3c2a91e8b04d56" }
  ]
}
```

Mở Claude Code và hỏi như bình thường. Cài đặt này chỉ dành cho Claude Code, dùng cho Claude.

Claude Desktop: Developer → Configure Third-Party Inference → cùng địa chỉ và cùng mã.

### Cline hoặc Continue trên VS Code — chọn Claude / Grok / Gemini

Cài extension Cline hoặc Continue. Trong cài đặt extension:

- Địa chỉ: `https://ai.cong-ty.internal/v1`
- Mã: `sk-team-nva-7f3c2a91e8b04d56`

Trên khung chat, chọn model: `claude-sonnet-4-6`, `grok-3`, hoặc `gemini-2.5-flash`.

Không dùng khối `claudeCode.environmentVariables` cho hai extension này.

### Cursor — Chat / Agent

`Ctrl+Shift+J` → Models:

- OpenAI API Key: `sk-team-nva-7f3c2a91e8b04d56`
- Override OpenAI Base URL: `https://ai.cong-ty.internal/v1`
- Add model: `claude-sonnet-4-6`, `grok-3`, `gemini-2.5-flash`
- Chat (Ctrl+L): chọn model trên menu

Gợi ý Tab và sửa nhanh Ctrl+K của Cursor đi dịch vụ Cursor, không vào báo cáo nội bộ.

## Trần từng người

Có. Trần gắn trên mã nội bộ của từng người. Hết trần thì chỉ người đó bị chặn.

Có thể đặt theo token/tháng, tiền/tháng, hoặc cấm từng AI / model. Nên lấy **tiền** làm trần chính vì model đắt và rẻ không cùng giá theo token.

## Gợi ý model khi code

| Việc | Nên dùng |
|---|---|
| Viết / sửa feature hằng ngày | Model cỡ giữa (vd. Claude Sonnet) |
| Kiến trúc, refactor lớn, bug khó | Model mạnh (vd. Claude Opus) |
| Hỏi nhanh, tóm tắt, dịch | Model nhẹ (vd. Gemini Flash) |
| Review pull request | Model cỡ giữa hoặc mạnh |

Admin chốt bảng; dev chọn theo bảng.

## Cần duyệt

- Đổi sang API; không share một tài khoản gói (Max / Plus) cho cả team.
- Admin khai nhiều key hãng trên web; mỗi dev một mã nội bộ.
- Trần từng người (token và/hoặc tiền).
- Phạm vi v1: Claude, Grok, Gemini.
