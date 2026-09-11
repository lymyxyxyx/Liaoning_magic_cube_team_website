-- U18 is a distinct weekly group. Rebuild v2 ranks using each meet's date so
-- existing results no longer share an adult ranking with 12–17 year olds.
WITH classified AS (
  SELECT
    result.id,
    result.meet_id,
    result.event_id,
    result.average,
    result.personal_best,
    result.player_name,
    CASE
      WHEN COALESCE(result.source_age_group, '') <> '' THEN result.source_age_group
      WHEN library.birth_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
        CASE
          WHEN EXTRACT(YEAR FROM age((meet.starts_at AT TIME ZONE 'Asia/Shanghai')::date, library.birth_date::date)) < 6 THEN 'U6'
          WHEN EXTRACT(YEAR FROM age((meet.starts_at AT TIME ZONE 'Asia/Shanghai')::date, library.birth_date::date)) < 8 THEN 'U8'
          WHEN EXTRACT(YEAR FROM age((meet.starts_at AT TIME ZONE 'Asia/Shanghai')::date, library.birth_date::date)) < 10 THEN 'U10'
          WHEN EXTRACT(YEAR FROM age((meet.starts_at AT TIME ZONE 'Asia/Shanghai')::date, library.birth_date::date)) < 12 THEN 'U12'
          WHEN EXTRACT(YEAR FROM age((meet.starts_at AT TIME ZONE 'Asia/Shanghai')::date, library.birth_date::date)) < 18 THEN 'U18'
          ELSE '成人组'
        END
      WHEN result.age_group IN ('U6', 'U8', 'U10', 'U12', 'U18') THEN result.age_group
      WHEN result.age_group IN ('成人', '成人组', 'O18', 'O30', 'O40') THEN '成人组'
      ELSE '待补'
    END AS ranking_age_group
  FROM weekly_results result
  JOIN weekly_meets meet ON meet.id = result.meet_id AND meet.data_version = 2
  LEFT JOIN weekly_player_library library ON library.id = result.player_id
), ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY meet_id, event_id, ranking_age_group
      ORDER BY
        CASE WHEN average < 0 THEN 1 ELSE 0 END,
        average,
        CASE WHEN personal_best < 0 THEN 1 ELSE 0 END,
        personal_best,
        player_name
    ) AS next_rank
  FROM classified
)
UPDATE weekly_results result
SET rank = ranked.next_rank
FROM ranked
WHERE result.id = ranked.id
  AND result.rank IS DISTINCT FROM ranked.next_rank;
