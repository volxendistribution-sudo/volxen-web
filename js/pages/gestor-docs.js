(function () {
    "use strict";

    var BRAND = {
        ink: "#1E1D1B",
        bg: "#F8F7F4",
        surface: "#EAE6DE",
        gold: "#C8A165",
        green: "#2E4A3F",
        muted: "#77736C",
        line: "rgba(30,29,27,.12)"
    };

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function money(value) {
        var number = Number(value);
        if (!Number.isFinite(number)) return "$0.00";
        return "$" + number.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function dateLabel(value) {
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "—";
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

    function orderItems(order) {
        var items = Array.isArray(order && order.items) ? order.items : [];
        return items.map(function (item) {
            var quantity = Math.max(1, Number(item.cantidad || item.qty || 1) || 1);
            var price = Number(item.precio_unitario != null ? item.precio_unitario : item.precio || 0);
            var subtotal = Number(item.subtotal != null ? item.subtotal : price * quantity);
            return {
                name: String(item.producto_nombre || item.nombre || item.nombre_producto || "Producto"),
                quantity: quantity,
                price: Number.isFinite(price) ? price : 0,
                subtotal: Number.isFinite(subtotal) ? subtotal : 0
            };
        });
    }

    function receiptData(order, managerName, options) {
        var opts = options || {};
        var items = orderItems(order);
        var total = Number(order && order.total_usd);
        if (!Number.isFinite(total)) {
            total = items.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        }
        return {
            code: String(order && order.codigo || "Sin código"),
            date: dateLabel(order && order.created_at),
            status: String(order && order.estado || "Pedido recibido"),
            clientName: String(order && order.nombre_cliente || "Cliente"),
            address: opts.address ? String(order && order.direccion || "") : "",
            phone: opts.phone ? String(order && order.telefono || "") : "",
            total: total,
            managerName: String(managerName || "").trim(),
            items: items
        };
    }

    function receiptBody(data) {
        var rows = data.items.length
            ? data.items.map(function (item) {
                return '<tr><td><strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml(item.quantity) + ' × ' + escapeHtml(money(item.price)) + '</span></td><td>' + escapeHtml(money(item.subtotal)) + '</td></tr>';
            }).join("")
            : '<tr><td colspan="2">Sin detalle de productos.</td></tr>';

        return '<article class="doc doc-receipt">' +
            '<header class="doc-head">' +
                '<img src="' + escapeHtml(logoUrl()) + '" alt="VOLXEN" class="doc-logo">' +
                '<div><p class="doc-brand">VOLXEN</p><p class="doc-kicker">Comprobante de pedido</p></div>' +
            '</header>' +
            '<div class="doc-meta">' +
                '<div><span>Pedido</span><strong>' + escapeHtml(data.code) + '</strong></div>' +
                '<div><span>Fecha</span><strong>' + escapeHtml(data.date) + '</strong></div>' +
                '<div><span>Estado</span><strong>' + escapeHtml(data.status) + '</strong></div>' +
            '</div>' +
            '<p class="doc-manager">Comercial VOLXEN: ' + escapeHtml(data.managerName) + '</p>' +
            '<section class="doc-client"><span>Cliente</span><strong>' + escapeHtml(data.clientName) + '</strong>' +
                (data.address ? '<small>' + escapeHtml(data.address) + '</small>' : "") +
                (data.phone ? '<small>' + escapeHtml(data.phone) + '</small>' : "") +
            '</section>' +
            '<table class="doc-table"><thead><tr><th>Producto</th><th>Subtotal</th></tr></thead><tbody>' + rows + '</tbody></table>' +
            '<div class="doc-total"><span>Total que paga el cliente</span><strong>' + escapeHtml(money(data.total)) + '</strong></div>' +
            '<footer class="doc-foot">Gracias por su compra. Este comprobante no incluye información interna de VOLXEN.</footer>' +
        '</article>';
    }

    function receiptPreviewHtml(order, managerName, options) {
        return receiptBody(receiptData(order, managerName, options));
    }

    function receiptDocumentHtml(order, managerName, options) {
        return documentHtml(receiptBody(receiptData(order, managerName, options)), "Comprobante " + String(order && order.codigo || ""));
    }

    function reportDocumentHtml(payload) {
        var data = payload || {};
        var orders = Array.isArray(data.orders) ? data.orders : [];
        var managerName = String(data.managerName || "").trim();
        var periodLabel = String(data.periodLabel || "Periodo seleccionado");
        var charts = Array.isArray(data.charts) ? data.charts : [];
        var commission = orders.reduce(function (sum, order) {
            return String(order.estado || "") === "Cancelado" ? sum : sum + Number(order.comision_monto_usd || 0);
        }, 0);
        var counts = {};
        orders.forEach(function (order) {
            var status = String(order.estado || "Sin estado");
            counts[status] = (counts[status] || 0) + 1;
        });
        var statusRows = Object.keys(counts).sort().map(function (status) {
            return '<li><span>' + escapeHtml(status) + '</span><strong>' + escapeHtml(counts[status]) + '</strong></li>';
        }).join("");
        var rows = orders.length
            ? orders.map(function (order) {
                var products = orderItems(order).map(function (item) {
                    return item.name + " × " + item.quantity;
                }).join(", ");
                var isCancelled = String(order.estado || "") === "Cancelado";
                return '<tr><td><strong>' + escapeHtml(order.codigo || "Sin código") + '</strong><span>' + escapeHtml(dateLabel(order.created_at)) + '</span></td>' +
                    '<td>' + escapeHtml(products || "Sin detalle") + '</td>' +
                    '<td>' + escapeHtml(order.estado || "Sin estado") + '</td>' +
                    '<td>' + escapeHtml(isCancelled ? "—" : money(order.comision_monto_usd)) + '</td></tr>';
            }).join("")
            : '<tr><td colspan="4" class="doc-empty">Sin pedidos en el periodo seleccionado.</td></tr>';
        var chartsHtml = charts.length
            ? charts.map(function (chart) {
                return '<section class="doc-chart"><h3>' + escapeHtml(chart.title || "Gráfico") + '</h3>' + String(chart.svg || "") + '</section>';
            }).join("")
            : '<p class="doc-empty">Sin datos para graficar en este periodo.</p>';

        return documentHtml(
            '<article class="doc doc-report">' +
                '<header class="doc-head"><img src="' + escapeHtml(logoUrl()) + '" alt="VOLXEN" class="doc-logo"><div><p class="doc-brand">VOLXEN</p><p class="doc-kicker">Reporte del gestor</p></div></header>' +
                '<h1>Mi reporte</h1>' +
                '<p class="doc-manager">Comercial VOLXEN: ' + escapeHtml(managerName) + '</p>' +
                '<p class="doc-meta-line">' + escapeHtml(periodLabel) + ' · Generado el ' + escapeHtml(generatedLabel()) + '</p>' +
                '<div class="doc-stats"><div><span>Comisión ganada</span><strong>' + escapeHtml(money(commission)) + '</strong></div><div><span>Pedidos</span><strong>' + escapeHtml(orders.length) + '</strong></div></div>' +
                '<section class="doc-status"><h2>Pedidos por estado</h2><ul>' + (statusRows || '<li><span>Sin pedidos</span><strong>0</strong></li>') + '</ul></section>' +
                '<section class="doc-charts"><h2>Gráficas del periodo</h2>' + chartsHtml + '</section>' +
                '<section class="doc-orders"><h2>Pedidos del periodo</h2><table class="doc-table"><thead><tr><th>Pedido</th><th>Productos</th><th>Estado</th><th>Comisión</th></tr></thead><tbody>' + rows + '</tbody></table></section>' +
                '<p class="doc-foot">La comisión mostrada es la ganada por el gestor. Este reporte no presenta totales de venta como ganancia.</p>' +
            '</article>',
            "Reporte de " + managerName
        );
    }

    function catalogDocumentHtml(payload) {
        var data = payload || {};
        var products = Array.isArray(data.products) ? data.products : [];
        var managerName = String(data.managerName || "").trim();
        var cards = products.map(function (product) {
            return '<article class="doc-product">' +
                '<div class="doc-product-media">' + (product.image ? '<img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '">' : '<span>Sin foto</span>') + '</div>' +
                '<div class="doc-product-body"><p class="doc-product-category">' + escapeHtml(product.category || "Producto") + '</p><h3>' + escapeHtml(product.name) + '</h3><strong class="doc-product-price">' + escapeHtml(money(product.price)) + '</strong></div>' +
            '</article>';
        }).join("");

        return documentHtml(
            '<article class="doc doc-catalog">' +
                '<section class="doc-catalog-cover"><img src="' + escapeHtml(logoUrl()) + '" alt="VOLXEN" class="doc-logo doc-logo-lg"><p class="doc-brand">VOLXEN</p><h1>Catálogo</h1><p class="doc-manager">Comercial VOLXEN: ' + escapeHtml(managerName) + '</p><p class="doc-meta-line">Generado el ' + escapeHtml(generatedLabel()) + '</p></section>' +
                '<section class="doc-catalog-products">' + (cards || '<p class="doc-empty">No hay productos disponibles en este momento.</p>') + '</section>' +
                '<p class="doc-foot">Precios públicos de la tienda. Este catálogo no incluye información interna de VOLXEN.</p>' +
            '</article>',
            "Catálogo VOLXEN"
        );
    }

    function fontBase() {
        var preload = document.querySelector('link[rel="preload"][as="font"]');
        if (preload && preload.href) {
            return preload.href.replace(/[^/]+$/, "");
        }
        try {
            return new URL("dist/fonts/", document.baseURI).href;
        } catch (error) {
            return "";
        }
    }

    function logoUrl() {
        try {
            return new URL("brand/logo.svg", document.baseURI).href;
        } catch (error) {
            return "brand/logo.svg";
        }
    }

    function documentHtml(body, title) {
        var fonts = fontBase();
        return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml(title) + '</title><style>' +
            '@font-face{font-family:"DM Sans";font-style:normal;font-weight:400;font-display:swap;src:url("' + fonts + 'DM-Sans-Regular.woff2") format("woff2")}' +
            '@font-face{font-family:"DM Sans";font-style:normal;font-weight:600;font-display:swap;src:url("' + fonts + 'DM-Sans-SemiBold.woff2") format("woff2")}' +
            '@font-face{font-family:"DM Sans";font-style:normal;font-weight:700;font-display:swap;src:url("' + fonts + 'DM-Sans-Bold.woff2") format("woff2")}' +
            '@font-face{font-family:"Inter Tight";font-style:normal;font-weight:400;font-display:swap;src:url("' + fonts + 'InterTight-Regular.woff2") format("woff2")}' +
            '@font-face{font-family:"Inter Tight";font-style:normal;font-weight:600;font-display:swap;src:url("' + fonts + 'InterTight-SemiBold.woff2") format("woff2")}' +
            DOC_STYLES + '</style></head><body>' + body + '</body></html>';
    }

    var DOC_STYLES = [
        ':root{--ink:' + BRAND.ink + ';--bg:' + BRAND.bg + ';--surface:' + BRAND.surface + ';--gold:' + BRAND.gold + ';--green:' + BRAND.green + ';--muted:' + BRAND.muted + ';--line:' + BRAND.line + '}',
        '*{box-sizing:border-box}',
        'html,body{margin:0;padding:0;background:' + BRAND.bg + ';color:' + BRAND.ink + ';font-family:"Inter Tight",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
        '.doc{max-width:760px;margin:0 auto;padding:42px 46px;background:' + BRAND.bg + '}',
        '.doc-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid ' + BRAND.ink + ';padding-bottom:16px;margin-bottom:24px}',
        '.doc-logo{width:58px;height:58px;object-fit:contain;flex:0 0 auto}',
        '.doc-logo-lg{width:112px;height:112px}',
        '.doc-brand{font-family:"DM Sans",sans-serif;font-size:22px;font-weight:700;letter-spacing:.08em;margin:0}',
        '.doc-kicker{margin:3px 0 0;color:' + BRAND.muted + ';font-size:12px;letter-spacing:.08em;text-transform:uppercase}',
        'h1{font-family:"DM Sans",sans-serif;font-size:34px;letter-spacing:-.04em;margin:0 0 8px}',
        'h2{font-family:"DM Sans",sans-serif;font-size:20px;margin:26px 0 10px}',
        'h3{font-family:"DM Sans",sans-serif;font-size:16px;margin:0 0 6px}',
        '.doc-manager{display:inline-block;margin:0 0 16px;padding:8px 12px;border-left:4px solid ' + BRAND.gold + ';background:' + BRAND.surface + ';font-weight:600}',
        '.doc-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}',
        '.doc-meta div,.doc-stats div{border:1px solid ' + BRAND.line + ';border-radius:10px;padding:10px 12px;background:#fffdf9}',
        '.doc-meta span,.doc-stats span,.doc-client span{display:block;color:' + BRAND.muted + ';font-size:10px;text-transform:uppercase;letter-spacing:.08em}',
        '.doc-meta strong,.doc-stats strong{display:block;margin-top:3px;font-family:"DM Sans",sans-serif;font-size:15px}',
        '.doc-client{display:grid;gap:2px;margin:16px 0;padding:12px 14px;border-radius:10px;background:' + BRAND.surface + '}',
        '.doc-client small{color:' + BRAND.muted + ';font-size:12px}',
        '.doc-table{width:100%;border-collapse:collapse;margin-top:14px;font-size:12px}',
        '.doc-table th{padding:9px 10px;background:' + BRAND.ink + ';color:' + BRAND.bg + ';text-align:left;font-size:10px;letter-spacing:.08em;text-transform:uppercase}',
        '.doc-table td{padding:10px;border-bottom:1px solid ' + BRAND.line + ';vertical-align:top}',
        '.doc-table td span{display:block;color:' + BRAND.muted + ';font-size:11px;margin-top:2px}',
        '.doc-table td:last-child,.doc-table th:last-child{text-align:right;white-space:nowrap}',
        '.doc-total{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:18px;padding:16px;border-radius:12px;background:' + BRAND.ink + ';color:' + BRAND.bg + '}',
        '.doc-total span{font-size:12px;letter-spacing:.06em;text-transform:uppercase}',
        '.doc-total strong{font-family:"DM Sans",sans-serif;font-size:28px;color:' + BRAND.gold + '}',
        '.doc-foot{margin-top:26px;padding-top:12px;border-top:1px solid ' + BRAND.line + ';color:' + BRAND.muted + ';font-size:10px;line-height:1.5}',
        '.doc-meta-line{color:' + BRAND.muted + ';font-size:12px;margin:0 0 18px}',
        '.doc-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:18px 0}',
        '.doc-stats strong{font-size:24px}',
        '.doc-status ul{list-style:none;display:flex;flex-wrap:wrap;gap:6px;padding:0;margin:0}',
        '.doc-status li{display:flex;gap:10px;justify-content:space-between;min-width:150px;padding:8px 10px;border:1px solid ' + BRAND.line + ';border-radius:8px;font-size:11px}',
        '.doc-charts{display:grid;grid-template-columns:1fr;gap:14px;margin-top:18px}',
        '.doc-chart{padding:12px;border:1px solid ' + BRAND.line + ';border-radius:12px;background:#fffdf9;break-inside:avoid}',
        '.doc-chart h3{margin-bottom:4px}',
        '.doc-chart .gs-chart-svg{width:100%;height:auto;display:block}',
        '.doc-orders{break-before:page}',
        '.doc-empty{padding:18px;border:1px dashed ' + BRAND.line + ';border-radius:10px;color:' + BRAND.muted + ';font-size:12px;text-align:center}',
        '.doc-catalog-cover{min-height:86vh;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:10px;break-after:page}',
        '.doc-catalog-cover h1{font-size:64px;line-height:.95;margin-top:12px}',
        '.doc-catalog-products{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
        '.doc-product{break-inside:avoid;border:1px solid ' + BRAND.line + ';border-radius:12px;background:#fffdf9;overflow:hidden}',
        '.doc-product-media{display:grid;place-items:center;aspect-ratio:4/3;background:' + BRAND.surface + ';padding:10px}',
        '.doc-product-media img{width:100%;height:100%;object-fit:contain;display:block}',
        '.doc-product-media span{color:' + BRAND.muted + ';font-size:11px}',
        '.doc-product-body{padding:12px}',
        '.doc-product-category{margin:0 0 4px;color:' + BRAND.muted + ';font-size:9px;text-transform:uppercase;letter-spacing:.08em}',
        '.doc-product-body h3{font-size:13px;margin:0 0 8px}',
        '.doc-product-price{font-family:"DM Sans",sans-serif;font-size:18px}',
        '@media print{@page{size:A4;margin:14mm}.doc{max-width:none;padding:0;background:#fff}body{background:#fff}.doc-catalog-cover{min-height:0;height:250mm}.doc-catalog-products{grid-template-columns:1fr 1fr}}'
    ].join("");

    function openPrint(html) {
        var frame = document.createElement("iframe");
        frame.setAttribute("aria-hidden", "true");
        frame.style.position = "fixed";
        frame.style.left = "-10000px";
        frame.style.top = "0";
        frame.style.width = "900px";
        frame.style.height = "1200px";
        frame.style.border = "0";
        frame.srcdoc = html;
        document.body.appendChild(frame);
        var done = false;
        var start = function () {
            if (done) return;
            done = true;
            try {
                frame.contentWindow.focus();
                frame.contentWindow.print();
            } catch (error) {
                var win = window.open("", "_blank");
                if (win) {
                    win.document.open();
                    win.document.write(html);
                    win.document.close();
                    win.focus();
                    win.setTimeout(function () { win.print(); }, 400);
                }
            }
            window.setTimeout(function () { frame.remove(); }, 60000);
        };
        var assetsReady = function () {
            var doc;
            try { doc = frame.contentDocument; } catch (error) { return true; }
            if (!doc) return false;
            var images = Array.prototype.slice.call(doc.images || []);
            if (images.some(function (image) { return !image.complete; })) return false;
            if (doc.fonts && doc.fonts.status === "loading") return false;
            return true;
        };
        var waited = 0;
        var tryStart = function () {
            if (assetsReady() || waited >= 3000) {
                start();
                return;
            }
            waited += 100;
            window.setTimeout(tryStart, 100);
        };
        frame.addEventListener("load", function () { window.setTimeout(tryStart, 100); });
        window.setTimeout(function () { if (!done) tryStart(); }, 3200);
    }

    function loadImage(url) {
        return new Promise(function (resolve, reject) {
            var image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = function () { resolve(image); };
            image.onerror = function () { reject(new Error("No se pudo cargar la imagen.")); };
            image.src = url;
        });
    }

    function drawContain(ctx, image, x, y, width, height) {
        var scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        var drawWidth = image.naturalWidth * scale;
        var drawHeight = image.naturalHeight * scale;
        ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    }

    function roundRect(ctx, x, y, width, height, radius) {
        var r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    }

    function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
        var words = String(text || "").split(/\s+/);
        var line = "";
        var lines = [];
        words.forEach(function (word) {
            var test = line ? line + " " + word : word;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        });
        if (line) lines.push(line);
        var limit = Math.max(1, Number(maxLines) || lines.length);
        lines.slice(0, limit).forEach(function (item, index) {
            var value = index === limit - 1 && lines.length > limit ? item.replace(/\s+\S*$/, "") + "…" : item;
            ctx.fillText(value, x, y + index * lineHeight);
        });
        return Math.min(lines.length, limit);
    }

    function canvasBlob(canvas) {
        return new Promise(function (resolve) {
            canvas.toBlob(function (blob) { resolve(blob); }, "image/png");
        });
    }

    async function receiptImageBlob(order, managerName, options) {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        var data = receiptData(order, managerName, options);
        var height = Math.max(1350, 820 + data.items.length * 76);
        var canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = height;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = BRAND.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = BRAND.surface;
        ctx.fillRect(0, 0, canvas.width, 190);
        try {
            var logo = await loadImage(logoUrl());
            drawContain(ctx, logo, 64, 48, 92, 92);
        } catch (error) {}

        ctx.fillStyle = BRAND.ink;
        ctx.font = '700 34px "DM Sans", sans-serif';
        ctx.fillText("VOLXEN", 176, 94);
        ctx.fillStyle = BRAND.muted;
        ctx.font = '600 17px "Inter Tight", sans-serif';
        ctx.fillText("COMPROBANTE DE PEDIDO", 176, 122);

        ctx.fillStyle = BRAND.ink;
        ctx.font = '700 64px "DM Sans", sans-serif';
        ctx.fillText(data.code, 64, 286);
        ctx.fillStyle = BRAND.muted;
        ctx.font = '400 20px "Inter Tight", sans-serif';
        ctx.fillText(data.date + " · " + data.status, 64, 320);
        ctx.fillStyle = BRAND.ink;
        ctx.font = '600 22px "Inter Tight", sans-serif';
        wrapText(ctx, "Comercial VOLXEN: " + data.managerName, 64, 376, 940, 28, 2);

        ctx.fillStyle = BRAND.surface;
        roundRect(ctx, 64, 430, 952, data.address || data.phone ? 132 : 104, 18);
        ctx.fill();
        ctx.fillStyle = BRAND.muted;
        ctx.font = '600 15px "Inter Tight", sans-serif';
        ctx.fillText("CLIENTE", 88, 462);
        ctx.fillStyle = BRAND.ink;
        ctx.font = '600 24px "Inter Tight", sans-serif';
        ctx.fillText(data.clientName, 88, 494);
        ctx.fillStyle = BRAND.muted;
        ctx.font = '400 16px "Inter Tight", sans-serif';
        var detailY = 520;
        if (data.address) { wrapText(ctx, data.address, 88, detailY, 880, 22, 1); detailY += 24; }
        if (data.phone) { ctx.fillText(data.phone, 88, detailY); }

        var y = data.address || data.phone ? 610 : 580;
        ctx.strokeStyle = BRAND.line;
        ctx.beginPath();
        ctx.moveTo(64, y);
        ctx.lineTo(1016, y);
        ctx.stroke();
        y += 38;

        data.items.forEach(function (item) {
            ctx.fillStyle = BRAND.ink;
            ctx.font = '600 20px "Inter Tight", sans-serif';
            wrapText(ctx, item.name, 64, y, 700, 24, 2);
            ctx.fillStyle = BRAND.muted;
            ctx.font = '400 17px "Inter Tight", sans-serif';
            ctx.fillText(item.quantity + " × " + money(item.price), 64, y + 24);
            ctx.fillStyle = BRAND.ink;
            ctx.font = '600 20px "Inter Tight", sans-serif';
            ctx.textAlign = "right";
            ctx.fillText(money(item.subtotal), 1016, y + 2);
            ctx.textAlign = "left";
            y += 76;
        });

        ctx.strokeStyle = BRAND.line;
        ctx.beginPath();
        ctx.moveTo(64, y);
        ctx.lineTo(1016, y);
        ctx.stroke();
        y += 24;
        ctx.fillStyle = BRAND.ink;
        roundRect(ctx, 64, y, 952, 110, 18);
        ctx.fill();
        ctx.fillStyle = BRAND.bg;
        ctx.font = '600 18px "Inter Tight", sans-serif';
        ctx.fillText("TOTAL QUE PAGA EL CLIENTE", 92, y + 38);
        ctx.fillStyle = BRAND.gold;
        ctx.font = '700 42px "DM Sans", sans-serif';
        ctx.textAlign = "right";
        ctx.fillText(money(data.total), 988, y + 72);
        ctx.textAlign = "left";

        ctx.fillStyle = BRAND.muted;
        ctx.font = '400 15px "Inter Tight", sans-serif';
        wrapText(ctx, "Gracias por su compra. Este comprobante no incluye información interna de VOLXEN.", 64, y + 160, 900, 22, 2);
        return canvasBlob(canvas);
    }

    function measureLines(ctx, text, maxWidth) {
        var words = String(text || "").split(/\s+/);
        var line = "";
        var lines = [];
        words.forEach(function (word) {
            var test = line ? line + " " + word : word;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        });
        if (line) lines.push(line);
        return lines;
    }

    function fitFontSize(ctx, text, maxWidth, maxLines, maxSize, minSize, weight) {
        var size = maxSize;
        while (size >= minSize) {
            ctx.font = weight + " " + size + 'px "DM Sans", sans-serif';
            if (measureLines(ctx, text, maxWidth).length <= maxLines) return size;
            size -= 4;
        }
        return minSize;
    }

    async function productImageBlob(product, managerName) {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        var canvas = document.createElement("canvas");
        canvas.width = 1440;
        canvas.height = 1260;
        var ctx = canvas.getContext("2d");

        ctx.fillStyle = BRAND.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = BRAND.surface;
        ctx.fillRect(0, 0, 22, canvas.height);

        ctx.strokeStyle = "rgba(200,161,101,.28)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(1320, 110, 330, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(46,74,63,.10)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 1260, 360, 0, Math.PI * 2);
        ctx.stroke();

        try {
            var logo = await loadImage(logoUrl());
            drawContain(ctx, logo, 84, 70, 112, 112);
        } catch (error) {}

        ctx.textAlign = "right";
        ctx.fillStyle = BRAND.green;
        ctx.font = '700 17px "Inter Tight", sans-serif';
        ctx.fillText("CATÁLOGO PRIVADO", 1350, 94);
        ctx.fillStyle = BRAND.muted;
        ctx.font = '400 17px "Inter Tight", sans-serif';
        ctx.fillText("Selección VOLXEN", 1350, 122);
        ctx.textAlign = "left";

        var stageX = 78;
        var stageY = 242;
        var stageW = 782;
        var stageH = 700;
        ctx.save();
        ctx.shadowColor = "rgba(30,29,27,.10)";
        ctx.shadowBlur = 38;
        ctx.shadowOffsetY = 20;
        ctx.fillStyle = BRAND.surface;
        roundRect(ctx, stageX, stageY, stageW, stageH, 34);
        ctx.fill();
        ctx.restore();

        var warning = "";
        if (product.image) {
            try {
                var image = await loadImage(product.image);
                drawContain(ctx, image, stageX + 34, stageY + 34, stageW - 68, stageH - 68);
            } catch (error) {
                warning = "No se pudo incluir la foto del producto.";
                drawProductPlaceholder(ctx, stageX, stageY, stageW, stageH);
            }
        } else {
            drawProductPlaceholder(ctx, stageX, stageY, stageW, stageH);
        }

        var colX = 928;
        var colW = 432;
        ctx.fillStyle = BRAND.green;
        ctx.font = '700 18px "Inter Tight", sans-serif';
        ctx.fillText(String(product.category || "PRODUCTO").toUpperCase(), colX, 282);

        var name = product.name || "Producto";
        var nameSize = fitFontSize(ctx, name, colW, 4, 68, 38, '700');
        var nameLineHeight = Math.round(nameSize * 1.08);
        ctx.fillStyle = BRAND.ink;
        ctx.font = '700 ' + nameSize + 'px "DM Sans", sans-serif';
        var nameLines = wrapText(ctx, name, colX, 354, colW, nameLineHeight, 4);
        var nameBottom = 354 + nameLines * nameLineHeight;

        var description = String(product.description || "").trim();
        var descBottom = nameBottom;
        if (description) {
            ctx.fillStyle = BRAND.muted;
            ctx.font = '400 23px "Inter Tight", sans-serif';
            var descLines = wrapText(ctx, description, colX, nameBottom + 34, colW, 31, 3);
            descBottom = nameBottom + 34 + descLines * 31;
        }

        var priceY = Math.max(790, Math.min(884, descBottom + 76));
        ctx.strokeStyle = BRAND.gold;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(colX, priceY - 54);
        ctx.lineTo(colX + 92, priceY - 54);
        ctx.stroke();

        ctx.fillStyle = BRAND.muted;
        ctx.font = '600 15px "Inter Tight", sans-serif';
        ctx.fillText("PRECIO PÚBLICO", colX, priceY - 14);
        ctx.fillStyle = BRAND.ink;
        ctx.font = '700 86px "DM Sans", sans-serif';
        ctx.fillText(money(product.price), colX, priceY + 66);
        ctx.fillStyle = BRAND.muted;
        ctx.font = '400 18px "Inter Tight", sans-serif';
        ctx.fillText("Precio de la tienda VOLXEN", colX, priceY + 104);

        var bandX = 78;
        var bandY = 1012;
        var bandW = 1284;
        var bandH = 152;
        ctx.fillStyle = BRAND.green;
        roundRect(ctx, bandX, bandY, bandW, bandH, 26);
        ctx.fill();

        ctx.fillStyle = BRAND.gold;
        ctx.font = '700 16px "Inter Tight", sans-serif';
        ctx.fillText("COMPRA ASISTIDA", bandX + 42, bandY + 48);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = '700 31px "DM Sans", sans-serif';
        wrapText(ctx, "Comercial VOLXEN: " + managerName, bandX + 42, bandY + 88, 760, 38, 1);
        ctx.fillStyle = "rgba(255,255,255,.72)";
        ctx.font = '400 18px "Inter Tight", sans-serif';
        ctx.fillText("Te acompaño en tu compra", bandX + 42, bandY + 120);

        ctx.textAlign = "right";
        ctx.fillStyle = "#FFFFFF";
        ctx.font = '700 34px "DM Sans", sans-serif';
        ctx.fillText("VOLXEN", bandX + bandW - 42, bandY + 74);
        ctx.fillStyle = "rgba(255,255,255,.72)";
        ctx.font = '400 17px "Inter Tight", sans-serif';
        ctx.fillText("Catálogo privado", bandX + bandW - 42, bandY + 104);
        ctx.textAlign = "left";

        ctx.fillStyle = BRAND.muted;
        ctx.font = '400 15px "Inter Tight", sans-serif';
        ctx.fillText("Precio público de la tienda. Este catálogo no incluye información interna de VOLXEN.", 78, 1212);

        return { blob: await canvasBlob(canvas), warning: warning };
    }

    function drawProductPlaceholder(ctx, x, y, width, height) {
        ctx.fillStyle = "rgba(255,253,249,.55)";
        roundRect(ctx, x + 40, y + 40, width - 80, height - 80, 24);
        ctx.fill();
        ctx.fillStyle = BRAND.muted;
        ctx.font = '600 24px "Inter Tight", sans-serif';
        ctx.textAlign = "center";
        ctx.fillText("Imagen no disponible", x + width / 2, y + height / 2);
        ctx.textAlign = "left";
    }

    async function shareFile(blob, filename, title, text) {
        if (!blob || typeof File !== "function") return "unsupported";
        var type = blob.type || "image/png";
        var file;
        try { file = new File([blob], filename, { type: type }); }
        catch (error) { return "unsupported"; }
        var canShare = false;
        try { canShare = Boolean(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); }
        catch (error) { canShare = false; }
        if (!canShare) return "unsupported";
        try {
            await navigator.share({ files: [file], title: title || "VOLXEN", text: text || "" });
            return "shared";
        } catch (error) {
            return error && error.name === "AbortError" ? "cancelled" : "error";
        }
    }

    function downloadBlob(blob, filename) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }

    function whatsappUrl(text) {
        return "https://wa.me/?text=" + encodeURIComponent(String(text || ""));
    }

    window.VXGESTOR_DOCS = {
        money: money,
        dateLabel: dateLabel,
        receiptPreviewHtml: receiptPreviewHtml,
        receiptDocumentHtml: receiptDocumentHtml,
        reportDocumentHtml: reportDocumentHtml,
        catalogDocumentHtml: catalogDocumentHtml,
        openPrint: openPrint,
        receiptImageBlob: receiptImageBlob,
        productImageBlob: productImageBlob,
        shareFile: shareFile,
        downloadBlob: downloadBlob,
        whatsappUrl: whatsappUrl
    };
})();
