-- Rollback de la fase 3 (precio del gestor). Elimina solo lo añadido.
revoke all on function public.gestor_admin_configurar_precio(uuid, boolean, numeric) from public, anon;
revoke all on function public.gestor_precio_guardar(uuid, numeric) from public, anon;
revoke all on function public.gestor_precio_leer(uuid) from public, anon;

drop function if exists public.gestor_admin_configurar_precio(uuid, boolean, numeric);
drop function if exists public.gestor_precio_guardar(uuid, numeric);
drop function if exists public.gestor_precio_leer(uuid);

drop table if exists public.gestor_precio_guardado cascade;
drop table if exists public.gestor_permiso_precio cascade;
drop table if exists public.gestor_precio_config cascade;

notify pgrst, 'reload schema';
