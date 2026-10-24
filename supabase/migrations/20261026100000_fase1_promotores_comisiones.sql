create table if not exists public.promotores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  comision_porcentaje numeric(5,2) not null default 0
    check (comision_porcentaje >= 0 and comision_porcentaje <= 100),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.promotores enable row level security;

drop policy if exists promotores_select_self on public.promotores;
create policy promotores_select_self
on public.promotores
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists promotores_admin_all on public.promotores;
create policy promotores_admin_all
on public.promotores
for all
to authenticated
using (public.vx_is_admin())
with check (public.vx_is_admin());

alter table public.pedidos
  add column if not exists promotor_id uuid references auth.users(id) on delete set null,
  add column if not exists comision_porcentaje numeric(5,2)
    check (comision_porcentaje is null or (comision_porcentaje >= 0 and comision_porcentaje <= 100)),
  add column if not exists comision_monto_usd numeric(12,2)
    check (comision_monto_usd is null or comision_monto_usd >= 0),
  add column if not exists comision_estado text not null default 'pendiente'
    check (comision_estado in ('pendiente', 'disponible', 'pagada', 'cancelada')),
  add column if not exists comision_disponible_at timestamptz,
  add column if not exists comision_pagada_at timestamptz,
  add column if not exists comision_pagada_por uuid references auth.users(id) on delete set null;

create index if not exists pedidos_promotor_id_idx
  on public.pedidos (promotor_id);

create index if not exists pedidos_comision_estado_idx
  on public.pedidos (comision_estado)
  where promotor_id is not null;

drop policy if exists pedidos_promotor_ver_atribuidos on public.pedidos;
create policy pedidos_promotor_ver_atribuidos
on public.pedidos
for select
to authenticated
using (
  (public.vx_is_gestor() or public.vx_is_promotor())
  and promotor_id = auth.uid()
);

drop policy if exists pedido_items_promotor_ver_atribuidos on public.pedido_items;
create policy pedido_items_promotor_ver_atribuidos
on public.pedido_items
for select
to authenticated
using (
  exists (
    select 1
    from public.pedidos p
    where p.id = pedido_items.pedido_id
      and p.promotor_id = auth.uid()
      and (public.vx_is_gestor() or public.vx_is_promotor())
  )
);

drop policy if exists pedido_historial_promotor_ver_atribuidos on public.pedido_historial;
create policy pedido_historial_promotor_ver_atribuidos
on public.pedido_historial
for select
to authenticated
using (
  exists (
    select 1
    from public.pedidos p
    where p.id = pedido_historial.pedido_id
      and p.promotor_id = auth.uid()
      and (public.vx_is_gestor() or public.vx_is_promotor())
  )
);

create or replace function public.vx_sync_comision_pedido()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.promotor_id is null then
    new.comision_porcentaje := null;
    new.comision_monto_usd := null;
    new.comision_estado := 'pendiente';
    new.comision_disponible_at := null;
    new.comision_pagada_at := null;
    new.comision_pagada_por := null;
    return new;
  end if;

  if new.comision_estado = 'pagada' then
    return new;
  end if;

  if new.estado = 'Cancelado' then
    new.comision_estado := 'cancelada';
    new.comision_disponible_at := null;
  elsif new.estado = 'Entregado' then
    if new.comision_estado in ('pendiente', 'cancelada') then
      new.comision_monto_usd := coalesce(
        new.comision_monto_usd,
        round(new.total_usd * coalesce(new.comision_porcentaje, 0) / 100, 2)
      );
      new.comision_estado := 'disponible';
      new.comision_disponible_at := coalesce(new.comision_disponible_at, now());
    end if;
  elsif new.comision_estado = 'disponible' then
    new.comision_estado := 'pendiente';
    new.comision_disponible_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists pedidos_sync_comision on public.pedidos;
create trigger pedidos_sync_comision
before update of estado, promotor_id, comision_estado, total_usd, comision_porcentaje, comision_monto_usd
on public.pedidos
for each row execute function public.vx_sync_comision_pedido();

