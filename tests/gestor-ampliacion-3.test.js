const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("el panel usa el logo oficial y no bloquea el zoom", () => {
    const html = read("gestor.html");
    const css = read("gestor.css");

    assert.match(html, /viewport-fit=cover/);
    assert.doesNotMatch(html, /maximum-scale\s*=\s*1/);
    assert.match(html, /brand\/logo\.svg/);
    assert.match(html, /gs-state-logo/);
    assert.match(html, /gs-loading-brand/);
    assert.match(html, /id="gsProductChanges"/);
    assert.match(html, /id="gsNotificationsReadAll"/);
    assert.match(css, /touch-action:\s*pan-y/);
    assert.match(css, /font-size:\s*16px/);
    assert.match(css, /gs-change/);
});

test("las notificaciones de producto son reales y se pueden marcar como leídas", () => {
    const js = read("js/pages/gestor.js");

    assert.doesNotThrow(() => new Function(js));
    assert.match(js, /gestor_notificaciones_producto/);
    assert.match(js, /function loadProductChanges/);
    assert.match(js, /function markProductChangeRead/);
    assert.match(js, /function markAllProductChangesRead/);
    assert.match(js, /function adjustSavedPrices/);
    assert.match(js, /precio_anterior/);
    assert.match(js, /margen_anterior/);
    assert.match(js, /data-change-read/);
    assert.match(js, /productChanges/);
});

