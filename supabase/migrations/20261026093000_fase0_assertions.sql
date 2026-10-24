do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'vx_is_admin'
      and p.prosecdef
  ) then
    raise exception 'Falta la función vx_is_admin con security definer';
  end if;

  if not exists (
    select 1
    from public.user_roles
    where role = 'admin' and is_active
  ) then
    raise exception 'Falta un administrador activo en user_roles';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (qual = 'true' or with_check = 'true')
  ) then
    raise exception 'Hay políticas de escritura abiertas en public';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'operadoras'
      and policyname = 'operadoras_admin_insertar'
      and with_check like '%vx_is_admin%'
  ) then
    raise exception 'La política de inserción de operadoras no exige vx_is_admin';
  end if;

  if has_table_privilege('anon', 'public.administradores', 'SELECT') then
    raise exception 'anon conserva acceso a administradores';
  end if;

  if has_table_privilege('authenticated', 'public.administradores', 'SELECT') then
    raise exception 'authenticated conserva acceso a administradores';
  end if;

  if has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
     or has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
     or has_table_privilege('authenticated', 'public.user_roles', 'DELETE') then
    raise exception 'authenticated puede escribir directamente en user_roles';
  end if;

  if has_table_privilege('authenticated', 'public.role_audit', 'INSERT')
     or has_table_privilege('authenticated', 'public.role_audit', 'UPDATE')
     or has_table_privilege('authenticated', 'public.role_audit', 'DELETE') then
    raise exception 'authenticated puede escribir directamente en role_audit';
  end if;

  if has_table_privilege('anon', 'public.operadoras', 'INSERT')
     or has_table_privilege('anon', 'public.operadoras', 'UPDATE')
     or has_table_privilege('anon', 'public.operadoras', 'DELETE') then
    raise exception 'anon conserva escritura sobre operadoras';
  end if;

  if has_function_privilege('anon', 'public.vx_set_role(uuid, text)', 'EXECUTE') then
    raise exception 'anon puede ejecutar vx_set_role';
  end if;

  if not has_function_privilege('authenticated', 'public.mi_rol()', 'EXECUTE') then
    raise exception 'authenticated no puede ejecutar mi_rol';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename in ('objects', 'buckets')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and 'anon' = any(roles)
  ) then
    raise exception 'anon tiene una política de escritura en storage';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects'
      and c.relrowsecurity
  ) then
    raise exception 'RLS no está activo en storage.objects';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'buckets'
      and c.relrowsecurity
  ) then
    raise exception 'RLS no está activo en storage.buckets';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'fotos_admin'
      and with_check like '%vx_is_admin%'
  ) then
    raise exception 'La política de fotos no exige vx_is_admin';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_roles'
      and c.relrowsecurity
  ) then
    raise exception 'RLS no está activo en user_roles';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'role_audit'
      and c.relrowsecurity
  ) then
    raise exception 'RLS no está activo en role_audit';
  end if;
end;
$$;

notify pgrst, 'reload schema';
