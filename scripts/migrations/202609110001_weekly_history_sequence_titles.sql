UPDATE weekly_meets
   SET week_number = CASE year_week
         WHEN 27 THEN 340 WHEN 28 THEN 341 WHEN 29 THEN 342 WHEN 30 THEN 343
         WHEN 31 THEN 344 WHEN 32 THEN 345 WHEN 33 THEN 346 WHEN 34 THEN 347
       END,
       title = CASE year_week
         WHEN 27 THEN '第340周周赛总结（2026年第27周）'
         WHEN 28 THEN '第341周周赛总结（2026年第28周）'
         WHEN 29 THEN '第342周周赛总结（2026年第29周）'
         WHEN 30 THEN '第343周周赛总结（2026年第30周）'
         WHEN 31 THEN '第344周周赛总结（2026年第31周）'
         WHEN 32 THEN '第345周周赛总结（2026年第32周）'
         WHEN 33 THEN '第346周周赛总结（2026年第33周）'
         WHEN 34 THEN '第347周周赛总结（2026年第34周）'
       END,
       updated_at = now()
 WHERE data_version = 2
   AND year = 2026
   AND year_week BETWEEN 27 AND 34
   AND week_number IN (27, 28, 29, 30, 31, 32, 33, 34);
