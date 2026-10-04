Actualiza el calendario de HybridRaceMap (carreras híbridas y de obstáculos en España) en este repositorio (Kacike93/HybridRaces, rama main) y sube los cambios solo si encuentras novedades. Responde siempre en español.

## 0. Limpieza (solo si hace falta)
En la raíz del repo solo deben existir: `data/`, `scripts/`, `src/`, `static/`, `package.json`, `README.md`, `TAREA-PROGRAMADA.md`, `.gitignore`. Si hay otros archivos o carpetas de una versión antigua (index.html, app.js, styles.css, races.json, sitemap.xml, carpetas calendario/, comunidad/, carreras/, hyrox-espana/…, data/races.js, .github/), bórralos con `git rm -r` en un commit aparte: "Limpiar archivos generados antiguos". No toques nada de la lista permitida.

## 1. Preparar
- Hoy = fecha actual en Europe/Madrid. Horizonte = hoy + 15 meses.
- Ejecuta `node scripts/update-races.mjs` (sin API key: valida el JSON y borra pruebas terminadas hace más de 60 días).
- Lee `data/races.json`: `{"updated":"YYYY-MM-DD","races":[{id,name,cat,start,end,city,region,url,formats,note,lat,lng}]}`.
  - `cat` ∈ hyrox, deka, athx, hyatlon, hybrid (híbrida nacional), spartan, ocr (OCR nacional).
  - Fechas YYYY-MM-DD; `end` = `start` si es un día. `region` = comunidad autónoma en español ("Comunidad de Madrid", "Cataluña", "Canarias"…). `lat`/`lng` = coordenadas del municipio con 3 decimales.

## 2. Buscar novedades (año actual y siguiente, hasta el horizonte)
Usa SOLO fuentes primarias. PROHIBIDO usar como fuente o enlace calendarios o buscadores de terceros: hybridheroes.es, running.life, gymraces.com, haid.app, gotrail.run, finishers.com, correrjuntos.com, trainerday.com, planomato.com.
- a) Marcas: https://hyrox.es/eventos/ · https://es.spartan.com/es/race/find-race (Spartan y DEKA; ignora lo que no sea en España) · https://athxgames.com/events (solo España) · https://hyatlon.org/ y triatlon.org.
- b) Organizadores y circuitos: survivor-race.com, farinatorace.es, ocrbestial.com, desafiodeguerreros.com.es, hunter-race.com, dip-badajoz.es/badajozrace, tripasioneventos.com, time2run.es.
- c) Plataformas de inscripción y cronometraje (aquí salen las pruebas pequeñas): web.rockthesport.com, deporticket.com, sportmaniacs.com, global-tempo.com, crono4sports.com, chronotrackcanarias.com, gesconchip.es, runnink.com, sinctime.com, lineadesalida.net, conxip.com, youevent.es, chipserena.es. Busca "obstáculos", "OCR", "hybrid", "híbrida", "hyrox".
- d) Instagram de organizadores: búsquedas tipo "carrera obstáculos <provincia> <año>" o "hybrid race <ciudad> <año>" (usa el año actual y el siguiente).
- Cuando una marca publique la temporada siguiente, añádela entera.

## 3. Editar `data/races.json`
- Añade pruebas nuevas en España (id kebab-case único y estable, p. ej. "hyrox-madrid-2027"; NO cambies ids existentes), corrige fechas, sedes o enlaces cambiados y elimina las canceladas. Conserva las que no puedas verificar hoy.
- `url` = web oficial de la prueba; si no tiene, su inscripción oficial; si tampoco, su Instagram. Nunca un agregador.
- No inventes datos: si una fecha no está confirmada, no la añadas.
- Ordena por `start` y luego por `name`. Mantén el formato (JSON con indentación de 1 espacio y salto de línea final).
- Solo si cambiaste alguna prueba, pon `"updated"` con la fecha de hoy.

## 4. Comprobar y publicar
- Ejecuta `node scripts/update-races.mjs` otra vez y luego `node scripts/build.mjs`. Ambos deben terminar sin error; si fallan, corrige el JSON.
- Si `git status` no muestra cambios en `data/races.json` (y no hubo limpieza), NO hagas commit.
- Si hay cambios: commit en main con mensaje "Calendario: +N nuevas, M modificadas, K eliminadas (YYYY-MM-DD)" y `git push origin main`. Cloudflare Pages publica la web sola al recibir el commit.
- No subas la carpeta `dist/`.

## 5. Resumen
Termina con un resumen breve en español: pruebas añadidas, modificadas y eliminadas (nombre y fecha), o "Sin cambios".
