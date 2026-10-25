#!/usr/bin/env bash
# Runs migrations, seed and RLS tests on a plain Postgres database.
# Usage: TEST_DATABASE_URL=postgres://... bash scripts/db-test.sh
# For a Supabase project, use `supabase db reset` instead. It runs the same migrations and seed.
set -euo pipefail

DB_URL="${TEST_DATABASE_URL:-postgres://postgres:postgres@localhost:54322/postgres}"
PSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -q)

echo "==> Recreating public schema"
"${PSQL[@]}" -c "drop schema if exists public cascade; create schema public;" \
  -c "drop schema if exists auth cascade;"

echo "==> Local auth shim (plain Postgres only)"
"${PSQL[@]}" -f supabase/tests/auth_shim.sql

echo "==> Migrations"
for f in supabase/migrations/*.sql; do
  echo "    $f"
  "${PSQL[@]}" -f "$f"
done

echo "==> Seed"
"${PSQL[@]}" -f supabase/seed.sql

echo "==> RLS and ledger tests"
"${PSQL[@]}" -f supabase/tests/rls.test.sql
