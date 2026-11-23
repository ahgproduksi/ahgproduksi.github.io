/* Basecamp Bawen — kerangka halaman modul (judul, tab, filter, hasil). */
'use strict';
const MODS = {};
const ST = {};
function stateOf(k, def) { if (!ST[k]) ST[k] = Object.assign({}, def, lsGet(LSP + 'st.' + k, {})); return ST[k]; }
const persist = k => lsSet(LSP + 'st.' + k, { tab: ST[k].tab, unit: ST[k].unit, view: ST[k].view });
// penanda basecamp di judul kartu (hanya di ahgproduksi.github.io/bc/, tiap basecamp punya warna sendiri)
const BC_TONE = { Bawen: '#1f5fae', 'Bugel-Klontong': '#0f8a6a', Tempuran: '#b8641a', Jogoresan: '#7a4fc2' };
function bcTone(n) { if (BC_TONE[n]) return BC_TONE[n]; let h = 0; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) % 360; return 'hsl(' + h + ' 55% 40%)'; }
const bcBadge = () => CFG.embed && !CFG.all ? ' <span class="bcbadge" style="--bct:' + bcTone(BCN) + '">' + esc(BC) + '</span>' : '';
function page(root, cfg) {
  const st = cfg.st;
  const mod = MODS[cfg.key];
  root.innerHTML =
    '<div class="phead"><div class="ptitle"><span class="ptile">' + ic(mod.icon) + '</span><div><h1>' + esc(mod.title) + bcBadge() + '</h1><p>' + esc(mod.desc) + '</p></div></div>' +
    '<div class="pact">' + (cfg.actions || []).map(a => '<button class="btn ' + (a.pri ? 'pri' : 'ghost') + '" data-pa="' + a.id + '">' + ic(a.icon || 'plus') + '<span>' + esc(a.t) + '</span></button>').join('') +
    (cfg.report ? '<button class="btn dark" data-pa="__pdf">' + ic('print') + '<span>Cetak PDF</span></button>' : '') + '</div></div>' +
    (cfg.tabs ? '<div class="tabs" role="tablist">' + cfg.tabs.map(t => '<button role="tab" data-tab="' + t.k + '" class="' + (st.tab === t.k ? 'on' : '') + '">' + esc(t.t) + '</button>').join('') + '<i class="tabline"></i></div>' : '') +
    '<div class="pfilter"></div><div class="pres"></div>';
  const fil = $('.pfilter', root), res = $('.pres', root);
  function moveLine() {
    const t = $('.tabs', root); if (!t) return;
    const on = $('.on', t), ln = $('.tabline', t);
    if (on && ln) { ln.style.width = on.offsetWidth + 'px'; ln.style.transform = 'translateX(' + on.offsetLeft + 'px)'; }
  }
  function drawFilter() {
    fil.innerHTML = cfg.filter ? cfg.filter(st) : '';
    bindPeriod(fil, st, isSearch => { if (!isSearch) drawFilter(); fill(); });
    cfg.bindFilter && cfg.bindFilter(fil, st, () => { drawFilter(); fill(true); });
  }
  function fill(anim) {
    const sy = window.scrollY;
    res.innerHTML = cfg.body(st);
    if (anim) { res.classList.remove('swap'); void res.offsetWidth; res.classList.add('swap'); }
    cfg.bind && cfg.bind(res, st, fill);
    if (!anim) window.scrollTo(0, sy);
  }
  $$('[data-tab]', root).forEach(b => b.onclick = () => {
    if (st.tab === b.dataset.tab) return;
    st.tab = b.dataset.tab; persist(cfg.key);
    $$('[data-tab]', root).forEach(x => x.classList.toggle('on', x === b));
    moveLine(); drawFilter(); fill(true);
  });
  $$('[data-pa]', root).forEach(b => b.onclick = () => b.dataset.pa === '__pdf' ? runReport(() => cfg.report(st)) : cfg.on[b.dataset.pa](st));
  drawFilter(); fill();
  requestAnimationFrame(moveLine);
  window.addEventListener('resize', moveLine);
  return { fill, drawFilter };
}
function detail({ title, sub, html, buttons, wide = true, bind }) {
  const m = modal({ title, sub, wide, body: html });
  m.foot.innerHTML = '<span class="grow"></span>' + (buttons || []).map(b => '<button class="btn ' + (b.pri ? 'pri' : b.dark ? 'dark' : 'ghost') + (b.danger ? ' dangert' : '') + '" data-db="' + b.id + '">' + (b.icon ? ic(b.icon) : '') + esc(b.t) + '</button>').join('') + '<button class="btn ghost" data-db="__close">Tutup</button>';
  $$('[data-db]', m.foot).forEach(x => x.onclick = () => { if (x.dataset.db === '__close') return m.close(); const b = buttons.find(b => b.id === x.dataset.db); b.fn(m); });
  bind && bind(m.body, m);
  return m;
}
const infoGrid = pairs => '<dl class="igrid">' + pairs.filter(Boolean).map(([k, v, raw]) => '<div><dt>' + esc(k) + '</dt><dd>' + (raw ? v : esc(v ?? '-')) + '</dd></div>').join('') + '</dl>';
const statusTone = s => ({ 'Aman': 'ok', 'Menipis': 'warn', 'Habis': 'bad', 'Kosong': 'mute', 'Lunas': 'ok', 'Sebagian': 'warn', 'Belum dibayar': 'bad', 'Terealisasi': 'ok', 'Belum terealisasi': 'bad', 'Selesai': 'ok', 'Berjalan': 'info', 'Rencana': 'mute', 'Batal': 'mute', 'Terkirim': 'ok', 'Tunda': 'warn', 'Dilaporkan': 'bad', 'Dalam Perbaikan': 'info', 'Menunggu Sparepart': 'warn', 'Menang': 'ok', 'Kalah': 'mute', 'Negosiasi': 'warn', 'Penawaran': 'info', 'Prospek': 'mute', 'Usulan': 'mute', 'Disetujui': 'info', 'Ditunda': 'warn', 'Aktif': 'ok', 'Nonaktif': 'mute', 'Tinggi': 'bad', 'Sedang': 'warn', 'Rendah': 'mute', 'Proses': 'info', 'Ditagihkan': 'warn', 'Diterima': 'ok', 'Revisi': 'warn', 'Piutang': 'warn' }[s] || '');
const stChip = s => chip(s, statusTone(s));

