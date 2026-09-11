DELETE FROM weekly_meets
 WHERE id IN ('weekly-2026-08-24', 'weekly-2026-08-31', 'weekly-2026-09-07')
   AND year = 2026
   AND year_week IN (35, 36, 37)
   AND week_number IN (348, 349, 350);
