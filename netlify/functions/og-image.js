// netlify/functions/og-image.js
// Dynamic OG image generation per calculator result
// Uses @resvg/resvg-js to render SVG → PNG

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const activo = params.activo || 'btc';
  const desde = params.desde || '2020';
  const monto = params.monto || '1000';
  const resultado = params.resultado || null;
  const ganancia = params.ganancia || null;

  // Asset display names
  const ASSET_NAMES = {
    btc: 'Bitcoin',
    eth: 'Ethereum',
    sp500: 'S&P 500',
    gold: 'Oro',
  };
  const assetName = ASSET_NAMES[activo] || activo.toUpperCase();

  // Determine color and sign based on result
  let resultColor = '#a3e635'; // green
  let resultText = '';
  let subtitle = '';

  if (resultado !== null) {
    const numResult = parseFloat(resultado);
    if (!isNaN(numResult)) {
      if (numResult < 0) {
        resultColor = '#f87171'; // red
        resultText = `${numResult.toFixed(1)}%`;
      } else {
        resultColor = '#a3e635'; // green
        resultText = `+${numResult.toFixed(1)}%`;
      }
    }
  }

  if (ganancia !== null) {
    const numGanancia = parseFloat(ganancia);
    if (!isNaN(numGanancia) && numGanancia !== 0) {
      const sign = numGanancia > 0 ? '+' : '';
      subtitle = `$${monto} → $${sign}${numGanancia.toFixed(0)} USD reales`;
    }
  }

  if (!resultText) {
    resultText = assetName;
    subtitle = `Desde ${desde} · $${monto} USD`;
  }

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#111111;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- Top accent bar -->
  <rect width="1200" height="4" fill="${resultColor}" />

  <!-- Logo / Site name -->
  <text x="60" y="80" font-family="'Helvetica Neue', Arial, sans-serif" font-size="22" font-weight="700" fill="#888888" letter-spacing="2">LEGANASTEALDOLAR.COM</text>

  <!-- Main headline -->
  <text x="60" y="200" font-family="'Helvetica Neue', Arial, sans-serif" font-size="52" font-weight="700" fill="#ffffff">¿Le ganaste al dólar</text>
  <text x="60" y="265" font-family="'Helvetica Neue', Arial, sans-serif" font-size="52" font-weight="700" fill="#ffffff">con ${assetName}?</text>

  <!-- Asset + period label -->
  <text x="60" y="340" font-family="'Helvetica Neue', Arial, sans-serif" font-size="26" fill="#888888">Desde ${desde} · $${monto} USD invertidos</text>

  <!-- Result value -->
  <text x="60" y="460" font-family="'Helvetica Neue', Arial, sans-serif" font-size="110" font-weight="900" fill="${resultColor}">${resultText}</text>

  <!-- Subtitle (real gain amount) -->
  ${subtitle ? `<text x="60" y="535" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28" fill="#888888">${subtitle}</text>` : ''}

  <!-- Bottom CTA -->
  <text x="60" y="600" font-family="'Helvetica Neue', Arial, sans-serif" font-size="22" fill="#555555">Calculá el tuyo en leganastealdolar.com</text>

  <!-- Decorative right element -->
  <circle cx="1050" cy="315" r="180" fill="${resultColor}" fill-opacity="0.05" />
  <circle cx="1050" cy="315" r="120" fill="${resultColor}" fill-opacity="0.05" />
</svg>`;

  try {
    const { Resvg } = require('@resvg/resvg-js');
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1200 },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
      body: pngBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('og-image error:', err);
    // Fallback: return SVG as-is
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
      body: svg,
    };
  }
};
