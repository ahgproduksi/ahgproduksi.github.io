/* Komposisi Jobmix — Jobmix CMP (Job Mix Design readymix per 1 M3, 5 zona gradasi pasir) dan Jobmix SCP
   (komposisi batu bahan baku + fraksi hasil produksi per jenis batu: Batu Bantak, Batu Andesit, Batu Blondos, dengan berat jenis).
   Acuan: sheet RAPU-BUASO / Price List tab "Jobmix Formula" (bagian A, B, E, F) + Master Bahan.
   Disimpan per basecamp sebagai kind 'param' (dikunci kata sandi edit, dicek server): prmJmdCMP01, prmFraksiSCP01.
   Bila dokumen ada, koefisien semen/split/pasir/retarder produk CMP dan koefisien batu produk SCP ikut dipakai HPP, Price List, SO. */
'use strict';
const JMD_ID = 'prmJmdCMP01', FRK_ID = 'prmFraksiSCP01';
/* [mutu, fc MPa, semen kg [zona1..5], split 10/20 kg, split 20/30 kg, pasir kg, retarder liter] — sheet Jobmix Formula bagian E */
const JMD_DEF = [["B-0",0,[90,110,130,150,150],[278.4716943,276.230293,273.9888917,271.7474904,271.7474904],[649.7672866,644.5373503,639.307414,634.0774777,634.0774777],[1145.223745,1136.005911,1126.788076,1117.570242,1117.570242],[0.315,0.385,0.455,0.525,0.525]],["K-100",8,[190,210,230,250,250],[296.3151975,293.8301656,291.3451338,288.8601019,288.8601019],[691.4021274,685.6037197,679.8053121,674.0069045,674.0069045],[997.3628535,988.9985223,980.6341911,972.2698599,972.2698599],[0.665,0.735,0.805,0.875,0.875]],["K-125",10,[200,220,240,260,260],[295.0726815,292.5876497,290.1026178,287.617586,287.617586],[688.5029236,682.7045159,676.9061083,671.1077006,671.1077006],[993.1806879,984.8163567,976.4520255,968.0876943,968.0876943],[0.7,0.77,0.84,0.91,0.91]],["K-150",12,[210,230,250,270,270],[293.8301656,291.3451338,288.8601019,286.3750701,286.3750701],[685.6037197,679.8053121,674.0069045,668.2084968,668.2084968],[988.9985223,980.6341911,972.2698599,963.9055287,963.9055287],[0.735,0.805,0.875,0.945,0.945]],["K-175",15,[220,240,260,280,280],[292.5876497,290.1026178,287.617586,285.1325541,285.1325541],[682.7045159,676.9061083,671.1077006,665.309293,665.309293],[984.8163567,976.4520255,968.0876943,959.7233631,959.7233631],[0.77,0.84,0.91,0.98,0.98]],["K-200",17,[230,250,270,290,290],[291.3451338,288.8601019,286.3750701,283.8900382,283.8900382],[679.8053121,674.0069045,668.2084968,662.4100892,662.4100892],[980.6341911,972.2698599,963.9055287,955.5411975,955.5411975],[0.805,0.875,0.945,1.015,1.015]],["K-225",19,[250,270,290,310,310],[300.187949,297.605465,295.0229809,292.4404968,292.4404968],[700.4385478,694.4127516,688.3869554,682.3611592,682.3611592],[932.5853758,924.5624459,916.5395159,908.516586,908.516586],[0.875,0.945,1.015,1.085,1.085]],["K-250",21,[280,300,320,340,340],[296.3142229,293.7317389,291.1492548,288.5667707,288.5667707],[691.3998535,685.3740573,679.3482611,673.322465,673.322465],[920.5509809,912.528051,904.505121,896.4821911,896.4821911],[0.98,1.05,1.12,1.19,1.19]],["K-275",23,[295,315,335,355,355],[294.3773599,291.7948758,289.2123917,286.6299076,286.6299076],[686.8805064,680.8547102,674.828914,668.8031178,668.8031178],[914.5337834,906.5108535,898.4879236,890.4649936,890.4649936],[1.0325,1.1025,1.1725,1.2425,1.2425]],["K-300",25,[330,350,370,390,390],[295.3270318,292.6958217,290.0646115,287.4334013,287.4334013],[689.0964076,682.9569172,676.8174268,670.6779363,670.6779363],[881.3342166,873.4819873,865.629758,857.7775287,857.7775287],[1.155,1.225,1.295,1.365,1.365]],["K-325",27,[350,370,390,410,410],[292.6958217,290.0646115,287.4334013,284.8021911,284.8021911],[682.9569172,676.8174268,670.6779363,664.5384459,664.5384459],[873.4819873,865.629758,857.7775287,849.9252994,849.9252994],[1.225,1.295,1.365,1.435,1.435]],["K-350",29,[380,400,420,440,440],[288.7490064,286.1177962,283.486586,280.8553758,280.8553758],[673.7476815,667.6081911,661.4687006,655.3292102,655.3292102],[861.7036433,853.851414,845.9991847,838.1469554,838.1469554],[1.33,1.4,1.47,1.54,1.54]],["K-375",31,[400,420,440,460,460],[286.1177962,283.486586,280.8553758,278.2241656,278.2241656],[667.6081911,661.4687006,655.3292102,649.1897197,649.1897197],[853.851414,845.9991847,838.1469554,830.2947261,830.2947261],[1.4,1.47,1.54,1.61,1.61]],["K-400",33,[430,450,470,490,490],[282.1709809,279.5397707,276.9085605,274.2773503,274.2773503],[658.3989554,652.259465,646.1199745,639.9804841,639.9804841],[842.0730701,834.2208408,826.3686115,818.5163822,818.5163822],[1.505,1.575,1.645,1.715,1.715]],["K-425",35,[445,465,485,505,505],[280.1975732,277.5663631,274.9351529,272.3039427,272.3039427],[653.7943376,647.6548471,641.5153567,635.3758662,635.3758662],[836.1838981,828.3316688,820.4794395,812.6272102,812.6272102],[1.5575,1.6275,1.6975,1.7675,1.7675]],["K-450",37,[460,480,500,520,520],[278.2241656,275.5929554,272.9617452,270.330535,270.330535],[649.1897197,643.0502293,636.9107389,630.7712484,630.7712484],[830.2947261,822.4424968,814.5902675,806.7380382,806.7380382],[1.61,1.68,1.75,1.82,1.82]],["K-475",39,[480,500,520,540,540],[285.8001019,283.0714395,280.3427771,277.6141146,277.6141146],[666.8669045,660.5000255,654.1331465,647.7662675,647.7662675],[786.6841274,779.1732994,771.6624713,764.1516433,764.1516433],[1.68,1.75,1.82,1.89,1.89]],["K-500",42,[495,515,535,555,555],[283.7536051,281.0249427,278.2962803,275.5676178,275.5676178],[662.0917452,655.7248662,649.3579873,642.9911083,642.9911083],[781.0510064,773.5401783,766.0293503,758.5185223,758.5185223],[1.7325,1.8025,1.8725,1.9425,1.9425]],["FS-45",29,[440,460,480,500,500],[301.9674268,299.2387643,296.5101019,293.7814395,293.7814395],[704.5906624,698.2237834,691.8569045,685.4900255,685.4900255],[831.1857834,823.6749554,816.1641274,808.6532994,808.6532994],[1.54,1.61,1.68,1.75,1.75]],["FS-47",30,[450,470,490,510,510],[300.6030955,297.8744331,295.1457707,292.4171083,292.4171083],[701.4072229,695.0403439,688.673465,682.306586,682.306586],[827.4303694,819.9195414,812.4087134,804.8978854,804.8978854],[1.575,1.645,1.715,1.785,1.785]],["MORTAR 1:5",null,[355,375,395,415,435],[0,0,0,0,0],[0,0,0,0,0],[1894.6063694,1877.5363057,1860.466242,1843.3961783,1826.3261146],[1.2425,1.3125,1.3825,1.4525,1.5225]]];
/* berat jenis lepas (Ton/M3): split & pasir = dasar konversi kg → M3 di rincian BUASO sheet (1,35 & 1,45); semen = perkiraan (informasi volume) */
const JMD_BJ = { s1: 1.35, s2: 1.35, pasir: 1.45, semen: 1.25 };
const JMD_COL = [['semen', 'Semen Curah', 'Semen'], ['s1', 'Split 1/2', 'Split 10/20'], ['s2', 'Split 2/3', 'Split 20/30'], ['pasir', 'Pasir Beton', 'Pasir'], ['ret', 'Retarder (Type D)', 'Retarder']];
const jmClone = o => JSON.parse(JSON.stringify(o));
const jmN = v => { const n = +v; return isFinite(n) ? n : 0; };
function jmdDefZone(z) { const i = Math.min(4, Math.max(0, (+z || 1) - 1)); return JMD_DEF.map(r => ({ m: r[0], fc: r[1], semen: r[2][i], s1: r[3][i], s2: r[4][i], pasir: r[5][i], ret: r[6][i] })); }
function jmdDoc() { return get(JMD_ID); }
function jmdData() {
  const d = jmdDoc() || {};
  const zona = String(d.zona || 1), bj = Object.assign({}, JMD_BJ, d.bj || {});
  const zone = z => (d.z && Array.isArray(d.z[z]) && d.z[z].length ? d.z[z] : jmdDefZone(z)).map(r => Object.assign({}, r));
  return { doc: d.id ? d : null, zona, bj, zone, rows: zone(zona) };
}
const jmdKg = r => jmN(r.semen) + jmN(r.s1) + jmN(r.s2) + jmN(r.pasir);
const jmdM3 = (kg, bj) => bj ? jmN(kg) / 1000 / bj : 0;