test("la tarjeta de producto usa la plantilla oficial y el logo oficial", () => {
    const docs = read("js/pages/gestor-docs.js");
    const js = read("js/pages/gestor.js");
    const css = read("volxen.css");
    const html = read("gestor.html");

    assert.doesNotThrow(() => new Function(docs));
    assert.match(docs, /canvas\.width = 1440/);
    assert.match(docs, /canvas\.height = 1260/);
    assert.match(docs, /brand\/VOLXEN_plantilla_limpia_1440x1260\.png/);
    assert.match(docs, /brand\/logo\.svg/);
    assert.match(docs, /drawOfficialLockup/);
    assert.match(docs, /drawPricePanel/);
    assert.match(docs, /drawGoldTag/);
    assert.match(docs, /"PRECIO"/);
    assert.doesNotMatch(docs, /PRECIO PÚBLICO/);
    assert.match(docs, /Comercial VOLXEN/);
    assert.match(docs, /product\.features/);
    assert.match(docs, /No se pudo cargar la foto del producto/);
    assert.doesNotMatch(docs, /drawProductPlaceholder/);
    assert.doesNotMatch(docs, /Imagen no disponible/);
    assert.match(docs, /document\.fonts\.load/);
    assert.match(docs, /800 85px "DM Sans"/);
    assert.match(js, /productImage\(product, 1200, null, "webp"\)/);
    assert.doesNotMatch(js, /productImage\(product, 1200, 1200, "png"\)/);
    assert.match(css, /font-weight:\s*800/);
    assert.match(css, /DM-Sans-ExtraBold\.woff2/);
    assert.match(html, /DM-Sans-ExtraBold\.woff2/);
    assert.ok(fs.existsSync(path.join(ROOT, "public/fonts/DM-Sans-ExtraBold.ttf")));
    assert.doesNotMatch(docs, /logo-negativo/);
    assert.doesNotMatch(docs, /CATÁLOGO PRIVADO/);
    assert.doesNotMatch(docs, /#1C1A17/);
    assert.doesNotMatch(docs, /COMPRA ASISTIDA/);
    assert.doesNotMatch(docs, /new URL\("logo\.svg"/);
});

test("Fase B: panel de precio y etiqueta sobre el adorno, sin tapar el cristal", () => {
    const docs = read("js/pages/gestor-docs.js");
    const js = read("js/pages/gestor.js");

    assert.match(docs, /drawPricePanel\(ctx, 840, 16, 400, 170\)/);
    assert.match(docs, /drawGoldTag\(ctx, 1240, 40, 195, 110\)/);
    assert.match(docs, /photoX = 655/);
    assert.match(docs, /photoY = 331/);
    assert.match(docs, /photoW = 718/);
    assert.match(docs, /photoH = 537/);
    assert.match(docs, /roundRect\(ctx, photoX, photoY, photoW, photoH, 28\)/);
    assert.match(docs, /1180, 1120/);
    assert.match(docs, /guaranteeX = 120/);
    assert.match(docs, /bandCenter = \(902 \+ 1059\) \/ 2/);
    assert.match(docs, /guarantee/);
    assert.match(js, /guarantee: product\.garantia/);
});

test("el diseño izquierdo sigue el modelo de la plantilla", () => {
    const docs = read("js/pages/gestor-docs.js");

    assert.doesNotMatch(docs, /paintPanel/);
    assert.match(docs, /"Tecnología, calidad y confianza"/);
    assert.match(docs, /"en un solo producto\."/);
    assert.match(docs, /subtitleX = 76/);
    assert.match(docs, /subtitleMaxWidth = 450/);
    assert.match(docs, /'600 ' \+ subtitleSize/);
    assert.match(docs, /fitNameSize\(ctx, name, 540, 104, 48, titleBlockHeight, 2\)/);
    assert.match(docs, /'800 ' \+ nameFit\.size/);
    assert.match(docs, /nameVisualHeight/);
    assert.match(docs, /function cleanFeature/);
    assert.match(docs, /list\.length >= 6/);
    assert.match(docs, /list\.slice\(0, showMore \? 4 : 5\)/);
    assert.match(docs, /"Y " \+ remaining \+ " CARACTERÍSTICAS MÁS"/);
    assert.match(docs, /item\.title\.toUpperCase\(\)/);
    assert.match(docs, /drawFeatureIcon\(ctx, layout\.iconName, 112, layout\.center, featureRadius, layout\.discColor, layout\.iconColor\)/);
    assert.match(docs, /featureRegionTop/);
    assert.match(docs, /function featureGeometry/);
    assert.match(docs, /FEATURE_RADIUS_COMPACT = 32/);
    assert.match(docs, /FEATURE_DETAIL_SIZE_COMPACT = 26/);
    assert.match(docs, /FEATURE_SUBTITLE_GAP = 36/);
    assert.match(docs, /bottom = compact \? 880 : 878/);
    assert.match(docs, /fitSingleLineSize\(ctx, titleText, 410, 26, 18, "800", "DM Sans"\)/);
    assert.match(docs, /'800 ' \+ layout\.titleSize/);
    assert.match(docs, /document\.fonts\.load\('800 24px "DM Sans"'\)/);
    assert.match(docs, /#1E1D1B/);
    assert.match(docs, /ensureShareIcons/);
    assert.match(docs, /window\.selectShareIcon\(item\.title, item\.detail, usedIcons\)/);
    assert.match(docs, /#1E4A3F/);
    assert.match(docs, /#C8A165/);
    assert.match(docs, /var size = 32/);
    assert.match(docs, /No se pudieron dibujar estos iconos del kit/);
    assert.match(docs, /¡CALIDAD/);
    assert.match(docs, /GARANTIZADA!/);
    assert.match(docs, /drawTagGlyph/);
});

test("las características limpian viñetas y se limitan a 5 o 4 + resumen", () => {
    const sandbox = {
        window: {},
        URL,
        document: {
            baseURI: "https://volxen.example/gestor.html",
            fonts: { status: "loaded" },
            querySelector: () => null
        }
    };
    vm.runInNewContext(read("js/pages/gestor-docs.js"), sandbox);
    const docs = sandbox.window.VXGESTOR_DOCS;

    assert.equal(docs.cleanFeature("  - • Calidad: alta"), "Calidad: alta");

    const five = docs.featurePlan(["- Uno", "• Dos", "– Tres", "— Cuatro", "* Cinco"]);
    assert.deepEqual(five.visible, ["Uno", "Dos", "Tres", "Cuatro", "Cinco"]);
    assert.equal(five.moreLabel, "");

    const six = docs.featurePlan(["- A", "- B", "- C", "- D", "- E", "- F"]);
    assert.deepEqual(six.visible, ["A", "B", "C", "D"]);
    assert.equal(six.moreLabel, "Y 2 CARACTERÍSTICAS MÁS");

    const ten = docs.featurePlan(Array.from({ length: 10 }, (_, index) => "- " + (index + 1)));
    assert.deepEqual(ten.visible, ["1", "2", "3", "4"]);
    assert.equal(ten.moreLabel, "Y 6 CARACTERÍSTICAS MÁS");

    const empty = docs.featurePlan([" - ", "• ", "", null]);
    assert.deepEqual(empty.visible, []);
    assert.equal(empty.moreLabel, "");
});

test("la geometría deja 36 px bajo el subtítulo y usa círculos de 32 px", () => {
    const sandbox = {
        window: {},
        URL,
        document: {
            baseURI: "https://volxen.example/gestor.html",
            fonts: { status: "loaded" },
            querySelector: () => null
        }
    };
    vm.runInNewContext(read("js/pages/gestor-docs.js"), sandbox);
    const docs = sandbox.window.VXGESTOR_DOCS;

    const one = docs.featureGeometry(["A"], 500);
    assert.equal(one.compact, false);
    assert.equal(one.top, 536);
    assert.equal(one.bottom, 878);
    assert.equal(one.radius, 32);
    assert.deepEqual(one.centers, [568]);

    const three = docs.featureGeometry(["A", "B", "C"], 500);
    assert.equal(three.compact, false);
    assert.deepEqual(three.centers, [568, 705, 842]);

    const four = docs.featureGeometry(["A", "B", "C", "D"], 500);
    assert.equal(four.compact, true);
    assert.equal(four.top, 536);
    assert.equal(four.bottom, 880);
    assert.equal(four.radius, 32);
    assert.deepEqual(four.centers.map((value) => Math.round(value * 100) / 100), [568, 660, 752, 844]);

    const five = docs.featureGeometry(["A", "B", "C", "D", "E"], 500);
    assert.equal(five.radius, 32);
    assert.deepEqual(five.centers, [568, 637, 706, 775, 844]);
    assert.ok(five.step >= five.radius * 2);

    const six = docs.featureGeometry(["A", "B", "C", "D", "E", "F"], 500);
    assert.equal(six.plan.moreLabel, "Y 2 CARACTERÍSTICAS MÁS");
    assert.deepEqual(six.centers, [568, 643, 718, 793]);
    assert.equal(six.moreCenter, 868);
    assert.ok(six.moreCenter + six.summaryHalf <= six.bottom);
    assert.ok(six.step >= six.radius * 2);
    assert.ok(six.centers.every((center) => center - six.radius >= six.top));
});

test("los iconos se eligen del kit por palabras clave y no se repiten", () => {
    const getShareIcon = require("../js/pages/share-icons.js");
    const used = [];
    assert.equal(getShareIcon.selectShareIcon("Potencia", "3000W", used), "potencia");
    assert.equal(getShareIcon.selectShareIcon("Batería", "Litio 100Ah", used), "bateria-llena");
    assert.equal(getShareIcon.selectShareIcon("Panel solar", "450W", used), "panel-solar");
    assert.equal(getShareIcon.selectShareIcon("Voltaje", "110V", used), "voltaje");
    assert.equal(getShareIcon.selectShareIcon("Garantía", "12 meses", used), "garantia");
    assert.equal(new Set(used).size, used.length);

    const repeat = [];
    assert.equal(getShareIcon.selectShareIcon("Potencia", "3000W", repeat), "potencia");
    assert.equal(getShareIcon.selectShareIcon("Potencia", "5000W", repeat), "check");
    assert.notEqual(repeat[0], repeat[1]);

    const unknown = [];
    assert.equal(getShareIcon.selectShareIcon("Sin palabra clave", "nada", unknown), "check");
    assert.equal(getShareIcon.selectShareIcon("Sin palabra clave", "nada", unknown), "calidad");
    assert.notEqual(unknown[0], unknown[1]);
});

test("el texto de características no se recorta en silencio", () => {
    const docs = read("js/pages/gestor-docs.js");

    assert.doesNotMatch(docs, /truncateToWidth/);
    assert.match(docs, /título de característica/);
    assert.match(docs, /detalle de característica/);
    assert.match(docs, /Estos datos no caben completos en la imagen/);
});

test("la foto se recorta para llenar el cristal y el fondo oscuro no asoma", () => {
    const docs = read("js/pages/gestor-docs.js");
    const js = read("js/pages/gestor.js");

    assert.match(docs, /function drawCover/);
    assert.match(docs, /function drawProductPhoto/);
    assert.match(docs, /drawProductPhoto\(ctx, image, photoX, photoY, photoW, photoH\)/);
    assert.match(docs, /drawCover\(ctx, image, x, y, width, height, 1\.12\)/);
    assert.match(docs, /ctx\.fillStyle = "#F3EDE3"/);
    assert.doesNotMatch(docs, /loss > 0\.18/);
    assert.doesNotMatch(docs, /ctx\.filter = "blur\(26px\)"/);
    assert.doesNotMatch(docs, /drawContain\(ctx, image, x, y, width, height\);/);
    assert.doesNotMatch(docs, /truncateText\(/);
    assert.match(docs, /CORS o crossOrigin/);
    assert.match(docs, /Estos datos no caben completos en la imagen/);
    assert.match(docs, /No se generó la imagen para no recortarlos/);
    assert.match(js, /guarantee: product\.garantia/);
});

test("los PDFs incrustan las fuentes y el logo oficial", () => {
    const pdf = read("js/pages/gestor-pdf.js");

    assert.doesNotThrow(() => new Function(pdf));
    assert.match(pdf, /brand\/logo\.svg/);
    assert.match(pdf, /registerFonts/);
    assert.match(pdf, /DM-Sans-Regular\.ttf/);
    assert.match(pdf, /InterTight-Regular\.ttf/);
    assert.match(pdf, /addFileToVFS/);
    assert.match(pdf, /addFont/);
    assert.doesNotMatch(pdf, /new URL\("logo\.svg"/);
});

test("el build copia la marca y las fuentes TTF", () => {
    const pkg = JSON.parse(read("package.json"));

    assert.match(pkg.scripts["copy:fonts"], /\.ttf/);
    assert.match(pkg.scripts["copy:brand"], /brand/);
    assert.match(pkg.scripts.build, /copy:brand/);
});

test("el panel usa safe-area y altura dinámica en Android", () => {
    const css = read("gestor.css");

    assert.match(css, /100dvh/);
    assert.match(css, /env\(safe-area-inset-bottom\)/);
    assert.match(css, /scroll-padding-top/);
});

test("el panel activa el fondo oscuro y permite cambiarlo", () => {
    const html = read("gestor.html");
    const css = read("gestor.css");
    const js = read("js/pages/gestor-theme.js");

    assert.match(html, /data-gs-theme="dark"/);
    assert.match(html, /id="gsThemeToggle"/);
    assert.match(html, /js\/pages\/gestor-theme\.js/);
    assert.match(css, /:root\[data-gs-theme="dark"\]/);
    assert.match(css, /\[data-gs-theme="dark"\] body\.gs-body/);
    assert.match(js, /volxen-gs-theme/);
    assert.match(js, /gsThemeToggle/);
});

test("administración puede editar el margen máximo", () => {
    const admin = read("admin.html");

    assert.match(admin, /id="pmm"/);
    assert.match(admin, /margen_max_porcentaje/);
});
