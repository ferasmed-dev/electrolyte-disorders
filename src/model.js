// Water, sodium and potassium disorders simulator — pure model (no DOM).
// Simple time-course models; values marked "Model" are teaching assumptions tuned to the textbook course.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Calculated plasma osmolality (mOsm/kg) with normal glucose (90 mg/dL) and urea (30 mg/dL). */
export const posmCalc = (na, glucosa = 90, urea = 30) => 2 * na + glucosa / 18 + urea / 6;

export const GAUGES = {
  na: { unit: 'mEq/L', dec: 0, normal: [135, 145] },
  k: { unit: 'mEq/L', dec: 1, normal: [3.5, 5.0] },
  posm: { unit: 'mOsm/kg', dec: 0, normal: [280, 295] },
  uosm: { unit: 'mOsm/kg', dec: 0, normal: null, yMin: 0 },
  una: { unit: 'mEq/L', dec: 0, normal: null, yMin: 0 },
  urato: { unit: 'mg/dL', dec: 1, normal: [3.5, 7.0] },
  vec: { unit: 'L', dec: 1, normal: [14, 16] },               // extracellular volume (70 kg adult)
  pas: { unit: 'mmHg', dec: 0, normal: [100, 139] },
  fg: { unit: 'mL/min', dec: 0, normal: [90, 140], yMin: 0 },
  diuresis: { unit: 'L/24 h', dec: 1, normal: [0.8, 2.5], yMin: 0 },
  cerebro: { unit: '0–3', dec: 1, normal: [0, 0.4], yMin: 0, yMax: 3 },   // brain oedema index (Model)
  ods: { unit: '0–3', dec: 1, normal: [0, 0.4], yMin: 0, yMax: 3 },       // osmotic demyelination risk (Model)
  conciencia: { unit: '0–3', dec: 1, normal: [0, 0.4], yMin: 0, yMax: 3 }, // impaired consciousness (Model)
  ecg: { unit: '0–3', dec: 1, normal: [0, 0.4], yMin: 0, yMax: 3 },       // arrhythmic risk (Model)
  qrs: { unit: 'ms', dec: 0, normal: [70, 110] },
  debilidad: { unit: '0–3', dec: 1, normal: [0, 0.4], yMin: 0, yMax: 3 }, // muscle weakness (Model)
};

const R = (key, min, max, step, def, unit = '', dec = 0) => ({ key, min, max, step, def, unit, dec });
const Ch = (key, options, def) => ({ key, type: 'choice', options, def });

