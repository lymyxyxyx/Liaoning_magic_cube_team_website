# WCA Data Sync V1

This project can check and import the WCA public TSV export into PostgreSQL.

## What V1 Imports

- `persons` -> `wca_persons`
- `events` -> `wca_events`
- `countries` -> `wca_countries`
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

No cron job is configured in V1.
