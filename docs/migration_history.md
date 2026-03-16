# Migration History

CTFd uses **Alembic** (via Flask-Migrate) for database schema version control. All migration files are located in `migrations/versions/`.

The initial schema was established on **2018-11-05** (revision `8369118943a1`). Each entry below is ordered chronologically and documents what changed.

---

## Migration Chain

```
8369118943a1 (Initial)
    └── 4e4d5a9ea000  add type to awards
    └── 5c98d9253f56  rename core-beta to core
    └── 67ebab6de598  add dynamic scoring columns
    └── 48d8250d19bd  add position to challenges
    └── 4d3c1b59d011  add next_id to challenges
    └── 6012fe8de495  add connection_info to challenges
    └── 080d729 b15cd3 add tokens table
    └── 9e6f6578ca84  add description to tokens
    └── 0366ba6575ca  add comments table
    └── 75e8ab9a0014  add fields and field_entries tables
    └── 07dfbe5e1edc  add format to pages
    └── a02c5bf43407  add link_target to pages
    └── 0def790057c1  add language to users
    └── 46a278193a94  enable millisecond precision (MySQL)
    └── 55623b100da8  add target to tracking
    └── b295b033364d  add ON DELETE CASCADE to foreign keys
    └── 5c4996aeb2cb  add sha1sum to files
    └── b5551cd26764  add captain to teams
    └── 9889b8c53673  add brackets table
    └── ef87d69ec29a  add topics and challenge_topics
    └── a49ad66aa0f1  add title to hints
    └── 4fe3eeed9a9d  add attribution to challenges
    └── a03403986a32  add theme code injection configs
    └── 1093835a1051  add default email templates
    └── 364b4efa1686  add ratings table
    └── 24ad6790bc3c  convert rating values to votes
    └── f73a96c97449  add logic to challenges
    └── 62bf576b2cd3  add solutions table
    └── 662d728ad7da  add change_password to users
    └── 48d8250d19bd  add position to challenges
```

---

## Detailed Migration Log

### `8369118943a1` — Initial Revision
**Date:** 2018-11-05  
**Description:** Creates the full initial schema.

**Tables created:**
- `challenges` — core challenge data
- `config` — key-value settings
- `pages` — custom pages
- `teams` — team accounts
- `dynamic_challenge` — dynamic scoring data (deprecated in v3.8.1)
- `files` — file uploads
- `flags` — flag answers
- `hints` — hints per challenge
- `tags` — challenge labels
- `users` — participant accounts
- `awards` — bonus points
- `notifications` — admin messages
- `submissions` — all flag attempts
- `tracking` — IP/activity log
- `unlocks` — hint unlock records
- `solves` — correct submission records

---

### `4e4d5a9ea000` — Add `type` to `awards`
Added the `type` VARCHAR(80) column to `awards` to support polymorphic award types (e.g. for plugin-defined award subtypes).

---

### `5c98d9253f56` — Rename `core-beta` Theme
Schema migration accompanying the promotion of the `core-beta` theme to `core`. Updates internal config values referencing the old theme name.

---

### `67ebab6de598` — Add Dynamic Scoring Columns to `challenges`
Added `initial`, `minimum`, and `decay` columns directly to the `challenges` table. These columns were previously only on the `dynamic_challenge` joined table, and were moved here to support integrating dynamic scoring into the standard challenge type.

| Column | Type | Description |
|---|---|---|
| `initial` | INTEGER | Starting point value |
| `minimum` | INTEGER | Floor value |
| `decay` | INTEGER | Decay step count |

---

### `48d8250d19bd` — Add `position` to `challenges`
Added `position` INTEGER column (default `0`) to `challenges` for manual ordering of challenge display.

---

### `4d3c1b59d011` — Add `next_id` to `challenges`
Added `next_id` INTEGER self-referencing foreign key to `challenges.id` (SET NULL on delete). Enables admins to define a "next challenge" recommendation.

---

### `6012fe8de495` — Add `connection_info` to `challenges`
Added `connection_info` TEXT column to `challenges`. Stores remote service address or connection string for infrastructure-based challenges.

---

### `080d29b15cd3` — Add `tokens` Table
Created the `tokens` table to store API access tokens.

**Columns:** `id`, `type`, `user_id` (FK → `users`), `created`, `expiration`, `value`

---

### `9e6f6578ca84` — Add `description` to `tokens`
Added `description` TEXT column to `tokens` so users can label their API tokens.

---

### `0366ba6575ca` — Add `comments` Table
Created the `comments` table for admin-internal notes on challenges, users, teams, and pages.

**Columns:** `id`, `type`, `content`, `date`, `author_id`, `challenge_id`, `user_id`, `team_id`, `page_id`

---

### `75e8ab9a0014` — Add `fields` and `field_entries` Tables
Introduced custom registration fields system.

**Tables created:**
- `fields` — field definitions
- `field_entries` — user/team field responses

---

### `07dfbe5e1edc` — Add `format` to `pages`
Added `format` VARCHAR(80) column (default `"markdown"`) to `pages`. Allows pages to be authored in raw HTML.

