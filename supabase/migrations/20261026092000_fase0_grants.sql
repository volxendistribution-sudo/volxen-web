revoke all on all tables in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.categorias, public.productos, public.ofertas, public.operadoras
to anon, authenticated;

grant select, insert, update, delete
on public.categorias, public.productos, public.ofertas, public.operadoras
to authenticated;

grant select, insert, update, delete
on public.pedidos, public.pedido_items, public.pedido_historial, public.consultas
to authenticated;

grant select
on public.user_roles, public.role_audit
to authenticated;

revoke all on all sequences in schema public from anon, authenticated;

revoke all on all functions in schema public from public;
revoke all on all functions in schema public from anon, authenticated;

grant execute on function public.crear_pedido(text, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.consultar_pedido_tracking(text, text) to anon, authenticated;
grant execute on function public.registrar_consulta_v2(text, text, text, text, text) to anon, authenticated;
grant execute on function public.consultar_consulta(text, text) to anon, authenticated;
grant execute on function public.crear_consulta(text, text, text, text, text) to anon, authenticated;
grant execute on function public.registrar_consulta(text, text, text, text, text) to anon, authenticated;
grant execute on function public.ver_consulta(text, text) to anon, authenticated;

grant execute on function public.es_admin() to anon, authenticated;
grant execute on function public.vx_is_admin() to anon, authenticated;
grant execute on function public.vx_role() to authenticated;
grant execute on function public.mi_rol() to authenticated;
grant execute on function public.vx_is_gestor() to authenticated;
grant execute on function public.vx_is_promotor() to authenticated;
grant execute on function public.vx_can_manage() to authenticated;
grant execute on function public.vx_set_role(uuid, text) to authenticated;
grant execute on function public.vx_revoke_role(uuid) to authenticated;

grant execute on function public.mis_pedidos() to authenticated;
grant execute on function public.mis_consultas() to authenticated;
grant execute on function public.cancelar_pedido(uuid) to authenticated;

revoke insert, update, delete on storage.objects from anon;
revoke insert, update, delete on storage.buckets from anon, authenticated;
revoke insert, update, delete on storage.buckets_analytics from anon, authenticated;
