const state = {
  map: null,
  partyLayer: null,
  circuitMap: null,
  circuitLayer: null,
  scatterMainLayer: null,
  highlightPinLayer: null,
  data: null,
  partyGeojson: null,
  circuitGeojson: null,
  baseElection: null,
  targetElection: null,
  selectedParty: null,
  selectedCircuit: null,
  viewMode: "target",
  indicator: "participacion",
  voteType: "positivo",
  positiveMeasure: "share_positive",
  force: "LLA",
  activeQuestion: null,
  questionUnit: null,
  mapLevel: "party",
  centroidCache: { party: new Map(), circuit: new Map() },
  scatterSelection: new Set(),
  pinnedCircuitMaps: [],
  reportMap: null,
  reportLayer: null,
  reportPinLayer: null,
  homeView: { center: [-36.25, -60.1], zoom: 5.75 },
};

const COLORS = {
  positive: "#cc4778",
  negative: "#cc4778",
  neutral: "#ffffff",
  accent: "#f2c14e",
  border: "rgba(31, 26, 21, .55)",
  lla: "#6a4b9b",
  peronismo: "#2abbcd",
  participacion: "#2f8d6f",
  ausentismo: "#c4872c",
  competitividad: "#d45b75",
  blanco: "#77808a",
  nulo: "#4d5662",
  impugnado: "#a16535",
  recurrido: "#7b6d8d",
};

const FORCE_LABELS = {
  LLA: "La Libertad Avanza",
  PERONISMO_K: "Peronismo/K",
};

const STACK_FALLBACK_COLORS = ["#d94f70", "#238f9d", "#e7b84d", "#7b6d8d", "#5f8f53", "#b36b42"];

const COMPETITIVENESS_CLASSES = [
  { max: 0.05, label: "Muy competitiva", color: "#136f7b" },
  { max: 0.10, label: "Competitiva", color: "#2f9daf" },
  { max: 0.15, label: "Moderadamente competitiva", color: "#77bdc9" },
  { max: 0.20, label: "Baja competitividad", color: "#c9d8d8" },
  { max: Infinity, label: "Hegemónica", color: "#e6e3dc" },
];

const TOTAL_VOTE_SEGMENTS = [
  { key: "positivos", label: "Voto positivo", color: "#2f8d6f" },
  { key: "blanco", label: "Voto en blanco", color: COLORS.blanco },
  { key: "nulo", label: "Voto nulo", color: COLORS.nulo },
  { key: "recurrido", label: "Voto recurrido", color: COLORS.recurrido },
  { key: "impugnado", label: "Voto impugnado", color: COLORS.impugnado },
];

//ArgenMapGris
//const ARGENMAP_URL = "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png";

//ArgenMapColor
const ARGENMAP_URL = "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png";

//ArgenMapHibrido
//const ARGENMAP_URL = "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_hibrido@EPSG%3A3857@png/{z}/{x}/{-y}.png";



const VOTE_TYPE_LABELS = {
  positivo: "voto positivo",
  blanco: "voto en blanco",
  nulo: "voto nulo",
  impugnado: "voto impugnado",
  recurrido: "voto recurrido",
};

const POSITIVE_MEASURE_LABELS = {
  share_positive: "sobre votos positivos",
  share_total: "sobre total de votos",
  gap_winner: "distancia a la primera fuerza",
};

const METRICS = {
  base: [
    { value: "participacion", label: "Participación electoral", definition: "Votantes sobre electores habilitados.", domain: [0.45, 0.88], format: "pct" },
    { value: "ausentismo", label: "Ausentismo electoral", definition: "Electores que no votaron sobre electores habilitados.", domain: [0.12, 0.55], format: "pct" },
    { value: "competitividad", label: "Competitividad", definition: "Diferencia entre la primera y la segunda fuerza sobre votos positivos.", domain: [0, 0.5], format: "pct" },
    { value: "votos", label: "Voto por tipo o fuerza", definition: "Porcentaje del tipo de voto o fuerza seleccionada.", domain: null, format: "pct" },
  ],
};

const SCATTER_METRICS = [
  { value: "blanco_delta", label: "Cambio voto blanco", format: "pp" },
  { value: "nulo_delta", label: "Cambio voto nulo", format: "pp" },
  { value: "ausentismo_delta", label: "Cambio ausentismo", format: "pp" },
  { value: "lla_delta", label: "Cambio votos LLA", format: "pp" },
  { value: "peronismo_delta", label: "Cambio votos peronismo/k", format: "pp" },
  { value: "margen_delta", label: "Cambio competitividad", format: "pp" },
];

const QUESTIONS = [
  {
    id: "predominio-territorial",
    group: "Distribución territorial",
    label: "¿Qué fuerzas predominan?",
    description: "Muestra el mapa de voto positivo y el ranking territorial donde la fuerza seleccionada tiene mayor presencia.",
    mode: "target",
    indicator: "votos",
    voteType: "positivo",
    positiveMeasure: "share_positive",
    force: "LLA",
    sort: "desc",
    unit: "current",
    mapMode: "winner",
  },
  {
    id: "apoyos-peronismo-partidos",
    group: "Núcleos de fortaleza",
    label: "Mejores territorios del peronismo",
    description: "Ordena territorios por desempeño relativo del peronismo sobre votos positivos.",
    mode: "target",
    indicator: "votos",
    voteType: "positivo",
    positiveMeasure: "share_positive",
    force: "PERONISMO_K",
    sort: "desc",
    unit: "current",
  },
  {
    id: "apoyos-peronismo-circuitos",
    group: "Núcleos de fortaleza",
    label: "Mejores circuitos del peronismo",
    description: "Pasa la lectura al nivel territorial solicitado y ordena los mejores desempeños relativos del peronismo.",
    mode: "target",
    indicator: "votos",
    voteType: "positivo",
    positiveMeasure: "share_positive",
    force: "PERONISMO_K",
    sort: "desc",
    unit: "circuit",
  },
  {
    id: "crecio-peronismo",
    group: "Comparación temporal",
    label: "¿Dónde creció el peronismo?",
    description: "Compara 2023-2025 y ordena territorios por mayor aumento del voto peronista.",
    mode: "comparison",
    indicator: "votos",
    voteType: "positivo",
    positiveMeasure: "share_positive",
    force: "PERONISMO_K",
    sort: "desc",
    unit: "current",
  },
  {
    id: "cayo-peronismo",
    group: "Comparación temporal",
    label: "¿Dónde cayó el peronismo?",
    description: "Compara 2023-2025 y muestra los territorios con mayor retroceso relativo del peronismo.",
    mode: "comparison",
    indicator: "votos",
    voteType: "positivo",
    positiveMeasure: "share_positive",
    force: "PERONISMO_K",
    sort: "asc",
    unit: "current",
  },
  {
    id: "cambios-intensos",
    group: "Comparación temporal",
    label: "Cambios más intensos del peronismo",
    description: "Abre el cruce exploratorio para ubicar territorios con cambios fuertes del voto peronista y la competitividad.",
    mode: "comparison",
    indicator: "votos",
    voteType: "positivo",
    positiveMeasure: "share_positive",
    force: "PERONISMO_K",
    sort: "abs",
    unit: "current",
    scatter: { unit: "current", x: "peronismo_delta", y: "margen_delta", mode: "filter" },
    selectTop: 12,
  },
  {
    id: "debilidad-peronismo-electores",
    group: "Zonas de debilidad",
    label: "Debilidad y tamaño electoral",
    description: "Ordena los peores desempeños del peronismo y prioriza territorios con volumen relevante de electores.",
    mode: "target",
    indicator: "votos",
    voteType: "positivo",
    positiveMeasure: "share_positive",
    force: "PERONISMO_K",
    sort: "asc",
    unit: "current",
    filter: "largeElectorate",
  },
  {
    id: "competencia-abierta",
    group: "Competitividad electoral",
    label: "Competencia más abierta",
    description: "Ordena territorios donde la diferencia entre primera y segunda fuerza es menor.",
    mode: "target",
    indicator: "competitividad",
    sort: "asc",
    unit: "current",
  },
  {
    id: "cambio-competitividad",
    group: "Competitividad electoral",
    label: "Cambio de competitividad",
    description: "Compara el margen entre fuerzas y muestra dónde la distancia se amplió o redujo con mayor intensidad.",
    mode: "comparison",
    indicator: "competitividad",
    sort: "abs",
    unit: "current",
  },
  {
    id: "ausentismo-alto",
    group: "Ausentismo",
    label: "Mayor ausentismo",
    description: "Ordena territorios por mayor proporción de electores habilitados que no votaron.",
    mode: "target",
    indicator: "ausentismo",
    sort: "desc",
    unit: "current",
  },
  {
    id: "ausentismo-crece",
    group: "Ausentismo",
    label: "Aumento del ausentismo",
    description: "Compara elecciones y detecta dónde aumentó más el ausentismo.",
    mode: "comparison",
    indicator: "ausentismo",
    sort: "desc",
    unit: "current",
  },
  {
    id: "blanco-nulo-participacion",
    group: "Voto blanco y nulo",
    label: "Blanco, nulo y participación",
    description: "Cruza voto blanco con participación para explorar patrones territoriales atípicos.",
    mode: "comparison",
    indicator: "votos",
    voteType: "blanco",
    sort: "abs",
    unit: "current",
    scatter: { unit: "current", x: "blanco_delta", y: "nulo_delta", mode: "highlight" },
  },
];

const els = {
  loading: document.querySelector("#loading"),
  reportRoot: document.querySelector("#reportRoot"),
  modeElection: document.querySelector("#modeElection"),
  modeCompare: document.querySelector("#modeCompare"),
  baseElection: document.querySelector("#baseElection"),
  targetElection: document.querySelector("#targetElection"),
  compareElection: document.querySelector("#compareElection"),
  indicator: document.querySelector("#indicator"),
  voteType: document.querySelector("#voteType"),
  positiveMeasure: document.querySelector("#positiveMeasure"),
  force: document.querySelector("#force"),
  metricDefinition: document.querySelector("#metricDefinition"),
  openMethodology: document.querySelector("#openMethodology"),
  closeMethodology: document.querySelector("#closeMethodology"),
  methodologyModal: document.querySelector("#methodologyModal"),
  methodologyPanel: document.querySelector("#methodologyPanel"),
  kpiStrip: document.querySelector("#kpiStrip"),
  totalVoteStack: document.querySelector("#totalVoteStack"),
  totalVoteLegend: document.querySelector("#totalVoteLegend"),
  voteStack: document.querySelector("#voteStack"),
  voteStackLegend: document.querySelector("#voteStackLegend"),
  panelKicker: document.querySelector("#panelKicker"),
  panelTitle: document.querySelector("#panelTitle"),
  panelLead: document.querySelector("#panelLead"),
  metricsGrid: document.querySelector("#metricsGrid"),
  margin2023: document.querySelector("#margin2023"),
  margin2025: document.querySelector("#margin2025"),
  margin2023Label: document.querySelector("#margin2023Label"),
  margin2025Label: document.querySelector("#margin2025Label"),
  quickReading: document.querySelector("#quickReading"),
  rankingTitle: document.querySelector("#rankingTitle"),
  rankingList: document.querySelector("#rankingList"),
  legend: document.querySelector("#legend"),
  resetMap: document.querySelector("#resetMap"),
  mapSearchInput: document.querySelector("#mapSearchInput"),
  mapSearchResults: document.querySelector("#mapSearchResults"),
  mapLevelParty: document.querySelector("#mapLevelParty"),
  mapLevelCircuit: document.querySelector("#mapLevelCircuit"),
  openQuestions: document.querySelector("#openQuestions"),
  openScatter: document.querySelector("#openScatter"),
  questionWindow: document.querySelector("#questionWindow"),
  questionToggle: document.querySelector("#questionToggle"),
  questionMinimize: document.querySelector("#questionMinimize"),
  questionClose: document.querySelector("#questionClose"),
  activeQuestionLabel: document.querySelector("#activeQuestionLabel"),
  questionList: document.querySelector("#questionList"),
  assistantResponse: document.querySelector("#assistantResponse"),
  circuitDrawer: document.querySelector("#circuitDrawer"),
  drawerTitle: document.querySelector("#drawerTitle"),
  closeDrawer: document.querySelector("#closeDrawer"),
  pinParty: document.querySelector("#pinParty"),
  exportReport: document.querySelector("#exportReport"),
  exportData: document.querySelector("#exportData"),
  scatterPanel: document.querySelector("#scatterPanel"),
  closeScatter: document.querySelector("#closeScatter"),
  scatterUnit: document.querySelector("#scatterUnit"),
  scatterX: document.querySelector("#scatterX"),
  scatterY: document.querySelector("#scatterY"),
  scatterMode: document.querySelector("#scatterMode"),
  scatterChart: document.querySelector("#scatterChart"),
  scatterStats: document.querySelector("#scatterStats"),
  clearScatterSelection: document.querySelector("#clearScatterSelection"),
};

