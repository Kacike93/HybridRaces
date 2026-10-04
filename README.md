# Calendario Hybrid & OCR España

Web estática con el calendario de carreras híbridas y de obstáculos en España: HYROX, Spartan, DEKA, ATHX, Hyatlón y OCR / híbridas nacionales, con enlace a la web de cada prueba.

- `index.html` — la web (sin build, sin dependencias).
- `data/races.json` — los datos. Editarlo y hacer commit basta para actualizar la web.
- `scripts/update-races.mjs` — actualización automática con la API de Claude (búsqueda web).
- `.github/workflows/update-races.yml` — lo ejecuta cada día y hace commit si hay cambios. Cloudflare Pages vuelve a publicar solo.

## Publicar en Cloudflare Pages

1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
2. Autoriza GitHub y elige este repositorio.
3. Framework preset: **None**. Build command: *(vacío)*. Build output directory: `/`.
4. **Save and Deploy**. La web queda en `https://<proyecto>.pages.dev` (puedes añadir un dominio propio en *Custom domains*).

## Activar la actualización diaria

1. Crea una API key en https://console.anthropic.com (coste aproximado: unos céntimos por ejecución).
2. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**: `ANTHROPIC_API_KEY`.
3. Opcional: variable `CLAUDE_MODEL` para fijar un modelo concreto (por defecto usa el Sonnet más reciente).
4. Pruébalo en **Actions → Actualizar calendario → Run workflow**.

Sin la API key el workflow solo elimina las pruebas que terminaron hace más de 60 días.

## Formato de cada prueba

```json
{ "id": "hyrox-madrid-2027", "name": "HYROX Madrid", "cat": "hyrox",
  "start": "2027-03-17", "end": "2027-03-21", "city": "Madrid",
  "region": "Comunidad de Madrid", "url": "https://hyrox.es/eventos/hyrox-madrid-26-27/",
  "formats": "Individual · Doubles · Relay", "note": "" }
```

`cat`: `hyrox`, `deka`, `athx`, `hyatlon`, `hybrid` (híbrida nacional), `spartan`, `ocr` (OCR nacional).
