# API Reference

> **Base URL:** `/api/v1`  
> **Version:** CTFd 3.8.2  
> **Format:** JSON  
> **Authentication:** See [api_auth_guide.md](api_auth_guide.md)

---

## Conventions

### Request Format

All write requests (`POST`, `PATCH`) must set:
```
Content-Type: application/json
```
with a JSON body. Some POST endpoints also accept `multipart/form-data` (file uploads, challenge creation).

### Response Envelope

```json
{ "success": true, "data": { ... } }
{ "success": true, "data": [ ... ], "meta": { "pagination": { ... } } }
{ "success": false, "errors": { "field": ["message"] } }
```

### Pagination

List endpoints that paginate include a `meta.pagination` object:

```json
"meta": {
  "pagination": {
    "page": 1,
    "next": 2,
    "prev": null,
    "pages": 5,
    "per_page": 50,
    "total": 243
  }
}
```

Use `?page=N` to advance through pages. Max `per_page` is 100.

### Authentication Header

```
Authorization: Token ctfd_<your_token>
```

### Admin vs. Player Views

Many list endpoints behave differently for admins:
- Add `?view=admin` to see hidden/banned records and all fields.
- Without `?view=admin`, banned and hidden records are excluded and sensitive fields are omitted.

---

## Challenges

### `GET /api/v1/challenges`

List all visible challenges.

**Auth:** Optional (anonymous may be allowed depending on `challenge_visibility`)  
**Time gate:** Yes (`during_ctf_time_only`)

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `name` | string | Filter by exact name |
| `category` | string | Filter by category |
| `type` | string | Filter by challenge type (`standard`, `dynamic`) |
| `state` | string | Filter by state (`visible`, `hidden`) — admin only practical |
| `value` | int | Filter by point value |
| `q` | string | Full-text search query |
| `field` | string | Field to search in (`name`, `description`, `category`, `type`, `state`) |
| `view` | string | `admin` — admin only; shows hidden challenges |

**Response `data` array item:**
```json
{
  "id": 1,
  "type": "standard",
  "name": "Hello World",
  "value": 100,
  "position": 0,
  "solves": 42,
  "solved_by_me": false,
  "category": "Web",
  "tags": [{ "value": "beginner" }],
  "template": "/plugins/challenges/assets/view.html",
  "script": "/plugins/challenges/assets/view.js"
}
```

---

### `POST /api/v1/challenges`

Create a challenge. **Admin only.**

**Body:**
```json
{
  "name": "My Challenge",
  "category": "Pwn",
  "description": "Description in **Markdown**",
  "value": 200,
  "type": "standard",
  "state": "visible",
  "max_attempts": 0,
  "connection_info": "nc 10.0.0.1 1337"
}
```

For dynamic challenges add:
```json
{
  "type": "dynamic",
  "initial": 500,
  "minimum": 50,
  "decay": 30,
  "function": "logarithmic"
}
```

**Response:** Full challenge object.

---

### `GET /api/v1/challenges/<challenge_id>`

Get a specific challenge with full detail (hints, files, tags, solve count, user rating).

**Auth:** Optional  
**Response `data`:**
```json
{
  "id": 1,
  "name": "Hello World",
  "description": "<rendered HTML>",
  "category": "Web",
  "value": 100,
  "type": "standard",
  "state": "visible",
  "solves": 42,
  "solved_by_me": true,
  "attempts": 2,
  "max_attempts": 5,
  "tags": ["beginner"],
  "files": ["/files/abc/challenge.zip?token=..."],
  "hints": [
    { "id": 1, "cost": 25, "title": "Hint 1" },
    { "id": 2, "cost": 0, "title": "Hint 2", "content": "Try SQL injection" }
  ],
  "rating": { "value": 1, "review": null },
  "ratings": { "up": 15, "down": 3, "count": 18 },
  "solution_id": null,
  "solution_state": "hidden",
  "view": "<rendered template HTML>",
  "connection_info": "nc 10.0.0.1 1337"
}
```

