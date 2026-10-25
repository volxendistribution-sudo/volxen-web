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
        let toggle = null;
        let layer = null;

        const fakeElement = () => ({
            hidden: false,
            textContent: "",
            tabIndex: 0,
            classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
            setAttribute: () => {},
            addEventListener: () => {},
            querySelector: () => null,
            querySelectorAll: () => [],
            focus: () => {}
        });

        const document = {
            readyState: "complete",
            body: {
                classList: {
                    contains: (name) => classes.has(name),
                    add: (name) => classes.add(name),
                    remove: (name) => classes.delete(name)
                },
                setAttribute: (name, value) => { attributes[name] = value; },
                insertAdjacentHTML: (position, html) => {
                    inserted += html;
                    toggle = fakeElement();
                    layer = fakeElement();
                }
            },
            getElementById: (id) => {
                if (id === "vxPromotorToggle") return toggle;
                if (id === "vxPromotorLayer") return layer;
                if (id === "vxpName") return fakeElement();
                return null;
            },
            addEventListener: () => {},
            activeElement: null
        };

        const context = {
            window: {
                VXAUTH: {
                    getSession: async () => session
                },
                requestAnimationFrame: (fn) => { fn(); return 1; }
            },
            document,
            fetch: () => { throw new Error("La tienda no debe consultar datos de comisión"); },
            console,
            setTimeout,
            clearTimeout,
            Promise
        };

        vm.createContext(context);
        vm.runInContext(read("js/pages/gestor-tienda.js"), context, { filename: "js/pages/gestor-tienda.js" });
        Promise.resolve(context.window.VXPromotorTienda.init()).then(() => {
            setTimeout(() => resolve({ classes, attributes, inserted }), 0);
        });
    });
}

test("la tienda activa el panel para gestores y promotores verificados", async () => {
    for (const role of ["gestor", "promotor"]) {
        const result = await runStoreMode({ user: { role, nombre: "Ana" } });
        assert.equal(result.classes.has("vx-promotor-mode"), true, "Debe activarse para " + role);
        assert.equal(result.attributes["data-promotor-mode"], "1");
        assert.match(result.inserted, /Panel de promotor/);
        assert.match(result.inserted, /id="vxPromotorToggle"/);
        assert.match(result.inserted, /id="vxPromotorLayer"/);
        assert.match(result.inserted, /data-vxp-tab="comisiones"/);
        assert.match(result.inserted, /data-vxp-tab="pedidos"/);
        assert.match(result.inserted, /data-vxp-tab="clientes"/);
        assert.match(result.inserted, /data-vxp-tab="pagos"/);
        assert.match(result.inserted, /data-vxp-tab="productos"/);
        assert.match(result.inserted, /data-vxp-tab="enlace"/);
        assert.match(result.inserted, /href="gestor\.html"/);
        assert.doesNotMatch(result.inserted, /Tienda en modo gestor/);
    }

    for (const role of ["cliente", "admin", ""]) {
        const result = await runStoreMode({ user: { role } });
        assert.equal(result.classes.has("vx-promotor-mode"), false, "No debe activarse para " + role);
        assert.equal(result.inserted, "", "No debe insertar interfaz para " + role);
    }

    const guest = await runStoreMode(null);
    assert.equal(guest.classes.has("vx-promotor-mode"), false);
    assert.equal(guest.inserted, "");
});

test("el panel del promotor usa VXAUTH y no toca carrito, checkout ni atribución", () => {
    const js = read("js/pages/gestor-tienda.js");
    const css = read("volxen.css");
    const core = read("volxen-core.js");
    const producto = read("js/pages/producto.js");
    const catalogo = read("js/pages/catalogo.js");

    assert.match(js, /VXAUTH\.getSession/);
    assert.match(js, /role === "gestor" \|\| role === "promotor"/);
    assert.match(js, /gestor\.html/);
    assert.match(js, /vxp-drawer/);
    assert.doesNotMatch(js, /vx-gestor|Tienda en modo gestor/);
    assert.doesNotMatch(js, /fetch\(|localStorage|sessionStorage|document\.cookie/);
    assert.doesNotMatch(js, /comision_porcentaje|comision_usd|total_usd|precio_usd|Math\.|Number\(/);
    assert.doesNotMatch(js, /URLSearchParams|location\.search|promotor_id|atribucion_id/);

    assert.match(producto, /data-promotor-commission/);
    assert.match(producto, /Fija o flexible/);
    assert.doesNotMatch(core, /pcd-commission/);
    assert.doesNotMatch(catalogo, /pcd-commission/);
    assert.match(css, /\.vx-promotor-mode \.pdp-commission/);
    assert.match(css, /\.vxp-toggle/);
    assert.match(css, /\.vxp-drawer/);
    assert.match(css, /\.vxp-layer/);

    for (const page of ["carrito.html", "checkout.html"]) {
        assert.doesNotMatch(read(page), /gestor-tienda\.js/, "El flujo de compra no debe cargar el panel del promotor");
    }
});

test("las páginas de tienda validan la sesión antes de mostrar el panel", () => {
    for (const page of ["index.html", "catalogo.html", "producto.html"]) {
        const html = read(page);
        const auth = html.indexOf('<script src="auth.js"></script>');
        const core = html.indexOf('<script src="volxen-core.js"></script>');
        const mode = html.indexOf('<script src="js/pages/gestor-tienda.js"></script>');

        assert.ok(auth !== -1, page + " debe cargar auth.js");
        assert.ok(core !== -1, page + " debe cargar volxen-core.js");
        assert.ok(mode !== -1, page + " debe cargar el panel del promotor");
        assert.ok(auth < core, page + " debe cargar auth.js antes del núcleo");
        assert.ok(core < mode, page + " debe cargar el panel del promotor después del núcleo");
    }
});
