import React from 'react';
import type { BusinessProfile } from '../db/database';
import { PlusCircle, Trash2, Layout, Sparkles } from 'lucide-react';

interface ProfileSelectionProps {
  profiles: BusinessProfile[];
  onSelectProfile: (id: number) => void;
  onAddNewProfile: () => void;
  onDeleteProfile: (id: number) => void;
}

export const ProfileSelection: React.FC<ProfileSelectionProps> = ({
  profiles,
  onSelectProfile,
  onAddNewProfile,
  onDeleteProfile,
}) => {
  const handleDeleteClick = (id: number, brandName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${brandName}"? All invoices for this profile will remain in the database but will be inaccessible.`)) {
      onDeleteProfile(id);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between py-12 px-6 bg-zinc-950">
      {/* Top Header Row */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Layout className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white font-outfit uppercase">
            JEWELL BILL MVP
          </span>
        </div>
        <button
          onClick={onAddNewProfile}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition shadow-lg shadow-indigo-600/20"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Add New Brand</span>
        </button>
      </div>

      {/* Profile Selector Section */}
      <div className="max-w-4xl w-full mx-auto my-auto text-center py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2 font-outfit">
          Who is billing today?
        </h1>
        <p className="text-zinc-400 text-sm max-w-md mx-auto mb-12">
          Select a brand profile to access its dashboard, customers, and generate tax invoices/challans.
        </p>

        {/* Brand Profile Grid */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          {profiles.map((profile) => {
            const firstLetter = profile.brandName ? profile.brandName.charAt(0).toUpperCase() : 'B';
            
            // Border color depending on saved templateId
            let themeColorClass = 'group-hover:border-indigo-500 shadow-indigo-500/10';
            if (profile.templateId === 2) {
              themeColorClass = 'group-hover:border-rose-500 shadow-rose-500/10';
            } else if (profile.templateId === 3) {
              themeColorClass = 'group-hover:border-amber-500 shadow-amber-500/10';
            }

            return (
              <div
                key={profile.id}
                onClick={() => profile.id !== undefined && onSelectProfile(profile.id)}
                className="group flex flex-col items-center cursor-pointer relative w-36 sm:w-40"
              >
                {/* Circular Avatar */}
                <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-zinc-900 border-4 border-zinc-800 transition duration-300 transform group-hover:scale-105 group-hover:-translate-y-1 flex items-center justify-center overflow-hidden relative shadow-xl ${themeColorClass}`}>
                  {profile.logoData ? (
                    <img
                      src={profile.logoData}
                      alt={profile.brandName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-zinc-400 group-hover:text-white transition">
                      {firstLetter}
                    </span>
                  )}
                </div>

                {/* Delete Hover Badge (Top Right of Avatar) */}
                <button
                  onClick={(e) => profile.id !== undefined && handleDeleteClick(profile.id, profile.brandName, e)}
                  className="absolute top-0 right-4 sm:right-5 bg-red-650 hover:bg-red-700 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition duration-200 z-10 hover:scale-110"
                  title="Delete Brand Profile"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                {/* Brand Details */}
                <span className="mt-4 text-sm font-bold text-zinc-400 group-hover:text-white transition uppercase tracking-wide truncate max-w-full font-outfit">
                  {profile.brandName}
                </span>
                
                <span className="text-[10px] text-zinc-500 mt-1 truncate max-w-full">
                  {profile.city}, {profile.stateName}
                </span>

                {profile.templateId && (
                  <span className={`text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded mt-1.5 ${
                    profile.templateId === 1 ? 'bg-indigo-650/15 text-indigo-400' :
                    profile.templateId === 2 ? 'bg-rose-650/15 text-rose-400' :
                    'bg-amber-650/15 text-amber-400'
                  }`}>
                    {profile.templateId === 1 ? 'Indigo' :
                     profile.templateId === 2 ? 'Crimson' : 'Gold'} Theme
                  </span>
                )}
              </div>
            );
          })}

          {/* Quick Setup profile add card */}
          <div
            onClick={onAddNewProfile}
            className="group flex flex-col items-center cursor-pointer w-36 sm:w-40"
          >
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-zinc-950 border-4 border-dashed border-zinc-800 group-hover:border-zinc-500 hover:bg-zinc-900/40 transition duration-300 transform group-hover:scale-105 group-hover:-translate-y-1 flex items-center justify-center shadow-xl">
              <PlusCircle className="h-10 w-10 text-zinc-600 group-hover:text-zinc-450 transition" />
            </div>
            <span className="mt-4 text-sm font-semibold text-zinc-500 group-hover:text-zinc-300 transition font-outfit">
              Add New Brand
            </span>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="max-w-6xl w-full mx-auto text-center border-t border-zinc-900 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-650 gap-4">
        <span>Sri Narayan Jewellers Wholesale Invoice Suite (v5.0)</span>
        <div className="flex items-center space-x-1 text-zinc-500">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          <span>Offline-First PWA Vault</span>
        </div>
      </div>
    </div>
  );
};
