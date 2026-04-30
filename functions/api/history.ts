import type { HistoryValue } from "../../src/shared/types";
import { jsonResponse, readHistory, type Env } from "../_lib/state";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const pidRaw = url.searchParams.get("presetId");
  const pid = pidRaw ? pidRaw.trim() : "";

  const { entries } = await readHistory(env);
  const filtered = pid ? entries.filter((e) => e.presetId === pid) : entries;
  return jsonResponse({ entries: filtered } satisfies HistoryValue);
};
