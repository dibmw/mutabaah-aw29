import React, { useState, useEffect } from 'react';
import { MasterSiswa, MasterSurat, MasterUser, AttendanceType, TahsinReference, TahfidhType, TajwidType, MutabaahFormData } from '../types';
import { Calendar, BookOpen, Award, Sparkles, MessageSquare, Save, AlertCircle, RefreshCw, Users } from 'lucide-react';

interface MutabaahFormProps {
  selectedSiswaList: MasterSiswa[];
  suratList: MasterSurat[];
  currentUser: MasterUser | null;
  onSubmitSuccess: (formDataJson: string, targetList: MasterSiswa[]) => void;
  onError: (msg: string) => void;
}

export const MutabaahForm: React.FC<MutabaahFormProps> = ({
  selectedSiswaList,
  suratList,
  currentUser,
  onSubmitSuccess,
  onError
}) => {
  // Form State
  const todayStr = new Date().toISOString().slice(0, 10);
  const [tanggal, setTanggal] = useState(todayStr);
  const [kehadiran, setKehadiran] = useState<AttendanceType>('A');

  // Multi-select flag
  const isMultiSelect = selectedSiswaList.length > 1;

  // Single Setoran Selection State: Teacher can ONLY pick ONE setoran type maximum
  type SetoranChoice = 'none' | 'tahsin' | 'tahfidh' | 'tajwid';
  const [setoranChoice, setSetoranChoice] = useState<SetoranChoice>('none');

  // Auto switch off Tahfidh or None if teacher selects multiple students
  useEffect(() => {
    if (isMultiSelect && (setoranChoice === 'tahfidh' || setoranChoice === 'none')) {
      setSetoranChoice('tahsin');
    }
  }, [isMultiSelect, setoranChoice]);

  // Details for Setoran Tahsin
  const [tahsinRujukan, setTahsinRujukan] = useState<TahsinReference>('Al-Qur\'an');
  const [tahsinSuratMulai, setTahsinSuratMulai] = useState('Al-Fatihah');
  const [tahsinSuratAkhir, setTahsinSuratAkhir] = useState('Al-Fatihah');
  const [tahsinMulai, setTahsinMulai] = useState('');
  const [tahsinAkhir, setTahsinAkhir] = useState('');
  const [tahsinBabHalaman, setTahsinBabHalaman] = useState('');
  const [tahsinNilai, setTahsinNilai] = useState<string | number>('');

  // Details for Setoran Tahfidh
  const [tahfidhJenis, setTahfidhJenis] = useState<TahfidhType>('Hafalan Baru (Ziyadah)');
  const [tahfidhSuratMulai, setTahfidhSuratMulai] = useState('An-Naba\'');
  const [tahfidhSuratAkhir, setTahfidhSuratAkhir] = useState('An-Naba\'');
  const [tahfidhMulai, setTahfidhMulai] = useState('');
  const [tahfidhAkhir, setTahfidhAkhir] = useState('');
  const [tahfidhNilai, setTahfidhNilai] = useState<string | number>('');

  // Handlers for Surah Mulai Change (auto-sync Surah Akhir initially)
  const handleTahsinSuratMulaiChange = (surat: string) => {
    setTahsinSuratMulai(surat);
    setTahsinSuratAkhir(surat);
  };

  const handleTahfidhSuratMulaiChange = (surat: string) => {
    setTahfidhSuratMulai(surat);
    setTahfidhSuratAkhir(surat);
  };

  // Details for Setoran Tajwid
  const [tajwidJenis, setTajwidJenis] = useState<TajwidType>('Tajwid Metode Asy-Syafi\'i');
  const [tajwidCapaian, setTajwidCapaian] = useState('');
  const [tajwidNilai, setTajwidNilai] = useState<string | number>('');

  // Catatan Guru (WAJIB)
  const [catatan, setCatatan] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived Boolean Flags based on Single Choice
  const hasTahsin = setoranChoice === 'tahsin';
  const hasTahfidh = setoranChoice === 'tahfidh';
  const hasTajwid = setoranChoice === 'tajwid';

  // Reset form helper
  const resetForm = () => {
    setTanggal(todayStr);
    setKehadiran('A');
    setSetoranChoice('none');
    
    setTahsinRujukan('Al-Qur\'an');
    setTahsinSuratMulai('Al-Fatihah');
    setTahsinSuratAkhir('Al-Fatihah');
    setTahsinMulai('');
    setTahsinAkhir('');
    setTahsinBabHalaman('');
    setTahsinNilai('');

    setTahfidhJenis('Hafalan Baru (Ziyadah)');
    setTahfidhSuratMulai('An-Naba\'');
    setTahfidhSuratAkhir('An-Naba\'');
    setTahfidhMulai('');
    setTahfidhAkhir('');
    setTahfidhNilai('');

    setTajwidJenis('Tajwid Metode Asy-Syafi\'i');
    setTajwidCapaian('');
    setTajwidNilai('');

    setCatatan('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation 0: Teacher MUST be logged in
    if (!currentUser) {
      onError("Gagal Simpan: Sesi guru belum aktif. Silakan masuk / login terlebih dahulu.");
      return;
    }

    // Validation 1: At least 1 Student MUST be selected
    if (selectedSiswaList.length === 0) {
      onError("Gagal Simpan: Pilih minimal 1 siswa terlebih dahulu dari panel pencarian.");
      return;
    }

    // Validation 2: If multi-select, Tahfidh is NOT allowed
    if (isMultiSelect && hasTahfidh) {
      onError("Setoran Tahfidh hanya untuk input per-siswa individu. Silakan pilih Tahsin atau Tajwid untuk input massal.");
      return;
    }

    // Validation 3: Kehadiran MUST be selected
    if (!kehadiran) {
      onError("Gagal Simpan: Status kehadiran siswa wajib dipilih.");
      return;
    }

    // Validation 4: Catatan Guru is REQUIRED if kehadiran is A, B, or C; otherwise OPTIONAL
    const isCatatanRequired = ['A', 'B', 'C'].includes(kehadiran);
    if (isCatatanRequired && !catatan.trim()) {
      onError("Gagal Simpan: Catatan Guru wajib diisi untuk status A, B, atau C.");
      return;
    }

    // Validation 5: Scores if filled must be between 0 and 100
    if (hasTahsin && tahsinNilai !== '') {
      const val = Number(tahsinNilai);
      if (isNaN(val) || val < 0 || val > 100) {
        onError("Nilai Tahsin harus berupa angka 0 - 100.");
        return;
      }
    }

    if (hasTahfidh && tahfidhNilai !== '') {
      const val = Number(tahfidhNilai);
      if (isNaN(val) || val < 0 || val > 100) {
        onError("Nilai Tahfidh harus berupa angka 0 - 100.");
        return;
      }
    }

    if (hasTajwid && tajwidNilai !== '') {
      const val = Number(tajwidNilai);
      if (isNaN(val) || val < 0 || val > 100) {
        onError("Nilai Tajwid harus berupa angka 0 - 100.");
        return;
      }
    }

    setIsSubmitting(true);

    // Format Tahsin details
    let calculatedTahsinSurat = '';
    let calculatedTahsinAyat = '';
    if (hasTahsin) {
      if (tahsinRujukan === "Al-Qur'an") {
        if (tahsinSuratMulai === tahsinSuratAkhir) {
          calculatedTahsinSurat = tahsinSuratMulai;
          calculatedTahsinAyat = tahsinMulai || tahsinAkhir 
            ? `Ayat ${tahsinMulai || '1'} s.d. ${tahsinAkhir || 'selesai'}`
            : '';
        } else {
          calculatedTahsinSurat = `${tahsinSuratMulai} s.d. ${tahsinSuratAkhir}`;
          calculatedTahsinAyat = `${tahsinSuratMulai} (${tahsinMulai || '1'}) s.d. ${tahsinSuratAkhir} (${tahsinAkhir || 'akhir'})`;
        }
      } else {
        calculatedTahsinSurat = tahsinBabHalaman;
        calculatedTahsinAyat = tahsinBabHalaman;
      }
    }

    // Format Tahfidh details
    let calculatedTahfidhSurat = '';
    let calculatedTahfidhAyat = '';
    if (hasTahfidh) {
      if (tahfidhSuratMulai === tahfidhSuratAkhir) {
        calculatedTahfidhSurat = tahfidhSuratMulai;
        calculatedTahfidhAyat = tahfidhMulai || tahfidhAkhir 
          ? `Ayat ${tahfidhMulai || '1'} s.d. ${tahfidhAkhir || 'selesai'}`
          : '';
      } else {
        calculatedTahfidhSurat = `${tahfidhSuratMulai} s.d. ${tahfidhSuratAkhir}`;
        calculatedTahfidhAyat = `${tahfidhSuratMulai} (${tahfidhMulai || '1'}) s.d. ${tahfidhSuratAkhir} (${tahfidhAkhir || 'akhir'})`;
      }
    }

    const firstStudentNis = selectedSiswaList.length > 0 ? selectedSiswaList[0].ID_Siswa : '';

    const formData: MutabaahFormData = {
      Tanggal_Mutabaah: tanggal,
      ID_Siswa: firstStudentNis, // Will be overridden per student during submit
      Kehadiran: kehadiran,
      
      hasTahsin,
      Tahsin_Rujukan: hasTahsin ? tahsinRujukan : '',
      Tahsin_Surat: calculatedTahsinSurat,
      Tahsin_Ayat: calculatedTahsinAyat,
      Tahsin_Mulai: hasTahsin ? `${tahsinSuratMulai} (${tahsinMulai || '1'})` : '',
      Tahsin_Akhir: hasTahsin ? `${tahsinSuratAkhir} (${tahsinAkhir || 'akhir'})` : '',
      Tahsin_BabHalaman: hasTahsin ? tahsinBabHalaman : '',
      Tahsin_Nilai: hasTahsin ? tahsinNilai : '',

      hasTahfidh,
      Tahfidh_Jenis: hasTahfidh ? tahfidhJenis : '',
      Tahfidh_Surat: calculatedTahfidhSurat,
      Tahfidh_Ayat: calculatedTahfidhAyat,
      Tahfidh_Mulai: hasTahfidh ? `${tahfidhSuratMulai} (${tahfidhMulai || '1'})` : '',
      Tahfidh_Akhir: hasTahfidh ? `${tahfidhSuratAkhir} (${tahfidhAkhir || 'akhir'})` : '',
      Tahfidh_Nilai: hasTahfidh ? tahfidhNilai : '',

      hasTajwid,
      Tajwid_Jenis: hasTajwid ? tajwidJenis : '',
      Tajwid_Capaian: hasTajwid ? tajwidCapaian : '',
      Tajwid_Nilai: hasTajwid ? tajwidNilai : '',

      Catatan: catatan
    };

    setTimeout(() => {
      // Perform save
      onSubmitSuccess(JSON.stringify(formData), selectedSiswaList);
      setIsSubmitting(false);
      resetForm();
    }, 300);
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
      {/* Header Panel A */}
      <div className="bg-[#1E3A8A] px-6 py-4 border-b-2 border-[#D97706] text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F59E0B] text-[#1E3A8A] flex items-center justify-center font-bold">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-extrabold tracking-tight">
              FORM INPUT MUTABAAH
            </h3>
            <p className="text-xs text-blue-200">
              Input data mutabaah harian untuk siswa terpilih
            </p>
          </div>
        </div>
      </div>

      {selectedSiswaList.length === 0 ? (
        <div className="p-8 text-center bg-slate-50">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">
            Siswa Belum Dipilih
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Silakan pilih 1 siswa atau centang sekelas/multiple siswa dari panel pencarian di atas untuk mulai menginput data mutabaah.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          
          {/* Target Student Banner Indicator */}
          <div className="bg-blue-50/80 border border-blue-200/90 rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1E3A8A]" />
              <span className="text-xs font-bold text-[#1E3A8A]">
                Target Input: {selectedSiswaList.length === 1 ? selectedSiswaList[0].Nama_Siswa : `${selectedSiswaList.length} Siswa (Massal / Sekelas)`}
              </span>
            </div>
            <span className="text-[10px] bg-blue-100 font-extrabold text-[#1E3A8A] px-2 py-0.5 rounded">
              {selectedSiswaList.length === 1 ? `NIS: ${selectedSiswaList[0].ID_Siswa}` : `${selectedSiswaList.length} SISWA`}
            </span>
          </div>

          {/* Section 1: Tanggal & Kehadiran (WAJIB) */}
          <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#D97706]" />
                1. Tanggal & Status Kehadiran (Wajib)
              </span>
              <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold">
                REQUIRED
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              {/* Tanggal Mutabaah */}
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tanggal Mutabaah
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none min-h-[42px]"
                  required
                />
              </div>

              {/* Status Kehadiran Dropdown */}
              <div className="flex-1 sm:flex-none sm:w-48">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status Kehadiran <span className="text-rose-600">*</span>
                </label>
                <select
                  value={kehadiran}
                  onChange={(e) => setKehadiran(e.target.value as AttendanceType)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none min-h-[42px]"
                  required
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="Lomba">Lomba</option>
                  <option value="Sakit">Sakit</option>
                  <option value="Izin">Izin</option>
                  <option value="Alpa">Alpa</option>
                </select>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              * Catatan: Guru dapat menginput <span className="font-bold text-slate-700">KEHADIRAN SAJA</span> tanpa mengisi setoran jika siswa tidak melakukan setoran.
            </p>
          </div>

          {/* Section 2: Pilih Maksimal 1 Section Setoran */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#1E3A8A]" />
                2. Setoran (Maksimal 1 Section)
              </span>
              <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                PILIH 1 SAJA
              </span>
            </div>

            {isMultiSelect ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl text-xs flex items-start gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Pilihan Massal ({selectedSiswaList.length} Siswa Terpilih)</span>
                  <span>Input setoran massal memunculkan pilihan <strong>Tahsin</strong> dan <strong>Tajwid</strong> saja.</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Sesuai aturan, guru hanya dapat memilih <strong>satu section setoran</strong> (Tahsin, Tahfidh, atau Tajwid) per inputan:
              </p>
            )}

            {/* Segmented Radio Cards for Single Setoran Choice */}
            <div className={`grid gap-2.5 pt-1 ${isMultiSelect ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {/* Option 0: None (Hanya dimunculkan untuk input individu 1 siswa) */}
              {!isMultiSelect && (
                <button
                  type="button"
                  onClick={() => setSetoranChoice('none')}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    setoranChoice === 'none'
                      ? 'bg-slate-800 text-white border-slate-900 shadow-md ring-2 ring-slate-800'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-[11px] font-bold block">Tanpa Setoran</span>
                  <span className={`text-[10px] block mt-1 ${setoranChoice === 'none' ? 'text-slate-300' : 'text-slate-500'}`}>
                    Kehadiran Saja
                  </span>
                </button>
              )}

              {/* Option 1: Tahsin */}
              <button
                type="button"
                onClick={() => setSetoranChoice('tahsin')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  setoranChoice === 'tahsin'
                    ? 'bg-[#1E3A8A] text-white border-blue-900 shadow-md ring-2 ring-blue-800'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold">Tahsin</span>
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <span className={`text-[10px] block mt-1 ${setoranChoice === 'tahsin' ? 'text-blue-200' : 'text-slate-500'}`}>
                  Al-Qur'an / Iqro
                </span>
              </button>

              {/* Option 2: Tahfidh (Hanya dimunculkan untuk input individu 1 siswa) */}
              {!isMultiSelect && (
                <button
                  type="button"
                  onClick={() => setSetoranChoice('tahfidh')}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    setoranChoice === 'tahfidh'
                      ? 'bg-[#D97706] text-white border-amber-800 shadow-md ring-2 ring-amber-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                  }`}
                  title="Setoran Tahfidh"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold">Tahfidh</span>
                    <Award className="w-3.5 h-3.5 text-amber-200" />
                  </div>
                  <span className={`text-[10px] block mt-1 ${setoranChoice === 'tahfidh' ? 'text-amber-100' : 'text-slate-500'}`}>
                    Hafalan / Muroja'ah
                  </span>
                </button>
              )}

              {/* Option 3: Tajwid */}
              <button
                type="button"
                onClick={() => setSetoranChoice('tajwid')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  setoranChoice === 'tajwid'
                    ? 'bg-purple-800 text-white border-purple-900 shadow-md ring-2 ring-purple-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold">Tajwid</span>
                  <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                </div>
                <span className={`text-[10px] block mt-1 ${setoranChoice === 'tajwid' ? 'text-purple-200' : 'text-slate-500'}`}>
                  Metode Asy-Syafi'i
                </span>
              </button>
            </div>
          </div>

          {/* Render Active Setoran Section Fields conditionally */}
          {hasTahsin && (
            <div className="p-4 rounded-xl border bg-blue-50/50 border-blue-300 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                <span className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-sky-600" />
                  Detail Setoran Tahsin
                </span>
                <span className="text-[10px] bg-blue-100 text-[#1E3A8A] font-bold px-2 py-0.5 rounded">
                  AKTIF
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rujukan Tahsin
                </label>
                <select
                  value={tahsinRujukan}
                  onChange={(e) => setTahsinRujukan(e.target.value as TahsinReference)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#1E3A8A]"
                >
                  <option value="Al-Qur'an">Al-Qur'an</option>
                  <option value="Iqro">Iqro</option>
                  <option value="Qoidah Nuroniyyah">Qoidah Nuroniyyah</option>
                </select>
              </div>

              {tahsinRujukan === "Al-Qur'an" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/80 p-3.5 rounded-xl border border-blue-100 shadow-xs">
                  {/* Setoran Mulai */}
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-bold text-[#1E3A8A] uppercase tracking-wide flex items-center gap-1">
                      <span>📍 Setoran Mulai</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Surat Setoran Mulai
                      </label>
                      <select
                        value={tahsinSuratMulai}
                        onChange={(e) => handleTahsinSuratMulaiChange(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#1E3A8A]"
                      >
                        {suratList.map((s) => (
                          <option key={s.No_Surat} value={s.Nama_Surat}>
                            {s.No_Surat}. {s.Nama_Surat} ({s.Jumlah_Ayat} Ayat)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Ayat Mulai
                      </label>
                      <input
                        type="text"
                        value={tahsinMulai}
                        onChange={(e) => setTahsinMulai(e.target.value)}
                        placeholder="contoh: Ayat 1 atau Hal 12"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#1E3A8A]"
                      />
                    </div>
                  </div>

                  {/* Setoran Akhir */}
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-bold text-[#1E3A8A] uppercase tracking-wide flex items-center gap-1">
                      <span>🏁 Setoran Akhir</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Surat Setoran Akhir
                      </label>
                      <select
                        value={tahsinSuratAkhir}
                        onChange={(e) => setTahsinSuratAkhir(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#1E3A8A]"
                      >
                        {suratList.map((s) => (
                          <option key={s.No_Surat} value={s.Nama_Surat}>
                            {s.No_Surat}. {s.Nama_Surat} ({s.Jumlah_Ayat} Ayat)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Ayat Akhir
                      </label>
                      <input
                        type="text"
                        value={tahsinAkhir}
                        onChange={(e) => setTahsinAkhir(e.target.value)}
                        placeholder="contoh: Ayat 15 atau Hal 15"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#1E3A8A]"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bab & Halaman ({tahsinRujukan})
                  </label>
                  <input
                    type="text"
                    value={tahsinBabHalaman}
                    onChange={(e) => setTahsinBabHalaman(e.target.value)}
                    placeholder="contoh: Jilid 3, Hal 12 - 15"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#1E3A8A]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nilai Tahsin (Integer 0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={tahsinNilai}
                  onChange={(e) => setTahsinNilai(e.target.value)}
                  placeholder="Nilai (0-100)"
                  className="w-full sm:w-1/2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#1E3A8A]"
                />
              </div>
            </div>
          )}

          {hasTahfidh && (
            <div className="p-4 rounded-xl border bg-amber-50/50 border-amber-300 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <span className="text-xs font-bold text-[#D97706] uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-600" />
                  Detail Setoran Tahfidh
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">
                  AKTIF
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jenis Hafalan
                </label>
                <select
                  value={tahfidhJenis}
                  onChange={(e) => setTahfidhJenis(e.target.value as TahfidhType)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#D97706]"
                >
                  <option value="Hafalan Baru (Ziyadah)">Hafalan Baru (Ziyadah)</option>
                  <option value="Hafalan Lama (Muroja'ah)">Hafalan Lama (Muroja'ah)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/80 p-3.5 rounded-xl border border-amber-200 shadow-xs">
                {/* Setoran Mulai */}
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold text-[#D97706] uppercase tracking-wide flex items-center gap-1">
                    <span>📍 Setoran Mulai</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Surat Setoran Mulai
                    </label>
                    <select
                      value={tahfidhSuratMulai}
                      onChange={(e) => handleTahfidhSuratMulaiChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#D97706]"
                    >
                      {suratList.map((s) => (
                        <option key={s.No_Surat} value={s.Nama_Surat}>
                          {s.No_Surat}. {s.Nama_Surat} ({s.Jumlah_Ayat} Ayat)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Ayat Mulai
                    </label>
                    <input
                      type="text"
                      value={tahfidhMulai}
                      onChange={(e) => setTahfidhMulai(e.target.value)}
                      placeholder="contoh: Ayat 1"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#D97706]"
                    />
                  </div>
                </div>

                {/* Setoran Akhir */}
                <div className="space-y-2.5">
                  <div className="text-[11px] font-bold text-[#D97706] uppercase tracking-wide flex items-center gap-1">
                    <span>🏁 Setoran Akhir</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Surat Setoran Akhir
                    </label>
                    <select
                      value={tahfidhSuratAkhir}
                      onChange={(e) => setTahfidhSuratAkhir(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#D97706]"
                    >
                      {suratList.map((s) => (
                        <option key={s.No_Surat} value={s.Nama_Surat}>
                          {s.No_Surat}. {s.Nama_Surat} ({s.Jumlah_Ayat} Ayat)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Ayat Akhir
                    </label>
                    <input
                      type="text"
                      value={tahfidhAkhir}
                      onChange={(e) => setTahfidhAkhir(e.target.value)}
                      placeholder="contoh: Ayat 20"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#D97706]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nilai Tahfidh (Integer 0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={tahfidhNilai}
                  onChange={(e) => setTahfidhNilai(e.target.value)}
                  placeholder="Nilai (0-100)"
                  className="w-full sm:w-1/2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#D97706]"
                />
              </div>
            </div>
          )}

          {hasTajwid && (
            <div className="p-4 rounded-xl border bg-purple-50/50 border-purple-300 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                <span className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Detail Setoran Tajwid
                </span>
                <span className="text-[10px] bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded">
                  AKTIF
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jenis Metode Tajwid
                </label>
                <select
                  value={tajwidJenis}
                  onChange={(e) => setTajwidJenis(e.target.value as TajwidType)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-600"
                >
                  <option value="Tajwid Metode Asy-Syafi'i">Tajwid Metode Asy-Syafi'i</option>
                  <option value="Tuhfatul Athfal">Tuhfatul Athfal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Capaian Bab & Halaman
                </label>
                <input
                  type="text"
                  value={tajwidCapaian}
                  onChange={(e) => setTajwidCapaian(e.target.value)}
                  placeholder="contoh: Bab Hukum Nun Mati Hal. 12"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nilai Tajwid (Integer 0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={tajwidNilai}
                  onChange={(e) => setTajwidNilai(e.target.value)}
                  placeholder="Nilai (0-100)"
                  className="w-full sm:w-1/2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-600"
                />
              </div>
            </div>
          )}


          {/* Section 3: Section Catatan Guru (DI PALING AKHIR FORM) */}
          {(() => {
            const isCatatanRequired = ['A', 'B', 'C'].includes(kehadiran);
            return (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    3. Catatan Guru {isCatatanRequired ? '(Wajib)' : '(Opsional)'} {isCatatanRequired && <span className="text-rose-600">*</span>}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    isCatatanRequired ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {isCatatanRequired ? 'REQUIRED' : 'OPSIONAL'}
                  </span>
                </div>

                <textarea
                  rows={3}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder={
                    isCatatanRequired
                      ? "Tuliskan catatan khusus guru mengenai perkembangan bacaan, adab, kelancaran... (Wajib diisi)"
                      : "Tuliskan catatan khusus guru (Opsional)..."
                  }
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#1E3A8A] focus:outline-none"
                  required={isCatatanRequired}
                />
              </div>
            );
          })()}


          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 bg-[#1E3A8A] hover:bg-blue-900 text-white font-extrabold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all border border-[#F59E0B]/40 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#F59E0B]" />
                  Menyimpan Data Mutabaah...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-[#F59E0B]" />
                  {selectedSiswaList.length > 1
                    ? 'Simpan Mutabaah Massal'
                    : selectedSiswaList.length === 1
                    ? 'Simpan Mutabaah'
                    : 'Pilih Siswa Terlebih Dahulu'}
                </>
              )}
            </button>
          </div>

        </form>
      )}

    </div>
  );
};
