/* Basecamp Bawen — login/daftar, kerangka aplikasi, navigasi, beranda, pengguna. */
'use strict';
const ORDER = ['stok', 'prod', 'perf', 'jual', 'proj', 'kas', 'cust', 'jadwal', 'bahan', 'mt', 'bppb', 'mp', 'mkt', 'dev', 'pl', 'hpp', 'oh', 'org', 'flow'].concat(typeof MODS !== 'undefined' && MODS.sk ? ['sk'] : []); // 'sk' = SK & Dokumen (hanya ahgproduksi /bc/)
const APP = { route: '', ctl: null };
const helpLink = (t = 'Halo Admin, saya butuh bantuan untuk aplikasi ' + BC + '.') => waLink(ADMIN_WA, t);

/* ---------- login & daftar ---------- */
function showAuth(msg) {
  document.body.className = 'auth';
  const app = $('#app');
  app.innerHTML =
    '<div class="authw"><aside class="brand"><div class="bgrid"></div><div class="bin">' +
    '<div class="blogo"><img src="assets/logo.png" alt="Logo PT. Armada Hada Graha"></div>' +
    '<h1>Sistem Informasi Produksi</h1><h2>' + BC + '</h2><p>' + PT + '</p>' +
    '<ul class="bunits">' + UNITS.map(u => '<li><b>' + u + '</b><span>' + UNIT_NAME[u] + '</span></li>').join('') + '</ul>' +
    '<div class="bfoot">Trust and Integrity</div></div></aside>' +
    '<main class="authm"><div class="acard"><img class="amark" src="assets/logo.png" alt=""><div class="atabs"><button data-at="in" class="on">Masuk</button><button data-at="up">Daftar Akun</button><i></i></div>' +
    '<div class="abody"></div>' +
    '<a class="ahelp" target="_blank" rel="noopener" href="' + esc(helpLink()) + '">' + ic('wa') + '<span>Butuh bantuan? Hubungi admin <b>+62 822-9977-4825</b></span></a></div>' +
    '<a class="aguide" href="Guide.pdf" download="Guide.pdf">' + ic('file') + 'Unduh Panduan Penggunaan (PDF)</a><p class="acopy">&copy; ' + new Date().getFullYear() + ' ' + PT + '</p></main></div>';
  const body = $('.abody', app);
  function draw(t) {
    $$('[data-at]', app).forEach(b => b.classList.toggle('on', b.dataset.at === t));
    $('.atabs i', app).style.transform = 'translateX(' + (t === 'in' ? 0 : 100) + '%)';
    body.classList.remove('swap'); void body.offsetWidth; body.classList.add('swap');
    body.innerHTML = t === 'in' ?
      '<form class="aform" data-f="in"><h3>Selamat datang</h3><p class="muted">Masuk dengan nomor WhatsApp atau nama yang terdaftar.</p>' + (msg ? '<div class="amsg">' + esc(msg) + '</div>' : '') +
      '<label>Nomor WhatsApp atau nama<input name="id" autocomplete="username" required placeholder="08xxxxxxxxxx"></label>' +
      '<label>Kata sandi<div class="pw"><input name="pass" type="password" autocomplete="current-password" required><button type="button" class="ibtn sm" data-eye aria-label="Lihat kata sandi">' + ic('eye') + '</button></div></label>' +
      '<button class="btn pri block" type="submit">Masuk</button><p class="muted sm">Lupa kata sandi? Hubungi admin melalui WhatsApp di bawah.</p></form>' :
      '<form class="aform" data-f="up"><h3>Daftar akun baru</h3><p class="muted">Nomor WhatsApp dipakai untuk masuk dan koordinasi.</p>' +
      '<label>Nama lengkap<input name="name" autocomplete="name" required placeholder="Nama sesuai KTP"></label>' +
      '<label>Nomor WhatsApp<input name="wa" type="tel" inputmode="tel" autocomplete="tel" required placeholder="08xxxxxxxxxx"></label>' +
      '<label>Jabatan<input name="jabatan" list="dl-jab" placeholder="mis. Admin Unit AMP"><datalist id="dl-jab"><option>Kepala Basecamp<option>Kepala Unit<option>Admin Unit<option>Admin Keuangan<option>Logistik<option>Marketing<option>Mekanik</datalist></label>' +
      '<div class="row2"><label>Kata sandi<input name="pass" type="password" autocomplete="new-password" required minlength="6" placeholder="minimal 6 karakter"></label>' +
      '<label>Ulangi kata sandi<input name="pass2" type="password" autocomplete="new-password" required></label></div>' +
      '<label>Kode referral<input name="ref" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Masukkan kode referral dari admin"></label>' +
      '<button class="btn pri block" type="submit">Daftar &amp; Masuk</button><p class="muted sm">Belum punya kode referral? Hubungi admin melalui WhatsApp di bawah.</p></form>';
    const f = $('form', body);
    const eye = $('[data-eye]', f); if (eye) eye.onclick = () => { const i = $('[name=pass]', f); i.type = i.type === 'password' ? 'text' : 'password'; };
    f.onsubmit = async e => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(f));
      const btn = $('button[type=submit]', f);
      const err = m => { let el = $('.amsg', f); if (!el) { el = document.createElement('div'); el.className = 'amsg'; f.insertBefore(el, f.children[2]); } el.textContent = m; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
      if (t === 'up') {
        if (fd.name.trim().length < 3) return err('Nama minimal 3 huruf.');
        if (!/^62\d{8,13}$/.test(waNorm(fd.wa))) return err('Nomor WhatsApp tidak valid. Contoh: 081234567890');
        if (fd.pass.length < 6) return err('Kata sandi minimal 6 karakter.');
        if (fd.pass !== fd.pass2) return err('Ulangi kata sandi tidak sama.');
        if (!String(fd.ref || '').trim()) return err('Kode referral wajib diisi.');
      }
      btn.disabled = true; btn.classList.add('busy');
      try {
        const r = t === 'in' ? await rpc('bw_login', { p_id: fd.id, p_pass: fd.pass }) : await rpc('bw_register', { p_name: fd.name, p_wa: fd.wa, p_pass: fd.pass, p_jabatan: fd.jabatan || '', p_ref: String(fd.ref || '').trim() });
        if (r.err) {
          err({ notfound: 'Akun tidak ditemukan. Periksa nomor atau daftar akun baru.', pass: 'Kata sandi salah.', off: 'Akun dinonaktifkan. Hubungi admin.', locked: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.', taken: 'Nomor WhatsApp sudah terdaftar. Silakan masuk.', ref: 'Kode referral salah. Pendaftaran tidak dapat dilanjutkan.', wa: 'Nomor WhatsApp tidak valid.', pass_: '', name: 'Nama terlalu pendek.' }[r.err] || r.err);
          btn.disabled = false; btn.classList.remove('busy'); return;
        }
        S.token = r.token; S.user = r.user; lsSet(LSP + 'token', r.token); lsSet(LSP + 'user', r.user);
        startApp(true);
      } catch (e2) { err('Tidak dapat terhubung ke server. Periksa koneksi internet.'); btn.disabled = false; btn.classList.remove('busy'); }
    };
    setTimeout(() => { const i = $('input', f); i && window.innerWidth > 760 && i.focus(); }, 60);
  }
  $$('[data-at]', app).forEach(b => b.onclick = () => draw(b.dataset.at));
  draw('in');
}
function authLost() {
  if (EMBED) { clearInterval(APP.timer); return CFG.authLost && CFG.authLost(); }
  S.token = ''; lsSet(LSP + 'token', ''); clearInterval(APP.timer);
  MODALS.slice().forEach(m => m.close());
  showAuth('Sesi Anda telah berakhir. Silakan masuk kembali.');
}
async function logout() {
  if (EMBED) return CFG.logout && CFG.logout();
  if (!await confirmBox('Keluar', 'Keluar dari aplikasi di perangkat ini?', 'Keluar', false)) return;
  try { await rpc('bw_logout', { p_token: S.token }); } catch { }
  S.token = ''; lsSet(LSP + 'token', ''); clearInterval(APP.timer);
  showAuth();
}

/* ---------- kerangka ---------- */
function startApp(fresh) {
  document.body.className = 'in';
  loadCache();
  const app = $('#app');
  if (EMBED) { document.body.className = 'in embed'; app.innerHTML = '<div class="mainw"><main id="main"></main></div>'; }
  else app.innerHTML =
    '<aside class="side"><a class="slogo" href="#/"><img src="assets/logo.png" alt="PT. Armada Hada Graha"><div><b>' + esc(BC) + '</b><span>' + PT + '</span></div></a>' +
    '<nav class="snav"><a href="#/" data-r="">' + ic('home') + '<span>Beranda</span></a><div class="sgrp">Kartu Operasional</div>' +
    ORDER.map((k, i) => '<a href="#/' + k + '" data-r="' + k + '">' + ic(MODS[k].icon) + '<span>' + esc(MODS[k].title) + '</span><em>' + String(i + 1).padStart(2, '0') + '</em></a>').join('') +
    '</nav><a class="shelp guide" href="Guide.pdf" download="Guide.pdf">' + ic('file') + '<div><b>Panduan Penggunaan</b><span>Unduh Guide.pdf</span></div></a><a class="shelp" target="_blank" rel="noopener" href="' + esc(helpLink()) + '">' + ic('wa') + '<div><b>Bantuan Admin</b><span>+62 822-9977-4825</span></div></a></aside>' +
    '<div class="scrim"></div>' +
    '<div class="mainw"><header class="top"><button class="ibtn menu" aria-label="Menu">' + ic('menu') + '</button><div class="crumb"></div>' +
    '<div class="tright"><span class="net ok" id="net"><i></i><span>Tersinkron</span></span>' +
    '<a class="ibtn" target="_blank" rel="noopener" title="Bantuan admin via WhatsApp" href="' + esc(helpLink()) + '">' + ic('help') + '</a>' +
    '<div class="umenu"><button class="ubtn"><span class="av">' + esc(initials(S.user.name)) + '</span><span class="un"><b>' + esc(S.user.name) + '</b><small>' + esc(S.user.jabatan || (S.user.role === 'admin' ? 'Administrator' : 'Pengguna')) + '</small></span>' + ic('down') + '</button>' +
    '<div class="udrop"><a href="#/profil">' + ic('user') + 'Profil & kata sandi</a>' + (S.user.role === 'admin' ? '<a href="#/pengguna">' + ic('users') + 'Kelola pengguna</a>' : '') +
    '<a href="Guide.pdf" download="Guide.pdf">' + ic('file') + 'Unduh panduan (PDF)</a><a target="_blank" rel="noopener" href="' + esc(helpLink()) + '">' + ic('wa') + 'Hubungi admin</a><button data-logout>' + ic('logout') + 'Keluar</button></div></div></div></header>' +
    '<main id="main"></main></div>';
  if (!EMBED) {
    $('.menu', app).onclick = () => document.body.classList.toggle('drawer');
    $('.scrim', app).onclick = () => document.body.classList.remove('drawer');
    const um = $('.umenu', app);
    $('.ubtn', um).onclick = e => { e.stopPropagation(); um.classList.toggle('open'); };
    document.addEventListener('click', () => um.classList.remove('open'));
    $('[data-logout]', um).onclick = logout;
  }
  S.listeners.clear();
  S.listeners.add(debounce(() => refreshView(), 120));
  window.onhashchange = () => route();
  route(true);
  setNetState();
  syncNow(fresh && !S.seq);
  clearInterval(APP.timer);
  APP.timer = setInterval(() => { if (!document.hidden) syncNow(); }, 6000);
  setTimeout(() => { if (S.token && Date.now() - (lsGet(LSP + 'bppbSync', 0) || 0) > 30 * 60e3) bppbSheetSync(false); }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  window.addEventListener('online', () => syncNow());
  rpc('bw_me', { p_token: S.token }).then(r => {
    if (r.err === 'auth') return authLost();
    S.user = r.user; S.users = r.users || []; lsSet(LSP + 'user', r.user);
    const un = $('.un b'); if (un) un.textContent = S.user.name;
  }).catch(() => { });
}
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
function route(first) {
  const r = (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
  if (APP.route === 'mp' && r !== 'mp') MODS.mp.leave();
  APP.route = r;
  document.body.classList.remove('drawer');
  $$('.snav a').forEach(a => a.classList.toggle('on', a.dataset.r === r));
  const main = $('#main');
  const title = r === '' ? 'Beranda' : r === 'pengguna' ? 'Kelola Pengguna' : r === 'profil' ? 'Profil' : MODS[r] ? MODS[r].title : 'Beranda';
  if (CFG.onRoute) CFG.onRoute(r, title);
  if ($('.crumb')) $('.crumb').innerHTML = r === '' ? '<b>Beranda</b>' : '<a href="#/">Beranda</a>' + ic('right') + '<b>' + esc(title) + '</b>';
  document.title = title + ' · ' + BC;
  main.classList.remove('enter');
  const draw = () => {
    APP.ctl = null; APP.jxOn = JXON();
    if (r === '') renderHome(main);
    else if (r === 'pengguna') renderUsers(main);
    else if (r === 'profil') { renderHome(main); profileForm(); history.replaceState(null, '', '#/'); APP.route = ''; }
    else if (MODS[r]) APP.ctl = MODS[r].render(main);
    else renderHome(main);
    window.scrollTo(0, 0);
    void main.offsetWidth; main.classList.add('enter');
  };
  draw();
}
function refreshView() {
  if (!MODALS.length && APP.ctl && JXON() !== APP.jxOn && ['kas', 'mkt', 'cust', 'jual'].includes(APP.route)) return route(); // tab penjualan sheet muncul setelah data tersinkron
  if (MODALS.length && APP.route !== '') { if (APP.ctl) APP.ctl.fill(); return; }
  if (APP.ctl) APP.ctl.fill();
  else if (APP.route === '') renderHome($('#main'), true);
  else if (APP.route === 'pengguna') renderUsers($('#main'));
}

/* ---------- beranda ---------- */
function renderHome(main) {
  const h = new Date().getHours();
  const salam = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  const jd = jualData({ month: curMonth() }), kt = kasTotals();
  const prodM = all('prod').filter(p => p.status !== 'Batal' && inMonth(p.tgl, curMonth()));
  const alerts = homeAlerts();
  main.innerHTML =
    '<section class="hero"><div><p class="hk">' + esc(HARI[new Date().getDay()] + ', ' + tgl(today(), true)) + '</p><h1>' + salam + ', ' + esc(S.user.name.split(' ')[0]) + '</h1><p>Ringkasan operasional ' + BC + ' — unit AMP, CMP, SCP, dan PCP.</p></div>' +
    '<div class="hstats">' + kpi('Penjualan bulan ini', rpS(jd.nilai), 'profit ' + rpS(jd.profit)) + kpi('SO / WO bulan ini', prodM.length, 'nilai ' + rpS(sum(prodM, p => p.vol * p.harga))) + kpi('Saldo kas', rpS(kt.saldo)) + kpi('Piutang', rpS(kt.piutang), kt.telat ? kt.telat + ' lewat jatuh tempo' : 'terkendali', kt.telat ? 'bad' : '') + '</div></section>' +
    (alerts.length ? '<section class="alerts"><h3>' + ic('alert') + 'Perlu perhatian</h3><div>' + alerts.map(a => '<a href="#/' + a.r + '" class="al ' + a.t + '"><b>' + esc(a.h) + '</b><span>' + esc(a.d) + '</span>' + ic('right') + '</a>').join('') + '</div></section>' : '') +
    '<div class="sech"><h2>Kartu Operasional</h2><p>Pilih kartu untuk mengelola data. Semua kartu saling terhubung dan dapat dicetak menjadi laporan PDF.</p></div>' +
    '<div class="cards">' + ORDER.map((k, i) => { const m = MODS[k]; let s = {}; try { s = m.summary(); } catch (e) { console.error(e); } return '<a class="mcard" href="#/' + k + '" style="--d:' + (i * 35) + 'ms"><div class="mtop"><span class="mic">' + ic(m.icon) + '</span><em>' + String(i + 1).padStart(2, '0') + '</em></div><h3>' + esc(m.title) + '</h3><p>' + esc(m.desc) + '</p><div class="mstat ' + (s.tone || '') + '"><b>' + esc(s.main || '') + '</b><span>' + esc(s.sub || '') + '</span></div><span class="mgo">Buka kartu' + ic('right') + '</span></a>'; }).join('') + '</div>';
}
function homeAlerts() {
  const a = [];
  let low = [];
  UNITS.forEach(u => stockSaldo(u).forEach(r => { if ((r.status === 'Menipis' || r.status === 'Habis') && (r.masuk || r.prod || r.keluar)) low.push(u + ' ' + r.m.nama); }));
  if (low.length) a.push({ r: 'stok', t: 'warn', h: low.length + ' material menipis / habis', d: low.slice(0, 3).join(', ') + (low.length > 3 ? ', …' : '') });
  const inv = all('inv').filter(i => invStat(i).telat);
  if (inv.length) a.push({ r: 'kas', t: 'bad', h: inv.length + ' invoice lewat jatuh tempo', d: 'Total ' + rp(sum(inv, i => invStat(i).sisa)) + ' — lakukan follow up via WhatsApp' });
  const ht = all('hutang').filter(h => htStat(h).telat);
  if (ht.length) a.push({ r: 'kas', t: 'bad', h: ht.length + ' hutang lewat jatuh tempo', d: 'Total ' + rp(sum(ht, h => htStat(h).sisa)) });
  const mt = all('mt').filter(mtLate);
  if (mt.length) a.push({ r: 'mt', t: 'warn', h: mt.length + ' perbaikan lewat estimasi', d: mt.slice(0, 3).map(m => m.alat).join(', ') });
  const bp = all('bppb').filter(b => bppbStat(b).st !== 'Terealisasi' && daysBetween(b.tgl, today()) > 7);
  if (bp.length) a.push({ r: 'bppb', t: 'warn', h: bp.length + ' BPPB belum terealisasi lebih dari 7 hari', d: bp.slice(0, 3).map(b => b.no).join(', ') });
  const jd = all('jadwal').filter(j => j.tgl === today() && j.status === 'Rencana');
  if (jd.length) a.push({ r: 'jadwal', t: 'info', h: jd.length + ' jadwal pengiriman hari ini', d: jd.slice(0, 3).map(j => j.unit + ' ' + j.proyek).join(', ') });
  return a;
}

/* ---------- pengguna & profil ---------- */
async function renderUsers(main) {
  if (S.user.role !== 'admin') { main.innerHTML = '<div class="empty">' + ic('lock') + '<p>Halaman ini khusus admin.</p></div>'; return; }
  try { const r = await rpc('bw_me', { p_token: S.token }); if (r.users) S.users = r.users; } catch { }
  main.innerHTML = '<div class="phead"><div class="ptitle"><span class="ptile">' + ic('users') + '</span><div><h1>Kelola Pengguna</h1><p>Akun yang terdaftar melalui halaman Daftar Akun</p></div></div></div>' +
    '<section class="card">' + table([
      { t: 'Nama', f: u => '<b>' + esc(u.name) + '</b><small>' + esc(u.jabatan || '-') + '</small>', raw: true }, { t: 'WhatsApp', f: u => '<a target="_blank" rel="noopener" href="' + esc(waLink(u.wa)) + '">' + esc(waShow(u.wa)) + '</a>', raw: true },
      { t: 'Terdaftar', f: u => tgl(String(u.created).slice(0, 10)) }, { t: 'Terakhir aktif', f: u => u.seen ? tglJam(u.seen) : '-' },
      { t: 'Peran', f: u => '<select data-role="' + u.id + '"' + (u.id === S.user.id ? ' disabled' : '') + '><option value="user"' + (u.role === 'user' ? ' selected' : '') + '>Pengguna</option><option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>Admin</option></select>', raw: true },
      { t: 'Status', f: u => '<label class="sw"><input type="checkbox" data-akt="' + u.id + '"' + (u.aktif ? ' checked' : '') + (u.id === S.user.id ? ' disabled' : '') + '><i></i><span>' + (u.aktif ? 'Aktif' : 'Nonaktif') + '</span></label>', raw: true }
    ], S.users.map(u => Object.assign({}, u))) + '</section>';
  const set = async (id, role, aktif) => { const r = await rpc('bw_user_set', { p_token: S.token, p_uid: +id, p_role: role, p_aktif: aktif }); if (r.err) toast('Gagal: ' + r.err, 'err'); else toast('Pengguna diperbarui'); renderUsers(main); };
  $$('[data-role]', main).forEach(s => s.onchange = () => { const u = S.users.find(x => x.id == s.dataset.role); set(u.id, s.value, u.aktif); });
  $$('[data-akt]', main).forEach(c => c.onchange = () => { const u = S.users.find(x => x.id == c.dataset.akt); set(u.id, u.role, c.checked); });
}
function profileForm() {
  openForm({
    title: 'Profil Saya', sub: 'No. WhatsApp: ' + waShow(S.user.wa), small: true, value: { name: S.user.name, jabatan: S.user.jabatan },
    fields: [{ k: 'name', label: 'Nama lengkap', req: true }, { k: 'jabatan', label: 'Jabatan' }, { k: 'old', label: 'Kata sandi lama', type: 'password', help: 'Isi hanya jika ingin mengganti kata sandi' }, { k: 'new', label: 'Kata sandi baru', type: 'password' }],
    onSave: async x => {
      try {
        const r = await rpc('bw_profile', { p_token: S.token, p_name: x.name, p_jabatan: x.jabatan || '', p_old: x.old || '', p_new: x.new || '' });
        if (r.err) { toast({ old: 'Kata sandi lama salah', pass: 'Kata sandi baru minimal 6 karakter' }[r.err] || r.err, 'err'); return false; }
        S.user = r.user; lsSet(LSP + 'user', r.user); toast('Profil tersimpan'); startApp();
      } catch { toast('Tidak dapat terhubung ke server', 'err'); return false; }
    }
  });
}

/* ---------- mulai ---------- */
window.addEventListener('DOMContentLoaded', () => {
  if (EMBED) { if (S.token) startApp(); else authLost(); return; }
  if (S.token && S.user) startApp(); else showAuth();
});
