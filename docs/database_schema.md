# Database Schema

CTFd uses **SQLAlchemy** as its ORM and supports **SQLite**, **MySQL/MariaDB**, and **PostgreSQL**. All schema migrations are managed with **Alembic**.

---

## Table Overview

| Table | Description |
|---|---|
| `users` | Registered participants (and admins via polymorphism) |
| `teams` | Participant teams |
| `challenges` | CTF challenges |
| `flags` | Correct flag answers for challenges |
| `hints` | Hints available for challenges |
| `solutions` | Official writeup/solution for a challenge |
| `submissions` | All flag submission attempts |
| `solves` | Correct submissions (subset of `submissions`) |
| `awards` | Extra points/badges awarded to users or teams |
| `files` | Uploaded files (challenge files, page files, solution files) |
| `tags` | Labels/tags for challenges |
| `topics` | Knowledge topics |
| `challenge_topics` | Many-to-many: challenges ↔ topics |
| `unlocks` | Records of users/teams unlocking hints or solutions |
| `tracking` | User IP/activity tracking events |
| `notifications` | Admin-sent notifications |
| `pages` | Custom static/markdown pages |
| `config` | Key-value global configuration store |
| `tokens` | API access tokens |
| `comments` | Admin comments on challenges/users/teams/pages |
| `fields` | Custom registration field definitions |
| `field_entries` | Values submitted for custom fields |
| `brackets` | Scoreboard sub-divisions |
| `ratings` | User ratings/votes on challenges |

---

## Table Definitions

### `users`

Stores all registered participants. The `type` column is the SQLAlchemy polymorphic discriminator — `"admin"` records are linked to the `admins` virtual table.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `oauth_id` | INTEGER | Yes | — | OAuth provider user ID (unique) |
| `name` | VARCHAR(128) | Yes | — | Display name |
| `password` | VARCHAR(128) | Yes | — | Bcrypt-hashed password |
| `email` | VARCHAR(128) | Yes | — | Email address (unique) |
| `type` | VARCHAR(80) | Yes | `"user"` | Polymorphic type: `user` or `admin` |
| `secret` | VARCHAR(128) | Yes | — | Used for password-reset tokens |
| `website` | VARCHAR(128) | Yes | — | Personal website URL |
| `affiliation` | VARCHAR(128) | Yes | — | School/org affiliation |
| `country` | VARCHAR(32) | Yes | — | Two-letter country code |
| `bracket_id` | INTEGER | Yes | — | FK → `brackets.id` (SET NULL on delete) |
| `hidden` | BOOLEAN | Yes | `false` | If true, hidden from public scoreboard |
| `banned` | BOOLEAN | Yes | `false` | If true, cannot participate |
| `verified` | BOOLEAN | Yes | `false` | Email verification status |
| `language` | VARCHAR(32) | Yes | `null` | Preferred UI language code |
| `change_password` | BOOLEAN | Yes | `false` | Force password change on next login |
| `team_id` | INTEGER | Yes | — | FK → `teams.id` |
| `created` | DATETIME | Yes | `utcnow` | Account creation timestamp |

**Constraints:** UNIQUE(`id`, `oauth_id`), UNIQUE(`oauth_id`), UNIQUE(`email`)

---

### `teams`

Stores team accounts. Teams are used in *teams mode*; in *users mode* this table is unused.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `oauth_id` | INTEGER | Yes | — | OAuth provider team ID (unique) |
| `name` | VARCHAR(128) | Yes | — | Team display name |
| `email` | VARCHAR(128) | Yes | — | Team email (unique) |
| `password` | VARCHAR(128) | Yes | — | Bcrypt-hashed join password |
| `secret` | VARCHAR(128) | Yes | — | Invite secret |
| `website` | VARCHAR(128) | Yes | — | Team website |
| `affiliation` | VARCHAR(128) | Yes | — | School/org affiliation |
| `country` | VARCHAR(32) | Yes | — | Two-letter country code |
| `bracket_id` | INTEGER | Yes | — | FK → `brackets.id` (SET NULL on delete) |
| `hidden` | BOOLEAN | Yes | `false` | Hidden from scoreboard |
| `banned` | BOOLEAN | Yes | `false` | Banned from participating |
| `captain_id` | INTEGER | Yes | — | FK → `users.id` (SET NULL on delete) |
| `created` | DATETIME | Yes | `utcnow` | Team creation timestamp |

