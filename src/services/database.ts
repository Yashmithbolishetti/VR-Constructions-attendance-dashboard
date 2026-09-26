/**
 * VR CONSTRUCTIONS — BIOMETRIC ATTENDANCE INTELLIGENCE
 * Client-Side Normalized Relational Database & Persistence Repository
 *
 * Implements PostgreSQL normalized relational concepts:
 * - Separate normalized tables: employees, biometric_imports, biometric_punches,
 *   attendance_months, holidays, leave_records, attendance_days, attendance_exceptions,
 *   attendance_overrides.
 * - IndexedDB durable browser database with synchronous localStorage backup for instant hydration.
 * - Idempotent imports, deterministic cryptographic file hashing, and audit overrides.
 */

import {
  DbEmployee,
  DbBiometricImport,
  DbBiometricPunch,
  DbAttendanceMonth,
  DbHoliday,
  DbLeaveRecord,
  DbAttendanceDay,
  DbAttendanceException,
  DbAttendanceOverride,
} from '../types/database';
import { normalizeDateString } from './attendanceCalculator';

const DB_NAME = 'vr_constructions_biometric_db_v3';
const DB_VERSION = 1;

// Storage keys for normalized tables in LocalStorage fallback
const STORAGE_KEYS = {
  EMPLOYEES: 'vrc_db_employees',
  IMPORTS: 'vrc_db_imports',
  PUNCHES: 'vrc_db_punches',
  MONTHS: 'vrc_db_months',
  HOLIDAYS: 'vrc_db_holidays',
  LEAVES: 'vrc_db_leaves',
  ATTENDANCE_DAYS: 'vrc_db_attendance_days',
  EXCEPTIONS: 'vrc_db_exceptions',
  OVERRIDES: 'vrc_db_overrides',
};

/**
 * Generate a deterministic 64-character cryptographic or digest hash for a file.
 */
