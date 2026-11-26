/* Basecamp Bawen — mesin laporan PDF (kop berlogo, tabel, ringkasan, tanda tangan). */
'use strict';
const PDFX = { logo: null, ratio: 564 / 443 };
async function pdfLogo() {
  if (PDFX.logo) return PDFX.logo;
  const b = await (await fetch('assets/logo.png')).blob();
  PDFX.logo = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
  return PDFX.logo;
}
const NAVY = [20, 54, 95], RED = [198, 40, 40], INK = [28, 36, 51], MUTED = [96, 108, 124], LINE = [214, 221, 230];
function pdfClean(s) { return String(s ?? '').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, c => ({ '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '≥': '>=', '≤': '<=', '·': '-' }[c] ?? '')); }

async function pdfReport({ title, sub, orient = 'p', fname, format = 'a4' }) {
  if (!window.jspdf) { toast('Pustaka PDF belum termuat, periksa koneksi internet', 'err'); throw new Error('nopdf'); }
  const logo = await pdfLogo();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: orient, unit: 'mm', format, compress: true });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 14, TOP = 34, BOT = 16;
  let y = TOP + 2;
  // judul halaman pertama
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...NAVY);
  doc.splitTextToSize(pdfClean(title).toUpperCase(), W - 2 * M).forEach((t, k) => { doc.text(t, W / 2, y + 5, { align: 'center' }); y += 6; });
  y += 4;
  if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.splitTextToSize(pdfClean(sub), W - 2 * M).forEach(t => { doc.text(t, W / 2, y, { align: 'center' }); y += 4.2; }); }
  y += 3;
  const R = {
    doc, W, H, M,
    get y() { return y; }, set y(v) { y = v; },
    need(h) { if (y + h > H - BOT - 2) { doc.addPage(); y = TOP + 2; } },
    h2(t, note) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      const nw = note ? Math.min(doc.getTextWidth(pdfClean(note)), (W - 2 * M) * 0.4) : 0;
      const nl = note ? doc.splitTextToSize(pdfClean(note), nw + 0.5) : [];
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
      const tl = doc.splitTextToSize(pdfClean(t), W - 2 * M - 3.5 - (nw ? nw + 6 : 0));
      const hh = Math.max(tl.length * 4.6, nl.length * 3.6);
      R.need(hh + 26); // judul tidak boleh terpisah dari kepala tabel di bawahnya
      y += 2;
      doc.setFillColor(...NAVY); doc.rect(M, y - 3.6, 1.4, 5 + (tl.length - 1) * 4.6, 'F');
      doc.setTextColor(...NAVY); tl.forEach((s, i) => doc.text(s, M + 3.5, y + i * 4.6));
      if (nl.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED); nl.forEach((s, i) => doc.text(s, W - M, y + i * 3.6, { align: 'right' })); }
      y += hh + 0.5;
    },
    kv(pairs, cols) {
      cols = cols || Math.min(4, pairs.length);
      const gap = 3, bw = (W - 2 * M - gap * (cols - 1)) / cols;
      for (let i = 0; i < pairs.length; i += cols) {
        const row = pairs.slice(i, i + cols).map(([k, v, tone]) => {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); const kl = doc.splitTextToSize(pdfClean(k).toUpperCase(), bw - 6);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); const vl = doc.splitTextToSize(pdfClean(v), bw - 6);
          return { kl, vl, tone };
        });
        const bh = Math.max(...row.map(r => 3.4 + r.kl.length * 3 + 1.4 + r.vl.length * 4.2 + 1.6));
        R.need(bh + 3);
        row.forEach((r, j) => {
          const x = M + j * (bw + gap);
          doc.setDrawColor(...LINE); doc.setFillColor(247, 249, 252); doc.roundedRect(x, y, bw, bh, 1.2, 1.2, 'FD');
          doc.setFillColor(...(r.tone === 'red' ? RED : NAVY)); doc.rect(x, y, 1, bh, 'F');
          let yy = y + 4.6;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(...MUTED); r.kl.forEach(t => { doc.text(t, x + 3.5, yy); yy += 3; });
          yy += 2.6;
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...(r.tone === 'red' ? RED : INK)); r.vl.forEach(t => { doc.text(t, x + 3.5, yy); yy += 4.2; });
        });
        y += bh + 3;
      }
      y += 1;
    },
    info(pairs, cols = 2) {
      const colW = (W - 2 * M) / cols;
      doc.setFontSize(8.6);
      for (let i = 0; i < pairs.length; i += cols) {
        R.need(6);
        let hmax = 5;
        pairs.slice(i, i + cols).forEach(([k, v], j) => {
          const x = M + j * colW;
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); doc.text(pdfClean(k), x, y);
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
          const lines = doc.splitTextToSize(pdfClean(v || '-'), colW - 36);
          doc.text(lines, x + 33, y); hmax = Math.max(hmax, lines.length * 4 + 1.2);
        });
        y += hmax;
      }
      y += 2;
    },
    para(t, size = 8.6) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...INK);
      doc.splitTextToSize(pdfClean(t), W - 2 * M).forEach(l => { R.need(5); doc.text(l, M, y); y += size * 0.45; });
      y += 2;
    },
    table(head, body, o = {}) {
      R.need(22);
      doc.autoTable({
        rowPageBreak: 'avoid', showHead: 'everyPage', pageBreak: 'auto', tableWidth: 'auto',
        startY: y, head: [head.map(pdfClean)], body: body.map(r => r.map(c => typeof c === 'object' && c !== null && !Array.isArray(c) ? Object.assign({}, c, { content: pdfClean(c.content) }) : pdfClean(c))),
        foot: o.foot ? [o.foot.map(c => typeof c === 'object' && c !== null ? Object.assign({}, c, { content: pdfClean(c.content) }) : pdfClean(c))] : undefined,
        showFoot: 'lastPage', theme: 'grid', margin: { left: M, right: M, top: TOP + 2, bottom: BOT + 2 },
        styles: { font: 'helvetica', fontSize: o.fs || 7.8, cellPadding: 1.6, lineColor: LINE, lineWidth: 0.15, textColor: INK, valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: (o.fs || 7.8) - 0.2 },
        footStyles: { fillColor: [232, 237, 244], textColor: INK, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [246, 248, 251] },
        columnStyles: o.cs || {},
        didParseCell: o.didParseCell
      });
      y = doc.lastAutoTable.finalY + 5;
    },
    sign(list) {
      list = list || [['Dibuat oleh', S.user ? S.user.name : ''], ['Diperiksa oleh', ''], ['Disetujui oleh', '']];
      const cw = (W - 2 * M) / list.length, half = Math.min(22, cw / 2 - 3);
      doc.setFontSize(8.6);
      const rl = list.map(([role]) => doc.splitTextToSize(pdfClean(role), cw - 4));
      const extra = (Math.max(...rl.map(r => r.length)) - 1) * 3.8;
      R.need(36 + extra);
      y += 2;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...INK);
      doc.text((CFG.all ? '' : BCN + ', ') + pdfClean(tgl(today(), true)), W - M, y, { align: 'right' });
      y += 5;
      list.forEach(([role, name], i) => {
        const cx = M + cw * i + cw / 2;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); rl[i].forEach((t, k) => doc.text(t, cx, y + k * 3.8, { align: 'center' }));
        doc.setDrawColor(...INK); doc.setLineWidth(0.2); doc.line(cx - half, y + 20 + extra, cx + half, y + 20 + extra);
        if (name) { doc.setFont('helvetica', 'bold'); const nm = doc.splitTextToSize(pdfClean(name), half * 2); doc.setFontSize(nm.length > 1 ? 7.4 : 8.6); doc.text(doc.splitTextToSize(pdfClean(name), half * 2), cx, y + 18.6 + extra - (nm.length > 1 ? 3 : 0), { align: 'center' }); }
      });
      y += 26 + extra;
    },
    async save() {
      const n = doc.getNumberOfPages();
      for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        const lw = 22, lh = lw / PDFX.ratio;
        doc.addImage(logo, 'PNG', M, 7, lw, lh, 'logo', 'FAST');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13.5); doc.setTextColor(...NAVY);
        doc.text('PT. ARMADA HADA GRAHA', M + lw + 4, 13);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(...INK);
        doc.text((CFG.all ? 'Semua Basecamp' : BC) + '  |  Unit Produksi AMP - CMP - SCP - PCP', M + lw + 4, 18);
        doc.setFontSize(7.6); doc.setTextColor(...MUTED);
        doc.text('Trust and Integrity', M + lw + 4, 22.4);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.6);
        const leftEnd = M + lw + 4 + doc.getTextWidth((CFG.all ? 'Semua Basecamp' : BC) + '  |  Unit Produksi AMP - CMP - SCP - PCP');
        const rw = W - M - leftEnd - 8;
        let fs = 8, tl;
        doc.setFont('helvetica', 'bold');
        do { doc.setFontSize(fs); tl = doc.splitTextToSize(pdfClean(title).toUpperCase(), rw); fs -= 0.5; } while (tl.length > 3 && fs > 5.5);
        doc.setTextColor(...NAVY);
        tl.forEach((t, k) => doc.text(t, W - M, 12 + k * (fs + 0.5) * 0.42, { align: 'right' }));
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
        doc.setDrawColor(...NAVY); doc.setLineWidth(0.8); doc.line(M, 27.5, W - M, 27.5);
        doc.setDrawColor(...RED); doc.setLineWidth(0.35); doc.line(M, 28.9, W - M, 28.9);
        doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, H - 11, W - M, H - 11);
        doc.setFontSize(7); doc.setTextColor(...MUTED);
        doc.text(pdfClean('Dicetak oleh ' + (S.user ? S.user.name : '-') + ' pada ' + tglJam(Date.now())), M, H - 7);
        doc.text('Sistem Informasi Produksi ' + (CFG.all ? 'Semua Basecamp' : BC), W / 2, H - 7, { align: 'center' });
        doc.text('Halaman ' + i + ' dari ' + n, W - M, H - 7, { align: 'right' });
      }
      const name = (fname || title).replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_') + '_' + today() + '.pdf';
      doc.save(name);
      toast('Laporan PDF dibuat: ' + name);
    }
  };
  return R;
}
const R_ = n => nf0.format(Math.round(+n || 0));
const N_ = n => nf2.format(+n || 0);
const right = { halign: 'right' }, center = { halign: 'center' };
const cellR = v => ({ content: v, styles: right });
async function runReport(fn) { try { await fn(); } catch (e) { if (e.message !== 'nopdf') { console.error(e); toast('Gagal membuat PDF: ' + e.message, 'err'); } } }
