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
            binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
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
            return new URL("brand/logo.svg", document.baseURI).href;
        } catch (error) {
            return "brand/logo.svg";
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

    function pad2(value) {
        var number = Math.max(0, Number(value) || 0);
        return String(number).padStart(2, "0");
    }

    function priceUsd(value) {
        var number = Number(value);
        if (!Number.isFinite(number) || number <= 0) return "";
        return number.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }) + " USD";
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

    function measureText(doc, text, size) {
        if (typeof doc.getTextWidth === "function") return doc.getTextWidth(clean(text));
        return clean(text).length * Number(size || 7) * 0.18;
    }

    function fitText(doc, text, maxWidth, size, style) {
        setFont(doc, style === "bold" ? "bold" : "normal");
        doc.setFontSize(size || 7);
        var value = clean(text);
        if (measureText(doc, value, size) <= maxWidth) return value;
        var suffix = "...";
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
        while (last.length > 0 && measureText(doc, last + "...", size) > width) {
            last = last.slice(0, -1);
        }
        lines[maxLines - 1] = last + "...";
        return lines;
    }

    function paintPage(doc) {
        setFill(doc, COLORS.paper);
        doc.rect(0, 0, PAGE_W, PAGE_H, "F");
    }

    function addOutline(doc, title, pageNumber) {
        if (!doc.outline || typeof doc.outline.add !== "function") return;
        doc.outline.add(null, clean(title), { pageNumber: pageNumber });
    }

    function addLink(doc, x, y, width, height, pageNumber) {
        if (typeof doc.link !== "function") return;
        doc.link(x, y, width, height, { pageNumber: pageNumber });
    }

    function catalogProduct(product) {
        var features = product && (Array.isArray(product.features) ? product.features : product.caracteristicas);
        if (!Array.isArray(features)) features = [];
        return {
            name: clean(product && (product.name || product.nombre) || "").trim(),
            category: clean(product && (product.category || product.category_name) || "").trim(),
            categoryId: String(product && (product.categoryId || product.categoria_id) || ""),
            price: Number(product && (product.price != null ? product.price : product.precio_usd)),
            image: product && (product.image || product.imagen_principal) || "",
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
            section.pageCount = Math.max(1, Math.ceil(section.products.length / 4));
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

    function colorHex(color) {
        return "#" + color.map(function (value) {
            return Math.max(0, Math.min(255, Number(value) || 0)).toString(16).padStart(2, "0");
        }).join("");
    }

    async function loadIconData(name, color) {
        if (typeof window.getShareIcon !== "function") return "";
        var svg = "";
        try { svg = window.getShareIcon(name) || ""; } catch (error) { return ""; }
        if (!svg) return "";
        var hex = colorHex(color);
        var colored = svg.replace(/currentColor/g, hex).replace(/<svg\b([^>]*)>/, function (match, attributes) {
            var extra = "";
            if (!/(^|\s)xmlns=/.test(attributes)) extra += ' xmlns="http://www.w3.org/2000/svg"';
            if (!/(^|\s)width=/.test(attributes)) extra += ' width="64"';
            if (!/(^|\s)height=/.test(attributes)) extra += ' height="64"';
            return "<svg" + extra + attributes + ">";
        });
        var url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(colored);
        return loadImageData(url, 64, 64, 1, "image/png", { transparent: true });
    }

    async function catalogIcon(cache, name, color) {
        var key = String(name) + "|" + color.join(",");
        if (!Object.prototype.hasOwnProperty.call(cache, key)) {
            cache[key] = loadIconData(name, color);
        }
        return cache[key];
    }

    function drawChip(doc, x, y, text, icon, options) {
        var opts = options || {};
        var maxX = opts.maxX == null ? PAGE_W - M : opts.maxX;
        var available = Math.max(0, maxX - x);
        if (available < 12) return x;
        setFont(doc, "normal");
        doc.setFontSize(5.5);
        var requested = opts.maxWidth == null ? available : opts.maxWidth;
        var label = fitText(doc, text, Math.max(0, Math.min(requested, available) - 9), 5.5, "normal");
        if (!label) return x;
        var width = Math.min(available, measureText(doc, label, 5.5) + 9);
        setFill(doc, opts.fill || COLORS.surface);
        doc.roundedRect(x, y, width, 5.5, 2.5, 2.5, "F");
        if (icon) {
            try { doc.addImage(icon, "PNG", x + 1.6, y + 1.2, 3.1, 3.1); } catch (error) {}
        } else {
            setFill(doc, opts.dot || COLORS.gold);
            doc.circle(x + 3.1, y + 2.75, 0.8, "F");
        }
        setFont(doc, "normal");
        doc.setFontSize(5.5);
        setText(doc, opts.text || COLORS.green);
        pageText(doc, label, x + 5.8, y + 3.7);
        return x + width;
    }

    async function drawCatalogCard(doc, product, x, y, width, height, iconCache) {
        setFill(doc, COLORS.white);
        setDraw(doc, COLORS.line);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, y, width, height, 3, 3, "FD");

        setFill(doc, COLORS.paper);
        doc.roundedRect(x + 3, y + 3, width - 6, 45, 2, 2, "F");
        var image = product.image ? await loadImageData(product.image, 900, 494, 0.84) : "";
        if (image) {
            try { doc.addImage(image, "JPEG", x + 3, y + 3, width - 6, 45); } catch (error) {}
        } else {
            setFont(doc, "normal");
            doc.setFontSize(6.5);
            setText(doc, COLORS.muted);
            pageText(doc, "Sin imagen", x + width / 2, y + 27, { align: "center" });
        }

        if (product.category) {
            setFont(doc, "normal");
            doc.setFontSize(5.5);
            setText(doc, COLORS.muted);
            pageText(doc, fitText(doc, product.category.toUpperCase(), width - 8, 5.5, "normal"), x + 4, y + 53);
        }

        setFont(doc, "bold");
        doc.setFontSize(8.5);
        setText(doc, COLORS.ink);
        var nameLines = fitLines(doc, product.name, width - 8, 2, 8.5, "bold");
        nameLines.forEach(function (line, index) {
            pageText(doc, line, x + 4, y + 58 + index * 3.8);
        });

        var price = priceUsd(product.price);
        if (price) {
            setFont(doc, "bold");
            doc.setFontSize(12);
            setText(doc, COLORS.green);
            pageText(doc, price, x + 4, y + 72);
        }

        var usedIcons = [];
        var specY = y + 80;
        var specBottom = y + 95;
        var features = product.features.slice(0, 4);
        for (var featureIndex = 0; featureIndex < features.length; featureIndex += 1) {
            var feature = features[featureIndex];
            var lines = fitLines(doc, feature, width - 14, 2, 6.3, "normal");
            var rowHeight = lines.length * 3.1 + 1.6;
            if (specY + rowHeight > specBottom) break;
            var iconName = typeof window.selectShareIcon === "function" ? window.selectShareIcon(feature, "", usedIcons) : "check";
            var icon = await catalogIcon(iconCache, iconName, COLORS.green);
            if (icon) {
                try { doc.addImage(icon, "PNG", x + 4, specY, 3.4, 3.4); } catch (error) {}
            } else {
                setFill(doc, COLORS.gold);
                doc.circle(x + 5.7, specY + 1.7, 0.9, "F");
            }
            setFont(doc, "normal");
            doc.setFontSize(6.3);
            setText(doc, COLORS.ink);
            lines.forEach(function (line, lineIndex) {
                pageText(doc, line, x + 9.5, specY + 2.6 + lineIndex * 3.1);
            });
            specY += rowHeight;
        }

        var chipY = y + height - 8.5;
        var chipX = x + 4;
        var chipMaxX = x + width - 4;
        if (product.guarantee) {
            var guaranteeIcon = await catalogIcon(iconCache, "garantia", COLORS.green);
            var reserve = product.availability ? 20 : 0;
            chipX = drawChip(doc, chipX, chipY, "Garantía: " + product.guarantee, guaranteeIcon, {
                fill: COLORS.surface,
                text: COLORS.green,
                dot: COLORS.green,
                maxWidth: chipMaxX - chipX - reserve,
                maxX: chipMaxX
            });
            chipX += 2;
        }
        if (product.availability) {
            var label = availabilityLabel(product.availability);
            if (label) {
                var available = label === "Disponible";
                var availabilityIcon = await catalogIcon(iconCache, available ? "check" : "calendario", available ? COLORS.white : COLORS.ink);
                chipX = drawChip(doc, chipX, chipY, label, availabilityIcon, {
                    fill: available ? COLORS.green : COLORS.gold,
                    text: available ? COLORS.white : COLORS.ink,
                    dot: available ? COLORS.white : COLORS.ink,
                    maxWidth: chipMaxX - chipX,
                    maxX: chipMaxX
                });
            }
        }
    }

    async function drawCatalogCategoryPage(doc, section, pageIndex, sectionIndex, logo, iconCache) {
        drawHeader(doc, logo, "Catálogo de productos");
        var continuation = pageIndex > 0;
        var title = continuation ? section.title + " (continuación)" : section.title;
        var titleX = continuation ? M : M + 13;
        if (!continuation) {
            setFont(doc, "bold");
            doc.setFontSize(10);
            setText(doc, COLORS.gold);
            pageText(doc, pad2(sectionIndex + 1), M, 48);
        }
        setFont(doc, "bold");
        doc.setFontSize(continuation ? 15 : 20);
        setText(doc, COLORS.green);
        pageText(doc, fitText(doc, title, PAGE_W - M * 2 - (continuation ? 0 : 13), continuation ? 15 : 20, "bold"), titleX, 48);
        setFont(doc, "normal");
        doc.setFontSize(8);
        setText(doc, COLORS.muted);
        pageText(doc, section.products.length + (section.products.length === 1 ? " producto" : " productos"), titleX, 54);
        setDraw(doc, COLORS.gold);
        doc.setLineWidth(0.8);
        doc.line(M, 58, M + 30, 58);

        var cardW = (PAGE_W - M * 2 - 6) / 2;
        var cardH = 105;
        var start = pageIndex * 4;
        var pageProducts = section.products.slice(start, start + 4);
        for (var index = 0; index < pageProducts.length; index += 1) {
            var left = M + (index % 2) * (cardW + 6);
            var top = 64 + Math.floor(index / 2) * (cardH + 6);
            await drawCatalogCard(doc, pageProducts[index], left, top, cardW, cardH, iconCache);
        }
        if (pageIndex === 0) addOutline(doc, section.title, section.startPage);
    }

    async function drawCatalogHowToPage(doc, contacts, logo, iconCache, pageNumber) {
        drawHeader(doc, logo, "Guía de compra");
        setFont(doc, "bold");
        doc.setFontSize(30);
        setText(doc, COLORS.green);
        pageText(doc, "Cómo comprar", M, 62);
        setFont(doc, "normal");
        doc.setFontSize(10);
        setText(doc, COLORS.muted);
        pageText(doc, "Entrega, pago, garantía y horario", M, 72);
        setDraw(doc, COLORS.gold);
        doc.setLineWidth(0.8);
        doc.line(M, 78, M + 30, 78);

        var blocks = [
            { icon: "entrega", title: "Entrega", text: "Entrega coordinada en La Habana. La entrega y el horario se acuerdan con su asesor." },
            { icon: "pago", title: "Pago", text: "Pago contra entrega. USD, EUR, CUP o Zelle." },
            { icon: "garantia", title: "Garantía", text: "Garantía por escrito, documentada en cada equipo." },
            { icon: "calendario", title: "Horario", text: "El horario de entrega se coordina con su asesor." }
        ];
        var blockW = (PAGE_W - M * 2 - 6) / 2;
        var blockH = 52;
        for (var index = 0; index < blocks.length; index += 1) {
            var block = blocks[index];
            var left = M + (index % 2) * (blockW + 6);
            var top = 88 + Math.floor(index / 2) * (blockH + 6);
            setFill(doc, COLORS.white);
            setDraw(doc, COLORS.line);
            doc.setLineWidth(0.2);
            doc.roundedRect(left, top, blockW, blockH, 3, 3, "FD");
            setFill(doc, COLORS.green);
            doc.circle(left + 11, top + 12, 6, "F");
            var icon = await catalogIcon(iconCache, block.icon, COLORS.white);
            if (icon) {
                try { doc.addImage(icon, "PNG", left + 8.5, top + 9.5, 5, 5); } catch (error) {}
            }
            setFont(doc, "bold");
            doc.setFontSize(10);
            setText(doc, COLORS.green);
            pageText(doc, block.title, left + 21, top + 11.5);
            setFont(doc, "normal");
            doc.setFontSize(7.5);
            setText(doc, COLORS.ink);
            paragraph(doc, block.text, left + 8, top + 24, blockW - 16, 7.5, 4.2, COLORS.ink);
        }

        var contactY = 210;
        setFill(doc, COLORS.green);
        doc.roundedRect(M, contactY, PAGE_W - M * 2, 58, 3, 3, "F");
        setFont(doc, "bold");
        doc.setFontSize(6.5);
        setText(doc, COLORS.gold);
        pageText(doc, "Contacto", M + 6, contactY + 12);
        setFont(doc, "bold");
        doc.setFontSize(15);
        setText(doc, COLORS.white);
        pageText(doc, "WhatsApp", M + 6, contactY + 22);
        if (contacts.length) {
            contacts.slice(0, 4).forEach(function (contact, index) {
                var line = (contact.name ? contact.name + " · " : "") + contact.phone;
                setFont(doc, index === 0 ? "bold" : "normal");
                doc.setFontSize(9);
                setText(doc, COLORS.white);
                pageText(doc, fitText(doc, line, PAGE_W - M * 2 - 12, 9, index === 0 ? "bold" : "normal"), M + 6, contactY + 32 + index * 7);
            });
        } else {
            setFont(doc, "normal");
            doc.setFontSize(8);
            setText(doc, COLORS.white);
            pageText(doc, "Consulte con su asesor.", M + 6, contactY + 32);
        }
        addOutline(doc, "Cómo comprar", pageNumber);
    }

    function drawCatalogCover(doc, logo, managerName, sections, howToPage) {
        setFill(doc, COLORS.green);
        doc.rect(0, 0, PAGE_W, 6, "F");
        drawHeader(doc, logo, "Catálogo de productos");

        setFont(doc, "bold");
        doc.setFontSize(46);
        setText(doc, COLORS.green);
        pageText(doc, "Catálogo", M, 72);
        setFont(doc, "normal");
        doc.setFontSize(11);
        setText(doc, COLORS.muted);
        pageText(doc, "Productos y precios en USD", M, 84);
        setDraw(doc, COLORS.gold);
        doc.setLineWidth(1);
        doc.line(M, 90, M + 34, 90);

        setFill(doc, COLORS.green);
        doc.roundedRect(M, 100, 120, 16, 3, 3, "F");
        setFont(doc, "bold");
        doc.setFontSize(6.5);
        setText(doc, COLORS.gold);
        pageText(doc, "COMERCIAL VOLXEN", M + 4, 106.5);
        setFont(doc, "bold");
        doc.setFontSize(10);
        setText(doc, COLORS.white);
        pageText(doc, fitText(doc, managerName || "VOLXEN", 112, 10, "bold"), M + 4, 113);

        setFont(doc, "bold");
        doc.setFontSize(13);
        setText(doc, COLORS.green);
        pageText(doc, "Contenido", M, 132);
        setDraw(doc, COLORS.gold);
        doc.setLineWidth(0.8);
        doc.line(M, 136, M + 20, 136);

        var rowY = 144;
        var rowH = 10.5;
        if (!sections.length) {
            setFont(doc, "normal");
            doc.setFontSize(8);
            setText(doc, COLORS.muted);
            pageText(doc, "No hay productos disponibles en este momento.", M, rowY + 4);
        } else {
            sections.forEach(function (section) {
                setFill(doc, COLORS.gold);
                doc.rect(M, rowY + 2.5, 1.5, 1.5, "F");
                setFont(doc, "bold");
                doc.setFontSize(10);
                setText(doc, COLORS.ink);
                pageText(doc, fitText(doc, section.title, 130, 10, "bold"), M + 4, rowY + 4);
                setFont(doc, "normal");
                doc.setFontSize(6.5);
                setText(doc, COLORS.muted);
                pageText(doc, section.products.length + (section.products.length === 1 ? " producto" : " productos"), M + 4, rowY + 8.5);
                setFont(doc, "bold");
                doc.setFontSize(10);
                setText(doc, COLORS.green);
                pageText(doc, String(section.startPage), PAGE_W - M, rowY + 5, { align: "right" });
                setDraw(doc, COLORS.line);
                doc.setLineWidth(0.2);
                doc.line(M, rowY + 9.5, PAGE_W - M, rowY + 9.5);
                addLink(doc, M, rowY, PAGE_W - M * 2, 9.5, section.startPage);
                rowY += rowH;
            });
        }

        rowY += 4;
        setFill(doc, COLORS.gold);
        doc.rect(M, rowY + 2.5, 1.5, 1.5, "F");
        setFont(doc, "bold");
        doc.setFontSize(10);
        setText(doc, COLORS.green);
        pageText(doc, "Cómo comprar", M + 4, rowY + 4);
        setFont(doc, "normal");
        doc.setFontSize(6.5);
        setText(doc, COLORS.muted);
        pageText(doc, "Entrega, pago, garantía y horario", M + 4, rowY + 8.5);
        setFont(doc, "bold");
        doc.setFontSize(10);
        setText(doc, COLORS.green);
        pageText(doc, String(howToPage), PAGE_W - M, rowY + 5, { align: "right" });
        setDraw(doc, COLORS.line);
        doc.setLineWidth(0.2);
        doc.line(M, rowY + 9.5, PAGE_W - M, rowY + 9.5);
        addLink(doc, M, rowY, PAGE_W - M * 2, 9.5, howToPage);
    }

    function drawCatalogFooter(doc, managerName, priceDate) {
        var total = doc.getNumberOfPages();
        for (var page = 1; page <= total; page += 1) {
            doc.setPage(page);
            setDraw(doc, COLORS.line);
            doc.setLineWidth(0.2);
            doc.line(M, PAGE_H - 11, PAGE_W - M, PAGE_H - 11);
            setFont(doc, "normal");
            doc.setFontSize(6.5);
            setText(doc, COLORS.muted);
            pageText(doc, fitText(doc, "Comercial VOLXEN: " + (managerName || "VOLXEN"), 50, 6.5, "normal"), M, PAGE_H - 6.5);
            pageText(doc, fitText(doc, "Precios en USD vigentes al " + priceDate, 70, 6.5, "normal"), PAGE_W / 2, PAGE_H - 6.5, { align: "center" });
            pageText(doc, "Página " + page + " de " + total, PAGE_W - M, PAGE_H - 6.5, { align: "right" });
        }
    }

    async function downloadCatalog(payload) {
        var data = payload || {};
        var products = (Array.isArray(data.products) ? data.products : []).map(catalogProduct).filter(function (product) {
            return product.name;
        });
        var sections = catalogSections(products, data.categories);
        var managerName = clean(data.managerName || "").trim();
        var contacts = catalogContacts(data);
        var doc = newDoc();
        await registerFonts(doc);
        var logo = await loadImageData(logoUrl(), 220, 220, 0.9);
        paintPage(doc);

        var pageCursor = 1;
        sections.forEach(function (section) {
            section.startPage = pageCursor + 1;
            pageCursor += section.pageCount;
        });
        var howToPage = pageCursor + 1;
        addOutline(doc, "Contenido", 1);

        var iconCache = {};
        for (var sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
            var section = sections[sectionIndex];
            for (var pageIndex = 0; pageIndex < section.pageCount; pageIndex += 1) {
                doc.addPage();
                paintPage(doc);
                await drawCatalogCategoryPage(doc, section, pageIndex, sectionIndex, logo, iconCache);
            }
        }

        doc.addPage();
        paintPage(doc);
        await drawCatalogHowToPage(doc, contacts, logo, iconCache, howToPage);

        doc.setPage(1);
        drawCatalogCover(doc, logo, managerName, sections, howToPage);
        drawCatalogFooter(doc, managerName, generatedLabel());

        var slug = data.scopeLabel ? safeFilename(data.scopeLabel) + "-" : "";
        var filename = "catalogo-volxen-" + slug + stamp() + ".pdf";
        doc.save(filename);
        return filename;
    }

    window.VXGESTOR_PDF = {
        available: function () { return Boolean(ctor()); },
        downloadReceipt: downloadReceipt,
        downloadReport: downloadReport,
        downloadCatalog: downloadCatalog
    };
})();
