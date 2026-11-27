# path: scripts/build_guides.py
"""3 tài liệu hướng dẫn tách riêng (kind=doc), cùng folder "Hướng dẫn":
  - huong-dan-flow     : vẽ & dùng sơ đồ flow
  - huong-dan-docs     : viết tài liệu (kiểu Word)
  - huong-dan-library  : vẽ luồng bằng thư viện code
Chạy: uv run python scripts/build_guides.py   (ghi vào feature_flow/guides/ — đóng gói kèm thư viện,
mọi thư mục flow đều tự có hướng dẫn)
"""
from feature_flow import Flow
from feature_flow.model import GUIDES_DIR

GROUP = "Hướng dẫn"


def make(doc_id, title, subtitle, md):
    f = Flow(doc_id, title)
    f.kind = "doc"
    f.group = GROUP
    f.subtitle = subtitle
    f.doc_md = md
    print("saved:", f.save(GUIDES_DIR))


# ───────────────────────── 1) SƠ ĐỒ FLOW ─────────────────────────
make("huong-dan-flow", "Hướng dẫn: Sơ đồ flow",
     "Xem, chỉnh sửa, nhóm, ghi chú, trình chiếu",
     r"""# Hướng dẫn: Sơ đồ flow

> **Sơ đồ (flow)** là flowchart: các khối (bước / nhánh / start / end) nối bằng mũi tên, trình chiếu lần lượt, bấm khối hiện giải thích.

## Sidebar như một cây thật

- **+ Thêm mới** → chọn **📁 Folder** hoặc **⚙ Chức năng** (sơ đồ / tài liệu).
- **Kéo-thả** một chức năng **vào folder** hoặc **ra vùng trống** để đưa ra ngoài.
- Chuột phải để **🙈 ẩn** folder/file; nút **👁 Hiện mục đã ẩn** bật lại.
- Mỗi luồng có **URL riêng** `#/<id>` — dán vào là vào thẳng.

## Xem một sơ đồ

- **▶ Trình chiếu** — chạy lần lượt từng bước, panel phải kể chuyện.
- **← / →** hoặc thanh *TRONG LUỒNG NÀY* để nhảy bước.
- **Bấm một khối** → chọn + hiện giải thích (giữ nguyên tỉ lệ zoom).
- **⛶ Phóng to** · **⌗ Sắp xếp** (dàn gọn) · **⤢** vừa khung · **✦** mũi tên chảy.

## Chỉnh sửa

Bật **✎ Chỉnh sửa** (góc phải) hoặc chuột phải nền → *Bật chỉnh sửa*.

- **Thêm khối**: panel phải hoặc chuột phải nền.
- **Nối 2 khối**: rê lên mép khối → kéo tay cầm sang khối kia; thả ra chỗ trống → **mũi tên vô danh**.
- **Sửa khối**: bấm khối → nhãn, bước (reveal), giải thích, **màu khối**.
- **Mũi tên**: bấm chọn; bấm đúp sửa nhãn; kéo 2 đầu nối lại.
- **Hoàn tác/Làm lại** `Ctrl+Z` / `Ctrl+Y` · **Lưu** `Ctrl+S`.

> Vị trí khối **đóng băng** khi kéo tay. Muốn dàn lại thì bấm **⌗ Sắp xếp**.

## Nhóm (group box)

- **Tạo**: chuột phải nền → *▭ Tạo nhóm* → **kéo khoanh vùng** các khối → đặt tên.
- **Resize**: bấm khung → **4 tay cầm góc** → kéo phóng to / thu nhỏ.
- **Di chuyển**: kéo giữa khung → cả cụm đi theo.
- **Mô tả**: điền ở bảng; chế độ xem bấm khung sẽ hiện mô tả.

## Ghi chú

- **Ghi chú luồng**: khối *GHI CHÚ* bên phải (checklist tick được) — **+ Thêm ghi chú**, Enter thêm dòng.
- **Ghi chú của khối**: chuột phải khối → *📝 Thêm ghi chú khối* → ô nhỏ cạnh khối, ✓ lưu / ✕ hủy. Một khối **nhiều ghi chú**, có **dấu ❗đỏ** (hoặc số) ở góc; hiện luôn trong panel *GHI CHÚ* (nhóm theo khối) và trong thẻ nổi khi phóng to.

## Phím tắt

| Phím | Tác dụng |
|---|---|
| `Ctrl+S` | Lưu |
| `Ctrl+Z` / `Ctrl+Y` | Hoàn tác / Làm lại |
| `← / →` | Bước trước / sau · `R` phát lại · `Space` chạy/dừng |
| `Esc` | Thoát phóng to / hủy thao tác |

---
*Xem thêm: **Hướng dẫn: Viết tài liệu** và **Hướng dẫn: Dùng thư viện code**.*
""")

