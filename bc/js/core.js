/* Basecamp Bawen — inti: konfigurasi, server, penyimpanan, utilitas, komponen UI. */
'use strict';
const SB_URL = 'https://herltzublcqpbgyxbbyp.supabase.co';
const SB_KEY = 'sb_publishable_FMSC0iqDRLsRXtvTtZX0Ow_piPi5bli'; // kunci publik; tabel tertutup, hanya fungsi bw_*
const ADMIN_WA = '6282299774825';
const PT = 'PT. Armada Hada Graha';
const CFG = window.BC_CFG || {}; // diisi oleh ahgproduksi.github.io/bc/ (mode tertanam, banyak basecamp); kosong = situs Basecamp Bawen
const BCN = CFG.name || 'Bawen'; // nama basecamp
const BC = CFG.all ? 'Semua Basecamp' : 'Basecamp ' + BCN;
const BCODE = CFG.code || 'BWN'; // kode penomoran dokumen
const LSP = CFG.ls || 'bw.'; // awalan localStorage (per basecamp di mode tertanam)
const EMBED = !!CFG.embed;
const UNITS = ['AMP', 'CMP', 'SCP', 'PCP'];
const UNIT_NAME = { AMP: 'Asphalt Mixing Plant', CMP: 'Concrete Mixing Plant', SCP: 'Stone Crusher Plant', PCP: 'Precast Concrete Plant', Umum: 'Umum / Basecamp' };
const UNIT_PROD = { AMP: 'Hotmix', CMP: 'Readymix', SCP: 'Agregat', PCP: 'Precast' };
const SATUAN = ['Ton', 'M3', 'Kg', 'Liter', 'Pcs', 'Bh', 'Zak', 'M2', 'Meter', 'Pail', 'Drum', 'Unit', 'Set', 'Roll', 'Lembar', 'Batang', 'LS', 'Hari', 'Jam', 'Rit'];
const BUNGA = 0.11 / 12 * 2; // Parameter: bunga modal kerja 11%/tahun x masa perputaran 2 bulan
const BUASO = [['B', 'Bahan'], ['U', 'Upah'], ['A', 'Alat'], ['S', 'Subkon'], ['O', 'Overhead']];

/* ---------- utilitas ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = 'd') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nf0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 });
const rp = n => 'Rp ' + nf0.format(Math.round(+n || 0));
const rpS = n => { const v = +n || 0, a = Math.abs(v); if (a >= 1e9) return 'Rp ' + nf2.format(v / 1e9) + ' M'; if (a >= 1e6) return 'Rp ' + nf2.format(v / 1e6) + ' jt'; return rp(v); };
const num = n => nf2.format(+n || 0);
const num4 = n => nf3.format(+n || 0);
const pct = n => nf2.format((+n || 0) * 100) + '%';
function parseNum(s) {
  if (typeof s === 'number') return s;
  s = String(s ?? '').trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  const v = parseFloat(s);
  return isFinite(v) ? v : 0;
}
// kolom rupiah: titik selalu pemisah ribuan, jadi "2.0000" saat mengetik = 20.000 (bukan 2,0)
function parseMoney(s) {
  s = String(s ?? '').trim().replace(/[^\d.,-]/g, '');
  if ((s.match(/,/g) || []).length > 1) s = s.replace(/\.\d{1,2}$/, ''); else s = s.replace(/,\d*$/, '');
  const d = s.replace(/\D/g, '');
  return d ? (s.startsWith('-') ? -1 : 1) * Number(d) : 0;
}
// kolom angka: saat disunting tampil tanpa titik ribuan ("2000"), dirapikan lagi setelah selesai
const numPlain = s => /^-?\d{1,3}(\.\d{3})+(,\d*)?$/.test(s.trim()) ? s.trim().replace(/\./g, '') : s;
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function tgl(s, long) {
  if (!s) return '-';
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y) return '-';
  return d + ' ' + (long ? BULAN : BLN)[m - 1] + ' ' + y;
}
const tglJam = s => { if (!s) return '-'; const d = new Date(s); return tgl(ymd(d)) + ' ' + String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0'); };
const monthLabel = ym => { if (!ym) return 'Semua periode'; const [y, m] = ym.split('-').map(Number); return BULAN[m - 1] + ' ' + y; };
const curMonth = () => today().slice(0, 7);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const waNorm = s => { let d = String(s || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d; return d; };
const waShow = s => { const d = waNorm(s); return d ? '+' + d.slice(0, 2) + ' ' + d.slice(2, 5) + '-' + d.slice(5, 9) + '-' + d.slice(9) : '-'; };
const waLink = (s, text) => 'https://wa.me/' + waNorm(s) + (text ? '?text=' + encodeURIComponent(text) : '');
const sum = (a, f) => a.reduce((t, x) => t + (+(typeof f === 'function' ? f(x) : x[f]) || 0), 0);
const groupBy = (a, f) => a.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
const byDateDesc = (a, k = 'tgl') => a.sort((x, y) => String(y[k] || '').localeCompare(String(x[k] || '')) || String(y._at || '').localeCompare(String(x._at || '')));
const inMonth = (d, ym) => !ym || String(d || '').slice(0, 7) === ym;
const debounce = (f, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };

/* ---------- server ---------- */
async function rpc(fn, args) {
  if (CFG.rpc) return CFG.rpc(fn, args, rpcRaw);
  return rpcRaw(fn, args);
}
async function rpcRaw(fn, args) {
  const r = await fetch(SB_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {})
  });
  let j = null;
  try { j = await r.json(); } catch { }
  if (!r.ok) throw new Error((j && j.message) || ('HTTP ' + r.status));
  return j;
}

