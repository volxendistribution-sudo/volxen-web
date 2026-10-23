/* VOLXEN - nucleo compartido (config, estado, carrito, cabecera/pie, overlays) */
if (document.documentElement) document.documentElement.classList.add("js");
const C = window.VOLXEN_CONFIG, H = { apikey: C.SUPABASE_KEY }, $ = i => document.getElementById(i);

async function q(path, options) {
    const res = await fetch(C.SUPABASE_URL + "/rest/v1/" + path, Object.assign({ headers: H }, options || {}));
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        console.error("[VOLXEN] Supabase error:", res.status, path, err);
        throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
}
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const wa = t => "https://wa.me/" + (C.WHATSAPP || "") + "?text=" + encodeURIComponent(t);
const fm = n => "$" + Math.round(n * 100) / 100 + " USD";
const CART_KEY = "vx_k";
let P = [], Cs = [], O = {}, OPS = [], opsError = false, cat = "", K = readCart();

function readCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
        return saved && typeof saved === "object" ? saved : {};
    } catch (e) {
        return {};
    }
}

function syncCart() {
    K = readCart();
    bd();
    return K;
}
window.addEventListener("storage", e => {
    if (e.key === CART_KEY) syncCart();
});
const ft = p => (p.imagenes && p.imagenes.length) ? p.imagenes : (p.imagen_principal ? [p.imagen_principal] : []);

// Transform Supabase image URLs for optimal delivery (WebP/AVIF, resizing)
const imgUrl = (url, opts = {}) => {
    if (!url) return "";
    const { w, h, format = "webp", quality = 80 } = opts;
    try {
        const u = new URL(url);
        // Only transform Supabase Storage URLs
        if (u.hostname.includes("supabase.co") && u.pathname.includes("/storage/v1/object/public/")) {
            u.pathname = u.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
            const params = new URLSearchParams();
            if (w) params.set("width", w);
            if (h) params.set("height", h);
            params.set("format", format);
            params.set("quality", quality);
            params.set("resize", "contain");
            u.search = params.toString();
            return u.toString();
        }
    } catch (e) {}
    return url;
};
const pr = p => Number(O[p.id] || p.precio_usd) || 0;
const ag = p => p.disponibilidad === "agotado";
const cn = id => (Cs.find(c => c.id === id) || {}).nombre || "Volxen";
const price = p => ag(p) ? "Consultar disponibilidad" : (O[p.id] ? "<s>" + fm(p.precio_usd) + "</s><b>" + fm(O[p.id]) + "</b>" : fm(p.precio_usd));
const PAGE = document.body ? (document.body.dataset.page || "") : "";

function toast(t, type = "info") {
    const e = $("ts"); if (!e) return;
    e.textContent = t;
    e.className = "on";
    if (type === "error") e.classList.add("toast-error");
    e.setAttribute("role", "status");
    e.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
    e.setAttribute("aria-atomic", "true");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => e.classList.remove("on"), type === "error" ? 5000 : 2000);
}

function bd() {
    const n = Object.values(K).reduce((a, b) => a + b, 0);
    const badges = ["bd", "bd-cart", "bd-form", "bd2"];
    badges.forEach(id => {
        const b = $(id);
        if (b) {
            b.textContent = n;
            b.style.display = n ? "flex" : "none";
        }
    });
}

function sv() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(K)) } catch (e) {}
    bd();
}

function obs() {
    const l = document.querySelectorAll(".rv:not(.in)");
    if (!("IntersectionObserver" in window)) { l.forEach(e => e.classList.add("in")); return; }
    const o = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); o.unobserve(e.target); } }), { rootMargin: "0px 0px -40px" });
    l.forEach(e => o.observe(e));
}

function pcard(p) {
    const im = ft(p)[0], a = ag(p);
    const imgSrc = im ? imgUrl(im, { w: 400, h: 300, format: "webp", quality: 80 }) : "";
    const pri = a ? '<span class="text-sm font-bold text-fg">Consultar disponibilidad</span>' :
        (O[p.id] ? '<s class="text-xs text-mu mr-1">' + fm(p.precio_usd) + '</s><span class="text-base font-black text-fg">' + fm(O[p.id]) + '</span>' :
            '<span class="text-base font-black text-fg">' + fm(p.precio_usd) + '</span>');
    return '<article class="pcd card-product flex flex-col overflow-hidden group"><div class="relative"><a href="producto.html?id=' + encodeURIComponent(p.id) + '" class="block"><div class="im">' +
        (im ? '<img src="' + esc(imgSrc) + '" alt="' + esc(p.nombre) + '" loading="lazy">' : '') +
        '</div></a><span class="absolute top-3 left-3 badge-category text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide">' + esc(cn(p.categoria_id)) + '</span>' +
        (a ? '<span class="absolute top-3 right-3 badge-out-of-stock text-xs font-bold px-2.5 py-1 rounded-lg shadow">Agotado</span>' : '') +
        '</div><div class="p-5 flex-1 flex flex-col justify-between space-y-4"><a class="tx text-left block" href="producto.html?id=' + encodeURIComponent(p.id) + '"><h3 class="font-bold text-fg line-clamp-2">' + esc(p.nombre) + '</h3></a><div class="flex items-center justify-between gap-3 pt-2 border-t border-bd"><div><span class="text-xs text-mu block uppercase">Precio</span>' + pri + '</div><button data-a="add1" data-id="' + esc(p.id) + '" class="btn-primary px-4 py-2.5 font-bold text-sm transition shadow flex items-center space-x-2"><i class="fa-solid fa-cart-plus"></i><span>Añadir</span></button></div></div></article>';
}

