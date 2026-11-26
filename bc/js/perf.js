/* Basecamp — KARTU PERFORMANCE: pencapaian produksi terhadap target mingguan, bulanan, tahunan.
   Target = kapasitas efektif unit (kartu HPP) x hari kerja (sheet Target Unit): bulan = kapEf x hari, minggu = bulan / 4, tahun = bulan x 12; bisa diganti manual per unit.
   Realisasi = gabungan catatan produksi / surat jalan / penjualan tanpa dobel (pfEvents). Basecamp lain dibaca lewat bc_sync (hanya di ahgproduksi). */
'use strict';
ICONS.perf = '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/><path d="m7 8 4-3.5 3 2L19 3"/>';
const PF_ID = 'prmTargetUnit01';
const PF_U = ['AMP', 'CMP', 'SCP', 'PCP'];
const PF_SAT = { AMP: 'Ton', CMP: 'M3', SCP: 'Ton', PCP: 'M3' };
const PF_DEF = { Tempuran: ['SCP', 'PCP'], Jogoresan: ['SCP'] }; // unit yang ada di basecamp; basecamp lain = semua unit
const PF_SRC = { prod: 'Kartu Produksi', kirim: 'Pengiriman (Penjualan)', proj: 'Surat jalan Kartu Project', stok: 'Hasil SCP masuk stok', jual: 'Penjualan retail terkirim', tagih: 'Tagihan internal proyek' };
const PF_MODE = { w: { t: 'Mingguan', n: 12, k: 'minggu' }, m: { t: 'Bulanan', n: 12, k: 'bulan' }, y: { t: 'Tahunan', n: 3, k: 'tahun' } };

/* ---------- periode ---------- */
const pfD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const pfMon = s => { const d = pfD(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); };
const pfKey = (mode, t) => mode === 'w' ? pfMon(t) : mode === 'm' ? t.slice(0, 7) : t.slice(0, 4);
function pfShift(mode, key, n) {
  if (mode === 'w') return addDays(key, n * 7);
  if (mode === 'm') { const [y, m] = key.split('-').map(Number); return ymd(new Date(y, m - 1 + n, 1)).slice(0, 7); }
  return String(+key + n);
}
const pfEnd = (mode, key) => mode === 'w' ? addDays(key, 6) : mode === 'm' ? addDays(pfShift('m', key, 1) + '-01', -1) : key + '-12-31';
const pfStart = (mode, key) => mode === 'w' ? key : mode === 'm' ? key + '-01' : key + '-01-01';
const pfLabel = (mode, key) => mode === 'w' ? tgl(key) + ' - ' + tgl(pfEnd('w', key)) : mode === 'm' ? monthLabel(key) : 'Tahun ' + key;
const pfShort = (mode, key) => { if (mode === 'y') return key; const [y, m, d] = key.split('-').map(Number); return mode === 'w' ? d + ' ' + BLN[m - 1] : BLN[m - 1]; };
function pfFrac(mode, key) { // bagian periode yang sudah berjalan (0..1)
  const a = pfD(pfStart(mode, key)), b = pfD(pfEnd(mode, key)), t = pfD(today()), day = 864e5;
  return Math.max(0, Math.min(1, (Math.round((t - a) / day) + 1) / (Math.round((b - a) / day) + 1)));
}
const pfSeries = (mode, key) => { const n = PF_MODE[mode].n; if (mode === 'm') return Array.from({ length: 12 }, (_, i) => key.slice(0, 4) + '-' + String(i + 1).padStart(2, '0')); return Array.from({ length: n }, (_, i) => pfShift(mode, key, i - n + 1)); };

/* ---------- konversi & realisasi ---------- */
/* volume beton 1 pcs precast (M3): katalog dulu, lalu bentuk dari nama (U-Ditch LxTxP tebal T, Cover, Box, Kanstin) */
function pfPcs(name) {
  const s = String(name || '').toLowerCase().replace(/,/g, '.');
  const cat = products('PCP').find(p => p.n.toLowerCase() === s); if (cat) { const l = cat.b.find(x => x[1] === 'O' || x[1] === 'U'); if (l && +l[3] > 0 && /m3/i.test(l[2])) return +l[3]; }
  const k = s.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
  if (k) return (+k[1] + +k[2]) / 2 * k[3] * k[4] / 1e6;
  const m = s.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/); if (!m) return 0;
  const [a, b, c] = [+m[1], +m[2], +m[3]], tm = s.match(/\bt\s*=?\s*(\d+(?:\.\d+)?)/), t = tm ? +tm[1] : Math.max(5, Math.round(a / 10));
  if (/cover|tutup|plat|panel|kans|kerb|kanstin|paving/.test(s)) return a * b * c / 1e6;
  if (/box/.test(s)) return ((a + 2 * t) * (b + 2 * t) - a * b) * c / 1e6;
  if (/u\s*-?\s*dit|udit|u-?ditch|saluran/.test(s)) return ((a + 2 * t) * (b + t) - a * b) * c / 1e6;
  return 0;
}
function pfConv(u, name, vol, sat) { // → satuan target unit; null = tidak dapat dikonversi
  const st = String(sat || PF_SAT[u]).toLowerCase(); vol = +vol || 0;
  if (u === 'PCP') { if (st === 'm3') return vol; const v = pfPcs(name); return v ? vol * v : null; }
  if (u === 'CMP') return st === 'm3' ? vol : null;
  if (st === 'ton') return vol;
  if (st === 'kg') return vol / 1000;
  if (u === 'SCP' && st === 'm3') { const n = canon(/ondol|ladu/i.test(name) ? 'Ladu / Ondol' : name); return vol * (bjOf(n) > 1 ? bjOf(n) : 1.4); }
  return null;
}
const pfNorm = s => String(s || '').toUpperCase().replace(/\b(PT|CV|UD|PEKERJAAN|PROYEK|BAPAK|BPK|IBU)\b\.?/g, ' ').replace(/[^A-Z0-9]+/g, ' ').trim();
const pfSame = (a, b) => { const x = pfNorm(a).split(' ').filter(w => w.length > 3), y = pfNorm(b); return x.length > 0 && x.filter(w => y.includes(w)).length >= Math.min(2, x.length); };
/* semua kejadian produksi/terkirim satu basecamp (dokumen S.docs saat ini), dengan aturan anti dobel */
function pfEvents(src) {
  const ev = [], miss = [];
  const add = (u, t, v, sat, s, n, ref) => {
    if (!PF_U.includes(u) || !src[s] || !/^\d{4}-\d\d-\d\d/.test(t || '') || !(+v > 0)) return;
    const c = pfConv(u, n, v, sat); if (c == null) { miss.push({ u, t, v: +v, sat, n, s, ref }); return; }
    ev.push({ u, t: t.slice(0, 10), v: c, s, n: n || '-', ref: ref || '', raw: +v, sat });
  };
  const prods = all('prod').filter(p => p.status !== 'Batal'), noProd = new Set(prods.map(p => String(p.no || '').toUpperCase()));
  prods.forEach(p => {
    const r = p.real || [];
    if (src.prod && r.length) r.forEach(x => add(p.unit, x.tgl, x.vol, p.sat, 'prod', p.produk, p.no));
    else all('kirim').filter(k => k.so === p.id).forEach(k => add(p.unit, k.tgl, k.vol, p.sat, 'kirim', p.produk, p.no));
  });
  const prj = all('proj').filter(p => p.status !== 'Batal'), noProj = new Set(prj.map(p => String(p.so || '').toUpperCase()));
  prj.forEach(p => { if (!noProd.has(String(p.so || '').toUpperCase())) (p.items || []).forEach(i => (i.sj || []).forEach(x => add(p.unit, x.tgl, x.ton, i.sat || PF_SAT[p.unit], 'proj', i.mat, p.so))); });
  const scp = new Set(products('SCP').map(p => p.n.toLowerCase())), stokM = new Set();
  if (src.stok) all('stok').filter(k => k.unit === 'SCP' && k.jenis === 'masuk' && !/stok awal|saldo (awal|akhir)|opname/i.test((k.ket || '') + ' ' + (k.ref || ''))).forEach(k => {
    const n = /ondol|ladu/i.test(k.mat) ? 'Ladu / Ondol' : k.mat; if (!scp.has(String(n).toLowerCase())) return;
    stokM.add(String(k.tgl).slice(0, 7)); add('SCP', k.tgl, k.qty, k.sat || 'M3', 'stok', n, k.ref);
  });
  all('jualx').filter(d => d.tipe === 'order' && d.status !== 'Batal').forEach(d => {
    if (d.unit === 'SCP' && stokM.has(String(d.tgl).slice(0, 7))) return; // barang dari stok SCP yang sudah dihitung saat masuk
    if (d.kat === 'Internal') { if (!d.so || !noProj.has(String(d.so).toUpperCase())) { if (!(src.proj && prj.some(p => p.unit === d.unit && pfSame(p.nama, (d.nama || '') + ' ' + (d.proyek || ''))))) add(d.unit, d.tgl, d.vol, d.sat, 'tagih', d.produk, d.so || d.inv); } return; }
    if (!(+d.kirim > 0)) return;
    if (src.proj && prj.some(p => p.unit === d.unit && (p.items || []).some(i => (i.sj || []).length) && (p.cust && pfSame(d.nama, p.cust) || pfSame(d.nama, p.nama)))) return; // surat jalannya sudah di Kartu Project
    if (d.unit === 'SCP' && +d.ton > 0) add('SCP', d.tgl, d.ton, 'Ton', 'jual', d.produk, d.sph); else add(d.unit, d.tgl, d.kirim, d.sat, 'jual', d.produk, d.sph);
  });
  return { ev, miss };
}
/* Target Unit (persen): target riil = target dasar (kapasitas efektif / manual) x persen. Performance diukur terhadap target riil. */
const PF_PCT = 0.8, PF_MARK = 0.15;
const pfPct = x => x && x.pct !== '' && x.pct != null && isFinite(+x.pct) ? Math.max(0, +x.pct) : PF_PCT;
const pfHari = () => { const g = params().global; return { H: +g.hari || 25, B: +g.bulan || 12 }; };
const pfDays = () => { const { H, B } = pfHari(); return { d: 1, w: H / 4, m: H, y: H * B }; };
function pfTarget(u, doc) { // { d, w, m, y } = target riil; base = target dasar 100%
  const d = daily(u), { H, B } = pfHari(), x = doc && doc.unit && doc.unit[u] || {}, m0 = d.kapEf * H;
  const bm = +x.m > 0 ? +x.m : m0, base = { m: bm, w: +x.w > 0 ? +x.w : bm / 4, y: +x.y > 0 ? +x.y : bm * B, d: bm / H }, p = pfPct(x);
  return { pct: p, base, d: base.d * p, w: base.w * p, m: base.m * p, y: base.y * p, auto: !(+x.m > 0 || +x.w > 0 || +x.y > 0), m0 };
}

