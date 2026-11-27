function renderAll() {
  $("#flowTitle").textContent = flow.title || flow.id;
  $("#flowSub").textContent = flow.subtitle || "";
  // chips
  const c = $("#chips"); c.innerHTML = "";
  if (flow.duration) c.insertAdjacentHTML("beforeend", `<span class="chip amber">⏱ ${esc(flow.duration)}</span>`);
  if (flow.level) c.insertAdjacentHTML("beforeend", `<span class="chip green">📊 ${esc(flow.level)}</span>`);
  steps = [...(flow.steps || [])].sort((a, b) => a.n - b.n);
  maxStepN = flow.nodes.reduce((m, n) => Math.max(m, n.step || 0), 0);   // cập nhật TRƯỚC khi vẽ chip (tránh dính số luồng cũ)
  c.insertAdjacentHTML("beforeend", `<span class="chip purple">☰ ${steps.length || maxStepN} bước</span>`);
  renderNotes();   // ghi chú dạng checklist (lưu theo luồng)
  renderCanvas(true);
  renderTracker();
  idx = 0;
  showFull();   // mặc định hiện full, chưa trình chiếu
  applyKind();  // sơ đồ hay tài liệu
}

// chuyển UI giữa SƠ ĐỒ (flow) và TÀI LIỆU (doc)
function applyKind() {
  const isDoc = flow.kind === "doc";
  $(".canvas-wrap").classList.toggle("hidden", isDoc);
  $(".tracker").classList.toggle("hidden", isDoc);
  $("#doc-wrap").classList.toggle("hidden", !isDoc);
  const stepCard = document.querySelector("#panel-read .r-card");   // thẻ "bước" — ẩn khi là tài liệu
  if (stepCard) stepCard.classList.toggle("hidden", isDoc);
  document.querySelector("#panel-read .learn").classList.toggle("hidden", isDoc);   // "bạn sẽ học" chỉ cho sơ đồ
  $("#doc-toc-card").classList.toggle("hidden", !isDoc);            // mục lục chỉ cho tài liệu
  const chip = document.querySelector("#chips .chip.purple");
  if (chip) chip.classList.toggle("hidden", isDoc);
  if (isDoc) renderDoc();
}
// markdown → HTML ĐÃ LỌC (chặn <script>, onerror=…). Thiếu marked/DOMPurify (CDN lỗi) → hiện chữ thô, không render HTML.
function mdHtml(md) {
  return window.marked && window.DOMPurify ? DOMPurify.sanitize(marked.parse(md)) : esc(md);
}
function renderDoc() {
  const md = flow.doc_md || "";
  const view = $("#doc-view");
  view.innerHTML = mdHtml(md);
  const ed = editing();
  $("#doc-editor").classList.toggle("hidden", !ed);
  view.classList.toggle("hidden", ed);
  // trình soạn kiểu Word: nạp HTML từ markdown; chỉ nạp khi KHÔNG đang gõ (tránh nhảy con trỏ)
  const rich = $("#doc-rich");
  if (ed && document.activeElement !== rich) { rich.innerHTML = mdHtml(md); ensureRichTail(); }
  buildToc(view);
}
// Turndown: biên dịch HTML (những gì gõ) → Markdown để lưu
let _td = null;
function td() {
  if (!_td && window.TurndownService) {
    _td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "*" });
    if (window.turndownPluginGfm) _td.use(window.turndownPluginGfm.gfm);   // bảng, gạch ngang… → markdown
    // bảng CÓ tiêu đề (caption) → GIỮ NGUYÊN HTML (addRule ưu tiên hơn rule bảng của gfm)
    _td.addRule("captionTable", {
      filter: (node) => node.nodeName === "TABLE" && !!node.querySelector("caption") && node.querySelector("caption").textContent.trim() !== "",
      replacement: (_c, node) => "\n\n" + node.outerHTML + "\n\n",
    });
  }
  return _td;
}
function docRichToMd() {
  const rich = $("#doc-rich"), t = td();
  rich.querySelectorAll(".cell-sel").forEach((c) => { c.classList.remove("cell-sel"); if (!c.className) c.removeAttribute("class"); });   // không lưu class highlight
  flow.doc_md = t ? t.turndown(rich.innerHTML) : rich.innerText;
}
// toolbar: định dạng bằng execCommand (contenteditable)
// đảm bảo luôn có 1 dòng trống ở CUỐI nếu phần tử cuối là khối "bẫy" (code/quote/list) → có chỗ click thoát ra
// lưu/khôi phục con trỏ trong ô soạn (modal làm mất selection)
function saveRichRange() { const r = $("#doc-rich"), s = window.getSelection(); return (s && s.rangeCount && r.contains(s.anchorNode)) ? s.getRangeAt(0).cloneRange() : null; }
function restoreRichRange(rg) { $("#doc-rich").focus(); if (rg) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(rg); } }
async function insertTable() {
  const rg = saveRichRange();
  const v = await askForm("Tạo bảng", [
    { key: "title", label: "Tiêu đề bảng (để trống nếu không)", value: "" },
    { key: "cols", label: "Số cột", value: "3", type: "number" },
    { key: "rows", label: "Số dòng (không tính tiêu đề)", value: "2", type: "number" },
  ]); if (v == null) return;
  const title = v.title || "";
  const cols = Math.max(1, Math.min(8, parseInt(v.cols, 10) || 0));
  const rows = Math.max(1, Math.min(30, parseInt(v.rows, 10) || 0));
  if (!cols || !rows) return;
  const rich = $("#doc-rich");
  const table = document.createElement("table");
  if (title.trim()) { const cap = document.createElement("caption"); cap.textContent = title.trim(); table.appendChild(cap); }
  const thead = document.createElement("thead"), htr = document.createElement("tr");
  for (let c = 0; c < cols; c++) htr.appendChild(document.createElement("th"));   // tiêu đề để TRỐNG cho người dùng tự nhập
  thead.appendChild(htr); table.appendChild(thead);
  const tbody = document.createElement("tbody");
  for (let r = 0; r < rows; r++) { const tr = document.createElement("tr"); for (let c = 0; c < cols; c++) tr.appendChild(document.createElement("td")); tbody.appendChild(tr); }
  table.appendChild(tbody);
  restoreRichRange(rg);
  if (rg) rg.insertNode(table); else rich.appendChild(table);
  // tách bảng khỏi khối liền trước/sau (tránh 2 bảng DÍNH nhau trong markdown)
  const spacer = () => { const p = document.createElement("p"); p.appendChild(document.createElement("br")); return p; };
  if (table.previousElementSibling && table.previousElementSibling.tagName === "TABLE") table.parentNode.insertBefore(spacer(), table);
  if (!table.nextElementSibling || table.nextElementSibling.tagName === "TABLE") table.parentNode.insertBefore(spacer(), table.nextSibling);
  ensureRichTail();
  const first = table.querySelector("th"); const rr = document.createRange(); rr.selectNodeContents(first);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rr); rich.focus();
  beginChange(true); docRichToMd(); markDirty();
}
async function insertLink() {
  const rg = saveRichRange();
  const u = await askPrompt("Dán link (URL):", "https://"); if (!u) return;
  restoreRichRange(rg);
  document.execCommand("createLink", false, u);
  beginChange(true); docRichToMd(); markDirty();
}
function ensureRichTail() {
  const rich = $("#doc-rich"); const last = rich.lastElementChild;
  if (last && /^(PRE|BLOCKQUOTE|UL|OL|TABLE)$/.test(last.tagName)) {
    const p = document.createElement("p"); p.appendChild(document.createElement("br")); rich.appendChild(p);
  }
}
function insertCodeBlock() {
  const rich = $("#doc-rich"), sel = window.getSelection();
  const text = (sel && sel.toString()) || "";
  const pre = document.createElement("pre"); const code = document.createElement("code");
  if (text) code.textContent = text; else code.appendChild(document.createElement("br"));   // rỗng: để chỗ cho con trỏ
  pre.appendChild(code);
  if (sel && sel.rangeCount) { const r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(pre); }
  else rich.appendChild(pre);
  ensureRichTail();   // luôn có dòng trống phía dưới để thoát ra
  // con trỏ nằm sẵn trong khối code (đầu dòng) để gõ luôn
  const r = document.createRange(); r.selectNodeContents(code); r.collapse(true);
  sel.removeAllRanges(); sel.addRange(r); rich.focus();
}
function docCmd(cmd) {
  const rich = $("#doc-rich"); rich.focus();
  if (cmd === "table") { insertTable(); return; }   // async, tự lưu
  if (cmd === "link") { insertLink(); return; }
  const block = (tag) => document.execCommand("formatBlock", false, "<" + tag + ">");
  if (cmd === "h1") block("h1"); else if (cmd === "h2") block("h2"); else if (cmd === "h3") block("h3");
  else if (cmd === "p") block("p"); else if (cmd === "quote") block("blockquote"); else if (cmd === "code") insertCodeBlock();
  else if (cmd === "bold") document.execCommand("bold");
  else if (cmd === "italic") document.execCommand("italic");
  else if (cmd === "ul") document.execCommand("insertUnorderedList");
  else if (cmd === "ol") document.execCommand("insertOrderedList");
  beginChange(true); docRichToMd(); markDirty();
}
// Enter trong khối code → xuống dòng (không thoát ra); Enter thường giữ nguyên
$("#doc-rich").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey) return;
  const n = window.getSelection().anchorNode;
  if (n && n.parentElement && n.parentElement.closest("pre")) { e.preventDefault(); document.execCommand("insertText", false, "\n"); }
});
// ---------- thao tác bảng (Tab nhảy ô, chuột phải thêm/xóa hàng-cột) ----------
function curCell() { const n = window.getSelection().anchorNode; if (!n) return null; const el = n.nodeType === 1 ? n : n.parentElement; return el ? el.closest("td,th") : null; }
function cells(tbl) { return [...tbl.querySelectorAll("th,td")]; }
function placeCaret(cell) { const r = document.createRange(); r.selectNodeContents(cell); r.collapse(true); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
function colIdx(cell) { return [...cell.parentElement.children].indexOf(cell); }
function tblRows(tbl) { return [...tbl.querySelectorAll("tr")]; }
function addRow(cell, below) { const tr = cell.parentElement, cols = tr.children.length, nt = document.createElement("tr"); for (let i = 0; i < cols; i++) nt.appendChild(document.createElement("td")); below ? tr.after(nt) : tr.before(nt); return nt; }
function addCol(cell, right) { const tbl = cell.closest("table"), ci = colIdx(cell); tblRows(tbl).forEach((tr) => { const head = !!tr.closest("thead"); const c = document.createElement(head ? "th" : "td"); const ref = tr.children[ci]; right ? ref.after(c) : ref.before(c); }); }
function delRow(cell) { const tbl = cell.closest("table"); if (tblRows(tbl).length <= 1) return; cell.parentElement.remove(); }
function delCol(cell) { const tbl = cell.closest("table"), ci = colIdx(cell); if (tbl.querySelector("tr").children.length <= 1) return; tblRows(tbl).forEach((tr) => tr.children[ci] && tr.children[ci].remove()); }
const afterTblEdit = () => { beginChange(); docRichToMd(); markDirty(); };
$("#doc-rich").addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const cell = curCell(); if (!cell) return;
  e.preventDefault();
  const list = cells(cell.closest("table")), i = list.indexOf(cell);
  const nx = e.shiftKey ? list[i - 1] : list[i + 1];
  if (nx) placeCaret(nx);
  else if (!e.shiftKey) { const nt = addRow(list[i], true); placeCaret(nt.firstElementChild); afterTblEdit(); }   // Tab ở ô cuối → thêm hàng
});
// các ô đang được bôi đen (giao với vùng chọn)
function selectedCells() {
  const sel = window.getSelection(); if (!sel.rangeCount) return [];
  const rng = sel.getRangeAt(0); const out = [];
  $("#doc-rich").querySelectorAll("td,th").forEach((c) => { try { if (rng.intersectsNode(c)) out.push(c); } catch (_) {} });
  return out;
}
// tô xanh khi bôi NHIỀU ô (1 ô thì để bình thường)
document.addEventListener("selectionchange", () => {
  const rich = $("#doc-rich"); if (!rich || rich.offsetParent === null) return;
  rich.querySelectorAll(".cell-sel").forEach((c) => { c.classList.remove("cell-sel"); if (!c.className) c.removeAttribute("class"); });
  const cs = selectedCells();
  if (cs.length > 1) cs.forEach((c) => c.classList.add("cell-sel"));
});
$("#doc-rich").addEventListener("contextmenu", (e) => {
  const cell = e.target.closest && e.target.closest("td,th"); if (!cell) return;
  e.preventDefault(); e.stopPropagation();
  const cs = selectedCells(); const rows = new Set(cs.map((c) => c.parentElement)); const colsSet = new Set(cs.map((c) => colIdx(c)));
  const items = [
    { label: "➕ Thêm hàng trên", act: () => { addRow(cell, false); afterTblEdit(); } },
    { label: "➕ Thêm hàng dưới", act: () => { addRow(cell, true); afterTblEdit(); } },
    { label: "➕ Thêm cột trái", act: () => { addCol(cell, false); afterTblEdit(); } },
    { label: "➕ Thêm cột phải", act: () => { addCol(cell, true); afterTblEdit(); } },
    { sep: true },
  ];
  if (rows.size > 1) items.push({ label: `🗑 Xóa ${rows.size} hàng đã chọn`, danger: true, act: () => { [...rows].forEach((tr) => delRow(tr.firstElementChild)); afterTblEdit(); } });
  else items.push({ label: "🗑 Xóa hàng này", danger: true, act: () => { delRow(cell); afterTblEdit(); } });
  if (colsSet.size > 1) items.push({ label: `🗑 Xóa ${colsSet.size} cột đã chọn`, danger: true, act: () => { const tbl = cell.closest("table"); [...colsSet].sort((a, b) => b - a).forEach((ci) => tblRows(tbl).forEach((tr) => tr.children[ci] && tr.children[ci].remove())); afterTblEdit(); } });
  else items.push({ label: "🗑 Xóa cột này", danger: true, act: () => { delCol(cell); afterTblEdit(); } });
  showCtx(items, e.clientX, e.clientY);
});
// mục lục: lấy h1/h2/h3, gắn id, bấm → cuộn tới
function buildToc(view) {
  const toc = $("#doc-toc"); toc.innerHTML = "";
  const hs = view.querySelectorAll("h1, h2, h3");
  hs.forEach((h, i) => {
    const id = "h-" + i; h.id = id;
    const li = document.createElement("li");
    li.className = "toc-" + h.tagName.toLowerCase();
    li.textContent = h.textContent;
    li.addEventListener("click", () => {
      h.scrollIntoView({ behavior: "smooth", block: "start" });
      toc.querySelectorAll("li").forEach((x) => x.classList.remove("on"));
      li.classList.add("on");
    });
    toc.appendChild(li);
  });
  $("#doc-toc-card").classList.toggle("hidden", flow.kind !== "doc" || hs.length === 0);
}
// ---------- ghi chú (checklist tick được) ----------
function noteItemEl(it, onDel, onEnter) {
  const li = document.createElement("li"); li.className = "note-item" + (it.done ? " done" : "");
  const box = document.createElement("span"); box.className = "note-box"; box.textContent = it.done ? "☑" : "☐";
  box.addEventListener("click", () => { if (READONLY) return; beginChange(); it.done = !it.done; markDirty(); renderNotes(); });
  const txt = document.createElement("span"); txt.className = "note-text"; txt.contentEditable = READONLY ? "false" : "true"; txt.textContent = it.t || "";
  txt.addEventListener("input", () => { beginChange(true); it.t = txt.textContent; markDirty(); });
  txt.addEventListener("keydown", (e) => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } });
  const del = document.createElement("span"); del.className = "note-del"; del.textContent = "✕"; del.title = "Xóa";
  del.addEventListener("click", () => { beginChange(); onDel(); markDirty(); renderNotes(); if (typeof renderNoteBadges === "function") renderNoteBadges(); });
  li.append(box, txt, del); return li;
}
let noteFilter = null;   // id khối đang lọc ghi chú (null = xem tất cả)
function renderNotes() {
  const L = $("#noteList"); if (!L) return; L.innerHTML = "";
  if (noteFilter) {   // chỉ hiện ghi chú của khối đang chọn
    const n = (flow.nodes || []).find((x) => x.id === noteFilter);
    const head = document.createElement("li"); head.className = "note-filter";
    head.innerHTML = `<span>📍 ${esc((n && (n.label || n.type)) || "khối")}</span><span class="nf-clear" title="Bỏ lọc">✕ bỏ lọc</span>`;
    head.querySelector(".nf-clear").addEventListener("click", () => { noteFilter = null; renderNotes(); });
    L.appendChild(head);
    if (n && n.notes && n.notes.length) n.notes.forEach((it, i) => L.appendChild(noteItemEl(it, () => n.notes.splice(i, 1), () => addNote())));
    else { const em = document.createElement("li"); em.className = "note-empty"; em.textContent = "(khối này chưa có ghi chú — bấm + Thêm)"; L.appendChild(em); }
    return;
  }
  (flow.notes || []).forEach((it, i) => L.appendChild(noteItemEl(it, () => flow.notes.splice(i, 1), () => addNote(i + 1))));
  // ghi chú của từng khối (gộp vào panel, nhóm theo khối)
  (flow.nodes || []).forEach((n) => {
    if (!n.notes || !n.notes.length) return;
    const h = document.createElement("li"); h.className = "note-group"; h.textContent = "📍 " + (n.label || n.type);
    h.style.cursor = "pointer"; h.title = "Lọc theo khối này";
    h.addEventListener("click", () => { noteFilter = n.id; renderNotes(); });
    L.appendChild(h);
    n.notes.forEach((it, i) => L.appendChild(noteItemEl(it, () => n.notes.splice(i, 1))));
  });
}
function addNote(at) {
  beginChange();
  if (noteFilter) {   // đang lọc theo khối → thêm vào ghi chú của khối đó
    const n = (flow.nodes || []).find((x) => x.id === noteFilter); if (!n) return;
    n.notes = n.notes || []; n.notes.push({ t: "", done: false }); markDirty(); renderNotes();
    if (typeof renderNoteBadges === "function") renderNoteBadges();
    setTimeout(() => { const els = $("#noteList").querySelectorAll(".note-text"); const el = els[els.length - 1]; if (el) el.focus(); }, 0);
    return;
  }
  flow.notes = flow.notes || [];
  const idx = at == null ? flow.notes.length : at;
  flow.notes.splice(idx, 0, { t: "", done: false }); markDirty(); renderNotes();
  setTimeout(() => { const els = $("#noteList").querySelectorAll(".note-text"); const el = els[idx]; if (el) el.focus(); }, 0);
}
$("#btnAddNote").addEventListener("click", () => addNote());
$("#doc-rich").addEventListener("input", () => { beginChange(true); docRichToMd(); markDirty(); });
$("#docToolbar").addEventListener("click", (e) => { const b = e.target.closest("button[data-cmd]"); if (b) { e.preventDefault(); docCmd(b.dataset.cmd); } });

