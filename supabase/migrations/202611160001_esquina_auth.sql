-- Esquina Mix: identity/profile storage for Supabase Auth.
-- CPF is never stored in clear text; the Vercel API stores only an HMAC-SHA256 digest.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 5 and 120),
  birth_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;

drop policy if exists "Customers can read their own profile" on public.customer_profiles;
create policy "Customers can read their own profile"
  on public.customer_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Customers can update their own name" on public.customer_profiles;
create policy "Customers can update their own name"
  on public.customer_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.customer_profiles from anon, authenticated;
grant select on public.customer_profiles to authenticated;
grant update (full_name, updated_at) on public.customer_profiles to authenticated;
grant all on public.customer_profiles to service_role;

create table if not exists private.customer_identity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cpf_hash text not null unique check (cpf_hash ~ '^[0-9a-f]{64}$'),
  birth_date date not null,
  created_at timestamptz not null default now()
);
alter table private.customer_identity enable row level security;
revoke all on private.customer_identity from public, anon, authenticated;
grant all on private.customer_identity to service_role;

create table if not exists private.email_lookup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  cpf_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists email_lookup_attempts_ip_time_idx
  on private.email_lookup_attempts (ip_hash, created_at desc);
create index if not exists email_lookup_attempts_cpf_time_idx
  on private.email_lookup_attempts (cpf_hash, created_at desc);
alter table private.email_lookup_attempts enable row level security;
revoke all on private.email_lookup_attempts from public, anon, authenticated;
grant all on private.email_lookup_attempts to service_role;

create or replace function public.register_customer_profile(
  p_user_id uuid,
  p_full_name text,
  p_birth_date date,
  p_cpf_hash text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  if p_user_id is null
     or p_full_name is null
     or char_length(trim(p_full_name)) < 5
     or p_birth_date is null
     or p_cpf_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_PROFILE' using errcode = '22023';
  end if;

  insert into public.customer_profiles (user_id, full_name, birth_date)
  values (p_user_id, trim(p_full_name), p_birth_date)
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        birth_date = excluded.birth_date,
        updated_at = now();

  insert into private.customer_identity (user_id, cpf_hash, birth_date)
  values (p_user_id, p_cpf_hash, p_birth_date)
  on conflict (user_id) do update
    set cpf_hash = excluded.cpf_hash,
        birth_date = excluded.birth_date;
exception
  when unique_violation then
    raise exception 'CPF_IN_USE' using errcode = '23505';
end;
$$;

create or replace function public.lookup_customer_identity(
  p_cpf_hash text,
  p_birth_date date,
  p_ip_hash text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid;
  v_ip_count integer;
  v_cpf_count integer;
begin
  if p_cpf_hash !~ '^[0-9a-f]{64}$'
     or p_ip_hash !~ '^[0-9a-f]{64}$'
     or p_birth_date is null then
    return null;
  end if;

  delete from private.email_lookup_attempts
    where created_at < now() - interval '1 day';

  insert into private.email_lookup_attempts (ip_hash, cpf_hash)
    values (p_ip_hash, p_cpf_hash);

  select count(*) into v_ip_count
    from private.email_lookup_attempts
    where ip_hash = p_ip_hash and created_at > now() - interval '15 minutes';

  select count(*) into v_cpf_count
    from private.email_lookup_attempts
    where cpf_hash = p_cpf_hash and created_at > now() - interval '15 minutes';

  if v_ip_count > 10 or v_cpf_count > 3 then
    return null;
  end if;

  select user_id into v_user_id
    from private.customer_identity
    where cpf_hash = p_cpf_hash and birth_date = p_birth_date
    limit 1;

  return v_user_id;
end;
$$;

revoke all on function public.register_customer_profile(uuid, text, date, text) from public, anon, authenticated;
revoke all on function public.lookup_customer_identity(text, date, text) from public, anon, authenticated;
grant execute on function public.register_customer_profile(uuid, text, date, text) to service_role;
grant execute on function public.lookup_customer_identity(text, date, text) to service_role;

comment on table public.customer_profiles is 'Dados básicos do perfil Esquina Mix; acesso limitado ao próprio usuário via RLS.';
comment on table private.customer_identity is 'Índice privado de identidade; CPF armazenado somente como HMAC-SHA256.';
comment on function public.lookup_customer_identity(text, date, text) is 'Busca de e-mail com limitação por IP e CPF; execução exclusiva service_role.';
