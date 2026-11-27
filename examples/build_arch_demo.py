# path: examples/build_arch_demo.py
"""Sơ đồ kiến trúc có ICON + NHÃN NỔI — request đi qua cân bằng tải tới các server, session giữ ở cache.
Chạy: python examples/build_arch_demo.py   ->  examples/flows/arch-load-balancer.json
Bấm ▶ Trình chiếu: mỗi bước có chấm chạy dọc mũi tên dẫn vào khối vừa hiện.
"""
from pathlib import Path

from feature_flow import Flow

OUT = Path(__file__).resolve().parent / "flows"   # flow mẫu đi kèm ví dụ

f = Flow("arch-load-balancer", "Request đi qua cân bằng tải")
f.group = "Ví dụ"
f.look = "iso"   # khối 3D isometric
f.meta(subtitle="Icon + nhãn nổi + chấm chạy theo bước.", duration="2 phút", level="Cơ bản")

s = f.start()
user = f.process("Người dùng", step=1, icon="laptop", badge="giỏ: 2 món",
                 explain="Trình duyệt gửi request kèm cookie phiên.")
lb = f.process("Cân bằng tải", step=2, icon="balancer",
               explain="Chọn server còn rảnh (round-robin).")
a = f.process("Server A", step=3, icon="server", explain="Xử lý request.")
b = f.process("Server B", step=3, icon="server", explain="Xử lý request.")
cache = f.process("Cache phiên", step=4, icon="database", badge="phiên: user-1",
                  explain="Server nào nhận cũng đọc được giỏ hàng nhờ phiên dùng chung.")
# màu riêng từng khối (không đặt → mặc định kiểu 3D: xanh)
for nid, color in ((user, "#ece6da"), (lb, "#f4b47e"), (cache, "#cdb8ec")):
    next(n for n in f.nodes if n.id == nid).color = color
f.link(s, user); f.link(user, lb); f.link(lb, a); f.link(lb, b); f.link(a, cache); f.link(b, cache)

f.narrate(1, "Người dùng gửi request", "Giỏ hàng đang có 2 món.")
f.narrate(2, "Cân bằng tải chọn server", "Không cố định 1 server cho 1 người.")
f.narrate(3, "Server xử lý", "A hay B đều được.")
f.narrate(4, "Phiên dùng chung", "Giỏ hàng không mất dù đổi server.", badge="GIẢI PHÁP")

print("saved:", f.save(OUT))
