-- Run once, before the first v2 player import. At this point every existing
-- library row belongs to the preserved legacy archive. Keep every identity,
-- source, PB, and historical relationship intact; only exclude it from v2.
-- A fresh database has no rows, so this is naturally a no-op there.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM weekly_player_library
     WHERE status = 'active'
       AND source IN ('players_excel_import', 'admin_manual')
  ) THEN
    RAISE EXCEPTION
      'Refusing weekly player legacy archive migration: active weekly v2 players already exist';
  END IF;
END $$;

UPDATE weekly_player_library
   SET status = 'inactive',
       deactivated_at = COALESCE(deactivated_at, now()),
       deactivation_reason = CASE
         WHEN deactivation_reason = '' THEN 'Legacy archive: excluded from weekly v2 player scope'
         ELSE deactivation_reason
       END,
       updated_at = now()
 WHERE status = 'active';
