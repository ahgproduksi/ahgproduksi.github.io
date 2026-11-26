/* Komposisi Jobmix (Kartu Produksi) — Jobmix AMP (JMF hotmix per ton), Jobmix CMP (JMD readymix per M3, 5 zona gradasi pasir),
   Jobmix SCP (komposisi batu + fraksi hasil per Batu Bantak / Andesit / Blondos + berat jenis), Jobmix & Pembesian PCP (beton + tulangan per pcs).
   Acuan: sheet RAPU-BUASO / Price List tab "Jobmix Formula" (A-F), "PCP" (D) dan Master Bahan.
   Disimpan per basecamp kind 'param' (dikunci kata sandi edit, dicek server): prmJmfAMP01, prmJmdCMP01, prmFraksiSCP01, prmJmfPCP01.
   Bila dokumen ada, koefisien bahan produk ikut dipakai HPP, Price List, SO (yang terbaru menang terhadap ubahan per produk).
   Pilihan volume (mis. 6 M3, 25 Ton, 100 Pcs) hanya mengalikan tampilan & PDF, tidak mengubah data. */
'use strict';
const JMF_AMP_ID = 'prmJmfAMP01', JMD_ID = 'prmJmdCMP01', FRK_ID = 'prmFraksiSCP01', PCP_JM_ID = 'prmJmfPCP01';
const JM = { raw: false };
const jmClone = o => JSON.parse(JSON.stringify(o));
const jmN = v => { const n = +v; return isFinite(n) ? n : 0; };
const jmNewer = (doc, p) => !p.edited || String(doc._at || '') > String(p.at || '');
const jmLine = (p, re) => p.b.find(x => re.test(String(x[0])));
function jmSet(p, re, nama, komp, sat, val, addIfZero) {
  let l = jmLine(p, re);
  if (!l) { if (!val && !addIfZero) return null; const mi = minfo(nama); l = [nama, komp, sat, 0, mi ? mi.harga : 0]; const iB = p.b.filter(x => x[1] === 'B').length; p.b.splice(iB, 0, l); }
  l[3] = val; return l;
}
/* harga transfer beton readymix semua mutu CMP (bukan hanya K-300 / K-350) */
(K.unit.CMP || []).forEach(p => { const k = 'beton readymix ' + p.n.toLowerCase(); if (!INTERNAL[k]) INTERNAL[k] = ['CMP', p.n]; });
function productsRaw(u) { JM.raw = true; try { return products(u); } finally { JM.raw = false; } }

/* ================= AMP ================= */
const AMP_AGG = [['pasir', 'Pasir (Hasil SCP)', 'Pasir SCP'], ['abu', 'Abu Batu', 'Abu Batu'], ['s11', 'Split 1/1', 'Split 1/1'], ['s12', 'Split 1/2', 'Split 1/2'], ['s23', 'Split 2/3', 'Split 2/3'], ['s35', 'Split 3/5', 'Split 3/5']];
const AMP_KG = [['semen', 'Semen Curah', 'Semen'], ['aspal', 'Aspal', 'Aspal'], ['asb', 'Asbuton 50/30', 'Asbuton 50/30'], ['add', 'Aspal Additive', 'Additive']];
const ASPAL = { Curah: 'Aspal Curah (Pen 60/70)', Modifikasi: 'Aspal Curah Modifikasi' };
const jmEsc = s => String(s).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
function ampDefRows() {
  return productsRaw('AMP').map(p => {
    const k = nm => { const l = p.b.find(x => String(x[0]).toLowerCase() === nm.toLowerCase()); return l ? jmN(l[3]) : 0; };
    const asp = jmLine(p, /^aspal curah/i);
    const r = { n: p.n, jenis: asp && /modifikasi/i.test(asp[0]) ? 'Modifikasi' : 'Curah', aspal: asp ? jmN(asp[3]) : 0 };
    AMP_AGG.forEach(([c, nm]) => r[c] = k(nm)); r.semen = k('Semen Curah'); r.asb = k('Asbuton 50/30'); r.add = k('Aspal Additive'); r.rco = k('RCO (Minyak Hitam)');
    return r;
  });
}
function ampData() {
  const d = get(JMF_AMP_ID) || {};
  const bj = {}; AMP_AGG.forEach(([c, nm]) => bj[c] = d.bj && +d.bj[c] ? +d.bj[c] : ((minfo(nm) || {}).bj || 1.5));
  const rows = Array.isArray(d.rows) && d.rows.length ? d.rows.map(r => Object.assign({}, r)) : ampDefRows();
  return { doc: d.id ? d : null, bj, rows, rco: d.rco != null && d.rco !== '' ? jmN(d.rco) : 15 };
}
const ampTon = (r, bj) => AMP_AGG.reduce((a, [c]) => a + jmN(r[c]) * bj[c], 0) + (jmN(r.semen) + jmN(r.aspal) + jmN(r.asb) + jmN(r.add)) / 1000;

