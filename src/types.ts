export interface MasterUser {
  ID_User: string;
  Email: string;
  Nama_Guru: string;
}

export interface MasterSiswa {
  ID_Siswa: string; // NIS (Primary Key)
  Nama_Siswa: string;
  Kelas: string;
  Kelompok_Halaqah: string;
  Gender: string;
  Guru?: string; // Nama guru pengampu (kolom Guru di Master_Siswa)
  Gender_Guru?: string; // L / P (kolom Gender_Guru di Master_Siswa) untuk sapaan Ust./Ustz.
}

// Plot guru Rumah Tahfidh. Header sheet disamakan dengan Master_Siswa.
export type RumahTahfidhPlot = MasterSiswa;

// Mode penentuan guru pada Broadcast Reminder.
// - normal: semua siswa memakai plot Master_Siswa + jadwal pelajaran.
// - ikhwan: siswa ikhwan memakai plot Rumah_Tahfidh tanpa jadwal;
//           siswa akhwat tetap memakai mode normal.
// - akhwat: kebalikannya.
export type BroadcastMode = 'normal' | 'ikhwan' | 'akhwat';

export interface JadwalPelajaran {
  Hari: string;
  Waktu_Mulai: string;
  Waktu_Selesai: string;
  ID_Kelas: string;
  Mapel: string;
  Guru: string; // bisa berisi >1 guru, mis. "PUTRA RIZKIANSYAH & ANGGA PURNAMA"
}

export interface MasterSurat {
  No_Surat: number;
  Nama_Surat: string;
  Jumlah_Ayat: number;
}

export type AttendanceType = 'A' | 'B' | 'C' | 'Lomba' | 'Sakit' | 'Izin' | 'Alpa';

export type TahsinReference = 'Al-Qur\'an' | 'Iqro' | 'Qoidah Nuroniyyah';

export type TahfidhType = 'Hafalan Baru (Ziyadah)' | 'Hafalan Lama (Muroja\'ah)';

export type TajwidType = 'Tajwid Metode Asy-Syafi\'i' | 'Tuhfatul Athfal';

export interface LogMutabaah {
  ID_Log: string;
  Timestamp: string;
  Tanggal_Mutabaah: string;
  Email_Guru: string;
  Nama_Guru: string;
  ID_Siswa: string; // NIS
  Nama_Siswa: string;
  Kehadiran: AttendanceType;
  
  // Tahsin
  Tahsin_Rujukan?: TahsinReference | '';
  Tahsin_Capaian_SuratBab?: string;
  Tahsin_Capaian_Detail?: string;
  Tahsin_Mulai?: string;
  Tahsin_Akhir?: string;
  Tahsin_Nilai?: number | null;
  
  // Tahfidh
  Tahfidh_Jenis?: TahfidhType | '';
  Tahfidh_Surat?: string;
  Tahfidh_Ayat?: string;
  Tahfidh_Mulai?: string;
  Tahfidh_Akhir?: string;
  Tahfidh_Nilai?: number | null;
  
  // Tajwid
  Tajwid_Jenis?: TajwidType | '';
  Tajwid_Capaian?: string;
  Tajwid_Nilai?: number | null;
  
  // Catatan Guru (Column at the far end)
  Catatan?: string;
}

export interface MutabaahFormData {
  Tanggal_Mutabaah: string;
  ID_Siswa: string; // NIS
  Kehadiran: AttendanceType;
  
  // Tahsin Section
  hasTahsin: boolean;
  Tahsin_Rujukan: TahsinReference | '';
  Tahsin_Surat: string; // If Al-Qur'an
  Tahsin_Ayat: string;  // Combined / formatted
  Tahsin_Mulai?: string; // Setoran Mulai
  Tahsin_Akhir?: string; // Setoran Akhir
  Tahsin_BabHalaman: string; // If Iqro / Qoidah Nuroniyyah
  Tahsin_Nilai: string | number;
  
  // Tahfidh Section
  hasTahfidh: boolean;
  Tahfidh_Jenis: TahfidhType | '';
  Tahfidh_Surat: string;
  Tahfidh_Ayat: string;  // Combined / formatted
  Tahfidh_Mulai?: string; // Setoran Mulai
  Tahfidh_Akhir?: string; // Setoran Akhir
  Tahfidh_Nilai: string | number;
  
  // Tajwid Section
  hasTajwid: boolean;
  Tajwid_Jenis: TajwidType | '';
  Tajwid_Capaian: string;
  Tajwid_Nilai: string | number;
  
  // Catatan Guru
  Catatan: string;
}

export interface StudentSummary {
  totalLogs: number;
  presentCount: number;
  attendancePercentage: number;
  avgTahsin: number | null;
  avgTahfidh: number | null;
  avgTajwid: number | null;
}

export interface PendingAction {
  action: 'create' | 'update' | 'delete';
  log: LogMutabaah;
  timestamp: string;
}