create or replace function public.admin_asignar_promotor(
  p_pedido_id uuid,
  p_promotor_id uuid,
  p_comision_porcentaje numeric default null,
  p_comision_monto_usd numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_rol text;
  v_porcentaje numeric;
  v_monto numeric;
  v_estado text;
begin
  if auth.uid() is null or not public.vx_is_admin() then
    raise exception 'No autorizado';
  end if;

  if p_pedido_id is null then
    raise exception 'El pedido es obligatorio';
  end if;

  select *
  into v_pedido
  from public.pedidos
  where id = p_pedido_id
  for update;

  if v_pedido.id is null then
    raise exception 'El pedido no existe';
  end if;

  if v_pedido.comision_estado = 'pagada' then
    raise exception 'La comisión de este pedido ya fue pagada';
  end if;

  if p_promotor_id is null then
    update public.pedidos
       set promotor_id = null,
           comision_porcentaje = null,
           comision_monto_usd = null,
           comision_estado = 'pendiente',
           comision_disponible_at = null,
           comision_pagada_at = null,
           comision_pagada_por = null
     where id = p_pedido_id;

    return jsonb_build_object(
      'pedido_id', p_pedido_id,
      'promotor_id', null,
      'comision_estado', 'pendiente',
      'comision_monto_usd', null
    );
  end if;

  select r.role
  into v_rol
  from public.user_roles r
  where r.user_id = p_promotor_id
    and r.is_active;

  if v_rol is null or v_rol not in ('gestor', 'promotor') then
    raise exception 'El usuario no tiene rol de gestor o promotor';
  end if;

  select p.comision_porcentaje
  into v_porcentaje
  from public.promotores p
  where p.user_id = p_promotor_id;

  v_porcentaje := coalesce(p_comision_porcentaje, v_porcentaje, 0);

  if v_porcentaje < 0 or v_porcentaje > 100 then
    raise exception 'El porcentaje de comisión debe estar entre 0 y 100';
  end if;

  v_monto := coalesce(
    p_comision_monto_usd,
    round(v_pedido.total_usd * v_porcentaje / 100, 2)
  );

  if v_monto < 0 then
    raise exception 'El monto de la comisión no puede ser negativo';
  end if;

  v_estado := case
    when v_pedido.estado = 'Cancelado' then 'cancelada'
    when v_pedido.estado = 'Entregado' then 'disponible'
    else 'pendiente'
  end;

  update public.pedidos
     set promotor_id = p_promotor_id,
         comision_porcentaje = v_porcentaje,
         comision_monto_usd = v_monto,
         comision_estado = v_estado,
         comision_disponible_at = case when v_estado = 'disponible' then now() else null end,
         comision_pagada_at = null,
         comision_pagada_por = null
   where id = p_pedido_id;

  return jsonb_build_object(
    'pedido_id', p_pedido_id,
    'promotor_id', p_promotor_id,
    'comision_porcentaje', v_porcentaje,
    'comision_monto_usd', v_monto,
    'comision_estado', v_estado
  );
end;
$$;

create or replace function public.admin_marcar_comision_pagada(p_pedido_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido public.pedidos%rowtype;
begin
  if auth.uid() is null or not public.vx_is_admin() then
    raise exception 'No autorizado';
  end if;

  update public.pedidos
     set comision_estado = 'pagada',
         comision_pagada_at = now(),
         comision_pagada_por = auth.uid()
   where id = p_pedido_id
     and promotor_id is not null
     and comision_estado = 'disponible'
  returning * into v_pedido;

  if v_pedido.id is null then
    raise exception 'La comisión no está disponible para pago';
  end if;

  return jsonb_build_object(
    'pedido_id', v_pedido.id,
    'comision_estado', v_pedido.comision_estado,
    'comision_monto_usd', v_pedido.comision_monto_usd,
    'comision_pagada_at', v_pedido.comision_pagada_at
  );
end;
$$;

create or replace function public.admin_guardar_promotor(
  p_user_id uuid,
  p_rol text,
  p_comision_porcentaje numeric default null,
  p_activo boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rol text := lower(trim(coalesce(p_rol, '')));
  v_porcentaje numeric := coalesce(p_comision_porcentaje, 0);
begin
  if auth.uid() is null or not public.vx_is_admin() then
    raise exception 'No autorizado';
  end if;

  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'El usuario no existe';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol';
  end if;

  if v_rol not in ('gestor', 'promotor', 'cliente') then
    raise exception 'Rol no válido';
  end if;

  if v_rol = 'cliente' then
    delete from public.promotores where user_id = p_user_id;
    perform public.vx_revoke_role(p_user_id);
    return jsonb_build_object('user_id', p_user_id, 'role', 'cliente', 'activo', false);
  end if;

  if v_porcentaje < 0 or v_porcentaje > 100 then
    raise exception 'El porcentaje de comisión debe estar entre 0 y 100';
  end if;

  perform public.vx_set_role(p_user_id, v_rol);

  insert into public.promotores (user_id, comision_porcentaje, activo, updated_at)
  values (p_user_id, v_porcentaje, coalesce(p_activo, true), now())
  on conflict (user_id) do update
  set comision_porcentaje = excluded.comision_porcentaje,
      activo = excluded.activo,
      updated_at = now();

  return jsonb_build_object(
    'user_id', p_user_id,
    'role', v_rol,
    'comision_porcentaje', v_porcentaje,
    'activo', coalesce(p_activo, true)
  );
end;
$$;

create or replace function public.admin_listar_usuarios()
returns table (
  user_id uuid,
  email text,
  role text,
  role_active boolean,
  comision_porcentaje numeric,
  promotor_activo boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.vx_is_admin() then
    raise exception 'No autorizado';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(r.role, 'cliente'),
    coalesce(r.is_active, false),
    coalesce(p.comision_porcentaje, 0),
    coalesce(p.activo, false),
    u.created_at
  from auth.users u
  left join public.user_roles r on r.user_id = u.id
  left join public.promotores p on p.user_id = u.id
  order by u.created_at desc;
end;
$$;

create or replace function public.promotor_resumen()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_estados jsonb;
  v_resultado jsonb;
begin
  if v_uid is null or not (public.vx_is_gestor() or public.vx_is_promotor()) then
    raise exception 'No autorizado';
  end if;

  select coalesce(jsonb_object_agg(x.estado, x.total), '{}'::jsonb)
  into v_estados
  from (
    select p.estado, count(*)::integer as total
    from public.pedidos p
    where p.promotor_id = v_uid
    group by p.estado
  ) x;

  select jsonb_build_object(
    'pedidos_total', count(*)::integer,
    'ventas_total_usd', coalesce(sum(p.total_usd) filter (where p.estado <> 'Cancelado'), 0),
    'clientes_total', count(distinct coalesce(p.user_id::text, nullif(p.email, ''), nullif(p.telefono, ''))),
    'comision_pendiente_usd', coalesce(sum(p.comision_monto_usd) filter (where p.comision_estado = 'pendiente'), 0),
    'comision_disponible_usd', coalesce(sum(p.comision_monto_usd) filter (where p.comision_estado = 'disponible'), 0),
    'comision_pagada_usd', coalesce(sum(p.comision_monto_usd) filter (where p.comision_estado = 'pagada'), 0),
    'pedidos_por_estado', v_estados
  )
  into v_resultado
  from public.pedidos p
  where p.promotor_id = v_uid;

  return v_resultado;
end;
$$;

create or replace function public.promotor_pedidos(
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_resultado jsonb;
begin
  if v_uid is null or not (public.vx_is_gestor() or public.vx_is_promotor()) then
    raise exception 'No autorizado';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'codigo', p.codigo,
        'estado', p.estado,
        'nombre_cliente', p.nombre_cliente,
        'email', p.email,
        'telefono', p.telefono,
        'direccion', p.direccion,
        'municipio', p.municipio,
        'total_usd', p.total_usd,
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'comision_estado', p.comision_estado,
        'comision_porcentaje', p.comision_porcentaje,
        'comision_monto_usd', p.comision_monto_usd,
        'comision_disponible_at', p.comision_disponible_at,
        'comision_pagada_at', p.comision_pagada_at,
        'items', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'producto_nombre', pi.producto_nombre,
                'cantidad', pi.cantidad,
                'precio_unitario', pi.precio_unitario,
                'subtotal', pi.subtotal
              )
              order by pi.created_at
            ),
            '[]'::jsonb
          )
          from public.pedido_items pi
          where pi.pedido_id = p.id
        )
      )
      order by p.created_at desc
    ),
    '[]'::jsonb
  )
  into v_resultado
  from (
    select *
    from public.pedidos
    where promotor_id = v_uid
    order by created_at desc
    limit v_limit
    offset v_offset
  ) p;

  return v_resultado;
