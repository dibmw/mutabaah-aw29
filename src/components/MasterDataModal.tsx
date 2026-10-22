import React, { useState } from 'react';
import { MasterUser, MasterSiswa, MasterSurat } from '../types';
import { X, Users, UserPlus, Database, ExternalLink, BookOpen, Plus, Check } from 'lucide-react';

interface MasterDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: MasterUser[];
  siswaList: MasterSiswa[];
  suratList: MasterSurat[];
  onAddSiswa: (newStudent: MasterSiswa) => void;
}

export const MasterDataModal: React.FC<MasterDataModalProps> = ({
  isOpen,
  onClose,
  users,
  siswaList,
  suratList,
  onAddSiswa
}) => {
  const [activeTab, setActiveTab] = useState<'siswa' | 'users' | 'surat' | 'sheets'>('siswa');

  // Form for new student
  const [newNis, setNewNis] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newKelas, setNewKelas] = useState('Kelas 7A');
  const [newHalaqah, setNewHalaqah] = useState('Halaqah Abu Bakar');
  const [newGender, setNewGender] = useState('Laki-laki');
  const [isSuccessMsg, setIsSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNis.trim() || !newNama.trim()) return;

    const newStudent: MasterSiswa = {
      ID_Siswa: newNis.trim(), // NIS Primary Key
      Nama_Siswa: newNama.trim(),
      Kelas: newKelas,
      Kelompok_Halaqah: newHalaqah,
      Gender: newGender
    };

    onAddSiswa(newStudent);
    setNewNis('');
    setNewNama('');
    setIsSuccessMsg(`Siswa ${newStudent.Nama_Siswa} (NIS: ${newStudent.ID_Siswa}) berhasil ditambahkan!`);
    setTimeout(() => setIsSuccessMsg(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#1E3A8A] px-6 py-4 border-b-2 border-[#D97706] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-[#F59E0B]" />
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                Manajemen Master Data Database
              </h3>
              <p className="text-xs text-blue-200">
                Data terhubung dengan Google Sheets & Database Lokal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100 text-xs font-bold px-4 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('siswa')}
            className={`px-4 py-2.5 rounded-t-xl transition-all border-t-2 ${
              activeTab === 'siswa'
                ? 'bg-white border-[#1E3A8A] text-[#1E3A8A] shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Master Siswa ({siswaList.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 rounded-t-xl transition-all border-t-2 ${
              activeTab === 'users'
                ? 'bg-white border-[#1E3A8A] text-[#1E3A8A] shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Master User Guru ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('surat')}
            className={`px-4 py-2.5 rounded-t-xl transition-all border-t-2 ${
              activeTab === 'surat'
                ? 'bg-white border-[#1E3A8A] text-[#1E3A8A] shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Master Surat (114 Surah)
          </button>
          <button
            onClick={() => setActiveTab('sheets')}
            className={`px-4 py-2.5 rounded-t-xl transition-all border-t-2 ${
              activeTab === 'sheets'
                ? 'bg-white border-[#1E3A8A] text-[#1E3A8A] shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Google Sheets Info
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          
          {/* TAB 1: MASTER SISWA */}
          {activeTab === 'siswa' && (
            <div className="space-y-6">
              
              {/* Form Tambah Siswa Bar */}
              <form onSubmit={handleCreateStudent} className="bg-blue-50/70 p-4 rounded-xl border border-blue-200">
                <h4 className="font-bold text-[#1E3A8A] uppercase tracking-wider mb-3 flex items-center gap-1.5 text-xs">
                  <UserPlus className="w-4 h-4 text-[#D97706]" />
                  Tambah Siswa Baru ke Database (Primary Key = NIS)
                </h4>

                {isSuccessMsg && (
                  <div className="mb-3 p-2.5 bg-emerald-100 text-emerald-800 rounded-lg font-bold flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    {isSuccessMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      NIS (ID_Siswa) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={newNis}
                      onChange={(e) => setNewNis(e.target.value)}
                      placeholder="contoh: 12345685"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#1E3A8A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nama Lengkap Siswa <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={newNama}
                      onChange={(e) => setNewNama(e.target.value)}
                      placeholder="contoh: Muhammad Bilal"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#1E3A8A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Kelas
                    </label>
                    <input
                      type="text"
                      value={newKelas}
                      onChange={(e) => setNewKelas(e.target.value)}
                      placeholder="Kelas 7A"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#1E3A8A]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Gender
                    </label>
                    <select
                      value={newGender}
                      onChange={(e) => setNewGender(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#1E3A8A]"
                    >
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="mt-3 px-4 py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold rounded-lg shadow transition-all flex items-center gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-[#F59E0B]" />
                  Simpan Siswa Baru
                </button>
              </form>

              {/* Tabel Daftar Siswa */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase">
                      <th className="py-2.5 px-3">NIS (ID_Siswa)</th>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      <th className="py-2.5 px-3">Kelas</th>
                      <th className="py-2.5 px-3">Gender</th>
                      <th className="py-2.5 px-3 text-right">Format Option Search</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {siswaList.map((s) => (
                      <tr key={s.ID_Siswa} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-[#D97706]">
                          {s.ID_Siswa}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {s.Nama_Siswa}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700">
                          {s.Kelas}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700">
                          {s.Gender}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[10px] text-slate-500">
                          {s.Nama_Siswa} - NIS: {s.ID_Siswa} ({s.Kelas})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}


          {/* TAB 2: MASTER USER */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <p className="text-slate-600 font-medium">
                Daftar Guru / User yang memiliki hak akses login ke dalam Sistem Input Mutabaah. Email yang tidak ada di daftar ini akan ditolak sistem.
              </p>
              
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[11px] font-bold text-slate-700 uppercase">
                      <th className="py-2.5 px-3">ID_User</th>
                      <th className="py-2.5 px-3">Email Guru</th>
                      <th className="py-2.5 px-3">Nama Guru</th>
                      <th className="py-2.5 px-3 text-right">Status Autentikasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {users.map((u) => (
                      <tr key={u.ID_User} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-500">
                          {u.ID_User}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#1E3A8A]">
                          {u.Email}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {u.Nama_Guru}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                            Terverifikasi
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* TAB 3: MASTER SURAT */}
          {activeTab === 'surat' && (
            <div className="space-y-4">
              <p className="text-slate-600 font-medium">
                Master 114 Surat Al-Qur'an lengkap dengan nomor surat, nama surat, dan jumlah ayat.
              </p>
              
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-100 text-[11px] font-bold text-slate-700 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">No_Surat</th>
                      <th className="py-2.5 px-3">Nama Surat</th>
                      <th className="py-2.5 px-3 text-right">Jumlah Ayat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {suratList.map((s) => (
                      <tr key={s.No_Surat} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-[#D97706]">
                          {s.No_Surat}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {s.Nama_Surat}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-600">
                          {s.Jumlah_Ayat} Ayat
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* TAB 4: GOOGLE SHEETS INFO */}
          {activeTab === 'sheets' && (
            <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-[#1E3A8A]">
                    Google Sheets Backend Link
                  </h4>
                  <p className="text-slate-600 mt-1">
                    Spreadsheet ID: <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-[#D97706] font-bold">1wJMBxsQD4u_shFefiDeTpJYqgB8y1InC7De2XpXysCE</code>
                  </p>
                </div>
                <a
                  href="https://docs.google.com/spreadsheets/d/1wJMBxsQD4u_shFefiDeTpJYqgB8y1InC7De2XpXysCE/edit?usp=sharing"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 bg-[#1E3A8A] text-white font-bold rounded-lg shadow flex items-center gap-2 hover:bg-blue-900 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-[#F59E0B]" />
                  Buka Google Sheets
                </a>
              </div>

              <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-2 text-slate-700">
                <p className="font-bold text-slate-900">
                  Struktur Sheet Backend:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 font-medium pl-2">
                  <li><strong className="text-slate-800">Master_User</strong> (ID_User, Email, Nama_Guru)</li>
                  <li><strong className="text-slate-800">Master_Siswa</strong> (ID_Siswa [NIS], Nama_Siswa, Kelas, Gender, Guru, Gender_Guru [L/P])</li>
                  <li><strong className="text-slate-800">Rumah_Tahfidh</strong> (header sama dengan Master_Siswa: ID_Siswa, Nama_Siswa, Kelas, Gender, Guru, Gender_Guru — dipakai mode RT di Reminder; opsional)</li>
                  <li><strong className="text-slate-800">Master_Surat</strong> (No_Surat, Nama_Surat, Jumlah_Ayat)</li>
                  <li><strong className="text-slate-800">Jadwal_Pelajaran</strong> (Hari, Waktu_Mulai, Waktu_Selesai, ID_Kelas, Mapel, Guru — 1 sel Guru bisa berisi &gt;1 nama mis. "A & B")</li>
                  <li><strong className="text-slate-800">Log_Mutabaah</strong> (ID_Log, Timestamp, Tanggal_Mutabaah, Email_Guru, Nama_Guru, ID_Siswa [NIS], Nama_Siswa, Kehadiran, Tahsin_Rujukan, Tahsin_Capaian_SuratBab, Tahsin_Capaian_Detail, Tahsin_Nilai, Tahfidh_Jenis, Tahfidh_Surat, Tahfidh_Ayat, Tahfidh_Nilai, Tajwid_Jenis, Tajwid_Capaian, Tajwid_Nilai, Catatan)</li>
                </ul>
              </div>

              <div className="bg-amber-50/80 p-4 rounded-lg border border-amber-200 text-slate-800 space-y-2">
                <h5 className="font-bold text-amber-900 text-xs flex items-center justify-between">
                  <span>Kode Google Apps Script Optimal (Batch & Multi-Guru Fast Write):</span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">Rekomendasi</span>
                </h5>
                <p className="text-[11px] text-slate-600">
                  Salin skrip ini ke Apps Script Google Sheets Anda agar input massal dari banyak guru sekaligus masuk secara instant (1 kali operasi rangkap) tanpa risiko bentrok.
                </p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-[10px] font-mono leading-relaxed select-all">
{`function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log_Mutabaah");
    var data = JSON.parse(e.postData.contents);

    // === ACTION: UPDATE ===
    if (data._action === 'update') {
      var logId = data.ID_Log;
      var lastRow = sheet.getLastRow();
      if (lastRow < 1) return ContentService.createTextOutput("EMPTY");
      var ids = sheet.getRange(1, 1, lastRow, 1).getValues();
      var targetRow = -1;
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === logId) { targetRow = i + 1; break; }
      }
      var row = [
        data.ID_Log||'', data.Timestamp||'', data.Tanggal_Mutabaah||'',
        data.Email_Guru||'', data.Nama_Guru||'', data.ID_Siswa||'', data.Nama_Siswa||'',
        data.Kehadiran||'', data.Tahsin_Rujukan||'', data.Tahsin_Capaian_SuratBab||'',
        data.Tahsin_Capaian_Detail||'', data.Tahsin_Nilai!=null?data.Tahsin_Nilai:'',
        data.Tahfidh_Jenis||'', data.Tahfidh_Surat||'', data.Tahfidh_Ayat||'',
        data.Tahfidh_Nilai!=null?data.Tahfidh_Nilai:'', data.Tajwid_Jenis||'',
        data.Tajwid_Capaian||'', data.Tajwid_Nilai!=null?data.Tajwid_Nilai:'',
        data.Catatan||''
      ];
      if (targetRow > 0) {
        sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
      } else {
        sheet.getRange(lastRow + 1, 1, 1, row.length).setValues([row]);
      }
      return ContentService.createTextOutput("OK");
    }

    // === ACTION: DELETE ===
    if (data._action === 'delete') {
      var logId = data.ID_Log;
      var lastRow = sheet.getLastRow();
      if (lastRow < 1) return ContentService.createTextOutput("EMPTY");
      var ids = sheet.getRange(1, 1, lastRow, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === logId) { sheet.deleteRow(i + 1); return ContentService.createTextOutput("OK"); }
      }
      return ContentService.createTextOutput("NOT_FOUND");
    }

    // === ACTION: CREATE (default) ===
    var items = [];
    if (data.records && Array.isArray(data.records)) { items = data.records; }
    else if (Array.isArray(data)) { items = data; }
    else { items = [data]; }
    var rows = items.map(function(item) {
      return [
        item.ID_Log||'', item.Timestamp||'', item.Tanggal_Mutabaah||'',
        item.Email_Guru||'', item.Nama_Guru||'', item.ID_Siswa||'', item.Nama_Siswa||'',
        item.Kehadiran||'', item.Tahsin_Rujukan||'', item.Tahsin_Capaian_SuratBab||'',
        item.Tahsin_Capaian_Detail||'', item.Tahsin_Nilai!=null?item.Tahsin_Nilai:'',
        item.Tahfidh_Jenis||'', item.Tahfidh_Surat||'', item.Tahfidh_Ayat||'',
        item.Tahfidh_Nilai!=null?item.Tahfidh_Nilai:'', item.Tajwid_Jenis||'',
        item.Tajwid_Capaian||'', item.Tajwid_Nilai!=null?item.Tajwid_Nilai:'',
        item.Catatan||''
      ];
    });
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    return ContentService.createTextOutput("OK");
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message);
  } finally {
    lock.releaseLock();
  }
}`}
                </pre>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
