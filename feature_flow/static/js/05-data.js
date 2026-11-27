// ---------- lưu ----------
async function save() {
  flow.steps = steps;
  const put = () => fetch(`api/flows/${flow.id}`, { method: "PUT",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(flow) });
  let r = await put();
  // 409 = người khác đã lưu sau khi mình mở (flow._rev cũ). Ghi đè thì bản của họ vẫn còn trong 🕘 Lịch sử.
  if (r.status === 409) {
    if (!(await askConfirm("Luồng này đã có người khác sửa sau khi bạn mở. Ghi đè bằng bản của bạn? "
      + "(Bản của họ vẫn xem/khôi phục được trong 🕘 Lịch sử.)", "Ghi đè"))) return toast("Chưa lưu — tải lại luồng để xem bản mới", true);
    delete flow._rev; r = await put();
  }
  if (!r.ok) return toast("Lưu lỗi: " + (await r.text()), true);
  flow._rev = (await r.json())._rev;
  dirty = false; $("#btnSave").disabled = true; toast("Đã lưu ✓");
  flowsCache = await (await fetch("api/flows")).json(); renderFlowTree();   // cập nhật cây (tên/nhóm có thể đổi)
}

// ---------- helpers ----------
function nodeOf(id) { return flow.nodes.find((n) => n.id === id) || { step: 0 }; }
function markDirty() { if (READONLY) return; dirty = true; $("#btnSave").disabled = false; }
// escape cho CẢ nội dung lẫn thuộc tính ("…" / '…') — textContent→innerHTML không escape dấu nháy
function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : s;
  return d.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function toast(m, err) { const t = $("#toast"); t.textContent = m; t.className = "toast" + (err ? " err" : "");
  setTimeout(() => t.classList.add("hidden"), 2200); }

// modal confirm/prompt (thay alert/prompt mặc định)
function openModal({ message, input = false, value = "", okText = "OK", choices = null, fields = null }) {
  return new Promise((resolve) => {
    const m = $("#modal"), inp = $("#modalInput"), ok = $("#modalOk"), cancel = $("#modalCancel");
    const actions = m.querySelector(".modal-actions"), chrow = $("#modalChoices"), fwrap = $("#modalFields");
    $("#modalMsg").textContent = message;
    inp.classList.toggle("hidden", !input || !!choices || !!fields); if (input) inp.value = value;
    fwrap.classList.toggle("hidden", !fields); fwrap.innerHTML = "";
    const done = (val) => { m.classList.add("hidden"); ok.onclick = cancel.onclick = inp.onkeydown = null; chrow.innerHTML = ""; fwrap.innerHTML = ""; resolve(val); };
    if (choices) {
      actions.classList.add("hidden"); chrow.classList.remove("hidden"); chrow.innerHTML = "";
      choices.forEach((c, i) => { const b = document.createElement("button"); b.className = "btn " + (i === 0 ? "solid" : "ghost"); b.textContent = c.label;   /* label có tên folder do user đặt → KHÔNG innerHTML */ b.onclick = () => done(c.value); chrow.appendChild(b); });
      const hb = document.createElement("button"); hb.className = "btn ghost"; hb.textContent = "Hủy"; hb.onclick = () => done(null); chrow.appendChild(hb);
    } else if (fields) {   // nhiều ô cùng lúc → trả object {key: value}
      actions.classList.remove("hidden"); chrow.classList.add("hidden");
      const els = fields.map((f) => {
        const lab = document.createElement("label"); lab.className = "modal-fld"; lab.textContent = f.label;
        const el = document.createElement("input"); el.type = f.type || "text"; el.value = f.value != null ? f.value : "";
        el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok.onclick(); } else if (e.key === "Escape") cancel.onclick(); });
        lab.appendChild(el); fwrap.appendChild(lab); return { key: f.key, el };
      });
      ok.textContent = okText;
      ok.onclick = () => { const o = {}; els.forEach(({ key, el }) => o[key] = el.value); done(o); };
      cancel.onclick = () => done(null);
      setTimeout(() => { if (els[0]) { els[0].el.focus(); els[0].el.select(); } }, 30);
    } else {
      actions.classList.remove("hidden"); chrow.classList.add("hidden");
      ok.textContent = okText;
      ok.onclick = () => done(input ? inp.value : true);
      cancel.onclick = () => done(input ? null : false);
      inp.onkeydown = (e) => { if (e.key === "Enter") ok.onclick(); else if (e.key === "Escape") cancel.onclick(); };
    }
    m.classList.remove("hidden");
    if (input && !choices && !fields) setTimeout(() => { inp.focus(); inp.select(); }, 30);
  });
}
const askConfirm = (message, okText = "OK") => openModal({ message, okText });
const askPrompt = (message, value = "") => openModal({ message, input: true, value });
const askChoice = (message, choices) => openModal({ message, choices });
const askForm = (message, fields) => openModal({ message, fields });

