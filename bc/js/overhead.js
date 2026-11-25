/* Basecamp — OVERHEAD PER UNIT (kartu 'oh' + tab di HPP & BUASO).
   Sumber angka komponen O: ohCalc() → dailyOf() → HPP, harga transfer, Price List, produksi.
   Mengikuti sheet RAPU-BUASO tab Overhead: opex bersama x porsi + overhead unit per tahun + opex khusus unit per bulan,
   ditambah (pilihan) opex akunting tab Ovt (Akt) dan depresiasi tab Depresiasi.
   Rincian disimpan di server (dokumen OH_ID, terkunci kata sandi edit); di berkas ini hanya totalnya. */
'use strict';
ICONS.oh = '<path d="M4 20V9l5-4v15M9 20h11V11H9"/><path d="M12.5 14.5h4M12.5 17h4M6.3 11.5h.4M6.3 15h.4"/><path d="M2.5 20h19"/>';
const OH_ID = 'prmOverheadUnit01';
const OH_U = ['SCP', 'AMP', 'CMP', 'PCP'];
const OH_G = { // per = satuan isian
  bersama: { t: 'Opex bersama basecamp', per: 'bulan', kode: 'O1' },
  thn: { t: 'Overhead unit', per: 'tahun', kode: 'O2' },
  khusus: { t: 'Opex khusus unit', per: 'bulan', kode: 'O3' },
  akt: { t: 'Opex akunting (realisasi pembukuan)', per: 'periode', kode: 'O4' },
  depr: { t: 'Depresiasi alat & kendaraan', per: 'periode', kode: 'O5' }
};
const OH_K = Object.keys(OH_G);
const OH_ON = { bersama: true, thn: true, khusus: true, akt: false, depr: false };
window.PDEF.oh = {
  bersama: [['Opex bersama basecamp', 31150000, '']], porsi: { SCP: 1 / 3, AMP: 1 / 3, CMP: 1 / 3, PCP: 0 },
  unit: { SCP: { thn: [['Overhead unit', 54700000, '']] }, AMP: { thn: [['Overhead unit', 94800000, '']] }, CMP: { thn: [['Overhead unit', 78000000, '']] }, PCP: { thn: [], khusus: [['Opex khusus PCP', 5125000, '']] } }
};
const OH_F = { bersama: 1, thn: 1, khusus: 1, akt: 1, depr: 1, pakai: 1, aktBln: 1, aktPer: 1, deprBln: 1, deprPer: 1 };
function ohApply(b, x) {
  if (!x) return b;
  if (x.bersama) b.bersama = x.bersama;
  if (x.porsi) b.porsi = Object.assign({}, b.porsi, x.porsi);
  ['aktBln', 'aktPer', 'deprBln', 'deprPer'].forEach(k => { if (x[k] != null) b[k] = x[k]; });
  OH_U.forEach(u => { if (x.unit && x.unit[u]) { b.unit[u] = b.unit[u] || {}; Object.keys(x.unit[u]).forEach(k => { if (OH_F[k]) b.unit[u][k] = x.unit[u][k]; }); } });
  return b;
}
function ohMerge() { const d = get(OH_ID), b = clone(window.PDEF.oh); if (d) { ohApply(b, clone(d.acuan || null)); ohApply(b, clone(d)); } return b; }
const ohAcuan = () => { const d = get(OH_ID), b = clone(window.PDEF.oh); return d ? ohApply(b, clone(d.acuan || null)) : b; };
/* semua komponen overhead satu unit; bln = Rp per bulan. total/hari = hanya komponen yang dihitung ke HPP */
function ohCalc(u, p) {
  const o = p.oh, x = o.unit[u] || {}, g = p.global, hari = +g.hari || 25, bulan = +g.bulan || 12, pr = +o.porsi[u] || 0;
  const on = Object.assign({}, OH_ON, x.pakai || {});
  const aktBln = +x.aktBln || +o.aktBln || 12, deprBln = +x.deprBln || +o.deprBln || 12;
  const row = (r, f) => ({ n: r[0], raw: +r[1] || 0, ket: r[2] || '', bln: (+r[1] || 0) * f });
  const src = {
    bersama: (o.bersama || []).map(r => row(r, pr)), thn: (x.thn || []).map(r => row(r, 1 / bulan)), khusus: (x.khusus || []).map(r => row(r, 1)),
    akt: (x.akt || []).map(r => row(r, 1 / aktBln)), depr: (x.depr || []).map(r => row(r, 1 / deprBln))
  };
  const G = OH_K.map(k => { const bln = sum(src[k], 'bln'); return Object.assign({ k, on: !!on[k], rows: src[k], bln, hari: bln / hari, thn: bln * bulan }, OH_G[k]); });
  const inc = sum(G.filter(q => q.on), 'bln'), manual = x.manual != null ? +x.manual : null;
  return { u, G, g: Object.fromEntries(G.map(q => [q.k, q])), porsi: pr, aktBln, deprBln, aktPer: x.aktPer || o.aktPer || '', deprPer: x.deprPer || o.deprPer || '', hariKerja: hari, bulan, manual, bln: manual != null ? manual * hari : inc, hari: manual != null ? manual : inc / hari, thn: (manual != null ? manual * hari : inc) * bulan };
}
const ohOf = u => memo('oh' + u, () => ohCalc(u, params()));
const ohItemNames = un => [...new Set(un === 'Bersama' ? (params().oh.bersama || []).map(r => r[0]) : OH_U.includes(un) ? ohOf(un).G.filter(q => q.k !== 'bersama' && q.k !== 'depr').flatMap(q => q.rows.map(r => r.n)) : [])];
const ohSat = u => ({ AMP: 'Ton', CMP: 'M3', SCP: 'Ton', PCP: 'M3 beton' }[u]);
/* bagian overhead untuk rincian BUASO: baris ringkas (opex bersama digabung, sisanya per uraian) dengan porsi terhadap total */
function ohShares(u) {
  const c = ohOf(u); if (c.manual != null || !(c.bln > 0)) return [];
  const out = [];
  c.G.filter(q => q.on).forEach(q => {
    if (q.k === 'bersama' || q.k === 'depr') { if (q.bln) out.push({ n: q.t + (q.k === 'bersama' ? ' (porsi ' + pct(c.porsi) + ')' : ''), bln: q.bln, kode: q.kode }); }
    else q.rows.filter(r => r.bln).forEach(r => out.push({ n: (q.k === 'thn' ? 'Overhead unit - ' : q.k === 'akt' ? 'Akunting - ' : '') + r.n, bln: r.bln, kode: q.kode }));
  });
  return out.map(r => Object.assign(r, { p: r.bln / c.bln }));
}
function saveOh(mut) {
  const d = clone(get(OH_ID) || {});
  delete d.id; Object.keys(d).forEach(k => { if (k[0] === '_') delete d[k]; });
  mut(d); save('param', d, OH_ID);
}
const saveOhUnit = (u, data) => {
  saveOh(d => { d.unit = d.unit || {}; d.unit[u] = Object.assign({}, d.unit[u], data); });
  const pd = get(PARAM_ID); if (pd && pd.unit && pd.unit[u] && pd.unit[u].oh != null) saveParams(x => { delete x.unit[u].oh; }); // angka gelondongan lama
};
const OG = fn => gated('Overhead per Unit', fn);

