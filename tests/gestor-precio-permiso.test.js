const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const MIGRATION = "supabase/migrations/20261123000000_fase3_precio_gestor.sql";

test("la migración fase 3 agrega permiso por gestor y tope 0-100", () => {
    const sql = read(MIGRATION);

    assert.match(sql, /add column if not exists puede_subir_precio boolean not null default false/i);
    assert.match(sql, /p_puede_subir_precio boolean default false/i);
    assert.match(sql, /puede_subir_precio boolean\s*\)/i);
    assert.match(sql, /puede_subir_precio = excluded\.puede_subir_precio/i);
    assert.match(sql, /least\(coalesce\(v_margen, 20\), 100\)/i);
});

test("el RPC valida permiso, precio base y tope, y suma la diferencia", () => {
    const sql = read(MIGRATION);

    assert.match(sql, /if not coalesce\(v_promotor\.puede_subir_precio, false\) then/i);
    assert.match(sql, /No tienes permiso para cambiar el precio de este producto/i);
    assert.match(sql, /v_precio_venta < v_precio_base/i);
    assert.match(sql, /v_precio_venta > v_precio_max/i);
    assert.match(sql, /El precio base del producto cambió/i);
    assert.match(sql, /v_comision_base := round\(/i);
    assert.match(sql, /v_diferencia := round\(v_precio_venta - v_precio_base, 2\)/i);
    assert.match(sql, /v_comision_unitaria := round\(v_comision_base \+ v_diferencia, 2\)/i);
    assert.match(sql, /comision_monto_usd = round\(v_ganancia_total, 2\)/i);
});

test("el admin activa el permiso, configura el margen 0-100 y ve la diferencia", () => {
    const admin = read("admin.html");

    assert.match(admin, /id="gpp-/);
    assert.match(admin, /Puede subir el precio/);
    assert.match(admin, /p_puede_subir_precio:puedeSubir/);
    assert.match(admin, /min="0" max="100"/);
    assert.match(admin, /Math\.min\(100/);
    assert.match(admin, /Diferencia:/);
    assert.match(admin, /adminMoney\(i\.ganancia_total_usd\)/);
});

test("la ficha del gestor muestra su precio y avisa solo cuando no hay comisión base", () => {
    const html = read("gestor.html");
    const js = read("js/pages/gestor.js");
    const css = read("gestor.css");

    assert.match(html, /id="gsProductShareNotice"/);
    assert.match(html, /role="status" aria-live="polite"/);
    assert.match(html, /Si no subes el precio, no tendrás comisión en esta venta\./);
    assert.match(html, /<label for="gsProductSalePrice">Tu precio/);
    assert.match(js, /puede_subir_precio/);
    assert.match(js, /function canRaisePrice/);
    assert.match(js, /function updateShareNotice/);
    assert.match(js, /precio_base: line\.base\.toFixed\(2\)/);
    assert.match(js, /precio_unitario = line\.salePrice\.toFixed\(2\)/);
    assert.match(js, /price: sharePrice/);
    assert.match(js, /· Precio " \+ money\(sharePrice\)/);
    assert.match(css, /\.gs-product-share-notice/);
});

test("los RPC nuevos no se exponen a anon", () => {
    const sql = read(MIGRATION);

    assert.match(sql, /revoke all on function public\.admin_guardar_promotor\([\s\S]*?from public, anon/i);
    assert.match(sql, /grant execute on function public\.admin_guardar_promotor\([\s\S]*?to authenticated/i);
    assert.match(sql, /revoke all on function public\.crear_pedido_gestor\([\s\S]*?from public, anon/i);
    assert.match(sql, /grant execute on function public\.crear_pedido_gestor\([\s\S]*?to authenticated/i);
});
