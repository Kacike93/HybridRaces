// Genera la web estática en dist/ a partir de data/races.json.
// Uso: node scripts/build.mjs   (sin dependencias; Node 18+)
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');
const SITE = (process.env.SITE_URL || 'https://hybridracemap.com').replace(/\/$/, '');
const BRAND = 'HybridRaceMap';
const TAGLINE = 'Descubre. Compite. Supera. Tu próximo reto empieza aquí.';

// ---------- datos ----------
const data = JSON.parse(await readFile(join(ROOT, 'data/races.json'), 'utf8'));
const UPDATED = data.updated;
// Versión de assets para romper caché cuando cambian app.js / styles.css.
const ASSET_V = UPDATED.replace(/-/g, '') + '-' + (await readFile(join(ROOT, 'src/app.js'), 'utf8')).length.toString(36) + (await readFile(join(ROOT, 'src/styles.css'), 'utf8')).length.toString(36);
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const races = data.races
  .slice()
  .sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name, 'es'));
const upcoming = races.filter((r) => (r.end || r.start) >= TODAY);

const CATS = {
  hyrox:   { name: 'HYROX',            short: 'HYROX',    color: '#ffd23f' },
  deka:    { name: 'DEKA',             short: 'DEKA',     color: '#4d8dff' },
  spartan: { name: 'Spartan Race',     short: 'Spartan',  color: '#ff3b4f' },
  athx:    { name: 'ATHX',             short: 'ATHX',     color: '#b07cff' },
  hyatlon: { name: 'Hyatlón',          short: 'Hyatlón',  color: '#22d3c5' },
  hybrid:  { name: 'Híbrida nacional', short: 'Híbrida',  color: '#ff6fb5' },
  ocr:     { name: 'OCR nacional',     short: 'OCR',      color: '#d39a52' },
};

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Páginas temáticas (SEO). cats = categorías incluidas.
const TOPICS = [
  { path: '/hyrox-espana/', cats: ['hyrox'], h1: 'HYROX en España', title: 'HYROX España: calendario y fechas', eyebrow: 'Fitness racing',
    intro: 'Todas las sedes de HYROX en España: 8 km de carrera alternados con 8 estaciones de trabajo funcional (SkiErg, sled push, sled pull, burpee broad jumps, remo, farmers carry, sandbag lunges y wall balls). Categorías Open, Pro, Doubles y Relay.' },
  { path: '/deka-espana/', cats: ['deka'], h1: 'DEKA en España', title: 'DEKA España: calendario DEKA FIT, MILE y STRONG', eyebrow: 'Fitness racing',
    intro: 'Calendario de DEKA en España, el formato de Spartan con 10 zonas funcionales. DEKA FIT (con carrera de 500 m entre zonas), DEKA MILE (160 m) y DEKA STRONG (sin carrera).' },
  { path: '/spartan-race-espana/', cats: ['spartan'], h1: 'Spartan Race en España', title: 'Spartan Race España: calendario de carreras', eyebrow: 'Obstáculos',
    intro: 'Fechas y sedes de Spartan Race en España: Sprint (5 km, 20 obstáculos), Super (10 km, 25), Beast (21 km, 30), Kids y pruebas de Trail.' },
  { path: '/athx-espana/', cats: ['athx'], h1: 'ATHX en España', title: 'ATHX España: calendario y fechas', eyebrow: 'Fitness racing',
    intro: 'Eventos ATHX en España: competición híbrida que combina una zona de fuerza, una de resistencia (engine) y una de metcon.' },
  { path: '/hyatlon/', cats: ['hyatlon'], h1: 'Hyatlón', title: 'Hyatlón: calendario del circuito', eyebrow: 'Federación Española de Triatlón',
    intro: 'Calendario del circuito Hyatlón, la competición híbrida impulsada por la Federación Española de Triatlón que alterna carrera y trabajo funcional.' },
  { path: '/carreras-hibridas/', cats: ['hybrid'], h1: 'Carreras híbridas nacionales', title: 'Carreras híbridas en España: pruebas nacionales', eyebrow: 'Hybrid racing',
    intro: 'Pruebas híbridas independientes organizadas en España: carrera a pie combinada con estaciones de fuerza y resistencia, fuera de las grandes marcas.' },
  { path: '/competiciones-hibridas/', cats: ['hyrox', 'deka', 'athx', 'hyatlon', 'hybrid'], h1: 'Competiciones híbridas en España', title: 'Competiciones híbridas en España: HYROX, DEKA, ATHX y más', eyebrow: 'Hybrid racing',
    intro: 'Todo el fitness racing en España en un mismo calendario: HYROX, DEKA, ATHX, Hyatlón y las carreras híbridas nacionales.' },
  { path: '/carreras-obstaculos-nacionales/', cats: ['ocr'], h1: 'Carreras de obstáculos nacionales', title: 'Carreras de obstáculos (OCR) nacionales en España', eyebrow: 'Obstáculos',
    intro: 'Carreras de obstáculos organizadas por clubes y organizadores de toda España: barro, muros, cuerdas, arrastres y monkey bars, de 3 a 20 km.' },
  { path: '/carreras-de-obstaculos/', cats: ['spartan', 'ocr'], h1: 'Carreras de obstáculos en España', title: 'Carreras de obstáculos en España: calendario OCR', eyebrow: 'Obstáculos',
    intro: 'Calendario completo de carreras de obstáculos (OCR) en España: Spartan Race y todas las pruebas nacionales, con enlace a la web oficial de cada una.' },
];

