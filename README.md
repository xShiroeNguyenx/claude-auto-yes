<p align="center">
  <img src="media/icon.png" width="120" alt="Claude Auto-Yes" />
</p>

# Claude Auto-Yes (VSCode Extension)

[![Version](https://img.shields.io/visual-studio-marketplace/v/nguyenkhanh.claude-auto-yes?label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=nguyenkhanh.claude-auto-yes)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/nguyenkhanh.claude-auto-yes)](https://marketplace.visualstudio.com/items?itemName=nguyenkhanh.claude-auto-yes)
[![CI](https://github.com/nguyenkhanh/claude-auto-yes/actions/workflows/ci.yml/badge.svg)](https://github.com/nguyenkhanh/claude-auto-yes/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Extension VSCode gộp **2 tính năng cho Claude Code**, điều khiển bằng nút trên status bar — không cần backend:

1. **Auto-Yes** — tự động đồng ý ("Yes") các dialog *"Allow this command?"* khi chạy **task dài hơi nhiều ngày**, nhưng **vẫn chặn lệnh nguy hiểm** và **tắt được ngay**. Cờ **tự hết hạn** sau N giờ.
2. **Live Usage** — hiện **5h / 7d limit + context%** (và cost) trên status bar, đọc trực tiếp từ status line của Claude Code (chỉ có với tài khoản Pro/Max, sau phản hồi đầu tiên).

> Auto-Yes hoạt động qua **PreToolUse hook** có sẵn của Claude Code (ổn định, không "dò dialog rồi click"). Live Usage hoạt động qua **statusLine bridge**. Extension chỉ lo việc bật/tắt + đăng ký/gỡ cấu hình vào `~/.claude/settings.json` (luôn backup).

## Các nút trên status bar (góc trái)

| Nút | Ý nghĩa | Bấm để |
|-----|---------|--------|
| `$(check) Auto-Yes: ON 23h` / `$(circle-slash) Auto-Yes: OFF` | Trạng thái auto-yes + thời gian còn lại | Bật/tắt auto-yes |
| `$(pulse) Live: ON` / `$(circle-slash) Live: OFF` | Công tắc Live Usage | Bật/tắt Live Usage |
| `$(pulse) 5h 42% · 7d 17% · ctx 33%` | Số liệu live (chỉ hiện khi có dữ liệu) | Bật/tắt Live Usage |

Lệnh tương ứng trong Command Palette (`Ctrl+Shift+P`): `Claude Auto-Yes: Toggle Auto-Yes`, `Toggle Live Usage`, `Uninstall Auto-Yes Hook`, `Show Auto-Yes Log`, `Enable/Disable Live Usage`.

## Cài đặt

**Cách 1 — từ Marketplace** (sau khi đã publish):

```bash
code --install-extension nguyenkhanh.claude-auto-yes
```

Hoặc mở **Extensions** trong VSCode và tìm "Claude Auto-Yes".

**Cách 2 — build & đóng gói thành `.vsix` rồi cài:**

```bash
npm install
npm run compile
npm run package        # tạo claude-auto-yes-0.0.1.vsix
```

Cài file `.vsix`: VSCode → **Extensions** → menu `...` → **Install from VSIX…**, hoặc:

```bash
code --install-extension claude-auto-yes-0.0.1.vsix
```

Phát triển: mở thư mục trong VSCode rồi nhấn **F5** (Run Extension) để chạy thử trong Extension Development Host.

## Cách hoạt động

```
Auto-Yes:   bấm nút → ghi cờ ~/.claude/auto-yes.json (enabled + expiresAt)
            (lần đầu) đăng ký PreToolUse hook vào settings.json, trỏ tới bản hook
            copy ổn định trong globalStorage của extension.
            Claude muốn chạy tool → hook đọc cờ → allow / ask / deny.

Live Usage: bấm nút → set settings.json `statusLine` trỏ tới bridge (globalStorage)
            → Claude Code gọi bridge mỗi lần render status line → bridge ghi snapshot
            ~/.claude/claude-autoyes-live.json → extension theo dõi & hiện lên status bar.
```

Khi cờ auto-yes **TẮT / hết hạn / lỗi** ⇒ hook im lặng ⇒ Claude Code hỏi như bình thường (fail-safe — không bao giờ tự allow khi có lỗi). Mọi quyết định auto-yes được ghi vào `~/.claude/auto-yes.log` (JSONL) — mở nhanh bằng lệnh **Show Auto-Yes Log**.

## Chính sách an toàn (auto-yes khi BẬT)

| Nhóm | Hành vi |
|------|---------|
| `rm -rf`, `Remove-Item -Recurse -Force`, `format c:`, `diskpart`, `mkfs`, `Format-Volume`, `Clear-Disk` | **deny** (chặn) |
| `git push --force/--tags`, `git reset --hard`, `git rebase`, `git filter-branch`, `git clean -f` | **deny** |
| `npm/yarn/pnpm publish`, `gh release` | **deny** |
| `shutdown`, `Stop/Restart-Computer`, `reg delete`, `Set-ExecutionPolicy`, `curl … \| sh`, `iex` | **deny** |
| `git commit`, `git push`, `git tag` | **ask** (vẫn hiện dialog — tôn trọng quy tắc "không tự commit") |
| Edit/Write vào `.env`, `.git/`, `.claude/`, `*credential*`, `id_rsa`, `*.pem`, `*secret*` | **ask** |
| Mọi thao tác khác (đọc/ghi file dự án, `npm test`, `php artisan …`, build, lint…) | **allow** (tự Yes) |

Lớp phòng thủ thứ 2: khi đăng ký hook, extension cũng thêm vài rule `permissions.deny` vào settings.json — chặn cứng lệnh huỷ diệt **kể cả khi hook bị tắt/lỗi** (deny luôn thắng).

**Tuỳ chỉnh không cần sửa code:** thêm `extraBlock` / `extraConfirm` (mảng regex string) vào file cờ `~/.claude/auto-yes.json`:

```json
{ "enabled": true, "expiresAt": "2026-06-21T10:00:00Z",
  "extraBlock": ["docker\\s+system\\s+prune"], "extraConfirm": ["terraform\\s+apply"] }
```

## Cấu hình

| Setting | Mặc định | Ý nghĩa |
|---------|----------|---------|
| `claudeAutoYes.autoYes.hours` | `24` | Auto-yes tự tắt sau bao nhiêu giờ khi bật |

## ⚠️ Lưu ý: chỉ dùng MỘT cách bật auto-yes / live usage

Cả ba cách dưới đây đều ghi vào `~/.claude/settings.json`. **Không bật trùng** để tránh 2 PreToolUse hook hoặc 2 `statusLine` xung đột:

- **Extension này** (khuyến nghị) — bật/tắt bằng nút status bar.
- **Script CLI legacy** trong thư mục `scripts/` (`auto-yes-on.ps1`, `install.cjs`…) — dùng khi không chạy VSCode.
- **Extension `claude-tracker`** — cũng có sẵn 2 tính năng này. Nếu đã bật ở đó thì đừng bật lại ở đây.

Gỡ hook auto-yes bất kỳ lúc nào bằng lệnh **Claude Auto-Yes: Uninstall Auto-Yes Hook** (hoặc `scripts/uninstall.cjs` cho bản CLI).

## Cấu trúc repo

```
claude-auto-yes/
├─ package.json            # manifest extension
├─ src/
│  ├─ extension.ts         # activate: status bar + 6 command
│  ├─ types.ts             # LiveUsage
│  ├─ services/            # autoYesController, statuslineInstaller, liveUsageWatcher
│  ├─ ui/                  # autoYesStatusBar, liveUsageToggleStatusBar, liveUsageStatusBar
│  └─ __tests__/           # vitest cho hook + bridge
├─ media/
│  ├─ icon.png             # icon Marketplace (256×256, sinh từ scripts/make-icon.cjs)
│  ├─ icon.svg             # icon dạng vector
│  ├─ auto-yes-hook.cjs    # PreToolUse hook (Node, không dependency)
│  └─ statusline-bridge.cjs# statusLine bridge (Node, không dependency)
├─ .github/workflows/      # CI (ci.yml) + publish tự động (publish.yml)
├─ hooks/ , scripts/       # bản CLI legacy + make-icon.cjs (không nằm trong VSIX)
├─ CHANGELOG.md , LICENSE , PUBLISHING.md
└─ PLAN.md , settings.snippet.json
```

## Kiểm thử

```bash
npm test     # vitest: 13 test cho auto-yes-hook + statusline-bridge
```

## Phát hành

Xem [PUBLISHING.md](PUBLISHING.md) cho quy trình đầy đủ (tạo publisher, PAT,
publish thủ công và qua CI/CD). Lịch sử thay đổi ở [CHANGELOG.md](CHANGELOG.md).
