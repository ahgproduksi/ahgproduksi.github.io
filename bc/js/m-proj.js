/* Basecamp — KARTU PROJECT: rekap progress penjualan unit per project & SO.
   Satu dokumen kind 'proj' = satu SO: { so, nama (project / paket), unit, tgl, cust, ppn, status, ket,
   items: [{ mat (campuran, mis. AC-BC), vol (target SO), sat, harga, sj: [{ tgl, no, ton, harga, ket }] }] }
   Format kartu mengikuti sheet "Kartu Project" Bugel-Klontong: tabel surat jalan per campuran +
   Total Terkirim / Total Tonase SO / Kekurangan SO, Total / PPN 11% / Grand Total. */
'use strict';
ICONS.proj = '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 8.5h17"/><path d="M8 12.5h3M8 16h3"/><path d="M14 16l1.5-3 1.5 1.5 1.5-3"/>';
const PJ_KET = ['Ditagihkan dengan harga terkirim', 'Belum ditagihkan', 'Sudah ditagihkan', 'Retur / dibatalkan'];
const PJ_SAT = { AMP: 'Ton', CMP: 'M3', SCP: 'Ton', PCP: 'Pcs' };
const rpD = n => 'Rp ' + nf2.format(+n || 0); // harga satuan bisa berdesimal (sama dengan sheet)
const pjVolLabel = sat => /^ton$/i.test(sat || 'Ton') ? 'Tonase' : 'Volume';

/* ---------- hitungan ---------- */
function pjItemStat(it) {
  const sj = it.sj || [];
  const kirim = sum(sj, 'ton'), vol = +it.vol || 0;
  const nilai = sum(sj, x => (+x.ton || 0) * (x.harga == null || x.harga === '' ? 0 : +x.harga));
  const last = sj.reduce((m, x) => x.tgl && x.tgl > m ? x.tgl : m, ''), first = sj.reduce((m, x) => x.tgl && (!m || x.tgl < m) ? x.tgl : m, '');
  return { first, vol, kirim, sisa: vol - kirim, nilai, n: sj.length, last, p: vol ? kirim / vol : (kirim ? 1 : 0), noHarga: sj.filter(x => x.harga == null || x.harga === '').length };
}
function pjStat(p) {
  const its = (p.items || []).map(pjItemStat);
  const vol = sum(its, 'vol'), kirim = sum(its, 'kirim'), nilai = sum(its, 'nilai');
  const ppn = nilai * (p.ppn == null || p.ppn === '' ? 11 : +p.ppn) / 100;
  const sisa = sum(its, x => Math.max(0, x.sisa));
  const last = its.reduce((m, x) => x.last > m ? x.last : m, ''), first = its.reduce((m, x) => x.first && (!m || x.first < m) ? x.first : m, '');
  return { first, its, vol, kirim, sisa, nilai, ppn, grand: nilai + ppn, n: sum(its, 'n'), last, p: vol ? kirim / vol : 0, status: pjStatus(p, its) };
}
function pjStatus(p, its) {
  if (p.status === 'Batal') return 'Batal';
  if (p.status === 'Selesai') return 'Selesai';
  its = its || (p.items || []).map(pjItemStat);
  if (its.length && its.every(x => x.vol > 0 && x.sisa <= 0.005)) return 'Selesai';
  return its.some(x => x.kirim > 0) ? 'Berjalan' : 'Belum kirim';
}
const pjTone = s => ({ Selesai: 'ok', Berjalan: 'info', 'Belum kirim': 'warn', Batal: 'mute' }[s] || '');
const pjChip = s => chip(s, pjTone(s));
const pjPpnPct = p => p.ppn == null || p.ppn === '' ? 11 : +p.ppn;
function pjAll() { return all('proj').sort((a, b) => String(a.nama).localeCompare(String(b.nama), 'id') || String(a.so).localeCompare(String(b.so))); }
function pjRows(s) {
  return pjAll().filter(p => (!s.unit || p.unit === s.unit) && qMatch(s.q, p.so, p.nama, p.cust, (p.items || []).map(i => i.mat).join(' '), (p.items || []).map(i => (i.sj || []).map(x => x.no).join(' ')).join(' ')))
    .map(p => Object.assign(p, { _s: pjStat(p) })).filter(p => !s.fs || p._s.status === s.fs);
}
const pjSisaTxt = (v, sat) => v < -0.005 ? 'lebih ' + num(-v) + ' ' + sat : num(v) + ' ' + sat;

