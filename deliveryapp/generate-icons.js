// Generate placeholder PNG icons for the PWA manifest
// Run: node generate-icons.js
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = path.join(__dirname, 'assets', 'icons');

// Minimal 1x1 purple PNG header + create proper canvas-based PNGs
// For production, replace these with a proper designed icon

function createMinimalPng(size) {
  // This creates a basic HTML file you can screenshot, 
  // OR use an online tool to convert icon.svg to PNGs
  // For now, create placeholder files
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size*0.15)}" fill="#3E1A6E"/>
  <text x="${size/2}" y="${size*0.4}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="${Math.round(size*0.2)}" fill="#FFFFFF">Damn</text>
  <text x="${size/2}" y="${size*0.63}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="${Math.round(size*0.2)}" fill="#F59E0B">Deal</text>
  <text x="${size/2}" y="${size*0.82}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="600" font-size="${Math.round(size*0.1)}" fill="rgba(255,255,255,0.7)">Delivery</text>
</svg>`;

  fs.writeFileSync(path.join(outDir, `icon-${size}.svg`), svgContent);
  console.log(`Created icon-${size}.svg`);
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

sizes.forEach(s => createMinimalPng(s));

console.log(`\n✅ SVG icons generated in ${outDir}`);
console.log('\n📌 To convert to PNG for production, use one of these:');
console.log('   1. https://realfavicongenerator.net (upload icon.svg)');
console.log('   2. npx sharp-cli -i assets/icons/icon.svg -o assets/icons/icon-{width}.png resize {width}');
console.log('   3. Use Figma/Canva to export at each size');
