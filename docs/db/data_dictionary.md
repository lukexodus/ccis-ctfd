# Data Dictionary

This document provides definitions for every field in every table in the CTFd database, including data types, constraints, allowed values, and business context.

---

## How to Read This Document

- **Type** — SQLAlchemy type, maps to the native DB type (e.g. `INTEGER`, `VARCHAR(n)`, `TEXT`, `BOOLEAN`, `DATETIME`, `JSON`)
- **Nullable** — Whether the column accepts `NULL`
- **Default** — Value used if none is provided on insert
- **Constraints** — `PK` = primary key, `FK(table.col)` = foreign key, `UQ` = unique
- **Description** — Business semantics and allowed values

---

## `users`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique user identifier |
| `oauth_id` | INTEGER | Yes | — | UQ | External OAuth provider user ID; `null` if using local auth |
| `name` | VARCHAR(128) | Yes | — | — | Display name shown on scoreboard; not required to be unique (allows official/unofficial duplicates) |
| `password` | VARCHAR(128) | Yes | — | — | Bcrypt-hashed password; set via `validate_password` hook; `null` for OAuth-only accounts |
| `email` | VARCHAR(128) | Yes | — | UQ | Login identifier; must be unique across all users |
| `type` | VARCHAR(80) | Yes | `"user"` | — | Polymorphic discriminator: `"user"` (regular participant) or `"admin"` (administrator) |
| `secret` | VARCHAR(128) | Yes | — | — | Short-lived value used for password-reset email flows |
| `website` | VARCHAR(128) | Yes | — | — | Optional profile URL |
| `affiliation` | VARCHAR(128) | Yes | — | — | School, organization, or team affiliation string |
| `country` | VARCHAR(32) | Yes | — | — | ISO 3166-1 alpha-2 country code (e.g. `"PH"`, `"US"`) |
| `bracket_id` | INTEGER | Yes | — | FK(brackets.id) SET NULL | Scoreboard bracket assigned during registration; `null` if brackets not configured |
| `hidden` | BOOLEAN | Yes | `false` | — | When `true`, user does not appear on public scoreboard or user listings |
| `banned` | BOOLEAN | Yes | `false` | — | When `true`, user cannot submit flags or participate |
| `verified` | BOOLEAN | Yes | `false` | — | Email verification status; may be required to participate depending on config |
| `language` | VARCHAR(32) | Yes | `null` | — | BCP-47 language tag for UI localization preference (e.g. `"en"`, `"zh-CN"`) |
| `change_password` | BOOLEAN | Yes | `false` | — | When `true`, user is forced to change their password on next login |
| `team_id` | INTEGER | Yes | — | FK(teams.id) | Team this user belongs to; `null` in users mode or if not on a team |
| `created` | DATETIME | Yes | `utcnow` | — | UTC timestamp of account creation |

---

## `teams`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique team identifier |
| `oauth_id` | INTEGER | Yes | — | UQ | External OAuth provider team ID |
| `name` | VARCHAR(128) | Yes | — | — | Team display name; not constrained to be unique |
| `email` | VARCHAR(128) | Yes | — | UQ | Contact email for the team |
| `password` | VARCHAR(128) | Yes | — | — | Bcrypt-hashed team join password; users must know this to join |
| `secret` | VARCHAR(128) | Yes | — | — | Used internally for invite code generation |
| `website` | VARCHAR(128) | Yes | — | — | Team website URL |
| `affiliation` | VARCHAR(128) | Yes | — | — | Organization affiliation |
| `country` | VARCHAR(32) | Yes | — | — | ISO 3166-1 alpha-2 country code |
| `bracket_id` | INTEGER | Yes | — | FK(brackets.id) SET NULL | Scoreboard bracket; `null` if not assigned |
| `hidden` | BOOLEAN | Yes | `false` | — | Hides team from public scoreboard |
| `banned` | BOOLEAN | Yes | `false` | — | Prevents team from participating |
| `captain_id` | INTEGER | Yes | — | FK(users.id) SET NULL | User ID of the designated team captain |
| `created` | DATETIME | Yes | `utcnow` | — | UTC timestamp of team creation |

