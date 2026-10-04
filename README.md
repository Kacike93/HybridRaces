# HybridRaceMap

**Descubre. Compite. Supera. Tu próximo reto empieza aquí.**

Calendario y mapa de carreras híbridas y de obstáculos en España (HYROX, DEKA, Spartan, ATHX, Hyatlón, híbridas y OCR nacionales) — [hybridracemap.com](https://hybridracemap.com).

Web estática sin dependencias: `scripts/build.mjs` genera ~100 páginas en `dist/` a partir de `data/races.json`.

## Estructura

| Ruta | Qué es |
| --- | --- |
| `data/races.json` | Los datos. Editarlo y hacer commit basta para actualizar la web. |
| `scripts/build.mjs` | Genera `dist/`: portada, fichas `/carreras/<id>/` (schema SportsEvent + .ics), páginas por formato, `/comunidad/<region>/`, `/calendario/<mes-año>/`, `sitemap.xml`, `robots.txt`, `404.html`. |
| `src/styles.css`, `src/app.js` | Estilos e interacción (filtros, vista mes, mapa Leaflet + CARTO dark, cuentas atrás). |
| `static/` | Iconos, `og.png`, `site.webmanifest`, `_headers` (Cloudflare). |
| `scripts/update-races.mjs` | Valida `data/races.json` y borra las pruebas terminadas hace más de 60 días (con `ANTHROPIC_API_KEY` también busca novedades vía API, opcional). |

Probar en local: `node scripts/build.mjs` y abrir `dist/` con cualquier servidor estático (`npx serve dist`).

## Publicar en Cloudflare Pages

1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** y elige este repositorio.
2. Framework preset: **None** · Build command: `node scripts/build.mjs` · Build output directory: `dist`.
3. **Save and Deploy**. Después, en *Custom domains*, añade `hybridracemap.com`.

## Actualización automática (gratis, con la suscripción de Claude)

Una **tarea programada de Claude** con acceso a este repositorio busca pruebas nuevas en las fuentes oficiales, actualiza `data/races.json` y hace commit **solo si hay cambios**. Cloudflare Pages detecta el commit y vuelve a publicar la web. No hace falta API key ni GitHub Actions.

- Busca siempre los **próximos 15 meses** (sin años fijos), así que sigue funcionando en 2027, 2028…
- Borra las pruebas terminadas hace más de 60 días.
- Las instrucciones de la tarea están en `TAREA-PROGRAMADA.md`.

## Formato de cada prueba

```json
{ "id": "hyrox-madrid-2027", "name": "HYROX Madrid", "cat": "hyrox",
  "start": "2027-03-17", "end": "2027-03-21", "city": "Madrid",
  "region": "Comunidad de Madrid", "url": "https://hyrox.es/eventos/hyrox-madrid-26-27/",
  "formats": "Individual · Doubles · Relay", "note": "", "lat": 40.417, "lng": -3.704 }
```

`cat`: `hyrox`, `deka`, `athx`, `hyatlon`, `hybrid` (híbrida nacional), `spartan`, `ocr` (OCR nacional).

**Regla de enlaces:** web oficial > inscripción oficial > Instagram. Nunca agregadores ni calendarios de terceros.