export async function calculateFileHash(content: string, fileName: string, fileSize: number): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${fileName}:${fileSize}:${content}`);
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback below
    }
  }

  // Fast deterministic 64-character hex fallback
  let h1 = 0xdeadbeef ^ fileSize;
  let h2 = 0x41c64e6d ^ fileName.length;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const p3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const p4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0');
  return `${p1}${p2}${p3}${p4}${p4}${p3}${p2}${p1}`.substring(0, 64);
}

// In-memory memory cache for normalized tables
class MemoryDatabase {
  employees: Map<string, DbEmployee> = new Map(); // key: employee_code
  imports: Map<string, DbBiometricImport> = new Map(); // key: id
  punches: Map<string, DbBiometricPunch> = new Map(); // key: id
  months: Map<string, DbAttendanceMonth> = new Map(); // key: id (e.g. "month-2026-09")
  holidays: Map<string, DbHoliday> = new Map(); // key: id
  leaves: Map<string, DbLeaveRecord> = new Map(); // key: id
  attendanceDays: Map<string, DbAttendanceDay> = new Map(); // key: id (e.g. "att-2026-09-01-101")
  exceptions: Map<string, DbAttendanceException> = new Map(); // key: id
  overrides: Map<string, DbAttendanceOverride> = new Map(); // key: id
  isHydrated: boolean = false;

  constructor() {
    this.hydrateFromStorage();
  }

  hydrateFromStorage() {
    try {
      if (typeof window === 'undefined') return;

      const load = <T>(key: string): T[] => {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : [];
      };

      const emps = load<DbEmployee>(STORAGE_KEYS.EMPLOYEES);
      emps.forEach((e) => this.employees.set(e.employee_code, e));

      const imps = load<DbBiometricImport>(STORAGE_KEYS.IMPORTS);
      imps.forEach((i) => this.imports.set(i.id, i));

      const mos = load<DbAttendanceMonth>(STORAGE_KEYS.MONTHS);
      mos.forEach((m) => this.months.set(m.id, m));

      const hols = load<DbHoliday>(STORAGE_KEYS.HOLIDAYS);
      hols.forEach((h) => this.holidays.set(h.id, h));

      const lvs = load<DbLeaveRecord>(STORAGE_KEYS.LEAVES);
      lvs.forEach((l) => this.leaves.set(l.id, l));

      const days = load<DbAttendanceDay>(STORAGE_KEYS.ATTENDANCE_DAYS);
      days.forEach((d) => this.attendanceDays.set(d.id, d));

      const ex = load<DbAttendanceException>(STORAGE_KEYS.EXCEPTIONS);
      ex.forEach((e) => this.exceptions.set(e.id, e));

      const ov = load<DbAttendanceOverride>(STORAGE_KEYS.OVERRIDES);
      ov.forEach((o) => this.overrides.set(o.id, o));

      const punc = load<DbBiometricPunch>(STORAGE_KEYS.PUNCHES);
      punc.forEach((p) => this.punches.set(p.id, p));

      this.isHydrated = true;
    } catch (err) {
      console.warn('LocalStorage hydration error, fallback to memory', err);
    }
  }

  async ensureHydrated(): Promise<void> {
    if (this.isHydrated && this.months.size > 0 && this.leaves.size > 0) return;
    this.hydrateFromStorage();
    if (typeof window !== 'undefined' && window.indexedDB) {
      try {
        const [idbMonths, idbEmps, idbImports, idbHols, idbLeaves, idbDays, idbExcs] = await Promise.all([
          readFromIDB<DbAttendanceMonth>('attendance_months'),
          readFromIDB<DbEmployee>('employees'),
          readFromIDB<DbBiometricImport>('biometric_imports'),
          readFromIDB<DbHoliday>('holidays'),
          readFromIDB<DbLeaveRecord>('leave_records'),
          readFromIDB<DbAttendanceDay>('attendance_days'),
          readFromIDB<DbAttendanceException>('attendance_exceptions'),
        ]);

        if (idbMonths && idbMonths.length > 0) idbMonths.forEach((m) => { if (!this.months.has(m.id)) this.months.set(m.id, m); });
        if (idbEmps && idbEmps.length > 0) idbEmps.forEach((e) => { if (!this.employees.has(e.employee_code)) this.employees.set(e.employee_code, e); });
        if (idbImports && idbImports.length > 0) idbImports.forEach((i) => { if (!this.imports.has(i.id)) this.imports.set(i.id, i); });
        if (idbHols && idbHols.length > 0) idbHols.forEach((h) => { if (!this.holidays.has(h.id)) this.holidays.set(h.id, h); });
        if (idbLeaves && idbLeaves.length > 0) idbLeaves.forEach((l) => { if (!this.leaves.has(l.id)) this.leaves.set(l.id, l); });
        if (idbDays && idbDays.length > 0) idbDays.forEach((d) => { if (!this.attendanceDays.has(d.id)) this.attendanceDays.set(d.id, d); });
        if (idbExcs && idbExcs.length > 0) idbExcs.forEach((ex) => { if (!this.exceptions.has(ex.id)) this.exceptions.set(ex.id, ex); });
      } catch (err) {
        console.warn('IDB hydration error fallback:', err);
      }
    }
    this.isHydrated = true;
  }

  saveToStorage() {
    try {
      if (typeof window === 'undefined') return;

      localStorage.setItem(
        STORAGE_KEYS.EMPLOYEES,
        JSON.stringify(Array.from(this.employees.values()))
      );
      localStorage.setItem(
        STORAGE_KEYS.IMPORTS,
        JSON.stringify(Array.from(this.imports.values()))
      );
      localStorage.setItem(
        STORAGE_KEYS.MONTHS,
        JSON.stringify(Array.from(this.months.values()))
      );
      localStorage.setItem(
        STORAGE_KEYS.HOLIDAYS,
        JSON.stringify(Array.from(this.holidays.values()))
      );
      localStorage.setItem(
        STORAGE_KEYS.LEAVES,
        JSON.stringify(Array.from(this.leaves.values()))
      );
      localStorage.setItem(
        STORAGE_KEYS.ATTENDANCE_DAYS,
        JSON.stringify(Array.from(this.attendanceDays.values()))
      );
      localStorage.setItem(
        STORAGE_KEYS.EXCEPTIONS,
        JSON.stringify(Array.from(this.exceptions.values()))
      );
      localStorage.setItem(
        STORAGE_KEYS.OVERRIDES,
        JSON.stringify(Array.from(this.overrides.values()))
      );

      // Only save a recent window of punches to prevent LS 5MB quota breach
      const punchArr = Array.from(this.punches.values()).slice(-2000);
      localStorage.setItem(STORAGE_KEYS.PUNCHES, JSON.stringify(punchArr));
    } catch (err) {
      console.warn('LocalStorage save error', err);
    }
  }
}

const memoryDb = new MemoryDatabase();

/**
 * Open or initialize browser IndexedDB
 */
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: any) => {
      const db = e.target.result as IDBDatabase;

      if (!db.objectStoreNames.contains('employees')) {
        const empStore = db.createObjectStore('employees', { keyPath: 'id' });
        empStore.createIndex('employee_code', 'employee_code', { unique: true });
      }

      if (!db.objectStoreNames.contains('biometric_imports')) {
        const impStore = db.createObjectStore('biometric_imports', { keyPath: 'id' });
        impStore.createIndex('file_hash', 'file_hash', { unique: true });
      }

      if (!db.objectStoreNames.contains('biometric_punches')) {
        const punchStore = db.createObjectStore('biometric_punches', { keyPath: 'id' });
        punchStore.createIndex('import_id', 'import_id', { unique: false });
        punchStore.createIndex('employee_code', 'employee_code', { unique: false });
        punchStore.createIndex('punch_date', 'punch_date', { unique: false });
      }

      if (!db.objectStoreNames.contains('attendance_months')) {
        const monthStore = db.createObjectStore('attendance_months', { keyPath: 'id' });
        monthStore.createIndex('month_key', 'month_key', { unique: true });
      }

      if (!db.objectStoreNames.contains('holidays')) {
        const holStore = db.createObjectStore('holidays', { keyPath: 'id' });
        holStore.createIndex('attendance_month_id', 'attendance_month_id', { unique: false });
      }

      if (!db.objectStoreNames.contains('leave_records')) {
        const lvsStore = db.createObjectStore('leave_records', { keyPath: 'id' });
        lvsStore.createIndex('attendance_month_id', 'attendance_month_id', { unique: false });
        lvsStore.createIndex('employee_code', 'employee_code', { unique: false });
      }

      if (!db.objectStoreNames.contains('attendance_days')) {
        const attStore = db.createObjectStore('attendance_days', { keyPath: 'id' });
        attStore.createIndex('attendance_month_id', 'attendance_month_id', { unique: false });
        attStore.createIndex('employee_code', 'employee_code', { unique: false });
        attStore.createIndex('attendance_date', 'attendance_date', { unique: false });
      }

      if (!db.objectStoreNames.contains('attendance_exceptions')) {
        const exStore = db.createObjectStore('attendance_exceptions', { keyPath: 'id' });
        exStore.createIndex('attendance_month_id', 'attendance_month_id', { unique: false });
      }

      if (!db.objectStoreNames.contains('attendance_overrides')) {
        const ovStore = db.createObjectStore('attendance_overrides', { keyPath: 'id' });
        ovStore.createIndex('attendance_day_id', 'attendance_day_id', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper to write to IndexedDB asynchronously without blocking
async function writeToIDB<T>(storeName: string, items: T[]): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) {
      store.put(item);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // If IndexedDB fails (e.g. private mode), localStorage already has the copy
    console.debug(`IndexedDB write to ${storeName} note:`, err);
  }
}

// Helper to read from IndexedDB
async function readFromIDB<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openIDB();
    if (!db.objectStoreNames.contains(storeName)) return [];
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// PUBLIC RELATIONAL DATABASE REPOSITORY API
// -------------------------------------------------------------

export const DatabaseService = {
  /**
   * Check if a biometric file with this hash was already imported.
   */
  async findImportByHash(fileHash: string): Promise<DbBiometricImport | null> {
    for (const imp of memoryDb.imports.values()) {
      if (imp.file_hash === fileHash) {
        return imp;
      }
    }
    return null;
  },

  /**
   * Get all imports history
   */
  async getAllImports(): Promise<DbBiometricImport[]> {
    return Array.from(memoryDb.imports.values()).sort(
      (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    );
  },

  /**
   * Get single import by ID
   */
  async getImportById(id: string): Promise<DbBiometricImport | null> {
    return memoryDb.imports.get(id) || null;
  },

  /**
   * Delete an import and its punches
   */
  async deleteImport(id: string): Promise<void> {
    const targetImp = memoryDb.imports.get(id);
    memoryDb.imports.delete(id);

    // Remove punches associated with this import
    for (const [punchId, punch] of memoryDb.punches.entries()) {
      if (punch.import_id === id) {
        memoryDb.punches.delete(punchId);
      }
    }

    // If no other import remains for this month, clean up cached attendance days and exceptions
    if (targetImp && targetImp.date_from) {
      const monthKey = targetImp.date_from.substring(0, 7);
      const otherImportsForMonth = Array.from(memoryDb.imports.values()).some(
        (imp) => imp.date_from && imp.date_from.startsWith(monthKey)
      );
      if (!otherImportsForMonth && monthKey) {
        for (const [dayId, day] of memoryDb.attendanceDays.entries()) {
          if (day.attendance_month_id === `month-${monthKey}` || (day.attendance_date && day.attendance_date.startsWith(monthKey))) {
            memoryDb.attendanceDays.delete(dayId);
          }
        }
        for (const [exId, ex] of memoryDb.exceptions.entries()) {
          if (ex.attendance_month_id === `month-${monthKey}` || (ex.attendance_date && ex.attendance_date.startsWith(monthKey))) {
            memoryDb.exceptions.delete(exId);
          }
        }
        memoryDb.months.delete(`month-${monthKey}`);
      }
    }

    memoryDb.saveToStorage();

    try {
      if (typeof window !== 'undefined' && window.indexedDB) {
        const db = await openIDB();
        const tx = db.transaction(['biometric_imports', 'biometric_punches'], 'readwrite');
        tx.objectStore('biometric_imports').delete(id);
        const punchStore = tx.objectStore('biometric_punches');
        if (punchStore.indexNames.contains('import_id')) {
          const index = punchStore.index('import_id');
          const req = index.openCursor(IDBKeyRange.only(id));
          req.onsuccess = (e: any) => {
            const cursor = e.target.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            }
          };
        }
      }
    } catch (err) {
      console.warn('IDB deletion fallback:', err);
    }
  },

  /**
   * Reconcile and upsert employees.
   * "Employee identity must be based on the biometric employee number / EnNo.
   * If an employee appears for the first time: automatically create the employee.
   * If an existing employee appears: update only appropriate non-destructive information.
   * Never create duplicate employees simply because the same employee appears in another monthly upload."
   */
  async upsertEmployees(
    detectedEmployees: { code: string; name: string; department?: string; designation?: string }[]
  ): Promise<DbEmployee[]> {
    const now = new Date().toISOString();
    const updatedEmployees: DbEmployee[] = [];

    for (const d of detectedEmployees) {
      const existing = memoryDb.employees.get(d.code);
      if (existing) {
        // Update name if currently empty or generic, preserve original id
        const updated: DbEmployee = {
          ...existing,
          employee_name: d.name.trim() || existing.employee_name,
          department: d.department || existing.department,
          designation: d.designation || existing.designation,
          updated_at: now,
        };
        memoryDb.employees.set(d.code, updated);
        updatedEmployees.push(updated);
      } else {
        const newEmp: DbEmployee = {
          id: `emp-${d.code}`,
          employee_code: d.code,
          employee_name: d.name.trim() || `Employee ${d.code}`,
          department: d.department,
          designation: d.designation,
          is_active: true,
          created_at: now,
          updated_at: now,
        };
        memoryDb.employees.set(d.code, newEmp);
        updatedEmployees.push(newEmp);
      }
    }

    memoryDb.saveToStorage();
    writeToIDB('employees', updatedEmployees);
    return updatedEmployees;
  },

  /**
   * Get all employees in the master database
   */
  async getAllEmployees(): Promise<DbEmployee[]> {
    await memoryDb.ensureHydrated();
    return Array.from(memoryDb.employees.values()).sort((a, b) =>
      a.employee_code.localeCompare(b.employee_code, undefined, { numeric: true })
    );
  },

  /**
   * Get single employee by employee_code (EnNo)
   */
  async getEmployeeByCode(code: string): Promise<DbEmployee | null> {
    await memoryDb.ensureHydrated();
    return memoryDb.employees.get(code) || null;
  },

  /**
   * Get all configured attendance months
   */
  async getAllMonths(): Promise<DbAttendanceMonth[]> {
    await memoryDb.ensureHydrated();
    return Array.from(memoryDb.months.values()).sort((a, b) => b.month_key.localeCompare(a.month_key));
  },

  /**
   * Get attendance month by month_key ("YYYY-MM")
   */
  async getMonthByKey(monthKey: string): Promise<DbAttendanceMonth | null> {
    await memoryDb.ensureHydrated();
    const monthId = `month-${monthKey}`;
    return memoryDb.months.get(monthId) || null;
  },

  /**
   * Save or update an attendance month workspace
   */
  async saveMonth(month: DbAttendanceMonth): Promise<void> {
    memoryDb.months.set(month.id, month);
    memoryDb.saveToStorage();
    await writeToIDB('attendance_months', [month]);
  },

  /**
   * Get all holidays across all months
   */
  async getAllHolidays(): Promise<DbHoliday[]> {
    await memoryDb.ensureHydrated();
    if (memoryDb.holidays.size === 0 && typeof window !== 'undefined' && window.indexedDB) {
      try {
        const idbHols = await readFromIDB<DbHoliday>('holidays');
        if (idbHols && idbHols.length > 0) {
          idbHols.forEach((h) => memoryDb.holidays.set(h.id, h));
        }
      } catch (err) {
        console.warn('Failed reading holidays from IDB', err);
      }
    }
    return Array.from(memoryDb.holidays.values()).sort((a, b) =>
      a.holiday_date.localeCompare(b.holiday_date)
    );
  },

  /**
   * Get holidays configured for a specific month
   */
  async getHolidaysForMonth(monthId: string): Promise<DbHoliday[]> {
    await memoryDb.ensureHydrated();
    const cleanKey = monthId ? monthId.replace(/^month-/, '').trim() : '';
    const isAll =
      !cleanKey ||
      cleanKey === 'ALL' ||
      cleanKey === 'COMBINED' ||
      cleanKey === 'YEARLY' ||
      cleanKey === 'OVERALL' ||
      cleanKey.toLowerCase() === 'all' ||
      cleanKey.toLowerCase() === 'overall';
    return Array.from(memoryDb.holidays.values())
      .filter((h) => {
        if (isAll) return true;
        const norm = normalizeDateString(h.holiday_date);
        return (
          h.attendance_month_id === monthId ||
          h.attendance_month_id === cleanKey ||
          norm.startsWith(cleanKey)
        );
      })
      .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
  },

  /**
   * Save a new holiday
   */
  async addHoliday(holiday: DbHoliday): Promise<void> {
    memoryDb.holidays.set(holiday.id, holiday);
    memoryDb.saveToStorage();
    writeToIDB('holidays', [holiday]);
  },

  /**
   * Update an existing holiday
   */
  async updateHoliday(holiday: DbHoliday): Promise<void> {
    memoryDb.holidays.set(holiday.id, holiday);
    memoryDb.saveToStorage();
    writeToIDB('holidays', [holiday]);
  },

  /**
   * Delete a holiday
   */
  async deleteHoliday(holidayId: string): Promise<void> {
    memoryDb.holidays.delete(holidayId);
    memoryDb.saveToStorage();
  },

  /**
   * Get all leave records across all recorded months
   */
  async getAllLeaves(): Promise<DbLeaveRecord[]> {
    await memoryDb.ensureHydrated();
    if (memoryDb.leaves.size === 0 && typeof window !== 'undefined' && window.indexedDB) {
      try {
        const idbLeaves = await readFromIDB<DbLeaveRecord>('leave_records');
        if (idbLeaves && idbLeaves.length > 0) {
          idbLeaves.forEach((l) => memoryDb.leaves.set(l.id, l));
        }
      } catch (err) {
        console.warn('Failed reading leaves from IDB', err);
      }
    }
    return Array.from(memoryDb.leaves.values()).sort((a, b) =>
      a.leave_date.localeCompare(b.leave_date)
    );
  },

  /**
   * Get leave records for a specific month
   */
  async getLeavesForMonth(monthId: string): Promise<DbLeaveRecord[]> {
    await memoryDb.ensureHydrated();
    const cleanKey = monthId ? monthId.replace(/^month-/, '').trim() : '';
    const isAll =
      !cleanKey ||
      cleanKey === 'ALL' ||
      cleanKey === 'COMBINED' ||
      cleanKey === 'YEARLY' ||
      cleanKey === 'OVERALL' ||
      cleanKey.toLowerCase() === 'all' ||
      cleanKey.toLowerCase() === 'overall';
    return Array.from(memoryDb.leaves.values())
      .filter((l) => {
        if (isAll) return true;
        const norm = normalizeDateString(l.leave_date);
        return (
          l.attendance_month_id === monthId ||
          l.attendance_month_id === cleanKey ||
          norm.startsWith(cleanKey)
        );
      })
      .sort((a, b) => a.leave_date.localeCompare(b.leave_date));
  },

  /**
   * Batch insert leaves (e.g. HR selects multiple employees and multiple dates)
   */
  async addLeavesBatch(records: DbLeaveRecord[]): Promise<void> {
    for (const rec of records) {
      memoryDb.leaves.set(rec.id, rec);
    }
    memoryDb.saveToStorage();
    writeToIDB('leave_records', records);
  },

  /**
   * Delete a leave record
   */
  async deleteLeave(leaveId: string): Promise<void> {
    memoryDb.leaves.delete(leaveId);
    memoryDb.saveToStorage();
  },

  /**
   * Save calculated daily attendance records for a month
   */
  async saveAttendanceDaysBatch(days: DbAttendanceDay[]): Promise<void> {
    for (const day of days) {
      memoryDb.attendanceDays.set(day.id, day);
    }
    memoryDb.saveToStorage();
    writeToIDB('attendance_days', days);
  },

  /**
   * Get daily attendance records for a specific month or combined period
   */
  async getAttendanceDaysForMonth(monthIdOrKey: string): Promise<DbAttendanceDay[]> {
    await memoryDb.ensureHydrated();
    const cleanKey = monthIdOrKey ? monthIdOrKey.replace(/^month-/, '').trim() : '';
    const fullId = `month-${cleanKey}`;
    const isCombined =
      !cleanKey ||
      cleanKey === 'ALL' ||
      cleanKey === 'COMBINED' ||
      cleanKey === 'YEARLY' ||
      cleanKey === 'OVERALL' ||
      cleanKey.toLowerCase() === 'all' ||
      cleanKey.toLowerCase() === 'overall';

    let days = Array.from(memoryDb.attendanceDays.values())
      .filter((d) =>
        isCombined
          ? true
          : d.attendance_month_id === fullId ||
            d.attendance_month_id === cleanKey ||
            (d.attendance_date && d.attendance_date.startsWith(cleanKey))
      )
      .sort((a, b) => a.attendance_date.localeCompare(b.attendance_date));

    if (days.length === 0) {
      const idbDays = await readFromIDB<DbAttendanceDay>('attendance_days');
      if (idbDays && idbDays.length > 0) {
        for (const d of idbDays) {
          memoryDb.attendanceDays.set(d.id, d);
        }
        days = idbDays
          .filter((d) =>
            isCombined
              ? true
              : d.attendance_month_id === fullId ||
                d.attendance_month_id === cleanKey ||
                (d.attendance_date && d.attendance_date.startsWith(cleanKey))
          )
          .sort((a, b) => a.attendance_date.localeCompare(b.attendance_date));
      }
    }

    return days;
  },

  /**
   * Get all attendance days across all recorded months
   */
  async getAllAttendanceDays(): Promise<DbAttendanceDay[]> {
    return this.getAttendanceDaysForMonth('ALL');
  },

  /**
   * Save exceptions for a month
   */
  async saveExceptionsBatch(exceptions: DbAttendanceException[]): Promise<void> {
    for (const ex of exceptions) {
      memoryDb.exceptions.set(ex.id, ex);
    }
    memoryDb.saveToStorage();
    await writeToIDB('attendance_exceptions', exceptions);
  },

  /**
   * Get exceptions for a month
   */
  async getExceptionsForMonth(monthId: string): Promise<DbAttendanceException[]> {
    await memoryDb.ensureHydrated();
    return Array.from(memoryDb.exceptions.values())
      .filter((e) => e.attendance_month_id === monthId)
      .sort((a, b) => a.attendance_date.localeCompare(b.attendance_date));
  },

  /**
   * Resolve an exception
   */
  async resolveException(
    exceptionId: string,
    notes?: string,
    resolvedBy: string = 'HR Admin'
  ): Promise<void> {
    const existing = memoryDb.exceptions.get(exceptionId);
    if (!existing) return;

    const updated: DbAttendanceException = {
      ...existing,
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
      resolution_notes: notes || 'Marked reviewed and resolved by supervisor',
      updated_at: new Date().toISOString(),
    };
    memoryDb.exceptions.set(exceptionId, updated);
    memoryDb.saveToStorage();
    await writeToIDB('attendance_exceptions', [updated]);
  },

  /**
   * Save biometric punches for an import
   */
  async savePunchesBatch(punches: DbBiometricPunch[]): Promise<void> {
    for (const p of punches) {
      memoryDb.punches.set(p.id, p);
    }
    memoryDb.saveToStorage();
    await writeToIDB('biometric_punches', punches);
  },

  /**
   * Get raw punches for a specific date or employee
   */
  async getPunchesForEmployeeDate(employeeCode: string, date: string): Promise<DbBiometricPunch[]> {
    await memoryDb.ensureHydrated();
    return Array.from(memoryDb.punches.values())
      .filter((p) => p.employee_code === employeeCode && p.punch_date === date)
      .sort((a, b) => a.punch_time.localeCompare(b.punch_time));
  },

  /**
   * Get all raw punches for a month
   */
  async getPunchesForMonth(monthKey: string): Promise<DbBiometricPunch[]> {
    await memoryDb.ensureHydrated();
    let punches = Array.from(memoryDb.punches.values())
      .filter((p) => p.punch_date && p.punch_date.startsWith(monthKey))
      .sort((a, b) => (a.punched_at || '').localeCompare(b.punched_at || ''));

    if (punches.length === 0) {
      // Check IndexedDB if memory database had a slice or hasn't loaded
      const idbPunches = await readFromIDB<DbBiometricPunch>('biometric_punches');
      if (idbPunches && idbPunches.length > 0) {
        for (const p of idbPunches) {
          memoryDb.punches.set(p.id, p);
        }
        punches = idbPunches
          .filter((p) => p.punch_date && p.punch_date.startsWith(monthKey))
          .sort((a, b) => (a.punched_at || '').localeCompare(b.punched_at || ''));
      }
    }

    return punches;
  },

  /**
   * Get all raw punches across all months
   */
  async getAllPunches(): Promise<DbBiometricPunch[]> {
    await memoryDb.ensureHydrated();
    let punches = Array.from(memoryDb.punches.values())
      .sort((a, b) => (a.punched_at || '').localeCompare(b.punched_at || ''));

    if (punches.length === 0) {
      const idbPunches = await readFromIDB<DbBiometricPunch>('biometric_punches');
      if (idbPunches && idbPunches.length > 0) {
        for (const p of idbPunches) {
          memoryDb.punches.set(p.id, p);
        }
        punches = idbPunches.sort((a, b) => (a.punched_at || '').localeCompare(b.punched_at || ''));
      }
    }

    return punches;
  },

  /**
   * Manual Attendance Correction & Audit Layer:
   * "Controlled editing of: IN, OUT, Status, Notes.
   * Do NOT modify the original biometric punch records.
   * Instead create a manual override/correction layer.
   * Preserves: original value, new value, changed_at, reason.
   * The raw biometric record must remain untouched."
   */
  async applyAttendanceOverride(params: {
    attendanceDayId: string;
    monthId: string;
    employeeId: string;
    date: string;
    fieldName: 'first_punch' | 'last_punch' | 'status' | 'lunch_minutes';
    originalValue: string;
    newValue: string;
    reason: string;
    updatedBy?: string;
  }): Promise<{ day: DbAttendanceDay; override: DbAttendanceOverride }> {
    const existingDay = memoryDb.attendanceDays.get(params.attendanceDayId);
    if (!existingDay) {
      throw new Error(`Attendance day record not found: ${params.attendanceDayId}`);
    }

    const now = new Date().toISOString();
    const overrideId = `ov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // 1. Create audit log override
    const overrideRecord: DbAttendanceOverride = {
      id: overrideId,
      attendance_day_id: params.attendanceDayId,
      attendance_month_id: params.monthId,
      employee_id: params.employeeId,
      attendance_date: params.date,
      field_name: params.fieldName,
      original_value: params.originalValue,
      new_value: params.newValue,
      reason: params.reason,
      updated_by: params.updatedBy || 'HR Admin',
      changed_at: now,
    };
    memoryDb.overrides.set(overrideId, overrideRecord);

    // 2. Update calculated attendance day with override flag & recalculate net hours if punch times changed
    const updatedDay: DbAttendanceDay = {
      ...existingDay,
      is_manually_corrected: true,
      correction_notes: params.reason,
      updated_at: now,
    };

    if (params.fieldName === 'first_punch') {
      updatedDay.first_punch = params.newValue || undefined;
    } else if (params.fieldName === 'last_punch') {
      updatedDay.last_punch = params.newValue || undefined;
    } else if (params.fieldName === 'status') {
      updatedDay.status = params.newValue as any;
    } else if (params.fieldName === 'lunch_minutes') {
      updatedDay.lunch_minutes = parseInt(params.newValue, 10) || 60;
    }

    // Recompute gross & net minutes if punch times exist
    if (updatedDay.first_punch && updatedDay.last_punch) {
      const [hIn, mIn] = updatedDay.first_punch.split(':').map(Number);
      const [hOut, mOut] = updatedDay.last_punch.split(':').map(Number);
      const gross = Math.max(0, hOut * 60 + mOut - (hIn * 60 + mIn));
      updatedDay.gross_minutes = gross;
      updatedDay.net_minutes = Math.max(0, gross - updatedDay.lunch_minutes);
    }

    memoryDb.attendanceDays.set(params.attendanceDayId, updatedDay);
    memoryDb.saveToStorage();

    writeToIDB('attendance_overrides', [overrideRecord]);
    writeToIDB('attendance_days', [updatedDay]);

    return { day: updatedDay, override: overrideRecord };
  },

  /**
   * Get all manual override audit records for a specific day or month
   */
  async getOverridesForDay(dayId: string): Promise<DbAttendanceOverride[]> {
    return Array.from(memoryDb.overrides.values())
      .filter((o) => o.attendance_day_id === dayId)
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  },

  async getOverridesForMonth(monthId: string): Promise<DbAttendanceOverride[]> {
    await memoryDb.ensureHydrated();
    const cleanKey = monthId ? monthId.replace(/^month-/, '').trim() : '';
    const isAll =
      !cleanKey ||
      cleanKey === 'ALL' ||
      cleanKey === 'COMBINED' ||
      cleanKey === 'YEARLY' ||
      cleanKey === 'OVERALL' ||
      cleanKey.toLowerCase() === 'all' ||
      cleanKey.toLowerCase() === 'overall';
    return Array.from(memoryDb.overrides.values())
      .filter((o) =>
        isAll
          ? true
          : o.attendance_month_id === monthId ||
            o.attendance_month_id === cleanKey ||
            o.attendance_date.startsWith(cleanKey)
      )
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  },

  /**
   * Save complete atomic import transaction:
   * 1. Register file import record with hash
   * 2. Upsert employee master records
   * 3. Store raw biometric punches
   * 4. Create/update attendance month records
   * 5. Persist holidays for this month
   * 6. Persist employee approved leave records
   * 7. Persist calculated attendance day records
   * 8. Persist attendance exceptions
   * Atomic: Rolls back memory state if any error occurs.
   */
  async saveImportTransaction(params: {
    importRecord: DbBiometricImport;
    employees: { code: string; name: string; department?: string; designation?: string }[];
    punches: DbBiometricPunch[];
    months: DbAttendanceMonth[];
    holidays?: DbHoliday[];
    leaves?: DbLeaveRecord[];
    attendanceDays?: DbAttendanceDay[];
    exceptions?: DbAttendanceException[];
  }): Promise<void> {
    // Take rollback snapshots of memory tables
    const snapshot = {
      imports: new Map(memoryDb.imports),
      employees: new Map(memoryDb.employees),
      punches: new Map(memoryDb.punches),
      months: new Map(memoryDb.months),
      holidays: new Map(memoryDb.holidays),
      leaves: new Map(memoryDb.leaves),
      attendanceDays: new Map(memoryDb.attendanceDays),
      exceptions: new Map(memoryDb.exceptions),
    };

    try {
      // 1. Save import
      memoryDb.imports.set(params.importRecord.id, params.importRecord);

      // 2. Upsert employee master
      await this.upsertEmployees(params.employees);

      // 3. Save punches
      await this.savePunchesBatch(params.punches);

      // 4. Save months
      for (const m of params.months) {
        memoryDb.months.set(m.id, m);
      }

      // 5. Save holidays
      if (params.holidays && params.holidays.length > 0) {
        for (const h of params.holidays) {
          memoryDb.holidays.set(h.id, h);
        }
        await writeToIDB('holidays', params.holidays);
      }

      // 6. Save leaves
      if (params.leaves && params.leaves.length > 0) {
        for (const l of params.leaves) {
          memoryDb.leaves.set(l.id, l);
        }
        await writeToIDB('leave_records', params.leaves);
      }

      // 7. Save attendance days
      if (params.attendanceDays && params.attendanceDays.length > 0) {
        for (const d of params.attendanceDays) {
          memoryDb.attendanceDays.set(d.id, d);
        }
        await writeToIDB('attendance_days', params.attendanceDays);
      }

      // 8. Save exceptions
      if (params.exceptions && params.exceptions.length > 0) {
        for (const ex of params.exceptions) {
          memoryDb.exceptions.set(ex.id, ex);
        }
        await writeToIDB('attendance_exceptions', params.exceptions);
      }

      memoryDb.saveToStorage();
      await writeToIDB('biometric_imports', [params.importRecord]);
      await writeToIDB('attendance_months', params.months);
    } catch (err) {
      // Rollback memory state on failure
      memoryDb.imports = snapshot.imports;
      memoryDb.employees = snapshot.employees;
      memoryDb.punches = snapshot.punches;
      memoryDb.months = snapshot.months;
      memoryDb.holidays = snapshot.holidays;
      memoryDb.leaves = snapshot.leaves;
      memoryDb.attendanceDays = snapshot.attendanceDays;
      memoryDb.exceptions = snapshot.exceptions;
      memoryDb.saveToStorage();
      throw err;
    }
  },

  /**
   * Clear all tables (used for complete system reset)
   */
  async clearAllDatabase(): Promise<void> {
    memoryDb.employees.clear();
    memoryDb.imports.clear();
    memoryDb.punches.clear();
    memoryDb.months.clear();
    memoryDb.holidays.clear();
    memoryDb.leaves.clear();
    memoryDb.attendanceDays.clear();
    memoryDb.exceptions.clear();
    memoryDb.overrides.clear();

    if (typeof window !== 'undefined') {
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
      try {
        window.indexedDB.deleteDatabase(DB_NAME);
      } catch {
        // ignore
      }
    }
  },
};
