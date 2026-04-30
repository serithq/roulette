"use strict";
(() => {
  // src/app.ts
  function $(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`element not found: #${id}`);
    return el;
  }
  function ensure(v, msg) {
    if (v == null) throw new Error(msg);
    return v;
  }
  async function apiGet(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  }
  async function apiPut(path, body) {
    const res = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(res.statusText);
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
  async function apiPost(path) {
    const res = await fetch(path, { method: "POST" });
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  }
  async function apiDelete(path) {
    const res = await fetch(path, { method: "DELETE" });
    if (!res.ok) throw new Error(res.statusText);
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
  var COLOR_TEMPLATES = [
    { id: "ruby", label: "\u30EB\u30D3\u30FC", fill: "#e11d48" },
    { id: "orange", label: "\u30AA\u30EC\u30F3\u30B8", fill: "#ea580c" },
    { id: "amber", label: "\u30A2\u30F3\u30D0\u30FC", fill: "#d97706" },
    { id: "lime", label: "\u30E9\u30A4\u30E0", fill: "#65a30d" },
    { id: "teal", label: "\u30C6\u30A3\u30FC\u30EB", fill: "#0d9488" },
    { id: "ocean", label: "\u30D6\u30EB\u30FC", fill: "#2563eb" },
    { id: "violet", label: "\u30D0\u30A4\u30AA\u30EC\u30C3\u30C8", fill: "#7c3aed" },
    { id: "slate", label: "\u30B9\u30EC\u30FC\u30C8", fill: "#475569" }
  ];
  function tplById(id) {
    return COLOR_TEMPLATES.find((t) => t.id === id) ?? COLOR_TEMPLATES[0];
  }
  function isColorId(v) {
    return typeof v === "string" && COLOR_TEMPLATES.some((t) => t.id === v);
  }
  var COLOR_SLOT_COUNT = COLOR_TEMPLATES.length;
  function usedColorIdsExcludingMember(excludeMemberIndex) {
    const s = /* @__PURE__ */ new Set();
    members.forEach((m, i) => {
      if (typeof excludeMemberIndex === "number" && i === excludeMemberIndex) return;
      s.add(m.colorId);
    });
    return s;
  }
  function ensureSelectedForAdd() {
    const used = usedColorIdsExcludingMember();
    if (!used.has(selectedColorId)) return;
    const t = COLOR_TEMPLATES.find((c) => !used.has(c.id));
    if (t) selectedColorId = t.id;
  }
  function nextAllowedColorId(currentId, memberIndex) {
    const forbidden = usedColorIdsExcludingMember(memberIndex);
    const start = COLOR_TEMPLATES.findIndex((t) => t.id === currentId);
    for (let step = 1; step <= COLOR_TEMPLATES.length; step++) {
      const idx = (Math.max(0, start) + step) % COLOR_TEMPLATES.length;
      const id = COLOR_TEMPLATES[idx].id;
      if (!forbidden.has(id)) return id;
    }
    return currentId;
  }
  function dedupeMemberColors(list) {
    const used = /* @__PURE__ */ new Set();
    for (const m of list) {
      if (!used.has(m.colorId)) {
        used.add(m.colorId);
        continue;
      }
      const t = COLOR_TEMPLATES.find((c) => !used.has(c.id));
      if (t) {
        m.colorId = t.id;
        used.add(t.id);
      }
    }
  }
  async function dedupeAfterLoad() {
    if (members.length > COLOR_SLOT_COUNT) members.splice(COLOR_SLOT_COUNT);
    dedupeMemberColors(members);
    presets.forEach((p) => {
      if (p.members.length > COLOR_SLOT_COUNT) p.members.splice(COLOR_SLOT_COUNT);
      dedupeMemberColors(p.members);
    });
    await saveState();
  }
  var canvas = $("wheel");
  var ctx = ensure(canvas.getContext("2d"), "2d context not available");
  var nameListEl = $("nameList");
  var nameInput = $("nameInput");
  var addForm = $("addForm");
  var addBtn = ensure(
    addForm.querySelector('button[type="submit"]'),
    "addForm submit button not found"
  );
  var spinBtn = $("spinBtn");
  var clearBtn = $("clearBtn");
  var resultEl = $("result");
  var tplBar = $("tplBar");
  var presetSelect = $("presetSelect");
  var presetTitleInput = $("presetTitleInput");
  var savePresetBtn = $("savePresetBtn");
  var deletePresetBtn = $("deletePresetBtn");
  var winnerHistoryEl = $("winnerHistory");
  var winnerCountsEl = $("winnerCounts");
  var sim100Btn = $("sim100Btn");
  var sim100Output = $("sim100Output");
  var testPanel = $("testPanel");
  var toggleTestPanelBtn = $("toggleTestPanelBtn");
  var TEST_PANEL_LS_KEY = "extension-cord-roulette-ui-test-visible";
  function applyTestPanelVisibility() {
    const show = localStorage.getItem(TEST_PANEL_LS_KEY) === "1";
    testPanel.classList.toggle("is-hidden", !show);
    toggleTestPanelBtn.textContent = show ? "\u30C6\u30B9\u30C8\u7528\u3092\u96A0\u3059" : "\u30C6\u30B9\u30C8\u7528\u3092\u8868\u793A";
    toggleTestPanelBtn.setAttribute("aria-expanded", show ? "true" : "false");
  }
  var members = [];
  var presets = [];
  var selectedColorId = COLOR_TEMPLATES[0].id;
  var rotation = 0;
  var spinning = false;
  var animId = null;
  var winnerHistory = [];
  function historyApiPath() {
    const pid = presetSelect.value;
    if (pid) return `/api/history?presetId=${encodeURIComponent(pid)}`;
    return "/api/history";
  }
  function spinApiPath() {
    const pid = presetSelect.value;
    if (pid) return `/api/spin?presetId=${encodeURIComponent(pid)}`;
    return "/api/spin";
  }
  function formatHistoryDateHeading(ymd) {
    const parts = ymd.split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return ymd;
    const [y, mo, da] = parts;
    const w = ["\u65E5", "\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"][new Date(y, mo - 1, da).getDay()];
    return `${y}\u5E74${mo}\u6708${da}\u65E5\uFF08${w}\uFF09`;
  }
  function isWinnerEntry(e) {
    if (!e || typeof e !== "object") return false;
    const o = e;
    return typeof o.date === "string" && typeof o.name === "string" && typeof o.at === "number";
  }
  async function loadWinnerHistory() {
    winnerHistory = [];
    if (!presetSelect.value) return;
    try {
      const o = await apiGet(historyApiPath());
      if (o && Array.isArray(o.entries)) {
        winnerHistory = o.entries.filter(isWinnerEntry);
      }
    } catch {
      winnerHistory = [];
    }
  }
  function renderWinnerHistory() {
    winnerHistoryEl.innerHTML = "";
    if (!presetSelect.value) {
      renderWinnerCounts();
      return;
    }
    if (winnerHistory.length === 0) {
      const p = document.createElement("p");
      p.className = "history-empty";
      p.textContent = "\u3053\u306E\u4FDD\u5B58\u30E1\u30F3\u30D0\u30FC\uFF08\u30BB\u30C3\u30C8\uFF09\u306B\u306F\u307E\u3060\u8A18\u9332\u304C\u3042\u308A\u307E\u305B\u3093";
      winnerHistoryEl.appendChild(p);
      renderWinnerCounts();
      return;
    }
    const sorted = [...winnerHistory].sort((a, b) => b.at - a.at);
    const byDate = /* @__PURE__ */ new Map();
    for (const e of sorted) {
      const list = byDate.get(e.date);
      if (list) list.push(e);
      else byDate.set(e.date, [e]);
    }
    const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
    for (const date of dates) {
      const block = document.createElement("div");
      block.className = "history-date-block";
      const h = document.createElement("h3");
      h.className = "history-subheading";
      h.textContent = formatHistoryDateHeading(date);
      block.appendChild(h);
      const ul = document.createElement("ul");
      ul.className = "history-day-list";
      (byDate.get(date) ?? []).forEach((e) => {
        const li = document.createElement("li");
        const main = document.createElement("div");
        main.className = "history-day-main";
        const nameSpan = document.createElement("span");
        nameSpan.textContent = e.name;
        const timeStr = new Date(e.at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
        const timeSpan = document.createElement("span");
        timeSpan.className = "history-time";
        timeSpan.textContent = timeStr;
        main.appendChild(nameSpan);
        main.appendChild(timeSpan);
        const del = document.createElement("button");
        del.type = "button";
        del.className = "history-delete-btn";
        del.textContent = "\u524A\u9664";
        del.setAttribute("aria-label", `${e.name} ${timeStr} \u306E\u8A18\u9332\u3092\u524A\u9664`);
        del.disabled = spinning;
        del.addEventListener("click", async () => {
          if (spinning) return;
          if (!confirm("\u3053\u306E\u5F53\u9078\u8A18\u9332\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F")) return;
          try {
            await apiDelete(`/api/history/${encodeURIComponent(String(e.at))}`);
            await loadWinnerHistory();
            renderWinnerHistory();
          } catch {
            alert("\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002");
          }
        });
        li.appendChild(main);
        li.appendChild(del);
        ul.appendChild(li);
      });
      block.appendChild(ul);
      winnerHistoryEl.appendChild(block);
    }
    renderWinnerCounts();
  }
  function renderWinnerCounts() {
    winnerCountsEl.innerHTML = "";
    if (!presetSelect.value) return;
    const counts = /* @__PURE__ */ new Map();
    for (const e of winnerHistory) {
      counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
    }
    if (counts.size === 0) {
      const p = document.createElement("p");
      p.className = "history-empty";
      p.textContent = "\u3053\u306E\u4FDD\u5B58\u30E1\u30F3\u30D0\u30FC\uFF08\u30BB\u30C3\u30C8\uFF09\u306B\u306F\u307E\u3060\u8A18\u9332\u304C\u3042\u308A\u307E\u305B\u3093";
      winnerCountsEl.appendChild(p);
      return;
    }
    const rows = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja")
    );
    const ol = document.createElement("ol");
    ol.className = "ranking-list";
    let rank = 0;
    let prevCount = null;
    rows.forEach(([name, n]) => {
      if (prevCount === null || n !== prevCount) {
        rank += 1;
      }
      prevCount = n;
      const li = document.createElement("li");
      li.className = "ranking-item";
      if (rank <= 3) li.classList.add(`ranking-item--top${rank}`);
      const rankEl = document.createElement("span");
      rankEl.className = "ranking-rank";
      rankEl.textContent = `${rank}\u4F4D`;
      const nameEl = document.createElement("span");
      nameEl.className = "ranking-name";
      nameEl.textContent = name;
      const countEl = document.createElement("span");
      countEl.className = "ranking-count";
      countEl.textContent = `${n}\u56DE`;
      li.appendChild(rankEl);
      li.appendChild(nameEl);
      li.appendChild(countEl);
      ol.appendChild(li);
    });
    winnerCountsEl.appendChild(ol);
  }
  function cloneMembers(list) {
    return list.map((m) => ({ name: m.name, colorId: m.colorId }));
  }
  function normalizeMemberRow(raw, index) {
    if (typeof raw === "string") {
      const name = raw.trim();
      return name ? { name, colorId: COLOR_TEMPLATES[index % COLOR_TEMPLATES.length].id } : null;
    }
    if (raw && typeof raw === "object") {
      const obj = raw;
      const name = String(obj.name ?? "").trim();
      if (!name) return null;
      const colorId = isColorId(obj.colorId) ? obj.colorId : COLOR_TEMPLATES[0].id;
      return { name, colorId };
    }
    return null;
  }
  function normalizeMembers(arr) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    arr.forEach((row, i) => {
      const m = normalizeMemberRow(row, i);
      if (m) out.push(m);
    });
    return out;
  }
  async function loadState() {
    members = [];
    presets = [];
    try {
      const o = await apiGet("/api/state");
      if (o && typeof o === "object") {
        members = normalizeMembers(o.members);
        if (Array.isArray(o.presets)) {
          presets = o.presets.filter((p) => {
            if (!p || typeof p !== "object") return false;
            const obj = p;
            return !!String(obj.title ?? "").trim() && Array.isArray(obj.members);
          }).map((p) => ({
            id: String(p.id ?? Date.now().toString(36)),
            title: String(p.title).trim(),
            members: normalizeMembers(p.members)
          }));
        }
      }
    } catch {
      members = [];
      presets = [];
    }
  }
  async function saveState() {
    await apiPut("/api/state", { members, presets });
  }
  function refreshTplBar() {
    ensureSelectedForAdd();
    tplBar.innerHTML = "";
    const taken = usedColorIdsExcludingMember();
    COLOR_TEMPLATES.forEach((t) => {
      const isTaken = taken.has(t.id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tpl-btn";
      b.style.background = t.fill;
      b.title = isTaken ? `${t.label}\uFF08\u4ED6\u306E\u53C2\u52A0\u8005\u304C\u4F7F\u7528\u4E2D\uFF09` : t.label;
      b.setAttribute("aria-label", t.label);
      b.dataset.colorId = t.id;
      b.disabled = isTaken;
      b.setAttribute("aria-pressed", !isTaken && t.id === selectedColorId ? "true" : "false");
      b.addEventListener("click", () => {
        if (b.disabled) return;
        selectedColorId = t.id;
        tplBar.querySelectorAll(".tpl-btn").forEach((btn) => {
          btn.setAttribute(
            "aria-pressed",
            btn.dataset.colorId === selectedColorId ? "true" : "false"
          );
        });
      });
      tplBar.appendChild(b);
    });
  }
  function refreshPresetSelect() {
    const prev = presetSelect.value;
    presetSelect.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "\u2014 \u8AAD\u307F\u8FBC\u3080\u30BB\u30C3\u30C8\u3092\u9078\u629E \u2014";
    presetSelect.appendChild(opt0);
    presets.forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = `${p.title}\uFF08${p.members.length}\u4EBA\uFF09`;
      presetSelect.appendChild(o);
    });
    if (presets.some((p) => p.id === prev)) presetSelect.value = prev;
    deletePresetBtn.disabled = !presetSelect.value || spinning;
  }
  function drawWheel() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.getBoundingClientRect().width * dpr;
    if (canvas.width !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - 4 * dpr;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    if (!presetSelect.value) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = "#e2e8f0";
      ctx.fill();
      const fontSize = Math.max(13 * dpr, Math.min(r * 0.11 * dpr, 22 * dpr));
      ctx.font = `700 ${fontSize}px "Zen Kaku Gothic New", sans-serif`;
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u30C1\u30FC\u30E0\u304C\u9078\u629E\u3055\u308C\u3066\u3044\u307E\u305B\u3093", 0, 0);
      ctx.restore();
      return;
    }
    ctx.rotate(rotation);
    const n = members.length;
    if (n === 0) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = "#e2e8f0";
      ctx.fill();
      ctx.restore();
      return;
    }
    const slice = Math.PI * 2 / n;
    for (let i = 0; i < n; i++) {
      const a0 = i * slice - Math.PI / 2;
      const a1 = (i + 1) * slice - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = tplById(members[i].colorId).fill;
      ctx.fill();
      ctx.strokeStyle = "rgba(15, 23, 42, 0.12)";
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();
      const mid = (a0 + a1) / 2;
      const labelR = r * 0.62;
      const tx = Math.cos(mid) * labelR;
      const ty = Math.sin(mid) * labelR;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(mid + Math.PI / 2);
      const fontSize = Math.max(12 * dpr, r / n * 0.35 * dpr);
      ctx.font = `700 ${fontSize}px "Zen Kaku Gothic New", sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const text = truncate(members[i].name, n > 8 ? 6 : 10);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
  function truncate(s, max) {
    const t = s.trim();
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + "\u2026";
  }
  function renderList() {
    nameListEl.innerHTML = "";
    members.forEach((m, i) => {
      const li = document.createElement("li");
      const main = document.createElement("div");
      main.className = "li-main";
      const sw = document.createElement("button");
      sw.type = "button";
      sw.className = "li-swatch";
      sw.style.background = tplById(m.colorId).fill;
      sw.title = `${tplById(m.colorId).label}\uFF08\u30AF\u30EA\u30C3\u30AF\u3067\u5225\u306E\u7A7A\u304D\u8272\u3078\uFF09`;
      sw.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (spinning) return;
        members[i].colorId = nextAllowedColorId(members[i].colorId, i);
        void saveState();
        renderList();
        drawWheel();
      });
      const span = document.createElement("span");
      span.className = "li-name";
      span.textContent = m.name;
      main.appendChild(sw);
      main.appendChild(span);
      const rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = "\u524A\u9664";
      rm.addEventListener("click", () => {
        members.splice(i, 1);
        void saveState();
        renderList();
        updateSpinState();
        drawWheel();
      });
      li.appendChild(main);
      li.appendChild(rm);
      nameListEl.appendChild(li);
    });
    refreshTplBar();
  }
  var SIM_RUNS = 100;
  function runSim100() {
    const n = members.length;
    if (n < 2) {
      sim100Output.textContent = "\u53C2\u52A0\u8005\u304C2\u4EBA\u4EE5\u4E0A\u3044\u308B\u3068\u304D\u306B\u4F7F\u3048\u307E\u3059\u3002";
      return;
    }
    const counts = new Array(n).fill(0);
    for (let i = 0; i < SIM_RUNS; i++) {
      counts[randInt(n)] += 1;
    }
    const lines = members.map((m, i) => `${m.name}: ${counts[i]}\u56DE`);
    sim100Output.textContent = `${SIM_RUNS}\u56DE\u306E\u62BD\u9078\u7D50\u679C\uFF08\u5404\u30A4\u30F3\u30C7\u30C3\u30AF\u30B9\u306B randInt(${n}) \u304C\u4F55\u56DE\u5F53\u305F\u3063\u305F\u304B\uFF09

${lines.join("\n")}`;
  }
  function updateSpinState() {
    const presetOk = Boolean(presetSelect.value);
    spinBtn.disabled = spinning || members.length < 2 || !presetOk;
    spinBtn.title = !presetOk && members.length >= 2 ? "\u300C\u4FDD\u5B58\u3057\u305F\u30E1\u30F3\u30D0\u30FC\u300D\u3067\u30BB\u30C3\u30C8\u3092\u9078\u3093\u3067\u304B\u3089\u56DE\u3057\u3066\u304F\u3060\u3055\u3044" : "";
    sim100Btn.disabled = spinning || members.length < 2;
    const full = members.length >= COLOR_SLOT_COUNT;
    addBtn.disabled = spinning || full;
    nameInput.disabled = spinning || full;
    if ((!presetOk || members.length < 2) && !spinning) {
      resultEl.textContent = "";
      resultEl.className = "result empty";
    }
    deletePresetBtn.disabled = !presetSelect.value || spinning;
  }
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function mod2pi(x) {
    return (x % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  }
  function indexUnderPointer(R, n) {
    const slice = Math.PI * 2 / n;
    const u = mod2pi(-R);
    if (u >= Math.PI * 2 - 1e-9) return 0;
    return Math.min(n - 1, Math.max(0, Math.floor(u / slice)));
  }
  function randInt(n) {
    return Math.floor(Math.random() * n);
  }
  function computeTargetRotationForWinner(winnerIndex, startRotation, fullTurns, n) {
    const slice = Math.PI * 2 / n;
    const uCenter = (winnerIndex + 0.5) * slice;
    const REndMod = mod2pi(-uCenter);
    const d = mod2pi(REndMod - mod2pi(startRotation + fullTurns));
    return startRotation + fullTurns + d;
  }
  async function spin() {
    if (spinning || members.length < 2 || !presetSelect.value) return;
    spinning = true;
    spinBtn.disabled = true;
    deletePresetBtn.disabled = true;
    resultEl.textContent = "\u56DE\u8EE2\u4E2D\u2026";
    resultEl.className = "result";
    renderWinnerHistory();
    const n = members.length;
    let winnerIndex;
    try {
      await saveState();
      const data = await apiPost(spinApiPath());
      winnerIndex = data.winner_index;
      if (typeof winnerIndex !== "number" || winnerIndex < 0 || winnerIndex >= n) {
        throw new Error("invalid winner_index");
      }
    } catch {
      spinning = false;
      resultEl.textContent = "\u30B5\u30FC\u30D0\u30FC\u3068\u306E\u901A\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u30BF\u30FC\u30DF\u30CA\u30EB\u3067 rackup \u304C\u52D5\u3044\u3066\u3044\u308B\u304B\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      resultEl.className = "result empty";
      updateSpinState();
      return;
    }
    const spinCount = 5 + Math.random() * 3;
    const fullTurns = Math.PI * 2 * spinCount;
    const targetRotation = computeTargetRotationForWinner(winnerIndex, rotation, fullTurns, n);
    const startRotation = rotation;
    const duration = 4200 + Math.random() * 800;
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = easeOutCubic(t);
      rotation = startRotation + (targetRotation - startRotation) * e;
      drawWheel();
      if (t < 1) {
        animId = requestAnimationFrame(frame);
      } else {
        rotation = targetRotation;
        if (indexUnderPointer(rotation, n) !== winnerIndex) {
          const slice = Math.PI * 2 / n;
          const uCenter = (winnerIndex + 0.5) * slice;
          rotation = -uCenter + 2 * Math.PI * Math.round((rotation + uCenter) / (2 * Math.PI));
        }
        drawWheel();
        spinning = false;
        const name = members[winnerIndex].name;
        resultEl.innerHTML = `\u62C5\u5F53\u306F<span style="font-size:1.35em">${escapeHtml(name)}</span> \u3055\u3093\uFF01`;
        resultEl.className = "result winner";
        void loadWinnerHistory().then(() => {
          renderWinnerHistory();
        });
        updateSpinState();
      }
    }
    if (animId !== null) cancelAnimationFrame(animId);
    animId = requestAnimationFrame(frame);
  }
  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = nameInput.value.trim();
    if (!v) return;
    if (members.length >= COLOR_SLOT_COUNT) return;
    ensureSelectedForAdd();
    members.push({ name: v, colorId: selectedColorId });
    nameInput.value = "";
    void saveState();
    renderList();
    updateSpinState();
    drawWheel();
  });
  spinBtn.addEventListener("click", () => {
    void spin();
  });
  sim100Btn.addEventListener("click", () => {
    if (spinning || members.length < 2) return;
    runSim100();
  });
  toggleTestPanelBtn.addEventListener("click", () => {
    const show = localStorage.getItem(TEST_PANEL_LS_KEY) === "1";
    localStorage.setItem(TEST_PANEL_LS_KEY, show ? "0" : "1");
    applyTestPanelVisibility();
  });
  clearBtn.addEventListener("click", () => {
    if (spinning) return;
    members = [];
    void saveState();
    renderList();
    updateSpinState();
    resultEl.textContent = "";
    resultEl.className = "result empty";
    drawWheel();
  });
  savePresetBtn.addEventListener("click", () => {
    if (spinning) return;
    const title = presetTitleInput.value.trim();
    if (!title) {
      alert("\u30BB\u30C3\u30C8\u540D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    if (members.length === 0) {
      alert("\u4FDD\u5B58\u3059\u308B\u30E1\u30F3\u30D0\u30FC\u304C\u3044\u307E\u305B\u3093\u3002");
      return;
    }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    presets.push({ id, title, members: cloneMembers(members) });
    presetTitleInput.value = "";
    void saveState();
    refreshPresetSelect();
    presetSelect.value = id;
    updateSpinState();
    drawWheel();
    void loadWinnerHistory().then(() => renderWinnerHistory());
  });
  presetSelect.addEventListener("change", () => {
    const id = presetSelect.value;
    deletePresetBtn.disabled = !id || spinning;
    if (!id) {
      updateSpinState();
      drawWheel();
      void loadWinnerHistory().then(() => renderWinnerHistory());
      return;
    }
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    if (spinning) return;
    members = cloneMembers(p.members).slice(0, COLOR_SLOT_COUNT);
    dedupeMemberColors(members);
    void saveState();
    renderList();
    updateSpinState();
    drawWheel();
    void loadWinnerHistory().then(() => renderWinnerHistory());
  });
  deletePresetBtn.addEventListener("click", () => {
    const id = presetSelect.value;
    if (!id || spinning) return;
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(`\u300C${p.title}\u300D\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F`)) return;
    presets = presets.filter((x) => x.id !== id);
    presetSelect.value = "";
    void saveState();
    refreshPresetSelect();
    updateSpinState();
    drawWheel();
    void loadWinnerHistory().then(() => renderWinnerHistory());
  });
  var resizeTimer;
  window.addEventListener("resize", () => {
    if (resizeTimer !== void 0) clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => drawWheel(), 100);
  });
  void (async () => {
    try {
      await loadState();
      await dedupeAfterLoad();
      await loadWinnerHistory();
      renderWinnerHistory();
      applyTestPanelVisibility();
      refreshPresetSelect();
      renderList();
      updateSpinState();
      requestAnimationFrame(() => drawWheel());
    } catch (e) {
      console.error(e);
      resultEl.textContent = "\u30C7\u30FC\u30BF\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002bundle exec rackup \u3067\u30B5\u30FC\u30D0\u30FC\u3092\u8D77\u52D5\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      resultEl.className = "result empty";
    }
  })();
})();
//# sourceMappingURL=app.js.map
