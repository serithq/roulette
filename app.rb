# frozen_string_literal: true

require "json"
require "fileutils"
require "date"
require "time"
require "sinatra"

set :public_folder, File.join(__dir__, "public")
set :views, File.join(__dir__, "views")

DATA_DIR = File.join(__dir__, "data")
STATE_PATH = File.join(DATA_DIR, "state.json")
HISTORY_PATH = File.join(DATA_DIR, "winner_history.json")
MAX_HISTORY_ENTRIES = 500

helpers do
  def read_json(path, default)
    return JSON.parse(JSON.generate(default)) unless File.exist?(path)

    JSON.parse(File.read(path, encoding: "UTF-8"))
  rescue JSON::ParserError
    JSON.parse(JSON.generate(default))
  end

  def write_json(path, obj)
    FileUtils.mkdir_p(DATA_DIR)
    File.write(path, JSON.generate(obj), encoding: "UTF-8")
  end
end

get "/" do
  erb :index
end

get "/api/state" do
  content_type :json
  default = { "members" => [], "presets" => [] }
  read_json(STATE_PATH, default).to_json
end

put "/api/state" do
  content_type :json
  payload = JSON.parse(request.body.read, symbolize_names: false)
  members = payload["members"].is_a?(Array) ? payload["members"] : []
  presets = payload["presets"].is_a?(Array) ? payload["presets"] : []
  write_json(STATE_PATH, { "members" => members, "presets" => presets })
  { "ok" => true }.to_json
rescue JSON::ParserError
  halt 400, { "error" => "invalid json" }.to_json
end

get "/api/history" do
  content_type :json
  read_json(HISTORY_PATH, { "entries" => [] }).to_json
end

# 当選履歴の1件を削除（:at は記録のミリ秒タイムスタンプで一意に特定）
delete "/api/history/:at" do
  content_type :json
  at = params[:at].to_i
  halt 400, { "error" => "invalid at" }.to_json if at <= 0

  hist = read_json(HISTORY_PATH, { "entries" => [] })
  entries = hist["entries"] || []
  before = entries.size
  entries.reject! { |e| e.is_a?(Hash) && e["at"].to_i == at }
  halt 404, { "error" => "not found" }.to_json if entries.size == before

  write_json(HISTORY_PATH, { "entries" => entries })
  { "ok" => true }.to_json
end

# サーバー側で保存済みの参加者一覧から当選 index を決定（Ruby の rand）
post "/api/spin" do
  content_type :json
  state = read_json(STATE_PATH, { "members" => [], "presets" => [] })
  members = state["members"] || []
  halt 400, { "error" => "need 2 or more members" }.to_json if members.size < 2

  winner_index = rand(members.size)
  name = members[winner_index]["name"].to_s.strip

  hist = read_json(HISTORY_PATH, { "entries" => [] })
  entries = hist["entries"] || []
  entries.unshift(
    "date" => Date.today.strftime("%Y-%m-%d"),
    "name" => name,
    "at" => (Time.now.to_f * 1000).to_i
  )
  entries = entries.first(MAX_HISTORY_ENTRIES)
  write_json(HISTORY_PATH, { "entries" => entries })

  { "winner_index" => winner_index, "winner_name" => name }.to_json
end
