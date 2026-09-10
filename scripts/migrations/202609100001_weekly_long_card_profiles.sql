-- Private long-card roster data. This table is deliberately not referenced by
-- public weekly pages or results APIs.
CREATE TABLE IF NOT EXISTS weekly_long_card_profiles (
  source_row_number INTEGER PRIMARY KEY,
  source_file TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT '',
  birth_date TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  contact_relationship TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT '',
  source_notes TEXT NOT NULL DEFAULT '',
  matched_player_id TEXT REFERENCES weekly_player_library(id) ON UPDATE CASCADE ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_long_card_profiles_matched_player_idx
  ON weekly_long_card_profiles (matched_player_id, submitted_at DESC, source_row_number DESC);

CREATE INDEX IF NOT EXISTS weekly_long_card_profiles_name_idx
  ON weekly_long_card_profiles (student_name);
