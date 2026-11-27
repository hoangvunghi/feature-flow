# path: tests/test_library.py
"""Kiểm hợp đồng thư viện: model đọc/ghi theo thư mục truyền vào + create_app (quyền sửa, chặn path, CSP, home).
Chạy: uv run --extra test pytest -q
"""
from fastapi.testclient import TestClient

from feature_flow import Flow, create_app, list_flows


def _demo(tmp_path):
    f = Flow("demo", "Demo")
    s = f.start(); a = f.process("Bước A", step=1)
    f.link(s, a)
    f.save(tmp_path)
    return f


def test_model_roundtrip(tmp_path):
    _demo(tmp_path)
    g = Flow.load("demo", tmp_path)
    assert [n.label for n in g.nodes] == ["", "Bước A"] and len(g.edges) == 1
    assert Flow.from_markdown("demo", g.to_markdown()).to_dict() == g.to_dict()   # md lossless
    assert [x["id"] for x in list_flows(tmp_path, guides=False)] == ["demo"]
    assert len(list_flows(tmp_path, guides=True)) > 1                            # + hướng dẫn kèm gói


def test_app_edit_and_readonly(tmp_path):
    _demo(tmp_path)
    rw = TestClient(create_app(tmp_path, guides=False))
    assert rw.get("/api/me").json() == {"can_edit": True}
    body = rw.get("/api/flows/demo").json()
    body["title"] = "Đổi tên"
    assert rw.put("/api/flows/demo", json=body).status_code == 200
    assert Flow.load("demo", tmp_path).title == "Đổi tên"

    ro = TestClient(create_app(tmp_path, can_edit=lambda req: False))
    assert ro.get("/api/me").json() == {"can_edit": False}
    assert ro.get("/api/flows/demo").status_code == 200
    assert ro.put("/api/flows/demo", json=body).status_code == 403
    assert ro.delete("/api/flows/demo").status_code == 403
    assert ro.post("/api/import", json={"id": "x", "markdown": ""}).status_code == 403


def test_app_guards_and_page(tmp_path):
    c = TestClient(create_app(tmp_path, home={"url": "/", "label": "← Về"}))
    assert c.get("/api/flows/..%2Fetc").status_code in (400, 404)
    assert c.put("/api/flows/a.b", json={"id": "a.b"}).status_code == 400
    r = c.get("/")
    assert '<a class="btn ghost" href="/">← Về</a>' in r.text
    csp = r.headers["content-security-policy"]
    assert "'sha256-" in csp and "cdn" not in csp                                 # JS chỉ từ app + hash inline
    assert "cdnjs" not in r.text and "jsdelivr" not in r.text                     # không còn CDN
    assert c.get("/static/vendor/cytoscape-3.30.2.min.js").status_code == 200
    bad = TestClient(create_app(tmp_path, home={"url": "javascript:alert(1)"}))
    assert "javascript:" not in bad.get("/").text
