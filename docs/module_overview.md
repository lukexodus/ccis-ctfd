# Module / Package Overview

This document describes the purpose, responsibilities, and usage of every Python package and module in CTFd.

---

## Top-Level Application (`CTFd/`)

| File | Description |
|---|---|
| `__init__.py` | Application factory (`create_app()`). Wires up Flask, SQLAlchemy, Alembic, Babel, blueprints, plugins, and middleware. |
| `config.py` | Flask config class — reads `config.ini`, environment variables, and sets all Flask/SQLAlchemy defaults. |
| `auth.py` | Blueprint for authentication routes: login, register, logout, OAuth, password reset, email confirmation. |
| `views.py` | Blueprint for public-facing page routes: home, challenges, scoreboard, user/team pages, pages, setup wizard. |
| `admin/` | Blueprint for the admin panel (all `/admin/*` routes). |
| `api/` | Blueprint for the REST API (`/api/v1/*`). |
| `challenges.py` | Route for challenge attempt logic (`/api/v1/challenges/<id>/attempt`). |
| `scoreboard.py` | Scoreboard-related routes. |
| `teams.py` | Team-facing routes (join team, create team, team profile). |
| `users.py` | User-facing routes (public/private profile pages). |
| `share.py` | Social share link generation route. |
| `events.py` | Server-Sent Events (SSE) endpoint for real-time notifications. |
| `errors.py` | Unified HTTP error page renderer. |
| `models/` | SQLAlchemy ORM model definitions (single file: `__init__.py`). |
| `schemas/` | Marshmallow serialization schemas for API input/output. |
| `forms/` | WTForms form definitions for server-side rendered forms. |
| `plugins/` | Built-in plugin system and first-party plugins (`challenges`, `flags`, `dynamic_challenges`). |
| `constants/` | Enum-style constants: themes, setup defaults, config keys. |
| `themes/` | Bundled UI themes (`core`, `admin`). |
| `cache/` | Cache initialization (Flask-Caching, backed by Redis or filesystem). |
| `exceptions/` | CTFd-specific exception classes. |

---

## Application Factory (`CTFd/__init__.py`)

### Key Classes

#### `CTFdFlask(Flask)`
Custom Flask subclass. Responsibilities:
- Sets `jinja_environment` to `SandboxedBaseEnvironment` (prevents template injection)
- Overrides `session_interface` with `CachingSessionInterface`
- Overrides `request_class` with `CTFdRequest`
- Generates a `run_id` (time-based cache buster, or from `RUN_ID` config)

#### `CTFdRequest(Request)`
Overrides Werkzeug's `Request.path` to prepend `script_root`, fixing subdirectory deployments.

#### `SandboxedBaseEnvironment(SandboxedEnvironment)`
Jinja2 environment with sandbox restrictions. Extends the standard Jinja env to:
- Use `ThemeLoader` as the template loader
- Cache templates keyed by `(theme_name, template_name)` for correct multi-theme resolution

#### `ThemeLoader(FileSystemLoader)`
Jinja2 loader aware of CTFd's theme system:
- Refuses to load `admin/*` templates from non-admin loaders (security)
- Resolves templates as `<theme_name>/templates/<template_name>`

### Key Functions

| Function | Signature | Description |
|---|---|---|
| `create_app` | `(config="CTFd.config.Config") → CTFdFlask` | Main application factory. Creates and fully configures the Flask app, registers all blueprints, initializes DB, runs migrations. |
| `run_upgrade` | `() → None` | Runs Alembic `upgrade()` and records new version in `config` table. |
| `confirm_upgrade` | `() → bool` | Interactive TTY prompt before running DB migrations on version upgrade. |

---

## Configuration (`CTFd/config.py`)

The `Config` class holds all Flask configuration defaults, reads `config.ini` (via `configparser`), and merges environment variable overrides.

Key config groups:

