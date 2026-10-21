alter table public.productos
    add column if not exists shipping_type text not null default 'free',
    add column if not exists shipping_cost numeric(10, 2);

alter table public.productos
    drop constraint if exists productos_shipping_type_check;

alter table public.productos
    add constraint productos_shipping_type_check
    check (shipping_type in ('free', 'paid'));

alter table public.productos
    drop constraint if exists productos_shipping_cost_check;

alter table public.productos
    add constraint productos_shipping_cost_check
    check (
        (shipping_type = 'free' and shipping_cost is null)
        or (
            shipping_type = 'paid'
            and shipping_cost is not null
            and shipping_cost > 0
        )
    );

comment on column public.productos.shipping_type is
    'Tipo de envío mostrado en la ficha: free o paid.';

comment on column public.productos.shipping_cost is
    'Costo de envío en USD. Obligatorio cuando shipping_type = paid.';
