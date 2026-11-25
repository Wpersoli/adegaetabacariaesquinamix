-- ARCHIVED LEGACY MIGRATION: not part of the production migration history.
-- Preserved for audit/reference only. Do not move back into supabase/migrations
-- or apply to the active Supabase project.

-- Esquina Mix: pedidos enviados pela sacola por clientes logados (historico + andamento).
-- A gravacao e a leitura passam pela API do site (service_role). O cliente so le os proprios pedidos.
create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null check (char_length(code) between 1 and 24),
  status text not null default 'recebido'
    check (status in ('recebido','em_preparo','pronto','entregue','cancelado')),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  total numeric(10,2) not null check (total > 0),
  payment text not null check (payment in ('Pix','Débito','Crédito','Dinheiro')),
  change_for numeric(10,2) check (change_for is null or change_for > 0),
  customer_name text,
  customer_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_orders_user_created_idx
  on public.customer_orders (user_id, created_at desc);
create index if not exists customer_orders_open_idx
  on public.customer_orders (created_at desc)
  where status in ('recebido','em_preparo','pronto');

create or replace function public.customer_orders_touch()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customer_orders_touch on public.customer_orders;
create trigger customer_orders_touch
  before update on public.customer_orders
  for each row execute function public.customer_orders_touch();

alter table public.customer_orders enable row level security;

drop policy if exists "Customers can read their own orders" on public.customer_orders;
create policy "Customers can read their own orders"
  on public.customer_orders for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.customer_orders from anon, authenticated;
grant select on public.customer_orders to authenticated;
grant all on public.customer_orders to service_role;

comment on table public.customer_orders is
  'Pedidos feitos pela sacola por clientes logados. O status e atualizado pela loja (API PATCH /api/orders ou Table Editor).';
