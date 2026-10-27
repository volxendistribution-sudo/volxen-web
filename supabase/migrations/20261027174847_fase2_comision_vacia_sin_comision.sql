update public.productos
   set modo_precio = 'sin_comision',
       comision_fija_usd = null
 where modo_precio = 'comision_fija'
   and comision_fija_usd is null;

alter table public.productos
  drop constraint if exists productos_comision_fija_solo_modo_check;

alter table public.productos
  add constraint productos_comision_fija_solo_modo_check
  check (
    (modo_precio = 'sin_comision' and comision_fija_usd is null)
    or (modo_precio = 'comision_fija' and comision_fija_usd is not null)
  );

comment on column public.productos.comision_fija_usd is
  'Comisión fija por unidad visible para el gestor. Vacío implica precio flexible sin comisión.';
