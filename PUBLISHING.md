# Hướng dẫn Publish — Claude Auto-Yes

Tài liệu này mô tả toàn bộ quy trình đưa extension lên **Visual Studio Marketplace**
(và tuỳ chọn **Open VSX** cho VSCodium/Cursor/Windsurf), publish thủ công lẫn tự
động qua CI/CD.

---

## 0. Chuẩn bị một lần (chỉ làm lần đầu)

### 0.1. Tài khoản & Publisher trên VS Marketplace

1. Đăng nhập [Azure DevOps](https://dev.azure.com) bằng tài khoản Microsoft.
2. Vào <https://marketplace.visualstudio.com/manage> → **Create publisher**.
   - **ID** publisher phải **trùng** với trường `publisher` trong `package.json`
     (hiện đang là `nguyenkhanh`). Nếu đặt ID khác, sửa lại `package.json`.

### 0.2. Tạo Personal Access Token (PAT)

1. Vào <https://dev.azure.com> → avatar góc phải → **Personal access tokens** →
   **New Token**.
2. Cấu hình:
   - **Organization**: chọn **All accessible organizations** (bắt buộc, nếu chỉ
     chọn 1 org thì vsce sẽ báo lỗi 401).
   - **Scopes**: bấm **Show all scopes** → **Marketplace** → tick **Manage**.
   - **Expiration**: tối đa (365 ngày).
3. **Copy token ngay** (chỉ hiện 1 lần). Đây là `VSCE_PAT`.

### 0.3. (Tuỳ chọn) Open VSX cho VSCodium / Cursor / Windsurf

1. Đăng nhập <https://open-vsx.org> bằng GitHub.
2. Vào **Settings → Access Tokens** → tạo token = `OVSX_PAT`.
3. Ký **Publisher Agreement** (Settings → Namespaces), và tạo namespace trùng
   tên publisher: `npx ovsx create-namespace nguyenkhanh -p <OVSX_PAT>`.

---

## 1. Publish thủ công (từ máy)

```bash
npm install
npm test                 # 13 test phải xanh
npm run icon             # (chỉ khi sửa icon) sinh lại media/icon.png
npm run package          # tạo claude-auto-yes-<version>.vsix để kiểm tra

# Đăng nhập 1 lần rồi publish:
npx vsce login nguyenkhanh      # dán VSCE_PAT khi được hỏi
npm run publish                 # = vsce publish
```

Tăng version tự động khi publish (đồng thời tạo git tag `vX.Y.Z`):

```bash
npx vsce publish patch    # 0.0.1 -> 0.0.2   (hoặc: minor | major)
```

Publish lên Open VSX (tuỳ chọn):

```bash
npx ovsx publish claude-auto-yes-<version>.vsix -p <OVSX_PAT>
```

---

## 2. Publish tự động qua CI/CD (khuyến nghị)

CI/CD đã được cấu hình sẵn trong [.github/workflows/](.github/workflows/):

| Workflow | Kích hoạt khi | Việc làm |
|----------|---------------|----------|
| `ci.yml` | push / PR vào `main` | cài deps, `tsc` compile, chạy `vitest`, `vsce package` rồi upload `.vsix` làm artifact |
| `publish.yml` | push tag `v*.*.*` | kiểm tra tag khớp version, build + test, publish lên VS Marketplace (và Open VSX nếu có token), tạo GitHub Release + đính kèm `.vsix` |

### 2.1. Khai báo secrets trên GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Bắt buộc | Giá trị |
|--------|----------|---------|
| `VSCE_PAT` | ✅ | PAT ở bước 0.2 |
| `OVSX_PAT` | ⬜ (tuỳ chọn) | Token Open VSX ở bước 0.3 |

> Không có `OVSX_PAT` thì bước publish Open VSX tự bỏ qua, không làm fail pipeline.

### 2.2. Phát hành một version

```bash
# 1) Cập nhật version trong package.json + CHANGELOG.md, commit
# 2) Tạo tag trùng version và push:
git tag v0.0.1
git push origin v0.0.1
```

Tag `v*` sẽ chạy `publish.yml` → tự build, test, publish và tạo Release.

> ⚠️ **Tag phải trùng `version` trong `package.json`.** Workflow sẽ kiểm tra và
> fail nếu lệch (tránh publish nhầm version).

---

## 3. Checklist trước khi publish

- [ ] `version` trong `package.json` đã tăng và khớp tag dự định.
- [ ] `CHANGELOG.md` có mục cho version mới.
- [ ] `npm test` xanh, `npm run compile` không lỗi.
- [ ] `npm run package` chạy được; mở `.vsix` (đổi đuôi `.zip`) kiểm tra có
      `media/icon.png`, `out/`, `media/*.cjs`; **không** lẫn `src/`, `*.map`.
- [ ] `publisher` trong `package.json` khớp publisher đã tạo trên Marketplace.
- [ ] `repository` URL đã trỏ đúng repo thật (hiện là placeholder
      `github.com/nguyenkhanh/claude-auto-yes`).

---

## 4. Sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|-------------|--------------------------|
| `401 Unauthorized` khi publish | PAT sai scope (cần **Marketplace → Manage**) hoặc không chọn **All accessible organizations**. Tạo lại PAT. |
| `ERROR Missing publisher name` | `publisher` trống/sai trong `package.json`. |
| `ERROR The repository field is missing` | Đã thêm `repository` vào `package.json` (đã xử lý). |
| Icon không hiện trên Marketplace | `icon` phải là **PNG ≥ 128×128** (không nhận SVG). Chạy `npm run icon`. |
| Version đã tồn tại | Marketplace không cho ghi đè — phải tăng version. |
