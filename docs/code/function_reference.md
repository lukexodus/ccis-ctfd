# Function / Method Reference

This document provides a per-function reference for CTFd's core public API — the functions and methods that developers working on plugins, themes, or the platform itself are most likely to call.

> For model-level queries and relationships, see [database_schema.md](database_schema.md).  
> For full REST API endpoint docs, see [api_reference.md](api_reference.md).

---

## `CTFd.utils` — Global Config & Utilities

**Module:** `CTFd/utils/__init__.py`

---

### `get_config(key, default=None)`

```python
def get_config(key: str | Enum, default=None) -> str | int | bool | None
```

Retrieves a CTFd configuration value from the database `config` table.

**Priority order:**
1. `PRESET_CONFIGS` (from `config.ini`) — cannot be overridden via UI
2. Database `config` table — admin-configurable
3. `DEFAULTS` constant — fallback for fresh installs
4. `default` argument

**Auto-typing:** String values are automatically cast:
- `"123"` → `123` (int)
- `"true"` / `"false"` → `True` / `False` (bool)
- All other strings returned as-is

**Caching:** Memoized per key. Cache is invalidated by `set_config()`.

**Example:**
```python
from CTFd.utils import get_config

ctf_name = get_config("ctf_name")           # str
user_mode = get_config("user_mode")         # "users" or "teams"
freeze = get_config("freeze")               # int (Unix timestamp) or None
```

---

### `set_config(key, value)`

```python
def set_config(key: str | Enum, value) -> Configs
```

Writes or updates a config value in the database, then invalidates the memoized cache for that key.

**Returns:** The `Configs` ORM object.

**Example:**
```python
set_config("ctf_name", "CCIS CTF 2025")
set_config("freeze", 1748000000)
```

---

### `get_app_config(key, default=None)`

```python
def get_app_config(key: str, default=None) -> Any
```

Reads directly from Flask's `app.config` dictionary (not the DB). Use this for deployment-level settings like `SECRET_KEY`, `DATABASE_URL`, etc.

---

### `markdown(md)`

```python
def markdown(md: str) -> str
```

Converts a Markdown string to HTML using `cmarkgfm` with extensions: `autolink`, `table`, `strikethrough`. The `CMARK_OPT_UNSAFE` option is set, so raw HTML in Markdown is preserved. Downstream sanitization is handled separately via `build_markdown()`.

---

### `import_in_progress()`

```python
def import_in_progress() -> bool
```

Returns `True` if a CTFd backup import is currently in progress (checked via a Redis/cache flag). Used to pause CTFd startup until an import has completed.

---

## `CTFd.utils.crypto`

**Module:** `CTFd/utils/crypto/__init__.py`

---

### `hash_password(plaintext)`

```python
def hash_password(plaintext: str) -> str
```

Bcrypt-hashes a plaintext password. Called automatically by the `@validates("password")` hook on `Users` and `Teams` models — **you should not call this manually for user/team passwords**.

---

### `verify_password(plaintext, hashed)`

```python
def verify_password(plaintext: str, hashed: str) -> bool
```

Verifies a plaintext string against a bcrypt hash. Returns `True` if they match.

**Example:**
```python
from CTFd.utils.crypto import verify_password

if verify_password(submitted_password, user.password):
    # Authenticated
```

---

### `sha256(data)`

```python
def sha256(data: str | bytes) -> str
```

Returns the hex-encoded SHA-256 digest of `data`.

---

### `sha1(data)`

```python
def sha1(data: str | bytes) -> str
```

Returns the hex-encoded SHA-1 digest of `data`.

---

## `CTFd.utils.dates`

**Module:** `CTFd/utils/dates/__init__.py`

All functions read from the `start`, `end`, `freeze` config keys.

---

### `ctf_started()`

```python
def ctf_started() -> bool
```

Returns `True` if the CTF start time has passed or if no start time is configured.

---

### `ctf_ended()`

```python
def ctf_ended() -> bool
```

Returns `True` if the CTF end time has passed. Returns `False` if no end time is set (CTF runs indefinitely).

---

### `ctf_frozen()`

```python
def ctf_frozen() -> bool
```

Returns `True` if the scoreboard freeze time has passed. Submissions are still accepted but the scoreboard no longer updates after the freeze.

---

### `ctf_paused()`

