/* =========================================================
   Paisajes Resilientes y Biodiversidad — Subcuenca del río Quiscab
   y Corredor Biocultural Zunil–Atitlán–Balam Juyu' (Acatenango)

   Mapa interactivo — lógica de la aplicación
   ========================================================= */

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */
function esc(v){
  if(v===null||v===undefined) return '';
  return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtNum(v, opts){
  if(v===null||v===undefined||v==='') return null;
  const n = Number(v);
  if(isNaN(n)) return esc(v);
  return n.toLocaleString('es-GT', opts||{});
}
function popupBlock(title, rows, extraHtml){
  const body = rows
    .filter(r => r[1]!==null && r[1]!==undefined && String(r[1]).trim()!=='' && String(r[1]).trim()!=='NA')
    .map(r => `<div class="pop-row"><span class="pop-k">${esc(r[0])}</span><span class="pop-v">${esc(r[1])}</span></div>`)
    .join('');
  return `<div class="pop-title">${esc(title)}</div>${body || (extraHtml ? '' : '<div class="pop-row"><span class="pop-v">Sin datos adicionales</span></div>')}${extraHtml || ''}`;
}
function firstNonEmpty(...vals){
  for(const v of vals){ if(v!==null && v!==undefined && String(v).trim()!=='') return v; }
  return null;
}

/* Small inline SVG bar chart for maize yield (qq/cuerda) across 2023-2025 */
function maizeYieldChart(rendimientos, color){
  if(!rendimientos) return '<div class="pop-row"><span class="pop-v">Sin datos de rendimiento para 2025</span></div>';
  const years = ['2023','2024','2025'];
  const vals = years.map(y => rendimientos[y] ? rendimientos[y].qq : null);
  const maxVal = Math.max(...vals.filter(v=>v!==null), 1);
  const W = 230, H = 100, barW = 46, gap = 20, baseY = 74;
  let bars = '';
  years.forEach((y, i) => {
    const x = 20 + i*(barW+gap);
    const v = vals[i];
    if(v === null){
      bars += `<text x="${x+barW/2}" y="${baseY-4}" text-anchor="middle" font-size="9" fill="#9a9a90">s/d</text>`;
    } else {
      const h = Math.max(4, (v/maxVal) * 56);
      bars += `<rect x="${x}" y="${baseY-h}" width="${barW}" height="${h}" rx="3" fill="${color}"/>`;
      bars += `<text x="${x+barW/2}" y="${baseY-h-5}" text-anchor="middle" font-size="10" font-weight="700" fill="#3d4237">${v.toFixed(2)}</text>`;
    }
    bars += `<text x="${x+barW/2}" y="${baseY+14}" text-anchor="middle" font-size="9.5" fill="#767c6f">${y}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="display:block;margin-top:4px;">
    <line x1="14" y1="${baseY}" x2="${W-14}" y2="${baseY}" stroke="#d8d2bd" stroke-width="1"/>
    ${bars}
  </svg>
  <div style="font-size:10px;color:#9a9a90;text-align:center;margin-top:-2px;">Rendimiento seco, quintales por cuerda</div>`;
}
const EMPTY_FC = { type:'FeatureCollection', features:[] };

/* ---------------------------------------------------------
   ICON FACTORIES
--------------------------------------------------------- */
function makePinIcon(emoji, color){
  return L.divIcon({
    className:'',
    html:`<div class="pin-marker" style="--c:${color}"><span>${emoji}</span></div>`,
    iconSize:[28,28],
    iconAnchor:[14,14],
    popupAnchor:[0,-16]
  });
}
function makeImageIcon(imgPath, color){
  return L.divIcon({
    className:'',
    html:`<div class="img-marker" style="--c:${color}"><img src="${imgPath}" loading="lazy" alt=""></div>`,
    iconSize:[34,34],
    iconAnchor:[17,17],
    popupAnchor:[0,-17]
  });
}
function clusterIconFactory(color){
  return function(cluster){
    const count = cluster.getChildCount();
    const size = count < 10 ? 34 : count < 50 ? 42 : 50;
    return L.divIcon({
      html:`<div class="cluster-bubble" style="--c:${color}; width:${size}px; height:${size}px; font-size:${count<10?13:14}px;">${count}</div>`,
      className:'', iconSize:[size,size]
    });
  };
}

/* Relative paths to image assets (no base64 — keeps the repo diff-friendly) */
const ASSET_PATHS = {
  badge_brigada:   'assets/img/badge_brigada.png',
  badge_apicultura:'assets/img/badge_apicultura.png',
  badge_estufa:    'assets/img/badge_estufa.png',
  badge_isotopos:  'assets/img/badge_isotopos.png',
  badge_cedracc:   'assets/img/badge_cedracc.png',
};

/* ---------------------------------------------------------
   LAYER DEFINITIONS
   group: 'base' | 'agroecologia' | 'ecosistemas' | 'economia' | 'comunitaria'
   Each layer points to a `file` (fetched at boot) instead of embedding data.
--------------------------------------------------------- */
const COBERTURA_COLORS = {
  'Bosque Mixto': '#a8a800',
  'Bosque Estacionalmente Seco': '#ffaa00',
  'Bosque Coníferas de Altura': '#00734c',
  'Bosque Latifoliado': '#38a800',
};

const MAIZE_COLORS = {
  'Panimatzalam': '#2d4a1e',
  'Chaquijya': '#6a9a3a',
  'Chuitzamchaj': '#a89684',
  'Xesampaul': '#7a1010',
  'Chuacruz': '#c41414',
};

const LAYER_DEFS = [

  // ---------------- BASE (Shapes base) ----------------
  {
    id:'departamentos', group:'base', label:'Departamentos', type:'polygon',
    color:'#8a8468', defaultOn:false, file:'data/departamentos.geojson',
    style:{color:'#8a8468', weight:2.6, dashArray:'2 5', fillOpacity:0.02},
    popup:f=>popupBlock(f.properties.DEPARTAMEN, [
      ['Región', f.properties.REGION],
      ['Área', fmtNum(f.properties.AREA_KM2,{maximumFractionDigits:0})+' km²'],
      ['Población', fmtNum(f.properties.POBLACION)],
      ['Viviendas', fmtNum(f.properties.VIVIENDAS)],
    ])
  },
  {
    id:'municipios', group:'base', label:'Municipios', type:'polygon',
    color:'#2e9fd6', defaultOn:true, file:'data/municipios.geojson',
    style:{color:'#2e9fd6', weight:1.4, fillOpacity:0.02},
    popup:f=>popupBlock(f.properties.MUNICIPIOS, [
      ['Departamento', f.properties.DEPARTAMEN],
      ['Área', fmtNum(f.properties.AREA_KM2,{maximumFractionDigits:1})+' km²'],
    ])
  },
  {
    id:'corredor', group:'base', label:"Corredor biocultural Zunil–Atitlán–Acatenango", shortLabel:'Corredor biocultural', type:'polygon',
    color:'#c1272d', defaultOn:true, file:'data/corredor_biocultural.geojson',
    style:{color:'#c1272d', weight:2.2, dashArray:'7 5', fillOpacity:0.10, fillColor:'#c1272d'},
    popup:f=>popupBlock("Corredor biocultural Zunil–Atitlán–Balam Juyu' (Acatenango)", [
      ['Extensión', fmtNum(Math.round(f.properties.Hectares))+' ha'],
    ])
  },
  {
    id:'subcuenca_quiscab', group:'base', label:'Subcuenca del Río Quiscab', type:'polygon',
    color:'#00e6a9', defaultOn:true, file:'data/subcuenca_quiscab.geojson',
    style:{color:'#00e6a9', weight:4, fillOpacity:0.08, fillColor:'#00e6a9'},
    popup:f=>popupBlock(firstNonEmpty(f.properties.CUENCA,'Subcuenca del Río Quiscab'), [
      ['Extensión', fmtNum(f.properties.Hectares,{maximumFractionDigits:1})+' ha'],
    ])
  },
  {
    id:'amortiguamiento', group:'base', label:'Área de amortiguamiento', type:'polygon',
    color:'#b5651d', defaultOn:false, file:'data/area_amortiguamiento.geojson',
    style:{color:'#b5651d', weight:3.2, dashArray:'4 4', fillOpacity:0.07, fillColor:'#b5651d'},
    popup:f=>popupBlock('Área de amortiguamiento', [])
  },
  {
    id:'cobertura_forestal', group:'base', label:'Cobertura forestal', type:'polygon', multiclass:true,
    color:'#4c6b3f', defaultOn:false, file:'data/cobertura_forestal.geojson',
    classField:'class_name',
    classColors: COBERTURA_COLORS,
    style:f=>({ color: COBERTURA_COLORS[f.properties.class_name] || '#4c6b3f', weight:0.6,
                fillOpacity:0.55, fillColor: COBERTURA_COLORS[f.properties.class_name] || '#4c6b3f' }),
    popup:f=>popupBlock('Cobertura forestal', [
      ['Tipo', f.properties.class_name],
    ])
  },

  // ---------------- AGROECOLOGÍA ----------------
  {
    id:'agro_agricultores', group:'agroecologia', label:'Agricultores agroecológicos', type:'point',
    color:'#6b8e4e', icon:'🌱', cluster:true, defaultOn:true, file:'data/agro_agricultores.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Nombre,'Agricultor(a)'), [
      ['Municipio', f.properties.Municipio],
      ['Grupo', f.properties.Grupo],
    ])
  },
  {
    id:'agro_escuelas_campo', group:'agroecologia', label:'Escuelas de Campo Agroecológica', type:'point',
    color:'#8b5e3c', icon:'🌾', cluster:true, defaultOn:true, file:'data/agro_escuelas_campo.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Nombre,'Escuela de Campo'), [
      ['Municipio', f.properties.Municipio],
      ['Grupo', f.properties.Grupo],
    ])
  },
  {
    id:'agro_captacion_agua', group:'agroecologia', label:'Captación de agua de lluvia', type:'point',
    color:'#2e7d9a', icon:'💧', defaultOn:true, file:'data/agro_captacion_agua.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Nombre,'Sistema de captación'), [
      ['Municipio', f.properties.Municipio],
      ['Grupo', f.properties.Grupo],
    ])
  },

  // ---------------- GESTIÓN DE ECOSISTEMAS ----------------
  {
    id:'areas_conservacion', group:'ecosistemas', label:'Áreas de conservación', type:'polygon',
    color:'#f3b900', defaultOn:true, file:'data/areas_conservacion.geojson',
    style:{color:'#c99400', weight:1.8, fillOpacity:0.32, fillColor:'#f3b900'},
    popup:f=>popupBlock(firstNonEmpty(f.properties.PRM,'Área de conservación'), [
      ['Extensión', fmtNum(f.properties.Hectares,{maximumFractionDigits:1})+' ha'],
    ])
  },
  {
    id:'brigadas', group:'ecosistemas', label:'Brigadas comunitarias capacitadas', type:'point',
    color:'#1f3a3a', image:'badge_brigada', defaultOn:true, file:'data/brigadas.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.NPOB_INE,'Brigada comunitaria'), [
      ['Categoría', f.properties.CAT_INE],
    ])
  },
  {
    id:'brechas_cortafuegos', group:'ecosistemas', label:'Brechas cortafuegos', type:'line',
    color:'#e8590c', defaultOn:true, file:'data/brechas_cortafuegos.geojson',
    style:{color:'#e8590c', weight:3, dashArray:'1 6', lineCap:'round'},
    popup:f=>popupBlock(firstNonEmpty(f.properties.Name,'Brecha cortafuegos'), [
      ['Longitud', fmtNum(f.properties.Length,{maximumFractionDigits:2})+' km'],
    ])
  },
  {
    id:'diagnostico_estufas', group:'ecosistemas', label:'Diagnóstico de estufas ahorradoras de leña', type:'point',
    color:'#b5651d', image:'badge_estufa', cluster:true, defaultOn:true, file:'data/diagnostico_estufas.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Entrevistado,'Hogar entrevistado'), [
      ['Municipio', f.properties.Municipio],
      ['Fecha', f.properties.Fecha],
      ['Familias en el hogar', f.properties.Num_familias],
      ['Personas en el hogar', f.properties.Num_personas],
      ['Forma de cocinar', f.properties.Forma_cocinar],
      ['Estado de la cocina', f.properties.Estado_cocina],
      ['Obtención de leña', f.properties.Obtencion_lena],
      ['Compromiso estufa ahorradora', f.properties.Compromiso_estufa_ahorradora],
    ])
  },
  {
    id:'monitoreo_reforestacion', group:'ecosistemas', label:'Monitoreo de reforestación', type:'point',
    color:'#4c6b3f', icon:'🌳', cluster:true, defaultOn:true, file:'data/monitoreo_reforestacion.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Participante,'Parcela reforestada'), [
      ['Municipio', firstNonEmpty(f.properties.Municipio_VMS, f.properties.Municipio_BMZ)],
      ['Comunidad', f.properties.Comunidad],
      ['Sector', f.properties.Sector],
      ['Sexo', f.properties.Sexo],
      ['Proyecto', f.properties.Proyecto],
      ['Uso del suelo', f.properties.Uso_suelo],
      ['Pendiente del terreno', f.properties.Pendiente],
      ['Cuerdas asignadas', f.properties.Cuerdas_asignadas],
      ['Fecha', f.properties.Fecha],
    ])
  },

  // ---------------- ECONOMÍA RURAL ----------------
  {
    id:'fungicultura', group:'economia', label:'Diagnóstico de fungicultura', type:'point',
    color:'#8b5e3c', icon:'🍄', cluster:true, defaultOn:true, file:'data/fungicultura.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Nombre,'Fungicultor(a)'), [
      ['Género', f.properties.Genero],
      ['Municipio de residencia', f.properties.Municipio_residencia],
      ['Comunidad', f.properties.Comunidad],
      ['Comunidad lingüística', f.properties.Comunidad_linguistica],
    ])
  },
  {
    id:'apicultura', group:'economia', label:'Diagnóstico de apicultura', type:'point',
    color:'#d9a441', image:'badge_apicultura', cluster:true, defaultOn:true, file:'data/apicultura.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Nombre,'Apicultor(a)'), [
      ['Género', f.properties.Genero],
      ['Municipio de residencia', f.properties.Municipio_residencia],
      ['Comunidad', f.properties.Comunidad],
      ['Comunidad lingüística', f.properties.Comunidad_linguistica],
    ])
  },
  {
    id:'diplomado', group:'economia', label:'Municipalidades que Participaron en el Diplomado en Gestión Ambiental', shortLabel:'Diplomado Ambiental (Municipalidades)', type:'point',
    color:'#4c6b3f', icon:'🎓', defaultOn:true, file:'data/diplomado_ambiental.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.NPOB_INE,'Sede del diplomado'), [])
  },
  {
    id:'escuelas_detectives', group:'economia', label:"Escuelas Detectives de la Naturaleza 2027", type:'point',
    color:'#2e7d9a', icon:'🔎', defaultOn:true, file:'data/escuelas_detectives.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.NPOB_INE,'Escuela'), [
      ['Categoría', f.properties.CAT_INE],
    ])
  },
  {
    id:'ceibis_escuelas', group:'economia', label:'Escuelas CEIBIS — Educación Ambiental Qanan Ulew', shortLabel:'Escuelas CEIBIS', type:'point',
    color:'#1abc9c', icon:'📚', cluster:true, defaultOn:true, file:'data/ceibis_escuelas.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Nombre_Escuela,'Escuela CEIBI'), [
      ['Distrito', f.properties.Distrito],
      ['Director(a)', f.properties.Director],
      ['Género', f.properties.Genero_Director],
      ['Teléfono', f.properties.Telefono_Director],
      ['Correo', f.properties.Correo_Director],
      ['Docentes', f.properties.Docentes],
      ['Niños', f.properties.Ninos],
      ['Niñas', f.properties.Ninas],
      ['Total estudiantes', f.properties.Total_Estudiantes],
    ])
  },

  // ---------------- INVESTIGACIÓN Y ORGANIZACIÓN COMUNITARIA ----------------
  {
    id:'grupos_comunitarios', group:'comunitaria', label:'Grupos y organizaciones comunitarias', type:'point',
    color:'#7a3030', icon:'🤝', defaultOn:true, file:'data/grupos_comunitarios.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Name,'Grupo comunitario'), [])
  },
  {
    id:'isotopos_fase1', group:'comunitaria', label:'Isótopos — Fase I (2022)', type:'point',
    color:'#2e86c1', image:'badge_isotopos', defaultOn:true, file:'data/isotopos_fase1.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Nombre,'Punto de muestreo'), [
      ['Tipo', f.properties.Tipo],
      ['Municipio', f.properties.Municipio],
      ['Coliformes totales (NMP/100mL)', f.properties.Colifor1],
      ['E. coli (NMP/100mL)', f.properties.Ecoli1],
      ['Fósforo reactivo (mg/L)', f.properties.PO3],
      ['Nitrato (mg/L)', f.properties.NO3_abr],
      ['Fase', 'I · 2022'],
    ])
  },
  {
    id:'isotopos_fase2', group:'comunitaria', label:'Isótopos — Fase II (2024–2025)', type:'point',
    color:'#154360', image:'badge_isotopos', defaultOn:true, file:'data/isotopos_fase2.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Nombre,'Punto de muestreo'), [
      ['Tipo', f.properties.Tipo],
      ['Municipio', f.properties.Municipio],
      ['Coliformes totales (NMP/100mL)', f.properties.Colifor1],
      ['E. coli (NMP/100mL)', f.properties.Ecoli1],
      ['Fósforo reactivo (mg/L)', f.properties.PO3],
      ['Nitrato (mg/L)', f.properties.NO3_abr],
      ['Fase', 'II · 2024–2025'],
    ])
  },
  {
    id:'isotopos_lago', group:'comunitaria', label:'Punto de muestreo — Lago de Atitlán', type:'point',
    color:'#0d3d5c', icon:'🌊', defaultOn:true, file:'data/isotopos_lago.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Nombre,'Lago de Atitlán'), [
      ['Punto', f.properties.Name],
    ])
  },
  {
    id:'estaciones_meteorologicas', group:'comunitaria', label:'Estaciones Meteorológicas', type:'point',
    color:'#e67e22', icon:'🌡️', defaultOn:true, file:'data/estaciones_meteorologicas.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Nombre,'Estación meteorológica'), [
      ['Institución', f.properties.Institucion],
    ])
  },
  {
    id:'pluviometros', group:'comunitaria', label:'Pluviómetros', type:'point',
    color:'#3498db', icon:'🌧️', cluster:true, defaultOn:true, file:'data/pluviometros.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.Nombre,'Pluviómetro'), [
      ['Instrumento', f.properties.Instrumento],
    ])
  },
  {
    id:'cedracc', group:'comunitaria', label:'CEDRACC', type:'point',
    color:'#3d5a99', image:'badge_cedracc', defaultOn:true, file:'data/cedracc.geojson',
    popup:f=>popupBlock(firstNonEmpty(f.properties.NombreCompleto,'CEDRACC'), [
      ['Lugar', f.properties.Lugar],
    ])
  },
  {
    id:'maiz_rendimiento', group:'comunitaria', label:'Parcelas Agroclimáticas (rendimiento de maíz)', shortLabel:'Parcelas Agroclimáticas', type:'point',
    color:'#c9a227', icon:'🌽', defaultOn:true, file:'data/maiz_rendimiento.geojson', popupWidth:290,
    popup:f=>{
      const barColor = MAIZE_COLORS[f.properties.Comunidad] || '#8a9a3a';
      return popupBlock(f.properties.Comunidad, [
        ['Ubicación', f.properties.Ubicacion],
        ['Productor(a)', f.properties.Productor],
      ], maizeYieldChart(f.properties.Rendimientos, barColor));
    }
  },
  {
    id:'parcelas_bioclimaticas', group:'comunitaria', label:'Parcelas Bioclimáticas', type:'point',
    color:'#2e7d32', icon:'🐦', defaultOn:true, file:'data/parcelas_bioclimaticas.geojson', popupWidth:300,
    popup:f=>popupBlock(f.properties.Nombre, [
      ['Altitud', fmtNum(f.properties.Altitud)+' msnm'],
      ['Ecosistema', f.properties.Ecosistema],
      ['Categoría', f.properties.Categoria],
      ['Temperatura de referencia', f.properties.TempReferencia!=null ? f.properties.TempReferencia+' °C' : null],
      ['Última temperatura', f.properties.TempUltima!=null ? f.properties.TempUltima+' °C ('+f.properties.FechaTemp+')' : null],
      ['Mín / máx último día', (f.properties.TempMin!=null && f.properties.TempMax!=null) ? f.properties.TempMin+' °C / '+f.properties.TempMax+' °C' : null],
      ['Especies de aves', f.properties.AvesEspecies],
      ['Individuos registrados', f.properties.AvesIndividuos],
      ['Registros de aves', f.properties.AvesRegistros],
      ['Años de monitoreo (aves)', f.properties.AniosAves],
      ['Árboles medidos', f.properties.ArbolesMedidos],
      ['Especies de árboles', f.properties.ArbolesEspecies],
      ['Especies confirmadas', f.properties.ArbolesEspeciesConfirmadas],
      ['DAP promedio', f.properties.DAPPromedio!=null ? f.properties.DAPPromedio+' cm' : null],
      ['Crecimiento promedio', f.properties.CrecimientoPromedio!=null ? f.properties.CrecimientoPromedio+' cm' : null],
    ])
  },
];

