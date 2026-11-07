# Estado para mañana · compartir producto (2026-11-07)

## Versión en producción
- `wrangler rollback` → versión **a4811cda** (la última probada hoy: compartir funciona,
  iconos 26-kit con trazo grueso, fotos como siempre).
- Todo el trabajo del día-52-kit está guardado en git: commit **4d55cb3** (push a main).

## Problema 1 · Los iconos se dibujan como un círculo solo (52-kit, commit 4d55cb3)
**Causa raíz (confirmada):** los 52 iconos de `volxen-icons.json` son FRAGMENTOS sin
envoltorio (`<path/>`, `<circle/>` sin atributos). `drawFeatureIcon` hace
`parseFromString(svg, 'image/svg+xml')` con ese fragmento directo → XML multi-raíz
inválida → `parsererror` → `querySelectorAll('path,rect,circle...')` no encuentra nada
→ solo se dibuja el disco.

**Fix planificado (mañana):**
1. Regenerar `js/pages/share-icons.js` envolviendo cada fragmento:
   `<svg xmlns viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
   stroke-linecap="round" stroke-linejoin="round">FRAGMENTO</svg>`
   (regla 1 del kit lo permite: "el icono se incrusta como `<svg viewBox="0 0 24 24">` en línea").
2. O editando `drawFeatureIcon` para envolver el fragmento antes de parsear (opción defensiva,
   por si algún día llega un fragmento).
3. Verificar de nuevo los 6 requeridos (`"600 W"`→potencia, `"15 AMP"`→corriente,
   `"Bifaciales monocristalinos"`→bifacial, `"Gran panel"`→dimensiones, `"Fuego"`→llama,
   `"LED / LCD"`→pantalla) y que el test de 52 iconos pase.
4. Deploy. (Lo demás del kit está bien: tonos marfil/carbón, icono = mitad del disco, lineWidth 1.75.)

## Problema 2 · Fotos de productos (no paneles) se ven borrosas
**Causa probable:** `productImageBlob` usa `productOriginalImage(product)` → URL del
archivo ORIGINAL de storage. En la mayoría de productos el original es de baja resolución
y se escala para llenar el marco 712×531 de la plantilla → borroso. Las fotos de paneles
son grandes, por eso se ven nítidas.

**Fix planificado (mañana):**
1. Pedir la variante transformada al CDN en vez del original:
   `image: productImage(product, 1200, 900, "webp")` (usaba así la build vieja; `imgUrl`
   de volxen-core redimensiona server-side con calidad 84).
2. Revisar `drawProductPhoto` (cover vs contain) y confirmar
   `ctx.imageSmoothingQuality = "high"` antes de dibujar la foto.
3. Probar con un producto de foto chiquita + un panel; comparar nítido los dos.

## Regla de cierre
No desplegar de nuevo el kit-52 sin el fix del envoltorio: los tests actuales NO pueden
detectar el parsererror (simulan carga de scripts, no del render). Considerar un test
extra mañana que valide `<svg` en todas las entradas de SHARE_ICONS.
