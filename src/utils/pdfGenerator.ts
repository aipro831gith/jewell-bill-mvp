import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Invoice, BusinessProfile } from '../db/database';

export async function generateAndDownloadPDF(invoice: Invoice, profile: BusinessProfile) {
  const pdfDoc = await PDFDocument.create();
  
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const numPages = 3;
  const isChallan = invoice.type === 'DELIVERY_CHALLAN';

  const invoiceDateStr = new Date(invoice.date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Inherit templateId from invoice or profile fallback
  const templateId = invoice.templateId || profile.templateId || 1;

  for (let i = 1; i <= numPages; i++) {
    const page = pdfDoc.addPage([595.27, 841.89]);
    const { width, height } = page.getSize();

    let copyLabel = '';
    if (isChallan) {
      if (i === 1) copyLabel = 'COPY 1: ORIGINAL FOR CONSIGNEE';
      else if (i === 2) copyLabel = 'COPY 2: DUPLICATE FOR TRANSPORTER';
      else copyLabel = 'COPY 3: TRIPLICATE FOR CONSIGNOR';
    } else {
      if (i === 1) copyLabel = 'COPY 1: ORIGINAL FOR RECIPIENT';
      else if (i === 2) copyLabel = 'COPY 2: DUPLICATE FOR TRANSPORTER';
      else copyLabel = 'COPY 3: TRIPLICATE FOR SUPPLIER';
    }

    let primaryColor = rgb(0.08, 0.08, 0.12);
    let accentColor = rgb(0.12, 0.12, 0.16);
    let borderGray = rgb(0.8, 0.8, 0.8);
    let lightGray = rgb(0.95, 0.95, 0.96);
    const darkGray = rgb(0.4, 0.4, 0.4);
    const textColor = rgb(0.15, 0.15, 0.18);

    if (templateId === 2) {
      primaryColor = rgb(0.53, 0.07, 0.22);
      accentColor = rgb(0.7, 0.1, 0.3);
      borderGray = rgb(0.85, 0.75, 0.78);
      lightGray = rgb(0.98, 0.94, 0.95);
    } else if (templateId === 3) {
      primaryColor = rgb(0.05, 0.05, 0.05);
      accentColor = rgb(0.76, 0.52, 0.1);
      borderGray = rgb(0.75, 0.65, 0.45);
      lightGray = rgb(0.97, 0.96, 0.92);
    }

    page.drawRectangle({
      x: 30,
      y: 30,
      width: width - 60,
      height: height - 60,
      borderColor: borderGray,
      borderWidth: 1,
    });

    if (templateId === 1 || templateId === 3) {
      page.drawRectangle({
        x: 30,
        y: height - 65,
        width: width - 60,
        height: 35,
        color: primaryColor,
      });

      if (templateId === 3) {
        page.drawLine({
          start: { x: 30, y: height - 65 },
          end: { x: width - 30, y: height - 65 },
          color: accentColor,
          thickness: 1.5,
        });
      }

      page.drawText(isChallan ? 'DELIVERY CHALLAN' : 'TAX INVOICE', {
        x: 45,
        y: height - 52,
        size: 13,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      page.drawText(copyLabel, {
        x: width - 250,
        y: height - 50,
        size: 8.5,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });
    } else {
      page.drawLine({
        start: { x: 30, y: height - 65 },
        end: { x: width - 30, y: height - 65 },
        color: primaryColor,
        thickness: 2,
      });

      page.drawText(isChallan ? 'DELIVERY CHALLAN' : 'TAX INVOICE', {
        x: 45,
        y: height - 52,
        size: 14,
        font: helveticaBold,
        color: primaryColor,
      });

      page.drawText(copyLabel, {
        x: width - 250,
        y: height - 50,
        size: 8.5,
        font: helveticaBold,
        color: textColor,
      });
    }

    const brandColor = (templateId === 2) ? primaryColor : (templateId === 3) ? accentColor : textColor;

    const sName = invoice.isSwappedAddress ? invoice.customerDetails.partyName.toUpperCase() : profile.brandName.toUpperCase();
    const sLegalName = invoice.isSwappedAddress ? invoice.customerDetails.partyName : profile.legalName;
    const sTagline = invoice.isSwappedAddress ? 'CONSIGNOR / SENDER' : (profile.tagline ? `"${profile.tagline}"` : '');
    const sAddress = invoice.isSwappedAddress ? invoice.customerDetails.address : profile.address;
    const sCityState = invoice.isSwappedAddress 
      ? `${invoice.customerDetails.city} - ${invoice.customerDetails.stateName} (Code: ${invoice.customerDetails.stateCode})`
      : `${profile.city} - ${profile.stateName} (Code: ${profile.stateCode})`;
    const sContact = invoice.isSwappedAddress 
      ? `Phone: ${invoice.customerDetails.phone}`
      : `Phone: ${profile.phone} | Email: ${profile.email}`;
    const sGstinPan = invoice.isSwappedAddress 
      ? `GSTIN: ${invoice.customerDetails.gstin || 'NILL'} | PAN/Aadhaar: ${invoice.customerDetails.panAadhaar}`
      : `GSTIN: ${profile.gstin} | PAN: ${profile.pan}`;
    
    page.drawText(sName, { x: 45, y: height - 90, size: 14, font: helveticaBold, color: brandColor });
    page.drawText(sLegalName, { x: 45, y: height - 105, size: 9, font: helveticaFont, color: textColor });
    page.drawText(sTagline, { x: 45, y: height - 118, size: 8, font: helveticaFont, color: darkGray });

    const addressLines = [sAddress, sCityState, sContact, sGstinPan];
    let profileY = height - 132;
    addressLines.forEach((line) => {
      page.drawText(line, { x: 45, y: profileY, size: 8.5, font: helveticaFont, color: textColor });
      profileY -= 12;
    });

    const infoX = width - 240;
    let infoY = height - 90;
    
    const invoiceInfo = [
      { label: isChallan ? 'Challan No:' : 'Invoice No:', val: invoice.invoiceId, bold: true },
      { label: 'Date:', val: invoiceDateStr, bold: false },
      { label: 'Place of Supply:', val: invoice.customerDetails.placeOfSupply, bold: false },
      { label: 'GST State:', val: `${profile.stateName} (Code: ${profile.stateCode})`, bold: false },
    ];

    const showPaymentMode = invoice.paymentMode && invoice.paymentMode !== 'None';
    if (showPaymentMode) {
      invoiceInfo.push({ label: 'Payment Mode:', val: invoice.paymentMode, bold: false });
    }

    invoiceInfo.forEach((item) => {
      page.drawText(item.label, { x: infoX, y: infoY, size: 9, font: helveticaBold, color: textColor });
      page.drawText(item.val, { x: infoX + 90, y: infoY, size: 9, font: item.bold ? helveticaBold : helveticaFont, color: textColor });
      infoY -= 14;
    });

    page.drawLine({
      start: { x: 30, y: height - 195 },
      end: { x: width - 30, y: height - 195 },
      color: borderGray,
      thickness: 1,
    });

    const custY = height - 212;
    page.drawText(isChallan ? 'CONSIGNEE DETAILS:' : 'BILLED TO (RECIPIENT):', { x: 45, y: custY, size: 10, font: helveticaBold, color: (templateId === 2 || templateId === 3) ? primaryColor : textColor });
    
    const custDetails = invoice.customerDetails;
    const rName = invoice.isSwappedAddress ? profile.legalName : custDetails.partyName;
    const rPhone = invoice.isSwappedAddress ? profile.phone : custDetails.phone;
    const rAddress = invoice.isSwappedAddress ? `${profile.address}, ${profile.city}` : `${custDetails.address}, ${custDetails.city}`;
    const rState = invoice.isSwappedAddress ? `${profile.stateName} (Code: ${profile.stateCode})` : `${custDetails.stateName} (Code: ${custDetails.stateCode})`;
    const rGstinId = invoice.isSwappedAddress 
      ? `GSTIN: ${profile.gstin} | PAN: ${profile.pan}`
      : (custDetails.gstin && custDetails.gstin !== 'NILL' 
         ? `GSTIN: ${custDetails.gstin} | ${custDetails.idType}: ${custDetails.panAadhaar}`
         : `${custDetails.idType}: ${custDetails.panAadhaar}`);

    const customerLines = [
      `Party Name: ${rName}`,
      `Phone: ${rPhone}`,
      `Address: ${rAddress}`,
      `State: ${rState}`,
      rGstinId
    ];

    let lineY = custY - 14;
    customerLines.forEach((line) => {
      page.drawText(line, { x: 45, y: lineY, size: 9, font: helveticaFont, color: textColor });
      lineY -= 12;
    });

    page.drawLine({
      start: { x: 30, y: height - 285 },
      end: { x: width - 30, y: height - 285 },
      color: borderGray,
      thickness: 1,
    });

    const tableHeaderY = height - 300;
    page.drawRectangle({
      x: 30,
      y: tableHeaderY - 5,
      width: width - 60,
      height: 18,
      color: lightGray,
    });

    const columns = [
      { name: 'Sr', x: 35, width: 20, align: 'left' },
      { name: 'Description of Goods', x: 60, width: 175, align: 'left' },
      { name: 'HSN', x: 240, width: 45, align: 'left' },
      { name: 'Purity', x: 290, width: 75, align: 'left' },
      { name: 'Weight', x: 370, width: 55, align: 'right' },
      { name: 'Rate/g (Rs.)', x: 435, width: 55, align: 'right' },
      { name: 'Taxable Val (Rs.)', x: 495, width: 65, align: 'right' },
    ];

    columns.forEach((col) => {
      const colColor = (templateId === 2 || templateId === 3) ? primaryColor : textColor;
      page.drawText(col.name, {
        x: col.align === 'right' ? col.x + col.width - helveticaBold.widthOfTextAtSize(col.name, 8.5) : col.x,
        y: tableHeaderY,
        size: 8.5,
        font: helveticaBold,
        color: colColor,
      });
    });

    page.drawLine({
      start: { x: 30, y: tableHeaderY - 5 },
      end: { x: width - 30, y: tableHeaderY - 5 },
      color: borderGray,
      thickness: 1,
    });

    let rowY = tableHeaderY - 20;
    invoice.items.forEach((item, index) => {
      const isPurityNone = item.purityValue === 'None' || item.purityValue === '0' || item.purityValue.trim() === '';
      const purityDisplay = isPurityNone ? '' : `${item.purityValue} (${item.purityType === 'Karat' ? 'K' : '%'})`;

      const rowData = [
        { val: (index + 1).toString(), x: 35, width: 20, align: 'left' },
        { val: `${item.metal} - ${item.itemName}`, x: 60, width: 175, align: 'left' },
        { val: item.hsn, x: 240, width: 45, align: 'left' },
        { val: purityDisplay, x: 290, width: 75, align: 'left' },
        { val: `${item.weight} ${item.weightUnit}`, x: 370, width: 55, align: 'right' },
        { val: item.ratePerGram.toFixed(2), x: 435, width: 55, align: 'right' },
        { val: item.taxableAmount.toFixed(2), x: 495, width: 65, align: 'right' },
      ];

      rowData.forEach((col, cIdx) => {
        const cConfig = columns[cIdx];
        page.drawText(col.val, {
          x: col.align === 'right' ? cConfig.x + cConfig.width - helveticaFont.widthOfTextAtSize(col.val, 8.5) : cConfig.x,
          y: rowY,
          size: 8.5,
          font: helveticaFont,
          color: textColor,
        });
      });

      rowY -= 15;
    });

    const vLines = [30, 55, 235, 285, 365, 425, 490, width - 30];
    vLines.forEach((x) => {
      page.drawLine({
        start: { x, y: tableHeaderY + 13 },
        end: { x, y: rowY + 10 },
        color: borderGray,
        thickness: 0.5,
      });
    });

    page.drawLine({
      start: { x: 30, y: rowY + 10 },
      end: { x: width - 30, y: rowY + 10 },
      color: borderGray,
      thickness: 1,
    });

    let summaryY = rowY - 5;
    
    const drawSummaryRow = (label: string, valueStr: string, isBold: boolean = false) => {
      const fontToUse = isBold ? helveticaBold : helveticaFont;
      const labelColor = isBold && (templateId === 2 || templateId === 3) ? primaryColor : textColor;
      page.drawText(label, {
        x: width - 240,
        y: summaryY,
        size: 9,
        font: fontToUse,
        color: labelColor,
      });
      page.drawText(valueStr, {
        x: width - 40 - fontToUse.widthOfTextAtSize(valueStr, 9),
        y: summaryY,
        size: 9,
        font: fontToUse,
        color: labelColor,
      });
      summaryY -= 14;
    };

    const totalWeightStr = `${invoice.items.reduce((sum, item) => sum + item.weightInGrams, 0).toFixed(2)} g`;
    const totalTaxableStr = `Rs.${invoice.items.reduce((sum, item) => sum + item.taxableAmount, 0).toFixed(2)}`;
    
    drawSummaryRow('Total Gold/Silver Weight:', totalWeightStr, false);
    drawSummaryRow('Subtotal Taxable Amount:', totalTaxableStr, false);

    if (invoice.discountApplied > 0) {
      drawSummaryRow('Discount Applied (Less):', `-Rs.${invoice.discountApplied.toFixed(2)}`, false);
      const afterDiscount = (invoice.items.reduce((sum, item) => sum + item.taxableAmount, 0) - invoice.discountApplied);
      drawSummaryRow('Net Taxable Subtotal:', `Rs.${afterDiscount.toFixed(2)}`, false);
    }

    if (invoice.taxDetails.cgst > 0 || invoice.taxDetails.sgst > 0) {
      drawSummaryRow(`CGST (${invoice.taxDetails.cgstPercent}%):`, `Rs.${invoice.taxDetails.cgst.toFixed(2)}`, false);
      drawSummaryRow(`SGST (${invoice.taxDetails.sgstPercent}%):`, `Rs.${invoice.taxDetails.sgst.toFixed(2)}`, false);
    } else if (invoice.taxDetails.igst > 0) {
      drawSummaryRow(`IGST (${invoice.taxDetails.igstPercent}%):`, `Rs.${invoice.taxDetails.igst.toFixed(2)}`, false);
    }

    drawSummaryRow('Grand Total (with Tax):', `Rs.${invoice.grandTotal.toFixed(2)}`, false);
    drawSummaryRow('Rounded Payable Amount:', `Rs.${invoice.payableAmount.toFixed(2)}`, true);

    const hasBank = profile.bankName && profile.bankName.trim() !== '';
    const hasUpi = profile.upiId && profile.upiId.trim() !== '';
    
    if (hasBank || hasUpi) {
      const bankBoxY = 160;
      page.drawRectangle({
        x: 40,
        y: bankBoxY - 95,
        width: 260,
        height: 105,
        borderColor: borderGray,
        borderWidth: 0.5,
        color: lightGray,
      });

      page.drawText('SUPPLIER BANK & PAYMENT DETAILS', { x: 45, y: bankBoxY, size: 8, font: helveticaBold, color: (templateId === 2 || templateId === 3) ? primaryColor : textColor });
      
      let bankInfoY = bankBoxY - 12;
      if (hasBank) {
        page.drawText(`Bank Name: ${profile.bankName}`, { x: 45, y: bankInfoY, size: 7.5, font: helveticaFont, color: textColor });
        bankInfoY -= 10;
        page.drawText(`A/c Name: ${profile.accountName || profile.legalName}`, { x: 45, y: bankInfoY, size: 7.5, font: helveticaFont, color: textColor });
        bankInfoY -= 10;
        page.drawText(`A/c No: ${profile.accountNo}`, { x: 45, y: bankInfoY, size: 7.5, font: helveticaFont, color: textColor });
        bankInfoY -= 10;
        page.drawText(`IFSC Code: ${profile.ifsc} | Branch: ${profile.branch}`, { x: 45, y: bankInfoY, size: 7.5, font: helveticaFont, color: textColor });
        bankInfoY -= 10;
      }

      if (hasUpi) {
        page.drawText(`UPI ID: ${profile.upiId}`, { x: 45, y: bankInfoY, size: 7.5, font: helveticaBold, color: textColor });
        bankInfoY -= 10;
      }
    }

    const termsY = 55;
    page.drawText('Terms & Conditions:', { x: 40, y: termsY + 12, size: 8, font: helveticaBold, color: textColor });
    page.drawText('1. Goods once sold will not be taken back.', { x: 40, y: termsY, size: 7, font: helveticaFont, color: darkGray });
    page.drawText('2. We declare that this invoice shows the actual price of the goods described.', { x: 40, y: termsY - 8, size: 7, font: helveticaFont, color: darkGray });

    page.drawText('E&OE', { x: 40, y: termsY - 20, size: 8, font: helveticaBold, color: textColor });

    // Dynamic Jurisdiction Footer
    const jurLabel = `SUBJECT TO ${profile.jurisdiction.toUpperCase()} JURISDICTION`;
    page.drawText(jurLabel, {
      x: width - 40 - helveticaBold.widthOfTextAtSize(jurLabel, 7.5),
      y: termsY - 20,
      size: 7.5,
      font: helveticaBold,
      color: textColor,
    });

    const sigY = 90;
    const sigLabel = invoice.isSwappedAddress 
      ? `For ${invoice.customerDetails.partyName.toUpperCase()}`
      : `For ${profile.legalName.toUpperCase()}`;
    page.drawText(sigLabel, {
      x: width - 40 - helveticaBold.widthOfTextAtSize(sigLabel, 8.5),
      y: sigY,
      size: 8.5,
      font: helveticaBold,
      color: textColor,
    });

    page.drawText('Authorised Signatory', {
      x: width - 40 - helveticaFont.widthOfTextAtSize('Authorised Signatory', 8),
      y: sigY - 35,
      size: 8,
      font: helveticaFont,
      color: textColor,
    });

    page.drawLine({
      start: { x: width - 150, y: sigY - 25 },
      end: { x: width - 40, y: sigY - 25 },
      color: borderGray,
      thickness: 0.5,
    });
  }

  const pdfBytes = await pdfDoc.save();

  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  // 1. Preview PDF in a new tab/window
  try {
    window.open(url, '_blank');
  } catch (e) {
    console.error('Failed to open PDF preview window', e);
  }

  // 2. Trigger automatic download
  const link = document.createElement('a');
  link.href = url;
  const fileName = `${invoice.type === 'TAX_INVOICE' ? 'Tax_Invoice' : 'Delivery_Challan'}_${invoice.invoiceId.replace(/\//g, '_')}.pdf`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Retain blob URL for 15 seconds to allow window preview to render
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 15000);
}
