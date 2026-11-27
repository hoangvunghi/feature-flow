
// ---------- chọn ----------
function selectEl(el) { clearSel(); el.addClass("sel"); }
function clearSel() { if (cy) cy.elements().removeClass("sel"); removeEdgeHandles(); }
function hideEditors() { $("#nodeEditor").classList.add("hidden"); $("#edgeEditor").classList.add("hidden"); $("#groupEditor").classList.add("hidden"); const had = editingGid; editingGid = null; if (had && cy) renderGroups(); }

// click cạnh (edit mode) → mở editor nhãn/định nghĩa + xóa
const arrowIdx = (edge) => { const m = String(edge.id()).match(/^__ar(\d+)_e$/); return m ? +m[1] : -1; };
function removeEdgeHandles() { if (cy) cy.remove("node.ehnd"); }
function showEdgeHandles(edge) {
  removeEdgeHandles();
  const sp = edge.sourceEndpoint(), tp = edge.targetEndpoint();   // đúng 2 ĐẦU mũi tên
  cy.add([
    { group: "nodes", data: { id: "__eh_s", end: "src", esrc: edge.data("source"), etgt: edge.data("target") }, position: { ...sp }, classes: "ehnd", grabbable: true },
    { group: "nodes", data: { id: "__eh_t", end: "tgt", esrc: edge.data("source"), etgt: edge.data("target") }, position: { ...tp }, classes: "ehnd", grabbable: true },
  ]);
}
// 1 click = CHỌN (sáng xanh) + tay cầm 2 đầu; KHÔNG mở ô sửa
function onEdgeTap(edge) {
  if (drawMode || !editing()) return;
  selectEl(edge); hideEditors();
  if (arrowIdx(edge) < 0) showEdgeHandles(edge);
}
// double-click = sửa nội dung (nhãn)
function openEdgeEditor(edge) {
  if (drawMode || !editing()) return;
  selectEl(edge); $("#nodeEditor").classList.add("hidden");
  $("#edgeEditor").classList.remove("hidden");
  const ai = arrowIdx(edge);
  if (ai >= 0) { const ar = flow.arrows[ai]; $("#e-edgepath").textContent = "Mũi tên vô danh (tự do)"; $("#e-elabel").value = ar ? (ar.label || "") : ""; }
  else {
    $("#e-edgepath").textContent = `${labelOf(edge.data("source"))}  →  ${labelOf(edge.data("target"))}`;
    $("#e-elabel").value = edge.data("label") || "";
    showEdgeHandles(edge);
  }
  setTimeout(() => $("#e-elabel").focus(), 30);
}

// ---------- undo / redo (Ctrl+Z / Ctrl+Y) ----------
let undoStack = [], redoStack = [], lastSnap = 0;
function beginChange(throttle) {
  const now = Date.now();
  if (throttle && now - lastSnap < 500) { lastSnap = now; return; }
  undoStack.push(JSON.stringify(flow)); if (undoStack.length > 80) undoStack.shift();
  redoStack = []; lastSnap = now;
}
function resetHistory() { undoStack = []; redoStack = []; lastSnap = 0; }
function restoreSnap(json) { flow = JSON.parse(json); dirty = true; $("#btnSave").disabled = false; renderAll(); if (editing()) { fillFlowMeta(); fillStepEditor(); } }
function undo() { if (!undoStack.length) return; redoStack.push(JSON.stringify(flow)); restoreSnap(undoStack.pop()); toast("Hoàn tác"); }
function redo() { if (!redoStack.length) return; undoStack.push(JSON.stringify(flow)); restoreSnap(redoStack.pop()); toast("Làm lại"); }
$("#e-elabel").addEventListener("input", () => {
  const s = cy.$("edge.sel"); if (s.length === 0) return;
  beginChange(true);
  const ai = arrowIdx(s);
  if (ai >= 0) { const ar = flow.arrows[ai]; if (ar) { ar.label = $("#e-elabel").value; s.data("label", ar.label); markDirty(); } return; }
  const e = flow.edges.find((x) => x.source === s.data("source") && x.target === s.data("target"));
  if (!e) return; e.label = $("#e-elabel").value; s.data("label", e.label); markDirty();
});
$("#btnDelEdge").addEventListener("click", () => {
  const s = cy.$("edge.sel"); if (s.length === 0) return;
  const ai = arrowIdx(s);
  if (ai >= 0) flow.arrows.splice(ai, 1);
  else flow.edges = flow.edges.filter((x) => !(x.source === s.data("source") && x.target === s.data("target")));
  markDirty(); hideEditors(); renderCanvas(false); reveal(curStepN());
});
const labelOf = (id) => { const n = flow.nodes.find((x) => x.id === id); return n ? (n.label || n.type) : id; };

