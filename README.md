# feature-flow

Vẽ + visualize luồng ship/debug một tính năng — giao diện kiểu *designed-to-scale*
(paper sáng, kể chuyện từng bước, bấm khối ra giải thích, chỉnh sửa trực tiếp).

## Cài đặt

```bash
pip install git+https://github.com/hoangvunghi/feature-flow
```

## Hai cách dùng

**1. Lên plan bằng code** (Claude vẽ luồng khi lập kế hoạch):
```python
from feature_flow import Flow
f = Flow("abc", "Tên luồng").meta(subtitle="…", duration="…", level="…", learn=[...])
s = f.start()
a = f.process("Bước A", step=1, explain="…")
c = f.decision("Điều kiện?", step=2, explain="…")
f.link(s, a); f.link(a, c)
f.link(c, f.process("Nhánh true", step=3), "có (true)")
f.narrate(1, "Tiêu đề bước", "Nội dung…", note="Cẩn thận…", note_type="warn", badge="VẤN ĐỀ")
f.save()                      # -> feature-flow/abc.json
```

**2. Bật server xem/sửa trên web:**
```bash
uvicorn feature_flow.server:app --port 4404 --reload
# mở http://127.0.0.1:4404
```
- **Play / ← → / R / Space**: chạy lần lượt từng bước.
- **Bấm 1 khối**: panel phải hiện giải thích khối đó.
- **Bật "Chỉnh sửa"**: thêm Bước/Nhánh, 🔗 nối 2 khối, sửa nhãn/giải thích + nội dung bước → **💾 Lưu** (ghi lại `feature-flow/<id>.json`).

## Cấu trúc
- `feature_flow/model.py` — `Flow/Node/Edge/Step` + đọc/ghi JSON.
- `feature_flow/server.py` — FastAPI: serve web + CRUD flow.
- `feature_flow/static/` — giao diện (Cytoscape + dagre, light paper).
- `feature-flow/*.json` — mỗi luồng 1 file (db nhẹ, git-friendly).
- `build_demo.py` — ví dụ dựng luồng bằng API.

## Nhúng vào web khác (chạy chung cổng, dưới subpath)

Frontend dùng đường dẫn **tương đối** nên chạy được ở gốc lẫn dưới subpath.

**A. Gắn vào app ASGI có sẵn** (vd Django `myproject/asgi.py`) — chung process, chung cổng:

```python
# myproject/asgi.py
from django.core.asgi import get_asgi_application
from starlette.applications import Starlette
from starlette.routing import Mount
from feature_flow.server import app as vf_app

django_app = get_asgi_application()
application = Starlette(routes=[
    Mount("/feature-flow", app=vf_app),   # → http://host:8000/feature-flow/
    Mount("/", app=django_app),
])
```

**B. Reverse proxy** (nginx / Kubernetes Ingress) — chạy riêng 1 service, proxy path `/feature-flow/` về nó.

## Hướng dẫn sử dụng có sẵn

3 tài liệu hướng dẫn (vẽ flow, viết tài liệu, dùng thư viện code) đóng gói kèm thư viện ở
`feature_flow/guides/` → thư mục flow nào cũng tự có, bấm **📖 Hướng dẫn** để mở. Sửa rồi lưu thì
bản sửa ghi vào thư mục flow của bạn (đè bản gốc theo id). Dựng lại: `python build_guide_doc.py`.

## Đổi thương hiệu (logo, favicon, tên, màu)

Tạo thư mục `brand/` ngay trong thư mục flow (vd `feature-flow/brand/`) — hoặc trỏ env `FF_BRAND_DIR`
sang chỗ khác. File nào có thì đè, thiếu thì giữ mặc định:

```
feature-flow/brand/
  brand.json     {"name": "Acme Flow"}        → tên ở header/footer + tiêu đề tab
  logo.svg       (hoặc .png/.jpg/.webp)        → logo header + footer
  favicon.svg    (hoặc .png/.ico)              → icon tab trình duyệt
  brand.css      :root{ --forest:#123456; … }  → đè màu (xem biến :root cuối style.css)
```

```bash
uvicorn feature_flow.server:app --port 4404                         # tự lấy feature-flow/brand/
FF_BRAND_DIR=./my-brand uvicorn feature_flow.server:app --port 4404  # hoặc thư mục khác
```

Chỗ lưu flow: đặt env `FF_FLOWS_DIR=/data/flows`. Không đặt thì mặc định là `<gốc project>/feature-flow/`
(gốc = thư mục cha gần nhất có `.git`, tính từ thư mục đang chạy; không có `.git` thì thư mục đang chạy).
Trong Docker thường không có `.git` → nên đặt `FF_FLOWS_DIR` tường minh.

> ⚠️ Chưa có auth riêng: khi mount kiểu A, request vào `/feature-flow` **không đi qua** middleware đăng nhập của Django — cần tự chặn (bọc auth) trước khi mở cho người ngoài.