// ---------- utilidades ----------
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const d = (iso) => new Date(iso + 'T12:00:00Z');
const monthKey = (iso) => iso.slice(0, 7);
const monthSlug = (key) => `${MONTHS[+key.slice(5, 7) - 1]}-${key.slice(0, 4)}`;
const monthLabel = (key) => `${MONTHS[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const longDate = (iso) => { const x = d(iso); return `${DAYS[x.getUTCDay()]}, ${x.getUTCDate()} de ${MONTHS[x.getUTCMonth()]} de ${x.getUTCFullYear()}`; };
function rangeText(r) {
  const a = d(r.start), b = d(r.end || r.start);
  if (r.start === (r.end || r.start)) return longDate(r.start);
  if (a.getUTCMonth() === b.getUTCMonth()) return `del ${a.getUTCDate()} al ${b.getUTCDate()} de ${MONTHS[b.getUTCMonth()]} de ${b.getUTCFullYear()}`;
  return `del ${a.getUTCDate()} de ${MONTHS[a.getUTCMonth()]} al ${b.getUTCDate()} de ${MONTHS[b.getUTCMonth()]} de ${b.getUTCFullYear()}`;
}
const raceUrl = (r) => `/carreras/${r.id}/`;
const regionUrl = (region) => `/comunidad/${slug(region)}/`;
const monthUrl = (key) => `/calendario/${monthSlug(key)}/`;
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const linkLabel = (u) => (/instagram\.com/.test(u) ? 'Instagram oficial' : /(rockthesport|deporticket|sportmaniacs|global-tempo|crono4sports|chronotrack|sinctime|lineadesalida|youevent|gesconchip|runnink|conxip|chipserena|inscrip)/i.test(u) ? 'Inscripción oficial' : 'Web oficial');

const regions = [...new Set(races.map((r) => r.region))].sort((a, b) => a.localeCompare(b, 'es'));
const months = [...new Set(races.map((r) => monthKey(r.start)))].sort();
const upcomingMonths = [...new Set(upcoming.map((r) => monthKey(r.start)))].sort();

// ---------- piezas ----------
const LOGO = `<svg class="logo-mark" viewBox="0 0 64 80" aria-hidden="true"><path d="M32 5C17.6 5 7 16 7 30.2 7 47.5 32 74 32 74s25-26.5 25-43.8C57 16 46.4 5 32 5z" fill="none" stroke="#f2f3f5" stroke-width="6.5" stroke-linejoin="round"/><g transform="translate(32 30.5) skewX(-16)"><rect x="-12.5" y="-12.5" width="7" height="25" rx="1" fill="#f2f3f5"/><rect x="-12.5" y="-3.4" width="25" height="6.8" fill="#f2f3f5"/><rect x="5.5" y="-12.5" width="7" height="25" rx="1" fill="#ff5a1f"/></g></svg>`;
const WORDMARK = `<span class="wm">HYBRID<span class="r">RACE</span><b>MAP</b></span>`;

function header() {
  return `<header class="top"><div class="wrap">
