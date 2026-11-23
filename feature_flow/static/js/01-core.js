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
const editing = () => $("#editMode").checked;

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

