import { useState, useEffect } from 'react';
import { getActiveProfile, getAllInvoices } from './db/database';
import type { BusinessProfile, Invoice } from './db/database';
import { BusinessProfileSetup } from './components/BusinessProfileSetup';
import { Dashboard } from './components/Dashboard';
import { BillingScreen } from './components/BillingScreen';
import { Loader2 } from 'lucide-react';

function App() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [screen, setScreen] = useState<'DASHBOARD' | 'SETUP' | 'BILLING'>('DASHBOARD');
  
  // Billing specific state
  const [activeBillType, setActiveBillType] = useState<'TAX_INVOICE' | 'DELIVERY_CHALLAN'>('TAX_INVOICE');

  // Load profile and invoices from IndexedDB
  const refreshData = async () => {
    try {
      const activeProfile = await getActiveProfile();
      const allInvoices = await getAllInvoices();
      setProfile(activeProfile);
      setInvoices(allInvoices);
      
      if (!activeProfile) {
        setScreen('SETUP');
      } else {
        setScreen('DASHBOARD');
      }
    } catch (err) {
      console.error('Error loading DB values', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleSetupComplete = (newProfile: BusinessProfile) => {
    setProfile(newProfile);
    setScreen('DASHBOARD');
    refreshData();
  };

  const handleNewBill = (type: 'TAX_INVOICE' | 'DELIVERY_CHALLAN') => {
    setActiveBillType(type);
    setScreen('BILLING');
  };

  const handleSaveSuccess = () => {
    setScreen('DASHBOARD');
    refreshData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
        <span className="text-sm font-semibold text-zinc-400 font-outfit">Loading local offline database...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans antialiased text-zinc-200">
      {screen === 'SETUP' && (
        <BusinessProfileSetup
          onSetupComplete={handleSetupComplete}
          initialData={profile}
        />
      )}

      {screen === 'DASHBOARD' && profile && (
        <Dashboard
          profile={profile}
          invoices={invoices}
          onNewBill={handleNewBill}
          onEditProfile={() => setScreen('SETUP')}
        />
      )}

      {screen === 'BILLING' && profile && (
        <BillingScreen
          profile={profile}
          type={activeBillType}
          onBack={() => setScreen('DASHBOARD')}
          onSaveSuccess={handleSaveSuccess}
        />
      )}
    </div>
  );
}

export default App;
