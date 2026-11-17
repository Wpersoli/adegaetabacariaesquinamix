-- Esquina Mix: edição segura dos dados do próprio perfil.
-- A API valida a sessão Supabase e chama esta RPC somente com service_role.
-- Atualiza a data de nascimento nos dois locais usados pela recuperação de identidade.
create or replace function public.update_customer_profile(
  p_user_id uuid,
  p_full_name text,
  p_birth_date date,
  p_phone_e164 text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if p_user_id is null
     or p_full_name is null
     or char_length(trim(p_full_name)) < 5
     or char_length(trim(p_full_name)) > 120
     or p_birth_date is null
     or p_phone_e164 is null
     or p_phone_e164 !~ '^\+55[1-9][0-9][2-9][0-9]{7,8}$' then
    raise exception 'INVALID_PROFILE' using errcode = '22023';
  end if;

  update public.customer_profiles
     set full_name = trim(p_full_name),
         birth_date = p_birth_date,
         phone_e164 = p_phone_e164,
         phone_verified_at = case
           when phone_e164 is distinct from p_phone_e164 then null
           else phone_verified_at
         end,
         updated_at = now()
   where user_id = p_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  update private.customer_identity
     set birth_date = p_birth_date
   where user_id = p_user_id;

  if not found then
    raise exception 'IDENTITY_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_customer_profile(uuid, text, date, text) from public, anon, authenticated;
grant execute on function public.update_customer_profile(uuid, text, date, text) to service_role;

comment on function public.update_customer_profile(uuid, text, date, text) is
  'Atualiza nome, nascimento e telefone do perfil e sincroniza a data de nascimento do índice privado de identidade.';