function formatPct(value, digits = 1) {
  return isFiniteNumber(value) ? `${(value * 100).toFixed(digits)}%` : "s/d";
}

function formatPp(value, digits = 1) {
  if (!isFiniteNumber(value)) return "s/d";
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(digits)} pp`;
}

function formatNumber(value) {
  return isFiniteNumber(value) ? new Intl.NumberFormat("es-AR").format(Math.round(value)) : "s/d";
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function fmt(value, format) {
  if (format === "pct") return formatPct(value);
  if (format === "pp") return formatPp(value);
  return formatNumber(value);
}

function formatGapPp(value) {
  return isFiniteNumber(value) ? `${(value * 100).toFixed(1)} pp` : "s/d";
}

function competitivenessCategory(gap) {
  if (!isFiniteNumber(gap)) return null;
  return COMPETITIVENESS_CLASSES.find((item) => gap <= item.max)?.label || null;
}

function competitivenessColor(gap) {
  if (!isFiniteNumber(gap)) return "rgba(244,239,228,.22)";
  return COMPETITIVENESS_CLASSES.find((item) => gap <= item.max)?.color || COMPETITIVENESS_CLASSES[COMPETITIVENESS_CLASSES.length - 1].color;
}

function competitivenessVoteGap(row) {
  if (!row) return null;
  const gap = (row.ganador_votos || 0) - (row.segundo_votos || 0);
  return Number.isFinite(gap) ? Math.max(0, gap) : null;
}

function winnerShare(row) {
  if (!row?.ganador || !row.positivos) return null;
  const votes = row.fuerzas?.[row.ganador] ?? row.ganador_votos;
  return isFiniteNumber(votes) ? votes / row.positivos : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function electionLabel(id) {
  return state.data.sources.find((source) => source.id === id)?.label || id;
}

function unitData(unit, electionId) {
  return state.data[unit].elections[electionId] || {};
}

function currentUnit() {
  return state.questionUnit || (state.selectedParty ? "circuit" : "party");
}

function effectiveQuestionUnit(question) {
  if (question?.unit === "current") return state.mapLevel === "circuit" ? "circuit" : "party";
  return question?.unit || "party";
}

function unitLabel(unit, plural = true) {
  if (unit === "circuit") return plural ? "circuitos" : "circuito";
  return plural ? "partidos" : "partido";
}

function currentMetricList() {
  return METRICS.base;
}

function currentMetric() {
  return currentMetricList().find((metric) => metric.value === state.indicator) || currentMetricList()[0];
}

function currentElectionId() {
  return state.targetElection;
}

function rowFor(key, unit) {
  return state.viewMode === "comparison" ? comparisonRow(key, unit) : unitData(unit, state.targetElection)[key] || null;
}

function rowForFeature(feature, unit, electionId = state.targetElection) {
  const rows = unitData(unit, electionId);
  const key = feature?.properties?.key;
  if (rows[key]) return rows[key];
  if (unit === "circuit") {
    return Object.values(rows).find((row) =>
      row.partido_norm === feature?.properties?.partido_norm &&
      String(row.circuito) === String(feature?.properties?.circuito)
    ) || null;
  }
  if (unit === "party") {
    return Object.values(rows).find((row) => row.partido_norm === key || row.partido_norm === feature?.properties?.partido_norm) || null;
  }
  return null;
}

function valueForFeature(feature, unit) {
  const target = rowForFeature(feature, unit, state.targetElection);
  const base = rowForFeature(feature, unit, state.baseElection);
  const targetValue = metricValue(target);
  if (state.viewMode !== "comparison") return targetValue;
  const baseValue = metricValue(base);
  return isFiniteNumber(targetValue) && isFiniteNumber(baseValue) ? targetValue - baseValue : null;
}

function isGapWinnerMetric() {
  return state.indicator === "votos" && state.voteType === "positivo" && state.positiveMeasure === "gap_winner";
}

function selectedForceDistance(row) {
  if (!row) return null;
  const selected = row.bloques_pct?.[state.force] ?? null;
  const values = Object.values(row.bloques_pct || {}).filter(isFiniteNumber);
  if (!isFiniteNumber(selected) || !values.length) return null;
  const top = Math.max(...values);
  return selected - top;
}

function selectedForceIsFirst(row) {
  const distance = selectedForceDistance(row);
  return isFiniteNumber(distance) && distance >= 0;
}

function comparisonRow(key, unit) {
  const base = unitData(unit, state.baseElection)[key];
  const target = unitData(unit, state.targetElection)[key];
  const row = target || base;
  if (!row) return null;
  const diff = (field) => base && target && isFiniteNumber(base[field]) && isFiniteNumber(target[field]) ? target[field] - base[field] : null;
  const blockDiff = (block) => base && target ? (target.bloques_pct?.[block] || 0) - (base.bloques_pct?.[block] || 0) : null;
  return {
    key,
    partido: row.partido,
    partido_norm: row.partido_norm,
    circuito: row.circuito,
    has_base: Boolean(base),
    has_target: Boolean(target),
    participacion_delta: diff("participacion"),
    ausentismo_delta: diff("ausentismo"),
    blanco_delta: diff("pct_blanco"),
    nulo_delta: diff("pct_nulo"),
    margen_delta: diff("margen"),
    lla_delta: blockDiff("LLA"),
    peronismo_k_delta: blockDiff("PERONISMO_K"),
    winner_changed: base && target ? base.ganador !== target.ganador : null,
  };
}

function valueFor(key, unit) {
  const target = unitData(unit, state.targetElection)[key];
  const base = unitData(unit, state.baseElection)[key];
  const targetValue = metricValue(target);
  if (state.viewMode !== "comparison") return targetValue;
  const baseValue = metricValue(base);
  return isFiniteNumber(targetValue) && isFiniteNumber(baseValue) ? targetValue - baseValue : null;
}

function metricValue(row) {
  if (!row) return null;
  if (state.indicator === "participacion") return row.participacion;
  if (state.indicator === "ausentismo") return row.ausentismo;
  if (state.indicator === "competitividad") return row.margen;
  if (state.indicator !== "votos") return null;

  if (state.voteType !== "positivo") {
    const fields = {
      blanco: "pct_blanco",
      nulo: "pct_nulo",
      impugnado: "pct_impugnado",
      recurrido: "pct_recurrido",
    };
    return row[fields[state.voteType]] ?? 0;
  }

  const forceVotes = row.bloques?.[state.force] || 0;
  if (state.positiveMeasure === "share_total") return row.votantes ? forceVotes / row.votantes : null;
  if (state.positiveMeasure === "gap_winner") {
    const distance = selectedForceDistance(row);
    return isFiniteNumber(distance) && distance < 0 ? distance : null;
  }
  return row.bloques_pct?.[state.force] ?? null;
}

function metricDomain() {
  if (state.viewMode === "comparison") {
    if (state.indicator === "participacion") return [-0.25, 0.12];
    if (state.indicator === "ausentismo") return [-0.12, 0.25];
    if (state.indicator === "competitividad") return [-0.25, 0.25];
    if (state.indicator === "votos") return state.voteType === "positivo" ? [-0.25, 0.25] : [-0.05, 0.05];
  }
  if (state.indicator === "participacion") return [0.45, 0.88];
  if (state.indicator === "ausentismo") return [0.12, 0.55];
  if (state.indicator === "competitividad") return [0, 0.5];
  if (state.indicator === "votos" && state.voteType !== "positivo") return [0, 0.08];
  if (isGapWinnerMetric()) return null;
  if (state.indicator === "votos") return [0, 0.72];
  return null;
}

function metricFormat() {
  return state.viewMode === "comparison" ? "pp" : currentMetric().format;
}

function metricLabel() {
  const prefix = state.viewMode === "comparison" ? "Cambio " : "";
  if (state.indicator === "participacion") return `${prefix}participación electoral`;
  if (state.indicator === "ausentismo") return `${prefix}ausentismo electoral`;
  if (state.indicator === "competitividad") return `${prefix}competitividad`;
  if (state.voteType !== "positivo") return `${prefix}${VOTE_TYPE_LABELS[state.voteType] || state.voteType}`;
  const measure = {
    share_positive: `${FORCE_LABELS[state.force] || state.force} sobre votos positivos`,
    share_total: `${FORCE_LABELS[state.force] || state.force} sobre total de votos`,
    gap_winner: `${FORCE_LABELS[state.force] || state.force}: distancia a la primera fuerza`,
  }[state.positiveMeasure];
  return `${prefix}${measure}`;
}

function metricTooltipLabel() {
  if (state.indicator === "participacion") return state.viewMode === "comparison" ? "Cambio participacion" : "Participacion";
  if (state.indicator === "ausentismo") return state.viewMode === "comparison" ? "Cambio ausentismo" : "Ausentismo";
  if (state.indicator === "competitividad") return state.viewMode === "comparison" ? "Cambio competitividad" : "Competitividad";
  if (state.voteType !== "positivo") return state.viewMode === "comparison" ? `Cambio ${VOTE_TYPE_LABELS[state.voteType] || state.voteType}` : (VOTE_TYPE_LABELS[state.voteType] || state.voteType);
  const force = FORCE_LABELS[state.force] || state.force;
  if (state.positiveMeasure === "gap_winner") return `${force}: distancia`;
  return state.viewMode === "comparison" ? `Cambio ${force}` : `Voto ${force}`;
}

function mapTooltipHtml(feature, unit) {
  const label = unit === "party" ? feature.properties.partido : `${feature.properties.partido} · ${feature.properties.circuito}`;
  const value = valueForFeature(feature, unit);
  const targetRow = rowForFeature(feature, unit, state.targetElection);
  if (state.activeQuestion?.mapMode === "winner") {
    return `
      <div class="tooltip-title">${escapeHtml(label)}</div>
      <div class="tooltip-unit">${unitLabel(unit, false)}</div>
      <div class="tooltip-value">Fuerza predominante: <strong>${escapeHtml(targetRow?.ganador || "sin dato")}</strong></div>
      <div class="tooltip-value">Voto positivo: <strong>${escapeHtml(formatPct(winnerShare(targetRow)))}</strong></div>
    `;
  }
  if (state.indicator === "competitividad") {
    const category = competitivenessCategory(targetRow?.margen) || "Sin categoría";
    const gapVotes = competitivenessVoteGap(targetRow);
    const changeLine = state.viewMode === "comparison"
      ? `<div class="tooltip-value">Cambio de brecha: <strong>${escapeHtml(formatPp(value))}</strong></div>`
      : "";
    return `
      <div class="tooltip-title">${escapeHtml(label)}</div>
      <div class="tooltip-unit">Competitividad electoral</div>
      <div class="tooltip-category">${escapeHtml(category)}</div>
      <div class="tooltip-value">Diferencia: <strong>${escapeHtml(formatGapPp(targetRow?.margen))}</strong></div>
      <div class="tooltip-value">Brecha: <strong>${escapeHtml(formatNumber(gapVotes))} votos</strong></div>
      ${changeLine}
    `;
  }
  const gapWinnerNote = isGapWinnerMetric() && value === null && selectedForceIsFirst(targetRow)
    ? `<div class="tooltip-value">La fuerza seleccionada es primera fuerza en este territorio.</div>`
    : `<div class="tooltip-value">${escapeHtml(metricTooltipLabel())}: <strong>${escapeHtml(fmt(value, metricFormat()))}</strong></div>`;
  return `
    <div class="tooltip-title">${escapeHtml(label)}</div>
    <div class="tooltip-unit">${unitLabel(unit, false)}</div>
    ${gapWinnerNote}
  `;
}

function metricDefinition() {
  if (state.indicator === "participacion") return "Porcentaje de electores habilitados que emitieron voto.";
  if (state.indicator === "ausentismo") return "Porcentaje de electores habilitados que no votaron.";
  if (state.indicator === "competitividad") return "Margen entre la primera y la segunda fuerza sobre votos positivos. Valores mas bajos indican mayor competencia.";
  if (state.voteType !== "positivo") return `${VOTE_TYPE_LABELS[state.voteType] || "Tipo de voto"} como porcentaje del total de votos emitidos.`;
  if (state.positiveMeasure === "share_total") return `${FORCE_LABELS[state.force] || state.force} como porcentaje del total de votos emitidos.`;
  if (state.positiveMeasure === "gap_winner") return `Diferencia entre ${FORCE_LABELS[state.force] || state.force} y la primera fuerza. Los territorios donde la fuerza seleccionada lidera se excluyen de esta lectura.`;
  return `${FORCE_LABELS[state.force] || state.force} como porcentaje de los votos positivos.`;
}

function metricColor() {
  if (state.indicator === "participacion") return COLORS.participacion;
  if (state.indicator === "ausentismo") return COLORS.ausentismo;
  if (state.indicator === "competitividad") return COLORS.competitividad;
  if (state.indicator === "votos" && state.voteType === "positivo") {
    return state.force === "PERONISMO_K" ? COLORS.peronismo : COLORS.lla;
  }
  const voteColors = {
    blanco: COLORS.blanco,
    nulo: COLORS.nulo,
    impugnado: COLORS.impugnado,
    recurrido: COLORS.recurrido,
  };
  return voteColors[state.voteType] || COLORS.positive;
}

function colorFor(value) {
  if (!isFiniteNumber(value)) return "rgba(244,239,228,.22)";
  const baseColor = metricColor();
  const domain = metricDomain();
  if (!domain) {
    const values = rankedRows().map((row) => row.value).filter(isFiniteNumber);
    if (!values.length) return "rgba(244,239,228,.22)";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const t = max === min ? 0.5 : (value - min) / (max - min);
    return mix(COLORS.neutral, baseColor, Math.max(0, Math.min(1, t)));
  }
  const [min, max] = domain;
  if (min < 0 && max > 0) {
    const limit = Math.max(Math.abs(min), Math.abs(max)) || 1;
    return mix(COLORS.neutral, baseColor, Math.min(1, Math.abs(value) / limit));
  }
  return mix(COLORS.neutral, baseColor, Math.max(0, Math.min(1, (value - min) / (max - min))));
}

function mapFillColor(key, unit) {
  const row = unitData(unit, state.targetElection)[key] || unitData(unit, state.baseElection)[key];
  if (state.activeQuestion?.mapMode === "winner" && row?.ganador) return forceMapColor(row.ganador);
  if (state.indicator === "competitividad" && state.viewMode !== "comparison") return competitivenessColor(row?.margen);
  return colorFor(valueFor(key, unit));
}

function mix(a, b, t) {
  const ah = a.replace("#", "");
  const bh = b.replace("#", "");
  const out = [0, 2, 4].map((i) => {
    const av = parseInt(ah.slice(i, i + 2), 16);
    const bv = parseInt(bh.slice(i, i + 2), 16);
    return Math.round(av + (bv - av) * t).toString(16).padStart(2, "0");
  });
  return `#${out.join("")}`;
}

