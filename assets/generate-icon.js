const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

// Load from local assets/agy-official-icon.svg relative path
const ideSvgPath = path.join(__dirname, 'agy-official-icon.svg');
let base64Uri = '';

if (fs.existsSync(ideSvgPath)) {
  const svgRaw = fs.readFileSync(ideSvgPath, 'utf8');
  const match = svgRaw.match(/xlink:href="data:image\/png;base64,([^"]+)"/);
  if (match) {
    base64Uri = `data:image/png;base64,${match[1]}`;
  }
}

const mainSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <!-- Rainbow Bar Gradient -->
    <linearGradient id="rainbowBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4285F4" />
      <stop offset="30%" stop-color="#34A853" />
      <stop offset="65%" stop-color="#FBBC05" />
      <stop offset="100%" stop-color="#EA4335" />
    </linearGradient>
  </defs>

  <!-- === TOP CENTER: OFFICIAL ANTIGRAVITY IDE LOGO (TRANSPARENT BG) === -->
  <g transform="translate(28, 8)">
    <image width="200" height="184" preserveAspectRatio="xMidYMid meet" xlink:href="${base64Uri}" />
  </g>

  <!-- === BOTTOM BAR WITH PERCENTAGE === -->
  <!-- Bar Track (Background) -->
  <rect x="18" y="204" width="156" height="24" rx="12" fill="#1e222d" stroke="#3b4252" stroke-width="2" />

  <!-- Rainbow Bar Fill (85% = 132px) -->
  <rect x="20" y="206" width="132" height="20" rx="10" fill="url(#rainbowBar)" />

  <!-- Node dot on Bar Head -->
  <circle cx="152" cy="216" r="6" fill="#ffffff" />
  <circle cx="152" cy="216" r="10" fill="#EA4335" fill-opacity="0.4" />

  <!-- Percentage Text (Right of Bar) -->
  <text x="240" y="223" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#38bdf8">85%</text>
</svg>`;

const resvg = new Resvg(mainSvg, {
  fitTo: { mode: 'width', value: 128 }
});

const pngData = resvg.render();
fs.writeFileSync(path.join(__dirname, 'icon.png'), pngData.asPng());
console.log('Successfully generated assets/icon.png (Official Antigravity IDE Logo, 128x128)');

