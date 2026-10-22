-- Cuentas de cliente: vincula los pedidos al usuario autenticado y expone
-- el historial propio a través de una RPC segura.

alter table public.pedidos
    add column if not exists user_id uuid;

alter table public.consultas
    add column if not exists user_id uuid;

create index if not exists pedidos_user_id_idx
    on public.pedidos (user_id);

create index if not exists consultas_user_id_idx
    on public.consultas (user_id);

create or replace function public.mis_pedidos()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
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

revoke all on function public.mis_pedidos() from public;
revoke all on function public.mis_pedidos() from anon;
grant execute on function public.mis_pedidos() to authenticated;
