# feature-flow

ThÆ° viá»‡n Python váº½ + visualize luá»“ng ship/debug má»™t tÃ­nh nÄƒng: **API dá»±ng luá»“ng báº±ng code** + **web xem/sá»­a**
(ká»ƒ chuyá»‡n tá»«ng bÆ°á»›c, báº¥m khá»‘i ra giáº£i thÃ­ch, chá»‰nh sá»­a trá»±c tiáº¿p) **nhÃºng Ä‘Æ°á»£c vÃ o app ASGI khÃ¡c**.

## CÃ i Ä‘áº·t

```bash
pip install "feature-flow @ git+https://github.com/hoangvunghi/feature-flow@v0.3.0"
pip install "feature-flow[server] @ git+â€¦"   # + uvicorn, náº¿u cháº¡y riÃªng
```

KhÃ´ng muá»‘n phá»¥ thuá»™c repo ngoÃ i lÃºc build: chÃ©p **nguyÃªn** thÆ° má»¥c `feature_flow/` cá»§a báº£n phÃ¡t hÃ nh vÃ o
project, **khÃ´ng sá»­a bÃªn trong** â€” má»i tuá»³ biáº¿n Ä‘i qua tham sá»‘ `create_app(...)` (xem dÆ°á»›i), nÃ¢ng cáº¥p = chÃ©p Ä‘Ã¨.

## 1. Dá»±ng luá»“ng báº±ng code

```python
from feature_flow import Flow

f = Flow("abc", "TÃªn luá»“ng").meta(subtitle="â€¦", duration="â€¦", level="â€¦")
s = f.start()
a = f.process("BÆ°á»›c A", step=1, explain="â€¦")
c = f.decision("Äiá»u kiá»‡n?", step=2, explain="â€¦")
f.link(s, a); f.link(a, c)
f.link(c, f.process("NhÃ¡nh true", step=3), "cÃ³ (true)")
f.narrate(1, "TiÃªu Ä‘á» bÆ°á»›c", "Ná»™i dungâ€¦", note="Cáº©n tháº­nâ€¦", note_type="warn", badge="Váº¤N Äá»€")
f.save("docs/flows")                 # â†’ docs/flows/abc.json  (khÃ´ng truyá»n: thÆ° má»¥c máº·c Ä‘á»‹nh, xem dÆ°á»›i)

Flow.load("abc", "docs/flows").to_markdown()   # Mermaid + JSON nhÃºng, nháº­p láº¡i Ä‘Æ°á»£c: Flow.from_markdown
```

**Icon + nhÃ£n ná»•i** (sÆ¡ Ä‘á»“ kiáº¿n trÃºc): `f.process("Server A", icon="server", badge="cpu 40%")`.
Icon cÃ³ sáºµn: `server database user laptop cloud balancer queue file gear lock mail clock api chart check alert`.
Khi â–¶ TrÃ¬nh chiáº¿u, má»—i bÆ°á»›c cÃ³ cháº¥m cháº¡y dá»c mÅ©i tÃªn dáº«n vÃ o khá»‘i vá»«a hiá»‡n.

VÃ­ dá»¥ Ä‘áº§y Ä‘á»§ (nhÃ³m, vÃ²ng láº·p, tÃ i liá»‡u dáº¡ng blog, kiáº¿n trÃºc cÃ³ icon): `examples/build_*.py` â†’ `examples/flows/`.

**Nhiá»u ngÆ°á»i cÃ¹ng sá»­a:** web gá»­i kÃ¨m phiÃªn báº£n lÃºc má»Ÿ; ai lÆ°u trÃªn báº£n cÅ© sáº½ Ä‘Æ°á»£c há»i trÆ°á»›c khi ghi Ä‘Ã¨
(API tráº£ 409). Má»—i láº§n lÆ°u/xoÃ¡ giá»¯ báº£n cÅ© á»Ÿ `<flows_dir>/.history/<id>/` (30 báº£n) â€” nÃºt **ðŸ•˜ Lá»‹ch sá»­** Ä‘á»ƒ khÃ´i phá»¥c.

## 2. NhÃºng web vÃ o app cá»§a báº¡n

```python
from feature_flow import create_app

ff = create_app(
    "data/flows",                                  # thÆ° má»¥c lÆ°u flow (*.json)
    brand_dir="brand",                             # logo/tÃªn/sáº¯c Ä‘á»™ (tuá»³ chá»n)
    can_edit=lambda request: is_editor(request),   # True/False hoáº·c hÃ m(request) â†’ bool
    home={"url": "/", "label": "â† Trang chá»§"},     # nÃºt quay vá» app cá»§a báº¡n
)
```

Gáº¯n dÆ°á»›i subpath (frontend dÃ¹ng Ä‘Æ°á»ng dáº«n tÆ°Æ¡ng Ä‘á»‘i nÃªn cháº¡y Ä‘Æ°á»£c á»Ÿ gá»‘c láº«n subpath):

