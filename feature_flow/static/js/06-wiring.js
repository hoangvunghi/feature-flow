// ---------- wiring ----------
// Quyền sửa: app nhúng trả api/me; chạy riêng thì không có endpoint (404) → giữ nguyên quyền sửa.
fetch("api/me").then((r) => (r.ok ? r.json() : null)).then((me) => {
  if (!me || me.can_edit !== false) return;
  READONLY = true;
  document.body.classList.add("ff-readonly");
  if ($("#editMode").checked) { $("#editMode").checked = false; $("#editMode").dispatchEvent(new Event("change")); }
  document.querySelectorAll(".note-text").forEach((el) => { el.contentEditable = "false"; });
}).catch(() => {});
// 8 sắc độ giao diện (CSS: [data-theme=…] cuối style.css). Lưu theo trình duyệt.
const THEMES = [["", "🍃 Thanh Trà Trong Gió"], ["fincon", "🔷 Fincon"], ["net-co-dong-duong", "🏮 Nét Cổ Đông Dương"],
  ["hoang-hon-mua-thu", "🍂 Hoàng Hôn Mùa Thu"], ["phim-co-dien", "🎞 Phim Cổ Điển"], ["cuoi-he-dau-thu", "🌿 Cuối Hè Đầu Thu"],
  ["xanh-co-dien", "💧 Xanh Cổ Điển"], ["dao-pho-ngay-nang", "☀️ Dạo Phố Ngày Nắng"], ["pho-phap", "🥐 Đường Phố Pháp"]];
