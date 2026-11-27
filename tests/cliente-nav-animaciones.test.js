const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("la barra de navegación anima sin perder accesibilidad", () => {
    const css = read("volxen.css");
    const core = read("volxen-core.js");

    assert.match(css, /#hd\s*\{[^}]*animation:\s*headerIn/);
    assert.match(css, /#hd\.sc\s*\{[^}]*box-shadow/);
    assert.match(css, /#cn\.nav-enter \.nav-chip\s*\{[^}]*animation:\s*navChipIn/);
    assert.match(css, /\.nav-chip:hover::after/);
    assert.match(css, /\.badge-bump\s*\{[^}]*animation:\s*badgeBump/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(core, /style="--chip-i:' \+ i/);
    assert.match(core, /classList\.add\("badge-bump"\)/);
});