<a class="logo" href="/" aria-label="${BRAND}, inicio">${LOGO}${WORDMARK}</a>
<nav class="mainnav" aria-label="Principal">
<a href="/#calendario">Calendario</a><a href="/#mapa" data-goto="map">Mapa</a><a href="/hyrox-espana/">HYROX</a><a href="/deka-espana/">DEKA</a><a href="/spartan-race-espana/">Spartan</a><a href="/carreras-de-obstaculos/">OCR</a>
</nav></div></header>`;
}

function footer() {
  return `<footer class="foot"><div class="wrap">
<div class="foot-brand"><a class="logo" href="/">${LOGO}${WORDMARK}</a><p class="foot-sub">Carreras híbridas y OCR</p><p>${esc(TAGLINE)}</p>
<p class="small">Calendario independiente. Los datos salen de las webs oficiales de cada prueba y de sus plataformas de inscripción; confirma siempre fecha y sede en el enlace oficial antes de inscribirte. Actualizado el ${esc(d(UPDATED).getUTCDate() + ' de ' + MONTHS[d(UPDATED).getUTCMonth()] + ' de ' + UPDATED.slice(0, 4))}.</p></div>
<div><h3>Formatos</h3><ul>${TOPICS.map((t) => `<li><a href="${t.path}">${esc(t.h1)}</a></li>`).join('')}</ul></div>
<div><h3>Comunidades</h3><ul>${regions.map((r) => `<li><a href="${regionUrl(r)}">${esc(r)}</a></li>`).join('')}</ul></div>
<div><h3>Por meses</h3><ul>${months.map((m) => `<li><a href="${monthUrl(m)}">${cap(monthLabel(m))}</a></li>`).join('')}</ul></div>
</div></footer>`;
}

function layout({ title, desc, path, body, jsonld = [], dataScript = '', bodyClass = '' }) {
  const url = SITE + path;
  const fullTitle = title.includes(BRAND) ? title : `${title} · ${BRAND}`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:locale" content="es_ES">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0d0f12">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,400;125,900&family=Big+Shoulders+Display:wght@700;800;900&family=Barlow:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap">
<link rel="stylesheet" href="/styles.css?v=${ASSET_V}">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Saltar al contenido</a>
${header()}
<main id="main">
${body}
</main>
${footer()}
${dataScript}
<script src="/app.js?v=${ASSET_V}" defer></script>
</body>
</html>
`;
}

function badge(cat) {
  return `<span class="badge" style="--c:${CATS[cat].color}">${esc(CATS[cat].short)}</span>`;
}

