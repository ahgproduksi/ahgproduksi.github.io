/* Basecamp Bawen — logika data terintegrasi: material, harga, jobmix/BOM, stok, SO, piutang. */
'use strict';
const K = window.KATALOG;
const MAT_KAT = ['Batu Quarry', 'Semen & Agregat', 'Aspal', 'Admixture', 'BBM & Pelumas', 'Sparepart', 'Besi', 'Agregat & Beton Internal', 'Bahan Penolong', 'Lainnya'];
const MASTER = {};
K.mat.forEach(([kode, nama, kat, sat, harga, bj, unit, supp]) => {
  MASTER[nama.toLowerCase()] = { kode, nama, kat: kat === 'Internal' ? 'Agregat & Beton Internal' : kat, sat, harga, bj: bj || (/pasir beton/i.test(nama) ? 1.45 : null), unit, supp };
});
const EXTRA_MAT = [
  ['Oli SAE 10', 'BBM & Pelumas', 'Liter'], ['Oli SAE 40', 'BBM & Pelumas', 'Liter'], ['Oli Hidrolik', 'BBM & Pelumas', 'Liter'],
  ['Grease / Stempet Pelumas Bearing', 'BBM & Pelumas', 'Pail'], ['Solar Industri', 'BBM & Pelumas', 'Liter'], ['Bio Solar', 'BBM & Pelumas', 'Liter']
];
function canon(n) {
  let s = String(n || '').replace(/\s*\(dari CMP\)\s*/i, ' ').split(' - ')[0].trim();
  s = s.replace(/^beton readymix/i, 'Beton Readymix');
  return s;
}
const minfo = n => MASTER[canon(n).toLowerCase()] || null;
function isStockLine(l) { return l[1] === 'B' || !!minfo(l[0]); }
function conv(q, from, to, bj) {
  const f = String(from || '').toLowerCase(), t = String(to || '').toLowerCase();
  if (!f || !t || f === t) return q;
  const kg = { kg: 1, ton: 1000 };
  if (f in kg && t in kg) return q * kg[f] / kg[t];
  if (bj) {
    if (f === 'm3' && t in kg) return q * bj * 1000 / kg[t];
    if (t === 'm3' && f in kg) return q * kg[f] / 1000 / bj;
  }
  return q;
}

/* ---------- material per unit ---------- */
const DEF_MAT = {};
UNITS.concat('Umum').forEach(u => {
  const m = new Map();
  const add = (nama, kat, sat) => { const k = nama.toLowerCase(); if (!m.has(k)) m.set(k, { nama, kat, sat, def: true }); };
  (K.unit[u] || []).forEach(p => p.b.forEach(l => { if (isStockLine(l)) { const mi = minfo(l[0]); const n = mi ? mi.nama : canon(l[0]); add(n, mi ? mi.kat : 'Lainnya', mi ? mi.sat : l[2]); } }));
  Object.values(MASTER).forEach(mi => { if (String(mi.unit).split(/[,\s]+/).includes(u)) add(mi.nama, mi.kat, mi.sat); });
  EXTRA_MAT.forEach(([n, k, s]) => add(n, k, s));
  DEF_MAT[u] = m;
});
function matList(u) {
  const m = new Map(DEF_MAT[u] || DEF_MAT.Umum);
  const res = new Map([...m].map(([k, x]) => [k, Object.assign({}, x)]));
  all('mat').filter(d => d.unit === u).forEach(d => {
    const k = d.nama.toLowerCase();
    res.set(k, Object.assign({}, res.get(k) || {}, d, { doc: d.id }));
  });
  return [...res.values()].filter(x => !x.hide).sort((a, b) => (MAT_KAT.indexOf(a.kat) - MAT_KAT.indexOf(b.kat)) || a.nama.localeCompare(b.nama));
}
function matFind(u, nama) { const k = String(nama || '').toLowerCase(); return matList(u).find(x => x.nama.toLowerCase() === k) || null; }
function allMatNames() {
  const s = new Map();
  UNITS.concat('Umum').forEach(u => matList(u).forEach(x => s.set(x.nama.toLowerCase(), x)));
  return [...s.values()].sort((a, b) => a.nama.localeCompare(b.nama));
}
async function addMaterialDialog(u) {
  const v = await promptBox('Tambah material baru', [
    { k: 'unit', label: 'Unit', type: 'select', opts: UNITS.concat('Umum'), def: u || 'AMP', req: true, empty: false },
    { k: 'nama', label: 'Nama material', req: true, ph: 'mis. Oli SAE 15W-40', full: true },
    { k: 'kat', label: 'Kategori', type: 'select', opts: MAT_KAT, def: 'Lainnya', empty: false },
    { k: 'sat', label: 'Satuan', type: 'select', opts: SATUAN, def: 'Liter', empty: false },
    { k: 'min', label: 'Stok minimum', type: 'num', help: 'Peringatan "menipis" muncul di bawah angka ini' }
  ]);
  if (!v) return null;
  v.nama = v.nama.trim();
  const ex = all('mat').find(d => d.unit === v.unit && d.nama.toLowerCase() === v.nama.toLowerCase());
  save('mat', { unit: v.unit, nama: v.nama, kat: v.kat, sat: v.sat, min: +v.min || 0 }, ex && ex.id);
  toast('Material ' + v.nama + ' ditambahkan');
  return v.nama;
}