function show(id) {
    const o = $(id); if (!o) return;
    o.style.display = "block";
    document.body.style.overflow = "hidden";
    o.scrollTop = 0;
    requestAnimationFrame(() => o.classList.add("on"));
    // Focus trap for accessibility
    const focusable = o.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) {
        focusable[0].focus();
        o._firstFocusable = focusable[0];
        o._lastFocusable = focusable[focusable.length - 1];
        o._keydownHandler = (e) => {
            if (e.key === "Tab") {
                if (e.shiftKey && document.activeElement === o._firstFocusable) {
                    e.preventDefault(); o._lastFocusable.focus();
                } else if (!e.shiftKey && document.activeElement === o._lastFocusable) {
                    e.preventDefault(); o._firstFocusable.focus();
                }
            }
        };
        o.addEventListener("keydown", o._keydownHandler);
    }
}

function hide() {
    document.querySelectorAll(".ov.on").forEach(o => {
        o.classList.remove("on");
        if (o._keydownHandler) o.removeEventListener("keydown", o._keydownHandler);
        setTimeout(() => { if (!o.classList.contains("on")) o.style.display = "none"; }, 300);
    });
    document.body.style.overflow = "";
}

function go(u) {
    const a = document.createElement("a");
    a.href = u; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
}

function add(id, n) {
    K[id] = (K[id] || 0) + n;
    sv();
    const p = P.find(x => x.id === id);
    toast((p ? p.nombre + ": " : "") + "añadido a su pedido");
    const e = $("ts");
    if (e) {
        e.insertAdjacentHTML("beforeend", '<a class="vp" href="carrito.html">Ver pedido</a>');
        clearTimeout(toast.t);
        toast.t = setTimeout(() => e.classList.remove("on"), 4000);
    }
}

function setQty(id, d) {
    K[id] = (K[id] || 0) + d;
    if (K[id] <= 0) delete K[id];
    sv();
    cart();
}

function cartItems() { return Object.keys(K).map(id => P.find(x => x.id === id)).filter(Boolean); }
function cartTotal() { return cartItems().reduce((a, p) => a + pr(p) * K[p.id], 0); }

function cart() {
    const el = $("cl"); if (!el) return;
    const it = cartItems();
    
    // Render product list
    el.innerHTML = it.length ? it.map(p => {
        const unitPrice = pr(p);
        const qty = K[p.id];
        const subtotal = unitPrice * qty;
        return '<div class="li"><img src="' + esc(imgUrl(ft(p)[0] || "", { w: 80, h: 80, format: "webp", quality: 80 })) + '" alt="" class="cart-thumb"><div class="flex-1 min-w-0"><div class="flex items-start justify-between gap-2"><b class="truncate">' + esc(p.nombre) + '</b><button data-a="rm" data-id="' + esc(p.id) + '" aria-label="Quitar" class="remove-btn flex-shrink-0">×</button></div><div class="flex items-center gap-3 mt-2 text-sm"><span class="text-mu">Precio: ' + fm(unitPrice) + '</span><div class="q"><button data-a="qm" data-id="' + esc(p.id) + '" aria-label="Menos" class="qty-btn">−</button><i>' + qty + '</i><button data-a="qp" data-id="' + esc(p.id) + '" aria-label="Más" class="qty-btn">+</button></div></div><span class="cart-subtotal font-semibold text-fg">' + fm(subtotal) + '</span></div></div>';
    }).join("") : '<p style="margin-top:1.5rem;text-align:center;color:var(--mu)">Su pedido está vacío. <a class="sl btn-ghost" href="catalogo.html" style="display:inline;width:auto;padding:8px 16px">Explorar el catálogo</a></p>';

    // Calculate totals
    const subtotal = it.reduce((a, p) => a + Number(p.precio_usd) * K[p.id], 0);
    const discount = it.reduce((a, p) => {
        const offer = O[p.id];
        return a + (offer && offer < p.precio_usd ? (p.precio_usd - offer) * K[p.id] : 0);
    }, 0);
    const total = subtotal - discount;

    // Update both cart and checkout summaries with the same source of truth
    ["cartSummary", "checkoutCartSummary"].forEach(id => {
        const el = $(id);
        if (el) el.classList.toggle("hidden", it.length === 0);
    });
    const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    setText("cartSubtotal", fm(subtotal));
    setText("checkoutSubtotal", fm(subtotal));
    setText("cartDiscount", discount > 0 ? '-' + fm(discount) : fm(0));
    setText("checkoutDiscount", discount > 0 ? '-' + fm(discount) : fm(0));
    setText("cartShipping", "Por coordinar");
    setText("checkoutShipping", "Por coordinar");
    setText("cartTotal", fm(total));
    setText("checkoutTotal", fm(total));

    const c = $("cf"); if (c) c.style.display = it.length ? "block" : "none";
    const cg = $("cartGo"); if (cg) cg.style.display = it.length ? "inline-flex" : "none";
}

