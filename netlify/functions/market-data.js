// Uses global fetch (Node 18+) — no require('https') needed

const FRED_KEY   = process.env.FRED_API_KEY;
const FMP_KEY    = process.env.FMP_API_KEY;
const CRYPTO_KEY = process.env.CRYPTOCOMPARE_API_KEY;

async function fetchJSON(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('JSON parse error: ' + text.slice(0, 200));
    }
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600'
  };

  // Leer el parámetro type desde todas las formas posibles en Netlify
  const params = event.queryStringParameters || {};
  let type = params.type || null;
  if (!type && event.rawQuery) {
    try { type = new URLSearchParams(event.rawQuery).get('type'); } catch (e) {}
  }
  if (!type && event.rawUrl) {
    try { type = new URL(event.rawUrl).searchParams.get('type'); } catch (e) {}
  }

  console.log('market-data called — type:', type,
    '| keys: FRED=%s FMP=%s CRYPTO=%s',
    !!FRED_KEY, !!FMP_KEY, !!CRYPTO_KEY);

  if (!FRED_KEY || !FMP_KEY || !CRYPTO_KEY) {
    console.error('Una o más API keys no están configuradas en variables de entorno de Netlify');
  }

  try {

    // ── CPI HISTÓRICO (inflación USD desde 1948) ──────────────────────
    if (type === 'cpi') {
      if (!FRED_KEY) throw new Error('FRED_API_KEY no configurada');
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&observation_start=1948-01-01&frequency=a&aggregation_method=avg&api_key=${FRED_KEY}&file_type=json`;
      const data = await fetchJSON(url);
      if (!data.observations) throw new Error('FRED no devolvió observaciones: ' + JSON.stringify(data).slice(0, 200));
      const result = {};
      data.observations.forEach(obs => {
        const yr = parseInt(obs.date.slice(0, 4));
        const val = parseFloat(obs.value);
        if (!isNaN(val) && obs.value !== '.') result[yr] = parseFloat(val.toFixed(1));
      });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
    }

    // ── S&P 500 HISTÓRICO (via FRED) ──────────────────────────────────
    if (type === 'sp500') {
      if (!FRED_KEY) throw new Error('FRED_API_KEY no configurada');
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=SP500&frequency=a&aggregation_method=eop&api_key=${FRED_KEY}&file_type=json`;
      const data = await fetchJSON(url);
      if (!data.observations) throw new Error('FRED SP500 sin observaciones');
      const result = {};
      data.observations.forEach(obs => {
        const yr = parseInt(obs.date.slice(0, 4));
        const val = parseFloat(obs.value);
        if (!isNaN(val) && obs.value !== '.') result[yr] = Math.round(val);
      });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
    }

    // ── VOO PRECIO ACTUAL (FMP) ────────────────────────────────────────
    if (type === 'voo') {
      if (!FMP_KEY) throw new Error('FMP_API_KEY no configurada');
      const url = `https://financialmodelingprep.com/api/v3/quote/VOO?apikey=${FMP_KEY}`;
      const data = await fetchJSON(url);
      const q = Array.isArray(data) ? data[0] : null;
      if (!q || !q.price) throw new Error('FMP no devolvió precio de VOO');
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          price:  q.price,
          change: q.changesPercentage,
          high52: q.yearHigh,
          low52:  q.yearLow
        })
      };
    }

    // ── BTC TODOS LOS AÑOS DE UNA (1 request, diciembre de cada año) ──
    if (type === 'btc_all') {
      if (!CRYPTO_KEY) throw new Error('CRYPTOCOMPARE_API_KEY no configurada');
      const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=2000&toTs=${Math.floor(Date.now() / 1000)}`;
      const data = await fetchJSON(url, { Authorization: `Apikey ${CRYPTO_KEY}` });
      const days = data?.Data?.Data;
      if (!days || days.length === 0) throw new Error('CryptoCompare no devolvió datos históricos');
      const result = {};
      // Los datos vienen en orden cronológico — guardamos el último precio de cada diciembre
      days.forEach(d => {
        const date = new Date(d.time * 1000);
        if (date.getMonth() === 11) { // 11 = diciembre
          result[date.getFullYear()] = Math.round(d.close);
        }
      });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
    }

    // ── ORO HISTÓRICO (FreeGoldAPI) ───────────────────────────────────
    if (type === 'gold_history') {
      const data = await fetchJSON('https://freegoldapi.com/data/latest.json');
      if (!Array.isArray(data)) throw new Error('FreeGoldAPI no devolvió array');
      const result = {};
      data.forEach(d => {
        const yr = parseInt(d.date?.slice(0, 4));
        if (yr >= 1970 && d.price > 0) result[yr] = Math.round(d.price);
      });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
    }

    // ── TODOS LOS DATOS DE UNA (para cargar la web en 1 round-trip) ──
    if (type === 'all') {
      const [cpiRes, vooRes, btcRes, goldRes] = await Promise.allSettled([
        FRED_KEY
          ? fetchJSON(`https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&observation_start=1948-01-01&frequency=a&aggregation_method=avg&api_key=${FRED_KEY}&file_type=json`)
          : Promise.reject(new Error('FRED_API_KEY no configurada')),
        FMP_KEY
          ? fetchJSON(`https://financialmodelingprep.com/api/v3/quote/VOO?apikey=${FMP_KEY}`)
          : Promise.reject(new Error('FMP_API_KEY no configurada')),
        CRYPTO_KEY
          ? fetchJSON(`https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=2000&toTs=${Math.floor(Date.now() / 1000)}`, { Authorization: `Apikey ${CRYPTO_KEY}` })
          : Promise.reject(new Error('CRYPTOCOMPARE_API_KEY no configurada')),
        fetchJSON('https://freegoldapi.com/data/latest.json').catch(e => null),
      ]);

      // CPI
      const cpi = {};
      let cpiError = null;
      if (cpiRes.status === 'fulfilled' && cpiRes.value?.observations) {
        cpiRes.value.observations.forEach(obs => {
          const yr = parseInt(obs.date.slice(0, 4));
          const val = parseFloat(obs.value);
          if (!isNaN(val) && obs.value !== '.') cpi[yr] = parseFloat(val.toFixed(1));
        });
      } else {
        cpiError = cpiRes.reason?.message || 'Error FRED';
        console.error('CPI fetch failed:', cpiError);
      }

      // VOO
      let voo = null;
      if (vooRes.status === 'fulfilled') {
        const q = Array.isArray(vooRes.value) ? vooRes.value[0] : null;
        if (q?.price) voo = { price: q.price, change: q.changesPercentage };
        else console.error('VOO: respuesta inesperada de FMP');
      } else {
        console.error('VOO fetch failed:', vooRes.reason?.message);
      }

      // BTC histórico diciembre por año
      const btc = {};
      if (btcRes.status === 'fulfilled') {
        const days = btcRes.value?.Data?.Data || [];
        days.forEach(d => {
          const date = new Date(d.time * 1000);
          if (date.getMonth() === 11) {
            btc[date.getFullYear()] = Math.round(d.close);
          }
        });
      } else {
        console.error('BTC fetch failed:', btcRes.reason?.message);
      }

      // Oro histórico
      const gold = {};
      if (goldRes.status === 'fulfilled' && Array.isArray(goldRes.value)) {
        goldRes.value.forEach(d => {
          const yr = parseInt(d.date?.slice(0, 4));
          if (yr >= 1970 && d.price > 0) gold[yr] = Math.round(d.price);
        });
      }

      // Si CPI falló (dato crítico), indicarlo en la respuesta
      const response = { cpi, voo, btc, gold };
      if (cpiError) response.cpiError = cpiError;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(response)
      };
    }

    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Parámetro type inválido: ' + type })
    };

  } catch (err) {
    console.error('market-data error:', err.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    };
  }
};
