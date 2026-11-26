/* ahgproduksi.github.io/bc/ — dimuat SETELAH app.js. Akun = sesi Virtual Work AHG; ?bc=* = Rekap Semua Basecamp. */
'use strict';
(function () {
  const P = CFG.parent, sess = CFG.sess;
  const disp = () => { try { return P && P.display ? P.display() : ''; } catch { return ''; } };
  S.token = CFG.token;
  if (sess && sess.name) {
    const u = lsGet(LSP + 'user', null);
    S.user = u && u.id === sess.name ? u : { id: sess.name, name: disp() || sess.name, role: 'user', jabatan: '', wa: '' };
  } else S.user = null;
  // Guide.pdf Basecamp Bawen: /bc/Guide.pdf (situs ahgbawen sudah digabung ke sini)
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href="Guide.pdf"]'); if (a) { e.preventDefault(); window.open('/bc/Guide.pdf', '_blank', 'noopener'); } }, true);
  // form terbuka → beri tahu halaman induk supaya tombol chat mengambang tidak menutupi tombol Simpan/Batal
  try {
    const pb = P && window.parent !== window && window.parent.document.body;
    if (pb) {
      const mark = () => pb.classList.toggle('bcmodal', !!document.querySelector('.mwrap'));
      new MutationObserver(mark).observe(document.body, { childList: true }); mark();
      addEventListener('pagehide', () => pb.classList.remove('bcmodal'));
    }
  } catch {}
  if (!CFG.all) return;

  /* ---------- Rekap Semua Basecamp ---------- */
  const list = () => { try { return P && P.list ? P.list() : []; } catch { return []; } };
  const R0 = { bcs: [], data: {}, busy: false, err: '' };
  async function loadBc(bc) {
    const key = 'ahgbc.' + bc + '.cache.' + S.user.id;
    const c = lsGet(key, null) || { seq: 0, docs: [] };
    const m = new Map(); (c.docs || []).forEach(d => m.set(d.id, d));
    let seq = c.seq || 0, more = true, guard = 0, changed = false;
    while (more && guard++ < 20) {
      const r = await rpcRaw('bc_sync', { p_token: S.token, p_bc: bc, p_since: seq });
      if (r && r.err === 'auth') { authLost(); throw new Error('auth'); }
      if (!r || r.err) throw new Error(r && r.err || 'server');
      (r.docs || []).forEach(d => { m.set(d.id, d); changed = true; });
      seq = Math.max(seq, r.seq || 0); more = r.more;
    }
    if (changed) lsSet(key, { seq, docs: [...m.values()] });
    m._seq = seq;
    return m;
  }
  function withDocs(m, fn) { const keep = S.docs; S.docs = m; S.ver = (S.ver || 0) + 1; try { return fn(); } catch (e) { console.error(e); return null; } finally { S.docs = keep; S.ver = (S.ver || 0) + 1; } }
  function statsOf(bc) {
    const m = R0.data[bc]; if (!m) return null;
    return withDocs(m, () => {
      const jd = jualData({ month: curMonth() }), kt = kasTotals();
      const jx = typeof jxJualSum === 'function' && JXON() ? jxJualSum(curMonth()) : { nilai: 0, profit: 0 }; // penjualan rekap sheet (mis. batu Jogoresan)
      const prodM = all('prod').filter(p => p.status !== 'Batal' && inMonth(p.tgl, curMonth()));
      let low = 0; UNITS.forEach(u => stockSaldo(u).forEach(r => { if ((r.status === 'Menipis' || r.status === 'Habis') && (r.masuk || r.prod || r.keluar)) low++; }));
      const mt = all('mt').filter(x => x.status !== 'Selesai');
      return {
        jual: jd.nilai + jx.nilai, profit: jd.profit + jx.profit, so: prodM.length, soNilai: sum(prodM, p => p.vol * p.harga), saldo: kt.saldo, piutang: kt.piutang, hutang: kt.hutang, telat: kt.telat,
        low, mt: mt.length, mtLate: mt.filter(mtLate).length, bppb: all('bppb').filter(b => b.rilis === 'Belum rilis').length,
        mp: all('mp').filter(x => x.status !== 'Nonaktif').length, docs: [...m.values()].filter(d => !d.del).length
      };
    });
  }
  /* BPPB belum rilis diklasifikasikan per basecamp (lokasi sheet + unit) */
  function bppbAllData() {
    return R0.bcs.map(bc => {
      const m = R0.data[bc];
      if (!m) return { bc, load: true };
      return withDocs(m, () => {
        const bs = all('bppb').filter(b => b.rilis === 'Belum rilis');
        const it = []; bs.forEach(b => (b.items || []).forEach(i => it.push(Object.assign({ b, st: itemSt(i) }, i))));
        const loks = [...new Set(bs.map(b => b.lokasi || 'BC ' + bc))].sort();
        return {
          bc, n: bs.length, items: it.length, loks: loks.map(l => ({ l, n: bs.filter(b => (b.lokasi || 'BC ' + bc) === l).length })),
          unit: UNITS.concat('Umum').map(u => [u, bs.filter(b => b.unit === u).length]).filter(x => x[1]),
          noPo: it.filter(i => i.st === 'Belum ter PO').length, po: it.filter(i => i.st === 'Sudah PO, belum terbayar' || i.st === 'Datang, belum terbayar').length,
          rilis: it.filter(i => i.st === 'Sudah rilis').length, nilai: sum(it, i => (+i.qty || 1) * (+i.harga || 0)),
          top: byDateDesc(bs).slice(0, 5)
        };
      }) || { bc, load: true };
    });
  }
  function bppbAll() {
    const d = bppbAllData(), ok = d.filter(x => !x.load), T = k => sum(ok, x => x[k]);
    const cols = [
      { t: 'Basecamp', f: x => '<span class="bcbadge sm" style="--bct:' + bcTone(x.bc) + '">' + esc(x.bc) + '</span>', raw: true },
      { t: 'Lokasi sheet', f: x => x.load ? 'Memuat…' : x.loks.map(l => esc(l.l) + ' <small class="muted">(' + l.n + ')</small>').join('<br>') || '-', raw: true },
      { t: 'Unit', f: x => x.load ? '' : '<span class="bcx-u">' + x.unit.map(([u, n]) => '<span>' + unitChip(u) + '<small>' + n + '</small></span>').join('') + '</span>' || '-', raw: true },
      { t: 'BPPB belum rilis', f: x => x.load ? '' : num(x.n), num: true }, { t: 'Item', f: x => x.load ? '' : num(x.items), num: true },
      { t: 'Belum ter PO', f: x => x.load ? '' : '<b class="' + (x.noPo ? 't-bad' : '') + '">' + num(x.noPo) + '</b>', num: true, raw: true },
      { t: 'Sudah PO', f: x => x.load ? '' : num(x.po), num: true }, { t: 'Sudah rilis', f: x => x.load ? '' : num(x.rilis), num: true },
      { t: 'Estimasi nilai', f: x => x.load ? '' : rpS(x.nilai), num: true },
      { t: '', f: x => '<button class="btn sm" data-pick="' + esc(x.bc) + '">Buka' + ic('right') + '</button>', raw: true }
    ];
    return '<div class="sech"><h2>Klasifikasi BPPB per Basecamp</h2><p>Baris sheet "List permintaan BPPB belum dirilis" dibagi ke basecamp masing-masing: BC Bugel &amp; BC Klontong → Bugel-Klontong, BC Bawen → Bawen, BC Tempuran → Tempuran, BC Jogoresan → Jogoresan. Total ' + num(T('n')) + ' BPPB · ' + num(T('items')) + ' item · ' + rpS(T('nilai')) + '.</p></div>' +
      '<section class="card flush">' + table(cols, d.map((x, i) => Object.assign({ id: i }, x))) + '</section>' +
      ok.filter(x => x.n).map(x => '<section class="card"><div class="chead"><h3 class="bcx-h"><span class="bcbadge sm" style="--bct:' + bcTone(x.bc) + '">' + esc(x.bc) + '</span> BPPB terbaru</h3><button class="btn sm ghost" data-pick="' + esc(x.bc) + '">Semua ' + num(x.n) + ' BPPB' + ic('right') + '</button></div>' +
        table([{ t: 'No. BPPB', f: b => '<b>' + esc(b.no) + '</b><small>' + tgl(b.tgl) + '</small>', raw: true }, { t: 'Lokasi', f: b => b.lokasi || '-' }, { t: 'Unit', f: b => unitChip(b.unit), raw: true },
          { t: 'Rincian', f: b => esc((b.items || []).map(i => i.nama).filter(Boolean).slice(0, 3).join(', ') + ((b.items || []).length > 3 ? ' +' + ((b.items || []).length - 3) + ' item' : '')), raw: true, cls: 'wrap' },
          { t: 'Item', f: b => (b.items || []).length, num: true }], x.top) + '</section>').join('');
  }
  const sumOf = (bc, k) => R0.data[bc] ? withDocs(R0.data[bc], () => MODS[k].summary()) : null;
  const pick = (bc, r) => { if (P && P.pick) P.pick(bc, r); };

  /* ---------- Semua Basecamp = kartu asli dengan data gabungan semua basecamp ----------
     S.docs diganti gabungan dokumen tiap basecamp (data._bc = basecamp asal); tabel diberi kolom Basecamp;
     simpan/ubah/hapus dikirim ke basecamp pemilik data, data baru menanyakan basecamp tujuan. */
  const MERGE = { stok: 1, prod: 1, proj: 1, cust: 1, jadwal: 1, bahan: 1, mt: 1, bppb: 1, mp: 1, mkt: 1, dev: 1 };
  const MG = { on: false, ver: -1, last: '', bc: '', bcAt: 0, pend: 0, wait: [], asking: false };
  R0.ver = 0;
  function mergeDocs() {
    const M = new Map();
    R0.bcs.forEach(bc => {
      const m = R0.data[bc]; if (!m) return;
      m.forEach((d, id) => {
        const key = M.has(id) ? bc + '::' + id : id;
        M.set(key, Object.assign({}, d, { id: key, _bc: bc, _oid: id, data: Object.assign({}, d.data, { _bc: bc }) }));
      });
    });
    return M;
  }
  const bcOfRow = x => { if (!x || typeof x !== 'object') return ''; if (x._bc) return x._bc; for (const k in x) { const v = x[k]; if (v && typeof v === 'object' && !Array.isArray(v) && v._bc) return v._bc; } return ''; };
  const table0 = window.table;
  window.table = function (cols, rows, o) {
    if (MG.on && rows && rows.length && !cols.some(c => c.t === 'Basecamp') && rows.some(bcOfRow))
      cols = [{ t: 'Basecamp', f: x => { const b = bcOfRow(x); return b ? '<span class="bcbadge sm" style="--bct:' + bcTone(b) + '">' + esc(b) + '</span>' : ''; }, raw: true }].concat(cols);
    return table0(cols, rows, o);
  };
  const refill = debounce(() => { if (MG.on && APP.ctl) { APP.ctl.fill(); mgExtra(); } }, 60);
  // referensi ke dokumen lain (mis. pembayaran → invoice) menentukan basecamp & dikembalikan ke id asli
  function refBc(data) {
    let bc = '';
    const out = {};
    for (const k in data) {
      const v = data[k];
      const d = typeof v === 'string' && v.length > 3 ? S.docs.get(v) : null;
      if (d && d._bc) { bc = bc || d._bc; out[k] = d._oid; } else out[k] = v;
    }
    delete out._bc;
    return { bc, data: out };
  }
  function sendPut(bc, doc) {
    MG.pend++;
    const q = (MG.q = MG.q || {});
    q[bc] = (q[bc] || Promise.resolve()).then(async () => {
      try {
        const r = await rpcRaw('bc_put', { p_token: S.token, p_bc: bc, p_docs: [doc] });
        if (r && r.err === 'auth') { authLost(); return; }
        if (r && r.rej && r.rej.length) { EDITK.until = 0; toast('Perubahan ditolak: perlu kata sandi edit', 'err'); }
        else if (r && r.err) toast('Data ditolak server (' + r.err + ')', 'err');
      } catch { toast('Gagal menyimpan ke ' + bc + ' — periksa koneksi internet', 'err'); }
      try { R0.data[bc] = await loadBc(bc); R0.ver++; } catch { }
    }).finally(() => { MG.pend--; if (!MG.pend) draw(); });
    return q[bc];
  }
  function mgPut(kind, data, id, del) {
    const cur = id ? S.docs.get(id) : null;
    const rb = refBc(data || {});
    let bc = (cur && cur._bc) || (data && data._bc) || rb.bc || '';
    const oid = cur ? cur._oid : (id || uid(kind.slice(0, 2)));
    const key = cur ? cur.id : oid;
    const now = new Date().toISOString();
    const raw = { id: oid, kind, data: rb.data, by: S.user ? S.user.name : '', at: now, created: cur ? cur.created : now, del: !!del, seq: cur ? cur.seq : 0, pending: true };
    if (!bc && MG.bc && Date.now() - MG.bcAt < 4000) bc = MG.bc; // beberapa dokumen dari satu simpan
    const show = b => { S.docs.set(key, Object.assign({}, raw, { id: key, _bc: b, _oid: oid, data: Object.assign({}, rb.data, { _bc: b }) })); S.ver = (S.ver || 0) + 1; refill(); };
    if (bc && R0.data[bc]) {
      R0.data[bc].set(oid, raw); show(bc);
      MG.wait.forEach(w => w.key === key && w.res(bc));
      sendPut(bc, { id: oid, kind, data: rb.data, del: !!del });
      return key;
    }
    show('');
    let res; const pr = new Promise(r => { res = r; });
    MG.wait.push({ key, res, pr, raw, kind });
    askBc();
    return key;
  }
  function askBc() {
    if (MG.asking) return; MG.asking = true;
    setTimeout(() => {
      const n = MG.wait.filter(w => !w.done).length;
      openForm({
        title: 'Simpan ke Basecamp', sub: n > 1 ? n + ' data baru' : 'Data baru ini milik basecamp mana?', small: true, value: { bc: MG.bc || '' }, saveLabel: 'Simpan',
        fields: [{ k: 'bc', label: 'Basecamp', type: 'select', opts: R0.bcs.filter(b => R0.data[b]), req: true }],
        onCancel: () => { MG.asking = false; MG.wait.filter(w => !w.done).forEach(w => { w.done = true; S.docs.delete(w.key); w.res(''); }); MG.wait = []; S.ver++; refill(); toast('Data baru tidak disimpan', 'err'); },
        onSave: x => {
          MG.asking = false; MG.bc = x.bc; MG.bcAt = Date.now();
          const ws = MG.wait.filter(w => !w.done); MG.wait = [];
          ws.forEach(w => { w.done = true; R0.data[x.bc].set(w.raw.id, w.raw); S.docs.set(w.key, Object.assign({}, w.raw, { id: w.key, _bc: x.bc, _oid: w.raw.id, data: Object.assign({}, w.raw.data, { _bc: x.bc }) })); sendPut(x.bc, { id: w.raw.id, kind: w.kind, data: w.raw.data, del: false }); w.res(x.bc); });
          S.ver++; refill(); toast('Tersimpan di Basecamp ' + x.bc);
        }
      });
    }, 30);
  }
  // basecamp dokumen (menunggu pilihan basecamp untuk data baru)
  const docBc = id => { const d = S.docs.get(id); if (d && d._bc) return Promise.resolve(d._bc); const w = MG.wait.find(w => w.key === id); return w ? w.pr : Promise.resolve(''); };
  const put0 = window.put;
  window.put = (kind, data, id, del) => MG.on ? mgPut(kind, data, id, del) : put0(kind, data, id, del);
  // gaji Man Power: satu kata sandi gaji untuk semua basecamp
  const rpc0 = CFG.rpc;
  CFG.rpc = async (fn, a, raw) => {
    if (fn === 'bw_gaji_get') {
      const out = {}, bcs = R0.bcs.filter(b => R0.data[b]);
      for (let i = 0; i < bcs.length; i++) {
        const r = await raw('bc_gaji_get', Object.assign({}, a, { p_bc: bcs[i] }));
        if (r && r.err) { if (i === 0 || r.err === 'pin' || r.err === 'auth') return r; continue; }
        const g = (r && r.gaji) || {};
        for (const id in g) { let key = id; for (const [k, d] of S.docs) if (d._bc === bcs[i] && d._oid === id) { key = k; break; } out[key] = g[id]; }
      }
      return { ok: true, gaji: out };
    }
    if (fn === 'bw_gaji_set') {
      const bc = await docBc(a.p_id); if (!bc) return { err: 'basecamp' };
      const d = S.docs.get(a.p_id);
      return raw('bc_gaji_set', Object.assign({}, a, { p_bc: bc, p_id: d ? d._oid : a.p_id }));
    }
    if ((fn === 'bw_put' || fn === 'bw_sync') && !a.p_bc) return { err: 'semua' }; // tidak pernah ke basecamp "Semua"
    return rpc0(fn, a, raw);
  };
  // ringkasan & tombol buka per basecamp di bawah kartu gabungan
  function mgExtra() {
    const main = $('#main'); if (!main || !main.querySelector('.pres')) return;
    let box = $('.mgx', main); if (!box) { main.insertAdjacentHTML('beforeend', '<div class="mgx"></div>'); box = $('.mgx', main); }
    const r = APP.route, mod = MODS[r];
    const html = (r === 'bppb' ? bppbAll() : '') +
      '<div class="sech"><h2>Per Basecamp</h2><p>Ringkasan ' + esc(mod.title) + ' tiap basecamp' + (R0.busy ? ' — memuat data…' : '') + '. Buka basecamp untuk melihat kartunya sendiri.</p></div><div class="cards">' + R0.bcs.map((bc, i) => {
        const s = sumOf(bc, r) || {};
        return '<a class="mcard" href="#" data-pick="' + esc(bc) + '" style="--d:' + (i * 35) + 'ms;--bct:' + bcTone(bc) + '"><div class="mtop"><span class="mic">' + ic('home') + '</span><em>' + String(i + 1).padStart(2, '0') + '</em></div><h3>Basecamp ' + esc(bc) + '</h3><p>' + esc(mod.title) + '</p>' +
          '<div class="mstat ' + (s.tone || '') + '"><b>' + esc(R0.data[bc] ? s.main || '' : 'Memuat…') + '</b><span>' + esc(s.sub || '') + '</span></div><span class="mgo">Buka kartu' + ic('right') + '</span></a>';
      }).join('') + '</div>';
    if (box._h === html) return;
    box._h = html; box.innerHTML = html;
    $$('[data-pick]', box).forEach(b => b.onclick = e => { e.preventDefault(); pick(b.dataset.pick, r); });
  }
  function mergedView(main, r) {
    MG.on = true;
    if (!main._mgo) { main._mgo = new MutationObserver(() => { if (MG.on && main.querySelector('.pres') && !main.querySelector('.mgx')) mgExtra(); }); main._mgo.observe(main, { childList: true }); } // halaman digambar ulang (mis. Tampilkan Gaji)
    let changed = false;
    if (MG.ver !== R0.ver && !MG.pend && !MG.wait.length) { S.docs = mergeDocs(); MG.ver = R0.ver; S.ver = (S.ver || 0) + 1; changed = true; }
    if (main._h !== 'mg:' + r || !APP.ctl || !main.querySelector('.pres')) {
      main._h = 'mg:' + r; main._f = 0;
      APP.ctl = MODS[r].render(main);
      mgExtra();
      void main.offsetWidth; main.classList.add('enter');
    } else if (changed) { APP.ctl.fill(); mgExtra(); }
    else mgExtra();
  }
  function draw() {
    const main = $('#main'); if (!main) return;
    const r = APP.route, mod = MODS[r];
    const bcs = R0.bcs; let html;
    const head = '<div class="phead"><div class="ptitle"><span class="ptile">' + ic(mod ? mod.icon : 'home') + '</span><div><h1>' + esc(mod ? mod.title : 'Rekap Semua Basecamp') + '</h1><p>' +
      esc(r === 'kas' ? 'Cash flow seluruh basecamp: rincian uang masuk, uang keluar, piutang, dan hutang tiap basecamp dengan grand total.' : mod ? 'Ringkasan kartu ini di setiap basecamp. Pilih basecamp untuk membuka dan mengisi data.' : 'Ringkasan operasional seluruh basecamp PT. Armada Hada Graha — unit AMP, CMP, SCP, dan PCP.') + '</p></div></div>' +
      '<div class="pact"><button class="btn ghost" data-rf>' + ic('refresh') + '<span>Muat ulang</span></button>' + (r === 'perf' ? '<button class="btn dark" data-pfpdf>' + ic('print') + '<span>Cetak PDF</span></button>' : r === 'kas' ? '<button class="btn dark" data-kapdf>' + ic('print') + '<span>Cetak PDF</span></button>' : r === 'jual' ? '<button class="btn dark" data-jxpdf>' + ic('print') + '<span>Cetak PDF</span></button>' : mod ? '' : '<button class="btn dark" data-pdf>' + ic('print') + '<span>Cetak PDF</span></button>') + '</div></div>';
    if (!bcs.length) { html = head + '<div class="empty">' + ic('home') + '<p>Belum ada basecamp.</p></div>'; put(main, html); return; }
    if (r === 'flow' || r === 'sk') { MG.on = false; if (main._h !== r || !APP.ctl) { main._h = r; main._f = 1; APP.ctl = MODS[r].render(main); } return; }
    if (mod && MERGE[r]) { mergedView(main, r); return; }
    if (MG.on) { MG.on = false; main._h = ''; APP.ctl = null; }
    if (main._f) { main._f = 0; main._h = ''; APP.ctl = null; }
    if (r === 'perf') { pfAllMount(main, head, bcs, R0.data); const rf = $('[data-rf]', main); if (rf) rf.onclick = () => loadAll(true); return; }
    if (r === 'jual' && typeof jxAllHtml === 'function') { jualAll(main, head); return; }
    if (r === 'kas') { kasAll(main, head); return; }
    if (mod) {
      html = head + (R0.err ? '<div class="note">' + esc(R0.err) + '</div>' : '') + '<div class="cards">' + bcs.map((bc, i) => {
        const s = sumOf(bc, r) || {};
        return '<a class="mcard" href="#" data-pick="' + esc(bc) + '" style="--d:' + (i * 35) + 'ms;--bct:' + bcTone(bc) + '"><div class="mtop"><span class="mic">' + ic('home') + '</span><em>' + String(i + 1).padStart(2, '0') + '</em></div><h3>Basecamp ' + esc(bc) + '</h3><p>' + esc(mod.title) + '</p>' +
          '<div class="mstat ' + (s.tone || '') + '"><b>' + esc(R0.data[bc] ? s.main || '' : 'Memuat…') + '</b><span>' + esc(s.sub || '') + '</span></div><span class="mgo">Buka kartu' + ic('right') + '</span></a>';
      }).join('') + '</div>' + (r === 'bppb' ? bppbAll() : '') + (r === 'prod' && typeof UNITX !== 'undefined' && UNITX.on() ? UNITX.allHtml() : '');
      put(main, html); return;
    }
    const st = bcs.map(bc => [bc, statsOf(bc)]);
    const tot = k => sum(st, ([, s]) => s ? s[k] : 0);
    const cols = [
      { t: 'Basecamp', f: ([bc]) => '<span class="bcbadge sm" style="--bct:' + bcTone(bc) + '">' + esc(bc) + '</span>', raw: true },
      { t: 'Penjualan bulan ini', f: ([, s]) => s ? rpS(s.jual) : '…', num: true }, { t: 'Profit', f: ([, s]) => s ? rpS(s.profit) : '', num: true },
      { t: 'SO / WO', f: ([, s]) => s ? s.so + ' · ' + rpS(s.soNilai) : '', num: true }, { t: 'Saldo kas', f: ([, s]) => s ? rpS(s.saldo) : '', num: true },
      { t: 'Piutang', f: ([, s]) => s ? rpS(s.piutang) + (s.telat ? ' <small class="t-bad">' + s.telat + ' telat</small>' : '') : '', num: true, raw: true },
      { t: 'Hutang', f: ([, s]) => s ? rpS(s.hutang) : '', num: true }, { t: 'Material menipis', f: ([, s]) => s ? s.low : '', num: true },
      { t: 'Perbaikan aktif', f: ([, s]) => s ? s.mt + (s.mtLate ? ' <small class="t-warn">' + s.mtLate + ' lewat</small>' : '') : '', num: true, raw: true },
      { t: 'BPPB belum rilis', f: ([, s]) => s ? s.bppb : '', num: true }, { t: 'Man power', f: ([, s]) => s ? s.mp : '', num: true },
      { t: '', f: ([bc]) => '<button class="btn sm" data-pick="' + esc(bc) + '">Buka' + ic('right') + '</button>', raw: true }
    ];
    const h = new Date().getHours(), salam = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
    html =
      '<section class="hero"><div><p class="hk">' + esc(HARI[new Date().getDay()] + ', ' + tgl(today(), true)) + '</p><h1>' + salam + ', ' + esc(String(S.user.name).split(' ')[0]) + '</h1><p>Rekap ' + bcs.length + ' basecamp: ' + esc(bcs.join(', ')) + '.</p></div>' +
      '<div class="hstats">' + kpi('Penjualan bulan ini', rpS(tot('jual')), 'profit ' + rpS(tot('profit'))) + kpi('SO / WO bulan ini', tot('so'), 'nilai ' + rpS(tot('soNilai'))) + kpi('Saldo kas', rpS(tot('saldo'))) + kpi('Piutang', rpS(tot('piutang')), tot('telat') ? tot('telat') + ' lewat jatuh tempo' : 'terkendali', tot('telat') ? 'bad' : '') + '</div></section>' +
      (R0.err ? '<div class="note" style="margin-top:14px">' + esc(R0.err) + '</div>' : '') +
      '<div class="sech"><h2>Per Basecamp</h2><p>Angka dihitung dari Kartu Operasional masing-masing basecamp' + (R0.busy ? ' — memuat data…' : '') + '.</p></div>' +
      '<section class="card flush">' + table(cols, st) + '</section>' +
      '<div class="sech"><h2>Buka Basecamp</h2><p>Pilih basecamp untuk mengelola 19 kartu operasionalnya.</p></div>' +
      '<div class="cards">' + st.map(([bc, s], i) => '<a class="mcard" href="#" data-pick="' + esc(bc) + '" style="--d:' + (i * 35) + 'ms;--bct:' + bcTone(bc) + '"><div class="mtop"><span class="mic">' + ic('home') + '</span><em>' + String(i + 1).padStart(2, '0') + '</em></div><h3>Basecamp ' + esc(bc) + '</h3><p>' + (s ? s.docs + ' catatan · ' + s.mp + ' man power aktif' : 'Memuat…') + '</p>' +
        '<div class="mstat ' + (s && s.telat ? 'warn' : '') + '"><b>' + (s ? 'Saldo ' + rpS(s.saldo) : '') + '</b><span>' + (s ? 'Penjualan ' + rpS(s.jual) + ' bulan ini' : '') + '</span></div><span class="mgo">Buka basecamp' + ic('right') + '</span></a>').join('') + '</div>';
    put(main, html);
  }
  /* Penjualan semua basecamp: list per basecamp + grand total, rentang mingguan / bulanan / tahunan (jualx.js jxAllHtml) */
  const JA = stateOf('jualAll', { per: '', ref: '', q: '', unit: '', jenis: '', more: {} });
  if (!JA.more) JA.more = {};
  const jaList = () => R0.bcs.map(bc => ({ bc, x: R0.data[bc] ? withDocs(R0.data[bc], () => jxBcData(JA)) : null }));
  function jualAll(main, head) {
    if (main._h !== 'jualall' || !$('.jxall', main)) {
      main._h = 'jualall'; main._f = 0;
      main.innerHTML = head + '<div class="jxall"><div class="pfilter"></div><div class="pres"></div></div>';
      const rf = $('[data-rf]', main); if (rf) rf.onclick = () => loadAll(true);
      const pd = $('[data-jxpdf]', main); if (pd) pd.onclick = () => runReport(() => jxAllReport(jaList(), JA));
      jaFilter(main);
    }
    jaFill(main);
  }
  function jaFilter(main) {
    const f = $('.jxall .pfilter', main);
    f.innerHTML = jxPerBar(JA, jxUnitOpts(JA) + '<select data-fk="jenis"><option value="">Internal & eksternal</option><option value="internal"' + (JA.jenis === 'internal' ? ' selected' : '') + '>Internal PT. AHG</option><option value="eksternal"' + (JA.jenis === 'eksternal' ? ' selected' : '') + '>Eksternal / Retail</option></select>');
    const redraw = () => { jaFilter(main); jaFill(main, true); };
    jxPerBind(f, JA, redraw);
    $$('[data-fk]', f).forEach(el => el.addEventListener(el.type === 'search' ? 'input' : 'change', (el.type === 'search' ? debounce : g => g)(() => { JA[el.dataset.fk] = el.value; jaFill(main, true); }, 180)));
  }
  function jaFill(main, force) {
    const res = $('.jxall .pres', main); if (!res) return;
    const html = (R0.err ? '<div class="note">' + esc(R0.err) + '</div>' : '') + jxAllHtml(jaList(), JA) + (R0.busy ? '<div class="note">Memuat data basecamp lainnya…</div>' : '');
    if (!force && res._h === html) return;
    const sy = window.scrollY;
    res._h = html; res.innerHTML = html;
    $$('[data-pick]', res).forEach(b => b.onclick = e => { e.preventDefault(); pick(b.dataset.pick, 'jual'); });
    $$('[data-jxmore]', res).forEach(b => b.onclick = () => { JA.more[b.dataset.jxmore] = !JA.more[b.dataset.jxmore]; jaFill(main, true); });
    $$('tr[data-jxgo]', res).forEach(tr => tr.onclick = () => { const [p, ref] = tr.dataset.jxgo.split(':'); JA.per = p; JA.ref = ref; jaFilter(main); jaFill(main, true); window.scrollTo(0, 0); });
    $$('tr[data-jx]', res).forEach(tr => tr.onclick = e => { e.stopPropagation(); const bc = tr.closest('section') && tr.closest('section').querySelector('.bcbadge'); const name = bc ? bc.textContent : ''; if (name && R0.data[name]) withDocs(R0.data[name], () => jxDetail(tr.dataset.jx)); });
    if (!force) window.scrollTo(0, sy);
  }
  /* Cash Flow semua basecamp: rincian arus kas tiap basecamp + grand total (catatan kas aplikasi + uang masuk penjualan rekap sheet) */
  const KA = stateOf('kasAll', { per: '', ref: '', q: '', more: {} });
  if (!KA.more) KA.more = {};
  const hasJx = () => typeof jxSel === 'function';
  function kasBcData(s) {
    const r = jxRange(s), inR = t => r.per === 'semua' || (!!t && t >= r.a && t <= r.b);
    const ks = all('kas').filter(k => qMatch(s.q, k.kat, k.ket, k.pihak, k.metode));
    const kr = ks.filter(k => inR(k.tgl)), sg = k => k.arah === 'masuk' ? +k.jumlah || 0 : -(+k.jumlah || 0);
    const kasIn = sum(kr.filter(k => k.arah === 'masuk'), 'jumlah'), kasOut = sum(kr.filter(k => k.arah === 'keluar'), 'jumlah');
    const awal = r.per === 'semua' ? 0 : sum(ks.filter(k => k.tgl && k.tgl < r.a), sg), akhir = sum(ks.filter(k => r.per === 'semua' || !k.tgl || k.tgl <= r.b), sg);
    const kat = Object.entries(groupBy(kr, k => k.arah + '|' + (k.kat || 'Lain-lain'))).map(([k, a]) => ({ arah: k.split('|')[0], kat: k.split('|')[1], src: 'Catatan kas', n: a.length, jml: sum(a, 'jumlah') }));
    const tx = kr.map(k => ({ tgl: k.tgl, src: 'Kas', arah: k.arah, uraian: k.ket || k.kat, sub: k.kat + (k.metode ? ' · ' + k.metode : ''), pihak: k.pihak || (k.inv ? custName((get(k.inv) || {}).cust) : ''), jml: +k.jumlah || 0 }));
    let pjIn = 0, pjEks = 0, pjInt = 0, tagihInt = 0, piutInt = 0, piutEks = 0, nilai = 0;
    if (hasJx()) {
      const x = jxSel({ per: s.per, ref: s.ref, q: s.q });
      const eks = d => d.kat === 'Eksternal';
      pjIn = x.masuk; pjEks = sum(x.rows.filter(eks), 'masuk') + sum(x.tg.filter(eks), 'masuk'); pjInt = pjIn - pjEks;
      tagihInt = sum(x.rows.filter(d => d.kat === 'Internal'), jxNilaiJual); nilai = x.nilai;
      const a0 = jxTot(jxAll()); piutInt = a0.piutInt; piutEks = a0.piutEks;
      if (pjEks) kat.push({ arah: 'masuk', kat: 'Penjualan eksternal / retail', src: 'Rekap sheet', n: x.rows.filter(d => eks(d) && +d.masuk).length + x.tg.filter(d => eks(d) && +d.masuk).length, jml: pjEks });
      if (pjInt) kat.push({ arah: 'masuk', kat: 'Penjualan internal diterima (HO / proyek)', src: 'Rekap sheet', n: x.rows.filter(d => !eks(d) && +d.masuk).length + x.tg.filter(d => !eks(d) && +d.masuk).length, jml: pjInt });
      x.rows.concat(x.tg).filter(d => +d.masuk > 0.5).forEach(d => tx.push({ tgl: jxDate(d), src: 'Rekap sheet', arah: 'masuk', uraian: d.nama || d.produk || 'Penjualan', sub: [d.kat, d.unit, d.produk, d.sph ? 'SPH ' + d.sph : '', d.so || d.inv].filter(Boolean).join(' · '), pihak: d.kat === 'Internal' ? 'PT. AHG' : '', jml: +d.masuk || 0, jx: d.id }));
    }
    kat.sort((a, b) => b.arah.localeCompare(a.arah) || b.jml - a.jml);
    tx.sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)));
    const kt = kasTotals(), masuk = kasIn + pjIn;
    const buckets = (jxBuckets(r) || [...new Set(tx.map(d => String(d.tgl || '').slice(0, 7)).filter(Boolean))].sort().map(ym => ({ k: ym, a: ym + '-01', b: ym + '-31', label: monthLabel(ym), go: 'bulan:' + ym + '-01' })))
      .map(b => { const in_ = tx.filter(d => d.tgl >= b.a && d.tgl <= b.b); return Object.assign({ masuk: sum(in_.filter(d => d.arah === 'masuk'), 'jml'), keluar: sum(in_.filter(d => d.arah === 'keluar'), 'jml') }, b); });
    return { r, kasIn, kasOut, pjIn, pjEks, pjInt, tagihInt, nilai, masuk, keluar: kasOut, net: masuk - kasOut, awal, akhir, piutInv: kt.piutang, piutInt, piutEks, piutang: kt.piutang + piutInt + piutEks, hutang: kt.hutang, telat: kt.telat, belumTagih: kt.belumTagih, kat, tx, buckets };
  }
  const kaList = () => R0.bcs.map(bc => ({ bc, x: R0.data[bc] ? withDocs(R0.data[bc], () => kasBcData(KA)) : null }));
  const bdg = bc => '<span class="bcbadge sm" style="--bct:' + bcTone(bc) + '">' + esc(bc) + '</span>';
  const signRp = (v, z) => v ? '<b class="' + (v >= 0 ? 't-ok' : 't-bad') + '">' + rp(v) + '</b>' : (z || '-');
  function kasAllHtml(list) {
    const r = jxRange(KA), ok = list.filter(b => b.x), T = k => sum(ok, b => b.x[k]), totIn = T('masuk');
    const sumT = '<section class="card"><div class="chead"><h3>Cash flow per basecamp</h3><div class="cmeta">' + esc(r.label) + (r.per !== 'semua' ? ' · ' + tgl(r.a) + ' – ' + tgl(r.b) : '') + '</div></div>' + table([
      { t: 'Basecamp', f: b => bdg(b.bc), raw: true },
      { t: 'Masuk penjualan', f: b => b.x ? rp(b.x.pjIn) + (b.x.pjIn ? '<small>eks ' + rpS(b.x.pjEks) + ' · int ' + rpS(b.x.pjInt) + '</small>' : '') : 'Memuat…', num: true, raw: true },
      { t: 'Masuk kas lain', f: b => b.x ? rp(b.x.kasIn) : '', num: true },
      { t: 'Total masuk', f: b => b.x ? '<b class="t-ok">' + rp(b.x.masuk) + '</b>' : '', num: true, raw: true },
      { t: 'Uang keluar', f: b => b.x ? '<span class="' + (b.x.keluar ? 't-bad' : '') + '">' + rp(b.x.keluar) + '</span>' : '', num: true, raw: true },
      { t: 'Arus bersih', f: b => b.x ? signRp(b.x.net, rp(0)) : '', num: true, raw: true },
      { t: 'Saldo kas', f: b => b.x ? rp(b.x.akhir) : '', num: true },
      { t: 'Piutang', f: b => b.x ? '<span class="' + (b.x.piutang > 0.5 ? 't-warn' : '') + '">' + rp(b.x.piutang) + '</span>' + (b.x.telat ? '<small class="t-bad">' + b.x.telat + ' lewat tempo</small>' : '') : '', num: true, raw: true },
      { t: 'Hutang', f: b => b.x ? rp(b.x.hutang) : '', num: true },
      { t: 'Kontribusi', f: b => b.x ? '<div class="mini"><b>' + pct(totIn ? b.x.masuk / totIn : 0) + '</b>' + bar(totIn ? b.x.masuk / totIn : 0, 'info') + '</div>' : '', raw: true },
      { t: '', f: b => '<button class="btn sm" data-pick="' + esc(b.bc) + '">Buka' + ic('right') + '</button>', raw: true }
    ], list.map((b, i) => Object.assign({ id: i }, b))).replace('</table>', '<tfoot><tr class="gt"><td class="tl">GRAND TOTAL</td><td class="n">' + rp(T('pjIn')) + '</td><td class="n">' + rp(T('kasIn')) + '</td><td class="n">' + rp(totIn) + '</td><td class="n">' + rp(T('keluar')) + '</td><td class="n">' + rp(T('net')) + '</td><td class="n">' + rp(T('akhir')) + '</td><td class="n">' + rp(T('piutang')) + '</td><td class="n">' + rp(T('hutang')) + '</td><td>100%</td><td></td></tr></tfoot></table>') + '</section>';
    const piT = '<section class="card"><div class="chead"><h3>Posisi piutang &amp; hutang per basecamp</h3><div class="cmeta">posisi saat ini · semua periode</div></div>' + table([
      { t: 'Basecamp', f: b => bdg(b.bc), raw: true }, { t: 'Piutang invoice', f: b => b.x ? rp(b.x.piutInv) : 'Memuat…', num: true }, { t: 'Piutang internal HO / proyek', f: b => b.x ? rp(b.x.piutInt) : '', num: true },
      { t: 'Piutang eksternal', f: b => b.x ? rp(b.x.piutEks) : '', num: true }, { t: 'Total piutang', f: b => b.x ? '<b>' + rp(b.x.piutang) + '</b>' : '', num: true, raw: true },
      { t: 'Belum ditagih', f: b => b.x ? rp(b.x.belumTagih) : '', num: true }, { t: 'Hutang supplier', f: b => b.x ? rp(b.x.hutang) : '', num: true }
    ], list.map((b, i) => Object.assign({ id: 'p' + i }, b))).replace('</table>', '<tfoot><tr class="gt"><td class="tl">GRAND TOTAL</td><td class="n">' + rp(T('piutInv')) + '</td><td class="n">' + rp(T('piutInt')) + '</td><td class="n">' + rp(T('piutEks')) + '</td><td class="n">' + rp(T('piutang')) + '</td><td class="n">' + rp(T('belumTagih')) + '</td><td class="n">' + rp(T('hutang')) + '</td></tr></tfoot></table>') + '</section>';
    let bk = ok.length ? ok[0].x.buckets.map((b, i) => Object.assign({}, b, { per: ok.map(o => o.x.buckets[i] || { masuk: 0, keluar: 0 }) })) : [];
    if (r.per === 'semua') { const ms = [...new Set(ok.flatMap(o => o.x.buckets.map(b => b.k)))].sort(); bk = ms.map(k => ({ k, label: monthLabel(k), go: 'bulan:' + k + '-01', per: ok.map(o => o.x.buckets.find(b => b.k === k) || { masuk: 0, keluar: 0 }) })); }
    const cell = p => p.masuk || p.keluar ? (p.masuk ? rp(p.masuk) : '') + (p.keluar ? '<small class="t-bad">− ' + rp(p.keluar) + '</small>' : '') : '-';
    const perT = bk.length ? '<section class="card"><div class="chead"><h3>' + (r.per === 'minggu' ? 'Arus kas per hari' : r.per === 'bulan' ? 'Arus kas per minggu' : 'Arus kas per bulan') + ' per basecamp</h3><div class="cmeta">uang masuk (merah = keluar)' + (r.per !== 'minggu' ? ' · klik baris untuk rinciannya' : '') + '</div></div><div class="tbl"><table><thead><tr><th>' + (r.per === 'minggu' ? 'Hari' : r.per === 'bulan' ? 'Minggu' : 'Bulan') + '</th>' +
      ok.map(o => '<th class="n">' + esc(o.bc) + '</th>').join('') + '<th class="n">Total masuk</th><th class="n">Total keluar</th><th class="n">Arus bersih</th></tr></thead><tbody>' +
      bk.map(b => { const mi = sum(b.per, 'masuk'), ko = sum(b.per, 'keluar'); return '<tr' + (b.go ? ' class="click" data-kago="' + esc(b.go) + '"' : '') + '><td><b>' + esc(b.label) + '</b></td>' + b.per.map(p => '<td class="n">' + cell(p) + '</td>').join('') + '<td class="n"><b>' + rp(mi) + '</b></td><td class="n">' + rp(ko) + '</td><td class="n">' + signRp(mi - ko, rp(0)) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr class="gt"><td class="tl">GRAND TOTAL</td>' + ok.map(o => '<td class="n">' + rp(o.x.masuk) + (o.x.keluar ? '<small>− ' + rp(o.x.keluar) + '</small>' : '') + '</td>').join('') + '<td class="n">' + rp(totIn) + '</td><td class="n">' + rp(T('keluar')) + '</td><td class="n">' + rp(T('net')) + '</td></tr></tfoot></table></div></section>' : '';
    const MAX = 25;
    const lists = list.map(b => {
      if (!b.x) return '<section class="card"><div class="chead"><h3 class="bcx-h">' + bdg(b.bc) + ' Cash flow</h3></div><div class="empty"><p>Memuat data…</p></div></section>';
      const x = b.x, more = !!KA.more[b.bc], rows = more ? x.tx : x.tx.slice(0, MAX);
      const kin = x.kat.filter(k => k.arah === 'masuk'), kout = x.kat.filter(k => k.arah === 'keluar');
      const katT = table([{ t: 'Arah', f: k => chip(k.arah === 'masuk' ? 'Masuk' : 'Keluar', k.arah === 'masuk' ? 'ok' : 'bad'), raw: true }, { t: 'Kategori', f: k => '<b>' + esc(k.kat) + '</b><small>' + esc(k.src) + '</small>', raw: true }, { t: 'Transaksi', f: k => num(k.n), num: true }, { t: 'Jumlah', f: k => rp(k.jml), num: true }],
        x.kat.map((k, i) => Object.assign({ id: 'k' + i }, k)), { empty: 'Belum ada arus kas pada ' + x.r.label + '.' })
        .replace('</table>', x.kat.length ? '<tfoot><tr><td class="tl" colspan="3">Total masuk</td><td class="n t-ok">' + rp(sum(kin, 'jml')) + '</td></tr><tr><td class="tl" colspan="3">Total keluar</td><td class="n t-bad">' + rp(sum(kout, 'jml')) + '</td></tr><tr class="gt"><td class="tl" colspan="3">Arus bersih ' + esc(b.bc) + '</td><td class="n">' + rp(x.net) + '</td></tr></tfoot></table>' : '</table>');
      const txT = table([{ t: 'Tanggal', f: d => tgl(d.tgl) }, { t: 'Sumber', f: d => chip(d.src, d.src === 'Kas' ? '' : 'info'), raw: true }, { t: 'Uraian', f: d => '<b>' + esc(d.uraian || '-') + '</b><small>' + esc(d.sub || '') + '</small>', raw: true, cls: 'wrap' },
        { t: 'Pihak', f: d => d.pihak || '-' }, { t: 'Masuk', f: d => d.arah === 'masuk' ? '<b class="t-ok">' + rp(d.jml) + '</b>' : '', num: true, raw: true }, { t: 'Keluar', f: d => d.arah === 'keluar' ? '<b class="t-bad">' + rp(d.jml) + '</b>' : '', num: true, raw: true }],
        rows.map((d, i) => Object.assign({ id: 't' + i }, d)), { click: true, empty: 'Belum ada transaksi pada ' + x.r.label + '.', rowAttr: d => d.jx ? 'data-kajx="' + esc(d.jx) + '"' : '' })
        .replace('</table>', rows.length ? '<tfoot><tr><td class="tl" colspan="4">Subtotal ' + esc(b.bc) + (rows.length < x.tx.length ? ' (semua ' + num(x.tx.length) + ' transaksi)' : '') + '</td><td class="n">' + rp(x.masuk) + '</td><td class="n">' + rp(x.keluar) + '</td></tr></tfoot></table>' : '</table>');
      return '<section class="card"><div class="chead"><h3 class="bcx-h">' + bdg(b.bc) + ' Rincian cash flow</h3><div class="cmeta">masuk ' + rpS(x.masuk) + ' · keluar ' + rpS(x.keluar) + ' · bersih ' + rpS(x.net) + (x.r.per !== 'semua' ? ' · saldo kas awal ' + rpS(x.awal) + ' → akhir ' + rpS(x.akhir) : '') + '</div></div>' +
        '<div class="kab"><h4 class="kah">Arus kas per kategori</h4>' + katT + '</div><div class="kab"><h4 class="kah">Transaksi ' + (more || x.tx.length <= MAX ? '' : 'terbaru ') + esc(x.r.label) + '</h4>' + txT +
        (x.tx.length > MAX ? '<div class="cfoot"><button class="btn ghost sm" data-kamore="' + esc(b.bc) + '">' + (more ? 'Ringkas (' + MAX + ' terbaru)' : 'Tampilkan semua ' + num(x.tx.length) + ' transaksi') + '</button></div>' : '') + '</div>' +
        '<div class="cfoot"><button class="btn ghost sm" data-pick="' + esc(b.bc) + '">Buka kartu Cash Flow ' + esc(b.bc) + ic('right') + '</button></div></section>';
    }).join('');
    return '<div class="kpis">' + kpi('Grand total uang masuk', rpS(totIn), esc(r.label) + ' · ' + ok.length + ' basecamp', 'good') + kpi('Uang keluar', rpS(T('keluar')), 'catatan kas semua basecamp', T('keluar') ? 'bad' : '') +
      kpi('Arus bersih', rpS(T('net')), 'masuk − keluar', T('net') >= 0 ? 'good' : 'bad') + kpi('Saldo kas', rpS(T('akhir')), 'akumulasi catatan kas' + (r.per !== 'semua' ? ' s/d ' + tgl(r.b) : '')) + '</div>' +
      '<div class="kpis">' + kpi('Piutang semua basecamp', rpS(T('piutang')), 'invoice + internal + eksternal', T('piutang') > 0.5 ? 'warn' : '') + kpi('Penjualan internal ditagihkan', rpS(T('tagihInt')), esc(r.label)) +
      kpi('Hutang supplier', rpS(T('hutang')), 'belum dibayar', T('hutang') ? 'warn' : '') + kpi('Lewat jatuh tempo', T('telat'), 'invoice & hutang', T('telat') ? 'bad' : '') + '</div>' +
      sumT + perT + piT + '<div class="sech"><h2>Rincian cash flow per basecamp</h2><p>Uang masuk penjualan dari rekap sheet (retail &amp; internal) ditambah catatan Uang Masuk / Uang Keluar di kartu Cash Flow tiap basecamp pada ' + esc(r.label) + '.</p></div>' + lists;
  }
  function kasAll(main, head) {
    if (main._h !== 'kasall' || !$('.kaall', main)) {
      main._h = 'kasall'; main._f = 0;
      main.innerHTML = head + '<div class="kaall"><div class="pfilter"></div><div class="pres"></div></div>';
      const rf = $('[data-rf]', main); if (rf) rf.onclick = () => loadAll(true);
      const pd = $('[data-kapdf]', main); if (pd) pd.onclick = () => runReport(() => kasAllReport(kaList()));
      kaFilter(main);
    }
    kaFill(main);
  }
  function kaFilter(main) {
    const f = $('.kaall .pfilter', main);
    f.innerHTML = jxPerBar(KA, '');
    const sb = $('.sbox input', f); if (sb) sb.placeholder = 'Cari uraian, kategori, customer…';
    jxPerBind(f, KA, () => { kaFilter(main); kaFill(main, true); });
    $$('[data-fk]', f).forEach(el => el.addEventListener('input', debounce(() => { KA[el.dataset.fk] = el.value; kaFill(main, true); }, 180)));
  }
  function kaFill(main, force) {
    const res = $('.kaall .pres', main); if (!res) return;
    const html = (R0.err ? '<div class="note">' + esc(R0.err) + '</div>' : '') + kasAllHtml(kaList()) + (R0.busy ? '<div class="note">Memuat data basecamp lainnya…</div>' : '');
    if (!force && res._h === html) return;
    const sy = window.scrollY;
    res._h = html; res.innerHTML = html;
    $$('[data-pick]', res).forEach(b => b.onclick = e => { e.preventDefault(); pick(b.dataset.pick, 'kas'); });
    $$('[data-kamore]', res).forEach(b => b.onclick = () => { KA.more[b.dataset.kamore] = !KA.more[b.dataset.kamore]; kaFill(main, true); });
    $$('tr[data-kago]', res).forEach(tr => tr.onclick = () => { const [p, ref] = tr.dataset.kago.split(':'); KA.per = p; KA.ref = ref; jxSyncMonth(KA); kaFilter(main); kaFill(main, true); window.scrollTo(0, 0); });
    $$('tr[data-kajx]', res).forEach(tr => tr.onclick = e => { e.stopPropagation(); const s = tr.closest('section'), bc = s && s.querySelector('.bcbadge'), name = bc ? bc.textContent : ''; if (name && R0.data[name] && typeof jxDetail === 'function') withDocs(R0.data[name], () => jxDetail(tr.dataset.kajx)); });
    if (!force) window.scrollTo(0, sy);
  }
  async function kasAllReport(list) {
    const r = jxRange(KA), ok = list.filter(b => b.x), T = k => sum(ok, b => b.x[k]);
    const R = await pdfReport({ title: 'Rekap Cash Flow Semua Basecamp', sub: 'PT. Armada Hada Graha · ' + r.label + (r.per !== 'semua' ? ' (' + tgl(r.a) + ' – ' + tgl(r.b) + ')' : '') + ' · per ' + tgl(today(), true), orient: 'l', fname: 'Cash_Flow_Semua_Basecamp_' + r.label.replace(/[^A-Za-z0-9]+/g, '_') });
    R.kv([['Grand total uang masuk', 'Rp ' + R_(T('masuk'))], ['Uang keluar', 'Rp ' + R_(T('keluar'))], ['Arus bersih', 'Rp ' + R_(T('net')), T('net') < 0 ? 'red' : ''], ['Total piutang', 'Rp ' + R_(T('piutang')), T('piutang') > 0.5 ? 'red' : '']], 4);
    R.h2('Cash flow per basecamp', r.label);
    R.table(['Basecamp', 'Masuk Penjualan', 'Masuk Kas Lain', 'Total Masuk', 'Uang Keluar', 'Arus Bersih', 'Saldo Kas', 'Piutang', 'Hutang', 'Kontribusi'],
      ok.map(b => [b.bc, cellR(R_(b.x.pjIn)), cellR(R_(b.x.kasIn)), cellR(R_(b.x.masuk)), cellR(R_(b.x.keluar)), cellR(R_(b.x.net)), cellR(R_(b.x.akhir)), cellR(R_(b.x.piutang)), cellR(R_(b.x.hutang)), cellR(pct(T('masuk') ? b.x.masuk / T('masuk') : 0))]),
      { foot: ['GRAND TOTAL', cellR(R_(T('pjIn'))), cellR(R_(T('kasIn'))), cellR(R_(T('masuk'))), cellR(R_(T('keluar'))), cellR(R_(T('net'))), cellR(R_(T('akhir'))), cellR(R_(T('piutang'))), cellR(R_(T('hutang'))), cellR('100%')] });
    R.h2('Posisi piutang & hutang per basecamp', 'posisi saat ini');
    R.table(['Basecamp', 'Piutang Invoice', 'Piutang Internal', 'Piutang Eksternal', 'Total Piutang', 'Belum Ditagih', 'Hutang Supplier'],
      ok.map(b => [b.bc, cellR(R_(b.x.piutInv)), cellR(R_(b.x.piutInt)), cellR(R_(b.x.piutEks)), cellR(R_(b.x.piutang)), cellR(R_(b.x.belumTagih)), cellR(R_(b.x.hutang))]),
      { foot: ['GRAND TOTAL', cellR(R_(T('piutInv'))), cellR(R_(T('piutInt'))), cellR(R_(T('piutEks'))), cellR(R_(T('piutang'))), cellR(R_(T('belumTagih'))), cellR(R_(T('hutang')))] });
    ok.forEach(b => {
      R.h2('Rincian ' + b.bc, 'masuk Rp ' + R_(b.x.masuk) + ' · keluar Rp ' + R_(b.x.keluar));
      R.table(['Arah', 'Kategori', 'Sumber', 'Transaksi', 'Jumlah'], b.x.kat.map(k => [k.arah === 'masuk' ? 'Masuk' : 'Keluar', k.kat, k.src, cellR(N_(k.n)), cellR(R_(k.jml))]),
        { foot: ['', 'Arus bersih ' + b.bc, '', '', cellR(R_(b.x.net))] });
    });
    R.sign([['Dibuat oleh', S.user.name], ['Finance', ''], ['Manager Unit', '']]);
    await R.save();
  }
  // gambar ulang hanya bila isi berubah (tanpa animasi berulang / posisi gulir melompat saat data basecamp masuk)
  function put(main, html) { if (main._h === html && main.firstChild) return; main._h = html; main.innerHTML = html; bind(main); }
  function bind(main) {
    $$('[data-pick]', main).forEach(b => b.onclick = e => { e.preventDefault(); pick(b.dataset.pick, APP.route); });
    const rf = $('[data-rf]', main); if (rf) rf.onclick = () => loadAll(true);
    const pd = $('[data-pdf]', main); if (pd) pd.onclick = () => runReport(rekapPdf);
  }
  async function rekapPdf() {
    const R = await pdfReport({ title: 'Rekap Operasional Semua Basecamp', sub: 'Unit Produksi AMP, CMP, SCP, PCP · ' + monthLabel(curMonth()) + ' · per ' + tgl(today(), true), orient: 'l', fname: 'Rekap_Semua_Basecamp' });
    const st = R0.bcs.map(bc => [bc, statsOf(bc) || {}]);
    const tot = k => sum(st, ([, s]) => s[k] || 0);
    R.kv([['Penjualan bulan ini', rp(tot('jual'))], ['Profit', rp(tot('profit'))], ['Saldo kas', rp(tot('saldo'))], ['Piutang', rp(tot('piutang')), tot('telat') ? 'red' : '']]);
    R.h2('Ringkasan per basecamp', monthLabel(curMonth()));
    R.table(['Basecamp', 'Penjualan', 'Profit', 'SO/WO', 'Nilai SO', 'Saldo kas', 'Piutang', 'Hutang', 'Mat. menipis', 'Perbaikan', 'BPPB', 'Man power'],
      st.map(([bc, s]) => [bc, rp(s.jual), rp(s.profit), num(s.so), rp(s.soNilai), rp(s.saldo), rp(s.piutang), rp(s.hutang), num(s.low), num(s.mt), num(s.bppb), num(s.mp)]),
      { foot: ['Total', rp(tot('jual')), rp(tot('profit')), num(tot('so')), rp(tot('soNilai')), rp(tot('saldo')), rp(tot('piutang')), rp(tot('hutang')), num(tot('low')), num(tot('mt')), num(tot('bppb')), num(tot('mp'))] });
    R.sign();
    await R.save();
  }
  async function loadAll(force) {
    R0.bcs = list(); if (!R0.bcs.length) R0.bcs = ['Bawen'];
    R0.busy = true; R0.err = ''; draw();
    for (const bc of R0.bcs) {
      if (R0.data[bc] && !force) continue;
      try { const m = await loadBc(bc); if (!R0.data[bc] || m._seq !== R0.data[bc]._seq) { R0.data[bc] = m; R0.ver++; } } catch (e) { if (e.message === 'auth') return; R0.err = 'Sebagian data belum termuat (' + bc + '): periksa koneksi internet.'; }
      draw();
    }
    R0.busy = false; draw();
  }
  startApp = function () {
    document.body.className = 'in embed';
    $('#app').innerHTML = '<div class="mainw"><main id="main"></main></div>';
    const go = () => { const prev = APP.route; APP.route = (location.hash.replace(/^#\/?/, '') || '').split('?')[0]; if (prev === 'mp' && APP.route !== 'mp' && MODS.mp.leave) MODS.mp.leave(); if (!MODS[APP.route]) APP.route = ''; CFG.onRoute(APP.route, MODS[APP.route] ? MODS[APP.route].title : 'Rekap Semua Basecamp'); draw(); window.scrollTo(0, 0); };
    window.onhashchange = go;
    window.addEventListener('unitx', () => { if (APP.route === 'prod') draw(); }); // input produksi unit berubah di Virtual Work
    go(); loadAll();
    setInterval(() => { if (!document.hidden && !R0.busy && !MG.pend && !MG.wait.length && !MODALS.length) loadAll(true); }, 60000);
  };
})();
