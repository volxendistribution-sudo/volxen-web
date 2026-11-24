const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("la ficha permite guardar el precio propio y volver al precio base", () => {
    const html = read("gestor.html");
    const js = read("js/pages/gestor.js");
    const css = read("gestor.css");

    assert.match(html, /id="gsProductPriceSave"/);
    assert.match(html, /id="gsProductPriceBase"/);
    assert.match(html, /id="gsProductPriceStatus"/);
    assert.match(js, /"gsProductPriceSave", "gsProductPriceBase", "gsProductPriceStatus"/);
    assert.match(js, /refs\.gsProductPriceSave\.addEventListener\("click"/);
    assert.match(js, /refs\.gsProductPriceBase\.addEventListener\("click"/);
    assert.match(css, /\.gs-product-price-row/);
    assert.match(css, /\.gs-product-price-button/);
    assert.match(css, /\.gs-product-price-status/);
});

test("el precio guardado se carga y se reutiliza al abrir la ficha y al añadir al carrito", () => {
    const js = read("js/pages/gestor.js");

    assert.match(js, /managerPrices: \{\}/);
    assert.match(js, /function managerPriceInfo\(product\)/);
    assert.match(js, /function managerPriceForOutput\(product\)/);
    assert.match(js, /async function loadManagerPrices\(\)/);
    assert.match(js, /async function saveManagerPrice\(productId, value\)/);
    assert.match(js, /\/gestor_precio_guardado\?select=producto_id,precio_usd,updated_at&gestor_id=eq\./);
    assert.match(js, /\/gestor_precio_guardado\?on_conflict=gestor_id,producto_id/);
    assert.match(js, /resolution=merge-duplicates/);
    assert.match(js, /await loadManagerPrices\(\)/);
    assert.match(js, /priceInfo\.saved && priceInfo\.storedPrice != null/);
    assert.match(js, /const savedPrice = managerPriceForOutput\(product\)/);
});

test("un precio guardado inválido no se sustituye en silencio por el precio base", () => {
    const js = read("js/pages/gestor.js");

    assert.match(js, /info\.outdated/);
    assert.match(js, /El precio guardado ya no es válido/);
    assert.match(js, /openProductDialog\(product\.id\)/);
    assert.match(js, /return false/);
});

test("el guardado envía el gestor autenticado y no cambia la firma del generador de imagen", () => {
    const js = read("js/pages/gestor.js");
    const docs = read("js/pages/gestor-docs.js");

    assert.match(js, /gestor_id: uid/);
    assert.match(js, /producto_id: product\.id/);
    assert.match(js, /precio_usd: amount/);
    assert.match(docs, /function productImageBlob\(product, managerName\)/);
    assert.doesNotMatch(js, /productImageBlob\([^)]*managerPriceInfo/);
});

test("el catálogo PDF, la imagen y la tarjeta usan el precio guardado", () => {
    const js = read("js/pages/gestor.js");
    const core = read("volxen-core.js");

    assert.match(js, /function managerOutputPrice\(product\)/);
    assert.match(js, /price: output\.price/);
    assert.match(js, /shareFile\(result\.blob, filename, "Producto VOLXEN", "Producto " \+ \(product\.nombre \|\| ""\) \+ " · Precio " \+ money\(output\.price\)\)/);
    assert.match(js, /api\.pcard\(product, \{ buy: true, price: managerPriceForOutput\(product\) \}\)/);
    assert.match(core, /opts\.price != null && Number\.isFinite\(Number\(opts\.price\)\)/);
});

test("un precio guardado inválido bloquea el catálogo PDF y la imagen", () => {
    const js = read("js/pages/gestor.js");

    assert.match(js, /if \(output\.blocked\)/);
    assert.match(js, /blockedMessage = blockedMessage \|\| output\.reason/);
    assert.match(js, /setNotice\(blockedMessage, true\)/);
    assert.match(js, /setNotice\(output\.reason, true\)/);
    assert.match(js, /openProductDialog\(product\.id\)/);
});