```python
def ctf_paused() -> bool
```

Returns `True` if the `paused` config key is set to `True`. Pausing prevents new submissions without ending the CTF.

---

## `CTFd.utils.config`

**Module:** `CTFd/utils/config/__init__.py`

---

### `is_setup()`

```python
def is_setup() -> bool
```

Returns `True` if the CTFd setup wizard has been completed (i.e. `setup` config key is `True`).

---

### `get_themes()`

```python
def get_themes() -> list[str]
```

Returns a list of available theme names by scanning the `CTFd/themes/` directory.

---

### `ctf_theme_candidates()`

```python
def ctf_theme_candidates() -> list[str]
```

Returns the theme resolution order: `[current_theme, DEFAULT_THEME]`. Used by the Jinja loader to implement `THEME_FALLBACK`.

---

### `build_markdown(content, sanitize=False)`

**Module:** `CTFd/utils/config/pages.py`

```python
def build_markdown(content: str, sanitize: bool = False) -> str
```

Renders a Markdown string to sanitized or unsanitized HTML.
- `sanitize=False` — uses `CMARK_OPT_UNSAFE` (allows raw HTML). Used for challenge descriptions authored by admins.
- `sanitize=True` — runs output through `nh3.clean()`. Used for user-provided content like comments.

---

### `build_html(content)`

**Module:** `CTFd/utils/config/pages.py`

```python
def build_html(content: str) -> str
```

Returns raw HTML content, applying optional sanitization based on the `HTML_SANITIZATION` config.

---

### `challenges_visible()`

**Module:** `CTFd/utils/config/visibility.py`

```python
def challenges_visible() -> bool
```

Returns `True` if challenges are visible under current CTF state and visibility settings.

---

### `scores_visible()`

**Module:** `CTFd/utils/config/visibility.py`

```python
def scores_visible() -> bool
```

Returns `True` if the scoreboard is visible to participants.

---

## `CTFd.utils.security`

**Module:** `CTFd/utils/security/`

---

### `login_user(user)`

**Module:** `CTFd/utils/security/auth.py`

```python
def login_user(user: Users) -> None
```

Saves user identity into the session and records a `Tracking` entry for the login event.

---

### `logout_user()`

**Module:** `CTFd/utils/security/auth.py`

```python
def logout_user() -> None
```

Clears the session.

---

### `is_admin()`

**Module:** `CTFd/utils/security/auth.py`

```python
def is_admin() -> bool
```

Returns `True` if the currently logged-in user has `type == "admin"`.

---

### `hmac(data, secret=None)`

**Module:** `CTFd/utils/security/signing.py`

```python
def hmac(data: str, secret: bytes | None = None) -> str
```