/* ---------- harga bahan (riwayat maju) ---------- */
function priceHist(nama) {
  const k = String(nama || '').toLowerCase();
  const h = all('harga').filter(d => String(d.mat).toLowerCase() === k)
    .sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)) || String(b._at).localeCompare(String(a._at)));
  const mi = MASTER[k];
  if (mi) h.push({ id: 'acuan', mat: mi.nama, sat: mi.sat, harga: mi.harga, tgl: '', supp: mi.supp || '', ket: 'Harga acuan RAPU-BUASO (Master Bahan)', acuan: true });
  return h;
}
const latestPrice = nama => priceHist(nama)[0] || null;
/* ---------- produk & jobmix ---------- */
function products(u) {
  const base = (K.unit[u] || []).map(p => ({ n: p.n, s: p.s, h: p.h.slice(), b: p.b.map(x => x.slice()), def: true }));
  all('jmf').filter(d => d.unit === u).forEach(d => {
    const i = base.findIndex(p => p.n.toLowerCase() === String(d.n).toLowerCase());
    const p = { n: d.n, s: d.s, h: d.h || [0, 0, 0], b: d.b || [], doc: d.id, hide: d.hide, def: i >= 0 && base[i].def, edited: true };
    if (i >= 0) base[i] = p; else base.push(p);
  });
  return base.filter(p => !p.hide);
}
const productFind = (u, n) => products(u).find(p => p.n === n) || null;
/* ---------- customer ---------- */
const CUST_AHG = { id: 'cuAHGinternal', nama: PT, jenis: 'Internal', pic: '', alamat: '', wa: '', builtin: true };
function custList() {
  const a = all('cust');
  if (!a.some(c => c.id === CUST_AHG.id)) a.unshift(Object.assign({}, CUST_AHG));
  return a.sort((x, y) => (x.id === CUST_AHG.id ? -1 : y.id === CUST_AHG.id ? 1 : String(x.nama).localeCompare(String(y.nama))));
}
const custGet = id => custList().find(c => c.id === id) || null;
const custName = id => { const c = custGet(id); return c ? c.nama : (id || '-'); };
async function addCustomerDialog(jenis) {
  return new Promise(res => custForm(null, id => res(id), jenis, () => res(null)));
}

/* ---------- penomoran dokumen ---------- */
function nextNo(kind, prefix, date) {
  const ym = String(date || today()).slice(0, 7).replace('-', '');
  const pre = prefix + '/' + BCODE + '/' + ym + '/';
  let mx = 0;
  all(kind).forEach(d => { if (String(d.no || '').startsWith(pre)) mx = Math.max(mx, parseInt(String(d.no).slice(pre.length)) || 0); });
  return pre + String(mx + 1).padStart(3, '0');
}

/* ---------- SO / produksi ---------- */
function soStats(p) {
  const real = sum(p.real || [], 'vol');
  const kirim = sum(all('kirim').filter(k => k.so === p.id), 'vol');
  const hpp = +p.hpp || 0, harga = +p.harga || 0, vol = +p.vol || 0;
  const bs = p.buaso || {};
  const biayaReal = {}; BUASO.forEach(([k]) => biayaReal[k] = (+bs[k] || 0) * real);
  biayaReal.bunga = (+bs.bunga || 0) * real;
  return {
    vol, real, kirim, sisaProd: Math.max(0, vol - real), sisaKirim: Math.max(0, vol - kirim),
    nilaiSO: vol * harga, hppSO: vol * hpp, profitSO: vol * (harga - hpp),
    nilaiJual: kirim * harga, hppJual: kirim * hpp, profitJual: kirim * (harga - hpp),
    margin: harga ? (harga - hpp) / harga : 0, biayaReal, biayaRealTot: real * hpp
  };
}
function soLabel(p) { return (p.no || '-') + ' · ' + (p.proyek || custName(p.cust)) + ' · ' + p.produk; }
function soStatus(p, st) {
  if (p.status === 'Batal') return 'Batal';
  st = st || soStats(p);
  if (st.vol && st.kirim >= st.vol - 1e-9) return 'Selesai';
  if (st.real > 0 || st.kirim > 0) return 'Berjalan';
  return 'Rencana';
}