---

### `a02c5bf43407` — Add `link_target` to `pages`
Added `link_target` VARCHAR(80) nullable column to `pages` to control the HTML `target` attribute of navigation links (e.g. `"_blank"` for new tab).

---

### `0def790057c1` — Add `language` to `users`
Added `language` VARCHAR(32) nullable column to `users` for storing the user's preferred UI language (BCP-47 tag).

---

### `46a278193a94` — Enable Millisecond Precision in MySQL
For MySQL/MariaDB deployments, changed `DATETIME` columns to `DATETIME(6)` to enable microsecond-level precision. No effect on SQLite or PostgreSQL.

**Affected tables:** `submissions`, `solves`, `awards`, `notifications`, `tracking`, `tokens`, `users`, `teams`

---

### `55623b100da8` — Add `target` Column to `tracking`
Added `target` INTEGER nullable column to `tracking` to record which specific resource (challenge, page, etc.) the tracking event refers to.

---

### `b295b033364d` — Add `ON DELETE CASCADE` to Foreign Keys
Retroactively applied `ON DELETE CASCADE` to numerous foreign key constraints across the schema to ensure proper data cleanup when parent records are deleted.

**Tables affected:** `awards`, `files`, `flags`, `hints`, `notifications`, `solves`, `submissions`, `tags`, `tracking`, `unlocks`, and others.

---

### `5c4996aeb2cb` — Add `sha1sum` to `files`
Added `sha1sum` VARCHAR(40) column to `files` to store the SHA-1 hash of uploaded file contents, enabling change detection and integrity verification.

---

### `b5551cd26764` — Add `captain_id` to `teams`
Added `captain_id` INTEGER foreign key (→ `users.id`, SET NULL on delete) to `teams`. Introduced the concept of a designated team captain.

Also created the `admins` virtual table (if not existing) as part of the joined-table inheritance setup for admin users.

---

### `9889b8c53673` — Add `brackets` Table
Created the `brackets` table and added `bracket_id` foreign key columns to both `users` and `teams`.

**Table:** `brackets` — `id`, `name`, `description`, `type`

Also removed the old `bracket` VARCHAR(32) columns from `users` and `teams` (replaced by the FK).

---

### `ef87d69ec29a` — Add `topics` and `challenge_topics` Tables
Created two new tables for admin-only challenge topic tagging.

**Tables created:**
- `topics` — distinct topic strings
- `challenge_topics` — many-to-many join

---

### `a49ad66aa0f1` — Add `title` to `hints`
Added `title` VARCHAR(80) column to `hints`. The title is shown to users as a preview before they unlock the hint.

---

### `4fe3eeed9a9d` — Add `attribution` to `challenges`
Added `attribution` TEXT column to `challenges` for challenge author credit (rendered as Markdown).

---

### `a03403986a32` — Add Theme Code Injection Configs
Added default config entries for `theme_header` and `theme_footer` code injection fields used in the Admin Panel theme customization.

*(Config-data migration, no schema change.)*

---

### `1093835a1051` — Add Default Email Templates
Inserted default config values for email template keys (`verify_email_body`, `successful_registration_email_body`, etc.).

*(Config-data migration, no schema change.)*

---

### `364b4efa1686` — Add `ratings` Table
Created the `ratings` table to support user voting/rating on challenges.

**Columns:** `id`, `user_id`, `challenge_id`, `value`, `date`
**Constraint:** UNIQUE(`user_id`, `challenge_id`)

---

### `24ad6790bc3c` — Convert Rating Values to Votes
Updated the `ratings` table: renamed the vote column and added a `review` VARCHAR(2000) nullable column for optional text reviews. Existing numeric rating values (1–5 scale) were converted to a vote model.

---

### `f73a96c97449` — Add `logic` to `challenges`
Added `logic` VARCHAR(80) NOT NULL (default `"any"`) to `challenges`. Controls flag collection behavior:
- `any` — any one flag is accepted
- `all` — every flag must be submitted
- `team` — all team members must submit a flag

---

### `62bf576b2cd3` — Add `solutions` Table
Created the `solutions` table to store admin-written official challenge solutions.

**Columns:** `id`, `challenge_id` (unique FK → `challenges`), `content`, `state`

Also added `solution_id` FK to the `files` table for solution file attachments.

---

### `662d728ad7da` — Add `change_password` to `users`
Added `change_password` BOOLEAN (default `false`) to `users`. When `true`, the user is required to set a new password on their next login, an admin-controlled access management feature.

---

## Version Upgrade Path (Pre-2.0)

For users upgrading from CTFd 1.x to 2.x, a separate migration script is provided:

**File:** `migrations/1_2_0_upgrade_2_0_0.py`

This script handles the structural changes between 1.x and 2.0, which included a significant refactoring of the user/team model.

---

## Running Migrations

```bash
# Apply all pending migrations
flask db upgrade

# Revert the last migration
flask db downgrade

# Check current migration version
flask db current

# Show migration history
flask db history
```

> Migrations are applied automatically on CTFd startup via the `upgrade()` call in `CTFd/__init__.py`.
