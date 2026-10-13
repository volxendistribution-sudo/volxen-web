#!/usr/bin/env node
/**
 * Genera sitemap.xml para VOLXEN
 * Uso: node scripts/generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://volxen.com';

const STATIC_PAGES = [
    { url: '/', changefreq: 'weekly', priority: 1.0 },
    { url: '/catalogo.html', changefreq: 'daily', priority: 0.9 },
    { url: '/producto.html', changefreq: 'weekly', priority: 0.8 },
    { url: '/carrito.html', changefreq: 'monthly', priority: 0.5 },
    { url: '/checkout.html', changefreq: 'monthly', priority: 0.5 },
    { url: '/pedidos.html', changefreq: 'monthly', priority: 0.5 },
];

function generateSitemap() {
    const today = new Date().toISOString().split('T')[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ';
    xml += 'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

    STATIC_PAGES.forEach(page => {
        xml += '  <url>\n';
        xml += `    <loc>${BASE_URL}${page.url}</loc>\n`;
        xml += `    <lastmod>${today}</lastmod>\n`;
        xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
        xml += `    <priority>${page.priority}</priority>\n`;
        // hreflang para español (Cuba)
        xml += `    <xhtml:link rel="alternate" hreflang="es-CU" href="${BASE_URL}${page.url}" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${page.url}" />\n`;
        xml += '  </url>\n';
    });

    xml += '</urlset>\n';

    const outputPath = path.join(__dirname, '..', 'sitemap.xml');
    fs.writeFileSync(outputPath, xml, 'utf8');
    console.log(`✅ sitemap.xml generado en ${outputPath}`);
    console.log(`   ${STATIC_PAGES.length} páginas incluidas`);
}

function generateRobots() {
    const robots = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml

# Disallow private/admin areas
Disallow: /admin.html
Disallow: /scripts/
Disallow: /.agents/
Disallow: /.opencode/
`;

    const outputPath = path.join(__dirname, '..', 'robots.txt');
    fs.writeFileSync(outputPath, robots, 'utf8');
    console.log(`✅ robots.txt generado en ${outputPath}`);
}

if (require.main === module) {
    generateSitemap();
    generateRobots();
    console.log('\n✅ Generación completada');
}