/* ---------- forecast keuangan: target riil x harga rata-rata (HPP + keuntungan), biaya BUASO, laba, modal kerja ---------- */
const PF_PER = [['d', 'Per hari'], ['w', 'Per minggu'], ['m', 'Per bulan'], ['y', 'Per tahun']];
const PF_MET = { harian: 'Biaya harian (upah, maintenance, subkon, overhead tetap per hari kerja)', satuan: 'Per satuan produksi (HPP price list x volume)' };
function pfFcCfg(doc) { const f = (doc || get(PF_ID) || {}).fc || {}; return { markup: f.markup === '' || f.markup == null || !isFinite(+f.markup) ? PF_MARK : +f.markup, metode: PF_MET[f.metode] ? f.metode : 'harian' }; }
/* rata-rata tertimbang produk price list per satuan target unit (PCP pcs → M3, agregat M3 → Ton) */
function pfMix(u, x) {
  const mix = x && x.mix || {}, has = Object.keys(mix).some(k => +mix[k] > 0);
  const it = products(u).map(p => { const f = pfConv(u, p.n, 1, p.s), c = f > 0 ? hppCalc(u, p.n) : null; return c && c.hpp > 0 ? { n: p.n, s: p.s, f, c, w: has ? +mix[p.n] || 0 : 1 } : null; }).filter(i => i && i.w > 0);
  const W = sum(it, 'w') || 1; it.forEach(i => { i.p = i.w / W; });
  const per = fn => sum(it, i => i.p * fn(i.c) / i.f), bz = {};
  BUASO.forEach(([k]) => { bz[k] = per(c => c.buaso[k] || 0); });
  const mats = {};
  it.forEach(i => i.c.lines.forEach(l => { if (l.komp !== 'B' || !(l.biaya > 0)) return; const n = canon(l.nama), k = n + '|' + l.sat, m = mats[k] || (mats[k] = { n, sat: l.sat, q: 0, rp: 0 }); m.q += i.p * l.koef / i.f; m.rp += i.p * l.biaya / i.f; }));
  return { it, has, bz, cogs: per(c => c.cogs), hpp: per(c => c.hpp), mats: Object.values(mats).sort((a, b) => b.rp - a.rp) };
}
function pfFc(u, tg, x, cfg) {
  x = x || {}; cfg = cfg || pfFcCfg();
  const mx = pfMix(u, x), d = daily(u), days = pfDays(), adj = x.adj || {}, so = solarInd(), bf = bungaF(), g = params().global;
  const hpp = mx.hpp, hr = +x.harga > 0 ? +x.harga : hpp * (1 + cfg.markup), per = {};
  PF_PER.forEach(([k]) => {
    const v = tg[k] || 0, n = days[k], ut = d.kapEf ? v / d.kapEf : 0, A = q => +adj[q] > 0 ? +adj[q] * v : null, r = { vol: v, omzet: v * hr };
    if (cfg.metode === 'satuan') BUASO.forEach(([q]) => { r[q] = A(q) ?? mx.bz[q] * v; });
    else { r.B = A('B') ?? mx.bz.B * v; r.U = A('U') ?? d.upah * n; r.A = A('A') ?? d.bbmL * so * ut + d.maint * n; r.S = A('S') ?? d.sub * n; r.O = A('O') ?? d.oh * n; }
    r.biaya = r.B + r.U + r.A + r.S + r.O; r.lk = r.omzet - r.biaya; r.bunga = r.biaya * bf; r.laba = r.lk - r.bunga;
    r.mats = mx.mats.map(m => ({ n: m.n, sat: m.sat, q: m.q * v, rp: m.rp * v }));
    per[k] = r;
  });
  const masa = +g.masa || 0;
  return { u, hr, hpp, manual: +x.harga > 0, mx, per, masa, modal: per.m.biaya * Math.max(1, masa), adj: BUASO.some(([q]) => +adj[q] > 0) };
}
/* gabungan beberapa unit (satuan volume berbeda → volume per unit tetap terpisah) */
function pfFcSum(list) {
  const per = {};
  PF_PER.forEach(([k]) => { const r = { omzet: 0, biaya: 0, lk: 0, bunga: 0, laba: 0, mats: [] }; BUASO.forEach(([q]) => r[q] = 0); list.forEach(f => { const p = f.per[k]; ['omzet', 'biaya', 'lk', 'bunga', 'laba'].concat(BUASO.map(b => b[0])).forEach(q => r[q] += p[q]); r.mats = r.mats.concat(p.mats.map(m => Object.assign({ u: f.u }, m))); }); per[k] = r; });
  const mm = {}; PF_PER.forEach(([k]) => per[k].mats.forEach(m => { const key = m.n + '|' + m.sat, o = mm[key] || (mm[key] = { n: m.n, sat: m.sat, u: new Set(), d: 0, w: 0, m: 0, y: 0, rd: 0, rw: 0, rm: 0, ry: 0 }); o.u.add(m.u); o[k] += m.q; o['r' + k] += m.rp; }));
  return { per, list, modal: sum(list, 'modal'), mats: Object.values(mm).sort((a, b) => b.ry - a.ry) };
}
const pfFcOf = (D, u) => D.fc[u];
const pfFcAct = D => pfFcSum(D.units.filter(x => x.aktif).map(x => D.fc[x.u]));
function pfBuild(bc) { // hitung satu basecamp dari S.docs
  const doc = get(PF_ID) || {}, src = {}; Object.keys(PF_SRC).forEach(k => src[k] = !(doc.src && doc.src[k] === false));
  const { ev, miss } = pfEvents(src), def = PF_DEF[bc] || PF_U;
  const units = PF_U.map(u => {
    const e = ev.filter(x => x.u === u), x = doc.unit && doc.unit[u] || {};
    const map = { w: {}, m: {}, y: {} }; e.forEach(q => ['w', 'm', 'y'].forEach(k => { const key = pfKey(k, q.t); map[k][key] = (map[k][key] || 0) + q.v; }));
    return { u, ev: e, map, tg: pfTarget(u, doc), aktif: x.aktif != null ? !!x.aktif : def.includes(u) || e.length > 0 };
  });
  const cfg = pfFcCfg(doc), fc = {};
  units.forEach(x => { try { fc[x.u] = pfFc(x.u, x.tg, doc.unit && doc.unit[x.u], cfg); } catch (e) { console.warn('forecast', x.u, e); const z = { vol: 0, omzet: 0, biaya: 0, lk: 0, bunga: 0, laba: 0, mats: [], B: 0, U: 0, A: 0, S: 0, O: 0 }; fc[x.u] = { u: x.u, hr: 0, hpp: 0, mx: { it: [], bz: {}, mats: [] }, per: { d: z, w: z, m: z, y: z }, masa: 0, modal: 0, err: 1 }; } });
  return { bc, units, miss, src, cfg, fc, rka: rkaSummary(get(RKA_ID)), by: Object.fromEntries(units.map(x => [x.u, x])) };
}
const pfHere = () => memo('perf', () => pfBuild(BC.replace(/^Basecamp /, '')));
const pfVal = (x, mode, key) => ({ real: x.map[mode][key] || 0, tg: x.tg[mode] });
const pfMean = a => a.length ? sum(a, r => r.tg ? Math.min(1, r.real / r.tg) : 0) / a.length : null;
const pfBcPct = (D, mode, key) => pfMean(D.units.filter(x => x.aktif).map(x => pfVal(x, mode, key)));
function pfUnitAll(list, u, mode, key) { const a = list.map(D => D.by[u]).filter(x => x.aktif).map(x => pfVal(x, mode, key)); return { real: sum(a, 'real'), tg: sum(a, 'tg'), n: a.length }; }
const pfAllPct = (list, mode, key) => pfMean(PF_U.map(u => pfUnitAll(list, u, mode, key)).filter(r => r.n));
function pfStatus(p, f) { // dibanding laju waktu berjalan
  if (p == null || f <= 0) return ['Belum mulai', 'mute'];
  const r = p / f; return p >= 1 ? ['Tercapai', 'ok'] : r >= 1 ? ['Sesuai laju', 'ok'] : r >= 0.8 ? ['Mendekati', 'warn'] : p === 0 ? ['Belum ada realisasi', 'mute'] : ['Di bawah target', 'bad'];
}

/* ---------- grafik ---------- */
const PFC = { bar: '#1f5fae', wash: '#dbe7f6', ink: '#1c2433', mut: '#66758a', grid: '#e6ebf2', tgt: '#1c2433' };
const pfN = n => { const a = Math.abs(n); return a >= 1e6 ? nf2.format(n / 1e6) + ' jt' : a >= 1e4 ? nf0.format(n / 1e3) + ' rb' : a < 10 && a % 1 ? nf2.format(n) : nf0.format(n); };
const pfP = p => p == null ? '-' : nf2.format(Math.round(p * 1000) / 10) + '%';
function pfNice(v) { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), x = v / e; return (x <= 1 ? 1 : x <= 1.5 ? 1.5 : x <= 2 ? 2 : x <= 3 ? 3 : x <= 4 ? 4 : x <= 5 ? 5 : x <= 6 ? 6 : x <= 8 ? 8 : 10) * e; }
function pfRing(p, label, sub) {
  const R = 52, C = 2 * Math.PI * R, v = Math.max(0, Math.min(1, p || 0));
  return '<div class="pfring"><svg viewBox="0 0 132 132" role="img" aria-label="' + esc(label + ' ' + pfP(p)) + '"><circle cx="66" cy="66" r="' + R + '" fill="none" stroke="' + PFC.wash + '" stroke-width="13"/>' +
    (v > 0 ? '<circle cx="66" cy="66" r="' + R + '" fill="none" stroke="' + PFC.bar + '" stroke-width="13" stroke-linecap="round" stroke-dasharray="' + (C * v).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 66 66)"/>' : '') +
    '<text x="66" y="72" text-anchor="middle" class="pfrt">' + pfP(p) + '</text></svg><div><b>' + esc(label) + '</b><small>' + sub + '</small></div></div>';
}
/* batang pencapaian: skala sama untuk semua baris, garis 100% = target, segitiga = posisi waktu berjalan */
function pfBars(rows, f) {
  const mx = Math.max(1.1, ...rows.map(r => r.p || 0)) * 1.02, X = v => (Math.min(v, mx) / mx * 100).toFixed(2) + '%';
  return '<div class="pfbars">' + rows.map(r => {
    const st = pfStatus(r.p, f);
    return '<div class="pfb" tabindex="0"' + (r.id ? ' data-pfgo="' + esc(r.id) + '"' : '') + ' data-tip="' + esc('<b>' + r.t + '</b>' + (r.tip || '') + '<br>Pencapaian ' + pfP(r.p) + (f < 1 && f > 0 ? '<br>Waktu berjalan ' + pfP(f) : '')) + '"><div class="pfl">' + r.label + '</div><div class="pft"><i style="width:' + X(r.p || 0) + '"></i><em style="left:' + X(1) + '"></em>' + (f > 0 && f < 1 ? '<u style="left:' + X(f) + '"></u>' : '') + '</div><div class="pfv"><b>' + pfP(r.p) + '</b><small>' + (r.sub || '') + '</small></div><div class="pfs">' + chip(st[0], st[1]) + '</div></div>';
  }).join('') + '<div class="pfkey"><span><i class="k1"></i>Realisasi</span><span><i class="k2"></i>Target 100%</span>' + (f > 0 && f < 1 ? '<span><i class="k3"></i>Waktu berjalan ' + pfP(f) + '</span>' : '') + '</div></div>';
}
/* grafik digambar setelah tampil supaya lebarnya pas (HP / layar lebar) */
const PF = { ch: [], all: null, busy: false, err: '' };
const pfSlot = spec => '<div class="pfch" data-pfc="' + (PF.ch.push(spec) - 1) + '"></div>';
function pfDraw(el) { $$('[data-pfc]', el).forEach(b => { const s = PF.ch[+b.dataset.pfc]; if (s) b.innerHTML = s.type === 'line' ? pfLineSvg(s, b.clientWidth) : pfColSvg(s, b.clientWidth); }); pfTips(el); }
function pfAxis(W, H, L, R, T, B, mx, fmt) { let g = ''; [0, 0.5, 1].forEach(k => { const y = T + (H - T - B) * (1 - k); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="' + PFC.grid + '"/><text x="' + (L - 6) + '" y="' + (y + 3.5) + '" text-anchor="end" class="pfa">' + fmt(mx * k) + '</text>'; }); return g; }
function pfXl(keys, mode, X, H, bw) { const step = Math.ceil((mode === 'w' ? 46 : 30) / bw); return keys.map((k, i) => (keys.length - 1 - i) % step ? '' : '<text x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="middle" class="pfa">' + pfShort(mode, k) + '</text>').join(''); }
function pfColSvg(s, W) {
  W = Math.max(240, W || 320); const H = s.h || 190, L = 44, R = 10, T = 18, B = 24, n = s.keys.length, bw = (W - L - R) / n, w = Math.min(24, bw * 0.62);
  const mx = pfNice(Math.max(...s.real, ...s.tg, 0)), Y = v => T + (H - T - B) * (1 - v / mx), X = i => L + bw * (i + 0.5);
  const cur = s.keys.indexOf(s.cur), top = Y(0);
  let o = pfAxis(W, H, L, R, T, B, mx, pfN);
  s.real.forEach((v, i) => { if (v > 0) { const y = Math.min(Y(v), top - 2), r = Math.min(4, w / 2, top - y); o += '<path d="M' + (X(i) - w / 2) + ' ' + top + 'V' + (y + r) + 'q0 ' + -r + ' ' + r + ' ' + -r + 'h' + (w - 2 * r) + 'q' + r + ' 0 ' + r + ' ' + r + 'V' + top + 'Z" fill="' + PFC.bar + '"' + (i === cur ? '' : ' opacity=".55"') + '/>'; } });
  s.tg.forEach((v, i) => { o += '<line x1="' + (X(i) - bw / 2) + '" x2="' + (X(i) + bw / 2) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + PFC.tgt + '" stroke-width="2"/>'; });
  if (cur >= 0 && s.real[cur] > 0) { const y = Y(s.real[cur]), near = Math.abs(y - 6 - Y(s.tg[cur])) < 9; o += '<text x="' + X(cur) + '" y="' + (near ? Math.min(y, Y(s.tg[cur])) - 6 : y - 6) + '" text-anchor="middle" class="pfd">' + pfN(s.real[cur]) + '</text>'; }
  o += pfXl(s.keys, s.mode, X, H, bw);
  s.keys.forEach((k, i) => { o += '<rect x="' + (X(i) - bw / 2) + '" y="' + T + '" width="' + bw + '" height="' + (H - T - B) + '" fill="transparent" tabindex="0" data-tip="' + esc('<b>' + pfLabel(s.mode, k) + '</b><br>Realisasi ' + num(s.real[i]) + ' ' + s.sat + '<br>Target ' + num(s.tg[i]) + ' ' + s.sat + '<br>Pencapaian ' + pfP(s.tg[i] ? s.real[i] / s.tg[i] : null)) + '"/>'; });
  return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(s.title) + '">' + o + '</svg>';
}
function pfLineSvg(s, W) {
  W = Math.max(220, W || 320); const H = s.h || 170, L = 40, R = 46, T = 14, B = 24, n = s.keys.length, bw = (W - L - R) / n;
  const mx = Math.max(1, pfNice(Math.max(...s.p.map(v => v || 0)))), Y = v => T + (H - T - B) * (1 - v / mx), X = i => L + bw * (i + 0.5);
  let o = pfAxis(W, H, L, R, T, B, mx, v => nf0.format(v * 100) + '%');
  const pts = s.p.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean);
  if (pts.length) {
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    o += '<path d="' + d + 'L' + pts.at(-1)[0] + ' ' + Y(0) + 'L' + pts[0][0] + ' ' + Y(0) + 'Z" fill="' + PFC.bar + '" opacity=".1"/><path d="' + d + '" fill="none" stroke="' + PFC.bar + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    const e = pts.at(-1), v = s.p.filter(x => x != null).at(-1);
    o += '<circle cx="' + e[0] + '" cy="' + e[1] + '" r="4.5" fill="' + PFC.bar + '" stroke="#fff" stroke-width="2"/><text x="' + (e[0] + 9) + '" y="' + (e[1] + 4) + '" class="pfd">' + pfP(v) + '</text>';
  }
  o += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(1) + '" y2="' + Y(1) + '" stroke="' + PFC.tgt + '" stroke-width="1.5"/>' + pfXl(s.keys, s.mode, X, H, bw);
  s.keys.forEach((k, i) => { o += '<rect x="' + (X(i) - bw / 2) + '" y="' + T + '" width="' + bw + '" height="' + (H - T - B) + '" fill="transparent" tabindex="0" data-tip="' + esc('<b>' + pfLabel(s.mode, k) + '</b><br>Pencapaian ' + pfP(s.p[i])) + '"/>'; });
  return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(s.title) + '">' + o + '</svg>';
}
function pfTips(el) {
  let tip = $('#pftip'); if (!tip) { tip = document.createElement('div'); tip.id = 'pftip'; document.body.appendChild(tip); }
  const show = (t, x, y) => { tip.innerHTML = t.dataset.tip; tip.classList.add('on'); const r = tip.getBoundingClientRect(); tip.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, x + 12)) + 'px'; tip.style.top = (y - r.height - 12 < 8 ? y + 16 : y - r.height - 12) + 'px'; };
  el.onpointermove = el.onpointerdown = e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) show(t, e.clientX, e.clientY); else tip.classList.remove('on'); };
  el.onpointerleave = () => tip.classList.remove('on');
  el.onfocusin = e => { const t = e.target.closest('[data-tip]'); if (t && t.matches(':focus-visible')) { const r = t.getBoundingClientRect(); show(t, r.left + r.width / 2, r.top); } };
  el.onfocusout = () => tip.classList.remove('on');
}
let pfRz = 0; window.addEventListener('resize', () => { clearTimeout(pfRz); pfRz = setTimeout(() => $$('.pfroot').forEach(pfDraw), 150); });
const pfCard = (t, meta, body) => '<section class="card"><div class="chead"><h3>' + esc(t) + '</h3><div class="cmeta">' + esc(meta || '') + '</div></div>' + body + '</section>';
const pfLeg = '<div class="pfkey"><span><i class="k1"></i>Realisasi</span><span><i class="k2"></i>Target</span></div>';

