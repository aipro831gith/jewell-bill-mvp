import React, { useState, useEffect } from 'react';
import { searchCustomers, saveInvoice, getNextInvoiceNumber } from '../db/database';
import type { Invoice, InvoiceItem, Customer, BusinessProfile } from '../db/database';
import { calculateInvoiceTotals, applyReverseCalculation, toFixed2 } from '../utils/mathEngine';
import { generateAndDownloadPDF } from '../utils/pdfGenerator';
import { INDIAN_STATES } from './BusinessProfileSetup';
import { ArrowLeft, User, Plus, Trash2, ShieldAlert, Sparkles, FileText, Loader2, Landmark } from 'lucide-react';

interface BillingScreenProps {
  profile: BusinessProfile;
  type: 'TAX_INVOICE' | 'DELIVERY_CHALLAN';
  onBack: () => void;
  onSaveSuccess: () => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({
  profile,
  type,
  onBack,
  onSaveSuccess,
}) => {
  const templateId = profile.templateId || 1;
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const adjusted = new Date(local.getTime(), -offset * 60 * 1000);
    return adjusted.toISOString().split('T')[0];
  });
  
  // Customer details
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

  // Items grid list
  const [items, setItems] = useState<InvoiceItem[]>([]);
  
  // Calculations, discounts, and payment
  const [discountApplied, setDiscountApplied] = useState(0);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'Bank Transfer' | 'UPI' | 'RTGS' | 'None'>('None');
  const [customPayableAmount, setCustomPayableAmount] = useState<number | null>(null);
  
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Load next invoice number
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

  // Customer search suggestions
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

  // Add item
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
        
        // Metal & Item automation dependency
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
            updated.purityValue = '18K750';
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

        // Purity defaults on change
        if (field === 'purityType') {
          if (value === 'Karat') {
            updated.purityValue = '22K916';
          } else {
            updated.purityValue = '91.6';
          }
        }

        // Weight conversions
        const wVal = field === 'weight' ? Number(value) : updated.weight;
        const uVal = field === 'weightUnit' ? value : updated.weightUnit;
        updated.weightInGrams = uVal === 'kg' ? toFixed2(wVal * 1000) : toFixed2(wVal);

        // Subtotal
        updated.taxableAmount = toFixed2(updated.weightInGrams * updated.ratePerGram);

        return updated;
      }
      return item;
    }));
  };

  // Forward calculations
  const isLocalSupply = profile.stateCode === customerDetails.stateCode;
  
  const forwardCalculations = calculateInvoiceTotals(
    items.map(item => ({ weightInGrams: item.weightInGrams, ratePerGram: item.ratePerGram })),
    discountApplied,
    isLocalSupply
  );

  const finalCgst = forwardCalculations.cgst;
  const finalSgst = forwardCalculations.sgst;
  const finalIgst = forwardCalculations.igst;
  const finalGrandTotal = forwardCalculations.rawGrandTotal;
  
  const currentPayableAmount = customPayableAmount !== null ? customPayableAmount : forwardCalculations.payableAmount;

  // Reverse override implementation
  const handlePayableAmountOverride = (val: string) => {
    if (val.trim() === '') {
      setCustomPayableAmount(null);
      return;
    }
    const target = Number(val);
    setCustomPayableAmount(target);

    const reverseResult = applyReverseCalculation(
      target,
      items.map(item => ({ id: item.id, weightInGrams: item.weightInGrams })),
      isLocalSupply
    );

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

    setDiscountApplied(reverseResult.discountApplied);
  };

  // Cash Compliance locker
  const isCashComplianceBlocked = paymentMode === 'Cash' && currentPayableAmount >= 200000 && (customerDetails.panAadhaar === 'NILL' || customerDetails.panAadhaar.trim() === '');

  // Submit and Save PDF
  const handleSaveAndPreview = async () => {
    if (isCashComplianceBlocked) return;
    if (!customerDetails.partyName.trim()) {
      alert('Customer Party Name is required.');
      return;
    }
    if (items.length === 0 || items.some(x => x.weightInGrams <= 0 || x.ratePerGram <= 0)) {
      alert('Please add at least one valid item with weight and rate.');
      return;
    }

    setGeneratingPDF(true);
    try {
      // 5. NILL Fallback Logic
      const phoneVal = customerDetails.phone.trim() === '' ? 'NILL' : customerDetails.phone.trim();
      const idVal = customerDetails.panAadhaar.trim() === '' ? 'NILL' : customerDetails.panAadhaar.trim();
      const placeOfSupplyVal = customerDetails.placeOfSupply.trim() === '' ? customerDetails.stateName : customerDetails.placeOfSupply.trim();

      const finalPhoneStr = phoneVal === 'NILL' ? 'NILL' : `${customerDetails.phonePrefix} ${phoneVal}`;

      const newInvoice: Invoice = {
        invoiceId,
        type,
        templateId,
        date: new Date(invoiceDate).getTime(),
        profileId: profile.id || 1,
        customerDetails: {
          partyName: customerDetails.partyName,
          phone: finalPhoneStr,
          address: customerDetails.address || 'NILL',
          city: customerDetails.city || 'NILL',
          stateName: customerDetails.stateName,
          stateCode: customerDetails.stateCode,
          gstin: 'NILL',
          panAadhaar: idVal,
          idType: customerDetails.idType,
          placeOfSupply: placeOfSupplyVal
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

      await saveInvoice(newInvoice);
      await generateAndDownloadPDF(newInvoice, profile);
      onSaveSuccess();
    } catch (err) {
      console.error(err);
      alert('Error occurred while generating PDF.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      {/* Back to Dashboard */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-zinc-400 hover:text-white transition text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Dashboard</span>
        </button>
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
            {type === 'TAX_INVOICE' ? 'Tax Invoice' : 'Delivery Challan'} | Template {templateId}
          </span>
          <h1 className="text-sm font-bold text-zinc-300 mt-0.5">{invoiceId || 'Loading...'}</h1>
        </div>
      </div>

      {/* Merged Responsive Single Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Customer Info & Item Grid */}
        <div className="lg:col-span-2 space-y-6">

          {/* Document Reference & Date Selection */}
          <div className="glass p-5 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="flex items-center space-x-2 mb-4 text-indigo-400">
              <FileText className="h-5 w-5" />
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wide">Document Reference & Date</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  {type === 'TAX_INVOICE' ? 'Invoice Number *' : 'Challan Number *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SNJ/INV/26-27/001"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-855 rounded-lg px-3 py-2 text-xs text-white font-bold font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  Billing Date *
                </label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
          
          {/* Customer Card */}
          <div className="glass p-5 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="flex items-center space-x-2 mb-4 text-indigo-400">
              <User className="h-5 w-5" />
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wide">Customer Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Party Name Autocomplete */}
              <div className="relative">
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Party Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Search existing or enter new..."
                  value={customerDetails.partyName}
                  onChange={(e) => {
                    handleCustomerFieldChange('partyName', e.target.value);
                    setCustomerSearchQuery(e.target.value);
                  }}
                  className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
                {showSuggestions && suggestedCustomers.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-zinc-950 border border-zinc-850 rounded-lg shadow-2xl z-50 divide-y divide-zinc-900 max-h-40 overflow-y-auto">
                    {suggestedCustomers.map((cust) => (
                      <button
                        key={cust.id}
                        onClick={() => handleSelectCustomer(cust)}
                        className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900 transition flex justify-between items-center"
                      >
                        <div>
                          <span className="font-bold text-white">{cust.partyName}</span>
                          <span className="text-zinc-500 ml-2">({cust.phone})</span>
                        </div>
                        <span className="text-[9px] text-indigo-400 uppercase">Select</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone Prefix + Phone */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Prefix</label>
                  <select
                    value={customerDetails.phonePrefix}
                    onChange={(e) => handleCustomerFieldChange('phonePrefix', e.target.value)}
                    className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-2 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="+91">+91 (IN)</option>
                    <option value="+1">+1 (US)</option>
                    <option value="+44">+44 (UK)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={customerDetails.phone}
                    onChange={(e) => handleCustomerFieldChange('phone', e.target.value)}
                    className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">State Name *</label>
                <select
                  required
                  value={customerDetails.stateName}
                  onChange={(e) => handleCustomerFieldChange('stateName', e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st.name} value={st.name}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Place of Supply</label>
                <input
                  type="text"
                  placeholder="Defaults to customer state"
                  value={customerDetails.placeOfSupply}
                  onChange={(e) => handleCustomerFieldChange('placeOfSupply', e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Street details"
                  value={customerDetails.address}
                  onChange={(e) => handleCustomerFieldChange('address', e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">City</label>
                <input
                  type="text"
                  placeholder="e.g. Kolkata"
                  value={customerDetails.city}
                  onChange={(e) => handleCustomerFieldChange('city', e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* ID Proof Type Toggle & Value */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">ID proof type</label>
                <div className="flex items-center space-x-3 py-1">
                  <label className="inline-flex items-center text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      name="idType"
                      checked={customerDetails.idType === 'PAN'}
                      onChange={() => setCustomerDetails(prev => ({ ...prev, idType: 'PAN' }))}
                      className="form-radio text-indigo-600 bg-zinc-900 border-zinc-800"
                    />
                    <span className="ml-1 text-xs">PAN</span>
                  </label>
                  <label className="inline-flex items-center text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      name="idType"
                      checked={customerDetails.idType === 'AADHAAR'}
                      onChange={() => setCustomerDetails(prev => ({ ...prev, idType: 'AADHAAR' }))}
                      className="form-radio text-indigo-600 bg-zinc-900 border-zinc-800"
                    />
                    <span className="ml-1 text-xs">Aadhaar</span>
                  </label>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  ID Number ({customerDetails.idType})
                </label>
                <input
                  type="text"
                  placeholder={`Enter ${customerDetails.idType} proof value`}
                  value={customerDetails.panAadhaar}
                  onChange={(e) => handleCustomerFieldChange('panAadhaar', e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Merged Item Grid Panel */}
          <div className="glass p-5 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-indigo-400">
                <Plus className="h-5 w-5" />
                <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wide">Invoice Items Grid</h2>
              </div>
              <button
                onClick={handleAddItem}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-xs flex items-center space-x-1.5 transition shadow-lg shadow-indigo-600/20"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {items.length > 0 ? (
              <div className="overflow-x-auto w-full">
                <table className="min-w-full divide-y divide-zinc-850">
                  <thead>
                    <tr className="text-left text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      <th className="pb-2">Metal</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2">HSN</th>
                      <th className="pb-2">Purity System</th>
                      <th className="pb-2">Purity Value</th>
                      <th className="pb-2">Weight</th>
                      <th className="pb-2">Unit</th>
                      <th className="pb-2">Rate/g</th>
                      <th className="pb-2 text-right">Subtotal</th>
                      <th className="pb-2 text-right">Del</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {items.map((item) => (
                      <tr key={item.id} className="align-middle">
                        <td className="py-2.5 pr-2">
                          <select
                            value={item.metal}
                            onChange={(e) => handleItemFieldChange(item.id, 'metal', e.target.value)}
                            className="bg-zinc-950 border border-zinc-850 rounded px-1.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="GOLD">GOLD</option>
                            <option value="SILVER">SILVER</option>
                          </select>
                        </td>
                        <td className="py-2.5 pr-2">
                          <select
                            value={item.itemName}
                            onChange={(e) => handleItemFieldChange(item.id, 'itemName', e.target.value)}
                            className="bg-zinc-950 border border-zinc-850 rounded px-1.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 w-36"
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
                        <td className="py-2.5 pr-2">
                          <input
                            type="text"
                            value={item.hsn}
                            onChange={(e) => handleItemFieldChange(item.id, 'hsn', e.target.value)}
                            className="bg-zinc-950 border border-zinc-850 rounded px-1.5 py-1 text-xs text-zinc-400 focus:outline-none w-16 text-center font-mono"
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <select
                            value={item.purityType}
                            onChange={(e) => handleItemFieldChange(item.id, 'purityType', e.target.value)}
                            className="bg-zinc-950 border border-zinc-850 rounded px-1.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="Karat">Karat</option>
                            <option value="Percentage (%)">Percentage (%)</option>
                          </select>
                        </td>
                        <td className="py-2.5 pr-2">
                          {item.purityType === 'Karat' ? (
                            <select
                              value={item.purityValue}
                              onChange={(e) => handleItemFieldChange(item.id, 'purityValue', e.target.value)}
                              className="bg-zinc-950 border border-zinc-850 rounded px-1.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                            >
                              <option value="None">None</option>
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
                              placeholder="0.0"
                              value={item.purityValue === 'None' ? '' : item.purityValue}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9.]/g, '');
                                handleItemFieldChange(item.id, 'purityValue', clean || '0');
                              }}
                              className="bg-zinc-950 border border-zinc-850 rounded px-1.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 w-14"
                            />
                          )}
                        </td>
                        <td className="py-2.5 pr-2">
                          <input
                            type="text"
                            required
                            placeholder="0.0"
                            value={item.weight || ''}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^0-9.]/g, '');
                              handleItemFieldChange(item.id, 'weight', clean);
                            }}
                            className="bg-zinc-950 border border-zinc-850 rounded px-1.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 w-14"
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <select
                            value={item.weightUnit}
                            onChange={(e) => handleItemFieldChange(item.id, 'weightUnit', e.target.value)}
                            className="bg-zinc-950 border border-zinc-850 rounded px-1 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="gm">gm</option>
                            <option value="kg">kg</option>
                          </select>
                        </td>
                        <td className="py-2.5 pr-2">
                          <input
                            type="text"
                            required
                            placeholder="0.00"
                            value={item.ratePerGram || ''}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^0-9.]/g, '');
                              handleItemFieldChange(item.id, 'ratePerGram', clean);
                            }}
                            className="bg-zinc-950 border border-zinc-850 rounded px-1.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 w-20"
                          />
                        </td>
                        <td className="py-2.5 text-right font-bold text-zinc-100 pr-2 whitespace-nowrap">
                          ₹{item.taxableAmount.toFixed(2)}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-500 hover:text-red-400 p-1.5 transition rounded hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 border border-dashed border-zinc-850 rounded-xl text-center flex flex-col items-center">
                <Trash2 className="h-7 w-7 text-zinc-650 mb-1" />
                <span className="text-zinc-500 text-xs">No items in the list. Click "+ Add Item" above.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Consolidated Calculations Panel */}
        <div className="space-y-6">
          
          {/* Calculations Summary */}
          <div className="glass p-5 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="flex items-center space-x-2 mb-4 text-indigo-400">
              <Sparkles className="h-5 w-5" />
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wide">Totals & Taxation</h2>
            </div>
            
            <div className="space-y-3.5 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span>Subtotal Taxable Amount:</span>
                <span className="text-zinc-200 font-medium">₹{forwardCalculations.totalTaxableBeforeDiscount.toFixed(2)}</span>
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

              <div className="flex justify-between pt-2 text-sm font-bold text-white">
                <span>Standard Payable:</span>
                <span className="text-indigo-400 font-outfit">₹{forwardCalculations.payableAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Target override inline */}
            <div className="mt-4 pt-4 border-t border-zinc-850">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Target Total Negotiated Override</label>
              <input
                type="text"
                placeholder="e.g. 59600"
                value={customPayableAmount !== null ? customPayableAmount : ''}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9]/g, '');
                  handlePayableAmountOverride(clean);
                }}
                className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-indigo-400 font-bold focus:outline-none focus:border-indigo-500 placeholder-zinc-700"
              />
            </div>
          </div>

          {/* Payment & Action Trigger */}
          <div className="glass p-5 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="flex items-center space-x-2 mb-4 text-indigo-400">
              <Landmark className="h-5 w-5" />
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wide">Settlement Mode</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-2.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="None">None (Unspecified Mode)</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Debit/Credit Card</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="RTGS">RTGS Settlement</option>
                </select>
              </div>

              <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-850 text-center">
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">Payable Amount</span>
                <span className="text-2xl font-bold font-outfit text-white block mt-0.5">
                  ₹{currentPayableAmount.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Compliance Cash Warning Banner */}
              {isCashComplianceBlocked && (
                <div className="p-4 bg-red-950/60 border-2 border-red-500 rounded-xl text-red-200 text-xs leading-relaxed flex items-start space-x-2 shadow-lg">
                  <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white uppercase block mb-1">INCOME TAX WARNING</strong>
                    Transactions of ₹2,00,000 or more in Cash require a valid PAN or Aadhaar. Please update the customer details to unlock PDF generation.
                  </div>
                </div>
              )}

              <button
                onClick={handleSaveAndPreview}
                disabled={generatingPDF || isCashComplianceBlocked}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold py-3.5 rounded-xl text-xs transition duration-300 shadow-xl shadow-indigo-600/20 flex items-center justify-center space-x-1.5 font-outfit uppercase tracking-wider"
              >
                {generatingPDF ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    <span>Compiling PDF Copies...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4.5 w-4.5" />
                    <span>Generate & Print PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
