/* Penjualan dari rekap Google Sheet (kind 'jualx', diimpor oleh deploy-ahg/sheet-import/import.py):
   kategori Eksternal (retail) dan Internal (tagihan ke HO / proyek PT. AHG). Dipakai kartu Marketing, Cash Flow, dan Customer.
   tipe: 'order' (SPH / tagihan / penjualan), 'bayar' (pelunasan piutang SPH lama), 'piutang' (kurang bayar per SPH), 'analisa' (rekap bulanan sheet). */
'use strict';
const JX_KAT = ['Eksternal', 'Internal'];
const JX_ST = ['Penawaran', 'Negosiasi', 'Revisi', 'Proses', 'Selesai', 'Batal', 'Ditagihkan', 'Diterima'];
const jxAll = () => memo('jx', () => all('jualx').filter(d => d.tipe !== 'analisa').sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)) || (a.row || 0) - (b.row || 0)));
const jxHas = () => jxAll().length > 0;
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
  const d = jxAll().find(x => x.id === id); if (!d) return;
  detail({
    title: d.nama || d.proyek || 'Penjualan', sub: (d.kat || '') + ' · ' + (d.tipe === 'piutang' ? 'Piutang' : d.tipe === 'bayar' ? 'Pembayaran piutang' : d.kat === 'Internal' ? 'Tagihan proyek internal' : 'SPH / order retail') + ' · ' + monthLabel(d.bulan),
    html: infoGrid([['Kategori', d.kat], ['Tanggal', tgl(d.tgl)], ['Unit', d.unit], d.sph ? ['No. SPH', d.sph] : null, d.so ? ['SO', d.so] : null, d.inv ? ['No. tagihan / invoice', d.inv] : null,
      ['Customer / proyek', d.nama], ['Produk', d.produk], ['Volume', jxVol(d) + (d.ton ? ' · ' + num(d.ton) + ' ton' : '')], d.po ? ['Nilai PO / SO', rp(d.po)] : null,
      [d.kat === 'Internal' ? 'Nilai tagihan' : d.tipe === 'piutang' ? 'Harga SPH' : 'Nominal SPH / penjualan', rp(d.nilai)], ['Uang masuk', rp(d.masuk)], d.tipe === 'piutang' ? ['Kurang bayar', rp(d.kurang)] : null,
      d.profit ? ['Profit', rp(d.profit)] : null, d.kirim || d.sisa ? ['Terkirim / sisa', num(d.kirim) + ' / ' + num(d.sisa) + ' ' + (d.sat || '')] : null, ['Status', d.status], ['Pembayaran', d.bayar],
      d.tglBayar ? ['Tanggal pembayaran', tgl(d.tglBayar)] : null, d.jadwal ? ['Jadwal kirim', tgl(d.jadwal)] : null, d.ket ? ['Keterangan', d.ket] : null, ['Sumber', 'Sheet ' + (d.sheet || '') + (d.row ? ' baris ' + d.row : '')]]) +
      (d.bukti ? '<p style="margin-top:10px"><a class="btn ghost sm" href="' + esc(d.bukti) + '" target="_blank" rel="noopener">' + ic('file') + 'Bukti transfer</a></p>' : ''),
    buttons: d.cust && custGet(d.cust) ? [{ id: 'cu', t: 'Lihat customer', icon: 'cust', fn: m => { m.close(); setTimeout(() => custDetail(d.cust), 250); } }] : []
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

/* ---------- Kartu Penjualan › Penjualan Rekap Sheet (mis. penjualan batu Jogoresan) ---------- */
// nilai penjualan: eksternal = nilai barang yang sudah terkirim, internal = nilai yang ditagihkan
const jxNilaiJual = d => { if (d.tipe !== 'order' || d.status === 'Batal') return 0; if (d.kat === 'Internal') return +d.nilai || 0; const v = +d.vol || 0, k = +d.kirim || 0; return v > 0 ? (+d.nilai || 0) * Math.min(1, k / v) : d.status === 'Selesai' ? +d.nilai || 0 : 0; };
const jxKatOf = j => j === 'internal' ? 'Internal' : j === 'eksternal' ? 'Eksternal' : '';
function jxJualSum(month) { const r = jxRows({ month }).filter(d => d.tipe === 'order'); return { nilai: sum(r, jxNilaiJual), masuk: sum(r, 'masuk'), profit: sum(r, 'profit'), n: r.length }; }
function jxGroup(a, f) { const m = {}; a.forEach(x => { const k = f(x); (m[k] = m[k] || []).push(x); }); return m; }
function jxJualHtml(s) {
  const base = { kat: jxKatOf(s.jenis), unit: s.unit, q: s.q };
  const rows = jxRows(Object.assign({}, base, { month: s.month })).filter(d => d.tipe === 'order');
  const nilai = sum(rows, jxNilaiJual), masuk = sum(rows, 'masuk'), belum = sum(rows, d => Math.max(0, jxNilaiJual(d) - (+d.masuk || 0)));
  const volTxt = Object.entries(jxGroup(rows.filter(d => d.vol), d => d.sat || '')).map(([k, a]) => num(sum(a, 'vol')) + ' ' + k).join(' · ') || '-';
  const ton = sum(rows, 'ton');
  const prod = Object.entries(jxGroup(rows, d => (d.unit || 'Umum') + '|' + (d.produk || '-'))).map(([k, a]) => ({ id: k, unit: k.split('|')[0], produk: k.split('|')[1], n: a.length, vol: sum(a, 'vol'), sat: (a.find(d => d.sat) || {}).sat || '', ton: sum(a, 'ton'), nilai: sum(a, jxNilaiJual), masuk: sum(a, 'masuk') })).sort((a, b) => b.nilai - a.nilai);
  const year = (s.month || curMonth()).slice(0, 4);
  const mm = new Map();
  jxRows(base).filter(d => d.tipe === 'order' && (!s.month || String(d.bulan).startsWith(year))).forEach(d => { const r = mm.get(d.bulan) || { id: d.bulan, m: d.bulan, n: 0, vol: 0, nilai: 0, masuk: 0 }; r.n++; r.vol += +d.vol || 0; r.nilai += jxNilaiJual(d); r.masuk += +d.masuk || 0; mm.set(d.bulan, r); });
  const months = [...mm.values()].sort((a, b) => a.m.localeCompare(b.m));
  return '<div class="note">' + ic('file') + 'Penjualan ' + esc(BC) + ' dari rekap Google Sheet (diimpor ke kartu ini). Nilai penjualan eksternal = nilai barang yang sudah terkirim; internal = nilai yang ditagihkan.</div>' +
    '<div class="kpis">' + kpi('Nilai penjualan', rpS(nilai), monthLabel(s.month) + ' · ' + rows.length + ' transaksi', 'good') + kpi('Volume terjual', volTxt, ton ? num(ton) + ' ton' : '') +
    kpi('Uang masuk', rpS(masuk), nilai ? pct(masuk / nilai) + ' dari nilai' : '') + kpi('Belum terbayar', rpS(belum), 'periode ini', belum > 0.5 ? 'warn' : '') + '</div>' +
    (prod.length ? '<section class="card"><div class="chead"><h3>Per produk</h3><div class="cmeta">' + esc(monthLabel(s.month)) + '</div></div>' + table([
      { t: 'Unit', f: r => unitChip(r.unit), raw: true }, { t: 'Produk', f: r => r.produk, cls: 'strong' }, { t: 'Transaksi', f: r => r.n, num: true },
      { t: 'Volume', f: r => r.vol ? num(r.vol) + ' ' + r.sat : '-', num: true }, { t: 'Tonase', f: r => r.ton ? num(r.ton) + ' ton' : '-', num: true },
      { t: 'Nilai penjualan', f: r => rp(r.nilai), num: true }, { t: 'Uang masuk', f: r => rp(r.masuk), num: true }], prod) + '</section>' : '') +
    '<section class="card"><div class="chead"><h3>Penjualan per bulan</h3><div class="cmeta">' + (s.month ? 'Tahun ' + year : 'Semua periode') + ' · klik bulan untuk rinciannya</div></div>' + table([
      { t: 'Bulan', f: r => '<b>' + esc(monthLabel(r.m)) + '</b>', raw: true }, { t: 'Transaksi', f: r => r.n, num: true }, { t: 'Volume', f: r => num(r.vol), num: true },
      { t: 'Nilai penjualan', f: r => rp(r.nilai), num: true }, { t: 'Uang masuk', f: r => rp(r.masuk), num: true }], months, { click: true, empty: 'Belum ada data.', rowAttr: r => 'data-jxm="' + esc(r.m) + '"' }) + '</section>' +
    '<section class="card"><div class="chead"><h3>Rincian penjualan ' + esc(monthLabel(s.month)) + '</h3><div class="cmeta">' + rows.length + ' baris</div></div>' + jxTable(rows) + '</section>';
}
async function jxJualReport(s) {
  const base = { kat: jxKatOf(s.jenis), unit: s.unit, q: s.q };
  const rows = jxRows(Object.assign({}, base, { month: s.month })).filter(d => d.tipe === 'order');
  const R = await pdfReport({ title: 'Laporan Penjualan Unit', sub: BC + ' · ' + (jxKatOf(s.jenis) || 'Eksternal & Internal') + (s.unit ? ' · ' + s.unit : '') + ' · ' + monthLabel(s.month), orient: 'l', fname: 'Penjualan_' + BCN.replace(/[^A-Za-z0-9]+/g, '_') });
  R.kv([['Nilai penjualan', 'Rp ' + R_(sum(rows, jxNilaiJual))], ['Uang masuk', 'Rp ' + R_(sum(rows, 'masuk'))], ['Transaksi', String(rows.length)], ['Tonase', N_(sum(rows, 'ton')) + ' ton']]);
  R.table(['Tanggal', 'Kategori', 'Customer / Proyek', 'Unit', 'Produk', 'Volume', 'Tonase', 'Nilai', 'Uang Masuk', 'Status', 'Pembayaran'],
    rows.map(d => [tgl(d.tgl), d.kat, d.nama, d.unit, d.produk || '-', cellR(d.vol ? N_(d.vol) + ' ' + (d.sat || '') : '-'), cellR(d.ton ? N_(d.ton) : '-'), cellR(R_(jxNilaiJual(d))), cellR(R_(d.masuk)), d.status || '-', d.bayar || '-']),
    { fs: 7, foot: ['Total', '', '', '', '', '', cellR(N_(sum(rows, 'ton'))), cellR(R_(sum(rows, jxNilaiJual))), cellR(R_(sum(rows, 'masuk'))), '', ''] });
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