/* ---------- isi ---------- */
function pfHead(mode, key) {
  return '<div class="fbar pffbar"><div class="seg" data-pfm>' + Object.entries(PF_MODE).map(([k, v]) => '<button class="' + (k === mode ? 'on' : '') + '" data-v="' + k + '">' + v.t + '</button>').join('') + '</div>' +
    '<div class="pfnav"><button class="ibtn sm" data-pfn="-1" aria-label="Periode sebelumnya">' + ic('back') + '</button><b>' + esc(pfLabel(mode, key)) + '</b><button class="ibtn sm" data-pfn="1" aria-label="Periode berikutnya"' + (pfShift(mode, key, 1) > pfKey(mode, today()) ? ' disabled' : '') + '>' + ic('right') + '</button>' + (key !== pfKey(mode, today()) ? '<button class="btn ghost sm" data-pfn="0">Sekarang</button>' : '') + '</div></div>';
}
function pfHeadBind(el, s, redraw) {
  $$('[data-pfm] button', el).forEach(b => b.onclick = () => { s.mode = b.dataset.v; s.key = pfKey(s.mode, today()); redraw(); });
  $$('[data-pfn]', el).forEach(b => b.onclick = () => { const n = +b.dataset.pfn; s.key = n ? pfShift(s.mode, s.key, n) : pfKey(s.mode, today()); redraw(); });
}
const pfRowUnit = (u, r, extra) => ({ t: u + ' ' + UNIT_NAME[u], label: unitChip(u) + '<span>' + UNIT_PROD[u] + '</span>', p: r.tg ? r.real / r.tg : null, sub: num(r.real) + ' / ' + num(r.tg) + ' ' + PF_SAT[u], tip: '<br>Realisasi ' + num(r.real) + ' ' + PF_SAT[u] + '<br>Target ' + num(r.tg) + ' ' + PF_SAT[u] + (extra || ''), id: u });
const pfTri = (pf) => ['w', 'm', 'y'].map(k => { const key = pfKey(k, today()), p = pf(k, key), f = pfFrac(k, key); return pfRing(p, { w: 'Minggu ini', m: 'Bulan ini', y: 'Tahun ini' }[k], esc(pfLabel(k, key)) + '<br>waktu berjalan ' + pfP(f)); }).join('');
function pfMainHtml(D, s) {
  const { mode, key } = s, f = pfFrac(mode, key), act = D.units.filter(x => x.aktif), keys = pfSeries(mode, key), nowK = pfKey(mode, today());
  if (!act.length) return '<div class="empty"><p>Belum ada unit aktif. Atur di tab Target Produksi.</p></div>';
  return '<section class="card pfrings">' + pfTri((k, q) => pfBcPct(D, k, q)) + '</section>' +
    pfCard('Pencapaian per unit', pfLabel(mode, key), pfBars([{ t: 'Keseluruhan unit ' + BC, label: '<b>Semua unit</b>', p: pfBcPct(D, mode, key), sub: 'rata-rata ' + act.length + ' unit' }].concat(act.map(x => pfRowUnit(x.u, pfVal(x, mode, key)))), f)) +
    pfCard('Tren keseluruhan unit ' + BC, 'rata-rata pencapaian unit aktif', pfSlot({ type: 'line', title: 'Tren pencapaian', keys, mode, p: keys.map(k => k > nowK ? null : pfBcPct(D, mode, k)) }) + '<div class="pfkey"><span><i class="k1"></i>Pencapaian</span><span><i class="k2"></i>Target 100%</span></div>') +
    '<div class="pfgrid">' + act.map(x => pfCard(x.u + ' · ' + UNIT_PROD[x.u], PF_SAT[x.u] + ' per ' + PF_MODE[mode].k, pfSlot({ title: 'Realisasi dan target ' + x.u, keys, mode, cur: key, sat: PF_SAT[x.u], real: keys.map(k => x.map[mode][k] || 0), tg: keys.map(() => x.tg[mode]) }) + pfLeg)).join('') + '</div>' +
    pfCard('Tabel pencapaian', PF_MODE[mode].t, pfTable(keys.filter(k => k <= nowK).reverse(), mode, act.map(x => [x.u, k => pfVal(x, mode, k)]), k => pfBcPct(D, mode, k))) + pfNotes(D);
}
function pfTable(keys, mode, cols, tot) {
  return '<div class="tbl"><table><thead><tr><th>Periode</th>' + cols.map(([u]) => '<th class="n">' + u + ' realisasi</th><th class="n">' + u + ' %</th>').join('') + '<th class="n">Keseluruhan</th></tr></thead><tbody>' +
    keys.map(k => '<tr><td class="strong" style="white-space:nowrap">' + esc(pfLabel(mode, k)) + '</td>' + cols.map(([u, f]) => { const r = f(k); return '<td class="n">' + (r.real ? num(r.real) : '-') + '<small>target ' + num(r.tg) + '</small></td><td class="n">' + pfP(r.tg ? r.real / r.tg : null) + '</td>'; }).join('') + '<td class="n"><b>' + pfP(tot(k)) + '</b></td></tr>').join('') + '</tbody></table></div>';
}
function pfNotes(D) {
  const n = groupBy(D.units.flatMap(x => x.ev), e => e.s);
  return '<div class="note"><b>Sumber realisasi:</b> ' + (Object.keys(n).map(k => esc(PF_SRC[k]) + ' (' + num(n[k].length) + ')').join(', ') || 'belum ada catatan produksi, surat jalan, atau penjualan di basecamp ini') + '. SO yang sama tidak dihitung dua kali. Keseluruhan unit = rata-rata pencapaian tiap unit aktif (per unit paling tinggi 100%), karena satuan unit berbeda.' + (D.miss.length ? ' <b>' + D.miss.length + ' catatan</b> tidak ikut karena satuannya tidak bisa dikonversi (contoh: ' + esc(D.miss[0].n) + ' ' + esc(D.miss[0].sat || '') + ').' : '') + '</div>';
}
function pfUnitHtml(D, s) {
  const x = D.by[s.unit], { mode, key } = s, u = x.u, sat = PF_SAT[u], r = pfVal(x, mode, key), f = pfFrac(mode, key), keys = pfSeries(mode, key), p = r.tg ? r.real / r.tg : null, st = pfStatus(x.aktif ? p : null, f);
  const inP = x.ev.filter(e => pfKey(mode, e.t) === key), g = Object.entries(groupBy(inP, e => e.n)).map(([n, a]) => ({ id: n, n, v: sum(a, 'v'), c: a.length })).sort((a, b) => b.v - a.v), gs = Object.entries(groupBy(inP, e => e.s)).map(([n, a]) => ({ id: n, n: PF_SRC[n], v: sum(a, 'v'), c: a.length }));
  const daysN = new Set(inP.map(e => e.t)).size;
  return (x.aktif ? '' : '<div class="note">Unit ' + u + ' tidak aktif di ' + esc(BC) + ', jadi tidak masuk rata-rata keseluruhan. Aktifkan di tab Target Produksi.</div>') +
    '<div class="kpis">' + kpi('Realisasi', num(r.real) + ' ' + sat, esc(pfLabel(mode, key))) + kpi('Target', num(r.tg) + ' ' + sat, x.tg.auto ? 'dari kapasitas efektif' : 'target manual') + kpi('Pencapaian', pfP(p), st[0], { ok: 'good', bad: 'bad', warn: 'warn' }[st[1]] || '') + kpi(r.real >= r.tg ? 'Lebih dari target' : 'Kekurangan', num(Math.abs(r.tg - r.real)) + ' ' + sat, daysN ? 'rata-rata ' + num(r.real / daysN) + ' ' + sat + ' per hari tercatat (' + daysN + ' hari)' : '') + '</div>' +
    pfCard('Realisasi dan target ' + u, sat + ' per ' + PF_MODE[mode].k, pfSlot({ h: 260, title: 'Realisasi dan target ' + u, keys, mode, cur: key, sat, real: keys.map(k => x.map[mode][k] || 0), tg: keys.map(() => x.tg[mode]) }) + pfLeg) +
    '<div class="two">' + pfCard('Produk', pfLabel(mode, key), table([{ t: 'Produk', f: q => q.n, cls: 'strong' }, { t: sat, f: q => num(q.v), num: true }, { t: 'Porsi', f: q => pfP(q.v / (r.real || 1)), num: true }, { t: 'Catatan', f: q => q.c, num: true }], g, { empty: 'Belum ada realisasi pada periode ini.' })) +
    pfCard('Sumber data', pfLabel(mode, key), table([{ t: 'Sumber', f: q => q.n }, { t: sat, f: q => num(q.v), num: true }, { t: 'Catatan', f: q => q.c, num: true }], gs, { empty: 'Belum ada realisasi pada periode ini.' })) + '</div>';
}
function pfTargetHtml(D) {
  const act = D.units.filter(x => x.aktif), F = pfFcAct(D);
  return '<section class="card"><div class="chead"><h3>Target produksi ' + esc(BC) + '</h3><div class="cbtns"><button class="btn ghost sm" data-pfsrc>' + ic('edit') + 'Sumber realisasi</button><button class="btn ghost sm" data-pffc>' + ic('edit') + 'Keuntungan &amp; metode biaya</button></div></div><div class="tbl"><table class="pftg"><thead><tr><th>Unit</th><th>Status</th><th class="n">Kapasitas efektif / hari</th><th class="n">Target Unit</th><th class="n">Target / hari</th><th class="n">Target / minggu</th><th class="n">Target / bulan</th><th class="n">Target / tahun</th><th class="n">Harga rata-rata<small>HPP + ' + pfP(D.cfg.markup) + '</small></th><th class="n">Omzet / tahun</th><th>Dasar</th><th></th></tr></thead><tbody>' +
    D.units.map(x => { const f = D.fc[x.u], st = PF_SAT[x.u]; return '<tr' + (x.aktif ? '' : ' class="pfoff"') + '><td style="white-space:nowrap">' + unitChip(x.u) + ' ' + esc(UNIT_NAME[x.u]) + '</td><td>' + (x.aktif ? chip('Aktif', 'ok') : chip('Tidak aktif', 'mute')) + '</td><td class="n">' + num(daily(x.u).kapEf) + ' ' + st + '</td>' +
      '<td class="n"><b class="pfpct">' + pfP(x.tg.pct) + '</b><small>dari ' + num(x.tg.base.d) + ' ' + st + '/hari</small></td>' + ['d', 'w', 'm', 'y'].map(k => '<td class="n">' + num(x.tg[k]) + ' ' + st + '</td>').join('') +
      '<td class="n">' + rp(f.hr) + '<small>per ' + st + (f.manual ? ' · manual' : ' · HPP ' + rp(f.hpp)) + '</small></td><td class="n"><b>' + rpS(f.per.y.omzet) + '</b></td>' +
      '<td class="muted">' + (x.tg.auto ? 'Kapasitas efektif x ' + num(pfHari().H) + ' hari kerja' : 'Target dasar manual') + ' x ' + pfP(x.tg.pct) + '</td><td><button class="btn ghost sm" data-pftg="' + x.u + '">' + ic('edit') + 'Ubah</button></td></tr>'; }).join('') +
    (act.length ? '<tr class="sub strong"><td colspan="9">Total unit aktif (' + act.map(x => x.u).join(', ') + ')</td><td class="n">' + rpS(F.per.y.omzet) + '</td><td colspan="2" class="muted">laba bersih ' + rpS(F.per.y.laba) + ' / tahun</td></tr>' : '') + '</tbody></table></div></section>' +
    '<div class="note">Target dasar mengikuti sheet Target Unit: bulan = kapasitas efektif per hari x hari kerja, minggu = bulan / 4, tahun = bulan x 12. <b>Target Unit</b> (persen) mengubah target dasar menjadi target riil yang dikejar, misalnya 80% x 1.000 ton = 800 ton; Performance diukur terhadap target riil ini. <b>Harga rata-rata</b> = rata-rata HPP + bunga produk price list (per satuan unit, bisa diberi porsi produk) ditambah keuntungan ' + pfP(D.cfg.markup) + ', menjadi dasar omzet per tahun dan menu Forecast. Kapasitas diubah di HPP &amp; BUASO › Parameter &amp; Biaya Harian.</div>';
}
/* ---------- forecast (laporan laba rugi proyeksi) ---------- */
const PF_BC = { B: '#1f5fae', U: '#0f8a6a', A: '#b8641a', S: '#7a4fc2', O: '#66758a' };
const pfRp = v => '<span' + (v < -0.5 ? ' class="t-bad"' : '') + '>' + rp(v) + '</span>';
const pfSel = (D, s) => { const u = s.fu && PF_U.includes(s.fu) ? s.fu : 'all'; return { u, list: u === 'all' ? D.units.filter(x => x.aktif).map(x => D.fc[x.u]) : [D.fc[u]] }; };
function pfFcReal(D, list) { // omzet realisasi tahun berjalan = volume tercatat x harga rata-rata
  const k = pfKey('y', today()), f = pfFrac('y', k);
  return { real: sum(list, fc => (D.by[fc.u].map.y[k] || 0) * fc.hr), tg: sum(list, fc => fc.per.y.omzet) * f, f };
}
function pfStmt(D, F, list) {
  const P = F.per, tr = (cls, label, fn, pc) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + label + '</td>' + PF_PER.map(([k]) => '<td class="n">' + fn(P[k], k) + '</td>').join('') + '<td class="n">' + (pc == null ? '' : pfP(pc)) + '</td></tr>';
  const om = P.y.omzet || 0, rel = v => om ? v / om : null;
  return '<div class="tbl"><table class="pfst"><thead><tr><th>Uraian</th>' + PF_PER.map(([, t]) => '<th class="n">' + t + '</th>').join('') + '<th class="n">% omzet</th></tr></thead><tbody>' +
    '<tr class="pfsec"><td colspan="6">Volume target riil</td></tr>' +
    list.map(fc => tr('', unitChip(fc.u) + ' ' + UNIT_PROD[fc.u] + ' <small class="muted">Target Unit ' + pfP(D.by[fc.u].tg.pct) + '</small>', (r, k) => num(fc.per[k].vol) + ' ' + PF_SAT[fc.u], null)).join('') +
    '<tr class="pfsec"><td colspan="6">A. Pendapatan (omzet)</td></tr>' +
    list.map(fc => tr('', 'Penjualan ' + fc.u + ' <small class="muted">@ ' + rp(fc.hr) + ' / ' + PF_SAT[fc.u] + '</small>', (r, k) => rp(fc.per[k].omzet), rel(fc.per.y.omzet))).join('') +
    tr('sub strong', 'Total omzet', r => rp(r.omzet), om ? 1 : null) +
    '<tr class="pfsec"><td colspan="6">B. Biaya produksi (BUASO)</td></tr>' +
    BUASO.map(([q, n]) => tr('', '<i class="pfdot" style="background:' + PF_BC[q] + '"></i>' + n + ' (' + q + ')', r => rp(r[q]), rel(P.y[q]))).join('') +
    tr('sub strong', 'Total biaya produksi (HPP)', r => rp(r.biaya), rel(P.y.biaya)) +
    tr('strong pfline', 'C. Laba kotor (A - B)', r => pfRp(r.lk), rel(P.y.lk)) +
    tr('', 'D. Bunga modal kerja <small class="muted">' + pfP(bungaF()) + ' dari biaya</small>', r => rp(r.bunga), rel(P.y.bunga)) +
    tr('grand', 'E. Laba bersih sebelum pajak (C - D)', r => rp(r.laba), rel(P.y.laba)) + '</tbody></table></div>';
}
function pfBudget(F) {
  const P = F.per, y = P.y, tot = y.biaya || 1, masa = Math.max(1, ...F.list.map(f => f.masa || 0));
  return '<div class="buaso">' + PF_PER.map(([k, t]) => '<div><span>Pengeluaran ' + t.toLowerCase() + '</span><b>' + rpS(P[k].biaya + P[k].bunga) + '</b><small>BUASO ' + rpS(P[k].biaya) + ' + bunga ' + rpS(P[k].bunga) + '</small></div>').join('') +
    '<div class="tot"><span>Modal kerja disiapkan</span><b>' + rpS(F.modal) + '</b><small>biaya ' + num(masa) + ' bulan perputaran</small></div></div>' +
    '<div class="pfstack" role="img" aria-label="Komposisi biaya BUASO">' + BUASO.map(([q, n]) => y[q] > 0 ? '<i style="width:' + (y[q] / tot * 100).toFixed(2) + '%;background:' + PF_BC[q] + '" data-tip="' + esc('<b>' + n + ' (' + q + ')</b><br>' + rp(y[q]) + ' / tahun<br>' + pfP(y[q] / tot) + ' dari biaya') + '"></i>' : '').join('') + '</div>' +
    '<div class="pfkey">' + BUASO.map(([q, n]) => '<span><i class="pfdot" style="background:' + PF_BC[q] + '"></i>' + n + ' ' + pfP(y[q] / tot) + '</span>').join('') + '</div>' +
    '<div class="tbl"><table><thead><tr><th>Kebutuhan dana</th>' + PF_PER.map(([, t]) => '<th class="n">' + t + '</th>').join('') + '</tr></thead><tbody>' +
    BUASO.map(([q, n]) => '<tr><td>' + n + ' (' + q + ')</td>' + PF_PER.map(([k]) => '<td class="n">' + rp(P[k][q]) + '</td>').join('') + '</tr>').join('') +
    '<tr class="sub strong"><td>Total pengeluaran produksi</td>' + PF_PER.map(([k]) => '<td class="n">' + rp(P[k].biaya) + '</td>').join('') + '</tr><tr><td>Bunga modal kerja</td>' + PF_PER.map(([k]) => '<td class="n">' + rp(P[k].bunga) + '</td>').join('') + '</tr>' +
    '<tr class="grand"><td>Anggaran kas keluar</td>' + PF_PER.map(([k]) => '<td class="n">' + rp(P[k].biaya + P[k].bunga) + '</td>').join('') + '</tr></tbody></table></div>';
}
function pfMatsHtml(F) {
  const m = F.mats.filter(x => x.ry > 0.5);
  if (!m.length) return '<div class="empty"><p>Tidak ada rincian bahan.</p></div>';
  return '<div class="tbl"><table><thead><tr><th>Bahan</th><th>Satuan</th><th>Unit</th>' + PF_PER.map(([, t]) => '<th class="n">' + t + '</th>').join('') + '<th class="n">Biaya / bulan</th><th class="n">Biaya / tahun</th></tr></thead><tbody>' +
    m.map(x => '<tr><td class="strong">' + esc(x.n) + '</td><td>' + esc(x.sat) + '</td><td>' + [...x.u].join(', ') + '</td>' + PF_PER.map(([k]) => '<td class="n">' + num(x[k]) + '</td>').join('') + '<td class="n">' + rp(x.rm) + '</td><td class="n">' + rp(x.ry) + '</td></tr>').join('') +
    '<tr class="sub strong"><td colspan="7">Total bahan</td><td class="n">' + rp(sum(m, 'rm')) + '</td><td class="n">' + rp(sum(m, 'ry')) + '</td></tr></tbody></table></div>';
}
function pfFcHtml(D, s) {
  const { u, list } = pfSel(D, s), cfg = D.cfg;
  if (!list.length) return '<div class="empty"><p>Belum ada unit aktif. Atur di tab Target Produksi.</p></div>';
  const F = pfFcSum(list), y = F.per.y, mg = y.omzet ? y.laba / y.omzet : null, R = pfFcReal(D, list), one = u !== 'all' ? D.fc[u] : null, x = one && D.by[u];
  return (x && !x.aktif ? '<div class="note">Unit ' + u + ' tidak aktif di ' + esc(BC) + ' dan tidak ikut forecast gabungan.</div>' : '') +
    '<div class="kpis">' + kpi('Omzet / tahun', rpS(y.omzet), one ? num(y.vol || one.per.y.vol) + ' ' + PF_SAT[u] + ' x ' + rp(one.hr) : list.length + ' unit aktif, target riil') + kpi('Biaya produksi / tahun', rpS(y.biaya), 'BUASO, tanpa bunga') +
    kpi('Laba bersih / tahun', rpS(y.laba), 'margin ' + pfP(mg), y.laba < 0 ? 'bad' : 'good') + kpi('Modal kerja disiapkan', rpS(F.modal), 'pengeluaran ' + rpS(F.per.m.biaya) + ' / bulan') +
    kpi('Omzet realisasi tahun ini', rpS(R.real), 'target s.d. hari ini ' + rpS(R.tg) + ' (' + pfP(R.tg ? R.real / R.tg : null) + ')') + '</div>' +
    pfCard('Proyeksi laba rugi' + (one ? ' ' + u : ' gabungan unit aktif'), 'target riil · keuntungan ' + pfP(cfg.markup) + ' dari HPP', pfStmt(D, F, list)) +
    '<section class="card"><div class="chead"><h3>Anggaran pengeluaran &amp; modal kerja</h3><div class="cmeta">kebutuhan dana BUASO per periode</div></div>' + pfBudget(F) + '</section>' +
    (one ? pfMixHtml(D, one) : '<section class="card"><div class="chead"><h3>Forecast per unit</h3><div class="cmeta">per tahun</div></div>' + table([
      { t: 'Unit', f: f => unitChip(f.u) + ' ' + UNIT_PROD[f.u], raw: true }, { t: 'Target Unit', f: f => pfP(D.by[f.u].tg.pct), num: true }, { t: 'Volume', f: f => num(f.per.y.vol) + ' ' + PF_SAT[f.u], num: true }, { t: 'Harga rata-rata', f: f => rp(f.hr), num: true },
      { t: 'Omzet', f: f => rpS(f.per.y.omzet), num: true }, { t: 'Biaya BUASO', f: f => rpS(f.per.y.biaya), num: true }, { t: 'Laba bersih', f: f => '<span' + (f.per.y.laba < 0 ? ' class="t-bad"' : '') + '>' + rpS(f.per.y.laba) + '</span>', num: true, raw: true }, { t: 'Margin', f: f => pfP(f.per.y.omzet ? f.per.y.laba / f.per.y.omzet : null), num: true },
      { t: 'Modal kerja', f: f => rpS(f.modal), num: true }, { t: '', f: f => '<button class="btn ghost sm" data-pfmix="' + f.u + '">' + ic('edit') + 'Porsi</button>', raw: true }], list.map(f => Object.assign({ id: f.u }, f))) + '</section>') +
    pfCard('Rincian kebutuhan bahan (B)', 'kuantitas dari komposisi jobmix x volume target riil', pfMatsHtml(F)) +
    '<div class="note">Omzet = volume target riil x harga rata-rata (HPP + bunga price list + ' + pfP(cfg.markup) + ', atau harga manual). Metode biaya: ' + esc(PF_MET[cfg.metode]) + '. Hari kerja ' + num(pfHari().H) + ' / bulan, minggu = bulan / 4, tahun = ' + num(pfHari().B) + ' bulan. Modal kerja = pengeluaran BUASO per bulan x masa perputaran (Parameter Umum HPP). Semua angka ikut berubah saat HPP &amp; BUASO, harga bahan, overhead, atau target diubah.' + (list.some(f => f.adj) ? ' Ada penyesuaian biaya manual: ' + list.filter(f => f.adj).map(f => f.u).join(', ') + '.' : '') + '</div>';
}
function pfMixHtml(D, f) {
  const sat = PF_SAT[f.u], mk = D.cfg.markup;
  return '<section class="card"><div class="chead"><h3>Komposisi produk ' + f.u + ' &amp; harga rata-rata</h3><div class="cbtns"><button class="btn ghost sm" data-pfmix="' + f.u + '">' + ic('edit') + 'Porsi produk &amp; penyesuaian biaya</button></div></div>' +
    '<div class="buaso">' + BUASO.map(([q, n]) => '<div><span>' + n + ' / ' + sat + '</span><b>' + rp(f.per.y.vol ? f.per.y[q] / f.per.y.vol : f.mx.bz[q]) + '</b><small>' + (f.mx.bz[q] ? 'HPP ' + rp(f.mx.bz[q]) : '') + '</small></div>').join('') + '<div class="tot"><span>Harga rata-rata</span><b>' + rp(f.hr) + '</b><small>' + (f.manual ? 'manual' : 'HPP ' + rp(f.hpp) + ' + ' + pfP(mk)) + '</small></div></div>' +
    table([{ t: 'Produk', f: i => i.n, cls: 'strong' }, { t: 'Porsi', f: i => pfP(i.p), num: true }, { t: 'HPP + bunga', f: i => rp(i.c.hpp) + ' / ' + i.s, num: true }, { t: 'HPP per ' + sat, f: i => rp(i.c.hpp / i.f), num: true }, { t: 'Harga + ' + pfP(mk), f: i => rp(i.c.hpp * (1 + mk)) + ' / ' + i.s, num: true }, { t: 'Price list Loco Eks.', f: i => rp(i.c.harga.ext), num: true }],
      f.mx.it.slice().sort((a, b) => b.p - a.p).map(i => Object.assign({ id: i.n }, i))) + '<div class="cfoot">' + (f.mx.has ? 'Porsi produk diatur manual.' : 'Porsi sama rata untuk semua produk price list ' + f.u + '.') + '</div></section>';
}

