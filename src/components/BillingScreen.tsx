import React, { useState, useEffect } from 'react';
import { searchCustomers, saveInvoice, getNextInvoiceNumber } from '../db/database';
import type { Invoice, InvoiceItem, Customer, BusinessProfile } from '../db/database';
import { calculateInvoiceTotals, applyReverseCalculation, toFixed2, toFixed3 } from '../utils/mathEngine';
import { generateAndDownloadPDF } from '../utils/pdfGenerator';
import { INDIAN_STATES } from './BusinessProfileSetup';
import { ArrowLeft, User, Plus, Trash2, ShieldAlert, Sparkles, FileText, Loader2, Landmark } from 'lucide-react';

interface BillingScreenProps {
  profile: BusinessProfile;
  type: 'TAX_INVOICE' | 'DELIVERY_CHALLAN';
  initialCustomer?: Customer;
  onBack: () => void;
  onSaveSuccess: () => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({
  profile,
  type,
  initialCustomer,
  onBack,
  onSaveSuccess,
}) => {
  const templateId = profile.templateId || 1;
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const local = new Date();
    const yyyy = local.getFullYear();
    const mm = String(local.getMonth() + 1).padStart(2, '0');
    const dd = String(local.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isShippingDifferent, setIsShippingDifferent] = useState(false);
  const [isSwappedAddress, setIsSwappedAddress] = useState(false);

  const handleReset = async () => {
    setCustomerDetails({
      partyName: '',
      phonePrefix: '+91',
      phone: '',
      address: '',
      city: '',
      stateName: profile.stateName,
      stateCode: profile.stateCode,
      idType: 'PAN',
      panAadhaar: '',
      gstin: '',
      shippingAddress: '',
      shippingCity: '',
      shippingStateName: '',
      shippingStateCode: ''
    });
    setCustomerSearchQuery('');
    setItems([]);
    setDiscountApplied(0);
    setPaymentMode('None');
    setCustomPayableAmount(null);
    setTargetTotalInput('');
    setIsShippingDifferent(false);
    setIsSwappedAddress(false);
    
    const num = await getNextInvoiceNumber(
      type === 'TAX_INVOICE' ? profile.taxInvoicePrefix : profile.challanPrefix,
      type
    );
    setInvoiceId(num);
    
    const local = new Date();
    const yyyy = local.getFullYear();
    const mm = String(local.getMonth() + 1).padStart(2, '0');
    const dd = String(local.getDate()).padStart(2, '0');
    setInvoiceDate(`${yyyy}-${mm}-${dd}`);
    setIsSaved(false);
  };
  
  // Customer details
  // Initialize customerDetails from initialCustomer if provided, otherwise default
  const [customerDetails, setCustomerDetails] = useState<Omit<Customer, 'id'>>(() => {
    if (initialCustomer) {
      return {
        partyName: initialCustomer.partyName,
        phonePrefix: initialCustomer.phonePrefix || '+91',
        phone: initialCustomer.phone,
        address: initialCustomer.address || '',
        city: initialCustomer.city || '',
        stateName: initialCustomer.stateName || profile.stateName,
        stateCode: initialCustomer.stateCode || profile.stateCode,
        idType: initialCustomer.idType || 'PAN',
        panAadhaar: initialCustomer.panAadhaar || '',
        gstin: initialCustomer.gstin || '',
        shippingAddress: initialCustomer.shippingAddress || '',
        shippingCity: initialCustomer.shippingCity || '',
        shippingStateName: initialCustomer.shippingStateName || '',
        shippingStateCode: initialCustomer.shippingStateCode || ''
      };
    }
    return {
      partyName: '',
      phonePrefix: '+91',
      phone: '',
      address: '',
      city: '',
      stateName: profile.stateName,
      stateCode: profile.stateCode,
      idType: 'PAN',
      panAadhaar: '',
      gstin: '',
      shippingAddress: '',
      shippingCity: '',
      shippingStateName: '',
      shippingStateCode: ''
    };
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
  const [targetTotalInput, setTargetTotalInput] = useState('');
  
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Load next invoice number
  useEffect(() => {
    async function loadInvoiceNumber() {
      const num = await getNextInvoiceNumber(
        profile.taxInvoicePrefix, // Use SNJ for both INV and DC
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

  const handleSelectCustomer = (c: Customer) => {
    setCustomerDetails({
      partyName: c.partyName,
      phonePrefix: '+91',
      phone: c.phone,
      address: c.address,
      city: c.city,
      stateName: c.stateName,
      stateCode: c.stateCode,
      idType: c.panAadhaar.length === 12 ? 'AADHAAR' : 'PAN',
      panAadhaar: c.panAadhaar,
      gstin: c.gstin || '',
      shippingAddress: c.shippingAddress || '',
      shippingCity: c.shippingCity || '',
      shippingStateName: c.shippingStateName || '',
      shippingStateCode: c.shippingStateCode || ''
    });
    if (c.shippingAddress) setIsShippingDifferent(true);
    setCustomerSearchQuery(c.partyName);
    setShowSuggestions(false);
  };

  const handleCustomerFieldChange = (field: string, value: string) => {
    if (field === 'panAadhaar') {
      const uppercased = value.toUpperCase();
      setCustomerDetails(prev => ({ ...prev, [field]: uppercased }));
    } else if (field === 'gstin') {
      const gstin = value.toUpperCase();
      setCustomerDetails(prev => ({
        ...prev,
        gstin,
        panAadhaar: gstin.length >= 15 ? gstin.substring(2, 12) : prev.panAadhaar,
        idType: 'PAN'
      }));
    } else if (field === 'stateName') {
      const selected = INDIAN_STATES.find(s => s.name === value);
      setCustomerDetails(prev => ({
        ...prev,
        stateName: value,
        stateCode: selected ? selected.code : ''
      }));
    } else if (field === 'shippingStateName') {
      const selected = INDIAN_STATES.find(s => s.name === value);
      setCustomerDetails(prev => ({
        ...prev,
        shippingStateName: value,
        shippingStateCode: selected ? selected.code : ''
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
            updated.purityValue = '22K';
          } else {
            updated.itemName = 'Silver Ornaments';
            updated.hsn = '711311';
            updated.purityType = 'Karat';
            updated.purityValue = '18K';
          }
        } else if (field === 'itemName') {
          // Map exact HSN
          const hsnMap: Record<string, string> = {
            'Gold Ornaments': '711319',
            'Gold Alloy Ornament': '711319',
            'FINE GOLD (99.99%)': '710812',
            'GOLD BULLION (99.90%)': '710812',
            'PURE GOLD (99.50%)': '710812',
            'Gold Coin': '711890',
            'Goldsmiths Wares': '711419',
            'Silver Ornaments': '711311',
            'Silver Alloy Ornament': '711311',
            'FINE SILVER (99.99%)': '710691',
            'PURE SILVER (99.00%)': '710691',
            'Silver Coin': '711890',
            'Silversmiths Wares': '711411'
          };
          updated.hsn = hsnMap[value] || '';
          
          // Auto-purity for bullion
          if (value === 'FINE GOLD (99.99%)' || value === 'FINE SILVER (99.99%)') {
            updated.purityType = 'Percentage (%)';
            updated.purityValue = '99.99';
          } else if (value === 'GOLD BULLION (99.90%)') {
            updated.purityType = 'Percentage (%)';
            updated.purityValue = '99.90';
          } else if (value === 'PURE GOLD (99.50%)') {
            updated.purityType = 'Percentage (%)';
            updated.purityValue = '99.50';
          } else if (value === 'PURE SILVER (99.00%)') {
            updated.purityType = 'Percentage (%)';
            updated.purityValue = '99.00';
          }
        }

        // Purity defaults on change
        if (field === 'purityType') {
          if (value === 'None') {
            updated.purityValue = 'None';
          } else if (value === 'Karat') {
            updated.purityValue = '22K';
          } else {
            updated.purityValue = '91.6';
          }
        }

        // Weight conversions
        const wVal = field === 'weight' ? Number(value) : updated.weight;
        const uVal = field === 'weightUnit' ? value : updated.weightUnit;
        updated.weightInGrams = uVal === 'kg' ? toFixed3(wVal * 1000) : toFixed3(wVal);

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
  const handlePayableAmountOverride = () => {
    if (targetTotalInput.trim() === '') {
      setCustomPayableAmount(null);
      setDiscountApplied(0);
      return;
    }
    const target = Number(targetTotalInput);
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
          gstin: customerDetails.gstin.trim() === '' ? 'NILL' : customerDetails.gstin.trim(),
          panAadhaar: idVal,
          idType: customerDetails.idType || 'PAN',
          shippingAddress: isShippingDifferent ? customerDetails.shippingAddress : undefined,
          shippingCity: isShippingDifferent ? customerDetails.shippingCity : undefined,
          shippingStateName: isShippingDifferent ? customerDetails.shippingStateName : undefined,
          shippingStateCode: isShippingDifferent ? customerDetails.shippingStateCode : undefined
        },
        items,
        taxDetails: {
          cgst: finalCgst,
          sgst: finalSgst,
          igst: finalIgst,
          cgstPercent: forwardCalculations.cgstPercent,
          sgstPercent: forwardCalculations.sgstPercent,
          igstPercent: forwardCalculations.igstPercent
        },
        discountApplied: discountApplied || 0,
        grandTotal: finalGrandTotal,
        payableAmount: currentPayableAmount,
        paymentMode: paymentMode,
        isShippingDifferent,
        isSwappedAddress
      };

      await saveInvoice(newInvoice);
      await generateAndDownloadPDF(newInvoice, profile);
      setIsSaved(true);
    } catch (err) {
      console.error(err);
      alert('Error occurred while generating PDF.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (isSaved) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="glass p-8 rounded-2xl border border-indigo-500/20 shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2 font-outfit">Document Saved Successfully!</h1>
          <p className="text-zinc-400 text-sm mb-8">
            Your {type === 'TAX_INVOICE' ? 'Tax Invoice' : 'Delivery Challan'} has been registered in IndexedDB and the PDF has been compiled for preview & download.
          </p>
          
          {/* Summary Details */}
          <div className="w-full bg-zinc-950/40 border border-zinc-850 rounded-xl p-4 mb-8 text-left space-y-3.5 text-xs text-zinc-400">
            <div className="flex justify-between">
              <span>Document Number:</span>
              <strong className="text-white font-mono">{invoiceId}</strong>
            </div>
            <div className="flex justify-between">
              <span>Document Type:</span>
              <strong className="text-zinc-200">{type === 'TAX_INVOICE' ? 'Tax Invoice' : 'Delivery Challan'}</strong>
            </div>
            <div className="flex justify-between">
              <span>Billing Date:</span>
              <strong className="text-zinc-200">
                {new Date(invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Customer Party:</span>
              <strong className="text-zinc-200">{customerDetails.partyName}</strong>
            </div>
            <div className="flex justify-between pt-2.5 border-t border-zinc-900">
              <span className="font-semibold text-zinc-300">Total Paid/Payable:</span>
              <strong className="text-indigo-400 font-bold text-sm">Rs.{currentPayableAmount.toLocaleString('en-IN')}</strong>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <button
              onClick={handleReset}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl text-xs transition duration-300 shadow-xl shadow-indigo-600/20 font-outfit uppercase tracking-wider"
            >
              Generate Another {type === 'TAX_INVOICE' ? 'Invoice' : 'Challan'}
            </button>
            <button
              onClick={onSaveSuccess}
              className="bg-zinc-900 hover:bg-zinc-855 text-zinc-300 hover:text-white font-bold py-3.5 px-6 rounded-xl text-xs transition border border-zinc-800 font-outfit uppercase tracking-wider"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="flex items-center justify-between mb-4 text-indigo-400">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wide">Customer Details</h2>
              </div>
              {type === 'DELIVERY_CHALLAN' && (
                <button
                  type="button"
                  onClick={() => setIsSwappedAddress(!isSwappedAddress)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition ${
                    isSwappedAddress 
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20' 
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-850'
                  }`}
                >
                  {isSwappedAddress ? 'Address Swapped (Consignor ⇄ Consignee)' : 'Swap Addresses (Consignment Return)'}
                </button>
              )}
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
                <label className="flex items-center space-x-2 mt-5">
                  <input
                    type="checkbox"
                    checked={isShippingDifferent}
                    onChange={(e) => {
                      setIsShippingDifferent(e.target.checked);
                      if (!e.target.checked) {
                        handleCustomerFieldChange('shippingAddress', '');
                        handleCustomerFieldChange('shippingCity', '');
                        handleCustomerFieldChange('shippingStateName', '');
                        handleCustomerFieldChange('shippingStateCode', '');
                      }
                    }}
                    className="rounded border-zinc-850 bg-zinc-950/60 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-zinc-300 font-semibold uppercase tracking-wider">Ship to a different address</span>
                </label>
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

            {isShippingDifferent && (
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-3 mt-4">
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-3">Shipping Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Shipping Address</label>
                    <input
                      type="text"
                      placeholder="Shipping street details"
                      value={customerDetails.shippingAddress}
                      onChange={(e) => handleCustomerFieldChange('shippingAddress', e.target.value)}
                      className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Shipping City</label>
                    <input
                      type="text"
                      placeholder="e.g. Agra"
                      value={customerDetails.shippingCity}
                      onChange={(e) => handleCustomerFieldChange('shippingCity', e.target.value)}
                      className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Shipping State</label>
                    <select
                      value={customerDetails.shippingStateName}
                      onChange={(e) => handleCustomerFieldChange('shippingStateName', e.target.value)}
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
                </div>
              </div>
            )}

            {/* ID Proof Type Toggle & Value */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">GSTIN</label>
                <input
                  type="text"
                  placeholder="e.g. 19AAAFS0000A1Z2"
                  value={customerDetails.gstin}
                  onChange={(e) => handleCustomerFieldChange('gstin', e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
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
                  placeholder={customerDetails.idType === 'PAN' ? 'ABCDE1234F' : '123456789012'}
                  value={customerDetails.panAadhaar}
                  onChange={(e) => handleCustomerFieldChange('panAadhaar', e.target.value)}
                  readOnly={customerDetails.gstin.length >= 15 && customerDetails.idType === 'PAN'}
                  className={`w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 ${customerDetails.gstin.length >= 15 && customerDetails.idType === 'PAN' ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>
            
            {/* Visual indicator for swapped address return challans */}
            {type === 'DELIVERY_CHALLAN' && isSwappedAddress && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs leading-normal">
                <strong>Consignment Return Mode Active:</strong> Customer (Consignor) will be printed as the Sender at the top, and your active brand profile (Consignee) will be printed as the Recipient at the bottom of the Challan copies.
              </div>
            )}
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
                      {(profile.showPurityColumn ?? true) && (
                        <>
                          <th className="pb-2">Purity System</th>
                          <th className="pb-2">Purity Value</th>
                        </>
                      )}
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
                                <option value="Gold Alloy Ornament">Gold Alloy Ornament</option>
                                <option value="FINE GOLD (99.99%)">FINE GOLD (99.99%)</option>
                                <option value="GOLD BULLION (99.90%)">GOLD BULLION (99.90%)</option>
                                <option value="PURE GOLD (99.50%)">PURE GOLD (99.50%)</option>
                                <option value="Gold Coin">Gold Coin</option>
                                <option value="Goldsmiths Wares">Goldsmiths Wares</option>
                              </>
                            ) : (
                              <>
                                <option value="Silver Ornaments">Silver Ornaments</option>
                                <option value="Silver Alloy Ornament">Silver Alloy Ornament</option>
                                <option value="FINE SILVER (99.99%)">FINE SILVER (99.99%)</option>
                                <option value="PURE SILVER (99.00%)">PURE SILVER (99.00%)</option>
                                <option value="Silver Coin">Silver Coin</option>
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
                        {(profile.showPurityColumn ?? true) && (
                          <>
                            <td className="py-2.5 pr-2">
                              <select
                                value={item.purityType}
                                onChange={(e) => handleItemFieldChange(item.id, 'purityType', e.target.value)}
                                className="bg-zinc-950 border border-zinc-850 rounded px-1.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                              >
                                <option value="None">None</option>
                                <option value="Karat">Standard Purity (Karat)</option>
                                <option value="Percentage (%)">Alloy (Percentage)</option>
                              </select>
                            </td>
                            <td className="py-2.5 pr-2">
                              {item.purityType === 'None' ? (
                                <span className="text-zinc-600 text-xs px-1.5 flex justify-center">-</span>
                              ) : item.purityType === 'Karat' ? (
                                <select
                                  value={item.purityValue}
                                  onChange={(e) => handleItemFieldChange(item.id, 'purityValue', e.target.value)}
                                  className="bg-zinc-950 border border-zinc-850 rounded px-1.5 py-1 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                                >
                                  <option value="None">None</option>
                                  <option value="24K">24K</option>
                                  <option value="23K">23K</option>
                                  <option value="22K">22K</option>
                                  <option value="20K">20K</option>
                                  <option value="18K">18K</option>
                                  <option value="14K">14K</option>
                                  <option value="9K">9K</option>
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
                          </>
                        )}
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
                            onBlur={() => {
                              if (item.ratePerGram) {
                                const roundedRate = toFixed2(Math.ceil(Number(item.ratePerGram) * 100) / 100);
                                handleItemFieldChange(item.id, 'ratePerGram', roundedRate);
                              }
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
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="e.g. 59600"
                  value={targetTotalInput}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, '');
                    setTargetTotalInput(clean);
                  }}
                  className="w-full bg-zinc-950/60 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-indigo-400 font-bold focus:outline-none focus:border-indigo-500 placeholder-zinc-700"
                />
                <button
                  onClick={handlePayableAmountOverride}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center font-bold text-sm"
                >
                  ✓
                </button>
              </div>
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
