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

/* ---- Susunan hubungan koordinasi otomatis, mengikuti urutan (tingkat) jabatan ----
   Tingkat 1 pimpinan basecamp · 2 kepala/koordinator unit & fungsi di bawah pimpinan · 3 staf, admin, operator, mekanik, sopir · 4 pelaksana (helper, tenaga harian, satpam, OB).
   Garis komando (atasan ↔ bawahan langsung) tidak dihitung sebagai koordinasi. Koordinasi = rekan setingkat dengan atasan yang sama,
   rekan setingkat satu unit, rekan setingkat dengan fungsi yang sama di unit lain, rekan satu atasan satu tingkat di bawah/atas,
   kepala unit ↔ staf yang menangani unitnya, dan pasangan fungsi pendukung (admin–marketing–logistik–keamanan, maintenance–operator). */
const ORG_UN = ['AMP', 'CMP', 'SCP', 'PCP'];
const ORG_TIER = ['', 'Pimpinan', 'Kepala / koordinator', 'Staf & operator', 'Pelaksana'];
function orgFn(p) {
  const j = ' ' + String(p.jabatan || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ') + ' ';
  const f = new Set(), has = re => re.test(j);
  if (has(/ (kepala|kabag|kasie|koordinator|manager|manajer|supervisor|mandor|wakil) /)) f.add('head');
  if (has(/ (admin|administrasi|kasir|keuangan|akuntansi|akunting) /)) f.add('adm');
  if (has(/ (sales|marketing|pemasaran) /)) f.add('mkt');
  if (has(/ (maintenance|mekanik|teknisi|teknik|elektrik|perawatan|bengkel) /)) f.add('mnt');
  if (has(/ (laborat|laboratorium|lab|qc|quality|mutu) /)) f.add('lab');
  if (has(/ (logistik|gudang|checker|material) /)) f.add('log');
  if (has(/ (satpam|security|keamanan) /)) f.add('sec');
  if (has(/ operator /)) f.add('op');
  if (has(/ (sopir|driver) /)) f.add('drv');
  if (has(/ (helper|tenaga|ob|kebersihan|tukang|kenek|pembantu) /)) f.add('hlp');
  return f;
}
function orgUnitsOf(p) {
  const s = new Set(); if (ORG_UN.includes(p.unit)) s.add(p.unit);
  const j = ' ' + String(p.jabatan || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ') + ' ';
  ORG_UN.forEach(u => { if (j.includes(' ' + u + ' ')) s.add(u); }); if (j.includes(' PRECAST ')) s.add('PCP');
  return s;
}
function orgTierOf(p, f, rootId) {
  if (!p.atasan) return 1;
  if (f.has('head')) return p.atasan === rootId ? 2 : 3;
  if (f.has('hlp') || f.has('sec')) return 4;
  if (p.atasan === rootId && f.has('mkt') && !/\b(mt|staf|staff)\b/i.test(p.jabatan || '')) return 2;
  return 3;
}
const ORG_SAMEFN = ['adm', 'mkt', 'mnt', 'lab', 'log', 'sec', 'op', 'drv'];
const ORG_PAIR = [['adm', 'mkt'], ['adm', 'log'], ['sec', 'log'], ['sec', 'adm'], ['mnt', 'mnt'], ['lab', 'lab'], ['op', 'mnt']];
const ORG_FN_T = { adm: 'administrasi', mkt: 'pemasaran', mnt: 'maintenance', lab: 'laboratorium / mutu', log: 'logistik', sec: 'keamanan', op: 'operator', drv: 'pengemudi' };
function orgPairWhy(a, b) {
  const ov = [...a.un].some(u => b.un.has(u));
  if (a.t === b.t) {
    if (a.p.atasan === b.p.atasan) return 'Rekan setingkat, satu atasan';
    if (ov) return 'Rekan setingkat, satu unit';
    const k = ORG_SAMEFN.find(x => a.f.has(x) && b.f.has(x)); if (k) return 'Rekan setingkat, sesama ' + ORG_FN_T[k];
  }
  if (Math.abs(a.t - b.t) === 1) {
    const [hi, lo] = a.t < b.t ? [a, b] : [b, a];
    if (a.p.atasan === b.p.atasan) return 'Satu atasan, ' + (hi === a ? 'satu tingkat di bawah' : 'satu tingkat di atas');
    if (hi.t === 2 && hi.f.has('head') && ov) return hi === a ? 'Staf yang menangani unit ini' : 'Kepala unit yang ditangani';
  }
  if (Math.abs(a.t - b.t) <= 1) {
    for (const [x, y] of ORG_PAIR) {
      if (!((a.f.has(x) && b.f.has(y)) || (a.f.has(y) && b.f.has(x)))) continue;
      if (x === 'op' && !(ov || !(a.f.has('mnt') ? a : b).un.size)) continue; // operator ↔ maintenance: satu unit atau maintenance umum
      return x === y ? 'Sesama ' + ORG_FN_T[x] : 'Fungsi pendukung ' + ORG_FN_T[a.f.has(x) && b.f.has(y) ? x : y] + ' – ' + ORG_FN_T[a.f.has(x) && b.f.has(y) ? y : x];
    }
  }
  return '';
}
/* rel(id) → { t: tingkat, up: atasan, down: [bawahan], kor: Map(id → alasan) } — koordinasi otomatis + tambahan manual (field kor), selalu dua arah */
function orgRel() {
  return memo('orgRel', () => {
    const list = orgPos(), root = list.find(p => !p.atasan), rootId = root ? root.id : '';
    const order = []; const walk = id => orgKids(list, id).forEach(p => { order.push(p); walk(p.id); }); walk(''); list.forEach(p => { if (!order.includes(p)) order.push(p); });
    const info = order.map(p => { const f = orgFn(p); return { p, f, un: orgUnitsOf(p), t: orgTierOf(p, f, rootId) }; });
    const by = new Map(info.map(x => [x.p.id, x]));
    const R = new Map(info.map(x => [x.p.id, { t: x.t, up: x.p.atasan || '', down: orgKids(list, x.p.id).map(k => k.id), kor: new Map() }]));
    const cmd = (a, b) => a.p.atasan === b.p.id || b.p.atasan === a.p.id;
    for (let i = 0; i < info.length; i++) for (let j = i + 1; j < info.length; j++) {
      const a = info[i], b = info[j]; if (cmd(a, b) || a.t === 1 || b.t === 1) continue;
      const why = orgPairWhy(a, b); if (!why) continue;
      R.get(a.p.id).kor.set(b.p.id, why); R.get(b.p.id).kor.set(a.p.id, orgPairWhy(b, a));
    }
    info.forEach(a => (a.p.kor || []).forEach(k => { const b = by.get(k); if (!b || b === a || cmd(a, b) || Math.abs(a.t - b.t) > 1) return; /* tambahan manual tetap mengikuti urutan jabatan (paling jauh satu tingkat) */ if (!R.get(a.p.id).kor.has(k)) R.get(a.p.id).kor.set(k, 'Koordinasi tambahan'); if (!R.get(k).kor.has(a.p.id)) R.get(k).kor.set(a.p.id, 'Koordinasi tambahan'); }));
    const pos = new Map(order.map((p, i) => [p.id, i]));
    R.forEach(r => { r.kor = new Map([...r.kor].sort((x, y) => pos.get(x[0]) - pos.get(y[0]))); });
    return R;
  });
}
const orgRelOf = id => orgRel().get(id) || { t: 0, up: '', down: [], kor: new Map() };
const orgKorNames = id => [...orgRelOf(id).kor.keys()].map(x => (orgFind(x) || {}).jabatan).filter(Boolean);
const orgAutoKor = id => [...orgRelOf(id).kor].filter(([, w]) => w !== 'Koordinasi tambahan');
function orgKorHtml(id, cls) {
  const r = orgRelOf(id);
  if (!r.kor.size) return '<span class="muted">Tidak ada koordinasi selain garis komando</span>';
  return '<span class="okchips">' + [...r.kor].map(([k, w]) => { const q = orgFind(k); return q ? '<button type="button" class="okchip' + (w === 'Koordinasi tambahan' ? ' man' : '') + (cls || '') + '" data-osel="' + esc(k) + '" title="' + esc(w) + '">' + esc(q.jabatan) + '<small>' + esc(w) + '</small></button>' : ''; }).join('') + '</span>';
}

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
        const nodes = $$('[data-oid]', el), oc0 = $('.orgc', el), oi = $('[data-oinfo]', el), sst = stateOf('org', {});
        const hov = () => matchMedia('(hover: hover)').matches;
        // sorot: kuning = harus berkoordinasi, biru = atasan langsung, garis putus = bawahan langsung; jabatan lain diredupkan
        const mark = id => {
          const r = id && orgFind(id) ? orgRelOf(id) : null;
          if (oc0) oc0.classList.toggle('osel-on', !!r);
          nodes.forEach(x => {
            const k = x.dataset.oid, w = r && r.kor.get(k);
            x.classList.toggle('kor', !!w); x.classList.toggle('focus', !!r && k === id); x.classList.toggle('oup', !!r && r.up === k); x.classList.toggle('odn', !!r && r.down.includes(k));
            x.dataset.tag = !r ? '' : k === id ? 'Dipilih' : w ? 'Koordinasi' : r.up === k ? 'Atasan' : r.down.includes(k) ? 'Bawahan' : '';
            if (w) x.title = 'Koordinasi: ' + w; else x.removeAttribute('title');
          });
        };
        const show = (id, scroll) => {
          sst.sel = id && orgFind(id) ? id : ''; mark(sst.sel);
          if (oi) { oi.innerHTML = orgInfoHtml(sst.sel); bindInfo(); }
          if (scroll && sst.sel) { const n = nodes.find(x => x.dataset.oid === sst.sel); if (n) n.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }
        };
        const bindInfo = () => {
          $$('[data-osel]', oi).forEach(b => b.onclick = e => { e.stopPropagation(); show(b.dataset.osel, true); });
          const ed = $('[data-oedit]', oi); if (ed) ed.onclick = () => orgForm(orgFind(sst.sel));
          const cl = $('[data-oclose]', oi); if (cl) cl.onclick = () => show('');
        };
        nodes.forEach(n => {
          n.onclick = e => { e.stopPropagation(); const id = n.dataset.oid; if (sst.sel === id) orgForm(orgFind(id)); else show(id); };
          n.onmouseenter = () => { if (hov()) mark(n.dataset.oid); };
          n.onmouseleave = () => { if (hov()) mark(sst.sel); };
        });
        if (oc0) oc0.onclick = e => { if (!e.target.closest('[data-oid]')) show(''); };
        if (oi) show(sst.sel);
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
    '<span class="ofoot"><small class="' + (f && names.length < f ? 't-warn' : 't-ok') + '">' + names.length + (f ? ' / ' + f : '') + ' personil</small>' + (orgRelOf(p.id).kor.size ? '<small class="okor">' + orgRelOf(p.id).kor.size + ' koordinasi</small>' : '') + '</span></button>';
}
function orgInfoHtml(id) {
  const p = id && orgFind(id);
  if (!p) return '<div class="oi-hint">' + ic('help') + '<span>Klik atau ketuk kotak jabatan untuk melihat dengan siapa jabatan itu harus berkoordinasi. <b class="oi-k">Kuning</b> = koordinasi, <b class="oi-u">biru</b> = atasan langsung, garis putus = bawahan langsung. Klik kotak yang sama sekali lagi untuk mengisi nama atau mengubah jabatan.</span></div>';
  const r = orgRelOf(id), up = orgFind(r.up);
  return '<div class="oi-h"><b>' + esc(p.jabatan) + '</b><small>Tingkat ' + r.t + ' · ' + esc(ORG_TIER[r.t] || '') + (p.unit && p.unit !== 'Umum' ? ' · ' + esc(p.unit) : '') + '</small>' +
    '<span class="oi-act"><button type="button" class="btn ghost sm" data-oedit>' + ic('edit') + 'Ubah / isi nama</button><button type="button" class="ibtn sm" data-oclose aria-label="Tutup">&times;</button></span></div>' +
    '<div class="oi-r"><span>Atasan langsung</span><div>' + (up ? '<button type="button" class="okchip okup" data-osel="' + esc(up.id) + '">' + esc(up.jabatan) + '</button>' : '<span class="muted">Puncak struktur</span>') + '</div></div>' +
    '<div class="oi-r"><span>Bawahan langsung</span><div>' + (r.down.length ? '<span class="okchips">' + r.down.map(k => '<button type="button" class="okchip okdn" data-osel="' + esc(k) + '">' + esc((orgFind(k) || {}).jabatan || '') + '</button>').join('') + '</span>' : '<span class="muted">Tidak ada</span>') + '</div></div>' +
    '<div class="oi-r"><span>Berkoordinasi dengan (' + r.kor.size + ')</span><div>' + orgKorHtml(id) + '</div></div>';
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
      { t: 'Tingkat', f: p => orgRelOf(p.id).t + ' · ' + (ORG_TIER[orgRelOf(p.id).t] || '') },
      { t: 'Koordinasi dengan', f: p => orgKorNames(p.id).join(', ') || '-', cls: 'wrap' },
      { t: 'Personil', f: p => (p.orang || []).filter(o => o.nama).map(o => esc(o.nama) + (o.wa ? ' <small>' + esc(waShow(o.wa)) + '</small>' : '')).join('') || '<span class="muted">Belum diisi</span>', raw: true, cls: 'wrap' },
      { t: 'Formasi', f: p => orgFill(p) + ' / ' + (+p.formasi || 0), num: true }
    ], fr, { click: true }) + '</section>';
  }
  return k + '<div class="note">Garis tegas = garis komando (atasan langsung). Hubungan koordinasi disusun otomatis menurut urutan jabatan: rekan setingkat, satu unit, fungsi yang sama, dan fungsi pendukung. Arahkan kursor atau ketuk kotak jabatan untuk menyorot (kuning) jabatan yang harus diajak berkoordinasi. <button class="btn ghost sm" data-orgreset style="margin-left:6px">' + ic('refresh') + 'Kembalikan standar</button></div>' +
    '<section class="card flush"><div class="oinfo" data-oinfo></div><div class="ozoom"><button class="ibtn sm" data-oz="-" aria-label="Perkecil">&minus;</button><button class="btn ghost sm" data-oz="fit">Muat layar</button><button class="btn ghost sm" data-oz="1">100%</button><button class="ibtn sm" data-oz="+" aria-label="Perbesar">+</button></div><div class="orgc">' + roots.map(r => '<div class="otree"><div class="otop">' + orgNode(r, list, 'l1') + '</div>' +
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
      { k: 'korAuto', label: 'Koordinasi otomatis (sesuai urutan jabatan)', type: 'html', full: true, html: () => isNew ? '<span class="muted">Disusun otomatis setelah posisi disimpan, mengikuti tingkat jabatan, unit, dan fungsinya.</span>' : orgAutoKor(v.id).length ? '<span class="okchips">' + orgAutoKor(v.id).map(([k, w]) => '<span class="okchip">' + esc((orgFind(k) || {}).jabatan || '') + '<small>' + esc(w) + '</small></span>').join('') + '</span>' : '<span class="muted">Tidak ada koordinasi otomatis selain garis komando</span>' },
      { k: 'kor', label: 'Koordinasi tambahan (di luar susunan otomatis, paling jauh satu tingkat jabatan)', type: 'checks', opts: () => { const au = new Set(isNew ? [] : orgAutoKor(v.id).map(x => x[0])), t0 = isNew ? 0 : orgRelOf(v.id).t; return list.filter(x => x.id !== v.id && x.id !== v.atasan && x.atasan !== v.id && !au.has(x.id) && (!t0 || Math.abs(orgRelOf(x.id).t - t0) <= 1)).map(x => ({ v: x.id, t: x.jabatan })); } },
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
  R.table(['No', 'Jabatan', 'Unit', 'Atasan Langsung', 'Koordinasi', 'Formasi', 'Nama Personil', 'Uraian Tugas'], rows.map(([lv, p], i) => [i + 1, '  '.repeat(lv - 1) + p.jabatan, p.unit || 'Umum', (orgFind(p.atasan) || {}).jabatan || '-', orgKorNames(p.id).join(', ') || '-', cellR(orgFill(p) + '/' + (+p.formasi || 0)), (p.orang || []).filter(o => o.nama).map(o => o.nama + (o.wa ? ' (' + waShow(o.wa) + ')' : '')).join('\n') || '-', p.tugas || '-']),
    { fs: 6.8, cs: { 0: { halign: 'center', cellWidth: 8 }, 1: { cellWidth: 42 }, 3: { cellWidth: 34 }, 4: { cellWidth: 44 }, 6: { cellWidth: 40 }, 7: { cellWidth: 52 } } });
  R.sign([['Dibuat oleh,', S.user.name], ['Kepala Plant,', ''], ['Disetujui oleh,', '']]);
  await R.save();
}
