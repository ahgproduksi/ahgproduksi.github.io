/* Mesin HPP & Price List (mengikuti RAPU-BUASO): parameter, biaya harian, BUASO/BOM, ongkos gendong, harga Loco/Franco/Tergelar.
   Kartu 13 Price List dan Kartu 14 HPP & BUASO. */
'use strict';
const PARAM_ID = 'prmBawenHPP01'; // id tetap; data per basecamp dipisah di server (bc_docs kunci bc+id)
const MEMO = { v: -1, m: new Map() };
function memo(key, fn) { if (MEMO.v !== S.ver) { MEMO.v = S.ver; MEMO.m.clear(); } if (!MEMO.m.has(key)) MEMO.m.set(key, fn()); return MEMO.m.get(key); }
const clone = o => JSON.parse(JSON.stringify(o));
function params() {
  return memo('params', () => {
    const p = clone(window.PDEF), d = get(PARAM_ID);
    if (d) {
      Object.assign(p.global, d.global || {});
      UNITS.forEach(u => { if (d.unit && d.unit[u]) Object.assign(p.unit[u], d.unit[u]); });
      if (d.kend && d.kend.length) p.kend = d.kend;
      if (d.zona && d.zona.length === 10) p.zona = d.zona;
      if (d.gelar) Object.assign(p.gelar, d.gelar);
    }
    return p;
  });
}
function saveParams(mut) {
  const d = clone(get(PARAM_ID) || {});
  delete d.id; delete d._by; delete d._at; delete d._cr;
  mut(d);
  save('param', d, PARAM_ID);
}
function dailyOf(u, p) {
  const x = p.unit[u], g = p.global;
  const hariThn = (g.hari || 25) * (g.bulan || 12);
  return {
    kapT: +x.kap || 0, ef: +x.ef || 0, kapEf: (+x.kap || 0) * (+x.ef || 0),
    upah: sum(x.upah || [], r => (+r[1] || 0) * (+r[2] || 0)), org: sum(x.upah || [], r => +r[2] || 0),
    bbmL: sum(x.alat || [], r => (+r[1] || 0) * (+r[2] || 0) * (+r[3] || 0)),
    maint: sum(x.maint || [], r => +r[1] || 0) / hariThn, maintThn: sum(x.maint || [], r => +r[1] || 0),
    sub: +x.sub || 0, oh: +x.oh || 0
  };
}
const DAILY0 = {}; UNITS.forEach(u => DAILY0[u] = dailyOf(u, window.PDEF));
const daily = u => memo('daily' + u, () => dailyOf(u, params()));
const bungaF = () => { const g = params().global; return (+g.bunga || 0) / 12 * (+g.masa || 0); };
const solarInd = () => (latestPrice('Solar Industri') || { harga: 19594.59 }).harga;
const bioSolar = () => (latestPrice('Bio Solar') || { harga: 6800 }).harga;
const ceilTo = (x, r) => r > 0 ? Math.ceil(x / r) * r : Math.ceil(x - 1e-7);

/* harga dasar katalog (= nilai sheet) untuk faktor penyesuaian */
const BASE_HPP = {};
UNITS.forEach(u => (K.unit[u] || []).forEach(p => { BASE_HPP[u + '|' + p.n] = sum(p.b, l => l[3] * l[4]) * (1 + 0.11 / 12 * 2); }));
const INTERNAL = { 'split 1/1': ['SCP', 'Split 1/1'], 'split 1/2': ['SCP', 'Split 1/2'], 'split 2/3': ['SCP', 'Split 2/3'], 'split 3/5': ['SCP', 'Split 3/5'], 'abu batu': ['SCP', 'Abu Batu'], 'pasir (hasil scp)': ['SCP', 'Pasir (Hasil SCP)'], 'ladu / ondol': ['SCP', 'Ladu / Ondol'], 'beton readymix k-350': ['CMP', 'K-350'], 'beton readymix k-300': ['CMP', 'K-300'] };
function lineType(nama, komp) {
  const n = String(nama).toLowerCase();
  if (komp === 'B') return 'B';
  if (/^solar industri/.test(n)) return 'BBM';
  if (/^upah/.test(n)) return 'U';
  if (/^maintenance/.test(n)) return 'MT';
  if (/^subkon/.test(n)) return 'S';
  if (/^overhead/.test(n)) return 'O';
  return komp;
}
function userPrice(nm) { const k = nm.toLowerCase(); return all('harga').filter(d => String(d.mat).toLowerCase() === k).sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)) || String(b._at).localeCompare(String(a._at)))[0] || null; }
function priceForLine(l, depth = 0) {
  const nm = canon(l[0]);
  const up = userPrice(nm);
  const mi = minfo(nm);
  if (up) return { harga: up.harga * conv(1, l[2], up.sat, mi && mi.bj), src: 'Kartu Bahan ' + tgl(up.tgl) };
  const it = INTERNAL[nm.toLowerCase()];
  if (it && depth < 3) {
    const c = hppCalc(it[0], it[1], depth + 1), base = BASE_HPP[it[0] + '|' + it[1]];
    if (c && base) { const mTr = +params().global.mTr || 0; const f = (c.hpp / (1 - mTr)) / (base / 0.95); return { harga: l[4] * f, src: 'Harga transfer ' + it[0] + ' (HPP+bunga / (1 - ' + pct(mTr) + '))' }; }
  }
  return { harga: l[4], src: 'Master Bahan (acuan RAPU)' };
}
function hppCalc(u, n, depth = 0) {
  return memo('hpp|' + u + '|' + n, () => {
    const p = productFind(u, n);
    if (!p) return null;
    const d = daily(u), d0 = DAILY0[u];
    const per = (k, dd) => dd.kapEf ? dd[k] / dd.kapEf : 0;
    const fac = k => per(k, d0) ? per(k, d) / per(k, d0) : null;
    const bs = { B: 0, U: 0, A: 0, S: 0, O: 0 };
    const lines = p.b.map(l => {
      const t = lineType(l[0], l[1]);
      let koef = +l[3] || 0, harga = +l[4] || 0, src = '';
      if (t === 'B') { const pr = priceForLine(l, depth); harga = pr.harga; src = pr.src; }
      else if (t === 'BBM') { const f = fac('bbmL'); koef = f == null ? per('bbmL', d) : koef * f; harga = priceForLine(l, depth).harga; src = 'Liter/hari / kapasitas efektif x harga Solar Industri'; }
      else { const key = { U: 'upah', MT: 'maint', S: 'sub', O: 'oh' }[t]; if (key) { const f = fac(key); harga = f == null ? per(key, d) : harga * f; src = 'Biaya harian / kapasitas efektif'; } }
      const biaya = koef * harga;
      bs[l[1]] = (bs[l[1]] || 0) + biaya;
      return { nama: l[0], komp: l[1], sat: l[2], koef, harga, biaya, stok: isStockLine(l), src };
    });
    const cogs = bs.B + bs.U + bs.A + bs.S + bs.O, bunga = cogs * bungaF();
    const r = { p, unit: u, lines, buaso: bs, cogs, bunga, hpp: cogs + bunga, sat: p.s };
    r.harga = { bc: plLoco(r, 'bc'), int: plLoco(r, 'int'), ext: plLoco(r, 'ext') };
    return r;
  });
}
const TIER = { bc: ['mBC', 'Loco Basecamp'], int: ['mInt', 'Internal / Proyek HO'], ext: ['mExt', 'Eksternal / Retail'] };
const margin = t => +params().global[TIER[t][0]] || 0;
function pasarOf(c) { return c.unit === 'PCP' ? (+c.p.h[2] || +c.p.h[0] || 0) : 0; }
function locoRaw(c, t) {
  const buaso = c.hpp / (1 - margin(t));
  if (c.unit !== 'PCP') return buaso;
  const ds = params().global.dasarPCP, ps = pasarOf(c);
  return ds === 'BUASO' || !ps ? buaso : ds === 'Pasar' ? ps : Math.max(buaso, ps);
}
function plLoco(c, t) { return ceilTo(locoRaw(c, t), +params().global.round || 0); }
function plPrice(u, n, t) { const c = hppCalc(u, n); return c ? c.harga[t] : 0; }

