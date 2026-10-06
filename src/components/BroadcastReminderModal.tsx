import React, { useState, useMemo, useEffect } from 'react';
import { MasterUser } from '../types';
import { MutabaahService } from '../services/mutabaahService';
import { X, Copy, Send, Calendar, BellRing, Check, RefreshCw, Users, ChevronDown } from 'lucide-react';

interface BroadcastReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: MasterUser | null;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const BroadcastReminderModal: React.FC<BroadcastReminderModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onToast
}) => {
  const todayStr = MutabaahService.getWIBDateStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [onlyPiket, setOnlyPiket] = useState(true);
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const isKurikulum = useMemo(
    () => MutabaahService.isKurikulumAccount(currentUser?.Email),
    [currentUser]
  );

  const handleSync = async (showToast = false) => {
    setIsSyncing(true);
    try {
      await MutabaahService.fetchFromGoogleSheets();
      setRefreshKey(k => k + 1);
      if (showToast) onToast('success', 'Data berhasil disinkronkan dari Google Sheets!');
    } catch (e) {
      console.warn('Sync failed in BroadcastReminderModal', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedDate(MutabaahService.getWIBDateStr());
      handleSync(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const statusList = useMemo(() => {
    if (!isOpen) return [];
    void refreshKey;
    return MutabaahService.getBroadcastStatus(selectedDate, onlyPiket);
  }, [isOpen, selectedDate, onlyPiket, refreshKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return statusList;
    return statusList.filter(s => s.namaGuru.toLowerCase().includes(q));
  }, [statusList, search]);

  const totalBelum = useMemo(() => statusList.reduce((a, s) => a + s.belumList.length, 0), [statusList]);
  const guruBelumCount = useMemo(() => statusList.filter(s => s.belumList.length > 0 && s.totalSiswa > 0).length, [statusList]);
  const guruLengkap = useMemo(
    () => statusList.filter(s => s.totalSiswa > 0 && s.belumList.length === 0 && s.guruKey !== '__tanpa_plot__'),
    [statusList]
  );

  const greetingFor = (namaGuru: string, genderGuru: string): string => {
    const title = MutabaahService.getGuruTitle(genderGuru);
    return title ? `${title} ${namaGuru}` : namaGuru;
  };

  const buildReminderText = (entry: (typeof statusList)[number]): string => {
    const tanggalId = MutabaahService.formatTanggalIndonesia(selectedDate);
    const sapaan = greetingFor(entry.namaGuru, entry.genderGuru);
    let text = `🔔 *REMINDER PENGISIAN MUTABAAH HARIAN*\n`;
    text += `🏫 *AL-WILDAN ISLAMIC SCHOOL 29 DEPOK*\n\n`;
    text += `Bismillah\n`;
    text += `Assalamu'alaikum warahmatullahi wabarakatuh,\n`;
    text += `Yth. *${sapaan}* 🙏\n\n`;
    text += `Mohon berkenan mengisi mutabaah Al-Qur'an hari ini:\n`;
    text += `📅 *${tanggalId}*\n`;
    text += `📊 *${entry.belumList.length} dari ${entry.totalSiswa} siswa belum terisi*\n\n`;
    text += `*Daftar siswa yang belum ada isian:*\n`;
    entry.belumList.forEach((s, i) => {
      text += `${i + 1}. ${s.Nama_Siswa} (${s.Kelas} - NIS: ${s.ID_Siswa})\n`;
    });
    if (entry.jadwalHariIni.length > 0) {
      text += `\n📌 *Jadwal hari ini:*\n`;
      entry.jadwalHariIni.forEach(j => {
        const jam = [j.Waktu_Mulai, j.Waktu_Selesai].filter(Boolean).join('-');
        const parts = [jam, j.ID_Kelas ? `Kelas ${j.ID_Kelas}` : '', j.Mapel].filter(Boolean);
        text += `• ${parts.join(' | ')}\n`;
      });
    }
    text += `\nSyukran, jazaakumullahu khairan atas perhatian dan kerjasamanya.\n\n`;
    text += `_Wassalamu'alaikum warahmatullahi wabarakatuh_`;
    return text;
  };

  const buildGroupRecapText = (): string => {
    const tanggalId = MutabaahService.formatTanggalIndonesia(selectedDate);
    let text = `✅ *REKAP MUTABAAH LENGKAP*\n`;
    text += `🏫 *AL-WILDAN 29 DEPOK*\n`;
    text += `📅 *${tanggalId}*\n\n`;
    text += `Bismillah\n`;
    text += `Assalamu'alaikum warahmatullahi wabarakatuh,\n\n`;
    if (guruLengkap.length === 0) {
      text += `_(Belum ada guru yang lengkap hari ini)_\n\n`;
    } else {
      text += `Syukran, jazaakumullahu khairan kepada guru berikut yang mutabaahnya sudah terisi lengkap hari ini:\n\n`;
      guruLengkap.forEach((g, i) => {
        text += `${i + 1}. ${greetingFor(g.namaGuru, g.genderGuru)} — ${g.sudahIsi}/${g.totalSiswa} siswa ✅\n`;
      });
      text += `\n`;
    }
    text += `Bagi yang belum lengkap, mohon berkenan menyusul pengisiannya. 🙏\n\n`;
    text += `_Wassalamu'alaikum warahmatullahi wabarakatuh_`;
    return text;
  };

  if (!isOpen) return null;

  const copyText = async (text: string, key: string, successMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedKey(key);
    onToast('success', successMsg);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const openWhatsApp = (text: string) => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-0 sm:p-4 animate-fade-in">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-[#1E3A8A] text-white px-4 sm:px-6 py-3.5 sm:py-4 border-b-2 border-[#D97706] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#F59E0B] text-[#1E3A8A] flex items-center justify-center font-black shrink-0 shadow-sm">
              <BellRing className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold tracking-tight">Broadcast Reminder Guru</h3>
              <p className="text-[11px] sm:text-xs text-blue-200 line-clamp-1">
                Khusus kurikulum — cek isian harian minimal 1 per siswa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white p-2 rounded-xl hover:bg-blue-800/80 transition-colors min-w-[38px] min-h-[38px] flex items-center justify-center"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isKurikulum ? (
          <div className="p-6 text-center">
            <p className="text-sm font-bold text-rose-700">Akses Ditolak</p>
            <p className="text-xs text-slate-500 mt-1">Fitur broadcast reminder hanya untuk akun kurikulum.alwildan29@gmail.com</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200/80 shrink-0 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#D97706]" />
                    Tanggal Mutabaah ({MutabaahService.getHariIndonesia(selectedDate) || '-'})
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#1E3A8A] min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">
                    Cari Guru
                  </label>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="cth: Putra / Angga"
                    autoComplete="off"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-[#1E3A8A] min-h-[42px]"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyPiket}
                  onChange={(e) => setOnlyPiket(e.target.checked)}
                  className="w-4 h-4 accent-[#1E3A8A]"
                />
                Hanya guru yang ada jadwal Al-Qur'an di hari ini
              </label>
            </div>

            {/* Body */}
            <div className="p-3.5 sm:p-5 flex-1 overflow-y-auto space-y-3.5 bg-slate-50">
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block">Status Pengisian</span>
                  <span className="text-sm sm:text-base font-extrabold text-[#1E3A8A]">
                    {guruBelumCount} guru belum lengkap <span className="text-xs font-semibold text-slate-500">({totalBelum} siswa belum isi)</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSync(true)}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] rounded-lg border border-blue-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isSyncing ? 'Memuat...' : 'Sinkron'}</span>
                  </button>
                  <button
                    onClick={() => copyText(buildGroupRecapText(), '__grup__', 'Rekap grup berhasil dicopy! Siap dipaste ke grup Al-Qur\'an.')}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg border border-emerald-500 transition-all active:scale-95"
                    title="Copy rekap guru lengkap untuk grup Al-Qur'an"
                  >
                    {copiedKey === '__grup__' ? <Check className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{copiedKey === '__grup__' ? 'Tercopy!' : 'Copy Rekap Grup'}</span>
                  </button>
                </div>
              </div>

              {filtered.length === 0 && (
                <div className="p-10 text-center bg-white rounded-xl border border-slate-200">
                  <BellRing className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-700">Tidak ada guru piket Al-Qur'an</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Tidak ada jadwal Al-Qur'an pada hari ini, atau semua sudah difilter. Coba matikan filter piket.</p>
                </div>
              )}

              {filtered.map((entry) => {
                const isDone = entry.totalSiswa > 0 && entry.belumList.length === 0;
                const isExpanded = expandedKey === entry.guruKey;
                const preview = buildReminderText(entry);
                return (
                  <div key={entry.guruKey} className={`bg-white rounded-xl border overflow-hidden ${isDone ? 'border-emerald-200' : 'border-amber-200'}`}>
                    <button
                      onClick={() => setExpandedKey(isExpanded ? null : entry.guruKey)}
                      className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-slate-900 truncate">
                          {greetingFor(entry.namaGuru, entry.genderGuru)}
                          {!entry.isPiket && entry.guruKey !== '__tanpa_plot__' && (
                            <span className="ml-2 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">di luar piket</span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {entry.sudahIsi}/{entry.totalSiswa} siswa sudah isi
                          {entry.jadwalHariIni.length > 0 && (
                            <> • {entry.jadwalHariIni.map(j => [j.Waktu_Mulai, j.Waktu_Selesai].filter(Boolean).join('-')).filter(Boolean).join(', ') || 'piket'}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.totalSiswa === 0 ? (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">TANPA PLOT</span>
                        ) : isDone ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">✅ LENGKAP</span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">⚠️ {entry.belumList.length} BELUM</span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                        {entry.belumList.length > 0 ? (
                          <ul className="text-xs text-slate-700 font-medium space-y-1">
                            {entry.belumList.map(s => (
                              <li key={s.ID_Siswa} className="flex items-center justify-between gap-2 bg-amber-50/60 border border-amber-100 rounded-lg px-2.5 py-1.5">
                                <span className="font-bold truncate">{s.Nama_Siswa}</span>
                                <span className="text-[10px] text-slate-500 font-bold shrink-0">{s.Kelas} • NIS: {s.ID_Siswa}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                            Semua siswa sudah terisi. Tidak perlu broadcast reminder.
                          </p>
                        )}

                        <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all max-h-[220px] overflow-y-auto">
                          {entry.belumList.length > 0 ? preview : buildGroupRecapText()}
                        </div>

                        {entry.belumList.length > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyText(preview, entry.guruKey, `Reminder untuk ${entry.namaGuru} berhasil dicopy!`)}
                              className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 min-h-[42px] ${copiedKey === entry.guruKey ? 'bg-emerald-600 text-white' : 'bg-[#1E3A8A] hover:bg-blue-900 text-white border border-[#F59E0B]/40'}`}
                            >
                              {copiedKey === entry.guruKey ? <><Check className="w-4 h-4" /> Tercopy!</> : <><Copy className="w-4 h-4 text-[#F59E0B]" /> Copy Reminder</>}
                            </button>
                            <button
                              onClick={() => openWhatsApp(preview)}
                              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 border border-emerald-500 min-h-[42px]"
                            >
                              <Send className="w-4 h-4" />
                              Buka WhatsApp
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
