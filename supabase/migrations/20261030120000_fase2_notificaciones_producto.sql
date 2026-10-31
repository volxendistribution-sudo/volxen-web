create table if not exists public.gestor_notificaciones_producto (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  producto_nombre text not null default '',
  precio_anterior numeric(12,2),
  precio_nuevo numeric(12,2),
  margen_anterior numeric(5,2),
  margen_nuevo numeric(5,2),
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists gestor_notificaciones_producto_user_idx
  on public.gestor_notificaciones_producto (user_id, leida, created_at desc);

alter table public.gestor_notificaciones_producto enable row level security;

drop policy if exists gestor_notificaciones_producto_select_self
  on public.gestor_notificaciones_producto;
create policy gestor_notificaciones_producto_select_self
on public.gestor_notificaciones_producto
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists gestor_notificaciones_producto_update_self
  on public.gestor_notificaciones_producto;
create policy gestor_notificaciones_producto_update_self
on public.gestor_notificaciones_producto
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.vx_notificar_cambio_producto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.precio_usd is not distinct from old.precio_usd
     and new.margen_max_porcentaje is not distinct from old.margen_max_porcentaje then
    return new;
  end if;

  insert into public.gestor_notificaciones_producto (
    user_id,
    producto_id,
    producto_nombre,
    precio_anterior,
    precio_nuevo,
    margen_anterior,
    margen_nuevo
  )
  select
    ur.user_id,
    new.id,
    new.nombre,
    old.precio_usd,
    new.precio_usd,
    old.margen_max_porcentaje,
    new.margen_max_porcentaje
  from public.user_roles ur
  where ur.role in ('gestor', 'promotor')
    and ur.is_active = true;

  return new;
end;
$$;

drop trigger if exists productos_notificar_cambio on public.productos;
create trigger productos_notificar_cambio
after update of precio_usd, margen_max_porcentaje
on public.productos
for each row
execute function public.vx_notificar_cambio_producto();

revoke all on public.gestor_notificaciones_producto from anon, authenticated;
grant select on public.gestor_notificaciones_producto to authenticated;
grant update (leida) on public.gestor_notificaciones_producto to authenticated;

revoke all on function public.vx_notificar_cambio_producto() from public, anon, authenticated;
