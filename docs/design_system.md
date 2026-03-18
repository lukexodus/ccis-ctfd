# CTFd Design System Reference

> **Version:** 3.8.2 · **Theme engine:** Jinja2 + Bootstrap 5 · **Build tool:** Vite + SCSS

This document is a **developer reference** for every part of the CTFd UI you can customize — from a single CSS variable all the way to a full theme replacement. Use the [Customization Guide](customization_guide.md) for the step-by-step MMSU-CCIS event setup; use *this* document when you need to know *which file* controls *which visual element*.

---

## Table of Contents

1. [Theme Architecture](#1-theme-architecture)
2. [SCSS Design Tokens](#2-scss-design-tokens)
3. [SCSS Component Partials](#3-scss-component-partials)
4. [Template Map](#4-template-map)
5. [Static Assets](#5-static-assets)
6. [JavaScript Modules](#6-javascript-modules)
7. [Admin-UI Config Knobs](#7-admin-ui-config-knobs)
8. [Plugin Injection Points](#8-plugin-injection-points)
9. [Customization Decision Tree](#9-customization-decision-tree)

---

## 1. Theme Architecture

### 1.1 Directory Layout

```
CTFd/themes/
├── core/                  ← Upstream default theme (Bootstrap 5 + vanilla SCSS)
│   ├── assets/            ← Source files (compiled by Vite)
│   │   ├── img/           ← Source images
│   │   ├── js/            ← JavaScript source files
│   │   ├── scss/          ← SCSS source (main.scss + partials)
│   │   └── sounds/        ← Notification audio files
│   ├── static/            ← Compiled output (served directly)
│   │   ├── assets/        ← Built JS/CSS bundles
│   │   ├── img/           ← Compiled images
│   │   ├── sounds/
│   │   └── webfonts/      ← Font Awesome webfonts
│   └── templates/         ← Jinja2 templates
│       ├── base.html
│       ├── components/
│       │   ├── navbar.html
│       │   ├── notifications.html
│       │   └── snackbar.html
│       ├── macros/
│       ├── errors/
│       └── *.html         ← Page-level templates
│
├── admin/                 ← Admin panel theme (separate from public theme)
│   ├── assets/
│   ├── static/
│   └── templates/
│
└── <your-theme>/          ← Your custom theme (copy of core or minimal override)
```

### 1.2 Template Resolution Order

When a page is requested, Jinja2 searches templates in this order:

```
1. DictLoader         → In-memory overrides registered by plugins
2. ThemeLoader        → CTFd/themes/<active-theme>/templates/
3. ThemeLoader        → CTFd/themes/core/templates/   (if THEME_FALLBACK=true)
4. PrefixLoader       → "admin/" prefix → admin theme only
5. PrefixLoader       → "plugins/*" prefix → plugin templates
```

**Key rule:** You only need to provide the templates you want to *change*. All others fall through to `core` automatically.

### 1.3 Creating a Custom Theme

```bash
# 1. Copy the core theme as a starting point
cp -r CTFd/themes/core CTFd/themes/<your-theme>

# 2. Install JS dependencies (first time)
cd CTFd/themes/<your-theme>
yarn install

# 3. Build assets
yarn build          # Production build
yarn dev            # Watch mode (hot-reload)

# 4. Activate via Admin Panel
# Admin → Config → General → Theme → select <your-theme>
```

> **Minimal approach:** Instead of copying all of `core`, create an empty theme folder and only add the files you want to override. With `THEME_FALLBACK=true`, everything else is served from `core`.

---

## 2. SCSS Design Tokens

### 2.1 Entry Point

**File:** `CTFd/themes/core/assets/scss/main.scss`

This file imports Bootstrap 5 with token overrides, then loads all component and utility partials.

```scss
@use "bootstrap/scss/bootstrap" as * with (
  $info: #5c728f   ← Only token currently overridden in core
);

@use "includes/components/table";
@use "includes/components/jumbotron";
@use "includes/components/challenge";
@use "includes/components/sticky-footer";
@use "includes/components/graphs";

@use "includes/utils/fonts";
@use "includes/utils/opacity";
@use "includes/utils/min-height";
@use "includes/utils/cursors";
@use "includes/utils/lolight";

@use "includes/icons/award-icons";
@use "includes/icons/flag-icons";
```

### 2.2 Bootstrap 5 Token Override Map

Place these **before** `@use "bootstrap/scss/bootstrap"` to override the design system:

| Token | Core value | Controls |
|---|---|---|
| `$primary` | Bootstrap default blue `#0d6efd` | Primary buttons, active links, focus rings |
| `$secondary` | Bootstrap default gray `#6c757d` | Secondary buttons, blockquote border |
| `$dark` | `#212529` | Dark backgrounds (navbar `bg-dark`) |
| `$light` | `#f8f9fa` | Light backgrounds, card surfaces |
| `$info` | `#5c728f` *(overridden in core)* | Info alerts, badges |
| `$success` | `#198754` | Success alerts, correct-answer feedback |
| `$danger` | `#dc3545` | Error alerts, wrong-answer feedback |
| `$warning` | `#ffc107` | Warning alerts |
| `$font-family-sans-serif` | System font stack | Body text |
| `$headings-font-weight` | `500` | Heading boldness |
| `$headings-letter-spacing` | — | Heading tracking (set to `2px` in core body rules) |
| `$navbar-dark-color` | — | Navbar link color (dark navbar variant) |
| `$navbar-dark-hover-color` | — | Navbar link hover color |
| `$btn-border-radius` | `0.375rem` | Button corner radius |

**Example override block:**

```scss
// In your-theme/assets/scss/main.scss — BEFORE @use bootstrap

$primary:   #8B0000;   // your brand color
$secondary: #FFD700;   // accent color
$dark:      #141414;   // deep dark bg

@use "bootstrap/scss/bootstrap" as * with (
  $primary:   #8B0000,
  $secondary: #FFD700,
  $dark:      #141414,
  $info:      #5c728f
);
```

### 2.3 Custom CSS Properties (Runtime)

For runtime-swappable tokens (light/dark mode), you can also define CSS custom properties in your `main.scss`:

```scss
:root {
  --brand-primary: #8B0000;
  --brand-secondary: #FFD700;
}
[data-bs-theme="dark"] {
  --brand-primary: #c0392b;
}
```

The built-in `color_mode_switcher.js` handles the `data-bs-theme` toggle — your CSS variables will react automatically.

---

## 3. SCSS Component Partials

### 3.1 Partials Location

```
CTFd/themes/core/assets/scss/includes/
├── components/
│   ├── _challenge.scss      ← Challenge card + modal styling
│   ├── _graphs.scss         ← Scoreboard bar/line chart styles
│   ├── _jumbotron.scss      ← Re-implements Bootstrap 4 jumbotron
│   ├── _sticky-footer.scss  ← Keeps footer pinned to viewport bottom
│   └── _table.scss          ← Responsive table overrides
├── icons/
│   ├── _award-icons.scss    ← Award icon colors/sizing
│   └── _flag-icons.scss     ← Country flag icon utility classes
└── utils/
    ├── _cursors.scss        ← Custom cursor classes
    ├── _fonts.scss          ← Font utility classes
    ├── _lolight.scss        ← Inline code syntax highlighting
    ├── _min-height.scss     ← `.min-vh-*` utility extensions
    └── _opacity.scss        ← `.opacity-*` utility extensions
```

### 3.2 Key Classes to Know

| Class | Defined in | Purpose |
|---|---|---|
| `.challenge-button` | `_challenge.scss` | Challenge card button in the grid |
| `.jumbotron` | `_jumbotron.scss` | Hero / banner section container |
| `.footer` | `_sticky-footer.scss` | Page footer with sticky positioning |
| `.badge-notification` | `main.scss` | Red notification count badge on nav bell icon |
| `.fa-spin.spinner` | `main.scss` | Loading spinner |
| `.form-select` | `main.scss` | Custom select arrow (SVG override) |

---

## 4. Template Map

### 4.1 Public Theme Templates

All files under `CTFd/themes/core/templates/`. Override any by placing the same relative path under your custom theme.

| Template | Route(s) | What to customize |
|---|---|---|
| `base.html` | All pages | `<head>` meta, global CSS/JS, navbar include, footer HTML, plugin injection slots |
| `components/navbar.html` | All pages | Brand logo, nav links, dark/light mode toggle, language picker |
| `components/notifications.html` | All pages | SSE notification toast HTML/JS |
| `components/snackbar.html` | All pages | Inline snackbar alert component |
| `login.html` | `/login` | Login form card layout, branding above form |
| `register.html` | `/register` | Registration form, eligibility notice |
| `reset_password.html` | `/reset_password` | Password reset form |
| `confirm.html` | `/confirm` | Email confirmation page |
| `challenges.html` | `/challenges` | Challenge grid outer container |
| `challenge.html` | modal (JS-rendered) | Challenge detail modal: description, file list, hint button, flag input |
| `scoreboard.html` | `/scoreboard` | Scoreboard table/graph layout |
| `notifications.html` | `/notifications` | Notifications list page |
| `page.html` | `/` and CMS routes | CMS page wrapper |
| `config.html` | (setup wizard redirect) | Post-setup config landing |
| `settings.html` | `/settings` | Player settings form |
| `setup.html` | `/setup` | First-run setup wizard |
| `errors/400.html` … `errors/500.html` | Error pages | Branded error pages |
| `teams/` | `/teams/*` | Team listing, private team page, join/create forms |
| `users/` | `/users/*` | User listing, private profile page |
| `macros/` | (included) | Reusable field/card macros |

### 4.2 Admin Theme Templates

Located at `CTFd/themes/admin/templates/`. The admin panel has its own separate theme.

> **Note:** Admin templates are namespace-protected — only the admin theme loader can serve `admin/*` paths. Do not place admin templates in your public custom theme.

Customize admin templates only when you need to:
- Rebrand the admin panel sidebar/header
- Add custom admin menu items (see [Plugin Injection Points](#8-plugin-injection-points))

### 4.3 Key Template Variables

| Variable | Type | Description |
|---|---|---|
| `Configs.ctf_name` | string | CTF display name |
| `Configs.ctf_logo` | string/null | Path to uploaded logo |
| `Configs.ctf_small_icon` | string | Favicon URL |
| `Configs.ctf_theme` | string | Active theme name |
| `Configs.user_mode` | `"users"` \| `"teams"` | Competition mode |
| `Configs.theme_header` | safe HTML | Admin-injected `<head>` HTML |
| `Configs.theme_footer` | safe HTML | Admin-injected footer HTML |
| `Session.nonce` | string | CSRF nonce for forms |
| `Session.id` | int/null | Logged-in user ID |
| `Plugins.scripts` | safe HTML | Plugin-registered `<script>` tags |
| `Plugins.styles` | safe HTML | Plugin-registered `<link>` tags |
| `Plugins.user_menu_pages` | list | Extra nav links registered by plugins |

---

## 5. Static Assets

### 5.1 Image Assets

| File | Path | Replace with |
|---|---|---|
| Logo (PNG) | `CTFd/themes/core/assets/img/logo.png` | Your organization logo |
| Logo (SVG) | `CTFd/themes/core/assets/img/ctfd.svg` | Your organization logo (vector) |
| Favicon | `CTFd/themes/core/assets/img/favicon.ico` | Your 32×32 favicon |
| Scoreboard screenshot | `CTFd/themes/core/assets/img/scoreboard.png` | Not user-facing (README only) |

> **Easier alternative:** Upload logo and favicon directly through **Admin → Config → General** — no file replacement needed. These override `logo.png` and `favicon.ico` at runtime from the database config.

**Project branding assets** (already in repo):

| File | Path |
|---|---|
| CCIS logo | `assets/ccis.png` |
| MMSU logo (transparent) | `assets/mmsu_tansparent.png` |
| Honor Society logo | `assets/honor_society_simple_transparent.png` |

To use these in templates:

```html
<img src="/static/assets/ccis.png" alt="CCIS">
<!-- Or mount into theme static with a volume / copy in Dockerfile -->
```

### 5.2 Sound Assets

| File | Path | Trigger |
|---|---|---|
| `notification.webm` | `CTFd/themes/core/static/sounds/` | SSE notification received |
| `notification.mp3` | `CTFd/themes/core/static/sounds/` | SSE notification (fallback) |

Override these to change the notification sound.

### 5.3 Compiled Asset Bundles

After running `yarn build`, Vite emits to `CTFd/themes/<theme>/static/assets/`. The `manifest.json` maps source files to hashed bundle names. **Do not edit the `static/assets/` files directly** — they are overwritten on every build.

---

## 6. JavaScript Modules

### 6.1 Core JS Files

| File | Purpose | When to modify |
|---|---|---|
| `assets/js/color_mode_switcher.js` | Light/dark mode toggle; writes `data-bs-theme` to `<html>` | Change available color modes or default |
| `assets/js/challenges.js` | Challenge grid rendering, modal open/close, flag submission | Modify challenge card layout or submission behavior |
| `assets/js/scoreboard.js` | Scoreboard table + graph rendering (Chart.js) | Change chart type, column layout, or add bracket tabs |
| `assets/js/notifications.js` | SSE event listener → toast popup logic | Change toast style or notification sound |
| `assets/js/settings.js` | Player settings form handlers | Add custom settings fields |
| `assets/js/setup.js` | First-run wizard multi-step form | Modify onboarding flow |
| `assets/js/page.js` | Bootstrap init + common page utilities | Add global page-level behavior |
| `assets/js/index.js` | Module entry point, imports shared utilities | Add global imports |

### 6.2 Utility Modules

```
assets/js/utils/
├── graphs.js        ← Chart.js wrappers (score-over-time graphs)
├── math.js          ← Score calculation helpers
└── time.js          ← Date formatting for countdown timers
```

### 6.3 Global `window.init` Object

Defined in `base.html`, accessible to all page scripts:

```js
window.init = {
  urlRoot:       "",           // Script root for subdirectory deployments
  csrfNonce:     "...",        // CSRF token — include in AJAX POST headers
  userMode:      "teams",      // "users" or "teams"
  userId:        42,
  userName:      "alice",
  userEmail:     "alice@example.com",
  userVerified:  true,
  teamId:        7,
  teamName:      "Team Rocket",
  start:         1700000000,   // CTF start (unix timestamp)
  end:           1700086400,   // CTF end (unix timestamp)
  themeSettings: {},           // JSON blob from Admin → Config → Theme
  eventSounds:   ["/themes/core/static/sounds/notification.webm", "...mp3"],
}
```

Use `window.init.csrfNonce` in any custom AJAX calls:

```js
fetch("/api/v1/challenges", {
  method: "POST",
  headers: { "CSRF-Token": window.init.csrfNonce }
})
```

---

## 7. Admin-UI Config Knobs

These settings directly affect the UI **without touching theme files**. Change them at **Admin → Config**.

### 7.1 General (Visual Identity)

| Setting | Effect |
|---|---|
| **CTF Name** | Shown in `<title>`, navbar brand fallback, and email subjects |
| **CTF Description** | Used in `<meta name="description">` |
| **CTF Logo** | Replaces navbar brand text; uploaded file served from `/files/` |
| **CTF Small Icon** | Favicon; uploaded file served from `/files/` |
| **Theme** | Active theme name; must match a folder in `CTFd/themes/` |
| **Theme Header** | Raw HTML/CSS injected into every page `<head>` ← inject custom fonts, analytics |
| **Theme Footer** | Raw HTML injected at the bottom of every page `<body>` |
| **Theme Color** | Color shown in browser UI (PWA theme-color meta tag) |

### 7.2 Challenge Visibility

| Setting | Effect on UI |
|---|---|
| **Challenge Visibility** | `private`: challenge list hidden to non-authenticated users |
| **Score Visibility** | `admins`: scoreboard hidden on public pages |
| **Account Visibility** | `admins`: player profiles hidden |
| **Registration Visibility** | `private`: hides the Register link in navbar |

### 7.3 Competition Control

| Setting | Effect |
|---|---|
| **Start / End** | Enables countdown timer on navbar/challenges; gates submissions |
| **Freeze** | Freezes scoreboard display at specified timestamp |
| **Pause CTF** | Disables all submissions immediately |

---

## 8. Plugin Injection Points

Plugins (in `CTFd/plugins/<name>/`) can inject UI elements without modifying theme files:

| Injection function | What it adds | Where it appears |
|---|---|---|
| `register_plugin_script(url)` | `<script src="...">` | Public theme `base.html` |
| `register_plugin_stylesheet(url)` | `<link rel="stylesheet">` | Public theme `base.html` |
| `register_admin_plugin_script(url)` | `<script src="...">` | Admin theme `base.html` |
| `register_admin_plugin_stylesheet(url)` | `<link rel="stylesheet">` | Admin theme `base.html` |
| `register_admin_plugin_menu_bar(title, route)` | Nav item | Admin sidebar |
| `register_user_page_menu_bar(title, route)` | Nav item | Public navbar |
| `override_template(name, html)` | Replaces full template | Anywhere via DictLoader |

**Example plugin `load()` function:**

```python
from CTFd.plugins import (
    register_plugin_stylesheet,
    register_user_page_menu_bar,
    override_template,
)

def load(app):
    # Inject a custom stylesheet into the public theme
    register_plugin_stylesheet("/plugins/my-plugin/static/style.css")

    # Add a nav link
    register_user_page_menu_bar("Sponsors", "/sponsors")

    # Override a template completely
    override_template("scoreboard.html", open("my_scoreboard.html").read())
```

---

## 9. Customization Decision Tree

Use this to choose the right approach for what you want to change:

```
What do I want to change?
│
├─ Brand name / logo / favicon
│   └─ Admin → Config → General  (no code needed)
│
├─ Color palette
│   └─ Override Bootstrap SCSS tokens in your-theme/assets/scss/main.scss
│       then run yarn build
│
├─ Fonts
│   ├─ Google Fonts → inject @import in main.scss or via Theme Header
│   └─ Self-hosted → add to assets/scss/includes/utils/_fonts.scss
│
├─ Navbar layout / links
│   └─ Override CTFd/themes/<your-theme>/templates/components/navbar.html
│
├─ Footer content
│   └─ Edit footer block in CTFd/themes/<your-theme>/templates/base.html
│
├─ Home page / landing
│   ├─ Option A: Admin → Pages → create route "/"  (no code)
│   └─ Option B: Override templates/page.html
│
├─ A specific page (login, register, scoreboard, etc.)
│   └─ Copy that template into your-theme/templates/ and edit it
│
├─ Challenge card appearance
│   └─ Edit assets/scss/includes/components/_challenge.scss
│       + customize challenge.html (modal body)
│
├─ Challenge behavior (submission, flag format, scoring)
│   └─ Create a Challenge Type plugin in CTFd/plugins/<name>/
│
├─ Add a nav item or page for all public users
│   └─ register_user_page_menu_bar() in a plugin  OR
│       Admin → Pages → create page + set hidden=false
│
├─ Inject custom JS/CSS sitewide (no theme copy needed)
│   └─ register_plugin_script() / register_plugin_stylesheet() in a plugin
│       OR use Admin → Config → Theme Header / Theme Footer
│
└─ Change admin panel appearance
    └─ Override CTFd/themes/admin/templates/ files
        (keep admin/* namespace protected)
```

---

## Appendix A: File Quick-Reference

| What you want to change | File to edit |
|---|---|
| Bootstrap color tokens | `assets/scss/main.scss` |
| Challenge card CSS | `assets/scss/includes/components/_challenge.scss` |
| Scoreboard graph CSS | `assets/scss/includes/components/_graphs.scss` |
| Footer layout CSS | `assets/scss/includes/components/_sticky-footer.scss` |
| Navbar HTML | `templates/components/navbar.html` |
| Page `<head>` / footer HTML | `templates/base.html` |
| Login page | `templates/login.html` |
| Registration page | `templates/register.html` |
| Challenge modal | `templates/challenge.html` |
| Scoreboard page | `templates/scoreboard.html` |
| Home/CMS page wrapper | `templates/page.html` |
| Event sounds | `static/sounds/notification.webm` + `.mp3` |
| Logo (file) | `assets/img/logo.png` or Admin Upload |
| Favicon (file) | `assets/img/favicon.ico` or Admin Upload |
| Challenge grid JS | `assets/js/challenges.js` |
| Scoreboard JS / charts | `assets/js/scoreboard.js` |
| Dark/light mode toggle | `assets/js/color_mode_switcher.js` |

## Appendix B: Build Commands

```bash
# From CTFd/themes/<your-theme>/
yarn install        # Install dependencies (first time only)
yarn dev            # Start Vite dev server with hot-reload
yarn build          # Production build → static/assets/
yarn lint           # ESLint + Prettier check

# From project root
make lint           # Python (black, isort, flake8) + JS linting
pytest              # Run test suite
```

---

*Last updated: March 2026 · CTFd v3.8.2*