function styleParty(feature) {
  const key = feature.properties.key;
  const selected = state.selectedParty === key;
  const scatterDim = state.scatterSelection.size && els.scatterMode.value === "filter" && !state.scatterSelection.has(key);
  return {
    color: selected ? COLORS.accent : COLORS.border,
    weight: selected ? 2.3 : 0.7,
    fillColor: mapFillColor(key, "party"),
    fillOpacity: scatterDim ? 0.08 : selected ? 0.75 : 0.55,
    opacity: scatterDim ? 0.25 : selected ? 0.95 : 0.78,
  };
}

function styleCircuit(feature) {
  const key = feature.properties.key;
  const selected = state.selectedCircuit === key;
  const scatterDim = state.scatterSelection.size && els.scatterMode.value === "filter" && !state.scatterSelection.has(key);
  return {
    color: selected ? COLORS.accent : COLORS.border,
    weight: selected ? 2.2 : 0.65,
    fillColor: mapFillColor(key, "circuit"),
    fillOpacity: scatterDim ? 0.08 : selected ? 0.75 : 0.55,
    opacity: scatterDim ? 0.25 : selected ? 0.95 : 0.8,
  };
}

function bindPolygonHover(layer, styleFn) {
  layer.on({
    mouseover: () => {
      const baseStyle = styleFn(layer.feature);
      layer.setStyle({
        weight: Math.max(baseStyle.weight || 1, 1.4),
        fillOpacity: 0.75,
        opacity: 0.95,
      });
      layer.bringToFront?.();
    },
    mouseout: () => {
      layer.setStyle(styleFn(layer.feature));
    },
  });
}

function updateElectionSelectors() {
  const sources = state.data.sources;
  const options = sources.map((source) => `<option value="${source.id}">${source.label}</option>`).join("");
  if (state.targetElection === state.baseElection) {
    state.targetElection = sources.find((source) => source.id !== state.baseElection)?.id || state.targetElection;
  }
  const compareOptions = sources
    .filter((source) => source.id !== state.baseElection)
    .map((source) => `<option value="${source.id}">${source.label}</option>`)
    .join("");
  els.baseElection.innerHTML = options;
  els.targetElection.innerHTML = options;
  els.compareElection.innerHTML = compareOptions;
  els.baseElection.value = state.baseElection;
  els.targetElection.value = state.targetElection;
  els.compareElection.value = state.targetElection;
}

function updateMetricOptions() {
  const list = currentMetricList();
  if (!list.some((metric) => metric.value === state.indicator)) state.indicator = list[0].value;
  els.indicator.innerHTML = list.map((metric) => `<option value="${metric.value}">${metric.label}</option>`).join("");
  els.indicator.value = state.indicator;
  const isCompare = state.viewMode === "comparison";
  const isVotes = state.indicator === "votos";
  const isPositive = isVotes && state.voteType === "positivo";
  els.targetElection.disabled = isCompare;
  els.baseElection.disabled = !isCompare;
  els.compareElection.disabled = !isCompare;
  els.voteType.disabled = !isVotes;
  els.force.disabled = !isPositive;
  els.positiveMeasure.disabled = !isPositive;
  els.openScatter.disabled = !isCompare;
  document.body.classList.toggle("is-compare-mode", state.viewMode === "comparison");
  document.body.classList.toggle("is-votes-metric", isVotes);
  document.body.classList.toggle("is-positive-vote", isPositive);
  [
    [els.targetElection, isCompare],
    [els.baseElection, !isCompare],
    [els.compareElection, !isCompare],
    [els.voteType, !isVotes],
    [els.force, !isPositive],
    [els.positiveMeasure, !isPositive],
  ].forEach(([control, disabled]) => control?.closest("label")?.classList.toggle("is-disabled", disabled));
  els.metricDefinition.textContent = metricDefinition();
  els.modeElection.classList.toggle("is-active", state.viewMode === "target");
  els.modeCompare.classList.toggle("is-active", state.viewMode === "comparison");
}