/* ---------- RKA (Rencana Kerja & Anggaran) Unit Produksi: dokumen prmRKA2027 per basecamp, isi dari sheet
   "Budget Bulanan Per Divisi 2027 - RKA" tab Unit (2) (per basecamp + investasi) dan tab Unit (COGS per jenis unit). Detail pos hanya di database. ---------- */
const RKA_ID = 'prmRKA2027';
const RKA_K = ['Opex', 'Perijinan', 'Maintenance', 'Pengembangan', 'COGS', 'Others Expense'];
const RKA_C = { Opex: '#1f5fae', Perijinan: '#b8641a', Maintenance: '#0f8a6a', Pengembangan: '#7a4fc2', COGS: '#2f7d8c', 'Others Expense': '#66758a' };
const BLN_F = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const rkaDoc = () => get(RKA_ID);
const rkaCut = d => Math.max(1, Math.min(12, +(d && d.cut) || 1));
const rkaM = i => Array.from({ length: 12 }, (_, k) => +(i.m && i.m[k]) || 0);
const rkaTot = items => Array.from({ length: 12 }, (_, k) => sum(items, i => rkaM(i)[k]));
const rkaS = a => a.reduce((x, y) => x + (+y || 0), 0);
const R0 = v => Math.abs(v) < 0.5 ? '-' : nf0.format(Math.round(v));
function rkaRow(i, cut) { const m = rkaM(i), t = rkaS(m), y = rkaS(m.slice(0, cut)), r = +i.real || 0; return { m, t, y, r, v: y - r, p: y ? r / y : null }; }
function rkaAgg(items, cut) { const m = rkaTot(items), y = rkaS(m.slice(0, cut)), r = sum(items, i => +i.real || 0); return { m, t: rkaS(m), y, r, v: y - r, p: y ? r / y : null, n: items.length }; }
function rkaSummary(d) { // dipakai rekap Semua Basecamp
  if (!d) return null; const cut = rkaCut(d), it = (d.sec || []).flatMap(s => s.items || []), a = rkaAgg(it, cut), k = {};
  RKA_K.forEach(q => { k[q] = sum(it.filter(i => i.k === q), i => rkaS(rkaM(i))); }); return Object.assign(a, { cut, k });
}
function rkaTable(items, cut, foot) {
  const th = '<tr><th class="rkst">Pos anggaran</th><th>Kategori</th>' + BLN.map((b, k) => '<th class="n' + (k < cut ? ' rkytd' : '') + '">' + b + '</th>').join('') + '<th class="n">Total 1 tahun</th><th class="n">YTD budget</th><th class="n">Realisasi YTD</th><th class="n">Variance YTD</th><th class="n">Serapan</th></tr>';
  const tr = (cls, a, b, r) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td class="rkst">' + a + '</td><td>' + b + '</td>' + r.m.map((v, k) => '<td class="n' + (k < cut ? ' rkytd' : '') + '">' + R0(v) + '</td>').join('') + '<td class="n"><b>' + R0(r.t) + '</b></td><td class="n">' + R0(r.y) + '</td><td class="n">' + R0(r.r) + '</td><td class="n' + (r.v < -0.5 ? ' t-bad' : '') + '">' + R0(r.v) + '</td><td class="n">' + pfP(r.p) + '</td></tr>';
  if (!items.length) return '<div class="empty"><p>Belum ada pos anggaran.</p></div>';
  const ks = RKA_K.filter(k => items.some(i => i.k === k)).concat([...new Set(items.map(i => i.k))].filter(k => !RKA_K.includes(k)));
  return '<div class="tbl rkat"><table><thead>' + th + '</thead><tbody>' + items.map(i => tr('', esc(i.n), '<i class="pfdot" style="background:' + (RKA_C[i.k] || '#99a') + '"></i>' + esc(i.k || '-'), rkaRow(i, cut))).join('') +
    (ks.length > 1 && items.length > ks.length ? ks.map(k => tr('sub', 'Subtotal ' + esc(k), '', rkaAgg(items.filter(i => i.k === k), cut))).join('') : '') + tr('grand', esc(foot || 'Total'), '', rkaAgg(items, cut)) + '</tbody></table></div>';
}
/* grafik batang bertumpuk per bulan menurut kategori */
function rkaChart(items, cut) {
  const ks = RKA_K.filter(k => items.some(i => i.k === k)), per = ks.map(k => rkaTot(items.filter(i => i.k === k))), tot = rkaTot(items), mx = pfNice(Math.max(...tot, 1));
  const W = 1100, H = 250, L = 58, R = 10, T = 14, B = 26, bw = (W - L - R) / 12, w = Math.min(34, bw * 0.62), Y = v => T + (H - T - B) * (1 - v / mx);
  let o = pfAxis(W, H, L, R, T, B, mx, v => pfN(v));
  for (let k = 0; k < 12; k++) {
    let base = 0; const x = L + bw * (k + 0.5) - w / 2;
    ks.forEach((q, j) => { const v = per[j][k]; if (v > 0) { o += '<rect x="' + x.toFixed(1) + '" y="' + Y(base + v).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (Y(base) - Y(base + v)).toFixed(1) + '" fill="' + RKA_C[q] + '"' + (k < cut ? '' : ' opacity=".72"') + '/>'; base += v; } });
    o += '<text x="' + (L + bw * (k + 0.5)) + '" y="' + (H - 8) + '" text-anchor="middle" class="pfa">' + BLN[k] + '</text>';
    o += '<rect x="' + (L + bw * k) + '" y="' + T + '" width="' + bw + '" height="' + (H - T - B) + '" fill="transparent" tabindex="0" data-tip="' + esc('<b>' + BLN_F[k] + '</b>' + ks.map((q, j) => per[j][k] ? '<br>' + q + ' ' + rp(per[j][k]) : '').join('') + '<br><b>Total ' + rp(tot[k]) + '</b>') + '"/>';
  }
  return '<div class="pfch"><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="RKA per bulan">' + o + '</svg></div><div class="pfkey">' + ks.map(q => '<span><i class="pfdot" style="background:' + RKA_C[q] + '"></i>' + q + '</span>').join('') + '<span>Bulan s.d. cut-off ditampilkan penuh</span></div>';
}
function rkaHtml(D, s) {
  const d = rkaDoc(), view = s.rv === 'cogs' ? 'cogs' : 'bc';
  if (!d) return '<div class="empty"><p>Belum ada RKA untuk ' + esc(BC) + '.</p><button class="btn pri sm" data-rkanew>' + ic('plus') + 'Buat RKA</button></div>';
  const cut = rkaCut(d), secs = view === 'cogs' ? (d.cogs || []).map(c => ({ t: 'COGS ' + c.u + ' · ' + UNIT_NAME[c.u], items: c.items || [], u: c.u })) : d.sec || [], all = secs.flatMap(x => x.items), A = rkaAgg(all, cut);
  const F = view === 'bc' ? pfFcAct(D) : null;
  return '<div class="note">RKA ' + esc(d.tahun || 2027) + ' Unit Produksi' + (view === 'cogs' ? ' · COGS per jenis unit untuk <b>seluruh perusahaan</b> (tab Unit di file RKA), bukan khusus ' + esc(BC) : ' · ' + esc(BC)) + '. Sumber: ' + esc(d.sumber || '-') + '. Cut-off YTD: <b>' + BLN_F[cut - 1] + '</b> <button class="btn ghost sm" data-rkacut>' + ic('edit') + 'Ubah cut-off</button></div>' +
    '<div class="kpis">' + kpi('Total RKA 1 tahun', rpS(A.t), num(A.n) + ' pos anggaran') + kpi('YTD budget', rpS(A.y), 's.d. ' + BLN_F[cut - 1]) + kpi('Realisasi YTD', rpS(A.r), 'diisi per pos anggaran') + kpi('Variance YTD', rpS(A.v), A.v < 0 ? 'melebihi anggaran' : 'sisa anggaran', A.v < 0 ? 'bad' : 'good') + kpi('Serapan YTD', pfP(A.p), 'realisasi / YTD budget') + '</div>' +
    pfCard('RKA per bulan menurut kategori', 'Rupiah', rkaChart(all, cut)) +
    pfCard('Rekap per kategori', 'Rupiah', rkaTable(RKA_K.filter(k => all.some(i => i.k === k)).map(k => { const it = all.filter(i => i.k === k), m = rkaTot(it); return { n: k, k, m, real: sum(it, i => +i.real || 0) }; }), cut, 'Total RKA')) +
    secs.map((x, i) => '<section class="card"><div class="chead"><h3>' + esc(x.t) + '</h3><div class="cbtns"><span class="cmeta">' + rpS(rkaS(rkaTot(x.items))) + ' / tahun</span><button class="btn ghost sm" data-rkaed="' + view + ':' + i + '">' + ic('edit') + 'Ubah</button></div></div>' + rkaTable(x.items, cut, 'Total ' + x.t) + '</section>').join('') +
    '<div class="cbtns" style="margin:0 0 14px"><button class="btn ghost sm" data-rkaadd="' + view + '">' + ic('plus') + (view === 'cogs' ? 'Tambah unit COGS' : 'Tambah bagian anggaran') + '</button></div>' +
    (F && F.list.length ? pfCard('RKA dan Forecast produksi per bulan', 'kebutuhan dana indikatif', '<div class="tbl rkat"><table><thead><tr><th class="rkst">Uraian</th>' + BLN.map(b => '<th class="n">' + b + '</th>').join('') + '<th class="n">Total</th></tr></thead><tbody>' +
      '<tr><td class="rkst">RKA ' + esc(BC) + '</td>' + A.m.map(v => '<td class="n">' + R0(v) + '</td>').join('') + '<td class="n"><b>' + R0(A.t) + '</b></td></tr>' +
      '<tr><td class="rkst">Forecast biaya produksi BUASO + bunga (target riil)</td>' + A.m.map(() => '<td class="n">' + R0(F.per.m.biaya + F.per.m.bunga) + '</td>').join('') + '<td class="n"><b>' + R0((F.per.m.biaya + F.per.m.bunga) * 12) + '</b></td></tr>' +
      '<tr><td class="rkst">Forecast omzet (target riil)</td>' + A.m.map(() => '<td class="n">' + R0(F.per.m.omzet) + '</td>').join('') + '<td class="n"><b>' + R0(F.per.m.omzet * 12) + '</b></td></tr>' +
      '<tr class="grand"><td class="rkst">Sisa setelah biaya produksi dan RKA</td>' + A.m.map(v => '<td class="n">' + R0(F.per.m.omzet - F.per.m.biaya - F.per.m.bunga - v) + '</td>').join('') + '<td class="n">' + R0(F.per.m.omzet * 12 - (F.per.m.biaya + F.per.m.bunga) * 12 - A.t) + '</td></tr></tbody></table></div>' +
      '<div class="cfoot">Indikatif: overhead (O) di Forecast bisa sebagian sama dengan pos Opex RKA (gaji staf, listrik, atensi), jadi baris sisa cenderung konservatif. Forecast per bulan = tahun / 12.</div>') : '');
}
function saveRka(mut) { const d = clone(rkaDoc() || { tahun: 2027, sumber: 'Isian manual', cut: 1, sec: [], cogs: [] }); delete d.id; Object.keys(d).forEach(k => { if (k[0] === '_') delete d[k]; }); mut(d); save('param', d, RKA_ID); }
function rkaSecForm(view, idx) {
  const d = rkaDoc() || {}, arr = view === 'cogs' ? d.cogs || [] : d.sec || [], x = arr[idx], isNew = !x;
  const rows = (x ? x.items : []).map(i => { const r = { id: i.id, k: i.k, n: i.n, real: +i.real || '' }; rkaM(i).forEach((v, k) => { r['m' + k] = v || ''; }); return r; });
  const tot = v => (v.items || []).reduce((a, r) => a + BLN.reduce((b, _, k) => b + (+r['m' + k] || 0), 0), 0);
  openForm({
    title: (isNew ? 'Tambah ' : 'Ubah ') + (view === 'cogs' ? 'COGS Unit' : 'Bagian RKA'), sub: BC + ' · nilai Rupiah per bulan, realisasi = akumulasi YTD s.d. cut-off', wide: true,
    value: { t: x ? (view === 'cogs' ? x.u : x.t) : '', items: rows },
    fields: [view === 'cogs' ? { k: 't', label: 'Unit', type: 'select', req: true, empty: false, opts: PF_U.map(u => ({ v: u, t: u + ' · ' + UNIT_NAME[u] })) } : { k: 't', label: 'Judul bagian', req: true, full: true, ph: 'contoh: Unit Bawen' },
      { k: 'items', label: 'Pos anggaran', type: 'items', newRow: () => ({ k: view === 'cogs' ? 'COGS' : 'Opex' }), cols: [{ k: 'k', label: 'Kategori', type: 'select', opts: RKA_K.map(q => ({ v: q, t: q })), w: '118px' }, { k: 'n', label: 'Pos anggaran', w: '210px' }].concat(BLN.map((b, k) => ({ k: 'm' + k, label: b, num: true, w: '122px' })), [{ k: 'real', label: 'Realisasi YTD', num: true, w: '128px' }]) },
      { k: 'sum', type: 'html', html: v => '<div class="buaso"><div class="tot"><span>Total 1 tahun</span><b>' + rp(tot(v)) + '</b><small>' + num((v.items || []).length) + ' pos</small></div></div>' }],
    onDelete: isNew ? null : () => saveRka(q => { (view === 'cogs' ? q.cogs : q.sec).splice(idx, 1); }),
    onSave: v => {
      const items = (v.items || []).filter(r => String(r.n || '').trim()).map((r, i) => ({ id: r.id || 'n' + Date.now().toString(36) + i, k: r.k || 'Opex', n: String(r.n).trim(), m: BLN.map((_, k) => +r['m' + k] || 0), real: +r.real || 0 }));
      if (items.some(i => i.m.some(q => q < 0) || i.real < 0)) { toast('Nilai tidak boleh negatif', 'err'); return false; }
      saveRka(q => { const a = view === 'cogs' ? (q.cogs = q.cogs || []) : (q.sec = q.sec || []); const o = view === 'cogs' ? { u: v.t, items } : { t: String(v.t).trim(), items }; if (isNew) a.push(o); else a[idx] = o; });
      toast('RKA tersimpan');
    }
  });
}
function rkaCutForm() {
  const d = rkaDoc() || {};
  openForm({ title: 'Cut-off YTD', sub: 'Bulan terakhir yang dihitung sebagai YTD budget', small: true, value: { cut: String(rkaCut(d)) }, fields: [{ k: 'cut', label: 'Bulan cut-off', type: 'select', empty: false, opts: BLN_F.map((b, k) => ({ v: String(k + 1), t: b + ' ' + (d.tahun || 2027) })) }], onSave: v => { saveRka(q => { q.cut = +v.cut || 1; }); toast('Cut-off tersimpan'); } });
}
function rkaAllCard(list) { // tab Semua Basecamp
  const rows = list.map(D => ({ bc: D.bc, r: D.rka })).filter(x => x.r);
  if (!rows.length) return '';
  const ks = RKA_K.filter(k => rows.some(x => x.r.k[k])), T = f => sum(rows, x => f(x.r));
  return pfCard('RKA Unit Produksi per basecamp', 'Rupiah per tahun', '<div class="tbl"><table><thead><tr><th>Basecamp</th>' + ks.map(k => '<th class="n">' + k + '</th>').join('') + '<th class="n">Total RKA</th><th class="n">YTD budget</th><th class="n">Realisasi YTD</th><th class="n">Serapan</th></tr></thead><tbody>' +
    rows.map(x => '<tr><td class="strong">' + esc(x.bc) + '</td>' + ks.map(k => '<td class="n">' + R0(x.r.k[k]) + '</td>').join('') + '<td class="n"><b>' + R0(x.r.t) + '</b></td><td class="n">' + R0(x.r.y) + '<small>s.d. ' + BLN[x.r.cut - 1] + '</small></td><td class="n">' + R0(x.r.r) + '</td><td class="n">' + pfP(x.r.p) + '</td></tr>').join('') +
    '<tr class="grand"><td>Semua basecamp</td>' + ks.map(k => '<td class="n">' + R0(T(r => r.k[k])) + '</td>').join('') + '<td class="n">' + R0(T(r => r.t)) + '</td><td class="n">' + R0(T(r => r.y)) + '</td><td class="n">' + R0(T(r => r.r)) + '</td><td class="n">' + pfP(T(r => r.y) ? T(r => r.r) / T(r => r.y) : null) + '</td></tr></tbody></table></div>');
}
async function rkaReport(s) {
  const d = rkaDoc(); if (!d) { toast('Belum ada RKA', 'err'); return; }
  const view = s.rv === 'cogs' ? 'cogs' : 'bc', cut = rkaCut(d), secs = view === 'cogs' ? (d.cogs || []).map(c => ({ t: 'COGS ' + c.u + ' - ' + UNIT_NAME[c.u], items: c.items || [] })) : d.sec || [], all = secs.flatMap(x => x.items), A = rkaAgg(all, cut);
  const R = await pdfReport({ title: 'RKA ' + (d.tahun || 2027) + ' Unit Produksi' + (view === 'cogs' ? ' - COGS per Unit' : ''), sub: (view === 'cogs' ? 'Seluruh perusahaan' : BC) + ' · cut-off YTD ' + BLN_F[cut - 1] + ' · ' + (d.sumber || ''), orient: 'l', format: 'a3', fname: 'RKA_' + (d.tahun || 2027) + (view === 'cogs' ? '_COGS' : '') });
  R.kv([['Total RKA 1 tahun', 'Rp ' + R_(A.t)], ['YTD budget', 'Rp ' + R_(A.y)], ['Realisasi YTD', 'Rp ' + R_(A.r)], ['Variance YTD', 'Rp ' + R_(A.v), A.v < 0 ? 'red' : ''], ['Serapan YTD', pfP(A.p)]], 5);
  const head = ['Pos anggaran', 'Kategori'].concat(BLN, ['Total', 'YTD', 'Realisasi', 'Variance', 'Serapan']);
  const line = (n, k, r) => [n, k].concat(r.m.map(v => cellR(R_(v))), [cellR(R_(r.t)), cellR(R_(r.y)), cellR(R_(r.r)), cellR(R_(r.v)), cellR(pfP(r.p))]);
  const cs = { 0: { cellWidth: 62 } };
  R.h2('Rekap per kategori');
  const ks = RKA_K.filter(k => all.some(i => i.k === k));
  R.table(head, ks.map(k => line(k, '', rkaAgg(all.filter(i => i.k === k), cut))), { fs: 6.6, cs, foot: line('Total RKA', '', A) });
  secs.forEach(x => { R.h2(x.t); R.table(head, x.items.map(i => line(i.n, i.k, rkaRow(i, cut))), { fs: 6.6, cs, foot: line('Total', '', rkaAgg(x.items, cut)) }); });
  R.sign(); await R.save();
}

