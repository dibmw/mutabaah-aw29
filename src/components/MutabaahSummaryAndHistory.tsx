import React, { useState, useEffect } from 'react';
import { MasterSiswa, LogMutabaah, StudentSummary, MasterUser } from '../types';
import { MutabaahService } from '../services/mutabaahService';
import {
  History,
  FileText,
  Calendar,
  User,
  MessageSquare,
  Users,
  Pencil,
  Trash2,
  CloudDownload,
  RotateCcw,
  BookOpen,
  Award,
  Sparkles,
  Filter,
} from 'lucide-react';

interface MutabaahSummaryAndHistoryProps {
  selectedSiswaList: MasterSiswa[];
  logs: LogMutabaah[];
  summary: StudentSummary;
  currentUser?: MasterUser | null;
  onEditLog?: (log: LogMutabaah) => void;
  onDeleteLog?: (log: LogMutabaah) => void;
}

type SubTab = 'tahsin' | 'tahfidh' | 'tajwid';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'tahsin', label: 'Tahsin' },
  { key: 'tahfidh', label: 'Tahfidh' },
  { key: 'tajwid', label: 'Tajwid' },
];

const FILTER_OPTIONS: Record<SubTab, { value: string; label: string }[]> = {
  tahsin: [
    { value: 'all', label: 'Semua Rujukan' },
    { value: "Al-Qur'an", label: "Al-Qur'an" },
    { value: 'Iqro', label: 'Iqro' },
    { value: 'Qoidah Nuroniyyah', label: 'Qoidah Nuroniyyah' },
  ],
  tahfidh: [
    { value: 'all', label: 'Semua Jenis' },
    { value: 'Hafalan Baru (Ziyadah)', label: 'Hafalan Baru (Ziyadah)' },
    { value: "Hafalan Lama (Muroja'ah)", label: "Hafalan Lama (Muroja'ah)" },
  ],
  tajwid: [
    { value: 'all', label: 'Semua Metode' },
    { value: "Tajwid Metode Asy-Syafi'i", label: "Tajwid Metode Asy-Syafi'i" },
    { value: 'Tuhfatul Athfal', label: 'Tuhfatul Athfal' },
  ],
};

const hasDetailForTab = (log: LogMutabaah, tab: SubTab): boolean => {
  if (tab === 'tahsin') return Boolean(log.Tahsin_Rujukan || log.Tahsin_Capaian_SuratBab);
  if (tab === 'tahfidh') return Boolean(log.Tahfidh_Jenis || log.Tahfidh_Surat);
  return Boolean(log.Tajwid_Jenis || log.Tajwid_Capaian);
};

const getJenisForTab = (log: LogMutabaah, tab: SubTab): string => {
  if (tab === 'tahsin') return log.Tahsin_Rujukan || '';
  if (tab === 'tahfidh') return log.Tahfidh_Jenis || '';
  return log.Tajwid_Jenis || '';
};

