# Runbook / Incident Response Guide

This runbook provides step-by-step procedures for diagnosing and resolving common CTFd production failures.

---

## Contacts & Escalation

| Role | Responsibility | Contact |
|---|---|---|
| On-call Engineer | First responder | *(fill in)* |
| Platform Lead | Escalation for infra failures | *(fill in)* |
| Admin | CTFd admin-panel access | *(fill in)* |

---

## Incident Severity Levels

| Level | Description | SLA |
|---|---|---|
| P1 — Critical | Site fully down, no users can access | Respond in 5 min, resolve in 30 min |
| P2 — Major | Feature broken for all users (e.g. flag submission failing) | Respond in 15 min, resolve in 1 hr |
| P3 — Minor | Degraded performance or partial feature failure | Respond in 1 hr, resolve in 4 hr |
| P4 — Informational | No user impact; proactive finding | Next business day |

---

## Common Failure Scenarios

---

### INC-01 — CTFd Site Unreachable (HTTP 502 / 504)

**Symptoms:** Browser shows `502 Bad Gateway` or `504 Gateway Timeout`.

**Cause:** nginx is running but cannot reach the `ctfd` container.

**Diagnosis:**

```bash
# Check all container statuses
docker compose ps

# Check ctfd container logs
docker compose logs --tail=100 ctfd

# Test direct connection bypassing nginx
curl -s http://localhost:8000/healthcheck
```

**Resolution:**

```bash
# If ctfd container exited:
docker compose up -d ctfd

# If ctfd is up but hanging — restart it
docker compose restart ctfd

# If the issue persists, check DB connectivity
docker compose logs db
docker compose exec ctfd python ping.py
```

---

### INC-02 — Database Connection Failure

**Symptoms:** CTFd logs show `OperationalError`, `Can't connect to MySQL server`, or `Connection refused`.

**Diagnosis:**

```bash
docker compose ps db
docker compose logs --tail=50 db

# Check DB is accepting connections
docker compose exec db mysqladmin -u ctfd -p<password> status
```

**Resolution:**

```bash
# Restart the database container
docker compose restart db

# Wait for MariaDB to initialize (can take 10-30s)
docker compose logs -f db

# Once healthy, restart CTFd to re-establish pool
docker compose restart ctfd
```

**If data volume is corrupt:**

```bash
# Stop everything
docker compose down

# Back up the data directory first
cp -r .data/mysql .data/mysql.backup.$(date +%Y%m%d%H%M)

# Restart with auto-upgrade
docker compose up -d db
docker compose logs -f db
```

---

### INC-03 — Redis Connection Failure / Cache Unavailable

**Symptoms:** Logs show `redis.exceptions.ConnectionError`. Scoreboard queries slow significantly.

**Diagnosis:**

```bash
docker compose ps cache
docker compose logs --tail=50 cache

docker compose exec cache redis-cli ping
# Expected: PONG
```

**Resolution:**

```bash
docker compose restart cache

# CTFd will fall back to filesystem cache if Redis is unavailable
# but performance will degrade. Restart ctfd after Redis recovers:
docker compose restart ctfd
```

---

### INC-04 — CTFd Startup Fails (Migration Error)

**Symptoms:** CTFd container immediately exits. Logs show `alembic.util.exc.CommandError` or migration failure.

**Diagnosis:**

```bash
docker compose logs ctfd | grep -E "ERROR|CRITICAL|alembic"
```

**Resolution:**

```bash
# Check current migration state
docker compose exec ctfd flask db current

# Run upgrade manually with verbose output
docker compose exec ctfd flask db upgrade --sql 2>&1 | head -50

# If a migration is stuck, check for locked tables (MariaDB)
docker compose exec db mysql -u ctfd -p<password> ctfd \
  -e "SHOW PROCESSLIST;"
```

If a previous migration failed partially, inspect the `alembic_version` table:

```sql
SELECT * FROM alembic_version;
```

Do not manually modify this table unless you understand the migration chain. Escalate to P1 if unsure.

---

