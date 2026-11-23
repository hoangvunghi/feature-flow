# path: feature_flow/server.py
"""FastAPI: serve trang web + CRUD flow (đọc/ghi file JSON trong flows/).

Chạy:  uvicorn feature_flow.server:app --port 4404 --reload
Mở:    http://127.0.0.1:4404
Gắn vào app ASGI khác (vd Django/FastAPI có sẵn): Mount("/feature-flow", app=app)
"""
from __future__ import annotations

import re
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .model import FLOWS_DIR, Flow, list_flows

STATIC = Path(__file__).resolve().parent / "static"
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


@app.get("/api/flows/{flow_id}")
def api_flow(flow_id: str) -> dict:
    p = _path(flow_id)
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
    p = _path(flow_id)
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


@app.get("/")
def index(request: Request):
    # mount dưới subpath mà thiếu "/" cuối → URL tương đối (static/, api/) sẽ trỏ sai về gốc host
    if not request.url.path.endswith("/"):
        return RedirectResponse(request.url.path + "/")
    return FileResponse(STATIC / "index.html")


app.mount("/static", StaticFiles(directory=STATIC), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=4404)
