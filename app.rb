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

  # 旧チーム形式 state.json を単一 members/presets に戻す（先頭チームのみ残す）
  def flatten_state_if_teams(raw)
    return raw unless raw.is_a?(Hash) && raw["teams"].is_a?(Array) && !raw["teams"].empty?

    t = raw["teams"].first
    {
      "members" => (t["members"].is_a?(Array) ? t["members"] : []),
      "presets" => (t["presets"].is_a?(Array) ? t["presets"] : [])
    }
  end
end

get "/" do
  erb :index
end

get "/api/state" do
  content_type :json
  raw = read_json(STATE_PATH, { "members" => [], "presets" => [] })
  had_teams = raw.is_a?(Hash) && raw["teams"].is_a?(Array) && !raw["teams"].empty?
  flat = flatten_state_if_teams(raw)
  write_json(STATE_PATH, flat) if had_teams
  flat.to_json
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
  hist = read_json(HISTORY_PATH, { "entries" => [] })
  entries = hist["entries"] || []
  pid = params["presetId"] || params[:presetId]
  if pid && !pid.to_s.strip.empty?
    want = pid.to_s.strip
    entries = entries.select { |e| e.is_a?(Hash) && e["presetId"].to_s == want }
  end
  { "entries" => entries }.to_json
end

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
  raw = read_json(STATE_PATH, { "members" => [], "presets" => [] })
  had_teams = raw.is_a?(Hash) && raw["teams"].is_a?(Array) && !raw["teams"].empty?
  state = flatten_state_if_teams(raw)
  write_json(STATE_PATH, state) if had_teams

  members = state["members"] || []
  halt 400, { "error" => "need 2 or more members" }.to_json if members.size < 2

  winner_index = rand(members.size)
  name = members[winner_index]["name"].to_s.strip

  preset_id = (params["presetId"] || params[:presetId]).to_s.strip
  unless preset_id.empty?
    presets = state["presets"] || []
    ok = presets.any? { |p| p.is_a?(Hash) && p["id"].to_s == preset_id }
    halt 400, { "error" => "invalid presetId" }.to_json unless ok
  end

  hist = read_json(HISTORY_PATH, { "entries" => [] })
  entries = hist["entries"] || []
  row = {
    "date" => Date.today.strftime("%Y-%m-%d"),
    "name" => name,
    "at" => (Time.now.to_f * 1000).to_i
  }
  row["presetId"] = preset_id unless preset_id.empty?
  entries.unshift(row)
  entries = entries.first(MAX_HISTORY_ENTRIES)
  write_json(HISTORY_PATH, { "entries" => entries })

  { "winner_index" => winner_index, "winner_name" => name }.to_json
end