function renderTracker() {
  const t = $("#trackerSteps"); t.innerHTML = "";
  $("#trackerCount").textContent = steps.length ? `Bước ${presenting ? idx + 1 : steps.length} / ${steps.length}` : "";
  steps.forEach((s, i) => {   // LUÔN hiện đủ các bước, chỉ tô bước hiện tại
    const el = document.createElement("div");
    el.className = "tstep" + (presenting && i === idx ? " active" : (presenting && i < idx ? " done" : ""));
    el.dataset.i = i;
    el.innerHTML = `<div class="dot">${i + 1}</div><div class="tlabel">${esc(s.title || "Bước " + (i + 1))}</div>`;
    el.addEventListener("click", () => { if (presenting && idx === i) showFull(); else goIdx(i); });
    t.appendChild(el);
  });
}

// ---------- step navigation ----------
function goIdx(i) {
  if (!steps.length) { presenting = true; reveal(maxStepN); return; }
  presenting = true;
  $("#btnPresent") && ($("#btnPresent").textContent = "■ Thoát", $("#btnPresent").classList.add("on"));
  idx = Math.max(0, Math.min(i, steps.length - 1));
  viewingNode = false;
  reveal(steps[idx].n);
  paintStep();
  // tracker state
  renderTracker();   // hiện đủ bước, tô bước hiện tại
  if (editing()) fillStepEditor();
}

