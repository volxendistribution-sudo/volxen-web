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
    assert.match(js, /askCancelOrder/);
    assert.match(js, /vx:order-complete/);

    const html = read("pedidos.html");
    assert.match(html, /<dialog id="cancelDlg"/);
    assert.match(html, /id="cancelConfirm"/);
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
    assert.match(js, /consultas_tipo\.\*check/i);
    assert.match(js, /rate limit\|too many/i);
});

test("la migración permite al cliente ver el estado de sus consultas", () => {
    const sql = read("supabase/migrations/20261025_consultas_cliente.sql");
    const fn = sql.match(/create or replace function public\.mis_consultas\(\)[\s\S]*?\$\$;/i)[0];

    assert.match(sql, /create policy consultas_cliente_ver_propias/i);
    assert.match(sql, /for select[\s\S]*?user_id = auth\.uid\(\)/i);
    assert.match(fn, /security definer/i);
    assert.match(fn, /where c\.user_id = auth\.uid\(\)/i);
    assert.match(sql, /create or replace function public\.consultar_consulta/i);
    assert.match(sql, /'codigo', v_codigo/);
    assert.match(sql, /v_user_id uuid := auth\.uid\(\)/);
    assert.match(sql, /codigo, user_id\)/);
    assert.match(sql, /grant execute on function public\.mis_consultas\(\) to authenticated/i);
});

test("la recuperación usa un código OTP dentro de la web", () => {
    const auth = read("auth.js");
    const recover = read("js/pages/auth-recover.js");
    const page = read("recuperar.html");
    const template = read("supabase/templates/recovery.html");

    assert.match(auth, /verifyRecoveryCode/);
    assert.match(auth, /type: "recovery"/);
    assert.match(recover, /verifyRecoveryCode/);
    assert.match(recover, /recoverCode/);
    assert.match(recover, /function recoveryRedirect\(\)/);
    assert.match(recover, /VXAUTH\.recover\(email, recoveryRedirect\(\)\)/);
    assert.match(recover, /VXAUTH\.recover\(recoveryEmail, recoveryRedirect\(\)\)/);
    assert.match(page, /id="recoverCode"/);
    assert.match(page, /incluye un enlace/);
    assert.match(template, /\{\{ \.Token \}\}/);
    assert.doesNotMatch(template, /ConfirmationURL/);
});

test("la cabecera muestra el nombre y el menú de cuenta", () => {
    const core = read("volxen-core.js");

    assert.match(core, /function menuAccountHtml/);
    assert.match(core, /data-menu-logout/);
    assert.match(core, /data-account-name/);
    assert.match(core, /data-admin-only/);
    assert.match(core, /menu-account-actions/);
});

test("la consulta invitado exige el contacto real sin comodines SQL", () => {
    const sql = read("supabase/migrations/20261025_consultas_contacto_exacto.sql");

    assert.match(sql, /position\(lower\(btrim\(p_contacto\)\) in lower\(c\.contacto\)\) > 0/);
    assert.doesNotMatch(sql, /like '%'/);
});
