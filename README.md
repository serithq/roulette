# 延長コードルーレット（Ruby / Sinatra + TypeScript）

ブラウザ用の UI は **TypeScript**（`src/app.ts` → esbuild → `public/app.js`）、
`rand` による抽選・当選履歴・参加者データの保存は **Ruby（Sinatra）** が行います。

## 必要なもの

- Ruby 3.2 以降
- Node.js 18 以降（フロントのビルドに使用）

## セットアップ

```bash
cd /path/to/roulette
bundle install
npm install
```

## 起動

```bash
npm run build               # フロントを一度ビルド（public/app.js を生成）
bundle exec rackup -p 9292
```

ブラウザで **http://localhost:9292** を開いてください。

## フロント開発（TypeScript）

ファイル保存ごとに自動ビルドしたいときは、別ターミナルで：

```bash
npm run dev                 # esbuild --watch で public/app.js を再生成
```

型チェックだけ走らせたいときは：

```bash
npm run typecheck           # tsc --noEmit
```

ソースは `src/app.ts` に集約。`public/app.js`（と `.map`）はビルド成果物です（現状はリポジトリにコミットしています）。

## ディレクトリ

- `src/app.ts` … フロントのソース（TypeScript）
- `public/index.html` … 静的なトップページ
- `public/styles.css` … スタイル
- `public/app.js` … ビルド成果物（自動生成、手で編集しない）
- `app.rb` / `config.ru` … Sinatra のサーバー
- `data/state.json` … 参加者・プリセット
- `data/winner_history.json` … 当選履歴（最大500件）

## 仕様メモ

保存メンバー（プリセット）から回した分は `presetId` が付き、画面では **保存したメンバーでセットを選んだときだけ** そのセットの履歴・ランキングを表示します（未選択時は履歴エリアは空）。**ルーレットも同じくセット選択が必須**です。
