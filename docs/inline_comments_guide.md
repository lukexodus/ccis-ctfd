# Inline Code Comments Guide

This guide defines CTFd's conventions for inline code documentation — what to comment, how to format it, and what style to follow. It is intended for contributors and plugin developers who add or modify code in this repository.

---

## Philosophy

CTFd follows a pragmatic commenting philosophy:

> **Comment the *why*, not the *what*.**

Code that expresses *what* it does through clear naming needs no comment. Comments should explain *why* a design choice was made, *why* a workaround exists, or *what* non-obvious invariant is being relied on.

---

## Comment Types and When to Use Each

### 1. Docstrings — Public Functions, Classes, Methods

All public functions, classes, and methods **must** have a docstring. Use the [Google docstring style](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings).

```python
def get_config(key, default=None):
    """Retrieve a CTFd configuration value from the database.

    Priority: PRESET_CONFIGS > database config table > DEFAULTS > default arg.
    Values are automatically cast to int or bool when possible.

    Args:
        key (str | Enum): The configuration key to look up.
        default: Value to return if the key is not found. Defaults to None.

    Returns:
        str | int | bool | None: The configuration value.

    Example:
        ctf_name = get_config("ctf_name")
        freeze = get_config("freeze")   # Returns int if set
    """
```

For simple internal helpers, a one-line docstring is sufficient:

```python
def sha256(data):
    """Return the hex-encoded SHA-256 digest of data."""
```

---

### 2. Inline Comments — Non-Obvious Logic

Add a trailing `#` comment on the same line for short clarifications. Reserve this for:
- Magic numbers or threshold values
- Non-obvious default choices
- Bypasses or workarounds

```python
# Round to nearest minute so all workers produce the same run_id
time_based_run_id = str(round(self.start_time.timestamp() / 60) * 60)

cache.delete_memoized(_get_config, key)  # Must invalidate before returning
```

**Avoid** comments that just repeat what the code does:

```python
# BAD — this adds nothing
i += 1  # increment i

# GOOD — explains why
i += 1  # offset for 1-based ranking display
```

---

### 3. Block Comments — Sections Within Long Functions

Use a blank line + `#` comment block to delineate logical sections inside long functions:

```python
def create_app(config="CTFd.config.Config"):
    app = CTFdFlask(__name__)
    with app.app_context():
        app.config.from_object(config)

        # Initialize cache
        cache.init_app(app)

        # Configure Jinja2 template loaders
        loaders = []
        ...

        # Register database models
        db.init_app(app)
        ...

        # Register blueprints
        app.register_blueprint(views)
        ...
```

---

### 4. TODO / FIXME / NOTE Comments

Use consistent tags for deferred work:

| Tag | Meaning | Example |
|---|---|---|
| `# TODO:` | Feature or improvement to add later | `# TODO: Remove when Flask 3.x backport lands` |
| `# FIXME:` | Known bug or incorrect behavior that needs fixing | `# FIXME: Race condition when two workers start simultaneously` |
| `# NOTE:` | Important invariant, non-obvious constraint, or gotcha | `# NOTE: Flask-Caching cannot roundtrip None — use KeyError as sentinel` |
| `# HACK:` | Temporary workaround; document *why* it exists | `# HACK: Alembic sqlite support is lacking, create_all instead` |
| `# noqa:` | Suppress a specific linter rule inline | `from CTFd.models import db  # noqa: F401` |

Always include a brief explanation:

```python
# TODO: Backport of TRUSTED_HOSTS behavior from Flask. Remove when possible.
# https://github.com/pallets/flask/pull/5637
```

---

### 5. URL References

When a code pattern is derived from an external source (Stack Overflow, official docs, a GitHub issue), add the URL:

```python
# https://docs.sqlalchemy.org/en/13/dialects/sqlite.html#foreign-key-support
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
```

---

## Python Type Annotations

Use Python type hints instead of comments to express parameter and return types:

```python
# GOOD
def hash_password(plaintext: str) -> str:
    ...

def get_standings(count: int | None = None, bracket_id: int | None = None) -> list[Row]:
    ...

# AVOID — use type hints instead
def hash_password(plaintext):
    # plaintext: str, returns: str
    ...
```

For complex types, use `from __future__ import annotations` or `typing` imports.

---

## Commenting Polymorphic SQLAlchemy Models

When working with polymorphic models, document the discriminator and subclass relationship:

```python
class Submissions(db.Model):
    """Base table for all flag submission attempts.

    Polymorphic on `type`. Subclasses:
        - Solves     (type="correct")
        - Fails      (type="incorrect")
        - Partials   (type="partial")
        - Discards   (type="discard")
        - Ratelimiteds (type="ratelimited")
    """
    type = db.Column(db.String(32))
    __mapper_args__ = {"polymorphic_on": type}
```

---

## Commenting Plugin Extension Points

Plugin extension points (functions or classes that plugins override) should document what the plugin is expected to do:

```python
class BaseChallenge:
    """Base class for all CTFd challenge types.

    Plugin developers should subclass this and override the class methods below.
    Register the subclass using:
        CTFd.plugins.challenges.CHALLENGE_CLASSES["your_type"] = YourChallengeClass

    Methods to override:
        - attempt(cls, challenge, request): Validate a submitted flag.
        - solve(cls, user, team, challenge, request): Record a correct solve.
        - fail(cls, user, team, challenge, request): Record an incorrect attempt.
    """
```

---

## What Not to Comment

- **Obvious variable assignments:** `user_id = request.json["user_id"]  # get user id`
- **Standard library calls:** `db.session.commit()  # commit changes`
- **Re-stating the function name:** `# This function logs in the user`

---

## Linting and Formatting

Comments must comply with:
- **Line length:** max 88 characters (same as Black/flake8 default)
- **Import order:** managed by `isort` (configuration in `.isort.cfg`)
- **Style:** `flake8` is run in CI (`lint.yml` workflow)

Run locally:
```bash
isort --check-only .
flake8 .
```
