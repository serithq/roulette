type ColorId =
  | "ruby"
  | "orange"
  | "amber"
  | "lime"
  | "teal"
  | "ocean"
  | "violet"
  | "slate";

type ColorTemplate = {
  id: ColorId;
  label: string;
  fill: string;
};

type Member = {
  name: string;
  colorId: ColorId;
};

type Preset = {
  id: string;
  title: string;
  members: Member[];
};

type WinnerEntry = {
  date: string;
  name: string;
  at: number;
  presetId?: string;
};

type StateResponse = {
  members?: unknown;
  presets?: unknown;
};

type HistoryResponse = {
  entries?: unknown;
};

type SpinResponse = {
  winner_index: number;
  winner_name: string;
};

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`element not found: #${id}`);
  return el as T;
}

function ensure<T>(v: T, msg: string): NonNullable<T> {
  if (v == null) throw new Error(msg);
  return v as NonNullable<T>;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(res.statusText);
  return (await res.json()) as T;
}

async function apiPut(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.statusText);
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function apiPost<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "POST" });
  if (!res.ok) throw new Error(res.statusText);
  return (await res.json()) as T;
}

async function apiDelete(path: string): Promise<unknown> {
  const res = await fetch(path, { method: "DELETE" });
  if (!res.ok) throw new Error(res.statusText);
  try {
    return await res.json();
  } catch {
    return {};
  }
}

const COLOR_TEMPLATES: ColorTemplate[] = [
  { id: "ruby", label: "ルビー", fill: "#e11d48" },
  { id: "orange", label: "オレンジ", fill: "#ea580c" },
  { id: "amber", label: "アンバー", fill: "#d97706" },
  { id: "lime", label: "ライム", fill: "#65a30d" },
  { id: "teal", label: "ティール", fill: "#0d9488" },
  { id: "ocean", label: "ブルー", fill: "#2563eb" },
  { id: "violet", label: "バイオレット", fill: "#7c3aed" },
  { id: "slate", label: "スレート", fill: "#475569" },
];

function tplById(id: ColorId): ColorTemplate {
  return COLOR_TEMPLATES.find((t) => t.id === id) ?? COLOR_TEMPLATES[0];
}

function isColorId(v: unknown): v is ColorId {
  return typeof v === "string" && COLOR_TEMPLATES.some((t) => t.id === v);
}

/** テンプレ色の数＝同時に並べられる参加者の上限（色の重複なし） */
const COLOR_SLOT_COUNT = COLOR_TEMPLATES.length;

/** 指定した index 以外が使っている colorId の集合 */
function usedColorIdsExcludingMember(excludeMemberIndex?: number): Set<ColorId> {
  const s = new Set<ColorId>();
  members.forEach((m, i) => {
    if (typeof excludeMemberIndex === "number" && i === excludeMemberIndex) return;
    s.add(m.colorId);
  });
  return s;
}

function ensureSelectedForAdd(): void {
  const used = usedColorIdsExcludingMember();
  if (!used.has(selectedColorId)) return;
  const t = COLOR_TEMPLATES.find((c) => !used.has(c.id));
  if (t) selectedColorId = t.id;
}

/** 他の人と被らない次の色（自分だけ除いて探索） */
function nextAllowedColorId(currentId: ColorId, memberIndex: number): ColorId {
  const forbidden = usedColorIdsExcludingMember(memberIndex);
  const start = COLOR_TEMPLATES.findIndex((t) => t.id === currentId);
  for (let step = 1; step <= COLOR_TEMPLATES.length; step++) {
    const idx = (Math.max(0, start) + step) % COLOR_TEMPLATES.length;
    const id = COLOR_TEMPLATES[idx].id;
    if (!forbidden.has(id)) return id;
  }
  return currentId;
}

