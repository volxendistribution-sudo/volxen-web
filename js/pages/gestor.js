(function () {
    "use strict";

    const COMMISSION_LABELS = {
        pendiente: "Pendiente",
        disponible: "Lista para cobrar",
        pagada: "Pagada",
        cancelada: "Cancelada"
    };

    const COMMISSION_CLASSES = {
        pendiente: "gs-badge-pending",
        disponible: "gs-badge-ready",
        pagada: "gs-badge-paid",
        cancelada: "gs-badge-cancelled"
    };

    const ORDER_STATUS_ORDER = [
        "Pedido recibido",
        "Confirmando pedido",
        "Preparando pedido",
        "En camino",
        "Entregado",
        "Cancelado"
    ];

    const state = {
        session: null,
        summary: null,
        orders: [],
        clients: [],
        roleRow: null,
        promoter: null,
        query: "",
        queryInput: "",
        status: "",
        period: "30",
        reportPeriod: "30",
        categoryPeriod: "30",
        sort: "recent",
        panelView: "dashboard",
        catalogCategory: "",
        catalogQuery: "",
        catalogQueryInput: "",
        catalogSort: "featured",
        catalogReady: false,
        catalogLoading: false,
        catalogPromise: null,
        catalogProductId: "",
        loading: false,
        hasMore: false
    };

    const refs = {};

    function id(value) {
        return document.getElementById(value);
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function money(value) {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return "$0.00";
        return "$" + amount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function count(value) {
        const amount = Number(value);
        return Number.isFinite(amount) ? amount.toLocaleString("es-ES") : "0";
    }

    function dateLabel(value) {
        if (!value) return "Sin fecha";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Sin fecha";
        return new Intl.DateTimeFormat("es-ES", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function normalize(value) {
        return String(value == null ? "" : value)
            .toLocaleLowerCase("es")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function userInitial(name, email) {
        return (String(name || "").trim() || String(email || "").trim() || "V")
            .charAt(0)
            .toUpperCase();
    }

    function orderStatusInfo(status) {
        const value = String(status || "").trim();

        if (value === "Entregado") {
            return { label: value, className: "is-complete" };
        }
        if (value === "Cancelado") {
            return { label: value, className: "is-cancelled" };
        }
        if (value === "Pedido recibido") {
            return { label: value, className: "is-pending" };
        }
        return { label: value || "Sin estado", className: "is-progress" };
    }

    function thresholdForDays(days) {
        const amount = Number(days);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        const threshold = new Date();
        threshold.setHours(0, 0, 0, 0);
        threshold.setDate(threshold.getDate() - (amount - 1));
        return threshold;
    }

    function periodThreshold() {
        if (state.period === "all") return null;
        return thresholdForDays(state.period);
    }

    function orderDate(order) {
        const date = new Date(order && order.created_at);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function orderUnits(order) {
        const items = Array.isArray(order && order.items) ? order.items : [];
        return items.reduce(function (total, item) {
            const quantity = Number(item.cantidad || item.qty || 0);
            return total + (Number.isFinite(quantity) ? quantity : 0);
        }, 0);
    }

    function orderGross(order) {
        const amount = Number(order && order.total_usd);
        return Number.isFinite(amount) ? amount : 0;
    }

    function orderCommissionValue(order) {
        const amount = Number(order && order.comision_monto_usd);
        return Number.isFinite(amount) ? amount : 0;
    }

    function orderCompleted(order) {
        return String(order && order.estado) !== "Cancelado";
    }

    function withinThreshold(order, threshold) {
        if (!threshold) return true;
        const date = orderDate(order);
        return Boolean(date && date >= threshold);
    }

    function compactMoney(value) {
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) return "$0";
        if (amount >= 1000000) return "$" + (amount / 1000000).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + "M";
        if (amount >= 1000) return "$" + (amount / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + "k";
        return "$" + Math.round(amount).toLocaleString("es-ES");
    }

    function niceMax(value) {
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) return 1;
        const power = Math.pow(10, Math.floor(Math.log10(amount)));
        const normalized = amount / power;
        const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
        return step * power;
    }

    function dateRangeLabel(date, days) {
        if (!date) return "";
        if (Number(days) <= 7) {
            return new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(date).replace(".", "");
        }
        return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(date).replace(".", "");
    }

    function statusCounts() {
        const summary = state.summary || {};
        const byState = summary.pedidos_por_estado && typeof summary.pedidos_por_estado === "object"
            ? summary.pedidos_por_estado
            : null;

        if (byState) {
            const normalized = {};
            ORDER_STATUS_ORDER.forEach(function (status) {
                normalized[status] = Number(byState[status] || 0);
            });
            return normalized;
        }

        const fallback = {};
        ORDER_STATUS_ORDER.forEach(function (status) {
            fallback[status] = 0;
        });
        state.orders.forEach(function (order) {
            const status = String(order.estado || "");
            if (Object.prototype.hasOwnProperty.call(fallback, status)) fallback[status] += 1;
        });
        return fallback;
    }

    function cleanPhone(value) {
        return String(value == null ? "" : value).replace(/[^\d]/g, "");
    }

    function whatsappHref(phone) {
        let digits = cleanPhone(phone);
        if (digits.length === 8) digits = "53" + digits;
        return digits ? "https://wa.me/" + digits : "";
    }

    function roleLabel() {
        return "Promotor";
    }

    function commissionReason(order) {
        const status = order.comision_estado || "pendiente";
        if (status === "cancelada") return "Pedido cancelado";
        if (status === "pagada") return "Pago registrado por administración";
        if (status === "disponible") return "Pedido entregado";
        return "Pendiente de entrega";
    }

    function commissionDate(order) {
        const status = order.comision_estado || "pendiente";
        if (status === "pagada") return order.comision_pagada_at || order.updated_at || order.created_at;
        if (status === "disponible") return order.comision_disponible_at || order.updated_at || order.created_at;
        if (status === "cancelada") return order.updated_at || order.created_at;
        return order.created_at || order.updated_at;
    }

    function commissionEvent(order) {
        const status = order.comision_estado || "pendiente";
        const code = order.codigo || "Pedido";
        const amount = money(order.comision_monto_usd);

        if (status === "pagada") {
            return {
                date: commissionDate(order),
                tone: "is-paid",
                icon: "fa-circle-check",
                title: "Comisión pagada",
                body: code + " · " + amount
            };
        }

        if (status === "disponible") {
            return {
                date: commissionDate(order),
                tone: "is-ready",
                icon: "fa-coins",
                title: "Comisión lista para cobrar",
                body: code + " · " + amount
            };
        }

        if (status === "cancelada") {
            return {
                date: commissionDate(order),
                tone: "is-cancelled",
                icon: "fa-circle-xmark",
                title: "Comisión cancelada",
                body: code + " · Motivo: pedido cancelado"
            };
        }

        return {
            date: order.created_at,
            tone: "",
            icon: "fa-clock",
            title: "Pedido atribuido",
            body: code + " · Comisión pendiente"
        };
    }

    function setView(view) {
        ["gsGuest", "gsDenied", "gsLoading", "gsError", "gsDashboard"].forEach(function (name) {
            if (refs[name]) refs[name].hidden = name !== view;
        });
        document.body.dataset.gsView = view;
        if (view !== "gsDashboard") closeNav();
    }

    function isMobileNav() {
        return window.matchMedia("(max-width: 1024px)").matches;
    }

    function openNav() {
        if (!refs.gsApp) return;
        refs.gsApp.classList.add("is-nav-open");
        if (refs.gsScrim) refs.gsScrim.hidden = false;
        if (refs.gsMenuToggle) refs.gsMenuToggle.setAttribute("aria-expanded", "true");
    }

    function closeNav() {
        if (!refs.gsApp) return;
        refs.gsApp.classList.remove("is-nav-open");
        if (refs.gsScrim) refs.gsScrim.hidden = true;
        if (refs.gsMenuToggle) refs.gsMenuToggle.setAttribute("aria-expanded", "false");
    }

    function setSidebarCollapsed(collapsed) {
        if (!refs.gsApp) return;
        refs.gsApp.classList.toggle("is-sidebar-collapsed", collapsed);
        if (refs.gsSidebarToggle) {
            refs.gsSidebarToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
            refs.gsSidebarToggle.setAttribute("aria-label", collapsed ? "Expandir menú" : "Contraer menú");
        }
    }

    function setActiveNav(link) {
        if (!refs.gsSidebar) return;
        refs.gsSidebar.querySelectorAll("[data-gs-nav]").forEach(function (item) {
            item.classList.toggle("is-active", item === link);
            if (item === link) {
                item.setAttribute("aria-current", "page");
            } else {
                item.removeAttribute("aria-current");
            }
        });
    }

    function setNotice(message, isError) {
        if (!refs.gsNotice) return;
        refs.gsNotice.textContent = message || "";
        refs.gsNotice.classList.toggle("is-error", Boolean(isError));
        refs.gsNotice.hidden = !message;
    }

    function setBusy(value) {
        state.loading = value;
        if (refs.gsMore) refs.gsMore.disabled = value;
    }

    function renderHeader() {
        const user = state.session && state.session.user ? state.session.user : {};
        const name = String(user.nombre || "").trim();

        if (refs.gsGreeting) refs.gsGreeting.textContent = "Hola de nuevo";
        refs.gsTitle.textContent = name || "Tu panel comercial";
        if (refs.gsTopAvatar) refs.gsTopAvatar.textContent = userInitial(name, user.email);
    }

    function renderSummary() {
        const summary = state.summary || {};
        refs.gsSales.textContent = money(summary.ventas_total_usd);
        refs.gsOrdersCount.textContent = count(summary.pedidos_total);
        refs.gsClientsCount.textContent = count(summary.clientes_total);
        refs.gsCommissionAvailable.textContent = money(summary.comision_disponible_usd);
        refs.gsCommissionPaid.textContent = money(summary.comision_pagada_usd);
        refs.gsCommissionPending.textContent = money(summary.comision_pendiente_usd);
        refs.gsCommissionReady.textContent = money(summary.comision_disponible_usd);
        refs.gsCommissionDone.textContent = money(summary.comision_pagada_usd);
    }

    function renderProfile() {
        const user = state.session && state.session.user ? state.session.user : {};
        const role = user.role || (state.roleRow && state.roleRow.role) || "";
        const promoter = state.promoter || null;
        const name = String(user.nombre || "").trim();
        const initial = userInitial(name, user.email);
        const commission = promoter && promoter.comision_porcentaje != null
            ? Number(promoter.comision_porcentaje).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + "%"
            : "Por definir";

        if (refs.gsProfileInitial) refs.gsProfileInitial.textContent = initial;
        if (refs.gsTopAvatar) refs.gsTopAvatar.textContent = initial;
        if (refs.gsProfileName) refs.gsProfileName.textContent = name || "Tu cuenta";
        if (refs.gsProfileEmail) refs.gsProfileEmail.textContent = user.email || "";
        if (refs.gsProfileRole) refs.gsProfileRole.textContent = roleLabel(role);
        if (refs.gsProfileCommission) refs.gsProfileCommission.textContent = commission;
        if (refs.gsProfileState) {
            refs.gsProfileState.textContent = promoter
                ? (promoter.activo === false ? "Inactivo" : "Activo")
                : "Sin registro de comisión";
        }
        if (refs.gsProfileSince) {
            refs.gsProfileSince.textContent = state.roleRow && state.roleRow.assigned_at
                ? dateLabel(state.roleRow.assigned_at)
                : "—";
        }
    }

    function renderActivity() {
        if (!refs.gsActivity) return;

        const summary = state.summary || {};
        const byState = summary.pedidos_por_estado && typeof summary.pedidos_por_estado === "object"
            ? summary.pedidos_por_estado
            : {};
        const items = ORDER_STATUS_ORDER.filter(function (status) {
            return Number(byState[status] || 0) > 0;
        }).map(function (status) {
            return '<span class="gs-activity-item"><strong>' + escapeHtml(count(byState[status])) + "</strong>" + escapeHtml(status) + "</span>";
        });

        refs.gsActivity.innerHTML = items.length
            ? items.join("")
            : '<p class="gs-muted">Todavía no hay pedidos atribuidos a tu cuenta.</p>';
    }

    function renderNotifications() {
        if (!refs.gsNotifications) return;

        const events = state.orders.map(commissionEvent)
            .filter(function (event) { return Boolean(event.date); })
            .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
            .slice(0, 6);
        const ready = state.orders.filter(function (order) {
            return (order.comision_estado || "pendiente") === "disponible";
        }).length;

        if (refs.gsNotificationsCount) {
            refs.gsNotificationsCount.textContent = ready
                ? count(ready) + " lista" + (ready === 1 ? "" : "s") + " para cobrar"
                : (events.length ? "Sin acciones pendientes" : "Sin novedades");
        }

        if (refs.gsBellBadge) {
            refs.gsBellBadge.hidden = !events.length;
            refs.gsBellBadge.textContent = events.length ? count(Math.min(events.length, 9)) + (events.length > 9 ? "+" : "") : "";
        }

        refs.gsNotifications.innerHTML = events.length
            ? events.map(function (event) {
                return '<article class="gs-notification ' + event.tone + '">' +
                    '<span class="gs-notification-icon" aria-hidden="true"><i class="fa-solid ' + event.icon + '"></i></span>' +
                    '<span class="gs-notification-copy"><strong>' + escapeHtml(event.title) + "</strong><small>" + escapeHtml(event.body) + "</small></span>" +
                    "<time datetime=\"" + escapeHtml(event.date) + "\">" + escapeHtml(dateLabel(event.date)) + "</time>" +
                "</article>";
            }).join("")
            : '<p class="gs-empty"><strong>Sin notificaciones por ahora.</strong>Las novedades de tus pedidos y comisiones aparecerán aquí.</p>';
    }

    function renderHistory() {
        if (!refs.gsCommissionHistory) return;

        if (!state.orders.length) {
            refs.gsCommissionHistory.innerHTML = '<p class="gs-empty"><strong>Todavía no hay historial de comisiones.</strong>Cuando administración te atribuya un pedido, su comisión aparecerá aquí.</p>';
            return;
        }

        const rows = state.orders.slice().sort(function (a, b) {
            return new Date(commissionDate(b)) - new Date(commissionDate(a));
        });

        refs.gsCommissionHistory.innerHTML = rows.map(function (order) {
            const status = order.comision_estado || "pendiente";
            const label = COMMISSION_LABELS[status] || "Pendiente";
            const badge = COMMISSION_CLASSES[status] || "gs-badge-pending";
            const percentage = Number(order.comision_porcentaje || 0).toLocaleString("es-ES", { maximumFractionDigits: 2 });

            return '<article class="gs-history-row">' +
                "<div><h3>" + escapeHtml(order.codigo || "Pedido") + " · " + escapeHtml(order.nombre_cliente || "Cliente") + "</h3>" +
                    "<p>" + escapeHtml(dateLabel(commissionDate(order))) + " · " + escapeHtml(percentage) + "% · " + escapeHtml(commissionReason(order)) + "</p></div>" +
                '<span class="gs-badge ' + badge + '">' + escapeHtml(label) + "</span>" +
                '<strong class="gs-history-amount">' + escapeHtml(money(order.comision_monto_usd)) + "</strong>" +
            "</article>";
        }).join("");
    }

    function orderMatches(order) {
        if (state.status && order.estado !== state.status) return false;

        const threshold = periodThreshold();
        if (threshold) {
            const created = new Date(order.created_at);
            if (Number.isNaN(created.getTime()) || created < threshold) return false;
        }

        if (!state.query) return true;
        const itemNames = (Array.isArray(order.items) ? order.items : []).map(function (item) {
            return item.producto_nombre || item.nombre || item.nombre_producto || "";
        });
        const haystack = normalize([
            order.codigo,
            order.nombre_cliente,
            order.telefono,
            order.email,
            order.direccion,
            order.municipio
        ].concat(itemNames).join(" "));
        return haystack.indexOf(state.query) !== -1;
    }

    function sortOrders(orders) {
        const copy = orders.slice();
        const byDate = function (order) {
            const date = new Date(order.created_at);
            return Number.isNaN(date.getTime()) ? 0 : date.getTime();
        };

        if (state.sort === "amount") {
            copy.sort(function (a, b) {
                return Number(b.total_usd || 0) - Number(a.total_usd || 0);
            });
            return copy;
        }

        if (state.sort === "status") {
            copy.sort(function (a, b) {
                const indexA = ORDER_STATUS_ORDER.indexOf(a.estado);
                const indexB = ORDER_STATUS_ORDER.indexOf(b.estado);
                const orderA = indexA === -1 ? ORDER_STATUS_ORDER.length : indexA;
                const orderB = indexB === -1 ? ORDER_STATUS_ORDER.length : indexB;
                return orderA - orderB || byDate(b) - byDate(a);
            });
            return copy;
        }

        copy.sort(function (a, b) { return byDate(b) - byDate(a); });
        return copy;
    }

    function showReportTooltip(event) {
        const column = event.currentTarget;
        const chart = refs.gsChart;
        const tooltip = refs.gsChartTooltip;
        if (!chart || !tooltip) return;

        tooltip.textContent = column.getAttribute("data-tooltip") || "";
        tooltip.hidden = false;

        const chartRect = chart.getBoundingClientRect();
        const columnRect = column.getBoundingClientRect();
        const left = columnRect.left - chartRect.left + columnRect.width / 2;
        const top = Math.max(42, columnRect.top - chartRect.top + 6);

        tooltip.style.left = Math.max(72, Math.min(chartRect.width - 72, left)) + "px";
        tooltip.style.top = top + "px";
    }

    function hideReportTooltip() {
        if (refs.gsChartTooltip) refs.gsChartTooltip.hidden = true;
    }

    function bindReportTooltips() {
        if (!refs.gsChartPlot) return;
        refs.gsChartPlot.querySelectorAll(".gs-chart-col").forEach(function (column) {
            column.addEventListener("mouseenter", showReportTooltip);
            column.addEventListener("mouseleave", hideReportTooltip);
        });
    }

    function renderReport() {
        if (!refs.gsReportTotal || !refs.gsChartPlot) return;

        const days = Number(state.reportPeriod) || 30;
        const threshold = thresholdForDays(days);
        const orders = state.orders.filter(function (order) {
            return orderCompleted(order) && withinThreshold(order, threshold);
        });
        const total = orders.reduce(function (sum, order) { return sum + orderGross(order); }, 0);
        const commission = orders.reduce(function (sum, order) { return sum + orderCommissionValue(order); }, 0);
        const average = orders.length ? total / orders.length : 0;
        const bucketCount = days === 7 ? 7 : 8;
        const buckets = [];
        const now = new Date();
        now.setHours(23, 59, 59, 999);

        const start = threshold || new Date(now.getTime() - (bucketCount - 1) * 86400000);
        const span = Math.max(1, now.getTime() - start.getTime());
        const bucketMs = span / bucketCount;

        for (let index = 0; index < bucketCount; index += 1) {
            const bucketStart = new Date(start.getTime() + index * bucketMs);
            buckets.push({
                label: dateRangeLabel(bucketStart, days),
                sales: 0,
                commission: 0,
                orders: 0
            });
        }

        orders.forEach(function (order) {
            const date = orderDate(order);
            if (!date) return;
            const index = Math.max(0, Math.min(bucketCount - 1, Math.floor((date.getTime() - start.getTime()) / bucketMs)));
            buckets[index].sales += orderGross(order);
            buckets[index].commission += orderCommissionValue(order);
            buckets[index].orders += 1;
        });

        refs.gsReportTotal.textContent = money(total);
        refs.gsReportAverage.textContent = money(average);
        refs.gsReportCommission.textContent = money(commission);

        const maxSales = niceMax(Math.max.apply(null, buckets.map(function (bucket) { return bucket.sales; })) || 1);
        const maxOrders = Math.max.apply(null, buckets.map(function (bucket) { return bucket.orders; })) || 1;

        if (refs.gsChartGrid) {
            refs.gsChartGrid.innerHTML = "<span></span><span></span><span></span><span></span><span></span>";
        }

        if (refs.gsChartAxisLeft) {
            refs.gsChartAxisLeft.innerHTML = [1, .75, .5, .25, 0].map(function (ratio) {
                return "<span>" + escapeHtml(compactMoney(maxSales * ratio)) + "</span>";
            }).join("");
        }

        if (refs.gsChartAxisRight) {
            refs.gsChartAxisRight.innerHTML = [1, .75, .5, .25, 0].map(function (ratio) {
                return "<span>" + escapeHtml(count(Math.round(maxOrders * ratio))) + "</span>";
            }).join("");
        }

        const hasData = orders.length > 0;
        if (refs.gsChartEmpty) refs.gsChartEmpty.hidden = hasData;
        if (refs.gsChartTooltip) refs.gsChartTooltip.hidden = true;

        if (refs.gsChart) {
            refs.gsChart.setAttribute("aria-label", hasData
                ? "Gráfico de ventas y comisiones de los últimos " + days + " días"
                : "Gráfico de ventas y comisiones sin actividad en los últimos " + days + " días");
        }

        refs.gsChartPlot.innerHTML = buckets.map(function (bucket) {
            const height = hasData && maxSales > 0 ? Math.max(3, (bucket.sales / maxSales) * 100) : 4;
            const sales = Math.max(0, bucket.sales - bucket.commission);
            const salesShare = bucket.sales > 0 ? (sales / bucket.sales) * 100 : 0;
            const commissionShare = bucket.sales > 0 ? (bucket.commission / bucket.sales) * 100 : 0;
            const tooltip = bucket.label + "\n" +
                "Ventas: " + money(bucket.sales) + "\n" +
                "Comisiones: " + money(bucket.commission) + "\n" +
                "Pedidos: " + count(bucket.orders);

            return '<div class="gs-chart-col" data-tooltip="' + escapeHtml(tooltip) + '">' +
                '<div class="gs-chart-bar" style="height:' + height.toFixed(2) + '%;opacity:' + (hasData ? "1" : ".42") + '">' +
                    '<span class="gs-chart-seg is-sales" style="height:' + salesShare.toFixed(2) + '%"></span>' +
                    '<span class="gs-chart-seg is-commission" style="height:' + commissionShare.toFixed(2) + '%"></span>' +
                "</div>" +
                '<span class="gs-chart-xlabel">' + escapeHtml(bucket.label) + "</span>" +
            "</div>";
        }).join("");

        bindReportTooltips();
    }

    function renderBubbles() {
        if (!refs.gsBubbleStage) return;

        const days = Number(state.categoryPeriod) || 30;
        const threshold = thresholdForDays(days);
        const products = new Map();

        state.orders.forEach(function (order) {
            if (!orderCompleted(order) || !withinThreshold(order, threshold)) return;
            const items = Array.isArray(order.items) ? order.items : [];
            items.forEach(function (item) {
                const name = String(item.producto_nombre || item.nombre || item.nombre_producto || "").trim();
                const units = Number(item.cantidad || item.qty || 0);
                if (!name || !Number.isFinite(units) || units <= 0) return;
                if (!products.has(name)) products.set(name, { name: name, units: 0 });
                products.get(name).units += units;
            });
        });

        const top = Array.from(products.values()).sort(function (a, b) {
            return b.units - a.units;
        }).slice(0, 3);

        if (refs.gsBubbleEmpty) refs.gsBubbleEmpty.classList.toggle("is-visible", !top.length);
        if (refs.gsBubbleNote) {
            refs.gsBubbleNote.textContent = top.length
                ? "Tamaño según unidades vendidas en los últimos " + days + " días."
                : "Sin productos atribuidos en este periodo.";
        }

        if (!top.length) {
            refs.gsBubbleStage.innerHTML = "";
            refs.gsBubbleStage.setAttribute("aria-label", "Sin productos destacados en este periodo");
            return;
        }

        refs.gsBubbleStage.setAttribute("aria-label", "Productos más vendidos: " + top.map(function (product) {
            return product.name + ", " + product.units + " unidades";
        }).join("; "));

        refs.gsBubbleStage.innerHTML = top.map(function (product, index) {
            return '<div class="gs-bubble is-' + ["one", "two", "three"][index] + '">' +
                '<span class="gs-bubble-value">' + escapeHtml(count(product.units)) + " uds.</span>" +
                '<span class="gs-bubble-label">' + escapeHtml(product.name) + "</span>" +
            "</div>";
        }).join("");
    }

    function renderGauge() {
        if (!refs.gsGauge) return;

        const byState = statusCounts();
        const delivered = Number(byState.Entregado || 0);
        const cancelled = Number(byState.Cancelado || 0);
        const total = ORDER_STATUS_ORDER.reduce(function (sum, status) {
            return sum + Number(byState[status] || 0);
        }, 0);
        const active = Math.max(0, total - cancelled);
        const rate = active > 0 ? (delivered / active) * 100 : null;

        if (refs.gsGaugeProgress) {
            refs.gsGaugeProgress.style.strokeDasharray = (rate || 0).toFixed(2) + " 100";
        }

        if (refs.gsGaugeValue) refs.gsGaugeValue.textContent = rate === null ? "—" : Math.round(rate) + "%";
        if (refs.gsGaugeLabel) refs.gsGaugeLabel.textContent = rate === null ? "Sin pedidos" : "Tasa de entrega";
        if (refs.gsGaugeBadge) refs.gsGaugeBadge.textContent = rate === null ? "Sin datos" : "Tasa de entrega";
        if (refs.gsGaugeNote) {
            refs.gsGaugeNote.textContent = active
                ? count(delivered) + " de " + count(active) + " pedidos activos entregados."
                : "Calculado con los pedidos entregados.";
        }

        refs.gsGauge.setAttribute("aria-label", rate === null
            ? "Tasa de entrega sin pedidos"
            : "Tasa de entrega del " + Math.round(rate) + " por ciento");
    }

    function renderStatus() {
        if (!refs.gsStatusTrack || !refs.gsStatusLegend) return;

        const byState = statusCounts();
        const groups = [
            { key: "complete", label: "Entregado", count: Number(byState.Entregado || 0) },
            {
                key: "progress",
                label: "En proceso",
                count: ["Confirmando pedido", "Preparando pedido", "En camino"].reduce(function (sum, status) {
                    return sum + Number(byState[status] || 0);
                }, 0)
            },
            { key: "pending", label: "Pendiente", count: Number(byState["Pedido recibido"] || 0) },
            { key: "cancelled", label: "Cancelado", count: Number(byState.Cancelado || 0) }
        ];
        const total = groups.reduce(function (sum, group) { return sum + group.count; }, 0);

        refs.gsStatusTrack.innerHTML = total
            ? groups.filter(function (group) { return group.count > 0; }).map(function (group) {
                return '<span class="is-' + group.key + '" style="width:' + (group.count / total * 100).toFixed(2) + '%"></span>';
            }).join("")
            : "";

        refs.gsStatusLegend.innerHTML = groups.map(function (group) {
            return "<li><span><i class=\"gs-dot is-" + group.key + "\" aria-hidden=\"true\"></i>" +
                escapeHtml(group.label) + "</span><strong>" +
                (total ? escapeHtml(count(group.count)) : "—") + "</strong></li>";
        }).join("");

        if (refs.gsStatusBadge) {
            refs.gsStatusBadge.textContent = total ? count(total) + (total === 1 ? " pedido" : " pedidos") : "Sin datos";
        }
    }

    function renderItems(items) {
        if (!Array.isArray(items) || !items.length) {
            return '<p class="gs-muted">Sin detalle de productos.</p>';
        }

        return '<ul class="gs-order-products">' + items.map(function (item) {
            const name = item.nombre || item.producto_nombre || item.nombre_producto || "Producto";
            const quantity = item.cantidad || item.qty || 1;
            const price = item.precio_usd || item.precio || item.precio_unitario || 0;
            return "<li><span>" + escapeHtml(name) + " × " + escapeHtml(quantity) + "</span><small>" + escapeHtml(money(price)) + "</small></li>";
        }).join("") + "</ul>";
    }

    function emptyOrderRow(html) {
        return '<tr class="gs-empty-row"><td colspan="7">' + html + "</td></tr>";
    }

    function renderOrders() {
        if (!refs.gsOrdersList) return;

        const visible = sortOrders(state.orders.filter(orderMatches));

        if (refs.gsMoreWrap) refs.gsMoreWrap.hidden = !state.hasMore;

        if (!state.orders.length) {
            refs.gsOrdersList.innerHTML = emptyOrderRow('<p class="gs-empty"><strong>Aún no tienes pedidos asignados.</strong>Cuando el administrador confirme una venta y te la atribuya, aparecerá aquí con su estado y comisión.</p>');
            return;
        }

        if (!visible.length) {
            refs.gsOrdersList.innerHTML = emptyOrderRow('<p class="gs-empty"><strong>No hay pedidos con esos filtros.</strong><button class="gs-button" type="button" data-clear-filters>Limpiar filtros</button></p>');
            return;
        }

        refs.gsOrdersList.innerHTML = visible.map(function (order, index) {
            const commissionState = order.comision_estado || "pendiente";
            const commissionLabel = COMMISSION_LABELS[commissionState] || "Pendiente";
            const commissionClass = COMMISSION_CLASSES[commissionState] || "gs-badge-pending";
            const statusInfo = orderStatusInfo(order.estado);
            const phoneHref = order.telefono ? "tel:" + escapeHtml(cleanPhone(order.telefono)) : "";
            const mailHref = order.email ? "mailto:" + encodeURIComponent(order.email) : "";
            const items = Array.isArray(order.items) ? order.items : [];
            const units = orderUnits(order);
            const quantity = units || items.length;
            const firstItem = items.length
                ? String(items[0].producto_nombre || items[0].nombre || items[0].nombre_producto || "Producto")
                : "";
            const extraItems = Math.max(0, items.length - 1);
            const commissionMeta = order.comision_pagada_at
                ? "Pagada el " + dateLabel(order.comision_pagada_at)
                : order.comision_disponible_at
                    ? "Disponible desde " + dateLabel(order.comision_disponible_at)
                    : "Se activa al confirmar la entrega";
            const contact = phoneHref
                ? '<p><a href="' + phoneHref + '">' + escapeHtml(order.telefono) + "</a>" +
                    (mailHref ? ' · <a href="' + mailHref + '">' + escapeHtml(order.email) + "</a>" : "") + "</p>"
                : (mailHref ? '<p><a href="' + mailHref + '">' + escapeHtml(order.email) + "</a></p>" : "");

            return '<tr class="gs-order-row">' +
                '<td class="gs-cell-order">' +
                    '<button class="gs-order-toggle" type="button" data-order-toggle="' + index + '" aria-expanded="false" aria-controls="gs-order-body-' + index + '">' +
                        '<span class="gs-order-code">' + escapeHtml(order.codigo || "Sin código") + "</span>" +
                        '<span class="gs-order-date">' + escapeHtml(dateLabel(order.created_at)) + "</span>" +
                    "</button>" +
                "</td>" +
                '<td class="gs-cell-product"><span class="gs-product-name">' + escapeHtml(firstItem || "Sin detalle") + "</span>" +
                    (extraItems ? "<small>+" + escapeHtml(count(extraItems)) + " producto" + (extraItems === 1 ? "" : "s") + "</small>" : (firstItem ? "<small>Producto principal</small>" : "")) + "</td>" +
                '<td class="gs-cell-client"><span class="gs-order-client">' + escapeHtml(order.nombre_cliente || "Cliente") + "</span>" +
                    "<small>" + escapeHtml(order.telefono || order.email || "Sin contacto") + "</small></td>" +
                '<td class="gs-cell-qty"><strong class="gs-order-total">' + escapeHtml(count(quantity)) + "</strong><small>uds.</small></td>" +
                '<td class="gs-cell-total"><strong class="gs-order-total">' + escapeHtml(money(order.total_usd)) + "</strong>" +
                    "<small>Comisión " + escapeHtml(money(order.comision_monto_usd)) + "</small></td>" +
                '<td class="gs-cell-state"><span class="gs-badge gs-badge-state ' + statusInfo.className + '">' + escapeHtml(statusInfo.label) + "</span></td>" +
                '<td class="gs-cell-chevron"><i class="fa-solid fa-chevron-down gs-order-chevron" aria-hidden="true"></i></td>' +
            "</tr>" +
            '<tr class="gs-order-detail" id="gs-order-body-' + index + '" hidden>' +
                '<td colspan="7">' +
                    '<div class="gs-order-grid">' +
                        "<div><h3>Cliente</h3><p>" + escapeHtml(order.nombre_cliente || "Cliente") + "</p>" + contact + "</div>" +
                        "<div><h3>Entrega</h3><address>" + escapeHtml(order.direccion || "Sin dirección") + "<br>" + escapeHtml(order.municipio || "Sin municipio") + "</address></div>" +
                        "<div><h3>Productos</h3>" + renderItems(order.items) + "</div>" +
                        '<div class="gs-cell-commission"><h3>Comisión</h3>' +
                            '<p class="gs-commission-line"><strong class="gs-commission-amount">' + escapeHtml(money(order.comision_monto_usd)) + "</strong>" +
                            '<span class="gs-badge ' + commissionClass + '">' + escapeHtml(commissionLabel) + "</span></p>" +
                            "<small>" + escapeHtml(Number(order.comision_porcentaje || 0)) + "% · " + escapeHtml(commissionMeta) + "</small>" +
                        "</div>" +
                    "</div>" +
                "</td>" +
            "</tr>";
        }).join("");
    }

    function catalogApi() {
        return window.VX && typeof window.VX.load === "function" ? window.VX : null;
    }

    function renderCatalogSkeleton() {
        if (!refs.gsCatalogGrid) return;
        refs.gsCatalogEmpty.hidden = true;
        refs.gsCatalogGrid.innerHTML = new Array(8).fill('<div class="gs-skeleton-card" aria-hidden="true"></div>').join("");
        if (refs.gsCatalogCount) refs.gsCatalogCount.textContent = "Cargando catálogo…";
    }

    function renderCatalogCategories() {
        if (!refs.gsCatalogCategories) return;

        const api = catalogApi();
        const categories = api && typeof api.getCs === "function" ? api.getCs() : [];
        if (state.catalogCategory && !categories.some(function (category) {
            return String(category.id) === state.catalogCategory;
        })) {
            state.catalogCategory = "";
        }

        const buttons = [{ id: "", nombre: "Todos" }].concat(categories).map(function (category) {
            const value = String(category.id || "");
            const active = value === state.catalogCategory;
            return '<button class="gs-cat-chip' + (active ? " is-active" : "") + '" type="button" ' +
                'data-catalog-category="' + escapeHtml(value) + '" aria-pressed="' + (active ? "true" : "false") + '">' +
                escapeHtml(category.nombre || "Categoría") + "</button>";
        });

        refs.gsCatalogCategories.innerHTML = buttons.join("");
    }

    function catalogProducts() {
        const api = catalogApi();
        if (!api || typeof api.getP !== "function") return [];

        const query = state.catalogQuery;
        return api.getP().filter(function (product) {
            if (state.catalogCategory && String(product.categoria_id || "") !== state.catalogCategory) return false;
            if (!query) return true;
            const category = typeof api.cn === "function" ? api.cn(product.categoria_id) : "";
            return normalize([product.nombre, product.descripcion, category].join(" ")).indexOf(query) !== -1;
        });
    }

    function renderCatalogProducts() {
        if (!refs.gsCatalogGrid) return;

        if (!state.catalogReady) {
            renderCatalogSkeleton();
            return;
        }

        const api = catalogApi();
        const products = catalogProducts();
        const query = state.catalogQueryInput.trim();
        const category = refs.gsCatalogCategories
            ? refs.gsCatalogCategories.querySelector(".gs-cat-chip.is-active")
            : null;
        const categoryLabel = category ? category.textContent : "Todos";

        products.sort(function (a, b) {
            if (state.catalogSort === "price-asc") {
                return Number(api && api.pr ? api.pr(a) : a.precio_usd) - Number(api && api.pr ? api.pr(b) : b.precio_usd);
            }
            if (state.catalogSort === "price-desc") {
                return Number(api && api.pr ? api.pr(b) : b.precio_usd) - Number(api && api.pr ? api.pr(a) : a.precio_usd);
            }
            if (state.catalogSort === "name") {
                return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
            }
            return 0;
        });

        if (refs.gsCatalogCount) {
            const parts = [products.length + (products.length === 1 ? " producto" : " productos")];
            if (query) parts.push('para "' + query + '"');
            if (state.catalogCategory) parts.push("en " + categoryLabel);
            refs.gsCatalogCount.textContent = parts.join(" ");
        }

        if (refs.gsCatalogEmpty) refs.gsCatalogEmpty.hidden = products.length > 0;
        refs.gsCatalogGrid.innerHTML = products.length
            ? products.map(function (product) { return api.pcard(product); }).join("")
            : "";
    }

    function ensureCatalog() {
        if (state.catalogReady) {
            renderCatalogProducts();
            return Promise.resolve();
        }
        if (state.catalogLoading) return state.catalogPromise || Promise.resolve();

        const api = catalogApi();
        if (!api) {
            if (refs.gsCatalogCount) refs.gsCatalogCount.textContent = "No se pudo cargar el catálogo.";
            if (refs.gsCatalogEmpty) refs.gsCatalogEmpty.hidden = true;
            return Promise.resolve();
        }

        state.catalogLoading = true;
        renderCatalogSkeleton();

        state.catalogPromise = api.load().then(function () {
            state.catalogReady = true;
            state.catalogLoading = false;
            renderCatalogCategories();
            renderCatalogProducts();
        }).catch(function () {
            state.catalogLoading = false;
            if (refs.gsCatalogCount) refs.gsCatalogCount.textContent = "No se pudo cargar el catálogo.";
            if (refs.gsCatalogEmpty) refs.gsCatalogEmpty.hidden = true;
        });

        return state.catalogPromise;
    }

    function findCatalogProduct(productId) {
        const api = catalogApi();
        if (!api || typeof api.getP !== "function") return null;
        return api.getP().find(function (product) { return String(product.id) === String(productId); }) || null;
    }

    function openProductDialog(productId) {
        const api = catalogApi();
        const product = findCatalogProduct(productId);
        if (!api || !product || !refs.gsProductDialog) return;

        state.catalogProductId = String(product.id);
        const images = typeof api.ft === "function" ? api.ft(product) : [];
        const image = images && images[0] && typeof api.imgUrl === "function"
            ? api.imgUrl(images[0], { w: 900, h: 700, format: "webp", quality: 88 })
            : "";
        const category = typeof api.cn === "function" ? api.cn(product.categoria_id) : "Producto";
        const soldOut = typeof api.ag === "function" ? api.ag(product) : false;
        const price = typeof api.pr === "function" ? api.pr(product) : product.precio_usd;

        refs.gsProductMedia.innerHTML = image
            ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.nombre || "Producto") + '">'
            : '<span class="gs-product-dialog-placeholder" aria-hidden="true"><i class="fa-solid fa-box"></i></span>';
        refs.gsProductCategory.textContent = category;
        refs.gsProductTitle.textContent = product.nombre || "Producto";
        refs.gsProductDescription.textContent = product.descripcion || "Producto del catálogo VOLXEN.";
        refs.gsProductPrice.textContent = soldOut ? "Consultar disponibilidad" : (api.fm ? api.fm(price) : money(price));
        refs.gsProductStock.textContent = soldOut ? "Agotado" : "Disponible";
        refs.gsProductStock.classList.toggle("is-out", soldOut);
        refs.gsProductAdd.disabled = soldOut;
        refs.gsProductAdd.setAttribute("data-product-id", String(product.id));

        if (typeof refs.gsProductDialog.showModal === "function") {
            refs.gsProductDialog.showModal();
        } else {
            refs.gsProductDialog.setAttribute("open", "");
        }
        if (refs.gsProductClose) refs.gsProductClose.focus({ preventScroll: true });
    }

    function closeProductDialog() {
        if (!refs.gsProductDialog) return;
        if (typeof refs.gsProductDialog.close === "function" && refs.gsProductDialog.open) {
            refs.gsProductDialog.close();
        } else {
            refs.gsProductDialog.removeAttribute("open");
        }
        state.catalogProductId = "";
    }

    function setPanelView(view) {
        state.panelView = view === "catalog" ? "catalog" : "dashboard";
        if (refs.gsDashboardView) refs.gsDashboardView.hidden = state.panelView !== "dashboard";
        if (refs.gsCatalogView) refs.gsCatalogView.hidden = state.panelView !== "catalog";

        if (state.panelView === "catalog") {
            if (refs.gsSearch) {
                refs.gsSearch.value = state.catalogQueryInput;
                refs.gsSearch.placeholder = "Buscar producto o categoría";
            }
            if (refs.gsSearchLabel) refs.gsSearchLabel.textContent = "Buscar productos";
            ensureCatalog();
        } else {
            if (refs.gsSearch) {
                refs.gsSearch.value = state.queryInput;
                refs.gsSearch.placeholder = "Buscar pedido, cliente o teléfono";
            }
            if (refs.gsSearchLabel) refs.gsSearchLabel.textContent = "Buscar pedidos";
        }
    }

    function panelTop() {
        if (!refs.gsHome) return;
        refs.gsHome.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function renderClients() {
        if (!refs.gsClientsList) return;

        if (!state.clients.length) {
            refs.gsClientsList.innerHTML = '<p class="gs-empty"><strong>Todavía no hay clientes.</strong>Los clientes aparecen cuando tienes pedidos atribuidos.</p>';
            return;
        }

        refs.gsClientsList.innerHTML = state.clients.map(function (client) {
            const phone = client.telefono || "";
            const email = client.email || "";
            const wa = whatsappHref(phone);
            const contact = [];
            if (phone) contact.push('<a href="tel:' + escapeHtml(cleanPhone(phone)) + '">' + escapeHtml(phone) + "</a>");
            if (email) contact.push('<a href="mailto:' + encodeURIComponent(email) + '">' + escapeHtml(email) + "</a>");

            return '<article class="gs-client">' +
                '<div class="gs-client-head"><strong>' + escapeHtml(client.nombre || "Cliente") + "</strong><span>" + escapeHtml(count(client.pedidos)) + " pedido" + (Number(client.pedidos) === 1 ? "" : "s") + "</span></div>" +
                (contact.length ? '<p class="gs-client-contact">' + contact.join(" · ") + "</p>" : "") +
                '<p class="gs-client-address">' + escapeHtml(client.direccion || "Sin dirección") + (client.municipio ? " · " + escapeHtml(client.municipio) : "") + "</p>" +
                '<p class="gs-client-meta">' + escapeHtml(money(client.total_usd)) + " · último pedido " + escapeHtml(dateLabel(client.ultimo_pedido)) + "</p>" +
                '<div class="gs-client-actions">' +
                    (wa ? '<a href="' + wa + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp</a>' : "") +
                    (phone ? '<a href="tel:' + escapeHtml(cleanPhone(phone)) + '">Llamar</a>' : "") +
                "</div>" +
            "</article>";
        }).join("");
    }

    function renderAll() {
        renderHeader();
        renderProfile();
        renderActivity();
        renderSummary();
        renderNotifications();
        renderHistory();
        renderOrders();
        renderClients();
        renderReport();
        renderBubbles();
        renderGauge();
        renderStatus();
    }

    async function load(options) {
        const opts = options || {};
        if (state.loading) return;

        setBusy(true);
        setNotice("");
        if (!opts.silent) setView("gsLoading");

        try {
            const uid = state.session && state.session.user ? state.session.user.id : "";
            const optional = uid
                ? Promise.all([
                    VXAUTH.rest("/user_roles?select=role,assigned_at&user_id=eq." + encodeURIComponent(uid)).catch(function () { return null; }),
                    VXAUTH.rest("/promotores?select=comision_porcentaje,activo,created_at&user_id=eq." + encodeURIComponent(uid)).catch(function () { return null; })
                ])
                : Promise.resolve([null, null]);

            const results = await Promise.all([
                VXAUTH.rest("/rpc/promotor_resumen", { method: "POST", body: {} }),
                VXAUTH.rest("/rpc/promotor_pedidos", { method: "POST", body: { p_limit: 100, p_offset: 0 } }),
                VXAUTH.rest("/rpc/promotor_clientes", { method: "POST", body: {} }),
                optional
            ]);

            state.summary = results[0] && typeof results[0] === "object" ? results[0] : {};
            state.orders = Array.isArray(results[1]) ? results[1] : [];
            state.clients = Array.isArray(results[2]) ? results[2] : [];
            state.roleRow = Array.isArray(results[3] && results[3][0]) ? results[3][0][0] : null;
            state.promoter = Array.isArray(results[3] && results[3][1]) ? results[3][1][0] : null;
            state.hasMore = state.orders.length >= 100;

            setView("gsDashboard");
            renderAll();
            if (opts.notice) setNotice(opts.notice);
        } catch (error) {
            if (state.summary || state.orders.length || state.clients.length) {
                setView("gsDashboard");
                setNotice("No se pudo actualizar el panel. " + (error && error.message ? error.message : "Inténtalo de nuevo."), true);
            } else {
                refs.gsErrorText.textContent = error && error.message
                    ? error.message
                    : "Revisa tu conexión e inténtalo de nuevo.";
                setView("gsError");
            }
        } finally {
            setBusy(false);
        }
    }

    async function loadMore() {
        if (state.loading || !state.hasMore) return;

        setBusy(true);
        setNotice("");

        try {
            const more = await VXAUTH.rest("/rpc/promotor_pedidos", {
                method: "POST",
                body: { p_limit: 100, p_offset: state.orders.length }
            });
            const rows = Array.isArray(more) ? more : [];
            const known = new Set(state.orders.map(function (order) { return order.id; }));

            rows.forEach(function (order) {
                if (!known.has(order.id)) state.orders.push(order);
            });

            state.hasMore = rows.length >= 100;
            renderNotifications();
            renderHistory();
            renderOrders();
        } catch (error) {
            setNotice("No se pudieron cargar más pedidos. " + (error && error.message ? error.message : "Inténtalo de nuevo."), true);
        } finally {
            setBusy(false);
        }
    }

    function bindEvents() {
        if (refs.gsLogout) {
            refs.gsLogout.addEventListener("click", async function () {
                refs.gsLogout.disabled = true;
                const label = refs.gsLogout.querySelector(".gs-side-label");
                if (label) {
                    label.textContent = "Saliendo…";
                } else {
                    refs.gsLogout.textContent = "Saliendo…";
                }
                try {
                    await VXAUTH.signOut();
                } catch (error) {}
                window.location.href = "login.html?next=gestor.html";
            });
        }

        if (refs.gsMenuToggle) {
            refs.gsMenuToggle.addEventListener("click", function () {
                if (refs.gsApp && refs.gsApp.classList.contains("is-nav-open")) {
                    closeNav();
                } else {
                    openNav();
                }
            });
        }

        if (refs.gsSidebarToggle) {
            refs.gsSidebarToggle.addEventListener("click", function () {
                if (!refs.gsApp) return;
                setSidebarCollapsed(!refs.gsApp.classList.contains("is-sidebar-collapsed"));
            });
        }

        if (refs.gsScrim) {
            refs.gsScrim.addEventListener("click", closeNav);
        }

        document.querySelectorAll(".gs-topbar-actions a[href^='#gs']").forEach(function (link) {
            link.addEventListener("click", function (event) {
                const target = document.querySelector(link.getAttribute("href"));
                if (!target) return;
                event.preventDefault();
                setPanelView("dashboard");
                window.requestAnimationFrame(function () {
                    target.scrollIntoView({ behavior: "smooth", block: "start" });
                });
            });
        });

        if (refs.gsSidebar) {
            refs.gsSidebar.addEventListener("click", function (event) {
                const navLink = event.target.closest("[data-gs-nav]");
                const anchor = event.target.closest("a");

                if (navLink) {
                    event.preventDefault();
                    setActiveNav(navLink);

                    const section = navLink.getAttribute("data-gs-nav");
                    if (section === "catalogo") {
                        setPanelView("catalog");
                        panelTop();
                    } else if (section === "inicio") {
                        setPanelView("dashboard");
                        panelTop();
                    } else {
                        setPanelView("dashboard");
                        const target = document.querySelector(navLink.getAttribute("href"));
                        if (target) {
                            window.requestAnimationFrame(function () {
                                target.scrollIntoView({ behavior: "smooth", block: "start" });
                            });
                        }
                    }
                }

                if (anchor && isMobileNav()) closeNav();
            });
        }

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") closeNav();
        });

        if (window.matchMedia) {
            const mobile = window.matchMedia("(max-width: 1024px)");
            const handleViewportChange = function (event) {
                if (event.matches) {
                    setSidebarCollapsed(false);
                } else {
                    closeNav();
                }
            };
            if (mobile.addEventListener) {
                mobile.addEventListener("change", handleViewportChange);
            } else if (mobile.addListener) {
                mobile.addListener(handleViewportChange);
            }
        }

        if (refs.gsRetry) {
            refs.gsRetry.addEventListener("click", function () {
                load();
            });
        }

        if (refs.gsMore) {
            refs.gsMore.addEventListener("click", function () {
                loadMore();
            });
        }

        if (refs.gsSearch) {
            refs.gsSearch.addEventListener("input", function (event) {
                if (state.panelView === "catalog") {
                    state.catalogQueryInput = event.target.value;
                    state.catalogQuery = normalize(event.target.value.trim());
                    renderCatalogProducts();
                    return;
                }

                state.queryInput = event.target.value;
                state.query = normalize(event.target.value.trim());
                renderOrders();
            });
        }

        if (refs.gsStatusFilter) {
            refs.gsStatusFilter.addEventListener("change", function (event) {
                state.status = event.target.value;
                renderOrders();
            });
        }

        if (refs.gsSort) {
            refs.gsSort.addEventListener("change", function (event) {
                state.sort = event.target.value;
                renderOrders();
            });
        }

        if (refs.gsPeriod) {
            refs.gsPeriod.addEventListener("change", function (event) {
                state.period = event.target.value;
                renderOrders();
            });
        }

        if (refs.gsReportPeriod) {
            refs.gsReportPeriod.addEventListener("change", function (event) {
                state.reportPeriod = event.target.value;
                renderReport();
            });
        }

        if (refs.gsCategoryPeriod) {
            refs.gsCategoryPeriod.addEventListener("change", function (event) {
                state.categoryPeriod = event.target.value;
                renderBubbles();
            });
        }

        if (refs.gsOrdersList) {
            refs.gsOrdersList.addEventListener("click", function (event) {
                const clear = event.target.closest("[data-clear-filters]");
                if (clear) {
                    state.query = "";
                    state.queryInput = "";
                    state.status = "";
                    state.period = "30";
                    state.sort = "recent";
                    if (refs.gsSearch) refs.gsSearch.value = "";
                    if (refs.gsStatusFilter) refs.gsStatusFilter.value = "";
                    if (refs.gsPeriod) refs.gsPeriod.value = "30";
                    if (refs.gsSort) refs.gsSort.value = "recent";
                    renderOrders();
                    if (refs.gsSearch) refs.gsSearch.focus();
                    return;
                }

                const toggle = event.target.closest("[data-order-toggle]");
                if (!toggle) return;
                const body = document.getElementById(toggle.getAttribute("aria-controls"));
                if (!body) return;
                const expanded = toggle.getAttribute("aria-expanded") === "true";
                const nextExpanded = !expanded;
                const row = toggle.closest("tr");
                toggle.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
                body.hidden = !nextExpanded;
                if (row) row.classList.toggle("is-expanded", nextExpanded);
            });
        }

        if (refs.gsCatalogCategories) {
            refs.gsCatalogCategories.addEventListener("click", function (event) {
                const button = event.target.closest("[data-catalog-category]");
                if (!button) return;
                state.catalogCategory = button.getAttribute("data-catalog-category") || "";
                renderCatalogCategories();
                renderCatalogProducts();
            });
        }

        if (refs.gsCatalogSort) {
            refs.gsCatalogSort.addEventListener("change", function (event) {
                state.catalogSort = event.target.value;
                renderCatalogProducts();
            });
        }

        if (refs.gsCatalogReset) {
            refs.gsCatalogReset.addEventListener("click", function () {
                state.catalogCategory = "";
                state.catalogQuery = "";
                state.catalogQueryInput = "";
                state.catalogSort = "featured";
                if (refs.gsSearch) refs.gsSearch.value = "";
                if (refs.gsCatalogSort) refs.gsCatalogSort.value = "featured";
                renderCatalogCategories();
                renderCatalogProducts();
            });
        }

        if (refs.gsCatalogGrid) {
            refs.gsCatalogGrid.addEventListener("click", function (event) {
                const add = event.target.closest("[data-a='add1']");
                if (add) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (window.VX && typeof window.VX.add === "function") {
                        window.VX.add(add.getAttribute("data-id"), 1);
                    }
                    return;
                }

                const link = event.target.closest('a[href*="producto.html?id="]');
                if (!link) return;
                event.preventDefault();
                try {
                    const url = new URL(link.href, window.location.href);
                    openProductDialog(url.searchParams.get("id"));
                } catch (error) {}
            });
        }

        if (refs.gsProductClose) {
            refs.gsProductClose.addEventListener("click", closeProductDialog);
        }

        if (refs.gsProductAdd) {
            refs.gsProductAdd.addEventListener("click", function () {
                const productId = refs.gsProductAdd.getAttribute("data-product-id");
                if (!productId || !window.VX || typeof window.VX.add !== "function") return;
                window.VX.add(productId, 1);
                closeProductDialog();
            });
        }

        if (refs.gsProductDialog) {
            refs.gsProductDialog.addEventListener("click", function (event) {
                if (event.target === refs.gsProductDialog) closeProductDialog();
            });
            refs.gsProductDialog.addEventListener("close", function () {
                state.catalogProductId = "";
            });
        }
    }

    function cacheElements() {
        [
            "gsGuest", "gsDenied", "gsLoading", "gsError", "gsDashboard", "gsDashboardView",
            "gsTitle", "gsNotice", "gsGreeting", "gsTopAvatar",
            "gsSales", "gsOrdersCount", "gsClientsCount", "gsCommissionAvailable",
            "gsCommissionPaid", "gsCommissionPending", "gsCommissionReady", "gsCommissionDone",
            "gsProfileInitial", "gsProfileName", "gsProfileEmail", "gsProfileRole",
            "gsProfileCommission", "gsProfileState", "gsProfileSince", "gsActivity",
            "gsNotifications", "gsNotificationsCount", "gsCommissionHistory",
            "gsOrdersList", "gsClientsList", "gsSearch", "gsSearchLabel", "gsStatusFilter", "gsMoreWrap", "gsMore",
            "gsLogout", "gsRetry", "gsErrorText", "gsApp", "gsSidebar", "gsSidebarToggle",
            "gsMenuToggle", "gsScrim", "gsDashboardScroll", "gsBellBadge", "gsSort", "gsPeriod",
            "gsReportPeriod", "gsReportTotal", "gsReportAverage", "gsReportCommission",
            "gsChart", "gsChartGrid", "gsChartAxisLeft", "gsChartAxisRight", "gsChartPlot",
            "gsChartEmpty", "gsChartTooltip", "gsCategoryPeriod", "gsBubbleStage", "gsBubbleEmpty",
            "gsBubbleNote", "gsGauge", "gsGaugeProgress", "gsGaugeValue", "gsGaugeLabel",
            "gsGaugeBadge", "gsGaugeNote", "gsStatusTrack", "gsStatusLegend", "gsStatusBadge",
            "gsCatalogView", "gsCatalogCategories", "gsCatalogGrid", "gsCatalogEmpty",
            "gsCatalogCount", "gsCatalogSort", "gsCatalogReset", "gsProductDialog",
            "gsProductClose", "gsProductMedia", "gsProductCategory", "gsProductTitle",
            "gsProductDescription", "gsProductPrice", "gsProductStock", "gsProductAdd"
        ].forEach(function (key) {
            refs[key] = id(key);
        });

        refs.gsApp = refs.gsApp || refs.gsDashboard;
    }

    async function init() {
        cacheElements();

        if (!window.VXAUTH) {
            refs.gsErrorText.textContent = "No se pudo cargar el sistema de cuentas.";
            setView("gsError");
            return;
        }

        bindEvents();

        let session = null;
        try {
            session = await VXAUTH.getSession();
        } catch (error) {
            refs.gsErrorText.textContent = "No se pudo comprobar tu sesión. Inténtalo de nuevo.";
            setView("gsError");
            return;
        }

        if (!session) {
            setView("gsGuest");
            return;
        }

        state.session = session;
        const role = session.user && session.user.role;

        if (role === "admin") {
            window.location.replace("admin.html");
            return;
        }

        if (role !== "gestor" && role !== "promotor") {
            setView("gsDenied");
            return;
        }

        document.body.dataset.role = role;
        setPanelView("dashboard");
        setView("gsLoading");
        await load();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
