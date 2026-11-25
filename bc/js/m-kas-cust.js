/* Kartu 4 Cash Flow (kas, invoice, piutang, hutang), Kartu 5 Customer, Kartu 6 Jadwal Pengiriman. */
'use strict';
const KAT_MASUK = ['Pelunasan Invoice', 'Uang Muka (DP) Customer', 'Penjualan Tunai', 'Dropping Dana Kantor Pusat', 'Lain-lain'];
const KAT_KELUAR = ['Pembelian Material (Bahan)', 'Upah Tenaga Kerja', 'Alat, BBM & Sewa Alat', 'Subkontraktor', 'Overhead & Operasional', 'Maintenance & Sparepart', 'Pembayaran Hutang', 'Lain-lain'];
function terbilang(n) {
  n = Math.floor(Math.abs(+n || 0));
  const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const f = x => x < 12 ? s[x] : x < 20 ? f(x - 10) + ' belas' : x < 100 ? f(Math.floor(x / 10)) + ' puluh ' + f(x % 10) : x < 200 ? 'seratus ' + f(x - 100) : x < 1000 ? f(Math.floor(x / 100)) + ' ratus ' + f(x % 100) : x < 2000 ? 'seribu ' + f(x - 1000) : x < 1e6 ? f(Math.floor(x / 1000)) + ' ribu ' + f(x % 1000) : x < 1e9 ? f(Math.floor(x / 1e6)) + ' juta ' + f(x % 1e6) : x < 1e12 ? f(Math.floor(x / 1e9)) + ' miliar ' + f(x % 1e9) : f(Math.floor(x / 1e12)) + ' triliun ' + f(x % 1e12);
  const t = (n === 0 ? 'nol' : f(n)).replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1) + ' rupiah';
}