/* ---------- stok: mutasi + pemakaian produksi (otomatis dari BOM) ---------- */
function stockMoves(u) {
  const mv = [];
  all('stok').filter(d => d.unit === u).forEach(d => {
    const q = +d.qty || 0;
    mv.push({ id: d.id, tgl: d.tgl, mat: d.mat, sat: d.sat, qty: d.jenis === 'masuk' ? q : d.jenis === 'keluar' ? -q : q, jenis: d.jenis, ref: d.ref || '', ket: d.ket || '', by: d._by, doc: d });
  });
  all('prod').filter(p => p.unit === u && p.status !== 'Batal').forEach(p => {
    (p.real || []).forEach((r, ri) => {
      (p.bom || []).forEach(l => {
        if (!l.stok) return;
        const nm = (minfo(l.nama) || {}).nama || canon(l.nama);
        const mi = matFind(u, nm);
        const ssat = mi ? mi.sat : l.sat;
        const q = conv((+l.koef || 0) * (+r.vol || 0), l.sat, ssat, (minfo(nm) || {}).bj);
        if (q) mv.push({ id: p.id + ':' + ri, tgl: r.tgl, mat: nm, sat: ssat, qty: -q, jenis: 'produksi', ref: p.no, ket: p.produk + ' ' + num(r.vol) + ' ' + p.sat + (p.proyek ? ' · ' + p.proyek : ''), so: p.id, by: p._by });
      });
    });
  });
  return mv.sort((a, b) => String(a.tgl).localeCompare(String(b.tgl)));
}
function stockSaldo(u, until) {
  const list = matList(u);
  const map = new Map(list.map(m => [m.nama.toLowerCase(), { m, masuk: 0, keluar: 0, prod: 0, adj: 0, saldo: 0, last: '' }]));
  stockMoves(u).forEach(x => {
    if (until && x.tgl > until) return;
    const k = String(x.mat).toLowerCase();
    if (!map.has(k)) map.set(k, { m: { nama: x.mat, kat: 'Lainnya', sat: x.sat }, masuk: 0, keluar: 0, prod: 0, adj: 0, saldo: 0, last: '' });
    const r = map.get(k);
    if (x.jenis === 'masuk') r.masuk += x.qty; else if (x.jenis === 'keluar') r.keluar += -x.qty; else if (x.jenis === 'produksi') r.prod += -x.qty; else r.adj += x.qty;
    r.saldo += x.qty; r.last = x.tgl > r.last ? x.tgl : r.last;
  });
  return [...map.values()].map(r => Object.assign(r, { status: r.saldo <= 0 ? (r.masuk || r.prod || r.keluar ? 'Habis' : 'Kosong') : (r.m.min && r.saldo < r.m.min ? 'Menipis' : 'Aman') }));
}
function stockOf(u, nama) { const r = stockSaldo(u).find(x => x.m.nama.toLowerCase() === String(nama).toLowerCase()); return r ? r.saldo : 0; }

/* ---------- piutang & hutang ---------- */
function invPaid(inv) { return sum(all('kas').filter(k => k.inv === inv.id && k.arah === 'masuk'), 'jumlah'); }
function invStat(inv) {
  const total = +inv.total || 0, paid = invPaid(inv), sisa = Math.max(0, total - paid);
  const st = sisa <= 0.5 ? 'Lunas' : paid > 0 ? 'Sebagian' : 'Belum dibayar';
  const telat = sisa > 0.5 && inv.jt && inv.jt < today();
  return { total, paid, sisa, st, telat };
}
function htPaid(h) { return sum(all('kas').filter(k => k.hutang === h.id && k.arah === 'keluar'), 'jumlah'); }
function htStat(h) { const total = +h.jumlah || 0, paid = htPaid(h), sisa = Math.max(0, total - paid); return { total, paid, sisa, st: sisa <= 0.5 ? 'Lunas' : paid > 0 ? 'Sebagian' : 'Belum dibayar', telat: sisa > 0.5 && h.jt && h.jt < today() }; }
function soInvoiced(soId) { return sum(all('inv').filter(i => i.so === soId), 'dpp'); }