function card(r) {
  const a = d(r.start);
  const multi = (r.end || r.start) !== r.start;
  const b = d(r.end || r.start);
  const dayTxt = multi ? (a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}–${b.getUTCDate()}` : `${a.getUTCDate()}–${b.getUTCDate()}`) : `${a.getUTCDate()}`;
  const search = slug(`${r.name} ${r.city} ${r.region} ${CATS[r.cat].name} ${r.formats}`).replace(/-/g, ' ');
  return `<li class="race" data-id="${esc(r.id)}" data-cat="${r.cat}" data-region="${esc(r.region)}" data-month="${monthKey(r.start)}" data-end="${r.end || r.start}" data-q="${esc(search)}" style="--c:${CATS[r.cat].color}">
<div class="race-date" aria-hidden="true"><b class="${multi ? 'multi' : ''}">${dayTxt}</b><span>${MONTHS_SHORT[a.getUTCMonth()]}${multi && a.getUTCMonth() !== b.getUTCMonth() ? '–' + MONTHS_SHORT[b.getUTCMonth()] : ''}</span><i>${DAYS[a.getUTCDay()].slice(0, 3)}</i></div>
<div class="race-body">
<div class="race-meta">${badge(r.cat)}<span class="when" data-countdown="${r.start}" data-until="${r.end || r.start}"></span></div>
<h3><a href="${raceUrl(r)}">${esc(r.name)}</a></h3>
<p class="where">${esc(r.city)} · <a href="${regionUrl(r.region)}">${esc(r.region)}</a></p>
${r.formats ? `<p class="formats">${esc(r.formats)}</p>` : ''}
<time class="sr" datetime="${r.start}">${esc(rangeText(r))}</time>
</div>
<a class="race-cta" href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="${esc(linkLabel(r.url))} de ${esc(r.name)}">${esc(linkLabel(r.url).split(' ')[0])}<span aria-hidden="true"> ↗</span></a>
</li>`;
}

function groupedList(list, { emptyText = 'No hay pruebas próximas en esta sección por ahora.' } = {}) {
  if (!list.length) return `<p class="empty">${esc(emptyText)}</p>`;
  const groups = new Map();
  for (const r of list) {
    const k = monthKey(r.start);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return [...groups].map(([k, rs]) => `<section class="month" data-month="${k}">
<h3 class="month-h"><a href="${monthUrl(k)}">${cap(monthLabel(k))}</a> <small>${rs.length} ${rs.length === 1 ? 'prueba' : 'pruebas'}</small></h3>
<ul class="races">${rs.map(card).join('\n')}</ul></section>`).join('\n');
}

// Explorador: filtros + vistas lista / mes / mapa sobre un subconjunto de pruebas.
function explorer(list, { chips = true, regionSelect = true, heading = 'Calendario', id = 'calendario', allCats = Object.keys(CATS) } = {}) {
  const cats = allCats.filter((c) => list.some((r) => r.cat === c));
  const regs = [...new Set(list.map((r) => r.region))].sort((a, b) => a.localeCompare(b, 'es'));
  const mons = [...new Set(list.map((r) => monthKey(r.start)))].sort();
  return `<section class="explorer" id="${id}" data-explorer>
<div class="wrap">
<div class="sechead"><div><p class="eyebrow">Próximas pruebas</p><h2 class="sec">${esc(heading)}</h2></div>
<div class="views" role="tablist" aria-label="Vista">
<button role="tab" aria-selected="true" data-view="list">Lista</button><button role="tab" aria-selected="false" data-view="month">Mes</button><button role="tab" aria-selected="false" data-view="map" id="mapa">Mapa</button>
</div></div>
<div class="filters">
<label class="f-search"><span class="sr">Buscar</span><input type="search" placeholder="Buscar prueba, ciudad…" data-f="q" autocomplete="off"></label>
${regionSelect && regs.length > 1 ? `<label><span class="sr">Comunidad</span><select data-f="region"><option value="">Toda España</option>${regs.map((r) => `<option>${esc(r)}</option>`).join('')}</select></label>` : ''}
${mons.length > 1 ? `<label><span class="sr">Mes</span><select data-f="month"><option value="">Cualquier fecha</option>${mons.map((m) => `<option value="${m}">${cap(monthLabel(m))}</option>`).join('')}</select></label>` : ''}
</div>
${chips && cats.length > 1 ? `<div class="chips" role="group" aria-label="Formato">${cats.map((c) => `<button type="button" class="chip" aria-pressed="false" data-cat="${c}" style="--c:${CATS[c].color}"><i></i>${esc(CATS[c].name)}</button>`).join('')}</div>` : ''}
<p class="count" aria-live="polite"><span data-count>${list.length}</span> pruebas · <button type="button" class="linklike" data-reset hidden>Quitar filtros</button></p>
<div class="view view-list" data-pane="list">${groupedList(list)}<p class="empty" data-empty hidden>Ninguna prueba coincide con estos filtros.</p></div>
<div class="view view-month" data-pane="month" hidden><div class="cal-head"><button type="button" class="btn ghost sm" data-cal="-1" aria-label="Mes anterior">←</button><h3 data-cal-title></h3><button type="button" class="btn ghost sm" data-cal="1" aria-label="Mes siguiente">→</button></div><div class="cal" data-cal-grid></div></div>
<div class="view view-map" data-pane="map" hidden><div class="map" data-map role="region" aria-label="Mapa de pruebas"></div><p class="small muted">Mapa © OpenStreetMap · CARTO. La ubicación es aproximada (municipio).</p></div>
</div>
</section>`;
}

const dataScriptFor = (list) => `<script id="races-data" type="application/json">${JSON.stringify(list.map((r) => ({ id: r.id, name: r.name, cat: r.cat, start: r.start, end: r.end || r.start, city: r.city, region: r.region, url: r.url, lat: r.lat, lng: r.lng }))).replace(/</g, '\\u003c')}</script>
<script id="cats-data" type="application/json">${JSON.stringify(Object.fromEntries(Object.entries(CATS).map(([k, v]) => [k, { name: v.name, color: v.color }])))}</script>`;

const orgLd = { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, url: SITE + '/', inLanguage: 'es-ES', description: TAGLINE };
const crumbs = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + path })),
});
const itemList = (list) => ({
  '@context': 'https://schema.org', '@type': 'ItemList',
  itemListElement: list.slice(0, 50).map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + raceUrl(r), name: r.name })),
});
const breadcrumbHtml = (items) => `<nav class="crumbs" aria-label="Migas de pan"><ol>${items.map(([n, p], i) => i === items.length - 1 ? `<li aria-current="page">${esc(n)}</li>` : `<li><a href="${p}">${esc(n)}</a></li>`).join('')}</ol></nav>`;

function pageHero({ eyebrow, h1, intro, crumbsItems, stats }) {
  return `<section class="phero"><div class="wrap">
${breadcrumbHtml(crumbsItems)}
<p class="eyebrow">${esc(eyebrow)}</p>
<h1>${esc(h1)}</h1>
<p class="lede">${esc(intro)}</p>
${stats ? `<div class="pstats">${stats}</div>` : ''}
</div></section>`;
}

function nextBox(list) {
  const n = list.find((r) => r.start >= TODAY) || list[0];
  if (!n) return '';
  return `<a class="countdown" href="${raceUrl(n)}"><span class="n" data-days="${n.start}">·</span><span class="t"><small>Próxima prueba</small><b>${esc(n.name)}</b><span>${esc(n.city)} · ${esc(rangeText(n))}</span></span></a>`;
}

// ---------- páginas ----------
const pages = new Map(); // path -> html
const add = (path, html) => pages.set(path, html);

// Portada
{
  const nCities = new Set(upcoming.map((r) => r.city)).size;
  const nRegions = new Set(upcoming.map((r) => r.region)).size;
  const body = `<section class="hero"><div class="hero-bg" aria-hidden="true"><div class="grid-lines"></div><svg class="hero-pulse" viewBox="0 0 1200 200" preserveAspectRatio="none"><path d="M0 120h330l40-70 60 140 50-110 30 40h690"/></svg></div>
<div class="wrap">
<p class="eyebrow">Calendario Hybrid &amp; OCR · España</p>
<h1>Carreras híbridas y de <em>obstáculos</em> en España</h1>
<p class="lede">HYROX, DEKA, Spartan, ATHX, Hyatlón y todas las pruebas nacionales en un mapa y un calendario, con enlace a la web oficial de cada una. ${esc(TAGLINE)}</p>
<div class="hero-row">
<div class="herostats"><div><b>${upcoming.length}</b>pruebas</div><div><b>${nCities}</b>ciudades</div><div><b>${nRegions}</b>comunidades</div></div>
${nextBox(upcoming)}
</div>
<div class="hero-cats">${Object.entries(CATS).map(([k, v]) => { const t = TOPICS.find((t) => t.cats.length === 1 && t.cats[0] === k); return `<a href="${t ? t.path : '#calendario'}" style="--c:${v.color}"><i></i>${esc(v.name)} <small>${upcoming.filter((r) => r.cat === k).length}</small></a>`; }).join('')}</div>
</div></section>
${explorer(upcoming)}
<section class="seo"><div class="wrap cols">
<div><h2>¿Qué es una carrera híbrida?</h2><p>Las competiciones híbridas (fitness racing) alternan carrera a pie con estaciones de trabajo funcional: trineos, remo, SkiErg, wall balls, zancadas con saco… <a href="/hyrox-espana/">HYROX</a>, <a href="/deka-espana/">DEKA</a>, <a href="/athx-espana/">ATHX</a> y <a href="/hyatlon/">Hyatlón</a> son los formatos más conocidos, y cada vez hay más <a href="/carreras-hibridas/">pruebas híbridas nacionales</a>.</p></div>
<div><h2>¿Y una carrera de obstáculos?</h2><p>Las carreras de obstáculos (OCR) combinan trail o cross con muros, cuerdas, barro, arrastres y monkey bars. Aquí tienes <a href="/spartan-race-espana/">Spartan Race</a> y todo el circuito de <a href="/carreras-obstaculos-nacionales/">carreras de obstáculos nacionales</a>.</p></div>
<div><h2>Fuentes oficiales</h2><p>Cada prueba enlaza a su web oficial o, si no tiene, a su inscripción oficial o su Instagram. El calendario se revisa a diario. ¿Falta tu prueba o ha cambiado una fecha? Avísanos y la añadimos.</p></div>
</div></section>`;
  add('/', layout({
    title: `${BRAND} · Carreras híbridas y de obstáculos en España`,
    desc: `Calendario y mapa de carreras híbridas y de obstáculos en España: HYROX, DEKA, Spartan, ATHX, Hyatlón y OCR nacionales. ${upcoming.length} pruebas con enlace oficial, actualizado a diario.`,
    path: '/', body, jsonld: [orgLd, itemList(upcoming)], dataScript: dataScriptFor(upcoming), bodyClass: 'home',
  }));
}

// Páginas temáticas
for (const t of TOPICS) {
  const list = upcoming.filter((r) => t.cats.includes(r.cat));
  const regs = new Set(list.map((r) => r.region)).size;
  const body = pageHero({
    eyebrow: t.eyebrow, h1: t.h1, intro: t.intro,
    crumbsItems: [['Inicio', '/'], [t.h1, t.path]],
    stats: `<span><b>${list.length}</b> pruebas</span><span><b>${regs}</b> comunidades</span>${nextBox(list)}`,
  }) + explorer(list, { chips: t.cats.length > 1, heading: `Calendario ${t.h1.replace(/ en España$/, '')}`, allCats: t.cats })
    + relatedLinks(t.path);
  add(t.path, layout({
    title: t.title, desc: `${t.intro.split('.')[0]}. ${list.length} pruebas próximas con fecha, sede y enlace oficial.`,
    path: t.path, body, jsonld: [crumbs([['Inicio', '/'], [t.h1, t.path]]), itemList(list)], dataScript: dataScriptFor(list),
  }));
}

function relatedLinks(current) {
  return `<section class="related"><div class="wrap"><h2>Explora más</h2><div class="pills">${TOPICS.filter((t) => t.path !== current).map((t) => `<a href="${t.path}">${esc(t.h1)}</a>`).join('')}</div>
<h2>Por comunidad</h2><div class="pills">${regions.map((r) => `<a href="${regionUrl(r)}">${esc(r)}</a>`).join('')}</div></div></section>`;
}

// Comunidades
for (const region of regions) {
  const all = races.filter((r) => r.region === region);
  const list = all.filter((r) => (r.end || r.start) >= TODAY);
  const path = regionUrl(region);
  const counts = Object.keys(CATS).map((c) => [c, list.filter((r) => r.cat === c).length]).filter(([, n]) => n);
  const body = pageHero({
    eyebrow: 'Por comunidad', h1: `Carreras híbridas y de obstáculos en ${region}`,
    intro: `Calendario de pruebas en ${region}: ${counts.map(([c, n]) => `${n} ${CATS[c].name}`).join(', ') || 'sin pruebas confirmadas por ahora'}. Fechas, sedes y enlace a la web oficial de cada prueba.`,
    crumbsItems: [['Inicio', '/'], [region, path]],
    stats: `<span><b>${list.length}</b> pruebas</span><span><b>${new Set(list.map((r) => r.city)).size}</b> localidades</span>${nextBox(list)}`,
  }) + explorer(list, { regionSelect: false, heading: `Calendario ${region}` }) + relatedLinks(path);
  add(path, layout({
    title: `Carreras híbridas y OCR en ${region}`,
    desc: `${list.length} carreras híbridas y de obstáculos en ${region}: HYROX, DEKA, Spartan, OCR y más, con fecha, sede y enlace oficial.`,
    path, body, jsonld: [crumbs([['Inicio', '/'], [region, path]]), itemList(list)], dataScript: dataScriptFor(list),
  }));
}

// Meses
for (const m of months) {
  const list = races.filter((r) => monthKey(r.start) === m);
  const path = monthUrl(m);
  const i = months.indexOf(m);
  const prev = months[i - 1], next = months[i + 1];
  const label = cap(monthLabel(m));
  const body = pageHero({
    eyebrow: 'Calendario mensual', h1: `Carreras híbridas y de obstáculos en ${monthLabel(m)}`,
    intro: `${list.length} ${list.length === 1 ? 'prueba' : 'pruebas'} en España en ${monthLabel(m)}: ${[...new Set(list.map((r) => CATS[r.cat].name))].join(', ')}.`,
    crumbsItems: [['Inicio', '/'], ['Calendario', '/#calendario'], [label, path]],
    stats: `<div class="monthnav">${prev ? `<a class="btn ghost sm" href="${monthUrl(prev)}">← ${cap(monthLabel(prev))}</a>` : ''}${next ? `<a class="btn ghost sm" href="${monthUrl(next)}">${cap(monthLabel(next))} →</a>` : ''}</div>`,
  }) + explorer(list, { heading: label }) + relatedLinks(path);
  add(path, layout({
    title: `Carreras híbridas y OCR en ${monthLabel(m)}`,
    desc: `Calendario de ${monthLabel(m)}: ${list.length} carreras híbridas y de obstáculos en España (HYROX, DEKA, Spartan, OCR…) con enlace oficial.`,
    path, body, jsonld: [crumbs([['Inicio', '/'], [label, path]]), itemList(list)], dataScript: dataScriptFor(list),
  }));
}

// Fichas de prueba
const ics = (r) => {
  const endEx = d(r.end || r.start); endEx.setUTCDate(endEx.getUTCDate() + 1);
  const f = (s) => s.replace(/-/g, '');
  const e = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${BRAND}//ES`, 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${r.id}@${host(SITE)}`, `DTSTAMP:${UPDATED.replace(/-/g, '')}T000000Z`, `DTSTART;VALUE=DATE:${f(r.start)}`,
    `DTEND;VALUE=DATE:${endEx.toISOString().slice(0, 10).replace(/-/g, '')}`, `SUMMARY:${e(r.name)}`,
    `LOCATION:${e(`${r.city}, ${r.region}, España`)}`, `DESCRIPTION:${e(`${CATS[r.cat].name}${r.formats ? ' · ' + r.formats : ''}\n${r.url}`)}`,
    `URL:${r.url}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
};
const files = new Map(); // path -> contenido (no html)