/* ---------- kartu ---------- */
MODS.proj = {
  title: 'Kartu Project', icon: 'proj', desc: 'Progress penjualan unit per project & SO — surat jalan, volume terkirim, kekurangan SO, nilai + PPN',
  render(root) {
    const st = stateOf('proj', { tab: 'list', unit: '', q: '', fs: '', month: '' });
    return page(root, {
      key: 'proj', st, report: pjReport,
      tabs: [{ k: 'list', t: 'Daftar Project' }, { k: 'sj', t: 'Surat Jalan' }, { k: 'rekap', t: 'Rekap Progress' }],
      actions: [{ id: 'new', t: 'Project / SO Baru', pri: true }, { id: 'sj', t: 'Tambah Surat Jalan', icon: 'jadwal' }],
      on: { new: () => pjForm(), sj: () => sjForm() },
      filter: s => s.tab === 'sj' ? periodBar(s) : periodBar(Object.assign({}, s, { month: undefined }),
        null, '<select data-fk="fs"><option value="">Semua status</option>' + ['Berjalan', 'Belum kirim', 'Selesai', 'Batal'].map(x => '<option' + (s.fs === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select>'),
      body: s => s.tab === 'sj' ? pjSjHtml(s) : s.tab === 'rekap' ? pjRekapHtml(s) : pjListHtml(s),
      bind: (el, s) => {
        $$('[data-row]', el).forEach(tr => tr.onclick = () => {
          const [id, i, j] = tr.dataset.row.split('|');
          if (j !== undefined) sjForm(id, +i, +j); else pjDetail(id);
        });
        $$('[data-addso]', el).forEach(b => b.onclick = e => { e.stopPropagation(); const p = get(b.dataset.addso); pjForm(null, p ? { nama: p.nama, unit: p.unit, cust: p.cust, ppn: p.ppn } : {}); });
        $$('[data-newp]', el).forEach(b => b.onclick = () => pjForm());
      }
    });
  },
  summary() {
    const a = all('proj').map(p => Object.assign(p, { _s: pjStat(p) })).filter(p => p._s.status !== 'Batal');
    const run = a.filter(p => p._s.status !== 'Selesai');
    if (!a.length) return { main: 'Belum ada project', sub: 'Tambah project sesuai SO' };
    const vol = sum(run, p => p._s.vol), kirim = sum(run, p => p._s.kirim);
    return { main: run.length + ' SO berjalan · ' + new Set(a.map(p => p.nama)).size + ' project', sub: 'Terkirim ' + num(kirim) + ' / ' + num(vol) + ' · ' + rpS(sum(a, p => p._s.grand)) + ' incl. PPN' };
  }
};

function pjKpis(rows) {
  const act = rows.filter(p => p._s.status !== 'Batal');
  const vol = sum(act, p => p._s.vol), kirim = sum(act, p => p._s.kirim);
  return '<div class="kpis">' +
    kpi('Project / SO', new Set(act.map(p => p.nama)).size + ' / ' + act.length, act.filter(p => p._s.status === 'Berjalan').length + ' SO berjalan') +
    kpi('Volume terkirim', num(kirim), 'dari ' + num(vol) + ' volume SO · ' + pct(vol ? kirim / vol : 0)) +
    kpi('Kekurangan SO', num(sum(act, p => p._s.sisa)), 'sisa yang belum dikirim', sum(act, p => p._s.sisa) > 0 ? '' : 'good') +
    kpi('Nilai terkirim', rpS(sum(act, p => p._s.nilai)), 'incl. PPN ' + rpS(sum(act, p => p._s.grand))) + '</div>';
}
function pjListHtml(s) {
  const rows = pjRows(s);
  if (!rows.length) return pjKpis(rows) + '<section class="card">' + table([], [], { empty: all('proj').length ? 'Tidak ada project yang cocok dengan filter.' : 'Belum ada project. Buat project baru sesuai SO, lalu catat surat jalan pengirimannya.', emptyIcon: 'proj', emptyAct: '<button class="btn pri" data-newp>' + ic('plus') + 'Project / SO Baru</button>' }) + '</section>';
  const grp = groupBy(rows, p => p.nama || '-');
  return pjKpis(rows) + Object.entries(grp).map(([nama, ps]) => {
    const vol = sum(ps, p => p._s.vol), kirim = sum(ps, p => p._s.kirim), grand = sum(ps, p => p._s.grand);
    const lines = ps.flatMap(p => (p.items || []).map((it, i) => ({ id: p.id, p, it, x: p._s.its[i], first: i === 0 })));
    return '<section class="card pjcard"><div class="chead"><div><span class="ptile sm">' + ic('proj') + '</span><div><h3>' + esc(nama) + '</h3><div class="cmeta">' +
      [...new Set(ps.map(p => p.unit))].map(unitChip).join(' ') + ' ' + ps.length + ' SO · terkirim ' + num(kirim) + ' / ' + num(vol) + ' (' + pct(vol ? kirim / vol : 0) + ') · ' + rp(grand) + ' incl. PPN</div></div></div>' +
      '<button class="btn ghost sm" data-addso="' + esc(ps[0].id) + '">' + ic('plus') + 'SO baru di project ini</button></div>' +
      table([
        { t: 'No. SO', f: l => l.first ? '<b>' + esc(l.p.so) + '</b> ' + pjChip(l.p._s.status) + '<small>' + (l.p.tgl ? 'SO ' + tgl(l.p.tgl) : l.p._s.first ? 'mulai kirim ' + tgl(l.p._s.first) : 'belum ada pengiriman') + (l.p.cust ? ' · ' + esc(l.p.cust) : '') + '</small>' : '<small>' + esc(l.p.so) + '</small>', raw: true },
        { t: 'Campuran / Produk', f: l => '<b>' + esc(l.it.mat || '-') + '</b><small>' + (+l.it.harga ? 'harga ' + rpD(l.it.harga) + ' / ' + esc(l.it.sat || 'Ton') : 'belum ada harga') + '</small>', raw: true },
        { t: 'Volume SO', f: l => num(l.x.vol) + ' ' + esc(l.it.sat || 'Ton'), num: true, raw: true },
        { t: 'Terkirim', f: l => '<b>' + num(l.x.kirim) + '</b><small>' + l.x.n + ' SJ' + (l.x.last ? ' · terakhir ' + tgl(l.x.last) : '') + '</small>', num: true, raw: true },
        { t: 'Kekurangan SO', f: l => '<span class="' + (l.x.sisa < -0.005 ? 't-warn' : l.x.sisa > 0.005 ? '' : 't-ok') + '">' + esc(pjSisaTxt(l.x.sisa, l.it.sat || 'Ton')) + '</span>', num: true, raw: true },
        { t: 'Progress', f: l => '<div class="pjbar">' + bar(Math.min(1, l.x.p), l.x.sisa <= 0.005 ? 'ok' : '') + '<span>' + pct(l.x.p) + '</span></div>', raw: true },
        { t: 'Jumlah SJ (excl. PPN)', f: l => rp(l.x.nilai) + (l.x.noHarga ? '<small class="t-warn">' + l.x.noHarga + ' SJ tanpa harga</small>' : ''), num: true, raw: true }
      ], lines, { click: true }) + '</section>';
  }).join('');
}
function pjSjList(s) {
  const out = [];
  pjAll().filter(p => !s.unit || p.unit === s.unit).forEach(p => (p.items || []).forEach((it, i) => (it.sj || []).forEach((x, j) => {
    if (!inMonth(x.tgl, s.month) || !qMatch(s.q, x.no, p.so, p.nama, it.mat, x.ket)) return;
    out.push({ id: p.id + '|' + i + '|' + j, p, it, x, tgl: x.tgl, jml: (+x.ton || 0) * (+x.harga || 0) });
  })));
  return out.sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)) || String(b.x.no).localeCompare(String(a.x.no)));
}
function pjSjHtml(s) {
  const rows = pjSjList(s);
  return '<div class="kpis">' + kpi('Surat jalan', rows.length, monthLabel(s.month)) + kpi('Volume terkirim', num(sum(rows, r => r.x.ton)), [...new Set(rows.map(r => r.it.sat || 'Ton'))].join(' / ') || '-') +
    kpi('Jumlah surat jalan', rpS(sum(rows, 'jml')), 'excl. PPN') + kpi('Project dikirim', new Set(rows.map(r => r.p.nama)).size, new Set(rows.map(r => r.p.so)).size + ' SO') + '</div>' +
    '<section class="card flush">' + table([
      { t: 'Tanggal', f: r => tgl(r.x.tgl) }, { t: 'No. Surat Jalan', f: r => '<b>' + esc(r.x.no || '-') + '</b>', raw: true },
      { t: 'Project / SO', f: r => '<b>' + esc(r.p.nama) + '</b><small>' + esc(r.p.so) + '</small>', raw: true },
      { t: 'Campuran', f: r => r.it.mat }, { t: 'Volume', f: r => num(r.x.ton) + ' ' + (r.it.sat || 'Ton'), num: true },
      { t: 'Harga satuan', f: r => r.x.harga == null || r.x.harga === '' ? '<span class="t-warn">-</span>' : rpD(r.x.harga), num: true, raw: true },
      { t: 'Jumlah', f: r => rp(r.jml), num: true }, { t: 'Keterangan', f: r => r.x.ket || '' }
    ], rows, { click: true, empty: 'Belum ada surat jalan pada periode ini.', emptyIcon: 'jadwal' }) + '</section>';
}
function pjRekapData(s) {
  const rows = pjRows(s).filter(p => p._s.status !== 'Batal');
  const mon = new Map();
  rows.forEach(p => (p.items || []).forEach(it => (it.sj || []).forEach(x => {
    const k = String(x.tgl || '').slice(0, 7) || '-'; const m = mon.get(k) || { id: k, n: 0, vol: 0, nilai: 0, ppn: 0, so: new Set() };
    const v = (+x.ton || 0) * (+x.harga || 0); m.n++; m.vol += +x.ton || 0; m.nilai += v; m.ppn += v * pjPpnPct(p) / 100; m.so.add(p.so); mon.set(k, m);
  })));
  return { rows, mon: [...mon.values()].sort((a, b) => b.id.localeCompare(a.id)) };
}
function pjRekapHtml(s) {
  const { rows, mon } = pjRekapData(s);
  const lines = rows.flatMap(p => (p.items || []).map((it, i) => ({ id: p.id, p, it, x: p._s.its[i] })));
  return pjKpis(rows) +
    '<section class="card"><div class="chead"><div><h3>Progress per project & SO</h3></div><div class="cmeta">' + lines.length + ' baris · klik untuk membuka kartu</div></div>' + table([
      { t: 'Project / SO', f: l => '<b>' + esc(l.p.nama) + '</b><small>' + esc(l.p.so) + ' · ' + esc(l.p.unit) + '</small>', raw: true }, { t: 'Campuran', f: l => l.it.mat },
      { t: 'Volume SO', f: l => num(l.x.vol), num: true, sum: r => sum(r, l => l.x.vol) }, { t: 'Terkirim', f: l => num(l.x.kirim), num: true, sum: r => sum(r, l => l.x.kirim) },
      { t: 'Kekurangan', f: l => pjSisaTxt(l.x.sisa, ''), num: true, sum: r => sum(r, l => Math.max(0, l.x.sisa)) },
      { t: '%', f: l => pct(l.x.p), num: true },
      { t: 'Jumlah (excl. PPN)', f: l => l.x.nilai, money: true, sum: r => sum(r, l => l.x.nilai) },
      { t: 'PPN', f: l => l.x.nilai * pjPpnPct(l.p) / 100, money: true, sum: r => sum(r, l => l.x.nilai * pjPpnPct(l.p) / 100) },
      { t: 'Grand total', f: l => l.x.nilai * (1 + pjPpnPct(l.p) / 100), money: true, sum: r => sum(r, l => l.x.nilai * (1 + pjPpnPct(l.p) / 100)) }
    ], lines, { click: true, empty: 'Belum ada project.' }) + '</section>' +
    '<section class="card"><div class="chead"><div><h3>Pengiriman per bulan</h3></div><div class="cmeta">berdasarkan tanggal surat jalan</div></div>' + table([
      { t: 'Bulan', f: m => m.id === '-' ? 'Tanpa tanggal' : monthLabel(m.id) }, { t: 'SO dikirim', f: m => m.so.size, num: true },
      { t: 'Surat jalan', f: m => m.n, num: true, sum: r => sum(r, 'n') }, { t: 'Volume', f: m => m.vol, num: true, sum: r => sum(r, 'vol') },
      { t: 'Jumlah (excl. PPN)', k: 'nilai', money: true, sum: true }, { t: 'PPN', k: 'ppn', money: true, sum: true },
      { t: 'Total', f: m => m.nilai + m.ppn, money: true, sum: r => sum(r, m => m.nilai + m.ppn) }
    ], mon, { empty: 'Belum ada surat jalan.' }) + '</section>';
}

