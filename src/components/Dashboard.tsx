import React, { useState, useMemo } from 'react';
import type { Invoice, BusinessProfile } from '../db/database';
import { Plus, Download, Search, FileText, IndianRupee, CreditCard, ShoppingBag, Landmark, Settings, Sparkles } from 'lucide-react';
import { generateAndDownloadPDF } from '../utils/pdfGenerator';

interface DashboardProps {
  profile: BusinessProfile;
  invoices: Invoice[];
  onNewBill: (type: 'TAX_INVOICE' | 'DELIVERY_CHALLAN') => void;
  onEditProfile: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ profile, invoices, onNewBill, onEditProfile }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'TAX_INVOICE' | 'DELIVERY_CHALLAN'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Stats Calculations
  const stats = useMemo(() => {
    let totalTaxInvoicesCount = 0;
    let totalChallansCount = 0;
    let totalTaxInvoiceRevenue = 0;
    let totalCashCollection = 0;
    let totalOnlineCollection = 0;

    invoices.forEach((inv) => {
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
    });

    return {
      totalTaxInvoicesCount,
      totalChallansCount,
      totalTaxInvoiceRevenue,
      totalCashCollection,
      totalOnlineCollection,
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        const matchesSearch =
          inv.invoiceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.customerDetails.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inv.customerDetails.phone.includes(searchTerm);
        
        const matchesType =
          filterType === 'ALL' ? true : inv.type === filterType;

        return matchesSearch && matchesType;
      })
      .sort((a, b) => b.date - a.date); // Sort by newest first
  }, [invoices, searchTerm, filterType]);

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

  return (
    <div className="min-h-screen pb-24 px-4 sm:px-6 lg:px-8">
      {/* Brand Header Banner */}
      <div className="max-w-7xl mx-auto pt-6 pb-4">
        <div className="glass p-6 rounded-2xl border border-indigo-500/10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="flex items-center space-x-4">
            <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
              <img
                src={profile.logoData}
                alt={profile.brandName}
                className="h-14 w-14 object-contain rounded-lg"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white font-outfit uppercase">
                {profile.brandName}
              </h1>
              <p className="text-xs text-zinc-400 font-medium">
                {profile.tagline || 'Wholesale & Manufacturers'} | Estd: {profile.estdYear}
              </p>
              <p className="text-[10px] text-zinc-500">
                GSTIN: {profile.gstin} | Jurisdiction: {profile.jurisdiction}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onEditProfile}
              className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-zinc-700"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-lg shadow-indigo-600/20"
            >
              <Plus className="h-4 w-4" />
              <span>Create Invoice</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Section */}
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

      {/* Main invoices grid table */}
      <div className="max-w-7xl mx-auto mt-8">
        <div className="glass rounded-xl border border-zinc-800 p-6 shadow-xl">
          {/* Search and filter row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by Invoice No, Customer name, or Phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 placeholder-zinc-500"
              />
            </div>
            
            <div className="flex space-x-2 w-full sm:w-auto">
              {(['ALL', 'TAX_INVOICE', 'DELIVERY_CHALLAN'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`flex-1 sm:flex-none text-xs font-semibold px-4 py-2 rounded-lg transition ${
                    filterType === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  {type === 'ALL' ? 'All Bills' : type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Data Table */}
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
                          <span>{inv.paymentMode}</span>
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
        className="fixed bottom-8 right-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-2xl transition duration-300 hover:scale-110 flex items-center justify-center border border-indigo-500/30 group z-50"
        aria-label="Create New Invoice"
      >
        <Plus className="h-7 w-7 transition-transform group-hover:rotate-90" />
      </button>

      {/* Choose Invoice Type Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass max-w-md w-full rounded-2xl border border-zinc-800 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-white font-outfit mb-4">Choose Bill Type</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Select the type of bill document you wish to generate. This will automatically set up standard HSN rules, prefixes, and GST structures.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setShowModal(false);
                  onNewBill('TAX_INVOICE');
                }}
                className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-emerald-500 p-6 rounded-xl flex flex-col items-center justify-center text-center transition group"
              >
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg mb-3 group-hover:scale-105 transition">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="text-xs font-bold text-zinc-200">TAX INVOICE</span>
                <span className="text-[10px] text-zinc-500 mt-1">With strict 3% GST</span>
              </button>

              <button
                onClick={() => {
                  setShowModal(false);
                  onNewBill('DELIVERY_CHALLAN');
                }}
                className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500 p-6 rounded-xl flex flex-col items-center justify-center text-center transition group"
              >
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg mb-3 group-hover:scale-105 transition">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="text-xs font-bold text-zinc-200">DELIVERY CHALLAN</span>
                <span className="text-[10px] text-zinc-500 mt-1">Non-tax document</span>
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
