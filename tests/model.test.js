import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTITIES, GAUGES, PRESETS, simulate, defaults, posmCalc } from '../src/model.js';
import { STR } from '../src/i18n.js';

const last = r => r.points[r.points.length - 1];
const at = (r, t) => r.points.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
const min = (r, g) => Math.min(...r.points.map(p => p.g[g]));
const max = (r, g) => Math.max(...r.points.map(p => p.g[g]));
const evs = r => r.events.map(e => e.key);

/* ---------- generic: every entity ---------- */
for (const e of ENTITIES) {
  test(`${e.key}: well-formed output (defaults, extremes, both arms)`, () => {
    const variants = [defaults(e.key)];
    for (const p of e.params.filter(q => q.type !== 'choice')) {
      variants.push({ ...defaults(e.key), [p.key]: p.min }, { ...defaults(e.key), [p.key]: p.max });
    }
    for (const p of e.params.filter(q => q.type === 'choice')) for (const o of p.options) variants.push({ ...defaults(e.key), [p.key]: o });
    for (const v of variants) for (const tr of [false, true]) {
      const r = simulate(e.key, v, tr);
      assert.equal(r.points.length, Math.round(e.tMax / e.dt) + 1);
      for (let i = 1; i < r.points.length; i++) assert.ok(r.points[i].t > r.points[i - 1].t);
      for (const pt of r.points) {
        for (const g of [...e.tiles, ...e.charts]) {
          assert.ok(Number.isFinite(pt.g[g]) && pt.g[g] >= 0, `${e.key} ${g}=${pt.g[g]}`);
          assert.ok(GAUGES[g], `gauge ${g} defined`);
        }
        for (const a of pt.active) assert.ok(e.steps.includes(a), `${e.key} unknown step ${a}`);
        assert.ok(pt.lesion >= 0 && pt.lesion <= 1);
      }
      for (const ev of r.events) assert.ok(ev.t >= 0 && ev.t <= e.tMax);
    }
  });
}

test('pure: same input → same output, params not mutated', () => {
  for (const e of ENTITIES) {
    const p = defaults(e.key); const copy = JSON.stringify(p);
    assert.deepEqual(simulate(e.key, p, true), simulate(e.key, p, true));
    assert.equal(JSON.stringify(p), copy);
  }
});

test('calculated plasma osmolality ≈ 2·Na + glucose/18 + urea/6 (normal ≈ 290)', () => {
  assert.ok(Math.abs(posmCalc(140) - 290) < 1);
});

test('i18n: every key used by the model exists in ES and EN', () => {
  for (const lang of ['es', 'en']) {
    const S = STR[lang];
    for (const e of ENTITIES) {
      const E = S.ent[e.key];
      for (const f of ['name', 'what', 'params', 'sees', 'tto']) assert.ok(E[f], `${lang} ${e.key}.${f}`);
      for (const st of e.steps) assert.ok(E.steps[st], `${lang} step ${e.key}.${st}`);
      for (const p of e.params) {
        assert.ok(S.params[p.key], `${lang} param ${p.key}`);
        if (p.type === 'choice') for (const o of p.options) assert.ok(S.choice[p.key][o], `${lang} choice ${p.key}.${o}`);
      }
      for (const g of [...e.tiles, ...e.charts]) assert.ok(S.gauges[g], `${lang} gauge ${g}`);
      assert.ok(S.units[e.unit]);
      for (const tr of [false, true]) {
        const r = simulate(e.key, defaults(e.key), tr);
        for (const ev of r.events) assert.equal(typeof S.ev[ev.key], 'function', `${lang} event ${ev.key}`);
        for (const pt of r.points) if (pt.badge) assert.ok(S.badge[pt.badge], `${lang} badge ${pt.badge}`);
      }
    }
    for (const k of Object.keys(PRESETS)) assert.ok(S.presets[k], `${lang} preset ${k}`);
  }
});

/* ---------- presets ---------- */
test('presets reference valid entities and parameters', () => {
  for (const [k, pr] of Object.entries(PRESETS)) {
    const e = ENTITIES.find(x => x.key === pr.entity);
    assert.ok(e, k);
    for (const pk of Object.keys(pr.params)) assert.ok(e.params.some(p => p.key === pk), `${k}.${pk}`);
    for (const ev of [...simulate(pr.entity, pr.params, false).events, ...simulate(pr.entity, pr.params, true).events]) {
      assert.equal(typeof STR.es.ev[ev.key], 'function', `${k} event ${ev.key}`);
    }
  }
});

/* ---------- mechanisms ---------- */
const ev = (r, k) => r.events.find(e => e.key === k);

test('volume depletion: ECF and BP fall with normal sodium; saline restores them', () => {
  const u = simulate('deplecion', PRESETS.gastroenteritis.params, false);
  assert.ok(last(u).g.vec < 11 && last(u).g.pas < 90 && max(u, 'na') === 140 && min(u, 'na') === 140);
  assert.ok(ev(u, 'prerrenal'));
  const t = simulate('deplecion', PRESETS.gastroenteritis.params, true);
  assert.ok(last(t).g.vec > 14.5 && min(t, 'pas') > 105);
});

test('volume expansion: oedema with dilutional hyponatraemia; salt restriction + loop diuretic reverse it', () => {
  const u = simulate('expansion', PRESETS.ic_descompensada.params, false);
  assert.ok(last(u).g.vec > 20 && last(u).g.na < 135);
  assert.ok(last(simulate('expansion', PRESETS.ic_descompensada.params, true)).g.vec < 16);
  assert.ok(last(simulate('expansion', { sal: 4 })).g.vec < last(u).g.vec);
});