function renderLegend() {
  if (state.activeQuestion?.mapMode === "winner") {
    const legendUnit = effectiveQuestionUnit(state.activeQuestion);
    const rows = Object.values(unitData(legendUnit, state.targetElection));
    const winners = Object.entries(rows.reduce((acc, row) => {
      if (row.ganador) acc[row.ganador] = (acc[row.ganador] || 0) + 1;
      return acc;
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
    els.legend.innerHTML = `
      <div class="legend-title">Fuerza predominante por ${unitLabel(legendUnit, false)}</div>
      <div class="winner-legend">
        ${winners.map(([name, count]) => `<div><i style="background:${forceMapColor(name)}"></i><span>${name}</span><b>${count}</b></div>`).join("")}
      </div>
    `;
    return;
  }
  if (state.indicator === "competitividad" && state.viewMode !== "comparison") {
    els.legend.innerHTML = `
      <div class="legend-title">Competitividad electoral</div>
      <div class="competitiveness-legend">
        ${COMPETITIVENESS_CLASSES.map((item) => `<div><i style="background:${item.color}"></i><span>${item.label}</span></div>`).join("")}
      </div>
    `;
    return;
  }
  const formatter = metricFormat() === "pp" ? formatPp : metricFormat() === "pct" ? formatPct : formatNumber;
  const domain = metricDomain();
  const values = rankedRows().map((row) => row.value).filter(isFiniteNumber);
  if (!domain && !values.length) {
    els.legend.innerHTML = `<div class="legend-title">${metricLabel()}</div><div class="legend-scale"><span>Sin territorios válidos para esta lectura</span></div>`;
    return;
  }
  const [min, max] = domain || extent(values);
  const ramp = `linear-gradient(90deg, ${COLORS.neutral}, ${metricColor()})`;
  els.legend.innerHTML = `<div class="legend-title">${metricLabel()}</div><div class="legend-ramp" style="background:${ramp}"></div><div class="legend-scale"><span>${formatter(min)}</span><span>${formatter(max)}</span></div>`;
}

function rankedRows(unitOverride = null) {
  const unit = unitOverride || currentUnit();
  let keys = Object.keys(state.viewMode === "comparison" ? unitData(unit, state.targetElection) : unitData(unit, currentElectionId()));
  if (unit === "circuit" && state.selectedParty) {
    keys = keys.filter((key) => (unitData("circuit", state.targetElection)[key] || unitData("circuit", state.baseElection)[key])?.partido_norm === state.selectedParty);
  }
  if (state.scatterSelection.size && els.scatterMode.value === "filter") keys = keys.filter((key) => state.scatterSelection.has(key));
  return keys
    .map((key) => ({ key, unit, row: rowFor(key, unit), value: valueFor(key, unit) }))
    .filter((row) => row.row && row.value !== null && row.value !== undefined)
    .filter(questionRowFilter);
}

function questionRowFilter(item) {
  if (state.activeQuestion?.filter !== "largeElectorate") return true;
  const rows = Object.values(unitData(item.unit, state.targetElection)).filter((row) => isFiniteNumber(row.electores));
  if (!rows.length) return true;
  const sorted = rows.map((row) => row.electores).sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * 0.5)] || 0;
  return (item.row.electores || 0) >= threshold;
}

function renderRanking(sortDirection = null) {
  const direction = sortDirection || (state.viewMode === "comparison" ? "abs" : "desc");
  const rows = rankedRows();
  rows.sort((a, b) => {
    if (direction === "asc") return a.value - b.value;
    if (direction === "desc") return b.value - a.value;
    return Math.abs(b.value) - Math.abs(a.value);
  });
  els.rankingTitle.textContent = `${metricLabel()} · ${rows[0]?.unit === "circuit" ? "circuitos" : "partidos"}`;
  if (els.rankingContext) {
    els.rankingContext.textContent = state.viewMode === "comparison" ? `${electionLabel(state.baseElection)} vs ${electionLabel(state.targetElection)}` : electionLabel(state.targetElection);
  }
  els.rankingList.innerHTML = rows.map((item, index) => rankingItemHtml(item, index)).join("");
}

function rankingItemHtml(item, index) {
  if (state.indicator === "competitividad") return competitivenessRankingItemHtml(item, index);
  return `
    <button class="ranking-item ${isSelected(item.key, item.unit) ? "is-active" : ""}" data-key="${item.key}" data-unit="${item.unit}">
      <span class="rank-index">${String(index + 1).padStart(2, "0")}</span>
      <span><strong>${escapeHtml(territoryLabel(item.key, item.unit))}</strong><span>${item.unit === "party" ? "Partido" : "Circuito electoral"}</span></span>
      <span class="rank-value">${escapeHtml(fmt(item.value, metricFormat()))}</span>
    </button>
  `;
}

function competitivenessRankingItemHtml(item, index) {
  const target = unitData(item.unit, state.targetElection)[item.key];
  const category = competitivenessCategory(target?.margen) || "Sin categoría";
  const gapVotes = competitivenessVoteGap(target);
  const change = state.viewMode === "comparison" ? `<span class="rank-meta">Cambio: ${escapeHtml(formatPp(item.value))}</span>` : "";
  return `
  <button class="ranking-item ranking-item-competitiveness ${isSelected(item.key, item.unit) ? "is-active" : ""}" data-key="${item.key}" data-unit="${item.unit}">
    <span class="rank-index">${String(index + 1).padStart(2, "0")}</span>
    <span class="rank-main"><strong>${escapeHtml(territoryLabel(item.key, item.unit))}</strong><span class="rank-category">${escapeHtml(category)}</span></span>
    <span class="rank-competitiveness-metrics">
      <span class="rank-meta">Diferencia: ${escapeHtml(formatGapPp(target?.margen))}</span>
      <span class="rank-meta">Brecha: ${escapeHtml(formatNumber(gapVotes))} votos</span>
      ${change}
    </span>
    </button>
  `;
}

function isSelected(key, unit) {
  return unit === "party" ? state.selectedParty === key : state.selectedCircuit === key;
}

function territoryLabel(key, unit) {
  const row = unitData(unit, state.targetElection)[key] || unitData(unit, state.baseElection)[key];
  if (!row) return key;
  return unit === "party" ? row.partido : `${row.partido} · ${row.circuito}`;
}

function aggregateRows(rows) {
  const out = { electores: 0, votantes: 0, positivos: 0, blanco: 0, nulo: 0, impugnado: 0, recurrido: 0, bloques: { LLA: 0, PERONISMO_K: 0 }, fuerzas: {} };
  rows.forEach((row) => {
    out.electores += row?.electores || 0;
    out.votantes += row?.votantes || 0;
    out.positivos += row?.positivos || 0;
    out.blanco += row?.blanco || 0;
    out.nulo += row?.nulo || 0;
    out.impugnado += row?.impugnado || 0;
    out.recurrido += row?.recurrido || 0;
    out.bloques.LLA += row?.bloques?.LLA || 0;
    out.bloques.PERONISMO_K += row?.bloques?.PERONISMO_K || 0;
    Object.entries(row?.fuerzas || {}).forEach(([name, votes]) => {
      out.fuerzas[name] = (out.fuerzas[name] || 0) + votes;
    });
  });
  out.participacion = out.electores ? out.votantes / out.electores : null;
  out.ausentismo = isFiniteNumber(out.participacion) ? 1 - out.participacion : null;
  out.pct_blanco = out.votantes ? out.blanco / out.votantes : null;
  out.pct_nulo = out.votantes ? out.nulo / out.votantes : null;
  out.pct_impugnado = out.votantes ? out.impugnado / out.votantes : null;
  out.pct_recurrido = out.votantes ? out.recurrido / out.votantes : null;
  out.bloques_pct = {
    LLA: out.positivos ? out.bloques.LLA / out.positivos : null,
    PERONISMO_K: out.positivos ? out.bloques.PERONISMO_K / out.positivos : null,
  };
  const topForces = Object.entries(out.fuerzas).sort((a, b) => b[1] - a[1]);
  const winner = topForces[0] || ["", 0];
  const runnerUp = topForces[1] || ["", 0];
  out.ganador = winner[0];
  out.ganador_votos = winner[1];
  out.segundo = runnerUp[0];
  out.segundo_votos = runnerUp[1];
  out.margen = out.positivos ? (winner[1] - runnerUp[1]) / out.positivos : null;
  return out;
}

function currentScopeRows(unit, electionId) {
  if (state.selectedCircuit) return [unitData("circuit", electionId)[state.selectedCircuit]].filter(Boolean);
  if (state.selectedParty) return Object.values(unitData("circuit", electionId)).filter((row) => row.partido_norm === state.selectedParty);
  return Object.values(unitData(unit, electionId));
}

function renderKpis() {
  const base = aggregateRows(currentScopeRows("party", state.baseElection));
  const target = aggregateRows(currentScopeRows("party", state.targetElection));
  els.kpiStrip.innerHTML = [
    kpi("Electores", formatNumber(target.electores), electionLabel(state.targetElection)),
    kpi("Votantes", formatNumber(target.votantes), `${formatPct(target.participacion)} de participacion`),
    competitivenessBlock(base, target),
  ].join("");
  renderTotalVoteStack(target);
  renderVoteStack(target);
}

function kpi(label, value, note = "") {
  return `<div class="kpi-item"><span>${label}</span><strong>${value}</strong><i>${note || "&nbsp;"}</i></div>`;
}

function competitivenessBlock(base, target) {
  const category = competitivenessCategory(target?.margen) || "Sin categoría";
  const voteGap = competitivenessVoteGap(target);
  return `
    <div class="kpi-item kpi-competitiveness">
      <span class="kpi-title-row">Competitividad electoral <button class="kpi-info-button" type="button" data-competitiveness-info aria-label="Abrir metodología de competitividad electoral">i</button></span>
      <strong>${category}</strong>
      <i>Diferencia: ${formatGapPp(target?.margen)}</i>
      <p>Brecha: ${formatNumber(voteGap)} votos</p>
    </div>
  `;
}

function barWidth(value) {
  return Math.min(100, Math.max(0, (value || 0) * 200));
}

function renderVoteStack(row, targetEls = els) {
  if (!targetEls.voteStack || !targetEls.voteStackLegend) return;
  const entries = Object.entries(row.fuerzas || {})
    .filter(([, votes]) => votes > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const used = entries.reduce((sum, [, votes]) => sum + votes, 0);
  const rest = Math.max(0, (row.positivos || 0) - used);
  const stackEntries = rest ? [...entries, ["Otras fuerzas", rest]] : entries;
  targetEls.voteStack.innerHTML = stackEntries.map(([name, votes], index) => {
    const pct = row.positivos ? votes / row.positivos : 0;
    return `<span style="width:${pct * 100}%;background:${forceStackColor(name, index, STACK_FALLBACK_COLORS)}" title="${name}: ${formatPct(pct)}"></span>`;
  }).join("");
  targetEls.voteStackLegend.innerHTML = stackEntries.map(([name, votes], index) => {
    const pct = row.positivos ? votes / row.positivos : 0;
    return `<div><i style="background:${forceStackColor(name, index, STACK_FALLBACK_COLORS)}"></i><span>${name}</span><b>${formatPct(pct)}</b></div>`;
  }).join("");
}

function renderTotalVoteStack(row, targetEls = els) {
  if (!targetEls.totalVoteStack || !targetEls.totalVoteLegend) return;
  const total = row.votantes || TOTAL_VOTE_SEGMENTS.reduce((sum, segment) => sum + (row[segment.key] || 0), 0);
  const entries = TOTAL_VOTE_SEGMENTS.map((segment) => ({
    ...segment,
    votes: row[segment.key] || 0,
    pct: total ? (row[segment.key] || 0) / total : 0,
  }));
  targetEls.totalVoteStack.innerHTML = entries.map((entry) => {
    const label = entry.pct >= 0.075 ? formatPct(entry.pct, 0) : "";
    return `<span style="width:${entry.pct * 100}%;background:${entry.color}" title="${entry.label}: ${formatPct(entry.pct)}">${label}</span>`;
  }).join("");
  targetEls.totalVoteLegend.innerHTML = entries.map((entry) => `
    <div><i style="background:${entry.color}"></i><span>${entry.label}</span><b>${formatPct(entry.pct)}</b></div>
  `).join("");
}

function forceStackColor(name, index, fallbackColors) {
  const normalized = normLabel(name);
  if (normalized.includes("LIBERTAD AVANZA")) return COLORS.lla;
  if (normalized.includes("FUERZA PATRIA") || normalized.includes("UNION POR LA PATRIA")) return COLORS.peronismo;
  return fallbackColors[index % fallbackColors.length];
}

function forceMapColor(name) {
  const normalized = normLabel(name);
  if (normalized.includes("LIBERTAD AVANZA")) return COLORS.lla;
  if (normalized.includes("FUERZA PATRIA") || normalized.includes("UNION POR LA PATRIA")) return COLORS.peronismo;
  const hash = [...normalized].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return STACK_FALLBACK_COLORS[hash % STACK_FALLBACK_COLORS.length];
}

function normLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function renderPanel() {
  const unit = state.selectedCircuit ? "circuit" : state.selectedParty ? "party" : "province";
  const base = state.selectedCircuit
    ? unitData("circuit", state.baseElection)[state.selectedCircuit]
    : state.selectedParty
      ? unitData("party", state.baseElection)[state.selectedParty]
      : aggregateRows(Object.values(unitData("party", state.baseElection)));
  const target = state.selectedCircuit
    ? unitData("circuit", state.targetElection)[state.selectedCircuit]
    : state.selectedParty
      ? unitData("party", state.targetElection)[state.selectedParty]
      : aggregateRows(Object.values(unitData("party", state.targetElection)));
  const label = state.selectedCircuit ? territoryLabel(state.selectedCircuit, "circuit") : state.selectedParty ? territoryLabel(state.selectedParty, "party") : "Provincia de Buenos Aires";
  els.panelKicker.textContent = unit === "province" ? "Vista provincial" : unit === "party" ? "Partido seleccionado" : "Circuito seleccionado";
  els.panelTitle.textContent = label;
  els.panelLead.textContent = `${electionLabel(state.baseElection)} vs ${electionLabel(state.targetElection)}.`;
  els.metricsGrid.innerHTML = [
    metricBlock("Participacion", formatPct(target?.participacion), formatPp((target?.participacion ?? 0) - (base?.participacion ?? 0))),
    metricBlock("Ausentismo", formatPct(target?.ausentismo), formatPp((target?.ausentismo ?? 0) - (base?.ausentismo ?? 0))),
    metricBlock("LLA", formatPct(target?.bloques_pct?.LLA), formatPp((target?.bloques_pct?.LLA ?? 0) - (base?.bloques_pct?.LLA ?? 0))),
    metricBlock("Peronismo/K", formatPct(target?.bloques_pct?.PERONISMO_K), formatPp((target?.bloques_pct?.PERONISMO_K ?? 0) - (base?.bloques_pct?.PERONISMO_K ?? 0))),
  ].join("");
  setBar(els.margin2023, els.margin2023Label, base?.margen);
  setBar(els.margin2025, els.margin2025Label, target?.margen);
  els.quickReading.textContent = activeReading(base, target);
}

function metricBlock(label, value, note = "") {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong><i>${note}</i></div>`;
}

function setBar(bar, label, value) {
  bar.style.width = `${barWidth(value)}%`;
  label.textContent = formatPct(value);
}

function activeReading(base, target) {
  if (state.activeQuestion) return assistantNarrative(state.activeQuestion);
  const turnout = (target?.participacion ?? 0) - (base?.participacion ?? 0);
  const force = (target?.bloques_pct?.[state.force] ?? 0) - (base?.bloques_pct?.[state.force] ?? 0);
  return `Cambio de participacion: ${formatPp(turnout)}. Cambio de ${state.force}: ${formatPp(force)}.`;
}

function renderQuestions() {
  const groups = QUESTIONS.reduce((acc, question) => {
    acc[question.group] = acc[question.group] || [];
    acc[question.group].push(question);
    return acc;
  }, {});
  els.questionList.innerHTML = Object.entries(groups).map(([group, questions]) => `
    <div class="question-group">
      <div class="question-group-title">${group}</div>
      ${questions.map((question) => `
        <button class="question-card ${state.activeQuestion?.id === question.id ? "is-active" : ""}" data-id="${question.id}">
          <span><strong>${question.label}</strong><span>${question.description}</span></span>
        </button>
      `).join("")}
    </div>
  `).join("");
  renderAssistantResponse();
}

function renderAssistantResponse() {
  if (!els.assistantResponse) return;
  if (!state.activeQuestion) {
    els.assistantResponse.innerHTML = `
      <span>Asistente territorial</span>
      <strong>Elegí una pregunta para orientar el tablero.</strong>
      <p>Voy a cambiar métricas, comparación, unidad territorial o cruces exploratorios según la pregunta seleccionada.</p>
    `;
    return;
  }
  els.assistantResponse.innerHTML = `
    <span>${state.activeQuestion.group}</span>
    <strong>${state.activeQuestion.label}</strong>
    <p>${assistantNarrative(state.activeQuestion)}</p>
  `;
}

function assistantNarrative(question) {
  const effectiveUnit = effectiveQuestionUnit(question);
  const rows = sortedRowsForQuestion(question).slice(0, 3);
  const territories = rows.map((row) => narrativeTerritory(row, effectiveUnit)).join(", ");
  const currentUnitLabel = unitLabel(effectiveUnit, true);
  const context = state.viewMode === "comparison"
    ? `Comparo ${electionLabel(state.baseElection)} contra ${electionLabel(state.targetElection)}.`
    : `Uso ${electionLabel(state.targetElection)} como elección activa.`;
  const action = question.scatter
    ? `También abrí el cruce ${scatterMetricLabel(question.scatter.x)} × ${scatterMetricLabel(question.scatter.y)}; si hay selección automática, el ranking queda filtrado por esos casos.`
    : `El ranking queda ordenado por ${metricLabel()} en ${currentUnitLabel}.`;
  if (!rows.length) return `${question.description} No hay datos suficientes con los filtros activos para ${currentUnitLabel}.`;
  if (question.mapMode === "winner") {
    const winnerUnit = effectiveUnit;
    const winners = Object.entries(Object.values(unitData(winnerUnit, state.targetElection)).reduce((acc, row) => {
      if (row.ganador) acc[row.ganador] = (acc[row.ganador] || 0) + 1;
      return acc;
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => `${name}: ${count} ${unitLabel(winnerUnit, true)}`).join("; ");
    return `${context} Pinté cada ${unitLabel(winnerUnit, false)} según la fuerza más votada. La distribución territorial de ganadores queda así: ${winners}. Para ver intensidad dentro de una fuerza, elegí una pregunta de fortaleza o debilidad.`;
  }
  const sizeNote = question.filter === "largeElectorate" ? ` La lectura excluye la mitad de ${currentUnitLabel} con menor padrón para concentrarse en zonas electoralmente más grandes.` : "";
  const competitivenessNote = state.indicator === "competitividad" && rows.length
    ? " La categoría resume la brecha entre primera y segunda fuerza: menos de 5 pp indica una elección muy competitiva."
    : "";
  return `${context} ${question.description} Sobresalen ${territories}. ${action}${sizeNote}${competitivenessNote}`;
}

function narrativeTerritory(row, effectiveUnit) {
  const unit = row.unit || effectiveUnit;
  const label = territoryLabel(row.key, unit);
  if (state.indicator !== "competitividad") return `${label} (${fmt(row.value, metricFormat())})`;
  const target = unitData(unit, state.targetElection)[row.key];
  const category = competitivenessCategory(target?.margen) || "sin categoría";
  return `${label} (${category}, ${formatGapPp(target?.margen)})`;
}

function sortedRowsForQuestion(question) {
  const rows = rankedRows(effectiveQuestionUnit(question));
  rows.sort((a, b) => {
    if (question.sort === "asc") return a.value - b.value;
    if (question.sort === "desc") return b.value - a.value;
    return Math.abs(b.value) - Math.abs(a.value);
  });
  return rows;
}

function scatterMetricLabel(value) {
  return SCATTER_METRICS.find((metric) => metric.value === value)?.label || value;
}

function refresh() {
  updateMainMapUnit();
  updateMapLevelButtons();
  state.partyLayer?.setStyle(styleParty);
  state.scatterMainLayer?.setStyle(styleCircuit);
  state.circuitLayer?.setStyle(styleCircuit);
  updateMapTooltips();
  renderHighlightPins();
  renderKpis();
  renderPanel();
  renderRanking(state.activeQuestion?.sort);
  renderLegend();
  renderAssistantResponse();
  if (!els.scatterPanel.classList.contains("is-hidden")) renderScatter();
}

function updateMapTooltips() {
  state.partyLayer?.eachLayer((layer) => {
    if (layer.feature) layer.setTooltipContent(mapTooltipHtml(layer.feature, "party"));
  });
  state.scatterMainLayer?.eachLayer((layer) => {
    if (layer.feature) layer.setTooltipContent(mapTooltipHtml(layer.feature, "circuit"));
  });
  state.circuitLayer?.eachLayer((layer) => {
    if (layer.feature) layer.setTooltipContent(mapTooltipHtml(layer.feature, "circuit"));
  });
}

function updateMainMapUnit() {
  if (!state.map || !state.partyLayer) return;
  const showCircuitMap = state.mapLevel === "circuit";
  if (showCircuitMap) {
    if (state.map.hasLayer(state.partyLayer)) state.map.removeLayer(state.partyLayer);
    if (!state.scatterMainLayer) {
      state.scatterMainLayer = L.geoJSON(state.circuitGeojson, {
        style: styleCircuit,
        bubblingMouseEvents: false,
        onEachFeature(feature, layer) {
          layer.bindTooltip(mapTooltipHtml(feature, "circuit"), { className: "map-tooltip", sticky: true });
          bindPolygonHover(layer, styleCircuit);
          layer.on("click", (event) => {
            if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
            selectCircuit(feature.properties.key);
          });
        },
      });
    }
    if (!state.map.hasLayer(state.scatterMainLayer)) state.scatterMainLayer.addTo(state.map);
  } else {
    if (state.scatterMainLayer && state.map.hasLayer(state.scatterMainLayer)) state.map.removeLayer(state.scatterMainLayer);
    if (!state.map.hasLayer(state.partyLayer)) state.partyLayer.addTo(state.map);
  }
}

function setMapLevel(level) {
  state.mapLevel = level;
  if (state.activeQuestion?.unit === "current") {
    state.questionUnit = effectiveQuestionUnit(state.activeQuestion);
    if (state.activeQuestion.scatter?.unit === "current") els.scatterUnit.value = state.questionUnit;
    state.scatterSelection.clear();
    primeQuestionSelection(state.activeQuestion);
  }
  if (isScatterOpen()) syncScatterUnitToMapLevel({ clearSelection: true });
  updateMainMapUnit();
  updateMapLevelButtons();
  refresh();
  requestAnimationFrame(() => {
    state.map?.invalidateSize();
    fitMainMapToCurrentState();
  });
}

function updateMapLevelButtons() {
  els.mapLevelParty?.classList.toggle("is-active", state.mapLevel === "party");
  els.mapLevelCircuit?.classList.toggle("is-active", state.mapLevel === "circuit");
}

function renderHighlightPins() {
  if (!state.map) return;
  if (!state.highlightPinLayer) state.highlightPinLayer = L.layerGroup().addTo(state.map);
  state.highlightPinLayer.clearLayers();
  if (!state.activeQuestion || state.activeQuestion.mapMode === "winner") return;
  const unit = state.questionUnit || effectiveQuestionUnit(state.activeQuestion);
  if (!["party", "circuit"].includes(unit)) return;
  const rows = sortedRowsForQuestion({ ...state.activeQuestion, unit }).slice(0, 20);
  let missingCentroids = 0;
  rows.forEach((row, index) => {
    const center = unitCentroid(unit, row.key);
    if (!center) {
      missingCentroids += 1;
      return;
    }
    const marker = L.marker(center, {
      icon: L.divIcon({
        className: "",
        html: `<span class="top-party-pin">${index + 1}</span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      interactive: true,
    });
    marker.bindTooltip(rowTooltipHtml(row, unit), { className: "map-tooltip", sticky: true });
    marker.on("click", () => focusUnitOnMap(unit, row.key));
    marker.addTo(state.highlightPinLayer);
  });
  if (missingCentroids) {
    console.warn(`No se pudieron calcular ${missingCentroids} centroides de ${unitLabel(unit, true)} para los pins.`);
  }
}

