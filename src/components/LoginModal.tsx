import React, { useState } from 'react';
import { MasterUser } from '../types';
import { MutabaahService } from '../services/mutabaahService';
import { ShieldAlert, LogIn, Mail, BookOpen, Loader2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: MasterUser) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onLoginSuccess }) => {
  const [emailInput, setEmailInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = emailInput.trim();
    if (!cleanEmail) {
      setErrorMessage("Silakan masukkan alamat email guru.");
      return;
    }

    setIsLoading(true);

    try {
      // Panggil method async validateUserEmail
      const matchedUser = await MutabaahService.validateUserEmail(cleanEmail);

      if (!matchedUser) {
        // EXACT ERROR MESSAGE REQUIREMENT MAINTAINED
        setErrorMessage(`Akses Ditolak. Email ${cleanEmail} belum terdaftar di database master user.`);
        return;
      }

      // Login berhasil
      MutabaahService.setCurrentUser(matchedUser);
      onLoginSuccess(matchedUser);
    } catch {
      setErrorMessage("Gagal menghubungkan ke database server. Periksa koneksi internet Anda.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-[#1E3A8A] p-6 text-white text-center relative border-b-4 border-[#D97706]">
          <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto flex items-center justify-center mb-3 backdrop-blur-md border border-white/20">
            <BookOpen className="w-8 h-8 text-[#F59E0B]" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">Sistem Autentikasi Guru</h2>
          <p className="text-xs text-blue-200 mt-1">
            Silakan masukkan Email Guru yang terdaftar di Master User
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">

          {/* Error Alert Box */}
          {errorMessage && (
            <div className="bg-rose-50 border-l-4 border-rose-600 p-4 rounded-r-xl flex items-start gap-3 animate-head-shake">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider">Akses Ditolak</h4>
                <p className="text-xs text-rose-700 font-medium mt-0.5 leading-relaxed">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Email Guru / User
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={emailInput}
                  disabled={isLoading}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Ketik email guru terdaftar..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-[#1E3A8A] focus:bg-white focus:outline-none transition-all disabled:opacity-60"
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck="false"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                * Ketik manual alamat email guru yang telah terdaftar di master database.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 border border-[#F59E0B]/30 active:scale-[0.99] disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 text-[#F59E0B] animate-spin" />
                  Memverifikasi Email...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-[#F59E0B]" />
                  Masuk ke Aplikasi
                </>
              )}
            </button>
          </form>

        </div>

        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200/80 text-center rounded-b-2xl">
          <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
            Sistem Input Mutabaah Al-Qur'an Siswa
            <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              &copy; AL-WILDAN ISLAMIC SCHOOL 29 DEPOK
            </span>
          </p>
        </div>

      </div>
    </div>
  );
};