// 既存の data/state.json と data/winner_history.json を Cloudflare KV に流し込むスクリプト。
//
// Usage:
//   node scripts/seed-kv.mjs --remote   ← 本番 Cloudflare KV へ投入（要ログイン）
//   node scripts/seed-kv.mjs --local    ← ローカル wrangler 状態へ投入
//
// 注意: --local は `wrangler kv key put --local` と同じ場所に書き込むため、
//       `wrangler pages dev` のローカル KV と置き場所が必ずしも一致しない場合があります。
//       どうしても揃わないときは `wrangler pages dev` を起動した状態で
//       `curl -X PUT http://localhost:8788/api/state -H 'content-type: application/json' -d @data/state.json`
//       のように API 経由で投入してください。
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const STATE_PATH = resolve(ROOT, "data/state.json");
const HISTORY_PATH = resolve(ROOT, "data/winner_history.json");

const args = process.argv.slice(2);
const isLocal = args.includes("--local");
const isRemote = args.includes("--remote");

if (!isLocal && !isRemote) {
  console.error("Usage: node scripts/seed-kv.mjs (--local | --remote)");
  process.exit(1);
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function flatten(raw) {
  if (
    raw &&
    typeof raw === "object" &&
    Array.isArray(raw.teams) &&
    raw.teams.length > 0
  ) {
    const t = raw.teams[0] ?? {};
    return {
      members: Array.isArray(t.members) ? t.members : [],
      presets: Array.isArray(t.presets) ? t.presets : [],
    };
  }
  return {
    members: Array.isArray(raw?.members) ? raw.members : [],
    presets: Array.isArray(raw?.presets) ? raw.presets : [],
  };
}

const state = flatten(readJson(STATE_PATH, {}));
const history = readJson(HISTORY_PATH, { entries: [] });

const flag = isRemote ? "--remote" : "--local";
// remote 時、wrangler.toml に id と preview_id 両方あると「どっち？」と曖昧エラーになるため
// 本番ネームスペース（id 側）を明示する。
const previewArgs = isRemote ? ["--preview", "false"] : [];
const tmp = mkdtempSync(join(tmpdir(), "roulette-seed-"));

function putKvFromFile(key, path) {
  console.log(
    `> wrangler kv key put ${flag} ${previewArgs.join(" ")} --binding=ROULETTE_KV ${key}`
  );
  execFileSync(
    "npx",
    [
      "wrangler",
      "kv",
      "key",
      "put",
      flag,
      ...previewArgs,
      "--binding=ROULETTE_KV",
      key,
      "--path",
      path,
    ],
    { stdio: "inherit", cwd: ROOT }
  );
}

try {
  const sp = join(tmp, "state.json");
  const hp = join(tmp, "history.json");
  writeFileSync(sp, JSON.stringify(state));
  writeFileSync(hp, JSON.stringify(history));

  putKvFromFile("state", sp);
  putKvFromFile("history", hp);
  console.log("Done.");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