Hints show `content` only if already unlocked by the current user or after the CTF has ended.

---

### `PATCH /api/v1/challenges/<challenge_id>`

Update a challenge. **Admin only.** Accepts partial updates.

**Body:** Same fields as `POST /api/v1/challenges`.

---

### `DELETE /api/v1/challenges/<challenge_id>`

Delete a challenge and all associated data (flags, hints, files, solves). **Admin only.**

---

### `POST /api/v1/challenges/attempt`

Submit a flag.

**Auth:** Required  
**Body:**
```json
{ "challenge_id": 1, "submission": "CTF{flag_here}" }
```

**Response:**
```json
{ "success": true, "data": { "status": "correct", "message": "Correct" } }
```

Status values: `correct`, `incorrect`, `already_solved`, `paused`, `ratelimited`.  
See [api_error_reference.md](api_error_reference.md) for full status table.

**Admin preview mode:** `POST /api/v1/challenges/attempt?preview=true` — tests a flag without recording a solve.

---

### `GET /api/v1/challenges/types`

List all registered challenge types (templates, scripts). **Admin only.**

---

### `GET /api/v1/challenges/<challenge_id>/solves`

List solves for a challenge.

**Auth:** Optional (gated by score/account visibility settings)

---

### `GET /api/v1/challenges/<challenge_id>/files`

List files attached to a challenge. **Admin only for full listing.**

---

### `GET /api/v1/challenges/<challenge_id>/flags`

List flags for a challenge. **Admin only.**

---

### `GET /api/v1/challenges/<challenge_id>/hints`

List hints for a challenge. **Admin only.**

---

### `GET /api/v1/challenges/<challenge_id>/tags`

List tags for a challenge.

---

### `GET /api/v1/challenges/<challenge_id>/topics`

List topics for a challenge. **Admin only.**

---

### `GET /api/v1/challenges/<challenge_id>/comments`

List admin comments on a challenge. **Admin only.**

---

## Users

### `GET /api/v1/users`

List users (paginated, 50 per page).

**Auth:** Optional (gated by `account_visibility`)  
**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `affiliation` | string | Filter by affiliation |
| `country` | string | Filter by country code |
| `bracket` | string | Filter by bracket name |
| `q` | string | Full-text search |
| `field` | string | `name`, `website`, `country`, `bracket`, `affiliation`, or `email` (admin only) |
| `view` | string | `admin` (admin only) — shows hidden/banned users |

---

### `POST /api/v1/users`

Create a user. **Admin only.**

**Body:**
```json
{
  "name": "player1",
  "email": "player1@example.com",
  "password": "s3cur3!",
  "type": "user",
  "verified": true,
  "hidden": false,
  "banned": false
}
```

**Query:** `?notify=true` — sends the new user an email with their credentials.

---

### `GET /api/v1/users/<user_id>`

Get a user's public profile.

**Response includes:** `place`, `score`, profile fields (name, website, affiliation, country).

---

### `PATCH /api/v1/users/<user_id>`

Update a user. **Admin only.** Accepts partial updates.

---

### `DELETE /api/v1/users/<user_id>`

Delete a user and all associated data (solves, submissions, awards, tracking). **Admin only.**

---

### `GET /api/v1/users/me`

Get the currently authenticated user's private profile (includes actual score regardless of freeze/visibility).

**Auth:** Required

---

### `PATCH /api/v1/users/me`

Update the current user's own profile (name, password, website, country, affiliation, language).

**Auth:** Required

---

### `GET /api/v1/users/me/solves`

Get the current user's solves.

---

### `GET /api/v1/users/me/fails`

Get the current user's fail count (admins also get the full list).

---

### `GET /api/v1/users/me/awards`

Get the current user's awards.

---

### `GET /api/v1/users/me/submissions`

