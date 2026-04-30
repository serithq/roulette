import {
  MAX_HISTORY_ENTRIES,
  type ApiError,
  type SpinResponse,
  type WinnerEntry,
} from "../../src/shared/types";
import {
  formatDateJst,
  jsonResponse,
  readHistory,
  readState,
  unbiasedRandInt,
  writeHistory,
  type Env,
} from "../_lib/state";

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const presetIdRaw = url.searchParams.get("presetId");
  const presetId = presetIdRaw ? presetIdRaw.trim() : "";

  const state = await readState(env);
  if (state.members.length < 2) {
    return jsonResponse(
      { error: "need 2 or more members" } satisfies ApiError,
      { status: 400 }
    );
  }

  if (presetId) {
    const ok = state.presets.some((p) => p.id === presetId);
    if (!ok) {
      return jsonResponse(
        { error: "invalid presetId" } satisfies ApiError,
        { status: 400 }
      );
    }
  }

  const winnerIndex = unbiasedRandInt(state.members.length);
  const name = state.members[winnerIndex]!.name.trim();

  const { entries } = await readHistory(env);
  const row: WinnerEntry = {
    date: formatDateJst(new Date()),
    name,
    at: Date.now(),
  };
  if (presetId) row.presetId = presetId;

  const nextEntries = [row, ...entries].slice(0, MAX_HISTORY_ENTRIES);
  await writeHistory(env, { entries: nextEntries });

  return jsonResponse({
    winner_index: winnerIndex,
    winner_name: name,
  } satisfies SpinResponse);
};
