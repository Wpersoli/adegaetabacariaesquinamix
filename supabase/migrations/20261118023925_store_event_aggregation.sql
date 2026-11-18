-- Esquina Mix: contadores diários agregados, sem dados de clientes.
create table if not exists private.store_event_daily (
  event_date date not null,
  event_name text not null check (event_name in ('page_view','search_used','category_selected','product_added','cart_opened','checkout_opened','whatsapp_handoff')),
  page text not null check (page in ('home','products')),
  category text not null default '' check (category in ('','todos','promo','bebidas','tabacos','headshop','narguile','outros')),
  product_id integer not null default 0 check (product_id between 0 and 10000),
  total_events bigint not null default 1 check (total_events > 0),
  updated_at timestamptz not null default now(),
  primary key (event_date,event_name,page,category,product_id)
);
alter table private.store_event_daily enable row level security;
revoke all on private.store_event_daily from public, anon, authenticated;
grant usage on schema private to service_role;
grant all on private.store_event_daily to service_role;
create index if not exists store_event_daily_date_idx on private.store_event_daily(event_date desc,event_name);
create or replace function public.record_store_event(p_event_name text,p_page text,p_category text default '',p_product_id integer default 0)
returns void language plpgsql security invoker set search_path = pg_catalog, private as $$
declare
  v_date date := (now() at time zone 'America/Sao_Paulo')::date;
  v_category text := coalesce(p_category,'');
  v_product_id integer := coalesce(p_product_id,0);
begin
  if p_event_name not in ('page_view','search_used','category_selected','product_added','cart_opened','checkout_opened','whatsapp_handoff') then raise exception 'INVALID_EVENT_NAME' using errcode='22023'; end if;
  if p_page not in ('home','products') then raise exception 'INVALID_PAGE' using errcode='22023'; end if;
  if v_category not in ('','todos','promo','bebidas','tabacos','headshop','narguile','outros') then raise exception 'INVALID_CATEGORY' using errcode='22023'; end if;
  if v_product_id < 0 or v_product_id > 10000 then raise exception 'INVALID_PRODUCT_ID' using errcode='22023'; end if;
  if p_event_name='product_added' and v_product_id=0 then raise exception 'PRODUCT_REQUIRED' using errcode='22023'; end if;
  insert into private.store_event_daily(event_date,event_name,page,category,product_id,total_events,updated_at)
  values(v_date,p_event_name,p_page,v_category,v_product_id,1,now())
  on conflict(event_date,event_name,page,category,product_id)
  do update set total_events=private.store_event_daily.total_events+1,updated_at=now();
end; $$;
revoke all on function public.record_store_event(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.record_store_event(text,text,text,integer) to service_role;
comment on table private.store_event_daily is 'Contadores agregados diários de navegação. Não contém identificadores nem dados pessoais.';