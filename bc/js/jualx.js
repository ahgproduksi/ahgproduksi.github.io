/* Penjualan dari rekap Google Sheet (kind 'jualx', diimpor oleh deploy-ahg/sheet-import/import.py):
   kategori Eksternal (retail) dan Internal (tagihan ke HO / proyek PT. AHG). Dipakai kartu Marketing, Cash Flow, dan Customer.
   tipe: 'order' (SPH / tagihan / penjualan), 'bayar' (pelunasan piutang SPH lama), 'piutang' (kurang bayar per SPH), 'analisa' (rekap bulanan sheet). */
'use strict';
const JX_KAT = ['Eksternal', 'Internal'];
const JX_ST = ['Penawaran', 'Negosiasi', 'Revisi', 'Proses', 'Selesai', 'Batal', 'Ditagihkan', 'Diterima'];
const jxAll = () => memo('jx', () => all('jualx').filter(d => d.tipe !== 'analisa' && d.tipe !== 'info').sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)) || (a.row || 0) - (b.row || 0)));
const jxHas = () => jxAll().length > 0 || (typeof kegSales === 'function' && kegSales().length > 0);
const jxAnalisa = () => memo('jxan', () => ((all('jualx').find(d => d.tipe === 'analisa') || {}).rows || []).slice().sort((a, b) => a.m.localeCompare(b.m)));
function jxRows(s) {
  s = s || {};
  return jxAll().filter(d => (!s.kat || d.kat === s.kat) && (!s.unit || d.unit === s.unit) && (!s.month || d.bulan === s.month) && (!s.year || String(d.bulan).startsWith(s.year)) &&
    (!s.tipe || d.tipe === s.tipe) && (!s.status || d.status === s.status) && qMatch(s.q, d.nama, d.produk, d.sph, d.so, d.inv, d.proyek, d.status, d.bayar, d.ket));
}
// piutang retail = nilai barang yang SUDAH terkirim dikurangi uang masuk (SPH yang belum dikirim bukan piutang)
const jxPiutKirim = d => { if (d.tipe !== 'order' || d.status === 'Batal') return 0; const v = +d.vol || 0, k = +d.kirim || 0; const kirim = v > 0 ? (+d.nilai || 0) * Math.min(1, k / v) : d.status === 'Selesai' ? +d.nilai || 0 : 0; return Math.max(0, kirim - (+d.masuk || 0)); };
const jxSisaNilai = d => d.tipe === 'order' && d.status !== 'Batal' ? Math.max(0, (+d.nilai || 0) - (+d.masuk || 0)) : 0;
function jxTot(rows) {
  const eks = rows.filter(d => d.kat === 'Eksternal'), int = rows.filter(d => d.kat === 'Internal');
  const pe = rows.filter(d => d.tipe === 'piutang'), peSph = new Set(pe.map(d => d.sph).filter(Boolean));
  const eksOrd = eks.filter(d => d.tipe === 'order');
  return {
    sph: new Set(eksOrd.filter(d => !d.cont).map(d => d.sph || d.id)).size,
    penawaran: sum(eksOrd, 'nilai'),
    masukEks: sum(eks.filter(d => d.tipe !== 'piutang'), 'masuk'),
    profitEks: sum(eks.filter(d => d.tipe !== 'piutang'), 'profit'),
    tagihInt: sum(int.filter(d => d.tipe === 'order'), 'nilai'),
    terimaInt: sum(int, 'masuk'),
    piutInt: sum(int, jxSisaNilai),
    piutEks: sum(pe, 'kurang') + sum(eksOrd.filter(d => /belum bayar|sudah dp/i.test(d.bayar || '') && !peSph.has(d.sph)), jxPiutKirim),
    orderEks: eksOrd.filter(d => d.status !== 'Batal').length, orderInt: int.filter(d => d.tipe === 'order').length
  };
}
const jxKatChip = k => chip(k || '-', k === 'Internal' ? 'info' : 'ok');
function jxVol(d) { return d.vol ? num(d.vol) + ' ' + (d.sat || '') : '-'; }
const jxUnitOpts = s => '<select data-fk="unit"><option value="">Semua unit</option>' + UNITS.concat('Umum').map(u => '<option' + (s.unit === u ? ' selected' : '') + '>' + u + '</option>').join('') + '</select>';
const jxKatOpts = s => '<select data-fk="kat" title="Kategori penjualan"><option value="">Eksternal & internal</option>' + JX_KAT.map(k => '<option value="' + k + '"' + (s.kat === k ? ' selected' : '') + '>' + (k === 'Internal' ? 'Internal (HO / proyek)' : 'Eksternal (retail)') + '</option>').join('') + '</select>';
const jxSrcNote = () => '<div class="note">' + ic('file') + 'Data dari rekap Google Sheet penjualan unit (eksternal: Laporan Penjualan Unit Retail · internal: Invoice Rekap Tagihan, PIUTANG INT.). Pilih kategori untuk memisahkan penjualan eksternal dan internal.</div>';
const jxByCust = () => memo('jxcu', () => groupBy(jxAll(), d => d.cust || ''));
function jxCustStats(id) {
  const a = (jxByCust()[id] || []), o = a.filter(d => d.tipe === 'order' && d.status !== 'Batal');
  const t = jxTot(a);
  return { order: o.length, last: o.reduce((m, d) => d.tgl > m ? d.tgl : m, ''), jual: t.masukEks + t.tagihInt, piutang: t.piutEks + t.piutInt };
}
function jxDetail(id) {
  if (String(id).startsWith('kgs:')) { if (typeof kegDetail === 'function') kegDetail(id.slice(4)); return; } // penjualan harian dari History Kegiatan
  const d = jxAll().find(x => x.id === id) || jxKirimRows().find(x => x.id === id); if (!d) return;
  if (d.src === 'kirim') return detail({ title: d.nama, sub: 'Catatan pengiriman · ' + tgl(d.tgl), html: infoGrid([['Tanggal', tgl(d.tgl)], ['SO / WO', d.so], ['No. Surat Jalan', d.sj || '-'], ['Unit', d.unit], ['Produk', d.produk], ['Volume', jxVol(d)], ['Nilai', rp(d.nilai)]]) });
  if (d.tipe === 'tagih') return detail({
    title: 'Tagihan ' + (d.noTagih ? 'No. ' + d.noTagih + ' · ' : '') + (d.nama || ''), sub: (d.produk || '') + ' · periode ' + (d.periode || tgl(d.tgl)),
    html: infoGrid([['Periode produksi', d.periode], ['Dari', tgl(d.dari)], ['Sampai', tgl(d.sampai)], ['Unit', d.unit], ['Tonase', num(d.ton) + ' ton'], ['Volume', jxVol(d)],
      ['Nilai tagihan', rp(d.nilai)], ['Terbayar ke PT. AHG', rp(d.masuk)], ['Potongan deposit', rp(d.potong)], ['Sisa', rp(Math.max(0, d.nilai - d.masuk - (d.potong || 0)))],
      d.piutAwal != null ? ['Deposit awal periode', rp(d.piutAwal)] : null, d.piutAkhir != null ? ['Deposit akhir periode', rp(d.piutAkhir)] : null, ['Status', d.status], d.ket ? ['Keterangan', d.ket] : null, ['Sumber', 'Sheet ' + (d.sheet || '')]]),
    buttons: jxCan() ? jxEditBtns(d, () => jxTagihForm(get(d.id))) : []
  });
  detail({
    title: d.nama || d.proyek || 'Penjualan', sub: (d.kat || '') + ' · ' + (d.tipe === 'piutang' ? 'Piutang' : d.tipe === 'bayar' ? 'Pembayaran piutang' : d.kat === 'Internal' ? 'Tagihan proyek internal' : 'SPH / order retail') + ' · ' + monthLabel(d.bulan),
    html: infoGrid([['Kategori', d.kat], ['Tanggal', tgl(d.tgl)], ['Unit', d.unit], d.sph ? ['No. SPH', d.sph] : null, d.so ? ['SO', d.so] : null, d.inv ? ['No. tagihan / invoice', d.inv] : null,
      ['Customer / proyek', d.nama], ['Produk', d.produk], ['Volume', jxVol(d) + (d.ton ? ' · ' + num(d.ton) + ' ton' : '')], d.po ? ['Nilai PO / SO', rp(d.po)] : null,
      [d.kat === 'Internal' ? 'Nilai tagihan' : d.tipe === 'piutang' ? 'Harga SPH' : 'Nominal SPH / penjualan', rp(d.nilai)], ['Uang masuk', rp(d.masuk)], d.tipe === 'piutang' ? ['Kurang bayar', rp(d.kurang)] : null,
      d.profit ? ['Profit', rp(d.profit)] : null, d.kirim || d.sisa ? ['Terkirim / sisa', num(d.kirim) + ' / ' + num(d.sisa) + ' ' + (d.sat || '')] : null, ['Status', d.status], ['Pembayaran', d.bayar],
      d.tglBayar ? ['Tanggal pembayaran', tgl(d.tglBayar)] : null, d.jadwal ? ['Jadwal kirim', tgl(d.jadwal)] : null, d.ket ? ['Keterangan', d.ket] : null, ['Sumber', 'Sheet ' + (d.sheet || '') + (d.row ? ' baris ' + d.row : '')]]) +
      (d.bukti || d.bukti2 ? '<p style="margin-top:10px">' + [d.bukti, d.bukti2].filter(Boolean).map((u, i) => '<a class="btn ghost sm" href="' + esc(u) + '" target="_blank" rel="noopener">' + ic('file') + 'Bukti transfer' + (i ? ' 2' : '') + '</a>').join(' ') + '</p>' : ''),
    buttons: (d.cust && custGet(d.cust) ? [{ id: 'cu', t: 'Lihat customer', icon: 'cust', fn: m => { m.close(); setTimeout(() => custDetail(d.cust), 250); } }] : [])
      .concat(jxCan() && d.tipe === 'order' ? jxEditBtns(d, () => jxForm(get(d.id))) : [])
  });
}
function jxTable(rows, o) {
  o = o || {};
  return table([
    { t: 'Tanggal', f: d => tgl(d.tgl) }, { t: 'Kategori', f: d => jxKatChip(d.kat), raw: true },
    { t: o.sph ? 'No. SPH / Customer' : 'Customer / Proyek', f: d => '<b>' + esc(d.nama || '-') + '</b><small>' + esc([d.sph ? 'SPH ' + d.sph : '', d.so, d.inv].filter(Boolean).join(' · ') || (d.tipe === 'bayar' ? 'pembayaran piutang' : '')) + '</small>', raw: true },
    { t: 'Unit', f: d => unitChip(d.unit || 'Umum'), raw: true }, { t: 'Produk', f: d => d.produk || '-', cls: 'wrap' }, { t: 'Volume', f: d => jxVol(d), num: true },
    { t: o.sph ? 'Nominal SPH' : 'Nilai', f: d => d.nilai ? rp(d.nilai) : '-', num: true }, { t: 'Uang masuk', f: d => d.masuk ? rp(d.masuk) : '-', num: true },
    { t: 'Status', f: d => stChip(d.status || '-') + (d.bayar ? '<small>' + esc(d.bayar) + '</small>' : ''), raw: true }
  ], rows, { click: true, empty: o.empty || 'Belum ada penjualan pada filter ini.', emptyIcon: 'jual', rowAttr: d => 'data-jx="' + esc(d.id) + '"' });
}
function jxBind(el) { $$('tr[data-jx]', el).forEach(tr => tr.onclick = e => { e.stopPropagation(); jxDetail(tr.dataset.jx); }); }
function jxMonths(rows, year) {
  const m = new Map();
  rows.forEach(d => { if (!d.bulan || (year && !d.bulan.startsWith(year))) return; const r = m.get(d.bulan) || { id: d.bulan, m: d.bulan, eks: 0, int: 0, terima: 0, piut: 0, n: 0 }; if (d.kat === 'Eksternal' && d.tipe !== 'piutang') r.eks += +d.masuk || 0; if (d.kat === 'Internal' && d.tipe === 'order') { r.int += +d.nilai || 0; r.terima += +d.masuk || 0; } r.n++; m.set(d.bulan, r); });
  return [...m.values()].sort((a, b) => a.m.localeCompare(b.m));
}

