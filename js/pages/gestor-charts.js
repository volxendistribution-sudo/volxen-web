(function () {
    "use strict";

    var SVG_NS = "http://www.w3.org/2000/svg";
    var STATUS_ORDER = [
        "Pedido recibido",
        "Confirmando pedido",
        "Preparando pedido",
        "En camino",
        "Entregado",
        "Cancelado"
    ];

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function amount(value) {
        var number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function money(value) {
        return "$" + amount(value).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function count(value) {
        return Math.round(amount(value)).toLocaleString("es-ES");
    }

    function compact(value) {
        var number = amount(value);
        if (Math.abs(number) >= 1000) {
            return (number / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + "k";
        }
        return number.toLocaleString("es-ES", { maximumFractionDigits: 1 });
    }

    function niceMax(value) {
        var number = Math.max(1, amount(value));
        var power = Math.pow(10, Math.floor(Math.log10(number)));
        var normalized = number / power;
        var step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
        return step * power;
    }

    function monthKey(date) {
        return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
    }

    function monthLabel(date) {
        return date.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
    }

    function shortDate(date) {
        return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).replace(".", "");
    }

    function orderDate(order) {
        var date = new Date(order && order.created_at);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function isCancelled(order) {
        return String(order && order.estado || "") === "Cancelado";
    }

    function monthlyCommission(orders, months) {
        var total = Math.max(1, Number(months) || 12);
        var now = new Date();
        now.setDate(1);
        now.setHours(0, 0, 0, 0);
        var buckets = [];
        var index = {};

        for (var offset = total - 1; offset >= 0; offset -= 1) {
            var date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            var key = monthKey(date);
            var bucket = { label: monthLabel(date), value: 0, orders: 0, key: key };
            index[key] = bucket;
            buckets.push(bucket);
        }

        (Array.isArray(orders) ? orders : []).forEach(function (order) {
            if (isCancelled(order)) return;
            var date = orderDate(order);
            if (!date) return;
            var bucket = index[monthKey(date)];
            if (!bucket) return;
            bucket.value += amount(order.comision_monto_usd);
            bucket.orders += 1;
        });

        return buckets;
    }

    function statusBreakdown(orders) {
        var counts = {};
        STATUS_ORDER.forEach(function (status) { counts[status] = 0; });
        (Array.isArray(orders) ? orders : []).forEach(function (order) {
            var status = String(order && order.estado || "").trim();
            if (!Object.prototype.hasOwnProperty.call(counts, status)) return;
            counts[status] += 1;
        });
        return STATUS_ORDER.map(function (status) {
            return { label: status, value: counts[status], status: status };
        });
    }

    function topProducts(orders, limit) {
        var productMap = {};
        (Array.isArray(orders) ? orders : []).forEach(function (order) {
            if (isCancelled(order)) return;
            var items = Array.isArray(order && order.items) ? order.items : [];
            items.forEach(function (item) {
                var name = String(item && (item.producto_nombre || item.nombre || item.nombre_producto) || "").trim();
                if (!name) return;
                var units = Math.max(0, Math.round(amount(item.cantidad || item.qty)));
                if (!units) return;
                if (!productMap[name]) productMap[name] = { label: name, value: 0 };
                productMap[name].value += units;
            });
        });
        return Object.keys(productMap)
            .map(function (name) { return productMap[name]; })
            .sort(function (a, b) { return b.value - a.value || a.label.localeCompare(b.label, "es"); })
            .slice(0, Math.max(1, Number(limit) || 8));
    }

    function evolution(orders, days) {
        var totalDays = Math.max(1, Number(days) || 30);
        var bucketCount = totalDays <= 7 ? totalDays : totalDays <= 30 ? 10 : 12;
        var now = new Date();
        now.setHours(23, 59, 59, 999);
        var start = new Date(now);
        start.setDate(start.getDate() - totalDays + 1);
        start.setHours(0, 0, 0, 0);
        var span = Math.max(1, now.getTime() - start.getTime());
        var step = span / bucketCount;
        var buckets = [];

        for (var i = 0; i < bucketCount; i += 1) {
            var bucketDate = new Date(start.getTime() + i * step);
            buckets.push({ label: shortDate(bucketDate), value: 0 });
        }

        (Array.isArray(orders) ? orders : []).forEach(function (order) {
            var date = orderDate(order);
            if (!date) return;
            var time = date.getTime();
            if (time < start.getTime() || time > now.getTime()) return;
            var idx = Math.max(0, Math.min(bucketCount - 1, Math.floor((time - start.getTime()) / step)));
            buckets[idx].value += 1;
        });

        return buckets;
    }

    function emptySvg(title, message) {
        return '<svg class="gs-chart-svg" viewBox="0 0 680 280" role="img" aria-label="' + escapeHtml(title + ". " + message) + '">' +
            '<title>' + escapeHtml(title) + '</title>' +
            '<text x="340" y="132" text-anchor="middle" font-family="Inter Tight, sans-serif" font-size="14" font-weight="600" fill="#1E1D1B">' + escapeHtml(message) + '</text>' +
        '</svg>';
    }

    function axisSvg(params) {
        var width = 680;
        var height = params.height || 288;
        var left = 58;
        var right = 18;
        var top = 28;
        var bottom = 48;
        var plotW = width - left - right;
        var plotH = height - top - bottom;
        var max = niceMax(params.max || 1);
        var items = params.items || [];
        var color = params.color || "#C8A165";
        var format = params.format || compact;
        var grid = "";
        var labels = "";
        var marks = "";
        var step = plotW / Math.max(1, items.length);
        var barW = Math.max(8, Math.min(42, step * 0.56));

        for (var tick = 0; tick <= 4; tick += 1) {
            var ratio = tick / 4;
            var y = top + plotH - ratio * plotH;
            grid += '<line x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (left + plotW) + '" y2="' + y.toFixed(1) + '" stroke="rgba(30,29,27,.12)" stroke-width="1" stroke-dasharray="3 4"/>';
            labels += '<text x="' + (left - 8) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-family="Inter Tight, sans-serif" font-size="9" fill="#77736C">' + escapeHtml(format(max * ratio)) + '</text>';
        }

        items.forEach(function (item, index) {
            var value = Math.max(0, amount(item.value));
            var h = max > 0 ? (value / max) * plotH : 0;
            var x = left + index * step + (step - barW) / 2;
            var y = top + plotH - h;
            var tip = item.label + ": " + format(value);
            marks += '<g class="gs-svg-mark" data-chart-tip="' + escapeHtml(tip) + '" tabindex="0" role="listitem" aria-label="' + escapeHtml(tip) + '">' +
                '<title>' + escapeHtml(tip) + '</title>' +
                '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(1, h).toFixed(1) + '" rx="5" fill="' + color + '"/>' +
                (value > 0 ? '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + Math.max(12, y - 6).toFixed(1) + '" text-anchor="middle" font-family="Inter Tight, sans-serif" font-size="9" font-weight="600" fill="#1E1D1B">' + escapeHtml(format(value)) + '</text>' : "") +
            '</g>';
            labels += '<text x="' + (left + index * step + step / 2).toFixed(1) + '" y="' + (height - 20) + '" text-anchor="middle" font-family="Inter Tight, sans-serif" font-size="9" fill="#77736C">' + escapeHtml(item.label) + '</text>';
        });

        return '<svg class="gs-chart-svg" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="' + escapeHtml(params.title || "Gráfico") + '">' +
            '<title>' + escapeHtml(params.title || "Gráfico") + '</title>' +
            (params.description ? '<desc>' + escapeHtml(params.description) + '</desc>' : "") +
            grid + labels +
            '<line x1="' + left + '" y1="' + (top + plotH) + '" x2="' + (left + plotW) + '" y2="' + (top + plotH) + '" stroke="rgba(30,29,27,.28)" stroke-width="1"/>' +
            '<text x="' + left + '" y="' + (height - 4) + '" font-family="Inter Tight, sans-serif" font-size="9" fill="#77736C">' + escapeHtml(params.xLabel || "") + '</text>' +
            '<text x="' + left + '" y="14" font-family="Inter Tight, sans-serif" font-size="9" fill="#77736C">' + escapeHtml(params.yLabel || "") + '</text>' +
            marks +
        '</svg>';
    }

    function barChartSvg(options) {
        var opts = options || {};
        var items = Array.isArray(opts.items) ? opts.items : [];
        if (!items.some(function (item) { return amount(item.value) > 0; })) {
            return emptySvg(opts.title || "Gráfico", opts.empty || "Sin datos en este periodo.");
        }
        return axisSvg({
            title: opts.title,
            description: opts.description,
            items: items,
            color: opts.color || "#C8A165",
            format: opts.format || compact,
            yLabel: opts.yLabel || "USD",
            xLabel: opts.xLabel || "Periodo"
        });
    }

    function lineChartSvg(options) {
        var opts = options || {};
        var items = Array.isArray(opts.items) ? opts.items : [];
        if (!items.some(function (item) { return amount(item.value) > 0; })) {
            return emptySvg(opts.title || "Gráfico", opts.empty || "Sin datos en este periodo.");
        }

        var width = 680;
        var height = 288;
        var left = 58;
        var right = 18;
        var top = 28;
        var bottom = 48;
        var plotW = width - left - right;
        var plotH = height - top - bottom;
        var max = niceMax(Math.max.apply(null, items.map(function (item) { return amount(item.value); })) || 1);
        var format = opts.format || count;
        var color = opts.color || "#2E4A3F";
        var step = plotW / Math.max(1, items.length - 1);
        var grid = "";
        var labels = "";
        var points = [];

        for (var tick = 0; tick <= 4; tick += 1) {
            var ratio = tick / 4;
            var y = top + plotH - ratio * plotH;
            grid += '<line x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (left + plotW) + '" y2="' + y.toFixed(1) + '" stroke="rgba(30,29,27,.12)" stroke-width="1" stroke-dasharray="3 4"/>';
            labels += '<text x="' + (left - 8) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-family="Inter Tight, sans-serif" font-size="9" fill="#77736C">' + escapeHtml(format(max * ratio)) + '</text>';
        }

        items.forEach(function (item, index) {
            var value = Math.max(0, amount(item.value));
            var x = left + index * step;
            var y = top + plotH - (max > 0 ? (value / max) * plotH : 0);
            points.push({ x: x, y: y, item: item, value: value });
            labels += '<text x="' + x.toFixed(1) + '" y="' + (height - 20) + '" text-anchor="middle" font-family="Inter Tight, sans-serif" font-size="9" fill="#77736C">' + escapeHtml(item.label) + '</text>';
        });

        var line = points.map(function (point) { return point.x.toFixed(1) + "," + point.y.toFixed(1); }).join(" ");
        var marks = points.map(function (point) {
            var tip = point.item.label + ": " + format(point.value);
            return '<g class="gs-svg-mark" data-chart-tip="' + escapeHtml(tip) + '" tabindex="0" role="listitem" aria-label="' + escapeHtml(tip) + '">' +
                '<title>' + escapeHtml(tip) + '</title>' +
                '<circle cx="' + point.x.toFixed(1) + '" cy="' + point.y.toFixed(1) + '" r="4" fill="#F8F7F4" stroke="' + color + '" stroke-width="2"/>' +
                (point.value > 0 ? '<text x="' + point.x.toFixed(1) + '" y="' + Math.max(12, point.y - 9).toFixed(1) + '" text-anchor="middle" font-family="Inter Tight, sans-serif" font-size="9" font-weight="600" fill="#1E1D1B">' + escapeHtml(format(point.value)) + '</text>' : "") +
            '</g>';
        }).join("");

        return '<svg class="gs-chart-svg" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="' + escapeHtml(opts.title || "Gráfico") + '">' +
            '<title>' + escapeHtml(opts.title || "Gráfico") + '</title>' +
            (opts.description ? '<desc>' + escapeHtml(opts.description) + '</desc>' : "") +
            grid + labels +
            '<line x1="' + left + '" y1="' + (top + plotH) + '" x2="' + (left + plotW) + '" y2="' + (top + plotH) + '" stroke="rgba(30,29,27,.28)" stroke-width="1"/>' +
            '<polyline points="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
            '<text x="' + left + '" y="' + (height - 4) + '" font-family="Inter Tight, sans-serif" font-size="9" fill="#77736C">' + escapeHtml(opts.xLabel || "") + '</text>' +
            '<text x="' + left + '" y="14" font-family="Inter Tight, sans-serif" font-size="9" fill="#77736C">' + escapeHtml(opts.yLabel || "") + '</text>' +
            marks +
        '</svg>';
    }

    function horizontalBarSvg(options) {
        var opts = options || {};
        var items = Array.isArray(opts.items) ? opts.items : [];
        if (!items.length || !items.some(function (item) { return amount(item.value) > 0; })) {
            return emptySvg(opts.title || "Gráfico", opts.empty || "Sin datos en este periodo.");
        }

        var width = 680;
        var row = 32;
        var top = 26;
        var left = Math.min(220, Math.max(120, Math.max.apply(null, items.map(function (item) { return String(item.label || "").length; })) * 6.2));
        var right = 66;
        var plotW = width - left - right;
        var height = top + items.length * row + 22;
        var max = niceMax(Math.max.apply(null, items.map(function (item) { return amount(item.value); })) || 1);
        var format = opts.format || count;
        var color = opts.color || "#2E4A3F";
        var rows = "";

        items.forEach(function (item, index) {
            var value = Math.max(0, amount(item.value));
            var w = max > 0 ? (value / max) * plotW : 0;
            var y = top + index * row;
            var tip = item.label + ": " + format(value);
            rows += '<g class="gs-svg-mark" data-chart-tip="' + escapeHtml(tip) + '" tabindex="0" role="listitem" aria-label="' + escapeHtml(tip) + '">' +
                '<title>' + escapeHtml(tip) + '</title>' +
                '<text x="0" y="' + (y + 14) + '" font-family="Inter Tight, sans-serif" font-size="10" fill="#1E1D1B">' + escapeHtml(item.label) + '</text>' +
                '<rect x="' + left + '" y="' + (y + 4) + '" width="' + plotW + '" height="14" rx="7" fill="rgba(30,29,27,.07)"/>' +
                '<rect x="' + left + '" y="' + (y + 4) + '" width="' + Math.max(1, w).toFixed(1) + '" height="14" rx="7" fill="' + (item.color || color) + '"/>' +
                '<text x="' + (left + plotW + 8) + '" y="' + (y + 15) + '" font-family="Inter Tight, sans-serif" font-size="10" font-weight="600" fill="#1E1D1B">' + escapeHtml(format(value)) + '</text>' +
            '</g>';
        });

        return '<svg class="gs-chart-svg" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="' + escapeHtml(opts.title || "Gráfico") + '">' +
            '<title>' + escapeHtml(opts.title || "Gráfico") + '</title>' +
            (opts.description ? '<desc>' + escapeHtml(opts.description) + '</desc>' : "") +
            '<text x="0" y="12" font-family="Inter Tight, sans-serif" font-size="9" fill="#77736C">' + escapeHtml(opts.xLabel || "") + '</text>' +
            rows +
        '</svg>';
    }

    function bindTooltips(root) {
        if (!root || root.getAttribute("data-chart-tooltips") === "1") return;
        root.setAttribute("data-chart-tooltips", "1");
        var tooltip = document.getElementById("gsChartTooltipGlobal");
        if (!tooltip) {
            tooltip = document.createElement("div");
            tooltip.id = "gsChartTooltipGlobal";
            tooltip.className = "gs-chart-tooltip is-floating";
            tooltip.hidden = true;
            tooltip.setAttribute("role", "status");
            document.body.appendChild(tooltip);
        }

        function show(event) {
            var mark = event.target.closest("[data-chart-tip]");
            if (!mark) return;
            var text = mark.getAttribute("data-chart-tip") || "";
            if (!text) return;
            tooltip.textContent = text;
            tooltip.hidden = false;
            var x = event.clientX || 0;
            var y = event.clientY || 0;
            tooltip.style.left = Math.max(8, Math.min(window.innerWidth - 180, x + 10)) + "px";
            tooltip.style.top = Math.max(8, y - 42) + "px";
        }

        function hide(event) {
            if (event && event.target.closest && event.target.closest("[data-chart-tip]")) return;
            tooltip.hidden = true;
        }

        root.addEventListener("click", show);
        root.addEventListener("pointerup", function (event) {
            if (event.pointerType !== "mouse") show(event);
        });
        document.addEventListener("click", hide);
        window.addEventListener("scroll", function () { tooltip.hidden = true; }, { passive: true });
    }

    window.VXGESTOR_CHARTS = {
        STATUS_ORDER: STATUS_ORDER,
        monthlyCommission: monthlyCommission,
        statusBreakdown: statusBreakdown,
        topProducts: topProducts,
        evolution: evolution,
        barChartSvg: barChartSvg,
        lineChartSvg: lineChartSvg,
        horizontalBarSvg: horizontalBarSvg,
        emptySvg: emptySvg,
        bindTooltips: bindTooltips
    };
})();
