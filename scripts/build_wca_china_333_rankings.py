#!/usr/bin/env python3
import json
import sqlite3
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
EXPORT_SQL = ROOT.parent / "WCA_export_v2_114_20260424T000025Z.sql" / "WCA_export.sql"
OUT_DIR = ROOT / "data"
OUT_DB = OUT_DIR / "wca_rankings.sqlite"
OUT_JSON = OUT_DIR / "wca_china_333_rankings.json"


def split_sql_values(payload: str) -> Iterable[str]:
    current: list[str] = []
    depth = 0
    in_string = False
    escaped = False

    for ch in payload:
        if depth == 0 and not in_string and ch != "(":
            continue

        current.append(ch)
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == "'":
                in_string = False
        else:
            if ch == "'":
                in_string = True
            elif ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    yield "".join(current).strip()
                    current = []


def parse_tuple(row: str) -> list[str | None]:
    values: list[str | None] = []
    current: list[str] = []
    in_string = False
    escaped = False

    for ch in row[1:-1]:
        if in_string:
            if escaped:
                current.append(ch)
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == "'":
                in_string = False
            else:
                current.append(ch)
            continue

        if ch == "'":
            in_string = True
        elif ch == ",":
            token = "".join(current).strip()
            values.append(None if token == "NULL" else token)
            current = []
        else:
            current.append(ch)

    token = "".join(current).strip()
    values.append(None if token == "NULL" else token)
    return values


