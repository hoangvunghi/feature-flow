# path: build_blog_demo.py
"""Blog demo (kind=doc) nhiều section — để xem render markdown + mục lục TOC.
Chạy: uv run python build_blog_demo.py   ->  flows/blog-debug-pipeline.json
"""
from feature_flow import Flow

MD = r"""# Debug một pipeline dữ liệu: tư duy & checklist

> Report chỉ cho bạn *triệu chứng*. Việc của bạn là tìm *nguyên nhân gốc* — và sửa đúng một chỗ mà mọi caller đi qua.

Bài viết tóm tắt cách mình khoanh vùng và sửa lỗi trong pipeline **Bronze → Silver → Gold**, rút ra từ những lần "hôm qua đúng, hôm nay sai".

## 1. Hiểu vấn đề trước khi cắt nhỏ

Đừng nhảy ngay vào chi tiết. Trả lời 3 câu hỏi:

1. Lỗi xuất hiện ở **tầng nào** (ingest / transform / report)?
2. Nó **đổi từ bao giờ** — có khớp một lần deploy / đổi nguồn không?
3. Có phải **2 nguồn "phải giống mà lại khác"** không?

> Mâu thuẫn 2 nguồn gần như luôn là dấu hiệu **khác GRAIN hoặc khác TẦNG**. Soi cả hai trước khi sửa.

## 2. Verify bằng SỐ, đừng đoán

Mọi kết luận về data phải có **một phép đo** chứng minh — kể cả khi "chắc chắn".

```sql
-- đo con số đích (vài giây) TRƯỚC khi chạy full report (10 phút)
SELECT report_date,
       COUNT(*)                          AS n_got,
       MAX(source_row_count)             AS n_exp
FROM   iceberg.bronze.some_table
GROUP  BY report_date
ORDER  BY report_date DESC
LIMIT  7;
```

Nếu `n_got < n_exp` → đã nạp đứt giữa chừng. Đó là **bằng chứng**, không phải phỏng đoán.

## 3. Khoanh tầng top-down

Chia từ **vấn đề TO → nhỏ dần**, mỗi bước khẳng định bằng bằng chứng:

- **OOM?** Pod Python hay Trino heap? → đọc log → rồi mới tới query nào.
- **Thiếu dòng?** So `count(*)` vs `source_row_count` theo ngày.
- **Lệch số tiền?** Kiểm grain từng bảng (per-giao-dịch vs per-kỳ vs snapshot).

### Mẹo nhỏ

| Triệu chứng | Nghi ngờ đầu tiên | Cách đo |
|---|---|---|
| Số nhảy mỗi lần chạy | layout / thứ tự không ổn định | so 2 lần chạy liền |
| Hôm qua đúng nay sai | 1 lần ingest / deploy | `git log` + đối chiếu ngày |
| 2 báo cáo lệch | khác tầng / grain | đếm distinct khóa từng bên |

## 4. Sửa GỐC, không sửa triệu chứng

Một report đặt tên *triệu chứng*. Trước khi sửa, **grep mọi caller** của hàm bạn định đụng.

```python
# LAZY = ROOT: một guard ở hàm chung < vá ở mọi caller
def resolve_dpd(due_date, giao):
    if due_date is None:
        return 0                     # sửa một chỗ — mọi nhánh hưởng
    return max(0, (giao - due_date).days)
```

> Vá đúng path mà ticket nói tới sẽ để lại mọi sibling-caller **vẫn hỏng**.

## 5. Review → ship → deploy

- **Review**: đưa *code*, đừng đưa *kết luận* — để người review nhìn độc lập.
- **Ship**: commit gọn theo nhóm logic; không tự ý push khi chưa được bảo.
- **Deploy**: build image + rollout; DAG mới mặc định **PAUSED** → nhớ unpause tay.

---

### Checklist rút gọn

- [x] Khoanh được tầng hỏng bằng bằng chứng
- [x] Có con số chứng minh nguyên nhân
- [x] Sửa ở hàm chung (gốc)
- [x] Xác nhận lại bằng số sau khi sửa

*Happy debugging.* 🐛→✅
"""

f = Flow("blog-debug-pipeline", "Debug pipeline dữ liệu")
f.kind = "doc"
f.group = "Blog"
f.subtitle = "Tư duy khoanh vùng + checklist"
f.doc_md = MD
print("saved:", f.save())