/** 保存データなどで色が重複している場合、先頭から順に空きテンプレへ振り直す */
function dedupeMemberColors(list: Member[]): void {
  const used = new Set<ColorId>();
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

async function dedupeAfterLoad(): Promise<void> {
  if (members.length > COLOR_SLOT_COUNT) members.splice(COLOR_SLOT_COUNT);
  dedupeMemberColors(members);
  presets.forEach((p) => {
    if (p.members.length > COLOR_SLOT_COUNT) p.members.splice(COLOR_SLOT_COUNT);
    dedupeMemberColors(p.members);
  });
  await saveState();
}

const canvas = $<HTMLCanvasElement>("wheel");
const ctx = ensure(canvas.getContext("2d"), "2d context not available");
const nameListEl = $<HTMLUListElement>("nameList");
const nameInput = $<HTMLInputElement>("nameInput");
const addForm = $<HTMLFormElement>("addForm");
const addBtn = ensure(
  addForm.querySelector<HTMLButtonElement>('button[type="submit"]'),
  "addForm submit button not found"
);
const spinBtn = $<HTMLButtonElement>("spinBtn");
const clearBtn = $<HTMLButtonElement>("clearBtn");
const resultEl = $<HTMLDivElement>("result");
const tplBar = $<HTMLDivElement>("tplBar");
const presetSelect = $<HTMLSelectElement>("presetSelect");
const presetTitleInput = $<HTMLInputElement>("presetTitleInput");
const savePresetBtn = $<HTMLButtonElement>("savePresetBtn");
const deletePresetBtn = $<HTMLButtonElement>("deletePresetBtn");
const winnerHistoryEl = $<HTMLDivElement>("winnerHistory");
const winnerCountsEl = $<HTMLDivElement>("winnerCounts");
const sim100Btn = $<HTMLButtonElement>("sim100Btn");
const sim100Output = $<HTMLPreElement>("sim100Output");
const testPanel = $<HTMLElement>("testPanel");
const toggleTestPanelBtn = $<HTMLButtonElement>("toggleTestPanelBtn");
const TEST_PANEL_LS_KEY = "extension-cord-roulette-ui-test-visible";

function applyTestPanelVisibility(): void {
  const show = localStorage.getItem(TEST_PANEL_LS_KEY) === "1";
  testPanel.classList.toggle("is-hidden", !show);
  toggleTestPanelBtn.textContent = show ? "テスト用を隠す" : "テスト用を表示";
  toggleTestPanelBtn.setAttribute("aria-expanded", show ? "true" : "false");
}

let members: Member[] = [];
let presets: Preset[] = [];
let selectedColorId: ColorId = COLOR_TEMPLATES[0].id;
let rotation = 0;
let spinning = false;
let animId: number | null = null;

let winnerHistory: WinnerEntry[] = [];

function historyApiPath(): string {
  const pid = presetSelect.value;
  if (pid) return `/api/history?presetId=${encodeURIComponent(pid)}`;
  return "/api/history";
}

function spinApiPath(): string {
  const pid = presetSelect.value;
  if (pid) return `/api/spin?presetId=${encodeURIComponent(pid)}`;
  return "/api/spin";
}

function formatHistoryDateHeading(ymd: string): string {
  const parts = ymd.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return ymd;
  const [y, mo, da] = parts as [number, number, number];
  const w = ["日", "月", "火", "水", "木", "金", "土"][new Date(y, mo - 1, da).getDay()];
  return `${y}年${mo}月${da}日（${w}）`;
}

function isWinnerEntry(e: unknown): e is WinnerEntry {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.date === "string" &&
    typeof o.name === "string" &&
    typeof o.at === "number"
  );
}

async function loadWinnerHistory(): Promise<void> {
  winnerHistory = [];
  if (!presetSelect.value) return;
  try {
    const o = await apiGet<HistoryResponse>(historyApiPath());
    if (o && Array.isArray(o.entries)) {
      winnerHistory = o.entries.filter(isWinnerEntry);
    }
  } catch {
    winnerHistory = [];
  }
}

