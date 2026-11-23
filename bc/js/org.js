/* Kartu 15 Struktur Organisasi Basecamp Bawen: bagan jabatan, garis komando & koordinasi, personil (terhubung ke Man Power). */
'use strict';
const ORG_ID = 'orgBawen01';
/* [id, jabatan, unit, atasan, formasi, koordinasi[], uraian tugas] — susunan lazim basecamp produksi; formasi mengikuti rincian upah RAPU-BUASO */
const ORG_DEF = [
  ['kp', 'Kepala Plant / Kepala Basecamp', 'Umum', '', 1, [], 'Penanggung jawab seluruh operasional ' + BC + ': produksi, mutu, K3, biaya, dan target unit.'],
  ['kpAMP', 'Kepala Produksi & Laboratorium AMP', 'AMP', 'kp', 1, ['log', 'ks', 'mkt'], 'Rencana & realisasi produksi hotmix, job mix formula, uji mutu laboratorium aspal.'],
  ['kpCMP', 'Kepala Produksi & Laboratorium CMP', 'CMP', 'kp', 1, ['log', 'ks', 'mkt'], 'Produksi beton readymix, job mix design, uji slump & kuat tekan beton.'],
  ['kpSCP', 'Kepala Produksi & Laboratorium SCP', 'SCP', 'kp', 1, ['log', 'kpAMP', 'kpCMP'], 'Produksi agregat stone crusher, gradasi & stok agregat untuk AMP, CMP, dan retail.'],
  ['kpPCP', 'Kepala Produksi & QC Precast PCP', 'PCP', 'kp', 1, ['log', 'kpCMP', 'mkt'], 'Produksi precast, cetakan, tulangan, dan quality control produk.'],
  ['ks', 'Kepala Koordinator Sopir', 'Umum', 'kp', 1, ['kpAMP', 'kpCMP', 'mkt'], 'Mengatur armada, ritase, jadwal pengiriman, dan disiplin sopir.'],
  ['log', 'Logistik (Gudang & Material)', 'Umum', 'kp', 1, ['kpAMP', 'kpCMP', 'kpSCP', 'kpPCP'], 'Penerimaan material, stok gudang, BPPB, BBM, dan stock opname.'],
  ['sec', 'Security', 'Umum', 'kp', 3, ['log'], 'Keamanan basecamp, pencatatan keluar-masuk kendaraan dan material.'],
  ['keb', 'Harian Kebersihan', 'Umum', 'kp', 1, [], 'Kebersihan area kantor, mess, dan lingkungan basecamp.'],
  ['mkt', 'Marketing Unit', 'Umum', 'kp', 1, ['ks', 'kpAMP', 'kpCMP', 'kpPCP'], 'Mencari proyek, penawaran harga, sales order, dan penagihan bersama keuangan.'],
  ['opAMP', 'Operator Produksi AMP', 'AMP', 'kpAMP', 1, [], 'Mengoperasikan plant AMP sesuai job mix formula.'],
  ['ldAMP', 'Operator Loader AMP', 'AMP', 'kpAMP', 1, ['log'], 'Pengisian cold bin dan penataan stockpile agregat.'],
  ['hpAMP', 'Helper AMP (Genset, Ketel, Filler, Cold Bin)', 'AMP', 'kpAMP', 4, [], 'Membantu operasional genset, ketel aspal, filler, dan cold bin.'],
  ['opCMP', 'Operator Produksi CMP (Batching Plant)', 'CMP', 'kpCMP', 1, ['ks'], 'Mengoperasikan batching plant sesuai job mix design.'],
  ['ldCMP', 'Operator Loader CMP', 'CMP', 'kpCMP', 1, ['log'], 'Pengisian bin agregat dan pasir.'],
  ['hpCMP', 'Helper CMP', 'CMP', 'kpCMP', 3, [], 'Membantu operasional batching, kebersihan mixer, dan sampling.'],
  ['opSCP', 'Operator Produksi SCP (Crusher)', 'SCP', 'kpSCP', 1, [], 'Mengoperasikan jaw/cone crusher, screen, dan conveyor.'],
  ['exSCP', 'Operator Alat Berat Excavator', 'SCP', 'kpSCP', 1, ['log'], 'Pemuatan batu ke feeder dan penataan quarry.'],
  ['ldSCP', 'Operator Alat Berat Loader SCP', 'SCP', 'kpSCP', 1, ['log', 'ks'], 'Pemindahan hasil produksi dan pemuatan ke dump truck.'],
  ['hpSCP', 'Helper SCP', 'SCP', 'kpSCP', 3, [], 'Membantu pembersihan crusher, screen, dan conveyor.'],
  ['opPCP', 'Operator Gantry / Forklift PCP', 'PCP', 'kpPCP', 1, ['log'], 'Angkat, bongkar cetakan, dan stacking produk precast.'],
  ['tbPCP', 'Tukang Besi PCP', 'PCP', 'kpPCP', 3, [], 'Fabrikasi tulangan dan wiremesh.'],
  ['tcPCP', 'Tukang Cor & Finishing PCP', 'PCP', 'kpPCP', 3, [], 'Pengecoran, pemadatan, finishing, dan curing.'],
  ['hpPCP', 'Helper PCP', 'PCP', 'kpPCP', 5, [], 'Bongkar-pasang cetakan, curing, dan stacking.'],
  ['sdt', 'Sopir Dump Truck', 'Umum', 'ks', 2, ['kpAMP', 'kpSCP'], 'Pengiriman hotmix dan agregat ke proyek.'],
  ['stm', 'Sopir Truck Mixer', 'CMP', 'ks', 4, ['kpCMP'], 'Pengiriman beton readymix ke proyek.'],
  ['sli', 'Sopir Dump Truck Langsir Internal', 'SCP', 'ks', 1, ['kpSCP'], 'Langsir bahan baku batu di area basecamp.']
];
function orgPos() {
  return memo('org', () => {
    const d = get(ORG_ID);
    if (d && Array.isArray(d.pos)) return d.pos.map(p => Object.assign({ kor: [], orang: [] }, p));
    return ORG_DEF.map(([id, jabatan, unit, atasan, formasi, kor, tugas], i) => ({ id, jabatan, unit, atasan, formasi, kor, tugas, urut: i + 1, orang: [] }));
  });
}
function orgSave(list, msg) { save('org', { pos: list.map((p, i) => Object.assign({}, p, { urut: p.urut || i + 1 })) }, ORG_ID); if (msg) toast(msg); }
const orgKids = (list, id) => list.filter(p => (p.atasan || '') === id).sort((a, b) => (a.urut || 0) - (b.urut || 0));
const orgFind = id => orgPos().find(p => p.id === id);
function orgDesc(list, id) { const out = new Set(); const walk = x => orgKids(list, x).forEach(c => { out.add(c.id); walk(c.id); }); walk(id); return out; }
function orgLevel(list, p) { let n = 1, x = p; const seen = new Set(); while (x && x.atasan && !seen.has(x.id)) { seen.add(x.id); x = list.find(q => q.id === x.atasan); n++; } return n; }
const orgFill = p => (p.orang || []).filter(o => o.nama).length;

