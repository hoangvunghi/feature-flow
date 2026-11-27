// ---------- render ----------
function buildElements() {
  const els = [];
  for (const n of flow.nodes) els.push({ data: { id: n.id, label: n.label, type: n.type, color: n.color || "", icon: ICONS[n.icon] ? n.icon : "" } });
  for (const e of flow.edges) {
    const s = flow.nodes.find((n) => n.id === e.source), t = flow.nodes.find((n) => n.id === e.target);
    const back = s && t && (s.step || 0) > 0 && (t.step || 0) > 0 && (t.step < s.step);   // cạnh quay-ngược = vòng lặp
    els.push({ data: { id: `${e.source}->${e.target}`, source: e.source, target: e.target, label: e.label || "" }, classes: back ? "loopback" : "" });
  }
  return els;
}

function renderCanvas(fit = true) {
  if (cy) cy.destroy();
  cy = cytoscape({ container: $("#cy"), elements: buildElements(), style: stylesheet(),
    wheelSensitivity: 0.2, maxZoom: 1.5, minZoom: 0.12 });
  // 1) Lần ĐẦU (chưa khối nào có toạ độ) → auto-layout dagre xếp dọc. Có bố cục rồi thì KHÔNG xếp lại.
  const unpos = flow.nodes.filter((n) => n.x == null || n.y == null);
  if (flow.nodes.length && unpos.length === flow.nodes.length) {
    cy.layout({ name: "dagre", rankDir: "TB", nodeSep: 50, rankSep: 62 }).run();
  }
  // 2) Áp vị trí đã lưu (kéo tay / đóng băng).
  flow.nodes.forEach((n) => { if (n.x != null && n.y != null) { const el = cy.getElementById(n.id); if (el.nonempty()) el.position({ x: n.x, y: n.y }); } });
  // 3) Khối MỚI thêm vào sơ đồ đã bố cục → đặt bên phải, không đụng khối cũ.
  const stillUn = flow.nodes.filter((n) => n.x == null || n.y == null);
  if (stillUn.length && stillUn.length < flow.nodes.length) {
    const bb = cy.nodes('[type != "anchor"]').boundingBox();
    stillUn.forEach((n, k) => { const el = cy.getElementById(n.id); if (el.nonempty()) el.position({ x: bb.x2 + 130, y: bb.y1 + k * 95 }); });
  }
  // 4) ĐÓNG BĂNG: lưu vị trí hiện tại cho khối chưa có → lần render sau giữ nguyên, không tự sắp xếp.
  flow.nodes.forEach((n) => { if (n.x == null || n.y == null) { const el = cy.getElementById(n.id); if (el.nonempty()) { const p = el.position(); n.x = p.x; n.y = p.y; } } });
  (flow.arrows || []).forEach((ar, i) => addFreeArrow(ar, i));                   // mũi tên vô danh (toạ độ tuyệt đối)
  renderGroups();                                                                // khung nhóm (bọc quanh members)
  renderNoteBadges();                                                            // dấu ! ghi chú khối
  if (fit) cy.fit(undefined, 40);

  cy.on("tap", "node", (ev) => onNodeTap(ev.target));
  cy.on("tap", "edge", (ev) => onEdgeTap(ev.target));
  cy.on("dbltap", "edge", (ev) => openEdgeEditor(ev.target));
  cy.on("tap", "node.notebadge", (ev) => { const el = cy.getElementById(ev.target.data("forid")); if (el.nonempty()) openNoteBox(el); });
  cy.on("pan zoom", () => { if (noteBoxNode) positionNoteBox(); });
  cy.on("tap", "node.groupbox", (ev) => { if (editing()) openGroupEditor(ev.target.data("gid")); else onGroupTap(ev.target.data("gid")); });
  cy.on("cxttap", "node.groupbox", (ev) => { const e = ev.originalEvent; if (e) e.preventDefault(); ctxGroup(ev.target.data("gid"), e ? e.clientX : 200, e ? e.clientY : 200); });
  cy.on("cxttap", "node", (ev) => { if (ev.target.hasClass("groupbox") || ev.target.hasClass("notebadge") || ev.target.hasClass("grhandle")) return; const e = ev.originalEvent; if (e) e.preventDefault(); ctxNode(ev.target, e ? e.clientX : 200, e ? e.clientY : 200); });
  cy.on("cxttap", (ev) => { if (ev.target !== cy) return; const e = ev.originalEvent; if (e) e.preventDefault(); ctxBg(e ? e.clientX : 200, e ? e.clientY : 200); });
  cy.on("tap", (ev) => {
    if (ev.target !== cy) return;
    clearSel(); hideEditors(); unfocus();
    if (presenting || viewingNode) { viewingNode = false; showFull(); }   // bấm nền → về Tổng quan
  });
  // lưu vị trí mũi tên vô danh khi kéo đầu mũi tên
  cy.on("dragfree", "node.anchor", (ev) => {
    const n = ev.target, i = n.data("arr"), ar = (flow.arrows || [])[i]; if (!ar) return;
    beginChange();
    const p = n.position(); if (n.data("end") === "a") { ar.x1 = p.x; ar.y1 = p.y; } else { ar.x2 = p.x; ar.y2 = p.y; }
    // 2 đầu đều rơi trúng khối → tự chuyển thành LIÊN KẾT thật
    const na = nodeAtPos({ x: ar.x1, y: ar.y1 }), nb = nodeAtPos({ x: ar.x2, y: ar.y2 });
    if (na && nb && na.id() !== nb.id()) {
      flow.arrows.splice(i, 1);
      if (!flow.edges.some((x) => x.source === na.id() && x.target === nb.id()))
        flow.edges.push({ source: na.id(), target: nb.id(), label: ar.label || "" });
      markDirty(); renderCanvas(false); reveal(curStepN()); return;
    }
    markDirty();
  });
  // kéo KHỐI → lưu vị trí (không để layout kéo về chỗ cũ ở lần render sau)
  cy.on("dragfree", "node", (ev) => {
    const el = ev.target;
    if (el.hasClass("anchor") || el.hasClass("ehnd") || el.hasClass("tmp") || el.hasClass("grhandle") || el.hasClass("notebadge") || !editing()) return;
    const n = flow.nodes.find((x) => x.id === el.id()); if (!n) return;
    beginChange(); const p = el.position(); n.x = p.x; n.y = p.y; markDirty();
    if ((flow.groups || []).some((g) => (g.members || []).includes(n.id))) renderGroups();
    if ((n.notes && n.notes.length) || n.badge) renderNoteBadges();   // dấu ! + nhãn nổi đi theo khối
  });
  // kéo tay cầm vàng ở 2 đầu mũi tên THẬT → đổi khối nối (reconnect)
  cy.on("dragfree", "node.ehnd", (ev) => {
    const h = ev.target, pos = { ...h.position() }, hit = nodeAtPos(pos);
    const e = flow.edges.find((x) => x.source === h.data("esrc") && x.target === h.data("etgt"));
    const done = () => { removeEdgeHandles(); renderCanvas(false); reveal(curStepN()); };
    if (!e) { done(); return; }
    const isSrc = h.data("end") === "src";
    const curId = isSrc ? e.source : e.target;        // khối đầu này đang nối
    const otherId = isSrc ? e.target : e.source;      // khối đầu kia
    if (hit && hit.id() === curId) { done(); return; }   // thả lại chỗ cũ → không đổi
    beginChange();
    if (hit && hit.id() !== otherId) {                // thả lên khối khác → ĐỔI nối
      if (isSrc) e.source = hit.id(); else e.target = hit.id();
    } else {                                          // thả ra TRỐNG → tách thành mũi tên vô danh
      const o = cy.getElementById(otherId), op = o.nonempty() ? { ...o.position() } : { x: pos.x - 120, y: pos.y };
      flow.edges = flow.edges.filter((x) => !(x.source === e.source && x.target === e.target));
      const a = isSrc ? pos : op, b = isSrc ? op : pos;   // giữ hướng nguồn→đích
      (flow.arrows = flow.arrows || []).push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, label: e.label || "" });
    }
    markDirty(); done();
  });
  // kéo KHUNG NHÓM → di chuyển cả cụm khối thành viên (+ dời hình học nếu đã resize tay)
  let grpDrag = null;
  cy.on("grab", "node.groupbox", (ev) => {
    if (!editing()) return;
    const grp = (flow.groups || []).find((x) => x.id === ev.target.data("gid")); if (!grp) return;
    beginChange();
    grpDrag = { gid: grp.id, start: { ...ev.target.position() },
      mem: (grp.members || []).map((id) => cy.getElementById(id)).filter((el) => el.nonempty())
             .map((el) => ({ id: el.id(), x: el.position().x, y: el.position().y })) };
  });
  cy.on("drag", "node.groupbox", (ev) => {
    if (!grpDrag) return;
    const p = ev.target.position(), dx = p.x - grpDrag.start.x, dy = p.y - grpDrag.start.y;
    grpDrag.mem.forEach((m) => { const el = cy.getElementById(m.id); if (el.nonempty()) el.position({ x: m.x + dx, y: m.y + dy }); });
  });
  cy.on("dragfree", "node.groupbox", (ev) => {
    if (!grpDrag) return;
    const p = ev.target.position(), dx = p.x - grpDrag.start.x, dy = p.y - grpDrag.start.y;
    grpDrag.mem.forEach((m) => { const n = flow.nodes.find((x) => x.id === m.id), el = cy.getElementById(m.id); if (n && el.nonempty()) { const q = el.position(); n.x = q.x; n.y = q.y; } });
    const g = (flow.groups || []).find((x) => x.id === grpDrag.gid); if (g && g.x != null) { g.x += dx; g.y += dy; }
    grpDrag = null; markDirty(); renderGroups(); renderNoteBadges();
  });

  // kéo TAY CẦM 4 góc → resize khung tự do
  let grh = null;
  const rectFromHandle = (base, corner, p) => {
    const r = { ...base };
    if (corner.includes("w")) r.x1 = p.x; else r.x2 = p.x;
    if (corner.includes("n")) r.y1 = p.y; else r.y2 = p.y;
    return r;
  };
  cy.on("grab", "node.grhandle", (ev) => { const g = (flow.groups || []).find((x) => x.id === ev.target.data("gid")); if (g) grh = { gid: g.id, corner: ev.target.data("corner"), r0: groupRect(g) }; });
  cy.on("drag", "node.grhandle", (ev) => {
    if (!grh) return;
    const r = rectFromHandle(grh.r0, grh.corner, ev.target.position());
    const gb = cy.getElementById("__g_" + grh.gid); if (gb.empty()) return;
    const x1 = Math.min(r.x1, r.x2), y1 = Math.min(r.y1, r.y2), x2 = Math.max(r.x1, r.x2), y2 = Math.max(r.y1, r.y2);
    gb.data("w", x2 - x1); gb.data("h", y2 - y1); gb.position({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 });
  });
  cy.on("dragfree", "node.grhandle", (ev) => {
    if (!grh) return;
    const r = rectFromHandle(grh.r0, grh.corner, ev.target.position());
    const g = (flow.groups || []).find((x) => x.id === grh.gid); grh = null; if (!g) return;
    beginChange(); setGroupRect(g, r); markDirty(); renderGroups();
  });
  bindArrowDraw();   // kéo vẽ mũi tên (node↔node hoặc vô danh) khi bật ✛ Kéo nối
  bindGroupDraw();   // kéo khoanh vùng tạo nhóm

  // draw.io: rê khối → tay cầm; kéo sang khối khác = nối; bấm (không trúng đâu) = mũi tên vô danh.
  cy.on("ehstart", () => { ehCompleted = false; });
  cy.on("ehcomplete", (_e, s, t, added) => {
    ehCompleted = true; try { added.remove(); } catch (_) {}
    beginChange();
    if (!flow.edges.some((x) => x.source === s.id() && x.target === t.id()))
      flow.edges.push({ source: s.id(), target: t.id(), label: "" });   // nối thật
    markDirty(); renderCanvas(false); reveal(curStepN());
  });
  cy.on("ehstop", (_e, s) => {
    if (ehCompleted) return;
    beginChange();
    const start = s.position(), p = clientToModel(lastClient);
    const far = Math.hypot(p.x - start.x, p.y - start.y) > 24;
    const end = far ? p : { x: start.x + 160, y: start.y };   // chỉ bấm → mũi tên mặc định sang phải
    (flow.arrows = flow.arrows || []).push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y, label: "" });
    markDirty(); renderCanvas(false); reveal(curStepN());
  });
  setupEdgehandles();

  maxStepN = flow.nodes.reduce((m, n) => Math.max(m, n.step || 0), 0);
  if (drawMode) applyDrawMode(true);   // giữ chế độ kéo-tự-do sau khi dựng lại
  applyResponsive();                   // mobile: tắt pan để cuộn trang được
  startFlowAnim();                     // mũi tên chạy
}
function applyResponsive() {
  if (!cy) return;
  const narrow = window.matchMedia("(max-width: 1100px)").matches;
  cy.userPanningEnabled(!narrow && !drawMode);
}