/* ---------- penyimpanan & sinkron ---------- */
const S = {
  token: lsGet(LSP + 'token', ''), user: lsGet(LSP + 'user', null), users: [],
  docs: new Map(), seq: 0, queue: [], online: true, syncing: false, lastSync: 0, listeners: new Set()
};
function cacheKey() { return LSP + 'cache.' + (S.user ? S.user.id : 0); }
function loadCache() {
  const c = lsGet(cacheKey(), null);
  S.docs = new Map(); S.seq = 0;
  if (c && Array.isArray(c.docs)) { c.docs.forEach(d => S.docs.set(d.id, d)); S.seq = c.seq || 0; }
  S.ver = (S.ver || 0) + 1;
  S.queue = lsGet(LSP + 'queue.' + (S.user ? S.user.id : 0), []);
  S.queue.forEach(q => S.docs.set(q.id, Object.assign({}, S.docs.get(q.id), q, { pending: true })));
}
const saveCache = debounce(() => {
  lsSet(cacheKey(), { seq: S.seq, docs: [...S.docs.values()].filter(d => !d.pending) });
  lsSet(LSP + 'queue.' + (S.user ? S.user.id : 0), S.queue);
}, 400);
function emit() { S.ver = (S.ver || 0) + 1; S.listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }

async function syncNow(full) {
  if (!S.token || S.syncing) return;
  S.syncing = true;
  let changed0 = false;
  try {
    if (S.queue.length) {
      const batch = S.queue.slice(0, 200);
      const r = await rpc('bw_put', { p_token: S.token, p_docs: batch.map(q => ({ id: q.id, kind: q.kind, data: q.data, del: !!q.del })) });
      if (r && r.err === 'auth') return authLost();
      if (r && r.rej && r.rej.length) { r.rej.forEach(id => S.docs.delete(id)); full = true; changed0 = true; toast(r.rej.length + ' perubahan ditolak: perlu kata sandi edit', 'err'); EDITK.until = 0; }
      if (r && !r.err) { S.queue = S.queue.slice(batch.length); }
      else if (r && r.err) { toast('Data ditolak server (' + r.err + ')', 'err'); S.queue = S.queue.slice(batch.length); }
    }
    let changed = changed0, more = true, guard = 0;
    while (more && guard++ < 20) {
      const r = await rpc('bw_sync', { p_token: S.token, p_since: full ? 0 : S.seq });
      if (r && r.err === 'auth') return authLost();
      (r.docs || []).forEach(d => {
        const q = S.queue.find(x => x.id === d.id);
        if (!q) { S.docs.set(d.id, d); changed = true; }
      });
      S.seq = Math.max(S.seq, r.seq || 0);
      more = r.more; full = false;
    }
    if (S.queue.length === 0) [...S.docs.values()].forEach(d => { if (d.pending) { d.pending = false; } });
    S.online = true; S.lastSync = Date.now();
    saveCache();
    setNetState();
    if (changed) emit();
    if (S.queue.length) setTimeout(() => syncNow(), 300);
  } catch (e) {
    S.online = false; setNetState();
  } finally { S.syncing = false; }
}
function setNetState() {
  const el = $('#net');
  if (!el) return;
  const p = S.queue.length;
  el.className = 'net ' + (!S.online ? 'off' : p ? 'wait' : 'ok');
  el.title = !S.online ? 'Tidak terhubung — data tersimpan di perangkat dan dikirim saat online' : p ? p + ' perubahan sedang dikirim' : 'Tersinkron ' + tglJam(S.lastSync);
  el.querySelector('span').textContent = !S.online ? 'Offline' : p ? 'Menyimpan' : 'Tersinkron';
}
function put(kind, data, id, del) {
  id = id || uid(kind.slice(0, 2));
  const old = S.docs.get(id);
  const doc = { id, kind, data, by: S.user ? S.user.name : '', at: new Date().toISOString(), created: old ? old.created : new Date().toISOString(), del: !!del, seq: old ? old.seq : 0, pending: true };
  S.docs.set(id, doc);
  S.queue = S.queue.filter(q => q.id !== id);
  S.queue.push({ id, kind, data, del: !!del });
  saveCache(); setNetState(); emit();
  setTimeout(() => syncNow(), 50);
  return id;
}
const save = (kind, data, id) => put(kind, data, id, false);
function remove(id) { const d = S.docs.get(id); if (d) put(d.kind, d.data, id, true); }
function all(kind) {
  const out = [];
  for (const d of S.docs.values()) if (d.kind === kind && !d.del) out.push(Object.assign({}, d.data, { id: d.id, _by: d.by, _at: d.at, _cr: d.created }));
  return out;
}
const get = id => { const d = S.docs.get(id); return d && !d.del ? Object.assign({}, d.data, { id: d.id, _by: d.by, _at: d.at, _cr: d.created }) : null; };

