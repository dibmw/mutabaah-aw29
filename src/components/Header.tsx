import React from 'react';
import { MasterUser } from '../types';
import { LogOut, LogIn, RefreshCw, Share2 } from 'lucide-react';

interface HeaderProps {
  currentUser: MasterUser | null;
  onLogout: () => void;
  onLogin: () => void;
  onSync: () => void;
  isSyncing: boolean;
  onOpenReportWA: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onLogin,
  onSync,
  isSyncing,
  onOpenReportWA
}) => {
  return (
    <header className="bg-white text-slate-800 shadow-sm border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center justify-center shrink-0">
              <img
                src="https://www.image2url.com/r2/default/files/1783295328513-c1e80ddc-496a-41bc-af8b-fb84383aea19.png"
                alt="Logo Sekolah"
                className="h-12 sm:h-16 w-auto object-contain drop-shadow-xs transition-transform hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-[#1E3A8A] leading-tight uppercase">
                  INPUT MUTABAAH AL-QUR'AN
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-600 font-semibold leading-snug">
                <span>AL-WILDAN ISLAMIC SCHOOL 29 DEPOK</span>
                <span className="block text-amber-700 font-bold">T.A. 2026/2027</span>
              </p>
            </div>
          </div>
        </div>

        {/* Right: Actions & Teacher Profile Chip */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className="flex items-center gap-2">
            {/* Sync Sheets Button */}
            <button
              onClick={onSync}
              disabled={isSyncing}
              title="Sync data dari Google Sheets"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition-all active:scale-95 disabled:opacity-50 min-h-[38px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#1E3A8A] ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="inline">{isSyncing ? 'Sync...' : 'Sync'}</span>
            </button>

            {/* Report WA Feature Button */}
            <button
              onClick={onOpenReportWA}
              title="Generate & Copy Laporan Harian WhatsApp Guru"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl shadow-xs transition-all border border-emerald-500 min-h-[38px]"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-100" />
              <span>Report WA</span>
            </button>
          </div>

          {/* Profile Chip Guru */}
          {currentUser ? (
            <div className="flex items-center justify-between gap-2.5 bg-slate-50 text-slate-800 pl-3.5 pr-1.5 py-1 rounded-xl border border-slate-200 shadow-2xs min-h-[38px] max-w-[200px] sm:max-w-none transition-all">
              <div className="text-left min-w-0">
                <span className="text-xs font-bold block text-[#1E3A8A] truncate leading-tight">
                  {currentUser.Nama_Guru}
                </span>
                <span className="text-[10px] font-medium text-slate-500 truncate block leading-tight">
                  {currentUser.Email}
                </span>
              </div>
              
              <button
                onClick={onLogout}
                title="Keluar dari sesi guru"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 min-h-[28px] min-w-[28px] flex items-center justify-center border border-transparent hover:border-rose-200"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              title="Klik untuk masuk ke akun guru"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl shadow-2xs transition-all border border-blue-800 active:scale-95 min-h-[38px]"
            >
              <LogIn className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Masuk / Login</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