def parse_insert_rows(sql_path: Path, table_name: str) -> Iterable[list[str | None]]:
    marker = f"INSERT INTO `{table_name}` VALUES"
    buffer: list[str] = []
    collecting = False

    with sql_path.open("r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            if not collecting and line.startswith(marker):
                collecting = True
                buffer = [line[len(marker) :]]
                if line.rstrip().endswith(";"):
                    payload = "".join(buffer).rstrip().rstrip(";")
                    for row in split_sql_values(payload):
                        if row:
                            yield parse_tuple(row)
                    collecting = False
                continue

            if collecting:
                buffer.append(line)
                if line.rstrip().endswith(";"):
                    payload = "".join(buffer).rstrip().rstrip(";")
                    for row in split_sql_values(payload):
                        if row:
                            yield parse_tuple(row)
                    collecting = False


def format_centiseconds(value: int) -> str:
    minutes, centiseconds = divmod(value, 6000)
    seconds = centiseconds / 100
    if minutes:
        return f"{minutes}:{seconds:05.2f}"
    return f"{seconds:.2f}".rstrip("0").rstrip(".")


def insert_many(conn: sqlite3.Connection, sql: str, rows: Iterable[tuple], chunk_size: int = 10000) -> int:
    chunk: list[tuple] = []
    total = 0
    for row in rows:
        chunk.append(row)
        if len(chunk) >= chunk_size:
            conn.executemany(sql, chunk)
            total += len(chunk)
            chunk = []
    if chunk:
        conn.executemany(sql, chunk)
        total += len(chunk)
    return total


def build_database() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUT_DB.exists():
        OUT_DB.unlink()

    conn = sqlite3.connect(OUT_DB)
    conn.executescript(
        """
        PRAGMA journal_mode = OFF;
        PRAGMA synchronous = OFF;
        PRAGMA temp_store = MEMORY;

        CREATE TABLE events (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          rank INTEGER NOT NULL
        );

        CREATE TABLE countries (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          continent_id TEXT NOT NULL,
          iso2 TEXT
        );

        CREATE TABLE persons (
          wca_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          country_id TEXT NOT NULL,
          gender TEXT NOT NULL
        );

        CREATE TABLE competitions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          city_name TEXT NOT NULL,
          country_id TEXT NOT NULL,
          date TEXT NOT NULL
        );

        CREATE TABLE ranks (
          mode TEXT NOT NULL,
          person_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          best INTEGER NOT NULL,
          world_rank INTEGER NOT NULL,
          continent_rank INTEGER NOT NULL,
          country_rank INTEGER NOT NULL,
          PRIMARY KEY (mode, person_id, event_id)
        );

        CREATE TABLE best_results (
          mode TEXT NOT NULL,
          person_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          best INTEGER NOT NULL,
          competition_id TEXT NOT NULL,
          PRIMARY KEY (mode, person_id, event_id)
        );
        """
    )

    event_count = insert_many(
        conn,
        "INSERT INTO events (id, name, rank) VALUES (?, ?, ?)",
        ((row[0] or "", row[1] or "", int(row[2] or 0)) for row in parse_insert_rows(EXPORT_SQL, "events")),
    )
    print(f"events: {event_count}")

    country_count = insert_many(
        conn,
        "INSERT INTO countries (id, name, continent_id, iso2) VALUES (?, ?, ?, ?)",
        (
            (row[0] or "", row[1] or "", row[2] or "", row[3] or "")
            for row in parse_insert_rows(EXPORT_SQL, "countries")
        ),
    )
    print(f"countries: {country_count}")

    person_count = insert_many(
        conn,
        "INSERT OR REPLACE INTO persons (wca_id, name, country_id, gender) VALUES (?, ?, ?, ?)",
        (
            (row[0] or "", row[2] or "", row[3] or "", row[4] or "")
            for row in parse_insert_rows(EXPORT_SQL, "persons")
            if row[1] == "1"
        ),
    )
    print(f"persons: {person_count}")

    competition_count = insert_many(
        conn,
        "INSERT INTO competitions (id, name, city_name, country_id, date) VALUES (?, ?, ?, ?, ?)",
        (
            (
                row[0] or "",
                row[1] or "",
                row[2] or "",
                row[3] or "",
                f"{int(row[5] or 0):04d}-{int(row[6] or 0):02d}-{int(row[7] or 0):02d}",
            )
            for row in parse_insert_rows(EXPORT_SQL, "competitions")
        ),
    )
    print(f"competitions: {competition_count}")

    rank_single_count = insert_many(
        conn,
        """
        INSERT INTO ranks (mode, person_id, event_id, best, world_rank, continent_rank, country_rank)
        VALUES ('single', ?, ?, ?, ?, ?, ?)
        """,
        (
            (row[0] or "", row[1] or "", int(row[2] or 0), int(row[3] or 0), int(row[4] or 0), int(row[5] or 0))
            for row in parse_insert_rows(EXPORT_SQL, "ranks_single")
        ),
    )
    print(f"ranks single: {rank_single_count}")

    rank_average_count = insert_many(
        conn,
        """
        INSERT INTO ranks (mode, person_id, event_id, best, world_rank, continent_rank, country_rank)
        VALUES ('average', ?, ?, ?, ?, ?, ?)
        """,
        (
            (row[0] or "", row[1] or "", int(row[2] or 0), int(row[3] or 0), int(row[4] or 0), int(row[5] or 0))
            for row in parse_insert_rows(EXPORT_SQL, "ranks_average")
        ),
    )
    print(f"ranks average: {rank_average_count}")

    conn.executescript(
        """
        CREATE INDEX idx_ranks_lookup ON ranks (mode, event_id, country_rank, world_rank);
        CREATE INDEX idx_ranks_person ON ranks (person_id, event_id, mode, best);
        CREATE INDEX idx_persons_country ON persons (country_id, gender);
        """
    )
    conn.commit()

    rank_targets: dict[tuple[str, str, int], set[str]] = {}
    for mode, person_id, event_id, best in conn.execute("SELECT mode, person_id, event_id, best FROM ranks"):
        rank_targets.setdefault((mode, event_id, best), set()).add(person_id)

    seen: set[tuple[str, str, str]] = set()

    def best_result_rows() -> Iterable[tuple]:
        for row in parse_insert_rows(EXPORT_SQL, "results"):
            (
                _result_id,
                competition_id,
                event_id,
                _round_type_id,
                _pos,
                best,
                average,
                _person_name,
                person_id,
                _person_country_id,
                _format_id,
                _regional_single_record,
                _regional_average_record,
            ) = row

            single_key = ("single", event_id or "", int(best or 0))
            if person_id in rank_targets.get(single_key, set()):
                record_key = ("single", person_id or "", event_id or "")
                if record_key not in seen:
                    seen.add(record_key)
                    yield ("single", person_id or "", event_id or "", int(best or 0), competition_id or "")

            if average not in (None, "0"):
                average_key = ("average", event_id or "", int(average or 0))
                if person_id in rank_targets.get(average_key, set()):
                    record_key = ("average", person_id or "", event_id or "")
                    if record_key not in seen:
                        seen.add(record_key)
                        yield ("average", person_id or "", event_id or "", int(average or 0), competition_id or "")

    best_result_count = insert_many(
        conn,
        """
        INSERT INTO best_results (mode, person_id, event_id, best, competition_id)
        VALUES (?, ?, ?, ?, ?)
        """,
        best_result_rows(),
    )
    print(f"best results: {best_result_count}")

    conn.executescript(
        """
        CREATE INDEX idx_best_results_lookup ON best_results (mode, event_id, person_id);
        CREATE INDEX idx_competitions_country ON competitions (country_id);
        ANALYZE;
        """
    )
    conn.commit()
    conn.close()


def build_china_333_json() -> None:
    conn = sqlite3.connect(OUT_DB)
    conn.row_factory = sqlite3.Row
    payload = {
        "region": "中国",
        "event": "三阶",
        "generatedFrom": str(EXPORT_SQL),
        "single": [],
        "average": [],
    }

    for mode in ("single", "average"):
        rows = conn.execute(
            """
            SELECT
              r.country_rank AS rank,
              r.world_rank AS worldRank,
              r.person_id AS wcaId,
              p.name,
              p.country_id AS country,
              p.gender,
              r.best,
              br.competition_id AS competitionId,
              c.name AS competitionName,
              c.date
            FROM ranks r
            JOIN persons p ON p.wca_id = r.person_id
            LEFT JOIN best_results br ON br.mode = r.mode AND br.person_id = r.person_id AND br.event_id = r.event_id
            LEFT JOIN competitions c ON c.id = br.competition_id
            WHERE r.mode = ? AND r.event_id = '333' AND p.country_id = 'China'
            ORDER BY r.country_rank, r.world_rank, r.person_id
            """,
            (mode,),
        ).fetchall()
        payload[mode] = [
            {
                **{key: row[key] for key in row.keys() if key != "best"},
                "result": format_centiseconds(int(row["best"])),
            }
            for row in rows
        ]

    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    conn.close()
    print(f"JSON: {OUT_JSON}")


def main() -> None:
    build_database()
    build_china_333_json()
    print(f"SQLite: {OUT_DB}")


if __name__ == "__main__":
    main()
