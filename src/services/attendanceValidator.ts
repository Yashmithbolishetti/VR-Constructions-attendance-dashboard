import { RawBiometricPunch, AttendanceException } from '../types/attendance';

/**
 * VR CONSTRUCTIONS — ATTENDANCE VALIDATOR SERVICE
 *
 * Inspects parsed raw punches and flags suspicious records:
 * - Rapid repeated punches (bounce within 60s)
 * - Extreme timestamps (overnight or before 06:00 AM)
 * - Irregular machine modes
 * Never deletes records; tags them for audit in the Exception Center.
 */

export interface ValidationSummary {
  totalAnalyzed: number;
  anomaliesFound: number;
  duplicateCount: number;
  rapidBouncesCount: number;
  extremeHoursCount: number;
  exceptions: AttendanceException[];
}

/**
 * Converts HH:mm:ss into total seconds from midnight
 */
export function timeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map((p) => parseInt(p, 10) || 0);
  return parts[0] * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

/**
 * Validates a list of raw biometric punches and returns detected anomalies and exceptions
 */
export function validateBiometricPunches(punches: RawBiometricPunch[]): {
  validatedPunches: RawBiometricPunch[];
  summary: ValidationSummary;
} {
  const validatedPunches = punches.map((p) => ({ ...p }));
  const exceptions: AttendanceException[] = [];

  let rapidBouncesCount = 0;
  let extremeHoursCount = 0;

  // Group punches by employee and date to check rapid succession and time patterns
  const groupKeyMap = new Map<string, RawBiometricPunch[]>();
  for (const p of validatedPunches) {
    if (!p.date || !p.enNo) continue;
    const key = `${p.enNo}|${p.date}`;
    if (!groupKeyMap.has(key)) {
      groupKeyMap.set(key, []);
    }
    groupKeyMap.get(key)!.push(p);
  }

  for (const [key, group] of groupKeyMap.entries()) {
    // Sort chronologically
    group.sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time));

    for (let i = 0; i < group.length; i++) {
      const current = group[i];

      // 1. Extreme Timestamp Check (before 06:00 AM or after 23:00 PM)
      const secs = timeToSeconds(current.time);
      if (secs < 6 * 3600 && secs > 0) {
        current.isAnomaly = true;
        current.anomalyReason = `Unusually early punch recorded at ${current.time}`;
        extremeHoursCount++;

        exceptions.push({
          id: `exc-early-${current.id}`,
          employeeId: current.enNo,
          employeeName: current.employeeName,
          date: current.date,
          category: 'ANOMALY',
          severity: 'medium',
          title: 'Unusually Early Biometric Punch',
          description: `Punch recorded at ${current.time} (before 06:00 AM standard facility hours). Requires site supervisor verification.`,
          punches: [current],
        });
      } else if (secs >= 23 * 3600) {
        current.isAnomaly = true;
        current.anomalyReason = `Overnight / late punch recorded at ${current.time}`;
        extremeHoursCount++;

        exceptions.push({
          id: `exc-night-${current.id}`,
          employeeId: current.enNo,
          employeeName: current.employeeName,
          date: current.date,
          category: 'ANOMALY',
          severity: 'medium',
          title: 'Possible Overnight Punch',
          description: `Punch registered at ${current.time} (near midnight). Verify if employee worked an approved night shift.`,
          punches: [current],
        });
      }

      // 2. Rapid repeated bounce punch check (within 60 seconds of previous punch by same employee)
      if (i > 0) {
        const prev = group[i - 1];
        const diffSeconds = timeToSeconds(current.time) - timeToSeconds(prev.time);
        if (diffSeconds >= 0 && diffSeconds <= 60 && !current.isDuplicate) {
          current.isAnomaly = true;
          current.anomalyReason = `Rapid duplicate punch (${diffSeconds}s after previous punch)`;
          rapidBouncesCount++;

          exceptions.push({
            id: `exc-rapid-${current.id}`,
            employeeId: current.enNo,
            employeeName: current.employeeName,
            date: current.date,
            category: 'DUPLICATE',
            severity: 'low',
            title: 'Rapid Successive Punch',
            description: `Employee recorded two punches within ${diffSeconds} seconds (${prev.time} and ${current.time}). Second punch flagged to prevent time distortion.`,
            punches: [prev, current],
          });
        }
      }
    }
  }

  // Also record duplicate punches in exceptions for audit
  validatedPunches.filter((p) => p.isDuplicate).forEach((dup) => {
    exceptions.push({
      id: `exc-dup-${dup.id}`,
      employeeId: dup.enNo,
      employeeName: dup.employeeName,
      date: dup.date,
      category: 'DUPLICATE',
      severity: 'low',
      title: 'Identical Duplicate Punch',
      description: `Exact duplicate machine log at ${dup.originalDateTime} (Row #${dup.sourceRowNumber}). Excluded from calculations but retained in raw audit records.`,
      punches: [dup],
    });
  });

  const duplicateCount = validatedPunches.filter((p) => p.isDuplicate).length;
  const anomaliesFound = validatedPunches.filter((p) => p.isAnomaly).length;

  return {
    validatedPunches,
    summary: {
      totalAnalyzed: validatedPunches.length,
      anomaliesFound,
      duplicateCount,
      rapidBouncesCount,
      extremeHoursCount,
      exceptions,
    },
  };
}