test('hyponatraemia: acute → brain oedema that worsens; chronic → adapted brain', () => {
  const a = simulate('hiponatremia', PRESETS.maraton.params, false);
  assert.ok(last(a).g.cerebro > 2 && last(a).g.na < a.points[0].g.na);
  const c = simulate('hiponatremia', PRESETS.hipona_cronica_anciana.params, false);
  assert.ok(max(c, 'cerebro') < 1 && last(c).g.na === c.points[0].g.na);
});

test('hyponatraemia: 6–8 mEq/L/24 h is safe; > 10 mEq/L/24 h causes demyelination risk', () => {
  const safe = simulate('hiponatremia', PRESETS.hipona_cronica_anciana.params, true);
  assert.ok(max(safe, 'ods') === 0 && last(safe).g.na >= 129.9);
  const rise24 = at(safe, 24).g.na - safe.points[0].g.na;
  assert.ok(rise24 <= 8.01);
  const fast = simulate('hiponatremia', PRESETS.sobrecorreccion.params, true);
  assert.ok(max(fast, 'ods') > 1.5 && ev(fast, 'ods'));
  const acuteFast = simulate('hiponatremia', { ...PRESETS.maraton.params, velocidad: 16 }, true);
  assert.equal(max(acuteFast, 'ods'), 0, 'acute hyponatraemia carries no demyelination risk');
});

test('hyponatraemia: severe symptoms → up to three 3 % saline boluses in the first hours', () => {
  const t = simulate('hiponatremia', PRESETS.maraton.params, true);
  const bolos = t.events.filter(e => e.key.startsWith('bolo'));
  assert.equal(bolos.length, 3);
  assert.ok(bolos.every(b => b.t <= 1.5));
  assert.ok(at(t, 2).g.cerebro < t.points[0].g.cerebro);
});

test('SIADH: euvolaemic, uOsm > 100, uNa > 20, urate < 4; more water → lower Na; restriction / tolvaptan raise it', () => {
  const u = simulate('siadh', PRESETS.siadh_tolvaptan.params, false);
  const p = last(u).g;
  assert.ok(p.uosm > 100 && p.una > 20 && p.urato < 4 && p.posm < 270);
  assert.ok(last(simulate('siadh', { agua: 3.5 })).g.na < last(simulate('siadh', { agua: 1.5 })).g.na);
  assert.ok(last(simulate('siadh', PRESETS.siadh_pulmon.params, true)).g.na > last(simulate('siadh', PRESETS.siadh_pulmon.params, false)).g.na + 3);
  assert.ok(last(simulate('siadh', PRESETS.siadh_tolvaptan.params, true)).g.uosm < 300);
});

test('hypernatraemia: DI → polyuria with dilute urine; free water lowers Na ≈ 10 mEq/L/day; desmopressin fixes central DI', () => {
  const u = simulate('hipernatremia', PRESETS.di_central.params, false);
  assert.ok(last(u).g.na > 160 && last(u).g.diuresis > 6 && last(u).g.uosm < 150);
  const t = simulate('hipernatremia', PRESETS.di_central.params, true);
  const drop24 = t.points[0].g.na - at(t, 24).g.na;
  assert.ok(drop24 > 8 && drop24 <= 10.5);
  assert.ok(last(t).g.diuresis < 2.5 && last(t).g.na <= 145);
  const n = simulate('hipernatremia', { causa: 'di_nefrogenica' }, true);
  assert.ok(last(n).g.diuresis < 6 && last(n).g.diuresis > 3, 'thiazide partly reduces nephrogenic DI polyuria');
  assert.ok(last(simulate('hipernatremia', PRESETS.anciano_sin_acceso.params, false)).g.uosm > 700);
});

test('hyperkalaemia: ECG risk rises with K; calcium protects within minutes, insulin/β2 lower K by ~30 min, elimination after', () => {
  assert.ok(simulate('hiperk', { k0: 8 }).points[0].g.ecg > simulate('hiperk', { k0: 6 }).points[0].g.ecg);
  const t = simulate('hiperk', PRESETS.hiperk_erc.params, true);
  assert.ok(at(t, 0.1).g.ecg < t.points[0].g.ecg * 0.5, 'calcium cuts arrhythmic risk');
  assert.ok(Math.abs(at(t, 0.1).g.k - t.points[0].g.k) < 0.1, 'calcium does not lower K');
  assert.ok(at(t, 1).g.k < t.points[0].g.k - 1);
  assert.ok(last(t).g.k <= 5 && last(t).g.k >= 3.5);
  assert.ok(last(simulate('hiperk', PRESETS.hiperk_erc.params, false)).g.qrs > 110);
});

test('hypokalaemia: diuretic losses keep lowering K; IV replacement is faster than oral', () => {
  const u = simulate('hipok', PRESETS.hipok_diureticos.params, false);
  assert.ok(last(u).g.k < u.points[0].g.k && max(u, 'debilidad') > 2);
  const o = simulate('hipok', { k0: 2.2, via: 'oral' }, true), i = simulate('hipok', { k0: 2.2, via: 'iv' }, true);
  assert.ok(at(i, 2).g.k > at(o, 2).g.k && at(i, 2).g.k > 3.3);
  assert.ok(last(o).g.k <= 4.5 && last(o).g.k >= 3.5);
});