/* ---------- ikon (garis, tanpa emoji) ---------- */
const ICONS = {
  stok: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/><path d="m7.5 5.5 9 5"/>',
  prod: '<path d="M3 21V10l5 3V10l5 3V10l5 3V4h3v17H3Z"/><path d="M7 17h2M12 17h2M17 17h1"/>',
  jual: '<path d="M4 3h16v18l-3-2-2 2-3-2-3 2-2-2-3 2V3Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  kas: '<rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="M2.5 10h19"/><path d="M16 15h2.5"/><path d="M5 6V4.5h13V6"/>',
  cust: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2"/><circle cx="17.2" cy="9" r="2.4"/><path d="M16.5 14.4c2.4.2 4 1.7 4.5 4.6"/>',
  jadwal: '<path d="M2 7h11v9H2z"/><path d="M13 10h4l3.5 3.2V16H13"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
  bahan: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.8" cy="7.8" r="1.4"/>',
  mt: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.6 2.6l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.3-.6-.6-2.3 2.5-2.5Z"/>',
  bppb: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2.8h6v2.6H9z"/><path d="m8.5 11 1.6 1.6L13 9.7"/><path d="M8.5 16.5h7"/>',
  mp: '<path d="M4 15a8 8 0 0 1 16 0"/><path d="M2.5 15h19v2.2h-19z"/><path d="M10 7.2V5h4v2.2"/><path d="M12 19v2"/>',
  mkt: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>',
  dev: '<path d="M3 21h18"/><path d="M5 21V11l7-5 7 5v10"/><path d="M9.5 21v-5h5v5"/><path d="M12 6V3"/>',
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8.4 19L4 20Z"/><path d="M9 9.2c0 3 2.6 5.6 5.6 5.8l1.2-1.4-1.8-1-1 .8a4.6 4.6 0 0 1-2.4-2.4l.8-1-1-1.8L9 9.2Z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h11"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5M12 17.3v.2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6"/><path d="M12 17v.2"/>',
  in: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
  out: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/>',
  scale: '<path d="M12 4v16M5 20h14"/><path d="M4 8h16"/><path d="m4 8-2.5 6a3 3 0 0 0 5 0L4 8ZM20 8l-2.5 6a3 3 0 0 0 5 0L20 8Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  users: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c.6-3.6 3.4-5.6 7-5.6s6.4 2 7 5.6"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
  send: '<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4 18-7Z"/>',
  tag: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M14 13h4M14 16.5h4"/>',
  org: '<rect x="9" y="3" width="6" height="4.5" rx="1"/><rect x="2.5" y="16.5" width="6" height="4.5" rx="1"/><rect x="9" y="16.5" width="6" height="4.5" rx="1"/><rect x="15.5" y="16.5" width="6" height="4.5" rx="1"/><path d="M12 7.5v9M5.5 16.5V12h13v4.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
};
const ic = (n, cls = '') => '<svg class="ic ' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';