/* ===== Cabecera, pie y overlays compartidos ===== */
function renderNav() {
    const nav = $("cn");
    if (nav) nav.innerHTML = [{ id: "", nombre: "Catálogo" }].concat(Cs).map(c =>
        '<a href="catalogo.html' + (c.id ? '?cat=' + encodeURIComponent(c.id) : '') + '" data-a="cat" data-id="' + esc(c.id) + '" class="nav-chip whitespace-nowrap px-3.5 py-1.5 rounded-lg transition ' + (c.id === cat ? "nav-chip-on" : "nav-chip-off") + '">' + esc(c.nombre) + '</a>'
    ).join("");
    const fdp = $("fdp");
    if (fdp) fdp.innerHTML = Cs.map(c =>
        '<li><a href="catalogo.html?cat=' + encodeURIComponent(c.id) + '" class="hover:text-gi transition text-left">' + esc(c.nombre) + '</a></li>'
    ).join("");
}

function opIcon(size, cls) {
    const s = Number(size) || 40;
    return '<svg class="op-icon' + (cls ? ' ' + cls : '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
        '<circle cx="32" cy="32" r="32" fill="var(--mu)"/>' +
        '<path fill="var(--s2)" d="M32 16.5a7.8 7.8 0 0 0-7.8 7.8v3.2h15.6v-3.2a7.8 7.8 0 0 0-7.8-7.8Z"/>' +
        '<path fill="var(--s2)" d="M16.5 52v-1.5c0-8.6 7-15.5 15.5-15.5s15.5 6.9 15.5 15.5V52h-31Z"/>' +
        '<path d="M18.2 29.5v-4.8C18.2 17.4 24.4 12 32 12s13.8 5.4 13.8 12.7v4.8" fill="none" stroke="var(--s2)" stroke-width="3" stroke-linecap="round"/>' +
        '<rect x="15.2" y="27" width="5.8" height="11.2" rx="2.9" fill="var(--s2)"/>' +
        '<rect x="43" y="27" width="5.8" height="11.2" rx="2.9" fill="var(--s2)"/>' +
        '<path d="M46.4 38.2c1.4 3.2 1.6 6 .2 8.2" fill="none" stroke="var(--s2)" stroke-width="2.6" stroke-linecap="round"/>' +
        '<circle cx="47.8" cy="47.5" r="2.4" fill="var(--s2)"/>' +
        '</svg>';
}
function hydrateOpIcons(root) {
    (root || document).querySelectorAll("[data-op-icon]").forEach(el => {
        if (!el.querySelector("svg")) el.innerHTML = opIcon(el.getAttribute("data-op-icon"));
    });
}

function avatarHtml(user, cls) {
    const profile = user || {};
    const name = String(profile.nombre || profile.name || profile.email || "").trim();
    const initial = (name.charAt(0) || "V").toUpperCase();
    const url = String(profile.avatar || profile.avatar_url || profile.picture || "");
    return '<span class="' + (cls || "vx-avatar") + '" aria-hidden="true"><span>' + esc(initial) + '</span>' +
        (url ? '<img src="' + esc(url) + '" alt="" loading="lazy" onerror="this.remove()">' : "") + '</span>';
}

function readAccountUser() {
    try {
        const session = JSON.parse(localStorage.getItem("vx_sesion") || "null");
        return session && session.user ? session.user : null;
    } catch (e) {
        return null;
    }
}

function accountFirstName(user) {
    const name = String((user && (user.nombre || user.name || user.email)) || "").trim();
    if (!name) return "";
    return (name.indexOf("@") > 0 ? name.split("@")[0] : name).split(/\s+/)[0];
}

function menuAccountHtml(user) {
    if (!user) {
        return '<div class="menu-account menu-account-guest">' +
            '<p class="menu-account-kicker">Tu cuenta</p>' +
            '<p class="menu-account-title">Entra para ver tus pedidos y consultas.</p>' +
            '<div class="menu-account-actions">' +
            '<a href="login.html" class="menu-account-primary">Iniciar sesión</a>' +
            '<a href="login.html?modo=registro" class="menu-account-secondary">Crear cuenta</a>' +
            '</div></div>';
    }

    const name = String(user.nombre || user.name || "Mi cuenta").trim();
    const email = String(user.email || "").trim();
    return '<div class="menu-account">' +
        '<span class="menu-account-avatar">' + avatarHtml(user, "menu-avatar vx-avatar") + '</span>' +
        '<div class="menu-account-id"><strong>' + esc(name) + '</strong>' +
        (email ? '<small>' + esc(email) + '</small>' : '') + '</div>' +
        '<button type="button" class="menu-account-logout" data-menu-logout aria-label="Cerrar sesión">' +
        '<i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i><span>Salir</span></button>' +
        '</div>';
}

function hydrateAccount() {
    const user = readAccountUser();
    const link = $("accountLink");

    if (link) {
        if (user) {
            const holder = link.querySelector("[data-account-avatar]");
            if (holder) holder.outerHTML = avatarHtml(user, "nav-account-avatar vx-avatar");
            const label = link.querySelector("[data-account-name]");
            const firstName = accountFirstName(user);
            if (label && firstName) label.textContent = firstName;
            const name = user.nombre || user.email || "";
            if (name) link.setAttribute("aria-label", "Mi cuenta de " + name);
        }
    }

    const menu = $("menuAccount");
    if (menu) menu.innerHTML = menuAccountHtml(user);

    const adminLink = document.querySelector("[data-admin-only]");
    if (adminLink) adminLink.hidden = !(user && user.role === "admin");
}
const OP_MSG = "Buenas, necesito información sobre un producto.";
const opDigits = n => String(n || "").replace(/\D/g, "");
function opCard(o, size, compact) {
    const d = opDigits(o.whatsapp);
    const on = !!o.disponible;
    const horario = o.horario && String(o.horario).trim() ? "Horario: " + String(o.horario).trim() : "Horario por confirmar";
    return '<article class="op-card' + (compact ? ' op-card-compact' : '') + '">' +
        '<div class="op-card-head">' + opIcon(size || 64) +
        '<div class="op-card-id"><h3>' + esc(o.nombre) + '</h3><p class="op-hours">' + esc(horario) + '</p>' +
        '<span class="op-status ' + (on ? "on" : "off") + '"><i aria-hidden="true"></i>' + (on ? "Disponible" : "No disponible") + '</span></div></div>' +
        (d ? '<a class="btn-primary op-wa" href="https://wa.me/' + d + '?text=' + encodeURIComponent(OP_MSG) + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i><span>Escribir por WhatsApp</span></a>' : '') +
        '</article>';
}
function opLista(size) {
    if (opsError) return '<div class="op-empty"><p>No se pudieron cargar las operadoras.</p><a href="consulta.html" class="btn-secondary">Enviar una consulta</a></div>';
    if (!OPS.length) return '<div class="op-empty"><p>No hay operadoras disponibles en este momento.</p><a href="consulta.html" class="btn-secondary">Enviar una consulta</a></div>';
    return OPS.map(o => opCard(o, size)).join("");
}
function operadoras() {
    return '<div id="operadoras" class="pantalla fixed inset-0 z-50 overflow-y-auto">' +
        '<a href="#" aria-label="Cerrar" class="fixed inset-0 bg-fg/70 backdrop-blur-sm cursor-default"></a>' +
        '<div class="relative min-h-full flex items-center justify-center p-4 pointer-events-none"><div class="relative bg-s2 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl z-10 space-y-6 pointer-events-auto">' +
        '<div class="flex items-center justify-between"><div class="flex items-center space-x-3"><img src="logo-light.svg" alt="" class="h-8 w-auto shrink-0"><h3 class="font-bold text-fg">Contacte con nuestras operadoras</h3></div><a href="#" aria-label="Cerrar" class="text-mu hover:text-fg"><i class="fa-solid fa-xmark text-lg"></i></a></div>' +
        '<p class="text-sm text-mu leading-relaxed">¿Necesita información sobre un producto o quiere consultar su pedido? Contacte con una de nuestras operadoras y reciba atención personalizada.</p>' +
        '<div id="operadorasLista" class="op-list">' + opLista(40) + '</div>' +
        '</div></div></div>';
}
function renderOperadoras() {
    const lista = $("operadorasLista");
    if (lista) lista.innerHTML = opLista(40);
    const grid = $("opsPageGrid");
    if (grid) {
        grid.innerHTML = OPS.length
            ? OPS.map(o => opCard(o, 64)).join("")
            : '<div class="op-empty op-empty-page"><p>' + (opsError ? "No se pudieron cargar las operadoras." : "No hay operadoras disponibles en este momento.") + '</p><div class="op-empty-actions">' + (opsError ? '<button type="button" class="btn-secondary" data-ops-retry>Reintentar</button>' : '') + '<a class="btn-secondary" href="consulta.html">Enviar una consulta</a></div></div>';
        obs();
    }
}
async function loadOperadoras() {
    try {
        const res = await fetch(C.SUPABASE_URL + "/rest/v1/operadoras?activa=eq.true&order=orden", { headers: H });
        if (!res.ok) throw new Error("No se pudieron cargar las operadoras.");
        const j = await res.json();
        OPS = Array.isArray(j) ? j : [];
        opsError = false;
    } catch (e) {
        OPS = [];
        opsError = true;
    }
    renderOperadoras();
    return OPS;
}

const CATEGORY_IMAGES = {
    "electrodomesticos": "categorias/electrodomesticos.svg",
    "climatizacion": "categorias/climatizacion.svg",
    "refrigeracion": "categorias/refrigeracion.svg",
    "energia-paneles-solares": "categorias/energia-paneles-solares.svg",
    "movilidad-electrica": "categorias/movilidad-electrica.svg",
    "linea-de-cocina": "categorias/linea-de-cocina.svg",
    "tv-y-audio": "categorias/tv-y-audio.svg"
};

function categorySlug(name) {
    return String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function categoryImage(category) {
    return CATEGORY_IMAGES[categorySlug(category && category.nombre)] || "categorias/categoria.svg";
}

function menuOverlay() {
    const links = [
        { href: "catalogo.html", icon: "fa-store", text: "Catálogo" },
        { href: "carrito.html", icon: "fa-cart-shopping", text: "Carrito" },
        { href: "pedidos.html", icon: "fa-box", text: "Mis pedidos" },
        { href: "consulta.html", icon: "fa-circle-question", text: "Consulta general" },
        { href: "consulta.html?tipo=incidencia", icon: "fa-triangle-exclamation", text: "Reportar incidencia" },
        { href: "consulta.html?tipo=queja", icon: "fa-comment-dots", text: "Queja u opinión" },
        { href: "operadoras.html", icon: "fa-headset", text: "Operadoras" },
        { href: "admin.html", icon: "fa-shield-halved", text: "Acceso al panel", admin: true }
    ];
    return '<div class="ov" id="mnv"><div class="bx sh lf"><button class="xb" data-a="close" aria-label="Cerrar">×</button>' +
        '<div id="menuAccount" class="menu-account-slot"></div>' +
        '<span class="ey menu-ey">Navegar</span><nav class="mn" aria-label="Menú principal">' +
        links.map((link, i) => '<a href="' + link.href + '"' + (link.admin ? ' data-admin-only hidden' : '') + ' style="--mn-i:' + i + '"><i class="fa-solid ' + link.icon + ' mn-ico" aria-hidden="true"></i><span>' + link.text + '</span></a>').join("") +
        '</nav>' +
        '</div></div>';
}

function minimalHeader() {
    return '<header id="hd" class="sticky top-0 z-50 bg-sf text-fg border-b border-bd shadow-sm">' +
        '<div class="max-w-3xl mx-auto px-4 sm:px-6"><div class="flex items-center justify-between h-16 gap-3">' +
        '<a href="index.html" class="flex items-center gap-2 shrink-0" aria-label="VOLXEN, comercializadora de tecnología y energía en Cuba"><img src="logo-light.svg" alt="Logo VOLXEN" class="h-8 w-auto shrink-0"><span class="logo-wm" role="img" aria-label="VOLXEN"></span></a>' +
        '<div class="flex items-center gap-2">' +
        '<button data-a="menu" aria-label="Abrir menú de la cuenta" class="bg-s2 hover:bg-sf border border-bd text-fg px-2.5 py-2 rounded-lg transition flex items-center gap-1.5"><i class="fa-solid fa-bars text-base"></i><span class="hidden sm:inline text-xs font-bold">Menú</span></button>' +
        '<a href="pedidos.html" id="accountLink" aria-label="Mi cuenta" class="bg-s2 hover:bg-sf border border-bd text-fg px-2.5 py-2 rounded-lg transition flex items-center gap-1.5"><span id="navAccountAvatar" class="nav-account-avatar vx-avatar" data-account-avatar aria-hidden="true"><i class="fa-regular fa-user" style="font-size:.85rem"></i></span><span class="nav-account-name text-xs font-bold" data-account-name>Mi cuenta</span></a>' +
        '<a href="index.html" aria-label="Volver al inicio" class="hidden sm:flex btn-secondary hover:bg-sf px-3 py-2 text-xs font-bold transition items-center gap-1.5"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span>Inicio</span></a>' +
        '</div></div></div></header>';
}

function shell() {
    if (document.body.dataset.shell === "minimal") {
        document.body.insertAdjacentHTML("afterbegin", minimalHeader());
        document.body.insertAdjacentHTML("beforeend", '<div id="ts"></div>' + menuOverlay() + operadoras() +
            '<div class="zm" id="zm"><button class="zx" aria-label="Cerrar">×</button><img alt=""></div>');
        return;
    }

    const header =
        '<header id="hd" class="sticky top-0 z-50 bg-sf text-fg border-b border-bd shadow-sm">' +
        '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="flex items-center justify-between h-14 sm:h-16 gap-3">' +
        '<a href="index.html" class="flex items-center gap-1.5 sm:gap-2 shrink-0" aria-label="VOLXEN, comercializadora de tecnología y energía en Cuba"><img src="logo-light.svg" alt="Logo VOLXEN" class="h-7 sm:h-8 w-auto shrink-0"><span class="block leading-none hidden sm:block"><span class="logo-wm" role="img" aria-label="VOLXEN"></span><span class="logo-tagline block mt-0.5 text-mu font-bold">Comercializadora</span></span></a>' +
        '<div class="flex items-center space-x-2">' +
        '<button data-a="menu" aria-label="Abrir menú" class="bg-s2 hover:bg-sf border border-bd text-fg px-2.5 py-2 rounded-lg transition flex items-center gap-1.5"><i class="fa-solid fa-bars text-base"></i><span class="hidden sm:inline text-xs font-bold">Menú</span></button>' +
        '<a href="pedidos.html" id="accountLink" aria-label="Mi cuenta" class="bg-s2 hover:bg-sf border border-bd text-fg px-2.5 py-2 rounded-lg transition flex items-center gap-1.5"><span id="navAccountAvatar" class="nav-account-avatar vx-avatar" data-account-avatar aria-hidden="true"><i class="fa-regular fa-user" style="font-size:.85rem"></i></span><span class="nav-account-name text-xs font-bold" data-account-name>Mi cuenta</span></a>' +
        '<a href="carrito.html" aria-label="Ver su pedido" class="relative btn-primary hover:bg-g-hover hover:text-fg font-bold px-2.5 py-2 rounded-lg flex items-center space-x-1.5 transition shadow-sm"><i class="fa-solid fa-cart-shopping text-base"></i><span class="hidden sm:inline text-xs">Carrito</span><span id="bd" class="absolute -top-1.5 -right-1.5 bg-fg text-g text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">0</span></a>' +
        '</div></div>' +
        '<div class="pb-2"><div class="relative w-full"><input type="text" id="searchInput" placeholder="Buscar productos..." class="w-full input-base placeholder-mu pr-12 focus-ring-g"><button data-search aria-label="Buscar" class="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-2 btn-primary hover:bg-g-hover hover:text-fg rounded transition flex items-center justify-center"><i class="fa-solid fa-magnifying-glass"></i></button></div></div>' +
        '<div class="border-t border-bd"><div class="flex space-x-1 overflow-x-auto py-1.5 scrollbar-none font-medium" id="cn"></div></div>' +
        '</div></header>';

    const footer =
        '<footer class="bg-fg text-mu pt-16 pb-12 mt-16 border-t border-bd"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">' +
        '<div class="space-y-4"><a href="index.html" class="flex items-center gap-3" aria-label="VOLXEN, comercializadora de tecnología y energía en Cuba"><img src="logo-light.svg" alt="Logo VOLXEN" class="h-10 w-auto shrink-0"><span class="block leading-none"><span class="logo-wm-claro h-5" role="img" aria-label="VOLXEN"></span><span class="logo-tagline block mt-1.5 text-mu font-bold">Comercializadora</span></span></a>' +
        '<p class="text-xs text-mu leading-relaxed">VOLXEN es una comercializadora de tecnología y energía en Cuba, con sede en La Habana. Transparencia y confianza en cada venta.</p>' +
        '<div class="flex space-x-3 pt-2"><a href="https://www.facebook.com/share/1M1HdetBFY/" target="_blank" rel="noopener noreferrer" aria-label="Facebook de VOLXEN" title="Facebook de VOLXEN" class="w-9 h-9 rounded-lg bg-s2 hover:bg-g hover:text-fg text-fg flex items-center justify-center transition"><i class="fa-brands fa-facebook-f"></i></a></div></div>' +
        '<div><h4 class="text-s2 font-semibold text-sm mb-4 uppercase tracking-wider">Departamentos</h4><ul id="fdp" class="space-y-2 text-xs"></ul></div>' +
        '<div><h4 class="text-s2 font-semibold text-sm mb-4 uppercase tracking-wider">Atención al Cliente</h4><ul class="space-y-2 text-xs"><li><a href="operadoras.html" class="hover:text-g transition inline-flex items-center gap-2">' + opIcon(24) + '<span>Hablar con una operadora</span></a></li><li><a href="consulta.html" class="hover:text-g transition">Consulta general e incidencias</a></li></ul></div>' +
        '<div><h4 class="text-s2 font-semibold text-sm mb-4 uppercase tracking-wider">Información</h4><ul class="space-y-2 text-xs"><li><a href="index.html#comoTrabajamos" class="hover:text-g transition">Cómo trabajamos</a></li></ul></div>' +
        '</div><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-bd pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-mu"><p>&copy; <span id="yr">2026</span> Volxen Comercializadora Cuba. Todos los derechos reservados.</p></div></footer>';

    const overlays =
        '<div id="ts"></div>' + operadoras() +
        '<div class="zm" id="zm"><button class="zx" aria-label="Cerrar">×</button><img alt=""></div>';

    document.body.insertAdjacentHTML("afterbegin", header);
    document.body.insertAdjacentHTML("beforeend", footer + menuOverlay() + overlays);
}

/* ===== Seguimiento de pedidos ===== */
const LSP = "vx_pedidos";
const rdp = () => { try { return JSON.parse(localStorage.getItem(LSP) || "[]") } catch (e) { return [] } };
const wrp = a => { try { localStorage.setItem(LSP, JSON.stringify(a)) } catch (e) {} };
function gp(c, t) { c = String(c).toUpperCase(); const a = rdp(); if (!a.some(x => x.c === c)) { a.unshift({ c: c, t: t, f: Date.now() }); wrp(a) } }
window.vxGuardarPedido = gp;
const fa = (x, k) => { if (Array.isArray(x)) return x.length && x.every(o => o && typeof o === "object" && k in o) ? x : null; if (x && typeof x === "object") { for (const v of Object.values(x)) { const r = fa(v, k); if (r) return r } } return null };
const findValue = (x, k) => x && typeof x === "object" ? (k in x ? x[k] : Object.values(x).map(v => findValue(v, k)).find(v => v != null)) : undefined;
const findTracking = x => { if (x && typeof x === "object") { for (const [k, v] of Object.entries(x)) if (/track|token/i.test(k) && typeof v === "string") return v; for (const v of Object.values(x)) { const r = findTracking(v); if (r) return r } } };
const f0 = window.fetch;
window.fetch = function (u, o) {
    const r = f0.apply(this, arguments);
    try {
        const s = String(u && u.url || u);
        if (/\/rest\/v1\//.test(s) && !/consultar_pedido_tracking/.test(s) &&
            String(o && o.method || u && u.method || "GET").toUpperCase() === "POST") {
            r.then(x => x.clone().json()).then(j => {
                const c = findValue(j, "codigo"), t = findTracking(j);
                if (c && t) gp(c, t);
            }).catch(() => {});
        }
    } catch (e) {}
    return r;
};
const pe = s => { s = String(s || "").replace(/_/g, " "); return s.charAt(0).toUpperCase() + s.slice(1) };
const estadoLargo = e => {
    const x = String(e || "").toLowerCase();
    if (/cancel|rechaz/.test(x)) return "Cancelado";
    if (/entreg|complet/.test(x)) return "Entregado";
    if (/camino|ruta|envi|transp|despach/.test(x)) return "En camino";
    if (/prepar|proces|aprob|list/.test(x)) return "Preparando pedido";
    if (/confirm/.test(x)) return "Confirmando pedido";
    if (/pend|recib|regist|nuev/.test(x)) return "Pedido recibido";
    return pe(e);
};
const dt = o => { const h = o.hs.map(x => x.created_at).filter(Boolean).sort()[0]; return h ? new Date(h) : null };
const img = n => { const p = P.find(x => x.nombre === n); return p ? ft(p)[0] || "" : "" };
const fd = d => d.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
const fh = d => d ? d.toLocaleString("es", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
const D = {};
const ask = (c, t) => fetch(C.SUPABASE_URL + "/rest/v1/rpc/consultar_pedido_tracking", { method: "POST", headers: { apikey: C.SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_codigo: c, p_tracking_token: t }) }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error((j && j.message) || "No se pudo consultar el pedido."); if (!j || !findValue(j, "codigo")) throw new Error("No encontramos un pedido con esos códigos."); return j });
const inf = j => ({ c: findValue(j, "codigo"), e: findValue(j, "estado"), n: findValue(j, "nombre_cliente"), t: findValue(j, "total_usd"), it: fa(j, "producto_nombre") || [], hs: fa(j, "estado") || [] });

function trackDet(c) {
    const pv = $("pv"); if (!pv) return;
    const o = D[c];
    if (!o) { pv.innerHTML = '<p class="form-error" role="alert">No encontramos un pedido con esos códigos.</p>'; return; }
    const cancelado = /cancel|rechaz/.test(String(o.e || "").toLowerCase());
    const fecha = dt(o) || (o.f ? new Date(o.f) : null);
    const h = o.hs.slice().sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
    pv.innerHTML =
        '<div class="track-head"><div><p class="ey">Pedido</p><h2 class="order-code">' + esc(o.c) + '</h2></div>' +
        '<span class="' + (cancelado ? 'badge-out-of-stock' : 'badge-category') + ' track-badge">' + esc(estadoLargo(o.e)) + '</span></div>' +
        '<div class="track-summary">' +
        '<div><span class="ey">Estado actual</span><b>' + esc(estadoLargo(o.e)) + '</b></div>' +
        (o.t != null ? '<div><span class="ey">Total de productos</span><b>' + fm(Number(o.t)) + '</b></div>' : '') +
        (o.n ? '<div><span class="ey">Cliente</span><b>' + esc(o.n) + '</b></div>' : '') +
        (fecha ? '<div><span class="ey">Registrado</span><b>' + esc(fd(fecha)) + '</b></div>' : '') +
        '</div>' +
        '<p class="lb" style="margin-top:2rem">Productos</p>' +
        '<div class="space-y-0">' +
        o.it.map(p => {
            const m = img(p.producto_nombre);
            const trackImgSrc = m ? imgUrl(m, { w: 56, h: 56, format: "webp", quality: 80 }) : "";
            return '<div class="track-item">' + (trackImgSrc ? '<img src="' + esc(trackImgSrc) + '" alt="" class="track-thumb">' : '') +
                '<div class="track-info"><b>' + esc(p.producto_nombre) + '</b><span>' + esc(p.cantidad) +
                (Number(p.cantidad) > 1 ? ' unidades' : ' unidad') +
                (p.subtotal != null ? ' <span class="track-subtotal">· ' + fm(Number(p.subtotal)) + '</span>' : '') + '</span></div></div>';
        }).join("") +
        '</div>' +
        '<p class="lb" style="margin-top:2rem">Línea de tiempo</p>' +
        (h.length ? '<div class="tl">' + h.map(x =>
            '<p><span style="color:var(--fg)">' + esc(estadoLargo(x.estado)) + '</span>' +
            (x.created_at ? '<br><time datetime="' + esc(x.created_at) + '">' + esc(fh(new Date(x.created_at))) + '</time>' : '') +
            (x.comentario ? '<br><span class="nt">' + esc(x.comentario) + '</span>' : '') + '</p>'
        ).join("") + '</div>' :
            '<div class="tl"><p><span style="color:var(--fg)">Pedido recibido</span>' + (fecha ? '<br><time datetime="' + esc(fecha.toISOString()) + '">' + esc(fh(fecha)) + '</time>' : '') + '</p></div>') +
        '<a class="btn-primary track-action" href="' + wa("Buenas, necesito ayuda con mi pedido " + o.c) + '" target="_blank" rel="noopener">Hablar con una operadora</a>' +
        '<button class="btn-secondary track-action" type="button" id="trackNew">Consultar otro pedido</button>';
}

async function consultarPedido(c, t) {
    c = String(c || "").trim().toUpperCase();
    t = String(t || "").trim();
    if (!c || !t) throw new Error("Escriba el código del pedido y el código de seguimiento.");
    const j = await ask(c, t);
    gp(c, t);
    const o = inf(j);
    o.f = (rdp().find(x => x.c === c) || {}).f || Date.now();
    D[c] = o;
    trackDet(c);
    return o;
}

/* ===== Carga de datos y arranque ===== */
function setCat(v) { cat = v || ""; renderNav(); }

let loadRetry = 0;
const MAX_LOAD_RETRIES = 2;

async function load() {
    try {
        const [c, p, o] = await Promise.all([
            q("categorias?order=orden", { cache: "no-store" }),
            q("productos?disponibilidad=eq.disponible&order=created_at.desc"),
            q("ofertas?activa=eq.true")
        ]);
        Cs = Array.isArray(c) ? c : [];
        P = Array.isArray(p) ? p : [];
        (Array.isArray(o) ? o : []).forEach(x => O[x.producto_id] = x.precio_oferta_usd);
        loadRetry = 0;
        const stale = Object.keys(K).filter(id => !P.some(x => x.id === id));
        if (stale.length) {
            stale.forEach(id => delete K[id]);
            sv();
            toast("Algunos productos ya no están disponibles y se quitaron de su pedido.", "error");
        }
    } catch (err) {
        loadRetry++;
        if (loadRetry <= MAX_LOAD_RETRIES) {
            toast("Reintentando conexión... (" + loadRetry + "/" + MAX_LOAD_RETRIES + ")", "error");
            await new Promise(r => setTimeout(r, 1000 * loadRetry));
            return load();
        }
        toast("No se pudo cargar el catálogo. Verifique su conexión.", "error");
        console.error("[VOLXEN] Load failed:", err);
        Cs = []; P = []; O = {};
    }
}

function wireGlobal() {
    document.addEventListener("click", e => {
        const logout = e.target.closest("[data-menu-logout]");
        if (logout) {
            e.preventDefault();
            logout.disabled = true;
            let session = null;
            try { session = JSON.parse(localStorage.getItem("vx_sesion") || "null"); } catch (err) {}
            try { localStorage.removeItem("vx_sesion"); } catch (err) {}
            if (session && session.access_token) {
                fetch(C.SUPABASE_URL + "/auth/v1/logout", {
                    method: "POST",
                    headers: { apikey: C.SUPABASE_KEY, Authorization: "Bearer " + session.access_token }
                }).catch(() => {});
            }
            location.href = "login.html";
            return;
        }

        const t = e.target.closest("[data-a]");
        if (!t) return;
        const a = t.dataset.a, id = t.dataset.id;
        if (a === "menu") show("mnv");
        else if (a === "close") hide();
        else if (a === "add1") add(id, 1);
        else if (a === "qm") setQty(id, -1);
        else if (a === "qp") setQty(id, 1);
        else if (a === "rm") setQty(id, -999);
        else if (a === "send") { if (typeof window.send === "function") window.send(); }
        else if (a === "cat") {
            setCat(id || "");
            if (window.vxOnCategory) { e.preventDefault(); window.vxOnCategory(id || ""); }
        }
    });

    document.querySelectorAll(".ov").forEach(o => o.addEventListener("click", e => { if (e.target === o) hide() }));
    document.addEventListener("keydown", e => { if (e.key === "Escape") { hide(); const z = $("zm"); if (z) z.classList.remove("on"); } });

    const hd = $("hd");
    if (hd) addEventListener("scroll", () => hd.classList.toggle("sc", scrollY > 12), { passive: true });
    const yr = $("yr"); if (yr) yr.textContent = new Date().getFullYear();

    document.querySelectorAll("[data-search]").forEach(b => b.addEventListener("click", doSearch));
    const si = $("searchInput");
    if (si) si.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });

    const zm = $("zm");
    if (zm) { zm.addEventListener("click", () => zm.classList.remove("on")); }
    document.addEventListener("click", e => {
        const g2 = e.target.closest(".zoomable");
        if (!g2) return;
        const zi = $("zm").querySelector("img");
        zi.src = g2.currentSrc || g2.src; zi.alt = g2.alt || "";
        $("zm").classList.add("on");
    });

    bd();
}

function doSearch() {
    const v = (($("searchInput") || {}).value || "").trim();
    if (window.vxOnSearch) { window.vxOnSearch(v); return; }
    location.href = "catalogo.html" + (v ? "?q=" + encodeURIComponent(v) : "");
}

async function start(pageInit) {
    shell();
    hydrateOpIcons();
    hydrateAccount();
    bd();
    wireGlobal();
    obs();
    await load();
    renderNav();
    await loadOperadoras();
    if (typeof pageInit === "function") await pageInit();
    obs();
}

window.VX = { $, q, esc, wa, fm, ft, imgUrl, pr, ag, cn, price, toast, bd, sv, syncCart, obs, pcard, show, hide, go, add, setQty, cart, cartItems, cartTotal, load, renderNav, setCat, trackDet, consultarPedido, estadoLargo, operadoras, opIcon, hydrateOpIcons, hydrateAccount, avatarHtml, start, loadOperadoras, renderOperadoras, getOps: () => OPS, getP: () => P, getCs: () => Cs, getO: () => O, getK: () => K, categoryImage, PAGE };
