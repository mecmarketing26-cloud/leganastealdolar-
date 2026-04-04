const https = require('https');

const FRED_KEY   = process.env.FRED_API_KEY;
const FMP_KEY    = process.env.FMP_API_KEY;
const CRYPTO_KEY = process.env.CRYPTOCOMPARE_API_KEY;

function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse error: ' + data.slice(0,200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600'
  };

  // Netlify puede pasar params de distintas maneras — leemos todas
  const params = event.queryStringParameters || {};
  let type = params.type || null;
  if (!type && event.rawQuery) {
    try { type = new URLSearchParams(event.rawQuery).get('type'); } catch(e) {}
  }
  if (!type && event.rawUrl) {
    try { type = new URL(event.rawUrl).searchParams.get('type'); } catch(e) {}
  }

  // Debug logs — visibles en Netlify Functions log
  console.log('rawQuery:', event.rawQuery);
  console.log('queryStringParameters:', JSON.stringify(params));
  console.log('resolved type:', type);
  console.log('keys present — FRED:', !!process.env.FRED_API_KEY, 'FMP:', !!process.env.FMP_API_KEY, 'CRYPTO:', !!process.env.CRYPTOCOMPARE_API_KEY);

  try {

    // ── CPI HISTÓRICO (inflación USD desde 1948) ──────────────────────────
    if (type === 'cpi') {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&observation_start=1948-01-01&frequency=a&aggregation_method=avg&api_key=${FRED_KEY}&file_type=json`;
      const data = await fetchJSON(url);
      const result = {};
      (data.observations || []).forEach(obs => {
        const yr = parseInt(obs.date.slice(0,4));
        const val = parseFloat(obs.value);
        if (!isNaN(val)) result[yr] = parseFloat(val.toFixed(1));
      });
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ── S&P 500 HISTÓRICO (via FRED — serie SP500, últimos 10 años) ────────
    // + datos históricos más largos via serie MULTPL/SP500 real price
    if (type === 'sp500') {
      // FRED tiene S&P 500 solo últimos 10 años por licencia
      // Complementamos con Shiller CAPE ratio data (serie SCHILLERPE) que sí tiene histórico
      // Para precio real usamos la serie disponible
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=SP500&frequency=a&aggregation_method=eop&api_key=${FRED_KEY}&file_type=json`;
      const data = await fetchJSON(url);
      const result = {};
      (data.observations || []).forEach(obs => {
        const yr = parseInt(obs.date.slice(0,4));
        const val = parseFloat(obs.value);
        if (!isNaN(val) && obs.value !== '.') result[yr] = Math.round(val);
      });
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ── VOO PRECIO ACTUAL (FMP) ────────────────────────────────────────────
    if (type === 'voo') {
      const url = `https://financialmodelingprep.com/api/v3/quote/VOO?apikey=${FMP_KEY}`;
      const data = await fetchJSON(url);
      const q = data[0];
      if (!q) throw new Error('No VOO data');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          price:  q.price,
          change: q.changesPercentage,
          high52: q.yearHigh,
          low52:  q.yearLow
        })
      };
    }

    // ── BTC HISTÓRICO POR AÑO (CryptoCompare) ────────────────────────────
    if (type === 'btc_history') {
      const year = parseInt(event.queryStringParameters?.year);
      if (!year || year < 2010 || year > 2025) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid year' }) };
      }
      // Pedir el precio de cierre del 31 de diciembre de ese año
      const ts = Math.floor(new Date(`${year}-12-31T23:59:00Z`).getTime() / 1000);
      const url = `https://min-api.cryptocompare.com/data/pricehistorical?fsym=BTC&tsyms=USD&ts=${ts}`;
      const data = await fetchJSON(url, { Authorization: `Apikey ${CRYPTO_KEY}` });
      const price = data?.BTC?.USD;
      if (!price) throw new Error('No BTC price for ' + year);
      return { statusCode: 200, headers, body: JSON.stringify({ year, price: Math.round(price) }) };
    }

    // ── BTC TODOS LOS AÑOS DE UNA (más eficiente — 1 request) ────────────
    if (type === 'btc_all') {
      // Trae datos diarios históricos de BTC, tomamos cierre de cada diciembre
      // CryptoCompare permite hasta 2000 días por request
      const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=2000&toTs=${Math.floor(Date.now()/1000)}`;
      const data = await fetchJSON(url, { Authorization: `Apikey ${CRYPTO_KEY}` });
      const days = data?.Data?.Data || [];
      const result = {};
      days.forEach(d => {
        const date = new Date(d.time * 1000);
        const yr   = date.getFullYear();
        const mo   = date.getMonth(); // 11 = diciembre
        if (mo === 11) {
          // Guardar el último precio de diciembre para cada año
          if (!result[yr] || date > new Date(result[yr].time * 1000)) {
            result[yr] = Math.round(d.close);
          }
        }
      });
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ── ORO HISTÓRICO (FreeGoldAPI — CORS abierto, no necesita pasar por acá) ──
    // Este endpoint existe por si querés centralizar todo
    if (type === 'gold_history') {
      const data = await fetchJSON('https://freegoldapi.com/data/latest.json');
      const result = {};
      data.forEach(d => {
        const yr = parseInt(d.date?.slice(0,4));
        if (yr >= 1970 && d.price > 0) {
          result[yr] = Math.round(d.price);
        }
      });
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ── TODOS LOS DATOS DE UNA (para cargar la web más rápido) ────────────
    if (type === 'all') {
      const [cpiData, vooData, btcData] = await Promise.allSettled([
        fetchJSON(`https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&observation_start=1948-01-01&frequency=a&aggregation_method=avg&api_key=${FRED_KEY}&file_type=json`),
        fetchJSON(`https://financialmodelingprep.com/api/v3/quote/VOO?apikey=${FMP_KEY}`),
        fetchJSON(`https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=2000`, { Authorization: `Apikey ${CRYPTO_KEY}` }),
      ]);

      // CPI
      const cpi = {};
      if (cpiData.status === 'fulfilled') {
        (cpiData.value.observations || []).forEach(obs => {
          const yr = parseInt(obs.date.slice(0,4));
          const val = parseFloat(obs.value);
          if (!isNaN(val) && obs.value !== '.') cpi[yr] = parseFloat(val.toFixed(1));
        });
      }

      // VOO
      let voo = null;
      if (vooData.status === 'fulfilled' && vooData.value[0]) {
        const q = vooData.value[0];
        voo = { price: q.price, change: q.changesPercentage };
      }

      // BTC histórico diciembre por año
      const btc = {};
      if (btcData.status === 'fulfilled') {
        const days = btcData.value?.Data?.Data || [];
        days.forEach(d => {
          const date = new Date(d.time * 1000);
          const yr   = date.getFullYear();
          const mo   = date.getMonth();
          if (mo === 11) btc[yr] = Math.round(d.close);
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ cpi, voo, btc })
      };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown type: ' + type }) };

  } catch(err) {
    console.error('market-data error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
