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
        VOLXEN_CONFIG: { SUPABASE_URL: "https://test.supabase.co", SUPABASE_KEY: "test-key", WHATSAPP: "" },
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

test("VX.rec expone record, recent y forProduct", () => {
    const { win } = loadCore();
    assert.equal(typeof win.VX.rec, "object");
    assert.equal(typeof win.VX.rec.record, "function");
    assert.equal(typeof win.VX.rec.recent, "function");
    assert.equal(typeof win.VX.rec.forProduct, "function");
});

test("recRecord guarda términos y recRecent los devuelve ordenados", () => {
    const { win, storage } = loadCore();
    win.VX.rec.record("inversor solar", "client");
    win.VX.rec.record("panel", "client");
    win.VX.rec.record("inversor solar", "client"); // dup, se mueve al tope
    const recent = win.VX.rec.recent("client");
    assert.equal(JSON.stringify(recent), JSON.stringify(["inversor solar", "panel"]));
});

test("recRecord ignora términos vacíos o muy cortos", () => {
    const { win } = loadCore();
    win.VX.rec.record("", "client");
    win.VX.rec.record("a", "client");
    win.VX.rec.record("  ", "client");
    assert.equal(JSON.stringify(win.VX.rec.recent("client")), JSON.stringify([]));
});

test("recRecent respeta el tope de 12 términos", () => {
    const { win } = loadCore();
    for (let i = 0; i < 15; i++) win.VX.rec.record("term" + i, "client");
    const recent = win.VX.rec.recent("client");
    assert.equal(recent.length, 12);
    assert.equal(recent[0], "term14");
});

test("historial es independiente por scope", () => {
    const { win } = loadCore();
    win.VX.rec.record("inversor", "client");
    win.VX.rec.record("panel", "gestor");
    assert.equal(JSON.stringify(win.VX.rec.recent("client")), JSON.stringify(["inversor"]));
    assert.equal(JSON.stringify(win.VX.rec.recent("gestor")), JSON.stringify(["panel"]));
});

test("recForProduct devuelve un array y respeta el límite", async () => {
    const products = [
        { id: "p-1", nombre: "Inversor solar", descripcion: "Inversor 3000W", categoria_id: "c-1", disponibilidad: "disponible", imagenes: [], caracteristicas: [] },
        { id: "p-2", nombre: "Panel solar", descripcion: "Panel 400W", categoria_id: "c-1", disponibilidad: "disponible", imagenes: [], caracteristicas: [] },
        { id: "p-3", nombre: "Batería litio", descripcion: "Batería 100Ah", categoria_id: "c-2", disponibilidad: "disponible", imagenes: [], caracteristicas: [] },
        { id: "p-4", nombre: "Cable", descripcion: "Cable solar", categoria_id: "c-1", disponibilidad: "agotado", imagenes: [], caracteristicas: [] }
    ];
    const fetchImpl = async (url) => {
        const u = String(url);
        if (u.includes("/productos")) return { ok: true, json: async () => products };
        if (u.includes("/categorias")) return { ok: true, json: async () => [] };
        return { ok: true, json: async () => [] };
    };
    const { win } = loadCore({ fetchImpl });
    await win.VX.load();
    const recs = win.VX.rec.forProduct(products[0], "client", 3);
    assert.ok(Array.isArray(recs));
    assert.ok(recs.length <= 3);
    assert.ok(!recs.some((p) => p.id === "p-1")); // excluye el actual
    assert.ok(!recs.some((p) => p.disponibilidad === "agotado")); // excluye agotados
});