const renderDetail = (log: LogMutabaah, tab: SubTab) => {
  if (tab === 'tahsin') {
    return (
      <div className="space-y-0.5">
        {log.Tahsin_Rujukan && (
          <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded mr-1">
            {log.Tahsin_Rujukan}
          </span>
        )}
        <span className="font-semibold text-slate-900">
          {log.Tahsin_Capaian_SuratBab}
          {log.Tahsin_Capaian_Detail ? ` (${log.Tahsin_Capaian_Detail})` : ''}
        </span>
        {log.Tahsin_Nilai !== null && log.Tahsin_Nilai !== undefined && (
          <div className="text-[11px] font-black text-[#1E3A8A]">
            Nilai: {log.Tahsin_Nilai}
          </div>
        )}
      </div>
    );
  }

  if (tab === 'tahfidh') {
    return (
      <div className="space-y-0.5">
        {log.Tahfidh_Jenis && (
          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded mr-1">
            {log.Tahfidh_Jenis}
          </span>
        )}
        <span className="font-semibold text-slate-900">
          Surat {log.Tahfidh_Surat}
          {log.Tahfidh_Ayat ? ` (${log.Tahfidh_Ayat})` : ''}
        </span>
        {log.Tahfidh_Nilai !== null && log.Tahfidh_Nilai !== undefined && (
          <div className="text-[11px] font-black text-[#D97706]">
            Nilai: {log.Tahfidh_Nilai}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {log.Tajwid_Jenis && (
        <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded mr-1">
          {log.Tajwid_Jenis}
        </span>
      )}
      <span className="font-semibold text-slate-900">{log.Tajwid_Capaian}</span>
      {log.Tajwid_Nilai !== null && log.Tajwid_Nilai !== undefined && (
        <div className="text-[11px] font-black text-purple-800">
          Nilai: {log.Tajwid_Nilai}
        </div>
      )}
    </div>
  );
};

export const MutabaahSummaryAndHistory: React.FC<MutabaahSummaryAndHistoryProps> = ({
  selectedSiswaList,
  logs,
  currentUser,
  onEditLog,
  onDeleteLog,
}) => {
  const isMulti = selectedSiswaList.length > 1;
  const singleNis = !isMulti && selectedSiswaList.length === 1 ? selectedSiswaList[0].ID_Siswa : '';

  // Riwayat lengkap on-demand langsung dari Sheet (tanpa batas retensi 30 hari lokal).
  // Hanya untuk mode 1 siswa agar query ringan.
  const [sheetLogs, setSheetLogs] = useState<LogMutabaah[] | null>(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);

  // Sub-tab & filter jenis
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('tahsin');
  const [filterJenis, setFilterJenis] = useState<string>('all');

  useEffect(() => {
    setSheetLogs(null);
  }, [singleNis]);

  useEffect(() => {
    setFilterJenis('all');
  }, [activeSubTab]);

  const handleLoadSheetHistory = async () => {
    if (!singleNis || isLoadingSheet) return;
    setIsLoadingSheet(true);
    try {
      const full = await MutabaahService.fetchStudentHistoryFromSheet(singleNis, 20);
      setSheetLogs(full);
    } catch (e) {
      console.warn('Muat riwayat dari Sheet gagal:', e);
    } finally {
      setIsLoadingSheet(false);
    }
  };

  if (selectedSiswaList.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1E3A8A] mx-auto flex items-center justify-center mb-3">
          <History className="w-6 h-6" />
        </div>
        <h3 className="text-base font-extrabold text-slate-800">
          RIWAYAT PERKEMBANGAN
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          Pilih siswa atau centang sekelas terlebih dahulu untuk menampilkan riwayat perkembangan mutabaah (Tahsin, Tahfidh, dan Tajwid).
        </p>
      </div>
    );
  }

  const displayedLogs = sheetLogs ?? logs;
  const activeTabLabel = SUB_TABS.find((t) => t.key === activeSubTab)?.label || '';

  const filteredLogs = displayedLogs.filter((log) => {
    if (!hasDetailForTab(log, activeSubTab)) return false;
    if (filterJenis === 'all') return true;
    return getJenisForTab(log, activeSubTab) === filterJenis;
  });

  const renderSubTabIcon = (tab: SubTab) => {
    if (tab === 'tahsin') return <BookOpen className="w-3.5 h-3.5" />;
    if (tab === 'tahfidh') return <Award className="w-3.5 h-3.5" />;
    return <Sparkles className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-6">
      {/* RIWAYAT PERKEMBANGAN */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
        <div className="bg-[#1E3A8A] px-6 py-3.5 border-b-2 border-[#D97706] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-[#F59E0B]" />
            <h3 className="text-sm font-extrabold tracking-tight">
              {isMulti
                ? `RIWAYAT PERKEMBANGAN (${selectedSiswaList.length} SISWA TERPILIH)`
                : 'RIWAYAT PERKEMBANGAN'}
            </h3>
          </div>
          <span className="text-xs text-blue-200 font-medium">
            20 Inputan Terakhir • Diurutkan Terbaru
          </span>
        </div>

        {isMulti && (
          <div className="bg-blue-50/80 px-6 py-3 border-b border-blue-200 text-xs text-[#1E3A8A] flex items-center gap-2 font-bold">
            <Users className="w-4 h-4 text-[#1E3A8A]" />
            <span>
              Mode Input Massal / Sekelas Aktif ({selectedSiswaList.length} Siswa).
            </span>
          </div>
        )}

        {/* SUB-TAB: Tahsin / Tahfidh / Tajwid */}
        <div className="px-4 sm:px-6 pt-4">
          <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
            {SUB_TABS.map((tab) => {
              const count = displayedLogs.filter((log) => hasDetailForTab(log, tab.key)).length;
              const isActive = activeSubTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveSubTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-extrabold transition-all ${
                    isActive
                      ? 'bg-white text-[#1E3A8A] shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {renderSubTabIcon(tab.key)}
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-blue-100 text-[#1E3A8A]' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* FILTER JENIS + MUAT DARI SHEET */}
        <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
              className="px-2.5 py-1.5 text-[11px] font-bold bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
            >
              {FILTER_OPTIONS[activeSubTab].map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Riwayat lengkap dari Sheet (tanpa batas 30 hari) — mode 1 siswa */}
          {!isMulti && (
            <div className="flex flex-wrap items-center gap-2">
              {sheetLogs ? (
                <>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 uppercase tracking-wide">
                    Dari Sheet • {sheetLogs.length} data
                  </span>
                  <button
                    onClick={() => setSheetLogs(null)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-300 transition-all active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Kembali ke data lokal
                  </button>
                </>
              ) : (
                <button
                  onClick={handleLoadSheetHistory}
                  disabled={isLoadingSheet}
                  title="Ambil 20 riwayat terakhir langsung dari Google Sheets (termasuk yang lebih tua dari 30 hari)"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] rounded-lg border border-blue-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  <CloudDownload className={`w-3.5 h-3.5 ${isLoadingSheet ? 'animate-pulse' : ''}`} />
                  {isLoadingSheet ? 'Memuat dari Sheet...' : 'Muat 20 Terakhir dari Sheet'}
                </button>
              )}
            </div>
          )}
        </div>

        {displayedLogs.length === 0 ? (
          /* REQUIREMENT: Empty State exact text */
          <div className="p-10 text-center bg-slate-50">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">
              Belum ada riwayat mutabaah untuk siswa terpilih.
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Gunakan tab Form Input Mutabaah untuk menginput log mutabaah harian bagi {isMulti ? `${selectedSiswaList.length} siswa terpilih` : selectedSiswaList[0].Nama_Siswa}.
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-10 text-center bg-slate-50">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">
              Belum ada riwayat {activeTabLabel} untuk filter terpilih.
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Coba ubah filter jenis atau pilih sub-tab lain.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                  {isMulti && <th className="py-3 px-3.5 whitespace-nowrap">Nama Siswa</th>}
                  <th className="py-3 px-3.5 whitespace-nowrap">Tanggal</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Guru Penginput</th>
                  <th className="py-3 px-3.5 whitespace-nowrap text-center">Kehadiran</th>
                  <th className="py-3 px-3.5">Detail {activeTabLabel} & Nilai</th>
                  {/* REQUIREMENT: Catatan column MUST be at the far right/last column */}
                  <th className="py-3 px-3.5 min-w-[180px]">Catatan Guru</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
                {filteredLogs.map((log) => (
                  <tr key={log.ID_Log} className="hover:bg-slate-50/80 transition-colors">
                    {/* Nama Siswa (hanya saat multi) */}
                    {isMulti && (
                      <td className="py-3 px-3.5 font-bold whitespace-nowrap text-slate-900">
                        {log.Nama_Siswa}
                      </td>
                    )}

                    {/* Tanggal = Tanggal_Mutabaah (pilihan di form, bisa rapel).
                        Kecil di bawahnya = waktu submit (Timestamp):
                        jam polos bila diinput hari-H, label "diinput ..."
                        bila tanggal submit beda dengan tanggal mutabaah. */}
                    <td className="py-3 px-3.5 font-bold whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-900">
                        <Calendar className="w-3.5 h-3.5 text-[#D97706]" />
                        {log.Tanggal_Mutabaah}
                      </div>
                      {(() => {
                        const ts = log.Timestamp || '';
                        const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(ts);
                        if (!m) return null;
                        const [, y, mo, d, hh, mm] = m;
                        const inputDate = `${y}-${mo}-${d}`;
                        const time = hh && mm ? `${hh}:${mm}` : '';
                        if (inputDate === (log.Tanggal_Mutabaah || '')) {
                          if (!time) return null;
                          return (
                            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                              {time}
                            </span>
                          );
                        }
                        const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                        const monthLabel = MONTHS[Number(mo) - 1] || mo;
                        const mutabaahYear = (log.Tanggal_Mutabaah || '').slice(0, 4);
                        const yearSuffix = mutabaahYear && y !== mutabaahYear ? ` ${y}` : '';
                        return (
                          <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                            diinput {Number(d)} {monthLabel}{yearSuffix}{time ? ` • ${time}` : ''}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Guru Penginput */}
                    <td className="py-3 px-3.5 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div>
                          <span className="font-bold text-slate-800 block truncate max-w-[140px]">
                            {log.Nama_Guru}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                            {log.Email_Guru}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Kehadiran Badge */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase ${
                        log.Kehadiran === 'A' || (log.Kehadiran as string) === 'Hadir'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : log.Kehadiran === 'Sakit' || log.Kehadiran === 'Izin'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        {log.Kehadiran}
                      </span>
                    </td>

                    {/* Detail sesuai sub-tab & Nilai */}
                    <td className="py-3 px-3.5">{renderDetail(log, activeSubTab)}</td>

                    {/* Catatan Guru (Far Right Column) */}
                    <td className="py-3 px-3.5 max-w-[260px] break-words">
                      {log.Catatan ? (
                        <div className="flex items-start gap-1.5 text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <p className="text-xs leading-relaxed italic whitespace-pre-wrap">
                            "{log.Catatan}"
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-bold">-</span>
                      )}
                    </td>

                    {/* Aksi (Edit/Delete) */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {(() => {
                        const isOwner = currentUser && log.Email_Guru?.toLowerCase() === currentUser.Email?.toLowerCase();
                        const isAdmin = currentUser?.Email?.toLowerCase() === 'kurikulum.alwildan29@gmail.com';
                        const canModify = isOwner || isAdmin;
                        if (!canModify) return <span className="text-slate-400 font-bold">-</span>;
                        return (
                          <div className="flex items-center gap-1">
                            {onEditLog && (
                              <button
                                onClick={() => onEditLog(log)}
                                title="Edit log ini"
                                className="p-1.5 text-slate-400 hover:text-[#1E3A8A] hover:bg-blue-50 rounded-lg transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center border border-transparent hover:border-blue-200"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDeleteLog && (
                              <button
                                onClick={() => onDeleteLog(log)}
                                title="Hapus log ini"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors min-h-[28px] min-w-[28px] flex items-center justify-center border border-transparent hover:border-rose-200"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
};
