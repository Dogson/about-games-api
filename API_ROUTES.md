# About Games API — Routes

REST API built with **NestJS 11 + MySQL (Sequelize)**.

- **Base URL**: `http://localhost:<PORT>/` (default port: `5000`)
- **Global prefix**: none
- **CORS**: any `http://localhost:<port>` origin, credentials allowed
- **Validation**: global `ValidationPipe` (`whitelist: true`, `transform: true`)
- **Errors**: typed HTTP exceptions; unique-constraint errors handled by the global `SequelizeExceptionFilter`
- **Responses**: the `Returns` column of each table names a shape defined in [Response types](#response-types). Every shape is a plain JSON object spelled with primitive types only — no entity types (`Game`, `Video`, …) leak into the payloads. Dates serialize as ISO-8601 strings, nullable columns as `null`, and JSON-array columns as JSON arrays.

## Authentication

Endpoints marked **[JWT]** require an `Authorization: Bearer <token>` header.

Tokens are issued by `POST /auth/login`. The SSE endpoint (`GET /logs/stream`) also accepts the token as a `?token=` query parameter.

## Routes

### Health / root

| Method | Path | Auth   | Returns  | Description            |
| ------ | ---- | ------ | -------- | ---------------------- |
| GET    | `/`  | public | `string` | Returns a hello string |

### Auth — `/auth`

| Method | Path             | Auth   | Body / Query                                           | Returns        | Description                                      |
| ------ | ---------------- | ------ | ------------------------------------------------------ | -------------- | ------------------------------------------------ |
| POST   | `/auth/login`    | public | Body: `{ username: string, password: string (min 6) }` | `AuthLogin`    | Validates credentials and issues a JWT token     |
| GET    | `/auth/validate` | JWT    | —                                                      | `AuthValidate` | Returns the JWT payload (the authenticated user) |

### Games — `/games`

| Method | Path                          | Auth   | Body / Query                                                                                                                                          | Returns            | Description                                         |
| ------ | ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------- |
| GET    | `/games`                      | public | Query: `search?`, `igdbId?`, `page?` (min 1), `limit?` (min 1), `onlyValidated?`, `withVideos?`, `languages?` (comma-separated)                       | `GameListEnvelope` | Lists games with optional filters / pagination      |
| GET    | `/games/:id`                  | public | Query: `onlyValidatedVideos?` (default `true`), `languages?` (comma-separated)                                                                        | `GameDetail`       | Returns one game with its videos (ordered by rank)  |
| POST   | `/games`                      | JWT    | Body: `{ igdbId: number, title: string, releaseDate: string (ISO date), companies: string[], coverImg?: string \| null, boxartImg?: string \| null }` | `GameResource`     | Creates a game                                      |
| GET    | `/games/igdbSearch`           | JWT    | Query: `search` (string) — supports `id:<number>` and `(year)` (matches games first released that year); up to 500 results                            | `IGDBGame[]`       | Searches games on IGDB                              |
| POST   | `/games/igdbSearchWithinText` | JWT    | Body: `{ text: string }`                                                                                                                              | `IGDBGame[]`       | Searches IGDB for games mentioned in the given text |
| PATCH  | `/games/syncAllGames`         | JWT    | —                                                                                                                                                     | — (`200`, no body) | Syncs all games with IGDB                           |
| PATCH  | `/games/:id`                  | JWT    | Body: partial `CreateGameDto`                                                                                                                         | `GameResource`     | Updates a game                                      |
| DELETE | `/games/:id`                  | JWT    | —                                                                                                                                                     | — (`200`, no body) | Deletes a game                                      |

### Videos — `/videos`

| Method | Path          | Auth   | Body / Query                                                                                                                                                                                                 | Returns            | Description                             |
| ------ | ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | --------------------------------------- |
| POST   | `/videos`     | JWT    | Body: `{ ytChannelId: number, title: string, youtubeId: string, description: string, thumbnailUrl: string, releaseDate?: string (ISO), validated?: boolean, ignored?: boolean, hasSearchedGames?: boolean }` | `VideoResource`    | Creates a video                         |
| GET    | `/videos`     | public | Query: `validated?`, `hasSearchedGames?` (booleans)                                                                                                                                                          | `VideoWithGames[]` | Lists videos with optional filters      |
| GET    | `/videos/:id` | public | —                                                                                                                                                                                                            | `VideoWithGames`   | Returns one video                       |
| PATCH  | `/videos/:id` | JWT    | Body: partial `CreateVideoDto` plus `games?: CreateGameDto[]`                                                                                                                                                | `VideoWithGames`   | Updates a video and/or its linked games |
| DELETE | `/videos/:id` | JWT    | —                                                                                                                                                                                                            | — (`200`, no body) | Deletes a video                         |

### Channels — `/channels`

| Method | Path                               | Auth   | Body / Query                                                                                                                                                                   | Returns                    | Description                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/channels`                        | JWT    | Body: `{ youtubeHandle: string, parsingOptions: { ignoreEpisodesContaining: string[], playlistsIds?: string[] }, language: string, additionalGameCandidateAIPrompt?: string }` | `ChannelWithVideosCount`   | Creates a channel. When `playlistsIds` is set, videos are only fetched from these playlists instead of the uploads playlist                                                                                                                                                                                                                                    |
| GET    | `/channels`                        | public | —                                                                                                                                                                              | `ChannelWithVideosCount[]` | Lists all channels                                                                                                                                                                                                                                                                                                                                             |
| GET    | `/channels/:id`                    | public | —                                                                                                                                                                              | `ChannelWithVideos`        | Returns one channel with its videos                                                                                                                                                                                                                                                                                                                            |
| POST   | `/channels/generate`               | JWT    | —                                                                                                                                                                              | `GenerateResult`           | Starts missing-video generation for all channels (async)                                                                                                                                                                                                                                                                                                       |
| POST   | `/channels/:id/generateGames`      | JWT    | —                                                                                                                                                                              | `GenerateGamesResult`      | Generates games for one channel (async when videos are pending)                                                                                                                                                                                                                                                                                                |
| PATCH  | `/channels/syncAllYoutubeChannels` | JWT    | —                                                                                                                                                                              | — (`200`, no body)         | Syncs all channels with YouTube (removes deleted ones)                                                                                                                                                                                                                                                                                                         |
| PATCH  | `/channels/:id`                    | JWT    | Body: partial `CreateChannelDto`                                                                                                                                               | `ChannelWithVideosCount`   | Updates a channel. Changing `ignoreEpisodesContaining` erases the channel's non-validated videos and refetches them (applying the ignore check); changing `playlistsIds` erases all channel videos and refetches them; changing `additionalGameCandidateAIPrompt` re-runs AI game generation on the channel's non-validated videos (validated videos are kept) |
| DELETE | `/channels/:id`                    | JWT    | —                                                                                                                                                                              | — (`204` No Content)       | Deletes a channel                                                                                                                                                                                                                                                                                                                                              |

### Users — `/users`

| Method | Path         | Auth   | Body / Query                  | Returns          | Description                               |
| ------ | ------------ | ------ | ----------------------------- | ---------------- | ----------------------------------------- |
| POST   | `/users`     | JWT    | Body: empty DTO               | `string`         | Creates a user (stub — not implemented)   |
| GET    | `/users`     | public | —                             | `UserResource[]` | Lists all users                           |
| GET    | `/users/:id` | public | —                             | `string`         | Returns one user (stub — not implemented) |
| PATCH  | `/users/:id` | JWT    | Body: partial `CreateUserDto` | `string`         | Updates a user (stub — not implemented)   |
| DELETE | `/users/:id` | JWT    | —                             | `string`         | Deletes a user (stub — not implemented)   |

### Logs — `/logs`

| Method | Path           | Auth                                 | Returns                     | Description                       |
| ------ | -------------- | ------------------------------------ | --------------------------- | --------------------------------- |
| GET    | `/logs/stream` | JWT (Bearer header **or** `?token=`) | SSE frame: `data: LogEvent` | Server-Sent Events stream of logs |
| GET    | `/logs/last`   | JWT                                  | `LogEvent[]`                | Returns the last 100 logs         |

## Response types

All payloads are plain JSON. Shapes may reference one another (e.g. `GameListItem.videos` is a list of `VideoWithChannel`), but every leaf field is always a primitive JSON type. `createdAt`/`updatedAt` and other date columns are ISO-8601 strings.

### Auth

<!-- prettier-ignore -->
**`AuthLogin`**

<!-- prettier-ignore -->
```ts
{
  access_token: string
  user: {
    id: number
    username: string
    admin: boolean
    createdAt: string
    updatedAt: string
  }
}
```

<!-- prettier-ignore -->
**`AuthValidate`**

<!-- prettier-ignore -->
```ts
{
  userId: number
  username: string
}
```

### Games

**`GameResource`** — a game as stored (also used for `POST /games` / `PATCH /games/:id`, and for the `games` items nested inside video payloads).

<!-- prettier-ignore -->
```ts
{
  id: number
  igdbId: number
  title: string
  releaseDate: string | null
  companies: string[]
  coverImg: string | null
  boxartImg: string | null
  createdAt: string
  updatedAt: string
}
```

**`GameListItem`** — one element of `GET /games`.

<!-- prettier-ignore -->
```ts
{
  id: number
  igdbId: number
  title: string
  releaseDate: string | null
  companies: string[]
  coverImg: string | null
  boxartImg: string | null
  createdAt: string
  updatedAt: string
  videosCount: number
  relevance?: number            // only present when ?search= is used
  videos?: VideoWithChannel[]   // only present when ?withVideos=true
}
```

**`GameDetail`** — `GET /games/:id`.

<!-- prettier-ignore -->
```ts
{
  id: number
  igdbId: number
  title: string
  releaseDate: string | null
  companies: string[]
  coverImg: string | null
  boxartImg: string | null
  createdAt: string
  updatedAt: string
  videos: VideoWithChannel[]    // filtered/validated per query, ordered by rank
}
```

**`GameListEnvelope`** — `GET /games`.

<!-- prettier-ignore -->
```ts
{
  data: GameListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}
```

**`IGDBGame`** — raw IGDB search result (subset requested from IGDB).

<!-- prettier-ignore -->
```ts
{
  id: number
  name: string
  alternative_names?: { id: number, name: string }[]
  release_dates?: { date: number }[]              // Unix timestamp (seconds)
  involved_companies?: { company: { id: number, name: string } }[]
  cover?: { url: string }
  screenshots?: { url: string }[]
  total_rating_count?: number
}
```

### Videos

**`VideoResource`** — a video as stored (also used for `POST /videos`).

<!-- prettier-ignore -->
```ts
{
  id: number
  ytChannelId: number
  title: string
  youtubeId: string
  description: string
  releaseDate: string | null
  thumbnailUrl: string
  validated: boolean | null
  ignored: boolean
  gamesFoundCount: number | null
  gamesCount: number | null
  hasSearchedGames: boolean
  createdAt: string
  updatedAt: string
}
```

**`ChannelRaw`** — a channel serialized raw, as it appears nested inside a video or game payload (note: `ignoreEpisodesContaining` and `playlistsIds` are top-level keys here, unlike the `parsingOptions` wrapper used by the channel endpoints).

<!-- prettier-ignore -->
```ts
{
  id: number
  name: string
  youtubeHandle: string
  youtubeId: string
  youtubeUploadsId: string
  description: string | null
  thumbnailUrl: string | null
  language: string
  ignoreEpisodesContaining: string[]
  playlistsIds: string[]
  additionalGameCandidateAIPrompt: string | null
  createdAt: string
  updatedAt: string
}
```

**`VideoWithChannel`** — a video with its channel (nested inside `GameListItem` / `GameDetail`).

<!-- prettier-ignore -->
```ts
{
  id: number
  ytChannelId: number
  title: string
  youtubeId: string
  description: string
  releaseDate: string | null
  thumbnailUrl: string
  validated: boolean | null
  ignored: boolean
  gamesFoundCount: number | null
  gamesCount: number | null
  hasSearchedGames: boolean
  createdAt: string
  updatedAt: string
  ytChannel: ChannelRaw
}
```

**`VideoWithGames`** — a video with its games and channel (video endpoints). Games are ordered by their join rank.

<!-- prettier-ignore -->
```ts
{
  id: number
  ytChannelId: number
  title: string
  youtubeId: string
  description: string
  releaseDate: string | null
  thumbnailUrl: string
  validated: boolean | null
  ignored: boolean
  gamesFoundCount: number | null
  gamesCount: number | null
  hasSearchedGames: boolean
  createdAt: string
  updatedAt: string
  ytChannel: ChannelRaw
  games: GameResource[]
}
```

### Channels

**`ChannelBase`** — shared channel fields returned by the `/channels` endpoints.

<!-- prettier-ignore -->
```ts
{
  id: number
  name: string
  youtubeHandle: string
  youtubeId: string
  youtubeUploadsId: string
  description: string | null
  thumbnailUrl: string | null
  language: string
  additionalGameCandidateAIPrompt: string | null
  parsingOptions: {
    ignoreEpisodesContaining?: string[]
    playlistsIds?: string[]
  }
  createdAt: string
  updatedAt: string
}
```

**`ChannelWithVideosCount`** — channel without its videos (create / list / update).

<!-- prettier-ignore -->
```ts
ChannelBase & {
  videosCount: number
}
```

**`ChannelWithVideos`** — channel with its videos (`GET /channels/:id`); each video is a bare `VideoResource` without nested games/channel.

<!-- prettier-ignore -->
```ts
ChannelBase & {
  videos: VideoResource[]
}
```

**`GenerateResult`** — `POST /channels/generate`.

<!-- prettier-ignore -->
```ts
{
  success: boolean
  message: string
}
```

**`GenerateGamesResult`** — `POST /channels/:id/generateGames`.

<!-- prettier-ignore -->
```ts
{
  success: boolean
  message: string
  updated: number      // number of videos queued for game generation
}
```

### Users

**`UserResource`** — `GET /users` serializes the DB row as-is.

<!-- prettier-ignore -->
```ts
{
  id: number
  username: string
  passwordHash: string   // bcrypt hash — exposed by the current implementation
  admin: boolean
  createdAt: string
  updatedAt: string
}
```

### Logs

**`LogEvent`**

<!-- prettier-ignore -->
```ts
{
  message: string
  level: 'log' | 'error' | 'warn' | 'debug'
  context?: string
  timestamp: number
  trace?: string
}
```

## Notes

- `Routes.COMPANIES` (`/companies`) is declared in `src/routes.config.ts` but has no controller or endpoint yet.
- Route prefixes and auth guards are defined in `src/routes.config.ts` and `src/modules/*/*.controller.ts`.
- Empty responses: every `DELETE` endpoint returns an empty body with HTTP `200`, except `DELETE /channels/:id` which returns HTTP `204`. `PATCH /games/syncAllGames` and `PATCH /channels/syncAllYoutubeChannels` also return an empty body (they perform their work during the request and report progress through the log stream).
- The users module is only partially implemented: `POST /users`, `GET /users/:id`, `PATCH /users/:id` and `DELETE /users/:id` currently return placeholder strings. `GET /users` is public and serializes rows including the bcrypt `passwordHash` — likely a bug worth fixing.
