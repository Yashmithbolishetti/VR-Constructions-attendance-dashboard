import {
  RawBiometricFile,
  RawBiometricPunch,
  Employee,
  ParsedBiometricDataset,
} from '../types/attendance';

/**
 * VR CONSTRUCTIONS — PRODUCTION ROBUST BIOMETRIC FILE PARSER
 *
 * Designed to ingest real-world hardware biometric machine export files:
 * - Plain .txt files with tab-separated columns
 * - Space-aligned / multiple space text files
 * - CSV, TSV, and DAT files
 * - Automatic header detection & case-insensitive column mapping (No, Mchn, EnNo, Name, Mode, IOMd, DateTime)
 * - Automatic positional fallback when headers are missing
 * - Resilient timestamp parser (supports YYYY/MM/DD, DD/MM/YYYY, variable spacing, AM/PM, separate Date & Time)
 * - Non-destructive row-by-row parsing: preserves every raw line, records anomalies without failing valid rows
 * - Enrollment Number (EnNo) used as the immutable primary employee identity
 */

/**
 * Detect delimiter from sample lines of the biometric file
 */
export function detectDelimiter(lines: string[]): string {
  if (!lines || lines.length === 0) return '\t';

  // Sample up to first 30 non-empty lines
  const sampleLines = lines.slice(0, 30).filter((l) => l.trim().length > 0);
  if (sampleLines.length === 0) return '\t';

  let tabCount = 0;
  let commaCount = 0;
  let semicolonCount = 0;
  let pipeCount = 0;

  for (const line of sampleLines) {
    if (line.includes('\t')) tabCount++;
    if (line.includes(',')) commaCount++;
    if (line.includes(';')) semicolonCount++;
    if (line.includes('|')) pipeCount++;
  }

  // If tabs are present across at least 2 lines, it's overwhelmingly a TSV / tab-delimited file
  if (tabCount >= Math.min(2, sampleLines.length)) return '\t';
  if (commaCount >= Math.min(2, sampleLines.length)) return ',';
  if (semicolonCount >= Math.min(2, sampleLines.length)) return ';';
  if (pipeCount >= Math.min(2, sampleLines.length)) return '|';

  // Multi-space/whitespace fallback
  return 'WHITESPACE';
}

/**
 * Splits a line safely by detected delimiter, falling back to multi-space when appropriate
 */