/* ---------- BPPB ---------- */
function bppbStat(b) {
  const items = b.items || [];
  const req = sum(items, 'qty'), real = sum(items, i => Math.min(+i.real || 0, +i.qty || 0));
  const p = req ? real / req : 0;
  return { req, real, p, st: !items.length ? 'Belum terealisasi' : p >= 0.999 ? 'Terealisasi' : p > 0 ? 'Sebagian' : 'Belum terealisasi', nilai: sum(items, i => (+i.qty || 0) * (+i.harga || 0)) };
}

/* ---------- alat ---------- */
const DEF_ALAT = {
  AMP: ['Cold Bin', 'Dryer Drum', 'Burner', 'Hot Elevator', 'Screen Hotbin', 'Pugmill / Mixer', 'Dust Collector', 'Tangki Aspal', 'Genset AMP', 'Panel Kontrol AMP', 'Wheel Loader AMP'],
  CMP: ['Batching Plant', 'Mixer Batching', 'Silo Semen', 'Screw Conveyor', 'Truck Mixer', 'Wheel Loader CMP', 'Genset CMP', 'Panel Kontrol CMP', 'Kompresor'],
  SCP: ['Jaw Crusher', 'Cone Crusher', 'Impact Crusher', 'Vibrating Screen', 'Belt Conveyor', 'Feeder', 'Panel Listrik SCP', 'Kabel Panel', 'Genset SCP', 'Excavator SCP', 'Wheel Loader SCP'],
  PCP: ['Cetakan / Bekisting', 'Forklift', 'Vibrator Beton', 'Mesin Las', 'Bar Cutter', 'Bar Bender', 'Genset PCP', 'Gantry / Hoist'],
  Umum: ['Excavator', 'Wheel Loader', 'Dump Truck', 'Seal Boom Excavator', 'Genset Basecamp', 'Pompa Air', 'Kendaraan Operasional', 'Instalasi Listrik Basecamp']
};
function alatList(u) {
  const s = new Set((DEF_ALAT[u] || []).concat(DEF_ALAT.Umum));
  all('alat').filter(a => a.unit === u || a.unit === 'Umum').forEach(a => s.add(a.nama));
  all('mt').filter(m => m.unit === u).forEach(m => m.alat && s.add(m.alat));
  return [...s].sort((a, b) => a.localeCompare(b));
}

/* ---------- periode ---------- */
function periodBar(st, key, extra) {
  const units = st.units !== false;
  return '<div class="fbar">' +
    '<div class="sbox">' + ic('search') + '<input type="search" placeholder="Cari…" value="' + esc(st.q || '') + '" data-fk="q"></div>' +
    (units ? '<select data-fk="unit"><option value="">Semua unit</option>' + UNITS.concat(st.umum ? ['Umum'] : []).map(u => '<option' + (st.unit === u ? ' selected' : '') + '>' + u + '</option>').join('') + '</select>' : '') +
    (st.month !== undefined ? '<div class="mon"><button class="ibtn sm" data-mon="-1" aria-label="Bulan sebelumnya">' + ic('back') + '</button><input type="month" value="' + esc(st.month || '') + '" data-fk="month"><button class="ibtn sm" data-mon="1" aria-label="Bulan berikutnya">' + ic('right') + '</button><button class="btn ghost sm" data-allmon>' + (st.month ? 'Semua' : 'Bulan ini') + '</button></div>' : '') +
    (extra || '') + '</div>';
}
function bindPeriod(root, st, rerender) {
  $$('[data-fk]', root).forEach(el => {
    const ev = el.type === 'search' ? 'input' : 'change';
    el.addEventListener(ev, (el.type === 'search' ? debounce : f => f)(() => { st[el.dataset.fk] = el.value; rerender(el.type === 'search'); }, 180));
  });
  $$('[data-mon]', root).forEach(b => b.onclick = () => {
    const [y, m] = (st.month || curMonth()).split('-').map(Number);
    const d = new Date(y, m - 1 + (+b.dataset.mon), 1);
    st.month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); rerender();
  });
  const am = $('[data-allmon]', root); if (am) am.onclick = () => { st.month = st.month ? '' : curMonth(); rerender(); };
}
const qMatch = (q, ...xs) => !q || xs.join(' ').toLowerCase().includes(String(q).toLowerCase());
