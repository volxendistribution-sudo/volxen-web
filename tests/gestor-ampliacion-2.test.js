const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("config centraliza las operadoras principales y deriva el prefijo de Cuba", () => {
    const config = read("config.js");

    assert.match(config, /VOLXEN_OPERADORAS_PRINCIPALES/);
    assert.match(config, /50760258/);
    assert.match(config, /54703019/);
    assert.match(config, /PREFIJO_CUBA:\s*"53"/);
    assert.match(config, /WHATSAPP:\s*"53"\s*\+\s*window\.VOLXEN_OPERADORAS_PRINCIPALES\[0\]\.whatsapp/);
});

test("el panel incluye buscador agrupado, reporte, catálogo y diálogos nuevos", () => {
    const html = read("gestor.html");

    assert.match(html, /id="gsSearchResults"/);
    assert.match(html, /id="gsDownloadReport"/);
    assert.match(html, /id="gsEvolutionChart"/);
    assert.match(html, /id="gsCatalogShare"/);
    assert.match(html, /id="gsProductShare"/);
    assert.match(html, /id="gsOrderSuccessShare"/);
    assert.match(html, /id="gsReceiptDialog"/);
    assert.match(html, /id="gsReceiptAddress"/);
    assert.match(html, /id="gsReceiptPhone"/);
    assert.match(html, /id="gsOperatorDialog"/);
    assert.match(html, /id="gsOperatorList"/);
    assert.match(html, /js\/pages\/gestor-charts\.js/);
    assert.match(html, /js\/pages\/gestor-docs\.js/);
    assert.ok(html.indexOf("gestor-charts.js") < html.indexOf("gestor-docs.js"));
    assert.ok(html.indexOf("gestor-docs.js") < html.indexOf("js/pages/gestor.js"));
});

test("el gestor pagina todo el historial y usa los módulos de gráficas y documentos", () => {
    const js = read("js/pages/gestor.js");

    assert.doesNotThrow(() => new Function(js));
    assert.match(js, /function loadAllOrders/);
    assert.match(js, /p_limit:\s*100,\s*p_offset:\s*offset/);
    assert.match(js, /VXGESTOR_CHARTS/);
    assert.match(js, /VXGESTOR_DOCS/);
    assert.match(js, /function runSearch/);
    assert.match(js, /data-search-order/);
    assert.match(js, /data-search-product/);
    assert.match(js, /function openOperatorDialog/);
    assert.match(js, /function shareReceipt/);
    assert.match(js, /function downloadReport/);
    assert.match(js, /function shareCatalog/);
    assert.match(js, /function shareProductImage/);
    assert.doesNotMatch(js, /gsChartGrid|gsChartPlot|gsChartTooltip|gsBubbleEmpty|gsBubbleNote|gsStatusLegend/);
    assert.doesNotMatch(js, /\/rest\/v1\/pedidos/);
});

test("el comprobante no filtra comisión ni precios internos", () => {
    const docs = read("js/pages/gestor-docs.js");
    const receipt = docs.match(/function receiptBody\(data\)[\s\S]*?\n    \}/);
    const receiptImage = docs.match(/async function receiptImageBlob\([\s\S]*?\n    \}/);

    assert.ok(receipt, "Falta receiptBody");
    assert.ok(receiptImage, "Falta receiptImageBlob");
    assert.match(docs, /Comercial VOLXEN:/);
    assert.match(docs, /Total que paga el cliente/);
    assert.doesNotMatch(receipt[0], /comision|precio_volxen|ganancia/i);
    assert.doesNotMatch(receiptImage[0], /comision|precio_volxen|ganancia/i);
});

test("las gráficas son SVG sin animación y con tooltip de clic", () => {
    const charts = read("js/pages/gestor-charts.js");
    const css = read("gestor.css");

    assert.doesNotThrow(() => new Function(charts));
    assert.match(charts, /function monthlyCommission/);
    assert.match(charts, /function statusBreakdown/);
    assert.match(charts, /function topProducts/);
    assert.match(charts, /function evolution/);
    assert.match(charts, /data-chart-tip/);
    assert.match(charts, /bindTooltips/);
    assert.doesNotMatch(charts, /requestAnimationFrame|transition|animation/);
    assert.match(css, /\.gs-chart-svg-wrap/);
    assert.match(css, /\.gs-search-results/);
    assert.match(css, /\.gs-doc-dialog/);
});

