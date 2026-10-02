import { territoryPoints, summarizeTerritories, insideLasso } from './simulator-territory-model.mjs';

export function setupTerritoryExplorer(host, { chartHost, summaryHost, indexAppearance, aggregateRows, formatNumber: n, formatPct: pct, formatPp: pp, kpi, escapeHtml: esc, onSelection, showMap }) {
  host.innerHTML = `<div class="section-title">Elegir partidos</div><label class="sim-search-label">Buscar por nombre<input type="search" data-search placeholder="Nombre del partido…"></label><p data-count class="sim-help"></p><div data-party-list class="sim-party-list"></div><div class="panel-actions"><button type="button" data-clear>Limpiar selección</button><button type="button" data-undo>Deshacer</button><button type="button" data-map>Ver selección en el mapa</button></div>`;
  chartHost.innerHTML = `<div class="sim-chart-head"><div><span class="section-title">Distribución de partidos</span><span data-encoding class="sim-encoding"></span></div><div class="sim-chart-actions"><button type="button" data-lasso aria-pressed="false">Lazo</button><button type="button" data-zoom>Acercar a selección</button><button type="button" data-full>Vista completa</button><button type="button" data-expand>Ampliar gráfico ↗</button></div></div><div class="sim-chart-options"><label><input type="checkbox" data-log> Separar partidos pequeños <span>(escala logarítmica)</span></label><span data-lasso-help>Clic o Enter para seleccionar.</span></div><div class="sim-scatter-wrap"><svg class="sim-scatter" viewBox="0 0 900 440" aria-label="Partidos: competitividad y volumen electoral en votantes observados"></svg></div><p data-tooltip class="sim-territory-tooltip">Pasá por un punto para identificar el partido y consultar sus datos.</p>`;
  summaryHost.innerHTML = `<div class="ranking-head"><div><span>Potencial territorial</span><strong>Cobertura del objetivo</strong></div></div><div class="sim-selection-body"><p data-summary role="status"></p><div class="sim-kpis" data-kpis></div><section class="sim-potential-progress" aria-label="Avance de la selección"><label for="simCoverage">Potencial seleccionado frente al objetivo</label><progress id="simCoverage" data-progress value="0" max="100"></progress><p data-progress-caption></p><p data-relation role="status"></p><dl class="sim-potential-breakdown"><div><dt>Votos de otras fuerzas</dt><dd data-other-votes></dd></div><div data-new-row><dt>Nuevos votos previstos</dt><dd data-new-votes></dd></div></dl><p data-newcomer class="sim-help"></p><p class="sim-help">Capacidad máxima: no predice votos obtenidos. Excluye votos ya propios, blancos y nulos.</p></section><details data-more hidden><summary>Datos observados de la selección</summary><div class="sim-kpis" data-extra></div></details><details><summary>Partidos seleccionados</summary><div class="sim-selected-list" data-list></div></details><details><summary>Cómo leer el gráfico</summary><p>Competitividad: diferencia entre primera y segunda fuerza, en puntos porcentuales. Menor diferencia implica mayor competencia; no es necesariamente el margen de la fuerza elegida.</p><p>Volumen electoral: votantes observados, no votos potenciales. El tamaño representa abstenciones sólo al modificar la participación.</p><p>La escala logarítmica opcional separa partidos pequeños sin cambiar sus valores. Usa log(votantes + 1) para incluir cero. La selección usa el centro de cada punto.</p><p data-coverage></p><p data-size></p></details></div>`;
  const q = selector => host.querySelector(selector) || chartHost.querySelector(selector) || summaryHost.querySelector(selector);
  const legend = document.createElement('div');
  legend.className = 'sim-index-legend';
  legend.innerHTML = `<strong>${esc(indexAppearance.legendLabel)}</strong><span>${indexAppearance.format(indexAppearance.domain[0])}</span><i style="background:linear-gradient(90deg,${indexAppearance.palette.join(',')})"></i><span>${indexAppearance.format(indexAppearance.domain[1])}</span><span>Escala provincial fija · gris: sin dato</span>`;
  chartHost.querySelector('.sim-chart-options').append(legend);
  const svg = q('svg'), wrap = q('.sim-scatter-wrap');
  let selected = new Set(), context, points = [], plotted = [], path = [], polygon = null, pointerId = null, startTarget;
  let previous = null, lasso = false, logarithmic = false, zoomDomain = null, size = { width: 900, height: 440 };
  const node = (tag, attrs, text, parent = svg) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text !== undefined) el.textContent = text;
    parent.append(el); return el;
  };
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const transformY = value => logarithmic ? Math.log10(1 + value) : value;
  function change(next) { previous = new Set(selected); selected = next; render(); onSelection(new Set(selected)); }
  function toggle(key) { if (!points.some(p => p.key === key)) return; const next = new Set(selected); next.has(key) ? next.delete(key) : next.add(key); change(next); }
  function tooltip(p) {
    return `${p.name} · ${indexAppearance.name}: ${indexAppearance.format(indexAppearance.value(p.key,context.unit))} · Votantes observados: ${n(p.voters)} · Competitividad: ${pp(p.competition)} de diferencia entre primera y segunda fuerza · ${context.scenario.force.name}: ${n(p.votes)} votos (${pct(p.share)} de los positivos del territorio) · Abstenciones: ${n(p.abstentions)}`;
  }
  function syncPoints() {
    const term = normalize(q('[data-search]').value);
    svg.querySelectorAll('[data-key]').forEach(group => {
      const active = selected.has(group.dataset.key);
      group.classList.toggle('is-selected', active); group.setAttribute('aria-pressed', String(active));
      group.querySelector('.sim-territory-point').classList.toggle('is-selected', active);
      group.classList.toggle('is-search-muted', Boolean(term) && !normalize(group.dataset.name).includes(term));
    });
    svg.querySelector('[data-selected-labels]')?.remove();
    if (selected.size <= 5) {
      const labels = node('g', { 'data-selected-labels': '', 'aria-hidden': 'true', 'pointer-events': 'none' });
      plotted.filter(p => selected.has(p.key) && p.visible).forEach(p => {
        const right = p.x > size.width * .72;
        node('text', { x: p.x + (right ? -10 : 10), y: Math.max(38, p.y - 10), 'text-anchor': right ? 'end' : 'start', class: 'sim-point-label' }, p.name, labels);
      });
    }
  }
  function render(redraw = false) {
    if (!context) return;
    const { base, scenario: r, increase } = context;
    const plural = context.unit === 'circuit' ? 'circuitos' : 'partidos', singular = context.unit === 'circuit' ? 'circuito' : 'partido';
    const s = summarizeTerritories(points, selected, base, r, aggregateRows, context.allocation);
    q('[data-summary]').textContent = s.count ? `${s.count} ${s.count === 1 ? singular + ' seleccionado' : plural + ' seleccionados'}` : `Seleccioná ${plural} para reunir potencial frente al objetivo provincial.`;
    q('[data-kpis]').innerHTML = [
      kpi('Votos adicionales necesarios', n(r.additional), 'Objetivo provincial'),
      kpi('Potencial seleccionado', n(s.potential), 'Otras fuerzas + nuevos votos previstos'),
      kpi(s.sufficient && r.additional > 0 ? 'Excedente de potencial' : 'Votos potenciales faltantes', n(s.sufficient ? s.surplus : s.gap)),
    ].join('');
    const progress = r.additional > 0 ? Math.min(100, s.coverage * 100) : 0;
    q('[data-progress]').value = progress;
    q('[data-progress]').setAttribute('aria-valuetext', r.additional > 0 ? `${pct(s.coverage)} del objetivo; ${n(s.potential)} votos potenciales de ${n(r.additional)} necesarios` : 'No se necesitan votos adicionales');
    q('[data-progress-caption]').textContent = r.additional > 0 ? `${n(s.potential)} potenciales / ${n(r.additional)} necesarios · ${pct(s.coverage)} de cobertura` : 'No se necesitan votos adicionales para este objetivo.';
    q('[data-relation]').innerHTML = r.additional === 0 ? 'El objetivo coincide con el resultado observado; no hace falta reunir votos adicionales.' : !s.sufficient ? `La selección todavía no cubre el objetivo. <strong>Faltan ${n(s.gap)} votos potenciales.</strong>` : `La selección reúne potencial suficiente. Sería necesario captar el <strong>${pct(s.captureRate)}</strong> de ese potencial para cubrir los ${n(r.additional)} votos adicionales.`;
    q('[data-relation]').classList.toggle('is-sufficient', s.sufficient && r.additional > 0);
    q('[data-other-votes]').textContent = n(s.otherVotes);
    q('[data-new-row]').hidden = q('[data-newcomer]').hidden = !increase;
    q('[data-new-votes]').textContent = n(s.newVotes);
    q('[data-newcomer]').textContent = `${n(s.newVotes)} de los ${n(r.newcomers)} nuevos votantes provinciales previstos, distribuidos en proporción a las abstenciones observadas. No se cuentan todas las abstenciones como nuevos votos.`;
    q('[data-more]').hidden = !s.count;
    q('[data-extra]').innerHTML = [kpi('Peso sobre positivos provinciales', pct(s.weight)), kpi('Votos positivos', n(s.positivos)), kpi('Votos de la fuerza elegida', n(s.votes), `${pct(s.share)} de los positivos de la selección`), kpi('Votantes', n(s.votantes)), kpi('Electores', n(s.electores)), kpi('Abstenciones', n(s.abstentions)), kpi('Participación observada', pct(s.turnout)), kpi('Margen medio entre 1.ª y 2.ª', pp(s.mean), `Media simple · ${s.marginCount} ${plural}`), kpi('Margen mediano', pp(s.median))].join('');
    q('[data-list]').innerHTML = points.filter(p => selected.has(p.key)).sort((a,b) => a.name.localeCompare(b.name,'es')).map(p => `<button type="button" data-remove="${esc(p.key)}">Quitar ${esc(p.name)}</button>`).join('') || 'Sin selección';
    q('[data-clear]').disabled = q('[data-map]').disabled = q('[data-zoom]').disabled = !selected.size;
    q('[data-map]').textContent = selected.size ? `Ver ${selected.size} ${selected.size === 1 ? singular : plural} en el mapa` : 'Ver selección en el mapa';
    q('[data-undo]').disabled = previous === null;
    q('[data-count]').textContent = `${selected.size} de ${points.length} ${plural} seleccionados`;
    q('[data-party-list]').querySelectorAll('input').forEach(input => { input.checked = selected.has(input.dataset.party); });
    q('[data-encoding]').textContent = increase ? 'Tamaño: abstenciones · Contorno: selección' : 'Puntos del mismo tamaño · Contorno: selección';
    if (redraw) draw(); else syncPoints();
  }
  function filterList() {
    const term = normalize(q('[data-search]').value);
    q('[data-party-list]').querySelectorAll('label').forEach(label => { label.hidden = !normalize(label.textContent).includes(term); });
    syncPoints();
  }
  function ticks(min, max, count = 4) {
    const step = (max - min) / count;
    return Array.from({ length: count + 1 }, (_, i) => min + i * step);
  }
  function draw() {
    if (!context) return;
    const focusedKey = svg.contains(document.activeElement) ? document.activeElement.closest('[data-key]')?.dataset.key : null;
    cancel(); svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
    const valid = points.filter(p => Number.isFinite(p.competition) && p.competition >= 0 && Number.isFinite(p.voters) && p.voters >= 0 && (!context.increase || (Number.isFinite(p.abstentions) && p.abstentions >= 0)));
    q('[data-coverage]').textContent = `${valid.length} ${context.unit === 'circuit' ? 'circuitos' : 'partidos'} representados; ${points.length - valid.length} excluidos por datos faltantes o inválidos.`;
    const minVoters = valid.length ? Math.min(...valid.map(p => p.voters)) : 0;
    const full = { xmin: 0, xmax: Math.max(.01, ...valid.map(p => p.competition)) * 1.08, ymin: logarithmic && minVoters > 0 ? minVoters / 1.2 : 0, ymax: Math.max(1, ...valid.map(p => p.voters)) * 1.08 };
    const d = zoomDomain || full, ymin = transformY(d.ymin), ymax = transformY(d.ymax);
    const amax = Math.max(1, ...valid.map(p => p.abstentions).filter(Number.isFinite));
    q('[data-size]').textContent = context.increase ? `Área proporcional a las abstenciones. Mayor burbuja: ${n(amax)} abstenciones; cero se indica con un punto mínimo. El área no representa votos de la fuerza.` : 'Todos los puntos tienen el mismo tamaño. Las abstenciones se consultan en la ficha de cada territorio.';
    const left = 66, right = size.width - 22, top = 26, bottom = size.height - 45;
    const px = value => left + (value - d.xmin) / (d.xmax - d.xmin) * (right - left);
    const py = value => bottom - (transformY(value) - ymin) / (ymax - ymin) * (bottom - top);
    const defs = node('defs', {}), clip = node('clipPath', { id: 'simPlotClip' }, undefined, defs);
    const padding = context.increase ? 22 : 8;
    node('rect', { x: left - padding, y: top - padding, width: right - left + 2 * padding, height: bottom - top + 2 * padding }, undefined, clip);
    node('rect', { x: left, y: top, width: right - left, height: bottom - top, class: 'sim-plot-background' });
    for (const value of ticks(d.xmin, d.xmax)) {
      const x = px(value);
      node('line', { x1: x, x2: x, y1: top, y2: bottom, class: 'sim-grid-line' });
      node('text', { x, y: bottom + 17, 'text-anchor': 'middle', class: 'sim-tick' }, (value * 100).toFixed(1));
    }
    let yTicks = ticks(d.ymin, d.ymax, size.height < 260 ? 3 : 4);
    if (logarithmic) {
      yTicks = [0];
      for (let power = 0; power <= Math.ceil(Math.log10(d.ymax)); power++) for (const multiplier of [1, 3]) {
        const value = multiplier * 10 ** power;
        if (value >= Math.max(100, d.ymin) && value <= d.ymax) yTicks.push(value);
      }
      yTicks = yTicks.filter(v => v >= d.ymin && v <= d.ymax);
      // Keep labels at least 24 pixels apart in compact mode.
      yTicks = yTicks.reduce((kept, v) => { if (!kept.length || Math.abs(py(v) - py(kept[kept.length - 1])) >= 24) kept.push(v); return kept; }, []);
    }
    for (const value of yTicks) {
      const y = py(value);
      node('line', { x1: left, x2: right, y1: y, y2: y, class: 'sim-grid-line' });
      node('text', { x: left - 8, y: y + 3, 'text-anchor': 'end', class: 'sim-tick' }, value >= 1000 ? `${Number((value / 1000).toFixed(0))} mil` : n(Math.round(value)));
    }
    node('text', { x: left, y: 14, class: 'sim-axis-label' }, `Volumen electoral · votantes observados${logarithmic ? ' · escala logarítmica' : ''}`);
    node('text', { x: (left + right) / 2, y: size.height - 5, 'text-anchor': 'middle', class: 'sim-axis-label' }, '← Más competencia · Competitividad: diferencia entre 1.ª y 2.ª (pp)');
    const marks = node('g', { 'clip-path': 'url(#simPlotClip)' });
    plotted = valid.map(p => ({ ...p, x: px(p.competition), y: py(p.voters), visible: p.competition >= d.xmin && p.competition <= d.xmax && p.voters >= d.ymin && p.voters <= d.ymax }));
    [...plotted].sort((a,b) => context.increase ? b.abstentions - a.abstentions : 0).forEach(p => {
      const radius = context.increase ? (p.abstentions ? Math.min(20, Math.max(8, (bottom - top) * .08)) * Math.sqrt(p.abstentions / amax) : 2) : 5.5;
      const group = node('g', { class: 'sim-territory-node', tabindex: p.visible ? 0 : -1, role: 'button', 'aria-pressed': selected.has(p.key), 'aria-label': tooltip(p), 'data-key': p.key, 'data-name': p.name }, undefined, marks);
      node('circle', { cx: p.x, cy: p.y, r: Math.max(9, radius), fill: 'transparent', 'aria-hidden': 'true', class: 'sim-point-hit' }, undefined, group);
      node('circle', { cx: p.x, cy: p.y, r: radius, class: 'sim-territory-point', style: `--point-color:${indexAppearance.color(p.key,context.unit)}` }, undefined, group);
      node('title', {}, tooltip(p), group);
      const inspect = () => { q('[data-tooltip]').textContent = tooltip(p); };
      group.addEventListener('pointerenter', inspect); group.addEventListener('focus', inspect);
      group.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(p.key); } });
    });
    syncPoints();
    if (focusedKey) svg.querySelector(`[data-key="${CSS.escape(focusedKey)}"]`)?.focus({ preventScroll: true });
  }
  const position = event => {
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  };
  function cancel() { if (pointerId !== null && svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId); pointerId = null; polygon?.remove(); polygon = null; path = []; }
  svg.addEventListener('pointerdown', e => {
    if (!lasso || e.button !== 0 || pointerId !== null) return;
    pointerId = e.pointerId; startTarget = e.target.closest('[data-key]')?.dataset.key;
    path = [position(e)]; svg.setPointerCapture(pointerId);
    polygon = node('polygon', { class: 'sim-lasso', points: '' }); e.preventDefault();
  });
  svg.addEventListener('pointermove', e => { if (e.pointerId !== pointerId) return; path.push(position(e)); polygon.setAttribute('points', path.map(p => `${p.x},${p.y}`).join(' ')); });
  svg.addEventListener('pointerup', e => {
    if (e.pointerId !== pointerId) return;
    path.push(position(e));
    const moved = path.some(p => Math.hypot(p.x - path[0].x, p.y - path[0].y) > 4);
    const next = moved && path.length >= 3 ? new Set(plotted.filter(p => p.visible && insideLasso(p, path)).map(p => p.key)) : null;
    const key = startTarget; cancel();
    if (next) change(next); else if (key) toggle(key);
  });
  svg.addEventListener('pointercancel', cancel); svg.addEventListener('lostpointercapture', cancel);
  svg.addEventListener('click', e => { if (!lasso) { const key = e.target.closest('[data-key]')?.dataset.key; if (key) toggle(key); } });
  q('[data-clear]').addEventListener('click', () => change(new Set()));
  q('[data-map]').addEventListener('click', () => showMap(new Set(selected)));
  q('[data-list]').addEventListener('click', e => { const key = e.target.closest('[data-remove]')?.dataset.remove; if (key) { const next = new Set(selected); next.delete(key); change(next); } });
  q('[data-party-list]').addEventListener('change', e => { const key = e.target.dataset.party; if (key) toggle(key); });
  q('[data-search]').addEventListener('input', filterList);
  q('[data-undo]').addEventListener('click', () => { if (previous !== null) { const next = previous; previous = new Set(selected); selected = next; render(); onSelection(new Set(selected)); } });
  q('[data-log]').addEventListener('change', () => { logarithmic = q('[data-log]').checked; draw(); });
  q('[data-full]').addEventListener('click', () => { zoomDomain = null; draw(); });
  q('[data-zoom]').addEventListener('click', () => {
    const chosen = plotted.filter(p => selected.has(p.key));
    if (!chosen.length) return;
    const xmin = Math.min(...chosen.map(p => p.competition)), xmax = Math.max(...chosen.map(p => p.competition));
    const ymin = Math.min(...chosen.map(p => p.voters)), ymax = Math.max(...chosen.map(p => p.voters));
    const xp = Math.max(.015, (xmax - xmin) * .18), yp = Math.max(1000, (ymax - ymin) * .18);
    zoomDomain = { xmin: Math.max(0, xmin - xp), xmax: xmax + xp, ymin: Math.max(0, ymin - yp), ymax: ymax + yp }; draw();
  });
  q('[data-lasso]').addEventListener('click', () => {
    lasso = !lasso; cancel(); svg.classList.toggle('is-lasso-active', lasso);
    q('[data-lasso]').setAttribute('aria-pressed', String(lasso));
    q('[data-lasso-help]').textContent = lasso ? 'Lazo activo: arrastrá para reemplazar la selección.' : 'Clic o Enter para seleccionar.';
  });
  const floating = document.createElement('section');
  floating.className = 'sim-chart-floating'; floating.hidden = true;
  floating.setAttribute('role', 'dialog'); floating.setAttribute('aria-modal', 'false'); floating.setAttribute('aria-labelledby', 'simExpandedTitle');
  floating.innerHTML = `<header><h2 id="simExpandedTitle">Distribución de partidos <span>Arrastrá para mover</span></h2><button type="button" data-close-chart>Acoplar gráfico</button></header>`;
  document.body.append(floating);
  const placeholder = document.createElement('section'); placeholder.className = 'sim-chart-placeholder'; placeholder.hidden = true;
  placeholder.innerHTML = `<span class="section-title">Gráfico flotante</span><p>Podés seleccionar partidos en el mapa o la lista mientras el gráfico está abierto.</p><button type="button" data-dock>Devolver el gráfico a este panel</button>`;
  chartHost.before(placeholder);
  function dock({ restoreFocus = true } = {}) {
    if (floating.hidden) return;
    cancel(); placeholder.after(chartHost); placeholder.hidden = true; floating.hidden = true;
    q('[data-expand]').hidden = false;
    if (restoreFocus) q('[data-expand]').focus({ preventScroll: true });
  }
  function clampPosition() {
    if (floating.hidden) return;
    const box = floating.getBoundingClientRect();
    floating.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - box.width - 8))}px`;
    floating.style.top = `${Math.max(8, Math.min(box.top, window.innerHeight - box.height - 8))}px`;
  }
  q('[data-expand]').addEventListener('click', () => {
    placeholder.hidden = false; floating.append(chartHost); floating.hidden = false;
    if (!floating.style.left) { floating.style.left = `${Math.max(8, window.innerWidth * .21)}px`; floating.style.top = '70px'; }
    q('[data-expand]').hidden = true; clampPosition(); floating.querySelector('[data-close-chart]').focus({ preventScroll: true });
  });
  floating.querySelector('[data-close-chart]').addEventListener('click', () => dock());
  placeholder.querySelector('[data-dock]').addEventListener('click', () => dock());
  let drag = null;
  const handle = floating.querySelector('header');
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const box = floating.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: box.left, top: box.top };
    handle.setPointerCapture(event.pointerId); event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    floating.style.left = `${drag.left + event.clientX - drag.x}px`;
    floating.style.top = `${drag.top + event.clientY - drag.y}px`; clampPosition();
  });
  const stopDrag = () => { if (drag && handle.hasPointerCapture(drag.id)) handle.releasePointerCapture(drag.id); drag = null; };
  handle.addEventListener('pointerup', stopDrag); handle.addEventListener('pointercancel', stopDrag); handle.addEventListener('lostpointercapture', stopDrag);
  window.addEventListener('resize', clampPosition);
  new ResizeObserver(clampPosition).observe(floating);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !floating.hidden && !document.querySelector('dialog[open]')) { event.preventDefault(); dock(); }
  });
  new ResizeObserver(() => {
    const width = Math.max(620, Math.round(wrap.clientWidth)), height = Math.max(160, Math.round(wrap.clientHeight));
    if (!wrap.clientWidth || !wrap.clientHeight || (size.width === width && size.height === height)) return;
    size = { width, height }; draw();
  }).observe(wrap);
  return {
    selection: () => new Set(selected), toggle, dock,
    update(next) {
      const changed = !context || context.unit !== next.unit || Object.keys(context.rows).join('|') !== Object.keys(next.rows).join('|');
      context = next; points = territoryPoints(next.rows, next.scenario.force.name, next.unit || 'party');
      if (next.selection !== undefined || changed) {
        selected = new Set([...(next.selection || selected)].filter(key=>key in next.rows));
        previous = null; zoomDomain = null; q('[data-search]').value = '';
      }
      if (changed) q('[data-party-list]').innerHTML = [...points].sort((a,b) => a.name.localeCompare(b.name,'es')).map(p => `<label><input type="checkbox" data-party="${esc(p.key)}"><span>${esc(p.name)}</span></label>`).join('');
      const plural = context.unit === 'circuit' ? 'circuitos' : 'partidos';
      q('[data-log]').nextSibling.textContent = ` Separar ${plural} pequeños `;
      host.querySelector('.section-title').textContent = `Elegir ${plural}`;
      chartHost.querySelector('.section-title').textContent = `Distribución de ${plural}`;
      floating.querySelector('h2').textContent = `Distribución de ${plural}`;
      q('[data-list]').closest('details').querySelector('summary').textContent = `${context.unit === 'circuit' ? 'Circuitos' : 'Partidos'} seleccionados`;
      q('[data-search]').placeholder = context.unit === 'circuit' ? 'Partido o circuito…' : 'Nombre del partido…';
      q('[data-tooltip]').textContent = 'Pasá por un punto para identificar el territorio y consultar sus datos.';
      svg.setAttribute('aria-label',`${plural}: competitividad y volumen electoral`);
      filterList(); render(true);
    },
  };
}
