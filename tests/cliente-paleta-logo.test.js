const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("la tienda usa la paleta del gestor sin perder contraste", () => {
    const css = read("volxen.css");

    assert.match(css, /--bg: #F8F7F4;/);
    assert.match(css, /--sf: #EAE6DE;/);
    assert.match(css, /--s2: #FFFDF9;/);
    assert.match(css, /--fg: #1E1D1B;/);
    assert.match(css, /--pf: #2E4A3F;/);
    assert.match(css, /--pf-hover: #233C32;/);
    assert.match(css, /--bd: rgba\(30,29,27,\.12\);/);
    assert.match(css, /--gl-focus: rgba\(46,74,63,\.28\);/);
    assert.doesNotMatch(css, /--pf: #1F4036;/);
    assert.doesNotMatch(css, /--pf-hover: #16332B;/);
});

test("la tienda usa el logo oficial en claro y su negativo en superficies oscuras", () => {
    const core = read("volxen-core.js");
    const home = read("index.html");
    const pkg = read("package.json");

    assert.match(core, /src="logo\.svg"/);
    assert.match(core, /src="logo-negativo\.svg"/);
    assert.doesNotMatch(core, /logo-light\.svg/);
    assert.match(home, /src="logo-negativo\.svg"/);
    assert.match(home, /"logo": "https:\/\/volxen\.com\/logo\.svg"/);
    assert.match(home, /<meta name="theme-color" content="#2E4A3F">/);
    assert.match(pkg, /logo\.svg logo-negativo\.svg/);
});
