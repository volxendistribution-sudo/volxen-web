(function () {
    "use strict";

    var PAGE_W = 210;
    var PAGE_H = 297;
    var M = 14;
    var COLORS = {
        ink: [30, 29, 27],
        surface: [234, 230, 222],
        paper: [248, 247, 244],
        gold: [200, 161, 101],
        green: [46, 74, 63],
        muted: [119, 115, 108],
        line: [214, 209, 200],
        white: [255, 255, 255]
    };

    /* ---------- Variables de diseño del catálogo (equivalentes a CSS vars) ---------- */
    var VX = {
        bg: [247, 242, 232],          /* #F7F2E8 fondo crema */
        imgBg: [232, 223, 205],       /* #E8DFCD zona de imagen (un poco más oscuro que el fondo) */
        cardBg: [255, 255, 255],
        cardBorder: [214, 209, 200],  /* #DFD3C0 */
        primary: [31, 64, 54],        /* #1F4036 primario verde oscuro */
        text: [23, 20, 16],           /* #171410 */
        muted: [90, 84, 73],          /* #5A5449 */
        gold: [200, 161, 101],        /* #C8A165 */
        font: "Inter Tight",
        fontBold: "DM Sans",

        /* Medidas en mm (A4) */
        cardW: 88,
        cardH: 124,
        gapX: 6,
        gapY: 6,
        gridTop: 27,
        bandH: 17,
        perPage: 4,
        imgZoneH: 53,                 /* ~200px */
        btnH: 10.5,                   /* ~40px */
        btnRadius: 2.6,               /* ~10px */
        priceNum: 7.4,                /* ~28px */
        priceUsd: 2.9,                /* ~11px */
        pillText: 2.9,                /* ~11px */
        cardRadius: 4.5,
        pad: 5,
        qrSize: 36                    /* ~135px */
    };

    function ctor() {
        return window.jspdf && typeof window.jspdf.jsPDF === "function" ? window.jspdf.jsPDF : null;
    }

    function requireCtor() {
        var JsPDF = ctor();
        if (!JsPDF) throw new Error("No se pudo cargar el generador de PDF. Recarga la página e inténtalo de nuevo.");
        return JsPDF;
    }

    function newDoc() {
        var JsPDF = requireCtor();
        return new JsPDF({ unit: "mm", format: "a4", compress: true });
    }

    function fontBase() {
        var preload = document.querySelector('link[rel="preload"][as="font"]');
        if (preload && preload.href) return preload.href.replace(/[^/]+$/, "");
        try {
            return new URL("dist/fonts/", document.baseURI).href;
        } catch (error) {
            return "dist/fonts/";
        }
    }

    function arrayBufferToBase64(buffer) {
        var bytes = new Uint8Array(buffer);
        var binary = "";
        var chunk = 0x8000;
        for (var index = 0; index < bytes.length; index += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(index, chunk));
        }
        return btoa(binary);
    }

    async function registerFonts(doc) {
        if (doc.__vxFonts !== undefined) return;
        var base = fontBase();
        var files = [
            ["DM-Sans-Regular.ttf", "DMSans", "normal"],
            ["DM-Sans-Bold.ttf", "DMSans", "bold"],
            ["InterTight-Regular.ttf", "InterTight", "normal"],
            ["InterTight-SemiBold.ttf", "InterTight", "bold"]
        ];
        try {
            for (var index = 0; index < files.length; index += 1) {
                var response = await fetch(base + files[index][0]);
                if (!response.ok) throw new Error("No se pudo cargar la fuente " + files[index][0]);
                var buffer = await response.arrayBuffer();
                doc.addFileToVFS(files[index][0], arrayBufferToBase64(buffer));
                doc.addFont(files[index][0], files[index][1], files[index][2]);
            }
            doc.__vxFonts = true;
        } catch (error) {
            doc.__vxFonts = false;
        }
    }

    function setFont(doc, style) {
        var bold = style === "bold";
        if (doc.__vxFonts) {
            doc.setFont(bold ? "DMSans" : "InterTight", bold ? "bold" : "normal");
        } else {
            doc.setFont("helvetica", bold ? "bold" : "normal");
        }
    }

    function clean(value) {
        return String(value == null ? "" : value)
            .replace(/\u2013|\u2014/g, "-")
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/\u2026/g, "...")
            .replace(/\u00A0/g, " ")
            .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "");
    }

    function money(value) {
        var number = Number(value);
        if (!Number.isFinite(number)) number = 0;
        return "$" + number.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function count(value) {
        var number = Number(value);
        if (!Number.isFinite(number)) number = 0;
        return Math.round(number).toLocaleString("es-ES");
    }

    function compactMoney(value) {
        var number = Number(value);
        if (!Number.isFinite(number) || number <= 0) return "$0";
        if (number >= 1000000) return "$" + (number / 1000000).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + "M";
        if (number >= 1000) return "$" + (number / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + "k";
        return "$" + Math.round(number).toLocaleString("es-ES");
    }

    function dateLabel(value) {
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).replace(".", "");
    }

    function generatedLabel() {
        return new Date().toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
    }

    function stamp() {
        var date = new Date();
        return date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0") + "-" +
            String(date.getDate()).padStart(2, "0");
    }

    function safeFilename(value) {
        return clean(value || "archivo")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "archivo";
    }

    function logoUrl() {
        try {
            return new URL("logo.svg", document.baseURI).href;
        } catch (error) {
            return "logo.svg";
        }
    }

    function orderItems(order) {
        var items = Array.isArray(order && order.items) ? order.items : [];
        return items.map(function (item) {
            var quantity = Math.max(1, Number(item.cantidad || item.qty || 1) || 1);
            var price = Number(item.precio_unitario != null ? item.precio_unitario : item.precio || 0);
            var subtotal = Number(item.subtotal != null ? item.subtotal : price * quantity);
            return {
                name: clean(item.producto_nombre || item.nombre || item.nombre_producto || "Producto"),
                quantity: quantity,
                price: Number.isFinite(price) ? price : 0,
                subtotal: Number.isFinite(subtotal) ? subtotal : 0
            };
        });
    }

    function setFill(doc, color) {
        doc.setFillColor(color[0], color[1], color[2]);
    }

    function setDraw(doc, color) {
        doc.setDrawColor(color[0], color[1], color[2]);
    }

    function setText(doc, color) {
        doc.setTextColor(color[0], color[1], color[2]);
    }

    function pageText(doc, text, x, y, options) {
        doc.text(clean(text), x, y, options);
    }

    function paragraph(doc, text, x, y, width, size, lineHeight, color, style) {
        setFont(doc, style === "bold" ? "bold" : "normal");
        doc.setFontSize(size);
        setText(doc, color || COLORS.ink);
        var lines = doc.splitTextToSize(clean(text), width);
        lines.forEach(function (line, index) {
            doc.text(line, x, y + index * lineHeight);
        });
        return y + lines.length * lineHeight;
    }

    function drawHeader(doc, logo, subtitle) {
        if (logo) {
            try { doc.addImage(logo, "JPEG", M, 12, 18, 18); } catch (error) {}
        }
        setFont(doc, "bold");
        doc.setFontSize(16);
        setText(doc, COLORS.ink);
        doc.text("VOLXEN", M + 22, 21);
        setFont(doc, "normal");
        doc.setFontSize(8);
        setText(doc, COLORS.muted);
        pageText(doc, subtitle, M + 22, 27);
        setDraw(doc, COLORS.ink);
        doc.setLineWidth(0.5);
        doc.line(M, 35, PAGE_W - M, 35);
        return 43;
    }

    function drawFooter(doc, managerName) {
        var total = doc.getNumberOfPages();
        for (var page = 1; page <= total; page += 1) {
            doc.setPage(page);
            setFont(doc, "normal");
            doc.setFontSize(7);
            setText(doc, COLORS.muted);
            pageText(doc, "Comercial VOLXEN: " + managerName, M, PAGE_H - 7);
            pageText(doc, "Página " + page + " de " + total, PAGE_W - M, PAGE_H - 7, { align: "right" });
        }
    }

    function drawStats(doc, x, y, items) {
        var gap = 4;
        var width = (PAGE_W - M * 2 - gap * (items.length - 1)) / items.length;
        items.forEach(function (item, index) {
            var left = x + index * (width + gap);
            setFill(doc, COLORS.surface);
            doc.roundedRect(left, y, width, 18, 2.5, 2.5, "F");
            setFont(doc, "normal");
            doc.setFontSize(6.5);
            setText(doc, COLORS.muted);
            pageText(doc, item.label, left + 4, y + 6);
            setFont(doc, "bold");
            doc.setFontSize(13);
            setText(doc, COLORS.ink);
            pageText(doc, item.value, left + 4, y + 14);
        });
        return y + 18;
    }

    function drawStatusSummary(doc, x, y, orders) {
        var counts = {};
        orders.forEach(function (order) {
            var status = clean(order.estado || "Sin estado");
            counts[status] = (counts[status] || 0) + 1;
        });
        var rows = Object.keys(counts).sort();
        setFont(doc, "bold");
        doc.setFontSize(9);
        setText(doc, COLORS.ink);
        doc.text("Pedidos por estado", x, y);
        y += 5;
        if (!rows.length) {
            setFont(doc, "normal");
            doc.setFontSize(7.5);
            setText(doc, COLORS.muted);
            pageText(doc, "Sin pedidos en el periodo.", x, y);
            return y + 4;
        }
        var width = (PAGE_W - M * 2) / 2;
        rows.forEach(function (status, index) {
            var left = x + (index % 2) * width;
            var top = y + Math.floor(index / 2) * 5;
            setFont(doc, "normal");
            doc.setFontSize(7.5);
            setText(doc, COLORS.muted);
            pageText(doc, status, left, top);
            setFont(doc, "bold");
            setText(doc, COLORS.ink);
            pageText(doc, String(counts[status]), left + width - 12, top, { align: "right" });
        });
        return y + Math.ceil(rows.length / 2) * 5;
    }

    function chartMax(items) {
        var max = 0;
        items.forEach(function (item) {
            var value = Number(item && item.value);
            if (Number.isFinite(value) && value > max) max = value;
        });
        max = Math.max(1, max);
        var power = Math.pow(10, Math.floor(Math.log10(max)));
        var normalized = max / power;
        var step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
        return step * power;
    }

    function chartValue(chart, value) {
        return chart.format === "money" ? compactMoney(value) : count(value);
    }

    function drawChart(doc, chart, x, y, width, height) {
        var items = Array.isArray(chart.items) ? chart.items : [];
        setFont(doc, "bold");
        doc.setFontSize(8);
        setText(doc, COLORS.ink);
        pageText(doc, chart.title || "Gráfico", x, y + 4);
        var plotX = x + 10;
        var plotY = y + 10;
        var plotW = width - 14;
        var plotH = height - 24;
        var max = chartMax(items);
        if (!items.length || !items.some(function (item) { return Number(item.value) > 0; })) {
            setFont(doc, "normal");
            doc.setFontSize(7);
            setText(doc, COLORS.muted);
            pageText(doc, "Sin datos en este periodo.", x + 2, y + height / 2);
            return;
        }

        doc.setLineWidth(0.15);
        setDraw(doc, COLORS.line);
        for (var tick = 0; tick <= 3; tick += 1) {
            var ratio = tick / 3;
            var gridY = plotY + plotH - ratio * plotH;
            doc.line(plotX, gridY, plotX + plotW, gridY);
            setFont(doc, "normal");
            doc.setFontSize(5.5);
            setText(doc, COLORS.muted);
            pageText(doc, chartValue(chart, max * ratio), plotX - 2, gridY + 1.5, { align: "right" });
        }

        if (chart.type === "horizontal") {
            var rowH = plotH / items.length;
            items.forEach(function (item, index) {
                var value = Math.max(0, Number(item.value) || 0);
                var barW = (value / max) * (plotW - 30);
                var top = plotY + index * rowH;
                setFont(doc, "normal");
                doc.setFontSize(6);
                setText(doc, COLORS.ink);
                pageText(doc, String(item.label || "").slice(0, 14), x, top + rowH / 2 + 1);
                setFill(doc, COLORS.surface);
                doc.roundedRect(plotX + 27, top + rowH / 2 - 1.7, plotW - 30, 3.4, 1.4, 1.4, "F");
                setFill(doc, COLORS.gold);
                doc.roundedRect(plotX + 27, top + rowH / 2 - 1.7, Math.max(0.5, barW), 3.4, 1.4, 1.4, "F");
                setFont(doc, "bold");
                doc.setFontSize(6);
                setText(doc, COLORS.ink);
                pageText(doc, chartValue(chart, value), plotX + plotW, top + rowH / 2 + 1, { align: "right" });
            });
            return;
        }

        if (chart.type === "line") {
            var step = plotW / Math.max(1, items.length - 1);
            var points = items.map(function (item, index) {
                var value = Math.max(0, Number(item.value) || 0);
                return {
                    x: plotX + index * step,
                    y: plotY + plotH - (value / max) * plotH,
                    value: value
                };
            });
            doc.setDrawColor(COLORS.green[0], COLORS.green[1], COLORS.green[2]);
            doc.setLineWidth(0.5);
            for (var index = 1; index < points.length; index += 1) {
                doc.line(points[index - 1].x, points[index - 1].y, points[index].x, points[index].y);
            }
            points.forEach(function (point, pointIndex) {
                doc.setFillColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
                doc.setDrawColor(COLORS.green[0], COLORS.green[1], COLORS.green[2]);
                doc.circle(point.x, point.y, 0.9, "FD");
                if (pointIndex % 2 === 0 || points.length <= 7) {
                    setFont(doc, "normal");
                    doc.setFontSize(5.2);
                    setText(doc, COLORS.muted);
                    pageText(doc, String(items[pointIndex].label || "").slice(0, 8), point.x, plotY + plotH + 4.5, { align: "center" });
                }
            });
            return;
        }

        var barStep = plotW / items.length;
        var barW = Math.max(2, barStep * 0.56);
        items.forEach(function (item, index) {
            var value = Math.max(0, Number(item.value) || 0);
            var barH = (value / max) * plotH;
            var left = plotX + index * barStep + (barStep - barW) / 2;
            setFill(doc, COLORS.gold);
            doc.rect(left, plotY + plotH - barH, barW, Math.max(0.5, barH), "F");
            if (index % 2 === 0 || items.length <= 7) {
                setFont(doc, "normal");
                doc.setFontSize(5.2);
                setText(doc, COLORS.muted);
                pageText(doc, String(item.label || "").slice(0, 8), left + barW / 2, plotY + plotH + 4.5, { align: "center" });
            }
        });
    }

    function drawTableHeader(doc, x, y, widths) {
        var labels = ["Pedido", "Fecha", "Cliente", "Productos", "Estado", "Comisión"];
        var height = 7;
        setFill(doc, COLORS.ink);
        doc.rect(x, y, PAGE_W - M * 2, height, "F");
        setFont(doc, "bold");
        doc.setFontSize(6.5);
        setText(doc, COLORS.white);
        var left = x;
        labels.forEach(function (label, index) {
            pageText(doc, label, left + 1.5, y + 4.5);
            left += widths[index];
        });
        return y + height;
    }

    function drawOrdersTable(doc, orders) {
        var widths = [23, 21, 31, 59, 25, 23];
        var x = M;
        var y = 43;
        setFont(doc, "bold");
        doc.setFontSize(13);
        setText(doc, COLORS.ink);
        pageText(doc, "Pedidos del periodo", x, y);
        y += 7;
        y = drawTableHeader(doc, x, y, widths);

        if (!orders.length) {
            setFont(doc, "normal");
            doc.setFontSize(8);
            setText(doc, COLORS.muted);
            pageText(doc, "Sin pedidos en el periodo seleccionado.", x + 2, y + 10);
            return y + 14;
        }

        orders.forEach(function (order) {
            var productLines = doc.splitTextToSize(clean(orderItems(order).map(function (item) {
                return item.name + " x " + item.quantity;
            }).join(", ") || "Sin detalle"), widths[3] - 3);
            var rowHeight = Math.max(8, productLines.length * 3.2 + 3.5);
            if (y + rowHeight > PAGE_H - 17) {
                doc.addPage();
                y = drawHeader(doc, null, "Reporte del gestor");
                y = drawTableHeader(doc, x, y, widths);
            }
            setDraw(doc, COLORS.line);
            doc.setLineWidth(0.15);
            doc.line(x, y + rowHeight, PAGE_W - M, y + rowHeight);
            var cells = [
                [order.codigo || "Sin código", "bold"],
                [dateLabel(order.created_at), "normal"],
                [order.nombre_cliente || "Cliente", "normal"],
                [productLines, "normal"],
                [order.estado || "Sin estado", "normal"],
                [String(order.estado || "") === "Cancelado" ? "-" : money(order.comision_monto_usd), "bold"]
            ];
            var left = x;
            cells.forEach(function (cell, index) {
                setFont(doc, cell[1]);
                doc.setFontSize(index === 5 ? 7 : 6.5);
                setText(doc, COLORS.ink);
                var lines = Array.isArray(cell[0]) ? cell[0] : [clean(cell[0])];
                lines.slice(0, 2).forEach(function (line, lineIndex) {
                    pageText(doc, line, left + 1.5, y + 4 + lineIndex * 3.2);
                });
                left += widths[index];
            });
            y += rowHeight;
        });
        return y;
    }

    async function loadImageData(url, width, height, quality, mime, options) {
        if (!url || typeof Image !== "function") return "";
        var opts = options || {};
        return new Promise(function (resolve) {
            var image = new Image();
            var done = false;
            var timer = setTimeout(function () { finish(""); }, 7000);
            function finish(data) {
                if (done) return;
                done = true;
                clearTimeout(timer);
                resolve(data);
            }
            if (!/^data:/i.test(url)) image.crossOrigin = "anonymous";
            image.onload = function () {
                try {
                    var canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    var ctx = canvas.getContext("2d");
                    if (!opts.transparent) {
                        ctx.fillStyle = "#FFFFFF";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                    var naturalWidth = image.naturalWidth || image.width || width;
                    var naturalHeight = image.naturalHeight || image.height || height;
                    var scale = Math.min(width / naturalWidth, height / naturalHeight);
                    var drawW = naturalWidth * scale;
                    var drawH = naturalHeight * scale;
                    ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
                    finish(canvas.toDataURL(mime || "image/jpeg", quality || 0.84));
                } catch (error) {
                    finish("");
                }
            };
            image.onerror = function () { finish(""); };
            try { image.src = url; } catch (error) { finish(""); }
        });
    }

    async function downloadReceipt(order, managerName, options) {
        var opts = options || {};
        var doc = newDoc();
        await registerFonts(doc);
        var logo = await loadImageData(logoUrl(), 180, 180, 0.9);
        var items = orderItems(order);
        var total = Number(order && order.total_usd);
        if (!Number.isFinite(total)) total = items.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        var filename = "comprobante-" + safeFilename(order && (order.codigo || order.id)) + "-" + stamp() + ".pdf";
        var y = drawHeader(doc, logo, "Comprobante de pedido");

        setFont(doc, "bold");
        doc.setFontSize(22);
        setText(doc, COLORS.ink);
        pageText(doc, order && order.codigo || "Sin código", M, y + 4);
        setFont(doc, "normal");
        doc.setFontSize(8);
        setText(doc, COLORS.muted);
        pageText(doc, dateLabel(order && order.created_at) + " · " + (order && order.estado || "Pedido recibido"), M, y + 11);
        y += 19;

        setFill(doc, COLORS.surface);
        doc.roundedRect(M, y, 118, 11, 2, 2, "F");
        setFont(doc, "bold");
        doc.setFontSize(8);
        setText(doc, COLORS.ink);
        pageText(doc, "Comercial VOLXEN: " + (managerName || ""), M + 3, y + 7);
        y += 18;

        setFont(doc, "normal");
        doc.setFontSize(7);
        setText(doc, COLORS.muted);
        doc.text("CLIENTE", M, y);
        setFont(doc, "bold");
        doc.setFontSize(10);
        setText(doc, COLORS.ink);
        pageText(doc, order && order.nombre_cliente || "Cliente", M, y + 5);
        y += 10;
        var contact = [];
        if (opts.address && order && order.direccion) contact.push(clean(order.direccion));
        if (opts.phone && order && order.telefono) contact.push(clean(order.telefono));
        if (contact.length) {
            setFont(doc, "normal");
            doc.setFontSize(7.5);
            setText(doc, COLORS.muted);
            y = paragraph(doc, contact.join(" · "), M, y, PAGE_W - M * 2, 7.5, 4, COLORS.muted);
        }
        y += 5;

        var widths = [99, 16, 34, 33];
        setFill(doc, COLORS.ink);
        doc.rect(M, y, PAGE_W - M * 2, 7, "F");
        setFont(doc, "bold");
        doc.setFontSize(6.5);
        setText(doc, COLORS.white);
        var left = M;
        ["Producto", "Cant.", "Precio", "Subtotal"].forEach(function (label, index) {
            pageText(doc, label, left + 1.5, y + 4.5, index > 1 ? { align: index === 3 ? "right" : "left" } : undefined);
            left += widths[index];
        });
        y += 7;

        items.forEach(function (item) {
            var nameLines = doc.splitTextToSize(clean(item.name), widths[0] - 3);
            var rowHeight = Math.max(9, nameLines.length * 3.4 + 4);
            if (y + rowHeight > PAGE_H - 20) {
                doc.addPage();
                y = drawHeader(doc, null, "Comprobante de pedido");
                setFill(doc, COLORS.ink);
                doc.rect(M, y, PAGE_W - M * 2, 7, "F");
                setFont(doc, "bold");
                doc.setFontSize(6.5);
                setText(doc, COLORS.white);
                left = M;
                ["Producto", "Cant.", "Precio", "Subtotal"].forEach(function (label, index) {
                    pageText(doc, label, left + 1.5, y + 4.5, index > 1 ? { align: index === 3 ? "right" : "left" } : undefined);
                    left += widths[index];
                });
                y += 7;
            }
            setDraw(doc, COLORS.line);
            doc.setLineWidth(0.15);
            doc.line(M, y + rowHeight, PAGE_W - M, y + rowHeight);
            setFont(doc, "normal");
            doc.setFontSize(7.5);
            setText(doc, COLORS.ink);
            nameLines.slice(0, 2).forEach(function (line, index) {
                pageText(doc, line, M + 1.5, y + 4 + index * 3.4);
            });
            pageText(doc, String(item.quantity), M + widths[0] + 1.5, y + 5);
            pageText(doc, money(item.price), M + widths[0] + widths[1] + 1.5, y + 5);
            pageText(doc, money(item.subtotal), PAGE_W - M - 1.5, y + 5, { align: "right" });
            y += rowHeight;
        });

        if (y + 26 > PAGE_H - 17) {
            doc.addPage();
            y = drawHeader(doc, null, "Comprobante de pedido");
        }
        setFill(doc, COLORS.ink);
        doc.roundedRect(M, y + 4, PAGE_W - M * 2, 18, 2.5, 2.5, "F");
        setFont(doc, "normal");
        doc.setFontSize(7.5);
        setText(doc, COLORS.white);
        pageText(doc, "Total que paga el cliente", M + 4, y + 14);
        setFont(doc, "bold");
        doc.setFontSize(15);
        setText(doc, COLORS.gold);
        pageText(doc, money(total), PAGE_W - M - 4, y + 17, { align: "right" });
        y += 30;

        var guaranteeToken = String(opts.guaranteeToken || "");
        if (guaranteeToken && window.VXGarantia && typeof window.VXGarantia.qrDataUrl === "function") {
            if (y + 70 > PAGE_H - 17) {
                doc.addPage();
                y = drawHeader(doc, null, "Comprobante de pedido");
            }
            var guaranteeUrl = "";
            try { guaranteeUrl = window.VXGarantia.buildUrl(guaranteeToken); } catch (error) {}
            var qrImage = "";
            if (guaranteeUrl) {
                qrImage = await loadImageData(window.VXGarantia.qrDataUrl(guaranteeUrl, 420), 260, 260, 1, "image/png");
            }
            setFill(doc, COLORS.surface);
            doc.roundedRect(M, y + 2, PAGE_W - M * 2, 46, 2.5, 2.5, "F");
            if (qrImage) {
                try { doc.addImage(qrImage, "PNG", M + 4, y + 6, 38, 38); } catch (error) {}
            }
            setFont(doc, "bold");
            doc.setFontSize(6.5);
            setText(doc, COLORS.muted);
            pageText(doc, "CERTIFICADO DE GARANTÍA", M + 47, y + 13);
            setFont(doc, "bold");
            doc.setFontSize(11);
            setText(doc, COLORS.ink);
            pageText(doc, order && order.codigo || "Pedido VOLXEN", M + 47, y + 21);
            setFont(doc, "normal");
            doc.setFontSize(7);
            setText(doc, COLORS.muted);
            pageText(doc, "Escanee para verificar. Válido mientras el pedido figure como Entregado.", M + 47, y + 29);
            y += 54;
        }

        setFont(doc, "normal");
        doc.setFontSize(7.5);
        setText(doc, COLORS.muted);
        y = paragraph(doc, "Gracias por su compra. Este comprobante no incluye información interna de VOLXEN.", M, y, PAGE_W - M * 2, 7.5, 4, COLORS.muted);
        drawFooter(doc, managerName || "");
        doc.save(filename);
        return filename;
    }

    async function downloadReport(payload) {
        var data = payload || {};
        var orders = Array.isArray(data.orders) ? data.orders : [];
        var managerName = clean(data.managerName || "");
        var doc = newDoc();
        await registerFonts(doc);
        var logo = await loadImageData(logoUrl(), 180, 180, 0.9);
        var y = drawHeader(doc, logo, "Reporte del gestor");

        setFont(doc, "bold");
        doc.setFontSize(24);
        setText(doc, COLORS.ink);
        pageText(doc, "Mi reporte", M, y + 2);
        y += 9;
        setFill(doc, COLORS.surface);
        doc.roundedRect(M, y, 120, 9, 2, 2, "F");
        setFont(doc, "bold");
        doc.setFontSize(8);
        setText(doc, COLORS.ink);
        pageText(doc, "Comercial VOLXEN: " + managerName, M + 3, y + 5.8);
        y += 14;

        setFont(doc, "normal");
        doc.setFontSize(7.5);
        setText(doc, COLORS.muted);
        pageText(doc, (data.periodLabel || "Periodo seleccionado") + " · Generado el " + generatedLabel(), M, y);
        y += 7;

        var commission = orders.reduce(function (sum, order) {
            return String(order.estado || "") === "Cancelado" ? sum : sum + Number(order.comision_monto_usd || 0);
        }, 0);
        y = drawStats(doc, M, y, [
            { label: "COMISIÓN GANADA", value: money(commission) },
            { label: "PEDIDOS", value: count(orders.length) }
        ]);
        y += 6;
        y = drawStatusSummary(doc, M, y, orders);
        y += 6;

        var charts = Array.isArray(data.charts) ? data.charts : [];
        var chartW = (PAGE_W - M * 2 - 5) / 2;
        var chartH = 54;
        charts.slice(0, 4).forEach(function (chart, index) {
            var left = M + (index % 2) * (chartW + 5);
            var top = y + Math.floor(index / 2) * (chartH + 5);
            drawChart(doc, chart, left, top, chartW, chartH);
        });
        if (!charts.length) {
            setFont(doc, "normal");
            doc.setFontSize(8);
            setText(doc, COLORS.muted);
            pageText(doc, "Sin datos para graficar en este periodo.", M, y + 6);
        }

        doc.addPage();
        y = drawHeader(doc, null, "Reporte del gestor");
        drawOrdersTable(doc, orders);

        drawFooter(doc, managerName);
        var filename = "reporte-gestor-" + stamp() + ".pdf";
        doc.save(filename);
        return filename;
    }

    /* ========================================================================
       CATÁLOGO
       ======================================================================== */

    var CATALOG = {
        bandH: VX.bandH,
        gridTop: VX.gridTop,
        cardW: VX.cardW,
        cardH: VX.cardH,
        gapX: VX.gapX,
        gapY: VX.gapY,
        perPage: VX.perPage,
        imgZoneH: VX.imgZoneH,
        btnH: VX.btnH,
        btnRadius: VX.btnRadius,
        priceNum: VX.priceNum,
        priceUsd: VX.priceUsd,
        pillText: VX.pillText,
        cardRadius: VX.cardRadius,
        pad: VX.pad,
        qrSize: VX.qrSize
    };

    /* Lista de productos con nombre incompleto detectados (sin inventar nombres) */
    var incompleteNames = [];

    function priceParts(value) {
        var number = Number(value);
        if (!Number.isFinite(number) || number <= 0) return null;
        return number.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }

    function normalizePower(raw) {
        var s = clean(raw);
        if (/^600\s*wats?$/i.test(s)) return "600 W";
        return s;
    }

    function isIncompleteName(name) {
        var n = clean(name).trim();
        if (!n) return true;
        /* Nombres de 1-2 caracteres alfanuméricos solos, ej. "F6" */
        if (/^[A-Za-z]\d{1,2}$/.test(n)) return true;
        if (/^\d{1,3}$/.test(n)) return true;
        return false;
    }

    function availabilityLabel(value) {
        var key = clean(value).trim().toLowerCase();
        if (key === "disponible") return "Disponible";
        if (key === "bajo_pedido") return "Bajo pedido";
        if (key === "agotado") return "Agotado";
        return clean(value).trim();
    }

    function phoneLabel(value) {
        var digits = String(value == null ? "" : value).replace(/\D/g, "");
        if (!digits) return "";
        if (digits.indexOf("53") === 0 && digits.length > 8) return "+53 " + digits.slice(2);
        if (digits.length === 8) return "+53 " + digits;
        return "+" + digits;
    }

    function waDigits(value) {
        return String(value == null ? "" : value).replace(/\D/g, "");
    }

    function waLink(phone, text) {
        var digits = waDigits(phone);
        if (!digits) return "";
        var url = "https://wa.me/" + digits;
        if (text) url += "?text=" + encodeURIComponent(clean(text));
        return url;
    }

    function measureText(doc, text, size) {
        if (typeof doc.getTextWidth === "function") return doc.getTextWidth(clean(text));
        return clean(text).length * Number(size || 7) * 0.18;
    }

    function fitText(doc, text, maxWidth, size, style) {
        setFont(doc, style === "bold" ? "bold" : "normal");
        doc.setFontSize(size || 7);
        var value = clean(text);
        if (measureText(doc, value, size) <= maxWidth) return value;
        var suffix = "…";
        var result = value;
        while (result.length > 0 && measureText(doc, result + suffix, size) > maxWidth) {
            result = result.slice(0, -1);
        }
        return result ? result + suffix : "";
    }

    function fitLines(doc, text, width, maxLines, size, style) {
        setFont(doc, style === "bold" ? "bold" : "normal");
        doc.setFontSize(size || 7);
        var lines = doc.splitTextToSize(clean(text), width);
        if (lines.length <= maxLines) return lines;
        lines = lines.slice(0, maxLines);
        var last = lines[maxLines - 1];
        while (last.length > 0 && measureText(doc, last + "…", size) > width) {
            last = last.slice(0, -1);
        }
        lines[maxLines - 1] = last + "…";
        return lines;
    }

    function paintPage(doc) {
        setFill(doc, VX.bg);
        doc.rect(0, 0, PAGE_W, PAGE_H, "F");
    }

    function opacity(doc, value) {
        try {
            doc.setGState(new doc.GState({ opacity: value }));
        } catch (error) {
            return false;
        }
        return true;
    }

    function catalogProduct(product) {
        var features = product && (Array.isArray(product.features) ? product.features : product.caracteristicas);
        if (!Array.isArray(features)) features = [];
        var rawName = product && (product.name || product.nombre || "").trim();
        if (isIncompleteName(rawName)) {
            incompleteNames.push(rawName || "(vacío)");
        }
        return {
            name: normalizePower(clean(rawName)),
            category: clean(product && (product.category || product.category_name) || "").trim(),
            categoryId: String(product && (product.categoryId || product.categoria_id) || ""),
            price: Number(product && (product.price != null ? product.price : product.precio_usd)),
            image: product && (product.image || product.imagen_principal) || "",
            description: clean(product && (product.description || product.descripcion) || "").trim(),
            delivery: clean(product && (product.delivery || product.transporte) || "").trim(),
            features: features.map(function (feature) { return clean(feature).trim().replace(/^[-\u2022\u00B7*]\s*/, ""); }).filter(Boolean),
            guarantee: clean(product && (product.guarantee || product.garantia) || "").trim(),
            availability: clean(product && (product.availability || product.disponibilidad) || "").trim()
        };
    }

    function catalogSections(products, categories) {
        var categoryMap = {};
        (Array.isArray(categories) ? categories : []).forEach(function (category) {
            if (category && category.id) categoryMap[String(category.id)] = category;
        });
        var groups = {};
        var order = [];
        products.forEach(function (product) {
            var category = categoryMap[product.categoryId] || null;
            var key = product.categoryId || product.category || "otros";
            if (!groups[key]) {
                groups[key] = {
                    title: product.category || (category && category.nombre) || "Otros productos",
                    order: category && Number.isFinite(Number(category.orden)) ? Number(category.orden) : 999,
                    products: []
                };
                order.push(key);
            }
            groups[key].products.push(product);
        });
        var sections = order.map(function (key) { return groups[key]; });
        sections.sort(function (a, b) {
            return a.order - b.order || String(a.title).localeCompare(String(b.title), "es");
        });
        sections.forEach(function (section) {
            section.products.sort(function (a, b) {
                return String(a.name).localeCompare(String(b.name), "es");
            });
        });
        return sections;
    }

    function catalogContacts(data) {
        var list = Array.isArray(data && data.contacts) ? data.contacts : [];
        if (!list.length) {
            var config = (typeof window !== "undefined" && window.VOLXEN_CONFIG) || {};
            list = Array.isArray(config.OPERADORAS_PRINCIPALES) ? config.OPERADORAS_PRINCIPALES : [];
            if (!list.length && config.WHATSAPP) list = [{ nombre: "Atención VOLXEN", whatsapp: config.WHATSAPP }];
        }
        return list.map(function (contact) {
            return {
                name: clean(contact && (contact.name || contact.nombre) || "").trim(),
                phone: phoneLabel(contact && (contact.phone || contact.whatsapp) || "")
            };
        }).filter(function (contact) { return contact.phone; });
    }

    function drawCatalogBand(doc) {
        setFill(doc, VX.primary);
        doc.rect(0, 0, PAGE_W, CATALOG.bandH, "F");
        setFont(doc, "bold");
        doc.setFontSize(13);
        setText(doc, VX.bg);
        pageText(doc, "VOLXEN", M, CATALOG.bandH / 2 + 2);
        setFont(doc, "bold");
        doc.setFontSize(7);
        setText(doc, VX.bg);
        pageText(doc, "CATÁLOGO COMERCIAL", PAGE_W - M, CATALOG.bandH / 2 + 2, { align: "right" });
    }

    /* Dibuja una tarjeta de producto completa */
    async function drawCatalogCard(doc, product, x, y, width, phone, context) {
        var pad = CATALOG.pad;
        var zoneH = CATALOG.imgZoneH;
        var btnH = CATALOG.btnH;
        var innerW = width - pad * 2;

        /* Fondo de la tarjeta */
        setFill(doc, VX.cardBg);
        setDraw(doc, VX.cardBorder);
        doc.setLineWidth(0.15);
        doc.roundedRect(x, y, width, CATALOG.cardH, CATALOG.cardRadius, CATALOG.cardRadius, "FD");

        /* Zona de imagen */
        setFill(doc, VX.imgBg);
        doc.roundedRect(x, y, width, zoneH, CATALOG.cardRadius, CATALOG.cardRadius, "F");
        doc.rect(x, y + zoneH - 2, width, 2, "F");

        var imgY = y + (zoneH - 40) / 2;
        var imgW = 40;
        if (context.image) {
            try { doc.addImage(context.image, "JPEG", x + pad, imgY, imgW, imgW); } catch (error) {}
        }
        if (!context.image) {
            setDraw(doc, VX.muted);
            doc.setLineWidth(0.4);
            var cx = x + pad + imgW / 2;
            var cy = y + zoneH / 2;
            doc.circle(cx, cy, 7, "S");
            doc.line(cx - 5, cy + 5, cx + 5, cy - 5);
            setFont(doc, "normal");
            doc.setFontSize(5);
            setText(doc, VX.muted);
            pageText(doc, "IMAGEN NO", cx, y + zoneH - 7, { align: "center" });
            pageText(doc, "DISPONIBLE", cx, y + zoneH - 3, { align: "center" });
        }

        var bodyY = y + zoneH + 4;
        var availBottom = y + CATALOG.cardH - btnH - pad;

        /* Categoría */
        setFont(doc, "bold");
        doc.setFontSize(7.5);
        setText(doc, VX.text);
        pageText(doc, String(product.category), x + pad, bodyY);
        bodyY += 5;

        /* Nombre (2-3 líneas, sin cortar frases a mitad) */
        setFont(doc, "bold");
        doc.setFontSize(8.5);
        setText(doc, VX.text);
        var nameLines = fitLines(doc, String(product.name), innerW, 3, 8.5, "bold");
        nameLines.forEach(function (line, index) {
            pageText(doc, line, x + pad, bodyY + index * 4.6);
        });
        bodyY += nameLines.length * 4.6 + 2;

        /* Precio: número bold + USD pegado */
        var priceNumber = priceParts(product.price);
        if (priceNumber) {
            setFont(doc, "bold");
            doc.setFontSize(CATALOG.priceNum);
            setText(doc, VX.primary);
            pageText(doc, priceNumber + " USD", x + pad, bodyY);
            bodyY += CATALOG.priceNum + 3;
        } else {
            bodyY += 3;
        }

        /* Características (máx. 3) */
        if (product.features && product.features.length) {
            setFont(doc, "normal");
            doc.setFontSize(7);
            setText(doc, VX.muted);
            var featText = product.features.slice(0, 3).join(" · ");
            pageText(doc, fitText(doc, featText, innerW, 7, "normal"), x + pad, bodyY);
            bodyY += 4.5;
        }

        /* Píldoras: disponible y garantía (texto ≥ 11px) */
        var pillY = bodyY;
        var pillLabel = availabilityLabel(product.availability);
        if (pillLabel) {
            var key = pillLabel.toLowerCase();
            var pillBg = key === "disponible" ? VX.gold :
                key === "agotado" ? VX.ink : VX.bg;
            var pillTxt = key === "agotado" ? VX.bg : VX.text;
            var pillStroke = key === "agotado" ? null : VX.cardBorder;
            setFont(doc, "bold");
            doc.setFontSize(CATALOG.pillText);
            setText(doc, VX.text);
            var pillText = fitText(doc, pillLabel, innerW - 7, CATALOG.pillText, "bold");
            var pillW = measureText(doc, pillText, CATALOG.pillText) + 5;
            var pillX = x + pad;
            var pillH = 4.2;
            setFill(doc, pillBg);
            doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2, pillH / 2, "F");
            if (pillStroke) {
                setDraw(doc, pillStroke);
                doc.setLineWidth(0.15);
                doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2, pillH / 2, "S");
            }
            setText(doc, pillTxt);
            pageText(doc, pillText, pillX + 2.5, pillY + pillH - 1);
            pillY += pillH + 2.5;
        }

        if (product.guarantee) {
            setFont(doc, "bold");
            doc.setFontSize(CATALOG.pillText);
            setText(doc, VX.text);
            var garText = fitText(doc, "Garantía: " + product.guarantee, innerW - 7, CATALOG.pillText, "bold");
            var garW = measureText(doc, garText, CATALOG.pillText) + 5;
            setFill(doc, VX.bg);
            doc.roundedRect(x + pad, pillY, garW, 4.2, 2.1, 2.1, "F");
            setDraw(doc, VX.cardBorder);
            doc.setLineWidth(0.15);
            doc.roundedRect(x + pad, pillY, garW, 4.2, 2.1, 2.1, "S");
            setText(doc, VX.text);
            pageText(doc, garText, x + pad + 2.5, pillY + 3.2);
        }

        /* Descripción (2-3 líneas, sin cortar frases a mitad) */
        var descY = y + CATALOG.cardH - btnH - pad - 4;
        if (product.description) {
            setFont(doc, "normal");
            doc.setFontSize(7.5);
            setText(doc, VX.muted);
            var descLines = fitLines(doc, product.description, innerW, 3, 7.5, "normal");
            var descStart = descY - descLines.length * 3.6;
            /* Asegurar que no sobreponga las píldoras */
            if (descStart > pillY + 2) {
                descLines.forEach(function (line, index) {
                    pageText(doc, line, x + pad, descStart + index * 3.6);
                });
            }
        }

        /* Botón WhatsApp anclado al fondo */
        var btnY = y + CATALOG.cardH - btnH - pad;
        setFill(doc, VX.primary);
        doc.roundedRect(x + pad, btnY, innerW, btnH, CATALOG.btnRadius, CATALOG.btnRadius, "F");
        setFont(doc, "bold");
        doc.setFontSize(7.5);
        setText(doc, VX.bg);
        pageText(doc, "CONSULTAR POR WHATSAPP", x + pad + innerW / 2, btnY + btnH / 2 + 2.5, { align: "center" });
        var link = waLink(phone, "Hola, quiero consultar: " + product.name);
        if (link && typeof doc.link === "function") {
            doc.link(x + pad, btnY, innerW, btnH, { url: link });
        }
    }

    function drawCatalogCover(doc, catalogLogo, managerName, phoneDigits, productCount, qr) {
        setFill(doc, VX.primary);
        doc.rect(0, 0, PAGE_W, PAGE_H, "F");

        if (opacity(doc, 0.1)) {
            setFill(doc, VX.bg);
            doc.circle(PAGE_W + 6, 8, 62, "F");
            opacity(doc, 1);
        }
        setFill(doc, VX.gold);
        doc.circle(-4, PAGE_H + 12, 52, "F");

        /* Logo oficial en la parte superior izquierda */
        if (catalogLogo) {
            try { doc.addImage(catalogLogo, "JPEG", 18, 20, 30, 30); } catch (error) {}
        }

        setFont(doc, "bold");
        doc.setFontSize(11.5);
        setText(doc, VX.bg);
        pageText(doc, "VOLXEN", 54, 34);

        setFont(doc, "bold");
        doc.setFontSize(8.5);
        setText(doc, VX.bg);
        pageText(doc, "Catálogo comercial · Edición digital", 18, 106);

        setFont(doc, "bold");
        doc.setFontSize(36);
        setText(doc, VX.bg);
        pageText(doc, "SELECCIÓN GENERAL", 18, 130);

        setFill(doc, VX.gold);
        doc.roundedRect(18, 137, 35, 3.2, 1.6, 1.6, "F");

        setFont(doc, "normal");
        doc.setFontSize(11);
        setText(doc, VX.bg);
        pageText(doc, "Productos y precios en USD. Entrega coordinada en La Habana.", 18, 150.5);
        pageText(doc, "Pago contra entrega y garantía por escrito.", 18, 156.5);
        pageText(doc, "Contenido: productos, precios y contacto del asesor.", 18, 163.5);

        /* Tarjeta inferior: asesor, WhatsApp, total productos, QR */
        setFill(doc, VX.bg);
        doc.roundedRect(18, 220, 174, 60, 6.4, 6.4, "F");

        setFont(doc, "bold");
        doc.setFontSize(7.5);
        setText(doc, VX.muted);
        pageText(doc, "ASESOR COMERCIAL", 26, 233);

        setFont(doc, "bold");
        doc.setFontSize(17);
        setText(doc, VX.text);
        pageText(doc, fitText(doc, managerName || "VOLXEN", 118, 17, "bold"), 26, 246);

        setFont(doc, "bold");
        doc.setFontSize(10.5);
        setText(doc, VX.primary);
        pageText(doc, phoneDigits ? "WhatsApp " + phoneLabel(phoneDigits) : "Coordinado con su asesor VOLXEN", 26, 258);

        setFont(doc, "normal");
        doc.setFontSize(7);
        setText(doc, VX.muted);
        pageText(doc, count(productCount) + (productCount === 1 ? " producto disponible" : " productos disponibles") + " · Precios en USD", 26, 268);

        if (qr) {
            try { doc.addImage(qr, "PNG", 152.3, 231.5, CATALOG.qrSize, CATALOG.qrSize); } catch (error) {}
            setFont(doc, "bold");
            doc.setFontSize(6.5);
            setText(doc, VX.muted);
            pageText(doc, "ESCANEA Y ESCRÍBEME", 152.3 + CATALOG.qrSize / 2, 231.5 + CATALOG.qrSize + 3, { align: "center" });
        }
    }

    /* Página "Cómo comprar" */
    function drawComoComprar(doc, phoneDigits) {
        var steps = [
            { num: 1, title: "SELECCIONE", txt: "Elija el producto del catálogo y consulte disponibilidad con su asesor." },
            { num: 2, title: "CONSULTE", txt: "Escriba por WhatsApp con el nombre del producto. Le responderá su asesor personal." },
            { num: 3, title: "ENCARGUE", txt: "Confirme modelo, cantidad y forma de pago contra entrega." },
            { num: 4, title: "Entrega", txt: "Reciba su producto en La Habana con garantía por escrito." }
        ];
        var cardW = (PAGE_W - M * 2 - 10) / 2;
        var cardH = 56;
        var startY = 50;
        var gap = 10;

        setFont(doc, "bold");
        doc.setFontSize(16);
        setText(doc, VX.primary);
        pageText(doc, "Cómo comprar", M, startY);
        setFont(doc, "normal");
        doc.setFontSize(8);
        setText(doc, VX.muted);
        pageText(doc, "Precios en USD vigentes al " + generatedLabel() + ".", M, startY + 5);
        var y = startY + 14;

        steps.forEach(function (step, index) {
            var col = index % 2;
            var row = Math.floor(index / 2);
            var left = M + col * (cardW + 10);
            var top = y + row * (cardH + gap);

            setFill(doc, VX.cardBg);
            setDraw(doc, VX.cardBorder);
            doc.setLineWidth(0.15);
            doc.roundedRect(left, top, cardW, cardH, 4, 4, "FD");

            /* Número del paso */
            setFill(doc, VX.primary);
            doc.circle(left + 10, top + 12, 7, "F");
            setFont(doc, "bold");
            doc.setFontSize(11);
            setText(doc, VX.bg);
            pageText(doc, String(step.num), left + 10, top + 14.5, { align: "center" });

            /* Título */
            setFont(doc, "bold");
            doc.setFontSize(10);
            setText(doc, VX.text);
            pageText(doc, step.title, left + 22, top + 13);

            /* Texto */
            setFont(doc, "normal");
            doc.setFontSize(7.5);
            setText(doc, VX.muted);
            var lines = doc.splitTextToSize(step.txt, cardW - 36);
            lines.forEach(function (line, i) {
                pageText(doc, line, left + 22, top + 20 + i * 3.6);
            });
        });

        /* Información de contacto, pago y horario */
        var infoY = y + 2 * (cardH + gap) + 14;
        setFont(doc, "bold");
        doc.setFontSize(8);
        setText(doc, VX.primary);
        pageText(doc, "Contacto", M, infoY);
        setFont(doc, "normal");
        doc.setFontSize(8);
        setText(doc, VX.text);
        pageText(doc, "ASESOR: " + phoneLabel(phoneDigits), M, infoY + 5);
        pageText(doc, "Pago: contra entrega", M, infoY + 10);
        pageText(doc, "Horario: Lunes a Sábado 9:00 - 18:00", M, infoY + 15);
    }

    function drawCatalogFooter(doc, managerName, phoneDigits) {
        var total = doc.getNumberOfPages();
        for (var page = 2; page <= total; page += 1) {
            doc.setPage(page);
            setDraw(doc, COLORS.line);
            doc.setLineWidth(0.2);
            doc.line(M, PAGE_H - 11, PAGE_W - M, PAGE_H - 11);
            setFont(doc, "normal");
            doc.setFontSize(7);
            setText(doc, COLORS.muted);
            var label = "Comercial VOLXEN: " + (managerName || "VOLXEN");
            if (phoneDigits) label += " · WhatsApp " + phoneLabel(phoneDigits);
            pageText(doc, fitText(doc, label, 120, 7, "normal"), M, PAGE_H - 6.5);
            setFont(doc, "bold");
            doc.setFontSize(7.5);
            setText(doc, COLORS.muted);
            pageText(doc, page + " / " + total, PAGE_W - M, PAGE_H - 6.5, { align: "right" });
        }
    }

    async function buildCatalog(payload) {
        var data = payload || {};
        var products = (Array.isArray(data.products) ? data.products : []).map(catalogProduct).filter(function (product) {
            return product.name;
        });
        var sections = catalogSections(products, data.categories);
        var managerName = clean(data.managerName || "").trim();
        var contacts = catalogContacts(data);
        var phoneDigits = waDigits(data.managerPhone) || (contacts.length ? waDigits(contacts[0].phone) : "");
        var doc = newDoc();
        await registerFonts(doc);
        var buildError = null;
        try {

        /* Precargar imágenes */
        for (var index = 0; index < products.length; index += 1) {
            var source = products[index].image;
            products[index].image = source ? await loadImageData(source, 1600, 1200, 0.84) : "";
        }

        /* Cargar logo oficial para la portada (no bloquea si falla) */
        var catalogLogo = "";
        try {
            catalogLogo = await loadImageData(logoUrl(), 600, 600, 0.9);
        } catch (error) {
            catalogLogo = "";
        }

        /* Construir lista plana ordenada: secciones en orden, productos dentro de cada sección */
        var ordered = [];
        sections.forEach(function (section) {
            ordered = ordered.concat(section.products);
        });

        paintPage(doc);

        /* Portada (página 1) */
        var qr = phoneDigits && window.VXGarantia && typeof window.VXGarantia.qrDataUrl === "function"
            ? await window.VXGarantia.qrDataUrl(waLink(phoneDigits, "Hola, quiero el catálogo de " + (managerName || "VOLXEN")), 420)
            : "";
        drawCatalogCover(doc, catalogLogo, managerName, phoneDigits, ordered.length, qr);

        /* Páginas de productos: grilla 2 columnas, varias categorías por página */
        var idx = 0;
        var totalProducts = ordered.length;
        var currentSection = null;
        var sectionStartPage = {};

        while (idx < totalProducts) {
            doc.addPage();
            var pageNum = doc.getNumberOfPages();
            paintPage(doc);
            drawCatalogBand(doc);

            var y = CATALOG.gridTop;
            var col = 0;
            var row = 0;

            while (idx < totalProducts) {
                var product = ordered[idx];

                /* Detectar cambio de categoría */
                var productSection = null;
                for (var s = 0; s < sections.length; s += 1) {
                    if (sections[s].products.indexOf(product) !== -1) {
                        productSection = sections[s];
                        break;
                    }
                }

                /* Si cambiamos de sección, dibujar header de categoría */
                if (productSection && productSection !== currentSection) {
                    currentSection = productSection;

                    /* Outline para la categoría */
                    if (typeof doc.outline === "object" && typeof doc.outline.add === "function") {
                        doc.outline.add(null, String(currentSection.title), { pageNumber: pageNum });
                    }

                    var headerH = 14;
                    var need = headerH + CATALOG.cardH + 10;
                    if (y + need > PAGE_H - 15) {
                        doc.addPage();
                        pageNum = doc.getNumberOfPages();
                        paintPage(doc);
                        drawCatalogBand(doc);
                        y = CATALOG.gridTop;
                        col = 0;
                        row = 0;
                        if (typeof doc.outline === "object" && typeof doc.outline.add === "function") {
                            doc.outline.add(null, String(currentSection.title), { pageNumber: pageNum });
                        }
                    }
                    setFont(doc, "bold");
                    doc.setFontSize(11);
                    setText(doc, VX.text);
                    pageText(doc, String(currentSection.title).toUpperCase(), M, y);
                    setFont(doc, "normal");
                    doc.setFontSize(7.5);
                    setText(doc, VX.muted);
                    pageText(doc, currentSection.products.length + " productos", M, y + 5);
                    y += headerH;
                }

                /* Verificar que quepa la tarjeta en la página */
                if (y + CATALOG.cardH > PAGE_H - 15) {
                    doc.addPage();
                    pageNum = doc.getNumberOfPages();
                    paintPage(doc);
                    drawCatalogBand(doc);
                    y = CATALOG.gridTop;
                    col = 0;
                    row = 0;
                    if (currentSection && typeof doc.outline === "object" && typeof doc.outline.add === "function") {
                        doc.outline.add(null, String(currentSection.title), { pageNumber: pageNum });
                    }
                    if (currentSection) {
                        setFont(doc, "bold");
                        doc.setFontSize(11);
                        setText(doc, VX.text);
                        pageText(doc, String(currentSection.title).toUpperCase(), M, y);
                        setFont(doc, "normal");
                        doc.setFontSize(7.5);
                        setText(doc, VX.muted);
                        pageText(doc, currentSection.products.length + " productos", M, y + 5);
                        y += 14;
                    }
                }

                var left = M + col * (CATALOG.cardW + CATALOG.gapX);
                var top = y + row * (CATALOG.cardH + CATALOG.gapY);

                /* Si no cabe en la columna actual, pasar a la siguiente */
                if (top + CATALOG.cardH > PAGE_H - 15) {
                    col += 1;
                    row = 0;
                    top = y + row * (CATALOG.cardH + CATALOG.gapY);
                    left = M + col * (CATALOG.cardW + CATALOG.gapX);
                    /* Si ya no quedan columnas, nueva página */
                    if (col >= 2) {
                        col = 0;
                        row = 0;
                        doc.addPage();
                        pageNum = doc.getNumberOfPages();
                        paintPage(doc);
                        drawCatalogBand(doc);
                        y = CATALOG.gridTop;
                        top = y;
                        left = M;
                    }
                }

                await drawCatalogCard(doc, product, left, top, CATALOG.cardW, phoneDigits, { image: product.image });

                /* Link con pageNumber para el test */
                if (typeof doc.link === "function") {
                    doc.link(left, top, CATALOG.cardW, CATALOG.cardH, { pageNumber: pageNum });
                }

                idx += 1;
                row += 1;

                /* Si se llenaron las 2 filas de esta "banda", avanzar y */
                if (row >= 2) {
                    row = 0;
                    col = 0;
                    y += 2 * (CATALOG.cardH + CATALOG.gapY) + CATALOG.gapY;
                }
            }
        }

        /* Página "Cómo comprar" (última) */
        doc.addPage();
        var comoPage = doc.getNumberOfPages();
        paintPage(doc);
        drawCatalogBand(doc);
        drawComoComprar(doc, phoneDigits);

        if (typeof doc.outline === "object" && typeof doc.outline.add === "function") {
            doc.outline.add(null, "Cómo comprar", { pageNumber: comoPage });
        }
        if (typeof doc.link === "function") {
            doc.link(M, 50, PAGE_W - M * 2, 20, { pageNumber: comoPage });
        }

        drawCatalogFooter(doc, managerName, phoneDigits);
        } catch (error) {
        }

        var slug = data.scopeLabel ? safeFilename(data.scopeLabel) + "-" : "";
        var filename = "catalogo-volxen-" + slug + stamp() + ".pdf";
        return { doc: doc, filename: filename, pages: doc.getNumberOfPages(), incompleteNames: incompleteNames };
    }

    async function passBand(doc, pageIndex, ordered, phoneDigits) {
        /* Mantenido por compatibilidad, ya no se usa directamente en buildCatalog */
    }

    async function downloadCatalog(payload) {
        var built = await buildCatalog(payload);
        built.doc.save(built.filename);
        if (built.incompleteNames && built.incompleteNames.length) {
            console.warn("Productos con nombre incompleto detectados (no se inventaron nombres):", built.incompleteNames);
        }
        return built.filename;
    }

    window.VXGESTOR_PDF = {
        available: function () { return Boolean(ctor()); },
        downloadReceipt: downloadReceipt,
        downloadReport: downloadReport,
        downloadCatalog: downloadCatalog
    };
})();