/* ---------- Kartu Penjualan › Penjualan Rekap Sheet (batu Jogoresan, jasa maklon Tempuran, retail Bugel-Klontong) ---------- */
// nilai penjualan: eksternal = nilai barang yang sudah terkirim, internal = nilai yang ditagihkan
const jxNilaiJual = d => { if (d.tipe !== 'order' || d.status === 'Batal') return 0; if (d.kat === 'Internal') return +d.nilai || 0; const v = +d.vol || 0, k = +d.kirim || 0; return v > 0 ? (+d.nilai || 0) * Math.min(1, k / v) : d.status === 'Selesai' ? +d.nilai || 0 : 0; };
const jxKatOf = j => j === 'internal' ? 'Internal' : j === 'eksternal' ? 'Eksternal' : '';
function jxGroup(a, f) { const m = {}; a.forEach(x => { const k = f(x); (m[k] = m[k] || []).push(x); }); return m; }

/* rentang waktu: s.per = minggu | bulan | tahun | semua, s.ref = tanggal acuan (YYYY-MM-DD); minggu = Senin–Minggu */
const JX_PER = [['minggu', 'Mingguan'], ['bulan', 'Bulanan'], ['tahun', 'Tahunan'], ['semua', 'Semua']];
const jxD = x => { const [y, m, d] = String(x).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const jxYmd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const jxAdd = (x, n) => { const d = jxD(x); d.setDate(d.getDate() + n); return jxYmd(d); };
const jxMon = x => { const d = jxD(x); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return jxYmd(d); };
function jxSpan(a, b) {
  if (a === b) return tgl(a);
  const A = jxD(a), B = jxD(b);
  if (A.getFullYear() !== B.getFullYear()) return tgl(a) + ' – ' + tgl(b);
  if (A.getMonth() !== B.getMonth()) return A.getDate() + ' ' + BLN[A.getMonth()] + ' – ' + tgl(b);
  return A.getDate() + '–' + tgl(b);
}
function jxPerInit(s) {
  if (!JX_PER.some(p => p[0] === s.per)) s.per = lsGet(LSP + 'jxper', '') || (s.month === '' ? 'semua' : 'bulan');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.ref || '')) s.ref = s.month && s.month !== curMonth() ? s.month + '-01' : today();
}
function jxRange(s) {
  jxPerInit(s);
  const p = s.per, r = s.ref;
  if (p === 'minggu') { const a = jxMon(r), b = jxAdd(a, 6); return { per: p, a, b, label: 'Minggu ' + jxSpan(a, b) }; }
  if (p === 'bulan') { const ym = r.slice(0, 7), e = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0); return { per: p, a: ym + '-01', b: jxYmd(e), label: monthLabel(ym) }; }
  if (p === 'tahun') { const y = r.slice(0, 4); return { per: p, a: y + '-01-01', b: y + '-12-31', label: 'Tahun ' + y }; }
  return { per: 'semua', a: '', b: '9999-12-31', label: 'Semua periode' };
}
function jxShift(s, k) {
  const d = jxD(s.ref);
  if (s.per === 'minggu') d.setDate(d.getDate() + 7 * k);
  else if (s.per === 'bulan') { d.setDate(1); d.setMonth(d.getMonth() + k); }
  else if (s.per === 'tahun') { d.setMonth(0, 1); d.setFullYear(d.getFullYear() + k); }
  s.ref = jxYmd(d);
}
// kartu lain (Rekap Penjualan, Pengiriman) tetap memakai s.month
function jxSyncMonth(s) { s.month = s.per === 'semua' ? '' : s.ref.slice(0, 7); }
const jxDate = d => d.tgl || (d.bulan ? d.bulan + '-01' : '');
const jxIn = (d, r) => { const t = jxDate(d); return r.per === 'semua' ? true : !!t && t >= r.a && t <= r.b; };
function jxPerBar(s, extra, o) {
  o = o || {};
  const r = jxRange(s), y0 = +today().slice(0, 4);
  const yrs = []; for (let y = y0 + 1; y >= 2024; y--) yrs.push(y);
  const inp = s.per === 'minggu' ? '<input type="date" data-jxref value="' + esc(s.ref) + '" aria-label="Tanggal dalam minggu">'
    : s.per === 'bulan' ? '<input type="month" data-jxref value="' + esc(s.ref.slice(0, 7)) + '" aria-label="Bulan">'
      : s.per === 'tahun' ? '<select data-jxref aria-label="Tahun">' + yrs.map(y => '<option' + (String(y) === s.ref.slice(0, 4) ? ' selected' : '') + '>' + y + '</option>').join('') + '</select>' : '';
  const now = { minggu: 'Minggu ini', bulan: 'Bulan ini', tahun: 'Tahun ini' }[s.per];
  return '<div class="fbar jxbar">' +
    (o.q === false ? '' : '<div class="sbox">' + ic('search') + '<input type="search" placeholder="Cari customer, produk…" value="' + esc(s.q || '') + '" data-fk="q"></div>') + (extra || '') +
    '<div class="seg jxseg" role="group" aria-label="Rentang waktu">' + JX_PER.map(([k, t]) => '<button type="button" data-jxper="' + k + '" class="' + (s.per === k ? 'on' : '') + '">' + t + '</button>').join('') + '</div>' +
    (s.per !== 'semua' ? '<div class="mon"><button type="button" class="ibtn sm" data-jxnav="-1" aria-label="Sebelumnya">' + ic('back') + '</button>' + inp + '<button type="button" class="ibtn sm" data-jxnav="1" aria-label="Berikutnya">' + ic('right') + '</button></div>' +
      '<button type="button" class="btn ghost sm" data-jxnow>' + now + '</button>' : '') +
    '<span class="jxlbl">' + ic('cal') + esc(r.label) + '</span></div>';
}
function jxPerBind(el, s, redraw) {
  const done = () => { jxSyncMonth(s); try { lsSet(LSP + 'jxper', s.per); } catch { } redraw(); };
  $$('[data-jxper]', el).forEach(b => b.onclick = () => { if (s.per === b.dataset.jxper) return; s.per = b.dataset.jxper; done(); });
  $$('[data-jxnav]', el).forEach(b => b.onclick = () => { jxShift(s, +b.dataset.jxnav); done(); });
  const nw = $('[data-jxnow]', el); if (nw) nw.onclick = () => { s.ref = today(); done(); };
  const ip = $('[data-jxref]', el);
  if (ip) ip.onchange = () => { const v = ip.value; if (!v) return; s.ref = s.per === 'bulan' ? v + '-01' : s.per === 'tahun' ? v + '-01-01' : v; done(); };
}
function jxBuckets(r) {
  // tahunan → per bulan, bulanan → per minggu, mingguan → per hari, semua → per bulan
  const out = [];
  if (r.per === 'minggu') { for (let i = 0; i < 7; i++) { const t = jxAdd(r.a, i), d = jxD(t); out.push({ k: t, a: t, b: t, label: HARI[d.getDay()] + ', ' + tgl(t), go: '' }); } return out; }
  if (r.per === 'bulan') {
    let a = jxMon(r.a), i = 1;
    while (a <= r.b) { const b = jxAdd(a, 6), aa = a < r.a ? r.a : a, bb = b > r.b ? r.b : b; out.push({ k: aa, a: aa, b: bb, label: 'Minggu ke-' + i++ + ' · ' + jxSpan(aa, bb), go: 'minggu:' + aa }); a = jxAdd(a, 7); }
    return out;
  }
  if (r.per === 'tahun') { const y = r.a.slice(0, 4); for (let m = 1; m <= 12; m++) { const ym = y + '-' + String(m).padStart(2, '0'); out.push({ k: ym, a: ym + '-01', b: ym + '-31', label: monthLabel(ym), go: 'bulan:' + ym + '-01' }); } return out; }
  return null; // semua: bulan yang ada datanya
}
function jxBucketRows(rows, tg, r) {
  let bs = jxBuckets(r);
  if (!bs) { const ms = [...new Set(rows.concat(tg).map(d => jxDate(d).slice(0, 7)).filter(Boolean))].sort(); bs = ms.map(ym => ({ k: ym, a: ym + '-01', b: ym + '-31', label: monthLabel(ym), go: 'bulan:' + ym + '-01' })); }
  return bs.map(b => {
    const rr = rows.filter(d => { const t = jxDate(d); return t >= b.a && t <= b.b; }), tt = tg.filter(d => { const t = jxDate(d); return t >= b.a && t <= b.b; });
    return Object.assign({ id: b.k, n: rr.length, vol: sum(rr, 'vol'), ton: sum(rr, 'ton'), nilai: sum(rr, jxNilaiJual), masuk: sum(rr, 'masuk') + sum(tt, 'masuk'), potong: sum(tt, 'potong') }, b);
  });
}
const jxBucketHead = r => r.per === 'minggu' ? 'Penjualan per hari' : r.per === 'bulan' ? 'Penjualan per minggu' : 'Penjualan per bulan';