/* ---------- kartu project per SO (format sheet) ---------- */
function pjKartuTable(p, it, i, edit) {
  const x = pjItemStat(it), sat = it.sat || 'Ton', ppnP = pjPpnPct(p), sj = it.sj || [];
  // keterangan berurutan yang sama digabung (seperti sel gabungan di sheet)
  const span = []; for (let j = 0; j < sj.length; j++) { const k = sj[j].ket || ''; let n = 1; while (j + n < sj.length && (sj[j + n].ket || '') === k) n++; span[j] = n; for (let m = 1; m < n; m++) span[j + m] = 0; j += n - 1; }
  const body = sj.map((r, j) => '<tr' + (edit ? ' class="click" data-sj="' + i + '|' + j + '"' : '') + '><td class="c">' + (j + 1) + '</td><td>' + (r.tgl ? tgl(r.tgl) : '-') + '</td><td><b>' + esc(r.no || '-') + '</b></td>' +
    '<td class="n">' + num(r.ton) + '</td><td class="n">' + (r.harga == null || r.harga === '' ? '<span class="t-warn">-</span>' : rpD(r.harga)) + '</td><td class="n">' + rpD((+r.ton || 0) * (+r.harga || 0)) + '</td>' +
    (span[j] ? '<td class="wrap pjket"' + (span[j] > 1 ? ' rowspan="' + span[j] + '"' : '') + '><span>' + esc(r.ket || '') + '</span></td>' : '') + '</tr>').join('') ||
    '<tr><td colspan="7" class="c muted">Belum ada surat jalan untuk ' + esc(it.mat) + '.</td></tr>';
  return '<div class="pjk"><div class="pjkh"><b>' + esc(it.mat || '-') + (x.vol && x.sisa <= 0.005 ? ' (TERKIRIM)' : '') + '</b><span>' + pct(x.p) + ' · ' + x.n + ' surat jalan</span>' + bar(Math.min(1, x.p), x.sisa <= 0.005 ? 'ok' : '') + '</div>' +
    '<div class="tbl"><table><thead><tr><th class="c">No</th><th>Tanggal Surat Jalan</th><th>No. Surat Jalan</th><th class="n">' + pjVolLabel(sat) + ' Surat Jalan (' + esc(sat.toLowerCase()) + ')</th><th class="n">Harga Satuan (' + esc(sat.toLowerCase()) + ')</th><th class="n">Jumlah Surat Jalan</th><th>Keterangan</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
    '<div class="tbl pjsum"><table><tbody><tr><td>Total Terkirim</td><td class="n">' + num(x.kirim) + ' ' + esc(sat) + '</td><td class="n">Total</td><td class="n">' + rpD(x.nilai) + '</td></tr>' +
    '<tr><td>Total ' + pjVolLabel(sat) + ' SO</td><td class="n">' + num(x.vol) + ' ' + esc(sat) + '</td><td class="n">PPN ' + nf2.format(ppnP) + '%</td><td class="n">' + rpD(x.nilai * ppnP / 100) + '</td></tr>' +
    '<tr class="grand"><td>Kekurangan SO</td><td class="n">' + esc(pjSisaTxt(x.sisa, sat)) + '</td><td class="n">Grand Total</td><td class="n">' + rp(x.nilai * (1 + ppnP / 100)) + '</td></tr></tbody></table></div></div>';
}
function pjDetail(id) {
  const p = get(id); if (!p) return;
  const s = pjStat(p);
  detail({
    title: 'Kartu Project ' + p.nama, sub: 'SO ' + p.so + ' · ' + (UNIT_NAME[p.unit] || p.unit),
    html: infoGrid([['Project', p.nama], ['No. SO', p.so], ['Unit', p.unit], ['Tanggal SO', p.tgl ? tgl(p.tgl, true) : '-'], ['Customer / pemberi kerja', p.cust || '-'], ['PPN', nf2.format(pjPpnPct(p)) + '%'],
    ['Status', pjChip(s.status), true], ['Pengiriman', s.first ? tgl(s.first) + ' s/d ' + tgl(s.last) : 'belum ada'], ['Catatan', p.ket || '-'], ['Diperbarui', (p._by || '-') + ' · ' + tglJam(p._at)]]) +
      '<div class="kpis sm">' + kpi('Volume SO', num(s.vol), (p.items || []).map(i => i.mat).join(', ')) + kpi('Terkirim', num(s.kirim), pct(s.p) + ' · ' + s.n + ' SJ') + kpi('Kekurangan SO', num(s.sisa), s.sisa > 0.005 ? 'belum dikirim' : 'terpenuhi', s.sisa > 0.005 ? '' : 'good') +
      kpi('Grand total', rp(s.grand), 'Total ' + rp(s.nilai) + ' + PPN ' + rp(s.ppn)) + '</div>' +
      '<div class="pjtitle"><b>KARTU PROJECT ' + esc(String(p.nama).toUpperCase()) + ' - ' + esc(p.unit) + '</b><span>SO : ' + esc(p.so) + '</span></div>' +
      (p.items || []).map((it, i) => pjKartuTable(p, it, i, true)).join('') +
      ((p.items || []).length > 1 ? '<div class="tbl"><table><tbody><tr class="sub"><td>Total seluruh campuran</td><td class="n">' + num(s.kirim) + ' / ' + num(s.vol) + '</td><td class="n">Total ' + rp(s.nilai) + '</td><td class="n">PPN ' + rp(s.ppn) + '</td></tr><tr class="grand"><td colspan="3">Grand Total SO ' + esc(p.so) + '</td><td class="n">' + rp(s.grand) + '</td></tr></tbody></table></div>' : '') +
      '<p class="muted sm" style="margin-top:8px">Klik baris surat jalan untuk mengubah atau menghapusnya.' + (p.src ? ' Sumber awal: ' + esc(p.src) + '.' : '') + '</p>',
    bind: (el, m) => $$('[data-sj]', el).forEach(tr => tr.onclick = () => { const [i, j] = tr.dataset.sj.split('|').map(Number); m.close(); sjForm(id, i, j, true); }),
    buttons: [
      { id: 'pdf', t: 'Cetak', icon: 'print', dark: true, fn: () => runReport(() => pjPdf(get(id))) },
      { id: 'edit', t: 'Ubah SO', icon: 'edit', fn: m => { m.close(); pjForm(get(id)); } },
      { id: 'sj', t: 'Tambah Surat Jalan', icon: 'plus', pri: true, fn: m => { m.close(); sjForm(id, null, null, true); } }
    ]
  });
}

