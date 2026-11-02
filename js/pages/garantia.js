(function () {
    "use strict";

    var config = window.VOLXEN_CONFIG || {};
    var loading = document.getElementById("gLoading");
    var errorBox = document.getElementById("gError");
    var panel = document.getElementById("gPanel");

    function showError() {
        if (loading) loading.hidden = true;
        if (panel) panel.hidden = true;
        if (errorBox) errorBox.hidden = false;
    }

    function tokenFromLocation() {
        var hash = String(window.location.hash || "").replace(/^#/, "");
        var hashParams = new URLSearchParams(hash);
        var searchParams = new URLSearchParams(window.location.search);
        return String(
            hashParams.get("g") ||
            hashParams.get("token") ||
            searchParams.get("g") ||
            searchParams.get("token") ||
            ""
        ).trim();
    }

    function formatMoney(value) {
        var number = Number(value);
        if (!isFinite(number)) return "—";
        return "$" + (Math.round(number * 100) / 100).toFixed(2) + " USD";
    }

    function formatDate(value) {
        var date = value ? new Date(value) : null;
        if (!date || isNaN(date.getTime())) return "—";
        return date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
    }

    function renderGuarantee(data) {
        var code = document.getElementById("gTitle");
        var status = document.getElementById("gStatus");
        var date = document.getElementById("gDate");
        var delivered = document.getElementById("gDelivered");
        var total = document.getElementById("gTotal");
        var warranty = document.getElementById("gWarranty");
        var items = document.getElementById("gItems");
        var products = Array.isArray(data.productos) ? data.productos : [];
        var documented = String(data.garantia || "").trim();
        if (!documented) {
            documented = products.map(function (product) {
                return String(product.garantia || "").trim();
            }).filter(function (value, index, all) {
                return value && all.indexOf(value) === index;
            }).join(", ");
        }

        if (code) code.textContent = data.codigo || "Pedido VOLXEN";
        if (status) status.textContent = data.estado || "Entregado";
        if (date) date.textContent = formatDate(data.fecha_pedido);
        if (delivered) delivered.textContent = formatDate(data.fecha_entrega);
        if (total) total.textContent = formatMoney(data.total_usd);

        if (items) {
            items.replaceChildren();
            products.forEach(function (product) {
                var item = document.createElement("li");
                var left = document.createElement("span");
                var right = document.createElement("span");
                var name = document.createElement("span");
                var quantity = document.createElement("span");
                var itemWarranty = String(product.garantia || "").trim();

                left.className = "g-product-name";
                name.textContent = product.producto_nombre || "Producto";
                left.appendChild(name);

                right.className = "g-product-meta";
                quantity.textContent = "Cantidad: " + (Number(product.cantidad) || 0);
                right.appendChild(quantity);
                if (itemWarranty) {
                    var guaranteeLine = document.createElement("span");
                    guaranteeLine.textContent = "Garantía: " + itemWarranty;
                    right.appendChild(guaranteeLine);
                }

                item.appendChild(left);
                item.appendChild(right);
                items.appendChild(item);
            });
            if (!products.length) {
                var empty = document.createElement("li");
                empty.className = "g-product-name";
                empty.textContent = "Sin productos registrados.";
                items.appendChild(empty);
            }
        }

        if (warranty) {
            warranty.textContent = documented || "No incluye garantía documentada";
        }

        if (loading) loading.hidden = true;
        if (errorBox) errorBox.hidden = true;
        if (panel) panel.hidden = false;
    }

    async function consultar(token) {
        if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
            showError();
            return;
        }

        var response = await fetch(config.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/consultar_garantia", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "apikey": config.SUPABASE_KEY,
                "Authorization": "Bearer " + config.SUPABASE_KEY
            },
            body: JSON.stringify({ p_token: token })
        });

        if (!response.ok) {
            showError();
            return;
        }

        var data = await response.json();
        if (!data || typeof data !== "object" || !data.codigo) {
            showError();
            return;
        }

        renderGuarantee(data);
    }

    var token = tokenFromLocation();
    if (token.length < 64) {
        showError();
        return;
    }

    consultar(token).catch(showError);
}());
