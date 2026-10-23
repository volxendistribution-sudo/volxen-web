alter table public.consultas add column if not exists user_id uuid references auth.users(id) on delete set null;

drop policy if exists consultas_cliente_ver_propias on public.consultas;
create policy consultas_cliente_ver_propias
on public.consultas
for select
to authenticated
using (user_id = auth.uid());

drop function if exists public.registrar_consulta_v2(text, text, text, text, text);

create function public.registrar_consulta_v2(
    p_tipo text,
    p_nombre text,
    p_contacto text,
    p_codigo_pedido text default '',
    p_mensaje text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_type_name text;
    v_tipo public.consultas.tipo%type;
    v_id uuid;
    v_codigo text;
    v_user_id uuid := auth.uid();
begin
    if btrim(coalesce(p_nombre, '')) = '' or
       btrim(coalesce(p_contacto, '')) = '' or
       btrim(coalesce(p_mensaje, '')) = '' then
        raise exception 'Nombre, contacto y mensaje son obligatorios';
    end if;

    if length(btrim(p_nombre)) > 120 or
       length(btrim(p_contacto)) > 120 or
       length(coalesce(p_codigo_pedido, '')) > 40 or
       length(btrim(p_mensaje)) > 2000 then
        raise exception 'Datos demasiado largos';
    end if;

    select format_type(a.atttypid, a.atttypmod)
      into v_type_name
      from pg_attribute a
     where a.attrelid = 'public.consultas'::regclass
       and a.attname = 'tipo'
       and not a.attisdropped;

    execute format('select $1::%s', v_type_name)
       into v_tipo
      using lower(btrim(coalesce(nullif(p_tipo, ''), 'consulta')));

    v_codigo := 'CQ-' || to_char(now(), 'YYYYMMDD') || '-' ||
                upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    insert into public.consultas
        (tipo, estado, nombre, contacto, codigo_pedido, mensaje, codigo, user_id)
    values
        (v_tipo, 'nueva', btrim(p_nombre), btrim(p_contacto),
         nullif(upper(btrim(coalesce(p_codigo_pedido, ''))), ''),
         btrim(p_mensaje), v_codigo, v_user_id)
    returning id into v_id;

    return jsonb_build_object(
        'id', v_id,
        'codigo', v_codigo,
        'estado', 'nueva'
    );
end;
$$;

create or replace function public.mis_consultas()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'tipo', c.tipo,
                'estado', c.estado,
                'codigo', c.codigo,
                'codigo_pedido', c.codigo_pedido,
                'mensaje', c.mensaje,
                'created_at', c.created_at
            )
            order by c.created_at desc
        ),
        '[]'::jsonb
    )
    from public.consultas c
    where c.user_id = auth.uid();
$$;

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
          and lower(c.contacto) like '%' || lower(btrim(p_contacto)) || '%'
        order by c.created_at desc
        limit 1
    ) x;
$$;

revoke all on function public.registrar_consulta_v2(text, text, text, text, text) from public;
grant execute on function public.registrar_consulta_v2(text, text, text, text, text) to anon, authenticated;

revoke all on function public.mis_consultas() from public, anon;
grant execute on function public.mis_consultas() to authenticated;

revoke all on function public.consultar_consulta(text, text) from public;
grant execute on function public.consultar_consulta(text, text) to anon, authenticated;