/* ---------- toast ---------- */
function toast(msg, type = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = ic(type === 'err' ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>';
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 350); }, type === 'err' ? 4200 : 2600);
}

/* ---------- modal ---------- */
const MODALS = [];
function modal({ title, sub, body, foot, wide, cls, onClose }) {
  const w = document.createElement('div');
  w.className = 'mwrap';
  w.innerHTML = '<div class="mback"></div><div class="mdl ' + (wide ? 'wide ' : '') + (cls || '') + '" role="dialog" aria-modal="true">' +
    '<div class="mhead"><div><h3>' + esc(title) + '</h3>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div><button class="ibtn mx" aria-label="Tutup">' + ic('close') + '</button></div>' +
    '<div class="mbody"></div>' + (foot !== false ? '<div class="mfoot"></div>' : '') + '</div>';
  document.body.appendChild(w);
  const m = { el: w, body: $('.mbody', w), foot: $('.mfoot', w), close };
  if (typeof body === 'string') m.body.innerHTML = body; else if (body) m.body.appendChild(body);
  if (typeof foot === 'string' && m.foot) m.foot.innerHTML = foot;
  function close() {
    if (m.closed) return; m.closed = true;
    w.classList.remove('in');
    MODALS.splice(MODALS.indexOf(m), 1);
    setTimeout(() => w.remove(), 260);
    document.body.classList.toggle('noscroll', MODALS.length > 0);
    onClose && onClose();
  }
  $('.mx', w).onclick = close;
  $('.mback', w).onclick = close;
  MODALS.push(m);
  document.body.classList.add('noscroll');
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('in')));
  return m;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && MODALS.length) MODALS[MODALS.length - 1].close(); });
function confirmBox(title, text, okLabel = 'Hapus', danger = true) {
  return new Promise(res => {
    const m = modal({ title, body: '<p class="ctext">' + esc(text) + '</p>', cls: 'small', onClose: () => res(false) });
    m.foot.innerHTML = '<button class="btn ghost" data-x>Batal</button><button class="btn ' + (danger ? 'danger' : 'pri') + '" data-ok>' + esc(okLabel) + '</button>';
    $('[data-x]', m.foot).onclick = () => m.close();
    $('[data-ok]', m.foot).onclick = () => { res(true); m.closed = true; m.el.classList.remove('in'); MODALS.splice(MODALS.indexOf(m), 1); setTimeout(() => m.el.remove(), 260); document.body.classList.toggle('noscroll', MODALS.length > 0); };
  });
}
function promptBox(title, fields, value) {
  return new Promise(res => { openForm({ title, fields, value: value || {}, small: true, onSave: v => { res(v); return true; }, onCancel: () => res(null) }); });
}