end;
$$;

create or replace function public.promotor_clientes()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_resultado jsonb;
begin
  if v_uid is null or not (public.vx_is_gestor() or public.vx_is_promotor()) then
    raise exception 'No autorizado';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'nombre', c.nombre,
        'email', c.email,
        'telefono', c.telefono,
        'direccion', c.direccion,
        'municipio', c.municipio,
        'pedidos', c.pedidos,
        'total_usd', c.total_usd,
        'ultimo_pedido', c.ultimo_pedido
      )
      order by c.ultimo_pedido desc
    ),
    '[]'::jsonb
  )
  into v_resultado
  from (
    select
      coalesce(nullif(max(p.nombre_cliente), ''), 'Cliente') as nombre,
      max(nullif(p.email, '')) as email,
      max(nullif(p.telefono, '')) as telefono,
      max(nullif(p.direccion, '')) as direccion,
      max(nullif(p.municipio, '')) as municipio,
      count(*)::integer as pedidos,
      coalesce(sum(p.total_usd) filter (where p.estado <> 'Cancelado'), 0) as total_usd,
      max(p.created_at) as ultimo_pedido
    from public.pedidos p
    where p.promotor_id = v_uid
    group by coalesce(p.user_id::text, nullif(p.email, ''), nullif(p.telefono, ''), p.id::text)
  ) c;

  return v_resultado;