/* SCP: urutan jenis batu tetap, nama = nama material di Master Bahan */
const FRK_BATU = ['Batu Bantak', 'Batu Andesit', 'Batu Blondos'];
const FRK_SH = ['Bantak', 'Andesit', 'Blondos'];
/* default: komposisi & rata-rata fraksi = sheet (A: Bantak 50% + Andesit 50%; B: hasil campuran 19,14/23,49/21,45/18,22/8,87/8,83 %).
   Rincian per jenis batu = perkiraan awal (Bantak lebih lunak → lebih banyak abu/pasir/ladu, Andesit & Blondos keras → lebih banyak split),
   disusun agar rata-rata Bantak+Andesit tepat sama dengan sheet. Sesuaikan dengan hasil uji / timbangan di lapangan. */
const FRK_DEF = {
  komp: [50, 50, 0],
  bjBatu: [1.5, 1.6, 1.65],
  fr: [
    { n: 'Split 1/1', p: [17.28, 21, 20], bj: [1.312, 1.382, 1.4] },
    { n: 'Split 1/2', p: [21.98, 25, 26], bj: [1.349, 1.419, 1.44] },
    { n: 'Split 2/3', p: [19.9, 23, 25], bj: [1.399, 1.469, 1.49] },
    { n: 'Abu Batu', p: [20.44, 16, 15], bj: [1.515, 1.585, 1.6] },
    { n: 'Pasir (Hasil SCP)', p: [9.74, 8, 10], bj: [1.465, 1.535, 1.55] },
    { n: 'Ladu / Ondol', p: [10.66, 7, 4], bj: [1.315, 1.385, 1.4] }
  ]
};
function frkDoc() { return get(FRK_ID); }
function frkData() {
  const d = frkDoc() || {};
  const a3 = (x, def) => [0, 1, 2].map(i => Array.isArray(x) && x[i] !== undefined && x[i] !== '' ? jmN(x[i]) : def[i]);
  const fr = (Array.isArray(d.fr) && d.fr.length ? d.fr : FRK_DEF.fr).map(f => ({ n: f.n, p: a3(f.p, [0, 0, 0]), bj: a3(f.bj, [0, 0, 0]) }));
  return { doc: d.id ? d : null, komp: a3(d.komp, FRK_DEF.komp), bjBatu: a3(d.bjBatu, FRK_DEF.bjBatu), fr };
}
/* hasil campuran: ton fraksi = Σ ton batu_i × %_i ; BJ campuran = ton / Σ (ton_i / BJ_i) */
function frkMix(F, ton) {
  ton = ton || F.komp;
  const tot = ton.reduce((a, b) => a + jmN(b), 0);
  const rows = F.fr.map(f => {
    let t = 0, v = 0;
    [0, 1, 2].forEach(i => { const x = jmN(ton[i]) * jmN(f.p[i]) / 100; t += x; if (f.bj[i]) v += x / f.bj[i]; });
    return { n: f.n, ton: t, m3: v, p: tot ? t / tot : 0, bj: v ? t / v : 0 };
  });
  return { tot, rows, out: rows.reduce((a, r) => a + r.ton, 0), m3: rows.reduce((a, r) => a + r.m3, 0) };
}
const frkTot = (F, i) => F.fr.reduce((a, f) => a + jmN(f.p[i]), 0);

