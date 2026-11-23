/* Kartu 1 Stok Material, Kartu 2 Produksi (SO/WO + jobmix/BOM), Kartu 3 Penjualan. */
'use strict';

/* =================== 1. STOK MATERIAL =================== */
MODS.stok = {
  title: 'Stok Material', icon: 'stok', desc: 'Saldo & mutasi material per unit, terpotong otomatis oleh produksi',
  render(root) {
    const st = stateOf('stok', { tab: 'saldo', unit: 'AMP', q: '', month: curMonth() });
    return page(root, {
      key: 'stok', st, report: stokReport,
      tabs: [{ k: 'saldo', t: 'Saldo Stok' }, { k: 'mutasi', t: 'Kartu Mutasi' }],
      actions: [{ id: 'in', t: 'Barang Masuk', icon: 'in', pri: true }, { id: 'out', t: 'Barang Keluar', icon: 'out' }, { id: 'op', t: 'Stock Opname', icon: 'scale' }, { id: 'mat', t: 'Tambah Material', icon: 'plus' }],
      on: { in: () => stokForm('masuk'), out: () => stokForm('keluar'), op: () => opnameForm(), mat: () => addMaterialDialog(st.unit || 'AMP') },
      filter: s => { s.umum = true; return periodBar(s.tab === 'mutasi' ? s : Object.assign({}, s, { month: undefined })); },
      body: s => {
        const units = s.unit ? [s.unit] : UNITS.concat('Umum');
        if (s.tab === 'saldo') {
          return units.map(u => {
            const rows = stockSaldo(u).filter(r => qMatch(s.q, r.m.nama, r.m.kat));
            const tone = { Menipis: 0, Habis: 0 }; rows.forEach(r => tone[r.status] = (tone[r.status] || 0) + 1);
            if (!s.unit && !rows.some(r => r.masuk || r.prod || r.keluar || r.adj)) return '';
            return '<section class="card"><div class="chead"><div>' + unitChip(u) + '<h3>' + esc(UNIT_NAME[u]) + '</h3></div><div class="cmeta">' + rows.length + ' material · posisi per ' + tgl(stokPosisi(rows)) + (tone.Menipis ? ' · <b class="t-warn">' + tone.Menipis + ' menipis</b>' : '') + (tone.Habis ? ' · <b class="t-bad">' + tone.Habis + ' habis</b>' : '') + '</div></div>' +
              table([
                { t: 'Material', f: r => r.m.nama, cls: 'strong' }, { t: 'Kategori', f: r => r.m.kat }, { t: 'Satuan', f: r => r.m.sat },
                { t: 'Masuk', f: r => r.masuk, num: true }, { t: 'Keluar', f: r => r.keluar, num: true }, { t: 'Pemakaian Produksi', f: r => r.prod, num: true },
                { t: 'Penyesuaian', f: r => r.adj, num: true }, { t: 'Saldo', f: r => '<b>' + num(r.saldo) + '</b>', num: true, raw: true },
                { t: 'Per Tanggal', f: r => '<span style="white-space:nowrap">' + (r.last ? tgl(r.last) : tgl(today()) + ' <span class="muted">(cut off)</span>') + '</span>', raw: true }, { t: 'Min.', f: r => r.m.min || '-', num: true },
                { t: 'Status', f: r => stChip(r.status), raw: true }
              ], rows.map(r => Object.assign(r, { id: u + '|' + r.m.nama })), { click: true, empty: 'Tidak ada material.' }) + '</section>';
          }).join('') || '<div class="empty">' + ic('stok') + '<p>Belum ada mutasi stok. Gunakan tombol <b>Barang Masuk</b> untuk mencatat stok awal.</p></div>';
        }
        let mv = [];
        units.forEach(u => stockMoves(u).forEach(x => mv.push(Object.assign({ unit: u }, x))));
        mv = mv.filter(x => inMonth(x.tgl, s.month) && qMatch(s.q, x.mat, x.ref, x.ket, x.jenis));
        mv.sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)));
        const jl = { masuk: 'Masuk', keluar: 'Keluar', produksi: 'Produksi', penyesuaian: 'Opname' };
        return '<section class="card">' + table([
          { t: 'Tanggal', f: x => tgl(x.tgl) }, { t: 'Unit', f: x => unitChip(x.unit), raw: true }, { t: 'Material', f: x => x.mat, cls: 'strong' },
          { t: 'Jenis', f: x => chip(jl[x.jenis] || x.jenis, x.jenis === 'masuk' ? 'ok' : x.jenis === 'produksi' ? 'info' : x.jenis === 'keluar' ? 'bad' : 'warn'), raw: true },
          { t: 'Jumlah', f: x => '<b class="' + (x.qty >= 0 ? 't-ok' : 't-bad') + '">' + (x.qty >= 0 ? '+' : '') + num(x.qty) + '</b>', num: true, raw: true }, { t: 'Satuan', f: x => x.sat },
          { t: 'Referensi', f: x => x.ref || '-' }, { t: 'Keterangan', f: x => x.ket || '-', cls: 'wrap' }, { t: 'Oleh', f: x => x.by || '-' }
        ], mv, { click: true, empty: 'Tidak ada mutasi pada periode ini.' }) + '</section>';
      },
      bind: (el, s) => $$('[data-row]', el).forEach(tr => tr.onclick = () => {
        const id = tr.dataset.row;
        if (s.tab === 'saldo') { const [u, n] = id.split('|'); return matCard(u, n); }
        if (id.includes(':')) return soDetail(id.split(':')[0]);
        const d = get(id); if (d) d.jenis === 'penyesuaian' ? opnameForm(d) : stokForm(d.jenis, d);
      })
    });
  },
  summary() {
    let low = 0, n = 0;
    UNITS.forEach(u => stockSaldo(u).forEach(r => { if (r.masuk || r.prod || r.keluar || r.adj) n++; if (r.status === 'Menipis' || (r.status === 'Habis')) low++; }));
    return { main: low ? low + ' material menipis/habis' : n ? 'Stok terkendali' : 'Catat stok awal', tone: low ? 'warn' : '', sub: n + ' material bermutasi' };
  }
};
/* tanggal posisi stok: mutasi terakhir; tanpa tanggal → cut off hari ini */
function stokPosisi(rows) { return rows.reduce((a, r) => r.last > a ? r.last : a, '') || today(); }
function matOpts(v, unitKey = 'unit') { return matList(v[unitKey] || 'AMP').map(m => ({ v: m.nama, t: m.nama + ' (' + m.sat + ')' })); }
function stokForm(jenis, d, pre) {
  const st = stateOf('stok', {});
  const isIn = jenis === 'masuk';
  const v = d ? Object.assign({}, d) : Object.assign({ tgl: today(), unit: st.unit || 'AMP', jenis, updHarga: true }, pre || {});
  const satOf = x => { const m = matFind(x.unit, x.mat); return m ? m.sat : (x.sat || ''); };
  openForm({
    title: (d ? 'Ubah ' : '') + (isIn ? 'Barang Masuk' : 'Barang Keluar'), sub: isIn ? 'Pembelian, kiriman, atau stok awal material' : 'Pemakaian di luar produksi (maintenance, operasional, transfer)',
    value: v, onDelete: d ? () => remove(d.id) : null,
    fields: [
      { k: 'tgl', label: 'Tanggal', type: 'date', req: true },
      { k: 'unit', label: 'Unit', type: 'select', opts: UNITS.concat('Umum'), req: true, empty: false, onChange: x => { x.mat = ''; } },
      { k: 'mat', label: 'Material', type: 'select', opts: matOpts, req: true, full: true, add: { label: 'Tambah material baru…', fn: x => addMaterialDialog(x.unit) }, onChange: x => { x.sat = satOf(x); const lp = latestPrice(x.mat); if (isIn && lp && !x.harga) x.harga = Math.round(conv(1, x.sat, lp.sat, (minfo(x.mat) || {}).bj) * lp.harga); } },
      { k: 'qty', label: 'Jumlah', type: 'num', req: true, suffix: x => satOf(x) || '-', help: x => x.mat ? 'Saldo saat ini: ' + num(stockOf(x.unit, x.mat)) + ' ' + satOf(x) : '' },
      { k: 'harga', label: 'Harga satuan', type: 'money', show: () => isIn, help: 'Opsional — dipakai untuk nilai persediaan' },
      { k: 'supp', label: 'Supplier / asal', type: 'list', opts: () => all('supp').map(s => s.nama), show: () => isIn },
      { k: 'ref', label: isIn ? 'No. BPPB / Surat Jalan / DO' : 'Referensi (No. BPPB / Maintenance)', type: isIn ? 'list' : 'text', opts: () => all('bppb').map(b => b.no) },
      { k: 'updHarga', type: 'check', text: 'Perbarui harga material ini di Kartu Bahan (riwayat harga lama tetap tersimpan)', show: x => { if (!isIn || d || !(+x.harga > 0)) return false; const lp = latestPrice(x.mat); return !lp || Math.round(conv(1, satOf(x), lp.sat, (minfo(x.mat) || {}).bj) * lp.harga) !== Math.round(+x.harga); } },
      { k: 'ket', label: 'Keterangan', type: 'textarea', rows: 2 }
    ],
    onSave: x => {
      const data = { tgl: x.tgl, unit: x.unit, mat: x.mat, sat: satOf(x), jenis, qty: +x.qty, harga: +x.harga || 0, supp: x.supp || '', ref: x.ref || '', ket: x.ket || '' };
      if (!isIn && !d) { const sal = stockOf(x.unit, x.mat); if (sal < data.qty) toast('Perhatian: saldo ' + x.mat + ' menjadi minus (' + num(sal - data.qty) + ')', 'err'); }
      save('stok', data, d && d.id);
      const lp0 = latestPrice(x.mat), lpConv = lp0 ? Math.round(conv(1, data.sat, lp0.sat, (minfo(x.mat) || {}).bj) * lp0.harga) : 0;
      if (isIn && !d && x.updHarga && +x.harga > 0 && Math.round(+x.harga) !== lpConv) save('harga', { mat: x.mat, sat: data.sat, harga: +x.harga, tgl: x.tgl, supp: x.supp || '', ket: 'Dari barang masuk ' + (x.ref || '') });
      toast(isIn ? 'Barang masuk dicatat' : 'Barang keluar dicatat');
    }
  });
}
function opnameForm(d) {
  const st = stateOf('stok', {});
  const v = d ? Object.assign({}, d, { fisik: '' }) : { tgl: today(), unit: st.unit || 'AMP' };
  const satOf = x => { const m = matFind(x.unit, x.mat); return m ? m.sat : ''; };
  openForm({
    title: d ? 'Ubah Penyesuaian Stok' : 'Stock Opname', sub: 'Masukkan hasil hitung fisik — selisih dicatat sebagai penyesuaian', value: v, small: !!d,
    onDelete: d ? () => remove(d.id) : null,
    fields: d ? [
      { k: 'tgl', label: 'Tanggal', type: 'date', req: true }, { k: 'qty', label: 'Penyesuaian (+/-)', type: 'text', req: true, def: String(d.qty) }, { k: 'ket', label: 'Keterangan', type: 'textarea', rows: 2 }
    ] : [
      { k: 'tgl', label: 'Tanggal opname', type: 'date', req: true },
      { k: 'unit', label: 'Unit', type: 'select', opts: UNITS.concat('Umum'), empty: false, onChange: x => x.mat = '' },
      { k: 'mat', label: 'Material', type: 'select', opts: matOpts, req: true, full: true, add: { label: 'Tambah material baru…', fn: x => addMaterialDialog(x.unit) } },
      { k: 'sys', type: 'html', html: x => x.mat ? '<div class="note">Saldo sistem s.d. ' + tgl(x.tgl) + ': <b>' + num((stockSaldo(x.unit, x.tgl).find(r => r.m.nama === x.mat) || { saldo: 0 }).saldo) + ' ' + satOf(x) + '</b>' + (x.fisik !== '' && x.fisik != null ? ' · Selisih: <b>' + num(+x.fisik - (stockSaldo(x.unit, x.tgl).find(r => r.m.nama === x.mat) || { saldo: 0 }).saldo) + '</b>' : '') + '</div>' : '' },
      { k: 'fisik', label: 'Jumlah fisik', type: 'num', req: 'zero', suffix: x => satOf(x) || '-' },
      { k: 'ket', label: 'Keterangan', type: 'textarea', rows: 2, def: 'Stock opname' }
    ],
    onSave: x => {
      if (d) { save('stok', Object.assign({}, d, { tgl: x.tgl, qty: parseNum(String(x.qty).replace(/^\+/, '')) * (String(x.qty).trim().startsWith('-') ? -1 : 1), ket: x.ket }), d.id); return; }
      if (x.fisik === '' || x.fisik == null) { toast('Jumlah fisik wajib diisi', 'err'); return false; }
      const sys = (stockSaldo(x.unit, x.tgl).find(r => r.m.nama === x.mat) || { saldo: 0 }).saldo;
      const diff = +x.fisik - sys;
      if (Math.abs(diff) < 1e-9) { toast('Stok sesuai, tidak ada penyesuaian'); return; }
      save('stok', { tgl: x.tgl, unit: x.unit, mat: x.mat, sat: satOf(x), jenis: 'penyesuaian', qty: diff, ref: 'Opname', ket: (x.ket || 'Stock opname') + ' (sistem ' + num(sys) + ', fisik ' + num(x.fisik) + ')' });
      toast('Penyesuaian ' + (diff > 0 ? '+' : '') + num(diff) + ' dicatat');
    }
  });
}
function matCard(u, nama) {
  const m = matFind(u, nama) || { nama, sat: '', kat: '' };
  let run = 0;
  const mv = stockMoves(u).filter(x => x.mat.toLowerCase() === nama.toLowerCase()).map(x => (run += x.qty, Object.assign({ run }, x)));
  const lp = latestPrice(nama);
  detail({
    title: 'Kartu Stok — ' + nama, sub: UNIT_NAME[u] + ' · satuan ' + m.sat,
    html: infoGrid([['Unit', u], ['Kategori', m.kat], ['Satuan', m.sat], ['Saldo', num(run) + ' ' + m.sat], ['Stok minimum', m.min ? num(m.min) : '-'], ['Harga terbaru', lp ? rp(lp.harga) + ' / ' + lp.sat : '-']]) +
      '<h4 class="sub">Riwayat mutasi</h4>' + table([{ t: 'Tanggal', f: x => tgl(x.tgl) }, { t: 'Jenis', f: x => x.jenis }, { t: 'Referensi', f: x => x.ref || '-' }, { t: 'Keterangan', f: x => x.ket || '-', cls: 'wrap' },
      { t: 'Masuk', f: x => x.qty > 0 ? num(x.qty) : '', num: true }, { t: 'Keluar', f: x => x.qty < 0 ? num(-x.qty) : '', num: true }, { t: 'Saldo', f: x => '<b>' + num(x.run) + '</b>', num: true, raw: true }], mv.slice().reverse(), { empty: 'Belum ada mutasi.' }),
    buttons: [
      { id: 'set', t: 'Atur Material', icon: 'edit', fn: md => {
        md.close();
        openForm({
          title: 'Atur Material', sub: u + ' · ' + nama, small: true, value: { kat: m.kat, sat: m.sat, min: m.min || '' },
          fields: [{ k: 'kat', label: 'Kategori', type: 'select', opts: MAT_KAT, empty: false }, { k: 'sat', label: 'Satuan stok', type: 'select', opts: SATUAN, empty: false }, { k: 'min', label: 'Stok minimum', type: 'num' }, { k: 'hide', type: 'check', text: 'Sembunyikan material ini dari daftar unit ' + u }],
          onSave: x => { save('mat', { unit: u, nama, kat: x.kat, sat: x.sat, min: +x.min || 0, hide: !!x.hide }, m.doc); toast('Material diperbarui'); }
        });
      } },
      { id: 'in', t: 'Barang Masuk', icon: 'in', pri: true, fn: md => { md.close(); stokForm('masuk', null, { unit: u, mat: nama }); } }
    ]
  });
}
async function stokReport(s) {
  const units = s.unit ? [s.unit] : UNITS.concat('Umum');
  const R = await pdfReport({ title: 'Laporan Stok Material', sub: (s.unit ? UNIT_NAME[s.unit] : 'Seluruh unit') + ' · Posisi ' + tgl(today(), true) + ' · Mutasi ' + monthLabel(s.month), fname: 'Laporan_Stok_' + (s.unit || 'Semua') });
  let tot = 0, low = 0;
  units.forEach(u => stockSaldo(u).forEach(r => { if (r.masuk || r.prod || r.keluar || r.adj) tot++; if (r.status === 'Menipis' || r.status === 'Habis') low++; }));
  R.kv([['Unit', s.unit || 'AMP, CMP, SCP, PCP'], ['Material bermutasi', String(tot)], ['Menipis / habis', String(low), low ? 'red' : ''], ['Periode mutasi', monthLabel(s.month)]]);
  units.forEach(u => {
    const rows = stockSaldo(u).filter(r => r.masuk || r.prod || r.keluar || r.adj || s.unit);
    if (!rows.length) return;
    R.h2('Saldo Stok ' + u + ' — ' + UNIT_NAME[u], 'Posisi per ' + tgl(stokPosisi(rows), true));
    R.table(['No', 'Material', 'Kategori', 'Sat', 'Masuk', 'Keluar', 'Produksi', 'Penyesuaian', 'Saldo', 'Per Tanggal', 'Status'],
      rows.map((r, i) => [i + 1, r.m.nama, r.m.kat, r.m.sat, N_(r.masuk), N_(r.keluar), N_(r.prod), N_(r.adj), { content: N_(r.saldo), styles: { fontStyle: 'bold', halign: 'right' } }, r.last ? tgl(r.last) : tgl(today()) + ' (cut off)', r.status]),
      { cs: { 0: { halign: 'center', cellWidth: 8 }, 4: right, 5: right, 6: right, 7: right, 8: right, 9: { cellWidth: 22 } } });
  });
  let mv = [];
  units.forEach(u => stockMoves(u).forEach(x => inMonth(x.tgl, s.month) && mv.push(Object.assign({ unit: u }, x))));
  if (mv.length) {
    R.h2('Rincian Mutasi', monthLabel(s.month));
    R.table(['Tanggal', 'Unit', 'Material', 'Jenis', 'Jumlah', 'Sat', 'Referensi', 'Keterangan'], mv.map(x => [tgl(x.tgl), x.unit, x.mat, x.jenis, cellR((x.qty > 0 ? '+' : '') + N_(x.qty)), x.sat, x.ref || '-', x.ket || '-']), { cs: { 7: { cellWidth: 52 } } });
  }
  R.sign();
  await R.save();
}

