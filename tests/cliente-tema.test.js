const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const PAGES = [
    "index.html",
    "catalogo.html",
    "producto.html",
    "carrito.html",
    "checkout.html",
    "pedidos.html",
    "consulta.html",
    "operadoras.html",
    "404.html"
];

test("las páginas de la tienda cargan el tema antes del CSS", () => {
    PAGES.forEach((page) => {
        const html = read(page);
        const theme = html.indexOf("js/pages/gestor-theme.js");
        const css = html.indexOf("dist/volxen.css");

        assert.notEqual(theme, -1, page + " no carga el tema");
        assert.notEqual(css, -1, page + " no carga volxen.css");
        assert.ok(theme < css, page + " debe cargar el tema antes del CSS");
    });
});

test("la cabecera del cliente incluye el interruptor sol/luna", () => {
    const core = read("volxen-core.js");

    assert.match(core, /id="gsThemeToggle"/);
    assert.match(core, /class="vx-theme-toggle"/);
    assert.match(core, /vx-theme-toggle-sun/);
    assert.match(core, /vx-theme-toggle-moon/);
    assert.match(core, /vx-theme-toggle-thumb/);
    assert.match(core, /aria-checked="false"/);
});

test("el tema oscuro del cliente usa la paleta del gestor sin tocar el gestor", () => {
    const css = read("volxen.css");

    assert.match(css, /html\[data-gs-theme="dark"\] body:not\(\.gs-body\)/);
    assert.match(css, /--bg: #12110F;/);
    assert.match(css, /--s2: #211E1A;/);
    assert.match(css, /--fg: #F4EFE5;/);
    assert.match(css, /--pf: #4C7A67;/);
    assert.match(css, /body:not\(\.gs-body\) img\[src="logo\.svg"\]/);
    assert.match(css, /content: url\("logo-negativo\.svg"\)/);
    assert.match(css, /body:not\(\.auth-page\):not\(\.g-page\):not\(\.gs-body\)/);
});