export function splitLine(line: string, delimiter: string): string[] {
  // Strip carriage return and trailing whitespace
  const cleanLine = line.replace(/\r$/, '');

  if (delimiter === 'WHITESPACE') {
    // Split by 2 or more consecutive spaces or single tab
    return cleanLine
      .trim()
      .split(/\s{2,}|\t/)
      .map((t) => t.trim().replace(/^["']|["']$/g, ''))
      .filter((t) => t.length > 0);
  }

  if (delimiter === '\t') {
    // If splitting by tab produces meaningful columns, return them
    const tabCols = cleanLine.split('\t').map((t) => t.trim().replace(/^["']|["']$/g, ''));
    if (tabCols.length >= 3) {
      return tabCols;
    }
    // Fallback if tab didn't split (e.g. line was space-separated)
    if (cleanLine.match(/\s{2,}/)) {
      return cleanLine
        .trim()
        .split(/\s{2,}/)
        .map((t) => t.trim().replace(/^["']|["']$/g, ''))
        .filter((t) => t.length > 0);
    }
    return tabCols;
  }

  // Standard character delimiter (comma, semicolon, pipe)
  const cols = cleanLine.split(delimiter).map((t) => t.trim().replace(/^["']|["']$/g, ''));
  if (cols.length >= 3) {
    return cols;
  }

  // Fallback to whitespace if delimiter didn't yield columns
  if (cleanLine.match(/\s{2,}|\t/)) {
    return cleanLine
      .trim()
      .split(/\s{2,}|\t/)
      .map((t) => t.trim().replace(/^["']|["']$/g, ''))
      .filter((t) => t.length > 0);
  }

  return cols;
}

/**
 * Normalizes varied machine timestamp strings into standard YYYY-MM-DD and HH:mm:ss
 * Handles:
 * - YYYY/MM/DD HH:mm:ss, YYYY-MM-DD HH:mm:ss, YYYY.MM.DD HH:mm:ss
 * - DD/MM/YYYY HH:mm:ss, DD-MM-YYYY HH:mm:ss, DD.MM.YYYY HH:mm:ss
 * - MM/DD/YYYY HH:mm:ss
 * - Multiple spaces between date and time
 * - 12-hour AM/PM formats
 * - Missing seconds (HH:mm)
 */
export function normalizeDateTime(rawStr: string): {
  normalizedIso: string;
  date: string;
  time: string;
  isValid: boolean;
} {
  if (!rawStr) {
    return { normalizedIso: '', date: '', time: '', isValid: false };
  }

  const clean = rawStr.trim().replace(/^["']|["']$/g, '');

  // Check for AM / PM indicator
  let isPM = false;
  let hasAmPm = false;
  if (/[aApP][mM]/.test(clean)) {
    hasAmPm = true;
    isPM = /[pP][mM]/.test(clean);
  }

  // Strip AM/PM for numerical regex matching
  const numericalPart = clean.replace(/\s*[aApP][mM]\s*$/, '').trim();

  // Pattern 1: YYYY[-/.]MM[-/.]DD (with variable whitespace or T followed by HH:mm[:ss])
  const ymdMatch = numericalPart.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
  );
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    let hhNum = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const mm = (ymdMatch[5] || '00').padStart(2, '0');
    const ss = (ymdMatch[6] || '00').padStart(2, '0');

    if (hasAmPm) {
      if (isPM && hhNum < 12) hhNum += 12;
      else if (!isPM && hhNum === 12) hhNum = 0;
    }

    const hh = String(hhNum).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const timeStr = `${hh}:${mm}:${ss}`;

    return {
      normalizedIso: `${dateStr}T${timeStr}`,
      date: dateStr,
      time: timeStr,
      isValid: true,
    };
  }

  // Pattern 2: DD[-/.]MM[-/.]YYYY (common European / Indian format)
  const dmyMatch = numericalPart.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
  );
  if (dmyMatch) {
    let part1 = parseInt(dmyMatch[1], 10);
    let part2 = parseInt(dmyMatch[2], 10);
    const y = dmyMatch[3];
    let hhNum = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const mm = (dmyMatch[5] || '00').padStart(2, '0');
    const ss = (dmyMatch[6] || '00').padStart(2, '0');

    if (hasAmPm) {
      if (isPM && hhNum < 12) hhNum += 12;
      else if (!isPM && hhNum === 12) hhNum = 0;
    }

    let d: string;
    let m: string;

    // Disambiguate if part1 is month or day
    if (part1 > 12) {
      // Must be Day-Month-Year
      d = String(part1).padStart(2, '0');
      m = String(part2).padStart(2, '0');
    } else if (part2 > 12) {
      // Must be Month-Day-Year
      m = String(part1).padStart(2, '0');
      d = String(part2).padStart(2, '0');
    } else {
      // Default to DD-MM-YYYY
      d = String(part1).padStart(2, '0');
      m = String(part2).padStart(2, '0');
    }

    const hh = String(hhNum).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const timeStr = `${hh}:${mm}:${ss}`;

    return {
      normalizedIso: `${dateStr}T${timeStr}`,
      date: dateStr,
      time: timeStr,
      isValid: true,
    };
  }

  // Fallback: Date.parse if standard format failed
  const parsedTimestamp = Date.parse(clean);
  if (!isNaN(parsedTimestamp)) {
    const dt = new Date(parsedTimestamp);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    const ss = String(dt.getSeconds()).padStart(2, '0');

    const dateStr = `${y}-${m}-${d}`;
    const timeStr = `${hh}:${mm}:${ss}`;

    return {
      normalizedIso: `${dateStr}T${timeStr}`,
      date: dateStr,
      time: timeStr,
      isValid: true,
    };
  }

  return {
    normalizedIso: '',
    date: '',
    time: '',
    isValid: false,
  };
}

/**
 * Format date span into readable label: "Aug 25 – Sep 02, 2026"
 */
function formatDateSpan(firstDate: string, lastDate: string): string {
  if (!firstDate && !lastDate) return 'No dates recorded';
  if (firstDate === lastDate || !lastDate) {
    const d = new Date(firstDate);
    return isNaN(d.getTime())
      ? firstDate
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const d1 = new Date(firstDate);
  const d2 = new Date(lastDate);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    return `${firstDate} to ${lastDate}`;
  }

  const s1 = d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const s2 = d2.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s1} – ${s2}`;
}

/**
 * Core Robust Biometric File Parser
 * Accepts .txt, .csv, .tsv, .dat and text-based biometric exports.
 * Auto-detects delimiters, headers, and handles malformed rows gracefully.
 */
export function parseBiometricFile(
  content: string,
  fileName: string,
  fileSizeBytes: number,
  mimeType: string = 'text/plain'
): ParsedBiometricDataset {
  // 1. Clean harmless BOM characters and normalize line endings
  const cleanContent = content
    .replace(/^[\uFEFF\uFFFE]/, '') // Strip UTF-8 / UTF-16 BOM
    .trim();

  if (cleanContent.length === 0) {
    throw new Error('The uploaded file is empty (0 bytes). Please upload a file with biometric punch records.');
  }

  // Split by Windows (\r\n), Unix (\n), or classic Mac (\r) line endings
  const allLines = cleanContent.split(/\r\n|\r|\n/);
  const nonEmptyLines = allLines.filter((l) => l.trim().length > 0);

  if (nonEmptyLines.length === 0) {
    throw new Error('The biometric file contains no data rows.');
  }

  // 2. Automatically detect delimiter
  const delimiter = detectDelimiter(nonEmptyLines);

  // 3. Scan for table header row
  let headerIndex = -1;
  let noCol = -1;
  let mchnCol = -1;
  let enNoCol = -1;
  let nameCol = -1;
  let modeCol = -1;
  let iomdCol = -1;
  let dateTimeCol = -1;
  let dateCol = -1;
  let timeCol = -1;

  // Scan up to first 40 non-empty lines for header names
  const scanLimit = Math.min(40, nonEmptyLines.length);

  for (let i = 0; i < scanLimit; i++) {
    const rawTokens = splitLine(nonEmptyLines[i], delimiter);
    const cols = rawTokens.map((c) =>
      c
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') // remove spaces, dots, slashes, dashes
    );

    const foundEnNo = cols.findIndex(
      (c) =>
        c === 'enno' ||
        c === 'enroll' ||
        c === 'enrollno' ||
        c === 'enrollnumber' ||
        c === 'userid' ||
        c === 'user' ||
        c === 'id' ||
        c === 'pin' ||
        c === 'badgenumber' ||
        c === 'badge' ||
        c === 'cardno' ||
        c === 'card' ||
        c === 'empid' ||
        c === 'empcode' ||
        c === 'empno' ||
        c === 'employeeno' ||
        c === 'employeeid' ||
        c === 'acno' ||
        c === 'ac'
    );

    const foundDateTime = cols.findIndex(
      (c) =>
        c === 'datetime' ||
        c === 'dateandtime' ||
        c === 'timestamp' ||
        c === 'punchtime' ||
        c === 'attdate' ||
        c === 'logtime' ||
        c === 'recordtime' ||
        c === 'time'
    );

    const foundDateOnly = cols.findIndex(
      (c) => c === 'date' || c === 'punchdate' || c === 'attdate' || c === 'logdate'
    );
    const foundTimeOnly = cols.findIndex(
      (c) => c === 'time' || c === 'punchtime' || c === 'atttime' || c === 'logtime'
    );

    const hasEnNoAndDate =
      foundEnNo !== -1 && (foundDateTime !== -1 || (foundDateOnly !== -1 && foundTimeOnly !== -1));

    if (hasEnNoAndDate) {
      headerIndex = i;
      enNoCol = foundEnNo;

      if (foundDateOnly !== -1 && foundTimeOnly !== -1 && foundDateOnly !== foundTimeOnly) {
        dateCol = foundDateOnly;
        timeCol = foundTimeOnly;
      } else {
        dateTimeCol = foundDateTime;
      }

      noCol = cols.findIndex(
        (c) =>
          c === 'no' ||
          c === 'sn' ||
          c === 'sr' ||
          c === 'srno' ||
          c === 'slno' ||
          c === 'sl' ||
          c === 'index' ||
          c === 'record' ||
          c === 'row' ||
          c === 'item'
      );

      mchnCol = cols.findIndex(
        (c) =>
          c === 'mchn' ||
          c === 'mch' ||
          c === 'machine' ||
          c === 'machineno' ||
          c === 'device' ||
          c === 'dev' ||
          c === 'devid' ||
          c === 'tmno' ||
          c === 'gmno' ||
          c === 'terminal' ||
          c === 'mc'
      );

      nameCol = cols.findIndex(
        (c) =>
          c === 'name' ||
          c === 'empname' ||
          c === 'employeename' ||
          c === 'username' ||
          c === 'staffname' ||
          c === 'fullname' ||
          c === 'person'
      );

      modeCol = cols.findIndex(
        (c) =>
          c === 'mode' ||
          c === 'verifymode' ||
          c === 'verify' ||
          c === 'auth' ||
          c === 'authmode' ||
          c === 'type'
      );

      iomdCol = cols.findIndex(
        (c) =>
          c === 'iomd' ||
          c === 'iomode' ||
          c === 'inout' ||
          c === 'direction' ||
          c === 'status' ||
          c === 'state' ||
          c === 'event' ||
          c === 'io'
      );

      break;
    }
  }

  // 4. Positional heuristics fallback if no explicit header row detected
  const startRow = headerIndex !== -1 ? headerIndex + 1 : 0;

  if (enNoCol === -1 || (dateTimeCol === -1 && dateCol === -1)) {
    // Inspect the first candidate data lines to deduce columns dynamically
    const sampleDataRow = nonEmptyLines[startRow] || nonEmptyLines[0];
    const testCols = splitLine(sampleDataRow, delimiter);

    // Check if col exists that matches date/time
    let detectedDateCol = -1;
    let detectedTimeCol = -1;
    let detectedDateTimeCol = -1;

    for (let c = 0; c < testCols.length; c++) {
      const val = testCols[c];
      const norm = normalizeDateTime(val);
      if (norm.isValid) {
        detectedDateTimeCol = c;
        break;
      }
      // Check for separate date or time
      if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$|^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(val.trim())) {
        detectedDateCol = c;
      } else if (/^\d{1,2}:\d{1,2}(?::\d{1,2})?(?:\s*[AaPp][Mm])?$/.test(val.trim())) {
        detectedTimeCol = c;
      }
    }

    if (detectedDateTimeCol !== -1) {
      dateTimeCol = detectedDateTimeCol;
    } else if (detectedDateCol !== -1 && detectedTimeCol !== -1) {
      dateCol = detectedDateCol;
      timeCol = detectedTimeCol;
    }

    // Standard Real-Life Biometric Format:
    // No(0)  Mchn(1)  EnNo(2)  Name(3)  Mode(4)  IOMd(5)  DateTime(6)
    if (testCols.length >= 7) {
      noCol = 0;
      mchnCol = 1;
      enNoCol = 2;
      nameCol = 3;
      modeCol = 4;
      iomdCol = 5;
      if (dateTimeCol === -1) dateTimeCol = 6;
    } else if (testCols.length >= 4) {
      enNoCol = 0;
      nameCol = 1;
      if (dateTimeCol === -1) dateTimeCol = testCols.length - 1;
    } else {
      enNoCol = 0;
      if (dateTimeCol === -1) dateTimeCol = testCols.length - 1;
    }
  }

  // 5. Row-by-Row parsing with complete error tolerance and anomaly recording
  const rawPunches: RawBiometricPunch[] = [];
  const employeesMap = new Map<string, { enNo: string; name: string; punchCount: number }>();
  const seenPunches = new Set<string>(); // Unique key: enNo|date|time
  const parseWarnings: string[] = [];

  let punchIdCounter = 1;

  for (let r = startRow; r < nonEmptyLines.length; r++) {
    const line = nonEmptyLines[r];
    const trimmedLine = line.trim();

    // Skip empty lines or metadata/footer summaries
    if (trimmedLine.length === 0) continue;

    // Check for common machine summary/footer lines
    const lowerLine = trimmedLine.toLowerCase();
    if (
      lowerLine.startsWith('total') ||
      lowerLine.startsWith('report generated') ||
      lowerLine.startsWith('printed on') ||
      lowerLine.startsWith('page ') ||
      lowerLine.startsWith('company:')
    ) {
      continue;
    }

    const cols = splitLine(line, delimiter);

    // If line has fewer than 2 columns, check if it's an anomaly or corrupted line
    if (cols.length < 2) {
      rawPunches.push({
        id: `punch-${punchIdCounter++}`,
        sourceRowNumber: r + 1,
        machineNumber: '1',
        enNo: 'UNKNOWN',
        employeeName: 'Unknown',
        mode: '1',
        iomd: '0',
        originalDateTime: '',
        normalizedTimestamp: '',
        date: '',
        time: '',
        isDuplicate: false,
        isAnomaly: true,
        anomalyReason: `Line has insufficient columns: "${trimmedLine}"`,
        rawLineSource: line,
      });
      continue;
    }

    // Extract Enrollment Number (EnNo)
    let rawEnNo = (enNoCol !== -1 && cols[enNoCol] ? cols[enNoCol] : cols[0] || '').trim();
    // Strip surrounding quotes
    rawEnNo = rawEnNo.replace(/^["']|["']$/g, '');

    // Validate EnNo is not purely placeholder
    if (!rawEnNo) {
      rawPunches.push({
        id: `punch-${punchIdCounter++}`,
        sourceRowNumber: r + 1,
        machineNumber: '1',
        enNo: 'UNKNOWN',
        employeeName: 'Unknown',
        mode: '1',
        iomd: '0',
        originalDateTime: '',
        normalizedTimestamp: '',
        date: '',
        time: '',
        isDuplicate: false,
        isAnomaly: true,
        anomalyReason: `Missing enrollment number (EnNo) on row ${r + 1}`,
        rawLineSource: line,
      });
      continue;
    }

    // Extract raw date/time
    let rawDateTime = '';
    if (dateTimeCol !== -1 && cols[dateTimeCol]) {
      rawDateTime = cols[dateTimeCol].trim();
    } else if (dateCol !== -1 && timeCol !== -1 && cols[dateCol] && cols[timeCol]) {
      rawDateTime = `${cols[dateCol].trim()} ${cols[timeCol].trim()}`;
    } else {
      // Fallback: search columns for any valid date/time string
      for (const c of cols) {
        const testNorm = normalizeDateTime(c);
        if (testNorm.isValid) {
          rawDateTime = c.trim();
          break;
        }
      }
    }

    const normalized = normalizeDateTime(rawDateTime);

    // Extract Name
    let employeeName = '';
    if (nameCol !== -1 && cols[nameCol]) {
      employeeName = cols[nameCol].trim().replace(/^["']|["']$/g, '');
    }
    // If no explicit name found or numeric name, default to "Employee {enNo}"
    if (!employeeName || !isNaN(Number(employeeName))) {
      employeeName = `Employee ${rawEnNo}`;
    } else {
      employeeName = employeeName
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }

    // Extract No, Mchn, Mode, IOMd
    const recordNo = noCol !== -1 && cols[noCol] ? cols[noCol].trim() : String(punchIdCounter);
    const machineNumber = mchnCol !== -1 && cols[mchnCol] ? cols[mchnCol].trim() : '1';
    const mode = modeCol !== -1 && cols[modeCol] ? cols[modeCol].trim() : '1';
    const iomd = iomdCol !== -1 && cols[iomdCol] ? cols[iomdCol].trim() : '0';

    // If timestamp is invalid, record row as an anomaly instead of aborting the import
    if (!normalized.isValid) {
      rawPunches.push({
        id: `punch-${punchIdCounter++}`,
        sourceRowNumber: r + 1,
        recordNo,
        machineNumber,
        enNo: rawEnNo,
        employeeName,
        mode,
        iomd,
        originalDateTime: rawDateTime,
        normalizedTimestamp: '',
        date: '',
        time: '',
        isDuplicate: false,
        isAnomaly: true,
        anomalyReason: `Invalid timestamp "${rawDateTime}" on row ${r + 1}`,
        rawLineSource: line,
      });
      continue;
    }

    // Check for duplicate punch (same EnNo + date + time)
    const duplicateKey = `${rawEnNo}|${normalized.date}|${normalized.time}`;
    const isDuplicate = seenPunches.has(duplicateKey);
    if (!isDuplicate) {
      seenPunches.add(duplicateKey);
    }

    // Register / update employee master information
    if (!employeesMap.has(rawEnNo)) {
      employeesMap.set(rawEnNo, {
        enNo: rawEnNo,
        name: employeeName,
        punchCount: 1,
      });
    } else {
      const existing = employeesMap.get(rawEnNo)!;
      existing.punchCount++;
      // If previous name was a placeholder but now we have a real human name, upgrade it
      if (
        employeeName &&
        !employeeName.startsWith('Employee ') &&
        (!existing.name || existing.name.startsWith('Employee '))
      ) {
        existing.name = employeeName;
      }
    }

    rawPunches.push({
      id: `punch-${punchIdCounter++}`,
      sourceRowNumber: r + 1,
      recordNo,
      machineNumber,
      enNo: rawEnNo,
      employeeName,
      mode,
      iomd,
      originalDateTime: rawDateTime,
      normalizedTimestamp: normalized.normalizedIso,
      date: normalized.date,
      time: normalized.time,
      isDuplicate,
      isAnomaly: false,
      rawLineSource: line,
    });
  }

  // 6. Partition results into valid, duplicates, and anomalies
  const validPunches = rawPunches.filter((p) => !p.isDuplicate && !p.isAnomaly);
  const duplicatePunches = rawPunches.filter((p) => p.isDuplicate);
  const anomalies = rawPunches.filter((p) => p.isAnomaly);

  // If ZERO valid punches were extracted across the entire file, provide the real technical reason
  if (validPunches.length === 0) {
    const errorDetails = [
      `The file was read (${nonEmptyLines.length} lines detected), but the required biometric columns could not be detected.`,
      `Expected columns: No, Mchn, EnNo (or Employee ID), Name, Mode, IOMd, DateTime.`,
      `Detected delimiter: ${delimiter === '\t' ? 'TAB' : delimiter}.`,
      `Sample line analyzed: "${nonEmptyLines[startRow] || nonEmptyLines[0]}"`,
    ].join(' ');

    throw new Error(errorDetails);
  }

  // 7. Sort raw punches chronologically
  rawPunches.sort((a, b) => {
    if (!a.normalizedTimestamp) return 1;
    if (!b.normalizedTimestamp) return -1;
    return a.normalizedTimestamp.localeCompare(b.normalizedTimestamp);
  });

  // 8. Construct sorted employees list with EnNo as primary identity
  const employees: Employee[] = Array.from(employeesMap.values())
    .map((e) => ({
      employeeId: e.enNo,
      name: e.name,
      isActive: true,
      totalPunchesInFile: e.punchCount,
    }))
    .sort((a, b) => {
      const numA = Number(a.employeeId);
      const numB = Number(b.employeeId);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.employeeId.localeCompare(b.employeeId);
    });

  // 9. Detect all dates and months represented in the dataset
  const dateSet = new Set<string>();
  rawPunches.forEach((p) => {
    if (p.date) dateSet.add(p.date);
  });
  const sortedDates = Array.from(dateSet).sort();

  const firstDate = sortedDates[0] || '';
  const lastDate = sortedDates[sortedDates.length - 1] || '';
  const reportDate = lastDate; // Latest valid attendance date in dataset is default report date

  const monthPunchesCount = new Map<string, number>();
  const monthDatesCount = new Map<string, Set<string>>();
  rawPunches.forEach((p) => {
    if (p.date && p.date.length >= 7) {
      const m = p.date.substring(0, 7);
      monthPunchesCount.set(m, (monthPunchesCount.get(m) || 0) + 1);
      if (!monthDatesCount.has(m)) monthDatesCount.set(m, new Set());
      monthDatesCount.get(m)!.add(p.date);
    }
  });

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Detect all distinct months represented in the biometric data, sorted chronologically
  const availableMonths = Array.from(monthDatesCount.keys())
    .sort()
    .map((mKey) => {
      const [year, monthNum] = mKey.split('-');
      const label = `${monthNames[parseInt(monthNum, 10) - 1]} ${year}`;
      const punchCount = monthPunchesCount.get(mKey) || 0;
      return {
        monthKey: mKey,
        label,
        recordCount: punchCount,
        monthLabel: label,
        punchCount,
      };
    });

  // Determine file format
  let fileFormat: 'TXT' | 'CSV' | 'TSV' | 'DAT' = 'TXT';
  const fnLower = fileName.toLowerCase();
  if (fnLower.endsWith('.csv')) fileFormat = 'CSV';
  else if (fnLower.endsWith('.tsv')) fileFormat = 'TSV';
  else if (fnLower.endsWith('.dat')) fileFormat = 'DAT';

  const rawFile: RawBiometricFile = {
    id: `file-${Date.now()}`,
    fileName,
    fileSizeBytes,
    mimeType,
    uploadedAt: new Date().toISOString(),
    rawContent: content,
    totalLinesDetected: allLines.length,
    encoding: 'UTF-8',
    fileFormat,
    detectedDelimiter: delimiter === '\t' ? 'TAB' : delimiter === 'WHITESPACE' ? 'SPACES' : delimiter,
  };

  const punchesByEmployee: Record<string, RawBiometricPunch[]> = {};
  for (const p of rawPunches) {
    const code = p.enNo || p.employeeId || '';
    if (code) {
      if (!punchesByEmployee[code]) punchesByEmployee[code] = [];
      punchesByEmployee[code].push(p);
    }
  }

  // Generate audit warnings if anomalies or duplicates detected
  if (anomalies.length > 0) {
    parseWarnings.push(`${anomalies.length} row(s) contained invalid timestamps or malformed data.`);
  }
  if (duplicatePunches.length > 0) {
    parseWarnings.push(`${duplicatePunches.length} duplicate punch line(s) detected and deduplicated.`);
  }

  const summary = {
    totalRowsDetected: rawPunches.length,
    validRowsCount: validPunches.length,
    invalidRowsCount: anomalies.length,
    duplicateRowsCount: duplicatePunches.length,
    employeesCount: employees.length,
    startDate: firstDate,
    endDate: lastDate,
    dateSpanFormatted: formatDateSpan(firstDate, lastDate),
    detectedMonthsCount: availableMonths.length,
    warnings: parseWarnings,
  };

  return {
    file: rawFile,
    allPunches: rawPunches,
    validPunches,
    duplicatePunches,
    anomalies,
    employees,
    firstDate,
    lastDate,
    reportDate,
    datesRepresented: sortedDates,
    dateRange: {
      startDate: firstDate,
      endDate: lastDate,
      totalDays: sortedDates.length,
    },
    availableMonths,
    punchesByEmployee,
    summary,
  };
}
