/* ahgproduksi.github.io/bc/ — tab "Input Produksi Unit" di kartu Produksi (pengganti menu Ruang Kerja › Unit, 2026-11-26).
   Data tetap satu sumber: ahg_items kind 'unit' cat 'produksi' milik Virtual Work AHG, dibaca dan diubah lewat halaman induk
   (window.parent.AHG_BC di deploy-ahg/src/kartu.js) — form input/ubah/hapus dan export PDF/Excel memakai dialog Virtual Work.
   Dimuat setelah m-stok-prod.js (MODS.prod memakai UNITX bila ada) dan sebelum app.js. */
'use strict';
var UNITX = (function () {
  const call = (f, ...a) => { try { const p = CFG.parent; return p && typeof p[f] === 'function' ? p[f](...a) : undefined; } catch (e) { console.error(e); return undefined; } };
  const on = () => !!(CFG.embed && CFG.parent && CFG.parent.unitRows && call('unitOn'));
  const bcName = () => CFG.all ? '*' : CFG.name;
  let flash = '', last = '';
  const css = document.createElement('style');
  css.textContent = '.tbl tr[data-uxf] td{background:#fff4cc;transition:background 1.2s}.uxnote b{font-weight:600}.ux-ro td{cursor:default}.ux-dt small{display:block;color:var(--muted,#6b7a90);font-size:11.5px}';
  document.head.appendChild(css);
  const jam = ms => { if (!ms) return ''; const d = new Date(ms); return tgl(ymd(d)) + ' ' + String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0'); };
  function rows(s, all) {
    return (call('unitRows', all ? '*' : bcName()) || [])
      .filter(r => (!s.unit || r.unit === s.unit) && (!s.month || String(r.date).startsWith(s.month)) && qMatch(s.q, r.unit, r.nama, r.size, r.note, r.owner, r.basecamp))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.created || 0) - (a.created || 0));
  }
  function totals(l, by) {
    const m = new Map();
    l.forEach(r => { const k = (by ? by(r) + '|' : '') + r.unit + '|' + r.sat; const t = m.get(k) || { key: by ? by(r) : '', unit: r.unit, nama: r.nama, sat: r.sat, v: 0, n: 0, d: new Set() }; t.v += r.volume; t.n++; t.d.add(r.date); m.set(k, t); });
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key) || UNITS.indexOf(a.unit) - UNITS.indexOf(b.unit) || a.unit.localeCompare(b.unit));
  }
  function html(s) {
    const l = rows(s), tot = totals(l), per = s.month ? monthLabel(s.month) : 'Semua periode', one = tot.length === 1;
    const cols = [
      { t: 'Tanggal', f: r => tgl(r.date) },
      { t: 'Unit', f: r => unitChip(r.unit), raw: true },
      { t: 'Produk / ukuran', f: r => '<b>' + esc(r.nama || r.unit) + '</b>' + (r.size ? '<small>' + esc(r.size) + '</small>' : ''), raw: true },
      { t: 'Volume', f: r => '<b>' + num(r.volume) + '</b> ' + esc(r.sat), num: true, raw: true, sum: one ? rs => sum(rs, 'volume') : undefined },
      { t: 'Keterangan', f: r => r.note || '-' },
      { t: 'Dicatat oleh', f: r => esc(r.owner) + '<small>' + esc(jam(r.created)) + '</small>', raw: true, cls: 'ux-dt' }
    ];
    return '<div class="note uxnote">' + ic('prod') + '<span>Input produksi harian per unit (dulu menu <b>Unit</b> di Ruang Kerja). Klik baris untuk mengubah atau menghapus — hanya pencatat atau admin.</span></div>' +
      '<div class="kpis">' + (tot.length ? tot.map(t => kpi(t.unit + (t.nama ? ' · ' + t.nama : ''), num(t.v) + ' <small>' + esc(t.sat) + '</small>', t.n + ' input · ' + t.d.size + ' hari')).join('') : kpi('Produksi unit', '0', esc(per))) + '</div>' +
      '<section class="card"><div class="chead"><div><h3>Input produksi unit</h3></div><div class="cmeta">' + esc(per) + ' · ' + l.length + ' input <button class="btn ghost sm" data-uxx>' + ic('file') + '<span>Excel</span></button></div></div>' +
      table(cols, l, {
        click: true, rowAttr: r => (r.id === flash ? 'data-uxf ' : '') + (r.ed ? 'title="Klik untuk mengubah"' : 'title="Hanya pencatat atau admin yang bisa mengubah"'),
        empty: 'Belum ada input produksi unit pada periode ini.', emptyIcon: 'prod', emptyAct: '<button class="btn pri" data-uxadd>' + ic('plus') + '<span>Input Produksi Unit</span></button>'
      }) + '</section>';
  }
  function bind(el, s) {
    $$('[data-row]', el).forEach(tr => tr.onclick = () => call('unitEdit', tr.dataset.row));
    const x = $('[data-uxx]', el); if (x) x.onclick = () => exp(s, 'xlsx');
    const a = $('[data-uxadd]', el); if (a) a.onclick = add;
    if (flash) { const f = $('[data-uxf]', el); if (f) setTimeout(() => f.isConnected && f.scrollIntoView({ block: 'center', behavior: 'instant' }), 80); const id = flash; setTimeout(() => { if (flash === id) { flash = ''; const g = $('[data-uxf]'); if (g) g.removeAttribute('data-uxf'); } }, 3500); }
  }
  function applyWant(st) {
    const w = call('takeWant'); if (!w || w.tab !== 'unit') return false;
    st.tab = 'unit'; if (w.month) st.month = w.month; flash = w.id || ''; persist('prod'); return true;
  }
  function takeWant() { if (APP.route !== 'prod') return; if (applyWant(stateOf('prod', {}))) route(); } // kartu Produksi sudah terbuka → pindah ke tab Unit
  const add = () => call('unitNew', bcName());
  const exp = (s, fmt) => call('unitExport', bcName(), s.month || '', s.unit || '', s.q || '', fmt);
  function allHtml() { // Rekap Semua Basecamp › Produksi: total input produksi unit bulan ini per basecamp
    const m = curMonth(), l = rows({ month: m }, true), t = totals(l, r => r.basecamp);
    return '<section class="card" style="margin-top:16px"><div class="chead"><div><h3>Input produksi unit · ' + esc(monthLabel(m)) + '</h3></div><div class="cmeta">' + l.length + ' input · pilih basecamp untuk rincian</div></div>' +
      table([{ t: 'Basecamp', f: r => r.key }, { t: 'Unit', f: r => unitChip(r.unit), raw: true }, { t: 'Volume', f: r => '<b>' + num(r.v) + '</b> ' + esc(r.sat), num: true, raw: true }, { t: 'Input', f: r => r.n, num: true }, { t: 'Hari', f: r => r.d.size, num: true }],
        t.map(r => Object.assign(r, { id: r.key + '|' + r.unit })), { empty: 'Belum ada input produksi unit bulan ini.', emptyIcon: 'prod' }) + '</section>';
  }
  setInterval(() => { // data Unit berubah di Virtual Work (input baru, ubah, hapus, sinkron) → segarkan tab
    if (!on()) return;
    const v = call('unitVer') || ''; if (v === last) return;
    const first = !last; last = v; if (first) return;
    if (CFG.all) { window.dispatchEvent(new Event('unitx')); return; }
    if (APP.route === 'prod' && APP.ctl && stateOf('prod', {}).tab === 'unit' && !MODALS.length) APP.ctl.fill();
  }, 1500);
  return { on, html, bind, applyWant, takeWant, add, exp, allHtml };
})();