/* ================= CMP ================= */
/* [mutu, fc MPa, semen kg [zona1..5], split 10/20 kg, split 20/30 kg, pasir kg, retarder liter] — sheet Jobmix Formula bagian E */
const JMD_DEF = [["B-0",0,[90,110,130,150,150],[278.4716943,276.230293,273.9888917,271.7474904,271.7474904],[649.7672866,644.5373503,639.307414,634.0774777,634.0774777],[1145.223745,1136.005911,1126.788076,1117.570242,1117.570242],[0.315,0.385,0.455,0.525,0.525]],["K-100",8,[190,210,230,250,250],[296.3151975,293.8301656,291.3451338,288.8601019,288.8601019],[691.4021274,685.6037197,679.8053121,674.0069045,674.0069045],[997.3628535,988.9985223,980.6341911,972.2698599,972.2698599],[0.665,0.735,0.805,0.875,0.875]],["K-125",10,[200,220,240,260,260],[295.0726815,292.5876497,290.1026178,287.617586,287.617586],[688.5029236,682.7045159,676.9061083,671.1077006,671.1077006],[993.1806879,984.8163567,976.4520255,968.0876943,968.0876943],[0.7,0.77,0.84,0.91,0.91]],["K-150",12,[210,230,250,270,270],[293.8301656,291.3451338,288.8601019,286.3750701,286.3750701],[685.6037197,679.8053121,674.0069045,668.2084968,668.2084968],[988.9985223,980.6341911,972.2698599,963.9055287,963.9055287],[0.735,0.805,0.875,0.945,0.945]],["K-175",15,[220,240,260,280,280],[292.5876497,290.1026178,287.617586,285.1325541,285.1325541],[682.7045159,676.9061083,671.1077006,665.309293,665.309293],[984.8163567,976.4520255,968.0876943,959.7233631,959.7233631],[0.77,0.84,0.91,0.98,0.98]],["K-200",17,[230,250,270,290,290],[291.3451338,288.8601019,286.3750701,283.8900382,283.8900382],[679.8053121,674.0069045,668.2084968,662.4100892,662.4100892],[980.6341911,972.2698599,963.9055287,955.5411975,955.5411975],[0.805,0.875,0.945,1.015,1.015]],["K-225",19,[250,270,290,310,310],[300.187949,297.605465,295.0229809,292.4404968,292.4404968],[700.4385478,694.4127516,688.3869554,682.3611592,682.3611592],[932.5853758,924.5624459,916.5395159,908.516586,908.516586],[0.875,0.945,1.015,1.085,1.085]],["K-250",21,[280,300,320,340,340],[296.3142229,293.7317389,291.1492548,288.5667707,288.5667707],[691.3998535,685.3740573,679.3482611,673.322465,673.322465],[920.5509809,912.528051,904.505121,896.4821911,896.4821911],[0.98,1.05,1.12,1.19,1.19]],["K-275",23,[295,315,335,355,355],[294.3773599,291.7948758,289.2123917,286.6299076,286.6299076],[686.8805064,680.8547102,674.828914,668.8031178,668.8031178],[914.5337834,906.5108535,898.4879236,890.4649936,890.4649936],[1.0325,1.1025,1.1725,1.2425,1.2425]],["K-300",25,[330,350,370,390,390],[295.3270318,292.6958217,290.0646115,287.4334013,287.4334013],[689.0964076,682.9569172,676.8174268,670.6779363,670.6779363],[881.3342166,873.4819873,865.629758,857.7775287,857.7775287],[1.155,1.225,1.295,1.365,1.365]],["K-325",27,[350,370,390,410,410],[292.6958217,290.0646115,287.4334013,284.8021911,284.8021911],[682.9569172,676.8174268,670.6779363,664.5384459,664.5384459],[873.4819873,865.629758,857.7775287,849.9252994,849.9252994],[1.225,1.295,1.365,1.435,1.435]],["K-350",29,[380,400,420,440,440],[288.7490064,286.1177962,283.486586,280.8553758,280.8553758],[673.7476815,667.6081911,661.4687006,655.3292102,655.3292102],[861.7036433,853.851414,845.9991847,838.1469554,838.1469554],[1.33,1.4,1.47,1.54,1.54]],["K-375",31,[400,420,440,460,460],[286.1177962,283.486586,280.8553758,278.2241656,278.2241656],[667.6081911,661.4687006,655.3292102,649.1897197,649.1897197],[853.851414,845.9991847,838.1469554,830.2947261,830.2947261],[1.4,1.47,1.54,1.61,1.61]],["K-400",33,[430,450,470,490,490],[282.1709809,279.5397707,276.9085605,274.2773503,274.2773503],[658.3989554,652.259465,646.1199745,639.9804841,639.9804841],[842.0730701,834.2208408,826.3686115,818.5163822,818.5163822],[1.505,1.575,1.645,1.715,1.715]],["K-425",35,[445,465,485,505,505],[280.1975732,277.5663631,274.9351529,272.3039427,272.3039427],[653.7943376,647.6548471,641.5153567,635.3758662,635.3758662],[836.1838981,828.3316688,820.4794395,812.6272102,812.6272102],[1.5575,1.6275,1.6975,1.7675,1.7675]],["K-450",37,[460,480,500,520,520],[278.2241656,275.5929554,272.9617452,270.330535,270.330535],[649.1897197,643.0502293,636.9107389,630.7712484,630.7712484],[830.2947261,822.4424968,814.5902675,806.7380382,806.7380382],[1.61,1.68,1.75,1.82,1.82]],["K-475",39,[480,500,520,540,540],[285.8001019,283.0714395,280.3427771,277.6141146,277.6141146],[666.8669045,660.5000255,654.1331465,647.7662675,647.7662675],[786.6841274,779.1732994,771.6624713,764.1516433,764.1516433],[1.68,1.75,1.82,1.89,1.89]],["K-500",42,[495,515,535,555,555],[283.7536051,281.0249427,278.2962803,275.5676178,275.5676178],[662.0917452,655.7248662,649.3579873,642.9911083,642.9911083],[781.0510064,773.5401783,766.0293503,758.5185223,758.5185223],[1.7325,1.8025,1.8725,1.9425,1.9425]],["FS-45",29,[440,460,480,500,500],[301.9674268,299.2387643,296.5101019,293.7814395,293.7814395],[704.5906624,698.2237834,691.8569045,685.4900255,685.4900255],[831.1857834,823.6749554,816.1641274,808.6532994,808.6532994],[1.54,1.61,1.68,1.75,1.75]],["FS-47",30,[450,470,490,510,510],[300.6030955,297.8744331,295.1457707,292.4171083,292.4171083],[701.4072229,695.0403439,688.673465,682.306586,682.306586],[827.4303694,819.9195414,812.4087134,804.8978854,804.8978854],[1.575,1.645,1.715,1.785,1.785]],["MORTAR 1:5",null,[355,375,395,415,435],[0,0,0,0,0],[0,0,0,0,0],[1894.6063694,1877.5363057,1860.466242,1843.3961783,1826.3261146],[1.2425,1.3125,1.3825,1.4525,1.5225]]];
/* berat jenis lepas (Ton/M3): split & pasir = dasar konversi kg → M3 di rincian BUASO sheet (1,35 & 1,45); semen = perkiraan (informasi volume) */
const JMD_BJ = { s1: 1.35, s2: 1.35, pasir: 1.45, semen: 1.25 };
const JMD_COL = [['semen', 'Semen Curah'], ['s1', 'Split 1/2'], ['s2', 'Split 2/3'], ['pasir', 'Pasir Beton'], ['ret', 'Retarder (Type D)']];
function jmdDefZone(z) { const i = Math.min(4, Math.max(0, (+z || 1) - 1)); return JMD_DEF.map(r => ({ m: r[0], fc: r[1], semen: r[2][i], s1: r[3][i], s2: r[4][i], pasir: r[5][i], ret: r[6][i] })); }
function jmdData() {
  const d = get(JMD_ID) || {};
  const zona = String(d.zona || 1), bj = Object.assign({}, JMD_BJ, d.bj || {});
  const zone = z => (d.z && Array.isArray(d.z[z]) && d.z[z].length ? d.z[z] : jmdDefZone(z)).map(r => Object.assign({}, r));
  return { doc: d.id ? d : null, zona, bj, zone, rows: zone(zona) };
}
const jmdKg = r => jmN(r.semen) + jmN(r.s1) + jmN(r.s2) + jmN(r.pasir);
const jmdM3 = (kg, bj) => bj ? jmN(kg) / 1000 / bj : 0;
const jmdMutu = m => jmdData().rows.find(r => String(r.m).toLowerCase() === String(m).toLowerCase()) || null;

/* ================= SCP ================= */
const FRK_BATU = ['Batu Bantak', 'Batu Andesit', 'Batu Blondos'];
const FRK_SH = ['Bantak', 'Andesit', 'Blondos'];
/* default: komposisi & rata-rata fraksi = sheet (A: Bantak 50% + Andesit 50%; B: 19,14/23,49/21,45/18,22/8,87/8,83 %).
   Rincian per jenis batu = perkiraan awal, disusun agar rata-rata Bantak+Andesit tepat sama dengan sheet. */
