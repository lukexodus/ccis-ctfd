# MMSU-CCIS Week CTF — Customization Guide

> **Project:** CTFd v3.8.2  
> **Event:** CCIS Week Foundation — Capture The Flag Competition  
> **Organizer:** Mariano Marcos State University, College of Computing and Information Sciences × Honor Society

This guide covers every step required to rebrand and configure the base CTFd platform for the MMSU-CCIS Week CTF. Steps are ordered from mandatory fundamentals to optional polish.

---

## Table of Contents

1. [Event Identity Setup (Admin UI)](#1-event-identity-setup-admin-ui)
2. [Branding Assets — What to Prepare](#2-branding-assets--what-to-prepare)
3. [Custom Theme — Creating `ccis-week`](#3-custom-theme--creating-ccis-week)
4. [Color & Typography Tokens](#4-color--typography-tokens)
5. [Navbar & Footer Customization](#5-navbar--footer-customization)
6. [Landing / Home Page](#6-landing--home-page)
7. [Registration Page](#7-registration-page)
8. [Challenge Categories & Structure](#8-challenge-categories--structure)
9. [Scoreboard Brackets (Honor Society / Open Divisions)](#9-scoreboard-brackets-honor-society--open-divisions)
10. [Custom Registration Fields](#10-custom-registration-fields)
11. [CMS Pages (Rules, About, Schedule)](#11-cms-pages-rules-about-schedule)
12. [Email & Notification Templates](#12-email--notification-templates)
13. [Deployment Configuration for the Event](#13-deployment-configuration-for-the-event)
14. [Security Hardening Checklist](#14-security-hardening-checklist)
15. [Go-Live Checklist](#15-go-live-checklist)

---

## 1. Event Identity Setup (Admin UI)

The quickest wins are done entirely through the Admin Panel (`/admin`) without touching code.

### 1.1 General Settings

Navigate to **Admin → Config → General**:

| Field | Value |
|---|---|
| **CTF Name** | `MMSU-CCIS Week CTF 2026` |
| **CTF Description** | `Capture The Flag competition organized by MMSU College of Computing and Information Sciences × Honor Society for CCIS Foundation Week.` |
| **CTF Logo** | Upload your CCIS / MMSU logo (PNG/SVG, max 500 px wide) — appears in the navbar |
| **CTF Small Icon** | Upload a 32×32 favicon (ICO or PNG) |
| **Theme** | `ccis-week` *(after Step 3)* or keep `core` while building |
| **User Mode** | `teams` (recommended for friendly competition) or `users` |

### 1.2 Time & Visibility

Navigate to **Admin → Config → CTF**:

| Field | Suggested Value |
|---|---|
| **Start** | Event start date/time (PHT, UTC+8) |
| **End** | Event end date/time |
| **Freeze** | Optional: freeze scoreboard 30 min before end |
| **Challenge Visibility** | `private` (challenges only visible after login) |
| **Account Visibility** | `public` |
| **Score Visibility** | `public` |
| **Registration Visibility** | `public` (or `private` + registration code for internal-only) |

### 1.3 Pausing & Maintenance

Use **Admin → Config → General → Pause CTF** to freeze all submissions instantly during incidents without stopping the timer.

---

## 2. Branding Assets — What to Prepare

Prepare the following files before starting theme work:

| Asset | Format | Notes |
|---|---|---|
| MMSU / CCIS logo | SVG or PNG (transparent bg) | Used in navbar; keep under 200 KB |
| Honor Society logo | SVG or PNG | Can appear in footer or CMS pages |
| Favicon | 32×32 ICO or PNG | Uploaded via Admin → Config |
| Hero / Banner image | 1920×600 px JPG/PNG | Used on the landing page |
| Color palette | HEX values | See [Step 4](#4-color--typography-tokens) |
| Custom fonts (optional) | Google Fonts URL | Inter or Poppins work well |

**MMSU brand colors** (reference — adjust to official values):

| Role | Suggested Hex |
|---|---|
| Primary (MMSU maroon/red) | `#8B0000` |
| Secondary (gold/yellow) | `#FFD700` |
| Accent | `#1a1a2e` (dark navy) |
| Surface light | `#f8f9fa` |
| Surface dark | `#141414` |

---

## 3. Custom Theme — Creating `ccis-week`

The theme system uses **layered Jinja templates**. A custom theme only needs to provide files it wants to differ from `core` — everything else falls through automatically (via `THEME_FALLBACK=true`).

### 3.1 Scaffold the Theme

```bash
# From the project root
cp -r CTFd/themes/core CTFd/themes/ccis-week
```

Then update `CTFd/config.ini` to pin the new theme:

```ini
# There is no config.ini key for theme — set it via Admin UI or:
# After first run, set via Admin → Config → General → Theme
```

Or set it via the API immediately at startup:

```bash
flask shell -c "from CTFd.utils import set_config; set_config('ctf_theme', 'ccis-week')"
```

### 3.2 Theme Directory Structure

```
CTFd/themes/ccis-week/
 ├─ assets/
 │    ├─ img/                ← Put hero.jpg, bg-pattern.png here
 │    ├─ js/                 ← Custom JavaScript
 │    └─ scss/
 │         └─ main.scss      ← Override Bootstrap tokens + custom styles
 ├─ static/                  ← Compiled output (Vite build)
 │    └─ img/
 │         ├─ favicon.ico
 │         ├─ logo.png       ← Replace with MMSU/CCIS logo
 │         └─ logo.svg
 └─ templates/
      ├─ base.html           ← Global layout (head, navbar slot, footer)
      ├─ components/
      │    ├─ navbar.html    ← Branded navbar
      │    └─ hero.html      ← (create new) Landing banner
      └─ page.html           ← CMS page wrapper
```

### 3.3 Activating the Theme

```
Admin Panel → Config → General → Theme → select "ccis-week" → Save
```

---

## 4. Color & Typography Tokens

Edit `CTFd/themes/ccis-week/assets/scss/main.scss`. Bootstrap 5 SCSS variables are overridden **before** the `@use "bootstrap/scss/bootstrap"` line:

```scss
// ── MMSU-CCIS Brand Tokens ──────────────────────────────────
$primary:        #8B0000;   // MMSU maroon
$secondary:      #FFD700;   // Gold (Honor Society accent)
$dark:           #141414;
$light:          #f8f9fa;
$info:           #5c728f;
$success:        #198754;
$danger:         #dc3545;
$warning:        #ffc107;

// Typography
$font-family-sans-serif: 'Inter', system-ui, -apple-system, sans-serif;
$headings-font-weight:   700;
$headings-letter-spacing: 1.5px;

// Navbar
$navbar-dark-color:           rgba(255,255,255,.85);
$navbar-dark-hover-color:     $secondary;
$navbar-dark-active-color:    $secondary;

// Buttons
$btn-border-radius:      0.375rem;
$btn-padding-y:          0.55rem;

@use "bootstrap/scss/bootstrap" as * with (
  $primary:   #8B0000,
  $secondary: #FFD700,
  $dark:      #141414,
  $info:      #5c728f
);

// ── Custom styles below ─────────────────────────────────────
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

// Navbar accent bar
.navbar {
  border-bottom: 3px solid $secondary;
}

// Challenge card hover
.challenge-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba($primary, 0.25);
  transition: all 0.2s ease;
}
```

After editing, rebuild the theme assets:

```bash
cd CTFd/themes/ccis-week
yarn install   # first time only
yarn build     # compiles SCSS → static/assets/
```

In development, use `yarn dev` for hot-reload.

---

## 5. Navbar & Footer Customization

### 5.1 Branded Navbar

Edit `CTFd/themes/ccis-week/templates/components/navbar.html`.

Key changes:
- Replace `bg-dark` with `bg-primary` (your MMSU maroon)
- Add CCIS / Honor Society co-branding next to the logo
- Add a "Sponsors" or "About CCIS Week" custom nav link

```html
<nav class="navbar navbar-expand-md navbar-dark bg-primary fixed-top">
  <div class="container">
    <a href="{{ url_for('views.static_html', route='/') }}" class="navbar-brand d-flex align-items-center gap-2">
      {% if Configs.ctf_logo %}
        <img src="{{ url_for('views.files', path=Configs.ctf_logo) }}"
             alt="{{ Configs.ctf_name }}" height="32">
      {% else %}
        <strong>{{ Configs.ctf_name }}</strong>
      {% endif %}
      <!-- Co-branding badge -->
      <span class="badge text-bg-warning d-none d-md-inline" style="font-size:.65rem;">
        × Honor Society
      </span>
    </a>
    <!-- ... rest of navbar ... -->
  </div>
</nav>
```

### 5.2 Branded Footer

Edit `CTFd/themes/ccis-week/templates/base.html` — replace the default footer block:

```html
<footer class="footer mt-auto py-4 bg-dark text-white">
  <div class="container text-center">
    <div class="mb-2">
      <img src="{{ url_for('static', filename='img/logo.png') }}" alt="MMSU-CCIS" height="36">
    </div>
    <p class="mb-1">
      <strong>MMSU College of Computing and Information Sciences</strong>
    </p>
    <p class="text-muted small mb-2">
      CCIS Week Foundation · CTF Competition · Organized by Honor Society
    </p>
    <p class="text-muted small">
      &copy; {{ now().year }} MMSU–CCIS &nbsp;|&nbsp;
      <a href="https://mmsu.edu.ph" class="text-secondary" target="_blank">mmsu.edu.ph</a>
      &nbsp;|&nbsp;
      <small>Powered by <a href="https://ctfd.io" class="text-secondary">CTFd</a></small>
    </p>
  </div>
</footer>
```

Also inject theme-scoped CSS custom properties for the footer in `main.scss`:

```scss
footer.footer {
  border-top: 3px solid $primary;
}
```

---

## 6. Landing / Home Page

CTFd's home (`/`) shows a minimal page by default. Replace it with a CCIS-branded hero.

### Option A: Admin UI (no code)

Go to **Admin → Pages → Create** and set:
- **Route:** `/` (overrides home)
- **Format:** HTML
- **Content:** Full hero HTML with MMSU branding, event countdown, and CTA buttons.

```html
<div class="jumbotron text-center py-5" style="background: linear-gradient(135deg, #8B0000 0%, #1a1a2e 100%); color: white; margin-top: -1rem;">
  <img src="/themes/ccis-week/static/img/logo.png" alt="MMSU-CCIS" height="80" class="mb-3">
  <h1 class="display-4 fw-bold">CCIS Week Foundation CTF</h1>
  <p class="lead">Mariano Marcos State University — College of Computing and Information Sciences</p>
  <p class="text-warning">Organized by the Honor Society × CCIS Student Body</p>
  <hr class="my-4" style="border-color: rgba(255,215,0,0.4);">
  <p>Test your skills. Break the code. Rise to the top.</p>
  <a href="/register" class="btn btn-warning btn-lg me-2">Register Now</a>
  <a href="/challenges" class="btn btn-outline-light btn-lg">View Challenges</a>
</div>

<div class="container py-5">
  <div class="row g-4 text-center">
    <div class="col-md-4">
      <i class="fas fa-trophy fa-3x text-warning mb-3"></i>
      <h5>Compete</h5>
      <p class="text-muted">Solve challenges across Web, Crypto, Forensics, Pwn, Rev, and OSINT.</p>
    </div>
    <div class="col-md-4">
      <i class="fas fa-users fa-3x text-warning mb-3"></i>
      <h5>Collaborate</h5>
      <p class="text-muted">Form teams of up to 4 and work together to capture the flags.</p>
    </div>
    <div class="col-md-4">
      <i class="fas fa-medal fa-3x text-warning mb-3"></i>
      <h5>Win</h5>
      <p class="text-muted">Top teams earn recognition, certificates, and prizes from MMSU-CCIS.</p>
    </div>
  </div>
</div>
```

### Option B: Template Override

Create `CTFd/themes/ccis-week/templates/page.html` and extend `core/page.html` with a custom hero block.

---

## 7. Registration Page

### 7.1 Template Tweak

Copy and edit `CTFd/themes/ccis-week/templates/register.html` to:
- Add MMSU/CCIS branding at the top of the form card
- Add a note about eligibility (e.g., "Open to all MMSU-CCIS students")
- Style primary button with `btn-primary` (maroon)

### 7.2 Registration Code (Restrict to MMSU Students)

To restrict registration to verified MMSU participants:

```
Admin → Config → Registration → Registration Code → set a secret code
```

Share the code only with CCIS students via the official CCIS Week channels.

### 7.3 Email Domain Restriction (optional)

To allow only `@mmsu.edu.ph` email addresses:

```
Admin → Config → Email → Email Allow List → mmsu.edu.ph
```

---

## 8. Challenge Categories & Structure

### Recommended Category Set for CCIS Week

| Category | Icon | Difficulty range |
|---|---|---|
| Web Exploitation | 🌐 | Easy → Hard |
| Cryptography | 🔐 | Easy → Hard |
| Forensics | 🔍 | Easy → Medium |
| Reverse Engineering | ⚙️ | Medium → Hard |
| Binary Exploitation (Pwn) | 💥 | Hard |
| OSINT | 👁 | Easy → Medium |
| Miscellaneous | 🎲 | Any |
| CCIS Trivia | 🏫 | Easy (MMSU-themed) |

> **Tip:** The "CCIS Trivia" category is a great way to make the event feel local — add questions about MMSU history, CCIS programs, and faculty.

### Challenge Scoring Options

| Mode | When to use |
|---|---|
| **Static** (`standard` type) | Simple, fair; all solvers get the same points |
| **Dynamic** (built-in since 3.8.1) | Points decay as more teams solve — rewards speed |

To set up dynamic scoring on any challenge:

```
Admin → Challenges → Edit → Type: Standard → enable Dynamic Scoring
  Initial: 500, Minimum: 50, Decay: 30, Function: logarithmic
```

---

## 9. Scoreboard Brackets (Honor Society / Open Divisions)

Use **Brackets** to show sub-scoreboards — e.g., separate standings for Honor Society members vs. general participants.

### Creating Brackets

```
Admin → Config → Brackets → Add Bracket
```

| Bracket | Type | Description |
|---|---|---|
| Honor Society | teams | Honor Society affiliated teams only |
| Open | teams | All other MMSU-CCIS teams |
| Faculty | teams | Optional faculty exhibition bracket |

Players select their bracket at registration. Admins can also manually assign brackets.

The main scoreboard shows all teams together; bracket views show per-division standings.

---

## 10. Custom Registration Fields

Collect MMSU-specific information at sign-up.

```
Admin → Config → Fields → Add User Field
```

Recommended fields:

| Field | Type | Required |
|---|---|---|
| Student ID / Employee ID | Text | Yes |
| Year Level | Text | Yes (for students) |
| Degree Program | Text | Yes |
| Honor Society Member? | Boolean | No |
| T-Shirt Size | Text | No (for prize logistics) |

Set `Public: true` for fields you want visible on player profiles.

---

## 11. CMS Pages (Rules, About, Schedule)

Create event-specific pages via **Admin → Pages → Create**.

### Recommended Pages

| Title | Route | Content |
|---|---|---|
| Rules | `/rules` | Competition rules, flag format (`CCIS{...}`), prohibited tools |
| About CCIS Week | `/about` | CCIS Week history, organizers, Honor Society intro |
| Schedule | `/schedule` | Event timeline table |
| Prizes | `/prizes` | Prize breakdown by placing + sponsor info |
| FAQ | `/faq` | Common questions about the CTF |
| Contact | `/contact` | Discord/Messenger group links, organizer contacts |

### Adding Pages to the Navbar

```
Plugin function: register_user_page_menu_bar(title, route)
```

Or simply: after creating a page, go to **Admin → Pages → Edit** and set **Hidden: false** to include it in the auto-generated nav links.

### Flag Format Page

Create a `/rules` page prominently explaining:

```
Flag format: CCIS{flag_string_here}
All flags are case-sensitive.
Flags must be submitted exactly as found.
```

---

## 12. Email & Notification Templates

### 12.1 Email Setup

```
Admin → Config → Email
```

Use a Gmail app password or SMTP relay:

```ini
# config.ini
[email]
MAIL_SERVER   = smtp.gmail.com
MAIL_PORT     = 587
MAIL_USEAUTH  = true
MAIL_USERNAME = ccisweek.ctf@gmail.com
MAIL_PASSWORD = <app-password>
MAIL_TLS      = true
MAIL_SSL      = false
MAILFROM_ADDR = ccisweek.ctf@gmail.com
```

### 12.2 Custom Email Body Templates

Override email template strings via the Admin Config `email_registration_body` and `email_forgot_password_body` config keys, or create a CTFd plugin that uses the `EmailProvider` system.

Suggested subject prefix: `[MMSU-CCIS Week CTF]`.

### 12.3 In-App Notifications (SSE)

Use **Admin → Notifications → Create** to broadcast real-time messages to all connected participants — useful for:
- "🚩 New challenge released: [name]"
- "🕐 30 minutes remaining!"
- "🔧 Maintenance: challenge X is down temporarily"

---

## 13. Deployment Configuration for the Event

### 13.1 `CTFd/config.ini` for Production

```ini
[server]
DATABASE_URL  = mysql+pymysql://ctfd:password@db/ctfd
REDIS_URL     = redis://cache:6379
SECRET_KEY    = <generate with: python -c "import secrets; print(secrets.token_hex(32))">

[security]
SESSION_COOKIE_HTTPONLY = true
SESSION_COOKIE_SAMESITE = Lax
TRUSTED_HOSTS = ctf.ccisweek.mmsu.edu.ph

[optional]
REVERSE_PROXY = true
THEME_FALLBACK = true
SERVER_SENT_EVENTS = true
HTML_SANITIZATION = true
UPDATE_CHECK = false

[management]
PRESET_ADMIN_NAME     = admin
PRESET_ADMIN_EMAIL    = ccisweek.ctf@gmail.com
PRESET_ADMIN_PASSWORD = <strong-password>
```

### 13.2 Docker Compose (Recommended for Event Day)

We already have a `docker-compose.yml` in the project root. Key additions for the event:

```yaml
services:
  ctfd:
    environment:
      - DATABASE_URL=mysql+pymysql://ctfd:ctfd@db/ctfd
      - REDIS_URL=redis://cache:6379
      - SECRET_KEY=${SECRET_KEY}
    volumes:
      - ./CTFd/themes/ccis-week:/opt/CTFd/CTFd/themes/ccis-week:ro
      - ./uploads:/var/uploads
```

Mount your custom theme as a volume so it's available without rebuilding the image.

### 13.3 Domain / TLS

Use nginx as the TLS termination layer:

```nginx
server {
    listen 443 ssl;
    server_name ctf.ccisweek.mmsu.edu.ph;

    ssl_certificate     /etc/ssl/certs/mmsu.crt;
    ssl_certificate_key /etc/ssl/private/mmsu.key;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
    }
}
```

If TLS is not available, use [Let's Encrypt + Certbot](https://certbot.eff.org/) with the nginx plugin.

---

## 14. Security Hardening Checklist

Before going live, verify:

- [ ] `SECRET_KEY` is a random 32+ byte hex string (not the default)
- [ ] `HTML_SANITIZATION = true` in `config.ini`
- [ ] `TRUSTED_HOSTS` set to your event domain
- [ ] Database not exposed externally (Docker network only)
- [ ] Redis not exposed externally
- [ ] HTTPS enforced at nginx
- [ ] `SESSION_COOKIE_SECURE = true` set at nginx proxy (`proxy_cookie_flags`)
- [ ] Admin password is strong and not reused
- [ ] Registration code set (if internal-only event)
- [ ] Email domain allow-list set to `mmsu.edu.ph` (if MMSU-only)
- [ ] `UPDATE_CHECK = false` (no outbound ping during the event)
- [ ] Backup scheduled (see `runbook.md`)
- [ ] Rate limiting on submissions tested (default: 10 wrong/min)

---

## 15. Go-Live Checklist

Complete these steps **in order** on event day:

### T-24 Hours

- [ ] Build and deploy custom `ccis-week` theme
- [ ] Upload MMSU/CCIS logo, favicon, and hero image via Admin UI
- [ ] Set CTF name, description, and theme in Admin → Config
- [ ] Create all challenge categories
- [ ] Create brackets (Honor Society, Open, Faculty)
- [ ] Create custom registration fields
- [ ] Publish CMS pages: Rules, About, Schedule, Prizes, FAQ
- [ ] Add pages to navbar
- [ ] Configure email settings and send a test email
- [ ] Set registration code (if used)
- [ ] Import challenge content (via `ctfcli` or Admin UI)
- [ ] Create at least one test account and verify registration flow end-to-end
- [ ] Test flag submission (correct and incorrect)
- [ ] Test SSE notifications

### T-1 Hour

- [ ] Set start and end time in Admin → Config → CTF
- [ ] Verify scoreboard is empty / reset
- [ ] Take a database backup (`python export.py`)
- [ ] Brief all challenge authors on Admin Panel access

### At Start

- [ ] Send welcome notification: "🚩 CCIS Week CTF is now LIVE! Good luck!"
- [ ] Monitor `CTFd/logs/submissions.log` for anomalies
- [ ] Keep Admin Panel open for real-time monitoring

### At End

- [ ] Send closing notification: "🏁 CTF is over! Final scores are locked."
- [ ] Freeze scoreboard if not auto-frozen
- [ ] Export full backup
- [ ] Screenshot final scoreboard for announcement posts

---

## Appendix: Quick Reference — Key Admin Panel Paths

| What | Where |
|---|---|
| CTF name, logo, favicon, theme | Admin → Config → General |
| Start/End time, challenge/score visibility | Admin → Config → CTF |
| Registration code, email allow list | Admin → Config → Registration + Email |
| Brackets | Admin → Config → Brackets |
| Custom fields | Admin → Config → Fields |
| CMS pages | Admin → Pages |
| Challenges | Admin → Challenges |
| Users / Teams | Admin → Users / Teams |
| Broadcast notifications | Admin → Notifications |
| Export / Backup | Admin → Export |
| Real-time scoreboard | Admin → Scoreboard |

---

*Authored for MMSU-CCIS Week Foundation · CTFd v3.8.2 · March 2026*
