# path: feature_flow/model.py
"""Mô hình luồng (flow) + đọc/ghi JSON. Dùng khi LÊN PLAN để vẽ luồng bằng code:

    from feature_flow import Flow
    f = Flow("ship-feature", "Quy trình ship một tính năng")
    s = f.start()
    plan = f.process("Lên plan / brainstorm", explain="Hiểu vấn đề trước khi cắt nhỏ.")
    cond = f.decision("Gặp khó?", explain="Có lỗi/khác dự đoán → rẽ debug.")
    f.link(s, plan); f.link(plan, cond)
    f.link(cond, f.process("Debug top-down", explain="Khoanh tầng bằng bằng chứng."), "có (true)")
    f.link(cond, f.end(), "không (false)")
    f.save()                     # -> <gốc project>/feature-flow/ship-feature.json

Server đọc file này để render; người dùng sửa trên web thì server ghi đè lại chính file đó.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

def _default_flows_dir() -> Path:
    """Không đặt FF_FLOWS_DIR → <gốc project>/feature-flow, gốc = thư mục cha gần nhất có .git
    (tính từ thư mục đang chạy); không có .git thì <thư mục đang chạy>/feature-flow."""
    cwd = Path.cwd().resolve()
    root = next((p for p in (cwd, *cwd.parents) if (p / ".git").exists()), cwd)
    return root / "feature-flow"


FLOWS_DIR = Path(os.environ.get("FF_FLOWS_DIR") or _default_flows_dir())
# Tài liệu hướng dẫn đóng gói KÈM thư viện → thư mục flow nào cũng có sẵn (chỉ đọc; sửa rồi lưu
# thì bản sửa ghi vào FLOWS_DIR và đè bản gốc theo id).
GUIDES_DIR = Path(__file__).resolve().parent / "guides"


def flow_path(flow_id: str, flows_dir: Path | None = None) -> Path:
    """File của flow: ưu tiên thư mục flow; không có thì lấy hướng dẫn đóng gói (khi dùng FLOWS_DIR mặc định)."""
    p = (flows_dir or FLOWS_DIR) / f"{flow_id}.json"
    g = GUIDES_DIR / f"{flow_id}.json"
    return g if flows_dir is None and not p.exists() and g.exists() else p

# Kiểu khối: start/end = vòng tròn, decision = thoi (rẽ nhánh), process = hộp bo góc.
NODE_TYPES = ("start", "end", "decision", "process")

# Mermaid: dạng bọc theo loại khối + regex nhận dạng khi nhập.
_MM_SHAPE = {"start": ("([", "])"), "end": ("((", "))"), "decision": ("{", "}"), "process": ("[", "]")}
_MM_OPEN = {"([": "start", "((": "end", "{": "decision", "[": "process"}
_MM_NODE = re.compile(r'([A-Za-z0-9_]+)\s*(\(\[|\(\(|\{|\[)\s*"?(.*?)"?\s*(\]\)|\)\)|\}|\])')


@dataclass
class Node:
    id: str
    type: str          # NODE_TYPES
    label: str = ""
    explain: str = ""  # giải thích hiện khi bấm vào khối (markdown nhẹ)
    step: int = 0      # thứ tự reveal khi Play (0 = hiện ngay/đầu)
    color: str = ""    # màu nền tự chọn (rỗng = theo loại khối)
    x: float | None = None   # vị trí tự đặt (kéo tay); None = để auto-layout xếp
    y: float | None = None
    notes: list = field(default_factory=list)  # ghi chú riêng của khối: [{t, done}] (dấu ! đỏ) — để CUỐI (dựng positional)


@dataclass
class Edge:
    source: str
    target: str
    label: str = ""    # nhãn nhánh: "có (true)" / "không (false)" ...


@dataclass
class Arrow:
    """Mũi tên 'vô danh' — 2 đầu toạ độ tự do (không nối khối nào). Chú thích trên canvas."""
    x1: float
    y1: float
    x2: float
    y2: float
    label: str = ""


@dataclass
class Group:
    """Nhóm/khung bọc quanh một tập khối (như gr1/gr2 của draw.io). Box tự tính từ members."""
    id: str
    label: str = ""
    explain: str = ""                                   # mô tả nhóm (hiện khi bấm lúc xem)
    color: str = "#8a6fd0"
    pad: int = 26                                       # đệm khung khi auto-ôm members
    x: float | None = None                              # hình học thủ công (kéo tay cầm resize)
    y: float | None = None
    w: float | None = None
    h: float | None = None
    members: list[str] = field(default_factory=list)


@dataclass
class Step:
    """1 bước kể chuyện ở panel phải (như designed-to-scale). n khớp Node.step để reveal."""
    n: int
    title: str = ""
    body: str = ""          # đoạn giải thích (xuống dòng = \n)
    note: str = ""          # callout nhỏ (vd "Cẩn thận: ...")
    note_type: str = "info"  # info | warn
    badge: str = ""         # nhãn góc phải panel, vd "VẤN ĐỀ" / "GIẢI PHÁP"


@dataclass
class Flow:
    id: str
    title: str = ""
    kind: str = "flow"       # "flow" = sơ đồ (nodes/edges) · "doc" = tài liệu/blog (doc_md)
    visibility: str = "private"   # "private" = riêng · "public" = chia sẻ công khai
    doc_md: str = ""         # nội dung markdown khi kind="doc"
    group: str = ""          # nhóm/tính năng (folder ở sidebar) — rỗng = chưa phân nhóm
    subtitle: str = ""
    duration: str = ""       # vd "11 phút"
    level: str = ""          # vd "Trung cấp"
    learn: list[str] = field(default_factory=list)   # (cũ) checklist
    notes: list = field(default_factory=list)        # ghi chú: [{t, done}] — tick được
    nodes: list[Node] = field(default_factory=list)
    edges: list[Edge] = field(default_factory=list)
    steps: list[Step] = field(default_factory=list)
    arrows: list[Arrow] = field(default_factory=list)   # mũi tên vô danh (toạ độ tự do)
    groups: list[Group] = field(default_factory=list)   # nhóm bọc quanh tập khối
    _seq: int = 0

    # ---- dựng luồng bằng code ----
    def _add(self, type_: str, label: str = "", explain: str = "", step: int | None = None) -> str:
        self._seq += 1
        nid = f"{type_[:1]}{self._seq}"
        self.nodes.append(Node(nid, type_, label, explain,
                               self._seq if step is None else step))
        return nid

    def start(self, label: str = "", explain: str = "") -> str:
        return self._add("start", label, explain, step=0)

    def end(self, label: str = "", explain: str = "") -> str:
        return self._add("end", label, explain)

    def process(self, label: str, explain: str = "", step: int | None = None) -> str:
        return self._add("process", label, explain, step)

    def decision(self, label: str, explain: str = "", step: int | None = None) -> str:
        return self._add("decision", label, explain, step)

    def link(self, source: str, target: str, label: str = "") -> None:
        self.edges.append(Edge(source, target, label))

    def narrate(self, n: int, title: str, body: str = "", note: str = "",
                note_type: str = "info", badge: str = "") -> None:
        """Thêm/đè bước kể chuyện n ở panel phải (khớp Node.step=n để reveal cùng lúc)."""
        self.steps = [s for s in self.steps if s.n != n]
        self.steps.append(Step(n, title, body, note, note_type, badge))
        self.steps.sort(key=lambda s: s.n)

    def meta(self, subtitle: str = "", duration: str = "", level: str = "",
             learn: list[str] | None = None) -> "Flow":
        self.subtitle = subtitle or self.subtitle
        self.duration = duration or self.duration
        self.level = level or self.level
        if learn is not None:
            self.learn = learn
        return self

    # ---- lưu / nạp ----
    def to_dict(self) -> dict:
        return {"id": self.id, "title": self.title, "kind": self.kind,
                "visibility": self.visibility, "doc_md": self.doc_md,
                "group": self.group, "subtitle": self.subtitle,
                "duration": self.duration, "level": self.level, "learn": list(self.learn), "notes": list(self.notes),
                "nodes": [asdict(n) for n in self.nodes],
                "edges": [asdict(e) for e in self.edges],
                "steps": [asdict(s) for s in self.steps],
                "arrows": [asdict(a) for a in self.arrows],
                "groups": [asdict(g) for g in self.groups]}

    def save(self, flows_dir: Path | None = None) -> Path:
        d = flows_dir or FLOWS_DIR
        d.mkdir(parents=True, exist_ok=True)
        p = d / f"{self.id}.json"
        p.write_text(json.dumps(self.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
        return p

    @classmethod
    def from_dict(cls, data: dict) -> "Flow":
        f = cls(id=data["id"], title=data.get("title", ""), kind=data.get("kind", "flow"),
                visibility=data.get("visibility", "private"),
                doc_md=data.get("doc_md", ""), group=data.get("group", ""),
                subtitle=data.get("subtitle", ""), duration=data.get("duration", ""),
                level=data.get("level", ""), learn=list(data.get("learn", [])),
                notes=(data.get("notes") if isinstance(data.get("notes"), list) else []))
        f.nodes = [Node(**_node_compat(n)) for n in data.get("nodes", [])]
        f.edges = [Edge(**_edge_compat(e)) for e in data.get("edges", [])]
        f.steps = [Step(**s) for s in data.get("steps", [])]
        f.arrows = [Arrow(**a) for a in data.get("arrows", [])]
        f.groups = [Group(**g) for g in data.get("groups", [])]
        f._seq = len(f.nodes)
        return f

    @classmethod
    def load(cls, flow_id: str, flows_dir: Path | None = None) -> "Flow":
        return cls.from_dict(json.loads(flow_path(flow_id, flows_dir).read_text(encoding="utf-8")))

    # ---- Markdown (Mermaid) ----
    def to_markdown(self) -> str:
        """Xuất .md: sơ đồ Mermaid (xem được trên GitHub) + JSON nhúng để nhập lại không mất mát."""
        def ml(s: str) -> str:
            return (s or " ").replace('"', "'").replace("\n", "<br/>")
        out = [f"# {self.title or self.id}", ""]
        meta = " · ".join(x for x in [self.subtitle,
                f"⏱ {self.duration}" if self.duration else "",
                f"📊 {self.level}" if self.level else ""] if x)
        if meta:
            out += [f"> {meta}", ""]
        out += ["```mermaid", "flowchart TD"]
        for n in self.nodes:
            o, c = _MM_SHAPE.get(n.type, ("[", "]"))
            out.append(f'  {n.id}{o}"{ml(n.label)}"{c}')
        for e in self.edges:
            lbl = f'|"{ml(e.label)}"| ' if e.label else ""
            out.append(f"  {e.source} --> {lbl}{e.target}")
        out += ["```", ""]
        if self.learn:
            out += ["## Bạn sẽ học", ""] + [f"- {t}" for t in self.learn] + [""]
        if self.steps:
            out += ["## Các bước", ""]
            for s in sorted(self.steps, key=lambda x: x.n):
                out.append(f"### Bước {s.n} — {s.title}" + (f"  `{s.badge}`" if s.badge else ""))
                if s.body:
                    out += ["", s.body]
                if s.note:
                    out += ["", f"> {'⚠️ ' if s.note_type == 'warn' else ''}{s.note}"]
                out.append("")
        expl = [n for n in self.nodes if n.explain]
        if expl:
            out += ["## Giải thích khối", ""]
            for n in expl:
                out.append(f"- **{n.label or n.type}** (`{n.id}`, {n.type}, bước {n.step}): "
                           f"{n.explain.replace(chr(10), ' ')}")
            out.append("")
        out += ["<!-- flow-data", json.dumps(self.to_dict(), ensure_ascii=False), "-->", ""]
        return "\n".join(out)

    @classmethod
    def from_markdown(cls, flow_id: str, text: str) -> "Flow":
        """Nhập .md: ưu tiên JSON nhúng (lossless); không có thì parse sơ đồ Mermaid (cấu trúc)."""
        m = re.search(r"<!--\s*flow-data\s*(.*?)-->", text, re.S)
        if m:
            try:
                data = json.loads(m.group(1).strip())
                data["id"] = flow_id
                return cls.from_dict(data)
            except Exception:  # noqa: BLE001 — JSON nhúng hỏng → rơi sang parse mermaid
                pass
        mm = re.search(r"```mermaid(.*?)```", text, re.S)
        body = mm.group(1) if mm else text
        f = cls(flow_id, flow_id)
        seen: dict[str, Node] = {}

        def ensure(nid: str, type_: str = "process", label: str | None = None) -> Node:
            if nid not in seen:
                n = Node(nid, type_, nid if label is None else label,
                         step=0 if type_ == "start" else len(seen))
                seen[nid] = n
                f.nodes.append(n)
            else:
                n = seen[nid]
                if label:
                    n.label = label
                if type_ != "process":
                    n.type = type_
            return n

        for line in body.splitlines():
            for mo in _MM_NODE.finditer(line):
                ensure(mo.group(1), _MM_OPEN.get(mo.group(2), "process"),
                       mo.group(3).replace("<br/>", "\n"))
            clean = _MM_NODE.sub(lambda mo: mo.group(1), line)
            em = re.match(r'\s*([A-Za-z0-9_]+)\s*--+>\s*(?:\|\s*"?(.*?)"?\s*\|\s*)?([A-Za-z0-9_]+)\s*$', clean)
            if em:
                ensure(em.group(1)); ensure(em.group(3))
                f.edges.append(Edge(em.group(1), em.group(3), (em.group(2) or "").replace("<br/>", "\n")))
        f._seq = len(f.nodes)
        return f


def _node_compat(n: dict) -> dict:
    """Chấp nhận node cũ có 'note' (chuỗi) → đổi thành 'notes' (danh sách)."""
    n = dict(n)
    old = n.pop("note", None)
    if old and not n.get("notes"):
        n["notes"] = [{"t": old, "done": False}]
    n.setdefault("notes", [])
    return n


def _edge_compat(e: dict) -> dict:
    """Chấp nhận cả {from,to} (UI/người gõ tay) lẫn {source,target}."""
    return {"source": e.get("source", e.get("from")),
            "target": e.get("target", e.get("to")),
            "label": e.get("label", "")}


def list_flows(flows_dir: Path | None = None) -> list[dict]:
    d = flows_dir or FLOWS_DIR
    files = {p.stem: p for p in (GUIDES_DIR.glob("*.json") if flows_dir is None else [])}
    files.update({p.stem: p for p in d.glob("*.json")})   # flow của user đè hướng dẫn cùng id
    out = []
    for stem, p in sorted(files.items()):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            out.append({"id": data.get("id", stem), "title": data.get("title", stem),
                        "group": data.get("group", ""), "kind": data.get("kind", "flow"),
                        "visibility": data.get("visibility", "private")})
        except Exception:  # noqa: BLE001 — file hỏng thì bỏ qua, không chặn list
            continue
    return out
