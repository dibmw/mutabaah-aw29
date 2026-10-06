import { MasterUser, MasterSiswa, MasterSurat, LogMutabaah, MutabaahFormData, StudentSummary, PendingAction, JadwalPelajaran } from '../types';
import { INITIAL_USERS, INITIAL_SISWA, INITIAL_LOGS } from '../data/initialData';
import { MASTER_SURAT } from '../data/masterSurat';

const SPREADSHEET_ID = "1wJMBxsQD4u_shFefiDeTpJYqgB8y1InC7De2XpXysCE";
const DEFAULT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxgCPxeO62MewnbWBkYt9NYS157YHyT8-4ieS5ZLM9tqNFhHzgWdCFApM-Xiwea7o3a/exec";

const ARCHIVE_RETENTION_DAYS = 30;
const STORAGE_SIZE_WARN_BYTES = 4 * 1024 * 1024;

const STORAGE_KEYS = {
  USERS: 'mutabaah_master_users_v1',
  SISWA: 'mutabaah_master_siswa_v1',
  SURAT: 'mutabaah_master_surat_v1',
  LOGS: 'mutabaah_logs_v1',
  CURRENT_USER: 'mutabaah_current_user_v1',
  WEBHOOK_URL: 'mutabaah_google_script_url_v1',
  PENDING_LOGS: 'mutabaah_pending_logs_v1',
  JADWAL: 'mutabaah_jadwal_pelajaran_v1'
};

// Helper to parse gviz JSON export (tqx=out:json) into rows (string[][]).
// Produces the same shape as the old CSV parser (rows[0] = header) so the
// downstream parsing logic stays unchanged. Reads raw cell values, which
// avoids the CSV export mangling numbers (e.g. 100 -> "10") and keeps
// multi-line cells (e.g. Catatan) intact.
function parseGvizJson(jsonText: string): string[][] {
  const startMarker = 'google.visualization.Query.setResponse(';
  const start = jsonText.indexOf(startMarker);
  const end = jsonText.lastIndexOf(');');
  if (start === -1 || end === -1) return [];

  const payload = jsonText.slice(start + startMarker.length, end);
  let data: { table?: { cols?: Array<{ label?: string; type?: string }>; rows?: Array<{ c?: Array<{ v?: unknown } | null> }> } };
  try {
    data = JSON.parse(payload);
  } catch {
    return [];
  }

  const cols = data?.table?.cols ?? [];
  const gvizRows = data?.table?.rows ?? [];

  const normalize = (cell: { v?: unknown } | null | undefined): string => {
    const v = cell?.v;
    if (v === null || v === undefined) return '';
    if (typeof v === 'string' && v.startsWith('Date(')) {
      // Date(Y,M,D[,h,m,s]) with month 0-indexed
      const m = /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/.exec(v);
      if (m) {
        const pad = (n: string) => n.padStart(2, '0');
        const dateStr = `${m[1]}-${pad(String(Number(m[2]) + 1))}-${pad(m[3])}`;
        return m[4] !== undefined ? `${dateStr} ${pad(m[4])}:${pad(m[5])}:${pad(m[6])}` : dateStr;
      }
    }
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return String(v);
    return String(v);
  };

  const toRow = (row: { c?: Array<{ v?: unknown } | null> } | undefined): string[] =>
    (row?.c ?? []).map(normalize);

  const hasLabels = cols.some(c => (c.label ?? '').trim().length > 0);

  if (hasLabels) {
    const rows = [cols.map(c => (c.label ?? '').trim())];
    for (const row of gvizRows) rows.push(toRow(row));
    return rows;
  }

  // Master_User: empty column labels -> header is the first data row.
  const rows: string[][] = [];
  for (const row of gvizRows) rows.push(toRow(row));
  return rows;
}

