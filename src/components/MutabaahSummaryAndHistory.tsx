import React from 'react';
import { MasterSiswa, LogMutabaah, StudentSummary, MasterUser } from '../types';
import { History, FileText, Calendar, User, MessageSquare, Users, Pencil, Trash2 } from 'lucide-react';

interface MutabaahSummaryAndHistoryProps {
  selectedSiswaList: MasterSiswa[];
  logs: LogMutabaah[];
  summary: StudentSummary;
  currentUser?: MasterUser | null;
  onEditLog?: (log: LogMutabaah) => void;
  onDeleteLog?: (log: LogMutabaah) => void;
}

export const MutabaahSummaryAndHistory: React.FC<MutabaahSummaryAndHistoryProps> = ({
  selectedSiswaList,
  logs,
  summary,
  currentUser,
  onEditLog,
  onDeleteLog
}) => {
  if (selectedSiswaList.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1E3A8A] mx-auto flex items-center justify-center mb-3">
          <History className="w-6 h-6" />
        </div>
        <h3 className="text-base font-extrabold text-slate-800">
          PANEL SUMMARY & RIWAYAT PERKEMBANGAN
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          Pilih siswa atau centang sekelas terlebih dahulu untuk menampilkan kartu ringkasan (summary card) dan 20 riwayat mutabaah terakhir.
        </p>
      </div>
    );
  }

  const isMulti = selectedSiswaList.length > 1;

  return (
    <div className="space-y-6">
      
      {/* TABEL RIWAYAT 20 INPUTAN TERAKHIR */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
        <div className="bg-[#1E3A8A] px-6 py-3.5 border-b-2 border-[#D97706] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-[#F59E0B]" />
            <h3 className="text-sm font-extrabold tracking-tight">
              {isMulti ? `RIWAYAT MUTABAAH TERAKHIR (${selectedSiswaList.length} SISWA TERPILIH)` : 'RIWAYAT 20 INPUTAN TERAKHIR'}
            </h3>
          </div>
          <span className="text-xs text-blue-200 font-medium">
            Diurutkan dari Tanggal Mutabaah Terbaru
          </span>
        </div>

        {isMulti && (
          <div className="bg-blue-50/80 px-6 py-3 border-b border-blue-200 text-xs text-[#1E3A8A] flex items-center gap-2 font-bold">
            <Users className="w-4 h-4 text-[#1E3A8A]" />
            <span>
              Mode Input Massal / Sekelas Aktif ({selectedSiswaList.length} Siswa). Input mutabaah dari form di sebelah kiri akan disimpan sekaligus untuk seluruh siswa di atas.
            </span>
          </div>
        )}

        {logs.length === 0 ? (
          /* REQUIREMENT: Empty State exact text */
          <div className="p-10 text-center bg-slate-50">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">
              Belum ada riwayat mutabaah untuk siswa terpilih.
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Gunakan form di sebelah kiri untuk menginput log mutabaah harian bagi {isMulti ? `${selectedSiswaList.length} siswa terpilih` : selectedSiswaList[0].Nama_Siswa}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                  <th className="py-3 px-3.5 whitespace-nowrap">Tanggal</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Guru Penginput</th>
                  <th className="py-3 px-3.5 whitespace-nowrap text-center">Kehadiran</th>
                  <th className="py-3 px-3.5">Detail Tahsin & Nilai</th>
                  <th className="py-3 px-3.5">Detail Tahfidh & Nilai</th>
                  <th className="py-3 px-3.5">Detail Tajwid & Nilai</th>
                  {/* REQUIREMENT: Catatan column MUST be at the far right/last column */}
                  <th className="py-3 px-3.5 min-w-[180px]">Catatan Guru</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
                {logs.map((log) => {
                  // Format Tahsin Column
                  const hasTahsinDetail = log.Tahsin_Rujukan || log.Tahsin_Capaian_SuratBab;
                  // Format Tahfidh Column
                  const hasTahfidhDetail = log.Tahfidh_Jenis || log.Tahfidh_Surat;
                  // Format Tajwid Column
                  const hasTajwidDetail = log.Tajwid_Jenis || log.Tajwid_Capaian;

                  return (
                    <tr key={log.ID_Log} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* Tanggal */}
                      <td className="py-3 px-3.5 font-bold whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-900">
                          <Calendar className="w-3.5 h-3.5 text-[#D97706]" />
                          {log.Tanggal_Mutabaah}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                          {log.Timestamp ? log.Timestamp.slice(11, 16) : ''}
                        </span>
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

                      {/* Detail Tahsin & Nilai */}
                      <td className="py-3 px-3.5">
                        {hasTahsinDetail ? (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded mr-1">
                              {log.Tahsin_Rujukan || 'Tahsin'}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {log.Tahsin_Capaian_SuratBab} {log.Tahsin_Capaian_Detail ? `(${log.Tahsin_Capaian_Detail})` : ''}
                            </span>
                            {log.Tahsin_Nilai !== null && log.Tahsin_Nilai !== undefined && (
                              <div className="text-[11px] font-black text-[#1E3A8A]">
                                Nilai: {log.Tahsin_Nilai}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-bold">-</span>
                        )}
                      </td>

                      {/* Detail Tahfidh & Nilai */}
                      <td className="py-3 px-3.5">
                        {hasTahfidhDetail ? (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded mr-1">
                              {log.Tahfidh_Jenis || 'Tahfidh'}
                            </span>
                            <span className="font-semibold text-slate-900">
                              Surat {log.Tahfidh_Surat} {log.Tahfidh_Ayat ? `(${log.Tahfidh_Ayat})` : ''}
                            </span>
                            {log.Tahfidh_Nilai !== null && log.Tahfidh_Nilai !== undefined && (
                              <div className="text-[11px] font-black text-[#D97706]">
                                Nilai: {log.Tahfidh_Nilai}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-bold">-</span>
                        )}
                      </td>

                      {/* Detail Tajwid & Nilai */}
                      <td className="py-3 px-3.5">
                        {hasTajwidDetail ? (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded mr-1">
                              {log.Tajwid_Jenis || 'Tajwid'}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {log.Tajwid_Capaian}
                            </span>
                            {log.Tajwid_Nilai !== null && log.Tajwid_Nilai !== undefined && (
                              <div className="text-[11px] font-black text-purple-800">
                                Nilai: {log.Tajwid_Nilai}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-bold">-</span>
                        )}
                      </td>

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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
};
