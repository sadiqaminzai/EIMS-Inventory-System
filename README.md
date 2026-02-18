# Enterprise Inventory Management System (EIMS)

Enterprise Inventory Management System (EIMS) is a modular, full-stack application for managing products, inventory, orders, suppliers, customers, and multi-tenant account data. This repository contains a Laravel-powered backend and a modern frontend built with Vite and TypeScript.

This README gives a friendly, developer-focused overview of the project, its structure, how to get it running locally, and where to look when you want to extend or contribute.

## Key Highlights

- **Backend:** Laravel PHP application (API + web routes), prepared with models, migrations, seeders, and artisan commands.
- **Frontend:** Vite-based TypeScript frontend (React) with a modular `src/` layout.
- **Multi-tenant-friendly:** Contains tenant context utilities and services to scope data per tenant.
- **Backup & maintenance helpers:** Scripts and docs for automated backups and health checks.

## Repository Layout

Top-level folders and their purpose:

- `backend/` — Laravel application (API, models, migrations, controllers, config).
- `frontend/` — Vite + TypeScript UI source code.
- `public/` — Public web entry for the backend (server-side index.php).
- `README.md` — This file.

### Backend (Laravel)

Core backend files and directories you’ll typically work with:

- `backend/app/Models/` — Eloquent models (e.g., `User`, `Product`, `Order`, `Payment`, `Tenant`).
- `backend/app/Http/Controllers/` — Controller classes that handle requests.
- `backend/routes/` — Route definitions: `api.php`, `web.php` and `console.php`.
- `backend/config/` — Laravel config files for database, session, mail, and app settings.
- `backend/database/migrations/` — Database schema definitions used by `php artisan migrate`.
- `backend/database/seeders/` — Optional seeders for test or initial data.
- `backend/bootstrap/` and `backend/vendor/` — Framework bootstrap and dependencies.
- `backend/artisan` — Laravel CLI entrypoint for running commands, migrations, and tests.

Notable utilities and extras:

- `backup_test.txt`, `check_backup.php`, `AUTOMATIC_BACKUPS.md` — Backup tooling and documentation.
- `app/Support/TenantContext.php` and `TenantTeamResolver.php` — Helpers for tenant-scoped logic.

### Frontend (Vite + TypeScript)

Frontend structure (main folders inside `frontend/`):

- `frontend/src/` — Application source code (components, services, store, hooks).
- `frontend/src/main.tsx` — Frontend entrypoint.
- `frontend/public/` — Static assets served by the frontend.
- `frontend/package.json` — Front-end dependencies and scripts.
- `vite.config.ts` — Vite configuration for dev and build.

The frontend is set up for modern development: run dev server with Vite, and build optimized production bundles with `npm run build`.

## Getting Started (Local Development)

Prerequisites

- PHP (>= 8.0 recommended) with required extensions
- Composer
- Node.js (>= 16) and npm or yarn
- MySQL or another database supported by Laravel
- (Optional) XAMPP or another local web server — this repo already lives under `c:/xampp/htdocs/EIMS` if using XAMPP on Windows.

Backend setup

1. Open a terminal in `backend/`.
2. Copy `.env.example` to `.env` and configure these keys: `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, and any mail or storage settings.
3. Install dependencies and generate app key:

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

4. Create the database (via your DB client) and run migrations & seeders:

```bash
php artisan migrate
php artisan db:seed    # optional, if seeders are provided
```

5. Run the local backend server:

```bash
php artisan serve
```

Frontend setup

1. Open a terminal in `frontend/`.
2. Install frontend dependencies and start the dev server:

```bash
cd frontend
npm install
npm run dev
```

3. Visit the dev URL shown by Vite (typically `http://localhost:5173`).

Integrating frontend & backend

- Configure the frontend API base URL in `frontend/src` (or env file) to point to the backend dev server (e.g., `http://127.0.0.1:8000/api`).

## Running Tests

- Backend: from `backend/` run `php artisan test` or `vendor/bin/phpunit` depending on your setup.
- Frontend: run `npm test` (if tests are configured) or use your chosen test runner.

## Common Tasks & Commands

- `composer install` — Install PHP dependencies.
- `php artisan migrate` — Run database migrations.
- `php artisan db:seed` — Run database seeders.
- `php artisan tinker` — Interactive REPL for Laravel.
- `npm install` and `npm run dev` — Frontend install and dev server.
- `npm run build` — Frontend production build.

## Where To Look When Extending the Project

- Add new database columns: create a migration and update the corresponding Eloquent model in `backend/app/Models/`.
- Add new API endpoints: create a controller in `backend/app/Http/Controllers/` and register routes in `backend/routes/api.php`.
- Frontend components: add UI components under `frontend/src/components` and hook them into routes or pages.

## Deployment Notes

1. Build frontend assets: `cd frontend && npm run build` and copy the `dist/` contents to your server (or serve separately).
2. Backend production steps (examples):

```bash
composer install --no-dev --optimize-autoloader
php artisan config:cache
php artisan route:cache
php artisan migrate --force
```

3. Ensure file storage and permissions are correct, and that a robust backup policy is in place (see `AUTOMATIC_BACKUPS.md`).

## Contribution

Contributions are welcome. Suggested workflow:

1. Fork the repo and create a feature branch.
2. Make changes and add tests where appropriate.
3. Open a pull request with a clear description of the change.

Please follow existing code style and keep changes focused.

## Useful References in This Repo

- Backend entry: [backend/](backend/)
- Frontend entry: [frontend/](frontend/)
- Backup docs: [backend/AUTOMATIC_BACKUPS.md](backend/AUTOMATIC_BACKUPS.md)

## License

Specify your project license here (e.g., MIT). If you don't have one yet, consider adding a `LICENSE` file.

---