/* ---------- semua basecamp ---------- */
function pfAllHtml(list, s) {
  const { mode, key } = s, f = pfFrac(mode, key), keys = pfSeries(mode, key), nowK = pfKey(mode, today());
  const us = PF_U.map(u => [u, pfUnitAll(list, u, mode, key)]).filter(([, r]) => r.n);
  const heat = p => p == null ? '' : 'background:color-mix(in srgb, #1f5fae ' + Math.round(Math.min(1, p) * 78) + '%, #f4f8fd);color:' + (p > 0.55 ? '#fff' : '#1c2433');
  return '<section class="card pfrings">' + pfTri((k, q) => pfAllPct(list, k, q)) + '</section>' +
    pfCard('Performance masing-masing basecamp', pfLabel(mode, key), pfBars([{ t: 'Keseluruhan basecamp', label: '<b>Semua basecamp</b>', p: pfAllPct(list, mode, key), sub: 'rata-rata ' + us.length + ' unit' }].concat(list.map(D => ({ t: 'Basecamp ' + D.bc, label: '<span>Basecamp ' + esc(D.bc) + '</span>', p: pfBcPct(D, mode, key), sub: D.units.filter(x => x.aktif).map(x => x.u).join(', '), tip: D.units.filter(x => x.aktif).map(x => { const r = pfVal(x, mode, key); return '<br>' + x.u + ' ' + num(r.real) + ' / ' + num(r.tg) + ' ' + PF_SAT[x.u]; }).join(''), id: 'bc:' + D.bc }))), f)) +
    pfCard('Performance masing-masing unit (gabungan seluruh basecamp)', pfLabel(mode, key), pfBars(us.map(([u, r]) => Object.assign(pfRowUnit(u, r), { id: '' })), f)) +
    pfCard('Basecamp x unit', 'pencapaian ' + pfLabel(mode, key), '<div class="tbl"><table class="pfheat"><thead><tr><th>Basecamp</th>' + PF_U.map(u => '<th class="n">' + u + '</th>').join('') + '<th class="n">Keseluruhan</th></tr></thead><tbody>' +
      list.map(D => '<tr><td class="strong">' + esc(D.bc) + '</td>' + PF_U.map(u => { const x = D.by[u]; if (!x.aktif) return '<td class="n muted">-</td>'; const r = pfVal(x, mode, key), p = r.tg ? r.real / r.tg : null; return '<td class="n" style="' + heat(p) + '" data-tip="' + esc('<b>' + D.bc + ' · ' + u + '</b><br>' + num(r.real) + ' / ' + num(r.tg) + ' ' + PF_SAT[u] + '<br>' + pfP(p)) + '">' + pfP(p) + '</td>'; }).join('') + '<td class="n"><b>' + pfP(pfBcPct(D, mode, key)) + '</b></td></tr>').join('') +
      '<tr class="sub strong"><td>Semua basecamp</td>' + PF_U.map(u => { const r = pfUnitAll(list, u, mode, key); return '<td class="n">' + pfP(r.tg ? r.real / r.tg : null) + '</td>'; }).join('') + '<td class="n">' + pfP(pfAllPct(list, mode, key)) + '</td></tr></tbody></table></div>') +
    pfCard('Tren keseluruhan basecamp', PF_MODE[mode].t, pfSlot({ type: 'line', h: 210, title: 'Tren keseluruhan basecamp', keys, mode, p: keys.map(k => k > nowK ? null : pfAllPct(list, mode, k)) }) + '<div class="pfkey"><span><i class="k1"></i>Pencapaian</span><span><i class="k2"></i>Target 100%</span></div>') +
    '<div class="sech"><h2>Tren per basecamp</h2></div><div class="pfgrid">' + list.map(D => pfCard('Basecamp ' + D.bc, 'rata-rata unit aktif', pfSlot({ type: 'line', title: 'Tren ' + D.bc, keys, mode, p: keys.map(k => k > nowK ? null : pfBcPct(D, mode, k)) }))).join('') + '</div>' +
    '<div class="sech"><h2>Tren per unit, seluruh basecamp</h2></div><div class="pfgrid">' + us.map(([u]) => { const a = keys.map(k => pfUnitAll(list, u, mode, k)); return pfCard(u + ' · ' + UNIT_PROD[u], PF_SAT[u] + ' per ' + PF_MODE[mode].k, pfSlot({ title: 'Realisasi dan target ' + u, keys, mode, cur: key, sat: PF_SAT[u], real: a.map(r => r.real), tg: a.map(r => r.tg) }) + pfLeg); }).join('') + '</div>' +
    pfCard('Tabel per basecamp', PF_MODE[mode].t, '<div class="tbl"><table><thead><tr><th>Periode</th>' + list.map(D => '<th class="n">' + esc(D.bc) + '</th>').join('') + '<th class="n">Keseluruhan</th></tr></thead><tbody>' + keys.filter(k => k <= nowK).reverse().map(k => '<tr><td class="strong">' + esc(pfLabel(mode, k)) + '</td>' + list.map(D => '<td class="n">' + pfP(pfBcPct(D, mode, k)) + '</td>').join('') + '<td class="n"><b>' + pfP(pfAllPct(list, mode, k)) + '</b></td></tr>').join('') + '</tbody></table></div>') +
    pfCard('Forecast keuangan per basecamp', 'per tahun · target riil unit aktif', pfAllFc(list)) + rkaAllCard(list) +
    '<div class="note">Per unit gabungan = jumlah realisasi dibagi jumlah target semua basecamp yang unitnya aktif. Per basecamp = rata-rata pencapaian unit aktifnya. Keseluruhan basecamp = rata-rata pencapaian keempat unit gabungan. Unit dihitung paling tinggi 100%.' + (list.some(D => !D.units.some(x => x.ev.length)) ? ' Belum ada data realisasi: ' + esc(list.filter(D => !D.units.some(x => x.ev.length)).map(D => D.bc).join(', ')) + '.' : '') + '</div>';
}
function pfAllFc(list) {
  const rows = list.map(D => Object.assign({ id: D.bc, bc: D.bc, act: D.units.filter(x => x.aktif).map(x => x.u) }, pfFcAct(D)));
  const T = k => sum(rows, r => r.per.y[k]), om = T('omzet');
  return '<div class="tbl"><table><thead><tr><th>Basecamp</th><th>Unit aktif</th><th class="n">Omzet</th><th class="n">Biaya BUASO</th><th class="n">Bunga</th><th class="n">Laba bersih</th><th class="n">Margin</th><th class="n">Modal kerja</th></tr></thead><tbody>' +
    rows.map(r => '<tr><td class="strong">' + esc(r.bc) + '</td><td>' + r.act.join(', ') + '</td><td class="n">' + rp(r.per.y.omzet) + '</td><td class="n">' + rp(r.per.y.biaya) + '</td><td class="n">' + rp(r.per.y.bunga) + '</td><td class="n">' + pfRp(r.per.y.laba) + '</td><td class="n">' + pfP(r.per.y.omzet ? r.per.y.laba / r.per.y.omzet : null) + '</td><td class="n">' + rp(r.modal) + '</td></tr>').join('') +
    '<tr class="grand"><td colspan="2">Semua basecamp</td><td class="n">' + rp(om) + '</td><td class="n">' + rp(T('biaya')) + '</td><td class="n">' + rp(T('bunga')) + '</td><td class="n">' + rp(T('laba')) + '</td><td class="n">' + pfP(om ? T('laba') / om : null) + '</td><td class="n">' + rp(sum(rows, 'modal')) + '</td></tr></tbody></table></div>';
}
function pfWith(m, fn) { const keep = S.docs; S.docs = m; S.ver = (S.ver || 0) + 1; try { return fn(); } finally { S.docs = keep; S.ver = (S.ver || 0) + 1; } }
const pfList = (bcs, data) => bcs.filter(b => data[b]).map(b => pfWith(data[b], () => pfBuild(b)));
async function pfLoadAll(done) { // tab Semua Basecamp di dalam satu basecamp (ahgproduksi)
  if (PF.busy) return; PF.busy = true; PF.err = '';
  const bcs = bcList(), data = {};
  if (!bcs.includes(BCN)) bcs.push(BCN);
  try {
    for (const bc of bcs) {
      if (bc === BCN) { data[bc] = S.docs; continue; }
      const m = new Map(); let seq = 0, more = true, g = 0;
      while (more && g++ < 20) { const r = await rpcRaw('bc_sync', { p_token: S.token, p_bc: bc, p_since: seq }); if (!r || r.err) throw new Error(r && r.err || 'server'); (r.docs || []).forEach(d => m.set(d.id, d)); seq = Math.max(seq, r.seq || 0); more = r.more; }
      data[bc] = m;
    }
    PF.all = { at: Date.now(), bcs, data };
  } catch (e) { PF.err = 'Data basecamp lain belum termuat. Periksa koneksi internet.'; }
  PF.busy = false; done();
}
/* dipakai embed.js di mode Semua Basecamp */
const PFA = {};
function pfAllMount(main, head, bcs, data) {
  const s = PFA; if (!s.mode) { s.mode = 'm'; s.key = pfKey('m', today()); }
  const draw = () => {
    const list = pfList(bcs, data); PF.ch = [];
    const html = head + '<div class="pfroot">' + pfHead(s.mode, s.key) + (list.length ? pfAllHtml(list, s) : '<div class="empty"><p>Memuat data basecamp…</p></div>') + (list.length < bcs.length && list.length ? '<div class="note">Memuat basecamp lainnya…</div>' : '') + '</div>';
    if (main._h === html && main.firstChild) return;
    main._h = html; main.innerHTML = html;
    const r = $('.pfroot', main); pfHeadBind(r, s, draw); pfDraw(r);
    $$('[data-pfgo^="bc:"]', r).forEach(b => b.onclick = () => { try { CFG.parent.pick(b.dataset.pfgo.slice(3), 'perf'); } catch { } });
    $$('[data-pfpdf]', main).forEach(b => b.onclick = () => runReport(() => pfAllReport(pfList(bcs, data), s)));
  };
  draw();
}

