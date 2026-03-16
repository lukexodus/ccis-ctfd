# Deprecated Features Log

This document tracks features, APIs, behaviors, and code patterns that have been deprecated or removed from CTFd, along with their replacements and the version they were deprecated/removed.

---

## How to Read This Document

- **Status: `Deprecated`** — Feature still works but emits a warning or is no longer recommended. Will be removed in a future major release.
- **Status: `Removed`** — Feature has been deleted from the codebase.
- **Target** — The version when removal is planned.

---

## Feature Deprecations

---

### `dynamic_challenge` Plugin (Separate Table)

| | |
|---|---|
| **Status** | Deprecated (supported until CTFd 4.0) |
| **Deprecated in** | v3.8.1 |
| **Removal target** | CTFd 4.0 |

**What it was:**  
The `CTFd/plugins/dynamic_challenges/` plugin introduced a separate `dynamic_challenge` table joined to `challenges` to store `initial`, `minimum`, and `decay` values. Challenge authors had to explicitly choose the `dynamic` challenge type.

**What replaced it:**  
Dynamic scoring was integrated directly into the standard `challenges` table (columns: `initial`, `minimum`, `decay`, `function`). All challenge types now support dynamic scoring natively.

**Migration path:**
- Existing `dynamic_challenge` rows are automatically migrated by Alembic
- Plugin code referencing `dynamic_challenge` models should switch to the `Challenges` model directly

---

### `ChallengeResponse` as `(status, message)` Tuple

| | |
|---|---|
| **Status** | Deprecated (supported until CTFd 4.0) |
| **Deprecated in** | v3.8.0 |
| **Removal target** | CTFd 4.0 |

**What it was:**  
Challenge type plugins (subclassing `BaseChallenge`) returned a `(bool, str)` tuple from `attempt()`:

```python
# Old pattern
def attempt(cls, challenge, request):
    if flag_correct:
        return True, "Correct"
    return False, "Incorrect"
```

**What replaced it:**  
Return a `ChallengeResponse` object:

```python
from CTFd.plugins.challenges import ChallengeResponse

def attempt(cls, challenge, request):
    if flag_correct:
        return ChallengeResponse(result=True, message="Correct")
    return ChallengeResponse(result=False, message="Incorrect")
```

`ChallengeResponse` is backwards-compatible — CTFd will unwrap tuples until v4.0.

---

### Mailgun API Integration (Direct)

| | |
|---|---|
| **Status** | Deprecated |
| **Deprecated in** | v3.0 |
| **Removal target** | TBD |

**What it was:**  
`MAILGUN_API_KEY` and `MAILGUN_BASE_URL` config options and the `CTFd.utils.email.mailgun.sendmail` function allowed sending email via the Mailgun HTTP API directly.

**What replaced it:**  
Use SMTP configuration instead. Mailgun still works via SMTP relay:

```ini
[email]
MAIL_SERVER   = smtp.mailgun.org
MAIL_PORT     = 587
MAIL_USEAUTH  = true
MAIL_USERNAME = postmaster@mg.example.com
MAIL_PASSWORD = <mailgun-smtp-password>
MAIL_TLS      = true
```

**Deprecated functions:**

| Function | Module | Replacement |
|---|---|---|
| `sendmail(addr, msg)` | `CTFd.utils.email.mailgun` | `CTFd.utils.email.sendmail()` |

---

### `CTFd.utils.email.smtp.sendmail`

| | |
|---|---|
| **Status** | Deprecated |
| **Deprecated in** | v3.5.0 |
| **Removal target** | TBD |

**What it was:**  
Direct call to `CTFd.utils.email.smtp.sendmail(addr, msg)`.

**What replaced it:**  
`CTFd.utils.email.sendmail(addr, msg)` — uses the `EmailProvider` abstraction layer, which dispatches to SMTP or Mailgun automatically.

---

### `CTFd._internal.challenge.render` and `CTFd._internal.challenge.renderer`

| | |
|---|---|
| **Status** | Deprecated |
| **Deprecated in** | v3.5.0 |
| **Removal target** | CTFd 4.0 |

