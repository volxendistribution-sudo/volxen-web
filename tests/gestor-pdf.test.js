const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

function fakeJsPDF() {
    function FakePDF() {
        this.page = 1;
        this.texts = [];
        this.images = [];
        this.saved = "";
        this.internal = {
            pageSize: {
                getWidth: () => 210,
                getHeight: () => 297
            }
        };
    }
    FakePDF.prototype.setFont = function () { return this; };
    FakePDF.prototype.setFontSize = function () { return this; };
    FakePDF.prototype.setTextColor = function () { return this; };
    FakePDF.prototype.setFillColor = function () { return this; };
    FakePDF.prototype.setDrawColor = function () { return this; };
    FakePDF.prototype.setLineWidth = function () { return this; };
    FakePDF.prototype.setLineDash = function () { return this; };
    FakePDF.prototype.setLineCap = function () { return this; };
    FakePDF.prototype.setTextAlign = function () { return this; };
    FakePDF.prototype.rect = function () { return this; };
    FakePDF.prototype.roundedRect = function () { return this; };
    FakePDF.prototype.circle = function () { return this; };
    FakePDF.prototype.line = function () { return this; };
    FakePDF.prototype.text = function (value) {
        this.texts.push(String(value));
        return this;
    };
    FakePDF.prototype.splitTextToSize = function (value, width) {
        const text = String(value || "");
        const limit = Math.max(8, Math.floor(Number(width) || 80));
        return text.length <= limit ? [text] : text.match(new RegExp(".{1," + limit + "}", "g")) || [text];
    };
    FakePDF.prototype.addImage = function (data, format, x, y, width, height) {
        this.images.push({ data: String(data || ""), format, x, y, width, height });
        return this;
    };
    FakePDF.prototype.addPage = function () {
        this.page += 1;
        return this;
    };
    FakePDF.prototype.setPage = function (page) {
        this.page = page;
        return this;
    };
    FakePDF.prototype.getNumberOfPages = function () {
        return this.page;
    };
    FakePDF.prototype.save = function (filename) {
        this.saved = String(filename || "");
        return this;
    };
    return FakePDF;
}

function loadPdf(withoutJsPdf) {
    const FakePDF = fakeJsPDF();
    let instance = null;
    function WrappedPDF() {
        instance = new FakePDF();
        return instance;
    }
    const sandbox = {
        window: withoutJsPdf ? {} : { jspdf: { jsPDF: WrappedPDF } },
        document: {
            baseURI: "https://volxen.example/gestor.html",
            querySelector: () => null
        },
        Image: function () {
            const image = this;
            Object.defineProperty(image, "src", {
                set() {
                    if (typeof image.onerror === "function") image.onerror(new Error("sin imagen"));
                }
            });
        },
        Date,
        Math,
        Number,
        String,
        Object,
        Array,
        Promise,
        setTimeout,
        clearTimeout
    };
    vm.runInNewContext(read("js/pages/gestor-pdf.js"), sandbox);
    return {
        api: sandbox.window.VXGESTOR_PDF,
        get instance() { return instance; }
    };
}

test("el panel carga jsPDF y el generador directo antes de gestor.js", () => {
    const html = read("gestor.html");
    const js = read("js/pages/gestor.js");

    assert.match(html, /js\/vendor\/jspdf\.umd\.min\.js/);
    assert.match(html, /js\/pages\/gestor-pdf\.js/);
    assert.ok(html.indexOf("js/vendor/jspdf.umd.min.js") < html.indexOf("js/pages/gestor-pdf.js"));
    assert.ok(html.indexOf("js/pages/gestor-pdf.js") < html.indexOf("js/pages/gestor.js"));
    assert.match(js, /VXGESTOR_PDF/);
    assert.match(js, /downloadReceipt/);
    assert.match(js, /downloadReport/);
    assert.match(js, /downloadCatalog/);
    assert.doesNotMatch(js, /openPrint|diálogo de impresión/);
    assert.match(html, /Descargar catálogo PDF/);
});

test("el reporte se guarda como PDF directo con la línea del comercial", async () => {
    const loaded = loadPdf();
    const api = loaded.api;
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

    const filename = await api.downloadReport({
        orders: [order],
        managerName: "Ana",
        periodLabel: "Últimos 30 días",
        charts: [
            { type: "bar", title: "Comisión ganada por mes", items: [{ label: "oct", value: 30 }] },
            { type: "line", title: "Evolución de pedidos", items: [{ label: "01 oct", value: 1 }] },
            { type: "horizontal", title: "Productos más pedidos", items: [{ label: "Nevera", value: 2 }] },
            { type: "horizontal", title: "Pedidos por estado", items: [{ label: "Entregado", value: 1 }] }
        ]
    });

    assert.match(filename, /^reporte-gestor-\d{4}-\d{2}-\d{2}\.pdf$/);
    assert.equal(loaded.instance.saved, filename);
    const text = loaded.instance.texts.join("\n");
    assert.match(text, /Mi reporte/);
    assert.match(text, /Comercial VOLXEN: Ana/);
    assert.match(text, /Comisión ganada/);
    assert.doesNotMatch(text, /ganancia total/i);
});

test("el catálogo se guarda como PDF directo y respeta datos públicos", async () => {
    const loaded = loadPdf();
    const api = loaded.api;
    const filename = await api.downloadCatalog({
        managerName: "Ana",
        products: [{ name: "Nevera", category: "Línea blanca", price: 120, image: "" }]
    });

    assert.match(filename, /^catalogo-volxen-\d{4}-\d{2}-\d{2}\.pdf$/);
    assert.equal(loaded.instance.saved, filename);
    const text = loaded.instance.texts.join("\n");
    assert.match(text, /Catálogo/);
    assert.match(text, /Comercial VOLXEN: Ana/);
    assert.match(text, /Nevera/);
    assert.match(text, /\$120\.00/);
    assert.doesNotMatch(text, /comisión|ganancia/i);
});

test("el comprobante PDF es directo y no filtra datos privados", async () => {
    const loaded = loadPdf();
    const api = loaded.api;
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

    const filename = await api.downloadReceipt(order, "Ana", { address: false, phone: false });

    assert.match(filename, /^comprobante-vx-1-\d{4}-\d{2}-\d{2}\.pdf$/);
    assert.equal(loaded.instance.saved, filename);
    const text = loaded.instance.texts.join("\n");
    assert.match(text, /Comprobante/);
    assert.match(text, /Comercial VOLXEN: Ana/);
    assert.match(text, /Total que paga el cliente/);
    assert.match(text, /\$120\.00/);
    assert.doesNotMatch(text, /Calle 1/);
    assert.doesNotMatch(text, /5555/);
    assert.doesNotMatch(text, /comisión|ganancia/i);
});

test("si jsPDF no carga, el error se informa en vez de abrir impresión", async () => {
    const { api } = loadPdf(true);
    const order = { codigo: "VX-1", total_usd: 10, items: [] };

    await assert.rejects(() => api.downloadReceipt(order, "Ana", {}), /generador de PDF/i);
});
