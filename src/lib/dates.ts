/**
 * BhaiBiz Date Utilities
 * Standardizes all user-facing dates to DD-MM-YYYY format throughout the application.
 * Backend and database RPC values remain ISO YYYY-MM-DD.
 */

/** Returns today's date in India (Asia/Kolkata) as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Returns today's date in India (Asia/Kolkata) as DD-MM-YYYY. */
export function todayDDMMYYYY(now: Date = new Date()): string {
  return formatDate(todayISO(now));
}

/**
 * Formats an ISO string (YYYY-MM-DD or full timestamp), Date object, or DD-MM-YYYY string
 * to canonical DD-MM-YYYY format.
 * Returns "—" if empty, null, or undefined.
 */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "—";

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return "—";
    const parts = new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).formatToParts(input);
    const d = parts.find((p) => p.type === "day")?.value ?? "";
    const m = parts.find((p) => p.type === "month")?.value ?? "";
    const y = parts.find((p) => p.type === "year")?.value ?? "";
    return `${d}-${m}-${y}`;
  }

  const str = String(input).trim();
  if (!str) return "—";

  // Already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    return str;
  }

  // Full ISO timestamp with time (e.g. 2026-11-11T18:30:00Z)
  if (str.includes("T")) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const parts = new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).formatToParts(d);
      const day = parts.find((p) => p.type === "day")?.value ?? "";
      const mon = parts.find((p) => p.type === "month")?.value ?? "";
      const yr = parts.find((p) => p.type === "year")?.value ?? "";
      return `${day}-${mon}-${yr}`;
    }
  }

  // YYYY-MM-DD
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${d}-${m}-${y}`;
  }

  return str;
}

/**
 * Formats a timestamp into "DD-MM-YYYY, hh:mm a" in Asia/Kolkata timezone.
 */
export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  if (isNaN(date.getTime())) return "—";
  const dateStr = formatDate(date);
  const timeStr = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
  return `${dateStr}, ${timeStr}`;
}

/**
 * Converts a YYYY-MM-DD string to DD-MM-YYYY.
 * Returns "" if input is invalid or empty.
 */
export function isoToDDMMYYYY(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

/**
 * Converts a DD-MM-YYYY string (or DD/MM/YYYY or DD.MM.YYYY) to YYYY-MM-DD (ISO 8601).
 * Validates actual calendar dates (leap years, 28/29/30/31 days).
 * Returns null if invalid.
 */
export function ddmmyyyyToISO(str: string | null | undefined): string | null {
  if (!str) return null;
  const cleaned = str.trim().replace(/[/.]/g, "-");
  const match = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const d = match[1]!.padStart(2, "0");
  const m = match[2]!.padStart(2, "0");
  const y = match[3]!;
  const iso = `${y}-${m}-${d}`;

  // Validate that the date is a real calendar date
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== iso) return null;

  return iso;
}

/** Formats user typing into DD-MM-YYYY masked input */
export function formatAsDDMMYYYYInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}
