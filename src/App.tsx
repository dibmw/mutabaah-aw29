import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MasterUser, MasterSiswa, MasterSurat, LogMutabaah, StudentSummary, MutabaahFormData } from './types';
import { MutabaahService } from './services/mutabaahService';
import { FirebaseService } from './services/firebaseService';
import { useAppVersion } from './hooks/useAppVersion';
import {
  getJakartaWeekId,
  getMsUntilNextMondayMidnightWIB,
  getStoredWeekId,
  markWeekRefreshed,
  snoozeWeeklyRefresh,
  isSnoozed,
} from './utils/weeklyRefresh';
import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { StudentSearch } from './components/StudentSearch';
import { MutabaahForm } from './components/MutabaahForm';
import { MutabaahSummaryAndHistory } from './components/MutabaahSummaryAndHistory';
import { DailyReportModal } from './components/DailyReportModal';
import { BroadcastReminderModal } from './components/BroadcastReminderModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { UpdateBanner } from './components/UpdateBanner';
import { BookOpen, History, RefreshCw } from 'lucide-react';

export default function App() {
  // Current User Session
  const [currentUser, setCurrentUser] = useState<MasterUser | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Master Data State
  const [siswaList, setSiswaList] = useState<MasterSiswa[]>([]);
  const [usersList, setUsersList] = useState<MasterUser[]>([]);
  const [suratList, setSuratList] = useState<MasterSurat[]>([]);

  // Selection & Panel State
  const [selectedSiswaList, setSelectedSiswaList] = useState<MasterSiswa[]>([]);
  const [recentLogs, setRecentLogs] = useState<LogMutabaah[]>([]);
  const [summary, setSummary] = useState<StudentSummary>({
    totalLogs: 0,
    presentCount: 0,
    attendancePercentage: 0,
    avgTahsin: null,
    avgTahfidh: null,
    avgTajwid: null
  });

  // UI Modals & Notifications
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  // Badge antrian offline (pekan berjalan) + status online
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Edit & Delete Log State
  const [editingLog, setEditingLog] = useState<LogMutabaah | null>(null);
  const [deleteTargetLog, setDeleteTargetLog] = useState<LogMutabaah | null>(null);

  // Main Tab: form input vs riwayat perkembangan
  const [activeMainTab, setActiveMainTab] = useState<'form' | 'history'>('form');

  // Auto-refresh: cek versi build + refresh mingguan Senin 00:00 WIB
  const { updateAvailable, dismiss: dismissVersionUpdate, reload: reloadForVersionUpdate } = useAppVersion();
  const [weeklyNeeded, setWeeklyNeeded] = useState(false);
  const [weeklyCountdown, setWeeklyCountdown] = useState<number | null>(null);
  const editingLogRef = useRef(editingLog);
  editingLogRef.current = editingLog;
  const isSyncingRef = useRef(isSyncing);
  isSyncingRef.current = isSyncing;

  // Add Toast Notification
  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Initialize Data
  useEffect(() => {
    const loadedUsers = MutabaahService.getUsers();
    const loadedSiswa = MutabaahService.getSiswa();
    const loadedSurat = MutabaahService.getSurat();

    setUsersList(loadedUsers);
    setSiswaList(loadedSiswa);
    setSuratList(loadedSurat);

    // Check existing login session
    const savedUser = MutabaahService.getCurrentUser();
    if (savedUser && MutabaahService.validateUserEmail(savedUser.Email)) {
      setCurrentUser(savedUser);
    } else {
      // First access or no session: ensure unsigned-in state and open Login Modal
      setCurrentUser(null);
      setIsLoginModalOpen(true);
    }

    // Keep student selection empty initially until teacher searches/selects students
    setSelectedSiswaList([]);

    // Migrate existing UTC timestamps, repair corrupted logs, then prune
    // pending basi (per-pekan), auto-cleanup, dan kirim antrian diam-diam.
    MutabaahService.migrateTimestampsToWIB();
    MutabaahService.migrateCorruptedLogs();
    MutabaahService.autoCleanupIfNeeded();
    try {
      const pruned = MutabaahService.pruneExpiredPendingByWeek();
      if (pruned.removed > 0) {
        setTimeout(() => {
          setToasts(prev => [...prev, {
            id: Date.now().toString(),
            type: 'info',
            message: `${pruned.removed} data pekan lalu dibersihkan otomatis.`
          }]);
        }, 500);
      }
    } catch { /* abaikan */ }
    setPendingCount(MutabaahService.getPendingLogsCount());
    // Backup data lokal yang ada ke Firebase Firestore di latar belakang
    try {
      const localLogs = MutabaahService.getLogs();
      if (localLogs.length > 0) {
        FirebaseService.saveLogs(localLogs.slice(0, 300)).catch(() => {});
      }
    } catch { /* abaikan */ }
    // Kirim diam (tanpa toast) agar angka antrian berkurang sendiri saat online
    MutabaahService.retryPendingLogs()
      .then(() => setPendingCount(MutabaahService.getPendingLogsCount()))
      .catch(() => {});
  }, []);

  // Kirim diam saat internet nyambung lagi + pantau status online untuk badge Header
  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    const runAutoSync = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        MutabaahService.retryPendingLogs()
          .then(() => setPendingCount(MutabaahService.getPendingLogsCount()))
          .catch(() => setPendingCount(MutabaahService.getPendingLogsCount()));
      }
    };

    const handleOnline = () => {
      updateOnline();
      runAutoSync();
    };
    const handleOffline = () => updateOnline();
    updateOnline();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auto-sync background interval (every 3 minutes) & tab visibility change
    const intervalId = window.setInterval(runAutoSync, 3 * 60 * 1000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runAutoSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []);

  // Peringatan saat mencoba menutup tab jika ada antrian yang belum masuk Spreadsheet
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingCount > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingCount]);

  // Refresh mingguan: anchor Senin 00:00 WIB (weekId = tanggal Senin pekan berjalan)
  const isBusyForRefresh = useCallback(() => {
    if (editingLogRef.current !== null || isSyncingRef.current) return true;
    try {
      return MutabaahService.getPendingLogsCount() > 0;
    } catch {
      return false;
    }
  }, []);

  const checkWeeklyRefresh = useCallback(() => {
    if (isSnoozed()) return;
    const currentWeek = getJakartaWeekId();
    const stored = getStoredWeekId();
    if (stored === null) {
      // Instalasi pertama: cukup tandai tanpa reload agar tidak reload saat buka perdana
      markWeekRefreshed(currentWeek);
      return;
    }
    if (stored !== currentWeek) {
      setWeeklyNeeded(true);
      setWeeklyCountdown(30);
    }
  }, []);

  const handleWeeklyReloadNow = useCallback(() => {
    markWeekRefreshed(getJakartaWeekId());
    window.location.reload();
  }, []);

  const handleWeeklySnooze = useCallback(() => {
    snoozeWeeklyRefresh(10 * 60 * 1000);
    setWeeklyNeeded(false);
    setWeeklyCountdown(null);
  }, []);

  // Cek saat dibuka + timer ke Senin 00:00 WIB + interval 5 mnt (tab dibiarkan terbuka)
  useEffect(() => {
    checkWeeklyRefresh();
    let timeoutId: number | undefined;
    const scheduleMidnight = () => {
      const ms = getMsUntilNextMondayMidnightWIB();
      timeoutId = window.setTimeout(() => {
        checkWeeklyRefresh();
        scheduleMidnight();
      }, ms);
    };
    scheduleMidnight();
    const intervalId = window.setInterval(checkWeeklyRefresh, 5 * 60 * 1000);
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [checkWeeklyRefresh]);

  // Countdown 30 dtk: reload saat idle, tunda otomatis 10 mnt jika guru sedang input/sinkron
  useEffect(() => {
    if (!weeklyNeeded || weeklyCountdown === null) return;
    if (weeklyCountdown <= 0) {
      if (isBusyForRefresh()) {
        snoozeWeeklyRefresh(10 * 60 * 1000);
        setWeeklyNeeded(false);
        setWeeklyCountdown(null);
        addToast('info', 'Update mingguan ditunda 10 menit karena ada input/sinkronisasi berjalan.');
      } else {
        markWeekRefreshed(getJakartaWeekId());
        window.location.reload();
      }
      return;
    }
    const timer = window.setTimeout(() => {
      setWeeklyCountdown((c) => (c === null ? c : c - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [weeklyNeeded, weeklyCountdown, isBusyForRefresh, addToast]);

  // Fetch Panel B Data whenever selectedSiswaList changes or when log is added
  const refreshPanelB = useCallback(() => {
    if (selectedSiswaList.length === 1) {
      const student = selectedSiswaList[0];
      const logs = MutabaahService.getStudentRecentLogs(student.ID_Siswa, 20);
      const sumStats = MutabaahService.getStudentSummary(student.ID_Siswa);
      setRecentLogs(logs);
      setSummary(sumStats);
    } else if (selectedSiswaList.length > 1) {
      const nisSet = new Set(selectedSiswaList.map(s => s.ID_Siswa));
      const allLogs = MutabaahService.getLogs();
      const filtered = allLogs.filter(l => nisSet.has(l.ID_Siswa));
      filtered.sort((a, b) => {
        const dateCmp = String(b.Tanggal_Mutabaah || '').localeCompare(String(a.Tanggal_Mutabaah || ''));
        if (dateCmp !== 0) return dateCmp;
        return String(b.Timestamp || '').localeCompare(String(a.Timestamp || ''));
      });

      const latestPerStudent = selectedSiswaList
        .map(s => MutabaahService.getStudentRecentLogs(s.ID_Siswa, 1)[0])
        .filter((l): l is LogMutabaah => Boolean(l));
      latestPerStudent.sort((a, b) => {
        const dateCmp = String(b.Tanggal_Mutabaah || '').localeCompare(String(a.Tanggal_Mutabaah || ''));
        if (dateCmp !== 0) return dateCmp;
        return String(b.Timestamp || '').localeCompare(String(a.Timestamp || ''));
      });
      setRecentLogs(latestPerStudent);

      const totalLogs = filtered.length;
      const presentCount = filtered.filter(l => l.Kehadiran === 'A' || (l.Kehadiran as string) === 'Hadir').length;
      const attendancePercentage = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 100) : 0;

      setSummary({
        totalLogs,
        presentCount,
        attendancePercentage,
        avgTahsin: null,
        avgTahfidh: null,
        avgTajwid: null
      });
    } else {
      setRecentLogs([]);
      setSummary({
        totalLogs: 0,
        presentCount: 0,
        attendancePercentage: 0,
        avgTahsin: null,
        avgTahfidh: null,
        avgTajwid: null
      });
    }
  }, [selectedSiswaList]);

  useEffect(() => {
    refreshPanelB();
  }, [selectedSiswaList, refreshPanelB]);

  // Handle Login
  const handleLoginSuccess = (user: MasterUser) => {
    setCurrentUser(user);
    setIsLoginModalOpen(false);

    // Refresh master siswa list
    const currentSiswaList = MutabaahService.getSiswa();
    setSiswaList(currentSiswaList);

    // Reset selected student so all form inputs are empty and cleared for the new session
    setSelectedSiswaList([]);

    addToast('success', `Selamat datang, ${user.Nama_Guru}! Sesi terhubung.`);
  };

  // Handle Logout
  const handleLogout = () => {
    MutabaahService.setCurrentUser(null);
    setCurrentUser(null);

    // Refresh master siswa list
    const currentSiswaList = MutabaahService.getSiswa();
    setSiswaList(currentSiswaList);

    // Reset selected student so all form inputs are empty
    setSelectedSiswaList([]);

    setIsLoginModalOpen(true);
    addToast('info', 'Anda telah keluar dari sesi guru.');
  };

  // Handle Submit Mutabaah (Panel A -> Panel B Auto-Refresh)
  const handleSubmitMutabaah = (formDataJson: string, targetList: MasterSiswa[]) => {
    if (!currentUser) {
      setIsLoginModalOpen(true);
      return;
    }

    try {
      const baseFormData: MutabaahFormData = JSON.parse(formDataJson);
      
      if (targetList.length === 0) return;

      // Edit mode: update existing log
      if (editingLog) {
        const student = targetList[0];
        const studentName = student ? student.Nama_Siswa : editingLog.Nama_Siswa;
        let tahsinDetail = '';
        if (baseFormData.hasTahsin) {
          if (baseFormData.Tahsin_Rujukan === 'Al-Qur\'an') {
            tahsinDetail = (baseFormData.Tahsin_Mulai || baseFormData.Tahsin_Akhir)
              ? `Mulai: ${baseFormData.Tahsin_Mulai || '-'} s.d. Akhir: ${baseFormData.Tahsin_Akhir || '-'}`
              : baseFormData.Tahsin_Ayat || '-';
          } else {
            tahsinDetail = baseFormData.Tahsin_BabHalaman || '-';
          }
        }
        let tahfidhAyatDetail = '';
        if (baseFormData.hasTahfidh) {
          tahfidhAyatDetail = (baseFormData.Tahfidh_Mulai || baseFormData.Tahfidh_Akhir)
            ? `Mulai: ${baseFormData.Tahfidh_Mulai || '-'} s.d. Akhir: ${baseFormData.Tahfidh_Akhir || '-'}`
            : baseFormData.Tahfidh_Ayat || '-';
        }

        const updates: Partial<LogMutabaah> = {
          Tanggal_Mutabaah: baseFormData.Tanggal_Mutabaah,
          Kehadiran: baseFormData.Kehadiran,
          Tahsin_Rujukan: baseFormData.hasTahsin ? baseFormData.Tahsin_Rujukan : '',
          Tahsin_Capaian_SuratBab: baseFormData.hasTahsin ? (baseFormData.Tahsin_Rujukan === 'Al-Qur\'an' ? baseFormData.Tahsin_Surat : baseFormData.Tahsin_BabHalaman) : '',
          Tahsin_Capaian_Detail: tahsinDetail,
          Tahsin_Mulai: baseFormData.Tahsin_Mulai || '',
          Tahsin_Akhir: baseFormData.Tahsin_Akhir || '',
          Tahsin_Nilai: baseFormData.hasTahsin && baseFormData.Tahsin_Nilai !== '' ? Number(baseFormData.Tahsin_Nilai) : null,
          Tahfidh_Jenis: baseFormData.hasTahfidh ? baseFormData.Tahfidh_Jenis : '',
          Tahfidh_Surat: baseFormData.hasTahfidh ? baseFormData.Tahfidh_Surat : '',
          Tahfidh_Ayat: tahfidhAyatDetail,
          Tahfidh_Mulai: baseFormData.Tahfidh_Mulai || '',
          Tahfidh_Akhir: baseFormData.Tahfidh_Akhir || '',
          Tahfidh_Nilai: baseFormData.hasTahfidh && baseFormData.Tahfidh_Nilai !== '' ? Number(baseFormData.Tahfidh_Nilai) : null,
          Tajwid_Jenis: baseFormData.hasTajwid ? baseFormData.Tajwid_Jenis : '',
          Tajwid_Capaian: baseFormData.hasTajwid ? baseFormData.Tajwid_Capaian : '',
          Tajwid_Nilai: baseFormData.hasTajwid && baseFormData.Tajwid_Nilai !== '' ? Number(baseFormData.Tajwid_Nilai) : null,
          Catatan: baseFormData.Catatan.trim()
        };

        MutabaahService.updateLog(editingLog.ID_Log, updates);
        setPendingCount(MutabaahService.getPendingLogsCount());
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const n = MutabaahService.getPendingLogsCount();
          addToast('info', `Tersimpan offline di HP ini (antri ${n}). Jangan hapus data browser, tekan Sync saat online.`);
        } else {
          addToast('success', `Data mutabaah untuk ${studentName} berhasil diperbarui.`);
        }
        setEditingLog(null);
      } else {
        // Create mode
        if (targetList.length === 1) {
          const student = targetList[0];
          const studentFormData = { ...baseFormData, ID_Siswa: student.ID_Siswa };
          const newLog = MutabaahService.addLog(studentFormData, currentUser);
          setPendingCount(MutabaahService.getPendingLogsCount());
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            const n = MutabaahService.getPendingLogsCount();
            addToast('info', `Tersimpan offline di HP ini (antri ${n}). Jangan hapus data browser, tekan Sync saat online.`);
          } else {
            addToast('success', `Berhasil! Data mutabaah untuk ${newLog.Nama_Siswa} (NIS: ${newLog.ID_Siswa}) telah disimpan.`);
          }
        } else {
          const formDataList = targetList.map(s => ({
            ...baseFormData,
            ID_Siswa: s.ID_Siswa
          }));
          MutabaahService.addMultipleLogs(formDataList, currentUser);
          setPendingCount(MutabaahService.getPendingLogsCount());
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            const n = MutabaahService.getPendingLogsCount();
            addToast('info', `Tersimpan offline di HP ini (antri ${n}). Jangan hapus data browser, tekan Sync saat online.`);
          } else {
            addToast('success', `Berhasil! Data mutabaah massal untuk ${targetList.length} siswa telah disimpan.`);
          }
        }
      }

      // AUTO-REFRESH Panel B
      refreshPanelB();
    } catch (e) {
      addToast('error', 'Gagal menyimpan data mutabaah.');
    }
  };

  // Handle Google Sheets Sync — 1x klik: prune basi -> kirim antri -> ambil Google
  const handleSyncSheets = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const pruned = MutabaahService.pruneExpiredPendingByWeek();
      if (pruned.removed > 0) {
        addToast('info', `${pruned.removed} data pekan lalu dibersihkan otomatis.`);
      }
      const retry = await MutabaahService.retryPendingLogs();
      setPendingCount(MutabaahService.getPendingLogsCount());
      const result = await MutabaahService.fetchFromGoogleSheets();
      setPendingCount(MutabaahService.getPendingLogsCount());

      if (result.success) {
        // Refresh state
        setSiswaList(MutabaahService.getSiswa());
        setUsersList(MutabaahService.getUsers());
        refreshPanelB();
        const pendingNow = MutabaahService.getPendingLogsCount();
        if (retry.success > 0 && pendingNow === 0) {
          addToast('success', `Sync beres! ${retry.success} terkirim, tidak ada antrian.`);
        } else if (retry.success > 0) {
          addToast('success', `Terkirim ${retry.success}, sisa antri ${pendingNow}.`);
        } else if (pendingNow > 0) {
          addToast('info', `${result.message} (masih antri ${pendingNow}).`);
        } else {
          addToast('success', result.message);
        }
      } else {
        if (retry.success > 0) {
          addToast('success', `Terkirim ${retry.success}, Google belum bisa diambil. Data aman di HP.`);
        } else {
          addToast('info', result.message);
        }
      }
    } finally {
      setIsSyncing(false);
      setPendingCount(MutabaahService.getPendingLogsCount());
    }
  };

  // Handle Edit Log
  const handleEditLog = useCallback((log: LogMutabaah) => {
    setEditingLog(log);
    // Auto-select the student if not already selected
    const student = siswaList.find(s => s.ID_Siswa === log.ID_Siswa);
    if (student && !selectedSiswaList.some(s => s.ID_Siswa === log.ID_Siswa)) {
      setSelectedSiswaList([student]);
    }
    // Pindah ke tab form agar form edit langsung terlihat
    setActiveMainTab('form');
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [siswaList, selectedSiswaList]);

  // Handle Cancel Edit
  const handleCancelEdit = useCallback(() => {
    setEditingLog(null);
    setSelectedSiswaList([]);
  }, []);

  // Handle Delete Log
  const handleDeleteLog = useCallback((log: LogMutabaah) => {
    setDeleteTargetLog(log);
  }, []);

  // Handle Confirm Delete
  const handleConfirmDelete = useCallback(() => {
    if (!deleteTargetLog) return;
    MutabaahService.deleteLog(deleteTargetLog.ID_Log);
    setDeleteTargetLog(null);
    setPendingCount(MutabaahService.getPendingLogsCount());
    refreshPanelB();
    addToast('success', `Log untuk ${deleteTargetLog.Nama_Siswa} berhasil dihapus.`);
  }, [deleteTargetLog, refreshPanelB, addToast]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col antialiased selection:bg-[#1E3A8A] selection:text-white">
      
      {/* Top Navbar Header */}
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        onLogin={() => setIsLoginModalOpen(true)}
        onSync={handleSyncSheets}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        isOnline={isOnline}
        onOpenReportWA={() => setIsReportModalOpen(true)}
        onOpenBroadcast={() => setIsBroadcastOpen(true)}
      />

      {/* Sticky Banner jika ada antrian yang belum terkirim ke Spreadsheet */}
      {pendingCount > 0 && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-sm border-b border-amber-600/20">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0 animate-pulse">⏳</span>
            <span className="truncate text-amber-950">
              Ada <strong>{pendingCount}</strong> data tersimpan di HP & Firebase yang belum masuk ke Spreadsheet admin.
            </span>
          </div>
          <button
            onClick={handleSyncSheets}
            disabled={isSyncing}
            className="shrink-0 bg-white text-amber-950 font-bold px-3 py-1 rounded-lg shadow-sm hover:bg-amber-50 active:scale-95 transition-all text-xs disabled:opacity-50 flex items-center gap-1.5 border border-amber-300"
          >
            <RefreshCw className={`w-3 h-3 text-[#1E3A8A] ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Kirim...' : 'Kirim Sekarang'}
          </button>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Student Search & Selection Bar */}
        <StudentSearch
          siswaList={siswaList}
          selectedSiswaList={selectedSiswaList}
          onSelectSiswaList={setSelectedSiswaList}
        />

        {/* MAIN TABS: FORM INPUT vs RIWAYAT PERKEMBANGAN */}
        <div className="flex gap-1.5 p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
          <button
            type="button"
            onClick={() => setActiveMainTab('form')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all ${
              activeMainTab === 'form'
                ? 'bg-[#1E3A8A] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Form Input Mutabaah
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all ${
              activeMainTab === 'history'
                ? 'bg-[#1E3A8A] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            Riwayat Perkembangan
          </button>
        </div>

        {/* TAB CONTENT */}
        {activeMainTab === 'form' ? (
          <div className="max-w-3xl mx-auto">
            <MutabaahForm
              selectedSiswaList={selectedSiswaList}
              suratList={suratList}
              currentUser={currentUser}
              onSubmitSuccess={handleSubmitMutabaah}
              onError={(msg) => addToast('error', msg)}
              editingLog={editingLog}
              onCancelEdit={handleCancelEdit}
            />
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <MutabaahSummaryAndHistory
              selectedSiswaList={selectedSiswaList}
              logs={recentLogs}
              summary={summary}
              currentUser={currentUser}
              onEditLog={handleEditLog}
              onDeleteLog={handleDeleteLog}
            />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 font-bold text-slate-700 tracking-wide text-xs">
            <span>AL-WILDAN ISLAMIC SCHOOL 29 DEPOK</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            &copy; 2026. All rights reserved.
            <span className="ml-2 text-slate-300" title="Build version">
              v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}
            </span>
          </p>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Daily WhatsApp Report Modal */}
      <DailyReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        currentUser={currentUser}
        siswaList={siswaList}
        onToast={addToast}
      />

      {/* Broadcast Reminder Modal (khusus kurikulum) */}
      <BroadcastReminderModal
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        currentUser={currentUser}
        onToast={addToast}
      />

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        isOpen={deleteTargetLog !== null}
        onClose={() => setDeleteTargetLog(null)}
        onConfirm={handleConfirmDelete}
        studentName={deleteTargetLog?.Nama_Siswa || ''}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Banner update mingguan (prioritas) */}
      {weeklyNeeded && (
        <UpdateBanner
          kind="weekly"
          countdownSec={weeklyCountdown}
          onReload={handleWeeklyReloadNow}
          onSnooze={handleWeeklySnooze}
        />
      )}

      {/* Banner versi baru (hanya jika tidak ada banner mingguan) */}
      {!weeklyNeeded && updateAvailable && (
        <UpdateBanner
          kind="version"
          countdownSec={null}
          onReload={reloadForVersionUpdate}
          onSnooze={dismissVersionUpdate}
          onDismiss={dismissVersionUpdate}
        />
      )}

    </div>
  );
}
