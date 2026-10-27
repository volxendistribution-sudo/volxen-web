alter table public.productos
  add column if not exists modo_precio text not null default 'comision_fija',
  add column if not exists comision_fija_usd numeric(12,2),
  add column if not exists margen_max_porcentaje numeric(5,2) not null default 20;

alter table public.pedidos
  add column if not exists gestor_nombre text,
  add column if not exists gestor_telefono text;

alter table public.pedido_items
  add column if not exists precio_volxen numeric(12,2),
  add column if not exists modo_precio text,
  add column if not exists comision_unitaria_usd numeric(12,2),
  add column if not exists ganancia_unitaria_usd numeric(12,2),
  add column if not exists ganancia_total_usd numeric(12,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.productos'::regclass
      and conname = 'productos_modo_precio_check'
  ) then
    alter table public.productos
      add constraint productos_modo_precio_check
      check (modo_precio in ('comision_fija', 'sin_comision'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.productos'::regclass
      and conname = 'productos_comision_fija_usd_check'
  ) then
    alter table public.productos
      add constraint productos_comision_fija_usd_check
      check (comision_fija_usd is null or comision_fija_usd >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.productos'::regclass
      and conname = 'productos_margen_max_porcentaje_check'
  ) then
    alter table public.productos
      add constraint productos_margen_max_porcentaje_check
      check (margen_max_porcentaje >= 0 and margen_max_porcentaje <= 100);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.productos'::regclass
      and conname = 'productos_comision_fija_solo_modo_check'
  ) then
    alter table public.productos
      add constraint productos_comision_fija_solo_modo_check
      check (modo_precio = 'comision_fija' or comision_fija_usd is null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pedido_items'::regclass
      and conname = 'pedido_items_modo_precio_check'
  ) then
    alter table public.pedido_items
      add constraint pedido_items_modo_precio_check
      check (modo_precio is null or modo_precio in ('comision_fija', 'sin_comision'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pedido_items'::regclass
      and conname = 'pedido_items_precio_volxen_check'
  ) then
    alter table public.pedido_items
      add constraint pedido_items_precio_volxen_check
      check (precio_volxen is null or precio_volxen >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pedido_items'::regclass
      and conname = 'pedido_items_comision_unitaria_usd_check'
  ) then
    alter table public.pedido_items
      add constraint pedido_items_comision_unitaria_usd_check
      check (comision_unitaria_usd is null or comision_unitaria_usd >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pedido_items'::regclass
      and conname = 'pedido_items_ganancia_unitaria_usd_check'
  ) then
    alter table public.pedido_items
      add constraint pedido_items_ganancia_unitaria_usd_check
      check (ganancia_unitaria_usd is null or ganancia_unitaria_usd >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pedido_items'::regclass
      and conname = 'pedido_items_ganancia_total_usd_check'
  ) then
    alter table public.pedido_items
      add constraint pedido_items_ganancia_total_usd_check
      check (ganancia_total_usd is null or ganancia_total_usd >= 0);
  end if;
end;
$$;

comment on column public.productos.modo_precio is
  'comision_fija: precio bloqueado con comisión fija o porcentual; sin_comision: el gestor puede subir hasta el margen máximo y conserva la diferencia.';

comment on column public.productos.comision_fija_usd is
  'Comisión fija por unidad. NULL usa el porcentaje configurado en promotores.';

comment on column public.productos.margen_max_porcentaje is
  'Subida máxima permitida sobre el precio VOLXEN en modo sin_comision.';

comment on column public.pedidos.gestor_nombre is
  'Nombre del gestor que registró el pedido.';

comment on column public.pedidos.gestor_telefono is
  'Teléfono del gestor que registró el pedido.';

comment on column public.pedido_items.precio_volxen is
  'Precio VOLXEN vigente al registrar el pedido.';

comment on column public.pedido_items.modo_precio is
  'Modo de precio aplicado al producto al registrar el pedido.';

comment on column public.pedido_items.comision_unitaria_usd is
  'Comisión o ganancia por unidad snapshot al registrar el pedido.';

comment on column public.pedido_items.ganancia_unitaria_usd is
  'Ganancia por unidad snapshot al registrar el pedido.';

comment on column public.pedido_items.ganancia_total_usd is
  'Ganancia de la línea snapshot al registrar el pedido.';

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
  v_precio_venta numeric;
  v_precio_max numeric;
  v_modo text;
  v_comision_fija numeric;
  v_margen numeric;
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

    if v_modo = 'comision_fija' then
      v_precio_venta := v_precio_base;

      if v_comision_fija is null then
        v_comision_unitaria := round(
          v_precio_base * coalesce(v_promotor.comision_porcentaje, 0) / 100.0,
          2
        );
      else
        v_comision_unitaria := round(v_comision_fija, 2);
        v_todos_fijos_porcentaje := false;
      end if;

      v_ganancia_unitaria := v_comision_unitaria;
    elsif v_modo = 'sin_comision' then
      v_todos_fijos_porcentaje := false;

      if not (v_item ? 'precio_unitario')
         or nullif(btrim(v_item ->> 'precio_unitario'), '') is null then
        raise exception 'El precio de venta es obligatorio para este producto';
      end if;

      if (v_item ->> 'precio_unitario') !~ '^[0-9]+([.][0-9]{1,2})?$' then
        raise exception 'El precio de venta no es válido';
      end if;

      v_precio_venta := round((v_item ->> 'precio_unitario')::numeric, 2);
      v_margen := greatest(0, least(coalesce(v_margen, 20), 100));
      v_precio_max := round(v_precio_base * (1 + v_margen / 100.0), 2);

      if v_precio_venta < v_precio_base then
        raise exception 'El precio de venta no puede ser inferior al precio VOLXEN';
      end if;

      if v_precio_venta > v_precio_max then
        raise exception 'El precio de venta supera el máximo permitido para este producto';
      end if;

      v_comision_unitaria := 0;
      v_ganancia_unitaria := round(v_precio_venta - v_precio_base, 2);
    else
      raise exception 'Modo de precio no válido para el producto';
    end if;

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

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'productos'
      and column_name = 'modo_precio'
  ) then
    raise exception 'Falta la columna productos.modo_precio';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pedidos'
      and column_name = 'gestor_nombre'
  ) then
    raise exception 'Falta la columna pedidos.gestor_nombre';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pedido_items'
      and column_name = 'ganancia_total_usd'
  ) then
    raise exception 'Falta la columna pedido_items.ganancia_total_usd';
  end if;

  if not exists (
    select 1
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'crear_pedido_gestor'
      and p.prosecdef
  ) then
    raise exception 'crear_pedido_gestor no es security definer';
  end if;

  if has_function_privilege(
    'anon',
    'public.crear_pedido_gestor(text,text,text,text,text,text,jsonb,text,text)',
    'EXECUTE'
  ) then
    raise exception 'anon puede ejecutar crear_pedido_gestor';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.crear_pedido_gestor(text,text,text,text,text,text,jsonb,text,text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated no puede ejecutar crear_pedido_gestor';
  end if;
end;
$$;

notify pgrst, 'reload schema';
