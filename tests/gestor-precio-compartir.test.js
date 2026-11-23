const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("gestor.js compila y conserva shareProductImage sin tocar productImageBlob", () => {
    const js = read("js/pages/gestor.js");
    assert.doesNotThrow(() => new Function(js));
    assert.match(js, /function shareProductImage/);
    assert.match(js, /function managerPriceForShare/);
    assert.match(js, /async function managerPriceLoad/);
    assert.match(js, /async function managerPriceSave/);
    // shareProductImage pasa el precio del gestor al generador (solo la llamada, no el generador).
    assert.match(js, /price:\s*managerPriceForShare\(product\)/);
    // productImageBlob no se modifica: sigue leyendo product.price y sin parámetro price extra.
    const docs = read("js/pages/gestor-docs.js");
    assert.match(docs, /async function productImageBlob\(product, managerName\)/);
    assert.match(docs, /var priceText = priceLabel\(product.price\);/);
    assert.doesNotMatch(docs, /async function productImageBlob\(product, managerName, price\)/);
});

test("panel del gestor incluye campo y botón de precio para compartir", () => {
    const html = read("gestor.html");
    assert.match(html, /id="gsProductSharePriceWrap"/);
    assert.match(html, /id="gsProductSharePrice"/);
    assert.match(html, /id="gsProductSharePriceSave"/);
    assert.match(html, /id="gsProductSharePriceError"/);
    assert.match(html, /role="alert" aria-live="assertive"/);
});

test("gestor.css define el nuevo campo de precio para compartir", () => {
    const css = read("gestor.css");
    assert.match(css, /\.gs-product-share-price\s*\{/);
    assert.match(css, /\.gs-product-share-price input\s*\{\s*[\s\S]*?min-height:\s*44px/);
    assert.match(css, /\.gs-product-share-price-error/);
    assert.match(css, /\[data-gs-theme="dark"\] .gs-product-share-price input/);
});

test("la imagen sin precio del gestor queda idéntica a hoy (regresión de priceLabel)", () => {
    const docs = read("js/pages/gestor-docs.js");
    const m = docs.match(/function priceLabel\(value\)[\s\S]*?\n    \}/);
    assert.ok(m, "Falta priceLabel");
    const fn = new Function("return " + m[0].replace(/^function priceLabel\(value\)/, "function priceLabel(value)"))();
    assert.equal(fn(120), "120 USD");
    assert.equal(fn(120.5), "120.50 USD");
    assert.equal(fn(undefined), "—");
    assert.equal(fn(NaN), "—");
});
