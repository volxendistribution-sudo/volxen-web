begin;

do $$
begin
    if not exists (
        select 1
        from auth.users u
        where coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
    ) then
        raise exception 'No hay ningún usuario con app_metadata.role=admin; asigna el rol antes de aplicar esta migración';
    end if;

    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'administradores'
          and column_name = 'user_id'
    ) then
        raise exception 'Falta public.administradores.user_id';
    end if;

    if not exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'crear_pedido'
          and p.prosecdef
    ) then
        raise exception 'crear_pedido no existe en public o no es SECURITY DEFINER';
    end if;

    if not exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'registrar_consulta_v2'
          and p.prosecdef
    ) then
        raise exception 'registrar_consulta_v2 no existe en public o no es SECURITY DEFINER';
    end if;

    if not exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'consultar_pedido_tracking'
          and p.prosecdef
    ) then
        raise exception 'consultar_pedido_tracking no existe en public o no es SECURITY DEFINER';
    end if;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

do $$
begin
    if to_regprocedure('public.es_admin()') is not null then
        execute 'revoke all on function public.es_admin() from public';
        execute 'revoke all on function public.es_admin() from anon, authenticated';
    end if;
end $$;

alter table public.pedidos
    add column if not exists user_id uuid;

alter table public.consultas
    add column if not exists user_id uuid;

alter table public.consultas
    add column if not exists respuesta text;

alter table public.consultas
    add column if not exists respondido_at timestamptz;

create index if not exists pedidos_user_id_idx
    on public.pedidos (user_id);

create index if not exists consultas_user_id_idx
    on public.consultas (user_id);

alter table public.administradores enable row level security;
alter table public.categorias enable row level security;
alter table public.consultas enable row level security;
alter table public.ofertas enable row level security;
alter table public.operadoras enable row level security;
alter table public.pedido_contadores enable row level security;
alter table public.pedido_historial enable row level security;
alter table public.pedido_items enable row level security;
alter table public.pedidos enable row level security;
alter table public.productos enable row level security;

create or replace function public.vx_set_user_id()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
    new.user_id := coalesce(auth.uid(), new.user_id);
    return new;
end;
$$;

revoke all on function public.vx_set_user_id() from public;

drop trigger if exists vx_set_user_id on public.pedidos;
create trigger vx_set_user_id
    before insert on public.pedidos
    for each row
    execute function public.vx_set_user_id();

drop trigger if exists vx_set_user_id on public.consultas;
create trigger vx_set_user_id
    before insert on public.consultas
    for each row
    execute function public.vx_set_user_id();

drop policy if exists categorias_admin on public.categorias;
create policy categorias_admin
    on public.categorias
    for all
    to public
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists productos_admin on public.productos;
create policy productos_admin
    on public.productos
    for all
    to public
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists productos_lectura on public.productos;
create policy productos_lectura
    on public.productos
    for select
    to public
    using (activo = true or public.is_admin());

drop policy if exists ofertas_admin on public.ofertas;
create policy ofertas_admin
    on public.ofertas
    for all
    to public
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists ofertas_lectura on public.ofertas;
create policy ofertas_lectura
    on public.ofertas
    for select
    to public
    using (activa = true or public.is_admin());

drop policy if exists consultas_admin on public.consultas;
create policy consultas_admin
    on public.consultas
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists consultas_cliente_ver_propias on public.consultas;
create policy consultas_cliente_ver_propias
    on public.consultas
    for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists operadoras_lectura_publica on public.operadoras;
create policy operadoras_lectura_publica
    on public.operadoras
    for select
    to anon, authenticated
    using (activa = true);

drop policy if exists operadoras_admin_lectura on public.operadoras;
create policy operadoras_admin_lectura
    on public.operadoras
    for select
    to authenticated
    using (public.is_admin());

drop policy if exists operadoras_admin_insertar on public.operadoras;
create policy operadoras_admin_insertar
    on public.operadoras
    for insert
    to authenticated
    with check (public.is_admin());

drop policy if exists operadoras_admin_actualizar on public.operadoras;
create policy operadoras_admin_actualizar
    on public.operadoras
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists operadoras_admin_eliminar on public.operadoras;
create policy operadoras_admin_eliminar
    on public.operadoras
    for delete
    to authenticated
    using (public.is_admin());

drop policy if exists pedidos_admin_gestionar on public.pedidos;
create policy pedidos_admin_gestionar
    on public.pedidos
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists pedidos_cliente_ver_propios on public.pedidos;
create policy pedidos_cliente_ver_propios
    on public.pedidos
    for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists pedido_items_admin_gestionar on public.pedido_items;
create policy pedido_items_admin_gestionar
    on public.pedido_items
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists pedido_items_cliente_ver_propios on public.pedido_items;
create policy pedido_items_cliente_ver_propios
    on public.pedido_items
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.pedidos p
            where p.id = pedido_id
              and p.user_id = auth.uid()
        )
    );

drop policy if exists pedido_historial_admin_gestionar on public.pedido_historial;
create policy pedido_historial_admin_gestionar
    on public.pedido_historial
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists pedido_historial_cliente_ver_propios on public.pedido_historial;
create policy pedido_historial_cliente_ver_propios
    on public.pedido_historial
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.pedidos p
            where p.id = pedido_id
              and p.user_id = auth.uid()
        )
    );