function rowTooltipHtml(row, unit) {
  const target = unitData(unit, state.targetElection)[row.key];
  if (state.indicator === "competitividad") {
    const category = competitivenessCategory(target?.margen) || "Sin categoría";
    return `
      <div class="tooltip-title">${escapeHtml(territoryLabel(row.key, unit))}</div>
      <div class="tooltip-unit">Competitividad electoral</div>
      <div class="tooltip-category">${escapeHtml(category)}</div>
      <div class="tooltip-value">Diferencia: <strong>${escapeHtml(formatGapPp(target?.margen))}</strong></div>
      <div class="tooltip-value">Brecha: <strong>${escapeHtml(formatNumber(competitivenessVoteGap(target)))} votos</strong></div>
    `;
  }
  return `${escapeHtml(territoryLabel(row.key, unit))} · ${escapeHtml(fmt(row.value, metricFormat()))}`;
}

function unitCentroid(unit, key) {
  const cache = state.centroidCache[unit];
  if (!cache) return null;
  if (cache.has(key)) return cache.get(key);
  const layer = findLayerByKey(layerForUnit(unit), key);
  let center = null;
  if (layer?.getBounds?.()?.isValid()) {
    center = layer.getBounds().getCenter();
  } else {
    const feature = geojsonForUnit(unit)?.features.find((item) => item.properties.key === key);
    center = feature ? centroidFromGeometry(feature.geometry) : null;
  }
  if (center) cache.set(key, center);
  return center;
}

function layerForUnit(unit) {
  return unit === "circuit" ? state.scatterMainLayer : state.partyLayer;
}

function geojsonForUnit(unit) {
  return unit === "circuit" ? state.circuitGeojson : state.partyGeojson;
}

function featureBounds(unit, key) {
  const layer = findLayerByKey(layerForUnit(unit), key);
  const feature = geojsonForUnit(unit)?.features.find((item) => item.properties.key === key);
  const bounds = layer?.getBounds?.() || (feature ? L.geoJSON(feature).getBounds() : null);
  return bounds?.isValid?.() ? bounds : null;
}

function geojsonBounds(unit) {
  const layer = layerForUnit(unit);
  const bounds = layer?.getBounds?.();
  if (bounds?.isValid?.()) return bounds;
  const geojson = geojsonForUnit(unit);
  if (!geojson) return null;
  const fallback = L.geoJSON(geojson).getBounds();
  return fallback?.isValid?.() ? fallback : null;
}

function currentMapBounds() {
  if (state.selectedCircuit) return featureBounds("circuit", state.selectedCircuit);
  if (state.selectedParty) return featureBounds("party", state.selectedParty);
  return geojsonBounds(state.mapLevel === "circuit" ? "circuit" : "party") || geojsonBounds("party");
}

function fitMainMapToCurrentState({ animate = false } = {}) {
  if (!state.map) return;
  const bounds = currentMapBounds();
  if (bounds?.isValid?.()) {
    state.map.fitBounds(bounds, { padding: [28, 28], maxZoom: state.selectedCircuit ? 11 : state.selectedParty ? 9 : 7, animate });
  } else {
    state.map.setView(state.homeView.center, state.homeView.zoom, { animate });
  }
}

function centroidFromGeometry(geometry) {
  const points = [];
  collectCoordinates(geometry?.coordinates, points);
  if (!points.length) return null;
  const sum = points.reduce((acc, point) => ({ lng: acc.lng + point[0], lat: acc.lat + point[1] }), { lng: 0, lat: 0 });
  return L.latLng(sum.lat / points.length, sum.lng / points.length);
}

function collectCoordinates(coords, out) {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    out.push(coords);
    return;
  }
  coords.forEach((item) => collectCoordinates(item, out));
}

function selectParty(key) {
  const drawerHidden = els.circuitDrawer.classList.contains("is-hidden");
  if (state.selectedParty === key && !state.selectedCircuit && !drawerHidden) {
    clearMapSelection();
    return;
  }
  state.selectedParty = key;
  state.selectedCircuit = null;
  openCircuitDrawer(key);
  refresh();
  pulse(state.partyLayer, key, "key");
}

function renderMapSearchResults(query) {
  const term = normLabel(query);
  if (!term || term.length < 2) {
    els.mapSearchResults.classList.add("is-hidden");
    els.mapSearchResults.innerHTML = "";
    return;
  }
  const matches = state.partyGeojson.features
    .filter((feature) => normLabel(feature.properties.partido).includes(term))
    .sort((a, b) => a.properties.partido.localeCompare(b.properties.partido, "es"))
    .slice(0, 8);
  els.mapSearchResults.innerHTML = matches.length
    ? matches.map((feature) => `<button type="button" data-key="${feature.properties.key}">${feature.properties.partido}</button>`).join("")
    : `<button type="button" disabled>Sin coincidencias</button>`;
  els.mapSearchResults.classList.remove("is-hidden");
}

function focusPartyOnMap(key) {
  state.mapLevel = "party";
  updateMainMapUnit();
  const bounds = featureBounds("party", key);
  if (bounds?.isValid?.()) state.map.fitBounds(bounds, { padding: [28, 28], maxZoom: 9 });
  state.selectedParty = key;
  state.selectedCircuit = null;
  els.circuitDrawer.classList.add("is-hidden");
  refresh();
  pulse(state.partyLayer, key, "key");
}

function focusUnitOnMap(unit, key) {
  const nextLevel = unit === "circuit" ? "circuit" : "party";
  state.mapLevel = nextLevel;
  if (state.activeQuestion?.unit === "current") state.questionUnit = nextLevel;
  updateMainMapUnit();
  updateMapLevelButtons();
  const bounds = featureBounds(nextLevel, key);
  if (bounds?.isValid?.()) state.map.fitBounds(bounds, { padding: [28, 28], maxZoom: nextLevel === "circuit" ? 11 : 9 });
  if (nextLevel === "party") {
    state.selectedParty = key;
    state.selectedCircuit = null;
    els.circuitDrawer.classList.add("is-hidden");
    refresh();
    pulse(state.partyLayer, key, "key");
    return;
  }
  const row = unitData("circuit", state.targetElection)[key] || unitData("circuit", state.baseElection)[key];
  state.selectedCircuit = key;
  state.selectedParty = row?.partido_norm || null;
  els.circuitDrawer.classList.add("is-hidden");
  refresh();
  pulse(state.scatterMainLayer, key, "key");
}

function findLayerByKey(layerGroup, key) {
  let found = null;
  layerGroup?.eachLayer((layer) => {
    if (layer.feature?.properties?.key === key) found = layer;
  });
  return found;
}

function selectCircuit(key) {
  if (state.selectedCircuit === key) {
    clearMapSelection();
    return;
  }
  state.selectedCircuit = key;
  const row = unitData("circuit", state.targetElection)[key] || unitData("circuit", state.baseElection)[key];
  state.selectedParty = row?.partido_norm || state.selectedParty;
  refresh();
  pulse(state.scatterMainLayer && state.map?.hasLayer(state.scatterMainLayer) ? state.scatterMainLayer : state.circuitLayer, key, "key");
}

function pulse(layerGroup, key, prop) {
  layerGroup?.eachLayer((layer) => {
    if (layer.feature?.properties?.[prop] === key) {
      const path = layer.getElement();
      path?.classList.remove("pulse-ring");
      requestAnimationFrame(() => path?.classList.add("pulse-ring"));
    }
  });
}

function openCircuitDrawer(partyKey) {
  els.circuitDrawer.classList.remove("is-hidden");
  els.drawerTitle.textContent = territoryLabel(partyKey, "party");
  setTimeout(() => {
    if (!state.circuitMap) {
      state.circuitMap = L.map("circuitMap", { zoomControl: false, preferCanvas: true });
      L.control.zoom({ position: "bottomright" }).addTo(state.circuitMap);
      addBaseLayer(state.circuitMap);
    }
    renderCircuitMap(partyKey);
  }, 50);
}

function renderCircuitMap(partyKey) {
  state.circuitLayer?.remove();
  const features = state.circuitGeojson.features.filter((feature) => feature.properties.partido_norm === partyKey);
  state.circuitLayer = L.geoJSON({ type: "FeatureCollection", features }, {
    style: styleCircuit,
    bubblingMouseEvents: false,
    onEachFeature(feature, layer) {
      layer.bindTooltip(mapTooltipHtml(feature, "circuit"), { className: "map-tooltip", sticky: true });
      bindPolygonHover(layer, styleCircuit);
      layer.on({
        click: (event) => {
          if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
          selectCircuit(feature.properties.key);
        },
      });
    },
  }).addTo(state.circuitMap);
  state.circuitMap.invalidateSize();
  if (state.circuitLayer.getBounds().isValid()) state.circuitMap.fitBounds(state.circuitLayer.getBounds(), { padding: [18, 18] });
}