/* ---------- form builder ---------- */
function optList(o, v) {
  const a = typeof o === 'function' ? o(v) : (o || []);
  return a.map(x => typeof x === 'object' ? x : { v: x, t: x });
}
function fieldHtml(f, v) {
  const val = v[f.k];
  const id = 'f_' + f.k;
  const req = f.req ? ' required' : '';
  const ph = f.ph ? ' placeholder="' + esc(f.ph) + '"' : '';
  const dis = f.ro ? ' disabled' : '';
  let inp = '';
  switch (f.type) {
    case 'textarea': inp = '<textarea id="' + id + '" data-k="' + f.k + '" rows="' + (f.rows || 3) + '"' + ph + req + dis + '>' + esc(val) + '</textarea>'; break;
    case 'num': case 'money':
      inp = '<div class="inwrap' + (f.type === 'money' ? ' money' : '') + (f.suffix ? ' suf' : '') + '">' + (f.type === 'money' ? '<i>Rp</i>' : '') +
        '<input id="' + id + '" data-k="' + f.k + '" data-num="1" inputmode="decimal" autocomplete="off" value="' + (val === '' || val == null ? '' : esc(f.type === 'money' ? nf0.format(val) : nf3.format(val))) + '"' + ph + req + dis + '>' +
        (f.suffix ? '<b>' + esc(typeof f.suffix === 'function' ? f.suffix(v) : f.suffix) + '</b>' : '') + '</div>';
      break;
    case 'select': {
      const opts = optList(f.opts, v);
      inp = '<select id="' + id + '" data-k="' + f.k + '"' + req + dis + '>' + (f.empty !== false ? '<option value="">' + esc(f.empty || '— Pilih —') + '</option>' : '') +
        opts.map(o => '<option value="' + esc(o.v) + '"' + (String(o.v) === String(val ?? '') ? ' selected' : '') + '>' + esc(o.t) + '</option>').join('') +
        (val && !opts.some(o => String(o.v) === String(val)) ? '<option value="' + esc(val) + '" selected>' + esc(val) + '</option>' : '') +
        (f.add ? '<option value="__add">+ ' + esc(f.add.label || 'Tambah baru') + '</option>' : '') + '</select>';
      break;
    }
    case 'seg': {
      const opts = optList(f.opts, v);
      inp = '<div class="seg" data-seg="' + f.k + '">' + opts.map(o => '<button type="button" data-v="' + esc(o.v) + '" class="' + (String(o.v) === String(val) ? 'on' : '') + '">' + esc(o.t) + '</button>').join('') + '</div>';
      break;
    }
    case 'check': inp = '<label class="chk"><input type="checkbox" id="' + id + '" data-k="' + f.k + '"' + (val ? ' checked' : '') + dis + '><span>' + esc(f.text || '') + '</span></label>'; break;
    case 'html': inp = '<div class="fhtml" data-html="' + f.k + '">' + (f.html ? f.html(v) : '') + '</div>'; break;
    case 'checks': { const sel = val || []; inp = '<div class="checks">' + optList(f.opts, v).map(o => '<label class="ck"><input type="checkbox" data-ck="' + f.k + '" value="' + esc(o.v) + '"' + (sel.includes(o.v) ? ' checked' : '') + '><span>' + esc(o.t) + '</span></label>').join('') + '</div>'; break; }
    case 'items': inp = itemsHtml(f, v); break;
    case 'list': inp = '<input id="' + id + '" data-k="' + f.k + '" list="dl_' + f.k + '" autocomplete="off" value="' + esc(val) + '"' + ph + req + dis + '><datalist id="dl_' + f.k + '">' + optList(f.opts, v).map(o => '<option value="' + esc(o.v) + '">').join('') + '</datalist>'; break;
    default: inp = '<input id="' + id + '" data-k="' + f.k + '" type="' + (f.type || 'text') + '" value="' + esc(val) + '"' + ph + req + dis + (f.type === 'tel' ? ' inputmode="tel"' : '') + (f.max ? ' maxlength="' + f.max + '"' : '') + ' autocomplete="off">';
  }
  if (f.type === 'html' && !f.label) return '<div class="fld full" data-f="' + f.k + '">' + inp + '</div>';
  return '<div class="fld' + (f.full || ['textarea', 'items', 'html'].includes(f.type) ? ' full' : '') + (f.third ? ' third' : '') + '" data-f="' + f.k + '">' +
    (f.label ? '<label for="' + id + '">' + esc(f.label) + (f.req ? ' <em>*</em>' : '') + '</label>' : '') + inp + (f.help ? '<small>' + esc(typeof f.help === 'function' ? f.help(v) : f.help) + '</small>' : '') + '</div>';
}
function itemsHtml(f, v) {
  const rows = v[f.k] || [];
  return '<div class="items" data-items="' + f.k + '"><table><thead><tr>' + f.cols.map(c => '<th' + (c.w ? ' style="width:' + c.w + '"' : '') + '>' + esc(c.label) + '</th>').join('') + '<th style="width:36px"></th></tr></thead><tbody>' +
    rows.map((r, i) => '<tr>' + f.cols.map(c => {
      const val = r[c.k] ?? '';
      if (c.type === 'select') return '<td><select data-ik="' + c.k + '" data-i="' + i + '">' + '<option value=""></option>' + optList(c.opts, v).map(o => '<option value="' + esc(o.v) + '"' + (String(o.v) === String(val) ? ' selected' : '') + '>' + esc(o.t) + '</option>').join('') + (val && !optList(c.opts, v).some(o => String(o.v) === String(val)) ? '<option selected value="' + esc(val) + '">' + esc(val) + '</option>' : '') + '</select></td>';
      if (c.type === 'list') return '<td><input data-ik="' + c.k + '" data-i="' + i + '" list="dli_' + f.k + c.k + '" value="' + esc(val) + '"></td>';
      if (c.type === 'ro') return '<td class="ro">' + esc(c.f ? c.f(r) : val) + '</td>';
      return '<td><input data-ik="' + c.k + '" data-i="' + i + '"' + (c.num ? ' data-num="1" inputmode="decimal"' : '') + ' value="' + esc(c.num && val !== '' ? nf3.format(val) : val) + '"></td>';
    }).join('') + '<td><button type="button" class="ibtn sm" data-idel="' + i + '" aria-label="Hapus baris">' + ic('close') + '</button></td></tr>').join('') +
    '</tbody></table>' + f.cols.filter(c => c.type === 'list').map(c => '<datalist id="dli_' + f.k + c.k + '">' + optList(c.opts, v).map(o => '<option value="' + esc(o.v) + '">').join('') + '</datalist>').join('') +
    '<button type="button" class="btn ghost sm" data-iadd>' + ic('plus') + 'Tambah baris</button></div>';
}
function openForm({ title, sub, fields, value, onSave, onCancel, wide, small, saveLabel, onDelete, extraBtn }) {
  const v = JSON.parse(JSON.stringify(value || {}));
  fields.forEach(f => { if (v[f.k] === undefined && f.def !== undefined) v[f.k] = typeof f.def === 'function' ? f.def(v) : f.def; });
  const m = modal({ title, sub, wide, cls: small ? 'small' : '', onClose: () => { if (!saved && onCancel) onCancel(); } });
  let saved = false;
  const form = document.createElement('form');
  form.className = 'fgrid';
  form.noValidate = true;
  m.body.appendChild(form);
  const visible = f => !f.show || f.show(v);
  let last = {}, lastKeys = null;
  function render() {
    const fe = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null;
    const vis = fields.filter(visible), keys = vis.map(f => f.k).join('|');
    if (keys === lastKeys && form.children.length === vis.length) { // ganti hanya kolom yang berubah, agar kolom yang sedang dituju tidak kehilangan fokus
      vis.forEach((f, i) => { const h = fieldHtml(f, v); if (h === last[f.k]) return; last[f.k] = h; const el = form.children[i], foc = el.contains(document.activeElement); el.outerHTML = h; if (foc && fe) { const n = form.querySelector('[data-k="' + fe + '"]'); n && n.focus(); } });
      return;
    }
    lastKeys = keys; last = {};
    form.innerHTML = vis.map(f => last[f.k] = fieldHtml(f, v)).join('');
    if (fe) { const el = form.querySelector('[data-k="' + fe + '"]'); el && el.focus(); }
  }
  function refreshHtml() { fields.filter(f => f.type === 'html' && visible(f)).forEach(f => { const el = form.querySelector('[data-html="' + f.k + '"]'); if (el && f.html) el.innerHTML = f.html(v); delete last[f.k]; });
    fields.filter(f => typeof f.help === 'function' && visible(f)).forEach(f => { const el = form.querySelector('[data-f="' + f.k + '"] > small'); if (el) el.textContent = f.help(v); }); }
  function roCells(t, f, row) { const c = f.cols.filter(x => x.type === 'ro'); t.closest('tr').querySelectorAll('td.ro').forEach((el, i) => { el.textContent = c[i].f ? c[i].f(row) : row[c[i].k] ?? ''; }); }
  render();
  form.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.ik !== undefined) { const f = fields.find(x => x.k === t.closest('[data-items]').dataset.items); const row = v[f.k][+t.dataset.i]; row[t.dataset.ik] = t.dataset.num ? parseNum(t.value) : t.value; roCells(t, f, row); refreshHtml(); return; }
    const k = t.dataset.k; if (!k) return; delete last[k];
    const f = fields.find(x => x.k === k);
    v[k] = t.type === 'checkbox' ? t.checked : t.dataset.num ? (t.value.trim() === '' ? '' : f && f.type === 'money' ? parseMoney(t.value) : parseNum(t.value)) : t.value;
    if (f && f.type === 'money' && t.value.trim() !== '' && t.value.trim() !== '-') { const pos = t.value.length - t.selectionStart; t.value = nf0.format(v[k]); try { t.setSelectionRange(t.value.length - pos, t.value.length - pos); } catch { } }
    if (f && f.onInput) f.onInput(v, k);
    refreshHtml();
  });
  form.addEventListener('change', async e => {
    const t = e.target;
    if (t.dataset.ik !== undefined) { const f = fields.find(x => x.k === t.closest('[data-items]').dataset.items); const row = v[f.k][+t.dataset.i]; row[t.dataset.ik] = t.dataset.num ? parseNum(t.value) : t.value; const c = f.cols.find(c => c.k === t.dataset.ik); if (c && c.onChange) { c.onChange(row, v); render(); } else { roCells(t, f, row); last[f.k] = fieldHtml(f, v); } refreshHtml(); return; }
    if (t.dataset.ck) { delete last[t.dataset.ck]; v[t.dataset.ck] = [...form.querySelectorAll('[data-ck="' + t.dataset.ck + '"]:checked')].map(x => x.value); refreshHtml(); return; }
    const k = t.dataset.k; if (!k) return; delete last[k];
    const f = fields.find(x => x.k === k);
    if (t.tagName === 'SELECT' && t.value === '__add' && f.add) {
      t.value = v[k] ?? '';
      const nv = await f.add.fn(v);
      if (nv != null && nv !== '') { v[k] = nv; f.onChange && f.onChange(v, k); }
      render(); refreshHtml(); return;
    }
    v[k] = t.type === 'checkbox' ? t.checked : t.dataset.num ? (t.value.trim() === '' ? '' : f && f.type === 'money' ? parseMoney(t.value) : parseNum(t.value)) : t.value;
    if (t.dataset.num && t.value.trim() !== '') t.value = f && f.type === 'money' ? nf0.format(v[k]) : nf3.format(v[k]);
    if (f && f.onChange) f.onChange(v, k);
    if (fields.some(x => x.show || typeof x.opts === 'function' || x.type === 'items') || (f && f.onChange)) render();
    refreshHtml();
  });
  const isNumIn = t => t.dataset && t.dataset.num && !(t.dataset.k && (fields.find(x => x.k === t.dataset.k) || {}).type === 'money');
  form.addEventListener('focusin', e => { const t = e.target; if (isNumIn(t)) { const p = numPlain(t.value); if (p !== t.value) t.value = p; } });
  form.addEventListener('focusout', e => { const t = e.target; if (isNumIn(t) && t.isConnected && t.value.trim() !== '') t.value = nf3.format(parseNum(t.value)); });
  form.addEventListener('click', e => {
    const sb = e.target.closest('[data-seg] button');
    if (sb) { const k = sb.parentElement.dataset.seg; const f = fields.find(x => x.k === k); v[k] = sb.dataset.v; f.onChange && f.onChange(v, k); render(); refreshHtml(); return; }
    const add = e.target.closest('[data-iadd]');
    if (add) { const k = add.closest('[data-items]').dataset.items; const f = fields.find(x => x.k === k); (v[k] = v[k] || []).push(f.newRow ? f.newRow(v) : {}); render(); refreshHtml(); const rows = form.querySelectorAll('[data-items="' + k + '"] tbody tr'); const last = rows[rows.length - 1]; last && last.querySelector('input,select') && last.querySelector('input,select').focus(); return; }
    const del = e.target.closest('[data-idel]');
    if (del) { const k = del.closest('[data-items]').dataset.items; v[k].splice(+del.dataset.idel, 1); render(); refreshHtml(); }
    const act = e.target.closest('[data-act]');
    if (act) { const f = fields.find(x => x.k === act.closest('[data-f]').dataset.f); f.act && f.act(act.dataset.act, v, () => { render(); refreshHtml(); }); }
  });
  form.addEventListener('submit', e => { e.preventDefault(); doSave(); });
  m.foot.innerHTML = (onDelete ? '<button type="button" class="btn ghost dangert" data-del>' + ic('trash') + 'Hapus</button>' : '') + (extraBtn ? extraBtn.html : '') + '<span class="grow"></span><button type="button" class="btn ghost" data-x>Batal</button><button type="button" class="btn pri" data-s>' + esc(saveLabel || 'Simpan') + '</button>';
  $('[data-x]', m.foot).onclick = () => m.close();
  $('[data-s]', m.foot).onclick = doSave;
  if (onDelete) $('[data-del]', m.foot).onclick = async () => { if (await confirmBox('Hapus data', 'Data ini akan dihapus untuk semua pengguna. Lanjutkan?')) { onDelete(); saved = true; m.close(); toast('Data dihapus'); } };
  if (extraBtn) extraBtn.bind(m.foot, v, m);
  async function doSave() {
    for (const f of fields.filter(visible)) {
      const val = v[f.k];
      if (f.req && (val === '' || val == null || (f.type === 'num' || f.type === 'money') && !(+val > 0) && f.req !== 'zero')) {
        const el = form.querySelector('[data-f="' + f.k + '"]');
        el && el.classList.add('bad'); el && el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => el && el.classList.remove('bad'), 1600);
        toast((f.label || f.k) + ' wajib diisi', 'err'); return;
      }
      if (f.valid) { const msg = f.valid(val, v); if (msg) { toast(msg, 'err'); return; } }
    }
    const r = await onSave(v);
    if (r !== false) { saved = true; m.close(); }
  }
  setTimeout(() => { const first = form.querySelector('input:not([type=checkbox]):not([disabled]),select,textarea'); if (first && window.innerWidth > 760) first.focus(); }, 280);
  return { m, v, render };
}