// ---------- edit: node editor ----------
const SWATCH_COLORS = ["#bcd3ec", "#bfe3a0", "#f3d9a8", "#e9b0ad", "#d8ccec", "#bce0dd", "#f5c6a0", "#cbd98f", "#e7c3d4", "#ffffff"];
function fillNodeEditor(n) {
  $("#edgeEditor").classList.add("hidden");
  $("#nodeEditor").classList.remove("hidden");
  $("#e-label").value = n.label || ""; $("#e-step").value = n.step || 0; $("#e-explain").value = n.explain || "";
  $("#e-color").value = /^#[0-9a-f]{6}$/i.test(n.color) ? n.color : (FILL[n.type] || "#bcd3ec");
  const sw = $("#colorSwatches"); sw.innerHTML = "";
  SWATCH_COLORS.forEach((c) => {
    const b = document.createElement("button"); b.className = "swatch"; b.style.background = c; b.title = c;
    b.addEventListener("click", () => setNodeColor(c));
    sw.appendChild(b);
  });
  fillNodeGroupSel();
}
function setNodeColor(c) {
  const selNode = cy.$("node.sel"); if (selNode.length === 0) return;
  const n = nodeOf(selNode.id()); if (!n) return;
  beginChange(); n.color = c || ""; selNode.data("color", n.color); $("#e-color").value = /^#[0-9a-f]{6}$/i.test(c) ? c : (FILL[n.type] || "#bcd3ec"); markDirty();
}
$("#e-color").addEventListener("input", () => setNodeColor($("#e-color").value));
$("#btnColorReset").addEventListener("click", () => setNodeColor(""));
["#e-label", "#e-step", "#e-explain"].forEach((sel) => $(sel).addEventListener("input", () => {
  const selNode = cy.$("node.sel"); if (selNode.length === 0) return;
  const n = nodeOf(selNode.id()); if (!n) return;
  beginChange(true);
  n.label = $("#e-label").value; n.step = parseInt($("#e-step").value || "0", 10) || 0; n.explain = $("#e-explain").value;
  selNode.data("label", n.label);
  maxStepN = flow.nodes.reduce((m, x) => Math.max(m, x.step || 0), 0);
  markDirty();
}));

// ---------- edit: step editor ----------
function fillStepEditor() {
  const s = steps[idx] || {};
  $("#e-stepn").textContent = steps.length ? idx + 1 : "—";
  $("#e-stitle").value = s.title || ""; $("#e-sbody").value = s.body || "";
  $("#e-snote").value = s.note || ""; $("#e-sbadge").value = s.badge || "";
}
["#e-stitle", "#e-sbody", "#e-snote", "#e-sbadge"].forEach((sel) => $(sel).addEventListener("input", () => {
  if (!steps.length) return;
  beginChange(true);
  const s = steps[idx];
  s.title = $("#e-stitle").value; s.body = $("#e-sbody").value;
  s.note = $("#e-snote").value; s.badge = $("#e-sbadge").value;
  // đồng bộ về flow.steps (steps là bản sort, phần tử tham chiếu cùng object nếu từ flow.steps)
  flow.steps = steps;
  paintStep(); renderTracker();
  document.querySelectorAll(".tstep")[idx]?.classList.add("active");
  markDirty();
}));

// ---------- edit: thông tin luồng (tên/nhóm/mô tả) ----------
function fillFlowMeta() {
  $("#e-ftitle").value = flow.title || "";
  $("#e-fgroup").value = flow.group || "";
  $("#e-fsub").value = flow.subtitle || "";
}
$("#e-ftitle").addEventListener("input", () => { beginChange(true); flow.title = $("#e-ftitle").value; $("#flowTitle").textContent = flow.title; markDirty(); });
$("#e-fgroup").addEventListener("input", () => { beginChange(true); flow.group = $("#e-fgroup").value; markDirty(); });
$("#e-fsub").addEventListener("input", () => { beginChange(true); flow.subtitle = $("#e-fsub").value; $("#flowSub").textContent = flow.subtitle; markDirty(); });

