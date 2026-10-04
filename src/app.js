// HybridRaceMap — interacción: filtros, vista mes, mapa (Leaflet + CARTO dark), cuentas atrás.
(() => {
  'use strict';
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DOW = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const dayDiff = (iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 864e5);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const readJSON = (id) => { const el = document.getElementById(id); try { return el ? JSON.parse(el.textContent) : null; } catch { return null; } };

  // ---------- cuentas atrás ----------
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const s = dayDiff(el.dataset.countdown), e = dayDiff(el.dataset.until || el.dataset.countdown);
    let t = '', cls = '';
    if (e < 0) { t = 'Finalizada'; cls = 'past'; }
    else if (s <= 0) { t = 'Hoy'; cls = 'live'; }
    else if (s === 1) { t = 'Mañana'; cls = 'soon'; }
    else if (s < 15) { t = `En ${s} días`; cls = 'soon'; }
    else if (s < 60) { t = `En ${s} días`; }
    else { t = `En ${Math.round(s / 30.4)} meses`; }
    el.textContent = t; if (cls) el.classList.add(cls);
  });
  document.querySelectorAll('[data-days]').forEach((el) => {
    const n = Math.max(0, dayDiff(el.dataset.days));
    el.innerHTML = n === 0 ? 'HOY' : `${n}<small>${n === 1 ? 'DÍA' : 'DÍAS'}</small>`;
  });

  // ---------- Leaflet bajo demanda ----------
  let leafletP;
  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletP) return leafletP;
    leafletP = new Promise((res, rej) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
     
      s.onload = () => res(window.L); s.onerror = rej;
      document.head.appendChild(s);
    });
    return leafletP;
  }
  const tiles = (L) => L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd', maxZoom: 18,
  });

  // ---------- minimapa ficha ----------
  const mm = document.querySelector('[data-minimap]');
  if (mm) {
    const io = new IntersectionObserver((ents) => {
      if (!ents.some((e) => e.isIntersecting)) return;
      io.disconnect();
      loadLeaflet().then((L) => {
        const lat = +mm.dataset.lat, lng = +mm.dataset.lng;
        const map = L.map(mm, { scrollWheelZoom: false, zoomControl: true }).setView([lat, lng], 9);
        tiles(L).addTo(map);
        L.circleMarker([lat, lng], { radius: 10, color: '#0d0f12', weight: 2, fillColor: mm.dataset.color || '#ff5a1f', fillOpacity: 1 }).addTo(map);
      }).catch(() => { mm.hidden = true; });
    });
    io.observe(mm);
  }

  // ---------- compartir ----------
  document.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', async () => {
    const data = { title: document.title, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(location.href); b.textContent = 'Enlace copiado'; }
    } catch { /* cancelado */ }
  }));

  // ---------- explorador ----------
  const ex = document.querySelector('[data-explorer]');
  if (!ex) return;
  const RACES = readJSON('races-data') || [];
  const CATS = readJSON('cats-data') || {};
  const byId = new Map(RACES.map((r) => [r.id, r]));
  const items = [...ex.querySelectorAll('.race')];
  const groups = [...ex.querySelectorAll('.month')];
  const q = ex.querySelector('[data-f=q]');
  const region = ex.querySelector('[data-f=region]');
  const month = ex.querySelector('[data-f=month]');
  const chips = [...ex.querySelectorAll('.chip')];
  const countEl = ex.querySelector('[data-count]');
  const emptyEl = ex.querySelector('[data-empty]');
  const resetBtn = ex.querySelector('[data-reset]');

  const state = { q: '', region: '', month: '', cats: new Set(), view: 'list', calMonth: null };

  // Estado inicial desde la URL (?cat=hyrox,deka&region=…&mes=2026-10&q=…&vista=mapa)
  const params = new URLSearchParams(location.search);
  if (params.get('q')) state.q = params.get('q');
  if (params.get('region')) state.region = params.get('region');
  if (params.get('mes')) state.month = params.get('mes');
  (params.get('cat') || '').split(',').filter((c) => CATS[c]).forEach((c) => state.cats.add(c));
  const vParam = { lista: 'list', mes: 'month', mapa: 'map' }[params.get('vista')] || (location.hash === '#mapa' ? 'map' : 'list');

  if (q) q.value = state.q;
  if (region) region.value = state.region;
  if (month) month.value = state.month;
  chips.forEach((c) => c.setAttribute('aria-pressed', state.cats.has(c.dataset.cat)));

  const matches = (r) => {
    if (r.end < today) return false;
    if (state.cats.size && !state.cats.has(r.cat)) return false;
    if (state.region && r.region !== state.region) return false;
    if (state.month && r.start.slice(0, 7) !== state.month) return false;
    if (state.q) {
      const hay = norm(`${r.name} ${r.city} ${r.region} ${(CATS[r.cat] || {}).name || ''}`);
      if (!norm(state.q).split(' ').every((w) => hay.includes(w))) return false;
    }
    return true;
  };
  const visible = () => RACES.filter(matches);

  function syncURL() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.cats.size) p.set('cat', [...state.cats].join(','));
    if (state.region) p.set('region', state.region);
    if (state.month) p.set('mes', state.month);
    if (state.view !== 'list') p.set('vista', { month: 'mes', map: 'mapa' }[state.view]);
    const s = p.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + (location.hash && location.hash !== '#mapa' ? location.hash : ''));
  }

  function apply() {
    const vis = new Set(visible().map((r) => r.id));
    items.forEach((li) => { li.hidden = !vis.has(li.dataset.id); });
    groups.forEach((g) => { g.hidden = !g.querySelector('.race:not([hidden])'); });
    if (countEl) countEl.textContent = vis.size;
    if (emptyEl) emptyEl.hidden = vis.size > 0;
    const filtered = state.q || state.region || state.month || state.cats.size;
    if (resetBtn) resetBtn.hidden = !filtered;
    if (state.view === 'month') renderCal();
    if (state.view === 'map') renderMap();
    syncURL();
  }

  let t;
  q && q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = q.value.trim(); apply(); }, 120); });
  region && region.addEventListener('change', () => { state.region = region.value; apply(); });
  month && month.addEventListener('change', () => { state.month = month.value; if (month.value) state.calMonth = month.value; apply(); });
  chips.forEach((c) => c.addEventListener('click', () => {
    const k = c.dataset.cat;
    state.cats.has(k) ? state.cats.delete(k) : state.cats.add(k);
    c.setAttribute('aria-pressed', state.cats.has(k));
    apply();
  }));
  resetBtn && resetBtn.addEventListener('click', () => {
    state.q = state.region = state.month = ''; state.cats.clear();
    if (q) q.value = ''; if (region) region.value = ''; if (month) month.value = '';
    chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
    apply();
  });

  // vistas
  const tabs = [...ex.querySelectorAll('[data-view]')];
  const panes = Object.fromEntries([...ex.querySelectorAll('[data-pane]')].map((p) => [p.dataset.pane, p]));
  function setView(v) {
    state.view = v;
    tabs.forEach((b) => b.setAttribute('aria-selected', b.dataset.view === v));
    Object.entries(panes).forEach(([k, p]) => { p.hidden = k !== v; });
    apply();
  }
  tabs.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelectorAll('[data-goto=map]').forEach((a) => a.addEventListener('click', (e) => {
    if (location.pathname !== '/') return;
    e.preventDefault(); setView('map'); ex.scrollIntoView({ behavior: 'smooth' });
  }));

  // ---------- vista mes ----------
  const calGrid = ex.querySelector('[data-cal-grid]');
  const calTitle = ex.querySelector('[data-cal-title]');
  ex.querySelectorAll('[data-cal]').forEach((b) => b.addEventListener('click', () => {
    const [y, m] = state.calMonth.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + Number(b.dataset.cal), 1));
    state.calMonth = dt.toISOString().slice(0, 7);
    renderCal();
  }));
  function renderCal() {
    if (!calGrid) return;
    const vis = visible();
    if (!state.calMonth) state.calMonth = state.month || (vis[0] ? vis[0].start.slice(0, 7) : today.slice(0, 7));
    const [y, m] = state.calMonth.split('-').map(Number);
    calTitle.textContent = `${MONTHS[m - 1]} ${y}`;
    const first = new Date(Date.UTC(y, m - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const start = new Date(first); start.setUTCDate(1 - offset);
    let html = DOW.map((d) => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const dt = new Date(start); dt.setUTCDate(start.getUTCDate() + i);
      const iso = dt.toISOString().slice(0, 10);
      if (i >= 35 && dt.getUTCMonth() !== m - 1) break;
      const evs = vis.filter((r) => r.start <= iso && r.end >= iso);
      html += `<div class="day${dt.getUTCMonth() !== m - 1 ? ' out' : ''}${iso === today ? ' today' : ''}"><b>${dt.getUTCDate()}</b>${evs.map((r) => `<a class="ev" href="/carreras/${r.id}/" style="--c:${(CATS[r.cat] || {}).color}" title="${esc(r.name)} · ${esc(r.city)}">${esc(r.name)}</a>`).join('')}</div>`;
    }
    calGrid.innerHTML = html;
  }

  // ---------- vista mapa ----------
  let map, layer;
  function renderMap() {
    const el = ex.querySelector('[data-map]');
    if (!el) return;
    loadLeaflet().then((L) => {
      if (!map) {
        map = L.map(el, { scrollWheelZoom: false }).setView([40.2, -3.7], 5);
        tiles(L).addTo(map);
        layer = L.layerGroup().addTo(map);
      }
      setTimeout(() => map.invalidateSize(), 50);
      layer.clearLayers();
      const vis = visible().filter((r) => typeof r.lat === 'number');
      // Agrupa por coordenadas para que no se pisen marcadores de la misma ciudad.
      const seen = new Map();
      const pts = [];
      vis.forEach((r) => {
        const k = r.lat.toFixed(3) + ',' + r.lng.toFixed(3);
        const n = seen.get(k) || 0; seen.set(k, n + 1);
        const ang = n * 2.4, rad = n ? 0.03 + 0.012 * n : 0;
        const ll = [r.lat + rad * Math.sin(ang), r.lng + rad * Math.cos(ang)];
        pts.push(ll);
        const c = (CATS[r.cat] || {}).color || '#ff5a1f';
        const d = new Date(r.start + 'T12:00:00Z');
        L.circleMarker(ll, { radius: 8, color: '#0d0f12', weight: 2, fillColor: c, fillOpacity: 0.95 })
          .bindPopup(`<span class="badge" style="--c:${c}">${esc((CATS[r.cat] || {}).name || r.cat)}</span><a class="pp-title" href="/carreras/${r.id}/">${esc(r.name)}</a><span class="pp-meta">${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${esc(r.city)}</span><br><a href="${esc(r.url)}" target="_blank" rel="noopener">Web oficial ↗</a>`)
          .addTo(layer);
      });
      if (pts.length) {
        // Canarias queda lejos: si todo está en península encuadra solo la península.
        map.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 9 });
      }
    }).catch(() => { el.innerHTML = '<p class="empty" style="padding:20px">No se pudo cargar el mapa.</p>'; });
  }

  setView(vParam);
})();