/* ongkos gendong */
function ongkir(k, zi) {
  const z = params().zona[zi] || 0, pp = z * 2;
  const cyc = (+k.muat || 0) + (k.speed ? pp / k.speed : 0);
  const rit = Math.max(1, Math.min(+k.rit || 1, Math.floor((+k.jam || 0) / (cyc || 1))));
  const bbmL = k.kmL ? pp / k.kmL : 0, bbmRp = bbmL * bioSolar();
  const sewaSat = ((+k.sewa || 0) + (+k.sopir || 0)) / ((+k.kap || 1) * rit), bbmSat = bbmRp / (+k.kap || 1);
  return { z, pp, cyc, rit, bbmL, bbmRp, muatan: (+k.kap || 0) * rit, sewaSat, bbmSat, total: sewaSat + bbmSat };
}
function gelarPerTon() {
  const g = params().gelar;
  const sewa = sum(g.alat || [], r => (+r[1] || 0) * (+r[3] || 0)) / (+g.kap || 1);
  const bbmL = sum(g.alat || [], r => (+r[1] || 0) * (+r[2] || 0));
  return { sewa, bbmL, bbm: bbmL * solarInd(), upah: +g.upah || 0, total: sewa + bbmL * solarInd() + (+g.upah || 0) };
}
const kendFor = u => params().kend.filter(k => u === 'CMP' ? k.sat === 'M3' : k.sat !== 'M3');
const FC = { 'B-0': 0, 'K-100': 8, 'K-125': 10, 'K-150': 12, 'K-175': 15, 'K-200': 17, 'K-225': 19, 'K-250': 21, 'K-275': 23, 'K-300': 25, 'K-325': 27, 'K-350': 29, 'K-375': 31, 'K-400': 33, 'K-425': 35, 'K-450': 37, 'K-475': 39, 'K-500': 42, 'FS-45': 29, 'FS-47': 30 };
const BJ_LP = { 'LPA (Gembur)': 1.45996, 'LPB (Gembur)': 1.4575, 'LPS (Gembur)': 1.1454, 'CTB (Gembur)': 1.4523092 };
function bjOf(n) { if (BJ_LP[n]) return BJ_LP[n]; const mi = minfo(n); return mi && mi.bj ? mi.bj : 1; }
function pcpBerat(c) { const b = c.lines.find(l => /beton readymix/i.test(l.nama)); return b ? b.koef * (+params().global.bjPCP || 2400) / 1000 : 0; }
function pcpSplit(n) { const m = String(n).match(/^(.*?)\s+(\d.*)$/); return m ? [m[1], m[2]] : [n, '-']; }
/* satu baris price list: loco, franco per zona, tergelar per zona (AMP) */
function plRow(u, n, t, o) {
  const c = hppCalc(u, n); if (!c) return null;
  const f = o.ppn ? 1 + (+params().global.ppn || 0) : 1, r = +params().global.round || 0;
  let base = locoRaw(c, t), mult = 1, satLbl = c.sat;
  if (u === 'SCP') {
    const bj = bjOf(n);
    if (o.sat === 'M3' && c.sat === 'Ton') { base *= bj; satLbl = 'M3'; }
    if (o.sat === 'Ton' && c.sat === 'M3') { base /= bj; satLbl = 'Ton'; }
    mult = satLbl === 'M3' ? bj : 1;
  }
  if (u === 'PCP') mult = pcpBerat(c);
  const k = params().kend.find(x => x.id === o.kend) || kendFor(u)[0];
  const og = params().zona.map((_, i) => ongkir(k, i).total * mult);
  const gl = u === 'AMP' ? gelarPerTon().total / (1 - margin(t)) : 0;
  return { c, n, sat: satLbl, loco: ceilTo(base * f, r), franco: og.map(x => ceilTo((base + x) * f, r)), tergelar: u === 'AMP' ? og.map(x => ceilTo((base + x + gl) * f, r)) : null, og, k };
}

