// Iconos automáticos para compartir imagen de producto
// Fuente: iconos-volxen.zip (repositorio VOLXEN)
// Iconos SVG oficiales para características de producto
// Cada valor es el contenido SVG con stroke="#FFFFFF", listo para parsear con DOMParser
// y dibujar directamente en canvas con ctx.fill/ctx.stroke en blanco.
// Colores del kit de marca: verde #2E4A3F y dorado #C8A165 para los círculos.

const SHARE_ICONS = {
  "potencia": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Potencia</title><path d=\"M3.5 17a8.5 8.5 0 0 1 17 0 M12 17l4.5-5 M12 8.5v1.5 M5.8 12l1.1 1 M18.2 12l-1.1 1\"/><circle cx=\"12\" cy=\"17\" r=\"1.2\"/></svg>",
  "voltaje": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Voltaje</title><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M13 6.5l-4 6h3l-1 5 4-6h-3z\"/></svg>",
  "bateria": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Autonomía</title><path d=\"M4 7h13a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M22 10.5v3 M6 10.5v3 M9.5 10.5v3 M13 10.5v3\"/></svg>",
  "solar": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Panel solar</title><path d=\"M6 5h12l3 11H3z M12 5v11 M4.5 10.5h15 M12 16v4 M8 20h8\"/></svg>",
  "capacidad": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Dimensiones</title><path d=\"M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9\"/></svg>",
  "pantalla": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Pantalla</title><rect x=\"3\" y=\"5\" rx=\"2\"/><path d=\"M9 21h6 M12 17v4\"/></svg>",
  "wifi": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Control remoto</title><rect x=\"8\" y=\"2.5\" rx=\"2.5\"/><circle cx=\"12\" cy=\"7\" r=\"1.4\"/><path d=\"M10.5 12h3 M10.5 15h3 M10.5 18h3\"/></svg>",
  "frio": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Climatización</title><path d=\"M12 3v18 M4.2 7.5l15.6 9 M4.2 16.5l15.6-9 M9.5 4.7L12 7.2l2.5-2.5 M9.5 19.3L12 16.8l2.5 2.5\"/></svg>",
  "calor": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Climatización</title><path d=\"M12 3v18 M4.2 7.5l15.6 9 M4.2 16.5l15.6-9 M9.5 4.7L12 7.2l2.5-2.5 M9.5 19.3L12 16.8l2.5 2.5\"/></svg>",
  "ahorro": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Eficiencia</title><path d=\"M19.5 4.5C10 4.5 5 9 5 15.5c0 1.3.3 2.4.8 3.3C7 19.2 8.2 19.5 9.5 19.5c6.5 0 10-5 10-15z M4.5 20c2-4.5 5-7.5 9-10\"/></svg>",
  "ventilacion": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Silencioso</title><path d=\"M4 9.5h3.5L12 6v12l-4.5-3.5H4z M16 9.5l5 5 M21 9.5l-5 5\"/></svg>",
  "iluminacion": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Iluminación</title><path d=\"M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z M9.5 19h5 M10.5 21.5h3\"/></svg>",
  "durabilidad": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Resistente al agua</title><path d=\"M12 3c3.8 4.6 6 7.8 6 10.8a6 6 0 0 1-12 0C6 10.8 8.2 7.6 12 3z M9 14.5a3 3 0 0 0 3 3\"/></svg>",
  "garantia": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Garantía</title><path d=\"M12 3l7.5 3v5.5c0 4.7-3.1 8.2-7.5 9.5-4.4-1.3-7.5-4.8-7.5-9.5V6z M8.8 12l2.2 2.2 4.2-4.4\"/></svg>",
  "silencio": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Silencioso</title><path d=\"M4 9.5h3.5L12 6v12l-4.5-3.5H4z M16 9.5l5 5 M21 9.5l-5 5\"/></svg>",
  "material": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Alcance</title><path d=\"M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21z\"/><circle cx=\"12\" cy=\"10.5\" r=\"2.3\"/></svg>",
  "fuego": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Cocina</title><path d=\"M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z M3 10h18 M10 10V8.5a2 2 0 0 1 4 0V10 M5 13H3 M19 13h2\"/></svg>",
  "neutro": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke=\"#FFFFFF\"><title>Alcance</title><path d=\"M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21z\"/><circle cx=\"12\" cy=\"10.5\" r=\"2.3\"/></svg>"
};

function getShareIcon(name) {
  return SHARE_ICONS[name] || SHARE_ICONS.neutro;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SHARE_ICONS, getShareIcon };
}