// teks volume ringkas: maksimal 3 satuan dengan transaksi terbanyak (Bugel-Klontong punya M3, Ton, Pcs, Unit, M2, Liter, …)
function jxVolShort(o) {
  const e = Object.entries(o).map(([k, x]) => [k.trim().toUpperCase() === 'TON' ? 'ton' : k, x]).reduce((m, [k, x]) => { m[k] = m[k] || { v: 0, n: 0 }; m[k].v += x.v; m[k].n += x.n; return m; }, {});
  const a = Object.entries(e).sort((p, q) => q[1].n - p[1].n);
  return a.length ? a.slice(0, 3).map(([k, x]) => num(x.v) + ' ' + k).join(' · ') + (a.length > 3 ? ' +' + (a.length - 3) + ' satuan' : '') : '-';
}
/* volume terjual per unit, masing-masing dengan satuannya sendiri (AMP Ton, CMP M3, SCP M3/Ton, PCP Pcs, …).
   Jasa maklon SCP (Tempuran, History Kegiatan) dipisah & dihitung per M3 saja; tonase dari sheet (Jogoresan) ditampilkan di samping M3. */
const JX_UORD = ['AMP', 'CMP', 'SCP', 'PCP'], JX_SORD = ['M3', 'Ton', 'Pcs', 'M2', 'Unit', 'Liter'];
const jxSatN = v => { v = String(v || '').trim(); const u = v.toUpperCase(); return ({ TON: 'Ton', M3: 'M3', M2: 'M2', LS: 'LS', PCS: 'Pcs' })[u] || (v ? v[0].toUpperCase() + v.slice(1).toLowerCase() : ''); };
const jxMaklon = d => !!d.keg || /maklon/i.test(d.produk || '');
function jxVolUnits(rows, acc) {
  acc = acc || {};
  rows.forEach(d => {
    const mk = jxMaklon(d), u = d.unit && d.unit !== 'Umum' ? String(d.unit).toUpperCase() : 'Lainnya', k = u + (mk ? '|maklon' : '');
    const g = acc[k] = acc[k] || { k, unit: u, maklon: mk, sats: {} };
    const add = (sat, v) => { if (!v) return; const x = g.sats[sat] = g.sats[sat] || { v: 0, n: 0 }; x.v += v; x.n++; };
    const sat = jxSatN(d.sat) || 'satuan';
    add(sat, +d.vol || 0);
    if (!mk && sat !== 'Ton') add('Ton', +d.ton || 0);
  });
  return acc;
}
function jxVolMerge(list) { const acc = {}; list.forEach(o => Object.values(o || {}).forEach(g => { const t = acc[g.k] = acc[g.k] || { k: g.k, unit: g.unit, maklon: g.maklon, sats: {} }; Object.entries(g.sats).forEach(([k, x]) => { const y = t.sats[k] = t.sats[k] || { v: 0, n: 0 }; y.v += x.v; y.n += x.n; }); })); return acc; }
function jxVolList(acc) {
  const ui = u => { const i = JX_UORD.indexOf(u); return i < 0 ? (u === 'Lainnya' ? 99 : 50) : i; }, si = k => { const i = JX_SORD.indexOf(k); return i < 0 ? 50 : i; };
  return Object.values(acc || {}).map(g => ({ k: g.k, unit: g.unit, maklon: g.maklon, label: (g.unit === 'Lainnya' ? 'Lainnya' : 'Unit ' + g.unit) + (g.maklon ? ' (jasa maklon)' : ''),
    sats: Object.entries(g.sats).filter(([, x]) => x.v).sort((p, q) => si(p[0]) - si(q[0]) || q[1].n - p[1].n).map(([k, x]) => num(x.v) + ' ' + k) }))
    .filter(g => g.sats.length).sort((a, b) => ui(a.unit) - ui(b.unit) || a.unit.localeCompare(b.unit) || a.maklon - b.maklon);
}
const jxVolTxtU = acc => jxVolList(acc).map(g => g.label + ': ' + g.sats.join(' · ')).join('; ') || '-';
// tampilan: satu baris per unit (label kiri, volume kanan) — kpi besar atau sel tabel (sm)
function jxVolHtml(acc, sm) {
  const l = jxVolList(acc); if (!l.length) return '-';
  return '<div style="display:block;white-space:normal;font-size:' + (sm ? '12.5px' : '14.5px') + ';font-weight:' + (sm ? 500 : 650) + ';line-height:1.35;margin-top:' + (sm ? 0 : 5) + 'px">' + l.map((g, i) =>
    '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:' + (sm ? '1px 0' : '3px 0') + (i ? ';border-top:1px dashed var(--line)' : '') + '">' +
    '<div style="color:var(--muted);font-weight:600;font-size:' + (sm ? '11.5px' : '12.5px') + ';white-space:nowrap">' + esc(g.label) + '</div>' +
    '<div style="text-align:right">' + g.sats.map(esc).join(' · ') + '</div></div>').join('') + '</div>';
}
function jxVolPdf(R, acc, head) { const l = jxVolList(acc); if (!l.length) return; R.h2(head || 'Volume terjual per unit', 'satuan masing-masing unit · jasa maklon dihitung per M3'); R.table(['Unit', 'Volume terjual'], l.map(g => [g.label, g.sats.join(' · ')])); }
/* data penjualan basecamp ini: rekap sheet (order) + penjualan harian dari History Kegiatan (Tempuran, js/kegiatan.js) */
const jxTagih = () => memo('jxtg', () => jxAll().filter(d => d.tipe === 'tagih').sort((a, b) => String(a.tgl).localeCompare(String(b.tgl))));
const jxInfo = () => memo('jxinfo', () => all('jualx').find(d => d.tipe === 'info') || null);
const jxSales = () => memo('jxsales', () => jxAll().filter(d => d.tipe === 'order').concat(typeof kegSales === 'function' ? kegSales() : [])
  .sort((a, b) => String(jxDate(b)).localeCompare(String(jxDate(a))) || (a.row || 0) - (b.row || 0)));
