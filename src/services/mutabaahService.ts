import { MasterUser, MasterSiswa, MasterSurat, LogMutabaah, MutabaahFormData, StudentSummary, PendingAction, JadwalPelajaran } from '../types';
import { INITIAL_USERS, INITIAL_SISWA, INITIAL_LOGS } from '../data/initialData';
import { MASTER_SURAT } from '../data/masterSurat';
import { getJakartaWeekId } from '../utils/weeklyRefresh';

const SPREADSHEET_ID = "1wJMBxsQD4u_shFefiDeTpJYqgB8y1InC7De2XpXysCE";
const DEFAULT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxgCPxeO62MewnbWBkYt9NYS157YHyT8-4ieS5ZLM9tqNFhHzgWdCFApM-Xiwea7o3a/exec";

const ARCHIVE_RETENTION_DAYS = 14;
const STORAGE_SIZE_WARN_BYTES = 4 * 1024 * 1024;
// Pending per-pekan (Senin-Minggu) + grace 1 pekan agar input Minggu malam
// masih bisa di-sync Senin. Prune memakai Tanggal_Mutabaah.

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

  /**
   * Tanggal awal yang perlu diambil dari Sheet untuk Log_Mutabaah:
   * window retensi, DIPERPANJANG bila ada log pending yang lebih lama
   * (agar pending rapet/backdate tetap bisa diverifikasi masuk Sheet).
   */
  static getLogFetchCutoffStr(): string {
    const d = new Date();
    d.setDate(d.getDate() - ARCHIVE_RETENTION_DAYS);
    let cutoff = `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
    try {
      for (const a of this.getPendingActions()) {
        const t = a.log?.Tanggal_Mutabaah;
        if (t && t < cutoff) cutoff = t;
      }
    } catch { /* abaikan */ }
    return cutoff;
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

  /**
   * Kunci kanonis nama guru: tahan beda gelar/sapaan agar Master_Siswa.Guru
   * (bergelar) dan Jadwal_Pelajaran.Guru (tanpa gelar) tetap dianggap sama.
   * - "PUTRA RIZKIANSYAH, S.Pd." == "PUTRA RIZKIANSYAH"
   * - "Dr. SAHRI SUWANDI, M.Pd." == "Dr. SAHRI SUWANDI"
   * Inisial ("M. ALMUFARISIN") & apostrof ("NISI JUNIATUN NISA'") dipertahankan.
   */
  static canonicalGuruKey(name: string): string {
    let s = (name || '').trim().toLowerCase();
    if (!s) return '';
    // Inti nama = sebelum gelar (setelah koma pertama)
    s = s.split(',')[0];
    // Buang sapaan/gelar di depan
    s = s.replace(/^\s*(dr|dra|drs|ust|ustadz|ustadzah|ustaz|ustazah|ustzh|h|hj|pak|bu|bpk|ibu)\.?\s+/, '');
    // Buang singkatan bergelar yang masih menempel (mis. "s.pd.", "m.pd.i", "s.ag")
    s = s.replace(/\b[a-z]{1,3}(?:\.[a-z]{1,3}){1,4}\.?/g, ' ');
    // Normalisasi titik & spasi (apostrof tetap dipertahankan)
    return s.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
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

  /** Normalisasi jam ke HH:MM (terima "08.00", "8:00", "08:00:00") */
  static normalizeTimeHHMM(t: string): string {
    const s = (t || '').trim().replace('.', ':');
    const m = /^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?/.exec(s);
    if (!m) return (t || '').trim();
    const hh = m[1].padStart(2, '0');
    const mm = (m[2] ?? '00').padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /** "08:00-09:30 | Kelas 7A" — mapel tidak ditampilkan */
  static formatJadwalLine(j: JadwalPelajaran): string {
    const mulai = j.Waktu_Mulai ? this.normalizeTimeHHMM(j.Waktu_Mulai) : '';
    const selesai = j.Waktu_Selesai ? this.normalizeTimeHHMM(j.Waktu_Selesai) : '';
    const jam = [mulai, selesai].filter(Boolean).join('-');
    const kelasRaw = (j.ID_Kelas || '').trim();
    const kelas = /^kelas\b/i.test(kelasRaw) || !kelasRaw ? kelasRaw : `Kelas ${kelasRaw}`;
    return [jam, kelas].filter(Boolean).join(' | ');
  }

  /** Urutan siswa: Kelas dulu (numeric), lalu Nama */
  static compareSiswaByKelasNama(a: MasterSiswa, b: MasterSiswa): number {
    const kelasCmp = (a.Kelas || '').localeCompare(b.Kelas || '', 'id', { numeric: true });
    if (kelasCmp !== 0) return kelasCmp;
    return (a.Nama_Siswa || '').localeCompare(b.Nama_Siswa || '', 'id');
  }

  /** Normalisasi ID siswa untuk pencocokan toleran (abaikan spasi & nol depan) */
  static normalizeIdSiswa(id: string | number | null | undefined): string {
    const s = String(id ?? '').replace(/\s+/g, '');
    if (!s) return '';
    const t = s.replace(/^0+/, '');
    return t === '' ? s : t;
  }

  /** Samakan ID siswa secara toleran: exact-trim dulu, lalu versi ternormalisasi */
  static isSameSiswaId(a: string | number | null | undefined, b: string | number | null | undefined): boolean {
    const sa = String(a ?? '').trim();
    const sb = String(b ?? '').trim();
    if (sa === sb) return true;
    const na = this.normalizeIdSiswa(sa);
    const nb = this.normalizeIdSiswa(sb);
    return na !== '' && na === nb;
  }

  /** Kunci pembanding kelas: "Kelas 7A" ↔ "7A" dianggap sama */
  static normalizeKelasKey(kelas: string): string {
    return (kelas || '').trim().toUpperCase().replace(/^KELAS\s+/, '').replace(/\s+/g, '');
  }

  /**
   * Saring jadwal hanya untuk kelas yang masih ada siswa belum isi.
   * Fallback: jika tidak ada yang cocok (beda penulisan kelas), tampilkan semua
   * agar seksi jadwal tidak hilang kosong.
   */
  static filterJadwalBelumTerisi(jadwalHariIni: JadwalPelajaran[], belumList: MasterSiswa[]): JadwalPelajaran[] {
    if (jadwalHariIni.length === 0 || belumList.length === 0) return jadwalHariIni;
    const kelasBelum = new Set(belumList.map(s => this.normalizeKelasKey(s.Kelas)).filter(Boolean));
    const filtered = jadwalHariIni.filter(j => kelasBelum.has(this.normalizeKelasKey(j.ID_Kelas)));
    return filtered.length > 0 ? filtered : jadwalHariIni;
  }

  /** Gabung jadwal yang jamnya sama: "08:00-09:30 | Kelas 7A, Kelas 7B" */
  static formatJadwalLinesGrouped(rows: JadwalPelajaran[]): string[] {
    const groups = new Map<string, { jam: string; kelas: string[] }>();
    for (const j of rows) {
      const mulai = j.Waktu_Mulai ? this.normalizeTimeHHMM(j.Waktu_Mulai) : '';
      const selesai = j.Waktu_Selesai ? this.normalizeTimeHHMM(j.Waktu_Selesai) : '';
      const jam = [mulai, selesai].filter(Boolean).join('-');
      const kelasRaw = (j.ID_Kelas || '').trim();
      const kelas = /^kelas\b/i.test(kelasRaw) || !kelasRaw ? kelasRaw : `Kelas ${kelasRaw}`;
      const key = jam;
      const existing = groups.get(key);
      if (existing) {
        if (kelas && !existing.kelas.includes(kelas)) existing.kelas.push(kelas);
      } else {
        groups.set(key, { jam, kelas: kelas ? [kelas] : [] });
      }
    }
    const lines: string[] = [];
    for (const g of groups.values()) {
      const kelasSorted = [...g.kelas].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
      lines.push([g.jam, kelasSorted.join(', ')].filter(Boolean).join(' | '));
    }
    return lines.filter(Boolean);
  }

  static getBroadcastStatus(tanggal: string, onlyScheduled = true): Array<{
    guruKey: string;
    namaGuru: string;
    genderGuru: string;
    totalSiswa: number;
    sudahIsi: number;
    belumList: MasterSiswa[];
    sudahList: MasterSiswa[];
    jadwalHariIni: JadwalPelajaran[];
    isScheduled: boolean;
  }> {
    const hari = this.getHariIndonesia(tanggal);
    const jadwal = this.getJadwal();
    const siswaList = this.getSiswa();
    const logs = this.getLogs();

    // Nama tampil kanonis dari Master_User (bergelar) bila tersedia
    const userDisplayByKey = new Map<string, string>();
    for (const u of this.getUsers()) {
      const k = this.canonicalGuruKey(u.Nama_Guru);
      if (k && !userDisplayByKey.has(k)) userDisplayByKey.set(k, u.Nama_Guru);
    }

    // 1. Jadwal mengajar (KBM) Al-Qur'an hari itu (dari Jadwal_Pelajaran)
    const scheduleMap = new Map<string, { display: string; rows: JadwalPelajaran[] }>();
    for (const row of jadwal) {
      if (this.normalizeHari(row.Hari) !== hari) continue;
      if (!this.isMapelQuran(row.Mapel)) continue;
      for (const nama of this.splitGuruCell(row.Guru)) {
        const key = this.canonicalGuruKey(nama);
        if (!key) continue;
        const existing = scheduleMap.get(key);
        if (existing) {
          existing.rows.push(row);
        } else {
          scheduleMap.set(key, { display: nama.trim(), rows: [row] });
        }
      }
    }

    // Sort jadwal mengajar tiap guru by waktu mulai (ternormalisasi HH:MM)
    for (const sched of scheduleMap.values()) {
      sched.rows.sort((a, b) =>
        this.normalizeTimeHHMM(a.Waktu_Mulai).localeCompare(this.normalizeTimeHHMM(b.Waktu_Mulai))
      );
    }

    // Himpunan kelas terjadwal per guru hari itu (kunci ternormalisasi)
    const scheduledClasses = new Map<string, Set<string>>();
    for (const [key, sched] of scheduleMap) {
      scheduledClasses.set(
        key,
        new Set(sched.rows.map(r => this.normalizeKelasKey(r.ID_Kelas)).filter(Boolean))
      );
    }

    // 2. Kelompokkan siswa by Guru plot (Master_Siswa.Guru), cek ≥1 log di tanggal tsb.
    // Pencocokan ID toleran (spasi/nol depan) agar beda format tulis tidak menghilangkan data.
    const filledIdList = logs
      .filter(l => l.Tanggal_Mutabaah === tanggal && l.ID_Siswa)
      .map(l => String(l.ID_Siswa).trim());
    const isFilled = (id: string): boolean => filledIdList.some(f => this.isSameSiswaId(f, id));
    const byGuru = new Map<string, { display: string; gender: string; siswa: MasterSiswa[] }>();
    const tanpaPlot: MasterSiswa[] = [];
    for (const s of siswaList) {
      const gRaw = (s.Guru || '').trim();
      if (!gRaw) {
        tanpaPlot.push(s);
        continue;
      }
      const key = this.canonicalGuruKey(gRaw);
      const existing = byGuru.get(key);
      if (existing) {
        existing.siswa.push(s);
        if (!existing.gender && s.Gender_Guru) existing.gender = s.Gender_Guru;
      } else {
        byGuru.set(key, { display: gRaw, siswa: [s], gender: s.Gender_Guru || '' });
      }
    }

    // 3. Susun status per guru.
    // STRICT: siswa masuk hitungan iff pasangan (guru, kelas)-nya ada di
    // jadwal KBM hari itu. Kelas yang tidak terjadwal tidak ikut ter-broadcast.
    const result: ReturnType<typeof this.getBroadcastStatus> = [];
    for (const [key, group] of byGuru) {
      const sched = scheduleMap.get(key);
      const isScheduled = Boolean(sched);
      if (onlyScheduled && !isScheduled) continue;
      let scoped = group.siswa;
      if (onlyScheduled) {
        const kelasSet = scheduledClasses.get(key);
        if (kelasSet && kelasSet.size > 0) {
          const inScope = group.siswa.filter(s => kelasSet.has(this.normalizeKelasKey(s.Kelas)));
          // Fallback mismatch penulisan kelas: bila tak ada yang cocok,
          // pakai semua agar tidak ada siswa hilang diam-diam.
          scoped = inScope.length > 0 ? inScope : group.siswa;
        }
      }
      const belumList = scoped.filter(s => !isFilled(String(s.ID_Siswa).trim()));
      const sudahList = scoped.filter(s => isFilled(String(s.ID_Siswa).trim()));
      belumList.sort((a, b) => this.compareSiswaByKelasNama(a, b));
      sudahList.sort((a, b) => this.compareSiswaByKelasNama(a, b));
      result.push({
        guruKey: key,
        namaGuru: userDisplayByKey.get(key) || sched?.display || group.display,
        genderGuru: group.gender,
        totalSiswa: scoped.length,
        sudahIsi: sudahList.length,
        belumList,
        sudahList,
        jadwalHariIni: sched?.rows || [],
        isScheduled
      });
    }
    // Guru mengajar tapi tidak punya plot siswa → tampil informatif (0 siswa)
    for (const [key, sched] of scheduleMap) {
      if (byGuru.has(key)) continue;
      if (!onlyScheduled) continue;
      result.push({
        guruKey: key,
        namaGuru: userDisplayByKey.get(key) || sched.display,
        genderGuru: '',
        totalSiswa: 0,
        sudahIsi: 0,
        belumList: [],
        sudahList: [],
        jadwalHariIni: sched.rows,
        isScheduled: true
      });
    }
    // Tanpa plot guru tidak punya pasangan jadwal → keluar dari mode terjadwal
    if (tanpaPlot.length > 0 && !onlyScheduled) {
      tanpaPlot.sort((a, b) => this.compareSiswaByKelasNama(a, b));
      result.push({
        guruKey: '__tanpa_plot__',
        namaGuru: 'Tanpa Plot Guru',
        genderGuru: '',
        totalSiswa: tanpaPlot.length,
        sudahIsi: tanpaPlot.filter(s => isFilled(String(s.ID_Siswa).trim())).length,
        belumList: tanpaPlot.filter(s => !isFilled(String(s.ID_Siswa).trim())),
        sudahList: tanpaPlot.filter(s => isFilled(String(s.ID_Siswa).trim())),
        jadwalHariIni: [],
        isScheduled: false
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
    // Masuk antrian dulu (enqueue-first), lalu coba kirim. Retry yang menentukan sukses.
    this.addToPendingActions([{ action: 'update', log: logs[idx], timestamp: logs[idx].Timestamp }]);
    this.sendUpdateToWebhook(logs[idx]);
    return logs[idx];
  }

  static deleteLog(id: string): boolean {
    const logs = this.getLogs();
    const filtered = logs.filter(l => l.ID_Log !== id);
    if (filtered.length === logs.length) return false;
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(filtered));
    // Masuk antrian dulu agar tidak hilang saat offline
    this.addToPendingActions([{ action: 'delete', log: { ID_Log: id } as LogMutabaah, timestamp: this.getWIBTimestamp() }]);
    this.sendDeleteToWebhook(id);
    return true;
  }

  static getStudentRecentLogs(nis: string, limit = 20): LogMutabaah[] {
    const logs = this.getLogs();
    const filtered = logs.filter(l => this.isSameSiswaId(l.ID_Siswa, nis));
    filtered.sort((a, b) => {
      const dateCmp = String(b.Tanggal_Mutabaah || '').localeCompare(String(a.Tanggal_Mutabaah || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(b.Timestamp || '').localeCompare(String(a.Timestamp || ''));
    });
    return filtered.slice(0, limit);
  }

  static getStudentSummary(nis: string): StudentSummary {
    const studentLogs = this.getLogs().filter(l => this.isSameSiswaId(l.ID_Siswa, nis));
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

    // Enqueue-first: aman offline, Sync 1x yang menentukan sukses via retry+verifikasi
    this.addToPendingActions([{ action: 'create', log: newLog, timestamp: newLog.Timestamp }]);
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

    // Enqueue-first agar batch offline tidak hilang saat Sync menimpa dari Sheet
    this.addToPendingActions(newLogs.map(l => ({ action: 'create' as const, log: l, timestamp: l.Timestamp })));
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

  /**
   * Gabung antrian dengan coalesce agar urutan Sync 1x tetap benar:
   * - create + update => create versi terbaru
   * - create + delete => hapus keduanya (belum pernah sync, tidak perlu kirim)
   * - update/delete setelah create yang sudah terkirim => jadi update/delete
   * - update beruntun => versi terbaru saja
   */
  private static addToPendingActions(actions: PendingAction[]): void {
    const map = new Map<string, PendingAction>();
    for (const a of this.getPendingActions()) {
      if (a?.log?.ID_Log) map.set(a.log.ID_Log, a);
    }
    for (const incoming of actions) {
      const id = incoming?.log?.ID_Log;
      if (!id) continue;
      const prev = map.get(id);
      if (!prev) {
        map.set(id, incoming);
        continue;
      }
      // Coalesce berdasarkan pasangan (prev, incoming)
      if (prev.action === 'create' && incoming.action === 'update') {
        map.set(id, { action: 'create', log: incoming.log, timestamp: incoming.timestamp });
      } else if (prev.action === 'create' && incoming.action === 'delete') {
        map.delete(id);
      } else if (prev.action === 'create' && incoming.action === 'create') {
        map.set(id, incoming);
      } else if (prev.action === 'update' && incoming.action === 'delete') {
        map.set(id, incoming);
      } else if (prev.action === 'delete' && incoming.action === 'create') {
        map.set(id, { action: 'update', log: incoming.log, timestamp: incoming.timestamp });
      } else {
        map.set(id, incoming);
      }
    }
    this.savePendingActions([...map.values()]);
  }

  /** @deprecated Use addToPendingActions() */
  private static addToPendingLogs(logs: LogMutabaah[]): void {
    this.addToPendingActions(logs.map(log => ({
      action: 'create' as const,
      log,
      timestamp: log.Timestamp
    })));
  }

  /** Senin (YYYY-MM-DD) dari `daysAgo` hari lalu dalam zona WIB. */
  private static getMondayStrDaysAgo(daysAgo: number): string {
    const d = new Date(Date.now() - daysAgo * 86400000);
    return getJakartaWeekId(d);
  }

  /**
   * Prune pending per-pekan (Senin-Minggu fix) + grace 1 pekan.
   * Hapus otomatis pending yang Tanggal_Mutabaah < Senin pekan lalu,
   * agar input Minggu malam masih bisa di-sync Senin.
   * Return jumlah yang dibuang (untuk toast info).
   */
  static pruneExpiredPendingByWeek(): { removed: number } {
    try {
      const pending = this.getPendingActions();
      if (pending.length === 0) return { removed: 0 };
      const cutoffMonday = this.getMondayStrDaysAgo(7); // Senin pekan lalu
      const kept = pending.filter(a => {
        const tgl = (a.log?.Tanggal_Mutabaah || '').slice(0, 10);
        // Tanpa tanggal dianggap basi agar tidak menumpuk selamanya
        if (!tgl) return false;
        return tgl >= cutoffMonday;
      });
      const removed = pending.length - kept.length;
      if (removed > 0) this.savePendingActions(kept);
      return { removed };
    } catch {
      return { removed: 0 };
    }
  }

  static async retryPendingLogs(): Promise<{ success: number; failed: number }> {
    // Buang yang basi dulu agar tidak dikirim sia-sia
    this.pruneExpiredPendingByWeek();
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

    // Verifikasi karena no-cors selalu fulfilled (opaque): pastikan ID
    // create/update benar-benar ada di Sheet, delete benar-benar hilang.
    // Jika fetch verifikasi gagal (offline), pertahankan hasil POST apa adanya.
    if (success > 0) {
      try {
        const verifiedIds = await this.fetchSheetLogIds();
        if (verifiedIds !== null) {
          const correctedPending: PendingAction[] = [...stillPending];
          let verifiedSuccess = 0;
          // Ambil kandidat sukses dari pending awal (bukan stillPending)
          const candidateSuccess: PendingAction[] = [];
          const stillIds = new Set(stillPending.map(a => a.log.ID_Log));
          for (const a of pending) {
            if (!stillIds.has(a.log.ID_Log)) candidateSuccess.push(a);
          }
          for (const a of candidateSuccess) {
            const exists = verifiedIds.has(String(a.log.ID_Log));
            if (a.action === 'delete') {
              if (!exists) verifiedSuccess++;
              else { correctedPending.push(a); failed++; success--; }
            } else {
              if (exists) verifiedSuccess++;
              else { correctedPending.push(a); failed++; success--; }
            }
          }
          void verifiedSuccess;
          this.savePendingActions(correctedPending);
          return { success, failed };
        }
      } catch { /* abaikan, pakai hasil POST */ }
    }

    this.savePendingActions(stillPending);
    return { success, failed };
  }

  /** Ambil himpunan ID_Log dari Sheet untuk verifikasi. Null jika gagal/offline. */
  private static async fetchSheetLogIds(): Promise<Set<string> | null> {
    try {
      const cacheBuster = Date.now();
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('Log_Mutabaah')}&_t=${cacheBuster}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const jsonText = await res.text();
      if (jsonText.trim().startsWith('<')) return null;
      const rows = parseGvizJson(jsonText);
      const ids = new Set<string>();
      for (let i = 1; i < rows.length; i++) {
        const id = (rows[i][0] || '').trim();
        if (id) ids.add(id);
      }
      return ids;
    } catch {
      return null;
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
      const fetchedSheets: string[] = [];
      const failedSheets: string[] = [];
      let htmlDetected = false;

      // Batasi pengambilan Log_Mutabaah ke window retensi (+ tanggal log pending)
      // agar payload tidak membengkak (di HP bisa >9MB) dan tetap konsisten.
      const logCutoffStr = this.getLogFetchCutoffStr();

      for (const sheetName of sheets) {
        const cacheBuster = Date.now();
        const isLogSheet = sheetName === 'Log_Mutabaah';
        const buildUrl = (filterLogs: boolean): string => {
          const params = new URLSearchParams();
          params.set('tqx', 'out:json');
          params.set('sheet', sheetName);
          params.set('_t', String(cacheBuster));
          if (filterLogs) params.set('tq', `select * where C >= date '${logCutoffStr}'`);
          return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?${params.toString()}`;
        };
        try {
          const res = await fetch(buildUrl(isLogSheet), { cache: 'no-store' });
          if (!res.ok) {
            failedSheets.push(sheetName);
            continue;
          }
          const jsonText = await res.text();

          if (jsonText.trim().startsWith('<')) {
            htmlDetected = true;
            failedSheets.push(sheetName);
            continue;
          }

          let rows = parseGvizJson(jsonText).filter(r => r.some(cell => cell.trim().length > 0));

          // Fallback: query ber-filter kosong/hanya header → ambil penuh agar
          // data tidak pernah terhapus diam-diam (mis. kolom tanggal berubah tipe).
          if (isLogSheet && rows.length < 2) {
            try {
              const resFull = await fetch(buildUrl(false), { cache: 'no-store' });
              if (resFull.ok) {
                const fullText = await resFull.text();
                if (!fullText.trim().startsWith('<')) {
                  const fullRows = parseGvizJson(fullText).filter(r => r.some(cell => cell.trim().length > 0));
                  if (fullRows.length > rows.length) rows = fullRows;
                }
              }
            } catch { /* pakai hasil ber-filter */ }
          }

          // Hitung sukses hanya SETELAH payload benar-benar ter-parse, supaya
          // kegagalan parse tidak lagi dilaporkan sebagai "Tersinkron".
          if (rows.length === 0) {
            failedSheets.push(sheetName);
            continue;
          }
          fetchedSheets.push(sheetName);

          if (rows.length >= 1) {
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
                  this.safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(users));
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
                  this.safeSetItem(STORAGE_KEYS.SISWA, JSON.stringify(siswaList));
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
                // Merge aman anti-hilang: Sheet + pending lokal + lokal-only (upgrade path).
                // - Pending update/create menang atas Sheet (lebih baru di HP).
                // - Pending delete membuat ID hilang walau masih ada di Sheet.
                // - Jangan pernah overwrite membuang data lokal yang belum terbukti masuk Sheet.
                this.pruneExpiredPendingByWeek();
                const pendingActions = this.getPendingActions();
                const pendingDeleteIds = new Set(
                  pendingActions.filter(a => a.action === 'delete').map(a => String(a.log.ID_Log))
                );
                const pendingUpserts = new Map<string, LogMutabaah>();
                for (const a of pendingActions) {
                  if (a.action === 'create' || a.action === 'update') {
                    pendingUpserts.set(String(a.log.ID_Log), a.log);
                  }
                }
                const sheetLogIds = new Set(logsFromSheet.map(l => String(l.ID_Log)));
                // Lokal-only: data lama (sebelum enqueue-first) yang belum ada di Sheet.
                let localOnly: LogMutabaah[] = [];
                try {
                  const localLogs = this.getLogs();
                  const pendingIds = new Set(pendingActions.map(a => String(a.log.ID_Log)));
                  localOnly = localLogs.filter(l => {
                    const id = String(l.ID_Log);
                    if (!id || sheetLogIds.has(id) || pendingIds.has(id) || pendingDeleteIds.has(id)) return false;
                    return Boolean(l.Tanggal_Mutabaah);
                  });
                } catch { localOnly = []; }
                const mergedBase: LogMutabaah[] = [];
                for (const s of logsFromSheet) {
                  const id = String(s.ID_Log);
                  if (pendingDeleteIds.has(id)) continue;
                  const override = pendingUpserts.get(id);
                  mergedBase.push(override ?? s);
                }
                for (const [id, log] of pendingUpserts) {
                  if (!sheetLogIds.has(id)) mergedBase.push(log);
                }
                for (const l of localOnly) mergedBase.push(l);
                const mergedLogs = mergedBase;

                // Retensi 30 hari untuk yang sudah sync; pending dikecualikan
                // (pending tunduk pada prune mingguan, bukan retensi ini).
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_RETENTION_DAYS);
                const cutoffStr = `${cutoffDate.getFullYear()}-${this.pad(cutoffDate.getMonth() + 1)}-${this.pad(cutoffDate.getDate())}`;
                const pendingIdSet = new Set(pendingActions.map(a => String(a.log.ID_Log)));
                const filteredLogs = mergedLogs.filter(l => {
                  if (pendingIdSet.has(String(l.ID_Log))) return true;
                  return (l.Tanggal_Mutabaah || '') >= cutoffStr;
                });

                this.safeSetItem(STORAGE_KEYS.LOGS, JSON.stringify(filteredLogs));

                // Bersihkan pending: create/update yang ID-nya sudah ada di Sheet = terkirim.
                // Delete yang ID-nya sudah tidak ada = terkirim. Sisanya dipertahankan
                // dengan action aslinya (jangan convert ke create).
                const remaining = pendingActions.filter(a => {
                  const id = String(a.log.ID_Log);
                  if (a.action === 'delete') return sheetLogIds.has(id);
                  return !sheetLogIds.has(id);
                });
                this.savePendingActions(remaining);
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
                // Simpan walau kosong agar filter jadwal tahu sheet sudah disinkron
                this.safeSetItem(STORAGE_KEYS.JADWAL, JSON.stringify(jadwal));
              }
          }
        } catch (e) {
          console.warn(`Gagal mengambil sheet ${sheetName}:`, e);
          failedSheets.push(sheetName);
        }
      }

      // Sukses hanya bila SEMUA sheet terambil. Data yang berhasil tetap
      // disimpan (partial apply) sehingga kegagalan satu sheet tidak membuang
      // update sheet lain.
      if (failedSheets.length === 0 && fetchedSheets.length === sheets.length) {
        return { success: true, message: "Berhasil menyinkronkan data dari Google Sheets!" };
      }
      if (fetchedSheets.length === 0) {
        if (htmlDetected) {
          return {
            success: false,
            message: "Akses Google Sheets terbatas. Pastikan 'Akses Umum' pada Google Sheet diatur ke 'Siapa saja yang memiliki link' (Viewer)."
          };
        }
        return { success: false, message: "Koneksi Google Sheets dibatasi atau tidak dapat dijangkau. Menggunakan data lokal." };
      }
      return {
        success: false,
        message: `Sebagian data belum tersinkron (gagal: ${failedSheets.join(', ')}). Data lain tetap diperbarui.`
      };
    } catch (e) {
      return { success: false, message: "Gagal menyambung ke Google Sheets. Menggunakan database lokal." };
    }
  }

  /**
   * Ambil riwayat 1 siswa langsung dari Sheet (tanpa filter retensi 30 hari).
   * Dipakai on-demand dari Panel B agar riwayat lama tetap bisa dilihat
   * tanpa mengubah data lokal maupun retensi sync.
   */
  static async fetchStudentHistoryFromSheet(nis: string, limit = 20): Promise<LogMutabaah[]> {
    const cleanNis = String(nis ?? '').trim();
    if (!cleanNis) return [];
    const cacheBuster = Date.now();
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('Log_Mutabaah')}&_t=${cacheBuster}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const jsonText = await res.text();
    if (jsonText.trim().startsWith('<')) {
      throw new Error('Akses Google Sheets terbatas (login required).');
    }
    const rows = parseGvizJson(jsonText).filter(r => r.some(cell => cell.trim().length > 0));
    if (rows.length < 1) return [];
    const logs: LogMutabaah[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      if (!(cols.length >= 1 && (cols[0] || cols[2] || cols[5] || cols[6]))) continue;
      if (!this.isSameSiswaId(cols[5] || '', cleanNis)) continue;
      logs.push({
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
    logs.sort((a, b) => {
      const dateCmp = String(b.Tanggal_Mutabaah || '').localeCompare(String(a.Tanggal_Mutabaah || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(b.Timestamp || '').localeCompare(String(a.Timestamp || ''));
    });
    return logs.slice(0, limit);
  }

  /** Tulis localStorage dengan pengaman kuota. Coba arsip bila kuota penuh. */
  private static safeSetItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      const err = e as { name?: string; code?: number };
      const quotaExceeded = err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014;
      if (!quotaExceeded) return false;
      // Kuota penuh (umum di HP, batas ~5MB): pangkas log tertua bertahap
      // agar data terbaru tetap tersimpan. Log pending selalu dipertahankan.
      if (key === STORAGE_KEYS.LOGS && this.trimLogsValueToFit(key, value)) {
        return true;
      }
      try {
        this.autoCleanupIfNeeded();
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Simpan versi terpangkas dari daftar log: buang log terlama sedikit demi
   * sedikit sampai muat, tapi jangan pernah buang log yang masih pending.
   */
  private static trimLogsValueToFit(key: string, value: string): boolean {
    try {
      const logs = JSON.parse(value) as LogMutabaah[];
      if (!Array.isArray(logs) || logs.length === 0) return false;
      const pendingIds = new Set(this.getPendingActions().map(a => String(a.log.ID_Log)));
      const sorted = [...logs].sort((a, b) =>
        (b.Tanggal_Mutabaah || '').localeCompare(a.Tanggal_Mutabaah || '') ||
        (b.Timestamp || '').localeCompare(a.Timestamp || '')
      );
      const mustKeep = sorted.filter(l => pendingIds.has(String(l.ID_Log)));
      const optional = sorted.filter(l => !pendingIds.has(String(l.ID_Log)));
      for (const fraction of [0.75, 0.5, 0.35, 0.25, 0.15, 0.05]) {
        const keepCount = Math.max(1, Math.floor(optional.length * fraction));
        const subset = [...mustKeep, ...optional.slice(0, keepCount)];
        try {
          localStorage.setItem(key, JSON.stringify(subset));
          return true;
        } catch { /* coba porsi lebih kecil */ }
      }
      return false;
    } catch {
      return false;
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
    // Jangan arsipkan yang masih antri (pending hanya tunduk pada prune mingguan)
    const pendingIds = new Set(this.getPendingActions().map(a => String(a.log.ID_Log)));

    const retained: LogMutabaah[] = [];
    const archived: LogMutabaah[] = [];

    for (const log of logs) {
      const logDate = log.Tanggal_Mutabaah || '';
      if (logDate < cutoffStr && !pendingIds.has(String(log.ID_Log))) {
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