-- The current weekly-player domain is the Liaoning weekly roster. Make that
-- scope explicit in stored data; city remains unknown until an admin selects it.
UPDATE weekly_player_library
   SET province = '辽宁',
       city = '',
       updated_at = now()
 WHERE source IN ('players_excel_import', 'admin_manual')
   AND (province IS DISTINCT FROM '辽宁' OR city IS DISTINCT FROM '');