// ---------- edit: thêm / nối / xóa ----------
function addNode(type) {
  beginChange();
  const id = `n${Date.now().toString(36)}`;
  const label = type === "process" ? "Bước mới" : type === "decision" ? "Điều kiện?" : "";
  const step = type === "start" ? 0 : maxStepN + 1;
  flow.nodes.push({ id, type, label, explain: "", step });
  // process/decision = 1 bước → thêm luôn vào "TRONG LUỒNG NÀY" (narration/tracker)
  if (type === "process" || type === "decision") {
    (flow.steps = flow.steps || []).push({ n: step, title: label, body: "", note: "", note_type: "info", badge: "" });
    steps = [...flow.steps].sort((a, b) => a.n - b.n);
    renderTracker();
    const chip = $("#chips .chip.purple"); if (chip) chip.textContent = `☰ ${steps.length} bước`;
  }
  markDirty(); renderCanvas(false); reveal(curStepN());
}
function startLink(fromId) {
  linkFrom = typeof fromId === "string" ? fromId : null;
  cy.elements().removeClass("linksrc");
  if (linkFrom) { cy.getElementById(linkFrom).addClass("linksrc"); $("#editHint").textContent = "Bấm KHỐI ĐÍCH để nối."; }
  else $("#editHint").textContent = "Bấm KHỐI NGUỒN rồi KHỐI ĐÍCH.";
  const h = (ev) => {
    const id = ev.target.id();
    if (!linkFrom) { linkFrom = id; ev.target.addClass("linksrc"); return; }
    if (id !== linkFrom) {
      flow.edges.push({ source: linkFrom, target: id, label: "" });
      markDirty(); cy.off("tap", "node", h); $("#editHint").textContent = ""; renderCanvas(false); reveal(curStepN());
    }
  };
  cy.on("tap", "node", h);
}
function deleteSel() {
  const s = cy.$(".sel"); if (s.length === 0) return;
  beginChange();
  if (s.isNode()) {
    if (s.data("type") === "anchor") return;   // anchor = đầu mũi tên vô danh; xoá bằng cách xoá cạnh
    const id = s.id();
    flow.nodes = flow.nodes.filter((n) => n.id !== id);
    flow.edges = flow.edges.filter((e) => e.source !== id && e.target !== id);
    $("#nodeEditor").classList.add("hidden");
  } else {
    const ai = arrowIdx(s);
    if (ai >= 0) flow.arrows.splice(ai, 1);
    else flow.edges = flow.edges.filter((e) => !(e.source === s.data("source") && e.target === s.data("target")));
  }
  markDirty(); renderCanvas(false); reveal(curStepN());
}
const curStepN = () => (steps.length ? steps[idx].n : maxStepN);

// ---------- context menu (chuột phải) ----------
function setEdit(on) { if (READONLY) return; const cb = $("#editMode"); if (cb.checked !== on) { cb.checked = on; cb.dispatchEvent(new Event("change")); } }
function hideCtx() { $("#ctxmenu").classList.add("hidden"); }
function showCtx(items, x, y) {
  if (READONLY) return;   // menu chuột phải toàn thao tác sửa (đổi tên/xoá/nhóm/ghi chú)
  const m = $("#ctxmenu"); m.innerHTML = "";
  items.forEach((it) => {
    if (it.sep) { const s = document.createElement("div"); s.className = "sep"; m.appendChild(s); return; }
    const d = document.createElement("div"); d.className = "ci" + (it.danger ? " danger" : "");
    const mm = it.label.match(/^(\S+)\s+([\s\S]*)$/);   // tách icon đầu → cột cố định cho thẳng hàng
    if (mm) d.innerHTML = `<span class="ci-ic">${esc(mm[1])}</span><span>${esc(mm[2])}</span>`;
    else d.textContent = it.label;
    d.addEventListener("click", (e) => { e.stopPropagation(); hideCtx(); it.act(); });
    m.appendChild(d);
  });
  m.classList.remove("hidden");
  m.style.left = Math.min(x, window.innerWidth - m.offsetWidth - 8) + "px";
  m.style.top = Math.min(y, window.innerHeight - m.offsetHeight - 8) + "px";
}
function ctxBg(x, y) {
  showCtx([
    { label: editing() ? "✓ Đang chỉnh sửa — tắt" : "✎ Bật chỉnh sửa", act: () => setEdit(!editing()) },
    { sep: true },
    { label: "＋ Thêm bước", act: () => { setEdit(true); addNode("process"); } },
    { label: "＋ Thêm nhánh (rẽ)", act: () => { setEdit(true); addNode("decision"); } },
    { label: "＋ Thêm Start", act: () => { setEdit(true); addNode("start"); } },
    { label: "＋ Thêm End", act: () => { setEdit(true); addNode("end"); } },
    { sep: true },
    { label: "🔗 Thêm mũi tên", act: () => { setEdit(true); addFreeArrowAt(clientToModel({ x, y })); } },
    { label: "▭ Tạo nhóm (kéo khoanh vùng)", act: () => { setEdit(true); enterGroupMode(); } },
  ], x, y);
}