/* dipanggil dari products() (js/data.js) untuk produk acuan yang tidak diubah satu per satu */
function jobmixApply(u, p) {
  if (u === 'CMP') {
    if (!jmdDoc()) return;
    const J = jmdData(), r = J.rows.find(x => String(x.m).toLowerCase() === String(p.n).toLowerCase());
    if (!r) return;
    JMD_COL.forEach(([k, nama]) => {
      const val = jmN(r[k]);
      let l = p.b.find(x => String(x[0]).toLowerCase() === nama.toLowerCase());
      if (!l) { if (!val) return; const mi = minfo(nama); l = [nama, 'B', k === 'ret' ? 'Liter' : k === 'semen' ? 'Kg' : 'M3', 0, mi ? mi.harga : 0]; p.b.splice(p.b.filter(x => x[1] === 'B').length, 0, l); }
      const sat = String(l[2]).toLowerCase(), bj = k === 's1' ? J.bj.s1 : k === 's2' ? J.bj.s2 : k === 'pasir' ? J.bj.pasir : J.bj.semen;
      l[3] = k === 'ret' ? val : sat === 'kg' ? val : sat === 'ton' ? val / 1000 : sat === 'm3' ? jmdM3(val, bj) : val;
    });
    p.jmd = true;
  } else if (u === 'SCP') {
    if (!frkDoc() || !p.b.some(l => FRK_BATU.includes(l[0]))) return;
    const F = frkData();
    FRK_BATU.forEach((nama, i) => {
      const val = jmN(F.komp[i]) / 100;
      let l = p.b.find(x => x[0] === nama);
      if (!l) { if (!val) return; const mi = minfo(nama); l = [nama, 'B', 'Ton', 0, mi ? mi.harga : 0]; p.b.splice(p.b.filter(x => FRK_BATU.includes(x[0])).length, 0, l); }
      l[3] = val;
    });
    p.jmd = true;
  }
}

