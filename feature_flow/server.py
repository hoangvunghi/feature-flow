# path: feature_flow/server.py
"""FastAPI: serve trang web + CRUD flow (đọc/ghi file JSON).

Dùng như THƯ VIỆN — app nhúng tự dựng app với cấu hình của mình:

    from feature_flow import create_app
    ff = create_app(flows_dir="data/flows", brand_dir="brand", can_edit=lambda req: req.state.user.is_staff,
                    home={"url": "/", "label": "← Trang chủ"})
    # Starlette/FastAPI: app.mount("/feature-flow", ff) · Django ASGI: router theo path → ff

Chạy riêng (cấu hình qua env FF_FLOWS_DIR / FF_BRAND_DIR như trước):
    uvicorn feature_flow.server:app --port 4404 --reload
"""
from __future__ import annotations

import base64
import hashlib
import html as _html
import json
import os
import re
from pathlib import Path
from typing import Callable, Union

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from .model import FLOWS_DIR, Flow, flow_path, list_flows

STATIC = Path(__file__).resolve().parent / "static"
_ID_OK = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
_LOGO_SVG = re.compile(r"<svg [^>]*>\s*<path d=\"M6 7 L24 16 L6 25 L11 16 Z\"[^>]*/>\s*</svg>")
_INLINE_JS = re.compile(r"<script>(.*?)</script>", re.S)

CanEdit = Union[bool, Callable[[Request], bool]]


def _csp(index_html: str) -> str:
    """CSP chặt: JS chỉ từ chính app (thư viện JS để sẵn trong static/vendor, KHÔNG CDN) + script inline của
    index.html băm sha256 lúc dựng app (sửa index.html không phải tính tay lại hash)."""
    hashes = " ".join(f"'sha256-{base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()}'"
                      for s in _INLINE_JS.findall(index_html))
    return ("default-src 'self'; "
            f"script-src 'self' {hashes}; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; "
            "form-action 'self'; frame-ancestors 'none'")


def _render_index(brand_dir: Path | None, home: dict | None) -> str:
    """index.html + thương hiệu từ brand_dir (logo.*, favicon.*, brand.css, brand.json {name, theme, home})."""
    html = (STATIC / "index.html").read_text(encoding="utf-8")
    cfg_p = brand_dir / "brand.json" if brand_dir else None
    cfg = json.loads(cfg_p.read_text(encoding="utf-8")) if cfg_p and cfg_p.is_file() else {}

    def brand_file(stem: str, exts: tuple[str, ...]) -> str | None:
        return next((f"brand/{stem}.{e}" for e in exts if brand_dir and (brand_dir / f"{stem}.{e}").is_file()), None)

    if name := cfg.get("name"):
        esc = _html.escape(name)
        html = html.replace("<title>Feature Flow</title>", f"<title>{esc}</title>")
        html = html.replace("Feature <b>Flow</b>", esc).replace("Về Feature Flow", f"Về {esc}")
    # nút về trang chủ của app nhúng — tham số home đè brand.json; chỉ nhận path tương đối hoặc http(s)
    home = home or cfg.get("home") or {}
    if re.match(r"(/|https?://)", url := str(home.get("url", ""))):
        btn = (f'<a class="btn ghost" href="{_html.escape(url)}">'
               f'{_html.escape(str(home.get("label") or "← Trang chủ"))}</a>')
        html = html.replace('<span class="spacer"></span>', f'{btn}\n  <span class="spacer"></span>', 1)
    if logo := brand_file("logo", ("svg", "png", "jpg", "jpeg", "webp")):
        html = _LOGO_SVG.sub(f'<img src="{logo}" alt="" style="height:1.25em;vertical-align:-0.25em">', html)
    if fav := brand_file("favicon", ("svg", "png", "ico")):
        html = re.sub(r'<link rel="icon" href="[^"]*" />', f'<link rel="icon" href="{fav}" />', html, count=1)
    # sắc độ mặc định (vd "fincon") — chỉ nhận chữ thường/số/gạch; người dùng tự chọn khác thì đè
    if re.fullmatch(r"[a-z0-9-]{1,40}", theme := str(cfg.get("theme", ""))):
        html = html.replace('<html lang="vi">', f'<html lang="vi" data-theme="{theme}">', 1)
    if css := brand_file("brand", ("css",)):
        html = html.replace("</head>", f'<link rel="stylesheet" href="{css}" />\n</head>', 1)
    return html


