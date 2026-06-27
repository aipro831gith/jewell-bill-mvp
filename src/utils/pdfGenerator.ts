import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import type { Invoice, BusinessProfile } from '../db/database';

function numberToWords(num: number): string {
  if (num === 0) return 'Zero Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const n = ('000000000' + Math.floor(num)).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';
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
    if (m < 3) return `${y-1} - ${y}`;
    return `${y} - ${y+1}`;
  })();

  const templateId = invoice.templateId || profile.templateId || 1;

  for (let i = 1; i <= numPages; i++) {
    const page = pdfDoc.addPage([595.27, 841.89]); // A4 scale
    const { width, height } = page.getSize();

    let copyLabel = '';
    if (isChallan) {
      if (i === 1) copyLabel = 'COPY 1: ORIGINAL FOR CONSIGNEE';
      else if (i === 2) copyLabel = 'COPY 2: DUPLICATE FOR TRANSPORTER';
      else copyLabel = 'COPY 3: TRIPLICATE FOR CONSIGNOR';
    } else {
      if (i === 1) copyLabel = 'ORIGINAL Buyer Copy';
      else if (i === 2) copyLabel = 'DUPLICATE Transporter Copy';
      else copyLabel = 'TRIPLICATE Supplier Copy';
    }
    
    // Embed brand logo
    let logoImage = null;
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

    if (templateId === 1) {
      await renderTemplate1(page, width, height, invoice, profile, copyLabel, helveticaFont, helveticaBold, helveticaOblique, helveticaBoldOblique, logoImage, invoiceDateStr);
    } else {
      await renderTemplate2(page, width, height, invoice, profile, copyLabel, helveticaFont, helveticaBold, helveticaOblique, helveticaBoldOblique, logoImage, invoiceDateStr, financialYear);
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  try {
    window.open(url, '_blank');
  } catch (e) {
    console.error('Failed to open PDF preview window', e);
  }

  const link = document.createElement('a');
  link.href = url;
  const fileName = `${invoice.type === 'TAX_INVOICE' ? 'Tax_Invoice' : 'Delivery_Challan'}_${invoice.customerDetails.partyName.replace(/[^a-z0-9]/gi, '_')}_${invoice.invoiceId.replace(/\//g, '_')}.pdf`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 15000);
}

