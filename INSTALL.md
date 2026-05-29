# Install ChatSpace Community Edition

ChatSpace Community Edition is designed for ordinary PHP hosting. If a host can run common PHP apps like WordPress or 4images, it should be in the right neighborhood for ChatSpace CE.

## Requirements

- PHP 8.2 or newer
- Apache, NGINX, LiteSpeed, or another web server capable of serving PHP
- SQLite through PDO SQLite, recommended
- Optional MySQL 5.7+ or MariaDB 10.3+ through PDO MySQL
- Writable `includes/`, `db/`, and `assets/uploads/` directories

## Required PHP Extensions

| Extension | Purpose |
| --- | --- |
| `pdo` | Database abstraction |
| `pdo_sqlite` | Recommended SQLite install path |
| `fileinfo` | Upload MIME validation |
| `gd` | Avatar and image handling |
| `mbstring` | Text handling |
| `openssl` | Password and session safety |

## Optional PHP Extensions

| Extension | Purpose |
| --- | --- |
| `pdo_mysql` | MySQL or MariaDB install path |
| `zip` | Database backup/package support |

## Tech Stack

- PHP 8.x
- SQLite or MySQL/MariaDB
- Vanilla JavaScript
- Long-polling for room, community, link, and DM events
- WebRTC for voice chat
- File uploads for avatars, room backgrounds, attachments, voice notes, and webcam frames

## Installation

1. Upload and extract ChatSpace Community Edition into the folder where it should run.

2. Visit `setup.php` in your browser.

3. Run Setup and select or configure your database.

   SQLite is recommended for most Community Edition installs. MySQL/MariaDB is available when your host or deployment requires it.

4. Create the first admin account.

   The first admin account requires a display name, avatar image, email address, and password.

5. Enter the lobby and create the first room.

   A room starts with a name and an optional image or video background. Room owners, developers, and admins can edit rooms later.

## Subdirectory Installs

ChatSpace Community Edition is intended to run from a domain root or a hosted folder such as `/chat/`. The setup and routing helpers preserve the app base path so assets, API calls, and redirects continue to work from that hosted location.

## Web Server Hardening

Apache and LiteSpeed installs include `.htaccess` files that:

- Block direct web access to `db/` and `includes/`
- Disable directory indexes
- Disable PHP execution in `assets/uploads/`
- Block executable or browser-executable uploads such as PHP, SVG, HTML, JS, and CSS
- Send baseline security headers including `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and a same-origin Content Security Policy

For NGINX, add equivalent rules to the server block:

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" always;
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'self'" always;

location ^~ /db/ { deny all; }
location ^~ /includes/ { deny all; }

location ^~ /assets/uploads/ {
    autoindex off;
    location ~* \.(php[0-9]?|phtml|phar|cgi|pl|py|rb|asp|aspx|jsp|html?|shtml|xhtml|svgz?|js|mjs|css)$ {
        deny all;
    }
}
```

## Packaging Notes

The release zip is flat by design. Extract it directly into the target folder.

macOS metadata such as `.DS_Store`, `__MACOSX`, `.AppleDouble`, and `._*` files are excluded from release packages.
