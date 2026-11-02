-- Fase 2 · Ampliación 4
-- Seguimiento detallado + certificado de garantía con QR.
-- La garantía solo se activa cuando el pedido pasa a Entregado.

begin;

alter table public.pedidos
  add column if not exists garantia_activa boolean not null default false;

create table if not exists public.pedido_garantias (
  pedido_id uuid primary key references public.pedidos(id) on delete cascade,
  token text not null,
  activo boolean not null default true,
  activado_at timestamptz not null default now(),
  revocado_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pedido_garantias_token_key unique (token),
  constraint pedido_garantias_token_largo_check check (char_length(token) >= 64)
);

alter table public.pedido_garantias enable row level security;

drop policy if exists pedido_garantias_admin_ver on public.pedido_garantias;
create policy pedido_garantias_admin_ver
on public.pedido_garantias
for select
to authenticated
using (public.vx_is_admin());

drop policy if exists pedido_garantias_gestor_ver on public.pedido_garantias;
create policy pedido_garantias_gestor_ver
on public.pedido_garantias
for select
to authenticated
using (
  exists (
    select 1
    from public.pedidos p
    where p.id = pedido_garantias.pedido_id
      and p.promotor_id = auth.uid()
      and (public.vx_is_gestor() or public.vx_is_promotor())
  )
);

revoke all on table public.pedido_garantias from public, anon, authenticated;
grant select on table public.pedido_garantias to authenticated;

create or replace function public.vx_sync_garantia_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_crear boolean := false;
begin
  if tg_op = 'INSERT' then
    v_crear := new.estado = 'Entregado';
  else
    v_crear := new.estado = 'Entregado'
      and old.estado is distinct from 'Entregado';
  end if;

  if v_crear then
    insert into public.pedido_garantias (
      pedido_id,
      token,
      activo,
      activado_at,
      revocado_at
    )
    values (
      new.id,
      encode(extensions.gen_random_bytes(32), 'hex'),
      true,
      now(),
      null
    )
    on conflict (pedido_id) do update
      set token = excluded.token,
          activo = true,
          activado_at = now(),
          revocado_at = null;
  end if;

  if new.estado = 'Entregado' then
    update public.pedidos
       set garantia_activa = true
     where id = new.id
       and garantia_activa is distinct from true;
  else
    if tg_op = 'UPDATE' and old.estado = 'Entregado' then
      update public.pedido_garantias
         set activo = false,
             revocado_at = now()
       where pedido_id = new.id
         and activo = true;
    end if;

    update public.pedidos
       set garantia_activa = false
     where id = new.id
       and garantia_activa is distinct from false;
  end if;

  return new;
end;
$$;

revoke all on function public.vx_sync_garantia_pedido() from public, anon, authenticated;

drop trigger if exists pedidos_sync_garantia on public.pedidos;
create trigger pedidos_sync_garantia
after insert or update of estado on public.pedidos
for each row execute function public.vx_sync_garantia_pedido();

-- Pedidos ya entregados antes de esta ampliación.
insert into public.pedido_garantias (
  pedido_id,
  token,
  activo,
  activado_at,
  revocado_at
)
select
  p.id,
  encode(extensions.gen_random_bytes(32), 'hex'),
  true,
  coalesce(
    (
      select max(ph.created_at)
      from public.pedido_historial ph
      where ph.pedido_id = p.id
        and ph.estado = 'Entregado'
    ),
    p.updated_at,
    now()
  ),
  null
from public.pedidos p
where p.estado = 'Entregado'
on conflict (pedido_id) do update
  set activo = true,
      revocado_at = null;

update public.pedidos
   set garantia_activa = true
 where estado = 'Entregado'
   and garantia_activa is distinct from true;

