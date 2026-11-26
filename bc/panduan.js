/* Kartu 21 "Buku Panduan" — Buku Panduan Penggunaan Virtual Work AHG (PDF) dengan penampil halaman dan tombol unduh.
   PDF berada di /bc/Panduan-Virtual-Work-AHG.pdf (dibuat dari naskah buku panduan, data gambar = data contoh). Penampil memakai PDF.js
   agar semua halaman tampil di HP (iframe PDF di iPhone hanya menampilkan halaman pertama). */
'use strict';
ICONS.zout = '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8M7.5 10.5h6"/>';
ICONS.zin = '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8M7.5 10.5h6M10.5 7.5v6"/>';
ICONS.book = '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z"/><path d="M8 7.5h8M8 11h6"/>';
const PDU = { file: 'Panduan-Virtual-Work-AHG.pdf', title: 'Buku Panduan Penggunaan Virtual Work AHG', doc: null, busy: null, err: '', zoom: 1, io: null };
const PDU_V = (document.currentScript && document.currentScript.src.split('v=')[1]) || '1';
const pduUrl = () => PDU.file + '?v=' + PDU_V;
function pduLib() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = () => rej(new Error('Penampil PDF tidak dapat dimuat. Periksa koneksi internet, atau tekan Unduh PDF.'));
    document.head.appendChild(s);
  });
}
async function pduOpen() {
  if (PDU.doc) return PDU.doc;
  if (!PDU.busy) PDU.busy = (async () => { const lib = await pduLib(); PDU.doc = await lib.getDocument({ url: pduUrl() }).promise; return PDU.doc; })().catch(e => { PDU.busy = null; throw e; });
  return PDU.busy;
}
function pduDownload() {
  const a = document.createElement('a'); a.href = pduUrl(); a.download = 'Buku Panduan Virtual Work AHG.pdf'; document.body.appendChild(a); a.click(); a.remove();
  toast('Buku panduan diunduh');
}
async function pduRender(root) {
  const box = $('.pduv', root), info = $('.pduinfo', root); if (!box) return;
  box.innerHTML = '<div class="empty">' + ic('book') + '<p>Memuat buku panduan…</p></div>';
  let doc;
  try { doc = await pduOpen(); } catch (e) { box.innerHTML = '<div class="empty">' + ic('alert') + '<p>' + esc(e.message || 'Buku panduan tidak dapat dibuka.') + '</p></div>'; return; }
  if (info) info.textContent = doc.numPages + ' halaman · A4';
  box.innerHTML = '';
  const first = await doc.getPage(1), vp0 = first.getViewport({ scale: 1 });
  const W = () => Math.min(box.clientWidth - 2, 980 * PDU.zoom);
  if (PDU.io) PDU.io.disconnect();
  PDU.io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting && !en.target._done) { en.target._done = 1; draw(en.target); } }), { rootMargin: '900px 0px' });
  async function draw(slot) {
    try {
      const pg = await doc.getPage(+slot.dataset.n), w = W(), sc = w / vp0.width, dpr = Math.min(2.5, window.devicePixelRatio || 1);
      const vp = pg.getViewport({ scale: sc * dpr }), c = document.createElement('canvas');
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height); c.style.width = w + 'px'; c.style.height = Math.floor(vp.height / dpr) + 'px';
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      slot.innerHTML = ''; slot.appendChild(c); slot.style.height = '';
    } catch (e) { slot._done = 0; }
  }
  for (let n = 1; n <= doc.numPages; n++) {
    const s = document.createElement('div'); s.className = 'pdup'; s.dataset.n = n;
    s.style.height = Math.round(W() * vp0.height / vp0.width) + 'px'; s.style.width = W() + 'px';
    s.innerHTML = '<span>Halaman ' + n + '</span>';
    box.appendChild(s); PDU.io.observe(s);
  }
}
MODS.panduan = {
  title: 'Buku Panduan', icon: 'book', desc: 'Buku Panduan Penggunaan Virtual Work AHG: seluruh menu, fitur, dan aturan Administrator (PDF)',
  render(root) {
    const st = stateOf('panduan', {});
    const ctl = page(root, {
      key: 'panduan', st,
      actions: [{ id: 'dl', t: 'Unduh PDF', icon: 'dl', pri: true }, { id: 'tab', t: 'Buka di tab baru', icon: 'right' }, { id: 'zo', t: 'Perkecil', icon: 'zout' }, { id: 'zi', t: 'Perbesar', icon: 'zin' }],
      on: { dl: () => pduDownload(), tab: () => window.open(pduUrl(), '_blank'), zo: () => { PDU.zoom = Math.max(.6, PDU.zoom - .15); pduRender(root); }, zi: () => { PDU.zoom = Math.min(1.6, PDU.zoom + .15); pduRender(root); } },
      body: () => '<div class="note pdunote">' + ic('book') + '<span><b>' + esc(PDU.title) + '</b> · Nomor dokumen AHG/UP/BP-VW/001 · Revisi 00 · <span class="pduinfo">PDF A4</span>. Gambar di dalam buku memakai data contoh.</span></div><div class="pduv"></div>',
      bind: () => pduRender(root)
    });
    APP.ctl = ctl; return ctl;
  },
  summary() { return { main: 'Panduan PDF', sub: 'Lihat atau unduh buku panduan' }; }
};
