import type { ApiError, ApiOk } from "../../../src/shared/types";
import {
  jsonResponse,
  readHistory,
  writeHistory,
  type Env,
} from "../../_lib/state";

export const onRequestDelete: PagesFunction<Env, "at"> = async ({
  env,
  params,
}) => {
  const at = Number.parseInt(String(params.at), 10);
  if (!Number.isFinite(at) || at <= 0) {
    return jsonResponse({ error: "invalid at" } satisfies ApiError, {
      status: 400,
    });
  }

  const { entries } = await readHistory(env);
  const before = entries.length;
  const next = entries.filter((e) => Number(e.at) !== at);
  if (next.length === before) {
    return jsonResponse({ error: "not found" } satisfies ApiError, {
      status: 404,
    });
  }

  await writeHistory(env, { entries: next });
  return jsonResponse({ ok: true } satisfies ApiOk);
};
