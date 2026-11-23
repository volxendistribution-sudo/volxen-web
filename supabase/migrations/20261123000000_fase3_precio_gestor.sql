-- FASE 3: permiso de precio por gestor y comisión sobre la diferencia.
-- El precio base sigue siendo la fuente de verdad. La validación real ocurre
-- al crear el pedido, no al generar la imagen compartida.

alter table public.promotores
  add column if not exists puede_subir_precio boolean not null default false;

comment on column public.promotores.puede_subir_precio is
  'Permite al gestor subir el precio de venta hasta el margen del producto.';

comment on column public.pedido_items.comision_unitaria_usd is
  'Comisión total por unidad (comisión base + diferencia sobre el precio base).';

comment on column public.pedido_items.ganancia_unitaria_usd is
  'Ganancia total por unidad (comisión base + diferencia sobre el precio base).';

-- Se elimina la versión anterior de 4 argumentos para que PostgREST no tenga
-- dos sobrecargas con el mismo nombre.
drop function if exists public.admin_guardar_promotor(uuid, text, numeric, boolean);

create or replace function public.admin_guardar_promotor(
  p_user_id uuid,
  p_rol text,
  p_comision_porcentaje numeric default null,
  p_activo boolean default true,
  p_puede_subir_precio boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rol text := lower(trim(coalesce(p_rol, '')));
  v_porcentaje numeric := coalesce(p_comision_porcentaje, 0);
  v_puede_subir boolean := coalesce(p_puede_subir_precio, false);
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
    return jsonb_build_object(
      'user_id', p_user_id,
      'role', 'cliente',
      'activo', false,
      'puede_subir_precio', false
    );
  end if;

  if v_porcentaje < 0 or v_porcentaje > 100 then
    raise exception 'El porcentaje de comisión debe estar entre 0 y 100';
  end if;

  perform public.vx_set_role(p_user_id, v_rol);

  insert into public.promotores (
    user_id,
    comision_porcentaje,
    activo,
    puede_subir_precio,
    updated_at
  )
  values (
    p_user_id,
    v_porcentaje,
    coalesce(p_activo, true),
    v_puede_subir,
    now()
  )
  on conflict (user_id) do update
  set comision_porcentaje = excluded.comision_porcentaje,
      activo = excluded.activo,
      puede_subir_precio = excluded.puede_subir_precio,
      updated_at = now();

  return jsonb_build_object(
    'user_id', p_user_id,
    'role', v_rol,
    'comision_porcentaje', v_porcentaje,
    'activo', coalesce(p_activo, true),
    'puede_subir_precio', v_puede_subir
  );
end;
$$;

drop function if exists public.admin_listar_usuarios();

create or replace function public.admin_listar_usuarios()
returns table (
  user_id uuid,
  email text,
  role text,
  role_active boolean,
  comision_porcentaje numeric,
  promotor_activo boolean,
  created_at timestamptz,
  puede_subir_precio boolean
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
    u.created_at,
    coalesce(p.puede_subir_precio, false)
  from auth.users u
  left join public.user_roles r on r.user_id = u.id
  left join public.promotores p on p.user_id = u.id
  order by u.created_at desc;
end;
$$;

create or replace function public.crear_pedido_gestor(
  p_nombre_cliente text,
  p_email text,
  p_telefono text,
  p_direccion text,
  p_municipio text,
  p_notas text,
  p_items jsonb,
  p_gestor_nombre text,
  p_gestor_telefono text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_promotor public.promotores%rowtype;
  v_nombre_cliente text;
  v_email text;
  v_telefono text;
  v_direccion text;
  v_municipio text;
  v_notas text;
  v_gestor_nombre text;
  v_gestor_telefono text;
  v_pedido_id uuid;
  v_codigo text;
  v_tracking_token text;
  v_total numeric := 0;
  v_ganancia_total numeric := 0;
  v_item jsonb;
  v_producto_id uuid;
  v_cantidad integer;
  v_nombre text;
  v_precio_producto numeric;
  v_precio_oferta numeric;
  v_precio_base numeric;
  v_precio_base_esperado numeric;
  v_precio_venta numeric;
  v_precio_max numeric;
  v_modo text;
  v_comision_fija numeric;
  v_comision_base numeric;
  v_margen numeric;
  v_diferencia numeric;
  v_comision_unitaria numeric;
  v_ganancia_unitaria numeric;
  v_comision_linea numeric;
  v_ganancia_linea numeric;
  v_subtotal numeric;
  v_garantia text;
  v_transporte text;
  v_garantia_pedido text;
  v_transporte_pedido text;
  v_todos_fijos_porcentaje boolean := true;
  v_comision_porcentaje_pedido numeric;
begin
  if v_uid is null or not (public.vx_is_gestor() or public.vx_is_promotor()) then
    raise exception 'No autorizado';
  end if;

  select *
  into v_promotor
  from public.promotores
  where user_id = v_uid
    and activo is true;

  if not found then
    raise exception 'El gestor no está activo';
  end if;

  v_nombre_cliente := nullif(btrim(coalesce(p_nombre_cliente, '')), '');
  v_email := nullif(btrim(coalesce(p_email, '')), '');
  v_telefono := nullif(btrim(coalesce(p_telefono, '')), '');
  v_direccion := nullif(btrim(coalesce(p_direccion, '')), '');
  v_municipio := nullif(btrim(coalesce(p_municipio, '')), '');
  v_notas := nullif(btrim(coalesce(p_notas, '')), '');
  v_gestor_nombre := nullif(btrim(coalesce(p_gestor_nombre, '')), '');
  v_gestor_telefono := nullif(btrim(coalesce(p_gestor_telefono, '')), '');

  if v_nombre_cliente is null then
    raise exception 'El nombre del cliente es obligatorio';
  end if;

  if v_telefono is null then
    raise exception 'El teléfono del cliente es obligatorio';
  end if;

  if v_direccion is null then
    raise exception 'La dirección es obligatoria';
  end if;

  if v_municipio is null then
    raise exception 'El municipio es obligatorio';
  end if;

  if v_gestor_nombre is null then
    raise exception 'El nombre del gestor es obligatorio';
  end if;

  if v_gestor_telefono is null then
    raise exception 'El teléfono del gestor es obligatorio';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido debe contener al menos un producto';
  end if;

  insert into public.pedidos (
    user_id,
    nombre_cliente,
    email,
    telefono,
    direccion,
    municipio,
    notas,
    estado,
    promotor_id,
    comision_estado,
    gestor_nombre,
    gestor_telefono
  )
  values (
    null,
    v_nombre_cliente,
    v_email,
    v_telefono,
    v_direccion,
    v_municipio,
    v_notas,
    'Pedido recibido',
    v_uid,
    'pendiente',
    v_gestor_nombre,
    v_gestor_telefono
  )
  returning id, codigo, tracking_token
  into v_pedido_id, v_codigo, v_tracking_token;

  update public.pedidos
     set user_id = null
   where id = v_pedido_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Cada producto debe ser un objeto';
    end if;

    if not (v_item ? 'producto_id') or not (v_item ? 'cantidad') then
      raise exception 'Cada producto debe incluir producto_id y cantidad';
    end if;

    if (v_item ->> 'producto_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'ID de producto inválido';
    end if;

    if (v_item ->> 'cantidad') !~ '^[0-9]+$' then
      raise exception 'Cantidad inválida';
    end if;

    v_producto_id := (v_item ->> 'producto_id')::uuid;
    v_cantidad := (v_item ->> 'cantidad')::integer;

    if v_cantidad <= 0 then
      raise exception 'La cantidad debe ser mayor que cero';
    end if;

    select
      p.nombre,
      p.precio_usd,
      p.garantia,
      p.transporte,
      coalesce(p.modo_precio, 'comision_fija'),
      p.comision_fija_usd,
      coalesce(p.margen_max_porcentaje, 20)
    into
      v_nombre,
      v_precio_producto,
      v_garantia,
      v_transporte,
      v_modo,
      v_comision_fija,
      v_margen
    from public.productos as p
    where p.id = v_producto_id
      and p.activo is true
      and lower(btrim(p.disponibilidad)) = 'disponible'
    for update;

    if not found then
      raise exception 'El producto no está disponible actualmente';
    end if;

    v_precio_oferta := null;

    select o.precio_oferta_usd
    into v_precio_oferta
    from public.ofertas as o
    where o.producto_id = v_producto_id
      and o.activa is true
      and (o.fecha_inicio is null or o.fecha_inicio <= now())
      and (o.fecha_fin is null or o.fecha_fin >= now())
    order by o.created_at desc
    limit 1;

    v_precio_base := round(coalesce(v_precio_oferta, v_precio_producto), 2);

    if v_precio_base is null or v_precio_base < 0 then
      raise exception 'El precio del producto no es válido';
    end if;

    if (v_item ? 'precio_base')
       and nullif(btrim(v_item ->> 'precio_base'), '') is not null then
      if (v_item ->> 'precio_base') !~ '^[0-9]+([.][0-9]{1,2})?$' then
        raise exception 'El precio base no es válido';
      end if;

      v_precio_base_esperado := round((v_item ->> 'precio_base')::numeric, 2);

      if v_precio_base_esperado <> v_precio_base then
        raise exception 'El precio base del producto cambió. Vuelve a revisar el precio antes de confirmar.';
      end if;
    end if;

    v_precio_venta := v_precio_base;

    if (v_item ? 'precio_unitario')
       and nullif(btrim(v_item ->> 'precio_unitario'), '') is not null then
      if (v_item ->> 'precio_unitario') !~ '^[0-9]+([.][0-9]{1,2})?$' then
        raise exception 'El precio de venta no es válido';
      end if;

      v_precio_venta := round((v_item ->> 'precio_unitario')::numeric, 2);
    end if;

    if not coalesce(v_promotor.puede_subir_precio, false) then
      if v_precio_venta <> v_precio_base then
        raise exception 'No tienes permiso para cambiar el precio de este producto';
      end if;

      v_precio_venta := v_precio_base;
    else
      v_margen := greatest(0, least(coalesce(v_margen, 20), 100));
      v_precio_max := round(v_precio_base * (1 + v_margen / 100.0), 2);

      if v_precio_venta < v_precio_base then
        raise exception 'El precio de venta no puede ser inferior al precio VOLXEN';
      end if;

      if v_precio_venta > v_precio_max then
        raise exception 'El precio de venta supera el máximo permitido (%)', v_precio_max;
      end if;
    end if;

    v_comision_base := 0;

    if v_modo = 'comision_fija' then
      if v_comision_fija is null then
        v_comision_base := round(
          v_precio_base * coalesce(v_promotor.comision_porcentaje, 0) / 100.0,
          2
        );
      else
        v_comision_base := round(v_comision_fija, 2);
        v_todos_fijos_porcentaje := false;
      end if;
    elsif v_modo = 'sin_comision' then
      v_todos_fijos_porcentaje := false;
    else
      raise exception 'Modo de precio no válido para el producto';
    end if;

    v_diferencia := round(v_precio_venta - v_precio_base, 2);

    if v_diferencia > 0 then
      v_todos_fijos_porcentaje := false;
    end if;

    v_comision_unitaria := round(v_comision_base + v_diferencia, 2);
    v_ganancia_unitaria := v_comision_unitaria;

    v_subtotal := round(v_precio_venta * v_cantidad, 2);
    v_comision_linea := round(v_comision_unitaria * v_cantidad, 2);
    v_ganancia_linea := round(v_ganancia_unitaria * v_cantidad, 2);

    v_total := v_total + v_subtotal;
    v_ganancia_total := v_ganancia_total + v_ganancia_linea;

    insert into public.pedido_items (
      pedido_id,
      producto_id,
      producto_nombre,
      cantidad,
      precio_unitario,
      garantia,
      transporte,
      subtotal,
      precio_volxen,
      modo_precio,
      comision_unitaria_usd,
      ganancia_unitaria_usd,
      ganancia_total_usd
    )
    values (
      v_pedido_id,
      v_producto_id,
      v_nombre,
      v_cantidad,
      v_precio_venta,
      v_garantia,
      v_transporte,
      v_subtotal,
      v_precio_base,
      v_modo,
      v_comision_unitaria,
      v_ganancia_unitaria,
      v_ganancia_linea
    );
  end loop;

  select
    string_agg(distinct btrim(pi.garantia), ' | ')
      filter (where pi.garantia is not null and btrim(pi.garantia) <> ''),
    string_agg(distinct btrim(pi.transporte), ' | ')
      filter (where pi.transporte is not null and btrim(pi.transporte) <> '')
  into v_garantia_pedido, v_transporte_pedido
  from public.pedido_items as pi
  where pi.pedido_id = v_pedido_id;

  if v_todos_fijos_porcentaje then
    v_comision_porcentaje_pedido := coalesce(v_promotor.comision_porcentaje, 0);
  else
    v_comision_porcentaje_pedido := null;
  end if;

  update public.pedidos
     set total_usd = v_total,
         comision_porcentaje = v_comision_porcentaje_pedido,
         comision_monto_usd = round(v_ganancia_total, 2),
         garantia = v_garantia_pedido,
         transporte = v_transporte_pedido
   where id = v_pedido_id;

  return jsonb_build_object(
    'id', v_pedido_id,
    'codigo', v_codigo,
    'tracking_token', v_tracking_token,
    'estado', 'Pedido recibido',
    'total_usd', round(v_total, 2),
    'comision_porcentaje', v_comision_porcentaje_pedido,
    'comision_monto_usd', round(v_ganancia_total, 2),
    'garantia', v_garantia_pedido,
    'transporte', v_transporte_pedido,
    'created_at', (
      select p.created_at
      from public.pedidos as p
      where p.id = v_pedido_id
    ),
    'nombre_cliente', v_nombre_cliente,
    'email', v_email,
    'telefono', v_telefono,
    'direccion', v_direccion,
    'municipio', v_municipio,
    'notas', v_notas,
    'gestor_nombre', v_gestor_nombre,
    'gestor_telefono', v_gestor_telefono,
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'producto_id', pi.producto_id,
            'producto_nombre', pi.producto_nombre,
            'cantidad', pi.cantidad,
            'precio_volxen', pi.precio_volxen,
            'precio_unitario', pi.precio_unitario,
            'subtotal', pi.subtotal,
            'modo_precio', pi.modo_precio,
            'comision_unitaria_usd', pi.comision_unitaria_usd,
            'ganancia_unitaria_usd', pi.ganancia_unitaria_usd,
            'ganancia_total_usd', pi.ganancia_total_usd,
            'garantia', pi.garantia,
            'transporte', pi.transporte
          )
          order by pi.created_at
        ),
        '[]'::jsonb
      )
      from public.pedido_items as pi
      where pi.pedido_id = v_pedido_id
    )
  );
end;
$$;

revoke all on function public.admin_guardar_promotor(
  uuid,
  text,
  numeric,
  boolean,
  boolean
) from public, anon;

grant execute on function public.admin_guardar_promotor(
  uuid,
  text,
  numeric,
  boolean,
  boolean
) to authenticated;

revoke all on function public.admin_listar_usuarios() from public, anon;
grant execute on function public.admin_listar_usuarios() to authenticated;

revoke all on function public.crear_pedido_gestor(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text
) from public, anon;

grant execute on function public.crear_pedido_gestor(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text
) to authenticated;