function reveal(stepN) {
  if (!cy) return;
  // KHÔNG trình chiếu → hiện FULL (không dim, không focus) — mặc định xem toàn luồng.
  if (!presenting) {
    cy.batch(() => { cy.nodes().removeClass("dim current"); cy.edges().removeClass("dim"); });
    return;
  }
  cy.batch(() => {
    cy.nodes().forEach((n) => {
      const own = n.data("forid");   // phụ kiện (nhãn nổi, dấu !) mờ/hiện theo khối của nó
      const ns = nodeOf(own || n.id()).step || 0;
      n.toggleClass("dim", ns > stepN);
      n.toggleClass("current", !own && ns === stepN && stepN > 0);
    });
    cy.edges().forEach((e) => {
      const vis = (nodeOf(e.data("source")).step || 0) <= stepN && (nodeOf(e.data("target")).step || 0) <= stepN;
      e.toggleClass("dim", !vis);
    });
  });
  sendPackets(stepN);
  // focus: zoom vào phần đã hiện (to + giữa) như designed-to-scale. Không auto-fit khi đang sửa.
  if (!editing()) {
    const vis = cy.nodes().filter((n) => !n.hasClass("dim"));
    const cur = cy.nodes(".current");
    const target = cur.length ? cur.closedNeighborhood().nodes().union(vis.slice(-4)) : vis;
    if (target.length) cy.animate({ fit: { eles: target, padding: 70 }, duration: 420, easing: "ease-in-out" });
  }
}