/* ---------- tampilan ---------- */
const oz = n => Math.abs(+n || 0) < 0.5 ? '-' : rp(n);
const onChip = q => q.on ? chip('Masuk HPP', 'ok') : chip('Tidak dihitung', 'mute');
function ohBasis(q, r, c) {
  return q.k === 'bersama' ? rp(r.raw) + ' / bulan x ' + pct(c.porsi) : q.k === 'thn' ? rp(r.raw) + ' / tahun : ' + num(c.bulan) : q.k === 'khusus' ? rp(r.raw) + ' / bulan' : rp(r.raw) + ' : ' + num(q.k === 'akt' ? c.aktBln : c.deprBln) + ' bulan';
}
function ohNote(q, c) {
  if (q.k === 'bersama') return 'Biaya bersama basecamp dibagi ke unit menurut porsi alokasi.';
  if (q.k === 'akt') return 'Realisasi pembukuan akunting' + (c.aktPer ? ' ' + c.aktPer : '') + ', dibagi ' + num(c.aktBln) + ' bulan. Sebagian isinya sama dengan opex bersama dan overhead unit, jadi aktifkan hanya bila tidak dobel.';
  if (q.k === 'depr') return 'Total penyusutan' + (c.deprPer ? ' ' + c.deprPer : '') + ' dibagi ' + num(c.deprBln) + ' bulan (aset berlokasi di basecamp ini).';
  return '';
}
function ohUnitHtml(u, inHpp) {
  const c = ohOf(u), d = daily(u), kap = d.kapEf || 1, S_ = ohSat(u);
  const grp = c.G.map(q => '<tr><td class="c">' + q.kode + '</td><td class="strong">' + esc(q.t) + '</td><td>' + onChip(q) + '</td><td class="n">' + num(q.rows.filter(r => r.bln).length) + '</td><td class="n">' + oz(q.thn) + '</td><td class="n">' + oz(q.bln) + '</td><td class="n">' + oz(q.hari) + '</td><td class="n">' + oz(q.hari / kap) + '</td></tr>').join('');
  return (c.manual != null ? '<div class="note lock"><span>Overhead ' + u + ' memakai angka manual <b>' + rp(c.manual) + ' / hari</b>, bukan rincian di bawah.</span><button class="btn ghost sm" data-ohman>Pakai rincian</button></div>' : '') +
    '<div class="kpis">' + kpi('Overhead ' + u + ' per hari', rp(c.hari), 'masuk komponen O di HPP') + kpi('Per bulan', rp(c.bln), num(c.hariKerja) + ' hari kerja') + kpi('Per tahun', rp(c.thn)) + kpi('Per ' + S_, rp(c.hari / kap), 'kapasitas efektif ' + num(d.kapEf) + ' ' + S_ + '/hari') + '</div>' +
    '<section class="card"><div class="chead"><div>' + unitChip(u) + '<h3>Rekap overhead ' + esc(UNIT_NAME[u]) + '</h3></div><div class="cbtns"><button class="btn ghost sm" data-ohon>' + ic('edit') + 'Komponen yang masuk HPP</button>' + (inHpp ? '<button class="btn ghost sm" data-ohgo>' + ic('oh') + 'Menu Overhead per Unit</button>' : '') + '</div></div>' +
    '<div class="tbl"><table><thead><tr><th>Kode</th><th>Komponen overhead</th><th>Status</th><th class="n">Uraian</th><th class="n">Per tahun</th><th class="n">Per bulan</th><th class="n">Per hari</th><th class="n">Per ' + esc(S_) + '</th></tr></thead><tbody>' + grp +
    '<tr class="grand"><td></td><td colspan="3">TOTAL OVERHEAD ' + u + ' MASUK HPP</td><td class="n">' + rp(c.thn) + '</td><td class="n">' + rp(c.bln) + '</td><td class="n">' + rp(c.hari) + '</td><td class="n">' + rp(c.hari / kap) + '</td></tr></tbody></table></div></section>' +
    c.G.map(q => '<section class="card"><div class="chead"><div><h3>' + q.kode + '. ' + esc(q.t) + ' ' + u + '</h3>' + onChip(q) + '</div><button class="btn ghost sm" data-ohed="' + q.k + '">' + ic('edit') + 'Ubah</button></div>' +
      (ohNote(q, c) ? '<p class="muted sm ohn">' + esc(ohNote(q, c)) + '</p>' : '') +
      (q.k === 'bersama' && !c.porsi ? '<div class="empty"><p>Porsi opex bersama ' + u + ' 0%. Ubah di tab Opex Bersama &amp; Alokasi bila unit ini ikut menanggung.</p></div>' : q.rows.length ? '<div class="tbl"><table><thead><tr><th>No</th><th>Uraian</th><th>Dasar hitung</th><th class="n">Per tahun</th><th class="n">Per bulan</th><th class="n">Per hari</th><th class="n">Per ' + esc(S_) + '</th><th>Keterangan</th></tr></thead><tbody>' +
        q.rows.map((r, i) => '<tr><td class="c">' + (i + 1) + '</td><td class="strong">' + esc(r.n) + '</td><td class="muted">' + esc(ohBasis(q, r, c)) + '</td><td class="n">' + oz(r.bln * c.bulan) + '</td><td class="n">' + oz(r.bln) + '</td><td class="n">' + oz(r.bln / c.hariKerja) + '</td><td class="n">' + (r.bln ? num(r.bln / c.hariKerja / kap) : '-') + '</td><td class="muted wrap">' + esc(r.ket || '') + '</td></tr>').join('') +
        '<tr class="sub strong"><td></td><td colspan="2">Total ' + esc(q.t.toLowerCase()) + '</td><td class="n">' + rp(q.thn) + '</td><td class="n">' + rp(q.bln) + '</td><td class="n">' + rp(q.hari) + '</td><td class="n">' + num(q.hari / kap) + '</td><td></td></tr></tbody></table></div>'
        : '<div class="empty"><p>Belum ada data. Klik Ubah untuk mengisi.</p></div>') + '</section>').join('');
}
function ohRekapHtml() {
  const cs = OH_U.map(ohOf);
  const tot = f => sum(cs, f);
  const head = '<th class="n">' + OH_U.join('</th><th class="n">') + '</th><th class="n">Total</th>';
  const body = OH_K.map(k => {
    const names = []; cs.forEach(c => c.g[k].rows.forEach(r => { if (!names.includes(r.n)) names.push(r.n); }));
    const any = names.length;
    const val = (c, n) => sum(c.g[k].rows.filter(r => r.n === n), 'bln');
    return '<tr class="ohg"><td class="c">' + OH_G[k].kode + '</td><td>' + esc(OH_G[k].t) + '</td>' + cs.map(c => '<td class="n">' + oz(c.g[k].bln) + (c.g[k].on || !c.g[k].bln ? '' : '<small>tidak dihitung</small>') + '</td>').join('') + '<td class="n">' + oz(tot(c => c.g[k].bln)) + '</td></tr>' +
      (any ? names.filter(n => cs.some(c => val(c, n))).map(n => '<tr class="ohsub"><td></td><td>' + esc(n) + '</td>' + cs.map(c => '<td class="n">' + oz(val(c, n)) + '</td>').join('') + '<td class="n">' + oz(tot(c => val(c, n))) + '</td></tr>').join('') : '');
  }).join('');
  return '<div class="kpis">' + cs.map(c => kpi('Overhead ' + c.u + ' / hari', rp(c.hari), rp(c.hari / (daily(c.u).kapEf || 1)) + ' per ' + ohSat(c.u) + ' · ' + rpS(c.bln) + ' / bulan')).join('') + '</div>' +
    '<section class="card"><div class="chead"><h3>Rekap overhead per hari per unit</h3><div class="cmeta">klik baris untuk rincian unit</div></div><div class="tbl"><table><thead><tr><th>Unit</th><th class="n">O1 Opex bersama</th><th class="n">O2 Overhead unit</th><th class="n">O3 Opex khusus</th><th class="n">O4 Opex akunting</th><th class="n">O5 Depresiasi</th><th class="n">Total masuk HPP / hari</th><th class="n">Per bulan</th><th class="n">Per tahun</th><th class="n">Per satuan</th></tr></thead><tbody>' +
    cs.map(c => '<tr class="click" data-row="' + c.u + '"><td>' + unitChip(c.u) + ' ' + esc(UNIT_NAME[c.u]) + '</td>' + c.G.map(q => '<td class="n' + (q.on ? '' : ' muted') + '">' + oz(q.hari) + (q.on || !q.bln ? '' : '<small>tidak dihitung</small>') + '</td>').join('') + '<td class="n"><b>' + rp(c.hari) + '</b></td><td class="n">' + rp(c.bln) + '</td><td class="n">' + rp(c.thn) + '</td><td class="n">' + rp(c.hari / (daily(c.u).kapEf || 1)) + '<small>/ ' + ohSat(c.u) + '</small></td></tr>').join('') +
    '<tr class="grand"><td>TOTAL</td>' + OH_K.map(k => '<td class="n">' + oz(tot(c => c.g[k].on ? c.g[k].hari : 0)) + '</td>').join('') + '<td class="n">' + rp(tot('hari')) + '</td><td class="n">' + rp(tot('bln')) + '</td><td class="n">' + rp(tot('thn')) + '</td><td></td></tr></tbody></table></div></section>' +
    '<section class="card"><div class="chead"><h3>Rincian overhead per unit (Rp / bulan)</h3><div class="cmeta">opex bersama sudah dibagi menurut porsi</div></div><div class="tbl"><table class="ohm"><thead><tr><th>Kode</th><th>Uraian</th>' + head + '</tr></thead><tbody>' + body +
    '<tr class="grand"><td></td><td>TOTAL MASUK HPP PER BULAN</td>' + cs.map(c => '<td class="n">' + rp(c.bln) + '</td>').join('') + '<td class="n">' + rp(tot('bln')) + '</td></tr></tbody></table></div></section>';
}
/* basecamp selain Bugel memakai acuan Bugel sampai datanya diisi sendiri */
function ohAsal() { const d = get(OH_ID) || {}; return /Bugel/i.test(BC) || d.bersama || d.unit ? '' : '<div class="note">Angka awal memakai acuan RAPU Basecamp Bugel. Sesuaikan dengan biaya ' + esc(BC) + ' lewat tombol Ubah; HPP dan Price List langsung mengikuti.</div>'; }
function ohBersamaHtml() {
  const p = params(), o = p.oh, tot = sum(o.bersama || [], r => +r[1] || 0), hari = +p.global.hari || 25, tp = sum(OH_U, u => +o.porsi[u] || 0);
  return '<section class="card"><div class="chead"><h3>Alokasi opex bersama ke unit</h3><button class="btn ghost sm" data-ohporsi>' + ic('edit') + 'Ubah porsi</button></div>' +
    table([{ t: 'Unit', f: r => unitChip(r.id) + ' ' + esc(UNIT_NAME[r.id]), raw: true }, { t: 'Porsi', f: r => pct(r.p), num: true }, { t: 'Rp / bulan', f: r => oz(r.p * tot), num: true }, { t: 'Rp / hari', f: r => oz(r.p * tot / hari), num: true }], OH_U.map(u => ({ id: u, p: +o.porsi[u] || 0 }))) +
    '<div class="cfoot">Total porsi: <b>' + pct(tp) + '</b> ' + (Math.abs(tp - 1) < 0.001 ? chip('OK', 'ok') : chip('Harus 100%', 'bad')) + '</div></section>' +
    '<section class="card"><div class="chead"><h3>Opex bersama ' + esc(BC) + ' (per bulan)</h3><button class="btn ghost sm" data-ohed="bersama">' + ic('edit') + 'Ubah</button></div>' +
    '<div class="tbl"><table><thead><tr><th>No</th><th>Uraian opex</th><th class="n">Rp / bulan</th><th class="n">Rp / hari</th><th>Keterangan</th></tr></thead><tbody>' + (o.bersama || []).map((r, i) => '<tr><td class="c">' + (i + 1) + '</td><td class="strong">' + esc(r[0]) + '</td><td class="n">' + oz(r[1]) + '</td><td class="n">' + oz(r[1] / hari) + '</td><td class="muted wrap">' + esc(r[2] || '') + '</td></tr>').join('') +
    '<tr class="grand"><td></td><td>TOTAL OPEX BERSAMA</td><td class="n">' + rp(tot) + '</td><td class="n">' + rp(tot / hari) + '</td><td></td></tr></tbody></table></div></section>';
}
/* realisasi: kas keluar kategori Overhead & Operasional yang ditandai unitnya, dibanding anggaran */
function ohReal(month) {
  const p = params(), ks = all('kas').filter(k => k.arah === 'keluar' && k.kat === 'Overhead & Operasional' && inMonth(k.tgl, month));
  const tb = sum(ks.filter(k => k.ohUnit === 'Bersama'), 'jumlah');
  const units = OH_U.map(u => {
    const c = ohOf(u), ag = sum(c.G.filter(q => q.on && q.k !== 'depr' && q.k !== 'bersama'), 'bln'), ab = c.g.bersama.on ? c.g.bersama.bln : 0;
    const rl = sum(ks.filter(k => k.ohUnit === u), 'jumlah'), rb = tb * (+p.oh.porsi[u] || 0);
    return { id: u, ang: ag + ab, rl, rb, real: rl + rb };
  });
  const items = {};
  const put = (un, n, ang, real) => { const k = un + '|' + n; items[k] = items[k] || { id: k, un, n, ang: 0, real: 0 }; items[k].ang += ang; items[k].real += real; };
  (p.oh.bersama || []).forEach(r => put('Bersama', r[0], +r[1] || 0, 0));
  OH_U.forEach(u => ohOf(u).G.filter(q => q.on && q.k !== 'depr' && q.k !== 'bersama').forEach(q => q.rows.forEach(r => put(u, r.n, r.bln, 0))));
  ks.filter(k => k.ohUnit).forEach(k => put(k.ohUnit, k.ohItem || 'Lain-lain (tanpa uraian)', 0, +k.jumlah || 0));
  return { ks, units, items: Object.values(items).filter(r => r.ang || r.real), none: ks.filter(k => !k.ohUnit) };
}
function ohRealHtml(s) {
  s = Object.assign({}, s, { month: s.month || curMonth() });
  const R = ohReal(s.month), ang = sum(R.units, 'ang'), real = sum(R.units, 'real'), un = s.unit2 || '';
  const sel = (r) => { const d = r.ang - r.real; return '<span class="' + (d < -0.5 ? 't-bad' : '') + '">' + (Math.abs(d) < 0.5 ? '-' : (d < 0 ? '-' : '') + rp(Math.abs(d))) + '</span>'; };
  return '<div class="kpis">' + kpi('Anggaran overhead', rpS(ang), monthLabel(s.month || curMonth())) + kpi('Realisasi', rpS(real), 'dari Cash Flow', real > ang ? 'bad' : '') + kpi('Sisa anggaran', rpS(ang - real), ang ? pct(real / ang) + ' terpakai' : '', ang - real < 0 ? 'bad' : 'good') + kpi('Belum ditandai unit', R.none.length, rpS(sum(R.none, 'jumlah')), R.none.length ? 'warn' : '') + '</div>' +
    '<div class="note">Realisasi diambil dari Cash Flow Unit › Uang Keluar kategori <b>Overhead &amp; Operasional</b> yang diisi Unit-nya. Biaya <b>Bersama</b> dibagi ke unit menurut porsi alokasi. Depresiasi tidak termasuk karena bukan pengeluaran kas.</div>' +
    '<section class="card"><div class="chead"><h3>Anggaran vs realisasi per unit</h3><div class="cmeta">' + monthLabel(s.month || curMonth()) + '</div></div>' + table([
      { t: 'Unit', f: r => unitChip(r.id) + ' ' + esc(UNIT_NAME[r.id]), raw: true }, { t: 'Anggaran / bulan', f: r => rp(r.ang), num: true }, { t: 'Realisasi langsung', f: r => oz(r.rl), num: true }, { t: 'Bagian opex bersama', f: r => oz(r.rb), num: true }, { t: 'Total realisasi', f: r => '<b>' + oz(r.real) + '</b>', num: true, raw: true }, { t: 'Selisih', f: sel, num: true, raw: true }, { t: 'Terpakai', f: r => r.ang ? pct(r.real / r.ang) : '-', num: true }], R.units) + '</section>' +
    '<section class="card"><div class="chead"><h3>Anggaran vs realisasi per uraian</h3></div>' + table([
      { t: 'Unit', f: r => r.un === 'Bersama' ? chip('Bersama', 'info') : unitChip(r.un), raw: true }, { t: 'Uraian', f: r => r.n, cls: 'strong' }, { t: 'Anggaran / bulan', f: r => oz(r.ang), num: true }, { t: 'Realisasi', f: r => oz(r.real), num: true }, { t: 'Selisih', f: sel, num: true, raw: true }],
      R.items.filter(r => (!un || r.un === un) && qMatch(s.q, r.n)), { empty: 'Belum ada data.' }) + '</section>' +
    (R.none.length ? '<section class="card"><div class="chead"><h3>Transaksi overhead belum ditandai unit</h3><div class="cmeta">klik untuk mengisi unit</div></div>' + table([{ t: 'Tanggal', f: k => tgl(k.tgl) }, { t: 'Uraian', f: k => k.ket || k.kat, cls: 'wrap' }, { t: 'Pihak', f: k => k.pihak || '-' }, { t: 'Jumlah', f: k => rp(k.jumlah), num: true }], byDateDesc(R.none), { rowAttr: k => 'class="click" data-kas="' + esc(k.id) + '"' }) + '</section>' : '');
}
function ohBind(el, u) {
  $$('[data-ohed]', el).forEach(b => b.onclick = () => OG(b.dataset.ohed === 'bersama' ? ohBersamaForm : ohRowsForm)(u, b.dataset.ohed));
  const pb = $('[data-ohporsi]', el); if (pb) pb.onclick = () => OG(ohPorsiForm)();
  const on = $('[data-ohon]', el); if (on) on.onclick = () => OG(ohPakaiForm)(u);
  const mn = $('[data-ohman]', el); if (mn) mn.onclick = () => OG(() => { saveOhUnit(u, {}); toast('Overhead ' + u + ' memakai rincian'); })();
  const go = $('[data-ohgo]', el); if (go) go.onclick = () => { stateOf('oh', { tab: 'unit', unit: u }); ST.oh.tab = 'unit'; ST.oh.unit = u; persist('oh'); location.hash = '#/oh'; };
}

