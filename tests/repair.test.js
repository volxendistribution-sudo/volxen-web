const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

function makeStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: (key) => data.delete(key),
        _data: data
    };
}

function makeDocument() {
    return {
        body: { dataset: { page: "index" }, style: {} },
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        createElement: () => ({
            style: {},
            classList: { add: () => {}, remove: () => {} },
            appendChild: () => {},
            remove: () => {},
            addEventListener: () => {}
        }),
        head: { appendChild: () => {} }
    };
}

function loadCore(options = {}) {
    const storage = options.storage || makeStorage();
    const fetchImpl = options.fetchImpl || (async () => ({ ok: true, json: async () => [] }));
    const win = {
        VOLXEN_CONFIG: {
            SUPABASE_URL: "https://test.supabase.co",
            SUPABASE_KEY: "test-key",
            WHATSAPP: ""
        },
        fetch: fetchImpl,
        addEventListener: () => {}
    };
    const document = makeDocument();
    const sandbox = {
        window: win,
        document,
        localStorage: storage,
        fetch: fetchImpl,
        URL,
        URLSearchParams,
        setTimeout,
        clearTimeout,
        console,
        CustomEvent: class {},
        Date,
        Math,
        Promise,
        Array,
        Object,
        String,
        Number,
        Error,
        RegExp
    };
    win.document = document;
    win.localStorage = storage;
    vm.createContext(sandbox);
    vm.runInContext(read("volxen-core.js"), sandbox, { filename: "volxen-core.js" });
    return { win, sandbox, document, storage };
}

function loadPageModule(file, sandbox) {
    const code = read(file).replace(/^export /gm, "");
    vm.runInContext(code, sandbox, { filename: file });
}

test("el inicio expone window.initIndex", () => {
    const { win, sandbox } = loadCore();
    loadPageModule("js/pages/index.js", sandbox);

    assert.equal(typeof win.initIndex, "function");
    assert.equal(win.initIndex, win.initHome);
});

test("imgUrl usa el endpoint de render y se exporta en VX", () => {
    const { win } = loadCore();

    assert.equal(typeof win.VX.imgUrl, "function");

    const result = win.VX.imgUrl(
        "https://abc.supabase.co/storage/v1/object/public/productos/foto.webp",
        { w: 400, h: 300, format: "webp", quality: 85 }
    );
    const url = new URL(result);

    assert.equal(url.pathname, "/storage/v1/render/image/public/productos/foto.webp");
    assert.equal(url.searchParams.get("width"), "400");
    assert.equal(url.searchParams.get("height"), "300");
    assert.equal(url.searchParams.get("format"), "webp");
    assert.equal(url.searchParams.get("quality"), "85");
    assert.equal(url.searchParams.get("resize"), "contain");
    assert.equal(win.VX.imgUrl("https://example.com/foto.jpg", { w: 100 }), "https://example.com/foto.jpg");
});

