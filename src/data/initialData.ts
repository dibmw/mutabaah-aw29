import { MasterUser, MasterSiswa, LogMutabaah } from '../types';

export const INITIAL_USERS: MasterUser[] = [
  {
    ID_User: "U001",
    Email: "kurikulum.alwildan29@gmail.com",
    Nama_Guru: "Kurikulum"
  },
  {
    ID_User: "U002",
    Email: "fauzi.tahfidh@alwildan.sch.id",
    Nama_Guru: "Ust. Muhammad Fauzi, S.Pd.I"
  },
  {
    ID_User: "U003",
    Email: "syarif.halaqah@alwildan.sch.id",
    Nama_Guru: "Ust. Syarif Hidayatullah, M.Ag"
  },
  {
    ID_User: "U004",
    Email: "admin.mutabaah@alwildan.sch.id",
    Nama_Guru: "Ustadzah Fatimah Azzahra, S.Ag"
  }
];

export const INITIAL_SISWA: MasterSiswa[] = [
  {
    ID_Siswa: "12345678",
    Nama_Siswa: "Ahmad Fauzan",
    Kelas: "Kelas 7A",
    Kelompok_Halaqah: "Halaqah Abu Bakar"
  },
  {
    ID_Siswa: "12345679",
    Nama_Siswa: "Muhammad Rayhan Al-Fatih",
    Kelas: "Kelas 7A",
    Kelompok_Halaqah: "Halaqah Abu Bakar"
  },
  {
    ID_Siswa: "12345680",
    Nama_Siswa: "Ibrahim Hafiz",
    Kelas: "Kelas 7B",
    Kelompok_Halaqah: "Halaqah Umar bin Khattab"
  },
  {
    ID_Siswa: "12345681",
    Nama_Siswa: "Aisyah Humaira",
    Kelas: "Kelas 8A",
    Kelompok_Halaqah: "Halaqah Utsman bin Affan"
  },
  {
    ID_Siswa: "12345682",
    Nama_Siswa: "Zaid bin Haritsah",
    Kelas: "Kelas 8B",
    Kelompok_Halaqah: "Halaqah Ali bin Abi Thalib"
  },
  {
    ID_Siswa: "12345683",
    Nama_Siswa: "Maryam An-Nisa",
    Kelas: "Kelas 9A",
    Kelompok_Halaqah: "Halaqah Khadijah"
  },
  {
    ID_Siswa: "12345684",
    Nama_Siswa: "Abdullah Azzam",
    Kelas: "Kelas 9B",
    Kelompok_Halaqah: "Halaqah Umar bin Khattab"
  }
];

export const INITIAL_LOGS: LogMutabaah[] = [
  {
    ID_Log: "LOG-1001",
    Timestamp: "2026-07-21 08:30:00",
    Tanggal_Mutabaah: "2026-07-21",
    Email_Guru: "kurikulum.alwildan29@gmail.com",
    Nama_Guru: "Kurikulum",
    ID_Siswa: "12345678",
    Nama_Siswa: "Ahmad Fauzan",
    Kehadiran: "A",
    Tahsin_Rujukan: "Al-Qur'an",
    Tahsin_Capaian_SuratBab: "Al-Baqarah",
    Tahsin_Capaian_Detail: "Ayat 1 - 20",
    Tahsin_Nilai: 88,
    Tahfidh_Jenis: "Hafalan Baru (Ziyadah)",
    Tahfidh_Surat: "An-Naba'",
    Tahfidh_Ayat: "Ayat 1 - 15",
    Tahfidh_Nilai: 90,
    Tajwid_Jenis: "Tajwid Metode Asy-Syafi'i",
    Tajwid_Capaian: "Bab Nun Mati & Tanwin Hal. 14",
    Tajwid_Nilai: 85,
    Catatan: "Makhraj huruf 'Ain dan Ha sudah jauh lebih fasih. Pertahankan kelancaran hafalan."
  },
  {
    ID_Log: "LOG-1002",
    Timestamp: "2026-07-20 08:45:00",
    Tanggal_Mutabaah: "2026-07-20",
    Email_Guru: "kurikulum.alwildan29@gmail.com",
    Nama_Guru: "Kurikulum",
    ID_Siswa: "12345678",
    Nama_Siswa: "Ahmad Fauzan",
    Kehadiran: "A",
    Tahsin_Rujukan: "Al-Qur'an",
    Tahsin_Capaian_SuratBab: "Al-Baqarah",
    Tahsin_Capaian_Detail: "Ayat 21 - 35",
    Tahsin_Nilai: 85,
    Tahfidh_Jenis: "Hafalan Lama (Muroja'ah)",
    Tahfidh_Surat: "An-Nazi'at",
    Tahfidh_Ayat: "Ayat 1 - 25",
    Tahfidh_Nilai: 88,
    Tajwid_Jenis: "Tajwid Metode Asy-Syafi'i",
    Tajwid_Capaian: "Bab Idgham Bighunnah Hal. 18",
    Tajwid_Nilai: 82,
    Catatan: "Tajwid Idgham bighunnah perlu diperpanjang dengungnya sedikit lagi."
  },
  {
    ID_Log: "LOG-1003",
    Timestamp: "2026-07-19 08:20:00",
    Tanggal_Mutabaah: "2026-07-19",
    Email_Guru: "fauzi.tahfidh@alwildan.sch.id",
    Nama_Guru: "Ust. Muhammad Fauzi, S.Pd.I",
    ID_Siswa: "12345678",
    Nama_Siswa: "Ahmad Fauzan",
    Kehadiran: "Sakit",
    Catatan: "Siswa izin sakit demam (surat dokter diserahkan wali murid)."
  },
  {
    ID_Log: "LOG-1004",
    Timestamp: "2026-07-18 08:30:00",
    Tanggal_Mutabaah: "2026-07-18",
    Email_Guru: "kurikulum.alwildan29@gmail.com",
    Nama_Guru: "Kurikulum",
    ID_Siswa: "12345679",
    Nama_Siswa: "Muhammad Rayhan Al-Fatih",
    Kehadiran: "A",
    Tahsin_Rujukan: "Al-Qur'an",
    Tahsin_Capaian_SuratBab: "Ali 'Imran",
    Tahsin_Capaian_Detail: "Ayat 1 - 10",
    Tahsin_Nilai: 92,
    Tahfidh_Jenis: "Hafalan Baru (Ziyadah)",
    Tahfidh_Surat: "Al-Mulk",
    Tahfidh_Ayat: "Ayat 1 - 12",
    Tahfidh_Nilai: 95,
    Tajwid_Jenis: "Tuhfatul Athfal",
    Tajwid_Capaian: "Bait 1 - 5 Hal. 8",
    Tajwid_Nilai: 90,
    Catatan: "Mumtaz! Hafalan sangat lancar tanpa terbata-bata."
  }
];