export const ENTITIES = [
  { key: 'deplecion', loc: 'vec', unit: 'hours', tMax: 48, dt: 0.25, treat: true,
    params: [R('perdidas', 1, 8, 0.5, 4, 'L/24 h', 1), R('inicio', 2, 24, 1, 8, 'h')],
    tiles: ['vec', 'pas', 'na', 'fg'], charts: ['vec', 'pas'],
    steps: ['perdida', 'vec_baja', 'sraa_adh', 'hipotension', 'prerrenal', 'reposicion'] },
  { key: 'expansion', loc: 'vec', unit: 'days', tMax: 14, dt: 0.1, treat: true,
    params: [Ch('causa', ['ic', 'cirrosis', 'nefrotico'], 'ic'), R('sal', 2, 15, 1, 10, 'g/24 h')],
    tiles: ['vec', 'na', 'pas'], charts: ['vec', 'na'],
    steps: ['retencion', 'edema', 'hiponatremia_dil', 'restriccion'] },
  { key: 'hiponatremia', loc: 'cerebro', unit: 'hours', tMax: 72, dt: 0.25, treat: true,
    params: [R('na0', 105, 134, 1, 118, 'mEq/L'), Ch('cronicidad', ['cronica', 'aguda'], 'cronica'), Ch('sintomas', ['graves', 'leves'], 'graves'),
      Ch('causa', ['hipovolemica', 'siadh', 'hipervolemica'], 'hipovolemica'), R('velocidad', 4, 18, 1, 8, 'mEq/L/24 h')],
    tiles: ['na', 'cerebro', 'ods', 'uosm'], charts: ['na', 'cerebro', 'ods'],
    steps: ['agua', 'osmolalidad', 'edema_cerebral', 'adaptacion', 'bolo', 'correccion', 'ods'] },
  { key: 'siadh', loc: 'colector', unit: 'days', tMax: 14, dt: 0.1, treat: true,
    params: [R('agua', 1, 4, 0.25, 2.5, 'L/24 h', 2), Ch('tto', ['restriccion', 'tolvaptan'], 'restriccion')],
    tiles: ['na', 'uosm', 'una', 'urato'], charts: ['na', 'uosm'],
    steps: ['adh', 'retencion_agua', 'euvolemia', 'hiponatremia', 'tto'] },
  { key: 'hipernatremia', loc: 'colector', unit: 'hours', tMax: 72, dt: 0.25, treat: true,
    params: [Ch('causa', ['extrarrenal', 'di_central', 'di_nefrogenica', 'aporte'], 'di_central'), R('na0', 148, 175, 1, 160, 'mEq/L')],
    tiles: ['na', 'conciencia', 'diuresis', 'uosm'], charts: ['na', 'diuresis'],
    steps: ['deficit_agua', 'osmolalidad', 'deshidratacion_celular', 'snc', 'agua_libre', 'especifico'] },
  { key: 'hiperk', loc: 'corazon', unit: 'hours', tMax: 6, dt: 0.02, treat: true,
    params: [R('k0', 5.6, 8.5, 0.1, 7.2, 'mEq/L', 1), Ch('causa', ['erc', 'farmacos', 'atr4'], 'erc')],
    tiles: ['k', 'ecg', 'qrs'], charts: ['k', 'ecg'],
    steps: ['k_alto', 'membrana', 'ecg_t', 'ecg_qrs', 'calcio', 'redistribucion', 'eliminacion'] },
  { key: 'hipok', loc: 'corazon', unit: 'days', tMax: 7, dt: 0.05, treat: true,
    params: [R('k0', 1.8, 3.4, 0.1, 2.6, 'mEq/L', 1), Ch('causa', ['diureticos', 'digestivas', 'ingesta'], 'diureticos'), Ch('via', ['oral', 'iv'], 'oral')],
    tiles: ['k', 'debilidad', 'ecg'], charts: ['k', 'debilidad'],
    steps: ['perdida_k', 'hiperpolarizacion', 'ecg_u', 'debilidad', 'reposicion'] },
];

export function defaults(key) {
  const e = ENTITIES.find(x => x.key === key);
  return Object.fromEntries(e.params.map(p => [p.key, p.def]));
}

function runner(e, init, step) {
  const points = [], events = [], fired = new Set();
  const emit = (t, key, args = []) => { if (fired.has(key)) return; fired.add(key); events.push({ t, key, args }); };
  const st = { ...init };
  const n = Math.round(e.tMax / e.dt);
  for (let i = 0; i <= n; i++) {
    const t = +(i * e.dt).toFixed(6);
    const o = step(st, t, e.dt, emit);
    const g = { na: 140, k: 4.2, vec: 15, vic: 25, adh: 0.4, ...o.g };
    for (const k of Object.keys(g)) g[k] = Number.isFinite(g[k]) ? Math.max(0, g[k]) : 0;
    points.push({ t, g, active: o.active, lesion: clamp(o.lesion ?? 0, 0, 1), badge: o.badge || null });
  }
  return { points, events };
}
const E = (k) => ENTITIES.find(x => x.key === k);
const ecgRisk = (k) => clamp((k - 5.5) / 1.2, 0, 3);
const qrsFromK = (k) => 90 + Math.max(0, k - 6.5) * 30;

