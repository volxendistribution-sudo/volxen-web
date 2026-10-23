-- Cancelación de pedidos por parte del cliente
-- Añade la marca de cancelación, actualiza mis_pedidos y expone la RPC
-- que solo permite cancelar pedidos propios que aún no estén cerrados.

ALTER TABLE public.pedidos
    ADD COLUMN IF NOT EXISTS cancelado_por_cliente boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.mis_pedidos()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', p.id,
                'codigo', p.codigo,
                'estado', p.estado,
                'cancelado_por_cliente', coalesce(p.cancelado_por_cliente, false),
                'puede_cancelar', p.estado not in ('Entregado', 'Cancelado'),
                'nombre_cliente', p.nombre_cliente,
                'email', p.email,
                'telefono', p.telefono,
                'direccion', p.direccion,
                'municipio', p.municipio,
                'total_usd', p.total_usd,
                'garantia', p.garantia,
                'transporte', p.transporte,
                'notas', p.notas,
                'created_at', p.created_at,
                'updated_at', p.updated_at,
                'items', (
                    select coalesce(
                        jsonb_agg(
                            jsonb_build_object(
                                'producto_id', pi.producto_id,
                                'producto_nombre', pi.producto_nombre,
                                'cantidad', pi.cantidad,
                                'precio_unitario', pi.precio_unitario,
                                'subtotal', pi.subtotal,
                                'garantia', pi.garantia,
                                'transporte', pi.transporte
                            )
                            order by pi.created_at
                        ),
                        '[]'::jsonb
                    )
                    from public.pedido_items pi
                    where pi.pedido_id = p.id
                ),
                'historial', (
                    select coalesce(
                        jsonb_agg(
                            jsonb_build_object(
                                'estado', ph.estado,
                                'comentario', ph.comentario,
                                'created_at', ph.created_at
                            )
                            order by ph.created_at
                        ),
                        '[]'::jsonb
                    )
                    from public.pedido_historial ph
                    where ph.pedido_id = p.id
                )
            )
            order by p.created_at desc
        ),
        '[]'::jsonb
    )
    from public.pedidos p
    where p.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.cancelar_pedido(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_pedido public.pedidos%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión para cancelar un pedido';
    END IF;

    UPDATE public.pedidos
       SET estado = 'Cancelado',
           cancelado_por_cliente = true
     WHERE id = p_pedido_id
       AND user_id = v_user_id
       AND estado NOT IN ('Entregado', 'Cancelado')
    RETURNING * INTO v_pedido;

    IF v_pedido.id IS NULL THEN
        RAISE EXCEPTION 'El pedido no existe o ya no se puede cancelar';
    END IF;

    UPDATE public.pedido_historial
       SET comentario = 'Cancelado por el cliente',
           cambiado_por = v_user_id
     WHERE pedido_id = v_pedido.id
       AND estado = 'Cancelado'
       AND comentario IS NULL;

    RETURN jsonb_build_object(
        'id', v_pedido.id,
        'codigo', v_pedido.codigo,
        'estado', v_pedido.estado,
        'cancelado_por_cliente', v_pedido.cancelado_por_cliente
    );
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_pedido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido(uuid) TO authenticated;
