const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/20261027120000_fase2_crear_pedido_gestor.sql"),
    "utf8"
);

test("la migración del pedido de gestor añade precios y ganancias por producto", () => {
    assert.match(sql, /add column if not exists modo_precio text not null default 'comision_fija'/i);
    assert.match(sql, /add column if not exists comision_fija_usd numeric\(12,2\)/i);
    assert.match(sql, /add column if not exists margen_max_porcentaje numeric\(5,2\) not null default 20/i);
    assert.match(sql, /add column if not exists gestor_nombre text/i);
    assert.match(sql, /add column if not exists precio_volxen numeric\(12,2\)/i);
    assert.match(sql, /add column if not exists ganancia_total_usd numeric\(12,2\)/i);
    assert.match(sql, /productos_modo_precio_check/i);
    assert.match(sql, /productos_comision_fija_solo_modo_check/i);
    assert.match(sql, /margen_max_porcentaje >= 0 and margen_max_porcentaje <= 100/i);
});

test("la migración crea el RPC de gestor con validación de rol y precios", () => {
    assert.match(sql, /create or replace function public\.crear_pedido_gestor/i);
    assert.match(sql, /p_gestor_nombre text,\s*p_gestor_telefono text/s);
    assert.match(sql, /security definer/i);
    assert.match(sql, /public\.vx_is_gestor\(\) or public\.vx_is_promotor\(\)/i);
    assert.match(sql, /where user_id = v_uid\s*and activo is true/s);
    assert.match(sql, /v_precio_base := round\(coalesce\(v_precio_oferta, v_precio_producto\), 2\)/i);
    assert.match(sql, /v_precio_venta > v_precio_max/i);
    assert.match(sql, /v_ganancia_unitaria := round\(v_precio_venta - v_precio_base, 2\)/i);
    assert.match(sql, /comision_monto_usd = round\(v_ganancia_total, 2\)/i);
    assert.match(sql, /set user_id = null/i);
});

test("la migración no expone el nuevo RPC a anon", () => {
    assert.match(sql, /revoke all on function public\.crear_pedido_gestor\([\s\S]*?from public, anon/i);
    assert.match(sql, /grant execute on function public\.crear_pedido_gestor\([\s\S]*?to authenticated/i);
    assert.doesNotMatch(sql, /grant execute on function public\.crear_pedido_gestor\([\s\S]*?to anon/i);
    assert.match(sql, /has_function_privilege\(\s*'anon',[\s\S]*?'EXECUTE'\s*\)/i);
});
