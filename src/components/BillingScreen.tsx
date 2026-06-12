import React, { useState, useEffect } from 'react';
import { searchCustomers, saveInvoice, getNextInvoiceNumber } from '../db/database';
import type { Invoice, InvoiceItem, Customer, BusinessProfile } from '../db/database';
import { calculateInvoiceTotals, applyReverseCalculation, toFixed2 } from '../utils/mathEngine';
import { generateAndDownloadPDF } from '../utils/pdfGenerator';
import { INDIAN_STATES } from './BusinessProfileSetup';
import { ArrowLeft, User, Plus, Trash2, ShieldAlert, Sparkles, Check, FileText, Loader2 } from 'lucide-react';

interface BillingScreenProps {
  profile: BusinessProfile;
  type: 'TAX_INVOICE' | 'DELIVERY_CHALLAN';
  onBack: () => void;
  onSaveSuccess: () => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({ profile, type, onBack, onSaveSuccess }) => {
  const [invoiceId, setInvoiceId] = useState('');
  
  // Customer Details state
  const [customerDetails, setCustomerDetails] = useState({
    partyName: '',
    phonePrefix: '+91',
    phone: '',
    address: '',
    city: '',
    stateName: '',
    stateCode: '',
    idType: 'PAN' as 'PAN' | 'AADHAAR',
    panAadhaar: '',
    placeOfSupply: ''
  });

  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [suggestedCustomers, setSuggestedCustomers] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Items state
  const [items, setItems] = useState<InvoiceItem[]>([]);
  
  // Totals & Discount states
  const [discountApplied, setDiscountApplied] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'Bank Transfer' | 'UPI'>('UPI');
  const [customPayableAmount, setCustomPayableAmount] = useState<number | null>(null);

  // Setup current wizard step
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [savingBill, setSavingBill] = useState(false);

  // Fetch Next Invoice Number on mount
  useEffect(() => {
    async function loadInvoiceNumber() {
      const num = await getNextInvoiceNumber(
        type === 'TAX_INVOICE' ? profile.taxInvoicePrefix : profile.challanPrefix,
        type
      );
      setInvoiceId(num);
    }
    loadInvoiceNumber();
  }, [profile, type]);

  // Search Customers trigger
  useEffect(() => {
    if (customerSearchQuery.trim().length > 0) {
      searchCustomers(customerSearchQuery).then((res) => {
        setSuggestedCustomers(res);
        setShowSuggestions(true);
      });
    } else {
      setSuggestedCustomers([]);
      setShowSuggestions(false);
    }
  }, [customerSearchQuery]);

  const handleSelectCustomer = (cust: Customer) => {
    setCustomerDetails({
      partyName: cust.partyName,
      phonePrefix: '+91',
      phone: cust.phone,
      address: cust.address,
      city: cust.city,
      stateName: cust.stateName,
      stateCode: cust.stateCode,
      idType: cust.panAadhaar.length === 12 ? 'AADHAAR' : 'PAN',
      panAadhaar: cust.panAadhaar,
      placeOfSupply: cust.stateName
    });
    setCustomerSearchQuery(cust.partyName);
    setShowSuggestions(false);
  };

  const handleCustomerFieldChange = (field: string, value: string) => {
    if (field === 'panAadhaar') {
      // UPPERCASE HOOK: Letters become capitals, numbers ignored.
      const uppercased = value.toUpperCase();
      setCustomerDetails(prev => ({ ...prev, [field]: uppercased }));
    } else if (field === 'stateName') {
      const selected = INDIAN_STATES.find(s => s.name === value);
      setCustomerDetails(prev => ({
        ...prev,
        stateName: value,
        stateCode: selected ? selected.code : ''
      }));
    } else {
      setCustomerDetails(prev => ({ ...prev, [field]: value }));
    }
  };

  // NILL Fallback Logic triggered before proceeding to items
  const handleProceedToItems = () => {
    // 5. The NILL Fallback Logic (CRITICAL)
    const phoneVal = customerDetails.phone.trim() === '' ? 'NILL' : customerDetails.phone.trim();
    const idVal = customerDetails.panAadhaar.trim() === '' ? 'NILL' : customerDetails.panAadhaar.trim();
    
    // 6. Place of Supply Fallback
    const placeOfSupplyVal = customerDetails.placeOfSupply.trim() === '' ? customerDetails.stateName : customerDetails.placeOfSupply.trim();

    setCustomerDetails(prev => ({
      ...prev,
      phone: phoneVal,
      panAadhaar: idVal,
      placeOfSupply: placeOfSupplyVal
    }));

    if (!customerDetails.partyName.trim()) {
      alert('Party Name is required.');
      return;
    }
    setWizardStep(2);
  };

  // Add Item to Grid
  const handleAddItem = () => {
    const newItem: InvoiceItem = {
      id: Math.random().toString(36).substring(2, 9),
      metal: 'GOLD',
      itemName: 'Gold Ornaments',
      hsn: '711319', // Default Gold Ornaments HSN
      purityType: 'Karat',
      purityValue: '22K916',
      weight: 0,
      weightUnit: 'gm',
      weightInGrams: 0,
      ratePerGram: 0,
      taxableAmount: 0
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleItemFieldChange = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        
        // 1. Dependent item list & HSN automation
        if (field === 'metal') {
          if (value === 'GOLD') {
            updated.itemName = 'Gold Ornaments';
            updated.hsn = '711319';
            updated.purityType = 'Karat';
            updated.purityValue = '22K916';
          } else {
            updated.itemName = 'Silver Ornaments';
            updated.hsn = '711311';
            updated.purityType = 'Karat';
            updated.purityValue = '18K750'; // Default silver
          }
        } else if (field === 'itemName') {
          // Map exact HSN
          const hsnMap: Record<string, string> = {
            'Gold Ornaments': '711319',
            'Pure Gold Bullion': '710812',
            'Gold Alloy': '710813',
            'Goldsmiths Wares': '711419',
            'Silver Ornaments': '711311',
            'Pure Silver Bullion': '710691',
            'Silver Alloy': '710692',
            'Silversmiths Wares': '711411'
          };
          updated.hsn = hsnMap[value] || '';
        }

        // Purity Setup restriction check
        if (field === 'purityType') {
          if (value === 'Karat') {
            updated.purityValue = '22K916';
          } else {
            updated.purityValue = '91.6';
          }
        }

        // Weight Unit Scale conversion
        const weightVal = field === 'weight' ? Number(value) : updated.weight;
        const unitVal = field === 'weightUnit' ? value : updated.weightUnit;
        updated.weightInGrams = unitVal === 'kg' ? toFixed2(weightVal * 1000) : toFixed2(weightVal);

        // Subtotal calculation
        updated.taxableAmount = toFixed2(updated.weightInGrams * updated.ratePerGram);

        return updated;
      }
      return item;
    }));
  };

  // Calculate Forward Totals
  const isLocalSupply = profile.stateCode === customerDetails.stateCode;
  
  const forwardCalculations = calculateInvoiceTotals(
    items.map(item => ({ weightInGrams: item.weightInGrams, ratePerGram: item.ratePerGram })),
    discountApplied,
    isLocalSupply
  );

  // Computed Grand Totals
  const finalCgst = forwardCalculations.cgst;
  const finalSgst = forwardCalculations.sgst;
  const finalIgst = forwardCalculations.igst;
  const finalGrandTotal = forwardCalculations.rawGrandTotal;
  
  // Custom Payable Override
  const currentPayableAmount = customPayableAmount !== null ? customPayableAmount : forwardCalculations.payableAmount;

  // Handle Reverse Override Calculation
  const handlePayableAmountOverride = (val: string) => {
    if (val.trim() === '') {
      setCustomPayableAmount(null);
      return;
    }
    const target = Number(val);
    setCustomPayableAmount(target);

    // Apply Reverse Calculation Engine
    const reverseResult = applyReverseCalculation(
      target,
      items.map(item => ({ id: item.id, weightInGrams: item.weightInGrams })),
      isLocalSupply
    );

    // Update item rates
    setItems(prev => prev.map(item => {
      const match = reverseResult.updatedItems.find(x => x.id === item.id);
      if (match) {
        const rate = match.ratePerGram;
        return {
          ...item,
          ratePerGram: rate,
          taxableAmount: toFixed2(item.weightInGrams * rate)
        };
      }
      return item;
    }));

    // Update discount line item
    setDiscountApplied(reverseResult.discountApplied);
  };

  // Section 269ST Income Tax Block
  const isCashComplianceBlocked = paymentMode === 'Cash' && currentPayableAmount >= 200000 && (customerDetails.panAadhaar === 'NILL' || customerDetails.panAadhaar.trim() === '');

  // Save bill invoice & PDF download
  const handleGenerateInvoice = async () => {
    if (isCashComplianceBlocked) return;
    setSavingBill(true);
    try {
      const newInvoice: Invoice = {
        invoiceId,
        type,
        date: Date.now(),
        profileId: profile.id || 1,
        customerDetails: {
          partyName: customerDetails.partyName,
          phone: `${customerDetails.phonePrefix} ${customerDetails.phone}`,
          address: customerDetails.address,
          city: customerDetails.city,
          stateName: customerDetails.stateName,
          stateCode: customerDetails.stateCode,
          gstin: 'NILL',
          panAadhaar: customerDetails.panAadhaar,
          idType: customerDetails.idType,
          placeOfSupply: customerDetails.placeOfSupply
        },
        items: items,
        taxDetails: {
          cgst: finalCgst,
          sgst: finalSgst,
          igst: finalIgst,
          cgstPercent: forwardCalculations.cgstPercent,
          sgstPercent: forwardCalculations.sgstPercent,
          igstPercent: forwardCalculations.igstPercent
        },
        discountApplied: discountApplied,
        grandTotal: finalGrandTotal,
        payableAmount: currentPayableAmount,
        paymentMode: paymentMode
      };

      // Save to IndexedDB
      await saveInvoice(newInvoice);

      // Generate & Trigger PDF Download
      await generateAndDownloadPDF(newInvoice, profile);

      onSaveSuccess();
    } catch (err) {
      console.error(err);
      alert('Error occurred while generating invoice.');
    } finally {
      setSavingBill(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      {/* Wizard Back & Title */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-zinc-400 hover:text-white transition text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Dashboard</span>
        </button>
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
            {type === 'TAX_INVOICE' ? 'Tax Invoice' : 'Delivery Challan'} Setup
          </span>
          <h1 className="text-sm font-bold text-zinc-300 mt-0.5">{invoiceId || 'Loading...'}</h1>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border transition ${
          wizardStep === 1 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
        }`}>
          <span className="text-xs font-bold">1</span>
          <span className="text-xs font-medium">Customer Info</span>
        </div>
        <div className="h-px w-10 bg-zinc-800"></div>
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border transition ${
          wizardStep === 2 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
        }`}>
          <span className="text-xs font-bold">2</span>
          <span className="text-xs font-medium">Item Grid</span>
        </div>
        <div className="h-px w-10 bg-zinc-800"></div>
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border transition ${
          wizardStep === 3 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
        }`}>
          <span className="text-xs font-bold">3</span>
          <span className="text-xs font-medium">Calculation & Pay</span>
        </div>
      </div>

      {/* Step 1: Customer Information */}
      {wizardStep === 1 && (
        <div className="glass p-8 rounded-2xl border border-zinc-800 max-w-2xl mx-auto shadow-2xl">
          <div className="flex items-center space-x-2 mb-6 text-indigo-400">
            <User className="h-5 w-5" />
            <h2 className="text-base font-semibold text-zinc-200">Customer (Recipient) Details</h2>
          </div>

          <div className="space-y-4">
            {/* Auto-fill Party Name Search */}
            <div className="relative">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Party Name *</label>
              <input
                type="text"
                required
                placeholder="Type name to search existing customer..."
                value={customerDetails.partyName}
                onChange={(e) => {
                  handleCustomerFieldChange('partyName', e.target.value);
                  setCustomerSearchQuery(e.target.value);
                }}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              />

              {showSuggestions && suggestedCustomers.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl z-50 divide-y divide-zinc-900 max-h-48 overflow-y-auto">
                  {suggestedCustomers.map((cust) => (
                    <button
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust)}
                      className="w-full text-left px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-900 transition flex justify-between items-center"
                    >
                      <div>
                        <span className="font-semibold text-white">{cust.partyName}</span>
                        <span className="text-zinc-500 ml-2">({cust.phone})</span>
                      </div>
                      <span className="text-[10px] text-indigo-400 uppercase">Auto-fill</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Phone Number with Prefix */}
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Prefix</label>
                <select
                  value={customerDetails.phonePrefix}
                  onChange={(e) => handleCustomerFieldChange('phonePrefix', e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="+91">+91 (IN)</option>
                  <option value="+1">+1 (US)</option>
                  <option value="+44">+44 (UK)</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="Enter phone number"
                  value={customerDetails.phone}
                  onChange={(e) => handleCustomerFieldChange('phone', e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">GST State Selector *</label>
                <select
                  required
                  value={customerDetails.stateName}
                  onChange={(e) => handleCustomerFieldChange('stateName', e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select Customer State</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st.name} value={st.name}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Place of Supply (State)</label>
                <input
                  type="text"
                  placeholder="Defaults to customer state"
                  value={customerDetails.placeOfSupply}
                  onChange={(e) => handleCustomerFieldChange('placeOfSupply', e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Street Address"
                  value={customerDetails.address}
                  onChange={(e) => handleCustomerFieldChange('address', e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">City</label>
                <input
                  type="text"
                  placeholder="e.g. Kolkata"
                  value={customerDetails.city}
                  onChange={(e) => handleCustomerFieldChange('city', e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* ID Type & PAN/Aadhaar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">ID Type Toggle</label>
                <div className="flex items-center space-x-4 py-2">
                  <label className="inline-flex items-center text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      name="idType"
                      checked={customerDetails.idType === 'PAN'}
                      onChange={() => setCustomerDetails(prev => ({ ...prev, idType: 'PAN' }))}
                      className="form-radio text-indigo-600 bg-zinc-900 border-zinc-800"
                    />
                    <span className="ml-2 font-semibold">PAN</span>
                  </label>
                  <label className="inline-flex items-center text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      name="idType"
                      checked={customerDetails.idType === 'AADHAAR'}
                      onChange={() => setCustomerDetails(prev => ({ ...prev, idType: 'AADHAAR' }))}
                      className="form-radio text-indigo-600 bg-zinc-900 border-zinc-800"
                    />
                    <span className="ml-2 font-semibold">Aadhaar</span>
                  </label>
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  ID Number ({customerDetails.idType})
                </label>
                <input
                  type="text"
                  placeholder={`Enter ${customerDetails.idType} Number`}
                  value={customerDetails.panAadhaar}
                  onChange={(e) => handleCustomerFieldChange('panAadhaar', e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

          </div>

          <div className="flex justify-end mt-8">
            <button
              onClick={handleProceedToItems}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg text-xs transition shadow-lg shadow-indigo-600/20"
            >
              Continue to Item Grid
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Item Grid */}
      {wizardStep === 2 && (
        <div className="glass p-6 rounded-2xl border border-zinc-800 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2 text-indigo-400">
              <Plus className="h-5 w-5" />
              <h2 className="text-base font-semibold text-zinc-200">Invoice Items Grid</h2>
            </div>
            <button
              onClick={handleAddItem}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-xs flex items-center space-x-1 transition shadow-lg shadow-indigo-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>Add Item</span>
            </button>
          </div>

          {items.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-850">
                  <thead>
                    <tr className="text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      <th className="pb-2">Metal</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2">HSN</th>
                      <th className="pb-2">Purity System</th>
                      <th className="pb-2">Purity Value</th>
                      <th className="pb-2">Weight Value</th>
                      <th className="pb-2">Unit</th>
                      <th className="pb-2">Rate/g</th>
                      <th className="pb-2 text-right">Subtotal</th>
                      <th className="pb-2 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {items.map((item) => (
                      <tr key={item.id} className="align-middle">
                        <td className="py-3 pr-2">
                          <select
                            value={item.metal}
                            onChange={(e) => handleItemFieldChange(item.id, 'metal', e.target.value)}
                            className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="GOLD">GOLD</option>
                            <option value="SILVER">SILVER</option>
                          </select>
                        </td>
                        <td className="py-3 pr-2">
                          <select
                            value={item.itemName}
                            onChange={(e) => handleItemFieldChange(item.id, 'itemName', e.target.value)}
                            className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 w-44"
                          >
                            {item.metal === 'GOLD' ? (
                              <>
                                <option value="Gold Ornaments">Gold Ornaments</option>
                                <option value="Pure Gold Bullion">Pure Gold Bullion</option>
                                <option value="Gold Alloy">Gold Alloy</option>
                                <option value="Goldsmiths Wares">Goldsmiths Wares</option>
                              </>
                            ) : (
                              <>
                                <option value="Silver Ornaments">Silver Ornaments</option>
                                <option value="Pure Silver Bullion">Pure Silver Bullion</option>
                                <option value="Silver Alloy">Silver Alloy</option>
                                <option value="Silversmiths Wares">Silversmiths Wares</option>
                              </>
                            )}
                          </select>
                        </td>
                        <td className="py-3 pr-2 font-mono text-xs text-zinc-400">
                          {item.hsn}
                        </td>
                        <td className="py-3 pr-2">
                          <select
                            value={item.purityType}
                            onChange={(e) => handleItemFieldChange(item.id, 'purityType', e.target.value)}
                            className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="Karat">Karat</option>
                            <option value="Percentage (%)">Percentage (%)</option>
                          </select>
                        </td>
                        <td className="py-3 pr-2">
                          {item.purityType === 'Karat' ? (
                            <select
                              value={item.purityValue}
                              onChange={(e) => handleItemFieldChange(item.id, 'purityValue', e.target.value)}
                              className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                            >
                              <option value="24K995">24K995</option>
                              <option value="23K958">23K958</option>
                              <option value="22K916">22K916</option>
                              <option value="20K833">20K833</option>
                              <option value="18K750">18K750</option>
                              <option value="14K585">14K585</option>
                              <option value="9K375">9K375</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={item.purityValue}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9.]/g, '');
                                handleItemFieldChange(item.id, 'purityValue', clean);
                              }}
                              className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 w-16"
                            />
                          )}
                        </td>
                        <td className="py-3 pr-2">
                          <input
                            type="text"
                            required
                            placeholder="0.0"
                            value={item.weight || ''}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^0-9.]/g, '');
                              handleItemFieldChange(item.id, 'weight', clean);
                            }}
                            className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 w-16"
                          />
                        </td>
                        <td className="py-3 pr-2">
                          <select
                            value={item.weightUnit}
                            onChange={(e) => handleItemFieldChange(item.id, 'weightUnit', e.target.value)}
                            className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="gm">gm</option>
                            <option value="kg">kg</option>
                          </select>
                        </td>
                        <td className="py-3 pr-2">
                          <input
                            type="text"
                            required
                            placeholder="0.00"
                            value={item.ratePerGram || ''}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^0-9.]/g, '');
                              handleItemFieldChange(item.id, 'ratePerGram', clean);
                            }}
                            className="bg-zinc-950 border border-zinc-850 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 w-24"
                          />
                        </td>
                        <td className="py-3 text-right font-bold text-zinc-100 pr-2">
                          ₹{item.taxableAmount.toFixed(2)}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-500 hover:text-red-400 p-1.5 transition rounded hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-between items-center pt-6 mt-4 border-t border-zinc-800">
                <button
                  onClick={() => setWizardStep(1)}
                  className="text-xs font-semibold text-zinc-400 hover:text-white transition"
                >
                  Back
                </button>
                <button
                  onClick={() => setWizardStep(3)}
                  disabled={items.length === 0 || items.some(x => x.weightInGrams <= 0 || x.ratePerGram <= 0)}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg text-xs transition shadow-lg shadow-indigo-600/20"
                >
                  Continue to Calculation & Pay
                </button>
              </div>
            </div>
          ) : (
            <div className="py-12 border border-dashed border-zinc-800 rounded-xl text-center flex flex-col items-center">
              <Trash2 className="h-8 w-8 text-zinc-600 mb-2" />
              <span className="text-zinc-500 text-sm">No items added to this bill.</span>
              <button
                onClick={handleAddItem}
                className="mt-3 bg-zinc-900 border border-zinc-800 hover:border-indigo-500 text-zinc-300 hover:text-white px-4 py-2 rounded-lg text-xs transition font-semibold"
              >
                Add First Item
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Calculation & Settlement */}
      {wizardStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Summary Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass p-6 rounded-2xl border border-zinc-800 shadow-2xl">
              <div className="flex items-center space-x-2 mb-4 text-indigo-400">
                <Sparkles className="h-5 w-5" />
                <h2 className="text-base font-semibold text-zinc-200">Forward Math Summary</h2>
              </div>
              
              <div className="space-y-3 text-sm text-zinc-400">
                <div className="flex justify-between">
                  <span>Subtotal Taxable Amount:</span>
                  <span className="text-zinc-200">₹{forwardCalculations.totalTaxableBeforeDiscount.toFixed(2)}</span>
                </div>
                
                {discountApplied > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Discount Applied (Less):</span>
                    <span>-₹{discountApplied.toFixed(2)}</span>
                  </div>
                )}

                {isLocalSupply ? (
                  <>
                    <div className="flex justify-between">
                      <span>CGST (1.5%):</span>
                      <span className="text-zinc-200">₹{finalCgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST (1.5%):</span>
                      <span className="text-zinc-200">₹{finalSgst.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>IGST (3.0%):</span>
                    <span className="text-zinc-200">₹{finalIgst.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between pt-3 border-t border-zinc-850 font-semibold text-zinc-300">
                  <span>Grand Total (with Tax):</span>
                  <span>₹{finalGrandTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between pt-2 text-base font-bold text-white">
                  <span>Standard Payable Amount:</span>
                  <span className="text-indigo-400">₹{forwardCalculations.payableAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Reverse Overrides Box */}
            <div className="glass p-6 rounded-2xl border border-zinc-800 shadow-2xl">
              <div className="flex items-center space-x-2 mb-4 text-indigo-400">
                <Sparkles className="h-5 w-5 animate-spin" />
                <h2 className="text-base font-semibold text-zinc-200">Negotiated Target Override</h2>
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                To bypass the forward formula, enter a flat negotiated total (e.g. 25000). The engine will lock weights, recalculate item rates, and auto-apply Situation 2 negative discount adjustments to hit the exact paisa.
              </p>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Target Total Amount (Payable)</label>
                <input
                  type="text"
                  placeholder="e.g. 59600"
                  value={customPayableAmount !== null ? customPayableAmount : ''}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, '');
                    handlePayableAmountOverride(clean);
                  }}
                  className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-sm text-indigo-400 font-bold focus:outline-none focus:border-indigo-500 placeholder-zinc-700"
                />
              </div>

              {customPayableAmount !== null && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg mt-4 text-[11px] text-zinc-300">
                  💡 <strong>Reverse Calculation Active:</strong> Item rates adjusted to match your Target Total of ₹{customPayableAmount.toLocaleString('en-IN')}. Discount box set to <strong className="text-red-400">₹{discountApplied.toFixed(2)}</strong>.
                </div>
              )}
            </div>
          </div>

          {/* Compliance & Payment Details */}
          <div className="space-y-6">
            <div className="glass p-6 rounded-2xl border border-zinc-800 shadow-2xl">
              <div className="flex items-center space-x-2 mb-4 text-indigo-400">
                <Check className="h-5 w-5" />
                <h2 className="text-base font-semibold text-zinc-200">Settlement Details</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="UPI">UPI Payment</option>
                    <option value="Cash">Cash Settlement</option>
                    <option value="Card">Credit/Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                  </select>
                </div>

                <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-850 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Total Payable</span>
                  <span className="text-3xl font-extrabold font-outfit text-white block mt-1">
                    ₹{currentPayableAmount.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Section 269ST Income Tax Block Warning Banner */}
                {isCashComplianceBlocked && (
                  <div className="p-4 bg-red-950/60 border-2 border-red-500 rounded-xl text-red-200 text-xs leading-relaxed flex items-start space-x-2 shadow-lg animate-bounce">
                    <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white uppercase block mb-1">INCOME TAX COMPLIANCE WARNING</strong>
                      Transactions of ₹2,00,000 or more in Cash require a valid PAN or Aadhaar. Please update the Customer Details with ID proofs to proceed.
                    </div>
                  </div>
                )}

                <button
                  onClick={handleGenerateInvoice}
                  disabled={savingBill || isCashComplianceBlocked}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold py-3.5 rounded-xl text-xs transition duration-300 shadow-xl shadow-indigo-600/25 flex items-center justify-center space-x-2 font-outfit"
                >
                  {savingBill ? (
                    <>
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      <span>Generating Copy Loop...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="h-4.5 w-4.5" />
                      <span>Preview & Generate PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex justify-start">
              <button
                onClick={() => setWizardStep(2)}
                className="text-xs font-semibold text-zinc-400 hover:text-white transition"
              >
                Back to Item Grid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
