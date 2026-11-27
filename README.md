# feature-flow

Thư viện Python vẽ + visualize luồng ship/debug một tính năng: **API dựng luồng bằng code** + **web xem/sửa**
(kể chuyện từng bước, bấm khối ra giải thích, chỉnh sửa trực tiếp) **nhúng được vào app ASGI khác**.

## Cài đặt

```bash
pip install "feature-flow @ git+https://github.com/hoangvunghi/feature-flow@v0.2.0"
pip install "feature-flow[server] @ git+…"   # + uvicorn, nếu chạy riêng
```

Không muốn phụ thuộc repo ngoài lúc build: chép **nguyên** thư mục `feature_flow/` của bản phát hành vào
project, **không sửa bên trong** — mọi tuỳ biến đi qua tham số `create_app(...)` (xem dưới), nâng cấp = chép đè.

## 1. Dựng luồng bằng code

```python
from feature_flow import Flow

f = Flow("abc", "Tên luồng").meta(subtitle="…", duration="…", level="…")
s = f.start()
a = f.process("Bước A", step=1, explain="…")
c = f.decision("Điều kiện?", step=2, explain="…")
f.link(s, a); f.link(a, c)
f.link(c, f.process("Nhánh true", step=3), "có (true)")
f.narrate(1, "Tiêu đề bước", "Nội dung…", note="Cẩn thận…", note_type="warn", badge="VẤN ĐỀ")
f.save("docs/flows")                 # → docs/flows/abc.json  (không truyền: thư mục mặc định, xem dưới)

Flow.load("abc", "docs/flows").to_markdown()   # Mermaid + JSON nhúng, nhập lại được: Flow.from_markdown
```

**Icon + nhãn nổi** (sơ đồ kiến trúc): `f.process("Server A", icon="server", badge="cpu 40%")`.
Icon có sẵn: `server database user laptop cloud balancer queue file gear lock mail clock api chart check alert`.
Khi ▶ Trình chiếu, mỗi bước có chấm chạy dọc mũi tên dẫn vào khối vừa hiện.

Ví dụ đầy đủ (nhóm, vòng lặp, tài liệu dạng blog, kiến trúc có icon): `examples/build_*.py` → `examples/flows/`.

**Nhiều người cùng sửa:** web gửi kèm phiên bản lúc mở; ai lưu trên bản cũ sẽ được hỏi trước khi ghi đè
(API trả 409). Mỗi lần lưu/xoá giữ bản cũ ở `<flows_dir>/.history/<id>/` (30 bản) — nút **🕘 Lịch sử** để khôi phục.

## 2. Nhúng web vào app của bạn

```python
from feature_flow import create_app

ff = create_app(
    "data/flows",                                  # thư mục lưu flow (*.json)
    brand_dir="brand",                             # logo/tên/sắc độ (tuỳ chọn)
    can_edit=lambda request: is_editor(request),   # True/False hoặc hàm(request) → bool
    home={"url": "/", "label": "← Trang chủ"},     # nút quay về app của bạn
)
```

Gắn dưới subpath (frontend dùng đường dẫn tương đối nên chạy được ở gốc lẫn subpath):

```python
# Starlette / FastAPI
app.mount("/feature-flow", ff)

# Django — myproject/asgi.py
from starlette.applications import Starlette
from starlette.routing import Mount
application = Starlette(routes=[Mount("/feature-flow", app=ff), Mount("/", app=get_asgi_application())])
```

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `flows_dir` | env `FF_FLOWS_DIR`, không có thì `<gốc git>/feature-flow/` | Nơi đọc/ghi flow |
| `brand_dir` | không | Thư mục thương hiệu (dưới) |
| `can_edit` | `True` | `False` → UI chỉ đọc (qua `GET api/me`) **và** API ghi trả 403 |
| `home` | `"home"` trong `brand.json` | Nút về trang chủ; chỉ nhận path `/…` hoặc `http(s)://` |
| `guides` | `True` | Hiện 3 tài liệu hướng dẫn đóng gói kèm |
| `security_headers` | `True` | CSP (JS chỉ từ app, script inline băm sha256 tự động) + X-Frame-Options, nosniff, Referrer-Policy |

> ⚠️ `create_app` **không tự đăng nhập**: xác thực người dùng là việc của app nhúng (middleware/ASGI bọc
> ngoài). `can_edit` chỉ quyết định quyền sửa sau khi đã vào được.

JS (Cytoscape, dagre, marked, DOMPurify, turndown) để sẵn trong `feature_flow/static/vendor/` — không gọi CDN.
Nguồn + sha256 từng file: `static/vendor/SOURCES.txt`.

## 3. Chạy riêng

```bash
uvicorn feature_flow.server:app --port 4404 --reload     # cấu hình qua env FF_FLOWS_DIR / FF_BRAND_DIR
```

- **Play / ← → / R / Space**: chạy lần lượt từng bước · **bấm 1 khối**: panel phải hiện giải thích.
- **Bật "Chỉnh sửa"**: thêm bước/nhánh, nối khối, sửa nhãn/giải thích → **💾 Lưu**.

## Thương hiệu

File nào có thì đè, thiếu thì giữ mặc định:

```
brand/
  brand.json   {"name": "Acme Flow", "theme": "fincon", "home": {"url": "/", "label": "← Acme"}}
  logo.svg     (hoặc .png/.jpg/.webp)   → logo header + footer
  favicon.svg  (hoặc .png/.ico)         → icon tab
  brand.css    :root{ --forest:#123456; … }   → đè màu (biến :root cuối style.css)
```

## Hướng dẫn sử dụng có sẵn

3 tài liệu (vẽ flow, viết tài liệu, dùng thư viện) đóng gói ở `feature_flow/guides/` — bấm **📖 Hướng dẫn**.
Sửa rồi lưu thì bản sửa ghi vào `flows_dir` (đè bản gốc theo id). Dựng lại: `python scripts/build_guides.py`.

## Phát triển

```bash
uv run --extra test pytest -q
```

- `feature_flow/model.py` — `Flow/Node/Edge/Step/Group` + JSON/Markdown.
- `feature_flow/server.py` — `create_app` (FastAPI) + `app` mặc định.
- `feature_flow/static/` — giao diện + `vendor/`.