Get the current user's own submissions for a specific challenge. Requires config `view_self_submissions = true`.

**Query:** `?challenge_id=<id>`

---

### `GET /api/v1/users/<user_id>/solves`

Get a specific user's solves (public, gated by visibility settings).

---

### `GET /api/v1/users/<user_id>/fails`

Get a specific user's fail count.

---

### `GET /api/v1/users/<user_id>/awards`

Get a specific user's awards.

---

### `POST /api/v1/users/<user_id>/email`

Send an email to a user. **Admin only.** Rate limited: 10/min.

**Body:**
```json
{ "text": "Hello, here are your login details..." }
```

---

## Teams

### `GET /api/v1/teams`

List teams (paginated). Gated by `account_visibility`.

**Query:** `affiliation`, `country`, `bracket`, `q`, `field`, `view=admin`

---

### `POST /api/v1/teams`

Create a team. **Admin only.**

**Body:**
```json
{
  "name": "Team Rocket",
  "email": "team@example.com",
  "password": "joinpassword",
  "hidden": false,
  "banned": false
}
```

---

### `GET /api/v1/teams/<team_id>`

Get a team's public profile including `place` and `score`.

---

### `PATCH /api/v1/teams/<team_id>`

Update a team. **Admin only.**

---

### `DELETE /api/v1/teams/<team_id>`

Delete a team. **Admin only.**

---

### `GET /api/v1/teams/me`

Get the current user's team private profile. **Auth required, teams mode only.**

---

### `PATCH /api/v1/teams/me`

Update current user's team. Requires captain status or admin.

---

### `GET /api/v1/teams/<team_id>/solves`
### `GET /api/v1/teams/<team_id>/fails`
### `GET /api/v1/teams/<team_id>/awards`
### `GET /api/v1/teams/<team_id>/members`

Team stats and membership endpoints. Gated by visibility settings.

---

## Flags

### `GET /api/v1/flags`

List all flags. **Admin only.**

**Query:** `challenge_id`, `type`, `q`, `field`

---

### `POST /api/v1/flags`

Create a flag. **Admin only.**

**Body:**
```json
{
  "challenge_id": 1,
  "type": "static",
  "content": "CTF{example_flag}",
  "data": ""
}
```

For a case-insensitive static flag: `"data": "case_insensitive"`.  
For regex: `"type": "regex"`.

---

### `GET /api/v1/flags/<flag_id>`

Get a flag. **Admin only.**

---

### `PATCH /api/v1/flags/<flag_id>`

Update a flag. **Admin only.**

---

### `DELETE /api/v1/flags/<flag_id>`

Delete a flag. **Admin only.**

---

### `GET /api/v1/flags/types`

List all registered flag types. **Admin only.**

---

## Hints

### `GET /api/v1/hints`

List hints. **Admin only.**

---

### `POST /api/v1/hints`

Create a hint. **Admin only.**

**Body:**
```json
{
  "challenge_id": 1,
  "title": "Hint 1",
  "content": "Try looking at the headers",
  "cost": 25
}
```

---

### `GET /api/v1/hints/<hint_id>`

Get a hint. Content shown only if unlocked or admin.

---

### `PATCH /api/v1/hints/<hint_id>`

Update a hint. **Admin only.**

---

### `DELETE /api/v1/hints/<hint_id>`

Delete a hint. **Admin only.**

---

## Unlocks

### `GET /api/v1/unlocks`

List unlocks. **Auth required.**

---

### `POST /api/v1/unlocks`

Unlock a hint or solution (deducts cost from account score).

**Auth:** Required  
**Body:**
```json
{ "target": 3, "type": "hints" }
```

`type` is `"hints"` or `"solutions"`.

---

## Awards

### `GET /api/v1/awards`

List awards. **Admin only.**

---

### `POST /api/v1/awards`

Create an award. **Admin only.**

