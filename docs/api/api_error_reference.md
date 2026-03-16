# Error Code Reference

> **Version:** CTFd 3.8.2

---

## Response Envelope

Every CTFd API response uses a consistent JSON envelope:

```json
{
  "success": true | false,
  "data":   { ... }       // present on success
}
```

```json
{
  "success": false,
  "errors": {
    "field_name": ["Error message 1", "Error message 2"],
    "":           ["General error not tied to a field"]
  }
}
```

> **Note:** The challenge attempt endpoint is a special case — even error-like status responses (ratelimited, already solved, incorrect) return `"success": true` and encode the result in `data.status`. See [Challenge Attempt Statuses](#challenge-attempt-statuses) below.

---

## HTTP Status Codes

### 2xx — Success

| Code | Meaning | When returned |
|---|---|---|
| `200 OK` | Request succeeded | All successful GET, POST, PATCH, DELETE |

### 4xx — Client Errors

| Code | Meaning | Common causes |
|---|---|---|
| `400 Bad Request` | Validation failure or bad input | Missing required field, invalid email, schema validation error, malformed JSON |
| `401 Unauthorized` | Not authenticated | Missing or expired session/token |
| `403 Forbidden` | Authenticated but not allowed | Insufficient role, CTF not started, challenge locked, prerequisite not met, teams mode without team, banned/hidden user |
| `404 Not Found` | Resource does not exist | Invalid ID, hidden challenge accessed by non-admin |
| `429 Too Many Requests` | Rate limit exceeded | Too many flag submissions; password reset flood |

### 5xx — Server Errors

| Code | Meaning | Common causes |
|---|---|---|
| `500 Internal Server Error` | Unhandled exception | Challenge plugin error (`ChallengeCreateException`, `ChallengeUpdateException`), missing challenge type plugin |
| `502 Bad Gateway` | Upstream error | Reverse proxy misconfiguration |

---

## Challenge Attempt Statuses

`POST /api/v1/challenges/attempt` returns `HTTP 200` (or `403`/`429`) with a `data.status` string regardless of outcome:

| `data.status` | HTTP | Meaning |
|---|---|---|
| `"correct"` | 200 | Flag accepted; solve recorded |
| `"incorrect"` | 200 | Flag rejected; fail recorded |
| `"already_solved"` | 200 | User/team already solved this challenge |
| `"paused"` | 403 | CTF is currently paused |
| `"ratelimited"` | 429 | Submitting too fast — see `data.message` for wait time |
| `"ratelimited"` | 403 | Max attempts exhausted (`lockout` behavior) |
| `"authentication_required"` | 403 | Not logged in |

**Example — correct submission:**
```json
HTTP 200
{
  "success": true,
  "data": {
    "status": "correct",
    "message": "Correct"
  }
}
```

**Example — lockout:**
```json
HTTP 403
{
  "success": true,
  "data": {
    "status": "ratelimited",
    "message": "Not accepted. You have 0 tries remaining"
  }
}
```

**Example — too fast:**
```json
HTTP 429
{
  "success": true,
  "data": {
    "status": "ratelimited",
    "message": "You're submitting flags too fast. Try again in 23 seconds."
  }
}
```

---

## Validation Errors

Validation errors return `HTTP 400` with an `errors` object. Keys are field names; `""` is used for non-field errors.

```json
HTTP 400
{
  "success": false,
  "errors": {
    "name":     ["That user name is already taken"],
    "email":    ["Please enter a valid email address"],
    "password": ["Pick a longer password"],
    "":         ["The registration code you entered was incorrect"]
  }
}
```

### Common Validation Error Messages

| Context | Field | Message |
|---|---|---|
| Registration | `name` | `"That user name is already taken"` |
| Registration | `name` | `"Pick a longer user name"` |
| Registration | `name` | `"Your user name cannot be an email address"` |
| Registration | `email` | `"Please enter a valid email address"` |
| Registration | `email` | `"That email has already been used"` |
| Registration | `email` | `"Your email address is not from an allowed domain"` |
| Registration | `password` | `"Pick a longer password"` |
| Registration | `password` | `"Pick a shorter password"` |
| Registration | `password` | `"Password must be at least N characters"` |
| Registration | `website` | `"Websites must be a proper URL starting with http or https"` |
| Registration | `country` | `"Invalid country"` |
| Registration | `affiliation` | `"Please provide a shorter affiliation"` |
| Registration | `bracket_id` | `"Please provide a valid bracket"` |
| Registration | `""` | `"The registration code you entered was incorrect"` |
| Registration | `""` | `"Please provide all required fields"` |
| User management | `id` | `"You cannot ban yourself"` |
| User management | `id` | `"You cannot delete yourself"` |
| Teams | `""` | `"Teams are limited to N member(s)"` |
| Tokens | — | _Schema validation message if expiration format invalid_ |
| Password reset | `""` | `"Too many password reset attempts. Please try again later."` |
| Config | `""` | `"Email settings not configured"` |

---

## Error Scenarios by Endpoint

### `GET /api/v1/challenges`

| Condition | HTTP | `success` | Notes |
|---|---|---|---|
| CTF not started / ended | 403 | false | `@during_ctf_time_only` |
| Challenge visibility = private | 403 | false | `@check_challenge_visibility` |
| Unverified email (if required) | 403 | false | `@require_verified_emails` |
| Teams mode, no team | 403 | false | Manual check inside handler |

### `GET /api/v1/challenges/<id>`

| Condition | HTTP | Notes |
|---|---|---|
| Challenge hidden/locked | 404 | Non-admin gets 404 |
| Challenge type plugin missing | 500 | `KeyError` on plugin map |
| Prerequisite not met + not anonymous | 403 | Unless `anonymize=true`, then anonymized response |

### `POST /api/v1/challenges/attempt`

See [Challenge Attempt Statuses](#challenge-attempt-statuses) above.

### `POST /api/v1/tokens`

| Condition | HTTP | Notes |
|---|---|---|
| Invalid expiration format | 400 | Must be `"YYYY-MM-DD"` |
| Not authenticated | 403 | `@authed_only` |
| Email not verified | 403 | `@require_verified_emails` |

### `POST /api/v1/users` (admin)

| Condition | HTTP | Notes |
|---|---|---|
| Duplicate email | 400 | Schema validation |
| Invalid field types | 400 | Schema validation |

---

## HTML Error Pages

The following HTTP codes render themed error HTML pages (or fall through to Werkzeug defaults if the template is missing):

| HTTP Code | Template |
|---|---|
| 403 | `errors/403.html` |
| 404 | `errors/404.html` |
| 500 | `errors/500.html` |
| 502 | `errors/502.html` |

These are registered via `app.register_error_handler(code, render_error)` in `CTFd/__init__.py`.

---

## Debugging Tips

1. **Check `errors` key**: all validation failures populate `errors` with field-keyed messages.
2. **Watch the HTTP status**: `success: true` with a non-200 status means a domain-level rejection (e.g. ratelimited flag submission).
3. **Admin view**: add `?view=admin` to list endpoints when using an admin token to bypass visibility filters.
4. **Logs**: server-side errors are written to `CTFd/logs/` — check `logins.log` for auth failures and the Flask logs for 500s.
