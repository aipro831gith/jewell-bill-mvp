import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Invoice, BusinessProfile } from '../db/database';
import { Plus, Download, Search, FileText, IndianRupee, CreditCard, ShoppingBag, Landmark, Settings, Sparkles, ChevronDown, Trash2, ShieldCheck } from 'lucide-react';
import { generateAndDownloadPDF } from '../utils/pdfGenerator';

interface DashboardProps {
  profile: BusinessProfile;
  profiles: BusinessProfile[];
  invoices: Invoice[];
  onNewBill: (type: 'TAX_INVOICE' | 'DELIVERY_CHALLAN', templateId: 1 | 2 | 3) => void;
  onEditProfile: () => void;
  onAddNewProfile: () => void;
  onSwitchProfile: (id: number) => void;
  onDeleteProfile: (id: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  profile,
  profiles,
  invoices,
  onNewBill,
  onEditProfile,
  onAddNewProfile,
  onSwitchProfile,
  onDeleteProfile,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'TAX_INVOICE' | 'DELIVERY_CHALLAN'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<1 | 2 | 3>(1); // Default template
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  // Profile switcher state
  const [showSwitcher, setShowSwitcher] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Close switcher on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setShowSwitcher(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Stats Calculations
  const stats = useMemo(() => {
    let totalTaxInvoicesCount = 0;
    let totalChallansCount = 0;
    let totalTaxInvoiceRevenue = 0;
    let totalCashCollection = 0;
    let totalOnlineCollection = 0;

    invoices.forEach((inv) => {
      // Only calculate stats for the active profile's invoices
      if (inv.profileId === profile.id) {
        if (inv.type === 'TAX_INVOICE') {
          totalTaxInvoicesCount++;
          totalTaxInvoiceRevenue += inv.payableAmount;
          if (inv.paymentMode === 'Cash') {
            totalCashCollection += inv.payableAmount;
          } else {
            totalOnlineCollection += inv.payableAmount;
          }
        } else {
          totalChallansCount++;
        }
      }
    });

    return {
      totalTaxInvoicesCount,
      totalChallansCount,
      totalTaxInvoiceRevenue,
      totalCashCollection,
      totalOnlineCollection,
    };
  }, [invoices, profile]);

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        // Only show invoices belonging to the active profile
        if (inv.profileId !== profile.id) return false;

        const matchesSearch =
          inv.invoiceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.customerDetails.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.customerDetails.phone.includes(searchTerm);
        
        const matchesType =
          filterType === 'ALL' ? true : inv.type === filterType;

        return matchesSearch && matchesType;
      })
      .sort((a, b) => b.date - a.date);
  }, [invoices, searchTerm, filterType, profile]);

  const handleDownloadPDF = async (inv: Invoice) => {
    setDownloadingId(inv.invoiceId);
    try {
      await generateAndDownloadPDF(inv, profile);
    } catch (err) {
      console.error('Failed to download PDF', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteProfileClick = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (profiles.length === 1) {
      alert('You must keep at least one profile in the database.');
      return;
    }
    if (confirm('Are you sure you want to delete this business profile? All invoices for this profile will remain in database but will be inaccessible.')) {
      onDeleteProfile(id);
    }
  };

  return (
    <div className="min-h-screen pb-24 px-4 sm:px-6 lg:px-8">
      {/* Brand Header Banner */}
      <div className="max-w-7xl mx-auto pt-6 pb-4">
        <div className="glass p-6 rounded-2xl border border-indigo-500/10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative">
          
          <div className="flex items-center space-x-4">
            <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
              <img
                src={profile.logoData}
                alt={profile.brandName}
                className="h-14 w-14 object-contain rounded-lg"
              />
            </div>
            
            {/* Account Switcher Header */}
            <div className="relative" ref={switcherRef}>
              <button
                onClick={() => setShowSwitcher(!showSwitcher)}
                className="flex items-center space-x-2 text-left group focus:outline-none"
              >
                <div>
                  <div className="flex items-center space-x-1.5">
                    <h1 className="text-xl font-bold tracking-tight text-white font-outfit uppercase group-hover:text-indigo-400 transition">
                      {profile.brandName}
                    </h1>
                    <ChevronDown className="h-4 w-4 text-zinc-400 group-hover:text-indigo-400 transition" />
                  </div>
                  <p className="text-xs text-zinc-400 font-medium">
                    {profile.tagline || 'Wholesale & Manufacturers'} | Estd: {profile.estdYear}
                  </p>
                </div>
              </button>

              {/* Google-like Account Dropdown */}
              {showSwitcher && (
                <div className="absolute left-0 mt-2 w-72 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl z-50 p-3 divide-y divide-zinc-900 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="py-2 text-[10px] uppercase font-bold tracking-wider text-zinc-500 px-2">
                    Switch Brand Profile
                  </div>
                  <div className="py-2 space-y-1 max-h-48 overflow-y-auto">
                    {profiles.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (p.id !== undefined) {
                            onSwitchProfile(p.id);
                            setShowSwitcher(false);
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                          p.id === profile.id ? 'bg-indigo-600/10 border border-indigo-500/30' : 'hover:bg-zinc-900 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 overflow-hidden">
                          <img
                            src={p.logoData}
                            alt=""
                            className="h-8 w-8 object-contain rounded bg-zinc-950 border border-zinc-800 shrink-0"
                          />
                          <div className="truncate text-left">
                            <div className="text-xs font-bold text-zinc-200 truncate uppercase">{p.brandName}</div>
                            <div className="text-[10px] text-zinc-500 truncate">{p.legalName}</div>
                          </div>
                        </div>
                        {p.id !== profile.id && p.id !== undefined && (
                          <button
                            onClick={(e) => handleDeleteProfileClick(p.id!, e)}
                            className="text-zinc-500 hover:text-red-400 p-1 transition rounded hover:bg-red-500/10"
                            title="Delete profile"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        onAddNewProfile();
                        setShowSwitcher(false);
                      }}
                      className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition border border-zinc-800"
                    >
                      <Plus className="h-4 w-4 text-indigo-400" />
                      <span>Add New Brand</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <button
              onClick={onEditProfile}
              className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-zinc-700"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-lg shadow-indigo-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>Create Invoice</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid (Responsive) */}
      <div className="max-w-7xl mx-auto mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-xl border border-zinc-850 flex items-center space-x-4">
            <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">Total Tax Invoices</p>
              <p className="text-xl font-bold font-outfit text-white mt-0.5">{stats.totalTaxInvoicesCount}</p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-zinc-850 flex items-center space-x-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
              <IndianRupee className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">Total Revenue</p>
              <p className="text-xl font-bold font-outfit text-white mt-0.5">₹{stats.totalTaxInvoiceRevenue.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-zinc-850 flex items-center space-x-4">
            <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">Challans Generated</p>
              <p className="text-xl font-bold font-outfit text-white mt-0.5">{stats.totalChallansCount}</p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-zinc-850 flex items-center space-x-4">
            <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">Settled (Cash / Online)</p>
              <p className="text-[11px] font-semibold font-outfit text-white mt-0.5">
                Cash: ₹{stats.totalCashCollection.toLocaleString('en-IN')} | Bank: ₹{stats.totalOnlineCollection.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Invoices Section */}
      <div className="max-w-7xl mx-auto mt-8">
        <div className="glass rounded-xl border border-zinc-800 p-6 shadow-xl">
          {/* Search, Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by Invoice No, Customer name, or Phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 placeholder-zinc-500"
              />
            </div>
            
            <div className="flex space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {(['ALL', 'TAX_INVOICE', 'DELIVERY_CHALLAN'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`flex-1 sm:flex-none text-xs font-semibold px-4 py-2.5 rounded-lg transition whitespace-nowrap ${
                    filterType === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-850 hover:text-white'
                  }`}
                >
                  {type === 'ALL' ? 'All Bills' : type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Responsive Invoice Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-800">
              <thead>
                <tr className="bg-zinc-950/40 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Bill ID</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Customer (Billed To)</th>
                  <th className="px-6 py-3">Total Amount</th>
                  <th className="px-6 py-3">Settlement</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850 text-sm text-zinc-300">
                {filteredInvoices.length > 0 ? (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.invoiceId} className="hover:bg-zinc-900/30 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-500">
                        {new Date(inv.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-zinc-200">
                        {inv.invoiceId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          inv.type === 'TAX_INVOICE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {inv.type === 'TAX_INVOICE' ? 'Tax Invoice' : 'Challan'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-zinc-200">{inv.customerDetails.partyName}</div>
                        <div className="text-xs text-zinc-500">{inv.customerDetails.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-zinc-100">
                        ₹{inv.payableAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs text-zinc-400 flex items-center space-x-1">
                          {inv.paymentMode === 'Cash' && <IndianRupee className="h-3.5 w-3.5 text-zinc-500" />}
                          {inv.paymentMode === 'Card' && <CreditCard className="h-3.5 w-3.5 text-zinc-500" />}
                          {inv.paymentMode === 'UPI' && <Sparkles className="h-3.5 w-3.5 text-zinc-500" />}
                          {inv.paymentMode === 'Bank Transfer' && <Landmark className="h-3.5 w-3.5 text-zinc-500" />}
                          {inv.paymentMode === 'RTGS' && <Landmark className="h-3.5 w-3.5 text-zinc-500 animate-pulse" />}
                          <span>{inv.paymentMode && inv.paymentMode !== 'None' ? inv.paymentMode : 'NILL'}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDownloadPDF(inv)}
                          disabled={downloadingId === inv.invoiceId}
                          className="bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white disabled:opacity-50 p-2 rounded-lg transition border border-indigo-500/20 inline-flex items-center space-x-1"
                        >
                          <Download className="h-4 w-4" />
                          <span className="text-xs font-semibold px-1">PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 text-sm">
                      No invoices found matching your criteria. Click "+ NEW BILL" to generate one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sticky floating new bill button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-8 right-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-2xl transition duration-300 hover:scale-110 flex items-center justify-center border border-indigo-500/30 group z-50 animate-bounce"
        aria-label="Create New Invoice"
      >
        <Plus className="h-7 w-7 transition-transform group-hover:rotate-90" />
      </button>

      {/* Choose Invoice Type & Template Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass max-w-lg w-full rounded-2xl border border-zinc-800 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-white font-outfit mb-2">Create New Document</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Configure template styling and document type before proceeding.
            </p>

            {/* Template Selector Options */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Choose Design Template</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setSelectedTemplate(1)}
                  className={`p-3 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center text-center transition ${
                    selectedTemplate === 1
                      ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400 font-bold'
                      : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="h-5 w-5 mb-1 text-indigo-500" />
                  <span>Classic Indigo</span>
                </button>
                <button
                  onClick={() => setSelectedTemplate(2)}
                  className={`p-3 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center text-center transition ${
                    selectedTemplate === 2
                      ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-bold'
                      : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white'
                  }`}
                >
                  <FileText className="h-5 w-5 mb-1 text-rose-500" />
                  <span>Elegant Crimson</span>
                </button>
                <button
                  onClick={() => setSelectedTemplate(3)}
                  className={`p-3 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center text-center transition ${
                    selectedTemplate === 3
                      ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-bold'
                      : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="h-5 w-5 mb-1 text-amber-500" />
                  <span>Luxurious Gold</span>
                </button>
              </div>
            </div>

            {/* Document Type buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setShowModal(false);
                  onNewBill('TAX_INVOICE', selectedTemplate);
                }}
                className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-emerald-500 p-6 rounded-xl flex flex-col items-center justify-center text-center transition group"
              >
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg mb-3 group-hover:scale-105 transition">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="text-xs font-bold text-zinc-200">TAX INVOICE</span>
                <span className="text-[10px] text-zinc-500 mt-1">With 3% GST compliance</span>
              </button>

              <button
                onClick={() => {
                  setShowModal(false);
                  onNewBill('DELIVERY_CHALLAN', selectedTemplate);
                }}
                className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500 p-6 rounded-xl flex flex-col items-center justify-center text-center transition group"
              >
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg mb-3 group-hover:scale-105 transition">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="text-xs font-bold text-zinc-200">DELIVERY CHALLAN</span>
                <span className="text-[10px] text-zinc-500 mt-1">Non-tax consignment</span>
              </button>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition px-4 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
