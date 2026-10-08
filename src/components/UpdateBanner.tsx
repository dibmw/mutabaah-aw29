import React from 'react';
import { RefreshCw, X, Clock } from 'lucide-react';

interface UpdateBannerProps {
  kind: 'version' | 'weekly';
  countdownSec: number | null;
  onReload: () => void;
  onSnooze: () => void;
  onDismiss?: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  kind,
  countdownSec,
  onReload,
  onSnooze,
  onDismiss,
}) => {
  const title = kind === 'version' ? 'Versi baru tersedia' : 'Update mingguan aplikasi';
  const desc =
    kind === 'version'
      ? 'Ada build baru di server. Muat ulang untuk memakai versi terbaru.'
      : countdownSec !== null
        ? `Aplikasi akan dimuat ulang otomatis dalam ${countdownSec} detik untuk update mingguan (Senin 00:00 WIB).`
        : 'Sudah masuk pekan baru. Muat ulang untuk memakai build terbaru.';

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none">
      <div className="pointer-events-auto bg-[#1E3A8A] text-white rounded-2xl shadow-2xl border border-[#F59E0B]/40 p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-extrabold">{title}</h4>
            <p className="text-xs text-blue-100 font-medium mt-0.5 leading-relaxed">{desc}</p>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              title="Tutup"
              className="text-blue-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReload}
            className="flex-1 py-2.5 px-4 bg-[#F59E0B] hover:bg-amber-500 text-slate-900 font-extrabold text-xs rounded-xl transition-all active:scale-[0.99] flex items-center justify-center gap-1.5 min-h-[42px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Muat Ulang Sekarang
          </button>
          <button
            onClick={onSnooze}
            title="Tunda 10 menit"
            className="py-2.5 px-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 min-h-[42px] border border-white/20"
          >
            <Clock className="w-3.5 h-3.5" />
            Nanti
          </button>
        </div>
      </div>
    </div>
  );
};
