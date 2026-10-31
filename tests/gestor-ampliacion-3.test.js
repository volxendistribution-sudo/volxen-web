const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("el panel usa el logo oficial y no bloquea el zoom", () => {
    const html = read("gestor.html");
    const css = read("gestor.css");

    assert.match(html, /viewport-fit=cover/);
    assert.doesNotMatch(html, /maximum-scale\s*=\s*1/);
    assert.match(html, /brand\/logo\.svg/);
    assert.match(html, /gs-state-logo/);
    assert.match(html, /gs-loading-brand/);
    assert.match(html, /id="gsProductChanges"/);
    assert.match(html, /id="gsNotificationsReadAll"/);
    assert.match(css, /touch-action:\s*pan-y/);
    assert.match(css, /font-size:\s*16px/);
    assert.match(css, /gs-change/);
});

test("las notificaciones de producto son reales y se pueden marcar como leídas", () => {
    const js = read("js/pages/gestor.js");

    assert.doesNotThrow(() => new Function(js));
    assert.match(js, /gestor_notificaciones_producto/);
    assert.match(js, /function loadProductChanges/);
    assert.match(js, /function markProductChangeRead/);
    assert.match(js, /function markAllProductChangesRead/);
    assert.match(js, /function adjustSavedPrices/);
    assert.match(js, /precio_anterior/);
    assert.match(js, /margen_anterior/);
    assert.match(js, /data-change-read/);
    assert.match(js, /productChanges/);
});

test("la tarjeta de producto es minimalista, oscura y usa el logo oficial", () => {
    const docs = read("js/pages/gestor-docs.js");

    assert.doesNotThrow(() => new Function(docs));
    assert.match(docs, /canvas\.width = 1440/);
    assert.match(docs, /canvas\.height = 1260/);
    assert.match(docs, /brand\/logo\.svg/);
    assert.match(docs, /brand\/logo-negativo\.svg/);
    assert.match(docs, /CATÁLOGO PRIVADO/);
    assert.match(docs, /PRECIO PÚBLICO/);
    assert.match(docs, /COMERCIAL VOLXEN/);
    assert.match(docs, /#1C1A17/);
    assert.doesNotMatch(docs, /COMPRA ASISTIDA/);
    assert.doesNotMatch(docs, /product\.description/);
    assert.doesNotMatch(docs, /new URL\("logo\.svg"/);
});

test("los PDFs incrustan las fuentes y el logo oficial", () => {
    const pdf = read("js/pages/gestor-pdf.js");

    assert.doesNotThrow(() => new Function(pdf));
    assert.match(pdf, /brand\/logo\.svg/);
    assert.match(pdf, /registerFonts/);
    assert.match(pdf, /DM-Sans-Regular\.ttf/);
    assert.match(pdf, /InterTight-Regular\.ttf/);
    assert.match(pdf, /addFileToVFS/);
    assert.match(pdf, /addFont/);
    assert.doesNotMatch(pdf, /new URL\("logo\.svg"/);
});

test("el build copia la marca y las fuentes TTF", () => {
    const pkg = JSON.parse(read("package.json"));

    assert.match(pkg.scripts["copy:fonts"], /\.ttf/);
    assert.match(pkg.scripts["copy:brand"], /brand/);
    assert.match(pkg.scripts.build, /copy:brand/);
});

test("el panel usa safe-area y altura dinámica en Android", () => {
    const css = read("gestor.css");

    assert.match(css, /100dvh/);
    assert.match(css, /env\(safe-area-inset-bottom\)/);
    assert.match(css, /scroll-padding-top/);
});

test("el panel activa el fondo oscuro y permite cambiarlo", () => {
    const html = read("gestor.html");
    const css = read("gestor.css");
    const js = read("js/pages/gestor-theme.js");

    assert.match(html, /data-gs-theme="dark"/);
    assert.match(html, /id="gsThemeToggle"/);
    assert.match(html, /js\/pages\/gestor-theme\.js/);
    assert.match(css, /:root\[data-gs-theme="dark"\]/);
    assert.match(css, /\[data-gs-theme="dark"\] body\.gs-body/);
    assert.match(js, /volxen-gs-theme/);
    assert.match(js, /gsThemeToggle/);
});

test("administración puede editar el margen máximo", () => {
    const admin = read("admin.html");

    assert.match(admin, /id="pmm"/);
    assert.match(admin, /margen_max_porcentaje/);
});
