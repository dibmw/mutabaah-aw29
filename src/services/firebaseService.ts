import {
  collection,
  doc,
  writeBatch,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { LogMutabaah } from '../types';

const COLLECTION_NAME = 'log_mutabaah';

export class FirebaseService {
  /**
   * Simpan satu atau banyak log mutabaah ke Firestore menggunakan writeBatch.
   * Mendukung hingga 500 dokumen sekaligus dalam 1 atomic operation (<100ms).
   * Data langsung aman tersimpan di IndexedDB browser meskipun offline,
   * dan otomatis dikirimkan ke cloud saat online oleh Firebase SDK.
   */
  static async saveLogs(logs: LogMutabaah[]): Promise<{ success: boolean; count: number; error?: unknown }> {
    if (!logs || logs.length === 0) return { success: true, count: 0 };

    try {
      const batch = writeBatch(db);
      const colRef = collection(db, COLLECTION_NAME);

      logs.forEach(log => {
        const docRef = doc(colRef, String(log.ID_Log));
        batch.set(docRef, {
          ...log,
          syncedToSheet: false, // Flag penanda untuk sinkronisasi ke Google Sheet
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      return { success: true, count: logs.length };
    } catch (error) {
      console.error('[Firebase] Gagal menyimpan batch log ke Firestore:', error);
      return { success: false, count: 0, error };
    }
  }

  /**
   * Perbarui log yang sudah ada di Firestore.
   */
  static async updateLog(logId: string, updates: Partial<LogMutabaah>): Promise<boolean> {
    try {
      const docRef = doc(db, COLLECTION_NAME, String(logId));
      await updateDoc(docRef, {
        ...updates,
        syncedToSheet: false,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('[Firebase] Gagal update log:', logId, error);
      return false;
    }
  }

  /**
   * Hapus log dari Firestore.
   */
  static async deleteLog(logId: string): Promise<boolean> {
    try {
      const docRef = doc(db, COLLECTION_NAME, String(logId));
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error('[Firebase] Gagal hapus log:', logId, error);
      return false;
    }
  }

  /**
   * Ambil data log mutabaah terbaru dari Firestore (misal 500 data terakhir).
   */
  static async getRecentLogs(maxCount: number = 500): Promise<LogMutabaah[]> {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(colRef, orderBy('Timestamp', 'desc'), limit(maxCount));
      const snapshot = await getDocs(q);

      const logs: LogMutabaah[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        logs.push({
          ID_Log: data.ID_Log || docSnap.id,
          Timestamp: data.Timestamp || '',
          Tanggal_Mutabaah: data.Tanggal_Mutabaah || '',
          Email_Guru: data.Email_Guru || '',
          Nama_Guru: data.Nama_Guru || '',
          ID_Siswa: data.ID_Siswa || '',
          Nama_Siswa: data.Nama_Siswa || '',
          Kehadiran: data.Kehadiran || '',
          Tahsin_Rujukan: data.Tahsin_Rujukan || '',
          Tahsin_Capaian_SuratBab: data.Tahsin_Capaian_SuratBab || '',
          Tahsin_Capaian_Detail: data.Tahsin_Capaian_Detail || '',
          Tahsin_Mulai: data.Tahsin_Mulai || '',
          Tahsin_Akhir: data.Tahsin_Akhir || '',
          Tahsin_Nilai: data.Tahsin_Nilai !== undefined ? data.Tahsin_Nilai : null,
          Tahfidh_Jenis: data.Tahfidh_Jenis || '',
          Tahfidh_Surat: data.Tahfidh_Surat || '',
          Tahfidh_Ayat: data.Tahfidh_Ayat || '',
          Tahfidh_Mulai: data.Tahfidh_Mulai || '',
          Tahfidh_Akhir: data.Tahfidh_Akhir || '',
          Tahfidh_Nilai: data.Tahfidh_Nilai !== undefined ? data.Tahfidh_Nilai : null,
          Tajwid_Jenis: data.Tajwid_Jenis || '',
          Tajwid_Capaian: data.Tajwid_Capaian || '',
          Tajwid_Nilai: data.Tajwid_Nilai !== undefined ? data.Tajwid_Nilai : null,
          Catatan: data.Catatan || ''
        });
      });
      return logs;
    } catch (error) {
      console.warn('[Firebase] Gagal mengambil log dari Firestore:', error);
      return [];
    }
  }

  /**
   * Realtime Listener untuk mendengarkan perubahan data log secara langsung.
   */
  static subscribeToRecentLogs(
    callback: (logs: LogMutabaah[]) => void,
    maxCount: number = 300
  ): () => void {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, orderBy('Timestamp', 'desc'), limit(maxCount));

    return onSnapshot(q, (snapshot) => {
      const logs: LogMutabaah[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        logs.push({
          ID_Log: data.ID_Log || docSnap.id,
          Timestamp: data.Timestamp || '',
          Tanggal_Mutabaah: data.Tanggal_Mutabaah || '',
          Email_Guru: data.Email_Guru || '',
          Nama_Guru: data.Nama_Guru || '',
          ID_Siswa: data.ID_Siswa || '',
          Nama_Siswa: data.Nama_Siswa || '',
          Kehadiran: data.Kehadiran || '',
          Tahsin_Rujukan: data.Tahsin_Rujukan || '',
          Tahsin_Capaian_SuratBab: data.Tahsin_Capaian_SuratBab || '',
          Tahsin_Capaian_Detail: data.Tahsin_Capaian_Detail || '',
          Tahsin_Mulai: data.Tahsin_Mulai || '',
          Tahsin_Akhir: data.Tahsin_Akhir || '',
          Tahsin_Nilai: data.Tahsin_Nilai !== undefined ? data.Tahsin_Nilai : null,
          Tahfidh_Jenis: data.Tahfidh_Jenis || '',
          Tahfidh_Surat: data.Tahfidh_Surat || '',
          Tahfidh_Ayat: data.Tahfidh_Ayat || '',
          Tahfidh_Mulai: data.Tahfidh_Mulai || '',
          Tahfidh_Akhir: data.Tahfidh_Akhir || '',
          Tahfidh_Nilai: data.Tahfidh_Nilai !== undefined ? data.Tahfidh_Nilai : null,
          Tajwid_Jenis: data.Tajwid_Jenis || '',
          Tajwid_Capaian: data.Tajwid_Capaian || '',
          Tajwid_Nilai: data.Tajwid_Nilai !== undefined ? data.Tajwid_Nilai : null,
          Catatan: data.Catatan || ''
        });
      });
      callback(logs);
    }, (error) => {
      console.warn('[Firebase] Snapshot error:', error);
    });
  }
}
