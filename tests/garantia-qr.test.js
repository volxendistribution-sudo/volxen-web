const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("la migración crea la garantía solo para pedidos entregados", () => {
    const sql = read("supabase/migrations/20261031154756_fase2_garantias_qr.sql");

    assert.match(sql, /add column if not exists garantia_activa boolean not null default false/i);
    assert.match(sql, /create table if not exists public\.pedido_garantias/i);
    assert.match(sql, /char_length\(token\) >= 64/);
    assert.match(sql, /encode\(extensions\.gen_random_bytes\(32\), 'hex'\)/);
    assert.match(sql, /create trigger pedidos_sync_garantia[\s\S]*?after insert or update of estado/i);
    assert.match(sql, /old\.estado = 'Entregado'/);
    assert.match(sql, /set activo = false/);
    assert.match(sql, /create or replace function public\.consultar_garantia\(p_token text\)/i);
    assert.match(sql, /and p\.estado = 'Entregado'/);
    assert.match(sql, /grant execute on function public\.consultar_garantia\(text\) to anon, authenticated/i);
    assert.match(sql, /revoke all on function public\.promotor_garantia_pedido\(uuid\) from public, anon/i);
    assert.match(sql, /create or replace function public\.mi_garantia\(p_pedido_id uuid\)/i);
    assert.doesNotMatch(sql, /precio_volxen|comision_monto_usd/i);
});

test("el certificado público no expone información interna", () => {
    const html = read("garantia.html");
    const js = read("js/pages/garantia.js");

    assert.match(html, /name="robots" content="noindex, nofollow"/);
    assert.match(html, /name="referrer" content="no-referrer"/);
    assert.match(html, /id="gItems"/);
    assert.match(html, /id="gWarranty"/);
    assert.match(html, /id="gDelivered"/);
    assert.doesNotMatch(html, /cuenta\.css|gestor\.css|menu|nav/i);
    assert.match(js, /rpc\/consultar_garantia/);
    assert.match(js, /p_token: token/);
    assert.match(js, /fecha_entrega/);
    assert.match(js, /No incluye garantía documentada/);
    assert.doesNotMatch(js, /comision|precio_volxen|ganancia/i);
});

test("el QR se genera con el enlace de garantía y el generador vendorizado", () => {
    const qr = read("js/pages/garantia-qr.js");
    const vendor = read("js/vendor/qrcode-generator.js");

    assert.doesNotThrow(() => new Function(qr));
    assert.doesNotThrow(() => new Function(vendor));
    assert.match(qr, /garantia\.html#g=/);
    assert.match(qr, /encodeURIComponent/);
    assert.match(qr, /volxen-garantia-/);
    assert.match(qr, /navigator\.canShare/);
    assert.match(qr, /showLink: true|showLink === true/);
    assert.match(vendor, /Kazuhiko Arase/);
    assert.match(vendor, /MIT/);

    delete require.cache[require.resolve(path.join(ROOT, "js/vendor/qrcode-generator.js"))];
    const QRCode = require(path.join(ROOT, "js/vendor/qrcode-generator.js"));
    const code = new QRCode(0, QRCode.ErrorCorrectLevel.M);
    code.addData("https://volxen.com/garantia.html#g=" + "a".repeat(64));
    code.make();
    assert.ok(code.getModuleCount() >= 21);
    assert.equal(typeof code.isDark(0, 0), "boolean");
});

test("el cliente ve la línea de tiempo y su certificado en Mis pedidos", () => {
    const js = read("js/pages/pedidos.js");
    const core = read("volxen-core.js");
    const html = read("pedidos.html");

    assert.match(js, /function renderTimeline/);
    assert.match(js, /TRACKING_STATES/);
    assert.match(js, /is-current/);
    assert.match(js, /formatDateTime/);
    assert.match(js, /mi_garantia/);
    assert.match(js, /data\.comercial/);
    assert.match(js, /data-guarantee-order/);
    assert.match(core, /function trackTimeline/);
    assert.match(core, /account-timeline-step/);
    assert.match(core, /aria-current="step"/);
    assert.match(html, /js\/vendor\/qrcode-generator\.js/);
    assert.match(html, /js\/pages\/garantia-qr\.js/);
    assert.match(read("supabase/migrations/20261101000000_mi_garantia_comercial.sql"), /'comercial', v_comercial/);
});

test("el gestor ve el seguimiento y puede compartir el enlace del certificado", () => {
    const js = read("js/pages/gestor.js");

    assert.match(js, /promotor_pedido_historial/);
    assert.match(js, /promotor_garantia_pedido/);
    assert.match(js, /function loadOrderDetail/);
    assert.match(js, /showLink: true/);
    assert.match(js, /function renderOrderTimeline/);
    assert.match(js, /loadReceiptGuarantee/);
});

test("el comprobante incluye el QR de garantía cuando está activo", () => {
    const docs = read("js/pages/gestor-docs.js");
    const pdf = read("js/pages/gestor-pdf.js");

    assert.match(docs, /guaranteeToken/);
    assert.match(docs, /qrDataUrl/);
    assert.match(docs, /doc-guarantee/);
    assert.match(docs, /Certificado de garantía/);
    assert.match(pdf, /qrDataUrl/);
    assert.match(pdf, /CERTIFICADO DE GARANTÍA/);
});

test("el panel admin muestra solo el estado de la garantía", () => {
    const html = read("admin.html");

    assert.match(html, /garantia_activa/);
    assert.match(html, /Garantía QR/);
    assert.match(html, /Activa|activa/);
    assert.match(html, /Inactiva|inactiva/);
    assert.doesNotMatch(html, /promotor_garantia_pedido/);
});

test("el build publica la página y los estilos del certificado", () => {
    const pkg = JSON.parse(read("package.json"));
    const build = pkg.scripts["build:html"];

    assert.match(build, /garantia\.html/);
    assert.match(build, /garantia\.css/);
    assert.match(build, /js\/vendor/);
});