create or replace function public.consultar_garantia(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido_id uuid;
  v_codigo text;
  v_estado text;
  v_created_at timestamptz;
  v_total numeric;
  v_garantia text;
  v_gestor text;
  v_activado_at timestamptz;
  v_entregado_at timestamptz;
  v_items jsonb;
begin
  if p_token is null or length(btrim(p_token)) < 64 then
    raise exception 'Certificado no válido';
  end if;

  select
    p.id,
    p.codigo,
    p.estado,
    p.created_at,
    p.total_usd,
    p.garantia,
    p.gestor_nombre,
    g.activado_at
  into
    v_pedido_id,
    v_codigo,
    v_estado,
    v_created_at,
    v_total,
    v_garantia,
    v_gestor,
    v_activado_at
  from public.pedidos p
  join public.pedido_garantias g on g.pedido_id = p.id
  where g.token = btrim(p_token)
    and g.activo = true
    and p.estado = 'Entregado';

  if not found then
    raise exception 'Certificado no válido o inactivo';
  end if;

  select ph.created_at
  into v_entregado_at
  from public.pedido_historial ph
  where ph.pedido_id = v_pedido_id
    and ph.estado = 'Entregado'
  order by ph.created_at desc
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'producto_nombre', pi.producto_nombre,
        'cantidad', pi.cantidad,
        'garantia', nullif(btrim(pi.garantia), '')
      )
      order by pi.created_at
    ),
    '[]'::jsonb
  )
  into v_items
  from public.pedido_items pi
  where pi.pedido_id = v_pedido_id;

  return jsonb_build_object(
    'codigo', v_codigo,
    'estado', v_estado,
    'fecha_pedido', v_created_at,
    'fecha_entrega', v_entregado_at,
    'total_usd', v_total,
    'garantia', nullif(btrim(v_garantia), ''),
    'comercial', coalesce(nullif(btrim(v_gestor), ''), 'VOLXEN'),
    'productos', v_items
  );
end;
$$;

create or replace function public.promotor_garantia_pedido(p_pedido_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_activado_at timestamptz;
begin
  if v_uid is null or not (public.vx_is_gestor() or public.vx_is_promotor()) then
    raise exception 'No autorizado';
  end if;

  if not exists (
    select 1
    from public.pedidos p
    where p.id = p_pedido_id
      and p.promotor_id = v_uid
  ) then
    raise exception 'No autorizado';
  end if;

  select g.token, g.activado_at
  into v_token, v_activado_at
  from public.pedidos p
  join public.pedido_garantias g on g.pedido_id = p.id
  where p.id = p_pedido_id
    and p.promotor_id = v_uid
    and p.estado = 'Entregado'
    and g.activo = true;

  if v_token is null then
    return jsonb_build_object('activo', false);
  end if;

  return jsonb_build_object(
    'activo', true,
    'token', v_token,
    'activado_at', v_activado_at
  );
end;
$$;

create or replace function public.promotor_pedido_historial(p_pedido_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not (public.vx_is_gestor() or public.vx_is_promotor()) then
    raise exception 'No autorizado';
  end if;

  if not exists (
    select 1
    from public.pedidos p
    where p.id = p_pedido_id
      and p.promotor_id = v_uid
  ) then
    raise exception 'No autorizado';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'estado', ph.estado,
          'comentario', ph.comentario,
          'created_at', ph.created_at
        )
        order by ph.created_at
      )
      from public.pedido_historial ph
      where ph.pedido_id = p_pedido_id
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.mi_garantia(p_pedido_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_activado_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not exists (
    select 1
    from public.pedidos p
    where p.id = p_pedido_id
      and p.user_id = v_uid
  ) then
    raise exception 'No autorizado';
  end if;

  select g.token, g.activado_at
  into v_token, v_activado_at
  from public.pedidos p
  join public.pedido_garantias g on g.pedido_id = p.id
  where p.id = p_pedido_id
    and p.user_id = v_uid
    and p.estado = 'Entregado'
    and g.activo = true;

  if v_token is null then
    return jsonb_build_object('activo', false);
  end if;

  return jsonb_build_object(
    'activo', true,
    'token', v_token,
    'activado_at', v_activado_at
  );
end;
$$;

revoke all on function public.consultar_garantia(text) from public, anon, authenticated;
grant execute on function public.consultar_garantia(text) to anon, authenticated;

revoke all on function public.promotor_garantia_pedido(uuid) from public, anon, authenticated;
grant execute on function public.promotor_garantia_pedido(uuid) to authenticated;

revoke all on function public.promotor_pedido_historial(uuid) from public, anon, authenticated;
grant execute on function public.promotor_pedido_historial(uuid) to authenticated;

revoke all on function public.mi_garantia(uuid) from public, anon, authenticated;
grant execute on function public.mi_garantia(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pedidos'
      and column_name = 'garantia_activa'
  ) then
    raise exception 'Falta pedidos.garantia_activa';
  end if;

  if to_regclass('public.pedido_garantias') is null then
    raise exception 'Falta public.pedido_garantias';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.pedidos'::regclass
      and tgname = 'pedidos_sync_garantia'
      and not tgisinternal
  ) then
    raise exception 'Falta el trigger pedidos_sync_garantia';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'consultar_garantia'
  ) then
    raise exception 'Falta consultar_garantia';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