**Constraints:** UNIQUE(`id`, `oauth_id`), UNIQUE(`oauth_id`), UNIQUE(`email`)

---

### `challenges`

The central table for all CTF challenge content. Uses SQLAlchemy single-table polymorphism (discriminator: `type`). Dynamic scoring columns (`initial`, `minimum`, `decay`, `function`) were added in v3.8.1 to deprecate the separate `dynamic_challenge` plugin table.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `name` | VARCHAR(80) | Yes | — | Challenge title |
| `description` | TEXT | Yes | — | Markdown/HTML challenge body |
| `attribution` | TEXT | Yes | — | Author attribution text |
| `connection_info` | TEXT | Yes | — | Connection string / service info |
| `next_id` | INTEGER | Yes | — | FK → `challenges.id` (self-ref, SET NULL); next recommended challenge |
| `max_attempts` | INTEGER | Yes | `0` | Max flag submissions (0 = unlimited) |
| `value` | INTEGER | Yes | — | Point value (static challenges) |
| `category` | VARCHAR(80) | Yes | — | Category label |
| `type` | VARCHAR(80) | Yes | `"standard"` | Polymorphic type (`standard`, `dynamic`, etc.) |
| `state` | VARCHAR(80) | No | `"visible"` | Visibility: `visible` or `hidden` |
| `logic` | VARCHAR(80) | No | `"any"` | Flag logic: `any`, `all`, or `team` |
| `initial` | INTEGER | Yes | — | Starting score (dynamic scoring) |
| `minimum` | INTEGER | Yes | — | Floor score (dynamic scoring) |
| `decay` | INTEGER | Yes | — | Number of solves before minimum reached |
| `position` | INTEGER | No | `0` | Display ordering |
| `function` | VARCHAR(32) | Yes | `"static"` | Decay function: `static`, `linear`, `logarithmic` |
| `requirements` | JSON | Yes | — | Prerequisite challenge IDs as JSON |

---

### `flags`

Stores one or more acceptable flag strings per challenge. Polymorphic on `type` (e.g. `static`, `regex`).

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `challenge_id` | INTEGER | Yes | — | FK → `challenges.id` (CASCADE delete) |
| `type` | VARCHAR(80) | Yes | — | Flag type: `static`, `regex` |
| `content` | TEXT | Yes | — | The flag string or pattern |
| `data` | TEXT | Yes | — | Additional flag options (e.g. case sensitivity) |

---

### `hints`

Optional hints that users can unlock (for free or at a point cost).

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `title` | VARCHAR(80) | Yes | — | Hint title shown before unlocking |
| `type` | VARCHAR(80) | Yes | `"standard"` | Polymorphic type |
| `challenge_id` | INTEGER | Yes | — | FK → `challenges.id` (CASCADE delete) |
| `content` | TEXT | Yes | — | Hint text (revealed after unlock) |
| `cost` | INTEGER | Yes | `0` | Point cost to unlock |
| `requirements` | JSON | Yes | — | Prerequisite hint IDs |

---

### `solutions`

Stores an official admin-written solution for a challenge. One-to-one with `challenges`.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `challenge_id` | INTEGER | Yes | — | FK → `challenges.id` (CASCADE delete, unique) |
| `content` | TEXT | Yes | — | Solution text (Markdown) |
| `state` | VARCHAR(80) | No | `"hidden"` | Visibility: `hidden`, `visible`, or `solved` |

---

### `submissions`

Base table for all flag submission attempts. Polymorphic via `type`:

| Type | Meaning |
|---|---|
| `correct` | Correct solve (also in `solves`) |
| `incorrect` | Wrong answer |
| `partial` | Partial credit |
| `discard` | Admin-reclassified as correct |
| `ratelimited` | Submission blocked by rate limiting |

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `challenge_id` | INTEGER | Yes | — | FK → `challenges.id` (CASCADE delete) |
| `user_id` | INTEGER | Yes | — | FK → `users.id` (CASCADE delete) |
| `team_id` | INTEGER | Yes | — | FK → `teams.id` (CASCADE delete) |
| `ip` | VARCHAR(46) | Yes | — | IPv4 or IPv6 address of submitter |
| `provided` | TEXT | Yes | — | The submitted flag string |
| `type` | VARCHAR(32) | Yes | — | Polymorphic discriminator |
| `date` | DATETIME | Yes | `utcnow` | Submission timestamp |