### INC-05 — Flag Submissions Failing (500 / Unexpected Error)

**Symptoms:** Users report getting server errors when submitting flags.

**Diagnosis:**

```bash
docker compose logs ctfd | grep "ERROR" | tail -50
```

Common causes:
- Database constraint violation (duplicate solve attempt)
- Plugin crash
- Rate limiter misconfiguration

**Resolution:**

```bash
# Check for plugin errors
docker compose logs ctfd | grep -i plugin

# Restart CTFd (no user session data is stored in process)
docker compose restart ctfd

# If an admin can still access the panel, check Admin > Submissions
# for errors or unusual patterns
```

---

### INC-06 — File Uploads Failing

**Symptoms:** Challenge file uploads return 413 or 500 errors.

**Diagnosis:**

```bash
# Check nginx client_max_body_size (default 4G in http.conf)
docker compose exec nginx nginx -T | grep client_max

# Check upload folder permission and disk space
docker compose exec ctfd df -h /var/uploads
docker compose exec ctfd ls -la /var/uploads
```

**Resolution:**

```bash
# Fix permissions if needed
docker compose exec --user root ctfd chown -R 1001:1001 /var/uploads

# If disk is full, free space or expand volume
df -h .data/CTFd/uploads
```

---

### INC-07 — CTFd Container OOM Killed

**Symptoms:** Container exits with code `137`. System `dmesg` shows OOM kill.

**Diagnosis:**

```bash
docker inspect $(docker compose ps -q ctfd) | grep -A5 OOMKilled
# OOMKilled: true confirms memory kill
```

**Resolution:**

1. Reduce worker count: set `WORKERS=2` in `docker-compose.yml`
2. Add memory limits:

```yaml
ctfd:
  deploy:
    resources:
      limits:
        memory: 2G
```

3. Restart:

```bash
docker compose up -d ctfd
```

---

### INC-08 — nginx Returns 413 Request Entity Too Large

**Symptoms:** Large file uploads fail with HTTP 413.

**Cause:** nginx `client_max_body_size` set too low (default is `4G` in `conf/nginx/http.conf`).

**Resolution:**

Edit `conf/nginx/http.conf`:

```nginx
client_max_body_size 8G;
```

Reload nginx:

```bash
docker compose exec nginx nginx -s reload
```

---

### INC-09 — High CPU / Application Slowness

**Symptoms:** Response times > 5s, load average high.

**Diagnosis:**

```bash
# Check container resource usage
docker stats

# Check slow DB queries (MariaDB slow query log)
docker compose exec db mysql -u root -p<password> \
  -e "SHOW FULL PROCESSLIST;"

# Check active gunicorn workers
docker compose exec ctfd ps aux | grep gunicorn
```

**Resolution:**
1. Check if a long-running task is blocking (import, export)
2. Kill offending query from MariaDB console if needed
3. Scale workers: increase `WORKERS` in compose file
4. Enable Redis if not already

---

## Recovery Checklist After Major Incident

- [ ] Services confirmed healthy (`docker compose ps`)
- [ ] `/healthcheck` returns 200
- [ ] Test flag submission on a test challenge
- [ ] Check admin panel loads correctly
- [ ] Review logs for residual errors (`docker compose logs ctfd | grep ERROR`)
- [ ] Notify users if downtime exceeded 5 minutes
- [ ] Write post-mortem within 24 hours (cause, timeline, fix, prevention)

---

## Useful Commands Reference

```bash
# Live logs for all services
docker compose logs -f

# Live logs for only CTFd
docker compose logs -f ctfd

# Restart a specific service
docker compose restart <service>

# Exec into a container
docker compose exec ctfd bash

# Check DB health
docker compose exec ctfd python ping.py

# Apply migrations manually
docker compose exec ctfd flask db upgrade

# Force-start CTFd in safe mode (no plugins)
docker compose exec ctfd env SAFE_MODE=true gunicorn 'CTFd:create_app()' --bind 0.0.0.0:8000

# Export a CTFd backup
docker compose exec ctfd python export.py
```
