# 延長コードルーレット（TypeScript フロント）

ブラウザ用の UI は **TypeScript**（`src/app.ts` → esbuild → `public/app.js`）。
バックエンドは現在、**2系統並行運用中** です：

- **A. Ruby / Sinatra**（既存。ファイル保存）
- **B. Cloudflare Pages + Pages Functions + KV**（移行中）

最終的には B に寄せる予定です。

## 必要なもの

- Node.js 18 以降
- Ruby 3.2 以降（A. を使う場合のみ）

## セットアップ

```bash
cd /path/to/roulette
npm install
bundle install     # A. を使う場合のみ
```

## A. Ruby / Sinatra で動かす（既存）

```bash
npm run build
bundle exec rackup -p 9292
```

ブラウザで **http://localhost:9292**

データ保存先：

- `data/state.json` … 参加者・プリセット
- `data/winner_history.json` … 当選履歴（最大500件）

## B. Cloudflare Pages Functions + KV で動かす

### ローカル開発

```bash
npm run pages:dev
```

これで `npm run build` してから `wrangler pages dev` が立ち上がるよ。
ブラウザで **http://127.0.0.1:8788**

ローカル KV は Miniflare 上で `.wrangler/` 配下にエミュレートされます。
最初は空なので、UI で参加者を追加するか、または下記の方法で既存データを投入してください：

```bash
# ローカル wrangler dev サーバーを起動した状態で、別ターミナルから：
curl -X PUT http://127.0.0.1:8788/api/state \
  -H 'content-type: application/json' \
  --data-binary @data/state.json
```

### 本番デプロイ手順（Cloudflare アカウントが必要）

1. **wrangler にログイン**
   ```bash
   npx wrangler login
   ```

2. **KV ネームスペースを作成**
   ```bash
   npx wrangler kv namespace create ROULETTE_KV
   npx wrangler kv namespace create ROULETTE_KV --preview
   ```
   出力された `id` と `preview_id` を `wrangler.toml` の `[[kv_namespaces]]` セクションに反映してください。

3. **既存データを KV に投入（必要なら）**
   ```bash
   npm run kv:seed:remote
   ```
   `data/state.json` と `data/winner_history.json` を `state` / `history` キーに書き込みます。

4. **デプロイ**
   ```bash
   npm run pages:deploy
   ```

## フロント開発（共通）

```bash
npm run dev          # esbuild --watch で public/app.js を自動再生成
npm run typecheck    # クライアント・Functions 両方の型チェック
```

## ディレクトリ構成

```
roulette/
├─ src/
│   ├─ app.ts            … クライアント TS（フロント本体）
│   └─ shared/types.ts   … クライアント・Functions 共通の型
├─ functions/            … Cloudflare Pages Functions
│   ├─ _lib/state.ts     … KV 読み書き、抽選乱数などのヘルパー
│   └─ api/
│       ├─ state.ts      … GET/PUT  /api/state
│       ├─ history.ts    … GET      /api/history
│       ├─ history/[at].ts … DELETE /api/history/:at
│       └─ spin.ts       … POST    /api/spin
├─ public/               … 静的アセット（index.html, styles.css, app.js[ビルド成果物]）
├─ scripts/seed-kv.mjs   … 既存 data/*.json を KV へ投入
├─ wrangler.toml         … Cloudflare 設定（KV バインディング）
├─ tsconfig.json         … クライアント用（DOM）
├─ tsconfig.functions.json … Functions 用（Workers types）
├─ app.rb / config.ru / Gemfile / Procfile / render.yaml … A. 系（Sinatra）
└─ data/                 … A. 系のローカル保存場所
```

## 仕様メモ

- 抽選は **保存メンバーのセット選択が必須**。未選択時は履歴・ランキングを表示しません。
- 当選履歴は最大500件。古いものから自動で切り捨てられます。
- 色は最大8色（テンプレート色の数）まで、参加者間で重複なしに割り当てられます。
- A.（Sinatra）の抽選は Ruby の `rand`、B.（Cloudflare）の抽選は `crypto.getRandomValues` をモジュロバイアス回避で使用。