/* ---------- formulir ---------- */
function savePf(mut) { const d = clone(get(PF_ID) || {}); delete d.id; Object.keys(d).forEach(k => { if (k[0] === '_') delete d[k]; }); mut(d); save('param', d, PF_ID); }
function pfTargetForm(u) {
  const D = pfHere(), x = D.by[u], d = get(PF_ID) || {}, o = d.unit && d.unit[u] || {}, sat = PF_SAT[u], f = D.fc[u], { H, B } = pfHari();
  openForm({
    title: 'Target Produksi ' + u, sub: UNIT_NAME[u] + ' · target dasar kosong = kapasitas efektif', small: true, value: { aktif: x.aktif, pct: Math.round(x.tg.pct * 1e4) / 100, w: o.w || '', m: o.m || '', y: o.y || '', harga: o.harga || '' },
    fields: [{ k: 'aktif', type: 'check', full: true, text: 'Unit ' + u + ' aktif di ' + BC },
      { k: 'pct', label: 'Target Unit (target riil)', type: 'num', suffix: '%', req: 'zero', help: 'Persen dari target dasar yang dikejar, contoh 80' },
      { k: 'harga', label: 'Harga rata-rata manual', type: 'money', help: 'Kosong = HPP rata-rata ' + rp(f.hpp) + ' + ' + pfP(D.cfg.markup) + ' = ' + rp(f.hpp * (1 + D.cfg.markup)) + ' per ' + sat },
      { k: 'm', label: 'Target dasar per bulan', type: 'num', suffix: sat, ph: num(x.tg.m0) }, { k: 'w', label: 'Target dasar per minggu', type: 'num', suffix: sat }, { k: 'y', label: 'Target dasar per tahun', type: 'num', suffix: sat },
      { k: 'tot', type: 'html', html: v => { const m = +v.m > 0 ? +v.m : x.tg.m0, p = (+v.pct || 0) / 100, b = { d: m / H, w: +v.w > 0 ? +v.w : m / 4, m, y: +v.y > 0 ? +v.y : m * B }, hr = +v.harga > 0 ? +v.harga : f.hpp * (1 + D.cfg.markup);
        return '<div class="buaso">' + [['d', 'Hari'], ['w', 'Minggu'], ['m', 'Bulan'], ['y', 'Tahun']].map(([k, t]) => '<div><span>Target riil / ' + t.toLowerCase() + '</span><b>' + num(b[k] * p) + ' ' + sat + '</b><small>dasar ' + num(b[k]) + '</small></div>').join('') + '<div class="tot"><span>Omzet / tahun</span><b>' + rpS(b.y * p * hr) + '</b><small>' + rp(hr) + ' / ' + sat + '</small></div></div>'; } }],
    onSave: v => { if (['w', 'm', 'y', 'pct', 'harga'].some(k => +v[k] < 0)) { toast('Angka tidak boleh negatif', 'err'); return false; } savePf(q => { q.unit = q.unit || {}; q.unit[u] = Object.assign({}, q.unit[u], { aktif: !!v.aktif, pct: (+v.pct || 0) / 100, w: +v.w || 0, m: +v.m || 0, y: +v.y || 0, harga: +v.harga || 0 }); }); toast('Target ' + u + ' tersimpan'); }
  });
}
function pfFcCfgForm() {
  const c = pfHere().cfg;
  openForm({
    title: 'Pengaturan Forecast', sub: 'Berlaku untuk semua unit di ' + BC, small: true, value: { markup: Math.round(c.markup * 1e4) / 100, metode: c.metode },
    fields: [{ k: 'markup', label: 'Keuntungan dari HPP', type: 'num', suffix: '%', req: 'zero', help: 'Harga rata-rata = HPP + bunga x (1 + keuntungan)' },
      { k: 'metode', label: 'Metode biaya U, A, S, O', type: 'select', empty: false, full: true, opts: Object.entries(PF_MET).map(([v, t]) => ({ v, t })) },
      { k: 'i', type: 'html', html: v => '<div class="note" style="margin:0">' + (v.metode === 'satuan' ? 'Semua biaya ikut volume: biaya = HPP per satuan price list x volume target riil, sehingga laba selalu sekitar persen keuntungan.' : 'Bahan dan BBM alat ikut volume. Upah, maintenance alat, subkon, dan overhead dibayar per hari kerja walau produksi di bawah kapasitas, sehingga laba mengikuti tingkat Target Unit.') + '</div>' }],
    onSave: v => { if (+v.markup < 0) { toast('Keuntungan tidak boleh negatif', 'err'); return false; } savePf(q => { q.fc = Object.assign({}, q.fc, { markup: (+v.markup || 0) / 100, metode: v.metode }); }); toast('Pengaturan forecast tersimpan'); }
  });
}
/* porsi produk + penyesuaian biaya per satuan */
function pfMixForm(u) {
  const D = pfHere(), d = get(PF_ID) || {}, o = d.unit && d.unit[u] || {}, sat = PF_SAT[u], f = D.fc[u], mix = o.mix || {}, adj = o.adj || {};
  const ps = products(u).map(p => ({ n: p.n, s: p.s, f: pfConv(u, p.n, 1, p.s), c: hppCalc(u, p.n) })).filter(p => p.f > 0 && p.c && p.c.hpp > 0);
  const val = { }; ps.forEach((p, i) => { val['p' + i] = +mix[p.n] > 0 ? +mix[p.n] : ''; }); BUASO.forEach(([k]) => { val['a' + k] = +adj[k] > 0 ? +adj[k] : ''; });
  const W = v => ps.reduce((a, p, i) => a + (+v['p' + i] || 0), 0);
  openForm({
    title: 'Porsi Produk & Penyesuaian ' + u, sub: UNIT_NAME[u] + ' · porsi kosong semua = rata-rata sama rata', wide: true, value: val,
    fields: [{ k: 'h1', type: 'html', html: () => '<b>Porsi produk dari volume ' + sat + '</b> <span class="muted">(angka bebas, otomatis dijadikan persen)</span>' }]
      .concat(ps.map((p, i) => ({ k: 'p' + i, label: p.n + ' · HPP ' + rp(p.c.hpp / p.f) + '/' + sat, type: 'num', third: true, suffix: '%' })))
      .concat([{ k: 'h2', type: 'html', html: v => { const w = W(v); let hpp = 0; ps.forEach((p, i) => { const q = w ? (+v['p' + i] || 0) / w : 1 / ps.length; hpp += q * p.c.hpp / p.f; }); return '<div class="buaso"><div><span>Total porsi</span><b>' + (w ? num(w) : 'sama rata') + '</b></div><div><span>HPP rata-rata</span><b>' + rp(hpp) + '</b><small>per ' + sat + '</small></div><div class="tot"><span>Harga rata-rata</span><b>' + rp(+o.harga > 0 ? +o.harga : hpp * (1 + D.cfg.markup)) + '</b><small>' + (+o.harga > 0 ? 'manual' : 'HPP + ' + pfP(D.cfg.markup)) + '</small></div></div><b>Penyesuaian biaya per ' + sat + '</b> <span class="muted">(kosong = otomatis dari HPP &amp; BUASO)</span>'; } }])
      .concat(BUASO.map(([k, n]) => ({ k: 'a' + k, label: n + ' (' + k + ')', type: 'money', third: true, help: 'Saat ini ' + rp(f.per.y.vol ? f.per.y[k] / f.per.y.vol : f.mx.bz[k]) + ' / ' + sat }))),
    onSave: v => { if (Object.values(v).some(q => +q < 0)) { toast('Angka tidak boleh negatif', 'err'); return false; }
      savePf(q => { q.unit = q.unit || {}; const m = {}, a = {}; ps.forEach((p, i) => { if (+v['p' + i] > 0) m[p.n] = +v['p' + i]; }); BUASO.forEach(([k]) => { if (+v['a' + k] > 0) a[k] = +v['a' + k]; }); q.unit[u] = Object.assign({}, q.unit[u], { mix: m, adj: a }); }); toast('Forecast ' + u + ' tersimpan'); }
  });
}
function pfSrcForm() {
  const D = pfHere();
  openForm({ title: 'Sumber Realisasi', sub: 'Catatan yang dihitung sebagai realisasi produksi', small: true, value: Object.assign({}, D.src), fields: Object.entries(PF_SRC).map(([k, t]) => ({ k, type: 'check', full: true, text: t })), onSave: v => { savePf(q => { q.src = {}; Object.keys(PF_SRC).forEach(k => q.src[k] = !!v[k]); }); toast('Sumber realisasi tersimpan'); } });
}
const PG = fn => gated('Target Produksi', fn);

