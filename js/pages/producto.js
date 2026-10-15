/**
 * Producto page logic
 * Handles product rendering, gallery, quantity selector, and add to cart
 */

export function initProducto() {
    var host = VX.$("prod");
    var id = new URLSearchParams(location.search).get("id") || "";
    var P = VX.getP();
    var p = P.find(function (x) { return String(x.id) === String(id); });

    if (!p) {
        host.innerHTML = '<div class="bg-s2 border border-bd rounded-2xl shadow-sm p-8 max-w-md mx-auto text-center"><h3 class="text-xl font-bold text-fg mb-2">Producto no disponible</h3><p class="text-mu mb-4">No encontramos esta pieza. Puede que ya no esté publicada.</p><a class="btn-primary inline-block" href="catalogo.html">Ver el catálogo</a></div>';
        return;
    }

    var ims = VX.ft(p), mq = 1;
    var f = (p.caracteristicas || []).map(function (x) { return "<li>" + VX.esc(x) + "</li>"; }).join("");
    var agotado = VX.ag(p);

    function render() {
        var priceHtml = VX.price(p);
        var descHtml = p.descripcion ? '<p class="text-mu leading-relaxed mt-4">' + VX.esc(p.descripcion) + '</p>' : '';
        var specsHtml = f ? '<ul class="list-disc pl-5 space-y-2 text-mu mt-4">' + f + '</ul>' : '';
        var garantiaHtml = p.garantia ? '<p class="mt-3"><span class="text-fg font-medium">Garantía:</span> ' + VX.esc(p.garantia) + '</p>' : '';
        var transporteHtml = p.transporte ? '<p class="mt-1"><span class="text-fg font-medium">Transporte:</span> ' + VX.esc(p.transporte) + '</p>' : '';

        var mainImgSrc = ims[0] ? VX.imgUrl(ims[0], { w: 800, h: 800, format: "webp", quality: 85 }) : "";
        var thumbImgs = ims.map(function(u) {
            return VX.imgUrl(u, { w: 120, h: 120, format: "webp", quality: 80 });
        });

        var galleryHtml = '';
        if (ims[0]) {
            galleryHtml +=
                '<div class="product-gallery">' +
                '<div class="main-image-container" style="border:1px solid var(--bd);background:var(--sf);aspect-ratio:1/1;border-radius:var(--radius-xl);overflow:hidden;position:relative;">' +
                '<img class="zoomable" id="pimg" src="' + VX.esc(mainImgSrc) + '" alt="' + VX.esc(p.nombre) + '" style="width:100%;height:100%;object-fit:contain;padding:var(--space-4);cursor:zoom-in;">' +
                '</div>';
            if (ims.length > 1) {
                galleryHtml += '<div class="thumbnails" style="display:flex;gap:var(--space-2);margin-top:var(--space-3);overflow-x:auto;padding-bottom:var(--space-1);">';
                thumbImgs.forEach(function(u, idx) {
                    galleryHtml += '<img data-th="' + VX.esc(ims[idx]) + '" data-th-opt="' + VX.esc(u) + '" src="' + VX.esc(u) + '" alt="" class="thumb-img" style="width:72px;height:72px;object-fit:cover;background:var(--sf);border:1px solid var(--bd);border-radius:var(--radius-md);cursor:pointer;flex:none;transition:border-color .2s,transform .2s;">';
                });
                galleryHtml += '</div>';
            }
            galleryHtml += '</div>';
        }

        var actionHtml = agotado
            ? '<p class="badge-out-of-stock inline-block mt-6 px-4 py-2 rounded-lg">Agotado</p>' +
              '<a class="btn-secondary block text-center mt-4 py-3" href="' + VX.wa('Buenas, deseo consultar por la pieza "' + p.nombre + '" (' + VX.fm(VX.pr(p)) + ').') + '" target="_blank" rel="noopener">Consultar disponibilidad</a>'
            : '<div class="mt-6 flex items-center gap-3">' +
              '<div class="q">' +
              '<button data-pq="-1" aria-label="Menos cantidad" class="qty-btn">−</button>' +
              '<i id="pmq" style="min-width:28px;text-align:center;font-style:normal;color:var(--fg)">' + mq + '</i>' +
              '<button data-pq="1" aria-label="Más cantidad" class="qty-btn">+</button>' +
              '</div>' +
              '</div>' +
              '<div class="mt-4 flex gap-3">' +
              '<button class="btn-secondary flex-1 py-3" data-padd>Añadir al carrito</button>' +
              '<button class="btn-primary flex-1 py-3" data-pbuy>Comprar</button>' +
              '</div>';

        var waLink = '<a class="sl btn-ghost inline-block mt-6" target="_blank" rel="noopener" href="' + VX.wa('Buenas, deseo consultar por la pieza "' + p.nombre + '" (' + VX.fm(VX.pr(p)) + ').') + '">O consultar solo esta pieza con su asesor</a>';

        host.innerHTML =
            '<div class="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">' +
            '<div>' + galleryHtml + '</div>' +
            '<div>' +
            '<span class="ey">' + VX.esc(VX.cn(p.categoria_id)) + '</span>' +
            '<h1 class="text-2xl sm:text-3xl font-bold text-fg mt-2 mb-4">' + VX.esc(p.nombre) + '</h1>' +
            '<div class="pc text-2xl font-bold text-fg">' + VX.price(p) + '</div>' +
            descHtml + specsHtml + garantiaHtml + transporteHtml +
            actionHtml + waLink +
            '</div></div>';

        injectProductJsonLd(p, ims[0]);
        VX.obs();
    }

    render();

    host.addEventListener("click", function (e) {
        var th = e.target.closest("[data-th]");
        if (th) {
            var im = VX.$("pimg");
            var optSrc = th.getAttribute("data-th-opt");
            if (im && optSrc) im.src = optSrc;
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
        var price = product.precio_usd || 0;
        var offerPrice = VX.getO()[product.id] || price;
        var inStock = product.disponibilidad !== "agotado";
        var mainImg = image ? VX.imgUrl(image, { w: 800, h: 800, format: "webp", quality: 85 }) : "https://volxen.com/logo-light.svg";
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
                "price": offerPrice.toFixed(2),
                "availability": inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                "seller": { "@type": "Organization", "name": "VOLXEN Comercializadora Cuba" }
            }
        };
        if (product.garantia) jsonLd.warranty = product.garantia;
        script.textContent = JSON.stringify(jsonLd);
        document.head.appendChild(script);
    }
}

window.initProducto = initProducto;