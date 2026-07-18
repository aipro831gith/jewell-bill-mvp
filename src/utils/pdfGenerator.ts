import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFImage } from 'pdf-lib';
import type { Invoice, BusinessProfile } from '../db/database';

function numberToWords(num: number): string {
  if (num === 0) return 'Zero Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const numStr = Math.floor(num).toString();
  if (numStr.length > 11) return 'Amount too large';
  const nStr = ('00000000000' + numStr).slice(-11);
  const n = nStr.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Hundred ' : '';
  if (Number(n[1]) !== 0 || Number(n[2]) !== 0) {
    const crorePart = a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])];
    str += crorePart + 'Crore ';
  }
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Lakh ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Thousand ' : '';
  str += (Number(n[5]) !== 0) ? (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) + 'Hundred ' : '';
  str += (Number(n[6]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[6])] || b[Number(n[6][0])] + ' ' + a[Number(n[6][1])]) : '';
  return 'Rupees ' + str.trim() + ' Only';
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? rgb(
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ) : rgb(0,0,0);
}

const mm = (val: number) => val * 2.83465;

export async function generateAndDownloadPDF(invoice: Invoice, profile: BusinessProfile) {
  const pdfDoc = await PDFDocument.create();
  
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const helveticaBoldOblique = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  const numPages = 3;
  const isChallan = invoice.type === 'DELIVERY_CHALLAN';

  const invoiceDateStr = new Date(invoice.date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).toUpperCase().replace(/ /g, '-');
  
  const financialYear = (() => {
    const d = new Date(invoice.date);
    const m = d.getMonth();
    const y = d.getFullYear();
    if (m < 3) return `${y-1}-${y.toString().slice(-2)}`;
    return `${y}-${(y+1).toString().slice(-2)}`;
  })();

  const templateId = profile.templateId || 1;

  // Embed brand logo
  let logoImage: PDFImage | null = null;
  if (profile.logoData) {
    try {
      const base64Data = profile.logoData.split(',')[1];
      const logoBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      if (profile.logoData.startsWith('data:image/png')) {
         logoImage = await pdfDoc.embedPng(logoBytes);
      } else {
         logoImage = await pdfDoc.embedJpg(logoBytes);
      }
    } catch (e) {
      console.error('Could not embed logo', e);
    }
  }

  for (let i = 1; i <= numPages; i++) {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 210x297mm
    const { width, height } = page.getSize();

    let copyLabel = '';
    if (isChallan) {
      if (i === 1) copyLabel = 'ORIGINAL FOR CONSIGNEE';
      else if (i === 2) copyLabel = 'DUPLICATE FOR TRANSPORTER';
      else copyLabel = 'TRIPLICATE FOR CONSIGNOR';
    } else {
      if (i === 1) copyLabel = 'ORIGINAL FOR RECIPIENT';
      else if (i === 2) copyLabel = 'DUPLICATE FOR TRANSPORTER';
      else copyLabel = 'TRIPLICATE FOR SUPPLIER';
    }
    
    if (templateId === 1) {
      await renderTemplate1(page, width, height, invoice, profile, copyLabel, helveticaFont, helveticaBold, helveticaOblique, helveticaBoldOblique, logoImage, invoiceDateStr);
    } else {
      await renderTemplate2(page, width, height, invoice, profile, copyLabel, helveticaFont, helveticaBold, helveticaOblique, helveticaBoldOblique, logoImage, invoiceDateStr, financialYear);
    }
  }

  const pdfBytes = await pdfDoc.save();
  
  if (typeof window !== 'undefined') {
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `${invoice.type === 'TAX_INVOICE' ? 'Tax_Invoice' : 'Delivery_Challan'}_${invoice.customerDetails.partyName.replace(/[^a-z0-9]/gi, '_')}_${invoice.invoiceId.replace(/\//g, '_')}.pdf`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 15000);
  }
  
  return pdfBytes;
}

