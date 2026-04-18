# MERN Vendor Hub — n8n + Telegram Topics

Luồng: **GitHub (webhook)** → n8n Code → **Telegram Forum** (đúng Topic). Figma / Google Docs mở rộng theo cùng pattern (webhook hoặc Schedule + Google node).

## 1. Lấy `chat_id` và `message_thread_id` (Topic ID)

1. Tạo **Supergroup**, bật **Topics** (Forum).
2. Thêm **BotFather** bot vào group, đặt quyền gửi tin trong topic.
3. **Chat ID** (thường âm, dạng `-100…`):
   - Gửi một tin trong group, mở `https://api.telegram.org/bot<TOKEN>/getUpdates`, tìm `chat.id`; hoặc dùng bot `@userinfobot` / `@getidsbot` (chọn bot uy tín).
4. **Topic ID** = `message_thread_id`:
   - Vào đúng **Topic** (ví dụ `#Review`), gửi một tin test.
   - Trong `getUpdates`, message có `message_thread_id` — đó là ID cần điền vào `mapping.json` → `telegram.topics.review`, v.v.
5. Bot phải có quyền **Manage topics** hoặc được add vào topic đó (tùy client).

## 2. Biến workflow n8n (bắt buộc)

Trong n8n: **Settings → Variables** (hoặc Credentials, tùy bản):

| Tên | Nội dung |
|-----|-----------|
| `mappingJson` | Toàn bộ JSON từ `config/mapping.example.json` (đã điền `chatId`, `topics`, map GitHub→Telegram). |
| `telegramBotToken` | Token bot (không commit vào git). |

Sau khi chỉnh `n8n/scripts/code-nodes.js`, chạy `node n8n/scripts/compose-vendor-workflow.mjs` để tái sinh `workflows/vendor-notification-hub.json` rồi import lại n8n.

## 3. GitHub Webhook (ổn định)

1. Repo → **Settings → Webhooks → Add webhook**.
2. Payload URL: URL production của node **Webhook** (`…/webhook/vendor-github`), **application/json**.
3. Bật các sự kiện:
   - **Pull requests** (đủ `opened`, `edited`, `closed`, `ready_for_review`, `review_requested`, …).
   - **Workflow runs** (để bắt CI fail — cần `action: completed` + `conclusion: failure`).
4. SSL **Enable**, secret tùy chọn; n8n có thể verify HMAC bằng Code node (mở rộng sau).

## 4. Figma

1. Figma **Developer / Webhooks** (team/plan hỗ trợ): trỏ URL tới workflow riêng (duplicate workflow GitHub, đổi path webhook).
2. Payload `comment_published` khác nhau theo version — dùng **Execute once** trong n8n, copy JSON thật vào Code node, chỉnh `routeFigmaComment()` trong `code-nodes.js` cho khớp field (`file_key`, `comment.id`, …).
3. Deep link comment: thường dùng URL file + `?node-id=` hoặc link `comment` từ payload nếu Figma cung cấp.

## 5. Google Docs (poll 5–10 phút)

- **Drive API** không “poll comment” trực tiếp đơn giản như một node; thực tế hay dùng:
  - **Google Apps Script** + time-driven trigger → POST vào n8n webhook khi có comment mới; hoặc
  - **HTTP Request** trong n8n Schedule → `comments.list` với `fileId` (Docs API), lưu `lastSynced` trong n8n **Static Data** hoặc DB.
- Lọc `@mention`: so khớp `mapping.googleDocs.responsibleNames` trong Code node.

## 6. GitHub Actions (Foundation First)

Workflow `vendor-pr-branch-conventions.yml` kiểm tra:

- Nhánh: `type/TASK-ID-mo-ta` (vd `feature/SOCIAL-101-add-login`).
- Tiêu đề PR có `[TASK-ID]` (vd `[SOCIAL-101]`).

Có thể tắt workflow `pr-title-check.yml` cũ nếu hai bộ rule xung đột.

## 7. MarkdownV2 & nút

- `escapeMarkdownV2` trong `code-nodes.js` — mọi ký tự đặc biệt trong user-generated text phải escape.
- Nút **Inline keyboard**: `reply_markup` trong body `sendMessage` (workflow dùng HTTP Request).

## 8. Import workflow

**Workflows → Import from File** → chọn `workflows/vendor-notification-hub.json` → gán biến → **Activate** → copy Webhook URL vào GitHub.