// ---------- nhóm (group) ----------
const GROUP_COLORS = ["#8a6fd0", "#4e9a5f", "#d9793e", "#3f7fb0", "#c05a7a", "#2f9e8f", "#d9a441"];
function createGroup(name, color) {
  const id = "g" + Date.now().toString(36).slice(-5);
  const used = new Set((flow.groups || []).map((g) => g.color));
  const pick = color || GROUP_COLORS.find((c) => !used.has(c)) || GROUP_COLORS[(flow.groups || []).length % GROUP_COLORS.length];
  (flow.groups = flow.groups || []).push({ id, label: name || "Nhóm", color: pick, members: [] });
  return id;
}
// ---------- bảng sửa nhóm (bấm vào khung) ----------
function openGroupEditor(gid) {
  const g = (flow.groups || []).find((x) => x.id === gid); if (!g) return;
  editingGid = gid; clearSel(); renderGroups();   // renderGroups → hiện tay cầm resize 4 góc
  const box = cy.getElementById("__g_" + gid); if (box.nonempty()) box.addClass("sel");
  $("#nodeEditor").classList.add("hidden"); $("#edgeEditor").classList.add("hidden");
  $("#groupEditor").classList.remove("hidden");
  $("#g-name").value = g.label || "";
  $("#g-explain").value = g.explain || "";
  $("#g-color").value = /^#[0-9a-f]{6}$/i.test(g.color) ? g.color : "#8a6fd0";
  const sw = $("#gColorSwatches"); sw.innerHTML = "";
  GROUP_COLORS.forEach((c) => { const b = document.createElement("button"); b.className = "swatch"; b.style.background = c; b.title = c; b.addEventListener("click", () => setGroupColor(c)); sw.appendChild(b); });
}
const curGroup = () => (flow.groups || []).find((x) => x.id === editingGid);
function setGroupColor(c) { const g = curGroup(); if (!g) return; beginChange(); g.color = c; $("#g-color").value = /^#[0-9a-f]{6}$/i.test(c) ? c : "#8a6fd0"; markDirty(); renderGroups(); }
function resizeGroup(d) { const g = curGroup(); if (!g) return; const r = groupRect(g); if (!r) return; beginChange(); setGroupRect(g, { x1: r.x1 - d, y1: r.y1 - d, x2: r.x2 + d, y2: r.y2 + d }); markDirty(); renderGroups(); }
$("#g-name").addEventListener("input", () => { const g = curGroup(); if (!g) return; beginChange(true); g.label = $("#g-name").value; markDirty(); renderGroups(); });
$("#g-explain").addEventListener("input", () => { const g = curGroup(); if (!g) return; beginChange(true); g.explain = $("#g-explain").value; markDirty(); });
$("#g-color").addEventListener("input", () => setGroupColor($("#g-color").value));
$("#g-bigger").addEventListener("click", () => resizeGroup(12));
$("#g-smaller").addEventListener("click", () => resizeGroup(-12));
$("#g-del").addEventListener("click", () => { if (!editingGid) return; beginChange(); flow.groups = (flow.groups || []).filter((x) => x.id !== editingGid); editingGid = null; markDirty(); $("#groupEditor").classList.add("hidden"); renderGroups(); fillNodeGroupSel(); });

function setNodeGroup(nodeId, gid) {
  beginChange();
  (flow.groups || []).forEach((g) => { g.members = (g.members || []).filter((m) => m !== nodeId); });
  if (gid) { const g = flow.groups.find((x) => x.id === gid); if (g) g.members.push(nodeId); }
  markDirty(); renderGroups();
}
function fillNodeGroupSel() {
  const sel = $("#e-nodegroup"); if (!sel) return;
  const selNode = cy.$("node.sel"); const nid = selNode.length ? selNode.id() : null;
  const cur = (flow.groups || []).find((g) => (g.members || []).includes(nid));
  sel.innerHTML = '<option value="">— không —</option>'
    + (flow.groups || []).map((g) => `<option value="${esc(g.id)}"${cur && cur.id === g.id ? " selected" : ""}>${esc(g.label)}</option>`).join("")
    + '<option value="__new">+ Tạo nhóm mới…</option>';
}
$("#e-nodegroup").addEventListener("change", async () => {
  const selNode = cy.$("node.sel"); if (selNode.length === 0) return;
  const v = $("#e-nodegroup").value;
  if (v === "__new") { const name = await askPrompt("Tên nhóm mới:", "Nhóm"); if (name == null) { fillNodeGroupSel(); return; } const gid = createGroup(name); setNodeGroup(selNode.id(), gid); fillNodeGroupSel(); return; }
  setNodeGroup(selNode.id(), v);
});
function ctxGroup(gid, x, y) {
  const g = (flow.groups || []).find((x) => x.id === gid); if (!g) return;
  showCtx([
    { label: "✎ Sửa khung (tên / màu / cỡ)", act: () => { setEdit(true); openGroupEditor(gid); } },
    { label: "✏️ Đổi tên nhanh", act: async () => { const t = await askPrompt("Tên nhóm:", g.label); if (t == null) return; beginChange(); g.label = t; markDirty(); renderGroups(); } },
    { label: "🎨 Đổi màu nhanh", act: () => { const i = (GROUP_COLORS.indexOf(g.color) + 1) % GROUP_COLORS.length; beginChange(); g.color = GROUP_COLORS[i]; markDirty(); renderGroups(); } },
    { sep: true },
    { label: "🗑 Xóa nhóm (giữ khối)", danger: true, act: () => { beginChange(); flow.groups = flow.groups.filter((x) => x.id !== gid); markDirty(); renderGroups(); } },
  ], x, y);
}
function addFreeArrowAt(p) {
  beginChange();
  (flow.arrows = flow.arrows || []).push({ x1: p.x, y1: p.y, x2: p.x + 160, y2: p.y, label: "" });
  markDirty(); renderCanvas(false); reveal(curStepN());
  toast("Đã thêm mũi tên — kéo 2 đầu để nối vào khối");
}
function ctxNode(node, x, y) {
  const nid = node.id();
  const cur = (flow.groups || []).find((g) => (g.members || []).includes(nid));
  const hasNote = !!(nodeOf(nid) || {}).note;
  const items = [
    { label: "✎ Sửa khối này", act: () => { setEdit(true); selectEl(node); fillNodeEditor(nodeOf(nid)); } },
    { label: hasNote ? "📝 Sửa ghi chú khối" : "📝 Thêm ghi chú khối", act: () => openNoteBox(node) },
    { label: "🔗 Nối từ khối này", act: () => { setEdit(true); startLink(nid); } },
    { sep: true },
  ];
  (flow.groups || []).forEach((g) => {
    if (cur && cur.id === g.id) return;
    items.push({ label: `▭ Thêm vào nhóm: ${g.label || "Nhóm"}`, act: () => { setEdit(true); setNodeGroup(nid, g.id); toast(`Đã thêm vào "${g.label || "Nhóm"}"`); } });
  });
  if (cur) items.push({ label: `▭ Bỏ khỏi nhóm: ${cur.label || "Nhóm"}`, act: () => { setEdit(true); setNodeGroup(nid, ""); toast("Đã bỏ khỏi nhóm"); } });
  items.push({ sep: true }, { label: "🗑 Xóa khối", danger: true, act: () => { setEdit(true); selectEl(node); deleteSel(); } });
  showCtx(items, x, y);
}

