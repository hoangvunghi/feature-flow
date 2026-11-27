// path: feature_flow/static/app.js
// Nguồn sự thật = `flow` (giống JSON server). Cytoscape chỉ để vẽ.
cytoscape.use(window.cytoscapeDagre);
if (window.cytoscapeEdgehandles) cytoscape.use(window.cytoscapeEdgehandles);

let flow = { id: null, title: "", nodes: [], edges: [], steps: [], learn: [] };
let cy = null, eh = null, steps = [], idx = 0, maxStepN = 0;
let dirty = false, viewingNode = false, linkFrom = null, playTimer = null, drawMode = false, presenting = false, groupMode = false;
let lastClient = { x: 0, y: 0 }, ehCompleted = false, editingGid = null;
let flowOn = true, flowRaf = null, dashOff = 0;   // mũi tên chạy "kiến bò" theo chiều đi
document.addEventListener("mousemove", (e) => { lastClient = { x: e.clientX, y: e.clientY }; });
const $ = (s) => document.querySelector(s);
// READONLY: app nhúng trả api/me {can_edit:false} → khoá mọi chỉnh sửa ở UI. Server vẫn chặn thật.
let READONLY = false;
const editing = () => !READONLY && $("#editMode").checked;

// Bộ icon khối (SVG nét đơn 24×24, tự vẽ). Tên = giá trị Node.icon. Vẽ thành data URI (CSP img-src data: cho phép).
const ICONS = {
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h4M7 16.5h4"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  laptop: '<rect x="5" y="4" width="14" height="10" rx="1.5"/><path d="M2 18h20l-2-4H4z"/>',
  cloud: '<path d="M7 19h10a5 5 0 0 0 .6-9.96A6 6 0 0 0 6.2 9.6 4.7 4.7 0 0 0 7 19z"/>',
  balancer: '<circle cx="5" cy="12" r="2.5"/><path d="M7.5 12h5M12.5 12l6-6M12.5 12l6 6M12.5 12h6M16 4h3v3M16 20h3v-3M17 10.5l2 1.5-2 1.5"/>',
  queue: '<rect x="3" y="7" width="4" height="10" rx="1"/><rect x="10" y="7" width="4" height="10" rx="1"/><rect x="17" y="7" width="4" height="10" rx="1"/>',
  file: '<path d="M6 2h8l5 5v15H6z"/><path d="M14 2v5h5M9 13h7M9 17h7"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5M12 14.5v2.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 7 8.5-7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  api: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14"/>',
  chart: '<path d="M4 20V4M4 20h16"/><rect x="7" y="12" width="3" height="5"/><rect x="12" y="8" width="3" height="9"/><rect x="17" y="10" width="3" height="7"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M7.5 12.5l3 3 6-6.5"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
};
const ICON_NAMES = Object.keys(ICONS);
const _iconCache = {};
function iconUri(name, color) {
  const k = name + color;
  if (!_iconCache[k] && ICONS[name]) _iconCache[k] = "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" `
    + `stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`);
  return _iconCache[k] || "none";
}

// ---------- kiểu vẽ 3D isometric (flow.look = "iso") ----------
// Khối = ảnh SVG tự sinh (mặt trên sáng, 2 mặt bên đậm dần, viền mực dày, bóng đổ) đặt làm nền node trong suốt.
const isIso = () => !!(flow && flow.look === "iso");
function hexMix(hex, f) {   // f>0 pha trắng, f<0 pha đen; màu không phải #hex thì giữ nguyên
  let h = String(hex || "").trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return hex;
  const t = f > 0 ? 255 : 0, a = Math.abs(f);
  return "#" + [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - a) + t * a)
    .toString(16).padStart(2, "0")).join("");
}
const _isoCache = {};
// đa giác bo góc bán kính r (path SVG) — viền khối mềm như đồ chơi gỗ
function roundPoly(pts, r) {
  const n = pts.length, seg = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const u = (q) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * r, p[1] + dy / l * r]; };
    const s0 = u(a), s1 = u(b);
    seg.push(`${i ? "L" : "M"}${s0[0].toFixed(1)} ${s0[1].toFixed(1)}Q${p[0]} ${p[1]} ${s1[0].toFixed(1)} ${s1[1].toFixed(1)}`);
  }
  return seg.join("") + "Z";
}
function isoUri(type, fill, icon, ink) {
  const k = [type, fill, icon, ink].join("|");
  if (_isoCache[k]) return _isoCache[k];
  const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const defs = "<defs>" + grad("t", hexMix(fill, 0.62), hexMix(fill, 0.46)) + grad("l", hexMix(fill, 0.12), hexMix(fill, -0.02))
    + grad("r", hexMix(fill, -0.06), hexMix(fill, -0.16))
    + `<filter id="b" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="3.2"/></filter>`;
  const line = `fill="none" stroke="${ink}" stroke-width="4" stroke-linejoin="round"`;
  const ic = (cx, cy, sz) => ICONS[icon] ? `<svg x="${cx - sz / 2}" y="${cy - sz / 2}" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" `
    + `stroke="${ink}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon]}</svg>` : "";
  const P = (pts) => pts.map((q) => q.join(" ")).join(" ");
  let vb, body;
  if (type === "decision") {          // tấm hình thoi có độ dày
    vb = "0 0 120 96";
    const T = [[60, 10], [114, 40], [60, 70], [6, 40]], out = [[60, 10], [114, 40], [114, 52], [60, 82], [6, 52], [6, 40]];
    const o = roundPoly(out, 8);
    body = defs + `<clipPath id="c"><path d="${o}"/></clipPath></defs>`
      + `<ellipse cx="62" cy="82" rx="52" ry="11" fill="${ink}" opacity=".25" filter="url(#b)"/>`
      + `<g clip-path="url(#c)"><polygon points="${P([[6, 40], [60, 70], [114, 40], [114, 52], [60, 82], [6, 52]])}" fill="url(#r)"/>`
      + `<polygon points="${P(T)}" fill="url(#t)"/></g>`
      + `<path d="M6 40 60 70 114 40" fill="none" stroke="${ink}" stroke-opacity=".3" stroke-width="1.4"/>`
      + `<path d="${o}" ${line}/>` + ic(60, 34, 24);
  } else if (type === "start" || type === "end") {   // đĩa tròn
    vb = "0 0 120 76";
    body = defs + "</defs>" + `<ellipse cx="62" cy="58" rx="52" ry="12" fill="${ink}" opacity=".25" filter="url(#b)"/>`
      + `<path d="M8 30v12c0 13 23 22 52 22s52-9 52-22V30" fill="url(#r)" stroke="${ink}" stroke-width="3.2"/>`
      + `<ellipse cx="60" cy="30" rx="52" ry="22" fill="url(#t)" stroke="${ink}" stroke-width="3.2"/>`;
  } else {                            // khối hộp lục giác bo góc
    vb = "0 0 120 112";   // tỉ lệ khối bè, lùn như sơ đồ isometric chuẩn: mặt bên ≈ 0,36 × bề rộng
    const T = [60, 6], R1 = [114, 36], R2 = [114, 75], B = [60, 105], L2 = [6, 75], L1 = [6, 36], C = [60, 66];
    const o = roundPoly([T, R1, R2, B, L2, L1], 14);
    body = defs + `<clipPath id="c"><path d="${o}"/></clipPath></defs>`
      + `<ellipse cx="62" cy="104" rx="52" ry="8" fill="${ink}" opacity=".22" filter="url(#b)"/>`
      + `<g clip-path="url(#c)"><polygon points="${P([L1, C, B, L2])}" fill="url(#l)"/>`
      + `<polygon points="${P([R1, R2, B, C])}" fill="url(#r)"/><polygon points="${P([T, R1, C, L1])}" fill="url(#t)"/></g>`
      + `<path d="M${L1.join(" ")} ${C.join(" ")} ${R1.join(" ")}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.6"/>`
      + `<path d="${o}" ${line}/>` + ic(60, 33, 30);
  }
  return (_isoCache[k] = "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="${vb}">${body}</svg>`));
}
// Chữ trên khối 3D: font HỆ THỐNG (đủ dấu tiếng Việt sẵn, không phải tải từng phần như font web → không méo "ườ").
const ISO_FONT = "FFMono, Segoe UI, Helvetica Neue, Roboto, Arial, monospace";
function isoStyles(ink, lineInk, accent) {
  // màu mặc định kiểu 3D: khối xanh, rẽ nhánh cam (khối tự đặt màu giữ màu của nó)
  const ISO_FILL = { process: "#a9c6ec", decision: "#f4b47e", start: FILL.start, end: FILL.end };
  const img = (n) => isoUri(n.data("type"), n.data("color") || ISO_FILL[n.data("type")] || ISO_FILL.process, n.data("icon"), lineInk);
  const node = { "shape": "rectangle", "background-opacity": 0, "border-width": 0, "background-image": img,
    "background-fit": "contain", "background-clip": "none", "background-image-containment": "over",
    "background-width": "100%", "background-height": "100%", "background-position-x": "50%", "background-position-y": "50%",
    "font-family": ISO_FONT, "font-weight": 700, "color": lineInk };
  return [
    { selector: 'node[type="process"]', style: { ...node, "width": 210, "height": 196, "font-size": 23,
        "shape": "polygon", "shape-polygon-points": [0, -0.89, 0.9, -0.36, 0.9, 0.34, 0, 0.88, -0.9, 0.34, -0.9, -0.36],
        "text-max-width": 160, "text-margin-y": 26, "line-height": 1.1 } },
    { selector: 'node[type="decision"]', style: { ...node, "width": 200, "height": 160, "font-size": 18,
        "shape": "polygon", "shape-polygon-points": [0, -0.79, 0.9, -0.17, 0.9, 0.08, 0, 0.71, -0.9, 0.08, -0.9, -0.17],
        "text-max-width": 130, "text-margin-y": 4 } },
    { selector: 'node[type="start"],node[type="end"]', style: { ...node, "width": 96, "height": 61, "label": "",
        "shape": "ellipse" } },
    { selector: "edge", style: { "width": 3.4, "line-color": lineInk, "target-arrow-color": lineInk, "arrow-scale": 1.5,
        "curve-style": "round-segments", "segment-radius": 26, "edge-distances": "node-position",
        "segment-weights": (e) => e.data("sw") ?? 0.5, "segment-distances": (e) => e.data("sd") ?? 0,
        "line-style": "solid", "font-size": 14 } },
    { selector: "edge.loopback", style: { "curve-style": "unbundled-bezier" } },
    { selector: "node.statbadge", style: { "height": 42, "corner-radius": 21, "border-width": 3.6, "font-size": 18,
        "background-color": "#fffdf8", "color": lineInk, "border-color": lineInk,
        "font-family": ISO_FONT, "font-weight": 700,
        "width": (n) => 36 + 10.5 * [...(n.data("label") || "")].length } },
    // khối 3D không có viền chữ nhật → đánh dấu bước hiện tại / đang chọn bằng quầng sáng phía dưới
    { selector: 'node.current[type="process"],node.current[type="decision"],node.current[type="start"],node.current[type="end"]',
      style: { "border-width": 0, "underlay-color": accent, "underlay-opacity": 0.28, "underlay-padding": 8, "underlay-shape": "ellipse" } },
    { selector: 'node.sel[type="process"],node.sel[type="decision"],node.sel[type="start"],node.sel[type="end"]',
      style: { "border-width": 0, "underlay-color": "#d89a2e", "underlay-opacity": 0.35, "underlay-padding": 8, "underlay-shape": "ellipse" } },
  ];
}

// Màu khối theo SẮC ĐỘ đang chọn (đọc biến CSS) — đổi theme thì cy.style(stylesheet()) vẽ lại.
// Khối tự đặt màu (n.color) giữ nguyên màu của nó.
const FILL = {};
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue("--" + name).trim();

function stylesheet() {
  Object.assign(FILL, { process: cssVar("card2"), decision: cssVar("amber"), start: cssVar("green"), end: cssVar("tint2") });
  const ink = cssVar("ink"), lineInk = cssVar("line-ink"), soft = cssVar("ink-soft"), accent = cssVar("green-d");
  const base = [
    { selector: "node", style: {
        "label": "data(label)", "color": ink, "text-wrap": "wrap", "text-max-width": 180,
        "text-valign": "center", "text-halign": "center", "font-family": "Nunito, sans-serif",
        "font-weight": 800, "font-size": 16, "width": 220, "height": 84, "padding": 10,
        "shape": "round-rectangle", "corner-radius": 16, "background-color": (n) => n.data("color") || FILL[n.data("type")] || FILL.process,
        "border-width": 2, "border-color": lineInk, "shadow-blur": 0, "z-index": 10,
        "transition-property": "opacity, border-width, border-color", "transition-duration": 350 } },
    { selector: "node.groupbox", style: { "shape": "round-rectangle", "corner-radius": 18,
        "width": "data(w)", "height": "data(h)", "background-color": "data(gcolor)", "background-opacity": 0.13,
        "border-width": 2, "border-color": "data(gcolor)", "border-opacity": 0.65, "label": "data(label)",
        "text-valign": "top", "text-halign": "left", "text-margin-x": 14, "text-margin-y": 15,
        "font-weight": 800, "font-size": 14, "color": "data(gcolor)",
        "text-background-color": cssVar("card2"), "text-background-opacity": 0.92, "text-background-padding": 4,
        "text-background-shape": "roundrectangle", "z-index": 1 } },
    { selector: 'node[type="decision"]', style: { "shape": "diamond", "width": 230, "height": 150, "font-size": 15 } },
    { selector: 'node[type="start"],node[type="end"]', style: { "shape": "ellipse", "width": 60, "height": 60, "label": "" } },
    // khối có icon: icon ở trên, chữ dịch xuống (cao thêm để không đè)
    { selector: 'node[type="process"][icon != ""]', style: { "height": 112, "text-margin-y": 16,
        "background-image": (n) => iconUri(n.data("icon"), ink), "background-fit": "none", "background-clip": "none",
        "background-width": 30, "background-height": 30, "background-position-y": 14 } },
    { selector: 'node[type="decision"][icon != ""]', style: { "text-margin-y": 14,
        "background-image": (n) => iconUri(n.data("icon"), ink), "background-fit": "none", "background-clip": "none",
        "background-width": 26, "background-height": 26, "background-position-y": 34 } },
    // nhãn trạng thái nổi trên khối (Node.badge) + chấm chạy dọc mũi tên khi trình chiếu — không bắt sự kiện chuột
    { selector: "node.statbadge", style: { "shape": "round-rectangle", "corner-radius": 13, "height": 26,
        "width": (n) => 18 + 7.6 * [...(n.data("label") || "")].length, "background-color": cssVar("card2"),
        "border-width": 2, "border-color": lineInk, "label": "data(label)", "color": ink,
        "font-family": "Space Mono, monospace", "font-size": 12, "font-weight": 700,
        "text-valign": "center", "text-halign": "center", "events": "no", "z-index": 40,
        "transition-property": "opacity", "transition-duration": 350 } },
    { selector: "node.packet", style: { "shape": "ellipse", "width": 14, "height": 14, "background-color": accent,
        "border-width": 2, "border-color": lineInk, "label": "", "events": "no", "z-index": 95 } },
    { selector: "edge", style: {
        "label": "data(label)", "font-family": "Space Mono, monospace", "font-size": 12, "font-weight": 700,
        "color": ink, "text-background-color": cssVar("card2"), "text-background-opacity": 1,
        "text-background-shape": "roundrectangle", "text-background-padding": 4,
        "text-border-width": 1, "text-border-color": cssVar("line"), "text-border-opacity": 1,
        "curve-style": "bezier", "width": 2, "z-index": 6,
        "line-color": soft, "target-arrow-color": soft, "target-arrow-shape": "triangle" } },
    { selector: "node.anchor", style: { "width": 11, "height": 11, "shape": "ellipse",
        "background-color": accent, "border-width": 2, "border-color": lineInk, "label": "" } },
    { selector: "node.ehnd", style: { "width": 13, "height": 13, "shape": "ellipse",
        "background-color": "#4f8cff", "border-width": 2, "border-color": "#2b2824", "label": "", "z-index": 99 } },
    { selector: "node.grhandle", style: { "width": 13, "height": 13, "shape": "round-rectangle",
        "corner-radius": 3, "background-color": "#4f8cff", "border-width": 2, "border-color": "#ffffff",
        "label": "", "z-index": 100 } },
    { selector: "node.notebadge", style: { "width": 19, "height": 19, "shape": "ellipse",
        "background-color": "#d9534f", "border-width": 2, "border-color": "#fff", "label": "!",
        "color": "#fff", "font-weight": 800, "font-size": 14, "text-valign": "center", "text-halign": "center", "z-index": 30 } },
    { selector: "edge.sel", style: { "line-color": "#4f8cff", "target-arrow-color": "#4f8cff", "width": 3.5, "z-index": 90 } },
    { selector: "edge.freearrow", style: { "line-style": "dashed", "line-color": soft,
        "target-arrow-color": soft, "width": 2 } },
    { selector: "edge.loopback", style: { "curve-style": "unbundled-bezier",
        "control-point-distances": [130], "control-point-weights": [0.5],
        "line-color": accent, "target-arrow-color": accent, "width": 2.5 } },
    { selector: ".tmp", style: { "opacity": 0.8 } },
    { selector: ".dim", style: { "opacity": 0.14 } },
    { selector: ".faded", style: { "opacity": 0.12 } },
    { selector: ".current", style: { "border-color": accent, "border-width": 4, "shadow-blur": 0 } },
    { selector: ".sel", style: { "border-color": "#d89a2e", "border-width": 4 } },
    { selector: ".linksrc", style: { "border-color": "#4fd2a0", "border-width": 4 } },
  ];
  return isIso() ? base.concat(isoStyles(ink, lineInk, accent)) : base;
}

