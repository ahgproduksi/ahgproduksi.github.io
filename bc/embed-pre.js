/* ahgproduksi.github.io/bc/ — Kartu Operasional per basecamp (kode modul = situs Basecamp Bawen, deploy-ahgbawen/js).
   Dimuat SEBELUM core.js: mengisi window.BC_CFG → mode tertanam, akun Virtual Work AHG, data per basecamp (fungsi bc_*). */
'use strict';
(function () {
  const q = new URLSearchParams(location.search);
  const bc = (q.get('bc') || '').trim() || 'Bawen';
  let sess = null;
  try { sess = JSON.parse(localStorage.getItem('ahg.session') || sessionStorage.getItem('ahg.session') || 'null'); } catch { }
  const P = (() => { try { return window.parent !== window && window.parent.AHG_BC ? window.parent.AHG_BC : null; } catch { return null; } })();
  // kode penomoran: huruf depan + 2 konsonan berikutnya (Bawen → BWN, Tempuran → TMP, Jogoresan → JGR, Bugel-Klontong → BGL)
  const code = bc === '*' ? 'ALL' : (() => {
    const w = bc.normalize('NFKD').replace(/[^A-Za-z]/g, '').toUpperCase();
    const c = w.slice(1).replace(/[AEIOU]/g, '');
    return (w[0] + c + w.slice(1)).slice(0, 3) || 'BC';
  })();
  const MAP = { bw_sync: 'bc_sync', bw_put: 'bc_put', bw_me: 'bc_me', bw_gaji_get: 'bc_gaji_get', bw_gaji_set: 'bc_gaji_set', bw_edit_unlock: 'bc_edit_unlock' };
  window.BC_CFG = {
    name: bc === '*' ? 'Semua' : bc, all: bc === '*', code, embed: true, ls: 'ahgbc.' + bc + '.', token: sess && sess.token || '', sess, parent: P,
    rpc(fn, a, raw) {
      const f = MAP[fn];
      if (!f) return Promise.resolve({ err: 'embed' });
      a = Object.assign({}, a);
      if (f !== 'bc_me' && f !== 'bc_edit_unlock') a.p_bc = a.p_bc || BC_CFG.name;
      return raw(f, a);
    },
    authLost() { if (P && P.authLost) P.authLost(); else location.replace('/'); },
    logout() { if (P && P.logout) P.logout(); },
    onRoute(r, title) { if (P && P.onRoute) P.onRoute(bc, r, title); }
  };
})();
