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
  // Guide.pdf Basecamp Bawen ada di situs ahgbawen
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href="Guide.pdf"]'); if (a) { e.preventDefault(); window.open('https://ahgbawen.github.io/Guide.pdf', '_blank', 'noopener'); } }, true);
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
  function draw() {
    const main = $('#main'); if (!main) return;
    const r = APP.route, mod = MODS[r];
    const bcs = R0.bcs; let html;
    const head = '<div class="phead"><div class="ptitle"><span class="ptile">' + ic(mod ? mod.icon : 'home') + '</span><div><h1>' + esc(mod ? mod.title : 'Rekap Semua Basecamp') + '</h1><p>' +
      esc(mod ? 'Ringkasan kartu ini di setiap basecamp. Pilih basecamp untuk membuka dan mengisi data.' : 'Ringkasan operasional seluruh basecamp PT. Armada Hada Graha — unit AMP, CMP, SCP, dan PCP.') + '</p></div></div>' +
      '<div class="pact"><button class="btn ghost" data-rf>' + ic('refresh') + '<span>Muat ulang</span></button>' + (mod ? '' : '<button class="btn dark" data-pdf>' + ic('print') + '<span>Cetak PDF</span></button>') + '</div></div>';
    if (!bcs.length) { html = head + '<div class="empty">' + ic('home') + '<p>Belum ada basecamp.</p></div>'; put(main, html); return; }
    if (mod) {
      html = head + (R0.err ? '<div class="note">' + esc(R0.err) + '</div>' : '') + '<div class="cards">' + bcs.map((bc, i) => {
        const s = sumOf(bc, r) || {};
        return '<a class="mcard" href="#" data-pick="' + esc(bc) + '" style="--d:' + (i * 35) + 'ms;--bct:' + bcTone(bc) + '"><div class="mtop"><span class="mic">' + ic('home') + '</span><em>' + String(i + 1).padStart(2, '0') + '</em></div><h3>Basecamp ' + esc(bc) + '</h3><p>' + esc(mod.title) + '</p>' +
          '<div class="mstat ' + (s.tone || '') + '"><b>' + esc(R0.data[bc] ? s.main || '' : 'Memuat…') + '</b><span>' + esc(s.sub || '') + '</span></div><span class="mgo">Buka kartu' + ic('right') + '</span></a>';
      }).join('') + '</div>' + (r === 'bppb' ? bppbAll() : '');
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
      '<div class="sech"><h2>Buka Basecamp</h2><p>Pilih basecamp untuk mengelola 16 kartu operasionalnya.</p></div>' +
      '<div class="cards">' + st.map(([bc, s], i) => '<a class="mcard" href="#" data-pick="' + esc(bc) + '" style="--d:' + (i * 35) + 'ms;--bct:' + bcTone(bc) + '"><div class="mtop"><span class="mic">' + ic('home') + '</span><em>' + String(i + 1).padStart(2, '0') + '</em></div><h3>Basecamp ' + esc(bc) + '</h3><p>' + (s ? s.docs + ' catatan · ' + s.mp + ' man power aktif' : 'Memuat…') + '</p>' +
        '<div class="mstat ' + (s && s.telat ? 'warn' : '') + '"><b>' + (s ? 'Saldo ' + rpS(s.saldo) : '') + '</b><span>' + (s ? 'Penjualan ' + rpS(s.jual) + ' bulan ini' : '') + '</span></div><span class="mgo">Buka basecamp' + ic('right') + '</span></a>').join('') + '</div>';
    put(main, html);
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
      try { R0.data[bc] = await loadBc(bc); } catch (e) { if (e.message === 'auth') return; R0.err = 'Sebagian data belum termuat (' + bc + '): periksa koneksi internet.'; }
      draw();
    }
    R0.busy = false; draw();
  }
  startApp = function () {
    document.body.className = 'in embed';
    $('#app').innerHTML = '<div class="mainw"><main id="main"></main></div>';
    const go = () => { APP.route = (location.hash.replace(/^#\/?/, '') || '').split('?')[0]; if (!MODS[APP.route]) APP.route = ''; CFG.onRoute(APP.route, MODS[APP.route] ? MODS[APP.route].title : 'Rekap Semua Basecamp'); draw(); window.scrollTo(0, 0); };
    window.onhashchange = go;
    go(); loadAll();
    setInterval(() => { if (!document.hidden && !R0.busy) loadAll(true); }, 60000);
  };
})();
