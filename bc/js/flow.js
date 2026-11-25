/* Kartu 19 Flow Chart (SOP) PT. Armada Hada Graha: bagan alur, prosedur langkah, penanggung jawab.
   Satu sumber untuk semua basecamp = dokumen Bawen (kind 'param', id prmFlow…, wajib kata sandi edit, dicek server). */
'use strict';
ICONS.flow = '<rect x="8.5" y="2.5" width="7" height="4.5" rx="1.2"/><path d="m12 9.5 3.6 3-3.6 3-3.6-3 3.6-3Z"/><path d="M12 7v2.5M12 15.5v2"/><rect x="8.5" y="17.5" width="7" height="4" rx="2"/><path d="M15.6 12.5H20v7h-4.5"/>';
ICONS.undo = '<path d="M9 7H15a5 5 0 0 1 0 10H8"/><path d="m12 3.5-4 3.5 4 3.5"/>';
ICONS.redo = '<path d="M15 7H9a5 5 0 0 0 0 10h7"/><path d="m12 3.5 4 3.5-4 3.5"/>';
ICONS.link = '<circle cx="5.5" cy="12" r="2.5"/><circle cx="18.5" cy="12" r="2.5"/><path d="M8 12h8"/>';
ICONS.full = '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';

const FC_PRE = 'prmFlow', FC_EMB = typeof EMBED !== 'undefined' && EMBED, FC_REMOTE = FC_EMB && BCN !== 'Bawen';
const FC_LSP = typeof LSP !== 'undefined' ? LSP : 'bw.';
const FC_DEP = {
  MKT: { t: 'Marketing', c: '#1f7a4d', s: '#e9f5ee' }, FIN: { t: 'Finance & Accounting', c: '#1f5fae', s: '#e9f1fb' }, PRY: { t: 'Proyek', c: '#9a3d86', s: '#f8ecf5' },
  UNT: { t: 'Unit', c: '#9a3d86', s: '#f8ecf5' }, HRD: { t: 'HRD', c: '#9a3d86', s: '#f8ecf5' }, PPIC: { t: 'PPIC', c: '#b8560f', s: '#fdf0e5' }, LAIN: { t: 'Lainnya', c: '#556274', s: '#eff2f6' }
};
const FC_SH = { awal: 'Mulai', proses: 'Proses', putusan: 'Keputusan (Ya / Tidak)', dok: 'Dokumen', stok: 'Stok / penyimpanan', kas: 'Selesai / kas masuk-keluar' };
const fcDep = k => FC_DEP[k] || FC_DEP.LAIN;
const fcClone = o => JSON.parse(JSON.stringify(o));
const fcPics = s => String(s || '').split(/[,\/]/).map(x => x.trim()).filter(Boolean);

/* ---------- data ---------- */
const FLX = { docs: new Map(), seq: 0, busy: false, at: 0, err: '', loaded: false }; // salinan dokumen Bawen untuk basecamp lain / Semua Basecamp
const FLW = { ed: null, geo: new Map(), hl: '', full: false, drag: null, sel: null, link: null };
function fxLoad() { if (FLX.loaded) return; FLX.loaded = true; const c = lsGet('ahgbc.sopflow', null); if (c && Array.isArray(c.docs)) { c.docs.forEach(d => FLX.docs.set(d.id, d)); FLX.seq = c.seq || 0; } }
function fcList() {
  let out;
  if (FC_REMOTE) { fxLoad(); out = [...FLX.docs.values()].filter(d => !d.del).map(d => Object.assign({}, d.data, { id: d.id, _by: d.by, _at: d.at })); }
  else out = all('param').filter(d => String(d.id).startsWith(FC_PRE));
  return out.filter(d => d.sop && Array.isArray(d.nodes)).sort((a, b) => (a.urut || 0) - (b.urut || 0));
}
const fcRaw = id => fcList().find(f => f.id === id);
async function fcSync() {
  if (!FC_REMOTE) return syncNow();
  if (FLX.busy) return; FLX.busy = true; fxLoad();
  let changed = false;
  try {
    let more = true, guard = 0;
    while (more && guard++ < 20) {
      const r = await rpc('bw_sync', { p_token: S.token, p_bc: 'Bawen', p_since: FLX.seq });
      if (r && r.err === 'auth') { authLost(); return; }
      if (!r || r.err) throw new Error(r && r.err || 'server');
      (r.docs || []).forEach(d => { if (String(d.id).startsWith(FC_PRE)) { FLX.docs.set(d.id, d); changed = true; } });
      FLX.seq = Math.max(FLX.seq, r.seq || 0); more = r.more;
    }
    FLX.err = ''; FLX.at = Date.now();
    lsSet('ahgbc.sopflow', { seq: FLX.seq, docs: [...FLX.docs.values()] });
  } catch (e) { FLX.err = 'Belum dapat memuat flow chart. Periksa koneksi internet.'; changed = !fcList().length; } finally { FLX.busy = false; }
  if (changed && APP.route === 'flow' && APP.ctl) APP.ctl.fill();
}
if (FC_REMOTE) setInterval(() => { if (APP.route === 'flow' && !document.hidden && S.token && Date.now() - FLX.at > 20e3) fcSync(); }, 10e3);
/* simpan langsung ke server: bila ditolak (kunci edit berakhir) perubahan tetap ada di layar */
async function fcPut(docs) {
  const a = { p_token: S.token, p_docs: docs.map(d => ({ id: d.id, kind: 'param', data: d.data, del: !!d.del })) };
  if (FC_EMB) a.p_bc = 'Bawen';
  const r = await rpc('bw_put', a);
  if (r && r.err === 'auth') { authLost(); throw new Error('sesi berakhir'); }
  if (!r || r.err) throw new Error(r && r.err === 'big' ? 'data terlalu besar' : (r && r.err) || 'server');
  if (r.rej && r.rej.length) { EDITK.until = 0; throw new Error('kunci'); }
  docs.forEach(d => {
    const M = FC_REMOTE ? FLX.docs : S.docs, o = M.get(d.id) || {};
    M.set(d.id, Object.assign({}, o, { id: d.id, kind: 'param', data: d.data, del: !!d.del, by: S.user ? S.user.name : '', at: new Date().toISOString() }));
  });
  fcSync();
}
async function fcSave(docs) {
  for (let i = 0; i < 2; i++) {
    try { await fcPut(docs); return true; } catch (e) {
      if (e.message === 'kunci' && i === 0) { if (!await editGate('Flow Chart SOP')) return false; continue; }
      toast(e.message === 'kunci' ? 'Perubahan ditolak: perlu kata sandi edit' : /fetch|network|HTTP/i.test(e.message) ? 'Tidak dapat terhubung ke server. Perubahan belum tersimpan.' : 'Gagal menyimpan: ' + e.message, 'err'); return false;
    }
  }
  return false;
}

