const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("la migración expone la cancelación solo a clientes autenticados", () => {
    const sql = read("supabase/migrations/20261024_pedidos_cancelacion.sql");

    assert.match(sql, /add column if not exists cancelado_por_cliente boolean not null default false/i);
    assert.match(sql, /create or replace function public\.cancelar_pedido\(p_pedido_id uuid\)/i);
    assert.match(sql, /security definer/i);
    assert.match(sql, /estado = 'Cancelado'/);
    assert.match(sql, /Cancelado por el cliente/);
    assert.match(sql, /revoke all on function public\.cancelar_pedido\(uuid\) from public, anon/i);
    assert.match(sql, /grant execute on function public\.cancelar_pedido\(uuid\) to authenticated/i);
    assert.match(sql, /'cancelado_por_cliente', coalesce\(p\.cancelado_por_cliente, false\)/);
    assert.match(sql, /'puede_cancelar', p\.estado not in \('Entregado', 'Cancelado'\)/);
});

test("el panel de pedidos permite cancelar y muestra el detalle", () => {
    const js = read("js/pages/pedidos.js");

    assert.match(js, /function renderOrder/);
    assert.match(js, /order\.items/);
    assert.match(js, /order\.historial/);
    assert.match(js, /puede_cancelar/);
    assert.match(js, /cancelar_pedido/);
    assert.match(js, /window\.confirm/);
    assert.match(js, /vx:order-complete/);
});

test("pedido.js es sintácticamente válido y ofrece ver los pedidos", () => {
    const js = read("pedido.js");

    assert.doesNotThrow(() => new Function(js));
    assert.match(js, /Ver mis pedidos/);
    assert.match(js, /tracking=g\(j,"tracking_token"\)/);
});

test("la cabecera hidrata el avatar desde la sesión", () => {
    const core = read("volxen-core.js");
    const auth = read("auth.js");

    assert.match(core, /function avatarHtml/);
    assert.match(core, /function hydrateAccount/);
    assert.match(core, /vx_sesion/);
    assert.match(auth, /avatar: profile\.avatar_url \|\| profile\.picture \|\| profile\.avatar/);
});

test("admin avisa cuando el cliente canceló el pedido", () => {
    const html = read("admin.html");

    assert.match(html, /cancel-alert/);
    assert.match(html, /El cliente canceló el pedido/);
    assert.match(html, /cancelado_por_cliente = false/);
});

test("consulta.js muestra el error real y no solo la conexión", () => {
    const js = read("js/pages/consulta.js");

    assert.match(js, /function failureMessage/);
    assert.match(js, /No se pudo enviar su mensaje: /);
    assert.match(js, /rate limit\|too many/i);
});