function renderWinnerHistory(): void {
  winnerHistoryEl.innerHTML = "";
  if (!presetSelect.value) {
    renderWinnerCounts();
    return;
  }
  if (winnerHistory.length === 0) {
    const p = document.createElement("p");
    p.className = "history-empty";
    p.textContent = "この保存メンバー（セット）にはまだ記録がありません";
    winnerHistoryEl.appendChild(p);
    renderWinnerCounts();
    return;
  }
  const sorted = [...winnerHistory].sort((a, b) => b.at - a.at);
  const byDate = new Map<string, WinnerEntry[]>();
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
      del.textContent = "削除";
      del.setAttribute("aria-label", `${e.name} ${timeStr} の記録を削除`);
      del.disabled = spinning;
      del.addEventListener("click", async () => {
        if (spinning) return;
        if (!confirm("この当選記録を削除しますか？")) return;
        try {
          await apiDelete(`/api/history/${encodeURIComponent(String(e.at))}`);
          await loadWinnerHistory();
          renderWinnerHistory();
        } catch {
          alert("削除に失敗しました。");
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

function renderWinnerCounts(): void {
  winnerCountsEl.innerHTML = "";
  if (!presetSelect.value) return;
  const counts = new Map<string, number>();
  for (const e of winnerHistory) {
    counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  }
  if (counts.size === 0) {
    const p = document.createElement("p");
    p.className = "history-empty";
    p.textContent = "この保存メンバー（セット）にはまだ記録がありません";
    winnerCountsEl.appendChild(p);
    return;
  }
  const rows = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja")
  );
  const ol = document.createElement("ol");
  ol.className = "ranking-list";
  let rank = 0;
  let prevCount: number | null = null;
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
    rankEl.textContent = `${rank}位`;
    const nameEl = document.createElement("span");
    nameEl.className = "ranking-name";
    nameEl.textContent = name;
    const countEl = document.createElement("span");
    countEl.className = "ranking-count";
    countEl.textContent = `${n}回`;
    li.appendChild(rankEl);
    li.appendChild(nameEl);
    li.appendChild(countEl);
    ol.appendChild(li);
  });
  winnerCountsEl.appendChild(ol);
}

function cloneMembers(list: Member[]): Member[] {
  return list.map((m) => ({ name: m.name, colorId: m.colorId }));
}

function normalizeMemberRow(raw: unknown, index: number): Member | null {
  if (typeof raw === "string") {
    const name = raw.trim();
    return name ? { name, colorId: COLOR_TEMPLATES[index % COLOR_TEMPLATES.length].id } : null;
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const name = String(obj.name ?? "").trim();
    if (!name) return null;
    const colorId: ColorId = isColorId(obj.colorId) ? obj.colorId : COLOR_TEMPLATES[0].id;
    return { name, colorId };
  }
  return null;
}

function normalizeMembers(arr: unknown): Member[] {
  if (!Array.isArray(arr)) return [];
  const out: Member[] = [];
  arr.forEach((row, i) => {
    const m = normalizeMemberRow(row, i);
    if (m) out.push(m);
  });
  return out;
}

async function loadState(): Promise<void> {
  members = [];
  presets = [];
  try {
    const o = await apiGet<StateResponse>("/api/state");
    if (o && typeof o === "object") {
      members = normalizeMembers(o.members);
      if (Array.isArray(o.presets)) {
        presets = o.presets
          .filter((p): p is Record<string, unknown> => {
            if (!p || typeof p !== "object") return false;
            const obj = p as Record<string, unknown>;
            return (
              !!String(obj.title ?? "").trim() && Array.isArray(obj.members)
            );
          })
          .map((p) => ({
            id: String(p.id ?? Date.now().toString(36)),
            title: String(p.title).trim(),
            members: normalizeMembers(p.members),
          }));
      }
    }
  } catch {
    members = [];
    presets = [];
  }
}

async function saveState(): Promise<void> {
  await apiPut("/api/state", { members, presets });
}

function refreshTplBar(): void {
  ensureSelectedForAdd();
  tplBar.innerHTML = "";
  const taken = usedColorIdsExcludingMember();
  COLOR_TEMPLATES.forEach((t) => {
    const isTaken = taken.has(t.id);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tpl-btn";
    b.style.background = t.fill;
    b.title = isTaken ? `${t.label}（他の参加者が使用中）` : t.label;
    b.setAttribute("aria-label", t.label);
    b.dataset.colorId = t.id;
    b.disabled = isTaken;
    b.setAttribute("aria-pressed", !isTaken && t.id === selectedColorId ? "true" : "false");
    b.addEventListener("click", () => {
      if (b.disabled) return;
      selectedColorId = t.id;
      tplBar.querySelectorAll<HTMLButtonElement>(".tpl-btn").forEach((btn) => {
        btn.setAttribute(
          "aria-pressed",
          btn.dataset.colorId === selectedColorId ? "true" : "false"
        );
      });
    });
    tplBar.appendChild(b);
  });
}

function refreshPresetSelect(): void {
  const prev = presetSelect.value;
  presetSelect.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "— 読み込むセットを選択 —";
  presetSelect.appendChild(opt0);
  presets.forEach((p) => {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = `${p.title}（${p.members.length}人）`;
    presetSelect.appendChild(o);
  });
  if (presets.some((p) => p.id === prev)) presetSelect.value = prev;
  deletePresetBtn.disabled = !presetSelect.value || spinning;
}

function drawWheel(): void {
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
    ctx.fillText("チームが選択されていません", 0, 0);
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

  const slice = (Math.PI * 2) / n;
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
    const fontSize = Math.max(12 * dpr, (r / n) * 0.35 * dpr);
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

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function renderList(): void {
  nameListEl.innerHTML = "";
  members.forEach((m, i) => {
    const li = document.createElement("li");
    const main = document.createElement("div");
    main.className = "li-main";
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "li-swatch";
    sw.style.background = tplById(m.colorId).fill;
    sw.title = `${tplById(m.colorId).label}（クリックで別の空き色へ）`;
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
    rm.textContent = "削除";
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

const SIM_RUNS = 100;

function runSim100(): void {
  const n = members.length;
  if (n < 2) {
    sim100Output.textContent = "参加者が2人以上いるときに使えます。";
    return;
  }
  const counts = new Array<number>(n).fill(0);
  for (let i = 0; i < SIM_RUNS; i++) {
    counts[randInt(n)] += 1;
  }
  const lines = members.map((m, i) => `${m.name}: ${counts[i]}回`);
  sim100Output.textContent = `${SIM_RUNS}回の抽選結果（各インデックスに randInt(${n}) が何回当たったか）\n\n${lines.join("\n")}`;
}

function updateSpinState(): void {
  const presetOk = Boolean(presetSelect.value);
  spinBtn.disabled = spinning || members.length < 2 || !presetOk;
  spinBtn.title =
    !presetOk && members.length >= 2 ? "「保存したメンバー」でセットを選んでから回してください" : "";
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

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function mod2pi(x: number): number {
  return ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

/** 針（上・-π/2）の下にある扇形の index。描画と同じ扇形分割に合わせる。 */
function indexUnderPointer(R: number, n: number): number {
  const slice = (Math.PI * 2) / n;
  const u = mod2pi(-R);
  if (u >= Math.PI * 2 - 1e-9) return 0;
  return Math.min(n - 1, Math.max(0, Math.floor(u / slice)));
}

/** 0 以上 n 未満の整数を一様ランダム（多くの言語の rand(n) に相当） */
function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

/**
 * 当選者を先に決めたうえで、針がその人の扇の中心に来る終了角（累積 rad）を返す。
 * fullTurns は何周分回すか（2π の整数倍でなくてよい）。
 */
function computeTargetRotationForWinner(
  winnerIndex: number,
  startRotation: number,
  fullTurns: number,
  n: number
): number {
  const slice = (Math.PI * 2) / n;
  const uCenter = (winnerIndex + 0.5) * slice;
  const REndMod = mod2pi(-uCenter);
  const d = mod2pi(REndMod - mod2pi(startRotation + fullTurns));
  return startRotation + fullTurns + d;
}

async function spin(): Promise<void> {
  if (spinning || members.length < 2 || !presetSelect.value) return;
  spinning = true;
  spinBtn.disabled = true;
  deletePresetBtn.disabled = true;
  resultEl.textContent = "回転中…";
  resultEl.className = "result";
  renderWinnerHistory();

  const n = members.length;

  let winnerIndex: number;
  try {
    await saveState();
    const data = await apiPost<SpinResponse>(spinApiPath());
    winnerIndex = data.winner_index;
    if (typeof winnerIndex !== "number" || winnerIndex < 0 || winnerIndex >= n) {
      throw new Error("invalid winner_index");
    }
  } catch {
    spinning = false;
    resultEl.textContent =
      "サーバーとの通信に失敗しました。ターミナルで rackup が動いているか確認してください。";
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

  function frame(now: number): void {
    const t = Math.min(1, (now - start) / duration);
    const e = easeOutCubic(t);
    rotation = startRotation + (targetRotation - startRotation) * e;
    drawWheel();
    if (t < 1) {
      animId = requestAnimationFrame(frame);
    } else {
      rotation = targetRotation;
      if (indexUnderPointer(rotation, n) !== winnerIndex) {
        const slice = (Math.PI * 2) / n;
        const uCenter = (winnerIndex + 0.5) * slice;
        rotation = -uCenter + 2 * Math.PI * Math.round((rotation + uCenter) / (2 * Math.PI));
      }
      drawWheel();
      spinning = false;
      const name = members[winnerIndex].name;
      resultEl.innerHTML = `担当は<span style="font-size:1.35em">${escapeHtml(name)}</span> さん！`;
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

function escapeHtml(s: string): string {
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
    alert("セット名を入力してください。");
    return;
  }
  if (members.length === 0) {
    alert("保存するメンバーがいません。");
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
  if (!confirm(`「${p.title}」を削除しますか？`)) return;
  presets = presets.filter((x) => x.id !== id);
  presetSelect.value = "";
  void saveState();
  refreshPresetSelect();
  updateSpinState();
  drawWheel();
  void loadWinnerHistory().then(() => renderWinnerHistory());
});

let resizeTimer: number | undefined;
window.addEventListener("resize", () => {
  if (resizeTimer !== undefined) clearTimeout(resizeTimer);
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
    resultEl.textContent =
      "データの読み込みに失敗しました。bundle exec rackup でサーバーを起動してください。";
    resultEl.className = "result empty";
  }
})();