// Chấm chạy dọc các mũi tên DẪN VÀO khối của bước vừa hiện (dữ liệu đi từ đâu tới) — chỉ khi trình chiếu.
// Đi thẳng nguồn → đích (cạnh bezier gần thẳng), xong tự xoá; tắt "luồng chạy" (flowOn) thì không chạy.
function sendPackets(stepN) {
  if (!cy || !presenting || !flowOn || stepN <= 0) return;
  cy.remove("node.packet");
  cy.edges().not(".tmp, .freearrow").forEach((e) => {
    if ((nodeOf(e.data("target")).step || 0) !== stepN || (nodeOf(e.data("source")).step || 0) > stepN) return;
    const a = e.source().position(), b = e.target().position();
    const p = cy.add({ group: "nodes", classes: "packet", grabbable: false, data: { id: "__pk_" + e.id() }, position: { ...a } });
    p.animate({ position: { ...b } }, { duration: 900, easing: "ease-in-out-sine", complete: () => p.remove() });
  });
}

// mặc định: hiện full sơ đồ + panel giới thiệu (chưa trình chiếu)
function showFull() {
  presenting = false; idx = 0;
  if (noteFilter) { noteFilter = null; renderNotes(); }   // về tổng quan → bỏ lọc ghi chú
  $("#btnPresent") && ($("#btnPresent").textContent = "▶ Trình chiếu", $("#btnPresent").classList.remove("on"));
  reveal(0);
  if (cy && !editing()) setTimeout(() => cy.animate({ fit: { eles: cy.elements(), padding: 45 }, duration: 350 }), 30);
  renderTracker();   // tổng quan: hiện đủ các bước
  paintIntro();
}
function paintIntro() {
  $("#stepIdx").textContent = "TỔNG QUAN";
  $("#stepBadge").classList.add("hidden");
  $("#stepTitle").textContent = flow.title || "";
  $("#stepBody").textContent = (flow.subtitle ? flow.subtitle + "\n\n" : "") +
    "Bấm ▶ Trình chiếu (hoặc Tiếp →) để xem luồng chạy lần lượt từng bước.";
  $("#stepNote").classList.add("hidden");
  animatePanel();
}
function startPresent() {
  presenting = true;
  $("#btnPresent") && ($("#btnPresent").textContent = "■ Thoát", $("#btnPresent").classList.add("on"));
  goIdx(0);
}

