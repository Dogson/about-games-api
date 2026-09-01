# About Games API — Routes

REST API built with **NestJS 11 + MySQL (Sequelize)**.

- **Base URL**: `http://localhost:<PORT>/` (default port: `5000`)
- **Global prefix**: none
- **CORS**: any `http://localhost:<port>` origin, credentials allowed
- **Validation**: global `ValidationPipe` (`whitelist: true`, `transform: true`)
- **Errors**: typed HTTP exceptions; unique-constraint errors handled by the global `SequelizeExceptionFilter`

## Authentication

Endpoints marked **[JWT]** require an `Authorization: Bearer <token>` header.

Tokens are issued by `POST /auth/login`. The SSE endpoint (`GET /logs/stream`) also accepts the token as a `?token=` query parameter.

## Routes

### Health / root

| Method | Path | Auth   | Description            |
| ------ | ---- | ------ | ---------------------- |
| GET    | `/`  | public | Returns a hello string |

### Auth — `/auth`

| Method | Path             | Auth   | Body / Query                                           | Description                                                |
| ------ | ---------------- | ------ | ------------------------------------------------------ | ---------------------------------------------------------- |
| POST   | `/auth/login`    | public | Body: `{ username: string, password: string (min 6) }` | Validates credentials and returns `{ access_token, user }` |
| GET    | `/auth/validate` | JWT    | —                                                      | Returns the authenticated user `{ userId, username }`      |

### Games — `/games`

| Method | Path                          | Auth   | Body / Query                                                                                                                                          | Description                                         |
| ------ | ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| GET    | `/games`                      | public | Query: `search?`, `igdbId?`, `page?` (min 1), `limit?` (min 1), `onlyValidated?`, `withVideos?`, `languages?` (comma-separated)                       | Lists games with optional filters / pagination      |
| GET    | `/games/:id`                  | public | Query: `onlyValidatedVideos?` (default `true`), `languages?` (comma-separated)                                                                        | Returns one game with its videos                    |
| POST   | `/games`                      | JWT    | Body: `{ igdbId: number, title: string, releaseDate: string (ISO date), companies: string[], coverImg?: string \| null, boxartImg?: string \| null }` | Creates a game                                      |
| GET    | `/games/igdbSearch`           | JWT    | Query: `search` (string)                                                                                                                              | Searches games on IGDB                              |
| POST   | `/games/igdbSearchWithinText` | JWT    | Body: `{ text: string }`                                                                                                                              | Searches IGDB for games mentioned in the given text |
| PATCH  | `/games/syncAllGames`         | JWT    | —                                                                                                                                                     | Syncs all games with IGDB                           |
| PATCH  | `/games/:id`                  | JWT    | Body: partial `CreateGameDto`                                                                                                                         | Updates a game                                      |
| DELETE | `/games/:id`                  | JWT    | —                                                                                                                                                     | Deletes a game                                      |

### Videos — `/videos`

| Method | Path          | Auth   | Body / Query                                                                                                                                                                                                 | Description                             |
| ------ | ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| POST   | `/videos`     | JWT    | Body: `{ ytChannelId: number, title: string, youtubeId: string, description: string, thumbnailUrl: string, releaseDate?: string (ISO), validated?: boolean, ignored?: boolean, hasSearchedGames?: boolean }` | Creates a video                         |
| GET    | `/videos`     | public | Query: `validated?`, `hasSearchedGames?` (booleans)                                                                                                                                                          | Lists videos with optional filters      |
| GET    | `/videos/:id` | public | —                                                                                                                                                                                                            | Returns one video                       |
| PATCH  | `/videos/:id` | JWT    | Body: partial `CreateVideoDto` plus `games?: CreateGameDto[]`                                                                                                                                                | Updates a video and/or its linked games |
| DELETE | `/videos/:id` | JWT    | —                                                                                                                                                                                                            | Deletes a video                         |

### Channels — `/channels`

| Method | Path                               | Auth   | Body / Query                                                                                                                                                                                          | Description                                                                                                                 |
| ------ | ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/channels`                        | JWT    | Body: `{ youtubeHandle: string, parsingOptions: { ignoreEpisodesContaining: string[], ignoreEpisodesMissing: string[], playlistsIds?: string[] }, language: string, gameCandidateAIPrompt?: string }` | Creates a channel. When `playlistsIds` is set, videos are only fetched from these playlists instead of the uploads playlist |
| GET    | `/channels`                        | public | —                                                                                                                                                                                                     | Lists all channels                                                                                                          |
| GET    | `/channels/:id`                    | public | —                                                                                                                                                                                                     | Returns one channel (with videos / videos count)                                                                            |
| POST   | `/channels/generate`               | JWT    | —                                                                                                                                                                                                     | Starts missing-video generation for all channels (async; returns `{ success, message }`)                                    |
| POST   | `/channels/:id/generateGames`      | JWT    | —                                                                                                                                                                                                     | Generates games for one channel                                                                                             |
| PATCH  | `/channels/syncAllYoutubeChannels` | JWT    | —                                                                                                                                                                                                     | Syncs all channels with YouTube (removes deleted ones)                                                                      |
| PATCH  | `/channels/:id`                    | JWT    | Body: partial `CreateChannelDto`                                                                                                                                                                      | Updates a channel                                                                                                           |
| DELETE | `/channels/:id`                    | JWT    | —                                                                                                                                                                                                     | Deletes a channel (HTTP `204`)                                                                                              |

### Users — `/users`

| Method | Path         | Auth   | Body / Query                  | Description      |
| ------ | ------------ | ------ | ----------------------------- | ---------------- |
| POST   | `/users`     | JWT    | Body: empty DTO               | Creates a user   |
| GET    | `/users`     | public | —                             | Lists all users  |
| GET    | `/users/:id` | public | —                             | Returns one user |
| PATCH  | `/users/:id` | JWT    | Body: partial `CreateUserDto` | Updates a user   |
| DELETE | `/users/:id` | JWT    | —                             | Deletes a user   |

### Logs — `/logs`

| Method | Path           | Auth                                 | Description                       |
| ------ | -------------- | ------------------------------------ | --------------------------------- |
| GET    | `/logs/stream` | JWT (Bearer header **or** `?token=`) | Server-Sent Events stream of logs |
| GET    | `/logs/last`   | JWT                                  | Returns the last 100 logs         |

## Notes

- `Routes.COMPANIES` (`/companies`) is declared in `src/routes.config.ts` but has no controller or endpoint yet.
- Route prefixes and auth guards are defined in `src/routes.config.ts` and `src/modules/*/*.controller.ts`.