Returns an HMAC-SHA256 hex digest of `data` using `secret` (defaults to the app's `SECRET_KEY`).

---

### `serialize(data, secret=None)`

**Module:** `CTFd/utils/security/signing.py`

```python
def serialize(data: dict, secret: bytes | None = None) -> str
```

Time-stamps and signs a dict using `itsdangerous.URLSafeTimedSerializer`. Used to generate invite codes and password-reset tokens.

---

### `unserialize(token, max_age=None, secret=None)`

**Module:** `CTFd/utils/security/signing.py`

```python
def unserialize(token: str, max_age: int | None = None, secret: bytes | None = None) -> dict
```

Verifies and deserializes a signed token. Raises `BadSignature` or `BadTimeSignature` on failure.

---

## `CTFd.utils.scores`

**Module:** `CTFd/utils/scores/__init__.py`

---

### `get_user_standings(admin=False, bracket_id=None)`

```python
def get_user_standings(admin: bool = False, bracket_id: int | None = None) -> list[Row]
```

Returns a list of user standings ordered by score descending, then by last solve time ascending (tiebreak). Respects the `freeze` config unless `admin=True`. Optionally filtered by `bracket_id`.

Each row has: `user_id`, `name`, `score`, `account_url`.

---

### `get_team_standings(admin=False, bracket_id=None)`

```python
def get_team_standings(admin: bool = False, bracket_id: int | None = None) -> list[Row]
```

Same as `get_user_standings` but for teams. Each row has: `team_id`, `name`, `score`, `account_url`.

---

## `CTFd.utils.uploads`

**Module:** `CTFd/utils/uploads/__init__.py`

---

### `get_uploader()`

```python
def get_uploader() -> FilesystemUploader | S3Uploader
```

Returns the configured upload provider based on `UPLOAD_PROVIDER` config (`"filesystem"` or `"s3"`).

---

### `FilesystemUploader.upload(file_obj, filename)`

```python
def upload(file_obj, filename: str) -> str
```

Saves `file_obj` to a randomized path under `UPLOAD_FOLDER`. Returns the relative storage path.

---

### `S3Uploader.upload(file_obj, filename)`

```python
def upload(file_obj, filename: str) -> str
```

Uploads `file_obj` to the configured S3 bucket. Returns the S3 key path.

---

## `CTFd.utils.email`

**Module:** `CTFd/utils/email/__init__.py`

---

### `sendmail(addr, msg, subject="Message from CTFd")`

```python
def sendmail(addr: str, msg: str, subject: str = "Message from CTFd") -> tuple[bool, str]
```

Sends an email to `addr`. Detects and uses the configured email provider (SMTP or Mailgun). Returns `(success, error_message)`.

---

### `forgot_password(addr, data=None)`

```python
def forgot_password(addr: str, data: dict | None = None) -> tuple[bool, str]
```

Sends a password reset email using the `forgot_password_body` email template config.

---

### `verify_email(addr, force=False)`

```python
def verify_email(addr: str, force: bool = False) -> tuple[bool, str]
```

Sends an email verification message using the `verify_email_body` template.

---

## Plugin API (`CTFd.plugins.challenges`)

**Module:** `CTFd/plugins/challenges/__init__.py`

---

### `class BaseChallenge`

Base class all challenge types must extend.

| Method | Signature | Description |
|---|---|---|
| `create` | `(cls, request) → Challenges` | Create a new challenge from a request |
| `read` | `(cls, challenge) → dict` | Serialize a challenge to API response dict |
| `update` | `(cls, challenge, request) → Challenges` | Update challenge fields from request |
| `delete` | `(cls, challenge) → None` | Delete challenge and all related data |
| `attempt` | `(cls, challenge, request) → ChallengeResponse` | Validate a flag submission |
| `solve` | `(cls, user, team, challenge, request) → None` | Record a correct solve |
| `fail` | `(cls, user, team, challenge, request) → None` | Record an incorrect submission |
| `partial` | `(cls, user, team, challenge, request) → None` | Record a partial solve (for `all` flag logic) |
| `ratelimited` | `(cls, user, team, challenge, request) → None` | Record a rate-limited submission |

---

### `get_chal_class(type_name)`

```python
def get_chal_class(type_name: str) -> type[BaseChallenge]
```

Returns the challenge type class registered under `type_name`. Falls back to `"standard"` for unrecognized types.

---

### `class BaseFlag`

**Module:** `CTFd/plugins/flags/__init__.py`

Base class all flag types must extend.

| Method | Signature | Description |
|---|---|---|
| `compare` | `(cls, chal_key_obj, provided) → bool` | Returns `True` if `provided` matches the flag |

---

## Models — Computed Properties

These are not DB columns but computed Python properties used frequently in templates and API responses.

### `Users` model

| Property | Returns | Description |
|---|---|---|
| `score` | `int \| None` | Current score (hidden if `scores_visible()` is `False`) |
| `place` | `str \| None` | Ordinal rank (e.g. `"1st"`) |
| `solves` | `list[Solves]` | Non-frozen solve records |
| `fails` | `list[Fails]` | Incorrect submission records |
| `awards` | `list[Awards]` | Received awards |
| `fields` | `list[FieldEntries]` | Public custom field entries |
| `account_id` | `int` | `user.id` in user-mode; `team.team_id` in team-mode |
| `filled_all_required_fields` | `bool` | Whether the user completed all required registration fields |

### `Teams` model

Same interface as `Users` for: `score`, `place`, `solves`, `fails`, `awards`, `fields`, `account_id`, `filled_all_required_fields`.

Additional:

| Method | Returns | Description |
|---|---|---|
| `get_invite_code()` | `str` | Generates a signed, time-limited team invite URL token |
| `Teams.load_invite_code(code)` | `Teams` | (classmethod) Validates and returns the team from an invite code. Raises `TeamTokenExpiredException` or `TeamTokenInvalidException`. |