// ---------- load ----------
let flowsCache = [];
let folders = new Set(JSON.parse(localStorage.getItem("vf_folders") || "[]"));   // folder rỗng vẫn hiện
const saveFolders = () => localStorage.setItem("vf_folders", JSON.stringify([...folders]));
let hiddenFlows = new Set(JSON.parse(localStorage.getItem("vf_hidden_flows") || "[]"));
let hiddenFolders = new Set(JSON.parse(localStorage.getItem("vf_hidden_folders") || "[]"));
let showHidden = false;
const saveHidden = () => { localStorage.setItem("vf_hidden_flows", JSON.stringify([...hiddenFlows])); localStorage.setItem("vf_hidden_folders", JSON.stringify([...hiddenFolders])); };
// chọn folder từ danh sách (có sẵn + tạo mới); trả "" = không folder, null = hủy
async function pickFolder() {
  const names = [...new Set([...folders, ...flowsCache.map((f) => f.group).filter(Boolean)])].sort();
  const choices = [{ label: "— Không folder —", value: "" }, ...names.map((n) => ({ label: "📁 " + n, value: n })), { label: "➕ Folder mới…", value: "__new" }];
  const pick = await askChoice("Thuộc folder nào?", choices); if (pick == null) return null;
  if (pick === "__new") { const n = await askPrompt("Tên folder mới:", "Folder mới"); if (!n) return null; folders.add(n); saveFolders(); return n; }
  return pick;
}
// kéo-thả / đổi folder: chuyển 1 chức năng sang folder khác (hoặc ra ngoài)
async function moveFlowToGroup(id, group) {
  const f = flowsCache.find((x) => x.id === id); if (!f || (f.group || "") === group) return;
  await patchFlow(id, { group });
  if (group) { folders.add(group); saveFolders(); expanded.add(group); localStorage.setItem("vf_expanded", JSON.stringify([...expanded])); }
  await refreshTree(); toast(group ? `Đã chuyển vào "${group}"` : "Đã đưa ra ngoài");
}
function dropZone(el, group) {
  el.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("text/vf-flow")) { e.preventDefault(); e.stopPropagation(); el.classList.add("drop"); } });
  el.addEventListener("dragleave", () => el.classList.remove("drop"));
  el.addEventListener("drop", (e) => { e.preventDefault(); e.stopPropagation(); el.classList.remove("drop"); const id = e.dataTransfer.getData("text/vf-flow") || e.dataTransfer.getData("text/plain"); if (id) moveFlowToGroup(id, group); });
}
let suppressHash = false;   // chặn hashchange tự kích khi chính ta vừa đổi URL
const hashId = () => decodeURIComponent(location.hash.replace(/^#\/?/, ""));
function highlightActive(id) {
  document.querySelectorAll(".flow-list li").forEach((x) => x.classList.toggle("active", x.dataset.id === id));
}
let expanded = new Set();   // mặc định ĐÓNG hết folder mỗi lần tải trang (không nhớ qua reload)
const GUIDE_GROUP = "Hướng dẫn";   // folder hướng dẫn = TRANG RIÊNG, không trộn vào danh sách luồng
let guideMode = false;
const FOLDER_COLORS = ["#d9a441", "#4e9a5f", "#8a6fd0", "#d9793e", "#3f7fb0", "#2f9e8f", "#c05a7a", "#8a9a3a", "#5f6f8a"];

async function loadFlowList() {
  flowsCache = await (await fetch("api/flows")).json();
  renderFlowTree();
  const want = hashId();                                  // vào thẳng luồng theo URL #/<id>
  const id = flowsCache.some((f) => f.id === want) ? want : (flowsCache[0] && flowsCache[0].id);
  if (id) loadFlow(id);
}
function makeFlowLi(f, child) {
  const li = document.createElement("li");
  li.dataset.id = f.id; if (child) li.classList.add("child");
  if (hiddenFlows.has(f.id)) li.classList.add("is-hidden");
  if (flow && flow.id === f.id) li.classList.add("active");
  li.draggable = true;
  li.addEventListener("dragstart", (e) => { if (READONLY) { e.preventDefault(); return; } e.dataTransfer.setData("text/vf-flow", f.id); e.dataTransfer.setData("text/plain", f.id); e.dataTransfer.effectAllowed = "move"; li.classList.add("dragging"); });
  li.addEventListener("dragend", () => li.classList.remove("dragging"));
  const name = document.createElement("span");
  name.className = "fl-name"; name.textContent = (f.kind === "doc" ? "📄 " : "▦ ") + (f.title || f.id)
    + (f.visibility === "public" ? "  🌐" : "") + (hiddenFlows.has(f.id) ? "  🙈" : "");
  li.append(name);
  li.addEventListener("click", () => {
    document.querySelectorAll(".flow-list li").forEach((x) => x.classList.remove("active"));
    li.classList.add("active"); loadFlow(f.id);
  });
  li.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); ctxFlow(f, e.clientX, e.clientY); });
  return li;
}
function renderFlowTree() {
  document.body.classList.toggle("guide-mode", guideMode);
  const ul = $("#flowList"); ul.innerHTML = "";
  if (guideMode) {   // TRANG HƯỚNG DẪN riêng: chỉ liệt kê các tài liệu hướng dẫn
    $("#flowCount").textContent = "";
    flowsCache.filter((f) => (f.group || "") === GUIDE_GROUP).forEach((f) => ul.appendChild(makeFlowLi(f, false)));
    return;
  }
  const vis = (f) => showHidden || !hiddenFlows.has(f.id);
  $("#flowCount").textContent = flowsCache.filter((f) => (f.group || "") !== GUIDE_GROUP).length;
  if (!ul.dataset.dz) { dropZone(ul, ""); ul.dataset.dz = "1"; }   // thả ra vùng gốc = bỏ folder
  const groups = new Map();
  flowsCache.forEach((f) => { const g = f.group || ""; if (g === GUIDE_GROUP) return; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(f); });
  folders.forEach((g) => { if (g && g !== GUIDE_GROUP && !groups.has(g)) groups.set(g, []); });   // folder rỗng (chưa có chức năng nào)
  (groups.get("") || []).filter(vis).forEach((f) => ul.appendChild(makeFlowLi(f, false)));
  [...groups.keys()].filter((g) => g).sort().forEach((g, gi) => {
    if (hiddenFolders.has(g) && !showHidden) return;
    const open = expanded.has(g);   // mặc định ĐÓNG; chỉ mở khi người dùng bấm
    const kids = groups.get(g).filter(vis);
    const folder = document.createElement("li");
    folder.className = "folder" + (open ? "" : " collapsed") + (hiddenFolders.has(g) ? " is-hidden" : "");
    folder.innerHTML = `<span class="caret${open ? " open" : ""}"></span>`
      + `<span class="folder-ico" style="background:${FOLDER_COLORS[gi % FOLDER_COLORS.length]}"></span>`
      + `<span class="fl-name">${esc(g)}${hiddenFolders.has(g) ? "  🙈" : ""}</span>`
      + `<span class="pill">${kids.length}</span>`;
    folder.addEventListener("click", () => {
      if (expanded.has(g)) expanded.delete(g); else expanded.add(g);
      localStorage.setItem("vf_expanded", JSON.stringify([...expanded]));
      renderFlowTree();
    });
    folder.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); ctxFolder(g, e.clientX, e.clientY); });
    dropZone(folder, g);   // thả chức năng vào folder này
    ul.appendChild(folder);
    if (open) {
      const branch = document.createElement("li"); branch.className = "branch";
      const sub = document.createElement("ul"); sub.className = "subtree";
      kids.forEach((f) => sub.appendChild(makeFlowLi(f, true)));
      branch.appendChild(sub); ul.appendChild(branch);
    }
  });
  const nHidden = hiddenFlows.size + hiddenFolders.size;   // nút hiện/ẩn mục đã ẩn
  const btn = $("#btnShowHidden");
  if (btn) { btn.classList.toggle("hidden", nHidden === 0); btn.textContent = showHidden ? `🙈 Ẩn lại (${nHidden} mục)` : `👁 Hiện ${nHidden} mục đã ẩn`; }
}
async function deleteFlow(id, title) {
  if (!(await askConfirm(`Xóa luồng "${title}"? Không khôi phục được.`, "Xóa"))) return;
  const r = await fetch(`api/flows/${id}`, { method: "DELETE" });
  if (!r.ok) return toast("Xóa lỗi: " + (await r.text()), true);
  toast("Đã xóa " + id);
  await loadFlowList();
}
async function loadFlow(id) {
  flow = await (await fetch(`api/flows/${id}`)).json();
  flow.steps = flow.steps || []; flow.learn = flow.learn || [];
  dirty = false; $("#btnSave").disabled = true; viewingNode = false; resetHistory();
  const url = "#/" + id; if (location.hash !== url) { suppressHash = true; location.hash = url; }   // URL riêng từng luồng
  highlightActive(id); updateShareBtn();
  renderAll(); if (editing()) { fillFlowMeta(); fillStepEditor(); }
}
function slug(s) {
  return (s || "flow").replace(/đ/g, "d").replace(/Đ/g, "D").normalize("NFD")
    .replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 32) || "flow";
}
async function createFlow(title, group, kind = "flow") {
  const id = slug(title) + "-" + Date.now().toString(36).slice(-4);
  const nf = { id, title, kind, doc_md: kind === "doc" ? `# ${title}\n\nViết nội dung ở đây…\n` : "",
    group: group || "", subtitle: "", duration: "", level: "", learn: [],
    nodes: kind === "doc" ? [] : [{ id: "s1", type: "start", label: "", explain: "", step: 0 }], edges: [], steps: [] };
  const r = await fetch(`api/flows/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nf) });
  if (!r.ok) return toast("Tạo lỗi: " + (await r.text()), true);
  if (group) { folders.add(group); saveFolders(); expanded.add(group); localStorage.setItem("vf_expanded", JSON.stringify([...expanded])); }
  flowsCache = await (await fetch("api/flows")).json();
  await loadFlow(id); renderFlowTree(); toast("Đã tạo " + title);
}
// "+ Thêm mới" → chọn Folder hay Chức năng
async function newItem() {
  const t = await askChoice("Thêm mới:",
    [{ label: "📁 Folder", value: "folder" }, { label: "⚙ Chức năng", value: "flow" }]);
  if (t == null) return;
  if (t === "folder") newFolder(); else newFlow();
}
async function newFolder() {
  const name = await askPrompt("Tên folder:", "Folder mới"); if (!name) return;
  folders.add(name); saveFolders();
  expanded.add(name); localStorage.setItem("vf_expanded", JSON.stringify([...expanded]));
  renderFlowTree(); toast("Đã tạo folder " + name);
}
async function newFlow(group0 = null) {
  const title = await askPrompt("Tên chức năng mới:", "Chức năng mới"); if (!title) return;
  const kind = await askChoice(`Chọn loại cho "${title}":`,
    [{ label: "▦ Sơ đồ", value: "flow" }, { label: "📄 Tài liệu / Blog", value: "doc" }]);
  if (kind == null) return;   // Hủy → không tạo gì
  const group = group0 != null ? group0 : await askPrompt("Thuộc folder nào (để trống nếu không):", "");
  if (group == null) return;
  createFlow(title, group || "", kind);
}
async function addFlowToGroup(g, kind = "flow") {
  const lbl = kind === "doc" ? "📄 Tài liệu" : "▦ Sơ đồ";
  const title = await askPrompt(`Tên ${lbl} mới trong "${g}":`, kind === "doc" ? "Tài liệu mới" : "Sơ đồ mới"); if (!title) return;
  createFlow(title, g, kind);
}
async function patchFlow(id, changes) {
  const f = await (await fetch(`api/flows/${id}`)).json();
  Object.assign(f, changes);
  const r = await fetch(`api/flows/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
  // đang mở chính luồng này → cập nhật _rev, không thì lần Lưu sau bị báo xung đột oan
  if (r.ok && flow && flow.id === id) flow._rev = (await r.json())._rev;
}

// ---------- lịch sử phiên bản ----------
async function showHistory() {
  if (!flow) return;
  const vs = await (await fetch(`api/flows/${flow.id}/history`)).json();
  if (!vs.length) return toast("Chưa có bản cũ nào — lưu lần đầu sẽ bắt đầu ghi lịch sử");
  const v = await askChoice(`Lịch sử "${flow.title || flow.id}" (${vs.length} bản, mới nhất trước):`,
    vs.map((x) => ({ label: `${x.at} · ${x.nodes} khối${x.title !== flow.title ? " · " + x.title : ""}`, value: x.v })));
  if (v == null) return;
  if (dirty && !(await askConfirm("Đang có thay đổi chưa lưu — khôi phục sẽ bỏ chúng. Tiếp tục?", "Tiếp tục"))) return;
  if (!(await askConfirm(`Khôi phục bản ${vs.find((x) => x.v === v).at}? Bản hiện tại vẫn được giữ trong lịch sử.`, "Khôi phục"))) return;
  const r = await fetch(`api/flows/${flow.id}/restore`, { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ v }) });
  if (!r.ok) return toast("Khôi phục lỗi: " + (await r.text()), true);
  await loadFlow(flow.id); await refreshTree(); toast("Đã khôi phục ✓");
}
async function refreshTree() { flowsCache = await (await fetch("api/flows")).json(); renderFlowTree(); }

