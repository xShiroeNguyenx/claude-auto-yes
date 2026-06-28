# Changelog

Tất cả thay đổi đáng chú ý của extension này được ghi tại đây.

Định dạng theo [Keep a Changelog](https://keepachangelog.com/),
và dự án tuân theo [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.0.1] - 2026-06-26

### Added
- **Auto-Yes** cho Claude Code qua PreToolUse hook: tự đồng ý các lệnh an toàn,
  **chặn cứng** lệnh huỷ diệt (`rm -rf`, `git push --force`, `npm publish`…),
  **hỏi lại** với `git commit`/ghi file nhạy cảm. Cờ tự hết hạn sau N giờ.
- **Live Usage** trên status bar: 5h / 7d limit + context% (và cost) đọc trực
  tiếp từ statusLine của Claude Code qua bridge cục bộ.
- 6 lệnh trong Command Palette + các nút điều khiển trên status bar.
- Lớp phòng thủ thứ 2: thêm `permissions.deny` vào `settings.json` (deny luôn
  thắng kể cả khi hook tắt/lỗi). Luôn backup `settings.json` trước khi sửa.
- Icon Marketplace + bộ test (vitest) cho hook và bridge.

[Unreleased]: https://github.com/xShiroeNguyenx/claude-auto-yes/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/xShiroeNguyenx/claude-auto-yes/releases/tag/v0.0.1
