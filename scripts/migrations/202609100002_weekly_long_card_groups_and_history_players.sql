ALTER TABLE weekly_long_card_profiles
  ADD COLUMN IF NOT EXISTS wca_id TEXT NOT NULL DEFAULT '';

-- These eight players were resolved during the 2026 weekly-history import.
-- They are not rows from the original long-card workbook, so keep their own
-- source marker and append them after the imported rows.
WITH rows_to_add (student_name, matched_player_id) AS (
  VALUES
    ('丁俊森', 'weekly-player-ae77cb84-ac78-49bf-9946-dce5fbb8babb'),
    ('王一帆', 'weekly-player-6ec1d9d4-d414-4265-87d0-854be309a2b3'),
    ('陈祉行', 'weekly-player-783ca8c0-8d10-4bbf-a2c6-fae09ebfce2e'),
    ('吴一凡', 'weekly-player-7a43d57d-2da6-4378-bfe0-b300cc70d872'),
    ('孔子赫', 'weekly-player-c7643b6d-bccf-41c8-b549-652b98610766'),
    ('杨雯博', 'weekly-player-19cb6dac-2a6f-4b57-af33-f16317e80ae7'),
    ('蒋茗朗', 'weekly-player-a3af5db8-56af-4156-82c2-97c0677566f6'),
    ('李柏bo霖', 'weekly-player-f4c60479-f9a0-482c-a35c-f0fe8d2ceeb7')
), base AS (
  SELECT COALESCE(MAX(source_row_number), 0) AS source_row_number FROM weekly_long_card_profiles
)
INSERT INTO weekly_long_card_profiles
  (source_row_number, source_file, submitted_at, student_name, matched_player_id)
SELECT base.source_row_number + row_number() OVER (ORDER BY rows_to_add.student_name),
       'manual-history-resolution-2026-09-10',
       '2026-09-10',
       rows_to_add.student_name,
       rows_to_add.matched_player_id
  FROM rows_to_add CROSS JOIN base;
