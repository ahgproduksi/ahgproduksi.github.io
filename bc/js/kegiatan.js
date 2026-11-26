/* History Kegiatan harian SCP — khusus Basecamp Tempuran (kind 'keg', impor awal dari sheet tab Kegiatan: deploy-ahg/sheet-import/jual_bc.py).
   Satu dokumen per hari: tgl (+ tgl2 bila libur/off beberapa hari), jam operasi, material, ton, m3, rit, jam produktif, catatan kendala (per baris), harga maklon.
   Penjualan harian Tempuran = m3 × harga maklon (kegSales → jualx.js jxSales). Dipakai kartu Penjualan › tab History Kegiatan. */
'use strict';
const kegOn = () => BCN === 'Tempuran';
const KEG_CUST = 'PT. Granat Mas Trans';
const kegAll = () => memo('keg', () => all('keg').sort((a, b) => String(b.tgl).localeCompare(String(a.tgl))));
function kegSales() { // dokumen kegiatan hanya ada di Tempuran; dihitung juga di Rekap Semua Basecamp
  return memo('kegs', () => all('keg').filter(k => +k.m3 > 0).map(k => ({
    id: 'kgs:' + k.id, keg: true, kat: 'Eksternal', tipe: 'order', tgl: k.tgl, bulan: String(k.tgl).slice(0, 7), nama: k.cust ? custName(k.cust) : KEG_CUST, cust: k.cust || '',
    unit: k.unit || 'SCP', produk: 'Jasa maklon ' + String(k.material || 'batu andesit').toLowerCase(), vol: +k.m3, sat: 'M3', ton: +k.ton || 0, rit: +k.rit || 0, kirim: +k.m3,
    nilai: (+k.m3) * (+k.harga || kegHarga()), masuk: 0, status: 'Selesai', bayar: 'Ditagihkan per periode', ket: (k.catatan || []).join(' · ')
  })));
}
const kegHarga = () => { const i = typeof jxInfo === 'function' ? jxInfo() : null; return i && i.harga || 40000; };
const kegBep = () => { const i = typeof jxInfo === 'function' ? jxInfo() : null; return i && i.bep || 150; };
// "5 jam, 30 menit" / "50 menit" → menit
const kegMenit = t => { t = String(t || ''); const j = /(\d+)\s*jam/i.exec(t), m = /(\d+)\s*menit/i.exec(t); return (j ? +j[1] * 60 : 0) + (m ? +m[1] : 0); };
const kegJamTxt = m => m ? (Math.floor(m / 60) ? Math.floor(m / 60) + ' jam' : '') + (m % 60 ? ' ' + (m % 60) + ' menit' : '') : '-';
const kegHari = k => k.tgl2 && k.tgl2 > k.tgl ? Math.round((jxD(k.tgl2) - jxD(k.tgl)) / 864e5) + 1 : 1;
// kelompok kendala dari catatan
const KEG_KAT = [
  ['Hujan', /hujan/i], ['Listrik / PLN', /listrik|pln|genset|konslet|panel/i], ['Jaw crusher', /\bja?ow\b|jaw|swing/i], ['Conveyor', /conv|konvey|conveyer/i],
  ['Screen', /screen|ayak|glogoran|grizle|grizzly/i], ['Bearing / laker', /bearing|laker/i], ['Alat berat (excavator, loader, DT)', /exca|exsa|excavator|loader|dump|\bdt\b/i],
  ['BBM / solar habis', /solar|bbm/i], ['Material / batu', /batu habis|material habis|menunggu.*material|limbah/i], ['Perbaikan / pemasangan', /perbaikan|pasang|bongkar|ganti|las|pengelasan/i]
];
function kegKendala(list) {
  const m = new Map(KEG_KAT.map(([k]) => [k, { k, hari: 0, n: 0 }]));
  list.forEach(d => {
    const hit = new Set();
    (d.catatan || []).forEach(t => { if (/cek alat|bersih|istirahat/i.test(t) && !/trouble|perbaikan/i.test(t)) return; KEG_KAT.forEach(([k, re]) => { if (re.test(t)) { m.get(k).n++; hit.add(k); } }); });
    hit.forEach(k => m.get(k).hari++);
  });
  return [...m.values()].filter(x => x.n).sort((a, b) => b.hari - a.hari || b.n - a.n);
}
function kegSel(s) {
  const r = jxRange(s);
  const rows = kegAll().filter(k => (r.per === 'semua' || ((k.tgl2 || k.tgl) >= r.a && k.tgl <= r.b)) && qMatch(s.q, k.material, k.jam, (k.catatan || []).join(' '), k.status));
  const prod = rows.filter(k => +k.m3 > 0), menit = sum(prod, k => kegMenit(k.produktif));
  return { r, rows, prod, off: rows.filter(k => !(+k.m3 > 0)), m3: sum(prod, 'm3'), ton: sum(prod, 'ton'), rit: sum(prod, 'rit'), menit, nilai: sum(prod, k => (+k.m3) * (+k.harga || kegHarga())),
    offHari: sum(rows.filter(k => !(+k.m3 > 0)), kegHari) };
}
const kegNote = t => { const m = /^(\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}\s*[.:]\s*\d{2})\s*[;:]?\s*(.*)$/.exec(t); return m ? '<time>' + esc(m[1].replace(/\s+/g, ' ')) + '</time>' + esc(m[2].replace(/^\((.*)\)$/, '$1')) : esc(t); };
function kegHtml(s) {
  const x = kegSel(s), bep = kegBep(), avg = x.prod.length ? x.m3 / x.prod.length : 0, inf = (typeof jxInfo === 'function' && jxInfo()) || {};
  const ken = kegKendala(x.rows);
  const tgt = (inf.bulanan || []).filter(b => x.r.per === 'semua' || (b.m + '-01' <= x.r.b && b.m + '-31' >= x.r.a));
  const byM = jxGroup(x.rows, k => String(k.tgl).slice(0, 7));
  const list = Object.keys(byM).sort().reverse().map(ym => {
    const a = byM[ym], p = a.filter(k => +k.m3 > 0);
    return '<div class="kgm"><b>' + esc(monthLabel(ym)) + '</b><span>' + p.length + ' hari produksi · ' + num(sum(p, 'm3')) + ' M3 · ' + num(sum(p, 'ton')) + ' ton · ' + num(sum(p, 'rit')) + ' rit</span></div>' +
      a.map(k => {
        const d = jxD(k.tgl), on = +k.m3 > 0, v = (+k.m3) * (+k.harga || kegHarga());
        return '<div class="kgi' + (on ? '' : ' off') + '" data-kg="' + esc(k.id) + '" tabindex="0" role="button"><div class="kgd"><b>' + d.getDate() + '</b><span>' + HARI[d.getDay()].slice(0, 3) + '</span></div><div class="kgb">' +
          '<div class="kgt">' + (on ? chip('Produksi', 'ok') : chip(kegHari(k) > 1 ? 'Off ' + kegHari(k) + ' hari' : 'Off', 'mute')) + (k.tgl2 ? '<span>' + esc(jxSpan(k.tgl, k.tgl2)) + '</span>' : '') +
          (k.jam ? '<span>' + ic('cal') + esc(k.jam) + '</span>' : '') + (on ? '<span><b>' + num(k.m3) + ' M3</b> · ' + num(k.ton) + ' ton · ' + num(k.rit) + ' rit</span>' : '') + (k.produktif ? '<span>produktif ' + esc(k.produktif) + '</span>' : '') + '</div>' +
          ((k.catatan || []).length ? '<ul>' + k.catatan.map(t => '<li>' + kegNote(t) + '</li>').join('') + '</ul>' : '') + '</div>' +
          '<div class="kgv">' + (on ? '<b>' + rpS(v) + '</b><small class="' + (+k.m3 >= bep ? 't-ok' : 't-warn') + '">' + (+k.m3 >= bep ? '≥ BEP' : 'di bawah BEP') + '</small>' : '') + '</div></div>';
      }).join('');
  }).join('');
  return '<div class="note">' + ic('file') + 'History kegiatan harian SCP ' + esc(BC) + ': jam operasi, hasil produksi, dan catatan kendala tiap hari (impor awal dari tab Kegiatan Google Sheet). BEP ' + num(bep) + ' M3/hari' + (inf.ket ? ' — ' + esc(inf.ket.replace(/ — BEP.*$/, '')) : '') + '. Klik hari untuk mengubah catatan.</div>' +
    '<div class="kpis">' + kpi('Hari produksi', num(x.prod.length) + ' hari', 'off / perbaikan ' + num(x.offHari) + ' hari · ' + esc(x.r.label)) +
    kpi('Hasil produksi', num(x.m3) + ' M3', num(x.ton) + ' ton · ' + num(x.rit) + ' rit', 'good') +
    kpi('Rata-rata per hari produksi', num(avg) + ' M3', x.prod.filter(k => +k.m3 >= bep).length + ' dari ' + x.prod.length + ' hari ≥ BEP ' + num(bep) + ' M3', avg >= bep ? 'good' : 'warn') +
    kpi('Jam produktif', kegJamTxt(x.menit), x.prod.length ? 'rata-rata ' + kegJamTxt(Math.round(x.menit / x.prod.length)) + ' / hari · nilai jasa ' + rpS(x.nilai) : '') + '</div>' +
    (ken.length ? '<section class="card"><div class="chead"><h3>Kendala terbanyak</h3><div class="cmeta">dikelompokkan dari catatan harian · ' + esc(x.r.label) + '</div></div><div class="kgk">' +
      ken.map(k => '<div><b>' + num(k.hari) + '<small> hari</small></b><span>' + esc(k.k) + '</span><small>' + num(k.n) + ' catatan</small>' + bar(x.rows.length ? k.hari / x.rows.length : 0, 'warn') + '</div>').join('') + '</div></section>' : '') +
    (tgt.length ? '<section class="card"><div class="chead"><h3>Realisasi vs target bulanan</h3><div class="cmeta">sheet Rekapitulasi Produksi SCP Tempuran</div></div>' + table([
      { t: 'Bulan', f: b => '<b>' + esc(monthLabel(b.m)) + '</b>', raw: true }, { t: 'Tonase', f: b => num(kegM(b.m, 'ton')), num: true }, { t: 'Volume', f: b => num(kegM(b.m, 'm3')) + ' M3', num: true },
      { t: 'Target', f: b => num(b.target) + ' M3', num: true }, { t: 'Pencapaian', f: b => { const p = b.target ? kegM(b.m, 'm3') / b.target : 0; return '<div class="mini"><b>' + pct(p) + '</b>' + bar(p, p >= 1 ? 'ok' : 'info') + '</div>'; }, raw: true },
      { t: 'Nilai jasa', f: b => rp(kegM(b.m, 'nilai')), num: true }], tgt.map(b => Object.assign({ id: b.m }, b))) + '</section>' : '') +
    '<section class="card"><div class="chead"><h3>History kegiatan · ' + esc(x.r.label) + '</h3><div class="cmeta">' + x.rows.length + ' catatan</div></div>' +
    (x.rows.length ? '<div class="kgl">' + list + '</div>' : '<div class="empty">' + ic('cal') + '<p>Belum ada catatan kegiatan pada ' + esc(x.r.label) + '.</p></div>') + '</section>';
}
// total per bulan dari dokumen kegiatan (bukan angka sheet) → ikut berubah bila catatan diubah di aplikasi
function kegM(ym, k) { const a = all('keg').filter(d => String(d.tgl).startsWith(ym) && +d.m3 > 0); return k === 'nilai' ? sum(a, d => (+d.m3) * (+d.harga || kegHarga())) : sum(a, k); }
function kegBind(el) {
  $$('[data-kg]', el).forEach(r => { r.onclick = () => kegDetail(r.dataset.kg); r.onkeydown = e => { if (e.key === 'Enter') kegDetail(r.dataset.kg); }; });
}
function kegDetail(id) {
  const k = get(id); if (!k) return;
  const on = +k.m3 > 0, d = jxD(k.tgl);
  detail({
    title: 'Kegiatan ' + HARI[d.getDay()] + ', ' + tgl(k.tgl, true) + (k.tgl2 ? ' – ' + tgl(k.tgl2, true) : ''), sub: BC + ' · unit ' + (k.unit || 'SCP') + ' · ' + (on ? 'produksi' : 'tidak produksi'),
    html: infoGrid([['Tanggal', tgl(k.tgl) + (k.tgl2 ? ' – ' + tgl(k.tgl2) : '')], ['Status', on ? 'Produksi' : 'Off / perbaikan'], ['Jam operasi', k.jam || '-'], ['Material', k.material || '-'],
      ['Tonase', on ? num(k.ton) + ' ton' : '-'], ['Volume', on ? num(k.m3) + ' M3' : '-'], ['Rit', on ? num(k.rit) : '-'], ['Jam produktif', k.produktif || '-'],
      ['Harga maklon', rp(+k.harga || kegHarga()) + ' / M3'], ['Nilai jasa', on ? rp((+k.m3) * (+k.harga || kegHarga())) : '-'], ['Customer', k.cust ? custName(k.cust) : KEG_CUST], ['Dicatat oleh', (k._by || '-') + ' · ' + tglJam(k._at)]]) +
      ((k.catatan || []).length ? '<h4 class="sub">Catatan kegiatan &amp; kendala</h4><ul class="kgn">' + k.catatan.map(t => '<li>' + kegNote(t) + '</li>').join('') + '</ul>' : ''),
    buttons: CFG.all ? [] : [{ id: 'ed', t: 'Ubah', icon: 'edit', pri: true, fn: m => { m.close(); setTimeout(() => kegForm(get(id)), 250); } }]
  });
}
function kegForm(d) {
  const last = kegAll()[0] || {};
  const v = d ? Object.assign({}, d, { catatanTxt: (d.catatan || []).join('\n') }) : { tgl: today(), material: 'Batu andesit', harga: last.harga || kegHarga(), cust: last.cust || '', unit: 'SCP', jam: '08.00 - 16.00' };
  openForm({
    title: d ? 'Ubah Kegiatan' : 'Catat Kegiatan Harian', sub: BC + ' · produksi SCP dan kendala hari itu', value: v, wide: true, onDelete: d ? () => { remove(d.id); toast('Catatan kegiatan dihapus'); } : null,
    fields: [
      { k: 'tgl', label: 'Tanggal', type: 'date', req: true }, { k: 'tgl2', label: 'Sampai tanggal (bila off beberapa hari)', type: 'date' },
      { k: 'jam', label: 'Jam operasi', ph: '08.00 - 16.00' }, { k: 'material', label: 'Material', type: 'list', opts: ['Batu andesit', 'Batu bantak', 'Blondos'] },
      { k: 'ton', label: 'Tonase', type: 'num', suffix: 'ton', onChange: x => { if (+x.ton > 0 && !d) x.m3 = Math.round(x.ton / ((jxInfo() || {}).faktor || 1.3) * 100) / 100; } },
      { k: 'm3', label: 'Volume', type: 'num', suffix: 'M3', help: 'Kosong / 0 = hari tidak produksi. Otomatis tonase ÷ ' + ((jxInfo() || {}).faktor || 1.3) },
      { k: 'rit', label: 'Rit', type: 'num' }, { k: 'produktif', label: 'Jam produktif', ph: '5 jam 30 menit' },
      { k: 'harga', label: 'Harga jasa maklon', type: 'money', suffix: '/ M3', req: true },
      { k: 'nilai', type: 'html', html: x => '<div class="note">Nilai jasa hari ini: <b>' + rp((+x.m3 || 0) * (+x.harga || 0)) + '</b>' + (+x.m3 > 0 ? ' · ' + (+x.m3 >= kegBep() ? 'di atas' : 'di bawah') + ' BEP ' + num(kegBep()) + ' M3' : '') + '</div>' },
      { k: 'catatanTxt', label: 'Catatan kegiatan & kendala (satu baris per kejadian)', type: 'textarea', rows: 6, full: true, ph: '08.00 - 09.00 ; cek alat, bersih\n10.15 - 10.35 ; trouble batu selip di jaw primer\n13.00 - 14.00 ; hujan deras' }
    ],
    onSave: x => {
      if (x.tgl2 && x.tgl2 < x.tgl) { toast('"Sampai tanggal" tidak boleh sebelum tanggal', 'err'); return false; }
      const dup = !d && all('keg').find(k => k.tgl === x.tgl);
      if (dup) { toast('Tanggal ' + tgl(x.tgl) + ' sudah ada — buka catatan itu untuk mengubah', 'err'); return false; }
      const m3 = +x.m3 || 0;
      const doc = { tgl: x.tgl, tgl2: x.tgl2 || '', jam: x.jam || '', material: x.material || '', ton: +x.ton || 0, m3, rit: +x.rit || 0, produktif: x.produktif || '', status: m3 > 0 ? 'Produksi' : 'Off',
        catatan: String(x.catatanTxt || '').split('\n').map(t => t.replace(/^\s*[\^•-]\s*/, '').trim()).filter(Boolean), harga: +x.harga || kegHarga(), cust: x.cust || (d && d.cust) || '', unit: x.unit || 'SCP', no: d ? d.no : null, src: 'app' };
      save('keg', doc, d ? d.id : 'kgt' + x.tgl.replace(/-/g, '') + '_' + Math.random().toString(36).slice(2, 6));
      toast('Kegiatan ' + tgl(x.tgl) + ' disimpan' + (m3 > 0 ? ' · ' + num(m3) + ' M3 = ' + rp(m3 * doc.harga) : ''));
    }
  });
}
async function kegReport(s) {
  const x = kegSel(s), r = x.r, bep = kegBep();
  const R = await pdfReport({ title: 'History Kegiatan SCP', sub: BC + ' · ' + r.label + (r.per !== 'semua' ? ' (' + tgl(r.a) + ' – ' + tgl(r.b) + ')' : ''), orient: 'l', fname: 'History_Kegiatan_' + BCN + '_' + r.label.replace(/[^A-Za-z0-9]+/g, '_') });
  R.kv([['Hari produksi', num(x.prod.length) + ' hari'], ['Off / perbaikan', num(x.offHari) + ' hari'], ['Hasil produksi', N_(x.m3) + ' M3 · ' + N_(x.ton) + ' ton'], ['Rit', N_(x.rit)],
    ['Rata-rata / hari', N_(x.prod.length ? x.m3 / x.prod.length : 0) + ' M3 (BEP ' + num(bep) + ')'], ['Jam produktif', kegJamTxt(x.menit)], ['Nilai jasa maklon', 'Rp ' + R_(x.nilai)]], 4);
  const ken = kegKendala(x.rows);
  if (ken.length) { R.h2('Kendala terbanyak'); R.table(['Kendala', 'Hari', 'Catatan'], ken.map(k => [k.k, cellR(N_(k.hari)), cellR(N_(k.n))])); }
  R.h2('History kegiatan', r.label);
  R.table(['Tanggal', 'Jam', 'Tonase', 'M3', 'Rit', 'Produktif', 'Catatan kegiatan & kendala'],
    x.rows.slice().reverse().map(k => [tgl(k.tgl) + (k.tgl2 ? ' – ' + tgl(k.tgl2) : ''), k.jam || '-', cellR(+k.m3 > 0 ? N_(k.ton) : '-'), cellR(+k.m3 > 0 ? N_(k.m3) : '-'), cellR(+k.m3 > 0 ? N_(k.rit) : '-'), k.produktif || (+k.m3 > 0 ? '-' : 'Off'), (k.catatan || []).join('\n') || '-']),
    { fs: 6.8, foot: ['Total', '', cellR(N_(x.ton)), cellR(N_(x.m3)), cellR(N_(x.rit)), kegJamTxt(x.menit), ''] });
  R.sign();
  await R.save();
}