**Body:**
```json
{
  "user_id": 5,
  "name": "First Blood",
  "description": "First solve on challenge 1",
  "value": 50,
  "category": "special",
  "icon": "trophy"
}
```

---

### `GET /api/v1/awards/<award_id>`

Get an award. **Admin only.**

---

### `DELETE /api/v1/awards/<award_id>`

Delete an award. **Admin only.**

---

## Files

### `GET /api/v1/files`

List files. **Admin only.**

**Query:** `type` (`standard`, `challenge`, `page`, `solution`), `location`

---

### `POST /api/v1/files`

Upload a file. **Admin only.**  
Content-Type: `multipart/form-data`

**Form fields:**
- `file` — binary file upload
- `challenge_id` — (optional) attach to challenge
- `page_id` — (optional) attach to page
- `type` — `standard`, `challenge`, `page`, or `solution`

**Response:**
```json
{
  "success": true,
  "data": [{ "id": 1, "type": "challenge", "location": "abc123/file.zip", "sha1sum": "..." }]
}
```

---

### `DELETE /api/v1/files/<file_id>`

Delete a file. **Admin only.**

---

## Submissions

### `GET /api/v1/submissions`

List all submissions (paginated). **Admin only.**

**Query:** `challenge_id`, `user_id`, `team_id`, `ip`, `provided`, `type`, `q`, `field`

---

### `POST /api/v1/submissions`

Manually create a submission entry. **Admin only.**  
For normal flag submission use `POST /api/v1/challenges/attempt`.

---

### `GET /api/v1/submissions/<submission_id>`

Get a submission. **Admin only.**

---

### `PATCH /api/v1/submissions/<submission_id>`

Reclassify a submission (e.g., mark `incorrect` → `correct`). **Admin only.**

---

### `DELETE /api/v1/submissions/<submission_id>`

Delete a submission. **Admin only.**

---

## Notifications

### `GET /api/v1/notifications`

List all notifications. **Auth optional** (public notifications visible to all).

---

### `POST /api/v1/notifications`

Create a broadcast notification. **Admin only.**

**Body:**
```json
{
  "title": "Hint released",
  "content": "A new hint has been released for challenge 5.",
  "user_id": null,
  "team_id": null
}
```

Omit `user_id` / `team_id` for a global broadcast (delivered via SSE to all connected clients).

---

### `GET /api/v1/notifications/<notification_id>`

Get a notification.

---

### `DELETE /api/v1/notifications/<notification_id>`

Delete a notification. **Admin only.**

---

## Scoreboard

### `GET /api/v1/scoreboard`

Get the full scoreboard standings.

**Auth:** Optional (gated by `score_visibility` and `account_visibility`)  
**Cached:** Yes (60-second TTL)

**Response `data` array item (users mode):**
```json
{
  "pos": 1,
  "account_id": 7,
  "account_url": "/users/7",
  "account_type": "user",
  "oauth_id": null,
  "name": "player1",
  "score": 1500,
  "bracket_id": null,
  "bracket_name": null
}
```

In **teams mode**, each entry also has a `members` array with per-member scores.

---

### `GET /api/v1/scoreboard/top/<count>`

Get the top N accounts with time-series score history (for graphs). Max `count` = 50.

**Query:** `?bracket_id=<id>` — filter by bracket.

---

## Tags

### `GET /api/v1/tags`

List all tags. **Admin only.**

---

### `POST /api/v1/tags`

Create a tag. **Admin only.**

**Body:** `{ "challenge_id": 1, "value": "beginner" }`

---

### `GET /api/v1/tags/<tag_id>`
### `PATCH /api/v1/tags/<tag_id>`
### `DELETE /api/v1/tags/<tag_id>`

CRUD operations on individual tags. **Admin only.**

---

## Topics

### `GET | POST /api/v1/topics`

List or create topics. **Admin only.**

**POST body:** `{ "value": "buffer overflow" }`

---

### `GET | DELETE /api/v1/topics/<topic_id>`