test("las operadoras usan 53 una sola vez y abren WhatsApp sin enviar", () => {
    const js = read("js/pages/gestor.js");

    assert.match(js, /function fullWhatsapp/);
    assert.match(js, /PREFIJO_CUBA/);
    assert.match(js, /function operatorHref/);
    assert.match(js, /https:\/\/wa\.me\//);
    assert.match(read("gestor.html"), /No se envía nada automáticamente/);
    assert.match(js, /data-operator-order/);
});


test("las gráficas calculan series reales y generan SVG accesible", () => {
    const sandbox = { window: {} };
    vm.runInNewContext(read("js/pages/gestor-charts.js"), sandbox);

    const charts = sandbox.window.VXGESTOR_CHARTS;
    const now = new Date();
    const recent = new Date(now.getFullYear(), now.getMonth(), 1);
    const orders = [
        { id: "1", estado: "Entregado", created_at: recent, comision_monto_usd: 25, items: [{ producto_nombre: "Nevera", cantidad: 2 }] },
        { id: "2", estado: "Cancelado", created_at: recent, comision_monto_usd: 99, items: [{ producto_nombre: "Nevera", cantidad: 5 }] },
        { id: "3", estado: "En camino", created_at: recent, comision_monto_usd: 10, items: [{ producto_nombre: "TV", cantidad: 1 }] }
    ];

    assert.equal(charts.monthlyCommission(orders, 12).length, 12);
    assert.deepEqual(JSON.parse(JSON.stringify(charts.topProducts(orders, 6).map((item) => [item.label, item.value]))), [["Nevera", 2], ["TV", 1]]);
    assert.equal(charts.statusBreakdown(orders).find((item) => item.label === "Entregado").value, 1);
    assert.equal(charts.evolution(orders, 30).reduce((sum, item) => sum + item.value, 0), 3);

    const bar = charts.barChartSvg({ title: "Comisión", items: charts.monthlyCommission(orders, 12), format: (value) => "$" + value });
    const line = charts.lineChartSvg({ title: "Evolución", items: charts.evolution(orders, 30), format: String });
    const horizontal = charts.horizontalBarSvg({ title: "Estados", items: charts.statusBreakdown(orders), format: String });

    [bar, line, horizontal].forEach((svg) => {
        assert.match(svg, /^<svg/);
        assert.match(svg, /role="img"/);
        assert.match(svg, /<title>/);
        assert.doesNotMatch(svg, /animation|transition/);
    });
    assert.match(horizontal, /data-chart-tip=/);
});

test("los documentos imprimibles respetan los datos permitidos", () => {
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
    const order = {
        id: "o1",
        codigo: "VX-1",
        estado: "Entregado",
        created_at: "2026-10-01T12:00:00Z",
        nombre_cliente: "Cliente",
        telefono: "+53 5555 5555",
        direccion: "Calle 1",
        total_usd: 120,
        comision_monto_usd: 30,
        items: [{ producto_nombre: "Nevera", cantidad: 2, precio_unitario: 60, subtotal: 120 }]
    };

    const receipt = docs.receiptDocumentHtml(order, "Ana", { address: true, phone: false });
    assert.match(receipt, /Comercial VOLXEN: Ana/);
    assert.match(receipt, /Total que paga el cliente/);
    assert.match(receipt, /Calle 1/);
    assert.doesNotMatch(receipt, /5555 5555/);
    assert.doesNotMatch(receipt, /comisi|ganancia|precio_volxen/i);

    const report = docs.reportDocumentHtml({
        orders: [order],
        managerName: "Ana",
        periodLabel: "Últimos 30 días",
        charts: [{ title: "Gráfica", svg: "<svg></svg>" }]
    });
    assert.match(report, /Mi reporte/);
    assert.match(report, /Comercial VOLXEN: Ana/);
    assert.match(report, /no presenta totales de venta como ganancia/i);

    const catalog = docs.catalogDocumentHtml({
        products: [{ name: "Nevera", category: "Línea blanca", price: 120, image: "" }],
        managerName: "Ana"
    });
    assert.match(catalog, /Catálogo/);
    assert.match(catalog, /Comercial VOLXEN: Ana/);
    assert.match(catalog, /Sin foto/);
    assert.match(catalog, /no incluye información interna/);
});