for (const r of races) {
  const path = raceUrl(r);
  const cat = CATS[r.cat];
  const past = (r.end || r.start) < TODAY;
  const topic = TOPICS.find((t) => t.cats.length === 1 && t.cats[0] === r.cat) || TOPICS.find((t) => t.cats.includes(r.cat));
  const sameRegion = upcoming.filter((x) => x.region === r.region && x.id !== r.id).slice(0, 4);
  const sameCat = upcoming.filter((x) => x.cat === r.cat && x.id !== r.id && !sameRegion.includes(x)).slice(0, 4);
  const endEx = d(r.end || r.start); endEx.setUTCDate(endEx.getUTCDate() + 1);
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(r.name)}&dates=${r.start.replace(/-/g, '')}/${endEx.toISOString().slice(0, 10).replace(/-/g, '')}&location=${encodeURIComponent(`${r.city}, ${r.region}, España`)}&details=${encodeURIComponent(r.url)}`;
  files.set(`${path}evento.ics`, ics(r));
  const ld = {
    '@context': 'https://schema.org', '@type': 'SportsEvent', name: r.name,
    startDate: r.start, endDate: r.end || r.start,
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    sport: r.cat === 'ocr' || r.cat === 'spartan' ? 'Obstacle course racing' : 'Fitness racing',
    description: `${cat.name} en ${r.city} (${r.region})${r.formats ? '. ' + r.formats : ''}${r.note ? '. ' + r.note : ''}.`,
    url: SITE + path, sameAs: r.url, image: [SITE + '/og.png'],
    location: { '@type': 'Place', name: r.note && r.note.length < 80 ? r.note : r.city,
      address: { '@type': 'PostalAddress', addressLocality: r.city, addressRegion: r.region, addressCountry: 'ES' },
      ...(r.lat ? { geo: { '@type': 'GeoCoordinates', latitude: r.lat, longitude: r.lng } } : {}) },
    organizer: { '@type': 'Organization', name: r.name, url: r.url },
  };
  const crumbItems = [['Inicio', '/'], [topic.h1, topic.path], [r.name, path]];
  const body = `<article class="detail" style="--c:${cat.color}"><div class="wrap">
