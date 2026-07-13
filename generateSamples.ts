import fs from 'fs';
import path from 'path';
import { generateAndDownloadPDF } from './src/utils/pdfGenerator';
import { Invoice, BusinessProfile } from './src/db/database';

const profile: BusinessProfile = {
  id: 1,
  brandName: 'Sri Narayan Jewellers',
  legalName: 'Sri Narayan Jewellers',
  tagline: 'WHOLESALE JEWELLERS',
  estdYear: 1987,
  logoData: '',
  gstin: '19BCPPA4905E1ZQ',
  pan: 'BCPPA4905E',
  stateName: 'West Bengal',
  stateCode: '19',
  address: 'Ground Floor, 71no Monohar Das Street, Kolkata, West Bengal-700007',
  city: 'Kolkata',
  phone: '+91 90518 28676',
  email: 'srinarayanjewellers5@gmail.com',
  bankName: 'KOTAK MAHINDRA BANK',
  accountNo: '7861987108',
  ifsc: 'KKBK0006606',
  branch: 'CHINI PATTI, BURRA BAZAR',
  jurisdiction: 'KOLKATA',
  templateId: 1,
  showPurityColumn: true,
  taxInvoicePrefix: 'SNJ',
  challanPrefix: 'SNJ-DC'
};

const invoice: Invoice = {
  invoiceId: 'SNJ/26-27/021',
  type: 'TAX_INVOICE',
  date: new Date('2026-05-30').getTime(),
  profileId: 1,
  templateId: 1,
  customerDetails: {
    partyName: 'PARANKUSH JEWELLERS',
    phone: 'NILL',
    address: '38, LAKSHMI NARAYAN CHAKRABORTY LANE, PO KADAMTALA, PS BANTRA, Howrah',
    gstin: '19ASQPM0070N1Z6',
    panAadhaar: 'ASQPM0070N',
    idType: 'PAN',
    stateName: 'West Bengal',
    stateCode: '19',
    city: 'Kolkata',
    placeOfSupply: 'West Bengal, Kolkata'
  },
  items: [
    {
      id: '1',
      metal: 'GOLD',
      itemName: 'Gold Ornaments',
      hsn: '711319',
      purityType: 'Karat',
      purityValue: '9K375',
      weight: 16.11,
      weightUnit: 'gm',
      weightInGrams: 16.11,
      ratePerGram: 7951.95,
      taxableAmount: 128105.91
    }
  ],
  isSwappedAddress: false,
  taxDetails: {
    cgstPercent: 1.5,
    cgst: 1921.59,
    sgstPercent: 1.5,
    sgst: 1921.59,
    igstPercent: 3,
    igst: 0
  },
  discountApplied: 0,
  roundOff: -0.09,
  grandTotal: 131949.00,
  payableAmount: 131949.00,
  paymentMode: 'Cash'
};

async function run() {
  const scratchDir = 'C:\\Users\\ASUS\\.gemini\\antigravity\\brain\\b7d6f905-b265-4445-8009-1fc810b5df9c';
  
  // 1. Template A (Agarwal), Purity ON
  profile.templateId = 1;
  profile.showPurityColumn = true;
  let pdf1 = await generateAndDownloadPDF(invoice, profile);
  fs.writeFileSync(path.join(scratchDir, 'Template_A_Purity_ON.pdf'), pdf1);

  // 2. Template A, Purity OFF
  profile.showPurityColumn = false;
  let pdf2 = await generateAndDownloadPDF(invoice, profile);
  fs.writeFileSync(path.join(scratchDir, 'Template_A_Purity_OFF.pdf'), pdf2);

  // 3. Template B (SNJ), Purity ON
  profile.templateId = 2;
  profile.showPurityColumn = true;
  let pdf3 = await generateAndDownloadPDF(invoice, profile);
  fs.writeFileSync(path.join(scratchDir, 'Template_B_Purity_ON.pdf'), pdf3);

  // 4. Template B, Purity OFF
  profile.showPurityColumn = false;
  let pdf4 = await generateAndDownloadPDF(invoice, profile);
  fs.writeFileSync(path.join(scratchDir, 'Template_B_Purity_OFF.pdf'), pdf4);

  console.log('Successfully generated all 4 PDFs!');
}

run().catch(console.error);
