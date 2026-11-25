#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable PostgreSQL database}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email_confirmed_at timestamptz
);
CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
SQL

expected_migrations=(
  "20261117024320_esquina_auth.sql"
  "20261117031101_customer_phone_required.sql"
  "20261117231903_customer_profile_edit.sql"
  "20261117235556_customer_orders.sql"
  "20261118023925_store_event_aggregation.sql"
  "20261119022341_pending_registration_and_hardening.sql"
)
actual_migrations="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\\n' | sort)"
expected_list="$(printf '%s\\n' "${expected_migrations[@]}" | sort)"
if [[ "$actual_migrations" != "$expected_list" ]]; then
  echo "Migration directory does not match the six versions recorded in production." >&2
  echo "Expected:" >&2
  printf '%s\\n' "$expected_list" >&2
  echo "Found:" >&2
  printf '%s\\n' "$actual_migrations" >&2
  exit 1
fi

for filename in "${expected_migrations[@]}"; do
  migration="supabase/migrations/$filename"
  echo "Applying $migration"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  test_user uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  test_hash text := repeat('a', 64);
  result text;
BEGIN
  IF to_regclass('private.pending_registration') IS NULL
     OR to_regclass('private.auth_rate_limit') IS NULL THEN
    RAISE EXCEPTION 'Recovered private tables are missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'customer_profiles'
       AND column_name = 'delivery_address'
  ) OR to_regprocedure('public.update_customer_profile(uuid,text,date,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'A legacy, non-production account-details migration was applied';
  END IF;

  IF to_regprocedure('public.update_customer_profile(uuid,text,date,text)') IS NULL THEN
    RAISE EXCEPTION 'The production 4-argument profile RPC is missing';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.pending_registration'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'private.auth_rate_limit'::regclass) THEN
    RAISE EXCEPTION 'RLS must be enabled on recovered private tables';
  END IF;

  IF has_schema_privilege('anon', 'private', 'USAGE')
     OR has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'Private schema must not be exposed to client roles';
  END IF;

  IF has_function_privilege('anon', 'public.check_rate_limit(text,text,integer,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.stage_pending_registration(uuid,text,date,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.promote_pending_registration(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'A privileged RPC is executable by a client role';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.check_rate_limit(text,text,integer,integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.stage_pending_registration(uuid,text,date,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.promote_pending_registration(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role is missing a required RPC grant';
  END IF;

  INSERT INTO auth.users (id) VALUES (test_user);
  PERFORM public.stage_pending_registration(
    test_user, 'Cliente Teste', DATE '1990-04-20', test_hash, '+5511999999999'
  );

  IF (SELECT count(*) FROM private.pending_registration WHERE user_id = test_user) <> 1 THEN
    RAISE EXCEPTION 'Pending signup was not staged';
  END IF;

  result := public.promote_pending_registration(test_user);
  IF result <> 'UNCONFIRMED' THEN
    RAISE EXCEPTION 'Unconfirmed account should not be promoted; got %', result;
  END IF;

  UPDATE auth.users SET email_confirmed_at = now() WHERE id = test_user;
  result := public.promote_pending_registration(test_user);
  IF result <> 'PROMOTED' THEN
    RAISE EXCEPTION 'Confirmed account should be promoted; got %', result;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customer_profiles WHERE user_id = test_user)
     OR NOT EXISTS (SELECT 1 FROM private.customer_identity WHERE user_id = test_user)
     OR EXISTS (SELECT 1 FROM private.pending_registration WHERE user_id = test_user) THEN
    RAISE EXCEPTION 'Promotion did not move identity/profile data atomically';
  END IF;

  IF public.check_rate_limit('signup-test', test_hash, 1, 60) IS NOT TRUE
     OR public.check_rate_limit('signup-test', test_hash, 1, 60) IS NOT FALSE THEN
    RAISE EXCEPTION 'Rate limiter did not enforce the configured threshold';
  END IF;
END
$$;

SELECT 'Supabase migrations and recovered signup/rate-limit flows passed.' AS result;
SQL