---

### `solves`

Extends `submissions` for correct answers. Each `(challenge_id, user_id)` and `(challenge_id, team_id)` pair is unique — enforcing one solve per account per challenge.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER | FK → `submissions.id` (CASCADE), primary key |
| `challenge_id` | INTEGER | FK → `challenges.id` (CASCADE), UNIQUE with `user_id` and `team_id` |
| `user_id` | INTEGER | FK → `users.id` (CASCADE) |
| `team_id` | INTEGER | FK → `teams.id` (CASCADE) |

---

### `awards`

Manually assigned points or badges. Polymorphic on `type`.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `user_id` | INTEGER | Yes | — | FK → `users.id` (CASCADE delete) |
| `team_id` | INTEGER | Yes | — | FK → `teams.id` (CASCADE delete) |
| `type` | VARCHAR(80) | Yes | `"standard"` | Award type |
| `name` | VARCHAR(80) | Yes | — | Award title |
| `description` | TEXT | Yes | — | Award description |
| `date` | DATETIME | Yes | `utcnow` | Award timestamp |
| `value` | INTEGER | Yes | — | Point value |
| `category` | VARCHAR(80) | Yes | — | Award category |
| `icon` | TEXT | Yes | — | Icon name or URL |
| `requirements` | JSON | Yes | — | Unlock requirements |

---

### `files`

Single-table inheritance for all uploaded files. Polymorphic on `type`.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INTEGER | No | Primary key |
| `type` | VARCHAR(80) | Yes | `standard`, `challenge`, `page`, `solution` |
| `location` | TEXT | Yes | Relative storage path |
| `sha1sum` | VARCHAR(40) | Yes | SHA-1 of file contents |
| `challenge_id` | INTEGER | Yes | FK → `challenges.id` (only for `challenge` type) |
| `page_id` | INTEGER | Yes | FK → `pages.id` (only for `page` type) |
| `solution_id` | INTEGER | Yes | FK → `solutions.id` (only for `solution` type) |

---

### `tags`

Short label strings attached to a challenge (many per challenge).

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INTEGER | No | Primary key |
| `challenge_id` | INTEGER | Yes | FK → `challenges.id` (CASCADE) |
| `value` | VARCHAR(80) | Yes | Tag text |

---

### `topics`

Distinct knowledge topic strings (admin-only, not shown to participants).

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INTEGER | No | Primary key |
| `value` | VARCHAR(255) | Yes | Unique topic label |

---

### `challenge_topics`

Many-to-many join between challenges and topics.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INTEGER | No | Primary key |
| `challenge_id` | INTEGER | Yes | FK → `challenges.id` (CASCADE) |
| `topic_id` | INTEGER | Yes | FK → `topics.id` (CASCADE) |

---

### `unlocks`

Records that a user/team has unlocked a hint or solution. Polymorphic on `type`.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `user_id` | INTEGER | Yes | — | FK → `users.id` (CASCADE) |
| `team_id` | INTEGER | Yes | — | FK → `teams.id` (CASCADE) |
| `target` | INTEGER | Yes | — | ID of the unlocked resource |
| `date` | DATETIME | Yes | `utcnow` | Unlock timestamp |
| `type` | VARCHAR(32) | Yes | — | `hints` or `solutions` |

---

### `tracking`

IP address and activity tracking events for users.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `type` | VARCHAR(32) | Yes | — | Event type (e.g. `challenges.open`) |
| `ip` | VARCHAR(46) | Yes | — | User IP address |
| `target` | INTEGER | Yes | — | Resource ID being accessed |
| `user_id` | INTEGER | Yes | — | FK → `users.id` (CASCADE) |
| `date` | DATETIME | Yes | `utcnow` | Event timestamp |

---

### `notifications`

Broadcast messages sent by admins (optionally targeted to a user or team).

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `title` | TEXT | Yes | — | Notification title |
| `content` | TEXT | Yes | — | Markdown body |
| `date` | DATETIME | Yes | `utcnow` | Sent timestamp |
| `user_id` | INTEGER | Yes | — | FK → `users.id` (targeted user, optional) |
| `team_id` | INTEGER | Yes | — | FK → `teams.id` (targeted team, optional) |

