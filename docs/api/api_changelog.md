# API Changelog

Tracks API-level changes, additions, deprecations, and breaking changes across CTFd releases. Changes that affect only the Admin Panel UI, themes, or general application behavior are omitted — see the main [CHANGELOG.md](../CHANGELOG.md) for the full history.

> **Current version in this repo:** 3.8.2

---

## 3.8.2 — 2025-02-05

**Security**
- Fixes a vulnerability where a malicious admin could import a crafted ZIP to write files arbitrarily.

**Plugins / API behavior**
- Ratelimited submissions are now recorded as type `ratelimited` instead of `incorrect` in the `submissions` table — affects queries filtering by `type`.
- New `Ratelimiteds` submission model class (polymorphic identity `"ratelimited"`).
- New `BaseChallenge.ratelimited()` method creates `Ratelimiteds` rows.
- `ChallengeSolveException` is now raised inside `BaseChallenge.solve()` when a duplicate solve is encountered.
- Added `app.overridden_functions` global for plugin function overriding.

---

## 3.8.1 — 2025-11-06

**New Endpoints**
- `GET /api/v1/challenges/<challenge_id>/solution` — check if a challenge solution is accessible by the current user.

**Changed Behavior**
- `GET /api/v1/solutions/<solution_id>` now returns **404** (not 403) when a solution is hidden.

**New Fields**
- `Challenges` table now has `initial`, `decay`, `minimum`, `function` columns accessible via the standard challenge type — previously only available when using the `dynamic_challenges` plugin.
- `solution_state` added to `GET /api/v1/challenges/<challenge_id>` response (values: `hidden`, `visible`, `solved`).

**Configuration**
- `RUN_ID` config key added — stable cache-buster token for multi-worker deployments.
- `EXTRA_CONFIGS_FORCE_TYPES` config key added.

---

## 3.8.0 — 2025-09-04

**New Endpoints**
- `GET /api/v1/users/me/submissions` — users can retrieve their own past submissions (gated by `view_self_submissions` config).
- `GET /api/v1/challenges/<challenge_id>/solutions` — retrieve challenge solutions.
- `GET /api/v1/challenges/<challenge_id>/ratings` — user upvote/downvote rating; admin aggregation.
- `GET | POST /api/v1/solutions` — list and create challenge solutions.
- `GET | PATCH | DELETE /api/v1/solutions/<solution_id>` — manage individual solutions.

**New Fields**
- `GET /api/v1/challenges/<challenge_id>` now returns:
  - `ratings` — `{ "up": N, "down": N, "count": N }` (when `challenge_ratings = "public"`)
  - `rating` — current user's own rating `{ "value": 1, "review": null }`
  - `solution_id` — ID of visible solution, or `null`
  - `logic` — flag logic (`"any"`, `"all"`, `"team"`)
- `GET /api/v1/users/<user_id>` (admin view) now returns `change_password`.

**Unlocks**
- `POST /api/v1/unlocks` now also handles **solution unlocks** (`"type": "solutions"`), not just hints.

**Plugin API (breaking in CTFd 4.0)**
- Challenge type plugins should now return a `ChallengeResponse` object from `attempt()` instead of a `(bool, str)` tuple. Tuple behavior still supported until 4.0.
- New `BaseChallenge.partial()` for partial solve recording (`all` flag logic).

**Configuration (new)**
- `PRESET_ADMIN_NAME`, `PRESET_ADMIN_EMAIL`, `PRESET_ADMIN_PASSWORD`, `PRESET_ADMIN_TOKEN` added to `config.ini [management]` section.
- `PRESET_CONFIGS` — pre-set runtime config keys via `config.ini`.
- `EMAIL_CONFIRMATION_REQUIRE_INTERACTION` — adds extra button-click step to email confirmation.

---

## 3.7.7 — 2025-04-14

**Changed Behavior**
- `GET /api/v1/scoreboard/top/<count>` now returns at most the **top 50** accounts (hard cap).
- Fixed caching issue where different `count` values were returning the same cached response.

---

## 3.7.6 — 2025-02-19

**Configuration**
- `TRUSTED_HOSTS` configuration added to restrict CTFd to specific hostnames.

**Plugin API**
- Challenge type plugins can now raise `ChallengeCreateException` or `ChallengeUpdateException` from `create()`/`update()` to have their message surfaced as an API error.

---

## 3.7.5 — 2024-12-27

**Security**
- Email confirmation and password-reset tokens are now **single-use** (previously expired after 30 min only).

---

## 3.7.4 — 2024-10-08

**New Fields**
- `attribution` field added to `Challenges` model — available in `GET /api/v1/challenges/<challenge_id>`.

---

## 3.7.3 — 2024-07-24

**Security**
- Fixed issue where challenge solve counts and account names were visible despite `account_visibility` being disabled.

---

## 3.7.2 — 2024-06-18

**Changed Behavior**
- List endpoints with pagination no longer return **404** on out-of-range pages — they now return **200** with an empty `data` array.

