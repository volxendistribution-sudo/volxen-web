create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'gestor', 'promotor', 'cliente')),
  is_active boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now()
);

create index user_roles_role_activo_idx
  on public.user_roles (role)
  where is_active;

create table public.role_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  old_role text,
  new_role text,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_id uuid,
  created_at timestamptz not null default now()
);

create index role_audit_user_idx
  on public.role_audit (user_id, created_at desc);

alter table public.user_roles enable row level security;
alter table public.role_audit enable row level security;

create or replace function public.vx_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.role
  from public.user_roles r
  where r.user_id = auth.uid()
    and r.is_active
  limit 1
$$;

create or replace function public.vx_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.vx_role() = 'admin', false)
$$;

create or replace function public.vx_is_gestor()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.vx_role() = 'gestor', false)
$$;

create or replace function public.vx_is_promotor()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.vx_role() = 'promotor', false)
$$;

create or replace function public.vx_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.vx_is_admin()
$$;

create or replace function public.mi_rol()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.vx_role(), 'cliente')
  where auth.uid() is not null
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.vx_is_admin()
$$;

create or replace function public.log_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_old_role text;
  v_new_role text;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_old_role := old.role;
    v_new_role := null;
  elsif tg_op = 'UPDATE' then
    v_user_id := new.user_id;
    v_old_role := old.role;
    v_new_role := new.role;
  else
    v_user_id := new.user_id;
    v_old_role := null;
    v_new_role := new.role;
  end if;

  insert into public.role_audit (user_id, old_role, new_role, action, actor_id)
  values (v_user_id, v_old_role, v_new_role, lower(tg_op), auth.uid());

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger user_roles_audit
after insert or update or delete on public.user_roles
for each row execute function public.log_role_change();

create or replace function public.vx_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_old_role text;
  v_admin_count integer;
begin
  if v_actor is null or not public.vx_is_admin() then
    raise exception 'No autorizado';
  end if;

  if p_user_id is null then
    raise exception 'El usuario es obligatorio';
  end if;

  p_role := lower(trim(p_role));

  if p_role is null or p_role not in ('admin', 'gestor', 'promotor', 'cliente') then
    raise exception 'Rol no válido';
  end if;

  if p_user_id = v_actor then
    raise exception 'No puedes cambiar tu propio rol';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'El usuario no existe';
  end if;

  select r.role into v_old_role
  from public.user_roles r
  where r.user_id = p_user_id;

  if v_old_role = 'admin' and p_role <> 'admin' then
    select count(*) into v_admin_count
    from public.user_roles
    where role = 'admin' and is_active;

    if v_admin_count <= 1 then
      raise exception 'No se puede degradar al último administrador';
    end if;
  end if;

  insert into public.user_roles (user_id, role, is_active, assigned_by, assigned_at)
  values (p_user_id, p_role, true, v_actor, now())
  on conflict (user_id) do update
  set role = excluded.role,
      is_active = true,
      assigned_by = excluded.assigned_by,
      assigned_at = now();
end;
$$;

create or replace function public.vx_revoke_role(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_old_role text;
  v_admin_count integer;
begin
  if v_actor is null or not public.vx_is_admin() then
    raise exception 'No autorizado';
  end if;

  if p_user_id is null then
    raise exception 'El usuario es obligatorio';
  end if;

  if p_user_id = v_actor then
    raise exception 'No puedes revocar tu propio rol';
  end if;

  select r.role into v_old_role
  from public.user_roles r
  where r.user_id = p_user_id;

  if v_old_role is null then
    return;
  end if;

  if v_old_role = 'admin' then
    select count(*) into v_admin_count
    from public.user_roles
    where role = 'admin' and is_active;

    if v_admin_count <= 1 then
      raise exception 'No se puede revocar al último administrador';
    end if;
  end if;

  delete from public.user_roles where user_id = p_user_id;
end;
$$;

create policy user_roles_select_self
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

create policy user_roles_select_admin
on public.user_roles
for select
to authenticated
using (public.vx_is_admin());

create policy role_audit_select_admin
on public.role_audit
for select
to authenticated
using (public.vx_is_admin());

revoke all on public.user_roles from anon, authenticated;
revoke all on public.role_audit from anon, authenticated;
grant select on public.user_roles, public.role_audit to authenticated;

revoke all on function public.vx_role() from public;
revoke all on function public.vx_is_admin() from public;
revoke all on function public.vx_is_gestor() from public;
revoke all on function public.vx_is_promotor() from public;
revoke all on function public.vx_can_manage() from public;
revoke all on function public.mi_rol() from public;
revoke all on function public.es_admin() from public;
revoke all on function public.log_role_change() from public;
revoke all on function public.vx_set_role(uuid, text) from public;
revoke all on function public.vx_revoke_role(uuid) from public;

grant execute on function public.vx_is_admin() to anon, authenticated;
grant execute on function public.es_admin() to anon, authenticated;
grant execute on function public.vx_role() to authenticated;
grant execute on function public.mi_rol() to authenticated;
grant execute on function public.vx_is_gestor() to authenticated;
grant execute on function public.vx_is_promotor() to authenticated;
grant execute on function public.vx_can_manage() to authenticated;

insert into public.user_roles (user_id, role, is_active)
select user_id, 'admin', true
from public.administradores
on conflict (user_id) do update
set role = 'admin',
    is_active = true;

do $$
begin
  if not exists (
    select 1
    from public.user_roles
    where role = 'admin' and is_active
  ) then
    raise exception 'Fase 0 requiere al menos un administrador';
  end if;
end;
$$;
