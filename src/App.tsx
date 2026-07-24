import React, { useState, useEffect, useCallback } from 'react';
import { MasterUser, MasterSiswa, MasterSurat, LogMutabaah, StudentSummary, MutabaahFormData } from './types';
import { MutabaahService } from './services/mutabaahService';
import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { StudentSearch } from './components/StudentSearch';
import { MutabaahForm } from './components/MutabaahForm';
import { MutabaahSummaryAndHistory } from './components/MutabaahSummaryAndHistory';
import { DailyReportModal } from './components/DailyReportModal';
import { ToastContainer, ToastMessage } from './components/Toast';

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
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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

    // Auto-cleanup old logs and retry pending webhook deliveries
    MutabaahService.autoCleanupIfNeeded();
    MutabaahService.retryPendingLogs().catch(() => {});
  }, []);

  // Fetch Panel B Data whenever selectedSiswaList changes or when log is added
  const refreshPanelB = useCallback(() => {
    if (selectedSiswaList.length === 1) {
      const student = selectedSiswaList[0];
      const logs = MutabaahService.getStudentRecentLogs(student.ID_Siswa, 10);
      const sumStats = MutabaahService.getStudentSummary(student.ID_Siswa);
      setRecentLogs(logs);
      setSummary(sumStats);
    } else if (selectedSiswaList.length > 1) {
      const nisSet = new Set(selectedSiswaList.map(s => s.ID_Siswa));
      const allLogs = MutabaahService.getLogs();
      const filtered = allLogs.filter(l => nisSet.has(l.ID_Siswa));
      filtered.sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());
      setRecentLogs(filtered.slice(0, 10));

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

      if (targetList.length === 1) {
        const student = targetList[0];
        const studentFormData = { ...baseFormData, ID_Siswa: student.ID_Siswa };
        const newLog = MutabaahService.addLog(studentFormData, currentUser);
        addToast('success', `Berhasil! Data mutabaah untuk ${newLog.Nama_Siswa} (NIS: ${newLog.ID_Siswa}) telah disimpan.`);
      } else {
        const formDataList = targetList.map(s => ({
          ...baseFormData,
          ID_Siswa: s.ID_Siswa
        }));
        MutabaahService.addMultipleLogs(formDataList, currentUser);
        addToast('success', `Berhasil! Data mutabaah massal untuk ${targetList.length} siswa telah disimpan.`);
      }

      // AUTO-REFRESH Panel B
      refreshPanelB();
    } catch (e) {
      addToast('error', 'Gagal menyimpan data mutabaah.');
    }
  };

  // Handle Google Sheets Sync
  const handleSyncSheets = async () => {
    setIsSyncing(true);
    const result = await MutabaahService.fetchFromGoogleSheets();
    setIsSyncing(false);

    if (result.success) {
      addToast('success', result.message);
      // Refresh state
      setSiswaList(MutabaahService.getSiswa());
      setUsersList(MutabaahService.getUsers());
      refreshPanelB();
    } else {
      addToast('info', result.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col antialiased selection:bg-[#1E3A8A] selection:text-white">
      
      {/* Top Navbar Header */}
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        onLogin={() => setIsLoginModalOpen(true)}
        onSync={handleSyncSheets}
        isSyncing={isSyncing}
        onOpenReportWA={() => setIsReportModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Student Search & Selection Bar */}
        <StudentSearch
          siswaList={siswaList}
          selectedSiswaList={selectedSiswaList}
          onSelectSiswaList={setSelectedSiswaList}
        />

        {/* DUAL-PANEL LAYOUT ON THE SAME PAGE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* PANEL A: FORM INPUT MUTABAAH (Left Column) */}
          <div className="lg:col-span-6 space-y-4">
            <MutabaahForm
              selectedSiswaList={selectedSiswaList}
              suratList={suratList}
              currentUser={currentUser}
              onSubmitSuccess={handleSubmitMutabaah}
              onError={(msg) => addToast('error', msg)}
            />
          </div>

          {/* PANEL B: PANEL SUMMARY & RIWAYAT PERKEMBANGAN (Right Column) */}
          <div className="lg:col-span-6 space-y-4">
            <MutabaahSummaryAndHistory
              selectedSiswaList={selectedSiswaList}
              logs={recentLogs}
              summary={summary}
            />
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 font-bold text-slate-700 tracking-wide text-xs">
            <span>AL-WILDAN ISLAMIC SCHOOL 29 DEPOK</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            &copy; 2026. All rights reserved.
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

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

    </div>
  );
}