/* =================== 2. PRODUKSI (SO / WO + BOM) =================== */
MODS.prod = {
  title: 'Produksi', icon: 'prod', desc: 'Sales Order / Work Order per proyek, BOM jobmix memotong stok otomatis',
  render(root) {
    const st = stateOf('prod', { tab: 'so', unit: '', q: '', month: curMonth() });
    return page(root, {
      key: 'prod', st, report: prodReport,
      tabs: [{ k: 'so', t: 'Sales Order / Work Order' }, { k: 'bom', t: 'Rekap BOM & Pemakaian' }, { k: 'jmf', t: 'Komposisi Jobmix' }],
      actions: [{ id: 'so', t: 'SO / WO Baru', pri: true }, { id: 'real', t: 'Catat Produksi', icon: 'prod' }],
      on: { so: () => soForm(), real: () => realForm() },
      filter: s => s.tab === 'jmf' ? periodBar(Object.assign({}, s, { month: undefined })) : periodBar(s),
      body: s => s.tab === 'so' ? soListHtml(s) : s.tab === 'bom' ? bomHtml(s) : editBadge('Komposisi Jobmix') + jmfHtml(s),
      bind: (el, s) => {
        $$('[data-row]', el).forEach(tr => tr.onclick = () => s.tab === 'jmf' ? jmfForm(tr.dataset.row.split('|')[0], tr.dataset.row.split('|')[1]) : soDetail(tr.dataset.row));
        const ap = $('[data-addprod]', el); if (ap) ap.onclick = () => jmfForm(s.unit || 'AMP', null);
        bindRelock(el);
      }
    });
  },
  summary() {
    const a = all('prod').filter(p => p.status !== 'Batal');
    const act = a.filter(p => soStatus(p) !== 'Selesai').length;
    const m = a.filter(p => inMonth(p.tgl, curMonth()));
    return { main: act + ' SO/WO berjalan', sub: 'Nilai bulan ini ' + rpS(sum(m, p => p.vol * p.harga)) };
  }
};
function soRows(s) {
  return byDateDesc(all('prod').filter(p => (!s.unit || p.unit === s.unit) && inMonth(p.tgl, s.month) && qMatch(s.q, p.no, p.proyek, p.produk, custName(p.cust), p.ref)));
}
function soListHtml(s) {
  const rows = soRows(s).map(p => Object.assign(p, { _s: soStats(p) }));
  const act = rows.filter(p => p.status !== 'Batal');
  const nso = sum(act, p => p._s.nilaiSO), hso = sum(act, p => p._s.hppSO);
  return '<div class="kpis">' + kpi('Jumlah SO / WO', act.length, monthLabel(s.month)) + kpi('Nilai SO', rpS(nso), 'harga jual x volume') + kpi('Total HPP', rpS(hso), 'BUASO + bunga modal') + kpi('Estimasi profit', rpS(nso - hso), 'margin ' + pct(nso ? (nso - hso) / nso : 0), nso - hso >= 0 ? 'good' : 'bad') + '</div>' +
    '<section class="card">' + table([
      { t: 'No. / Tanggal', f: p => '<b>' + esc(p.no) + '</b><small>' + tgl(p.tgl) + '</small>', raw: true },
      { t: 'Unit', f: p => unitChip(p.unit), raw: true },
      { t: 'Customer / Proyek', f: p => '<b>' + esc(p.proyek || '-') + '</b><small>' + esc(custName(p.cust)) + ' · ' + (p.jenis === 'internal' ? 'Internal' : 'Eksternal') + '</small>', raw: true },
      { t: 'Produk', f: p => p.produk },
      { t: 'Volume', f: p => '<b>' + num(p.vol) + '</b> ' + esc(p.sat) + '<small>prod ' + num(p._s.real) + ' · kirim ' + num(p._s.kirim) + '</small>', num: true, raw: true },
      { t: 'HPP / sat', f: p => rp(p.hpp), num: true }, { t: 'Harga SO / sat', f: p => rp(p.harga), num: true },
      { t: 'Nilai SO', f: p => rp(p._s.nilaiSO), num: true },
      { t: 'Profit', f: p => '<b class="' + (p._s.profitSO >= 0 ? 't-ok' : 't-bad') + '">' + rp(p._s.profitSO) + '</b><small>' + pct(p._s.margin) + '</small>', num: true, raw: true },
      { t: 'Status', f: p => stChip(soStatus(p, p._s)), raw: true }
    ], rows, { click: true, empty: 'Belum ada SO / WO pada periode ini.', emptyIcon: 'prod' }) + '</section>';
}
function soForm(d, pre) {
  const st = stateOf('prod', {});
  const v = d ? Object.assign({}, d) : Object.assign({ tgl: today(), unit: st.unit || 'AMP', jenis: 'internal', cust: CUST_AHG.id, prodNow: true, kirimNow: false }, pre || {});
  const calc = x => x.unit && x.produk ? hppCalc(x.unit, x.produk) : null;
  const priceFor = x => { const c = calc(x); return c ? Math.round(x.jenis === 'internal' ? c.harga.int : x.jenis === 'bc' ? c.harga.bc : c.harga.ext) : 0; };
  openForm({
    title: d ? 'Ubah ' + d.no : 'Sales Order / Work Order Baru', sub: 'Produksi berdasarkan permintaan — BOM langsung memotong stok material', wide: true, value: v,
    onDelete: d ? () => { remove(d.id); all('kirim').filter(k => k.so === d.id).forEach(k => remove(k.id)); } : null,
    fields: [
      { k: 'tgl', label: 'Tanggal', type: 'date', req: true },
      { k: 'unit', label: 'Unit produksi', type: 'seg', opts: UNITS, onChange: x => { x.produk = ''; x.harga = ''; } },
      { k: 'jenis', label: 'Jenis penjualan', type: 'seg', opts: [{ v: 'internal', t: 'Internal PT. AHG' }, { v: 'eksternal', t: 'Eksternal / Retail' }], onChange: x => { if (x.jenis === 'internal') x.cust = CUST_AHG.id; else if (x.cust === CUST_AHG.id) x.cust = ''; x.harga = priceFor(x) || x.harga; } },
      { k: 'cust', label: 'Customer', type: 'select', opts: x => custList().filter(c => x.jenis === 'internal' ? c.jenis === 'Internal' : true).map(c => ({ v: c.id, t: c.nama })), req: true, add: { label: 'Tambah customer baru…', fn: x => addCustomerDialog(x.jenis === 'internal' ? 'Internal' : 'Eksternal') } },
      { k: 'proyek', label: 'Nama proyek / lokasi kirim', req: true, ph: 'mis. Peningkatan Jalan ' + BCN + ' – ...' },
      { k: 'ref', label: 'No. PO / WO customer', ph: 'opsional' },
      { k: 'produk', label: 'Produk', type: 'select', req: true, opts: x => products(x.unit).map(p => ({ v: p.n, t: p.n + ' (' + p.s + ')' })), onChange: x => { x.harga = priceFor(x); } },
      { k: 'vol', label: 'Volume', type: 'num', req: true, suffix: x => { const c = calc(x); return c ? c.sat : '-'; } },
      { k: 'harga', label: 'Harga SO per satuan (excl. PPN)', type: 'money', req: true, help: x => { const c = calc(x); return c ? 'Price list Loco: Internal ' + rp(c.harga.int) + ' · Eksternal ' + rp(c.harga.ext) + ' · BC ' + rp(c.harga.bc) : ''; } },
      { k: 'ket', label: 'Catatan', ph: 'opsional' },
      { k: 'calc', type: 'html', html: x => soCalcHtml(x, calc(x)) },
      { k: 'prodNow', type: 'check', text: 'Catat realisasi produksi seluruh volume sekarang (stok material langsung terpotong)', show: () => !d },
      { k: 'kirimNow', type: 'check', text: 'Tandai seluruh volume sudah terkirim (masuk Kartu Penjualan)', show: () => !d },
      { k: 'rehpp', type: 'check', text: 'Hitung ulang HPP & BOM dengan jobmix dan harga bahan terbaru', show: () => !!d },
      { k: 'batal', type: 'check', text: 'Batalkan SO / WO ini', show: () => !!d, def: d && d.status === 'Batal' }
    ],
    onSave: x => {
      const c = calc(x);
      if (!c) { toast('Pilih produk', 'err'); return false; }
      const snap = !d || x.rehpp || d.unit !== x.unit || d.produk !== x.produk;
      const data = {
        no: d ? d.no : nextNo('prod', (x.jenis === 'internal' ? 'WO-' : 'SO-') + x.unit, x.tgl), tgl: x.tgl, unit: x.unit, jenis: x.jenis, cust: x.cust, proyek: x.proyek.trim(), ref: x.ref || '',
        produk: x.produk, sat: c.sat, vol: +x.vol, harga: +x.harga, ket: x.ket || '', real: d ? (d.real || []) : [], status: x.batal ? 'Batal' : '', mkt: x.mkt || (d && d.mkt) || ''
      };
      if (snap) Object.assign(data, { hpp: c.hpp, buaso: Object.assign({}, c.buaso, { bunga: c.bunga }), bom: c.lines.map(l => ({ nama: l.nama, komp: l.komp, sat: l.sat, koef: l.koef, harga: l.harga, stok: l.stok })) });
      else Object.assign(data, { hpp: d.hpp, buaso: d.buaso, bom: d.bom });
      if (!d && x.prodNow) data.real = [{ tgl: x.tgl, vol: +x.vol, ket: 'Produksi sesuai SO' }];
      const id = save('prod', data, d && d.id);
      if (!d && x.kirimNow) save('kirim', { tgl: x.tgl, so: id, vol: +x.vol, sj: nextNo('kirim', 'SJ-' + x.unit, x.tgl), kendaraan: '', sopir: '', ket: 'Dicatat bersama SO' });
      if (x.mkt) { const mk = get(x.mkt); if (mk) save('mkt', Object.assign({}, mk, { status: 'Menang', so: id }), mk.id); }
      toast((d ? 'Perubahan ' : '') + data.no + ' tersimpan' + (!d && x.prodNow ? ' — stok terpotong' : ''));
    }
  });
}
function soCalcHtml(x, c) {
  if (!c) return '<div class="note">Pilih unit dan produk untuk melihat HPP, BOM, dan kebutuhan material.</div>';
  const vol = +x.vol || 0, harga = +x.harga || 0, profit = (harga - c.hpp) * vol;
  const stokLines = c.lines.filter(l => l.stok && l.koef);
  return '<div class="calc"><div class="kpis sm">' + kpi('HPP / ' + c.sat, rp(c.hpp), 'BUASO ' + rp(c.cogs) + ' + bunga ' + rp(c.bunga)) + kpi('Nilai SO', rp(harga * vol)) + kpi('Total HPP', rp(c.hpp * vol)) + kpi('Profit', rp(profit), 'margin ' + pct(harga ? (harga - c.hpp) / harga : 0), profit >= 0 ? 'good' : 'bad') + '</div>' +
    '<div class="buaso">' + BUASO.map(([k, n]) => '<div><span>' + n + '</span><b>' + rp(c.buaso[k]) + '</b></div>').join('') + '</div>' +
    '<h4 class="sub">Build of Material — kebutuhan untuk ' + num(vol) + ' ' + esc(c.sat) + '</h4>' +
    table([{ t: 'Material', f: l => l.nama }, { t: 'Koef / ' + c.sat, f: l => num4(l.koef) + ' ' + l.sat, num: true },
    { t: 'Kebutuhan', f: l => num(l.koef * vol) + ' ' + l.sat, num: true },
    { t: 'Stok ' + x.unit, f: l => { const nm = (minfo(l.nama) || {}).nama || canon(l.nama); const m = matFind(x.unit, nm); const sal = stockOf(x.unit, nm); const need = conv(l.koef * vol, l.sat, m ? m.sat : l.sat, (minfo(nm) || {}).bj); return '<span class="' + (sal < need ? 't-bad' : 't-ok') + '">' + num(sal) + ' ' + esc(m ? m.sat : l.sat) + '</span>'; }, num: true, raw: true },
    { t: 'Biaya', f: l => rp(l.biaya * vol), num: true }], stokLines) + '</div>';
}
function soDetail(id) {
  const p = get(id); if (!p) return;
  const s = soStats(p);
  const kir = byDateDesc(all('kirim').filter(k => k.so === id));
  const invd = soInvoiced(id);
  detail({
    title: p.no, sub: UNIT_NAME[p.unit] + ' · ' + (p.jenis === 'internal' ? 'Internal PT. AHG' : 'Eksternal / Retail'),
    html: infoGrid([['Tanggal', tgl(p.tgl, true)], ['Customer', custName(p.cust)], ['Proyek', p.proyek], ['No. PO / WO', p.ref || '-'], ['Produk', p.produk], ['Volume', num(p.vol) + ' ' + p.sat], ['Harga SO', rp(p.harga) + ' / ' + p.sat], ['HPP', rp(p.hpp) + ' / ' + p.sat], ['Status', stChip(soStatus(p, s)), true], ['Dibuat oleh', p._by]]) +
      '<div class="prog"><div><span>Produksi</span><b>' + num(s.real) + ' / ' + num(s.vol) + ' ' + esc(p.sat) + '</b>' + bar(s.vol ? s.real / s.vol : 0) + '</div><div><span>Pengiriman</span><b>' + num(s.kirim) + ' / ' + num(s.vol) + ' ' + esc(p.sat) + '</b>' + bar(s.vol ? s.kirim / s.vol : 0, 'ok') + '</div><div><span>Ditagihkan</span><b>' + rp(invd) + '</b>' + bar(s.nilaiSO ? invd / s.nilaiSO : 0, 'warn') + '</div></div>' +
      '<div class="kpis sm">' + kpi('Nilai SO', rp(s.nilaiSO)) + kpi('Total HPP', rp(s.hppSO)) + kpi('Profit', rp(s.profitSO), pct(s.margin), s.profitSO >= 0 ? 'good' : 'bad') + kpi('Penjualan terkirim', rp(s.nilaiJual)) + '</div>' +
      '<h4 class="sub">BUASO per ' + esc(p.sat) + ' dan biaya yang sudah dikeluarkan</h4>' +
      table([{ t: 'Komponen', f: r => r[1] }, { t: 'Per ' + p.sat, f: r => rp((p.buaso || {})[r[0]]), num: true }, { t: 'Terpakai (' + num(s.real) + ' ' + p.sat + ')', f: r => rp(s.biayaReal[r[0]]), num: true }], BUASO.concat([['bunga', 'Bunga modal']]).map(r => Object.assign([...r], { id: r[0] }))) +
      '<h4 class="sub">Build of Material</h4>' +
      table([{ t: 'Uraian', f: l => l.nama }, { t: 'Komp', f: l => l.komp }, { t: 'Koefisien', f: l => num4(l.koef) + ' ' + l.sat, num: true }, { t: 'Kebutuhan SO', f: l => num(l.koef * p.vol), num: true }, { t: 'Terpakai', f: l => num(l.koef * s.real), num: true }, { t: 'Harga', f: l => rp(l.harga), num: true }, { t: 'Biaya SO', f: l => rp(l.koef * l.harga * p.vol), num: true }], (p.bom || []).filter(l => l.koef)) +
      '<h4 class="sub">Realisasi produksi</h4>' + table([{ t: 'Tanggal', f: r => tgl(r.tgl) }, { t: 'Volume', f: r => num(r.vol) + ' ' + p.sat, num: true }, { t: 'Keterangan', f: r => r.ket || '-' }, { t: '', f: r => '<button class="ibtn sm" data-rdel="' + r.i + '" aria-label="Hapus">' + ic('trash') + '</button>', raw: true }], (p.real || []).map((r, i) => Object.assign({ i, id: i }, r)), { empty: 'Belum ada realisasi produksi.' }) +
      '<h4 class="sub">Pengiriman</h4>' + table([{ t: 'Tanggal', f: k => tgl(k.tgl) }, { t: 'No. SJ', f: k => k.sj || '-' }, { t: 'Volume', f: k => num(k.vol) + ' ' + p.sat, num: true }, { t: 'Kendaraan / Sopir', f: k => [k.kendaraan, k.sopir].filter(Boolean).join(' / ') || '-' }, { t: 'Nilai', f: k => rp(k.vol * p.harga), num: true }], kir, { empty: 'Belum ada pengiriman.' }),
    bind: (el, m) => $$('[data-rdel]', el).forEach(b => b.onclick = async () => {
      if (!await confirmBox('Hapus realisasi', 'Realisasi produksi ini dihapus dan stok material dikembalikan.')) return;
      const real = (p.real || []).slice(); real.splice(+b.dataset.rdel, 1); save('prod', Object.assign({}, p, { real }), p.id); m.close(); soDetail(id);
    }),
    buttons: [
      { id: 'pdf', t: 'Cetak', icon: 'print', dark: true, fn: () => runReport(() => soPdf(p)) },
      { id: 'inv', t: 'Invoice', icon: 'file', fn: m => { m.close(); invForm(null, { cust: p.cust, so: p.id }); } },
      { id: 'jd', t: 'Jadwal', icon: 'cal', fn: m => { m.close(); jadwalForm(null, { unit: p.unit, so: p.id, cust: p.cust, proyek: p.proyek, produk: p.produk, sat: p.sat, vol: Math.min(s.sisaKirim || p.vol, p.vol) }); } },
      { id: 'edit', t: 'Ubah', icon: 'edit', fn: m => { m.close(); soForm(p); } },
      { id: 'kirim', t: 'Catat Kirim', icon: 'jadwal', fn: m => { m.close(); kirimForm(null, p.id); } },
      { id: 'real', t: 'Catat Produksi', icon: 'prod', pri: true, fn: m => { m.close(); realForm(p.id); } }
    ]
  });
}
function realForm(soId) {
  const open = all('prod').filter(p => p.status !== 'Batal' && soStats(p).sisaProd > 0);
  openForm({
    title: 'Catat Realisasi Produksi', sub: 'Volume yang diproduksi memotong stok material sesuai BOM', small: true,
    value: { so: soId || '', tgl: today() },
    fields: [
      { k: 'so', label: 'SO / WO', type: 'select', req: true, full: true, opts: () => open.concat(soId && !open.some(p => p.id === soId) ? [get(soId)] : []).map(p => ({ v: p.id, t: soLabel(p) })), onChange: x => { const p = get(x.so); x.vol = p ? soStats(p).sisaProd : ''; } },
      { k: 'tgl', label: 'Tanggal produksi', type: 'date', req: true },
      { k: 'vol', label: 'Volume diproduksi', type: 'num', req: true, def: x => { const p = get(x.so); return p ? soStats(p).sisaProd : ''; }, suffix: x => (get(x.so) || {}).sat || '-' },
      { k: 'ket', label: 'Keterangan', ph: 'mis. shift pagi' }
    ],
    onSave: x => { const p = get(x.so); if (!p) return false; save('prod', Object.assign({}, p, { real: (p.real || []).concat([{ tgl: x.tgl, vol: +x.vol, ket: x.ket || '' }]) }), p.id); toast('Produksi ' + num(x.vol) + ' ' + p.sat + ' dicatat — stok terpotong'); }
  });
}
function bomHtml(s) {
  const rows = new Map();
  const units = s.unit ? [s.unit] : UNITS;
  units.forEach(u => stockMoves(u).filter(x => x.jenis === 'produksi' && inMonth(x.tgl, s.month)).forEach(x => {
    const k = u + '|' + x.mat;
    const r = rows.get(k) || { id: k, unit: u, mat: x.mat, sat: x.sat, qty: 0, so: new Set() };
    r.qty += -x.qty; r.so.add(x.ref); rows.set(k, r);
  }));
  const arr = [...rows.values()].filter(r => qMatch(s.q, r.mat, r.unit)).sort((a, b) => a.unit.localeCompare(b.unit) || b.qty - a.qty);
  arr.forEach(r => { const lp = latestPrice(r.mat); r.nilai = lp ? r.qty * conv(1, r.sat, lp.sat, (minfo(r.mat) || {}).bj) * lp.harga : 0; });
  const prods = all('prod').filter(p => (!s.unit || p.unit === s.unit) && p.status !== 'Batal');
  const vol = {}; prods.forEach(p => (p.real || []).forEach(r => { if (inMonth(r.tgl, s.month)) { const k = p.unit + '|' + p.produk + '|' + p.sat; vol[k] = (vol[k] || 0) + (+r.vol || 0); } }));
  const pv = Object.entries(vol).map(([k, v]) => { const [u, n, sat] = k.split('|'); return { id: k, u, n, sat, v }; }).sort((a, b) => a.u.localeCompare(b.u) || b.v - a.v);
  return '<div class="two"><section class="card"><div class="chead"><h3>Volume produksi per produk</h3><div class="cmeta">' + monthLabel(s.month) + '</div></div>' +
    table([{ t: 'Unit', f: r => unitChip(r.u), raw: true }, { t: 'Produk', f: r => r.n }, { t: 'Volume', f: r => num(r.v) + ' ' + r.sat, num: true }], pv, { empty: 'Belum ada realisasi produksi.' }) + '</section>' +
    '<section class="card"><div class="chead"><h3>Pemakaian material (BOM)</h3><div class="cmeta">dipotong otomatis dari stok</div></div>' +
    table([{ t: 'Unit', f: r => unitChip(r.unit), raw: true }, { t: 'Material', f: r => r.mat }, { t: 'Pemakaian', f: r => num(r.qty) + ' ' + r.sat, num: true }, { t: 'Nilai (harga terbaru)', f: r => rp(r.nilai), num: true }, { t: 'SO', f: r => r.so.size, num: true }], arr, { empty: 'Belum ada pemakaian material.' }) + '</section></div>';
}
function jmfHtml(s) {
  const u = s.unit || 'AMP';
  const rows = products(u).filter(p => qMatch(s.q, p.n)).map(p => { const c = hppCalc(u, p.n); return Object.assign({ id: u + '|' + p.n, c }, p); });
  return '<div class="note">' + (s.unit ? '' : 'Menampilkan unit AMP — pilih unit pada filter untuk unit lain. ') + 'Komposisi acuan dari sheet RAPU-BUASO (Job Mix Formula & rincian BUASO). Ubah koefisien atau tambah produk; HPP, Price List, dan SO baru langsung memakai komposisi, harga bahan, dan biaya harian terbaru.</div>' +
    '<section class="card"><div class="chead"><div>' + unitChip(u) + '<h3>' + esc(UNIT_NAME[u]) + ' — ' + rows.length + ' produk</h3></div><button class="btn ghost sm" data-addprod>' + ic('plus') + 'Tambah produk</button></div>' +
    table([{ t: 'Produk', f: p => '<b>' + esc(p.n) + '</b>' + (p.edited ? ' ' + chip(p.def ? 'Diubah' : 'Baru', 'info') : ''), raw: true }, { t: 'Satuan', f: p => p.s },
    { t: 'Bahan', f: p => rp(p.c.buaso.B), num: true }, { t: 'U + A + S + O', f: p => rp(p.c.buaso.U + p.c.buaso.A + p.c.buaso.S + p.c.buaso.O), num: true }, { t: 'HPP + Bunga', f: p => '<b>' + rp(p.c.hpp) + '</b>', num: true, raw: true },
    { t: 'Loco BC', f: p => rp(p.c.harga.bc), num: true }, { t: 'Internal', f: p => rp(p.c.harga.int), num: true }, { t: 'Eksternal', f: p => rp(p.c.harga.ext), num: true }], rows, { click: true }) + '</section>';
}
const jmfForm = gated('Komposisi Jobmix (BUASO)', (u, n) => jmfFormRaw(u, n));
function jmfFormRaw(u, n) {
  const p = n ? productFind(u, n) : null;
  const v = p ? { unit: u, n: p.n, s: p.s, ext: p.h[2], b: p.b.map(l => ({ nama: l[0], komp: l[1], sat: l[2], koef: l[3], harga: l[4] })) } : { unit: u, n: '', s: { AMP: 'Ton', CMP: 'M3', SCP: 'Ton', PCP: 'Pcs' }[u], b: [] };
  const names = () => allMatNames().map(m => m.nama).concat(['Upah tenaga kerja', 'Maintenance & sparepart alat', 'Subkontraktor', 'Overhead & opex', 'Solar Industri - BBM alat produksi']);
  const hppOf = x => { let t = 0; (x.b || []).forEach(l => t += (+l.koef || 0) * (+l.harga || 0)); return { cogs: t, hpp: t * (1 + BUNGA) }; };
  openForm({
    title: p ? 'Komposisi Jobmix — ' + p.n : 'Produk Baru ' + u, sub: 'Koefisien per 1 satuan produk (B = bahan, U = upah, A = alat, S = subkon, O = overhead)', wide: true, value: v,
    onDelete: p && p.doc ? () => remove(p.doc) : null,
    extraBtn: p && p.doc && p.def ? { html: '<button type="button" class="btn ghost" data-reset>' + ic('refresh') + 'Kembalikan ke acuan</button>', bind: (f, x, m) => { $('[data-reset]', f).onclick = () => { remove(p.doc); m.close(); toast('Komposisi dikembalikan ke acuan RAPU-BUASO'); }; } } : null,
    fields: [
      { k: 'n', label: 'Nama produk', req: true, ro: !!(p && p.def) }, { k: 's', label: 'Satuan', type: 'select', opts: SATUAN, empty: false, ro: !!(p && p.def) },
      { k: 'ext', label: 'Harga pasar per satuan (excl. PPN)', type: 'money', show: () => u === 'PCP', help: 'Dipakai Price List PCP sesuai dasar harga (Tertinggi / BUASO / Pasar)' },
      { k: 'b', label: 'Komposisi / BOM per satuan', type: 'items', newRow: () => ({ komp: 'B', koef: '', harga: '' }), cols: [
        { k: 'nama', label: 'Uraian / material', type: 'list', opts: names, w: '34%', onChange: (row) => { const mi = minfo(row.nama); if (mi && !row.sat) row.sat = mi.sat; if (mi && !row.harga) { const lp = latestPrice(mi.nama); row.harga = lp ? lp.harga : mi.harga; } } },
        { k: 'komp', label: 'Komp', type: 'select', opts: ['B', 'U', 'A', 'S', 'O'], w: '70px' }, { k: 'sat', label: 'Satuan', type: 'select', opts: SATUAN, w: '90px' },
        { k: 'koef', label: 'Koefisien', num: true }, { k: 'harga', label: 'Harga satuan', num: true }, { k: 'jml', label: 'Jumlah', type: 'ro', f: r => rp((+r.koef || 0) * (+r.harga || 0)) }] },
      { k: 'sumh', type: 'html', html: x => { const h = hppOf(x); return '<div class="kpis sm">' + kpi('HPP (BUASO) isian', rp(h.cogs)) + kpi('HPP + Bunga', rp(h.cogs * (1 + bungaF()))) + kpi('Loco Internal', rp(ceilTo(h.cogs * (1 + bungaF()) / (1 - margin('int')), 0))) + kpi('Loco Eksternal', rp(ceilTo(h.cogs * (1 + bungaF()) / (1 - margin('ext')), 0))) + '</div><div class="note">Baris upah, alat, subkon, overhead, dan BBM disesuaikan otomatis dengan biaya harian unit di Kartu HPP; bahan memakai harga Kartu Bahan terbaru.</div>'; } }
    ],
    onSave: x => {
      const b = (x.b || []).filter(l => l.nama && +l.koef).map(l => [l.nama.trim(), l.komp || 'B', l.sat || '', +l.koef, +l.harga || 0]);
      if (!b.length) { toast('Isi minimal satu baris komposisi', 'err'); return false; }
      save('jmf', { unit: u, n: x.n.trim(), s: x.s, h: [+x.ext || 0, +x.ext || 0, +x.ext || 0], b }, p && p.doc);
      toast('Komposisi ' + x.n + ' tersimpan');
    }
  });
}
async function soPdf(p) {
  const s = soStats(p), c = custGet(p.cust) || {};
  const R = await pdfReport({ title: (p.jenis === 'internal' ? 'Work Order' : 'Sales Order') + ' Produksi', sub: p.no + ' · ' + UNIT_NAME[p.unit], fname: p.no.replace(/\//g, '-') });
  R.info([['Nomor', p.no], ['Tanggal', tgl(p.tgl, true)], ['Customer', c.nama || custName(p.cust)], ['Jenis', p.jenis === 'internal' ? 'Internal PT. Armada Hada Graha' : 'Eksternal / Retail'], ['Proyek', p.proyek], ['No. PO / WO', p.ref || '-'], ['Unit', p.unit + ' - ' + UNIT_NAME[p.unit]], ['Produk', p.produk], ['Volume', N_(p.vol) + ' ' + p.sat], ['Status', soStatus(p, s)]]);
  R.kv([['Harga SO / ' + p.sat, 'Rp ' + R_(p.harga)], ['HPP / ' + p.sat, 'Rp ' + R_(p.hpp)], ['Nilai SO', 'Rp ' + R_(s.nilaiSO)], ['Profit', 'Rp ' + R_(s.profitSO) + ' (' + pct(s.margin) + ')', s.profitSO < 0 ? 'red' : '']]);
  R.h2('Rincian BUASO');
  R.table(['Komponen', 'Biaya per ' + p.sat, 'Biaya SO (' + N_(p.vol) + ' ' + p.sat + ')', 'Terpakai (' + N_(s.real) + ' ' + p.sat + ')'],
    BUASO.concat([['bunga', 'Bunga modal kerja']]).map(([k, n]) => [n, cellR(R_((p.buaso || {})[k])), cellR(R_((p.buaso || {})[k] * p.vol)), cellR(R_(s.biayaReal[k]))]),
    { foot: ['HPP', cellR(R_(p.hpp)), cellR(R_(p.hpp * p.vol)), cellR(R_(s.biayaRealTot))] });
  R.h2('Build of Material (BOM)');
  R.table(['No', 'Uraian', 'Komp', 'Koefisien', 'Sat', 'Kebutuhan', 'Harga Satuan', 'Biaya'], (p.bom || []).filter(l => l.koef).map((l, i) => [i + 1, l.nama, l.komp, cellR(num4(l.koef)), l.sat, cellR(N_(l.koef * p.vol)), cellR(R_(l.harga)), cellR(R_(l.koef * l.harga * p.vol))]),
    { cs: { 0: { halign: 'center', cellWidth: 8 }, 2: center } });
  if ((p.real || []).length) { R.h2('Realisasi Produksi'); R.table(['Tanggal', 'Volume', 'Keterangan'], p.real.map(r => [tgl(r.tgl, true), cellR(N_(r.vol) + ' ' + p.sat), r.ket || '-'])); }
  const kir = all('kirim').filter(k => k.so === p.id);
  if (kir.length) { R.h2('Pengiriman'); R.table(['Tanggal', 'No. SJ', 'Volume', 'Kendaraan', 'Sopir', 'Nilai'], kir.map(k => [tgl(k.tgl), k.sj || '-', cellR(N_(k.vol) + ' ' + p.sat), k.kendaraan || '-', k.sopir || '-', cellR(R_(k.vol * p.harga))])); }
  if (p.ket) R.para('Catatan: ' + p.ket);
  R.sign([['Dibuat oleh', S.user.name], ['Kepala Unit ' + p.unit, ''], ['Kepala Basecamp', '']]);
  await R.save();
}
async function prodReport(s) {
  const rows = soRows(s).filter(p => p.status !== 'Batal');
  const R = await pdfReport({ title: 'Laporan Produksi & BOM', sub: (s.unit ? UNIT_NAME[s.unit] : 'Seluruh unit') + ' · ' + monthLabel(s.month), orient: 'l', fname: 'Laporan_Produksi_' + (s.unit || 'Semua') });
  const st = rows.map(p => soStats(p));
  const nso = sum(st, 'nilaiSO'), hso = sum(st, 'hppSO');
  R.kv([['Jumlah SO / WO', String(rows.length)], ['Nilai SO', 'Rp ' + R_(nso)], ['Total HPP', 'Rp ' + R_(hso)], ['Estimasi profit', 'Rp ' + R_(nso - hso) + ' (' + pct(nso ? (nso - hso) / nso : 0) + ')']]);
  UNITS.filter(u => !s.unit || u === s.unit).forEach(u => {
    const ru = rows.filter(p => p.unit === u); if (!ru.length) return;
    R.h2('Unit ' + u + ' - ' + UNIT_NAME[u], ru.length + ' SO/WO');
    R.table(['No. SO/WO', 'Tanggal', 'Customer', 'Proyek', 'Produk', 'Volume', 'Produksi', 'Terkirim', 'HPP/sat', 'Harga/sat', 'Nilai SO', 'Profit', 'Status'],
      ru.map(p => { const x = soStats(p); return [p.no, tgl(p.tgl), custName(p.cust), p.proyek, p.produk, cellR(N_(p.vol) + ' ' + p.sat), cellR(N_(x.real)), cellR(N_(x.kirim)), cellR(R_(p.hpp)), cellR(R_(p.harga)), cellR(R_(x.nilaiSO)), cellR(R_(x.profitSO)), soStatus(p, x)]; }),
      { fs: 7.2, foot: ['Total', '', '', '', '', '', '', '', '', '', cellR(R_(sum(ru, p => soStats(p).nilaiSO))), cellR(R_(sum(ru, p => soStats(p).profitSO))), ''] });
  });
  const usage = new Map();
  (s.unit ? [s.unit] : UNITS).forEach(u => stockMoves(u).filter(x => x.jenis === 'produksi' && inMonth(x.tgl, s.month)).forEach(x => { const k = u + '|' + x.mat + '|' + x.sat; usage.set(k, (usage.get(k) || 0) - x.qty); }));
  if (usage.size) {
    R.h2('Rekap Pemakaian Material (BOM)', monthLabel(s.month));
    R.table(['Unit', 'Material', 'Pemakaian', 'Satuan', 'Saldo stok saat ini'], [...usage].map(([k, q]) => { const [u, m, sat] = k.split('|'); return [u, m, cellR(N_(q)), sat, cellR(N_(stockOf(u, m)))]; }));
  }
  R.sign();
  await R.save();
}

/* =================== 3. PENJUALAN =================== */
MODS.jual = {
  title: 'Penjualan', icon: 'jual', desc: 'Pengiriman ke proyek internal PT. AHG dan retail, nilai jual, HPP BUASO, profit',
  render(root) {
    const st = stateOf('jual', { tab: 'rekap', unit: '', q: '', month: curMonth(), jenis: '' });
    const jx = JXON();
    if (jx && !st.jxSeen) { st.jxSeen = 1; if (!all('kirim').length) st.tab = 'jx'; } // basecamp tanpa catatan pengiriman → langsung ke rekap sheet
    if (!jx && st.tab === 'jx') st.tab = 'rekap';
    return page(root, {
      key: 'jual', st, report: s => s.tab === 'jx' && JXON() ? jxJualReport(s) : jualReport(s),
      tabs: (jx ? [{ k: 'jx', t: 'Penjualan Rekap Sheet' }] : []).concat([{ k: 'rekap', t: 'Rekap Penjualan' }, { k: 'kirim', t: 'Rincian Pengiriman' }, { k: 'hpp', t: 'Breakdown HPP (BUASO)' }]),
      actions: [{ id: 'kirim', t: 'Catat Pengiriman', pri: true, icon: 'jadwal' }],
      on: { kirim: () => kirimForm() },
      filter: s => periodBar(s, 'jual', '<select data-fk="jenis"><option value="">Internal & eksternal</option><option value="internal"' + (s.jenis === 'internal' ? ' selected' : '') + '>Internal PT. AHG</option><option value="eksternal"' + (s.jenis === 'eksternal' ? ' selected' : '') + '>Eksternal / Retail</option></select>'),
      body: s => s.tab === 'jx' && JXON() ? jxJualHtml(s) : jualHtml(s),
      bind: (el, s, fill) => { if (s.tab === 'jx' && JXON()) return jxKasBind(el, s, fill); $$('[data-row]', el).forEach(tr => tr.onclick = () => s.tab === 'kirim' ? kirimForm(get(tr.dataset.row)) : soDetail(tr.dataset.row)); }
    });
  },
  summary() { const d = jualData({ month: curMonth() }), x = JXON() ? jxJualSum(curMonth()) : null; return x && x.n ? { main: rpS(d.nilai + x.nilai) + ' bulan ini', sub: x.n + ' penjualan rekap sheet · uang masuk ' + rpS(x.masuk) } : { main: rpS(d.nilai) + ' bulan ini', sub: 'Profit ' + rpS(d.profit) }; }
};
function jualData(s) {
  const kir = all('kirim').filter(k => inMonth(k.tgl, s.month)).map(k => Object.assign(k, { p: get(k.so) })).filter(k => k.p && k.p.status !== 'Batal' && (!s.unit || k.p.unit === s.unit) && (!s.jenis || k.p.jenis === s.jenis) && qMatch(s.q, k.p.no, k.p.proyek, k.p.produk, custName(k.p.cust), k.sj, k.kendaraan, k.sopir));
  const per = new Map();
  kir.forEach(k => {
    const r = per.get(k.so) || { id: k.so, p: k.p, vol: 0, nilai: 0, hpp: 0, bs: { B: 0, U: 0, A: 0, S: 0, O: 0, bunga: 0 }, last: '' };
    r.vol += +k.vol; r.nilai += k.vol * k.p.harga; r.hpp += k.vol * k.p.hpp; r.last = k.tgl > r.last ? k.tgl : r.last;
    Object.keys(r.bs).forEach(c => r.bs[c] += k.vol * (+(k.p.buaso || {})[c] || 0));
    per.set(k.so, r);
  });
  const rows = [...per.values()].sort((a, b) => b.last.localeCompare(a.last));
  const nilai = sum(rows, 'nilai'), hpp = sum(rows, 'hpp');
  return { kir: byDateDesc(kir), rows, nilai, hpp, profit: nilai - hpp, int: sum(rows.filter(r => r.p.jenis === 'internal'), 'nilai'), ext: sum(rows.filter(r => r.p.jenis !== 'internal'), 'nilai') };
}
function jualHtml(s) {
  const d = jualData(s);
  const k = '<div class="kpis">' + kpi('Penjualan internal PT. AHG', rpS(d.int)) + kpi('Penjualan eksternal / retail', rpS(d.ext)) + kpi('Total penjualan', rpS(d.nilai), monthLabel(s.month)) + kpi('Profit', rpS(d.profit), 'HPP ' + rpS(d.hpp) + ' · margin ' + pct(d.nilai ? d.profit / d.nilai : 0), d.profit >= 0 ? 'good' : 'bad') + '</div>';
  if (s.tab === 'rekap') return k + '<section class="card">' + table([
    { t: 'SO / WO', f: r => '<b>' + esc(r.p.no) + '</b><small>terakhir kirim ' + tgl(r.last) + '</small>', raw: true }, { t: 'Unit', f: r => unitChip(r.p.unit), raw: true },
    { t: 'Customer / Proyek', f: r => '<b>' + esc(r.p.proyek) + '</b><small>' + esc(custName(r.p.cust)) + '</small>', raw: true }, { t: 'Jenis', f: r => chip(r.p.jenis === 'internal' ? 'Internal' : 'Retail', r.p.jenis === 'internal' ? 'info' : 'ok'), raw: true },
    { t: 'Produk', f: r => r.p.produk }, { t: 'Volume kirim', f: r => num(r.vol) + ' ' + r.p.sat, num: true }, { t: 'Harga / sat', f: r => rp(r.p.harga), num: true },
    { t: 'Nilai penjualan', f: r => rp(r.nilai), num: true }, { t: 'HPP', f: r => rp(r.hpp), num: true },
    { t: 'Profit', f: r => '<b class="' + (r.nilai - r.hpp >= 0 ? 't-ok' : 't-bad') + '">' + rp(r.nilai - r.hpp) + '</b>', num: true, raw: true }
  ], d.rows, { click: true, empty: 'Belum ada pengiriman pada periode ini. Catat pengiriman dari tombol di atas atau dari detail SO.', emptyIcon: 'jual' }) + '</section>';
  if (s.tab === 'kirim') return k + '<section class="card">' + table([
    { t: 'Tanggal', f: x => tgl(x.tgl) }, { t: 'No. Surat Jalan', f: x => x.sj || '-', cls: 'strong' }, { t: 'SO / WO', f: x => x.p.no }, { t: 'Unit', f: x => unitChip(x.p.unit), raw: true },
    { t: 'Proyek / Customer', f: x => '<b>' + esc(x.p.proyek) + '</b><small>' + esc(custName(x.p.cust)) + '</small>', raw: true }, { t: 'Produk', f: x => x.p.produk },
    { t: 'Volume', f: x => num(x.vol) + ' ' + x.p.sat, num: true }, { t: 'Kendaraan / Sopir', f: x => [x.kendaraan, x.sopir].filter(Boolean).join(' / ') || '-' }, { t: 'Nilai', f: x => rp(x.vol * x.p.harga), num: true }
  ], d.kir, { click: true, empty: 'Belum ada pengiriman pada periode ini.' }) + '</section>';
  // breakdown BUASO
  const prodBiaya = { B: 0, U: 0, A: 0, S: 0, O: 0, bunga: 0 };
  all('prod').filter(p => p.status !== 'Batal' && (!s.unit || p.unit === s.unit) && (!s.jenis || p.jenis === s.jenis)).forEach(p => (p.real || []).forEach(r => { if (inMonth(r.tgl, s.month)) Object.keys(prodBiaya).forEach(c => prodBiaya[c] += (+r.vol || 0) * (+(p.buaso || {})[c] || 0)); }));
  const perUnit = UNITS.map(u => { const rr = d.rows.filter(r => r.p.unit === u); const b = { B: 0, U: 0, A: 0, S: 0, O: 0, bunga: 0 }; rr.forEach(r => Object.keys(b).forEach(c => b[c] += r.bs[c])); return { id: u, u, b, nilai: sum(rr, 'nilai'), hpp: sum(rr, 'hpp') }; }).filter(r => r.nilai || !s.unit);
  const comps = BUASO.concat([['bunga', 'Bunga']]);
  const totHpp = sum(perUnit, 'hpp');
  return k + '<div class="buaso big">' + comps.map(([c, n]) => '<div><span>' + n + '</span><b>' + rpS(sum(perUnit, r => r.b[c])) + '</b><small>' + pct(totHpp ? sum(perUnit, r => r.b[c]) / totHpp : 0) + ' dari HPP</small></div>').join('') + '</div>' +
    '<section class="card"><div class="chead"><h3>HPP penjualan per unit (volume terkirim)</h3></div>' + table([{ t: 'Unit', f: r => unitChip(r.u) + ' ' + esc(UNIT_NAME[r.u]), raw: true }].concat(comps.map(([c, n]) => ({ t: n, f: r => rp(r.b[c]), num: true }))).concat([{ t: 'Total HPP', f: r => '<b>' + rp(r.hpp) + '</b>', num: true, raw: true }, { t: 'Penjualan', f: r => rp(r.nilai), num: true }, { t: 'Profit', f: r => rp(r.nilai - r.hpp), num: true }]), perUnit) + '</section>' +
    '<section class="card"><div class="chead"><h3>Biaya produksi yang sudah dikeluarkan (volume terproduksi)</h3><div class="cmeta">' + monthLabel(s.month) + '</div></div><div class="buaso">' + comps.map(([c, n]) => '<div><span>' + n + '</span><b>' + rp(prodBiaya[c]) + '</b></div>').join('') + '<div class="tot"><span>Total</span><b>' + rp(sum(Object.values(prodBiaya), x => x)) + '</b></div></div></section>';
}
function kirimForm(d, soId) {
  const open = all('prod').filter(p => p.status !== 'Batal' && (soStats(p).sisaKirim > 0 || (d && p.id === d.so) || p.id === soId));
  const v = d ? Object.assign({}, d) : { tgl: today(), so: soId || '' };
  openForm({
    title: d ? 'Ubah Pengiriman' : 'Catat Pengiriman', sub: 'Volume terkirim menjadi nilai penjualan di Kartu Penjualan', value: v, onDelete: d ? () => remove(d.id) : null,
    fields: [
      { k: 'so', label: 'SO / WO', type: 'select', req: true, full: true, opts: () => open.map(p => ({ v: p.id, t: soLabel(p) + ' (sisa ' + num(soStats(p).sisaKirim) + ' ' + p.sat + ')' })), onChange: x => { const p = get(x.so); if (p && !d) x.vol = soStats(p).sisaKirim; } },
      { k: 'tgl', label: 'Tanggal kirim', type: 'date', req: true },
      { k: 'sj', label: 'No. Surat Jalan', def: x => { const p = get(x.so); return p ? nextNo('kirim', 'SJ-' + p.unit, x.tgl) : ''; } },
      { k: 'vol', label: 'Volume', type: 'num', req: true, suffix: x => (get(x.so) || {}).sat || '-', def: x => { const p = get(x.so); return p ? soStats(p).sisaKirim : ''; } },
      { k: 'kendaraan', label: 'Kendaraan / No. Polisi', type: 'list', opts: ['Dump Truck 8 Ton', 'Truck Mixer 6 M3', 'Truk Engkel', 'Trailer'] },
      { k: 'sopir', label: 'Sopir' },
      { k: 'nilai', type: 'html', html: x => { const p = get(x.so); return p ? '<div class="note">Nilai penjualan: <b>' + rp((+x.vol || 0) * p.harga) + '</b> · HPP ' + rp((+x.vol || 0) * p.hpp) + ' · Profit <b>' + rp((+x.vol || 0) * (p.harga - p.hpp)) + '</b></div>' : ''; } },
      { k: 'ket', label: 'Keterangan', type: 'textarea', rows: 2 }
    ],
    onSave: x => {
      const p = get(x.so);
      if (!x.sj) x.sj = nextNo('kirim', 'SJ-' + p.unit, x.tgl);
      save('kirim', { tgl: x.tgl, so: x.so, vol: +x.vol, sj: x.sj, kendaraan: x.kendaraan || '', sopir: x.sopir || '', ket: x.ket || '' }, d && d.id);
      const st = soStats(p);
      if (!d && st.real < st.kirim + (+x.vol) - 1e-9) toast('Catatan: volume terkirim melebihi realisasi produksi ' + p.no, 'err'); else toast('Pengiriman ' + num(x.vol) + ' ' + p.sat + ' dicatat');
    }
  });
}
async function jualReport(s) {
  const d = jualData(s);
  const R = await pdfReport({ title: 'Laporan Penjualan', sub: (s.unit ? UNIT_NAME[s.unit] : 'Seluruh unit') + ' · ' + (s.jenis === 'internal' ? 'Internal PT. AHG' : s.jenis === 'eksternal' ? 'Eksternal / Retail' : 'Internal & Eksternal') + ' · ' + monthLabel(s.month), orient: 'l', fname: 'Laporan_Penjualan' });
  R.kv([['Penjualan internal', 'Rp ' + R_(d.int)], ['Penjualan eksternal', 'Rp ' + R_(d.ext)], ['Total penjualan', 'Rp ' + R_(d.nilai)], ['HPP penjualan', 'Rp ' + R_(d.hpp)], ['Profit', 'Rp ' + R_(d.profit), d.profit < 0 ? 'red' : ''], ['Margin', pct(d.nilai ? d.profit / d.nilai : 0)], ['Jumlah SO', String(d.rows.length)], ['Jumlah pengiriman', String(d.kir.length)]], 4);
  R.h2('Rekap Penjualan per SO / WO');
  R.table(['No. SO/WO', 'Unit', 'Customer', 'Proyek', 'Jenis', 'Produk', 'Volume', 'Harga/sat', 'Nilai Penjualan', 'HPP', 'Profit'],
    d.rows.map(r => [r.p.no, r.p.unit, custName(r.p.cust), r.p.proyek, r.p.jenis === 'internal' ? 'Internal' : 'Retail', r.p.produk, cellR(N_(r.vol) + ' ' + r.p.sat), cellR(R_(r.p.harga)), cellR(R_(r.nilai)), cellR(R_(r.hpp)), cellR(R_(r.nilai - r.hpp))]),
    { fs: 7.3, foot: ['Total', '', '', '', '', '', '', '', cellR(R_(d.nilai)), cellR(R_(d.hpp)), cellR(R_(d.profit))] });
  R.h2('Breakdown HPP Penjualan (BUASO)');
  const comps = BUASO.concat([['bunga', 'Bunga modal']]);
  R.table(['Unit'].concat(comps.map(c => c[1])).concat(['Total HPP', 'Penjualan', 'Profit']),
    UNITS.map(u => { const rr = d.rows.filter(r => r.p.unit === u); if (!rr.length) return null; return [u].concat(comps.map(([c]) => cellR(R_(sum(rr, r => r.bs[c]))))).concat([cellR(R_(sum(rr, 'hpp'))), cellR(R_(sum(rr, 'nilai'))), cellR(R_(sum(rr, r => r.nilai - r.hpp)))]); }).filter(Boolean),
    { foot: ['Total'].concat(comps.map(([c]) => cellR(R_(sum(d.rows, r => r.bs[c]))))).concat([cellR(R_(d.hpp)), cellR(R_(d.nilai)), cellR(R_(d.profit))]) });
  R.h2('Rincian Pengiriman');
  R.table(['Tanggal', 'No. SJ', 'SO/WO', 'Proyek', 'Produk', 'Volume', 'Kendaraan', 'Sopir', 'Nilai'], d.kir.map(k => [tgl(k.tgl), k.sj || '-', k.p.no, k.p.proyek, k.p.produk, cellR(N_(k.vol) + ' ' + k.p.sat), k.kendaraan || '-', k.sopir || '-', cellR(R_(k.vol * k.p.harga))]), { fs: 7.3 });
  R.sign();
  await R.save();
}