/* ---------- formulir ---------- */
const ohCols = t => [{ k: 'a', label: 'Uraian', w: '42%' }, { k: 'b', label: t, num: true }, { k: 'c', label: 'Keterangan', w: '28%' }];
const ohMap = rows => (rows || []).map(r => ({ a: r[0], b: r[1], c: r[2] || '' }));
const ohBack = rows => (rows || []).filter(r => r.a && String(r.a).trim()).map(r => [String(r.a).trim(), +r.b || 0, r.c || '']);
const ohTot = rows => sum(rows || [], r => +r.b || 0);
const ohReset = (txt, fn) => ({ html: '<button type="button" class="btn ghost" data-rst>' + ic('refresh') + 'Kembalikan acuan RAPU</button>', bind: (f, x, m) => $('[data-rst]', f).onclick = async () => { if (await confirmBox('Kembalikan acuan', txt, 'Kembalikan', false)) { fn(); m.close(); toast('Dikembalikan ke acuan RAPU'); } } });
function ohBersamaForm() {
  const o = params().oh;
  openForm({
    title: 'Opex Bersama ' + BC, sub: 'Rp per bulan, dibagi ke unit menurut porsi alokasi. HPP dan Price List semua unit ikut berubah.', wide: true, value: { rows: ohMap(o.bersama) },
    fields: [{ k: 'rows', type: 'items', cols: ohCols('Rp / bulan'), newRow: () => ({}) }, { k: 'tot', type: 'html', html: v => { const t = ohTot(v.rows); return '<div class="buaso"><div class="tot"><span>Total per bulan</span><b>' + rp(t) + '</b></div>' + OH_U.map(u => '<div><span>' + u + ' ' + pct(o.porsi[u]) + '</span><b>' + rp(t * (+o.porsi[u] || 0)) + '</b></div>').join('') + '</div>'; } }],
    extraBtn: get(OH_ID) ? ohReset('Opex bersama dikembalikan ke nilai acuan sheet RAPU-BUASO.', () => saveOh(d => { delete d.bersama; })) : null,
    onSave: v => { saveOh(d => { d.bersama = ohBack(v.rows); }); toast('Opex bersama tersimpan — HPP dan price list diperbarui'); }
  });
}
function ohPorsiForm() {
  const o = params().oh, v = {}; OH_U.forEach(u => v[u] = Math.round((+o.porsi[u] || 0) * 1e6) / 1e4);
  openForm({
    title: 'Porsi Alokasi Opex Bersama', sub: 'Jumlah seluruh porsi harus 100%', small: true, value: v,
    fields: OH_U.map(u => ({ k: u, label: u + ' - ' + UNIT_NAME[u], type: 'num', suffix: '%' })).concat([{ k: 'tot', type: 'html', html: x => '<div class="cfoot">Total porsi: <b>' + num(sum(OH_U, u => +x[u] || 0)) + '%</b></div>' }]),
    extraBtn: ohReset('Porsi dikembalikan ke acuan sheet RAPU-BUASO.', () => saveOh(d => { delete d.porsi; })),
    onSave: x => {
      const t = sum(OH_U, u => +x[u] || 0);
      if (OH_U.some(u => (+x[u] || 0) < 0)) { toast('Porsi tidak boleh negatif', 'err'); return false; }
      if (Math.abs(t - 100) > 0.05) { toast('Total porsi ' + num(t) + '%, harus 100%', 'err'); return false; }
      saveOh(d => { d.porsi = {}; OH_U.forEach(u => d.porsi[u] = (+x[u] || 0) / t); }); toast('Porsi alokasi tersimpan — HPP semua unit diperbarui');
    }
  });
}
function ohRowsForm(u, k) {
  const c = ohOf(u), x = params().oh.unit[u] || {}, q = OH_G[k], per = k === 'akt' || k === 'depr';
  const bl = v => k === 'thn' ? c.bulan : per ? (+v.bln || 1) : 1, kap = daily(u).kapEf || 1;
  openForm({
    title: q.t + ' — ' + u, sub: UNIT_NAME[u] + (k === 'thn' ? ' · Rp per tahun' : k === 'khusus' ? ' · Rp per bulan' : ' · total Rp selama periode'), wide: true,
    value: { rows: ohMap(x[k]), bln: k === 'akt' ? c.aktBln : c.deprBln, per: k === 'akt' ? c.aktPer : c.deprPer },
    fields: [].concat(per ? [{ k: 'per', label: 'Periode data', placeholder: 'mis. Januari - Agustus 2026' }, { k: 'bln', label: 'Jumlah bulan periode (pembagi)', type: 'num', req: true, suffix: 'bulan' }] : [],
      [{ k: 'rows', type: 'items', cols: ohCols(k === 'thn' ? 'Rp / tahun' : k === 'khusus' ? 'Rp / bulan' : 'Total periode (Rp)'), newRow: () => ({}) }, { k: 'tot', type: 'html', html: v => { const t = ohTot(v.rows), m = t / bl(v), h = m / c.hariKerja; return '<div class="buaso"><div class="tot"><span>Total</span><b>' + rp(t) + '</b></div><div><span>Per bulan</span><b>' + rp(m) + '</b></div><div><span>Per hari</span><b>' + rp(h) + '</b></div><div><span>Per ' + esc(ohSat(u)) + '</span><b>' + rp(h / kap) + '</b></div></div>'; } }]),
    extraBtn: ohReset(q.t + ' ' + u + ' dikembalikan ke nilai acuan sheet RAPU-BUASO.', () => saveOh(d => { if (d.unit && d.unit[u]) { delete d.unit[u][k]; delete d.unit[u][k + 'Bln']; delete d.unit[u][k + 'Per']; } })),
    onSave: v => { const data = { [k]: ohBack(v.rows) }; if (per) { data[k + 'Bln'] = +v.bln || 1; data[k + 'Per'] = v.per || ''; } saveOhUnit(u, data); toast(q.t + ' ' + u + ' tersimpan' + (c.g[k].on ? ' — HPP dan price list diperbarui' : '')); }
  });
}
function ohPakaiForm(u) {
  const c = ohOf(u), v = {}; OH_K.forEach(k => v[k] = c.g[k].on);
  const kap = daily(u).kapEf || 1;
  openForm({
    title: 'Komponen Overhead ' + u + ' yang Masuk HPP', sub: 'Yang tidak dicentang tetap tersimpan sebagai data evaluasi', value: v,
    fields: OH_K.map(k => ({ k, type: 'check', full: true, text: OH_G[k].kode + '. ' + OH_G[k].t + ' — ' + rp(c.g[k].hari) + ' / hari' })).concat([{ k: 'tot', type: 'html', html: x => { const h = sum(OH_K.filter(k => x[k]), k => c.g[k].hari); return '<div class="buaso"><div><span>Sekarang / hari</span><b>' + rp(c.hari) + '</b><small>' + rp(c.hari / kap) + ' per ' + ohSat(u) + '</small></div><div class="tot"><span>Menjadi / hari</span><b>' + rp(h) + '</b></div><div><span>Dampak HPP per ' + ohSat(u) + '</span><b>' + (h - c.hari < -0.5 ? '-' : '+') + rp(Math.abs(h - c.hari) / kap) + '</b></div></div>' + ((x.akt && (x.bersama || x.thn || x.khusus)) ? '<div class="note">Opex akunting (O4) sebagian sama dengan O1 sampai O3. Bila keduanya dicentang, biaya bisa terhitung dobel.</div>' : '') + (x.depr && u === 'PCP' ? '<div class="note">Biaya maintenance PCP (A) sudah memuat penyusutan cetakan baja. Pastikan tidak terhitung dobel.</div>' : ''); } }]),
    onSave: x => { const pk = {}; OH_K.forEach(k => pk[k] = !!x[k]); saveOhUnit(u, { pakai: pk }); toast('Komponen overhead ' + u + ' tersimpan — HPP dan price list diperbarui'); }
  });
}

