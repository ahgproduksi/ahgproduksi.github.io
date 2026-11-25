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
function pfTarget(u, doc) { // { w, m, y, auto }
  const d = daily(u), g = params().global, x = doc && doc.unit && doc.unit[u] || {}, m0 = d.kapEf * (+g.hari || 25);
  const m = +x.m > 0 ? +x.m : m0;
  return { m, w: +x.w > 0 ? +x.w : m / 4, y: +x.y > 0 ? +x.y : m * (+g.bulan || 12), auto: !(+x.m > 0 || +x.w > 0 || +x.y > 0), m0 };
}
function pfBuild(bc) { // hitung satu basecamp dari S.docs
  const doc = get(PF_ID) || {}, src = {}; Object.keys(PF_SRC).forEach(k => src[k] = !(doc.src && doc.src[k] === false));
  const { ev, miss } = pfEvents(src), def = PF_DEF[bc] || PF_U;
  const units = PF_U.map(u => {
    const e = ev.filter(x => x.u === u), x = doc.unit && doc.unit[u] || {};
    const map = { w: {}, m: {}, y: {} }; e.forEach(q => ['w', 'm', 'y'].forEach(k => { const key = pfKey(k, q.t); map[k][key] = (map[k][key] || 0) + q.v; }));
    return { u, ev: e, map, tg: pfTarget(u, doc), aktif: x.aktif != null ? !!x.aktif : def.includes(u) || e.length > 0 };
  });
  return { bc, units, miss, src, by: Object.fromEntries(units.map(x => [x.u, x])) };
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
  return '<section class="card"><div class="chead"><h3>Target produksi ' + esc(BC) + '</h3><div class="cbtns"><button class="btn ghost sm" data-pfsrc>' + ic('edit') + 'Sumber realisasi</button></div></div><div class="tbl"><table><thead><tr><th>Unit</th><th>Status</th><th class="n">Kapasitas efektif / hari</th><th class="n">Target / minggu</th><th class="n">Target / bulan</th><th class="n">Target / tahun</th><th>Dasar</th><th></th></tr></thead><tbody>' +
    D.units.map(x => '<tr><td>' + unitChip(x.u) + ' ' + esc(UNIT_NAME[x.u]) + '</td><td>' + (x.aktif ? chip('Aktif', 'ok') : chip('Tidak aktif', 'mute')) + '</td><td class="n">' + num(daily(x.u).kapEf) + ' ' + PF_SAT[x.u] + '</td>' + ['w', 'm', 'y'].map(k => '<td class="n">' + num(x.tg[k]) + ' ' + PF_SAT[x.u] + '</td>').join('') + '<td class="muted">' + (x.tg.auto ? 'Kapasitas efektif x ' + num(params().global.hari) + ' hari kerja' : 'Manual') + '</td><td><button class="btn ghost sm" data-pftg="' + x.u + '">' + ic('edit') + 'Ubah</button></td></tr>').join('') + '</tbody></table></div></section>' +
    '<div class="note">Target otomatis mengikuti sheet Target Unit: bulan = kapasitas efektif per hari x hari kerja, minggu = bulan / 4, tahun = bulan x 12. Kapasitas diubah di HPP &amp; BUASO › Parameter &amp; Biaya Harian.</div>';
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
    '<div class="note">Per unit gabungan = jumlah realisasi dibagi jumlah target semua basecamp yang unitnya aktif. Per basecamp = rata-rata pencapaian unit aktifnya. Keseluruhan basecamp = rata-rata pencapaian keempat unit gabungan. Unit dihitung paling tinggi 100%.' + (list.some(D => !D.units.some(x => x.ev.length)) ? ' Belum ada data realisasi: ' + esc(list.filter(D => !D.units.some(x => x.ev.length)).map(D => D.bc).join(', ')) + '.' : '') + '</div>';
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
  const x = pfHere().by[u], d = get(PF_ID) || {}, o = d.unit && d.unit[u] || {}, sat = PF_SAT[u];
  openForm({
    title: 'Target Produksi ' + u, sub: UNIT_NAME[u] + ' · kosongkan untuk memakai kapasitas efektif', small: true, value: { aktif: x.aktif, w: o.w || '', m: o.m || '', y: o.y || '' },
    fields: [{ k: 'aktif', type: 'check', full: true, text: 'Unit ' + u + ' aktif di ' + BC }, { k: 'w', label: 'Target per minggu', type: 'num', suffix: sat }, { k: 'm', label: 'Target per bulan', type: 'num', suffix: sat }, { k: 'y', label: 'Target per tahun', type: 'num', suffix: sat },
      { k: 'tot', type: 'html', html: v => { const m = +v.m > 0 ? +v.m : x.tg.m0; return '<div class="buaso"><div><span>Minggu</span><b>' + num(+v.w > 0 ? +v.w : m / 4) + ' ' + sat + '</b></div><div><span>Bulan</span><b>' + num(m) + ' ' + sat + '</b></div><div><span>Tahun</span><b>' + num(+v.y > 0 ? +v.y : m * (+params().global.bulan || 12)) + ' ' + sat + '</b></div></div>'; } }],
    onSave: v => { if (['w', 'm', 'y'].some(k => +v[k] < 0)) { toast('Target tidak boleh negatif', 'err'); return false; } savePf(q => { q.unit = q.unit || {}; q.unit[u] = { aktif: !!v.aktif, w: +v.w || 0, m: +v.m || 0, y: +v.y || 0 }; }); toast('Target ' + u + ' tersimpan'); }
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
    const multi = typeof EMBED !== 'undefined' && EMBED, tabs = [{ k: 'main', t: 'Keseluruhan Unit' }, { k: 'unit', t: 'Per Unit' }].concat(multi ? [{ k: 'all', t: 'Semua Basecamp' }] : [], [{ k: 'target', t: 'Target Produksi' }]);
    if (!tabs.some(t => t.k === st.tab)) st.tab = 'main';
    let ctl;
    ctl = page(root, {
      key: 'perf', st, report: pfReport, tabs,
      actions: [{ id: 'real', t: 'Catat Produksi', icon: 'prod' }],
      on: { real: () => { if (all('prod').some(p => p.status !== 'Batal' && soStats(p).sisaProd > 0)) realForm(); else { toast('Belum ada SO / WO terbuka. Buat dulu di Kartu Produksi.', 'err'); location.hash = '#/prod'; } } },
      filter: s => s.tab === 'target' ? '' : pfHead(s.mode, s.key) + (s.tab === 'unit' ? '<div class="fbar"><div class="seg" data-ps="unit">' + PF_U.map(u => '<button class="' + (s.unit === u ? 'on' : '') + '" data-v="' + u + '">' + u + ' · ' + UNIT_PROD[u] + '</button>').join('') + '</div></div>' : ''),
      bindFilter: (el, s, redraw) => { pfHeadBind(el, s, redraw); $$('[data-ps] button', el).forEach(b => b.onclick = () => { s.unit = b.dataset.v; persist('perf'); redraw(); }); },
      body: s => {
        PF.ch = [];
        let h;
        if (s.tab === 'all') h = PF.all ? pfAllHtml(pfList(PF.all.bcs, Object.assign(PF.all.data, { [BCN]: S.docs })), s) : '<div class="empty"><p>' + esc(PF.err || 'Memuat data semua basecamp…') + '</p></div>';
        else if (s.tab === 'target') h = editBadge('Target Produksi') + pfTargetHtml(pfHere());
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
async function pfReport(s) {
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