export class MutabaahService {
  // WIB (Waktu Indonesia Barat, UTC+7) helpers
  private static pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  static getWIBTimestampFromDate(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())} ${this.pad(d.getHours())}:${this.pad(d.getMinutes())}:${this.pad(d.getSeconds())}`;
  }

  static getWIBTimestamp(): string {
    return this.getWIBTimestampFromDate(new Date());
  }

  static getWIBDateStr(): string {
    const now = new Date();
    return `${now.getFullYear()}-${this.pad(now.getMonth() + 1)}-${this.pad(now.getDate())}`;
  }

  // Migrate existing localStorage timestamps from UTC to WIB (+7 hours)
  static migrateTimestampsToWIB(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (!raw) return;
      const logs: LogMutabaah[] = JSON.parse(raw);
      let changed = false;
      const migrated = logs.map(log => {
        if (log.Timestamp && (log.Timestamp.includes('T') || log.Timestamp.endsWith('Z'))) {
          const d = new Date(log.Timestamp);
          if (!isNaN(d.getTime())) {
            changed = true;
            return { ...log, Timestamp: this.getWIBTimestampFromDate(d) };
          }
        }
        return log;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(migrated));
      }
    } catch { /* ignore */ }
  }

  // Repair corrupted "Surat (Surat (ayat))" double-format from edit pre-fill bug
  static repairCorruptedMulaiAkhir(val: string): string {
    if (!val) return val;
    // "Al-Fatihah (Al-Fatihah (5))" → "Al-Fatihah (5)"
    const match = val.match(/^(.+?)\s*\((.+?)\s*\((\d+|akhir)\)\s*\)$/);
    if (match) return `${match[1].trim()} (${match[3]})`;
    return val;
  }

  static migrateCorruptedLogs(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (!raw) return;
      const logs: LogMutabaah[] = JSON.parse(raw);
      let changed = false;
      const migrated = logs.map(log => {
        const newLog = { ...log };
        if (log.Tahsin_Mulai) {
          const repaired = this.repairCorruptedMulaiAkhir(log.Tahsin_Mulai);
          if (repaired !== log.Tahsin_Mulai) { newLog.Tahsin_Mulai = repaired; changed = true; }
        }
        if (log.Tahsin_Akhir) {
          const repaired = this.repairCorruptedMulaiAkhir(log.Tahsin_Akhir);
          if (repaired !== log.Tahsin_Akhir) { newLog.Tahsin_Akhir = repaired; changed = true; }
        }
        if (log.Tahfidh_Mulai) {
          const repaired = this.repairCorruptedMulaiAkhir(log.Tahfidh_Mulai);
          if (repaired !== log.Tahfidh_Mulai) { newLog.Tahfidh_Mulai = repaired; changed = true; }
        }
        if (log.Tahfidh_Akhir) {
          const repaired = this.repairCorruptedMulaiAkhir(log.Tahfidh_Akhir);
          if (repaired !== log.Tahfidh_Akhir) { newLog.Tahfidh_Akhir = repaired; changed = true; }
        }
        return newLog;
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(migrated));
      }
    } catch { /* ignore */ }
  }

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

  // ============ BROADCAST REMINDER (Kurikulum only) ============
  static getJadwal(): JadwalPelajaran[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.JADWAL);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Pecah sel Guru jadwal yang bisa berisi >1 nama, mis. "PUTRA RIZKIANSYAH & ANGGA PURNAMA" */
  static splitGuruCell(cell: string): string[] {
    if (!cell) return [];
    return cell
      .split(/\s*[&/,;+|\n]+\s*|\s+dan\s+/i)
      .map(s => s.trim())
      .filter(Boolean);
  }

  static normalizeNameKey(name: string): string {
    return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /** Mapel Al-Qur'an: tahan varian "AL-QUR'AN / Al Qur'an / ALQURAN" */
  static isMapelQuran(mapel: string): boolean {
    const norm = (mapel || '').toUpperCase().replace(/[\s'\-`_]/g, '');
    return norm.includes('ALQURAN') || norm.includes('QURAN');
  }

  static normalizeHari(hari: string): string {
    return (hari || '').trim().toUpperCase();
  }

  static getHariIndonesia(dateStr: string): string {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const hari = dt.toLocaleDateString('id-ID', { weekday: 'long' });
      return this.normalizeHari(hari);
    } catch {
      return '';
    }
  }

  static formatTanggalIndonesia(dateStr: string): string {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  /** Sapaan berdasarkan Gender_Guru (L/P): L → Ust., P → Ustz. */
  static getGuruTitle(genderGuru?: string): string {
    const g = (genderGuru || '').trim().toUpperCase();
    if (g === 'L' || g === 'LAKI-LAKI' || g === 'LAKI LAKI' || g === 'IKHWAN') return 'Ust.';
    if (g === 'P' || g === 'PEREMPUAN' || g === 'AKHWAT') return 'Ustz.';
    return '';
  }

  static isKurikulumAccount(email?: string): boolean {
    return (email || '').trim().toLowerCase() === 'kurikulum.alwildan29@gmail.com';
  }

  static getBroadcastStatus(tanggal: string, onlyPiket = true): Array<{
    guruKey: string;
    namaGuru: string;
    genderGuru: string;
    totalSiswa: number;
    sudahIsi: number;
    belumList: MasterSiswa[];
    sudahList: MasterSiswa[];
    jadwalHariIni: JadwalPelajaran[];
    isPiket: boolean;
  }> {
    const hari = this.getHariIndonesia(tanggal);
    const jadwal = this.getJadwal();
    const siswaList = this.getSiswa();
    const logs = this.getLogs();

    // 1. Guru piket Al-Qur'an hari itu (dari Jadwal)
    const piketMap = new Map<string, { display: string; rows: JadwalPelajaran[] }>();
    for (const row of jadwal) {
      if (this.normalizeHari(row.Hari) !== hari) continue;
      if (!this.isMapelQuran(row.Mapel)) continue;
      for (const nama of this.splitGuruCell(row.Guru)) {
        const key = this.normalizeNameKey(nama);
        if (!key) continue;
        const existing = piketMap.get(key);
        if (existing) {
          existing.rows.push(row);
        } else {
          piketMap.set(key, { display: nama.trim(), rows: [row] });
        }
      }
    }

    // 2. Kelompokkan siswa by Guru plot (Master_Siswa.Guru), cek ≥1 log di tanggal tsb
    const filledIds = new Set(
      logs.filter(l => l.Tanggal_Mutabaah === tanggal && l.ID_Siswa).map(l => String(l.ID_Siswa).trim())
    );
    const byGuru = new Map<string, { display: string; gender: string; siswa: MasterSiswa[] }>();
    const tanpaPlot: MasterSiswa[] = [];
    for (const s of siswaList) {
      const gRaw = (s.Guru || '').trim();
      if (!gRaw) {
        tanpaPlot.push(s);
        continue;
      }
      const key = this.normalizeNameKey(gRaw);
      const existing = byGuru.get(key);
      if (existing) {
        existing.siswa.push(s);
        if (!existing.gender && s.Gender_Guru) existing.gender = s.Gender_Guru;
      } else {
        byGuru.set(key, { display: gRaw, siswa: [s], gender: s.Gender_Guru || '' });
      }
    }

    // 3. Susun status per guru
    const result: ReturnType<typeof this.getBroadcastStatus> = [];
    for (const [key, group] of byGuru) {
      const piket = piketMap.get(key);
      const isPiket = Boolean(piket);
      if (onlyPiket && !isPiket) continue;
      const belumList = group.siswa.filter(s => !filledIds.has(String(s.ID_Siswa).trim()));
      const sudahList = group.siswa.filter(s => filledIds.has(String(s.ID_Siswa).trim()));
      belumList.sort((a, b) => a.Nama_Siswa.localeCompare(b.Nama_Siswa, 'id'));
      result.push({
        guruKey: key,
        namaGuru: piket?.display || group.display,
        genderGuru: group.gender,
        totalSiswa: group.siswa.length,
        sudahIsi: sudahList.length,
        belumList,
        sudahList,
        jadwalHariIni: piket?.rows || [],
        isPiket
      });
    }
    // Guru piket tapi tidak punya plot siswa → tampil informatif (0 siswa)
    for (const [key, piket] of piketMap) {
      if (byGuru.has(key)) continue;
      if (!onlyPiket) continue;
      result.push({
        guruKey: key,
        namaGuru: piket.display,
        genderGuru: '',
        totalSiswa: 0,
        sudahIsi: 0,
        belumList: [],
        sudahList: [],
        jadwalHariIni: piket.rows,
        isPiket: true
      });
    }
    if (tanpaPlot.length > 0) {
      tanpaPlot.sort((a, b) => a.Nama_Siswa.localeCompare(b.Nama_Siswa, 'id'));
      result.push({
        guruKey: '__tanpa_plot__',
        namaGuru: 'Tanpa Plot Guru',
        genderGuru: '',
        totalSiswa: tanpaPlot.length,
        sudahIsi: tanpaPlot.filter(s => filledIds.has(String(s.ID_Siswa).trim())).length,
        belumList: tanpaPlot.filter(s => !filledIds.has(String(s.ID_Siswa).trim())),
        sudahList: tanpaPlot.filter(s => filledIds.has(String(s.ID_Siswa).trim())),
        jadwalHariIni: [],
        isPiket: false
      });
    }
    // Belum lengkap dulu, lalu lengkap; abjad sebagai tiebreaker
    result.sort((a, b) => {
      const aDone = a.totalSiswa > 0 && a.belumList.length === 0 ? 1 : 0;
      const bDone = b.totalSiswa > 0 && b.belumList.length === 0 ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      if (a.guruKey === '__tanpa_plot__') return 1;
      if (b.guruKey === '__tanpa_plot__') return -1;
      return a.namaGuru.localeCompare(b.namaGuru, 'id');
    });
    return result;
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

  static updateLog(id: string, updates: Partial<LogMutabaah>): LogMutabaah | null {
    const logs = this.getLogs();
    const idx = logs.findIndex(l => l.ID_Log === id);
    if (idx === -1) return null;
    logs[idx] = { ...logs[idx], ...updates };
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    // Send update webhook
    this.sendUpdateToWebhook(logs[idx]);
    return logs[idx];
  }

  static deleteLog(id: string): boolean {
    const logs = this.getLogs();
    const filtered = logs.filter(l => l.ID_Log !== id);
    if (filtered.length === logs.length) return false;
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(filtered));
    // Send delete webhook
    this.sendDeleteToWebhook(id);
    return true;
  }

  static getStudentRecentLogs(nis: string, limit = 20): LogMutabaah[] {
    const logs = this.getLogs();
    const filtered = logs.filter(l => String(l.ID_Siswa).trim() === String(nis).trim());
    filtered.sort((a, b) => {
      const dateCmp = String(b.Tanggal_Mutabaah || '').localeCompare(String(a.Tanggal_Mutabaah || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(b.Timestamp || '').localeCompare(String(a.Timestamp || ''));
    });
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

    const timestampStr = this.getWIBTimestamp();
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
    const baseTimestamp = this.getWIBTimestamp();

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

  // Pending action queue (webhook retry for create/update/delete)
  static getPendingActions(): PendingAction[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PENDING_LOGS);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      // Migration: if old format (LogMutabaah[]), convert to PendingAction[]
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].ID_Log && !parsed[0].action) {
        const migrated: PendingAction[] = parsed.map((log: LogMutabaah) => ({
          action: 'create' as const,
          log,
          timestamp: log.Timestamp
        }));
        this.savePendingActions(migrated);
        return migrated;
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** @deprecated Use getPendingActions() */
  static getPendingLogs(): LogMutabaah[] {
    return this.getPendingActions().map(a => a.log);
  }

  static getPendingLogsCount(): number {
    return this.getPendingActions().length;
  }

  private static savePendingActions(actions: PendingAction[]): void {
    if (actions.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PENDING_LOGS, JSON.stringify(actions));
    } else {
      localStorage.removeItem(STORAGE_KEYS.PENDING_LOGS);
    }
  }

  private static addToPendingActions(actions: PendingAction[]): void {
    const existing = this.getPendingActions();
    const existingIds = new Set(existing.map(a => a.log.ID_Log));
    const newUnique = actions.filter(a => !existingIds.has(a.log.ID_Log));
    this.savePendingActions([...existing, ...newUnique]);
  }

  /** @deprecated Use addToPendingActions() */
  private static addToPendingLogs(logs: LogMutabaah[]): void {
    this.addToPendingActions(logs.map(log => ({
      action: 'create' as const,
      log,
      timestamp: log.Timestamp
    })));
  }

  static async retryPendingLogs(): Promise<{ success: number; failed: number }> {
    const pending = this.getPendingActions();
    if (pending.length === 0) return { success: 0, failed: 0 };

    const url = this.getWebhookUrl();
    if (!url) return { success: 0, failed: pending.length };

    let success = 0;
    let failed = 0;
    const stillPending: PendingAction[] = [];
    const CHUNK_SIZE = 3;

    for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
      const chunk = pending.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map(action => {
          if (action.action === 'delete') {
            return fetch(url, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ _action: 'delete', ID_Log: action.log.ID_Log })
            });
          }
          if (action.action === 'update') {
            return fetch(url, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ _action: 'update', ...action.log })
            });
          }
          return fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(action.log)
          });
        })
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          success++;
        } else {
          failed++;
          stillPending.push(chunk[idx]);
        }
      });

      if (i + CHUNK_SIZE < pending.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    this.savePendingActions(stillPending);
    return { success, failed };
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
      console.warn('Webhook post failed, adding to pending queue:', log.ID_Log, e);
      this.addToPendingActions([{ action: 'create', log, timestamp: log.Timestamp }]);
    }
  }

  private static async sendUpdateToWebhook(log: LogMutabaah): Promise<void> {
    const url = this.getWebhookUrl();
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ _action: 'update', ...log })
      });
    } catch (e) {
      console.warn('Update webhook failed, adding to pending queue:', log.ID_Log, e);
      this.addToPendingActions([{ action: 'update', log, timestamp: log.Timestamp }]);
    }
  }

  private static async sendDeleteToWebhook(logId: string): Promise<void> {
    const url = this.getWebhookUrl();
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ _action: 'delete', ID_Log: logId })
      });
    } catch (e) {
      console.warn('Delete webhook failed, adding to pending queue:', logId, e);
      // For delete, we need to store the ID_Log to retry later
      this.addToPendingActions([{ action: 'delete', log: { ID_Log: logId } as LogMutabaah, timestamp: this.getWIBTimestamp() }]);
    }
  }

  private static async sendLogsSequentially(logs: LogMutabaah[]): Promise<void> {
    const url = this.getWebhookUrl();
    if (!url || logs.length === 0) return;

    const CHUNK_SIZE = 3;
    const failedActions: PendingAction[] = [];

    for (let i = 0; i < logs.length; i += CHUNK_SIZE) {
      const chunk = logs.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map(log =>
          fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(log)
          })
        )
      );

      results.forEach((result, idx) => {
        if (result.status === 'rejected') {
          console.warn(`Log ${chunk[idx].ID_Log} post failed:`, result.reason);
          failedActions.push({ action: 'create', log: chunk[idx], timestamp: chunk[idx].Timestamp });
        }
      });

      if (i + CHUNK_SIZE < logs.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    if (failedActions.length > 0) {
      this.addToPendingActions(failedActions);
    }
  }

  // Fetch live data from public Google Sheet CSV with dynamic column parsing
  static async fetchFromGoogleSheets(): Promise<{ success: boolean; message: string }> {
    try {
      const sheets = ['Master_User', 'Master_Siswa', 'Master_Surat', 'Log_Mutabaah', 'Jadwal_Pelajaran'];
      let fetchedAny = false;
      let htmlDetected = false;

      for (const sheetName of sheets) {
        const cacheBuster = Date.now();
        const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&_t=${cacheBuster}`;
        try {
          const res = await fetch(url);
          if (res.ok) {
            const jsonText = await res.text();
            
            if (jsonText.trim().startsWith('<')) {
              htmlDetected = true;
              continue;
            }

            const rows = parseGvizJson(jsonText).filter(r => r.some(cell => cell.trim().length > 0));
            
            if (rows.length >= 1) {
              fetchedAny = true;

              // --- PARSING SHEET: Master_User ---
              if (sheetName === 'Master_User') {
                const users: MasterUser[] = [];
                const headers = rows[0].map(h => h.toLowerCase().trim());

                // Deteksi indeks kolom berdasarkan kata kunci header
                let idIdx = headers.findIndex(h => h.includes('id'));
                let emailIdx = headers.findIndex(h => h.includes('email'));
                let namaIdx = headers.findIndex(h => h.includes('nama') || h.includes('guru'));

                if (emailIdx === -1) emailIdx = 1;
                if (namaIdx === -1) namaIdx = 2;
                if (idIdx === -1) idIdx = 0;

                for (let i = 1; i < rows.length; i++) {
                  const cols = rows[i];
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
                const headers = rows[0].map(h => h.toLowerCase().trim());
                // Deteksi indeks kolom dinamis agar tahan beda urutan/kapitalisasi header.
                // Kolom baru: Guru (nama pengampu) & Gender_Guru (L/P).
                const findIdx = (keys: string[], exclude?: string[]): number => {
                  const idx = headers.findIndex(h =>
                    keys.some(k => h.includes(k)) && !(exclude || []).some(x => h.includes(x))
                  );
                  return idx;
                };
                let nisIdx = findIdx(['nis', 'id_siswa', 'id siswa']);
                let namaIdx = findIdx(['nama_siswa', 'nama siswa', 'nama']);
                let kelasIdx = findIdx(['kelas', 'id_kelas', 'id kelas']);
                let genderIdx = findIdx(['gender', 'jenis kelamin', 'jk'], ['guru']);
                let guruIdx = findIdx(['guru'], ['gender']);
                let genderGuruIdx = headers.findIndex(h => h.includes('gender') && h.includes('guru'));
                if (genderGuruIdx === -1) genderGuruIdx = headers.findIndex(h =>
                  (h.includes('jk') && h.includes('guru')) || h === 'l/p' || h === 'l-p'
                );
                if (nisIdx === -1) nisIdx = 0;
                if (namaIdx === -1) namaIdx = 1;
                if (kelasIdx === -1) kelasIdx = 2;
                if (genderIdx === -1) genderIdx = 3;
                if (guruIdx === -1) guruIdx = 4;
                if (genderGuruIdx === -1) genderGuruIdx = 5;

                const siswaList: MasterSiswa[] = [];
                for (let i = 1; i < rows.length; i++) {
                  const cols = rows[i];
                  const maxIdx = Math.max(nisIdx, namaIdx);
                  if (cols.length > maxIdx && cols[nisIdx]) {
                    siswaList.push({
                      ID_Siswa: cols[nisIdx].trim(),
                      Nama_Siswa: (cols[namaIdx] || '').trim(),
                      Kelas: cols[kelasIdx] ? cols[kelasIdx].trim() : "Kelas 1",
                      Kelompok_Halaqah: "",
                      Gender: cols[genderIdx] ? cols[genderIdx].trim() : "",
                      Guru: cols[guruIdx] ? cols[guruIdx].trim() : "",
                      Gender_Guru: cols[genderGuruIdx] ? cols[genderGuruIdx].trim().toUpperCase() : ""
                    });
                  }
                }
                if (siswaList.length > 0) {
                  localStorage.setItem(STORAGE_KEYS.SISWA, JSON.stringify(siswaList));
                }

              // --- PARSING SHEET: Log_Mutabaah ---
              } else if (sheetName === 'Log_Mutabaah') {
                const logsFromSheet: LogMutabaah[] = [];
                for (let i = 1; i < rows.length; i++) {
                  const cols = rows[i];
                  if (cols.length >= 1 && (cols[0] || cols[2] || cols[5] || cols[6])) {
                    logsFromSheet.push({
                      ID_Log: cols[0] ? cols[0].trim() : `LOG-SHEET-${i}`,
                      Timestamp: cols[1] ? cols[1].trim() : this.getWIBTimestamp(),
                      Tanggal_Mutabaah: cols[2] ? cols[2].trim() : this.getWIBDateStr(),
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
                // Merge: sheet logs + orphan pending logs (pending logs not yet in sheet)
                const sheetLogIds = new Set(logsFromSheet.map(l => l.ID_Log));
                const orphanPending = this.getPendingLogs().filter(l => !sheetLogIds.has(l.ID_Log));
                const mergedLogs = [...logsFromSheet, ...orphanPending];

                // Filter out logs older than retention period
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_RETENTION_DAYS);
                const cutoffStr = `${cutoffDate.getFullYear()}-${this.pad(cutoffDate.getMonth() + 1)}-${this.pad(cutoffDate.getDate())}`;
                const filteredLogs = mergedLogs.filter(l => (l.Tanggal_Mutabaah || '') >= cutoffStr);

                localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(filteredLogs));

                // Clean pending queue: keep only orphan pending (not in sheet)
                const orphanActions: PendingAction[] = orphanPending.map(l => ({
                  action: 'create' as const,
                  log: l,
                  timestamp: l.Timestamp
                }));
                this.savePendingActions(orphanActions);
              // --- PARSING SHEET: Jadwal_Pelajaran ---
              } else if (sheetName === 'Jadwal_Pelajaran') {
                const headers = rows[0].map(h => h.toLowerCase().trim());
                const hIdx = (keys: string[]): number => {
                  const idx = headers.findIndex(h => keys.some(k => h.includes(k)));
                  return idx;
                };
                let hariIdx = hIdx(['hari']);
                let mulaiIdx = hIdx(['waktu_mulai', 'waktu mulai', 'mulai', 'jam_mulai', 'jam mulai']);
                let selesaiIdx = hIdx(['waktu_selesai', 'waktu selesai', 'selesai', 'jam_selesai', 'jam selesai']);
                let kelasIdx = hIdx(['id_kelas', 'id kelas', 'kelas']);
                let mapelIdx = hIdx(['mapel', 'pelajaran', 'mata pelajaran', 'maple']);
                let guruIdx = headers.findIndex(h => h.includes('guru') && !h.includes('gender'));
                if (hariIdx === -1) hariIdx = 0;
                if (mulaiIdx === -1) mulaiIdx = 1;
                if (selesaiIdx === -1) selesaiIdx = 2;
                if (kelasIdx === -1) kelasIdx = 3;
                if (mapelIdx === -1) mapelIdx = 4;
                if (guruIdx === -1) guruIdx = 5;

                const jadwal: JadwalPelajaran[] = [];
                for (let i = 1; i < rows.length; i++) {
                  const cols = rows[i];
                  const hari = cols[hariIdx] ? cols[hariIdx].trim() : '';
                  const mapel = cols[mapelIdx] ? cols[mapelIdx].trim() : '';
                  const guru = cols[guruIdx] ? cols[guruIdx].trim() : '';
                  if (!hari && !mapel && !guru) continue;
                  jadwal.push({
                    Hari: hari,
                    Waktu_Mulai: cols[mulaiIdx] ? cols[mulaiIdx].trim() : '',
                    Waktu_Selesai: cols[selesaiIdx] ? cols[selesaiIdx].trim() : '',
                    ID_Kelas: cols[kelasIdx] ? cols[kelasIdx].trim() : '',
                    Mapel: mapel,
                    Guru: guru
                  });
                }
                // Simpan walau kosong agar filter piket tahu sheet sudah disinkron
                localStorage.setItem(STORAGE_KEYS.JADWAL, JSON.stringify(jadwal));
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

  static getStorageSizeBytes(): number {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mutabaah_')) {
        const value = localStorage.getItem(key);
        if (value) {
          total += (key.length + value.length) * 2;
        }
      }
    }
    return total;
  }

  static archiveOldLogs(): LogMutabaah[] {
    const logs = this.getLogs();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_RETENTION_DAYS);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const retained: LogMutabaah[] = [];
    const archived: LogMutabaah[] = [];

    for (const log of logs) {
      const logDate = log.Tanggal_Mutabaah || '';
      if (logDate < cutoffStr) {
        archived.push(log);
      } else {
        retained.push(log);
      }
    }

    if (archived.length > 0) {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(retained));
    }

    return archived;
  }

  static autoCleanupIfNeeded(): void {
    try {
      const size = this.getStorageSizeBytes();
      if (size > STORAGE_SIZE_WARN_BYTES) {
        console.warn(`localStorage size (${(size / 1024 / 1024).toFixed(2)}MB) exceeded threshold. Archiving logs older than ${ARCHIVE_RETENTION_DAYS} days.`);
        const archived = this.archiveOldLogs();
        if (archived.length > 0) {
          console.warn(`Archived ${archived.length} old logs.`);
        }
      }
    } catch (e) {
      console.warn('autoCleanupIfNeeded failed:', e);
    }
  }
}