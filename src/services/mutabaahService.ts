import { MasterUser, MasterSiswa, MasterSurat, LogMutabaah, MutabaahFormData, StudentSummary } from '../types';
import { INITIAL_USERS, INITIAL_SISWA, INITIAL_LOGS } from '../data/initialData';
import { MASTER_SURAT } from '../data/masterSurat';

const SPREADSHEET_ID = "1wJMBxsQD4u_shFefiDeTpJYqgB8y1InC7De2XpXysCE";
const DEFAULT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxgCPxeO62MewnbWBkYt9NYS157YHyT8-4ieS5ZLM9tqNFhHzgWdCFApM-Xiwea7o3a/exec";

const STORAGE_KEYS = {
  USERS: 'mutabaah_master_users_v1',
  SISWA: 'mutabaah_master_siswa_v1',
  SURAT: 'mutabaah_master_surat_v1',
  LOGS: 'mutabaah_logs_v1',
  CURRENT_USER: 'mutabaah_current_user_v1',
  WEBHOOK_URL: 'mutabaah_google_script_url_v1'
};

// Helper to parse simple CSV text safely
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let insideQuote = false;
  let currentVal = '';
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      insideQuote = !insideQuote;
    } else if (char === ',' && !insideQuote) {
      result.push(currentVal.trim().replace(/^"|"$/g, ''));
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  result.push(currentVal.trim().replace(/^"|"$/g, ''));
  return result;
}

