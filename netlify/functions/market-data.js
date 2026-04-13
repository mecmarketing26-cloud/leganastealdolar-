// Uses global fetch (Node 18+) — no require('https') needed
//
// Variables de entorno requeridas en Netlify:
//   FRED_API_KEY          → api.stlouisfed.org (gratis, sin tarjeta)
//   FINNHUB_API_KEY       → finnhub.io         (gratis, sin tarjeta) — reemplaza FMP
//   CRYPTOCOMPARE_API_KEY → cryptocompare.com  (gratis, sin tarjeta)
//   GOLD_API_KEY          → gold-api.com       (gratis, sin tarjeta) — oro real-time

const FRED_KEY        = process.env.FRED_API_KEY;
const FINNHUB_KEY     = process.env.FINNHUB_API_KEY;
const CRYPTO_KEY      = process.env.CRYPTOCOMPARE_API_KEY;
const GOLD_KEY        = process.env.GOLD_API_KEY;
const COINGECKO_KEY   = process.env.COINGECKO_API_KEY; // opcional — demo key gratuita

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
    '| keys: FRED=%s FINNHUB=%s CRYPTO=%s GOLD=%s',
    !!FRED_KEY, !!FINNHUB_KEY, !!CRYPTO_KEY, !!GOLD_KEY);

  if (!FRED_KEY || !FINNHUB_KEY || !CRYPTO_KEY || !GOLD_KEY) {
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

    // ── VOO PRECIO ACTUAL (Finnhub) ───────────────────────────────────
    // Reemplaza FMP — endpoint gratuito, CORS ok desde Netlify Functions
    if (type === 'voo') {
      if (!FINNHUB_KEY) throw new Error('FINNHUB_API_KEY no configurada');
      const url = `https://finnhub.io/api/v1/quote?symbol=VOO&token=${FINNHUB_KEY}`;
      const data = await fetchJSON(url);
      // Finnhub devuelve: { c: precio actual, dp: % cambio, h: max día, l: min día, o: apertura, pc: cierre anterior }
      if (!data || data.c == null || data.c === 0) throw new Error('Finnhub no devolvió precio de VOO: ' + JSON.stringify(data).slice(0, 200));
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          price:  data.c,    // current price
          change: data.dp,   // % change
          high:   data.h,    // high of day
          low:    data.l,    // low of day
          prev:   data.pc    // previous close
        })
      };
    }

    // ── ORO PRECIO ACTUAL (gold-api.com) ─────────────────────────────
    // gold-api.com: gratis con key, devuelve precio spot en USD/oz
    if (type === 'gold_price') {
      if (!GOLD_KEY) throw new Error('GOLD_API_KEY no configurada');
      const data = await fetchJSON('https://gold-api.com/price/XAU', {
        'x-access-token': GOLD_KEY
      });
      // Respuesta: { price: 2350.50, currency: "USD", ... }
      if (!data || !data.price) throw new Error('gold-api.com no devolvió precio: ' + JSON.stringify(data).slice(0, 200));
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          price: data.price,
          currency: data.currency || 'USD'
        })
      };
    }

    // ── BTC TODOS LOS AÑOS DE UNA (1 request, diciembre de cada año) ──
    if (type === 'btc_all') {
      if (!CRYPTO_KEY) throw new Error('CRYPTOCOMPARE_API_KEY no configurada');
      // allData=true en v1 devuelve todo el historial desde 2010 (vs limit=2000 días ≈ solo 2020+)
      const url = `https://min-api.cryptocompare.com/data/histoday?fsym=BTC&tsym=USD&allData=true`;
      const data = await fetchJSON(url, { Authorization: `Apikey ${CRYPTO_KEY}` });
      const days = data?.Data;
      if (!days || days.length === 0) throw new Error('CryptoCompare no devolvió datos históricos');
      const result = {};
      days.forEach(d => {
        const date = new Date(d.time * 1000);
        if (date.getMonth() === 11) { // 11 = diciembre
          result[date.getFullYear()] = Math.round(d.close);
        }
      });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
    }

    // ── ORO HISTÓRICO (FreeGoldAPI) ───────────────────────────────────
    // Sin key, data anual desde 1970, CORS habilitado
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

    // ── CRYPTO LIVE (BTC, ETH, Oro spot — proxea CoinGecko server-side) ─
    if (type === 'crypto') {
      const cgHeaders = COINGECKO_KEY ? { 'x-cg-demo-api-key': COINGECKO_KEY } : {};
      const data = await fetchJSON(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,pax-gold&vs_currencies=usd&include_24hr_change=true',
        cgHeaders
      );
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          btc:   data.bitcoin?.usd         ?? null,
          btcC:  data.bitcoin?.usd_24h_change ?? null,
          eth:   data.ethereum?.usd        ?? null,
          ethC:  data.ethereum?.usd_24h_change ?? null,
          gold:  data['pax-gold']?.usd     ?? null,
          goldC: data['pax-gold']?.usd_24h_change ?? null,
        })
      };
    }

    // ── TODOS LOS DATOS DE UNA (para cargar la web en 1 round-trip) ──
    if (type === 'all') {
      const [cpiRes, vooRes, btcRes, goldHistRes, goldPriceRes] = await Promise.allSettled([

        // CPI histórico (FRED)
        FRED_KEY
          ? fetchJSON(`https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&observation_start=1948-01-01&frequency=a&aggregation_method=avg&api_key=${FRED_KEY}&file_type=json`)
          : Promise.reject(new Error('FRED_API_KEY no configurada')),

        // VOO precio actual (Finnhub) — reemplaza FMP
        FINNHUB_KEY
          ? fetchJSON(`https://finnhub.io/api/v1/quote?symbol=VOO&token=${FINNHUB_KEY}`)
          : Promise.reject(new Error('FINNHUB_API_KEY no configurada')),

        // BTC histórico (CryptoCompare) — allData=true da historia completa desde 2010
        CRYPTO_KEY
          ? fetchJSON(`https://min-api.cryptocompare.com/data/histoday?fsym=BTC&tsym=USD&allData=true`, { Authorization: `Apikey ${CRYPTO_KEY}` })
          : Promise.reject(new Error('CRYPTOCOMPARE_API_KEY no configurada')),

        // Oro histórico (FreeGoldAPI, sin key)
        fetchJSON('https://freegoldapi.com/data/latest.json').catch(() => null),

        // Oro precio actual (gold-api.com)
        GOLD_KEY
          ? fetchJSON('https://gold-api.com/price/XAU', { 'x-access-token': GOLD_KEY })
          : Promise.reject(new Error('GOLD_API_KEY no configurada')),
      ]);

      // ── CPI
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

      // ── VOO (Finnhub)
      let voo = null;
      if (vooRes.status === 'fulfilled') {
        const d = vooRes.value;
        if (d?.c && d.c > 0) {
          voo = { price: d.c, change: d.dp, prev: d.pc };
        } else {
          console.error('VOO: respuesta inesperada de Finnhub', JSON.stringify(d).slice(0, 200));
        }
      } else {
        console.error('VOO fetch failed:', vooRes.reason?.message);
      }

      // ── BTC histórico diciembre por año (v1 allData → data.Data es array directo)
      const btc = {};
      if (btcRes.status === 'fulfilled') {
        const days = btcRes.value?.Data || [];
        days.forEach(d => {
          const date = new Date(d.time * 1000);
          if (date.getMonth() === 11) {
            btc[date.getFullYear()] = Math.round(d.close);
          }
        });
      } else {
        console.error('BTC fetch failed:', btcRes.reason?.message);
      }

      // ── Oro histórico
      const gold = {};
      if (goldHistRes.status === 'fulfilled' && Array.isArray(goldHistRes.value)) {
        goldHistRes.value.forEach(d => {
          const yr = parseInt(d.date?.slice(0, 4));
          if (yr >= 1970 && d.price > 0) gold[yr] = Math.round(d.price);
        });
      } else {
        console.error('Gold history fetch failed:', goldHistRes.reason?.message);
      }

      // ── Oro precio actual
      let goldPrice = null;
      if (goldPriceRes.status === 'fulfilled' && goldPriceRes.value?.price) {
        goldPrice = goldPriceRes.value.price;
      } else {
        console.error('Gold price fetch failed:', goldPriceRes.reason?.message);
      }

      // Si CPI falló (dato crítico), indicarlo en la respuesta
      const response = { cpi, voo, btc, gold, goldPrice };
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