```python
# Starlette / FastAPI
app.mount("/feature-flow", ff)

# Django â€” myproject/asgi.py
from starlette.applications import Starlette
from starlette.routing import Mount
application = Starlette(routes=[Mount("/feature-flow", app=ff), Mount("/", app=get_asgi_application())])
```

| Tham sá»‘ | Máº·c Ä‘á»‹nh | Ã nghÄ©a |
|---|---|---|
| `flows_dir` | env `FF_FLOWS_DIR`, khÃ´ng cÃ³ thÃ¬ `<gá»‘c git>/feature-flow/` | NÆ¡i Ä‘á»c/ghi flow |
| `brand_dir` | khÃ´ng | ThÆ° má»¥c thÆ°Æ¡ng hiá»‡u (dÆ°á»›i) |
| `can_edit` | `True` | `False` â†’ UI chá»‰ Ä‘á»c (qua `GET api/me`) **vÃ ** API ghi tráº£ 403 |
| `home` | `"home"` trong `brand.json` | NÃºt vá» trang chá»§; chá»‰ nháº­n path `/â€¦` hoáº·c `http(s)://` |
| `guides` | `True` | Hiá»‡n 3 tÃ i liá»‡u hÆ°á»›ng dáº«n Ä‘Ã³ng gÃ³i kÃ¨m |
| `security_headers` | `True` | CSP (JS chá»‰ tá»« app, script inline bÄƒm sha256 tá»± Ä‘á»™ng) + X-Frame-Options, nosniff, Referrer-Policy |

> âš ï¸ `create_app` **khÃ´ng tá»± Ä‘Äƒng nháº­p**: xÃ¡c thá»±c ngÆ°á»i dÃ¹ng lÃ  viá»‡c cá»§a app nhÃºng (middleware/ASGI bá»c
> ngoÃ i). `can_edit` chá»‰ quyáº¿t Ä‘á»‹nh quyá»n sá»­a sau khi Ä‘Ã£ vÃ o Ä‘Æ°á»£c.

JS (Cytoscape, dagre, marked, DOMPurify, turndown) Ä‘á»ƒ sáºµn trong `feature_flow/static/vendor/` â€” khÃ´ng gá»i CDN.
Nguá»“n + sha256 tá»«ng file: `static/vendor/SOURCES.txt`.

## 3. Cháº¡y riÃªng

```bash
uvicorn feature_flow.server:app --port 4404 --reload     # cáº¥u hÃ¬nh qua env FF_FLOWS_DIR / FF_BRAND_DIR
```

- **Play / â† â†’ / R / Space**: cháº¡y láº§n lÆ°á»£t tá»«ng bÆ°á»›c Â· **báº¥m 1 khá»‘i**: panel pháº£i hiá»‡n giáº£i thÃ­ch.
- **Báº­t "Chá»‰nh sá»­a"**: thÃªm bÆ°á»›c/nhÃ¡nh, ná»‘i khá»‘i, sá»­a nhÃ£n/giáº£i thÃ­ch â†’ **ðŸ’¾ LÆ°u**.

## ThÆ°Æ¡ng hiá»‡u

File nÃ o cÃ³ thÃ¬ Ä‘Ã¨, thiáº¿u thÃ¬ giá»¯ máº·c Ä‘á»‹nh:

```
brand/
  brand.json   {"name": "Acme Flow", "theme": "fincon", "home": {"url": "/", "label": "â† Acme"}}
  logo.svg     (hoáº·c .png/.jpg/.webp)   â†’ logo header + footer
  favicon.svg  (hoáº·c .png/.ico)         â†’ icon tab
  brand.css    :root{ --forest:#123456; â€¦ }   â†’ Ä‘Ã¨ mÃ u (biáº¿n :root cuá»‘i style.css)
```

## HÆ°á»›ng dáº«n sá»­ dá»¥ng cÃ³ sáºµn

3 tÃ i liá»‡u (váº½ flow, viáº¿t tÃ i liá»‡u, dÃ¹ng thÆ° viá»‡n) Ä‘Ã³ng gÃ³i á»Ÿ `feature_flow/guides/` â€” báº¥m **ðŸ“– HÆ°á»›ng dáº«n**.
Sá»­a rá»“i lÆ°u thÃ¬ báº£n sá»­a ghi vÃ o `flows_dir` (Ä‘Ã¨ báº£n gá»‘c theo id). Dá»±ng láº¡i: `python scripts/build_guides.py`.

## PhÃ¡t triá»ƒn

```bash
uv run --extra test pytest -q
```

- `feature_flow/model.py` â€” `Flow/Node/Edge/Step/Group` + JSON/Markdown.
- `feature_flow/server.py` â€” `create_app` (FastAPI) + `app` máº·c Ä‘á»‹nh.
- `feature_flow/static/` â€” giao diá»‡n + `vendor/`.
