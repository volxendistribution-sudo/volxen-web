/**
 * Producto page logic
 * Handles product rendering, gallery, quantity selector, and add to cart
 */

export async function initProducto() {
    var host = VX.$("prod");
    var id = new URLSearchParams(location.search).get("id") || "";

    if (!id) {
        host.innerHTML = '<div class="bg-s2 border border-bd rounded-2xl shadow-sm p-8 max-w-md mx-auto text-center"><h3 class="font-bold text-fg mb-2">Producto no especificado</h3><p class="text-mu mb-4">Falta el identificador del producto.</p><a class="btn-primary inline-flex px-5 py-3" href="catalogo.html">Ver el catálogo</a></div>';
        return;
    }

    // Try to get product from local cache first
    var P = VX.getP();
    var p = P.find(function (x) { return String(x.id) === String(id); });

    // Fallback: fetch product directly from Supabase if not in local cache
    // This handles direct URL access and page refresh
    if (!p) {
        try {
            var res = await VX.q("productos?id=eq." + encodeURIComponent(id));
            if (Array.isArray(res) && res.length > 0) {
                p = res[0];
                // Add to local cache for subsequent operations
                var allP = VX.getP();
                if (!allP.find(function(x) { return String(x.id) === String(id); })) {
                    allP.push(p);
                }
            }
        } catch (e) {
            console.error("[VOLXEN] Failed to fetch product:", e);
            // Don't show error yet, let the final check handle it
        }
    }

    if (!p) {
        host.innerHTML = '<div class="bg-s2 border border-bd rounded-2xl shadow-sm p-8 max-w-md mx-auto text-center"><h3 class="font-bold text-fg mb-2">Producto no disponible</h3><p class="text-mu mb-4">No encontramos esta pieza (ID: ' + VX.esc(id) + '). Puede que ya no esté publicada o el ID sea incorrecto.</p><a class="btn-primary inline-flex px-5 py-3" href="catalogo.html">Ver el catálogo</a></div>';
        return;
    }

    var ims = VX.ft(p), mq = 1;
    var f = (p.caracteristicas || []).map(function (x) { return "<li>" + VX.esc(x) + "</li>"; }).join("");
    var agotado = VX.ag(p);
    var waHref = VX.wa('Buenas, deseo consultar la disponibilidad y la entrega de la pieza "' + p.nombre + '".');

    function shippingLabel() {
        if (p.shipping_type === "paid") {
            var cost = Number(p.shipping_cost);
            if (isFinite(cost) && cost > 0) {
                return "Envío: +US$" + (Math.round(cost * 100) / 100);
            }
            return "Envío por costo adicional";
        }
        return "Envío gratis";
    }

    function ratingHtml() {
        var value = Number(p.calificacion);
        if (!isFinite(value) || value <= 0) return "";
        var count = Number(p.calificacion_count);
        var countHtml = isFinite(count) && count > 0 ? " (" + count + ")" : "";
        return '<div class="pdp-rating"><i class="fa-solid fa-star" aria-hidden="true"></i><span>' +
            value.toFixed(1).replace(".", ",") + countHtml + '</span></div>';
    }

    function metaHtml() {
        var category = VX.esc(VX.cn(p.categoria_id)) + " · La Habana";
        var specs = (p.caracteristicas || []).slice(0, 3).map(function (x) {
            return VX.esc(x);
        }).filter(Boolean).join(" · ");
        return '<p class="pdp-meta">' + category + '</p>' +
            (specs ? '<p class="pdp-meta">' + specs + '</p>' : '');
    }

    function galleryHtml() {
        if (!ims[0]) {
            return '<div class="pdp-media pdp-media-empty" aria-hidden="true"><i class="fa-regular fa-image"></i></div>';
        }
        var mainSrc = VX.imgUrl(ims[0], { w: 1200, format: "webp", quality: 85 });
        var html = '<div class="pdp-media">' +
            '<img id="pimg" class="zoomable pdp-img" src="' + VX.esc(mainSrc) + '" alt="' + VX.esc(p.nombre) + '" fetchpriority="high">';
        if (ims.length > 1) {
            html += '<div class="pdp-dots" role="group" aria-label="Imágenes del producto">';
            ims.forEach(function (u, idx) {
                html += '<button type="button" class="pdp-dot' + (idx === 0 ? " is-active" : "") + '" data-dot="' + idx + '" aria-label="Ver imagen ' + (idx + 1) + '"' + (idx === 0 ? ' aria-current="true"' : "") + '></button>';
            });
            html += '</div>';
        }
        return html + '</div>';
    }

    function priceHtml() {
        if (agotado) {
            return '<span class="pdp-price pdp-price-consult">Consultar disponibilidad</span>';
        }
        var base = Number(p.precio_usd) || 0;
        var current = VX.pr(p);
        var hasOffer = current > 0 && current < base;
        return '<span class="pdp-price">' + VX.fm(current) + '</span>' +
            (hasOffer ? '<s class="pdp-price-old">' + VX.fm(base) + '</s>' : '');
    }

    function commissionHtml() {
        return '<div class="pdp-commission" data-gestor-commission>' +
            '<span class="pdp-commission-icon" aria-hidden="true"><i class="fa-solid fa-coins"></i></span>' +
            '<span class="pdp-commission-copy">' +
            '<span class="pdp-commission-label">Tu comisión</span>' +
            '<b class="pdp-commission-value" data-gestor-commission-value>Pendiente de asignación</b>' +
            '</span></div>';
    }

    function actionsHtml() {
        if (agotado) {
            return '<a class="btn-secondary pdp-consult" href="' + waHref + '" target="_blank" rel="noopener">Consultar disponibilidad</a>';
        }
        return '<div class="pdp-cart-row">' +
            '<div class="q">' +
            '<button type="button" data-pq="-1" aria-label="Menos cantidad" class="qty-btn">−</button>' +
            '<i id="pmq">' + mq + '</i>' +
            '<button type="button" data-pq="1" aria-label="Más cantidad" class="qty-btn">+</button>' +
            '</div>' +
            '<button type="button" class="btn-secondary pdp-add" data-padd>Añadir al carrito</button>' +
            '</div>';
    }

    function detailsHtml() {
        var html = "";
        if (p.descripcion) {
            html += '<h2>Descripción</h2><p>' + VX.esc(p.descripcion) + '</p>';
        }
        if (f) {
            html += '<h2>Características</h2><ul>' + f + '</ul>';
        }
        if (p.garantia) {
            html += '<p class="pdp-note"><strong>Garantía:</strong> ' + VX.esc(p.garantia) + '</p>';
        }
        return html ? '<div class="pdp-details">' + html + '</div>' : "";
    }

    function render() {
        var buyHtml = agotado
            ? '<span class="badge-out-of-stock pdp-stock">Agotado</span>'
            : '<button type="button" class="btn-primary pdp-buy" data-pbuy>Comprar</button>';
        var helpHtml = agotado ? "" :
            '<a class="pdp-help" href="' + waHref + '" target="_blank" rel="noopener">¿Dudas? Consulte la entrega con su asesor</a>';

        host.innerHTML =
            '<article class="pdp-card">' +
            galleryHtml() +
            '<div class="pdp-body">' +
            '<div class="pdp-head"><h1 class="pdp-title">' + VX.esc(p.nombre) + '</h1>' + ratingHtml() + '</div>' +
            metaHtml() +
            '<div class="pdp-buy-row"><div class="pdp-price-block">' + priceHtml() + '</div>' + buyHtml + '</div>' +
            commissionHtml() +
            '<p class="pdp-shipping"><span class="pdp-check" aria-hidden="true">✓</span><span>' + VX.esc(shippingLabel()) + '</span></p>' +
            actionsHtml() +
            detailsHtml() +
            helpHtml +
            '</div></article>';

        injectProductJsonLd(p, ims[0]);
        VX.obs();
    }

    render();

    host.addEventListener("click", function (e) {
        var dot = e.target.closest("[data-dot]");
        if (dot) {
            var idx = Number(dot.getAttribute("data-dot"));
            var main = VX.$("pimg");
            if (main && ims[idx]) {
                main.src = VX.imgUrl(ims[idx], { w: 1200, format: "webp", quality: 85 });
            }
            host.querySelectorAll("[data-dot]").forEach(function (item) {
                item.classList.toggle("is-active", item === dot);
                if (item === dot) item.setAttribute("aria-current", "true");
                else item.removeAttribute("aria-current");
            });
            return;
        }
        var pq = e.target.closest("[data-pq]");
        if (pq) { mq = Math.max(1, mq + Number(pq.getAttribute("data-pq"))); var mi = VX.$("pmq"); if (mi) mi.textContent = mq; return; }
        if (e.target.closest("[data-padd]")) { VX.add(p.id, mq); return; }
        if (e.target.closest("[data-pbuy]")) { VX.add(p.id, mq); location.href = "checkout.html"; return; }
    });

    function injectProductJsonLd(product, image) {
        var script = document.createElement('script');
        script.type = 'application/ld+json';
        var price = Number(VX.pr(product)) || Number(product.precio_usd) || 0;
        var inStock = product.disponibilidad !== "agotado";
        var mainImg = image ? VX.imgUrl(image, { w: 1200, format: "webp", quality: 85 }) : "https://volxen.com/logo-light.svg";
        var jsonLd = {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": product.nombre,
            "description": product.descripcion || "Producto de tecnología y energía en VOLXEN Cuba",
            "image": mainImg,
            "brand": { "@type": "Brand", "name": "VOLXEN" },
            "sku": product.id,
            "offers": {
                "@type": "Offer",
                "url": window.location.href,
                "priceCurrency": "USD",
                "price": price.toFixed(2),
                "availability": inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                "seller": { "@type": "Organization", "name": "VOLXEN Comercializadora Cuba" }
            }
        };
        if (product.garantia) jsonLd.warranty = product.garantia;
        if (Number(product.calificacion) > 0 && Number(product.calificacion_count) > 0) {
            jsonLd.aggregateRating = {
                "@type": "AggregateRating",
                "ratingValue": Number(product.calificacion),
                "reviewCount": Number(product.calificacion_count)
            };
        }
        script.textContent = JSON.stringify(jsonLd);
        document.head.appendChild(script);
    }
}

window.initProducto = initProducto;