def create_app(flows_dir: str | Path | None = None, *, brand_dir: str | Path | None = None,
               can_edit: CanEdit = True, home: dict | None = None, guides: bool = True,
               security_headers: bool = True, title: str = "feature-flow") -> FastAPI:
    """Dựng app feature-flow.

    flows_dir        thư mục lưu flow (*.json). None → FLOWS_DIR mặc định (env FF_FLOWS_DIR / <gốc git>/feature-flow).
    brand_dir        thư mục thương hiệu: logo.*, favicon.*, brand.css, brand.json {"name", "theme", "home"}.
    can_edit         True/False hoặc hàm(request) → bool. False: UI chỉ đọc (qua api/me) VÀ API ghi trả 403.
    home             {"url": "/", "label": "← Trang chủ"} — nút về app nhúng (đè "home" trong brand.json).
    guides           hiện tài liệu hướng dẫn đóng gói kèm thư viện.
    security_headers thêm CSP + X-Frame-Options/nosniff/Referrer-Policy cho mọi response.
    """
    d = Path(flows_dir) if flows_dir else FLOWS_DIR
    brand = Path(brand_dir) if brand_dir and Path(brand_dir).is_dir() else None
    index_html = _render_index(brand, home)
    app = FastAPI(title=title)

    def _path(flow_id: str) -> Path:
        """Chặn path traversal (../) — id chỉ gồm chữ/số/-/_."""
        if not _ID_OK.match(flow_id):
            raise HTTPException(400, "flow id không hợp lệ")
        return d / f"{flow_id}.json"

    def _editable(request: Request) -> bool:
        return bool(can_edit(request) if callable(can_edit) else can_edit)

    def _need_edit(request: Request) -> None:
        if not _editable(request):
            raise HTTPException(403, "không có quyền sửa")

    def _read_path(flow_id: str) -> Path:
        _path(flow_id)
        p = flow_path(flow_id, d, guides)
        if not p.exists():
            raise HTTPException(404, f"flow '{flow_id}' không tồn tại")
        return p

    if security_headers:
        sec = [("Content-Security-Policy", _csp(index_html)), ("X-Frame-Options", "DENY"),
               ("X-Content-Type-Options", "nosniff"), ("Referrer-Policy", "same-origin")]

        @app.middleware("http")
        async def _headers(request: Request, call_next):
            resp = await call_next(request)
            for k, v in sec:
                resp.headers.setdefault(k, v)
            return resp

    @app.get("/api/me")
    def api_me(request: Request) -> dict:
        return {"can_edit": _editable(request)}

    @app.get("/api/flows")
    def api_flows() -> list[dict]:
        return list_flows(d, guides)

    @app.get("/api/flows/{flow_id}")
    def api_flow(flow_id: str) -> dict:
        _read_path(flow_id)
        return Flow.load(flow_id, d, guides).to_dict()

    @app.put("/api/flows/{flow_id}")
    def api_save(flow_id: str, data: dict, request: Request) -> dict:
        _need_edit(request)
        _path(flow_id)
        data["id"] = flow_id                 # ép id theo URL (không cho đổi id qua body)
        flow = Flow.from_dict(data)          # ném lỗi nếu thiếu/sai field
        flow.save(d)
        return {"ok": True, "id": flow_id, "nodes": len(flow.nodes), "edges": len(flow.edges)}

    @app.get("/api/flows/{flow_id}/markdown")
    def api_markdown(flow_id: str) -> dict:
        _read_path(flow_id)
        return {"id": flow_id, "markdown": Flow.load(flow_id, d, guides).to_markdown()}

    @app.delete("/api/flows/{flow_id}")
    def api_delete(flow_id: str, request: Request) -> dict:
        _need_edit(request)
        p = _path(flow_id)
        if not p.exists():
            raise HTTPException(404, f"flow '{flow_id}' không tồn tại")
        p.unlink()
        return {"ok": True, "id": flow_id}

    @app.post("/api/import")
    def api_import(data: dict, request: Request) -> dict:
        """Nhập 1 flow từ Markdown (Mermaid + JSON nhúng). Body: {id, markdown}."""
        _need_edit(request)
        flow_id = (data.get("id") or "").strip()
        if not flow_id:
            raise HTTPException(400, "thiếu id")
        _path(flow_id)
        flow = Flow.from_markdown(flow_id, data.get("markdown") or "")
        flow.save(d)
        return {"ok": True, "id": flow_id, "nodes": len(flow.nodes), "edges": len(flow.edges)}

    @app.get("/")
    def index(request: Request):
        # mount dưới subpath mà thiếu "/" cuối → URL tương đối (static/, api/) sẽ trỏ sai về gốc host
        if not request.url.path.endswith("/"):
            return RedirectResponse(request.url.path + "/")
        return HTMLResponse(index_html)

    app.mount("/static", StaticFiles(directory=STATIC), name="static")
    if brand:
        app.mount("/brand", StaticFiles(directory=brand), name="brand")
    return app


# App mặc định cho `uvicorn feature_flow.server:app` — cấu hình qua env (tương thích bản cũ).
_brand_env = os.environ.get("FF_BRAND_DIR")
app = create_app(brand_dir=Path(_brand_env) if _brand_env else FLOWS_DIR / "brand")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=4404)
