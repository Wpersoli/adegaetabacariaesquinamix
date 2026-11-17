-- Esquina Mix: required customer contact phone (collected, not verified).
-- Existing profiles remain readable; accounts without a phone must complete the profile at next sign-in.
alter table public.customer_profiles
  add column if not exists phone_e164 text,
  add column if not exists phone_verified_at timestamptz;

alter table public.customer_profiles
  drop constraint if exists customer_profiles_phone_e164_format;

alter table public.customer_profiles
  add constraint customer_profiles_phone_e164_format
  check (
    phone_e164 is null
    or phone_e164 ~ '^\+55[1-9][0-9][2-9][0-9]{7,8}$'
  );

-- Remove the previous RPC signature so no server path can create a new profile without a phone.
drop function if exists public.register_customer_profile(uuid, text, date, text);

create function public.register_customer_profile(
  p_user_id uuid,
  p_full_name text,
  p_birth_date date,
  p_cpf_hash text,
  p_phone_e164 text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_existing_hash text;
begin
  if p_user_id is null
     or p_full_name is null
     or char_length(trim(p_full_name)) < 5
     or p_birth_date is null
     or p_cpf_hash is null
     or p_cpf_hash !~ '^[0-9a-f]{64}$'
     or p_phone_e164 is null
     or p_phone_e164 !~ '^\+55[1-9][0-9][2-9][0-9]{7,8}$' then
    raise exception 'INVALID_PROFILE' using errcode = '22023';
  end if;

  select cpf_hash into v_existing_hash
    from private.customer_identity
    where user_id = p_user_id
    for update;

  if v_existing_hash is not null and v_existing_hash <> p_cpf_hash then
    raise exception 'CPF_ALREADY_REGISTERED' using errcode = '23505';
  end if;

  insert into public.customer_profiles (user_id, full_name, birth_date, consent_at, phone_e164, phone_verified_at)
  values (p_user_id, trim(p_full_name), p_birth_date, now(), p_phone_e164, null)
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        phone_verified_at = case
          when public.customer_profiles.phone_e164 is distinct from excluded.phone_e164 then null
          else public.customer_profiles.phone_verified_at
        end,
        phone_e164 = excluded.phone_e164,
        updated_at = now();

  if v_existing_hash is null then
    insert into private.customer_identity (user_id, cpf_hash, birth_date)
    values (p_user_id, p_cpf_hash, p_birth_date);
  end if;
exception
  when unique_violation then
    raise exception 'CPF_IN_USE' using errcode = '23505';
end;
$$;

revoke all on function public.register_customer_profile(uuid, text, date, text, text) from public, anon, authenticated;
grant execute on function public.register_customer_profile(uuid, text, date, text, text) to service_role;

comment on column public.customer_profiles.phone_e164 is
  'Telefone de contato informado pelo cliente em formato E.164; não significa que o número foi verificado.';
comment on column public.customer_profiles.phone_verified_at is
  'Data de validação efetiva do telefone; permanece NULL enquanto não houver método de verificação ativo.';
comment on function public.register_customer_profile(uuid, text, date, text, text) is
  'Registra perfil e telefone obrigatório. O telefone é armazenado como contato, sem marcar verificação.';