export class MutabaahService {
  // Get all Master Users from local storage
  static getUsers(): MasterUser[] {
    const stored = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!stored) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    try {
      const parsed: MasterUser[] = JSON.parse(stored);
      let modified = false;
      parsed.forEach(u => {
        if (u.Email && u.Email.toLowerCase() === "kurikulum.alwildan29@gmail.com" && u.Nama_Guru !== "Kurikulum") {
          u.Nama_Guru = "Kurikulum";
          modified = true;
        }
      });
      if (!parsed.some((u: MasterUser) => u.Email && u.Email.toLowerCase() === "kurikulum.alwildan29@gmail.com")) {
        parsed.unshift({
          ID_User: "U001",
          Email: "kurikulum.alwildan29@gmail.com",
          Nama_Guru: "Kurikulum"
        });
        modified = true;
      }
      if (modified) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return INITIAL_USERS;
    }
  }

  // Get current logged in user session
  static getCurrentUser(): MasterUser | null {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!stored) return null;
    try {
      const parsed: MasterUser = JSON.parse(stored);
      if (parsed.Email && parsed.Email.toLowerCase() === "kurikulum.alwildan29@gmail.com" && parsed.Nama_Guru !== "Kurikulum") {
        parsed.Nama_Guru = "Kurikulum";
        this.setCurrentUser(parsed);
      }
      return parsed;
    } catch {
      return null;
    }
  }

  // Save current user session
  static setCurrentUser(user: MasterUser | null): void {
    if (user) {
      if (user.Email && user.Email.toLowerCase() === "kurikulum.alwildan29@gmail.com") {
        user.Nama_Guru = "Kurikulum";
      }
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  // Validate teacher email (Dibuat ASYNC untuk auto-sync jika email tidak ditemukan lokal)
  static async validateUserEmail(email: string): Promise<MasterUser | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

    // 1. Cek di penyimpanan lokal terlebih dahulu
    let users = this.getUsers();
    let found = users.find(u => u.Email && u.Email.trim().toLowerCase() === cleanEmail);

    // 2. Jika tidak terdaftar di lokal, otomatis tarik data terbaru dari Google Sheets
    if (!found) {
      await this.fetchFromGoogleSheets();
      users = this.getUsers();
      found = users.find(u => u.Email && u.Email.trim().toLowerCase() === cleanEmail);
    }

    if (found) {
      if (found.Email.toLowerCase() === "kurikulum.alwildan29@gmail.com") {
        return { ...found, Nama_Guru: "Kurikulum" };
      }
      return found;
    }

    return null;
  }

  // Get Master Siswa list
  static getSiswa(): MasterSiswa[] {
    const stored = localStorage.getItem(STORAGE_KEYS.SISWA);
    if (!stored) {
      localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(INITIAL_SISWA));
      return INITIAL_SISWA;
    }
    try {
      const parsed: MasterSiswa[] = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(INITIAL_SISWA));
      return INITIAL_SISWA;
    } catch {
      localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(INITIAL_SISWA));
      return INITIAL_SISWA;
    }
  }

  static saveSiswa(siswaList: MasterSiswa[]): void {
    localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(siswaList));
  }

  static addSiswa(newStudent: MasterSiswa): void {
    const current = this.getSiswa();
    const updated = [newStudent, ...current.filter(s => s.ID_Siswa !== newStudent.ID_Siswa)];
    this.saveSiswa(updated);
  }

  static getSurat(): MasterSurat[] {
    const stored = localStorage.getItem(STORAGE_KEYS.SURAT);
    if (!stored) {
      localStorage.setItem(STORAGE_KEYS.SURAT, JSON.stringify(MASTER_SURAT));
      return MASTER_SURAT;
    }
    try {
      return JSON.parse(stored);
    } catch {
      return MASTER_SURAT;
    }
  }

  static getLogs(): LogMutabaah[] {
    const stored = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (!stored) {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(INITIAL_LOGS));
      return INITIAL_LOGS;
    }
    try {
      return JSON.parse(stored);
    } catch {
      return INITIAL_LOGS;
    }
  }

  static getStudentRecentLogs(nis: string, limit = 10): LogMutabaah[] {
    const logs = this.getLogs();
    const filtered = logs.filter(l => String(l.ID_Siswa).trim() === String(nis).trim());
    filtered.sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());
    return filtered.slice(0, limit);
  }

  static getStudentSummary(nis: string): StudentSummary {
    const studentLogs = this.getLogs().filter(l => String(l.ID_Siswa).trim() === String(nis).trim());
    if (studentLogs.length === 0) {
      return { totalLogs: 0, presentCount: 0, attendancePercentage: 0, avgTahsin: null, avgTahfidh: null, avgTajwid: null };
    }

    const totalLogs = studentLogs.length;
    const presentCount = studentLogs.filter(l => l.Kehadiran === 'A' || (l.Kehadiran as string) === 'Hadir').length;
    const attendancePercentage = Math.round((presentCount / totalLogs) * 100);

    const tahsinScores = studentLogs.map(l => l.Tahsin_Nilai).filter((val): val is number => typeof val === 'number' && !isNaN(val) && val > 0);
    const avgTahsin = tahsinScores.length > 0 ? Math.round(tahsinScores.reduce((a, b) => a + b, 0) / tahsinScores.length) : null;

    const tahfidhScores = studentLogs.map(l => l.Tahfidh_Nilai).filter((val): val is number => typeof val === 'number' && !isNaN(val) && val > 0);
    const avgTahfidh = tahfidhScores.length > 0 ? Math.round(tahfidhScores.reduce((a, b) => a + b, 0) / tahfidhScores.length) : null;

    const tajwidScores = studentLogs.map(l => l.Tajwid_Nilai).filter((val): val is number => typeof val === 'number' && !isNaN(val) && val > 0);
    const avgTajwid = tajwidScores.length > 0 ? Math.round(tajwidScores.reduce((a, b) => a + b, 0) / tajwidScores.length) : null;

    return { totalLogs, presentCount, attendancePercentage, avgTahsin, avgTahfidh, avgTajwid };
  }

  static addLog(formData: MutabaahFormData, currentTeacher: MasterUser): LogMutabaah {
    const allSiswa = this.getSiswa();
    const student = allSiswa.find(s => s.ID_Siswa === formData.ID_Siswa);
    const studentName = student ? student.Nama_Siswa : formData.ID_Siswa;

    const now = new Date();
    const timestampStr = now.toISOString().replace('T', ' ').substring(0, 19);
    const logId = "LOG-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

    let tahsinDetail = '';
    if (formData.hasTahsin) {
      if (formData.Tahsin_Rujukan === 'Al-Qur\'an') {
        tahsinDetail = (formData.Tahsin_Mulai || formData.Tahsin_Akhir)
          ? `Mulai: ${formData.Tahsin_Mulai || '-'} s.d. Akhir: ${formData.Tahsin_Akhir || '-'}`
          : formData.Tahsin_Ayat || '-';
      } else {
        tahsinDetail = formData.Tahsin_BabHalaman || '-';
      }
    }

    let tahfidhAyatDetail = '';
    if (formData.hasTahfidh) {
      tahfidhAyatDetail = (formData.Tahfidh_Mulai || formData.Tahfidh_Akhir)
        ? `Mulai: ${formData.Tahfidh_Mulai || '-'} s.d. Akhir: ${formData.Tahfidh_Akhir || '-'}`
        : formData.Tahfidh_Ayat || '-';
    }

    const newLog: LogMutabaah = {
      ID_Log: logId,
      Timestamp: timestampStr,
      Tanggal_Mutabaah: formData.Tanggal_Mutabaah,
      Email_Guru: currentTeacher.Email,
      Nama_Guru: currentTeacher.Nama_Guru,
      ID_Siswa: formData.ID_Siswa,
      Nama_Siswa: studentName,
      Kehadiran: formData.Kehadiran,
      Tahsin_Rujukan: formData.hasTahsin ? formData.Tahsin_Rujukan : '',
      Tahsin_Capaian_SuratBab: formData.hasTahsin ? (formData.Tahsin_Rujukan === 'Al-Qur\'an' ? formData.Tahsin_Surat : formData.Tahsin_BabHalaman) : '',
      Tahsin_Capaian_Detail: tahsinDetail,
      Tahsin_Mulai: formData.Tahsin_Mulai || '',
      Tahsin_Akhir: formData.Tahsin_Akhir || '',
      Tahsin_Nilai: formData.hasTahsin && formData.Tahsin_Nilai !== '' ? Number(formData.Tahsin_Nilai) : null,
      Tahfidh_Jenis: formData.hasTahfidh ? formData.Tahfidh_Jenis : '',
      Tahfidh_Surat: formData.hasTahfidh ? formData.Tahfidh_Surat : '',
      Tahfidh_Ayat: tahfidhAyatDetail,
      Tahfidh_Mulai: formData.Tahfidh_Mulai || '',
      Tahfidh_Akhir: formData.Tahfidh_Akhir || '',
      Tahfidh_Nilai: formData.hasTahfidh && formData.Tahfidh_Nilai !== '' ? Number(formData.Tahfidh_Nilai) : null,
      Tajwid_Jenis: formData.hasTajwid ? formData.Tajwid_Jenis : '',
      Tajwid_Capaian: formData.hasTajwid ? formData.Tajwid_Capaian : '',
      Tajwid_Nilai: formData.hasTajwid && formData.Tajwid_Nilai !== '' ? Number(formData.Tajwid_Nilai) : null,
      Catatan: formData.Catatan.trim()
    };

    const currentLogs = this.getLogs();
    const updatedLogs = [newLog, ...currentLogs];
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updatedLogs));

    this.sendToWebhook(newLog);
    return newLog;
  }

  // Save multiple Mutabaah Logs at once for batch/class submission
  static addMultipleLogs(formDataList: MutabaahFormData[], currentTeacher: MasterUser): LogMutabaah[] {
    const allSiswa = this.getSiswa();
    const currentLogs = this.getLogs();
    const newLogs: LogMutabaah[] = [];
    const now = new Date();
    const baseTimestamp = now.toISOString().replace('T', ' ').substring(0, 19);

    formDataList.forEach((formData, idx) => {
      const student = allSiswa.find(s => s.ID_Siswa === formData.ID_Siswa);
      const studentName = student ? student.Nama_Siswa : formData.ID_Siswa;
      const logId = `LOG-${Date.now()}-${idx + 1}-${Math.floor(Math.random() * 1000)}`;

      let tahsinDetail = '';
      if (formData.hasTahsin) {
        if (formData.Tahsin_Rujukan === 'Al-Qur\'an') {
          tahsinDetail = (formData.Tahsin_Mulai || formData.Tahsin_Akhir)
            ? `Mulai: ${formData.Tahsin_Mulai || '-'} s.d. Akhir: ${formData.Tahsin_Akhir || '-'}`
            : formData.Tahsin_Ayat || '-';
        } else {
          tahsinDetail = formData.Tahsin_BabHalaman || '-';
        }
      }

      let tahfidhAyatDetail = '';
      if (formData.hasTahfidh) {
        tahfidhAyatDetail = (formData.Tahfidh_Mulai || formData.Tahfidh_Akhir)
          ? `Mulai: ${formData.Tahfidh_Mulai || '-'} s.d. Akhir: ${formData.Tahfidh_Akhir || '-'}`
          : formData.Tahfidh_Ayat || '-';
      }

      const newLog: LogMutabaah = {
        ID_Log: logId,
        Timestamp: baseTimestamp,
        Tanggal_Mutabaah: formData.Tanggal_Mutabaah,
        Email_Guru: currentTeacher.Email,
        Nama_Guru: currentTeacher.Nama_Guru,
        ID_Siswa: formData.ID_Siswa,
        Nama_Siswa: studentName,
        Kehadiran: formData.Kehadiran,
        Tahsin_Rujukan: formData.hasTahsin ? formData.Tahsin_Rujukan : '',
        Tahsin_Capaian_SuratBab: formData.hasTahsin ? (formData.Tahsin_Rujukan === 'Al-Qur\'an' ? formData.Tahsin_Surat : formData.Tahsin_BabHalaman) : '',
        Tahsin_Capaian_Detail: tahsinDetail,
        Tahsin_Mulai: formData.Tahsin_Mulai || '',
        Tahsin_Akhir: formData.Tahsin_Akhir || '',
        Tahsin_Nilai: formData.hasTahsin && formData.Tahsin_Nilai !== '' ? Number(formData.Tahsin_Nilai) : null,
        Tahfidh_Jenis: formData.hasTahfidh ? formData.Tahfidh_Jenis : '',
        Tahfidh_Surat: formData.hasTahfidh ? formData.Tahfidh_Surat : '',
        Tahfidh_Ayat: tahfidhAyatDetail,
        Tahfidh_Mulai: formData.Tahfidh_Mulai || '',
        Tahfidh_Akhir: formData.Tahfidh_Akhir || '',
        Tahfidh_Nilai: formData.hasTahfidh && formData.Tahfidh_Nilai !== '' ? Number(formData.Tahfidh_Nilai) : null,
        Tajwid_Jenis: formData.hasTajwid ? formData.Tajwid_Jenis : '',
        Tajwid_Capaian: formData.hasTajwid ? formData.Tajwid_Capaian : '',
        Tajwid_Nilai: formData.hasTajwid && formData.Tajwid_Nilai !== '' ? Number(formData.Tajwid_Nilai) : null,
        Catatan: formData.Catatan.trim()
      };

      newLogs.push(newLog);
    });

    const updatedLogs = [...newLogs, ...currentLogs];
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updatedLogs));

    // Kirim webhook secara sekuensial dengan jeda agar Google Apps Script tidak kewalahan / terkena limit koneksi browser (6 HTTP requests)
    this.sendLogsSequentially(newLogs);

    return newLogs;
  }

  static getWebhookUrl(): string {
    return localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || DEFAULT_WEBHOOK_URL;
  }

  static setWebhookUrl(url: string): void {
    if (url) {
      localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, url.trim());
    } else {
      localStorage.removeItem(STORAGE_KEYS.WEBHOOK_URL);
    }
  }

  private static async sendToWebhook(log: LogMutabaah): Promise<void> {
    const url = this.getWebhookUrl();
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(log)
      });
    } catch (e) {
      console.warn('Webhook post to Google Sheets failed:', e);
    }
  }

  private static async sendLogsSequentially(logs: LogMutabaah[]): Promise<void> {
    const url = this.getWebhookUrl();
    if (!url || logs.length === 0) return;

    // Kirim setiap data log EXACTLY ONCE secara terukur (chunk size 2-3 dengan jeda 80ms)
    // Ini mencegah data terduplikasi dan memastikan Google Apps Script dapat memproses data dengan cepat & akurat
    const CHUNK_SIZE = 2;
    for (let i = 0; i < logs.length; i += CHUNK_SIZE) {
      const chunk = logs.slice(i, i + CHUNK_SIZE);
      await Promise.allSettled(
        chunk.map(log =>
          fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(log)
          }).catch(err => console.warn(`Log ${log.ID_Log} post failed:`, err))
        )
      );

      // Jeda 80ms antar batch kecil agar Google Apps Script lock dapat bergiliran dengan stabil
      if (i + CHUNK_SIZE < logs.length) {
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    }
  }

  // Fetch live data from public Google Sheet CSV with dynamic column parsing
  static async fetchFromGoogleSheets(): Promise<{ success: boolean; message: string }> {
    try {
      const sheets = ['Master_User', 'Master_Siswa', 'Master_Surat', 'Log_Mutabaah'];
      let fetchedAny = false;
      let htmlDetected = false;

      for (const sheetName of sheets) {
        const cacheBuster = Date.now();
        const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&_t=${cacheBuster}`;
        try {
          const res = await fetch(url);
          if (res.ok) {
            const csvText = await res.text();
            
            if (csvText.trim().startsWith('<')) {
              htmlDetected = true;
              continue;
            }

            const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
            
            if (lines.length >= 1) {
              fetchedAny = true;

              // --- PARSING SHEET: Master_User ---
              if (sheetName === 'Master_User') {
                const users: MasterUser[] = [];
                const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());

                // Deteksi indeks kolom berdasarkan kata kunci header
                let idIdx = headers.findIndex(h => h.includes('id'));
                let emailIdx = headers.findIndex(h => h.includes('email'));
                let namaIdx = headers.findIndex(h => h.includes('nama') || h.includes('guru'));

                if (emailIdx === -1) emailIdx = 1;
                if (namaIdx === -1) namaIdx = 2;
                if (idIdx === -1) idIdx = 0;

                for (let i = 1; i < lines.length; i++) {
                  const cols = parseCSVRow(lines[i]);
                  const rawEmail = cols[emailIdx] ? cols[emailIdx].trim() : '';

                  if (rawEmail && rawEmail.includes('@')) {
                    users.push({
                      ID_User: cols[idIdx] ? cols[idIdx].trim() : `aw29-${i}`,
                      Email: rawEmail,
                      Nama_Guru: cols[namaIdx] ? cols[namaIdx].trim() : rawEmail
                    });
                  }
                }

                if (!users.some(u => u.Email.toLowerCase() === 'kurikulum.alwildan29@gmail.com')) {
                  users.unshift({
                    ID_User: 'aw29-1',
                    Email: 'kurikulum.alwildan29@gmail.com',
                    Nama_Guru: 'Kurikulum'
                  });
                }

                if (users.length > 0) {
                  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
                }

              // --- PARSING SHEET: Master_Siswa ---
              } else if (sheetName === 'Master_Siswa') {
                const siswaList: MasterSiswa[] = [];
                for (let i = 1; i < lines.length; i++) {
                  const cols = parseCSVRow(lines[i]);
                  if (cols.length >= 2 && cols[0]) {
                    siswaList.push({
                      ID_Siswa: cols[0].trim(),
                      Nama_Siswa: cols[1].trim(),
                      Kelas: cols[2] ? cols[2].trim() : "Kelas 1",
                      Kelompok_Halaqah: "",
                      Gender: cols[3] ? cols[3].trim() : ""
                    });
                  }
                }
                if (siswaList.length > 0) {
                  localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(siswaList));
                }

              // --- PARSING SHEET: Log_Mutabaah ---
              } else if (sheetName === 'Log_Mutabaah') {
                const logsFromSheet: LogMutabaah[] = [];
                for (let i = 1; i < lines.length; i++) {
                  const cols = parseCSVRow(lines[i]);
                  if (cols.length >= 1 && (cols[0] || cols[2] || cols[5] || cols[6])) {
                    logsFromSheet.push({
                      ID_Log: cols[0] ? cols[0].trim() : `LOG-SHEET-${i}`,
                      Timestamp: cols[1] ? cols[1].trim() : new Date().toISOString(),
                      Tanggal_Mutabaah: cols[2] ? cols[2].trim() : new Date().toISOString().split('T')[0],
                      Email_Guru: cols[3] ? cols[3].trim() : '',
                      Nama_Guru: cols[4] ? cols[4].trim() : '',
                      ID_Siswa: cols[5] ? cols[5].trim() : '',
                      Nama_Siswa: cols[6] ? cols[6].trim() : '',
                      Kehadiran: (cols[7] ? cols[7].trim() : 'Hadir') as any,
                      Tahsin_Rujukan: (cols[8] ? cols[8].trim() : '') as any,
                      Tahsin_Capaian_SuratBab: cols[9] ? cols[9].trim() : '',
                      Tahsin_Capaian_Detail: cols[10] ? cols[10].trim() : '',
                      Tahsin_Nilai: cols[11] && cols[11] !== '' && !isNaN(Number(cols[11])) ? Number(cols[11]) : null,
                      Tahfidh_Jenis: (cols[12] ? cols[12].trim() : '') as any,
                      Tahfidh_Surat: cols[13] ? cols[13].trim() : '',
                      Tahfidh_Ayat: cols[14] ? cols[14].trim() : '',
                      Tahfidh_Nilai: cols[15] && cols[15] !== '' && !isNaN(Number(cols[15])) ? Number(cols[15]) : null,
                      Tajwid_Jenis: (cols[16] ? cols[16].trim() : '') as any,
                      Tajwid_Capaian: cols[17] ? cols[17].trim() : '',
                      Tajwid_Nilai: cols[18] && cols[18] !== '' && !isNaN(Number(cols[18])) ? Number(cols[18]) : null,
                      Catatan: cols[19] ? cols[19].trim() : ''
                    });
                  }
                }
                localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logsFromSheet));
              }
            }
          }
        } catch (e) {
          console.warn(`Gagal mengambil sheet ${sheetName}:`, e);
        }
      }

      if (fetchedAny) {
        return { success: true, message: "Berhasil menyinkronkan data dari Google Sheets!" };
      } else if (htmlDetected) {
        return { 
          success: false, 
          message: "Akses Google Sheets terbatas. Pastikan 'Akses Umum' pada Google Sheet diatur ke 'Siapa saja yang memiliki link' (Viewer)." 
        };
      } else {
        return { success: false, message: "Koneksi Google Sheets dibatasi atau tidak dapat dijangkau. Menggunakan data lokal." };
      }
    } catch (e) {
      return { success: false, message: "Gagal menyambung ke Google Sheets. Menggunakan database lokal." };
    }
  }

  static exportLogsToCSV(): void {
    const logs = this.getLogs();
    const headers = [
      "ID_Log", "Timestamp", "Tanggal_Mutabaah", "Email_Guru", "Nama_Guru",
      "ID_Siswa", "Nama_Siswa", "Kehadiran", "Tahsin_Rujukan",
      "Tahsin_Capaian_SuratBab", "Tahsin_Capaian_Detail", "Tahsin_Nilai",
      "Tahfidh_Jenis", "Tahfidh_Surat", "Tahfidh_Ayat", "Tahfidh_Nilai",
      "Tajwid_Jenis", "Tajwid_Capaian", "Tajwid_Nilai", "Catatan"
    ];

    const rows = logs.map(l => [
      `"${l.ID_Log}"`, `"${l.Timestamp}"`, `"${l.Tanggal_Mutabaah}"`, `"${l.Email_Guru}"`, `"${l.Nama_Guru}"`,
      `"${l.ID_Siswa}"`, `"${l.Nama_Siswa}"`, `"${l.Kehadiran}"`, `"${l.Tahsin_Rujukan || ''}"`,
      `"${l.Tahsin_Capaian_SuratBab || ''}"`, `"${l.Tahsin_Capaian_Detail || ''}"`, `"${l.Tahsin_Nilai !== null && l.Tahsin_Nilai !== undefined ? l.Tahsin_Nilai : ''}"`,
      `"${l.Tahfidh_Jenis || ''}"`, `"${l.Tahfidh_Surat || ''}"`, `"${l.Tahfidh_Ayat || ''}"`, `"${l.Tahfidh_Nilai !== null && l.Tahfidh_Nilai !== undefined ? l.Tahfidh_Nilai : ''}"`,
      `"${l.Tajwid_Jenis || ''}"`, `"${l.Tajwid_Capaian || ''}"`, `"${l.Tajwid_Nilai !== null && l.Tajwid_Nilai !== undefined ? l.Tajwid_Nilai : ''}"`,
      `"${(l.Catatan || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Log_Mutabaah_Export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}