end;
$$;

revoke all on public.promotores from anon, authenticated;
grant select on public.promotores to authenticated;

revoke all on function public.vx_sync_comision_pedido() from public;
revoke all on function public.admin_asignar_promotor(uuid, uuid, numeric, numeric) from public, anon;
revoke all on function public.admin_marcar_comision_pagada(uuid) from public, anon;
revoke all on function public.admin_guardar_promotor(uuid, text, numeric, boolean) from public, anon;
revoke all on function public.admin_listar_usuarios() from public, anon;
revoke all on function public.promotor_resumen() from public, anon;
revoke all on function public.promotor_pedidos(integer, integer) from public, anon;
revoke all on function public.promotor_clientes() from public, anon;

grant execute on function public.admin_asignar_promotor(uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.admin_marcar_comision_pagada(uuid) to authenticated;
grant execute on function public.admin_guardar_promotor(uuid, text, numeric, boolean) to authenticated;
grant execute on function public.admin_listar_usuarios() to authenticated;
grant execute on function public.promotor_resumen() to authenticated;
grant execute on function public.promotor_pedidos(integer, integer) to authenticated;
grant execute on function public.promotor_clientes() to authenticated;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pedidos'
      and column_name = 'promotor_id'
  ) then
    raise exception 'Falta la columna pedidos.promotor_id';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'promotores'
      and c.relrowsecurity
  ) then
    raise exception 'RLS no está activo en promotores';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pedidos'
      and policyname = 'pedidos_promotor_ver_atribuidos'
      and qual like '%vx_is_promotor%'
  ) then
    raise exception 'Falta la política de lectura del promotor en pedidos';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'admin_asignar_promotor'
      and p.prosecdef
  ) then
    raise exception 'admin_asignar_promotor no es security definer';
  end if;

  if has_function_privilege('anon', 'public.admin_asignar_promotor(uuid, uuid, numeric, numeric)', 'EXECUTE') then
    raise exception 'anon puede ejecutar admin_asignar_promotor';
  end if;

  if has_function_privilege('anon', 'public.promotor_resumen()', 'EXECUTE') then
    raise exception 'anon puede ejecutar promotor_resumen';
  end if;

  if not has_function_privilege('authenticated', 'public.promotor_resumen()', 'EXECUTE') then
    raise exception 'authenticated no puede ejecutar promotor_resumen';
  end if;
end;
$$;

notify pgrst, 'reload schema';
