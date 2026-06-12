import React, { useState } from 'react';
import { saveProfile } from '../db/database';
import type { BusinessProfile } from '../db/database';
import { ShieldCheck, Upload, Loader2, Sparkles, Building, Landmark, QrCode } from 'lucide-react';

export const INDIAN_STATES = [
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' },
  { name: 'Haryana', code: '06' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Karnataka', code: '29' },
  { name: 'Kerala', code: '32' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Manipur', code: '14' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Mizoram', code: '15' },
  { name: 'Nagaland', code: '13' },
  { name: 'Odisha', code: '21' },
  { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Sikkim', code: '11' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Tripura', code: '16' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'West Bengal', code: '19' },
  { name: 'Andaman & Nicobar Islands', code: '35' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Dadra & Nagar Haveli and Daman & Diu', code: '26' },
  { name: 'Delhi', code: '07' },
  { name: 'Jammu & Kashmir', code: '01' },
  { name: 'Lakshadweep', code: '31' },
  { name: 'Puducherry', code: '34' },
  { name: 'Ladakh', code: '38' }
];

interface BusinessProfileSetupProps {
  onSetupComplete: (profile: BusinessProfile) => void;
  initialData?: BusinessProfile | null;
  onCancel?: () => void;
}

export const BusinessProfileSetup: React.FC<BusinessProfileSetupProps> = ({ onSetupComplete, initialData, onCancel }) => {
  const [formData, setFormData] = useState<Partial<BusinessProfile>>(initialData || {
    brandName: '',
    legalName: '',
    tagline: '',
    estdYear: new Date().getFullYear(),
    taxInvoicePrefix: 'SNJ',
    challanPrefix: 'DC',
    logoData: '',
    gstin: '',
    pan: '',
    stateName: '',
    stateCode: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    jurisdiction: 'Kolkata',
    bankName: '',
    branch: '',
    accountName: '',
    accountNo: '',
    ifsc: '',
    upiId: '',
    qrCodeData: ''
  });

  const [compressingLogo, setCompressingLogo] = useState(false);
  const [compressingQr, setCompressingQr] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const compressImage = (file: File, maxSizeKB: number, callback: (base64: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Downscale image if too large
        const MAX_DIM = 600;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          
          let quality = 0.9;
          let base64 = canvas.toDataURL('image/jpeg', quality);
          // Loop quality adjustment until file size is below max limit
          while ((base64.length * 3) / 4 / 1024 > maxSizeKB && quality > 0.1) {
            quality -= 0.1;
            base64 = canvas.toDataURL('image/jpeg', quality);
          }
          callback(base64);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCompressingLogo(true);
      compressImage(file, 95, (base64) => {
        setFormData(prev => ({ ...prev, logoData: base64 }));
        setCompressingLogo(false);
      });
    }
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCompressingQr(true);
      compressImage(file, 95, (base64) => {
        setFormData(prev => ({ ...prev, qrCodeData: base64 }));
        setCompressingQr(false);
      });
    }
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stateName = e.target.value;
    const selectedState = INDIAN_STATES.find(s => s.name === stateName);
    setFormData(prev => ({
      ...prev,
      stateName,
      stateCode: selectedState ? selectedState.code : ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Strict validation
    if (!formData.brandName || !formData.legalName || !formData.gstin || !formData.stateName || !formData.stateCode || !formData.address || !formData.city || !formData.phone || !formData.email) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (!formData.logoData) {
      setErrorMsg('Business logo is required.');
      return;
    }

    try {
      const profileToSave = formData as BusinessProfile;
      await saveProfile(profileToSave);
      onSetupComplete(profileToSave);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to save profile. Try again.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="glass p-8 rounded-2xl shadow-xl border border-indigo-500/20">
        
        {/* Title Header */}
        <div className="flex items-center space-x-3 mb-8">
          <div className="p-3 bg-indigo-600 rounded-xl">
            <ShieldCheck className="h-8 w-8 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">
              {initialData ? 'Edit Business Profile' : 'Initial Business Setup'}
            </h1>
            <p className="text-sm text-zinc-400">
              Configure your wholesale brand & tax identities to launch your offline database.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 mb-6 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: Logo & Brand Information */}
          <div className="bg-zinc-900/30 p-6 rounded-xl border border-zinc-800">
            <div className="flex items-center space-x-2 mb-4 text-indigo-400">
              <Sparkles className="h-5 w-5" />
              <h2 className="text-base font-semibold text-zinc-200">Identity & Branding</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Logo Upload Box */}
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl p-4 transition cursor-pointer relative bg-zinc-950/40 h-40">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {compressingLogo ? (
                  <div className="flex flex-col items-center space-y-2">
                    <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                    <span className="text-xs text-zinc-400">Compressing...</span>
                  </div>
                ) : formData.logoData ? (
                  <div className="flex flex-col items-center">
                    <img
                      src={formData.logoData}
                      alt="Preview"
                      className="max-h-24 object-contain rounded mb-2 border border-zinc-800"
                    />
                    <span className="text-xs text-indigo-400 font-medium">Change Logo</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <Upload className="h-8 w-8 text-zinc-400 mb-2" />
                    <span className="text-xs text-zinc-300 font-medium">Upload Logo</span>
                    <span className="text-[10px] text-zinc-500 mt-1">PNG/JPG (Auto-compress &lt;100KB)</span>
                  </div>
                )}
              </div>

              {/* Brand Details */}
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Brand Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SRI NARAYAN JEWELLERS"
                      value={formData.brandName}
                      onChange={e => setFormData(prev => ({ ...prev, brandName: e.target.value }))}
                      className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Legal Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SRI NARAYAN JEWELLERS PVT. LTD."
                      value={formData.legalName}
                      onChange={e => setFormData(prev => ({ ...prev, legalName: e.target.value }))}
                      className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Tagline / Motto</label>
                    <input
                      type="text"
                      placeholder="e.g. Wholesale & Manufacturers"
                      value={formData.tagline}
                      onChange={e => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
                      className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Established Year *</label>
                    <input
                      type="number"
                      required
                      value={formData.estdYear}
                      onChange={e => setFormData(prev => ({ ...prev, estdYear: parseInt(e.target.value, 10) || new Date().getFullYear() }))}
                      className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Tax Invoice Prefix *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SNJ"
                  value={formData.taxInvoicePrefix}
                  onChange={e => setFormData(prev => ({ ...prev, taxInvoicePrefix: e.target.value }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Challan Prefix *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DC"
                  value={formData.challanPrefix}
                  onChange={e => setFormData(prev => ({ ...prev, challanPrefix: e.target.value }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Tax & Location Setup */}
          <div className="bg-zinc-900/30 p-6 rounded-xl border border-zinc-800">
            <div className="flex items-center space-x-2 mb-4 text-indigo-400">
              <Building className="h-5 w-5" />
              <h2 className="text-base font-semibold text-zinc-200">Statutory & Contact Info</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">GSTIN *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 19AAAFS0000A1Z2"
                  value={formData.gstin}
                  onChange={e => setFormData(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">PAN *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AAAFS0000A"
                  value={formData.pan}
                  onChange={e => setFormData(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">GST State Selector *</label>
                <select
                  required
                  value={formData.stateName}
                  onChange={handleStateChange}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select Indian State</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st.name} value={st.name}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Silent state info rendering */}
            {formData.stateCode && (
              <p className="text-[11px] text-zinc-500 mt-2">
                Silent Hook: Selected State Code is <strong className="text-zinc-400">{formData.stateCode}</strong>.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Address *</label>
                <input
                  type="text"
                  required
                  placeholder="Street Address, Area"
                  value={formData.address}
                  onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">City *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kolkata"
                  value={formData.city}
                  onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. billing@brand.com"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Legal Jurisdiction *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KOLKATA"
                  value={formData.jurisdiction}
                  onChange={e => setFormData(prev => ({ ...prev, jurisdiction: e.target.value }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Bank & UPI (Optional Group) */}
          <div className="bg-zinc-900/30 p-6 rounded-xl border border-zinc-800">
            <div className="flex items-center space-x-2 mb-4 text-indigo-400">
              <Landmark className="h-5 w-5" />
              <h2 className="text-base font-semibold text-zinc-200">Bank & UPI Settlement (Optional)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. State Bank of India"
                  value={formData.bankName}
                  onChange={e => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Branch</label>
                <input
                  type="text"
                  placeholder="e.g. Chowringhee Road"
                  value={formData.branch}
                  onChange={e => setFormData(prev => ({ ...prev, branch: e.target.value }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Account Beneficiary Name</label>
                <input
                  type="text"
                  placeholder="e.g. SRI NARAYAN JEWELLERS"
                  value={formData.accountName}
                  onChange={e => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Account Number</label>
                <input
                  type="text"
                  placeholder="e.g. 123456789012"
                  value={formData.accountNo}
                  onChange={e => setFormData(prev => ({ ...prev, accountNo: e.target.value }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">IFSC Code</label>
                <input
                  type="text"
                  placeholder="e.g. SBIN0000001"
                  value={formData.ifsc}
                  onChange={e => setFormData(prev => ({ ...prev, ifsc: e.target.value.toUpperCase() }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">UPI ID for Quick Collect</label>
                <input
                  type="text"
                  placeholder="e.g. snj@upi"
                  value={formData.upiId}
                  onChange={e => setFormData(prev => ({ ...prev, upiId: e.target.value }))}
                  className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Optional QR Code Upload */}
            <div className="mt-6">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Optional UPI QR Code Image</label>
              <div className="flex items-center space-x-4">
                <div className="flex flex-col items-center justify-center border border-dashed border-zinc-700 hover:border-indigo-500 rounded-lg p-2 transition cursor-pointer relative bg-zinc-950/40 w-32 h-32">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {compressingQr ? (
                    <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
                  ) : formData.qrCodeData ? (
                    <img
                      src={formData.qrCodeData}
                      alt="UPI QR Preview"
                      className="max-h-28 object-contain rounded"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      <QrCode className="h-6 w-6 text-zinc-400 mb-1" />
                      <span className="text-[10px] text-zinc-400">Upload QR</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Upload your UPI payment static QR code. If provided, this logo will be formatted under 100KB and saved to IndexedDB storage.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end items-center space-x-3 pt-4">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="bg-zinc-800 hover:bg-zinc-705 text-zinc-300 hover:text-white font-medium px-6 py-3 rounded-lg text-sm transition font-outfit border border-zinc-700"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={compressingLogo || compressingQr}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-8 py-3 rounded-lg text-sm transition font-outfit shadow-lg shadow-indigo-600/20"
            >
              {initialData ? 'Update Profile' : 'Initialize Database'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