---

### `pages`

Custom pages served by CTFd (Markdown or raw HTML).

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INTEGER | No | Primary key |
| `title` | VARCHAR(80) | Yes | Page title |
| `route` | VARCHAR(128) | Yes | URL path (unique) |
| `content` | TEXT | Yes | Page content |
| `draft` | BOOLEAN | Yes | If true, not published |
| `hidden` | BOOLEAN | Yes | Hidden from nav menus |
| `auth_required` | BOOLEAN | Yes | Requires login to view |
| `format` | VARCHAR(80) | Yes | `markdown` or `html` |
| `link_target` | VARCHAR(80) | Yes | Link target (e.g. `_blank`) |

---

### `config`

Global key-value store for all CTFd settings.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INTEGER | No | Primary key |
| `key` | TEXT | Yes | Setting name |
| `value` | TEXT | Yes | Setting value (always stored as text) |

---

### `tokens`

API access tokens. Polymorphic on `type` (`user` subtype = `UserTokens`).

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `type` | VARCHAR(32) | Yes | — | Token type |
| `user_id` | INTEGER | Yes | — | FK → `users.id` (CASCADE) |
| `created` | DATETIME | Yes | `utcnow` | Creation timestamp |
| `expiration` | DATETIME | Yes | `utcnow + 30d` | Expiry timestamp |
| `description` | TEXT | Yes | — | Human-readable description |
| `value` | VARCHAR(128) | Yes | — | Token string (unique, prefixed `ctfd_`) |

---

### `comments`

Admin-internal notes. Polymorphic on `type`:

| Type | Target |
|---|---|
| `challenge` | Column `challenge_id` → `challenges.id` |
| `user` | Column `user_id` → `users.id` |
| `team` | Column `team_id` → `teams.id` |
| `page` | Column `page_id` → `pages.id` |

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `type` | VARCHAR(80) | Yes | `"standard"` | Polymorphic type |
| `content` | TEXT | Yes | — | Comment body |
| `date` | DATETIME | Yes | `utcnow` | Posted timestamp |
| `author_id` | INTEGER | Yes | — | FK → `users.id` (CASCADE) |

---

### `fields`

Defines custom form fields shown during registration. Polymorphic on `type` (`user` fields vs `team` fields).

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `name` | TEXT | Yes | — | Field label |
| `type` | VARCHAR(80) | Yes | `"standard"` | `user` or `team` |
| `field_type` | VARCHAR(80) | Yes | — | Input type: `text`, `boolean`, etc. |
| `description` | TEXT | Yes | — | Help text |
| `required` | BOOLEAN | Yes | `false` | Whether the field must be filled |
| `public` | BOOLEAN | Yes | `false` | Visible on public profiles |
| `editable` | BOOLEAN | Yes | `false` | Whether users can edit after submission |

---

### `field_entries`

Values submitted by users/teams for custom fields. Polymorphic on `type`.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INTEGER | No | Primary key |
| `type` | VARCHAR(80) | Yes | `user` or `team` |
| `value` | JSON | Yes | Submitted value (stored as JSON) |
| `field_id` | INTEGER | Yes | FK → `fields.id` (CASCADE) |
| `user_id` | INTEGER | Yes | FK → `users.id` (CASCADE) — only for `user` type |
| `team_id` | INTEGER | Yes | FK → `teams.id` (CASCADE) — only for `team` type |

---

### `brackets`

Scoreboard sub-divisions (e.g. student, professional).

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | INTEGER | No | Primary key |
| `name` | VARCHAR(255) | Yes | Bracket label |
| `description` | TEXT | Yes | Description |
| `type` | VARCHAR(80) | Yes | `users` or `teams` |

---

### `ratings`

User ratings (vote + optional review) for challenges. One rating per user per challenge.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | auto | Primary key |
| `user_id` | INTEGER | Yes | — | FK → `users.id` (CASCADE) |
| `challenge_id` | INTEGER | Yes | — | FK → `challenges.id` (CASCADE) |
| `value` | INTEGER | Yes | — | Numeric vote (e.g. 1 = upvote, -1 = downvote) |
| `review` | VARCHAR(2000) | Yes | — | Text review (admin-only) |
| `date` | DATETIME | Yes | `utcnow` | Submitted at |

**Constraints:** UNIQUE(`user_id`, `challenge_id`)
