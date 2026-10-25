const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("la migración de promotores crea comisiones y RPCs protegidos", () => {
    const sql = read("supabase/migrations/20261026100000_fase1_promotores_comisiones.sql");

    assert.match(sql, /create table if not exists public\.promotores/i);
    assert.match(sql, /add column if not exists promotor_id uuid references auth\.users/i);
    assert.match(sql, /add column if not exists comision_estado text not null default 'pendiente'/i);
    assert.match(sql, /create policy pedidos_promotor_ver_atribuidos/i);
    assert.match(sql, /promotor_id = auth\.uid\(\)/);
    assert.match(sql, /create or replace function public\.admin_asignar_promotor/i);
    assert.match(sql, /create or replace function public\.admin_marcar_comision_pagada/i);
    assert.match(sql, /create or replace function public\.admin_guardar_promotor/i);
    assert.match(sql, /create or replace function public\.promotor_resumen/i);
    assert.match(sql, /create or replace function public\.promotor_pedidos/i);
    assert.match(sql, /create or replace function public\.promotor_clientes/i);
    assert.match(sql, /revoke all on function public\.promotor_resumen\(\) from public, anon/i);
    assert.match(sql, /grant execute on function public\.promotor_resumen\(\) to authenticated/i);
    assert.match(sql, /security definer/i);
});

test("el panel de gestor carga solo sus RPCs y valida el rol", () => {
    const js = read("js/pages/gestor.js");
    const html = read("gestor.html");

    assert.doesNotThrow(() => new Function(js));
    assert.match(js, /\/rpc\/promotor_resumen/);
    assert.match(js, /\/rpc\/promotor_pedidos/);
    assert.match(js, /\/rpc\/promotor_clientes/);
    assert.match(js, /role !== "gestor" && role !== "promotor"/);
    assert.match(js, /role === "admin"/);
    assert.doesNotMatch(js, /\/rest\/v1\/pedidos/);
    assert.match(html, /js\/pages\/gestor\.js/);
    assert.match(html, /auth\.js/);
    assert.match(html, /gestor\.css/);
    assert.match(html, /noindex/);
});

test("el admin puede asignar gestor, comisión y marcar pago", () => {
    const html = read("admin.html");

    assert.match(html, /onclick="tab\('g'\)"/);
    assert.match(html, /rpc\/admin_listar_usuarios/);
    assert.match(html, /rpc\/admin_guardar_promotor/);
    assert.match(html, /rpc\/admin_asignar_promotor/);
    assert.match(html, /rpc\/admin_marcar_comision_pagada/);
    assert.match(html, /MARCAR COMISIÓN PAGADA/);
    assert.match(html, /GESTOR Y COMISIÓN/);
});

test("el menú muestra el panel solo a gestores y promotores", () => {
    const core = read("volxen-core.js");

    assert.match(core, /gestor\.html/);
    assert.match(core, /data-gestor-only/);
    assert.match(core, /user\.role === "gestor" \|\| user\.role === "promotor"/);
    assert.doesNotMatch(core, /admin\.html/);
});

test("el panel privado queda fuera de los buscadores", () => {
    assert.match(read("robots.txt"), /Disallow: \/gestor\.html/);
});

test("el build copia la página y los estilos del panel", () => {
    const pkg = JSON.parse(read("package.json"));

    assert.match(pkg.scripts["build:html"], /gestor\.html/);
    assert.match(pkg.scripts["build:html"], /gestor\.css/);
});
