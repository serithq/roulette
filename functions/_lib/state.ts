import type {
  HistoryValue,
  Member,
  Preset,
  StateValue,
  WinnerEntry,
} from "../../src/shared/types";

export interface Env {
  ROULETTE_KV: KVNamespace;
}

export const KV_KEY_STATE = "state";
export const KV_KEY_HISTORY = "history";

const VALID_COLOR_IDS = new Set<string>([
  "ruby",
  "orange",
  "amber",
  "lime",
  "teal",
  "ocean",
  "violet",
  "slate",
]);

/**
 * 旧チーム形式 `{ teams: [{ members, presets }] }` の state を、
 * 単一 `{ members, presets }` 形式へフラット化する（先頭チームのみ残す）。
 */
export function flattenStateIfTeams(raw: unknown): StateValue {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.teams) && obj.teams.length > 0) {
      const t = obj.teams[0] as Record<string, unknown> | undefined;
      return {
        members: normalizeMembers(t?.members),
        presets: normalizePresets(t?.presets),
      };
    }
    return {
      members: normalizeMembers(obj.members),
      presets: normalizePresets(obj.presets),
    };
  }
  return { members: [], presets: [] };
}

function normalizeMembers(raw: unknown): Member[] {
  if (!Array.isArray(raw)) return [];
  const out: Member[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? "").trim();
    if (!name) continue;
    const colorId =
      typeof r.colorId === "string" && VALID_COLOR_IDS.has(r.colorId)
        ? (r.colorId as Member["colorId"])
        : "ruby";
    out.push({ name, colorId });
  }
  return out;
}

function normalizePresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return [];
  const out: Preset[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const title = String(r.title ?? "").trim();
    if (!title) continue;
    const id = String(r.id ?? "");
    if (!id) continue;
    out.push({ id, title, members: normalizeMembers(r.members) });
  }
  return out;
}

export async function readState(env: Env): Promise<StateValue> {
  const raw = await env.ROULETTE_KV.get(KV_KEY_STATE, "json");
  return flattenStateIfTeams(raw);
}

export async function writeState(env: Env, state: StateValue): Promise<void> {
  await env.ROULETTE_KV.put(KV_KEY_STATE, JSON.stringify(state));
}

export async function readHistory(env: Env): Promise<HistoryValue> {
  const raw = (await env.ROULETTE_KV.get(KV_KEY_HISTORY, "json")) as
    | { entries?: unknown }
    | null;
  const entries = Array.isArray(raw?.entries)
    ? (raw!.entries.filter(isWinnerEntry) as WinnerEntry[])
    : [];
  return { entries };
}

export async function writeHistory(
  env: Env,
  history: HistoryValue
): Promise<void> {
  await env.ROULETTE_KV.put(KV_KEY_HISTORY, JSON.stringify(history));
}

export function isWinnerEntry(v: unknown): v is WinnerEntry {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.date === "string" &&
    typeof e.name === "string" &&
    typeof e.at === "number"
  );
}

/**
 * 0 以上 n 未満の整数を一様ランダムに返す（暗号学的乱数 + モジュロバイアス回避）。
 * Ruby の `rand(n)` 相当のサーバ側実装。
 */
export function unbiasedRandInt(n: number): number {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("unbiasedRandInt: n must be a positive integer");
  }
  if (n === 1) return 0;
  const max = 0xffffffff;
  const limit = max - ((max + 1) % n);
  const buf = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    const r = buf[0]!;
    if (r <= limit) return r % n;
  }
}

/** YYYY-MM-DD を JST(Asia/Tokyo) 基準で返す。 */
export function formatDateJst(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

/** JSON レスポンスのショートカット。 */
export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}