${breadcrumbHtml(crumbItems)}
<div class="detail-grid">
<div class="detail-main">
<div class="race-meta">${badge(r.cat)}${past ? '<span class="when past">Finalizada</span>' : `<span class="when" data-countdown="${r.start}" data-until="${r.end || r.start}"></span>`}</div>
<h1>${esc(r.name)}</h1>
<dl class="facts">
<div><dt>Fecha</dt><dd><time datetime="${r.start}">${esc(cap(rangeText(r)))}</time></dd></div>
<div><dt>Lugar</dt><dd>${esc(r.city)} · <a href="${regionUrl(r.region)}">${esc(r.region)}</a>${r.note ? `<br><span class="muted">${esc(r.note)}</span>` : ''}</dd></div>
<div><dt>Formato</dt><dd><a href="${topic.path}">${esc(cat.name)}</a>${r.formats ? ` · ${esc(r.formats)}` : ''}</dd></div>
<div><dt>Enlace</dt><dd><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(host(r.url))}</a></dd></div>
</dl>
<div class="actions">
<a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(linkLabel(r.url))} ↗</a>
<a class="btn ghost" href="${gcal}" target="_blank" rel="noopener">Google Calendar</a>
<a class="btn ghost" href="${path}evento.ics" download="${r.id}.ics">Añadir (.ics)</a>
<button class="btn ghost" type="button" data-share>Compartir</button>
</div>
<p class="small muted">Información recopilada de la fuente oficial. Confirma fecha, sede y precios en ${esc(host(r.url))} antes de inscribirte.</p>
</div>
<aside class="detail-side">
${r.lat ? `<div class="minimap" data-minimap data-lat="${r.lat}" data-lng="${r.lng}" data-color="${cat.color}" role="img" aria-label="Mapa de ${esc(r.city)}"></div>` : ''}
<div class="bigdate"><b>${d(r.start).getUTCDate()}</b><span>${MONTHS[d(r.start).getUTCMonth()]} ${r.start.slice(0, 4)}</span><a href="${monthUrl(monthKey(r.start))}">Ver todo ${monthLabel(monthKey(r.start))} →</a></div>
</aside>
</div>
</div></article>
${sameRegion.length ? `<section class="more"><div class="wrap"><h2>Más pruebas en ${esc(r.region)}</h2><ul class="races">${sameRegion.map(card).join('')}</ul></div></section>` : ''}
${sameCat.length ? `<section class="more"><div class="wrap"><h2>Más ${esc(cat.name)}</h2><ul class="races">${sameCat.map(card).join('')}</ul></div></section>` : ''}`;
  add(path, layout({
    title: `${r.name} ${r.start.slice(0, 4)}: fecha, sede e inscripción`,
    desc: `${r.name} (${cat.name}) en ${r.city}, ${r.region}: ${rangeText(r)}.${r.formats ? ' ' + r.formats + '.' : ''} Enlace oficial, mapa y añadir al calendario.`,
    path, body, jsonld: [ld, crumbs(crumbItems)], bodyClass: 'race-page',
  }));
}

// 404
add('/404.html', layout({
  title: 'Página no encontrada', desc: 'Esta página no existe.', path: '/404.html',
  body: `<section class="phero"><div class="wrap"><p class="eyebrow">Error 404</p><h1>Te has salido del recorrido</h1><p class="lede">Esta página no existe o la prueba ya no está en el calendario.</p><p><a class="btn" href="/">Volver al calendario</a></p></div></section>`,
}));

// ---------- escribir ----------
async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await cp(join(ROOT, 'static'), OUT, { recursive: true });
  await cp(join(ROOT, 'src/styles.css'), join(OUT, 'styles.css'));
  await cp(join(ROOT, 'src/app.js'), join(OUT, 'app.js'));
  for (const [p, html] of pages) {
    const file = p.endsWith('.html') ? join(OUT, p) : join(OUT, p, 'index.html');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
  }
  for (const [p, c] of files) {
    await mkdir(dirname(join(OUT, p)), { recursive: true });
    await writeFile(join(OUT, p), c);
  }
  await writeFile(join(OUT, 'races.json'), JSON.stringify(data));
  const urls = [...pages.keys()].filter((p) => !p.endsWith('.html'));
  await writeFile(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((p) => `<url><loc>${SITE}${p}</loc><lastmod>${UPDATED}</lastmod><changefreq>${p.startsWith('/carreras/') ? 'weekly' : 'daily'}</changefreq><priority>${p === '/' ? '1.0' : p.startsWith('/carreras/') ? '0.6' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`);
  await writeFile(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`OK: ${pages.size} páginas, ${races.length} pruebas (${upcoming.length} próximas) → dist/`);
}
await main();