/* ---------- form project / SO ---------- */
function pjMatOpts(unit) {
  const s = new Set();
  all('proj').forEach(p => (p.items || []).forEach(i => i.mat && (!unit || p.unit === unit) && s.add(i.mat)));
  try { products(unit || 'AMP').forEach(p => s.add(p.n)); } catch { }
  return [...s];
}
function pjForm(d, pre) {
  const st = stateOf('proj', {});
  const prodSO = all('prod').filter(x => x.status !== 'Batal' && !all('proj').some(p => p.so === x.no));
  const unit0 = (pre && pre.unit) || st.unit || 'AMP';
  const v = d ? Object.assign({}, d, { items: (d.items || []).map(i => Object.assign({}, i)) }) :
    Object.assign({ tgl: today(), unit: unit0, ppn: 11, status: '', items: [{ mat: '', vol: '', sat: PJ_SAT[unit0], harga: '' }] }, pre || {});
  openForm({
    title: d ? 'Ubah ' + d.so : 'Project / SO Baru', sub: 'Satu kartu = satu Sales Order. Beberapa SO bisa berada di project (paket) yang sama.', wide: true, value: v,
    onDelete: d ? () => remove(d.id) : null,
    fields: [
      { k: 'fromso', label: 'Ambil dari SO Produksi (opsional)', type: 'select', full: true, show: () => !d && prodSO.length > 0, empty: '— Isi manual —', opts: () => prodSO.map(x => ({ v: x.id, t: soLabel(x) })),
        onChange: x => { const p = get(x.fromso); if (!p) return; Object.assign(x, { so: p.no, nama: x.nama || p.proyek, unit: p.unit, tgl: p.tgl, cust: custName(p.cust), items: [{ mat: p.produk, vol: p.vol, sat: p.sat, harga: p.harga }] }); } },
      { k: 'so', label: 'No. SO', req: true, ph: 'mis. AMP-SOA26110004', valid: (val, x) => all('proj').some(p => p.so.trim().toLowerCase() === String(val).trim().toLowerCase() && (!d || p.id !== d.id)) ? 'No. SO ' + val + ' sudah punya kartu project' : '' },
      { k: 'tgl', label: 'Tanggal SO', type: 'date' },
      { k: 'nama', label: 'Nama project / paket', type: 'list', req: true, full: true, ph: 'mis. Paket Payaman-Windusari', opts: () => [...new Set(all('proj').map(p => p.nama))] },
      { k: 'unit', label: 'Unit', type: 'seg', opts: UNITS, onChange: x => (x.items || []).forEach(i => { if (!i.sat || Object.values(PJ_SAT).includes(i.sat)) i.sat = PJ_SAT[x.unit]; }) },
      { k: 'cust', label: 'Customer / pemberi kerja', type: 'list', ph: 'opsional', opts: () => [...new Set(custList().map(c => c.nama).concat(all('proj').map(p => p.cust).filter(Boolean)))] },
      { k: 'items', label: 'Campuran / produk dalam SO', type: 'items', newRow: x => ({ mat: '', vol: '', sat: PJ_SAT[x.unit] || 'Ton', harga: (x.items || []).length ? x.items[x.items.length - 1].harga : '' }),
        cols: [{ k: 'mat', label: 'Campuran / produk (mis. AC-BC, AC-WC, HRS WC)', type: 'list', opts: x => pjMatOpts(x.unit) }, { k: 'vol', label: 'Volume SO', num: true, w: '110px' },
        { k: 'sat', label: 'Satuan', type: 'select', opts: SATUAN, w: '90px' }, { k: 'harga', label: 'Harga satuan (excl. PPN)', num: true, w: '150px' }] },
      { k: 'ppn', label: 'PPN', type: 'num', req: 'zero', suffix: '%' },
      { k: 'status', label: 'Status', type: 'select', empty: 'Otomatis (dari pengiriman)', opts: ['Selesai', 'Batal'] },
      { k: 'ket', label: 'Catatan', type: 'textarea', rows: 2, ph: 'opsional, mis. ditagihkan dengan harga terkirim' }
    ],
    onSave: x => {
      const items = (x.items || []).filter(i => String(i.mat || '').trim());
      if (!items.length) { toast('Isi minimal satu campuran / produk', 'err'); return false; }
      const old = d ? d.items || [] : [];
      const data = {
        so: x.so.trim(), nama: x.nama.trim(), unit: x.unit, tgl: x.tgl || '', cust: (x.cust || '').trim(), ppn: x.ppn === '' ? 11 : +x.ppn, status: x.status || '', ket: x.ket || '',
        items: items.map(i => ({ mat: String(i.mat).trim(), vol: +i.vol || 0, sat: i.sat || PJ_SAT[x.unit] || 'Ton', harga: +i.harga || 0, sj: i.sj || [] })), // baris lama membawa surat jalannya
        src: d ? d.src || '' : ''
      };
      if (sum(old, o => (o.sj || []).length) > sum(data.items, i => i.sj.length)) { toast('Campuran yang dihapus masih punya surat jalan — hapus surat jalannya dulu', 'err'); return false; }
      const id = save('proj', data, d && d.id);
      toast('Kartu project ' + data.so + ' tersimpan');
      setTimeout(() => pjDetail(id), 320);
    }
  });
}