---

## `challenges`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique challenge identifier |
| `name` | VARCHAR(80) | Yes | — | — | Challenge title displayed to participants |
| `description` | TEXT | Yes | — | — | Markdown-formatted challenge body shown to participants |
| `attribution` | TEXT | Yes | — | — | Challenge author credit, rendered as Markdown |
| `connection_info` | TEXT | Yes | — | — | Remote service connection string (e.g. `nc host 1337`) |
| `next_id` | INTEGER | Yes | — | FK(challenges.id) SET NULL | ID of the challenge recommended as "Next" after this one |
| `max_attempts` | INTEGER | Yes | `0` | — | Maximum submission attempts; `0` means unlimited |
| `value` | INTEGER | Yes | — | — | Static point value; not used when dynamic scoring is active |
| `category` | VARCHAR(80) | Yes | — | — | Challenge category label (e.g. `"Web"`, `"Crypto"`) |
| `type` | VARCHAR(80) | Yes | `"standard"` | — | Polymorphic type; controls scoring logic. Built-in: `"standard"`. Plugin-defined types also possible. |
| `state` | VARCHAR(80) | No | `"visible"` | — | Visibility: `"visible"` (shown to participants) or `"hidden"` |
| `logic` | VARCHAR(80) | No | `"any"` | — | Flag collection mode: `"any"` (any flag accepted), `"all"` (every flag must be submitted), `"team"` (all members must submit) |
| `initial` | INTEGER | Yes | — | — | Starting point value for dynamic scoring |
| `minimum` | INTEGER | Yes | — | — | Minimum point value floor for dynamic scoring |
| `decay` | INTEGER | Yes | — | — | Number of solves after which value reaches `minimum` |
| `position` | INTEGER | No | `0` | — | Manual sort order for challenge display |
| `function` | VARCHAR(32) | Yes | `"static"` | — | Decay curve: `"static"`, `"linear"`, or `"logarithmic"` |
| `requirements` | JSON | Yes | — | — | JSON object `{"prerequisites": [id,...]}` listing challenge IDs that must be solved first |

---

## `flags`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique flag identifier |
| `challenge_id` | INTEGER | Yes | — | FK(challenges.id) CASCADE | Parent challenge |
| `type` | VARCHAR(80) | Yes | — | — | Flag matching algorithm: `"static"` (exact string), `"regex"` (regular expression) |
| `content` | TEXT | Yes | — | — | The flag string or regex pattern |
| `data` | TEXT | Yes | — | — | Extra options; for `"static"` type: `"case_insensitive"` enables case-insensitive matching |

---

## `hints`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique hint identifier |
| `title` | VARCHAR(80) | Yes | — | — | Preview title shown to users before unlocking |
| `type` | VARCHAR(80) | Yes | `"standard"` | — | Plugin-extensible hint type |
| `challenge_id` | INTEGER | Yes | — | FK(challenges.id) CASCADE | Parent challenge |
| `content` | TEXT | Yes | — | — | Hint text revealed after unlocking |
| `cost` | INTEGER | Yes | `0` | — | Points deducted when unlocked; `0` means free but still requires unlocking |
| `requirements` | JSON | Yes | — | — | JSON `{"prerequisites": [hint_id,...]}` — other hints that must be unlocked first |

---

## `solutions`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique solution identifier |
| `challenge_id` | INTEGER | Yes | — | FK(challenges.id) CASCADE, UQ | One solution per challenge |
| `content` | TEXT | Yes | — | — | Solution writeup in Markdown |
| `state` | VARCHAR(80) | No | `"hidden"` | — | Visibility: `"hidden"` (admin only), `"visible"` (anyone), `"solved"` (only users who solved the challenge) |

---