MODS.org = {
  title: 'Struktur Organisasi', icon: 'org', desc: 'Bagan jabatan ' + BC + ', garis komando & koordinasi, dan nama personil',
  render(root) {
    const st = stateOf('org', { tab: 'bagan', q: '', unit: '' });
    st.umum = true;
    return page(root, {
      key: 'org', st, report: orgReport,
      tabs: [{ k: 'bagan', t: 'Bagan Organisasi' }, { k: 'daftar', t: 'Daftar Jabatan & Personil' }],
      actions: [{ id: 'add', t: 'Tambah Posisi', pri: true }],
      on: { add: () => orgForm(null, { atasan: 'kp' }) },
      filter: s => s.tab === 'bagan' ? '' : periodBar(Object.assign({}, s, { month: undefined })),
      body: s => editBadge('Struktur Organisasi') + orgHtml(s),
      bind: (el) => {
        $$('[data-oid]', el).forEach(n => {
          n.onclick = () => orgForm(orgFind(n.dataset.oid));
          n.onmouseenter = () => { const p = orgFind(n.dataset.oid); if (!p) return; const rel = new Set(p.kor || []); orgPos().forEach(q => { if ((q.kor || []).includes(p.id)) rel.add(q.id); }); $$('[data-oid]', el).forEach(x => x.classList.toggle('kor', rel.has(x.dataset.oid))); n.classList.add('focus'); };
          n.onmouseleave = () => $$('[data-oid]', el).forEach(x => x.classList.remove('kor', 'focus'));
        });
        $$('[data-row]', el).forEach(tr => tr.onclick = () => orgForm(orgFind(tr.dataset.row)));
        bindRelock(el);
        const oc = $('.orgc', el), ot = $('.otree', el);
        if (oc && ot) {
          const st = stateOf('org', {});
          const apply = () => { ot.style.zoom = 1; const fit = Math.max(0.45, Math.min(1, (oc.clientWidth - 36) / ot.scrollWidth)); ot.style.zoom = st.zoom === 'fit' || st.zoom == null ? fit : +st.zoom; };
          apply();
          $$('[data-oz]', el).forEach(b => b.onclick = () => { const cur = parseFloat(ot.style.zoom) || 1, k = b.dataset.oz; st.zoom = k === 'fit' ? 'fit' : k === '1' ? 1 : Math.max(0.4, Math.min(1.4, cur + (k === '+' ? 0.1 : -0.1))); apply(); });
        }
        const rs = $('[data-orgreset]', el); if (rs) rs.onclick = async e => { e.stopPropagation(); if (await editGate('Struktur Organisasi') && await confirmBox('Kembalikan struktur', 'Struktur dikembalikan ke susunan standar. Nama personil yang sudah diisi akan hilang.', 'Kembalikan', true)) { remove(ORG_ID); toast('Struktur dikembalikan ke standar'); } };
      }
    });
  },
  summary() { const l = orgPos(); const need = sum(l, p => +p.formasi || 0), fill = sum(l, orgFill); return { main: l.length + ' posisi · ' + fill + ' personil', sub: need > fill ? (need - fill) + ' formasi belum terisi' : 'Formasi terisi penuh', tone: need > fill ? 'warn' : '' }; }
};
function orgNode(p, list, cls) {
  const names = (p.orang || []).filter(o => o.nama);
  const f = +p.formasi || 0;
  return '<button class="onode ' + (cls || '') + (p.unit && p.unit !== 'Umum' ? ' un-' + p.unit : '') + '" data-oid="' + esc(p.id) + '">' +
    '<span class="ohead">' + (p.unit && p.unit !== 'Umum' ? unitChip(p.unit) : '') + '<b>' + esc(p.jabatan) + '</b></span>' +
    '<span class="onames">' + (names.length ? names.map(o => '<i>' + esc(o.nama) + '</i>').join('') : '<em>Belum diisi</em>') + '</span>' +
    '<span class="ofoot"><small class="' + (f && names.length < f ? 't-warn' : 't-ok') + '">' + names.length + (f ? ' / ' + f : '') + ' personil</small>' + ((p.kor || []).length ? '<small class="okor">' + (p.kor || []).length + ' koordinasi</small>' : '') + '</span></button>';
}
function orgSub(list, id) {
  const kids = orgKids(list, id);
  if (!kids.length) return '';
  return '<div class="osub">' + kids.map(k => '<div class="oitem">' + orgNode(k, list, 'l3') + orgSub(list, k.id) + '</div>').join('') + '</div>';
}
function orgHtml(s) {
  const list = orgPos();
  const roots = orgKids(list, '');
  const need = sum(list, p => +p.formasi || 0), fill = sum(list, orgFill);
  const k = '<div class="kpis">' + kpi('Jumlah posisi', list.length) + kpi('Formasi', need + ' orang') + kpi('Personil terisi', fill + ' orang', '', fill >= need ? 'good' : '') + kpi('Belum terisi', Math.max(0, need - fill) + ' orang', '', need > fill ? 'warn' : '') + '</div>';
  if (s.tab === 'daftar') {
    const rows = [];
    const walk = (id, lv) => orgKids(list, id).forEach(p => { rows.push(Object.assign({ lv }, p)); walk(p.id, lv + 1); });
    walk('', 1);
    const fr = rows.filter(p => (!s.unit || p.unit === s.unit) && qMatch(s.q, p.jabatan, (p.orang || []).map(o => o.nama).join(' ')));
    return k + '<section class="card">' + table([
      { t: 'Jabatan', f: p => '<span style="padding-left:' + (p.lv - 1) * 16 + 'px"><b>' + esc(p.jabatan) + '</b></span><small style="padding-left:' + (p.lv - 1) * 16 + 'px">Level ' + p.lv + '</small>', raw: true },
      { t: 'Unit', f: p => unitChip(p.unit || 'Umum'), raw: true }, { t: 'Atasan langsung', f: p => (orgFind(p.atasan) || {}).jabatan || '-' },
      { t: 'Koordinasi dengan', f: p => (p.kor || []).map(x => (orgFind(x) || {}).jabatan).filter(Boolean).join(', ') || '-', cls: 'wrap' },
      { t: 'Personil', f: p => (p.orang || []).filter(o => o.nama).map(o => esc(o.nama) + (o.wa ? ' <small>' + esc(waShow(o.wa)) + '</small>' : '')).join('') || '<span class="muted">Belum diisi</span>', raw: true, cls: 'wrap' },
      { t: 'Formasi', f: p => orgFill(p) + ' / ' + (+p.formasi || 0), num: true }
    ], fr, { click: true }) + '</section>';
  }
  return k + '<div class="note">Garis tegas = garis komando (atasan langsung). Arahkan kursor ke kotak jabatan untuk menyorot jabatan yang berkoordinasi. Klik kotak untuk mengisi nama, mengubah jabatan, atau menambah bawahan. <button class="btn ghost sm" data-orgreset style="margin-left:6px">' + ic('refresh') + 'Kembalikan standar</button></div>' +
    '<section class="card flush"><div class="ozoom"><button class="ibtn sm" data-oz="-" aria-label="Perkecil">&minus;</button><button class="btn ghost sm" data-oz="fit">Muat layar</button><button class="btn ghost sm" data-oz="1">100%</button><button class="ibtn sm" data-oz="+" aria-label="Perbesar">+</button></div><div class="orgc">' + roots.map(r => '<div class="otree"><div class="otop">' + orgNode(r, list, 'l1') + '</div>' +
      (orgKids(list, r.id).length ? '<div class="ocols">' + orgKids(list, r.id).map(c => '<div class="ocol">' + orgNode(c, list, 'l2') + orgSub(list, c.id) + '</div>').join('') + '</div>' : '') + '</div>').join('') + '</div></section>' +
    '<div class="legend"><span><i style="background:var(--navy)"></i>Pimpinan</span><span><i style="background:#263445"></i>AMP</span><span><i style="background:#1f5fae"></i>CMP</span><span><i style="background:#8a5a2b"></i>SCP</span><span><i style="background:#24756b"></i>PCP</span><span><i style="background:#6a7686"></i>Umum / pendukung</span></div>';
}
const orgForm = gated('Struktur Organisasi', (p, pre) => orgFormRaw(p, pre));
function orgFormRaw(p, pre) {
  const list = orgPos();
  const isNew = !p;
  const v = p ? JSON.parse(JSON.stringify(p)) : Object.assign({ id: uid('og'), jabatan: '', unit: 'Umum', atasan: 'kp', formasi: 1, kor: [], orang: [{}], tugas: '', urut: list.length + 1 }, pre || {});
  if (!v.orang || !v.orang.length) v.orang = [{}];
  v.addMp = true;
  const desc = p ? orgDesc(list, p.id) : new Set();
  const mpList = all('mp');
  openForm({
    title: isNew ? 'Tambah Posisi' : p.jabatan, sub: isNew ? 'Posisi baru dalam struktur ' + BC : 'Atasan: ' + ((orgFind(p.atasan) || {}).jabatan || 'puncak struktur'), wide: true, value: v,
    onDelete: p && p.atasan ? () => { orgSave(list.filter(x => x.id !== p.id).map(x => x.atasan === p.id ? Object.assign({}, x, { atasan: p.atasan }) : Object.assign({}, x, { kor: (x.kor || []).filter(k => k !== p.id) }))); } : null,
    extraBtn: p ? { html: '<button type="button" class="btn ghost" data-sub>' + ic('plus') + 'Tambah bawahan</button>', bind: (f, x, m) => $('[data-sub]', f).onclick = () => { m.close(); setTimeout(() => orgForm(null, { atasan: p.id, unit: p.unit }), 280); } } : null,
    fields: [
      { k: 'jabatan', label: 'Nama jabatan', req: true, full: true, type: 'list', opts: ['Kepala Plant / Kepala Basecamp', 'Wakil Kepala Plant', 'Admin Basecamp', 'Admin Unit', 'Quality Control', 'Mekanik', 'Elektrik', 'Operator Produksi', 'Operator Alat Berat Excavator', 'Operator Alat Berat Loader', 'Helper', 'Sopir Dump Truck', 'Sopir Truck Mixer', 'Security', 'Harian Kebersihan', 'Logistik', 'Marketing Unit', 'Keuangan / Kasir', 'K3 / HSE'] },
      { k: 'unit', label: 'Unit', type: 'select', opts: UNITS.concat('Umum'), empty: false },
      { k: 'atasan', label: 'Atasan langsung', type: 'select', empty: '— Puncak struktur —', opts: () => list.filter(x => x.id !== v.id && !desc.has(x.id)).map(x => ({ v: x.id, t: x.jabatan })) },
      { k: 'formasi', label: 'Formasi (jumlah orang dibutuhkan)', type: 'num', suffix: 'orang' },
      { k: 'urut', label: 'Urutan tampil', type: 'num', help: 'Angka kecil tampil lebih dulu di antara jabatan setingkat' },
      { k: 'orang', label: 'Nama personil pada posisi ini', type: 'items', newRow: () => ({}), cols: [
        { k: 'nama', label: 'Nama lengkap', type: 'list', opts: () => mpList.map(m => m.nama), w: '46%', onChange: r => { const m = mpList.find(x => x.nama === r.nama); if (m && !r.wa) r.wa = m.wa ? '0' + String(m.wa).replace(/^62/, '') : ''; } },
        { k: 'wa', label: 'No. WhatsApp' }, { k: 'ket', label: 'Keterangan', w: '22%' }] },
      { k: 'addMp', type: 'check', text: 'Tambahkan nama baru ke Kartu Man Power (jabatan dan unit mengikuti posisi ini)' },
      { k: 'kor', label: 'Berkoordinasi dengan (garis koordinasi)', type: 'checks', opts: () => list.filter(x => x.id !== v.id).map(x => ({ v: x.id, t: x.jabatan })) },
      { k: 'tugas', label: 'Uraian tugas & tanggung jawab', type: 'textarea', rows: 3 }
    ],
    onSave: x => {
      const orang = (x.orang || []).filter(o => o.nama && o.nama.trim()).map(o => ({ nama: o.nama.trim(), wa: o.wa ? waNorm(o.wa) : '', ket: o.ket || '' }));
      const pos = { id: v.id, jabatan: x.jabatan.trim(), unit: x.unit, atasan: x.atasan || '', formasi: +x.formasi || 0, urut: +x.urut || 0, kor: x.kor || [], orang, tugas: x.tugas || '' };
      if (!pos.atasan && list.some(q => !q.atasan && q.id !== pos.id)) { toast('Puncak struktur sudah ada. Pilih atasan langsung.', 'err'); return false; }
      const nl = list.filter(q => q.id !== pos.id).concat([pos]);
      orgSave(nl, 'Posisi ' + pos.jabatan + ' tersimpan');
      if (x.addMp) orang.forEach(o => { if (!mpList.some(m => m.nama.toLowerCase() === o.nama.toLowerCase())) save('mp', { nama: o.nama, nik: '', jabatan: pos.jabatan, unit: pos.unit, wa: o.wa, domisili: '', masuk: '', status: 'Aktif', ket: 'Dari struktur organisasi' }); });
    }
  });
}
async function orgReport() {
  const list = orgPos();
  const R = await pdfReport({ title: 'Struktur Organisasi ' + BC, sub: 'Unit Produksi AMP, CMP, SCP, PCP · per ' + tgl(today(), true), orient: 'l', fname: 'Struktur_Organisasi_' + BCN });
  const doc = R.doc, W = R.W, M = R.M;
  if (!orgKids(list, '')[0]) { toast('Struktur belum memiliki puncak jabatan', 'err'); return; }
  const root = orgKids(list, '')[0];
  const UC = { AMP: [38, 52, 69], CMP: [31, 95, 174], SCP: [138, 90, 43], PCP: [36, 117, 107], Umum: [106, 118, 134] };
  // bagan digambar dengan skala yang dikecilkan bila perlu, sehingga seluruh bagan muat di satu halaman tanpa teks terpotong
  const box = (p, x, y, w, top, sc, draw) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize((top ? 8 : 6.4) * sc);
    const jl = doc.splitTextToSize(pdfClean(p.jabatan), w - 4.4);
    const nm = (p.orang || []).filter(o => o.nama).map(o => o.nama);
    doc.setFont('helvetica', 'normal');
    const nl = nm.length ? nm.reduce((a, t) => a.concat(doc.splitTextToSize(pdfClean(t), w - 4.4)), []) : ['(belum diisi)'];
    const lh = (top ? 3.4 : 2.7) * sc, h = 2.6 * sc + jl.length * lh + nl.length * lh + 1.6 * sc;
    if (!draw) return h;
    const col = top ? NAVY : UC[p.unit] || UC.Umum;
    doc.setDrawColor(...col); doc.setLineWidth(0.3); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, w, h, 1, 1, 'FD');
    doc.setFillColor(...col); doc.rect(x, y, 1.1, h, 'F');
    let yy = y + 2.6 * sc + lh * 0.55;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK); jl.forEach(t => { doc.text(t, x + 2.2, yy); yy += lh; });
    doc.setFont('helvetica', nm.length ? 'normal' : 'italic'); doc.setTextColor(...(nm.length ? [31, 95, 174] : MUTED)); nl.forEach(t => { doc.text(t, x + 2.2, yy); yy += lh; });
    return h;
  };
  const chart = (sc, draw) => {
    const y = R.y + 1;
    const tw = 70, th = box(root, W / 2 - tw / 2, y, tw, true, sc, draw);
    const cols = orgKids(list, root.id), n = cols.length || 1, gap = 2.2, cw = (W - 2 * M - gap * (n - 1)) / n;
    const yl = y + th + 4 * sc;
    if (draw) { doc.setDrawColor(...NAVY); doc.setLineWidth(0.35); doc.line(W / 2, y + th, W / 2, yl); if (n > 1) doc.line(M + cw / 2, yl, M + (n - 1) * (cw + gap) + cw / 2, yl); }
    let maxY = yl;
    cols.forEach((c, i) => {
      const x = M + i * (cw + gap);
      if (draw) { doc.setDrawColor(...NAVY); doc.setLineWidth(0.35); doc.line(x + cw / 2, yl, x + cw / 2, yl + 3 * sc); }
      let cy = yl + 3 * sc; const h = box(c, x, cy, cw, false, sc, draw); cy += h + 2.4 * sc;
      const walk = (pid, ind) => orgKids(list, pid).forEach(k => {
        const bx = x + ind;
        if (draw) { doc.setDrawColor(170, 180, 192); doc.setLineWidth(0.25); doc.line(bx - 1.6, cy - 2.4 * sc, bx - 1.6, cy + 2 * sc); doc.line(bx - 1.6, cy + 2 * sc, bx, cy + 2 * sc); }
        const hh = box(k, bx, cy, cw - ind, false, sc, draw); cy += hh + 1.6 * sc; walk(k.id, ind + 2.5);
      });
      walk(c.id, 2.5);
      maxY = Math.max(maxY, cy);
    });
    return maxY;
  };
  const limit = R.H - 20;
  let sc = 1;
  while (sc > 0.5 && chart(sc, false) > limit) sc -= 0.05;
  const maxY = chart(sc, true);
  R.y = maxY + 4;
  doc.addPage(); R.y = 36;
  R.h2('Daftar Jabatan, Garis Komando, Koordinasi & Personil');
  const rows = []; const walk = (id, lv) => orgKids(list, id).forEach(p => { rows.push([lv, p]); walk(p.id, lv + 1); }); walk('', 1);
  R.table(['No', 'Jabatan', 'Unit', 'Atasan Langsung', 'Koordinasi', 'Formasi', 'Nama Personil', 'Uraian Tugas'], rows.map(([lv, p], i) => [i + 1, '  '.repeat(lv - 1) + p.jabatan, p.unit || 'Umum', (orgFind(p.atasan) || {}).jabatan || '-', (p.kor || []).map(x => (orgFind(x) || {}).jabatan).filter(Boolean).join(', ') || '-', cellR(orgFill(p) + '/' + (+p.formasi || 0)), (p.orang || []).filter(o => o.nama).map(o => o.nama + (o.wa ? ' (' + waShow(o.wa) + ')' : '')).join('\n') || '-', p.tugas || '-']),
    { fs: 6.8, cs: { 0: { halign: 'center', cellWidth: 8 }, 1: { cellWidth: 42 }, 3: { cellWidth: 34 }, 4: { cellWidth: 44 }, 6: { cellWidth: 40 }, 7: { cellWidth: 52 } } });
  R.sign([['Dibuat oleh,', S.user.name], ['Kepala Plant,', ''], ['Disetujui oleh,', '']]);
  await R.save();
}