(() => {
  const sel = $("#themePick"), cur = document.documentElement.dataset.theme || "";
  THEMES.forEach(([v, label]) => { const o = document.createElement("option"); o.value = v; o.textContent = label; sel.appendChild(o); });
  sel.value = THEMES.some(([v]) => v === cur) ? cur : "";
  sel.addEventListener("change", () => {
    if (sel.value) document.documentElement.dataset.theme = sel.value; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem("ff-theme", sel.value); } catch (e) { /* chế độ riêng tư: chỉ đổi phiên này */ }
    if (cy) cy.style(stylesheet());   // sơ đồ (canvas) đọc lại màu theo sắc độ mới
  });
})();
$("#btnNext").addEventListener("click", () => goIdx(idx + 1));
$("#btnPrev").addEventListener("click", () => goIdx(idx - 1));
$("#btnReplay").addEventListener("click", () => goIdx(0));
$("#btnPresent").addEventListener("click", () => { if (presenting) showFull(); else startPresent(); });
$("#popClose").addEventListener("click", () => {
  clearSel(); unfocus();
  if (viewingNode) { viewingNode = false; if (presenting && steps.length) { reveal(steps[idx].n); paintStep(); } else showFull(); }
});
$("#btnPlay").addEventListener("click", () => {
  if (playTimer) { clearInterval(playTimer); playTimer = null; return; }
  if (idx >= steps.length - 1) goIdx(0);
  playTimer = setInterval(() => { if (idx >= steps.length - 1) { clearInterval(playTimer); playTimer = null; return; } goIdx(idx + 1); }, 1100);
});
$("#editMode").addEventListener("change", (e) => {
  const on = e.target.checked;
  $("#panel-edit").classList.toggle("hidden", !on);
  $("#panel-read").classList.toggle("hidden", on);
  $("#btnDraw").classList.toggle("hidden", !on);
  if (on) { fillFlowMeta(); fillStepEditor(); }
  else { viewingNode = false; paintStep(); hideEditors(); setDraw(false); }
  setupEdgehandles();   // bật/tắt tay cầm hover theo chế độ chỉnh sửa
  if (cy) renderGroups();   // khung nhóm: cho kéo được khi bật chỉnh sửa
  applyKind();          // tài liệu: hiện ô soạn / render lại
});
// zoom
function zoomBy(f) { if (!cy) return; cy.zoom({ level: cy.zoom() * f, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }); }
$("#btnZoomIn").addEventListener("click", () => zoomBy(1.2));
$("#btnZoomOut").addEventListener("click", () => zoomBy(1 / 1.2));
$("#btnFit").addEventListener("click", () => cy && cy.fit(undefined, 30));
$("#btnFlow").addEventListener("click", () => setFlow(!flowOn));
// Format: xoá vị trí tay → auto-layout dagre xếp lại gọn, hết chồng chéo
$("#btnFormat").addEventListener("click", () => {
  beginChange();
  flow.nodes.forEach((n) => { n.x = null; n.y = null; });
  markDirty(); renderCanvas(true); reveal(curStepN());
  toast("Đã sắp xếp lại");
});
// phóng to toàn màn hình (overlay)
function setMax(on) {
  unfocus();   // thoát focus khi đổi chế độ (ẩn thẻ nổi, bỏ mờ)
  $(".canvas-wrap").classList.toggle("maximized", on);
  $("#btnMax").textContent = on ? "⤡ Thu nhỏ" : "⛶ Phóng to";
  setTimeout(() => { if (cy) { cy.resize(); cy.fit(undefined, 30); } }, 60);
}
$("#btnMax").addEventListener("click", () => setMax(!$(".canvas-wrap").classList.contains("maximized")));
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $(".canvas-wrap").classList.contains("maximized")) setMax(false); });
// kéo-nối (draw mode)
function setDraw(on) {
  drawMode = on;
  $("#btnDraw").classList.toggle("on", on);
  $("#btnDraw").textContent = on ? "✓ Đang vẽ mũi tên — bấm để tắt" : "✛ Kéo nối";
  applyDrawMode(on);
  setupEdgehandles();   // kéo-tự-do bật → tắt hover handle; tắt → bật lại
}
$("#btnDraw").addEventListener("click", () => setDraw(!drawMode));
document.querySelectorAll("#panel-edit [data-add]").forEach((b) => b.addEventListener("click", () => addNode(b.dataset.add)));
$("#btnLink").addEventListener("click", startLink);
$("#btnDelete").addEventListener("click", deleteSel);
$("#btnSave").addEventListener("click", save);
$("#btnShare").addEventListener("click", shareFlow);
$("#btnNewFlow").addEventListener("click", newItem);
$("#btnShowHidden").addEventListener("click", () => { showHidden = !showHidden; renderFlowTree(); });
$("#btnGuide").addEventListener("click", () => {
  const g = flowsCache.find((f) => f.id === "huong-dan-flow")
         || flowsCache.find((f) => f.kind === "doc" && (f.group || "") === GUIDE_GROUP);
  if (!g) return toast("Chưa có trang hướng dẫn", true);
  guideMode = true; renderFlowTree();   // mở TRANG HƯỚNG DẪN riêng (clear danh sách luồng)
  loadFlow(g.id);
});
function exitGuide() { guideMode = false; renderFlowTree(); if (flowsCache.find((f) => (f.group || "") !== GUIDE_GROUP)) loadFlow(flowsCache.find((f) => (f.group || "") !== GUIDE_GROUP).id); }
$("#btnGuideBack").addEventListener("click", exitGuide);
// bấm logo "Feature Flow" → về home (thoát trang hướng dẫn, đóng hết folder)
$(".brand")?.addEventListener("click", () => { expanded.clear(); exitGuide(); });
// deep-link: đổi URL #/<id> → nhảy thẳng vào luồng đó
window.addEventListener("hashchange", () => {
  if (suppressHash) { suppressHash = false; return; }
  const id = hashId();
  if (id && (!flow || flow.id !== id) && flowsCache.some((f) => f.id === id)) loadFlow(id);
});
// xuất / nhập Markdown
$("#btnExportMd").addEventListener("click", async () => {
  if (!flow.id) return;
  const { markdown } = await (await fetch(`api/flows/${flow.id}/markdown`)).json();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
  a.download = `${flow.id}.md`; a.click(); URL.revokeObjectURL(a.href);
  toast("Đã xuất " + flow.id + ".md");
});
$("#btnImportMd").addEventListener("click", () => $("#mdFile").click());
$("#mdFile").addEventListener("change", async (ev) => {
  const file = ev.target.files[0]; if (!file) return;
  const text = await file.text();
  const id = await askPrompt("ID luồng nhập vào:", file.name.replace(/\.(md|markdown)$/i, "") || "import");
  ev.target.value = ""; if (!id) return;
  const r = await fetch("api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, markdown: text }) });
  if (!r.ok) return toast("Nhập lỗi: " + (await r.text()), true);
  await loadFlowList();
  const li = [...document.querySelectorAll(".flow-list li")].find((x) => x.dataset.id === id);
  if (li) { document.querySelectorAll(".flow-list li").forEach((x) => x.classList.remove("active")); li.classList.add("active"); }
  loadFlow(id); toast("Đã nhập " + id);
});
const inTyping = () => { const a = document.activeElement; return !!a && (/INPUT|TEXTAREA/.test(a.tagName) || a.isContentEditable); };
document.addEventListener("keydown", (e) => {
  if (inTyping()) return;
  if (e.key === "ArrowRight") goIdx(idx + 1);
  else if (e.key === "ArrowLeft") goIdx(idx - 1);
  else if (e.key.toLowerCase() === "r") goIdx(0);
  else if (e.key === " ") { e.preventDefault(); $("#btnPlay").click(); }
});
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
window.addEventListener("resize", applyResponsive);
$("#cy").addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("click", hideCtx);
window.addEventListener("blur", hideCtx);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { hideCtx(); if (groupMode) { hideRubber(); groupDraw = null; exitGroupMode(); } } });
document.addEventListener("keydown", (e) => {
  const inField = inTyping();
  const z = e.key.toLowerCase() === "z", y = e.key.toLowerCase() === "y";
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (!$("#btnSave").disabled) save(); }
  else if ((e.ctrlKey || e.metaKey) && z && !e.shiftKey) { if (inField) return; e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && (y || (z && e.shiftKey))) { if (inField) return; e.preventDefault(); redo(); }
});

loadFlowList();