/* ---------- tata letak & jalur panah (siku, menghindari kotak) ---------- */
const FLN = { w: 166, h: 62, gx: 46, gy: 34, pad: 16, head: 34 };
let fcCv;
function fcWrap(t, max, font, lines) {
  fcCv = fcCv || document.createElement('canvas').getContext('2d'); fcCv.font = font;
  const out = []; let cur = '';
  String(t || '').split(/\s+/).filter(Boolean).forEach(w => { const n = cur ? cur + ' ' + w : w; if (fcCv.measureText(n).width <= max || !cur) cur = n; else { out.push(cur); cur = w; } });
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; let l = out[lines - 1]; while (l && fcCv.measureText(l + '…').width > max) l = l.slice(0, -1); out[lines - 1] = l + '…'; }
  return out;
}
function fcGeom(f, extra = 0) {
  const key = JSON.stringify([f.kol, f.nodes.map(n => [n.id, n.c, n.r, n.t, n.pic, n.sh]), f.edges, extra]);
  const hit = FLW.geo.get(f.id); if (hit && hit.key === key) return hit;
  const C = Math.max(1, ...f.nodes.map(n => n.c + 1), sum(f.kol || [], k => +k.n || 1)) + extra, R = Math.max(1, ...f.nodes.map(n => n.r + 1)) + extra;
  const cw = FLN.w + FLN.gx, rh = FLN.h + FLN.gy, X0 = FLN.pad, Y0 = FLN.pad + FLN.head + 8;
  const PX = x => X0 + x * cw / 2, PY = y => Y0 + y * rh / 2;
  const by = {}, occ = {};
  f.nodes.forEach(n => { const cx = PX(2 * n.c + 1), cy = PY(2 * n.r + 1); by[n.id] = { n, x: cx - FLN.w / 2, y: cy - FLN.h / 2, w: FLN.w, h: FLN.h, cx, cy }; occ[(2 * n.c + 1) + ',' + (2 * n.r + 1)] = n.id; });
  const W2 = 2 * C, H2 = 2 * R, segs = {}, vert = {};
  const D = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // bawah, kanan, atas, kiri
  const list = f.edges.filter(e => by[e.a] && by[e.b] && e.a !== e.b);
  const order = list.slice().sort((p, q) => { const d = e => { const a = by[e.a].n, b = by[e.b].n; return Math.abs(a.c - b.c) * 1.5 + Math.abs(a.r - b.r) + (a.c !== b.c && a.r !== b.r ? 3 : 0); }; return d(p) - d(q); });
  const rel = (e, o) => e.a === o.a || e.b === o.b;
  const path = {};
  order.forEach(e => {
    const A = by[e.a].n, B = by[e.b].n, sx = 2 * A.c + 1, sy = 2 * A.r + 1, tx = 2 * B.c + 1, ty = 2 * B.r + 1;
    const K = (x, y, d) => (y * (W2 + 1) + x) * 5 + d;
    const best = new Map(), open = [[0, sx, sy, 4, null]];
    let end = null, guard = 0;
    while (open.length && guard++ < 60000) {
      let m = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[m][0]) m = i;
      const cur = open.splice(m, 1)[0], [g, x, y, d] = cur;
      if (x === tx && y === ty) { end = cur; break; }
      const k0 = K(x, y, d); if (best.has(k0) && best.get(k0) < g) continue;
      for (let i = 0; i < 4; i++) {
        if (d < 4 && (i + 2) % 4 === d) continue;
        const nx = x + D[i][0], ny = y + D[i][1];
        if (nx < 0 || ny < 0 || nx > W2 || ny > H2) continue;
        const o = occ[nx + ',' + ny], tgt = nx === tx && ny === ty;
        if (o && !tgt) continue;
        let c = 1;
        if (d < 4 && d !== i) c += 2.2;
        if (nx % 2 && ny % 2 && !tgt) c += 0.15;
        if (nx === 0 || ny === 0 || nx === W2 || ny === H2) c += 0.4;
        if (x === sx && y === sy && i === 2) c += 3; // keluar dari atas
        if (tgt && i === 2) c += 3; // masuk dari bawah
        if (x === sx && y === sy) { // keputusan: cabang Ya turun, cabang lain ke samping
          (vert[x + ',' + y + ',' + i + ',in'] || []).forEach(() => c += 9);
        }
        if (tgt) (vert[nx + ',' + ny + ',' + i + ',out'] || []).forEach(() => c += 9);
        const sk = i % 2 ? Math.min(x, nx) + ',' + y + ',h' : x + ',' + Math.min(y, ny) + ',v';
        (segs[sk] || []).forEach(o2 => { if (!rel(e, o2)) c += 14; else c += o2.a === e.a ? -0.25 : 0.9; });
        (vert[nx + ',' + ny] || []).forEach(v => { if (!rel(e, v.e) && v.ax !== i % 2) c += 2.6; });
        const ng = g + c, nk = K(nx, ny, i);
        if (!best.has(nk) || best.get(nk) > ng) { best.set(nk, ng); open.push([ng, nx, ny, i, cur]); }
      }
    }
    let pts = [];
    for (let p = end; p; p = p[4]) pts.unshift([p[1], p[2]]);
    if (!pts.length) pts = [[sx, sy], [sx, ty], [tx, ty]];
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], dir = x2 > x1 ? 1 : x2 < x1 ? 3 : y2 > y1 ? 0 : 2;
      const sk = dir % 2 ? Math.min(x1, x2) + ',' + y1 + ',h' : x1 + ',' + Math.min(y1, y2) + ',v';
      (segs[sk] = segs[sk] || []).push(e);
      if (i < pts.length - 1) (vert[x2 + ',' + y2] = vert[x2 + ',' + y2] || []).push({ e, ax: dir % 2 });
      if (i === 1) { const k = x1 + ',' + y1 + ',' + ((dir + 2) % 4) + ',out'; (vert[k] = vert[k] || []).push(e); }
      if (i === pts.length - 1) { const k = x2 + ',' + y2 + ',' + ((dir + 2) % 4) + ',in'; (vert[k] = vert[k] || []).push(e); }
    }
    path[e.id] = pts;
  });
  const edges = list.map(e => {
    let p = path[e.id].map(([x, y]) => [PX(x), PY(y)]);
    p = p.filter((q, i) => !i || i === p.length - 1 || !((p[i - 1][0] === q[0] && q[0] === p[i + 1][0]) || (p[i - 1][1] === q[1] && q[1] === p[i + 1][1])));
    const clip = (nd, q) => Math.abs(q[0] - nd.cx) > 1 && Math.abs(q[1] - nd.cy) < 1 ? [q[0] > nd.cx ? nd.x + nd.w : nd.x, nd.cy] : [nd.cx, q[1] > nd.cy ? nd.y + nd.h : nd.y];
    p[0] = clip(by[e.a], p[1]); p[p.length - 1] = clip(by[e.b], p[p.length - 2]);
    const [a, b] = p, v = a[0] === b[0], L = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), s = Math.min(L / 2, v ? 16 : 24);
    return { e, p, lx: v ? a[0] : a[0] + Math.sign(b[0] - a[0]) * s, ly: v ? a[1] + Math.sign(b[1] - a[1]) * s : a[1] };
  });
  const kol = []; let c0 = 0;
  (f.kol || []).forEach(k => { const n = Math.max(1, +k.n || 1); kol.push({ t: k.t, x: X0 + c0 * cw, w: n * cw }); c0 += n; });
  if (c0 < C) kol.push({ t: '', x: X0 + c0 * cw, w: (C - c0) * cw });
  const g = { key, C, R, by, edges, kol, W: X0 * 2 + C * cw, H: Y0 + R * rh + FLN.pad, X0, Y0, cw, rh };
  FLW.geo.set(f.id, g); return g;
}
function fcRound(p, r = 7) {
  let d = 'M' + p[0][0] + ' ' + p[0][1];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], c = p[i + 1];
    if (!c) { d += 'L' + b[0] + ' ' + b[1]; break; }
    const k = Math.min(r, Math.hypot(b[0] - a[0], b[1] - a[1]) / 2, Math.hypot(c[0] - b[0], c[1] - b[1]) / 2);
    const u = [Math.sign(a[0] - b[0]), Math.sign(a[1] - b[1])], v = [Math.sign(c[0] - b[0]), Math.sign(c[1] - b[1])];
    d += 'L' + (b[0] + u[0] * k) + ' ' + (b[1] + u[1] * k) + 'Q' + b[0] + ' ' + b[1] + ' ' + (b[0] + v[0] * k) + ' ' + (b[1] + v[1] * k);
  }
  return d;
}
function fcShape(n, b) {
  const { x, y, w, h } = b;
  if (n.sh === 'kas' || n.sh === 'awal') return '<rect class="sh" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + h / 2 + '"/>';
  if (n.sh === 'putusan') return '<path class="sh" d="M' + b.cx + ' ' + y + 'L' + (x + w) + ' ' + b.cy + 'L' + b.cx + ' ' + (y + h) + 'L' + x + ' ' + b.cy + 'Z"/>';
  if (n.sh === 'stok') { const e = 7; return '<path class="sh" d="M' + x + ' ' + (y + e) + 'a' + w / 2 + ' ' + e + ' 0 0 1 ' + w + ' 0v' + (h - 2 * e) + 'a' + w / 2 + ' ' + e + ' 0 0 1 ' + -w + ' 0Z"/><path class="sh2" d="M' + x + ' ' + (y + e) + 'a' + w / 2 + ' ' + e + ' 0 0 0 ' + w + ' 0"/>'; }
  if (n.sh === 'dok') return '<path class="sh" d="M' + x + ' ' + y + 'h' + w + 'v' + (h - 5) + 'c' + -w * .22 + ' -11 ' + -w * .33 + ' -8 ' + -w / 2 + ' 0s' + -w * .28 + ' 9 ' + -w / 2 + ' 0Z"/>';
  return '<rect class="sh" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8"/><path class="acc" d="M' + (x + 8) + ' ' + y + 'h-3a5 5 0 0 0-5 5v' + (h - 10) + 'a5 5 0 0 0 5 5h3Z"/>';
}
const FC_F1 = '600 12.5px Inter, system-ui, sans-serif', FC_F2 = '400 11px Inter, system-ui, sans-serif';
function fcText(n, b) {
  const dm = n.sh === 'putusan', pill = n.sh === 'kas' || n.sh === 'awal', mw = dm ? b.w * .56 : pill ? b.w - 34 : b.w - 30;
  const a = fcWrap(n.t, mw, FC_F1, 2), p = dm ? [] : fcWrap(n.pic, mw, FC_F2, 4 - a.length > 2 ? 2 : 4 - a.length);
  const l1 = 14.5, l2 = 13, H = a.length * l1 + p.length * l2 + (p.length ? 1 : 0);
  let y = b.cy - H / 2 + 11 + (n.sh === 'stok' ? 5 : n.sh === 'dok' ? -3 : 0);
  let o = a.map(t => { const s = '<text class="t1" x="' + b.cx + '" y="' + y.toFixed(1) + '">' + esc(t) + '</text>'; y += l1; return s; }).join('');
  y += 0.5; o += p.map(t => { const s = '<text class="t2" x="' + b.cx + '" y="' + y.toFixed(1) + '">' + esc(t) + '</text>'; y += l2; return s; }).join('');
  return o;
}
const fcBx = n => n.sh === 'putusan' ? 34 : n.sh === 'kas' || n.sh === 'awal' ? 8 : 4, fcBy = n => n.sh === 'kas' || n.sh === 'awal' ? 9 : 4; // letak nomor langkah
function fcSvg(f, edit) {
  const g = fcGeom(f, edit ? 1 : 0), hl = FLW.hl, q = hl.toLowerCase();
  const match = n => !q || qMatch(hl, n.t, n.pic, fcDep(n.dep).t);
  const no = {}; f.nodes.forEach((n, i) => no[n.id] = i + 1);
  let o = '<svg class="fcsvg' + (edit ? ' edit' : '') + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + g.W + ' ' + g.H + '" width="' + g.W + '" height="' + g.H + '" role="img" aria-label="Flow chart ' + esc(f.judul) + '">' +
    '<defs><marker id="fca" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto"><path d="M0 0.6L9.4 5L0 9.4L2.2 5Z" fill="#4a5a70"/></marker><marker id="fcb" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0.6L9.4 5L0 9.4L2.2 5Z" fill="#c62828"/></marker></defs>';
  g.kol.forEach((k, i) => {
    o += '<rect class="band' + (i % 2 ? ' b2' : '') + '" x="' + (k.x + 3) + '" y="' + FLN.pad + '" width="' + (k.w - 6) + '" height="' + (g.H - 2 * FLN.pad) + '" rx="10"/>';
    if (k.t) o += '<path class="bhead" d="M' + (k.x + 3) + ' ' + (FLN.pad + FLN.head) + 'v' + -(FLN.head - 10) + 'a10 10 0 0 1 10 -10h' + (k.w - 26) + 'a10 10 0 0 1 10 10v' + (FLN.head - 10) + 'Z"/><text class="bt" x="' + (k.x + k.w / 2) + '" y="' + (FLN.pad + FLN.head / 2 + 4.2) + '">' + esc(fcWrap(k.t, k.w - 18, '600 12.5px Inter, sans-serif', 1)[0] || '') + '</text>';
  });
  if (edit) for (let c = 0; c < g.C; c++) for (let r = 0; r < g.R; r++) o += '<rect class="cell" x="' + (g.X0 + c * g.cw + FLN.gx / 2) + '" y="' + (g.Y0 + r * g.rh + FLN.gy / 2) + '" width="' + FLN.w + '" height="' + FLN.h + '" rx="8"/>';
  g.edges.forEach(({ e, p }) => {
    const d = fcRound(p), on = FLW.sel && FLW.sel.e === e.id;
    o += '<g class="ed' + (on ? ' on' : '') + '" data-e="' + esc(e.id) + '" data-a="' + esc(e.a) + '" data-b="' + esc(e.b) + '">' + (edit ? '<path class="hit" d="' + d + '"/>' : '') + '<path class="ln" d="' + d + '" marker-end="url(#' + (on ? 'fcb' : 'fca') + ')"/></g>';
  });
  f.nodes.forEach(n => {
    const b = g.by[n.id], dp = fcDep(n.dep);
    o += '<g class="nd k-' + n.sh + (FLW.sel && FLW.sel.n === n.id ? ' on' : '') + (FLW.link === n.id ? ' lk' : '') + (match(n) ? (q ? ' hit' : '') : ' dim') + '" data-n="' + esc(n.id) + '" tabindex="0" role="button" aria-label="' + esc(no[n.id] + '. ' + n.t + (n.pic ? ', ' + n.pic : '')) + '" style="--c:' + dp.c + ';--s:' + dp.s + '">' +
      fcShape(n, b) + fcText(n, b) + '<circle class="nb" cx="' + (b.x + fcBx(n)) + '" cy="' + (b.y + fcBy(n)) + '" r="9.5"/><text class="nt" x="' + (b.x + fcBx(n)) + '" y="' + (b.y + fcBy(n) + 3.6) + '">' + no[n.id] + '</text>' +
      (edit ? '<circle class="cn" data-cn="' + esc(n.id) + '" cx="' + (b.x + b.w) + '" cy="' + (b.y + b.h) + '" r="8"/><path class="cnp" d="M' + (b.x + b.w - 3.5) + ' ' + (b.y + b.h) + 'h7m-3 -3l3 3l-3 3"/>' : '') + '</g>';
  });
  g.edges.forEach(({ e, lx, ly }) => { if (!e.t) return; const w = Math.max(30, e.t.length * 6.6 + 12); o += '<g class="el"><rect x="' + (lx - w / 2) + '" y="' + (ly - 9) + '" width="' + w + '" height="18" rx="9"/><text x="' + lx + '" y="' + (ly + 3.8) + '">' + esc(e.t) + '</text></g>'; });
  return o + '</svg>';
}