/* =================== 4. CASH FLOW =================== */
MODS.kas = {
  title: 'Cash Flow Unit', icon: 'kas', desc: 'Uang masuk & keluar, invoice, piutang customer, dan hutang supplier',
  render(root) {
    const st = stateOf('kas', { tab: 'ringkas', q: '', month: curMonth() });
    st.units = false;
    return page(root, {
      key: 'kas', st, report: s => s.tab === 'jx' ? jxKasReport(s) : kasReport(s),
      tabs: [{ k: 'ringkas', t: 'Ringkasan' }, { k: 'arus', t: 'Arus Kas' }].concat(JXON() ? [{ k: 'jx', t: 'Penjualan Unit' }] : []).concat([{ k: 'inv', t: 'Invoice' }, { k: 'piutang', t: 'Piutang' }, { k: 'hutang', t: 'Hutang' }]),
      actions: [{ id: 'in', t: 'Uang Masuk', icon: 'in', pri: true }, { id: 'out', t: 'Uang Keluar', icon: 'out' }, { id: 'inv', t: 'Buat Invoice', icon: 'file' }, { id: 'ht', t: 'Catat Hutang', icon: 'plus' }],
      on: { in: () => kasForm(null, { arah: 'masuk' }), out: () => kasForm(null, { arah: 'keluar' }), inv: () => invForm(), ht: () => hutangForm() },
      filter: s => s.tab === 'jx' && JXON() ? periodBar(s, 'kas', jxUnitOpts(s) + jxKatOpts(s)) : periodBar(['piutang'].includes(s.tab) ? Object.assign({}, s, { month: undefined }) : s),
      body: s => s.tab === 'jx' && JXON() ? jxKasHtml(s) : (s.tab === 'ringkas' && JXON() ? jxKasMini(s) : '') + kasHtml(s),
      bind: (el, s, fill) => {
        if (s.tab === 'jx' && JXON()) return jxKasBind(el, s, fill);
        $$('[data-jxgo]', el).forEach(b => b.onclick = () => { const t = document.querySelector('[data-tab="jx"]'); if (t) t.click(); });
        $$('[data-row]', el).forEach(tr => tr.onclick = () => {
          const id = tr.dataset.row;
          if (s.tab === 'inv' || id.startsWith('in')) return invDetail(id);
          if (s.tab === 'hutang') return hutangDetail(id);
          if (s.tab === 'piutang') return id.startsWith('so:') ? soDetail(id.slice(3)) : custDetail(id);
          const k = get(id); if (k) kasForm(k);
        });
        $$('[data-wa]', el).forEach(a => a.onclick = e => e.stopPropagation());
        $$('[data-mkinv]', el).forEach(b => b.onclick = e => { e.stopPropagation(); const p = get(b.dataset.mkinv); invForm(null, { cust: p.cust, so: p.id }); });
      }
    });
  },
  summary() { const k = kasTotals(); return { main: 'Saldo ' + rpS(k.saldo), sub: 'Piutang ' + rpS(k.piutang) + ' · Hutang ' + rpS(k.hutang), tone: k.telat ? 'warn' : '' }; }
};
function kasTotals(month) {
  const ks = all('kas');
  const saldo = sum(ks, k => k.arah === 'masuk' ? +k.jumlah : -k.jumlah);
  const inv = all('inv').map(i => invStat(i));
  const ht = all('hutang').map(h => htStat(h));
  const m = month || curMonth();
  return {
    saldo, masuk: sum(ks.filter(k => k.arah === 'masuk' && inMonth(k.tgl, m)), 'jumlah'), keluar: sum(ks.filter(k => k.arah === 'keluar' && inMonth(k.tgl, m)), 'jumlah'),
    piutang: sum(inv, 'sisa'), hutang: sum(ht, 'sisa'), telat: inv.filter(x => x.telat).length + ht.filter(x => x.telat).length,
    belumTagih: sum(all('prod').filter(p => p.status !== 'Batal'), p => Math.max(0, soStats(p).nilaiJual - soInvoiced(p.id)))
  };
}
function kasHtml(s) {
  if (s.tab === 'ringkas') {
    const t = kasTotals(s.month || curMonth());
    const ks = all('kas').filter(k => inMonth(k.tgl, s.month));
    const kat = groupBy(ks, k => k.arah + '|' + k.kat);
    const rows = Object.entries(kat).map(([k, a]) => ({ id: k, arah: k.split('|')[0], kat: k.split('|')[1], n: a.length, jml: sum(a, 'jumlah') })).sort((a, b) => a.arah.localeCompare(b.arah) || b.jml - a.jml);
    const due = all('inv').map(i => Object.assign(i, { _s: invStat(i) })).filter(i => i._s.sisa > 0.5).sort((a, b) => String(a.jt).localeCompare(String(b.jt))).slice(0, 6);
    return '<div class="kpis">' + kpi('Saldo kas', rpS(t.saldo), 'akumulasi seluruh transaksi', t.saldo >= 0 ? 'good' : 'bad') + kpi('Uang masuk', rpS(t.masuk), monthLabel(s.month || curMonth())) + kpi('Uang keluar', rpS(t.keluar), monthLabel(s.month || curMonth())) + kpi('Arus bersih', rpS(t.masuk - t.keluar), '', t.masuk - t.keluar >= 0 ? 'good' : 'bad') + '</div>' +
      '<div class="kpis">' + kpi('Piutang customer', rpS(t.piutang), 'invoice belum lunas', t.piutang ? 'warn' : '') + kpi('Penjualan belum ditagih', rpS(t.belumTagih), 'terkirim, belum di-invoice') + kpi('Hutang supplier', rpS(t.hutang), 'belum dibayar', t.hutang ? 'warn' : '') + kpi('Lewat jatuh tempo', t.telat, 'invoice & hutang', t.telat ? 'bad' : '') + '</div>' +
      '<div class="two"><section class="card"><div class="chead"><h3>Arus kas per kategori</h3><div class="cmeta">' + monthLabel(s.month) + '</div></div>' +
      table([{ t: 'Arah', f: r => chip(r.arah === 'masuk' ? 'Masuk' : 'Keluar', r.arah === 'masuk' ? 'ok' : 'bad'), raw: true }, { t: 'Kategori', f: r => r.kat }, { t: 'Transaksi', f: r => r.n, num: true }, { t: 'Jumlah', f: r => rp(r.jml), num: true }], rows, { empty: 'Belum ada transaksi kas.' }) + '</section>' +
      '<section class="card"><div class="chead"><h3>Invoice jatuh tempo terdekat</h3></div>' +
      table([{ t: 'Invoice', f: i => '<b>' + esc(i.no) + '</b><small>' + esc(custName(i.cust)) + '</small>', raw: true }, { t: 'Jatuh tempo', f: i => '<span class="' + (i._s.telat ? 't-bad' : '') + '">' + tgl(i.jt) + '</span>', raw: true }, { t: 'Sisa', f: i => rp(i._s.sisa), num: true }], due, { click: true, empty: 'Tidak ada piutang terbuka.' }) + '</section></div>';
  }
  if (s.tab === 'arus') {
    const ks = all('kas').sort((a, b) => String(a.tgl).localeCompare(String(b.tgl)) || String(a._cr).localeCompare(String(b._cr)));
    let run = 0; const open = s.month ? sum(ks.filter(k => k.tgl < s.month + '-01'), k => k.arah === 'masuk' ? +k.jumlah : -k.jumlah) : 0;
    run = open;
    const rows = ks.filter(k => inMonth(k.tgl, s.month)).map(k => (run += k.arah === 'masuk' ? +k.jumlah : -k.jumlah, Object.assign({ run }, k))).filter(k => qMatch(s.q, k.kat, k.ket, k.pihak, k.metode)).reverse();
    return '<div class="note">Saldo awal ' + monthLabel(s.month) + ': <b>' + rp(open) + '</b> · Saldo akhir: <b>' + rp(run) + '</b></div><section class="card">' + table([
      { t: 'Tanggal', f: k => tgl(k.tgl) }, { t: 'Uraian', f: k => '<b>' + esc(k.ket || k.kat) + '</b><small>' + esc(k.kat) + (k.ohUnit ? ' · ' + esc(k.ohUnit) + (k.ohItem ? ' · ' + esc(k.ohItem) : '') : '') + (k.inv ? ' · ' + esc((get(k.inv) || {}).no || '') : '') + (k.hutang ? ' · hutang ' + esc((get(k.hutang) || {}).pihak || '') : '') + '</small>', raw: true },
      { t: 'Pihak', f: k => k.pihak || (k.inv ? custName((get(k.inv) || {}).cust) : '-') }, { t: 'Metode', f: k => k.metode || '-' },
      { t: 'Masuk', f: k => k.arah === 'masuk' ? '<b class="t-ok">' + rp(k.jumlah) + '</b>' : '', num: true, raw: true }, { t: 'Keluar', f: k => k.arah === 'keluar' ? '<b class="t-bad">' + rp(k.jumlah) + '</b>' : '', num: true, raw: true },
      { t: 'Saldo', f: k => rp(k.run), num: true }
    ], rows, { click: true, empty: 'Belum ada transaksi kas pada periode ini.', emptyIcon: 'kas' }) + '</section>';
  }
  if (s.tab === 'inv') {
    const rows = byDateDesc(all('inv').filter(i => inMonth(i.tgl, s.month) && qMatch(s.q, i.no, custName(i.cust), i.uraian))).map(i => Object.assign(i, { _s: invStat(i) }));
    return '<div class="kpis">' + kpi('Total invoice', rpS(sum(rows, i => i._s.total)), rows.length + ' dokumen') + kpi('Sudah dibayar', rpS(sum(rows, i => i._s.paid)), '', 'good') + kpi('Sisa tagihan', rpS(sum(rows, i => i._s.sisa)), '', 'warn') + kpi('Lewat jatuh tempo', rows.filter(i => i._s.telat).length, '', rows.some(i => i._s.telat) ? 'bad' : '') + '</div>' +
      '<section class="card">' + table([
        { t: 'No. Invoice', f: i => '<b>' + esc(i.no) + '</b><small>' + tgl(i.tgl) + '</small>', raw: true }, { t: 'Customer', f: i => custName(i.cust) }, { t: 'SO / Uraian', f: i => (get(i.so) || {}).no || i.uraian || '-', cls: 'wrap' },
        { t: 'Total', f: i => rp(i._s.total), num: true }, { t: 'Dibayar', f: i => rp(i._s.paid), num: true }, { t: 'Sisa', f: i => '<b>' + rp(i._s.sisa) + '</b>', num: true, raw: true },
        { t: 'Jatuh tempo', f: i => '<span class="' + (i._s.telat ? 't-bad' : '') + '">' + tgl(i.jt) + '</span>', raw: true }, { t: 'Status', f: i => stChip(i._s.telat ? 'Lewat jatuh tempo' : i._s.st).replace('chip ', 'chip ' + (i._s.telat ? 'bad ' : '')), raw: true }
      ], rows, { click: true, empty: 'Belum ada invoice pada periode ini.', emptyIcon: 'file' }) + '</section>';
  }
  if (s.tab === 'piutang') {
    const per = new Map();
    all('inv').forEach(i => { const x = invStat(i); if (x.sisa <= 0.5) return; const r = per.get(i.cust) || { id: i.cust, n: 0, sisa: 0, jt: '', telat: 0 }; r.n++; r.sisa += x.sisa; if (!r.jt || (i.jt && i.jt < r.jt)) r.jt = i.jt; if (x.telat) r.telat++; per.set(i.cust, r); });
    const rows = [...per.values()].filter(r => qMatch(s.q, custName(r.id))).sort((a, b) => b.sisa - a.sisa);
    const bt = all('prod').filter(p => p.status !== 'Batal').map(p => ({ p, v: soStats(p).nilaiJual - soInvoiced(p.id) })).filter(x => x.v > 0.5).map(x => ({ id: 'so:' + x.p.id, p: x.p, v: x.v }));
    return '<section class="card"><div class="chead"><h3>Daftar piutang per customer</h3><div class="cmeta">Total ' + rp(sum(rows, 'sisa')) + '</div></div>' + table([
      { t: 'Customer', f: r => '<b>' + esc(custName(r.id)) + '</b><small>' + esc((custGet(r.id) || {}).pic || '') + '</small>', raw: true }, { t: 'WhatsApp', f: r => waShow((custGet(r.id) || {}).wa) },
      { t: 'Invoice terbuka', f: r => r.n, num: true }, { t: 'Sisa piutang', f: r => '<b>' + rp(r.sisa) + '</b>', num: true, raw: true },
      { t: 'Jatuh tempo terdekat', f: r => '<span class="' + (r.telat ? 't-bad' : '') + '">' + tgl(r.jt) + (r.telat ? ' (' + r.telat + ' lewat)' : '') + '</span>', raw: true },
      { t: 'Follow up', f: r => { const c = custGet(r.id) || {}; return c.wa ? '<a class="btn wa sm" data-wa target="_blank" rel="noopener" href="' + esc(waLink(c.wa, tagihText(r.id))) + '">' + ic('wa') + 'Tagih via WA</a>' : '<span class="muted">No. WA belum ada</span>'; }, raw: true }
    ], rows, { click: true, empty: 'Tidak ada piutang. Semua invoice sudah lunas.', emptyIcon: 'cust' }) + '</section>' +
      '<section class="card"><div class="chead"><h3>Penjualan terkirim yang belum ditagih</h3><div class="cmeta">Total ' + rp(sum(bt, 'v')) + '</div></div>' + table([
        { t: 'SO / WO', f: x => x.p.no, cls: 'strong' }, { t: 'Customer', f: x => custName(x.p.cust) }, { t: 'Proyek', f: x => x.p.proyek }, { t: 'Belum ditagih', f: x => rp(x.v), num: true },
        { t: '', f: x => '<button class="btn ghost sm" data-mkinv="' + esc(x.p.id) + '">' + ic('file') + 'Buat invoice</button>', raw: true }
      ], bt, { click: true, empty: 'Semua penjualan terkirim sudah ditagihkan.' }) + '</section>';
  }
  const rows = byDateDesc(all('hutang').filter(h => inMonth(h.tgl, s.month) || htStat(h).sisa > 0.5).filter(h => qMatch(s.q, h.pihak, h.uraian, h.bppb))).map(h => Object.assign(h, { _s: htStat(h) }));
  return '<div class="kpis">' + kpi('Total hutang', rpS(sum(rows, h => h._s.total))) + kpi('Sudah dibayar', rpS(sum(rows, h => h._s.paid)), '', 'good') + kpi('Sisa hutang', rpS(sum(rows, h => h._s.sisa)), '', 'warn') + kpi('Lewat jatuh tempo', rows.filter(h => h._s.telat).length, '', rows.some(h => h._s.telat) ? 'bad' : '') + '</div>' +
    '<section class="card">' + table([
      { t: 'Tanggal', f: h => tgl(h.tgl) }, { t: 'Supplier / pihak', f: h => '<b>' + esc(h.pihak) + '</b><small>' + esc(h.uraian || '') + '</small>', raw: true }, { t: 'BPPB / Ref', f: h => h.bppb || h.ref || '-' },
      { t: 'Jumlah', f: h => rp(h._s.total), num: true }, { t: 'Dibayar', f: h => rp(h._s.paid), num: true }, { t: 'Sisa', f: h => '<b>' + rp(h._s.sisa) + '</b>', num: true, raw: true },
      { t: 'Jatuh tempo', f: h => '<span class="' + (h._s.telat ? 't-bad' : '') + '">' + tgl(h.jt) + '</span>', raw: true }, { t: 'Status', f: h => stChip(h._s.st), raw: true }
    ], rows, { click: true, empty: 'Belum ada catatan hutang.', emptyIcon: 'kas' }) + '</section>';
}
function tagihText(custId) {
  const c = custGet(custId) || {};
  const inv = all('inv').filter(i => i.cust === custId).map(i => Object.assign(i, { _s: invStat(i) })).filter(i => i._s.sisa > 0.5);
  return 'Yth. ' + (c.pic || c.nama || 'Bapak/Ibu') + ',\n\nBerikut kami sampaikan tagihan dari ' + PT + ' - ' + BC + ' yang belum terselesaikan:\n' +
    inv.map((i, n) => (n + 1) + '. ' + i.no + ' tgl ' + tgl(i.tgl) + ', jatuh tempo ' + tgl(i.jt) + ', sisa ' + rp(i._s.sisa)).join('\n') +
    '\n\nTotal: ' + rp(sum(inv, i => i._s.sisa)) + '\n\nMohon konfirmasi jadwal pembayarannya. Terima kasih.\n\nHormat kami,\n' + (S.user ? S.user.name : '') + '\n' + PT + ' - ' + BC;
}
function kasForm(d, pre) {
  const v = d ? Object.assign({}, d) : Object.assign({ tgl: today(), arah: 'masuk', metode: 'Transfer Bank' }, pre || {});
  if (!v.kat) v.kat = v.inv ? 'Pelunasan Invoice' : v.hutang ? 'Pembayaran Hutang' : '';
  openForm({
    title: d ? 'Ubah Transaksi Kas' : v.arah === 'masuk' ? 'Uang Masuk' : 'Uang Keluar', value: v, onDelete: d ? () => remove(d.id) : null,
    fields: [
      { k: 'arah', label: 'Arah', type: 'seg', opts: [{ v: 'masuk', t: 'Uang masuk' }, { v: 'keluar', t: 'Uang keluar' }], onChange: x => { x.kat = ''; x.inv = ''; x.hutang = ''; } },
      { k: 'tgl', label: 'Tanggal', type: 'date', req: true },
      { k: 'kat', label: 'Kategori', type: 'select', req: true, opts: x => x.arah === 'masuk' ? KAT_MASUK : KAT_KELUAR },
      { k: 'inv', label: 'Untuk invoice', type: 'select', full: true, show: x => x.arah === 'masuk', empty: '— Tanpa invoice —', opts: x => all('inv').filter(i => invStat(i).sisa > 0.5 || i.id === x.inv).map(i => ({ v: i.id, t: i.no + ' · ' + custName(i.cust) + ' · sisa ' + rp(invStat(i).sisa) })), onChange: x => { const i = get(x.inv); if (i) { x.jumlah = invStat(i).sisa; x.kat = 'Pelunasan Invoice'; x.pihak = custName(i.cust); } } },
      { k: 'hutang', label: 'Bayar hutang', type: 'select', full: true, show: x => x.arah === 'keluar', empty: '— Tanpa hutang —', opts: x => all('hutang').filter(h => htStat(h).sisa > 0.5 || h.id === x.hutang).map(h => ({ v: h.id, t: h.pihak + ' · ' + (h.uraian || '') + ' · sisa ' + rp(htStat(h).sisa) })), onChange: x => { const h = get(x.hutang); if (h) { x.jumlah = htStat(h).sisa; x.kat = 'Pembayaran Hutang'; x.pihak = h.pihak; } } },
      { k: 'ohUnit', label: 'Overhead untuk unit', type: 'select', empty: '— Belum ditandai —', show: x => x.arah === 'keluar' && x.kat === 'Overhead & Operasional', opts: [{ v: 'Bersama', t: 'Bersama (dibagi menurut porsi)' }].concat(UNITS.map(u => ({ v: u, t: u + ' - ' + UNIT_NAME[u] }))), help: 'Masuk ke menu Overhead per Unit › Realisasi Bulanan' },
      { k: 'ohItem', label: 'Uraian overhead', type: 'list', show: x => x.arah === 'keluar' && x.kat === 'Overhead & Operasional' && !!x.ohUnit, opts: x => ohItemNames(x.ohUnit) },
      { k: 'jumlah', label: 'Jumlah', type: 'money', req: true },
      { k: 'pihak', label: 'Pihak (diterima dari / dibayar kepada)', type: 'list', opts: () => custList().map(c => c.nama).concat(all('supp').map(s => s.nama)) },
      { k: 'metode', label: 'Metode', type: 'select', opts: ['Tunai', 'Transfer Bank', 'Giro / Cek'], empty: false },
      { k: 'ket', label: 'Uraian', type: 'textarea', rows: 2, req: true, def: x => x.inv ? 'Pembayaran ' + ((get(x.inv) || {}).no || '') : '' }
    ],
    onSave: x => {
      save('kas', { tgl: x.tgl, arah: x.arah, kat: x.kat, jumlah: +x.jumlah, inv: x.arah === 'masuk' ? x.inv || '' : '', hutang: x.arah === 'keluar' ? x.hutang || '' : '', pihak: x.pihak || '', metode: x.metode || '', ket: x.ket || '', ...(x.arah === 'keluar' && x.kat === 'Overhead & Operasional' && x.ohUnit ? { ohUnit: x.ohUnit, ohItem: x.ohItem || '' } : {}) }, d && d.id);
      toast((x.arah === 'masuk' ? 'Uang masuk ' : 'Uang keluar ') + rp(x.jumlah) + ' dicatat');
    }
  });
}
function invForm(d, pre) {
  const v = d ? Object.assign({}, d) : Object.assign({ tgl: today(), ppn: false, jt: addDays(today(), 30) }, pre || {});
  const fromSO = x => { const p = get(x.so); if (!p) return; const s = soStats(p); const base = (s.nilaiJual || s.nilaiSO) - soInvoiced(p.id); x.dpp = Math.max(0, Math.round(base)); x.vol = s.kirim || p.vol; x.uraian = p.produk + ' — ' + p.proyek + ' (' + p.no + ')'; };
  if (!d && v.so && v.dpp == null) fromSO(v);
  const total = x => Math.round((+x.dpp || 0) * (x.ppn ? 1.11 : 1));
  openForm({
    title: d ? 'Ubah ' + d.no : 'Buat Invoice', sub: 'Invoice tercatat sebagai piutang sampai dilunasi melalui Uang Masuk', value: v, onDelete: d ? () => remove(d.id) : null,
    fields: [
      { k: 'tgl', label: 'Tanggal invoice', type: 'date', req: true }, { k: 'jt', label: 'Jatuh tempo', type: 'date', req: true },
      { k: 'cust', label: 'Customer', type: 'select', req: true, full: true, opts: () => custList().map(c => ({ v: c.id, t: c.nama })), add: { label: 'Tambah customer baru…', fn: () => addCustomerDialog('Eksternal') }, onChange: x => { x.so = ''; } },
      { k: 'so', label: 'SO / WO', type: 'select', full: true, empty: '— Tanpa SO (tagihan lain) —', opts: x => all('prod').filter(p => p.cust === x.cust && p.status !== 'Batal').map(p => ({ v: p.id, t: soLabel(p) + ' · belum ditagih ' + rp(Math.max(0, (soStats(p).nilaiJual || soStats(p).nilaiSO) - soInvoiced(p.id))) })), onChange: fromSO },
      { k: 'uraian', label: 'Uraian tagihan', type: 'textarea', rows: 2, req: true },
      { k: 'vol', label: 'Volume (opsional)', type: 'num', suffix: x => (get(x.so) || {}).sat || '' },
      { k: 'dpp', label: 'Nilai tagihan (DPP)', type: 'money', req: true },
      { k: 'ppn', type: 'check', text: 'Kenakan PPN 11%' },
      { k: 'tot', type: 'html', html: x => '<div class="note">Total invoice: <b>' + rp(total(x)) + '</b><br><i>' + esc(terbilang(total(x))) + '</i></div>' },
      { k: 'ket', label: 'Catatan / rekening pembayaran', type: 'textarea', rows: 2 }
    ],
    onSave: x => {
      const id = save('inv', { no: d ? d.no : nextNo('inv', 'INV', x.tgl), tgl: x.tgl, jt: x.jt, cust: x.cust, so: x.so || '', uraian: x.uraian, vol: +x.vol || 0, dpp: +x.dpp, ppn: !!x.ppn, total: total(x), ket: x.ket || '' }, d && d.id);
      toast('Invoice ' + (get(id) || {}).no + ' tersimpan');
    }
  });
}
function invDetail(id) {
  const i = get(id); if (!i) return;
  const s = invStat(i), c = custGet(i.cust) || {};
  const pays = byDateDesc(all('kas').filter(k => k.inv === id));
  detail({
    title: i.no, sub: custName(i.cust),
    html: infoGrid([['Tanggal', tgl(i.tgl, true)], ['Jatuh tempo', tgl(i.jt, true)], ['Customer', c.nama], ['SO / WO', (get(i.so) || {}).no || '-'], ['Uraian', i.uraian], ['DPP', rp(i.dpp)], ['PPN 11%', i.ppn ? rp(i.total - i.dpp) : '-'], ['Total', rp(i.total)], ['Status', stChip(s.st), true], ['Sisa', rp(s.sisa)]]) +
      bar(s.total ? s.paid / s.total : 0, 'ok') +
      '<h4 class="sub">Riwayat pembayaran</h4>' + table([{ t: 'Tanggal', f: k => tgl(k.tgl) }, { t: 'Metode', f: k => k.metode || '-' }, { t: 'Uraian', f: k => k.ket || '-' }, { t: 'Jumlah', f: k => rp(k.jumlah), num: true }], pays, { empty: 'Belum ada pembayaran.' }),
    buttons: [
      { id: 'pdf', t: 'Cetak Invoice', icon: 'print', dark: true, fn: () => runReport(() => invPdf(i)) },
      c.wa ? { id: 'wa', t: 'Kirim WA', icon: 'wa', fn: () => window.open(waLink(c.wa, 'Yth. ' + (c.pic || c.nama) + ',\n\nBerikut tagihan ' + i.no + ' tanggal ' + tgl(i.tgl) + ' sebesar ' + rp(i.total) + ' (sisa ' + rp(s.sisa) + '), jatuh tempo ' + tgl(i.jt) + '.\nUraian: ' + i.uraian + '\n\nTerima kasih.\n' + PT + ' - ' + BC), '_blank') } : null,
      { id: 'edit', t: 'Ubah', icon: 'edit', fn: m => { m.close(); invForm(i); } },
      s.sisa > 0.5 ? { id: 'pay', t: 'Terima Pembayaran', icon: 'in', pri: true, fn: m => { m.close(); kasForm(null, { arah: 'masuk', inv: i.id, jumlah: s.sisa, kat: 'Pelunasan Invoice', pihak: c.nama, ket: 'Pembayaran ' + i.no }); } } : null
    ].filter(Boolean)
  });
}
async function invPdf(i) {
  const c = custGet(i.cust) || {}, p = get(i.so), s = invStat(i);
  const R = await pdfReport({ title: 'Invoice', sub: i.no, fname: i.no.replace(/\//g, '-') });
  R.info([['Nomor invoice', i.no], ['Kepada', c.nama || '-'], ['Tanggal', tgl(i.tgl, true)], ['Alamat', c.alamat || '-'], ['Jatuh tempo', tgl(i.jt, true)], ['NPWP', c.npwp || '-'], ['Referensi SO/WO', p ? p.no : '-'], ['Kontak', (c.pic ? c.pic + ' / ' : '') + (c.wa ? waShow(c.wa) : '-')]]);
  R.h2('Rincian Tagihan');
  const body = [[1, i.uraian, i.vol ? N_(i.vol) + ' ' + (p ? p.sat : '') : '-', i.vol ? cellR(R_(i.dpp / i.vol)) : '-', cellR(R_(i.dpp))]];
  R.table(['No', 'Uraian', 'Volume', 'Harga Satuan', 'Jumlah (Rp)'], body, { cs: { 0: { halign: 'center', cellWidth: 9 }, 1: { cellWidth: 82 } } });
  const rows = [['Dasar Pengenaan (DPP)', R_(i.dpp)]];
  if (i.ppn) rows.push(['PPN 11%', R_(i.total - i.dpp)]);
  rows.push(['TOTAL TAGIHAN', R_(i.total)]);
  if (s.paid) { rows.push(['Sudah dibayar', R_(s.paid)]); rows.push(['SISA TAGIHAN', R_(s.sisa)]); }
  R.doc.autoTable({ startY: R.y - 2, body: rows, theme: 'plain', margin: { left: R.W - R.M - 90, right: R.M }, styles: { fontSize: 9, cellPadding: 1.4 }, columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }, didParseCell: h => { if (/TOTAL|SISA/.test(h.row.raw[0])) { h.cell.styles.fillColor = [232, 237, 244]; h.cell.styles.textColor = [20, 54, 95]; } } });
  R.y = R.doc.lastAutoTable.finalY + 4;
  R.para('Terbilang: ' + terbilang(s.paid ? s.sisa : i.total));
  if (i.ket) R.para('Catatan: ' + i.ket);
  R.para('Pembayaran mohon ditransfer ke rekening resmi ' + PT + ' dan mencantumkan nomor invoice pada berita transfer.', 8);
  R.sign([['Penerima,', ''], ['Hormat kami,', S.user.name]]);
  await R.save();
}
function hutangForm(d, pre) {
  const v = d ? Object.assign({}, d) : Object.assign({ tgl: today(), jt: addDays(today(), 30) }, pre || {});
  openForm({
    title: d ? 'Ubah Hutang' : 'Catat Hutang', sub: 'Hutang pembelian material, sewa alat, jasa subkon, dan lainnya', value: v, onDelete: d ? () => remove(d.id) : null,
    fields: [
      { k: 'tgl', label: 'Tanggal', type: 'date', req: true }, { k: 'jt', label: 'Jatuh tempo', type: 'date' },
      { k: 'pihak', label: 'Supplier / pihak', type: 'list', req: true, full: true, opts: () => all('supp').map(s => s.nama) },
      { k: 'uraian', label: 'Uraian', type: 'textarea', rows: 2, req: true },
      { k: 'jumlah', label: 'Jumlah hutang', type: 'money', req: true },
      { k: 'bppb', label: 'No. BPPB', type: 'list', opts: () => all('bppb').map(b => b.no) }, { k: 'ref', label: 'No. Faktur / Nota' },
      { k: 'ket', label: 'Keterangan', type: 'textarea', rows: 2 }
    ],
    onSave: x => { save('hutang', { tgl: x.tgl, jt: x.jt || '', pihak: x.pihak, uraian: x.uraian, jumlah: +x.jumlah, bppb: x.bppb || '', ref: x.ref || '', ket: x.ket || '' }, d && d.id); toast('Hutang ' + rp(x.jumlah) + ' dicatat'); }
  });
}
function hutangDetail(id) {
  const h = get(id); if (!h) return;
  const s = htStat(h);
  const sp = all('supp').find(x => x.nama === h.pihak);
  detail({
    title: 'Hutang — ' + h.pihak, sub: h.uraian,
    html: infoGrid([['Tanggal', tgl(h.tgl, true)], ['Jatuh tempo', tgl(h.jt, true)], ['Jumlah', rp(h.jumlah)], ['Dibayar', rp(s.paid)], ['Sisa', rp(s.sisa)], ['Status', stChip(s.st), true], ['No. BPPB', h.bppb || '-'], ['No. Faktur', h.ref || '-']]) + bar(s.total ? s.paid / s.total : 0, 'ok') +
      '<h4 class="sub">Pembayaran</h4>' + table([{ t: 'Tanggal', f: k => tgl(k.tgl) }, { t: 'Metode', f: k => k.metode || '-' }, { t: 'Uraian', f: k => k.ket }, { t: 'Jumlah', f: k => rp(k.jumlah), num: true }], byDateDesc(all('kas').filter(k => k.hutang === id)), { empty: 'Belum ada pembayaran.' }),
    buttons: [
      sp && sp.wa ? { id: 'wa', t: 'Hubungi', icon: 'wa', fn: () => window.open(waLink(sp.wa), '_blank') } : null,
      { id: 'edit', t: 'Ubah', icon: 'edit', fn: m => { m.close(); hutangForm(h); } },
      s.sisa > 0.5 ? { id: 'pay', t: 'Bayar', icon: 'out', pri: true, fn: m => { m.close(); kasForm(null, { arah: 'keluar', hutang: h.id, jumlah: s.sisa, kat: 'Pembayaran Hutang', pihak: h.pihak, ket: 'Pembayaran hutang ' + h.uraian }); } } : null
    ].filter(Boolean)
  });
}
async function kasReport(s) {
  const t = kasTotals(s.month || curMonth());
  const R = await pdfReport({ title: 'Laporan Cash Flow Unit', sub: BC + ' · ' + monthLabel(s.month), orient: 'l', fname: 'Laporan_Cash_Flow' });
  R.kv([['Saldo kas', 'Rp ' + R_(t.saldo)], ['Uang masuk', 'Rp ' + R_(t.masuk)], ['Uang keluar', 'Rp ' + R_(t.keluar)], ['Arus bersih', 'Rp ' + R_(t.masuk - t.keluar)], ['Piutang', 'Rp ' + R_(t.piutang)], ['Belum ditagih', 'Rp ' + R_(t.belumTagih)], ['Hutang', 'Rp ' + R_(t.hutang)], ['Lewat jatuh tempo', String(t.telat), t.telat ? 'red' : '']], 4);
  const ks = all('kas').sort((a, b) => String(a.tgl).localeCompare(String(b.tgl)));
  const open = s.month ? sum(ks.filter(k => k.tgl < s.month + '-01'), k => k.arah === 'masuk' ? +k.jumlah : -k.jumlah) : 0;
  let run = open;
  R.h2('Arus Kas', 'Saldo awal Rp ' + R_(open));
  const rows = ks.filter(k => inMonth(k.tgl, s.month));
  R.table(['Tanggal', 'Kategori', 'Uraian', 'Pihak', 'Metode', 'Masuk', 'Keluar', 'Saldo'], rows.map(k => { run += k.arah === 'masuk' ? +k.jumlah : -k.jumlah; return [tgl(k.tgl), k.kat, k.ket || '-', k.pihak || '-', k.metode || '-', cellR(k.arah === 'masuk' ? R_(k.jumlah) : ''), cellR(k.arah === 'keluar' ? R_(k.jumlah) : ''), cellR(R_(run))]; }),
    { fs: 7.4, foot: ['Total', '', '', '', '', cellR(R_(sum(rows.filter(k => k.arah === 'masuk'), 'jumlah'))), cellR(R_(sum(rows.filter(k => k.arah === 'keluar'), 'jumlah'))), cellR(R_(run))] });
  const inv = all('inv').map(i => Object.assign(i, { _s: invStat(i) })).filter(i => i._s.sisa > 0.5);
  R.h2('Daftar Piutang (Invoice Belum Lunas)');
  R.table(['No. Invoice', 'Tanggal', 'Customer', 'WhatsApp', 'Uraian', 'Total', 'Dibayar', 'Sisa', 'Jatuh Tempo', 'Status'], inv.map(i => [i.no, tgl(i.tgl), custName(i.cust), waShow((custGet(i.cust) || {}).wa), i.uraian, cellR(R_(i._s.total)), cellR(R_(i._s.paid)), cellR(R_(i._s.sisa)), tgl(i.jt), i._s.telat ? 'Lewat jatuh tempo' : i._s.st]),
    { fs: 7.3, foot: ['Total', '', '', '', '', cellR(R_(sum(inv, i => i._s.total))), cellR(R_(sum(inv, i => i._s.paid))), cellR(R_(sum(inv, i => i._s.sisa))), '', ''] });
  const ht = all('hutang').map(h => Object.assign(h, { _s: htStat(h) })).filter(h => h._s.sisa > 0.5);
  R.h2('Daftar Hutang');
  R.table(['Tanggal', 'Supplier / Pihak', 'Uraian', 'BPPB', 'Jumlah', 'Dibayar', 'Sisa', 'Jatuh Tempo'], ht.map(h => [tgl(h.tgl), h.pihak, h.uraian, h.bppb || '-', cellR(R_(h._s.total)), cellR(R_(h._s.paid)), cellR(R_(h._s.sisa)), tgl(h.jt)]),
    { fs: 7.3, foot: ['Total', '', '', '', cellR(R_(sum(ht, h => h._s.total))), cellR(R_(sum(ht, h => h._s.paid))), cellR(R_(sum(ht, h => h._s.sisa))), ''] });
  const allInv = all('inv').filter(i => inMonth(i.tgl, s.month));
  if (allInv.length) { R.h2('Invoice Terbit', monthLabel(s.month)); R.table(['No. Invoice', 'Tanggal', 'Customer', 'Uraian', 'Total', 'Status'], allInv.map(i => [i.no, tgl(i.tgl), custName(i.cust), i.uraian, cellR(R_(i.total)), invStat(i).st])); }
  R.sign();
  await R.save();
}

/* =================== 5. CUSTOMER =================== */
MODS.cust = {
  title: 'Customer Unit', icon: 'cust', desc: 'Database customer untuk repeat order dan follow up pembayaran',
  render(root) {
    const st = stateOf('cust', { q: '', jenis: '' });
    st.units = false;
    return page(root, {
      key: 'cust', st, report: custReport,
      actions: [{ id: 'add', t: 'Tambah Customer', pri: true }],
      on: { add: () => custForm() },
      filter: s => periodBar(s, 'cust', (JXON() ? '<select data-fk="aktif" title="Asal customer"><option value="">Semua customer</option><option value="jx"' + (s.aktif === 'jx' ? ' selected' : '') + '>Ada penjualan di rekap sheet</option><option value="pi"' + (s.aktif === 'pi' ? ' selected' : '') + '>Memiliki piutang</option></select>' : '') + '<select data-fk="jenis"><option value="">Semua jenis</option><option' + (s.jenis === 'Internal' ? ' selected' : '') + '>Internal</option><option' + (s.jenis === 'Eksternal' ? ' selected' : '') + '>Eksternal</option></select>'),
      body: s => {
        const rows = custList().filter(c => (!s.jenis || c.jenis === s.jenis) && qMatch(s.q, c.nama, c.pic, c.ktp, c.npwp, c.alamat, c.wa)).map(c => Object.assign(c, custStats(c.id)))
          .filter(c => !s.aktif || (s.aktif === 'jx' ? JXON() && (jxByCust()[c.id] || []).length : c.piutang > 0));
        return (JXON() ? '<div class="note">' + ic('cust') + 'Customer eksternal (retail) dan internal (proyek HO PT. AHG) juga diambil dari rekap sheet penjualan — penjualan & piutangnya ikut dihitung. Gunakan filter jenis untuk memisahkan.</div>' : '') +
          '<div class="kpis">' + kpi('Jumlah customer', rows.length, JXON() ? rows.filter(c => c.jenis === 'Eksternal').length + ' eksternal · ' + rows.filter(c => c.jenis === 'Internal').length + ' internal' : '') + kpi('Repeat order', rows.filter(c => c.order > 1).length, 'lebih dari 1 SO') + kpi('Total penjualan', rpS(sum(rows, 'jual'))) + kpi('Total piutang', rpS(sum(rows, 'piutang')), '', sum(rows, 'piutang') ? 'warn' : '') + '</div>' +
          '<section class="card">' + table([
            { t: 'Customer', f: c => '<b>' + esc(c.nama) + '</b><small>' + esc([c.pic, c.ktp && c.ktp !== c.pic ? 'KTP: ' + c.ktp : ''].filter(Boolean).join(' · ') || '-') + '</small>', raw: true },
            { t: 'Jenis', f: c => chip(c.jenis || '-', c.jenis === 'Internal' ? 'info' : 'ok'), raw: true }, { t: 'WhatsApp / HP', f: c => waShow(c.wa) }, { t: 'NPWP', f: c => c.npwp || '-' },
            { t: 'Alamat', f: c => c.alamat || '-', cls: 'wrap' }, { t: 'Order', f: c => c.order, num: true }, { t: 'Order terakhir', f: c => tgl(c.last) },
            { t: 'Total penjualan', f: c => rp(c.jual), num: true }, { t: 'Piutang', f: c => '<b class="' + (c.piutang ? 't-warn' : '') + '">' + rp(c.piutang) + '</b>', num: true, raw: true },
            { t: '', f: c => c.wa ? '<a class="ibtn wa" data-wa target="_blank" rel="noopener" title="Chat WhatsApp" href="' + esc(waLink(c.wa)) + '">' + ic('wa') + '</a>' : '', raw: true }
          ], rows, { click: true, empty: 'Belum ada customer.', emptyIcon: 'cust' }) + '</section>';
      },
      bind: el => { $$('[data-row]', el).forEach(tr => tr.onclick = () => custDetail(tr.dataset.row)); $$('[data-wa]', el).forEach(a => a.onclick = e => e.stopPropagation()); }
    });
  },
  summary() { const a = custList(); return { main: a.length + ' customer', sub: a.filter(c => custStats(c.id).piutang > 0).length + ' customer memiliki piutang' }; }
};
function custStats(id) {
  const so = all('prod').filter(p => p.cust === id && p.status !== 'Batal');
  const r = { order: so.length, last: so.reduce((m, p) => p.tgl > m ? p.tgl : m, ''), jual: sum(so, p => soStats(p).nilaiJual), piutang: sum(all('inv').filter(i => i.cust === id), i => invStat(i).sisa) };
  if (JXON()) { const x = jxCustStats(id); r.order += x.order; r.last = x.last > r.last ? x.last : r.last; r.jual += x.jual; r.piutang += x.piutang; }
  return r;
}
function custForm(d, cb, jenis, onCancel) {
  if (typeof d === 'string') d = custGet(d);
  const v = d ? Object.assign({}, d) : { jenis: jenis || 'Eksternal' };
  openForm({
    title: d ? 'Ubah Customer' : 'Tambah Customer', sub: 'Data lengkap untuk penagihan, faktur pajak, dan repeat order', value: v,
    onDelete: d && !d.builtin && !all('prod').some(p => p.cust === d.id) ? () => remove(d.id) : null, onCancel,
    fields: [
      { k: 'nama', label: 'Nama customer / perusahaan', req: true, full: true },
      { k: 'jenis', label: 'Jenis', type: 'seg', opts: ['Internal', 'Eksternal'] },
      { k: 'pic', label: 'Kontak person (PIC)' },
      { k: 'ktp', label: 'Nama lengkap sesuai KTP' }, { k: 'nik', label: 'NIK KTP', type: 'tel', max: 16 },
      { k: 'npwp', label: 'NPWP' }, { k: 'wa', label: 'No. WhatsApp', type: 'tel', ph: '08xxxxxxxxxx' },
      { k: 'hp', label: 'No. HP lain', type: 'tel' }, { k: 'email', label: 'Email', type: 'email' },
      { k: 'alamat', label: 'Alamat lengkap', type: 'textarea', rows: 2 },
      { k: 'ket', label: 'Catatan', type: 'textarea', rows: 2 }
    ],
    onSave: x => {
      const data = { nama: x.nama.trim(), jenis: x.jenis, pic: x.pic || '', ktp: x.ktp || '', nik: x.nik || '', npwp: x.npwp || '', wa: x.wa ? waNorm(x.wa) : '', hp: x.hp || '', email: x.email || '', alamat: x.alamat || '', ket: x.ket || '' };
      const id = save('cust', data, d && d.id);
      toast('Customer ' + data.nama + ' tersimpan');
      cb && setTimeout(() => cb(id), 0);
    }
  });
}
function custDetail(id) {
  const c = custGet(id); if (!c) return;
  const st = custStats(id);
  const so = byDateDesc(all('prod').filter(p => p.cust === id));
  const inv = byDateDesc(all('inv').filter(i => i.cust === id)).map(i => Object.assign(i, { _s: invStat(i) }));
  detail({
    title: c.nama, sub: (c.jenis || '') + ' · ' + st.order + ' order',
    html: infoGrid([['Kontak person', c.pic], ['Nama sesuai KTP', c.ktp], ['NIK', c.nik], ['NPWP', c.npwp], ['WhatsApp', waShow(c.wa)], ['HP lain', c.hp], ['Email', c.email], ['Alamat', c.alamat], ['Total penjualan', rp(st.jual)], ['Piutang', rp(st.piutang)]]) +
      (JXON() && (jxByCust()[id] || []).length ? '<h4 class="sub">Riwayat penjualan (rekap sheet ' + esc(c.jenis === 'Internal' ? 'tagihan internal' : 'penjualan eksternal') + ')</h4>' + jxTable(jxByCust()[id]) : '') +
      (so.length || !JXON() || !(jxByCust()[id] || []).length ? '<h4 class="sub">Riwayat order</h4>' + table([{ t: 'SO / WO', f: p => p.no, cls: 'strong' }, { t: 'Tanggal', f: p => tgl(p.tgl) }, { t: 'Proyek', f: p => p.proyek }, { t: 'Produk', f: p => p.produk }, { t: 'Volume', f: p => num(p.vol) + ' ' + p.sat, num: true }, { t: 'Nilai', f: p => rp(p.vol * p.harga), num: true }, { t: 'Status', f: p => stChip(soStatus(p)), raw: true }], so, { empty: 'Belum ada order.' }) : '') +
      (inv.length || !JXON() || !(jxByCust()[id] || []).length ? '<h4 class="sub">Invoice</h4>' + table([{ t: 'No.', f: i => i.no, cls: 'strong' }, { t: 'Tanggal', f: i => tgl(i.tgl) }, { t: 'Jatuh tempo', f: i => tgl(i.jt) }, { t: 'Total', f: i => rp(i.total), num: true }, { t: 'Sisa', f: i => rp(i._s.sisa), num: true }, { t: 'Status', f: i => stChip(i._s.st), raw: true }], inv, { empty: 'Belum ada invoice.' }) : ''),
    bind: el => JXON() && jxBind(el),
    buttons: [
      c.wa ? { id: 'chat', t: 'Chat WA', icon: 'wa', fn: () => window.open(waLink(c.wa), '_blank') } : null,
      c.wa && st.piutang > 0 ? { id: 'tagih', t: 'Tagih via WA', icon: 'send', fn: () => window.open(waLink(c.wa, tagihText(id)), '_blank') } : null,
      { id: 'so', t: 'Repeat Order', icon: 'plus', fn: m => { m.close(); const last = so[0]; soForm(null, last ? { unit: last.unit, jenis: last.jenis, cust: id, produk: last.produk, proyek: last.proyek, harga: last.harga } : { cust: id, jenis: c.jenis === 'Internal' ? 'internal' : 'eksternal' }); } },
      { id: 'edit', t: 'Ubah Data', icon: 'edit', pri: true, fn: m => { m.close(); custForm(c); } }
    ].filter(Boolean)
  });
}
async function custReport(s) {
  const rows = custList().filter(c => (!s.jenis || c.jenis === s.jenis) && qMatch(s.q, c.nama, c.pic, c.alamat)).map(c => Object.assign(c, custStats(c.id)));
  const R = await pdfReport({ title: 'Data Customer Unit', sub: BC + ' · ' + (s.jenis || 'Internal & Eksternal') + ' · per ' + tgl(today(), true), orient: 'l', fname: 'Data_Customer' });
  R.kv([['Jumlah customer', String(rows.length)], ['Repeat order', String(rows.filter(c => c.order > 1).length)], ['Total penjualan', 'Rp ' + R_(sum(rows, 'jual'))], ['Total piutang', 'Rp ' + R_(sum(rows, 'piutang'))]]);
  R.table(['No', 'Customer', 'Jenis', 'PIC', 'Nama KTP', 'NIK', 'NPWP', 'WhatsApp', 'Alamat', 'Order', 'Penjualan', 'Piutang'],
    rows.map((c, i) => [i + 1, c.nama, c.jenis || '-', c.pic || '-', c.ktp || '-', c.nik || '-', c.npwp || '-', waShow(c.wa), c.alamat || '-', cellR(c.order), cellR(R_(c.jual)), cellR(R_(c.piutang))]),
    { fs: 7.2, cs: { 0: { halign: 'center', cellWidth: 8 }, 8: { cellWidth: 44 } } });
  R.sign();
  await R.save();
}

/* =================== 6. JADWAL PENGIRIMAN =================== */
MODS.jadwal = {
  title: 'Jadwal Pengiriman', icon: 'jadwal', desc: 'Proyeksi produksi & pengiriman AMP, CMP, SCP, PCP — mingguan dan bulanan',
  render(root) {
    const st = stateOf('jadwal', { tab: 'minggu', unit: '', q: '', ref: today() });
    st.ref = st.ref || today();
    return page(root, {
      key: 'jadwal', st, report: jadwalReport,
      tabs: [{ k: 'minggu', t: 'Mingguan' }, { k: 'bulan', t: 'Bulanan' }, { k: 'list', t: 'Daftar' }],
      actions: [{ id: 'add', t: 'Tambah Jadwal', pri: true }],
      on: { add: () => jadwalForm() },
      filter: s => periodBar(Object.assign({}, s, { month: undefined }), 'jadwal', '<div class="mon"><button class="ibtn sm" data-jnav="-1" aria-label="Sebelumnya">' + ic('back') + '</button><b class="jlabel">' + esc(jadwalLabel(s)) + '</b><button class="ibtn sm" data-jnav="1" aria-label="Berikutnya">' + ic('right') + '</button><button class="btn ghost sm" data-jnav="0">Hari ini</button></div>'),
      bindFilter: (el, s, redraw) => $$('[data-jnav]', el).forEach(b => b.onclick = () => {
        const n = +b.dataset.jnav;
        if (!n) s.ref = today();
        else if (s.tab === 'bulan' || s.tab === 'list') { const d = new Date(s.ref + 'T00:00:00'); d.setDate(1); d.setMonth(d.getMonth() + n); s.ref = ymd(d); }
        else s.ref = addDays(s.ref, 7 * n);
        redraw();
      }),
      body: s => jadwalHtml(s),
      bind: (el, s) => {
        $$('[data-jid]', el).forEach(x => x.onclick = e => { e.stopPropagation(); jadwalForm(get(x.dataset.jid)); });
        $$('[data-jadd]', el).forEach(x => x.onclick = () => { const [d, u] = x.dataset.jadd.split('|'); jadwalForm(null, { tgl: d, unit: u || s.unit || 'AMP' }); });
        $$('[data-row]', el).forEach(tr => tr.onclick = () => jadwalForm(get(tr.dataset.row)));
      }
    });
  },
  summary() { const w = weekOf(today()); const a = all('jadwal').filter(j => j.tgl >= w[0] && j.tgl <= w[6] && j.status !== 'Batal'); return { main: a.length + ' pengiriman minggu ini', sub: UNITS.map(u => u + ' ' + num(sum(a.filter(j => j.unit === u), 'vol'))).join(' · ') }; }
};
function weekOf(d) { const x = new Date(d + 'T00:00:00'); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return Array.from({ length: 7 }, (_, i) => { const y = new Date(x); y.setDate(x.getDate() + i); return ymd(y); }); }
function jadwalLabel(s) { if (s.tab === 'minggu') { const w = weekOf(s.ref); return tgl(w[0]) + ' – ' + tgl(w[6]); } return monthLabel(s.ref.slice(0, 7)); }
function jadwalRows(s, from, to) { return all('jadwal').filter(j => j.tgl >= from && j.tgl <= to && (!s.unit || j.unit === s.unit) && qMatch(s.q, j.proyek, j.produk, custName(j.cust), j.armada)).sort((a, b) => (a.tgl + (a.jam || '')).localeCompare(b.tgl + (b.jam || ''))); }
const satU = u => ({ AMP: 'Ton', CMP: 'M3', SCP: 'Ton', PCP: 'Pcs' }[u]);
function jadwalHtml(s) {
  const units = s.unit ? [s.unit] : UNITS;
  if (s.tab === 'minggu') {
    const w = weekOf(s.ref), rows = jadwalRows(s, w[0], w[6]);
    const cell = (d, u) => { const a = rows.filter(j => j.tgl === d && j.unit === u); return '<td class="' + (d === today() ? 'today' : '') + '"><div class="jcell">' + a.map(j => '<button class="jitem s-' + esc((j.status || 'Rencana').replace(/\s/g, '')) + '" data-jid="' + j.id + '"><b>' + esc(j.proyek || custName(j.cust)) + '</b><span>' + esc(j.produk) + ' · ' + num(j.vol) + ' ' + esc(j.sat || satU(u)) + (j.jam ? ' · ' + esc(j.jam) : '') + '</span></button>').join('') + '<button class="jadd" data-jadd="' + d + '|' + u + '" aria-label="Tambah jadwal">' + ic('plus') + '</button></div></td>'; };
    return '<section class="card flush"><div class="tbl"><table class="week"><thead><tr><th>Unit</th>' + w.map(d => { const x = new Date(d + 'T00:00:00'); return '<th class="' + (d === today() ? 'today' : '') + '">' + HARI[x.getDay()] + '<small>' + tgl(d) + '</small></th>'; }).join('') + '<th class="n">Total</th></tr></thead><tbody>' +
      units.map(u => '<tr><th class="uh">' + unitChip(u) + '<small>' + UNIT_PROD[u] + '</small></th>' + w.map(d => cell(d, u)).join('') + '<td class="n"><b>' + num(sum(rows.filter(j => j.unit === u && j.status !== 'Batal'), 'vol')) + '</b><small>' + satU(u) + '</small></td></tr>').join('') + '</tbody></table></div></section>' +
      '<div class="legend">' + ['Rencana', 'Terkirim', 'Tunda', 'Batal'].map(x => '<span class="s-' + x + '"><i></i>' + x + '</span>').join('') + '</div>';
  }
  const ym = s.ref.slice(0, 7), [y, m] = ym.split('-').map(Number);
  const first = ym + '-01', last = ymd(new Date(y, m, 0));
  const rows = jadwalRows(s, first, last);
  if (s.tab === 'list') return '<section class="card">' + table([
    { t: 'Tanggal', f: j => tgl(j.tgl) + (j.jam ? ' ' + j.jam : '') }, { t: 'Unit', f: j => unitChip(j.unit), raw: true }, { t: 'Proyek / Customer', f: j => '<b>' + esc(j.proyek) + '</b><small>' + esc(custName(j.cust)) + '</small>', raw: true },
    { t: 'Produk', f: j => j.produk }, { t: 'Volume', f: j => num(j.vol) + ' ' + (j.sat || satU(j.unit)), num: true }, { t: 'Armada', f: j => j.armada || '-' }, { t: 'SO / WO', f: j => (get(j.so) || {}).no || '-' }, { t: 'Status', f: j => stChip(j.status || 'Rencana'), raw: true }
  ], rows, { click: true, empty: 'Belum ada jadwal pada bulan ini.', emptyIcon: 'jadwal' }) + '</section>';
  const start = weekOf(first)[0];
  const cells = [];
  for (let d = start; cells.length < 42; d = addDays(d, 1)) { cells.push(d); if (cells.length % 7 === 0 && d >= last) break; }
  const weeks = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const cal = '<section class="card flush"><div class="cal"><div class="calh">' + ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map(h => '<span>' + h + '</span>').join('') + '</div>' +
    weeks.map(wk => '<div class="calw">' + wk.map(d => { const a = rows.filter(j => j.tgl === d && j.status !== 'Batal'); const out = d.slice(0, 7) !== ym; return '<div class="cald' + (out ? ' out' : '') + (d === today() ? ' today' : '') + '" data-jadd="' + d + '|"><span class="dn">' + Number(d.slice(8)) + '</span>' + units.map(u => { const v = sum(a.filter(j => j.unit === u), 'vol'); return v ? '<span class="cv u-' + u + '">' + u + ' ' + num(v) + '</span>' : ''; }).join('') + '</div>'; }).join('') + '</div>').join('') + '</div></section>';
  const rek = weeks.map((wk, i) => { const a = rows.filter(j => j.tgl >= wk[0] && j.tgl <= wk[6] && j.status !== 'Batal'); const r = { id: 'w' + i, w: 'Minggu ' + (i + 1), range: tgl(wk[0] < first ? first : wk[0]) + ' – ' + tgl(wk[6] > last ? last : wk[6]) }; units.forEach(u => r[u] = sum(a.filter(j => j.unit === u), 'vol')); return r; });
  return cal + '<section class="card"><div class="chead"><h3>Rekap proyeksi per minggu</h3><div class="cmeta">' + monthLabel(ym) + '</div></div>' +
    table([{ t: 'Minggu', f: r => '<b>' + r.w + '</b><small>' + r.range + '</small>', raw: true }].concat(units.map(u => ({ t: u + ' (' + satU(u) + ')', f: r => r[u] ? num(r[u]) : '-', num: true, sum: true, sk: u }))), rek) + '</section>';
}
function jadwalForm(d, pre) {
  const v = d ? Object.assign({}, d) : Object.assign({ tgl: today(), unit: stateOf('jadwal', {}).unit || 'AMP', status: 'Rencana' }, pre || {});
  openForm({
    title: d ? 'Ubah Jadwal Pengiriman' : 'Tambah Jadwal Pengiriman', sub: 'Proyeksi produksi dan pengiriman ke proyek', value: v, onDelete: d ? () => remove(d.id) : null,
    fields: [
      { k: 'tgl', label: 'Tanggal', type: 'date', req: true }, { k: 'jam', label: 'Jam', type: 'time' },
      { k: 'unit', label: 'Unit', type: 'seg', opts: UNITS, onChange: x => { x.so = ''; x.produk = ''; x.sat = satU(x.unit); } },
      { k: 'so', label: 'Dari SO / WO', type: 'select', full: true, empty: '— Tanpa SO (proyeksi) —', opts: x => all('prod').filter(p => p.unit === x.unit && p.status !== 'Batal' && (soStatus(p) !== 'Selesai' || p.id === x.so)).map(p => ({ v: p.id, t: soLabel(p) })), onChange: x => { const p = get(x.so); if (p) Object.assign(x, { cust: p.cust, proyek: p.proyek, produk: p.produk, sat: p.sat, vol: soStats(p).sisaKirim || p.vol }); } },
      { k: 'cust', label: 'Customer', type: 'select', opts: () => custList().map(c => ({ v: c.id, t: c.nama })), add: { label: 'Tambah customer baru…', fn: () => addCustomerDialog('Eksternal') } },
      { k: 'proyek', label: 'Proyek / lokasi', req: true },
      { k: 'produk', label: 'Produk', type: 'select', req: true, opts: x => products(x.unit).map(p => ({ v: p.n, t: p.n })), onChange: x => { const p = productFind(x.unit, x.produk); if (p) x.sat = p.s; } },
      { k: 'vol', label: 'Volume', type: 'num', req: true, suffix: x => x.sat || satU(x.unit) },
      { k: 'armada', label: 'Armada', type: 'list', opts: ['Dump Truck 8 Ton', 'Truck Mixer 6 M3', 'Truk Engkel', 'Trailer', 'Diambil sendiri'] },
      { k: 'status', label: 'Status', type: 'select', opts: ['Rencana', 'Terkirim', 'Tunda', 'Batal'], empty: false },
      { k: 'ket', label: 'Keterangan', type: 'textarea', rows: 2 }
    ],
    onSave: x => { save('jadwal', { tgl: x.tgl, jam: x.jam || '', unit: x.unit, so: x.so || '', cust: x.cust || '', proyek: x.proyek, produk: x.produk, sat: x.sat || satU(x.unit), vol: +x.vol, armada: x.armada || '', status: x.status, ket: x.ket || '' }, d && d.id); toast('Jadwal tersimpan'); }
  });
}
async function jadwalReport(s) {
  const units = s.unit ? [s.unit] : UNITS;
  const isW = s.tab === 'minggu';
  const w = weekOf(s.ref), ym = s.ref.slice(0, 7), [y, m] = ym.split('-').map(Number);
  const from = isW ? w[0] : ym + '-01', to = isW ? w[6] : ymd(new Date(y, m, 0));
  const rows = jadwalRows(s, from, to).filter(j => j.status !== 'Batal');
  const R = await pdfReport({ title: 'Jadwal Pengiriman ' + (isW ? 'Mingguan' : 'Bulanan'), sub: (s.unit ? UNIT_NAME[s.unit] : 'AMP, CMP, SCP, PCP') + ' · ' + (isW ? tgl(from, true) + ' s.d. ' + tgl(to, true) : monthLabel(ym)), orient: 'l', fname: 'Jadwal_Pengiriman' });
  R.kv(units.map(u => [u + ' (' + satU(u) + ')', N_(sum(rows.filter(j => j.unit === u), 'vol')) + ' · ' + rows.filter(j => j.unit === u).length + ' jadwal']), units.length);
  if (!isW) {
    const wk = []; for (let d = weekOf(from)[0]; d <= to; d = addDays(d, 7)) wk.push(weekOf(d));
    R.h2('Rekap Proyeksi per Minggu');
    R.table(['Minggu', 'Periode'].concat(units.map(u => u + ' (' + satU(u) + ')')), wk.map((x, i) => ['Minggu ' + (i + 1), tgl(x[0] < from ? from : x[0]) + ' - ' + tgl(x[6] > to ? to : x[6])].concat(units.map(u => cellR(N_(sum(rows.filter(j => j.unit === u && j.tgl >= x[0] && j.tgl <= x[6]), 'vol')))))),
      { foot: ['Total', ''].concat(units.map(u => cellR(N_(sum(rows.filter(j => j.unit === u), 'vol'))))) });
  }
  R.h2('Rincian Jadwal');
  R.table(['Hari / Tanggal', 'Jam', 'Unit', 'Customer', 'Proyek', 'Produk', 'Volume', 'Armada', 'Status', 'Keterangan'], rows.map(j => [HARI[new Date(j.tgl + 'T00:00:00').getDay()] + ', ' + tgl(j.tgl), j.jam || '-', j.unit, custName(j.cust), j.proyek, j.produk, cellR(N_(j.vol) + ' ' + (j.sat || satU(j.unit))), j.armada || '-', j.status || 'Rencana', j.ket || '-']), { fs: 7.3 });
  R.sign([['Dibuat oleh', S.user.name], ['Kepala Produksi', ''], ['Kepala Basecamp', '']]);
  await R.save();
}
