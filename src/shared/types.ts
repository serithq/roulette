export type ColorId =
  | "ruby"
  | "orange"
  | "amber"
  | "lime"
  | "teal"
  | "ocean"
  | "violet"
  | "slate";

export type Member = {
  name: string;
  colorId: ColorId;
};

export type Preset = {
  id: string;
  title: string;
  members: Member[];
};

export type WinnerEntry = {
  date: string;
  name: string;
  at: number;
  presetId?: string;
};

export type StateValue = {
  members: Member[];
  presets: Preset[];
};

export type HistoryValue = {
  entries: WinnerEntry[];
};

export type SpinResponse = {
  winner_index: number;
  winner_name: string;
};

export type ApiError = {
  error: string;
};

export type ApiOk = {
  ok: true;
};

/** 履歴の上限件数（古いものから切り捨て） */
export const MAX_HISTORY_ENTRIES = 500;
