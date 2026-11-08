# Estado · compartir producto (2026-11-07, segunda tanda)

## Contexto
El fix anterior (d1614a20) NO resolvió nada visible: la foto del ventilador salía VACÍA
y los iconos seguían deformados. Causas raíces encontradas (no eran las que se creían):

## Causas raíces y FIX definitivo (`js/pages/gestor-docs.js`)
1. **Foto invisible (F6, TV y cualquier "contain")**: en `drawFeatheredContain` el velo
   de bordes usaba `destination-in` pero SOLO rellenaba las franjas de los bordes; esa
   operación conserva el destino únicamente donde hay fuente (las franjas) y BORRABA
   el comedio de la foto. El ventilador quedaba un cristal vacío. FIX: el velo ahora
   cubre TODO el lienzo con degradado opaco al centro, anclado a los bordes PROPIOS
   de la foto (dos pasadas alfa por eje). `full_0..2.png` verificados a resolución real.
2. **Foto "pequeña" (desproporción)**: el tono plano `#F3EDE3` detrás de la foto
   cuadraba con el fondo blanco de la foto y la hacía ver achicada. FIX: `photoEdgeTone`
   muestrea el tono del borde de la FOTO (canvas 24x24, alpha-aware) y rellena el
   cristal con Él: el relleno queda imperceptible y la foto se ve al tamaño del marco.
3. **Iconos "plásticos/mal hechos"**: el parser SVG → canvas manual no soporta ARCOS
   (`a`/`A`) ni comandos RELATIVOS (`h/v/l/t/s`): distorsionaba autonomía, peso,
   potencia, velocidad, etc. FIX: render NATIVO — el SVG del kit se rasteriza con el
   motor del navegador (`<img>` con data URI + xmlns + 192px intrínseco, currentColor →
   tono del kit) y se cachea en `iconImageCache`; `productImageBlob` PRECARGA todos los
   iconos de la ficha antes de dibujar. El parser manual queda SOLO como respaldo.

## Verificación (Chromium headless, fotos reales de la BD)
- F6 Ventilador: foto completa a lo alto del cristal, relleno imperceptible ✓
- Panel solar: cover intacto ✓ · Smart TV: contain con tono del propio fondo ✓
- Iconos con arcos (potencia, batería…) dibujados correctos y nítidos ✓

## Tests
120/120 en `npm test` (pins actualizados en `tests/gestor-ampliacion-3.test.js`:
photoEdgeTone, renderIconImage, data URI, dibujado con raster del kit).

## Pendiente para producción
- `npm run build` hecho. Falta `npm run deploy` (dist ya contiene el gestor-docs.js nuevo)
  y confirmar con recarga forzada: Compartir producto en F6/TV y en un panel.
- `gestor.html` carga `share-icons.js`, `gestor-docs.js`, `gestor-pdf.js` y `gestor.js`
  con `?v=20261108` para que el navegador NO siga usando el JS viejo en caché.
  Al publicar una nueva versión, subir ese número.
