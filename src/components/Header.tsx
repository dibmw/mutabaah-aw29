import React from 'react';
import { MasterUser } from '../types';
import { LogOut, LogIn, RefreshCw, Share2, BellRing } from 'lucide-react';

interface HeaderProps {
  currentUser: MasterUser | null;
  onLogout: () => void;
  onLogin: () => void;
  onSync: () => void;
  isSyncing: boolean;
  pendingCount?: number;
  isOnline?: boolean;
  onOpenReportWA: () => void;
  onOpenBroadcast?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onLogin,
  onSync,
  isSyncing,
  pendingCount = 0,
  isOnline = true,
  onOpenReportWA,
  onOpenBroadcast
}) => {
  const isKurikulum = currentUser?.Email?.trim().toLowerCase() === 'kurikulum.alwildan29@gmail.com';
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
                AL-WILDAN ISLAMIC SCHOOL 29 DEPOK
              </p>
            </div>
          </div>
        </div>

        {/* Right: Actions & Teacher Profile Chip */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Sync Sheets Button */}
            <button
              onClick={onSync}
              disabled={isSyncing}
              title={pendingCount > 0 ? `Sync — ${pendingCount} antri pekan ini` : 'Sync data dari Google Sheets'}
              className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition-all active:scale-95 disabled:opacity-50 min-h-[38px] min-w-[38px] justify-center"
            >
              <span
                title={isOnline ? 'Online' : 'Offline'}
                className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}
              />
              <RefreshCw className={`w-3.5 h-3.5 text-[#1E3A8A] ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Sync...' : 'Sync'}</span>
              {pendingCount > 0 && (
                <span className="text-[10px] font-extrabold bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded-full leading-none">
                  ⏳{pendingCount}
                </span>
              )}
              {!isOnline && (
                <span className="hidden sm:inline text-[10px] font-bold text-rose-600">Offline</span>
              )}
            </button>

            {/* Report WA Feature Button */}
            <button
              onClick={onOpenReportWA}
              title="Generate & Copy Laporan Harian WhatsApp Guru"
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl shadow-xs transition-all border border-emerald-500 min-h-[38px] min-w-[38px] justify-center"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-100" />
              <span className="hidden sm:inline">Report WA</span>
            </button>

            {/* Broadcast Reminder — khusus kurikulum */}
            {isKurikulum && onOpenBroadcast && (
              <button
                onClick={onOpenBroadcast}
                title="Broadcast reminder pengisian mutabaah ke guru pengampu"
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl shadow-xs transition-all border border-amber-400 min-h-[38px] min-w-[38px] justify-center"
              >
                <BellRing className="w-3.5 h-3.5 text-white" />
                <span className="hidden sm:inline">Reminder</span>
              </button>
            )}
          </div>

          {/* Profile Chip Guru */}
          {currentUser ? (
            <div className="flex items-center justify-between gap-2 bg-slate-50 text-slate-800 pl-2.5 sm:pl-3.5 pr-1.5 py-1 rounded-xl border border-slate-200 shadow-2xs min-h-[38px] max-w-[140px] sm:max-w-none transition-all">
              <div className="text-left min-w-0">
                <span className="text-xs font-bold block text-[#1E3A8A] truncate leading-tight">
                  {currentUser.Nama_Guru}
                </span>
                <span className="hidden sm:block text-[10px] font-medium text-slate-500 truncate leading-tight">
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
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 text-xs font-bold bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl shadow-2xs transition-all border border-blue-800 active:scale-95 min-h-[38px] min-w-[38px] justify-center"
            >
              <LogIn className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="hidden sm:inline">Masuk / Login</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
