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
        var guaranteeToken = String(opts.guaranteeToken || "");
        var guaranteeUrl = "";
        if (guaranteeToken && window.VXGarantia && typeof window.VXGarantia.buildUrl === "function") {
            try { guaranteeUrl = window.VXGarantia.buildUrl(guaranteeToken); } catch (error) {}
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
            guaranteeToken: guaranteeToken,
            guaranteeUrl: guaranteeUrl,
            items: items
        };
    }

    function receiptBody(data) {
        var rows = data.items.length
            ? data.items.map(function (item) {
                return '<tr><td><strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml(item.quantity) + ' × ' + escapeHtml(money(item.price)) + '</span></td><td>' + escapeHtml(money(item.subtotal)) + '</td></tr>';
            }).join("")
            : '<tr><td colspan="2">Sin detalle de productos.</td></tr>';
        var guarantee = data.guaranteeToken && data.guaranteeUrl && window.VXGarantia &&
            typeof window.VXGarantia.qrDataUrl === "function"
            ? '<section class="doc-guarantee">' +
                '<img class="doc-qr" src="' + escapeHtml(window.VXGarantia.qrDataUrl(data.guaranteeUrl, 420)) + '" alt="Código QR del certificado de garantía">' +
                '<div><span>Certificado de garantía</span><strong>' + escapeHtml(data.code) + '</strong>' +
                    '<p>Escanee para verificar. Válido mientras el pedido figure como Entregado.</p></div>' +
              '</section>'
            : "";

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
            guarantee +
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
        '.doc-guarantee{display:flex;align-items:center;gap:16px;margin-top:14px;padding:14px;border:1px solid ' + BRAND.line + ';border-radius:12px;background:#fffdf9;break-inside:avoid}',
        '.doc-qr{width:112px;height:112px;flex:0 0 auto;padding:6px;background:#fff;border:1px solid ' + BRAND.line + ';border-radius:8px}',
        '.doc-guarantee span{display:block;color:' + BRAND.muted + ';font-size:10px;text-transform:uppercase;letter-spacing:.08em}',
        '.doc-guarantee strong{display:block;margin-top:2px;font-family:"DM Sans",sans-serif;font-size:16px}',
        '.doc-guarantee p{margin:4px 0 0;color:' + BRAND.muted + ';font-size:11px;line-height:1.45}',
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

    function drawCover(ctx, image, x, y, width, height) {
        var scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        var drawWidth = image.naturalWidth * scale;
        var drawHeight = image.naturalHeight * scale;
        ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    }

    function drawFeatheredContain(ctx, image, x, y, width, height, fade) {
        var scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        var drawWidth = image.naturalWidth * scale;
        var drawHeight = image.naturalHeight * scale;
        var drawX = (width - drawWidth) / 2;
        var drawY = (height - drawHeight) / 2;
        var layer = document.createElement("canvas");
        layer.width = Math.max(1, Math.ceil(width));
        layer.height = Math.max(1, Math.ceil(height));
        var layerCtx = layer.getContext("2d");
        layerCtx.imageSmoothingEnabled = true;
        layerCtx.imageSmoothingQuality = "high";
        layerCtx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

        var edge = Math.min(fade, width / 2, height / 2);
        layerCtx.globalCompositeOperation = "destination-in";
        if (drawWidth < width - 0.5) {
            var left = layerCtx.createLinearGradient(0, 0, edge, 0);
            left.addColorStop(0, "rgba(0,0,0,0)");
            left.addColorStop(1, "rgba(0,0,0,1)");
            layerCtx.fillStyle = left;
            layerCtx.fillRect(0, 0, edge, height);
            var right = layerCtx.createLinearGradient(width, 0, width - edge, 0);
            right.addColorStop(0, "rgba(0,0,0,0)");
            right.addColorStop(1, "rgba(0,0,0,1)");
            layerCtx.fillStyle = right;
            layerCtx.fillRect(width - edge, 0, edge, height);
        }
        if (drawHeight < height - 0.5) {
            var top = layerCtx.createLinearGradient(0, 0, 0, edge);
            top.addColorStop(0, "rgba(0,0,0,0)");
            top.addColorStop(1, "rgba(0,0,0,1)");
            layerCtx.fillStyle = top;
            layerCtx.fillRect(0, 0, width, edge);
            var bottom = layerCtx.createLinearGradient(0, height, 0, height - edge);
            bottom.addColorStop(0, "rgba(0,0,0,0)");
            bottom.addColorStop(1, "rgba(0,0,0,1)");
            layerCtx.fillStyle = bottom;
            layerCtx.fillRect(0, height - edge, width, edge);
        }
        layerCtx.globalCompositeOperation = "source-over";
        ctx.drawImage(layer, x, y);
    }

    function drawProductPhoto(ctx, image, x, y, width, height) {
        var imageAspect = image.naturalWidth / image.naturalHeight;
        var frameAspect = width / height;
        var loss = 1 - Math.min(frameAspect / imageAspect, imageAspect / frameAspect);
        if (loss > 0.18) {
            ctx.save();
            ctx.filter = "blur(40px)";
            drawCover(ctx, image, x - 60, y - 60, width + 120, height + 120);
            ctx.restore();
            ctx.save();
            ctx.fillStyle = "rgba(248,247,244,0.55)";
            ctx.fillRect(x, y, width, height);
            ctx.restore();
            drawFeatheredContain(ctx, image, x, y, width, height, 24);
            return "contain";
        }
        drawCover(ctx, image, x, y, width, height);
        return "cover";
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

    function truncateToWidth(ctx, text, maxWidth) {
        var value = String(text || "").trim();
        if (!value || ctx.measureText(value).width <= maxWidth) return value;
        var cut = value.length;
        while (cut > 0) {
            var candidate = value.slice(0, cut).replace(/\s+\S*$/, "") + "…";
            if (candidate !== "…" && ctx.measureText(candidate).width <= maxWidth) return candidate;
            cut -= 1;
        }
        return "…";
    }

    function canvasBlob(canvas) {
        return new Promise(function (resolve) {
            canvas.toBlob(function (blob) { resolve(blob); }, "image/png");
        });
    }

    async function receiptImageBlob(order, managerName, options) {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        var data = receiptData(order, managerName, options);
        var height = Math.max(1350, 820 + data.items.length * 76 + (data.guaranteeToken ? 300 : 0));
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

        if (data.guaranteeToken && data.guaranteeUrl && window.VXGarantia &&
            typeof window.VXGarantia.qrDataUrl === "function") {
            var qrY = y + 205;
            ctx.fillStyle = "#FFFDF9";
            roundRect(ctx, 64, qrY, 952, 200, 18);
            ctx.fill();
            ctx.strokeStyle = BRAND.line;
            ctx.stroke();
            try {
                var qrImage = await loadImage(window.VXGarantia.qrDataUrl(data.guaranteeUrl, 420));
                ctx.drawImage(qrImage, 88, qrY + 16, 168, 168);
            } catch (error) {}
            ctx.fillStyle = BRAND.muted;
            ctx.font = '600 15px "Inter Tight", sans-serif';
            ctx.fillText("CERTIFICADO DE GARANTÍA", 286, qrY + 46);
            ctx.fillStyle = BRAND.ink;
            ctx.font = '700 28px "DM Sans", sans-serif';
            ctx.fillText(data.code, 286, qrY + 82);
            ctx.fillStyle = BRAND.muted;
            ctx.font = '400 16px "Inter Tight", sans-serif';
            wrapText(ctx, "Escanee para verificar. Válido mientras el pedido figure como Entregado.", 286, qrY + 116, 690, 23, 2);
        }
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

    function fitFontSize(ctx, text, maxWidth, maxLines, maxSize, minSize, weight, family) {
        var fontFamily = family || "DM Sans";
        var size = maxSize;
        while (size >= minSize) {
            ctx.font = weight + " " + size + 'px "' + fontFamily + '", sans-serif';
            var lines = measureLines(ctx, text, maxWidth);
            if (lines.length <= maxLines && lines.every(function (line) { return ctx.measureText(line).width <= maxWidth; })) return size;
            size -= 4;
        }
        return minSize;
    }

    function templateUrl() {
        try {
            return new URL("brand/VOLXEN_plantilla_limpia_1440x1260.png", document.baseURI).href;
        } catch (error) {
            return "brand/VOLXEN_plantilla_limpia_1440x1260.png";
        }
    }

    function officialLogoUrl() {
        try {
            return new URL("brand/logo.svg", document.baseURI).href;
        } catch (error) {
            return "brand/logo.svg";
        }
    }

    function priceLabel(value) {
        var number = Number(value);
        if (!Number.isFinite(number)) return "—";
        var decimals = Math.round(number) === number ? 0 : 2;
        return number.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }) + " USD";
    }

    function cleanText(value) {
        return String(value == null ? "" : value)
            .replace(/^[\s\-–—•·*▪●○◦‣]+/, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function featurePair(value) {
        var text = cleanText(value);
        var index = text.indexOf(":");
        if (index !== -1) {
            return {
                title: cleanText(text.slice(0, index)),
                detail: cleanText(text.slice(index + 1))
            };
        }
        return { title: text, detail: "" };
    }

    function normalizarClave(texto) {
        return String(texto || "")
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function iconosPorCategoria(clave) {
        var reglas = [
            { claves: ["watt", "vatios", "potencia"], iconos: ["rayo", "energia", "fusible"] },
            { claves: ["amp", "amper", "amperaje"], iconos: ["fusible", "enchufe", "rayo"] },
            { claves: ["voltaje", "voltage", "volt"], iconos: ["enchufe", "rayo", "fusible"] },
            { claves: ["panel", "placa", "solar", "monocristal", "bifacial"], iconos: ["panel-solar", "techo", "caja"] },
            { claves: ["techo", "instalacion", "montaje", "estructura"], iconos: ["techo", "casa", "panel-solar"] },
            { claves: ["fuego", "calor", "termico", "llama"], iconos: ["llama", "gota", "caja"] },
            { claves: ["agua", "lluvia", "humedad", "resistencia"], iconos: ["gota", "nube", "llave"] },
            { claves: ["viento", "aire", "flujo"], iconos: ["viento", "abanico", "caja"] },
            { claves: ["seguridad", "candado", "seguro", "cerradura"], iconos: ["candado", "llave", "caja"] },
            { claves: ["llave", "herramienta", "ajuste"], iconos: ["llave", "candado", "caja"] },
            { claves: ["peso", "kilos", "carga", "carga maxima"], iconos: ["caja", "pesa", "regla"] },
            { claves: ["tamano", "tamaño", "grande", "dims", "medida"], iconos: ["regla", "cuadro", "caja"] },
            { claves: ["bateria", "autonomia", "horas", "duracion"], iconos: ["bateria", "caja", "energia"] },
            { claves: ["dimension", "ancho", "alto", "largo"], iconos: ["regla", "cuadro", "caja"] }
        ];
        for (var i = 0; i < reglas.length; i++) {
            var regla = reglas[i];
            for (var j = 0; j < regla.claves.length; j++) {
                if (clave.indexOf(regla.claves[j]) !== -1) {
                    return regla.iconos;
                }
            }
        }
        return ["circulo", "punto", "cuadro"];
    }

    function asignarIcono(clave, usados) {
        var alternativas = iconosPorCategoria(clave);
        for (var i = 0; i < alternativas.length; i++) {
            var nombre = alternativas[i];
            if (usados.indexOf(nombre) === -1) {
                usados.push(nombre);
                return nombre;
            }
        }
        usados.push("circulo");
        return "circulo";
    }

    function fitNameSize(ctx, text, maxWidth, maxSize, minSize, maxBlock, maxLines) {
        var lineLimit = maxLines || 3;
        for (var size = maxSize; size >= minSize; size -= 2) {
            ctx.font = '800 ' + size + 'px "DM Sans", sans-serif';
            var lines = measureLines(ctx, text, maxWidth);
            if (lines.length > lineLimit) continue;
            if (lines.some(function (line) { return ctx.measureText(line).width > maxWidth; })) continue;
            var lineHeight = Math.round(size * 1.06);
            var blockHeight = (lines.length - 1) * lineHeight + size;
            if (blockHeight <= maxBlock) {
                return { size: size, lineHeight: lineHeight, lines: lines };
            }
        }
        ctx.font = '800 ' + minSize + 'px "DM Sans", sans-serif';
        return {
            size: minSize,
            lineHeight: Math.round(minSize * 1.06),
            lines: measureLines(ctx, text, maxWidth)
        };
    }

    function fitSingleLineSize(ctx, text, maxWidth, maxSize, minSize, weight, family) {
        for (var size = maxSize; size >= minSize; size -= 1) {
            ctx.font = weight + " " + size + 'px "' + family + '", sans-serif';
            if (ctx.measureText(text).width <= maxWidth) return size;
        }
        ctx.font = weight + " " + minSize + 'px "' + family + '", sans-serif';
        return minSize;
    }

    function trackedWidth(ctx, text, spacing) {
        var width = 0;
        for (var index = 0; index < text.length; index += 1) {
            width += ctx.measureText(text.charAt(index)).width;
        }
        return width + spacing * Math.max(0, text.length - 1);
    }

    function fitTrackedSize(ctx, text, maxWidth, maxSize, minSize, weight, spacing) {
        for (var size = maxSize; size >= minSize; size -= 1) {
            ctx.font = weight + " " + size + 'px "Inter Tight", sans-serif';
            if (trackedWidth(ctx, text, spacing) <= maxWidth) return size;
        }
        ctx.font = weight + " " + minSize + 'px "Inter Tight", sans-serif';
        return minSize;
    }

    function drawTrackedText(ctx, text, x, y, spacing) {
        var cursor = x;
        for (var index = 0; index < text.length; index += 1) {
            var character = text.charAt(index);
            ctx.fillText(character, cursor, y);
            cursor += ctx.measureText(character).width + spacing;
        }
    }

    function drawPricePanel(ctx, x, y, width, height) {
        var fill = ctx.createLinearGradient(x, y, x + width, y);
        fill.addColorStop(0, "#0F2A23");
        fill.addColorStop(1, "#183B31");
        roundRect(ctx, x, y, width, height, 14);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = "#C8A165";
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    function drawTagGlyph(ctx, x, y, width, height) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + 2, y);
        ctx.lineTo(x + width * .55, y);
        ctx.lineTo(x + width, y + height * .42);
        ctx.lineTo(x + width * .55, y + height);
        ctx.lineTo(x + 2, y + height);
        ctx.closePath();
        ctx.fillStyle = "#163A2D";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + width * .28, y + height * .28, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = "#C8A165";
        ctx.fill();
        ctx.restore();
    }

    function drawGoldTag(ctx, x, y, width, height) {
        roundRect(ctx, x, y, width, height, 8);
        ctx.fillStyle = "#C8A165";
        ctx.fill();
        drawTagGlyph(ctx, x + 14, y + 40, 24, 26);
        var tagWidth = width - 56;
        var tagSize = Math.min(
            fitSingleLineSize(ctx, "¡CALIDAD", tagWidth, 18, 14, "700", "Inter Tight"),
            fitSingleLineSize(ctx, "GARANTIZADA!", tagWidth, 18, 14, "700", "Inter Tight")
        );
        ctx.fillStyle = "#163A2D";
        ctx.textAlign = "left";
        ctx.font = '700 ' + tagSize + 'px "Inter Tight", sans-serif';
        ctx.fillText("¡CALIDAD", x + 46, y + 52);
        ctx.fillText("GARANTIZADA!", x + 46, y + 76);
    }

    function drawFeatureCircle(ctx, cx, cy, radius, color) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }

    function drawShieldIcon(ctx, cx, cy) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = "#F8F7F4";
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(11, -9);
        ctx.lineTo(11, 3);
        ctx.quadraticCurveTo(11, 11, 0, 15);
        ctx.quadraticCurveTo(-11, 11, -11, 3);
        ctx.lineTo(-11, -9);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(-1, 5);
        ctx.lineTo(7, -5);
        ctx.stroke();
        ctx.restore();
    }

    function drawBoltIcon(ctx, cx, cy) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        ctx.moveTo(2, -15);
        ctx.lineTo(-10, 2);
        ctx.lineTo(-2, 2);
        ctx.lineTo(-4, 15);
        ctx.lineTo(10, -3);
        ctx.lineTo(2, -3);
        ctx.closePath();
        ctx.fillStyle = "#F8F7F4";
        ctx.fill();
        ctx.restore();
    }

    function drawGearIcon(ctx, cx, cy, holeColor) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        for (var index = 0; index < 16; index += 1) {
            var angle = Math.PI * 2 * index / 16 - Math.PI / 2;
            var radius = index % 2 === 0 ? 15 : 10.5;
            var px = Math.cos(angle) * radius;
            var py = Math.sin(angle) * radius;
            if (index === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = "#F8F7F4";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = holeColor;
        ctx.fill();
        ctx.restore();
    }

    function drawFeatureIcon(ctx, tipoIcono, cx, cy, radius, color) {
        var r = radius || 38;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = color || "#2E4A3F";
        ctx.fill();
        ctx.scale(r / 38, r / 38);
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        var dibujante = iconDrawers[tipoIcono] || iconDrawers.circulo;
        dibujante(ctx);
        ctx.restore();
    }

    var iconDrawers = {
        rayo: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(0, -14);
            ctx.lineTo(6, -2);
            ctx.lineTo(-2, -2);
            ctx.lineTo(-2, 6);
            ctx.lineTo(2, 6);
            ctx.lineTo(2, 14);
            ctx.lineTo(-6, 2);
            ctx.lineTo(2, 2);
            ctx.lineTo(2, -2);
            ctx.lineTo(-6, -14);
            ctx.closePath();
            ctx.fill();
        },
        energia: function (ctx) {
            ctx.beginPath();
            ctx.arc(0, 0, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-9, 0); ctx.lineTo(9, 0);
            ctx.moveTo(0, -9); ctx.lineTo(0, 9);
            ctx.moveTo(-6, -6); ctx.lineTo(6, 6);
            ctx.moveTo(6, -6); ctx.lineTo(-6, 6);
            ctx.stroke();
        },
        fusible: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(-10, -14); ctx.lineTo(10, -14);
            ctx.lineTo(10, 14); ctx.lineTo(-10, 14);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-6, -14); ctx.lineTo(-6, -10);
            ctx.moveTo(6, -14); ctx.lineTo(6, -10);
            ctx.moveTo(-6, 14); ctx.lineTo(-6, 10);
            ctx.moveTo(6, 14); ctx.lineTo(6, 10);
            ctx.stroke();
        },
        enchufe: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(-7, -10); ctx.lineTo(7, -10);
            ctx.lineTo(7, 10); ctx.lineTo(-7, 10);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-4, -14); ctx.lineTo(-4, -10);
            ctx.moveTo(4, -14); ctx.lineTo(4, -10);
            ctx.stroke();
        },
        "panel-solar": function (ctx) {
            ctx.beginPath();
            ctx.moveTo(-11, -11); ctx.lineTo(11, -11);
            ctx.lineTo(11, 11); ctx.lineTo(-11, 11);
            ctx.closePath();
            ctx.stroke();
            for (var i = -7; i <= 7; i += 4) {
                ctx.beginPath();
                ctx.moveTo(i, -9); ctx.lineTo(i, 9);
                ctx.stroke();
            }
        },
        techo: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(-11, 4); ctx.lineTo(0, -11);
            ctx.lineTo(11, 4);
            ctx.lineTo(-11, 4);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-11, 4); ctx.lineTo(11, 4);
            ctx.lineTo(11, 11); ctx.lineTo(-11, 11);
            ctx.closePath();
            ctx.fill();
        },
        casa: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(0, -11); ctx.lineTo(11, 3);
            ctx.lineTo(11, 11); ctx.lineTo(-11, 11);
            ctx.lineTo(-11, 3);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-2, 7); ctx.lineTo(2, 7);
            ctx.moveTo(-2, 11); ctx.lineTo(-2, 7);
            ctx.moveTo(2, 11); ctx.lineTo(2, 7);
            ctx.stroke();
        },
        llama: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.bezierCurveTo(6, -10, 6, 2, 0, 6);
            ctx.bezierCurveTo(-6, 2, -6, -10, 0, -12);
            ctx.fill();
        },
        gota: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(0, -10);
            ctx.bezierCurveTo(6, -6, 9, 2, 0, 8);
            ctx.bezierCurveTo(-9, 2, -6, -6, 0, -10);
            ctx.fill();
        },
        nube: function (ctx) {
            ctx.beginPath();
            ctx.arc(-6, -2, 6, 0, Math.PI * 2);
            ctx.arc(0, -4, 7, 0, Math.PI * 2);
            ctx.arc(6, -2, 6, 0, Math.PI * 2);
            ctx.fill();
        },
        viento: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(-10, -6); ctx.quadraticCurveTo(0, -6, 10, 2);
            ctx.moveTo(-10, 2); ctx.quadraticCurveTo(0, 2, 10, -2);
            ctx.moveTo(-10, 10); ctx.quadraticCurveTo(0, 10, 10, 6);
            ctx.stroke();
        },
        abanico: function (ctx) {
            ctx.beginPath();
            ctx.arc(0, 0, 10, Math.PI * 0.25, Math.PI * 0.75);
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-7, 3); ctx.lineTo(7, 3);
            ctx.moveTo(-5, 1); ctx.lineTo(5, 1);
            ctx.moveTo(-3, -1); ctx.lineTo(3, -1);
            ctx.stroke();
        },
        candado: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(-7, 0); ctx.lineTo(7, 0);
            ctx.lineTo(7, 11); ctx.lineTo(-7, 11);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, 5, Math.PI, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-2, 0); ctx.lineTo(-2, -3);
            ctx.moveTo(2, 0); ctx.lineTo(2, -3);
            ctx.stroke();
        },
        llave: function (ctx) {
            ctx.beginPath();
            ctx.arc(-8, -2, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-5, -2); ctx.lineTo(2, -2);
            ctx.lineTo(2, 2); ctx.lineTo(-5, 2);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(2, -2); ctx.lineTo(4, -4);
            ctx.moveTo(2, 2); ctx.lineTo(4, 4);
            ctx.stroke();
        },
        caja: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(-9, -9); ctx.lineTo(9, -9);
            ctx.lineTo(9, 9); ctx.lineTo(-9, 9);
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-5, -3); ctx.lineTo(5, -3);
            ctx.lineTo(5, 3); ctx.lineTo(-5, 3);
            ctx.closePath();
            ctx.stroke();
        },
        pesa: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(-8, -10); ctx.lineTo(8, -10);
            ctx.lineTo(8, 10); ctx.lineTo(-8, 10);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#FFFFFF";
            ctx.fill();
        },
        regla: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(-10, -10); ctx.lineTo(10, -10);
            ctx.lineTo(10, 10); ctx.lineTo(-10, 10);
            ctx.closePath();
            ctx.stroke();
            for (var i = -8; i <= 8; i += 4) {
                ctx.beginPath();
                ctx.moveTo(i, -10); ctx.lineTo(i, -6);
                ctx.stroke();
            }
        },
        cuadro: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(-9, -9); ctx.lineTo(9, -9);
            ctx.lineTo(9, 9); ctx.lineTo(-9, 9);
            ctx.closePath();
            ctx.fill();
        },
        bateria: function (ctx) {
            ctx.beginPath();
            ctx.moveTo(-9, -8); ctx.lineTo(9, -8);
            ctx.lineTo(9, 8); ctx.lineTo(-9, 8);
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(7, -5); ctx.lineTo(11, -5);
            ctx.lineTo(11, 5); ctx.lineTo(7, 5);
            ctx.closePath();
            ctx.fill();
        },
        circulo: function (ctx) {
            ctx.beginPath();
            ctx.arc(0, 0, 7, 0, Math.PI * 2);
            ctx.fill();
        },
        punto: function (ctx) {
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    async function drawOfficialLockup(ctx) {
        try {
            var logo = await loadImage(officialLogoUrl());
            ctx.drawImage(logo, 57, 16, 156, 156);
        } catch (error) {}
        var wordSize = fitSingleLineSize(ctx, "VOLXEN", 374, 110, 80, "800", "DM Sans");
        ctx.fillStyle = "#163A2D";
        ctx.font = '800 ' + wordSize + 'px "DM Sans", sans-serif';
        ctx.fillText("VOLXEN", 207, 100);
        var commercialSize = fitTrackedSize(ctx, "COMERCIALIZADORA", 373, 24, 14, "600", 9);
        ctx.fillStyle = "#163A2D";
        ctx.font = '600 ' + commercialSize + 'px "Inter Tight", sans-serif';
        drawTrackedText(ctx, "COMERCIALIZADORA", 208, 130, 9);
        var tagline = "Tecnología y energía en Cuba";
        var taglineSize = fitSingleLineSize(ctx, tagline, 373, 26, 18, "400", "Inter Tight");
        ctx.fillStyle = "#6B6B66";
        ctx.font = '400 ' + taglineSize + 'px "Inter Tight", sans-serif';
        ctx.fillText(tagline, 208, 160);
    }

    async function productImageBlob(product, managerName) {
        if (document.fonts && document.fonts.load) {
            try { await document.fonts.load('800 85px "DM Sans"'); } catch (error) {}
            try { await document.fonts.load('800 104px "DM Sans"'); } catch (error) {}
            try { await document.fonts.load('800 20px "DM Sans"'); } catch (error) {}
            try { await document.fonts.load('800 18px "DM Sans"'); } catch (error) {}
            try { await document.fonts.load('700 24px "DM Sans"'); } catch (error) {}
            try { await document.fonts.load('600 24px "Inter Tight"'); } catch (error) {}
            try { await document.fonts.load('600 25px "Inter Tight"'); } catch (error) {}
            try { await document.fonts.load('600 20px "Inter Tight"'); } catch (error) {}
            try { await document.fonts.load('600 30px "Inter Tight"'); } catch (error) {}
            try { await document.fonts.load('400 26px "Inter Tight"'); } catch (error) {}
            try { await document.fonts.load('400 30px "Inter Tight"'); } catch (error) {}
            try { await document.fonts.load('400 19px "Inter Tight"'); } catch (error) {}
            try { await document.fonts.load('400 15px "Inter Tight"'); } catch (error) {}
            try { await document.fonts.load('700 24px "Inter Tight"'); } catch (error) {}
            try { await document.fonts.load('700 18px "Inter Tight"'); } catch (error) {}
        }
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        var canvas = document.createElement("canvas");
        canvas.width = 1440;
        canvas.height = 1260;
        var ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        try {
            var background = await loadImage(templateUrl());
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
        } catch (error) {
            ctx.fillStyle = "#F3EDE3";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        await drawOfficialLockup(ctx);

        var photoX = 658;
        var photoY = 334;
        var photoW = 712;
        var photoH = 531;
        var photoRadius = 32;
        ctx.save();
        roundRect(ctx, photoX, photoY, photoW, photoH, photoRadius);
        ctx.clip();
        if (!product.image) {
            ctx.restore();
            throw new Error("El producto no tiene foto. Agrega una foto antes de compartir.");
        }
        try {
            var image = await loadImage(product.image);
            drawProductPhoto(ctx, image, photoX, photoY, photoW, photoH);
        } catch (error) {
            ctx.restore();
            throw new Error("No se pudo cargar la foto del producto desde Supabase (CORS o crossOrigin). No se generó la imagen sin foto.");
        }
        ctx.restore();

        ctx.save();
        roundRect(ctx, photoX, photoY, photoW, photoH, photoRadius);
        ctx.strokeStyle = "rgba(46,74,63,0.18)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        var name = cleanText(product.name) || "Producto";
        var fixedSubtitleLines = ["Tecnología, calidad y confianza", "en un solo producto."];
        var fixedSubtitle = fixedSubtitleLines.join(" ");
        var features = Array.isArray(product.features)
            ? product.features.map(function (item) { return cleanText(item); }).filter(Boolean)
            : [];
        var titleBlockTop = 196;
        var titleBlockBottom = 410;
        var titleBlockHeight = titleBlockBottom - titleBlockTop;
        var nameFit = fitNameSize(ctx, name, 540, 104, 48, titleBlockHeight, 2);
        var nameCapHeight = nameFit.size * 0.7;
        var nameVisualHeight = (nameFit.lines.length - 1) * nameFit.lineHeight + nameCapHeight;
        var nameTop = titleBlockTop + Math.max(0, (titleBlockHeight - nameVisualHeight) / 2);
        var nameBaseline = nameTop + nameCapHeight;
        var subtitleX = 76;
        var subtitleMaxWidth = 450;
        var subtitleSize = 30;
        var subtitleLineHeight = 36;
        var subtitleTop = titleBlockBottom + 24;
        var subtitleFirstBaseline = subtitleTop + Math.round(subtitleSize * 0.82);
        var subtitleBottom = subtitleTop + (fixedSubtitleLines.length - 1) * subtitleLineHeight + subtitleSize;
        var featureRegionTop = subtitleBottom + 24;
        var featureRegionBottom = 878;
        var featureCount = features.length;
        var featureMode = featureCount <= 3 ? "normal" : (featureCount === 4 ? "four" : "compact");
        var visibleFeatures = featureCount <= 5 ? features : features.slice(0, 4);
        var summaryText = featureCount > 5 ? "Y " + (featureCount - 4) + " CARACTERÍSTICAS MÁS" : "";
        var featureSlots = featureCount > 5 ? 5 : featureCount;
        var featureCenters;
        if (featureMode === "normal") {
            featureCenters = visibleFeatures.map(function (item, index) {
                return featureRegionTop + (featureRegionBottom - featureRegionTop) * (index + 1) / (visibleFeatures.length + 1);
            });
        } else {
            var featureStep = (featureRegionBottom - featureRegionTop) / (featureSlots + 1);
            featureCenters = [];
            for (var slot = 0; slot < featureSlots; slot += 1) {
                featureCenters.push(featureRegionTop + featureStep * (slot + 1));
            }
        }
        var priceText = priceLabel(product.price);
        var priceSize = fitFontSize(ctx, priceText, 352, 1, 88, 30, '700');
        var guarantee = cleanText(product.guarantee);
        var guaranteeSize = guarantee ? fitSingleLineSize(ctx, guarantee, 900, 48, 24, "700", "DM Sans") : 0;
        var manager = cleanText(managerName);
        var warning = manager ? "" : "No se dibujó el comercial: falta el nombre en Mi cuenta.";
        var overflow = [];

        ctx.font = '800 ' + nameFit.size + 'px "DM Sans", sans-serif';
        if (nameFit.lines.length > 2 || nameFit.lines.some(function (line) { return ctx.measureText(line).width > 540; })) {
            overflow.push('nombre "' + name + '"');
        }

        ctx.font = '600 ' + subtitleSize + 'px "Inter Tight", sans-serif';
        if (fixedSubtitleLines.some(function (line) { return ctx.measureText(line).width > subtitleMaxWidth; })) {
            overflow.push('texto fijo "' + fixedSubtitle + '"');
        }

        var iconosUsados = [];
        var featureLayouts = visibleFeatures.map(function (feature, index) {
            var item = featurePair(feature);
            var titleText = item.title.toUpperCase();
            var claveIcono = normalizarClave(item.title);
            var tipoIcono = asignarIcono(claveIcono, iconosUsados);
            var color = (index % 2 === 0) ? "#2E4A3F" : "#C8A165";
            var drawDetail = featureMode !== "compact" && Boolean(item.detail);
            var titleSize;
            var titleLines;
            var detailText = "";
            var detailLines = [];
            var detailSize = 0;
            var detailLineHeight = 0;
            var iconRadius = featureMode === "normal" ? 38 : (featureMode === "four" ? 26 : 22);

            if (featureMode === "normal") {
                titleSize = drawDetail
                    ? fitSingleLineSize(ctx, titleText, 410, 24, 16, "800", "DM Sans")
                    : fitFontSize(ctx, titleText, 410, 2, 24, 16, "800", "DM Sans");
                ctx.font = '800 ' + titleSize + 'px "DM Sans", sans-serif';
                titleLines = measureLines(ctx, titleText, 410);
                if (!titleText || titleLines.length > (drawDetail ? 1 : 2) ||
                    titleLines.some(function (line) { return ctx.measureText(line).width > 410; })) {
                    overflow.push('título de característica "' + item.title + '"');
                }
                if (drawDetail) {
                    detailSize = 19;
                    detailLineHeight = 28;
                    detailText = item.detail.charAt(0).toUpperCase() + item.detail.slice(1);
                    ctx.font = '400 ' + detailSize + 'px "Inter Tight", sans-serif';
                    detailLines = measureLines(ctx, detailText, 410);
                    if (detailLines.length > 2 ||
                        detailLines.some(function (line) { return ctx.measureText(line).width > 410; })) {
                        overflow.push('detalle de característica "' + item.title + '"');
                    }
                }
                if (featureCenters[index] - 52 < featureRegionTop || featureCenters[index] + 52 > featureRegionBottom) {
                    overflow.push('características (no caben entre el subtítulo y la franja)');
                }
            } else {
                var maxTitleSize = featureMode === "four" ? 20 : 18;
                titleSize = fitSingleLineSize(ctx, titleText, 410, maxTitleSize, 16, "800", "DM Sans");
                ctx.font = '800 ' + titleSize + 'px "DM Sans", sans-serif';
                titleLines = [truncateToWidth(ctx, titleText, 410)];
                if (drawDetail) {
                    detailSize = 15;
                    detailLineHeight = 18;
                    detailText = item.detail.charAt(0).toUpperCase() + item.detail.slice(1);
                    ctx.font = '400 ' + detailSize + 'px "Inter Tight", sans-serif';
                    detailLines = [truncateToWidth(ctx, detailText, 410)];
                }
                var rowHalf = featureMode === "four" ? 32 : 28;
                if (featureCenters[index] - rowHalf < featureRegionTop || featureCenters[index] + rowHalf > featureRegionBottom) {
                    overflow.push('características (no caben entre el subtítulo y la franja)');
                }
            }

            return {
                summary: false,
                titleText: titleText,
                hasDetail: drawDetail,
                titleSize: titleSize,
                titleLines: titleLines,
                titleLineHeight: Math.round(titleSize * 1.2),
                detailText: detailText,
                detailLines: detailLines,
                detailSize: detailSize,
                detailLineHeight: detailLineHeight,
                iconRadius: iconRadius,
                icono: tipoIcono,
                color: color,
                separatorTop: drawDetail ? (featureMode === "normal" ? -30 : -24) : (featureMode === "normal" ? -28 : -(iconRadius + 2)),
                separatorBottom: drawDetail ? (featureMode === "normal" ? 34 : 28) : (featureMode === "normal" ? 28 : iconRadius + 2),
                center: featureCenters[index]
            };
        });

        if (summaryText) {
            ctx.font = '800 18px "DM Sans", sans-serif';
            featureLayouts.push({
                summary: true,
                titleText: truncateToWidth(ctx, summaryText, 410),
                hasDetail: false,
                titleSize: 18,
                titleLines: [truncateToWidth(ctx, summaryText, 410)],
                titleLineHeight: Math.round(18 * 1.2),
                detailText: "",
                detailLines: [],
                detailSize: 0,
                detailLineHeight: 0,
                iconRadius: 0,
                separatorTop: 0,
                separatorBottom: 0,
                center: featureCenters[4]
            });
        }

        ctx.font = '700 ' + priceSize + 'px "DM Sans", sans-serif';
        if (ctx.measureText(priceText).width > 352) overflow.push('precio "' + priceText + '"');

        if (guarantee) {
            ctx.font = '700 ' + guaranteeSize + 'px "DM Sans", sans-serif';
            if (ctx.measureText(guarantee).width > 900) overflow.push('garantía "' + guarantee + '"');
        }

        if (manager) {
            ctx.font = '600 25px "Inter Tight", sans-serif';
            if (ctx.measureText("Comercial VOLXEN: " + manager).width > 513) overflow.push('nombre del comercial "' + manager + '"');
        }

        if (overflow.length) {
            throw new Error("Estos datos no caben completos en la imagen: " + overflow.join("; ") + ". No se generó la imagen para no recortarlos.");
        }

        ctx.fillStyle = "#163A2D";
        ctx.font = '800 ' + nameFit.size + 'px "DM Sans", sans-serif';
        nameFit.lines.forEach(function (line, index) {
            ctx.fillText(line, 74, nameBaseline + index * nameFit.lineHeight);
        });

        ctx.fillStyle = "#4A4A46";
        ctx.font = '600 ' + subtitleSize + 'px "Inter Tight", sans-serif';
        fixedSubtitleLines.forEach(function (line, index) {
            ctx.fillText(line, subtitleX, subtitleFirstBaseline + index * subtitleLineHeight);
        });

        featureLayouts.forEach(function (layout, index) {
            if (layout.summary) {
                var summaryBaseline = layout.center + layout.titleSize * 0.35;
                ctx.fillStyle = "#163A2D";
                ctx.font = '800 ' + layout.titleSize + 'px "DM Sans", sans-serif';
                ctx.fillText(layout.titleLines[0], 210, summaryBaseline);
                return;
            }
            drawFeatureIcon(ctx, layout.icono, 112, layout.center, layout.iconRadius, layout.color);

            ctx.strokeStyle = "#C8A165";
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(190, layout.center + layout.separatorTop);
            ctx.lineTo(190, layout.center + layout.separatorBottom);
            ctx.stroke();

            if (layout.hasDetail) {
                var detailTitleBaseline = layout.detailSize === 19 ? layout.center - 6 : layout.center - 4;
                ctx.fillStyle = "#163A2D";
                ctx.font = '800 ' + layout.titleSize + 'px "DM Sans", sans-serif';
                ctx.fillText(layout.titleLines[0], 210, detailTitleBaseline);
                ctx.fillStyle = "#4A4A46";
                ctx.font = '400 ' + layout.detailSize + 'px "Inter Tight", sans-serif';
                var detailBaseline = layout.detailSize === 19 ? detailTitleBaseline + 30 : layout.center + 17;
                layout.detailLines.forEach(function (line, lineIndex) {
                    ctx.fillText(line, 210, detailBaseline + lineIndex * layout.detailLineHeight);
                });
            } else {
                var titleCapHeight = layout.titleSize * 0.7;
                var titleVisualHeight = (layout.titleLines.length - 1) * layout.titleLineHeight + titleCapHeight;
                var titleTop = layout.center - titleVisualHeight / 2;
                var titleBaseline = titleTop + titleCapHeight;
                ctx.fillStyle = "#1E1D1B";
                ctx.font = '800 ' + layout.titleSize + 'px "DM Sans", sans-serif';
                layout.titleLines.forEach(function (line, lineIndex) {
                    ctx.fillText(line, 210, titleBaseline + lineIndex * layout.titleLineHeight);
                });
            }
        });

        drawPricePanel(ctx, 840, 16, 400, 170);
        ctx.fillStyle = "#C8A165";
        ctx.font = '700 18px "Inter Tight", sans-serif';
        ctx.fillText("PRECIO", 864, 56);
        ctx.fillStyle = "#F8F7F4";
        ctx.font = '700 ' + priceSize + 'px "DM Sans", sans-serif';
        ctx.fillText(priceText, 862, 150);

        if (guarantee) {
            drawGoldTag(ctx, 1250, 40, 185, 110);
            var bandCenter = (902 + 1059) / 2;
            var guaranteeX = 120;
            ctx.fillStyle = "#C8A165";
            ctx.font = '700 24px "Inter Tight", sans-serif';
            drawTrackedText(ctx, "GARANTÍA", guaranteeX, bandCenter - 13, 4);
            ctx.fillStyle = "#F5EEDC";
            ctx.font = '700 ' + guaranteeSize + 'px "DM Sans", sans-serif';
            ctx.fillText(guarantee, guaranteeX, bandCenter + 36);
        }

        if (manager) {
            var footerText = "Comercial VOLXEN: " + manager;
            ctx.fillStyle = "#4A4A46";
            ctx.textAlign = "right";
            ctx.font = '600 25px "Inter Tight", sans-serif';
            ctx.fillText(footerText, 1180, 1120);
            ctx.textAlign = "left";
        }

        return { blob: await canvasBlob(canvas), warning: warning };
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