function resetView() {
  resetAnalyticState();
  requestAnimationFrame(() => fitMainMapToCurrentState());
}

function resetAnalyticState({ hideAssistant = false } = {}) {
  state.activeQuestion = null;
  state.questionUnit = null;
  state.selectedParty = null;
  state.selectedCircuit = null;
  state.scatterSelection.clear();
  state.viewMode = "target";
  state.indicator = "participacion";
  state.voteType = "positivo";
  state.positiveMeasure = "share_positive";
  state.force = "LLA";
  state.mapLevel = "party";
  document.body.classList.remove("is-scatter-page");
  els.scatterPanel.classList.add("is-hidden");
  els.circuitDrawer.classList.add("is-hidden");
  if (hideAssistant) {
    document.body.classList.remove("is-questions-open");
    els.questionWindow.classList.add("is-hidden");
  }
  updateElectionSelectors();
  updateMetricOptions();
  renderQuestions();
  refresh();
  requestAnimationFrame(() => state.map?.invalidateSize());
}

function clearMapSelection() {
  if (!state.selectedParty && !state.selectedCircuit && !state.scatterSelection.size) return;
  state.selectedParty = null;
  state.selectedCircuit = null;
  state.scatterSelection.clear();
  els.circuitDrawer.classList.add("is-hidden");
  refresh();
}

function clearMapSelectionFromBackground(event) {
  if (event.originalEvent?.target?.closest?.(".leaflet-interactive")) return;
  clearMapSelection();
}

