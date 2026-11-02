/* Dependency-free PDF writer. Embeds one rendered JPEG per PDF page. */
(() => {
  'use strict';
  function writePdf(images) {
    if (!Array.isArray(images) || !images.length) throw new Error('No pages to export');
    const encoder = new TextEncoder();
    const parts = []; let offset = 0;
    const offsets = [0];
    const add = data => { const bytes = typeof data === 'string' ? encoder.encode(data) : data; parts.push(bytes); offset += bytes.byteLength; };
    const object = (id, body) => { offsets[id] = offset; add(`${id} 0 obj\n`); if (Array.isArray(body)) body.forEach(add); else add(body); add('\nendobj\n'); };
    add('%PDF-1.4\n%WiNDS Notes PDF\n');
    const kids = images.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, `<< /Type /Pages /Kids [ ${kids} ] /Count ${images.length} >>`);
    images.forEach((im, i) => {
      const pageId = 3 + i * 3, imageId = pageId + 1, contentId = pageId + 2;
      const w = 595.28, h = 841.89;
      object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      object(imageId, [`<< /Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`, im.bytes, '\nendstream']);
      const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`;
      object(contentId, [`<< /Length ${encoder.encode(content).length} >>\nstream\n`, content, 'endstream']);
    });
    const xrefAt = offset;
    add(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
    for (let i = 1; i < offsets.length; i++) add(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
    add(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);
    return new Blob(parts, {type:'application/pdf'});
  }
  function dataUrlToBytes(dataUrl) {
    const raw = atob(dataUrl.split(',')[1]);
    const bytes = new Uint8Array(raw.length);
    for (let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
    return bytes;
  }
  window.WindsPDF = { writePdf, dataUrlToBytes };
})();