// -------------------------------------------------------------
// TEMPLATE 1: G. AGARWAL CHAIN STYLE REPLICA (Exact Vector)
// -------------------------------------------------------------
async function renderTemplate1(
  page: PDFPage, width: number, height: number, 
  invoice: Invoice, profile: BusinessProfile, copyLabel: string, 
  _font: PDFFont, bold: PDFFont, oblique: PDFFont, boldOblique: PDFFont, 
  logoImage: PDFImage | null, invoiceDateStr: string
) {
  const y = (valMm: number) => height - mm(valMm);
  const x = (valMm: number) => mm(valMm);

  // Muted Professional Colors (replaced magenta/cyan/yellow per user approval)
  const colors = {
    headerBand: hexToRgb('#e2e8f0'), // slate-200
    totalAmount: hexToRgb('#f8fafc'), // slate-50
    cgstSgst: hexToRgb('#f1f5f9'), // slate-100
    igst: hexToRgb('#f1f5f9'), // slate-100
    roundOff: hexToRgb('#e2e8f0'), // slate-200
    grandTotal: hexToRgb('#cbd5e1'), // slate-300
    paymentMode: hexToRgb('#334155'), // slate-700
    text: rgb(0,0,0),
    paymentText: rgb(1,1,1)
  };

  // Section 2.1: Colored boxes / fills
  page.drawRectangle({ x: x(27.0), y: y(116.2), width: mm(156.0), height: mm(14.0), color: colors.headerBand, borderColor: rgb(0,0,0), borderWidth: 1 });
  
  // Payment mode header bar
  page.drawRectangle({ x: x(27.0), y: y(226.9), width: mm(75.9), height: mm(4.8), color: colors.paymentMode, borderColor: rgb(0,0,0), borderWidth: 1 });

  // Section 2.2: Text elements
  page.drawText('TAX INVOICE', { x: x(94.1), y: y(19.7), size: 7.5, font: boldOblique, color: colors.text });
  page.drawText(copyLabel, { x: x(89.1), y: y(23.6), size: 7.5, font: boldOblique, color: colors.text });

  page.drawText(`GSTIN: ${profile.gstin}`, { x: x(40.9), y: y(30.3), size: 9, font: bold, color: colors.text });
  const invNoText = `INVOICE NO: ${invoice.invoiceId}`;
  page.drawText(invNoText, { x: x(120), y: y(30.3), size: 9, font: bold, color: colors.text }); // Placed aligned to right side block

  page.drawText(`PAN NO: ${profile.pan}`, { x: x(41.8), y: y(34.8), size: 9, font: bold, color: colors.text });
  page.drawText(`DATE: ${invoiceDateStr}`, { x: x(120), y: y(34.8), size: 9, font: bold, color: colors.text });

  // Logo (if any) placed centrally above the brand name
  if (logoImage) {
     const maxW = mm(50);
     const maxH = mm(13.5);
     const ratio = Math.min(maxW / logoImage.width, maxH / logoImage.height);
     const dims = { width: logoImage.width * ratio, height: logoImage.height * ratio };
     // Position bottom of logo at y(49.5) so it doesn't touch the brand name at y(50.7)
     page.drawImage(logoImage, { x: (width - dims.width) / 2, y: y(49.5), width: dims.width, height: dims.height });
  }

  const brandName = invoice.isSwappedAddress ? invoice.customerDetails.partyName.toUpperCase() : profile.brandName.toUpperCase();
  const brandW = bold.widthOfTextAtSize(brandName, 14.5);
  page.drawText(brandName, { x: (width - brandW) / 2, y: y(50.7), size: 14.5, font: bold, color: colors.text });
  
  const profileZip = profile.zipCode ? ` - ${profile.zipCode}` : '';
  const custZip = invoice.customerDetails.zipCode ? ` - ${invoice.customerDetails.zipCode}` : '';
  const addressText = invoice.isSwappedAddress 
    ? `${invoice.customerDetails.address || ''}, ${invoice.customerDetails.city || ''}${custZip}` 
    : `${profile.address}, ${profile.city}${profileZip}`;
  const addressW = oblique.widthOfTextAtSize(addressText, 9.5);
  page.drawText(addressText, { x: (width - addressW) / 2, y: y(57.2), size: 9.5, font: oblique, color: colors.text });

  const contactText = invoice.isSwappedAddress ? `CONTACT NO: ${invoice.customerDetails.phone}` : `CONTACT NO: ${profile.phone}`;
  const contactW = bold.widthOfTextAtSize(contactText, 9.5);
  page.drawText(contactText, { x: (width - contactW) / 2, y: y(61.8), size: 9.5, font: bold, color: colors.text });

  if (!invoice.isSwappedAddress && profile.email) {
    const emailText = `EMAIL ID: ${profile.email}`;
    const emailW = bold.widthOfTextAtSize(emailText, 9.5);
    page.drawText(emailText, { x: (width - emailW) / 2, y: y(66.4), size: 9.5, font: bold, color: colors.text });
  }

  // Buyer Details Section
  page.drawRectangle({ x: x(27.0), y: y(99.0), width: mm(156.0), height: mm(25.2), borderColor: rgb(0,0,0), borderWidth: 1 });
  
  const buyerTitle = 'BUYER DETAILS';
  const btW = boldOblique.widthOfTextAtSize(buyerTitle, 12.5);
  page.drawText(buyerTitle, { x: (width - btW) / 2, y: y(73.8), size: 12.5, font: boldOblique, color: colors.text });
  page.drawLine({ start: { x: (width - btW) / 2, y: y(74.5) }, end: { x: (width + btW) / 2, y: y(74.5) }, thickness: 1, color: rgb(0,0,0) });

  const rName = invoice.isSwappedAddress ? profile.legalName : invoice.customerDetails.partyName;
  const rAddress = invoice.isSwappedAddress ? profile.address : invoice.customerDetails.address;
  const rCityRaw = invoice.isSwappedAddress ? profile.city : invoice.customerDetails.city;
  const rZip = invoice.isSwappedAddress ? profile.zipCode : invoice.customerDetails.zipCode;
  const rCity = rZip ? `${rCityRaw} - ${rZip}` : rCityRaw;
  const rPhone = invoice.isSwappedAddress ? profile.phone : invoice.customerDetails.phone;
  const rGstin = invoice.isSwappedAddress ? profile.gstin : invoice.customerDetails.gstin;
  const rPan = invoice.isSwappedAddress ? profile.pan : invoice.customerDetails.panAadhaar;
  const rState = invoice.isSwappedAddress ? profile.stateName : invoice.customerDetails.stateName;
  const rStateCode = invoice.isSwappedAddress ? profile.stateCode : invoice.customerDetails.stateCode;
  const rIdType = invoice.isSwappedAddress ? 'PAN NO' : (invoice.customerDetails.idType === 'AADHAAR' ? 'AADHAAR NO' : 'PAN NO');

  page.drawText(`NAME: ${rName}`, { x: x(40.9), y: y(79.8), size: 10, font: bold, color: colors.text });
  if (invoice.isShippingDifferent) {
    page.drawText(`BILL TO: ${rAddress}, ${rCity}`, { x: x(40.9), y: y(84.9), size: 9, font: bold, color: colors.text });
    const sCityRaw = invoice.customerDetails.shippingCity ? `, ${invoice.customerDetails.shippingCity}` : '';
    const sZip = invoice.customerDetails.shippingZipCode ? ` - ${invoice.customerDetails.shippingZipCode}` : '';
    page.drawText(`SHIP TO: ${invoice.customerDetails.shippingAddress}${sCityRaw}${sZip}`, { x: x(40.9), y: y(90.6), size: 9, font: bold, color: colors.text });
  } else {
    page.drawText(`ADDRESS: ${rAddress}, ${rCity}`, { x: x(40.9), y: y(84.9), size: 9.5, font: bold, color: colors.text });
  }
  page.drawText(`CONTACT NO: ${rPhone}`, { x: x(40.9), y: y(95.5), size: 10, font: bold, color: colors.text });

  // Right side buyer details
  const drawR = (txt: string, yPosMm: number) => {
    page.drawText(txt, { x: x(183.0) - mm(2) - bold.widthOfTextAtSize(txt, 10), y: y(yPosMm), size: 10, font: bold, color: colors.text });
  };
  drawR(`GSTIN: ${rGstin}`, 79.8);
  drawR(`${rIdType}: ${rPan}`, 84.9);
  drawR(`STATE: ${rState}`, 90.6);
  drawR(`STATE CODE: ${rStateCode}`, 95.5);

  const showPurityColumn = invoice.items.length > 0 && invoice.items.every((item: any) => item.purityValue && item.purityValue !== 'None');

  // Responsive Table columns
  const cols: any[] = [
    { label: 'Serial\nNo', x: 27.0, w: 15 },
  ];
  if (showPurityColumn) {
    cols.push(
      { label: 'Description of Goods', x: 42.0, w: 55 },
      { label: 'Purity', x: 97.0, w: 15, center: true }
    );
  } else {
    cols.push({ label: 'Description of Goods', x: 42.0, w: 70 });
  }
  cols.push(
    { label: 'HSN/SAC\nCode', x: 112.0, w: 20, center: true },
    { label: 'Weight\n(Gm)', x: 132.0, w: 16, center: true },
    { label: 'Rate/Gram\n(Rs)', x: 148.0, w: 17, center: true },
    { label: 'Amount (Rs)', x: 165.0, w: 18, center: true }
  );

  // Draw Header Labels
  cols.forEach((c) => {
    const parts = c.label.split('\n');
    let textY = 105.9;
    if (parts.length === 1) textY = 107.5;
    parts.forEach((p: string) => {
       const tw = bold.widthOfTextAtSize(p, 9);
       const tx = c.center ? x(c.x) + (mm(c.w) - tw)/2 : x(c.x) + mm(2);
       page.drawText(p, { x: tx, y: y(textY), size: 9, font: bold, color: colors.text });
       textY += 3.8;
    });
  });

  const hasDiscount = invoice.discountApplied > 0;
  const tyOffset = hasDiscount ? 11.4 : 0;

  // Draw Vertical Lines
  for (let i = 1; i < cols.length; i++) {
    page.drawLine({ start: { x: x(cols[i].x), y: y(102.1) }, end: { x: x(cols[i].x), y: y(174.9 - tyOffset) }, thickness: 1, color: rgb(0,0,0) });
  }
  // Outer box for items
  page.drawRectangle({ x: x(27.0), y: y(174.9 - tyOffset), width: mm(156.0), height: mm(72.8 - tyOffset), borderColor: rgb(0,0,0), borderWidth: 1 });

  // Items
  let curY = 120.3;
  invoice.items.forEach((item, idx) => {
    const genName = item.itemName.toUpperCase();
    // @ts-ignore
    const subName = item.itemSubName ? item.itemSubName.toUpperCase() : '';
    const namePart = subName ? `${genName} - ${subName}` : genName;
    let desc = namePart;

    if (!showPurityColumn && item.purityValue && item.purityValue !== 'None') {
      if (item.purityType === 'Karat') {
        const purStr = item.purityValue.endsWith('K') ? item.purityValue : `${item.purityValue}K`;
        desc = `${purStr} ${namePart}`;
      } else {
        desc = `${namePart} ${item.purityValue}%`;
      }
    }
    
    let cIdx = 0;
    // Sr No
    page.drawText((idx+1).toString(), { x: x(cols[cIdx].x) + (mm(cols[cIdx].w) - bold.widthOfTextAtSize((idx+1).toString(), 9))/2, y: y(curY), size: 9, font: bold, color: colors.text }); cIdx++;
    // Description
    page.drawText(desc, { x: x(cols[cIdx].x) + mm(2), y: y(curY), size: 9, font: bold, color: colors.text }); cIdx++;
    // Purity
    if (showPurityColumn) {
      const pur = item.purityType === 'Karat' ? (item.purityValue.endsWith('K') ? item.purityValue : `${item.purityValue}K`) : `${item.purityValue}%`;
      page.drawText(pur, { x: x(cols[cIdx].x) + (mm(cols[cIdx].w) - bold.widthOfTextAtSize(pur, 9))/2, y: y(curY), size: 9, font: bold, color: colors.text }); cIdx++;
    }
    // HSN
    page.drawText(item.hsn, { x: x(cols[cIdx].x) + (mm(cols[cIdx].w) - bold.widthOfTextAtSize(item.hsn, 9))/2, y: y(curY), size: 9, font: bold, color: colors.text }); cIdx++;
    // Weight
    const wStr = item.weight.toString();
    page.drawText(wStr, { x: x(cols[cIdx].x) + (mm(cols[cIdx].w) - bold.widthOfTextAtSize(wStr, 9))/2, y: y(curY), size: 9, font: bold, color: colors.text }); cIdx++;
    // Rate
    const rStr = item.ratePerGram.toString();
    page.drawText(rStr, { x: x(cols[cIdx].x) + (mm(cols[cIdx].w) - bold.widthOfTextAtSize(rStr, 9))/2, y: y(curY), size: 9, font: bold, color: colors.text }); cIdx++;
    // Amount
    const amtStr = item.taxableAmount.toString();
    page.drawText(amtStr, { x: x(cols[cIdx].x) + (mm(cols[cIdx].w) - bold.widthOfTextAtSize(amtStr, 9))/2, y: y(curY), size: 9, font: bold, color: colors.text }); cIdx++;
    
    curY += 5.5;
  });

  // Totals Section
  const totalTaxable = invoice.items.reduce((s, i) => s + i.taxableAmount, 0) - invoice.discountApplied;
  
  const drawTotRow = (label: string, val: string, bg: any, rowY: number, h: number) => {
    page.drawRectangle({ x: x(40.4), y: y(rowY + h), width: mm(142.6), height: mm(h), color: bg, borderColor: rgb(0,0,0), borderWidth: 1 });
    page.drawText(label, { x: x(43.2), y: y(rowY + h/2 + 1), size: 9, font: bold, color: colors.text });
    page.drawText(val, { x: x(183.0) - mm(2) - bold.widthOfTextAtSize(val, 9), y: y(rowY + h/2 + 1), size: 9, font: bold, color: colors.text });
  };

  let ty = 174.9 - tyOffset;
  const subtotal = invoice.items.reduce((s, i) => s + i.taxableAmount, 0);
  
  if (hasDiscount) {
    drawTotRow('SUBTOTAL :', subtotal.toFixed(2), colors.totalAmount, ty, 5.7); ty += 5.7;
    drawTotRow('LESS: DISCOUNT :', `- ${invoice.discountApplied.toFixed(2)}`, colors.totalAmount, ty, 5.7); ty += 5.7;
  }
  
  drawTotRow('TOTAL AMOUNT :', totalTaxable.toFixed(2), colors.totalAmount, ty, 5.7); ty += 5.7;
  drawTotRow(`CGST ${invoice.taxDetails.cgstPercent}% :`, invoice.taxDetails.cgst.toFixed(2), colors.cgstSgst, ty, 5.7); ty += 5.7;
  drawTotRow(`SGST ${invoice.taxDetails.sgstPercent}% :`, invoice.taxDetails.sgst.toFixed(2), colors.cgstSgst, ty, 5.7); ty += 5.7;
  if (invoice.taxDetails.igst > 0) {
    drawTotRow(`IGST ${invoice.taxDetails.igstPercent}% :`, invoice.taxDetails.igst.toFixed(2), colors.igst, ty, 5.7); ty += 5.7;
  }
  
  const roundOff = invoice.payableAmount - invoice.grandTotal;
  drawTotRow('ROUND OFF :', roundOff.toFixed(2), colors.roundOff, ty, 5.7); ty += 5.7;
  
  // Grand Total uses Helvetica Bold instead of Google Sans Mono
  page.drawRectangle({ x: x(40.4), y: y(ty + 8.5), width: mm(142.6), height: mm(8.5), color: colors.grandTotal, borderColor: rgb(0,0,0), borderWidth: 1 });
  page.drawText('GRAND TOTAL :', { x: x(45.9), y: y(ty + 5.5), size: 9, font: bold, color: colors.text });
  const gtStr = invoice.payableAmount.toFixed(2);
  page.drawText(gtStr, { x: x(183.0) - mm(2) - bold.widthOfTextAtSize(gtStr, 9), y: y(ty + 5.5), size: 9, font: bold, color: colors.text });
  ty += 8.5;

  // Amount in Words
  page.drawRectangle({ x: x(27.0), y: y(216.7), width: mm(156.0), height: mm(8.0), color: colors.roundOff, borderColor: rgb(0,0,0), borderWidth: 1 });
  const wordStr = `Amount in Words: ${numberToWords(invoice.payableAmount)}`;
  if (boldOblique.widthOfTextAtSize(wordStr, 8) > mm(140)) {
    const mid = Math.floor(wordStr.length / 2);
    const splitIdx = wordStr.indexOf(' ', mid);
    const line1 = wordStr.substring(0, splitIdx);
    const line2 = wordStr.substring(splitIdx + 1);
    page.drawText(line1, { x: x(30.0), y: y(211.3 + 4.2), size: 8, font: boldOblique, color: colors.text });
    page.drawText(line2, { x: x(30.0), y: y(211.3 + 1.2), size: 8, font: boldOblique, color: colors.text });
  } else {
    page.drawText(wordStr, { x: x(30.0), y: y(211.3 + 3.8), size: 8, font: boldOblique, color: colors.text });
  }

  // Bank details
  page.drawText('PAYMENT MODE', { x: x(52.2), y: y(223.1 + 3.4), size: 9, font: bold, color: colors.paymentText });
  
  page.drawRectangle({ x: x(27.0), y: y(246.9), width: mm(75.9), height: mm(20.0), borderColor: rgb(0,0,0), borderWidth: 1 });
  
  let bdy = 227.7;
  const drawBd = (txt: string) => {
    page.drawText(txt, { x: x(28.0), y: y(bdy + 3.2), size: 8, font: bold, color: colors.text });
    bdy += 4.5;
  };
  drawBd(`BANK NAME: ${profile.bankName || ''}`);
  drawBd(`BRANCH: ${profile.branch || ''}`);
  drawBd(`ACCOUNT NAME: ${profile.accountName || ''}`);
  drawBd(`ACCOUNT NO: ${profile.accountNo || ''}`);
  drawBd(`IFSC CODE: ${profile.ifsc || ''}`);

  // Footer Right Auth
  page.drawText(`FOR ${brandName}`, { x: x(183.0) - bold.widthOfTextAtSize(`FOR ${brandName}`, 9), y: y(227.7 + 3.2), size: 9, font: bold, color: colors.text });
  page.drawText('AUTHORISED SIGNATORY', { x: x(183.0) - bold.widthOfTextAtSize('AUTHORISED SIGNATORY', 9), y: y(253.1 + 3.2), size: 9, font: bold, color: colors.text });
  page.drawText('E&OE', { x: x(27.0), y: y(253.1 + 3.2), size: 9, font: bold, color: colors.text });

  // EXACT Legal Text
  const jurTxt = `SUBJECT TO ${profile.jurisdiction.toUpperCase()} JURISDICTION`;
  const jurW = bold.widthOfTextAtSize(jurTxt, 9);
  page.drawText(jurTxt, { x: (width - jurW)/2, y: y(271.5), size: 9, font: bold, color: colors.text });
}

