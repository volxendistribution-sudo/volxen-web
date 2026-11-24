create table if not exists public.gestor_precio_guardado (
  gestor_id uuid not null references auth.users(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  precio_usd numeric(12,2) not null check (precio_usd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (gestor_id, producto_id)
);

alter table public.gestor_precio_guardado
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.gestor_precio_guardado enable row level security;

drop policy if exists gestor_precio_guardado_select_self
  on public.gestor_precio_guardado;
create policy gestor_precio_guardado_select_self
on public.gestor_precio_guardado
for select
to authenticated
using (gestor_id = auth.uid());

drop policy if exists gestor_precio_guardado_insert_self
  on public.gestor_precio_guardado;
create policy gestor_precio_guardado_insert_self
on public.gestor_precio_guardado
for insert
to authenticated
with check (
  gestor_id = auth.uid()
  and (public.vx_is_gestor() or public.vx_is_promotor())
  and exists (
    select 1 from public.productos p
    where p.id = producto_id
      and p.activo is true
      and p.modo_precio = 'sin_comision'
  )
);

drop policy if exists gestor_precio_guardado_update_self
  on public.gestor_precio_guardado;
create policy gestor_precio_guardado_update_self
on public.gestor_precio_guardado
for update
to authenticated
using (gestor_id = auth.uid())
with check (
  gestor_id = auth.uid()
  and (public.vx_is_gestor() or public.vx_is_promotor())
  and exists (
    select 1 from public.productos p
    where p.id = producto_id
      and p.activo is true
      and p.modo_precio = 'sin_comision'
  )
);

drop policy if exists gestor_precio_guardado_delete_self
  on public.gestor_precio_guardado;
create policy gestor_precio_guardado_delete_self
on public.gestor_precio_guardado
for delete
to authenticated
using (gestor_id = auth.uid());

revoke all on public.gestor_precio_guardado from public, anon;
grant select, insert, update, delete
  on public.gestor_precio_guardado to authenticated;

create or replace function public.gestor_precio_guardado_validar()
returns trigger
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
  v_max numeric;
begin
  if v_uid is null
     or not (public.vx_is_gestor() or public.vx_is_promotor()) then
    raise exception 'No autorizado';
  end if;

  if new.gestor_id <> v_uid then
    raise exception 'Solo puedes guardar tu propio precio';
  end if;

  select *
  into v_producto
  from public.productos
  where id = new.producto_id;

  if not found or v_producto.activo is not true then
    raise exception 'El producto no está activo';
  end if;

  if coalesce(v_producto.modo_precio, 'comision_fija') <> 'sin_comision' then
    raise exception 'El administrador no permite cambiar el precio de este producto';
  end if;

  select o.precio_oferta_usd
  into v_oferta
  from public.ofertas o
  where o.producto_id = new.producto_id
    and o.activa is true
    and (o.fecha_inicio is null or o.fecha_inicio <= now())
    and (o.fecha_fin is null or o.fecha_fin >= now())
  order by o.created_at desc
  limit 1;

  v_base := round(coalesce(v_oferta, v_producto.precio_usd), 2);
  if v_base is null or v_base < 0 then
    raise exception 'El precio base no es válido';
  end if;

  v_margen := greatest(
    0,
    least(coalesce(v_producto.margen_max_porcentaje, 20), 20)
  );
  v_max := round(v_base * (1 + v_margen / 100.0), 2);

  new.precio_usd := round(new.precio_usd, 2);
  if new.precio_usd < v_base or new.precio_usd > v_max then
    raise exception 'El precio debe estar entre % y % USD', v_base, v_max;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists gestor_precio_guardado_validar
  on public.gestor_precio_guardado;
create trigger gestor_precio_guardado_validar
before insert or update on public.gestor_precio_guardado
for each row execute function public.gestor_precio_guardado_validar();

revoke all on function public.gestor_precio_guardado_validar()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
