#!/usr/bin/env bash
# LOCAL DEVELOPMENT ONLY. Rebuilds the database from migrations and the demo seed.
# Usage: DEV_DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres bash scripts/dev-db-reset.sh
set -euo pipefail
DB="${DEV_DATABASE_URL:-postgres://postgres:postgres@localhost:54322/postgres}"
PSQL=(psql "$DB" -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -c "drop schema if exists public cascade; create schema public; drop schema if exists auth cascade;" >/dev/null
"${PSQL[@]}" -f supabase/tests/auth_shim.sql
"${PSQL[@]}" -c "alter table auth.users add column if not exists dev_password text;"
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f supabase/seed/demo.sql
echo "Database ready. Demo logins are listed at the top of supabase/seed/demo.sql"
