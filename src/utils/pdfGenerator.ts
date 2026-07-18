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

function formatCurrency(val: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

export async function generateAndDownloadPDF(invoice: Invoice, profile: BusinessProfile) {
  const templateId = profile.templateId || 1;
  const templateName = templateId === 1 ? 'final_perfect_invoice.html' : 'sri_narayan_invoice.html';
  
  // Use Vite's import.meta.env.BASE_URL to resolve paths correctly in production (e.g. GitHub Pages)
  const baseUrl = import.meta.env.BASE_URL || '/';
  
  let htmlText = '';
  try {
    const response = await fetch(`${baseUrl}${templateName}`);
    if (!response.ok) throw new Error('Network response was not ok');
    htmlText = await response.text();
  } catch (error) {
    console.error('Failed to fetch template:', error);
    alert('Failed to load invoice template.');
    return;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  const setField = (fieldName: string, value: string) => {
    const els = doc.querySelectorAll(`[data-field="${fieldName}"]`);
    els.forEach(el => { el.textContent = value; });
  };

  const invoiceDateStr = new Date(invoice.date).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).toUpperCase().replace(/ /g, '-');

  const financialYear = (() => {
    const d = new Date(invoice.date);
    const m = d.getMonth();
    const y = d.getFullYear();
    if (m < 3) return `${y-1}-${y.toString().slice(-2)}`;
    return `${y}-${(y+1).toString().slice(-2)}`;
  })();

  // 1. Seller Information
  setField('sellerGstin', profile.gstin || 'NILL');
  setField('sellerName', profile.legalName || 'NILL');
  setField('sellerAddress', profile.address || 'NILL');
  setField('sellerState', profile.stateName || 'NILL');
  setField('sellerContact', profile.phone || 'NILL');
  setField('sellerEmail', profile.email || 'NILL');
  setField('sellerLegalName', profile.legalName || 'NILL');

  // 2. Invoice Info
  setField('invoiceId', invoice.invoiceId || 'NILL');
  setField('invoiceDate', invoiceDateStr);
  setField('financialYear', financialYear);
  setField('businessStateCode', profile.stateCode || '19'); // Default 19 WB
  setField('jurisdiction', profile.city || 'KOLKATA');
  setField('jurisdictionLine', `— SUBJECT TO ${profile.city?.toUpperCase() || 'KOLKATA'} JURISDICTION —`);
  setField('signatoryForLine', `FOR ${profile.legalName || 'COMPANY'}`);
  setField('signatoryName', profile.legalName || 'COMPANY');

  // 3. Buyer Information
  setField('buyerName', invoice.customerDetails.partyName || 'NILL');
  setField('buyerAddress', invoice.customerDetails.address || 'NILL');
  setField('buyerCity', invoice.customerDetails.city || 'NILL');
  setField('buyerContact', invoice.customerDetails.phone || 'NILL');
  setField('buyerGstin', invoice.customerDetails.gstin || 'NILL');
  setField('buyerPan', invoice.customerDetails.panAadhaar || 'NILL');
  setField('buyerState', invoice.customerDetails.stateName || 'NILL');
  setField('buyerStateCode', invoice.customerDetails.stateCode || 'NILL');
  setField('placeOfSupply', `${invoice.customerDetails.stateName || ''}, ${invoice.customerDetails.city || ''}`);

  // 4. Items Table
  const tbody = doc.querySelector('tbody');
  if (tbody) {
    tbody.innerHTML = ''; // clear existing mock rows
    
    invoice.items.forEach((item, index) => {
      const tr = doc.createElement('tr');
      tr.className = 'item-row';
      
      const itemAmount = item.taxableAmount || (item.weightInGrams * item.ratePerGram);
      const finalAmount = itemAmount;

      if (templateId === 1) {
        tr.innerHTML = `
          <td class="serial" style="text-align: center;">${index + 1}</td>
          <td>${item.itemName}</td>
          <td class="hsn" style="text-align: center;">${item.hsn || '7113'}</td>
          <td class="purity" style="text-align: center;">${item.purityValue || ''}</td>
          <td class="weight" style="text-align: center;">${item.weightInGrams.toFixed(2)}</td>
          <td class="rate" style="text-align: right;">${formatCurrency(item.ratePerGram)}</td>
          <td class="discount" style="text-align: center;">0</td>
          <td class="amount" style="text-align: right;">${formatCurrency(finalAmount)}</td>
        `;
      } else {
        tr.innerHTML = `
          <td class="serial" style="text-align: center;">${index + 1}</td>
          <td class="desc">${item.itemName}</td>
          <td class="hsn" style="text-align: center;">${item.hsn || '7113'}</td>
          <td class="purity" style="text-align: center;">${item.purityValue || ''}</td>
          <td class="weight" style="text-align: center;">${item.weightInGrams.toFixed(2)}</td>
          <td class="unit" style="text-align: center;">gm</td>
          <td class="rate" style="text-align: right;">${formatCurrency(item.ratePerGram)}</td>
          <td class="discount" style="text-align: center;">0</td>
          <td class="amount" style="text-align: right;">${formatCurrency(finalAmount)}</td>
        `;
      }
      tbody.appendChild(tr);
    });
    
    // Add a filler row to push totals down in template 1
    if (templateId === 1) {
      const filler = doc.createElement('tr');
      filler.className = 'filler-row';
      filler.innerHTML = '<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>';
      tbody.appendChild(filler);
    }
  }

  // 5. Totals
  const taxableAmount = invoice.items.reduce((acc, item) => {
    const amt = item.taxableAmount || (item.weightInGrams * item.ratePerGram);
    return acc + amt;
  }, 0);
  
  const totalTax = (invoice.taxDetails?.cgst || 0) + (invoice.taxDetails?.sgst || 0) + (invoice.taxDetails?.igst || 0);
  const totalWithTax = taxableAmount + totalTax;
  const roundOff = invoice.payableAmount - totalWithTax;
  
  setField('totalAmount', formatCurrency(taxableAmount));
  setField('taxableAmount', '₹ ' + formatCurrency(taxableAmount));
  
  setField('cgstAmount', templateId === 1 ? formatCurrency(invoice.taxDetails?.cgst || 0) : '₹ ' + formatCurrency(invoice.taxDetails?.cgst || 0));
  setField('sgstAmount', templateId === 1 ? formatCurrency(invoice.taxDetails?.sgst || 0) : '₹ ' + formatCurrency(invoice.taxDetails?.sgst || 0));
  setField('igstAmount', templateId === 1 ? formatCurrency(invoice.taxDetails?.igst || 0) : '₹ ' + formatCurrency(invoice.taxDetails?.igst || 0));
  
  setField('cgstLabel', `CGST @ ${invoice.taxDetails?.cgstPercent || 1.5}%`);
  setField('sgstLabel', `SGST @ ${invoice.taxDetails?.sgstPercent || 1.5}%`);
  setField('igstLabel', `IGST @ ${invoice.taxDetails?.igstPercent || 3}%`);

  setField('totalTax', '₹ ' + formatCurrency(totalTax));
  
  setField('roundOff', (templateId === 2 ? '₹ ' : '') + formatCurrency(roundOff));
  setField('grandTotal', templateId === 1 ? Math.round(invoice.payableAmount).toString() : '₹ ' + formatCurrency(totalWithTax));
  setField('finalAmount', '₹ ' + formatCurrency(invoice.payableAmount));

  setField('amountInWords', numberToWords(Math.round(invoice.payableAmount)));

  // 6. Bank Details
  setField('bankName', profile.bankName || 'NILL');
  setField('bankBranch', profile.branch || 'NILL');
  setField('accountName', profile.accountName || 'NILL');
  setField('accountNo', profile.accountNo || 'NILL');
  setField('ifscCode', profile.ifsc || 'NILL');
  setField('bankAccountName', profile.accountName || 'NILL');
  setField('bankAccountNumber', profile.accountNo || 'NILL');
  setField('bankIfsc', profile.ifsc || 'NILL');

  // Inject logo if available
  if (profile.logoData) {
    const imgTags = doc.querySelectorAll('img');
    if (imgTags.length > 0) {
      imgTags[0].src = profile.logoData;
    }
  }

  // Dynamic configuration for copies and columns
  const showPurity = profile.showPurityColumn !== false;
  const showDiscount = false; // Item level discount not supported in DB
  
  const configScript = doc.createElement('script');
  configScript.textContent = `window.invoiceConfig = { showPurity: ${showPurity}, showDiscount: ${showDiscount} };`;
  doc.head.appendChild(configScript);

  // Convert modified DOM back to HTML string
  const finalHtml = doc.documentElement.outerHTML;
  
  // Open print window
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write('<!DOCTYPE html>\n' + finalHtml);
    printWindow.document.close();
    
    // Auto trigger print after a brief delay for rendering
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 750);
  } else {
    alert('Please allow popups to generate and print the invoice.');
  }
}