// -------------------------------------------------------------
// TEMPLATE 1: G. AGARWAL CHAIN STYLE REPLICA
// -------------------------------------------------------------
async function renderTemplate1(
  page: PDFPage, width: number, height: number, 
  invoice: Invoice, profile: BusinessProfile, copyLabel: string, 
  font: PDFFont, bold: PDFFont, oblique: PDFFont, boldOblique: PDFFont, 
  logoImage: any, invoiceDateStr: string
) {
  void font;
  const isChallan = invoice.type === 'DELIVERY_CHALLAN';
  const y = (val: number) => height - val;
  
  // Top Header Titles
  const title = isChallan ? 'DELIVERY CHALLAN' : 'TAX INVOICE';
  const titleWidth = boldOblique.widthOfTextAtSize(title, 11);
  page.drawText(title, { x: (width - titleWidth) / 2, y: y(40), size: 11, font: boldOblique, color: rgb(0,0,0) });
  page.drawLine({ start: { x: (width - titleWidth) / 2, y: y(41) }, end: { x: (width + titleWidth) / 2, y: y(41) }, thickness: 1, color: rgb(0,0,0) });
  
  const copyWidth = boldOblique.widthOfTextAtSize(copyLabel, 9);
  page.drawText(copyLabel, { x: (width - copyWidth) / 2, y: y(52), size: 9, font: boldOblique, color: rgb(0,0,0) });

  page.drawText(`GSTIN: ${profile.gstin}`, { x: 40, y: y(75), size: 10, font: bold, color: rgb(0,0,0) });
  page.drawText(`PAN NO: ${profile.pan}`, { x: 40, y: y(90), size: 10, font: bold, color: rgb(0,0,0) });
  
  const invNoText = `INVOICE NO: ${invoice.invoiceId}`;
  page.drawText(invNoText, { x: width - 40 - bold.widthOfTextAtSize(invNoText, 10), y: y(75), size: 10, font: bold, color: rgb(0,0,0) });
  const dateText = `DATE: ${invoiceDateStr}`;
  page.drawText(dateText, { x: width - 40 - bold.widthOfTextAtSize(dateText, 10), y: y(90), size: 10, font: bold, color: rgb(0,0,0) });

  let logoBottom = y(95);
  if (logoImage) {
     const dims = logoImage.scale(0.35); // Approx scaled size for header
     page.drawImage(logoImage, { x: (width - dims.width) / 2, y: y(135), width: dims.width, height: dims.height });
     logoBottom = y(135);
  }

  // Brand Name in Green
  const brandColor = hexToRgb('#00b050');
  const brandName = invoice.isSwappedAddress ? invoice.customerDetails.partyName.toUpperCase() : profile.brandName.toUpperCase();
  const brandWidth = bold.widthOfTextAtSize(brandName, 20);
  page.drawText(brandName, { x: (width - brandWidth) / 2, y: logoBottom - 20, size: 20, font: bold, color: brandColor });
  
  const addressText = invoice.isSwappedAddress ? `${invoice.customerDetails.address}, ${invoice.customerDetails.city}, ${invoice.customerDetails.stateName}, ${invoice.customerDetails.stateCode}` : `${profile.address}, ${profile.city}, ${profile.stateName}, ${profile.stateCode}`;
  const addressWidth = boldOblique.widthOfTextAtSize(addressText, 10);
  page.drawText(addressText, { x: (width - addressWidth) / 2, y: logoBottom - 38, size: 10, font: boldOblique, color: rgb(0,0,0) });
  
  const contactText = invoice.isSwappedAddress ? `CONTACT NO: ${invoice.customerDetails.phone}` : `CONTACT NO: ${profile.phone}`;
  const contactWidth = bold.widthOfTextAtSize(contactText, 10);
  page.drawText(contactText, { x: (width - contactWidth) / 2, y: logoBottom - 52, size: 10, font: bold, color: rgb(0,0,0) });
  
  if (!invoice.isSwappedAddress && profile.email) {
    const emailText = `EMAIL ID: ${profile.email}`;
    const emailWidth = bold.widthOfTextAtSize(emailText, 10);
    page.drawText(emailText, { x: (width - emailWidth) / 2, y: logoBottom - 66, size: 10, font: bold, color: rgb(0,0,0) });
  }

  // Buyer Details Box
  const buyerY = logoBottom - 85;
  page.drawRectangle({ x: 40, y: buyerY - 90, width: width - 80, height: 90, borderColor: rgb(0,0,0), borderWidth: 1 });
  
  const buyerTitle = isChallan ? 'CONSIGNEE DETAILS' : 'BUYER DETAILS';
  const btWidth = boldOblique.widthOfTextAtSize(buyerTitle, 14);
  page.drawText(buyerTitle, { x: (width - btWidth) / 2, y: buyerY - 14, size: 14, font: boldOblique, color: rgb(0,0,0) });
  page.drawLine({ start: { x: (width - btWidth) / 2, y: buyerY - 16 }, end: { x: (width + btWidth) / 2, y: buyerY - 16 }, thickness: 1, color: rgb(0,0,0) });
  
  const rName = invoice.isSwappedAddress ? profile.legalName : invoice.customerDetails.partyName;
  const rAddress = invoice.isSwappedAddress ? `${profile.address}, ${profile.city}` : `${invoice.customerDetails.address}, ${invoice.customerDetails.city}`;
  const rPhone = invoice.isSwappedAddress ? profile.phone : invoice.customerDetails.phone;
  const rState = invoice.isSwappedAddress ? profile.stateName : invoice.customerDetails.stateName;
  const rStateCode = invoice.isSwappedAddress ? profile.stateCode : invoice.customerDetails.stateCode;
  const rGstin = invoice.isSwappedAddress ? profile.gstin : invoice.customerDetails.gstin;
  const rPan = invoice.isSwappedAddress ? profile.pan : invoice.customerDetails.panAadhaar;

  page.drawText(`NAME: ${rName}`, { x: 45, y: buyerY - 35, size: 10, font: bold, color: rgb(0,0,0) });
  page.drawText(`ADDRESS: ${rAddress}`, { x: 45, y: buyerY - 55, size: 10, font: bold, color: rgb(0,0,0) });
  page.drawText(`CONTACT NO: ${rPhone}`, { x: 45, y: buyerY - 80, size: 10, font: bold, color: rgb(0,0,0) });

  const rightAlign = width - 45;
  const drawRight = (txt: string, yPos: number) => {
    page.drawText(txt, { x: rightAlign - bold.widthOfTextAtSize(txt, 10), y: yPos, size: 10, font: bold, color: rgb(0,0,0) });
  };
  drawRight(`GSTIN: ${rGstin}`, buyerY - 35);
  drawRight(`PAN NO: ${rPan}`, buyerY - 50);
  drawRight(`STATE: ${rState}`, buyerY - 65);
  drawRight(`STATE CODE: ${rStateCode}`, buyerY - 80);

  // Purple Header Table
  const tableY = buyerY - 100;
  const purpleColor = hexToRgb('#9687c7');
  page.drawRectangle({ x: 40, y: tableY - 40, width: width - 80, height: 40, color: purpleColor, borderColor: rgb(0,0,0), borderWidth: 1 });
  
  const cols = [
    { label: 'Serial No', x: 45, w: 50 },
    { label: 'Description of Goods', x: 95, w: 180 },
    { label: 'HSN/SAC\nCode', x: 275, w: 60, center: true },
    { label: 'Weight\n(Gm)', x: 335, w: 60, center: true },
    { label: 'Rate/Gram\n(Rs)', x: 395, w: 60, center: true },
    { label: 'Amount\n(Rs)', x: 455, w: 60, center: true },
  ];

  cols.forEach((c) => {
    const parts = c.label.split('\n');
    let textY = tableY - 15;
    parts.forEach(p => {
       const tw = bold.widthOfTextAtSize(p, 9);
       const tx = c.center ? c.x + (c.w - tw)/2 : c.x + 5;
       page.drawText(p, { x: tx, y: textY, size: 9, font: bold, color: rgb(0,0,0) });
       textY -= 12;
    });
  });

  // Table Body Items
  const startRowY = tableY - 40;
  const rowHeight = 230; // height of the items block
  page.drawRectangle({ x: 40, y: startRowY - rowHeight, width: width - 80, height: rowHeight, borderColor: rgb(0,0,0), borderWidth: 1 });
  
  let curY = startRowY - 20;
  invoice.items.forEach((item, idx) => {
    const purityStr = item.purityValue !== 'None' ? ` (${item.purityValue}${item.purityType === 'Karat'?'K':'%'})` : '';
    const desc = `${item.itemName.toUpperCase()}${purityStr}`;
    
    page.drawText((idx+1).toString(), { x: cols[0].x + (cols[0].w - bold.widthOfTextAtSize((idx+1).toString(), 9))/2, y: curY, size: 9, font: bold, color: rgb(0,0,0) });
    page.drawText(desc, { x: cols[1].x + 5, y: curY, size: 9, font: bold, color: rgb(0,0,0) });
    page.drawText(item.hsn, { x: cols[2].x + (cols[2].w - bold.widthOfTextAtSize(item.hsn, 9))/2, y: curY, size: 9, font: bold, color: rgb(0,0,0) });
    
    const wStr = item.weightInGrams.toString();
    page.drawText(wStr, { x: cols[3].x + (cols[3].w - bold.widthOfTextAtSize(wStr, 9))/2, y: curY, size: 9, font: bold, color: rgb(0,0,0) });
    
    const rStr = item.ratePerGram.toString();
    page.drawText(rStr, { x: cols[4].x + (cols[4].w - bold.widthOfTextAtSize(rStr, 9))/2, y: curY, size: 9, font: bold, color: rgb(0,0,0) });
    
    const amtStr = item.taxableAmount.toString();
    page.drawText(amtStr, { x: cols[5].x + (cols[5].w - bold.widthOfTextAtSize(amtStr, 9))/2, y: curY, size: 9, font: bold, color: rgb(0,0,0) });
    
    curY -= 20;
  });

  // Vertical lines for table structure
  for (let i = 1; i < cols.length; i++) {
    page.drawLine({ start: { x: cols[i].x, y: tableY }, end: { x: cols[i].x, y: startRowY - rowHeight }, thickness: 1, color: rgb(0,0,0) });
  }

  // Colorful Totals Summary
  const totalsY = startRowY - rowHeight;
  const totW = 235; // Matches the table vertical dividers visually
  
  const drawTotalRow = (label: string, val: string, bgColor: any, yPos: number) => {
    page.drawRectangle({ x: 40, y: yPos - 20, width: totW, height: 20, color: bgColor, borderColor: rgb(0,0,0), borderWidth: 1 });
    page.drawRectangle({ x: 40 + totW, y: yPos - 20, width: (width - 80) - totW, height: 20, color: bgColor, borderColor: rgb(0,0,0), borderWidth: 1 });
    page.drawText(label, { x: 50, y: yPos - 14, size: 10, font: bold, color: rgb(0,0,0) });
    page.drawText(val, { x: width - 45 - bold.widthOfTextAtSize(val, 10), y: yPos - 14, size: 10, font: bold, color: rgb(0,0,0) });
  };

  const totalTaxable = invoice.items.reduce((s, i) => s + i.taxableAmount, 0) - invoice.discountApplied;
  let ty = totalsY;
  
  drawTotalRow('TOTAL AMOUNT :', totalTaxable.toFixed(0), hexToRgb('#ff00ff'), ty); ty -= 20;
  drawTotalRow(`CGST ${invoice.taxDetails.cgstPercent}% :`, invoice.taxDetails.cgst.toFixed(0), hexToRgb('#00ffff'), ty); ty -= 20;
  drawTotalRow(`SGST ${invoice.taxDetails.sgstPercent}% :`, invoice.taxDetails.sgst.toFixed(0), hexToRgb('#00ffff'), ty); ty -= 20;
  drawTotalRow(`IGST ${invoice.taxDetails.igstPercent}% :`, invoice.taxDetails.igst.toFixed(0), hexToRgb('#00ffff'), ty); ty -= 20;
  
  const roundOff = invoice.payableAmount - invoice.grandTotal;
  drawTotalRow('ROUND OFF :', roundOff.toFixed(0), hexToRgb('#d9d9d9'), ty); ty -= 20;
  drawTotalRow('GRAND TOTAL :', invoice.payableAmount.toFixed(0), hexToRgb('#ffff00'), ty); ty -= 20;

  // Amount in Words
  page.drawRectangle({ x: 40, y: ty - 25, width: width - 80, height: 25, color: hexToRgb('#d9d9d9'), borderColor: rgb(0,0,0), borderWidth: 0 });
  const amountWords = `Amount in Words: ${numberToWords(invoice.payableAmount)}`;
  page.drawText(amountWords, { x: 45, y: ty - 17, size: 9, font: boldOblique, color: rgb(0,0,0) });

  // Bank Details (Black Header)
  const bankY = ty - 40;
  page.drawRectangle({ x: 40, y: bankY - 15, width: 250, height: 15, color: rgb(0,0,0) });
  const bdTxt = 'BANK DETAILS';
  page.drawText(bdTxt, { x: 40 + (250 - bold.widthOfTextAtSize(bdTxt, 10))/2, y: bankY - 11, size: 10, font: bold, color: rgb(1,1,1) });
  
  page.drawRectangle({ x: 40, y: bankY - 95, width: 250, height: 80, borderColor: rgb(0,0,0), borderWidth: 1 });
  let bdy = bankY - 30;
  const bLines = [
    `BANK NAME: ${profile.bankName || ''}`,
    `BRANCH: ${profile.branch || ''}`,
    `ACCOUNT NAME: ${profile.accountName || ''}`,
    `ACCOUNT NO: ${profile.accountNo || ''}`,
    `IFSC CODE: ${profile.ifsc || ''}`
  ];
  bLines.forEach(l => {
     page.drawText(l, { x: 45, y: bdy, size: 9, font: bold, color: rgb(0,0,0) });
     bdy -= 15;
  });

  // Footer Right Auth
  page.drawText(`FOR ${brandName}`, { x: width - 40 - bold.widthOfTextAtSize(`FOR ${brandName}`, 10), y: bankY - 15, size: 10, font: bold, color: rgb(0,0,0) });
  page.drawText('AUTHORISED SIGNATORY', { x: width - 40 - bold.widthOfTextAtSize('AUTHORISED SIGNATORY', 10), y: bankY - 90, size: 10, font: bold, color: rgb(0,0,0) });

  // EXACT Legal Text
  const jurTxt = `SUBJECT TO ${profile.jurisdiction.toUpperCase()} JURISDICTION`;
  const jurW = bold.widthOfTextAtSize(jurTxt, 11);
  page.drawText(jurTxt, { x: (width - jurW)/2, y: bankY - 130, size: 11, font: bold, color: rgb(0,0,0) });
  
  const eoeW = oblique.widthOfTextAtSize('E&OE', 10);
  page.drawText('E&OE', { x: (width - eoeW)/2, y: bankY - 145, size: 10, font: oblique, color: rgb(0,0,0) });
}

