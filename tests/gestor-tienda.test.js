const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

function runStoreMode(session) {
    return new Promise((resolve) => {
        const classes = new Set();
        const attributes = {};
        let inserted = "";

        const document = {
            readyState: "complete",
            body: {
                classList: {
                    contains: (name) => classes.has(name),
                    add: (name) => classes.add(name)
                },
                setAttribute: (name, value) => { attributes[name] = value; }
            },
            getElementById: (id) => {
                if (id === "main") {
                    return {
                        insertAdjacentHTML: (position, html) => { inserted += html; }
                    };
                }
                if (id === "vxGestorBar") {
                    return inserted.indexOf('id="vxGestorBar"') !== -1 ? {} : null;
                }
                return null;
            },
            addEventListener: () => {}
        };

        const context = {
            window: {
                VXAUTH: {
                    getSession: async () => session
                }
            },
            document,
            fetch: () => { throw new Error("La tienda no debe consultar datos de comisión"); },
            console,
            setTimeout,
            Promise
        };

        vm.createContext(context);
        vm.runInContext(read("js/pages/gestor-tienda.js"), context, { filename: "js/pages/gestor-tienda.js" });
        setTimeout(() => resolve({ classes, attributes, inserted }), 0);
    });
}

test("la tienda activa el modo gestor solo para el rol gestor verificado", async () => {
    const gestor = await runStoreMode({ user: { role: "gestor" } });
    assert.equal(gestor.classes.has("vx-gestor-mode"), true);
    assert.equal(gestor.attributes["data-gestor-mode"], "1");
    assert.match(gestor.inserted, /Tienda en modo gestor/);
    assert.match(gestor.inserted, /Tu comisión/);
    assert.match(gestor.inserted, /href="gestor\.html"/);

    for (const role of ["cliente", "promotor", "admin", ""]) {
        const result = await runStoreMode({ user: { role } });
        assert.equal(result.classes.has("vx-gestor-mode"), false, "No debe activarse para " + role);
        assert.equal(result.inserted, "", "No debe insertar interfaz para " + role);
    }

    const guest = await runStoreMode(null);
    assert.equal(guest.classes.has("vx-gestor-mode"), false);
    assert.equal(guest.inserted, "");
});

test("el modo gestor usa VXAUTH y no toca carrito, checkout ni atribución", () => {
    const js = read("js/pages/gestor-tienda.js");
    const css = read("volxen.css");
    const core = read("volxen-core.js");
    const producto = read("js/pages/producto.js");
    const catalogo = read("js/pages/catalogo.js");

    assert.match(js, /VXAUTH\.getSession/);
    assert.match(js, /role === "gestor"/);
    assert.match(js, /gestor\.html/);
    assert.doesNotMatch(js, /promotor/);
    assert.doesNotMatch(js, /fetch\(|localStorage|sessionStorage|document\.cookie/);
    assert.doesNotMatch(js, /comision_porcentaje|comision_usd|total_usd|precio_usd|Math\.|Number\(/);
    assert.doesNotMatch(js, /URLSearchParams|[?&]gestor|atribuci/i);

    assert.match(core, /data-gestor-commission/);
    assert.match(core, /data-gestor-commission-value/);
    assert.match(producto, /pdp-commission/);
    assert.match(producto, /data-gestor-commission-value/);
    assert.match(catalogo, /pcd-commission/);
    assert.match(css, /\.vx-gestor-mode \.pcd-commission/);
    assert.match(css, /\.vx-gestor-mode \.pdp-commission/);

    for (const page of ["carrito.html", "checkout.html"]) {
        assert.doesNotMatch(read(page), /gestor-tienda\.js/, "El flujo de compra no debe cargar el modo gestor");
    }
});

test("las páginas de tienda validan la sesión antes de mostrar el modo gestor", () => {
    for (const page of ["index.html", "catalogo.html", "producto.html"]) {
        const html = read(page);
        const auth = html.indexOf('<script src="auth.js"></script>');
        const core = html.indexOf('<script src="volxen-core.js"></script>');
        const mode = html.indexOf('<script src="js/pages/gestor-tienda.js"></script>');

        assert.ok(auth !== -1, page + " debe cargar auth.js");
        assert.ok(core !== -1, page + " debe cargar volxen-core.js");
        assert.ok(mode !== -1, page + " debe cargar el modo gestor");
        assert.ok(auth < core, page + " debe cargar auth.js antes del núcleo");
        assert.ok(core < mode, page + " debe cargar el modo gestor después del núcleo");
    }
});
