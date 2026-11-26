/* Kartu 20 "SK & Dokumen" — Surat Keputusan, upah borong, dan dokumen resmi PT. Armada Hada Graha (satu daftar untuk semua basecamp).
   File disimpan seperti file Virtual Work lain (Google Drive AHG lewat Edge Function ahg-file), keterangan di tabel ahg_sk.
   Siapa saja boleh mengupload. Menghapus wajib kata sandi (dicek di server: ahg_sk_del); file SK juga tidak bisa dihapus dari Task › Files. */
'use strict';
ICONS.skdok = '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 11h6M9 14.5h6"/><circle cx="15.5" cy="18" r="2.2"/><path d="m14.4 19.9-.6 2.1 1.7-.8 1.7.8-.6-2.1"/>';
ICONS.upload = '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>';
ICONS.dl = '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>';

const SKD_FN = SB_URL + '/functions/v1/ahg-file', SKD_LS = 'ahgbc.skdok', SKD_MAX = 104857600;
const SKD = { items: lsGet(SKD_LS, []) || [], at: 0, busy: false, err: '', urls: new Map() };
const skTok = () => S.token || CFG.token || '';
const skMe = () => (CFG.sess && CFG.sess.name) || (S.user && S.user.id) || '';
const skSize = b => b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const skExt = n => (String(n || '').match(/\.([A-Za-z0-9]{1,5})$/) || [])[1] || '';
const skKind = it => /pdf/i.test(it.mime) || /^pdf$/i.test(skExt(it.name)) ? 'pdf' : /^image\//.test(it.mime || '') ? 'img' : 'file';
const skBcOpts = () => { const l = bcList().slice(); if (!CFG.all && BCN && !l.includes(BCN)) l.push(BCN); return l; };
const skBcLabel = b => b ? 'Basecamp ' + b : 'Semua basecamp';
const skUid = () => { const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', r = crypto.getRandomValues(new Uint8Array(22)); return 'sk' + [...r].map(x => a[x % 62]).join(''); };
const skErr = e => ({ pin: 'Kata sandi salah', locked: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.', auth: 'Sesi habis, login ulang.', missing: 'Dokumen tidak ditemukan (mungkin sudah dihapus).', forbidden: 'Tidak diizinkan.', judul: 'Judul wajib diisi', quota: 'Penyimpanan penuh.' }[e] || ('Gagal: ' + e));

/* ---------- server ---------- */
async function skLoad(force) {
  if (SKD.busy || (!force && Date.now() - SKD.at < 20e3)) return;
  SKD.busy = true;
  try {
    const r = await rpcRaw('ahg_sk_list', { p_token: skTok() });
    if (r && r.err === 'auth') { SKD.err = 'Sesi habis, login ulang.'; return; }
    if (!r || !r.ok) throw new Error((r && r.err) || 'server');
    SKD.items = r.items || []; SKD.at = Date.now(); SKD.err = ''; lsSet(SKD_LS, SKD.items);
  } catch (e) { SKD.err = 'Tidak dapat memuat daftar dokumen (' + e.message + ').'; }
  finally { SKD.busy = false; skRe(); }
}
const skRe = () => { if (APP.route === 'sk' && SKD.ctl) SKD.ctl.fill(); };
async function skFn(path, body) {
  const r = await fetch(SKD_FN + path, { method: 'POST', cache: 'no-store', headers: { 'x-token': skTok(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error(r.status === 413 ? 'Penyimpanan file AHG penuh.' : r.status === 401 ? 'Sesi habis, login ulang.' : 'Server file: ' + ((j && j.error) || r.status)); e.status = r.status; throw e; }
  return j;
}
async function skPut(id, file, onProg) { // sama dengan Virtual Work: sesi resumable Google Drive (cadangan Supabase Storage), 8 MiB per bagian
  const retry = async fn => { for (let t = 0; ; t++) { try { return await fn(); } catch (e) { if (t >= 2 || e.status && e.status < 500) throw e; await new Promise(r => setTimeout(r, 800 * (t + 1))); } } };
  const mime = file.type || 'application/octet-stream';
  const u = await skFn('/up', { id, size: file.size, name: file.name, mime });
  if (u.drive) {
    const n = Math.ceil(file.size / u.part);
    for (let i = 0; i < n; i++) {
      const from = i * u.part, to = Math.min(file.size, from + u.part) - 1;
      await retry(async () => {
        const r = await fetch(u.drive, { method: 'PUT', body: file.slice(from, to + 1), headers: { 'Content-Range': 'bytes ' + from + '-' + to + '/' + file.size } });
        if (!(r.ok || r.status === 308)) { const e = new Error('Upload ke Google Drive gagal (bagian ' + (i + 1) + '/' + n + ').'); e.status = r.status === 404 || r.status === 410 ? 400 : r.status; throw e; }
      });
      onProg && onProg((i + 1) / n);
    }
    await retry(() => skFn('/done', { id }));
    return;
  }
  const n = u.urls.length;
  for (let i = 0; i < n; i++) {
    await retry(async () => { const r = await fetch(u.urls[i], { method: 'PUT', body: file.slice(i * u.part, (i + 1) * u.part), headers: { 'Content-Type': 'application/octet-stream' } }); if (!r.ok) { const e = new Error('Upload gagal (bagian ' + (i + 1) + '/' + n + ').'); e.status = r.status; throw e; } });
    onProg && onProg((i + 1) / n);
  }
  const r = await rpcRaw('ahg_file_st', { p_token: skTok(), p_id: id, p_name: file.name, p_mime: mime, p_size: file.size });
  if (!r || !r.ok) throw new Error('Upload gagal (' + ((r && r.err) || 'server') + ').');
}
async function skBlob(it) { // unduh lewat proksi ahg-file (token Google tidak pernah ke browser)
  if (SKD.urls.has(it.id)) return SKD.urls.get(it.id);
  const w = await rpcRaw('ahg_file_where', { p_token: skTok(), p_id: it.id });
  if (!w || !w.ok) throw new Error(w && w.err === 'auth' ? 'Sesi habis, login ulang.' : 'File tidak ditemukan.');
  const parts = [];
  if (w.gd) {
    const n = Math.max(1, Math.ceil(w.size / 8388608));
    for (let i = 0; i < n; i++) {
      const r = await fetch(SKD_FN + '/dl', { method: 'POST', cache: 'no-store', headers: { 'x-token': skTok(), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, i }) });
      if (!r.ok) throw new Error(r.status === 401 ? 'Sesi habis, login ulang.' : 'File tidak ditemukan di Google Drive.');
      parts.push(await r.arrayBuffer());
    }
  } else if (w.st) {
    const g = await skFn('/get', { id: it.id });
    for (const link of g.urls) { const r = await fetch(link); if (!r.ok) throw new Error('File tidak ditemukan.'); parts.push(await r.arrayBuffer()); }
  } else throw new Error('File tidak tersedia.');
  const url = URL.createObjectURL(new Blob(parts, { type: w.mime || it.mime || '' }));
  SKD.urls.set(it.id, url); return url;
}

/* ---------- tampilan ---------- */
function skRows(s) {
  const q = (s.q || '').trim().toLowerCase();
  return SKD.items.filter(it => {
    if (s.kat && (it.kat || 'Lainnya') !== s.kat) return false;
    if (s.bcf === 'ini' && !CFG.all && it.bc && it.bc !== BCN) return false;
    if (s.bcf && s.bcf !== 'ini' && s.bcf !== '*' && (it.bc || '') !== (s.bcf === '-' ? '' : s.bcf)) return false;
    return !q || [it.judul, it.nomor, it.kat, it.ket, it.name, it.bc, it.oleh].join(' ').toLowerCase().includes(q);
  }).sort((a, b) => String(b.tgl || b.at || '').localeCompare(String(a.tgl || a.at || '')) || String(b.at).localeCompare(String(a.at)));
}
const skKats = () => [...new Set(SKD.items.map(it => it.kat || 'Lainnya'))].sort((a, b) => a.localeCompare(b, 'id'));
function skFilter(s) {
  const k = skKats(), bcs = [...new Set(SKD.items.map(it => it.bc).filter(Boolean))].sort();
  return '<div class="fbar"><div class="sbox">' + ic('search') + '<input type="search" placeholder="Cari judul, nomor, keterangan…" value="' + esc(s.q || '') + '" data-fk="q"></div>' +
    '<select data-fk="kat"><option value="">Semua kategori</option>' + k.map(x => '<option' + (s.kat === x ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select>' +
    '<select data-fk="bcf">' + (CFG.all ? '' : '<option value="ini"' + (s.bcf === 'ini' ? ' selected' : '') + '>' + esc(BC) + ' + umum</option>') + '<option value="*"' + (s.bcf === '*' || (CFG.all && (!s.bcf || s.bcf === 'ini')) ? ' selected' : '') + '>Semua dokumen</option><option value="-"' + (s.bcf === '-' ? ' selected' : '') + '>Hanya dokumen umum</option>' +
    bcs.map(b => '<option value="' + esc(b) + '"' + (s.bcf === b ? ' selected' : '') + '>Basecamp ' + esc(b) + '</option>').join('') + '</select></div>';
}
function skBody(s) {
  if (!SKD.at && !SKD.items.length) return SKD.err ? '<div class="note">' + esc(SKD.err) + '</div>' : '<div class="empty">' + ic('skdok') + '<p>Memuat dokumen…</p></div>';
  const rows = skRows(s), all = SKD.items;
  const last = all.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  const k = '<div class="kpis">' + kpi('Jumlah dokumen', num(all.length), rows.length !== all.length ? num(rows.length) + ' sesuai filter' : 'semua kategori') +
    kpi('Kategori', num(skKats().length), esc(skKats().slice(0, 3).join(', ')) || '-') +
    kpi('Ukuran total', skSize(sum(all, 'size')), 'Google Drive AHG') +
    kpi('Terakhir diupload', last ? esc(tgl(String(last.at).slice(0, 10))) : '-', last ? 'oleh ' + esc(last.oleh) : '') + '</div>';
  const note = '<div class="note skinfo">' + ic('lock') + '<span>Siapa saja boleh mengupload dokumen. Dokumen yang sudah diupload <b>tidak bisa dihapus</b> tanpa kata sandi.</span></div>';
  if (!rows.length) return k + (SKD.err ? '<div class="note">' + esc(SKD.err) + '</div>' : '') + note + '<div class="empty">' + ic('skdok') + '<p>' + (all.length ? 'Tidak ada dokumen yang sesuai filter.' : 'Belum ada dokumen. Tekan Upload Dokumen untuk menambahkan.') + '</p></div>';
  const groups = groupBy(rows, it => it.kat || 'Lainnya');
  const html = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'id')).map(g => {
    const list = groups[g];
    return '<section class="card skgrp"><div class="chead"><h3>' + ic('file') + ' ' + esc(g) + '</h3><div class="cmeta">' + num(list.length) + ' dokumen · ' + skSize(sum(list, 'size')) + '</div></div>' +
      table([
        { t: 'No', w: '42px', f: r => list.indexOf(r) + 1 },
        { t: 'Dokumen', raw: true, f: r => '<div class="skdoc"><span class="skic sk-' + skKind(r) + '">' + esc((skExt(r.name) || 'file').toUpperCase()) + '</span><div><b>' + esc(r.judul) + '</b>' + (r.nomor ? '<small>Nomor ' + esc(r.nomor) + '</small>' : '') + (r.ket ? '<small class="skket">' + esc(r.ket) + '</small>' : '') + '<small class="muted">' + esc(r.name) + ' · ' + skSize(r.size) + '</small></div></div>' },
        { t: 'Tanggal', f: r => r.tgl ? tgl(r.tgl) : '-' },
        { t: 'Berlaku', raw: true, f: r => r.bc ? '<span class="bcbadge" style="--bct:' + bcTone(r.bc) + '">' + esc(r.bc) + '</span>' : chip('Semua basecamp', 'info') },
        { t: 'Diupload', raw: true, f: r => esc(r.oleh) + '<small class="muted" style="display:block">' + esc(tglJam(r.at)) + '</small>' },
        { t: '', cls: 'skact', raw: true, f: r => '<button class="btn ghost sm" data-skv="' + esc(r.id) + '" title="Lihat">' + ic('eye') + '<span>Lihat</span></button><button class="ibtn sm" data-skd="' + esc(r.id) + '" title="Unduh" aria-label="Unduh">' + ic('dl') + '</button><button class="ibtn sm" data-ske="' + esc(r.id) + '" title="Ubah keterangan" aria-label="Ubah">' + ic('edit') + '</button><button class="ibtn sm skdel" data-skx="' + esc(r.id) + '" title="Hapus (wajib kata sandi)" aria-label="Hapus">' + ic('trash') + '</button>' }
      ], list) + '</section>';
  }).join('');
  return k + (SKD.err ? '<div class="note">' + esc(SKD.err) + '</div>' : '') + note + html;
}
function skBind(el) {
  const get = id => SKD.items.find(x => x.id === id);
  $$('[data-skv]', el).forEach(b => b.onclick = () => skView(get(b.dataset.skv)));
  $$('[data-skd]', el).forEach(b => b.onclick = () => skDown(get(b.dataset.skd), b));
  $$('[data-ske]', el).forEach(b => b.onclick = () => skEdit(get(b.dataset.ske)));
  $$('[data-skx]', el).forEach(b => b.onclick = () => skDel(get(b.dataset.skx)));
}

/* ---------- lihat / unduh ---------- */
async function skView(it) {
  if (!it) return;
  const m = modal({ title: it.judul, sub: [it.nomor ? 'Nomor ' + it.nomor : '', it.tgl ? tgl(it.tgl, true) : '', skBcLabel(it.bc)].filter(Boolean).join(' · '), wide: true, cls: 'skview', body: '<div class="skvw"><div class="empty"><p>Memuat file…</p></div></div>' });
  m.foot.innerHTML = '<span class="muted small">' + esc(it.name) + ' · ' + skSize(it.size) + ' · diupload ' + esc(it.oleh) + ' ' + esc(tglJam(it.at)) + '</span><span class="grow"></span><button class="btn ghost" data-sko>' + ic('right') + 'Buka di tab baru</button><button class="btn pri" data-skdl>' + ic('dl') + 'Unduh</button>';
  $('[data-skdl]', m.foot).onclick = e => skDown(it, e.currentTarget);
  let url = '';
  $('[data-sko]', m.foot).onclick = () => { if (url) window.open(url, '_blank'); };
  try {
    url = await skBlob(it);
    const box = $('.skvw', m.body), k = skKind(it);
    box.innerHTML = k === 'pdf' ? '<iframe src="' + url + '#view=FitH" title="' + esc(it.judul) + '"></iframe>' : k === 'img' ? '<img src="' + url + '" alt="' + esc(it.judul) + '">' :
      '<div class="empty">' + ic('file') + '<p>Pratinjau tidak tersedia untuk file ini. Tekan Unduh untuk membukanya.</p></div>';
  } catch (e) { const box = $('.skvw', m.body); if (box) box.innerHTML = '<div class="empty">' + ic('alert') + '<p>' + esc(e.message) + '</p></div>'; }
}
async function skDown(it, btn) {
  if (!it) return;
  if (btn) btn.disabled = true;
  try {
    const url = await skBlob(it), a = document.createElement('a');
    a.href = url; a.download = it.name || (it.judul + '.' + (skExt(it.name) || 'pdf')); document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { toast(e.message, 'err'); }
  finally { if (btn) btn.disabled = false; }
}

/* ---------- upload ---------- */
const skTitle = n => String(n || '').replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
function skUpload() {
  const F = []; let busy = false;
  const kats = skKats(), bcs = skBcOpts();
  const m = modal({ title: 'Upload Dokumen', sub: 'Dokumen bisa dilihat semua pengguna. Setelah diupload, menghapus wajib kata sandi.', wide: true, cls: 'skup', onClose: () => { } });
  m.body.innerHTML = '<label class="skdrop" tabindex="0"><input type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip">' + ic('upload') +
    '<b>Pilih file atau seret ke sini</b><span>PDF, gambar, Word, Excel, dll. · maks 100 MB per file · bisa beberapa file sekaligus</span></label>' +
    '<div class="sklist"></div>' +
    '<div class="fgrid skmeta">' +
    '<div class="fld"><label for="sk_kat">Kategori</label><input id="sk_kat" list="sk_katl" value="' + esc(kats.includes('SK Upah Borong') ? 'SK Upah Borong' : kats[0] || 'Surat Keputusan') + '" maxlength="80" autocomplete="off"><datalist id="sk_katl">' + [...new Set(kats.concat(['Surat Keputusan', 'SK Upah Borong', 'Peraturan Perusahaan', 'SOP', 'Surat Edaran', 'Kontrak', 'Lainnya']))].map(x => '<option value="' + esc(x) + '">').join('') + '</datalist></div>' +
    '<div class="fld"><label for="sk_bc">Berlaku untuk</label><select id="sk_bc"><option value="">Semua basecamp</option>' + bcs.map(b => '<option value="' + esc(b) + '">Basecamp ' + esc(b) + '</option>').join('') + '</select></div>' +
    '<div class="fld"><label for="sk_tgl">Tanggal dokumen</label><input id="sk_tgl" type="date"></div>' +
    '<div class="fld"><label for="sk_no">Nomor dokumen</label><input id="sk_no" maxlength="120" placeholder="mis. 0162/HRD/DIR/SK/XII/2025" autocomplete="off"></div>' +
    '<div class="fld full"><label for="sk_ket">Keterangan</label><textarea id="sk_ket" rows="2" maxlength="1000" placeholder="Opsional"></textarea></div></div>';
  m.foot.innerHTML = '<span class="muted small skst"></span><span class="grow"></span><button class="btn ghost" data-x>Batal</button><button class="btn pri" data-s disabled>' + ic('upload') + '<span>Upload</span></button>';
  const inp = $('input[type=file]', m.body), drop = $('.skdrop', m.body), list = $('.sklist', m.body), go = $('[data-s]', m.foot), st = $('.skst', m.foot);
  const draw = () => {
    list.innerHTML = F.map((f, i) => '<div class="skf' + (f.done ? ' ok' : f.err ? ' bad' : '') + '"><span class="skic sk-' + (/pdf/i.test(f.file.type) || /\.pdf$/i.test(f.file.name) ? 'pdf' : /^image\//.test(f.file.type) ? 'img' : 'file') + '">' + esc((skExt(f.file.name) || 'file').toUpperCase()) + '</span>' +
      '<div class="skfm"><input data-ti="' + i + '" value="' + esc(f.judul) + '" maxlength="200" placeholder="Judul dokumen"' + (busy || f.done ? ' disabled' : '') + '><small>' + esc(f.file.name) + ' · ' + skSize(f.file.size) + (f.err ? ' · <b>' + esc(f.err) + '</b>' : f.done ? ' · terupload' : f.p ? ' · ' + Math.round(f.p * 100) + '%' : '') + '</small>' + (f.p && !f.done ? '<i class="skp"><i style="width:' + Math.round(f.p * 100) + '%"></i></i>' : '') + '</div>' +
      (busy || f.done ? '' : '<button class="ibtn sm" data-rm="' + i + '" aria-label="Buang">' + ic('close') + '</button>') + '</div>').join('');
    $$('[data-ti]', list).forEach(x => x.oninput = () => { F[+x.dataset.ti].judul = x.value; });
    $$('[data-rm]', list).forEach(x => x.onclick = () => { F.splice(+x.dataset.rm, 1); draw(); });
    go.disabled = busy || !F.some(f => !f.done);
  };
  const add = files => {
    for (const file of files) {
      if (file.size > SKD_MAX) { toast('"' + file.name + '" terlalu besar (maks 100 MB)', 'err'); continue; }
      if (!file.size) continue;
      F.push({ file, judul: skTitle(file.name), p: 0 });
    }
    draw();
  };
  inp.onchange = () => { add([...inp.files]); inp.value = ''; };
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('on'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('on'); }));
  drop.addEventListener('drop', e => add([...(e.dataTransfer && e.dataTransfer.files || [])]));
  $('[data-x]', m.foot).onclick = () => { if (busy) { toast('Tunggu upload selesai', 'err'); return; } m.close(); };
  go.onclick = async () => {
    const todo = F.filter(f => !f.done);
    if (!todo.length) return;
    if (todo.some(f => !f.judul.trim())) { toast('Judul dokumen wajib diisi', 'err'); return; }
    const meta = { kat: $('#sk_kat', m.body).value.trim() || 'Lainnya', bc: $('#sk_bc', m.body).value, tgl: $('#sk_tgl', m.body).value, nomor: $('#sk_no', m.body).value.trim(), ket: $('#sk_ket', m.body).value.trim() };
    busy = true; draw(); let ok = 0;
    for (const f of todo) {
      f.err = ''; st.textContent = 'Mengupload ' + f.file.name + '…';
      try {
        const id = f.id || (f.id = skUid());
        if (!f.up) { await skPut(id, f.file, p => { f.p = Math.min(.98, p); draw(); }); f.up = true; }
        const r = await rpcRaw('ahg_sk_add', { p_token: skTok(), p_id: id, p_meta: Object.assign({}, meta, { judul: f.judul.trim() }) });
        if (!r || !r.ok) throw new Error(skErr((r && r.err) || 'server'));
        f.done = true; f.p = 1; ok++;
        SKD.items = [r.item].concat(SKD.items.filter(x => x.id !== r.item.id)); lsSet(SKD_LS, SKD.items);
      } catch (e) { f.err = e.message; }
      draw();
    }
    busy = false; st.textContent = ''; draw(); skRe();
    if (ok) toast(ok + ' dokumen terupload');
    if (F.every(f => f.done)) setTimeout(() => m.close(), 400);
  };
  draw();
  setTimeout(() => inp.click(), 200);
}

/* ---------- ubah / hapus ---------- */
function skEdit(it) {
  if (!it) return;
  const mine = it.oleh === skMe();
  openForm({
    title: 'Ubah keterangan dokumen', sub: it.name, value: Object.assign({}, it, { pin: '' }), saveLabel: 'Simpan',
    fields: [
      { k: 'judul', label: 'Judul', req: true, full: true, max: 200 },
      { k: 'kat', label: 'Kategori', type: 'list', opts: () => skKats() },
      { k: 'bc', label: 'Berlaku untuk', type: 'select', empty: 'Semua basecamp', opts: () => skBcOpts().map(b => ({ v: b, t: 'Basecamp ' + b })) },
      { k: 'tgl', label: 'Tanggal dokumen', type: 'date' },
      { k: 'nomor', label: 'Nomor dokumen', max: 120 },
      { k: 'ket', label: 'Keterangan', type: 'textarea', rows: 2 },
      { k: 'pin', label: 'Kata sandi', type: 'password', req: !mine, show: () => !mine, help: 'Dokumen ini diupload oleh ' + it.oleh + ' — mengubah wajib kata sandi.' }
    ],
    onSave: async v => {
      try {
        const r = await rpcRaw('ahg_sk_edit', { p_token: skTok(), p_id: it.id, p_meta: { judul: v.judul, kat: v.kat, bc: v.bc, tgl: v.tgl || '', nomor: v.nomor, ket: v.ket }, p_pin: mine ? null : String(v.pin || '') });
        if (!r || !r.ok) { toast(skErr((r && r.err) || 'server'), 'err'); return false; }
        SKD.items = SKD.items.map(x => x.id === it.id ? r.item : x); lsSet(SKD_LS, SKD.items); skRe(); toast('Keterangan dokumen disimpan');
      } catch (e) { toast('Tidak dapat terhubung ke server', 'err'); return false; }
    }
  });
}
function skDel(it) {
  if (!it) return;
  openForm({
    title: 'Hapus dokumen', sub: it.judul, small: true, value: {}, saveLabel: 'Hapus permanen',
    fields: [{ k: 'info', type: 'html', html: () => '<p class="ctext">Dokumen <b>' + esc(it.judul) + '</b> (' + esc(it.name) + ') akan dihapus untuk semua pengguna dan semua basecamp, termasuk filenya di Google Drive. Tindakan ini tidak bisa dibatalkan.</p>' },
      { k: 'pin', label: 'Kata sandi hapus', type: 'password', req: true }],
    onSave: async v => {
      try {
        const r = await rpcRaw('ahg_sk_del', { p_token: skTok(), p_id: it.id, p_pin: String(v.pin || '') });
        if (!r || !r.ok) { toast(skErr((r && r.err) || 'server'), 'err'); return false; }
        SKD.items = SKD.items.filter(x => x.id !== it.id); lsSet(SKD_LS, SKD.items); skRe(); toast('Dokumen dihapus');
      } catch (e) { toast('Tidak dapat terhubung ke server', 'err'); return false; }
    }
  });
}

/* ---------- laporan PDF: daftar dokumen ---------- */
async function skReport(s) {
  const rows = skRows(s);
  const R = await pdfReport({ title: 'Daftar SK & Dokumen', sub: (CFG.all ? 'Semua basecamp' : BC) + ' · per ' + tgl(today(), true), orient: 'l', fname: 'SK_Dokumen_' + today() });
  R.kv([['Jumlah dokumen', num(rows.length)], ['Kategori', num(new Set(rows.map(r => r.kat || 'Lainnya')).size)], ['Ukuran total', skSize(sum(rows, 'size'))]]);
  const g = groupBy(rows, r => r.kat || 'Lainnya');
  Object.keys(g).sort((a, b) => a.localeCompare(b, 'id')).forEach(k => {
    R.h2(k, g[k].length + ' dokumen');
    R.table(['No', 'Judul', 'Nomor', 'Tanggal', 'Berlaku', 'File', 'Diupload'], g[k].map((r, i) => [i + 1, r.judul + (r.ket ? '\n' + r.ket : ''), r.nomor || '-', r.tgl ? tgl(r.tgl) : '-', r.bc || 'Semua basecamp', r.name + ' (' + skSize(r.size) + ')', r.oleh + ', ' + tglJam(r.at)]), { cs: { 0: { halign: 'center', cellWidth: 10 } } });
  });
  R.sign([['Dibuat oleh,', S.user ? S.user.name : ''], ['Diperiksa oleh,', ''], ['Disetujui oleh,', '']]);
  await R.save();
}

MODS.sk = {
  title: 'SK & Dokumen', icon: 'skdok', desc: 'Surat Keputusan, ketentuan upah borong, dan dokumen resmi perusahaan untuk semua basecamp',
  render(root) {
    const st = stateOf('sk', { q: '', kat: '', bcf: CFG.all ? '*' : 'ini' });
    if (CFG.all && st.bcf === 'ini') st.bcf = '*';
    skLoad();
    const ctl = page(root, {
      key: 'sk', st, report: skReport,
      actions: [{ id: 'up', t: 'Upload Dokumen', icon: 'upload', pri: true }, { id: 'rf', t: 'Muat ulang', icon: 'refresh' }],
      on: { up: () => skUpload(), rf: () => skLoad(true) },
      filter: skFilter,
      body: skBody,
      bind: el => skBind(el)
    });
    SKD.ctl = APP.ctl = ctl; return ctl;
  },
  summary() { if (!SKD.at && !SKD.busy && skTok()) skLoad(); const n = SKD.items.length; return n ? { main: n + ' dokumen', sub: skKats().length + ' kategori · ' + skSize(sum(SKD.items, 'size')) } : { main: SKD.at ? 'Belum ada dokumen' : 'Memuat…', sub: 'SK, upah borong, dokumen resmi' }; }
};
