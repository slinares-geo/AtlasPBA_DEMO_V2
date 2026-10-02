import { setupSimulator } from './simulator.mjs';
import { commonCapabilities, commonLevels, difference } from './election-capabilities.mjs';
import { ADN_ID, ADN_NAME, ADN_LEGEND_LABEL, ADN_DESCRIPTION, ADN_FAMILY, ADN_PALETTE, formatIndex } from './indicator-config.mjs';
import { attachIndex, indexValue, indexColor } from './adn-model.mjs';
import { setupPanelResize } from './panel-resize.mjs';

const state = {
  map: null,
  partyLayer: null,
  circuitMap: null,
  circuitLayer: null,
  scatterMainLayer: null,
  detailLayerUnit: null,
  highlightPinLayer: null,
  data: null,
  socioData: null,
  adnData: null,
  partyGeojson: null,
  localityGeojson: null,
  circuitGeojson: null,
  baseElection: null,
  targetElection: null,
  selectedParty: null,
  selectedLocality: null,
  selectedCircuit: null,
  viewMode: "target",
  indicator: "participacion",
  voteType: "positivo",
  positiveMeasure: "share_positive",
  force: "LLA",
  activeQuestion: null,
  questionUnit: null,
  continuityActive: false,
  continuityElections: new Set(),
  continuityForce: "PERONISMO_K",
  continuityCategory: "all",
  continuityCache: null,
  continuitySelectionInitialized: false,
  continuityDetailUnit: null,
  continuityDetailKey: null,
  territoryModalMode: null,
  territoryModalUnit: null,
  territoryModalKey: null,
  territoryModalTrigger: null,
  profileIndicator: null,
  profileDimension: null,
  profileFamily: null,
  mapLevel: "party",
  centroidCache: { party: new Map(), locality: new Map(), circuit: new Map() },
  scatterSelection: new Set(),
  pinnedCircuitMaps: [],
  drawerContext: null,
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

const TERRITORY_LEVELS = {
  party: { singular: "partido", plural: "partidos", featureKey: "key" },
  locality: { singular: "localidad", plural: "localidades", featureKey: "localidad_key" },
  circuit: { singular: "circuito", plural: "circuitos", featureKey: "key" },
};

const CONTINUITY_CATEGORIES = {
  always_win: { label: "Siempre gana", color: "#2abbcd" },
  always_lose: { label: "Siempre pierde", color: "#9c4f64" },
  alternation: { label: "Alternancia", color: "#f2c14e" },
  tie: { label: "Empate o sin definición", color: "#7b6d8d" },
  incomplete: { label: "Datos incompletos", color: "#77808a" },
};


const CONTINUITY_DEFINITION = 'La continuidad electoral clasifica cada territorio según el resultado del peronismo en las elecciones seleccionadas. “Siempre gana” identifica los territorios donde el peronismo obtiene el primer lugar en todas las elecciones; “Siempre pierde”, aquellos donde no gana en ninguna; y “Alternancia”, los casos donde gana en algunas elecciones y pierde en otras. Los territorios sin información completa se identifican como “Datos incompletos”. Los empates del peronismo en el primer lugar se identifican separadamente y no se consideran victorias.';

const PROFILE_MAIN_INDICATORS = [
  "poblacion_total",
  "condac_2P",
  "nbi_tot_1P",
  "p19_3P",
];

const SOCIO_DIMENSIONS = {
  indices_compuestos: "Índices compuestos",
  capital_humano: "Educación",
  acceso_informacion: "Acceso a información",
  privacion: "Privación multidimensional",
  proteccion_social: "Protección social",
  mercado_trabajo: "Mercado de trabajo",
  vivienda: "Vivienda",
  poblacion_migraciones: "Población y migraciones",
};

const SOCIO_FAMILIES = [
  ADN_FAMILY,
  { id: "population_total", dimension: "poblacion_migraciones", label: "Población total", shortName: "Población total", codes: ["poblacion_total"], categories: { poblacion_total: "Personas" } },
  { id: "population_age", dimension: "poblacion_migraciones", label: "Población por grupo de edad", shortLabel: "Población", codes: ["EDAD0_14", "EDAD15_29", "EDAD30_54", "EDAD55yMas"], categories: { EDAD0_14: "0–14 años", EDAD15_29: "15–29 años", EDAD30_54: "30–54 años", EDAD55yMas: "55 años y más" } },
  { id: "migration", dimension: "poblacion_migraciones", label: "Residencia hace cinco años", codes: ["P17_1P", "p17_2P", "p17_3P", "p17_4P", "p17_5P"], categories: { P17_1P: "Misma localidad", p17_2P: "Otra localidad bonaerense", p17_3P: "Otra provincia", p17_4P: "Otro país", p17_5P: "No había nacido" } },
  { id: "educational_climate", dimension: "capital_humano", label: "Clima educativo del hogar", shortLabel: "Clima educativo", codes: ["eduhog1P", "eduhog2P", "eduhog3P", "eduhog4P", "eduhog5P"], categories: { eduhog1P: "Muy bajo", eduhog2P: "Bajo", eduhog3P: "Medio", eduhog4P: "Alto", eduhog5P: "Muy alto" } },
  { id: "digital_access", dimension: "acceso_informacion", label: "Acceso a computadora o tablet", shortLabel: "Acceso digital", codes: ["h24c_1P", "h24c_2P"], categories: { h24c_1P: "Con computadora o tablet", h24c_2P: "Sin computadora o tablet" } },
  { id: "nbi_housing", dimension: "privacion", label: "NBI · Vivienda inconveniente", shortLabel: "NBI vivienda", codes: ["nbi_tot_1P", "nbi_tot_2P"], categories: { nbi_tot_1P: "Con vivienda inconveniente", nbi_tot_2P: "Sin vivienda inconveniente" } },
  { id: "health_coverage", dimension: "proteccion_social", label: "Cobertura de salud", codes: ["p19_1P", "p19_2P", "p19_3P"], categories: { p19_1P: "Obra social o prepaga", p19_2P: "Plan estatal", p19_3P: "Sin cobertura" } },
  { id: "pension", dimension: "proteccion_social", label: "Jubilación o pensión", shortLabel: "Jubilación o pensión", codes: ["p20_1P", "p20_2P"], categories: { p20_1P: "Percibe jubilación o pensión", p20_2P: "No percibe jubilación o pensión" } },
  { id: "activity", dimension: "mercado_trabajo", label: "Condición de actividad", shortLabel: "Actividad", codes: ["condac_1P", "condac_2P", "condac_3P"], categories: { condac_1P: "Ocupados", condac_2P: "Desocupados", condac_3P: "Inactivos" } },
  { id: "occupational_category", dimension: "mercado_trabajo", label: "Categoría ocupacional", codes: ["P30_1P", "p30_2P", "p30_3P", "p30_4P", "p30_5P", "p30_6P"], categories: { P30_1P: "Servicio doméstico", p30_2P: "Empleados/as", p30_3P: "Cuenta propia", p30_4P: "Empleadores/as", p30_5P: "Trabajo familiar", p30_6P: "Categoría ignorada" }, sortDescending: true },
  { id: "activity_branch", dimension: "mercado_trabajo", label: "Rama de actividad", codes: [..."ABCDEFGHIJKLMNOPQRSTU".split(""), "V", "Z"], categories: { U: "Organizaciones extraterritoriales", V: "Sin respuesta", Z: "Información insuficiente" }, sortDescending: true },
  { id: "housing_type", dimension: "vivienda", label: "Tipo de vivienda", codes: ["v01_1ocup_1P", "v01_1ocup_2P", "v01_1ocup_3P", "v01_1ocup_4P", "v01_1ocup_5P", "v01_1ocup_6P", "v01_1ocup_7P", "v01_1ocup_8P"], categories: { v01_1ocup_1P: "Casa A", v01_1ocup_2P: "Casa B", v01_1ocup_3P: "Rancho", v01_1ocup_4P: "Casilla", v01_1ocup_5P: "Departamento", v01_1ocup_6P: "Inquilinato, hotel o pensión", v01_1ocup_7P: "Local no construido para habitación", v01_1ocup_8P: "Vivienda móvil" } },
  { id: "overcrowding", dimension: "vivienda", label: "Hacinamiento", codes: ["hacin_1P", "hacin_2P", "hacin_3P", "hacin_4P", "hacin_5P", "hacin_6P"], categories: { hacin_1P: "Hasta 0,50 personas por cuarto", hacin_2P: "0,51–0,99", hacin_3P: "1,00–1,49", hacin_4P: "1,50–1,99", hacin_5P: "2,00–3,00", hacin_6P: "Más de 3,00" } },
  { id: "material_quality", dimension: "vivienda", label: "Calidad de materiales", codes: ["inmat_1P", "inmat_2P", "inmat_3P", "inmat_4P", "inmat_5P"], categories: { inmat_1P: "Calidad I", inmat_2P: "Calidad II", inmat_3P: "Calidad III", inmat_4P: "Calidad IV", inmat_5P: "Calidad ignorada" } },
  { id: "housing_tenure", dimension: "vivienda", label: "Tenencia de la vivienda", codes: ["h22_1P", "h22_2P", "h22_3P", "h22_4P", "h22_5P"], categories: { h22_1P: "Propia", h22_2P: "Alquilada", h22_3P: "Cedida por trabajo", h22_4P: "Prestada", h22_5P: "Otra situación" } },
];

const SOCIO_FAMILY_BY_CODE = new Map(SOCIO_FAMILIES.flatMap((family) => family.codes.map((code) => [code, family])));

const STACK_FALLBACK_COLORS = ["#d94f70", "#238f9d", "#e7b84d", "#7b6d8d", "#5f8f53", "#b36b42"];
const PROFILE_STACK_FAMILIES = new Set(["educational_climate", "activity", "health_coverage", "digital_access", "nbi_housing", "pension"]);

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

//ArgenMapColor
const ARGENMAP_URL = "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png";

//ArgenMapHibrido



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

const SCATTER_ELECTORAL_METRICS = [
  { value: "electoral:participacion", label: "Participación electoral", format: "pct" },
  { value: "electoral:ausentismo", label: "Ausentismo electoral", format: "pct" },
  { value: "electoral:competitividad", label: "Competitividad", format: "pct" },
  { value: "electoral:fuerza", label: "Voto de la fuerza seleccionada", format: "pct" },
  { value: "electoral:blanco", label: "Voto en blanco", format: "pct" },
  { value: "electoral:nulo", label: "Voto nulo", format: "pct" },
];

const QUESTIONS = [
  {
    id: "continuidad-peronismo",
    group: "Núcleos de fortaleza",
    label: "¿Dónde gana siempre, pierde siempre o alterna el peronismo?",
    description: "Clasifica territorios según los resultados del peronismo en dos o más elecciones.",
    unit: "current",
    continuity: true,
  },
  {
    id: "socio-nbi-peronismo",
    group: "Cruces socioelectorales",
    label: "NBI y voto peronista",
    description: "Cruza la proporción de hogares con NBI del Censo 2022 con el voto peronista de la elección seleccionada.",
    mode: "target",
    indicator: "votos",
    voteType: "positivo",
    positiveMeasure: "share_positive",
    force: "PERONISMO_K",
    sort: "desc",
    unit: "current",
    scatter: { unit: "current", x: "socio:nbi_tot_1P", y: "electoral:fuerza", force: "PERONISMO_K", mode: "highlight" },
  },
  {
    id: "socio-hacinamiento-participacion",
    group: "Cruces socioelectorales",
    label: "Hacinamiento y participación",
    description: "Cruza hacinamiento crítico del Censo 2022 con participación electoral y excluye territorios sin observaciones completas.",
    mode: "target",
    indicator: "participacion",
    sort: "desc",
    unit: "current",
    scatter: { unit: "current", x: "socio:hacin_6P", y: "electoral:participacion", mode: "highlight" },
  },
  {
    id: "socio-clima-alto-peronismo",
    group: "Cruces socioelectorales",
    label: "Clima educativo alto (%)",
    description: "Cruza la proporción de hogares con clima educativo alto del Censo 2022 con el voto peronista de la elección seleccionada.",
    mode: "target",
    indicator: "votos",
    voteType: "positivo",
    positiveMeasure: "share_positive",
    force: "PERONISMO_K",
    sort: "desc",
    unit: "current",
    scatter: { unit: "current", x: "socio:eduhog4P", y: "electoral:fuerza", force: "PERONISMO_K", mode: "highlight" },
  },
  {
    id: "socio-ocupados-peronismo",
    group: "Cruces socioelectorales",
    label: "Condición de actividad (ocupados %)",
    description: "Cruza la proporción de población ocupada del Censo 2022 con el voto peronista de la elección seleccionada.",
    mode: "target",
    indicator: "votos",
    voteType: "positivo",
    positiveMeasure: "share_positive",
    force: "PERONISMO_K",
    sort: "desc",
    unit: "current",
    scatter: { unit: "current", x: "socio:condac_1P", y: "electoral:fuerza", force: "PERONISMO_K", mode: "highlight" },
  },
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

const QUESTION_GROUP_ORDER = [
  "Distribución territorial",
  "Núcleos de fortaleza",
  "Comparación temporal",
  "Zonas de debilidad",
  "Competitividad electoral",
  "Ausentismo",
  "Voto blanco y nulo",
  "Cruces socioelectorales",
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
  rankingContext: document.querySelector("#rankingContext"),
  rankingList: document.querySelector("#rankingList"),
  legend: document.querySelector("#legend"),
  resetMap: document.querySelector("#resetMap"),
  mapSearchInput: document.querySelector("#mapSearchInput"),
  mapSearchResults: document.querySelector("#mapSearchResults"),
  mapLevelParty: document.querySelector("#mapLevelParty"),
  mapLevelLocality: document.querySelector("#mapLevelLocality"),
  mapLevelCircuit: document.querySelector("#mapLevelCircuit"),
  openQuestions: document.querySelector("#openQuestions"),
  openScatter: document.querySelector("#openScatter"),
  openContinuity: document.querySelector("#openContinuity"),
  continuityControls: document.querySelector("#continuityControls"),
  closeContinuity: document.querySelector("#closeContinuity"),
  continuityUnit: document.querySelector("#continuityUnit"),
  continuityElections: document.querySelector("#continuityElections"),
  continuityElectionToggle: document.querySelector("#continuityElectionToggle"),
  continuityElectionMenu: document.querySelector("#continuityElectionMenu"),
  continuityAllCheckbox: document.querySelector("#continuityAllCheckbox"),
  continuityForce: document.querySelector("#continuityForce"),
  continuityCategory: document.querySelector("#continuityCategory"),
  continuitySummary: document.querySelector("#continuitySummary"),
  continuitySelectAll: document.querySelector("#continuitySelectAll"),
  continuityClearAll: document.querySelector("#continuityClearAll"),
  continuitySelectionCount: document.querySelector("#continuitySelectionCount"),
  continuityValidation: document.querySelector("#continuityValidation"),

  continuityDetail: document.querySelector("#continuityDetail"),
  questionWindow: document.querySelector("#questionWindow"),
  questionToggle: document.querySelector("#questionToggle"),
  questionMinimize: document.querySelector("#questionMinimize"),
  questionClose: document.querySelector("#questionClose"),
  activeQuestionLabel: document.querySelector("#activeQuestionLabel"),
  questionList: document.querySelector("#questionList"),
  assistantResponse: document.querySelector("#assistantResponse"),
  circuitDrawer: document.querySelector("#circuitDrawer"),
  drawerKicker: document.querySelector("#drawerKicker"),
  drawerTitle: document.querySelector("#drawerTitle"),
  drawerNote: document.querySelector("#drawerNote"),
  closeDrawer: document.querySelector("#closeDrawer"),
  pinDrawer: document.querySelector("#pinDrawer"),
  exportReport: document.querySelector("#exportReport"),
  exportData: document.querySelector("#exportData"),
  scatterPanel: document.querySelector("#scatterPanel"),
  closeScatter: document.querySelector("#closeScatter"),
  scatterUnit: document.querySelector("#scatterUnit"),
  scatterX: document.querySelector("#scatterX"),
  scatterY: document.querySelector("#scatterY"),
  scatterElection: document.querySelector("#scatterElection"),
  scatterForce: document.querySelector("#scatterForce"),
  scatterMode: document.querySelector("#scatterMode"),
  scatterChart: document.querySelector("#scatterChart"),
  scatterStats: document.querySelector("#scatterStats"),
  scatterMeta: document.querySelector("#scatterMeta"),
  scatterTable: document.querySelector("#scatterTable"),
  clearScatterSelection: document.querySelector("#clearScatterSelection"),
  exportScatter: document.querySelector("#exportScatter"),
  territoryModal: document.querySelector("#territoryModal"),
  territoryModalPanel: document.querySelector("#territoryModalPanel"),
  territoryModalKicker: document.querySelector("#territoryModalKicker"),
  territoryModalTitle: document.querySelector("#territoryModalTitle"),
  territoryModalContent: document.querySelector("#territoryModalContent"),
  closeTerritoryModal: document.querySelector("#closeTerritoryModal"),
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
  if (format === "index") return formatIndex(value);
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
  return state.data[unit]?.elections[electionId] || {};
}

function metricElectionIds() {
  return state.viewMode === "comparison" ? [state.baseElection, state.targetElection] : [state.targetElection];
}

function territorialElectionIds() {
  if (state.continuityActive) return selectedContinuityElections();
  const ids = metricElectionIds();
  if (isScatterOpen()) {
    for (const control of [els.scatterX, els.scatterY]) {
      if (control.value.startsWith("electoral:")) ids.push(els.scatterElection.value);
      else if (!control.value.startsWith("socio:")) ids.push(state.baseElection, state.targetElection);
    }
  }
  return [...new Set(ids.filter(Boolean))];
}

function validTerritorialLevel(level) {
  return commonLevels(state.data, territorialElectionIds()).includes(level) ? level : "party";
}

function sourceHasVoters(id) {
  return state.data.sources.find(source => source.id === id)?.voter_total_available !== false;
}

function scatterMetricSupported(value) {
  if (!value || value.startsWith("socio:")) return true;
  const ids = value.startsWith("electoral:") ? [els.scatterElection.value || state.targetElection] : [state.baseElection, state.targetElection];
  if (/participacion|ausentismo/.test(value)) return ids.every(sourceHasVoters);
  if (/blanco|nulo/.test(value)) return commonCapabilities(state.data, ids, "available_vote_types").includes(value.includes("blanco") ? "blanco" : "nulo");
  return true;
}

function questionSupported(question) {
  if (question.continuity) return true;
  const ids = question.mode === "comparison" ? [state.baseElection, state.targetElection] : [state.targetElection];
  if (question.indicator && !commonCapabilities(state.data, ids, "available_metrics").includes(question.indicator)) return false;
  if (question.voteType && !commonCapabilities(state.data, ids, "available_vote_types").includes(question.voteType)) return false;
  if (question.positiveMeasure && !commonCapabilities(state.data, ids, "available_positive_measures").includes(question.positiveMeasure)) return false;
  return !question.scatter || [question.scatter.x, question.scatter.y].every(scatterMetricSupported);
}

function syncElectionCapabilities() {
  const levels = commonLevels(state.data, territorialElectionIds());
  const changed = !levels.includes(state.mapLevel);
  if (changed) {
    state.mapLevel = "party";
    state.continuityDetailKey = null;
    state.continuityDetailUnit = null;
    state.continuityCache = null;
    state.scatterSelection.clear();
  }
  if (state.questionUnit && !levels.includes(state.questionUnit)) state.questionUnit = "party";
  if (!levels.includes("circuit")) {
    state.selectedCircuit = null;
    closeCircuitDrawer();
    state.pinnedCircuitMaps.forEach(item => { item.map.remove(); item.panel.remove(); });
    state.pinnedCircuitMaps = [];
  }
  if (!levels.includes("locality")) state.selectedLocality = null;
  for (const [level, control] of [["party", els.mapLevelParty], ["locality", els.mapLevelLocality], ["circuit", els.mapLevelCircuit]]) {
    control.hidden = !levels.includes(level);
    control.disabled = !levels.includes(level);
  }
  for (const control of [els.scatterUnit, els.continuityUnit]) {
    const allowed = control === els.continuityUnit ? commonLevels(state.data, selectedContinuityElections()) : levels;
    [...control.options].forEach(option => { option.hidden = option.disabled = !allowed.includes(option.value); });
    if (!allowed.includes(control.value)) control.value = "party";
  }
  for (const control of [els.scatterX, els.scatterY]) {
    [...control.options].forEach(option => { option.hidden = option.disabled = !scatterMetricSupported(option.value); });
    if (control.selectedOptions[0]?.disabled) control.value = control === els.scatterX ? "peronismo_delta" : "margen_delta";
  }
  if (state.activeQuestion && !questionSupported(state.activeQuestion)) {
    state.activeQuestion = null;
    state.questionUnit = null;
    els.activeQuestionLabel.textContent = "Sin pregunta activa";
    state.scatterSelection.clear();
  }
  els.questionList.querySelectorAll('[data-id]').forEach(button => {
    const question = QUESTIONS.find(q => q.id === button.dataset.id);
    button.disabled = question && !questionSupported(question);
    button.title = button.disabled ? "Métrica no publicada o no comparable para esta elección" : "";
  });
  const limited = territorialElectionIds().map(id => state.data.sources.find(s => s.id === id)).filter(s => s?.minimum_level === "party");
  const note = document.getElementById("electionCoverageNote");
  note.hidden = !limited.length;
  note.textContent = limited.length ? "Provinciales PBA 2025 · Escrutinio definitivo de la Junta Electoral. Disponible solo por partido/distrito. Diputados o Senadores según sección. Total publicado: positivos + blancos; participación, ausentismo y nulos no disponibles. Comparaciones en el nivel común: partido." : "";
  if (changed) requestAnimationFrame(() => fitMainMapToCurrentState());
}

function currentUnit() {
  if (state.continuityActive) return state.mapLevel;
  if (state.questionUnit) return state.questionUnit;
  if (state.selectedCircuit) return "circuit";
  if (state.selectedLocality) return "locality";
  if (state.selectedParty && state.mapLevel === "party") return validTerritorialLevel("circuit");
  return state.mapLevel;
}

function effectiveQuestionUnit(question) {
  return validTerritorialLevel(question?.unit === "current" ? state.mapLevel : question?.unit || "party");
}

function unitLabel(unit, plural = true) {
  const config = TERRITORY_LEVELS[unit] || TERRITORY_LEVELS.party;
  return plural ? config.plural : config.singular;
}

function featureKeyForUnit(feature, unit) {
  return feature?.properties?.[TERRITORY_LEVELS[unit]?.featureKey || "key"] || null;
}

function currentMetricList() {
  const allowed = commonCapabilities(state.data, metricElectionIds(), "available_metrics");
  const metrics = METRICS.base.filter(metric => allowed.includes(metric.value));
  if (state.viewMode !== "comparison") metrics.push({ value: ADN_ID, label: ADN_NAME, format: "index" });
  return metrics;
}

function currentMetric() {
  return currentMetricList().find((metric) => metric.value === state.indicator) || currentMetricList()[0];
}

function currentElectionId() {
  return state.targetElection;
}

function rowFor(key, unit) {
  if (state.indicator === ADN_ID) return state.adnData.territories[unit]?.[key] || null;
  return state.viewMode === "comparison" ? comparisonRow(key, unit) : unitData(unit, state.targetElection)[key] || null;
}

function rowForFeature(feature, unit, electionId = state.targetElection) {
  const rows = unitData(unit, electionId);
  const key = featureKeyForUnit(feature, unit);
  if (key && rows[key]) return rows[key];
  if (unit === "circuit") {
    return Object.values(rows).find((row) =>
      row.partido_norm === feature?.properties?.partido_norm &&
      String(row.circuito) === String(feature?.properties?.circuito)
    ) || null;
  }
  if (unit === "locality") {
    return Object.values(rows).find((row) => row.key === feature?.properties?.localidad_key) || null;
  }
  if (unit === "party") {
    return Object.values(rows).find((row) => row.partido_norm === key || row.partido_norm === feature?.properties?.partido_norm) || null;
  }
  return null;
}

function valueForFeature(feature, unit) {
  if (state.indicator === ADN_ID) return indexValue(state.adnData, unit, featureKeyForUnit(feature, unit));
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
    localidad: row.localidad,
    localidad_norm: row.localidad_norm,
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
  if (state.indicator === ADN_ID) return indexValue(state.adnData, unit, key);
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
    return row[fields[state.voteType]] ?? (state.voteType === "blanco" && state.viewMode !== "comparison" ? row.pct_blanco_total_publicado : null) ?? null;
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
  if (state.indicator === ADN_ID) return state.adnData.metadata.display_domain;
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
  if (state.indicator === ADN_ID) return ADN_NAME;
  const prefix = state.viewMode === "comparison" ? "Cambio " : "";
  if (state.indicator === "participacion") return `${prefix}participación electoral`;
  if (state.indicator === "ausentismo") return `${prefix}ausentismo electoral`;
  if (state.indicator === "competitividad") return `${prefix}competitividad`;
  if (state.voteType !== "positivo") return `${prefix}${VOTE_TYPE_LABELS[state.voteType] || state.voteType}${publishedWhiteBasis() ? " sobre total publicado" : ""}`;
  const measure = {
    share_positive: `${FORCE_LABELS[state.force] || state.force} sobre votos positivos`,
    share_total: `${FORCE_LABELS[state.force] || state.force} sobre total de votos`,
    gap_winner: `${FORCE_LABELS[state.force] || state.force}: distancia a la primera fuerza`,
  }[state.positiveMeasure];
  return `${prefix}${measure}`;
}

function metricTooltipLabel() {
  if (state.indicator === ADN_ID) return ADN_NAME;
  if (state.indicator === "participacion") return state.viewMode === "comparison" ? "Cambio participacion" : "Participacion";
  if (state.indicator === "ausentismo") return state.viewMode === "comparison" ? "Cambio ausentismo" : "Ausentismo";
  if (state.indicator === "competitividad") return state.viewMode === "comparison" ? "Cambio competitividad" : "Competitividad";
  if (state.voteType !== "positivo") return state.viewMode === "comparison" ? `Cambio ${VOTE_TYPE_LABELS[state.voteType] || state.voteType}` : (VOTE_TYPE_LABELS[state.voteType] || state.voteType);
  const force = FORCE_LABELS[state.force] || state.force;
  if (state.positiveMeasure === "gap_winner") return `${force}: distancia`;
  return state.viewMode === "comparison" ? `Cambio ${force}` : `Voto ${force}`;
}

function circuitLocalityTooltip(feature, unit) {
  if (unit !== "circuit") return "";
  const props = feature?.properties || {};
  if (!props.localidad_clc) {
    return `<div class="tooltip-value">Localidad urbana: <strong>sin CLC &gt;2.000 hab.</strong></div>`;
  }
  const method = props.localidad_metodo === "mayor_poblacion_radios"
    ? "principal por población de radios"
    : "CLC único en sus radios";
  const confidence = props.localidad_confianza ? ` · confianza ${props.localidad_confianza}` : "";
  const weight = props.localidad_candidatas > 1 && isFiniteNumber(props.localidad_peso_poblacional)
    ? ` · ${formatPct(props.localidad_peso_poblacional)} de la población urbana`
    : "";
  return `<div class="tooltip-value">Localidad: <strong>${escapeHtml(props.localidad)}</strong> · ${escapeHtml(method + confidence + weight)}</div>`;
}

function electoralAvailabilityLine(feature, unit, row) {
  if (unit !== "locality" || (feature?.properties?.has_electoral_data !== false && row)) return "";
  return `<div class="tooltip-value"><strong>Sin resultados electorales asignados.</strong> La localidad permanece visible por su geometría oficial.</div>`;
}

function mapTooltipHtml(feature, unit) {
  const key = featureKeyForUnit(feature, unit);
  const label = key ? territoryLabel(key, unit) : `${feature.properties.partido} · sin localidad asignada`;
  const localityLine = circuitLocalityTooltip(feature, unit);
  const value = valueForFeature(feature, unit);
  const targetRow = rowForFeature(feature, unit, state.targetElection);
  const availabilityLine = electoralAvailabilityLine(feature, unit, targetRow);
  if (state.continuityActive && key) return continuityTooltipHtml(key, unit);
  if (state.indicator === ADN_ID) {
    const record = state.adnData.territories[unit]?.[key];
    return `<div class="tooltip-title">${escapeHtml(label)}</div><div class="tooltip-unit">Censo 2022 · Experimental</div><div class="tooltip-value">${escapeHtml(ADN_NAME)}: <strong>${formatIndex(value)}</strong></div>${record?.motivo_sin_dato ? `<div>${escapeHtml(record.motivo_sin_dato)}</div>` : ""}`;
  }
  if (state.activeQuestion?.mapMode === "winner") {
    return `
      <div class="tooltip-title">${escapeHtml(label)}</div>
      <div class="tooltip-unit">${unitLabel(unit, false)}</div>
      ${localityLine}
      ${availabilityLine}
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
      ${localityLine}
      ${availabilityLine}
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
    ${localityLine}
    ${availabilityLine}
    ${gapWinnerNote}
  `;
}

function publishedWhiteBasis() {
  return state.viewMode !== "comparison" && state.voteType === "blanco" && state.data.sources.find(s => s.id === state.targetElection)?.vote_share_basis === "valid_published";
}

function metricDefinition() {
  if (state.continuityActive) return CONTINUITY_DEFINITION;
  if (state.indicator === ADN_ID) return ADN_DESCRIPTION;
  if (state.indicator === "participacion") return "Porcentaje de electores habilitados que emitieron voto.";
  if (state.indicator === "ausentismo") return "Porcentaje de electores habilitados que no votaron.";
  if (state.indicator === "competitividad") return "Margen entre la primera y la segunda fuerza sobre votos positivos. Valores mas bajos indican mayor competencia.";
  if (publishedWhiteBasis()) return "Votos en blanco como porcentaje del total publicado: positivos + blancos. No incluye otros tipos no publicados.";
  if (state.voteType !== "positivo") return `${VOTE_TYPE_LABELS[state.voteType] || "Tipo de voto"} como porcentaje del total de votos emitidos.`;
  if (state.positiveMeasure === "share_total") return `${FORCE_LABELS[state.force] || state.force} como porcentaje del total de votos emitidos.`;
  if (state.positiveMeasure === "gap_winner") return `Diferencia entre ${FORCE_LABELS[state.force] || state.force} y la primera fuerza. Los territorios donde la fuerza seleccionada lidera se excluyen de esta lectura.`;
  return `${FORCE_LABELS[state.force] || state.force} como porcentaje de los votos positivos.`;
}

function metricColor() {
  if (state.indicator === ADN_ID) return ADN_PALETTE.at(-1);
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
  if (state.indicator === ADN_ID) return indexColor(value, state.adnData.metadata.display_domain);
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
  if (state.continuityActive) return continuityColor(key, unit);
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

let simulatorSelectionLayer = null;
let simulatorMapNote = null;
function highlightSimulatorTerritories(keys, electionId) {
  if (!state.map) return;
  if (simulatorSelectionLayer) state.map.removeLayer(simulatorSelectionLayer);
  simulatorSelectionLayer = null;
  simulatorMapNote?.remove();
  simulatorMapNote = null;
  if (!keys.size) return;
  if (!state.map.getPane('simulatorSelection')) {
    const pane = state.map.createPane('simulatorSelection');
    pane.style.zIndex = '450';
    pane.style.pointerEvents = 'none';
  }
  simulatorSelectionLayer = L.geoJSON({ type: 'FeatureCollection', features: state.partyGeojson.features.filter(f => keys.has(f.properties.key)) }, {
    pane: 'simulatorSelection', interactive: false,
    style: { color: '#8928b0', weight: 3.5, opacity: 1, fillColor: '#ad5bc9', fillOpacity: .12, dashArray: '6 3' },
  }).addTo(state.map);
  simulatorMapNote = L.control({ position: 'bottomleft' });
  simulatorMapNote.onAdd = () => {
    const note = L.DomUtil.create('div', 'sim-map-note');
    const mapped = simulatorSelectionLayer.getLayers().length;
    note.textContent = `Contorno violeta: ${keys.size} partidos del simulador · ${electionLabel(electionId)}. ${mapped < keys.size ? `${keys.size - mapped} sin geometría. ` : ''}El relleno del mapa conserva los filtros del Atlas.`;
    return note;
  };
  simulatorMapNote.addTo(state.map);
}

// This view owns only a temporary map layer; Atlas filters and selections stay untouched.
let simulatorAtlasView = null;
function simulatorViewStyle(feature) {
  const active = simulatorAtlasView.keys.has(feature.properties.key);
  const unit = simulatorAtlasView.unit || 'party';
  const row = unitData(unit,simulatorAtlasView.electionId)[feature.properties.key];
  return { color: active ? '#702091' : '#477580', weight: active ? 3 : .8, dashArray: row ? null : '4 4', fillColor: indexColor(indexValue(state.adnData,unit,feature.properties.key),state.adnData.metadata.display_domain), fillOpacity: .9 };
}
function updateSimulatorAtlasView({ keys, electionId, force, unit = 'party', parentParties = new Set(), fit = false }) {
  if (!simulatorAtlasView) return;
  const scope = `${electionId}|${unit}|${[...parentParties].sort().join(',')}`;
  Object.assign(simulatorAtlasView, { keys: new Set(keys), electionId, force, unit, parentParties:new Set(parentParties) });
  if (scope !== simulatorAtlasView.scope) {
    simulatorAtlasView.scope = scope;
    simulatorAtlasView.layer.clearLayers();
    if (simulatorAtlasView.background) state.map.removeLayer(simulatorAtlasView.background);
    if (unit === 'circuit') {
      simulatorAtlasView.background = L.geoJSON(state.partyGeojson, {
        renderer:simulatorAtlasView.renderer, interactive:false,
        style:{fillColor:'#ffffff',fillOpacity:1,color:'#c3cbcc',weight:.7},
      }).addTo(state.map);
      simulatorAtlasView.layer.addData({type:'FeatureCollection',features:state.circuitGeojson.features.filter(f=>parentParties.has(f.properties.partido_norm))});
      simulatorAtlasView.layer.bringToFront();
    } else {
      simulatorAtlasView.background = null;
      simulatorAtlasView.layer.addData(state.partyGeojson);
    }
  }
  simulatorAtlasView.layer.setStyle(simulatorViewStyle);
  let withoutResults = 0;
  simulatorAtlasView.layer.eachLayer(layer => {
    const key = layer.feature.properties.key, row = unitData(unit,electionId)[key];
    if (!row) withoutResults++;
    const label = unit === 'circuit' ? `${row?.partido || layer.feature.properties.partido} · Circuito ${row?.circuito || key}` : row?.partido || key;
    layer.setTooltipContent(`<strong>${escapeHtml(label)}</strong><br>${escapeHtml(ADN_NAME)}: ${formatIndex(indexValue(state.adnData,unit,key))}<br>${escapeHtml(force)}: ${formatPct(row?.positivos > 0 ? (row.fuerzas?.[force] || 0) / row.positivos : null)}<br>Votos positivos: ${formatNumber(row?.positivos)}<br>${row ? 'Clic para agregar o quitar de la selección' : 'Sin resultados electorales; no se incluye en el potencial'}`);
  });
  const geometryKeys = new Set(simulatorAtlasView.layer.getLayers().map(layer=>layer.feature.properties.key));
  const withoutGeometry = [...keys].filter(key=>!geometryKeys.has(key)).length;
  simulatorAtlasView.noteElement.innerHTML = `<strong>${escapeHtml(ADN_LEGEND_LABEL)}</strong><div class="legend-ramp" style="background:linear-gradient(90deg,${ADN_PALETTE.join(',')})"></div><div class="legend-scale"><span>${formatIndex(state.adnData.metadata.display_domain[0])}</span><span>${formatIndex(state.adnData.metadata.display_domain[1])}</span></div>${withoutResults ? `<small>${withoutResults} territorios sin resultados; no suman potencial.</small>` : ''}${withoutGeometry ? `<small>${withoutGeometry} seleccionados sin geometría.</small>` : ''}`;
  if (fit) {
    const bounds = simulatorAtlasView.layer.getBounds();
    if (bounds.isValid()) state.map.fitBounds(bounds,{padding:[24,24],animate:false});
  }
}
function enterSimulatorAtlasView(options) {
  if (simulatorAtlasView || !state.map) return;
  const hiddenLayers = [state.partyLayer, state.scatterMainLayer, state.highlightPinLayer, simulatorSelectionLayer].filter(layer => layer && state.map.hasLayer(layer));
  simulatorAtlasView = { ...options, keys: new Set(options.keys), hiddenLayers, center: state.map.getCenter(), zoom: state.map.getZoom(), maxBounds: state.map.options.maxBounds, scroll: window.scrollY };
  hiddenLayers.forEach(layer => state.map.removeLayer(layer));
  if (!state.map.getPane('simulatorExplorer')) state.map.createPane('simulatorExplorer').style.zIndex = '460';
  simulatorAtlasView.renderer = L.canvas({ pane: 'simulatorExplorer' });
  simulatorAtlasView.layer = L.geoJSON(null, {
    renderer: simulatorAtlasView.renderer, pane: 'simulatorExplorer', style: simulatorViewStyle, bubblingMouseEvents: false,
    onEachFeature(feature, layer) {
      layer.bindTooltip('', { className: 'map-tooltip', sticky: true });
      layer.on('click', event => { if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent); simulatorAtlasView?.onToggle(feature.properties.key); });
    },
  }).addTo(state.map);
  simulatorAtlasView.note = L.control({ position: 'bottomleft' });
  simulatorAtlasView.note.onAdd = () => {
    const note = L.DomUtil.create('div', 'sim-map-note');
    L.DomEvent.disableClickPropagation(note); L.DomEvent.disableScrollPropagation(note);
    simulatorAtlasView.noteElement = note; return note;
  };
  simulatorAtlasView.note.addTo(state.map);
  updateSimulatorAtlasView(options);
  requestAnimationFrame(() => {
    if (!simulatorAtlasView) return;
    state.map.invalidateSize();
    state.map.fitBounds(simulatorAtlasView.layer.getBounds(), { padding: [24, 24], animate: false });
  });
}
function leaveSimulatorAtlasView() {
  if (!simulatorAtlasView) return;
  const previous = simulatorAtlasView;
  if (previous.background) state.map.removeLayer(previous.background);
  state.map.removeLayer(previous.layer); state.map.removeLayer(previous.renderer); previous.note.remove();
  previous.hiddenLayers.forEach(layer => layer.addTo(state.map));
  simulatorAtlasView = null;
  requestAnimationFrame(() => {
    state.map.setMaxBounds(null);
    state.map.stop(); state.map.invalidateSize({ pan: false });
    state.map.setView(previous.center, previous.zoom, { animate: false, reset: true });
    state.map.setMaxBounds(previous.maxBounds);
    window.scrollTo({ top: previous.scroll, behavior: 'instant' });
  });
}
function fitSimulatorSelection(keys) {
  if (!simulatorAtlasView || !keys.size) return;
  const bounds = L.latLngBounds([]);
  simulatorAtlasView.layer.eachLayer(layer => { if (keys.has(layer.feature.properties.key)) bounds.extend(layer.getBounds()); });
  if (bounds.isValid()) state.map.fitBounds(bounds, { padding: [24, 24], animate: false });
  document.querySelector('.map-pane').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function styleParty(feature) {
  const key = feature.properties.key;
  const selected = state.selectedParty === key;
  const scatterDim = (state.scatterSelection.size && els.scatterMode.value === "filter" && !state.scatterSelection.has(key)) || continuityDimmed(key, "party");
  return {
    color: selected ? COLORS.accent : COLORS.border,
    weight: selected ? 2.3 : 0.7,
    fillColor: mapFillColor(key, "party"),
    fillOpacity: scatterDim ? 0.08 : state.indicator === ADN_ID ? 0.9 : selected ? 0.75 : 0.55,
    opacity: scatterDim ? 0.25 : selected ? 0.95 : 0.78,
  };
}

function styleCircuit(feature) {
  const key = feature.properties.key;
  const selected = state.selectedCircuit === key;
  const scatterDim = (state.scatterSelection.size && els.scatterMode.value === "filter" && !state.scatterSelection.has(key)) || continuityDimmed(key, "circuit");
  return {
    color: selected ? COLORS.accent : COLORS.border,
    weight: selected ? 2.2 : 0.65,
    fillColor: mapFillColor(key, "circuit"),
    fillOpacity: scatterDim ? 0.08 : state.indicator === ADN_ID ? 0.9 : selected ? 0.75 : 0.55,
    opacity: scatterDim ? 0.25 : selected ? 0.95 : 0.8,
  };
}

function styleLocality(feature) {
  const key = feature.properties.localidad_key;
  const selected = key && state.selectedLocality === key;
  const hasData = state.indicator === ADN_ID ? isFiniteNumber(indexValue(state.adnData, "locality", key)) : feature.properties.has_electoral_data !== false;
  const scatterDim = (state.scatterSelection.size && els.scatterMode.value === "filter" && !state.scatterSelection.has(key)) || continuityDimmed(key, "locality");
  return {
    color: selected ? COLORS.accent : COLORS.border,
    weight: selected ? 2.2 : hasData ? 0.65 : 0.9,
    dashArray: hasData ? null : "4 4",
    fillColor: hasData && key ? mapFillColor(key, "locality") : "rgba(244,239,228,.28)",
    fillOpacity: scatterDim ? 0.08 : state.indicator === ADN_ID ? 0.9 : selected ? 0.75 : hasData ? 0.55 : 0.22,
    opacity: scatterDim ? 0.25 : selected ? 0.95 : hasData ? 0.8 : 0.72,
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
  for (const [control, field, key] of [[els.voteType, "available_vote_types", "voteType"], [els.positiveMeasure, "available_positive_measures", "positiveMeasure"]]) {
    const allowed = commonCapabilities(state.data, metricElectionIds(), field);
    [...control.options].forEach(option => { option.hidden = option.disabled = !allowed.includes(option.value); });
    if (!allowed.includes(state[key])) state[key] = allowed[0];
    control.value = state[key];
  }
  const list = currentMetricList();
  if (!list.some((metric) => metric.value === state.indicator)) state.indicator = list[0].value;
  els.indicator.innerHTML = list.map((metric) => `<option value="${metric.value}">${escapeHtml(metric.label)}</option>`).join("");
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
  els.openScatter.disabled = false;
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

function selectedContinuityElections() {
  return [...state.continuityElections].filter((id) => state.data.sources.some((source) => source.id === id));
}

function continuityResultMap(unit = state.mapLevel) {
  const electionIds = selectedContinuityElections();
  const signature = `${unit}|PERONISMO_K|${electionIds.join(",")}`;
  if (state.continuityCache?.signature === signature) return state.continuityCache;
  if (electionIds.length < 2) {
    state.continuityCache = { signature, rows: [], map: new Map(), insufficient: true };
    return state.continuityCache;
  }

  const keys = new Set();
  electionIds.forEach((electionId) => Object.keys(unitData(unit, electionId)).forEach((key) => keys.add(key)));
  const rows = [...keys].map((key) => {
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let missing = 0;
    electionIds.forEach((electionId) => {
      const row = unitData(unit, electionId)[key];
      if (!row || !row.positivos) {
        missing += 1;
        return;
      }
      const winnerVotes = row.ganador_votos || 0;
      const runnerVotes = row.segundo_votos || 0;
      const selectedVotes = row.bloques?.PERONISMO_K || 0;
      if (winnerVotes > 0 && winnerVotes === runnerVotes && selectedVotes === winnerVotes) {
        ties += 1;
      } else if (selectedVotes > 0 && selectedVotes === winnerVotes && winnerVotes > runnerVotes) {
        wins += 1;
      } else {
        losses += 1;
      }
    });
    let category = "alternation";
    if (missing) category = "incomplete";
    else if (ties) category = "tie";
    else if (wins === electionIds.length) category = "always_win";
    else if (losses === electionIds.length) category = "always_lose";
    const row = electionIds.map((id) => unitData(unit, id)[key]).find(Boolean);
    return {
      key,
      unit,
      category,
      wins,
      losses,
      ties,
      missing,
      valid: wins + losses,
      total: electionIds.length,
      partido_norm: row?.partido_norm || null,
    };
  });
  const map = new Map(rows.map((row) => [row.key, row]));
  state.continuityCache = { signature, rows, map, insufficient: false };
  return state.continuityCache;
}

function continuityRows(unit = state.mapLevel, applyFilter = true) {
  let rows = continuityResultMap(unit).rows;
  if (state.selectedParty && ["locality", "circuit"].includes(unit)) {
    rows = rows.filter((row) => row.partido_norm === state.selectedParty);
  }
  if (applyFilter && state.continuityCategory !== "all") {
    rows = rows.filter((row) => row.category === state.continuityCategory);
  }
  return rows;
}

function continuityResult(key, unit) {
  return continuityResultMap(unit).map.get(key) || null;
}

function continuityDimmed(key, unit) {
  if (!state.continuityActive) return false;
  const result = continuityResult(key, unit);
  return !result || (state.continuityCategory !== "all" && result.category !== state.continuityCategory);
}

function continuityColor(key, unit) {
  const result = continuityResult(key, unit);
  return CONTINUITY_CATEGORIES[result?.category]?.color || "rgba(244,239,228,.22)";
}

function renderContinuitySummary() {
  if (!els.continuitySummary) return;
  if (selectedContinuityElections().length < 2) {
    els.continuitySummary.innerHTML = '<div class="ranking-empty">Seleccione al menos dos elecciones para analizar la continuidad.</div>';
    return;
  }
  const allRows = continuityRows(state.mapLevel, false);
  const total = allRows.length;
  els.continuitySummary.innerHTML = Object.entries(CONTINUITY_CATEGORIES).map(([key, config]) => {
    const count = allRows.filter((row) => row.category === key).length;
    const share = total ? count / total : 0;
    return `<span style="--continuity-color:${config.color}"><small>${config.label}</small><strong>${formatNumber(count)}</strong><i>${formatPct(share)}</i></span>`;
  }).join("");
}

function profileButtonHtml(item) {
  const label = territoryLabel(item.key, item.unit);
  return `<button class="profile-button" type="button" data-profile-key="${escapeHtml(item.key)}" data-profile-unit="${item.unit}" aria-label="Ver perfil socioeconómico de ${escapeHtml(label)}"><span class="profile-full">Ver perfil</span><span class="profile-short">Perfil</span></button>`;
}

function renderContinuityRanking() {
  const electionCount = selectedContinuityElections().length;
  els.rankingTitle.textContent = `Continuidad · ${unitLabel(state.mapLevel, true)}`;
  els.rankingContext.textContent = `${electionCount} elecciones · Peronismo/K`;
  if (electionCount < 2) {
    els.rankingList.innerHTML = '<div class="ranking-empty">Seleccione al menos dos elecciones para analizar la continuidad.</div>';
    renderContinuitySummary();
    return;
  }
  const rows = continuityRows();
  rows.sort((a, b) => b.valid - a.valid || territoryLabel(a.key, a.unit).localeCompare(territoryLabel(b.key, b.unit), "es"));
  els.rankingList.innerHTML = rows.map((item, index) => {
    const config = CONTINUITY_CATEGORIES[item.category];
    return `
      <div class="ranking-row">
        <button class="ranking-item ${isSelected(item.key, item.unit) ? "is-active" : ""}" data-key="${item.key}" data-unit="${item.unit}">
          <span class="rank-index">${String(index + 1).padStart(2, "0")}</span>
          <span><strong>${escapeHtml(territoryLabel(item.key, item.unit))}</strong><span>${escapeHtml(config.label)} · ${item.valid}/${item.total} válidas</span></span>
          <span class="rank-value" style="color:${config.color}">${item.wins}–${item.losses}</span>
        </button>
        ${profileButtonHtml(item)}
      </div>
    `;
  }).join("");
  renderContinuitySummary();
}

function continuitySources() {
  return [...state.data.sources].sort((a, b) => {
    const yearDiff = Number(a.year || 0) - Number(b.year || 0);
    return yearDiff || a.label.localeCompare(b.label, "es");
  });
}

function renderContinuityElectionOptions() {
  const sources = continuitySources();
  const validIds = new Set(sources.map((source) => source.id));
  const previous = new Set([...state.continuityElections].filter((id) => validIds.has(id)));
  const selected = state.continuitySelectionInitialized ? previous : new Set(validIds);
  els.continuityElections.innerHTML = sources.map((source) => `
    <label class="continuity-election-option">
      <input type="checkbox" value="${escapeHtml(source.id)}" ${selected.has(source.id) ? "checked" : ""}>
      <span>${escapeHtml(source.label)}</span>
    </label>
  `).join("");
  state.continuityElections = new Set([...els.continuityElections.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value));
  updateContinuitySelectionUi();
}

function updateContinuitySelectionUi() {
  const selected = selectedContinuityElections().length;
  const total = state.data?.sources?.length || 0;
  els.continuitySelectionCount.textContent = `${selected} de ${total} elecciones seleccionadas`;
  els.continuityElectionToggle.textContent = selected ? `Elecciones seleccionadas: ${selected}` : "Seleccionar elecciones";
  els.continuityAllCheckbox.checked = total > 0 && selected === total;
  els.continuityAllCheckbox.indeterminate = selected > 0 && selected < total;
  els.continuityValidation.classList.toggle("is-hidden", selected >= 2);
  els.continuityElectionToggle.setAttribute("aria-invalid", String(selected < 2));

}

function setAllContinuityElections(selected) {
  [...els.continuityElections.querySelectorAll('input[type="checkbox"]')].forEach((input) => { input.checked = selected; });
  state.continuitySelectionInitialized = true;
  state.continuityElections = new Set([...els.continuityElections.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value));
  state.continuityCache = null;
  updateContinuitySelectionUi();
  refresh();
}

function setContinuityElectionMenu(open) {
  els.continuityElectionMenu.hidden = !open;
  els.continuityElectionToggle.setAttribute("aria-expanded", String(open));
}

function openContinuityPanel({ fromQuestion = false } = {}) {
  closeScatterPanel();
  closeTerritoryModal({ restoreFocus: false });
  setContinuityElectionMenu(false);
  state.continuityActive = true;
  state.continuityCache = null;
  state.continuityForce = "PERONISMO_K";
  els.continuityForce.value = "PERONISMO_K";
  state.continuityCategory = els.continuityCategory.value || "all";
  const unit = TERRITORY_LEVELS[els.continuityUnit.value] ? els.continuityUnit.value : state.mapLevel;
  if (!fromQuestion) {
    state.activeQuestion = null;
    state.questionUnit = null;
  }
  document.body.classList.add("is-continuity-mode");
  document.body.classList.remove("has-continuity-detail");
  els.openContinuity.classList.add("is-active");
  els.openContinuity.setAttribute("aria-pressed", "true");
  setMapLevel(unit);
  state.selectedParty = null;
  state.selectedLocality = null;
  state.selectedCircuit = null;
  state.scatterSelection.clear();
  closeCircuitDrawer();
  els.continuityControls.classList.remove("is-hidden");
  state.continuityDetailUnit = null;
  state.continuityDetailKey = null;
  els.continuityDetail.innerHTML = "";
  els.continuityDetail.classList.add("is-hidden");
  updateContinuitySelectionUi();
  refresh();
}

function closeContinuityPanel({ refreshView = true } = {}) {
  state.continuityActive = false;
  state.continuityCache = null;
  state.continuityDetailUnit = null;
  state.continuityDetailKey = null;
  document.body.classList.remove("is-continuity-mode");
  document.body.classList.remove("has-continuity-detail");
  els.openContinuity?.classList.remove("is-active");
  els.openContinuity?.setAttribute("aria-pressed", "false");
  els.continuityControls?.classList.add("is-hidden");
  els.continuityDetail?.classList.add("is-hidden");
  if (state.activeQuestion?.continuity) {
    state.activeQuestion = null;
    state.questionUnit = null;
    renderQuestions();
  }
  if (refreshView) refresh();
}

function continuityTooltipHtml(key, unit) {
  if (selectedContinuityElections().length < 2) return '<div class="tooltip-value">Seleccione al menos dos elecciones para analizar la continuidad.</div>';
  const result = continuityResult(key, unit);
  if (!result) return "";
  const config = CONTINUITY_CATEGORIES[result.category];
  return `
    <div class="tooltip-title">${escapeHtml(territoryLabel(key, unit))}</div>
    <div class="tooltip-unit">${escapeHtml(config.label)}</div>
    <div class="tooltip-value">Gana: <strong>${result.wins}</strong> · Pierde: <strong>${result.losses}</strong></div>
    <div class="tooltip-value">Observaciones válidas: <strong>${result.valid}/${result.total}</strong></div>
  `;
}

function exportContinuityCsv() {
  const elections = selectedContinuityElections();
  if (elections.length < 2) return;
  const headers = ["unidad", "territorio", "bloque", "categoria", "gana", "pierde", "empates", "faltantes", "observaciones_validas", "elecciones"];
  const rows = continuityRows().map((row) => [
    row.unit,
    territoryLabel(row.key, row.unit),
    FORCE_LABELS[state.continuityForce] || state.continuityForce,
    CONTINUITY_CATEGORIES[row.category].label,
    row.wins,
    row.losses,
    row.ties,
    row.missing,
    row.valid,
    elections.map(electionLabel).join(" | "),
  ]);
  const csv = [headers, ...rows]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `continuidad-${state.mapLevel}-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}


function renderLegend() {
  if (state.continuityActive) {
    if (selectedContinuityElections().length < 2) {
      els.legend.innerHTML = '<div class="legend-title">Continuidad · Peronismo/K</div><div class="legend-scale"><span>Seleccione al menos dos elecciones.</span></div>';
      return;
    }
    const allRows = continuityRows(state.mapLevel, false);
    els.legend.innerHTML = `
      <div class="legend-title">Continuidad · Peronismo/K</div>
      <div class="competitiveness-legend">
        ${Object.entries(CONTINUITY_CATEGORIES).map(([key, item]) => `<div><i style="background:${item.color}"></i><span>${item.label}: ${allRows.filter((row) => row.category === key).length}</span></div>`).join("")}
      </div>
    `;
    return;
  }
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
  const formatter = value => fmt(value, metricFormat());
  const domain = metricDomain();
  const values = rankedRows().map((row) => row.value).filter(isFiniteNumber);
  if (!domain && !values.length) {
    els.legend.innerHTML = `<div class="legend-title">${metricLabel()}</div><div class="legend-scale"><span>Sin territorios válidos para esta lectura</span></div>`;
    return;
  }
  const [min, max] = domain || extent(values);
  const ramp = `linear-gradient(90deg, ${state.indicator === ADN_ID ? ADN_PALETTE.join(", ") : `${COLORS.neutral}, ${metricColor()}`})`;
  els.legend.innerHTML = `<div class="legend-title">${escapeHtml(state.indicator === ADN_ID ? ADN_LEGEND_LABEL : metricLabel())}</div><div class="legend-ramp" style="background:${ramp}"></div><div class="legend-scale"><span>${formatter(min)}</span><span>${formatter(max)}</span></div>${state.indicator === ADN_ID ? '<div class="legend-scale">Índice (%) · escala provincial fija · gris: sin dato</div>' : ""}`;
}

function rankedRows(unitOverride = null) {
  const unit = unitOverride || currentUnit();
  let keys = Object.keys(state.indicator === ADN_ID ? state.adnData.territories[unit] : unitData(unit, state.targetElection));
  if (["circuit", "locality"].includes(unit) && state.selectedParty) {
    keys = keys.filter((key) => state.indicator === ADN_ID ? state.adnData.territories[unit][key].partido_id === state.selectedParty : (unitData(unit, state.targetElection)[key] || unitData(unit, state.baseElection)[key])?.partido_norm === state.selectedParty);
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
  if (state.continuityActive) {
    renderContinuityRanking();
    return;
  }
  const direction = sortDirection || (state.viewMode === "comparison" ? "abs" : "desc");
  const rows = rankedRows();
  rows.sort((a, b) => {
    if (direction === "asc") return a.value - b.value;
    if (direction === "desc") return b.value - a.value;
    return Math.abs(b.value) - Math.abs(a.value);
  });
  els.rankingTitle.textContent = `${metricLabel()} · ${unitLabel(rows[0]?.unit || currentUnit(), true)}`;
  if (els.rankingContext) {
    els.rankingContext.textContent = state.indicator === ADN_ID ? "Censo 2022 · Experimental" : state.viewMode === "comparison" ? `${electionLabel(state.baseElection)} vs ${electionLabel(state.targetElection)}` : electionLabel(state.targetElection);
  }
  els.rankingList.innerHTML = rows.map((item, index) => rankingItemHtml(item, index)).join("");
}

function rankingItemHtml(item, index) {
  if (state.indicator === "competitividad") return competitivenessRankingItemHtml(item, index);
  return `
    <div class="ranking-row">
      <button class="ranking-item ${isSelected(item.key, item.unit) ? "is-active" : ""}" data-key="${item.key}" data-unit="${item.unit}">
        <span class="rank-index">${String(index + 1).padStart(2, "0")}</span>
        <span><strong>${escapeHtml(territoryLabel(item.key, item.unit))}</strong><span>${unitLabel(item.unit, false)}</span></span>
        <span class="rank-value">${escapeHtml(fmt(item.value, metricFormat()))}</span>
      </button>
      ${profileButtonHtml(item)}
    </div>
  `;
}

function competitivenessRankingItemHtml(item, index) {
  const target = unitData(item.unit, state.targetElection)[item.key];
  const category = competitivenessCategory(target?.margen) || "Sin categoría";
  const gapVotes = competitivenessVoteGap(target);
  const change = state.viewMode === "comparison" ? `<span class="rank-meta">Cambio: ${escapeHtml(formatPp(item.value))}</span>` : "";
  return `
    <div class="ranking-row">
      <button class="ranking-item ranking-item-competitiveness ${isSelected(item.key, item.unit) ? "is-active" : ""}" data-key="${item.key}" data-unit="${item.unit}">
        <span class="rank-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="rank-main"><strong>${escapeHtml(territoryLabel(item.key, item.unit))}</strong><span class="rank-category">${escapeHtml(category)}</span></span>
        <span class="rank-competitiveness-metrics">
          <span class="rank-meta">Diferencia: ${escapeHtml(formatGapPp(target?.margen))}</span>
          <span class="rank-meta">Brecha: ${escapeHtml(formatNumber(gapVotes))} votos</span>
          ${change}
        </span>
      </button>
      ${profileButtonHtml(item)}
    </div>
  `;
}

function isSelected(key, unit) {
  if (unit === "party") return state.selectedParty === key;
  if (unit === "locality") return state.selectedLocality === key;
  return state.selectedCircuit === key;
}

function territoryLabel(key, unit) {
  const row = unitData(unit, state.targetElection)[key] || unitData(unit, state.baseElection)[key];
  if (row) {
    if (unit === "party") return row.partido;
    if (unit === "locality") return `${row.partido} · ${row.localidad}`;
    return `${row.partido} · ${row.circuito}`;
  }
  const feature = geojsonForUnit(unit)?.features.find((item) => featureKeyForUnit(item, unit) === key);
  const props = feature?.properties || {};
  if (unit === "party") return props.partido || key;
  if (unit === "locality") return props.localidad ? `${props.partido} · ${props.localidad}` : key;
  return props.circuito ? `${props.partido} · ${props.circuito}` : key;
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
  for (const field of ["electores", "votantes", "positivos", "blanco", "nulo", "impugnado", "recurrido"]) {
    if (rows.some(row => !isFiniteNumber(row?.[field]))) out[field] = null;
  }
  out.total_publicado = rows.length && rows.every(row => isFiniteNumber(row.total_publicado)) ? rows.reduce((sum, row) => sum + row.total_publicado, 0) : null;
  out.participacion = out.electores && isFiniteNumber(out.votantes) ? out.votantes / out.electores : null;
  out.ausentismo = isFiniteNumber(out.participacion) ? 1 - out.participacion : null;
  out.pct_blanco = out.votantes ? out.blanco / out.votantes : null;
  out.pct_blanco_total_publicado = out.total_publicado ? out.blanco / out.total_publicado : null;
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
  if (state.selectedLocality) return [unitData("locality", electionId)[state.selectedLocality]].filter(Boolean);
  if (state.selectedParty) {
    if (validTerritorialLevel("circuit") === "party") return [unitData("party", electionId)[state.selectedParty]].filter(Boolean);
    const scopedUnit = unit === "locality" ? "locality" : "circuit";
    return Object.values(unitData(scopedUnit, electionId)).filter((row) => row.partido_norm === state.selectedParty);
  }
  return Object.values(unitData(unit, electionId));
}

function renderKpis() {
  if (state.continuityActive) {
    renderContinuityKpis();
    return;
  }
  const baseRows = currentScopeRows("party", state.baseElection);
  const targetRows = currentScopeRows("party", state.targetElection);
  if ((state.selectedLocality || state.selectedCircuit) && !baseRows.length && !targetRows.length) {
    els.kpiStrip.innerHTML = [
      kpi("Electores", "s/d", "Sin resultados electorales asignados"),
      kpi("Votantes", "s/d", "Sin resultados electorales asignados"),
      kpi("Competitividad", "s/d", "Sin resultados electorales asignados"),
    ].join("");
    els.totalVoteStack.innerHTML = "";
    els.totalVoteLegend.innerHTML = "<div><span>Sin datos electorales para esta unidad.</span></div>";
    els.voteStack.innerHTML = "";
    els.voteStackLegend.innerHTML = "<div><span>Sin datos electorales para esta unidad.</span></div>";
    return;
  }
  const base = aggregateRows(baseRows);
  const target = aggregateRows(targetRows);
  els.kpiStrip.innerHTML = [
    kpi("Electores", formatNumber(target.electores), electionLabel(state.targetElection)),
    voterKpi(target),
    competitivenessBlock(base, target),
  ].join("");
  renderTotalVoteStack(target);
  renderVoteStack(target);
}

function kpi(label, value, note = "") {
  return `<div class="kpi-item"><span>${label}</span><strong>${value}</strong><i>${note || "&nbsp;"}</i></div>`;
}

function voterKpi(row) {
  return isFiniteNumber(row.total_publicado) && !isFiniteNumber(row.votantes)
    ? kpi("Total publicado", formatNumber(row.total_publicado), "Positivos + blancos; no equivale a sufragantes")
    : kpi("Votantes", formatNumber(row.votantes), `${formatPct(row.participacion)} de participacion`);
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
    return `<span style="width:${pct * 100}%;background:${forceStackColor(name, index, STACK_FALLBACK_COLORS)}" title="${name}: ${formatPct(pct)} (${formatNumber(votes)})"></span>`;
  }).join("");
  targetEls.voteStackLegend.innerHTML = stackEntries.map(([name, votes], index) => {
    const pct = row.positivos ? votes / row.positivos : 0;
    return `<div><i style="background:${forceStackColor(name, index, STACK_FALLBACK_COLORS)}"></i><span>${name}</span><b>${formatPct(pct)} (${formatNumber(votes)})</b></div>`;
  }).join("");
}

function renderTotalVoteStack(row, targetEls = els) {
  if (!targetEls.totalVoteStack || !targetEls.totalVoteLegend) return;
  const title = targetEls.totalVoteStack.closest(".total-vote-card")?.querySelector(".section-title");
  if (title) title.textContent = isFiniteNumber(row.votantes) ? "Composicion del voto total" : "Composicion del total publicado";
  const total = row.votantes || TOTAL_VOTE_SEGMENTS.reduce((sum, segment) => sum + (row[segment.key] || 0), 0);
  const entries = TOTAL_VOTE_SEGMENTS.filter(segment => isFiniteNumber(row[segment.key])).map((segment) => ({
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
  `).join("") + (!isFiniteNumber(row.votantes) ? '<p class="published-total-note">Positivos + blancos. Otros tipos no publicados.</p>' : "");
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
  if (["FUERZA PATRIA", "UNION POR LA PATRIA", "FRENTE DE TODOS", "FRENTE JUSTICIALISTA"].some((label) => normalized.includes(label))) return COLORS.peronismo;
  if (normalized.includes("JUNTOS") || normalized.includes("CAMBIEMOS")) return "#e7b84d";
  if (normalized.includes("FRENTE DE IZQUIERDA") || normalized.includes("FIT")) return "#d34a45";
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
  const unit = state.selectedCircuit ? "circuit" : state.selectedLocality ? "locality" : state.selectedParty ? "party" : "province";
  const selectedKey = unit === "circuit"
    ? state.selectedCircuit
    : unit === "locality"
      ? state.selectedLocality
      : state.selectedParty;
  const base = unit === "province"
    ? aggregateRows(Object.values(unitData("party", state.baseElection)))
    : unitData(unit, state.baseElection)[selectedKey];
  const target = unit === "province"
    ? aggregateRows(Object.values(unitData("party", state.targetElection)))
    : unitData(unit, state.targetElection)[selectedKey];
  const label = unit === "province" ? "Provincia de Buenos Aires" : territoryLabel(selectedKey, unit);
  els.panelKicker.textContent = unit === "province" ? "Vista provincial" : `${unitLabel(unit, false)[0].toUpperCase()}${unitLabel(unit, false).slice(1)} seleccionada`;
  els.panelTitle.textContent = label;
  els.panelLead.textContent = `${electionLabel(state.baseElection)} vs ${electionLabel(state.targetElection)}.`;
  if (unit !== "province" && !base && !target) {
    els.panelLead.textContent = "Sin resultados electorales asignados a esta unidad.";
    els.metricsGrid.innerHTML = [
      metricBlock("Participacion", "s/d"),
      metricBlock("Ausentismo", "s/d"),
      metricBlock("LLA", "s/d"),
      metricBlock("Peronismo/K", "s/d"),
    ].join("");
    setBar(els.margin2023, els.margin2023Label, null);
    setBar(els.margin2025, els.margin2025Label, null);
    els.quickReading.textContent = "La geometría y el perfil socioeconómico permanecen disponibles. Los votos de circuitos compartidos se contabilizan una sola vez en su localidad principal.";
    return;
  }
  els.metricsGrid.innerHTML = [
    metricBlock("Participacion", formatPct(target?.participacion), formatPp(difference(target?.participacion, base?.participacion))),
    metricBlock("Ausentismo", formatPct(target?.ausentismo), formatPp(difference(target?.ausentismo, base?.ausentismo))),
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
  if (state.indicator === ADN_ID) return ADN_DESCRIPTION;
  if (state.activeQuestion) return assistantNarrative(state.activeQuestion);
  const turnout = difference(target?.participacion, base?.participacion);
  const force = (target?.bloques_pct?.[state.force] ?? 0) - (base?.bloques_pct?.[state.force] ?? 0);
  return `Cambio de participacion: ${formatPp(turnout)}. Cambio de ${state.force}: ${formatPp(force)}.`;
}

function renderQuestions() {
  const groups = QUESTIONS.reduce((acc, question) => {
    acc[question.group] = acc[question.group] || [];
    acc[question.group].push(question);
    return acc;
  }, {});
  els.questionList.innerHTML = Object.entries(groups)
    .sort(([groupA], [groupB]) => QUESTION_GROUP_ORDER.indexOf(groupA) - QUESTION_GROUP_ORDER.indexOf(groupB))
    .map(([group, questions]) => `
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
  if (question.continuity) {
    const rows = continuityRows(effectiveUnit, false);
    const counts = Object.fromEntries(Object.keys(CONTINUITY_CATEGORIES).map((key) => [key, rows.filter((row) => row.category === key).length]));
    return `Comparo ${selectedContinuityElections().length} elecciones para ${unitLabel(effectiveUnit, true)}. Siempre gana: ${counts.always_win}; siempre pierde: ${counts.always_lose}; alternancia: ${counts.alternation}; empates: ${counts.tie}; datos incompletos: ${counts.incomplete}. Los faltantes no se consideran derrotas.`;
  }
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
  return scatterMetric(value)?.label || value;
}

function refresh() {
  syncElectionCapabilities();
  updateMetricOptions();
  els.metricDefinition.textContent = metricDefinition();
  updateContinuitySelectionUi();
  updateMainMapUnit();
  updateMapLevelButtons();
  state.partyLayer?.setStyle(styleParty);
  state.scatterMainLayer?.setStyle(state.detailLayerUnit === "locality" ? styleLocality : styleCircuit);
  state.circuitLayer?.setStyle((feature) => styleCircuitForDrawer(feature, state.drawerContext));
  updateMapTooltips();
  renderHighlightPins();
  renderKpis();
  renderPanel();
  renderRanking(state.activeQuestion?.sort);
  renderLegend();
  renderAssistantResponse();
  renderContinuityDetail();
  if (!els.scatterPanel.classList.contains("is-hidden")) renderScatter();
  if (!els.territoryModal.hidden) renderActiveTerritoryModal();
}

function updateMapTooltips() {
  state.partyLayer?.eachLayer((layer) => {
    if (layer.feature) layer.setTooltipContent(mapTooltipHtml(layer.feature, "party"));
  });
  state.scatterMainLayer?.eachLayer((layer) => {
    if (layer.feature) layer.setTooltipContent(mapTooltipHtml(layer.feature, state.detailLayerUnit || "circuit"));
  });
  state.circuitLayer?.eachLayer((layer) => {
    if (layer.feature) layer.setTooltipContent(drawerTooltipHtml(layer.feature, state.drawerContext));
  });
}

function updateMainMapUnit() {
  if (!state.map || !state.partyLayer) return;
  const detailUnit = state.mapLevel === "party" ? null : state.mapLevel;
  if (detailUnit) {
    if (state.map.hasLayer(state.partyLayer)) state.map.removeLayer(state.partyLayer);
    if (state.scatterMainLayer && state.detailLayerUnit !== detailUnit) {
      if (state.map.hasLayer(state.scatterMainLayer)) state.map.removeLayer(state.scatterMainLayer);
      state.scatterMainLayer = null;
    }
    if (!state.scatterMainLayer) {
      const styleFn = detailUnit === "locality" ? styleLocality : styleCircuit;
      state.detailLayerUnit = detailUnit;
      state.scatterMainLayer = L.geoJSON(geojsonForUnit(detailUnit), {
        style: styleFn,
        bubblingMouseEvents: false,
        onEachFeature(feature, layer) {
          layer.bindTooltip(mapTooltipHtml(feature, detailUnit), { className: "map-tooltip", sticky: true });
          bindPolygonHover(layer, styleFn);
          layer.on("click", (event) => {
            if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
            const key = featureKeyForUnit(feature, detailUnit);
            if (!key) return;
            detailUnit === "locality" ? selectLocality(key) : selectCircuit(key);
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
  if (!TERRITORY_LEVELS[level]) return;
  level = validTerritorialLevel(level);
  if (state.continuityActive && els.continuityUnit) els.continuityUnit.value = level;
  const changed = state.mapLevel !== level;
  if (changed) {
    state.continuityDetailUnit = null;
    state.continuityDetailKey = null;
  }
  state.mapLevel = level;
  if (changed) {
    state.selectedLocality = null;
    state.selectedCircuit = null;
    if (level !== "circuit") state.selectedParty = null;
    state.scatterSelection.clear();
    closeCircuitDrawer();
    els.mapSearchInput.value = "";
    els.mapSearchResults.classList.add("is-hidden");
  }
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
  els.mapLevelLocality?.classList.toggle("is-active", state.mapLevel === "locality");
  els.mapLevelCircuit?.classList.toggle("is-active", state.mapLevel === "circuit");
  els.mapLevelParty?.setAttribute("aria-pressed", String(state.mapLevel === "party"));
  els.mapLevelLocality?.setAttribute("aria-pressed", String(state.mapLevel === "locality"));
  els.mapLevelCircuit?.setAttribute("aria-pressed", String(state.mapLevel === "circuit"));
  const singular = unitLabel(state.mapLevel, false);
  els.mapSearchInput.placeholder = `Buscar ${singular}`;
}

function renderHighlightPins() {
  if (!state.map) return;
  if (!state.highlightPinLayer) state.highlightPinLayer = L.layerGroup().addTo(state.map);
  state.highlightPinLayer.clearLayers();
  if (!state.activeQuestion || state.activeQuestion.mapMode === "winner" || state.activeQuestion.continuity) return;
  const unit = state.questionUnit || effectiveQuestionUnit(state.activeQuestion);
  if (!Object.keys(TERRITORY_LEVELS).includes(unit)) return;
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
  const bounds = featureBounds(unit, key);
  const center = bounds?.isValid?.() ? bounds.getCenter() : null;
  if (center) cache.set(key, center);
  return center;
}

function layerForUnit(unit) {
  return unit === "party" ? state.partyLayer : state.scatterMainLayer;
}

function geojsonForUnit(unit) {
  if (unit === "party") return state.partyGeojson;
  if (unit === "locality") return state.localityGeojson;
  return state.circuitGeojson;
}

function featureBounds(unit, key) {
  const property = TERRITORY_LEVELS[unit]?.featureKey || "key";
  const bounds = L.latLngBounds([]);
  layerForUnit(unit)?.eachLayer((layer) => {
    if (layer.feature?.properties?.[property] === key && layer.getBounds?.()?.isValid()) bounds.extend(layer.getBounds());
  });
  if (!bounds.isValid()) {
    geojsonForUnit(unit)?.features
      .filter((feature) => feature.properties?.[property] === key)
      .forEach((feature) => bounds.extend(L.geoJSON(feature).getBounds()));
  }
  return bounds.isValid() ? bounds : null;
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
  if (state.selectedLocality) return featureBounds("locality", state.selectedLocality);
  if (state.selectedParty) return featureBounds("party", state.selectedParty);
  return geojsonBounds(state.mapLevel) || geojsonBounds("party");
}

function fitMainMapToCurrentState({ animate = false } = {}) {
  if (!state.map) return;
  const bounds = currentMapBounds();
  if (bounds?.isValid?.()) {
    state.map.fitBounds(bounds, { padding: [28, 28], maxZoom: state.selectedCircuit ? 11 : state.selectedLocality ? 10 : state.selectedParty ? 9 : 7, animate });
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
  if (state.continuityActive) {
    if (state.continuityDetailUnit === "party" && state.continuityDetailKey === key) {
      clearMapSelection();
      return;
    }
    state.selectedParty = key;
    state.selectedLocality = null;
    state.selectedCircuit = null;
    closeCircuitDrawer();
    state.continuityDetailUnit = "party";
    state.continuityDetailKey = key;
    refresh();
    pulse(state.partyLayer, key, "key");
    return;
  }
  const drawerHidden = els.circuitDrawer.classList.contains("is-hidden");
  const drawerMatches = state.drawerContext?.unit === "party" && state.drawerContext?.key === key;
  if (state.selectedParty === key && !state.selectedCircuit && ((!drawerHidden && drawerMatches) || validTerritorialLevel("circuit") === "party")) {
    clearMapSelection();
    return;
  }
  state.selectedParty = key;
  state.selectedLocality = null;
  state.selectedCircuit = null;
  openCircuitDrawer("party", key);
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
  const unit = state.mapLevel;
  const matches = (geojsonForUnit(unit)?.features || [])
    .map((feature) => ({ feature, key: featureKeyForUnit(feature, unit) }))
    .filter((item) => item.key && normLabel(territoryLabel(item.key, unit)).includes(term))
    .sort((a, b) => territoryLabel(a.key, unit).localeCompare(territoryLabel(b.key, unit), "es"))
    .slice(0, 8);
  els.mapSearchResults.innerHTML = matches.length
    ? matches.map((item) => `<button type="button" data-key="${item.key}" data-unit="${unit}">${escapeHtml(territoryLabel(item.key, unit))}</button>`).join("")
    : `<button type="button" disabled>Sin coincidencias</button>`;
  els.mapSearchResults.classList.remove("is-hidden");
}

function focusUnitOnMap(unit, key) {
  if (validTerritorialLevel(unit) !== unit) return;
  const nextLevel = TERRITORY_LEVELS[unit] ? unit : "party";
  state.mapLevel = nextLevel;
  if (state.activeQuestion?.unit === "current") state.questionUnit = nextLevel;
  updateMainMapUnit();
  updateMapLevelButtons();
  const bounds = featureBounds(nextLevel, key);
  if (bounds?.isValid?.()) state.map.fitBounds(bounds, { padding: [28, 28], maxZoom: nextLevel === "circuit" ? 11 : nextLevel === "locality" ? 10 : 9 });
  if (nextLevel === "party") {
    if (state.continuityActive) {
      selectParty(key);
      return;
    }
    state.selectedParty = key;
    state.selectedLocality = null;
    state.selectedCircuit = null;
    closeCircuitDrawer();
    refresh();
    pulse(state.partyLayer, key, "key");
    return;
  }
  if (nextLevel === "locality") {
    selectLocality(key);
    return;
  }
  const row = unitData("circuit", state.targetElection)[key] || unitData("circuit", state.baseElection)[key];
  state.selectedCircuit = key;
  state.selectedLocality = null;
  state.selectedParty = row?.partido_norm || null;
  closeCircuitDrawer();
  refresh();
  pulse(state.scatterMainLayer, key, "key");
}

function selectLocality(key) {
  if (validTerritorialLevel("locality") !== "locality") return;
  if (state.continuityActive && state.continuityDetailUnit === "locality" && state.continuityDetailKey === key) {
    clearMapSelection();
    return;
  }
  const drawerHidden = els.circuitDrawer.classList.contains("is-hidden");
  const drawerMatches = state.drawerContext?.unit === "locality" && state.drawerContext?.key === key;
  if (!state.continuityActive && state.selectedLocality === key && !drawerHidden && drawerMatches) {
    clearMapSelection();
    return;
  }
  state.mapLevel = "locality";
  state.selectedLocality = key;
  state.selectedCircuit = null;
  const row = unitData("locality", state.targetElection)[key] || unitData("locality", state.baseElection)[key];
  const feature = state.localityGeojson?.features.find((item) => item.properties.localidad_key === key);
  state.selectedParty = row?.partido_norm || feature?.properties?.partido_norm || null;
  if (state.continuityActive) {
    state.continuityDetailUnit = "locality";
    state.continuityDetailKey = key;
    closeCircuitDrawer();
  } else {
    openCircuitDrawer("locality", key);
  }
  refresh();
  pulse(state.scatterMainLayer, key, "localidad_key");
}

function selectCircuit(key) {
  if (validTerritorialLevel("circuit") !== "circuit") return;
  if (state.continuityActive && state.continuityDetailUnit === "circuit" && state.continuityDetailKey === key) {
    clearMapSelection();
    return;
  }
  if (!state.continuityActive && state.selectedCircuit === key) {
    clearMapSelection();
    return;
  }
  state.selectedCircuit = key;
  state.selectedLocality = null;
  const row = unitData("circuit", state.targetElection)[key] || unitData("circuit", state.baseElection)[key];
  state.selectedParty = row?.partido_norm || state.selectedParty;
  closeCircuitDrawer();
  if (state.continuityActive) {
    state.continuityDetailUnit = "circuit";
    state.continuityDetailKey = key;
  }
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

function closeCircuitDrawer() {
  els.circuitDrawer.classList.add("is-hidden");
  state.drawerContext = null;
}

function circuitRelations(feature) {
  return Array.isArray(feature?.properties?.localidad_relaciones) ? feature.properties.localidad_relaciones : [];
}

function drawerFeatures(context) {
  if (!context) return [];
  if (context.unit === "party") {
    return state.circuitGeojson.features.filter((feature) => feature.properties.partido_norm === context.key);
  }
  return state.circuitGeojson.features.filter((feature) =>
    circuitRelations(feature).some((relation) => relation.clc === context.key)
  );
}

function drawerRelation(feature, context) {
  if (context?.unit !== "locality") return null;
  return circuitRelations(feature).find((relation) => relation.clc === context.key) || null;
}

function styleCircuitForDrawer(feature, context = state.drawerContext) {
  const base = styleCircuit(feature);
  const relation = drawerRelation(feature, context);
  if (!relation || relation.rol === "principal") return { ...base, dashArray: null };
  return {
    ...base,
    color: state.selectedCircuit === feature.properties.key ? COLORS.accent : "#a16535",
    dashArray: "6 5",
    fillOpacity: Math.min(base.fillOpacity, 0.32),
  };
}

function drawerTooltipHtml(feature, context = state.drawerContext) {
  const relation = drawerRelation(feature, context);
  const relationLine = relation
    ? `<div class="tooltip-value">Relación con la localidad: <strong>${relation.rol === "principal" ? "principal" : "compartida / secundaria"}</strong>${isFiniteNumber(relation.population_share) ? ` · ${formatPct(relation.population_share)} de la población urbana del circuito` : ""}</div>`
    : "";
  return `${mapTooltipHtml(feature, "circuit")}${relationLine}`;
}

function updateDrawerNote(context, features) {
  if (!context || context.unit !== "locality") {
    els.drawerNote.textContent = "";
    els.drawerNote.classList.add("is-hidden");
    return;
  }
  const locality = state.localityGeojson.features.find((feature) => feature.properties.localidad_key === context.key);
  const props = locality?.properties || {};
  const hasSecondary = features.some((feature) => drawerRelation(feature, context)?.rol === "secundaria");
  let note = "";
  if (!features.length) {
    note = "No se registran circuitos electorales relacionados con esta localidad.";
  } else if (props.primary_circuit_count === 0) {
    note = "Esta localidad no tiene circuito electoral principal. Se muestran sus circuitos compartidos; los resultados fueron asignados a la localidad principal de cada circuito para evitar duplicación de votos.";
  } else if (hasSecondary) {
    note = "Los circuitos con trazo discontinuo están compartidos con esta localidad; sus votos se contabilizan una sola vez en la localidad principal.";
  }
  els.drawerNote.textContent = note;
  els.drawerNote.classList.toggle("is-hidden", !note);
}

function openCircuitDrawer(unit, key) {
  if (state.continuityActive || validTerritorialLevel("circuit") !== "circuit") {
    closeCircuitDrawer();
    return;
  }
  const context = { unit, key };
  state.drawerContext = context;
  els.circuitDrawer.classList.remove("is-hidden");
  els.drawerKicker.textContent = unit === "locality" ? "Circuitos relacionados" : "Detalle municipal";
  els.drawerTitle.textContent = territoryLabel(key, unit);
  const features = drawerFeatures(context);
  updateDrawerNote(context, features);
  els.pinDrawer.disabled = !features.length;
  setTimeout(() => {
    if (state.drawerContext?.unit !== unit || state.drawerContext?.key !== key) return;
    if (!state.circuitMap) {
      state.circuitMap = L.map("circuitMap", { zoomControl: false, preferCanvas: true });
      L.control.zoom({ position: "bottomright" }).addTo(state.circuitMap);
      addBaseLayer(state.circuitMap);
    }
    renderCircuitMap(context);
  }, 50);
}

function renderCircuitMap(context = state.drawerContext) {
  if (!context) return;
  state.circuitLayer?.remove();
  const features = drawerFeatures(context);
  state.circuitLayer = L.geoJSON({ type: "FeatureCollection", features }, {
    style: (feature) => styleCircuitForDrawer(feature, context),
    bubblingMouseEvents: false,
    onEachFeature(feature, layer) {
      layer.bindTooltip(drawerTooltipHtml(feature, context), { className: "map-tooltip", sticky: true });
      bindPolygonHover(layer, (item) => styleCircuitForDrawer(item, context));
      layer.on({
        click: (event) => {
          if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
          selectCircuit(feature.properties.key);
        },
      });
    },
  }).addTo(state.circuitMap);
  const syncViewport = () => {
    if (
      state.drawerContext?.unit !== context.unit
      || state.drawerContext?.key !== context.key
      || els.circuitDrawer.classList.contains("is-hidden")
    ) return;
    state.circuitMap.invalidateSize({ pan: false });
    const bounds = state.circuitLayer.getBounds();
    if (bounds.isValid()) {
      state.circuitMap.fitBounds(bounds, { padding: [18, 18], maxZoom: 12, animate: false });
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(syncViewport));
  setTimeout(syncViewport, 160);
}

function resetView() {
  resetAnalyticState();
  requestAnimationFrame(() => fitMainMapToCurrentState());
}

function resetAnalyticState({ hideAssistant = false } = {}) {
  state.activeQuestion = null;
  state.questionUnit = null;
  state.continuityActive = false;
  state.continuityCache = null;
  state.continuityDetailUnit = null;
  state.continuityDetailKey = null;
  els.continuityControls?.classList.add("is-hidden");
  els.continuityDetail?.classList.add("is-hidden");
  setContinuityElectionMenu(false);
  state.selectedParty = null;
  state.selectedLocality = null;
  state.selectedCircuit = null;
  state.scatterSelection.clear();
  state.continuityDetailUnit = null;
  state.continuityDetailKey = null;
  state.viewMode = "target";
  state.indicator = "participacion";
  state.voteType = "positivo";
  state.positiveMeasure = "share_positive";
  state.force = "LLA";
  state.mapLevel = "party";
  document.body.classList.remove("is-scatter-page", "is-continuity-mode", "has-continuity-detail");
  els.openContinuity?.classList.remove("is-active");
  els.openContinuity?.setAttribute("aria-pressed", "false");
  closeTerritoryModal({ restoreFocus: false });
  els.scatterPanel.classList.add("is-hidden");
  closeCircuitDrawer();
  if (hideAssistant) {
    document.body.classList.remove("is-questions-open");
    els.questionWindow.classList.add("is-hidden");
  }
  updateElectionSelectors();
  renderContinuityElectionOptions();
  updateMetricOptions();
  renderQuestions();
  refresh();
  requestAnimationFrame(() => state.map?.invalidateSize());
}

function clearMapSelection() {
  if (!state.selectedParty && !state.selectedLocality && !state.selectedCircuit && !state.scatterSelection.size && !state.continuityDetailKey) return;
  state.selectedParty = null;
  state.selectedLocality = null;
  state.selectedCircuit = null;
  state.scatterSelection.clear();
  state.continuityDetailUnit = null;
  state.continuityDetailKey = null;
  closeCircuitDrawer();
  refresh();
}

function clearMapSelectionFromBackground(event) {
  if (simulatorAtlasView) return;
  if (event.originalEvent?.target?.closest?.(".leaflet-interactive")) return;
  clearMapSelection();
}

function exportFilteredCsv() {
  if (state.continuityActive) {
    exportContinuityCsv();
    return;
  }
  const rows = rankedRows();
  const headers = ["unidad", "territorio", "eleccion_base", "eleccion_comparada", "metrica", "valor"];
  const csvRows = rows.map((row) => [
    row.unit,
    territoryLabel(row.key, row.unit),
    state.indicator === ADN_ID ? "" : electionLabel(state.baseElection),
    state.indicator === ADN_ID ? "Censo 2022" : electionLabel(state.targetElection),
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
    if (el.offsetWidth > 0 && el.offsetHeight > 0) return true;
    await waitForNextFrame();
    await delay(50);
  }
  return false;
}

function reportTitle() {
  if (state.activeQuestion) return state.activeQuestion.label;
  return `${metricLabel()} en ${unitLabel(state.mapLevel, true)}`;
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
  return state.mapLevel;
}

function reportMapBounds(unit) {
  if (state.selectedCircuit) return featureBounds("circuit", state.selectedCircuit);
  if (state.selectedLocality) return featureBounds("locality", state.selectedLocality);
  if (state.selectedParty) return featureBounds("party", state.selectedParty);
  return geojsonBounds(unit) || geojsonBounds("party");
}

function selectedReportKey(unit) {
  if (unit === "circuit") return state.selectedCircuit;
  if (unit === "locality") return state.selectedLocality;
  return state.selectedParty;
}

function addReportPins(map) {
  if (!state.activeQuestion || state.activeQuestion.mapMode === "winner" || state.activeQuestion.continuity) return null;
  const unit = state.questionUnit || effectiveQuestionUnit(state.activeQuestion);
  if (!Object.keys(TERRITORY_LEVELS).includes(unit)) return null;
  const layer = L.layerGroup().addTo(map);
  sortedRowsForQuestion({ ...state.activeQuestion, unit }).slice(0, 20).forEach((row, index) => {
    const feature = geojsonForUnit(unit)?.features.find((item) => featureKeyForUnit(item, unit) === row.key);
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
  if (featureKeyForUnit(feature, unit) !== selectedKey) return;
  layer.bindTooltip(mapTooltipHtml(feature, unit), {
    className: "map-tooltip",
    direction: "top",
    permanent: true,
    sticky: false,
  });
}

function addReportSelectionCallout(map, layerUnit) {
  const unit = state.selectedCircuit ? "circuit" : state.selectedLocality ? "locality" : state.selectedParty ? "party" : null;
  const key = unit === "circuit" ? state.selectedCircuit : unit === "locality" ? state.selectedLocality : state.selectedParty;
  if (!unit || !key || unit === layerUnit) return null;
  const feature = geojsonForUnit(unit)?.features.find((item) => featureKeyForUnit(item, unit) === key);
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
  state.reportLayer = L.geoJSON(geojsonForUnit(unit), {
    style: unit === "party" ? styleParty : unit === "locality" ? styleLocality : styleCircuit,
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
    voterKpi(target),
    kpi("Participacion", formatPct(target.participacion), `Ausentismo: ${formatPct(target.ausentismo)}`),
    competitivenessBlock(base, target),
  ].join("");
  const ranking = rows.map((item, index) => `
    <div class="ranking-item">
      <span class="rank-index">${String(index + 1).padStart(2, "0")}</span>
      <span><strong>${escapeHtml(territoryLabel(item.key, item.unit))}</strong><span>${unitLabel(item.unit, false)}</span></span>
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
          <span><strong>Nivel territorial activo:</strong> ${escapeHtml(unitLabel(state.mapLevel, false))}</span>
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
          <span><strong>Fuente:</strong> ${escapeHtml(state.indicator === ADN_ID ? ADN_DESCRIPTION : state.data.sources.find(s => s.id === state.targetElection)?.source_name || "Datos electorales normalizados del tablero.")}</span>
          ${document.getElementById("electionCoverageNote").hidden ? "" : `<span>${escapeHtml(document.getElementById("electionCoverageNote").textContent)}</span>`}
          <span><strong>Filtros activos:</strong> ${escapeHtml(metricLabel())}${state.selectedParty ? `; partido ${escapeHtml(territoryLabel(state.selectedParty, "party"))}` : ""}${state.selectedCircuit ? `; circuito ${escapeHtml(territoryLabel(state.selectedCircuit, "circuit"))}` : ""}</span>
          <span><strong>Nivel territorial:</strong> ${escapeHtml(unitLabel(state.mapLevel, false))}</span>
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

function territoryRow(unit, key) {
  for (const source of state.data.sources) {
    const row = unitData(unit, source.id)[key];
    if (row) return row;
  }
  return null;
}

function territoryPartyLabel(unit, key) {
  if (unit === "party") return null;
  const partyKey = territoryRow(unit, key)?.partido_norm;
  return partyKey ? territoryLabel(partyKey, "party") : null;
}

function truncateLabel(value, max = 68) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function fallbackSocioCategory(variable) {
  const source = variable.nombre_corto || variable.descripcion || "Indicador";
  const pieces = source.split(":").map((piece) => piece.trim()).filter(Boolean);
  return truncateLabel(pieces.at(-1) || source, 54);
}

function presentSocioVariable(variable) {
  const family = SOCIO_FAMILY_BY_CODE.get(variable.id) || {
    id: variable.id,
    dimension: "privacion",
    label: truncateLabel(variable.nombre_corto || "Indicador", 54),
    codes: [variable.id],
  };
  const category = family.categories?.[variable.id] || fallbackSocioCategory(variable);
  const dimensionLabel = SOCIO_DIMENSIONS[family.dimension] || variable.grupo_tematico || "Otros indicadores";
  const familyLabel = family.label || truncateLabel(variable.nombre_corto || variable.id, 54);
  const shortBase = family.shortLabel || familyLabel;
  const shortName = family.shortName || (family.codes.length > 1 ? `${shortBase} · ${category}` : category === familyLabel ? familyLabel : `${shortBase} · ${category}`);
  return {
    ...variable,
    dimension: family.dimension,
    dimension_label: dimensionLabel,
    variable_id: family.id,
    variable_full_name: variable.nombre_corto || familyLabel,
    display_name: familyLabel,
    short_name: truncateLabel(shortName, 72),
    category_name: category,
    family,
  };
}

function profileVariablesForUnit(unit) {
  const methods = new Set(["ratio_de_sumas", "suma", "promedio_ponderado", "precalculado"]);
  return (state.socioData?.metadata?.variables || [])
    .filter((variable) => variable.agregable_en?.includes(unit) && methods.has(variable.metodo_agregacion))
    .map(presentSocioVariable)
    .sort((a, b) => a.dimension_label.localeCompare(b.dimension_label, "es") || a.short_name.localeCompare(b.short_name, "es"));
}

function profileFormattedValue(variable, value) {
  if (!isFiniteNumber(value)) return "No disponible";
  if (variable.formato === "index") return formatIndex(value);
  if (variable.unidad === "proporción") return formatPct(value, 1);
  return formatNumber(value);
}

function profileFamiliesForUnit(unit) {
  const variables = profileVariablesForUnit(unit);
  return SOCIO_FAMILIES.map((family) => {
    const members = family.codes.map((code) => variables.find((variable) => variable.id === code)).filter(Boolean);
    return members.length ? { ...family, variables: members } : null;
  }).filter(Boolean);
}

function socioeconomicCountUnit(variable) {
  const universe = (variable?.universo || "").toLocaleLowerCase("es");
  if (universe.includes("hogar")) return "hogares";
  if (universe.includes("vivienda")) return "viviendas";
  return "personas";
}

function profileFamilyEntries(family, territory) {
  const values = territory?.values || {};
  const counts = territory?.counts || {};
  const universes = territory?.universes || {};
  const entries = family.variables.map((variable) => ({
    variable,
    label: variable.category_name,
    value: values[variable.id],
    count: counts[variable.id],
    universe: universes[variable.id],
  })).filter((entry) => isFiniteNumber(entry.value));
  return family.sortDescending
    ? entries.sort((a, b) => (b.count ?? b.value) - (a.count ?? a.value))
    : entries;
}

function profileEntrySecondary(entry) {
  if (!isFiniteNumber(entry.count) || entry.variable.unidad !== "proporción") return "";
  return `${formatNumber(entry.count)} ${socioeconomicCountUnit(entry.variable)}`;
}

function profileEntryTooltip(entry) {
  const primary = profileFormattedValue(entry.variable, entry.value);
  const secondary = profileEntrySecondary(entry);
  return [entry.label, primary, secondary].filter(Boolean).join("\n");
}

function profileFamilyChart(family, territory, { compact = false } = {}) {
  const entries = profileFamilyEntries(family, territory);
  if (family.id === ADN_ID) {
    const value = territory?.values?.[ADN_ID];
    return `<p class="profile-index-value">${formatIndex(value)}</p><p class="profile-chart-note">${escapeHtml(ADN_DESCRIPTION)}${!isFiniteNumber(value) ? " Sin dato para este territorio; no se imputa cero." : ""}</p>`;
  }
  if (!entries.length) return '<p class="profile-missing">No hay información disponible para este territorio.</p>';
  const coverageNote = family.id === "educational_climate"
    ? "Universo: hogares con clima educativo clasificable. Los casos “No corresponde” quedan fuera de esta distribución y se conservan en el control de datos."
    : "";

  if (PROFILE_STACK_FAMILIES.has(family.id)) {
    return `
      <div class="profile-stack" role="img" aria-label="${escapeHtml(family.label)}: ${entries.map((entry) => `${entry.label} ${formatPct(entry.value)}`).join(", ")}">
        ${entries.map((entry, index) => `<span style="width:${Math.max(0, entry.value * 100)}%;--profile-color:${STACK_FALLBACK_COLORS[index % STACK_FALLBACK_COLORS.length]}" title="${escapeHtml(profileEntryTooltip(entry))}"></span>`).join("")}
      </div>
      <div class="profile-stack-legend">${entries.map((entry, index) => `<span title="${escapeHtml(profileEntryTooltip(entry))}"><i style="background:${STACK_FALLBACK_COLORS[index % STACK_FALLBACK_COLORS.length]}"></i><span>${escapeHtml(entry.label)}</span><strong>${formatPct(entry.value)}</strong>${profileEntrySecondary(entry) ? `<small>${escapeHtml(profileEntrySecondary(entry))}</small>` : ""}</span>`).join("")}</div>
      ${coverageNote ? `<p class="profile-chart-note">${escapeHtml(coverageNote)}</p>` : ""}
    `;
  }

  const scaleValues = entries.map((entry) => isFiniteNumber(entry.count) ? entry.count : entry.value);
  const max = Math.max(...scaleValues, 1);
  return `
    <div class="profile-bars ${compact ? "is-compact" : ""}" role="img" aria-label="${escapeHtml(family.label)}: ${entries.map((entry) => `${entry.label} ${profileFormattedValue(entry.variable, entry.value)}`).join(", ")}">
      ${entries.map((entry, index) => {
        const scaleValue = isFiniteNumber(entry.count) ? entry.count : entry.value;
        const width = scaleValue > 0 ? Math.max(1.5, Math.min(100, scaleValue / max * 100)) : 0;
        const secondary = profileEntrySecondary(entry);
        const color = STACK_FALLBACK_COLORS[index % STACK_FALLBACK_COLORS.length];
        return `<div class="profile-bar-row" title="${escapeHtml(profileEntryTooltip(entry))}"><span class="profile-bar-label" style="--profile-color:${color}">${escapeHtml(entry.label)}</span><div><i style="width:${width}%;--profile-color:${color}"></i></div><span class="profile-bar-value"><strong style="--profile-color:${color}">${escapeHtml(profileFormattedValue(entry.variable, entry.value))}</strong>${secondary ? `<small>${escapeHtml(secondary)}</small>` : ""}</span></div>`;
      }).join("")}
    </div>
    ${coverageNote ? `<p class="profile-chart-note">${escapeHtml(coverageNote)}</p>` : ""}
  `;
}

function profilePanel(familyId, families, territory, title = null) {
  const family = families.find((item) => item.id === familyId);
  if (!family) return "";
  return `<section class="profile-chart-card profile-panel-${escapeHtml(family.id)}"><h3>${escapeHtml(title || family.label)}</h3>${profileFamilyChart(family, territory, { compact: family.id !== "population_age" })}</section>`;
}

function profileReading(territory, families) {
  const values = territory?.values || {};
  const sentences = [];
  if (isFiniteNumber(values.poblacion_total)) sentences.push(`El territorio cuenta con ${formatNumber(values.poblacion_total)} habitantes.`);
  const age = families.find((family) => family.id === "population_age");
  const ageEntries = age ? profileFamilyEntries(age, territory) : [];
  if (ageEntries.length) {
    const largest = ageEntries.slice().sort((a, b) => b.value - a.value)[0];
    sentences.push(`El grupo de ${largest.label} representa la mayor proporción de la población (${formatPct(largest.value)}).`);
  }
  const unemployment = isFiniteNumber(values.condac_2P)
    ? `La desocupación alcanza ${formatPct(values.condac_2P)}`
    : "";
  const noHealthCoverage = isFiniteNumber(values.p19_3P)
    ? `${formatPct(values.p19_3P)} de la población no tiene cobertura de salud`
    : "";
  if (unemployment && noHealthCoverage) sentences.push(`${unemployment}, mientras que ${noHealthCoverage}.`);
  else if (unemployment) sentences.push(`${unemployment}.`);
  else if (noHealthCoverage) sentences.push(`El ${noHealthCoverage}.`);
  if (isFiniteNumber(values.nbi_tot_1P)) sentences.push(`${formatPct(values.nbi_tot_1P)} de los hogares presenta NBI por vivienda inconveniente.`);
  return sentences.slice(0, 4).join(" ") || "No hay información suficiente para construir una lectura territorial.";
}

function profileKpi(variable, territory, label, note) {
  const values = territory?.values || {};
  const value = variable ? values[variable.id] : null;
  const count = variable ? territory?.counts?.[variable.id] : null;
  const countNote = variable?.unidad === "proporción" && isFiniteNumber(count)
    ? `${formatNumber(count)} ${socioeconomicCountUnit(variable)} · ${note}`
    : note;
  return `<div class="profile-kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(variable ? profileFormattedValue(variable, value) : "No disponible")}</strong><small>${escapeHtml(countNote)}</small></div>`;
}

function renderSocioProfile(key, unit) {
  const territory = state.socioData?.territories?.[unit]?.[key];
  const variables = profileVariablesForUnit(unit);
  const families = profileFamiliesForUnit(unit);
  const values = territory?.values || {};
  const dimensions = [...new Set(families.map((family) => family.dimension))];
  if (!dimensions.includes(state.profileDimension)) state.profileDimension = dimensions[0] || null;
  const dimensionFamilies = families.filter((family) => family.dimension === state.profileDimension);
  if (!dimensionFamilies.some((family) => family.id === state.profileFamily)) state.profileFamily = dimensionFamilies[0]?.id || null;
  const selectedFamily = families.find((family) => family.id === state.profileFamily) || null;
  const party = territoryPartyLabel(unit, key);
  const byId = new Map(variables.map((variable) => [variable.id, variable]));
  const [population, unemployment, nbi, health] = PROFILE_MAIN_INDICATORS.map((id) => byId.get(id));
  els.territoryModalKicker.textContent = `Perfil socioeconómico · ${unitLabel(unit, false)}`;
  els.territoryModalTitle.textContent = territoryLabel(key, unit);
  els.territoryModalContent.innerHTML = `
    <article class="profile-sheet">
      <div class="profile-header-meta">
        ${party ? `<span>Partido: <strong>${escapeHtml(party)}</strong></span>` : ""}
        <span>Datos: <strong>${territory ? "Censo 2022" : "sin información"}</strong></span>
        <span>Radios agregados: <strong>${territory?.radio_count ?? "s/d"}</strong></span>
      </div>
      <section class="profile-kpis" aria-label="Indicadores principales">
        ${profileKpi(population, territory, "Población", "Personas")}
        ${profileKpi(unemployment, territory, "Desocupación", "Población en edad de trabajar")}
        ${profileKpi(nbi, territory, "Vivienda inconveniente", "Necesidades Básicas Insatisfechas")}
        ${profileKpi(health, territory, "Sin cobertura de salud", "Población")}
        <div class="profile-kpi profile-kpi-adn"><span>${escapeHtml(ADN_NAME)}</span><strong>${formatIndex(values[ADN_ID])}</strong><small>${escapeHtml(ADN_LEGEND_LABEL)}</small></div>
      </section>
      <div class="profile-chart-grid">
        <div class="profile-chart-group">
          ${profilePanel("population_age", families, territory)}
        </div>
        <div class="profile-chart-group">
          ${profilePanel("activity", families, territory)}
          ${profilePanel("pension", families, territory, "Protección social")}
        </div>
        <div class="profile-chart-group">
          ${profilePanel("educational_climate", families, territory)}
          ${profilePanel("digital_access", families, territory)}
        </div>
        <div class="profile-chart-group">
          ${profilePanel("occupational_category", families, territory)}
        </div>
        <div class="profile-chart-group">
          ${profilePanel("nbi_housing", families, territory)}
        </div>
        <div class="profile-chart-group">
          ${profilePanel("health_coverage", families, territory)}
        </div>
      </div>
      <section class="profile-reading"><span>Lectura</span><p>${escapeHtml(profileReading(territory, families))}</p></section>
      <section class="profile-explorer">
        <div class="profile-explorer-head"><span>Explorar otros indicadores</span><p>Seleccione una dimensión y una variable conceptual.</p></div>
        <div class="profile-explorer-controls">
          <label for="profileDimensionSelect">Dimensión<select id="profileDimensionSelect">${dimensions.map((dimension) => `<option value="${dimension}" ${dimension === state.profileDimension ? "selected" : ""}>${escapeHtml(SOCIO_DIMENSIONS[dimension] || dimension)}</option>`).join("")}</select></label>
          <label for="profileFamilySelect">Indicador<select id="profileFamilySelect">${dimensionFamilies.map((family) => `<option value="${family.id}" ${family.id === state.profileFamily ? "selected" : ""}>${escapeHtml(family.label)}</option>`).join("")}</select></label>
        </div>
        <section class="profile-explorer-chart" aria-live="polite">
          ${selectedFamily ? `<h3>${escapeHtml(selectedFamily.label)}</h3>${profileFamilyChart(selectedFamily, territory)}` : '<p class="profile-missing">No hay indicadores compatibles con esta dimensión.</p>'}
        </section>
        ${selectedFamily ? `<div class="profile-source"><strong>Censo 2022 · ${escapeHtml(selectedFamily.variables[0]?.universo || "Universo no especificado")}</strong><span>${escapeHtml(selectedFamily.variables[0]?.fuente || "INDEC")}</span><details><summary>Ver definición completa</summary>${selectedFamily.variables.map((variable) => `<p><strong>${escapeHtml(variable.category_name)}</strong>: ${escapeHtml(variable.descripcion || "Sin descripción disponible.")}</p>`).join("")}</details></div>` : ""}
      </section>
      ${territory ? "" : '<p class="profile-missing">No hay información disponible para este territorio.</p>'}
    </article>
  `;
}

function continuityForceDetails(key, unit) {
  return selectedContinuityElections().map((electionId) => {
    const row = unitData(unit, electionId)[key];
    if (!row || !row.positivos) return { electionId, missing: true, forces: [], coverage: null };
    const forces = Object.entries(row.fuerzas || {})
      .filter(([, votes]) => isFiniteNumber(votes) && votes > 0)
      .map(([name, votes]) => ({ name, votes, share: votes / row.positivos }))
      .sort((a, b) => b.votes - a.votes);
    const coverage = forces.reduce((sum, force) => sum + force.votes, 0) / row.positivos;
    return { electionId, missing: false, positives: row.positivos, forces, coverage, winner: row.ganador || forces[0]?.name || "Sin definición" };
  });
}

function renderContinuityDetail() {
  if (!els.continuityDetail) return;
  const key = state.continuityDetailKey;
  const unit = state.continuityDetailUnit;
  const result = state.continuityActive && key && unit && selectedContinuityElections().length >= 2
    ? continuityResult(key, unit)
    : null;
  document.body.classList.toggle("has-continuity-detail", Boolean(result));
  els.continuityDetail.classList.toggle("is-hidden", !result);
  if (!result) {
    els.continuityDetail.innerHTML = "";
    return;
  }
  const category = CONTINUITY_CATEGORIES[result.category];
  const details = continuityForceDetails(key, unit);
  els.continuityDetail.innerHTML = `
    <header class="continuity-detail-head">
      <div><span>Detalle territorial</span><h2>${escapeHtml(territoryLabel(key, unit))}</h2><p>${escapeHtml(unitLabel(unit, false))} · <strong style="color:${category.color}">${escapeHtml(category.label)}</strong></p></div>
      <div class="continuity-detail-copy"><strong>Resultados por elección</strong><p>Distribución del voto positivo por fuerza en las elecciones seleccionadas.</p><small>La clasificación se determina según si el peronismo resulta ganador en cada elección.</small></div>
    </header>
    <div class="continuity-force-chart">
      ${details.map((detail) => {
        if (detail.missing) return `<section class="continuity-force-row is-missing"><h3>${escapeHtml(electionLabel(detail.electionId))}</h3><p>Sin datos para este territorio.</p></section>`;
        const aria = `${electionLabel(detail.electionId)}: ${detail.forces.map((force) => `${force.name} ${formatPct(force.share)}`).join(", ")}`;
        const coverageWarning = Math.abs(detail.coverage - 1) > 0.001 ? `<small class="continuity-coverage-warning">Las fuerzas suman ${formatPct(detail.coverage)} de los votos positivos.</small>` : "";
        return `
          <section class="continuity-force-row">
            <div class="continuity-election-label"><h3>${escapeHtml(electionLabel(detail.electionId))}</h3><span>Ganó ${escapeHtml(detail.winner)}</span></div>
            <div>
              <div class="continuity-force-stack" role="img" aria-label="${escapeHtml(aria)}">
                ${detail.forces.map((force) => `<span style="width:${Math.max(0, force.share * 100)}%;background:${forceMapColor(force.name)}" title="${escapeHtml(force.name)} · ${formatPct(force.share)} · ${formatNumber(force.votes)} votos">${force.share >= 0.12 ? `<b>${escapeHtml(truncateLabel(force.name, 20))} ${formatPct(force.share, 0)}</b>` : ""}</span>`).join("")}
              </div>
              <div class="continuity-force-values">${detail.forces.slice(0, 6).map((force) => `<span><i style="background:${forceMapColor(force.name)}"></i>${escapeHtml(truncateLabel(force.name, 24))} <strong>${formatPct(force.share)}</strong></span>`).join("")}</div>
              ${coverageWarning}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderContinuityKpis() {
  const count = selectedContinuityElections().length;
  if (count < 2) {
    els.kpiStrip.innerHTML = kpi("Continuidad", "Sin cálculo", "Seleccione al menos dos elecciones");
    els.totalVoteStack.innerHTML = "";
    els.totalVoteLegend.innerHTML = "";
    els.voteStack.innerHTML = "";
    els.voteStackLegend.innerHTML = "";
    return;
  }
  const rows = continuityRows(state.mapLevel, false);
  const counts = Object.fromEntries(Object.keys(CONTINUITY_CATEGORIES).map((category) => [category, rows.filter((row) => row.category === category).length]));
  els.kpiStrip.innerHTML = [
    kpi("Elecciones", formatNumber(count), "seleccionadas"),
    kpi("Siempre gana", formatNumber(counts.always_win), formatPct(rows.length ? counts.always_win / rows.length : 0)),
    kpi("Alternancia", formatNumber(counts.alternation), formatPct(rows.length ? counts.alternation / rows.length : 0)),
  ].join("");
}

function openTerritoryModal(mode, key, unit, trigger = null) {
  closeCircuitDrawer();
  state.territoryModalMode = mode;
  state.territoryModalKey = key;
  state.territoryModalUnit = unit;
  state.territoryModalTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  els.territoryModal.classList.toggle("is-profile", mode === "profile");
  if (mode === "profile") {
    state.profileIndicator = null;
    state.profileDimension = null;
    state.profileFamily = null;
  }
  els.territoryModal.hidden = false;
  renderActiveTerritoryModal();
  requestAnimationFrame(() => els.territoryModalPanel.focus());
}

function openSocioProfile(key, unit, trigger = null) {
  openTerritoryModal("profile", key, unit, trigger);
}

function renderActiveTerritoryModal() {
  if (els.territoryModal.hidden || !state.territoryModalMode) return;
  renderSocioProfile(state.territoryModalKey, state.territoryModalUnit);
}

function closeTerritoryModal({ restoreFocus = true } = {}) {
  if (!els.territoryModal || els.territoryModal.hidden) return;
  const trigger = state.territoryModalTrigger;
  els.territoryModal.hidden = true;
  els.territoryModal.classList.remove("is-profile");
  state.territoryModalMode = null;
  state.territoryModalKey = null;
  state.territoryModalUnit = null;
  state.territoryModalTrigger = null;
  state.profileIndicator = null;
  state.profileDimension = null;
  state.profileFamily = null;
  if (restoreFocus && trigger?.isConnected) trigger.focus();
}

function openScatterPanel({ reset = true } = {}) {
  closeTerritoryModal({ restoreFocus: false });
  closeContinuityPanel({ refreshView: false });
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
  return state.mapLevel;
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
  els.scatterElection.value = state.targetElection;
  els.scatterForce.value = "PERONISMO_K";
  els.scatterMode.value = "highlight";
  renderQuestions();
}

function applyQuestion(question) {
  if (!questionSupported(question)) return;
  const effectiveUnit = effectiveQuestionUnit(question);
  state.activeQuestion = question;
  if (question.continuity) {
    state.questionUnit = effectiveUnit;
    els.continuityUnit.value = effectiveUnit;
    els.continuityForce.value = "PERONISMO_K";
    state.continuityForce = "PERONISMO_K";
    openContinuityPanel({ fromQuestion: true });
    renderQuestions();
    showQuestions(true);
    return;
  }
  closeContinuityPanel({ refreshView: false });
  state.questionUnit = effectiveUnit;
  state.mapLevel = TERRITORY_LEVELS[effectiveUnit] ? effectiveUnit : "party";
  state.selectedParty = null;
  state.selectedLocality = null;
  state.selectedCircuit = null;
  state.scatterSelection.clear();
  closeCircuitDrawer();
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
    els.scatterElection.value = question.scatter.election || state.targetElection;
    els.scatterForce.value = question.scatter.force || question.force || "PERONISMO_K";
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

function scatterVariableMetadata() {
  return (state.socioData?.metadata?.variables || []).map(presentSocioVariable);
}

function scatterSocioeconomicLabel(variable) {
  return variable.unidad === "proporción" ? `${variable.short_name} (%)` : variable.short_name;
}

function scatterMetric(value) {
  const fixed = [...SCATTER_METRICS, ...SCATTER_ELECTORAL_METRICS].find((metric) => metric.value === value);
  if (value === "electoral:blanco" && state.data.sources.find(s => s.id === els.scatterElection.value)?.vote_share_basis === "valid_published") {
    return { ...fixed, label: "Blancos sobre total publicado", definition: "Blancos / (positivos + blancos); otros tipos no publicados." };
  }
  if (fixed) return fixed;
  if (!value?.startsWith("socio:")) return null;
  const variableId = value.slice(6);
  const variable = scatterVariableMetadata().find((item) => item.id === variableId);
  if (!variable) return null;
  return {
    value,
    label: scatterSocioeconomicLabel(variable),
    format: variable.formato || (variable.unidad === "proporción" ? "pct" : "number"),
    definition: variable.descripcion,
    year: variable.anio,
    universe: variable.universo,
    source: variable.fuente,
    includeZero: false,
  };
}

function compareScatterSocioeconomicVariables(a, b) {
  const climateFamily = "educational_climate";
  if (a.family?.id === climateFamily && b.family?.id === climateFamily) {
    return a.family.codes.indexOf(a.id) - b.family.codes.indexOf(b.id);
  }
  return a.short_name.localeCompare(b.short_name, "es");
}

function setupScatterOptions() {
  const changes = SCATTER_METRICS.map((metric) => `<option value="${metric.value}">${escapeHtml(metric.label)}</option>`).join("");
  const electoral = SCATTER_ELECTORAL_METRICS.map((metric) => `<option value="${metric.value}">${escapeHtml(metric.label)}</option>`).join("");
  const byGroup = scatterVariableMetadata().reduce((groups, variable) => {
    const group = variable.dimension_label || "Otros indicadores";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(variable);
    return groups;
  }, new Map());
  const socioeconomic = [...byGroup.entries()].map(([group, variables]) => `
    <optgroup label="Censo 2022 · ${escapeHtml(group)}">
      ${variables.sort(compareScatterSocioeconomicVariables).map((variable) => `<option value="socio:${escapeHtml(variable.id)}" title="${escapeHtml(variable.descripcion || variable.short_name)}">${escapeHtml(scatterSocioeconomicLabel(variable))}</option>`).join("")}
    </optgroup>
  `).join("");
  const options = `
    <optgroup label="Cambios entre elecciones">${changes}</optgroup>
    <optgroup label="Métricas electorales">${electoral}</optgroup>
    ${socioeconomic}
  `;
  els.scatterX.innerHTML = options;
  els.scatterY.innerHTML = options;
  els.scatterX.value = "peronismo_delta";
  els.scatterY.value = "margen_delta";
  els.scatterElection.innerHTML = state.data.sources
    .map((source) => `<option value="${source.id}">${escapeHtml(source.label)}</option>`)
    .join("");
  els.scatterElection.value = state.targetElection;
  els.scatterForce.value = "PERONISMO_K";
}

function scatterValue(row, metric) {
  if (metric.startsWith("socio:")) {
    const variableId = metric.slice(6);
    return state.socioData?.territories?.[row.unit]?.[row.key]?.values?.[variableId] ?? null;
  }
  if (metric.startsWith("electoral:")) {
    const current = row.current;
    const values = {
      "electoral:participacion": current?.participacion,
      "electoral:ausentismo": current?.ausentismo,
      "electoral:competitividad": current?.margen,
      "electoral:fuerza": current?.bloques_pct?.[els.scatterForce.value],
      "electoral:blanco": current?.pct_blanco ?? current?.pct_blanco_total_publicado,
      "electoral:nulo": current?.pct_nulo,
    };
    return values[metric];
  }
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

function scatterPoints() {
  const unit = TERRITORY_LEVELS[els.scatterUnit.value] ? els.scatterUnit.value : "party";
  const electionId = state.data.sources.some((source) => source.id === els.scatterElection.value)
    ? els.scatterElection.value
    : state.targetElection;
  let keys = Object.keys(unitData(unit, electionId));
  if (["circuit", "locality"].includes(unit) && state.selectedParty) {
    keys = keys.filter((key) => unitData(unit, electionId)[key]?.partido_norm === state.selectedParty);
  }
  const xMetric = scatterMetric(els.scatterX.value) || scatterMetric("peronismo_delta");
  const yMetric = scatterMetric(els.scatterY.value) || scatterMetric("margen_delta");
  els.scatterX.value = xMetric.value;
  els.scatterY.value = yMetric.value;
  const points = keys.map((key) => {
    const row = {
      key,
      unit,
      base: unitData(unit, state.baseElection)[key],
      target: unitData(unit, state.targetElection)[key],
      current: unitData(unit, electionId)[key],
    };
    return { ...row, x: scatterValue(row, xMetric.value), y: scatterValue(row, yMetric.value) };
  }).filter((point) => isFiniteNumber(point.x) && isFiniteNumber(point.y));
  return { points, xMetric, yMetric, unit, electionId };
}

function renderScatter() {
  const result = scatterPoints();
  renderScatterMetadata(result);
  renderScatterTable(result);
  drawScatter(result.points, result.xMetric, result.yMetric);
}

function renderScatterMetadata({ xMetric, yMetric, electionId }) {
  const describe = (metric) => {
    if (metric.value.startsWith("socio:")) {
      return `${metric.label}: ${metric.definition || "indicador censal"} · ${metric.year || 2022} · Universo: ${metric.universe || "s/d"}`;
    }
    if (metric.value.startsWith("electoral:")) return `${metric.label}: ${electionLabel(electionId)}`;
    return `${metric.label}: diferencia entre ${electionLabel(state.baseElection)} y ${electionLabel(state.targetElection)}`;
  };
  els.scatterMeta.textContent = `${describe(xMetric)}. ${describe(yMetric)}.`;
}

function renderScatterTable({ points, xMetric, yMetric }) {
  const selected = state.scatterSelection.size
    ? points.filter((point) => state.scatterSelection.has(point.key))
    : points;
  const visible = selected.slice().sort((a, b) => Math.abs(b.y) - Math.abs(a.y)).slice(0, 12);
  if (!visible.length) {
    els.scatterTable.innerHTML = "";
    return;
  }
  els.scatterTable.innerHTML = `
    <table>
      <thead><tr><th>Territorio</th><th>${escapeHtml(xMetric.label)}</th><th>${escapeHtml(yMetric.label)}</th><th>Perfil</th></tr></thead>
      <tbody>${visible.map((point) => `
        <tr>
          <td>${escapeHtml(territoryLabel(point.key, point.unit))}</td>
          <td>${escapeHtml(fmt(point.x, xMetric.format))}</td>
          <td>${escapeHtml(fmt(point.y, yMetric.format))}</td>
          <td><button class="scatter-profile-button" type="button" data-profile-key="${escapeHtml(point.key)}" data-profile-unit="${point.unit}" aria-label="Ver perfil socioeconómico de ${escapeHtml(territoryLabel(point.key, point.unit))}">Perfil</button></td>
        </tr>
      `).join("")}</tbody>
    </table>
  `;
}

function exportScatterCsv() {
  const { points, xMetric, yMetric, unit, electionId } = scatterPoints();
  const headers = ["unidad", "territorio", "eleccion_referencia", "metrica_x", "valor_x", "metrica_y", "valor_y", "seleccionado"];
  const rows = points.map((point) => [
    unit,
    territoryLabel(point.key, unit),
    electionLabel(electionId),
    xMetric.label,
    point.x,
    yMetric.label,
    point.y,
    state.scatterSelection.has(point.key) ? "si" : "no",
  ]);
  const csv = [headers, ...rows]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cruce-socioelectoral-${unit}-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
  if (points.length < 3) {
    els.scatterStats.textContent = "No hay al menos tres observaciones completas para este cruce.";
    return;
  }
  const xExtent = xMetric.includeZero === false ? extent(points.map((point) => point.x)) : extentWithZero(points.map((point) => point.x));
  const yExtent = yMetric.includeZero === false ? extent(points.map((point) => point.y)) : extentWithZero(points.map((point) => point.y));
  if (!validExtent(xExtent) || !validExtent(yExtent)) {
    els.scatterStats.textContent = "No hay variación suficiente para calcular el cruce.";
    return;
  }
  const x = (value) => margin.left + ((value - xExtent[0]) / (xExtent[1] - xExtent[0] || 1)) * (width - margin.left - margin.right);
  const y = (value) => height - margin.bottom - ((value - yExtent[0]) / (yExtent[1] - yExtent[0] || 1)) * (height - margin.top - margin.bottom);
  addSvg(svg, "rect", { x: margin.left, y: margin.top, width: width - margin.left - margin.right, height: height - margin.top - margin.bottom, class: "plot-bg" });
  addSvg(svg, "line", { x1: margin.left, x2: width - margin.right, y1: height - margin.bottom, y2: height - margin.bottom, class: "axis-line" });
  addSvg(svg, "line", { x1: margin.left, x2: margin.left, y1: margin.top, y2: height - margin.bottom, class: "axis-line" });
  if (xExtent[0] <= 0 && xExtent[1] >= 0) addSvg(svg, "line", { x1: x(0), x2: x(0), y1: margin.top, y2: height - margin.bottom, class: "reference-line" });
  if (yExtent[0] <= 0 && yExtent[1] >= 0) addSvg(svg, "line", { x1: margin.left, x2: width - margin.right, y1: y(0), y2: y(0), class: "reference-line" });
  addScatterAxisLabels(svg, xExtent, yExtent, x, y, xMetric, yMetric, width, height, margin);
  const fit = trend(points);
  if (fit) addSvg(svg, "line", { x1: x(xExtent[0]), y1: y(fit.slope * xExtent[0] + fit.intercept), x2: x(xExtent[1]), y2: y(fit.slope * xExtent[1] + fit.intercept), class: "trend-line" });
  const plotted = points.map((point) => ({ ...point, cx: x(point.x), cy: y(point.y) }));
  plotted.forEach((point) => {
    const circle = addSvg(svg, "circle", { cx: point.cx, cy: point.cy, r: state.scatterSelection.has(point.key) ? 6 : 4, class: `scatter-point ${state.scatterSelection.has(point.key) ? "is-selected" : ""}` });
    circle.addEventListener("click", () => {
      state.scatterSelection = new Set([point.key]);
      point.unit === "party" ? selectParty(point.key) : point.unit === "locality" ? selectLocality(point.key) : selectCircuit(point.key);
    });
    addSvg(circle, "title", {}).textContent = `${territoryLabel(point.key, point.unit)}\n${xMetric.label}: ${fmt(point.x, xMetric.format)}\n${yMetric.label}: ${fmt(point.y, yMetric.format)}`;
  });
  addText(svg, xMetric.label, width / 2, height - 6, "axis-title middle");
  addText(svg, yMetric.label, 10, 14, "axis-title");
  els.scatterStats.innerHTML = `<strong>r de Pearson: ${fit ? fit.r.toFixed(3) : "s/d"}</strong><span>R²: ${fit ? fit.r2.toFixed(3) : "s/d"}</span><span>N completo: ${points.length}</span><span>Se excluyen casos sin datos; no implica causalidad.</span>`;
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
  if (metric?.format === "index") return formatIndex(value);
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
  if (points.length < 3) return null;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const sxx = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  const syy = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
  if (!sxx || !syy) return null;
  const sxy = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const r = sxy / Math.sqrt(sxx * syy);
  return { slope, intercept, r, r2: r ** 2 };
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

function pinCurrentDrawerMap() {
  const context = state.drawerContext ? { ...state.drawerContext } : null;
  const features = drawerFeatures(context);
  if (!context || !features.length || state.pinnedCircuitMaps.length >= 4) return;
  const id = `pinned-${Date.now()}`;
  const panel = document.createElement("section");
  panel.className = "pinned-circuit-map";
  panel.innerHTML = `
    <div class="drawer-head">
      <div><span>${context.unit === "locality" ? "Circuitos de localidad" : "Circuitos de partido"}</span><strong>${escapeHtml(territoryLabel(context.key, context.unit))}</strong></div>
      <div class="drawer-actions"><button type="button" data-close>Cerrar</button></div>
    </div>
    <div class="pinned-map-canvas" id="${id}"></div>
  `;
  document.body.appendChild(panel);
  panel.style.left = `${Math.min(window.innerWidth - 440, 320 + state.pinnedCircuitMaps.length * 28)}px`;
  panel.style.top = `${90 + state.pinnedCircuitMaps.length * 28}px`;
  makeDraggable(panel, ".drawer-head");

  const map = L.map(id, { zoomControl: false, preferCanvas: true });
  L.control.zoom({ position: "bottomright" }).addTo(map);
  addBaseLayer(map);
  const layer = L.geoJSON(
    { type: "FeatureCollection", features },
    {
      style: (feature) => styleCircuitForDrawer(feature, context),
      onEachFeature(feature, polygon) {
        polygon.bindTooltip(drawerTooltipHtml(feature, context), { className: "map-tooltip", sticky: true });
      },
    },
  ).addTo(map);
  const item = { context, panel, map };
  panel.querySelector("[data-close]").addEventListener("click", () => {
    item.map.remove();
    panel.remove();
    state.pinnedCircuitMaps = state.pinnedCircuitMaps.filter((entry) => entry !== item);
  });
  setTimeout(() => {
    map.invalidateSize();
    if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [16, 16], maxZoom: 12 });
  }, 80);
  state.pinnedCircuitMaps.push(item);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar ${url}: HTTP ${response.status}`);
  return response.json();
}

async function init() {
  const version = "atlas-adn-20261002-1";
  const [data, socioData, partyGeojson, localityGeojson, circuitGeojson, adnData] = await Promise.all([
    fetchJson(`data/electoral_data.json?v=${version}`),
    fetchJson(`data/socioeconomic_data.json?v=${version}`),
    fetchJson(`data/partidos_pba.geojson?v=${version}`),
    fetchJson(`data/localidades_pba_mas2000.geojson?v=${version}`),
    fetchJson(`data/circuitos_pba.geojson?v=${version}`),
    fetchJson(`data/adn.json?v=${version}`),
  ]);
  state.data = data;
  state.adnData = adnData;
  document.getElementById('methodologyIndexName').textContent = ADN_NAME;
  state.socioData = attachIndex(socioData, adnData);
  state.partyGeojson = partyGeojson;
  state.localityGeojson = localityGeojson;
  state.circuitGeojson = circuitGeojson;
  state.baseElection = data.defaults.base;
  state.targetElection = data.defaults.target;
  setupSimulator({ data, aggregateRows, formatNumber, formatPct, formatPp, kpi, escapeHtml,
    indexAppearance: {name:ADN_NAME, legendLabel:ADN_LEGEND_LABEL, palette:ADN_PALETTE, domain:adnData.metadata.display_domain, format:formatIndex,
      value:(key,unit='party')=>indexValue(adnData,unit,key), color:(key,unit='party')=>indexColor(indexValue(adnData,unit,key),adnData.metadata.display_domain)},
    enterTerritoryView: enterSimulatorAtlasView,
    updateTerritoryView: updateSimulatorAtlasView,
    leaveTerritoryView: leaveSimulatorAtlasView,
    showTerritoryMap: fitSimulatorSelection,
  });

  updateElectionSelectors();
  renderContinuityElectionOptions();
  updateMetricOptions();
  renderQuestions();
  setupScatterOptions();
  initDrag();
  setupPanelResize({onResize:()=>state.map?.invalidateSize({pan:false})});

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
els.indicator.addEventListener("change", () => {
  state.indicator = els.indicator.value;
  if (state.indicator === ADN_ID) {
    state.activeQuestion = null;
    state.questionUnit = null;
    closeContinuityPanel({ refreshView: false });
  }
  updateMetricOptions(); refresh();
});
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
els.mapLevelLocality.addEventListener("click", () => setMapLevel("locality"));
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
  focusUnitOnMap(item.dataset.unit || state.mapLevel, item.dataset.key);
  els.mapSearchInput.value = item.textContent;
  els.mapSearchResults.classList.add("is-hidden");
});
els.openQuestions.addEventListener("click", () => showQuestions(true));
els.openContinuity.addEventListener("click", () => openContinuityPanel());
els.closeContinuity.addEventListener("click", () => closeContinuityPanel());
els.continuityUnit.addEventListener("change", () => {
  state.continuityCache = null;
  setMapLevel(els.continuityUnit.value);
});
els.continuityElectionToggle.addEventListener("click", () => setContinuityElectionMenu(els.continuityElectionMenu.hidden));
els.continuityElections.addEventListener("change", (event) => {
  if (!event.target.matches('input[type="checkbox"]')) return;
  state.continuitySelectionInitialized = true;
  state.continuityElections = new Set([...els.continuityElections.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value));
  state.continuityCache = null;
  updateContinuitySelectionUi();
  refresh();
});
els.continuityElectionMenu.addEventListener("keydown", (event) => {
  const input = event.target.closest('input[type="checkbox"]');
  if (!input || ![" ", "Spacebar", "Enter"].includes(event.key)) return;
  event.preventDefault();
  input.checked = !input.checked;
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
els.continuityAllCheckbox.addEventListener("change", () => setAllContinuityElections(els.continuityAllCheckbox.checked));
els.continuitySelectAll.addEventListener("click", () => setAllContinuityElections(true));
els.continuityClearAll.addEventListener("click", () => setAllContinuityElections(false));
els.continuityForce.addEventListener("change", () => {
  state.continuityForce = els.continuityForce.value;
  state.continuityCache = null;
  refresh();
});
els.continuityCategory.addEventListener("change", () => {
  state.continuityCategory = els.continuityCategory.value;
  refresh();
});

els.openScatter.addEventListener("click", () => openScatterPanel());
els.closeScatter.addEventListener("click", closeScatterPanel);
els.clearScatterSelection.addEventListener("click", () => { state.scatterSelection.clear(); refresh(); });
els.scatterUnit.addEventListener("change", () => {
  state.scatterSelection.clear();
  setMapLevel(TERRITORY_LEVELS[els.scatterUnit.value] ? els.scatterUnit.value : "party");
});
[els.scatterX, els.scatterY, els.scatterElection, els.scatterForce, els.scatterMode].forEach((el) => el.addEventListener("change", () => { state.scatterSelection.clear(); refresh(); }));
els.exportScatter.addEventListener("click", exportScatterCsv);
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
  const profile = event.target.closest("[data-profile-key]");
  if (profile) {
    openSocioProfile(profile.dataset.profileKey, profile.dataset.profileUnit, profile);
    return;
  }
  const item = event.target.closest(".ranking-item");
  if (!item) return;
  item.dataset.unit === "party" ? selectParty(item.dataset.key) : item.dataset.unit === "locality" ? selectLocality(item.dataset.key) : selectCircuit(item.dataset.key);
});
els.scatterTable.addEventListener("click", (event) => {
  const profile = event.target.closest("[data-profile-key]");
  if (profile) openSocioProfile(profile.dataset.profileKey, profile.dataset.profileUnit, profile);
});
els.closeTerritoryModal.addEventListener("click", () => closeTerritoryModal());
els.territoryModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-territory-close]")) closeTerritoryModal();
});
els.territoryModalContent.addEventListener("change", (event) => {
  if (event.target.id === "profileDimensionSelect") {
    state.profileDimension = event.target.value;
    state.profileFamily = null;
    renderSocioProfile(state.territoryModalKey, state.territoryModalUnit);
  }
  if (event.target.id === "profileFamilySelect") {
    state.profileFamily = event.target.value;
    renderSocioProfile(state.territoryModalKey, state.territoryModalUnit);
  }
});
els.closeDrawer.addEventListener("click", closeCircuitDrawer);
els.pinDrawer.addEventListener("click", pinCurrentDrawerMap);
els.exportReport.addEventListener("click", exportReport);
els.exportData.addEventListener("click", exportFilteredCsv);
window.addEventListener("afterprint", () => {
  els.reportRoot.classList.remove("is-rendering");
  els.reportRoot.setAttribute("aria-hidden", "true");
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.territoryModal.hidden) closeTerritoryModal();
  if (event.key === "Escape" && !els.continuityElectionMenu.hidden) {
    setContinuityElectionMenu(false);
    els.continuityElectionToggle.focus();
  }
  if (event.key === "Escape" && !els.methodologyModal.hidden) closeMethodology();
  if (event.key === "Escape") closeCompetitivenessInfo();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".continuity-election-picker")) setContinuityElectionMenu(false);
});
window.addEventListener("resize", () => { state.map?.invalidateSize(); state.circuitMap?.invalidateSize(); state.pinnedCircuitMaps.forEach((item) => item.map.invalidateSize()); if (!els.scatterPanel.classList.contains("is-hidden")) renderScatter(); });

init().catch((error) => {
  console.error(error);
  els.loading.textContent = "No se pudo cargar el visor. Revisa la consola.";
});
