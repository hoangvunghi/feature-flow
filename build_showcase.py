# path: build_showcase.py
"""Flow mẫu dùng FULL tính năng: màu khối, nhóm (có mô tả), vòng lặp,
ghi chú của khối (nhiều), ghi chú luồng (checklist), trình chiếu từng bước.
Chạy: uv run python build_showcase.py  ->  flows/demo-day-du.json
"""
from feature_flow import Flow
from feature_flow.model import Group

f = Flow("demo-day-du", "Demo đầy đủ tính năng")
f.group = "Hướng dẫn chung"
f.meta(
    subtitle="Ship một tính năng: plan → dựng → verify → gặp khó (loop) → review → ship.",
    duration="demo", level="Đủ tính năng",
)

s = f.start()
plan = f.process("Lên plan", step=1, explain="Hiểu đủ vấn đề, chốt phạm vi trước khi code.")
build = f.process("Dựng nhỏ từng bước", step=2, explain="Cắt thành bước nhỏ độc lập, verify được.")
verify = f.process("Verify bằng số", step=3, explain="Đo bằng query/con số trước khi tin giả thuyết.")
cond = f.decision("Gặp khó / có bug?", step=4, explain="Khác dự đoán / lỗi → rẽ debug.")
debug = f.process("Debug top-down", step=5, explain="Khoanh tầng bằng bằng chứng, sửa GỐC.")
review = f.process("Code review", step=6, explain="Soi lại bằng góc nhìn khác.")
ship = f.process("Ship: commit + push", step=7, explain="Commit gọn, push nhánh.")
e = f.end()
for n in f.nodes:
    if n.id == e:
        n.step = 8

f.link(s, plan); f.link(plan, build); f.link(build, verify); f.link(verify, cond)
f.link(cond, debug, "có (true)"); f.link(debug, verify, "đo lại ↺")   # vòng lặp debug
f.link(cond, review, "không (false)"); f.link(review, ship); f.link(ship, e)

# màu khối tự chọn (desaturate theo tông theme)
by_id = {n.id: n for n in f.nodes}
by_id[verify].color = "#cfe3b2"   # xanh nhấn
by_id[debug].color = "#e8b3b0"    # đỏ nhạt (chỗ hay đau)
by_id[ship].color = "#cbbae6"     # tím

# ghi chú của khối (nhiều ghi chú / 1 khối → dấu ! đỏ ở góc)
by_id[verify].notes = [
    {"t": "Đo query ad-hoc TRƯỚC khi chạy full report", "done": False},
    {"t": "Khớp số rồi mới export", "done": True},
]
by_id[cond].notes = [{"t": "2 nguồn 'phải giống mà khác' = khác grain", "done": False}]

# nhóm bọc thân phát triển + mô tả (bấm khung lúc xem sẽ hiện)
f.groups.append(Group(
    id="g_dev", label="Vòng phát triển",
    explain="Dựng → verify → gặp khó → debug rồi quay lại verify. Lặp tới khi sạch bug.",
    color="#8c9a3c", members=[build, verify, cond, debug],
))

# ghi chú luồng (checklist panel phải)
f.notes = [
    {"t": "Hiểu vấn đề trước khi cắt nhỏ", "done": True},
    {"t": "Verify bằng SỐ, đừng đoán", "done": True},
    {"t": "Sửa gốc ở hàm chung, không vá từng caller", "done": False},
]

f.narrate(1, "Lên plan", "Bắt đầu từ hiểu vấn đề, chốt phạm vi.", badge="BƯỚC")
f.narrate(2, "Cắt nhỏ", "Chia thành bước nhỏ, mỗi bước tự verify được.", badge="BƯỚC")
f.narrate(3, "Verify bằng số", "Mọi kết luận phải có 1 phép đo chứng minh.",
          note="Đừng giả định — kể cả khi 'chắc chắn'.", note_type="warn")
f.narrate(4, "Gặp khó?", "Khác dự đoán / lỗi / 2 nguồn lệch → rẽ debug.", badge="VẤN ĐỀ")
f.narrate(5, "Debug top-down", "Khoanh tầng bằng bằng chứng rồi mới zoom; sửa gốc.",
          note="Fix xong → quay lại verify.", note_type="info")
f.narrate(6, "Review", "Đưa code, đừng đưa kết luận.", badge="BƯỚC")
f.narrate(7, "Ship", "Commit gọn theo nhóm, push nhánh.", badge="GIẢI PHÁP")
f.narrate(8, "Xong", "Tính năng lên nhánh, đã verify bằng số. 🎉", badge="GIẢI PHÁP")

print("saved:", f.save())
