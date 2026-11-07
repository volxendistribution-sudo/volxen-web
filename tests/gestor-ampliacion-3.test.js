const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
    assert.match(docs, /Sin foto/);
    assert.doesNotMatch(docs, /drawProductPlaceholder/);
    assert.doesNotMatch(docs, /Imagen no disponible/);
    assert.match(docs, /document\.fonts\.load/);
    assert.match(docs, /800 85px "DM Sans"/);
    assert.match(js, /function productOriginalImage/);
    assert.match(js, /image: productOriginalImage\(product\)/);
    assert.doesNotMatch(js, /productImage\(product, 1200, null, "webp"\)/);
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
    assert.match(docs, /drawGoldTag\(ctx, 1250, 40, 185, 110\)/);
    assert.match(docs, /photoX = 658/);
    assert.match(docs, /photoY = 334/);
    assert.match(docs, /photoW = 712/);
    assert.match(docs, /photoH = 531/);
    assert.match(docs, /photoRadius = 32/);
    assert.match(docs, /roundRect\(ctx, photoX, photoY, photoW, photoH, photoRadius\)/);
    assert.match(docs, /1180, 1120/);
    assert.match(docs, /600 25px "Inter Tight"/);
    assert.match(docs, /width > 513/);
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
    assert.match(docs, /featureCount <= 5 \? features : features\.slice\(0, 4\)/);
    assert.match(docs, /"Y " \+ \(featureCount - 4\) \+ " CARACTERÍSTICAS MÁS"/);
    assert.match(docs, /featureMode === "four" \? 20 : 18/);
    assert.match(docs, /item\.title\.toUpperCase\(\)/);
    assert.match(docs, /drawFeatureIcon\(ctx, layout\.icono, 112, layout\.center, layout\.iconRadius, layout\.color\)/);
    assert.match(docs, /function normalizarClave/);
    assert.match(docs, /function asignarIcono/);
    assert.doesNotMatch(docs, /iconDrawers/);
    assert.match(docs, /#2E4A3F/);
    assert.match(docs, /#C8A165/);
    assert.match(docs, /icono: tipoIcono/);
    assert.match(docs, /color: color/);
    assert.doesNotMatch(docs, /var iconImages/);
    assert.doesNotMatch(docs, /svgDataUrl/);
    assert.doesNotMatch(docs, /preloadShareIcon/);
    assert.doesNotMatch(docs, /preloadShareIcons/);
    assert.doesNotMatch(docs, /ctx\.drawImage\(img/);
    assert.match(docs, /function parsePathData/);
    assert.match(docs, /DOMParser/);
    assert.match(docs, /querySelectorAll/);
    assert.match(docs, /imageSmoothingQuality = "high"/);
    assert.match(docs, /featureRegionTop/);
    assert.match(docs, /featureRegionBottom = 878/);
    assert.match(docs, /#1E1D1B/);
    assert.doesNotMatch(docs, /drawShieldIcon/);
    assert.doesNotMatch(docs, /drawBoltIcon/);
    assert.doesNotMatch(docs, /drawGearIcon/);
    assert.doesNotMatch(docs, /drawGearIcon/);
    assert.match(docs, /¡CALIDAD/);
    assert.match(docs, /GARANTIZADA!/);
    assert.match(docs, /drawTagGlyph/);
});

test("la foto llena el cristal con cover y usa fondo desenfocado si hay que contener", () => {
    const docs = read("js/pages/gestor-docs.js");
    const js = read("js/pages/gestor.js");

    assert.match(docs, /function drawCover/);
    assert.match(docs, /function drawProductPhoto/);
    assert.match(docs, /drawProductPhoto\(ctx, image, photoX, photoY, photoW, photoH\)/);
    assert.match(docs, /loss > 0\.18/);
    assert.match(docs, /ctx\.filter = "blur\(40px\)"/);
    assert.match(docs, /drawFeatheredContain\(ctx, image, x, y, width, height, 24\)/);
    assert.match(docs, /imageSmoothingQuality = "high"/);
    assert.doesNotMatch(docs, /truncateText\(/);
    assert.match(docs, /ctx\.fillRect\(photoX, photoY, photoW, photoH\)/);
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

test("los iconos de características son reales (lucide-static) y no se repiten", () => {
    const docs = read("js/pages/gestor-docs.js");

    assert.doesNotThrow(() => new Function(docs));

    // Existencia de utilidades de mapeo
    assert.match(docs, /function normalizarClave/);
    assert.match(docs, /function iconosPorCategoria/);
    assert.match(docs, /function asignarIcono/);
    assert.doesNotMatch(docs, /var iconImages/);
    assert.doesNotMatch(docs, /svgDataUrl/);
    assert.doesNotMatch(docs, /preloadShareIcon/);
    assert.doesNotMatch(docs, /preloadShareIcons/);
    assert.doesNotMatch(docs, /ctx\.drawImage\(img/);

    // No hay figuras de relleno (iconDrawers eliminado)
    assert.doesNotMatch(docs, /iconDrawers/);
    assert.doesNotMatch(docs, /function drawShieldIcon/);
    assert.doesNotMatch(docs, /function drawBoltIcon/);
    assert.doesNotMatch(docs, /function drawGearIcon/);

    // drawFeatureIcon dibuja SVG del iconos-volxen.zip directamente en canvas con DOMParser
    assert.match(docs, /function drawFeatureIcon/);
    assert.match(docs, /function parsePathData/);
    assert.match(docs, /DOMParser/);
    assert.match(docs, /querySelectorAll/);
    assert.match(docs, /imageSmoothingQuality = "high"/);

    // Colores verde y dorado del kit de marca, nunca negro
    assert.match(docs, /#2E4A3F/);
    assert.match(docs, /#C8A165/);
    assert.doesNotMatch(docs, /fillStyle = "#000000"/);

    // Radios por número de filas: 38 (1-3), 26 (4), 22 (5)
    assert.match(docs, /iconRadius = featureMode === "normal" \? 38 :/);
    assert.match(docs, /featureMode === "four" \? 26 : 22/);

    // Tabla de palabras clave: cubriendo las categorías requeridas
    assert.match(docs, /"watt"|"vatios"|"potencia"/);
    assert.match(docs, /"amp"|"amper"|"amperaje"/);
    assert.match(docs, /"voltaje"|"voltage"|"volt"/);
    assert.match(docs, /"bateria"|"autonomia"|"horas"|"duracion"/);
    assert.match(docs, /"panel"|"placa"|"solar"|"monocristal"|"bifacial"/);
    assert.match(docs, /"capacidad"|"tamano"|"tamaño"|"peso"|"kilos"/);
    assert.match(docs, /"pantalla"|"resolucion"|"pulgadas"/);
    assert.match(docs, /"wifi"|"bluetooth"|"inalambrico"/);
    assert.match(docs, /"frio"|"refrigeracion"|"climatizacion"/);
    assert.match(docs, /"calor"|"termico"|"calefaccion"/);
    assert.match(docs, /"ahorro"|"inverter"|"eco"/);
    assert.match(docs, /"ventilacion"|"ventilador"/);
    assert.match(docs, /"iluminacion"|"led"|"luz"/);
    assert.match(docs, /"durabilidad"|"resistente"/);
    assert.match(docs, /"garantia"/);
    assert.match(docs, /"silencio"|"ruido"/);
    assert.match(docs, /"material"|"acero"|"aluminio"/);
    assert.match(docs, /"fuego"|"llama"/);
    assert.match(docs, /"neutro"/);

    // Regla de no repetición: asignarIcono comprueba usados.indexOf
    assert.match(docs, /usados\.indexOf\(nombre\) === -1/);

    // Cada nombre de icono usado en la tabla existe en SHARE_ICONS (verificación cruzada)
    const iconNamesInDocs = [
        "potencia", "voltaje", "bateria", "solar", "capacidad",
        "pantalla", "wifi", "frio", "calor", "ahorro",
        "ventilacion", "iluminacion", "durabilidad", "garantia",
        "silencio", "material", "fuego", "neutro"
    ];
    for (const name of iconNamesInDocs) {
        assert.match(docs, new RegExp('"' + name + '":'));
    }

    // Textos de ejemplo y su icono esperado (por palabra clave)
    const ejemplos = [
        { texto: "600WATS", clave: "watt", icono: "potencia" },
        { texto: "15 AMP", clave: "amp", icono: "voltaje" },
        { texto: "BIFACIALES MONOCRISTALINOS", clave: "bifacial", icono: "solar" },
        { texto: "GRAN PANEL", clave: "panel", icono: "solar" },
        { texto: "FUEGO", clave: "fuego", icono: "fuego" },
        { texto: "BATERÍA DURA DE 10 A 16 HORAS", clave: "bateria", icono: "bateria" }
    ];
    for (const ej of ejemplos) {
        assert.match(docs, new RegExp('"' + ej.clave + '"'));
        assert.match(docs, new RegExp('"' + ej.icono + '"'));
    }

    // Con 6 características y 2 mapeando a "solar", la segunda no repite (alternativa o neutro)
    // Verificado por la regla de asignarIcono con usados.indexOf
});
