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
      const prodM = all('prod').filter(p => p.status !== 'Batal' && inMonth(p.tgl, curMonth()));
      let low = 0; UNITS.forEach(u => stockSaldo(u).forEach(r => { if ((r.status === 'Menipis' || r.status === 'Habis') && (r.masuk || r.prod || r.keluar)) low++; }));
      const mt = all('mt').filter(x => x.status !== 'Selesai');
      return {
        jual: jd.nilai, profit: jd.profit, so: prodM.length, soNilai: sum(prodM, p => p.vol * p.harga), saldo: kt.saldo, piutang: kt.piutang, hutang: kt.hutang, telat: kt.telat,
        low, mt: mt.length, mtLate: mt.filter(mtLate).length, bppb: all('bppb').filter(b => b.rilis === 'Belum rilis').length,
        mp: all('mp').filter(x => x.status !== 'Nonaktif').length, docs: [...m.values()].filter(d => !d.del).length
      };
    });
  }
  const sumOf = (bc, k) => R0.data[bc] ? withDocs(R0.data[bc], () => MODS[k].summary()) : null;
  const pick = (bc, r) => { if (P && P.pick) P.pick(bc, r); };
  function draw() {
    const main = $('#main'); if (!main) return;
    const r = APP.route, mod = MODS[r];
    const bcs = R0.bcs;
    const head = '<div class="phead"><div class="ptitle"><span class="ptile">' + ic(mod ? mod.icon : 'home') + '</span><div><h1>' + esc(mod ? mod.title : 'Rekap Semua Basecamp') + '</h1><p>' +
      esc(mod ? 'Ringkasan kartu ini di setiap basecamp. Pilih basecamp untuk membuka dan mengisi data.' : 'Ringkasan operasional seluruh basecamp PT. Armada Hada Graha — unit AMP, CMP, SCP, dan PCP.') + '</p></div></div>' +
      '<div class="pact"><button class="btn ghost" data-rf>' + ic('refresh') + '<span>Muat ulang</span></button>' + (mod ? '' : '<button class="btn dark" data-pdf>' + ic('print') + '<span>Cetak PDF</span></button>') + '</div></div>';
    if (!bcs.length) { main.innerHTML = head + '<div class="empty">' + ic('home') + '<p>Belum ada basecamp.</p></div>'; bind(main); return; }
    if (mod) {
      main.innerHTML = head + (R0.err ? '<div class="note">' + esc(R0.err) + '</div>' : '') + '<div class="cards">' + bcs.map((bc, i) => {
        const s = sumOf(bc, r) || {};
        return '<a class="mcard" href="#" data-pick="' + esc(bc) + '" style="--d:' + (i * 35) + 'ms"><div class="mtop"><span class="mic">' + ic('home') + '</span><em>' + String(i + 1).padStart(2, '0') + '</em></div><h3>Basecamp ' + esc(bc) + '</h3><p>' + esc(mod.title) + '</p>' +
          '<div class="mstat ' + (s.tone || '') + '"><b>' + esc(R0.data[bc] ? s.main || '' : 'Memuat…') + '</b><span>' + esc(s.sub || '') + '</span></div><span class="mgo">Buka kartu' + ic('right') + '</span></a>';
      }).join('') + '</div>';
      bind(main); return;
    }
    const st = bcs.map(bc => [bc, statsOf(bc)]);
    const tot = k => sum(st, ([, s]) => s ? s[k] : 0);
    const cols = [
      { t: 'Basecamp', f: ([bc]) => '<b>' + esc(bc) + '</b>', raw: true },
      { t: 'Penjualan bulan ini', f: ([, s]) => s ? rpS(s.jual) : '…', num: true }, { t: 'Profit', f: ([, s]) => s ? rpS(s.profit) : '', num: true },
      { t: 'SO / WO', f: ([, s]) => s ? s.so + ' · ' + rpS(s.soNilai) : '', num: true }, { t: 'Saldo kas', f: ([, s]) => s ? rpS(s.saldo) : '', num: true },
      { t: 'Piutang', f: ([, s]) => s ? rpS(s.piutang) + (s.telat ? ' <small class="t-bad">' + s.telat + ' telat</small>' : '') : '', num: true, raw: true },
      { t: 'Hutang', f: ([, s]) => s ? rpS(s.hutang) : '', num: true }, { t: 'Material menipis', f: ([, s]) => s ? s.low : '', num: true },
      { t: 'Perbaikan aktif', f: ([, s]) => s ? s.mt + (s.mtLate ? ' <small class="t-warn">' + s.mtLate + ' lewat</small>' : '') : '', num: true, raw: true },
      { t: 'BPPB belum rilis', f: ([, s]) => s ? s.bppb : '', num: true }, { t: 'Man power', f: ([, s]) => s ? s.mp : '', num: true },
      { t: '', f: ([bc]) => '<button class="btn sm" data-pick="' + esc(bc) + '">Buka' + ic('right') + '</button>', raw: true }
    ];
    const h = new Date().getHours(), salam = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
    main.innerHTML =
      '<section class="hero"><div><p class="hk">' + esc(HARI[new Date().getDay()] + ', ' + tgl(today(), true)) + '</p><h1>' + salam + ', ' + esc(String(S.user.name).split(' ')[0]) + '</h1><p>Rekap ' + bcs.length + ' basecamp: ' + esc(bcs.join(', ')) + '.</p></div>' +
      '<div class="hstats">' + kpi('Penjualan bulan ini', rpS(tot('jual')), 'profit ' + rpS(tot('profit'))) + kpi('SO / WO bulan ini', tot('so'), 'nilai ' + rpS(tot('soNilai'))) + kpi('Saldo kas', rpS(tot('saldo'))) + kpi('Piutang', rpS(tot('piutang')), tot('telat') ? tot('telat') + ' lewat jatuh tempo' : 'terkendali', tot('telat') ? 'bad' : '') + '</div></section>' +
      (R0.err ? '<div class="note" style="margin-top:14px">' + esc(R0.err) + '</div>' : '') +
      '<div class="sech"><h2>Per Basecamp</h2><p>Angka dihitung dari Kartu Operasional masing-masing basecamp' + (R0.busy ? ' — memuat data…' : '') + '.</p></div>' +
      '<section class="card flush">' + table(cols, st) + '</section>' +
      '<div class="sech"><h2>Buka Basecamp</h2><p>Pilih basecamp untuk mengelola 15 kartu operasionalnya.</p></div>' +
      '<div class="cards">' + st.map(([bc, s], i) => '<a class="mcard" href="#" data-pick="' + esc(bc) + '" style="--d:' + (i * 35) + 'ms"><div class="mtop"><span class="mic">' + ic('home') + '</span><em>' + String(i + 1).padStart(2, '0') + '</em></div><h3>Basecamp ' + esc(bc) + '</h3><p>' + (s ? s.docs + ' catatan · ' + s.mp + ' man power aktif' : 'Memuat…') + '</p>' +
        '<div class="mstat ' + (s && s.telat ? 'warn' : '') + '"><b>' + (s ? 'Saldo ' + rpS(s.saldo) : '') + '</b><span>' + (s ? 'Penjualan ' + rpS(s.jual) + ' bulan ini' : '') + '</span></div><span class="mgo">Buka basecamp' + ic('right') + '</span></a>').join('') + '</div>';
    bind(main);
  }
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
