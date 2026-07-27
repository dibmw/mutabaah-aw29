import React, { useState, useMemo, useEffect } from 'react';
import { MasterSiswa, LogMutabaah, MasterUser } from '../types';
import { MutabaahService } from '../services/mutabaahService';
import { X, Copy, Share2, Calendar, Filter, FileText, Send, Check, RefreshCw } from 'lucide-react';

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: MasterUser | null;
  siswaList: MasterSiswa[];
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  siswaList,
  onToast
}) => {
  const todayStr = (() => {
    const n = new Date();
    const p = (v: number) => String(v).padStart(2, '0');
    return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
  })();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('MY_ACCOUNT');
  const [isCopied, setIsCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [logsState, setLogsState] = useState<LogMutabaah[]>([]);

  const isKurikulum = useMemo(() => {
    return currentUser?.Email?.toLowerCase() === 'kurikulum.alwildan29@gmail.com';
  }, [currentUser]);

  // Sync spreadsheet on modal open or manual trigger
  const handleSyncSpreadsheet = async (showToast = false) => {
    setIsSyncing(true);
    try {
      await MutabaahService.fetchFromGoogleSheets();
      if (showToast) {
        onToast('success', 'Data berhasil disinkronkan dari Google Sheets!');
      }
    } catch (e) {
      console.warn('Sync spreadsheet failed in DailyReportModal', e);
    } finally {
      setLogsState(MutabaahService.getLogs());
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleSyncSpreadsheet(false);
    }
  }, [isOpen]);

  // Sync selected teacher default when currentUser or isKurikulum changes
  React.useEffect(() => {
    setSelectedTeacher('MY_ACCOUNT');
  }, [currentUser, isKurikulum]);

  // Retrieve logs from MutabaahService / local state
  const allLogs: LogMutabaah[] = useMemo(() => {
    if (!isOpen) return [];
    return logsState.length > 0 ? logsState : MutabaahService.getLogs();
  }, [isOpen, logsState, selectedDate]);

  // Extract unique classes from logs on the selected date, filtered by teacher
  const uniqueClasses = useMemo(() => {
    const dateLogs = allLogs.filter(l => {
      if (l.Tanggal_Mutabaah !== selectedDate) return false;

      // Teacher filter (same logic as filteredLogs)
      if (!isKurikulum || selectedTeacher === 'MY_ACCOUNT') {
        if (currentUser) {
          const userEmail = currentUser.Email?.trim().toLowerCase();
          const userName = currentUser.Nama_Guru?.trim().toLowerCase();
          const logEmail = l.Email_Guru?.trim().toLowerCase();
          const logName = l.Nama_Guru?.trim().toLowerCase();
          const matchByEmail = Boolean(userEmail && logEmail && logEmail === userEmail);
          const matchByName = Boolean(userName && logName && logName === userName);
          if (!matchByEmail && !matchByName) return false;
        }
      } else if (selectedTeacher !== 'ALL') {
        const teacherKey = selectedTeacher.trim().toLowerCase();
        const logEmail = l.Email_Guru?.trim().toLowerCase() || '';
        const logName = l.Nama_Guru?.trim().toLowerCase() || '';
        const matchByEmail = Boolean(logEmail && logEmail === teacherKey);
        const matchByName = Boolean(logName && logName === teacherKey);
        if (!matchByEmail && !matchByName) return false;
      }

      return true;
    });

    const classes = Array.from(new Set(
      dateLogs.map(l => {
        const student = siswaList.find(s => s.ID_Siswa === l.ID_Siswa);
        return student?.Kelas || '';
      }).filter(Boolean)
    )).map(c => String(c));
    classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    return classes;
  }, [allLogs, selectedDate, siswaList, selectedTeacher, currentUser, isKurikulum]);

  // Set default selectedClass to the first available class with input
  useEffect(() => {
    if (uniqueClasses.length > 0 && (!selectedClass || !uniqueClasses.includes(selectedClass))) {
      setSelectedClass(uniqueClasses[0]);
    } else if (uniqueClasses.length === 0) {
      setSelectedClass('');
    }
  }, [uniqueClasses, selectedClass]);

  // List of all teachers (from Master Users + logs) for the filter dropdown
  const allTeachersList = useMemo(() => {
    const teachersMap = new Map<string, { key: string; name: string; email: string }>();

    // 1. Add from Master Users
    try {
      const users = MutabaahService.getUsers();
      users.forEach(u => {
        if (u.Nama_Guru) {
          const key = (u.Email || u.Nama_Guru).toLowerCase();
          teachersMap.set(key, { key, name: u.Nama_Guru, email: u.Email || '' });
        }
      });
    } catch (e) {
      console.warn('Could not load master users for report filter', e);
    }

    // 2. Add from allLogs
    allLogs.forEach(log => {
      if (log.Email_Guru || log.Nama_Guru) {
        const name = log.Nama_Guru || log.Email_Guru;
        const email = log.Email_Guru || '';
        const key = (email || name).toLowerCase();
        if (!teachersMap.has(key)) {
          teachersMap.set(key, { key, name, email });
        }
      }
    });

    return Array.from(teachersMap.values());
  }, [allLogs]);

  // Filtered logs by date, teacher, and class
  const filteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      // 1. Date match
      const matchDate = log.Tanggal_Mutabaah === selectedDate;
      if (!matchDate) return false;

      // 2. Teacher match
      if (!isKurikulum || selectedTeacher === 'MY_ACCOUNT') {
        if (currentUser) {
          const userEmail = currentUser.Email?.trim().toLowerCase();
          const userName = currentUser.Nama_Guru?.trim().toLowerCase();
          const logEmail = log.Email_Guru?.trim().toLowerCase();
          const logName = log.Nama_Guru?.trim().toLowerCase();

          const matchByEmail = Boolean(userEmail && logEmail && logEmail === userEmail);
          const matchByName = Boolean(userName && logName && logName === userName);
          if (!matchByEmail && !matchByName) return false;
        }
      } else if (selectedTeacher !== 'ALL') {
        const teacherKey = selectedTeacher.trim().toLowerCase();
        const logEmail = log.Email_Guru?.trim().toLowerCase() || '';
        const logName = log.Nama_Guru?.trim().toLowerCase() || '';

        const matchByEmail = Boolean(logEmail && logEmail === teacherKey);
        const matchByName = Boolean(logName && logName === teacherKey);
        if (!matchByEmail && !matchByName) return false;
      }

      // 3. Class match
      const studentObj = siswaList.find(s => s.ID_Siswa === log.ID_Siswa);
      const studentClass = studentObj?.Kelas || '';
      return studentClass === selectedClass;
    });
  }, [allLogs, selectedDate, selectedClass, selectedTeacher, currentUser, siswaList, isKurikulum]);

  // Count unique students for stats
  const uniqueStudentsCount = useMemo(() => {
    const studentKeys = new Set(filteredLogs.map(l => (l.ID_Siswa && l.ID_Siswa.trim()) ? l.ID_Siswa.trim() : l.Nama_Siswa.trim()));
    return studentKeys.size;
  }, [filteredLogs]);

  // Generate formatted WhatsApp text with per-student stacking
  const whatsappText = useMemo(() => {
    // Format date in Indonesian
    let formattedDate = selectedDate;
    try {
      const [year, month, day] = selectedDate.split('-');
      const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
      formattedDate = dateObj.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      formattedDate = selectedDate;
    }

    let teacherName = 'Guru Pengampu';

    if (!isKurikulum || selectedTeacher === 'MY_ACCOUNT') {
      teacherName = currentUser ? currentUser.Nama_Guru : 'Guru Pengampu';
    } else if (selectedTeacher === 'ALL') {
      teacherName = 'Semua Guru';
    } else {
      const selectedObj = allTeachersList.find(t => t.key === selectedTeacher.toLowerCase());
      if (selectedObj) {
        teacherName = selectedObj.name;
      } else {
        teacherName = 'Guru Pengampu';
      }
    }

    // Group logs by ID_Siswa
    const studentGroupMap = new Map<string, { idSiswa: string; namaSiswa: string; kelas: string; logs: LogMutabaah[] }>();

    filteredLogs.forEach((log) => {
      const key = (log.ID_Siswa && log.ID_Siswa.trim()) ? log.ID_Siswa.trim() : log.Nama_Siswa.trim();
      if (!studentGroupMap.has(key)) {
        const matchedSiswa = siswaList.find(s => (s.ID_Siswa && s.ID_Siswa.trim() === log.ID_Siswa?.trim()) || s.Nama_Siswa.trim() === log.Nama_Siswa.trim());
        const kelasName = log.Kelas || matchedSiswa?.Kelas || '-';

        studentGroupMap.set(key, {
          idSiswa: log.ID_Siswa || '-',
          namaSiswa: log.Nama_Siswa || 'Siswa',
          kelas: kelasName,
          logs: []
        });
      }
      studentGroupMap.get(key)!.logs.push(log);
    });

    const groupedStudents = Array.from(studentGroupMap.values())
      .sort((a, b) => a.namaSiswa.localeCompare(b.namaSiswa, 'id'));

    let text = `📋 *LAPORAN HARIAN MUTABAAH AL-QUR'AN*\n`;
    text += `🏫 *AL-WILDAN ISLAMIC SCHOOL 29 DEPOK*\n`;
    text += `📅 *Tanggal:* ${formattedDate}\n`;
    text += `👨‍🏫 *Guru:* ${teacherName}\n`;
    text += `🏫 *Kelas:* ${selectedClass}\n`;
    text += `📊 *Total Siswa:* ${groupedStudents.length} Siswa\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `📝 *RINCIAN HARIAN PER SISWA:*\n\n`;

    if (groupedStudents.length === 0) {
      text += `_(Belum ada data mutabaah yang diinput pada tanggal dan kelas ini)_\n`;
    } else {
      groupedStudents.forEach((st, index) => {
        text += `${index + 1}. *${st.namaSiswa}* (NIS: ${st.idSiswa})\n`;

        const formatSetoranDetail = (log: LogMutabaah): string[] => {
          const lines: string[] = [];
          if (log.Tahsin_Rujukan || log.Tahsin_Capaian_SuratBab) {
            lines.push(`   • Tahsin [${log.Tahsin_Rujukan || "Al-Qur'an"}]:`);
            lines.push(`     - Capaian: ${log.Tahsin_Capaian_SuratBab || '-'}`);
            if (log.Tahsin_Capaian_Detail) {
              lines.push(`     - Detail: ${log.Tahsin_Capaian_Detail}`);
            }
          } else if (log.Tahfidh_Jenis || log.Tahfidh_Surat) {
            lines.push(`   • Tahfidh [${log.Tahfidh_Jenis || 'Hafalan'}]:`);
            lines.push(`     - Surat: ${log.Tahfidh_Surat || '-'}`);
            if (log.Tahfidh_Ayat) {
              lines.push(`     - Ayat: ${log.Tahfidh_Ayat}`);
            }
          } else if (log.Tajwid_Jenis || log.Tajwid_Capaian) {
            lines.push(`   • Tajwid [${log.Tajwid_Jenis || 'Metode'}]:`);
            lines.push(`     - Capaian: ${log.Tajwid_Capaian || '-'}`);
          }
          return lines;
        };

        if (st.logs.length === 1) {
          const log = st.logs[0];
          if (['Lomba', 'Sakit', 'Izin'].includes(log.Kehadiran)) {
            text += `   • Sikap: ${log.Kehadiran}\n`;
          }

          const setoranLines = formatSetoranDetail(log);
          if (setoranLines.length > 0) {
            setoranLines.forEach(l => { text += `${l}\n`; });
          } else {
            text += `   • Setoran: Tidak ada setoran\n`;
          }
        } else {
          text += `   ───────────────────────────\n`;
          st.logs.forEach((log, logIdx) => {
            text += `   ▸ Input #${logIdx + 1}\n`;
            if (['Lomba', 'Sakit', 'Izin'].includes(log.Kehadiran)) {
              text += `   • Sikap: ${log.Kehadiran}\n`;
            }

            const setoranLines = formatSetoranDetail(log);
            if (setoranLines.length > 0) {
              setoranLines.forEach(l => { text += `${l}\n`; });
            } else {
              text += `   • Setoran: Tidak ada setoran\n`;
            }

            if (logIdx < st.logs.length - 1) {
              text += `\n`;
            }
          });
        }
        text += `\n`;
      });
    }

    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `_Syukran jazaakumullahu khairan wa baarakallahu fiikum_`;

    return text;
  }, [selectedDate, selectedClass, filteredLogs, currentUser, isKurikulum, selectedTeacher, allTeachersList]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(whatsappText);
    setIsCopied(true);
    onToast('success', 'Laporan harian berhasil dicopy ke clipboard! Siap dipaste ke WhatsApp.');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(whatsappText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-0 sm:p-4 animate-fade-in">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Header Modal */}
        <div className="bg-[#1E3A8A] text-white px-4 sm:px-6 py-3.5 sm:py-4 border-b-2 border-[#D97706] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#F59E0B] text-[#1E3A8A] flex items-center justify-center font-black shrink-0 shadow-sm">
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold tracking-tight flex items-center gap-2">
                Laporan Harian WhatsApp
                <span className="hidden sm:inline-block bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  WA Ready
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-blue-200 line-clamp-1">
                Generate rekap mutabaah harian kelas untuk dipaste ke grup WA
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

        {/* Filter Toolbar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200/80 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#D97706]" />
                Tanggal Mutabaah
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#1E3A8A] min-h-[42px] shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-emerald-600" />
                Filter Guru Pengampu
              </label>
              {isKurikulum ? (
                <select
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#1E3A8A] min-h-[42px] shadow-2xs"
                >
                  <option value="MY_ACCOUNT">
                    Saya ({currentUser?.Nama_Guru || 'Kurikulum'})
                  </option>
                  <option value="ALL">Semua Guru</option>
                  {allTeachersList
                    .filter(t => {
                      if (!currentUser) return true;
                      const isCurrent = (currentUser.Email && t.email.toLowerCase() === currentUser.Email.toLowerCase()) ||
                                        (currentUser.Nama_Guru && t.name.toLowerCase() === currentUser.Nama_Guru.toLowerCase());
                      return !isCurrent;
                    })
                    .map(t => (
                      <option key={t.key} value={t.key}>
                        {t.name}
                      </option>
                    ))}
                </select>
              ) : (
                <select
                  disabled
                  value="MY_ACCOUNT"
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-600 min-h-[42px] shadow-2xs cursor-not-allowed"
                >
                  <option value="MY_ACCOUNT">
                    {currentUser?.Nama_Guru || 'Guru Pengampu'}
                  </option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-[#1E3A8A]" />
                Filter Kelas
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#1E3A8A] min-h-[42px] shadow-2xs"
              >
                {uniqueClasses.length > 0 ? (
                  uniqueClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    Tidak ada input pada tanggal ini
                  </option>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-5 flex-1 overflow-y-auto space-y-3.5 bg-slate-50">
          
          {/* Quick Stats Banner */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Rekap Mutabaah</span>
              <span className="text-sm sm:text-base font-extrabold text-[#1E3A8A]">
                {uniqueStudentsCount} Siswa <span className="text-xs font-semibold text-slate-500">({filteredLogs.length} Entry Mutabaah)</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSyncSpreadsheet(true)}
                disabled={isSyncing}
                title="Sinkronkan data dari Google Sheet sekarang"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] rounded-lg border border-blue-200 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncing ? 'Memuat...' : 'Sinkron Spreadsheet'}</span>
              </button>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 shrink-0">
                {selectedClass}
              </span>
            </div>
          </div>

          {/* Section Label */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#1E3A8A]" />
              Pesan Laporan WhatsApp
            </span>
            <span className="text-[10px] sm:text-xs text-slate-500 font-medium bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
              Format Teks Asli
            </span>
          </div>

          {/* Plain Text Display Box */}
          <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap select-all border border-slate-800 shadow-inner max-h-[340px] sm:max-h-[380px] overflow-y-auto">
            {whatsappText}
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium text-center sm:text-left hidden sm:block">
            Tekan <span className="font-bold text-slate-700">Copy ke Clipboard</span> lalu paste langsung ke aplikasi WhatsApp.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopy}
              className={`flex-1 sm:flex-initial px-4 py-3 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 min-h-[44px] ${
                isCopied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#1E3A8A] hover:bg-blue-900 text-white border border-[#F59E0B]/40'
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  Berhasil Dicopy!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#F59E0B]" />
                  Copy ke Clipboard
                </>
              )}
            </button>

            <button
              onClick={handleOpenWhatsApp}
              className="flex-1 sm:flex-initial px-4 py-3 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 border border-emerald-400/40 min-h-[44px]"
            >
              <Send className="w-4 h-4" />
              Buka WhatsApp
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
