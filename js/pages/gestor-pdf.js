(function () {
    "use strict";

    var PAGE_W = 210;
    var PAGE_H = 297;
    var M = 14;
    var COLORS = {
        ink: [30, 29, 27],
        surface: [234, 230, 222],
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
        doc.setFont("helvetica", style || "normal");
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
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        setText(doc, COLORS.ink);
        doc.text("VOLXEN", M + 22, 21);
        doc.setFont("helvetica", "normal");
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
            doc.setFont("helvetica", "normal");
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
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);
            setText(doc, COLORS.muted);
            pageText(doc, item.label, left + 4, y + 6);
            doc.setFont("helvetica", "bold");
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
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        setText(doc, COLORS.ink);
        doc.text("Pedidos por estado", x, y);
        y += 5;
        if (!rows.length) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            setText(doc, COLORS.muted);
            pageText(doc, "Sin pedidos en el periodo.", x, y);
            return y + 4;
        }
        var width = (PAGE_W - M * 2) / 2;
        rows.forEach(function (status, index) {
            var left = x + (index % 2) * width;
            var top = y + Math.floor(index / 2) * 5;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            setText(doc, COLORS.muted);
            pageText(doc, status, left, top);
            doc.setFont("helvetica", "bold");
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
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        setText(doc, COLORS.ink);
        pageText(doc, chart.title || "Gráfico", x, y + 4);
        var plotX = x + 10;
        var plotY = y + 10;
        var plotW = width - 14;
        var plotH = height - 24;
        var max = chartMax(items);
        if (!items.length || !items.some(function (item) { return Number(item.value) > 0; })) {
            doc.setFont("helvetica", "normal");
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
            doc.setFont("helvetica", "normal");
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
                doc.setFont("helvetica", "normal");
                doc.setFontSize(6);
                setText(doc, COLORS.ink);
                pageText(doc, String(item.label || "").slice(0, 14), x, top + rowH / 2 + 1);
                setFill(doc, COLORS.surface);
                doc.roundedRect(plotX + 27, top + rowH / 2 - 1.7, plotW - 30, 3.4, 1.4, 1.4, "F");
                setFill(doc, COLORS.gold);
                doc.roundedRect(plotX + 27, top + rowH / 2 - 1.7, Math.max(0.5, barW), 3.4, 1.4, 1.4, "F");
                doc.setFont("helvetica", "bold");
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
                    doc.setFont("helvetica", "normal");
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
                doc.setFont("helvetica", "normal");
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
        doc.setFont("helvetica", "bold");
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
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        setText(doc, COLORS.ink);
        pageText(doc, "Pedidos del periodo", x, y);
        y += 7;
        y = drawTableHeader(doc, x, y, widths);

        if (!orders.length) {
            doc.setFont("helvetica", "normal");
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
                doc.setFont("helvetica", cell[1]);
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

    async function loadImageData(url, width, height, quality) {
        if (!url || typeof Image !== "function") return "";
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
            image.crossOrigin = "anonymous";
            image.onload = function () {
                try {
                    var canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    var ctx = canvas.getContext("2d");
                    ctx.fillStyle = "#FFFFFF";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    var scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
                    var drawW = image.naturalWidth * scale;
                    var drawH = image.naturalHeight * scale;
                    ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
                    finish(canvas.toDataURL("image/jpeg", quality || 0.84));
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
        var logo = await loadImageData(logoUrl(), 180, 180, 0.9);
        var items = orderItems(order);
        var total = Number(order && order.total_usd);
        if (!Number.isFinite(total)) total = items.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        var filename = "comprobante-" + safeFilename(order && (order.codigo || order.id)) + "-" + stamp() + ".pdf";
        var y = drawHeader(doc, logo, "Comprobante de pedido");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        setText(doc, COLORS.ink);
        pageText(doc, order && order.codigo || "Sin código", M, y + 4);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        setText(doc, COLORS.muted);
        pageText(doc, dateLabel(order && order.created_at) + " · " + (order && order.estado || "Pedido recibido"), M, y + 11);
        y += 19;

        setFill(doc, COLORS.surface);
        doc.roundedRect(M, y, 118, 11, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        setText(doc, COLORS.ink);
        pageText(doc, "Comercial VOLXEN: " + (managerName || ""), M + 3, y + 7);
        y += 18;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        setText(doc, COLORS.muted);
        doc.text("CLIENTE", M, y);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        setText(doc, COLORS.ink);
        pageText(doc, order && order.nombre_cliente || "Cliente", M, y + 5);
        y += 10;
        var contact = [];
        if (opts.address && order && order.direccion) contact.push(clean(order.direccion));
        if (opts.phone && order && order.telefono) contact.push(clean(order.telefono));
        if (contact.length) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            setText(doc, COLORS.muted);
            y = paragraph(doc, contact.join(" · "), M, y, PAGE_W - M * 2, 7.5, 4, COLORS.muted);
        }
        y += 5;

        var widths = [99, 16, 34, 33];
        setFill(doc, COLORS.ink);
        doc.rect(M, y, PAGE_W - M * 2, 7, "F");
        doc.setFont("helvetica", "bold");
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
                doc.setFont("helvetica", "bold");
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
            doc.setFont("helvetica", "normal");
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
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        setText(doc, COLORS.white);
        pageText(doc, "Total que paga el cliente", M + 4, y + 14);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        setText(doc, COLORS.gold);
        pageText(doc, money(total), PAGE_W - M - 4, y + 17, { align: "right" });
        y += 30;

        doc.setFont("helvetica", "normal");
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
        var logo = await loadImageData(logoUrl(), 180, 180, 0.9);
        var y = drawHeader(doc, logo, "Reporte del gestor");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        setText(doc, COLORS.ink);
        pageText(doc, "Mi reporte", M, y + 2);
        y += 9;
        setFill(doc, COLORS.surface);
        doc.roundedRect(M, y, 120, 9, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        setText(doc, COLORS.ink);
        pageText(doc, "Comercial VOLXEN: " + managerName, M + 3, y + 5.8);
        y += 14;

        doc.setFont("helvetica", "normal");
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
            doc.setFont("helvetica", "normal");
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

    async function downloadCatalog(payload) {
        var data = payload || {};
        var products = Array.isArray(data.products) ? data.products : [];
        var managerName = clean(data.managerName || "");
        var doc = newDoc();
        var logo = await loadImageData(logoUrl(), 220, 220, 0.9);
        var y = drawHeader(doc, logo, "Catálogo de productos");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(42);
        setText(doc, COLORS.ink);
        doc.text("Catálogo", M, 90);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        setText(doc, COLORS.muted);
        pageText(doc, "Precios públicos de la tienda", M, 100);
        setFill(doc, COLORS.surface);
        doc.roundedRect(M, 110, 150, 13, 2.5, 2.5, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        setText(doc, COLORS.ink);
        pageText(doc, "Comercial VOLXEN: " + managerName, M + 4, 118.5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        setText(doc, COLORS.muted);
        pageText(doc, "Generado el " + generatedLabel(), M, 132);

        doc.addPage();
        y = drawHeader(doc, logo, "Catálogo de productos");
        var columns = 2;
        var gap = 6;
        var cardW = (PAGE_W - M * 2 - gap) / columns;
        var cardH = 72;
        var rowsPerPage = 3;
        var perPage = columns * rowsPerPage;

        for (var index = 0; index < products.length; index += 1) {
            if (index > 0 && index % perPage === 0) {
                doc.addPage();
                y = drawHeader(doc, logo, "Catálogo de productos");
            }
            var product = products[index] || {};
            var pageIndex = index % perPage;
            var col = pageIndex % columns;
            var row = Math.floor(pageIndex / columns);
            var left = M + col * (cardW + gap);
            var top = y + row * (cardH + gap);
            setFill(doc, COLORS.surface);
            doc.roundedRect(left, top, cardW, cardH, 3, 3, "F");
            var image = product.image ? await loadImageData(product.image, 600, 400, 0.82) : "";
            if (image) {
                var imageWidth = 60;
                try { doc.addImage(image, "JPEG", left + (cardW - imageWidth) / 2, top + 2, imageWidth, 40); } catch (error) {}
            } else {
                doc.setFillColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
                doc.rect(left + 2, top + 2, cardW - 4, 40, "F");
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                setText(doc, COLORS.muted);
                pageText(doc, "Imagen no disponible", left + cardW / 2, top + 23, { align: "center" });
            }
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6);
            setText(doc, COLORS.muted);
            pageText(doc, product.category || "Producto", left + 4, top + 48);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            setText(doc, COLORS.ink);
            var nameLines = doc.splitTextToSize(clean(product.name || "Producto"), cardW - 8);
            nameLines.slice(0, 2).forEach(function (line, lineIndex) {
                pageText(doc, line, left + 4, top + 54 + lineIndex * 4);
            });
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            setText(doc, COLORS.green);
            pageText(doc, money(product.price), left + 4, top + 67);
        }

        if (!products.length) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            setText(doc, COLORS.muted);
            pageText(doc, "No hay productos disponibles en este momento.", M, y + 10);
        }

        drawFooter(doc, managerName);
        var filename = "catalogo-volxen-" + stamp() + ".pdf";
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