Get or delete a topic. **Admin only.**

---

## Comments

### `GET /api/v1/comments`

List all admin comments. **Admin only.**

**Query:** `type` (`challenge`, `user`, `team`, `page`), `challenge_id`, `user_id`, `team_id`, `page_id`

---

### `POST /api/v1/comments`

Create a comment. **Admin only.**

**Body:**
```json
{
  "type": "challenge",
  "challenge_id": 1,
  "content": "Low quality challenge, revisit."
}
```

---

### `DELETE /api/v1/comments/<comment_id>`

Delete a comment. **Admin only.**

---

## Pages (CMS)

### `GET /api/v1/pages`

List CMS pages.

---

### `POST /api/v1/pages`

Create a page. **Admin only.**

**Body:**
```json
{
  "title": "Rules",
  "route": "rules",
  "content": "## Rules\n\n1. No sharing flags.",
  "format": "markdown",
  "draft": false,
  "hidden": false,
  "auth_required": false
}
```

---

### `GET | PATCH | DELETE /api/v1/pages/<page_id>`

CRUD on individual pages. **Admin only** for write operations.

---

## Tokens

### `GET /api/v1/tokens`

List your own tokens (id, type, expiration only — no `value`). **Auth required.**

---

### `POST /api/v1/tokens`

Create a token. **Auth required.**

**Body:**
```json
{ "expiration": "2026-12-31", "description": "My automation token" }
```

**Response includes the `value` field ONE TIME only.**

---

### `GET | DELETE /api/v1/tokens/<token_id>`

Get or delete a token. **Auth required.** Users can only access their own tokens; admins can access any.

---

## Configuration

### `GET /api/v1/config`

List all config keys. **Admin only.**

---

### `POST /api/v1/config`

Create a config entry. **Admin only.**

**Body:** `{ "key": "my_custom_key", "value": "my_value" }`

---

### `GET | PATCH | DELETE /api/v1/config/<config_key>`

Get, update, or delete a config value by key. **Admin only.**

---

## Awards

*(See Awards section above.)*

---

## Solutions

### `GET /api/v1/solutions`

List solutions. **Admin only.**

---

### `POST /api/v1/solutions`

Create or attach a solution to a challenge. **Admin only.**

**Body:**
```json
{
  "challenge_id": 1,
  "content": "## Solution\n\nThe flag was at `/flag.txt`...",
  "state": "hidden"
}
```

`state` options: `"hidden"` (never shown), `"visible"` (always shown), `"solved"` (shown after user solves it).

---

### `GET | PATCH | DELETE /api/v1/solutions/<solution_id>`

CRUD on individual solutions. **Admin only.**

---

## Exports

### `GET /api/v1/exports`

Trigger a CTF data export. **Admin only.**  
Returns a ZIP archive download of all CTF data.

---

## Brackets

### `GET /api/v1/brackets`

List all brackets.

---

### `POST /api/v1/brackets`

Create a bracket. **Admin only.**

**Body:**
```json
{ "name": "Student", "description": "Student competitors", "type": "users" }
```

`type`: `"users"` or `"teams"`.

---

### `GET | PATCH | DELETE /api/v1/brackets/<bracket_id>`

CRUD on individual brackets. **Admin only.**

---

## Shares

### `GET /api/v1/shares/<share_id>`

Get share metadata for a challenge solve (used for social sharing URLs).

---

## Statistics (Admin)

All under `/api/v1/statistics/` — **Admin only.**

| Endpoint | Description |
|---|---|
| `GET /api/v1/statistics/users/[<user_id>/]submissions` | Submission statistics for all users or a specific user |
| `GET /api/v1/statistics/challenges/[<challenge_id>/]submissions` | Submission statistics for all challenges or a specific challenge |
| `GET /api/v1/statistics/challenges/[<challenge_id>/]solves` | Solve statistics |
| `GET /api/v1/statistics/teams` | Team-level statistics |
