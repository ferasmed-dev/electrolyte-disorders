// Schematic: body-water compartments (intracellular / interstitial / plasma) with Na⁺, a neuron that swells or
// shrinks with osmolality, the collecting duct with ADH-driven aquaporin-2 channels, and a live ECG beat drawn
// from serum K⁺. The site of the selected entity is highlighted.
export function drawSchematic(box, e, pt, tr) {
  const g = pt.g;
  const hot = 'var(--hot)';
  const on = (loc) => e.loc === loc;
  const cls = (loc) => (on(loc) ? 'lbl-on' : '');
  const px = 5.6;                                   // px per litre
  const base = 196;
  const vic = Math.max(18, Math.min(32, g.vic)), vec = Math.max(8, Math.min(26, g.vec));
  const vint = vec * 2 / 3, vpl = vec / 3;
  const tank = (x, w, litres, label, hl) => `
    <rect x="${x}" y="${base - 32 * px}" width="${w}" height="${32 * px}" rx="6" fill="none" stroke="var(--axis)"/>
    <rect x="${x}" y="${base - litres * px}" width="${w}" height="${litres * px}" rx="6" fill="var(--cyst)" stroke="${hl ? hot : 'var(--s1)'}" stroke-width="${hl ? 2.5 : 1.2}"/>
    <text x="${x + w / 2}" y="${base + 16}" text-anchor="middle" class="${hl ? 'lbl-on' : ''}">${label}</text>
    <text x="${x + w / 2}" y="${base - litres * px + 16}" text-anchor="middle" style="font-weight:700;fill:var(--ink)">${litres.toFixed(1)} L</text>`;
  // neuron size follows intracellular volume
  const r = 26 * Math.cbrt(vic / 25);
  // ECG beat
  const k = g.k;
  const tH = Math.max(6, Math.min(48, 12 + (k - 4.2) * 14));
  const uH = k < 3.5 ? Math.min(14, (3.5 - k) * 10) : 0;
  const qrsW = Math.max(6, (g.qrs || 90) / 10);
  const beat = (x0) => `M${x0} 238 h10 q5 -6 10 0 h8 l${qrsW / 3} 6 l${qrsW / 3} -34 l${qrsW / 3} 40 l4 -12 h14 q${k > 5.5 ? 4 : 10} ${-tH} ${k > 5.5 ? 8 : 20} 0 h6 ${uH ? `q6 ${-uH} 12 0` : 'h12'} h20`;
  const aqp = Math.round((g.adh ?? 0.4) * 8);
  box.innerHTML = `
<svg viewBox="0 0 700 260" role="img" aria-label="${tr('schem.aria')}">
  ${tank(20, 110, vic, tr('schem.lic'), on('cerebro'))}
  ${tank(150, 80, vint, tr('schem.intersticial'), on('vec'))}
  ${tank(250, 60, vpl, tr('schem.plasma'), on('vec'))}
  <text x="250" y="22" text-anchor="middle" style="font-size:14px;font-weight:700;fill:var(--ink)">Na⁺ ${Math.round(g.na)} · K⁺ ${g.k.toFixed(1)}</text>
  <text x="250" y="38" text-anchor="middle">mEq/L</text>
  <circle cx="390" cy="70" r="${r}" fill="var(--tissue)" stroke="${on('cerebro') ? hot : 'var(--tissue-line)'}" stroke-width="${on('cerebro') ? 3 : 2}"/>
  <path d="M${390 + r} 70 h30 M${390 - r} 70 h-20" stroke="var(--tissue-line)" stroke-width="3"/>
  <text x="390" y="${70 + r + 16}" text-anchor="middle" class="${cls('cerebro')}">${tr('schem.neurona')}</text>
  <rect x="470" y="20" width="200" height="70" rx="10" fill="none" stroke="${on('colector') ? hot : 'var(--tissue-line)'}" stroke-width="${on('colector') ? 2.5 : 1.5}"/>
  <text x="480" y="38" class="${cls('colector')}">${tr('schem.colector')}</text>
  ${Array.from({ length: 8 }, (_, i) => `<rect x="${482 + i * 22}" y="54" width="12" height="22" rx="3" fill="var(--s1)" opacity="${i < aqp ? 0.9 : 0.12}"/>`).join('')}
  <text x="570" y="106" text-anchor="middle">ADH ${Math.round((g.adh ?? 0) * 100)} % · AQP2</text>
  <rect x="360" y="190" width="320" height="64" rx="8" fill="none" stroke="${on('corazon') ? hot : 'var(--axis)'}" stroke-width="${on('corazon') ? 2.5 : 1}"/>
  <text x="368" y="206" class="${cls('corazon')}">${tr('schem.ecg')}</text>
  <path d="${beat(368)} ${beat(468).replace('M', 'M')} ${beat(568)}" fill="none" stroke="${k > 5.5 || k < 3.5 ? hot : 'var(--s1)'}" stroke-width="2"/>
</svg>`;
}
