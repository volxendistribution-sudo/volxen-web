# Estado · compartir producto (2026-11-07, cerrado y deployado)

## RESUELTO (ambos fixes deployados, versión d1614a20)
1. **Icono = solo círculo** → FIX: `js/pages/share-icons.js` regenerado con CADA icono
   envuelto en `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
   stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">` (regla 1 del kit).
   El parser `image/svg+xml` ya recibe un svg completo xml-válido y dibuja el fragmento.
   Tests nuevos: pins `"X": "<svg"` para los 52 + conteo de `</svg>",` = 52.
2. **Fotos borrosas (no paneles)** → FIX: el branch "contain" de `drawProductPhoto`
   ya NO dibuja fondo `blur(40px)` ni velo `rgba(248,247,244,0.55)`: pinta fondo limpio
   `#F3EDE3` y contiene la foto con borde plumilla. Los paneles siguen por `cover`.
   Test actualizado ("fondo limpio si hay que contener") y pins de prohibición de blur/velo.

## Versión en producción
- `d1614a20` (52-iconos + fotos limpias) — sucesora del rollback temporal a `a4811cda`.
- Prueba con recarga forzada: Compartir producto en productos no-paneles (foto nítida) + check visual de iconos del kit.
