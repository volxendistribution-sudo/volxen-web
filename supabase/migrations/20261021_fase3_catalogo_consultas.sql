-- Fase 3: imagen de categorías y nuevos tipos de consulta
-- Aplicar en Supabase (SQL Editor) antes de usar la subida de imágenes
-- de categorías y los tipos Queja / Opinión.

-- 1) Imagen de categoría (ruta pública dentro del bucket productos)
ALTER TABLE public.categorias
    ADD COLUMN IF NOT EXISTS imagen text;

-- 2) Quitar restricciones CHECK antiguas que limiten consultas.tipo
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.consultas'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ~* '\mtipo\M'
    LOOP
        EXECUTE format('ALTER TABLE public.consultas DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

-- 3) Si tipo es un ENUM, añadir Queja y Opinión. Si es texto, crear el CHECK.
DO $$
DECLARE
    v_type regtype;
    v_label text;
BEGIN
    SELECT a.atttypid::regtype
      INTO v_type
      FROM pg_attribute a
     WHERE a.attrelid = 'public.consultas'::regclass
       AND a.attname = 'tipo'
       AND NOT a.attisdropped;

    IF v_type IS NULL THEN
        RAISE EXCEPTION 'La tabla public.consultas no tiene la columna tipo';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_type WHERE oid = v_type AND typtype = 'e') THEN
        FOREACH v_label IN ARRAY ARRAY['consulta', 'incidencia', 'queja', 'opinion']
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                 WHERE enumtypid = v_type
                   AND enumlabel = v_label
            ) THEN
                EXECUTE format('ALTER TYPE %s ADD VALUE %L', v_type, v_label);
            END IF;
        END LOOP;
    ELSE
        ALTER TABLE public.consultas
            DROP CONSTRAINT IF EXISTS consultas_tipo_fase3_check;
        ALTER TABLE public.consultas
            ADD CONSTRAINT consultas_tipo_fase3_check
            CHECK (tipo IS NULL OR tipo IN ('consulta', 'incidencia', 'queja', 'opinion'));
    END IF;
END $$;

-- 4) RPC para registrar consultas, incidencias, quejas y opiniones.
--    Mantiene compatibilidad con el contacto combinado "teléfono · correo".
CREATE OR REPLACE FUNCTION public.registrar_consulta_v2(
    p_tipo text,
    p_nombre text,
    p_contacto text,
    p_codigo_pedido text DEFAULT '',
    p_mensaje text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_type_name text;
    v_tipo public.consultas.tipo%TYPE;
    v_codigo_required boolean;
    v_codigo text;
BEGIN
    IF btrim(coalesce(p_nombre, '')) = '' OR
       btrim(coalesce(p_contacto, '')) = '' OR
       btrim(coalesce(p_mensaje, '')) = '' THEN
        RAISE EXCEPTION 'Nombre, contacto y mensaje son obligatorios';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod)
      INTO v_type_name
      FROM pg_attribute a
     WHERE a.attrelid = 'public.consultas'::regclass
       AND a.attname = 'tipo'
       AND NOT a.attisdropped;

    EXECUTE format('SELECT $1::%s', v_type_name)
       INTO v_tipo
      USING lower(btrim(coalesce(nullif(p_tipo, ''), 'consulta')));

    SELECT (a.attnotnull AND NOT a.atthasdef AND a.attidentity = '' AND a.attgenerated = '')
      INTO v_codigo_required
      FROM pg_attribute a
     WHERE a.attrelid = 'public.consultas'::regclass
       AND a.attname = 'codigo'
       AND NOT a.attisdropped;

    IF coalesce(v_codigo_required, false) THEN
        v_codigo := 'CQ-' || to_char(now(), 'YYYYMMDD') || '-' ||
                    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

        INSERT INTO public.consultas
            (tipo, estado, nombre, contacto, codigo_pedido, mensaje, codigo)
        VALUES
            (v_tipo, 'nueva', btrim(p_nombre), btrim(p_contacto),
             nullif(btrim(coalesce(p_codigo_pedido, '')), ''), btrim(p_mensaje), v_codigo);
    ELSE
        INSERT INTO public.consultas
            (tipo, estado, nombre, contacto, codigo_pedido, mensaje)
        VALUES
            (v_tipo, 'nueva', btrim(p_nombre), btrim(p_contacto),
             nullif(btrim(coalesce(p_codigo_pedido, '')), ''), btrim(p_mensaje));
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_consulta_v2(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_consulta_v2(text, text, text, text, text) TO anon, authenticated;

-- 5) Comprobación rápida (opcional): estructura resultante.
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'consultas'
--  ORDER BY ordinal_position;
