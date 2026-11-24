const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/20261124090000_gestor_precio_guardado.sql"),
    "utf8"
);

test("la migración crea la tabla de precio propio por gestor y producto", () => {
    assert.match(sql, /create table if not exists public\.gestor_precio_guardado/i);
    assert.match(sql, /gestor_id uuid not null references auth\.users\(id\) on delete cascade/i);
    assert.match(sql, /producto_id uuid not null references public\.productos\(id\) on delete cascade/i);
    assert.match(sql, /precio_usd numeric\(12,2\) not null check \(precio_usd >= 0\)/i);
    assert.match(sql, /primary key \(gestor_id, producto_id\)/i);
});

test("la RLS solo permite leer y escribir las filas propias", () => {
    assert.match(sql, /alter table public\.gestor_precio_guardado enable row level security/i);
    assert.match(sql, /using \(gestor_id = auth\.uid\(\)\)/i);
    assert.match(sql, /for select[\s\S]*?to authenticated[\s\S]*?using \(gestor_id = auth\.uid\(\)\)/i);
    assert.match(sql, /for insert[\s\S]*?with check \([\s\S]*?gestor_id = auth\.uid\(\)/i);
    assert.match(sql, /for update[\s\S]*?using \(gestor_id = auth\.uid\(\)\)[\s\S]*?with check \([\s\S]*?gestor_id = auth\.uid\(\)/i);
    assert.match(sql, /for delete[\s\S]*?to authenticated[\s\S]*?using \(gestor_id = auth\.uid\(\)\)/i);
});

test("la RLS exige rol de gestor o promotor y producto en modo flexible", () => {
    assert.match(sql, /public\.vx_is_gestor\(\) or public\.vx_is_promotor\(\)/i);
    assert.match(sql, /p\.activo is true/i);
    assert.match(sql, /p\.modo_precio = 'sin_comision'/i);
});

test("el trigger valida precio base, oferta, margen máximo y permiso", () => {
    assert.match(sql, /create or replace function public\.gestor_precio_guardado_validar\(\)/i);
    assert.match(sql, /security definer/i);
    assert.match(sql, /new\.gestor_id <> v_uid/i);
    assert.match(sql, /coalesce\(v_producto\.modo_precio, 'comision_fija'\) <> 'sin_comision'/i);
    assert.match(sql, /v_base := round\(coalesce\(v_oferta, v_producto\.precio_usd\), 2\)/i);
    assert.match(sql, /least\(coalesce\(v_producto\.margen_max_porcentaje, 20\), 20\)/i);
    assert.match(sql, /new\.precio_usd < v_base or new\.precio_usd > v_max/i);
    assert.match(sql, /before insert or update on public\.gestor_precio_guardado/i);
});

test("la tabla no queda expuesta a anon y el trigger no es ejecutable por clientes", () => {
    assert.match(sql, /revoke all on public\.gestor_precio_guardado from public, anon/i);
    assert.match(sql, /grant select, insert, update, delete[\s\S]*?to authenticated/i);
    assert.match(sql, /revoke all on function public\.gestor_precio_guardado_validar\(\)[\s\S]*?from public, anon, authenticated/i);
    assert.doesNotMatch(sql, /grant .*?public\.gestor_precio_guardado.*?to anon/i);
});