const MODELS = {
  // ECF depletion (isotonic losses): Na stays normal while ECF falls; BP and GFR (pre-renal) fall;
  // RAAS/ADH activate. Isotonic saline replaces the deficit (Model: 0.25 L/h on top of ongoing losses).
  deplecion(p, treated) {
    return runner(E('deplecion'), { vec: 15 }, (s, t, dt, emit) => {
      const on = treated && t >= p.inicio;
      if (on) emit(t, 'ss09');
      if (t > 0) s.vec += (-p.perdidas / 24 + (on && s.vec < 15 ? p.perdidas / 24 + 0.25 : 0)) * dt;
      s.vec = clamp(s.vec, 8, 15);
      const def = 15 - s.vec;
      const pas = 120 - 9 * Math.max(0, def - 1);
      const fg = 100 - 14 * Math.max(0, def - 1.5);
      if (def > 1.5) emit(t, 'sraa');
      if (pas < 90) emit(t, 'hipotension');
      if (fg < 60) emit(t, 'prerrenal');
      const active = ['perdida'];
      if (def > 0.8) active.push('vec_baja');
      if (def > 1.5) active.push('sraa_adh');
      if (pas < 90) active.push('hipotension');
      if (fg < 60) active.push('prerrenal');
      if (on) active.push('reposicion');
      return { g: { vec: s.vec, vic: 25, na: 140, pas, fg, adh: clamp(0.4 + def / 6, 0, 1) }, active, lesion: def / 6,
        badge: pas < 90 ? 'shock' : def > 1.5 ? 'vec_baja' : null };
    });
  },

  // ECF expansion (heart failure, cirrhosis, nephrotic): effective arterial volume low → Na and water retained;
  // oedema grows with salt intake and ADH can dilute Na. Salt restriction + loop diuretic remove the excess.
  expansion(p, treated) {
    const gain = (p.sal - 3) * 0.06 * ({ ic: 1, cirrosis: 1.1, nefrotico: 0.9 }[p.causa]);
    return runner(E('expansion'), { vec: 15.5, na: 139 }, (s, t, dt, emit) => {
      const on = treated && t >= 2;
      if (on) emit(t, 'diuretico');
      if (t > 0) s.vec += (on ? -0.35 * (s.vec > 15.5 ? 1 : 0) : gain) * dt;
      s.vec = clamp(s.vec, 15, 26);
      const exc = s.vec - 15;
      s.na += ((on ? 137 : 139 - 0.9 * exc) - s.na) * Math.min(1, dt / 1.5);
      const pas = p.causa === 'cirrosis' ? 105 : 128 + exc;
      if (exc > 3) emit(t, 'edema');
      if (s.na < 135) emit(t, 'hiponatremia');
      const active = ['retencion'];
      if (exc > 2) active.push('edema');
      if (s.na < 135) active.push('hiponatremia_dil');
      if (on) active.push('restriccion');
      return { g: { vec: s.vec, vic: 25 - 0.15 * exc, na: s.na, pas, adh: clamp(0.5 + exc / 15, 0, 1) }, active, lesion: exc / 10,
        badge: exc > 3 ? 'edema' : null };
    });
  },

  // Hyponatraemia: acute (< 48 h) → brain oedema that progresses; chronic → brain adapts (little oedema) but a
  // correction faster than 10 mEq/L/24 h exposes it to osmotic demyelination. Severe symptoms: 3 % saline
  // boluses of 100 mL (up to 3, ~+2 mEq/L each), then correction at the chosen rate up to 130 mEq/L.
  hiponatremia(p, treated) {
    const acute = p.cronicidad === 'aguda';
    const uosm = { hipovolemica: 450, siadh: 500, hipervolemica: 400 }[p.causa];
    const una = { hipovolemica: 10, siadh: 45, hipervolemica: 12 }[p.causa];
    return runner(E('hiponatremia'), { na: p.na0, bol: 0, rise24: [] , ods: 0 }, (s, t, dt, emit) => {
      let dna = 0;
      if (!treated) { if (acute && t > 0) dna = -0.06; }
      else {
        if (p.sintomas === 'graves' && t > 0 && t <= 1.5 && s.bol < 3) {
          const k = Math.min(3, Math.floor(t / 0.5) + 1);
          if (k > s.bol) { s.bol = k; emit(t, `bolo${k}`, [k]); }
          dna = 4 / 1.5;
        } else if (t > 0 && s.na < 130) dna = p.velocidad / 24;
        if (t > 0) emit(0, 'tto');
      }
      if (t > 0) s.na = clamp(s.na + dna * dt, 100, 145);
      s.rise24.push(s.na);
      const lag = Math.round(24 / 0.25);
      const rise = s.rise24.length > lag ? s.na - s.rise24[s.rise24.length - 1 - lag] : s.na - p.na0;
      if (!acute && rise > 10) { s.ods = clamp(s.ods + (rise - 10) * 0.06 * dt, 0, 3); emit(t, 'ods', [10]); }
      const cere = acute ? clamp((135 - s.na) / 7, 0, 3) : clamp((135 - s.na) / 30, 0, 1);
      if (cere > 1.5) emit(t, 'edema_cerebral');
      if (s.na >= 130 && treated) emit(t, 'na130');
      const active = ['agua', 'osmolalidad'];
      if (cere > 0.6) active.push('edema_cerebral');
      if (!acute) active.push('adaptacion');
      if (treated && s.bol > 0 && t <= 1.5) active.push('bolo');
      if (treated && t > 0 && dna > 0) active.push('correccion');
      if (s.ods > 0.2) active.push('ods');
      return { g: { na: s.na, posm: posmCalc(s.na), uosm, una, cerebro: cere, ods: s.ods, vic: 25 + 25 * (140 - s.na) / 140, adh: 0.8 },
        active, lesion: Math.max(cere / 3, s.ods / 3), badge: s.na < 125 ? 'grave' : s.ods > 0.5 ? 'ods' : null };
    });
  },

  // SIADH: ADH fixed despite low osmolality (uOsm > 100, uNa > 20–30, urate < 4, euvolaemia). Na settles where
  // water intake balances limited free-water excretion (Model target 140 − 6 × (intake − 1)).
  // Fluid restriction ≤ 1 L/day raises Na slowly; tolvaptan (V2 antagonist) causes aquaresis.
  siadh(p, treated) {
    return runner(E('siadh'), { na: 136 }, (s, t, dt, emit) => {
      const restr = treated && t >= 2;
      const tol = restr && p.tto === 'tolvaptan';
      if (restr) emit(t, tol ? 'tolvaptan' : 'restriccion');
      const target = tol ? 138 : restr ? 136 : 140 - 6 * (p.agua - 1);
      s.na += (target - s.na) * Math.min(1, dt / (tol ? 1.2 : 2.5));
      if (s.na < 130) emit(t, 'hipona');
      const uosm = tol ? 180 : 520;
      const active = ['adh', 'retencion_agua', 'euvolemia'];
      if (s.na < 135) active.push('hiponatremia');
      if (restr) active.push('tto');
      return { g: { na: s.na, posm: posmCalc(s.na), uosm, una: 45, urato: 3.2, vec: 15.3, adh: 1 }, active,
        lesion: clamp((140 - s.na) / 20, 0, 1), badge: 'siadh' };
    });
  },

  // Hypernatraemia: water deficit (extrarenal loss, central or nephrogenic DI, hypertonic intake) dehydrates cells
  // → CNS symptoms. Without water access Na keeps rising if losses continue. Treatment: free water to lower Na
  // over ~48 h (≤ 10–12 mEq/L/24 h) + desmopressin (central DI) or thiazide (nephrogenic DI).
  hipernatremia(p, treated) {
    const di = p.causa === 'di_central' || p.causa === 'di_nefrogenica';
    return runner(E('hipernatremia'), { na: p.na0, diur: di ? 8 : 0.6 }, (s, t, dt, emit) => {
      let dna = 0;
      if (!treated) dna = di || p.causa === 'extrarrenal' ? 0.08 : 0;
      else {
        if (t > 0) emit(0, 'agua_libre');
        dna = s.na > 142 ? -10 / 24 : 0;
        if (p.causa === 'di_central') { s.diur += (2 - s.diur) * Math.min(1, dt / 4); emit(1, 'desmopresina'); }
        if (p.causa === 'di_nefrogenica') { s.diur += (4.5 - s.diur) * Math.min(1, dt / 24); emit(1, 'tiazida'); }
      }
      if (t > 0) s.na = clamp(s.na + dna * dt, 135, 185);
      const uosm = p.causa === 'di_central' ? (treated ? 550 : 90) : p.causa === 'di_nefrogenica' ? (treated ? 220 : 110) : p.causa === 'extrarrenal' ? 800 : 600;
      const conc = clamp((s.na - 147) / 9, 0, 3);
      if (conc > 1.5) emit(t, 'snc');
      if (treated && s.na <= 145) emit(t, 'normal');
      const active = ['deficit_agua', 'osmolalidad'];
      if (s.na > 150) active.push('deshidratacion_celular');
      if (conc > 0.8) active.push('snc');
      if (treated) active.push('agua_libre');
      if (treated && (p.causa === 'di_central' || p.causa === 'di_nefrogenica')) active.push('especifico');
      return { g: { na: s.na, posm: posmCalc(s.na), uosm, diuresis: s.diur, conciencia: conc, vic: 25 - 25 * (s.na - 140) / 140,
        vec: p.causa === 'aporte' ? 16.5 : 14, adh: p.causa === 'di_central' && !treated ? 0 : 1 }, active,
        lesion: conc / 3, badge: s.na > 160 ? 'grave' : null };
    });
  },

  // Hyperkalaemia: arrhythmic risk rises with K (peaked T → long PR → wide QRS → arrest).
  // Treatment in order: IV calcium (membrane stabilisation in minutes, K unchanged, lasts ~1 h, repeated),
  // insulin + glucose and β2 agonist (K into cells from ~15–30 min, ~−1 and ~−0.7 mEq/L, wearing off by ~5 h),
  // bicarbonate if acidotic, then elimination (binders / dialysis from 1 h).
  hiperk(p, treated) {
    const drift = p.causa === 'erc' ? 0.06 : 0.03;
    return runner(E('hiperk'), { kTot: p.k0 }, (s, t, dt, emit) => {
      if (t > 0) s.kTot += (treated && t >= 1 ? (s.kTot > 4.5 ? -0.55 : 0) : drift) * dt;
      s.kTot = clamp(s.kTot, 3.2, 9.5);
      let shift = 0, ca = false;
      if (treated) {
        emit(0.05, 'calcio');
        ca = t >= 0.05;
        const on = (t0, tau, depth) => (t < t0 ? 0 : depth * (1 - Math.exp(-(t - t0) / tau)) * Math.exp(-Math.max(0, t - t0 - 2) / 2.5));
        shift = on(0.2, 0.35, 1.0) + on(0.2, 0.3, 0.7) + (p.causa === 'atr4' ? on(0.3, 0.6, 0.3) : 0);
        if (t >= 0.2) emit(0.2, 'insulina');
        if (t >= 1) emit(1, 'eliminacion');
      }
      const k = clamp(s.kTot - shift, 2.5, 9.5);
      const ecg = ecgRisk(k) * (ca ? 0.35 : 1);
      if (k > 6.5) emit(t, 'qrs');
      if (k <= 5.5) emit(t, 'k_normal');
      const active = [];
      if (k > 5.5) active.push('k_alto', 'membrana');
      if (k > 6) active.push('ecg_t');
      if (k > 6.5) active.push('ecg_qrs');
      if (ca) active.push('calcio');
      if (treated && t >= 0.2) active.push('redistribucion');
      if (treated && t >= 1) active.push('eliminacion');
      return { g: { k, ecg, qrs: qrsFromK(k) }, active, lesion: ecg / 3, badge: k > 6.5 ? 'urgente' : null };
    });
  },

  // Hypokalaemia: renal (diuretics) or digestive losses; hyperpolarisation → weakness, U waves, arrhythmias.
  // Replacement: oral 100–150 mEq/day (safest) or IV ≤ 10–20 mEq/h (faster). ~300 mEq per 1 mEq/L of deficit (Model).
  hipok(p, treated) {
    const loss = { diureticos: 0.12, digestivas: 0.15, ingesta: 0.04 }[p.causa];
    return runner(E('hipok'), { k: p.k0 }, (s, t, dt, emit) => {
      let dk = -loss;
      if (treated) { dk += p.via === 'iv' ? 240 / 300 : 120 / 300; emit(0, p.via === 'iv' ? 'iv' : 'oral'); }
      if (t > 0) s.k = clamp(s.k + (s.k > 4.3 && treated ? -0.05 : dk) * dt, 1.5, 4.5);
      const deb = clamp((3.5 - s.k) * 1.4, 0, 3);
      const ecg = clamp((3.2 - s.k) * 1.5, 0, 3);
      if (s.k < 2.5) emit(t, 'grave');
      if (treated && s.k >= 3.5) emit(t, 'k_normal');
      const active = ['perdida_k'];
      if (s.k < 3.5) active.push('hiperpolarizacion');
      if (s.k < 3) active.push('ecg_u');
      if (deb > 1) active.push('debilidad');
      if (treated) active.push('reposicion');
      return { g: { k: s.k, debilidad: deb, ecg }, active, lesion: deb / 3, badge: s.k < 2.5 ? 'grave' : null };
    });
  },
};

