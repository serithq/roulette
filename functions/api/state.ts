import type { ApiError, ApiOk, StateValue } from "../../src/shared/types";
import {
  flattenStateIfTeams,
  jsonResponse,
  writeState,
  type Env,
} from "../_lib/state";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const raw = await env.ROULETTE_KV.get("state", "json");
  const hadTeams =
    !!raw &&
    typeof raw === "object" &&
    Array.isArray((raw as { teams?: unknown }).teams) &&
    (raw as { teams: unknown[] }).teams.length > 0;

  const flat = flattenStateIfTeams(raw);
  if (hadTeams) {
    await writeState(env, flat);
  }
  return jsonResponse(flat satisfies StateValue);
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "invalid json" } satisfies ApiError, {
      status: 400,
    });
  }

  const flat = flattenStateIfTeams(payload);
  await writeState(env, flat);
  return jsonResponse({ ok: true } satisfies ApiOk);
};
