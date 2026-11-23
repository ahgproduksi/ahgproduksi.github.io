/* Kartu 10 Man Power (gaji terkunci PIN di server), Kartu 11 Marketing, Kartu 12 Pengembang. */
'use strict';

/* =================== 10. MAN POWER =================== */
const GAJI = { map: null, pin: '' };
MODS.mp = {
  title: 'Man Power', icon: 'mp', desc: 'Data pekerja: jabatan, kontak, domisili; gaji terkunci kata sandi',
  leave() { GAJI.map = null; GAJI.pin = ''; },
  render(root) {
    const st = stateOf('mp', { unit: '', q: '', status: 'Aktif' });
    st.umum = true;
    const ctl = page(root, {
      key: 'mp', st, report: mpReport,
      actions: [{ id: 'add', t: 'Tambah Pekerja', pri: true }, { id: 'gaji', t: GAJI.map ? 'Sembunyikan Gaji' : 'Tampilkan Gaji', icon: GAJI.map ? 'lock' : 'eye' }],
      on: { add: () => mpForm(), gaji: async () => { if (GAJI.map) { GAJI.map = null; GAJI.pin = ''; } else if (!await gajiUnlock()) return; MODS.mp.render(root); } },
      filter: s => periodBar(s, 'mp', '<select data-fk="status"><option value="">Semua status</option>' + ['Aktif', 'Nonaktif'].map(x => '<option' + (s.status === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select>'),
      body: s => {
        const rows = mpRows(s);
        const g = GAJI.map;
        return '<div class="kpis">' + kpi('Pekerja aktif', all('mp').filter(m => m.status !== 'Nonaktif').length) + UNITS.concat('Umum').map(u => kpi(u === 'Umum' ? 'Umum / Basecamp' : 'Unit ' + u, all('mp').filter(m => m.status !== 'Nonaktif' && m.unit === u).length)).slice(0, 3).join('') + '</div>' +
          (g ? '<div class="note lock">' + ic('eye') + 'Data gaji sedang ditampilkan. Gaji disembunyikan kembali saat Anda meninggalkan halaman ini. Total gaji pekerja aktif yang ditampilkan: <b>' + rp(sum(rows.filter(m => m.status !== 'Nonaktif'), m => g[m.id] || 0)) + '</b></div>' : '') +
          '<section class="card">' + table([
            { t: 'Nama', f: m => '<b>' + esc(m.nama) + '</b><small>' + esc(m.nik ? 'NIK ' + m.nik : '') + '</small>', raw: true }, { t: 'Jabatan', f: m => m.jabatan || '-' }, { t: 'Unit', f: m => unitChip(m.unit || 'Umum'), raw: true },
            { t: 'WhatsApp / HP', f: m => waShow(m.wa) }, { t: 'Domisili', f: m => m.domisili || '-', cls: 'wrap' }, { t: 'Mulai bekerja', f: m => tgl(m.masuk) },
            { t: 'Gaji / bulan', f: m => g ? '<b>' + (g[m.id] != null ? rp(g[m.id]) : '-') + '</b>' : '<span class="masked">' + ic('lock') + 'Terkunci</span>', num: true, raw: true },
            { t: 'Status', f: m => stChip(m.status || 'Aktif'), raw: true },
            { t: '', f: m => m.wa ? '<a class="ibtn wa" data-wa target="_blank" rel="noopener" title="Chat WhatsApp" href="' + esc(waLink(m.wa)) + '">' + ic('wa') + '</a>' : '', raw: true }
          ], rows, { click: true, empty: 'Belum ada data pekerja.', emptyIcon: 'mp' }) + '</section>';
      },
      bind: el => { $$('[data-row]', el).forEach(tr => tr.onclick = () => mpForm(get(tr.dataset.row))); $$('[data-wa]', el).forEach(a => a.onclick = e => e.stopPropagation()); }
    });
    return ctl;
  },
  summary() { const a = all('mp').filter(m => m.status !== 'Nonaktif'); return { main: a.length + ' pekerja aktif', sub: UNITS.map(u => u + ' ' + a.filter(m => m.unit === u).length).join(' · ') }; }
};
function mpRows(s) { return all('mp').filter(m => (!s.unit || m.unit === s.unit) && (!s.status || (m.status || 'Aktif') === s.status) && qMatch(s.q, m.nama, m.jabatan, m.domisili, m.wa)).sort((a, b) => (UNITS.concat('Umum').indexOf(a.unit) - UNITS.concat('Umum').indexOf(b.unit)) || a.nama.localeCompare(b.nama)); }
function gajiUnlock() {
  return new Promise(res => {
    openForm({
      title: 'Tampilkan Data Gaji', sub: 'Masukkan kata sandi khusus data gaji', small: true, value: {}, saveLabel: 'Buka', onCancel: () => res(false),
      fields: [{ k: 'pin', label: 'Kata sandi gaji', type: 'password', req: true }],
      onSave: async x => {
        try {
          const r = await rpc('bw_gaji_get', { p_token: S.token, p_pin: x.pin });
          if (r.err === 'pin') { toast('Kata sandi gaji salah', 'err'); return false; }
          if (r.err === 'locked') { toast('Terlalu banyak percobaan. Coba lagi 15 menit lagi.', 'err'); return false; }
          if (r.err) { toast('Gagal: ' + r.err, 'err'); return false; }
          GAJI.map = r.gaji || {}; GAJI.pin = x.pin; res(true);
        } catch (e) { toast('Tidak dapat terhubung ke server', 'err'); return false; }
      }
    });
  });
}
function mpForm(d) {
  const v = d ? Object.assign({}, d, { gaji: GAJI.map && GAJI.map[d.id] != null ? GAJI.map[d.id] : '' }) : { status: 'Aktif', unit: stateOf('mp', {}).unit || 'AMP', masuk: today() };
  openForm({
    title: d ? 'Data Pekerja — ' + d.nama : 'Tambah Pekerja', value: v, onDelete: d ? () => { remove(d.id); if (GAJI.pin) rpc('bw_gaji_set', { p_token: S.token, p_pin: GAJI.pin, p_id: d.id, p_gaji: null }); } : null,
    fields: [
      { k: 'nama', label: 'Nama lengkap', req: true }, { k: 'nik', label: 'NIK KTP', type: 'tel', max: 16 },
      { k: 'jabatan', label: 'Jabatan', type: 'list', req: true, opts: ['Kepala Basecamp', 'Kepala Unit', 'Kepala Produksi', 'Operator Plant', 'Operator Alat Berat', 'Mekanik', 'Elektrik', 'Helper', 'Sopir Dump Truck', 'Sopir Truck Mixer', 'Admin Unit', 'Logistik / Gudang', 'Quality Control', 'Security', 'Tukang Precast'] },
      { k: 'unit', label: 'Unit', type: 'select', opts: UNITS.concat('Umum'), empty: false },
      { k: 'wa', label: 'No. WhatsApp / HP', type: 'tel', ph: '08xxxxxxxxxx' }, { k: 'domisili', label: 'Domisili', ph: 'mis. ' + BCN + ', Kab. ...' },
      { k: 'masuk', label: 'Mulai bekerja', type: 'date' }, { k: 'status', label: 'Status', type: 'select', opts: ['Aktif', 'Nonaktif'], empty: false },
      { k: 'gaji', label: 'Gaji per bulan', type: 'money', show: () => !!GAJI.map, help: 'Disimpan terpisah dan hanya dapat dibuka dengan kata sandi gaji' },
      { k: 'gnote', type: 'html', show: () => !GAJI.map, html: () => '<div class="note lock">' + ic('lock') + 'Data gaji terkunci. Gunakan tombol <b>Tampilkan Gaji</b> di halaman Man Power untuk melihat atau mengubah gaji.</div>' },
      { k: 'ket', label: 'Catatan', type: 'textarea', rows: 2 }
    ],
    onSave: async x => {
      const id = save('mp', { nama: x.nama.trim(), nik: x.nik || '', jabatan: x.jabatan, unit: x.unit, wa: x.wa ? waNorm(x.wa) : '', domisili: x.domisili || '', masuk: x.masuk || '', status: x.status, ket: x.ket || '' }, d && d.id);
      if (GAJI.map && x.gaji !== '' && x.gaji != null && GAJI.map[id] !== +x.gaji) {
        try { const r = await rpc('bw_gaji_set', { p_token: S.token, p_pin: GAJI.pin, p_id: id, p_gaji: +x.gaji }); if (r.ok) GAJI.map[id] = +x.gaji; else toast('Gaji tidak tersimpan (' + r.err + ')', 'err'); } catch { toast('Gaji tidak tersimpan, periksa koneksi', 'err'); }
        emit();
      }
      toast('Data ' + x.nama + ' tersimpan');
    }
  });
}
async function mpReport(s) {
  const rows = mpRows(s), g = GAJI.map;
  const R = await pdfReport({ title: 'Data Man Power', sub: (s.unit ? UNIT_NAME[s.unit] : 'Seluruh unit') + ' · ' + (s.status || 'Semua status') + ' · per ' + tgl(today(), true) + (g ? ' · RAHASIA: memuat data gaji' : ''), orient: 'l', fname: 'Data_Man_Power' });
  R.kv(UNITS.concat('Umum').map(u => [u === 'Umum' ? 'Umum' : 'Unit ' + u, String(rows.filter(m => m.unit === u).length) + ' orang']), 5);
  const head = ['No', 'Nama', 'NIK', 'Jabatan', 'Unit', 'WhatsApp / HP', 'Domisili', 'Mulai Bekerja', 'Status'].concat(g ? ['Gaji / Bulan'] : []);
  R.table(head, rows.map((m, i) => [i + 1, m.nama, m.nik || '-', m.jabatan || '-', m.unit, waShow(m.wa), m.domisili || '-', tgl(m.masuk), m.status || 'Aktif'].concat(g ? [cellR(g[m.id] != null ? R_(g[m.id]) : '-')] : [])),
    { fs: 7.6, cs: { 0: { halign: 'center', cellWidth: 8 } }, foot: g ? ['', 'Total', '', '', '', '', '', '', '', cellR(R_(sum(rows, m => g[m.id] || 0)))] : undefined });
  if (!g) R.para('Data gaji tidak dicetak karena terkunci. Buka dengan kata sandi gaji untuk menyertakannya.', 8);
  R.sign([['Dibuat oleh', S.user.name], ['HRD / Personalia', ''], ['Kepala Basecamp', '']]);
  await R.save();
}

/* =================== 11. MARKETING =================== */
const MKT_ST = ['Prospek', 'Penawaran', 'Negosiasi', 'Menang', 'Kalah'];
MODS.mkt = {
  title: 'Marketing', icon: 'mkt', desc: 'Prospek proyek ke depan: customer, produk, volume, dan estimasi omzet',
  render(root) {
    const st = stateOf('mkt', { unit: '', q: '', status: '', tab: 'prospek', month: curMonth(), kat: '' });
    if (!JXON()) st.tab = 'prospek';
    const jxTab = s => JXON() && (s.tab === 'sph' || s.tab === 'analisa');
    return page(root, {
      key: 'mkt', st, report: s => jxTab(s) ? jxMktReport(s) : mktReport(s),
      tabs: JXON() ? [{ k: 'prospek', t: 'Prospek Proyek' }, { k: 'sph', t: 'Penawaran & Order (SPH)' }, { k: 'analisa', t: 'Analisa Bulanan' }] : null,
      actions: [{ id: 'add', t: 'Tambah Prospek', pri: true }],
      on: { add: () => mktForm() },
      filter: s => jxTab(s) ? jxMktFilter(s) : periodBar(Object.assign({}, s, { month: undefined }), 'mkt', '<select data-fk="status"><option value="">Semua status</option>' + MKT_ST.map(x => '<option' + (s.status === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select>'),
      body: s => {
        if (jxTab(s)) return jxMktHtml(s);
        const rows = mktRows(s);
        const open = rows.filter(r => !['Menang', 'Kalah'].includes(r.status));
        return '<div class="kpis">' + kpi('Prospek terbuka', open.length) + kpi('Estimasi omzet', rpS(sum(open, r => r.vol * r.harga)), 'prospek terbuka') + kpi('Omzet tertimbang', rpS(sum(open, r => r.vol * r.harga * (r.peluang || 0) / 100)), 'x peluang') + kpi('Menang', rpS(sum(rows.filter(r => r.status === 'Menang'), r => r.vol * r.harga)), rows.filter(r => r.status === 'Menang').length + ' proyek', 'good') + '</div>' +
          '<div class="pipe">' + MKT_ST.map(x => { const a = rows.filter(r => r.status === x); return '<div class="pp s-' + x + '"><span>' + x + '</span><b>' + a.length + '</b><small>' + rpS(sum(a, r => r.vol * r.harga)) + '</small></div>'; }).join('') + '</div>' +
          '<section class="card">' + table([
            { t: 'Proyek', f: r => '<b>' + esc(r.proyek) + '</b><small>' + esc(custName(r.cust)) + (r.lokasi ? ' · ' + esc(r.lokasi) : '') + '</small>', raw: true }, { t: 'Unit', f: r => unitChip(r.unit), raw: true },
            { t: 'Produk', f: r => r.produk }, { t: 'Volume', f: r => num(r.vol) + ' ' + (r.sat || ''), num: true }, { t: 'Harga est.', f: r => rp(r.harga), num: true },
            { t: 'Estimasi omzet', f: r => '<b>' + rp(r.vol * r.harga) + '</b>', num: true, raw: true }, { t: 'Peluang', f: r => '<div class="mini"><b>' + (r.peluang || 0) + '%</b>' + bar((r.peluang || 0) / 100, 'info') + '</div>', raw: true },
            { t: 'Target', f: r => tgl(r.target) }, { t: 'Status', f: r => stChip(r.status), raw: true }
          ], rows, { click: true, empty: 'Belum ada prospek.', emptyIcon: 'mkt' }) + '</section>';
      },
      bind: (el, s, fill) => jxTab(s) ? jxMktBind(el, s, fill) : $$('[data-row]', el).forEach(tr => tr.onclick = () => mktForm(get(tr.dataset.row)))
    });
  },
  summary() { const a = all('mkt').filter(r => !['Menang', 'Kalah'].includes(r.status)); return { main: rpS(sum(a, r => r.vol * r.harga)) + ' estimasi omzet', sub: a.length + ' prospek terbuka' }; }
};
function mktRows(s) { return all('mkt').filter(r => (!s.unit || r.unit === s.unit) && (!s.status || r.status === s.status) && qMatch(s.q, r.proyek, custName(r.cust), r.produk, r.lokasi, r.pic)).sort((a, b) => MKT_ST.indexOf(a.status) - MKT_ST.indexOf(b.status) || String(a.target || '9').localeCompare(String(b.target || '9'))); }
function mktForm(d) {
  const v = d ? Object.assign({}, d) : { tgl: today(), unit: stateOf('mkt', {}).unit || 'AMP', status: 'Prospek', peluang: 50, pic: S.user.name };
  const priceOf = x => { const c = x.unit && x.produk && hppCalc(x.unit, x.produk); return c ? Math.round(custGet(x.cust) && custGet(x.cust).jenis === 'Internal' ? c.harga.int : c.harga.ext) : 0; };
  openForm({
    title: d ? 'Prospek — ' + d.proyek : 'Tambah Prospek Proyek', value: v, onDelete: d ? () => remove(d.id) : null,
    extraBtn: d && !d.so ? { html: '<button type="button" class="btn ghost" data-toso>' + ic('prod') + 'Jadikan SO / WO</button>', bind: (f, x, m) => { $('[data-toso]', f).onclick = () => { m.close(); const c = custGet(x.cust); soForm(null, { unit: x.unit, jenis: c && c.jenis === 'Internal' ? 'internal' : 'eksternal', cust: x.cust, proyek: x.proyek, produk: x.produk, vol: x.vol, harga: x.harga, mkt: d.id, prodNow: false }); }; } } : null,
    fields: [
      { k: 'tgl', label: 'Tanggal', type: 'date', req: true }, { k: 'target', label: 'Target mulai / closing', type: 'date' },
      { k: 'cust', label: 'Customer / calon customer', type: 'select', req: true, full: true, opts: () => custList().map(c => ({ v: c.id, t: c.nama })), add: { label: 'Tambah customer baru…', fn: () => addCustomerDialog('Eksternal') }, onChange: x => { if (x.produk) x.harga = priceOf(x); } },
      { k: 'proyek', label: 'Nama proyek', req: true }, { k: 'lokasi', label: 'Lokasi' },
      { k: 'unit', label: 'Unit', type: 'seg', opts: UNITS, onChange: x => { x.produk = ''; x.harga = ''; } },
      { k: 'produk', label: 'Produk', type: 'select', req: true, opts: x => products(x.unit).map(p => ({ v: p.n, t: p.n })), onChange: x => { const p = productFind(x.unit, x.produk); x.sat = p ? p.s : ''; x.harga = priceOf(x); } },
      { k: 'vol', label: 'Volume', type: 'num', req: true, suffix: x => x.sat || satU(x.unit) },
      { k: 'harga', label: 'Harga estimasi / satuan', type: 'money', req: true },
      { k: 'omzet', type: 'html', html: x => '<div class="note">Estimasi omzet: <b>' + rp((+x.vol || 0) * (+x.harga || 0)) + '</b> · tertimbang ' + rp((+x.vol || 0) * (+x.harga || 0) * (+x.peluang || 0) / 100) + '</div>' },
      { k: 'peluang', label: 'Peluang', type: 'select', opts: [10, 25, 50, 75, 90, 100].map(p => ({ v: p, t: p + '%' })), empty: false },
      { k: 'status', label: 'Status', type: 'select', opts: MKT_ST, empty: false },
      { k: 'pic', label: 'PIC marketing' },
      { k: 'ket', label: 'Catatan follow up', type: 'textarea', rows: 2 }
    ],
    onSave: x => { save('mkt', { tgl: x.tgl, target: x.target || '', cust: x.cust, proyek: x.proyek, lokasi: x.lokasi || '', unit: x.unit, produk: x.produk, sat: x.sat || satU(x.unit), vol: +x.vol, harga: +x.harga, peluang: +x.peluang || 0, status: x.status, pic: x.pic || '', ket: x.ket || '', so: (d && d.so) || '' }, d && d.id); toast('Prospek tersimpan'); }
  });
}
async function mktReport(s) {
  const rows = mktRows(s), open = rows.filter(r => !['Menang', 'Kalah'].includes(r.status));
  const R = await pdfReport({ title: 'Laporan Prospek Marketing', sub: (s.unit ? UNIT_NAME[s.unit] : 'Seluruh unit') + ' · ' + (s.status || 'Semua status') + ' · per ' + tgl(today(), true), orient: 'l', fname: 'Laporan_Marketing' });
  R.kv([['Prospek terbuka', String(open.length)], ['Estimasi omzet', 'Rp ' + R_(sum(open, r => r.vol * r.harga))], ['Omzet tertimbang', 'Rp ' + R_(sum(open, r => r.vol * r.harga * (r.peluang || 0) / 100))], ['Menang', 'Rp ' + R_(sum(rows.filter(r => r.status === 'Menang'), r => r.vol * r.harga))]]);
  R.h2('Rekap per Unit');
  R.table(['Unit', 'Prospek', 'Volume', 'Estimasi Omzet', 'Tertimbang'], UNITS.map(u => { const a = open.filter(r => r.unit === u); return [u + ' - ' + UNIT_NAME[u], cellR(String(a.length)), cellR(N_(sum(a, 'vol')) + ' ' + satU(u)), cellR(R_(sum(a, r => r.vol * r.harga))), cellR(R_(sum(a, r => r.vol * r.harga * (r.peluang || 0) / 100)))]; }));
  R.h2('Daftar Prospek');
  R.table(['Tanggal', 'Customer', 'Proyek', 'Lokasi', 'Unit', 'Produk', 'Volume', 'Harga Est.', 'Omzet', 'Peluang', 'Target', 'Status', 'PIC'], rows.map(r => [tgl(r.tgl), custName(r.cust), r.proyek, r.lokasi || '-', r.unit, r.produk, cellR(N_(r.vol) + ' ' + (r.sat || '')), cellR(R_(r.harga)), cellR(R_(r.vol * r.harga)), cellR((r.peluang || 0) + '%'), tgl(r.target), r.status, r.pic || '-']), { fs: 7 });
  R.sign([['Dibuat oleh', S.user.name], ['Manajer Marketing', ''], ['Kepala Basecamp', '']]);
  await R.save();
}

/* =================== 12. PENGEMBANG =================== */
const DEV_ST = ['Usulan', 'Disetujui', 'Berjalan', 'Selesai', 'Ditunda'];
const DEV_IDE = ['Kanopi atap stockpile material', 'Ruang penampungan limbah sementara (TPS B3)', 'Instalasi Pengolahan Air Limbah (IPAL)', 'Saluran drainase basecamp', 'Jembatan timbang', 'Gudang material & sparepart', 'Perkerasan jalan internal basecamp', 'Mess karyawan', 'Pagar keliling basecamp', 'Penyiraman debu (water sprinkler) area SCP', 'Instalasi CCTV basecamp', 'Bak pengendap air cucian truck mixer', 'Laboratorium uji material', 'Kantor & ruang rapat basecamp'];
MODS.dev = {
  title: 'Pengembangan Basecamp', icon: 'dev', desc: 'Target pengembangan ' + BC + ': estimasi biaya, durasi, dan progres',
  render(root) {
    const st = stateOf('dev', { q: '', status: '', unit: '' });
    st.umum = true;
    return page(root, {
      key: 'dev', st, report: devReport,
      actions: [{ id: 'add', t: 'Tambah Target', pri: true }],
      on: { add: () => devForm() },
      filter: s => periodBar(s, 'dev', '<select data-fk="status"><option value="">Semua status</option>' + DEV_ST.map(x => '<option' + (s.status === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select>'),
      body: s => {
        const rows = devRows(s);
        return '<div class="kpis">' + kpi('Target pengembangan', rows.length) + kpi('Total estimasi biaya', rpS(sum(rows, 'biaya'))) + kpi('Total durasi', num(sum(rows, 'durasi')) + ' hari', 'jika dikerjakan berurutan') + kpi('Rata-rata progres', nf0.format(rows.length ? sum(rows, 'progress') / rows.length : 0) + '%', rows.filter(r => r.status === 'Selesai').length + ' selesai', 'good') + '</div>' +
          '<section class="card">' + table([
            { t: 'Program pengembangan', f: r => '<b>' + esc(r.judul) + '</b><small>' + esc([r.kat, r.lokasi].filter(Boolean).join(' · ')) + '</small>', raw: true }, { t: 'Unit', f: r => unitChip(r.unit || 'Umum'), raw: true },
            { t: 'Estimasi biaya', f: r => rp(r.biaya), num: true }, { t: 'Durasi', f: r => r.durasi ? num(r.durasi) + ' hari' : '-', num: true },
            { t: 'Jadwal', f: r => r.mulai ? tgl(r.mulai) + ' – ' + tgl(addDays(r.mulai, Math.max(0, Math.ceil(+r.durasi || 0) - 1))) : '-' },
            { t: 'Prioritas', f: r => stChip(r.prioritas || 'Sedang'), raw: true }, { t: 'Progres', f: r => '<div class="mini"><b>' + (r.progress || 0) + '%</b>' + bar((r.progress || 0) / 100, 'ok') + '</div>', raw: true },
            { t: 'Status', f: r => stChip(r.status || 'Usulan'), raw: true }
          ], rows, { click: true, empty: 'Belum ada target pengembangan. Contoh: kanopi atap stockpile, ruang limbah sementara, IPAL.', emptyIcon: 'dev' }) + '</section>';
      },
      bind: el => $$('[data-row]', el).forEach(tr => tr.onclick = () => devForm(get(tr.dataset.row)))
    });
  },
  summary() { const a = all('dev').filter(r => r.status !== 'Selesai'); return { main: a.length + ' target berjalan/usulan', sub: 'Estimasi ' + rpS(sum(a, 'biaya')) }; }
};
function devRows(s) { const pr = { Tinggi: 0, Sedang: 1, Rendah: 2 }; return all('dev').filter(r => (!s.unit || r.unit === s.unit) && (!s.status || r.status === s.status) && qMatch(s.q, r.judul, r.kat, r.lokasi, r.pic)).sort((a, b) => DEV_ST.indexOf(a.status) - DEV_ST.indexOf(b.status) || (pr[a.prioritas] ?? 1) - (pr[b.prioritas] ?? 1)); }
function devForm(d) {
  const v = d ? JSON.parse(JSON.stringify(d)) : { status: 'Usulan', prioritas: 'Sedang', unit: 'Umum', progress: 0, rab: [] };
  const rabTot = x => sum(x.rab || [], r => (+r.vol || 0) * (+r.harga || 0));
  openForm({
    title: d ? d.judul : 'Tambah Target Pengembangan', sub: 'Estimasi biaya dapat dirinci per item pekerjaan (opsional)', wide: true, value: v, onDelete: d ? () => remove(d.id) : null,
    fields: [
      { k: 'judul', label: 'Program / pekerjaan', type: 'list', req: true, full: true, opts: DEV_IDE },
      { k: 'kat', label: 'Kategori', type: 'select', opts: ['Infrastruktur', 'Lingkungan & K3', 'Fasilitas Produksi', 'Fasilitas Karyawan', 'Peralatan', 'Legalitas & Perizinan'], empty: false, def: 'Infrastruktur' },
      { k: 'unit', label: 'Unit / area', type: 'select', opts: UNITS.concat('Umum'), empty: false }, { k: 'lokasi', label: 'Lokasi detail', ph: 'mis. area stockpile SCP' },
      { k: 'rab', label: 'Rincian estimasi biaya (opsional)', type: 'items', newRow: () => ({ sat: 'LS', vol: 1 }), cols: [{ k: 'uraian', label: 'Uraian pekerjaan', w: '42%' }, { k: 'vol', label: 'Volume', num: true }, { k: 'sat', label: 'Satuan', type: 'select', opts: SATUAN.concat(['M2', 'Titik']) }, { k: 'harga', label: 'Harga satuan', num: true }, { k: 'jml', label: 'Jumlah', type: 'ro', f: r => rp((+r.vol || 0) * (+r.harga || 0)) }] },
      { k: 'biaya', label: 'Estimasi biaya total', type: 'money', req: true, help: x => rabTot(x) ? 'Total rincian: ' + rp(rabTot(x)) + ' (kosongkan untuk memakai total rincian)' : '' },
      { k: 'durasi', label: 'Estimasi durasi', type: 'num', suffix: 'hari', req: true }, { k: 'mulai', label: 'Rencana mulai', type: 'date' },
      { k: 'prioritas', label: 'Prioritas', type: 'select', opts: ['Tinggi', 'Sedang', 'Rendah'], empty: false },
      { k: 'status', label: 'Status', type: 'select', opts: DEV_ST, empty: false, onChange: x => { if (x.status === 'Selesai') x.progress = 100; } },
      { k: 'progress', label: 'Progres', type: 'num', suffix: '%' }, { k: 'pic', label: 'PIC' },
      { k: 'ket', label: 'Tujuan / manfaat / catatan', type: 'textarea', rows: 2 }
    ].map(f => f.k === 'biaya' ? Object.assign(f, { req: false }) : f),
    onSave: x => {
      const rab = (x.rab || []).filter(r => r.uraian).map(r => ({ uraian: r.uraian, vol: +r.vol || 0, sat: r.sat || '', harga: +r.harga || 0 }));
      const biaya = +x.biaya || rabTot({ rab });
      if (!biaya) { toast('Isi estimasi biaya', 'err'); return false; }
      save('dev', { judul: x.judul, kat: x.kat, unit: x.unit, lokasi: x.lokasi || '', rab, biaya, durasi: +x.durasi || 0, mulai: x.mulai || '', prioritas: x.prioritas, status: x.status, progress: Math.max(0, Math.min(100, +x.progress || 0)), pic: x.pic || '', ket: x.ket || '' }, d && d.id);
      toast('Target pengembangan tersimpan');
    }
  });
}
async function devReport(s) {
  const rows = devRows(s);
  const R = await pdfReport({ title: 'Rencana Pengembangan ' + BC, sub: (s.status || 'Semua status') + ' · per ' + tgl(today(), true), orient: 'l', fname: 'Rencana_Pengembangan' });
  R.kv([['Jumlah program', String(rows.length)], ['Total estimasi biaya', 'Rp ' + R_(sum(rows, 'biaya'))], ['Total durasi', N_(sum(rows, 'durasi')) + ' hari'], ['Rata-rata progres', nf0.format(rows.length ? sum(rows, 'progress') / rows.length : 0) + '%']]);
  R.h2('Daftar Target Pengembangan');
  R.table(['No', 'Program', 'Kategori', 'Unit / Lokasi', 'Estimasi Biaya', 'Durasi', 'Rencana Mulai', 'Target Selesai', 'Prioritas', 'Progres', 'Status', 'PIC'], rows.map((r, i) => [i + 1, r.judul, r.kat || '-', [r.unit, r.lokasi].filter(Boolean).join(' - '), cellR(R_(r.biaya)), cellR(N_(r.durasi) + ' hari'), tgl(r.mulai), r.mulai ? tgl(addDays(r.mulai, Math.max(0, Math.ceil(+r.durasi || 0) - 1))) : '-', r.prioritas || '-', cellR((r.progress || 0) + '%'), r.status, r.pic || '-']),
    { fs: 7.4, cs: { 0: { halign: 'center', cellWidth: 8 } }, foot: ['', 'Total', '', '', cellR(R_(sum(rows, 'biaya'))), cellR(N_(sum(rows, 'durasi')) + ' hari'), '', '', '', '', '', ''] });
  rows.filter(r => (r.rab || []).length).forEach(r => {
    R.h2('Rincian Biaya: ' + r.judul);
    R.table(['No', 'Uraian Pekerjaan', 'Volume', 'Satuan', 'Harga Satuan', 'Jumlah'], r.rab.map((x, i) => [i + 1, x.uraian, cellR(N_(x.vol)), x.sat, cellR(R_(x.harga)), cellR(R_(x.vol * x.harga))]), { cs: { 0: { halign: 'center', cellWidth: 8 } }, foot: ['', 'Total', '', '', '', cellR(R_(sum(r.rab, x => x.vol * x.harga)))] });
    if (r.ket) R.para('Catatan: ' + r.ket);
  });
  R.sign([['Dibuat oleh', S.user.name], ['Kepala Basecamp', ''], ['Direktur', '']]);
  await R.save();
}
