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
        this.totalPages = 1;
        this.fontSize = 10;
        this.texts = [];
        this.images = [];
        this.links = [];
        this.saved = "";
        this.outline = {
            entries: [],
            add: function (parent, title, options) {
                this.entries.push({
                    parent,
                    title: String(title || ""),
                    pageNumber: options && options.pageNumber
                });
                return this;
            }
        };
        this.internal = {
            pageSize: {
                getWidth: () => 210,
                getHeight: () => 297
            }
        };
    }
    FakePDF.prototype.setFont = function () { return this; };
    FakePDF.prototype.setFontSize = function (size) {
        this.fontSize = Number(size) || 10;
        return this;
    };
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
    FakePDF.prototype.link = function (x, y, width, height, options) {
        this.links.push({ x, y, width, height, pageNumber: options && options.pageNumber });
        return this;
    };
    FakePDF.prototype.textWithLink = function (value, x, y, options) {
        this.text(value, x, y);
        this.link(x, y - 3, this.getTextWidth(value), 6, options);
        return this;
    };
    FakePDF.prototype.getTextWidth = function (value) {
        return String(value || "").length * this.fontSize * 0.18;
    };
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
        this.totalPages += 1;
        return this;
    };
    FakePDF.prototype.setPage = function (page) {
        this.page = page;
        return this;
    };
    FakePDF.prototype.getNumberOfPages = function () {
        return this.totalPages;
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

test("el catálogo agrupa por categoría y respeta datos públicos", async () => {
    const loaded = loadPdf();
    const api = loaded.api;
    const filename = await api.downloadCatalog({
        managerName: "Ana",
        products: [{ name: "Nevera", category: "Línea blanca", price: 120, image: "" }]
    });

    assert.match(filename, /^catalogo-volxen-\d{4}-\d{2}-\d{2}\.pdf$/);
    assert.equal(loaded.instance.saved, filename);
    const text = loaded.instance.texts.join("\n");
    assert.match(text, /CATÁLOGO/);
    assert.match(text, /Asesor: Ana/);
    assert.match(text, /Nevera/);
    assert.match(text, /^120$/m);
    assert.match(text, /^ USD$/m);
    assert.match(text, /PEDIR POR WHATSAPP/);
    assert.ok(loaded.instance.outline.entries.some((entry) => entry.title === "Línea blanca" && entry.pageNumber === 2));
    assert.doesNotMatch(text, /comisión|ganancia/i);
    assert.equal(loaded.instance.page, 2);
});

test("el catálogo enlaza el índice, marca categorías y comparte una sola categoría", async () => {
    const loaded = loadPdf();
    const api = loaded.api;
    const filename = await api.downloadCatalog({
        managerName: "Ana",
        scopeLabel: "Climatización",
        categories: [{ id: "c1", nombre: "Climatización", orden: 1 }],
        contacts: [{ name: "Atención principal 1", phone: "5350760258" }],
        products: [{
            name: "Aire split",
            category: "Climatización",
            categoryId: "c1",
            price: 160,
            features: ["600W", "15 amp"],
            guarantee: "1 mes",
            availability: "disponible"
        }]
    });

    assert.match(filename, /^catalogo-volxen-climatizacion-\d{4}-\d{2}-\d{2}\.pdf$/);
    const text = loaded.instance.texts.join("\n");
    assert.match(text, /Aire Split/);
    assert.match(text, /^160$/m);
    assert.match(text, /^ USD$/m);
    assert.match(text, /Garantía: 1 mes/);
    assert.match(text, /DISPONIBLE/);
    assert.match(text, /\+53 50760258/);
    assert.ok(loaded.instance.outline.entries.some((entry) => entry.title === "Climatización" && entry.pageNumber === 2));
    assert.ok(loaded.instance.links.some((link) => link.pageNumber === 2));
    assert.equal(loaded.instance.page, 2);
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