function exportFilteredCsv() {
  const rows = rankedRows();
  const headers = ["unidad", "territorio", "eleccion_base", "eleccion_comparada", "metrica", "valor"];
  const csvRows = rows.map((row) => [
    row.unit,
    territoryLabel(row.key, row.unit),
    electionLabel(state.baseElection),
    electionLabel(state.targetElection),
    metricLabel(),
    row.value,
  ]);
  const csv = [headers, ...csvRows]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mesa-electoral-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function reportScopeRows(electionId) {
  return currentScopeRows("party", electionId);
}

function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForElementSize(el, attempts = 10) {
  for (let index = 0; index < attempts; index += 1) {
    console.log("reportMapCanvas size", el.offsetWidth, el.offsetHeight);
    if (el.offsetWidth > 0 && el.offsetHeight > 0) return true;
    await waitForNextFrame();
    await delay(50);
  }
  return false;
}

function reportTitle() {
  if (state.activeQuestion) return state.activeQuestion.label;
  return `${metricLabel()} en ${state.mapLevel === "circuit" ? "circuitos" : "partidos"}`;
}

function reportQuestionLabel() {
  return state.activeQuestion?.label || "Sin pregunta analitica seleccionada";
}

function reportNarrative() {
  if (state.activeQuestion) return assistantNarrative(state.activeQuestion);
  const rows = rankedRows().slice(0, 3).map((row) => `${territoryLabel(row.key, row.unit)} (${fmt(row.value, metricFormat())})`).join(", ");
  const context = state.viewMode === "comparison"
    ? `Comparacion entre ${electionLabel(state.baseElection)} y ${electionLabel(state.targetElection)}.`
    : `Eleccion activa: ${electionLabel(state.targetElection)}.`;
  return rows ? `${context} La lectura esta ordenada por ${metricLabel()}. Sobresalen ${rows}.` : `${context} No hay datos suficientes para construir una lectura territorial.`;
}

function reportMapUnit() {
  return state.mapLevel === "circuit" ? "circuit" : "party";
}

function reportMapBounds(unit) {
  if (state.selectedCircuit) return featureBounds("circuit", state.selectedCircuit);
  if (state.selectedParty) return featureBounds("party", state.selectedParty);
  return geojsonBounds(unit) || geojsonBounds("party");
}

function selectedReportKey(unit) {
  if (unit === "circuit") return state.selectedCircuit;
  return state.selectedParty;
}

function addReportPins(map) {
  if (!state.activeQuestion || state.activeQuestion.mapMode === "winner") return null;
  const unit = state.questionUnit || effectiveQuestionUnit(state.activeQuestion);
  if (!["party", "circuit"].includes(unit)) return null;
  const layer = L.layerGroup().addTo(map);
  sortedRowsForQuestion({ ...state.activeQuestion, unit }).slice(0, 20).forEach((row, index) => {
    const feature = geojsonForUnit(unit)?.features.find((item) => item.properties.key === row.key);
    const center = feature ? centroidFromGeometry(feature.geometry) : unitCentroid(unit, row.key);
    if (!center) return;
    const marker = L.marker(center, {
      icon: L.divIcon({
        className: "",
        html: `<span class="top-party-pin">${index + 1}</span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      interactive: false,
    });
    marker.bindTooltip(`${territoryLabel(row.key, unit)} · ${fmt(row.value, metricFormat())}`, { className: "map-tooltip", sticky: true });
    marker.addTo(layer);
  });
  return layer;
}

function bindReportSelectionTooltip(layer, feature, unit) {
  const selectedKey = selectedReportKey(unit);
  if (feature.properties.key !== selectedKey) return;
  layer.bindTooltip(mapTooltipHtml(feature, unit), {
    className: "map-tooltip",
    direction: "top",
    permanent: true,
    sticky: false,
  });
}

function addReportSelectionCallout(map, layerUnit) {
  const unit = state.selectedCircuit ? "circuit" : state.selectedParty ? "party" : null;
  const key = unit === "circuit" ? state.selectedCircuit : state.selectedParty;
  if (!unit || !key || unit === layerUnit) return null;
  const feature = geojsonForUnit(unit)?.features.find((item) => item.properties.key === key);
  const center = feature ? centroidFromGeometry(feature.geometry) : unitCentroid(unit, key);
  if (!feature || !center) return null;
  const marker = L.marker(center, {
    icon: L.divIcon({ className: "", html: "", iconSize: [0, 0] }),
    interactive: false,
    opacity: 0,
  }).addTo(map);
  marker.bindTooltip(mapTooltipHtml(feature, unit), {
    className: "map-tooltip",
    direction: "top",
    permanent: true,
    sticky: false,
  });
  return marker;
}

function fitReportMap(bounds) {
  if (!state.reportMap) return;
  state.reportMap.invalidateSize(true);
  if (bounds?.isValid?.()) {
    state.reportMap.fitBounds(bounds, { padding: [16, 16], maxZoom: state.selectedCircuit ? 11 : state.selectedParty ? 9 : 7, animate: false });
  } else if (state.map) {
    state.reportMap.setView(state.map.getCenter(), state.map.getZoom(), { animate: false });
  }
}

async function renderReportMap() {
  const container = els.reportRoot.querySelector("#reportMapCanvas");
  if (!container) return;
  await waitForNextFrame();
  const hasSize = await waitForElementSize(container);
  if (!hasSize) {
    console.warn("No se pudo crear el mapa del informe: #reportMapCanvas no tiene dimensiones.");
    return;
  }
  state.reportMap?.remove();
  state.reportMap = L.map(container, {
    attributionControl: false,
    dragging: false,
    doubleClickZoom: false,
    scrollWheelZoom: false,
    boxZoom: false,
    keyboard: false,
    zoomControl: false,
    preferCanvas: false,
    zoomSnap: 0.25,
    minZoom: 4,
  }).setView(state.map?.getCenter?.() || state.homeView.center, state.map?.getZoom?.() || state.homeView.zoom);
  addBaseLayer(state.reportMap);
  const unit = reportMapUnit();
  const bounds = reportMapBounds(unit);
  console.log("report bounds", bounds?.toBBoxString?.() || bounds);
  state.reportLayer = L.geoJSON(geojsonForUnit(unit), {
    style: unit === "circuit" ? styleCircuit : styleParty,
    bubblingMouseEvents: false,
    onEachFeature(feature, layer) {
      layer.bindTooltip(mapTooltipHtml(feature, unit), { className: "map-tooltip", sticky: true });
      bindReportSelectionTooltip(layer, feature, unit);
    },
  }).addTo(state.reportMap);
  state.reportPinLayer = addReportPins(state.reportMap);
  addReportSelectionCallout(state.reportMap, unit);
  window.setTimeout(() => fitReportMap(bounds), 100);
  await waitForNextFrame();
  fitReportMap(bounds);
  await delay(500);
  fitReportMap(bounds);
}

function generateReportHTML() {
  const target = aggregateRows(reportScopeRows(state.targetElection));
  const base = aggregateRows(reportScopeRows(state.baseElection));
  const rows = rankedRows().slice(0, 20);
  const generatedAt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  const kpis = [
    kpi("Electores", formatNumber(target.electores), electionLabel(state.targetElection)),
    kpi("Votantes", formatNumber(target.votantes), `${formatPct(target.participacion)} de participacion`),
    kpi("Participacion", formatPct(target.participacion), `Ausentismo: ${formatPct(target.ausentismo)}`),
    competitivenessBlock(base, target),
  ].join("");
  const ranking = rows.map((item, index) => `
    <div class="ranking-item">
      <span class="rank-index">${String(index + 1).padStart(2, "0")}</span>
      <span><strong>${escapeHtml(territoryLabel(item.key, item.unit))}</strong><span>${item.unit === "party" ? "Partido" : "Circuito electoral"}</span></span>
      <span class="rank-value">${escapeHtml(fmt(item.value, metricFormat()))}</span>
    </div>
  `).join("");
  return `
    <article class="report report-page">
      <header class="report-header">
        <h1>Informe ejecutivo - Atlas Electoral PBA</h1>
        <div class="report-meta">
          <span><strong>Titulo:</strong> ${escapeHtml(reportTitle())}</span>
          <span><strong>Eleccion activa:</strong> ${escapeHtml(electionLabel(state.targetElection))}</span>
          <span><strong>Fecha de generacion:</strong> ${escapeHtml(generatedAt)}</span>
          <span><strong>Nivel territorial activo:</strong> ${escapeHtml(unitLabel(state.mapLevel === "circuit" ? "circuit" : "party", false))}</span>
          <span><strong>Pregunta seleccionada:</strong> ${escapeHtml(reportQuestionLabel())}</span>
          <span><strong>Metrica:</strong> ${escapeHtml(metricLabel())}</span>
        </div>
      </header>

      <section class="report-section">
        <h2>Resumen ejecutivo</h2>
        <p>${escapeHtml(reportNarrative())}</p>
      </section>

      <section class="report-section">
        <h2>KPIs</h2>
        <div class="report-kpis">${kpis}</div>
      </section>

      <section class="report-section">
        <h2>Mapa</h2>
        <div class="report-map"><div id="reportMapCanvas" aria-label="Mapa electoral para informe"></div></div>
      </section>

      <section class="report-section">
        <h2>Ranking territorial</h2>
        <div class="report-ranking">${ranking}</div>
      </section>

      <section class="report-section">
        <h2>Distribucion electoral</h2>
        <div class="report-distribution">
          <section class="total-vote-card">
            <div class="section-title">Composicion del voto total</div>
            <div class="total-vote-stack" data-report-total-stack></div>
            <div class="total-vote-legend" data-report-total-legend></div>
          </section>
          <section class="vote-stack-card">
            <div class="section-title">Distribucion de votos positivos</div>
            <div class="vote-stack" data-report-vote-stack></div>
            <div class="vote-stack-legend" data-report-vote-legend></div>
          </section>
        </div>
      </section>

      <section class="report-section">
        <h2>Metodologia</h2>
        <div class="report-method">
          <span><strong>Fuente:</strong> Datos electorales normalizados del tablero.</span>
          <span><strong>Filtros activos:</strong> ${escapeHtml(metricLabel())}${state.selectedParty ? `; partido ${escapeHtml(territoryLabel(state.selectedParty, "party"))}` : ""}${state.selectedCircuit ? `; circuito ${escapeHtml(territoryLabel(state.selectedCircuit, "circuit"))}` : ""}</span>
          <span><strong>Nivel territorial:</strong> ${escapeHtml(unitLabel(state.mapLevel === "circuit" ? "circuit" : "party", false))}</span>
          <span><strong>Eleccion utilizada:</strong> ${escapeHtml(electionLabel(state.targetElection))}</span>
        </div>
      </section>
    </article>
  `;
}

async function exportReport() {
  const target = aggregateRows(reportScopeRows(state.targetElection));
  state.reportMap?.remove();
  state.reportMap = null;
  els.reportRoot.classList.add("is-rendering");
  els.reportRoot.innerHTML = generateReportHTML();
  els.reportRoot.setAttribute("aria-hidden", "false");
  renderTotalVoteStack(target, {
    totalVoteStack: els.reportRoot.querySelector("[data-report-total-stack]"),
    totalVoteLegend: els.reportRoot.querySelector("[data-report-total-legend]"),
  });
  renderVoteStack(target, {
    voteStack: els.reportRoot.querySelector("[data-report-vote-stack]"),
    voteStackLegend: els.reportRoot.querySelector("[data-report-vote-legend]"),
  });
  await renderReportMap();
  await waitForNextFrame();
  if (state.reportMap) fitReportMap(reportMapBounds(reportMapUnit()));
  await delay(500);
  window.print();
}

function showQuestions(expand = true) {
  document.body.classList.add("is-questions-open");
  els.questionWindow.classList.remove("is-hidden", "is-minimized");
  els.questionWindow.classList.toggle("is-collapsed", !expand);
  els.questionToggle.setAttribute("aria-expanded", String(expand));
  requestAnimationFrame(() => state.map?.invalidateSize());
}

function hideQuestions() {
  resetAnalyticState({ hideAssistant: true });
  requestAnimationFrame(() => fitMainMapToCurrentState());
}

function openScatterPanel({ reset = true } = {}) {
  if (reset) resetScatterPanelState();
  document.body.classList.add("is-scatter-page");
  els.scatterPanel.classList.remove("is-hidden");
  updateMainMapUnit();
  if (reset) refresh();
  else renderScatter();
  state.map?.invalidateSize();
}

function closeScatterPanel() {
  document.body.classList.remove("is-scatter-page");
  els.scatterPanel.classList.add("is-hidden");
  refresh();
  state.map?.invalidateSize();
}

function scatterDefaultUnit() {
  return state.mapLevel === "circuit" ? "circuit" : "party";
}

function isScatterOpen() {
  return !els.scatterPanel.classList.contains("is-hidden");
}

function syncScatterUnitToMapLevel({ clearSelection = false } = {}) {
  const unit = scatterDefaultUnit();
  if (els.scatterUnit.value !== unit) {
    els.scatterUnit.value = unit;
    if (clearSelection) state.scatterSelection.clear();
  }
}

function resetScatterPanelState() {
  state.scatterSelection.clear();
  state.activeQuestion = null;
  state.questionUnit = null;
  syncScatterUnitToMapLevel();
  els.scatterX.value = "peronismo_delta";
  els.scatterY.value = "margen_delta";
  els.scatterMode.value = "highlight";
  renderQuestions();
}

function applyQuestion(question) {
  const effectiveUnit = effectiveQuestionUnit(question);
  state.activeQuestion = question;
  state.questionUnit = effectiveUnit;
  state.mapLevel = effectiveUnit === "circuit" ? "circuit" : "party";
  state.selectedParty = null;
  state.selectedCircuit = null;
  state.scatterSelection.clear();
  els.circuitDrawer.classList.add("is-hidden");
  state.viewMode = question.mode || "target";
  state.indicator = question.indicator || state.indicator;
  if (question.voteType) state.voteType = question.voteType;
  if (question.positiveMeasure) state.positiveMeasure = question.positiveMeasure;
  if (question.force) state.force = question.force;
  updateElectionSelectors();
  els.voteType.value = state.voteType;
  els.positiveMeasure.value = state.positiveMeasure;
  els.force.value = state.force;
  updateMetricOptions();
  els.activeQuestionLabel.textContent = question.label;
  if (question.scatter) {
    els.scatterUnit.value = question.scatter.unit === "current" ? effectiveUnit : question.scatter.unit;
    els.scatterX.value = question.scatter.x;
    els.scatterY.value = question.scatter.y;
    els.scatterMode.value = question.scatter.mode;
    primeQuestionSelection(question);
    openScatterPanel({ reset: false });
  } else {
    closeScatterPanel();
  }
  renderQuestions();
  showQuestions(true);
  refresh();
}

function primeQuestionSelection(question) {
  if (!question.selectTop) return;
  const rows = sortedRowsForQuestion(question);
  state.scatterSelection = new Set(rows.slice(0, question.selectTop).map((row) => row.key));
}

function setupScatterOptions() {
  const options = SCATTER_METRICS.map((metric) => `<option value="${metric.value}">${metric.label}</option>`).join("");
  els.scatterX.innerHTML = options;
  els.scatterY.innerHTML = options;
  els.scatterX.value = "peronismo_delta";
  els.scatterY.value = "margen_delta";
}

function scatterValue(row, metric) {
  const base = row.base;
  const target = row.target;
  const llaBase = base?.bloques_pct?.LLA;
  const llaTarget = target?.bloques_pct?.LLA;
  const peronismoBase = base?.bloques_pct?.PERONISMO_K;
  const peronismoTarget = target?.bloques_pct?.PERONISMO_K;
  const values = {
    ausentismo_delta: isFiniteNumber(base?.ausentismo) && isFiniteNumber(target?.ausentismo) ? target.ausentismo - base.ausentismo : null,
    blanco_delta: isFiniteNumber(base?.pct_blanco) && isFiniteNumber(target?.pct_blanco) ? target.pct_blanco - base.pct_blanco : null,
    nulo_delta: isFiniteNumber(base?.pct_nulo) && isFiniteNumber(target?.pct_nulo) ? target.pct_nulo - base.pct_nulo : null,
    lla_delta: isFiniteNumber(llaBase) && isFiniteNumber(llaTarget) ? llaTarget - llaBase : null,
    peronismo_delta: isFiniteNumber(peronismoBase) && isFiniteNumber(peronismoTarget) ? peronismoTarget - peronismoBase : null,
    margen_delta: isFiniteNumber(base?.margen) && isFiniteNumber(target?.margen) ? target.margen - base.margen : null,
  };
  return values[metric];
}

function renderScatter() {
  const unit = els.scatterUnit.value === "circuit" ? "circuit" : "party";
  let keys = Object.keys(unitData(unit, state.targetElection));
  if (unit === "circuit" && state.selectedParty) keys = keys.filter((key) => unitData("circuit", state.targetElection)[key]?.partido_norm === state.selectedParty);
  const xMetric = SCATTER_METRICS.find((metric) => metric.value === els.scatterX.value) || SCATTER_METRICS.find((metric) => metric.value === "peronismo_delta");
  const yMetric = SCATTER_METRICS.find((metric) => metric.value === els.scatterY.value) || SCATTER_METRICS.find((metric) => metric.value === "margen_delta");
  els.scatterX.value = xMetric.value;
  els.scatterY.value = yMetric.value;
  const points = keys.map((key) => {
    const row = { key, unit, base: unitData(unit, state.baseElection)[key], target: unitData(unit, state.targetElection)[key] };
    return { ...row, x: scatterValue(row, xMetric.value), y: scatterValue(row, yMetric.value) };
  }).filter((point) => isFiniteNumber(point.x) && isFiniteNumber(point.y));
  drawScatter(points, xMetric, yMetric);
}

function drawScatter(points, xMetric, yMetric) {
  const svg = els.scatterChart;
  if (!svg) return;
  const width = svg.clientWidth || 620;
  const height = svg.clientHeight || 340;
  const margin = { top: 18, right: 18, bottom: 42, left: 58 };
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";
  if (!points.length) {
    els.scatterStats.textContent = "No hay datos suficientes para este cruce.";
    return;
  }
  const xExtent = extentWithZero(points.map((p) => p.x));
  const yExtent = extentWithZero(points.map((p) => p.y));
  if (!validExtent(xExtent) || !validExtent(yExtent)) {
    els.scatterStats.textContent = "No hay datos suficientes para este cruce.";
    return;
  }
  const x = (v) => margin.left + ((v - xExtent[0]) / (xExtent[1] - xExtent[0] || 1)) * (width - margin.left - margin.right);
  const y = (v) => height - margin.bottom - ((v - yExtent[0]) / (yExtent[1] - yExtent[0] || 1)) * (height - margin.top - margin.bottom);
  addSvg(svg, "rect", { x: margin.left, y: margin.top, width: width - margin.left - margin.right, height: height - margin.top - margin.bottom, class: "plot-bg" });
  addSvg(svg, "line", { x1: margin.left, x2: width - margin.right, y1: height - margin.bottom, y2: height - margin.bottom, class: "axis-line" });
  addSvg(svg, "line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: height - margin.bottom, class: "axis-line" });
  addSvg(svg, "line", { x1: x(0), x2: x(0), y1: margin.top, y2: height - margin.bottom, class: "reference-line" });
  addSvg(svg, "line", { x1: margin.left, x2: width - margin.right, y1: y(0), y2: y(0), class: "reference-line" });
  addScatterAxisLabels(svg, xExtent, yExtent, x, y, xMetric, yMetric, width, height, margin);
  const fit = trend(points);
  if (fit) addSvg(svg, "line", { x1: x(xExtent[0]), y1: y(fit.slope * xExtent[0] + fit.intercept), x2: x(xExtent[1]), y2: y(fit.slope * xExtent[1] + fit.intercept), class: "trend-line" });
  const plotted = points.map((point) => ({ ...point, cx: x(point.x), cy: y(point.y) }));
  plotted.forEach((point) => {
    const circle = addSvg(svg, "circle", { cx: point.cx, cy: point.cy, r: state.scatterSelection.has(point.key) ? 6 : 4, class: `scatter-point ${state.scatterSelection.has(point.key) ? "is-selected" : ""}` });
    circle.addEventListener("click", () => {
      state.scatterSelection = new Set([point.key]);
      point.unit === "party" ? selectParty(point.key) : selectCircuit(point.key);
    });
    addSvg(circle, "title", {}).textContent = `${territoryLabel(point.key, point.unit)}\n${xMetric.label}: ${fmt(point.x, xMetric.format)}\n${yMetric.label}: ${fmt(point.y, yMetric.format)}`;
  });
  addText(svg, xMetric.label, width / 2, height - 6, "axis-title middle");
  addText(svg, yMetric.label, 10, 14, "axis-title");
  els.scatterStats.innerHTML = `<strong>R2: ${fit ? fit.r2.toFixed(3) : "s/d"}</strong><span>N: ${points.length}</span><span>Asociacion exploratoria. No implica causalidad.</span>`;
  setupBrush(svg, plotted);
}

function addScatterAxisLabels(svg, xExtent, yExtent, x, y, xMetric, yMetric, width, height, margin) {
  if (!svg || typeof x !== "function" || typeof y !== "function") return;
  if (!validExtent(xExtent) || !validExtent(yExtent)) return;
  if (![width, height, margin?.top, margin?.right, margin?.bottom, margin?.left].every(Number.isFinite)) return;
  const x0 = x(0);
  const y0 = y(0);
  if (!Number.isFinite(x0) || !Number.isFinite(y0)) return;
  const xBase = height - margin.bottom;
  const yAxis = margin.left;
  addAxisText(svg, axisTickLabel(xExtent[0], xMetric), margin.left, xBase + 15, "axis-tick", "start");
  addAxisText(svg, "0", x0, xBase + 15, "axis-tick axis-zero-label", "middle");
  addAxisText(svg, axisTickLabel(xExtent[1], xMetric), width - margin.right, xBase + 15, "axis-tick", "end");
  addAxisText(svg, axisTickLabel(yExtent[1], yMetric), yAxis - 9, margin.top + 4, "axis-tick", "end");
  addAxisText(svg, "0", yAxis - 9, y0 + 4, "axis-tick axis-zero-label", "end");
  addAxisText(svg, axisTickLabel(yExtent[0], yMetric), yAxis - 9, height - margin.bottom, "axis-tick", "end");
}

function addAxisText(svg, text, x, y, className, anchor) {
  if (!svg || text == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
  if (!node) return null;
  node.setAttribute("x", x);
  node.setAttribute("y", y);
  if (className) node.setAttribute("class", className);
  if (anchor) node.setAttribute("text-anchor", anchor);
  node.textContent = text;
  svg.appendChild(node);
  return node;
}

function axisTickLabel(value, metric) {
  if (!isFiniteNumber(value)) return "s/d";
  if (Math.abs(value) < 0.0005) return "0";
  if (metric?.format === "pp" || metric?.format === "pct") return `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}`;
  return formatNumber(value);
}

function extent(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min || 1) * 0.08;
  return [min - pad, max + pad];
}

function extentWithZero(values) {
  return extent([...values, 0]);
}

function validExtent(extentValue) {
  return Array.isArray(extentValue) &&
    extentValue.length === 2 &&
    extentValue.every(Number.isFinite) &&
    extentValue[0] !== extentValue[1];
}

function trend(points) {
  if (points.length < 2) return null;
  const meanX = points.reduce((s, p) => s + p.x, 0) / points.length;
  const meanY = points.reduce((s, p) => s + p.y, 0) / points.length;
  const sxx = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  if (!sxx) return null;
  const slope = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0) / sxx;
  const intercept = meanY - slope * meanX;
  const sst = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssr = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  return { slope, intercept, r2: sst ? 1 - ssr / sst : 0 };
}

function setupBrush(svg, points) {
  let start = null;
  let rect = null;
  svg.onmousedown = (event) => {
    if (event.target.tagName === "circle") return;
    start = svgPoint(svg, event);
    rect = addSvg(svg, "rect", { x: start.x, y: start.y, width: 0, height: 0, class: "brush-rect" });
  };
  svg.onmousemove = (event) => {
    if (!start || !rect) return;
    const point = svgPoint(svg, event);
    rect.setAttribute("x", Math.min(start.x, point.x));
    rect.setAttribute("y", Math.min(start.y, point.y));
    rect.setAttribute("width", Math.abs(point.x - start.x));
    rect.setAttribute("height", Math.abs(point.y - start.y));
  };
  svg.onmouseup = (event) => {
    if (!start || !rect) return;
    const point = svgPoint(svg, event);
    const x0 = Math.min(start.x, point.x), x1 = Math.max(start.x, point.x);
    const y0 = Math.min(start.y, point.y), y1 = Math.max(start.y, point.y);
    state.scatterSelection = new Set(points.filter((p) => p.cx >= x0 && p.cx <= x1 && p.cy >= y0 && p.cy <= y1).map((p) => p.key));
    rect.remove();
    start = null;
    rect = null;
    refresh();
  };
}

function svgPoint(svg, event) {
  const box = svg.getBoundingClientRect();
  const view = svg.viewBox.baseVal;
  return { x: ((event.clientX - box.left) / box.width) * view.width, y: ((event.clientY - box.top) / box.height) * view.height };
}

function addSvg(parent, name, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  parent.appendChild(node);
  return node;
}

function addText(parent, text, x, y, className) {
  const node = addSvg(parent, "text", { x, y, class: className });
  node.textContent = text;
}

function addBaseLayer(map) {
  L.tileLayer(ARGENMAP_URL, {
    attribution: "IGN Argenmap",
    maxZoom: 18,
  }).addTo(map);
}

function initDrag() {
  makeDraggable(els.scatterPanel, ".scatter-head");
  makeDraggable(els.circuitDrawer, ".drawer-head");
}

function openMethodology() {
  els.methodologyModal.hidden = false;
  els.methodologyPanel.focus();
}

function closeMethodology() {
  els.methodologyModal.hidden = true;
  els.openMethodology.focus();
}

function openCompetitivenessInfo() {
  let popup = document.querySelector("#competitivenessInfo");
  if (!popup) {
    popup = document.createElement("section");
    popup.id = "competitivenessInfo";
    popup.className = "competitiveness-info-modal";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    popup.setAttribute("aria-labelledby", "competitivenessInfoTitle");
    popup.innerHTML = `
      <div class="competitiveness-info-backdrop" data-competitiveness-close></div>
      <article class="competitiveness-info-panel" tabindex="-1">
        <header>
          <h2 id="competitivenessInfoTitle">Competitividad electoral</h2>
          <button type="button" data-competitiveness-close aria-label="Cerrar metodología de competitividad">x</button>
        </header>
        <div class="competitiveness-info-content">
          <p>La competitividad electoral se define como la diferencia en puntos porcentuales entre la primera y la segunda fuerza más votadas en un territorio.</p>
          <p>Cuanto menor es esa diferencia, más competitiva es la elección, en tanto un número relativamente pequeño de votos puede modificar los resultados.</p>
          <p>Por el contrario, cuando la brecha es amplia, la posición de la fuerza ganadora resulta más difícil de alterar mediante variaciones pequeñas del voto.</p>
          <h3>Clasificación</h3>
          <ul>
            <li>0 a 5 pp: Muy competitiva</li>
            <li>Más de 5 a 10 pp: Competitiva</li>
            <li>Más de 10 a 15 pp: Moderadamente competitiva</li>
            <li>Más de 15 a 20 pp: Baja competitividad</li>
            <li>Más de 20 pp: Hegemónica</li>
          </ul>
          <p>La diferencia en puntos porcentuales permite comparar territorios de distinto tamaño. La brecha en votos muestra la magnitud absoluta de la diferencia entre la primera y la segunda fuerza.</p>
        </div>
      </article>
    `;
    document.body.appendChild(popup);
    popup.addEventListener("click", (event) => {
      if (event.target.matches("[data-competitiveness-close]")) closeCompetitivenessInfo();
    });
  }
  popup.classList.add("is-open");
  popup.querySelector(".competitiveness-info-panel")?.focus();
}

function closeCompetitivenessInfo() {
  const popup = document.querySelector("#competitivenessInfo");
  if (!popup) return;
  popup.classList.remove("is-open");
  document.querySelector("[data-competitiveness-info]")?.focus();
}

function makeDraggable(panel, handleSelector) {
  let drag = null;
  const handle = panel.querySelector(handleSelector);
  handle.addEventListener("mousedown", (event) => {
    if (event.target.closest("button")) return;
    const rect = panel.getBoundingClientRect();
    panel.style.position = "fixed";
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    panel.classList.add("is-dragging");
  });
  window.addEventListener("mousemove", (event) => {
    if (!drag) return;
    panel.style.left = `${Math.max(8, drag.left + event.clientX - drag.x)}px`;
    panel.style.top = `${Math.max(8, drag.top + event.clientY - drag.y)}px`;
  });
  window.addEventListener("mouseup", () => {
    drag = null;
    panel.classList.remove("is-dragging");
  });
}

function pinCurrentPartyMap() {
  if (!state.selectedParty || state.pinnedCircuitMaps.length >= 4) return;
  const partyKey = state.selectedParty;
  const id = `pinned-${Date.now()}`;
  const panel = document.createElement("section");
  panel.className = "pinned-circuit-map";
  panel.innerHTML = `
    <div class="drawer-head">
      <div><span>Mapa fijado</span><strong>${territoryLabel(partyKey, "party")}</strong></div>
      <div class="drawer-actions"><button type="button" data-close>Cerrar</button></div>
    </div>
    <div class="pinned-map-canvas" id="${id}"></div>
  `;
  document.body.appendChild(panel);
  panel.style.left = `${320 + state.pinnedCircuitMaps.length * 28}px`;
  panel.style.top = `${90 + state.pinnedCircuitMaps.length * 28}px`;
  makeDraggable(panel, ".drawer-head");
  panel.querySelector("[data-close]").addEventListener("click", () => {
    item.map.remove();
    panel.remove();
    state.pinnedCircuitMaps = state.pinnedCircuitMaps.filter((entry) => entry !== item);
  });

  const map = L.map(id, { zoomControl: false, preferCanvas: true });
  L.control.zoom({ position: "bottomright" }).addTo(map);
  addBaseLayer(map);
  const features = state.circuitGeojson.features.filter((feature) => feature.properties.partido_norm === partyKey);
  const layer = L.geoJSON({ type: "FeatureCollection", features }, { style: styleCircuit }).addTo(map);
  setTimeout(() => {
    map.invalidateSize();
    if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [16, 16] });
  }, 80);
  const item = { partyKey, panel, map };
  state.pinnedCircuitMaps.push(item);
}

async function init() {
  const [data, partyGeojson, circuitGeojson] = await Promise.all([
    fetch("data/electoral_data.json?v=pba3-20260610").then((r) => r.json()),
    fetch("data/partidos_pba.geojson?v=pba3-20260610").then((r) => r.json()),
    fetch("data/circuitos_pba.geojson?v=pba3-20260610").then((r) => r.json()),
  ]);
  state.data = data;
  state.partyGeojson = partyGeojson;
  state.circuitGeojson = circuitGeojson;
  state.baseElection = data.defaults.base;
  state.targetElection = data.defaults.target;

  updateElectionSelectors();
  updateMetricOptions();
  renderQuestions();
  setupScatterOptions();
  initDrag();

  state.map = L.map("map", { zoomControl: false, zoomSnap: 0.25, minZoom: 4, preferCanvas: true }).setView(state.homeView.center, state.homeView.zoom);
  L.control.zoom({ position: "bottomright" }).addTo(state.map);
  addBaseLayer(state.map);
  state.partyLayer = L.geoJSON(partyGeojson, {
    style: styleParty,
    bubblingMouseEvents: false,
    onEachFeature(feature, layer) {
      layer.bindTooltip(mapTooltipHtml(feature, "party"), { className: "map-tooltip", sticky: true });
      bindPolygonHover(layer, styleParty);
      layer.on("click", (event) => {
        if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
        selectParty(feature.properties.key);
      });
    },
  }).addTo(state.map);
  state.map.on("click", clearMapSelectionFromBackground);
  state.map.setMaxBounds([[-56.2, -76.8], [-20.8, -50.8]]);
  refresh();
  requestAnimationFrame(() => {
    state.map.invalidateSize();
    fitMainMapToCurrentState();
  });
  els.loading.classList.add("is-hidden");
}

els.modeElection.addEventListener("click", () => { state.viewMode = "target"; updateMetricOptions(); refresh(); });
els.modeCompare.addEventListener("click", () => { state.viewMode = "comparison"; updateMetricOptions(); updateElectionSelectors(); refresh(); });
els.baseElection.addEventListener("change", () => { state.baseElection = els.baseElection.value; updateElectionSelectors(); refresh(); });
els.targetElection.addEventListener("change", () => { state.targetElection = els.targetElection.value; refresh(); });
els.compareElection.addEventListener("change", () => { state.targetElection = els.compareElection.value; els.targetElection.value = state.targetElection; refresh(); });
els.indicator.addEventListener("change", () => { state.indicator = els.indicator.value; updateMetricOptions(); refresh(); });
els.voteType.addEventListener("change", () => { state.voteType = els.voteType.value; updateMetricOptions(); refresh(); });
els.positiveMeasure.addEventListener("change", () => { state.positiveMeasure = els.positiveMeasure.value; updateMetricOptions(); refresh(); });
els.force.addEventListener("change", () => { state.force = els.force.value; updateMetricOptions(); refresh(); });
els.openMethodology.addEventListener("click", openMethodology);
els.closeMethodology.addEventListener("click", closeMethodology);
els.methodologyModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-methodology-close]")) closeMethodology();
});
els.kpiStrip.addEventListener("click", (event) => {
  if (event.target.closest("[data-competitiveness-info]")) openCompetitivenessInfo();
});
els.resetMap.addEventListener("click", resetView);
els.mapLevelParty.addEventListener("click", () => setMapLevel("party"));
els.mapLevelCircuit.addEventListener("click", () => setMapLevel("circuit"));
els.mapSearchInput.addEventListener("input", () => renderMapSearchResults(els.mapSearchInput.value));
els.mapSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    els.mapSearchInput.value = "";
    els.mapSearchResults.classList.add("is-hidden");
  }
});
els.mapSearchResults.addEventListener("click", (event) => {
  const item = event.target.closest("button[data-key]");
  if (!item) return;
  focusPartyOnMap(item.dataset.key);
  els.mapSearchInput.value = item.textContent;
  els.mapSearchResults.classList.add("is-hidden");
});
els.openQuestions.addEventListener("click", () => showQuestions(true));
els.openScatter.addEventListener("click", () => {
  if (state.viewMode !== "comparison") return;
  openScatterPanel();
});
els.closeScatter.addEventListener("click", closeScatterPanel);
els.clearScatterSelection.addEventListener("click", () => { state.scatterSelection.clear(); refresh(); });
els.scatterUnit.addEventListener("change", () => {
  state.scatterSelection.clear();
  setMapLevel(els.scatterUnit.value === "circuit" ? "circuit" : "party");
});
[els.scatterX, els.scatterY, els.scatterMode].forEach((el) => el.addEventListener("change", () => { state.scatterSelection.clear(); refresh(); }));
els.questionToggle.addEventListener("click", () => showQuestions(els.questionWindow.classList.contains("is-collapsed")));
els.questionMinimize.addEventListener("click", () => { els.questionWindow.classList.toggle("is-minimized"); els.questionWindow.classList.add("is-collapsed"); });
els.questionClose.addEventListener("click", hideQuestions);
els.questionList.addEventListener("click", (event) => {
  const card = event.target.closest(".question-card");
  const question = QUESTIONS.find((item) => item.id === card?.dataset.id);
  if (!question) return;
  applyQuestion(question);
});
els.rankingList.addEventListener("click", (event) => {
  const item = event.target.closest(".ranking-item");
  if (!item) return;
  item.dataset.unit === "party" ? selectParty(item.dataset.key) : selectCircuit(item.dataset.key);
});
els.closeDrawer.addEventListener("click", () => els.circuitDrawer.classList.add("is-hidden"));
els.pinParty.addEventListener("click", pinCurrentPartyMap);
els.exportReport.addEventListener("click", exportReport);
els.exportData.addEventListener("click", exportFilteredCsv);
window.addEventListener("afterprint", () => {
  els.reportRoot.classList.remove("is-rendering");
  els.reportRoot.setAttribute("aria-hidden", "true");
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.methodologyModal.hidden) closeMethodology();
  if (event.key === "Escape") closeCompetitivenessInfo();
});
window.addEventListener("resize", () => { state.map?.invalidateSize(); state.circuitMap?.invalidateSize(); if (!els.scatterPanel.classList.contains("is-hidden")) renderScatter(); });

init().catch((error) => {
  console.error(error);
  els.loading.textContent = "No se pudo cargar el visor. Revisa la consola.";
});
