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
/* hari kerja = Senin–Sabtu; Minggu dan libur nasional bertanggal tetap tidak dihitung */
const DEV_LIBUR = ['01-01', '05-01', '06-01', '08-17', '12-25'];
const devLibur = s => new Date(s + 'T00:00:00').getDay() === 0 || DEV_LIBUR.includes(s.slice(5));
function devHari(r, n) { // tanggal hari ke-n (hari ke-1 = rencana mulai)
  if (!r.mulai || !(n > 0)) return '';
  if (!r.hk) return addDays(r.mulai, n - 1);
  let d = r.mulai, g = 0;
  while (devLibur(d) && g++ < 30) d = addDays(d, 1);
  for (let k = 1; k < n && g < 3000; g++) { d = addDays(d, 1); if (!devLibur(d)) k++; }
  return d;
}
const devEnd = r => r.mulai ? devHari(r, Math.max(1, Math.ceil(+r.durasi || 0))) : '';
const devDur = r => r.durasi ? num(r.durasi) + (r.hk ? ' hari kerja' : ' hari') : '-';
const devRabJml = x => (+x.vol || 0) * (+x.harga || 0);
/* time schedule: kegiatan + hari ke- + nomor item RAB → bobot (dari biaya item), progres rencana kumulatif, realisasi */
function devTS(r) {
  const rab = r.rab || [];
  const L = (r.jadwal || []).filter(j => j.kegiatan).map(j => {
    const days = jdParse(j.hari), it = jdParse(j.item).filter(n => n <= rab.length);
    return Object.assign({}, j, { days, it, biaya: sum(it, n => devRabJml(rab[n - 1])) });
  });
  if (!L.length) return null;
  const byBiaya = L.some(j => j.biaya > 0), W = byBiaya ? sum(L, 'biaya') : sum(L, j => j.days.length);
  L.forEach(j => j.bobot = W ? (byBiaya ? j.biaya : j.days.length) / W : 0);
  const N = Math.max(1, Math.ceil(+r.durasi || 0), ...L.map(j => j.days.length ? j.days[j.days.length - 1] : 0));
  const prog = []; let c = 0;
  for (let i = 1; i <= N; i++) { L.forEach(j => { if (j.days.includes(i)) c += j.bobot / j.days.length; }); prog.push(Math.min(1, c)); }
  const real = sum(L, j => j.bobot * Math.max(0, Math.min(100, +j.real || 0)) / 100);
  return { rows: L, N, prog, real, byBiaya, dates: Array.from({ length: N }, (_, i) => devHari(r, i + 1)) };
}
function devWeeks(dates) { // kelompok kolom per minggu kalender (Senin–Minggu)
  const g = [];
  dates.forEach(d => { const m = addDays(d, -((new Date(d + 'T00:00:00').getDay() + 6) % 7)); if (g.length && g[g.length - 1].m === m) g[g.length - 1].n++; else g.push({ m, n: 1 }); });
  return g;
}
function devTSNote(r, J) {
  return (r.mulai ? 'Hari ke-1 = <b>' + tgl(r.mulai) + '</b> · target selesai <b>' + tgl(J.dates[J.N - 1]) + '</b>' : 'Rencana mulai belum ditentukan') + ' · ' + J.N + (r.hk ? ' hari kerja (Senin–Sabtu; Minggu & libur nasional tidak dihitung)' : ' hari') +
    ' · bobot ' + (J.byBiaya ? 'dari biaya item RAB' : 'dari durasi kegiatan') + ' · Realisasi <b>' + jdPct(J.real) + '</b>';
}
function devTSHtml(r) {
  const J = devTS(r), inv = (r.inv || []).filter(x => x.uraian);
  if (!J && !inv.length && !(r.rab || []).length) return '';
  let h = '<section class="card"><div class="chead"><div>' + unitChip(r.unit || 'Umum') + '<h3>' + esc(r.judul) + '</h3></div><div class="cmeta">' + rp(r.biaya) + ' · ' + devDur(r) + ' · ' + (r.rab || []).length + ' item</div></div>';
  if (J) {
    const days = J.dates.map((d, i) => i + 1);
    const wk = r.mulai ? '<tr><th colspan="4"></th>' + devWeeks(J.dates).map((x, k) => '<th class="gw" colspan="' + x.n + '">Minggu ' + (k + 1) + '</th>').join('') + '<th></th></tr>' : '';
    const head = '<thead>' + wk + '<tr><th class="c">No</th><th>Kegiatan</th><th class="n">Biaya</th><th class="n">Bobot</th>' + days.map((i, k) => '<th class="gh">' + i + (r.mulai ? '<small>' + jdDm(J.dates[k]) + '</small>' : '') + '</th>').join('') + '<th class="n">Realisasi</th></tr></thead>';
    const body = J.rows.map((j, ri) => {
      const d = new Set(j.days);
      return '<tr' + (+j.real >= 100 ? ' class="done"' : '') + '><td class="c">' + (ri + 1) + '</td><td class="wrap strong">' + esc(j.kegiatan) + '<small>' + esc(['Hari ke-' + (jdText(j.days) || '-'), j.it.length ? 'item RAB no. ' + jdText(j.it) : '', j.pic].filter(Boolean).join(' · ')) + '</small></td>' +
        '<td class="n">' + (j.biaya ? rpS(j.biaya) : '-') + '</td><td class="n">' + (j.bobot ? nf2.format(j.bobot * 100) + '%' : '-') + '</td>' +
        days.map(i => d.has(i) ? '<td class="gd"></td>' : '<td class="g0"></td>').join('') + '<td class="n">' + (+j.real || 0) + '%</td></tr>';
    }).join('');
    const foot = '<tfoot><tr><td></td><td colspan="3">Progres rencana kumulatif</td>' + J.prog.map(v => '<td class="gp">' + jdPct(v) + '</td>').join('') + '<td class="n">' + jdPct(J.real) + '</td></tr></tfoot>';
    h += '<h4 class="sub">Time schedule pelaksanaan</h4><div class="note">' + devTSNote(r, J) + '</div><div class="tbl gantt devts"><table>' + head + '<tbody>' + body + '</tbody>' + foot + '</table></div>' + jdCurve(J);
  }
  if ((r.rab || []).length) h += '<details class="devrab"><summary>Rincian estimasi biaya · ' + r.rab.length + ' item · ' + rp(sum(r.rab, devRabJml)) + '</summary>' +
    table([{ t: 'No', f: x => x.no, cls: 'c' }, { t: 'Uraian barang / pekerjaan', f: x => x.uraian, cls: 'strong' }, { t: 'Qty', f: x => num(x.vol) + ' ' + (x.sat || ''), num: true }, { t: 'Harga satuan', f: x => rp(x.harga), num: true }, { t: 'Total', f: x => rp(devRabJml(x)), num: true }], r.rab.map((x, i) => Object.assign({ no: i + 1, id: r.id + ':' + i }, x))) + '</details>';
  if (inv.length) h += '<h4 class="sub">Inventarisasi ' + esc(r.unit && r.unit !== 'Umum' ? r.unit + ' - ' : '') + esc(BC) + '</h4>' +
    table([{ t: 'No', f: x => x.no, cls: 'c' }, { t: 'Uraian barang', f: x => x.uraian, cls: 'strong' }, { t: 'Qty', f: x => num(x.qty) + ' ' + (x.sat || ''), num: true }, { t: 'Keterangan', f: x => x.ket || '-', cls: 'muted' }], inv.map((x, i) => Object.assign({ no: i + 1, id: r.id + ':i' + i }, x)));
  return h + '<div class="cfoot"><button class="btn ghost sm" data-dev="' + esc(r.id) + '">' + ic('edit') + 'Ubah data & jadwal</button></div></section>';
}
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
            { t: 'Estimasi biaya', f: r => rp(r.biaya), num: true }, { t: 'Durasi', f: r => devDur(r), num: true },
            { t: 'Jadwal', f: r => r.mulai ? tgl(r.mulai) + ' – ' + tgl(devEnd(r)) : '-' },
            { t: 'Prioritas', f: r => stChip(r.prioritas || 'Sedang'), raw: true }, { t: 'Progres', f: r => '<div class="mini"><b>' + (r.progress || 0) + '%</b>' + bar((r.progress || 0) / 100, 'ok') + '</div>', raw: true },
            { t: 'Status', f: r => stChip(r.status || 'Usulan'), raw: true }
          ], rows, { click: true, empty: 'Belum ada target pengembangan. Contoh: kanopi atap stockpile, ruang limbah sementara, IPAL.', emptyIcon: 'dev' }) + '</section>' +
          rows.map(devTSHtml).join('');
      },
      bind: el => { $$('[data-row]', el).forEach(tr => tr.onclick = () => devForm(get(tr.dataset.row))); $$('[data-dev]', el).forEach(b => b.onclick = () => devForm(get(b.dataset.dev))); }
    });
  },
  summary() { const a = all('dev').filter(r => r.status !== 'Selesai'); return { main: a.length + ' target berjalan/usulan', sub: 'Estimasi ' + rpS(sum(a, 'biaya')) }; }
};
function devRows(s) { const pr = { Tinggi: 0, Sedang: 1, Rendah: 2 }; return all('dev').filter(r => (!s.unit || r.unit === s.unit) && (!s.status || r.status === s.status) && qMatch(s.q, r.judul, r.kat, r.lokasi, r.pic)).sort((a, b) => DEV_ST.indexOf(a.status) - DEV_ST.indexOf(b.status) || (pr[a.prioritas] ?? 1) - (pr[b.prioritas] ?? 1)); }
function devForm(d) {
  const v = d ? JSON.parse(JSON.stringify(d)) : { status: 'Usulan', prioritas: 'Sedang', unit: 'Umum', progress: 0, rab: [], jadwal: [], inv: [], hk: true };
  const rabTot = x => sum(x.rab || [], devRabJml);
  openForm({
    title: d ? d.judul : 'Tambah Target Pengembangan', sub: 'Estimasi biaya dapat dirinci per item pekerjaan; time schedule per kegiatan (opsional)', wide: true, value: v, onDelete: d ? () => remove(d.id) : null,
    fields: [
      { k: 'judul', label: 'Program / pekerjaan', type: 'list', req: true, full: true, opts: DEV_IDE },
      { k: 'kat', label: 'Kategori', type: 'select', opts: ['Infrastruktur', 'Lingkungan & K3', 'Fasilitas Produksi', 'Fasilitas Karyawan', 'Peralatan', 'Legalitas & Perizinan'], empty: false, def: 'Infrastruktur' },
      { k: 'unit', label: 'Unit / area', type: 'select', opts: UNITS.concat('Umum'), empty: false }, { k: 'lokasi', label: 'Lokasi detail', ph: 'mis. area stockpile SCP' },
      { k: 'rab', label: 'Rincian estimasi biaya (opsional)', type: 'items', newRow: () => ({ sat: 'LS', vol: 1 }), cols: [{ k: 'uraian', label: 'Uraian pekerjaan', w: '42%' }, { k: 'vol', label: 'Volume', num: true }, { k: 'sat', label: 'Satuan', type: 'select', opts: SATUAN.concat(['M2', 'Titik', 'Tbg', 'Buah']) }, { k: 'harga', label: 'Harga satuan', num: true }, { k: 'jml', label: 'Jumlah', type: 'ro', f: r => rp(devRabJml(r)) }] },
      { k: 'biaya', label: 'Estimasi biaya total', type: 'money', help: x => rabTot(x) ? 'Total rincian: ' + rp(rabTot(x)) + ' (kosongkan untuk memakai total rincian)' : '' },
      { k: 'durasi', label: 'Estimasi durasi', type: 'num', suffix: 'hari', req: true }, { k: 'mulai', label: 'Rencana mulai', type: 'date' },
      { k: 'hk', type: 'check', full: true, text: 'Durasi & jadwal dalam hari kerja (Senin–Sabtu; Minggu dan libur nasional tidak dihitung)' },
      { k: 'jadwal', label: 'Time schedule kegiatan (opsional)', type: 'items', newRow: () => ({ real: 0 }), cols: [{ k: 'kegiatan', label: 'Kegiatan', w: '36%' }, { k: 'hari', label: 'Hari ke-', ph: 'mis. 1-5' }, { k: 'item', label: 'Item RAB no.', ph: 'mis. 4-6, 14' }, { k: 'pic', label: 'PIC / tenaga' }, { k: 'real', label: 'Realisasi %', num: true }] },
      { k: 'prioritas', label: 'Prioritas', type: 'select', opts: ['Tinggi', 'Sedang', 'Rendah'], empty: false },
      { k: 'status', label: 'Status', type: 'select', opts: DEV_ST, empty: false, onChange: x => { if (x.status === 'Selesai') x.progress = 100; } },
      { k: 'progress', label: 'Progres', type: 'num', suffix: '%', help: x => (x.jadwal || []).some(j => j.kegiatan) ? 'Dihitung otomatis dari realisasi time schedule' : '' }, { k: 'pic', label: 'PIC' },
      { k: 'inv', label: 'Inventarisasi alat / aset terkait (opsional)', type: 'items', newRow: () => ({ qty: 1, sat: 'Bh' }), cols: [{ k: 'uraian', label: 'Uraian barang', w: '46%' }, { k: 'qty', label: 'Qty', num: true }, { k: 'sat', label: 'Satuan', type: 'list', opts: SATUAN }, { k: 'ket', label: 'Keterangan' }] },
      { k: 'ket', label: 'Tujuan / manfaat / catatan', type: 'textarea', rows: 2 }
    ],
    onSave: x => {
      const rab = (x.rab || []).filter(r => r.uraian).map(r => ({ uraian: r.uraian, vol: +r.vol || 0, sat: r.sat || '', harga: +r.harga || 0 }));
      const jadwal = (x.jadwal || []).filter(j => j.kegiatan).map(j => ({ kegiatan: j.kegiatan, hari: jdText(jdParse(j.hari)), item: jdText(jdParse(j.item)), pic: j.pic || '', real: Math.max(0, Math.min(100, +j.real || 0)) }));
      const inv = (x.inv || []).filter(i => i.uraian).map(i => ({ uraian: i.uraian, qty: +i.qty || 0, sat: i.sat || '', ket: i.ket || '' }));
      const biaya = +x.biaya || rabTot({ rab });
      if (!biaya) { toast('Isi estimasi biaya', 'err'); return false; }
      const J = devTS({ rab, jadwal, durasi: +x.durasi || 0 });
      const progress = x.status === 'Selesai' ? 100 : J ? Math.round(J.real * 100) : Math.max(0, Math.min(100, +x.progress || 0));
      save('dev', { judul: x.judul, kat: x.kat, unit: x.unit, lokasi: x.lokasi || '', rab, biaya, durasi: +x.durasi || 0, mulai: x.mulai || '', hk: !!x.hk, jadwal, inv, prioritas: x.prioritas, status: x.status, progress, pic: x.pic || '', ket: x.ket || '' }, d && d.id);
      toast('Target pengembangan tersimpan');
    }
  });
}
function devTSPdf(R, r) {
  const J = devTS(r); if (!J) return;
  const doc = R.doc, M = R.M, W = R.W, N = J.N, BAR = [96, 128, 170], BAR2 = [176, 194, 218];
  // kolom: per hari bila ≤ 35 hari, lebih dari itu per minggu (kolom harian terlalu sempit untuk dibaca)
  const wk = N > 35, C = [];
  if (!wk) for (let i = 0; i < N; i++) C.push({ a: i, b: i, lab: (i + 1) + (r.mulai ? '\n' + jdDm(J.dates[i]) : '') });
  else if (r.mulai) { let a = 0; devWeeks(J.dates).forEach((g, k) => { C.push({ a, b: a + g.n - 1, lab: 'M' + (k + 1) + '\n' + jdDm(J.dates[a]) }); a += g.n; }); }
  else for (let a = 0, k = 0; a < N; a += 6, k++) C.push({ a, b: Math.min(N, a + 6) - 1, lab: 'M' + (k + 1) });
  const K = C.length, wNo = 7, wKeg = 64, wBob = 13, wReal = 14, wd = Math.min(wk ? 15 : 9.5, (W - 2 * M - wNo - wKeg - wBob - wReal) / K);
  R.h2('Time Schedule: ' + r.judul, (r.mulai ? tgl(r.mulai, true) + ' s/d ' + tgl(J.dates[N - 1], true) : '') + ' - ' + N + (r.hk ? ' hari kerja' : ' hari'));
  R.para('Hari ke-1 = ' + (r.mulai ? tgl(r.mulai, true) : 'belum ditentukan') + '. ' + (r.hk ? 'Hari kerja Senin-Sabtu; Minggu dan libur nasional tidak dihitung. ' : '') + 'Bobot kegiatan ' + (J.byBiaya ? 'dihitung dari biaya item RAB terkait' : 'dihitung dari durasi kegiatan') + '. Realisasi ' + jdPct(J.real) + '.' +
    (wk ? ' Kolom per minggu (M1 = minggu ke-1, tanggal = hari kerja pertama minggu itu); warna penuh = kegiatan berjalan sepanjang minggu, warna muda = sebagian minggu; progres = kumulatif akhir minggu.' : ''), 8);
  const cs = { 0: { cellWidth: wNo, halign: 'center' }, 1: { cellWidth: wKeg }, 2: { cellWidth: wBob, halign: 'right' } };
  for (let i = 0; i < K; i++) cs[i + 3] = { cellWidth: wd, halign: 'center', cellPadding: 0.3 };
  cs[K + 3] = { cellWidth: wReal, halign: 'right' };
  const body = J.rows.map((j, ri) => {
    const d = new Set(j.days);
    return [String(ri + 1), j.kegiatan + (j.it.length ? '\n(item ' + jdText(j.it) + ')' : '') + (wk ? '\nHari ke-' + jdText(j.days) : ''), j.bobot ? nf2.format(j.bobot * 100) + '%' : '-'].concat(C.map(c => {
      let n = 0; for (let i = c.a; i <= c.b; i++) if (d.has(i + 1)) n++;
      return n ? { content: wk && n < c.b - c.a + 1 ? String(n) : '', styles: { fillColor: n === c.b - c.a + 1 ? BAR : BAR2, textColor: NAVY, fontSize: 5.4 } } : '';
    })).concat([(+j.real || 0) + '%']);
  });
  const head = ['No', 'Kegiatan', 'Bobot'].concat(C.map(c => c.lab)).concat(['Real.']);
  R.table(head, body, { fs: 6.4, cs, foot: ['', 'Progres rencana kumulatif (%)', ''].concat(C.map(c => ({ content: String(Math.round(J.prog[c.b] * 100)), styles: { halign: 'center', fontSize: wk ? 6 : 5.2 } }))).concat([jdPct(J.real)]),
    didParseCell: c => { if (c.column.index >= 3 && c.column.index < K + 3) { c.cell.styles.cellPadding = 0.3; c.cell.styles.halign = 'center'; if (c.section === 'head') c.cell.styles.fontSize = wk ? 6 : 5.2; } } });
  // kurva S rencana sejajar kolom (titik = progres kumulatif di akhir kolom)
  const x0 = M + wNo + wKeg + wBob, ch = 38;
  R.need(ch + 12);
  const yb = R.y + ch, X = i => x0 + (i + 0.5) * wd, Y = v => yb - v * (ch - 4), P = C.map(c => J.prog[c.b]);
  doc.setDrawColor(...LINE); doc.setLineWidth(0.15); doc.setFontSize(6); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal');
  [0, 0.5, 1].forEach(v => { doc.line(x0, Y(v), x0 + K * wd, Y(v)); doc.text(Math.round(v * 100) + '%', x0 - 1.5, Y(v) + 1, { align: 'right' }); });
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5);
  let px = x0, py = Y(0);
  P.forEach((v, i) => { doc.line(px, py, X(i), Y(v)); px = X(i); py = Y(v); });
  doc.setFillColor(...NAVY); P.forEach((v, i) => doc.circle(X(i), Y(v), wk ? 0.8 : 0.55, 'F'));
  if (wk) { doc.setFontSize(5.6); doc.setTextColor(...NAVY); P.forEach((v, i) => doc.text(Math.round(v * 100) + '%', X(i), Y(v) - 1.6, { align: 'center' })); }
  if (J.real) { doc.setDrawColor(31, 157, 85); doc.setLineWidth(0.3); doc.setLineDashPattern([1.2, 1], 0); doc.line(x0, Y(J.real), x0 + K * wd, Y(J.real)); doc.setLineDashPattern([], 0); }
  doc.setFontSize(7); doc.setTextColor(...INK); doc.text('Kurva S rencana (progres kumulatif per ' + (wk ? 'minggu' : 'hari ke-') + ')', M, yb - ch / 2);
  R.y = yb + 7;
}
async function devReport(s) {
  const rows = devRows(s);
  const R = await pdfReport({ title: 'Rencana Pengembangan ' + BC, sub: (s.status || 'Semua status') + ' · per ' + tgl(today(), true), orient: 'l', fname: 'Rencana_Pengembangan' });
  R.kv([['Jumlah program', String(rows.length)], ['Total estimasi biaya', 'Rp ' + R_(sum(rows, 'biaya'))], ['Total durasi', N_(sum(rows, 'durasi')) + ' hari'], ['Rata-rata progres', nf0.format(rows.length ? sum(rows, 'progress') / rows.length : 0) + '%']]);
  R.h2('Daftar Target Pengembangan');
  R.table(['No', 'Program', 'Kategori', 'Unit / Lokasi', 'Estimasi Biaya', 'Durasi', 'Rencana Mulai', 'Target Selesai', 'Prioritas', 'Progres', 'Status', 'PIC'], rows.map((r, i) => [i + 1, r.judul, r.kat || '-', [r.unit, r.lokasi].filter(Boolean).join(' - '), cellR(R_(r.biaya)), cellR(devDur(r)), tgl(r.mulai), r.mulai ? tgl(devEnd(r)) : '-', r.prioritas || '-', cellR((r.progress || 0) + '%'), r.status, r.pic || '-']),
    { fs: 7.4, cs: { 0: { halign: 'center', cellWidth: 8 } }, foot: ['', 'Total', '', '', cellR(R_(sum(rows, 'biaya'))), cellR(N_(sum(rows, 'durasi')) + ' hari'), '', '', '', '', '', ''] });
  rows.forEach(r => {
    if ((r.rab || []).length) {
      R.h2('Rincian Biaya: ' + r.judul);
      R.table(['No', 'Uraian Barang / Pekerjaan', 'Volume', 'Satuan', 'Harga Satuan', 'Jumlah'], r.rab.map((x, i) => [i + 1, x.uraian, cellR(N_(x.vol)), x.sat, cellR(R_(x.harga)), cellR(R_(devRabJml(x)))]), { cs: { 0: { halign: 'center', cellWidth: 8 } }, foot: ['', 'Harga Total', '', '', '', cellR(R_(sum(r.rab, devRabJml)))] });
    }
    devTSPdf(R, r);
    const inv = (r.inv || []).filter(x => x.uraian);
    if (inv.length) {
      R.h2('Inventarisasi: ' + r.judul);
      R.table(['No', 'Uraian Barang', 'Qty', 'Satuan', 'Keterangan'], inv.map((x, i) => [i + 1, x.uraian, cellR(N_(x.qty)), x.sat || '', x.ket || '-']), { cs: { 0: { halign: 'center', cellWidth: 8 } } });
    }
    if (r.ket && ((r.rab || []).length || (r.jadwal || []).length)) R.para('Catatan ' + r.judul + ': ' + r.ket);
  });
  R.sign([['Dibuat oleh', S.user.name], ['Kepala Basecamp', ''], ['Direktur', '']]);
  await R.save();
}
