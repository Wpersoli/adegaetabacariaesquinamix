-- Esquina Mix: pending signup lifecycle and server-side rate limiting.
-- RECOVERED MIGRATION (2026-11-25):
-- The original file was absent from Git, although version 20261119022341
-- is recorded as applied in production. Definitions below were reconstructed
-- from live PostgreSQL catalogs (columns, constraints, indexes, function
-- bodies, security mode, search_path and ACLs).
-- This is a recovery of the observed database objects, not a byte-for-byte
-- copy of the lost source file. Review before using on a new project.
--
-- IMPORTANT: This migration is already recorded as applied in production.
-- Do not execute it manually against the production database.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.pending_registration (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 5 and 120),
  birth_date date not null,
  cpf_hash text not null check (cpf_hash ~ '^[0-9a-f]{64}$'),
  phone_e164 text not null check (phone_e164 ~ '^\\+55[1-9][0-9][2-9][0-9]{7,8}$'),
  created_at timestamptz not null default now()
);
alter table private.pending_registration enable row level security;
revoke all on private.pending_registration from public, anon, authenticated;
grant all on private.pending_registration to service_role;
create index if not exists pending_registration_created_idx
  on private.pending_registration (created_at);

create table if not exists private.auth_rate_limit (
  id bigint generated always as identity primary key,
  bucket text not null check (char_length(bucket) between 1 and 40),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table private.auth_rate_limit enable row level security;
revoke all on private.auth_rate_limit from public, anon, authenticated;
grant all on private.auth_rate_limit to service_role;
create index if not exists auth_rate_limit_created_idx
  on private.auth_rate_limit (created_at);
create index if not exists auth_rate_limit_lookup_idx
  on private.auth_rate_limit (bucket, key_hash, created_at desc);

create or replace function public.check_rate_limit(
  p_bucket text, p_key_hash text, p_max integer, p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_count integer;
begin
  if p_bucket is null or char_length(p_bucket) < 1 or char_length(p_bucket) > 40
     or p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_max is null or p_max < 1
     or p_window_seconds is null or p_window_seconds < 1 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_key_hash, 0));
  delete from private.auth_rate_limit
   where created_at < now() - interval '1 day';

  select count(*) into v_count
    from private.auth_rate_limit
   where bucket = p_bucket
     and key_hash = p_key_hash
     and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return false;
  end if;

  insert into private.auth_rate_limit (bucket, key_hash)
  values (p_bucket, p_key_hash);
  return true;
end;
$$;

create or replace function public.stage_pending_registration(
  p_user_id uuid, p_full_name text, p_birth_date date,
  p_cpf_hash text, p_phone_e164 text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if p_user_id is null or p_full_name is null or char_length(trim(p_full_name)) < 5
     or p_birth_date is null or p_cpf_hash is null or p_cpf_hash !~ '^[0-9a-f]{64}$'
     or p_phone_e164 is null
     or p_phone_e164 !~ '^\\+55[1-9][0-9][2-9][0-9]{7,8}$' then
    raise exception 'INVALID_PROFILE' using errcode = '22023';
  end if;

  delete from auth.users u
   using private.pending_registration p
   where p.user_id = u.id
     and p.created_at < now() - interval '48 hours'
     and u.email_confirmed_at is null;
  delete from private.pending_registration
   where created_at < now() - interval '48 hours';

  insert into private.pending_registration (
    user_id, full_name, birth_date, cpf_hash, phone_e164
  )
  values (p_user_id, trim(p_full_name), p_birth_date, p_cpf_hash, p_phone_e164)
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        birth_date = excluded.birth_date,
        cpf_hash = excluded.cpf_hash,
        phone_e164 = excluded.phone_e164,
        created_at = now();
end;
$$;

create or replace function public.promote_pending_registration(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v private.pending_registration%rowtype;
begin
  select * into v
    from private.pending_registration
   where user_id = p_user_id
   for update;

  if not found then return 'NONE'; end if;

  if not exists (
    select 1 from auth.users
     where id = p_user_id and email_confirmed_at is not null
  ) then
    return 'UNCONFIRMED';
  end if;

  if exists (
    select 1 from public.customer_profiles where user_id = p_user_id
  ) then
    delete from private.pending_registration where user_id = p_user_id;
    return 'EXISTS';
  end if;

  begin
    perform public.register_customer_profile(
      v.user_id, v.full_name, v.birth_date, v.cpf_hash, v.phone_e164
    );
    delete from private.pending_registration where user_id = p_user_id;
    return 'PROMOTED';
  exception when unique_violation then
    delete from private.pending_registration where user_id = p_user_id;
    return 'CPF_IN_USE';
  end;
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.stage_pending_registration(uuid, text, date, text, text)
  from public, anon, authenticated;
revoke all on function public.promote_pending_registration(uuid)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer)
  to service_role;
grant execute on function public.stage_pending_registration(uuid, text, date, text, text)
  to service_role;
grant execute on function public.promote_pending_registration(uuid)
  to service_role;