const TABS = [
  {id:'general', label:'Panorama General', dot:'#c9a227'},
  {id:'agroecologia', label:'Agroecología', dot:'#6b8e4e'},
  {id:'ecosistemas', label:'Gestión de Ecosistemas', dot:'#345226'},
  {id:'economia', label:'Economía Rural', dot:'#d9a441'},
  {id:'comunitaria', label:'Investigación y Organización Comunitaria', dot:'#7a3030'},
];
const TAB_IDS = TABS.map(t=>t.id);

const TAB_DESCRIPTIONS = {
  general: "Unión de toda la información disponible: cartografía base y las cuatro líneas temáticas del territorio.",
  agroecologia: "Agricultores, escuelas de campo y sistemas de captación de agua asociados a prácticas agroecológicas.",
  ecosistemas: "Áreas de conservación, brigadas comunitarias, diagnóstico de estufas y monitoreo de reforestación.",
  economia: "Diagnósticos de fungicultura y apicultura, diplomado ambiental, escuelas Detectives de la Naturaleza y escuelas CEIBIS de educación ambiental.",
  comunitaria: "Grupos comunitarios, estaciones meteorológicas, pluviómetros, CEDRACC, parcelas agroclimáticas y bioclimáticas, y el estudio de isótopos para datar el agua en Atitlán (Fase I y II).",
};

