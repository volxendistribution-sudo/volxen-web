-- Fase 4: sección y página de operadoras
-- Aplicar en Supabase (SQL Editor) antes de usar la pestaña Operadoras.
-- Las operadoras iniciales son las que ya estaban definidas en la web.

CREATE TABLE IF NOT EXISTS public.operadoras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    whatsapp text NOT NULL,
    horario text NOT NULL DEFAULT '',
    disponible boolean NOT NULL DEFAULT true,
    activa boolean NOT NULL DEFAULT true,
    orden integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operadoras_activa_orden_idx
    ON public.operadoras (activa, orden);

ALTER TABLE public.operadoras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operadoras_lectura_publica ON public.operadoras;
DROP POLICY IF EXISTS operadoras_admin_lectura ON public.operadoras;
DROP POLICY IF EXISTS operadoras_admin_insertar ON public.operadoras;
DROP POLICY IF EXISTS operadoras_admin_actualizar ON public.operadoras;
DROP POLICY IF EXISTS operadoras_admin_eliminar ON public.operadoras;

CREATE POLICY operadoras_lectura_publica
    ON public.operadoras
    FOR SELECT
    TO anon, authenticated
    USING (activa = true);

CREATE POLICY operadoras_admin_lectura
    ON public.operadoras
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY operadoras_admin_insertar
    ON public.operadoras
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY operadoras_admin_actualizar
    ON public.operadoras
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY operadoras_admin_eliminar
    ON public.operadoras
    FOR DELETE
    TO authenticated
    USING (true);

GRANT SELECT ON public.operadoras TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.operadoras TO authenticated;

-- Carga inicial: mismos nombres y números que ya tenía el proyecto.
-- El horario queda vacío para que se complete desde el panel; no se inventan horarios.
INSERT INTO public.operadoras (nombre, whatsapp, horario, disponible, activa, orden)
SELECT v.nombre, v.whatsapp, '', true, true, v.orden
FROM (VALUES
    ('Operadora 1', '5356581114', 1),
    ('Operadora 2', '5356193681', 2),
    ('Operadora 3', '5352405395', 3),
    ('Operadora 4', '5363990666', 4),
    ('Operadora 5', '5352842030', 5),
    ('Operadora 6', '5355500209', 6)
) AS v(nombre, whatsapp, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.operadoras);