# ───────────────────────── 2) VIẾT TÀI LIỆU ─────────────────────────
make("huong-dan-docs", "Hướng dẫn: Viết tài liệu",
     "Soạn kiểu Word, bảng, mục lục — không cần biết Markdown",
     r"""# Hướng dẫn: Viết tài liệu

> **Tài liệu / Blog** là trang viết kiểu Word. Gõ trực tiếp, bên dưới tự biên dịch ra Markdown để lưu — không cần biết cú pháp.

## Tạo & soạn

- Tạo: **+ Thêm mới** → **⚙ Chức năng** → **📄 Tài liệu**.
- Bật **✎ Chỉnh sửa** → hiện **thanh công cụ**, gõ vào vùng soạn.
- Bên phải render ngay + sinh **mục lục** từ các heading — bấm để nhảy tới.

## Thanh công cụ

- **H1 H2 H3 ¶** — tiêu đề / văn bản thường
- **B** *I* — đậm / nghiêng · danh sách · ❝ trích dẫn
- **`</>`** — khối code (Enter xuống dòng **trong** khối, bấm ¶ để thoát)
- **🔗** — chèn link

## Bảng

- Nút **▦ Bảng** → một hộp điền **tiêu đề bảng + số cột + số dòng**.
- **Tiêu đề cột** tự gõ; **Tab** nhảy ô (ô cuối → thêm hàng).
- **Chuột phải** trong bảng → thêm/xóa hàng-cột; **bôi nhiều hàng/cột rồi xóa** như Word.
- **Tiêu đề bảng** (caption) nằm dưới, **căn giữa + in nghiêng**.

## Lưu & chia sẻ

- **Lưu** `Ctrl+S` hoặc 💾.
- **🔗 Chia sẻ**: Riêng tư / Công khai + copy link.
- **⬇ Xuất / ⬆ Nhập Markdown** ở sidebar.

---
*Xem thêm: **Hướng dẫn: Sơ đồ flow**.*
""")

# ───────────────────────── 3) THƯ VIỆN CODE ─────────────────────────
make("huong-dan-library", "Hướng dẫn: Dùng thư viện code",
     "Vẽ luồng bằng Python (cũng là cách Claude vẽ khi lên plan)",
     r"""# Hướng dẫn: Dùng thư viện code

> Vẽ luồng bằng Python rồi mở trên web. Cũng là cách Claude "vẽ luồng khi lên plan".

## Ví dụ cơ bản

```python
from feature_flow import Flow

f = Flow("vi-du", "Luồng ví dụ")
a = f.start()
b = f.process("Làm việc A", step=1, explain="Mô tả bước A")
c = f.decision("Ổn chưa?", step=2)
f.link(a, b); f.link(b, c)
f.link(c, b, "chưa → làm lại")   # cạnh quay ngược = vòng lặp
f.save()                          # -> feature-flow/vi-du.json
```

Chạy file đó (`uv run python vi-du.py`) rồi mở luồng trên web.

## API chính

| Hàm | Ý nghĩa |
|---|---|
| `f.start() / f.end()` | khối tròn bắt đầu / kết thúc |
| `f.process(label, explain=, step=)` | khối bước (hộp bo góc) |
| `f.decision(label, ...)` | khối rẽ nhánh (thoi) |
| `f.link(a, b, "nhãn")` | nối mũi tên a → b |
| `f.narrate(n, title, body, note=, badge=)` | nội dung bước n ở panel phải |
| `f.meta(subtitle=, duration=, level=)` | thông tin luồng |
| `f.save()` | ghi ra `feature-flow/<id>.json` |

## Thêm màu, nhóm, ghi chú

```python
from feature_flow import Flow
from feature_flow.model import Group

f = Flow("demo", "Demo")
a = f.process("Verify", step=1)
by = {n.id: n for n in f.nodes}
by[a].color = "#cfe3b2"                               # màu khối
by[a].notes = [{"t": "Đo bằng số trước", "done": False}]   # ghi chú khối (nhiều)

f.groups.append(Group(id="g1", label="Nhóm", explain="Mô tả nhóm", members=[a]))
f.notes = [{"t": "Ghi chú luồng", "done": False}]     # checklist panel phải
f.save()
```

## Tài liệu (kind=doc)

```python
f = Flow("bai-viet", "Bài viết")
f.kind = "doc"
f.doc_md = "# Tiêu đề\n\nNội dung **Markdown**…"
f.save()
```

Xem thêm: `build_demo.py`, `build_loop_demo.py`, `build_showcase.py`.

---
*Xem thêm: **Hướng dẫn: Sơ đồ flow** và **Hướng dẫn: Viết tài liệu**.*
""")