// penjualan dari catatan pengiriman aplikasi (Catat Pengiriman) — ikut dijumlah di rekap semua basecamp
function jxKirimRows() {
  return memo('jxkir', () => all('kirim').map(k => {
    const p = get(k.so); if (!p || p.status === 'Batal') return null;
    return { id: 'kr:' + k.id, tgl: k.tgl, bulan: String(k.tgl || '').slice(0, 7), kat: p.jenis === 'internal' ? 'Internal' : 'Eksternal', tipe: 'order', nama: p.proyek || custName(p.cust), produk: p.produk, unit: p.unit,
      vol: +k.vol || 0, sat: p.sat, kirim: +k.vol || 0, nilai: (+k.vol || 0) * (+p.harga || 0), masuk: 0, status: 'Selesai', bayar: 'Dari catatan pengiriman', so: p.no, sj: k.sj, src: 'kirim', nobayar: true };
  }).filter(Boolean));
}
const jxF = (d, s) => (!s.kat || d.kat === s.kat) && (!s.unit || (d.unit || 'Umum') === s.unit) && qMatch(s.q, d.nama, d.produk, d.sph, d.so, d.inv, d.proyek, d.status, d.bayar, d.ket, d.periode);
function jxSel(s, o) {
  o = o || {};
  const r = jxRange(s), f = { kat: jxKatOf(s.jenis), unit: s.unit, q: s.q };
  const src = jxSales().concat(o.kirim ? jxKirimRows() : []);
  const rows = src.filter(d => jxIn(d, r) && jxF(d, f));
  const tgAll = jxTagih().filter(t => jxF(t, f));
  const tg = tgAll.filter(t => jxIn(t, r));
  const nilai = sum(rows, jxNilaiJual), masuk = sum(rows, 'masuk') + sum(tg, 'masuk'), potong = sum(tg, 'potong');
  let belum;
  if (tgAll.length) { // basecamp bertagihan periode (Tempuran): posisi sisa tagihan s/d akhir rentang + produksi yang belum ditagihkan
    const upto = tgAll.filter(t => jxDate(t) <= r.b), last = upto.reduce((m, t) => (t.sampai || t.tgl) > m ? (t.sampai || t.tgl) : m, '');
    belum = sum(upto, t => Math.max(0, (+t.nilai || 0) - (+t.masuk || 0) - (+t.potong || 0))) + sum(src.filter(d => d.keg && jxF(d, f) && d.tgl > last && d.tgl <= r.b), jxNilaiJual) +
      sum(rows.filter(d => !d.keg && !d.nobayar), d => Math.max(0, jxNilaiJual(d) - (+d.masuk || 0)));
  } else belum = sum(rows.filter(d => !d.nobayar), d => Math.max(0, jxNilaiJual(d) - (+d.masuk || 0)));
  const vu = jxVolUnits(rows), volTxt = jxVolTxtU(vu);
  return { r, rows, tg, tgAll, n: rows.length, nilai, masuk, potong, belum, posisi: !!tgAll.length, ton: sum(rows.filter(d => !jxMaklon(d)), 'ton'), volTxt, vu, vols: jxGroup(rows.filter(d => d.vol), d => d.sat || ''), profit: sum(rows, 'profit') };
}
function jxJualSum(month) { const x = jxSel({ per: month ? 'bulan' : 'semua', ref: (month || curMonth()) + '-01' }); return { nilai: x.nilai, masuk: x.masuk, profit: x.profit, n: x.n }; }
function jxKpis(x, sub) {
  return '<div class="kpis">' + kpi('Nilai penjualan', rpS(x.nilai), esc(x.r.label) + ' · ' + x.n + ' transaksi', 'good') + kpi('Volume terjual', jxVolHtml(x.vu), jxVolList(x.vu).some(g => g.maklon) ? 'jasa maklon dihitung per M3' : 'per unit · satuan masing-masing') +
    kpi('Uang masuk', rpS(x.masuk), (x.nilai ? pct(x.masuk / x.nilai) + ' dari nilai' : '') + (x.potong ? ' · potongan deposit ' + rpS(x.potong) : '')) +
    kpi('Belum terbayar', rpS(x.belum), x.posisi ? 'posisi s/d ' + (x.r.per === 'semua' ? 'hari ini' : tgl(x.r.b < today() ? x.r.b : today())) : (sub || x.r.label), x.belum > 0.5 ? 'warn' : '') + '</div>';
}
function jxProdTable(rows, r) {
  const prod = Object.entries(jxGroup(rows, d => (d.unit || 'Umum') + '|' + (d.produk || '-'))).map(([k, a]) => ({ id: k, unit: k.split('|')[0], produk: k.split('|')[1], n: a.length, vol: sum(a, 'vol'), sat: (a.find(d => d.sat) || {}).sat || '', ton: sum(a, 'ton'), nilai: sum(a, jxNilaiJual), masuk: sum(a, 'masuk') })).sort((a, b) => b.nilai - a.nilai);
  return prod.length ? '<section class="card"><div class="chead"><h3>Per produk</h3><div class="cmeta">' + esc(r.label) + '</div></div>' + table([
    { t: 'Unit', f: x => unitChip(x.unit), raw: true }, { t: 'Produk', f: x => x.produk, cls: 'strong' }, { t: 'Transaksi', f: x => x.n, num: true },
    { t: 'Volume', f: x => x.vol ? num(x.vol) + ' ' + x.sat : '-', num: true }, { t: 'Tonase', f: x => x.ton ? num(x.ton) + ' ton' : '-', num: true },
    { t: 'Nilai penjualan', f: x => rp(x.nilai), num: true }], prod) + '</section>' : '';
}
function jxBucketTable(x) {
  const bs = jxBucketRows(x.rows, x.tg, x.r);
  const foot = '<tfoot><tr><td class="tl">Total</td><td class="n">' + num(sum(bs, 'n')) + '</td><td class="n">' + num(sum(bs, 'vol')) + '</td><td class="n">' + num(sum(bs, 'ton')) + '</td><td class="n">' + rp(sum(bs, 'nilai')) + '</td><td class="n">' + rp(sum(bs, 'masuk')) + '</td></tr></tfoot>';
  return '<section class="card"><div class="chead"><h3>' + jxBucketHead(x.r) + '</h3><div class="cmeta">' + esc(x.r.label) + (x.r.per !== 'minggu' ? ' · klik baris untuk rinciannya' : '') + '</div></div>' + table([
    { t: x.r.per === 'minggu' ? 'Hari' : x.r.per === 'bulan' ? 'Minggu' : 'Bulan', f: b => '<b>' + esc(b.label) + '</b>', raw: true }, { t: 'Transaksi', f: b => b.n, num: true }, { t: 'Volume', f: b => num(b.vol), num: true },
    { t: 'Tonase', f: b => num(b.ton), num: true }, { t: 'Nilai penjualan', f: b => b.nilai ? rp(b.nilai) : '-', num: true }, { t: 'Uang masuk', f: b => b.masuk ? rp(b.masuk) : '-', num: true }],
  bs, { empty: 'Belum ada data.', rowAttr: b => b.go ? 'data-jxgo="' + esc(b.go) + '" class="click"' : '' }).replace('</table>', foot + '</table>') + '</section>';
}
function jxTagihTable(x, all) {
  const r = x.r, inf = jxInfo() || {};
  const tg = all ? x.tgAll : x.tgAll.filter(t => r.per === 'semua' || ((t.sampai || t.tgl) >= r.a && (t.dari || t.tgl) <= r.b));
  const T = x.tgAll, pot = sum(T, 'potong'), dep = +inf.deposit || 0, sisaDep = dep - pot, sisaTg = sum(T, t => Math.max(0, t.nilai - t.masuk - (t.potong || 0)));
  const hari = inf.harga && inf.targetHari ? sisaDep / inf.harga / inf.targetHari : 0;
  return '<section class="card"><div class="chead"><h3>Tagihan &amp; pembayaran ' + esc(inf.nama || (T[0] || {}).nama || '') + '</h3><div class="cmeta">History Tagihan sheet · ' + (all || r.per === 'semua' ? 'semua periode' : 'periode tagihan yang bersinggungan dengan ' + esc(r.label)) + '</div></div>' +
    (dep ? '<div class="kpis" style="margin:0 14px 12px">' + kpi('Deposit customer', rpS(dep), 'deposit awal + deposit kedua') + kpi('Potongan deposit', rpS(pot), pct(dep ? pot / dep : 0) + ' dari deposit') +
      kpi('Sisa deposit', rpS(sisaDep), hari ? '≈ ' + num(Math.round(hari)) + ' hari produksi @ ' + num(inf.targetHari) + ' M3/hari' : '', 'warn') + kpi('Terbayar ke PT. AHG', rpS(sum(T, 'masuk')), 'sisa tagihan ' + rpS(sisaTg), sisaTg > 0.5 ? 'warn' : 'good') + '</div>' : '') +
    table([
      { t: 'No', f: t => t.noTagih || '', num: true }, { t: 'Periode produksi', f: t => '<b>' + esc(t.periode || tgl(t.tgl)) + '</b><small>' + esc(t.produk || '') + '</small>', raw: true },
      { t: 'Tonase', f: t => t.ton ? num(t.ton) : '-', num: true }, { t: 'Volume', f: t => t.vol ? num(t.vol) + ' ' + (t.sat || '') : '-', num: true },
      { t: 'Tagihan', f: t => rp(t.nilai), num: true }, { t: 'Terbayar', f: t => t.masuk ? rp(t.masuk) : '-', num: true }, { t: 'Potongan deposit', f: t => t.potong ? rp(t.potong) : '-', num: true },
      { t: 'Sisa', f: t => { const v = Math.max(0, t.nilai - t.masuk - (t.potong || 0)); return v > 0.5 ? '<b class="t-warn">' + rp(v) + '</b>' : '<span class="t-ok">Lunas</span>'; }, num: true, raw: true },
      { t: 'Keterangan', f: t => t.ket || '-', cls: 'wrap' }],
    tg, { empty: 'Tidak ada periode tagihan pada rentang ini.', rowAttr: t => 'data-jx="' + esc(t.id) + '" class="click"' })
      .replace('</table>', tg.length ? '<tfoot><tr><td></td><td class="tl">Total</td><td class="n">' + num(sum(tg, 'ton')) + '</td><td class="n">' + num(sum(tg, 'vol')) + '</td><td class="n">' + rp(sum(tg, 'nilai')) + '</td><td class="n">' + rp(sum(tg, 'masuk')) + '</td><td class="n">' + rp(sum(tg, 'potong')) + '</td><td class="n">' + rp(sum(tg, t => Math.max(0, t.nilai - t.masuk - (t.potong || 0)))) + '</td><td></td></tr></tfoot></table>' : '</table>') +
    (inf.ket ? '<div class="note" style="margin:10px 14px 14px">' + esc(inf.ket) + '</div>' : '') + '</section>';
}
function jxJualHtml(s) {
  const x = jxSel(s);
  const keg = x.rows.some(d => d.keg) || x.tgAll.length;
  return '<div class="note">' + ic('file') + (keg
    ? 'Penjualan ' + esc(BC) + ': nilai harian = volume produksi (M3) di History Kegiatan × harga jasa maklon; uang masuk dan potongan deposit dari History Tagihan (Google Sheet Rekapitulasi Produksi SCP Tempuran).'
    : 'Penjualan ' + esc(BC) + ' dari rekap Google Sheet (diimpor ke kartu ini). Nilai penjualan eksternal = nilai barang yang sudah terkirim; internal = nilai yang ditagihkan.') + '</div>' +
    jxEditBar({ tagih: x.tgAll.length || (typeof kegOn === 'function' && kegOn()) }) + jxKpis(x) + (x.tgAll.length ? jxTagihTable(x) : '') + jxProdTable(x.rows, x.r) + jxBucketTable(x) +
    '<section class="card"><div class="chead"><h3>Rincian penjualan · ' + esc(x.r.label) + '</h3><div class="cmeta">' + x.n + ' baris</div></div>' + jxTable(x.rows) + '</section>';
}
function jxJualBind(el, s, redraw) {
  jxBind(el); jxEditBind(el);
  $$('tr[data-jxgo]', el).forEach(tr => tr.onclick = e => { e.stopPropagation(); const [p, ref] = tr.dataset.jxgo.split(':'); s.per = p; s.ref = ref; jxSyncMonth(s); redraw(); });
}
async function jxJualReport(s) {
  const x = jxSel(s), r = x.r;
  const R = await pdfReport({ title: 'Laporan Penjualan Unit', sub: BC + ' · ' + (jxKatOf(s.jenis) || 'Eksternal & Internal') + (s.unit ? ' · ' + s.unit : '') + ' · ' + r.label + (r.per !== 'semua' ? ' (' + tgl(r.a) + ' – ' + tgl(r.b) + ')' : ''), orient: 'l', fname: 'Penjualan_' + BCN.replace(/[^A-Za-z0-9]+/g, '_') + '_' + r.label.replace(/[^A-Za-z0-9]+/g, '_') });
  R.kv([['Nilai penjualan', 'Rp ' + R_(x.nilai)], ['Uang masuk', 'Rp ' + R_(x.masuk)], ['Belum terbayar', 'Rp ' + R_(x.belum), x.belum > 0.5 ? 'red' : ''], ['Transaksi', String(x.n)]].concat(x.ton ? [['Tonase', N_(x.ton) + ' ton']] : [], x.potong ? [['Potongan deposit', 'Rp ' + R_(x.potong)]] : []), 4);
  jxVolPdf(R, x.vu);
  const bs = jxBucketRows(x.rows, x.tg, r);
  R.h2(jxBucketHead(r), r.label);
  R.table([r.per === 'minggu' ? 'Hari' : r.per === 'bulan' ? 'Minggu' : 'Bulan', 'Transaksi', 'Volume', 'Tonase', 'Nilai Penjualan', 'Uang Masuk'], bs.map(b => [b.label, cellR(N_(b.n)), cellR(N_(b.vol)), cellR(N_(b.ton)), cellR(R_(b.nilai)), cellR(R_(b.masuk))]),
    { foot: ['Total', cellR(N_(sum(bs, 'n'))), cellR(N_(sum(bs, 'vol'))), cellR(N_(sum(bs, 'ton'))), cellR(R_(sum(bs, 'nilai'))), cellR(R_(sum(bs, 'masuk')))] });
  if (x.tgAll.length) {
    const tg = x.tgAll.filter(t => r.per === 'semua' || ((t.sampai || t.tgl) >= r.a && (t.dari || t.tgl) <= r.b));
    R.h2('Tagihan & pembayaran', (jxInfo() || {}).nama || '');
    R.table(['No', 'Periode Produksi', 'Tonase', 'Volume', 'Tagihan', 'Terbayar', 'Potongan Deposit', 'Sisa', 'Keterangan'],
      tg.map(t => [String(t.noTagih || ''), t.periode || tgl(t.tgl), cellR(N_(t.ton)), cellR(N_(t.vol)), cellR(R_(t.nilai)), cellR(R_(t.masuk)), cellR(R_(t.potong)), cellR(R_(Math.max(0, t.nilai - t.masuk - (t.potong || 0)))), t.ket || '-']),
      { fs: 7, foot: ['', 'Total', cellR(N_(sum(tg, 'ton'))), cellR(N_(sum(tg, 'vol'))), cellR(R_(sum(tg, 'nilai'))), cellR(R_(sum(tg, 'masuk'))), cellR(R_(sum(tg, 'potong'))), cellR(R_(sum(tg, t => Math.max(0, t.nilai - t.masuk - (t.potong || 0))))), ''] });
  }
  R.h2('Rincian penjualan', r.label);
  R.table(['Tanggal', 'Kategori', 'Customer / Proyek', 'Unit', 'Produk', 'Volume', 'Tonase', 'Nilai', 'Uang Masuk', 'Status', 'Pembayaran'],
    x.rows.map(d => [tgl(d.tgl), d.kat, d.nama, d.unit, d.produk || '-', cellR(d.vol ? N_(d.vol) + ' ' + (d.sat || '') : '-'), cellR(d.ton ? N_(d.ton) : '-'), cellR(R_(jxNilaiJual(d))), cellR(R_(d.masuk)), d.status || '-', d.bayar || '-']),
    { fs: 7, foot: ['Total', '', '', '', '', '', cellR(N_(x.ton)), cellR(R_(x.nilai)), cellR(R_(sum(x.rows, 'masuk'))), '', ''] });
  R.sign();
  await R.save();
}

