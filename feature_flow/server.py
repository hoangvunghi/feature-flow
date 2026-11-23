# path: feature_flow/server.py
"""FastAPI: serve trang web + CRUD flow (đọc/ghi file JSON trong feature-flow/).

Chạy:  uvicorn feature_flow.server:app --port 4404 --reload
Mở:    http://127.0.0.1:4404
Gắn vào app ASGI khác (vd Django/FastAPI có sẵn): Mount("/feature-flow", app=app)
"""
from __future__ import annotations

import html as _html
import json
import os
import re
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .model import FLOWS_DIR, Flow, flow_path, list_flows

STATIC = Path(__file__).resolve().parent / "static"
# Thư mục thương hiệu riêng (tuỳ chọn): logo.*, favicon.*, brand.css, brand.json {"name": "..."}
# Mặc định <FLOWS_DIR>/brand (gom chung 1 thư mục với flow); FF_BRAND_DIR để trỏ chỗ khác.
_brand = Path(os.environ["FF_BRAND_DIR"]) if os.environ.get("FF_BRAND_DIR") else FLOWS_DIR / "brand"
BRAND_DIR = _brand if _brand.is_dir() else None
app = FastAPI(title="feature-flow")
_ID_OK = re.compile(r"^[A-Za-z0-9_-]{1,80}$")


def _path(flow_id: str) -> Path:
    """Chặn path traversal (../) — id chỉ gồm chữ/số/-/_."""
    if not _ID_OK.match(flow_id):
        raise HTTPException(400, "flow id không hợp lệ")
    return FLOWS_DIR / f"{flow_id}.json"


@app.get("/api/flows")
def api_flows() -> list[dict]:
    return list_flows()


def _read_path(flow_id: str) -> Path:
    """Đường ĐỌC: thư mục flow, không có thì hướng dẫn đóng gói (ghi/xoá vẫn chỉ dùng _path)."""
    _path(flow_id)
    return flow_path(flow_id)


@app.get("/api/flows/{flow_id}")
def api_flow(flow_id: str) -> dict:
    p = _read_path(flow_id)
    if not p.exists():
        raise HTTPException(404, f"flow '{flow_id}' không tồn tại")
    return Flow.load(flow_id).to_dict()


@app.put("/api/flows/{flow_id}")
def api_save(flow_id: str, data: dict) -> dict:
    # Ép id theo URL (không cho đổi id qua body) rồi validate qua model trước khi ghi.
    _path(flow_id)
    data["id"] = flow_id
    flow = Flow.from_dict(data)          # ném lỗi nếu thiếu/ sai field
    flow.save()
    return {"ok": True, "id": flow_id, "nodes": len(flow.nodes), "edges": len(flow.edges)}


@app.get("/api/flows/{flow_id}/markdown")
def api_markdown(flow_id: str) -> dict:
    p = _read_path(flow_id)
    if not p.exists():
        raise HTTPException(404, f"flow '{flow_id}' không tồn tại")
    return {"id": flow_id, "markdown": Flow.load(flow_id).to_markdown()}


@app.delete("/api/flows/{flow_id}")
def api_delete(flow_id: str) -> dict:
    p = _path(flow_id)
    if not p.exists():
        raise HTTPException(404, f"flow '{flow_id}' không tồn tại")
    p.unlink()
    return {"ok": True, "id": flow_id}


@app.post("/api/import")
def api_import(data: dict) -> dict:
    """Nhập 1 flow từ Markdown (Mermaid + JSON nhúng). Body: {id, markdown}."""
    flow_id = (data.get("id") or "").strip()
    md = data.get("markdown") or ""
    if not flow_id:
        raise HTTPException(400, "thiếu id")
    _path(flow_id)
    flow = Flow.from_markdown(flow_id, md)
    flow.save()
    return {"ok": True, "id": flow_id, "nodes": len(flow.nodes), "edges": len(flow.edges)}


_LOGO_SVG = re.compile(r"<svg [^>]*>\s*<path d=\"M6 7 L24 16 L6 25 L11 16 Z\"[^>]*/>\s*</svg>")


def _brand_file(stem: str, exts: tuple[str, ...]) -> str | None:
    for ext in exts:
        if BRAND_DIR and (BRAND_DIR / f"{stem}.{ext}").is_file():
            return f"brand/{stem}.{ext}"
    return None


def _render_index() -> str:
    """index.html + đè thương hiệu từ FF_BRAND_DIR (logo/favicon/brand.css/brand.json)."""
    html = (STATIC / "index.html").read_text(encoding="utf-8")
    if not BRAND_DIR:
        return html
    cfg_p = BRAND_DIR / "brand.json"
    cfg = json.loads(cfg_p.read_text(encoding="utf-8")) if cfg_p.is_file() else {}
    if name := cfg.get("name"):
        esc = _html.escape(name)
        html = html.replace("<title>Feature Flow</title>", f"<title>{esc}</title>")
        html = html.replace("Feature <b>Flow</b>", esc).replace("Về Feature Flow", f"Về {esc}")
    if logo := _brand_file("logo", ("svg", "png", "jpg", "jpeg", "webp")):
        html = _LOGO_SVG.sub(f'<img src="{logo}" alt="" style="height:1.25em;vertical-align:-0.25em">', html)
    if fav := _brand_file("favicon", ("svg", "png", "ico")):
        html = re.sub(r'<link rel="icon" href="[^"]*" />', f'<link rel="icon" href="{fav}" />', html, count=1)
    if css := _brand_file("brand", ("css",)):
        html = html.replace("</head>", f'<link rel="stylesheet" href="{css}" />\n</head>', 1)
    return html


@app.get("/")
def index(request: Request):
    # mount dưới subpath mà thiếu "/" cuối → URL tương đối (static/, api/) sẽ trỏ sai về gốc host
    if not request.url.path.endswith("/"):
        return RedirectResponse(request.url.path + "/")
    return HTMLResponse(_render_index())


app.mount("/static", StaticFiles(directory=STATIC), name="static")
if BRAND_DIR:
    app.mount("/brand", StaticFiles(directory=BRAND_DIR), name="brand")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=4404)