const FRK_DEF = {
  komp: [50, 50, 0], bjBatu: [1.5, 1.6, 1.65],
  fr: [
    { n: 'Split 1/1', p: [17.28, 21, 20], bj: [1.312, 1.382, 1.4] },
    { n: 'Split 1/2', p: [21.98, 25, 26], bj: [1.349, 1.419, 1.44] },
    { n: 'Split 2/3', p: [19.9, 23, 25], bj: [1.399, 1.469, 1.49] },
    { n: 'Abu Batu', p: [20.44, 16, 15], bj: [1.515, 1.585, 1.6] },
    { n: 'Pasir (Hasil SCP)', p: [9.74, 8, 10], bj: [1.465, 1.535, 1.55] },
    { n: 'Ladu / Ondol', p: [10.66, 7, 4], bj: [1.315, 1.385, 1.4] }
  ]
};
function frkData() {
  const d = get(FRK_ID) || {};
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

/* ================= PCP ================= */
/* [produk, dimensi, B/lebar cm, H/tebal cm, L cm, t cm, mutu, volume beton netto M3/pcs, jenis tulangan, wiremesh M2/pcs (incl. overlap),
    rasio besi Kg/M3, besi tambahan Kg/pcs, decking Bh/pcs, luas cetakan M2/pcs] — sheet PCP bagian D */
const PCP_DEF = [["U-Ditch","30x30x120 t5",30,30,120,5,"K-350",0.06,"Wiremesh M6",1.32,0,0,4,2.4],["U-Ditch","30x40x120 t5",30,40,120,5,"K-350",0.072,"Wiremesh M6",1.584,0,0,5,2.88],["U-Ditch","30x40x120 t10",30,40,120,10,"K-350",0.156,"Wiremesh M8",1.716,0,1,10,3.12],["U-Ditch","40x40x120 t5",40,40,120,5,"K-350",0.078,"Wiremesh M6",1.716,0,0,5,3.12],["U-Ditch","40x50x120 t15",40,50,120,15,"K-350",0.306,"Wiremesh M8",2.244,0,1,19,4.08],["U-Ditch","40x60x120 t7",40,60,120,7,"K-350",0.14616,"Wiremesh M6",2.2968,0,1,9,4.176],["U-Ditch","40x60x120 t10",40,60,120,10,"K-350",0.216,"Wiremesh M8",2.376,0,1,13,4.32],["U-Ditch","50x50x120 t7",50,50,120,7,"K-350",0.13776,"Wiremesh M6",2.1648,0,1,9,3.936],["U-Ditch","50x70x120 t10",50,70,120,10,"K-350",0.252,"Wiremesh M8",2.772,0,1,16,5.04],["U-Ditch","50x70x120 t15",50,70,120,15,"K-350",0.396,"Wiremesh M8",2.904,0,1,24,5.28],["U-Ditch","60x80x120 t10",60,80,120,10,"K-350",0.288,"Wiremesh M8",3.168,0,1,18,5.76],["U-Ditch","80x80x120 t10",80,80,120,10,"K-350",0.312,"Wiremesh M8",3.432,0,1,19,6.24],["U-Ditch","80x100x120 t10",80,100,120,10,"K-350",0.36,"Wiremesh M8",3.96,0,1,22,7.2],["U-Ditch","80x100x120 t15",80,100,120,15,"K-350",0.558,"Wiremesh M8",4.092,0,1,34,7.44],["U-Ditch","60x70x120 t15",60,70,120,15,"K-350",0.414,"Wiremesh M6",3.036,0,1,25,5.52],["U-Ditch","60x80x120 t15",60,80,120,15,"K-350",0.45,"Wiremesh M6",3.3,0,1,27,6],["Cover","30x8x60",30,8,60,null,"K-350",0.0144,"Besi beton",0,80,0,1,0.36],["Cover","30x10x60",30,10,60,null,"K-350",0.018,"Besi beton",0,80,0,2,0.36],["Cover","30x10x120",30,10,120,null,"K-350",0.036,"Besi beton",0,80,0,3,0.72],["Cover","30x15x120",30,15,120,null,"K-350",0.054,"Besi beton",0,100,0,4,0.72],["Cover","40x10x120",40,10,120,null,"K-350",0.048,"Besi beton",0,80,0,3,0.96],["Cover","40x15x120",40,15,120,null,"K-350",0.072,"Besi beton",0,100,0,5,0.96],["Cover","50x10x120",50,10,120,null,"K-350",0.06,"Besi beton",0,80,0,4,1.2],["Cover","50x15x120",50,15,120,null,"K-350",0.09,"Besi beton",0,100,0,6,1.2],["Cover","50x15x60",50,15,60,null,"K-350",0.045,"Besi beton",0,100,0,3,0.6],["Cover","60x15x60",60,15,60,null,"K-350",0.054,"Besi beton",0,100,0,4,0.72],["Cover","80x10x120",80,10,120,null,"K-350",0.096,"Besi beton",0,80,0,6,1.92],["Cover","80x15x120",80,15,120,null,"K-350",0.144,"Besi beton",0,100,0,9,1.92],["Cover","80x15x60",80,15,60,null,"K-350",0.072,"Besi beton",0,100,0,5,0.96],["Cover","80x25x60",80,25,60,null,"K-350",0.12,"Besi beton",0,100,0,8,0.96],["Cover","80x25x120",80,25,120,null,"K-350",0.24,"Besi beton",0,100,0,15,1.92],["Cover","100x15x120",100,15,120,null,"K-350",0.18,"Besi beton",0,100,0,11,2.4],["Box Culvert","40x40x120 t12",40,40,120,12,"K-350",0.29952,"Besi beton",0,140,0,18,4.992],["Box Culvert","50x50x120 t16",50,50,120,16,"K-350",0.50688,"Besi beton",0,140,0,31,6.336],["Box Culvert","60x60x120 t16",60,60,120,16,"K-350",0.58368,"Besi beton",0,140,0,36,7.296],["Box Culvert","100x100x100 t15",100,100,100,15,"K-350",0.69,"Besi beton",0,140,0,42,9.2],["Box Culvert","100x100x120 t20",100,100,120,20,"K-350",1.152,"Besi beton",0,140,0,70,11.52],["Box Culvert","120x120x100 t15",120,120,100,15,"K-350",0.81,"Besi beton",0,140,0,49,10.8],["Box Culvert","80x80x100 t20",80,80,100,20,"K-350",0.8,"Besi beton",0,140,0,48,8],["Kansteen","10/15x30x50",10,30,50,15,"K-300",0.01875,"Tanpa tulangan",0,0,0,0,0.3],["Kansteen","10/15x40x50",10,40,50,15,"K-300",0.025,"Tanpa tulangan",0,0,0,0,0.4],["Kansteen","7/14x34x50",7,34,50,14,"K-300",0.01785,"Tanpa tulangan",0,0,0,0,0.34],["Kansteen","18/21x35x60",18,35,60,21,"K-300",0.04095,"Tanpa tulangan",0,0,0,0,0.42],["Kansteen","18/21x30x50",18,30,50,21,"K-300",0.02925,"Tanpa tulangan",0,0,0,0,0.3],["Kansteen","18/21x30x60",18,30,60,21,"K-300",0.0351,"Tanpa tulangan",0,0,0,0,0.36],["Kansteen","18/21x40x50",18,40,50,21,"K-300",0.039,"Tanpa tulangan",0,0,0,0,0.4],["Kansteen","20/25x45x50",20,45,50,25,"K-300",0.050625,"Tanpa tulangan",0,0,0,0,0.45],["Pagar Panel","40x5x240",40,5,240,null,"K-300",0.048,"Wiremesh M6",1.056,0,0,3,1.92],["Kolom Panel","18x18x320",18,18,320,null,"K-350",0.10368,"Besi beton",0,0,11.0748,7,1.152],["linning irigasi","50x60x7",50,7,60,null,"K-300",0.021,"Wiremesh M6",0.33,0,0,2,0.6],["Patok Pengarah","15x15x150",15,15,150,null,"K-350",0.03375,"Besi beton",0,0,3.559,3,0.45]];
const PCP_PAR = { susut: 3, waste: 5, kb: 0.015, kw: 0.02, oli: 0.1, bjb: 2400 }; // sheet PCP: parameter teknis (AHSP Permen PUPR 8/2023 & SNI)
const PCP_TUL = ['Wiremesh M6', 'Wiremesh M8', 'Besi beton', 'Tanpa tulangan'];
const WM_NAME = { 'Wiremesh M6': 'Besi Wiremesh M6 (2,1 x 5,4 m)', 'Wiremesh M8': 'Besi Wiremesh M8 (2,1 x 5,4 m)' };
function pcpData() {
  const d = get(PCP_JM_ID) || {};
  const par = Object.assign({}, PCP_PAR, d.par || {});
  const rows = Array.isArray(d.rows) && d.rows.length ? d.rows.map(r => Object.assign({}, r))
    : PCP_DEF.map(r => ({ n: r[0], d: r[1], mutu: r[6], vol: r[7], tul: r[8], wm: r[9], rasio: r[10], tam: r[11], deck: r[12], cet: r[13] }));
  return { doc: d.id ? d : null, par, rows };
}
function pcpCalc(r, par) {
  const vol = jmN(r.vol), beton = vol * (1 + jmN(par.susut) / 100);
  const besi = (vol * jmN(r.rasio) + jmN(r.tam)) * (1 + jmN(par.waste) / 100);
  const wm = /^wiremesh/i.test(r.tul || '') ? jmN(r.wm) : 0;
  return { vol, beton, besi, wm, kawat: besi * jmN(par.kb) + wm * jmN(par.kw), deck: jmN(r.deck), oli: jmN(r.cet) * jmN(par.oli), berat: vol * jmN(par.bjb), rasioRiil: vol ? besi / vol : 0 };
}
const pcpName = r => (String(r.n || '').trim() + ' ' + String(r.d || '').trim()).trim();

/* ================= terapkan ke produk (dipanggil dari products() di js/data.js) ================= */
function jobmixApply(u, p) {
  if (JM.raw) return;
  if (u === 'AMP') {
    const doc = get(JMF_AMP_ID); if (!doc || !jmNewer(doc, p)) return;
    const A = ampData(), r = A.rows.find(x => String(x.n).toLowerCase() === p.n.toLowerCase()); if (!r) return;
    AMP_AGG.forEach(([c, nm]) => jmSet(p, new RegExp('^' + jmEsc(nm) + '$', 'i'), nm, 'B', 'M3', jmN(r[c])));
    jmSet(p, /^semen curah$/i, 'Semen Curah', 'B', 'Kg', jmN(r.semen));
    const an = ASPAL[r.jenis] || ASPAL.Curah, l = jmSet(p, /^aspal curah/i, an, 'B', 'Kg', jmN(r.aspal));
    if (l && l[0] !== an) { l[0] = an; const mi = minfo(an); if (mi) l[4] = mi.harga; }
    jmSet(p, /^asbuton/i, 'Asbuton 50/30', 'B', 'Kg', jmN(r.asb));
    jmSet(p, /^aspal additive$/i, 'Aspal Additive', 'B', 'Kg', jmN(r.add));
    jmSet(p, /^rco/i, 'RCO (Minyak Hitam)', 'B', 'Liter', r.rco != null && r.rco !== '' ? jmN(r.rco) : A.rco);
    p.jmd = true;
  } else if (u === 'CMP') {
    const doc = get(JMD_ID); if (!doc || !jmNewer(doc, p)) return;
    const J = jmdData(), r = J.rows.find(x => String(x.m).toLowerCase() === String(p.n).toLowerCase()); if (!r) return;
    JMD_COL.forEach(([k, nama]) => {
      const val = jmN(r[k]);
      let l = p.b.find(x => String(x[0]).toLowerCase() === nama.toLowerCase());
      if (!l) { if (!val) return; l = jmSet(p, /^$^/, nama, 'B', k === 'ret' ? 'Liter' : k === 'semen' ? 'Kg' : 'M3', 0); }
      const sat = String(l[2]).toLowerCase(), bj = k === 's1' ? J.bj.s1 : k === 's2' ? J.bj.s2 : k === 'pasir' ? J.bj.pasir : J.bj.semen;
      l[3] = k === 'ret' ? val : sat === 'kg' ? val : sat === 'ton' ? val / 1000 : sat === 'm3' ? jmdM3(val, bj) : val;
    });
    p.jmd = true;
  } else if (u === 'SCP') {
    const doc = get(FRK_ID); if (!doc || !jmNewer(doc, p) || !p.b.some(l => FRK_BATU.includes(l[0]))) return;
    const F = frkData();
    FRK_BATU.forEach((nama, i) => jmSet(p, new RegExp('^' + jmEsc(nama) + '$'), nama, 'B', 'Ton', jmN(F.komp[i]) / 100));
    p.jmd = true;
  } else if (u === 'PCP') {
    const doc = get(PCP_JM_ID); if (!doc || !jmNewer(doc, p)) return;
    const P = pcpData(), r = P.rows.find(x => pcpName(x).toLowerCase() === p.n.toLowerCase()); if (!r) return;
    const c = pcpCalc(r, P.par);
    const ul = jmLine(p, /^upah/i), ratio = ul && jmN(ul[3]) ? c.vol / jmN(ul[3]) : 1;
    const bn = 'Beton readymix ' + (r.mutu || 'K-350') + ' (dari CMP)', bl = jmSet(p, /^beton readymix/i, bn, 'B', 'M3', c.beton);
    if (bl && bl[0] !== bn) { bl[0] = bn; const base = BASE_HPP['CMP|' + r.mutu]; if (base) bl[4] = base / 0.95; }
    jmSet(p, /^besi beton$/i, 'Besi Beton', 'B', 'Kg', c.besi);
    const wn = WM_NAME[r.tul], wl = jmLine(p, /^besi wiremesh/i);
    if (wn) { const l = jmSet(p, /^besi wiremesh/i, wn, 'B', 'M2', c.wm); if (l && l[0] !== wn) { l[0] = wn; const mi = minfo(wn); if (mi) l[4] = mi.harga; } } else if (wl) wl[3] = 0;
    jmSet(p, /^kawat bendrat/i, 'Kawat Bendrat (BWG 21)', 'B', 'Kg', c.kawat);
    jmSet(p, /^beton decking/i, 'Beton Decking / Spacer 2-3 cm', 'B', 'Bh', c.deck);
    jmSet(p, /^oli bekas/i, 'Oli Bekas - oli cetakan', 'B', 'Liter', c.oli);
    p.b.forEach(l => { if (l[1] !== 'B') l[3] = String(l[2]).toLowerCase() === 'm3' ? c.vol : jmN(l[3]) * ratio; });
    p.jmd = true;
  }
}

/* ================= tampilan ================= */
const JM_VIEWS = [{ k: 'amp', u: 'AMP', t: 'Jobmix AMP' }, { k: 'cmp', u: 'CMP', t: 'Jobmix CMP' }, { k: 'scp', u: 'SCP', t: 'Jobmix SCP' }, { k: 'pcp', u: 'PCP', t: 'Jobmix & Pembesian PCP' }];
const JM_SAT = { AMP: 'Ton', CMP: 'M3', SCP: 'Ton', PCP: 'Pcs' };
const JM_QUICK = { AMP: [1, 10, 25, 50, 100], CMP: [1, 3, 6, 7, 10], SCP: [1, 10, 50, 100, 280], PCP: [1, 10, 25, 50, 100] };
const jmLS = () => { try { return lsGet(LSP + 'jm', {}) || {}; } catch { return {}; } };
function jmView(s) { if (!s.jv) s.jv = jmLS().jv || 'amp'; if (!JM_VIEWS.some(v => v.k === s.jv)) s.jv = 'amp'; return JM_VIEWS.find(v => v.k === s.jv); }
function jmVol(u) { const v = jmN((jmLS().vol || {})[u]); return v > 0 ? v : 1; }
function jmSave(patch) { const o = jmLS(); if (patch.vol) o.vol = Object.assign({}, o.vol || {}, patch.vol); if (patch.jv) o.jv = patch.jv; lsSet(LSP + 'jm', o); }
const n4 = v => num4(v), sm = t => '<small class="muted">' + t + '</small>';
const jmWho = d => d ? 'Diubah ' + esc(d._by || '-') + ' · ' + esc(tglJam(d._at)) : 'Acuan sheet RAPU-BUASO (belum diubah)';
const jmSeg = s => '<div class="fbar jmseg"><div class="seg" data-jv>' + JM_VIEWS.map(v => '<button type="button" class="' + (s.jv === v.k ? 'on' : '') + '" data-v="' + v.k + '">' + esc(v.t) + '</button>').join('') + '</div></div>';
function jmVolBar(u) {
  const v = jmVol(u), sat = JM_SAT[u];
  return '<div class="jmvol"><span class="jml">Volume jobmix</span><div class="inwrap suf jmvin"><input data-jmvol="' + u + '" inputmode="decimal" autocomplete="off" value="' + esc(nf3.format(v)) + '"><b>' + sat + '</b></div>' +
    '<div class="seg" data-jmq="' + u + '">' + JM_QUICK[u].map(q => '<button type="button" class="' + (q === v ? 'on' : '') + '" data-v="' + q + '">' + num(q) + ' ' + sat + '</button>').join('') + '</div>' +
    '<span class="muted">Semua angka tabel = kebutuhan untuk <b>' + num(v) + ' ' + sat + '</b>' + (v !== 1 ? ' (acuan per 1 ' + sat + ' × ' + num(v) + ')' : '') + '</span></div>';
}
function jmHead(title, u, d, kind, extra) {
  return '<div class="chead"><div>' + unitChip(u) + '<h3>' + esc(title) + '</h3></div><div class="jmbtn">' +
    '<span class="cmeta">' + jmWho(d) + '</span>' + (extra || '') +
    (d ? '<button class="btn ghost sm" data-jmreset="' + kind + '">' + ic('refresh') + 'Kembalikan ke acuan</button>' : '') +
    '<button class="btn pri sm" data-jmedit="' + kind + '">' + ic('edit') + 'Ubah angka</button></div></div>';
}
const jmHpp = (u, n) => { try { return productFind(u, n) ? hppCalc(u, n) : null; } catch { return null; } };
const jmProd = (s, u) => '<div class="jmprod">' + jmfHtml(Object.assign({}, s, { unit: u })) + '</div>';
const qOk = (s, ...t) => typeof qMatch !== 'function' || qMatch(s.q, ...t);

function ampHtml(s) {
  const A = ampData(), V = jmVol('AMP'), rows = A.rows.filter(r => qOk(s, r.n));
  const ag = (r, c) => '<b>' + n4(jmN(r[c]) * V) + '</b><br>' + sm(num(jmN(r[c]) * V * A.bj[c]) + ' t');
  const ed = r => { const p = productFind('AMP', r.n); return p && p.edited && !(A.doc && String(A.doc._at) > String(p.at)) ? ' ' + chip('BUASO produk sendiri', 'warn') : ''; };
  return '<div class="note">Job Mix Formula hotmix per ton (sheet Jobmix Formula bagian D). Agregat dalam M3 (baris kecil = Ton, memakai berat jenis lepas), semen / aspal / asbuton / additive dalam Kg, RCO bahan bakar burner dalam Liter. Setelah diubah, HPP, Price List, dan SO baru AMP langsung memakai angka ini.</div>' +
    jmVolBar('AMP') +
    '<section class="card">' + jmHead('Jobmix AMP — JMF Hotmix untuk ' + num(V) + ' Ton', 'AMP', A.doc, 'amp') +
    '<div class="jmbj">' + AMP_AGG.map(([c, , t]) => '<span>BJ ' + esc(t) + ' <b>' + n4(A.bj[c]) + '</b></span>').join('') + '<span>RCO <b>' + num(A.rco) + ' L/Ton</b></span></div>' +
    table([{ t: 'No', f: r => r.no, cls: 'c' }, { t: 'Produk Hotmix', f: r => '<b>' + esc(r.n) + '</b>' + ed(r), raw: true }].concat(AMP_AGG.map(([c, , t]) => ({ t: t + ' (M3)', f: r => ag(r, c), num: true, raw: true })))
      .concat([{ t: 'Semen (Kg)', f: r => num(jmN(r.semen) * V), num: true }, { t: 'Aspal (Kg)', f: r => '<b>' + num(jmN(r.aspal) * V) + '</b><br>' + sm(esc(r.jenis || 'Curah')), num: true, raw: true },
      { t: 'Asbuton (Kg)', f: r => num(jmN(r.asb) * V), num: true }, { t: 'Additive (Kg)', f: r => n4(jmN(r.add) * V), num: true }, { t: 'RCO (L)', f: r => num((r.rco != null && r.rco !== '' ? jmN(r.rco) : A.rco) * V), num: true },
      { t: 'Total Berat (Ton)', f: r => n4(ampTon(r, A.bj) * V), num: true }, { t: 'HPP + Bunga', f: r => { const c = jmHpp('AMP', r.n); return c ? '<b>' + rp(c.hpp * V) + '</b>' + (V !== 1 ? '<br>' + sm(rp(c.hpp) + ' / Ton') : '') : '-'; }, num: true, raw: true }]),
      rows.map((r, i) => Object.assign({ no: i + 1, id: r.n }, r)), { empty: 'Tidak ada produk.' }) + '</section>' + jmProd(s, 'AMP');
}
function jmdHtml(s) {
  const J = jmdData(), V = jmVol('CMP'), z = String(s.jz || J.zona), rows = J.zone(z).filter(r => qOk(s, r.m));
  const kgm = (kg, bj) => '<b>' + num(jmN(kg) * V) + '</b><br>' + sm(n4(jmdM3(kg, bj) * V) + ' m³');
  return '<div class="note">Job Mix Design readymix (sheet Jobmix Formula bagian E/F). Zona gradasi pasir yang <b>dipakai HPP</b> = Zona ' + esc(J.zona) +
    '. Split 10/20 = material Split 1/2, Split 20/30 = Split 2/3 (hasil SCP). Kebutuhan M3 = kg ÷ 1.000 ÷ berat jenis lepas.</div>' + jmVolBar('CMP') +
    '<div class="kpis">' + kpi('Zona dipakai HPP', 'Zona ' + esc(J.zona), 'gradasi pasir 1 - 5') + kpi('BJ Split 10/20 · 20/30', num(J.bj.s1) + ' · ' + num(J.bj.s2), 'Ton/M3 lepas') + kpi('BJ Pasir', num(J.bj.pasir), 'Ton/M3 lepas') + kpi('BJ Semen', num(J.bj.semen), 'Ton/M3 lepas (informasi)') + '</div>' +
    '<section class="card">' + jmHead('Jobmix CMP — Job Mix Design untuk ' + num(V) + ' M3', 'CMP', J.doc, 'cmp') +
    '<div class="fbar"><span class="muted">Lihat zona</span><div class="seg" data-jz>' + [1, 2, 3, 4, 5].map(i => '<button type="button" class="' + (z === String(i) ? 'on' : '') + '" data-v="' + i + '">Zona ' + i + (String(i) === J.zona ? ' (dipakai)' : '') + '</button>').join('') + '</div></div>' +
    table([{ t: 'No', f: r => r.no, cls: 'c' }, { t: 'Mutu Beton', f: r => '<b>' + esc(r.m) + '</b>', raw: true }, { t: 'fc (MPa)', f: r => r.fc == null || r.fc === '' ? '-' : num(r.fc), num: true },
    { t: 'Semen (Kg)', f: r => '<b>' + num(jmN(r.semen) * V) + '</b><br>' + sm(num(jmN(r.semen) * V / 50) + ' zak'), num: true, raw: true },
    { t: 'Split 10/20 (Kg)', f: r => kgm(r.s1, J.bj.s1), num: true, raw: true }, { t: 'Split 20/30 (Kg)', f: r => kgm(r.s2, J.bj.s2), num: true, raw: true },
    { t: 'Pasir (Kg)', f: r => kgm(r.pasir, J.bj.pasir), num: true, raw: true }, { t: 'Retarder (Liter)', f: r => n4(jmN(r.ret) * V), num: true },
    { t: 'Total Berat (Kg)', f: r => num(jmdKg(r) * V), num: true }, { t: 'HPP + Bunga', f: r => { if (z !== J.zona) return sm('zona tidak dipakai'); const c = jmHpp('CMP', r.m); return c ? '<b>' + rp(c.hpp * V) + '</b>' + (V !== 1 ? '<br>' + sm(rp(c.hpp) + ' / M3') : '') : '-'; }, num: true, raw: true }],
      rows.map((r, i) => Object.assign({ no: i + 1, id: r.m }, r)), { empty: 'Belum ada mutu beton.' }) + '</section>' + jmProd(s, 'CMP');
}
function frkHtml(s) {
  const F = frkData(), V = jmVol('SCP'), K = F.komp, M = frkMix(F, K.map(k => jmN(k) / 100 * V));
  const price = n => { const lp = latestPrice(n); const mi = minfo(n); return lp ? lp.harga : mi ? mi.harga : 0; };
  const bahan = FRK_BATU.reduce((a, n, i) => a + jmN(K[i]) / 100 * price(n), 0);
  const tot = [0, 1, 2].map(i => frkTot(F, i)), ok = t => Math.abs(t - 100) < 0.01, tk = K.reduce((a, b) => a + jmN(b), 0);
  const cell = (f, i) => '<b>' + num(f.p[i]) + '%</b><br>' + sm('BJ ' + n4(f.bj[i])) + (V !== 1 ? '<br>' + sm(num(f.p[i] / 100 * V) + ' t') : '');
  return '<div class="note">Dari batu yang masuk crusher dihasilkan beberapa fraksi (abu batu, pasir, split 1/1, split 1/2, split 2/3, ladu). Persentase hasil per jenis batu dan berat jenis lepas (Ton/M3) bisa diubah. Komposisi bahan baku dipakai rincian BUASO produk SCP (1 ton batu = 1 ton produk, sesuai sheet).</div>' + jmVolBar('SCP') +
    '<section class="card">' + jmHead('Jobmix SCP — Komposisi Bahan Baku untuk ' + num(V) + ' Ton Produk', 'SCP', F.doc, 'scp', '<button class="btn ghost sm" data-jmcalc>' + ic('scale') + 'Hitung hasil produksi</button>') +
    table([{ t: 'No', f: r => r.no, cls: 'c' }, { t: 'Bahan Baku', f: r => '<b>' + esc(r.n) + '</b>', raw: true }, { t: 'Komposisi (% berat)', f: r => pct(r.k / 100), num: true },
    { t: 'Kebutuhan (Ton)', f: r => n4(r.k / 100 * V), num: true }, { t: 'Berat Jenis (Ton/M3 lepas)', f: r => n4(r.bj), num: true }, { t: 'Kebutuhan (M3 lepas)', f: r => r.bj ? n4(r.k / 100 * V / r.bj) : '-', num: true },
    { t: 'Harga / Ton', f: r => rp(r.h), num: true }, { t: 'Biaya bahan', f: r => rp(r.k / 100 * V * r.h), num: true }],
      FRK_BATU.map((n, i) => ({ id: n, no: i + 1, n, k: jmN(K[i]), bj: F.bjBatu[i], h: price(n) })), {}) +
    '<div class="jmfoot"><span>Total komposisi <b class="' + (ok(tk) ? 'okt' : 'badt') + '">' + pct(tk / 100) + '</b></span><span>Biaya bahan (B) untuk ' + num(V) + ' Ton <b>' + rp(bahan * V) + '</b>' + (V !== 1 ? ' · ' + rp(bahan) + ' / Ton' : '') + '</span></div></section>' +
    '<section class="card"><div class="chead"><div>' + unitChip('SCP') + '<h3>Fraksi Hasil Produksi per Jenis Batu</h3></div><div class="cmeta">% berat dari batu · BJ = berat jenis lepas Ton/M3' + (V !== 1 ? ' · ton = hasil dari ' + num(V) + ' Ton batu jenis itu' : '') + '</div></div>' +
    '<div class="tbl"><table class="jmfr"><thead><tr><th>No</th><th>Fraksi Hasil</th>' + FRK_SH.map(n => '<th class="n">Batu ' + n + '</th>').join('') + '<th class="n">Campuran (' + FRK_SH.map((n, i) => num(K[i]) + '%').join(' / ') + ')</th><th class="n">Hasil ' + num(V) + ' Ton (Ton)</th><th class="n">Hasil (M3)</th></tr></thead><tbody>' +
    F.fr.map((f, j) => { const mix = M.rows[j]; return '<tr><td class="c">' + (j + 1) + '</td><td><b>' + esc(f.n) + '</b></td>' + [0, 1, 2].map(i => '<td class="n">' + cell(f, i) + '</td>').join('') +
      '<td class="n"><b>' + pct(mix.p) + '</b><br>' + sm('BJ ' + n4(mix.bj)) + '</td><td class="n">' + n4(mix.ton) + '</td><td class="n">' + n4(mix.m3) + '</td></tr>'; }).join('') +
    '</tbody><tfoot><tr><td></td><td>Total</td>' + tot.map(t => '<td class="n ' + (ok(t) ? 'okt' : 'badt') + '">' + num(t) + '%' + (ok(t) ? '' : '<br><small>harus 100%</small>') + '</td>').join('') +
    '<td class="n">' + pct(M.tot ? M.out / M.tot : 0) + '</td><td class="n">' + n4(M.out) + '</td><td class="n">' + n4(M.m3) + '</td></tr></tfoot></table></div>' +
    '<div class="note jmn">' + (F.doc ? 'Angka diubah oleh ' + esc(F.doc._by || '-') + '.' : 'Rata-rata campuran Bantak 50% + Andesit 50% = angka sheet (Jobmix Formula B). Rincian per jenis batu masih perkiraan awal — sesuaikan dengan hasil timbang/uji di basecamp lewat Ubah angka.') + '</div></section>' + jmProd(s, 'SCP');
}
function pcpHtml(s) {
  const P = pcpData(), V = jmVol('PCP'), J = jmdData();
  const rows = P.rows.map((r, i) => { const c = pcpCalc(r, P.par), m = jmdMutu(r.mutu); return Object.assign({ no: i + 1, id: pcpName(r), c, m }, r); }).filter(r => qOk(s, r.n, r.d, r.mutu, r.tul));
  const bm = (r, k, bj) => r.m ? '<b>' + num(jmN(r.m[k]) * r.c.beton * V) + '</b>' + (bj ? '<br>' + sm(n4(jmdM3(r.m[k], bj) * r.c.beton * V) + ' m³') : '') : '-';
  const name = r => '<b>' + esc(r.n) + '</b><br>' + sm(esc(r.d));
  return '<div class="note">Per produk precast (sheet PCP bagian D): volume beton netto, mutu beton, dan tulangan. Beton cor = volume netto × (1 + susut ' + num(P.par.susut) + '%); bahan beton mengikuti Jobmix CMP zona ' + esc(J.zona) +
    '. Besi beton = (volume × rasio + besi tambahan) × (1 + waste ' + num(P.par.waste) + '%); kawat bendrat = ' + n4(P.par.kb) + ' Kg/Kg besi + ' + n4(P.par.kw) + ' Kg/M2 wiremesh; oli cetakan ' + num(P.par.oli) + ' L/M2 cetakan.</div>' + jmVolBar('PCP') +
    '<section class="card">' + jmHead('Jobmix Beton PCP — untuk ' + num(V) + ' Pcs', 'PCP', P.doc, 'pcp') +
    table([{ t: 'No', f: r => r.no, cls: 'c' }, { t: 'Produk', f: name, raw: true }, { t: 'Mutu', f: r => r.mutu }, { t: 'Volume netto (M3)', f: r => n4(r.c.vol * V), num: true },
    { t: 'Beton cor (M3)', f: r => '<b>' + n4(r.c.beton * V) + '</b>', num: true, raw: true }, { t: 'Semen (Kg)', f: r => r.m ? '<b>' + num(jmN(r.m.semen) * r.c.beton * V) + '</b><br>' + sm(num(jmN(r.m.semen) * r.c.beton * V / 50) + ' zak') : '-', num: true, raw: true },
    { t: 'Split 10/20 (Kg)', f: r => bm(r, 's1', J.bj.s1), num: true, raw: true }, { t: 'Split 20/30 (Kg)', f: r => bm(r, 's2', J.bj.s2), num: true, raw: true }, { t: 'Pasir (Kg)', f: r => bm(r, 'pasir', J.bj.pasir), num: true, raw: true },
    { t: 'Oli cetakan (L)', f: r => n4(r.c.oli * V), num: true }, { t: 'Berat produk (Kg)', f: r => num(r.c.berat * V), num: true },
    { t: 'HPP + Bunga', f: r => { const c = jmHpp('PCP', r.id); return c ? '<b>' + rp(c.hpp * V) + '</b>' + (V !== 1 ? '<br>' + sm(rp(c.hpp) + ' / Pcs') : '') : '-'; }, num: true, raw: true }], rows, { empty: 'Tidak ada produk.' }) + '</section>' +
    '<section class="card"><div class="chead"><div>' + unitChip('PCP') + '<h3>Pembesian PCP — untuk ' + num(V) + ' Pcs</h3></div><div class="cmeta">Tulangan BjTS 420B / BjTP 280 SNI 2052:2017 · wiremesh SNI 07-0663-1995</div></div>' +
    table([{ t: 'No', f: r => r.no, cls: 'c' }, { t: 'Produk', f: name, raw: true }, { t: 'Jenis Tulangan', f: r => r.tul || '-' }, { t: 'Rasio besi (Kg/M3)', f: r => num(r.rasio), num: true }, { t: 'Besi tambahan (Kg/Pcs)', f: r => n4(r.tam), num: true },
    { t: 'Besi Beton (Kg)', f: r => '<b>' + n4(r.c.besi * V) + '</b>' + (r.c.vol ? '<br>' + sm(num(r.c.rasioRiil) + ' Kg/M3') : ''), num: true, raw: true }, { t: 'Wiremesh (M2)', f: r => n4(r.c.wm * V), num: true },
    { t: 'Kawat bendrat (Kg)', f: r => n4(r.c.kawat * V), num: true }, { t: 'Decking (Bh)', f: r => num(r.c.deck * V), num: true }, { t: 'Luas cetakan (M2)', f: r => n4(jmN(r.cet) * V), num: true }], rows, { empty: 'Tidak ada produk.' }) +
    '<div class="jmfoot"><span>Total untuk ' + num(V) + ' Pcs tiap produk — besi beton <b>' + num(rows.reduce((a, r) => a + r.c.besi * V, 0)) + ' Kg</b>, wiremesh <b>' + num(rows.reduce((a, r) => a + r.c.wm * V, 0)) + ' M2</b> (jumlah seluruh produk di daftar)</span></div></section>' + jmProd(s, 'PCP');
}
function jobmixHtml(s) {
  const v = jmView(s);
  return jmSeg(s) + (v.k === 'cmp' ? jmdHtml(s) : v.k === 'scp' ? frkHtml(s) : v.k === 'pcp' ? pcpHtml(s) : ampHtml(s));
}
function jobmixBind(el, s, fill) {
  const v = jmView(s);
  $$('[data-jv] button', el).forEach(b => b.onclick = () => { s.jv = b.dataset.v; jmSave({ jv: s.jv }); fill(true); });
  $$('[data-jz] button', el).forEach(b => b.onclick = () => { s.jz = b.dataset.v; fill(); });
  $$('[data-jmq] button', el).forEach(b => b.onclick = () => { jmSave({ vol: { [b.parentElement.dataset.jmq]: +b.dataset.v } }); fill(); });
  $$('[data-jmvol]', el).forEach(inp => {
    inp.onfocus = () => { inp.value = numPlain(inp.value); inp.select(); };
    const go = () => { const n = parseNum(inp.value); if (n > 0) { jmSave({ vol: { [inp.dataset.jmvol]: n } }); fill(); } else inp.value = nf3.format(jmVol(inp.dataset.jmvol)); };
    inp.onchange = go; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } };
  });
  $$('[data-jmedit]', el).forEach(b => b.onclick = () => ({ amp: ampForm, cmp: jmdForm, scp: frkForm, pcp: pcpForm })[b.dataset.jmedit](s));
  $$('[data-jmreset]', el).forEach(b => b.onclick = () => jmReset(b.dataset.jmreset));
  const c = $('[data-jmcalc]', el); if (c) c.onclick = () => frkCalc();
  const ap = $('[data-addprod]', el); if (ap) ap.onclick = () => jmfForm(v.u, null);
}
const JM_DOC = { amp: JMF_AMP_ID, cmp: JMD_ID, scp: FRK_ID, pcp: PCP_JM_ID };
const jmReset = gated('Komposisi Jobmix', async kind => {
  const id = JM_DOC[kind]; if (!get(id)) return;
  if (!(await confirmBox('Kembalikan ke acuan', 'Angka Jobmix ' + kind.toUpperCase() + ' basecamp ini dikembalikan ke acuan (sheet RAPU-BUASO / komposisi produk). Lanjutkan?', 'Kembalikan', false))) return;
  remove(id); toast('Jobmix ' + kind.toUpperCase() + ' dikembalikan ke acuan');
});