/* ---------- Rekap Semua Basecamp › Penjualan: list penjualan per basecamp + grand total (dipanggil embed.js per basecamp lewat withDocs) ---------- */
function jxBcData(s) { const x = jxSel(s, { kirim: true }); x.buckets = jxBucketRows(x.rows, x.tg, x.r); x.rows = x.rows.slice(); return x; }
function jxAllHtml(list, s) {
  const r = jxRange(s), ok = list.filter(b => b.x), T = k => sum(ok, b => b.x[k]);
  const vuAll = jxVolMerge(ok.map(b => b.x.vu));
  const tot = T('nilai');
  const badge = bc => '<span class="bcbadge sm" style="--bct:' + bcTone(bc) + '">' + esc(bc) + '</span>';
  const sumT = '<section class="card"><div class="chead"><h3>Penjualan per basecamp</h3><div class="cmeta">' + esc(r.label) + (r.per !== 'semua' ? ' · ' + tgl(r.a) + ' – ' + tgl(r.b) : '') + '</div></div>' + table([
    { t: 'Basecamp', f: b => badge(b.bc), raw: true }, { t: 'Transaksi', f: b => b.x ? num(b.x.n) : 'Memuat…', num: true }, { t: 'Volume per unit', f: b => b.x ? jxVolHtml(b.x.vu, true) : '', raw: true },
    { t: 'Tonase', f: b => b.x && b.x.ton ? num(b.x.ton) + ' ton' : '-', num: true }, { t: 'Nilai penjualan', f: b => b.x ? '<b>' + rp(b.x.nilai) + '</b>' : '', num: true, raw: true },
    { t: 'Uang masuk', f: b => b.x ? rp(b.x.masuk) + (b.x.potong ? '<small>+ potongan deposit ' + rpS(b.x.potong) + '</small>' : '') : '', num: true, raw: true },
    { t: 'Belum terbayar', f: b => b.x ? '<span class="' + (b.x.belum > 0.5 ? 't-warn' : '') + '">' + rp(b.x.belum) + '</span>' : '', num: true, raw: true },
    { t: 'Kontribusi', f: b => b.x ? '<div class="mini"><b>' + pct(tot ? b.x.nilai / tot : 0) + '</b>' + bar(tot ? b.x.nilai / tot : 0, 'info') + '</div>' : '', raw: true },
    { t: '', f: b => '<button class="btn sm" data-pick="' + esc(b.bc) + '">Buka' + ic('right') + '</button>', raw: true }
  ], list.map((b, i) => Object.assign({ id: i }, b))).replace('</table>', '<tfoot><tr class="gt"><td class="tl">GRAND TOTAL</td><td class="n">' + num(T('n')) + '</td><td>' + jxVolHtml(vuAll, true) + '</td><td class="n">' + num(T('ton')) + ' ton</td><td class="n">' + rp(tot) + '</td><td class="n">' + rp(T('masuk')) + '</td><td class="n">' + rp(T('belum')) + '</td><td>100%</td><td></td></tr></tfoot></table>') + '</section>';
  // per periode × basecamp
  const bk = (ok[0] && ok[0].x.buckets || []).map((b, i) => Object.assign({}, b, { per: ok.map(o => o.x.buckets[i] || { nilai: 0 }) }));
  if (r.per === 'semua') { const ms = [...new Set(ok.flatMap(o => o.x.buckets.map(b => b.k)))].sort(); bk.length = 0; ms.forEach(k => bk.push({ k, label: monthLabel(k), go: 'bulan:' + k + '-01', per: ok.map(o => o.x.buckets.find(b => b.k === k) || { nilai: 0 }) })); }
  const perT = bk.length ? '<section class="card"><div class="chead"><h3>' + jxBucketHead(r) + ' per basecamp</h3><div class="cmeta">nilai penjualan' + (r.per !== 'minggu' ? ' · klik baris untuk rinciannya' : '') + '</div></div><div class="tbl"><table><thead><tr><th>' + (r.per === 'minggu' ? 'Hari' : r.per === 'bulan' ? 'Minggu' : 'Bulan') + '</th>' +
    ok.map(o => '<th class="n">' + esc(o.bc) + '</th>').join('') + '<th class="n">Total</th></tr></thead><tbody>' +
    bk.map(b => '<tr' + (b.go ? ' class="click" data-jxgo="' + esc(b.go) + '"' : '') + '><td><b>' + esc(b.label) + '</b></td>' + b.per.map(p => '<td class="n">' + (p.nilai ? rp(p.nilai) : '-') + '</td>').join('') + '<td class="n"><b>' + rp(sum(b.per, 'nilai')) + '</b></td></tr>').join('') +
    '</tbody><tfoot><tr class="gt"><td class="tl">GRAND TOTAL</td>' + ok.map(o => '<td class="n">' + rp(o.x.nilai) + '</td>').join('') + '<td class="n">' + rp(tot) + '</td></tr></tfoot></table></div></section>' : '';
  const MAX = 25;
  const lists = list.map(b => {
    if (!b.x) return '<section class="card"><div class="chead"><h3 class="bcx-h">' + badge(b.bc) + ' Penjualan</h3></div><div class="empty"><p>Memuat data…</p></div></section>';
    const all = !!(s.more || {})[b.bc], rows = all ? b.x.rows : b.x.rows.slice(0, MAX);
    return '<section class="card"><div class="chead"><h3 class="bcx-h">' + badge(b.bc) + ' List penjualan</h3><div class="cmeta">' + num(b.x.n) + ' transaksi · ' + rp(b.x.nilai) + ' · uang masuk ' + rpS(b.x.masuk) + '</div></div>' +
      jxTable(rows, { empty: 'Belum ada penjualan Basecamp ' + b.bc + ' pada ' + r.label + '.' }).replace('</table>', rows.length ? '<tfoot><tr><td class="tl" colspan="5">Subtotal ' + esc(b.bc) + (rows.length < b.x.n ? ' (semua ' + num(b.x.n) + ' baris)' : '') + '</td><td>' + jxVolHtml(b.x.vu, true) + '</td><td class="n">' + rp(b.x.nilai) + '</td><td class="n">' + rp(sum(b.x.rows, 'masuk')) + '</td><td></td></tr></tfoot></table>' : '</table>') +
      (b.x.n > MAX ? '<div class="cfoot"><button class="btn ghost sm" data-jxmore="' + esc(b.bc) + '">' + (all ? 'Ringkas (' + MAX + ' baris terbaru)' : 'Tampilkan semua ' + num(b.x.n) + ' baris') + '</button> <button class="btn ghost sm" data-pick="' + esc(b.bc) + '">Buka kartu Penjualan ' + esc(b.bc) + ic('right') + '</button></div>' : '') + '</section>';
  }).join('');
  return '<div class="kpis">' + kpi('Grand total penjualan', rpS(tot), esc(r.label) + ' · ' + num(T('n')) + ' transaksi · ' + ok.length + ' basecamp', 'good') + kpi('Volume terjual', jxVolHtml(vuAll), 'semua basecamp per unit · maklon Tempuran per M3') +
    kpi('Uang masuk', rpS(T('masuk')), (tot ? pct(T('masuk') / tot) + ' dari nilai' : '') + (T('potong') ? ' · potongan deposit ' + rpS(T('potong')) : '')) + kpi('Belum terbayar', rpS(T('belum')), 'semua basecamp', T('belum') > 0.5 ? 'warn' : '') + '</div>' +
    sumT + perT + '<div class="sech"><h2>List penjualan per basecamp</h2><p>Penjualan rekap sheet, penjualan harian dari History Kegiatan (Tempuran), dan catatan pengiriman tiap basecamp pada ' + esc(r.label) + '.</p></div>' + lists;
}
async function jxAllReport(list, s) {
  const r = jxRange(s), ok = list.filter(b => b.x), T = k => sum(ok, b => b.x[k]);
  const R = await pdfReport({ title: 'Rekap Penjualan Semua Basecamp', sub: 'PT. Armada Hada Graha · ' + r.label + (r.per !== 'semua' ? ' (' + tgl(r.a) + ' – ' + tgl(r.b) + ')' : '') + ' · per ' + tgl(today(), true), orient: 'l', fname: 'Penjualan_Semua_Basecamp_' + r.label.replace(/[^A-Za-z0-9]+/g, '_') });
  R.kv([['Grand total penjualan', 'Rp ' + R_(T('nilai'))], ['Uang masuk', 'Rp ' + R_(T('masuk'))], ['Belum terbayar', 'Rp ' + R_(T('belum')), T('belum') > 0.5 ? 'red' : ''], ['Transaksi', N_(T('n'))]], 4);
  jxVolPdf(R, jxVolMerge(ok.map(b => b.x.vu)), 'Volume terjual per unit (semua basecamp)');
  R.h2('Penjualan per basecamp', r.label);
  R.table(['Basecamp', 'Transaksi', 'Volume', 'Tonase', 'Nilai Penjualan', 'Uang Masuk', 'Potongan Deposit', 'Belum Terbayar', 'Kontribusi'],
    ok.map(b => [b.bc, cellR(N_(b.x.n)), cellR(b.x.volTxt), cellR(N_(b.x.ton)), cellR(R_(b.x.nilai)), cellR(R_(b.x.masuk)), cellR(R_(b.x.potong)), cellR(R_(b.x.belum)), cellR(pct(T('nilai') ? b.x.nilai / T('nilai') : 0))]),
    { foot: ['GRAND TOTAL', cellR(N_(T('n'))), '', cellR(N_(T('ton'))), cellR(R_(T('nilai'))), cellR(R_(T('masuk'))), cellR(R_(T('potong'))), cellR(R_(T('belum'))), cellR('100%')] });
  const ks = [...new Set(ok.flatMap(o => o.x.buckets.filter(b => b.nilai).map(b => b.k)))].sort();
  if (ks.length) {
    R.h2(jxBucketHead(r) + ' per basecamp', 'nilai penjualan');
    R.table([r.per === 'minggu' ? 'Hari' : r.per === 'bulan' ? 'Minggu' : 'Bulan'].concat(ok.map(o => o.bc), ['Total']),
      ks.map(k => { const ps = ok.map(o => o.x.buckets.find(b => b.k === k) || { nilai: 0 }), lb = (ok.map(o => o.x.buckets.find(b => b.k === k)).find(Boolean) || {}).label || k; return [lb].concat(ps.map(p => cellR(R_(p.nilai))), [cellR(R_(sum(ps, 'nilai')))]); }),
      { foot: ['GRAND TOTAL'].concat(ok.map(o => cellR(R_(o.x.nilai))), [cellR(R_(T('nilai')))]) });
  }
  ok.forEach(b => {
    if (!b.x.n) return;
    R.h2('Basecamp ' + b.bc, num(b.x.n) + ' transaksi · Rp ' + R_(b.x.nilai));
    R.table(['Tanggal', 'Kategori', 'Customer / Proyek', 'Unit', 'Produk', 'Volume', 'Nilai', 'Uang Masuk', 'Status'],
      b.x.rows.map(d => [tgl(d.tgl), d.kat, d.nama, d.unit, d.produk || '-', cellR(d.vol ? N_(d.vol) + ' ' + (d.sat || '') : '-'), cellR(R_(jxNilaiJual(d))), cellR(R_(d.masuk)), [d.status, d.bayar].filter(Boolean).join(' · ') || '-']),
      { fs: 7, foot: ['Subtotal ' + b.bc, '', '', '', '', cellR(b.x.volTxt), cellR(R_(b.x.nilai)), cellR(R_(sum(b.x.rows, 'masuk'))), ''] });
  });
  R.sign();
  await R.save();
}

