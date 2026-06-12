import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

export interface BusinessProfile {
  id?: number;
  brandName: string;
  legalName: string;
  tagline: string;
  estdYear: number;
  taxInvoicePrefix: string;
  challanPrefix: string;
  logoData: string; // Base64
  gstin: string;
  pan: string;
  stateName: string;
  stateCode: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  jurisdiction: string;
  bankName?: string;
  branch?: string;
  accountName?: string;
  accountNo?: string;
  ifsc?: string;
  upiId?: string;
  qrCodeData?: string; // Base64
}

export interface Customer {
  id?: number;
  partyName: string;
  phone: string;
  address: string;
  city: string;
  stateName: string;
  stateCode: string;
  gstin: string;
  panAadhaar: string;
}

export interface InvoiceItem {
  id: string;
  metal: 'GOLD' | 'SILVER';
  itemName: string;
  hsn: string;
  purityType: 'Karat' | 'Percentage (%)';
  purityValue: string; // e.g. "22K916" or "91.6"
  weight: number; // in grams or kg entered
  weightUnit: 'gm' | 'kg';
  weightInGrams: number; // calculated standard value
  ratePerGram: number; // forced to 2 decimal places in calculations
  taxableAmount: number; // forced to 2 decimal places
}

export interface Invoice {
  invoiceId: string;
  type: 'TAX_INVOICE' | 'DELIVERY_CHALLAN';
  date: number; // timestamp
  profileId: number;
  customerDetails: {
    partyName: string;
    phone: string;
    address: string;
    city: string;
    stateName: string;
    stateCode: string;
    gstin: string;
    panAadhaar: string;
    idType: 'PAN' | 'AADHAAR';
    placeOfSupply: string;
  };
  items: InvoiceItem[];
  taxDetails: {
    cgst: number;
    sgst: number;
    igst: number;
    cgstPercent: number;
    sgstPercent: number;
    igstPercent: number;
  };
  discountApplied: number;
  grandTotal: number;
  payableAmount: number;
  paymentMode: 'Cash' | 'Card' | 'Bank Transfer' | 'UPI';
}

interface JewellBillDBSchema extends DBSchema {
  BusinessProfiles: {
    key: number;
    value: BusinessProfile;
    indexes: { id: number };
  };
  Customers: {
    key: number;
    value: Customer;
    indexes: { partyName: string };
  };
  Invoices: {
    key: string;
    value: Invoice;
  };
}

let dbPromise: Promise<IDBPDatabase<JewellBillDBSchema>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<JewellBillDBSchema>('JewellBillDB', 1, {
      upgrade(db) {
        // BusinessProfiles store
        if (!db.objectStoreNames.contains('BusinessProfiles')) {
          db.createObjectStore('BusinessProfiles', {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
        // Customers store for auto-fill
        if (!db.objectStoreNames.contains('Customers')) {
          const customerStore = db.createObjectStore('Customers', {
            keyPath: 'id',
            autoIncrement: true,
          });
          customerStore.createIndex('partyName', 'partyName');
        }
        // Invoices store
        if (!db.objectStoreNames.contains('Invoices')) {
          db.createObjectStore('Invoices', {
            keyPath: 'invoiceId',
          });
        }
      },
    });
  }
  return dbPromise;
}

// Business Profile Operations
export async function getActiveProfile(): Promise<BusinessProfile | null> {
  const db = await getDB();
  const profiles = await db.getAll('BusinessProfiles');
  return profiles.length > 0 ? profiles[0] : null;
}

export async function saveProfile(profile: BusinessProfile): Promise<number> {
  const db = await getDB();
  // We only maintain ONE active profile, so if there is an existing one, update it.
  const profiles = await db.getAll('BusinessProfiles');
  if (profiles.length > 0 && profiles[0].id !== undefined) {
    profile.id = profiles[0].id;
    await db.put('BusinessProfiles', profile);
    return profiles[0].id;
  } else {
    return await db.add('BusinessProfiles', profile);
  }
}

// Customer Operations
export async function searchCustomers(query: string): Promise<Customer[]> {
  const db = await getDB();
  const allCustomers = await db.getAll('Customers');
  if (!query.trim()) return [];
  const lowercaseQuery = query.toLowerCase();
  return allCustomers.filter((c) =>
    c.partyName.toLowerCase().includes(lowercaseQuery) ||
    c.phone.includes(lowercaseQuery)
  );
}

export async function saveCustomer(customer: Omit<Customer, 'id'>): Promise<number> {
  const db = await getDB();
  const allCustomers = await db.getAll('Customers');
  
  // Prevent duplicate customers by matching name and phone
  const existing = allCustomers.find(
    (c) =>
      c.partyName.toLowerCase() === customer.partyName.toLowerCase() &&
      c.phone === customer.phone
  );

  if (existing && existing.id !== undefined) {
    const updatedCustomer = { ...customer, id: existing.id };
    await db.put('Customers', updatedCustomer);
    return existing.id;
  } else {
    return await db.add('Customers', customer);
  }
}

// Invoice Operations
export async function getAllInvoices(): Promise<Invoice[]> {
  const db = await getDB();
  return await db.getAll('Invoices');
}

export async function getInvoice(invoiceId: string): Promise<Invoice | undefined> {
  const db = await getDB();
  return await db.get('Invoices', invoiceId);
}

export async function saveInvoice(invoice: Invoice): Promise<string> {
  const db = await getDB();
  await db.put('Invoices', invoice);
  
  // Silent customer saving/updating on invoice creation
  const customerToSave: Omit<Customer, 'id'> = {
    partyName: invoice.customerDetails.partyName,
    phone: invoice.customerDetails.phone,
    address: invoice.customerDetails.address,
    city: invoice.customerDetails.city,
    stateName: invoice.customerDetails.stateName,
    stateCode: invoice.customerDetails.stateCode,
    gstin: invoice.customerDetails.gstin,
    panAadhaar: invoice.customerDetails.panAadhaar,
  };
  
  // Do not save "NILL" customers as templates
  if (customerToSave.partyName !== 'NILL') {
    await saveCustomer(customerToSave);
  }

  return invoice.invoiceId;
}

export async function getNextInvoiceNumber(prefix: string, type: 'TAX_INVOICE' | 'DELIVERY_CHALLAN'): Promise<string> {
  const db = await getDB();
  const invoices = await db.getAll('Invoices');
  
  // Calculate current year code e.g. 26-27
  const now = new Date();
  const currentYear = now.getFullYear();
  const nextYearShort = (currentYear + 1).toString().slice(-2);
  const prevYearShort = (currentYear - 1).toString().slice(-2);
  const currentYearShort = currentYear.toString().slice(-2);

  // Financial Year starts April 1st
  let fy = '';
  if (now.getMonth() >= 3) {
    fy = `${currentYearShort}-${nextYearShort}`;
  } else {
    fy = `${prevYearShort}-${currentYearShort}`;
  }

  const invoiceTypePrefix = type === 'TAX_INVOICE' ? 'INV' : 'DC';
  const matchPrefix = `${prefix}/${invoiceTypePrefix}/${fy}/`;
  
  const relevantInvoices = invoices.filter((inv) =>
    inv.invoiceId.startsWith(matchPrefix) && inv.type === type
  );

  let maxNum = 0;
  relevantInvoices.forEach((inv) => {
    const parts = inv.invoiceId.split('/');
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  });

  const nextNum = (maxNum + 1).toString().padStart(3, '0');
  return `${matchPrefix}${nextNum}`;
}