/* ---------- tampilan (tab Komposisi Jobmix di Kartu Produksi) ---------- */
const JM_VIEWS = [{ k: 'prod', t: 'Produk & BUASO' }, { k: 'cmp', t: 'Jobmix CMP' }, { k: 'scp', t: 'Jobmix SCP' }];
const jmSeg = s => '<div class="fbar jmseg"><div class="seg" data-jv>' + JM_VIEWS.map(v => '<button type="button" class="' + ((s.jv || 'prod') === v.k ? 'on' : '') + '" data-v="' + v.k + '">' + esc(v.t) + '</button>').join('') + '</div></div>';
const jmWho = d => d ? 'Diubah ' + esc(d._by || '-') + ' · ' + esc(tglJam(d._at)) : 'Acuan sheet RAPU-BUASO (belum diubah)';
const n4 = v => num4(v), sm = t => '<small class="muted">' + t + '</small>';
function jmHead(title, u, d, kind) {
  return '<div class="chead"><div>' + unitChip(u) + '<h3>' + esc(title) + '</h3></div><div class="jmbtn">' +
    '<span class="cmeta">' + jmWho(d) + '</span>' +
    (kind === 'scp' ? '<button class="btn ghost sm" data-jmcalc>' + ic('scale') + 'Hitung hasil produksi</button>' : '') +
    (d ? '<button class="btn ghost sm" data-jmreset="' + kind + '">' + ic('refresh') + 'Kembalikan ke acuan</button>' : '') +
    '<button class="btn pri sm" data-jmedit="' + kind + '">' + ic('edit') + 'Ubah angka</button></div></div>';
}
function jmdHtml(s) {
  const J = jmdData(), z = String(s.jz || J.zona), rows = J.zone(z);
  const hp = m => { try { const c = typeof hppCalc === 'function' && productFind('CMP', m) ? hppCalc('CMP', m) : null; return c ? rp(c.hpp) : '-'; } catch { return '-'; } };
  const kgm = (kg, bj) => '<b>' + num(kg) + '</b><br>' + sm(n4(jmdM3(kg, bj)) + ' m³');
  return '<div class="note">Job Mix Design readymix per 1 M3 beton (sheet Jobmix Formula bagian E/F). Zona gradasi pasir yang <b>dipakai HPP</b> = Zona ' + esc(J.zona) +
    '. Split 10/20 = material Split 1/2, Split 20/30 = Split 2/3 (hasil SCP). Kebutuhan M3 = kg ÷ 1.000 ÷ berat jenis lepas. Setelah diubah, HPP, Price List, dan SO baru CMP langsung memakai angka ini.</div>' +
    '<div class="kpis">' + kpi('Zona dipakai HPP', 'Zona ' + esc(J.zona), 'gradasi pasir 1 - 5') + kpi('BJ Split 10/20 · 20/30', num(J.bj.s1) + ' · ' + num(J.bj.s2), 'Ton/M3 lepas') + kpi('BJ Pasir', num(J.bj.pasir), 'Ton/M3 lepas') + kpi('BJ Semen', num(J.bj.semen), 'Ton/M3 lepas (informasi)') + '</div>' +
    '<section class="card">' + jmHead('Jobmix CMP — Job Mix Design per 1 M3', 'CMP', J.doc, 'cmp') +
    '<div class="fbar"><span class="muted">Lihat zona</span><div class="seg" data-jz>' + [1, 2, 3, 4, 5].map(i => '<button type="button" class="' + (z === String(i) ? 'on' : '') + '" data-v="' + i + '">Zona ' + i + (String(i) === J.zona ? ' (dipakai)' : '') + '</button>').join('') + '</div></div>' +
    table([{ t: 'No', f: r => r.no, cls: 'c' }, { t: 'Mutu Beton', f: r => '<b>' + esc(r.m) + '</b>', raw: true }, { t: 'fc (MPa)', f: r => r.fc == null || r.fc === '' ? '-' : num(r.fc), num: true },
    { t: 'Semen (Kg)', f: r => '<b>' + num(r.semen) + '</b><br>' + sm(num(jmN(r.semen) / 50) + ' zak'), num: true, raw: true },
    { t: 'Split 10/20 (Kg)', f: r => kgm(r.s1, J.bj.s1), num: true, raw: true }, { t: 'Split 20/30 (Kg)', f: r => kgm(r.s2, J.bj.s2), num: true, raw: true },
    { t: 'Pasir (Kg)', f: r => kgm(r.pasir, J.bj.pasir), num: true, raw: true }, { t: 'Retarder (Liter)', f: r => n4(r.ret), num: true },
    { t: 'Total Berat (Kg)', f: r => num(jmdKg(r)), num: true }, { t: 'HPP + Bunga / M3', f: r => z === J.zona ? hp(r.m) : sm('zona tidak dipakai'), num: true, raw: true }],
      rows.map((r, i) => Object.assign({ no: i + 1, id: r.m }, r)), { empty: 'Belum ada mutu beton.' }) + '</section>';
}
function frkHtml(s) {
  const F = frkData(), M = frkMix(F), K = F.komp;
  const price = n => { const lp = latestPrice(n); const mi = minfo(n); return lp ? lp.harga : mi ? mi.harga : 0; };
  const bahan = FRK_BATU.reduce((a, n, i) => a + jmN(K[i]) / 100 * price(n), 0);
  const tot = [0, 1, 2].map(i => frkTot(F, i)), ok = t => Math.abs(t - 100) < 0.01;
  const cell = (f, i) => '<b>' + num(f.p[i]) + '%</b><br>' + sm('BJ ' + n4(f.bj[i]));
  const hasil = F.fr.map((f, j) => ({ f, mix: M.rows[j] }));
  return '<div class="note">Dari 1 ton batu yang masuk crusher dihasilkan beberapa fraksi (abu batu, pasir, split 1/1, split 1/2, split 2/3, ladu). Persentase hasil per jenis batu dan berat jenis lepas (Ton/M3) bisa diubah. ' +
    'Komposisi bahan baku dipakai rincian BUASO produk SCP (1 ton batu = 1 ton produk, sesuai sheet); kolom campuran = hasil rata-rata sesuai komposisi.</div>' +
    '<section class="card">' + jmHead('Jobmix SCP — Komposisi Bahan Baku per 1 Ton Produk', 'SCP', F.doc, 'scp') +
    table([{ t: 'No', f: r => r.no, cls: 'c' }, { t: 'Bahan Baku', f: r => '<b>' + esc(r.n) + '</b>', raw: true }, { t: 'Komposisi (% berat)', f: r => pct(r.k / 100), num: true },
    { t: 'Berat Jenis (Ton/M3 lepas)', f: r => n4(r.bj), num: true }, { t: '1 Ton batu = M3', f: r => r.bj ? n4(1 / r.bj) : '-', num: true }, { t: 'Harga / Ton', f: r => rp(r.h), num: true }, { t: 'Biaya bahan / Ton produk', f: r => rp(r.k / 100 * r.h), num: true }],
      FRK_BATU.map((n, i) => ({ id: n, no: i + 1, n, k: jmN(K[i]), bj: F.bjBatu[i], h: price(n) })), {}) +
    '<div class="jmfoot"><span>Total komposisi <b class="' + (ok(K.reduce((a, b) => a + jmN(b), 0)) ? 'okt' : 'badt') + '">' + pct(K.reduce((a, b) => a + jmN(b), 0) / 100) + '</b></span><span>Biaya bahan (B) per ton produk <b>' + rp(bahan) + '</b></span></div></section>' +
    '<section class="card"><div class="chead"><div>' + unitChip('SCP') + '<h3>Fraksi Hasil Produksi per Jenis Batu</h3></div><div class="cmeta">% berat dari 1 ton batu · BJ = berat jenis lepas Ton/M3</div></div>' +
    '<div class="tbl"><table class="jmfr"><thead><tr><th>No</th><th>Fraksi Hasil</th>' + FRK_SH.map((n, i) => '<th class="n">Batu ' + n + '</th>').join('') + '<th class="n">Campuran (' + FRK_SH.map((n, i) => num(K[i]) + '%').join(' / ') + ')</th><th class="n">1 Ton campuran → Ton</th><th class="n">→ M3</th></tr></thead><tbody>' +
    hasil.map(({ f, mix }, j) => '<tr><td class="c">' + (j + 1) + '</td><td><b>' + esc(f.n) + '</b></td>' + [0, 1, 2].map(i => '<td class="n">' + cell(f, i) + '</td>').join('') +
      '<td class="n"><b>' + pct(mix.p) + '</b><br>' + sm('BJ ' + n4(mix.bj)) + '</td><td class="n">' + n4(M.tot ? mix.ton / M.tot : 0) + '</td><td class="n">' + n4(M.tot ? mix.m3 / M.tot : 0) + '</td></tr>').join('') +
    '</tbody><tfoot><tr><td></td><td>Total</td>' + tot.map(t => '<td class="n ' + (ok(t) ? 'okt' : 'badt') + '">' + num(t) + '%' + (ok(t) ? '' : '<br><small>harus 100%</small>') + '</td>').join('') +
    '<td class="n">' + pct(M.tot ? M.out / M.tot : 0) + '</td><td class="n">' + n4(M.tot ? M.out / M.tot : 0) + '</td><td class="n">' + n4(M.tot ? M.m3 / M.tot : 0) + '</td></tr></tfoot></table></div>' +
    '<div class="note jmn">' + (F.doc ? 'Angka diubah oleh ' + esc(F.doc._by || '-') + '.' : 'Rata-rata campuran Bantak 50% + Andesit 50% = angka sheet (Jobmix Formula B). Rincian per jenis batu masih perkiraan awal — sesuaikan dengan hasil timbang/uji di basecamp lewat Ubah angka.') + ' Klik <b>Hitung hasil produksi</b> untuk menghitung hasil dari tonase batu tertentu.</div></section>';
}
function jobmixHtml(s) {
  const v = s.jv || 'prod';
  return jmSeg(s) + (v === 'cmp' ? jmdHtml(s) : v === 'scp' ? frkHtml(s) : jmfHtml(s));
}
function jobmixBind(el, s, fill) {
  $$('[data-jv] button', el).forEach(b => b.onclick = () => { s.jv = b.dataset.v; persist('prod'); fill(true); });
  $$('[data-jz] button', el).forEach(b => b.onclick = () => { s.jz = b.dataset.v; fill(); });
  $$('[data-jmedit]', el).forEach(b => b.onclick = () => b.dataset.jmedit === 'cmp' ? jmdForm(s) : frkForm());
  $$('[data-jmreset]', el).forEach(b => b.onclick = () => jmReset(b.dataset.jmreset));
  const c = $('[data-jmcalc]', el); if (c) c.onclick = () => frkCalc();
}
const jmReset = gated('Komposisi Jobmix', async kind => {
  const id = kind === 'cmp' ? JMD_ID : FRK_ID;
  if (!get(id)) return;
  if (!(await confirmBox('Kembalikan ke acuan', 'Angka Jobmix ' + kind.toUpperCase() + ' basecamp ini dikembalikan ke acuan sheet RAPU-BUASO. Lanjutkan?', 'Kembalikan', false))) return;
  remove(id); toast('Jobmix ' + kind.toUpperCase() + ' dikembalikan ke acuan sheet');
});

