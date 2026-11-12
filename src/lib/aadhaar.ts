// Aadhaar number helpers shared by browser and server. Aadhaar numbers are 12 digits,
// never start with 0 or 1, and end with a Verhoeff check digit (catches typos).

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

export function verhoeffValid(num: string): boolean {
  let c = 0;
  const digits = num.split("").reverse().map(Number);
  for (let i = 0; i < digits.length; i++) {
    const digit = digits[i];
    if (digit === undefined) return false;
    const permuted = P[i % 8]?.[digit];
    const next = permuted === undefined ? undefined : D[c]?.[permuted];
    if (next === undefined) return false;
    c = next;
  }
  return c === 0;
}

/** Check digit to append to `partial` so the whole number passes Verhoeff. */
export function verhoeffCheckDigit(partial: string): number {
  let c = 0;
  const digits = partial.split("").reverse().map(Number);
  for (let i = 0; i < digits.length; i++) {
    const digit = digits[i];
    const permuted = digit === undefined ? undefined : P[(i + 1) % 8]?.[digit];
    const next = permuted === undefined ? undefined : D[c]?.[permuted];
    if (next === undefined) throw new Error("Invalid identity digits");
    c = next;
  }
  const check = INV[c];
  if (check === undefined) throw new Error("Invalid identity digits");
  return check;
}

export function normalizeAadhaar(input: string): string {
  return (input ?? "").replace(/[\s-]/g, "");
}

/** Returns an error message, or null when the number is valid. */
export function validateAadhaar(input: string): string | null {
  const n = normalizeAadhaar(input);
  if (!n) return "Aadhaar number is required.";
  if (!/^\d{12}$/.test(n)) return "Aadhaar number must be 12 digits.";
  if (/^[01]/.test(n)) return "Aadhaar number cannot start with 0 or 1.";
  return null;
}

export function formatAadhaar(input: string): string {
  const n = normalizeAadhaar(input).slice(0, 12);
  return n.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function maskAadhaar(last4: string): string {
  return `XXXX XXXX ${last4}`;
}
