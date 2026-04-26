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
- `data/winner_history.json` … 当選履歴（最大500件）。保存メンバー（プリセット）から回した分は `presetId` が付き、画面では **保存したメンバーでセットを選んだときだけ** そのセットの履歴・ランキングを表示します（未選択時は履歴エリアは空です）。**ルーレットも同じくセット選択が必須**です。