## `submissions`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique submission identifier |
| `challenge_id` | INTEGER | Yes | — | FK(challenges.id) CASCADE | Which challenge was attempted |
| `user_id` | INTEGER | Yes | — | FK(users.id) CASCADE | Submitting user |
| `team_id` | INTEGER | Yes | — | FK(teams.id) CASCADE | Submitting team (set in team mode) |
| `ip` | VARCHAR(46) | Yes | — | — | Client IP address (IPv4 max 15 chars; IPv6 max 39 chars; with zone ID up to 46) |
| `provided` | TEXT | Yes | — | — | The raw flag string submitted by the user |
| `type` | VARCHAR(32) | Yes | — | — | Result type: `"correct"`, `"incorrect"`, `"partial"`, `"discard"`, `"ratelimited"` |
| `date` | DATETIME | Yes | `utcnow` | — | UTC timestamp of the submission |

---

## `solves`

Inherits all columns from `submissions`. Additional constraints:

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | FK(submissions.id) CASCADE, PK | Links back to parent submission row |
| `challenge_id` | INTEGER | FK(challenges.id) CASCADE, UQ with `user_id` and `team_id` | Enforces at most one solve per user and per team |
| `user_id` | INTEGER | FK(users.id) CASCADE | Solving user |
| `team_id` | INTEGER | FK(teams.id) CASCADE | Solving team |

---

## `awards`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique award identifier |
| `user_id` | INTEGER | Yes | — | FK(users.id) CASCADE | Recipient user |
| `team_id` | INTEGER | Yes | — | FK(teams.id) CASCADE | Recipient team |
| `type` | VARCHAR(80) | Yes | `"standard"` | — | Award type (plugin-extensible) |
| `name` | VARCHAR(80) | Yes | — | — | Award display name |
| `description` | TEXT | Yes | — | — | Description shown to the recipient |
| `date` | DATETIME | Yes | `utcnow` | — | When the award was granted |
| `value` | INTEGER | Yes | — | — | Point value added to the recipient's score |
| `category` | VARCHAR(80) | Yes | — | — | Optional grouping category |
| `icon` | TEXT | Yes | — | — | Icon name or URL shown in the UI |
| `requirements` | JSON | Yes | — | — | Unlock prerequisites |

---

## `files`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique file record identifier |
| `type` | VARCHAR(80) | Yes | `"standard"` | — | Inheritance type: `"standard"`, `"challenge"`, `"page"`, `"solution"` |
| `location` | TEXT | Yes | — | — | Relative path used by the active upload provider (filesystem or S3 key) |
| `sha1sum` | VARCHAR(40) | Yes | — | — | 40-char SHA-1 hex digest of file contents |
| `challenge_id` | INTEGER | Yes | — | FK(challenges.id) CASCADE | Only set for `"challenge"` type files |
| `page_id` | INTEGER | Yes | — | FK(pages.id) | Only set for `"page"` type files |
| `solution_id` | INTEGER | Yes | — | FK(solutions.id) | Only set for `"solution"` type files |

---

## `tags`

| Field | Type | Nullable | Constraints | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | PK | Unique tag identifier |
| `challenge_id` | INTEGER | Yes | FK(challenges.id) CASCADE | Parent challenge |
| `value` | VARCHAR(80) | Yes | — | Tag text string |

---

## `topics`

| Field | Type | Nullable | Constraints | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | PK | Unique topic identifier |
| `value` | VARCHAR(255) | Yes | UQ | Topic label (e.g. `"Buffer Overflow"`, `"SQL Injection"`) — admin-visible only |

---

## `challenge_topics`

| Field | Type | Nullable | Constraints | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | PK | Row identifier |
| `challenge_id` | INTEGER | Yes | FK(challenges.id) CASCADE | Challenge being tagged |
| `topic_id` | INTEGER | Yes | FK(topics.id) CASCADE | Topic being applied |

---

