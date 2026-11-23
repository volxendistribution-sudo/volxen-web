-- ============================================================
-- FASE 3 — Precio del gestor al compartir (aditivo y reversible)
-- No toca funciones existentes. Solo tablas y funciones NUEVAS.
-- ============================================================

-- 1) Tope configurable global (admin). Una sola fila (id = true).
create table if not exists public.gestor_precio_config (
  id boolean not null default true primary key check (id = true),
  margen_max_porcentaje numeric(5,2) not null default 20
    check (margen_max_porcentaje >= 0 and margen_max_porcentaje <= 100),
  updated_at timestamptz not null default now()
);

alter table public.gestor_precio_config enable row level security;

drop policy if exists gestor_precio_config_select on public.gestor_precio_config;
create policy gestor_precio_config_select
on public.gestor_precio_config
for select
to authenticated
using (public.vx_is_admin() or public.vx_is_gestor() or public.vx_is_promotor());

drop policy if exists gestor_precio_config_admin_all on public.gestor_precio_config;
create policy gestor_precio_config_admin_all
on public.gestor_precio_config
for all
to authenticated
using (public.vx_is_admin())
with check (public.vx_is_admin());

insert into public.gestor_precio_config (id, margen_max_porcentaje)
values (true, 20)
on conflict (id) do nothing;