/* ================= form ubah (wajib kata sandi edit) ================= */
const ampForm = gated('Komposisi Jobmix AMP', () => {
  const A = ampData();
  const v = { rco: A.rco, rows: A.rows.map(r => Object.assign({ rco: '' }, r, { rco: r.rco != null && r.rco !== '' && jmN(r.rco) !== A.rco ? r.rco : '' })) };
  AMP_AGG.forEach(([c]) => v['bj_' + c] = A.bj[c]);
  openForm({
    title: 'Ubah Jobmix AMP', sub: 'Komposisi per 1 Ton hotmix. Agregat dalam M3, semen / aspal / asbuton / additive dalam Kg.', wide: true, value: v,
    fields: [{ k: 'rco', label: 'RCO burner (Liter / Ton)', type: 'num', third: true }].concat(AMP_AGG.map(([c, , t]) => ({ k: 'bj_' + c, label: 'BJ ' + t + ' (Ton/M3)', type: 'num', third: true }))).concat([
      { k: 'rows', label: 'JMF per 1 Ton hotmix', type: 'items', newRow: () => ({ n: '', jenis: 'Curah' }), cols: [{ k: 'n', label: 'Produk', w: '14%' }].concat(AMP_AGG.map(([c, , t]) => ({ k: c, label: t, num: true })))
        .concat([{ k: 'semen', label: 'Semen Kg', num: true }, { k: 'aspal', label: 'Aspal Kg', num: true }, { k: 'jenis', label: 'Jenis aspal', type: 'select', opts: ['Curah', 'Modifikasi'], w: '96px' }, { k: 'asb', label: 'Asbuton Kg', num: true }, { k: 'add', label: 'Additive Kg', num: true }, { k: 'rco', label: 'RCO L (kosong = umum)', num: true }]) },
      { k: 'info', type: 'html', html: () => '<div class="note">Produk dengan nama yang sama langsung memakai angka ini untuk HPP. Produk baru di sini tidak otomatis menjadi produk — tambahkan di daftar Produk &amp; BUASO AMP bila perlu.</div>' }]),
    onSave: x => {
      const rows = (x.rows || []).filter(r => String(r.n || '').trim()).map(r => { const o = { n: String(r.n).trim(), jenis: r.jenis === 'Modifikasi' ? 'Modifikasi' : 'Curah' }; AMP_AGG.forEach(([c]) => o[c] = jmN(r[c])); ['semen', 'aspal', 'asb', 'add'].forEach(c => o[c] = jmN(r[c])); if (r.rco !== '' && r.rco != null) o.rco = jmN(r.rco); return o; });
      if (!rows.length) { toast('Isi minimal satu produk', 'err'); return false; }
      const bj = {}; for (const [c, , t] of AMP_AGG) { bj[c] = jmN(x['bj_' + c]); if (!(bj[c] > 0)) { toast('Berat jenis ' + t + ' harus lebih dari 0', 'err'); return false; } }
      save('param', { jmf: 'AMP', rco: jmN(x.rco), bj, rows }, JMF_AMP_ID); toast('Jobmix AMP tersimpan');
    }
  });
});
const jmdForm = gated('Komposisi Jobmix CMP', s => {
  const J = jmdData(), z = {};
  [1, 2, 3, 4, 5].forEach(i => z[i] = J.zone(String(i)));
  const v = { zona: J.zona, _cur: J.zona, z, rows: z[J.zona], bjs1: J.bj.s1, bjs2: J.bj.s2, bjp: J.bj.pasir, bjsm: J.bj.semen };
  openForm({
    title: 'Ubah Jobmix CMP', sub: 'Komposisi per 1 M3 beton. Pilih zona gradasi pasir yang dipakai, lalu ubah angka tiap mutu (zona lain tetap tersimpan).', wide: true, value: v,
    fields: [
      { k: 'zona', label: 'Zona gradasi pasir dipakai HPP', type: 'seg', full: true, opts: [1, 2, 3, 4, 5].map(i => ({ v: String(i), t: 'Zona ' + i })), onChange: x => { x.z[x._cur] = x.rows; x._cur = x.zona; x.rows = x.z[x.zona]; } },
      { k: 'bjs1', label: 'BJ Split 10/20 (Ton/M3)', type: 'num', third: true, req: true }, { k: 'bjs2', label: 'BJ Split 20/30 (Ton/M3)', type: 'num', third: true, req: true },
      { k: 'bjp', label: 'BJ Pasir (Ton/M3)', type: 'num', third: true, req: true }, { k: 'bjsm', label: 'BJ Semen (Ton/M3, informasi)', type: 'num', third: true },
      { k: 'rows', label: 'Komposisi per 1 M3 — zona yang dipilih', type: 'items', newRow: () => ({ m: '', fc: '', semen: '', s1: '', s2: '', pasir: '', ret: '' }), cols: [
        { k: 'm', label: 'Mutu', w: '15%' }, { k: 'fc', label: 'fc (MPa)', num: true }, { k: 'semen', label: 'Semen (Kg)', num: true }, { k: 's1', label: 'Split 10/20 (Kg)', num: true },
        { k: 's2', label: 'Split 20/30 (Kg)', num: true }, { k: 'pasir', label: 'Pasir (Kg)', num: true }, { k: 'ret', label: 'Retarder (L)', num: true }, { k: 'tot', label: 'Total (Kg)', type: 'ro', f: r => num(jmdKg(r)) }] },
      { k: 'info', type: 'html', html: () => '<div class="note">Produk CMP dengan nama mutu yang sama (mis. K-300) langsung memakai angka ini untuk HPP, begitu juga beton di Jobmix PCP. Mutu baru di sini tidak otomatis menjadi produk.</div>' }
    ],
    onSave: x => {
      x.z[x._cur] = x.rows;
      const clean = a => (a || []).filter(r => String(r.m || '').trim()).map(r => ({ m: String(r.m).trim(), fc: r.fc === '' || r.fc == null ? null : jmN(r.fc), semen: jmN(r.semen), s1: jmN(r.s1), s2: jmN(r.s2), pasir: jmN(r.pasir), ret: jmN(r.ret) }));
      const zz = {}; Object.keys(x.z).forEach(k => zz[k] = clean(x.z[k]));
      if (!zz[x.zona].length) { toast('Isi minimal satu mutu beton', 'err'); return false; }
      if (!(jmN(x.bjs1) > 0 && jmN(x.bjs2) > 0 && jmN(x.bjp) > 0)) { toast('Berat jenis split dan pasir harus lebih dari 0', 'err'); return false; }
      save('param', { jmd: true, zona: x.zona, bj: { s1: jmN(x.bjs1), s2: jmN(x.bjs2), pasir: jmN(x.bjp), semen: jmN(x.bjsm) || JMD_BJ.semen }, z: zz }, JMD_ID);
      if (s) s.jz = x.zona; toast('Jobmix CMP tersimpan');
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
const pcpForm = gated('Komposisi Jobmix & Pembesian PCP', () => {
  const P = pcpData(), mutu = jmdData().rows.map(r => r.m);
  const v = Object.assign({ rows: P.rows }, P.par);
  openForm({
    title: 'Ubah Jobmix & Pembesian PCP', sub: 'Per 1 Pcs produk precast: mutu & volume beton, tulangan, decking dan luas cetakan', wide: true, value: v,
    fields: [
      { k: 'susut', label: 'Susut / waste beton (%)', type: 'num', third: true, suffix: '%' }, { k: 'waste', label: 'Waste besi beton (%)', type: 'num', third: true, suffix: '%' }, { k: 'bjb', label: 'Berat jenis beton bertulang (Kg/M3)', type: 'num', third: true },
      { k: 'kb', label: 'Kawat bendrat per Kg besi (Kg/Kg)', type: 'num', third: true }, { k: 'kw', label: 'Kawat bendrat per M2 wiremesh (Kg/M2)', type: 'num', third: true }, { k: 'oli', label: 'Oli cetakan (L/M2 cetakan)', type: 'num', third: true },
      { k: 'rows', label: 'Produk precast (per 1 Pcs)', type: 'items', newRow: () => ({ n: '', d: '', mutu: 'K-350', vol: '', tul: 'Besi beton', wm: 0, rasio: 0, tam: 0, deck: 0, cet: 0 }), cols: [
        { k: 'n', label: 'Produk', w: '11%' }, { k: 'd', label: 'Dimensi', w: '12%' }, { k: 'mutu', label: 'Mutu', type: 'select', opts: mutu, w: '92px' }, { k: 'vol', label: 'Vol netto M3', num: true },
        { k: 'tul', label: 'Tulangan', type: 'select', opts: PCP_TUL, w: '128px' }, { k: 'wm', label: 'Wiremesh M2', num: true }, { k: 'rasio', label: 'Rasio besi Kg/M3', num: true }, { k: 'tam', label: 'Besi tambahan Kg', num: true },
        { k: 'deck', label: 'Decking Bh', num: true }, { k: 'cet', label: 'Cetakan M2', num: true }, { k: 'besi', label: 'Besi total Kg', type: 'ro', f: r => n4(pcpCalc(r, v).besi) }] },
      { k: 'info', type: 'html', html: () => '<div class="note">Besi total = (volume × rasio + tambahan) × (1 + waste). Produk dengan nama + dimensi yang sama langsung memakai angka ini untuk HPP (beton, besi, wiremesh, kawat, decking, oli, dan biaya per M3).</div>' }
    ],
    onSave: x => {
      const rows = (x.rows || []).filter(r => String(r.n || '').trim()).map(r => ({ n: String(r.n).trim(), d: String(r.d || '').trim(), mutu: r.mutu || 'K-350', vol: jmN(r.vol), tul: PCP_TUL.includes(r.tul) ? r.tul : 'Besi beton', wm: jmN(r.wm), rasio: jmN(r.rasio), tam: jmN(r.tam), deck: jmN(r.deck), cet: jmN(r.cet) }));
      if (!rows.length) { toast('Isi minimal satu produk', 'err'); return false; }
      if (rows.some(r => !(r.vol > 0))) { toast('Volume beton tiap produk harus lebih dari 0', 'err'); return false; }
      const par = {}; Object.keys(PCP_PAR).forEach(k => par[k] = jmN(x[k]));
      save('param', { jmf: 'PCP', par, rows }, PCP_JM_ID); toast('Jobmix & Pembesian PCP tersimpan');
    }
  });
});
/* kalkulator SCP: batu masuk crusher per jenis → perkiraan hasil per fraksi (tidak disimpan, tanpa kata sandi) */
function frkCalc() {
  const F = frkData(), V = jmVol('SCP');
  openForm({
    title: 'Hitung Hasil Produksi SCP', sub: 'Masukkan tonase batu yang diproses — hasil per fraksi dihitung dari persen dan berat jenis Jobmix SCP', wide: true, saveLabel: 'Tutup',
    value: { t0: V * F.komp[0] / 100, t1: V * F.komp[1] / 100, t2: V * F.komp[2] / 100 },
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

/* ================= PDF (mengikuti volume yang dipilih) ================= */
async function jobmixReport(s) {
  const v = jmView(s), V = jmVol(v.u), sat = JM_SAT[v.u], volT = num(V) + ' ' + sat, C0 = { 0: { halign: 'center', cellWidth: 8 } };
  if (v.k === 'amp') {
    const A = ampData();
    const R = await pdfReport({ title: 'Jobmix AMP - Job Mix Formula Hotmix', sub: UNIT_NAME.AMP + ' · untuk ' + volT, orient: 'l', fname: 'Jobmix_AMP' });
    R.kv([['Volume', volT], ['RCO burner', N_(A.rco) + ' L/Ton'], ['BJ agregat (Ton/M3)', AMP_AGG.map(([c, , t]) => t + ' ' + num4(A.bj[c])).join(', ')], ['Sumber', A.doc ? 'Diubah ' + (A.doc._by || '-') + ' ' + tglJam(A.doc._at) : 'Komposisi produk (acuan sheet RAPU-BUASO)']]);
    R.table(['No', 'Produk'].concat(AMP_AGG.map(([, , t]) => t + ' (M3)')).concat(['Semen (Kg)', 'Aspal (Kg)', 'Jenis', 'Asbuton (Kg)', 'Additive (Kg)', 'RCO (L)', 'Berat (Ton)']),
      A.rows.map((r, i) => [i + 1, r.n].concat(AMP_AGG.map(([c]) => cellR(num4(jmN(r[c]) * V)))).concat([cellR(N_(jmN(r.semen) * V)), cellR(N_(jmN(r.aspal) * V)), r.jenis || 'Curah', cellR(N_(jmN(r.asb) * V)), cellR(num4(jmN(r.add) * V)), cellR(N_((r.rco != null && r.rco !== '' ? jmN(r.rco) : A.rco) * V)), cellR(num4(ampTon(r, A.bj) * V))])),
      { fs: 7.2, cs: C0 });
    R.sign(); await R.save(); return;
  }
  if (v.k === 'cmp') {
    const J = jmdData();
    const R = await pdfReport({ title: 'Jobmix CMP - Job Mix Design Readymix', sub: UNIT_NAME.CMP + ' · untuk ' + volT + ' · Zona ' + J.zona, orient: 'l', fname: 'Jobmix_CMP' });
    R.kv([['Volume', volT], ['Zona gradasi pasir dipakai', 'Zona ' + J.zona], ['BJ Split 10/20 / 20/30', N_(J.bj.s1) + ' / ' + N_(J.bj.s2) + ' Ton/M3'], ['BJ Pasir', N_(J.bj.pasir) + ' Ton/M3'], ['Sumber', J.doc ? 'Diubah ' + (J.doc._by || '-') + ' ' + tglJam(J.doc._at) : 'Acuan sheet RAPU-BUASO']]);
    R.table(['No', 'Mutu', 'fc (MPa)', 'Semen (Kg)', 'Semen (Zak)', 'Split 10/20 (Kg)', 'Split 10/20 (M3)', 'Split 20/30 (Kg)', 'Split 20/30 (M3)', 'Pasir (Kg)', 'Pasir (M3)', 'Retarder (L)', 'Total (Kg)'],
      J.rows.map((r, i) => [i + 1, r.m, r.fc == null || r.fc === '' ? '-' : N_(r.fc), cellR(N_(jmN(r.semen) * V)), cellR(N_(jmN(r.semen) * V / 50)), cellR(N_(jmN(r.s1) * V)), cellR(num4(jmdM3(r.s1, J.bj.s1) * V)), cellR(N_(jmN(r.s2) * V)), cellR(num4(jmdM3(r.s2, J.bj.s2) * V)), cellR(N_(jmN(r.pasir) * V)), cellR(num4(jmdM3(r.pasir, J.bj.pasir) * V)), cellR(num4(jmN(r.ret) * V)), cellR(N_(jmdKg(r) * V))]),
      { fs: 7.4, cs: C0 });
    R.para('Split 10/20 = material Split 1/2, Split 20/30 = Split 2/3. Kebutuhan M3 = kg / 1.000 / berat jenis lepas.');
    R.sign(); await R.save(); return;
  }
  if (v.k === 'scp') {
    const F = frkData(), M = frkMix(F, F.komp.map(k => jmN(k) / 100 * V));
    const R = await pdfReport({ title: 'Jobmix SCP - Komposisi & Fraksi Hasil Produksi', sub: UNIT_NAME.SCP + ' · untuk ' + volT, orient: 'l', fname: 'Jobmix_SCP' });
    R.h2('A. Komposisi bahan baku untuk ' + volT + ' produk');
    R.table(['No', 'Bahan Baku', 'Komposisi (% berat)', 'Kebutuhan (Ton)', 'BJ (Ton/M3 lepas)', 'Kebutuhan (M3 lepas)'], FRK_BATU.map((n, i) => [i + 1, n, cellR(N_(F.komp[i]) + '%'), cellR(num4(F.komp[i] / 100 * V)), cellR(num4(F.bjBatu[i])), cellR(F.bjBatu[i] ? num4(F.komp[i] / 100 * V / F.bjBatu[i]) : '-')]),
      { foot: ['', 'Total', cellR(N_(F.komp.reduce((a, b) => a + jmN(b), 0)) + '%'), cellR(num4(V)), '', ''], cs: C0 });
    R.h2('B. Fraksi hasil produksi per jenis batu');
    R.table(['No', 'Fraksi', 'Bantak %', 'Bantak BJ', 'Andesit %', 'Andesit BJ', 'Blondos %', 'Blondos BJ', 'Campuran %', 'BJ Campuran', 'Hasil (Ton)', 'Hasil (M3)'],
      F.fr.map((f, j) => [j + 1, f.n, cellR(N_(f.p[0]) + '%'), cellR(num4(f.bj[0])), cellR(N_(f.p[1]) + '%'), cellR(num4(f.bj[1])), cellR(N_(f.p[2]) + '%'), cellR(num4(f.bj[2])), cellR(N_(M.rows[j].p * 100) + '%'), cellR(num4(M.rows[j].bj)), cellR(num4(M.rows[j].ton)), cellR(num4(M.rows[j].m3))]),
      { foot: ['', 'Total', cellR(N_(frkTot(F, 0)) + '%'), '', cellR(N_(frkTot(F, 1)) + '%'), '', cellR(N_(frkTot(F, 2)) + '%'), '', cellR(N_(M.tot ? M.out / M.tot * 100 : 0) + '%'), '', cellR(num4(M.out)), cellR(num4(M.m3))], cs: C0 });
    R.para('Sumber: ' + (F.doc ? 'diubah ' + (F.doc._by || '-') + ' ' + tglJam(F.doc._at) : 'acuan sheet RAPU-BUASO (Jobmix Formula A & B); rincian per jenis batu = perkiraan awal') + '.');
    R.sign(); await R.save(); return;
  }
  if (v.k === 'pcp') {
    const P = pcpData(), J = jmdData();
    const rows = P.rows.map(r => ({ r, c: pcpCalc(r, P.par), m: jmdMutu(r.mutu) }));
    const R = await pdfReport({ title: 'Jobmix & Pembesian PCP', sub: UNIT_NAME.PCP + ' · untuk ' + volT + ' per produk', orient: 'l', fname: 'Jobmix_Pembesian_PCP' });
    R.kv([['Volume', volT + ' per produk'], ['Susut beton / waste besi', N_(P.par.susut) + '% / ' + N_(P.par.waste) + '%'], ['Kawat bendrat', N_(P.par.kb) + ' Kg/Kg besi + ' + N_(P.par.kw) + ' Kg/M2 wiremesh'], ['Bahan beton', 'Jobmix CMP zona ' + J.zona]]);
    R.h2('A. Jobmix beton');
    R.table(['No', 'Produk', 'Dimensi', 'Mutu', 'Vol netto (M3)', 'Beton cor (M3)', 'Semen (Kg)', 'Split 10/20 (Kg)', 'Split 20/30 (Kg)', 'Pasir (Kg)', 'Oli (L)', 'Berat (Kg)'],
      rows.map(({ r, c, m }, i) => [i + 1, r.n, r.d, r.mutu, cellR(num4(c.vol * V)), cellR(num4(c.beton * V)), cellR(m ? N_(m.semen * c.beton * V) : '-'), cellR(m ? N_(m.s1 * c.beton * V) : '-'), cellR(m ? N_(m.s2 * c.beton * V) : '-'), cellR(m ? N_(m.pasir * c.beton * V) : '-'), cellR(num4(c.oli * V)), cellR(N_(c.berat * V))]), { fs: 7.2, cs: C0 });
    R.h2('B. Pembesian');
    R.table(['No', 'Produk', 'Dimensi', 'Tulangan', 'Rasio (Kg/M3)', 'Tambahan (Kg/Pcs)', 'Besi beton (Kg)', 'Wiremesh (M2)', 'Kawat (Kg)', 'Decking (Bh)', 'Cetakan (M2)'],
      rows.map(({ r, c }, i) => [i + 1, r.n, r.d, r.tul, cellR(N_(r.rasio)), cellR(num4(r.tam)), cellR(num4(c.besi * V)), cellR(num4(c.wm * V)), cellR(num4(c.kawat * V)), cellR(N_(c.deck * V)), cellR(num4(jmN(r.cet) * V))]), { fs: 7.2, cs: C0 });
    R.sign(); await R.save(); return;
  }
  return prodReport(s);
}