/* ---------- form ubah (wajib kata sandi edit) ---------- */
const jmdForm = gated('Komposisi Jobmix CMP', s => {
  const J = jmdData(), d = J.doc || {}, z = {};
  [1, 2, 3, 4, 5].forEach(i => z[i] = J.zone(String(i)));
  const v = { zona: J.zona, _cur: J.zona, z, rows: z[J.zona], bjs1: J.bj.s1, bjs2: J.bj.s2, bjp: J.bj.pasir, bjsm: J.bj.semen };
  const kgTot = r => num(jmdKg(r));
  openForm({
    title: 'Ubah Jobmix CMP', sub: 'Komposisi per 1 M3 beton. Pilih zona gradasi pasir yang dipakai, lalu ubah angka tiap mutu (zona lain tetap tersimpan).', wide: true, value: v,
    fields: [
      { k: 'zona', label: 'Zona gradasi pasir dipakai HPP', type: 'seg', full: true, opts: [1, 2, 3, 4, 5].map(i => ({ v: String(i), t: 'Zona ' + i })), onChange: x => { x.z[x._cur] = x.rows; x._cur = x.zona; x.rows = x.z[x.zona]; } },
      { k: 'bjs1', label: 'BJ Split 10/20 (Ton/M3)', type: 'num', third: true, req: true }, { k: 'bjs2', label: 'BJ Split 20/30 (Ton/M3)', type: 'num', third: true, req: true },
      { k: 'bjp', label: 'BJ Pasir (Ton/M3)', type: 'num', third: true, req: true }, { k: 'bjsm', label: 'BJ Semen (Ton/M3, informasi)', type: 'num', third: true },
      { k: 'rows', label: 'Komposisi per 1 M3 — zona yang dipilih', type: 'items', newRow: () => ({ m: '', fc: '', semen: '', s1: '', s2: '', pasir: '', ret: '' }), cols: [
        { k: 'm', label: 'Mutu', w: '15%' }, { k: 'fc', label: 'fc (MPa)', num: true }, { k: 'semen', label: 'Semen (Kg)', num: true }, { k: 's1', label: 'Split 10/20 (Kg)', num: true },
        { k: 's2', label: 'Split 20/30 (Kg)', num: true }, { k: 'pasir', label: 'Pasir (Kg)', num: true }, { k: 'ret', label: 'Retarder (L)', num: true }, { k: 'tot', label: 'Total (Kg)', type: 'ro', f: kgTot }] },
      { k: 'info', type: 'html', html: () => '<div class="note">Produk CMP dengan nama mutu yang sama (mis. K-300) langsung memakai angka ini untuk HPP. Mutu baru di sini tidak otomatis menjadi produk — tambahkan di Produk &amp; BUASO bila perlu.</div>' }
    ],
    onSave: x => {
      x.z[x._cur] = x.rows;
      const clean = a => (a || []).filter(r => String(r.m || '').trim()).map(r => ({ m: String(r.m).trim(), fc: r.fc === '' || r.fc == null ? null : jmN(r.fc), semen: jmN(r.semen), s1: jmN(r.s1), s2: jmN(r.s2), pasir: jmN(r.pasir), ret: jmN(r.ret) }));
      const zz = {}; Object.keys(x.z).forEach(k => zz[k] = clean(x.z[k]));
      if (!zz[x.zona].length) { toast('Isi minimal satu mutu beton', 'err'); return false; }
      if (!(jmN(x.bjs1) > 0 && jmN(x.bjs2) > 0 && jmN(x.bjp) > 0)) { toast('Berat jenis split dan pasir harus lebih dari 0', 'err'); return false; }
      save('param', { jmd: true, zona: x.zona, bj: { s1: jmN(x.bjs1), s2: jmN(x.bjs2), pasir: jmN(x.bjp), semen: jmN(x.bjsm) || JMD_BJ.semen }, z: zz }, JMD_ID);
      s.jz = x.zona; toast('Jobmix CMP tersimpan');
    }
  });
});
const frkForm = gated('Komposisi Jobmix SCP', () => {
  const F = frkData();
  const v = { k0: F.komp[0], k1: F.komp[1], k2: F.komp[2], b0: F.bjBatu[0], b1: F.bjBatu[1], b2: F.bjBatu[2], fr: F.fr.map(f => ({ n: f.n, p0: f.p[0], j0: f.bj[0], p1: f.p[1], j1: f.bj[1], p2: f.p[2], j2: f.bj[2] })) };
  const sumK = x => jmN(x.k0) + jmN(x.k1) + jmN(x.k2);
  const sumP = (x, i) => (x.fr || []).reduce((a, r) => a + jmN(r['p' + i]), 0);
  const okT = t => Math.abs(t - 100) < 0.01;
  openForm({
    title: 'Ubah Jobmix SCP', sub: 'Komposisi batu bahan baku per 1 ton produk, dan persen fraksi hasil + berat jenis untuk tiap jenis batu', wide: true, value: v,
    fields: [
      { k: 'k0', label: 'Komposisi Batu Bantak (% berat)', type: 'num', third: true, suffix: '%' }, { k: 'k1', label: 'Komposisi Batu Andesit (% berat)', type: 'num', third: true, suffix: '%' }, { k: 'k2', label: 'Komposisi Batu Blondos (% berat)', type: 'num', third: true, suffix: '%' },
      { k: 'b0', label: 'BJ Batu Bantak (Ton/M3 lepas)', type: 'num', third: true }, { k: 'b1', label: 'BJ Batu Andesit (Ton/M3 lepas)', type: 'num', third: true }, { k: 'b2', label: 'BJ Batu Blondos (Ton/M3 lepas)', type: 'num', third: true },
      { k: 'fr', label: 'Fraksi hasil produksi per jenis batu (% berat dari 1 ton batu, BJ Ton/M3 lepas)', type: 'items', newRow: () => ({ n: '', p0: 0, j0: '', p1: 0, j1: '', p2: 0, j2: '' }), cols: [
        { k: 'n', label: 'Fraksi', type: 'list', opts: () => ['Split 1/1', 'Split 1/2', 'Split 2/3', 'Split 3/5', 'Abu Batu', 'Pasir (Hasil SCP)', 'Ladu / Ondol'], w: '20%' },
        { k: 'p0', label: 'Bantak %', num: true }, { k: 'j0', label: 'Bantak BJ', num: true }, { k: 'p1', label: 'Andesit %', num: true }, { k: 'j1', label: 'Andesit BJ', num: true },
        { k: 'p2', label: 'Blondos %', num: true }, { k: 'j2', label: 'Blondos BJ', num: true }] },
      { k: 'cek', type: 'html', html: x => { const tk = sumK(x); return '<div class="kpis sm">' + kpi('Total komposisi', num(tk) + '%', okT(tk) ? 'OK' : 'harus 100%', okT(tk) ? 'good' : 'bad') + [0, 1, 2].map(i => { const t = sumP(x, i); return kpi('Total fraksi ' + FRK_SH[i], num(t) + '%', okT(t) ? 'OK' : 'harus 100%', okT(t) ? 'good' : 'bad'); }).join('') + '</div>'; } }
    ],
    onSave: x => {
      if (!okT(sumK(x))) { toast('Total komposisi batu harus 100%', 'err'); return false; }
      const fr = (x.fr || []).filter(r => String(r.n || '').trim()).map(r => ({ n: String(r.n).trim(), p: [jmN(r.p0), jmN(r.p1), jmN(r.p2)], bj: [jmN(r.j0), jmN(r.j1), jmN(r.j2)] }));
      if (!fr.length) { toast('Isi minimal satu fraksi', 'err'); return false; }
      for (let i = 0; i < 3; i++) { const t = fr.reduce((a, f) => a + f.p[i], 0); if (t > 0 && !okT(t)) { toast('Total fraksi Batu ' + FRK_SH[i] + ' ' + num(t) + '% — harus 100%', 'err'); return false; } }
      save('param', { frk: true, komp: [jmN(x.k0), jmN(x.k1), jmN(x.k2)], bjBatu: [jmN(x.b0), jmN(x.b1), jmN(x.b2)], fr }, FRK_ID);
      toast('Jobmix SCP tersimpan');
    }
  });
});
/* kalkulator: batu masuk crusher per jenis → perkiraan hasil per fraksi (tidak disimpan, tanpa kata sandi) */
function frkCalc() {
  const F = frkData();
  openForm({
    title: 'Hitung Hasil Produksi SCP', sub: 'Masukkan tonase batu yang diproses — hasil per fraksi dihitung dari persen dan berat jenis Jobmix SCP', wide: true, saveLabel: 'Tutup',
    value: { t0: 100 * F.komp[0] / 100, t1: 100 * F.komp[1] / 100, t2: 100 * F.komp[2] / 100 },
    fields: [
      { k: 't0', label: 'Batu Bantak (Ton)', type: 'num', third: true }, { k: 't1', label: 'Batu Andesit (Ton)', type: 'num', third: true }, { k: 't2', label: 'Batu Blondos (Ton)', type: 'num', third: true },
      { k: 'out', type: 'html', html: x => {
        const M = frkMix(F, [x.t0, x.t1, x.t2]);
        const bm3 = [0, 1, 2].reduce((a, i) => a + (F.bjBatu[i] ? jmN([x.t0, x.t1, x.t2][i]) / F.bjBatu[i] : 0), 0);
        return '<div class="kpis sm">' + kpi('Total batu', num(M.tot) + ' Ton', '≈ ' + num(bm3) + ' M3 lepas') + kpi('Total hasil', num(M.out) + ' Ton', num(M.m3) + ' M3') + kpi('Rendemen', pct(M.tot ? M.out / M.tot : 0)) + '</div>' +
          table([{ t: 'Fraksi', f: r => '<b>' + esc(r.n) + '</b>', raw: true }, { t: '% Hasil', f: r => pct(r.p), num: true }, { t: 'Ton', f: r => num(r.ton), num: true }, { t: 'BJ campuran', f: r => n4(r.bj), num: true }, { t: 'M3', f: r => num(r.m3), num: true }],
            M.rows.map(r => Object.assign({ id: r.n }, r)), { empty: 'Isi tonase batu.' });
      } }
    ],
    onSave: () => true
  });
}

