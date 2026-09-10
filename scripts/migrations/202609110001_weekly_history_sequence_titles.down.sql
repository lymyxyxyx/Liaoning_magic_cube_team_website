UPDATE weekly_meets
   SET week_number = year_week,
       title = year || '年第' || year_week || '周周赛',
       updated_at = now()
 WHERE data_version = 2
   AND year = 2026
   AND year_week BETWEEN 27 AND 34
   AND week_number IN (340, 341, 342, 343, 344, 345, 346, 347);
