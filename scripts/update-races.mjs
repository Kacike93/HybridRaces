// Actualiza data/races.json buscando en la web con la API de Claude (web search + web fetch).
// Uso: ANTHROPIC_API_KEY=... node scripts/update-races.mjs
// Sin ANTHROPIC_API_KEY solo limpia las pruebas antiguas (no consulta nada).
import { readFile, writeFile } from 'node:fs/promises';

const FILE = new URL('../data/races.json', import.meta.url);
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

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z'));

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
        typeof r.url === 'string' && /^https:\/\//.test(r.url);
      if (ok) ids.add(r.id);
      else console.warn('Descartada (formato):', JSON.stringify(r).slice(0, 160));
      return ok;
    })
    .map((r) => ({
      id: r.id, name: r.name, cat: r.cat, start: r.start,
      end: r.end && r.end >= r.start ? r.end : r.start,
      city: r.city, region: r.region, url: r.url,
      formats: r.formats || '', note: r.note || '',
    }));
}

function prune(races, today) {
  const limit = new Date(today + 'T00:00:00Z');
  limit.setUTCDate(limit.getUTCDate() - KEEP_PAST_DAYS);
  const cut = limit.toISOString().slice(0, 10);
  return races.filter((r) => (r.end || r.start) >= cut).sort((a, b) =>
    a.start.localeCompare(b.start) || a.name.localeCompare(b.name, 'es'));
}

const PROMPT = (today, current) => `Hoy es ${today} (Europe/Madrid). Mantienes el calendario de una web de carreras híbridas y de obstáculos (OCR) en ESPAÑA.

Este es el JSON actual:
\`\`\`json
${JSON.stringify(current)}
\`\`\`

Tarea:
1. Consulta las fuentes (usa web_fetch y web_search; si una falla, sigue):
   - https://hyrox.es/eventos/  (HYROX España, cat "hyrox")
   - https://es.spartan.com/es/race/find-race  (Spartan → "spartan", DEKA → "deka"; ignora eventos fuera de España, p. ej. Lisboa)
   - https://athxgames.com/events  (solo España, cat "athx")
   - https://hyatlon.org/  y búsqueda "Hyatlón calendario" (cat "hyatlon")
   - https://running.life/obstacle-run-calender/spain  y ?page=2  (OCR nacionales, cat "ocr")
   - https://hybridheroes.es/carreras-hibridas-espana/  y https://gymraces.com/  (híbridas nacionales, cat "hybrid")
   - Webs oficiales de Farinato (farinatorace.es), Bestial Race (ocrbestial.com), Survivor y Tough Mudder España si existe.
   Haz 1-2 búsquedas de novedades (nuevas sedes, cambios de fecha, cancelaciones).
2. Añade pruebas nuevas en España, corrige fechas/sedes/enlaces cambiados y elimina las canceladas. Conserva las que no puedas verificar hoy (no borres por un fallo de una fuente).
3. Prefiere siempre la URL oficial de la prueba; usa un agregador solo si no hay web oficial. NO inventes datos: si una fecha no está confirmada, no la añadas.
4. Campos: id (kebab-case único, estable: no cambies ids existentes), name, cat (${CATS.join(', ')}), start y end (YYYY-MM-DD; end = start si es un día), city, region (comunidad autónoma en español, p. ej. "Comunidad de Madrid", "Cataluña", "Canarias"), url (https), formats (texto corto, p. ej. "Sprint · Super · Beast"), note (sede u otra nota corta, o "").

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
      races = fresh;
      updated = today;
      const cambios = text.match(/CAMBIOS:.*$/m);
      console.log(cambios ? cambios[0] : 'Actualizado.');
    } catch (e) {
      console.error('No se pudo actualizar con Claude:', e.message);
      process.exitCode = 0; // se conserva el JSON actual
    }
  } else {
    console.log('Sin ANTHROPIC_API_KEY: solo se limpian pruebas antiguas.');
  }

  races = prune(races, today);
  await writeFile(FILE, JSON.stringify({ updated, races }, null, 1) + '\n');
  console.log(`Pruebas: ${before} → ${races.length}`);
}

main();