// -------------------------------------------------------------
// TEMPLATE 2: SRI NARAYAN JEWELLERS STYLE REPLICA (Image Overlay)
async function renderTemplate2(
  page: PDFPage, _width: number, height: number, 
  invoice: Invoice, profile: BusinessProfile, copyLabel: string, 
  font: PDFFont, bold: PDFFont, oblique: PDFFont, _boldOblique: PDFFont, 
  logoImage: PDFImage | null, invoiceDateStr: string, financialYear: string
) {
  const y = (valMm: number) => height - mm(valMm);
  const x = (valMm: number) => mm(valMm);

  const darkBlue = hexToRgb('#0a2351'); // approved navy
  const gold = hexToRgb('#d6a848'); // approved gold
  const white = rgb(1, 1, 1);
  const textDark = rgb(0.1, 0.1, 0.1);

  // Logo Circle or Image
  let logoDrawn = false;
  if (logoImage) {
    try {
      const maxW = 55;
      const maxH = 55;
      const ratio = Math.min(maxW / logoImage.width, maxH / logoImage.height);
      const dims = { width: logoImage.width * ratio, height: logoImage.height * ratio };
      page.drawImage(logoImage, { x: x(21) - dims.width / 2, y: y(21) - dims.height / 2, width: dims.width, height: dims.height });
      logoDrawn = true;
    } catch (e) {
      console.error('Could not draw logo in Template 2', e);
    }
  }

  if (!logoDrawn) {
    // Draw nice circle with initials
    page.drawCircle({ x: x(21), y: y(21), size: mm(9), color: darkBlue, borderColor: gold, borderWidth: 1.5 });
    const initials = profile.brandName.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase();
    const initW = bold.widthOfTextAtSize(initials, 10);
    page.drawText(initials, { x: x(21) - initW/2, y: y(21) - 3.5, size: 10, font: bold, color: white });
  }

  // Brand Info (Left)
  const brandName = invoice.isSwappedAddress ? invoice.customerDetails.partyName.toUpperCase() : profile.brandName.toUpperCase();
  page.drawText(brandName, { x: x(33), y: y(15), size: 14.5, font: bold, color: darkBlue });
  
  const tagStr = profile.tagline || 'WHOLESALE JEWELLERS';
  page.drawText(tagStr, { x: x(33), y: y(19), size: 8, font: oblique, color: gold });
  page.drawText(`ESTD: ${profile.estdYear || '2020'}`, { x: x(33), y: y(22.5), size: 7.5, font: bold, color: gold });
  
  const profileZip = profile.zipCode ? ` - ${profile.zipCode}` : '';
  const custZip = invoice.customerDetails.zipCode ? ` - ${invoice.customerDetails.zipCode}` : '';
  const shopAddr = invoice.isSwappedAddress 
    ? `${invoice.customerDetails.address}, ${invoice.customerDetails.city}${custZip}` 
    : `${profile.address}, ${profile.city}${profileZip}`;
  page.drawText(shopAddr, { x: x(33), y: y(27), size: 7.5, font: font, color: textDark });
  
  const shopContact = invoice.isSwappedAddress ? `PH: ${invoice.customerDetails.phone}` : `PH: ${profile.phone} | EMAIL: ${profile.email}`;
  page.drawText(shopContact, { x: x(33), y: y(30.5), size: 7.5, font: font, color: textDark });

  // TAX INVOICE Header (Right)
  page.drawText('TAX INVOICE', { x: x(198) - bold.widthOfTextAtSize('TAX INVOICE', 16), y: y(15), size: 16, font: bold, color: darkBlue });

  // Copy Type Badge
  page.drawRectangle({ x: x(150), y: y(23), width: mm(48), height: mm(5.5), color: darkBlue, borderColor: gold, borderWidth: 1 });
  const copyW = bold.widthOfTextAtSize(copyLabel, 7.5);
  page.drawText(copyLabel, { x: x(150) + (mm(48) - copyW)/2, y: y(19.2), size: 7.5, font: bold, color: gold });

  // Metadata block (Right side)
  const drawMeta = (lbl: string, val: string, yy: number) => {
    page.drawText(lbl, { x: x(145), y: y(yy), size: 8, font: font, color: textDark });
    page.drawText(val, { x: x(198) - bold.widthOfTextAtSize(val, 8), y: y(yy), size: 8, font: bold, color: textDark });
  };
  drawMeta('GSTIN:', profile.gstin, 27.5);
  drawMeta('PAN NO.:', profile.pan, 31.5);
  drawMeta('INVOICE NO.:', invoice.invoiceId, 35.5);
  drawMeta('INVOICE DATE:', invoiceDateStr, 39.5);
  drawMeta('FINANCIAL YEAR:', financialYear, 43.5);
  drawMeta('STATE CODE:', profile.stateCode, 47.5);

  // Separator Bar
  page.drawRectangle({ x: x(12), y: y(51), width: mm(186), height: mm(1.2), color: darkBlue });

  // Buyer Details
  page.drawRectangle({ x: x(12), y: y(57), width: mm(186), height: mm(5.5), color: darkBlue });
  if (invoice.isShippingDifferent) {
    page.drawText('DETAILS OF RECEIVER (BILLED TO)', { x: x(15), y: y(53.2), size: 9, font: bold, color: gold });
    page.drawText('DETAILS OF CONSIGNEE (SHIPPED TO)', { x: x(108), y: y(53.2), size: 9, font: bold, color: gold });
  } else {
    const btW = bold.widthOfTextAtSize('BUYER DETAILS', 9.5);
    page.drawText('BUYER DETAILS', { x: x(12) + (mm(186) - btW)/2, y: y(53.2), size: 9.5, font: bold, color: gold });
  }

  // Buyer details box border and split line
  page.drawRectangle({ x: x(12), y: y(85), width: mm(186), height: mm(28), borderColor: darkBlue, borderWidth: 1.5 });
  page.drawLine({ start: { x: x(105), y: y(57) }, end: { x: x(105), y: y(85) }, thickness: 1, color: darkBlue, opacity: 0.3 });

  // Buyer details mapping
  const rName = invoice.isSwappedAddress ? profile.legalName : invoice.customerDetails.partyName;
  const rAddress = invoice.isSwappedAddress ? profile.address : invoice.customerDetails.address;
  const rCityRaw = invoice.isSwappedAddress ? profile.city : invoice.customerDetails.city;
  const rZip = invoice.isSwappedAddress ? profile.zipCode : invoice.customerDetails.zipCode;
  const rCity = rZip ? `${rCityRaw} - ${rZip}` : rCityRaw;
  const rState = invoice.isSwappedAddress ? profile.stateName : invoice.customerDetails.stateName;
  const rStateCode = invoice.isSwappedAddress ? profile.stateCode : invoice.customerDetails.stateCode;
  const rGstin = invoice.isSwappedAddress ? profile.gstin : invoice.customerDetails.gstin;
  const rPan = invoice.isSwappedAddress ? profile.pan : invoice.customerDetails.panAadhaar;
  const rPos = invoice.isSwappedAddress ? profile.stateName : invoice.customerDetails.stateName;
  const rPhone = invoice.isSwappedAddress ? profile.phone : invoice.customerDetails.phone;
  const rIdType = invoice.customerDetails.idType === 'AADHAAR' ? 'AADHAAR ID' : 'PAN ID';

  let bL = 62.5;
  const drawBL = (lbl: string, val: string) => {
    page.drawText(lbl, { x: x(15), y: y(bL), size: 8, font: bold, color: darkBlue });
    page.drawText(val, { x: x(38), y: y(bL), size: 8, font: bold, color: textDark });
    bL += 5.5;
  };

  let bR = 62.5;
  const drawBR = (lbl: string, val: string) => {
    page.drawText(lbl, { x: x(108), y: y(bR), size: 8, font: bold, color: darkBlue });
    page.drawText(val, { x: x(135), y: y(bR), size: 8, font: bold, color: textDark });
    bR += 5.5;
  };

  if (invoice.customerDetails.shippingAddress && invoice.customerDetails.shippingAddress.trim() !== '') {
    drawBL('NAME:', rName || 'NILL');
    drawBL('ADDRESS:', `${rAddress || ''}, ${rCity || ''}`.replace(/^, | , $/g, '') || 'NILL');
    drawBL('CONTACT NO:', rPhone || 'NILL');
    drawBL('GSTIN:', rGstin || 'NILL');
    drawBL(`${rIdType}:`, rPan || 'NILL');

    const sCityRaw = invoice.customerDetails.shippingCity ? invoice.customerDetails.shippingCity : '';
    const sZip = invoice.customerDetails.shippingZipCode ? ` - ${invoice.customerDetails.shippingZipCode}` : '';
    const sCity = sZip ? `${sCityRaw}${sZip}` : sCityRaw;
    drawBR('ADDRESS:', `${invoice.customerDetails.shippingAddress || ''}, ${sCity}`.replace(/^, | , $/g, '') || 'NILL');
    drawBR('STATE:', invoice.customerDetails.shippingStateName || 'NILL');
    drawBR('STATE CODE:', invoice.customerDetails.shippingStateCode || 'NILL');
    drawBR('POS:', rPos || 'NILL');
  } else {
    drawBL('NAME:', rName || 'NILL');
    drawBL('CONTACT NO:', rPhone || 'NILL');
    drawBL('GSTIN:', rGstin || 'NILL');
    drawBL(`${rIdType}:`, rPan || 'NILL');

    drawBR('ADDRESS:', `${rAddress || ''}, ${rCity || ''}`.replace(/^, | , $/g, '') || 'NILL');
    drawBR('STATE:', rState || 'NILL');
    drawBR('STATE CODE:', rStateCode || 'NILL');
    drawBR('POS:', rPos || 'NILL');
  }

  // Table header bar
  page.drawRectangle({ x: x(12), y: y(95), width: mm(186), height: mm(7), color: darkBlue });

  const showPurityColumn = invoice.items.length > 0 && invoice.items.every((item: any) => item.purityValue && item.purityValue !== 'None');

  const cols: any[] = [
    { label: 'SR.\nNO.', x: 12, w: 10, center: true },
  ];
  if (showPurityColumn) {
    cols.push(
      { label: 'DESCRIPTION OF GOODS', x: 22, w: 66 },
      { label: 'PURITY', x: 88, w: 15, center: true }
    );
  } else {
    cols.push({ label: 'DESCRIPTION OF GOODS', x: 22, w: 81 });
  }
  cols.push(
    { label: 'HSN/SAC\nCODE', x: 103, w: 18, center: true },
    { label: 'WEIGHT', x: 121, w: 18, center: true },
    { label: 'UNIT', x: 139, w: 10, center: true },
    { label: 'RATE (Rs)', x: 149, w: 21, center: true },
    { label: 'AMOUNT (Rs)', x: 170, w: 28, center: true }
  );

  // Draw Header text
  cols.forEach(c => {
    const parts = c.label.split('\n');
    let textY = 90.2;
    if (parts.length === 1) textY = 92.2;
    parts.forEach((p: string) => {
      const tw = bold.widthOfTextAtSize(p || '', 7.5);
      const tx = c.center ? x(c.x) + (mm(c.w) - tw)/2 : x(c.x) + mm(2);
      page.drawText(p || '', { x: tx, y: y(textY), size: 7.5, font: bold, color: gold });
      textY += 3.5;
    });
  });

  // Table Outer Box & Column Grid Lines
  page.drawRectangle({ x: x(12), y: y(165), width: mm(186), height: mm(70), borderColor: darkBlue, borderWidth: 1.5 });
  for (let i = 1; i < cols.length; i++) {
    page.drawLine({ start: { x: x(cols[i].x), y: y(95) }, end: { x: x(cols[i].x), y: y(165) }, thickness: 1, color: darkBlue, opacity: 0.3 });
  }

  // Draw Item Rows
  let curY = 100.5;
  invoice.items.forEach((item, idx) => {
    const genName = (item.itemName || '').toUpperCase();
    // @ts-ignore
    const subName = item.itemSubName ? item.itemSubName.toUpperCase() : '';
    const namePart = subName ? `${genName} - ${subName}` : genName;
    let desc = namePart;

    if (!showPurityColumn && item.purityValue && item.purityValue !== 'None') {
      if (item.purityType === 'Karat') {
        const purStr = item.purityValue.endsWith('K') ? item.purityValue : `${item.purityValue}K`;
        desc = `${purStr} ${namePart}`;
      } else {
        desc = `${namePart} ${item.purityValue}%`;
      }
    }

    let cIdx = 0;
    // Sr No
    const srStr = (idx + 1).toString();
    page.drawText(srStr, { x: x(cols[cIdx].x) + (mm(cols[cIdx].w) - font.widthOfTextAtSize(srStr, 8.5))/2, y: y(curY), size: 8.5, font: font, color: textDark }); cIdx++;
    // Description
    page.drawText(desc, { x: x(cols[cIdx].x) + mm(2), y: y(curY), size: 8.5, font: font, color: textDark }); cIdx++;
    // Purity
    if (showPurityColumn) {
      const pur = item.purityType === 'Karat' ? (item.purityValue.endsWith('K') ? item.purityValue : `${item.purityValue}K`) : `${item.purityValue}%`;
      page.drawText(pur, { x: x(cols[cIdx].x) + (mm(cols[cIdx].w) - font.widthOfTextAtSize(pur, 8.5))/2, y: y(curY), size: 8.5, font: font, color: textDark }); cIdx++;
    }
    // HSN
    page.drawText(item.hsn, { x: x(cols[cIdx].x) + (mm(cols[cIdx].w) - font.widthOfTextAtSize(item.hsn, 8.5))/2, y: y(curY), size: 8.5, font: font, color: textDark }); cIdx++;
    // Weight
    const wStr = item.weight.toFixed(2);
    page.drawText(wStr, { x: x(cols[cIdx].x) + mm(cols[cIdx].w) - mm(2) - font.widthOfTextAtSize(wStr, 8.5), y: y(curY), size: 8.5, font: font, color: textDark }); cIdx++;
    // Unit
    page.drawText(item.weightUnit, { x: x(cols[cIdx].x) + (mm(cols[cIdx].w) - font.widthOfTextAtSize(item.weightUnit, 8.5))/2, y: y(curY), size: 8.5, font: font, color: textDark }); cIdx++;
    // Rate
    const rStr = item.ratePerGram.toFixed(2);
    page.drawText(rStr, { x: x(cols[cIdx].x) + mm(cols[cIdx].w) - mm(2) - font.widthOfTextAtSize(rStr, 8.5), y: y(curY), size: 8.5, font: font, color: textDark }); cIdx++;
    // Amount
    const aStr = item.taxableAmount.toFixed(2);
    page.drawText(aStr, { x: x(cols[cIdx].x) + mm(cols[cIdx].w) - mm(2) - bold.widthOfTextAtSize(aStr, 8.5), y: y(curY), size: 8.5, font: bold, color: darkBlue });

    curY += 5.5;
  });

  // Amount In Words (Left Footer)
  page.drawRectangle({ x: x(12), y: y(171), width: mm(103), height: mm(5), color: darkBlue });
  const wTitle = 'AMOUNT IN WORDS';
  const wtW = bold.widthOfTextAtSize(wTitle, 8);
  page.drawText(wTitle, { x: x(12) + (mm(103) - wtW)/2, y: y(167.5), size: 8, font: bold, color: gold });

  page.drawRectangle({ x: x(12), y: y(190), width: mm(103), height: mm(19), borderColor: darkBlue, borderWidth: 1.5 });
  const wordStr = numberToWords(invoice.payableAmount);
  // Split words if too long to fit
  if (bold.widthOfTextAtSize(wordStr, 8.5) > mm(99)) {
    const mid = Math.floor(wordStr.length / 2);
    const splitIdx = wordStr.indexOf(' ', mid);
    const line1 = wordStr.substring(0, splitIdx);
    const line2 = wordStr.substring(splitIdx + 1);
    page.drawText(line1, { x: x(15), y: y(176.5), size: 8.5, font: bold, color: darkBlue });
    page.drawText(line2, { x: x(15), y: y(183.5), size: 8.5, font: bold, color: darkBlue });
  } else {
    page.drawText(wordStr, { x: x(15), y: y(180), size: 8.5, font: bold, color: darkBlue });
  }

  // Tax Breakdown (Right Footer)
  page.drawRectangle({ x: x(120), y: y(171), width: mm(78), height: mm(5), color: darkBlue });
  const tbW = bold.widthOfTextAtSize('TAX BREAKDOWN', 8);
  page.drawText('TAX BREAKDOWN', { x: x(120) + (mm(78) - tbW)/2, y: y(167.5), size: 8, font: bold, color: gold });

  page.drawRectangle({ x: x(120), y: y(222), width: mm(78), height: mm(51), borderColor: darkBlue, borderWidth: 1.5 });

  let tY = 175.5;
  const drawRow = (lbl: string, val: string, isBold: boolean = false) => {
    page.drawText(lbl, { x: x(123), y: y(tY), size: 8, font: isBold ? bold : font, color: textDark });
    page.drawText(val, { x: x(195) - (isBold ? bold : font).widthOfTextAtSize(val, 8), y: y(tY), size: 8, font: isBold ? bold : font, color: textDark });
    page.drawLine({ start: { x: x(120), y: y(tY + 3) }, end: { x: x(198), y: y(tY + 3) }, thickness: 0.5, color: darkBlue, opacity: 0.2 });
    tY += 5;
  };

  const totalTaxable = invoice.items.reduce((s, i) => s + i.taxableAmount, 0) - invoice.discountApplied;
  if (invoice.discountApplied > 0) {
    drawRow(`TAXABLE (LESS: ₹${invoice.discountApplied.toFixed(2)})`, totalTaxable.toFixed(2));
  } else {
    drawRow('TAXABLE AMOUNT', totalTaxable.toFixed(2));
  }
  drawRow(`CGST @ ${invoice.taxDetails.cgstPercent}%`, invoice.taxDetails.cgst.toFixed(2));
  drawRow(`SGST @ ${invoice.taxDetails.sgstPercent}%`, invoice.taxDetails.sgst.toFixed(2));
  if (invoice.taxDetails.igst > 0) {
    drawRow(`IGST @ ${invoice.taxDetails.igstPercent}%`, invoice.taxDetails.igst.toFixed(2));
  }
  const totalTax = invoice.taxDetails.cgst + invoice.taxDetails.sgst + invoice.taxDetails.igst;
  drawRow('TOTAL TAX', totalTax.toFixed(2));

  // Grand Total Bar
  page.drawRectangle({ x: x(120), y: y(206.5), width: mm(78), height: mm(5.5), color: darkBlue });
  page.drawText('GRAND TOTAL', { x: x(123), y: y(202.5), size: 8, font: bold, color: gold });
  const gtStr = invoice.grandTotal.toFixed(2);
  page.drawText(gtStr, { x: x(195) - bold.widthOfTextAtSize(gtStr, 8), y: y(202.5), size: 8, font: bold, color: gold });

  tY = 211.5;
  const roundOff = invoice.payableAmount - invoice.grandTotal;
  drawRow('ROUND OFF', `${roundOff >= 0 ? '+' : '-'}${Math.abs(roundOff).toFixed(2)}`);

  // Final Amount Bar
  page.drawRectangle({ x: x(120), y: y(222), width: mm(78), height: mm(5.5), color: gold });
  page.drawText('FINAL AMOUNT', { x: x(123), y: y(218.2), size: 8, font: bold, color: white });
  const faStr = invoice.payableAmount.toFixed(2);
  page.drawText(faStr, { x: x(195) - bold.widthOfTextAtSize(faStr, 8), y: y(218.2), size: 8, font: bold, color: white });

  // Bank Details (Left Footer Box 2)
  page.drawRectangle({ x: x(12), y: y(197), width: mm(103), height: mm(5), color: darkBlue });
  const bdTitle = 'BANK DETAILS';
  const bdtW = bold.widthOfTextAtSize(bdTitle, 8);
  page.drawText(bdTitle, { x: x(12) + (mm(103) - bdtW)/2, y: y(193.5), size: 8, font: bold, color: gold });

  page.drawRectangle({ x: x(12), y: y(229), width: mm(103), height: mm(32), borderColor: darkBlue, borderWidth: 1.5 });
  let bdY = 202.5;
  const drawBD = (lbl: string, val: string) => {
    page.drawText(lbl, { x: x(15), y: y(bdY), size: 7.5, font: bold, color: darkBlue });
    page.drawText(val, { x: x(38), y: y(bdY), size: 7.5, font: bold, color: textDark });
    bdY += 4.5;
  };
  drawBD('BANK NAME:', profile.bankName || '');
  drawBD('BRANCH:', profile.branch || '');
  drawBD('A/C NAME:', profile.accountName || '');
  drawBD('A/C NO.:', profile.accountNo || '');
  drawBD('IFSC CODE:', profile.ifsc || '');
  drawBD('UPI ID:', profile.upiId || '');

  // Payment Mode Box (Right side, below Final Amount)
  page.drawRectangle({ x: x(120), y: y(229), width: mm(78), height: mm(5), color: darkBlue });
  const pmTitle = 'PAYMENT MODE';
  const pmW = bold.widthOfTextAtSize(pmTitle, 8);
  page.drawText(pmTitle, { x: x(120) + (mm(78) - pmW)/2, y: y(225.5), size: 8, font: bold, color: gold });

  page.drawRectangle({ x: x(120), y: y(244), width: mm(78), height: mm(15), borderColor: darkBlue, borderWidth: 1.5 });
  page.drawText(invoice.paymentMode || 'NILL', { x: x(123), y: y(235.5), size: 8.5, font: bold, color: textDark });

  // Signature Block & E&OE
  page.drawText(`SUBJECT TO ${profile.jurisdiction.toUpperCase() || 'KOLKATA'} JURISDICTION`, { x: x(12), y: y(251), size: 8, font: oblique, color: textDark });
  page.drawText('E&OE', { x: x(12), y: y(256), size: 9, font: bold, color: textDark });

  // FOR [Business Name]
  const forStr = `FOR ${profile.brandName.toUpperCase()}`;
  page.drawText(forStr, { x: x(198) - bold.widthOfTextAtSize(forStr, 8.5), y: y(251), size: 8.5, font: bold, color: textDark });

  if (profile.legalName) {
    page.drawText(profile.legalName, { x: x(198) - oblique.widthOfTextAtSize(profile.legalName, 8.5), y: y(268), size: 8.5, font: oblique, color: textDark });
  }
  page.drawText('AUTHORISED SIGNATORY', { x: x(198) - bold.widthOfTextAtSize('AUTHORISED SIGNATORY', 8), y: y(272), size: 8, font: bold, color: textDark });

  // Decorative gold line
  page.drawLine({ start: { x: x(12), y: y(276.5) }, end: { x: x(198), y: y(276.5) }, thickness: 1.5, color: gold });

  // Footer branding bar
  page.drawRectangle({ x: x(12), y: y(287), width: mm(186), height: mm(9), color: darkBlue });
  
  const foot1 = 'THANK YOU FOR YOUR BUSINESS!';
  page.drawText(foot1, { x: x(15), y: y(281.5), size: 8, font: bold, color: gold });

  // Draw a gold separator dot
  page.drawCircle({ x: x(12) + mm(186)/2, y: y(282.5), size: mm(1), color: gold });

  const foot2 = 'TRUSTED FOR PURITY. COMMITTED TO EXCELLENCE.';
  page.drawText(foot2, { x: x(195) - bold.widthOfTextAtSize(foot2, 8), y: y(281.5), size: 8, font: bold, color: gold });
}