/* ---------- PDF ---------- */
async function jobmixReport(s) {
  const v = s.jv || 'prod';
  if (v === 'cmp') {
    const J = jmdData();
    const R = await pdfReport({ title: 'Jobmix CMP - Job Mix Design Readymix', sub: UNIT_NAME.CMP + ' · per 1 M3 · Zona ' + J.zona, orient: 'l', fname: 'Jobmix_CMP' });
    R.kv([['Zona gradasi pasir dipakai', 'Zona ' + J.zona], ['BJ Split 10/20 / 20/30', N_(J.bj.s1) + ' / ' + N_(J.bj.s2) + ' Ton/M3'], ['BJ Pasir', N_(J.bj.pasir) + ' Ton/M3'], ['Sumber', J.doc ? 'Diubah ' + (J.doc._by || '-') + ' ' + tglJam(J.doc._at) : 'Acuan sheet RAPU-BUASO']]);
    R.table(['No', 'Mutu', 'fc (MPa)', 'Semen (Kg)', 'Semen (Zak)', 'Split 10/20 (Kg)', 'Split 10/20 (M3)', 'Split 20/30 (Kg)', 'Split 20/30 (M3)', 'Pasir (Kg)', 'Pasir (M3)', 'Retarder (L)', 'Total (Kg)'],
      J.rows.map((r, i) => [i + 1, r.m, r.fc == null || r.fc === '' ? '-' : N_(r.fc), cellR(N_(r.semen)), cellR(N_(jmN(r.semen) / 50)), cellR(N_(r.s1)), cellR(num4(jmdM3(r.s1, J.bj.s1))), cellR(N_(r.s2)), cellR(num4(jmdM3(r.s2, J.bj.s2))), cellR(N_(r.pasir)), cellR(num4(jmdM3(r.pasir, J.bj.pasir))), cellR(num4(r.ret)), cellR(N_(jmdKg(r)))]),
      { fs: 7.4, cs: { 0: { halign: 'center', cellWidth: 8 } } });
    R.para('Split 10/20 = material Split 1/2, Split 20/30 = Split 2/3. Kebutuhan M3 = kg / 1.000 / berat jenis lepas.');
    R.sign(); await R.save(); return;
  }
  if (v === 'scp') {
    const F = frkData(), M = frkMix(F);
    const R = await pdfReport({ title: 'Jobmix SCP - Komposisi & Fraksi Hasil Produksi', sub: UNIT_NAME.SCP + ' · per 1 Ton batu', orient: 'l', fname: 'Jobmix_SCP' });
    R.h2('A. Komposisi bahan baku per 1 ton produk');
    R.table(['No', 'Bahan Baku', 'Komposisi (% berat)', 'BJ (Ton/M3 lepas)', '1 Ton = M3'], FRK_BATU.map((n, i) => [i + 1, n, cellR(N_(F.komp[i]) + '%'), cellR(num4(F.bjBatu[i])), cellR(F.bjBatu[i] ? num4(1 / F.bjBatu[i]) : '-')]),
      { foot: ['', 'Total', cellR(N_(F.komp.reduce((a, b) => a + jmN(b), 0)) + '%'), '', ''], cs: { 0: { halign: 'center', cellWidth: 8 } } });
    R.h2('B. Fraksi hasil produksi per jenis batu');
    R.table(['No', 'Fraksi', 'Bantak %', 'Bantak BJ', 'Andesit %', 'Andesit BJ', 'Blondos %', 'Blondos BJ', 'Campuran %', 'BJ Campuran'],
      F.fr.map((f, j) => [j + 1, f.n, cellR(N_(f.p[0]) + '%'), cellR(num4(f.bj[0])), cellR(N_(f.p[1]) + '%'), cellR(num4(f.bj[1])), cellR(N_(f.p[2]) + '%'), cellR(num4(f.bj[2])), cellR(N_(M.rows[j].p * 100) + '%'), cellR(num4(M.rows[j].bj))]),
      { foot: ['', 'Total', cellR(N_(frkTot(F, 0)) + '%'), '', cellR(N_(frkTot(F, 1)) + '%'), '', cellR(N_(frkTot(F, 2)) + '%'), '', cellR(N_(M.tot ? M.out / M.tot * 100 : 0) + '%'), ''], cs: { 0: { halign: 'center', cellWidth: 8 } } });
    R.para('Sumber: ' + (F.doc ? 'diubah ' + (F.doc._by || '-') + ' ' + tglJam(F.doc._at) : 'acuan sheet RAPU-BUASO (Jobmix Formula A & B); rincian per jenis batu = perkiraan awal') + '.');
    R.sign(); await R.save(); return;
  }
  return prodReport(s);
}