/* =================== 13. PRICE LIST =================== */
const PL_TITLE = { AMP: 'Price List Hotmix - Asphalt Mixing Plant (AMP)', CMP: 'Price List Beton Readymix - Concrete Mixing Plant (CMP)', SCP: 'Price List Agregat - Stone Crusher Plant (SCP)', PCP: 'Price List Precast - Precast Concrete Plant (PCP)' };
MODS.pl = {
  title: 'Price List', icon: 'tag', desc: 'Harga Loco, Franco per zona & Tergelar — terhubung ke HPP, jobmix, dan harga bahan',
  render(root) {
    const st = stateOf('pl', { unit: 'AMP', tier: 'all', ppn: false, kend: '', sat: 'Ton', berlaku: 30 });
    if (!UNITS.includes(st.unit)) st.unit = 'AMP';
    return page(root, {
      key: 'pl', st, report: plReport,
      actions: [{ id: 'hpp', t: 'Parameter HPP', icon: 'scale' }],
      on: { hpp: () => { location.hash = '#/hpp'; } },
      filter: s => {
        const ks = kendFor(s.unit); if (!ks.some(k => k.id === s.kend)) s.kend = (ks.find(k => k.id === 'TR20') || ks[0] || {}).id;
        return '<div class="fbar plbar">' +
          '<div class="seg" data-ps="unit">' + UNITS.map(u => '<button class="' + (s.unit === u ? 'on' : '') + '" data-v="' + u + '">' + u + '</button>').join('') + '</div>' +
          '<select data-fk="tier"><option value="all">Semua harga (BC, Internal, Eksternal)</option>' + Object.entries(TIER).map(([k, v]) => '<option value="' + k + '"' + (s.tier === k ? ' selected' : '') + '>' + v[1] + '</option>').join('') + '</select>' +
          '<div class="seg" data-ps="ppn"><button class="' + (!s.ppn ? 'on' : '') + '" data-v="0">Exclude PPN</button><button class="' + (s.ppn ? 'on' : '') + '" data-v="1">Include PPN ' + nf0.format((params().global.ppn || 0) * 100) + '%</button></div>' +
          '<label class="inl">Kendaraan<select data-fk="kend">' + ks.map(k => '<option value="' + k.id + '"' + (s.kend === k.id ? ' selected' : '') + '>' + esc(k.nama) + '</option>').join('') + '</select></label>' +
          (s.unit === 'SCP' ? '<div class="seg" data-ps="sat"><button class="' + (s.sat !== 'M3' ? 'on' : '') + '" data-v="Ton">Per Ton</button><button class="' + (s.sat === 'M3' ? 'on' : '') + '" data-v="M3">Per M3</button></div>' : '') +
          '</div>';
      },
      bindFilter: (el, s, redraw) => $$('[data-ps] button', el).forEach(b => b.onclick = () => { const k = b.parentElement.dataset.ps; s[k] = k === 'ppn' ? b.dataset.v === '1' : b.dataset.v; persist('pl'); redraw(); }),
      body: s => plHtml(s)
    });
  },
  summary() { const k = (params().kend.find(x => x.id === 'TR20') || {}).id; const r = plRow('AMP', 'AC WC', 'ext', { kend: k }); return { main: 'AC-WC Loco ' + rp(r ? r.loco : 0), sub: 'Eksternal, excl. PPN · 4 unit · 10 zona' }; }
};
function plHead(s, u) {
  const k = params().kend.find(x => x.id === s.kend) || kendFor(u)[0];
  const ppnTxt = s.ppn ? 'Harga sudah termasuk PPN ' + nf0.format(params().global.ppn * 100) + '%' : 'Harga belum termasuk PPN ' + nf0.format(params().global.ppn * 100) + '%';
  const sat = u === 'AMP' ? 'per ton' : u === 'CMP' ? 'per m3' : u === 'SCP' ? 'per ' + (s.sat === 'M3' ? 'm3' : 'ton') : 'per pcs';
  return { k, ppnTxt, sat, line: BC + '  |  Harga ' + sat + ', ' + ppnTxt.replace('Harga ', '') + (k ? '  |  Pengiriman dengan ' + k.nama : '') };
}
function plHtml(s) {
  const u = s.unit, h = plHead(s, u), z = params().zona;
  const tiers = s.tier === 'all' ? ['bc', 'int', 'ext'] : [s.tier];
  const prods = products(u);
  const zh = z.map((km, i) => '<th>Zona ' + (i + 1) + '<small>' + (i ? z[i - 1] : 0) + ' - ' + km + ' Km</small></th>').join('');
  let html = '<section class="plsheet card"><div class="plkop"><img src="assets/logo.png" alt=""><div><b>PT. ARMADA HADA GRAHA</b><h2>' + esc(PL_TITLE[u].toUpperCase()) + '</h2><p>' + esc(h.line) + '</p><p>Tanggal : ' + tgl(today(), true) + '  ·  Berlaku sampai : ' + tgl(addDays(today(), s.berlaku || 30), true) + '</p></div><span class="ppnbadge ' + (s.ppn ? 'inc' : '') + '">' + (s.ppn ? 'INCLUDE' : 'EXCLUDE') + ' PPN ' + nf0.format(params().global.ppn * 100) + '%</span></div>' +
    (h.k && h.k.asumsi ? '<div class="note">Data ' + esc(h.k.nama) + ' adalah asumsi (tidak ada di sheet RAPU-BUASO). Sesuaikan sewa, sopir, dan konsumsi BBM di Kartu HPP, tab Ongkos Gendong.</div>' : '');
  tiers.forEach((t, ti) => {
    const m = margin(t);
    const title = (ti + 1) + '. HARGA ' + TIER[t][1].toUpperCase() + ' - ' + h.sat.toUpperCase();
    if (u === 'PCP') {
      html += '<h3 class="plh">' + esc(title) + '</h3><div class="tbl"><table class="pl"><thead><tr><th rowspan="2">No</th><th rowspan="2">Produk</th><th rowspan="2">Dimensi</th><th rowspan="2" class="hl">Loco (dipakai)</th><th colspan="10">Terkirim (Franco on Truck)</th></tr><tr>' + zh + '</tr></thead><tbody>' +
        prods.map((p, i) => { const r = plRow(u, p.n, t, s); if (!r) return ''; const [a, b] = pcpSplit(p.n); return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(a) + '</td><td>' + esc(b) + '</td><td class="n hl">' + nf0.format(r.loco) + '</td>' + r.franco.map(x => '<td class="n">' + nf0.format(x) + '</td>').join('') + '</tr>'; }).join('') + '</tbody></table></div>';
      return;
    }
    html += '<h3 class="plh">' + esc(title) + '</h3><div class="tbl"><table class="pl"><thead><tr><th rowspan="2">No</th><th rowspan="2">' + (u === 'CMP' ? 'Mutu Beton' : u === 'AMP' ? 'Jenis Hotmix' : 'Produk') + '</th>' + (u === 'CMP' ? '<th rowspan="2">fc (MPa)</th>' : '') + '<th rowspan="2" class="hl">Loco</th><th colspan="10">Terkirim (Franco on Truck)</th>' + (u === 'AMP' ? '<th colspan="10" class="tg">Tergelar</th>' : '') + '</tr><tr>' + zh + (u === 'AMP' ? zh.replace(/<th>/g, '<th class="tg">') : '') + '</tr></thead><tbody>' +
      prods.map((p, i) => { const r = plRow(u, p.n, t, s); if (!r) return ''; return '<tr><td class="c">' + (i + 1) + '</td><td class="strong">' + esc(p.n) + '</td>' + (u === 'CMP' ? '<td class="c">' + (FC[p.n] ?? '-') + '</td>' : '') + '<td class="n hl">' + nf0.format(r.loco) + '</td>' + r.franco.map(x => '<td class="n">' + nf0.format(x) + '</td>').join('') + (r.tergelar ? r.tergelar.map(x => '<td class="n tg">' + nf0.format(x) + '</td>').join('') : '') + '</tr>'; }).join('') + '</tbody></table></div>';
  });
  const g = params().global;
  html += '<div class="plnote"><b>Dasar perhitungan</b><ol><li>Loco = (HPP + Bunga) / (1 - Margin). Bunga = HPP x ' + pct(g.bunga) + ' / 12 x ' + num(g.masa) + ' bulan.</li><li>Franco = Loco + ongkos gendong per satuan (tanpa margin), dihitung dari sewa, sopir, BBM, kecepatan, dan ritase kendaraan per zona.</li>' +
    (u === 'AMP' ? '<li>Tergelar = Franco + biaya gelar (' + rp(gelarPerTon().total) + '/ton) / (1 - Margin).</li>' : '') + (u === 'SCP' ? '<li>Agregat per M3 = harga per Ton x berat jenis; ongkir per M3 = ongkir per Ton x berat jenis.</li>' : '') +
    (u === 'PCP' ? '<li>Harga dipakai = ' + esc(g.dasarPCP) + ' antara harga BUASO dan harga pasar. Ongkir precast = ongkir per Ton x berat produk (volume beton x ' + nf0.format(g.bjPCP) + ' kg/m3).</li>' : '') +
    '<li>HPP mengikuti komposisi jobmix (Kartu Produksi), harga bahan terbaru (Kartu Bahan), dan biaya harian unit (Kartu HPP).</li></ol></div></section>';
  return html;
}
async function plReport(s) {
  const u = s.unit, h = plHead(s, u), z = params().zona;
  const R = await pdfReport({ title: PL_TITLE[u], sub: h.line + ' | Berlaku ' + tgl(today()) + ' s.d. ' + tgl(addDays(today(), s.berlaku || 30)), orient: 'l', fname: 'Price_List_' + u + (s.ppn ? '_incl_PPN' : '_excl_PPN') });
  const tiers = s.tier === 'all' ? ['bc', 'int', 'ext'] : [s.tier];
  const zl = z.map((km, i) => 'Z' + (i + 1) + '\n' + (i ? z[i - 1] : 0) + '-' + km);
  const cs = {}; for (let i = 2; i < 24; i++) cs[i] = { halign: 'right' }; cs[0] = { halign: 'center', cellWidth: 7 };
  tiers.forEach((t, ti) => {
    const m = margin(t), title = (ti + 1) + '. Harga ' + TIER[t][1] + ' - ' + h.sat;
    const prods = products(u);
    if (u === 'PCP') {
      R.h2(title, h.ppnTxt);
      R.table(['No', 'Produk', 'Dimensi', 'Loco'].concat(zl), prods.map((p, i) => { const r = plRow(u, p.n, t, s); const [a, b] = pcpSplit(p.n); return [i + 1, a, b, { content: R_(r.loco), styles: { fontStyle: 'bold' } }].concat(r.franco.map(R_)); }), { fs: 6.2, cs: Object.assign({}, cs, { 1: {}, 2: {} }) });
      return;
    }
    const first = u === 'CMP' ? ['No', 'Mutu', 'fc', 'Loco'] : ['No', u === 'AMP' ? 'Jenis Hotmix' : 'Produk', 'Loco'];
    R.h2(title + (u === 'AMP' ? ' - Loco & Terkirim' : ''), h.ppnTxt);
    R.table(first.concat(zl), prods.map((p, i) => { const r = plRow(u, p.n, t, s); return [i + 1, p.n].concat(u === 'CMP' ? [String(FC[p.n] ?? '-')] : []).concat([{ content: R_(r.loco), styles: { fontStyle: 'bold' } }]).concat(r.franco.map(R_)); }), { fs: 6.6, cs: Object.assign({}, cs, { 1: { cellWidth: 34, halign: 'left' }, 2: u === 'CMP' ? { halign: 'center' } : { halign: 'right' } }) });
    if (u === 'AMP') {
      R.h2(title + ' - Tergelar', 'termasuk biaya gelar');
      R.table(['No', 'Jenis Hotmix'].concat(zl), prods.map((p, i) => { const r = plRow(u, p.n, t, s); return [i + 1, p.n].concat(r.tergelar.map(R_)); }), { fs: 6.6, cs: Object.assign({}, cs, { 1: { cellWidth: 34, halign: 'left' } }) });
    }
  });
  R.para('Dasar perhitungan: Loco = (HPP + Bunga) / (1 - Margin); Franco = Loco + ongkos gendong ' + (h.k ? h.k.nama : '') + ' per zona (tanpa margin)' + (u === 'AMP' ? '; Tergelar = Franco + biaya gelar / (1 - Margin)' : '') + '. ' + h.ppnTxt + '. Harga dapat berubah mengikuti harga bahan dan biaya operasional.', 7.6);
  R.sign([['Dibuat oleh,', ''], ['Diperiksa oleh,', ''], ['Diketahui oleh,', ''], ['Disetujui oleh,', '']]);
  await R.save();
}