/* ---------- tabel ---------- */
function table(cols, rows, o = {}) {
  if (!rows.length) return '<div class="empty">' + ic(o.emptyIcon || 'file') + '<p>' + esc(o.empty || 'Belum ada data.') + '</p>' + (o.emptyAct || '') + '</div>';
  const head = '<thead><tr>' + cols.map(c => '<th class="' + (c.num ? 'n' : '') + (c.cls ? ' ' + c.cls : '') + '"' + (c.w ? ' style="width:' + c.w + '"' : '') + '>' + esc(c.t) + '</th>').join('') + '</tr></thead>';
  const body = '<tbody>' + rows.map(r => '<tr' + (o.rowAttr ? ' ' + o.rowAttr(r) : '') + (o.click ? ' class="click" data-row="' + esc(r.id) + '"' : '') + '>' + cols.map(c => {
    let x = c.f ? c.f(r) : r[c.k];
    if (c.money) x = rp(x); else if (c.num && typeof x === 'number') x = num(x);
    return '<td class="' + (c.num || c.money ? 'n' : '') + (c.cls ? ' ' + c.cls : '') + '">' + (c.raw ? x : esc(x ?? '')) + '</td>';
  }).join('') + '</tr>').join('') + '</tbody>';
  let foot = '';
  if (cols.some(c => c.sum)) foot = '<tfoot><tr>' + cols.map((c, i) => { if (!c.sum) return '<td' + (i === 0 ? ' class="tl"' : '') + '>' + (i === 0 ? 'Total' : '') + '</td>'; const t = typeof c.sum === 'function' ? c.sum(rows) : sum(rows, c.sk || c.k); return '<td class="n">' + (c.money ? rp(t) : num(t)) + '</td>'; }).join('') + '</tr></tfoot>';
  return '<div class="tbl"><table>' + head + body + foot + '</table></div>';
}
const chip = (t, k = '') => '<span class="chip ' + k + '">' + esc(t) + '</span>';
const unitChip = u => '<span class="uchip u-' + esc(u) + '">' + esc(u) + '</span>';
const kpi = (label, value, note, tone) => '<div class="kpi ' + (tone || '') + '"><span>' + esc(label) + '</span><b>' + value + '</b>' + (note ? '<small>' + note + '</small>' : '') + '</div>';
const bar = (p, tone) => '<div class="pbar ' + (tone || '') + '"><i style="width:' + Math.max(0, Math.min(100, p * 100)).toFixed(1) + '%"></i></div>';
