# Monitoring & Alerting Setup

This document describes what to monitor in a CTFd production deployment and recommended alert thresholds.

---

## Monitoring Stack Recommendation

CTFd does not ship a built-in monitoring integration, but it exposes a `/healthcheck` endpoint and structured logs. The recommended setup is:

| Layer | Tool | Purpose |
|---|---|---|
| Container health | Docker health checks / Compose | Service up/down detection |
| Uptime | UptimeRobot, Betterstack, or Pingdom | External HTTP monitoring |
| Metrics | Prometheus + Grafana | CPU, memory, throughput |
| Logs | Loki + Grafana, or ELK stack | Log aggregation and search |
| Alerting | Grafana Alerts, PagerDuty, or email | Notify on-call |

---

## Built-In Endpoints

### `/healthcheck`

Returns `200 OK` when CTFd is ready to serve requests.

```bash
curl http://localhost:8000/healthcheck
```

Use this URL as the health probe in:
- Docker health checks
- Load balancer target health checks
- Uptime monitors

---

## What to Monitor

### 1. Service Availability

| Check | Target | Expected | Alert Threshold |
|---|---|---|---|
| HTTP health check | `GET /healthcheck` | 200 OK | Any non-200 for > 30s |
| nginx port open | `:80` (or `:443`) | TCP connect success | Failure for > 15s |
| ctfd container status | `docker compose ps` | `running` | State = `exited` |
| db container status | `docker compose ps` | `running` | State = `exited` |
| cache container status | `docker compose ps` | `running` | State = `exited` |

### 2. Response Time

| Metric | Warning Threshold | Critical Threshold |
|---|---|---|
| `/` page load (P95) | > 2 s | > 5 s |
| `/api/v1/challenges` (P95) | > 1 s | > 3 s |
| `/api/v1/scoreboard` (P95) | > 2 s | > 5 s |
| Flag submission latency | > 1 s | > 3 s |

### 3. Container Resource Usage

| Resource | Warning | Critical |
|---|---|---|
| `ctfd` CPU | > 70% sustained 5 min | > 90% sustained 2 min |
| `ctfd` memory | > 75% of limit | > 90% of limit |
| `db` CPU | > 60% sustained | > 85% sustained |
| `db` memory | > 80% of limit | > 95% of limit |
| Disk (volumes) | > 70% full | > 90% full |

### 4. Database

| Metric | Warning | Critical |
|---|---|---|
| Active connections | > 80 | > 150 |
| Slow queries (> 1s) | > 5/min | > 20/min |
| Replication lag (if in use) | > 5s | > 30s |
| Table lock waits | > 10/min | > 50/min |

Check via MariaDB:

```sql
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Slow_queries';
SHOW ENGINE INNODB STATUS;
```

### 5. Redis

| Metric | Warning | Critical |
|---|---|---|
| `used_memory` | > 80% of `maxmemory` | > 95% |
| `rejected_connections` | > 0 | > 10/min |
| `keyspace_hits` ratio | < 80% | < 50% |

Check via Redis CLI:

```bash
docker compose exec cache redis-cli INFO stats
docker compose exec cache redis-cli INFO memory
```

### 6. CTFd Application Logs

Monitor these log patterns:

| Pattern | Severity | Meaning |
|---|---|---|
| `ERROR` | Warning | Application-level error |
| `CRITICAL` | Critical | Fatal application error |
| `OperationalError` | Critical | Database connection failure |
| `ConnectionError` | Warning | Redis connection lost |
| `500` in access log | Warning | Unhandled server error |
| Rate of `403` spikes | Warning | Potential brute-force/scanning |

Log locations:
- Access log: `.data/CTFd/logs/` or stdout (stdout by default because `ACCESS_LOG=-`)
- Error log: stderr (stdout by default because `ERROR_LOG=-`)
- CTFd application logs: `.data/CTFd/logs/` (submissions, registrations, logins)

---

## Docker Health Check Configuration

Add health checks to `docker-compose.yml` to enable automatic restart on failure:

```yaml
ctfd:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/healthcheck"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s

db:
  healthcheck:
    test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "ctfd", "-pctfd"]
    interval: 10s
    timeout: 5s
    retries: 5

cache:
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 3
```

---

## Prometheus Metrics (Optional)

CTFd does not expose Prometheus metrics natively. You can instrument it with:

1. **nginx-prometheus-exporter** — for nginx request rates and upstream metrics
2. **mysqld_exporter** — for MariaDB metrics
3. **redis_exporter** — for Redis metrics
4. **cAdvisor** — for Docker container CPU/memory/IO metrics

Example addition to `docker-compose.yml`:

```yaml
cadvisor:
  image: gcr.io/cadvisor/cadvisor:latest
  restart: always
  volumes:
    - /:/rootfs:ro
    - /var/run:/var/run:ro
    - /sys:/sys:ro
    - /var/lib/docker/:/var/lib/docker:ro
  ports:
    - "8080:8080"

prometheus:
  image: prom/prometheus:latest
  restart: always
  volumes:
    - ./conf/prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"
```

---

## Alert Definitions

### P1 Alerts (Page immediately)

| Alert Name | Condition | Action |
|---|---|---|
| `CTFdDown` | `/healthcheck` fails for 60s | See [INC-01](runbook.md#inc-01---ctfd-site-unreachable-http-502--504) |
| `MariaDBDown` | ctfd logs `Can't connect to MySQL` | See [INC-02](runbook.md#inc-02---database-connection-failure) |
| `ContainerExited` | Any container state = `exited` | `docker compose up -d <service>` |

### P2 Alerts (Page within 15 min)

| Alert Name | Condition | Action |
|---|---|---|
| `HighErrorRate` | HTTP 5xx rate > 5% for 5 min | Check CTFd logs |
| `SlowResponses` | P95 latency > 5s for 5 min | Check DB and Redis |
| `DiskSpaceCritical` | Volume > 90% full | Clear logs or expand storage |

### P3 Alerts (Notify, fix within 4 hrs)

| Alert Name | Condition | Action |
|---|---|---|
| `RedisDown` | Redis ping fails | See [INC-03](runbook.md#inc-03---redis-connection-failure--cache-unavailable) |
| `HighCPU` | CTFd CPU > 70% for 10 min | Review worker count, check DB |
| `HighMemory` | CTFd memory > 75% | Review plugin memory usage |

---

## Log Aggregation Setup (Loki + Grafana)

Add to `docker-compose.yml`:

```yaml
loki:
  image: grafana/loki:latest
  ports:
    - "3100:3100"

grafana:
  image: grafana/grafana:latest
  ports:
    - "3000:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=secret
```

Configure Docker log driver to forward to Loki:

```yaml
ctfd:
  logging:
    driver: loki
    options:
      loki-url: "http://localhost:3100/loki/api/v1/push"
      loki-labels: "service=ctfd"
```

---

## Key Grafana Dashboards

| Dashboard | Key Panels |
|---|---|
| **CTFd Overview** | Uptime, error rate, latency P50/P95/P99 |
| **Container Metrics** | CPU %, memory %, network I/O per container |
| **MariaDB** | Active connections, slow queries, QPS |
| **Redis** | Hit ratio, evictions, memory usage |
| **Disk Usage** | Volume usage trend, projected fill date |
