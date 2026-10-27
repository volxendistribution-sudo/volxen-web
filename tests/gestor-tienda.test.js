const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

function runRedirect(session, pathname = "/catalogo.html") {
    return new Promise((resolve, reject) => {
        const redirects = [];
        const document = {
            readyState: "complete",
            addEventListener: () => {}
        };
        const context = {
            window: {
                VXAUTH: {
                    getSession: async () => session
                },
                location: {
                    pathname,
                    replace: (target) => redirects.push(target)
                }
            },
            document,
            console,
            setTimeout,
            clearTimeout,
            Promise
        };

        vm.createContext(context);
        vm.runInContext(read("js/pages/gestor-tienda.js"), context, { filename: "js/pages/gestor-tienda.js" });
        Promise.resolve(context.window.VXGestorRedirect.init()).then(() => resolve(redirects)).catch(reject);
    });
}

test("los gestores y promotores vuelven automáticamente a su panel", async () => {
    for (const role of ["gestor", "promotor"]) {
        const redirects = await runRedirect({ user: { id: "u1", role, nombre: "Ana" } });
        assert.deepEqual(redirects, ["gestor.html"], "Debe redirigir a " + role);
    }

    for (const role of ["cliente", "admin", ""]) {
        const redirects = await runRedirect({ user: { role } });
        assert.deepEqual(redirects, [], "No debe redirigir a " + role);
    }

    assert.deepEqual(await runRedirect(null), []);
    assert.deepEqual(await runRedirect({ user: { role: "promotor" } }, "/gestor.html"), []);
});

test("el redirect no introduce datos ni interfaz duplicada", () => {
    const js = read("js/pages/gestor-tienda.js");
    const css = read("volxen.css");

    assert.match(js, /role === "gestor" \|\| role === "promotor"/);
    assert.match(js, /window\.location\.replace\("gestor\.html"\)/);
    assert.doesNotMatch(js, /VXPromotorMenu|VXPromotorTienda|data-vxp|vxp-menu|vxPromotorToggle|vxp-toggle|xhr|localStorage|sessionStorage|document\.cookie/);
    assert.doesNotMatch(css, /\.vxp-/);
});

test("todas las páginas de la tienda validan la sesión y cargan el redirect", () => {
    const pages = [
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

    for (const page of pages) {
        const html = read(page);
        const auth = html.indexOf('<script src="auth.js"></script>');
        const core = html.indexOf('<script src="volxen-core.js"></script>');
        const redirect = html.indexOf('<script src="js/pages/gestor-tienda.js"></script>');

        assert.ok(auth !== -1, page + " debe cargar auth.js");
        assert.ok(core !== -1, page + " debe cargar volxen-core.js");
        assert.ok(redirect !== -1, page + " debe cargar el redirect de gestor");
        assert.ok(auth < core, page + " debe cargar auth.js antes del núcleo");
        assert.ok(core < redirect, page + " debe cargar el redirect después del núcleo");
    }
});
