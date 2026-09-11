-- WCA IDs entered directly by a weekly administrator are explicit confirmations,
-- not automatic name-matching suggestions.
UPDATE weekly_player_library
   SET wca_id_confirmed = TRUE,
       updated_at = now()
 WHERE source = 'admin_manual'
   AND NULLIF(TRIM(wca_id), '') IS NOT NULL
   AND COALESCE(wca_id_confirmed, FALSE) = FALSE;