/* =================== 14. HPP & BUASO =================== */
const HG = fn => gated('HPP & BUASO', fn);
MODS.hpp = {
  title: 'HPP & BUASO', icon: 'scale', desc: 'Parameter, biaya harian, BUASO dan BOM penyusun HPP serta price list',
  render(root) {
    const st = stateOf('hpp', { tab: 'rekap', unit: 'AMP', q: '', prod: '' });
    if (!UNITS.includes(st.unit)) st.unit = 'AMP';
    return page(root, {
      key: 'hpp', st, report: hppReport,
      tabs: [{ k: 'rekap', t: 'Rekap HPP' }, { k: 'rinci', t: 'Rincian BUASO & BOM' }, { k: 'param', t: 'Parameter & Biaya Harian' }, { k: 'ongkir', t: 'Ongkos Gendong & Gelar' }],
      actions: [{ id: 'g', t: 'Parameter Umum', icon: 'edit' }, { id: 'pl', t: 'Lihat Price List', icon: 'tag' }],
      on: { g: () => HG(paramGlobalForm)(), pl: () => { location.hash = '#/pl'; } },
      filter: s => (s.tab === 'ongkir' ? '' : '<div class="fbar"><div class="seg" data-ps="unit">' + UNITS.map(u => '<button class="' + (s.unit === u ? 'on' : '') + '" data-v="' + u + '">' + u + ' · ' + UNIT_PROD[u] + '</button>').join('') + '</div>' +
        (s.tab === 'rinci' ? '<select data-fk="prod">' + products(s.unit).map(p => '<option' + (s.prod === p.n ? ' selected' : '') + '>' + esc(p.n) + '</option>').join('') + '</select>' : s.tab === 'rekap' ? '<div class="sbox">' + ic('search') + '<input type="search" placeholder="Cari produk…" value="' + esc(s.q || '') + '" data-fk="q"></div>' : '') + '</div>'),
      bindFilter: (el, s, redraw) => $$('[data-ps] button', el).forEach(b => b.onclick = () => { s.unit = b.dataset.v; s.prod = ''; persist('hpp'); redraw(); }),
      body: s => editBadge('HPP & BUASO') + hppHtml(s),
      bind: (el, s, fill) => {
        $$('[data-row]', el).forEach(tr => tr.onclick = () => { s.tab = 'rinci'; s.prod = tr.dataset.row; MODS.hpp.render($('#main')); });
        $$('[data-ed]', el).forEach(b => b.onclick = () => HG(paramUnitForm)(s.unit, b.dataset.ed));
        $$('[data-kend]', el).forEach(b => b.onclick = () => HG(kendForm)(b.dataset.kend));
        const g = $('[data-gelar]', el); if (g) g.onclick = () => HG(gelarForm)();
        const zn = $('[data-zona]', el); if (zn) zn.onclick = () => HG(zonaForm)();
        const jm = $('[data-jmf]', el); if (jm) jm.onclick = () => jmfForm(s.unit, s.prod);
        bindRelock(el);
      }
    });
  },
  summary() { const d = daily('AMP'); return { main: 'HPP AC-WC ' + rp((hppCalc('AMP', 'AC WC') || {}).hpp), sub: 'Kapasitas efektif AMP ' + num(d.kapEf) + ' ton/hari' }; }
};
function hppHtml(s) {
  const u = s.unit, d = daily(u), sat = { AMP: 'Ton', CMP: 'M3', SCP: 'Ton', PCP: 'M3 beton' }[u];
  if (s.tab === 'rekap') {
    const rows = products(u).filter(p => qMatch(s.q, p.n)).map(p => Object.assign({ id: p.n }, hppCalc(u, p.n)));
    return '<div class="kpis">' + kpi('Kapasitas efektif', num(d.kapEf) + ' ' + sat + '/hari', num(d.kapT) + ' x ' + pct(d.ef)) + kpi('Biaya U+A+S+O per hari', rpS(d.upah + d.bbmL * solarInd() + d.maint + d.sub + d.oh)) + kpi('Per ' + sat, rp((d.upah + d.bbmL * solarInd() + d.maint + d.sub + d.oh) / (d.kapEf || 1)), 'tanpa bahan') + kpi('Bunga modal', pct(bungaF()), 'dari HPP') + '</div>' +
      '<section class="card"><div class="chead"><h3>C. Rekap HPP per produk — ' + esc(UNIT_NAME[u]) + '</h3><div class="cmeta">klik baris untuk rincian BUASO</div></div>' + table([
        { t: 'Produk', f: r => r.p.n, cls: 'strong' }, { t: 'Satuan', f: r => r.sat },
        { t: 'Bahan (B)', f: r => rp(r.buaso.B), num: true }, { t: 'Upah (U)', f: r => rp(r.buaso.U), num: true }, { t: 'Alat (A)', f: r => rp(r.buaso.A), num: true }, { t: 'Subkon (S)', f: r => rp(r.buaso.S), num: true }, { t: 'Overhead (O)', f: r => rp(r.buaso.O), num: true },
        { t: 'HPP', f: r => rp(r.cogs), num: true }, { t: 'Bunga', f: r => rp(r.bunga), num: true }, { t: 'HPP + Bunga', f: r => '<b>' + rp(r.hpp) + '</b>', num: true, raw: true },
        { t: 'Loco Eksternal', f: r => rp(r.harga.ext), num: true }
      ], rows, { click: true }) + '</section>';
  }
  if (s.tab === 'rinci') {
    if (!s.prod || !productFind(u, s.prod)) s.prod = (products(u)[0] || {}).n;
    const c = hppCalc(u, s.prod); if (!c) return '';
    const rows = c.lines.map((l, i) => Object.assign({ id: i, no: i + 1 }, l));
    const tot = BUASO.map(([k, n]) => '<tr class="sub"><td></td><td colspan="5">Total ' + n + ' (' + k + ')</td><td class="n">' + rp(c.buaso[k]) + '</td><td></td></tr>').join('');
    return '<section class="card"><div class="chead"><div>' + unitChip(u) + '<h3>Rincian 1 ' + esc(c.sat) + ' ' + esc(c.p.n) + '</h3></div><button class="btn ghost sm" data-jmf>' + ic('edit') + 'Ubah komposisi jobmix</button></div>' +
      '<div class="tbl"><table><thead><tr><th>No</th><th>Uraian</th><th>Komponen</th><th>Satuan</th><th class="n">Koefisien</th><th class="n">Harga Satuan</th><th class="n">Jumlah</th><th>Keterangan</th></tr></thead><tbody>' +
      rows.map(l => '<tr><td class="c">' + l.no + '</td><td class="strong">' + esc(l.nama) + '</td><td class="c">' + l.komp + '</td><td>' + esc(l.sat) + '</td><td class="n">' + num4(l.koef) + '</td><td class="n">' + rp(l.harga) + '</td><td class="n">' + rp(l.biaya) + '</td><td class="muted wrap">' + esc(l.src || 'Komposisi jobmix') + '</td></tr>').join('') + tot +
      '<tr class="sub strong"><td></td><td colspan="5">HPP (COGS) = B + U + A + S + O</td><td class="n">' + rp(c.cogs) + '</td><td></td></tr><tr class="sub"><td></td><td colspan="5">Bunga modal kerja (HPP x ' + pct(params().global.bunga) + ' / 12 x ' + num(params().global.masa) + ' bulan)</td><td class="n">' + rp(c.bunga) + '</td><td></td></tr><tr class="grand"><td></td><td colspan="5">HPP + BUNGA</td><td class="n">' + rp(c.hpp) + '</td><td></td></tr></tbody></table></div></section>' +
      '<section class="card"><div class="chead"><h3>Harga jual dari HPP ini</h3></div><div class="kpis sm">' + Object.keys(TIER).map(t => kpi(TIER[t][1], rp(c.harga[t]), 'profit ' + rp(c.harga[t] - c.hpp))).join('') + '</div></section>';
  }
  if (s.tab === 'param') {
    const x = params().unit[u], g = params().global, so = solarInd();
    const blk = (k, title, cols, rows, foot) => '<section class="card"><div class="chead"><h3>' + title + '</h3><button class="btn ghost sm" data-ed="' + k + '">' + ic('edit') + 'Ubah</button></div>' + table(cols, rows.map((r, i) => Object.assign({ id: i }, { r })), { empty: 'Belum ada data.' }) + (foot ? '<div class="cfoot">' + foot + '</div>' : '') + '</section>';
    return '<section class="card"><div class="chead"><h3>A. Kapasitas produksi & B. Biaya harian → biaya per ' + esc(sat) + '</h3><button class="btn ghost sm" data-ed="kap">' + ic('edit') + 'Ubah kapasitas, overhead, subkon</button></div>' +
      table([{ t: 'Kode', f: r => r[0] }, { t: 'Komponen', f: r => r[1] }, { t: 'Per hari', f: r => r[2], num: true }, { t: 'Per ' + sat, f: r => r[3], num: true }, { t: 'Sumber', f: r => r[4], cls: 'muted' }],
        [['-', 'Kapasitas terpasang', num(d.kapT) + ' ' + sat, '', 'Target Unit'], ['-', 'Efektivitas mesin', pct(d.ef), '', 'Target Unit'], ['-', 'Kapasitas efektif', num(d.kapEf) + ' ' + sat, '', 'Kapasitas x efektivitas'],
        ['U', 'Upah tenaga kerja (' + num(d.org) + ' orang)', rp(d.upah), rp(d.upah / d.kapEf), 'Rincian upah'], ['A', 'BBM alat produksi - volume', num(d.bbmL) + ' L', num4(d.bbmL / d.kapEf) + ' L', 'Rincian alat'], ['A', 'BBM alat produksi - biaya (Solar Industri ' + rp(so) + '/L)', rp(d.bbmL * so), rp(d.bbmL * so / d.kapEf), 'Kartu Bahan'],
        ['A', 'Maintenance & sparepart alat', rp(d.maint), rp(d.maint / d.kapEf), 'Rp ' + nf0.format(d.maintThn) + '/tahun / ' + (g.hari * g.bulan) + ' hari'], ['S', 'Subkontraktor', rp(d.sub), rp(d.sub / d.kapEf), 'Isian'], ['O', 'Overhead, opex & depresiasi', rp(d.oh), rp(d.oh / d.kapEf), 'Rekap overhead'],
        ['', 'Total U + A + S + O (tanpa bahan)', rp(d.upah + d.bbmL * so + d.maint + d.sub + d.oh), rp((d.upah + d.bbmL * so + d.maint + d.sub + d.oh) / d.kapEf), '']].map((r, i) => Object.assign(r, { id: i }))) + '</section>' +
      '<div class="two">' + blk('upah', 'Rincian upah harian (U)', [{ t: 'Jabatan', f: o => o.r[0] }, { t: 'Upah / OH', f: o => rp(o.r[1]), num: true }, { t: 'Orang', f: o => num(o.r[2]), num: true }, { t: 'Total / hari', f: o => rp(o.r[1] * o.r[2]), num: true }], x.upah || [], 'Total upah per hari: <b>' + rp(d.upah) + '</b>') +
      blk('alat', 'Alat produksi & konsumsi BBM (A)', [{ t: 'Alat', f: o => o.r[0] }, { t: 'Unit', f: o => num(o.r[1]), num: true }, { t: 'L / jam', f: o => num(o.r[2]), num: true }, { t: 'Jam / hari', f: o => num(o.r[3]), num: true }, { t: 'BBM / hari', f: o => num(o.r[1] * o.r[2] * o.r[3]) + ' L', num: true }], x.alat || [], 'Total BBM per hari: <b>' + num(d.bbmL) + ' liter</b> = ' + rp(d.bbmL * so)) + '</div>' +
      blk('maint', 'Biaya maintenance & sparepart alat per tahun (A)', [{ t: 'Uraian', f: o => o.r[0] }, { t: 'Per tahun', f: o => rp(o.r[1]), num: true }, { t: 'Per hari', f: o => rp(o.r[1] / (g.hari * g.bulan)), num: true }], x.maint || [], 'Total: <b>' + rp(d.maintThn) + '</b> per tahun = ' + rp(d.maint) + ' per hari');
  }
  const p = params(), gp = gelarPerTon();
  return '<section class="card"><div class="chead"><h3>A. Zonasi jarak pengiriman</h3><button class="btn ghost sm" data-zona>' + ic('edit') + 'Ubah zona</button></div>' + table([{ t: 'Zona', f: r => 'Zona ' + (r.i + 1) }, { t: 'Jarak (Km)', f: r => (r.i ? p.zona[r.i - 1] : 0) + ' - ' + r.km }, { t: 'Jarak hitung sekali jalan', f: r => r.km + ' Km', num: true }, { t: 'Pulang-pergi', f: r => r.km * 2 + ' Km', num: true }], p.zona.map((km, i) => ({ id: i, i, km }))) +
    '<div class="note">Harga BBM kendaraan (Bio Solar) dari Kartu Bahan: <b>' + rp(bioSolar()) + ' / liter</b>. Ritase per hari = maks(1; min(ritase maks; bulat ke bawah(jam kirim / (muat-bongkar + jarak PP / kecepatan)))).</div></section>' +
    '<section class="card"><div class="chead"><h3>B. Data kendaraan pengiriman</h3><button class="btn ghost sm" data-kend="">' + ic('plus') + 'Tambah kendaraan</button></div>' + table([
      { t: 'Kendaraan', f: k => '<b>' + esc(k.nama) + '</b>' + (k.asumsi ? ' ' + chip('Asumsi', 'warn') : ''), raw: true }, { t: 'Kapasitas', f: k => num(k.kap) + ' ' + k.sat, num: true }, { t: 'Km / liter', f: k => num(k.kmL), num: true }, { t: 'Sewa / hari', f: k => rp(k.sewa), num: true }, { t: 'Sopir / hari', f: k => rp(k.sopir), num: true },
      { t: 'Kecepatan', f: k => num(k.speed) + ' Km/jam', num: true }, { t: 'Muat+bongkar', f: k => num(k.muat) + ' jam', num: true }, { t: 'Jam kirim', f: k => num(k.jam), num: true }, { t: 'Ritase maks', f: k => num(k.rit), num: true },
      { t: '', f: k => '<button class="ibtn sm" data-kend="' + esc(k.id) + '" aria-label="Ubah">' + ic('edit') + '</button>', raw: true }], p.kend) + '</section>' +
    '<section class="card"><div class="chead"><h3>C. Rekap ongkos gendong per satuan</h3><div class="cmeta">dipakai Price List & BOM</div></div><div class="tbl"><table><thead><tr><th>Kendaraan</th><th>Satuan</th>' + p.zona.map((km, i) => '<th class="n">Zona ' + (i + 1) + '<small>' + (i ? p.zona[i - 1] : 0) + '-' + km + ' Km</small></th>').join('') + '</tr></thead><tbody>' +
    p.kend.map(k => '<tr><td class="strong">' + esc(k.nama) + '</td><td>Rp / ' + esc(k.sat) + '</td>' + p.zona.map((_, i) => { const o = ongkir(k, i); return '<td class="n" title="Ritase ' + o.rit + '/hari, BBM ' + num(o.bbmL) + ' L/rit">' + nf0.format(o.total) + '<small>' + o.rit + ' rit</small></td>'; }).join('') + '</tr>').join('') + '</tbody></table></div></section>' +
    '<section class="card"><div class="chead"><h3>D. Biaya gelar hotmix per ton (harga Tergelar AMP)</h3><button class="btn ghost sm" data-gelar>' + ic('edit') + 'Ubah</button></div>' + table([{ t: 'Alat gelar', f: r => r[0] }, { t: 'Unit', f: r => num(r[1]), num: true }, { t: 'BBM (L/ton)', f: r => num4(r[2]), num: true }, { t: 'Sewa / unit / hari', f: r => rp(r[3]), num: true }], (p.gelar.alat || []).map((r, i) => Object.assign([...r], { id: i }))) +
    '<div class="buaso"><div><span>Sewa alat / ton</span><b>' + rp(gp.sewa) + '</b><small>kapasitas gelar ' + num(p.gelar.kap) + ' ton/hari</small></div><div><span>BBM alat / ton</span><b>' + rp(gp.bbm) + '</b><small>' + num(gp.bbmL) + ' L x Solar Industri</small></div><div><span>Upah gelar / ton</span><b>' + rp(gp.upah) + '</b></div><div class="tot"><span>Total biaya gelar</span><b>' + rp(gp.total) + '</b></div></div></section>';
}
function paramGlobalForm() {
  const g = params().global;
  openForm({
    title: 'Parameter Umum Perhitungan', sub: 'Berlaku untuk HPP, harga transfer, dan seluruh price list', value: Object.assign({}, g, { bunga: g.bunga * 100, mBC: g.mBC * 100, mInt: g.mInt * 100, mExt: g.mExt * 100, mTr: g.mTr * 100, ppn: g.ppn * 100 }),
    fields: [
      { k: 'bunga', label: 'Bunga modal kerja per tahun', type: 'num', suffix: '%' }, { k: 'masa', label: 'Masa perputaran modal', type: 'num', suffix: 'bulan' },
      { k: 'mBC', label: 'Margin Loco Basecamp', type: 'num', suffix: '%', third: true }, { k: 'mInt', label: 'Margin Internal / Proyek HO', type: 'num', suffix: '%', third: true }, { k: 'mExt', label: 'Margin Eksternal / Retail', type: 'num', suffix: '%', third: true },
      { k: 'mTr', label: 'Margin harga transfer antar unit', type: 'num', suffix: '%', help: 'Agregat SCP ke AMP/CMP, beton CMP ke PCP' }, { k: 'ppn', label: 'PPN', type: 'num', suffix: '%' },
      { k: 'hari', label: 'Hari kerja per bulan', type: 'num', suffix: 'hari' }, { k: 'bulan', label: 'Bulan per tahun', type: 'num', suffix: 'bulan' },
      { k: 'round', label: 'Pembulatan harga ke atas (kelipatan)', type: 'num', suffix: 'Rp', help: '0 = dibulatkan ke atas ke Rp1' },
      { k: 'dasarPCP', label: 'Dasar harga price list PCP', type: 'select', opts: ['Tertinggi', 'BUASO', 'Pasar'], empty: false }, { k: 'bjPCP', label: 'Berat jenis beton bertulang', type: 'num', suffix: 'kg/m3' }
    ],
    extraBtn: get(PARAM_ID) ? { html: '<button type="button" class="btn ghost" data-rst>' + ic('refresh') + 'Kembalikan semua ke acuan RAPU</button>', bind: (f, x, m) => $('[data-rst]', f).onclick = async () => { if (await confirmBox('Kembalikan parameter', 'Semua parameter, biaya harian, kendaraan, dan zona dikembalikan ke nilai acuan sheet RAPU-BUASO.', 'Kembalikan', false)) { remove(PARAM_ID); m.close(); toast('Parameter dikembalikan ke acuan'); } } } : null,
    onSave: x => { saveParams(d => { d.global = Object.assign({}, d.global, { bunga: x.bunga / 100, masa: +x.masa, mBC: x.mBC / 100, mInt: x.mInt / 100, mExt: x.mExt / 100, mTr: x.mTr / 100, ppn: x.ppn / 100, hari: +x.hari || 25, bulan: +x.bulan || 12, round: +x.round || 0, dasarPCP: x.dasarPCP, bjPCP: +x.bjPCP || 2400 }); }); toast('Parameter tersimpan — HPP dan price list diperbarui'); }
  });
}
function paramUnitForm(u, part) {
  const x = clone(params().unit[u]);
  const setU = data => saveParams(d => { d.unit = d.unit || {}; d.unit[u] = Object.assign({}, d.unit[u], data); });
  if (part === 'kap') return openForm({
    title: 'Kapasitas & Biaya Harian ' + u, value: { kap: x.kap, ef: x.ef * 100, oh: x.oh, sub: x.sub },
    fields: [{ k: 'kap', label: 'Kapasitas terpasang per hari', type: 'num', req: true, suffix: u === 'PCP' ? 'M3 beton' : u === 'CMP' ? 'M3' : 'Ton' }, { k: 'ef', label: 'Efektivitas mesin', type: 'num', suffix: '%', req: true }, { k: 'oh', label: 'Overhead, opex & depresiasi per hari', type: 'money' }, { k: 'sub', label: 'Subkontraktor per hari', type: 'money' }],
    onSave: v => { setU({ kap: +v.kap, ef: v.ef / 100, oh: +v.oh || 0, sub: +v.sub || 0 }); toast('Biaya harian ' + u + ' tersimpan'); }
  });
  const cfg = {
    upah: { t: 'Rincian Upah Harian', cols: [{ k: 'a', label: 'Jabatan', w: '50%' }, { k: 'b', label: 'Upah / OH', num: true }, { k: 'c', label: 'Orang', num: true }], map: r => ({ a: r[0], b: r[1], c: r[2] }), back: r => [r.a, +r.b || 0, +r.c || 0] },
    alat: { t: 'Alat Produksi & BBM', cols: [{ k: 'a', label: 'Alat', w: '44%' }, { k: 'b', label: 'Unit', num: true }, { k: 'c', label: 'L / jam', num: true }, { k: 'd', label: 'Jam / hari', num: true }], map: r => ({ a: r[0], b: r[1], c: r[2], d: r[3] }), back: r => [r.a, +r.b || 0, +r.c || 0, +r.d || 0] },
    maint: { t: 'Maintenance per Tahun', cols: [{ k: 'a', label: 'Uraian', w: '60%' }, { k: 'b', label: 'Jumlah per tahun (Rp)', num: true }], map: r => ({ a: r[0], b: r[1] }), back: r => [r.a, +r.b || 0] }
  }[part];
  openForm({
    title: cfg.t + ' — ' + u, wide: true, value: { rows: (x[part] || []).map(cfg.map) },
    fields: [{ k: 'rows', type: 'items', cols: cfg.cols, newRow: () => ({}) }],
    onSave: v => { setU({ [part]: (v.rows || []).filter(r => r.a).map(cfg.back) }); toast(cfg.t + ' ' + u + ' tersimpan'); }
  });
}
function kendForm(id) {
  const p = params(), k = p.kend.find(x => x.id === id);
  openForm({
    title: k ? 'Kendaraan — ' + k.nama : 'Tambah Kendaraan', value: k ? clone(k) : { sat: 'Ton', jam: 7, rit: 3, speed: 30, muat: 1 },
    onDelete: k ? () => saveParams(d => { d.kend = clone(p.kend).filter(x => x.id !== id); }) : null,
    fields: [{ k: 'nama', label: 'Nama kendaraan', req: true }, { k: 'sat', label: 'Satuan muatan', type: 'select', opts: ['Ton', 'M3'], empty: false }, { k: 'kap', label: 'Kapasitas muatan', type: 'num', req: true }, { k: 'kmL', label: 'Efektivitas BBM', type: 'num', suffix: 'Km/liter', req: true },
      { k: 'sewa', label: 'Sewa per hari', type: 'money' }, { k: 'sopir', label: 'Upah sopir per hari', type: 'money' }, { k: 'speed', label: 'Kecepatan rata-rata', type: 'num', suffix: 'Km/jam' }, { k: 'muat', label: 'Muat + bongkar', type: 'num', suffix: 'jam/rit' },
      { k: 'jam', label: 'Jam kirim per hari', type: 'num' }, { k: 'rit', label: 'Ritase maks per hari', type: 'num' }],
    onSave: v => { saveParams(d => { const list = clone(p.kend); const o = { id: k ? k.id : uid('kd'), nama: v.nama, sat: v.sat, kap: +v.kap, kmL: +v.kmL, sewa: +v.sewa || 0, sopir: +v.sopir || 0, speed: +v.speed || 30, muat: +v.muat || 0, jam: +v.jam || 7, rit: +v.rit || 1 }; const i = list.findIndex(x => x.id === o.id); if (i >= 0) list[i] = o; else list.push(o); d.kend = list; }); toast('Data kendaraan tersimpan'); }
  });
}
function zonaForm() {
  const z = params().zona, v = {}; z.forEach((km, i) => v['z' + i] = km);
  openForm({ title: 'Zonasi Jarak', sub: 'Batas atas jarak tiap zona (Km)', small: true, value: v, fields: z.map((_, i) => ({ k: 'z' + i, label: 'Zona ' + (i + 1), type: 'num', suffix: 'Km', third: true })), onSave: x => { saveParams(d => { d.zona = z.map((_, i) => +x['z' + i] || 0); }); toast('Zona tersimpan'); } });
}
function gelarForm() {
  const g = params().gelar;
  openForm({
    title: 'Biaya Gelar Hotmix', wide: true, value: { kap: g.kap, upah: g.upah, rows: (g.alat || []).map(r => ({ a: r[0], b: r[1], c: r[2], d: r[3] })) },
    fields: [{ k: 'kap', label: 'Kapasitas gelar per hari', type: 'num', suffix: 'ton' }, { k: 'upah', label: 'Upah gelar per ton', type: 'money' },
      { k: 'rows', label: 'Alat gelar', type: 'items', newRow: () => ({ b: 1 }), cols: [{ k: 'a', label: 'Alat', w: '40%' }, { k: 'b', label: 'Unit', num: true }, { k: 'c', label: 'BBM L/ton', num: true }, { k: 'd', label: 'Sewa / unit / hari', num: true }] }],
    onSave: x => { saveParams(d => { d.gelar = { kap: +x.kap || 100, upah: +x.upah || 0, alat: (x.rows || []).filter(r => r.a).map(r => [r.a, +r.b || 0, +r.c || 0, +r.d || 0]) }; }); toast('Biaya gelar tersimpan'); }
  });
}
async function hppReport(s) {
  const u = s.unit, d = daily(u), g = params().global, so = solarInd();
  const R = await pdfReport({ title: 'HPP & BUASO ' + UNIT_NAME[u], sub: BC + ' · per ' + tgl(today(), true) + ' · bunga ' + pct(g.bunga) + '/th x ' + g.masa + ' bln', orient: 'l', fname: 'HPP_BUASO_' + u });
  R.kv([['Kapasitas efektif', num(d.kapEf) + ' / hari'], ['Upah / hari', 'Rp ' + R_(d.upah)], ['BBM / hari', num(d.bbmL) + ' L = Rp ' + R_(d.bbmL * so)], ['Maintenance / hari', 'Rp ' + R_(d.maint)], ['Overhead / hari', 'Rp ' + R_(d.oh)], ['Subkon / hari', 'Rp ' + R_(d.sub)], ['Margin BC / Int / Eks', pct(g.mBC) + ' / ' + pct(g.mInt) + ' / ' + pct(g.mExt)], ['Margin transfer', pct(g.mTr)]], 4);
  R.h2('Rekap HPP per Produk');
  const rows = products(u).map(p => hppCalc(u, p.n));
  R.table(['Produk', 'Sat', 'Bahan', 'Upah', 'Alat', 'Subkon', 'Overhead', 'HPP', 'Bunga', 'HPP+Bunga', 'Loco BC', 'Internal', 'Eksternal'], rows.map(c => [c.p.n, c.sat].concat(['B', 'U', 'A', 'S', 'O'].map(k => cellR(R_(c.buaso[k])))).concat([cellR(R_(c.cogs)), cellR(R_(c.bunga)), { content: R_(c.hpp), styles: { halign: 'right', fontStyle: 'bold' } }, cellR(R_(c.harga.bc)), cellR(R_(c.harga.int)), cellR(R_(c.harga.ext))])), { fs: 6.8 });
  const sel = s.tab === 'rinci' && s.prod ? [hppCalc(u, s.prod)] : rows;
  sel.forEach(c => {
    R.h2('Rincian 1 ' + c.sat + ' ' + c.p.n);
    R.table(['No', 'Uraian', 'Komp', 'Satuan', 'Koefisien', 'Harga Satuan', 'Jumlah', 'Keterangan'], c.lines.map((l, i) => [i + 1, l.nama, l.komp, l.sat, cellR(num4(l.koef)), cellR(R_(l.harga)), cellR(R_(l.biaya)), l.src || '-']),
      { fs: 7, cs: { 0: { halign: 'center', cellWidth: 8 }, 2: center, 7: { cellWidth: 62 } }, foot: ['', 'HPP ' + R_(c.cogs) + ' + bunga ' + R_(c.bunga), '', '', '', 'HPP + Bunga', cellR(R_(c.hpp)), ''] });
  });
  R.sign([['Dibuat oleh,', S.user.name], ['Diperiksa oleh,', ''], ['Disetujui oleh,', '']]);
  await R.save();
}
