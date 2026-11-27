# path: build_loop_demo.py
"""Demo luồng có VÒNG LẶP (while) — cho thấy cạnh quay ngược tạo chu trình,
và nhóm 'Thân vòng lặp' có mô tả. Chạy: python build_loop_demo.py
"""
from feature_flow import Flow
from feature_flow.model import Group

f = Flow("while-loop-demo", "Vòng lặp while: duyệt danh sách")
f.group = "Hướng dẫn chung"
f.meta(
    subtitle="Khởi tạo → kiểm tra điều kiện → thân lặp → tăng biến → quay lại điều kiện → xong.",
    duration="thuật toán", level="Demo",
    learn=[
        "Vòng lặp = một cạnh QUAY NGƯỢC về điều kiện",
        "Điều kiện sai thì mới thoát ra",
        "Thân lặp gom thành 1 nhóm cho dễ nhìn",
    ],
)

s = f.start()
init = f.process("i = 0", step=1, explain="Khởi tạo biến đếm trước khi vào vòng lặp.")
cond = f.decision("i < n ?", step=2,
                  explain="Điều kiện lặp. Còn đúng thì chạy thân; sai thì thoát.")
body = f.process("Xử lý phần tử thứ i", step=3,
                 explain="Thân vòng lặp — làm việc với arr[i].")
inc = f.process("i = i + 1", step=4,
                explain="Tăng biến đếm rồi QUAY LẠI kiểm tra điều kiện.")
done = f.process("Xong — đã duyệt hết", step=5,
                 explain="Thoát vòng lặp khi i >= n.")
e = f.end()
for n in f.nodes:
    if n.id == e:
        n.step = 6

f.link(s, init)
f.link(init, cond)
f.link(cond, body, "còn (i<n)")
f.link(body, inc)
f.link(inc, cond, "lặp lại ↺")        # cạnh QUAY NGƯỢC = vòng lặp
f.link(cond, done, "hết (i>=n)")
f.link(done, e)

# nhóm bọc thân vòng lặp + mô tả (hiện khi bấm lúc xem)
f.groups.append(Group(
    id="g_loop", label="Thân vòng lặp",
    explain="Phần chạy lặp đi lặp lại: xử lý phần tử rồi tăng i. "
            "Mỗi vòng quay lại kiểm tra 'i < n'. Khi i >= n thì thoát.",
    color="#4e9a5f", members=[body, inc],
))

f.narrate(1, "Khởi tạo", "Đặt i = 0 trước khi vào vòng lặp.", badge="BƯỚC")
f.narrate(2, "Kiểm tra điều kiện", "i < n còn đúng không?\nĐúng → chạy thân. Sai → thoát ra 'Xong'.", badge="ĐIỀU KIỆN")
f.narrate(3, "Thân lặp", "Xử lý phần tử thứ i (arr[i]).", badge="BƯỚC")
f.narrate(4, "Tăng biến + quay lại", "i = i + 1 rồi QUAY NGƯỢC về điều kiện.\n"
          "Chính cạnh quay ngược này tạo thành vòng lặp.",
          note="Thiếu bước tăng biến → lặp vô hạn.", note_type="warn")
f.narrate(5, "Thoát", "Khi i >= n, điều kiện sai → ra khỏi vòng lặp.", badge="BƯỚC")
f.narrate(6, "Kết thúc", "Đã duyệt hết danh sách. 🎉", badge="GIẢI PHÁP")

p = f.save()
print("saved:", p)