/* ---------- halaman ---------- */
const FC_AREA = 'Flow Chart SOP';
function fcCur(s) { const l = fcList(); return l.find(f => f.id === s.f) || l[0] || null; }
const fcView = s => { const f = fcCur(s); return FLW.ed && f && FLW.ed.id === f.id ? FLW.ed.d : f; };
function fcLegend(f) {
  const used = [...new Set(f.nodes.map(n => n.dep))], sh = [...new Set(f.nodes.map(n => n.sh))];
  return '<div class="fcleg"><div>' + Object.keys(FC_DEP).filter(k => used.includes(k)).map(k => '<span><i style="background:' + FC_DEP[k].c + '"></i>' + esc(FC_DEP[k].t) + '</span>').join('') + '</div><div>' +
    Object.keys(FC_SH).filter(k => sh.includes(k)).map(k => '<span><svg viewBox="-3 -3 112 56" class="lsh">' + fcShape({ sh: k }, { x: 0, y: 0, w: 106, h: 48, cx: 53, cy: 24 }) + '</svg>' + esc({ awal: 'Mulai', proses: 'Proses', putusan: 'Keputusan', dok: 'Dokumen', stok: 'Stok', kas: 'Kas / selesai' }[k]) + '</span>').join('') + '</div></div>';
}
function fcChips(s) {
  return '<div class="fcpick" role="tablist" aria-label="Pilih alur">' + fcList().map(f => '<button role="tab" data-fc="' + esc(f.id) + '" class="' + (fcCur(s).id === f.id ? 'on' : '') + '"' + (FLW.ed && FLW.ed.id !== f.id ? ' disabled' : '') + '><em>' + esc(f.kode || '') + '</em><b>' + esc(f.judul) + '</b><small>' + f.nodes.length + ' langkah</small></button>').join('') + (editOpen() && !FLW.ed ? '<button class="add" data-fcnew>' + ic('plus') + '<b>Alur baru</b></button>' : '') + '</div>';
}
function fcBar(f, s) {
  if (FLW.ed && FLW.ed.id === f.id) {
    const sel = FLW.sel || {}, b = (k, i, t, dis, cls) => '<button class="btn sm ' + (cls || 'ghost') + '" data-ed="' + k + '"' + (dis ? ' disabled' : '') + ' title="' + esc(t) + '">' + ic(i) + '<span>' + esc(t) + '</span></button>';
    return '<div class="fcbar edit"><div class="g">' + b('add', 'plus', 'Tambah langkah') + b('link', 'link', FLW.link ? 'Pilih tujuan…' : 'Hubungkan', !sel.n, FLW.link ? 'pri' : 'ghost') + b('form', 'edit', 'Ubah', !sel.n && !sel.e) + b('del', 'trash', 'Hapus', !sel.n && !sel.e, 'ghost dangert') + '</div><div class="g">' + b('undo', 'undo', 'Urungkan', !FLW.ed.un.length) + b('redo', 'redo', 'Ulangi', !FLW.ed.re.length) + '</div><div class="g">' + b('row', 'in', 'Sisip baris', !sel.n) + b('col', 'right', 'Sisip kolom', !sel.n) + b('tidy', 'layers', 'Rapikan') + b('prop', 'org', 'Judul & kolom') + b('std', 'refresh', 'Versi awal') + '</div><div class="g end">' + b('cancel', 'close', 'Batal') + b('save', 'check', 'Simpan', !fcDirty(), 'pri') + '</div></div>';
  }
  return '<div class="fcbar"><label class="srch">' + ic('search') + '<input data-hl placeholder="Cari langkah, PIC, atau departemen" value="' + esc(FLW.hl) + '"></label>' +
    '<select data-hp aria-label="Sorot penanggung jawab"><option value="">Semua penanggung jawab</option>' + [...new Set(f.nodes.flatMap(n => fcPics(n.pic)))].sort((a, b) => a.localeCompare(b)).map(p => '<option' + (FLW.hl === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select><span class="grow"></span>' +
    '<div class="g"><button class="ibtn sm" data-z="-" aria-label="Perkecil">&minus;</button><button class="btn ghost sm" data-z="fit">Muat layar</button><button class="btn ghost sm" data-z="1">100%</button><button class="ibtn sm" data-z="+" aria-label="Perbesar">+</button><button class="btn ghost sm" data-z="full">' + ic('full') + '<span>' + (FLW.full ? 'Tutup layar penuh' : 'Layar penuh') + '</span></button></div></div>';
}
function fcHead(f) {
  return '<div class="fchead"><div><span class="kode">' + esc(f.kode || '-') + '</span><div><h2>Flow Chart ' + esc(f.judul) + '</h2><p>' + esc(f.sub || '') + '</p></div></div><dl><div><dt>Revisi</dt><dd>' + String(+f.rev || 0).padStart(2, '0') + '</dd></div><div><dt>Tanggal</dt><dd>' + tgl(f.revTgl) + '</dd></div><div><dt>Langkah</dt><dd>' + f.nodes.length + '</dd></div></dl></div>';
}
function fcBody(s) {
  const f = fcView(s);
  if (!f) return '<div class="empty">' + ic('flow') + '<p>' + esc(FLX.err || 'Memuat flow chart…') + '</p>' + (FLX.err ? '<button class="btn" data-fcre>' + ic('refresh') + 'Coba lagi</button>' : '') + '</div>';
  const ed = FLW.ed && FLW.ed.id === f.id;
  if (s.tab === 'pic') return editBadge() + fcPicHtml();
  if (s.tab === 'sop') return editBadge() + fcChips(s) + '<section class="card flush fccard">' + fcHead(f) + fcSopHtml(f) + '</section>' + fcHist(f);
  return editBadge() + fcChips(s) + '<section class="card flush fccard' + (FLW.full ? ' full' : '') + '">' + fcHead(f) + fcBar(f, s) +
    (ed ? '<p class="fchint">' + (FLW.link ? 'Klik langkah tujuan untuk menghubungkan panah dari langkah terpilih. Tekan Esc untuk batal.' : 'Geser kotak untuk memindahkan (menimpa kotak lain = tukar tempat). Klik dua kali untuk mengubah isi. Tarik bulatan panah di sudut kotak ke langkah lain untuk menghubungkan. Klik garis untuk memberi label atau menghapus.') + '</p>' : '') +
    '<div class="fcw"><div class="fcin">' + fcSvg(f, ed) + '</div></div>' + fcLegend(f) + '</section>' + fcHist(f);
}
function fcHist(f) {
  const r = (f.riwayat || []).slice().reverse();
  return (f.ket ? '<div class="note">' + esc(f.ket) + '</div>' : '') + (r.length ? '<section class="card"><div class="chead"><h3>Riwayat Revisi</h3></div>' + table([{ t: 'Revisi', f: x => String(x.rev).padStart(2, '0'), w: '80px' }, { t: 'Tanggal', f: x => tgl(x.tgl), w: '120px' }, { t: 'Oleh', f: x => x.by || '-' }, { t: 'Perubahan', f: x => x.ket || '-', cls: 'wrap' }], r) + '</section>' : '');
}
const fcNext = (f, id) => f.edges.filter(e => e.a === id).map(e => ({ n: f.nodes.find(n => n.id === e.b), t: e.t })).filter(x => x.n);
const fcPrev = (f, id) => f.edges.filter(e => e.b === id).map(e => ({ n: f.nodes.find(n => n.id === e.a), t: e.t })).filter(x => x.n);
const fcNo = (f, id) => f.nodes.findIndex(n => n.id === id) + 1;
const fcNextTxt = (f, id) => fcNext(f, id).map(x => (x.t ? x.t + ': ' : '') + fcNo(f, x.n.id) + '. ' + x.n.t);
function fcSopHtml(f) {
  return table([
    { t: 'No', f: n => fcNo(f, n.id), w: '48px' }, { t: 'Langkah', f: n => '<b>' + esc(n.t) + '</b>', raw: true, cls: 'wrap' },
    { t: 'Departemen', f: n => '<span class="fcdep" style="--c:' + fcDep(n.dep).c + ';--s:' + fcDep(n.dep).s + '">' + esc(fcDep(n.dep).t) + '</span>', raw: true },
    { t: 'Penanggung jawab', f: n => n.pic || '-', cls: 'wrap' }, { t: 'Uraian', f: n => n.u || '-', cls: 'wrap fcu' }, { t: 'Dokumen / keluaran', f: n => n.o || '-', cls: 'wrap' },
    { t: 'Langkah berikutnya', f: n => fcNextTxt(f, n.id).map(esc).join('<br>') || '<span class="muted">Selesai</span>', raw: true, cls: 'wrap' }
  ], f.nodes, { click: true });
}
function fcPicData() {
  const m = new Map();
  fcList().forEach(f => f.nodes.forEach((n, i) => fcPics(n.pic).forEach(p => { if (!m.has(p)) m.set(p, []); m.get(p).push({ f, n, no: i + 1 }); })));
  return [...m].map(([p, l]) => ({ id: p, p, l, deps: [...new Set(l.map(x => x.n.dep))] })).sort((a, b) => a.p.localeCompare(b.p));
}
function fcPicHtml() {
  const l = fcList();
  return '<section class="card flush">' + table([{ t: 'Penanggung jawab', f: r => '<b>' + esc(r.p) + '</b><small>' + r.l.length + ' langkah</small>', raw: true, w: '170px' }, { t: 'Departemen', f: r => [...new Set(r.deps.map(d => fcDep(d).t))].map(t => { const k = Object.keys(FC_DEP).find(x => FC_DEP[x].t === t); return '<span class="fcdep" style="--c:' + FC_DEP[k].c + ';--s:' + FC_DEP[k].s + '">' + esc(t) + '</span>'; }).join(' '), raw: true, cls: 'wrap' }].concat(
    l.map(f => ({ t: f.kode + ' ' + f.judul, f: r => { const x = r.l.filter(y => y.f.id === f.id); return x.length ? '<button class="fclk" data-fcgo="' + esc(f.id) + '" data-p="' + esc(r.p) + '">' + x.map(y => '<span>' + y.no + '. ' + esc(y.n.t) + '</span>').join('') + '</button>' : '<span class="muted">-</span>'; }, raw: true, cls: 'wrap' }))), fcPicData()) + '</section>';
}
MODS.flow = {
  title: 'Flow Chart', icon: 'flow', desc: 'Panduan SOP PT. Armada Hada Graha: bagan alur kerja, prosedur langkah, dan penanggung jawab',
  render(root) {
    const st = stateOf('flow', { tab: 'bagan', f: '' });
    if (FC_REMOTE) fcSync();
    fcResume();
    const ctl = page(root, {
      key: 'flow', st, report: fcReportAsk,
      tabs: [{ k: 'bagan', t: 'Flow Chart' }, { k: 'sop', t: 'Prosedur Langkah' }, { k: 'pic', t: 'Penanggung Jawab' }],
      actions: [{ id: 'edit', t: 'Edit', icon: 'edit', pri: true }], on: { edit: s => fcEdit(s) },
      body: s => { const w = $('.fcw', root); FLW.sc = w ? [w.scrollLeft, w.scrollTop] : FLW.sc; return '<div class="fcroot">' + fcBody(s) + '</div>'; },
      bind: (el, s) => fcBind(el, s, root)
    });
    const fill = ctl.fill;
    ctl.fill = a => { if (FLW.drag) { FLW.late = true; return; } const ae = document.activeElement, q = ae && ae.dataset && ae.dataset.hl !== undefined ? ae.selectionStart : -1; fill(a); if (q >= 0) { const i = $('[data-hl]', root); if (i) { i.focus(); i.setSelectionRange(q, q); } } };
    FLW.ctl = APP.ctl = ctl; return ctl;
  },
  summary() { if (FC_REMOTE && !FLX.at && !FLX.busy && S.token) fcSync(); const l = fcList(); if (!l.length) return { main: 'Memuat…', sub: 'Panduan SOP perusahaan' }; const d = l.map(f => f.revTgl || '').sort().pop(); return { main: l.length + ' alur SOP', sub: sum(l, f => f.nodes.length) + ' langkah · revisi terakhir ' + tgl(d) }; }
};
const fcFullSet = () => { document.body.classList.toggle('noscroll', FLW.full); document.body.classList.toggle('fcfull', FLW.full); };
const fcRe = () => { if (APP.route === 'flow' && FLW.ctl) FLW.ctl.fill(); };
function fcZoom(el, s) {
  const w = $('.fcw', el), svg = $('.fcsvg', el); if (!w || !svg) return;
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const fit = Math.max(innerWidth < 700 ? .5 : .4, Math.min(1.15, (w.clientWidth - 30) / W, FLW.full ? (w.clientHeight - 16) / H : 9));
  let z = s.zoom === 'fit' || s.zoom == null ? fit : +s.zoom;
  if (FLW.ed) z = FLW.ed.z = FLW.ed.z || Math.max(.6, z); // skala tetap selama mengedit
  FLW.z = z; svg.style.width = W * z + 'px'; svg.style.height = H * z + 'px';
}
function fcBind(el, s, root) {
  bindRelock(el);
  const f = fcView(s), re = $('[data-fcre]', el); if (re) re.onclick = () => { FLX.err = ''; fcRe(); fcSync(); };
  $$('[data-fc]', el).forEach(b => b.onclick = () => { s.f = b.dataset.fc; FLW.sel = null; FLW.sc = [0, 0]; fcRe(); });
  const nw = $('[data-fcnew]', el); if (nw) nw.onclick = () => fcNew(s);
  $$('[data-fcgo]', el).forEach(b => b.onclick = () => { if (FLW.ed) { toast('Simpan atau batalkan perubahan terlebih dahulu', 'err'); return; } s.f = b.dataset.fcgo; s.tab = 'bagan'; FLW.hl = b.dataset.p; persist('flow'); MODS.flow.render(root); });
  if (!f) return;
  $$('tr[data-row]', el).forEach(tr => tr.onclick = () => FLW.ed && FLW.ed.id === f.id ? fcNodeForm(f.nodes.find(n => n.id === tr.dataset.row)) : s.tab === 'sop' && fcInfo(f, tr.dataset.row));
  const hi = $('[data-hl]', el); if (hi) hi.oninput = () => { FLW.hl = hi.value.trim(); fcPaint(el, f); };
  const hp = $('[data-hp]', el); if (hp) hp.onchange = () => { FLW.hl = hp.value; fcRe(); };
  $$('[data-z]', el).forEach(b => b.onclick = () => { const k = b.dataset.z, c = FLW.z || 1; if (k === 'full') { FLW.full = !FLW.full; fcFullSet(); s.zoom = 'fit'; fcRe(); requestAnimationFrame(() => fcZoom(el, s)); return; } s.zoom = k === 'fit' ? 'fit' : k === '1' ? 1 : Math.max(.3, Math.min(2, c + (k === '+' ? .12 : -.12))); fcZoom(el, s); });
  $$('[data-ed]', el).forEach(b => b.onclick = () => fcAct(b.dataset.ed, s));
  fcZoom(el, s);
  const w = $('.fcw', el); if (w && FLW.sc) { w.scrollLeft = FLW.sc[0]; w.scrollTop = FLW.sc[1]; }
  const svg = $('.fcsvg', el); if (!svg) return;
  if (FLW.ed && FLW.ed.id === f.id) return fcEditBind(svg, w, s);
  $$('.nd', svg).forEach(n => {
    const id = n.dataset.n, lit = on => { svg.classList.toggle('hov', on); $$('.ed', svg).forEach(e => e.classList.toggle('rel', on && (e.dataset.a === id || e.dataset.b === id))); n.classList.toggle('foc', on); };
    n.onmouseenter = () => lit(true); n.onmouseleave = () => lit(false);
    n.onclick = () => fcInfo(f, id); n.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fcInfo(f, id); } };
  });
  // geser bagan dengan mouse (sentuhan memakai gulir bawaan)
  w.onpointerdown = e => { if (e.pointerType !== 'mouse' || e.button || e.target.closest('.nd')) return; const x = e.clientX, y = e.clientY, l = w.scrollLeft, t = w.scrollTop; w.classList.add('pan'); const mv = v => { w.scrollLeft = l - (v.clientX - x); w.scrollTop = t - (v.clientY - y); }, up = () => { w.classList.remove('pan'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); };
}
function fcPaint(el, f) { $$('.nd', el).forEach(g => { const n = f.nodes.find(x => x.id === g.dataset.n), ok = !FLW.hl || qMatch(FLW.hl, n.t, n.pic, fcDep(n.dep).t); g.classList.toggle('dim', !ok); g.classList.toggle('hit', ok && !!FLW.hl); }); }
function fcInfo(f, id) {
  const n = f.nodes.find(x => x.id === id); if (!n) return;
  const li = a => a.length ? '<ul class="fcul">' + a.map(x => '<li><button data-go="' + esc(x.n.id) + '"><i style="background:' + fcDep(x.n.dep).c + '">' + fcNo(f, x.n.id) + '</i>' + (x.t ? '<em>' + esc(x.t) + '</em>' : '') + esc(x.n.t) + '</button></li>').join('') + '</ul>' : '<span class="muted">-</span>';
  detail({ title: fcNo(f, id) + '. ' + n.t, sub: f.kode + ' · ' + f.judul, wide: false, html: infoGrid([['Departemen', '<span class="fcdep" style="--c:' + fcDep(n.dep).c + ';--s:' + fcDep(n.dep).s + '">' + esc(fcDep(n.dep).t) + '</span>', true], ['Penanggung jawab', n.pic || '-'], ['Jenis langkah', FC_SH[n.sh] || '-'], ['Dokumen / keluaran', n.o || '-']]) + '<div class="fcdt"><h4>Uraian</h4><p>' + esc(n.u || '-') + '</p><h4>Langkah sebelumnya</h4>' + li(fcPrev(f, id)) + '<h4>Langkah berikutnya</h4>' + li(fcNext(f, id)) + '</div>',
    bind: (b, m) => $$('[data-go]', b).forEach(x => x.onclick = () => { m.close(); fcInfo(f, x.dataset.go); }) });
}

/* ---------- mode edit ---------- */
const FC_DK = () => FC_LSP + 'flowdraft.' + (S.user ? S.user.id : 0);
const fcDirty = () => !!FLW.ed && JSON.stringify(fcPart(FLW.ed.d)) !== FLW.ed.base;
const fcPart = d => ({ kode: d.kode, judul: d.judul, sub: d.sub, ket: d.ket || '', urut: d.urut, kol: d.kol, nodes: d.nodes, edges: d.edges });
async function fcEdit(s) {
  if (FLW.ed) { s.f = FLW.ed.id; s.tab = 'bagan'; MODS.flow.render($('#main')); return; }
  const f0 = fcCur(s); if (!f0) return;
  if (!await editGate(FC_AREA)) return;
  const f = fcRaw(f0.id); if (!f) return;
  const d = fcClone(f); delete d._by; delete d._at;
  FLW.ed = { id: f.id, d, base: JSON.stringify(fcPart(d)), at: f._at, un: [], re: [] }; FLW.sel = FLW.link = null; FLW.hl = '';
  if (s.tab === 'pic') s.tab = 'bagan';
  MODS.flow.render($('#main'));
}
function fcResume() { // draf yang belum tersimpan (halaman termuat ulang) dilanjutkan
  if (FLW.ed || FLW.asked) return; FLW.asked = true;
  const x = lsGet(FC_DK(), null); if (!x || !x.d || !Array.isArray(x.d.nodes)) return;
  setTimeout(async () => {
    if (!await confirmBox('Draf belum tersimpan', 'Ada perubahan Flow Chart ' + x.d.judul + ' yang belum tersimpan di perangkat ini. Lanjutkan mengedit?', 'Lanjutkan', false)) { lsSet(FC_DK(), null); return; }
    if (!await editGate(FC_AREA)) return;
    FLW.ed = { id: x.id, d: x.d, base: x.base, at: x.at, un: [], re: [], baru: x.baru }; const s = stateOf('flow', {}); s.f = x.id; s.tab = 'bagan'; if (APP.route === 'flow') MODS.flow.render($('#main'));
  }, 400);
}
function fcMut(fn) { const E = FLW.ed; E.un.push(JSON.stringify(E.d)); if (E.un.length > 80) E.un.shift(); E.re = []; fn(E.d); fcKeep(); fcRe(); }
const fcKeep = debounce(() => lsSet(FC_DK(), FLW.ed && fcDirty() ? { id: FLW.ed.id, d: FLW.ed.d, base: FLW.ed.base, at: FLW.ed.at, baru: FLW.ed.baru } : null), 300);
function fcFree(d, c, r) { const has = (x, y) => d.nodes.some(n => n.c === x && n.r === y); while (has(c, r)) r++; return [c, r]; }
async function fcAct(k, s) {
  const E = FLW.ed; if (!E) return; const d = E.d, sel = FLW.sel || {}, n = d.nodes.find(x => x.id === sel.n);
  if (k === 'add') { const [c, r] = n ? fcFree(d, n.c, n.r + 1) : fcFree(d, 0, 0); fcNodeForm(null, { c, r, dep: n ? n.dep : 'PPIC', after: n ? n.id : '' }); }
  else if (k === 'link') { if (n) { FLW.link = FLW.link ? null : n.id; fcRe(); } }
  else if (k === 'form') { if (n) fcNodeForm(n); else if (sel.e) fcEdgeForm(sel.e); }
  else if (k === 'del') { if (n) fcMut(x => { x.nodes = x.nodes.filter(y => y.id !== n.id); x.edges = x.edges.filter(e => e.a !== n.id && e.b !== n.id); FLW.sel = null; }); else if (sel.e) fcMut(x => { x.edges = x.edges.filter(e => e.id !== sel.e); FLW.sel = null; }); }
  else if (k === 'undo') { if (E.un.length) { E.re.push(JSON.stringify(d)); E.d = JSON.parse(E.un.pop()); FLW.sel = FLW.link = null; fcKeep(); fcRe(); } }
  else if (k === 'redo') { if (E.re.length) { E.un.push(JSON.stringify(d)); E.d = JSON.parse(E.re.pop()); FLW.sel = FLW.link = null; fcKeep(); fcRe(); } }
  else if (k === 'row') { if (n) fcMut(x => x.nodes.forEach(y => { if (y.r >= n.r) y.r++; })); }
  else if (k === 'col') { if (n) fcMut(x => { const at = n.c; x.nodes.forEach(y => { if (y.c >= at) y.c++; }); let c = 0, ok = false; x.kol.forEach(b => { const w = +b.n || 1; if (!ok && at >= c && at < c + w) { b.n = w + 1; ok = true; } c += w; }); }); }
  else if (k === 'tidy') fcMut(fcTidy);
  else if (k === 'prop') fcProp(s);
  else if (k === 'std') { if (!d.acuan) { toast('Alur ini tidak memiliki versi awal', 'err'); return; } if (await confirmBox('Kembalikan versi awal', 'Isi alur dikembalikan ke versi awal. Perubahan baru berlaku setelah Anda menekan Simpan.', 'Kembalikan', true)) fcMut(x => { Object.assign(x, fcClone(x.acuan)); FLW.sel = null; }); }
  else if (k === 'cancel') { if (fcDirty() && !await confirmBox('Batalkan perubahan', 'Perubahan yang belum disimpan akan hilang.', 'Batalkan perubahan', true)) return; fcStop(); }
  else if (k === 'save') fcSaveAsk();
}
function fcTidy(x) { // buang baris & kolom kosong
  const rs = [...new Set(x.nodes.map(n => n.r))].sort((a, b) => a - b), cs = [...new Set(x.nodes.map(n => n.c))].sort((a, b) => a - b);
  let c = 0; x.kol = (x.kol || []).map(b => { const w = +b.n || 1, left = cs.filter(v => v >= c && v < c + w).length; c += w; return { t: b.t, n: left }; }).filter(b => b.n > 0);
  x.nodes.forEach(n => { n.r = rs.indexOf(n.r); n.c = cs.indexOf(n.c); });
}
function fcStop() { FLW.ed = FLW.sel = FLW.link = null; lsSet(FC_DK(), null); if (APP.route === 'flow') MODS.flow.render($('#main')); }
function fcSaveAsk() {
  const E = FLW.ed, d = E.d;
  if (!d.nodes.length) { toast('Alur harus memiliki minimal satu langkah', 'err'); return; }
  openForm({
    title: 'Simpan Perubahan', sub: d.kode + ' · Flow Chart ' + d.judul, small: true, value: { tgl: today(), ket: '' },
    fields: [{ k: 'tgl', label: 'Tanggal revisi', type: 'date', req: true }, { k: 'ket', label: 'Catatan perubahan', type: 'textarea', rows: 3, req: true, ph: 'Contoh: penanggung jawab Purchase Receive diganti' }],
    onSave: async v => {
      await fcSync();
      const now = fcRaw(E.id);
      if (now && E.at && now._at !== E.at && !await confirmBox('Alur sudah berubah', 'Alur ini baru saja diubah oleh ' + (now._by || 'pengguna lain') + '. Timpa dengan versi Anda?', 'Timpa', true)) return false;
      const out = fcClone(d); delete out.id; Object.keys(out).forEach(k => { if (k[0] === '_') delete out[k]; });
      out.sop = 1; out.rev = E.baru ? 0 : Math.max(+(now && now.rev) || 0, +d.rev || 0) + 1; out.revTgl = v.tgl;
      out.riwayat = ((now && now.riwayat) || d.riwayat || []).concat([{ rev: out.rev, tgl: v.tgl, by: S.user ? S.user.name : '', ket: v.ket.trim() }]).slice(-30);
      if (!await fcSave([{ id: E.id, data: out }])) return false;
      toast('Flow Chart ' + out.judul + ' tersimpan, revisi ' + String(out.rev).padStart(2, '0')); fcStop();
    }
  });
}
function fcNodeForm(n, pre) {
  const E = FLW.ed; if (!E) return; const d = E.d, isNew = !n;
  const v = n ? Object.assign({}, n, { no: fcNo(d, n.id) }) : Object.assign({ t: '', pic: '', dep: 'PPIC', sh: 'proses', u: '', o: '', no: pre && pre.after ? fcNo(d, pre.after) + 1 : d.nodes.length + 1 }, pre);
  openForm({
    title: isNew ? 'Tambah Langkah' : 'Ubah Langkah', sub: d.kode + ' · ' + d.judul, wide: true, value: v, saveLabel: isNew ? 'Tambahkan' : 'Terapkan',
    fields: [{ k: 't', label: 'Nama langkah', req: true, full: true }, { k: 'dep', label: 'Departemen', type: 'select', empty: false, opts: Object.keys(FC_DEP).map(k => ({ v: k, t: FC_DEP[k].t })) }, { k: 'sh', label: 'Bentuk', type: 'select', empty: false, opts: Object.keys(FC_SH).map(k => ({ v: k, t: FC_SH[k] })) },
      { k: 'pic', label: 'Penanggung jawab (pisahkan dengan koma)', type: 'list', opts: () => [...new Set(fcList().concat([d]).flatMap(f => f.nodes.flatMap(x => [x.pic])))].filter(Boolean).sort() }, { k: 'no', label: 'Nomor urut langkah', type: 'num', req: true },
      { k: 'u', label: 'Uraian', type: 'textarea', rows: 3 }, { k: 'o', label: 'Dokumen / keluaran', full: true }].concat(isNew && pre && pre.after ? [{ k: 'con', type: 'check', text: 'Hubungkan dari langkah ' + d.nodes.find(x => x.id === pre.after).t, def: true }] : []),
    onSave: x => {
      const id = n ? n.id : uid('n'), o = { id, t: x.t.trim(), pic: fcPics(x.pic).join(', '), dep: x.dep, sh: x.sh, c: n ? n.c : x.c, r: n ? n.r : x.r, u: String(x.u || '').trim(), o: String(x.o || '').trim() };
      fcMut(y => { y.nodes = y.nodes.filter(z => z.id !== id); y.nodes.splice(Math.max(0, Math.min(y.nodes.length, Math.round(+x.no || 1) - 1)), 0, o); if (isNew && pre && pre.after && x.con) y.edges.push({ id: uid('e'), a: pre.after, b: id }); FLW.sel = { n: id }; });
    }
  });
}
function fcEdgeForm(id) {
  const d = FLW.ed.d, e = d.edges.find(x => x.id === id); if (!e) return;
  const nm = k => { const n = d.nodes.find(x => x.id === k); return n ? n.t : '-'; }, opt = d.nodes.map((n, i) => ({ v: n.id, t: (i + 1) + '. ' + n.t }));
  const F = openForm({ title: 'Panah', sub: nm(e.a) + ' ke ' + nm(e.b), small: true, value: { a: e.a, b: e.b, t: e.t || '' }, saveLabel: 'Terapkan', fields: [{ k: 'a', label: 'Dari langkah', type: 'select', empty: false, opts: opt }, { k: 'b', label: 'Ke langkah', type: 'select', empty: false, opts: opt }, { k: 't', label: 'Label (opsional)', ph: 'Contoh: Ya, Tidak, Disetujui', max: 24 }],
    extraBtn: { html: '<button type="button" class="btn ghost dangert" data-edel>' + ic('trash') + 'Hapus panah</button>', bind: (ft, v, m) => $('[data-edel]', ft).onclick = () => { m.close(); fcMut(x => { x.edges = x.edges.filter(y => y.id !== id); FLW.sel = null; }); } },
    onSave: x => { if (x.a === x.b) { toast('Langkah asal dan tujuan tidak boleh sama', 'err'); return false; } fcMut(y => { const z = y.edges.find(q => q.id === id); z.a = x.a; z.b = x.b; if (String(x.t || '').trim()) z.t = x.t.trim(); else delete z.t; }); } });
  return F;
}
function fcConnect(a, b) { const d = FLW.ed.d; FLW.link = null; if (!a || !b || a === b) return fcRe(); if (d.edges.some(e => e.a === a && e.b === b)) { toast('Kedua langkah sudah terhubung', 'err'); return fcRe(); } fcMut(x => { const e = { id: uid('e'), a, b }; x.edges.push(e); FLW.sel = { e: e.id }; }); }
function fcProp(s) {
  const E = FLW.ed, d = E.d;
  openForm({
    title: 'Judul & Kolom', sub: 'Identitas dokumen dan pembagian kolom bagan', wide: true, value: { kode: d.kode, judul: d.judul, sub: d.sub, ket: d.ket || '', urut: d.urut, kol: fcClone(d.kol || []) }, saveLabel: 'Terapkan',
    fields: [{ k: 'kode', label: 'Kode dokumen', req: true }, { k: 'judul', label: 'Judul alur', req: true }, { k: 'sub', label: 'Keterangan singkat', full: true }, { k: 'urut', label: 'Urutan tampil', type: 'num' }, { k: 'ket', label: 'Catatan di bawah bagan', type: 'textarea', rows: 2 }, { k: 'kol', label: 'Kolom bagan (dari kiri ke kanan)', type: 'items', newRow: () => ({ t: '', n: 1 }), cols: [{ k: 't', label: 'Judul kolom' }, { k: 'n', label: 'Lebar (jumlah kolom)', num: true, w: '28%' }] }],
    extraBtn: { html: '<button type="button" class="btn ghost dangert" data-fdel>' + ic('trash') + 'Hapus alur</button>', bind: (ft, v, m) => $('[data-fdel]', ft).onclick = async () => { if (!await confirmBox('Hapus alur', 'Flow Chart ' + d.judul + ' akan dihapus untuk semua basecamp dan semua pengguna. Lanjutkan?')) return; if (!E.baru) { const raw = fcClone(fcRaw(E.id)); delete raw.id; delete raw._by; delete raw._at; if (!await fcSave([{ id: E.id, data: raw, del: true }])) return; } m.close(); toast('Alur dihapus'); fcStop(); } },
    onSave: x => fcMut(y => { y.kode = x.kode.trim(); y.judul = x.judul.trim(); y.sub = String(x.sub || '').trim(); y.ket = String(x.ket || '').trim(); y.urut = +x.urut || y.urut; y.kol = (x.kol || []).map(k => ({ t: String(k.t || '').trim(), n: Math.max(1, Math.min(12, Math.round(+k.n || 1))) })); })
  });
}
async function fcNew(s) {
  if (!await editGate(FC_AREA)) return;
  const l = fcList(), no = l.length + 1;
  openForm({ title: 'Alur Baru', sub: 'Buat flow chart baru', small: true, value: { kode: 'FC-' + String(no).padStart(2, '0'), judul: '', dari: '' }, saveLabel: 'Buat',
    fields: [{ k: 'kode', label: 'Kode dokumen', req: true }, { k: 'judul', label: 'Judul alur', req: true }, { k: 'dari', label: 'Salin dari', type: 'select', empty: 'Bagan kosong', opts: l.map(f => ({ v: f.id, t: f.kode + ' ' + f.judul })) }],
    onSave: x => {
      const src = x.dari && fcRaw(x.dari), id = FC_PRE + uid('x');
      const d = { id, sop: 1, urut: Math.max(0, ...l.map(f => f.urut || 0)) + 1, kode: x.kode.trim(), judul: x.judul.trim(), sub: src ? src.sub : '', ket: '', rev: 0, revTgl: today(), riwayat: [], kol: src ? fcClone(src.kol) : [{ t: 'Alur utama', n: 1 }], nodes: src ? fcClone(src.nodes) : [{ id: uid('n'), t: 'Mulai', pic: '', dep: 'LAIN', sh: 'awal', c: 0, r: 0, u: '', o: '' }], edges: src ? fcClone(src.edges) : [] };
      FLW.ed = { id, d, base: '', at: '', un: [], re: [], baru: true }; FLW.sel = FLW.link = null; s.f = id; s.tab = 'bagan'; MODS.flow.render($('#main'));
    } });
}
// alur baru belum ada di server → tampil dari draf
const fcListSrv = fcList;
fcList = function () { const l = fcListSrv(); if (FLW.ed && FLW.ed.baru && !l.some(f => f.id === FLW.ed.id)) l.push(FLW.ed.d); return l; };
function fcEditBind(svg, w, s) {
  const E = FLW.ed, f = E.d, g = fcGeom(f, 1);
  const pt = e => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * g.W, (e.clientY - r.top) / r.height * g.H]; };
  const at = (x, y) => f.nodes.find(n => { const b = g.by[n.id]; return x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4; });
  const select = o => { if (JSON.stringify(FLW.sel) === JSON.stringify(o)) return; FLW.sel = o; fcRe(); };
  svg.ondblclick = e => { const n = e.target.closest('.nd'), ed = e.target.closest('.ed'); if (n) fcNodeForm(f.nodes.find(x => x.id === n.dataset.n)); else if (ed) fcEdgeForm(ed.dataset.e); };
  svg.onpointerdown = e => {
    if (e.button) return;
    const cn = e.target.closest('[data-cn]'), nd = e.target.closest('.nd'), ed = e.target.closest('.ed');
    if (cn) { // tarik panah
      e.preventDefault(); const id = cn.dataset.cn, b = g.by[id]; FLW.drag = { link: id };
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'path'); ln.setAttribute('class', 'tmp'); svg.appendChild(ln);
      const mv = v => { const [x, y] = pt(v); ln.setAttribute('d', 'M' + (b.x + b.w) + ' ' + (b.y + b.h) + 'L' + x + ' ' + y); const t = at(x, y); $$('.nd', svg).forEach(q => q.classList.toggle('lk', !!t && t.id !== id && q.dataset.n === t.id)); };
      const up = v => { off(); const [x, y] = pt(v), t = at(x, y); FLW.drag = null; if (t && t.id !== id) fcConnect(id, t.id); else { FLW.sel = { n: id }; fcRe(); } };
      const off = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', cx); }, cx = () => { off(); FLW.drag = null; fcRe(); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', cx); return;
    }
    if (nd) {
      const id = nd.dataset.n;
      if (FLW.link) { e.preventDefault(); fcConnect(FLW.link, id); return; }
      const [x0, y0] = pt(e), n = f.nodes.find(q => q.id === id), b = g.by[id]; let moved = false, tc = n.c, tr = n.r, gh = null;
      FLW.drag = { id };
      const mv = v => {
        const [x, y] = pt(v), dx = x - x0, dy = y - y0;
        if (!moved && Math.hypot(dx, dy) < 6) return;
        if (!moved) { moved = true; nd.classList.add('drag'); svg.appendChild(nd); gh = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); gh.setAttribute('class', 'ghost'); gh.setAttribute('width', FLN.w); gh.setAttribute('height', FLN.h); gh.setAttribute('rx', 8); svg.insertBefore(gh, nd); }
        nd.setAttribute('transform', 'translate(' + dx + ' ' + dy + ')');
        tc = Math.max(0, Math.min(g.C - 1, Math.floor((b.cx + dx - g.X0) / g.cw))); tr = Math.max(0, Math.min(g.R - 1, Math.floor((b.cy + dy - g.Y0) / g.rh)));
        gh.setAttribute('x', g.X0 + tc * g.cw + FLN.gx / 2); gh.setAttribute('y', g.Y0 + tr * g.rh + FLN.gy / 2);
        const r = w.getBoundingClientRect(); if (v.clientX > r.right - 30) w.scrollLeft += 12; else if (v.clientX < r.left + 30) w.scrollLeft -= 12;
      };
      const up = () => { off(); FLW.drag = null; if (moved && (tc !== n.c || tr !== n.r)) fcMut(d => { const me = d.nodes.find(q => q.id === id), ot = d.nodes.find(q => q.id !== id && q.c === tc && q.r === tr); if (ot) { ot.c = me.c; ot.r = me.r; } me.c = tc; me.r = tr; FLW.sel = { n: id }; }); else if (moved || FLW.late) { FLW.late = false; FLW.sel = { n: id }; fcRe(); } else if (!FLW.sel || FLW.sel.n !== id) { FLW.sel = { n: id }; fcMark(svg, s); } };
      const off = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', cx); }, cx = () => { off(); FLW.drag = null; fcRe(); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', cx); return;
    }
    if (ed) { FLW.sel = { e: ed.dataset.e }; fcMark(svg, s); return; }
    if (FLW.link || FLW.sel) { FLW.link = null; FLW.sel = null; fcMark(svg, s); }
  };
}
// tandai pilihan tanpa menggambar ulang bagan (agar klik dua kali tetap terbaca)
function fcMark(svg, s) {
  const o = FLW.sel || {}; $$('.nd', svg).forEach(n => n.classList.toggle('on', n.dataset.n === o.n)); $$('.nd.lk', svg).forEach(n => n.classList.remove('lk'));
  $$('.ed', svg).forEach(n => { const on = n.dataset.e === o.e; n.classList.toggle('on', on); $('.ln', n).setAttribute('marker-end', 'url(#' + (on ? 'fcb' : 'fca') + ')'); });
  const bar0 = svg.closest('.fccard').querySelector('.fcbar'); if (bar0) { const t = document.createElement('div'); t.innerHTML = fcBar(FLW.ed.d, s); bar0.replaceWith(t.firstChild); $$('[data-ed]', svg.closest('.fccard')).forEach(b => b.onclick = () => fcAct(b.dataset.ed, s)); }
}
document.addEventListener('keydown', e => {
  if (APP.route !== 'flow' || MODALS.length || (e.target.matches && e.target.matches('input,textarea,select'))) return;
  if (e.key === 'Escape') { if (FLW.link) { FLW.link = null; fcRe(); } else if (FLW.full) { FLW.full = false; fcFullSet(); fcRe(); } return; }
  if (!FLW.ed) return;
  const s = stateOf('flow', {}), m = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  if (m && k === 'z') { e.preventDefault(); fcAct(e.shiftKey ? 'redo' : 'undo', s); }
  else if (m && k === 'y') { e.preventDefault(); fcAct('redo', s); }
  else if (m && k === 's') { e.preventDefault(); if (fcDirty()) fcSaveAsk(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && FLW.sel) { e.preventDefault(); fcAct('del', s); }
});
addEventListener('beforeunload', e => { if (fcDirty()) { lsSet(FC_DK(), { id: FLW.ed.id, d: FLW.ed.d, base: FLW.ed.base, at: FLW.ed.at, baru: FLW.ed.baru }); e.preventDefault(); e.returnValue = ''; } });
addEventListener('hashchange', () => { if (FLW.full) { FLW.full = false; fcFullSet(); } });
addEventListener('resize', debounce(() => { if (APP.route === 'flow') { const r = $('.fcroot'); if (r) fcZoom(r, stateOf('flow', {})); } }, 150));

/* ---------- PDF ---------- */
const fcRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function fcReportAsk(s) {
  const l = fcList(); if (!l.length) { toast('Flow chart belum termuat', 'err'); return; }
  openForm({ title: 'Cetak PDF', sub: 'Flow Chart SOP PT. Armada Hada Graha', small: true, saveLabel: 'Buat PDF', value: { f: fcCur(s).id, k: 'a4', p: true },
    fields: [{ k: 'f', label: 'Alur', type: 'select', empty: false, opts: l.map(f => ({ v: f.id, t: f.kode + ' ' + f.judul })).concat([{ v: '*', t: 'Semua alur' }]) }, { k: 'k', label: 'Ukuran kertas', type: 'seg', opts: [{ v: 'a4', t: 'A4' }, { v: 'a3', t: 'A3' }] }, { k: 'p', type: 'check', text: 'Sertakan tabel prosedur langkah' }],
    onSave: v => { setTimeout(() => runReport(() => fcReport(v.f === '*' ? l : l.filter(f => f.id === v.f), v)), 280); } });
}
async function fcReport(list, o) {
  const one = list.length === 1;
  const R = await pdfReport({ title: one ? 'Flow Chart ' + list[0].judul : 'Flow Chart SOP', sub: one ? list[0].kode + ' · Revisi ' + String(+list[0].rev || 0).padStart(2, '0') + ' · ' + tgl(list[0].revTgl, true) : 'Panduan SOP ' + PT, orient: 'l', format: o.k, fname: one ? 'Flow_Chart_' + list[0].judul : 'Flow_Chart_SOP' });
  list.forEach((f, i) => {
    if (i) { R.doc.addPage(); R.y = 36; }
    if (!one) R.h2(f.kode + '  Flow Chart ' + f.judul, 'Revisi ' + String(+f.rev || 0).padStart(2, '0') + ' · ' + tgl(f.revTgl, true));
    fcPdfDraw(R, f);
    if (o.p) {
      R.doc.addPage(); R.y = 38; R.h2('Prosedur Langkah ' + f.judul, f.kode);
      R.table(['No', 'Langkah', 'Departemen', 'Penanggung Jawab', 'Uraian', 'Dokumen / Keluaran', 'Langkah Berikutnya'], f.nodes.map((n, k) => [{ content: k + 1, styles: center }, n.t, fcDep(n.dep).t, n.pic || '-', n.u || '-', n.o || '-', fcNextTxt(f, n.id).join('\n') || 'Selesai']), { fs: o.k === 'a3' ? 9 : 7.6, cs: { 0: { cellWidth: o.k === 'a3' ? 14 : 10 } } });
      if (f.ket) R.para(f.ket);
    }
  });
  if (o.p) R.sign([['Dibuat oleh', S.user ? S.user.name : ''], ['Diperiksa oleh', ''], ['Disetujui oleh', '']]);
  await R.save();
}
function fcPdfDraw(R, f) {
  const d = R.doc, g = fcGeom(f, 0), top = R.y, av = R.H - 24 - top, aw = R.W - 2 * R.M, k = Math.min(aw / g.W, av / g.H), x0 = R.M + (aw - g.W * k) / 2, y0 = top;
  const X = x => x0 + x * k, Y = y => y0 + y * k, pt = px => px * k * 72 / 25.4;
  const txt = (t, x, y, px, st, col) => { d.setFont('helvetica', st); d.setFontSize(pt(px)); d.setTextColor(...col); d.text(pdfClean(t), X(x), Y(y), { align: 'center' }); };
  g.kol.forEach((b, i) => { d.setFillColor(...(i % 2 ? [250, 251, 253] : [244, 247, 251])); d.setDrawColor(...LINE); d.setLineWidth(0.15); d.roundedRect(X(b.x + 3), Y(FLN.pad), (b.w - 6) * k, (g.H - 2 * FLN.pad) * k, 10 * k, 10 * k, 'FD'); if (b.t) { d.setFillColor(...NAVY); d.roundedRect(X(b.x + 3), Y(FLN.pad), (b.w - 6) * k, FLN.head * k, 8 * k, 8 * k, 'F'); txt(fcWrap(b.t, b.w - 18, '600 12.5px Arial', 1)[0] || '', b.x + b.w / 2, FLN.pad + FLN.head / 2 + 4.4, 12, 'bold', [255, 255, 255]); } });
  g.edges.forEach(({ p }) => {
    d.setDrawColor(74, 90, 112); d.setLineWidth(Math.max(0.18, 1.5 * k)); d.setLineJoin('round');
    const L = p[p.length - 1], q = p[p.length - 2], ux = Math.sign(L[0] - q[0]), uy = Math.sign(L[1] - q[1]);
    for (let i = 1; i < p.length; i++) { const b = i === p.length - 1 ? [L[0] - ux * 6, L[1] - uy * 6] : p[i]; d.line(X(p[i - 1][0]), Y(p[i - 1][1]), X(b[0]), Y(b[1])); }
    d.setFillColor(74, 90, 112); d.triangle(X(L[0]), Y(L[1]), X(L[0] - ux * 9 - uy * 4.6), Y(L[1] - uy * 9 - ux * 4.6), X(L[0] - ux * 9 + uy * 4.6), Y(L[1] - uy * 9 + ux * 4.6), 'F');
  });
  f.nodes.forEach((n, i) => {
    const b = g.by[n.id], dp = fcDep(n.dep), col = fcRgb(dp.c), soft = fcRgb(dp.s), pill = n.sh === 'kas' || n.sh === 'awal', w = b.w * k, h = b.h * k;
    d.setDrawColor(...col); d.setLineWidth(Math.max(0.2, 1.4 * k)); d.setFillColor(...(n.sh === 'kas' ? col : pill ? [255, 255, 255] : soft));
    if (pill) d.roundedRect(X(b.x), Y(b.y), w, h, h / 2, h / 2, 'FD');
    else if (n.sh === 'putusan') d.lines([[w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2], [w / 2, -h / 2]], X(b.cx), Y(b.y), [1, 1], 'FD', true);
    else if (n.sh === 'stok') { const e = 7 * k; d.rect(X(b.x), Y(b.y) + e, w, h - 2 * e, 'F'); d.ellipse(X(b.cx), Y(b.y + b.h) - e, w / 2, e, 'FD'); d.setFillColor(...soft); d.rect(X(b.x) + 0.2 * k, Y(b.y) + e, w - 0.4 * k, h - 2 * e - e * 0.02, 'F'); d.line(X(b.x), Y(b.y) + e, X(b.x), Y(b.y + b.h) - e); d.line(X(b.x + b.w), Y(b.y) + e, X(b.x + b.w), Y(b.y + b.h) - e); d.ellipse(X(b.cx), Y(b.y) + e, w / 2, e, 'FD'); }
    else if (n.sh === 'dok') d.lines([[w, 0], [0, h - 5 * k], [-w * .22, -11 * k, -w * .33, -8 * k, -w / 2, 0], [-w * .22, 8 * k, -w * .28, 9 * k, -w / 2, 0], [0, -(h - 5 * k)]], X(b.x), Y(b.y), [1, 1], 'FD', true);
    else { d.roundedRect(X(b.x), Y(b.y), w, h, 8 * k, 8 * k, 'FD'); d.setFillColor(...col); d.roundedRect(X(b.x), Y(b.y), 7 * k, h, 3 * k, 3 * k, 'F'); }
    const dm = n.sh === 'putusan', mw = dm ? b.w * .56 : pill ? b.w - 34 : b.w - 30, a = fcWrap(n.t, mw, '700 12.5px Arial', 2), p = dm ? [] : fcWrap(n.pic, mw, '400 11px Arial', Math.min(2, 4 - a.length));
    let y = b.cy - (a.length * 14.5 + p.length * 13) / 2 + 11 + (n.sh === 'stok' ? 5 : n.sh === 'dok' ? -3 : 0); const w1 = n.sh === 'kas' ? [255, 255, 255] : INK, w2 = n.sh === 'kas' ? [232, 240, 250] : [60, 72, 89];
    a.forEach(t => { txt(t, b.cx, y, 12.5, 'bold', w1); y += 14.5; }); p.forEach(t => { txt(t, b.cx, y, 11, 'normal', w2); y += 13; });
    const bx = b.x + fcBx(n), by = b.y + fcBy(n); d.setFillColor(...col); d.setDrawColor(255, 255, 255); d.setLineWidth(1.4 * k); d.circle(X(bx), Y(by), 9.5 * k, 'FD'); txt(String(i + 1), bx, by + 3.6, 9.5, 'bold', [255, 255, 255]);
  });
  g.edges.forEach(({ e, lx, ly }) => { if (!e.t) return; const w = Math.max(30, e.t.length * 6.6 + 12); d.setFillColor(255, 255, 255); d.setDrawColor(74, 90, 112); d.setLineWidth(1 * k); d.roundedRect(X(lx - w / 2), Y(ly - 9), w * k, 18 * k, 9 * k, 9 * k, 'FD'); txt(e.t, lx, ly + 3.8, 10.5, 'bold', INK); });
  // keterangan warna
  let x = R.M; const yl = R.H - 15.5; const used = [...new Set(f.nodes.map(n => n.dep))];
  d.setFont('helvetica', 'normal'); d.setFontSize(7.6);
  Object.keys(FC_DEP).filter(z => used.includes(z)).forEach(z => { d.setFillColor(...fcRgb(FC_DEP[z].c)); d.roundedRect(x, yl - 2.4, 3.2, 3.2, 0.6, 0.6, 'F'); d.setTextColor(...INK); d.text(FC_DEP[z].t, x + 4.6, yl); x += 4.6 + d.getTextWidth(FC_DEP[z].t) + 7; });
  R.y = y0 + g.H * k + 4;
}
if (typeof CFG !== 'undefined' && CFG.all) S.listeners.add(() => fcRe());