/* ---------------------------------------------------------
   MAP INIT (basemaps + control chrome only — no data layers yet)
--------------------------------------------------------- */
const map = L.map('map', { zoomControl:false, minZoom:8, maxZoom:18, attributionControl:false });
L.control.zoom({position:'bottomright'}).addTo(map);
L.control.scale({position:'bottomright', imperial:false, maxWidth:140}).addTo(map);
L.control.attribution({position:'bottomright', prefix:false}).addTo(map);

const STUDY_BOUNDS = [[14.20,-91.72],[15.00,-90.72]];
map.fitBounds(STUDY_BOUNDS);

const basemaps = {
  claro: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
    attribution:'&copy; OpenStreetMap, &copy; CARTO', maxZoom:19, subdomains:'abcd'
  }),
  satelite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
    attribution:'Esri, Maxar, Earthstar Geographics', maxZoom:19
  }),
  topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{
    attribution:'&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap', maxZoom:17, subdomains:'abc'
  }),
};
basemaps.satelite.addTo(map);

document.querySelectorAll('#basemap-switch button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    Object.values(basemaps).forEach(l=>map.removeLayer(l));
    basemaps[btn.dataset.base].addTo(map);
    document.querySelectorAll('#basemap-switch button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  });
});

/* ---------------------------------------------------------
   DATA LOADING (async fetch, one request per layer file)
--------------------------------------------------------- */
const leafletLayers = {};
const visible = {};
let activeTab = 'general';