drop policy if exists vx_admin_borra_pedidos on public.pedidos;
create policy vx_admin_borra_pedidos
    on public.pedidos
    for delete
    to authenticated
    using (public.is_admin());

drop policy if exists vx_admin_borra_pedido_items on public.pedido_items;
create policy vx_admin_borra_pedido_items
    on public.pedido_items
    for delete
    to authenticated
    using (public.is_admin());

drop policy if exists vx_admin_borra_pedido_historial on public.pedido_historial;
create policy vx_admin_borra_pedido_historial
    on public.pedido_historial
    for delete
    to authenticated
    using (public.is_admin());

drop policy if exists fotos_admin on storage.objects;
create policy fotos_admin
    on storage.objects
    for all
    to public
    using (bucket_id = 'productos' and public.is_admin())
    with check (bucket_id = 'productos' and public.is_admin());

do $$
declare
    r record;
begin
    for r in
        select tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in ('administradores', 'pedido_contadores')
    loop
        execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    end loop;
end $$;

revoke all on all tables in schema public from anon;
grant select on public.categorias, public.productos, public.ofertas, public.operadoras to anon;

revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke all on public.administradores from authenticated;
revoke all on public.pedido_contadores from authenticated;
grant select on public.pedidos, public.pedido_items, public.pedido_historial, public.consultas to authenticated;
grant insert, update, delete on public.operadoras to authenticated;

revoke insert, update, delete on storage.objects from anon;
revoke insert, update, delete on storage.buckets from anon, authenticated;
revoke insert, update, delete on storage.buckets_analytics from anon, authenticated;

do $$
declare
    v_count integer;
begin
    select count(*) into v_count
    from pg_policies
    where schemaname in ('public', 'storage')
      and (
        coalesce(qual, '') like '%es_admin%'
        or coalesce(with_check, '') like '%es_admin%'
        or coalesce(qual, '') like '%public.administradores%'
        or coalesce(with_check, '') like '%public.administradores%'
        or coalesce(qual, '') like '%user_metadata%'
        or coalesce(with_check, '') like '%user_metadata%'
      );

    if v_count > 0 then
        raise exception 'Quedan % políticas con criterio admin antiguo o user_metadata', v_count;
    end if;

    select count(*) into v_count
    from pg_policies
    where schemaname = 'public'
      and tablename in ('categorias', 'productos', 'ofertas', 'operadoras', 'administradores', 'pedido_contadores')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and not (
        coalesce(qual, '') like '%is_admin%'
        or coalesce(with_check, '') like '%is_admin%'
      );

    if v_count > 0 then
        raise exception 'Hay % políticas de escritura sin is_admin en tablas protegidas', v_count;
    end if;

    select count(*) into v_count
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and not (
        coalesce(qual, '') like '%is_admin%'
        or coalesce(with_check, '') like '%is_admin%'
      );

    if v_count > 0 then
        raise exception 'Hay % políticas de escritura sin is_admin en storage.objects', v_count;
    end if;

    if exists (
        select 1
        from information_schema.role_table_grants
        where table_schema = 'public'
          and grantee = 'anon'
          and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
    ) then
        raise exception 'anon conserva privilegios de escritura en public';
    end if;

    if exists (
        select 1
        from information_schema.role_table_grants
        where table_schema = 'storage'
          and grantee = 'anon'
          and table_name in ('objects', 'buckets', 'buckets_analytics')
          and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
    ) then
        raise exception 'anon conserva privilegios de escritura en storage';
    end if;

    if exists (
        select 1
        from information_schema.role_table_grants
        where table_schema = 'public'
          and grantee = 'authenticated'
          and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
    ) then
        raise exception 'authenticated conserva privilegios estructurales en public';
    end if;

    if exists (
        select 1
        from information_schema.role_table_grants
        where table_schema = 'public'
          and grantee = 'authenticated'
          and table_name in ('administradores', 'pedido_contadores')
    ) then
        raise exception 'authenticated conserva privilegios en tablas de administración';
    end if;

    if not exists (
        select 1
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'pedidos'
          and t.tgname = 'vx_set_user_id'
          and not t.tgisinternal
    ) then
        raise exception 'Falta el trigger vx_set_user_id en public.pedidos';
    end if;

    if not exists (
        select 1
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'consultas'
          and t.tgname = 'vx_set_user_id'
          and not t.tgisinternal
    ) then
        raise exception 'Falta el trigger vx_set_user_id en public.consultas';
    end if;

    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'consultas'
          and column_name = 'user_id'
    ) then
        raise exception 'Falta public.consultas.user_id';
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'pedidos'
          and policyname = 'pedidos_cliente_ver_propios'
          and qual like '%user_id = auth.uid()%'
    ) then
        raise exception 'Falta la política pedidos_cliente_ver_propios';
    end if;

    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'consultas'
          and policyname = 'consultas_cliente_ver_propias'
          and qual like '%user_id = auth.uid()%'
    ) then
        raise exception 'Falta la política consultas_cliente_ver_propias';
    end if;
end $$;

commit;