## `unlocks`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique unlock record |
| `user_id` | INTEGER | Yes | — | FK(users.id) CASCADE | User who unlocked the resource |
| `team_id` | INTEGER | Yes | — | FK(teams.id) CASCADE | Team context for the unlock |
| `target` | INTEGER | Yes | — | — | ID of the unlocked resource (hint ID or solution ID) |
| `date` | DATETIME | Yes | `utcnow` | — | When the unlock occurred |
| `type` | VARCHAR(32) | Yes | — | — | Resource type unlocked: `"hints"` or `"solutions"` |

---

## `tracking`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique tracking event |
| `type` | VARCHAR(32) | Yes | — | — | Event type; e.g. `"challenges.open"` when a challenge is first viewed |
| `ip` | VARCHAR(46) | Yes | — | — | Client IP address |
| `target` | INTEGER | Yes | — | — | Resource ID of the target being accessed |
| `user_id` | INTEGER | Yes | — | FK(users.id) CASCADE | User performing the action |
| `date` | DATETIME | Yes | `utcnow` | — | Event timestamp |

---

## `notifications`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique notification identifier |
| `title` | TEXT | Yes | — | — | Notification headline |
| `content` | TEXT | Yes | — | — | Notification body in Markdown |
| `date` | DATETIME | Yes | `utcnow` | — | Sent timestamp |
| `user_id` | INTEGER | Yes | — | FK(users.id) | Target user; `null` = broadcast to all |
| `team_id` | INTEGER | Yes | — | FK(teams.id) | Target team; `null` = broadcast to all |

---

## `pages`

| Field | Type | Nullable | Constraints | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | PK | Unique page identifier |
| `title` | VARCHAR(80) | Yes | — | Navigation link text |
| `route` | VARCHAR(128) | Yes | UQ | URL path suffix (e.g. `/about`) |
| `content` | TEXT | Yes | — | Page body in Markdown or raw HTML |
| `draft` | BOOLEAN | Yes | — | `true` = not publicly accessible yet |
| `hidden` | BOOLEAN | Yes | — | `true` = not shown in navigation menus |
| `auth_required` | BOOLEAN | Yes | — | `true` = login required to view |
| `format` | VARCHAR(80) | Yes | — | Content format: `"markdown"` or `"html"` |
| `link_target` | VARCHAR(80) | Yes | — | HTML `target` attribute for nav link; e.g. `"_blank"` to open in new tab |

---

## `config`

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | INTEGER | No | Primary key |
| `key` | TEXT | Yes | Setting identifier (e.g. `"ctf_name"`, `"freeze"`, `"user_mode"`) |
| `value` | TEXT | Yes | Setting value (always stored as text; may represent int, bool, JSON, etc.) |

> **Note:** All CTFd application settings are stored here. Common keys include `ctf_name`, `ctf_description`, `user_mode` (`"users"` or `"teams"`), `freeze` (Unix timestamp for score freeze), `start`, `end`, and many more.

---

## `tokens`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique token record |
| `type` | VARCHAR(32) | Yes | — | — | Token type; currently only `"user"` (maps to `UserTokens`) |
| `user_id` | INTEGER | Yes | — | FK(users.id) CASCADE | Owning user |
| `created` | DATETIME | Yes | `utcnow` | — | Creation timestamp |
| `expiration` | DATETIME | Yes | `utcnow+30d` | — | Expiry timestamp; token is invalid after this |
| `description` | TEXT | Yes | — | — | Human-readable label for the token |
| `value` | VARCHAR(128) | Yes | — | UQ | The actual token string; starts with `ctfd_` prefix |

---

