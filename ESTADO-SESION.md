# ESTADO DEL PROYECTO — VOLXEN

Última actualización: 2026-11-28

## Estado actual

- Último commit: `89f0019 feat: añadir tema claro y oscuro al cliente`.
- `main` está sincronizado con `origin/main`.
- Deploy de Cloudflare `volxen-tienda`: exitoso.
- Run de deploy: `https://github.com/volxendistribution-sudo/volxen-web/runs/140856842967`.
- URL de producción: `https://volxen-tienda.volxen-distribution.workers.dev/`.
- El worker `volxen-web` sigue con build fallido; no es la URL de la tienda.

## Tema claro/oscuro del cliente

- Interruptor sol/luna en la cabecera de la tienda, entre el logo y `Menú`.
- Usa `js/pages/gestor-theme.js`, almacenamiento `volxen-gs-theme` y View Transitions.
- Tema oscuro con la paleta del gestor, sin modificar `gestor.css` ni `gestor.html`.
- Incluye fondo con degradados, hero verde oscuro, footer oscuro, logo negativo y badges adaptados.
- Páginas con interruptor: `index.html`, `catalogo.html`, `producto.html`, `carrito.html`, `checkout.html`, `pedidos.html`, `consulta.html`, `operadoras.html`, `404.html`.
- `login.html`, `recuperar.html` y `garantia.html` no lo tienen porque no usan la cabecera de la tienda.
- Verificado en escritorio y móvil, sin desbordamiento horizontal y sin errores JS.
- `dist/volxen.css` reconstruido y trackeado.

## Verificación

- `node --test` sobre tests trackeados + `tests/cliente-tema.test.js`: 149 tests pasan.
- `npm test` completo sigue incluyendo `tests/preferencias.test.js`, que no está trackeado; puede fallar por ese WIP.
- `npm run build:css` y `npm run build:html`: correctos.
- `npm run lint`: stylelint/eslint no instalados, se omiten.
- `npm run typecheck`: no hay TypeScript configurado.

## Pendiente

1. Decidir si el tema debe añadirse también a `login.html`, `recuperar.html` y `garantia.html`.
2. Mantener fuera del commit, salvo petición expresa: `docs/preview-pdf/`, `js/pages/prefs.js`, `opencode.json` y `tests/preferencias.test.js`.
3. Revisar el fallo del worker `volxen-web` si se quiere usar esa URL.
4. Continuar pendientes anteriores del catálogo PDF y la migración de precio del gestor si vuelven a estar en alcance.

## Reglas fijas

- No cambiar la paleta, tipografías ni `logo.svg` sin aprobación.
- Todo el color debe salir de variables CSS.
- El precio base nunca se modifica ni se pierde.
- Nunca inventar precios ni comisiones.
- Investigar y proponer antes de editar cuando haya ambigüedad.
- Una mejora por vez.
- Reconstruir `dist/` con `npm run build:html` y correr los tests correspondientes.
- Probar en móvil y PC.
- No inventar datos; los datos vienen de Supabase.
