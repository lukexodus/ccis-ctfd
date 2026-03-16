# Authentication & Authorization Guide

> **Base URL:** `/api/v1`  
> **Version:** CTFd 3.8.2

---

## Overview

CTFd's REST API supports two authentication mechanisms. Both coexist and can be used interchangeably — the server checks them in this order on every request:

1. **API Token** (recommended for automation)
2. **Session Cookie** (used by the web UI)

If neither is present, the request is treated as **anonymous** (some endpoints allow anonymous access; others return `403`).

---

## 1. API Token Authentication

### How It Works

Generate a personal access token from the CTFd UI (`Settings → API Tokens`) or via the API itself (see below). Include it in every request using the `Authorization` header:

```http
Authorization: Token ctfd_<your_token_here>
```

### Token Format

| Property | Details |
|---|---|
| Prefix | `ctfd_` |
| Length | 128 chars total |
| Storage | Hashed — the raw value is only shown **once** at creation |
| Default expiry | 30 days from creation |
| Custom expiry | Pass `"expiration": "YYYY-MM-DD"` at creation |

### Generating a Token via the API

**Request:**
```http
POST /api/v1/tokens
Authorization: Token ctfd_<existing_token>   (or session cookie)
Content-Type: application/json

{
  "expiration": "2026-12-31",
  "description": "CI pipeline token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 12,
    "type": "user",
    "user_id": 5,
    "created": "2026-03-16T03:00:00Z",
    "expiration": "2026-12-31T00:00:00Z",
    "description": "CI pipeline token",
    "value": "ctfd_abc123..."
  }
}
```

> **Important:** The `value` field is only present in the **creation response**. Subsequent reads of the token omit it. Store the value securely.

### Listing Your Tokens

```http
GET /api/v1/tokens
Authorization: Token ctfd_<token>
```

Returns `id`, `type`, and `expiration` only (no `value`).

### Revoking a Token

```http
DELETE /api/v1/tokens/<token_id>
Authorization: Token ctfd_<token>
```

---

## 2. Session Cookie Authentication

The web UI authenticates by POSTing credentials to `/login` and receiving a `session` cookie. Subsequent requests from the same browser automatically carry the cookie.

### Login Flow (for programmatic use)

```
1. GET /login                     → obtain CSRF nonce from HTML
2. POST /login
     name=<username_or_email>
     password=<password>
     nonce=<csrf_nonce>           → server sets Set-Cookie: session=...
3. All subsequent requests include Cookie: session=...
```

#### CSRF Nonce

Every state-changing request (POST/PATCH/DELETE via session) must include the CSRF nonce. It can be obtained from:
- The hidden `<input name="nonce">` field on any rendered page.
- The response of `GET /api/v1/...` when authenticated — the nonce is stored in `session["nonce"]`.
- Requests using API tokens bypass CSRF checks entirely.

> **Tip:** For scripting and CI/CD, always prefer API tokens over session cookies to avoid CSRF complexity.

---

## 3. Authorization Levels

| Level | Requirement | API enforcement |
|---|---|---|
| **Anonymous** | No credentials | Some GET endpoints only |
| **Authenticated User** | Valid session or token | `@authed_only` decorator |
| **Verified User** | `users.verified = true` | `@require_verified_emails` decorator |
| **Admin** | `users.type = "admin"` | `@admins_only` decorator |

### Visibility Modifiers

Some endpoints further check CTFd runtime configuration:

| Decorator | Config key | Effect |
|---|---|---|
| `@check_challenge_visibility` | `challenge_visibility` | Hides challenges unless `public` or user is admin |
| `@check_account_visibility` | `account_visibility` | Hides user/team lists unless `public` |
| `@check_score_visibility` | `score_visibility` | Hides score endpoints unless `public` |
| `@during_ctf_time_only` | `start` / `end` | Blocks access outside the competition window |

### Admin-Only Endpoints

The following are exclusively available to `type="admin"` users regardless of tokens:

- `POST /api/v1/challenges` (create)
- `PATCH /api/v1/challenges/<id>` (update)
- `DELETE /api/v1/challenges/<id>` (delete)
- `GET /api/v1/submissions` and sub-operations
- `GET /api/v1/users?view=admin`
- `POST /api/v1/users` (create user)
- All `/api/v1/config` endpoints
- All `/api/v1/statistics/*` endpoints
- `GET /api/v1/challenges/types`

### Preset Admin Bypass

If `PRESET_ADMIN_NAME`, `PRESET_ADMIN_EMAIL`, and `PRESET_ADMIN_PASSWORD` are set in `config.ini`, login with those credentials generates or retrieves a superuser account — useful for automated provisioning without pre-existing database records.

---

## 4. Rate Limiting

Rate limiting applies to both authentication endpoints and flag submission. Limits are enforced via Redis/cache counters per IP (or per user for flag attempts).

| Surface | Limit |
|---|---|
| `POST /login` | 10 per 5 s |
| `POST /register` | 10 per 5 s |
| `POST /reset_password` | 10 per 60 s; additionally 5 per user per 3 min |
| `POST /confirm` | 10 per 60 s |
| `POST /api/v1/challenges/attempt` | 10 incorrect per 60 s (configurable via `incorrect_submissions_per_min`) |
| `POST /api/v1/users/<id>/email` | 10 per 60 s |

When a rate limit is exceeded, the challenge attempt endpoint returns:

```json
HTTP 429
{
  "success": true,
  "data": {
    "status": "ratelimited",
    "message": "You're submitting flags too fast. Try again in 42 seconds."
  }
}
```

---

## 5. Common Authentication Errors

| HTTP Status | `success` | Meaning | Fix |
|---|---|---|---|
| `401 Unauthorized` | `false` | No credentials provided | Add `Authorization: Token ctfd_...` |
| `403 Forbidden` | `false` | Authenticated but insufficient role / CTF not started | Use admin token; check CTF timing |
| `403 Forbidden` | `true` | Challenge attempt returned `authentication_required` | Log in first before submitting flags |
| `429 Too Many Requests` | `true` | Rate limited (submission endpoint) | Wait the indicated number of seconds |

---

## 6. Token Security Best Practices

1. **Never commit tokens** to source control. Use environment variables or secret managers.
2. **Set expiry dates** appropriate to the usage window (short-lived for one-off scripts).
3. **Revoke immediately** after use for temporary automation tasks.
4. **Use least privilege**: regular user tokens cannot perform admin operations even if passed to admin endpoints.
5. **Store as env var**: `CTFD_TOKEN=ctfd_...` and reference via `Authorization: Token $CTFD_TOKEN`.