## `comments`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique comment identifier |
| `type` | VARCHAR(80) | Yes | `"standard"` | — | Target type: `"challenge"`, `"user"`, `"team"`, `"page"` |
| `content` | TEXT | Yes | — | — | Comment body in Markdown (sanitized on render) |
| `date` | DATETIME | Yes | `utcnow` | — | Posted timestamp |
| `author_id` | INTEGER | Yes | — | FK(users.id) CASCADE | Admin user who posted the comment |
| `challenge_id` | INTEGER | Yes | — | FK(challenges.id) CASCADE | Set when `type = "challenge"` |
| `user_id` | INTEGER | Yes | — | FK(users.id) CASCADE | Set when `type = "user"` |
| `team_id` | INTEGER | Yes | — | FK(teams.id) CASCADE | Set when `type = "team"` |
| `page_id` | INTEGER | Yes | — | FK(pages.id) CASCADE | Set when `type = "page"` |

---

## `fields`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique field definition |
| `name` | TEXT | Yes | — | — | Field label shown in registration form |
| `type` | VARCHAR(80) | Yes | `"standard"` | — | Polymorphic type: `"user"` or `"team"` controls which registration form it appears on |
| `field_type` | VARCHAR(80) | Yes | — | — | HTML input type: `"text"`, `"boolean"`, etc. |
| `description` | TEXT | Yes | — | — | Help text shown beneath the field |
| `required` | BOOLEAN | Yes | `false` | — | If `true`, users/teams must fill this field before participating |
| `public` | BOOLEAN | Yes | `false` | — | If `true`, the field value is shown on public user/team profiles |
| `editable` | BOOLEAN | Yes | `false` | — | If `true`, users can change their answer after initial submission |

---

## `field_entries`

| Field | Type | Nullable | Constraints | Description |
|---|---|---|---|---|
| `id` | INTEGER | No | PK | Unique entry identifier |
| `type` | VARCHAR(80) | Yes | — | `"user"` or `"team"` |
| `value` | JSON | Yes | — | Submitted value encoded as JSON |
| `field_id` | INTEGER | Yes | FK(fields.id) CASCADE | Field definition this entry answers |
| `user_id` | INTEGER | Yes | FK(users.id) CASCADE | Only set when `type = "user"` |
| `team_id` | INTEGER | Yes | FK(teams.id) CASCADE | Only set when `type = "team"` |

---

## `brackets`

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | INTEGER | No | Primary key |
| `name` | VARCHAR(255) | Yes | Bracket display name (e.g. `"Student"`, `"Professional"`) |
| `description` | TEXT | Yes | Optional description shown during registration |
| `type` | VARCHAR(80) | Yes | Which mode this bracket applies to: `"users"` or `"teams"` |

---

## `ratings`

| Field | Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `id` | INTEGER | No | auto-inc | PK | Unique rating record |
| `user_id` | INTEGER | Yes | — | FK(users.id) CASCADE | User who rated |
| `challenge_id` | INTEGER | Yes | — | FK(challenges.id) CASCADE | Rated challenge |
| `value` | INTEGER | Yes | — | — | Vote value (e.g. `1` = upvote, `-1` = downvote or custom scale) |
| `review` | VARCHAR(2000) | Yes | — | — | Optional text review (visible to admins only) |
| `date` | DATETIME | Yes | `utcnow` | — | Time of rating |

**Constraint:** UNIQUE(`user_id`, `challenge_id`) — one rating per user per challenge

---

## Enum-Like Values Reference

| Table | Column | Allowed Values |
|---|---|---|
| `users` | `type` | `user`, `admin` |
| `challenges` | `state` | `visible`, `hidden` |
| `challenges` | `logic` | `any`, `all`, `team` |
| `challenges` | `function` | `static`, `linear`, `logarithmic` |
| `flags` | `type` | `static`, `regex` |
| `submissions` | `type` | `correct`, `incorrect`, `partial`, `discard`, `ratelimited` |
| `solutions` | `state` | `hidden`, `visible`, `solved` |
| `unlocks` | `type` | `hints`, `solutions` |
| `pages` | `format` | `markdown`, `html` |
| `fields` | `type` | `user`, `team` |
| `brackets` | `type` | `users`, `teams` |
| `config` | `key` (selected) | `ctf_name`, `ctf_description`, `user_mode`, `start`, `end`, `freeze`, `theme`, `mail_server`, ... |