| Group | Config Keys |
|---|---|
| Server | `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `WORKERS` |
| Security | `SESSION_COOKIE_HTTPONLY`, `SESSION_COOKIE_SAMESITE`, `TRUSTED_HOSTS` |
| Email | `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_TLS` |
| Uploads | `UPLOAD_PROVIDER`, `UPLOAD_FOLDER`, `AWS_*` |
| Optional | `REVERSE_PROXY`, `THEME_FALLBACK`, `HTML_SANITIZATION`, `SAFE_MODE` |
| Management | `PRESET_ADMIN_*`, `PRESET_CONFIGS` |

---

## API (`CTFd/api/`)

### `api/__init__.py`
Registers the `api` blueprint mounted at `/api/v1/`. Creates the Flask-RESTX `Api` instance with Swagger UI support.

### `api/v1/` — Resource Files

Each file defines one or more Flask-RESTX `Resource` classes (one per endpoint group).

| File | Routes | Description |
|---|---|---|
| `challenges.py` | `/challenges`, `/challenges/<id>`, `/challenges/<id>/solves`, `/challenges/<id>/files`, `/challenges/<id>/flags`, `/challenges/<id>/hints`, `/challenges/<id>/tags`, `/challenges/<id>/topics`, `/challenges/<id>/attempt`, `/challenges/<id>/solution`, `/challenges/<id>/ratings` | Full CRUD for challenges and all sub-resources |
| `users.py` | `/users`, `/users/<id>`, `/users/me`, `/users/me/solves`, `/users/me/fails`, `/users/me/awards`, `/users/me/submissions` | User management and self-service |
| `teams.py` | `/teams`, `/teams/<id>`, `/teams/me`, `/teams/me/solves`, `/teams/me/awards` | Team management |
| `submissions.py` | `/submissions`, `/submissions/<id>` | Submission history CRUD |
| `flags.py` | `/flags`, `/flags/<id>`, `/flags/types`, `/flags/types/<type>` | Flag definitions and type listing |
| `hints.py` | `/hints`, `/hints/<id>` | Hint CRUD |
| `awards.py` | `/awards`, `/awards/<id>` | Award CRUD |
| `tags.py` | `/tags`, `/tags/<id>` | Tag CRUD |
| `topics.py` | `/topics`, `/topics/<id>` | Topic CRUD |
| `files.py` | `/files`, `/files/<id>` | File upload and listing |
| `pages.py` | `/pages`, `/pages/<id>` | Custom page CRUD |
| `notifications.py` | `/notifications`, `/notifications/<id>` | Notification management |
| `tokens.py` | `/tokens`, `/tokens/<id>` | API token CRUD |
| `comments.py` | `/comments`, `/comments/<id>` | Admin comment CRUD |
| `config.py` | `/configs`, `/configs/<key>` | Global config CRUD |
| `scoreboard.py` | `/scoreboard`, `/scoreboard/top/<count>` | Scoreboard data |
| `brackets.py` | `/brackets`, `/brackets/<id>` | Bracket management |
| `solutions.py` | `/solutions`, `/solutions/<id>` | Solution management |
| `ratings.py` | — | (See `challenges/<id>/ratings`) |
| `unlocks.py` | `/unlocks` | Hint/solution unlock |
| `statistics/` | `/statistics/*` | Admin statistics endpoints |
| `exports.py` | `/exports/raw` | Export trigger |
| `shares.py` | `/shares` | Social share link creation |

---

## Utils (`CTFd/utils/`)

### `utils/__init__.py` — Core Config Helpers

| Function | Description |
|---|---|
| `get_config(key, default=None)` | Reads a config value from the DB (`config` table), checking PRESET_CONFIGS first. Returns auto-typed values (int, bool, str). Cached with `@cache.memoize()`. |
| `set_config(key, value)` | Writes (or updates) a config key-value in the DB and invalidates the cache. |
| `get_app_config(key, default=None)` | Reads from Flask's `app.config` dict (not the DB). |
| `markdown(md)` | Converts a markdown string to HTML via `cmarkgfm`. Extensions: autolink, table, strikethrough. |
| `get_asset_json(path)` | Reads and caches a JSON asset file from disk. Cache-bypassed in debug mode. |
| `import_in_progress()` | Returns `True` if a CTFd backup import is currently running (via cache flag). |

---

### `utils/challenges/`

Provides `get_chal_class(type_name)` and maintains the registry mapping challenge type names to their plugin classes. Used by `Challenges.plugin_class`.

---

### `utils/config/`

| Module | Exports |
|---|---|
| `__init__.py` | `get_themes()`, `ctf_theme_candidates()`, `is_setup()`, `get_mail_provider()` |
| `pages.py` | `build_markdown(content)`, `build_html(content)` — render page/challenge body |
| `visibility.py` | `challenges_visible()`, `scores_visible()`, `accounts_visible()`, `registration_visible()` — checks admin visibility settings |
| `integrations.py` | `mlc_registration()` — MajorLeagueCyber OAuth integration helpers |

---

### `utils/crypto/`

| Function | Description |
|---|---|
| `sha256(data)` | Returns hex SHA-256 of input |
| `sha1(data)` | Returns hex SHA-1 of input |
| `hash_password(plaintext)` | Bcrypt-hashes a plaintext password |
| `verify_password(plaintext, hashed)` | Verifies a plaintext against a bcrypt hash |

---

### `utils/dates/`

| Function | Description |
|---|---|
| `ctf_started()` | `True` if the CTF start time has passed |
| `ctf_ended()` | `True` if the CTF end time has passed |
| `ctf_frozen()` | `True` if the scoreboard freeze time has passed |
| `ctf_paused()` | `True` if the CTF is currently paused |

---

### `utils/decorators/`

| Module | Exports |
|---|---|
| `__init__.py` | `authed_only`, `admins_only`, `during_ctf_time_only`, `require_verified_emails`, `ratelimit`, etc. |
| `modes.py` | `require_team_mode`, `require_user_mode` |
| `visibility.py` | `check_challenge_visibility`, `check_score_visibility`, `check_account_visibility` |

These are Flask/Flask-RESTX decorators applied to routes and API resources.

---

### `utils/email/`

| Module | Description |
|---|---|
| `__init__.py` | `sendmail(addr, msg)`, `forgot_password(addr)`, `verify_email(addr)`, `successful_registration(addr)` — high-level send functions |
| `smtp.py` | `SMTPEmailProvider` class — sends via SMTP |
| `mailgun.py` | `MailgunEmailProvider` class — sends via Mailgun API (deprecated as of v3) |

---

### `utils/exports/`

| Module | Description |
|---|---|
| `__init__.py` | `export_ctf()` — generates a full CTFd JSON export .zip |
| `databases.py` | Database serialization helpers |
| `freeze.py` | Freeze-time aware export helpers |
| `serializers.py` | JSON serialization for each model type |

---

### `utils/security/`

| Module | Exports |
|---|---|
| `auth.py` | `login_user(user)`, `logout_user()`, `is_admin()` |
| `csrf.py` | `generate_nonce()`, CSRF validation helpers |
| `email.py` | Email address validation |
| `passwords.py` | Password strength validation |
| `sanitize.py` | HTML sanitization (via `nh3`) |
| `signing.py` | `hmac()`, `serialize()`, `unserialize()` — signed token helpers for invite codes and email links |

---

### `utils/uploads/`

| Module | Description |
|---|---|
| `__init__.py` | `get_uploader()` — returns the configured uploader |
| `uploaders.py` | `FilesystemUploader`, `S3Uploader` — implement `upload()`, `delete()`, `open()` |

---

### `utils/scores/`

| Function | Description |
|---|---|
| `get_user_standings(admin=False)` | Returns ranked user standings |
| `get_team_standings(admin=False)` | Returns ranked team standings |

Both functions respect the `freeze` config and support `admin` mode override.

---

### `utils/scoreboard/`

| Function | Description |
|---|---|
| `get_standings(count=None, bracket_id=None)` | Unified scoreboard function. Handles both user and team modes. Supports bracket filtering. |

---

### `utils/logging/`

Provides structured logging for:
- Submissions (`submission.log`)
- Registrations (`registration.log`)
- Logins (`authentication.log`)

Uses Python's standard `logging` module, writing to the `LOG_FOLDER`.

---

### `utils/initialization/`

Called in `create_app()` to register Flask hooks:

| Function | Description |
|---|---|
| `init_request_processors(app)` | Registers `before_request` / `after_request` hooks (setup check, freeze, import lock) |
| `init_template_filters(app)` | Registers Jinja2 filters (`markdown`, `unix_time_to_utc`, etc.) |
| `init_template_globals(app)` | Exposes config values and helpers to all templates |
| `init_logs(app)` | Configures log handlers |
| `init_events(app)` | Wires up SSE event queue |
| `init_cli(app)` | Registers Flask CLI commands |

---

### `utils/migrations/`

| Function | Description |
|---|---|
| `create_database()` | Creates DB connection from config; handles URL building from individual `DATABASE_*` parts |
| `stamp_latest_revision()` | Stamps the Alembic revision table (for fresh SQLite installs) |
| `migrations` | Flask-Migrate `Migrate` instance |

---

### `utils/sessions/`

| Class | Description |
|---|---|
| `CachingSessionInterface` | Custom Flask session backend — stores sessions in Redis (or filesystem cache) instead of signed cookies. Reduces cookie size and enables server-side invalidation. |

---

### `utils/modes/`

| Function | Description |
|---|---|
| `get_model()` | Returns `Users` or `Teams` model depending on `user_mode` config |
| `generate_account_url(account_id, is_team)` | Generates the correct profile URL for a user or team |

---

### `utils/notifications/`

| Function | Description |
|---|---|
| `send_notification(title, content, user_id=None, team_id=None)` | Creates a `Notifications` DB row and pushes a real-time SSE event |

---

### `utils/social/`

Helpers for generating social share URLs (Twitter/X, Facebook, LinkedIn) after a challenge solve.

---

### `utils/humanize/`

| Module | Exports |
|---|---|
| `numbers.py` | `ordinalize(n)` — `1` → `"1st"`, `2` → `"2nd"` |
| `words.py` | `pluralize(word, n)` |

---

### `utils/validators/`

Input validation helpers used in forms and API schemas (email format, URL format, team/user name length).

---

### `utils/updates/`

| Function | Description |
|---|---|
| `update_check(force=False)` | Async check against CTFd release API to see if a newer version is available. Respects `UPDATE_CHECK` config. |

---

### `utils/health/`

| Function | Description |
|---|---|
| `check_health()` | Called by `/healthcheck`. Verifies DB connection and Redis connection. Returns `True` if all deps are reachable. |

---

## Plugins (`CTFd/plugins/`)

### `plugins/__init__.py`
Provides:
- `init_plugins(app)` — discovers and loads all plugins from the `CTFd/plugins/` directory
- `register_plugin_asset(asset_path)` — registers a static asset from a plugin
- `register_user_page_menu_bar(name, route, target=None)` — adds a nav link for participants
- `register_admin_plugin_menu_bar(name, route)` — adds a nav link in the admin panel

### Built-in Plugins

| Plugin | Path | Description |
|---|---|---|
| `challenges` | `plugins/challenges/` | Base `BaseChallenge` class and standard challenge type implementation. All custom challenge types extend this. |
| `flags` | `plugins/flags/` | `BaseFlag` class and built-in flag types: `CTFdStaticFlag`, `CTFdRegexFlag`. |
| `dynamic_challenges` | `plugins/dynamic_challenges/` | Legacy dynamic scoring implementation (deprecated in v3.8.1; functionality merged into core). |

---

## Models (`CTFd/models/__init__.py`)

Single-file ORM definition. See [database_schema.md](database_schema.md) for the full table reference.

Key helper:

| Function | Description |
|---|---|
| `get_class_by_tablename(tablename)` | Returns the SQLAlchemy model class for a given table name. Handles polymorphic models correctly. |

---

## Schemas (`CTFd/schemas/`)

Marshmallow schemas for serializing/deserializing API request and response bodies. One schema file per major model group (users, teams, challenges, submissions, etc.).

---

## Forms (`CTFd/forms/`)

WTForms classes used in server-rendered HTML forms (setup wizard, login, registration). Not used in the REST API (which uses schemas instead).

---

## CLI (`CTFd/cli/`)

Flask CLI commands registered on the `flask` command group:

| Command | Description |
|---|---|
| `flask db upgrade` | Run pending Alembic migrations |
| `flask db downgrade` | Revert last migration |
| `flask db current` | Show current migration version |
| `python export.py` | Export the current CTF data to a zip archive |
| `python import.py <file>` | Import a CTFd zip archive |
| `python populate.py` | Seed the database with test data |
