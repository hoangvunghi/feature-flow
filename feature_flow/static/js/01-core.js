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
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" `
    + `stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`);
  return _iconCache[k] || "none";
}

// Màu khối theo SẮC ĐỘ đang chọn (đọc biến CSS) — đổi theme thì cy.style(stylesheet()) vẽ lại.
// Khối tự đặt màu (n.color) giữ nguyên màu của nó.
const FILL = {};
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue("--" + name).trim();

function stylesheet() {
  Object.assign(FILL, { process: cssVar("card2"), decision: cssVar("amber"), start: cssVar("green"), end: cssVar("tint2") });
  const ink = cssVar("ink"), lineInk = cssVar("line-ink"), soft = cssVar("ink-soft"), accent = cssVar("green-d");
  return [
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
}

