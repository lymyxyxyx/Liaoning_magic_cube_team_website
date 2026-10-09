-- Preserve the existing registration-order numbers before making them editable.
ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS weekly_number INTEGER;
WITH names AS (
  SELECT name, min(id) AS id FROM weekly_player_library
  WHERE status='active' AND source IN ('players_excel_import','admin_manual')
  GROUP BY name HAVING count(*)=1
), cards AS (
  SELECT COALESCE(card.matched_player_id, names.id) AS player_id,
         row_number() OVER (ORDER BY card.source_row_number)::int AS number
  FROM weekly_long_card_profiles card LEFT JOIN names ON names.name=card.student_name
), assigned AS (
  SELECT player_id, max(number) AS number FROM cards WHERE player_id IS NOT NULL GROUP BY player_id
)
UPDATE weekly_player_library player SET weekly_number=assigned.number
FROM assigned WHERE player.id=assigned.player_id AND player.weekly_number IS NULL;
WITH base AS (
  SELECT greatest(COALESCE((SELECT max(weekly_number) FROM weekly_player_library),0),
                  (SELECT count(*)::int FROM weekly_long_card_profiles)) AS number
), remaining AS (
  SELECT id, row_number() OVER (ORDER BY created_at, name, id)::int AS offset
  FROM weekly_player_library WHERE weekly_number IS NULL AND source IN ('players_excel_import','admin_manual')
)
UPDATE weekly_player_library player SET weekly_number=base.number+remaining.offset
FROM base, remaining WHERE player.id=remaining.id;
ALTER TABLE weekly_player_library ADD CONSTRAINT weekly_player_number_positive CHECK (weekly_number IS NULL OR weekly_number BETWEEN 1 AND 999999);
CREATE UNIQUE INDEX weekly_player_library_number_unique ON weekly_player_library(weekly_number) WHERE weekly_number IS NOT NULL;
CREATE UNIQUE INDEX weekly_player_library_v2_wca_unique ON weekly_player_library(upper(wca_id))
  WHERE wca_id<>'' AND source IN ('players_excel_import','admin_manual');
CREATE SEQUENCE weekly_player_number_sequence;
SELECT setval('weekly_player_number_sequence', greatest(COALESCE(max(weekly_number),0),1), COALESCE(max(weekly_number),0)>0) FROM weekly_player_library;
CREATE FUNCTION allocate_weekly_player_number() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.weekly_number IS NULL AND NEW.source IN ('players_excel_import','admin_manual') THEN
    NEW.weekly_number := nextval('weekly_player_number_sequence');
    WHILE EXISTS (SELECT 1 FROM weekly_player_library WHERE weekly_number=NEW.weekly_number) LOOP
      NEW.weekly_number := nextval('weekly_player_number_sequence');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER weekly_player_number_allocate BEFORE INSERT ON weekly_player_library
  FOR EACH ROW EXECUTE FUNCTION allocate_weekly_player_number();
CREATE TABLE weekly_player_identity_revisions (
  id BIGSERIAL PRIMARY KEY, player_id TEXT NOT NULL,
  before_record JSONB NOT NULL, after_record JSONB NOT NULL,
  reason TEXT NOT NULL, actor TEXT NOT NULL DEFAULT 'weekly-admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX weekly_player_identity_history ON weekly_player_identity_revisions(player_id, created_at DESC);
