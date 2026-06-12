import { useState, useEffect } from 'react';
import { getActiveProfile, getAllInvoices, getAllProfiles, deleteProfile } from './db/database';
import type { BusinessProfile, Invoice } from './db/database';
import { BusinessProfileSetup } from './components/BusinessProfileSetup';
import { Dashboard } from './components/Dashboard';
import { BillingScreen } from './components/BillingScreen';
import { Loader2 } from 'lucide-react';

function App() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [screen, setScreen] = useState<'DASHBOARD' | 'SETUP' | 'BILLING'>('DASHBOARD');
  
  // Billing specific states
  const [activeBillType, setActiveBillType] = useState<'TAX_INVOICE' | 'DELIVERY_CHALLAN'>('TAX_INVOICE');
  const [selectedTemplate, setSelectedTemplate] = useState<1 | 2 | 3>(1);

  // Load database information on mount
  const refreshData = async () => {
    try {
      const active = await getActiveProfile();
      const allProfiles = await getAllProfiles();
      const allInvoices = await getAllInvoices();
      
      setProfile(active);
      setProfiles(allProfiles);
      setInvoices(allInvoices);
      
      if (allProfiles.length === 0) {
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
    if (newProfile.id !== undefined) {
      localStorage.setItem('activeProfileId', newProfile.id.toString());
    }
    setScreen('DASHBOARD');
    refreshData();
  };

  const handleNewBill = (type: 'TAX_INVOICE' | 'DELIVERY_CHALLAN', templateId: 1 | 2 | 3) => {
    setActiveBillType(type);
    setSelectedTemplate(templateId);
    setScreen('BILLING');
  };

  const handleSaveSuccess = () => {
    setScreen('DASHBOARD');
    refreshData();
  };

  const handleSwitchProfile = async (id: number) => {
    localStorage.setItem('activeProfileId', id.toString());
    const matched = profiles.find((p) => p.id === id);
    if (matched) {
      setProfile(matched);
    }
    const allInvoices = await getAllInvoices();
    setInvoices(allInvoices);
  };

  const handleDeleteProfile = async (id: number) => {
    await deleteProfile(id);
    const updatedProfiles = profiles.filter((p) => p.id !== id);
    setProfiles(updatedProfiles);
    
    if (updatedProfiles.length > 0 && updatedProfiles[0].id !== undefined) {
      handleSwitchProfile(updatedProfiles[0].id);
    } else {
      setProfile(null);
      setScreen('SETUP');
    }
  };

  const handleLogOut = () => {
    localStorage.removeItem('activeProfileId');
    setProfile(null);
    setScreen('SETUP');
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
          onCancel={profiles.length > 0 ? () => setScreen('DASHBOARD') : undefined}
        />
      )}

      {screen === 'DASHBOARD' && profile && (
        <Dashboard
          profile={profile}
          profiles={profiles}
          invoices={invoices}
          onNewBill={handleNewBill}
          onEditProfile={() => setScreen('SETUP')}
          onAddNewProfile={() => {
            setProfile(null);
            setScreen('SETUP');
          }}
          onSwitchProfile={handleSwitchProfile}
          onDeleteProfile={handleDeleteProfile}
          onLogOut={handleLogOut}
        />
      )}

      {screen === 'BILLING' && profile && (
        <BillingScreen
          profile={profile}
          type={activeBillType}
          templateId={selectedTemplate}
          onBack={() => setScreen('DASHBOARD')}
          onSaveSuccess={handleSaveSuccess}
        />
      )}
    </div>
  );
}

export default App;
