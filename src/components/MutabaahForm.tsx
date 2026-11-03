import React, { useState, useEffect } from 'react';
import { MasterSiswa, MasterSurat, MasterUser, LogMutabaah, AttendanceType, TahsinReference, TahfidhType, TajwidType, MutabaahFormData } from '../types';
import { MutabaahService } from '../services/mutabaahService';
import { Calendar, BookOpen, Award, Sparkles, MessageSquare, Save, AlertCircle, RefreshCw, Users } from 'lucide-react';

interface MutabaahFormProps {
  selectedSiswaList: MasterSiswa[];
  suratList: MasterSurat[];
  currentUser: MasterUser | null;
  onSubmitSuccess: (formDataJson: string, targetList: MasterSiswa[]) => void;
  onError: (msg: string) => void;
  editingLog?: LogMutabaah | null;
  onCancelEdit?: () => void;
}

export const MutabaahForm: React.FC<MutabaahFormProps> = ({
  selectedSiswaList,
  suratList,
  currentUser,
  onSubmitSuccess,
  onError,
  editingLog,
  onCancelEdit
}) => {
  // Form State
  const todayStr = (() => {
    const n = new Date();
    const p = (v: number) => String(v).padStart(2, '0');
    return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
  })();
  const [tanggal, setTanggal] = useState(todayStr);
  const [kehadiran, setKehadiran] = useState<AttendanceType>('A');

  // True when student is present (A/B/C); setoran fields are required only in this case
  const isHadir = ['A', 'B', 'C'].includes(kehadiran);

  // Multi-select flag
  const isMultiSelect = selectedSiswaList.length > 1;

  // Single Setoran Selection State: Teacher can ONLY pick ONE setoran type maximum
  type SetoranChoice = 'none' | 'tahsin' | 'tahfidh' | 'tajwid';
  const [setoranChoice, setSetoranChoice] = useState<SetoranChoice>('none');

  // Auto switch off Tahfidh or None if teacher selects multiple students (only when present)
  useEffect(() => {
    if (isMultiSelect && isHadir && (setoranChoice === 'tahfidh' || setoranChoice === 'none')) {
      setSetoranChoice('tahsin');
    }
  }, [isMultiSelect, isHadir, setoranChoice]);

  // When student is absent, only "Tanpa Setoran" is allowed
  useEffect(() => {
    if (!isHadir && setoranChoice !== 'none') {
      setSetoranChoice('none');
    }
  }, [isHadir, setoranChoice]);

  // Helper: parse stored "Surat (ayat)" format back to { surat, ayat }
  const parseMulaiAkhir = (val: string | undefined): { surat: string; ayat: string } => {
    if (!val) return { surat: '', ayat: '' };
    const match = val.match(/^(.+?) \((\d+|akhir)\)$/);
    if (match) return { surat: match[1], ayat: match[2] };
    return { surat: '', ayat: '' };
  };

  // Helper: parse detail "Mulai: Surat (ayat) s.d. Akhir: Surat (ayat)" stored in
  // Tahsin_Capaian_Detail / Tahfidh_Ayat (the sheet has no *_Mulai columns).
  const parseDetailMulaiAkhir = (val: string | undefined): { mulai: { surat: string; ayat: string }; akhir: { surat: string; ayat: string } } | null => {
    if (!val) return null;
    const match = val.trim().match(/^Mulai:\s*(.+?)\s*\((\d+|akhir)\)\s*s\.d\.\s*Akhir:\s*(.+?)\s*\((\d+|akhir)\)$/);
    if (!match) return null;
    return {
      mulai: { surat: match[1].trim(), ayat: match[2] },
      akhir: { surat: match[3].trim(), ayat: match[4] },
    };
  };

  // Prefer the explicit *_Mulai value; fall back to the parsed detail when empty.
  const pickSuratAyat = (stored: string | undefined, fallbackSurat?: string, fallbackAyat?: string): { surat: string; ayat: string } => {
    const p = parseMulaiAkhir(MutabaahService.repairCorruptedMulaiAkhir(stored || ''));
    if (p.surat || p.ayat) return p;
    return { surat: fallbackSurat || '', ayat: fallbackAyat || '' };
  };

  // Pre-fill form when editingLog is set, reset to defaults when canceled (null)
  useEffect(() => {
    if (!editingLog) {
      // Reset all fields to initial state
      setTanggal(todayStr);
      setKehadiran('A');
      setSetoranChoice('none');
      setCatatan('');
      setTahsinRujukan('Al-Qur\'an');
      setTahsinSuratMulai('Al-Fatihah');
      setTahsinSuratAkhir('Al-Fatihah');
      setTahsinMulai('');
      setTahsinAkhir('');
      setTahsinBabHalaman('');
      setTahsinNilai('');
      setTahfidhJenis('Hafalan Baru (Ziyadah)');
      setTahfidhSuratMulai('Al-Fatihah');
      setTahfidhSuratAkhir('Al-Fatihah');
      setTahfidhMulai('');
      setTahfidhAkhir('');
      setTahfidhNilai('');
      setTajwidJenis('Tajwid Metode Asy-Syafi\'i');
      setTajwidCapaian('');
      setTajwidNilai('');
      setTahsinMulaiError('');
      setTahsinAkhirError('');
      setTahfidhMulaiError('');
      setTahfidhAkhirError('');
      return;
    }
    setTanggal(editingLog.Tanggal_Mutabaah || todayStr);
    setKehadiran(editingLog.Kehadiran || 'A');
    setCatatan(editingLog.Catatan || '');

    // Determine setoran choice
    if (editingLog.Tahsin_Rujukan || editingLog.Tahsin_Capaian_SuratBab) {
      setSetoranChoice('tahsin');
      setTahsinRujukan((editingLog.Tahsin_Rujukan as TahsinReference) || 'Al-Qur\'an');

      const tDetail = parseDetailMulaiAkhir(editingLog.Tahsin_Capaian_Detail);
      const tMulai = pickSuratAyat(editingLog.Tahsin_Mulai, tDetail?.mulai.surat, tDetail?.mulai.ayat);
      const tAkhir = pickSuratAyat(editingLog.Tahsin_Akhir, tDetail?.akhir.surat, tDetail?.akhir.ayat);
      setTahsinSuratMulai(tMulai.surat || editingLog.Tahsin_Capaian_SuratBab || 'Al-Fatihah');
      setTahsinSuratAkhir(tAkhir.surat || editingLog.Tahsin_Capaian_SuratBab || 'Al-Fatihah');
      setTahsinMulai(tMulai.ayat || '');
      setTahsinAkhir(tAkhir.ayat || '');
      setTahsinBabHalaman(editingLog.Tahsin_Capaian_SuratBab || '');
      setTahsinNilai(editingLog.Tahsin_Nilai ?? '');
    } else if (editingLog.Tahfidh_Jenis || editingLog.Tahfidh_Surat) {
      setSetoranChoice('tahfidh');
      setTahfidhJenis((editingLog.Tahfidh_Jenis as TahfidhType) || 'Hafalan Baru (Ziyadah)');

      const hDetail = parseDetailMulaiAkhir(editingLog.Tahfidh_Ayat);
      const hMulai = pickSuratAyat(editingLog.Tahfidh_Mulai, hDetail?.mulai.surat, hDetail?.mulai.ayat);
      const hAkhir = pickSuratAyat(editingLog.Tahfidh_Akhir, hDetail?.akhir.surat, hDetail?.akhir.ayat);
      setTahfidhSuratMulai(hMulai.surat || editingLog.Tahfidh_Surat || 'Al-Fatihah');
      setTahfidhSuratAkhir(hAkhir.surat || editingLog.Tahfidh_Surat || 'Al-Fatihah');
      setTahfidhMulai(hMulai.ayat || '');
      setTahfidhAkhir(hAkhir.ayat || '');
      setTahfidhNilai(editingLog.Tahfidh_Nilai ?? '');
    } else if (editingLog.Tajwid_Jenis || editingLog.Tajwid_Capaian) {
      setSetoranChoice('tajwid');
      setTajwidJenis((editingLog.Tajwid_Jenis as TajwidType) || 'Tajwid Metode Asy-Syafi\'i');
      setTajwidCapaian(editingLog.Tajwid_Capaian || '');
      setTajwidNilai(editingLog.Tajwid_Nilai ?? '');
    } else {
      setSetoranChoice('none');
    }
  }, [editingLog, todayStr]);

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
  const [tahfidhSuratMulai, setTahfidhSuratMulai] = useState('Al-Fatihah');
  const [tahfidhSuratAkhir, setTahfidhSuratAkhir] = useState('Al-Fatihah');
  const [tahfidhMulai, setTahfidhMulai] = useState('');
  const [tahfidhAkhir, setTahfidhAkhir] = useState('');
  const [tahfidhNilai, setTahfidhNilai] = useState<string | number>('');

  // Handlers for Surah Mulai Change (auto-sync Surah Akhir initially + re-validate ayat)
  const handleTahsinSuratMulaiChange = (surat: string) => {
    setTahsinSuratMulai(surat);
    setTahsinSuratAkhir(surat);
    const maxAyat = getMaxAyat(surat);
    setTahsinMulaiError(validateAyat(tahsinMulai, maxAyat));
    setTahsinAkhirError(validateAyat(tahsinAkhir, maxAyat));
  };

  const handleTahfidhSuratMulaiChange = (surat: string) => {
    setTahfidhSuratMulai(surat);
    setTahfidhSuratAkhir(surat);
    const maxAyat = getMaxAyat(surat);
    setTahfidhMulaiError(validateAyat(tahfidhMulai, maxAyat));
    setTahfidhAkhirError(validateAyat(tahfidhAkhir, maxAyat));
  };

  // Details for Setoran Tajwid
  const [tajwidJenis, setTajwidJenis] = useState<TajwidType>('Tajwid Metode Asy-Syafi\'i');
  const [tajwidCapaian, setTajwidCapaian] = useState('');
  const [tajwidNilai, setTajwidNilai] = useState<string | number>('');

  // Catatan Guru (WAJIB)
  const [catatan, setCatatan] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ayat validation error states
  const [tahsinMulaiError, setTahsinMulaiError] = useState('');
  const [tahsinAkhirError, setTahsinAkhirError] = useState('');
  const [tahfidhMulaiError, setTahfidhMulaiError] = useState('');
  const [tahfidhAkhirError, setTahfidhAkhirError] = useState('');

  // Helper: get max ayat for a surat name
  const getMaxAyat = (suratName: string): number | null => {
    const surat = suratList.find(s => s.Nama_Surat === suratName);
    return surat ? surat.Jumlah_Ayat : null;
  };

  // Validate ayat number against max
  const validateAyat = (value: string, maxAyat: number | null): string => {
    if (!value || !maxAyat) return '';
    const num = parseInt(value, 10);
    if (isNaN(num)) return 'Harus berupa angka';
    if (num < 1) return 'Minimal angka 1';
    if (num > maxAyat) return `Maksimal ${maxAyat} ayat`;
    return '';
  };

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
    setTahfidhSuratMulai('Al-Fatihah');
    setTahfidhSuratAkhir('Al-Fatihah');
    setTahfidhMulai('');
    setTahfidhAkhir('');
    setTahfidhNilai('');

    setTajwidJenis('Tajwid Metode Asy-Syafi\'i');
    setTajwidCapaian('');
    setTajwidNilai('');

    setCatatan('');
    setTahsinMulaiError('');
    setTahsinAkhirError('');
    setTahfidhMulaiError('');
    setTahfidhAkhirError('');
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
    const isCatatanRequired = isHadir;
    if (isCatatanRequired && !catatan.trim()) {
      onError("Gagal Simpan: Catatan Guru wajib diisi untuk status A, B, atau C.");
      return;
    }

    // Validation 5: Scores are REQUIRED when student is present; must be between 0 and 100 if filled
    if (hasTahsin) {
      if (isHadir && tahsinNilai === '') {
        onError("Nilai Tahsin wajib diisi.");
        return;
      }
      if (tahsinNilai !== '') {
        const val = Number(tahsinNilai);
        if (isNaN(val) || val < 0 || val > 100) {
          onError("Nilai Tahsin harus berupa angka 0 - 100.");
          return;
        }
      }
    }

    if (hasTahfidh) {
      if (isHadir && tahfidhNilai === '') {
        onError("Nilai Tahfidh wajib diisi.");
        return;
      }
      if (tahfidhNilai !== '') {
        const val = Number(tahfidhNilai);
        if (isNaN(val) || val < 0 || val > 100) {
          onError("Nilai Tahfidh harus berupa angka 0 - 100.");
          return;
        }
      }
    }

    if (hasTajwid) {
      if (isHadir && tajwidNilai === '') {
        onError("Nilai Tajwid wajib diisi.");
        return;
      }
      if (tajwidNilai !== '') {
        const val = Number(tajwidNilai);
        if (isNaN(val) || val < 0 || val > 100) {
          onError("Nilai Tajwid harus berupa angka 0 - 100.");
          return;
        }
      }
    }

    // Validation 6: Ayat numbers must not exceed max ayat for selected surat
    if (hasTahsin && tahsinRujukan === "Al-Qur'an") {
      const mulaiErr = validateAyat(tahsinMulai, getMaxAyat(tahsinSuratMulai));
      const akhirErr = validateAyat(tahsinAkhir, getMaxAyat(tahsinSuratAkhir));
      if (mulaiErr) {
        onError(`Ayat Mulai Tahsin: ${mulaiErr}`);
        return;
      }
      if (akhirErr) {
        onError(`Ayat Akhir Tahsin: ${akhirErr}`);
        return;
      }
    }

    if (hasTahfidh) {
      const mulaiErr = validateAyat(tahfidhMulai, getMaxAyat(tahfidhSuratMulai));
      const akhirErr = validateAyat(tahfidhAkhir, getMaxAyat(tahfidhSuratAkhir));
      if (mulaiErr) {
        onError(`Ayat Mulai Tahfidh: ${mulaiErr}`);
        return;
      }
      if (akhirErr) {
        onError(`Ayat Akhir Tahfidh: ${akhirErr}`);
        return;
      }
    }

    // Validation 7: Setoran detail fields are REQUIRED when student is present (A/B/C)
    if (isHadir) {
      if (hasTahsin) {
        if (tahsinRujukan === "Al-Qur'an") {
          if (!tahsinMulai) {
            onError("Ayat Mulai Tahsin wajib diisi.");
            return;
          }
          if (!tahsinAkhir) {
            onError("Ayat Akhir Tahsin wajib diisi.");
            return;
          }
        } else if (!tahsinBabHalaman.trim()) {
          onError("Bab & Halaman Tahsin wajib diisi.");
          return;
        }
      }
      if (hasTahfidh) {
        if (!tahfidhMulai) {
          onError("Ayat Mulai Tahfidh wajib diisi.");
          return;
        }
        if (!tahfidhAkhir) {
          onError("Ayat Akhir Tahfidh wajib diisi.");
          return;
        }
      }
      if (hasTajwid && !tajwidCapaian.trim()) {
        onError("Capaian Bab & Halaman Tajwid wajib diisi.");
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
                  {isHadir ? (
                    <span>Input setoran massal memunculkan pilihan <strong>Tahsin</strong> dan <strong>Tajwid</strong> saja.</span>
                  ) : (
                    <span>Siswa tidak hadir, hanya bisa input <strong>Tanpa Setoran</strong> (Kehadiran saja).</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Sesuai aturan, guru hanya dapat memilih <strong>satu section setoran</strong> (Tahsin, Tahfidh, atau Tajwid) per inputan:
              </p>
            )}

            {!isHadir && !isMultiSelect && (
              <p className="text-[11px] bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg font-medium">
                Siswa tidak hadir — setoran dinonaktifkan. Hanya bisa input kehadiran & catatan.
              </p>
            )}

            {/* Segmented Radio Cards for Single Setoran Choice */}
            <div className={`grid gap-2.5 pt-1 ${isMultiSelect ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {/* Option 0: None (Hanya dimunculkan untuk input individu 1 siswa / siswa tidak hadir) */}
              {(!isMultiSelect || !isHadir) && (
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
                disabled={!isHadir}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  !isHadir
                    ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                    : setoranChoice === 'tahsin'
                      ? 'bg-[#1E3A8A] text-white border-blue-900 shadow-md ring-2 ring-blue-800'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold">Tahsin</span>
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                </div>
              </button>

              {/* Option 2: Tahfidh (Hanya dimunculkan untuk input individu 1 siswa) */}
              {!isMultiSelect && (
                <button
                  type="button"
                  onClick={() => setSetoranChoice('tahfidh')}
                  disabled={!isHadir}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    !isHadir
                      ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                      : setoranChoice === 'tahfidh'
                        ? 'bg-[#D97706] text-white border-amber-800 shadow-md ring-2 ring-amber-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50'
                  }`}
                  title="Setoran Tahfidh"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold">Tahfidh</span>
                    <Award className="w-3.5 h-3.5 text-amber-200" />
                  </div>
                </button>
              )}

              {/* Option 3: Tajwid */}
              <button
                type="button"
                onClick={() => setSetoranChoice('tajwid')}
                disabled={!isHadir}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  !isHadir
                    ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                    : setoranChoice === 'tajwid'
                      ? 'bg-purple-800 text-white border-purple-900 shadow-md ring-2 ring-purple-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold">Tajwid</span>
                  <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                </div>
              </button>
            </div>
          </div>

          {/* Render Active Setoran Section Fields conditionally */}
          {hasTahsin && isHadir && (
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
                        Ayat Mulai {isHadir && <span className="text-rose-600">*</span>}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={getMaxAyat(tahsinSuratMulai) || undefined}
                        required={isHadir}
                        value={tahsinMulai}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        onChange={(e) => {
                          setTahsinMulai(e.target.value);
                          setTahsinMulaiError(validateAyat(e.target.value, getMaxAyat(tahsinSuratMulai)));
                        }}
                        placeholder={`1 - ${getMaxAyat(tahsinSuratMulai) || '?'}`}
                        className={`w-full px-3 py-2 bg-white border rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#1E3A8A] ${tahsinMulaiError ? 'border-red-400' : 'border-slate-300'}`}
                      />
                      {tahsinMulaiError && (
                        <p className="text-[10px] text-red-500 mt-1 font-medium">{tahsinMulaiError}</p>
                      )}
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
                        onChange={(e) => {
                          setTahsinSuratAkhir(e.target.value);
                          setTahsinAkhirError(validateAyat(tahsinAkhir, getMaxAyat(e.target.value)));
                        }}
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
                        Ayat Akhir {isHadir && <span className="text-rose-600">*</span>}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={getMaxAyat(tahsinSuratAkhir) || undefined}
                        required={isHadir}
                        value={tahsinAkhir}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        onChange={(e) => {
                          setTahsinAkhir(e.target.value);
                          setTahsinAkhirError(validateAyat(e.target.value, getMaxAyat(tahsinSuratAkhir)));
                        }}
                        placeholder={`1 - ${getMaxAyat(tahsinSuratAkhir) || '?'}`}
                        className={`w-full px-3 py-2 bg-white border rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#1E3A8A] ${tahsinAkhirError ? 'border-red-400' : 'border-slate-300'}`}
                      />
                      {tahsinAkhirError && (
                        <p className="text-[10px] text-red-500 mt-1 font-medium">{tahsinAkhirError}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bab & Halaman ({tahsinRujukan}) {isHadir && <span className="text-rose-600">*</span>}
                  </label>
                  <input
                    type="text"
                    required={isHadir}
                    value={tahsinBabHalaman}
                    onChange={(e) => setTahsinBabHalaman(e.target.value)}
                    placeholder="contoh: Jilid 3, Hal 12 - 15"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#1E3A8A]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nilai Tahsin (0 - 100) {isHadir && <span className="text-rose-600">*</span>}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required={isHadir}
                  value={tahsinNilai}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={(e) => setTahsinNilai(e.target.value)}
                  placeholder="Nilai (0-100)"
                  className="w-full sm:w-1/2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#1E3A8A]"
                />
              </div>
            </div>
          )}

          {hasTahfidh && isHadir && (
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
                      Ayat Mulai {isHadir && <span className="text-rose-600">*</span>}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={getMaxAyat(tahfidhSuratMulai) || undefined}
                      required={isHadir}
                      value={tahfidhMulai}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      onChange={(e) => {
                        setTahfidhMulai(e.target.value);
                        setTahfidhMulaiError(validateAyat(e.target.value, getMaxAyat(tahfidhSuratMulai)));
                      }}
                      placeholder={`1 - ${getMaxAyat(tahfidhSuratMulai) || '?'}`}
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#D97706] ${tahfidhMulaiError ? 'border-red-400' : 'border-slate-300'}`}
                    />
                    {tahfidhMulaiError && (
                      <p className="text-[10px] text-red-500 mt-1 font-medium">{tahfidhMulaiError}</p>
                    )}
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
                      onChange={(e) => {
                        setTahfidhSuratAkhir(e.target.value);
                        setTahfidhAkhirError(validateAyat(tahfidhAkhir, getMaxAyat(e.target.value)));
                      }}
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
                      Ayat Akhir {isHadir && <span className="text-rose-600">*</span>}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={getMaxAyat(tahfidhSuratAkhir) || undefined}
                      required={isHadir}
                      value={tahfidhAkhir}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      onChange={(e) => {
                        setTahfidhAkhir(e.target.value);
                        setTahfidhAkhirError(validateAyat(e.target.value, getMaxAyat(tahfidhSuratAkhir)));
                      }}
                      placeholder={`1 - ${getMaxAyat(tahfidhSuratAkhir) || '?'}`}
                      className={`w-full px-3 py-2 bg-white border rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#D97706] ${tahfidhAkhirError ? 'border-red-400' : 'border-slate-300'}`}
                    />
                    {tahfidhAkhirError && (
                      <p className="text-[10px] text-red-500 mt-1 font-medium">{tahfidhAkhirError}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nilai Tahfidh (0 - 100) {isHadir && <span className="text-rose-600">*</span>}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required={isHadir}
                  value={tahfidhNilai}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={(e) => setTahfidhNilai(e.target.value)}
                  placeholder="Nilai (0-100)"
                  className="w-full sm:w-1/2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#D97706]"
                />
              </div>
            </div>
          )}

          {hasTajwid && isHadir && (
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
                  Capaian Bab & Halaman {isHadir && <span className="text-rose-600">*</span>}
                </label>
                <input
                  type="text"
                  required={isHadir}
                  value={tajwidCapaian}
                  onChange={(e) => setTajwidCapaian(e.target.value)}
                  placeholder="contoh: Bab Hukum Nun Mati Hal. 12"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nilai Tajwid (0 - 100) {isHadir && <span className="text-rose-600">*</span>}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required={isHadir}
                  value={tajwidNilai}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
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
          <div className="pt-2 space-y-2">
            {editingLog && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="w-full py-2.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl border border-slate-300 transition-all active:scale-95"
              >
                Batal Edit
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 bg-[#1E3A8A] hover:bg-blue-900 text-white font-extrabold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all border border-[#F59E0B]/40 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#F59E0B]" />
                  {editingLog ? 'Memperbarui Data...' : 'Menyimpan Data Mutabaah...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-[#F59E0B]" />
                  {editingLog
                    ? 'Update Mutabaah'
                    : selectedSiswaList.length > 1
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
