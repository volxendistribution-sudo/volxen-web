#!/usr/bin/env node
/**
 * Genera sitemap.xml dinámico para VOLXEN
 * Fetch productos y categorías desde Supabase
 * Uso: node scripts/generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://volxen.com';
const SUPABASE_URL = 'https://zyszkujnpbievjapsuyy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DZXsStzrMhh0wen8Cvh_Nw_K1ckciJa';

const STATIC_PAGES = [
    { url: '/', changefreq: 'weekly', priority: 1.0 },
    { url: '/catalogo.html', changefreq: 'daily', priority: 0.9 },
    { url: '/producto.html', changefreq: 'weekly', priority: 0.8 },
    { url: '/carrito.html', changefreq: 'monthly', priority: 0.5 },
    { url: '/checkout.html', changefreq: 'monthly', priority: 0.5 },
    { url: '/pedidos.html', changefreq: 'monthly', priority: 0.5 },
];

async function fetchFromSupabase(endpoint) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
    });
    if (!response.ok) {
        throw new Error(`Supabase error ${response.status}: ${await response.text()}`);
    }
    return response.json();
}

async function generateDynamicUrls() {
    const today = new Date().toISOString().split('T')[0];
    const urls = [];

    try {
        // Fetch categorías (sin filtro activo, usar created_at)
        const categorias = await fetchFromSupabase('categorias?select=id,nombre,created_at&order=orden');
        for (const cat of categorias) {
            urls.push({
                url: `/catalogo.html?cat=${encodeURIComponent(cat.id)}`,
                lastmod: cat.created_at ? cat.created_at.split('T')[0] : today,
                changefreq: 'weekly',
                priority: 0.7
            });
        }
        console.log(`✅ ${categorias.length} categorías cargadas`);

        // Fetch productos (usar created_at, ordenar por fecha desc)
        const productos = await fetchFromSupabase('productos?select=id,nombre,created_at&order=created_at.desc');
        for (const prod of productos) {
            urls.push({
                url: `/producto.html?id=${encodeURIComponent(prod.id)}`,
                lastmod: prod.created_at ? prod.created_at.split('T')[0] : today,
                changefreq: 'weekly',
                priority: 0.8
            });
        }
        console.log(`✅ ${productos.length} productos cargados`);

    } catch (error) {
        console.warn(`⚠️ Error fetching dynamic URLs: ${error.message}`);
        console.warn('   Usando solo páginas estáticas');
    }

    return urls;
}

function generateSitemap(dynamicUrls = []) {
    const today = new Date().toISOString().split('T')[0];
    const allUrls = [...STATIC_PAGES, ...dynamicUrls];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ';
    xml += 'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

    allUrls.forEach(page => {
        xml += '  <url>\n';
        xml += `    <loc>${BASE_URL}${page.url}</loc>\n`;
        xml += `    <lastmod>${page.lastmod || today}</lastmod>\n`;
        xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
        xml += `    <priority>${page.priority}</priority>\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="es-CU" href="${BASE_URL}${page.url}" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${page.url}" />\n`;
        xml += '  </url>\n';
    });

    xml += '</urlset>\n';

    const outputPath = path.join(__dirname, '..', 'sitemap.xml');
    fs.writeFileSync(outputPath, xml, 'utf8');
    console.log(`✅ sitemap.xml generado en ${outputPath}`);
    console.log(`   ${allUrls.length} páginas totales (${STATIC_PAGES.length} estáticas + ${dynamicUrls.length} dinámicas)`);
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

async function main() {
    try {
        const dynamicUrls = await generateDynamicUrls();
        generateSitemap(dynamicUrls);
        generateRobots();
        console.log('\n✅ Generación completada exitosamente');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}