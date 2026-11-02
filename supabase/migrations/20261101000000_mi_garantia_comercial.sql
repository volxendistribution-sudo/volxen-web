-- Expone el nombre comercial del gestor en el certificado del cliente.
-- El campo solo se devuelve al propietario del pedido y nunca incluye
-- comisiones, precios base ni datos internos de VOLXEN.

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
  v_comercial text;
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

  select g.token,
         g.activado_at,
         coalesce(nullif(btrim(p.gestor_nombre), ''), 'VOLXEN')
  into v_token, v_activado_at, v_comercial
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
    'activado_at', v_activado_at,
    'comercial', v_comercial
  );
end;
$$;
