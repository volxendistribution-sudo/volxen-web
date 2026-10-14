const fs = require('fs');
const path = require('path');
const https = require('https');
const { subset } = require('fonttools');

// Characters actually used in the project (Latin + Spanish + numbers + common punctuation)
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚáéíóúÑñ0123456789.,:;¡!¿?()[]{}<>/\\|@#$%&*+-=_~"\' ';

// Download font from Google Fonts
function downloadFont(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, response => {
            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', err => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function downloadFonts() {
    const fontsDir = path.join(__dirname, 'public', 'fonts');
    if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });

    // DM Sans - weights 400, 500, 600, 700
    const dmSansWeights = [400, 500, 600, 700];
    for (const weight of dmSansWeights) {
        const url = `https://fonts.gstatic.com/s/dmsans/v16/rP2Hp2ywxg089UriCZOIHTE.ttf`; // This is a simplified approach
        await downloadFont(url, path.join(fontsDir, `DM-Sans-${weight}.woff2`));
    }

    // Inter Tight - weights 300, 400, 500, 600
    const interTightWeights = [300, 400, 500, 600];
    for (const weight of interTightWeights) {
        // Download from Google Fonts
    }
}

downloadFonts().catch(console.error);
