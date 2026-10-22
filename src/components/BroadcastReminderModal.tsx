import React, { useState, useMemo, useEffect } from 'react';
import { MasterUser, BroadcastMode } from '../types';
import { MutabaahService } from '../services/mutabaahService';
import { X, Copy, Send, Calendar, BellRing, Check, RefreshCw, Users, ChevronDown, AlertTriangle, Home } from 'lucide-react';

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
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncOk, setLastSyncOk] = useState<boolean | null>(null);
  const [lastSyncMsg, setLastSyncMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<BroadcastMode>(() => MutabaahService.getBroadcastMode());

  const modeLabel = mode === 'ikhwan'
    ? 'Rumah Tahfidh Ikhwan'
    : mode === 'akhwat'
      ? 'Rumah Tahfidh Akhwat'
      : 'Normal';

  const modeDescription = mode === 'normal'
    ? 'Plot Master_Siswa + jadwal pelajaran Al-Qur\'an.'
    : mode === 'ikhwan'
      ? 'Ikhwan memakai plot Rumah_Tahfidh tanpa jadwal; akhwat tetap normal sesuai jadwal.'
      : 'Akhwat memakai plot Rumah_Tahfidh tanpa jadwal; ikhwan tetap normal sesuai jadwal.';

  const handleModeChange = (nextMode: BroadcastMode) => {
    setMode(nextMode);
    MutabaahService.setBroadcastMode(nextMode);
  };

  const isKurikulum = useMemo(
    () => MutabaahService.isKurikulumAccount(currentUser?.Email),
    [currentUser]
  );

  const handleSync = async (showToast = false) => {
    setIsSyncing(true);
    try {
      MutabaahService.pruneExpiredPendingByWeek();
      const result = await MutabaahService.fetchFromGoogleSheets();
      setLastSyncAt(MutabaahService.getWIBTimestamp().slice(11, 16));
      setLastSyncOk(result.success);
      setLastSyncMsg(result.message);
      setRefreshKey(k => k + 1);
      if (showToast) {
        if (result.success) onToast('success', 'Data berhasil disinkronkan dari Google Sheets!');
        else onToast('error', result.message);
      }
    } catch (e) {
      console.warn('Sync failed in BroadcastReminderModal', e);
      setLastSyncOk(false);
      setLastSyncMsg('Gagal menyinkronkan data dari Google Sheets.');
      if (showToast) onToast('error', 'Gagal menyinkronkan data dari Google Sheets.');
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

  // Muat ulang saat tab kembali aktif / window fokus agar daftar tidak basi
  useEffect(() => {
    if (!isOpen) return;
    const onActive = () => {
      if (document.visibilityState === 'visible') void handleSync(false);
    };
    document.addEventListener('visibilitychange', onActive);
    window.addEventListener('focus', onActive);
    return () => {
      document.removeEventListener('visibilitychange', onActive);
      window.removeEventListener('focus', onActive);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const statusList = useMemo(() => {
    if (!isOpen) return [];
    void refreshKey;
    // Normal: guru mengajar Al-Qur'an hari itu (jadwal KBM).
    // Mode RT: gender terpilih memakai plot Rumah_Tahfidh tanpa jadwal,
    //          gender sebaliknya tetap memakai plot normal + jadwal.
    return MutabaahService.getBroadcastStatus(selectedDate, true, mode);
  }, [isOpen, selectedDate, refreshKey, mode]);

  // List fokus: hanya guru yang mengajar dan masih ada belum isi
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const belumOnly = statusList.filter(s => s.totalSiswa > 0 && s.belumList.length > 0);
    if (!q) return belumOnly;
    return belumOnly.filter(s => s.namaGuru.toLowerCase().includes(q));
  }, [statusList, search]);

  const totalBelum = useMemo(() => statusList.reduce((a, s) => a + s.belumList.length, 0), [statusList]);
  const guruBelumCount = useMemo(() => statusList.filter(s => s.belumList.length > 0 && s.totalSiswa > 0).length, [statusList]);
  const guruLengkap = useMemo(
    () => statusList.filter(s => s.totalSiswa > 0 && s.belumList.length === 0 && s.guruKey !== '__tanpa_plot__'),
    [statusList]
  );
  const guruBelum = useMemo(
    () => statusList.filter(s => s.totalSiswa > 0 && s.belumList.length > 0 && s.guruKey !== '__tanpa_plot__'),
    [statusList]
  );
  const adaSiswa = useMemo(() => statusList.some(s => s.totalSiswa > 0), [statusList]);
  const semuaLengkap = useMemo(() => adaSiswa && guruBelum.length === 0, [adaSiswa, guruBelum]);
  const belumSamaSekali = useMemo(() => adaSiswa && guruLengkap.length === 0, [adaSiswa, guruLengkap]);
  const totalSiswaLengkap = useMemo(
    () => guruLengkap.reduce((total, g) => total + g.totalSiswa, 0),
    [guruLengkap]
  );
  const totalSiswaTerjadwal = useMemo(
    () => statusList.reduce((total, s) => total + s.totalSiswa, 0),
    [statusList]
  );
  const persentaseLengkap = totalSiswaTerjadwal > 0
    ? Math.round((totalSiswaLengkap / totalSiswaTerjadwal) * 100)
    : 0;

  const greetingFor = (namaGuru: string, genderGuru: string): string => {
    const title = MutabaahService.getGuruTitle(genderGuru);
    return title ? `${title} ${namaGuru}` : namaGuru;
  };

  const hariLabel = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long' });
    } catch {
      return '';
    }
  }, [selectedDate]);

  const buildReminderText = (entry: (typeof statusList)[number]): string => {
    const tanggalId = MutabaahService.formatTanggalIndonesia(selectedDate);
    const sapaan = greetingFor(entry.namaGuru, entry.genderGuru);
    let text = `🔔 *REMINDER PENGISIAN MUTABAAH HARIAN*\n`;
    text += `🏫 *AL-WILDAN ISLAMIC SCHOOL 29 DEPOK*\n\n`;
    if (mode !== 'normal') {
      text += `🏠 *MODE ${modeLabel.toUpperCase()}*\n`;
      text += `${mode === 'ikhwan'
        ? 'Siswa ikhwan: plot Rumah Tahfidh (tanpa jadwal). Siswa akhwat: plot normal sesuai jadwal.'
        : 'Siswa akhwat: plot Rumah Tahfidh (tanpa jadwal). Siswa ikhwan: plot normal sesuai jadwal.'}\n\n`;
    }
    text += `Bismillah\n`;
    text += `Assalamu'alaikum warahmatullahi wabarakatuh,\n`;
    text += `Yth. *${sapaan}* 🙏\n\n`;
    text += `Mohon berkenan mengisi mutabaah Al-Qur'an hari ini:\n`;
    text += `📅 *${tanggalId}*\n`;
    text += `📊 *${entry.belumList.length} dari ${entry.totalSiswa} siswa belum terisi*\n\n`;
    text += `*Daftar siswa yang belum ada isian:*\n`;
    entry.belumList.forEach((s, i) => {
      text += `${i + 1}. ${s.Nama_Siswa} - ${s.Kelas}\n`;
    });
    if (entry.jadwalHariIni.length > 0) {
      text += `\n📌 *Jadwal hari ${hariLabel || 'ini'}:*\n`;
      const jadwalRelevan = MutabaahService.filterJadwalBelumTerisi(entry.jadwalHariIni, entry.belumList);
      MutabaahService.formatJadwalLinesGrouped(jadwalRelevan).forEach(line => {
        text += `• ${line}\n`;
      });
    }
    text += `\n📌 *Sudah input tetapi masih terdata belum isi?*\n`;
    text += `Klik tombol *Sync* di aplikasi Mutabaah agar data terbaru dimuat.\n`;
    text += `\nSyukran, jazaakumullahu khairan atas perhatian dan kerjasamanya.\n\n`;
    text += `_Wassalamu'alaikum warahmatullahi wabarakatuh_`;
    return text;
  };

  const buildGroupRecapText = (): string => {
    if (!adaSiswa) return '';

    const tanggalId = MutabaahService.formatTanggalIndonesia(selectedDate);
    const header = `🏫 *AL-WILDAN ISLAMIC SCHOOL 29 DEPOK*\n` +
      (mode !== 'normal' ? `🏠 *Mode: ${modeLabel}*\n` : '') +
      `📅 *${tanggalId}*\n\n` +
      `Bismillah\n` +
      `Assalamu'alaikum warahmatullahi wabarakatuh,\n\n`;
    const footer = `_Wassalamu'alaikum warahmatullahi wabarakatuh_`;

    if (semuaLengkap) {
      let text = `✅ *MUTABAAH AL-QUR'AN — LENGKAP*\n`;
      text += header;
      text += `Alhamdulillah, seluruh guru yang mengajar Al-Qur'an hari ini telah menyelesaikan pengisian mutabaah. Jazaakumullahu khairan. 🤲\n\n`;
      text += `*Rekap Pengisian — ${guruLengkap.length} guru, ${totalSiswaLengkap} siswa (${persentaseLengkap}%):*\n`;
      guruLengkap.forEach((g, i) => {
        text += `${i + 1}. ${greetingFor(g.namaGuru, g.genderGuru)} — ${g.sudahIsi}/${g.totalSiswa} siswa ✅\n`;
      });
      text += `\nSemoga Allah membalas amanah dan ikhtiar para guru. Barakallahu fiikum.\n\n`;
      text += footer;
      return text;
    }

    if (belumSamaSekali) {
      let text = `⏳ *REMINDER MUTABAAH HARIAN*\n`;
      text += header;
      text += `Belum ada guru yang menyelesaikan pengisian mutabaah hari ini.\n\n`;
      text += `*Guru yang masih perlu melengkapi:*\n`;
      guruBelum.forEach((g, i) => {
        const kurang = g.totalSiswa - g.sudahIsi;
        text += `${i + 1}. ${greetingFor(g.namaGuru, g.genderGuru)} — ${g.sudahIsi}/${g.totalSiswa} siswa (kurang ${kurang})\n`;
      });
      text += `\n📌 *Catatan:* Jika sudah input tetapi masih terdata belum isi,\n`;
      text += `klik tombol *Sync* di aplikasi Mutabaah.\n`;
      text += `\nMohon berkenan menyusul pengisiannya. 🙏\n\n`;
      text += footer;
      return text;
    }

    let text = `✅ *REKAP MUTABAAH HARIAN*\n`;
    text += header;
    text += `Syukran, jazaakumullahu khairan kepada guru berikut yang mutabaahnya sudah terisi lengkap hari ini:\n\n`;
    guruLengkap.forEach((g, i) => {
      text += `${i + 1}. ${greetingFor(g.namaGuru, g.genderGuru)} — ${g.sudahIsi}/${g.totalSiswa} siswa ✅\n`;
    });
    text += `\nSedangkan guru berikut masih ada yang belum terisi:\n\n`;
    guruBelum.forEach((g, i) => {
      const kurang = g.totalSiswa - g.sudahIsi;
      text += `${i + 1}. ${greetingFor(g.namaGuru, g.genderGuru)} — ${g.sudahIsi}/${g.totalSiswa} siswa (kurang ${kurang})\n`;
    });
    text += `\n📌 *Catatan:* Jika sudah input tetapi masih terdata belum isi,\n`;
    text += `klik tombol *Sync* di aplikasi Mutabaah.\n`;
    text += `\nBagi yang belum lengkap, mohon berkenan menyusul pengisiannya. 🙏\n\n`;
    text += footer;
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
                {mode === 'normal'
                  ? 'Khusus kurikulum — cek isian harian minimal 1 per siswa'
                  : `Mode ${modeLabel} — plot Rumah Tahfidh + normal gender sebaliknya`}
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
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200/80 shrink-0">
              <div className="mb-3">
                <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-[#D97706]" />
                  Mode Penentuan Guru
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { value: 'normal' as BroadcastMode, label: 'Normal' },
                    { value: 'ikhwan' as BroadcastMode, label: 'RT Ikhwan' },
                    { value: 'akhwat' as BroadcastMode, label: 'RT Akhwat' }
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleModeChange(opt.value)}
                      title={opt.value === 'normal' ? 'Mode normal (plot reguler + jadwal)' : `Mode ${opt.value === 'ikhwan' ? 'Rumah Tahfidh Ikhwan' : 'Rumah Tahfidh Akhwat'}`}
                      className={`px-2 py-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all active:scale-95 ${
                        mode === opt.value
                          ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] sm:text-[11px] font-medium text-slate-500 leading-snug">
                  {modeDescription}
                </p>
              </div>
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
            </div>

            {/* Body */}
            <div className="p-3.5 sm:p-5 flex-1 overflow-y-auto space-y-3.5 bg-slate-50">
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block">Status Pengisian</span>
                  <span className="text-sm sm:text-base font-extrabold text-[#1E3A8A]">
                    {!adaSiswa ? (
                      'Belum ada data siswa'
                    ) : semuaLengkap ? (
                      <>Semua guru sudah lengkap <span className="text-xs font-semibold text-emerald-600">({totalSiswaLengkap} siswa)</span></>
                    ) : (
                      <>{guruBelumCount} guru belum lengkap <span className="text-xs font-semibold text-slate-500">({totalBelum} siswa belum isi)</span></>
                    )}
                  </span>
                  {lastSyncAt && (
                    <span className={`text-[10px] font-bold block mt-0.5 ${lastSyncOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {lastSyncOk ? 'Tersinkron' : 'Sync sebagian (ada sheet gagal)'} • terakhir {lastSyncAt}
                    </span>
                  )}
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
                    onClick={() => {
                      if (!adaSiswa) {
                        onToast('info', 'Belum ada data untuk direkap.');
                        return;
                      }
                      void copyText(
                        buildGroupRecapText(),
                        '__grup__',
                        semuaLengkap
                          ? 'Rekap lengkap berhasil dicopy! Siap dipaste ke grup Al-Qur\'an.'
                          : 'Rekap grup berhasil dicopy! Siap dipaste ke grup Al-Qur\'an.'
                      );
                    }}
                    disabled={!adaSiswa}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      adaSiswa
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 active:scale-95'
                        : 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
                    }`}
                    title={
                      !adaSiswa
                        ? 'Belum ada data untuk direkap'
                        : semuaLengkap
                          ? 'Copy rekap lengkap untuk grup Al-Qur\'an'
                          : 'Copy rekap guru lengkap untuk grup Al-Qur\'an'
                    }
                  >
                    {copiedKey === '__grup__' ? <Check className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">
                      {copiedKey === '__grup__' ? 'Tercopy!' : semuaLengkap ? 'Copy Rekap Lengkap' : 'Copy Rekap Grup'}
                    </span>
                  </button>
                </div>
              </div>

              {lastSyncOk === false && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-800 font-semibold leading-snug">
                    {lastSyncMsg || 'Sebagian data gagal dimuat dari Google Sheets.'} Daftar di bawah mungkin belum terbaru — tekan tombol Sinkron untuk coba lagi.
                  </p>
                </div>
              )}

              {mode !== 'normal' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-start gap-2">
                  <Home className="w-4 h-4 text-[#1E3A8A] mt-0.5 shrink-0" />
                  <p className="text-[11px] text-blue-900 font-semibold leading-snug">
                    <strong>{modeLabel}</strong> — {modeDescription} Pastikan sheet <span className="font-mono">Rumah_Tahfidh</span> sudah diisi lalu tekan Sinkron.
                  </p>
                </div>
              )}

              {filtered.length === 0 && (
                statusList.length === 0 ? (
                  mode === 'normal' ? (
                    <div className="p-10 text-center bg-white rounded-xl border border-slate-200">
                      <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <h4 className="text-sm font-bold text-slate-700">Tidak ada jadwal KBM Al-Qur'an pada tanggal ini</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Pilih tanggal lain atau pastikan jadwal Al-Qur'an sudah diisi di Sheet Jadwal_Pelajaran.</p>
                    </div>
                  ) : (
                    <div className="p-10 text-center bg-white rounded-xl border border-blue-200">
                      <Home className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                      <h4 className="text-sm font-bold text-slate-700">Belum ada data {modeLabel}</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Pastikan sheet <span className="font-mono">Rumah_Tahfidh</span> sudah dibuat dan diisi untuk siswa {mode === 'ikhwan' ? 'ikhwan' : 'akhwat'}, lalu tekan tombol Sinkron.
                      </p>
                    </div>
                  )
                ) : !adaSiswa ? (
                  <div className="p-10 text-center bg-white rounded-xl border border-amber-200">
                    <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-slate-700">
                      {mode === 'normal'
                        ? 'Belum ada siswa yang diplot untuk guru yang mengajar hari ini'
                        : `Belum ada siswa ${mode === 'ikhwan' ? 'ikhwan' : 'akhwat'} yang terplot di Rumah_Tahfidh`}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {mode === 'normal'
                        ? 'Tambahkan nama guru pengampu pada Master_Siswa agar siswa masuk hitungan broadcast.'
                        : 'Lengkapi plot siswa pada sheet Rumah_Tahfidh, lalu tekan Sinkron.'}
                    </p>
                  </div>
                ) : search.trim() ? (
                  <div className="p-10 text-center bg-white rounded-xl border border-slate-200">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-slate-700">Guru tidak ditemukan</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Tidak ada guru yang cocok dengan pencarian “{search.trim()}”.</p>
                  </div>
                ) : (
                  <div className="p-10 text-center bg-white rounded-xl border border-emerald-200">
                    <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-slate-700">Semua guru pada mode ini sudah lengkap ✅</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Tidak ada guru yang belum mengisi mutabaah pada tanggal ini. Gunakan Copy Rekap Lengkap untuk share ke grup Al-Qur'an.</p>
                  </div>
                )
              )}

              {filtered.map((entry) => {
                const isExpanded = expandedKey === entry.guruKey;
                const reminderText = buildReminderText(entry);
                const isCopied = copiedKey === entry.guruKey;
                return (
                  <div key={entry.guruKey} className="bg-white rounded-xl border overflow-hidden border-amber-200">
                    <div className="w-full px-4 py-3 flex items-center justify-between gap-3">
                      <button
                        onClick={() => setExpandedKey(isExpanded ? null : entry.guruKey)}
                        className="flex-1 min-w-0 text-left hover:bg-slate-50 transition-colors rounded-lg px-1 py-0.5"
                      >
                        <span className="text-sm font-extrabold text-slate-900 truncate block">
                          {greetingFor(entry.namaGuru, entry.genderGuru)}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium block">
                          {entry.sudahIsi}/{entry.totalSiswa} siswa sudah isi
                        </span>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 hidden sm:inline-block">⚠️ {entry.belumList.length} BELUM</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); void copyText(reminderText, entry.guruKey, `Reminder untuk ${entry.namaGuru} berhasil dicopy!`); }}
                          title={`Copy reminder untuk ${entry.namaGuru}`}
                          className={`p-2 rounded-lg border transition-all active:scale-95 min-w-[34px] min-h-[34px] flex items-center justify-center ${isCopied ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-[#1E3A8A] text-white border-[#F59E0B]/40 hover:bg-blue-900'}`}
                        >
                          {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-[#F59E0B]" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openWhatsApp(reminderText); }}
                          title={`Buka WhatsApp untuk ${entry.namaGuru}`}
                          className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 transition-all active:scale-95 min-w-[34px] min-h-[34px] flex items-center justify-center"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExpandedKey(isExpanded ? null : entry.guruKey)}
                          title={isExpanded ? 'Sembunyikan daftar siswa' : 'Tampilkan daftar siswa'}
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors min-w-[34px] min-h-[34px] flex items-center justify-center"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                        <ul className="text-xs text-slate-700 font-medium space-y-1">
                          {entry.belumList.map(s => (
                            <li key={s.ID_Siswa} className="bg-amber-50/60 border border-amber-100 rounded-lg px-2.5 py-1.5 font-bold truncate">
                              {s.Nama_Siswa} - {s.Kelas}
                            </li>
                          ))}
                        </ul>

                        {/* Sumber jadwal KBM (audit): baris yang memasukkan guru ini ke broadcast */}
                        {entry.jadwalHariIni.length > 0 && (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Sumber jadwal KBM{hariLabel ? ` hari ${hariLabel}` : ''}
                              {mode === 'normal' ? ' (audit)' : ' (bagian normal)'}
                            </p>
                            <ul className="text-[11px] text-slate-600 font-medium space-y-0.5">
                              {entry.jadwalHariIni.map((j, idx) => (
                                <li key={`${j.ID_Kelas}-${j.Waktu_Mulai}-${idx}`}>
                                  • {[MutabaahService.formatJadwalLine(j), j.Mapel].filter(Boolean).join(' • ')}
                                </li>
                              ))}
                            </ul>
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
