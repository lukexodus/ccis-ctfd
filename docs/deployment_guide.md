# Deployment Guide

This guide covers how to deploy CTFd to a staging or production environment using **Docker Compose** (recommended) or a manual server setup.

---

## Architecture Overview

```
Internet
    │
    ▼
[ nginx :80 ]        ← Reverse proxy, gzip, SSE handling
    │
    ▼
[ CTFd :8000 ]       ← gunicorn + gevent workers (Python 3.11)
    │           │
    ▼           ▼
[ MariaDB ] [ Redis ]   ← Persistence (MariaDB 10.11) + Cache (Redis 4)
```

All four services are isolated on a Docker `internal` network; only `nginx` is exposed to the public.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker | ≥ 24 | Engine + CLI |
| Docker Compose | ≥ 2.x | `docker compose` (v2 plugin) |
| Git | any | For cloning the repo |

---

## Quickstart (Docker Compose)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/ccis_ctfd.git
cd ccis_ctfd
```

### 2. Configure Secrets

Create a `.ctfd_secret_key` file with a random value (**required for multi-worker deployments**):

```bash
python3 -c "import secrets; print(secrets.token_hex(32))" > .ctfd_secret_key
```

Or set it as an environment variable in the compose file / `.env`:

```env
SECRET_KEY=your-very-long-random-string
```

### 3. Review `docker-compose.yml`

Key environment variables to change for production:

```yaml
environment:
  - DATABASE_URL=mysql+pymysql://ctfd:<STRONG_PASSWORD>@db/ctfd
  - REDIS_URL=redis://cache:6379
  - WORKERS=4          # Set to (2 × CPU cores) + 1 for production
  - REVERSE_PROXY=true
```

> **Important:** Change the MariaDB `MARIADB_ROOT_PASSWORD` and `MARIADB_PASSWORD` from the default `ctfd` to strong random passwords.

```yaml
db:
  environment:
    - MARIADB_ROOT_PASSWORD=<STRONG_ROOT_PASSWORD>
    - MARIADB_PASSWORD=<STRONG_USER_PASSWORD>
```

### 4. (Optional) Configure `CTFd/config.ini`

For production, set at minimum:

```ini
[server]
SECRET_KEY = <your-secret-key>

[security]
TRUSTED_HOSTS = ctfd.yourdomain.com

[optional]
REVERSE_PROXY = true
UPDATE_CHECK = false
```

### 5. Start Services

```bash
docker compose up -d
```

The startup sequence:
1. `db` and `cache` start first
2. `ctfd` waits for `db` availability (`ping.py`), then runs `flask db upgrade`
3. `nginx` starts and proxies traffic to `ctfd:8000`

### 6. First-Time Setup

Navigate to `http://your-server` and complete the CTFd setup wizard, or use preset admin credentials in `config.ini`:

```ini
[management]
PRESET_ADMIN_NAME  = admin
PRESET_ADMIN_EMAIL = admin@example.com
PRESET_ADMIN_PASSWORD = <strong-password>
```

---

## Production Checklist

### Security
- [ ] `SECRET_KEY` set to a long random value and not committed to git
- [ ] MariaDB default passwords changed
- [ ] `TRUSTED_HOSTS` set to your domain
- [ ] HTTPS enabled (TLS termination at nginx or upstream load balancer)
- [ ] `SESSION_COOKIE_HTTPONLY = true` (default)
- [ ] `SESSION_COOKIE_SAMESITE = Lax` (default)
- [ ] Firewall: only port 80/443 exposed; 8000 internal only

### Performance
- [ ] `WORKERS` set appropriately (e.g. `4` or `8`)
- [ ] `WORKER_CLASS=gevent` (default)
- [ ] Redis configured for caching
- [ ] nginx `gzip on` (already in `conf/nginx/http.conf`)

### Reliability
- [ ] `restart: always` on all containers (already set in compose file)
- [ ] Database on persistent named volume or external managed DB
- [ ] Log folder mounted on persistent volume

---

## HTTPS / TLS Setup (nginx)

Replace `conf/nginx/http.conf` with an HTTPS-enabled config:

```nginx
worker_processes 4;
events { worker_connections 1024; }

http {
  upstream app_servers { server ctfd:8000; }

  server {
    listen 80;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl;
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    client_max_body_size 4G;
    gzip on;

    location /events {
      proxy_pass http://app_servers;
      proxy_set_header Connection '';
      proxy_http_version 1.1;
      chunked_transfer_encoding off;
      proxy_buffering off;
      proxy_cache off;
    }

    location / {
      proxy_pass         http://app_servers;
      proxy_redirect     off;
      proxy_set_header   Host $host;
      proxy_set_header   X-Real-IP $remote_addr;
      proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header   X-Forwarded-Host $server_name;
    }
  }
}
```

Mount your SSL certificates in `docker-compose.yml`:

```yaml
nginx:
  volumes:
    - ./conf/nginx/http.conf:/etc/nginx/nginx.conf
    - /etc/letsencrypt/live/yourdomain.com:/etc/nginx/ssl:ro
```

---

## Environment Variable Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | **Yes (multi-worker)** | auto-generated | Flask session signing key |
| `DATABASE_URL` | No | SQLite | SQLAlchemy connection string |
| `REDIS_URL` | No | filesystem cache | Redis connection string |
| `WORKERS` | No | `1` | Number of gunicorn workers |
| `WORKER_CLASS` | No | `gevent` | gunicorn worker class |
| `LOG_FOLDER` | No | `CTFd/logs` | Path for access/error logs |
| `ACCESS_LOG` | No | `-` (stdout) | Access log path |
| `ERROR_LOG` | No | `-` (stderr) | Error log path |
| `WORKER_TEMP_DIR` | No | `/dev/shm` | Temp dir for workers |
| `SKIP_DB_PING` | No | `false` | Skip DB availability check |
| `UPLOAD_FOLDER` | No | `CTFd/uploads` | File upload destination |

---

## Updating CTFd

```bash
# Pull new code
git pull origin master

# Rebuild and restart
docker compose build ctfd
docker compose up -d ctfd

# Migrations run automatically on startup via flask db upgrade
```

> **Note:** Avoid running `docker compose down` unless necessary — it stops all services and may cause brief downtime. Use `docker compose up -d ctfd` for rolling restarts of only the app container.

---

## Scaling Workers

Edit `docker-compose.yml`:

```yaml
environment:
  - WORKERS=8
```

Then restart the `ctfd` service:

```bash
docker compose up -d ctfd
```

> With multiple workers, `SECRET_KEY` (or `.ctfd_secret_key`) **must** be defined so all workers share the same session signing key.

---

## File Uploads: Switching to S3

For production environments where the app container is ephemeral or load-balanced, store uploads in S3:

```ini
[uploads]
UPLOAD_PROVIDER  = s3
AWS_ACCESS_KEY_ID     = AKIA...
AWS_SECRET_ACCESS_KEY = ...
AWS_S3_BUCKET         = my-ctfd-uploads
AWS_S3_REGION         = ap-southeast-1
```

---

## Healthcheck

CTFd exposes a `/healthcheck` endpoint:

```bash
curl http://localhost:8000/healthcheck
# Expected: 200 OK
```

Use this in your load balancer or orchestrator (Kubernetes readiness probe, etc.).