function paintStep() {
  if (!steps.length) { $("#stepIdx").textContent = ""; $("#stepTitle").textContent = flow.title || ""; $("#stepBody").textContent = ""; $("#stepNote").classList.add("hidden"); return; }
  const s = steps[idx];
  $("#stepIdx").textContent = `BƯỚC ${idx + 1} / ${steps.length}`;
  const badge = $("#stepBadge");
  badge.classList.toggle("hidden", !s.badge); badge.textContent = s.badge || "";
  $("#stepTitle").textContent = s.title || "";
  $("#stepBody").textContent = s.body || "";
  const note = $("#stepNote");
  note.className = "callout" + (s.note_type === "warn" ? " warn" : "") + (s.note ? "" : " hidden");
  note.textContent = s.note || "";
  animatePanel();
}

// hiệu ứng fade-up cho nội dung panel mỗi lần đổi bước
function animatePanel() {
  const el = $("#panel-read");
  el.classList.remove("fade"); void el.offsetWidth; el.classList.add("fade");
}

// click khối trong read-mode → hiện giải thích của khối (tạm thay panel)
function onNodeTap(node) {
  if (drawMode || node.data("type") === "anchor" || node.hasClass("groupbox") || node.hasClass("grhandle") || node.hasClass("notebadge")) return;
  const n = nodeOf(node.id());
  // tô bước tương ứng ở thanh TRONG LUỒNG NÀY (chạy ở CẢ chế độ xem lẫn chỉnh sửa)
  const si = steps.findIndex((s) => s.n === n.step);
  document.querySelectorAll(".tstep").forEach((el, k) => el.classList.toggle("picked", k === si));
  noteFilter = node.id(); renderNotes();   // lọc panel GHI CHÚ theo khối vừa bấm
  if (editing()) { selectEl(node); fillNodeEditor(n); return; }
  selectEl(node);
  viewingNode = true;
  // GIỮ NGUYÊN tỉ lệ zoom: không fit/zoom lại, chỉ chọn + hiện mô tả (tránh tự co nhỏ)
  if ($(".canvas-wrap").classList.contains("maximized")) showPop(n); else hidePop();
  // panel phải (khi không phóng to)
  $("#stepIdx").textContent = "KHỐI";
  $("#stepBadge").classList.remove("hidden"); $("#stepBadge").textContent = n.type.toUpperCase();
  $("#stepTitle").textContent = n.label || n.type;
  $("#stepBody").textContent = n.explain || "(chưa có giải thích — bật Chỉnh sửa để thêm)";
  $("#stepNote").classList.add("hidden");
  animatePanel();
}
// bấm KHUNG NHÓM lúc xem → hiện mô tả nhóm (giống bấm khối)
function onGroupTap(gid) {
  const g = (flow.groups || []).find((x) => x.id === gid); if (!g) return;
  const box = cy.getElementById("__g_" + gid); if (box.empty()) return;
  selectEl(box); viewingNode = true;
  cy.animate({ fit: { eles: box, padding: 80 }, duration: 420, easing: "ease-in-out" });
  if ($(".canvas-wrap").classList.contains("maximized")) showPop({ type: "nhóm", label: g.label, explain: g.explain }); else hidePop();
  $("#stepIdx").textContent = "NHÓM";
  $("#stepBadge").classList.remove("hidden"); $("#stepBadge").textContent = "NHÓM";
  $("#stepTitle").textContent = g.label || "Nhóm";
  $("#stepBody").textContent = g.explain || "(chưa có mô tả — bật Chỉnh sửa để thêm)";
  $("#stepNote").classList.add("hidden");
  animatePanel();
}
function showPop(n) {
  $("#popBadge").textContent = (n.type || "").toUpperCase();
  $("#popTitle").textContent = n.label || n.type;
  $("#popBody").textContent = n.explain || "(chưa có giải thích — bật Chỉnh sửa để thêm)";
  const pn = $("#popNotes"); pn.innerHTML = "";
  const list = n.notes || [];
  if (list.length) {
    const h = document.createElement("div"); h.className = "pop-notes-head"; h.textContent = "GHI CHÚ"; pn.appendChild(h);
    list.forEach((it) => { const d = document.createElement("div"); d.className = "pop-note" + (it.done ? " done" : ""); d.textContent = (it.done ? "☑ " : "☐ ") + (it.t || ""); pn.appendChild(d); });
  }
  $("#nodePop").classList.remove("hidden");
}
function hidePop() { $("#nodePop").classList.add("hidden"); }
function unfocus() { if (cy) cy.elements().removeClass("faded"); hidePop(); document.querySelectorAll(".tstep.picked").forEach((e) => e.classList.remove("picked")); }