export function simulate(key, params, treated = false) {
  const e = ENTITIES.find(x => x.key === key);
  if (!e) throw new Error(`unknown entity ${key}`);
  const p = { ...defaults(key), ...params };
  return MODELS[key](p, treated && e.treat);
}

export const PRESETS = {
  gastroenteritis: { entity: 'deplecion', params: { perdidas: 5, inicio: 6 } },
  ic_descompensada: { entity: 'expansion', params: { causa: 'ic', sal: 12 } },
  hipona_cronica_anciana: { entity: 'hiponatremia', params: { na0: 116, cronicidad: 'cronica', sintomas: 'leves', causa: 'hipovolemica', velocidad: 8 } },
  sobrecorreccion: { entity: 'hiponatremia', params: { na0: 112, cronicidad: 'cronica', sintomas: 'leves', causa: 'siadh', velocidad: 16 } },
  maraton: { entity: 'hiponatremia', params: { na0: 122, cronicidad: 'aguda', sintomas: 'graves', causa: 'hipervolemica', velocidad: 8 } },
  siadh_pulmon: { entity: 'siadh', params: { agua: 2.5, tto: 'restriccion' } },
  siadh_tolvaptan: { entity: 'siadh', params: { agua: 3, tto: 'tolvaptan' } },
  di_central: { entity: 'hipernatremia', params: { causa: 'di_central', na0: 158 } },
  anciano_sin_acceso: { entity: 'hipernatremia', params: { causa: 'extrarrenal', na0: 162 } },
  hiperk_erc: { entity: 'hiperk', params: { k0: 7.4, causa: 'erc' } },
  hiperk_ieca: { entity: 'hiperk', params: { k0: 6.3, causa: 'farmacos' } },
  hipok_diureticos: { entity: 'hipok', params: { k0: 2.6, causa: 'diureticos', via: 'oral' } },
  hipok_grave_iv: { entity: 'hipok', params: { k0: 2.0, causa: 'digestivas', via: 'iv' } },
};
