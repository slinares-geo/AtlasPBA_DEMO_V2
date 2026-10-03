import { latestElection, observe, simulate } from './simulator-model.mjs';
import { setupTerritoryExplorer } from './simulator-territory.mjs';
import { circuitCoverage, allocateCircuitNewVoters } from './simulator-territory-model.mjs';

export function setupSimulator({ data, indexAppearance, aggregateRows, formatNumber: n, formatPct: pct, formatPp: pp, kpi, escapeHtml: esc, enterTerritoryView, updateTerritoryView, leaveTerritoryView, showTerritoryMap }) {
  const trigger = document.querySelector('#openSimulator');
  const dialog = document.createElement('dialog');
  dialog.className = 'simulator';
  dialog.setAttribute('aria-labelledby', 'simTitle');
  dialog.innerHTML = `<header><div><span class="sim-eyebrow">Simulación provincial</span><h1 id="simTitle">Tu escenario</h1></div><button id="simClose" type="button">Volver al Atlas</button></header>
    <p id="simBase" class="sim-base"></p>
    <div class="sim-provincial-layout"><section class="sim-controls" aria-label="Definir escenario"><h2>Definí el escenario</h2>
    <label>Fuerza política<select id="simForce"></select></label><p class="sim-help">Cada fuerza comienza con su resultado observado.</p>
    <label>¿Qué porcentaje buscás alcanzar?<output id="simShareValue" for="simShare"></output><input id="simShare" type="range" max="100" step="any"></label>
    <p class="sim-help">Sobre votos positivos, a partir del resultado observado.</p>
    <label class="sim-check"><input id="simIncrease" type="checkbox"> Incluir un aumento de participación</label>
    <div id="simRepeatLabel" hidden><label class="sim-check"><input id="simRepeat" type="checkbox"> Repetir la distribución de la elección base</label></div>
    <div id="simTurnoutLabel" hidden><label>¿Qué participación esperás?<output id="simTurnoutValue" for="simTurnout"></output><input id="simTurnout" type="range" max="100" step="any"></label></div>
    <button id="simReset" type="button">Restablecer escenario</button><p class="sim-help">Conserva la fuerza y los partidos elegidos.</p><p class="sim-help">Es una simulación, no una predicción.</p></section>
    <section class="sim-result" aria-label="Resultado del escenario"><h2>Resultado del escenario</h2><div id="simKpis" class="sim-kpis"></div><p id="simStatus" role="status"></p><div id="simComposition" class="sim-composition"></div>
    <section class="sim-comparison"><h3>Comparación del escenario</h3><div class="sim-table"><table><thead><tr><th>Indicador</th><th>Observado</th><th>Escenario</th><th>Diferencia</th></tr></thead><tbody id="simComparison"></tbody></table></div></section>
    <details><summary>Cómo funciona el modelo</summary><p>El escenario toma toda la provincia, sin aplicar los filtros del Atlas. Los porcentajes se calculan sobre votos positivos. El padrón y los datos observados no se modifican.</p><p id="simRule"></p><p id="simVoteTypes" hidden></p><p>Ese potencial no significa que los votos se transfieran efectivamente ni mide la probabilidad de conseguirlos. Los votos requeridos se redondean hacia arriba y los votantes al entero más próximo.</p><p id="simMetadata"></p></details>
    <button id="simExplore" class="sim-primary" type="button">Explorar partidos →</button></section></div>`;
  document.body.append(dialog);
  const shell = document.querySelector('.app-shell');
  const controls = document.createElement('aside');
  controls.id = 'simTerritory'; controls.className = 'topbar sim-explorer-controls'; controls.hidden = true;
  const chart = document.createElement('section');
  chart.className = 'sim-explorer-chart'; chart.hidden = true;
  const summary = document.createElement('aside');
  summary.className = 'ranking-panel sim-explorer-summary'; summary.hidden = true;
  shell.append(controls, summary);
  document.querySelector('.map-column').append(chart);
  controls.innerHTML = `<div class="brand"><span class="brand-mark"></span><div class="brand-copy"><strong>Atlas Electoral PBA</strong><span>Análisis territorial del voto</span></div></div><div class="sim-view-heading"><span class="section-title">Simulador de escenarios</span><p class="sim-base" data-base></p></div><section class="sim-mini" aria-label="Situación provincial observada y objetivo"><strong data-mini-force></strong><div data-mini-comparison></div><div class="panel-actions" aria-label="Navegación del escenario"><button id="simEdit" type="button">Editar escenario</button><button id="simExit" type="button">Volver al Atlas</button></div></section><div data-explorer></div>`;
  const el = id => dialog.querySelector('#sim' + id);
  const steps = document.createElement('section');
  steps.className = 'sim-territory-steps';
  steps.innerHTML = '<strong data-step-label>1. Elegí partidos</strong><div class="panel-actions"><button type="button" id="simCircuits" disabled>Zoom a circuitos</button><button type="button" id="simParties" hidden>Volver a partidos</button><button type="button" id="simMapReset">Reiniciar mapa</button></div><p class="sim-help" data-step-status role="status"></p>';
  controls.querySelector('[data-explorer]').before(steps);
  let base, params, sourceId, exploring = false, unit = 'party', parentParties = new Set(), circuitError = null;
  const mapOptions = (keys = explorer.selection()) => ({ keys, unit, parentParties:new Set(parentParties), electionId:sourceId, force:params.force });
  const syncSteps = () => {
    controls.querySelector('#simCircuits').hidden = unit === 'circuit';
    controls.querySelector('#simCircuits').disabled = !explorer.selection().size || Boolean(circuitError);
    controls.querySelector('#simParties').hidden = unit !== 'circuit';
    steps.querySelector('[data-step-label]').textContent = unit === 'party' ? '1. Elegí partidos' : '2. Ajustá los circuitos';
    steps.querySelector('[data-step-status]').textContent = circuitError || (unit === 'circuit' ? `${parentParties.size} partidos en el área de trabajo` : '');
  };
  const explorer = setupTerritoryExplorer(controls.querySelector('[data-explorer]'), {
    chartHost: chart, summaryHost: summary, indexAppearance,
    aggregateRows, formatNumber: n, formatPct: pct, formatPp: pp, kpi, escapeHtml: esc,
    onSelection: keys => { syncSteps(); if (exploring) updateTerritoryView(mapOptions(keys)); },
    showMap: keys => showTerritoryMap(keys),
  });
  function reset(force = params?.force || base.forces[0].name) {
    const observed = base.forces.find(f => f.name === force).votes / base.positivos;
    params = { force, share: observed, increase: false, repeatDistribution:false, turnout: base.turnout };
    el('Force').value = force;
    el('Share').min = String(observed * 100);
    el('Turnout').min = String(base.turnout * 100);
    el('Increase').checked = false;
    render();
  }
  function render(selection) {
    const r = simulate(base, params);
    for (const [id, value] of [['Share', params.share], ['Turnout', params.turnout]]) {
      el(id).value = String(value * 100);
      el(id + 'Value').textContent = pct(value, 2);
      el(id).setAttribute('aria-valuetext', pct(value, 2));
    }
    el('TurnoutLabel').hidden = !params.increase;
    el('RepeatLabel').hidden = !params.increase;
    el('Repeat').checked = params.repeatDistribution;
    el('Repeat').disabled = !base.repeatAvailable;
    el('Repeat').title = base.repeatAvailable ? '' : 'La elección no tiene un desglose completo de tipos de voto.';
    el('Rule').textContent = r.repeatDistribution
      ? 'Los nuevos votantes repiten la distribución provincial de la elección base entre fuerzas y tipos de voto. Se suma el aporte de la fuerza elegida y se calcula cuánto falta cubrir con votos de otras fuerzas. Solo los nuevos positivos aumentan el denominador del objetivo.'
      : 'Cada nuevo votante aporta un positivo disponible para la fuerza elegida. Para cubrir el objetivo se consideran primero votos de otras fuerzas y después nuevos votos. Solo se asignan los necesarios; el resto queda sin asignar.';
    el('VoteTypes').hidden = !r.repeatDistribution;
    el('VoteTypes').textContent = r.repeatDistribution ? `Nuevos votos: ${n(r.newPositives)} positivos; ${n(r.newByType.blanco)} blancos; ${n(r.newByType.nulo)} nulos; ${n(r.newByType.impugnado)} impugnados; ${n(r.newByType.recurrido)} recurridos.` : '';
    const unchanged = params.share === r.observedShare && !params.increase;
    el('Status').textContent = unchanged ? 'Todavía no modificaste el resultado observado.' : r.feasible ? 'Hay potencial provincial suficiente para el objetivo bajo estos supuestos.' : `Con estas fuentes se llega a ${pct(r.achievedShare, 1)}; faltan ${n(r.missing)} votos para alcanzar el objetivo de ${pct(r.share, 1)}.`;
    el('Status').className = r.feasible ? 'sim-status' : 'sim-warning';
    el('Kpis').innerHTML = [
      kpi('Resultado del escenario', pct(r.achievedShare, 1), `Observado: ${pct(r.observedShare, 1)} · Cambio: ${pp(r.achievedShare - r.observedShare, 1)}`),
      kpi('Porcentaje objetivo', pct(r.share, 1), r.feasible ? 'Objetivo alcanzable' : `Brecha: ${pp(r.share - r.achievedShare, 1)}`),
      kpi('Votos adicionales necesarios', n(r.additional), 'Para el objetivo solicitado'),
    ].join('');
    el('Composition').innerHTML = `<p>Para este escenario: <strong>${n(r.transferred)} votos</strong> de otras fuerzas.${params.increase ? r.repeatDistribution ? ` De ${n(r.newcomers)} nuevos votantes, <strong>${n(r.fromNew)}</strong> corresponden a la fuerza elegida según la distribución provincial de base.` : ` Nuevos votos utilizados: <strong>${n(r.fromNew)}</strong> de ${n(r.newcomers)} nuevos votantes; ${n(r.unassigned)} sin asignar.` : ' La participación no cambia.'}</p>`;
    const rows = [
      ['Votos de la fuerza elegida', r.force.votes, r.achieved, n, n],
      ['% de la fuerza elegida', r.observedShare, r.achievedShare, v => pct(v, 3), v => pp(v, 3)],
      ['Votos de las otras fuerzas', r.otherVotes, r.remaining, n, n],
      ['Participación', base.turnout, r.turnout, v => pct(v, 3), v => pp(v, 3)],
      ['Votantes', base.votantes, r.voters, n, n],
      ['Total de votos positivos', base.positivos, r.denominator, n, n],
      ['Electores habilitados', base.electores, base.electores, n, n],
    ];
    el('Comparison').innerHTML = rows.map(([label, a, b, fmt, diff]) => `<tr><th scope="row">${label}</th><td>${a === null ? 'No corresponde' : fmt(a)}</td><td>${b === null ? 'No corresponde' : fmt(b)}</td><td>${a === null ? '—' : diff(b - a)}</td></tr>`).join('');
    controls.querySelector('[data-mini-force]').textContent = params.force;
    controls.querySelector('[data-mini-comparison]').innerHTML = `<table class="sim-baseline-table"><caption>Situación provincial de la fuerza elegida</caption><thead><tr><th>Situación</th><th>Votos</th><th>%</th></tr></thead><tbody><tr><th scope="row">Observada</th><td>${n(r.force.votes)}</td><td>${pct(r.observedShare, 1)}</td></tr><tr class="sim-target-row"><th scope="row">Objetivo</th><td>${n(r.required)}</td><td>${pct(r.share, 1)}</td></tr>${r.feasible ? '' : `<tr><th scope="row">Alcanzable</th><td>${n(r.achieved)}</td><td>${pct(r.achievedShare, 1)}</td></tr>`}</tbody></table><p class="sim-percent-note">% sobre votos positivos provinciales de cada situación.</p><p class="sim-needed"><span>Votos adicionales necesarios</span><strong>${n(r.additional)}</strong></p>${r.feasible ? '' : `<p class="sim-warning">Faltan ${n(r.missing)} votos: el objetivo provincial no es alcanzable con estas fuentes.</p>`}${params.increase ? `<p class="sim-help">Participación: ${pct(base.turnout, 1)} → ${pct(r.turnout, 1)} · ${n(r.newcomers)} nuevos votantes.</p>` : ''}`;
    const parties = data.party.elections[sourceId], circuits = data.circuit.elections[sourceId];
    const territoryRows = unit === 'party' ? parties : Object.fromEntries(Object.entries(circuits).filter(([,row])=>parentParties.has(row.partido_norm)));
    explorer.update({ rows:territoryRows, unit, base, scenario:r, increase:params.increase, selection,
      allocation:unit === 'circuit' ? allocateCircuitNewVoters(parties,circuits,base,r) : null });
    syncSteps();
    if (exploring) updateTerritoryView(mapOptions());
  }
  function open() {
    try {
      if (!base) {
        const { source, ambiguous } = latestElection(data);
        sourceId = source.id;
        base = observe(aggregateRows(Object.values(data.party.elections[sourceId])));
        try { circuitCoverage(data.party.elections[sourceId],data.circuit.elections[sourceId] || {}); }
        catch (error) { circuitError = error.message; }
        el('Base').textContent = `Elección base: ${source.label} · Toda la provincia`;
        controls.querySelector('[data-base]').textContent = `Elección base: ${source.label}`;
        el('Metadata').textContent = ambiguous ? 'Entre las elecciones del último año sin fecha detallada, se usa primero la predeterminada del Atlas; el identificador resuelve los empates restantes.' : 'Se utiliza la elección más reciente con datos de votantes disponibles en Atlas.';
        el('Force').innerHTML = base.forces.map(f => `<option value="${esc(f.name)}">${esc(f.name)}</option>`).join('');
        reset();
      }
      el('Close').textContent = exploring ? 'Volver al mapa' : 'Volver al Atlas';
      if (!dialog.open) dialog.showModal();
      trigger.setAttribute('aria-pressed', 'true');
      el('Force').focus();
    } catch (error) { window.alert(`No se pudo abrir el simulador: ${error.message}`); }
  }
  function explore() {
    if (!exploring) {
      enterTerritoryView({ ...mapOptions(), onToggle: key => explorer.toggle(key) });
      exploring = true;
      document.body.classList.add('is-simulator-exploring');
      controls.hidden = chart.hidden = summary.hidden = false;
    }
    dialog.close();
    controls.querySelector('#simEdit').focus({ preventScroll: true });
  }
  function exit() {
    dialog.close();
    explorer.dock({ restoreFocus: false });
    exploring = false;
    document.body.classList.remove('is-simulator-exploring');
    controls.hidden = chart.hidden = summary.hidden = true;
    leaveTerritoryView();
    trigger.setAttribute('aria-pressed', 'false'); trigger.focus({ preventScroll: true });
  }
  trigger.addEventListener('click', open);
  controls.querySelector('#simEdit').addEventListener('click', open);
  controls.querySelector('#simExit').addEventListener('click', exit);
  controls.querySelector('#simCircuits').addEventListener('click', () => {
    if (unit !== 'party' || circuitError || !explorer.selection().size) return;
    parentParties = explorer.selection(); unit = 'circuit';
    const keys = new Set(Object.entries(data.circuit.elections[sourceId]).filter(([,row])=>parentParties.has(row.partido_norm)).map(([key])=>key));
    render(keys); updateTerritoryView({...mapOptions(),fit:true});
  });
  controls.querySelector('#simParties').addEventListener('click', () => {
    unit = 'party'; const keys = new Set(parentParties); parentParties.clear();
    render(keys); updateTerritoryView({...mapOptions(),fit:true});
  });
  controls.querySelector('#simMapReset').addEventListener('click', () => {
    unit = 'party'; parentParties.clear(); render(new Set());
    updateTerritoryView({...mapOptions(),fit:true});
  });
  el('Explore').addEventListener('click', explore);
  el('Force').addEventListener('change', () => reset(el('Force').value));
  for (const id of ['Share', 'Turnout']) {
    el(id).addEventListener('input', () => {
      const input = el(id), value = Number(input.value);
      if (!input.value.trim() || !Number.isFinite(value)) { render(); return; }
      const min = Number(el(id).min);
      params[id === 'Share' ? 'share' : 'turnout'] = Math.min(100, Math.max(min, value)) / 100;
      render();
    });
    el(id).addEventListener('keydown', event => {
      const directions = {ArrowLeft:-1, ArrowDown:-1, ArrowRight:1, ArrowUp:1};
      if (!(event.key in directions) && !['Home','End'].includes(event.key)) return;
      event.preventDefault();
      const min = Number(el(id).min);
      el(id).value = String(event.key === 'Home' ? min : event.key === 'End' ? 100 : Math.max(min, Math.min(100, Number(el(id).value) + directions[event.key] * (event.shiftKey ? 1 : .1))));
      el(id).dispatchEvent(new Event('input', {bubbles:true}));
    });
  }
  el('Increase').addEventListener('change', () => { params.increase = el('Increase').checked; params.repeatDistribution = false; params.turnout = base.turnout; render(); });
  el('Repeat').addEventListener('change', () => { params.repeatDistribution = el('Repeat').checked; render(); });
  el('Reset').addEventListener('click', () => reset());
  el('Close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    trigger.setAttribute('aria-pressed', String(exploring));
    (exploring ? controls.querySelector('#simEdit') : trigger).focus({ preventScroll: true });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && exploring && !document.querySelector('dialog[open]') && !event.defaultPrevented) { event.preventDefault(); exit(); }
  });
}