// ---------- mũi tên chạy theo chiều đi (marching ants) ----------
function flowTick() {
  flowRaf = requestAnimationFrame(flowTick);
  if (!flowOn || !cy) return;
  dashOff -= 0.7; if (dashOff < -100000) dashOff = 0;     // giảm offset → kiến bò từ nguồn → đích
  cy.edges().not(".tmp").style({ "line-style": "dashed", "line-dash-pattern": [7, 6], "line-dash-offset": dashOff });
}
function startFlowAnim() { if (flowRaf == null) flowTick(); }
function setFlow(on) {
  flowOn = on;
  const b = $("#btnFlow"); if (b) { b.classList.toggle("on", on); b.textContent = on ? "✦ Dừng chảy" : "✦ Mũi tên chảy"; }
  if (!on && cy) cy.edges().removeStyle("line-dash-offset").removeStyle("line-dash-pattern").removeStyle("line-style");
}

// bật tay cầm hover (edgehandles) khi ĐANG chỉnh sửa & KHÔNG ở chế độ kéo-tự-do
function setupEdgehandles() {
  if (!cy) return;
  if (eh) { try { eh.destroy(); } catch (_) {} eh = null; }
  if (window.cytoscapeEdgehandles && editing() && !drawMode) {
    eh = cy.edgehandles({ hoverDelay: 100, snap: true,
      handleNodes: 'node[type != "anchor"]',
      canConnect: (s, t) => s.id() !== t.id() && t.data("type") !== "anchor" });
  }
}
function clientToModel(c) {
  const r = $("#cy").getBoundingClientRect(), pan = cy.pan(), z = cy.zoom();
  return { x: (c.x - r.left - pan.x) / z, y: (c.y - r.top - pan.y) / z };
}