/* ---------- kunci edit (HPP & BUASO, Struktur Organisasi): kata sandi dicek di server, sesi terbuka 2 jam ---------- */
const EDITK = { until: 0 };
const editOpen = () => EDITK.until > Date.now();
async function editGate(area) {
  if (editOpen()) return true;
  try { const r = await rpc('bw_edit_unlock', { p_token: S.token, p_pin: null }); if (r && r.ok) { EDITK.until = Date.parse(r.until) || Date.now() + 36e5; emit(); return true; } } catch { }
  return new Promise(res => {
    openForm({
      title: 'Kata Sandi Edit', sub: 'Mengubah ' + area + ' wajib memasukkan kata sandi', small: true, value: {}, saveLabel: 'Buka kunci', onCancel: () => res(false),
      fields: [{ k: 'pin', label: 'Kata sandi', type: 'password', req: true }],
      onSave: async x => {
        try {
          const r = await rpc('bw_edit_unlock', { p_token: S.token, p_pin: String(x.pin) });
          if (r.err === 'pin') { toast('Kata sandi salah', 'err'); return false; }
          if (r.err === 'locked') { toast('Terlalu banyak percobaan. Coba lagi 15 menit lagi.', 'err'); return false; }
          if (r.err) { toast('Gagal: ' + r.err, 'err'); return false; }
          EDITK.until = Date.parse(r.until) || Date.now() + 36e5;
          toast('Kunci edit terbuka'); setTimeout(() => { res(true); emit(); }, 300);
        } catch (e) { toast('Tidak dapat terhubung ke server', 'err'); return false; }
      }
    });
  });
}
const gated = (area, fn) => (...a) => editGate(area).then(ok => { if (ok) fn(...a); });
async function editRelock() { EDITK.until = 0; try { await rpc('bw_edit_unlock', { p_token: S.token, p_pin: '', p_lock: true }); } catch { } toast('Kunci edit ditutup'); emit(); }
const editBadge = () => editOpen() ? '<div class="note lock open">' + ic('lock') + 'Kunci edit <b>terbuka</b> sampai ' + new Date(EDITK.until).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + '. <button class="btn ghost sm" data-relock>Kunci sekarang</button></div>' : '';
function bindRelock(el) { const b = $('[data-relock]', el); if (b) b.onclick = e => { e.stopPropagation(); editRelock(); }; }
/* rekap penjualan dari sheet (js/jualx.js — hanya dimuat di Kartu Operasional ahgproduksi /bc/) */
const JXON = () => typeof jxHas === 'function' && jxHas();