// ---------- chia sẻ (private ⇄ public) ----------
function updateShareBtn() {
  const b = $("#btnShare"); if (!b || !flow) return;
  const pub = (flow.visibility || "private") === "public";
  b.textContent = pub ? "🌐 Công khai" : "🔗 Chia sẻ";
  b.classList.toggle("on", pub);
}
async function shareFlow() {
  if (!flow || !flow.id) return;
  const id = flow.id, pub = (flow.visibility || "private") === "public";
  const url = location.origin + location.pathname + "#/" + id;
  const msg = (pub ? "🌐 Đang CÔNG KHAI — ai có link đều xem được:\n" : "🔒 Đang RIÊNG TƯ — chỉ mình bạn:\n") + url;
  const choices = pub
    ? [{ label: "📋 Copy link", value: "copy" }, { label: "🔒 Chuyển riêng tư", value: "private" }]
    : [{ label: "🌐 Công khai + copy link", value: "public" }, { label: "📋 Copy link", value: "copy" }];
  const pick = await askChoice(msg, choices); if (pick == null) return;
  if (pick === "public" || pick === "private") {
    await patchFlow(id, { visibility: pick }); flow.visibility = pick;
    await refreshTree(); updateShareBtn();
    toast(pick === "public" ? "Đã công khai" : "Đã chuyển riêng tư");
  }
  if (pick === "public" || pick === "copy") {
    try { await navigator.clipboard.writeText(url); toast("Đã copy link"); } catch (_) { toast(url); }
  }
}
async function renameFlow(id, title) {
  const t = await askPrompt("Tên mới:", title); if (t == null || t === title) return;
  await patchFlow(id, { title: t }); await refreshTree();
  if (flow.id === id) { flow.title = t; $("#flowTitle").textContent = t; }
  toast("Đã đổi tên");
}
async function regroupFlow(id) {
  const g = await pickFolder(); if (g == null) return;
  await moveFlowToGroup(id, g);
}
async function renameGroup(old) {
  const g = await askPrompt("Tên nhóm mới:", old); if (!g || g === old) return;
  for (const f of flowsCache.filter((x) => (x.group || "") === old)) await patchFlow(f.id, { group: g });
  folders.delete(old); folders.add(g); saveFolders();
  expanded.delete(old); expanded.add(g); localStorage.setItem("vf_expanded", JSON.stringify([...expanded]));
  await refreshTree(); toast("Đã đổi tên folder");
}
async function deleteGroup(g) {
  const ids = flowsCache.filter((x) => (x.group || "") === g).map((x) => x.id);
  if (!(await askConfirm(`Xóa folder "${g}"${ids.length ? " và " + ids.length + " chức năng trong đó" : ""}? Không khôi phục được.`, "Xóa"))) return;
  for (const id of ids) await fetch(`api/flows/${id}`, { method: "DELETE" });
  folders.delete(g); saveFolders();
  await refreshTree(); toast("Đã xóa folder");
}
function ctxFlow(f, x, y) {
  const hidden = hiddenFlows.has(f.id);
  showCtx([
    { label: "📂 Mở", act: () => loadFlow(f.id) },
    { label: "✏️ Đổi tên", act: () => renameFlow(f.id, f.title || f.id) },
    { label: "📁 Đổi folder", act: () => regroupFlow(f.id) },
    { label: hidden ? "👁 Bỏ ẩn" : "🙈 Ẩn", act: () => { if (hidden) hiddenFlows.delete(f.id); else hiddenFlows.add(f.id); saveHidden(); renderFlowTree(); } },
    { sep: true },
    { label: "🗑 Xóa chức năng", danger: true, act: () => deleteFlow(f.id, f.title || f.id) },
  ], x, y);
}
function ctxFolder(g, x, y) {
  const hidden = hiddenFolders.has(g);
  showCtx([
    { label: "▦ Thêm sơ đồ", act: () => addFlowToGroup(g, "flow") },
    { label: "📄 Thêm tài liệu", act: () => addFlowToGroup(g, "doc") },
    { label: "✏️ Đổi tên folder", act: () => renameGroup(g) },
    { label: hidden ? "👁 Bỏ ẩn folder" : "🙈 Ẩn folder", act: () => { if (hidden) hiddenFolders.delete(g); else hiddenFolders.add(g); saveHidden(); renderFlowTree(); } },
    { sep: true },
    { label: "🗑 Xóa folder (xóa hết)", danger: true, act: () => deleteGroup(g) },
  ], x, y);
}