/* ---------- Cash Flow › Penjualan Unit ---------- */
function jxKasHtml(s) {
  const base = { kat: s.kat, unit: s.unit, q: s.q };
  const rowsM = jxRows(Object.assign({}, base, { month: s.month })).filter(d => d.tipe !== 'piutang');
  const t = jxTot(rowsM), all0 = jxTot(jxRows(base));
  const year = (s.month || curMonth()).slice(0, 4);
  const months = jxMonths(jxRows(base), s.month ? year : '');
  const pi = jxRows(Object.assign({}, base, { tipe: 'piutang' }));
  return jxSrcNote() + '<div class="kpis">' +
    (s.kat !== 'Internal' ? kpi('Uang masuk penjualan eksternal', rpS(t.masukEks), monthLabel(s.month) + ' · profit ' + rpS(t.profitEks), 'good') : '') +
    (s.kat !== 'Eksternal' ? kpi('Penjualan internal (ditagihkan)', rpS(t.tagihInt), monthLabel(s.month) + (t.terimaInt ? ' · diterima ' + rpS(t.terimaInt) : '')) : '') +
    (s.kat !== 'Eksternal' ? kpi('Piutang internal HO / proyek', rpS(all0.piutInt), 'semua periode', all0.piutInt ? 'warn' : '') : '') +
    (s.kat !== 'Internal' ? kpi('Piutang eksternal', rpS(all0.piutEks), 'kurang bayar customer retail', all0.piutEks ? 'warn' : '') : '') + '</div>' +
    '<section class="card"><div class="chead"><h3>Arus penjualan per bulan</h3><div class="cmeta">' + (s.month ? 'Tahun ' + year : 'Semua periode') + ' · klik bulan untuk rinciannya</div></div>' + table([
      { t: 'Bulan', f: r => '<b>' + esc(monthLabel(r.m)) + '</b>', raw: true },
      { t: 'Eksternal (uang masuk)', f: r => rp(r.eks), num: true },
      { t: 'Internal (ditagihkan)', f: r => rp(r.int), num: true }, { t: 'Internal diterima', f: r => rp(r.terima), num: true },
      { t: 'Total penjualan', f: r => '<b>' + rp(r.eks + r.int) + '</b>', num: true, raw: true }
    ].filter(c => !(s.kat === 'Internal' && /Eksternal/.test(c.t)) && !(s.kat === 'Eksternal' && /Internal/.test(c.t))), months, { click: true, empty: 'Belum ada data.', rowAttr: r => 'data-jxm="' + esc(r.m) + '"' }) +
    (months.length ? '<div class="note" style="margin:10px 14px 14px"><b>Total:</b> eksternal ' + rp(sum(months, 'eks')) + ' · internal ' + rp(sum(months, 'int')) + ' · semua ' + rp(sum(months, r => r.eks + r.int)) + '</div>' : '') + '</section>' +
    '<section class="card"><div class="chead"><h3>Rincian penjualan ' + esc(monthLabel(s.month)) + '</h3><div class="cmeta">' + rowsM.length + ' baris</div></div>' + jxTable(rowsM) + '</section>' +
    (pi.length && s.kat !== 'Internal' ? '<section class="card"><div class="chead"><h3>Piutang eksternal per SPH</h3><div class="cmeta">sheet PIUTANG EKS.</div></div>' + table([
      { t: 'Tgl SPH', f: d => tgl(d.tgl) }, { t: 'Customer', f: d => '<b>' + esc(d.nama) + '</b><small>SPH ' + esc(d.sph) + (d.so ? ' · ' + esc(d.so) : '') + '</small>', raw: true }, { t: 'Unit', f: d => unitChip(d.unit), raw: true },
      { t: 'Material', f: d => d.produk }, { t: 'Harga SPH', f: d => rp(d.nilai), num: true }, { t: 'Uang masuk', f: d => rp(d.masuk), num: true }, { t: 'Kurang bayar', f: d => '<b class="t-warn">' + rp(d.kurang) + '</b>', num: true, raw: true }
    ], pi, { rowAttr: d => 'data-jx="' + esc(d.id) + '"', click: true }) + '</section>' : '');
}
function jxKasBind(el, s, fill) {
  jxBind(el);
  $$('tr[data-jxm]', el).forEach(tr => tr.onclick = e => { e.stopPropagation(); s.month = tr.dataset.jxm; const ip = document.querySelector('.pfilter input[type=month]'); if (ip) ip.value = s.month; fill(true); });
}
async function jxKasReport(s) {
  const base = { kat: s.kat, unit: s.unit, q: s.q };
  const rowsM = jxRows(Object.assign({}, base, { month: s.month })).filter(d => d.tipe !== 'piutang');
  const t = jxTot(rowsM), a0 = jxTot(jxRows(base));
  const months = jxMonths(jxRows(base), s.month ? s.month.slice(0, 4) : '');
  const R = await pdfReport({ title: 'Laporan Penjualan Unit', sub: BC + ' · ' + (s.kat || 'Eksternal & Internal') + (s.unit ? ' · ' + s.unit : '') + ' · ' + monthLabel(s.month), orient: 'l', fname: 'Laporan_Penjualan_Unit' });
  R.kv([['Uang masuk eksternal', 'Rp ' + R_(t.masukEks)], ['Internal ditagihkan', 'Rp ' + R_(t.tagihInt)], ['Piutang internal', 'Rp ' + R_(a0.piutInt)], ['Piutang eksternal', 'Rp ' + R_(a0.piutEks)]]);
  R.h2('Arus penjualan per bulan', s.month ? 'Tahun ' + s.month.slice(0, 4) : 'Semua periode');
  R.table(['Bulan', 'Eksternal (uang masuk)', 'Internal (ditagihkan)', 'Internal diterima', 'Total'], months.map(r => [monthLabel(r.m), cellR(R_(r.eks)), cellR(R_(r.int)), cellR(R_(r.terima)), cellR(R_(r.eks + r.int))]),
    { foot: ['Total', cellR(R_(sum(months, 'eks'))), cellR(R_(sum(months, 'int'))), cellR(R_(sum(months, 'terima'))), cellR(R_(sum(months, r => r.eks + r.int)))] });
  R.h2('Rincian penjualan', monthLabel(s.month));
  R.table(['Tanggal', 'Kategori', 'Customer / Proyek', 'SPH / SO', 'Unit', 'Produk', 'Volume', 'Nilai', 'Uang Masuk', 'Status', 'Pembayaran'],
    rowsM.map(d => [tgl(d.tgl), d.kat, d.nama, [d.sph, d.so || d.inv].filter(Boolean).join(' / ') || '-', d.unit, d.produk || '-', cellR(d.vol ? N_(d.vol) + ' ' + (d.sat || '') : '-'), cellR(R_(d.nilai)), cellR(R_(d.masuk)), d.status || '-', d.bayar || '-']), { fs: 7 });
  R.sign();
  await R.save();
}