/* ---------- kartu ---------- */
MODS.perf = {
  title: 'Performance', icon: 'perf', desc: 'Pencapaian target produksi mingguan, bulanan, dan tahunan per unit dan basecamp',
  render(root) {
    const st = stateOf('perf', { tab: 'main', unit: 'AMP' });
    if (!PF_U.includes(st.unit)) st.unit = 'AMP';
    if (!st.mode) { st.mode = 'm'; st.key = pfKey('m', today()); }
    const multi = typeof EMBED !== 'undefined' && EMBED, tabs = [{ k: 'main', t: 'Keseluruhan Unit' }, { k: 'unit', t: 'Per Unit' }].concat(multi ? [{ k: 'all', t: 'Semua Basecamp' }] : [], [{ k: 'target', t: 'Target Produksi' }, { k: 'fc', t: 'Forecast' }, { k: 'rka', t: 'RKA' }]);
    if (!tabs.some(t => t.k === st.tab)) st.tab = 'main';
    let ctl;
    ctl = page(root, {
      key: 'perf', st, report: pfReport, tabs,
      actions: [{ id: 'real', t: 'Catat Produksi', icon: 'prod' }],
      on: { real: () => { if (all('prod').some(p => p.status !== 'Batal' && soStats(p).sisaProd > 0)) realForm(); else { toast('Belum ada SO / WO terbuka. Buat dulu di Kartu Produksi.', 'err'); location.hash = '#/prod'; } } },
      filter: s => s.tab === 'target' ? '' : s.tab === 'rka' ? '<div class="fbar"><div class="seg" data-prv>' + [['bc', 'RKA ' + BC], ['cogs', 'COGS per unit (perusahaan)']].map(([v, t]) => '<button class="' + ((s.rv || 'bc') === v ? 'on' : '') + '" data-v="' + v + '">' + esc(t) + '</button>').join('') + '</div></div>' : s.tab === 'fc' ? '<div class="fbar"><div class="seg" data-pfu>' + [['all', 'Semua unit aktif']].concat(PF_U.map(u => [u, u + ' · ' + UNIT_PROD[u]])).map(([v, t]) => '<button class="' + ((s.fu || 'all') === v ? 'on' : '') + '" data-v="' + v + '">' + t + '</button>').join('') + '</div></div>' : pfHead(s.mode, s.key) + (s.tab === 'unit' ? '<div class="fbar"><div class="seg" data-ps="unit">' + PF_U.map(u => '<button class="' + (s.unit === u ? 'on' : '') + '" data-v="' + u + '">' + u + ' · ' + UNIT_PROD[u] + '</button>').join('') + '</div></div>' : ''),
      bindFilter: (el, s, redraw) => { pfHeadBind(el, s, redraw); $$('[data-ps] button', el).forEach(b => b.onclick = () => { s.unit = b.dataset.v; persist('perf'); redraw(); }); $$('[data-pfu] button', el).forEach(b => b.onclick = () => { s.fu = b.dataset.v; redraw(); }); $$('[data-prv] button', el).forEach(b => b.onclick = () => { s.rv = b.dataset.v; redraw(); }); },
      body: s => {
        PF.ch = [];
        let h;
        if (s.tab === 'all') h = PF.all ? pfAllHtml(pfList(PF.all.bcs, Object.assign(PF.all.data, { [BCN]: S.docs })), s) : '<div class="empty"><p>' + esc(PF.err || 'Memuat data semua basecamp…') + '</p></div>';
        else if (s.tab === 'target') h = editBadge('Target Produksi') + pfTargetHtml(pfHere());
        else if (s.tab === 'rka') h = editBadge('RKA') + '<div class="pffc">' + rkaHtml(pfHere(), s) + '</div>';
        else if (s.tab === 'fc') h = editBadge('Target Produksi') + '<div class="pffc">' + pfFcHtml(pfHere(), s) + '</div>';
        else h = s.tab === 'unit' ? pfUnitHtml(pfHere(), s) : pfMainHtml(pfHere(), s);
        return '<div class="pfroot">' + h + '</div>';
      },
      bind: (el, s) => {
        const r = $('.pfroot', el); if (r) pfDraw(r); bindRelock(el);
        if (s.tab === 'all' && !PF.busy && (!PF.all || Date.now() - PF.all.at > 120e3) && !PF.err) pfLoadAll(() => { if (APP.route === 'perf' && ST.perf.tab === 'all') MODS.perf.render($('#main')); });
        if (s.tab !== 'all') PF.err = '';
        $$('[data-pfgo]', el).forEach(b => b.onclick = () => { const v = b.dataset.pfgo; if (v.startsWith('bc:')) { try { CFG.parent.pick(v.slice(3), 'perf'); } catch { } return; } s.unit = v; s.tab = 'unit'; persist('perf'); MODS.perf.render($('#main')); });
        $$('[data-pftg]', el).forEach(b => b.onclick = () => PG(pfTargetForm)(b.dataset.pftg));
        const q = $('[data-pfsrc]', el); if (q) q.onclick = () => PG(pfSrcForm)();
        $$('[data-pffc]', el).forEach(b => b.onclick = () => PG(pfFcCfgForm)());
        $$('[data-pfmix]', el).forEach(b => b.onclick = () => PG(pfMixForm)(b.dataset.pfmix));
        const RG = fn => gated('RKA', fn);
        $$('[data-rkaed]', el).forEach(b => b.onclick = () => { const [v, i] = b.dataset.rkaed.split(':'); RG(rkaSecForm)(v, +i); });
        $$('[data-rkaadd]', el).forEach(b => b.onclick = () => RG(rkaSecForm)(b.dataset.rkaadd, -1));
        $$('[data-rkacut]', el).forEach(b => b.onclick = () => RG(rkaCutForm)());
        $$('[data-rkanew]', el).forEach(b => b.onclick = () => RG(rkaSecForm)('bc', -1));
      }
    });
    return ctl;
  },
  summary() { const D = pfHere(), k = pfKey('m', today()), p = pfBcPct(D, 'm', k); return { main: 'Bulan ini ' + pfP(p), sub: D.units.filter(x => x.aktif).map(x => { const r = pfVal(x, 'm', k); return x.u + ' ' + pfP(r.tg ? r.real / r.tg : null); }).join(' · ') }; }
};
/* ---------- PDF ---------- */
function pfPdfBars(R, rows) {
  const d = R.doc, M = R.M, W = R.W - 2 * M, L = 62, V = 58, bw = W - L - V, mx = Math.max(1.1, ...rows.map(r => r.p || 0)) * 1.02;
  R.need(rows.length * 8 + 6); let y = R.y;
  rows.forEach(r => {
    d.setFont('helvetica', r.bold ? 'bold' : 'normal'); d.setFontSize(8.4); d.setTextColor(...INK); d.text(pdfClean(r.t), M, y + 4);
    d.setFillColor(219, 231, 246); d.rect(M + L, y + 0.8, bw, 4.4, 'F');
    if (r.p > 0) { d.setFillColor(31, 95, 174); d.rect(M + L, y + 0.8, bw * Math.min(r.p, mx) / mx, 4.4, 'F'); }
    d.setDrawColor(...INK); d.setLineWidth(0.5); d.line(M + L + bw / mx, y, M + L + bw / mx, y + 6);
    d.setFont('helvetica', 'bold'); d.text(pfP(r.p), M + L + bw + 3, y + 4.2); d.setFont('helvetica', 'normal'); d.setFontSize(7); d.setTextColor(...MUTED); d.text(pdfClean(r.sub || ''), M + L + bw + 18, y + 4.2);
    y += 8;
  });
  d.setFontSize(7); d.setTextColor(...MUTED); d.text('Garis tegak = target 100%', M + L, y + 1.5); R.y = y + 6;
}
const pfPdfRow = (u, r) => ({ t: u + ' - ' + UNIT_NAME[u], p: r.tg ? r.real / r.tg : null, sub: num(r.real) + ' / ' + num(r.tg) + ' ' + PF_SAT[u] });
async function pfFcReport(s) {
  const D = pfHere(), { u, list } = pfSel(D, s), cfg = D.cfg;
  if (!list.length) { toast('Belum ada unit aktif', 'err'); return; }
  const F = pfFcSum(list), P = F.per, y = P.y, om = y.omzet || 0, rel = v => om ? cellR(pfP(v / om)) : '';
  const R = await pdfReport({ title: 'Forecast Keuangan Produksi' + (u !== 'all' ? ' ' + u : ''), sub: BC + ' · target riil · keuntungan ' + pfP(cfg.markup) + ' dari HPP · ' + tgl(today(), true), orient: 'l', fname: 'Forecast' + (u !== 'all' ? '_' + u : '') });
  R.kv([['Omzet / tahun', 'Rp ' + R_(y.omzet)], ['Biaya produksi / tahun', 'Rp ' + R_(y.biaya)], ['Laba bersih / tahun', 'Rp ' + R_(y.laba) + ' (' + pfP(om ? y.laba / om : null) + ')', y.laba < 0 ? 'red' : ''], ['Modal kerja disiapkan', 'Rp ' + R_(F.modal)]]);
  R.h2('Asumsi per unit', 'per tahun');
  R.table(['Unit', 'Target Unit', 'Target / hari', 'Target / tahun', 'Harga rata-rata', 'Omzet', 'Biaya BUASO', 'Laba bersih', 'Margin'], list.map(f => [f.u + ' - ' + UNIT_NAME[f.u], cellR(pfP(D.by[f.u].tg.pct)), cellR(N_(f.per.d.vol) + ' ' + PF_SAT[f.u]), cellR(N_(f.per.y.vol) + ' ' + PF_SAT[f.u]), cellR(R_(f.hr)), cellR(R_(f.per.y.omzet)), cellR(R_(f.per.y.biaya)), cellR(R_(f.per.y.laba)), cellR(pfP(f.per.y.omzet ? f.per.y.laba / f.per.y.omzet : null))]), { fs: 7.4 });
  R.h2('Proyeksi laba rugi', 'Rupiah');
  const row = (t, fn, pc, st) => [st ? { content: t, styles: st } : t].concat(PF_PER.map(([k]) => cellR(R_(fn(P[k], k)))), [pc == null ? '' : pc]);
  const B = { fontStyle: 'bold' };
  R.table(['Uraian'].concat(PF_PER.map(p => p[1]), ['% omzet']), [].concat(
    list.map(f => ['Volume ' + f.u + ' (' + PF_SAT[f.u] + ')'].concat(PF_PER.map(([k]) => cellR(N_(f.per[k].vol))), [''])),
    list.map(f => row('Penjualan ' + f.u + ' @ Rp ' + R_(f.hr), (r, k) => f.per[k].omzet, rel(f.per.y.omzet))),
    [row('A. Total omzet', r => r.omzet, rel(om), B)],
    BUASO.map(([q, n]) => row('   ' + n + ' (' + q + ')', r => r[q], rel(y[q]))),
    [row('B. Total biaya produksi (HPP)', r => r.biaya, rel(y.biaya), B), row('C. Laba kotor (A - B)', r => r.lk, rel(y.lk), B), row('D. Bunga modal kerja', r => r.bunga, rel(y.bunga)), row('E. Laba bersih sebelum pajak (C - D)', r => r.laba, rel(y.laba), B)]
  ), { fs: 7.4 });
  R.h2('Anggaran pengeluaran & modal kerja');
  R.table(['Kebutuhan dana'].concat(PF_PER.map(p => p[1])), BUASO.map(([q, n]) => [n + ' (' + q + ')'].concat(PF_PER.map(([k]) => cellR(R_(P[k][q]))))).concat([['Bunga modal kerja'].concat(PF_PER.map(([k]) => cellR(R_(P[k].bunga))))]), { fs: 7.4, foot: ['Anggaran kas keluar'].concat(PF_PER.map(([k]) => cellR(R_(P[k].biaya + P[k].bunga)))) });
  R.para('Modal kerja yang perlu disiapkan = pengeluaran BUASO per bulan x masa perputaran = Rp ' + R_(F.modal) + '.', 7.8);
  const m = F.mats.filter(x => x.ry > 0.5);
  if (m.length) { R.h2('Rincian kebutuhan bahan'); R.table(['Bahan', 'Satuan', 'Unit'].concat(PF_PER.map(p => p[1]), ['Biaya / bulan', 'Biaya / tahun']), m.map(x => [x.n, x.sat, [...x.u].join(', ')].concat(PF_PER.map(([k]) => cellR(N_(x[k]))), [cellR(R_(x.rm)), cellR(R_(x.ry))])), { fs: 7, foot: ['Total bahan', '', '', '', '', '', '', cellR(R_(sum(m, 'rm'))), cellR(R_(sum(m, 'ry')))] }); }
  R.para('Omzet = volume target riil x harga rata-rata (HPP + bunga price list + ' + pfP(cfg.markup) + ' atau harga manual). Metode biaya: ' + PF_MET[cfg.metode] + '.', 7.4);
  R.sign(); await R.save();
}
async function pfReport(s) {
  if (s.tab === 'rka') return rkaReport(s);
  if (s.tab === 'fc') return pfFcReport(s);
  if (s.tab === 'all') { if (!PF.all) { toast('Data semua basecamp masih dimuat', 'err'); return; } return pfAllReport(pfList(PF.all.bcs, PF.all.data), s); }
  const D = pfHere(), { mode, key } = s, act = s.tab === 'unit' ? [D.by[s.unit]] : D.units.filter(x => x.aktif), nowK = pfKey(mode, today()), keys = pfSeries(mode, key).filter(k => k <= nowK);
  const R = await pdfReport({ title: 'Performance Produksi' + (s.tab === 'unit' ? ' ' + s.unit : ''), sub: BC + ' · ' + PF_MODE[mode].t + ' · ' + pfLabel(mode, key), orient: 'l', fname: 'Performance_' + (s.tab === 'unit' ? s.unit + '_' : '') + key });
  R.kv(['w', 'm', 'y'].map(k => { const q = pfKey(k, today()); return [{ w: 'Minggu ini', m: 'Bulan ini', y: 'Tahun ini' }[k], s.tab === 'unit' ? pfP(pfVal(act[0], k, q).real / act[0].tg[k]) : pfP(pfBcPct(D, k, q))]; }));
  R.h2('Pencapaian per unit', pfLabel(mode, key));
  pfPdfBars(R, (s.tab === 'unit' ? [] : [{ t: 'Keseluruhan unit', p: pfBcPct(D, mode, key), sub: 'rata-rata unit aktif', bold: 1 }]).concat(act.map(x => pfPdfRow(x.u, pfVal(x, mode, key)))));
  R.h2('Riwayat ' + PF_MODE[mode].t.toLowerCase());
  R.table(['Periode'].concat(act.flatMap(x => [x.u + ' realisasi', 'Target (' + PF_SAT[x.u] + ')', '%']), s.tab === 'unit' ? [] : ['Keseluruhan']), keys.slice().reverse().map(k => [pfLabel(mode, k)].concat(act.flatMap(x => { const r = pfVal(x, mode, k); return [cellR(N_(r.real)), cellR(N_(r.tg)), cellR(pfP(r.tg ? r.real / r.tg : null))]; }), s.tab === 'unit' ? [] : [cellR(pfP(pfBcPct(D, mode, k)))])), { fs: 7 });
  R.para('Keseluruhan unit = rata-rata pencapaian unit aktif, per unit paling tinggi 100%. Target otomatis = kapasitas efektif x hari kerja.', 7.6);
  R.sign(); await R.save();
}
async function pfAllReport(list, s) {
  const { mode, key } = s, nowK = pfKey(mode, today()), keys = pfSeries(mode, key).filter(k => k <= nowK);
  const R = await pdfReport({ title: 'Performance Semua Basecamp', sub: PF_MODE[mode].t + ' · ' + pfLabel(mode, key), orient: 'l', fname: 'Performance_Semua_Basecamp_' + key });
  R.kv(['w', 'm', 'y'].map(k => [{ w: 'Minggu ini', m: 'Bulan ini', y: 'Tahun ini' }[k], pfP(pfAllPct(list, k, pfKey(k, today())))]));
  R.h2('Per basecamp', pfLabel(mode, key)); pfPdfBars(R, [{ t: 'Keseluruhan basecamp', p: pfAllPct(list, mode, key), sub: 'rata-rata unit gabungan', bold: 1 }].concat(list.map(D => ({ t: 'Basecamp ' + D.bc, p: pfBcPct(D, mode, key), sub: D.units.filter(x => x.aktif).map(x => x.u).join(', ') }))));
  R.h2('Per unit, seluruh basecamp', pfLabel(mode, key)); pfPdfBars(R, PF_U.map(u => [u, pfUnitAll(list, u, mode, key)]).filter(([, r]) => r.n).map(([u, r]) => pfPdfRow(u, r)));
  R.h2('Riwayat per basecamp'); R.table(['Periode'].concat(list.map(D => D.bc), ['Keseluruhan']), keys.slice().reverse().map(k => [pfLabel(mode, k)].concat(list.map(D => cellR(pfP(pfBcPct(D, mode, k)))), [cellR(pfP(pfAllPct(list, mode, k)))])), { fs: 7.4 });
  R.sign(); await R.save();
}
