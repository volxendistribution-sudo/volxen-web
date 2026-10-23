create or replace function public.consultar_consulta(p_codigo text, p_contacto text)
returns jsonb
language sql
security definer
stable
set search_path = public, pg_temp
as $$
    select to_jsonb(x)
    from (
        select c.codigo, c.tipo, c.estado, c.codigo_pedido, c.created_at
        from public.consultas c
        where upper(btrim(c.codigo)) = upper(btrim(p_codigo))
          and length(btrim(p_contacto)) >= 6
          and position(lower(btrim(p_contacto)) in lower(c.contacto)) > 0
        order by c.created_at desc
        limit 1
    ) x;
$$;

revoke all on function public.consultar_consulta(text, text) from public;
grant execute on function public.consultar_consulta(text, text) to anon, authenticated;
