# MMSU-CCIS Week CTF — Docker Operations Guide

This guide details the Docker-based deployment of the CTFd platform, complementing the native SQLite setup used for development. Docker is the recommended approach for the actual event deployment due to its isolated environment, scalability, and included services (MariaDB, Redis, Nginx).

---

## 1. Prerequisites

Ensure the deployment server has the following installed:
- [Docker Engine](https://docs.docker.com/engine/install/)
- [Docker Compose](https://docs.docker.com/compose/install/)

---

## 2. Architecture Overview

The `docker-compose.yml` defines four interconnected services:

| Service | Image/Source | Description | Ports |
|---|---|---|---|
| **ctfd** | Local `Dockerfile` | The main CTFd Python application (Flask + Gunicorn). | 8000:8000 |
| **nginx** | `nginx:stable` | Reverse proxy, serves static files, and handles TLS (if configured). | 80:80 |
| **db** | `mariadb:10.11` | Relational database holding users, challenges, scores, etc. | Internal |
| **cache** | `redis:4` | In-memory cache for fast session and data retrieval. | Internal |

All services communicate over the `internal` Docker network, ensuring only Nginx and CTFd are exposed to the host.

---

## 3. Basic Management Commands

Run these commands from the project root directory (where `docker-compose.yml` is located).

### 3.1 Start Services
To start all services in the background (detached mode):
```bash
docker compose up -d
```

### 3.2 Stop Services
To stop services without removing the containers or networks:
```bash
docker compose stop
```

### 3.3 Tear Down Services
To stop and remove containers and the default network (data in `.data/` is preserved):
```bash
docker compose down
```

### 3.4 Restart Services
To restart a specific service or all services:
```bash
docker compose restart         # Restarts all
docker compose restart ctfd    # Restarts only CTFd
```

---

## 4. Viewing Logs

Monitoring logs is crucial, especially during the event.

```bash
# View all logs in real-time
docker compose logs -f

# View logs for a specific service (e.g., CTFd application errors)
docker compose logs -f ctfd

# View only the last 100 lines for the database
docker compose logs --tail=100 db
```

---

## 5. Applying Customizations & Changes

If you modify the Python code, add new dependencies to `requirements.txt`, or update the `Dockerfile`, you must rebuild the `ctfd` image.

```bash
# Rebuild the CTFd image
docker compose build ctfd

# Recreate the container with the new image
docker compose up -d
```

**Note on Themes:** If you are actively developing the `ccis-week` theme, you should mount it as a volume in `docker-compose.yml` (as detailed in the Customization Guide) to avoid rebuilding the image for every CSS/HTML change.

---

## 6. Data Persistence

The project uses a local `.data/` directory to store persistent data. **This directory is heavily `.gitignore`d and must be backed up manually.**

| Mount path | Container path | Contents |
|---|---|---|
| `.data/mysql/` | `/var/lib/mysql` | MariaDB database files |
| `.data/redis/` | `/data` | Redis dump files |
| `.data/CTFd/logs/` | `/var/log/CTFd` | Gunicorn access/error logs |
| `.data/CTFd/uploads/` | `/var/uploads` | User uploads, challenge files |

**Warning:** Recreating containers (`docker compose down && docker compose up -d`) is safe because data lives on the host in `.data/`. Deleting `.data/` will wipe the entire CTF state.

---

## 7. Executing Commands inside Containers

Sometimes you need to run administrative scripts or database migrations directly within the isolated environments.

### 7.1 CTFd Shell
To open an interactive Python shell with the application context loaded:
```bash
docker compose exec ctfd python manage.py shell
```

### 7.2 Running Database Migrations
If you pull updates that include database schema changes:
```bash
docker compose exec ctfd flask db upgrade
```

### 7.3 Bash Access
To explore the filesystem of a container:
```bash
docker compose exec ctfd bash
docker compose exec db bash
```

---

## 8. Troubleshooting

### 8.1 "Address already in use"
If `docker compose up` fails binding to port 80 or 8000:
- Stop any local services using those ports (`sudo systemctl stop nginx` or close the native `python serve.py` instance).
- Alternatively, change the host port mapping in `docker-compose.yml` (e.g., `"8080:80"`).

### 8.2 CTFd container keeps restarting
Check the specific logs: `docker compose logs ctfd`
- **Missing Secret Key:** The entrypoint requires a `.ctfd_secret_key` file or the `SECRET_KEY` environment variable. 
- **Database Connection:** Ensure the `db` container is fully initialized. MariaDB takes a few seconds on its first run.

### 8.3 Permission Denied on `.data/`
If the containers cannot write to the `.data` directory, ensure proper ownership. The `ctfd` service runs as user `1001`.
```bash
sudo chown -R 1001:1001 .data/CTFd/
```

### 8.4 Missing Uploaded Images in Docker vs Local (`serve.py`)
If you notice that images or files uploaded during local development (using `python serve.py`) do not appear when running `docker compose up`, or vice versa, this is because the two environments use fundamentally **different file paths and databases**:
- **Local (`serve.py`):** Uses the local SQLite database (`CTFd/ctfd.db`) and saves files directly to `CTFd/uploads/`.
- **Docker (`docker-compose.yml`):** Uses the MariaDB container (`.data/mysql/`) and mounts the persistent uploads volume to `.data/CTFd/uploads/`.

To transfer your setup from local to Docker, you cannot simply copy the files. Instead, you must use CTFd's built-in **Export/Import feature**:
1. Run `python serve.py` locally and log in as an administrator.
2. Go to **Admin Panel > Config > Backup** and click **Export**. This generates a `.zip` containing your `ctfd.db` and the `CTFd/uploads/` directory.
3. Stop the local server, start Docker (`docker compose up -d`), and go through the initial setup page.
4. Log in to the Docker CTFd instance, go to **Admin Panel > Config > Backup**, and upload the `.zip` file via the **Import** feature. This will populate the MariaDB database and correctly place the images into `.data/CTFd/uploads/`.


---

## 9. Configuration Files

Understanding the core configuration files helps you customize the deployment to your specific needs.

### 9.1 `Dockerfile`
The `Dockerfile` defines how the CTFd application image is built. It uses a multi-stage process:
- **Build Stage:** Installs build dependencies (like `build-essential`, `git`, `libffi-dev`) and compiles Python packages into a virtual environment (`/opt/venv`).
- **Release Stage:** A smaller runtime environment that only installs necessary runtime libraries (`libffi8`, `libssl3`). It copies the virtual environment from the build stage, sets up the non-root `ctfd` user (UID 1001), and configures permissions for logging and uploads.

**Customization:** If you need system-level tools for specific CTFd plugins (e.g., a utility required for a challenge type), you should add the `apt-get install` commands to the **release** stage of the `Dockerfile`. If you modify Python dependencies, rebuild the image using `docker compose build ctfd`.

### 9.2 `docker-compose.yml`
The `docker-compose.yml` file orchestrates all services. Key configurations include:
- **Environment Variables:** Used to configure CTFd (e.g., `SECRET_KEY`, database credentials, Redis connection string).
- **Volumes:** Crucial for data persistence (mapping the host's `.data/` directory to containers) and mounting custom themes or plugins during development to test changes without rebuilding the image.
- **Ports:** Exposes the application to the host machine. By default, Nginx binds to port 80 and CTFd binds to port 8000.

**Customization:** You can adjust port mappings (if port 80 is taken), add new services (like a separate database strictly for a specific challenge), or modify environment variables to tweak Gunicorn workers.

### 9.3 `.dockerignore`
The `.dockerignore` file prevents unnecessary or sensitive files from being copied into the Docker image during the `docker compose build` process. 
- **Excluded items include:** Local SQLite databases (`*.db`), persistent data directories (`.data/`), logs (`CTFd/logs/`), user uploads (`CTFd/uploads/`), local virtual environments (`venv*`, `.venv*`), and sensitive files (like `.ctfd_secret_key`).
- **Why it matters:** It keeps the Docker image relatively small, speeds up the build process, and ensures local secrets or test data don't accidentally leak into the production container image.

**What to do with it:** If you add new local directories (e.g., temporary analysis folders, local node build artifacts like `node_modules` for themes) or secret configuration files to the project root, make sure to add their paths to `.dockerignore` so they don't bloat your image or expose sensitive information.
