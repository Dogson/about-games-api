# about-games-api

A REST API that links **YouTube videos** to **video games** by cross-referencing channel uploads with the [IGDB](https://www.igdb.com/) game database. It aggregates gaming channels, detects which games are mentioned in each video's title or description, and exposes a browsable catalog of games, videos, and channels.

## Features

- **Channel ingestion** — track YouTube channels (by handle or ID) and pull their metadata from the YouTube Data API v3.
- **Video population** — fetch every upload from a channel's uploads playlist, filtered by per-channel regex rules (`ignoreEpisodesContaining`).
- **Game detection** — an AI-based extractor (`src/modules/ai/deepseek.service.ts`) uses a per-channel, editable prompt (default `DEFAULT_GAME_CANDIDATE_AI_PROMPT`) to identify the MAIN games in each video's title + description, then matches them against IGDB (title + alternative names, accent/whitespace-normalized).
- **Games ↔ videos catalog** — many-to-many relations (`videos_has_games`) with deterministic ordering via a `rank` column, plus video validation/curation.
- **JWT authentication** — bcrypt-hashed passwords and Passport JWT; write routes are guarded.
- **Scheduled jobs** — daily channel/video sync, daily missing-video generation, monthly IGDB re-sync.
- **Live logging** — in-memory log bus streamed over SSE (`/logs/stream`) plus a `/logs/last` endpoint.

## Tech stack

- [NestJS](https://nestjs.com/) 11
- [Sequelize](https://sequelize.org/) + [Sequelize TypeScript](https://github.com/sequelize/sequelize-typescript) + MySQL 8
- [Passport](https://www.passportjs.org/) / JWT for authentication
- [YouTube Data API v3](https://developers.google.com/youtube/v3)
- [IGDB API v4](https://api-docs.igdb.com/) (Twitch OAuth for tokens)
- [DeepSeek API](https://platform.deepseek.com/) (OpenAI-compatible chat completions, `deepseek-v4-flash` by default)
- `@nestjs/schedule` for cron jobs, SSE for live logs

## Requirements

- Node.js `22.17` (see `.nvmrc`)
- MySQL 8+
- A Google Cloud project with the YouTube Data API v3 enabled (for a `YOUTUBE_API_KEY`)
- IGDB / Twitch API credentials (client ID + client secret) with an OAuth token endpoint
- A DeepSeek API key (for AI-based game detection)

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure the environment. Copy `.env.example` to `.env` and fill in your credentials (see [Environment variables](#environment-variables)).

3. Initialize the database — this creates the schema, applies referential actions, and loads seed data:

   ```bash
   npm run db:init
   ```

4. Start the server:

   ```bash
   # development
   npm run start:dev
   ```

   The API listens on the `PORT` env variable, defaulting to **`5000`** (`src/main.ts`).

## Scripts

| Command              | Description                         |
| -------------------- | ----------------------------------- |
| `npm run start`      | Run the app                         |
| `npm run start:dev`  | Run in watch mode                   |
| `npm run start:prod` | Run the compiled `dist/main` build  |
| `npm run build`      | Compile the NestJS project          |
| `npm run lint`       | Lint and auto-fix with ESLint       |
| `npm run format`     | Format source with Prettier         |
| `npm test`           | Run unit tests (Jest)               |
| `npm run test:e2e`   | Run end-to-end tests                |
| `npm run test:cov`   | Run tests with coverage             |
| `npm run db:init`    | Set up the database (schema + seed) |

## Environment variables

| Variable                 | Required | Description                                                              |
| ------------------------ | -------- | ------------------------------------------------------------------------ |
| `PORT`                   | No       | HTTP port (default `5000`)                                               |
| `CORS_ORIGINS`           | No       | Comma-separated allowed origins (default: any `http://localhost:<port>`) |
| `DB_USERNAME`            | Yes      | MySQL user                                                               |
| `DB_PASSWORD`            | Yes      | MySQL password                                                           |
| `DB_ROOT_PASSWORD`       | No       | MySQL root password (Docker Compose only)                                |
| `DB_DATABASE_NAME`       | Yes      | MySQL database name                                                      |
| `DB_HOST`                | Yes      | MySQL host                                                               |
| `DB_PORT`                | Yes      | MySQL port                                                               |
| `BACKUP_DIR`             | No       | Directory for `mysqldump` backups (default `./backups`)                  |
| `BACKUP_RETENTION_DAYS`  | No       | Backup retention in days (default `183`, ≈ 6 months)                     |
| `SECRET_JWT_KEY`         | Yes      | Secret used to sign JWT access tokens                                    |
| `YOUTUBE_API_KEY`        | Yes      | YouTube Data API v3 key                                                  |
| `YOUTUBE_API_HOST`       | Yes      | YouTube API base URL (`https://www.googleapis.com/youtube/v3/`)          |
| `IGDB_API_HOST`          | Yes      | IGDB API base URL (`https://api.igdb.com/v4/`)                           |
| `IGDB_API_CLIENT_ID`     | Yes      | IGDB client ID                                                           |
| `IGDB_API_CLIENT_SECRET` | Yes      | IGDB client secret                                                       |
| `IGDB_OAUTH_URL`         | Yes      | Twitch OAuth token endpoint (e.g. `https://id.twitch.tv/oauth2/token`)   |
| `DEEPSEEK_API_KEY`       | Yes      | DeepSeek API key (game detection)                                        |
| `DEEPSEEK_API_HOST`      | No       | DeepSeek API base URL (default `https://api.deepseek.com`)               |
| `DEEPSEEK_MODEL`         | No       | DeepSeek model (default `deepseek-v4-flash`)                             |

> **Note:** `IGDB_OAUTH_URL` is read by the IGDB service (`src/modules/igdb/igdb.service.ts`); it is present in `.env.example` and must be set in your `.env`.

## API overview

All routes live under the following groups:

| Group    | Base path   | Description                                                                                                                                                      |
| -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth     | `/auth`     | `POST /auth/login`, `GET /auth/validate`                                                                                                                         |
| Users    | `/users`    | CRUD for admin users                                                                                                                                             |
| Channels | `/channels` | CRUD + `generate` (videos), `:id/generateGames`, `syncAllYoutubeChannels`                                                                                        |
| Videos   | `/videos`   | CRUD; filter with `validated`, `hasSearchedGames`                                                                                                                |
| Games    | `/games`    | CRUD; filter with `search`, `igdbId`, `onlyValidated`, `withVideos`, `languages`, `page`, `limit`; plus `igdbSearch` / `igdbSearchWithinText` and `syncAllGames` |
| Logs     | `/logs`     | `GET /logs/stream` (SSE), `GET /logs/last`                                                                                                                       |

Write operations (create/update/delete) and the sync/search endpoints require a JWT access token from `POST /auth/login` (`Authorization: Bearer <token>`). Read-only listing/detail endpoints are public.

## Cron jobs

Scheduled via `src/modules/cron/cron.service.ts`:

| Schedule                   | Task                                                                     |
| -------------------------- | ------------------------------------------------------------------------ |
| Every day at 00:00         | Sync all channel info from YouTube and remove deleted videos             |
| Every day at 23:00 UTC     | Generate missing videos for all channels (off-peak for DeepSeek pricing) |
| 1st of each month at 00:00 | Re-sync all games with up-to-date IGDB data                              |

## Deployment

The API ships with a Docker setup targeting an always-on VM (e.g. Oracle Cloud
Always Free), with MySQL and an automatic HTTPS reverse proxy:

- `Dockerfile` — multi-stage Node 22.17 build (`npm run build`, prod deps only).
- `docker-compose.yml` — `db` (MySQL 8.4), `api`, `caddy` (TLS via Let's Encrypt).
- `Caddyfile` — serves `api.aboutgames.gwen.cool` and proxies to `api:5000`.

Steps on the server:

1. Create a `.env` from `.env.example` and set `CORS_ORIGINS`, `DB_*`, secrets and API keys. Keep `DB_DATABASE_NAME=about_games_db` (`db/sql/db_schema.sql` hardcodes it).
2. Build and start the stack:

   ```bash
   docker compose up -d --build
   ```

3. Initialize the database (interactive seed — pipe `yes`):

   ```bash
   docker compose exec -T api sh -c "echo yes | node db/scripts/setup_db.js"
   ```

4. Point the DNS `api` A record to the VM's public IP. Caddy issues the TLS certificate automatically.

`@nestjs/schedule` runs inside the single `api` container, so the daily/monthly
cron jobs keep running. Do not scale the `api` service to multiple replicas
(jobs would be duplicated).

## Backups

Weekly `mysqldump` backups are handled by `db/scripts/backup_db.sh`, which dumps
inside the `db` container (no MySQL client needed on the host), compresses the
output and rotates files older than `BACKUP_RETENTION_DAYS`.

```bash
chmod +x db/scripts/backup_db.sh db/scripts/restore_db.sh

# crontab -e — every Sunday at 03:00 UTC
0 3 * * 0 cd /home/ubuntu/about-games-api && ./db/scripts/backup_db.sh >> ./backups/backup.log 2>&1
```

Backups are stored locally in `BACKUP_DIR` (`./backups`, git-ignored). Restore
with:

```bash
./db/scripts/restore_db.sh ./backups/about_games_<timestamp>.sql.gz
```

To dry-run a restore safely, restore into a throwaway database first and check
the row counts before touching production.

## Notes

- `setup_db.js` creates the database named by `DB_DATABASE_NAME`, but `db/db_schema.sql` hardcodes `about_games_db` as its schema name — keep them in sync or you may hit "database does not exist" errors.

## License

UNLICENSED — private project.