// thêm 1 mũi tên vô danh (2 anchor + cạnh) vào canvas tại toạ độ tuyệt đối
// vẽ khung nhóm: box tự tính từ bounding box của các khối thành viên
// khung của 1 nhóm: dùng hình học thủ công (g.x/y/w/h) nếu đã kéo resize, nếu chưa thì tự ôm members
function groupRect(g) {
  if (g.x != null && g.y != null && g.w != null && g.h != null) return { x1: g.x, y1: g.y, x2: g.x + g.w, y2: g.y + g.h };
  const mem = cy.collection();
  (g.members || []).forEach((id) => { const n = cy.getElementById(id); if (n && n.nonempty()) mem.merge(n); });
  if (mem.length === 0) return null;
  const bb = mem.boundingBox(), pad = g.pad != null ? g.pad : 26;
  return { x1: bb.x1 - pad, y1: bb.y1 - pad - 16, x2: bb.x2 + pad, y2: bb.y2 + pad };
}
function setGroupRect(g, r) {
  g.x = Math.min(r.x1, r.x2); g.y = Math.min(r.y1, r.y2);
  g.w = Math.abs(r.x2 - r.x1); g.h = Math.abs(r.y2 - r.y1);
}
function renderGroups() {
  if (!cy) return;
  cy.remove("node.groupbox"); cy.remove("node.grhandle");
  (flow.groups || []).forEach((g) => {
    const r = groupRect(g); if (!r) return;
    cy.add({ group: "nodes", classes: "groupbox", grabbable: editing(), pannable: false,
      data: { id: "__g_" + g.id, gid: g.id, label: g.label || "", gcolor: g.color || "#8a6fd0",
              w: r.x2 - r.x1, h: r.y2 - r.y1 },
      position: { x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2 } });
    if (editing() && g.id === editingGid) addGroupHandles(g, r);   // tay cầm 4 góc khi đang chọn nhóm
  });
}
function addGroupHandles(g, r) {
  [["nw", r.x1, r.y1], ["ne", r.x2, r.y1], ["sw", r.x1, r.y2], ["se", r.x2, r.y2]].forEach(([c, x, y]) =>
    cy.add({ group: "nodes", classes: "grhandle", grabbable: true, data: { id: "__gh_" + g.id + "_" + c, gid: g.id, corner: c }, position: { x, y } }));
}
// ---------- ghi chú riêng của khối (badge ! đỏ) ----------
// Vẽ lại các "phụ kiện" gắn khối: dấu ! ghi chú (góc phải) + nhãn trạng thái nổi Node.badge (phía trên).
function renderNoteBadges() {
  if (!cy) return;
  cy.remove("node.notebadge, node.statbadge");
  flow.nodes.forEach((n) => {
    if (!n.badge) return;
    const el = cy.getElementById(n.id); if (el.empty()) return;
    const bb = el.boundingBox({ includeLabels: false });
    cy.add({ group: "nodes", classes: "statbadge" + (el.hasClass("dim") ? " dim" : ""), grabbable: false, pannable: true,
      data: { id: "__sb_" + n.id, forid: n.id, label: n.badge }, position: { x: (bb.x1 + bb.x2) / 2, y: bb.y1 - 20 } });
  });
  flow.nodes.forEach((n) => {
    if (!n.notes || !n.notes.length) return;
    const el = cy.getElementById(n.id); if (el.empty()) return;
    const bb = el.boundingBox();
    cy.add({ group: "nodes", classes: "notebadge", grabbable: false, pannable: false,
      data: { id: "__nb_" + n.id, forid: n.id, label: n.notes.length > 1 ? String(n.notes.length) : "!" },
      position: { x: bb.x2 - 5, y: bb.y1 + 5 } });
  });
}
let noteBoxNode = null;   // khối đang mở ô ghi chú
function positionNoteBox() {
  if (!noteBoxNode || noteBoxNode.removed()) return;
  const bb = noteBoxNode.renderedBoundingBox(), box = $("#nodeNoteBox");
  box.style.left = Math.round(bb.x2 + 10) + "px"; box.style.top = Math.round(bb.y1) + "px";
}
function openNoteBox(node) {
  noteBoxNode = node;
  $("#nnInput").value = "";   // mỗi lần thêm 1 ghi chú mới (1 khối nhiều ghi chú)
  positionNoteBox(); $("#nodeNoteBox").classList.remove("hidden");
  setTimeout(() => $("#nnInput").focus(), 0);
}
function closeNoteBox() { noteBoxNode = null; $("#nodeNoteBox").classList.add("hidden"); }
function saveNoteBox() {
  if (!noteBoxNode) return;
  const n = nodeOf(noteBoxNode.id()); if (!n) return closeNoteBox();
  const v = $("#nnInput").value.trim();
  if (v) { beginChange(); n.notes = n.notes || []; n.notes.push({ t: v, done: false }); markDirty(); }
  closeNoteBox(); renderNoteBadges(); renderNotes();   // hiện luôn ở panel GHI CHÚ
}
$("#nnOk").addEventListener("click", saveNoteBox);
$("#nnCancel").addEventListener("click", closeNoteBox);
$("#nnInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveNoteBox(); } else if (e.key === "Escape") closeNoteBox(); });

function addFreeArrow(ar, i) {
  cy.add([
    { group: "nodes", data: { id: `__ar${i}_a`, type: "anchor", arr: i, end: "a" }, position: { x: ar.x1, y: ar.y1 }, classes: "anchor" },
    { group: "nodes", data: { id: `__ar${i}_b`, type: "anchor", arr: i, end: "b" }, position: { x: ar.x2, y: ar.y2 }, classes: "anchor" },
    { group: "edges", data: { id: `__ar${i}_e`, source: `__ar${i}_a`, target: `__ar${i}_b`, label: ar.label || "" }, classes: "freearrow" },
  ]);
}

// khối thật (không phải anchor/tmp) chứa toạ độ p
function nodeAtPos(p) {
  let hit = null;
  cy.nodes().forEach((n) => {
    if (n.hasClass("tmp") || n.hasClass("ehnd") || n.hasClass("grhandle") || n.hasClass("notebadge") || n.hasClass("statbadge") || n.hasClass("packet") || n.hasClass("groupbox") || n.data("type") === "anchor") return;
    const b = n.boundingBox();
    if (p.x >= b.x1 && p.x <= b.x2 && p.y >= b.y1 && p.y <= b.y2) hit = n;
  });
  return hit;
}

// kéo vẽ mũi tên: xem preview; thả trúng khối↔khối → liên kết; còn lại → mũi tên vô danh
let arrowDraw = null;
function bindArrowDraw() {
  cy.on("tapstart", (ev) => {
    if (!drawMode) return;
    const t = ev.target;
    const startNode = (t !== cy && t.isNode && t.isNode() && t.data("type") !== "anchor" && !t.hasClass("tmp")) ? t : null;
    const pos = startNode ? { ...startNode.position() } : { ...ev.position };
    arrowDraw = { pos, nodeId: startNode ? startNode.id() : null };
    cy.add([
      { group: "nodes", data: { id: "__ta" }, position: pos, classes: "tmp" },
      { group: "nodes", data: { id: "__tb" }, position: { ...pos }, classes: "tmp" },
      { group: "edges", data: { id: "__te", source: "__ta", target: "__tb" }, classes: "tmp freearrow" },
    ]);
  });
  cy.on("tapdrag", (ev) => { if (drawMode && arrowDraw) cy.getElementById("__tb").position(ev.position); });
  cy.on("tapend", (ev) => {
    if (!drawMode || !arrowDraw) return;
    const endPos = { ...ev.position }, endNode = nodeAtPos(endPos), s = arrowDraw;
    arrowDraw = null; cy.remove(".tmp");
    const moved = Math.hypot(endPos.x - s.pos.x, endPos.y - s.pos.y) > 6;
    if (!moved) { return; }   // chỉ click, không kéo → bỏ
    beginChange();
    if (s.nodeId && endNode && endNode.id() !== s.nodeId) {
      if (!flow.edges.some((x) => x.source === s.nodeId && x.target === endNode.id()))
        flow.edges.push({ source: s.nodeId, target: endNode.id(), label: "" });   // nối thật
    } else {
      (flow.arrows = flow.arrows || []).push({ x1: s.pos.x, y1: s.pos.y, x2: endPos.x, y2: endPos.y, label: "" });  // vô danh
    }
    markDirty(); renderCanvas(false); reveal(curStepN());
  });
}
// ---------- kéo khoanh vùng tạo nhóm (rubber-band) ----------
function enterGroupMode() {
  groupMode = true;
  cy.userPanningEnabled(false); cy.boxSelectionEnabled(false); cy.nodes().grabbable(false);
  $("#cy").style.cursor = "crosshair";
  toast("Giữ chuột trái kéo bao quanh các khối → thả tay để tạo nhóm");
}
function exitGroupMode() {
  groupMode = false;
  if (cy) { cy.nodes().grabbable(true); cy.boxSelectionEnabled(true); $("#cy").style.cursor = ""; }
  applyResponsive();
}
function showRubber(a, b) {
  const el = $("#groupRubber"); if (!el) return;
  el.style.left = Math.min(a.x, b.x) + "px"; el.style.top = Math.min(a.y, b.y) + "px";
  el.style.width = Math.abs(a.x - b.x) + "px"; el.style.height = Math.abs(a.y - b.y) + "px";
  el.classList.remove("hidden");
}
function hideRubber() { const el = $("#groupRubber"); if (el) el.classList.add("hidden"); }
let groupDraw = null;
function bindGroupDraw() {
  cy.on("tapstart", (ev) => {
    if (!groupMode || ev.target !== cy) return;
    groupDraw = { m0: { ...ev.position }, r0: { ...ev.renderedPosition } };
    showRubber(groupDraw.r0, groupDraw.r0);
  });
  cy.on("tapdrag", (ev) => { if (groupMode && groupDraw) showRubber(groupDraw.r0, ev.renderedPosition); });
  cy.on("tapend", async (ev) => {
    if (!groupMode || !groupDraw) return;
    const m0 = groupDraw.m0, m1 = { ...ev.position }; groupDraw = null; hideRubber(); exitGroupMode();
    const x1 = Math.min(m0.x, m1.x), x2 = Math.max(m0.x, m1.x), y1 = Math.min(m0.y, m1.y), y2 = Math.max(m0.y, m1.y);
    if (x2 - x1 < 10 && y2 - y1 < 10) return;                     // chỉ bấm, không kéo → bỏ
    const ids = flow.nodes.filter((n) => {
      const el = cy.getElementById(n.id); if (el.empty()) return false;
      const p = el.position(); return p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2;   // tâm khối nằm trong khung
    }).map((n) => n.id);
    if (!ids.length) { toast("Không có khối nào trong vùng đã khoanh"); return; }
    const name = await askPrompt("Tên nhóm:", "Nhóm"); if (name == null) return;
    beginChange();
    const gid = createGroup(name), g = flow.groups.find((x) => x.id === gid);
    ids.forEach((id) => { flow.groups.forEach((gg) => { if (gg.id !== gid) gg.members = (gg.members || []).filter((m) => m !== id); }); g.members.push(id); });
    setGroupRect(g, { x1, y1: y1 - 16, x2, y2 });   // khung = đúng vùng đã khoanh (chừa chỗ cho tên)
    markDirty(); renderGroups(); fillNodeGroupSel();
    openGroupEditor(gid);                 // mở luôn bảng sửa khung (đổi tên/màu/cỡ, kéo khung)
    toast(`Đã tạo nhóm "${name}" — chỉnh ở bảng bên phải, hoặc kéo khung để di chuyển`);
  });
}
function applyDrawMode(on) {
  if (!cy) return;
  cy.userPanningEnabled(!on); cy.boxSelectionEnabled(!on); cy.autoungrabify(on && false);
  // autoungrabify tắt grab khối: để kéo-vẽ từ khối được, ta tự chặn grab trong tapstart thay vì ungrabify toàn bộ
  cy.nodes().grabbable(!on);
  if (cy.$("node.anchor")) cy.$("node.anchor").grabbable(true);  // anchor vẫn kéo được để chỉnh mũi tên
}