// -------------------------------------------------------------
// TEMPLATE 2: SRI NARAYAN JEWELLERS STYLE REPLICA
// -------------------------------------------------------------
async function renderTemplate2(
  page: PDFPage, width: number, height: number, 
  invoice: Invoice, profile: BusinessProfile, copyLabel: string, 
  font: PDFFont, bold: PDFFont, oblique: PDFFont, boldOblique: PDFFont, 
  logoImage: any, invoiceDateStr: string, financialYear: string
) {
  void boldOblique;
  const isChallan = invoice.type === 'DELIVERY_CHALLAN';
  const y = (val: number) => height - val;
  const darkBlue = hexToRgb('#0a2351');
  const yellowCol = hexToRgb('#d6a848');
  
  // Left: Logo and Brand Layout
  if (logoImage) {
     const dims = logoImage.scale(0.4);
     page.drawImage(logoImage, { x: 30, y: y(90), width: dims.width, height: dims.height });
  }
  
  const brandName = invoice.isSwappedAddress ? invoice.customerDetails.partyName.toUpperCase() : profile.brandName.toUpperCase();
  page.drawText(brandName, { x: 90, y: y(50), size: 16, font: font, color: darkBlue }); // Non-bold clean look
  page.drawText((profile.tagline || 'WHOLESALE & MANUFACTURERS').toUpperCase(), { x: 90, y: y(62), size: 8, font: font, color: yellowCol });
  page.drawText(`ESTD. ${profile.estdYear}`, { x: 90, y: y(72), size: 8, font: font, color: yellowCol });
  
  const phoneTxt = invoice.isSwappedAddress ? invoice.customerDetails.phone : profile.phone;
  const emailTxt = invoice.isSwappedAddress ? '' : profile.email;
  const addrTxt = invoice.isSwappedAddress ? `${invoice.customerDetails.address}, ${invoice.customerDetails.city}, ${invoice.customerDetails.stateName}-${invoice.customerDetails.stateCode}` : `${profile.address}, ${profile.city}, ${profile.stateName}-${profile.stateCode}`;
  
  page.drawText(`•  ${addrTxt}`, { x: 90, y: y(86), size: 7, font: bold, color: darkBlue });
  page.drawText(`☎  ${phoneTxt}    ✉  ${emailTxt}`, { x: 90, y: y(98), size: 7, font: bold, color: darkBlue });

  // Right: Tax Invoice Title & Blue Box
  const title = isChallan ? 'DELIVERY CHALLAN' : 'TAX INVOICE';
  page.drawText(title, { x: width - 30 - font.widthOfTextAtSize(title, 20), y: y(50), size: 20, font: font, color: darkBlue });
  
  page.drawRectangle({ x: width - 180, y: y(72), width: 150, height: 18, color: darkBlue });
  const copyW = font.widthOfTextAtSize(copyLabel.toUpperCase(), 8);
  page.drawText(copyLabel.toUpperCase(), { x: width - 180 + (150 - copyW)/2, y: y(66), size: 8, font: font, color: rgb(1,1,1) });

  let rY = y(86);
  const drawR = (txt: string) => {
     page.drawText(txt, { x: width - 30 - font.widthOfTextAtSize(txt, 8), y: rY, size: 8, font: font, color: rgb(0,0,0) });
     rY -= 12;
  };
  drawR(`GSTIN: ${profile.gstin}`);
  drawR(`PAN NO.: ${profile.pan}`);
  drawR(`INVOICE NO.: ${invoice.invoiceId}`);
  drawR(`INVOICE DATE: ${invoiceDateStr}`);
  drawR(`FINANCIAL YEAR: ${financialYear}`);
  drawR(`STATE CODE: ${profile.stateCode}`);
  
  // Full Width Dark Blue Buyer Details Header
  const byY = y(165);
  page.drawRectangle({ x: 30, y: byY, width: width - 60, height: 18, color: darkBlue });
  const bdTxt = isChallan ? 'CONSIGNEE DETAILS' : 'BUYER DETAILS';
  const bdW = font.widthOfTextAtSize(bdTxt, 10);
  page.drawText(bdTxt, { x: (width - bdW)/2, y: byY + 5, size: 10, font: font, color: yellowCol });
  
  page.drawRectangle({ x: 30, y: byY - 95, width: width - 60, height: 95, borderColor: darkBlue, borderWidth: 1 });
  
  const rName = invoice.isSwappedAddress ? profile.legalName : invoice.customerDetails.partyName;
  const rAddress = invoice.isSwappedAddress ? profile.address : invoice.customerDetails.address;
  const rCity = invoice.isSwappedAddress ? profile.city : invoice.customerDetails.city;
  const rState = invoice.isSwappedAddress ? profile.stateName : invoice.customerDetails.stateName;
  const rStateCode = invoice.isSwappedAddress ? profile.stateCode : invoice.customerDetails.stateCode;
  const rGstin = invoice.isSwappedAddress ? profile.gstin : invoice.customerDetails.gstin;
  const rPan = invoice.isSwappedAddress ? profile.pan : invoice.customerDetails.panAadhaar;
  const rPos = invoice.isSwappedAddress ? profile.stateName : invoice.customerDetails.placeOfSupply;
  const rPhone = invoice.isSwappedAddress ? profile.phone : invoice.customerDetails.phone;

  // 2-Column Buyer Information
  let leftY = byY - 20;
  page.drawText(`NAME: `, { x: 40, y: leftY, size: 8, font: font, color: darkBlue });
  page.drawText(rName, { x: 80, y: leftY, size: 8, font: font, color: darkBlue }); // Standard not bold for clean look
  
  leftY -= 20;
  page.drawText(`CONTACT NO.: `, { x: 40, y: leftY, size: 8, font: font, color: darkBlue });
  page.drawText(rPhone || 'NILL', { x: 105, y: leftY, size: 8, font: oblique, color: rgb(0.5,0.5,0.5) });

  leftY -= 20;
  page.drawText(`GSTIN: `, { x: 40, y: leftY, size: 8, font: font, color: darkBlue });
  page.drawText(rGstin, { x: 75, y: leftY, size: 8, font: font, color: rgb(0,0,0) });

  leftY -= 20;
  page.drawText(`PAN ID: `, { x: 40, y: leftY, size: 8, font: font, color: darkBlue });
  page.drawText(rPan, { x: 80, y: leftY, size: 8, font: font, color: rgb(0,0,0) });

  const midX = width / 2;
  let rightY = byY - 20;
  page.drawText(`ADDRESS: ${rAddress}`, { x: midX, y: rightY, size: 8, font: font, color: darkBlue });
  rightY -= 20;
  page.drawText(`CITY: ${rCity}`, { x: midX, y: rightY, size: 8, font: font, color: darkBlue });
  rightY -= 20;
  page.drawText(`STATE: ${rState}`, { x: midX, y: rightY, size: 8, font: font, color: darkBlue });
  rightY -= 20;
  page.drawText(`STATE CODE: ${rStateCode}`, { x: midX, y: rightY, size: 8, font: font, color: darkBlue });
  rightY -= 20;
  page.drawText(`PLACE OF SUPPLY: ${rPos}`, { x: midX, y: rightY, size: 8, font: font, color: darkBlue });

  // Blue Table Header
  const tableY = byY - 110;
  page.drawRectangle({ x: 30, y: tableY - 25, width: width - 60, height: 25, color: darkBlue });
  
  const cols = [
    { label: 'SR.\nNO.', x: 30, w: 30, center: true },
    { label: 'DESCRIPTION OF GOODS', x: 60, w: 190, center: true },
    { label: 'HSN/SAC\nCODE', x: 250, w: 50, center: true },
    { label: 'PURITY\n(%)', x: 300, w: 50, center: true },
    { label: 'WEIGHT', x: 350, w: 50, center: true },
    { label: 'UNIT', x: 400, w: 30, center: true },
    { label: 'RATE (Rs)', x: 430, w: 60, center: true },
    { label: 'AMOUNT (Rs)', x: 490, w: 75, center: true },
  ];

  cols.forEach((c) => {
    const parts = c.label.split('\n');
    let textY = tableY - 10;
    if (parts.length === 1) textY -= 4;
    parts.forEach(p => {
       const tw = font.widthOfTextAtSize(p, 7);
       const tx = c.center ? c.x + (c.w - tw)/2 : c.x + 5;
       page.drawText(p, { x: tx, y: textY, size: 7, font: font, color: yellowCol });
       textY -= 9;
    });
  });

  const rowH = 150;
  const startRowY = tableY - 25;
  page.drawRectangle({ x: 30, y: startRowY - rowH, width: width - 60, height: rowH, borderColor: darkBlue, borderWidth: 1 });
  
  let curY = startRowY - 15;
  invoice.items.forEach((item, idx) => {
    const pStr = item.purityValue !== 'None' ? `${item.purityValue}${item.purityType === 'Karat'?'K':''}` : '';
    const desc = `${item.purityValue !== 'None' && item.purityType === 'Karat' ? item.purityValue + 'K ' : ''}${item.metal} ${item.itemName.toUpperCase()}`;
    
    page.drawText((idx+1).toString(), { x: cols[0].x + (cols[0].w - font.widthOfTextAtSize((idx+1).toString(), 8))/2, y: curY, size: 8, font: font, color: rgb(0,0,0) });
    page.drawText(desc, { x: cols[1].x + 5, y: curY, size: 8, font: font, color: rgb(0,0,0) });
    page.drawText(item.hsn, { x: cols[2].x + (cols[2].w - font.widthOfTextAtSize(item.hsn, 8))/2, y: curY, size: 8, font: font, color: rgb(0,0,0) });
    page.drawText(pStr, { x: cols[3].x + (cols[3].w - font.widthOfTextAtSize(pStr, 8))/2, y: curY, size: 8, font: font, color: rgb(0,0,0) });
    const wStr = item.weight.toFixed(2);
    page.drawText(wStr, { x: cols[4].x + (cols[4].w - font.widthOfTextAtSize(wStr, 8))/2, y: curY, size: 8, font: font, color: rgb(0,0,0) });
    page.drawText(item.weightUnit, { x: cols[5].x + (cols[5].w - font.widthOfTextAtSize(item.weightUnit, 8))/2, y: curY, size: 8, font: font, color: rgb(0,0,0) });
    
    const rStr = item.ratePerGram.toFixed(2);
    page.drawText(rStr, { x: cols[6].x + (cols[6].w - font.widthOfTextAtSize(rStr, 8))/2, y: curY, size: 8, font: font, color: rgb(0,0,0) });
    
    const amtStr = item.taxableAmount.toFixed(2);
    page.drawText(amtStr, { x: cols[7].x + (cols[7].w - font.widthOfTextAtSize(amtStr, 8))/2, y: curY, size: 8, font: bold, color: darkBlue });
    
    curY -= 15;
  });

  // Vertical lines
  for (let i = 1; i < cols.length; i++) {
    page.drawLine({ start: { x: cols[i].x, y: tableY - 25 }, end: { x: cols[i].x, y: startRowY - rowH }, thickness: 0.5, color: darkBlue });
  }

  // Totals Section
  const totY = startRowY - rowH - 10;
  
  // Left side: Amount in Words box
  page.drawRectangle({ x: 30, y: totY - 15, width: 300, height: 15, color: darkBlue });
  page.drawText('Rs AMOUNT IN WORDS', { x: 30 + (300 - font.widthOfTextAtSize('Rs AMOUNT IN WORDS', 8))/2, y: totY - 10, size: 8, font: font, color: yellowCol });
  
  page.drawRectangle({ x: 30, y: totY - 45, width: 300, height: 30, borderColor: darkBlue, borderWidth: 1 });
  page.drawText(numberToWords(invoice.payableAmount), { x: 35, y: totY - 32, size: 8, font: bold, color: darkBlue });

  // Right side: Tax Breakdown Box
  const rX = 340;
  const rW = width - 30 - 340;
  page.drawRectangle({ x: rX, y: totY - 15, width: rW, height: 15, color: darkBlue });
  page.drawText('TAX BREAKDOWN', { x: rX + (rW - font.widthOfTextAtSize('TAX BREAKDOWN', 8))/2, y: totY - 10, size: 8, font: font, color: yellowCol });
  
  page.drawRectangle({ x: rX, y: totY - 120, width: rW, height: 105, borderColor: darkBlue, borderWidth: 1 });
  
  let ty = totY - 30;
  const drawT = (lbl: string, val: string, isBld: boolean = false) => {
     page.drawText(lbl, { x: rX + 5, y: ty, size: 8, font: isBld ? bold : font, color: rgb(0,0,0) });
     page.drawText(val, { x: rX + rW - 5 - (isBld ? bold : font).widthOfTextAtSize(val, 8), y: ty, size: 8, font: isBld ? bold : font, color: rgb(0,0,0) });
     ty -= 15;
  };
  
  const totalTaxable = invoice.items.reduce((s, i) => s + i.taxableAmount, 0) - invoice.discountApplied;
  drawT('TAXABLE AMOUNT', `Rs ${totalTaxable.toFixed(2)}`);
  drawT(`CGST @ ${invoice.taxDetails.cgstPercent}%`, `Rs ${invoice.taxDetails.cgst.toFixed(2)}`);
  drawT(`SGST @ ${invoice.taxDetails.sgstPercent}%`, `Rs ${invoice.taxDetails.sgst.toFixed(2)}`);
  drawT('TOTAL TAX', `Rs ${(invoice.taxDetails.cgst + invoice.taxDetails.sgst + invoice.taxDetails.igst).toFixed(2)}`);
  
  page.drawRectangle({ x: rX, y: ty - 2, width: rW, height: 15, color: darkBlue });
  page.drawText('GRAND TOTAL', { x: rX + 5, y: ty + 3, size: 8, font: bold, color: yellowCol });
  const gtStr = `Rs ${invoice.grandTotal.toFixed(2)}`;
  page.drawText(gtStr, { x: rX + rW - 5 - bold.widthOfTextAtSize(gtStr, 8), y: ty + 3, size: 8, font: bold, color: yellowCol });
  ty -= 15;
  
  const roundOff = invoice.payableAmount - invoice.grandTotal;
  drawT('ROUND OFF', `${roundOff >= 0 ? '+' : '-'} Rs ${Math.abs(roundOff).toFixed(2)}`);
  
  page.drawRectangle({ x: rX, y: ty - 2, width: rW, height: 15, color: yellowCol });
  page.drawText('FINAL AMOUNT', { x: rX + 5, y: ty + 3, size: 8, font: bold, color: rgb(1,1,1) });
  const faStr = `Rs ${invoice.payableAmount.toFixed(2)}`;
  page.drawText(faStr, { x: rX + rW - 5 - bold.widthOfTextAtSize(faStr, 8), y: ty + 3, size: 8, font: bold, color: rgb(1,1,1) });

  // Bank Details
  const bankY = totY - 135;
  page.drawRectangle({ x: 30, y: bankY - 15, width: width - 60, height: 15, color: darkBlue });
  const bdW2 = font.widthOfTextAtSize('BANK DETAILS', 8);
  page.drawText('◆ BANK DETAILS', { x: (width - bdW2 - 15)/2, y: bankY - 10, size: 8, font: font, color: yellowCol });
  
  page.drawRectangle({ x: 30, y: bankY - 105, width: width - 60, height: 90, borderColor: darkBlue, borderWidth: 1 });
  let bdy = bankY - 35;
  const bLines = [
    `BANK NAME: ${profile.bankName || ''}`,
    `BRANCH: ${profile.branch || ''}`,
    `A/C NAME: ${profile.accountName || ''}`,
    `A/C NO.: ${profile.accountNo || ''}`,
    `IFSC CODE: ${profile.ifsc || ''}`
  ];
  bLines.forEach(l => {
     page.drawText(l, { x: 40, y: bdy, size: 8, font: font, color: darkBlue });
     bdy -= 15;
  });

  // Footer text
  const footY = bankY - 130;
  page.drawText('— SUBJECT TO KOLKATA JURISDICTION —', { x: 30, y: footY, size: 7, font: oblique, color: rgb(0,0,0) });
  page.drawText('E&OE', { x: 30, y: footY - 12, size: 7, font: font, color: rgb(0,0,0) });

  const fsRight = `FOR ${brandName}`;
  page.drawText(fsRight, { x: width - 30 - font.widthOfTextAtSize(fsRight, 8), y: footY, size: 8, font: font, color: rgb(0,0,0) });
  
  page.drawLine({ start: { x: width - 150, y: footY - 45 }, end: { x: width - 30, y: footY - 45 }, thickness: 0.5, color: rgb(0.5,0.5,0.5) });
  const authTxt = invoice.isSwappedAddress ? profile.legalName.toUpperCase() : brandName;
  page.drawText(authTxt, { x: width - 30 - oblique.widthOfTextAtSize(authTxt, 8), y: footY - 55, size: 8, font: oblique, color: rgb(0,0,0) });
  page.drawText('AUTHORISED SIGNATORY', { x: width - 30 - font.widthOfTextAtSize('AUTHORISED SIGNATORY', 7), y: footY - 65, size: 7, font: font, color: rgb(0,0,0) });

  // Bottom Banner
  const botY = 30;
  page.drawRectangle({ x: 30, y: botY, width: width - 60, height: 20, color: darkBlue });
  page.drawText('THANK YOU FOR YOUR BUSINESS!', { x: 40, y: botY + 7, size: 7, font: font, color: rgb(1,1,1) });
  
  const trustTxt = 'TRUSTED FOR PURITY. COMMITTED TO EXCELLENCE.';
  page.drawText(trustTxt, { x: width - 40 - font.widthOfTextAtSize(trustTxt, 7), y: botY + 7, size: 7, font: font, color: yellowCol });
  
  // Center diamond
  page.drawText('◆', { x: (width - 10)/2, y: botY + 7, size: 8, font: font, color: yellowCol });
}
