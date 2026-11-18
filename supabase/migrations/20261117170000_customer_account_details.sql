-- Dados editáveis da conta e endereço padrão de entrega.
alter table public.customer_profiles
  add column if not exists delivery_address text;
alter table public.customer_profiles
  drop constraint if exists customer_profiles_delivery_address_length;
alter table public.customer_profiles
  add constraint customer_profiles_delivery_address_length
  check (delivery_address is null or char_length(delivery_address) <= 500);

-- Atualização atômica: mantém a data de nascimento sincronizada no perfil e no índice privado.
create or replace function public.update_customer_profile(
  p_user_id uuid, p_full_name text, p_birth_date date,
  p_phone_e164 text, p_delivery_address text
) returns void
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  if p_user_id is null or p_full_name is null or char_length(trim(p_full_name)) < 5
     or p_birth_date is null
     or p_phone_e164 is null
     or p_phone_e164 !~ '^\+55[1-9][0-9][2-9][0-9]{7,8}$'
     or char_length(coalesce(p_delivery_address,'')) > 500 then
    raise exception 'INVALID_PROFILE' using errcode='22023';
  end if;
  update public.customer_profiles
    set full_name=trim(p_full_name), birth_date=p_birth_date,
        phone_verified_at=case when phone_e164 is distinct from p_phone_e164 then null else phone_verified_at end,
        phone_e164=p_phone_e164, delivery_address=nullif(trim(coalesce(p_delivery_address,'')),''),
        updated_at=now()
    where user_id=p_user_id;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode='P0002'; end if;
  update private.customer_identity set birth_date=p_birth_date where user_id=p_user_id;
end;
$$;
revoke all on function public.update_customer_profile(uuid,text,date,text,text) from public, anon, authenticated;
grant execute on function public.update_customer_profile(uuid,text,date,text,text) to service_role;
