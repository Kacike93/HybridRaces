// Actualiza data/races.json buscando en la web con la API de Claude (web search + web fetch).
// Uso: ANTHROPIC_API_KEY=... node scripts/update-races.mjs
// Sin ANTHROPIC_API_KEY solo limpia las pruebas antiguas (no consulta nada).
import { readFile, writeFile } from 'node:fs/promises';

const FILE = new URL('../data/races.json', import.meta.url);
const BANNED = /hybridheroes|running\.life|gymraces|haid\.app|gotrail|finishers\.com|correrjuntos|trainerday|planomato/i;
const KEY = process.env.ANTHROPIC_API_KEY;
const API = 'https://api.anthropic.com/v1';
const CATS = ['hyrox', 'deka', 'athx', 'hyatlon', 'hybrid', 'spartan', 'ocr'];
const KEEP_PAST_DAYS = 60;

const todayMadrid = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());

const headers = {
  'x-api-key': KEY,
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'web-fetch-2025-09-10',
  'content-type': 'application/json',
};

async function pickModel() {
  if (process.env.CLAUDE_MODEL) return process.env.CLAUDE_MODEL;
  const r = await fetch(`${API}/models?limit=100`, { headers });
  if (!r.ok) throw new Error(`models ${r.status}: ${await r.text()}`);
  const { data } = await r.json();
  // El más reciente de la familia Sonnet (buen equilibrio coste/calidad).
  const m = data.find((x) => /sonnet/i.test(x.id)) || data[0];
  return m.id;
}

const addMonths = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z'));

// Coordenadas aproximadas del municipio (península, Baleares, Canarias, Ceuta y Melilla).
const inSpain = (lat, lng) => Number.isFinite(+lat) && Number.isFinite(+lng) && lat !== '' && lng !== '' &&
  +lat > 27.5 && +lat < 44 && +lng > -18.3 && +lng < 4.5;

function validate(races) {
  if (!Array.isArray(races)) throw new Error('races no es una lista');
  const ids = new Set();
  return races
    .filter((r) => {
      const ok =
        r && typeof r.id === 'string' && r.id && !ids.has(r.id) &&
        typeof r.name === 'string' && r.name &&
        CATS.includes(r.cat) && isDate(r.start) &&
        (!r.end || isDate(r.end)) &&
        typeof r.city === 'string' && typeof r.region === 'string' &&
        typeof r.url === 'string' && /^https:\/\//.test(r.url) && !BANNED.test(r.url);
      if (ok) ids.add(r.id);
      else console.warn('Descartada (formato):', JSON.stringify(r).slice(0, 160));
      return ok;
    })
    .map((r) => ({
      id: r.id, name: r.name, cat: r.cat, start: r.start,
      end: r.end && r.end >= r.start ? r.end : r.start,
      city: r.city, region: r.region, url: r.url,
      formats: r.formats || '', note: r.note || '',
      ...(inSpain(r.lat, r.lng) ? { lat: +(+r.lat).toFixed(4), lng: +(+r.lng).toFixed(4) } : {}),
    }));
}

function prune(races, today) {
  const limit = new Date(today + 'T00:00:00Z');
  limit.setUTCDate(limit.getUTCDate() - KEEP_PAST_DAYS);
  const cut = limit.toISOString().slice(0, 10);
  return races.filter((r) => (r.end || r.start) >= cut).sort((a, b) =>
    a.start.localeCompare(b.start) || a.name.localeCompare(b.name, 'es'));
}

