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
