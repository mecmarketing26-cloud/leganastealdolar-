# ¿Le Ganaste al Dólar? — Brief del proyecto

## Qué es

Calculadora financiera para público latinoamericano que responde la pregunta:
**¿Mi ahorro o inversión realmente le ganó a la inflación del dólar?**

Compara propiedades, Bitcoin, ETF S&P 500 (VOO), oro, dólar en el colchón, plazo fijo y vehículos contra la inflación histórica del USD usando datos reales.

El objetivo principal es la conversión a **links de afiliados** de plataformas cripto y financieras.

---

## Archivos del proyecto

```
leganastealdolar/
├── index.html        ← La web completa (un solo archivo)
└── README.md         ← Este archivo
```

**No necesitás más archivos para que funcione.** Todo el CSS, JavaScript y lógica está dentro de `index.html`.

---

## APIs conectadas

| API | Qué hace | Key necesaria | Gratis |
|-----|----------|---------------|--------|
| **CoinGecko** | Precio actual BTC, ETH, Oro | No | ✅ |
| **FRED (Federal Reserve)** | Inflación USD histórica (CPI) | No | ✅ |
| **FMP (Financial Modeling Prep)** | Precio actual VOO (ETF S&P 500) | Sí — gratuita | ✅ |
| **FreeGoldAPI** | Precio histórico oro (futuro) | No | ✅ |

### Cómo obtener la key de FMP (5 minutos)

1. Ir a [financialmodelingprep.com](https://site.financialmodelingprep.com/developer/docs)
2. Registrarse con email (gratis)
3. Verificar email → copiar la API key del dashboard
4. En `index.html`, buscar `TU_KEY_FMP` y reemplazarlo con tu key
5. Límite gratuito: 250 requests/día — más que suficiente

---

## Cómo publicar la web (gratis, en 2 minutos)

### Opción A — Netlify Drop (recomendada, sin cuenta)
1. Ir a [netlify.com/drop](https://netlify.com/drop)
2. Arrastrar `index.html` a la página
3. Listo — URL pública instantánea (ej: `algo-random.netlify.app`)

### Opción B — GitHub Pages (para tener URL propia tipo `tuusuario.github.io`)
1. Crear cuenta en [github.com](https://github.com)
2. Crear repositorio nuevo, subir `index.html`
3. Settings → Pages → Source: main branch
4. URL lista en ~1 minuto

### Opción C — Dominio propio
1. Comprar dominio en Namecheap o Cloudflare (~$10/año)
2. Configurar DNS apuntando a Netlify o GitHub Pages
3. HTTPS automático y gratuito

---

## Links de afiliados — cómo configurarlos

En `index.html` buscá los siguientes placeholders y reemplazalos con tus links reales:

```
TU_LINK_LEMON      → Lemon Cash programa de referidos
TU_LINK_BINANCE    → Binance programa de referidos
TU_LINK_RIPIO      → Ripio programa de referidos
TU_LINK_BITSO      → Bitso programa de referidos
TU_LINK_WISE       → Wise programa de referidos
TU_LINK_BELO       → Belo programa de referidos
```

### Cómo encontrar los programas de afiliados

| Plataforma | Link al programa |
|-----------|-----------------|
| Lemon Cash | lemon.me/referidos |
| Binance | binance.com/activity/referral |
| Ripio | ripio.com/referidos |
| Bitso | bitso.com/referidos |
| Wise | wise.com/refer |
| Belo | belo.app/referidos |

---

## Datos hardcodeados — ¿qué necesita actualizarse?

Estos datos están fijos en el código y habría que actualizarlos manualmente cada año o cuando cambien mucho:

| Dato | Frecuencia de actualización |
|------|-----------------------------|
| Precios históricos S&P 500 / VOO | Anual (cierre diciembre) |
| Precios históricos Bitcoin | Anual (cierre diciembre) |
| Precios históricos Oro | Anual (promedio diciembre) |
| CPI histórico (inflación USD) | Casi nunca cambia para años pasados |

Búscalos en `index.html` dentro del objeto `PRICE_HISTORY` y el array `CPI`.

---

## Futuras mejoras posibles

- [ ] Conectar CryptoCompare API para precios cripto históricos en tiempo real (gratis con key)
- [ ] Agregar más activos: ETH, SOL, real estate index USA
- [ ] Newsletter / Substack integrado
- [ ] Página separada de referidos estilo impuestito.org/referidos
- [ ] Modo oscuro
- [ ] Compartir resultado en redes sociales con imagen generada

---

## Stack técnico

- **HTML + CSS + JavaScript** puro — sin frameworks, sin dependencias externas
- **Fuente:** Plus Jakarta Sans (Google Fonts)
- **Despliegue:** cualquier hosting estático (Netlify, GitHub Pages, Vercel)
- **Compatibilidad:** todos los browsers modernos, mobile-first

---

*Datos de inflación: BLS/FRED — No constituye asesoramiento financiero.*
