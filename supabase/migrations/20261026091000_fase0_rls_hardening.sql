drop policy if exists admins_ver_propio on public.administradores;

drop policy if exists categorias_admin on public.categorias;
drop policy if exists categorias_lectura on public.categorias;

create policy categorias_lectura
on public.categorias
for select
to anon, authenticated
using (true);

create policy categorias_admin
on public.categorias
for all
to authenticated
using (public.vx_is_admin())
with check (public.vx_is_admin());

drop policy if exists productos_admin on public.productos;
drop policy if exists productos_lectura on public.productos;

create policy productos_lectura
on public.productos
for select
to anon, authenticated
using ((activo = true) or public.vx_is_admin());

create policy productos_admin
on public.productos
for all
to authenticated
using (public.vx_is_admin())
with check (public.vx_is_admin());

drop policy if exists ofertas_admin on public.ofertas;
drop policy if exists ofertas_lectura on public.ofertas;

create policy ofertas_lectura
on public.ofertas
for select
to anon, authenticated
using ((activa = true) or public.vx_is_admin());

create policy ofertas_admin
on public.ofertas
for all
to authenticated
using (public.vx_is_admin())
with check (public.vx_is_admin());

drop policy if exists operadoras_admin_actualizar on public.operadoras;
drop policy if exists operadoras_admin_eliminar on public.operadoras;
drop policy if exists operadoras_admin_insertar on public.operadoras;
drop policy if exists operadoras_admin_lectura on public.operadoras;
drop policy if exists operadoras_lectura_publica on public.operadoras;

create policy operadoras_lectura_publica
on public.operadoras
for select
to anon, authenticated
using (activa = true);

create policy operadoras_admin_lectura
on public.operadoras
for select
to authenticated
using (public.vx_is_admin());

create policy operadoras_admin_insertar
on public.operadoras
for insert
to authenticated
with check (public.vx_is_admin());

create policy operadoras_admin_actualizar
on public.operadoras
for update
to authenticated
using (public.vx_is_admin())
with check (public.vx_is_admin());

create policy operadoras_admin_eliminar
on public.operadoras
for delete
to authenticated
using (public.vx_is_admin());

drop policy if exists pedidos_admin_gestionar on public.pedidos;
drop policy if exists vx_admin_borra_pedidos on public.pedidos;

create policy pedidos_admin_gestionar
on public.pedidos
for all
to authenticated
using (public.vx_is_admin())
with check (public.vx_is_admin());

drop policy if exists pedido_items_admin_gestionar on public.pedido_items;
drop policy if exists vx_admin_borra_pedido_items on public.pedido_items;

create policy pedido_items_admin_gestionar
on public.pedido_items
for all
to authenticated
using (public.vx_is_admin())
with check (public.vx_is_admin());

drop policy if exists pedido_historial_admin_gestionar on public.pedido_historial;
drop policy if exists vx_admin_borra_pedido_historial on public.pedido_historial;

create policy pedido_historial_admin_gestionar
on public.pedido_historial
for all
to authenticated
using (public.vx_is_admin())
with check (public.vx_is_admin());

drop policy if exists consultas_admin on public.consultas;

create policy consultas_admin
on public.consultas
for all
to authenticated
using (public.vx_is_admin())
with check (public.vx_is_admin());

drop policy if exists fotos_admin on storage.objects;
drop policy if exists fotos_lectura on storage.objects;

create policy fotos_lectura
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'productos');

create policy fotos_admin
on storage.objects
for all
to authenticated
using (bucket_id = 'productos' and public.vx_is_admin())
with check (bucket_id = 'productos' and public.vx_is_admin());
