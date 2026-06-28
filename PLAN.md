# Plan: Auto-Yes cho Claude Code (task dài ngày)

## Context (Bối cảnh)
Khi chạy các task dài hơi nhiều ngày, Claude Code liên tục hiện dialog *"Allow this command?"* (Bash/PowerShell/Edit…) và đứng chờ bạn bấm **Yes**, làm gián đoạn các phiên chạy không người trực. Mong muốn: một cơ chế **auto-yes bật-được-theo-nhu-cầu** để tự đồng ý các thao tác an toàn trong lúc chạy dài ngày, nhưng **vẫn chặn các lệnh nguy hiểm/không thể hoàn tác**, và **tắt được ngay**.

Phát hiện chính khi khảo sát: **không cần viết extension VSCode riêng**. Claude Code đã expose đúng "móc" cần thiết qua `PreToolUse` hook (trả về `permissionDecision: "allow" | "deny" | "ask"`) + permission rules trong `settings.json`. Đây là cách được hỗ trợ chính thức, ổn định, không phụ thuộc UI (một extension đi "dò dialog rồi click Yes" sẽ rất mong manh và không kiểm soát được nội dung lệnh).

Quyết định đã chốt với người dùng:
1. **Cách làm:** Bộ hook + settings (script Node nhỏ trả `allow`, kèm denylist + log + bật/tắt).
2. **Mức an toàn:** Cho phép hầu hết, **chặn nguy hiểm bằng denylist** (tôn trọng rule "không tự commit" trong CLAUDE.md).
3. **Bật/tắt:** **File cờ** trong `~/.claude/`, đổi tức thì (không cần restart) + **tự hết hạn** sau N giờ.

Ràng buộc môi trường: Windows 11, shell chính PowerShell (dialog trong ảnh là lệnh PowerShell), Bash cũng có. Node.js chắc chắn có sẵn (Claude Code yêu cầu). `settings.json` toàn cục rất lớn (~153KB) ⇒ phải **merge cẩn thận + backup**, tuyệt đối không ghi đè.

---

## Kiến trúc tổng quan

```
Claude muốn chạy 1 tool (Bash/PowerShell/Edit/Write/…)
        │
        ▼
  PreToolUse hook  →  node auto-yes.cjs   (đọc tool_name + command từ stdin)
        │
        ├─ Đọc file cờ ~/.claude/auto-yes.json
        │     • không tồn tại / enabled=false / đã quá expiresAt  → KHÔNG output, exit 0
        │       (defer: Claude hỏi như bình thường)
        │
        └─ Cờ đang bật & còn hạn:
              • command khớp BLOCK-list   → permissionDecision="deny"  (chặn hẳn)
              • command khớp CONFIRM-list  → permissionDecision="ask"   (vẫn hiện dialog)
              • còn lại                    → permissionDecision="allow" (tự Yes)
        │
        ▼
  Ghi 1 dòng JSONL vào ~/.claude/auto-yes.log (audit qua đêm)
```

Khi cờ **tắt** ⇒ hook im lặng ⇒ Claude Code hoạt động y như mặc định (vẫn hỏi). Khi **bật** ⇒ tự Yes mọi thứ trừ denylist.

**Vì sao dùng hook + file cờ thay vì đặt `defaultMode: "bypassPermissions"` toàn cục:** file cờ cho phép bật/tắt **tức thì, không cần restart session**, và **không** đổi hành vi mặc định của mọi phiên khác. Phù hợp đúng use-case "bật khi cần chạy dài ngày".

---

## Các file