/* ---------- kartu ---------- */
MODS.oh = {
  title: 'Overhead per Unit', icon: 'oh', desc: 'Rincian overhead AMP, CMP, SCP, dan PCP — sumber komponen O di HPP, BUASO, dan Price List',
  render(root) {
    const st = stateOf('oh', { tab: 'rekap', unit: 'AMP', q: '', month: curMonth(), unit2: '' });
    if (!OH_U.includes(st.unit)) st.unit = 'AMP';
    if (st.month === undefined) st.month = curMonth();
    return page(root, {
      key: 'oh', st, report: ohReport,
      tabs: [{ k: 'rekap', t: 'Rekap Semua Unit' }, { k: 'unit', t: 'Rincian per Unit' }, { k: 'bersama', t: 'Opex Bersama & Alokasi' }, { k: 'real', t: 'Realisasi Bulanan' }],
      actions: [{ id: 'hpp', t: 'HPP & BUASO', icon: 'scale' }, { id: 'kas', t: 'Catat Pengeluaran Overhead', icon: 'out' }],
      on: { hpp: () => { location.hash = '#/hpp'; }, kas: s => kasForm(null, { arah: 'keluar', kat: 'Overhead & Operasional', ohUnit: s.tab === 'unit' ? s.unit : '' }) },
      filter: s => s.tab === 'unit' ? '<div class="fbar"><div class="seg" data-ps="unit">' + OH_U.map(u => '<button class="' + (s.unit === u ? 'on' : '') + '" data-v="' + u + '">' + u + ' · ' + UNIT_PROD[u] + '</button>').join('') + '</div></div>'
        : s.tab === 'real' ? periodBar(Object.assign({}, s, { units: false }), null, '<select data-fk="unit2"><option value="">Semua unit</option>' + ['Bersama'].concat(OH_U).map(u => '<option' + (s.unit2 === u ? ' selected' : '') + '>' + u + '</option>').join('') + '</select>') : '',
      bindFilter: (el, s, redraw) => $$('[data-ps] button', el).forEach(b => b.onclick = () => { s.unit = b.dataset.v; persist('oh'); redraw(); }),
      body: s => editBadge('Overhead per Unit') + (s.tab === 'unit' ? ohUnitHtml(s.unit) : s.tab === 'bersama' ? ohAsal() + ohBersamaHtml() : s.tab === 'real' ? ohRealHtml(s) : ohAsal() + ohRekapHtml()),
      bind: (el, s) => {
        ohBind(el, s.unit); bindRelock(el);
        if (s.tab === 'rekap') $$('[data-row]', el).forEach(tr => tr.onclick = () => { s.unit = tr.dataset.row; s.tab = 'unit'; persist('oh'); MODS.oh.render($('#main')); });
        $$('[data-kas]', el).forEach(tr => tr.onclick = () => kasForm(get(tr.dataset.kas)));
      }
    });
  },
  summary() { return { main: OH_U.map(ohOf).length ? rpS(sum(OH_U, u => ohOf(u).bln)) + ' / bulan' : '', sub: OH_U.map(u => u + ' ' + rpS(ohOf(u).hari)).join(' · ') + ' per hari' }; }
};
function ohPdfUnit(R, u) {
  const c = ohOf(u), kap = daily(u).kapEf || 1;
  R.h2('Overhead ' + u + ' - ' + UNIT_NAME[u], 'Rp ' + R_(c.hari) + ' / hari = Rp ' + R_(c.hari / kap) + ' / ' + ohSat(u));
  const body = [];
  c.G.filter(q => q.rows.some(r => r.bln)).forEach(q => {
    body.push([{ content: q.kode, styles: { fontStyle: 'bold', halign: 'center', fillColor: [232, 237, 244] } }, { content: q.t + (q.on ? '' : ' (tidak dihitung ke HPP)'), styles: { fontStyle: 'bold', fillColor: [232, 237, 244] } }, ...[q.thn, q.bln, q.hari, q.hari / kap].map(v => ({ content: R_(v), styles: { halign: 'right', fontStyle: 'bold', fillColor: [232, 237, 244] } })), { content: '', styles: { fillColor: [232, 237, 244] } }]);
    q.rows.filter(r => r.bln).forEach((r, i) => body.push([{ content: String(i + 1), styles: center }, r.n, cellR(R_(r.bln * c.bulan)), cellR(R_(r.bln)), cellR(R_(r.bln / c.hariKerja)), cellR(N_(r.bln / c.hariKerja / kap)), ohBasis(q, r, c) + (r.ket ? ' - ' + r.ket : '')]));
  });
  R.table(['No', 'Uraian', 'Per tahun', 'Per bulan', 'Per hari', 'Per ' + ohSat(u), 'Dasar hitung'], body, { fs: 7.2, cs: { 0: { cellWidth: 10 }, 6: { cellWidth: 78 } }, foot: ['', 'Total masuk HPP' + (c.manual != null ? ' (angka manual)' : ''), cellR(R_(c.thn)), cellR(R_(c.bln)), cellR(R_(c.hari)), cellR(N_(c.hari / kap)), ''] });
}
async function ohReport(s) {
  const one = s.tab === 'unit', us = one ? [s.unit] : OH_U, cs = OH_U.map(ohOf);
  if (s.tab === 'real') {
    const R = await pdfReport({ title: 'Realisasi Overhead per Unit', sub: BC + ' · ' + monthLabel(s.month || curMonth()), orient: 'l', fname: 'Realisasi_Overhead_' + (s.month || curMonth()) }), D = ohReal(s.month || curMonth());
    R.kv([['Anggaran', 'Rp ' + R_(sum(D.units, 'ang'))], ['Realisasi', 'Rp ' + R_(sum(D.units, 'real'))], ['Selisih', 'Rp ' + R_(sum(D.units, 'ang') - sum(D.units, 'real'))], ['Belum ditandai unit', D.none.length + ' transaksi']]);
    R.h2('Per unit'); R.table(['Unit', 'Anggaran / bulan', 'Realisasi langsung', 'Bagian opex bersama', 'Total realisasi', 'Selisih'], D.units.map(r => [r.id].concat([r.ang, r.rl, r.rb, r.real, r.ang - r.real].map(v => cellR(R_(v))))));
    R.h2('Per uraian'); R.table(['Unit', 'Uraian', 'Anggaran / bulan', 'Realisasi', 'Selisih'], D.items.map(r => [r.un, r.n].concat([r.ang, r.real, r.ang - r.real].map(v => cellR(R_(v))))));
    R.sign(); return R.save();
  }
  const R = await pdfReport({ title: 'Overhead per Unit' + (one ? ' ' + s.unit : ''), sub: BC + ' · per ' + tgl(today(), true) + ' · ' + num(params().global.hari) + ' hari kerja / bulan', orient: 'l', fname: 'Overhead_' + (one ? s.unit : 'Semua_Unit') });
  if (!one) {
    R.h2('Rekap overhead per hari per unit');
    R.table(['Unit', 'Opex bersama', 'Overhead unit', 'Opex khusus', 'Opex akunting', 'Depresiasi', 'Total masuk HPP / hari', 'Per bulan', 'Per tahun', 'Per satuan'], cs.map(c => [c.u].concat(c.G.map(q => cellR(R_(q.hari) + (q.on || !q.bln ? '' : ' *')))).concat([{ content: R_(c.hari), styles: { halign: 'right', fontStyle: 'bold' } }, cellR(R_(c.bln)), cellR(R_(c.thn)), cellR(R_(c.hari / (daily(c.u).kapEf || 1)) + ' / ' + ohSat(c.u))])), { foot: ['Total'].concat(OH_K.map(k => cellR(R_(sum(cs, c => c.g[k].on ? c.g[k].hari : 0)))), ['hari', 'bln', 'thn'].map(k => cellR(R_(sum(cs, k)))), ['']) });
    if (cs.some(c => c.G.some(q => !q.on && q.bln))) R.para('* Data evaluasi, tidak dihitung ke HPP.', 7.6);
    const o = params().oh, t = sum(o.bersama, r => +r[1] || 0);
    R.h2('Opex bersama ' + BC + ' (per bulan)', 'Porsi: ' + OH_U.map(u => u + ' ' + pct(o.porsi[u])).join(', '));
    R.table(['No', 'Uraian', 'Rp / bulan', 'Keterangan'], o.bersama.map((r, i) => [i + 1, r[0], cellR(R_(r[1])), r[2] || '']), { fs: 7.2, foot: ['', 'Total', cellR(R_(t)), ''], cs: { 0: { halign: 'center', cellWidth: 10 } } });
  }
  us.forEach(u => ohPdfUnit(R, u));
  R.sign([['Dibuat oleh,', S.user.name], ['Diperiksa oleh,', ''], ['Disetujui oleh,', '']]);
  await R.save();
}