**New Headers**
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` is now added to all responses (configurable via `CROSS_ORIGIN_OPENER_POLICY`).

---

## 3.7.1 — 2024-05-31

**New Endpoints**
- `GET /api/v1/exports/raw` — trigger a CTF data export via the API.

**New Fields / Query Params**
- `GET /api/v1/scoreboard/top/<count>` now returns `account_url`, `score`, and `bracket`.
- `GET /api/v1/scoreboard/top/<count>` accepts `?bracket_id=<id>` query parameter.
- `function` field added to DynamicValue challenge detail responses.

---

## 3.7.0 — 2024-02-26

**New Fields**
- `GET /api/v1/scoreboard` — added `bracket_name` and `bracket_id` to each entry.
- `GET /api/v1/files` — added `sha1sum` field.
- `POST /api/v1/files` — added `location` field to request body (allows API clients to control upload path).

---

## 3.6.1 — 2023-12-12

**New Query Parameters**
- `GET /api/v1/users` — `email` now accepted as a `field` query parameter (admin only).
- `GET /api/v1/teams` — `email` now accepted as a `field` query parameter (admin only).

**Changed Behavior**
- `POST /api/v1/files` now accepts `multipart/form-data` when using token authentication (previously required session cookie).
- `GET /api/v1/users/me`, `GET /api/v1/teams/me` — always return actual score regardless of `score_visibility` config.

---

## 3.6.0 — 2023-08-21

**New Endpoints**
- `PATCH /api/v1/submissions/<submission_id>` — reclassify a submission (e.g., mark incorrect → correct via `"type": "correct"`). Admins only.

**Token Changes** ⚠️
- API tokens now carry a **`ctfd_` prefix** in their `value` field.
- API tokens now have a **`description`** field.
- If you are parsing token values from previous versions, update your code to handle the prefix.

**Hint Behavior**
- `GET /api/v1/hints/<hint_id>` — free hints are now returned to **unauthenticated** users if challenges are publicly visible.

---

## 3.5.1 — 2023-01-23

**New Endpoints**
- `HEAD /api/v1/notifications` — returns the count of notifications and supports `?since_id=<id>` for cursor-based tracking.

**New Query Parameters**
- `GET /api/v1/notifications` — added `?since_id=<id>` parameter to fetch only new notifications.

**Performance**
- `GET /api/v1/challenges` and `GET /api/v1/challenges/<challenge_id>/solves` — solve count cached for improved response time.

**Configuration**
- Individual `DATABASE_*` and `REDIS_*` config keys added as alternatives to `DATABASE_URL` / `REDIS_URL`.

---

## 3.5.0 — 2022-05-09

**New Fields**
- The following endpoints now include a `meta.count` field:
  - `GET /api/v1/users/me/solves`
  - `GET /api/v1/users/me/fails`
  - `GET /api/v1/users/me/awards`
  - `GET /api/v1/teams/me/awards`
  - `GET /api/v1/users/<user_id>/solves`
  - `GET /api/v1/users/<user_id>/fails`
  - `GET /api/v1/users/<user_id>/awards`
  - `GET /api/v1/teams/<team_id>/solves`
  - `GET /api/v1/teams/<team_id>/awards`

**Plugin Deprecation**
- `CTFd._internal.challenge.render` and `CTFd._internal.challenge.renderer` in `view.js` are deprecated. Use the `challenge.html` attribute from the API response instead.

---

## 3.4.1 — 2022-02-19

**Performance**
- `GET /api/v1/challenges/<challenge_id>/solves` — improved response speed.

**New Fields**
- `SubmissionSchema` now includes nested `UserSchema` and `TeamSchema` for easier access to account name.

---

## 3.4.0 — 2021-08-11

**New Endpoints**
- `GET | POST /api/v1/topics` — admin CRUD for challenge topics.
- `GET /api/v1/challenges/<challenge_id>/topics` — list topics on a challenge (admin only).

**New Fields**
- `GET /api/v1/challenges/<challenge_id>` now returns `connection_info`.
- `GET /api/v1/users` now includes `team_id` field for each user.

**Changed Behavior**
- `GET /api/v1/challenges` now sorts by ID as a stable tiebreaker for consistent pagination.
- `PATCH /api/v1/teams/<team_id>` — only existing team members may be assigned as captain.
- Dynamic challenges: use `initial` keyword (not `value`) when creating via API. The `value` keyword is deprecated for dynamic types.

---

## 3.3.0 — 2021-03-26

**New Fields**
- `GET /api/v1/challenges` and `GET /api/v1/challenges/<challenge_id>` — added `solves` (solve count) and `solved_by_me` (bool).

**Changed Behavior**
- `DELETE /api/v1/users/<user_id>` — admins can no longer delete themselves (returns 400).
- `PATCH /api/v1/users/<user_id>` — fixed returning a list instead of a dict; fixed exception on admin demotion.
- Expired token responses now include a meaningful error message.

---

## 3.2.x and earlier

For changes prior to 3.3.0, refer to [CHANGELOG.md](../CHANGELOG.md) in the project root.

---

## Upcoming / Planned (CTFd 4.0)

> ⚠️ The following items are **deprecated** and will be **removed in CTFd 4.0:**

| Deprecated | Replacement |
|---|---|
| `(bool, str)` tuple return from `BaseChallenge.attempt()` | Return a `ChallengeResponse` object |
| `dynamic_challenges` plugin as separate type | Dynamic scoring integrated into `standard` type (already available in 3.8.1+) |
| `CTFd._internal.challenge.render` / `.renderer` in `view.js` | Use `challenge.html` from API response |
| `CTFd.utils.email.mailgun.sendmail` | Use `MailgunEmailProvider` class |
| `CTFd.utils.email.smtp.sendmail` | Use `SMTPEmailProvider` class |