/* ---------- Marketing › Penawaran (SPH) & Analisa bulanan ---------- */
function jxMktHtml(s) {
  if (s.tab === 'analisa') {
    const year = s.year || curMonth().slice(0, 4);
    const an = jxAnalisa().filter(a => a.m.startsWith(year));
    const intM = new Map(jxMonths(jxRows({ kat: 'Internal' }), year).map(r => [r.m, r.int]));
    const T = k => sum(an, k), real = T('real'), sph = T('sph');
    const years = [...new Set(jxAnalisa().map(a => a.m.slice(0, 4)))];
    return '<div class="fbar"><div class="seg">' + years.map(y => '<button class="' + (y === year ? 'on' : '') + '" data-jxy="' + y + '">' + y + '</button>').join('') + '</div></div>' +
      '<div class="kpis">' + kpi('Surat penawaran (SPH)', num(sph), num(real) + ' terealisasi · ' + pct(sph ? real / sph : 0)) + kpi('Nilai penawaran', rpS(T('penawaran'))) +
      kpi('Omzet eksternal', rpS(T('omzet')), 'pencapaian ' + pct(T('target') ? T('omzet') / T('target') : 0) + ' dari target ' + rpS(T('target')), 'good') + kpi('Penjualan internal', rpS(sum([...intM.values()], x => x)), 'tagihan HO / proyek ' + year) + '</div>' +
      '<section class="card"><div class="chead"><h3>Analisa penjualan bulanan ' + year + '</h3><div class="cmeta">sheet Analisa (eksternal) + PIUTANG INT. (internal)</div></div>' + table([
        { t: 'Bulan', f: a => '<b>' + esc(monthLabel(a.m)) + '</b>', raw: true }, { t: 'SPH', f: a => num(a.sph), num: true }, { t: 'Realisasi', f: a => num(a.real), num: true },
        { t: 'Konversi', f: a => pct(a.sph ? a.real / a.sph : 0), num: true }, { t: 'Nilai penawaran', f: a => rp(a.penawaran), num: true }, { t: 'Omzet eksternal', f: a => '<b>' + rp(a.omzet) + '</b>', num: true, raw: true },
        { t: 'Profit 15%', f: a => rp(a.profit), num: true }, { t: 'Target', f: a => rp(a.target), num: true },
        { t: 'Pencapaian', f: a => '<div class="mini"><b>' + pct(a.target ? a.omzet / a.target : 0) + '</b>' + bar(a.target ? a.omzet / a.target : 0, a.omzet >= a.target ? 'ok' : 'info') + '</div>', raw: true },
        { t: 'Penjualan internal', f: a => rp(intM.get(a.m) || 0), num: true }
      ], an, { empty: 'Belum ada analisa untuk tahun ini.' }) + '</section>';
  }
  const rows = jxRows({ kat: s.kat, unit: s.unit, month: s.month, q: s.q, status: s.jxst }).filter(d => d.tipe === 'order');
  const t = jxTot(rows), ord = rows.filter(d => d.status !== 'Batal');
  const real = new Set(rows.filter(d => d.masuk > 0 || d.status === 'Selesai').map(d => d.sph || d.id)).size;
  return jxSrcNote() + '<div class="kpis">' + kpi('SPH / order', num(new Set(rows.filter(d => !d.cont).map(d => d.sph || d.id)).size), num(real) + ' terealisasi') +
    kpi('Nilai penawaran / tagihan', rpS(sum(ord, 'nilai')), monthLabel(s.month)) + kpi('Uang masuk', rpS(sum(rows, 'masuk')), 'eksternal ' + rpS(t.masukEks), 'good') +
    kpi('Belum terealisasi', rpS(sum(ord.filter(d => d.status !== 'Selesai'), jxSisaNilai)), ord.filter(d => d.status !== 'Selesai').length + ' item berjalan / penawaran', 'warn') + '</div>' +
    '<div class="pipe">' + ['Penawaran', 'Negosiasi', 'Proses', 'Selesai', 'Batal', 'Ditagihkan'].map(x => { const a = rows.filter(r => r.status === x); return a.length ? '<div class="pp s-' + x + '"><span>' + x + '</span><b>' + a.length + '</b><small>' + rpS(sum(a, 'nilai')) + '</small></div>' : ''; }).join('') + '</div>' +
    '<section class="card">' + jxTable(rows, { sph: true }) + '</section>';
}
function jxMktFilter(s) {
  if (s.tab === 'analisa') return '';
  return periodBar(Object.assign({}, s, { units: false }), 'mkt', jxUnitOpts(s) + jxKatOpts(s) + '<select data-fk="jxst"><option value="">Semua status</option>' + JX_ST.map(x => '<option' + (s.jxst === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select>');
}
function jxMktBind(el, s, fill) { jxBind(el); $$('[data-jxy]', el).forEach(b => b.onclick = () => { s.year = b.dataset.jxy; fill(true); }); }
async function jxMktReport(s) {
  if (s.tab === 'analisa') {
    const year = s.year || curMonth().slice(0, 4), an = jxAnalisa().filter(a => a.m.startsWith(year));
    const intM = new Map(jxMonths(jxRows({ kat: 'Internal' }), year).map(r => [r.m, r.int]));
    const R = await pdfReport({ title: 'Analisa Penjualan Unit ' + year, sub: BC + ' · eksternal (retail) dan internal (HO / proyek) · per ' + tgl(today(), true), orient: 'l', fname: 'Analisa_Penjualan_' + year });
    R.table(['Bulan', 'SPH', 'Realisasi', 'Konversi', 'Nilai Penawaran', 'Omzet Eksternal', 'Profit 15%', 'Target', 'Pencapaian', 'Penjualan Internal'],
      an.map(a => [monthLabel(a.m), cellR(N_(a.sph)), cellR(N_(a.real)), cellR(pct(a.sph ? a.real / a.sph : 0)), cellR(R_(a.penawaran)), cellR(R_(a.omzet)), cellR(R_(a.profit)), cellR(R_(a.target)), cellR(pct(a.target ? a.omzet / a.target : 0)), cellR(R_(intM.get(a.m) || 0))]),
      { foot: ['Total', cellR(N_(sum(an, 'sph'))), cellR(N_(sum(an, 'real'))), '', cellR(R_(sum(an, 'penawaran'))), cellR(R_(sum(an, 'omzet'))), cellR(R_(sum(an, 'profit'))), cellR(R_(sum(an, 'target'))), '', cellR(R_(sum([...intM.values()], x => x)))] });
    R.sign([['Dibuat oleh', S.user.name], ['Sales / Marketing Unit', ''], ['Manager Unit', '']]);
    return R.save();
  }
  const rows = jxRows({ kat: s.kat, unit: s.unit, month: s.month, q: s.q, status: s.jxst }).filter(d => d.tipe === 'order');
  const R = await pdfReport({ title: 'Daftar Penawaran & Order Penjualan', sub: BC + ' · ' + (s.kat || 'Eksternal & Internal') + ' · ' + monthLabel(s.month), orient: 'l', fname: 'Penawaran_Order' });
  R.kv([['Jumlah baris', String(rows.length)], ['Nilai', 'Rp ' + R_(sum(rows.filter(d => d.status !== 'Batal'), 'nilai'))], ['Uang masuk', 'Rp ' + R_(sum(rows, 'masuk'))]]);
  R.table(['Tanggal', 'Kategori', 'SPH / SO', 'Customer / Proyek', 'Unit', 'Produk', 'Volume', 'Nilai', 'Uang Masuk', 'Status', 'Pembayaran'],
    rows.map(d => [tgl(d.tgl), d.kat, [d.sph, d.so || d.inv].filter(Boolean).join(' / ') || '-', d.nama, d.unit, d.produk || '-', cellR(d.vol ? N_(d.vol) + ' ' + (d.sat || '') : '-'), cellR(R_(d.nilai)), cellR(R_(d.masuk)), d.status || '-', d.bayar || '-']), { fs: 7 });
  R.sign([['Dibuat oleh', S.user.name], ['Sales / Marketing Unit', ''], ['Manager Unit', '']]);
  await R.save();
}
function jxKasMini(s) {
  const t = jxTot(jxRows({ month: s.month || curMonth() }).filter(d => d.tipe !== 'piutang')), a0 = jxTot(jxAll());
  return '<section class="card pad" style="margin-bottom:14px"><div class="chead" style="padding:0 0 10px"><h3>Penjualan unit dari rekap sheet · ' + esc(monthLabel(s.month || curMonth())) + '</h3><button class="btn ghost sm" data-jxgo>Lihat rincian' + ic('right') + '</button></div><div class="kpis" style="margin:0">' +
    kpi('Eksternal (uang masuk)', rpS(t.masukEks), 'retail', 'good') + kpi('Internal (ditagihkan)', rpS(t.tagihInt), 'HO / proyek PT. AHG') + kpi('Piutang internal', rpS(a0.piutInt), 'semua periode', a0.piutInt ? 'warn' : '') + kpi('Piutang eksternal', rpS(a0.piutEks), 'semua periode', a0.piutEks ? 'warn' : '') + '</div></section>';
}

function jxEditBtns(d, edit) {
  return [{ id: 'del', t: 'Hapus', icon: 'trash', danger: true, fn: m => { m.close(); setTimeout(() => jxDel(d), 250); } }, { id: 'ed', t: 'Ubah', icon: 'edit', pri: true, fn: m => { m.close(); setTimeout(edit, 250); } }];
}
const jxDel = d => editGate(JX_AREA).then(async ok => { if (!ok) return; if (await confirmBox('Hapus data penjualan', (d.nama || '') + ' · ' + tgl(d.tgl) + ' · ' + rp(d.nilai) + ' akan dihapus untuk semua pengguna. Lanjutkan?')) { remove(d.id); toast('Data penjualan dihapus'); } });
/* ---------- Edit penjualan (kata sandi edit 250798 = bw_cfg pin_edit; server bc_put menolak jualx/keg tanpa kunci terbuka) ---------- */
const JX_AREA = 'Kartu Penjualan';
const JXG = fn => gated(JX_AREA, fn);
const jxCan = () => !CFG.all; // Rekap Semua Basecamp hanya membaca
const jxClean = d => { const o = Object.assign({}, d); Object.keys(o).forEach(k => { if (k[0] === '_' || k === 'id') delete o[k]; }); return o; };
const jxBayarOf = (nilai, masuk) => +masuk >= +nilai - 0.5 && +nilai > 0 ? 'Lunas' : +masuk > 0.5 ? 'Sebagian' : 'Belum bayar';
// customer dari nama: pakai yang ada (kartu Customer) atau buat baru supaya Customer Unit tetap terhubung
function jxCustFor(nama, kat) {
  const n = String(nama || '').trim(); if (!n) return '';
  const key = n.toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const c = custList().find(x => String(x.nama || '').toUpperCase().replace(/[^A-Z0-9]+/g, '') === key);
  if (c) return c.id;
  return save('cust', { nama: n, jenis: kat === 'Internal' ? 'Internal' : 'Eksternal', pic: '', ktp: '', nik: '', npwp: '', wa: '', hp: '', email: '', alamat: '', ket: 'Dibuat dari Kartu Penjualan' });
}
const jxForm = JXG(d => {
  const src = jxAll(), last = jxSales().find(x => !x.keg) || {};
  const v = d ? Object.assign({}, d) : { tgl: today(), kat: last.kat || 'Eksternal', unit: last.unit || 'SCP', produk: last.produk || '', sat: last.sat || 'M3', status: 'Selesai', nama: last.nama || '' };
  if (v.kirim == null || v.kirim === '') v.kirim = v.vol;
  openForm({
    title: d ? 'Ubah Penjualan' : 'Tambah Penjualan', sub: BC + ' · perubahan langsung terhitung di Cash Flow, Customer, Marketing, dan Rekap Semua Basecamp', value: v, wide: true,
    onDelete: d ? () => remove(d.id) : null,
    fields: [
      { k: 'tgl', label: 'Tanggal', type: 'date', req: true }, { k: 'kat', label: 'Kategori', type: 'select', req: true, opts: JX_KAT.map(k => ({ v: k, t: k === 'Internal' ? 'Internal (HO / proyek PT. AHG)' : 'Eksternal (retail)' })) },
      { k: 'nama', label: 'Customer / proyek', type: 'list', req: true, opts: () => [...new Set(custList().map(c => c.nama).concat(src.map(x => x.nama)).filter(Boolean))] },
      { k: 'unit', label: 'Unit', type: 'select', opts: UNITS.concat('Umum') }, { k: 'produk', label: 'Produk', type: 'list', opts: () => [...new Set(src.map(x => x.produk).filter(Boolean))] },
      { k: 'sph', label: 'No. SPH / SO / invoice' },
      { k: 'vol', label: 'Volume', type: 'num', suffix: x => x.sat || '' }, { k: 'sat', label: 'Satuan', type: 'list', opts: ['M3', 'Ton', 'Pcs', 'Unit', 'M2', 'Liter', 'LS'] },
      { k: 'kirim', label: 'Volume terkirim', type: 'num', suffix: x => x.sat || '', help: 'Penjualan eksternal dihitung dari volume yang sudah terkirim' }, { k: 'ton', label: 'Tonase', type: 'num', suffix: 'ton' },
      { k: 'nilai', label: 'Nilai penjualan / tagihan', type: 'money', req: 'zero' }, { k: 'masuk', label: 'Uang masuk', type: 'money' },
      { k: 'tglBayar', label: 'Tanggal pembayaran', type: 'date' }, { k: 'status', label: 'Status', type: 'select', opts: JX_ST },
      { k: 'bayar', label: 'Pembayaran', type: 'list', opts: ['Lunas', 'Sebagian', 'Belum bayar', 'Sudah DP'], help: 'Kosong = otomatis dari uang masuk' },
      { k: 'info', type: 'html', html: x => '<div class="note">Sisa belum terbayar: <b>' + rp(Math.max(0, (+x.nilai || 0) - (+x.masuk || 0))) + '</b></div>' },
      { k: 'ket', label: 'Keterangan', type: 'textarea', rows: 2, full: true }
    ],
    onSave: x => {
      const o = Object.assign(d ? jxClean(d) : { src: 'app', proyek: '', sheet: 'Kartu Penjualan' }, {
        tipe: 'order', tgl: x.tgl, bulan: x.tgl.slice(0, 7), kat: x.kat, nama: String(x.nama).trim(), unit: x.unit || 'Umum', produk: x.produk || '', sph: x.sph || '',
        vol: +x.vol || 0, sat: x.sat || '', kirim: x.kirim === '' || x.kirim == null ? +x.vol || 0 : +x.kirim, ton: +x.ton || 0, nilai: +x.nilai || 0, masuk: +x.masuk || 0,
        tglBayar: x.tglBayar || '', status: x.status || 'Selesai', bayar: !x.bayar || ['Lunas', 'Sebagian', 'Belum bayar'].includes(x.bayar) ? jxBayarOf(x.nilai, x.masuk) : x.bayar, ket: x.ket || ''
      });
      if (!d || d.nama !== o.nama || !o.cust) o.cust = jxCustFor(o.nama, o.kat);
      save('jualx', o, d ? d.id : uid('jx'));
      toast('Penjualan ' + tgl(o.tgl) + ' disimpan · ' + rp(o.nilai));
    }
  });
});
// tagihan periode (Tempuran: History Tagihan jasa maklon)
const jxTagihForm = JXG(d => {
  const inf = jxInfo() || {}, T = jxTagih(), last = T[T.length - 1] || {};
  const v = d ? Object.assign({}, d) : { noTagih: (+last.noTagih || T.length) + 1, dari: last.sampai ? jxAdd(last.sampai, 1) : today(), sampai: today(), produk: 'Jasa maklon batu andesit', sat: 'M3' };
  openForm({
    title: d ? 'Ubah Tagihan' : 'Tambah Tagihan', sub: BC + ' · ' + (inf.nama || last.nama || 'customer jasa maklon') + ' · terbayar dan potongan deposit mengurangi sisa tagihan', value: v, wide: true, onDelete: d ? () => remove(d.id) : null,
    fields: [
      { k: 'noTagih', label: 'No', type: 'num', req: true }, { k: 'produk', label: 'Uraian', type: 'list', opts: ['Jasa maklon batu andesit', 'Parkir kendaraan DT', 'Selisih harga maklon'] },
      { k: 'dari', label: 'Periode produksi dari', type: 'date', req: true }, { k: 'sampai', label: 'Sampai', type: 'date', req: true },
      { k: 'hit', type: 'html', html: x => { if (!x.dari || !x.sampai) return ''; const a = all('keg').filter(k => k.tgl >= x.dari && k.tgl <= x.sampai && +k.m3 > 0); return '<div class="note">History Kegiatan periode ini: <b>' + num(sum(a, 'm3')) + ' M3</b> · ' + num(sum(a, 'ton')) + ' ton · ' + a.length + ' hari · nilai ' + rp(sum(a, k => k.m3 * (+k.harga || kegHarga()))) + ' <button type="button" class="btn ghost sm" data-tgisi>Isi dari kegiatan</button></div>'; } },
      { k: 'ton', label: 'Tonase', type: 'num', suffix: 'ton' }, { k: 'vol', label: 'Volume', type: 'num', suffix: 'M3' },
      { k: 'nilai', label: 'Nilai tagihan', type: 'money', req: true }, { k: 'masuk', label: 'Terbayar ke PT. AHG', type: 'money' }, { k: 'potong', label: 'Potongan deposit', type: 'money' },
      { k: 'sisa', type: 'html', html: x => '<div class="note">Sisa tagihan: <b>' + rp(Math.max(0, (+x.nilai || 0) - (+x.masuk || 0) - (+x.potong || 0))) + '</b></div>' },
      { k: 'ket', label: 'Keterangan', type: 'textarea', rows: 2, full: true }
    ],
    onSave: x => {
      if (x.sampai < x.dari) { toast('Tanggal "sampai" sebelum "dari"', 'err'); return false; }
      const sisa = Math.max(0, (+x.nilai || 0) - (+x.masuk || 0) - (+x.potong || 0));
      const per = tgl(x.dari, true) + ' - ' + tgl(x.sampai, true);
      const o = Object.assign(d ? jxClean(d) : { src: 'app', sheet: 'Kartu Penjualan', proyek: 'Jasa maklon ' + BC }, {
        tipe: 'tagih', kat: 'Eksternal', noTagih: +x.noTagih, produk: x.produk || '', dari: x.dari, sampai: x.sampai, tgl: x.sampai, bulan: x.sampai.slice(0, 7), periode: per,
        ton: +x.ton || 0, vol: +x.vol || 0, sat: 'M3', nilai: +x.nilai || 0, masuk: +x.masuk || 0, potong: +x.potong || 0, ket: x.ket || '',
        status: sisa < 0.5 ? 'Lunas' : (+x.masuk || +x.potong) ? 'Sebagian' : 'Ditagihkan', bayar: sisa < 0.5 ? 'Lunas' : 'Sisa ' + rp(sisa),
        nama: (d && d.nama) || inf.nama || last.nama || '', cust: (d && d.cust) || inf.cust || last.cust || '', unit: (d && d.unit) || 'SCP'
      });
      save('jualx', o, d ? d.id : uid('jx'));
      toast('Tagihan No. ' + o.noTagih + ' disimpan');
    }
  });
});
// isi volume & nilai tagihan dari History Kegiatan (tombol di formulir tagihan)
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-tgisi]'); if (!b) return;
  const f = b.closest('form'); if (!f) return;
  const g = k => f.querySelector('[data-k="' + k + '"]');
  const a = all('keg').filter(k => k.tgl >= g('dari').value && k.tgl <= g('sampai').value && +k.m3 > 0);
  const setv = (k, val) => { const i = g(k); if (!i) return; i.focus(); i.value = val; i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); };
  setv('ton', nf2.format(sum(a, 'ton'))); setv('vol', nf2.format(sum(a, 'm3'))); setv('nilai', nf0.format(Math.round(sum(a, k => k.m3 * (+k.harga || kegHarga())))));
});
// pengaturan jasa maklon (deposit, harga, BEP, target) — dokumen info
const jxInfoForm = JXG(() => {
  const d = jxInfo() || { tipe: 'info', bulanan: [] };
  const v = Object.assign({}, d, { tgtTxt: (d.bulanan || []).map(b => b.m + ' ' + b.target).join('\n') });
  openForm({
    title: 'Pengaturan Jasa Maklon', sub: BC + ' · dipakai Penjualan dan History Kegiatan', value: v, wide: true,
    fields: [
      { k: 'nama', label: 'Customer', type: 'list', opts: () => custList().map(c => c.nama) }, { k: 'deposit', label: 'Deposit customer (total)', type: 'money' },
      { k: 'harga', label: 'Harga jasa maklon', type: 'money', suffix: '/ M3', help: 'Bawaan untuk catatan kegiatan baru' }, { k: 'faktor', label: 'Faktor ton → M3', type: 'num', help: 'M3 = ton ÷ faktor' },
      { k: 'bep', label: 'BEP produksi', type: 'num', suffix: 'M3/hari' }, { k: 'targetHari', label: 'Target produksi', type: 'num', suffix: 'M3/hari' },
      { k: 'biayaHari', label: 'Biaya tetap per hari', type: 'money' }, { k: 'ket', label: 'Keterangan', type: 'textarea', rows: 2, full: true },
      { k: 'tgtTxt', label: 'Target bulanan (satu baris: YYYY-MM target M3)', type: 'textarea', rows: 5, full: true, ph: '2026-12 5000' }
    ],
    onSave: x => {
      const old = new Map((d.bulanan || []).map(b => [b.m, b]));
      const bul = String(x.tgtTxt || '').split('\n').map(l => /^(\d{4}-\d{2})\s+([\d.,]+)/.exec(l.trim())).filter(Boolean).map(m => Object.assign({}, old.get(m[1]) || { m: m[1] }, { m: m[1], target: parseNum(m[2]) }));
      const o = Object.assign(jxClean(d), { tipe: 'info', nama: x.nama || '', cust: x.nama && x.nama !== d.nama ? jxCustFor(x.nama, 'Eksternal') : d.cust || '', deposit: +x.deposit || 0, harga: +x.harga || 0, faktor: +x.faktor || 1.3,
        bep: +x.bep || 0, targetHari: +x.targetHari || 0, biayaHari: +x.biayaHari || 0, ket: x.ket || '', bulanan: bul.sort((a, b) => a.m.localeCompare(b.m)) });
      save('jualx', o, d.id || 'jxinfo' + BCN.replace(/[^A-Za-z0-9]/g, '').toLowerCase());
      toast('Pengaturan jasa maklon disimpan');
    }
  });
});
function jxEditBar(o) {
  if (!jxCan()) return '';
  o = o || {};
  return editBadge() + '<div class="jxtools">' + (o.keg ? '<button class="btn sm pri" data-jxe="keg">' + ic('plus') + 'Catat kegiatan</button>' : '<button class="btn sm pri" data-jxe="add">' + ic('plus') + 'Tambah penjualan</button>') +
    (o.tagih ? '<button class="btn sm ghost" data-jxe="tagih">' + ic('plus') + 'Tambah tagihan</button><button class="btn sm ghost" data-jxe="info">' + ic('edit') + 'Pengaturan maklon</button>' : '') +
    '<span class="muted">' + ic('lock') + (editOpen() ? 'Kunci edit terbuka — klik baris untuk mengubah atau menghapus' : 'Tambah, ubah, dan hapus memerlukan kata sandi edit') + '</span></div>';
}
function jxEditBind(el) {
  bindRelock(el);
  $$('[data-jxe]', el).forEach(b => b.onclick = e => { e.stopPropagation(); const k = b.dataset.jxe; if (k === 'add') jxForm(); else if (k === 'tagih') jxTagihForm(); else if (k === 'info') jxInfoForm(); else if (k === 'keg' && typeof kegForm === 'function') kegForm(); });
}