/* ---------- form surat jalan ---------- */
function pjNextSj(unit) {
  let best = '';
  all('proj').filter(p => !unit || p.unit === unit).forEach(p => (p.items || []).forEach(i => (i.sj || []).forEach(x => { if (x.no && /\d+$/.test(x.no) && (x.tgl || '') + x.no > best) best = (x.tgl || '') + x.no; })));
  const no = best.replace(/^\d{4}-\d{2}-\d{2}/, '');
  const m = no.match(/^(.*?)(\d+)$/); if (!m) return '';
  return m[1] + String(+m[2] + 1).padStart(m[2].length, '0');
}
function pjParseRows(txt, defHarga) {
  const out = [], bad = [];
  String(txt || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(l => {
    const t = l.split(/\t|;|\s{2,}|,(?=\s)/).map(x => x.trim()).filter(Boolean);
    let tg = '', no = '', nums = [];
    t.forEach(c => { // angka sebelum kolom tanggal = kolom No urut (diabaikan)
      let m;
      if (!tg && (m = c.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) tg = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
      else if (!tg && (m = c.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) tg = (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
      else if (!no && /[A-Za-z]/.test(c) && !/^rp\s*[\d.,]+$/i.test(c)) no = c;
      else if (tg && /^(rp\s*)?[\d.,]+$/i.test(c)) nums.push(parseNum(c));
    });
    if (!tg || !nums.length) { bad.push(l); return; }
    out.push({ tgl: tg, no, ton: nums[0], harga: nums.length > 1 ? nums[1] : defHarga });
  });
  return { out, bad };
}
function sjForm(pid, ii, jj, back) {
  const projs = pjAll().filter(p => p.status !== 'Batal' || p.id === pid);
  if (!projs.length) { toast('Buat project / SO terlebih dahulu'); return pjForm(); }
  const p0 = pid ? get(pid) : null;
  const edit = p0 && ii != null && jj != null ? (p0.items[ii].sj || [])[jj] : null;
  const it0 = p0 ? p0.items[ii != null ? ii : 0] : null;
  const v = edit ? Object.assign({ pid, item: String(ii) }, edit, { harga: edit.harga == null ? '' : edit.harga }) :
    { pid: pid || '', item: ii != null ? String(ii) : '0', tgl: today(), no: pjNextSj(p0 ? p0.unit : ''), ton: '', harga: it0 ? it0.harga : '', ket: '' };
  const P = x => get(x.pid), IT = x => { const p = P(x); return p ? p.items[+x.item || 0] : null; };
  const sat = x => (IT(x) || {}).sat || 'Ton';
  const done = id => { if (back) setTimeout(() => pjDetail(id), 320); };
  openForm({
    title: edit ? 'Ubah Surat Jalan ' + (edit.no || '') : 'Tambah Surat Jalan', sub: 'Pengiriman sesuai SO — progress kartu project ikut berubah', wide: !edit, value: v,
    onDelete: edit ? () => { const p = get(pid); p.items[ii].sj.splice(jj, 1); save('proj', p, pid); done(pid); } : null,
    fields: [
      { k: 'pid', label: 'Project / SO', type: 'select', req: true, full: true, ro: !!edit, opts: () => projs.map(p => ({ v: p.id, t: p.so + ' · ' + p.nama })),
        onChange: x => { x.item = '0'; const it = IT(x); x.harga = it ? it.harga : ''; if (!x.no) x.no = pjNextSj((P(x) || {}).unit); } },
      { k: 'item', label: 'Campuran / produk', type: 'select', req: true, empty: false, opts: x => ((P(x) || {}).items || []).map((i, n) => ({ v: String(n), t: i.mat + ' — sisa ' + pjSisaTxt(pjItemStat(i).sisa, i.sat || 'Ton') })), onChange: x => { const it = IT(x); if (it && !edit) x.harga = it.harga; } },
      { k: 'tgl', label: 'Tanggal surat jalan', type: 'date' },
      { k: 'no', label: 'No. surat jalan', ph: 'mis. AMP-SDA26110007', help: edit ? '' : 'Otomatis lanjut dari surat jalan terakhir, bisa diubah' },
      { k: 'ton', label: 'Volume / tonase', type: 'num', suffix: sat },
      { k: 'harga', label: 'Harga satuan (excl. PPN)', type: 'num', suffix: x => 'Rp / ' + sat(x), help: 'Kosongkan bila belum ada harga (jumlah dihitung 0, seperti di sheet)' },
      { k: 'ket', label: 'Keterangan', type: 'list', full: true, opts: PJ_KET, ph: 'mis. Ditagihkan dengan harga terkirim' },
      { k: 'bulk', label: 'Atau tempel banyak surat jalan sekaligus', type: 'textarea', rows: 4, show: () => !edit, ph: 'Salin dari Excel / Google Sheet, satu baris per surat jalan:\nTanggal   No. Surat Jalan   Tonase   Harga\n08/04/2026	AMP-SDA26040005	9,02	1.300.871',
        help: 'Kolom: tanggal, nomor SJ, tonase, harga (harga boleh kosong = harga SO). Keterangan di atas dipakai untuk semua baris.' },
      { k: 'calc', type: 'html', html: x => { const it = IT(x); if (!it) return ''; const s = pjItemStat(it); const add = x.bulk ? sum(pjParseRows(x.bulk, +x.harga || it.harga).out, 'ton') : (+x.ton || 0) - (edit ? +edit.ton || 0 : 0);
        return '<div class="note">SO ' + esc((P(x) || {}).so) + ' · ' + esc(it.mat) + ': terkirim ' + num(s.kirim) + ' / ' + num(s.vol) + ' ' + esc(it.sat || 'Ton') + ' → setelah disimpan <b>' + num(s.kirim + add) + '</b>, kekurangan SO <b>' + esc(pjSisaTxt(s.vol - s.kirim - add, it.sat || 'Ton')) + '</b>' + (x.ton && x.harga !== '' && !x.bulk ? ' · jumlah ' + rpD((+x.ton || 0) * (+x.harga || 0)) : '') + '</div>'; } }
    ],
    onSave: x => {
      const p = get(x.pid); if (!p) { toast('Pilih project / SO', 'err'); return false; }
      const i = +x.item || 0, it = p.items[i]; if (!it) { toast('Pilih campuran', 'err'); return false; }
      it.sj = it.sj || [];
      const exists = (no, skip) => no && all('proj').some(q => (q.items || []).some((ci, a) => (ci.sj || []).some((s2, b) => s2.no === no && !(skip && q.id === p.id && a === skip[0] && b === skip[1]))));
      let rows;
      if (!edit && String(x.bulk || '').trim()) {
        const r = pjParseRows(x.bulk, x.harga === '' ? it.harga : +x.harga);
        if (r.bad.length) { toast(r.bad.length + ' baris tidak terbaca (perlu tanggal & tonase): ' + r.bad[0].slice(0, 40), 'err'); return false; }
        rows = r.out.map(o => Object.assign(o, x.ket ? { ket: x.ket } : {}));
      } else {
        if (!x.tgl) { toast('Tanggal surat jalan wajib diisi', 'err'); return false; }
        if (!String(x.no || '').trim()) { toast('No. surat jalan wajib diisi', 'err'); return false; }
        if (!(+x.ton > 0)) { toast('Volume / tonase wajib diisi', 'err'); return false; }
        rows = [{ tgl: x.tgl, no: String(x.no).trim(), ton: +x.ton, harga: x.harga === '' || x.harga == null ? null : +x.harga }];
        if (x.ket) rows[0].ket = x.ket;
      }
      const dup = rows.find(r => exists(r.no, edit ? [ii, jj] : null)) || rows.find((r, k) => r.no && rows.findIndex(o => o.no === r.no) !== k);
      if (dup) { toast('No. surat jalan ' + dup.no + ' sudah tercatat', 'err'); return false; }
      if (edit) it.sj[jj] = rows[0]; else it.sj.push(...rows);
      it.sj.sort((a, b) => String(a.tgl).localeCompare(String(b.tgl)) || String(a.no).localeCompare(String(b.no), 'id', { numeric: true }));
      save('proj', p, p.id);
      toast(edit ? 'Surat jalan diperbarui' : rows.length + ' surat jalan dicatat — ' + num(sum(rows, 'ton')) + ' ' + (it.sat || 'Ton'));
      done(p.id);
    }
  });
}

/* ---------- PDF ---------- */
const PJF = { fontStyle: 'bold', fillColor: [232, 237, 244] };
function pjPdfRows(p, it) {
  const x = pjItemStat(it), ppnP = pjPpnPct(p), sj = it.sj || [];
  const body = sj.map((r, j) => {
    const row = [cellR(String(j + 1)), r.tgl ? tgl(r.tgl) : '-', r.no || '-', cellR(N_(r.ton)), cellR(r.harga == null || r.harga === '' ? '-' : 'Rp ' + N_(r.harga)), cellR('Rp ' + N_((+r.ton || 0) * (+r.harga || 0)))];
    const k = r.ket || '';
    // keterangan hanya di baris pertama tiap kelompok (rowSpan panjang membuat autotable melompati halaman)
    row.push(j === 0 || (sj[j - 1].ket || '') !== k ? k : '');
    return row;
  });
  if (!body.length) body.push([{ content: 'Belum ada surat jalan', colSpan: 7, styles: { halign: 'center', textColor: [96, 108, 124] } }]);
  const f = (a, b, c, d) => [{ content: a, colSpan: 3, styles: PJF }, { content: b, styles: Object.assign({ halign: 'right' }, PJF) }, { content: c, styles: Object.assign({ halign: 'right' }, PJF) }, { content: d, styles: Object.assign({ halign: 'right' }, PJF) }, { content: '', styles: PJF }];
  body.push(f('Total Terkirim', N_(x.kirim), 'Total', 'Rp ' + N_(x.nilai)), f('Total ' + pjVolLabel(it.sat) + ' SO', N_(x.vol), 'PPN ' + nf2.format(ppnP) + '%', 'Rp ' + N_(x.nilai * ppnP / 100)), f('Kekurangan SO', N_(x.sisa), 'Grand Total', 'Rp ' + R_(x.nilai * (1 + ppnP / 100))));
  return body;
}
async function pjPdf(p) {
  const s = pjStat(p);
  const R = await pdfReport({ title: 'Kartu Project ' + p.nama + ' - ' + p.unit, sub: 'SO : ' + p.so + (p.cust ? ' · ' + p.cust : '') + ' · ' + BC, fname: 'Kartu_Project_' + p.so });
  R.kv([['Volume SO', N_(s.vol)], ['Terkirim', N_(s.kirim) + ' (' + pct(s.p) + ')'], ['Kekurangan SO', N_(s.sisa)], ['Grand total', 'Rp ' + R_(s.grand)]]);
  (p.items || []).forEach(it => {
    const x = pjItemStat(it), sat = (it.sat || 'Ton').toLowerCase();
    R.h2(it.mat + (x.vol && x.sisa <= 0.005 ? ' (TERKIRIM)' : ''), x.n + ' surat jalan · ' + pct(x.p));
    R.table(['No', 'Tanggal Surat Jalan', 'No. Surat Jalan', pjVolLabel(it.sat) + ' Surat Jalan (' + sat + ')', 'Harga Satuan (' + sat + ')', 'Jumlah Surat Jalan', 'Keterangan'], pjPdfRows(p, it),
      { fs: 7.4, cs: { 0: { halign: 'center', cellWidth: 9 }, 6: { cellWidth: 34 } } });
  });
  if ((p.items || []).length > 1) R.kv([['Total seluruh campuran', 'Rp ' + R_(s.nilai)], ['PPN ' + nf2.format(pjPpnPct(p)) + '%', 'Rp ' + R_(s.ppn)], ['Grand total SO', 'Rp ' + R_(s.grand)]]);
  R.sign();
  await R.save();
}
async function pjReport(s) {
  if (s.tab === 'sj') {
    const rows = pjSjList(s).reverse();
    const R = await pdfReport({ title: 'Daftar Surat Jalan Project', sub: (s.unit ? UNIT_NAME[s.unit] : 'Seluruh unit') + ' · ' + monthLabel(s.month) + ' · ' + BC, orient: 'l', fname: 'Surat_Jalan_Project' });
    R.kv([['Surat jalan', String(rows.length)], ['Volume', N_(sum(rows, r => r.x.ton))], ['Jumlah (excl. PPN)', 'Rp ' + R_(sum(rows, 'jml'))]]);
    R.table(['No', 'Tanggal', 'No. Surat Jalan', 'Project', 'No. SO', 'Campuran', 'Volume', 'Harga satuan', 'Jumlah', 'Keterangan'],
      rows.map((r, i) => [cellR(String(i + 1)), tgl(r.x.tgl), r.x.no, r.p.nama, r.p.so, r.it.mat, cellR(N_(r.x.ton)), cellR(r.x.harga == null || r.x.harga === '' ? '-' : N_(r.x.harga)), cellR(R_(r.jml)), r.x.ket || '']),
      { fs: 7, foot: ['Total', '', '', '', '', '', cellR(N_(sum(rows, r => r.x.ton))), '', cellR(R_(sum(rows, 'jml'))), ''] });
    R.sign(); return R.save();
  }
  const { rows, mon } = pjRekapData(s);
  const R = await pdfReport({ title: 'Rekap Kartu Project', sub: 'Progress penjualan unit per project & SO · ' + (s.unit ? UNIT_NAME[s.unit] : 'Seluruh unit') + (s.fs ? ' · ' + s.fs : '') + ' · ' + BC, orient: 'l', fname: 'Rekap_Kartu_Project' });
  const vol = sum(rows, p => p._s.vol), kirim = sum(rows, p => p._s.kirim);
  R.kv([['Project / SO', new Set(rows.map(p => p.nama)).size + ' / ' + rows.length], ['Terkirim', N_(kirim) + ' dari ' + N_(vol) + ' (' + pct(vol ? kirim / vol : 0) + ')'], ['Kekurangan SO', N_(sum(rows, p => p._s.sisa))], ['Grand total (incl. PPN)', 'Rp ' + R_(sum(rows, p => p._s.grand))]]);
  Object.entries(groupBy(rows, p => p.nama)).forEach(([nama, ps]) => {
    R.h2(nama, ps.length + ' SO');
    const L = ps.flatMap(p => (p.items || []).map((it, i) => ({ p, it, x: p._s.its[i] })));
    R.table(['No. SO', 'Mulai kirim', 'Campuran', 'Volume SO', 'Terkirim', 'Kekurangan', '%', 'SJ', 'Total', 'PPN', 'Grand total', 'Status'],
      L.map(l => [l.p.so, l.x.first ? tgl(l.x.first) : '-', l.it.mat, cellR(N_(l.x.vol) + ' ' + (l.it.sat || 'Ton')), cellR(N_(l.x.kirim)), cellR(N_(l.x.sisa)), cellR(pct(l.x.p)), cellR(String(l.x.n)), cellR(R_(l.x.nilai)), cellR(R_(l.x.nilai * pjPpnPct(l.p) / 100)), cellR(R_(l.x.nilai * (1 + pjPpnPct(l.p) / 100))), l.p._s.status]),
      { fs: 7.2, foot: ['Total', '', '', cellR(N_(sum(L, l => l.x.vol))), cellR(N_(sum(L, l => l.x.kirim))), cellR(N_(sum(L, l => Math.max(0, l.x.sisa)))), '', cellR(String(sum(L, l => l.x.n))), cellR(R_(sum(L, l => l.x.nilai))), cellR(R_(sum(L, l => l.x.nilai * pjPpnPct(l.p) / 100))), cellR(R_(sum(L, l => l.x.nilai * (1 + pjPpnPct(l.p) / 100)))), ''] });
  });
  if (mon.length) {
    R.h2('Pengiriman per Bulan', 'berdasarkan tanggal surat jalan');
    R.table(['Bulan', 'SO dikirim', 'Surat jalan', 'Volume', 'Total', 'PPN', 'Grand total'], mon.map(m => [m.id === '-' ? 'Tanpa tanggal' : monthLabel(m.id), cellR(String(m.so.size)), cellR(String(m.n)), cellR(N_(m.vol)), cellR(R_(m.nilai)), cellR(R_(m.ppn)), cellR(R_(m.nilai + m.ppn))]));
  }
  R.sign();
  await R.save();
}
