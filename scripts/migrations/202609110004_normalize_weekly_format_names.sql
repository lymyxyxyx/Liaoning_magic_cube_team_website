-- Keep the display names of the pre-created weeks aligned with the score
-- calculation terminology used everywhere else in the weekly console.
UPDATE weekly_events event
   SET title = event.event_name || ' · ' || CASE event.format
     WHEN 'avg5' THEN '五次取平均'
     WHEN 'avg3' THEN '五次取平均'
     WHEN 'best3' THEN '三次取最快'
     WHEN 'best1' THEN '单次取最快'
     ELSE event.title
   END,
       updated_at = now()
  FROM weekly_meets meet
 WHERE meet.id = event.meet_id
   AND meet.data_version = 2
   AND event.event_code IS NOT NULL
   AND event.event_code <> '';