-- 2) Permiso de precio por gestor (lo activa el administrador).
create table if not exists public.gestor_permiso_precio (
  gestor_id uuid not null primary key references auth.users(id) on delete cascade,
  permiso_precio boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.gestor_permiso_precio enable row level security;

drop policy if exists gestor_permiso_precio_select_self on public.gestor_permiso_precio;
create policy gestor_permiso_precio_select_self
on public.gestor_permiso_precio
for select
to authenticated
using (gestor_id = auth.uid() and (public.vx_is_gestor() or public.vx_is_promotor()));

drop policy if exists gestor_permiso_precio_admin_all on public.gestor_permiso_precio;
create policy gestor_permiso_precio_admin_all
on public.gestor_permiso_precio
for all
to authenticated
using (public.vx_is_admin())
with check (public.vx_is_admin());

-- 3) Precio guardado por gestor y producto.
create table if not exists public.gestor_precio_guardado (
  gestor_id uuid not null references auth.users(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  precio_usd numeric(12,2) check (precio_usd is null or precio_usd >= 0),
  updated_at timestamptz not null default now(),
  primary key (gestor_id, producto_id)
);

alter table public.gestor_precio_guardado enable row level security;

drop policy if exists gestor_precio_guardado_select_self on public.gestor_precio_guardado;
create policy gestor_precio_guardado_select_self
on public.gestor_precio_guardado
for select
to authenticated
using (gestor_id = auth.uid() and (public.vx_is_gestor() or public.vx_is_promotor()));

drop policy if exists gestor_precio_guardado_admin_all on public.gestor_precio_guardado;
create policy gestor_precio_guardado_admin_all
on public.gestor_precio_guardado
for all
to authenticated
using (public.vx_is_admin())
with check (public.vx_is_admin());

-- ============================================================
-- Funciones NUEVAS (security definer). El servidor valida.
-- ============================================================

-- Leer precio aplicable para un producto (usa el gestor autenticado).
create or replace function public.gestor_precio_leer(p_producto_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_producto public.productos%rowtype;
  v_oferta numeric;
  v_base numeric;
  v_margen numeric;
  v_precio_max numeric;
  v_permiso boolean := false;
  v_guardado numeric;
  v_valido boolean := false;
  v_motivo text;
begin
  if v_uid is null or not (public.vx_is_gestor() or public.vx_is_promotor()) then
    raise exception 'No autorizado';
  end if;

  select *
  into v_producto
  from public.productos
  where id = p_producto_id
    and activo is true
    and lower(btrim(disponibilidad)) = 'disponible';

  if not found then
    raise exception 'El producto no está disponible actualmente';
  end if;

  -- Precio base = oferta vigente o precio de tienda (misma lógica que crear_pedido_gestor).
  select o.precio_oferta_usd
  into v_oferta
  from public.ofertas as o
  where o.producto_id = p_producto_id
    and o.activa is true
    and (o.fecha_inicio is null or o.fecha_inicio <= now())
    and (o.fecha_fin is null or o.fecha_fin >= now())
  order by o.created_at desc
  limit 1;

  v_base := round(coalesce(v_oferta, v_producto.precio_usd), 2);

  if v_base is null or v_base < 0 then
    raise exception 'El precio del producto no es válido';
  end if;

  -- Tope: configurable por admin, default 20 %.
  select coalesce(c.margen_max_porcentaje, 20)
  into v_margen
  from public.gestor_precio_config as c
  where c.id = true;

  v_precio_max := round(v_base * (1 + greatest(0, least(v_margen, 100)) / 100.0), 2);

  -- Permiso del gestor.
  select coalesce(p.permiso_precio, false)
  into v_permiso
  from public.gestor_permiso_precio as p
  where p.gestor_id = v_uid;

  -- Precio guardado por gestor y producto.
  select g.precio_usd
  into v_guardado
  from public.gestor_precio_guardado as g
  where g.gestor_id = v_uid
    and g.producto_id = p_producto_id;

  if v_permiso and v_guardado is not null then
    if v_guardado < v_base or v_guardado > v_precio_max then
      v_valido := false;
      v_motivo := 'El precio guardado dejó de ser válido (cambió el base, la oferta o el tope).';
    else
      v_valido := true;
    end if;
  end if;

  return jsonb_build_object(
    'permiso', v_permiso,
    'precio_guardado', v_guardado,
    'precio_base', v_base,
    'precio_maximo', v_precio_max,
    'precio_venta_utilizable', case when v_valido then v_guardado else v_base end,
    'valido', v_valido,
    'motivo', v_motivo
  );
end;
$$;

-- Guardar (o borrar para volver al base) el precio del gestor en un producto.
create or replace function public.gestor_precio_guardar(p_producto_id uuid, p_precio_usd numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_producto public.productos%rowtype;
  v_oferta numeric;
  v_base numeric;
  v_margen numeric;
  v_precio_max numeric;
  v_permiso boolean := false;
begin
  if v_uid is null or not (public.vx_is_gestor() or public.vx_is_promotor()) then
    raise exception 'No autorizado';
  end if;

  select coalesce(p.permiso_precio, false)
  into v_permiso
  from public.gestor_permiso_precio as p
  where p.gestor_id = v_uid;

  if not v_permiso then
    raise exception 'No tiene permiso para fijar precio de este producto.';
  end if;

  select *
  into v_producto
  from public.productos
  where id = p_producto_id
    and activo is true
    and lower(btrim(disponibilidad)) = 'disponible';

  if not found then
    raise exception 'El producto no está disponible actualmente';
  end if;

  select o.precio_oferta_usd
  into v_oferta
  from public.ofertas as o
  where o.producto_id = p_producto_id
    and o.activa is true
    and (o.fecha_inicio is null or o.fecha_inicio <= now())
    and (o.fecha_fin is null or o.fecha_fin >= now())
  order by o.created_at desc
  limit 1;

  v_base := round(coalesce(v_oferta, v_producto.precio_usd), 2);

  select coalesce(c.margen_max_porcentaje, 20)
  into v_margen
  from public.gestor_precio_config as c
  where c.id = true;

  v_precio_max := round(v_base * (1 + greatest(0, least(v_margen, 100)) / 100.0), 2);

  if p_precio_usd is null then
    -- Volver al precio base.
    delete from public.gestor_precio_guardado
    where gestor_id = v_uid and producto_id = p_producto_id;

    return jsonb_build_object(
      'guardado', null,
      'precio_venta', v_base,
      'precio_base', v_base
    );
  end if;

  if p_precio_usd < v_base then
    raise exception 'El precio no puede ser inferior al precio VOLXEN vigente (' || to_char(v_base, 'FM999999990.00') || ' USD).';
  end if;

  if p_precio_usd > v_precio_max then
    raise exception 'El precio supera el máximo permitido para este producto (' || to_char(v_precio_max, 'FM999999990.00') || ' USD).';
  end if;

  insert into public.gestor_precio_guardado (gestor_id, producto_id, precio_usd, updated_at)
  values (v_uid, p_producto_id, round(p_precio_usd, 2), now())
  on conflict (gestor_id, producto_id) do update
  set precio_usd = excluded.precio_usd,
      updated_at = now();

  return jsonb_build_object(
    'guardado', round(p_precio_usd, 2),
    'precio_venta', round(p_precio_usd, 2),
    'precio_base', v_base
  );
end;
$$;

-- Admin: activa/desactiva permiso y ajusta tope global.
create or replace function public.gestor_admin_configurar_precio(
  p_user_id uuid,
  p_permiso boolean,
  p_margen_max_porcentaje numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
begin
  if auth.uid() is null or not public.vx_is_admin() then
    raise exception 'No autorizado';
  end if;

  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'El usuario no existe';
  end if;

  select r.role
  into v_rol
  from public.user_roles as r
  where r.user_id = p_user_id
    and r.is_active;

  if v_rol is null or v_rol not in ('gestor', 'promotor') then
    raise exception 'El usuario no tiene rol de gestor o promotor';
  end if;

  if p_margen_max_porcentaje is not null then
    if p_margen_max_porcentaje < 0 or p_margen_max_porcentaje > 100 then
      raise exception 'El margen máximo debe estar entre 0 y 100';
    end if;

    insert into public.gestor_precio_config (id, margen_max_porcentaje, updated_at)
    values (true, p_margen_max_porcentaje, now())
    on conflict (id) do update
    set margen_max_porcentaje = excluded.margen_max_porcentaje,
        updated_at = now();
  end if;

  insert into public.gestor_permiso_precio (gestor_id, permiso_precio, updated_at)
  values (p_user_id, p_permiso, now())
  on conflict (gestor_id) do update
  set permiso_precio = excluded.permiso_precio,
      updated_at = now();

  return jsonb_build_object(
    'user_id', p_user_id,
    'permiso_precio', p_permiso,
    'margen_max_porcentaje', coalesce(
      (select margen_max_porcentaje from public.gestor_precio_config where id = true), 20
    )
  );
end;
$$;

revoke all on function public.gestor_precio_leer(uuid) from public, anon;
revoke all on function public.gestor_precio_guardar(uuid, numeric) from public, anon;
revoke all on function public.gestor_admin_configurar_precio(uuid, boolean, numeric) from public, anon;

grant execute on function public.gestor_precio_leer(uuid) to authenticated;
grant execute on function public.gestor_precio_guardar(uuid, numeric) to authenticated;
grant execute on function public.gestor_admin_configurar_precio(uuid, boolean, numeric) to authenticated;

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'gestor_precio_config'
  ) then
    raise exception 'Falta la tabla public.gestor_precio_config';
  end if;
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'gestor_permiso_precio'
  ) then
    raise exception 'Falta la tabla public.gestor_permiso_precio';
  end if;
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'gestor_precio_guardado'
  ) then
    raise exception 'Falta la tabla public.gestor_precio_guardado';
  end if;
end;
$$;

notify pgrst, 'reload schema';
