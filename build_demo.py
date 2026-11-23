# path: build_demo.py
"""Dựng flow demo bằng API thư viện — CŨNG là cách Claude 'vẽ luồng khi lên plan'.
Chạy: python build_demo.py   (ghi ra flows/ship-feature.json)
"""
from feature_flow import Flow

f = Flow("ship-feature", "Quy trình ship một tính năng")
f.group = "Hướng dẫn chung"
f.meta(
    subtitle="Từ ý tưởng → dựng → verify → gặp khó (debug loop) → review → ship → deploy.",
    duration="tổng quan", level="Nội bộ",
    learn=[
        "Vì sao phải hiểu vấn đề TRƯỚC khi cắt nhỏ",
        "Verify bằng SỐ thay vì đoán",
        "Gặp khó thì khoanh tầng top-down, sửa gốc",
        "Review → ship → deploy an toàn",
    ],
)

# --- khối (step = thứ tự reveal) ---
s = f.start()
plan = f.process("Lên plan / brainstorm", step=1,
                 explain="Hiểu đủ vấn đề, chốt phạm vi. Chưa code vội.")
build = f.process("Dựng nhỏ từng bước", step=2,
                  explain="Cắt thành bước nhỏ độc lập, mỗi bước verify được.")
verify = f.process("Verify bằng số", step=3,
                   explain="Đo bằng query/con số trước khi tin vào giả thuyết.")
cond = f.decision("Gặp khó / có bug?", step=4,
                  explain="Kết quả khác dự đoán, lỗi, 2 nguồn lệch nhau → rẽ debug.")
debug = f.process("Debug top-down", step=5,
                  explain="Khoanh tầng bằng bằng chứng (log/số), tìm GỐC rồi mới sửa.")
review = f.process("Code review", step=6,
                   explain="Soi lại bằng góc nhìn khác; /code-review nếu cần.")
ship = f.process("Ship: commit + push", step=7,
                 explain="Commit gọn theo nhóm, push nhánh.")
deploy = f.process("Deploy: build image + rollout", step=8,
                   explain="Build image + bump phiên bản + rollout; xác nhận chạy thật.")
e = f.end()
for n in f.nodes:
    if n.id == e:
        n.step = 9

f.link(s, plan); f.link(plan, build); f.link(build, verify); f.link(verify, cond)
f.link(cond, debug, "có (true)"); f.link(debug, verify, "đo lại")
f.link(cond, review, "không (false)")
f.link(review, ship); f.link(ship, deploy); f.link(deploy, e)

# --- kể chuyện từng bước (panel phải) ---
f.narrate(1, "Lên plan", "Bắt đầu từ việc hiểu vấn đề, không nhảy vào code.\n"
          "Chốt phạm vi + điều đã loại trừ. Càng rõ ở đây, càng ít sửa sai về sau.", badge="BƯỚC")
f.narrate(2, "Cắt nhỏ", "Chia tính năng thành các bước nhỏ, độc lập.\n"
          "Mỗi bước phải tự verify được — đừng ôm cả cục.", badge="BƯỚC")
f.narrate(3, "Verify bằng số", "Mọi kết luận về data phải có 1 phép đo chứng minh.\n"
          "Đo con số đích bằng query ad-hoc (vài giây) TRƯỚC khi chạy full.",
          note="Đừng giả định — kể cả khi 'chắc chắn'.", note_type="warn")
f.narrate(4, "Gặp khó?", "Nếu kết quả khác dự đoán, có lỗi, hay 2 nguồn 'phải giống mà lại khác'\n"
          "→ đây là dấu hiệu khác tầng/grain. Rẽ sang debug.", badge="VẤN ĐỀ")
f.narrate(5, "Debug top-down", "Khoanh tầng hỏng bằng BẰNG CHỨNG trước (log, số), rồi mới zoom.\n"
          "Sửa GỐC, không sửa triệu chứng — một guard ở hàm chung < vá mọi caller.",
          note="Fix xong → quay lại verify bằng số.", note_type="info")
f.narrate(6, "Review", "Soi lại bằng góc nhìn độc lập. Đưa code, đừng đưa kết luận.", badge="BƯỚC")
f.narrate(7, "Ship", "Commit gọn theo nhóm logic, push nhánh. Không tự ý push khi chưa được bảo.", badge="BƯỚC")
f.narrate(8, "Deploy", "Build image + bump phiên bản + rollout.\n"
          "Job/lịch chạy mới có thể bị tắt mặc định → nhớ bật lại.",
          note="Deploy là bước dễ quên hậu kiểm — xong phải xác nhận chạy thật.", note_type="warn")
f.narrate(9, "Xong", "Tính năng đã lên prod và được xác nhận bằng số. 🎉", badge="GIẢI PHÁP")

p = f.save()
print("saved:", p)
