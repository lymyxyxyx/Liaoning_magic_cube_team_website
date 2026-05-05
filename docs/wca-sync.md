# WCA Data Sync V1

This project can check and import the WCA public TSV export into PostgreSQL.

## What V1 Imports

- `persons` -> `wca_persons`
- `events` -> `wca_events`
- `countries` -> `wca_countries`
- `competitions` -> `wca_competitions`
- `results` -> `wca_results`
- `ranks_single` -> `wca_ranks_single`
- `ranks_average` -> `wca_ranks_average`

The importer checks the official public export API:

https://www.worldcubeassociation.org/api/v0/export/public

It compares `export_date` with:

```text
/opt/ln-cubing/data/wca_state/last_export_date.txt
```

If the export is unchanged, it exits without downloading.

## Server Commands

Run from the deployed app directory:

```bash
cd /opt/ln-cubing/app
sudo docker compose run --rm web npm run wca:check
sudo docker compose run --rm web npm run wca:update
```

If the server only supports the older Compose command:

```bash
sudo docker-compose run --rm web npm run wca:check
sudo docker-compose run --rm web npm run wca:update
```

`wca:update` requires `DATABASE_URL` to be available in the `web` container.

## Data Paths

Defaults on the server host:

```text
/opt/ln-cubing/data/wca_raw
/opt/ln-cubing/data/wca_tmp
/opt/ln-cubing/data/wca_state
/opt/ln-cubing/logs/wca_update.log
```

When run inside the Docker `web` container, the script automatically uses the mounted paths:

```text
/app/data/wca_raw
/app/data/wca_tmp
/app/data/wca_state
/app/logs/wca_update.log
```

The temporary extraction directory is cleaned after each update attempt.

## Safety

Each TSV file is first imported into a `_new` table. Only after all selected files import successfully does the script swap the live tables inside a transaction.

The importer also stores a schema version in:

```text
/opt/ln-cubing/data/wca_state/schema_version.txt
```

This lets the server re-import the same WCA `export_date` when the local selected table set changes, such as the V1.5 addition of `competitions` and `results`.

## Automatic Sync

The ranking pages read from PostgreSQL, so they only show new WCA results after `npm run wca:update` has imported the latest export. To keep the server current, add a host-level cron job:

```bash
sudo crontab -e
```

Recommended schedule, once per day in the early morning:

```cron
30 4 * * * cd /opt/ln-cubing/app && /usr/bin/docker compose run --rm web npm run wca:update >> /opt/ln-cubing/logs/wca_cron.log 2>&1
```

The updater checks `/app/data/wca_state/last_export_date.txt` first. If WCA has not published a newer export, it exits without downloading the TSV package.

After adding or changing ranking indexes in this project, run the updater once manually so PostgreSQL rebuilds the imported WCA tables with the latest index set:

```bash
cd /opt/ln-cubing/app
sudo docker compose run --rm web npm run wca:update
```
