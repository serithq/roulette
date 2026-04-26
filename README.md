# 延長コードルーレット（Ruby / Sinatra）

ブラウザ用の UI はそのまま、`rand` による抽選・当選履歴・参加者データの保存は **Ruby（Sinatra）** が行います。

## 必要なもの

- Ruby 3.2 以降

## 起動

```bash
cd /path/to/roulette
bundle install
bundle exec rackup -p 9292
```

ブラウザで **http://localhost:9292** を開いてください。

## データの保存場所

- `data/state.json` … 参加者・プリセット
- `data/winner_history.json` … 当選履歴（最大500件）

## 公開例（[Render](https://render.com) + GitHub）

1. このリポジトリを GitHub に push する。  
2. Render にログイン → **New** → 次のいずれか。  
   - **Blueprint** → `render.yaml` を同リポジトリから取り込む。  
   - **Web Service** → 同じリポジトリを接続し、**Build** に `bundle install`、**Start** に `bundle exec rackup -o 0.0.0.0 -p $PORT`（`Procfile` があると `web` を自動検出する場合もあります）。  
3. 表示された `https://…onrender.com` を開く。

**注意:** 無料枠の多くは **ディスクが一時的** なので、再デプロイ等で `data/*.json` が消えたり空に戻ることがあります。遊び用 URL の共有程度なら問題になりにくいです。

## 以前の HTML だけの版から移行する場合

ブラウザの開発者ツールで `localStorage` に入っている `extension-cord-roulette-v2` の JSON をコピーし、`data/state.json` に貼り付ける形で移行できます（形式は `{ "members": [...], "presets": [...] }`）。