**What it was:**  
Theme/plugin `view.js` files used `CTFd._internal.challenge.render` and `CTFd._internal.challenge.renderer` to render challenge descriptions client-side in JavaScript.

**What replaced it:**  
Challenge descriptions are now rendered server-side. The `challenge.html` attribute in the API response (`/api/v1/challenges/<id>`) returns pre-rendered HTML. Themes should reference `challenge.html` directly instead of re-rendering markdown on the client.

---

### `bracket` Column on `users` and `teams` Tables

| | |
|---|---|
| **Status** | Removed |
| **Removed in** | v3.7.0 (via migration `9889b8c53673`) |

**What it was:**  
`users.bracket` and `teams.bracket` were `VARCHAR(32)` free-text columns used to track a user's competition bracket as a plain string.

**What replaced it:**  
A dedicated `brackets` table with a proper foreign key relationship:
- `users.bracket_id` → `brackets.id`
- `teams.bracket_id` → `brackets.id`

---

### `dynamic_challenge.function` Value `"static"`

| | |
|---|---|
| **Status** | Removed in deprecation context |
| **Changed in** | v3.8.1 |

**What it was:**  
The `function` column defaulted to `"static"` and was only relevant for the dynamic challenge plugin. With dynamic scoring integrated into core, `function = "static"` now means "no dynamic decay" — the `value` column is used directly.

**Valid values now:** `"static"`, `"linear"`, `"logarithmic"`

---

### `MAILGUN_API_KEY` and `MAILGUN_BASE_URL` Config Keys

| | |
|---|---|
| **Status** | Deprecated |
| **Deprecated in** | v3.0 |

These config keys still work but print deprecation warnings. They will be removed in a future major release. Migrate to SMTP as described under [Mailgun API Integration](#mailgun-api-integration-direct).

---

### Assets.manifest_css

| | |
|---|---|
| **Status** | Removed |
| **Removed in** | v3.5.1 |

The `Assets.manifest_css` helper in themes was removed. Theme CSS should be referenced via standard `Assets.css()` or by direct `<link>` tags.

---

### `core-beta` Theme Name

| | |
|---|---|
| **Status** | Removed (renamed) |
| **Changed in** | v3.8.0 |

**What it was:**  
The modern theme shipped as `core-beta` while the old theme remained as `core`.

**What happened:**  
- `core-beta` was promoted and renamed to `core` (the new default)
- The old `core` theme was renamed to `core-deprecated`
- Config values referencing `"core-beta"` are migrated automatically by the `5c98d9253f56` Alembic migration

---

### `pybluemonday` HTML Sanitizer

| | |
|---|---|
| **Status** | Removed |
| **Removed in** | v3.8.0 |

**What it was:**  
`pybluemonday` (a Python binding for the Go `bluemonday` HTML sanitizer) was used to sanitize user-generated HTML content.

**What replaced it:**  
`nh3` — a Python binding for the Rust `ammonia` HTML sanitizer. It provides equivalent functionality without a Go runtime dependency.

---

### Multi-Path `config` Entry in `plugins/config.json`

| | |
|---|---|
| **Status** | Changed (not deprecated) |
| **Changed in** | v3.5.0 |

Plugins can now define multiple config `route` paths in `config.json` to appear as multiple entries in the Admin Panel's Plugins section. Previously only a single `config` route was supported.

---

## Migration Notes for Plugin Developers

When upgrading a plugin from an older CTFd version, check the following:

| Version | Key Changes for Plugins |
|---|---|
| 3.8.0 → 3.8.1 | `attempt()` should return `ChallengeResponse`; `dynamic_challenge` table deprecated |
| 3.7.0 → 3.8.0 | `challenge.type = "dynamic"` plugins still work; `BaseChallenge.partial()` and `.ratelimited()` now expected |
| 3.5.0 → 3.6.0 | `EmailProvider` class introduced; direct `smtp.sendmail` deprecated |
| 3.4.x → 3.5.0 | `CTFd._internal.challenge.render` deprecated; use `challenge.html` from API |
| Any → 3.8.0 | Replace `pybluemonday` with `nh3` in any plugin that does its own HTML sanitization |
