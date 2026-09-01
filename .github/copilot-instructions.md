# Copilot Instructions

This repository is a **NestJS 11 + MySQL (Sequelize)** REST API that links **YouTube videos** to **video games** (IGDB). Follow these conventions in every change.

## TypeScript (strict — no `any`, ever)

- Never use `any` or implicit `any`. Use `unknown` for unknown inputs and narrow it with type guards (`instanceof Error`, `axios.isAxiosError`, custom guards).
- Declare explicit return types on all public methods and exported functions.
- Sequelize entities use `declare`-typed fields (see `src/modules/*/entities/*.entity.ts`).
- Be explicit about nullability: `foo: string | null` or `foo?: string`. Never add non-null assertions (`!`) unless provably safe.
- Prefer `interface` for plain response shapes, `class` for class-validator DTOs.

## NestJS structure

- Keep controllers thin: routes, `@Body()`/`@Query()`/`@Param()` and guards only. Business logic lives in services.
- Import route paths from `Routes` in `src/routes.config.ts` — never hardcode strings.
- Guard every write/sync endpoint with `@UseGuards(JwtAuthGuard)`.
- Resolve environment variables via `ConfigService`, never `process.env` directly.
- Use `forwardRef(() => XModule)` for circular module dependencies, matching existing modules.

## DTOs & validation

- Validate every field with class-validator (`@IsInt`, `@IsString`, `@IsBoolean`, ...).
- Use `@Transform` for query coercion of booleans and comma-separated arrays (see `find-all-games.dto.ts`).
- Update DTOs extend `PartialType(CreateXDto)`.
- Keep request DTOs separate from response DTOs/interfaces.

## Sequelize

- Entities use `sequelize-typescript` decorators with snake_case `field:` for column names.
- Use `@JsonArrayField('column')` for TEXT columns storing JSON string arrays.
- Declare relations (`@BelongsTo`, `@HasMany`, `@BelongsToMany`).
- Never interpolate user input into raw SQL. Prefer query builders; when `Sequelize.literal` is required, reuse the existing escape helpers (`escapeSearch`, `escapeSqlString`).

## Logging & errors

- Use the injected `AppLogger` registered via `createLoggerProvider(XxxService.name)` — never `console.*`.
- Throw typed HTTP exceptions (`NotFoundException`, `BadRequestException`, ...). Unique-constraint errors are handled globally by `SequelizeExceptionFilter`.
- When catching, narrow `unknown` with `instanceof Error` / `axios.isAxiosError` before using the error.

## Naming & style

- Files: kebab-case. Classes: `XxxService`, `XxxController`, `XxxDto`; entities and interfaces are plain `Xxx`.
- Write identifiers and comments in English (legacy French comments are not examples to copy).
- Defer formatting to Prettier/ESLint configs; run `npm run lint` and `npm run format` before finishing.

## API routes documentation

- Keep `API_ROUTES.md` (repo root) in sync with the code in every change that creates, edits, or deletes an API route.
- Record the HTTP method, path, auth requirement (JWT or public), and the request body/query/params for each route.
- Note in `API_ROUTES.md` when a route prefix in `src/routes.config.ts` or a guard usage changes.

## Do / Don't

- **Do** write explicit, well-named types for every function signature and result.
- **Do** split logic into small, single-purpose service methods.
- **Do** use `AppLogger` for all progress/error reporting.
- **Don't** use `any`, `as any`, or `@ts-ignore`.
- **Don't** put SQL or business logic in controllers.
- **Don't** duplicate magic strings for routes or env keys.
- **Don't** leave dead code, stub methods returning placeholder strings, or unused variables.