Toolkit (source of truth, nằm trong repo dự án):
`d:\NGUYENKHANH\GLOBAL_WORKSPACE\claude-auto-yes\`
- `PLAN.md` — bản plan này.
- `README.md` — hướng dẫn cài + dùng (tiếng Việt).
- `hooks/auto-yes.cjs` — script hook (Node CommonJS; `.cjs` để khỏi lệ thuộc `package.json type`).
- `scripts/auto-yes-on.ps1` — bật cờ: `auto-yes-on.ps1 [-Hours 24]`.
- `scripts/auto-yes-off.ps1` — tắt cờ (xoá file cờ).
- `scripts/auto-yes-status.ps1` — xem trạng thái + thời gian còn lại + 20 dòng log cuối.
- `settings.snippet.json` — đoạn `hooks` mẫu để merge vào settings.json.

Trạng thái runtime (đặt ngoài repo, trong config Claude — không commit):
- `~/.claude/auto-yes.json` — file cờ (state). Ví dụ:
  ```json
  { "enabled": true, "expiresAt": "2026-06-14T10:00:00Z", "note": "deploy task" }
  ```
- `~/.claude/auto-yes.log` — log JSONL mỗi quyết định.

Cấu hình toàn cục:
- `C:\Users\DELL\.claude\settings.json` — **merge** thêm 1 entry `hooks.PreToolUse` + vài rule `permissions.deny` (lớp phòng thủ thứ 2). **Backup trước khi sửa.**

> Hook được tham chiếu bằng **đường dẫn tuyệt đối** tới `claude-auto-yes\hooks\auto-yes.cjs` (vì là hook toàn cục, `${CLAUDE_PROJECT_DIR}` không cố định). Repo là single source of truth, không cần bước copy/đồng bộ.

---

## Logic hook (`hooks/auto-yes.cjs`)

Đọc JSON từ stdin: `{ tool_name, tool_input: { command, file_path, ... }, ... }`.

1. **Bọc toàn bộ trong try/catch.** Bất kỳ lỗi nào (parse hỏng, đọc cờ lỗi) ⇒ `exit 0` không output ⇒ defer về luồng hỏi bình thường. **Không bao giờ auto-allow khi có lỗi** (fail-safe = an toàn).
2. Đọc `~/.claude/auto-yes.json` (resolve home bằng `os.homedir()`). Nếu thiếu file / `enabled !== true` / `Date now > expiresAt` ⇒ defer (exit 0, im lặng).
3. Lấy chuỗi lệnh từ `tool_input.command` (Bash/PowerShell) hoặc đường dẫn từ `tool_input.file_path` (Edit/Write/MultiEdit/NotebookEdit).
4. So khớp **BLOCK-list** → output `permissionDecision: "deny"` + lý do; ghi log; exit 0.
5. So khớp **CONFIRM-list** → output `permissionDecision: "ask"` + lý do; ghi log; exit 0.
6. Còn lại → output `permissionDecision: "allow"`; ghi log; exit 0.

Định dạng output (đúng schema Claude Code):
```json
{ "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "auto-yes ON (hết hạn 2026-06-14T10:00Z)"
}}
```
Ghi log mỗi dòng: `{ "ts", "tool", "command|path", "decision", "rule" }`.

---

## Denylist / policy (bắt mẫu cho CẢ bash lẫn PowerShell)

**BLOCK (deny — chặn hẳn, không thể hoàn tác / phá huỷ):**
- Xoá đệ quy: `rm -rf|-fr`, `Remove-Item .* -Recurse .* -Force` (và biến thể `rm -r -f`), `rmdir /s`, `del /s|/q`
- Format/đĩa: `format `, `diskpart`, `mkfs`, `Format-Volume`, `Clear-Disk`
- Git phá lịch sử/đẩy mạnh: `git push .*--force|-f`, `git reset --hard`, `git rebase`, `git filter-branch`, `git clean -*f`, `git update-ref -d`
- Publish/release ra ngoài: `npm publish`, `gh release`, `git push --tags`
- Hệ thống: `shutdown`, `Stop-Computer`, `Restart-Computer`, `reg delete`, `Set-ExecutionPolicy`
- Tải-rồi-thực-thi: `curl ... | sh`, `iwr ... | iex`, `Invoke-Expression` trên nội dung tải về

**CONFIRM (ask — vẫn hiện dialog dù auto-yes đang bật; tôn trọng CLAUDE.md):**
- `git commit`, `git push`, `git tag` (quy tắc "không tự commit/push" của bạn)
- Edit/Write vào đường nhạy cảm: `**/.env`, `**/.git/**`, `**/.claude/**`, `**/*credential*`, `**/id_rsa*`, secrets/keys

**ALLOW (mọi thứ còn lại khi cờ bật):** đọc/ghi file dự án, `npm test`, `npm run *`, `php artisan *`, build, lint, `git status/diff/log`, di chuyển trong code, v.v.

> Danh sách để ngay đầu file hook dưới dạng mảng regex, dễ chỉnh. Sentinel JSON có thể khai thêm `extraBlock`/`extraConfirm` để mở rộng mà không sửa code.

---

## Lớp phòng thủ thứ 2: `permissions.deny` trong settings.json
Thêm vài rule deny ở tầng settings để **kể cả khi hook bị tắt/cấu hình sai**, các lệnh huỷ diệt vẫn bị chặn (deny luôn thắng, kể cả ở bypass mode):
```json
"permissions": { "deny": [
  "Bash(rm -rf *)", "Bash(git push --force *)", "Bash(git reset --hard *)",
  "PowerShell(Remove-Item * -Recurse -Force *)", "Edit(.git/**)", "Edit(.claude/**)"
] }
```

## Đăng ký hook (merge vào `~/.claude/settings.json`)
```json
"hooks": { "PreToolUse": [ { "matcher": "*", "hooks": [
  { "type": "command",
    "command": "node \"D:\\NGUYENKHANH\\GLOBAL_WORKSPACE\\claude-auto-yes\\hooks\\auto-yes.cjs\"" }
] } ] }
```
`matcher: "*"` để bao mọi tool; hook tự thoát nhanh khi cờ tắt nên overhead không đáng kể.

---

## Toggle (PowerShell scripts)
- `auto-yes-on.ps1 -Hours 24` → ghi `~/.claude/auto-yes.json` với `enabled:true`, `expiresAt = now + Hours`. In ra "Auto-yes BẬT, hết hạn lúc …".
- `auto-yes-off.ps1` → xoá file cờ. In "Auto-yes ĐÃ TẮT".
- `auto-yes-status.ps1` → đọc cờ (bật/tắt + còn bao lâu) + in 20 dòng cuối của log.

Đổi cờ có hiệu lực **ngay ở lần tool tiếp theo**, không cần restart Claude Code.

---

## An toàn (tóm tắt nguyên tắc)
- Fail-safe: hook lỗi/parse hỏng/không đọc được cờ ⇒ **defer về hỏi tay**, không bao giờ tự allow.
- Tự hết hạn ⇒ không lo "lỡ bật rồi quên".
- Denylist + `permissions.deny` (2 lớp) cho lệnh huỷ diệt.
- git commit/push/tag luôn rơi vào CONFIRM ⇒ không bao giờ tự chạy (khớp CLAUDE.md).
- Mọi quyết định đều log lại để soi sau.
- Backup `settings.json` trước khi merge.

---

## Verification (sau khi cài)
1. **Cờ tắt (mặc định):** chạy `auto-yes-status.ps1` thấy OFF. Yêu cầu Claude chạy 1 lệnh an toàn (vd `php artisan route:list`) ⇒ **vẫn hiện dialog** như cũ.
2. **Test trực tiếp hook** (không cần Claude): pipe JSON giả vào hook và kiểm output, ví dụ:
   ```powershell
   '{"tool_name":"Bash","tool_input":{"command":"npm test"}}' | node hooks\auto-yes.cjs
   ```
   - Cờ tắt ⇒ không output.
   - Sau `auto-yes-on.ps1` ⇒ `permissionDecision:"allow"`.
   - Với `{"command":"git commit -m x"}` ⇒ `"ask"`. Với `{"command":"rm -rf /tmp/x"}` ⇒ `"deny"`.
3. **End-to-end:** bật cờ, nhờ Claude chạy 1 lệnh an toàn ⇒ **không còn dialog**, tool chạy thẳng; nhờ chạy lệnh `git commit` thử ⇒ vẫn bị hỏi. Kiểm `auto-yes.log` thấy đúng quyết định.
4. **Hết hạn:** đặt `-Hours 0` (hoặc sửa `expiresAt` về quá khứ) ⇒ hook quay lại defer (hỏi tay).
5. Tắt cờ, xác nhận hành vi trở lại bình thường.