test("el checkout expone updateStepper y pedido.js lo llama de forma segura", () => {
    const { win, sandbox } = loadCore();
    loadPageModule("js/pages/checkout.js", sandbox);

    assert.equal(typeof win.updateStepper, "function");
    assert.match(read("pedido.js"), /typeof updateStepper\s*===\s*["']function["']/);
});

test("load elimina del carrito los productos que ya no existen", async () => {
    const storage = makeStorage({
        vx_k: JSON.stringify({ "producto-eliminado": 2, "producto-1": 1 })
    });
    const fetchImpl = async (url) => {
        const target = String(url);
        if (target.includes("/categorias")) return { ok: true, json: async () => [] };
        if (target.includes("/productos")) {
            return {
                ok: true,
                json: async () => [{
                    id: "producto-1",
                    nombre: "Producto de prueba",
                    precio_usd: 10,
                    disponibilidad: "disponible",
                    categoria_id: "categoria-1"
                }]
            };
        }
        return { ok: true, json: async () => [] };
    };
    const { win, storage: outputStorage } = loadCore({ storage, fetchImpl });

    await win.VX.load();

    assert.deepEqual({ ...win.VX.getK() }, { "producto-1": 1 });
    assert.deepEqual(JSON.parse(outputStorage._data.get("vx_k")), { "producto-1": 1 });
});

test("el wordmark VOLXEN tiene estilos definidos", () => {
    const css = read("volxen.css");

    assert.match(css, /\.logo-wm[\s,{]/);
    assert.match(css, /\.logo-wm-claro/);
    assert.match(css, /content:\s*["']VOLXEN["']/);
});

test("el build incluye la generación de un dist autocontenido", () => {
    const pkg = JSON.parse(read("package.json"));

    assert.equal(typeof pkg.scripts["build:html"], "string");
    assert.match(pkg.scripts.build, /build:html/);
    assert.equal(pkg.scripts.test, "node --test");
});

test("la ficha de producto muestra el envío configurado y usa dots", () => {
    const js = read("js/pages/producto.js");

    assert.match(js, /shipping_type === "paid"/);
    assert.match(js, /Envío: \+US\$/);
    assert.match(js, /Envío gratis/);
    assert.match(js, /Envío por costo adicional/);
    assert.match(js, /pdp-dot/);
});

test("el admin permite el costo de envío opcional", () => {
    const admin = read("admin.html");

    assert.match(admin, /id="st"/);
    assert.match(admin, /id="sc"/);
    assert.match(admin, /Costo de envío \(USD\) <span[^>]*>\(opcional\)<\/span>/);
    assert.match(admin, /sc\.required = false/);
    assert.doesNotMatch(admin, /Indique un costo de envío/);
    assert.match(admin, /shipping_type:/);
    assert.match(admin, /shipping_cost:/);
});

test("la migración permite envío pagado sin monto", () => {
    const sql = read("supabase/migrations/20261021_add_product_shipping.sql");

    assert.match(sql, /shipping_type text not null default 'free'/);
    assert.match(sql, /shipping_cost numeric/);
    assert.match(sql, /shipping_type in \('free', 'paid'\)/);
    assert.match(sql, /shipping_cost is null or shipping_cost > 0/);
});

test("las imágenes se muestran completas y sin recorte", () => {
    const css = read("volxen.css");

    assert.match(css, /\.pdp-img[\s\S]*?object-fit:\s*contain/);
    assert.match(css, /\.cart-thumb[\s\S]*?object-fit:\s*contain/);
    assert.doesNotMatch(css, /object-fit:\s*cover/);
});

test("el icono de operadoras es un SVG reutilizable", () => {
    const core = read("volxen-core.js");
    const html = ["index.html", "carrito.html", "checkout.html", "catalogo.html"]
        .map(read)
        .join("\n");

    assert.match(core, /function opIcon\(size, cls\)/);
    assert.match(core, /viewBox="0 0 64 64"/);
    assert.match(core, /hydrateOpIcons/);
    assert.doesNotMatch(html, /fa-headset/);
});

test("Fase 2: escala tipográfica 24/16/14/16/12", () => {
    const css = read("volxen.css");

    assert.match(css, /--fs-title:\s*1\.5rem/);
    assert.match(css, /--fs-subtitle:\s*1rem/);
    assert.match(css, /--fs-body:\s*0\.875rem/);
    assert.match(css, /--fs-input:\s*1rem/);
    assert.match(css, /--fs-help:\s*0\.75rem/);
    assert.match(css, /h1\s*\{[\s\S]*?font-size:\s*var\(--fs-title\)/);
    assert.match(css, /h2,\s*h3\s*\{[\s\S]*?font-size:\s*var\(--fs-subtitle\)/);
    assert.match(css, /\.hero-title[\s\S]*?font-size:\s*var\(--fs-title\)/);
    assert.match(css, /\.pdp-title[\s\S]*?font-size:\s*var\(--fs-title\)/);
});

test("Fase 2: tarjetas 24, campos 48/12 y botones píldora", () => {
    const css = read("volxen.css");

    assert.match(css, /--radius-field:\s*0\.75rem/);
    assert.match(css, /--radius-card:\s*1\.5rem/);
    assert.match(css, /--radius-pill:\s*999px/);
    assert.match(css, /--control-h:\s*3rem/);
    assert.match(css, /\.card-product\s*\{[\s\S]*?border-radius:\s*var\(--radius-card\)/);
    assert.match(css, /\.input-base\s*\{[\s\S]*?min-height:\s*var\(--control-h\)[\s\S]*?border-radius:\s*var\(--radius-field\)[\s\S]*?font-size:\s*var\(--fs-input\)/);
    assert.match(css, /\.btn-primary\s*\{[\s\S]*?border-radius:\s*var\(--radius-pill\)/);
    assert.match(css, /\.btn-secondary\s*\{[\s\S]*?border-radius:\s*var\(--radius-pill\)/);
    assert.match(css, /\.pdp-buy[\s\S]*?border-radius:\s*var\(--radius-pill\)/);
});

test("Fase 2: no quedan textos de 9, 10 u 11 píxeles", () => {
    const files = [
        "volxen.css",
        "admin.html",
        "volxen-core.js",
        "pedido.js",
        "index.html",
        "catalogo.html",
        "producto.html",
        "carrito.html",
        "checkout.html",
        "pedidos.html",
        "404.html",
        "js/pages/index.js",
        "js/pages/catalogo.js",
        "js/pages/producto.js",
        "js/pages/carrito.js",
        "js/pages/checkout.js",
        "js/pages/pedidos.js",
        "consulta.html",
        "js/pages/consulta.js",
        "operadoras.html",
        "js/pages/operadoras.js"
    ];

    files.forEach((file) => {
        const src = read(file);
        assert.doesNotMatch(src, /text-\[(?:9|10|11)px\]/, file);
        assert.doesNotMatch(src, /font-size:\s*(?:9|10|11)px/, file);
        assert.doesNotMatch(src, /font:\s*[^;{}]*?\b(?:9|10|11)px\b/, file);
    });
});

test("Fase 2: el admin usa modal accesible en vez de confirm()", () => {
    const admin = read("admin.html");

    assert.match(admin, /<dialog id="dlg"[^>]*aria-labelledby="dlgt"/);
    assert.match(admin, /function askDelete\(texto\)/);
    assert.match(admin, /await askDelete\(/);
    assert.doesNotMatch(admin, /if\s*\(\s*!confirm\(/);
    assert.match(admin, /\.dlg-a\s*\{[\s\S]*?display:\s*flex/);

    const dialogBlock = admin.match(/#dlg\s*\{[\s\S]*?\}/)[0];
    assert.match(dialogBlock, /width:\s*340px/);
    assert.match(dialogBlock, /border-radius:\s*var\(--radius-card\)/);
});

test("Fase 3: cabecera con Mi cuenta, búsqueda única y acceso Catálogo", () => {
    const core = read("volxen-core.js");

    assert.match(core, /function minimalHeader\(\)/);
    assert.match(core, /dataset\.shell === "minimal"/);
    assert.match(core, /href="pedidos.html"[^>]*aria-label="Mi cuenta"/);
    assert.match(core, /\[\{ id: "", nombre: "Catálogo" \}\]/);
    assert.match(core, /href="consulta\.html"[^>]*>[\s\S]*?Consulta general/);
    assert.doesNotMatch(core, /searchMobileInput/);
    assert.doesNotMatch(core, /id="cqv"/);
    assert.doesNotMatch(core, /function consultas\(\)/);
});

test("Fase 3: seguimiento con estados canónicos y consulta pública", async () => {
    const core = read("volxen-core.js");
    assert.match(core, /const estadoLargo = e =>/);
    assert.match(core, /Pedido recibido/);
    assert.match(core, /Confirmando pedido/);
    assert.match(core, /Preparando pedido/);
    assert.match(core, /Hablar con una operadora/);
    assert.match(core, /async function consultarPedido\(c, t\)/);
    assert.match(core, /consultarPedido, estadoLargo/);

    const { win, storage } = loadCore({
        fetchImpl: async () => ({
            ok: true,
            clone() { return this; },
            json: async () => ({
                codigo: "VX-2026-000001",
                estado: "confirmado",
                nombre_cliente: "Ana",
                total_usd: 10,
                pedido_items: [{ producto_nombre: "Producto", cantidad: 1, subtotal: 10 }],
                pedido_historial: [
                    { estado: "pendiente", created_at: "2026-10-20T10:00:00Z" },
                    { estado: "confirmado", created_at: "2026-10-21T10:00:00Z" }
                ]
            })
        })
    });

    assert.equal(win.VX.estadoLargo("pendiente"), "Pedido recibido");
    assert.equal(win.VX.estadoLargo("confirmado"), "Confirmando pedido");
    assert.equal(win.VX.estadoLargo("preparando"), "Preparando pedido");
    assert.equal(win.VX.estadoLargo("en_camino"), "En camino");
    assert.equal(win.VX.estadoLargo("entregado"), "Entregado");
    assert.equal(win.VX.estadoLargo("cancelado"), "Cancelado");

    const order = await win.VX.consultarPedido(" vx-2026-000001 ", "token");
    assert.equal(order.c, "VX-2026-000001");
    assert.match(storage._data.get("vx_pedidos"), /VX-2026-000001/);
});

test("Fase 3: catálogo con ofertas, categorías y productos filtrables", () => {
    const html = read("catalogo.html");
    const js = read("js/pages/catalogo.js");

    assert.match(html, />Catálogo</);
    assert.match(html, /id="offersRow"/);
    assert.match(html, /id="categoryGrid"/);
    assert.match(html, /id="productos"/);
    assert.match(js, /function renderOfertas\(\)/);
    assert.match(js, /function renderCategorias\(\)/);
    assert.match(js, /c\.imagen/);
    assert.match(js, /scrollIntoView/);
    assert.doesNotMatch(js, /searchMobileInput/);
});

test("Fase 3: Mis pedidos es una página independiente con formulario y resultado", () => {
    const html = read("pedidos.html");
    const js = read("js/pages/pedidos.js");

    assert.match(html, /data-shell="minimal"/);
    assert.match(html, /id="trackForm"/);
    assert.match(html, /id="tc"/);
    assert.match(html, /id="tt"/);
    assert.match(html, /id="trackResult"/);
    assert.match(js, /VX\.consultarPedido/);
    assert.doesNotMatch(js, /trackLista/);
});

test("Fase 3: consulta general e incidencias con cuatro tipos", () => {
    const html = read("consulta.html");
    const js = read("js/pages/consulta.js");

    assert.match(html, /data-shell="minimal"/);
    assert.match(html, /id="cnombre"/);
    assert.match(html, /id="ct"/);
    assert.match(html, /id="ce"/);
    assert.match(html, /value="consulta"/);
    assert.match(html, /value="incidencia"/);
    assert.match(html, /value="queja"/);
    assert.match(html, /value="opinion"/);
    assert.match(html, /id="cp"/);
    assert.match(html, /id="cm"/);
    assert.match(js, /registrar_consulta_v2/);
    assert.match(js, /registrar_consulta"/);
    assert.match(js, /tel \+ " · " \+ email/);
});

test("Fase 3: admin sube imagen de categoría y filtra quejas/opiniones", () => {
    const admin = read("admin.html");

    assert.match(admin, /id="cf"/);
    assert.match(admin, /function catUpload\(file\)/);
    assert.match(admin, /async function setCImg\(id\)/);
    assert.match(admin, /queja:"Queja"/);
    assert.match(admin, /opinion:"Opinión"/);
    assert.match(admin, /split\("·"\)/);
});

test("Fase 3: estilos de formulario, ofertas, categorías y seguimiento", () => {
    const css = read("volxen.css");

    assert.match(css, /\.form-card\s*\{[\s\S]*?border-radius:\s*var\(--radius-card\)/);
    assert.match(css, /\.form-actions\s*\{[\s\S]*?display:\s*flex/);
    assert.match(css, /\.offers-row\s*\{[\s\S]*?overflow-x:\s*auto/);
    assert.match(css, /\.category-grid\s*\{[\s\S]*?display:\s*grid/);
    assert.match(css, /\.track-action\s*\{[\s\S]*?min-height:\s*var\(--control-h\)/);
});

test("Fase 3: migración de imagen, tipos y RPC de consulta", () => {
    const sql = read("supabase/migrations/20261021_fase3_catalogo_consultas.sql");

    assert.match(sql, /ADD COLUMN IF NOT EXISTS imagen text/);
    assert.match(sql, /'consulta', 'incidencia', 'queja', 'opinion'/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.registrar_consulta_v2/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.registrar_consulta_v2/);
    assert.match(sql, /attname = 'codigo'/);
    assert.match(sql, /'nueva'/);
});

test("Fase 3: build y módulos incluyen consulta.html", () => {
    const pkg = JSON.parse(read("package.json"));
    const main = read("js/main.js");

    assert.match(pkg.scripts["build:html"], /consulta\.html/);
    assert.match(main, /'consulta': 'consulta'/);
});


test("Fase 4: operadoras dinámicas desde Supabase y enlace del pie", async () => {
    const core = read("volxen-core.js");

    assert.match(core, /async function loadOperadoras\(\)/);
    assert.match(core, /operadoras\?activa=eq\.true&order=orden/);
    assert.match(core, /Escribir por WhatsApp/);
    assert.match(core, /Horario por confirmar/);
    assert.match(core, /Hablar con una operadora/);
    assert.match(core, /href="operadoras\.html"/);
    assert.doesNotMatch(core, /\["Operadora 1", "5 6581114"/);

    const { win } = loadCore({
        fetchImpl: async () => ({
            ok: true,
            json: async () => [{
                id: "op-1",
                nombre: "Operadora 1",
                whatsapp: "5356581114",
                horario: "",
                disponible: true,
                activa: true,
                orden: 1
            }]
        })
    });

    assert.equal(typeof win.VX.loadOperadoras, "function");
    assert.equal(typeof win.VX.renderOperadoras, "function");
    const ops = await win.VX.loadOperadoras();
    assert.equal(ops.length, 1);
    assert.equal(ops[0].whatsapp, "5356581114");
});

test("Fase 4: página independiente de operadoras", () => {
    const html = read("operadoras.html");
    const js = read("js/pages/operadoras.js");

    assert.match(html, /data-page="operadoras"/);
    assert.match(html, /id="opsPageGrid"/);
    assert.match(html, />Operadoras</);
    assert.match(js, /export async function initOperadoras/);
    assert.match(js, /VX\.renderOperadoras/);
    assert.match(js, /data-ops-retry/);
});

test("Fase 4: admin con pestaña y CRUD de operadoras", () => {
    const admin = read("admin.html");

    assert.match(admin, /onclick="tab\('w'\)"/);
    assert.match(admin, /function opsAdmin\(/);
    assert.match(admin, /async function opsCargar\(/);
    assert.match(admin, /async function opSave\(/);
    assert.match(admin, /async function opToggle\(/);
    assert.match(admin, /async function opDelete\(/);
    assert.match(admin, /askDeleteCon\(/);
    assert.match(admin, /class="admin-form"/);
    assert.match(admin, /id="opForm"/);
    assert.match(admin, /id="opw"/);
    assert.match(admin, /id="opd"/);
    assert.match(admin, /id="opa"/);
});

test("Fase 4: migración de operadoras con RLS y carga inicial", () => {
    const sql = read("supabase/migrations/20261021_fase4_operadoras.sql");

    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.operadoras/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /operadoras_lectura_publica/);
    assert.match(sql, /USING \(activa = true\)/);
    assert.match(sql, /TO authenticated/);
    ["5356581114", "5356193681", "5352405395", "5363990666", "5352842030", "5355500209"].forEach(n => {
        assert.match(sql, new RegExp(n));
    });
    assert.match(sql, /WHERE NOT EXISTS \(SELECT 1 FROM public\.operadoras\)/);
});

test("Fase 4: build, módulo y sitemap incluyen operadoras.html", () => {
    const pkg = JSON.parse(read("package.json"));
    const main = read("js/main.js");
    const sitemap = read("sitemap.xml");

    assert.match(pkg.scripts["build:html"], /operadoras\.html/);
    assert.match(main, /'operadoras': 'operadoras'/);
    assert.match(sitemap, /operadoras\.html/);
});