function setLoadingText(msg){
  const el = document.getElementById('loading-text');
  if(el) el.textContent = msg;
}

async function fetchLayerData(def){
  try{
    const res = await fetch(def.file, {cache:'force-cache'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    def.data = json;
    return {ok:true, id:def.id};
  }catch(err){
    console.warn(`No se pudo cargar la capa "${def.label}" (${def.file}):`, err);
    def.data = EMPTY_FC;
    return {ok:false, id:def.id, label:def.label, error:err};
  }
}

function buildLeafletLayer(def){
  const popupWidth = def.popupWidth || 280;
  if(def.type === 'polygon' || def.type === 'line'){
    leafletLayers[def.id] = L.geoJSON(def.data, {
      style: def.style,
      onEachFeature:(f,l)=> l.bindPopup(def.popup(f), {maxWidth:popupWidth})
    });
  } else {
    const geo = L.geoJSON(def.data, {
      pointToLayer:(f,latlng)=> L.marker(latlng, {
        icon: def.image ? makeImageIcon(ASSET_PATHS[def.image], def.color) : makePinIcon(def.icon, def.color)
      }),
      onEachFeature:(f,l)=> l.bindPopup(def.popup(f), {maxWidth:popupWidth})
    });
    if(def.cluster){
      const cg = L.markerClusterGroup({
        iconCreateFunction: clusterIconFactory(def.color),
        showCoverageOnHover:false,
        spiderfyOnMaxZoom:true,
        maxClusterRadius:46
      });
      cg.addLayer(geo);
      leafletLayers[def.id] = cg;
    } else {
      leafletLayers[def.id] = geo;
    }
  }
}

function countOf(id){
  const def = LAYER_DEFS.find(d=>d.id===id);
  return def.data ? def.data.features.length : 0;
}

/* ---------------------------------------------------------
   TAB / PANEL LOGIC
--------------------------------------------------------- */
const tabsEl = document.getElementById('tabs');
TABS.forEach(t=>{
  const btn = document.createElement('button');
  btn.innerHTML = `<span class="dot" style="background:${t.dot}"></span>${t.label}`;
  btn.dataset.tab = t.id;
  btn.className = t.id===activeTab ? 'active' : '';
  btn.addEventListener('click', ()=> setActiveTab(t.id, true));
  tabsEl.appendChild(btn);
});

function layersForTab(tabId){
  if(tabId === 'general') return LAYER_DEFS.filter(d=>d.group!=='base');
  return LAYER_DEFS.filter(d=>d.group===tabId);
}

function renderPanel(){
  const body = document.getElementById('panel-body');
  body.innerHTML = '';

  const baseSection = document.createElement('div');
  baseSection.className = 'layer-section';
  baseSection.innerHTML = `<div class="section-label">Capas de referencia</div>`;
  LAYER_DEFS.filter(d=>d.group==='base').forEach(def=>{
    baseSection.appendChild(layerRow(def));
  });
  body.appendChild(baseSection);
  body.appendChild(Object.assign(document.createElement('hr'), {className:'sep'}));

  const themSection = document.createElement('div');
  themSection.className = 'layer-section';
  const label = activeTab === 'general' ? 'Todas las capas temáticas' : 'Capas temáticas';
  themSection.innerHTML = `<div class="section-label">${label}</div>`;
  layersForTab(activeTab).forEach(def=>{
    themSection.appendChild(layerRow(def));
  });
  body.appendChild(themSection);
}

function layerRow(def){
  const row = document.createElement('div');
  row.className = 'layer-row-wrap';

  const label = document.createElement('label');
  label.className = 'layer-row';
  const swatchClass = def.type==='point' ? 'swatch round' : def.type==='line' ? 'swatch line' : 'swatch';
  const swatchColor = def.multiclass ? 'transparent' : def.color;
  label.innerHTML = `
    <input type="checkbox" ${visible[def.id] ? 'checked':''} data-id="${def.id}">
    ${def.multiclass ? '<span class="swatch multi"></span>' : `<span class="${swatchClass}" style="background:${swatchColor}"></span>`}
    <span class="layer-text">
      <span class="name" title="${esc(def.label)}">${esc(def.shortLabel || def.label)}</span>
      <span class="count">${countOf(def.id)} registro${countOf(def.id)===1?'':'s'}</span>
    </span>
  `;
  label.querySelector('input').addEventListener('change', e=>{
    visible[def.id] = e.target.checked;
    applyVisibility();
    updateInfoChip();
  });
  row.appendChild(label);

  if(def.multiclass && def.classColors){
    const chips = document.createElement('div');
    chips.className = 'multi-swatch';
    chips.innerHTML = Object.entries(def.classColors).map(([name,color])=>
      `<span class="chip"><i style="background:${color}"></i>${esc(name)}</span>`
    ).join('');
    row.appendChild(chips);
  }
  return row;
}

function applyVisibility(){
  const activeIds = new Set([
    ...LAYER_DEFS.filter(d=>d.group==='base').map(d=>d.id),
    ...layersForTab(activeTab).map(d=>d.id)
  ]);
  LAYER_DEFS.forEach(def=>{
    const layer = leafletLayers[def.id];
    if(!layer) return;
    const shouldShow = activeIds.has(def.id) && visible[def.id];
    const isOn = map.hasLayer(layer);
    if(shouldShow && !isOn) layer.addTo(map);
    if(!shouldShow && isOn) map.removeLayer(layer);
  });
  // Keep heavy background reference layers below everything else
  // (each bringToBack() call wins the back-most spot, so the last one
  // in this list ends up furthest back — cobertura_forestal last)
  ['departamentos','municipios','cobertura_forestal'].forEach(id=>{
    const layer = leafletLayers[id];
    if(layer && map.hasLayer(layer) && layer.bringToBack) layer.bringToBack();
  });
  // Floating forest-cover legend follows that layer's own visibility,
  // independent of which tab is active (it's a base/reference layer).
  document.getElementById('forest-legend').classList.toggle('show',
    activeIds.has('cobertura_forestal') && !!visible['cobertura_forestal']);
}

function updateInfoChip(){
  const tab = TABS.find(t=>t.id===activeTab);
  document.getElementById('info-title').textContent = tab.label;
  const themLayers = layersForTab(activeTab).filter(d=>visible[d.id]);
  const total = themLayers.reduce((s,d)=> s + countOf(d.id), 0);
  const layerWord = themLayers.length === 1 ? 'capa' : 'capas';
  const regWord = total === 1 ? 'registro' : 'registros';
  document.getElementById('info-text').innerHTML =
    `${themLayers.length} ${layerWord} activas · ${total.toLocaleString('es-GT')} ${regWord}`;
  document.getElementById('panel-tab-desc').textContent = TAB_DESCRIPTIONS[activeTab];
}

function fitToTab(tabId){
  const layers = layersForTab(tabId).filter(d=>visible[d.id]).map(d=>leafletLayers[d.id]).filter(Boolean);
  if(!layers.length){ map.fitBounds(STUDY_BOUNDS); return; }
  try{
    let bounds = null;
    layers.forEach(l=>{
      const b = l.getBounds ? l.getBounds() : null;
      if(b && b.isValid()) bounds = bounds ? bounds.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast());
    });
    if(bounds && bounds.isValid()) map.flyToBounds(bounds, {padding:[60,60], maxZoom:14, duration:0.6});
    else map.flyToBounds(STUDY_BOUNDS, {duration:0.6});
  }catch(e){ map.fitBounds(STUDY_BOUNDS); }
}

function setActiveTab(tabId, updateHash){
  if(!TAB_IDS.includes(tabId)) tabId = 'general';
  activeTab = tabId;
  document.querySelectorAll('nav.tabs button').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  renderPanel();
  applyVisibility();
  updateInfoChip();
  fitToTab(tabId);
  document.getElementById('isotopos-corner').classList.toggle('show', tabId === 'comunitaria');
  if(window.innerWidth <= 760) document.getElementById('panel').classList.remove('open');
  if(updateHash){
    history.pushState(null, '', '#' + tabId);
  }
}

/* React to back/forward navigation and direct links with a #hash */
window.addEventListener('hashchange', ()=>{
  const tabId = location.hash.replace('#','');
  if(TAB_IDS.includes(tabId) && tabId !== activeTab) setActiveTab(tabId, false);
});

/* Mobile panel toggle */
document.getElementById('panel-toggle').addEventListener('click', ()=>{
  document.getElementById('panel').classList.add('open');
});
document.getElementById('panel-close').addEventListener('click', ()=>{
  document.getElementById('panel').classList.remove('open');
});

/* Share current tab view */
document.getElementById('share-btn').addEventListener('click', async ()=>{
  const url = location.origin + location.pathname + '#' + activeTab;
  const toast = document.getElementById('share-toast');
  try{
    await navigator.clipboard.writeText(url);
  }catch(e){
    // Fallback for browsers/contexts without clipboard API permission
    const tmp = document.createElement('textarea');
    tmp.value = url;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
  }
  toast.classList.add('show');
  clearTimeout(window._shareToastTimer);
  window._shareToastTimer = setTimeout(()=> toast.classList.remove('show'), 2200);
});

/* Image modal (Expansión del Estudio — isótopos) */
document.getElementById('modal-close').addEventListener('click', ()=>{
  document.getElementById('image-modal').classList.remove('open');
});
document.getElementById('image-modal').addEventListener('click', (e)=>{
  if(e.target.id === 'image-modal') document.getElementById('image-modal').classList.remove('open');
});
document.getElementById('isotopos-corner').addEventListener('click', ()=>{
  document.getElementById('image-modal').classList.add('open');
});

/* Error banner */
function showErrorBanner(failed){
  const banner = document.getElementById('error-banner');
  const names = failed.map(f=>f.label).join(', ');
  banner.innerHTML = `No se pudieron cargar ${failed.length} capa${failed.length===1?'':'s'}: ${esc(names)}.
    <button id="error-banner-close">Cerrar</button>`;
  banner.classList.add('show');
  document.getElementById('error-banner-close').addEventListener('click', ()=>{
    banner.classList.remove('show');
  });
}

/* ---------------------------------------------------------
   BOOT — fetch every layer's GeoJSON in parallel, then build
--------------------------------------------------------- */
(async function boot(){
  setLoadingText(`Cargando ${LAYER_DEFS.length} capas de datos…`);

  const results = await Promise.all(LAYER_DEFS.map(fetchLayerData));
  const failed = results.filter(r=>!r.ok).map(r=>{
    const def = LAYER_DEFS.find(d=>d.id===r.id);
    return {id:r.id, label: def.label};
  });

  setLoadingText('Preparando el mapa…');
  LAYER_DEFS.forEach(buildLeafletLayer);
  LAYER_DEFS.forEach(def=>{ visible[def.id] = !!def.defaultOn; });

  // Honor a #hash on first load (shareable links to a specific tab)
  const initialTab = location.hash.replace('#','');
  setActiveTab(TAB_IDS.includes(initialTab) ? initialTab : 'general', false);

  if(failed.length) showErrorBanner(failed);

  document.getElementById('loading-overlay').classList.add('hidden');
})();