const PROMPT = (today, current, year = +today.slice(0, 4), horizon = addMonths(today, 15)) => `Hoy es ${today} (Europe/Madrid). Mantienes el calendario de una web de carreras híbridas y de obstáculos (OCR) en ESPAÑA.

Este es el JSON actual:
\`\`\`json
${JSON.stringify(current)}
\`\`\`

Tarea:
1. Consulta las fuentes PRIMARIAS (usa web_fetch y web_search; si una falla, sigue). No uses calendarios de terceros ni buscadores de carreras (hybridheroes.es, running.life, gymraces.com, haid.app, gotrail.run, finishers.com, correrjuntos.com…), ni como fuente ni como enlace.
   a) Marcas: https://hyrox.es/eventos/ (cat "hyrox") · https://es.spartan.com/es/race/find-race (Spartan → "spartan", DEKA → "deka"; ignora eventos fuera de España) · https://athxgames.com/events (solo España, "athx") · https://hyatlon.org/ y triatlon.org (Hyatlón, "hyatlon").
   b) Circuitos y organizadores OCR / híbridos: survivor-race.com, farinatorace.es, ocrbestial.com, desafiodeguerreros.com.es, hunter-race.com, dip-badajoz.es/badajozrace, wolf race (deporticket), medieval (crono4sports), tripasioneventos.com, time2run.es.
   c) Plataformas de inscripción y cronometraje (aquí publican casi todas las pruebas pequeñas): web.rockthesport.com, deporticket.com, sportmaniacs.com, global-tempo.com, crono4sports.com, chronotrackcanarias.com, gesconchip.es, runnink.com, sinctime.com, lineadesalida.net, conxip.com, youevent.es, chipserena.es. Busca en ellas términos como "obstáculos", "OCR", "hybrid", "híbrida", "hyrox".
   d) Instagram de organizadores (búsquedas tipo "site:instagram.com carrera obstáculos <provincia> ${year}" o "hybrid race <ciudad> ${year + 1}").
   Haz búsquedas de novedades (nuevas sedes, cambios de fecha, cancelaciones) para ${year} y ${year + 1}.
   Busca pruebas de los próximos 15 meses (hasta ${horizon}). Las marcas grandes publican la temporada siguiente con meses de antelación: cuando salga, añádela entera.
2. Añade pruebas nuevas en España, corrige fechas/sedes/enlaces cambiados y elimina las canceladas. Conserva las que no puedas verificar hoy (no borres por un fallo de una fuente).
3. El enlace (url) debe ser la web oficial de la prueba; si no tiene, su página de inscripción oficial; si tampoco, su Instagram. NUNCA un calendario o buscador de terceros. NO inventes datos: si una fecha no está confirmada, no la añadas.
4. Campos: id (kebab-case único, estable: no cambies ids existentes), name, cat (${CATS.join(', ')}), start y end (YYYY-MM-DD; end = start si es un día), city, region (comunidad autónoma en español, p. ej. "Comunidad de Madrid", "Cataluña", "Canarias"), url (https), formats (texto corto, p. ej. "Sprint · Super · Beast"), note (sede u otra nota corta, o ""), lat y lng (coordenadas del municipio con 3 decimales; conserva las existentes).

Responde al final con UN bloque \`\`\`json que contenga {"races":[...]} con la lista COMPLETA actualizada, y después una línea "CAMBIOS: ..." resumiendo añadidas/modificadas/eliminadas.`;

async function askClaude(model, prompt) {
  const tools = [
    { type: 'web_search_20250305', name: 'web_search', max_uses: 12, user_location: { type: 'approximate', country: 'ES', timezone: 'Europe/Madrid' } },
    { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 15 },
  ];
  const messages = [{ role: 'user', content: prompt }];
  for (let turn = 0; turn < 8; turn++) {
    const r = await fetch(`${API}/messages`, {
      method: 'POST', headers,
      body: JSON.stringify({ model, max_tokens: 32000, tools, messages }),
    });
    if (!r.ok) throw new Error(`messages ${r.status}: ${await r.text()}`);
    const res = await r.json();
    messages.push({ role: 'assistant', content: res.content });
    if (res.stop_reason === 'pause_turn') continue; // las herramientas del servidor siguen trabajando
    return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  }
  throw new Error('Demasiados turnos sin respuesta final');
}

async function main() {
  const today = todayMadrid();
  const data = JSON.parse(await readFile(FILE, 'utf8'));
  let races = validate(data.races);
  const before = races.length;
  let updated = data.updated;
  let failed = false;

  if (KEY) {
    try {
      const model = await pickModel();
      console.log('Modelo:', model);
      const text = await askClaude(model, PROMPT(today, races));
      const m = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].pop();
      if (!m) throw new Error('Sin bloque JSON en la respuesta');
      const fresh = validate(JSON.parse(m[1]).races);
      // Red de seguridad: si la lista se reduce demasiado, algo ha ido mal → no se toca.
      if (fresh.length < Math.max(10, before * 0.7)) {
        throw new Error(`Respuesta sospechosa: ${fresh.length} pruebas frente a ${before}`);
      }
      // Conserva coordenadas conocidas si la respuesta no las trae.
      const prev = new Map(races.map((r) => [r.id, r]));
      races = fresh.map((r) => (r.lat == null && prev.get(r.id)?.lat != null ? { ...r, lat: prev.get(r.id).lat, lng: prev.get(r.id).lng } : r));
      updated = today;
      const cambios = text.match(/CAMBIOS:.*$/m);
      console.log(cambios ? cambios[0] : 'Actualizado.');
    } catch (e) {
      console.error('No se pudo actualizar con Claude:', e.message);
      // Se conserva el JSON actual (limpio de pruebas viejas), pero el workflow sale en rojo
      // para que GitHub avise por email de que la búsqueda ha fallado.
      failed = true;
    }
  } else {
    console.log('Sin ANTHROPIC_API_KEY: solo se limpian pruebas antiguas.');
  }

  races = prune(races, today);
  const out = { updated, races };
  await writeFile(FILE, JSON.stringify(out, null, 1) + '\n');
  console.log(`Pruebas: ${before} → ${races.length}`);
  const future = races.filter((r) => r.start >= today).length;
  if (future < 15) console.warn(`AVISO: solo quedan ${future} pruebas futuras en el calendario.`);
  if (failed) process.exitCode = 1;
}

main();
