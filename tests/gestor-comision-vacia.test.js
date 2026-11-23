const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/20261027174847_fase2_comision_vacia_sin_comision.sql"),
    "utf8"
);
const admin = fs.readFileSync(path.join(ROOT, "admin.html"), "utf8");
const gestor = fs.readFileSync(path.join(ROOT, "js/pages/gestor.js"), "utf8");

test("la comisión vacía normaliza el producto a precio flexible sin comisión", () => {
    assert.match(migration, /set modo_precio = 'sin_comision'/i);
    assert.match(migration, /comision_fija_usd = null/i);
    assert.match(migration, /modo_precio = 'sin_comision' and comision_fija_usd is null/i);
    assert.match(migration, /modo_precio = 'comision_fija' and comision_fija_usd is not null/i);
});

test("el admin guarda la comisión vacía como sin comisión fija", () => {
    assert.match(admin, /priceMode = "sin_comision"/);
    assert.match(admin, /Comisión que verá el gestor por unidad/);
    assert.match(admin, /Fijo \(requiere comisión; no puede subir\)/);
    assert.match(admin, /Para precio fijo sin comisión, escribe 0/);
    assert.doesNotMatch(admin, /comisión automática/i);
    assert.doesNotMatch(gestor, /comisión automática/i);
});
